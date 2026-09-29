/* Paired, equal-budget refinement of the archived 0.5.1 dense winners. */
const fs = require("node:fs"), path = require("node:path"), cp = require("node:child_process"),
  R = require("../synthesis/refine"),
  baseline = require("../docs/glass-exploration-benchmark.json");
async function main() {
  const output = { timestamp: new Date().toISOString(),
    sourceCommit: cp.execFileSync("git", ["rev-parse", "HEAD"], {encoding:"utf8"}).trim(),
    workingTree: true, perMethodBudget: 3000, experiments: [] };
  for (const e of baseline.experiments) {
    const b = e.results.filter(a=>a.status === "DENSE VALIDATED")
      .sort((a,b)=>a.denseScore-b.denseScore)[0];
    const experiment = { name:e.name, specification:e.specification, operands:e.operands,
      baselineDenseScore:b.denseScore, methods:[] };
    for (const patternAcceleration of [false,true]) {
      const t = performance.now();
      const result = await R.optimize({ system:b.prescription, topology:b.topology,
        ordinal:b.ordinal, status:b.status }, e.specification, e.operands,
        {maxEvaluations:3000, patternAcceleration});
      experiment.methods.push({ ...result.geometryRefinement,
        elapsedMs:performance.now()-t, status:result.status,
        prescription:result.system,
        checks:result.checks,
        apertures:result.dense?.analysis.apertures.map(ap=>({ fNumber:ap.config.fNumber,
          fields:ap.analysis.fields.map(f=>({field:f.field,rmsMm:f.rmsMm,
            rayFraction:f.rayFraction,distortionPercent:f.distortionPercent})) })) });
      console.error(e.name, result.geometryRefinement);
    }
    output.experiments.push(experiment);
    fs.writeFileSync(path.join(__dirname,"../docs/refinement-benchmark.json"),JSON.stringify(output,null,2)+"\n");
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
