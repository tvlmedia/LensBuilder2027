/* Read saved prescriptions across reachable Git history; never synthesize or optimize. */
const fs=require('node:fs'),cp=require('node:child_process'),crypto=require('node:crypto');
const C=require('../optimization/design-challenge'),O=require('../optics/core'),X=require('../optimization/experiment'),S=require('../synthesis/engine'),G=require('../synthesis/seeds');
const definition=require('../benchmarks/optical-suite-v1.json').cases.find(c=>c.id==='omit50');
const hash=system=>crypto.createHash('sha256').update(JSON.stringify(system.surfaces.map(s=>[s.type,s.R,s.t,s.ap_optical??s.ap,s.glass,s.nd??s.glass_nd??null,s.vd??s.glass_vd??null,!!s.stop]))).digest('hex');
const blobs=cp.execFileSync('git',['rev-list','--all','--objects'],{encoding:'utf8',maxBuffer:32e6}).trim().split('\n').map(s=>{const i=s.indexOf(' ');return {oid:s.slice(0,i),path:s.slice(i+1)};}).filter(s=>s.path.endsWith('.json'));
const candidates=new Map();let inspected=0;
function collect(x,source,trail='') {
 if(!x||typeof x!=='object')return;
 if(Array.isArray(x.surfaces)&&x.surfaces[0]?.type==='OBJ'&&x.surfaces.at(-1)?.type==='IMS'){
  const key=hash(x),record=candidates.get(key)||{key,system:x,sources:[]};record.sources.push({...source,trail});candidates.set(key,record);return;
 }
 for(const [k,v]of Object.entries(x))collect(v,source,trail+'/'+k);
}
for(const blob of blobs){try{collect(JSON.parse(cp.execFileSync('git',['cat-file','blob',blob.oid],{encoding:'utf8',maxBuffer:200e6})),blob);inspected++;}catch(e){if(!e.message.includes('Unexpected'))console.error(blob.path,e.message.slice(0,100));}}
const state=C.create(definition.specification,definition.operands,{source:'reference',budget:10000},require('../benchmarks/physical-omit50.json').system);
const rows=[];let count=0;
for(const r of candidates.values()){
 let q;
 try{q=C.validate(state,{system:r.system,ordinal:0});}catch(e){q={status:'INVALID',reason:e.message};}
 let nominalFNumber=null;try{nominalFNumber=O.paraxial(O.compile(r.system)).fNumber;}catch{}
 const first=q.dense?.analysis?.firstOrder,fields=q.dense?.analysis?.fields;
 rows.push({nominalFNumber,key:r.key,name:r.system.name,sources:r.sources,status:q.status,reason:q.reason,checks:q.checks,merit:q.dense?.score,firstOrder:first,fields:fields?.map(f=>({field:f.field,rmsMm:f.rmsMm,rayFraction:f.rayFraction}))});
 if(++count%25===0)console.log('evaluated',count,'/',candidates.size);
}
rows.sort((a,b)=>(a.status==='DENSE VALIDATED'?a.merit:Infinity)-(b.status==='DENSE VALIDATED'?b.merit:Infinity)||Math.abs(a.nominalFNumber-2)-Math.abs(b.nominalFNumber-2)||a.key.localeCompare(b.key));
const best=rows.find(r=>r.status==='DENSE VALIDATED');if(!best)throw Error('No valid recovered prescription');
const recovered=candidates.get(best.key),historical=require('../benchmarks/physical-omit50.json');
const bestSystem=structuredClone(recovered.system);
// Preserve original saved radii, spacings, glasses and apertures, at its validated nominal image plane.
const preset=(system,provenance)=>({...structuredClone(system),name:provenance.name,focus:{mode:'fixed',mechanism:'move-lens',shiftMm:0,autoRefocusOnDistanceChange:false},import_options:{...system.import_options,preserve_optical_apertures:true,preserve_ims_aperture:true},presetProvenance:provenance});
fs.mkdirSync('lenses',{recursive:true});
const originalNew=require('../benchmarks/omit50-challenge-new.json');
const materials=Object.fromEntries([...new Set(bestSystem.surfaces.map(s=>s.glass))].map(name=>[name,require('../materials/catalog').catalog[name]]));
const historicalExperiment=require('../benchmarks/omit50-methods-v1.json').experiments.find(e=>e.id==='omit50');
const provenance={name:'OMIT 50 Best · recovered Cooke direct 2002',selection:'Lowest valid dense merit among recovered complete prescriptions under the frozen common OMIT50 contract; not the historical M4 winner.',geometrySHA256:best.key,sources:best.sources,specification:definition.specification,operands:definition.operands,originalOptimization:best.key===hash(originalNew.system)?{sourceCase:originalNew.sourceCase,contract:originalNew.contract,budget:originalNew.budget,used:originalNew.used}:null,validation:best,materials,referenceGeometry:'OBJ/first nominal vertex x=0; mm; IMS=sum of preceding thicknesses; no focus shift; positive x toward sensor',coverage:'46.3 mm requested target; sampled survival, not validated usable coverage',mechanical:'PL/manufacturing unverified'};
fs.writeFileSync('lenses/omit50-best.json',JSON.stringify(preset(bestSystem,provenance),null,2)+'\n');
fs.writeFileSync('lenses/omit50-historical-m4.json',JSON.stringify(preset(historical.system,{name:'OMIT 50 Historical M4 · block DLS',source:'benchmarks/physical-omit50.json',originalMerit:historical.merit,materials,originalOptimization:{method:'block-dls',seed:1001,budget:historicalExperiment.budget,variables:historicalExperiment.variables,archive:'benchmarks/omit50-methods-v1.json#experiments/omit50/runs/block-dls/1001'},geometrySHA256:hash(historical.system),specification:definition.specification,operands:definition.operands,referenceGeometry:provenance.referenceGeometry}),null,2)+'\n');
const holdout=X.dense(bestSystem,S.analysisSpec(state.spec),G.variables(bestSystem,state.spec),definition.operands,23);
const report={scope:'All complete OBJ-to-IMS prescriptions in JSON blobs reachable from all fetched Git refs; optical geometry deduplicated. No optimization performed.',jsonBlobsInspected:inspected,uniquePrescriptions:candidates.size,commonSpecification:definition.specification,commonOperands:definition.operands,selected:best.key,historical:hash(historical.system),holdout23:{score:holdout.score,compliance:S.compliance(holdout,state.spec)},ranking:rows};
fs.writeFileSync('benchmarks/omit50-recovery.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({inspected,unique:candidates.size,selected:best.name,merit:best.merit,holdout:holdout.score,top:rows.slice(0,5).map(r=>({name:r.name,merit:r.merit,status:r.status}))},null,2));
