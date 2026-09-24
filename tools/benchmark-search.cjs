const E = require("../optimization/explorer.js"),
  M = require("../design/merit.js"),
  A = require("../analysis/evaluate.js"),
  O = require("../optics/core.js"),
  Materials = require("../materials/catalog.js");
const Pool = require("../optimization/pool.js"),
  adapter = require("./worker-adapter.cjs");
const lens = require("../bijna-goed.json"),
  spec = {
    targetEflMm: 58.01287,
    targetFNumber: 1.46143,
    imageCircleMm: 43.27,
    pupilGrid: 9,
  };
const state = E.create(
  lens,
  spec,
  [{ surface: 13, key: "t", min: 25, max: 45 }],
  M.defaultOperands(spec),
  { strategy: "uniform", budget: 512, population: 512 },
);
const vectors = E.next(state);
const records = {
  runtime: process.version,
  system: "Biotar 13 physical surfaces; six fields; F/d/C; grid9",
  seed: state.config.seed,
  count: vectors.length,
  scaling: [],
};
(async () => {
  for (const workers of [1, 2, 4]) {
    const pool = new Pool(workers, adapter);
    try {
      const init = performance.now();
      await pool.init(state);
      await pool.evaluate(vectors.slice(0, 32));
      const startupMs = performance.now() - init,
        t = performance.now(),
        results = await pool.evaluate(vectors),
        elapsedMs = performance.now() - t;
      records.scaling.push({
        workers,
        startupAndWarmupMs: startupMs,
        elapsedMs,
        evaluationsPerSecond: vectors.length / (elapsedMs / 1000),
        sampledRaysPerSecond:
          results.reduce((s, r) => s + r.rays, 0) / (elapsedMs / 1000),
        meanEvaluationWallMs: elapsedMs / vectors.length,
        valid: results.filter((r) => r.score !== null).length,
      });
    } finally {
      pool.close();
    }
  }
  // Instrumented inclusive timings, separately from throughput; nested categories overlap.
  const timings = {};
  const restore = [];
  for (const [api, keys] of [
    [O, ["validate", "compileValidated", "paraxial", "trace", "aimChief"]],
    [Materials, ["index"]],
    [E, ["prescription"]],
    [M, ["score"]],
  ])
    for (const key of keys) {
      const original = api[key];
      api[key] = function (...args) {
        const t = performance.now();
        try {
          return original(...args);
        } finally {
          const v = timings[key] || (timings[key] = { calls: 0, ms: 0 });
          v.calls++;
          v.ms += performance.now() - t;
        }
      };
      restore.push(() => (api[key] = original));
    }
  const start = performance.now();
  for (const v of vectors.slice(0, 64)) E.evaluate(state, v);
  records.instrumented = {
    totalMs: performance.now() - start,
    inclusiveTimings: timings,
    note: "Inclusive categories overlap; instrumentation adds overhead. trace includes surface intersections and Snell. Sampled ray counts exclude chief aiming rays. Allocation/GC and UI costs require browser/CPU profiling.",
  };
  restore.forEach((fn) => fn());
  console.log(JSON.stringify(records, null, 2));
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
