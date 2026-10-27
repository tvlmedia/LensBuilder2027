/* Reproducible topology tournament; all old numerical engines are reused. */
const fs=require('node:fs'),cp=require('node:child_process'),crypto=require('node:crypto');
require('../build-info');
const J=require('../studio/project'),T=require('../studio/engine'),X=require('../studio/export'),M=require('../design/merit'),S=require('../synthesis/engine'),Experiment=require('../optimization/experiment'),Seeds=require('../synthesis/seeds');
const compact=x=>JSON.parse(JSON.stringify(x,(k,v)=>['hits','rows'].includes(k)?undefined:v));
async function run(){
 const start=performance.now(),p=J.create(J.defaultBrief(),{totalBudget:Number(process.env.LB_STUDIO_BUDGET||16384)}),fixture=require('../benchmarks/physical-omit50.json'),refRun=p.runs.find(r=>r.topology==='modified-gauss');
 const reference=T.validate(p,refRun,{id:'historical-omit50',system:fixture.system,ordinal:0,topology:'modified-gauss'});
 for(const r of p.runs){console.log('Studio',r.id);while(!r.done)await T.step(p,r);console.log(r.id,T.select(r.results)[0]?.dense.score??'no valid finalist',r.costs);}
 const winners=p.settings.topologies.map(topology=>({topology,best:J.ranked(p).find(i=>i.topology===topology)||null})),best=J.ranked(p)[0]||null;
 // Historical merit is separately remeasured with its original objective/grid.
 const historicalCase=require('../benchmarks/optical-suite-v1.json').cases.find(c=>c.id==='omit50');
 const oldSpec=S.analysisSpec(historicalCase.specification),legacy=system=>Experiment.dense(system,oldSpec,Seeds.variables(system,historicalCase.specification),historicalCase.operands);
 const legacyReference=legacy(fixture.system),legacyWinner=best?legacy(best.system):null;
 const report={version:require('../package.json').version,build:globalThis.LB_BUILD,sourceCommit:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),runtime:{node:process.version,platform:process.platform,arch:process.arch},referenceFixtureSHA256:crypto.createHash('sha256').update(fs.readFileSync('benchmarks/physical-omit50.json')).digest('hex'),brief:p.brief,settings:p.settings,operands:p.operands,contract:p.contract,summary:T.summary(p),winners,reference,historical:{publishedMerit:fixture.merit,remeasuredReferenceMerit:legacyReference.score,winnerUnderHistoricalObjective:legacyWinner?.score??null,referencePerformance:compact(legacyReference.analysis),winnerPerformance:compact(legacyWinner?.analysis??null),referenceStudioEligibility:reference.status,referenceStudioRejection:reference.dense.reason||null,note:'Historical and studio character objectives have different definitions; only compare scores within the same objective.'},improvement:best&&reference.status==='DENSE VALIDATED'?{referenceScore:reference.dense.score,winnerScore:best.dense.score,percent:100*(reference.dense.score-best.dense.score)/reference.dense.score}:null,totalMs:performance.now()-start,limitations:['Same maximum allocations, not equal actual evaluations. Unused stage work is reported, not redistributed.','Finite budgets do not establish the best possible topology.','Sampled pupil survival is not certified image-circle coverage or throughput.','No physical MTF enters the tournament objective; engineering exports are not manufacturing-ready.']};
 fs.writeFileSync('benchmarks/omit-studio-v1.json',JSON.stringify(report,null,2)+'\n');
 if(best){const q=X.packageFor(p,best.id);fs.writeFileSync('benchmarks/omit-studio-winner.json',JSON.stringify(q,null,2)+'\n');fs.writeFileSync('benchmarks/omit-studio-winner.csv',X.csv(q));fs.writeFileSync('benchmarks/omit-studio-winner.md',X.report(q));}
 console.log(JSON.stringify({best:best?.id,score:best?.dense.score,reference:reference.dense.score,improvement:report.improvement,historical:{reference:legacyReference.score,winner:legacyWinner?.score??null},elapsedMs:report.totalMs}));
}
run().catch(e=>{console.error(e);process.exitCode=1;});
