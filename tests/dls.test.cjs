const {test}=require('node:test'),a=require('node:assert/strict'),D=require('../optimization/dls'),M=require('../design/merit'),S=require('../synthesis/engine'),G=require('../synthesis/seeds'),B=require('../analysis/aberrations');
const fixture=require('../benchmarks/optical-suite-v1.json').cases.find(f=>f.id==='poor-focus');
const near=(x,y,t=1e-7)=>a.ok(Math.abs(x-y)<t,`${x} != ${y}`);
function optical(budget=120){return D.create(fixture.system,S.analysisSpec(fixture.specification),[{surface:fixture.system.surfaces.length-2,key:'t',min:fixture.system.surfaces.at(-2).t-4,max:fixture.system.surfaces.at(-2).t+4}],fixture.operands,{maxEvaluations:budget});}
function value(x){const residual=[10*(x[0]+x[1]-1),x[0]-x[1]-.2];return {valid:true,residual,signature:'same rays',score:residual.reduce((n,x)=>n+x*x,0)};}
test('central Jacobian matches independent analytical derivatives of coupled residuals',()=>{
 const x=[.3,.2],j=D.jacobian(x,value(x),value,D.options());near(j.columns[0][0],10);near(j.columns[0][1],1);near(j.columns[1][0],10);near(j.columns[1][1],-1);a.ok(j.coupled.length);a.ok(j.diagnostics.every(d=>d.status==='reliable'));
});
test('DLS solves a coupled quadratic to its analytical minimum inside hard bounds',()=>{
 const x=[.2,.3],s={x,current:value(x),config:D.options({maxEvaluations:300}),evaluations:1,iteration:0,lambda:.01,history:[],rejections:{},done:false};while(!s.done)D.advance(s,value);near(s.x[0],.6,1e-5);near(s.x[1],.4,1e-5);a.ok(s.evaluations<=300);a.ok(s.history.every(h=>h.score>=0));
});
test('Jacobian rejects changing pupil identities and invalid perturbations rather than treating them as smooth',()=>{
 const base=value([.5,.5]),fn=x=>({...value(x),signature:x[0]>.5?'different ray':'same rays'}),j=D.jacobian([.5,.5],base,fn,D.options());a.equal(j.diagnostics[0].status,'pupil discontinuity');a.deepEqual(j.columns[0],[0,0]);
 const invalid=D.jacobian([.5,.5],base,x=>x[0]>.5?{valid:false}:value(x),D.options());a.equal(invalid.diagnostics[0].status,'invalid perturbation');
});
test('curvature and radius normalization round-trip positive and negative surfaces and preserve original bounds',()=>{
 const f=fixture.system,vars=G.variables(f,fixture.specification);for(const parameterization of ['radius','curvature']){const mapping=D.mapping(f,vars,parameterization),x=D.encode(f,mapping),out=D.prescription({input:f,variables:vars,mapping},x);for(const v of vars)if(v.key!=='stopPosition')near(out.surfaces[v.surface][v.key],f.surfaces[v.surface][v.key]);for(const endpoint of [0,1]){const edge=D.prescription({input:f,variables:vars,mapping},x.map(()=>endpoint));for(const v of vars)if(v.key!=='stopPosition')a.ok(edge.surfaces[v.surface][v.key]>=v.min-1e-10&&edge.surfaces[v.surface][v.key]<=v.max+1e-10);}}
});
test('DLS residual norm exactly represents the existing multi-aperture squared merit',()=>{const s=optical(),r=M.evaluate(fixture.system,s.spec,s.operands);near(D.residuals(r).score,r.merit.total,1e-10);a.throws(()=>D.create(s.input,s.spec,s.variables,[{metric:'rms',field:0,scale:1,weight:1,target:0,type:'MINIMIZE'}]),/squared/);});
test('DLS optical focus converges and a serialized iteration-boundary checkpoint resumes identically',()=>{
 const s=optical();D.advance(s);const restored=D.resume(JSON.parse(JSON.stringify(s)));while(!s.done)D.advance(s);while(!restored.done)D.advance(restored);a.deepEqual(restored.x,s.x);a.deepEqual(restored.history,s.history);a.ok(s.current.score<s.initialScore*.5);const forged=structuredClone(s);forged.current.residual[0]+=1;a.throws(()=>D.resume(forged),/mismatch/);a.throws(()=>D.resume({...s,engineVersion:'future'}),/mismatch/);
});
test('fan components distinguish odd spherical-shaped fan and even coma-shaped fan; clipped zones unavailable',()=>{
 const row={paraxialFocusXMm:50,fans:[-.8,0,.8].map(q=>({axis:'tangential',pupil:q,ok:true,transverseMm:3*q+2*q*q+4*q*q*q,longitudinalFocusXMm:q?50+5*q*q:null}))};const c=B.components(row);near(c.comaEvenMm,2*.8**2);near(c.sphericalZonalMm,5*.8**2);row.fans[0].ok=false;a.equal(B.components(row).comaEvenMm,null);
});
test('optional aberration residuals are finite with explicit fields and independent weights',()=>{
 const f=require('../benchmarks/optical-suite-v1.json').cases.find(f=>f.id==='analytic-singlet'),ops=['fieldCurvature','astigmatism','comaEven','sphericalZonal'].map(metric=>({metric,field:metric==='sphericalZonal'?0:1,target:0,scale:1,weight:1}));const r=M.evaluate(f.system,f.specification,ops);a.ok(r.merit.valid,r.merit.errors.join(';'));a.equal(r.merit.breakdown.length,4);
});
