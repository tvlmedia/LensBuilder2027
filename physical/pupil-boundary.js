/* Sample-based launch-plane pupil atlas. No convex hull, radial-boundary assumption,
   zero filling or nonuniform Fourier transform. Coordinates and areas are in mm. */
(function(root){
 'use strict';
 const TRANSMITTED='TRANSMITTED',BLOCKED='PHYSICALLY BLOCKED',FAILED='NUMERICAL MAPPING FAILURE',UNKNOWN='AMBIGUOUS / UNRESOLVED';
 const STATES=[TRANSMITTED,BLOCKED,FAILED,UNKNOWN];
 function detect(probe,options={}){
  const {halfWidthMm=1,centerX=0,centerY=0,minDepth=4,maxDepth=8,budget=12000,phaseLimitWaves=.25,mappingToleranceMm=.002}=options;
  if(typeof probe!=='function'||![halfWidthMm,centerX,centerY,phaseLimitWaves,mappingToleranceMm].every(Number.isFinite)||halfWidthMm<=0||phaseLimitWaves<=0||mappingToleranceMm<=0||!Number.isInteger(minDepth)||!Number.isInteger(maxDepth)||minDepth<1||maxDepth<minDepth||maxDepth>10||!Number.isInteger(budget)||budget<(2**(minDepth+1)+1)**2||budget>300000)throw Error('Invalid bounded pupil atlas settings');
  const start=performance.now(),size=2**(maxDepth+1),step=2*halfWidthMm/size,cache=new Map(),leaves=new Map(),queue=[];
  const key=(x,y)=>y*(size+1)+x;
  const coords=(x,y)=>({x:centerX+(x-size/2)*step,y:centerY+(y-size/2)*step});
  function point(x,y){const k=key(x,y);if(cache.has(k))return cache.get(k);const p=coords(x,y);let r;try{r=probe(p.x,p.y);}catch(e){r={state:UNKNOWN,reason:e.message};}if(!r||!STATES.includes(r.state))r={state:UNKNOWN,reason:'Invalid forward classification'};const q={...r,...p,id:k};cache.set(k,q);return q;}
  function nodes(c){const h=c.w/2,out=[];for(let j=0;j<3;j++)for(let i=0;i<3;i++)out.push([c.x+i*h,c.y+j*h]);return out;}
  function push(c){queue.push(c);let i=queue.length-1;while(i){const p=(i-1)>>1;if(queue[p].priority>=c.priority)break;queue[i]=queue[p];i=p;}queue[i]=c;}
  function pop(){const first=queue[0],last=queue.pop();if(queue.length){let i=0;while(i*2+1<queue.length){let j=i*2+1;if(j+1<queue.length&&queue[j+1].priority>queue[j].priority)j++;if(queue[j].priority<=last.priority)break;queue[i]=queue[j];i=j;}queue[i]=last;}return first;}
  function build(c){
   c.samples=nodes(c).map(([x,y])=>point(x,y));const states=new Set(c.samples.map(p=>p.state));
   c.mixed=states.size>1;c.state=c.mixed?UNKNOWN:c.samples[0].state;
   const t=c.samples.filter(p=>p.state===TRANSMITTED),opd=t.map(p=>p.opdWaves).filter(Number.isFinite);
   c.phaseRange=opd.length?Math.max(...opd)-Math.min(...opd):0;c.fold=false;c.warp=0;
   if(t.length===9&&t.every(p=>Number.isFinite(p.u)&&Number.isFinite(p.v))){
    const cross=(a,b,c)=>(b.u-a.u)*(c.v-a.v)-(b.v-a.v)*(c.u-a.u);
    const signs=[[0,1,3],[1,2,4],[3,4,6],[4,5,7]].map(([i,j,k])=>Math.sign(cross(c.samples[i],c.samples[j],c.samples[k])));
    c.fold=signs.includes(0)||new Set(signs).size>1;c.orientation=c.fold?0:signs[0];
    c.warp=Math.hypot(c.samples[4].u-[0,2,6,8].reduce((s,i)=>s+c.samples[i].u,0)/4,c.samples[4].v-[0,2,6,8].reduce((s,i)=>s+c.samples[i].v,0)/4);
    if(c.fold)c.state=UNKNOWN;
   }
   c.priority=c.mixed?100:c.fold?90:states.has(FAILED)||states.has(UNKNOWN)?80:Math.max(c.phaseRange/phaseLimitWaves,c.warp/mappingToleranceMm)>1?Math.min(50,Math.max(c.phaseRange/phaseLimitWaves,c.warp/mappingToleranceMm)):0;
   c.priority*=c.w/size;
   leaves.set(c.id,c);if(c.depth<maxDepth&&c.priority>0)push(c);return c;
  }
  const base=2**minDepth,width=size/base;let id=0;
  for(let j=0;j<base;j++)for(let i=0;i<base;i++)build({id:id++,x:i*width,y:j*width,w:width,depth:minDepth});
  let budgetLimited=false;
  while(queue.length){const c=pop(),h=c.w/2,children=[];for(let j=0;j<2;j++)for(let i=0;i<2;i++)children.push({id:id++,x:c.x+i*h,y:c.y+j*h,w:h,depth:c.depth+1});
   const missing=new Set();for(const child of children)for(const [x,y]of nodes(child))if(!cache.has(key(x,y)))missing.add(key(x,y));
   if(cache.size+missing.size>budget){budgetLimited=true;continue;}
   leaves.delete(c.id);children.forEach(build);
  }
  const orientations=new Set([...leaves.values()].map(c=>c.orientation).filter(Boolean)),orientationConflict=orientations.size>1;
  // Opposite orientations in separate cells can meet exactly on a subdivision edge.
  // Keep the complete mapped region uncertain rather than missing that fold.
  if(orientationConflict)for(const c of leaves.values())if(c.orientation){c.fold=true;c.state=UNKNOWN;}
  const points=[...cache.values()],cells=[],brackets=[],seen=new Set(),areas=Object.fromEntries(STATES.map(s=>[s,0]));let sampledArea=0,mappedArea=0,foldedCells=0,phaseRiskCells=0,largestBoundaryCell=0;
  for(const c of leaves.values()){
   const area=(c.w*step)**2,p=coords(c.x,c.y);areas[c.state]+=area;sampledArea+=area*c.samples.filter(q=>q.state===TRANSMITTED).length/9;
   if(c.fold)foldedCells++;if(c.phaseRange>phaseLimitWaves)phaseRiskCells++;
   if(c.mixed||c.state===UNKNOWN||c.state===FAILED)largestBoundaryCell=Math.max(largestBoundaryCell,c.w*step);
   if(c.state===TRANSMITTED&&c.samples.every(q=>Number.isFinite(q.u)&&Number.isFinite(q.v))){const corners=[0,2,8,6].map(i=>c.samples[i]);mappedArea+=Math.abs(corners.reduce((s,q,i)=>{const r=corners[(i+1)%4];return s+q.u*r.v-q.v*r.u;},0))/2;}
   cells.push({x:p.x,y:p.y,widthMm:c.w*step,depth:c.depth,state:c.state,phaseRangeWaves:c.phaseRange,mappingWarpMm:c.warp,fold:c.fold});
   for(const [a,b]of [[0,1],[1,2],[2,5],[5,8],[8,7],[7,6],[6,3],[3,0]]){const p=c.samples[a],q=c.samples[b];if(!((p.state===TRANSMITTED&&q.state===BLOCKED)||(q.state===TRANSMITTED&&p.state===BLOCKED)))continue;const k=[p.id,q.id].sort((x,y)=>x-y).join(':');if(seen.has(k))continue;seen.add(k);const inside=p.state===TRANSMITTED?p:q,outside=inside===p?q:p;brackets.push({inside:{x:inside.x,y:inside.y,u:inside.u,v:inside.v},outside:{x:outside.x,y:outside.y,reason:outside.reason,surface:outside.surface},widthMm:Math.hypot(p.x-q.x,p.y-q.y)});}
  }
  const counts=Object.fromEntries(STATES.map(s=>[s,0])),blockingSurfaces={};for(const p of points){counts[p.state]++;if(p.state===BLOCKED){const k=p.surface===undefined?p.reason:'surface '+p.surface+' · '+p.reason;blockingSurfaces[k]=(blockingSurfaces[k]||0)+1;}}
  const domainArea=4*halfWidthMm**2,edgeTransmitted=points.some(p=>p.state===TRANSMITTED&&(Math.abs(p.x-centerX)>=halfWidthMm-1e-12||Math.abs(p.y-centerY)>=halfWidthMm-1e-12));
  return {version:'pupil-boundary-1',status:'EXPERIMENTAL SAMPLED GEOMETRY',settings:{halfWidthMm,centerX,centerY,minDepth,maxDepth,budget,phaseLimitWaves,mappingToleranceMm},points,cells,boundaryBrackets:brackets,counts,blockingSurfaces,traceCalls:cache.size,budgetLimited,edgeTransmitted,orientationConflict,foldedCells,phaseRiskCells,largestBoundaryCellMm:largestBoundaryCell,area:{domainMm2:domainArea,sampledTransmittedMm2:sampledArea,homogeneousTransmittedCellsMm2:areas[TRANSMITTED],unresolvedCellsMm2:areas[UNKNOWN]+areas[FAILED],unresolvedFraction:(areas[UNKNOWN]+areas[FAILED])/domainArea,cellClassificationMm2:areas,mappedInteriorEstimateMm2:mappedArea,meaning:'Launch-plane sample-based area estimates, not certified bounds. Mapped area excludes unresolved cells; neither is calibrated throughput.'},limitations:['Finite probes can miss sub-cell holes or disconnected islands; no continuum completeness guarantee','No circular, convex or simply-connected boundary assumption; transition brackets are not joined across uncertain cells','Missed surfaces and invalid forward traces remain unresolved; only explicit aperture clipping or TIR is physically blocked','Forward atlas never supplies zero transmission to the Fourier pupil'],elapsedMs:performance.now()-start};
 }
 function classifier(atlas){
  const {halfWidthMm:r,centerX,centerY,minDepth,maxDepth}=atlas.settings,map=new Map();
  for(const c of atlas.cells){const n=2**c.depth,i=Math.round((c.x-centerX+r)/(2*r)*n),j=Math.round((c.y-centerY+r)/(2*r)*n);map.set(c.depth+':'+i+':'+j,c.state);}
  return (x,y)=>{const u=(x-centerX+r)/(2*r),v=(y-centerY+r)/(2*r);if(u<0||v<0||u>1||v>1)return UNKNOWN;for(let d=minDepth;d<=maxDepth;d++){const n=2**d,k=d+':'+Math.min(n-1,Math.floor(u*n))+':'+Math.min(n-1,Math.floor(v*n));if(map.has(k))return map.get(k);}return UNKNOWN;};
 }
 // Spatial index supplies initial guesses only. Every inverse solution must still be traced.
 function seedIndex(atlas,bins=32){
  const pts=atlas.points.filter(p=>p.state===TRANSMITTED&&Number.isFinite(p.u)&&Number.isFinite(p.v));if(!pts.length)return ()=>[];
  let minU=Infinity,maxU=-Infinity,minV=Infinity,maxV=-Infinity;for(const p of pts){minU=Math.min(minU,p.u);maxU=Math.max(maxU,p.u);minV=Math.min(minV,p.v);maxV=Math.max(maxV,p.v);}
  const du=Math.max((maxU-minU)/bins,1e-9),dv=Math.max((maxV-minV)/bins,1e-9),map=new Map();
  for(const p of pts){const i=Math.floor((p.u-minU)/du),j=Math.floor((p.v-minV)/dv),k=i+','+j;if(!map.has(k))map.set(k,[]);map.get(k).push(p);}
  return (u,v)=>{const i=Math.floor((u-minU)/du),j=Math.floor((v-minV)/dv),near=[];for(let y=j-1;y<=j+1;y++)for(let x=i-1;x<=i+1;x++)for(const p of map.get(x+','+y)||[])near.push(p);near.sort((a,b)=>(a.u-u)**2+(a.v-v)**2-((b.u-u)**2+(b.v-v)**2));const out=[];for(const p of near){if(out.every(q=>Math.hypot(p.x-q.x,p.y-q.y)>atlas.settings.halfWidthMm*.02))out.push(p);if(out.length===3)break;}return out;};
 }
 const api={TRANSMITTED,BLOCKED,FAILED,UNKNOWN,STATES,detect,classifier,seedIndex};root.LBPupilBoundary=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
