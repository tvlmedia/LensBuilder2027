// Mathematical fixtures, independent of the lens ray-to-pupil mapper.
function pupil(n=128,phase=()=>0,inside=(x,y)=>x*x+y*y<=1){const extent=1.25,mask=[],opdWaves=[],coordinates=[];for(let row=0;row<n;row++)for(let col=0;col<n;col++){const x=((col+.5)/n-.5)*2*extent,y=((row+.5)/n-.5)*2*extent;mask.push(inside(x,y)?1:0);opdWaves.push(inside(x,y)?phase(x,y):null);coordinates.push([x,y]);}return {grid:n,mask,opdWaves,coordinates,pupilCoverage:1,diffractionEligible:true,pupilWidthMm:2*extent,pupilRadiusMm:1,reference:{radiusMm:20},settings:{nm:550}};}
module.exports=pupil;
