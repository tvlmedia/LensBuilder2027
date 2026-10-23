/* Incoherent integration of registered, cell-integrated intensity on one mm grid.
   Conservative rectangular overlap, not interpolation of wrapped complex phase. */
(function(root){
 'use strict';
 const F=root.LBFourier||require('./fourier.js');
 function weights(input){if(!Array.isArray(input)||!input.length||input.some(x=>!Number.isFinite(x.nm)||x.nm<400||x.nm>700||!Number.isFinite(x.weight)||x.weight<0))throw Error('Invalid spectral weights');const sum=input.reduce((s,w)=>s+w.weight,0);if(!(sum>0))throw Error('Spectral weight sum must be positive');return input.map(w=>({nm:w.nm,weight:w.weight/sum}));}
 function sensorTransform(reference){const cosine=reference.axis.x;if(!(cosine>0&&cosine<=1+1e-12))throw Error('Unsupported chief direction for sensor projection');return {scaleX:1/cosine,scaleY:1,chiefXMm:reference.image.y,chiefYMm:reference.image.z,incidenceRad:Math.acos(Math.min(1,cosine)),status:Math.abs(cosine-1)<1e-12?'IDENTITY':'EXPERIMENTAL AFFINE RAY-TUBE PROJECTION',limitation:'Affine tangent-plane transport preserves area; does not include diffraction propagation to an oblique sensor or obliquity-dependent amplitude'};}
 function overlaps(sourceN,sourcePitch,offset,targetN,targetPitch){
  const out=[];for(let i=0;i<sourceN;i++){const center=(i-sourceN/2)*sourcePitch+offset,lo=center-sourcePitch/2,hi=center+sourcePitch/2,first=Math.max(0,Math.floor(lo/targetPitch+targetN/2+.5)),last=Math.min(targetN-1,Math.floor(hi/targetPitch+targetN/2+.5)),cells=[];for(let j=first;j<=last;j++){const left=(j-targetN/2-.5)*targetPitch,right=left+targetPitch,part=Math.max(0,Math.min(hi,right)-Math.max(lo,left))/sourcePitch;if(part>0)cells.push([j,part]);}out.push(cells);}return out;
 }
 function resample(source,target){
  const {grid:n,psf,pitchMm,offsetXMm=0,offsetYMm=0,scaleX=1,scaleY=1}=source,m=target.grid,p=target.pitchMm;
  if(!Number.isInteger(n)||n<2||psf.length!==n*n||![pitchMm,p,scaleX,scaleY].every(v=>Number.isFinite(v)&&v>0)||![offsetXMm,offsetYMm].every(Number.isFinite)||!Number.isInteger(m)||m<2||m>2048)throw Error('Invalid spectral image geometry');
  const xs=overlaps(n,pitchMm*scaleX,offsetXMm,m,p),ys=overlaps(n,pitchMm*scaleY,offsetYMm,m,p),result=new Float64Array(m*m);let input=0;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){const e=psf[y*n+x];if(!Number.isFinite(e)||e<0)throw Error('PSF intensity must be finite and nonnegative');input+=e;if(e===0)continue;for(const [j,wy]of ys[y])for(const [i,wx]of xs[x])result[j*m+i]+=e*wx*wy;}
  const output=result.reduce((s,v)=>s+v,0);return {psf:result,inputEnergy:input,outputEnergy:output,lostEnergy:Math.max(0,input-output),relativeConservationError:Math.abs(output-input)/Math.max(input,1e-300)};
 }
 function moments(psf,n,pitch){let energy=0,x=0,y=0,peak=0,edge=0;for(let j=0;j<n;j++)for(let i=0;i<n;i++){const e=psf[j*n+i];energy+=e;x+=e*(i-n/2)*pitch;y+=e*(j-n/2)*pitch;peak=Math.max(peak,e);if(i<n*.05||j<n*.05||i>=n*.95||j>=n*.95)edge+=e;}if(!(energy>0))throw Error('Empty PSF');x/=energy;y/=energy;let variance=0;for(let j=0;j<n;j++)for(let i=0;i<n;i++)variance+=psf[j*n+i]*(((i-n/2)*pitch-x)**2+((j-n/2)*pitch-y)**2);return {energy,centroidXMm:x,centroidYMm:y,rmsRadiusMm:Math.sqrt(variance/energy),peakDensityPerMm2:peak/(pitch*pitch),outerWindowEnergyFraction:edge/energy};}
 function combine(channels,options={}){
  const start=performance.now();if(!channels.length)throw Error('No spectral channels');const normalized=weights(channels),active=channels.map((c,i)=>({...c,weight:normalized[i].weight})).filter(c=>c.weight>0),reference=options.referenceImageMm||{x:active[0].chiefXMm||0,y:active[0].chiefYMm||0};
  if(!Number.isFinite(reference.x)||!Number.isFinite(reference.y))throw Error('Invalid image registration origin');
  let pitch=options.pitchMm||Math.min(...active.map(c=>c.pitchMm*Math.min(c.scaleX||1,c.scaleY||1))),extent=0;
  for(const c of active){for(const [shift,scale]of [[(c.chiefXMm||0)-reference.x,c.scaleX||1],[(c.chiefYMm||0)-reference.y,c.scaleY||1]])extent=Math.max(extent,Math.abs(shift)+(c.grid/2+.5)*c.pitchMm*scale);}
  let n=options.grid||2**Math.ceil(Math.log2(2*extent/pitch+2));
  if(!Number.isFinite(pitch)||pitch<=0||!Number.isInteger(n)||n<16||(n&(n-1))||n>2048)throw Error('Common image grid exceeds 2048² or has invalid pitch; choose an explicit coarser grid');
  const limit=options.memoryLimitMiB??512;if(!Number.isFinite(limit)||limit<32||limit>1024)throw Error('Invalid spectral memory limit');
  const memory=64*n*n+active.reduce((s,c)=>s+24*c.grid*c.grid,0);if(memory>limit*1048576)throw Error('Spectral memory estimate exceeds limit');
  const psf=new Float64Array(n*n),reports=[];let maxLoss=0;
  for(const c of active){const r=resample({...c,offsetXMm:(c.chiefXMm||0)-reference.x,offsetYMm:(c.chiefYMm||0)-reference.y},{grid:n,pitchMm:pitch});if(Math.abs(r.inputEnergy-1)>1e-8)throw Error('Spectral inputs must have unit energy');for(let i=0;i<psf.length;i++)psf[i]+=c.weight*r.psf[i];maxLoss=Math.max(maxLoss,r.lostEnergy);reports.push({nm:c.nm,weight:c.weight,chiefXMm:c.chiefXMm||0,chiefYMm:c.chiefYMm||0,sourcePitchMm:c.pitchMm,scaleX:c.scaleX||1,scaleY:c.scaleY||1,inputEnergy:r.inputEnergy,outputEnergy:r.outputEnergy,lostEnergy:r.lostEnergy});}
  // Never normalize away flux lost by a user-chosen image window.
  if(maxLoss>1e-8)throw Error(`Common grid truncates spectral energy (${maxLoss}); enlarge its physical extent`);
  const otf=F.transfer(psf,n,pitch),stats=moments(psf,n,pitch);return {grid:n,pitchMm:pitch,psf,otf,moments:stats,referenceImageMm:reference,channels:reports,encircledEnergy:F.encircled(psf,n,pitch,[.005,.01,.025,.05,.1]),resampling:{method:'Conservative area overlap of finite-volume intensity cells',energyError:Math.abs(1-stats.energy),maxChannelLostEnergy:maxLoss,shapeError:'Requires source-pupil and Fourier-padding refinement; energy conservation alone is not shape convergence'},weightConvention:'Normalized integrated image spectral energy; no calibrated camera response or coatings',estimatedArrayBytes:memory,elapsedMs:performance.now()-start};
 }
 const api={weights,sensorTransform,overlaps,resample,moments,combine};root.LBSpectrum=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
