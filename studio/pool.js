/* Parallelism across independent topology/seed runs, never competing for a budget. */
(function(root){
 'use strict';
 class Pool{
  constructor(url){this.url=url;this.active=new Map();this.pausing=false;}
  async run(project,onCheckpoint=()=>{}){
   this.pausing=false;const pending=project.runs.filter(r=>!r.done||r.needsVerification).map(r=>r.id);let failure=null;
   const lane=async()=>{while(pending.length&&!this.pausing&&!failure){const runId=pending.shift();await new Promise(resolve=>{
    const w=new Worker(this.url);this.active.set(runId,w);
    const finish=()=>{w.terminate();this.active.delete(runId);resolve();};
    w.onmessage=({data})=>{if(data.run){project.runs[project.runs.findIndex(r=>r.id===runId)]=data.run;onCheckpoint(project,runId);}
     if(data.type==='error'){failure=Error(data.error);this.pause();finish();}else if(data.type==='done'||data.type==='paused')finish();};
    w.onerror=e=>{failure=Error(e.message);this.pause();finish();};
    // Only this run's mutable checkpoint is sent; the project contract is shared.
    const payload={...project,physical:[],events:[],runs:project.runs.map(r=>r.id===runId?r:{id:r.id,topology:r.topology,seed:r.seed,stage:'QUEUED',done:false,costs:{},results:[],history:[]})};
    w.postMessage({type:'run',project:payload,runId});
   });}};
   await Promise.all(Array.from({length:Math.min(project.settings.workers,pending.length)},lane));
   if(failure)throw failure;return {paused:this.pausing};
  }
  pause(){this.pausing=true;for(const w of this.active.values())w.postMessage({type:'pause'});}
 }
 root.LBStudioPool=Pool;if(typeof module!=='undefined')module.exports=Pool;
})(globalThis);
