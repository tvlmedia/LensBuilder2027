const {test}=require('node:test'),a=require('node:assert/strict'),E=require('../physical/engine'),W=require('../physical/wavefront'),F=require('../physical/fourier'),{Worker}=require('node:worker_threads'),path=require('node:path');
const system=require('../benchmarks/optical-suite-v1.json').cases.find(x=>x.id==='analytic-singlet').system,config={pupilGrid:32,fNumber:16,allowApproximateMaterials:true};
test('lens diffraction status requires sampled phase, paraxial regime and per-prescription convergence',()=>{
 const valid=E.one(system,config);a.match(valid.status.psf,/VALIDATED SCALAR/);a.ok(valid.convergence.passed);a.match(E.one(system,{...config,verifyConvergence:false}).status.psf,/EXPERIMENTAL/);a.equal(E.one(system,{...config,field:.3}).status.psf,'EXPERIMENTAL');
 const bad=E.one(system,{...config,fNumber:8,imageShiftMm:20,focusPolicy:'global-image-shift'});a.equal(bad.status.psf,'UNAVAILABLE');a.equal(bad.diffraction,undefined);a.ok(bad.limitations.some(s=>s.includes('sampling')));
});
test('multi-field, aperture and spectral channels preserve one image plane without averaging MTF magnitudes',()=>{
 const r=E.batch(system,{...config,fields:[0,.3],apertures:[16,32],wavelengths:[{nm:486.1327,weight:1},{nm:656.2725,weight:2}],imageShiftMm:.1,focusPolicy:'global-image-shift',verifyConvergence:false});a.equal(r.results.length,8);const planes=r.results.map(x=>x.wavefront.reference.imagePlaneXMm);a.ok(planes.every(x=>x===planes[0]));a.equal(r.polychromatic.status,'UNAVAILABLE');a.match(r.polychromatic.reason,/no MTF averaging/);a.throws(()=>E.batch(system,{wavelengths:[{nm:550,weight:-1}]}),/weights/);
});
test('explicit global focus diagnostic returns one shared shift and never mutates the lens',()=>{
 const before=JSON.stringify(system),r=E.focusScan(system,{...config,fields:[0,.2]},[-.2,0,.2]);a.equal(r.applied,false);a.ok(r.best);a.equal(r.trials.length,3);a.equal(JSON.stringify(system),before);a.equal(r.best.rmsWaves,Math.min(...r.trials.map(x=>x.rmsWaves)));
});
test('serialized analysis requests round trip and comparison rejects incompatible settings',()=>{
 const r=E.requestRecord(system,config),restored=E.restore(JSON.parse(JSON.stringify(r)));a.deepEqual(restored,r);a.throws(()=>E.restore({...r,engineVersion:'future'}),/schema/);a.deepEqual(E.comparisonWarnings([r,restored]),[]);const changed=structuredClone(r);changed.config.nm=500;changed.system.surfaces.at(-2).t+=1;a.equal(E.comparisonWarnings([r,changed]).length,2);
});
test('real lens defocus difference follows analytical low-NA quadratic wavefront',()=>{
 const g=W.geometry(system,{...config,fNumber:32}),h=W.geometry(system,{...config,fNumber:32,focusPolicy:'global-image-shift',imageShiftMm:.1});
 for(const y of [.2,.4,.6]){const a0=W.atLaunch(g,y,0),a1=W.atLaunch(h,y,0),predicted=-.1*a0.u*a0.u/(2*g.reference.radiusMm**2); // reference moves downstream; verify magnitude against paraxial defocus
 a.ok(Math.abs(Math.abs(a1.opdMm-a0.opdMm)/Math.abs(predicted)-1)<.02);}
});
test('browser physical worker matches direct engine and reports malformed requests',async()=>{
 const base=path.resolve(__dirname,'../physical'),harness=`const {parentPort}=require('node:worker_threads'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');const base=${JSON.stringify(base)};const c=vm.createContext({structuredClone,performance,console,postMessage:m=>parentPort.postMessage(m),onmessage:null});c.importScripts=(...files)=>files.forEach(f=>vm.runInContext(fs.readFileSync(path.resolve(base,f),'utf8'),c));vm.runInContext(fs.readFileSync(path.join(base,'worker.js'),'utf8'),c);parentPort.on('message',data=>c.onmessage({data}));`;
 const worker=new Worker(harness,{eval:true}),next=()=>new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);});
 try{const c={...config,verifyConvergence:false},pending=next();worker.postMessage({id:7,type:'analyze',system,config:c});const r=await pending;a.equal(r.type,'result');const local=E.batch(system,c);a.deepEqual(r.result.results[0].status,local.results[0].status);a.deepEqual(r.result.results[0].diffraction.psf,local.results[0].diffraction.psf);const fail=next();worker.postMessage({id:8,type:'nonsense'});a.equal((await fail).type,'error');}finally{await worker.terminate();}
});
test('large retained-result batches are rejected before tracing',()=>{
 a.throws(()=>E.batch(system,{...config,pupilGrid:256,apertures:[16,22,32],fields:[0,.3,.5,.7,.85,1]}),/192 MiB/);
});
