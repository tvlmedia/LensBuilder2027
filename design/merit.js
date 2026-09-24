(function (root) {
  "use strict";
  const A = root.LBAnalysis || require("../analysis/evaluate.js");
  function defaultOperands(spec) {
    return [
      {
        metric: "efl",
        target: spec.targetEflMm,
        scale: Math.max(0.5, spec.targetEflMm * 0.01),
        weight: 5,
      },
      {
        metric: "fNumber",
        target: spec.targetFNumber || 2,
        scale: 0.1,
        weight: 3,
      },
      ...A.DEFAULT_FIELDS.map((field) => ({
        metric: "rms",
        field,
        target: 0,
        scale: 0.05,
        weight: field <= 0.7 ? 2 : 1,
      })),
      { metric: "lateralColor", target: 0, scale: 0.01, weight: 1 },
      { metric: "longitudinalColor", target: 0, scale: 0.1, weight: 0.2 },
      { metric: "distortion", target: [-2, 2], scale: 1, weight: 0.2 },
      { metric: "rayLoss", target: 0, scale: 0.1, weight: 2 },
    ];
  }
  function metric(result, o) {
    const f = result.fields.find((f) => Math.abs(f.field - o.field) < 1e-8);
    switch (o.metric) {
      case "efl":
        return result.firstOrder.eflMm;
      case "fNumber":
        return result.firstOrder.fNumber;
      case "rms":
        return f?.rmsMm;
      case "lateralColor":
        return Math.max(
          ...result.fields.map((f) => Math.abs(f.lateralChiefColorMm)),
        );
      case "longitudinalColor":
        return result.longitudinalColorMm;
      case "distortion":
        return result.fields.reduce(
          (v, f) =>
            Math.abs(f.distortionPercent) > Math.abs(v)
              ? f.distortionPercent
              : v,
          0,
        );
      case "rayLoss":
        return 1 - Math.min(...result.fields.map((f) => f.rayFraction));
      default:
        throw new Error(`Unsupported merit metric ${o.metric}`);
    }
  }
  function validateOperands(operands) {
    if (!Array.isArray(operands) || !operands.length || operands.length > 64)
      throw new Error("Need 1–64 merit operands");
    for (const o of operands) {
      if (
        ![
          "efl",
          "fNumber",
          "rms",
          "lateralColor",
          "longitudinalColor",
          "distortion",
          "rayLoss",
        ].includes(o.metric)
      )
        throw new Error(`Unsupported merit metric ${o.metric}`);
      if (
        !(
          Number.isFinite(o.scale) &&
          o.scale > 0 &&
          Number.isFinite(o.weight) &&
          o.weight >= 0
        )
      )
        throw new Error("Invalid operand scale/weight");
      const t = Array.isArray(o.target) ? o.target : [o.target];
      if (
        !t.every(Number.isFinite) ||
        (Array.isArray(o.target) && t.length !== 2) ||
        (t.length === 2 && t[0] > t[1])
      )
        throw new Error("Invalid operand target");
    }
    if (!operands.some((o) => o.weight > 0))
      throw new Error("At least one positive weight required");
  }
  function score(result, operands) {
    validateOperands(operands);
    if (!result.valid)
      return {
        valid: false,
        total: Infinity,
        breakdown: [],
        errors: result.errors,
      };
    let total = 0;
    const breakdown = operands.map((o) => {
      const value = metric(result, o);
      if (!Number.isFinite(value))
        throw new Error(`Unavailable ${o.metric} field ${o.field ?? ""}`);
      let error = Array.isArray(o.target)
        ? value < o.target[0]
          ? value - o.target[0]
          : value > o.target[1]
            ? value - o.target[1]
            : 0
        : value - o.target;
      const contribution = o.weight * (error / o.scale) ** 2;
      total += contribution;
      return { ...o, value, error, contribution };
    });
    return { valid: Number.isFinite(total), total, breakdown, errors: [] };
  }
  function evaluate(system, spec, operands = defaultOperands(spec)) {
    const analysis = A.evaluate(system, spec);
    return { analysis, merit: score(analysis, operands) };
  }
  const api = { defaultOperands, validateOperands, score, evaluate };
  root.LBMerit = api;
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);
