/* Test-only reference. No production imports. Scalar angular Snell, Newton
   intersection of the sag graph, and finite-height rays for first order.
   Axis x; positive R has its center to the right of the vertex. */
function sag(R,y) { return R===0?0:y*y/(R+Math.sign(R)*Math.sqrt(R*R-y*y)); }
function hit(ray, surface) {
  let distance=(surface.x-ray.x)/Math.cos(ray.angle);
  for(let i=0;i<30;i++) {
    const y=ray.y+distance*Math.sin(ray.angle), x=ray.x+distance*Math.cos(ray.angle);
    if(surface.R && Math.abs(y)>=Math.abs(surface.R)) return null;
    const slope=surface.R?Math.sign(surface.R)*y/Math.sqrt(surface.R**2-y*y):0;
    const error=x-surface.x-sag(surface.R,y);
    if(Math.abs(error)<1e-12) return {x,y,normalAngle:-Math.atan(slope)};
    distance-=error/(Math.cos(ray.angle)-slope*Math.sin(ray.angle));
  }
  throw Error('Reference Newton intersection did not converge');
}
function bend(angle, normal, n1,n2) {
  const sine=n1/n2*Math.sin(angle-normal);
  return Math.abs(sine)>1?null:normal+Math.asin(sine);
}
function trace(surfaces, ray, imageX, stop=false) {
  let r={...ray}, n=1; const points=[];
  for(const s of surfaces) {
    const h=hit(r,s); if(!h)return {ok:false,reason:'miss'};
    if(Math.abs(h.y)>s.ap+1e-8)return {ok:false,reason:'clipped'};
    points.push(h);
    if(stop&&s.stop)return {ok:true,...h,points};
    const angle=bend(r.angle,h.normalAngle,n,s.n);if(angle===null)return {ok:false,reason:'tir'};
    r={x:h.x,y:h.y,angle};n=s.n;
  }
  return {ok:true,x:imageX,y:r.y+(imageX-r.x)*Math.tan(r.angle),last:r,points};
}
function firstOrder(surfaces) {
  // Independent differential tracing rather than ABCD matrix multiplication.
  const eps=1e-5, lastX=surfaces.at(-1).x;
  const a=trace(surfaces,{x:0,y:eps,angle:0},lastX);
  const b=trace(surfaces,{x:0,y:0,angle:eps},lastX);
  const A=a.y/eps,C=a.last.angle/eps,B=b.y/eps,D=b.last.angle/eps;
  const efl=-1/C,bfl=-A/C,front=(D-1)/C,rear=lastX+(1-A)/C;
  const sa=trace(surfaces,{x:0,y:eps,angle:0},lastX,true),sb=trace(surfaces,{x:0,y:0,angle:eps},lastX,true);
  const pupilX=sb.y/sa.y,pupilRadius=surfaces.find(s=>s.stop).ap/Math.abs(sa.y/eps);
  return {A,B,C,D,efl,bfl,front,rear,pupilX,pupilRadius,fNumber:Math.abs(efl)/(2*pupilRadius)};
}
function compile(system, index) {
  let x=0;return system.surfaces.slice(1,-1).map(s=>{const r={x,R:s.R,ap:s.ap,n:index(s),stop:s.stop};x+=s.t;return r;});
}
module.exports={sag,hit,bend,trace,firstOrder,compile};
