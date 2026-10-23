const {test}=require('node:test'),a=require('node:assert/strict');
const B=require('../physical/pupil-boundary'),W=require('../physical/wavefront'),O=require('../optics/core'),shapes=require('./reference/pupil-shapes.cjs');
for(const shape of shapes)test('adaptive boundary preserves analytical '+shape.id+' geometry',()=>{
 const r=B.detect((x,y)=>({state:shape.inside(x,y)?B.TRANSMITTED:B.BLOCKED,u:x,v:y}),{halfWidthMm:1.25,budget:16000,maxDepth:8});
 a.ok(Math.abs(r.area.sampledTransmittedMm2-shape.area)/shape.area<.005);
 a.ok(r.traceCalls<=16000);a.ok(r.boundaryBrackets.length>0);a.ok(r.area.unresolvedFraction>0);a.ok(r.area.unresolvedFraction<.05);
 const classify=B.classifier(r);let known=0,wrong=0;for(let j=0;j<80;j++)for(let i=0;i<80;i++){const x=(i+.5)/80*2.5-1.25,y=(j+.5)/80*2.5-1.25,s=classify(x,y);if(s===B.UNKNOWN||s===B.FAILED)continue;known++;if((s===B.TRANSMITTED)!==shape.inside(x,y))wrong++;}a.ok(known>5000);a.equal(wrong,0);
 if(shape.distance)for(const edge of r.boundaryBrackets)a.ok(shape.distance((edge.inside.x+edge.outside.x)/2,(edge.inside.y+edge.outside.y)/2)<=edge.widthMm/2+1e-12);
 if(shape.id==='annulus')a.equal(classify(0,0),B.BLOCKED);
 if(shape.id==='disconnected'){a.equal(classify(0,0),B.BLOCKED);a.equal(classify(.6,0),B.TRANSMITTED);a.equal(classify(-.6,0),B.TRANSMITTED);}
});
test('distorted mapping detects orientation reversal across subdivision edges',()=>{
 const r=B.detect((x,y)=>({state:x*x+y*y<1?B.TRANSMITTED:B.BLOCKED,u:x*x,v:y,opdWaves:x**4*20}),{halfWidthMm:1.25,budget:12000});
 a.ok(r.foldedCells>0);a.ok(r.phaseRiskCells>0);a.equal(B.classifier(r)(0,0),B.UNKNOWN);
 const seeds=B.seedIndex(r)(.25,0);a.ok(seeds.length>0);a.ok(seeds.every(p=>p.state===B.TRANSMITTED));
});
test('deliberate numerical failures and unprobed tiny features are never certified blocked',()=>{
 const r=B.detect((x,y)=>({state:Math.abs(x)<.2?B.FAILED:y>.2?B.UNKNOWN:B.TRANSMITTED}),{halfWidthMm:1,budget:4096});
 a.equal(r.counts[B.BLOCKED],0);a.ok(r.counts[B.FAILED]>0);a.ok(r.area.unresolvedFraction>.5);a.match(r.limitations[0],/sub-cell/);
 a.equal(B.classifier(r)(2,2),B.UNKNOWN);a.throws(()=>B.detect(()=>({state:B.TRANSMITTED}),{budget:1}),/Invalid/);
});
const singlet=require('../benchmarks/optical-suite-v1.json').cases.find(x=>x.id==='analytic-singlet').system;
test('real forward classification agrees with independent traced aperture failures',()=>{
 const g=W.geometry(singlet,{fNumber:16,allowApproximateMaterials:true}),r=W.boundaryAtlas(g);a.ok(r.counts[B.TRANSMITTED]>0);a.ok(r.counts[B.BLOCKED]>0);
 for(const p of r.points.filter((_,i)=>i%23===0)){const tr=O.trace(g.c,{p:{x:g.chief.p.x,y:p.x,z:p.y},d:g.chief.d},{clip:true});if(p.state===B.BLOCKED){a.equal(tr.ok,false);a.ok(['clipped','tir'].includes(tr.reason));a.equal(p.surface,tr.surface);}else if(p.state===B.TRANSMITTED)a.equal(tr.ok,true);}
});
test('forward seeds recover a deliberately failed inverse query without changing OPD',()=>{
 const g=W.geometry(singlet,{fNumber:16,allowApproximateMaterials:true}),h=1e-4,b=W.atLaunch(g,g.chief.p.y,0),by=W.atLaunch(g,g.chief.p.y+h,0),bz=W.atLaunch(g,g.chief.p.y,h),jac=[(by.u-b.u)/h,(bz.u-b.u)/h,(by.v-b.v)/h,(bz.v-b.v)/h];
 const y=g.chief.p.y+.2,z=.1,expected=W.atLaunch(g,y,z,true),r=W.recover(g,expected.u,expected.v,jac,[{x:y,y:z}],{ok:false,kind:'unmapped',detail:'Deliberate test failure'});
 a.equal(r.ok,true);a.ok(r.residualMm<1e-8);a.equal(r.opdMm,expected.opdMm);
});
test('distinct inverse roots stay ambiguous even if every seeded solve succeeds',()=>{
 const g={entranceRadiusMm:1},r=W.recover(g,0,0,[],[{x:-1,y:0},{x:1,y:0}],{ok:false,kind:'unmapped'},(_g,_u,_v,_j,s)=>({ok:true,launchY:s.y,launchZ:s.z,residualMm:0}));
 a.equal(r.ok,false);a.equal(r.kind,'ambiguous');a.equal(r.roots.length,2);
});
test('atlas integration preserves sampled OPD and never turns failed mappings into empty pupil',()=>{
 const omit=require('../benchmarks/physical-omit50.json').system,settings={fNumber:2,field:1,pupilGrid:32,imageCircleMm:46.3},old=W.sample(omit,settings),now=W.sample(omit,{...settings,pupilBoundary:true,boundaryBudget:4096});
 a.deepEqual(now.opdWaves,old.opdWaves);a.deepEqual(now.mask,old.mask);a.equal(now.diffractionEligible,false);a.ok(now.pupilBoundary.boundaryBrackets.length>0);a.ok(now.classifications.includes(3));a.ok(now.classifications.includes(2));a.ok(now.diagnostics.boundaryRecovery.initialFailures>0);
});

test('forward atlas resource guards and report serialization retain uncertainty without bulk cells',()=>{
 const E=require('../physical/engine');
 a.throws(()=>E.one(singlet,{fNumber:16,pupilGrid:32,pupilBoundary:true,boundaryBudget:32768,memoryLimitMiB:32}),/memory estimate/);
 a.throws(()=>W.sample(singlet,{fNumber:16,allowApproximateMaterials:true,pupilBoundary:true,boundaryBudget:1}),/boundary budget/);
 const q=E.batch(singlet,{fNumber:16,allowApproximateMaterials:true,pupilGrid:32,pupilBoundary:true,boundaryBudget:4096,verifyConvergence:false});
 const saved=E.reportRecord(q),atlas=saved.results[0].wavefront.pupilBoundary;
 a.equal(atlas.status,'EXPERIMENTAL SAMPLED GEOMETRY');a.ok(atlas.area.unresolvedFraction>0);a.equal(atlas.cells,undefined);a.equal(atlas.points,undefined);
 a.equal(q.results[0].confidence.physical,'EXPERIMENTAL');a.equal(q.results[0].wavefront.status,'EXPERIMENTAL');a.equal(E.restore(E.requestRecord(singlet,q.config)).config.boundaryBudget,4096);
});
