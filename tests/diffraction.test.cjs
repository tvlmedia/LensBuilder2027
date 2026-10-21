const {test}=require('node:test'),a=require('node:assert/strict'),F=require('../physical/fourier'),Z=require('../physical/zernike'),pupil=require('./reference/pupil.cjs');
const near=(x,y,t)=>a.ok(Math.abs(x-y)<t,`${x} != ${y}, tolerance ${t}`);
function j1(x){let t=x/2,s=t;for(let k=1;k<60;k++){t*=-x*x/(4*k*(k+1));s+=t;if(Math.abs(t)<1e-16)break;}return s;}
test('radix-2 complex FFT matches independent direct DFT and inverts',()=>{
 const n=16,r=Float64Array.from({length:n},(_,i)=>Math.sin(i*.73)),q=Float64Array.from({length:n},(_,i)=>Math.cos(i*.27)),sr=r.slice(),si=q.slice();F.fft(r,q);
 for(let k=0;k<n;k++){let re=0,im=0;for(let j=0;j<n;j++){const v=-2*Math.PI*k*j/n;re+=sr[j]*Math.cos(v)-si[j]*Math.sin(v);im+=sr[j]*Math.sin(v)+si[j]*Math.cos(v);}near(r[k],re,1e-12);near(q[k],im,1e-12);}F.fft(r,q,true);for(let i=0;i<n;i++){near(r[i],sr[i],1e-13);near(q[i],si[i],1e-13);}
});
test('clear circular diffraction has Airy profile, first minimum, energy and direct Strehl',()=>{
 const w=pupil(128),r=F.calculate(w,{padding:8}),n=r.grid,center=n*n/2+n/2,peak=r.psf[center];near(r.strehl,1,1e-12);near(r.psf.reduce((s,v)=>s+v,0),1,1e-12);a.ok(r.parsevalRelativeError<1e-12);
 for(let k=1;k<30;k++){const x=Math.PI*k*r.pitchMm/(.00055*10),expected=(2*j1(x)/x)**2;near(r.psf[center+k]/peak,expected,.003);}
 let first=0;for(let k=2;k<30;k++)if(r.psf[center+k]<r.psf[center+k-1]&&r.psf[center+k]<r.psf[center+k+1]){first=k;break;}
 near(first*r.pitchMm,r.airyRadiusMm,r.pitchMm);near(r.encircledEnergy[0].energy,.837785,.004);
});
test('circular MTF matches analytic formula, zero, cutoff and sagittal/tangential symmetry',()=>{
 const r=F.calculate(pupil(128),{padding:4}),cutoff=r.nominalCircularCutoffLpMm;near(r.otf.tangential[0].mtf,1,1e-14);
 for(let k=0;k<r.otf.tangential.length;k++){const t=r.otf.tangential[k],s=r.otf.sagittal[k];near(t.mtf,s.mtf,1e-12);near(t.mtf,F.circularMTF(t.frequencyLpMm/cutoff),.004);if(k>0)a.ok(t.mtf<=r.otf.tangential[k-1].mtf+1e-12);if(t.frequencyLpMm>cutoff+2*r.otf.frequencyStepLpMm)a.ok(t.mtf<1e-12);}
});
test('defocus Strehl agrees with exact uniform circular pupil integral; piston does not change PSF',()=>{
 const pv=.3,phase=(x,y)=>pv*(x*x+y*y),r=F.calculate(pupil(128,phase)),shift=F.calculate(pupil(128,(x,y)=>phase(x,y)+17.2));near(r.strehl,(Math.sin(Math.PI*pv)/(Math.PI*pv))**2,.002);for(let i=0;i<r.psf.length;i++)near(r.psf[i],shift.psf[i],1e-14);a.ok(r.strehl<.9);
});
test('elliptical pupil resolves more tangential frequency; clipped pupils retain zero amplitude',()=>{
 const ellipse=pupil(128,()=>0,(x,y)=>x*x+(y/.5)**2<=1),r=F.calculate(ellipse),f=r.nominalCircularCutoffLpMm*.7;
 a.ok(F.sampleCurve(r.otf.tangential,f)>.1);a.ok(F.sampleCurve(r.otf.sagittal,f)<.001);near(r.strehl,1,1e-12);
 const clipped=F.calculate(pupil(64,()=>0,(x,y)=>x*x+y*y<=1&&x<.3));near(clipped.strehl,1,1e-12);a.ok(F.sampleCurve(clipped.otf.sagittal,40)>F.sampleCurve(clipped.otf.tangential,40));
});
test('linear phase translates the PSF and preserves complex OTF phase and MTF',()=>{
 const base=pupil(64),r=F.calculate(base),shift=F.calculate(pupil(64,x=>x/2.5)); // one unpadded image pixel, four padded pixels
 const n=r.grid,k=3;near(shift.otf.tangential[k].mtf,r.otf.tangential[k].mtf,1e-12);near(shift.otf.tangential[k].ptfRad,-2*Math.PI*k*4/n,1e-12);
 let index=0;for(let i=1;i<shift.psf.length;i++)if(shift.psf[i]>shift.psf[index])index=i;a.equal(index%n,n/2+4);
});
test('Zernike ANSI normalization and least-squares coefficients recover known aberrations',()=>{
 near(Z.value(2,0,0,0),-Math.sqrt(3),1e-14);near(Z.value(1,1,.2,.3),.4,1e-14);near(Z.value(1,-1,.2,.3),.6,1e-14);
 const w=pupil(64,(x,y)=>.11*Z.value(2,0,x,y)-.07*Z.value(3,1,x,y)+.02*Z.value(4,0,x,y)),fit=Z.fit(w);near(fit.residualRmsWaves,0,1e-13);for(const [n,m,v]of[[2,0,.11],[3,1,-.07],[4,0,.02]])near(fit.coefficients.find(c=>c.n===n&&c.m===m).waves,v,1e-13);
 const r=F.calculate(w);a.ok(r.strehl<.8&&r.strehl>.2);
});
test('pupil and padding convergence are distinct: padding changes image pitch, not MTF',()=>{
 const a32=F.calculate(pupil(32)),a64=F.calculate(pupil(64)),a128=F.calculate(pupil(128)),p2=F.calculate(pupil(128),{padding:2});
 const expected=F.circularMTF(.4),f=a128.nominalCircularCutoffLpMm*.4,e=r=>Math.abs(F.sampleCurve(r.otf.tangential,f)-expected);a.ok(e(a128)<.002);a.ok(e(a128)<e(a32));a.ok(e(a64)<.006);near(p2.pitchMm,a128.pitchMm*2,1e-15);near(F.sampleCurve(p2.otf.tangential,f),F.sampleCurve(a128.otf.tangential,f),1e-12);
});
test('wavelength changes physical diffraction scale, not the normalized clear-pupil transform',()=>{
 const red=pupil(64),blue=pupil(64);red.settings.nm=656.2725;blue.settings.nm=486.1327;const r=F.calculate(red),b=F.calculate(blue);near(r.pitchMm/b.pitchMm,red.settings.nm/blue.settings.nm,1e-14);near(r.nominalCircularCutoffLpMm/b.nominalCircularCutoffLpMm,blue.settings.nm/red.settings.nm,1e-14);a.deepEqual(r.psf,b.psf);
});
