/* Explicit additional-budget geometry/glass investigation. Never part of the
   equal-budget geometry comparison; only freshly validated incumbents survive. */
(function(root){
 'use strict';const R=root.LBGeometryRefinement||require('./refine.js'),G=root.LBGlassSearch||require('./glass.js'),S=root.LBSynthesis||require('./engine.js'),M=root.LBMerit||require('../design/merit.js');
 async function optimize(item,spec,operands,options={}){
  const rounds=options.rounds??2;if(!Number.isSafeInteger(rounds)||rounds<1||rounds>4)throw Error('Alternation rounds must be 1–4');let incumbent=structuredClone(item);const history=[];
  for(let round=0;round<rounds;round++){
   const geometry=await R.optimize(incumbent,spec,operands,{method:options.method||'dls-curvature',maxEvaluations:options.geometryBudget??500,yield:options.yield});
   incumbent=geometry;history.push({round,stage:'geometry',...geometry.geometryRefinement});
   const glass=await G.optimize(incumbent,spec,operands,{perTrialBudget:options.perTrialBudget??100,includeFamilies:true,yield:options.yield});
   const intermediate={...S.analysisSpec(spec),pupilGrid:15,pupilPattern:'grid'},before=M.evaluate(incumbent.system,intermediate,operands).merit,after=M.evaluate(glass.system,intermediate,operands).merit;
   const accepted=glass.glassSearch.finalDenseScore<glass.glassSearch.initialDenseScore-1e-10&&before.valid&&after.valid&&after.total<before.total-1e-10;
   history.push({round,stage:'glass',accepted,intermediateBefore:before.valid?before.total:null,intermediateAfter:after.valid?after.total:null,...glass.glassSearch});
   if(accepted)incumbent=glass;
  }
  return {...incumbent,alternation:{schemaVersion:1,rounds,history,budgetPolicy:'Additional geometry budgets plus per-substitution glass budgets; legacy glass evaluations mix paraxial and objective calls. Not an equal-budget comparator.'}};
 }
 root.LBAlternation={optimize};if(typeof module!=='undefined')module.exports=root.LBAlternation;
})(globalThis);
