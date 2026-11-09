const {test}=require('node:test'),a=require('node:assert/strict');
const P=require('../optics/preview.js'),O=require('../optics/core.js');
const singlet={surfaces:[{type:'OBJ',R:0,t:0,ap:10,glass:'AIR'},
 {type:'SPH',R:50,t:5,ap:.02,glass:'CUSTOM',nd:1.5,vd:60,stop:true},
 {type:'SPH',R:-50,t:50,ap:.02,glass:'AIR'}, {type:'IMS',R:0,t:0,ap:40,glass:'AIR'}]};
// Independent ABCD calculation: surface powers .01 and .01, glass translation 5/1.5.
// A=D=29/30, B=10/3, C=-59/3000. q=-(A*s+B)/(C*s+D).
for(const distance of [Infinity,2000]) test(`finite/infinite analytic thick lens conjugate ${distance}`,()=>{
 const expected=distance===Infinity?2900/59:-((29/30)*distance+10/3)/((-59/3000)*distance+29/30);
 const result=P.minimize(shift=>{const s=P.spot(singlet,{distance,sensorShift:shift});return {score:s.ok?s.rmsMm:Infinity};},0,10);
 a.ok(result.ok);a.ok(Math.abs(50+result.x-expected)<.002,`${50+result.x} vs ${expected}`);
});
test('focus minimizer searches past invalid initial state and rejects all-invalid/boundary minima',()=>{
 a.equal(P.minimize(x=>({score:Math.abs(x)<1?Infinity:(x-3)**2}),0,8).ok,true);
 a.equal(P.minimize(()=>({score:Infinity})).ok,false);
 a.equal(P.minimize(x=>({score:-x}),0,8).ok,false);
});
test('object stays fixed when lens moves; sensor pose is independent',()=>{
 const c=P.pose(singlet,587.5618,-1,2);
 a.equal(c.surfaces[0].vx,-1);a.equal(c.imageX,57);
 const r=P.aim(c,{y:0,z:0},2000,.01,0);
 const atObject=r.p.y+(-2000-r.p.x)*r.d.y/r.d.x;
 a.ok(Math.abs(atObject+20)<1e-9);
});
test('sensor intersections and reciprocity use actual sensor plane',()=>{
 const c=P.pose(singlet,587.5618,0,1),r=P.aim(c,{y:.01,z:0},2000,0,0),t=O.trace(c,r);
 a.equal(t.hit.x,c.imageX);
 let ray={p:t.hit,d:O.mul(t.d,-1)};
 for(const s of c.surfaces.slice().reverse()) {const h=O.intersect(ray,s);a.ok(h);ray={p:h.hit,d:O.refract(ray.d,h.normal,s.n2,s.n1)};}
 a.ok(Math.abs(ray.p.y+(-2000-ray.p.x)*ray.d.y/ray.d.x)<1e-7);
});
test('16/32/64 deterministic equal-area pupil samples remain inside unit pupil',()=>{
 for(const n of [16,32,64]) {const d=P.disk(n);a.equal(d.length,n);a.deepEqual(d,P.disk(n));a.ok(d.every(p=>Math.hypot(p.y,p.z)<1));}
});
test('1920 long edge is memory bounded and preserves landscape/portrait aspect',()=>{
 for(const aspect of [1.5,2/3,1]) {const d=P.dimensions(1920,aspect);a.equal(Math.max(d.width,d.height),1920);a.ok(Math.abs(d.width/d.height-aspect)<.001);}
});
test('new upload invalidates older async load even with identical image dimensions',()=>{
 const gate=P.latest(),old=gate.next(),next=gate.next();a.equal(gate.current(old),false);a.equal(gate.current(next),true);
});
test('reverse pupil aiming retraces forward rays through the actual refracted stop',()=>{
 const system=require('../benchmarks/physical-omit50.json').system,c=P.pose(system,587.5618,-1.328125,0);
 for(const fieldY of [0,15,23.15]) for(const pupil of P.disk(16)) {
   const ap=c.surfaces[c.stopIndex].ap,r=P.aim(c,{y:pupil.y*ap,z:pupil.z*ap},2000,fieldY/O.paraxial(c).eflMm,0);
   if(!r)continue;const t=O.trace(c,r);if(!t.ok)continue;
   const back=P.reverse(c,t.hit,pupil);a.ok(back);
   const objectY=back.p.y+(-2000-back.p.x)*back.d.y/back.d.x;
   a.ok(Math.abs(objectY+2000*fieldY/O.paraxial(c).eflMm)<.001);
 }
});
function render(options={}) {
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
 let result;
 const context=vm.createContext({performance,console,Uint8ClampedArray,Float32Array});
 context.self={postMessage:m=>{if(m.output||m.error)result=m;}};
 context.importScripts=(...files)=>files.forEach(f=>vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../optics',f),'utf8'),context));
 vm.runInContext(fs.readFileSync(require.resolve('../optics/preview-worker.js'),'utf8'),context);
 const system=require('../benchmarks/physical-omit50.json').system;
 const m={W:12,H:8,sensorW:36,sensorH:24,sensorX:O.compile(system).imageX,halfObjW:750,halfObjH:500,distance:2000,orientation:'upright',spp:16,doCA:false,imgW:12,imgH:8,
 imgData:Uint8ClampedArray.from({length:12*8*4},(_,i)=>i%4===3?255:((i>>2)%12<6?255:0)),
 compiled:[P.pose(system,587.5618,-1.328125)],...options};
 context.self.onmessage({data:m});a.ok(result&&!result.error,result?.error);return result;
}
test('actual browser worker changes source pixels without changing ray coverage',()=>{
 const light=render({imgData:new Uint8ClampedArray(12*8*4).fill(255)}),dark=render({imgData:new Uint8ClampedArray(12*8*4)});
 a.notDeepEqual(light.output,dark.output);a.deepEqual(light.survival,dark.survival);
});
test('actual worker DOF off/on, sample settings, focus and orientation remain deterministic',()=>{
 const a16=render(),repeat=render();a.deepEqual(a16.output,repeat.output);
 const chief=render({spp:1}),a32=render({spp:32}),a64=render({spp:64});
 a.notDeepEqual(chief.output,a16.output);
 for(const r of [a16,a32,a64]) a.ok(r.survival.every(v=>v>=0&&v<=1));
 const system=require('../benchmarks/physical-omit50.json').system;
 a.notDeepEqual(a16.output,render({compiled:[P.pose(system,587.5618,0)]}).output);
 a.notDeepEqual(a16.output,render({orientation:'sensor-real'}).output);
});
test('saving focus without an override retains the active shift instead of Number(null)=0',()=>{
 const vm=require('node:vm'),source=require('node:fs').readFileSync(require.resolve('../script.js'),'utf8');
 const start=source.indexOf('  function syncFocusStateToLens('),end=source.indexOf('  function setFocusShiftMm(',start);
 const lens={},context={lens,ui:{},normalizeFocusMode:x=>x,normalizeFocusMechanism:x=>x,getFocusShiftMm:()=>-1.3281,getPreviewAutofocusMode:()=> 'chart-center'};
 vm.runInNewContext(source.slice(start,end)+'; syncFocusStateToLens();',context);
 a.equal(lens.focus.shiftMm,-1.3281);
 vm.runInNewContext(source.slice(start,end)+'; syncFocusStateToLens(0);',context);
 a.equal(lens.focus.shiftMm,0);
});
test('edge autofocus field is the actual sensor corner, including aspect ratio',()=>{
 const vm=require('node:vm'),source=require('node:fs').readFileSync(require.resolve('../script.js'),'utf8');
 const start=source.indexOf('  function getPreviewAutofocusSensorSamples('),end=source.indexOf('  function evaluatePreviewSpotAtSensorPoint(',start);
 const result=vm.runInNewContext(source.slice(start,end)+'; getPreviewAutofocusSensorSamples(12,"chart-edge");',{getSensorWH:()=>({w:36,h:24})});
 a.equal(result[0].sy,18);a.equal(result[0].sz,12);
});

test('resolved edge broadens on the actual worker when the sensor is defocused',()=>{
 const lens=require('./fixtures/preview-singlet.json'), W=128,H=8;
 function edge(s,shift,spp){
   const c=P.pose(s,587.5618,0,shift),n=1024;
   const imgData=Uint8ClampedArray.from({length:n*4},(_,i)=>i%4===3||i>>2>=n/2?255:0);
   return render({W,H,sensorW:4,sensorH:.25,imgW:n,imgH:1,imgData,halfObjW:5e7,halfObjH:5e7,distance:1e9,sensorX:c.imageX,compiled:[c],spp}).output;
 }
 const focused=edge(lens,0,64),defocused=edge(lens,5,64);
 const width=image=>Array.from({length:W},(_,x)=>image[(4*W+x)*4]).filter(v=>v>80&&v<244).length;
 a.ok(width(defocused)>=width(focused)+6);
 const s=P.spot(lens,{sensorShift:5,samples:64});
 a.ok(s.ok && s.rmsMm*W/4>6);a.ok(Math.abs(s.rmsMm-Math.hypot(s.rmsY,s.rmsZ))<1e-12);
 const narrow=structuredClone(lens);narrow.surfaces[1].ap=2;
 a.ok(width(edge(narrow,5,64))<width(defocused));a.notDeepEqual(edge(lens,5,16),defocused);
 const altered=structuredClone(lens);altered.surfaces[2].R=-38;a.notDeepEqual(edge(altered,0,64),focused);
});
test('a focused singlet reduces fine stripe contrast more off axis than at the center',()=>{
 const system=require('./fixtures/preview-singlet.json'),c=P.pose(system,587.5618);
 const W=96,H=8,imgW=1536,span=5e8;
 const pixels=Uint8ClampedArray.from({length:imgW*4},(_,i)=>i%4===3||Math.floor((i>>2)/16)%2?255:0);
 const run=spp=>render({W,H,spp,sensorW:36,sensorH:3,imgW,imgH:1,imgData:pixels,halfObjW:span,halfObjH:span,distance:1e9,sensorX:c.imageX,compiled:[c]});
 const contrast=(im,lo,hi)=>{const values=[];for(let x=lo;x<hi;x++)values.push(im.output[(4*W+x)*4]);return (Math.max(...values)-Math.min(...values))/(Math.max(...values)+Math.min(...values));};
 const chief=run(1),full=run(64);
 const center=contrast(full,40,56),edge=contrast(full,0,16);
 a.ok(center>edge+.10 && contrast(chief,0,16)>edge+.10);
});
