/* Scalar paraxial Fraunhofer diffraction. Cartesian pupil, mm and nm. */
(function(root){
 'use strict';
 const VERSION='scalar-fft-2',L=root.LBPhysicalLimits||require('./limits.js');
 function fft(re,im,inverse=false){
  const n=re.length;if(n<2||(n&(n-1))||im.length!==n)throw Error('FFT requires equal power-of-two arrays');
  for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];}}
  for(let len=2;len<=n;len*=2){const angle=(inverse?2:-2)*Math.PI/len,cr=Math.cos(angle),ci=Math.sin(angle);for(let i=0;i<n;i+=len){let wr=1,wi=0;for(let j=0;j<len/2;j++){const a=i+j,b=a+len/2,tr=wr*re[b]-wi*im[b],ti=wr*im[b]+wi*re[b];re[b]=re[a]-tr;im[b]=im[a]-ti;re[a]+=tr;im[a]+=ti;const nr=wr*cr-wi*ci;wi=wr*ci+wi*cr;wr=nr;}}}
  if(inverse)for(let i=0;i<n;i++){re[i]/=n;im[i]/=n;}return {re,im};
 }
 function fft2(re,im,n,inverse=false){
  if(re.length!==n*n||im.length!==n*n)throw Error('Invalid 2D FFT dimensions');
  const r=new Float64Array(n),q=new Float64Array(n);
  for(let y=0;y<n;y++){r.set(re.subarray(y*n,(y+1)*n));q.set(im.subarray(y*n,(y+1)*n));fft(r,q,inverse);re.set(r,y*n);im.set(q,y*n);}
  for(let x=0;x<n;x++){for(let y=0;y<n;y++){r[y]=re[y*n+x];q[y]=im[y*n+x];}fft(r,q,inverse);for(let y=0;y<n;y++){re[y*n+x]=r[y];im[y*n+x]=q[y];}}return {re,im};
 }
 function shift(values,n){const out=new Float64Array(n*n);for(let y=0;y<n;y++)for(let x=0;x<n;x++)out[((y+n/2)%n)*n+(x+n/2)%n]=values[y*n+x];return out;}
 function transfer(psf,n,pitchMm){
  const start=performance.now(),re=shift(psf,n),im=new Float64Array(n*n);fft2(re,im,n);const dc=re[0];if(!(dc>0))throw Error('PSF has no energy');
  for(let i=0;i<re.length;i++){re[i]/=dc;im[i]/=dc;}
  const step=1/(n*pitchMm),tangential=[],sagittal=[];
  for(let k=0;k<=n/2;k++){const metric=i=>({frequencyLpMm:k*step,mtf:Math.hypot(re[i],im[i]),ptfRad:Math.atan2(im[i],re[i]),real:re[i],imag:im[i]});tangential.push(metric(k));sagittal.push(metric(k*n));}
  return {real:re,imag:im,tangential,sagittal,frequencyStepLpMm:step,elapsedMs:performance.now()-start};
 }
 function encircled(psf,n,pitchMm,radiiMm){return radiiMm.map(radius=>{let energy=0;for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(Math.hypot(x-n/2,y-n/2)*pitchMm<=radius)energy+=psf[y*n+x];return {radiusMm:radius,energy};});}
 function circularMTF(nu){return nu>=1?0:nu<=0?1:2/Math.PI*(Math.acos(nu)-nu*Math.sqrt(1-nu*nu));}
 function sampleCurve(curve,f){if(!Number.isFinite(f)||f<0)throw Error('Frequency must be nonnegative');if(f>curve.at(-1).frequencyLpMm)return null;const step=curve[1].frequencyLpMm,k=Math.min(curve.length-2,Math.floor(f/step)),t=(f-curve[k].frequencyLpMm)/step;return curve[k].mtf*(1-t)+curve[k+1].mtf*t;}
 function calculate(w,{padding=4,memoryLimitMiB=512}={}){
  const start=performance.now(),n=w.grid;L.check(n,padding,{memoryLimitMiB});
  if(w.mask.length!==n*n||w.opdWaves.length!==n*n||!(w.pupilWidthMm>0&&w.reference.radiusMm>0&&w.settings.nm>0))throw Error('Invalid pupil dimensions or physical scale');
  if(!w.diffractionEligible)throw Error('Diffraction unavailable: unresolved pupil sampling');
  const m=n*padding,offset=(m-n)/2,re=new Float64Array(m*m),im=new Float64Array(m*m);let count=0;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){const j=y*n+x;if(w.mask[j]){if(!Number.isFinite(w.opdWaves[j]))throw Error('Nonfinite pupil phase');const i=(y+offset)*m+x+offset,phase=2*Math.PI*w.opdWaves[j];re[i]=Math.cos(phase);im[i]=Math.sin(phase);count++;}}
  if(!count)throw Error('Empty pupil');fft2(re,im,m);const intensity=new Float64Array(m*m);let total=0,peak=0;
  for(let i=0;i<intensity.length;i++){intensity[i]=re[i]**2+im[i]**2;total+=intensity[i];peak=Math.max(peak,intensity[i]);}
  // Parseval sum = M² * clear cell count. Same-support flat-phase peak = count².
  for(let i=0;i<intensity.length;i++)intensity[i]/=total;
  const psf=shift(intensity,m),waveMm=w.settings.nm*1e-6,pitchMm=waveMm*w.reference.radiusMm/(m*w.pupilWidthMm/n),imageFNumber=w.reference.radiusMm/(2*w.pupilRadiusMm),airyRadiusMm=1.219669891*waveMm*imageFNumber;
  const psfMs=performance.now()-start,otf=transfer(psf,m,pitchMm),ee=encircled(psf,m,pitchMm,[airyRadiusMm,2*airyRadiusMm,5*airyRadiusMm,.005,.01,.025,.05]);
  return {schemaVersion:1,engineVersion:VERSION,grid:m,padding,pitchMm,psf,otf,encircledEnergy:ee,strehl:peak/(count*count),peakDensityPerMm2:peak/total/(pitchMm*pitchMm),normalization:'Unit total discrete energy; density = pixel energy / pixel area',imageFNumber,nominalCircularCutoffLpMm:1/(waveMm*imageFNumber),airyRadiusMm,parsevalRelativeError:Math.abs(total/(m*m*count)-1),psfMs,mtfMs:otf.elapsedMs,pupilAreaMm2:count*(w.pupilWidthMm/n)**2,relativeNominalPupilArea:count*(w.pupilWidthMm/n)**2/(Math.PI*w.pupilRadiusMm**2),estimatedArrayBytes:8*m*m*6};
 }
 const api={VERSION,fft,fft2,shift,transfer,encircled,circularMTF,sampleCurve,calculate};root.LBFourier=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
