(function (root) {
  "use strict";
  const P = root.LBSynthesisPhysics || require("./physics.js"),
    S = root.LBSynthesis || require("./engine.js"),
    G = root.LBSynthesisSeeds || require("./seeds.js"),
    M = root.LBMerit || require("../design/merit.js"),
    L = root.LBSearch || require("../optimization/search.js"),
    E = root.LBExplorer || require("../optimization/explorer.js"),
    C = root.LBMaterials || require("../materials/catalog.js");
  function proposals(system, spec, includeFamilies = true) {
    const choices = [], seen = new Set();
    for (const [i, a] of system.surfaces.entries()) {
      if (a.glass === "AIR") continue;
      for (const glass of spec.allowedGlasses) {
        const g = C.catalog[glass], h = C.catalog[a.glass];
        if (!g || !h || g.model !== "sellmeier" || h.model !== "sellmeier")
          throw Error("Glass search requires verified Sellmeier materials");
        if (JSON.stringify([g.B, g.C]) === JSON.stringify([h.B, h.C])) continue;
        const family = system.surfaces.flatMap((s, j) => s.glass === a.glass ? [j] : []);
        for (const surfaces of includeFamilies ? [[i], family] : [[i]]) {
          const key = JSON.stringify([surfaces, glass]);
          if (seen.has(key)) continue;
          seen.add(key);
          choices.push({ surfaces, surface: surfaces[0], fromGlass: a.glass, glass,
            scope: surfaces.length > 1 ? "material-family" : "single-element",
            distance: Math.abs(g.nd - h.nd) + Math.abs(g.Vd - h.Vd) / 100 });
        }
      }
    }
    return choices.sort((a,b) => a.distance-b.distance || a.surface-b.surface ||
      a.glass.localeCompare(b.glass) || a.surfaces.length-b.surfaces.length);
  }
  function denseEvaluation(system, item, spec, operands) {
    const job = S.makeJob({ spec, operands, software: {} },
      { system, ordinal: item.ordinal }, 4);
    return E.evaluate(job, job.variables.map(v => v.value), true);
  }
  function substitute(parent, choice) {
    const candidate = structuredClone(parent);
    choice.surfaces.forEach(i => { candidate.surfaces[i].glass = choice.glass; });
    if (choice.scope === "material-family") {
      // Preserve each interface's paraxial power (n_after - n_before) / R.
      // This includes shared cemented interfaces; no thin-element approximation.
      for (let i = 1; i < candidate.surfaces.length - 1; i++) {
        const a = parent.surfaces[i], b = candidate.surfaces[i];
        if (!a.R) continue;
        const oldDelta = C.index(a.glass) - C.index(parent.surfaces[i-1].glass),
          newDelta = C.index(b.glass) - C.index(candidate.surfaces[i-1].glass);
        if (Math.abs(oldDelta) > 1e-12 && Math.abs(newDelta) > 1e-12)
          b.R = a.R * newDelta / oldDelta;
      }
    }
    return candidate;
  }
  async function optimize(item, spec, operands, options = {}) {
    const budget = options.perTrialBudget ?? 200;
    if (!Number.isInteger(budget) || budget < 2 || budget > 100000)
      throw Error("Per-trial budget must be 2–100000");
    const parent = item.dense?.prescription || item.system,
      analysis = S.analysisSpec(spec), base = M.evaluate(parent, analysis, operands),
      before = denseEvaluation(parent, item, spec, operands);
    if (!base.merit.valid || S.compliance(before, spec).status !== "DENSE VALIDATED")
      throw Error("Glass refinement needs a dense-valid base");
    let best = { ...structuredClone(item), system: structuredClone(parent),
        score: base.merit.total, dense: before, ...S.compliance(before, spec) },
      score = base.merit.total, denseScore = before.score,
      evaluations = 2, denseEvaluations = 1;
    const trials = [], choices = proposals(parent, spec, options.includeFamilies !== false);
    for (const choice of choices) {
      // Every proposal starts from the frozen parent, not from an earlier trial.
      const candidate = substitute(parent, choice), trial = { ...choice,
        initialization: choice.scope === "material-family" ? "preserve-surface-power" : "unchanged-radii" };
      trials.push(trial);
      const first = P.firstOrder(candidate);
      evaluations++;
      if (!first.ok || !(first.p.eflMm > 0)) {
        trial.status = first.code || "POWER_DISTRIBUTION";
        continue;
      }
      const scale = spec.targetEflMm / first.p.eflMm;
      for (const a of candidate.surfaces.slice(1, -1)) {
        a.R *= scale; a.t *= scale; a.ap *= scale; a.ap_optical = a.ap;
      }
      trial.firstOrderScale = scale;
      const checked = P.prepare(candidate, spec);
      if (!checked.ok) { trial.status = checked.code; continue; }
      const measured = M.evaluate(checked.system, analysis, operands);
      evaluations++;
      if (!measured.merit.valid) { trial.status = "RAYTRACE_FAILURE"; continue; }
      const local = L.create(checked.system, analysis, G.variables(checked.system, spec),
        operands, { maxEvaluations: budget });
      evaluations++;
      while (!local.done) {
        for (let i = 0; i < 16 && !local.done; i++) {
          const n = local.evaluations;
          L.advance(local);
          evaluations += local.evaluations - n;
        }
        if (options.yield) await options.yield();
      }
      Object.assign(trial, { before: measured.merit.total, after: local.bestScore,
        localEvaluations: local.evaluations });
      // Search sampling cannot rank dense quality reliably: audit every refined trial.
      const sized = P.apertures(L.prescription(local, local.bestVector), spec,
        Math.ceil(spec.validationGrid / 2));
      if (!sized.ok) { trial.status = "DENSE_" + sized.code; continue; }
      const dense = denseEvaluation(sized.system, item, spec, operands),
        compliance = S.compliance(dense, spec);
      evaluations++; denseEvaluations++;
      trial.denseScore = dense.score;
      trial.previousBestDenseScore = denseScore;
      if (compliance.status !== "DENSE VALIDATED") {
        trial.status = "DENSE_INVALID";
      } else if (dense.score < denseScore - 1e-10) {
        score = local.bestScore; denseScore = dense.score;
        best = { ...structuredClone(item), system: sized.system, score, dense,
          ...compliance, footprints: sized.footprints };
        trial.status = "ACCEPTED";
      } else trial.status = "NO_DENSE_IMPROVEMENT";
    }
    const audit = { evaluations, denseEvaluations, trials,
      initialScore: base.merit.total, finalScore: score,
      initialDenseScore: before.score, finalDenseScore: denseScore,
      strategy: "single-element and optional material-family substitutions from frozen parent; first-order EFL scale; local reoptimization; fresh dense incumbent ranking" };
    return { ...best, glassSearch: audit, glassSearches: [...(item.glassSearches || []), audit] };
  }
  const api = { optimize, proposals, substitute };
  root.LBGlassSearch = api;
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);
