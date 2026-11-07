const fs=require('node:fs'),P=require('../optics/preview.js'),O=require('../optics/core.js');
const system=require('../benchmarks/physical-omit50.json').system,nm=587.5618;
const results={fixture:'benchmarks/physical-omit50.json#system',nominal:{eflMm:50,fNumber:2,targetImageCircleMm:46.3},paraxial:O.paraxial(O.compile(system,nm)),cases:[]};
for(const distance of [Infinity,2000]){
 const focus=P.minimize(x=>{const s=P.spot(system,{nm,distance,lensShift:x,samples:64});return {score:s.ok?s.rmsMm:Infinity};});
 const row={objectDistanceMm:distance===Infinity?'infinity':distance,focus,
  nominalPoseCenter:P.spot(system,{nm,distance,samples:256}),fields:[],preview:[]};
 if(distance===2000)row.observedV11BrowserFocus={shiftMm:-1.7504,warning:'max iterations reached',sensorSpot:P.spot(system,{nm,distance,lensShift:-1.7504,samples:256})};
 for(const radius of [0,11.575,23.15]) row.fields.push({nominalImageHeightMm:radius,...P.spot(system,{nm,distance,lensShift:focus.x,fieldY:radius,samples:256})});
 const c=P.pose(system,nm,focus.x);
 for(const spp of [1,16,32,64])for(const y of [0,23.15]){
  const hits=[];for(const p of spp===1?[{y:0,z:0}]:P.disk(spp)){
   const r=P.reverse(c,{x:c.imageX,y,z:0},p);if(!r)continue;
   if(distance===Infinity)hits.push({y:r.d.y/r.d.x,z:r.d.z/r.d.x});
   else {const t=(-distance-r.p.x)/r.d.x;hits.push({y:r.p.y+t*r.d.y,z:r.p.z+t*r.d.z});}
  }
  const cy=hits.reduce((s,p)=>s+p.y,0)/hits.length,cz=hits.reduce((s,p)=>s+p.z,0)/hits.length;
  const rms=Math.sqrt(hits.reduce((s,p)=>s+(p.y-cy)**2+(p.z-cz)**2,0)/hits.length);
  row.preview.push({mode:spp===1?'DOF off / chief ray (no PSF)':'DOF on / geometric',spp,sensorRadiusMm:y,survival:hits.length/spp,rms,units:distance===Infinity?'object direction slope':'object-space mm',note:'Not an image-space spot radius or calibrated illumination'});
 }
 results.cases.push(row);
}
fs.writeFileSync('benchmarks/preview-omit50.json',JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results.cases.map(c=>({distance:c.objectDistanceMm,shift:c.focus.x,centerRmsMm:c.fields[0].rmsMm,edgeRmsMm:c.fields[2].rmsMm,oldBrowserRmsMm:c.observedV11BrowserFocus?.sensorSpot.rmsMm})),null,2));
