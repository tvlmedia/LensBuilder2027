(function (root) {
  "use strict";
  const A = root.LBAnalysis || require("../analysis/evaluate.js");
  function defaultOperands(spec) {
    const base = [
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
    if (!spec.apertures) return base;
    const Multi =
      root.LBMultiAperture || require("../analysis/multi-aperture.js");
    return Multi.configuration(spec)
      .filter((a) => a.optimization)
      .flatMap((a) =>
        base.map((o) => ({
          ...o,
          aperture: a.fNumber,
          ...(o.metric === "fNumber" ? { target: a.fNumber } : {}),
        })),
      );
  }
  function metric(result, o) {
    const f = result.fields.find((f) => Math.abs(f.field - o.field) < 1e-8);
    switch (o.metric) {
      case "bfl":
        return result.firstOrder.bflMm;
      case "pupilSurvival":
        return Math.min(...result.fields.map((f) => f.rayFraction));
      case "efl":
        return result.firstOrder.eflMm;
      case "fNumber":
        return result.firstOrder.fNumber;
      case "tangentialRms":
        return f?.tangentialRmsMm;
      case "sagittalRms":
        return f?.sagittalRmsMm;
      case "rms":
        return f?.rmsMm;
      case "lateralColor":
        if (o.field !== undefined) return f?.lateralChiefColorMm;
        return Math.max(
          ...result.fields.map((f) => Math.abs(f.lateralChiefColorMm)),
        );
      case "longitudinalColor":
        return result.longitudinalColorMm;
      case "distortion":
        if (o.field !== undefined) return f?.distortionPercent;
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
    if (!Array.isArray(operands) || !operands.length || operands.length > 256)
      throw new Error("Need 1–256 merit operands");
    for (const o of operands) {
      if (o.operation && !["CHANGE", "RATIO"].includes(o.operation))
        throw Error("Unknown cross-aperture operation");
      for (const k of ["aperture", "compareAperture"])
        if (o[k] !== undefined && (!Number.isFinite(o[k]) || o[k] <= 0))
          throw Error("Invalid operand aperture");
      if (
        o.operation &&
        (o.aperture === undefined || o.compareAperture === undefined)
      )
        throw Error("Cross-aperture operands need two apertures");
      if (
        o.ratioFloor !== undefined &&
        (!Number.isFinite(o.ratioFloor) || o.ratioFloor <= 0)
      )
        throw Error("Ratio floor must be positive");
      if (
        ![
          "bfl",
          "pupilSurvival",
          "efl",
          "fNumber",
          "rms",
          "tangentialRms",
          "sagittalRms",
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
      if (
        o.type &&
        ![
          "MINIMIZE",
          "MAXIMIZE",
          "TARGET VALUE",
          "TARGET RANGE",
          "MINIMUM",
          "MAXIMUM",
        ].includes(o.type)
      )
        throw new Error("Unknown operand type");
      if (o.type === "TARGET RANGE" && !Array.isArray(o.target))
        throw new Error("Range needs two targets");
      if (o.type && o.type !== "TARGET RANGE" && Array.isArray(o.target))
        throw new Error("This operand type needs a scalar target");
      if (
        ["rms", "tangentialRms", "sagittalRms"].includes(o.metric) &&
        (!Number.isFinite(o.field) || o.field < 0 || o.field > 1)
      )
        throw new Error("RMS operand needs a field in [0,1]");
      const t = Array.isArray(o.target) ? o.target : [o.target];
      if (
        !t.every(Number.isFinite) ||
        (Array.isArray(o.target) && t.length !== 2) ||
        (t.length === 2 && t[0] > t[1])
      )
        throw new Error("Invalid operand target");
    }
    if (!operands.some((o) => o.enabled !== false && o.weight > 0))
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
    let breakdown;
    try {
      breakdown = operands
        .filter((o) => o.enabled !== false)
        .map((o) => {
          const pick = (aperture) => {
            if (!result.apertures) {
              if (aperture !== undefined)
                throw Error(
                  "Operand aperture requires multi-aperture configuration",
                );
              return { analysis: result, config: { weight: 1 } };
            }
            if (aperture === undefined)
              throw Error(
                "Multi-aperture operands require an explicit aperture",
              );
            const a = result.apertures.find(
              (a) => a.config.fNumber === aperture,
            );
            if (!a) throw Error("Operand aperture is not evaluated");
            return a;
          };
          const source = pick(o.aperture);
          let value = metric(source.analysis, o);
          if (o.operation) {
            const other = metric(pick(o.compareAperture).analysis, o);
            value =
              o.operation === "CHANGE"
                ? value - other
                : Math.abs(other) >= (o.ratioFloor ?? 1e-9)
                  ? value / other
                  : NaN;
          }

          if (!Number.isFinite(value))
            throw new Error(`Unavailable ${o.metric} field ${o.field ?? ""}`);
          let error = Array.isArray(o.target)
            ? value < o.target[0]
              ? value - o.target[0]
              : value > o.target[1]
                ? value - o.target[1]
                : 0
            : value - o.target;
          if (o.type === "MINIMUM") error = Math.min(0, value - o.target);
          if (o.type === "MAXIMUM") error = Math.max(0, value - o.target);
          // Directional linear objectives are signed; unlike squared distance they are monotonic.
          const apertureWeight = source.config.weight;
          const contribution =
            apertureWeight *
            (o.type === "MINIMIZE"
              ? (o.weight * value) / o.scale
              : o.type === "MAXIMIZE"
                ? (-o.weight * value) / o.scale
                : o.weight * (error / o.scale) ** 2);
          total += contribution;
          return { ...o, apertureWeight, value, error, contribution };
        });
    } catch (e) {
      return {
        valid: false,
        total: Infinity,
        breakdown: [],
        errors: [e.message],
      };
    }
    return { valid: Number.isFinite(total), total, breakdown, errors: [] };
  }
  function evaluate(system, spec, operands = defaultOperands(spec)) {
    const analysis = spec.apertures
      ? (
          root.LBMultiAperture || require("../analysis/multi-aperture.js")
        ).evaluate(system, spec)
      : A.evaluate(system, spec);
    return { analysis, merit: score(analysis, operands) };
  }
  const api = { defaultOperands, validateOperands, score, evaluate, metric };
  root.LBMerit = api;
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);
