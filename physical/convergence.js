(function(root){
 'use strict';
 const F=root.LBFourier||require('./fourier.js'),S=root.LBSpectrum||require('./spectrum.js');
 const DEFAULTS={mtf:.02,strehl:.02,energy:.02,rmsAbsoluteWaves:.001,rmsRelative:.02,distributionL1:.05,centroidPixels:.25,widthRelative:.05,peakRelative:.05};
 function tolerances(raw={}){const out={...DEFAULTS};for(const [key,v]of Object.entries(raw)){if(!(key in out)||!Number.isFinite(v)||v<=0||v>DEFAULTS[key])throw Error('Convergence tolerances may only tighten documented defaults');out[key]=v;}return out;}
 function compare(a,b,raw={}){
  const t=tolerances(raw),aligned=S.resample(b,{grid:a.grid,pitchMm:a.pitchMm}),radius=Math.max(.05,5*(a.airyRadiusMm||0));
  const window=psf=>Float64Array.from(psf,(v,i)=>Math.hypot(i%a.grid-a.grid/2,Math.floor(i/a.grid)-a.grid/2)*a.pitchMm<=radius?v:0),ma=S.moments(window(a.psf),a.grid,a.pitchMm),mb=S.moments(window(aligned.psf),a.grid,a.pitchMm);
  let l1=0;for(let i=0;i<a.psf.length;i++)l1+=Math.abs(a.psf[i]-aligned.psf[i]);
  const centroidMm=Math.hypot(ma.centroidXMm-mb.centroidXMm,ma.centroidYMm-mb.centroidYMm),widthRelative=Math.abs(ma.rmsRadiusMm-mb.rmsRadiusMm)/Math.max(ma.rmsRadiusMm,mb.rmsRadiusMm,a.pitchMm),peakRelative=Math.abs(ma.peakDensityPerMm2-mb.peakDensityPerMm2)/Math.max(ma.peakDensityPerMm2,mb.peakDensityPerMm2),mtfDelta=Math.max(...[20,40,80].flatMap(f=>['tangential','sagittal'].map(axis=>{const x=F.sampleCurve(a.otf[axis],f),y=F.sampleCurve(b.otf[axis],f);return x===null||y===null?Infinity:Math.abs(x-y);}))),strehlDelta=a.strehl===undefined||b.strehl===undefined?null:Math.abs(a.strehl-b.strehl);
  const radii=[.005,.01,.025,.05],ea=F.encircled(a.psf,a.grid,a.pitchMm,radii),eb=F.encircled(b.psf,b.grid,b.pitchMm,radii),energyDelta=Math.max(...ea.map((v,i)=>Math.abs(v.energy-eb[i].energy))),passed=l1<=t.distributionL1&&centroidMm<=t.centroidPixels*a.pitchMm&&widthRelative<=t.widthRelative&&peakRelative<=t.peakRelative&&mtfDelta<=t.mtf&&(strehlDelta===null||strehlDelta<=t.strehl)&&energyDelta<=t.energy&&aligned.lostEnergy<=t.energy;
  return {passed,distributionL1:l1,centroidDeltaMm:centroidMm,widthRelative,peakRelative,maxMtfDelta:mtfDelta,strehlDelta,maxEnergyDelta:energyDelta,fineEnergyOutsideComparisonWindow:aligned.lostEnergy,tolerances:t,momentRadiusMm:radius,comparisonWindow:'L1 on coarse image window; centroid and RMS width within common radius max(50 µm, five nominal Airy radii). Airy full-plane second moments diverge.'};
 }
 const api={DEFAULTS,tolerances,compare};root.LBPhysicalConvergence=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
