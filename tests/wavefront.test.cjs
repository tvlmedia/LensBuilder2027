const {test}=require('node:test'),a=require('node:assert/strict'),W=require('../physical/wavefront'),O=require('../optics/core'),M=require('../materials/catalog'),R=require('./reference/independent.cjs');
const fixture=require('../benchmarks/optical-suite-v1.json').cases.find(x=>x.id==='analytic-singlet'),system=fixture.system;
const config={fNumber:16,pupilGrid:32,allowApproximateMaterials:true};
const near=(x,y,t)=>a.ok(Math.abs(x-y)<t,`${x} != ${y}; tolerance ${t}`);
test('reference sphere is an equal eikonal surface for an ideal converging spherical wave',()=>{
 const reference={image:{x:100,y:0,z:0},axis:{x:1,y:0,z:0},tangent:{x:0,y:1,z:0},radiusMm:70};
 for(const y of [-10,-2,0,3,10]){const p={x:10,y,z:0},d=O.unit({x:90,y:-y,z:0}),s=W.sphereIntersection({p,d},reference);near(Math.hypot(s.point.x-100,s.point.y,s.point.z),70,1e-12);near(-Math.hypot(90,y)+s.distance,-70,1e-12);}
});
test('paraxial exit pupil agrees with independent small-angle ray conjugate',()=>{
 const g=W.geometry(system,config),c=g.c,physical=g.system.surfaces.slice(1,-1),ref=R.compile(g.system,s=>M.index(s));
 const tail=ref.slice(c.stopIndex); // This fixture has its stop in object air at the front interface.
 a.equal(c.stopIndex,0);const small=R.trace(tail,{x:0,y:0,angle:1e-6},c.surfaces.at(-1).vx);
 const pupilX=small.x-small.y/Math.tan(small.last.angle);near(g.reference.exitPupil.x,pupilX,1e-9);
 a.equal(physical[0].stop,true);
});
test('reference-sphere OPD matches independent angular-Snell/Newton-sag paths off axis',()=>{
 for(const field of [0,.3]){const g=W.geometry(system,{...config,field}),ref=R.compile(g.system,s=>M.index(s,587.5618));
 function path(y){const p={x:g.chief.p.x,y},rr=R.trace(ref,{...p,angle:Math.atan2(g.chief.d.y,g.chief.d.x)},g.c.imageX);a.ok(rr.ok);let prev=p,n=1,opl=0;for(let i=0;i<rr.points.length;i++){const q=rr.points[i];opl+=n*Math.hypot(q.x-prev.x,q.y-prev.y);prev=q;n=ref[i].n;}
 const dx=Math.cos(rr.last.angle),dy=Math.sin(rr.last.angle),vx=prev.x-g.reference.image.x,vy=prev.y-g.reference.image.y;
 const b=vx*dx+vy*dy,t=-b-Math.sqrt(b*b-vx*vx-vy*vy+g.reference.radiusMm**2);
 return opl+t+(y-g.chief.p.y)*Math.sin(Math.atan2(g.chief.d.y,g.chief.d.x));}
 const reference=path(g.chief.p.y);for(const offset of [-.7,-.3,.2,.6])near(W.atLaunch(g,g.chief.p.y+offset,0,true).opdMm,path(g.chief.p.y+offset)-reference,2e-10);
 }
});
test('inverse pupil mapping, real clipping and common fixed focus are preserved',()=>{
 const q=W.sample(system,config),g=W.geometry(system,config);a.ok(q.maxMappingResidualMm<1e-8);a.ok(q.diffractionEligible);a.ok(q.mask.includes(0));
 for(let i=0;i<q.mask.length;i++)if(q.mask[i]){const [y,z]=q.launchCoordinatesMm[i],r=W.atLaunch(g,y,z,true);a.ok(r.ok);near(r.u,q.coordinates[i][0]*q.pupilRadiusMm,1e-8);near(r.v,q.coordinates[i][1]*q.pupilRadiusMm,1e-8);}
 a.throws(()=>W.sample(system,{...config,imageShiftMm:.2}),/explicit/);
 const shifted=W.sample(system,{...config,focusPolicy:'global-image-shift',imageShiftMm:1});near(shifted.reference.imagePlaneXMm-q.reference.imagePlaneXMm,1,1e-12);a.ok(shifted.rmsWaves>q.rmsWaves*5);
 for(const nm of [486.1327,656.2725])near(W.sample(system,{...config,nm}).reference.imagePlaneXMm,q.reference.imagePlaneXMm,1e-12);
});
test('piston and optional tilt use actual support and never remove defocus',()=>{
 const coords=[[-1,0],[0,0],[1,0],[0,-1],[0,1],[.2,.4]],mask=[1,1,1,1,1,0],v=coords.map(([x,y])=>3+2*x-4*y);
 const fit=W.detrend(v,mask,coords,true);near(fit.rmsMm,0,1e-12);near(fit.pistonMm,3,1e-12);near(fit.tiltMmPerNormalizedPupil[0],2,1e-12);near(fit.tiltMmPerNormalizedPupil[1],-4,1e-12);
 a.ok(W.detrend(coords.map(([x,y])=>x*x+y*y),mask,coords,true).rmsMm>.1);
});
test('stopped-down spherical singlet approaches quartic aberration and pupil sampling converges',()=>{
 const q16=W.sample(system,{...config,fNumber:16,pupilGrid:64}),q32=W.sample(system,{...config,fNumber:32,pupilGrid:64});near(q16.rmsWaves/q32.rmsWaves,16,.1);
 const q128=W.sample(system,{...config,pupilGrid:128});a.ok(Math.abs(q128.rmsWaves/q16.rmsWaves-1)<.015);
});
