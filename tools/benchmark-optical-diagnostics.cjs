const fs=require('node:fs'),cp=require('node:child_process'),crypto=require('node:crypto'),{performance}=require('node:perf_hooks');
const D=require('../optimization/dls'),X=require('../optimization/experiment'),M=require('../design/merit'),O=require('../optics/core'),S=require('../synthesis/engine'),G=require('../synthesis/seeds'),Pool=require('../optimization/pool'),adapter=require('./worker-adapter.cjs'),C=require('../synthesis/chromatic');
const suite=require('../benchmarks/optical-suite-v1.json');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
async function run(){
 const f=suite.cases.find(f=>f.id==='omit50'),spec=S.analysisSpec(f.specification),variables=G.variables(f.system,f.specification),out={schemaVersion:1,sourceCommit:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceHashes:Object.fromEntries(['optimization/dls.js','optimization/experiment.js','optics/core.js','design/merit.js'].map(p=>[p,sha(p)])),suiteSHA256:sha('benchmarks/optical-suite-v1.json'),timestamp:new Date().toISOString(),input:'omit50',workerScaling:[]};
 // Warm-up and repetitions use the same valid prescription. Count real full traces.
 const c=O.compile(f.system),ray={p:{x:c.startX,y:1,z:.5},d:{x:1,y:.02,z:.005}};
 for(let i=0;i<10000;i++)O.trace(c,ray);
 let t=performance.now(),valid=0;const n=100000;for(let i=0;i<n;i++)valid+=O.trace(c,ray).ok?1:0;
 out.rays={count:n,valid,elapsedMs:performance.now()-t};out.rays.perSecond=1000*n/out.rays.elapsedMs;
 for(let i=0;i<5;i++)M.evaluate(f.system,spec,f.operands);
 t=performance.now();for(let i=0;i<50;i++)M.evaluate(f.system,spec,f.operands);out.merit={evaluations:50,elapsedMs:performance.now()-t};out.merit.perSecond=50000/out.merit.elapsedMs;
 let first;
 for(const workers of [1,2,4]){const pool=new Pool(workers,adapter);try{
  const r=await X.search(f.system,spec,variables,f.operands,{method:'de',budget:240,seed:1001,pool});
  // Repeat after worker startup to measure steady-state, not startup latency.
  t=performance.now();const repeated=await X.search(f.system,spec,variables,f.operands,{method:'de',budget:240,seed:1001,pool});const ms=performance.now()-t;
  const key=JSON.stringify([repeated.candidate,repeated.searchScore,repeated.history]);if(first&&key!==first)throw Error('Worker ordering changed deterministic result');first=key;
  out.workerScaling.push({workers,method:'de',evaluations:repeated.evaluations,elapsedMs:ms,evaluationsPerSecond:1000*repeated.evaluations/ms,identicalOrderedResult:true});
 }finally{pool.close();}}
 out.localThroughput=[];for(const method of ['dls-curvature','hybrid']){t=performance.now();const r=await X.search(f.system,spec,variables,f.operands,{method,budget:400,seed:1001});out.localThroughput.push({method,evaluations:r.evaluations,elapsedMs:performance.now()-t,jacobian:r.stages.at(-1)?.jacobian});}
 const ops=[{metric:'rms',field:0},{metric:'rms',field:1},{metric:'sphericalZonal',field:0},{metric:'comaEven',field:.3},{metric:'astigmatism',field:1},{metric:'fieldCurvature',field:1},{metric:'longitudinalColor'},{metric:'lateralColor',field:1},{metric:'distortion',field:1},{metric:'rayLoss'}].map(o=>({...o,aperture:2,target:0,weight:1,scale:1}));
 const state=D.create(f.system,spec,variables,ops,{maxEvaluations:1000}),base=D.evaluate(state,state.x);let calls=0;t=performance.now();
 const jac=D.jacobian(state.x,base,x=>{calls++;return D.evaluate(state,x);},state.config);
 out.sensitivity={description:'Physical diagnostic residuals per normalized parameter; scales=1 mm, 1 percentage point or 1 fraction. Independent of the unchanged benchmark merit.',operands:ops,variables,stateVector:state.x,baselineResiduals:base.residual,...jac,evaluations:calls,elapsedMs:performance.now()-t};
 out.sampling=[];for(const grid of [19,25,31,41]){t=performance.now();const r=X.dense(f.system,spec,variables,f.operands,grid);out.sampling.push({grid,score:r.score,elapsedMs:performance.now()-t,apertures:r.analysis.apertures?.map(ap=>({fNumber:ap.config.fNumber,centerRmsMm:ap.analysis.fields[0].rmsMm,edgeRmsMm:ap.analysis.fields.at(-1).rmsMm}))});}
 out.glasses=f.specification.allowedGlasses.map(C.descriptor);out.thinAchromatPairs=C.pairs(f.specification.allowedGlasses);
 fs.writeFileSync('benchmarks/optical-diagnostics-v1.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({rays:out.rays,merit:out.merit,workerScaling:out.workerScaling,sampling:out.sampling,sensitivity:{evaluations:calls,elapsedMs:out.sensitivity.elapsedMs}},null,2));
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={run};
