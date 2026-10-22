(function(root){
 'use strict';
 const F=root.LBFourier||require('./fourier.js'),S=root.LBSpectrum||require('./spectrum.js');
 const DEFAULTS={mtf:.02,strehl:.02,energy:.02,rmsAbsoluteWaves:.001,rmsRelative:.02,distributionL1:.05,centroidPixels:.25,widthRelative:.05,peakRelative:.05};
 function tolerances(raw={}){const out={...DEFAULTS};for(const [key,v]of Object.entries(raw)){if(!(key in out)||!Number.isFinite(v)||v<=0||v>DEFAULTS[key])throw Error('Convergence tolerances may only tighten documented defaults');out[key]=v;}return out;}
 function criterion(metric,value,limit,unit='',optional=false){
  const applicable=!(optional&&value===null),finite=Number.isFinite(value);
  return {metric,value:finite?value:null,limit,unit,status:!applicable?'NOT APPLICABLE':finite&&value<=limit?'PASS':'FAIL',reason:!applicable?'Not defined for this comparison':!finite?'Required measurement unavailable (for MTF, check the sampled frequency range)':''};
 }
 function compare(a,b,raw={}){
  const t=tolerances(raw),aligned=S.resample(b,{grid:a.grid,pitchMm:a.pitchMm}),radius=Math.max(.05,5*(a.airyRadiusMm||0));
  const window=psf=>Float64Array.from(psf,(v,i)=>Math.hypot(i%a.grid-a.grid/2,Math.floor(i/a.grid)-a.grid/2)*a.pitchMm<=radius?v:0);
  const ma=S.moments(window(a.psf),a.grid,a.pitchMm),mb=S.moments(window(aligned.psf),a.grid,a.pitchMm);
  let l1=0;for(let i=0;i<a.psf.length;i++)l1+=Math.abs(a.psf[i]-aligned.psf[i]);
  const centroidMm=Math.hypot(ma.centroidXMm-mb.centroidXMm,ma.centroidYMm-mb.centroidYMm);
  const widthRelative=Math.abs(ma.rmsRadiusMm-mb.rmsRadiusMm)/Math.max(ma.rmsRadiusMm,mb.rmsRadiusMm,a.pitchMm);
  const peakRelative=Math.abs(ma.peakDensityPerMm2-mb.peakDensityPerMm2)/Math.max(ma.peakDensityPerMm2,mb.peakDensityPerMm2);
  const mtfChecks=[20,40,80].flatMap(f=>['tangential','sagittal'].map(axis=>{
   const x=F.sampleCurve(a.otf[axis],f),y=F.sampleCurve(b.otf[axis],f);
   return criterion(`MTF ${axis} at ${f} lp/mm`,x===null||y===null?Infinity:Math.abs(x-y),t.mtf);
  }));
  const mtfDelta=Math.max(...mtfChecks.map(c=>c.value===null?Infinity:c.value));
  const strehlDelta=a.strehl===undefined||b.strehl===undefined?null:Math.abs(a.strehl-b.strehl);
  const radii=[.005,.01,.025,.05],ea=F.encircled(a.psf,a.grid,a.pitchMm,radii),eb=F.encircled(b.psf,b.grid,b.pitchMm,radii);
  const energyChecks=ea.map((v,i)=>criterion(`Encircled energy at ${radii[i]*1000} µm`,Math.abs(v.energy-eb[i].energy),t.energy));
  const energyDelta=Math.max(...energyChecks.map(c=>c.value===null?Infinity:c.value));
  const checks=[criterion('PSF distribution L1',l1,t.distributionL1),criterion('Centroid displacement',centroidMm,t.centroidPixels*a.pitchMm,'mm'),criterion('Relative RMS width change',widthRelative,t.widthRelative),criterion('Relative peak change',peakRelative,t.peakRelative),criterion('Direct Strehl change',strehlDelta,t.strehl,'',true),...mtfChecks,...energyChecks,criterion('Fine energy outside comparison window',aligned.lostEnergy,t.energy)];
  const passed=checks.every(c=>c.status!=='FAIL');
  return {passed,checks,failureReasons:checks.filter(c=>c.status==='FAIL').map(c=>c.metric),distributionL1:l1,centroidDeltaMm:centroidMm,widthRelative,peakRelative,maxMtfDelta:mtfDelta,strehlDelta,maxEnergyDelta:energyDelta,fineEnergyOutsideComparisonWindow:aligned.lostEnergy,tolerances:t,momentRadiusMm:radius,comparisonWindow:'L1 on coarse image window; centroid and RMS width within common radius max(50 µm, five nominal Airy radii). Airy full-plane second moments diverge.'};
 }
 const api={DEFAULTS,tolerances,criterion,compare};root.LBPhysicalConvergence=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
