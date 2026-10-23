/* Recheck existing physical values while auditing diagnostic-only changes. */
const fs=require('node:fs'),assert=require('node:assert/strict');
const E=require('../physical/engine');
const baseline=require('../benchmarks/advanced-physical-v1.json');
const omit=require('../benchmarks/physical-omit50.json').system;
const singlet=require('../benchmarks/optical-suite-v1.json').cases.find(x=>x.id==='analytic-singlet').system;
const cases=baseline.omit50.fieldApertures.map(before=>{
 const after=E.one(omit,before.settings);
 const rmsDelta=Math.abs(after.wavefront.rmsWaves-before.wavefront.rmsWaves);
 const pvDelta=Math.abs(after.wavefront.pvWaves-before.wavefront.pvWaves);
 assert.equal(rmsDelta,0);assert.equal(pvDelta,0);assert.deepEqual(after.status,before.status);
 return {field:after.settings.field,fNumber:after.settings.fNumber,rmsDelta,pvDelta,status:after.status.psf,previousReportedBacktracks:before.wavefront.diagnostics.backtracks,allAttemptBacktracks:after.wavefront.diagnostics.backtracks,samplingTermination:after.samplingTermination};
});
const diagnostics=[{maxPupilGrid:64},{maxPupilGrid:256,memoryLimitMiB:32},{maxPupilGrid:128}].map(config=>{
 const r=E.one(singlet,{fNumber:16,pupilGrid:32,allowApproximateMaterials:true,...config});
 return {config,status:r.confidence,samplingTermination:r.samplingTermination,convergenceComparisons:r.convergenceComparisons};
});
const report={version:require('../package.json').version,build:globalThis.LB_BUILD,reference:'advanced-physical-v1.json (0.8.0)',cases,diagnostics};
fs.writeFileSync('benchmarks/physical-diagnostics-v1.json',JSON.stringify(report,null,2)+'\n');
console.log(`Rechecked ${cases.length} physical configurations: exact RMS/PV and status agreement; retained ${diagnostics.length} termination examples.`);
