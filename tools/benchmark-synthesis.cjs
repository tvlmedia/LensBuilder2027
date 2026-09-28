/* Reproducible empty-specification synthesis and funnel timings. */
const fs = require("node:fs"),
  path = require("node:path"),
  cp = require("node:child_process");
const S = require("../synthesis/engine"),
  P = require("../synthesis/physics"),
  O = require("../optics/core"),
  E = require("../optimization/explorer"),
  Pool = require("../optimization/pool"),
  adapter = require("./worker-adapter.cjs");
function compact(s) {
  return {
    name: s.spec.name,
    specification: s.spec,
    operands: s.operands,
    software: s.software,
    allocation: s.allocation,
    counts: s.counts,
    rejections: s.rejections,
    stageRejections: s.stageRejections,
    elapsedMs: s.elapsedMs,
    timings: s.timings,
    rates: {
      generatedAndParaxiallyFilteredPerSecond:
        (s.counts.seeds * 1000) / s.timings.seeds,
      coarseBundlesPerSecond: (s.counts.coarse * 1000) / s.timings.coarse,
      globalEvaluationsPerSecond: (s.counts.global * 1000) / s.timings.global,
      localEvaluationsPerSecond: (s.counts.local * 1000) / s.timings.local,
      denseMsPerCandidate: s.timings.dense / s.counts.dense,
    },
    results: s.results.map((a) => ({
      topology: a.topology,
      ordinal: a.ordinal,
      status: a.status,
      initialScore: a.initialScore,
      searchScore: a.score,
      denseScore: a.dense?.score,
      checks: a.checks,
      failure: a.failure,
      prescription: a.dense?.prescription || a.system,
      validation: a.dense?.validation,
      firstOrder: a.dense?.analysis?.firstOrder,
      apertures: a.dense?.analysis?.apertures?.map((ap) => ({
        fNumber: ap.config.fNumber,
        firstOrder: ap.analysis.firstOrder,
        longitudinalColorMm: ap.analysis.longitudinalColorMm,
        fields: ap.analysis.fields.map(
          ({
            field,
            rmsMm,
            tangentialRmsMm,
            sagittalRmsMm,
            distortionPercent,
            lateralChiefColorMm,
            rayFraction,
          }) => ({
            field,
            rmsMm,
            tangentialRmsMm,
            sagittalRmsMm,
            distortionPercent,
            lateralChiefColorMm,
            rayFraction,
          }),
        ),
      })),
    })),
  };
}
async function run() {
  const targets = [
    {
      name: "COOKE_VALIDATION",
      topology: "cooke",
      targetFNumber: 4,
      imageCircleMm: 30,
      budget: 10000,
    },
    {
      name: "DOUBLE_GAUSS_VALIDATION",
      topology: "double-gauss",
      targetFNumber: 2.8,
      imageCircleMm: 36,
      budget: 10000,
    },
  ];
  if (process.argv.includes("--omit"))
    targets.push({
      name: "OMIT50_TECHNICAL_FOUNDATION",
      topology: "auto",
      targetFNumber: 2,
      imageCircleMm: 46.3,
      apertures: [2, 2.8, 4, 5.6],
      mount: "PL-oriented development envelope; not certified",
      flangeFocalDistanceMm: 52,
      minBflMm: 25,
      budget: 100000,
    });
  const output = {
    timestamp: new Date().toISOString(),
    node: process.version,
    sourceCommit: cp
      .execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" })
      .trim(),
    experiments: [],
    scaling: [],
  };
  for (const target of targets) {
    const s = S.create(
      {
        ...target,
        workers: 4,
        archiveSize: target.topology === "auto" ? 8 : 6,
      },
      undefined,
      { sourceCommit: output.sourceCommit, workingTree: true },
    );
    const pool = new Pool(4, adapter);
    let last = 0;
    try {
      while (!s.done) {
        await S.step(s, pool);
        if (Date.now() - last > 15000) {
          console.error(target.name, s.stage, JSON.stringify(s.counts));
          last = Date.now();
        }
      }
    } finally {
      pool.close();
    }
    output.experiments.push(compact(s));
    fs.writeFileSync(
      path.resolve(__dirname, "../docs/synthesis-benchmark.json"),
      JSON.stringify(output, null, 2) + "\n",
    );
    const best = s.results
      .filter((a) => a.status === "DENSE VALIDATED")
      .sort((a, b) => a.dense.score - b.dense.score)[0];
    console.error(
      target.name,
      "validated",
      s.results.filter((a) => a.status === "DENSE VALIDATED").length,
      "best",
      best?.dense.score,
    );
    if (best && target.topology === "cooke") {
      const c = O.compile(best.system),
        n = 100000,
        t = performance.now();
      for (let i = 0; i < n; i++) O.paraxial(c);
      output.paraxialMatrixEvaluationsPerSecond =
        (n * 1000) / (performance.now() - t);
      const e = S.makeJob(s, { ...best, system: best.system }, 64),
        v = e.variables.map((v) => v.value),
        vectors = Array.from({ length: 128 }, () => v);
      for (const workers of [1, 4]) {
        const p = new Pool(workers, adapter);
        try {
          await p.init(e);
          await p.evaluate(vectors.slice(0, 4));
          const t = performance.now(),
            r = await p.evaluate(vectors),
            ms = performance.now() - t;
          output.scaling.push({
            workers,
            evaluations: r.length,
            valid: r.filter((r) => r.score !== null).length,
            elapsedMs: ms,
            evaluationsPerSecond: (r.length * 1000) / ms,
          });
        } finally {
          p.close();
        }
      }
    }
  }
  fs.writeFileSync(
    path.resolve(__dirname, "../docs/synthesis-benchmark.json"),
    JSON.stringify(output, null, 2) + "\n",
  );
  console.log(
    JSON.stringify(
      output.experiments.map((e) => ({
        name: e.name,
        counts: e.counts,
        rates: e.rates,
        results: e.results.map((a) => ({
          topology: a.topology,
          status: a.status,
          initialScore: a.initialScore,
          denseScore: a.denseScore,
        })),
      })),
      null,
      2,
    ),
  );
}
if (require.main === module)
  run().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
module.exports = { compact };
