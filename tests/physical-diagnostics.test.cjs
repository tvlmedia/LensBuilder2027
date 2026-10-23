const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../physical/engine');
const W=require('../physical/wavefront');
const singlet=require('../benchmarks/optical-suite-v1.json').cases.find(x=>x.id==='analytic-singlet').system;
const base={fNumber:16,pupilGrid:32,allowApproximateMaterials:true};

test('grid exhaustion retains failed comparison without applying it to a different returned grid',()=>{
 const r=E.one(singlet,{...base,maxPupilGrid:64});
 assert.equal(r.wavefront.grid,64);
 assert.equal(r.confidence.numerical,'NOT CONVERGED');
 assert.equal(r.convergence,null);
 assert.equal(r.samplingTermination.code,'PUPIL_LIMIT');
 assert.equal(r.samplingTermination.requiredReferenceGrid,128);
 assert.equal(r.convergenceComparisons.length,1);
 const last=r.convergenceComparisons[0];
 assert.equal(last.coarseGrid,32);assert.equal(last.fineGrid,64);assert.equal(last.passed,false);
 assert.ok(last.pupil.distributionL1>0);
 assert.deepEqual(E.reportRecord({results:[r]}).results[0].convergenceComparisons,r.convergenceComparisons);
});
test('allocation-blocked refinement retains earlier errors and distinguishes the missing reference',()=>{
 const r=E.one(singlet,{...base,maxPupilGrid:256,memoryLimitMiB:32});
 assert.equal(r.samplingTermination.code,'REFERENCE_UNAVAILABLE');
 assert.match(r.samplingTermination.reason,/memory/);
 assert.equal(r.samplingTermination.requiredReferenceGrid,128);
 assert.equal(r.convergenceComparisons.length,1);
 assert.equal(r.confidence.numerical,'NOT CONVERGED');
});
test('disabled verification and successful verification have explicit distinct termination reasons',()=>{
 const disabled=E.one(singlet,{...base,verifyConvergence:false});
 assert.equal(disabled.samplingTermination.code,'VERIFICATION_DISABLED');
 assert.deepEqual(disabled.convergenceComparisons,[]);
 const passed=E.one(singlet,{...base,maxPupilGrid:128});
 assert.equal(passed.samplingTermination.code,'CONVERGED');
 assert.equal(passed.convergenceComparisons.at(-1).passed,true);
 assert.equal(passed.convergenceComparisons.at(-1),passed.convergence);
 assert.equal(passed.confidence.numerical,'CONVERGED');
});
test('failed inverse mappings contribute retry diagnostics without filling missing samples',()=>{
 const omit=require('../benchmarks/physical-omit50.json').system;
 const r=W.sample(omit,{fNumber:2,field:1,pupilGrid:32,imageCircleMm:46.3});
 assert.ok(r.reasons.unmapped>0);assert.ok(r.diagnostics.backtracks>0);
 assert.equal(r.diffractionEligible,false);
 for(let i=0;i<r.mask.length;i++)if(!r.mask[i])assert.equal(r.rawOpdMm[i],null);
 assert.equal(Object.values(r.diagnostics.failureDetails).reduce((s,n)=>s+n,0),r.mask.length-r.validSamples);
});
