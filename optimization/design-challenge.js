/* Budgeted orchestration: existing synthesis, search, glass and dense validators. */
(function(root){
 'use strict';
 const S=root.LBSynthesis||require('../synthesis/engine.js'),Spec=root.LBSynthesisSpec||require('../synthesis/specification.js'),G=root.LBSynthesisSeeds||require('../synthesis/seeds.js'),R=root.LBGeometryRefinement||require('../synthesis/refine.js'),Glass=root.LBGlassSearch||require('../synthesis/glass.js'),X=root.LBOpticalExperiment||require('./experiment.js'),E=root.LBExplorer||require('./explorer.js'),P=root.LBSynthesisPhysics||require('../synthesis/physics.js'),T=root.LBStudioEngine||require('../studio/engine.js');
 const VERSION='controlled-design-1',clone=x=>structuredClone(x),compact=x=>JSON.parse(JSON.stringify(x,(k,v)=>['rows','hits'].includes(k)?undefined:v));
 function create(raw,operands,options={},reference){
  const spec=Spec.specification(raw),settings={budget:10000,source:'generated',strategy:'direct',epochBudget:512,glassTrials:2,glassTrialBudget:64,...options};
  if(!Number.isSafeInteger(settings.budget)||settings.budget<512||settings.budget>1000000)throw Error('Controlled budget must be 512–1000000');
  if(!['generated','reference'].includes(settings.source)||!['direct','aperture-continuation'].includes(settings.strategy))throw Error('Invalid controlled strategy/source');
  if(!Number.isSafeInteger(settings.epochBudget)||settings.epochBudget<16||settings.epochBudget>10000||!Number.isSafeInteger(settings.glassTrials)||settings.glassTrials<0||settings.glassTrials>16||!Number.isSafeInteger(settings.glassTrialBudget)||settings.glassTrialBudget<2||settings.glassTrialBudget>1000)throw Error('Invalid controlled stage limits');
  if(settings.source==='reference'&&!reference)throw Error('Reference prescription required');
  const p={version:VERSION,spec,operands:clone(operands),settings,reference:reference?clone(reference):null,costs:{},history:[],epoch:0,stage:settings.source==='reference'?'REFERENCE':'GENERATE',done:false,best:null,initialScore:null,elapsedMs:0};
  p.contract=S.hash([p.spec,p.operands,p.settings,p.reference]);
  if(p.stage==='GENERATE')p.synthesis=S.create({...spec,budget:Math.max(256,Math.floor(settings.budget*.45)),workers:1,archiveSize:4,parentsPerTopology:2},operands);
  return p;
 }
 function used(p){return Object.entries(p.costs).filter(([k])=>k!=='checkpointVerification').reduce((n,[,c])=>n+c.objectiveCalls,0);}
 const measure=(p,category,fn)=>T.measured(p,category,fn,{includeStandaloneAnalysis:true});
 function checked(p,item,dense){const system=dense.prescription||item.system,base=S.compliance(dense,p.spec),first=dense.analysis?.firstOrder,checks={...base.checks};
  if(p.spec.maxFrontDiameterMm!==undefined)checks.frontDiameter=2*system.surfaces[1].ap<=p.spec.maxFrontDiameterMm;
  if(p.spec.opticalMinBflMm!==undefined)checks.opticalBfl=!!first&&first.bflMm>=p.spec.opticalMinBflMm;
  if(p.spec.rearClearanceMm!==undefined)checks.rearImageClearance=!!first&&first.imageDistanceMm>=p.spec.rearClearanceMm;
  const status=base.status==='DENSE VALIDATED'&&Object.values(checks).every(Boolean)?'DENSE VALIDATED':'INVALID';
  return {...compact(item),system,dense:compact(dense),checks,status,verified:true,construction:P.construction(system),validation:{geometricFeasibility:status==='DENSE VALIDATED'?'PASS':'FAIL',opticalCorrection:'Inspect measurements; no correction certificate',mechanical:'UNVERIFIED',manufacturing:'UNVERIFIED',imageCircle:'Sampled survival only'}};
 }
 function validate(p,item){const system=item.system||item.dense?.prescription,dense=X.dense(system,S.analysisSpec(p.spec),G.variables(system,p.spec),p.operands);return checked(p,item,dense);}

 function accept(p,item,stage){if(item.status==='DENSE VALIDATED'&&Number.isFinite(item.dense.score)&&(!p.best||item.dense.score<p.best.dense.score)){p.best=item;p.history.push({stage,evaluations:used(p),score:item.dense.score,accepted:true});return true;}return false;}
 function restore(raw){if(raw?.version!==VERSION)throw Error('Unsupported controlled checkpoint');const expected=create(raw.spec,raw.operands,raw.settings,raw.reference);if(raw.contract!==expected.contract||used(raw)>raw.settings.budget)throw Error('Controlled checkpoint contract/budget changed');if(!['REFERENCE','GENERATE','REFINE','GLASS','TAIL','FINAL','FINISHED'].includes(raw.stage)||raw.done!==(raw.stage==='FINISHED'))throw Error('Invalid controlled checkpoint stage');for(const c of Object.values(raw.costs||{}))for(const [k,v]of Object.entries(c))if(!Number.isFinite(v)||v<0||(k!=='elapsedMs'&&!Number.isSafeInteger(v)))throw Error('Invalid evaluation counter');const p=clone(raw);p.needsVerification=true;if(p.best)p.best.verified=false;return p;}
 async function step(p,options={}){
  const start=performance.now();
  if(p.needsVerification){await measure(p,'checkpointVerification',()=>{if(p.synthesis)p.synthesis=S.restore(p.synthesis);if(p.best){p.best=validate(p,p.best);if(p.best.status!=='DENSE VALIDATED')throw Error('Saved controlled incumbent failed verification');}});p.needsVerification=false;}
  if(p.done)return p;
  const remaining=()=>p.settings.budget-used(p);
  if(p.stage==='REFERENCE'){
   const base=await measure(p,'validation',()=>validate(p,{system:p.reference,topology:p.spec.topology,ordinal:0}));
   if(!accept(p,base,'REFERENCE'))throw Error('Reference fails the frozen final constraints');p.initialScore=base.dense.score;p.stage='REFINE';
  }else if(p.stage==='GENERATE'){
   await measure(p,'synthesis',()=>S.step(p.synthesis));
   if(p.synthesis.done){
    for(const item of p.synthesis.results)if(item.status==='DENSE VALIDATED')accept(p,checked(p,item,item.dense),'SYNTHESIS DENSE');
    p.synthesisSummary={counts:p.synthesis.counts,rejections:p.synthesis.rejections,allocation:p.synthesis.allocation};delete p.synthesis;
    p.initialScore=p.best?.dense.score??null;p.stage=p.best?'REFINE':'FINISHED';
   }
  }else if(p.stage==='REFINE'){
   const glassReserve=p.settings.glassTrials?(2+p.settings.glassTrials*(p.settings.glassTrialBudget+4)+1):0;
   if(remaining()<=glassReserve+24){p.stage='GLASS';return p;}
   const first=p.epoch===0,limit=Math.min(first?Math.min(2048,Math.max(16,Math.floor(p.settings.budget*.15))):p.settings.epochBudget,remaining()-glassReserve-6),
    method=first&&p.settings.strategy==='aperture-continuation'?'aperture-continuation':['pattern','block-dls','pattern','multistart'][p.epoch%4],
    // Late search uses the same sunflower density as final validation. No threshold changes.
    workSpec=used(p)>.65*p.settings.budget?{...p.spec,pupilGrid:p.spec.validationGrid,pupilPattern:'sunflower'}:p.spec;
   const before=p.best.dense.score;
   try{const candidate=await measure(p,'refinement',onStage=>R.optimize(p.best,workSpec,p.operands,{method,maxEvaluations:limit,onStage,yield:options.yield})),checked=await measure(p,'validation',()=>validate(p,candidate));
    const accepted=accept(p,checked,method);p.history.push({stage:method,evaluations:used(p),before,after:checked.dense.score,accepted,searchGrid:workSpec.pupilGrid,audit:candidate.geometryRefinement});
   }catch(e){p.history.push({stage:method,evaluations:used(p),error:e.message,retainedParent:true});}
   p.epoch++;
  }else if(p.stage==='GLASS'){
   if(p.settings.glassTrials&&remaining()>2+p.settings.glassTrials*(p.settings.glassTrialBudget+4)+1){
    try{const candidate=await measure(p,'glass',()=>Glass.optimize(p.best,p.spec,p.operands,{maxTrials:p.settings.glassTrials,perTrialBudget:p.settings.glassTrialBudget,includeFamilies:true,yield:options.yield})),checked=await measure(p,'validation',()=>validate(p,candidate));const accepted=accept(p,checked,'GLASS');p.history.push({stage:'GLASS',evaluations:used(p),accepted,audit:candidate.glassSearch});}catch(e){p.history.push({stage:'GLASS',error:e.message,retainedParent:true});}
   }
   p.stage='TAIL';
  }else if(p.stage==='TAIL'){
   // Spend otherwise unused evaluations on real bounded local-basin probes, not padding repeats.
   // Dense probes have a defined final objective, so one evaluation can safely accept a winner.
   const job=S.makeJob({spec:p.spec,operands:p.operands,software:{}},{system:p.best.system,ordinal:p.epoch},4),rng=G.rng((p.spec.seed+used(p)*2654435761)>>>0);
   for(let i=0;i<8&&remaining()>1;i++){
    const vector=job.variables.map(v=>v.value),j=Math.floor(rng()*vector.length),v=job.variables[j],scale=.0002*(1+Math.floor(rng()*10));vector[j]=Math.max(v.min,Math.min(v.max,vector[j]+(rng()<.5?-1:1)*scale*(v.max-v.min)));
    const dense=await measure(p,'validation',()=>E.evaluate(job,vector,true)),compliance=S.compliance(dense,p.spec);
    if(compliance.status==='DENSE VALIDATED')accept(p,checked(p,p.best,dense),'DENSE BASIN PROBE');
   }
   if(remaining()===1)p.stage='FINAL';
  }else if(p.stage==='FINAL'){
   p.best=await measure(p,'validation',()=>validate(p,p.best));if(p.best.status!=='DENSE VALIDATED')throw Error('Final incumbent failed independent validation');p.stage='FINISHED';
  }
  if(used(p)>p.settings.budget)throw Error('Controlled evaluation budget exceeded');
  if(p.stage==='FINISHED'){p.done=true;p.completion=p.best?'COMPLETE':'NO FEASIBLE CANDIDATE';}
  p.elapsedMs+=performance.now()-start;return p;
 }
 const api={VERSION,create,restore,step,used,validate};root.LBDesignChallenge=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
