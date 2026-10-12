/* Bounded damped Gauss-Newton. New state schema; legacy search stays unchanged. */
(function(root){
  'use strict';
  const M=root.LBMerit||require('../design/merit.js'),L=root.LBSearch||require('./search.js');
  const VERSION='bounded-dls-1';
  const sumsq=v=>v.reduce((s,x)=>s+x*x,0), dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
  function mapping(input,variables,kind='curvature') {
    L.validateVariables(input,variables);
    if(!['radius','curvature'].includes(kind))throw Error('Unknown parameterization');
    return variables.map(v=>{const curved=kind==='curvature'&&v.key==='R',a=curved?1/v.min:v.min,b=curved?1/v.max:v.max;
      return {...v,curved,lo:Math.min(a,b),hi:Math.max(a,b)};});
  }
  function encode(input,vars){return vars.map(v=>{const x=v.key==='stopPosition'?0:input.surfaces[v.surface][v.key];return ((v.curved?1/x:x)-v.lo)/(v.hi-v.lo);});}
  function prescription(s,x){return L.prescription({input:s.input,variables:s.variables},x.map((q,i)=>{const v=s.mapping[i],y=v.lo+q*(v.hi-v.lo);return Math.max(v.min,Math.min(v.max,v.curved?1/y:y));}));}
  function residuals(result){
    if(!result.merit.valid)return {valid:false,reason:result.merit.errors.join('; ')};
    const rows=result.merit.breakdown;
    if(rows.some(o=>['MINIMIZE','MAXIMIZE'].includes(o.type)))throw Error('DLS needs squared target/range residuals; linear directional operands are unsupported');
    const residual=rows.map(o=>Math.sqrt(o.apertureWeight*o.weight)*o.error/o.scale);
    // Exact survivor identities, not merely a count: equal counts can hide swapped rays.
    const analyses=result.analysis.apertures?.map(a=>a.analysis)||[result.analysis];
    const signature=analyses.map(a=>a.rows.map(r=>r.hits.map(h=>`${h.pupilY},${h.pupilZ}`).join('|')).join('/')).join(';');
    return {valid:true,residual,score:sumsq(residual),signature};
  }
  function evaluate(s,x){return residuals(M.evaluate(prescription(s,x),s.spec,s.operands));}
  function options(o={}){
    const out={maxEvaluations:1000,parameterization:'curvature',differenceStep:1e-4,derivativeTolerance:.15,trustRadius:.08,damping:.01,...o};
    if(!Number.isSafeInteger(out.maxEvaluations)||out.maxEvaluations<2||out.maxEvaluations>100000)throw Error('DLS budget must be 2–100000');
    for(const k of ['differenceStep','derivativeTolerance','trustRadius','damping'])if(!Number.isFinite(out[k])||out[k]<=0)throw Error(`Invalid DLS ${k}`);
    if(out.differenceStep>.1||out.trustRadius>1||out.derivativeTolerance>1)throw Error('DLS normalized steps/tolerance outside range');return out;
  }
  function create(input,spec,variables,operands,opts={}){
    M.validateOperands(operands);if(operands.some(o=>o.enabled!==false&&['MINIMIZE','MAXIMIZE'].includes(o.type)))throw Error('DLS requires squared residuals');
    const config=options(opts),map=mapping(input,variables,config.parameterization),x=config.initialVector || encode(input,map);
    if(!Array.isArray(x)||x.length!==map.length||x.some(v=>!Number.isFinite(v)||v<0||v>1))throw Error("Invalid initial normalized vector");
    const s={schemaVersion:1,engineVersion:VERSION,algorithm:VERSION,input:structuredClone(input),spec:structuredClone(spec),variables:structuredClone(variables),operands:structuredClone(operands),mapping:map,config,x,evaluations:0,iteration:0,lambda:config.damping,history:[],rejections:{},done:false};
    s.current=counted(s,x);if(!s.current.valid)throw Error(`Starting lens invalid: ${s.current.reason}`);s.initialScore=s.current.score;s.history.push({evaluations:s.evaluations,score:s.current.score});return s;
  }
  function counted(s,x,objective){
    if(s.evaluations>=s.config.maxEvaluations)return null;
    s.evaluations++;const value=(objective||((x)=>evaluate(s,x)))(x);
    if(!value.valid){const reason=value.reason||'invalid';s.rejections[reason]=(s.rejections[reason]||0)+1;}
    return value;
  }
  // Central h and h/2 columns; shrink at clipped/invalid/unstable perturbations.
  function jacobian(x,base,fn,config){
    const columns=[],diagnostics=[];
    for(let j=0;j<x.length;j++){
      let h=Math.min(config.differenceStep,x[j]/2,(1-x[j])/2),column=null,reason='bound',change=null,used=0;
      for(let retry=0;retry<4&&h>1e-10;retry++,h/=4){
        const samples=[];
        for(const d of [-h,h,-h/2,h/2]){const q=x.slice();q[j]+=d;const r=fn(q);if(r===null)return {budgetExhausted:true,columns,diagnostics};samples.push(r);}
        used=h;
        if(samples.some(r=>!r.valid)){reason='invalid perturbation';continue;}
        if(samples.some(r=>r.signature!==base.signature)){reason='pupil discontinuity';continue;}
        const wide=base.residual.map((_,i)=>(samples[1].residual[i]-samples[0].residual[i])/(2*h));
        const fine=base.residual.map((_,i)=>(samples[3].residual[i]-samples[2].residual[i])/h);
        change=Math.sqrt(sumsq(fine.map((v,i)=>v-wide[i])))/Math.max(1e-8,Math.sqrt(sumsq(fine)));
        if(!fine.every(Number.isFinite)||change>config.derivativeTolerance){reason='unstable derivative';continue;}
        column=fine;reason=Math.sqrt(sumsq(fine))<1e-8?'insensitive':'reliable';break;
      }
      columns.push(column||base.residual.map(()=>0));diagnostics.push({parameter:j,status:reason,step:used,relativeChange:change,norm:column?Math.sqrt(sumsq(column)):0});
    }
    const coupled=[];for(let i=0;i<columns.length;i++)for(let j=i+1;j<columns.length;j++){
      const den=Math.sqrt(sumsq(columns[i])*sumsq(columns[j])),cosine=den?dot(columns[i],columns[j])/den:0;
      if(Math.abs(cosine)>.98)coupled.push({a:i,b:j,cosine});
    }
    const nonzero=diagnostics.map(d=>d.norm).filter(x=>x>1e-8);
    return {columns,diagnostics,coupled,columnNormRatio:nonzero.length?Math.max(...nonzero)/Math.min(...nonzero):null};
  }
  function solve(matrix,rhs){
    const a=matrix.map((r,i)=>[...r,rhs[i]]),n=rhs.length;let minPivot=Infinity,maxPivot=0;
    for(let j=0;j<n;j++){
      let p=j;for(let i=j+1;i<n;i++)if(Math.abs(a[i][j])>Math.abs(a[p][j]))p=i;
      [a[p],a[j]]=[a[j],a[p]];const pivot=Math.abs(a[j][j]);if(pivot<1e-20||!Number.isFinite(pivot))return null;minPivot=Math.min(minPivot,pivot);maxPivot=Math.max(maxPivot,pivot);
      for(let i=j+1;i<n;i++){const f=a[i][j]/a[j][j];for(let k=j;k<=n;k++)a[i][k]-=f*a[j][k];}
    }
    const x=Array(n).fill(0);for(let i=n-1;i>=0;i--){let v=a[i][n];for(let j=i+1;j<n;j++)v-=a[i][j]*x[j];x[i]=v/a[i][i];}
    return {x,pivotRatio:maxPivot/minPivot};
  }
  function advance(s,objective){
    if(s.done)return s;
    const start=s.evaluations,clock=performance.now(),j=jacobian(s.x,s.current,x=>counted(s,x,objective),s.config);
    if(j.budgetExhausted){s.partialJacobianEvaluations=s.evaluations-start;s.done=true;return s;}
    s.lastJacobian={...j,columns:undefined,evaluations:s.evaluations-start,elapsedMs:performance.now()-clock};
    const c=j.columns,h=c.map(a=>c.map(b=>dot(a,b))),g=c.map(a=>dot(a,s.current.residual)),maxDiagonal=Math.max(1e-12,...h.map((r,i)=>r[i]));
    let accepted=false;
    for(let attempt=0;attempt<10&&s.evaluations<s.config.maxEvaluations;attempt++){
      const regular=h.map((row,i)=>row.map((v,k)=>v+(i===k?s.lambda*Math.max(h[i][i],maxDiagonal*1e-8):0)));
      const step=solve(regular,g.map(v=>-v));if(!step){s.lambda*=10;continue;}
      s.lastJacobian.dampedPivotRatio=step.pivotRatio;
      const norm=Math.hypot(...step.x),factor=Math.min(1,s.config.trustRadius/Math.max(norm,1e-30));
      const trial=s.x.map((x,i)=>Math.max(0,Math.min(1,x+factor*step.x[i])));
      if(Math.hypot(...trial.map((x,i)=>x-s.x[i]))<1e-10){s.done=true;break;}
      const value=counted(s,trial,objective);
      if(value.valid&&value.score<s.current.score-1e-12*Math.max(1,s.current.score)){
        s.x=trial;s.current=value;s.lambda=Math.max(1e-8,s.lambda/3);accepted=true;break;
      }
      s.lambda=Math.min(1e12,s.lambda*5);
    }
    s.iteration++;s.history.push({evaluations:s.evaluations,score:s.current.score,accepted,damping:s.lambda,unreliableColumns:j.diagnostics.filter(d=>d.status!=='reliable').length});
    s.done ||= s.evaluations>=s.config.maxEvaluations||!accepted;return s;
  }
  function resume(raw){
    const s=structuredClone(raw);if(s.schemaVersion!==1||s.engineVersion!==VERSION||s.algorithm!==VERSION)throw Error('DLS checkpoint engine/schema mismatch');
    options(s.config);M.validateOperands(s.operands);const map=mapping(s.input,s.variables,s.config.parameterization);
    if(JSON.stringify(map)!==JSON.stringify(s.mapping)||!Array.isArray(s.x)||s.x.length!==map.length||s.x.some(x=>!Number.isFinite(x)||x<0||x>1)||!Number.isSafeInteger(s.evaluations)||s.evaluations<1||s.evaluations>s.config.maxEvaluations||!Number.isSafeInteger(s.iteration)||s.iteration<0||!Number.isFinite(s.lambda)||s.lambda<=0||typeof s.done!=='boolean'||!Array.isArray(s.history)||!s.rejections||typeof s.rejections!=='object')throw Error('Invalid DLS checkpoint');
    const r=evaluate(s,s.x);if(!r.valid||r.signature!==s.current.signature||Math.abs(r.score-s.current.score)>1e-9*Math.max(1,r.score)||r.residual.length!==s.current.residual.length||r.residual.some((v,i)=>Math.abs(v-s.current.residual[i])>1e-9*Math.max(1,Math.abs(v))))throw Error('DLS checkpoint residual mismatch');
    // Keep serialized residuals after verification: bit-for-bit continuation at iteration boundaries.
    return s;
  }
  const api={VERSION,mapping,encode,prescription,residuals,evaluate,create,advance,resume,jacobian,solve,options};root.LBDLS=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
