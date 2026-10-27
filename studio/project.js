/* Project policy only: all optical measurements remain in the existing engines. */
(function(root){
 'use strict';
 const Spec=root.LBSynthesisSpec||require('../synthesis/specification.js'),S=root.LBSynthesis||require('../synthesis/engine.js'),F=root.LBDesignForms||require('../synthesis/forms.js'),M=root.LBMerit||require('../design/merit.js');
 const VERSION='omit-studio-1',clone=x=>structuredClone(x);
 function preset(name='OMIT SIGNATURE',brief={}){
  if(!['CLEAN CINEMA','VINTAGE CHARACTER','OMIT SIGNATURE'].includes(name))throw Error('Unknown character preset');
  const fields=brief.fields||[0,.3,.5,.7,.85,1],aps=(brief.apertures||[2,2.8,4,5.6]).map(a=>typeof a==='number'?a:a.fNumber);
  return aps.flatMap(aperture=>[
   {metric:'efl',aperture,target:brief.targetEflMm||50,scale:brief.eflToleranceMm||1,weight:10},
   {metric:'fNumber',aperture,target:aperture,scale:.05,weight:3},
   ...fields.map(field=>({metric:'rms',field,aperture,target:0,scale:(name==='CLEAN CINEMA'?.04:name==='VINTAGE CHARACTER'?.03+.22*field**2:.03+.12*field**2)*(name==='OMIT SIGNATURE'&&aperture>=4?.6:1),weight:field<=.7?2:1})),
   ...fields.filter(f=>f>0).flatMap(field=>[
    {metric:'lateralColor',field,aperture,target:[-.015,.015],scale:.01,weight:1},
    {metric:'distortion',field,aperture,target:name==='CLEAN CINEMA'?[-1,1]:[-2,2],scale:1,weight:.5}]),
   {metric:'longitudinalColor',aperture,target:[-.1,.1],scale:.1,weight:.5},
   {metric:'pupilSurvival',aperture,type:'MINIMUM',target:brief.minRayFraction??.7,scale:.1,weight:2}
  ]);
 }
 function defaultBrief(){return {...Spec.specification({name:'OMIT 50 — Full Frame',targetFNumber:2,imageCircleMm:46.3,apertures:[2,2.8,4,5.6],mount:'PL',flangeFocalDistanceMm:52}),maxFrontDiameterMm:70,opticalMinBflMm:15,rearClearanceMm:15,characterPreset:'OMIT SIGNATURE',mountNotes:'PL intended; mechanical compatibility unverified. Editable construction limits are design assumptions.'};}
 function brief(raw){
  const s=Spec.specification({...raw,topology:'auto'});
  for(const key of ['maxFrontDiameterMm','opticalMinBflMm','rearClearanceMm'])if(!Number.isFinite(raw[key])||raw[key]<0||(key==='maxFrontDiameterMm'&&raw[key]===0))throw Error('Invalid '+key);
  if(s.minGroups>s.maxElements||s.maxOpticalLengthMm<s.minElements*s.minCenterMm+raw.rearClearanceMm)throw Error('Contradictory element thickness, length or rear clearance');
  if(raw.opticalMinBflMm>=s.maxOpticalLengthMm||raw.rearClearanceMm>=s.maxOpticalLengthMm)throw Error('Rear distance exceeds optical length');
  if(new Set(s.allowedGlasses).size!==s.allowedGlasses.length)throw Error('Glass catalog entries must be unique');
  return {...s,maxFrontDiameterMm:raw.maxFrontDiameterMm,opticalMinBflMm:raw.opticalMinBflMm,rearClearanceMm:raw.rearClearanceMm,characterPreset:raw.characterPreset||'CUSTOM',mountNotes:String(raw.mountNotes||'')};
 }
 function settings(raw={}){
  const q={topologies:F.forms.map(f=>f.id),seeds:[1001,2002],totalBudget:16384,workers:2,method:'block-dls',refinementBudget:256,glassTrials:2,glassTrialBudget:32,...clone(raw)};
  if(!Array.isArray(q.topologies)||!q.topologies.length||q.topologies.length>4||new Set(q.topologies).size!==q.topologies.length)throw Error('Select distinct topologies');q.topologies.forEach(F.get);
  if(!Array.isArray(q.seeds)||!q.seeds.length||q.seeds.length>8||new Set(q.seeds).size!==q.seeds.length||q.seeds.some(n=>!Number.isSafeInteger(n)||n<0||n>4294967295))throw Error('Use 1–8 distinct integer random seeds');
  for(const k of ['totalBudget','workers','refinementBudget','glassTrials','glassTrialBudget'])if(!Number.isSafeInteger(q[k])||q[k]<0)throw Error('Invalid '+k);
  if(q.workers<1||q.workers>8||q.totalBudget>1000000||q.refinementBudget>10000||q.refinementBudget>0&&q.refinementBudget<4||q.glassTrials>16||q.glassTrialBudget<2||q.glassTrialBudget>1000)throw Error('Tournament resource bounds exceeded');
  if(!['de','pattern','dls-curvature','dls-radius','block-dls'].includes(q.method))throw Error('Unsupported refinement method');
  const runs=q.topologies.length*q.seeds.length,perRun=Math.floor(q.totalBudget/runs),glass=q.glassTrials?2+q.glassTrials*(q.glassTrialBudget+4):0,validation=7;
  const synthesis=perRun-q.refinementBudget-(q.refinementBudget?4:0)-glass-validation;
  if(synthesis<256)throw Error('Budget too small: reserve at least 256 synthesis work units per topology/seed after refinement and validation');
  return {...q,allocation:{runs,perRun,synthesis,refinement:q.refinementBudget,refinementValidation:q.refinementBudget?4:0,glass,validation,unallocated:q.totalBudget-runs*perRun}};
 }
 function validateOperands(ops,b){M.validateOperands(ops);for(const o of ops){if(o.operation)throw Error('Cross-aperture ratio/change targets are excluded from studio optimization: use absolute targets at each aperture');if(o.aperture===undefined||!b.apertures.some(a=>a.fNumber===o.aperture&&a.optimization))throw Error('Every character operand needs an optimized aperture');if(o.field!==undefined&&!b.fields.includes(o.field))throw Error('Operand field is not sampled');if(o.metric==='rms'&&(Array.isArray(o.target)?o.target.some(t=>t!==0):o.target!==0)||o.metric==='rms'&&['MINIMUM','MAXIMIZE'].includes(o.type))throw Error('RMS targets must prefer zero or a maximum; do not reward intentional degradation');}return clone(ops);}
 function create(raw=defaultBrief(),options={},operands){const b=brief(raw),q=settings(options),ops=validateOperands(operands||preset(b.characterPreset,b),b);for(const topology of q.topologies)F.select({...b,topology});const contract=S.hash([b,q,ops]);return {version:VERSION,software:root.LB_BUILD||{applicationVersion:'1.0.0'},id:'studio-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),createdAt:new Date().toISOString(),brief:b,settings:q,operands:ops,contract,runs:q.topologies.flatMap(topology=>q.seeds.map(seed=>({id:topology+'-'+seed,topology,seed,stage:'QUEUED',done:false,costs:{},history:[],results:[]}))),events:[],physical:[]};}
 function restore(raw){if(raw?.version!==VERSION)throw Error('Unsupported studio project');const expected=create(raw.brief,raw.settings,raw.operands);if(expected.contract!==raw.contract||raw.runs.length!==expected.runs.length)throw Error('Project brief or tournament contract changed');for(let i=0;i<raw.runs.length;i++)if(raw.runs[i].id!==expected.runs[i].id||raw.runs[i].topology!==expected.runs[i].topology||raw.runs[i].seed!==expected.runs[i].seed||!['QUEUED','GENERATE','REFINE','GLASS','FINAL VALIDATION','FINISHED'].includes(raw.runs[i].stage)||raw.runs[i].done!==(raw.runs[i].stage==='FINISHED'))throw Error('Tournament run identities changed');const p=clone(raw);p.physical=[];p.runs.forEach(r=>{r.needsVerification=true;for(const item of r.results||[])item.verified=false;});return p;}
 function duplicate(p){const q=create(p.brief,p.settings,p.operands);q.events.push({type:'DUPLICATED',from:p.id});return q;}
 function spec(p,r){return {...p.brief,name:p.brief.name+' · '+r.id,topology:r.topology,seed:r.seed,budget:p.settings.allocation.synthesis,workers:1,minBflMm:Math.min(p.brief.opticalMinBflMm,p.brief.rearClearanceMm),parentsPerTopology:2,archiveSize:4};}
 function ranked(p){return p.runs.flatMap(r=>(r.results||[]).map(item=>({...item,runId:r.id}))).filter(i=>i.verified&&i.status==='DENSE VALIDATED'&&Number.isFinite(i.dense?.score)).sort((a,b)=>a.dense.score-b.dense.score||a.id.localeCompare(b.id));}
 function adopt(p,id,editor){const item=ranked(p).find(i=>i.id===id);if(!item)throw Error('Select a freshly verified finalist');editor.adopt(item.dense.prescription||item.system,{studioProject:p.id,brief:clone(p.brief),contract:p.contract,candidate:id});p.events.push({type:'ADOPTED',candidate:id,at:new Date().toISOString()});}
 const api={VERSION,defaultBrief,brief,settings,preset,validateOperands,create,restore,duplicate,spec,ranked,adopt};root.LBStudioProject=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
