/* Tier 5 only: explicit fixed sensor, independently sampled convergence check. */
(function(root){
 'use strict';
 const W=root.LBWavefront||require('./wavefront.js'),F=root.LBFourier||require('./fourier.js'),Z=root.LBZernike||require('./zernike.js');
 const VERSION='physical-1',UNAVAILABLE='UNAVAILABLE',EXPERIMENTAL='EXPERIMENTAL';
 function one(system,settings={}){
  const start=performance.now(),wavefront=W.sample(system,settings),result={schemaVersion:1,engineVersion:VERSION,name:system.name||'Lens',settings:wavefront.settings,wavefront,status:{opl:'VALIDATED',wavefront:wavefront.reasons.unmapped||wavefront.reasons['folded mapping']||wavefront.limitations.includes('Clear pupil reaches sampling boundary')?EXPERIMENTAL:'VALIDATED EIKONAL / SAMPLED PUPIL',psf:UNAVAILABLE,mtf:UNAVAILABLE,zernike:UNAVAILABLE,polychromatic:UNAVAILABLE,tStop:UNAVAILABLE,mtfMerit:UNAVAILABLE},limitations:wavefront.limitations.slice()};
  try{result.zernike=Z.fit(wavefront);result.status.zernike=result.zernike.status;}catch(e){result.limitations.push(e.message);}
  if(wavefront.diffractionEligible){
   result.diffraction=F.calculate(wavefront,settings);result.status.psf=result.status.mtf=EXPERIMENTAL;
   if(settings.verifyConvergence!==false&&wavefront.grid<=128){
    const fine=W.sample(system,{...settings,pupilGrid:wavefront.grid*2}),padding=settings.padding||4;
    if(fine.diffractionEligible&&fine.grid*padding<=1024){
     const d=F.calculate(fine,{padding}),coarse=result.diffraction,frequencies=[20,40,80],mtfDelta=Math.max(...frequencies.flatMap(f=>['tangential','sagittal'].map(axis=>(()=>{const a=F.sampleCurve(d.otf[axis],f),b=F.sampleCurve(coarse.otf[axis],f);return a===null||b===null?Infinity:Math.abs(a-b);})()))),rmsDelta=Math.abs(fine.rmsWaves-wavefront.rmsWaves),strehlDelta=Math.abs(d.strehl-coarse.strehl),eeDelta=Math.abs(d.encircledEnergy[0].energy-coarse.encircledEnergy[0].energy);
     const passed=rmsDelta<=.001+.02*fine.rmsWaves&&mtfDelta<=.02&&strehlDelta<=.02&&eeDelta<=.02;
     result.convergence={coarseGrid:wavefront.grid,fineGrid:fine.grid,rmsDeltaWaves:rmsDelta,maxMtfDelta:mtfDelta,strehlDelta,airyEnergyDelta:eeDelta,passed,meaning:'Resolution comparison, not a proof of continuous accuracy'};
     if(passed&&wavefront.status==='VALIDATED SCALAR/PARAXIAL REGIME'&&fine.status===wavefront.status)result.status.psf=result.status.mtf='VALIDATED SCALAR/PARAXIAL REGIME';
     if(!passed)result.limitations.push('Convergence tolerance not met; increase pupil grid');
    }else result.limitations.push('Finer convergence sample unresolved or exceeds FFT size limit');
   }else result.limitations.push('Per-prescription convergence not verified');
  }
  if(wavefront.settings.field!==0)result.limitations.push('PSF coordinates lie in chief-normal image plane; oblique sensor projection and pupil apodization are unvalidated');
  result.elapsedMs=performance.now()-start;return result;
 }
 function batch(system,config={}){
  const fields=config.fields||[config.field??0],apertures=config.apertures||[config.fNumber],wavelengths=config.wavelengths||[{nm:config.nm||587.5618,weight:1}];
  if(!Array.isArray(fields)||!Array.isArray(apertures)||!Array.isArray(wavelengths)||!fields.length||!apertures.length||!wavelengths.length||fields.length*apertures.length*wavelengths.length>72)throw Error('Select 1–72 analysis configurations');
  if(wavelengths.some(w=>!Number.isFinite(w.nm)||!Number.isFinite(w.weight)||w.weight<0)||!wavelengths.some(w=>w.weight>0))throw Error('Invalid spectral weights');
  const count=fields.length*apertures.length*wavelengths.filter(w=>w.weight>0).length,n=config.pupilGrid||32,m=n*(config.padding||4);
  if(count*(24*m*m+128*n*n)>192*1024*1024)throw Error('Analysis exceeds the 192 MiB retained-result estimate; reduce configurations or sampling');
  const start=performance.now(),results=[];
  for(const fNumber of apertures)for(const field of fields)for(const {nm,weight}of wavelengths){if(!weight)continue;try{results.push(one(system,{...config,field,fNumber,nm}));}catch(e){results.push({settings:{...config,field,fNumber,nm},status:{opl:UNAVAILABLE,wavefront:UNAVAILABLE,psf:UNAVAILABLE,mtf:UNAVAILABLE},error:e.message});}}
  return {schemaVersion:1,engineVersion:VERSION,system:structuredClone(system),config:structuredClone(config),results,polychromatic:{status:UNAVAILABLE,reason:'Spectral intensity registration and resampling are not yet validated. Results are separate monochromatic wavelengths; no MTF averaging.'},focusPolicy:config.focusPolicy||'fixed-prescription',elapsedMs:performance.now()-start};
 }
 function focusScan(system,config,offsets){
  if(!Array.isArray(offsets)||offsets.length<3||offsets.length>17||offsets.some(x=>!Number.isFinite(x)))throw Error('Supply 3–17 finite global focus offsets');
  const fields=config.fields||[0],wavelengths=config.wavelengths||[{nm:config.nm||587.5618,weight:1}],apertures=config.apertures||[config.fNumber];
  const trials=offsets.map(imageShiftMm=>{let sum=0,weight=0;try{for(const field of fields)for(const fNumber of apertures)for(const w of wavelengths){if(!(w.weight>0))continue;const q=W.sample(system,{...config,field,fNumber,nm:w.nm,pupilGrid:32,focusPolicy:'global-image-shift',imageShiftMm});if(q.reasons.unmapped||q.reasons['folded mapping'])throw Error('Unmapped pupil');sum+=q.rmsWaves**2*w.weight;weight+=w.weight;}if(!weight)throw Error('No positive spectral weight');return {imageShiftMm,rmsWaves:Math.sqrt(sum/weight)};}catch(e){return {imageShiftMm,error:e.message,rmsWaves:null};}});
  const valid=trials.filter(x=>x.rmsWaves!==null).sort((a,b)=>a.rmsWaves-b.rmsWaves);return {status:'EXPERIMENTAL DIAGNOSTIC',objective:'Minimum weighted mean-square wavefront error over one shared image shift; finite 32² pupil and discrete offsets',trials,best:valid[0]||null,applied:false};
 }
 function requestRecord(system,config){W.settings(config);return {schemaVersion:1,engineVersion:VERSION,kind:'physical-analysis-request',system:structuredClone(system),config:structuredClone(config)};}
 function restore(record){if(record?.schemaVersion!==1||record?.engineVersion!==VERSION||record?.kind!=='physical-analysis-request')throw Error('Unsupported physical request schema');return requestRecord(record.system,record.config);}
 function comparisonWarnings(records){if(records.length<2)return [];const warnings=[],first=records[0];for(const r of records.slice(1)){if(JSON.stringify(r.config)!==JSON.stringify(first.config))warnings.push('Different sampling, wavelength, field, aperture or focus configuration; re-run with shared settings');const image=s=>s.surfaces.slice(1,-1).reduce((a,x)=>a+x.t,0);if(Math.abs(image(r.system)-image(first.system))>1e-9)warnings.push('Different prescription image-plane coordinates: fixed focus is relative to each lens, not a common bench position');}return [...new Set(warnings)];}
 const api={VERSION,one,batch,focusScan,requestRecord,restore,comparisonWarnings};root.LBPhysical=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
