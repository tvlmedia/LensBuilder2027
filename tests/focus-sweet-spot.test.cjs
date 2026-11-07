const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const src=fs.readFileSync(require.resolve('../script.js'),'utf8'), P=require('../optics/preview');
function harness(){
  const lens=structuredClone(require('../lenses/omit50-best.json')), saved=JSON.stringify(lens.surfaces);
  const nodes={sweetPanel:{open:true},sweetResult:{},setSweetFocus:{},focusReleaseVersion:{}};
  const ui={prevObjDist:{value:'2000'},wavePreset:{value:'d'},focusMode:{value:'manual'},focusMechanism:{value:'move-lens'}};
  const handlers={};let current=-1;
  const ctx={document:{getElementById:id=>nodes[id]},ui,lens,LBPreview:P,LB_BUILD:{applicationVersion:'test'},getSensorWH:()=>({w:36,h:24}),getPreviewAutofocusMode:()=>'chart-center',wavePresetToLambdaNm:()=>587.5618,getPreviewAutofocusSensorSamples:()=>[{sy:0,sz:0,w:1}],normalizeFocusMechanism:x=>x,isSafeFocusShift:x=>Number.isFinite(x)&&Math.abs(x)<=40,getFocusShiftMm:()=>current,setFocusShiftMm:x=>current=Number(x.toFixed(4)),syncFocusControlsUI(){},scheduleRenderAll(){},scheduleRenderPreview(){},on:(id,e,fn)=>handlers[id]=fn};
  for(const [a,b] of [['  function focusPoseFromShift','  function getFocusContext'],['  function runAutofocusForShift','  function getFocusChartDistanceMm'],['  let sweetCache','function wireUI()'],['  document.getElementById("focusReleaseVersion")','  on("#btnAutoFocus"']])vm.runInNewContext(src.slice(src.indexOf(a),src.indexOf(b,src.indexOf(a))),ctx);
  return {ctx,ui,nodes,handlers,lens,saved};
}
test('sensor optimum uses the same geometric RMS search at finite distance and infinity; applying preserves surfaces',()=>{
 const {ctx,ui,nodes,handlers,lens,saved}=harness(), finite=ctx.refreshSweetSpot();
 assert.match(nodes.sweetResult.textContent,/Finite object: 2000 mm/);
 const inf=()=>ctx.refreshSweetSpot();ui.prevObjDist.value='1000000000';const far=inf();
 assert.ok(finite.shift>far.shift+1);assert.match(nodes.sweetResult.textContent,/Infinity/);
 handlers['#setSweetFocus']();assert.equal(ui.focusMechanism.value,'move-ims');assert.equal(ui.focusMode.value,'manual');
 assert.match(nodes.sweetResult.textContent,/Current − optimal: -?0\.0000 mm/);assert.equal(JSON.stringify(lens.surfaces),saved);
});
test('invalid distance disables apply and cannot reuse a previous optimum',()=>{
 const {ctx,ui,nodes,handlers}=harness();assert.ok(ctx.refreshSweetSpot());ui.prevObjDist.value='';handlers['#setSweetFocus']();
 assert.equal(nodes.setSweetFocus.disabled,true);assert.match(nodes.sweetResult.textContent,/unavailable/);assert.equal(ui.focusMechanism.value,'move-lens');
});
