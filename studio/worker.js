'use strict';
importScripts('../build-info.js','../materials/catalog.js','../optics/core.js','../analysis/aberrations.js','../analysis/evaluate.js','../analysis/multi-aperture.js','../synthesis/physics.js','../design/merit.js','../optimization/search.js','../optimization/explorer.js','../optimization/dls.js','../optimization/experiment.js','../synthesis/forms.js','../synthesis/specification.js','../synthesis/seeds.js','../synthesis/engine.js','../synthesis/glass.js','../synthesis/refine.js','./project.js','./engine.js');
importScripts('../optimization/aperture-continuation.js','../optimization/design-challenge.js');
let busy=false,pause=false;
onmessage=async({data})=>{
 if(data.type==='pause'){pause=true;return;}
 if(data.type!=='run'||busy){postMessage({type:'error',error:'Unknown request or worker already running'});return;}
 busy=true;pause=false;
 try{
  const p=LBStudioProject.restore(data.project),run=p.runs.find(r=>r.id===data.runId);if(!run)throw Error('Run not found');
  // Caller sends only stable checkpoints. Imported results are always revalidated.
  while(!run.done||run.needsVerification){await LBStudioEngine.step(p,run,{yield:()=>new Promise(resolve=>setTimeout(resolve,0))});postMessage({type:'checkpoint',run});if(pause)break;await new Promise(resolve=>setTimeout(resolve,0));}
  postMessage({type:pause?'paused':'done',run});
 }catch(e){postMessage({type:'error',error:e.message});}finally{busy=false;}
};
