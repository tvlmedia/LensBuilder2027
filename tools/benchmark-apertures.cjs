const E = require("../optimization/explorer"),
  M = require("../design/merit"),
  Pool = require("../optimization/pool"),
  adapter = require("./worker-adapter.cjs");
const lens = require("../bijna-goed.json"),
  base = {
    targetEflMm: 58.01287,
    targetFNumber: 2,
    imageCircleMm: 44.712,
    pupilGrid: 9,
  };
(async () => {
  const records = {
    date: new Date().toISOString(),
    node: process.version,
    system: "Bundled Biotar, same fixed image plane, six fields F/d/C",
    cases: [],
  };
  for (const apertures of [null, [2], [2, 2.8], [2, 2.8, 4, 5.6]])
    for (const dense of [false, true])
      for (const workers of [1, 4]) {
        const spec = { ...base, ...(apertures ? { apertures } : {}) },
          s = E.create(
            lens,
            spec,
            [{ surface: 13, key: "t", min: 34, max: 44 }],
            M.defaultOperands(spec),
            { population: 32, budget: 32, strategy: "uniform" },
          ),
          vectors = E.next(s),
          p = new Pool(workers, adapter);
        try {
          await p.init(s);
          await p.evaluate(vectors.slice(0, 4), dense);
          const t = performance.now(),
            r = await p.evaluate(vectors, dense),
            ms = performance.now() - t;
          records.cases.push({
            apertures: apertures || "existing physical stop",
            dense,
            workers,
            count: r.length,
            valid: r.filter((x) => x.score !== null).length,
            evaluationsPerSecond: r.length / (ms / 1000),
            meanWallMs: ms / r.length,
          });
        } finally {
          p.close();
        }
      }
  console.log(JSON.stringify(records, null, 2));
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
