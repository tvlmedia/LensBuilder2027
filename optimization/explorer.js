(function (root) {
  "use strict";
  const S = root.LBSearch || require("./search.js");
  const M = root.LBMerit || require("../design/merit.js");
  const A = root.LBAnalysis || require("../analysis/evaluate.js");
  const O = root.LBOptics || require("../optics/core.js");
  const VERSION = "numerical-lab-1";
  const clean = (x) => JSON.parse(JSON.stringify(x));
  function parameters(input, definitions) {
    const vars = definitions
      .filter((v) => v.enabled !== false)
      .map((v) => ({
        ...v,
        id: v.id || `${v.surface}:${v.key}`,
        scale: v.scale ?? v.max - v.min,
        value:
          v.key === "stopPosition" ? 0 : input.surfaces[v.surface]?.[v.key],
        enabled: true,
      }));
    S.validateVariables(input, vars);
    if (vars.some((v) => !Number.isFinite(v.scale) || v.scale <= 0))
      throw Error("Invalid parameter scale");
    return vars;
  }
  function prescription(state, vector) {
    if (
      vector.length !== state.variables.length ||
      vector.some(
        (x, i) =>
          !Number.isFinite(x) ||
          x < state.variables[i].min ||
          x > state.variables[i].max,
      )
    )
      throw Error("Vector outside bounds");
    // Clone only surfaces. Immutable material metadata is shared within one evaluation worker.
    const out = {
      ...state.input,
      surfaces: state.input.surfaces.map((s) => ({ ...s })),
    };
    delete out.project;
    state.variables.forEach((v, i) => {
      if (v.key === "stopPosition") {
        out.surfaces[v.surface - 1].t += vector[i];
        out.surfaces[v.surface].t -= vector[i];
      } else out.surfaces[v.surface][v.key] = vector[i];
    });
    return out;
  }
  function random(s) {
    s.rng = (s.rng + 0x6d2b79f5) >>> 0;
    let t = s.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function distance(a, b, vars) {
    return Math.sqrt(
      a.reduce(
        (sum, x, i) => sum + ((x - b[i]) / (vars[i].max - vars[i].min)) ** 2,
        0,
      ) / a.length,
    );
  }
  function create(input, spec, definitions, operands, options = {}) {
    if (input.zoom?.configs?.length || input.zoom?.configurations?.length)
      throw Error(
        "Select a single prescription; multi-configuration search is unavailable",
      );
    const variables = parameters(input, definitions);
    A.settings(spec);
    M.validateOperands(operands);
    const config = {
      strategy: "de",
      seed: 1001,
      population: 32,
      generations: 1000000,
      budget: 100000,
      mutation: 0.7,
      crossover: 0.9,
      runs: 1,
      archiveSize: 12,
      diversity: 0.025,
      seconds: 0,
      targetMerit: null,
      stagnation: 0,
      coarse: false,
      ...options,
    };
    for (const k of [
      "budget",
      "population",
      "generations",
      "runs",
      "archiveSize",
    ])
      if (!Number.isSafeInteger(config[k]) || config[k] < 1)
        throw Error(`Invalid ${k}`);
    if (
      config.population < 4 ||
      config.population > 4096 ||
      config.archiveSize > 100 ||
      config.runs > 10000
    )
      throw Error("Population 4–4096, archive 1–100, runs 1–10000");
    if (
      !["de", "uniform", "sensitivity"].includes(config.strategy) ||
      !Number.isSafeInteger(config.seed)
    )
      throw Error("Invalid strategy/seed");
    if (
      !(
        config.mutation > 0 &&
        config.mutation <= 2 &&
        config.crossover >= 0 &&
        config.crossover <= 1 &&
        config.diversity >= 0 &&
        config.diversity <= 1
      ) ||
      ![config.mutation, config.crossover, config.diversity].every(
        Number.isFinite,
      )
    )
      throw Error("Invalid DE/diversity settings");
    for (const k of ["seconds", "stagnation"])
      if (!Number.isFinite(config[k]) || config[k] < 0)
        throw Error(`Invalid ${k}`);
    if (config.targetMerit !== null && !Number.isFinite(config.targetMerit))
      throw Error("Invalid target merit");
    delete config.id;
    delete config.software;
    const base = clean(input);
    delete base.project;
    return {
      version: VERSION,
      id: options.id || `experiment-${Date.now()}`,
      createdAt: new Date().toISOString(),
      software: options.software || { engine: VERSION },
      input: base,
      spec: clean(spec),
      variables,
      operands: clean(operands),
      config,
      rng: config.seed >>> 0,
      evaluations: 0,
      valid: 0,
      rejections: {},
      rays: 0,
      elapsedMs: 0,
      generation: 0,
      run: 0,
      runEvaluations: 0,
      population: [],
      scores: [],
      archive: [],
      history: [],
      sensitivity: [],
      pending: null,
      lastImprovement: 0,
      done: false,
      reason: null,
    };
  }
  function uniform(s) {
    return s.variables.map((v) => v.min + random(s) * (v.max - v.min));
  }
  function next(s) {
    if (s.pending) return s.pending;
    if (s.done) return [];
    const remaining = s.config.budget - s.evaluations;
    if (remaining <= 0) {
      s.done = true;
      s.reason = "evaluation budget";
      return [];
    }
    let vectors = [];
    if (s.config.strategy === "sensitivity") {
      const base = s.variables.map((v) => v.value);
      const all = [base];
      s.variables.forEach((v, i) => {
        for (const sign of [-1, 1]) {
          const x = base.slice();
          x[i] = Math.max(
            v.min,
            Math.min(v.max, x[i] + sign * 0.01 * (v.max - v.min)),
          );
          all.push(x);
        }
      });
      vectors = all.slice(
        s.evaluations,
        s.evaluations + Math.min(32, remaining),
      );
      if (!vectors.length) {
        s.done = true;
        s.reason = "sensitivity complete";
        return [];
      }
    } else if (!s.population.length) {
      vectors = Array.from(
        { length: Math.min(s.config.population, remaining) },
        (_, i) =>
          i === 0 && s.run === 0 ? s.variables.map((v) => v.value) : uniform(s),
      );
    } else if (s.config.strategy === "uniform") {
      vectors = Array.from(
        { length: Math.min(s.config.population, remaining) },
        () => uniform(s),
      );
    } else {
      const n = s.population.length;
      if (n < 4) {
        s.done = true;
        s.reason = "insufficient remaining population";
        return [];
      }
      vectors = s.population.slice(0, remaining).map((target, i) => {
        const ids = [];
        while (ids.length < 3) {
          const j = Math.floor(random(s) * n);
          if (j !== i && !ids.includes(j)) ids.push(j);
        }
        const forced = Math.floor(random(s) * target.length);
        return target.map((x, j) => {
          if (j !== forced && random(s) > s.config.crossover) return x;
          const v = s.variables[j],
            trial =
              s.population[ids[0]][j] +
              s.config.mutation *
                (s.population[ids[1]][j] - s.population[ids[2]][j]);
          // Reflection keeps boundary proposals in range without piling them onto endpoints.
          const w = v.max - v.min,
            phase = (((trial - v.min) % (2 * w)) + 2 * w) % (2 * w);
          return Math.max(
            v.min,
            Math.min(v.max, v.min + (phase <= w ? phase : 2 * w - phase)),
          );
        });
      });
    }
    s.pending = vectors;
    return vectors;
  }
  function archive(s, item) {
    if (!Number.isFinite(item.score)) return;
    const near = s.archive.findIndex(
      (a) =>
        distance(a.vector, item.vector, s.variables) < s.config.diversity ||
        distance(a.vector, item.vector, s.variables) === 0,
    );
    if (near >= 0) {
      if (s.archive[near].score <= item.score) return;
      s.archive.splice(near, 1);
    }
    s.archive.push(item);
    s.archive.sort((a, b) => a.score - b.score);
    s.archive.length = Math.min(s.archive.length, s.config.archiveSize);
  }
  function accept(s, results) {
    if (!s.pending || results.length !== s.pending.length)
      throw Error("Incomplete evaluation batch");
    const initial = !s.population.length,
      previous = s.archive[0]?.score ?? Infinity;
    results.forEach((r, i) => {
      const vector = s.pending[i],
        score = Number.isFinite(r.score) ? r.score : null;
      s.evaluations++;
      s.runEvaluations++;
      s.rays += r.rays || 0;
      if (score !== null) {
        s.valid++;
        archive(s, {
          vector: vector.slice(),
          score,
          metrics: r.metrics,
          breakdown: r.breakdown,
          evaluation: s.evaluations,
          generation: s.generation,
          run: s.run,
        });
      } else {
        const reason = r.reason || "numerical";
        s.rejections[reason] = (s.rejections[reason] || 0) + 1;
      }
      if (s.config.strategy === "sensitivity")
        s.sensitivity.push({
          vector,
          score,
          metrics: r.metrics,
          reason: r.reason,
        });
      if (
        initial ||
        s.config.strategy !== "de" ||
        (score !== null && (s.scores[i] === null || score <= s.scores[i]))
      ) {
        s.population[i] = vector;
        s.scores[i] = score;
      }
    });
    s.pending = null;
    if (!initial) s.generation++;
    if ((s.archive[0]?.score ?? Infinity) < previous)
      s.lastImprovement = s.evaluations;
    s.history.push({
      evaluations: s.evaluations,
      score: s.archive[0]?.score ?? null,
    });
    if (s.history.length > 2048)
      s.history = s.history.filter(
        (_, i) => i % 2 === 0 || i === s.history.length - 1,
      );
    const perRun = Math.ceil(s.config.budget / s.config.runs);
    if (
      s.config.strategy !== "sensitivity" &&
      (s.runEvaluations >= perRun || s.generation >= s.config.generations)
    ) {
      if (s.run + 1 < s.config.runs && s.evaluations < s.config.budget) {
        s.run++;
        s.rng = (s.config.seed + s.run) >>> 0;
        s.population = [];
        s.scores = [];
        s.generation = 0;
        s.runEvaluations = 0;
      } else if (s.generation >= s.config.generations) {
        s.done = true;
        s.reason = "generation limit";
      }
    }
    if (s.evaluations >= s.config.budget) {
      s.done = true;
      s.reason = "evaluation budget";
    } else if (
      s.config.targetMerit !== null &&
      s.archive[0]?.score <= s.config.targetMerit
    ) {
      s.done = true;
      s.reason = "search target merit (not dense validation)";
    } else if (
      s.config.stagnation &&
      s.evaluations - s.lastImprovement >= s.config.stagnation
    ) {
      s.done = true;
      s.reason = "no improvement";
    } else if (s.config.seconds && s.elapsedMs >= s.config.seconds * 1000) {
      s.done = true;
      s.reason = "time limit";
    }
    return s;
  }
  function metrics(a) {
    if (!a.firstOrder) return null;
    return {
      efl: a.firstOrder.eflMm,
      bfl: a.firstOrder.bflMm,
      fNumber: a.firstOrder.fNumber,
      longitudinalColor: a.longitudinalColorMm,
      fields: a.fields.map((f) => ({
        field: f.field,
        rms: f.rmsMm,
        distortion: f.distortionPercent,
        lateralColor: f.lateralChiefColorMm,
        survival: f.rayFraction,
      })),
    };
  }
  function evaluate(s, vector, dense = false) {
    const system = prescription(s, vector);
    let rays = 0;
    // Optional coarse gate only rejects physical/ray failures; it never ranks against standard merit.
    if (s.config.coarse && !dense) {
      const coarse = A.evaluate(system, {
        ...s.spec,
        fields: [0, 1],
        wavelengths: [A.DEFAULT_WAVES[1]],
        pupilGrid: 5,
      });
      rays += coarse.rows.reduce((n, r) => n + r.launched, 0);
      if (!coarse.valid) return { score: null, reason: "coarse gate", rays };
    }
    const spec = dense
      ? {
          ...s.spec,
          pupilGrid: Math.max(
            19,
            Math.min(41, 2 * (s.spec.pupilGrid || 9) + 1),
          ),
          pupilPattern: "sunflower",
          fields: A.DEFAULT_FIELDS,
          wavelengths: A.DEFAULT_WAVES,
        }
      : s.spec;
    const result = M.evaluate(system, spec, s.operands),
      a = result.analysis;
    rays += a.rows.reduce((n, r) => n + r.launched, 0);
    const errors = a.errors.join("; ");
    const reason = /BFL/.test(errors)
      ? "BFL"
      : /rays|chief/.test(errors)
        ? "ray survival or chief failure"
        : /Numerical/.test(errors)
          ? "numerical"
          : "geometry or material";
    const out = {
      score: result.merit.valid ? result.merit.total : null,
      reason: result.merit.valid ? null : reason,
      rays,
      metrics: metrics(a),
      breakdown: result.merit.breakdown,
    };
    if (dense && a.valid) {
      const c = O.compile(system),
        p = O.paraxial(c),
        traces = [];
      for (const f of [0, 1]) {
        const chief = O.aimChief(
          c,
          Math.atan((f * s.spec.imageCircleMm) / 2 / s.spec.targetEflMm),
        );
        if (chief)
          for (const q of [-0.8, -0.4, 0, 0.4, 0.8]) {
            const ray = {
              p: { ...chief.p, y: chief.p.y + q * p.entrancePupilRadiusMm },
              d: chief.d,
            };
            const tr = O.trace(c, ray, { record: true });
            if (tr.ok)
              traces.push({ field: f, points: [ray.p, ...tr.points, tr.hit] });
          }
      }
      out.layout = {
        surfaces: c.surfaces.map((surface) => ({
          x: surface.vx,
          R: surface.R,
          ap: surface.ap,
          glass: surface.glass,
        })),
        imageX: c.imageX,
        traces,
      };
    }
    if (dense) {
      out.analysis = a;
      out.prescription = system;
      out.validation = {
        pattern: "sunflower",
        grid: spec.pupilGrid,
        kind: "dense geometric resampling; no external reference certification",
      };
    }
    return out;
  }
  function restore(raw) {
    if (raw.version !== VERSION) throw Error("Checkpoint version mismatch");
    const fresh = create(
      raw.input,
      raw.spec,
      raw.variables,
      raw.operands,
      raw.config,
    );
    const s = clean(raw),
      vector = (v) => prescription(fresh, v);
    for (const k of [
      "evaluations",
      "valid",
      "rays",
      "generation",
      "run",
      "runEvaluations",
      "lastImprovement",
      "rng",
    ])
      if (!Number.isSafeInteger(s[k]) || s[k] < 0)
        throw Error(`Invalid checkpoint ${k}`);
    if (
      s.evaluations > s.config.budget ||
      s.valid > s.evaluations ||
      s.run >= s.config.runs ||
      !Number.isFinite(s.elapsedMs) ||
      s.elapsedMs < 0 ||
      typeof s.done !== "boolean"
    )
      throw Error("Invalid checkpoint counters");
    if (
      !Array.isArray(s.population) ||
      s.population.length > s.config.population ||
      s.scores.length !== s.population.length ||
      !Array.isArray(s.archive) ||
      s.archive.length > s.config.archiveSize ||
      !Array.isArray(s.history) ||
      s.history.length > 2048
    )
      throw Error("Invalid checkpoint arrays");
    s.population.forEach(vector);
    if (s.pending) {
      if (
        !Array.isArray(s.pending) ||
        s.pending.length > s.config.population + 129
      )
        throw Error("Invalid pending batch");
      s.pending.forEach(vector);
    }
    if (s.scores.some((x) => x !== null && !Number.isFinite(x)))
      throw Error("Invalid scores");
    s.archive.forEach((a) => {
      vector(a.vector);
      if (!Number.isFinite(a.score)) throw Error("Invalid archive score");
    });
    // Stored rankings must be rechecked by the runner before resuming untrusted imports.
    return s;
  }
  function sensitivity(s) {
    const base = s.sensitivity[0];
    if (!base) return [];
    const diff = (a, b, width) =>
      typeof a === "number" && typeof b === "number"
        ? (b - a) / width
        : Array.isArray(a) && Array.isArray(b)
          ? a.map((v, i) => diff(v, b[i], width))
          : a && b && typeof a === "object"
            ? Object.fromEntries(
                Object.keys(a).map((k) => [k, diff(a[k], b[k], width)]),
              )
            : null;
    const rows = s.variables.map((v, i) => {
      const minus = s.sensitivity[1 + 2 * i],
        plus = s.sensitivity[2 + 2 * i];
      const width = plus && minus ? plus.vector[i] - minus.vector[i] : 0;
      return {
        id: v.id,
        minus,
        plus,
        baseline: base,
        derivative:
          width && minus.score !== null && plus.score !== null
            ? (plus.score - minus.score) / width
            : null,
        metricDerivatives:
          width && minus.metrics && plus.metrics
            ? diff(minus.metrics, plus.metrics, width)
            : null,
        meritDelta:
          minus &&
          plus &&
          minus.score !== null &&
          plus.score !== null &&
          base.score !== null
            ? Math.max(
                Math.abs(minus.score - base.score),
                Math.abs(plus.score - base.score),
              )
            : null,
      };
    });
    const max = Math.max(0, ...rows.map((r) => r.meritDelta || 0));
    return rows.map((r) => ({
      ...r,
      relativeSensitivity:
        r.meritDelta === null
          ? "INVALID PERTURBATION"
          : max === 0
            ? "LOW"
            : r.meritDelta / max >= 0.5
              ? "HIGH"
              : r.meritDelta / max >= 0.1
                ? "MEDIUM"
                : "LOW",
    }));
  }
  const api = {
    VERSION,
    parameters,
    prescription,
    random,
    distance,
    create,
    next,
    accept,
    evaluate,
    restore,
    sensitivity,
    archive,
  };
  root.LBExplorer = api;
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);
