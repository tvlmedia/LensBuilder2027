const fs = require("node:fs"), path = require("node:path"), cp = require("node:child_process"),
  Glass = require("../synthesis/glass"), baseline = require("../docs/refinement-benchmark.json");
async function main() {
  const output = { timestamp: new Date().toISOString(),
    sourceCommit: cp.execFileSync("git", ["rev-parse", "HEAD"], {encoding:"utf8"}).trim(),
    workingTree: true, perTrialBudget: 200, experiments: [] };
  for (const e of baseline.experiments) {
    const parent = e.methods.find(m => m.algorithm === "bounded-pattern-extrapolation-v1");
    const experiment = {name:e.name, specification:e.specification, operands:e.operands, methods:[]};
    for (const includeFamilies of [false,true]) {
      const result = await Glass.optimize({system:parent.prescription, ordinal:1,
        topology:parent.prescription.synthesis.topology, status:parent.status},
        e.specification, e.operands, {includeFamilies,perTrialBudget:200});
      experiment.methods.push({includeFamilies, ...result.glassSearch,
        prescription:result.system, checks:result.checks,
        fields:result.dense?.analysis.apertures[0].analysis.fields.map(f=>({field:f.field,rmsMm:f.rmsMm}))});
      console.error(e.name, includeFamilies, result.glassSearch.initialDenseScore,
        result.glassSearch.finalDenseScore, result.glassSearch.evaluations);
    }
    output.experiments.push(experiment);
    fs.writeFileSync(path.join(__dirname,"../docs/glass-family-benchmark.json"),JSON.stringify(output,null,2)+"\n");
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
