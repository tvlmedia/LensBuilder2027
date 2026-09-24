(function(root){
'use strict';
const Merit=root.LBMerit||require('../design/merit.js');
const VERSION='lb2027-spherical-0.2.0';
function validateVariables(system,variables){
 if(!Array.isArray(variables)||!variables.length||variables.length>64)throw new Error('Select 1–64 variables');
 const seen=new Set();for(const v of variables){
  const s=system.surfaces[v.surface],id=`${v.surface}:${v.key}`;
  if(!s||v.surface<=0||v.surface>=system.surfaces.length-1||!['R','t','stopPosition'].includes(v.key)||seen.has(id))throw new Error(`Invalid/duplicate variable ${id}`);seen.add(id);
  if(![v.min,v.max].every(Number.isFinite)||v.min>=v.max)throw new Error(`Invalid bounds for ${id}`);
  const value=v.key==='stopPosition'?0:s[v.key];if(value<v.min||value>v.max)throw new Error(`Current ${id} outside bounds`);
  if(v.key==='R'&&(v.min<=0&&v.max>=0))throw new Error('Radius bounds cannot cross zero (plane discontinuity)');
  if(v.key==='t'&&v.min<0)throw new Error('Thickness bounds cannot be negative');
  if(v.key==='stopPosition'&&(!s.stop||s.R!==0||s.glass!=='AIR'||system.surfaces[v.surface-1].glass!=='AIR'||v.surface<=1))throw new Error('Stop position requires a separate plane iris in air');
 }
 for(const v of variables.filter(v=>v.key==='stopPosition'))if(variables.some(u=>u.key==='t'&&(u.surface===v.surface||u.surface===v.surface-1)))throw new Error('Stop translation cannot share its two air gaps with thickness variables');
}
function prescription(state,vector){const s=structuredClone(state.input);state.variables.forEach((v,i)=>{if(v.key==='stopPosition'){s.surfaces[v.surface-1].t+=vector[i];s.surfaces[v.surface].t-=vector[i];}else s.surfaces[v.surface][v.key]=vector[i];});return s;}
function create(input,spec,variables,operands,options={}){
 validateVariables(input,variables);Merit.validateOperands(operands);
 const maxEvaluations=options.maxEvaluations??600;if(!Number.isInteger(maxEvaluations)||maxEvaluations<2||maxEvaluations>100000)throw new Error('Evaluation budget must be 2–100000');
 const seed=options.seed??1;if(!Number.isSafeInteger(seed))throw new Error('Seed must be an integer');
 const baseline=Merit.evaluate(input,spec,operands);if(!baseline.merit.valid)throw new Error(`Starting lens invalid: ${baseline.merit.errors.join('; ')}`);
 const vector=variables.map(v=>v.key==='stopPosition'?0:input.surfaces[v.surface][v.key]);
 return {schemaVersion:1,engineVersion:VERSION,algorithm:'bounded-coordinate-pattern-search',seed,seedUsage:'Deterministic algorithm; no random sampling',id:options.id||`run-${Date.now()}`,createdAt:new Date().toISOString(),input:(()=>{const copy=structuredClone(input);delete copy.project;return copy;})(),software:options.software||{engineVersion:VERSION},spec:structuredClone(spec),variables:structuredClone(variables),operands:structuredClone(operands),maxEvaluations,bestVector:vector,bestScore:baseline.merit.total,initialScore:baseline.merit.total,evaluations:1,validCandidates:1,iteration:0,cursor:0,step:.15,sweepStart:baseline.merit.total,history:[{evaluations:1,score:baseline.merit.total}],done:false};
}
function advance(state){
 if(state.done)return state;
 const n=state.variables.length,i=Math.floor(state.cursor/2),sign=state.cursor%2===0?1:-1,v=state.variables[i],vector=state.bestVector.slice();
 vector[i]=Math.max(v.min,Math.min(v.max,vector[i]+sign*state.step*(v.max-v.min)));
 if(vector[i]!==state.bestVector[i]){
  const result=Merit.evaluate(prescription(state,vector),state.spec,state.operands);state.evaluations++;
  if(result.merit.valid){state.validCandidates++;if(result.merit.total<state.bestScore){state.bestScore=result.merit.total;state.bestVector=vector;}}
 }
 state.cursor++;
 if(state.cursor===2*n){state.cursor=0;state.iteration++;if(state.bestScore>=state.sweepStart-1e-12)state.step*=.5;state.sweepStart=state.bestScore;state.history.push({evaluations:state.evaluations,score:state.bestScore});}
 state.done=state.evaluations>=state.maxEvaluations||state.step<1e-5;
 return state;
}
function resume(raw){
 const s=structuredClone(raw);if(s.schemaVersion!==1||s.engineVersion!==VERSION||s.algorithm!=='bounded-coordinate-pattern-search')throw new Error('Checkpoint engine/schema mismatch');
 validateVariables(s.input,s.variables);Merit.validateOperands(s.operands);
 if(!Number.isFinite(s.sweepStart)||!Number.isFinite(s.initialScore)||!Number.isSafeInteger(s.seed)||!Number.isInteger(s.iteration)||s.iteration<0||!Array.isArray(s.history))throw new Error('Invalid checkpoint metadata');
 if(!Array.isArray(s.bestVector)||s.bestVector.length!==s.variables.length||s.bestVector.some((x,i)=>!Number.isFinite(x)||x<s.variables[i].min||x>s.variables[i].max)||!Number.isInteger(s.cursor)||s.cursor<0||s.cursor>=s.variables.length*2||!(s.step>0&&s.step<=.15)||!Number.isInteger(s.evaluations)||s.evaluations<1||!Number.isInteger(s.maxEvaluations)||s.maxEvaluations>100000||s.maxEvaluations<2)throw new Error('Invalid checkpoint search state');
 const score=Merit.evaluate(prescription(s,s.bestVector),s.spec,s.operands).merit;
 if(!score.valid||Math.abs(score.total-s.bestScore)>1e-8*Math.max(1,score.total))throw new Error('Checkpoint score mismatch');return s;
}
function finish(state){
 const candidate=prescription(state,state.bestVector),highSpec={...state.spec,pupilGrid:Math.min(41,2*(state.spec.pupilGrid||9)+1)};
 const before=Merit.evaluate(state.input,highSpec,state.operands),after=Merit.evaluate(candidate,highSpec,state.operands);
 const accepted=before.merit.valid&&after.merit.valid&&after.merit.total<before.merit.total-1e-10;
 return {state,candidate,before,after,accepted,validationGrid:highSpec.pupilGrid,reason:accepted?'Improved on independent denser pupil sampling':'No validated improvement; keep original prescription'};
}
const api={VERSION,validateVariables,prescription,create,advance,resume,finish};root.LBSearch=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
