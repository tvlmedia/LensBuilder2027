/* Reference-sphere eikonal sampling. Lengths mm; vacuum wavelength nm. */
(function(root){
  'use strict';
  const O=root.LBOptics||require('../optics/core.js'),Multi=root.LBMultiAperture||require('../analysis/multi-aperture.js');
  const B=root.LBPupilBoundary||require('./pupil-boundary.js');
  const VERSION='reference-sphere-3';
  const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
  function exitPupil(c){
    let matrix=[1,0,0,1];
    for(let i=c.stopIndex;i<c.surfaces.length;i++){
      const s=c.surfaces[i];matrix=O.multiply([1,0,s.R?-(s.n2-s.n1)/s.R:0,1],matrix);
      if(i<c.surfaces.length-1)matrix=O.multiply([1,s.t/s.n2,0,1],matrix);
    }
    const [A,B,C,D]=matrix;if(Math.abs(D)<1e-10)throw Error('Exit pupil at infinity is unavailable');
    const distance=-B/D;return {x:c.surfaces.at(-1).vx+distance,radiusMm:Math.abs(A+distance*C)*c.surfaces[c.stopIndex].ap,matrix};
  }
  function sphereIntersection(ray,reference){
    const v=sub(ray.p,reference.image),b=O.dot(v,ray.d),disc=b*b-O.dot(v,v)+reference.radiusMm**2;
    if(!(disc>=0))return null;
    const distance=-b-Math.sqrt(disc),point=O.add(ray.p,O.mul(ray.d,distance));
    if(O.dot(sub(point,reference.image),reference.axis)>=0)return null;
    return {distance,point,u:O.dot(sub(point,reference.image),reference.tangent),v:point.z-reference.image.z};
  }
  function settings(raw={}){
    const s={field:0,nm:587.5618,targetEflMm:50,imageCircleMm:43.27,pupilGrid:32,pupilExtent:1.25,imageShiftMm:0,focusPolicy:'fixed-prescription',removeTilt:false,allowApproximateMaterials:false,...raw};
    for(const k of ['nm','targetEflMm','imageCircleMm','pupilExtent'])if(!Number.isFinite(s[k])||s[k]<=0)throw Error(`Invalid ${k}`);
    if(s.nm<400||s.nm>700||!Number.isFinite(s.field)||s.field<0||s.field>1||![16,32,64,128,256,512].includes(s.pupilGrid)||s.pupilExtent<1.1||s.pupilExtent>2||!Number.isFinite(s.imageShiftMm))throw Error('Invalid wavefront sampling or field');
    if(!['fixed-prescription','global-image-shift'].includes(s.focusPolicy)||s.focusPolicy==='fixed-prescription'&&s.imageShiftMm!==0)throw Error('Image shift requires explicit global-image-shift policy');
    if(s.objectDistanceMm!==undefined&&s.objectDistanceMm!==Infinity)throw Error('Only infinity-conjugate physical analysis is supported');
    if(s.pupilBoundary!==undefined&&typeof s.pupilBoundary!=='boolean')throw Error('Pupil boundary enablement must be boolean');
    if(typeof s.removeTilt!=='boolean')throw Error('Tilt removal must be explicit boolean');return s;
  }
  function geometry(input,raw){
    const s=settings(raw);let system=structuredClone(input);
    if(s.fNumber!==undefined)system=Multi.atAperture(system,s.fNumber).system;
    system.surfaces.at(-2).t+=s.imageShiftMm;
    const c=O.compile(system,s.nm);
    if(c.warnings.length&&!s.allowApproximateMaterials)throw Error('Approximate dispersion requires explicit opt-in');
    const angle=Math.atan(s.field*s.imageCircleMm/(2*s.targetEflMm)),chief=O.aimChief(c,angle);
    if(!chief)throw Error('Chief aiming failed');
    const tr=O.trace(c,chief,{opticalPath:true});if(!tr.ok)throw Error('Chief ray blocked');
    const pupil=exitPupil(c),radius=(c.imageX-pupil.x)/tr.d.x;
    if(!(radius>0&&pupil.radiusMm<radius*.8))throw Error('Unsupported exit-pupil/reference-sphere geometry');
    const reference={image:tr.hit,axis:tr.d,tangent:O.unit({x:-tr.d.y,y:tr.d.x,z:0}),radiusMm:radius,exitPupil:pupil,imagePlaneXMm:c.imageX};
    const intersection=sphereIntersection(tr,reference);if(!intersection)throw Error('Chief/reference sphere intersection failed');
    const referencePath=tr.opticalPathToLastSurfaceMm+intersection.distance;
    return {s,system,c,chief,reference,referencePath,entranceRadiusMm:O.paraxial(c).entrancePupilRadiusMm,traceCount:0};
  }
  function atLaunch(g,y,z,clip=false){
    g.traceCount=(g.traceCount||0)+1;
    const ray={p:{x:g.chief.p.x,y,z},d:g.chief.d},tr=O.trace(g.c,ray,{clip,opticalPath:true});
    if(!tr.ok)return {ok:false,reason:tr.reason,surface:tr.surface};
    const sphere=sphereIntersection(tr,g.reference);if(!sphere)return {ok:false,reason:'reference sphere missed'};
    // Incident rays start on a common axial plane, NOT an equal-phase plane off axis.
    const inputPhase=O.dot(sub(ray.p,g.chief.p),ray.d);
    return {ok:true,u:sphere.u,v:sphere.v,opdMm:inputPhase+tr.opticalPathToLastSurfaceMm+sphere.distance-g.referencePath};
  }
  function inverse(g,u,v,baseJac,seed){
    const a=baseJac,det=a[0]*a[3]-a[1]*a[2];
    let y=seed?seed.y:g.chief.p.y+(a[3]*u-a[1]*v)/det,z=seed?seed.z:(-a[2]*u+a[0]*v)/det;
    const entrance=g.entranceRadiusMm||O.paraxial(g.c).entrancePupilRadiusMm,h=Math.max(1e-6,entrance*1e-5);
    let r=atLaunch(g,y,z),maxCondition=0,backtracks=0;
    const fail=(kind,detail)=>({ok:false,kind,detail,maxCondition,backtracks});
    // A paraxial guess can lie outside the traceable surface hemisphere.
    // Restart from the valid chief, then use residual-decreasing steps only.
    if(!r.ok){y=g.chief.p.y;z=0;r=atLaunch(g,y,z);}
    for(let iteration=0;iteration<24;iteration++){
      const ry=atLaunch(g,y+h,z),rz=atLaunch(g,y,z+h);
      if(!r.ok||!ry.ok||!rz.ok)return fail('unmapped',r.reason||ry.reason||rz.reason);
      const j=[(ry.u-r.u)/h,(rz.u-r.u)/h,(ry.v-r.v)/h,(rz.v-r.v)/h],d=j[0]*j[3]-j[1]*j[2];
      const condition=j.reduce((s,x)=>s+x*x,0)/Math.abs(d);maxCondition=Math.max(maxCondition,condition);
      if(!Number.isFinite(d)||Math.abs(d)<1e-8||d*det<=0||condition>1e8)return fail('folded mapping','Singular, reversed or ill-conditioned Jacobian');
      const du=r.u-u,dv=r.v-v,residual=Math.hypot(du,dv);
      if(residual<1e-8){const clipped=atLaunch(g,y,z,true);return clipped.ok?{...clipped,launchY:y,launchZ:z,residualMm:residual,jacobianDeterminant:d,maxCondition,backtracks}:{...fail(['clipped','tir'].includes(clipped.reason)?'blocked':'unmapped',clipped.reason),reason:clipped.reason,surface:clipped.surface,launchY:y,launchZ:z,residualMm:residual};}
      const dy=(j[3]*du-j[1]*dv)/d,dz=(-j[2]*du+j[0]*dv)/d;
      let accepted=false;
      for(let scale=Math.min(1,2*entrance/Math.hypot(dy,dz));scale>=1/1024;scale/=2){const q=atLaunch(g,y-scale*dy,z-scale*dz);if(q.ok&&Math.hypot(q.u-u,q.v-v)<residual){y-=scale*dy;z-=scale*dz;r=q;accepted=true;break;}backtracks++;}
      if(!accepted)return fail('unmapped','No residual-decreasing Newton step');
    }
    return fail('unmapped','Iteration limit');
  }
  function forwardProbe(g,y,z){
    g.traceCount++;const ray={p:{x:g.chief.p.x,y,z},d:g.chief.d},tr=O.trace(g.c,ray,{clip:true,opticalPath:true});
    if(!tr.ok)return {state:['clipped','tir'].includes(tr.reason)?B.BLOCKED:B.UNKNOWN,reason:tr.reason,surface:tr.surface};
    const sphere=sphereIntersection(tr,g.reference);if(!sphere)return {state:B.UNKNOWN,reason:'Transmitted ray misses reference sphere'};
    const opdMm=O.dot(sub(ray.p,g.chief.p),ray.d)+tr.opticalPathToLastSurfaceMm+sphere.distance-g.referencePath;
    return {state:B.TRANSMITTED,u:sphere.u,v:sphere.v,opdMm,opdWaves:opdMm/(g.s.nm*1e-6)};
  }
  function boundaryAtlas(g){
    const budget=g.s.boundaryBudget??8192,maxDepth=g.s.boundaryMaxDepth??8,extent=g.s.boundaryExtent??1.5;
    if(!Number.isInteger(budget)||budget<1089||budget>32768||!Number.isInteger(maxDepth)||maxDepth<4||maxDepth>10||!Number.isFinite(extent)||extent<1||extent>3)throw Error('Invalid pupil boundary budget, depth or extent');
    return B.detect((y,z)=>forwardProbe(g,y,z),{halfWidthMm:g.entranceRadiusMm*extent,centerX:g.chief.p.y,minDepth:4,maxDepth,budget,phaseLimitWaves:.25,mappingToleranceMm:g.reference.exitPupil.radiusMm/2**maxDepth});
  }
  function recover(g,u,v,jac,seeds,original,solve=inverse){
    const roots=[];let extraBacktracks=0,maxCondition=original.maxCondition||0;
    for(const seed of seeds){const q=solve(g,u,v,jac,{y:seed.x,z:seed.y});extraBacktracks+=q.backtracks||0;maxCondition=Math.max(maxCondition,q.maxCondition||0);
      if((q.ok||q.kind==='blocked')&&Number.isFinite(q.launchY)&&!roots.some(r=>Math.hypot(r.launchY-q.launchY,r.launchZ-q.launchZ)<1e-6*Math.max(1,g.entranceRadiusMm)))roots.push(q);
    }
    const diagnostics={backtracks:(original.backtracks||0)+extraBacktracks,maxCondition};
    if(roots.length>1)return {...diagnostics,ok:false,kind:'ambiguous',detail:'Multiple distinct inverse roots from transmitted forward seeds',roots:roots.map(r=>({y:r.launchY,z:r.launchZ,transmitted:!!r.ok}))};
    return {...(roots[0]||original),...diagnostics};
  }
  function detrend(values,mask,coordinates,removeTilt){
    const ids=mask.flatMap((v,i)=>v?[i]:[]);if(!ids.length)throw Error('No clear pupil samples');
    const mean=ids.reduce((a,i)=>a+values[i],0)/ids.length;
    const out=values.map((v,i)=>mask[i]?v-mean:null);let tilt=[0,0],offset=mean;
    if(removeTilt){
      // Joint least squares on the actual sampled support; no assumption of a full disk.
      const xs=ids.reduce((a,i)=>a+coordinates[i][0],0)/ids.length,ys=ids.reduce((a,i)=>a+coordinates[i][1],0)/ids.length;
      let xx=0,yy=0,xy=0,xw=0,yw=0;for(const i of ids){const x=coordinates[i][0]-xs,y=coordinates[i][1]-ys;xx+=x*x;yy+=y*y;xy+=x*y;xw+=x*out[i];yw+=y*out[i];}
      const determinant=xx*yy-xy*xy;if(determinant<1e-20)throw Error('Degenerate tilt fit');tilt=[(yy*xw-xy*yw)/determinant,(xx*yw-xy*xw)/determinant];offset=mean-tilt[0]*xs-tilt[1]*ys;
      for(const i of ids)out[i]=values[i]-offset-tilt[0]*coordinates[i][0]-tilt[1]*coordinates[i][1];
    }
    const usable=ids.map(i=>out[i]);return {values:out,pistonMm:offset,tiltMmPerNormalizedPupil:tilt,rmsMm:Math.sqrt(usable.reduce((s,v)=>s+v*v,0)/ids.length),pvMm:usable.reduce((a,v)=>Math.max(a,v),-Infinity)-usable.reduce((a,v)=>Math.min(a,v),Infinity)};
  }
  function sample(input,raw={}){
    const start=performance.now(),g=geometry(input,raw),n=g.s.pupilGrid,radius=g.reference.exitPupil.radiusMm,width=2*g.s.pupilExtent*radius,h=Math.max(radius*1e-4,1e-5);
    const b=atLaunch(g,g.chief.p.y,0),by=atLaunch(g,g.chief.p.y+h,0),bz=atLaunch(g,g.chief.p.y,h);
    if(!b.ok||!by.ok||!bz.ok)throw Error('Central pupil mapping failed');
    const jac=[(by.u-b.u)/h,(bz.u-b.u)/h,(by.v-b.v)/h,(bz.v-b.v)/h];
    if(Math.abs(jac[0]*jac[3]-jac[1]*jac[2])<1e-8)throw Error('Singular central pupil mapping');
    const atlas=g.s.pupilBoundary?boundaryAtlas(g):null,lookup=atlas?B.seedIndex(atlas):null,recovery={attemptedCoordinates:0,initialFailures:0,recoveredTransmitted:0,recoveredBlocked:0,ambiguous:0,rayCalls:0,rayBudget:(g.s.boundaryBudget??8192)*4};
    const mask=[],classifications=[],rawOpdMm=[],coordinates=[],reasons={},mapping=[];let border=0,maxResidual=0,nominal=0,nominalClear=0,failedInside=0,maxCondition=0,backtracks=0;const failureDetails={};
    for(let row=0;row<n;row++)for(let col=0;col<n;col++){
      const u=((col+.5)/n-.5)*width,v=((row+.5)/n-.5)*width,inside=u*u+v*v<=radius*radius;let q=inverse(g,u,v,jac);
      if(!q.ok&&q.kind!=='blocked'){recovery.initialFailures++;if(lookup&&recovery.rayCalls<recovery.rayBudget){const seeds=lookup(u,v);if(seeds.length){const before=g.traceCount;recovery.attemptedCoordinates++;q=recover(g,u,v,jac,seeds,q);recovery.rayCalls+=g.traceCount-before;if(q.ok)recovery.recoveredTransmitted++;else if(q.kind==='blocked')recovery.recoveredBlocked++;else if(q.kind==='ambiguous')recovery.ambiguous++;}}}
      classifications.push(q.ok?1:q.kind==='blocked'?2:q.kind==='ambiguous'?4:3);
      mask.push(q.ok?1:0);rawOpdMm.push(q.ok?q.opdMm:null);coordinates.push([u/radius,v/radius]);
      if(inside){nominal++;if(q.ok)nominalClear++;}
      maxCondition=Math.max(maxCondition,q.maxCondition||0);backtracks+=q.backtracks||0;
      if(q.ok){maxResidual=Math.max(maxResidual,q.residualMm);if(row===0||col===0||row===n-1||col===n-1)border++;mapping.push([q.launchY,q.launchZ]);}
      else {if(inside&&q.kind!=='blocked')failedInside++;const why=q.detail||q.reason||q.kind;failureDetails[why]=(failureDetails[why]||0)+1;reasons[q.kind]=(reasons[q.kind]||0)+1;mapping.push(null);}
    }
    const fit=detrend(rawOpdMm,mask,coordinates,g.s.removeTilt),waveMm=g.s.nm*1e-6,opdWaves=fit.values.map(v=>v===null?null:v/waveMm);
    const phaseRiskMask=new Uint8Array(n*n);let maxPhaseStep=0,maxCurvature=0,unsafeEdges=0;for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=y*n+x;if(!mask[i])continue;for(const j of [x+1<n?i+1:-1,y+1<n?i+n:-1])if(j>=0&&mask[j]){const delta=Math.abs(opdWaves[i]-opdWaves[j]);maxPhaseStep=Math.max(maxPhaseStep,delta);if(delta>.25){unsafeEdges++;phaseRiskMask[i]=phaseRiskMask[j]=1;}}if(x>0&&x<n-1&&mask[i-1]&&mask[i+1])maxCurvature=Math.max(maxCurvature,Math.abs(opdWaves[i-1]-2*opdWaves[i]+opdWaves[i+1]));if(y>0&&y<n-1&&mask[i-n]&&mask[i+n])maxCurvature=Math.max(maxCurvature,Math.abs(opdWaves[i-n]-2*opdWaves[i]+opdWaves[i+n]));}
    const forwardClearOutsideGrid=atlas?atlas.points.filter(p=>p.state===B.TRANSMITTED&&(Math.abs(p.u)>width/2||Math.abs(p.v)>width/2)).length:0;
    const failures=[];if(atlas?.edgeTransmitted)failures.push('Forward launch domain does not enclose all sampled transmission');if(atlas?.foldedCells)failures.push('Forward mapping has unresolved fold/singularity evidence');if(forwardClearOutsideGrid)failures.push('Forward transmitted rays lie outside the sampled reference pupil');if(reasons.ambiguous)failures.push('Multiple inverse roots remain ambiguous');if(reasons.unmapped||reasons['folded mapping'])failures.push('Incomplete or folded ray-to-pupil mapping');if(border)failures.push('Clear pupil reaches sampling boundary');if(maxPhaseStep>.25)failures.push('Phase sampling unresolved: adjacent OPD exceeds 0.25 waves');
    const numericalAperture=radius/g.reference.radiusMm;
    const status=failures.length||atlas?'EXPERIMENTAL':g.s.field===0&&numericalAperture<=.05&&nominalClear===nominal?'VALIDATED SCALAR/PARAXIAL REGIME':'EXPERIMENTAL';
    return {schemaVersion:1,engineVersion:VERSION,settings:g.s,reference:g.reference,referencePathMm:g.referencePath,grid:n,pupilWidthMm:width,pupilRadiusMm:radius,coordinates,mask,classifications,classificationLegend:{1:B.TRANSMITTED,2:B.BLOCKED,3:B.FAILED,4:B.UNKNOWN},pupilBoundary:atlas,phaseRiskMask,rawOpdMm,opdWaves,launchCoordinatesMm:mapping,pistonMm:fit.pistonMm,removedTiltMm:fit.tiltMmPerNormalizedPupil,rmsWaves:fit.rmsMm/waveMm,pvWaves:fit.pvMm/waveMm,rmsMm:fit.rmsMm,pvMm:fit.pvMm,validSamples:mask.reduce((a,b)=>a+b,0),pupilCoverage:nominalClear/nominal,maxMappingResidualMm:maxResidual,maxAdjacentPhaseWaves:maxPhaseStep,numericalAperture,reasons,diagnostics:{traceCount:g.traceCount,forwardClearOutsideGrid,forwardFoldedCells:atlas?.foldedCells||0,boundaryRecovery:atlas?recovery:null,failedInsideNominalPupil:failedInside,failureDetails,maxJacobianCondition:maxCondition,backtracks,unresolvedPhaseEdges:unsafeEdges,estimatedUniformGridForPhase:Math.max(n,2**Math.ceil(Math.log2(n*maxPhaseStep/.25))),phaseGridEstimateNote:'First-order gradient estimate, not a convergence guarantee',maxPhaseGradientWavesPerMm:maxPhaseStep/(width/n),maxPhaseCurvatureWavesPerCell2:maxCurvature,clippedSquareFraction:(reasons.blocked||0)/(n*n),missingSquareFraction:((reasons.unmapped||0)+(reasons['folded mapping']||0)+(reasons.ambiguous||0))/(n*n),borderClearSamples:border,phaseRepresentation:'Unwrapped optical path, not wrapped phase'},diffractionEligible:failures.length===0,status,limitations:[...failures,'Uniform amplitude on sampled reference sphere; no coatings, Fresnel loss or calibrated illumination','Off-axis chief-normal diffraction mapping remains experimental','No defocus removal; fixed shared physical image plane'],elapsedMs:performance.now()-start};
  }
  const api={VERSION,settings,exitPupil,sphereIntersection,geometry,atLaunch,inverse,forwardProbe,boundaryAtlas,recover,detrend,sample};root.LBWavefront=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
