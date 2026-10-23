/* Shared browser/CLI numerical experiments. Search budgets count every objective
   call, including derivative probes, invalid trials and repeated stage starts.
   Validation is a fixed, separately reported cost for every method. */
(function(root){
 'use strict';
 const D=root.LBDLS||require('./dls.js'),L=root.LBSearch||require('./search.js'),E=root.LBExplorer||require('./explorer.js'),M=root.LBMerit||require('../design/merit.js');
 const METHODS=['coordinate','pattern','de','dls-radius','dls-curvature','hybrid','multistart','block-dls','continuation'];
 const score=(system,spec,operands)=>M.evaluate(system,spec,operands).merit;
 function shiftedStop(v,offset){
  const tolerance=1e-10*Math.max(1,Math.abs(v.min),Math.abs(v.max));
  if(offset<v.min-tolerance||offset>v.max+tolerance)throw Error('Stop candidate outside original bounds');
  // Subtracting two adjacent gap lengths loses a few ulps at an exact bound.
  return {...v,min:Math.min(0,v.min-offset),max:Math.max(0,v.max-offset)};
 }
 function normalized(raw,map){return raw.map((v,i)=>((map[i].curved?1/v:v)-map[i].lo)/(map[i].hi-map[i].lo));}
 async function search(input,spec,variables,operands,options={}){
  const method=options.method||'dls-curvature',budget=options.budget??1000,seed=options.seed??1001;
  if(!METHODS.includes(method))throw Error('Unknown experiment method');
  if(!Number.isSafeInteger(budget)||budget<4||budget>100000||!Number.isSafeInteger(seed)||seed<0||seed>4294967295)throw Error('Invalid experiment budget/seed');
  const history=[],stages=[],rejections={};let used=0,bestSystem=input,bestScore=Infinity,lastState=null;
  const add=(n)=>{for(const [k,v] of Object.entries(n||{}))rejections[k]=(rejections[k]||0)+v;};
  const pause=async()=>{if(options.yield)await options.yield();};
  const local=async(limit,initialVector,kind='curvature',selected=variables,localSpec=spec,localOperands=operands)=>{
   const offset=used,t=performance.now(),s=D.create(input,localSpec,selected,localOperands,{...options.dls,maxEvaluations:limit,parameterization:kind,...(initialVector?{initialVector}:{})});
   while(!s.done){D.advance(s);await pause();}
   used+=s.evaluations;add(s.rejections);history.push(...s.history.map(h=>({...h,evaluations:h.evaluations+offset,phase:'dls',objective:localOperands===operands?'original':'continuation'})));
   stages.push({method:'dls',evaluations:s.evaluations,elapsedMs:performance.now()-t,jacobian:s.lastJacobian,initialScore:s.initialScore,finalScore:s.current.score});lastState=s;
   return {system:D.prescription(s,s.x),score:s.current.score,x:s.x};
  };
  const accept=(r)=>{if(r.score<bestScore){bestScore=r.score;bestSystem=r.system;}};
  if(['coordinate','pattern'].includes(method)){
   const s=L.create(input,spec,variables,operands,{maxEvaluations:budget,seed,patternAcceleration:method==='pattern'});
   while(!s.done){for(let i=0;i<16&&!s.done;i++)L.advance(s);await pause();}
   used=s.evaluations;history.push(...s.history);accept({system:L.prescription(s,s.bestVector),score:s.bestScore});lastState=s;
  }else if(method==='de'||method==='hybrid'){
   const allocation=method==='de'?budget:Math.max(4,Math.floor(budget*.35)),t=performance.now();
   const s=E.create(input,spec,variables,operands,{budget:allocation,population:Math.min(24,allocation),seed});
   if(options.pool)await options.pool.init(s);
   while(!s.done){const vectors=E.next(s);if(!vectors.length)break;E.accept(s,options.pool?await options.pool.evaluate(vectors):vectors.map(v=>E.evaluate(s,v)));await pause();}
   used=s.evaluations;add(s.rejections);history.push(...s.history.map(h=>({...h,phase:'de'})));stages.push({method:'de',evaluations:used,elapsedMs:performance.now()-t});lastState=s;
   const winner=s.archive[0];if(!winner)throw Error('DE did not find a feasible candidate');accept({system:E.prescription(s,winner.vector),score:winner.score});
   if(method==='hybrid'&&budget-used>=2)accept(await local(budget-used,normalized(winner.vector,D.mapping(input,variables,'curvature'))));
  }else if(method==='multistart'){
   const rng={rng:seed},map=D.mapping(input,variables,'curvature'),initial=D.encode(input,map);let incumbent=initial;
   for(let run=0;run<3&&budget-used>=2;run++){
    let start=incumbent.slice();
    if(run){let found=false;for(let retry=0;retry<8&&budget-used>=3;retry++){
      start=incumbent.map(x=>Math.max(.00001,Math.min(.99999,x+(E.random(rng)-.5)*.08)));
      const r=M.evaluate(D.prescription({input,variables,mapping:map},start),spec,operands);used++;
      if(r.merit.valid){found=true;break;}add({[r.merit.errors[0]||'perturbation invalid']:1});
     }if(!found)start=incumbent.slice();}
    const r=await local(Math.max(2,Math.floor((budget-used)/(3-run))),start);if(r.score<bestScore){accept(r);incumbent=r.x;}
   }
  }else if(method==='block-dls'){
   // Coupled blocks share global image gap. Their physical bounds remain frozen.
   let vector=D.encode(input,D.mapping(input,variables,'curvature'));const map=D.mapping(input,variables,'curvature');
   const groups=[variables.map((v,i)=>v.key==='R'||v.surface===input.surfaces.length-2?i:-1).filter(i=>i>=0),variables.map((v,i)=>v.key!=='R'?i:-1).filter(i=>i>=0)];
   for(let round=0;round<4&&budget-used>=2;round++){
    const ids=groups[round%2];if(!ids.length)continue;
    // Freeze other parameters by using current system as input; stop displacement bounds shift with the incumbent.
    const current=D.prescription({input,variables,mapping:map},vector),selected=ids.map(i=>{const v={...variables[i]};if(v.key==='stopPosition'){const displacement=map[i].lo+vector[i]*(map[i].hi-map[i].lo);Object.assign(v,shiftedStop(v,displacement));}return v;});
    const s=D.create(current,spec,selected,operands,{maxEvaluations:Math.max(2,Math.floor((budget-used)/(4-round)))}),offset=used;
    while(!s.done){D.advance(s);await pause();}used+=s.evaluations;add(s.rejections);const candidate=D.prescription(s,s.x);accept({system:candidate,score:s.current.score});
    vector=map.map(v=>{const value=v.key==='stopPosition'?candidate.surfaces[v.surface-1].t-input.surfaces[v.surface-1].t:candidate.surfaces[v.surface][v.key];return ((v.curved?1/value:value)-v.lo)/(v.hi-v.lo);});history.push(...s.history.map(h=>({...h,evaluations:offset+h.evaluations,phase:'block'})));stages.push({method:'block',variables:ids,evaluations:s.evaluations,jacobian:s.lastJacobian});lastState=s;
   }
  }else if(method==='continuation'){
   // Early residual weights emphasize inner field and slower EXISTING apertures.
   // Physical constraints and ray tracing remain at the original full specification.
   // No invented aperture is added, and final objective is always the original.
   const easy=operands.map(o=>({...o,weight:o.weight*(o.field>.5?.1:1)*(o.aperture&&o.aperture<4?.1:1)}));
   const first=await local(Math.max(2,Math.floor(budget*.3)),null,'curvature',variables,spec,easy);
   stages[0].objective='inner field / slower aperture weighted continuation';
   // Explicit original-spec check counts against the budget, before any selection.
   const original=score(input,spec,operands);used++;accept({system:input,score:original.total});
   if(budget-used>=2)accept(await local(budget-used,first.x));
  }else accept(await local(budget,null,method==='dls-radius'?'radius':'curvature'));
  return {method,seed,budget,evaluations:used,searchScore:bestScore,candidate:bestSystem,history,stages,rejections,state:lastState};
 }
 function dense(system,spec,variables,operands,grid){
  const job=E.create(system,{...spec,...(grid?{validationGrid:grid}:{})},variables,operands,{budget:4,population:4});
  return E.evaluate(job,job.variables.map(v=>v.value),true);
 }
 async function optimize(input,spec,variables,operands,options={}){
  // Original bounds are also used for candidate validation, with rebased stop displacement.
  const rebase=system=>variables.map(v=>{if(v.key!=='stopPosition')return v;const offset=system.surfaces[v.surface-1].t-input.surfaces[v.surface-1].t;return shiftedStop(v,offset);});
  const start=performance.now(),before=dense(input,spec,variables,operands);
  if(before.score===null)throw Error('Experiment requires a dense-valid baseline');
  const t=performance.now(),run=await search(input,spec,variables,operands,options),searchMs=performance.now()-t;
  const validationStart=performance.now(),after=dense(run.candidate,spec,rebase(run.candidate),operands);
  // Intermediate disk and denser sunflower must both improve; fixed final grid remains unchanged.
  const intermediateSpec={...spec,pupilGrid:Math.min(15,spec.validationGrid||19),pupilPattern:'grid'};
  const middleBefore=M.evaluate(input,intermediateSpec,operands).merit,middleAfter=M.evaluate(run.candidate,intermediateSpec,operands).merit;
  const accepted=after.score!==null&&after.score<before.score-1e-10&&middleBefore.valid&&middleAfter.valid&&middleAfter.total<middleBefore.total-1e-10;
  const result=accepted?after:before;
  return {...run,accepted,before,after,result,system:accepted?after.prescription:input,finalScore:result.score,validationEvaluations:4,intermediate:{before:middleBefore.valid?middleBefore.total:null,after:middleAfter.valid?middleAfter.total:null},searchMs,validationMs:performance.now()-validationStart,elapsedMs:performance.now()-start,validatedHistory:[{evaluations:0,score:before.score},{evaluations:run.evaluations,score:result.score}]};
 }
 const api={METHODS,search,optimize,dense};root.LBOpticalExperiment=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
