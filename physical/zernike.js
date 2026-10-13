/* ANSI/OSA ordering j=(n(n+2)+m)/2; unit-disk RMS normalization. */
(function(root){
 'use strict';
 const factorial=n=>{let f=1;for(let k=2;k<=n;k++)f*=k;return f;};
 function modes(order=4){if(!Number.isInteger(order)||order<0||order>6)throw Error('Zernike order must be 0–6');const out=[];for(let n=0;n<=order;n++)for(let m=-n;m<=n;m+=2)out.push({j:(n*(n+2)+m)/2,n,m});return out;}
 function value(n,m,x,y){const r=Math.hypot(x,y),a=Math.abs(m),theta=Math.atan2(y,x);let radial=0;for(let s=0;s<=(n-a)/2;s++)radial+=(-1)**s*factorial(n-s)/(factorial(s)*factorial((n+a)/2-s)*factorial((n-a)/2-s))*r**(n-2*s);return Math.sqrt(2*(n+1)/(m===0?2:1))*radial*(m<0?Math.sin(a*theta):m>0?Math.cos(a*theta):1);}
 function fit(w,order=4){
  const indices=w.mask.flatMap((v,i)=>v?[i]:[]),basis=modes(order);if(indices.length<basis.length*2)throw Error('Insufficient pupil samples for Zernike fit');
  if(indices.some(i=>Math.hypot(...w.coordinates[i])>1+1e-8))throw Error('Zernike fit unavailable: support extends outside the defined unit disk');
  const q=[],R=basis.map(()=>new Float64Array(basis.length)),b=new Float64Array(basis.length);
  // Reorthogonalized modified Gram–Schmidt avoids squaring the condition number.
  for(let k=0;k<basis.length;k++){const mode=basis[k],v=Float64Array.from(indices,i=>value(mode.n,mode.m,...w.coordinates[i]));for(let pass=0;pass<2;pass++)for(let j=0;j<k;j++){let dot=0;for(let i=0;i<v.length;i++)dot+=q[j][i]*v[i];R[j][k]+=dot;for(let i=0;i<v.length;i++)v[i]-=dot*q[j][i];}let norm=Math.hypot(...v);if(norm<1e-8)throw Error('Rank-deficient pupil for Zernike fit');R[k][k]=norm;for(let i=0;i<v.length;i++){v[i]/=norm;b[k]+=v[i]*w.opdWaves[indices[i]];}q.push(v);}
  const coefficients=new Float64Array(basis.length);for(let k=basis.length-1;k>=0;k--){let v=b[k];for(let j=k+1;j<basis.length;j++)v-=R[k][j]*coefficients[j];coefficients[k]=v/R[k][k];}
  let error=0;for(const i of indices){const prediction=basis.reduce((s,m,j)=>s+coefficients[j]*value(m.n,m.m,...w.coordinates[i]),0);error+=(prediction-w.opdWaves[i])**2;}
  return {convention:'ANSI/OSA, unit-disk RMS normalized; actual-support least squares',coefficients:basis.map((v,i)=>({...v,waves:coefficients[i]})),residualRmsWaves:Math.sqrt(error/indices.length),status:w.pupilCoverage===1?'VALIDATED NUMERICAL FIT':'EXPERIMENTAL CLIPPED-PUPIL FIT',limitation:'Coefficients require identical pupil definition; orthogonality is lost with clipping. Defocus is reported, never subtracted from the PSF.'};
 }
 const api={modes,value,fit};root.LBZernike=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
