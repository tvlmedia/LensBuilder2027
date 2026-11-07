/* Deterministic preview diagnostics. Uses the same spherical Snell kernel as evaluation. */
(function(root) {
  'use strict';
  const O = root.LBOptics || require('./core.js');
  function disk(count) {
    return Array.from({length: count}, (_, i) => {
      const r = Math.sqrt((i + .5) / count), t = i * Math.PI * (3 - Math.sqrt(5));
      return {y: r * Math.cos(t), z: r * Math.sin(t)};
    });
  }
  function pose(system, nm, lensShift = 0, sensorShift = 0) {
    const c = O.compile(system, nm);
    c.surfaces = c.surfaces.map(s => ({...s, vx: s.vx + lensShift}));
    c.startX += lensShift;
    c.imageX += sensorShift;
    return c;
  }
  // Object distance is measured from the unshifted first vertex. Moving a lens
  // must not move the scene with it. Infinity is represented by parallel rays.
  function aim(c, target, distance, slopeY, slopeZ) {
    let y = target.y - (c.surfaces[c.stopIndex].vx - c.startX) * slopeY;
    let z = target.z - (c.surfaces[c.stopIndex].vx - c.startX) * slopeZ;
    const ray = (y,z) => ({p:{x:c.startX,y,z}, d:O.unit(Number.isFinite(distance)
      ? {x:c.startX+distance,y:y+distance*slopeY,z:z+distance*slopeZ}
      : {x:1,y:slopeY,z:slopeZ})});
    const hit = (y,z) => O.trace(c, ray(y,z), {clip:false,toStop:true});
    for(let k=0;k<16;k++) {
      const h=hit(y,z); if(!h.ok) return null;
      const ey=h.hit.y-target.y, ez=h.hit.z-target.z;
      if(Math.hypot(ey,ez)<1e-7) return ray(y,z);
      const e=1e-4, hy=hit(y+e,z), hz=hit(y,z+e); if(!hy.ok||!hz.ok) return null;
      const a=(hy.hit.y-h.hit.y)/e,b=(hz.hit.y-h.hit.y)/e,
        d=(hy.hit.z-h.hit.z)/e,f=(hz.hit.z-h.hit.z)/e,det=a*f-b*d;
      if(Math.abs(det)<1e-12) return null;
      y-=(f*ey-b*ez)/det; z-=(-d*ey+a*ez)/det;
    }
    return null;
  }
  function spot(system, {nm=587.5618,distance=Infinity,lensShift=0,sensorShift=0,fieldY=0,fieldZ=0,samples=64}={}) {
    try {
      if(!(distance>0)||![lensShift,sensorShift,fieldY,fieldZ].every(Number.isFinite)) throw Error('Invalid focus state');
      const c=pose(system,nm,lensShift,sensorShift), f=O.paraxial(c), hits=[];
      for(const p of disk(samples)) {
        const ap=c.surfaces[c.stopIndex].ap;
        const r=aim(c,{y:p.y*ap,z:p.z*ap},distance,fieldY/f.eflMm,fieldZ/f.eflMm);
        if(!r) continue;
        const t=O.trace(c,r); if(t.ok) hits.push(t.hit);
      }
      const hitRate=hits.length/samples;
      if(hits.length<4||hitRate<.3) return {ok:false,rmsMm:null,hitRate,raysUsed:samples,validHits:hits.length};
      const y=hits.reduce((a,h)=>a+h.y,0)/hits.length,z=hits.reduce((a,h)=>a+h.z,0)/hits.length;
      const rmsMm=Math.sqrt(hits.reduce((a,h)=>a+(h.y-y)**2+(h.z-z)**2,0)/hits.length);
      const rmsY=Math.sqrt(hits.reduce((a,h)=>a+(h.y-y)**2,0)/hits.length),rmsZ=Math.sqrt(hits.reduce((a,h)=>a+(h.z-z)**2,0)/hits.length);
      return {ok:true,rmsMm,rmsY,rmsZ,hitRate,raysUsed:samples,validHits:hits.length,centroidY:y,centroidZ:z,sensorPlaneX:c.imageX};
    } catch(e) { return {ok:false,rmsMm:null,hitRate:0,raysUsed:0,validHits:0,reason:e.message}; }
  }
  function reverse(c, sensor, pupil) {
    const stop=c.surfaces[c.stopIndex], target={y:pupil.y*stop.ap,z:pupil.z*stop.ap};
    function trace(u,v,toStop=false,clip=true) {
      let ray={p:sensor,d:O.unit({x:-1,y:u,z:v})};
      for(let i=c.surfaces.length-1;i>=0;i--) {
        const s=c.surfaces[i],h=O.intersect(ray,s);
        if(!h || (clip && h.vignetted)) return null;
        if(toStop && i===c.stopIndex) return h.hit;
        const d=O.refract(ray.d,h.normal,s.n2,s.n1); if(!d) return null;
        ray={p:h.hit,d};
      }
      return ray;
    }
    let u=(target.y-sensor.y)/(sensor.x-stop.vx),v=(target.z-sensor.z)/(sensor.x-stop.vx);
    for(let k=0;k<12;k++) {
      const h=trace(u,v,true,false);if(!h) return null;
      const ey=h.y-target.y,ez=h.z-target.z;
      if(Math.hypot(ey,ez)<1e-7) return trace(u,v);
      const e=1e-6,hy=trace(u+e,v,true,false),hz=trace(u,v+e,true,false);if(!hy||!hz)return null;
      const a=(hy.y-h.y)/e,b=(hz.y-h.y)/e,d=(hy.z-h.z)/e,f=(hz.z-h.z)/e,det=a*f-b*d;
      if(Math.abs(det)<1e-12)return null;
      u-=(f*ey-b*ez)/det;v-=(-d*ey+a*ez)/det;
    }
    return null;
  }
  function minimize(evaluate, center=0, range=16) {
    let best=null, evaluations=0;
    function visit(x) {
      const value=evaluate(x); evaluations++;
      if(value && Number.isFinite(value.score) && (!best || value.score<best.value.score)) best={x,value};
    }
    for(let i=0;i<=32;i++) visit(center-range+2*range*i/32);
    if(!best) return {ok:false,reason:'No valid rays at any focus candidate',evaluations};
    const boundary=Math.abs(best.x-center)>=range-1e-9;
    let step=range/16;
    for(let k=0;k<5;k++) {
      const x=best.x; step/=4;
      for(let i=-4;i<=4;i++) visit(x+i*step);
    }
    return {ok:!boundary,x:best.x,...best.value,evaluations,reason:boundary?'Focus minimum outside search range':null};
  }
  function dimensions(longEdge, aspect) {
    const edge=Math.min(1920,Math.max(64,Math.round(longEdge)||512));
    if(!(aspect>0&&Number.isFinite(aspect))) throw Error('Invalid aspect ratio');
    return aspect>=1?{width:edge,height:Math.max(1,Math.round(edge/aspect))}:{width:Math.max(1,Math.round(edge*aspect)),height:edge};
  }
  function latest() { let id=0; return {next:()=>++id, current:x=>x===id}; }
  const api={reverse,disk,pose,aim,spot,minimize,dimensions,latest};
  root.LBPreview=api; if(typeof module!=='undefined') module.exports=api;
})(globalThis);
