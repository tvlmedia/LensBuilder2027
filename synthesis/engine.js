(function (root) {
  "use strict";
  const Spec = root.LBSynthesisSpec || require("./specification.js"),
    F = root.LBDesignForms || require("./forms.js"),
    G = root.LBSynthesisSeeds || require("./seeds.js"),
    P = root.LBSynthesisPhysics || require("./physics.js"),
    A = root.LBAnalysis || require("../analysis/evaluate.js"),
    M = root.LBMerit || require("../design/merit.js"),
    E = root.LBExplorer || require("../optimization/explorer.js"),
    L = root.LBSearch || require("../optimization/search.js");
  const VERSION = "synthesis-1",
    clone = (x) => structuredClone(x);
  function hash(x) {
    let h = 2166136261;
    for (const c of JSON.stringify(x)) {
      h ^= c.charCodeAt(0);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
  }
  function analysisSpec(s) {
    return {
      ...s,
      constraints: P.limits(s),
      synthesis: clone(s),
      allowApproximateMaterials: false,
    };
  }
  function operands(s) {
    const base = M.defaultOperands(s).flatMap((o) =>
      o.metric !== "rms"
        ? [o]
        : o.field === 0
          ? s.fields.map((field) => ({
              ...o,
              field,
              weight: field <= 0.7 ? 2 : 1,
            }))
          : [],
    );
    return base.map((o) => ({
      ...o,
      weight: o.metric === "efl" ? 10 : o.weight,
    }));
  }
  function create(raw, ops, software = {}) {
    const spec = Spec.specification(raw),
      selected = F.select(spec),
      total = spec.budget,
      allocation = {
        seeds: Math.floor((total * spec.seedFraction) / 2),
        coarse: Math.floor((total * spec.seedFraction) / 2),
        local: Math.floor(total * spec.localFraction),
        dense: Math.max(
          spec.archiveSize,
          Math.floor(total * spec.denseFraction),
        ),
      };
    allocation.global =
      total -
      allocation.seeds -
      allocation.coarse -
      allocation.local -
      allocation.dense;
    const objective = ops || operands(spec);
    M.validateOperands(objective);
    return {
      version: VERSION,
      id: "synthesis-" + Date.now(),
      createdAt: new Date().toISOString(),
      software,
      spec,
      operands: objective,
      meritPreset: ops ? "CUSTOM_OPERANDS" : "TECHNICAL_BALANCED_v1",
      configurationHash: hash([spec, objective, allocation]),
      selected,
      allocation,
      stage: "SEEDS",
      seedIndex: 0,
      seeds: [],
      jobs: [],
      jobIndex: 0,
      current: null,
      local: null,
      archive: [],
      results: [],
      counts: {
        seeds: 0,
        paraxialPassed: 0,
        coarse: 0,
        global: 0,
        local: 0,
        dense: 0,
      },
      rejections: {},
      stageRejections: {},
      elapsedMs: 0,
      timings: { seeds: 0, coarse: 0, global: 0, local: 0, dense: 0 },
      done: false,
    };
  }
  function reject(s, code, stage = s.stage) {
    s.rejections[code] = (s.rejections[code] || 0) + 1;
    const bucket = s.stageRejections[stage] || (s.stageRejections[stage] = {});
    bucket[code] = (bucket[code] || 0) + 1;
  }
  function retain(s, item) {
    const family = s.seeds.filter((a) => a.topology === item.topology);
    family.push(item);
    family.sort((a, b) => a.score - b.score);
    const kept = [];
    for (const a of family) {
      if (kept.length >= s.spec.parentsPerTopology) break;
      const vector = a.system.surfaces.map((x) => x.R);
      if (
        !kept.some(
          (b) =>
            vector.reduce(
              (d, v, i) =>
                d +
                Math.abs(v - b.system.surfaces[i].R) / Math.max(1, Math.abs(v)),
              0,
            ) /
              vector.length <
            0.03,
        )
      )
        kept.push(a);
    }
    s.seeds = s.seeds.filter((a) => a.topology !== item.topology).concat(kept);
  }
  function seedStep(s) {
    const start = performance.now(),
      index = s.seedIndex++,
      totalWeight = s.selected.reduce((n, a) => n + a.weight, 0);
    let pick = ((index * 0.618033988749895) % 1) * totalWeight,
      family = s.selected.at(-1).id;
    for (const a of s.selected) {
      pick -= a.weight;
      if (pick <= 0) {
        family = a.id;
        break;
      }
    }
    const a = G.generate(s.spec, family, index);
    s.counts.seeds++;
    s.timings.seeds += performance.now() - start;
    if (!a.ok) {
      reject(s, a.code);
      return;
    }
    s.counts.paraxialPassed++;
    if (s.counts.coarse >= s.allocation.coarse) return;
    const coarseStart = performance.now();
    const sized = P.apertures(
      a.system,
      { ...s.spec, fields: [0, 0.5, 1], wavelengths: [A.DEFAULT_WAVES[1]] },
      3,
    );
    s.counts.coarse++;
    if (!sized.ok) {
      reject(s, sized.code, "COARSE");
      s.timings.coarse += performance.now() - coarseStart;
      return;
    }
    const config = {
      ...analysisSpec(s.spec),
      apertures: [
        {
          fNumber: s.spec.targetFNumber,
          optimization: true,
          validation: true,
          weight: 1,
        },
      ],
      pupilGrid: 5,
      fields: [0, 0.5, 1],
      wavelengths: A.DEFAULT_WAVES,
    };
    const result = A.evaluate(sized.system, config);
    if (!result.valid) reject(s, "COARSE_COVERAGE_FAILURE", "COARSE");
    else
      retain(s, {
        topology: family,
        ordinal: index,
        system: sized.system,
        score: result.fields.reduce((n, f) => n + f.rmsMm, 0),
        firstOrder: result.firstOrder,
      });
    s.timings.coarse += performance.now() - coarseStart;
  }
  function startJobs(s) {
    s.jobs = s.seeds
      .slice()
      .sort((a, b) => a.topology.localeCompare(b.topology) || a.score - b.score)
      .slice(0, Math.floor(s.allocation.global / 5));
    if (!s.jobs.length) {
      s.stage = "FINISHED";
      s.done = true;
      return;
    }
    s.stage = "GLOBAL";
    s.jobIndex = 0;
  }
  function makeJob(s, job, budget) {
    return E.create(
      job.system,
      analysisSpec(s.spec),
      G.variables(job.system, s.spec),
      s.operands,
      {
        budget: Math.max(4, budget),
        population: Math.min(48, Math.max(8, Math.floor(budget / 10))),
        seed: (s.spec.seed + job.ordinal) >>> 0,
        archiveSize: Math.min(4, s.spec.archiveSize),
        diversity: 0.04,
        software: s.software,
      },
    );
  }
  function archiveJob(s) {
    const c = s.current,
      job = s.jobs[s.jobIndex];
    for (const a of c.archive) {
      const system = P.prepare(E.prescription(c, a.vector), s.spec).system;
      const out = {
        topology: job.topology,
        ordinal: job.ordinal,
        system,
        score: a.score,
        initialScore: job.initialScore,
        searchMetrics: a.metrics,
        status: "MEETS HARD SPEC",
      };
      s.archive.push(out);
    }
    s.archive.sort((a, b) => a.score - b.score);
    // Reserve one elite per explored family, then fill remaining slots by objective.
    const keep = [];
    for (const f of s.selected) {
      const a = s.archive.find((a) => a.topology === f.id);
      if (a) keep.push(a);
    }
    for (const a of s.archive) {
      if (keep.length >= s.spec.archiveSize) break;
      if (
        !keep.includes(a) &&
        !keep.some(
          (b) =>
            b.topology === a.topology &&
            Math.abs(a.score - b.score) <
              0.001 * Math.max(1, Math.abs(a.score)),
        )
      )
        keep.push(a);
    }
    s.archive = keep.slice(0, s.spec.archiveSize);
    s.current = null;
    s.jobIndex++;
  }
  function beginLocal(s) {
    s.stage = "LOCAL";
    s.jobIndex = 0;
    s.local = null;
  }
  function compliance(result, spec) {
    const system = result.prescription;
    if (!system) return { status: "INVALID", checks: { geometry: false } };
    const a = P.prepare(system, spec),
      analysis = result.analysis;
    const checks = {
      ...a.checks,
      coverage:
        !!analysis?.valid &&
        analysis.apertures?.every(
          (ap) =>
            ap.analysis?.valid &&
            ap.analysis.fields.every(
              (f) => f.rayFraction >= spec.minRayFraction,
            ),
        ),
    };
    const ok = a.ok && checks.coverage;
    return {
      status: ok
        ? "DENSE VALIDATED"
        : analysis?.valid
          ? "VALID BUT OUTSIDE SPEC"
          : "INVALID",
      checks,
      counts: a.counts,
    };
  }
  async function step(s, pool) {
    if (s.done) return s;
    const start = performance.now();
    if (s.stage === "SEEDS") {
      for (let i = 0; i < 16 && s.seedIndex < s.allocation.seeds; i++)
        seedStep(s);
      if (s.seedIndex >= s.allocation.seeds) startJobs(s);
    } else if (s.stage === "GLOBAL") {
      if (s.jobIndex >= s.jobs.length) beginLocal(s);
      else {
        const job = s.jobs[s.jobIndex];
        if (!s.current) {
          s.current = makeJob(
            s,
            job,
            Math.floor(s.allocation.global / s.jobs.length) - 1,
          );
          const r = E.evaluate(
            s.current,
            s.current.variables.map((v) => v.value),
          );
          job.initialScore = r.score;
          s.counts.global++;
          if (pool) await pool.init(s.current);
        }
        const v = E.next(s.current);
        if (v.length) {
          const t = performance.now(),
            results = pool
              ? await pool.evaluate(v)
              : v.map((v) => E.evaluate(s.current, v));
          E.accept(s.current, results);
          s.counts.global += v.length;
          s.timings.global += performance.now() - t;
          for (const r of results)
            if (r.score === null) reject(s, r.reason || "GLOBAL_INVALID");
        }
        if (s.current.done || !v.length) archiveJob(s);
      }
    } else if (s.stage === "LOCAL") {
      if (s.jobIndex >= s.archive.length) {
        s.stage = "DENSE";
        s.jobIndex = 0;
      } else {
        const item = s.archive[s.jobIndex],
          budget = Math.floor(s.allocation.local / s.archive.length),
          t = performance.now();
        if (budget < 2) {
          s.jobIndex++;
          return s;
        }
        if (!s.local) {
          try {
            s.local = L.create(
              item.system,
              analysisSpec(s.spec),
              G.variables(item.system, s.spec),
              s.operands,
              { maxEvaluations: Math.min(100000, budget), seed: s.spec.seed },
            );
            s.counts.local++;
          } catch (e) {
            reject(s, "LOCAL_BASE_INVALID");
            s.jobIndex++;
            s.timings.local += performance.now() - t;
            return s;
          }
        }
        let count = 0;
        while (!s.local.done && count++ < 16) {
          const before = s.local.evaluations;
          L.advance(s.local);
          s.counts.local += s.local.evaluations - before;
        }
        if (s.local.done) {
          item.beforeLocalScore = item.score;
          item.system = P.prepare(
            L.prescription(s.local, s.local.bestVector),
            s.spec,
          ).system;
          item.score = s.local.bestScore;
          s.local = null;
          s.jobIndex++;
        }
        s.timings.local += performance.now() - t;
      }
    } else if (s.stage === "DENSE") {
      if (s.jobIndex >= s.archive.length) {
        s.stage = "FINISHED";
        s.done = true;
      } else {
        const item = s.archive[s.jobIndex],
          t = performance.now();
        const sized = P.apertures(
          item.system,
          s.spec,
          Math.ceil(s.spec.validationGrid / 2),
        );
        if (!sized.ok) {
          reject(s, "DENSE_" + sized.code);
          s.results.push({
            ...item,
            status: "INVALID",
            checks: { geometry: false },
            failure: sized.code,
          });
        } else {
          const e = makeJob(s, { ...item, system: sized.system }, 4);
          const dense = pool
            ? (await pool.init(e),
              (await pool.evaluate([e.variables.map((v) => v.value)], true))[0])
            : E.evaluate(
                e,
                e.variables.map((v) => v.value),
                true,
              );
          s.results.push({
            ...item,
            system: sized.system,
            dense,
            ...compliance(dense, s.spec),
            footprints: sized.footprints,
          });
          if (dense.score === null) reject(s, "DENSE_COVERAGE_FAILURE");
        }
        s.counts.dense++;
        s.jobIndex++;
        s.timings.dense += performance.now() - t;
      }
    }
    s.elapsedMs += performance.now() - start;
    return s;
  }
  function restore(raw) {
    if (raw.version !== VERSION)
      throw Error("Synthesis checkpoint version mismatch");
    const spec = Spec.specification(raw.spec);
    if (raw.configurationHash !== hash([spec, raw.operands, raw.allocation]))
      throw Error("Synthesis configuration changed");
    if (!["SEEDS", "GLOBAL", "LOCAL", "DENSE", "FINISHED"].includes(raw.stage))
      throw Error("Invalid synthesis stage");
    for (const k of ["seedIndex", "jobIndex"])
      if (!Number.isSafeInteger(raw[k]) || raw[k] < 0)
        throw Error("Invalid checkpoint counter");
    for (const [k, v] of Object.entries(raw.counts))
      if (!Number.isSafeInteger(v) || v < 0)
        throw Error("Invalid evaluation counter " + k);
    if (
      raw.seedIndex > raw.allocation.seeds ||
      raw.archive.length > spec.archiveSize ||
      raw.seeds.length > spec.parentsPerTopology * raw.selected.length
    )
      throw Error("Checkpoint exceeds configured bounds");
    const expected = create(spec, raw.operands, raw.software);
    if (
      hash(raw.selected) !== hash(expected.selected) ||
      hash(raw.allocation) !== hash(expected.allocation)
    )
      throw Error("Topology/budget configuration changed");
    const s = clone(raw);
    if (s.current) s.current = E.restore(s.current);
    if (s.local) s.local = L.resume(s.local);
    if (s.current) {
      const vectors = [
        ...s.current.population,
        ...s.current.archive.map((a) => a.vector),
      ];
      const scores = [
        ...s.current.scores,
        ...s.current.archive.map((a) => a.score),
      ];
      vectors.forEach((v, i) => {
        const r = E.evaluate(s.current, v);
        if (
          r.score === null
            ? scores[i] !== null
            : !Number.isFinite(scores[i]) ||
              Math.abs(r.score - scores[i]) >
                1e-8 * Math.max(1, Math.abs(r.score))
        )
          throw Error("Checkpoint numerical rankings changed");
      });
    }
    for (const item of s.archive) {
      const r = M.evaluate(item.system, analysisSpec(spec), s.operands);
      if (
        !r.merit.valid ||
        Math.abs(r.merit.total - item.score) >
          1e-8 * Math.max(1, Math.abs(item.score))
      )
        throw Error("Checkpoint elite merit changed");
    }
    for (let i = 0; i < s.results.length; i++) {
      const item = s.results[i];
      if (!item.dense) continue;
      const e = makeJob(
        s,
        { ...item, system: item.dense.prescription || item.system },
        4,
      );
      const dense = E.evaluate(
        e,
        e.variables.map((v) => v.value),
        true,
      );
      s.results[i] = { ...item, dense, ...compliance(dense, spec) };
    }
    return s;
  }
  const api = {
    VERSION,
    create,
    step,
    restore,
    analysisSpec,
    operands,
    compliance,
    hash,
    makeJob,
  };
  root.LBSynthesis = api;
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);
