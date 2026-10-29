/* Physical aperture/field continuation, reusing the existing numerical engines. */
(function(root){
 'use strict';
 const X=root.LBOpticalExperiment||require('./experiment.js'),S=root.LBSynthesis||require('../synthesis/engine.js'),P=root.LBSynthesisPhysics||require('../synthesis/physics.js'),G=root.LBSynthesisSeeds||require('../synthesis/seeds.js'),M=root.LBMerit||require('../design/merit.js');
 function schedule(spec,operands){
  return [[2,.5],[1.4,.7],[1.2,.85],[1,1]].map(([factor,field],i)=>{
   if(i===3)return {spec:structuredClone(spec),operands:structuredClone(operands),final:true};
   const aperture=spec.targetFNumber*factor,stage={...structuredClone(spec),targetFNumber:aperture,imageCircleMm:spec.imageCircleMm*field,apertures:[{fNumber:aperture,optimization:true,validation:true,weight:1}]};
   const ops=operands.filter(o=>o.aperture===undefined||o.aperture===spec.targetFNumber).map(o=>({...o,aperture,...(o.metric==='fNumber'?{target:aperture}:{})}));
   if(!ops.length)throw Error('Continuation needs primary-aperture operands');
   return {spec:stage,operands:ops,final:false};
  });
 }
 async function optimize(input,spec,variables,operands,options={}){
  const budget=options.budget??1000;if(!Number.isSafeInteger(budget)||budget<16||budget>100000)throw Error('Continuation budget must be 16–100000');
  const design=spec.synthesis;if(!design)throw Error('Continuation requires explicit synthesis constraints');
  options.onStage?.('validation');const before=X.dense(input,spec,variables,operands);
  if(before.score===null)throw Error('Continuation requires a dense-valid parent');
  let current=input,used=0;const stages=[],history=[],rejections={};
  options.onStage?.('search');
  for(const [i,stage]of schedule(design,operands).entries()){
   const allocated=Math.floor((budget-used)/(4-i)),prepared=P.prepare(current,stage.spec);
   if(!prepared.ok){stages.push({index:i,allocated,evaluations:0,rejected:prepared.code,retainedPath:true});continue;}
   const run=await X.search(prepared.system,S.analysisSpec(stage.spec),G.variables(prepared.system,stage.spec),stage.operands,{method:'pattern',budget:allocated,seed:((options.seed??design.seed)+i)>>>0,yield:options.yield});
   history.push(...run.history.map(h=>({...h,evaluations:h.evaluations+used,phase:'physical-continuation-'+i,comparableToFinal:i===3})));used+=run.evaluations;current=run.candidate;
   stages.push({index:i,aperture:stage.spec.targetFNumber,imageCircleMm:stage.spec.imageCircleMm,allocated,evaluations:run.evaluations,searchScore:run.searchScore});
   for(const[k,v]of Object.entries(run.rejections))rejections[k]=(rejections[k]||0)+v;
  }
  options.onStage?.('validation');
  // Reopen the physical iris and validate the ORIGINAL fields, apertures and glass limits.
  const reopened=P.prepare(current,design),candidate=reopened.ok?reopened.system:current,
    after=X.dense(candidate,spec,G.variables(candidate,design),operands),
    intermediateSpec={...spec,pupilGrid:Math.min(15,spec.validationGrid||19),pupilPattern:'grid'},
    middleBefore=M.evaluate(input,intermediateSpec,operands).merit,middleAfter=M.evaluate(candidate,intermediateSpec,operands).merit,
    feasible=S.compliance(after,design).status==='DENSE VALIDATED',
    accepted=feasible&&after.score<before.score-1e-10&&middleBefore.valid&&middleAfter.valid&&middleAfter.total<middleBefore.total-1e-10;
  return {method:'aperture-continuation',budget,evaluations:used,validationEvaluations:4,before,after,accepted,result:accepted?after:before,system:accepted?after.prescription:input,finalScore:accepted?after.score:before.score,searchScore:stages.at(-1)?.searchScore,intermediate:{before:middleBefore.total,after:middleAfter.total},history,stages,rejections,validatedHistory:[{evaluations:0,score:before.score},{evaluations:used,score:accepted?after.score:before.score}]};
 }
 const api={schedule,optimize};root.LBApertureContinuation=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
