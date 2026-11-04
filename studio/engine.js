/* Tournament orchestration; numerical work delegates to the existing engines. */
(function(root){
 'use strict';
 const J=root.LBStudioProject||require('./project.js'),S=root.LBSynthesis||require('../synthesis/engine.js'),P=root.LBSynthesisPhysics||require('../synthesis/physics.js'),R=root.LBGeometryRefinement||require('../synthesis/refine.js'),G=root.LBGlassSearch||require('../synthesis/glass.js'),E=root.LBExplorer||require('../optimization/explorer.js'),M=root.LBMerit||require('../design/merit.js'),A=root.LBAnalysis||require('../analysis/evaluate.js'),O=root.LBOptics||require('../optics/core.js');
 const clone=x=>structuredClone(x);
 const compact=x=>JSON.parse(JSON.stringify(x,(k,v)=>['hits','rows'].includes(k)?undefined:v));
 // Worker-local instrumentation. Categories do not overlap; analyses can contain
 // several wavelengths and objective calls may reject before any ray tracing.
 async function measured(run,category,fn,options={}){
  const original=[];let active=category,depth=0,start=performance.now();
  const cost=()=>run.costs[active]||(run.costs[active]={objectiveCalls:0,analysisCalls:0,traceApiCalls:0,paraxialCalls:0,elapsedMs:0});
  const switchCategory=next=>{cost().elapsedMs+=performance.now()-start;active=next==='validation'?'validation':category;start=performance.now();};
  for(const [host,key,counter]of [[E,'evaluate','objectiveCalls'],[M,'evaluate','objectiveCalls'],[A,'evaluate','analysisCalls'],[O,'trace','traceApiCalls'],[O,'paraxial','paraxialCalls']]){const f=host[key];original.push([host,key,f]);host[key]=function(...args){
   const standalone=host===A&&depth===0&&options.includeStandaloneAnalysis,objective=counter==='objectiveCalls'||standalone,previous=active;
   if(host===E&&args[2]&&category!=='checkpointVerification')switchCategory('validation');
   if(!objective||depth===0)cost()[counter]++;if(standalone)cost().objectiveCalls++;
   if(objective)depth++;
   try{return f.apply(this,args);}finally{if(objective)depth--;if(active!==previous){cost().elapsedMs+=performance.now()-start;active=previous;start=performance.now();}}
  };}
  try{return await fn(switchCategory);}finally{cost().elapsedMs+=performance.now()-start;for(const [host,key,f]of original)host[key]=f;}
 }
 function validate(p,run,item){
  const spec=J.spec(p,run),system=item.dense?.prescription||item.system;
  const job=S.makeJob({spec,operands:p.operands,software:p.software},{system,ordinal:item.ordinal??0},4),dense=E.evaluate(job,job.variables.map(v=>v.value),true),base=S.compliance(dense,spec),first=dense.analysis?.firstOrder;
  const front=2*(dense.prescription||system).surfaces[1].ap;
  const checks={...base.checks,frontDiameter:front<=p.brief.maxFrontDiameterMm,opticalBfl:!!first&&first.bflMm>=p.brief.opticalMinBflMm,rearImageClearance:!!first&&first.imageDistanceMm>=p.brief.rearClearanceMm};
  return {...clone(item),id:item.id||run.id+'-'+(item.ordinal??0),system:dense.prescription||system,dense:compact(dense),checks,status:base.status==='DENSE VALIDATED'&&Object.values(checks).every(Boolean)?'DENSE VALIDATED':'INVALID',verified:true,construction:P.construction(system),validation:{geometricFeasibility:Object.values(checks).every(Boolean)?'PASS':'FAIL',opticalCorrection:'Inspect measured targets; dense-valid is not well-corrected',mechanical:'UNVERIFIED',manufacturing:'UNVERIFIED',imageCircle:'Sampled survival at required field heights; not certified continuous coverage'}};
 }
 function select(results){return results.filter(i=>i.verified&&i.status==='DENSE VALIDATED'&&Number.isFinite(i.dense?.score)).sort((a,b)=>a.dense.score-b.dense.score);}
 async function verify(p,run){
  await measured(run,'checkpointVerification',async()=>{if(run.synthesis)run.synthesis=S.restore(run.synthesis);run.results=(run.results||[]).map(i=>validate(p,run,i));if(run.incumbent)run.incumbent=validate(p,run,run.incumbent);});run.needsVerification=false;
 }
 async function controlled(p,run,options){
  const C=root.LBDesignChallenge||require('../optimization/design-challenge.js');
  if(!run.challenge)run.challenge=C.create({...p.brief,topology:run.topology,seed:run.seed},p.operands,{budget:p.settings.allocation.perRun,source:run.source,strategy:p.settings.method==='controlled-continuation'?'aperture-continuation':'direct',glassTrials:p.settings.glassTrials,glassTrialBudget:p.settings.glassTrialBudget},p.settings.referenceSystem);
  else if(run.needsVerification)run.challenge=C.restore(run.challenge);
  run.needsVerification=false;await C.step(run.challenge,options);const c=run.challenge;
  run.costs=c.costs;run.history=c.history;run.elapsedMs=c.elapsedMs;run.done=c.done;run.stage=c.done?'FINISHED':c.stage==='GENERATE'?'GENERATE':'REFINE';run.synthesisSummary=c.synthesisSummary;
  run.results=c.best?.verified?[{...c.best,id:run.id+'-0',topology:run.topology}]:[];
  run.convergence=c.history.filter(h=>Number.isFinite(h.score)).map(h=>({stage:h.stage,evaluations:h.evaluations,score:h.score}));return run;
 }
 async function step(p,run,options={}){
  if(p.settings.method.startsWith('controlled-'))return controlled(p,run,options);
  if(run.needsVerification)await verify(p,run);
  if(run.done)return run;
  const spec=J.spec(p,run),start=performance.now();
  if(run.stage==='QUEUED'){run.synthesis=S.create(spec,p.operands,p.software);run.stage='GENERATE';}
  if(run.stage==='GENERATE'){
   const category=run.synthesis.stage==='DENSE'?'validation':'synthesis';
   await measured(run,category,()=>S.step(run.synthesis));
   if(run.synthesis.done){
    run.results=await measured(run,'validation',()=>run.synthesis.results.map((i,n)=>validate(p,run,{...i,id:run.id+'-'+n})));
    run.incumbent=select(run.results)[0]||null;run.stage=run.incumbent?'REFINE':'FINISHED';
   }
  }else if(run.stage==='REFINE'){
   if(p.settings.refinementBudget){try{
    const candidate=await measured(run,'refinement',onStage=>R.optimize(run.incumbent,spec,p.operands,{method:p.settings.method,maxEvaluations:p.settings.refinementBudget,onStage,yield:options.yield}));
    const checked=await measured(run,'validation',()=>validate(p,run,candidate));
    run.history.push({stage:'REFINE',before:run.incumbent.dense.score,after:checked.dense.score,accepted:checked.status==='DENSE VALIDATED'&&checked.dense.score<run.incumbent.dense.score,audit:candidate.geometryRefinement});
    if(checked.status==='DENSE VALIDATED'&&checked.dense.score<run.incumbent.dense.score)run.incumbent=checked;
   }catch(e){run.history.push({stage:'REFINE',error:e.message,retainedParent:true});}}
   run.stage='GLASS';
  }else if(run.stage==='GLASS'){
   if(p.settings.glassTrials){try{
    const candidate=await measured(run,'glass',()=>G.optimize(run.incumbent,spec,p.operands,{perTrialBudget:p.settings.glassTrialBudget,maxTrials:p.settings.glassTrials,includeFamilies:true,yield:options.yield}));
    const checked=await measured(run,'validation',()=>validate(p,run,candidate));
    run.history.push({stage:'GLASS',before:run.incumbent.dense.score,after:checked.dense.score,accepted:checked.status==='DENSE VALIDATED'&&checked.dense.score<run.incumbent.dense.score,audit:candidate.glassSearch});
    if(checked.status==='DENSE VALIDATED'&&checked.dense.score<run.incumbent.dense.score)run.incumbent=checked;
   }catch(e){run.history.push({stage:'GLASS',error:e.message,retainedParent:true});}}
   run.stage='FINAL VALIDATION';
  }else if(run.stage==='FINAL VALIDATION'){
   run.incumbent=await measured(run,'validation',()=>validate(p,run,run.incumbent));
   run.results=run.results.filter(i=>i.id!==run.incumbent.id).concat(run.incumbent);run.stage='FINISHED';
  }
  if(run.stage==='FINISHED'){run.done=true;run.synthesisSummary={counts:run.synthesis.counts,allocation:run.synthesis.allocation,rejections:run.synthesis.rejections,selected:run.synthesis.selected};delete run.synthesis;delete run.incumbent;}
  run.elapsedMs=(run.elapsedMs||0)+performance.now()-start;
  const best=select(run.results)[0];run.convergence=run.convergence||[];run.convergence.push({stage:run.stage,evaluations:Object.values(run.costs).reduce((n,c)=>n+c.objectiveCalls,0),score:best?.dense.score??null});
  if(run.convergence.length>2000)run.convergence=run.convergence.filter((_,i)=>i%2===0);
  return run;
 }
 function summary(p){const ranked=J.ranked(p);return {contract:p.contract,allocation:p.settings.allocation,runs:p.runs.map(r=>({id:r.id,topology:r.topology,seed:r.seed,stage:r.stage,done:r.done,costs:r.costs,counts:r.synthesis?.counts||r.synthesisSummary?.counts,rejections:r.synthesis?.rejections||r.synthesisSummary?.rejections,best:ranked.find(i=>i.runId===r.id)?.dense.score??null})),best:ranked[0]||null,fairness:p.settings.method.startsWith('controlled-')?'Equal outer objective/standalone-analysis budgets, fully spent by completed feasible runs. Initialization/paraxial and public ray costs reported separately; verification after reload is extra. Failed initialization leaves an explicitly incomplete comparison.':'Identical allocated maximum work budgets per topology/seed; actual objective and ray-analysis counts are reported separately. Early rejection/termination can leave budget unused. Not an exact equal-actual-evaluation benchmark.'};}
 const api={measured,validate,verify,step,summary,select};root.LBStudioEngine=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
