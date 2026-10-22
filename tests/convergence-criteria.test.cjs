const {test}=require('node:test'),a=require('node:assert/strict');
const C=require('../physical/convergence'),F=require('../physical/fourier'),S=require('../physical/spectrum'),pupil=require('./reference/pupil.cjs');
test('criterion reports reproduce the existing multi-metric acceptance rule',()=>{
 const clear=F.calculate(pupil(32)),fine=F.calculate(pupil(64)),defocus=F.calculate(pupil(32,(x,y)=>.3*(x*x+y*y)));
 for(const other of [clear,fine,defocus]){
  const r=C.compare(clear,other),t=r.tolerances;
  const old=r.distributionL1<=t.distributionL1&&r.centroidDeltaMm<=t.centroidPixels*clear.pitchMm&&r.widthRelative<=t.widthRelative&&r.peakRelative<=t.peakRelative&&r.maxMtfDelta<=t.mtf&&r.strehlDelta<=t.strehl&&r.maxEnergyDelta<=t.energy&&r.fineEnergyOutsideComparisonWindow<=t.energy;
  a.equal(r.passed,old);a.equal(r.passed,r.checks.every(c=>c.status!=='FAIL'));
  a.equal(r.checks.filter(c=>c.metric.startsWith('MTF ')).length,6);
  a.deepEqual(r.failureReasons,r.checks.filter(c=>c.status==='FAIL').map(c=>c.metric));
 }
});
test('missing MTF frequency remains a failed unavailable measurement after JSON export',()=>{
 const clear=F.calculate(pupil(32)),short={...clear,otf:{...clear.otf,tangential:clear.otf.tangential.filter(p=>p.frequencyLpMm<40)}};
 const r=JSON.parse(JSON.stringify(C.compare(clear,short))),failed=r.checks.find(c=>c.metric==='MTF tangential at 80 lp/mm');
 a.equal(failed.status,'FAIL');a.equal(failed.value,null);a.match(failed.reason,/frequency range/);a.equal(r.passed,false);
 a.equal(r.checks.find(c=>c.metric==='MTF sagittal at 80 lp/mm').status,'PASS');
});
test('undefined spectral Strehl is explicitly not applicable rather than a zero-error pass',()=>{
 const clear=F.calculate(pupil(32)),spectral={...clear,strehl:undefined};
 const r=C.compare(spectral,spectral),strehl=r.checks.find(c=>c.metric==='Direct Strehl change');
 a.equal(strehl.status,'NOT APPLICABLE');a.equal(strehl.value,null);a.equal(r.passed,true);
});
test('known intensity displacement fails centroid tolerance in physical units',()=>{
 const clear=F.calculate(pupil(64)),shift=.01;
 const shifted=S.resample({...clear,offsetXMm:shift},{grid:clear.grid,pitchMm:clear.pitchMm});
 const b={...clear,psf:shifted.psf,otf:F.transfer(shifted.psf,clear.grid,clear.pitchMm)};
 const r=C.compare(clear,b),c=r.checks.find(x=>x.metric==='Centroid displacement');
 a.equal(c.status,'FAIL');a.equal(c.unit,'mm');a.equal(c.limit,C.DEFAULTS.centroidPixels*clear.pitchMm);a.ok(c.value>.005);
});
