const {test}=require('node:test'),a=require('node:assert/strict'),O=require('../optics/core'),M=require('../materials/catalog'),R=require('./reference/independent.cjs');
const near=(x,y,t=1e-10)=>a.ok(Math.abs(x-y)<t,`${x} != ${y}`);
function media(indices,thicknesses){let x=0,n=1;const surfaces=indices.map((next,i)=>{const s={vx:x,R:0,ap:1000,n1:n,n2:next};x+=thicknesses[i];n=next;return s;});return {surfaces,imageX:x,stopIndex:0};}
test('OPL for homogeneous air and multiple planar media follows sum(n distance)',()=>{
 for(const angle of [0,.1,.4])for(const indices of [[],[1.5,1],[1.5,1.7,1]]){
  const widths=indices.map((_,i)=>3+i),c=media(indices,widths);if(!indices.length)c.imageX=10;
  const r={p:{x:-2,y:0,z:0},d:{x:Math.cos(angle),y:Math.sin(angle),z:0}},t=O.trace(c,r,{opticalPath:true,record:true});a.ok(t.ok);
  const sin=Math.sin(angle);let expected=2/Math.cos(angle);if(!indices.length)expected+=10/Math.cos(angle);for(let i=0;i<indices.length;i++)expected+=indices[i]*widths[i]/Math.sqrt(1-(sin/indices[i])**2);
  near(t.opticalPathMm,expected);near(t.opticalSegments.reduce((s,x)=>s+x.opticalPathMm,0),expected);
 }
});
test('OPL supports wavelength-dependent glass and reciprocal planar propagation',()=>{
 for(const nm of [486.1327,587.5618,656.2725]){
  const n=M.index('N-BK7',nm),c=media([n,1],[5,8]),r={p:{x:-2,y:0,z:0},d:O.unit({x:1,y:.3,z:.1})},t=O.trace(c,r,{opticalPath:true});a.ok(t.ok);
  const cosGlass=Math.sqrt(1-(1-r.d.x*r.d.x)/(n*n));near(t.opticalPathMm,10/r.d.x+n*5/cosGlass);
  const reverse={surfaces:c.surfaces.slice().reverse().map(s=>({...s,n1:s.n2,n2:s.n1})),imageX:r.p.x},back=O.trace(reverse,{p:t.hit,d:O.mul(t.d,-1)},{opticalPath:true});a.ok(back.ok);near(back.opticalPathMm,t.opticalPathMm);near(back.hit.y,0);near(back.hit.z,0);
 }
});
test('independent meridional reference distances agree through a cemented real lens',()=>{
 const system=require('../benchmarks/optical-suite-v1.json').cases.find(x=>x.id==='double-gauss').system,c=O.compile(system),ray={p:{x:c.startX,y:.7,z:0},d:O.unit({x:1,y:.01,z:0})},actual=O.trace(c,ray,{opticalPath:true,record:true});a.ok(actual.ok);
 const ref=R.compile(system,s=>M.index(s)),rr=R.trace(ref,{x:ray.p.x,y:ray.p.y,angle:Math.atan(.01)},c.imageX);let p=ray.p,opl=0,n=1;for(let i=0;i<rr.points.length;i++){const q=rr.points[i];opl+=n*Math.hypot(q.x-p.x,q.y-p.y);p=q;n=ref[i].n;}opl+=n*Math.hypot(rr.x-p.x,rr.y-p.y);near(actual.opticalPathMm,opl,1e-9);
 const plain=O.trace(c,ray);for(const k of ['ok','hit','p','d','points'])a.deepEqual(plain[k],O.trace(c,ray,{opticalPath:true})[k]);a.equal('opticalPathMm' in plain,false);
});
test('toStop OPL stops before the stop interface and plane-plate OPL is independent of transverse subdivision',()=>{
 const c=media([1.5,1],[5,10]),ray={p:{x:-3,y:1,z:0},d:{x:1,y:0,z:0}};c.stopIndex=1;near(O.trace(c,ray,{toStop:true,opticalPath:true}).opticalPathMm,10.5);
 const split=media([1.5,1.5,1],[2,3,10]);near(O.trace(c,ray,{opticalPath:true}).opticalPathMm,O.trace(split,ray,{opticalPath:true}).opticalPathMm);
});
