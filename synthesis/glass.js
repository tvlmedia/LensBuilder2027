(function (root) {
  "use strict";
  const P = root.LBSynthesisPhysics || require("./physics.js"),
    S = root.LBSynthesis || require("./engine.js"),
    G = root.LBSynthesisSeeds || require("./seeds.js"),
    M = root.LBMerit || require("../design/merit.js"),
    L = root.LBSearch || require("../optimization/search.js"),
    E = root.LBExplorer || require("../optimization/explorer.js"),
    C = root.LBMaterials || require("../materials/catalog.js");
  async function optimize(item, spec, operands, options = {}) {
    let best = structuredClone(item),
      evaluations = 0;
    const trials = [],
      analysis = S.analysisSpec(spec),
      base = M.evaluate(item.system, analysis, operands);
    if (!base.merit.valid) throw Error("Glass refinement needs a valid base");
    let score = base.merit.total;
    const choices = [];
    item.system.surfaces.forEach((a, i) => {
      if (a.glass === "AIR") return;
      for (const glass of spec.allowedGlasses)
        if (glass !== a.glass) {
          const g = C.catalog[glass],
            h = C.catalog[a.glass];
          if (
            JSON.stringify(g.B) === JSON.stringify(h.B) &&
            JSON.stringify(g.C) === JSON.stringify(h.C)
          )
            continue;
          choices.push({
            surface: i,
            glass,
            distance: Math.abs(g.nd - h.nd) + Math.abs(g.Vd - h.Vd) / 100,
          });
        }
    });
    choices.sort(
      (a, b) =>
        a.distance - b.distance ||
        a.surface - b.surface ||
        a.glass.localeCompare(b.glass),
    );
    for (const choice of choices) {
      const candidate = structuredClone(item.system);
      candidate.surfaces[choice.surface].glass = choice.glass;
      const first = P.firstOrder(candidate);
      if (!first.ok || !(first.p.eflMm > 0)) {
        trials.push({ ...choice, status: first.code || "POWER_DISTRIBUTION" });
        evaluations++;
        continue;
      }
      const scale = spec.targetEflMm / first.p.eflMm;
      for (const a of candidate.surfaces.slice(1, -1)) {
        a.R *= scale;
        a.t *= scale;
        a.ap *= scale;
        a.ap_optical = a.ap;
      }
      choice.firstOrderScale = scale;
      const checked = P.prepare(candidate, spec);
      evaluations++;
      if (!checked.ok) {
        trials.push({ ...choice, status: checked.code });
        continue;
      }
      const measured = M.evaluate(checked.system, analysis, operands);
      evaluations++;
      if (!measured.merit.valid) {
        trials.push({ ...choice, status: "RAYTRACE_FAILURE" });
        continue;
      }
      const local = L.create(
        checked.system,
        analysis,
        G.variables(checked.system, spec),
        operands,
        { maxEvaluations: options.perTrialBudget || 200 },
      );
      evaluations++;
      while (!local.done) {
        for (let i = 0; i < 16 && !local.done; i++) {
          const n = local.evaluations;
          L.advance(local);
          evaluations += local.evaluations - n;
        }
        if (options.yield) await options.yield();
      }
      const system = P.prepare(
        L.prescription(local, local.bestVector),
        spec,
      ).system;
      trials.push({
        ...choice,
        status: "RAYTRACED_AND_REOPTIMIZED",
        before: measured.merit.total,
        after: local.bestScore,
      });
      if (local.bestScore < score) {
        const sized = P.apertures(
          system,
          spec,
          Math.ceil(spec.validationGrid / 2),
        );
        if (!sized.ok) continue;
        const e = S.makeJob(
            { spec, operands, software: {} },
            { system: sized.system, ordinal: item.ordinal },
            4,
          ),
          dense = E.evaluate(
            e,
            e.variables.map((v) => v.value),
            true,
          );
        evaluations++;
        const compliance = S.compliance(dense, spec);
        if (
          compliance.status === "DENSE VALIDATED" &&
          (!item.dense || dense.score < item.dense.score)
        ) {
          score = local.bestScore;
          best = { ...item, system: sized.system, score, dense, ...compliance };
        }
      }
    }
    return {
      ...best,
      glassSearch: {
        evaluations,
        trials,
        initialScore: base.merit.total,
        finalScore: score,
        strategy:
          "single-element substitution from frozen parent; uniform first-order EFL scale; verified Sellmeier subset; local geometry reoptimization and dense acceptance",
      },
    };
  }
  const api = { optimize };
  root.LBGlassSearch = api;
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);
