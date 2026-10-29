/* Post-selection diagnostics: these costs are outside the search budget. */
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
require('../build-info');
const C=require('../optimization/design-challenge'),S=require('../synthesis/engine'),G=require('../synthesis/seeds'),X=require('../optimization/experiment'),E=require('../optimization/explorer'),P=require('../physical/engine');
const report=require('../benchmarks/omit50-challenge-v1.json'),spec=report.specification,operands=report.operands;
const compact=x=>JSON.parse(JSON.stringify(x,(k,v)=>['rows','hits'].includes(k)?undefined:v));
function metrics(d){const f=d.analysis.fields,at=n=>f.find(x=>x.field===n),edge=at(1);return {merit:d.score,centerRmsMm:at(0).rmsMm,midRmsMm:at(.5).rmsMm,edgeRmsMm:edge.rmsMm,longitudinalColorMm:d.metrics.longitudinalColor,edgeLateralColorMm:edge.lateralChiefColorMm,edgeAstigmatismMm:edge.diagnosticFocus.astigmaticDifferenceMm,edgeFieldCurvatureMm:edge.diagnosticFocus.fieldCurvatureRelativeToAxisMm,minRayFraction:Math.min(...f.map(x=>x.rayFraction))};}
const results=[];
for(const [name,item]of [['reference',report.reference],['refined',report.bestRefined.best],['new',report.bestNew.best]]){
 const state=C.create(spec,operands,{source:'reference',budget:10000},item.system),fresh=C.validate(state,item);assert.equal(fresh.status,'DENSE VALIDATED');assert.equal(fresh.dense.score,item.dense.score);
 const holdout=X.dense(item.system,S.analysisSpec(spec),G.variables(item.system,spec),operands,23),job=S.makeJob({spec,operands,software:{}},{system:item.system,ordinal:0},4),sensitivities=[];
 for(let i=0;i<job.variables.length;i++){
  const v=job.variables[i],step=.001*(v.max-v.min),center=job.variables.map(v=>v.value),probes=[];
  for(const sign of [-1,1]){const vector=center.slice();vector[i]+=sign*step;if(vector[i]<v.min||vector[i]>v.max){probes.push({valid:false,reason:'parameter bound'});continue;}try{const d=E.evaluate(job,vector,true);probes.push({valid:S.compliance(d,spec).status==='DENSE VALIDATED',metrics:d.analysis?metrics(d):null});}catch(e){probes.push({valid:false,reason:e.message});}}
  const derivative=probes.every(p=>p.valid&&p.metrics)?Object.fromEntries(Object.keys(probes[0].metrics).map(k=>[k,(probes[1].metrics[k]-probes[0].metrics[k])/.002])):null;
  sensitivities.push({surface:v.surface,key:v.key,parameterUnit:'mm',normalizedStep:.001,physicalStepMm:step,derivativePerFullParameterSpan:derivative,probes});
 }
 const physical=[];for(const fNumber of [2,5.6])for(const field of [0,1]){const q=P.one(item.system,{fNumber,field,pupilGrid:64,maxPupilGrid:128,targetEflMm:50,imageCircleMm:46.3,verifyConvergence:true});physical.push(P.reportRecord(q));}
 results.push({name,prescriptionSHA256:crypto.createHash('sha256').update(JSON.stringify(item.system)).digest('hex'),dense:metrics(fresh.dense),checks:fresh.checks,holdout23:{metrics:metrics(holdout),compliance:S.compliance(holdout,spec)},apertures:compact(fresh.dense.apertureMetrics),sensitivities,physical});console.log(name,JSON.stringify(metrics(fresh.dense)));
}
const output={version:require('../package.json').version,build:globalThis.LB_BUILD,selection:'Frozen winners from omit50-challenge-v1.json; no post-selection tuning.',sensitivity:'Central differences at ±0.1% of each bounded parameter span, at fixed image plane and with original hard constraints. Local derivatives are not unique Seidel aberration contributions or tolerancing certification; invalid probes have null derivative. Existing DLS Jacobians guide search; these diagnostics explain the selected solutions.',accounting:'Post-selection analysis is separate from each 10000-evaluation optimization budget; 1 dense recheck + 1 holdout + 2 probes per variable + 4 physical configurations per prescription.',results};fs.writeFileSync('benchmarks/omit50-challenge-analysis.json',JSON.stringify(output,null,2)+'\n');
