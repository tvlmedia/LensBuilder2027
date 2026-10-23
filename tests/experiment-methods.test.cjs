const {test}=require('node:test'),a=require('node:assert/strict'),X=require('../optimization/experiment'),S=require('../synthesis/engine'),Pool=require('../optimization/pool'),adapter=require('../tools/worker-adapter.cjs');
const f=require('../benchmarks/optical-suite-v1.json').cases.find(f=>f.id==='poor-focus'),spec=S.analysisSpec(f.specification),vars=[{surface:f.system.surfaces.length-2,key:'t',min:f.system.surfaces.at(-2).t-4,max:f.system.surfaces.at(-2).t+4}];
test('hybrid, multistart, block and continuation obey budgets and final original dense objective',async()=>{
 for(const method of ['hybrid','multistart','block-dls','continuation']){
  const r=await X.optimize(f.system,spec,vars,f.operands,{method,budget:100,seed:42});a.ok(r.evaluations<=100);a.ok(r.finalScore<=r.before.score);a.equal(r.validationEvaluations,4);a.ok(r.result.analysis.valid);a.deepEqual(r.result.analysis.apertures.map(x=>x.config.fNumber),spec.apertures.filter(x=>x.validation || x.optimization).map(x=>x.fNumber));if(r.accepted)a.ok(r.intermediate.after<r.intermediate.before);
  const again=await X.search(f.system,spec,vars,f.operands,{method,budget:100,seed:42});a.equal(again.searchScore,r.searchScore);a.deepEqual(again.candidate,r.candidate);
 }
});
test('DE experiment produces identical ordered results with 1, 2 and 4 actual workers',async()=>{
 let original;
 for(const workers of [1,2,4]){const pool=new Pool(workers,adapter);try{const r=await X.search(f.system,spec,vars,f.operands,{method:'hybrid',budget:80,seed:17,pool});if(original){a.deepEqual(r.candidate,original.candidate);a.equal(r.searchScore,original.searchScore);a.deepEqual(r.history,original.history);}else original=r;}finally{pool.close();}}
});
test('a multistart iris landing on an exact physical bound survives floating-point rebasing',async()=>{
 const fixture=require('../benchmarks/optical-suite-v1.json').cases.find(f=>f.id==='cooke'),G=require('../synthesis/seeds');
 const r=await X.optimize(fixture.system,S.analysisSpec(fixture.specification),G.variables(fixture.system,fixture.specification),fixture.operands,{method:'multistart',budget:1000,seed:1003});a.ok(Number.isFinite(r.finalScore));a.ok(r.finalScore<=r.before.score);
});
test('accepted experiment exports the physically prepared iris, not the unprepared optimizer proposal',async()=>{
 const fixture=require('../benchmarks/optical-suite-v1.json').cases.find(f=>f.id==='cooke'),G=require('../synthesis/seeds'),O=require('../optics/core');
 const r=await X.optimize(fixture.system,S.analysisSpec(fixture.specification),G.variables(fixture.system,fixture.specification),fixture.operands,{method:'block-dls',budget:160,seed:1001});a.ok(r.accepted);a.deepEqual(r.system,r.after.prescription);a.ok(Math.abs(O.paraxial(O.compile(r.system)).fNumber-fixture.specification.targetFNumber)<1e-8);
});
