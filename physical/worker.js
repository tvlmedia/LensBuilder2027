'use strict';
importScripts('../build-info.js','../materials/catalog.js','../optics/core.js','../analysis/aberrations.js','../analysis/evaluate.js','../analysis/multi-aperture.js','./limits.js','./wavefront.js','./zernike.js','./fourier.js','./spectrum.js','./convergence.js','./engine.js');
onmessage=event=>{
 const {id,type,system,config,offsets}=event.data;
 try{if(!['analyze','focus-scan'].includes(type))throw Error('Unknown physical worker request');const result=type==='focus-scan'?LBPhysical.focusScan(system,config,offsets):LBPhysical.batch(system,config,progress=>postMessage({id,type:'progress',progress}));postMessage({id,type:'result',result});}catch(e){postMessage({id,type:'error',error:e.message});}
};
