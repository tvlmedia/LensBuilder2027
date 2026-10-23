/* Recheck serialized prescriptions and denser sampling without changing search
   results, budgets, frozen inputs or archived merit definitions. */
const fs=require('node:fs'),crypto=require('node:crypto'),X=require('../optimization/experiment'),P=require('../synthesis/physics'),S=require('../synthesis/engine'),G=require('../synthesis/seeds'),Alt=require('../synthesis/alternation');
const suite=require('../benchmarks/optical-suite-v1.json'),helpers=require('./benchmark-optical-methods.cjs');
async function main(){
 const convergence=[];
 for(const file of ['benchmarks/omit50-methods-v1.json','benchmarks/optimization-methods-v1.json']){
  const report=JSON.parse(fs.readFileSync(file));let verified=0;
  for(const e of report.experiments){
   const fixture=suite.cases.find(f=>f.id===e.id);
   for(const r of e.runs){
    if(e.specification.synthesis){const prepared=P.prepare(r.prescription,e.specification.synthesis);if(!prepared.ok)throw Error(`${e.id} ${r.method} invalid serialized geometry`);r.prescription=prepared.system;}
    const vars=e.specification.synthesis?G.variables(r.prescription,e.specification.synthesis):helpers.variables(fixture);
    const measured=X.dense(r.prescription,e.specification,vars,e.operands);
    if(measured.score===null||Math.abs(measured.score-r.final)>1e-7)throw Error(`Serialized merit mismatch ${e.id} ${r.method}: ${measured.score} vs ${r.final}`);
    verified++;
   }
   const winner=e.runs.reduce((a,b)=>a.final<b.final?a:b),entry={id:e.id,method:winner.method,seed:winner.seed,checks:[]};
   for(const grid of [19,25,31,41]){
    const baseline=X.dense(fixture.system,e.specification,helpers.variables(fixture),e.operands,grid),vars=e.specification.synthesis?G.variables(winner.prescription,e.specification.synthesis):helpers.variables(fixture),after=X.dense(winner.prescription,e.specification,vars,e.operands,grid);
    entry.checks.push({grid,before:baseline.score,after:after.score,improved:baseline.score!==null&&after.score!==null&&after.score<baseline.score});
   }
   convergence.push(entry);
  }
  report.serializationVerification={note:'Persisted the physically prepared iris used by evaluation, rather than the raw proposal iris. Every exported prescription was freshly dense-remeasured; numerical search results and budgets are unchanged.',verifiedPrescriptions:verified,finalizerSHA256:crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),timestamp:new Date().toISOString()};
  fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');
 }
 fs.writeFileSync('benchmarks/sampling-convergence-v1.json',JSON.stringify({schemaVersion:1,description:'Post-search checks at unchanged merit and full physical specification; comparison of regular benchmark final grid with denser sunflower grids.',cases:convergence},null,2)+'\n');
 const omit=require('../benchmarks/omit50-methods-v1.json').experiments[0],winner=omit.runs.reduce((a,b)=>a.final<b.final?a:b),fixture=suite.cases.find(f=>f.id==='omit50');
 const start=performance.now(),result=await Alt.optimize({system:winner.prescription,ordinal:0},fixture.specification,fixture.operands,{rounds:2,geometryBudget:500,perTrialBudget:100,method:'block-dls'});
 fs.writeFileSync('benchmarks/omit50-alternation-v1.json',JSON.stringify({schemaVersion:1,startingMethod:winner.method,startingSeed:winner.seed,startingDenseScore:winner.final,additionalBudgets:{rounds:2,geometryPerRound:500,perGlassTrial:100},elapsedMs:performance.now()-start,prescription:result.dense?.prescription||result.system,finalDenseScore:result.dense?.score??winner.final,...result.alternation},null,2)+'\n');
 console.log(JSON.stringify(convergence,null,2));console.log('Alternation',winner.final,result.dense?.score);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
