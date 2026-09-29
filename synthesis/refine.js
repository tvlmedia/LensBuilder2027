(function (root) {
  "use strict";
  const P = root.LBSynthesisPhysics || require("./physics.js"),
    S = root.LBSynthesis || require("./engine.js"),
    G = root.LBSynthesisSeeds || require("./seeds.js"),
    L = root.LBSearch || require("../optimization/search.js"),
    E = root.LBExplorer || require("../optimization/explorer.js");
  function validate(system, item, spec, operands) {
    const job = S.makeJob({ spec, operands, software: {} },
      { system, ordinal: item.ordinal }, 4);
    return E.evaluate(job, job.variables.map(v => v.value), true);
  }
  async function optimize(item, spec, operands, options = {}) {
    // Re-measure the parent under the same dense objective; never trust cached scores.
    const parent = item.dense?.prescription || item.system,
      before = validate(parent, item, spec, operands);
    if (S.compliance(before, spec).status !== "DENSE VALIDATED")
      throw Error("Geometry refinement needs a dense-valid parent");
    const local = L.create(parent, S.analysisSpec(spec), G.variables(parent, spec), operands,
      { maxEvaluations: options.maxEvaluations ?? 3000, patternAcceleration: options.patternAcceleration ?? true });
    while (!local.done) {
      for (let i = 0; i < 16 && !local.done; i++) L.advance(local);
      if (options.yield) await options.yield();
    }
    const sized = P.apertures(L.prescription(local, local.bestVector), spec,
      Math.ceil(spec.validationGrid / 2));
    const after = sized.ok ? validate(sized.system, item, spec, operands) : null,
      compliance = after ? S.compliance(after, spec) : { status: "INVALID" },
      accepted = compliance.status === "DENSE VALIDATED" &&
        after.score < before.score - 1e-10;
    const audit = {
      algorithm: local.algorithm, evaluations: local.evaluations,
      denseEvaluations: after ? 2 : 1, accepted,
      initialSearchScore: local.initialScore, finalSearchScore: local.bestScore,
      beforeDenseScore: before.score, afterDenseScore: after?.score ?? null,
      reason: accepted ? "Improved on independent dense sampling and passed hard constraints"
        : sized.ok ? "No dense-validated improvement; retained parent" : sized.code,
    };
    return {
      ...structuredClone(item),
      ...(accepted ? { system: sized.system, score: local.bestScore, dense: after,
        ...compliance, footprints: sized.footprints } : {}),
      geometryRefinement: audit,
      geometryRefinements: [...(item.geometryRefinements || []), audit],
    };
  }
  root.LBGeometryRefinement = { optimize };
  if (typeof module !== "undefined") module.exports = root.LBGeometryRefinement;
})(globalThis);
