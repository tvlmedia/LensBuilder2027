const {test}=require('node:test'),a=require('node:assert/strict');
const O=require('../optics/core'),C=require('../optimization/design-challenge'),M=require('../materials/catalog');
const best=require('../lenses/omit50-best.json'),historical=require('../lenses/omit50-historical-m4.json');
const definition=require('../benchmarks/optical-suite-v1.json').cases.find(c=>c.id==='omit50');
const geometry=s=>s.surfaces.map(p=>[p.type,p.R,p.t,p.ap_optical??p.ap,p.glass,!!p.stop]);
const close=(x,y,t=1e-9)=>a.ok(Math.abs(x-y)<t,`${x} != ${y}`);
test('Best is the recovered serialized winner, never the concept or regenerated geometry',()=>{
 a.deepEqual(geometry(best),geometry(require('../benchmarks/omit50-challenge-new.json').system));
 a.deepEqual(geometry(historical),geometry(require('../benchmarks/physical-omit50.json').system));
 a.equal(best.focus.mode,'fixed');a.equal(best.focus.shiftMm,0);
 a.equal(best.import_options.preserve_optical_apertures,true);a.equal(best.import_options.preserve_ims_aperture,true);
 const f=O.paraxial(O.compile(best));close(f.eflMm,49.95648830164519);close(f.fNumber,2);close(f.bflMm,35.25104186914508);close(f.imageDistanceMm,33.75119698467775);
 for(const [name,model]of Object.entries(best.presetProvenance.materials))a.deepEqual(model,M.catalog[name]);
});
for(const [name,preset,merit,center,edge]of [['Best',best,191.71823128235255,.09692741475300694,.29015563300822717],['Historical M4',historical,211.6991817575039,.097399,.309609]])test(`${name} reproduces frozen dense objective and RMS`,()=>{
 const p=C.create(definition.specification,definition.operands,{source:'reference',budget:10000},preset),r=C.validate(p,{system:preset});
 a.equal(r.status,'DENSE VALIDATED');close(r.dense.score,merit,1e-9);
 close(r.dense.analysis.fields.find(f=>f.field===0).rmsMm,center,1e-6);
 close(r.dense.analysis.fields.find(f=>f.field===1).rmsMm,edge,1e-6);
});
test('Best UI action loads a permanent JSON and sets infinity without optimization',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync(require.resolve('../script.js'),'utf8');
 const start=source.indexOf('  on("#btnLoadOmitBest",'),end=source.indexOf('\n  });',start)+6;
 let action,loaded;const ui={prevObjDist:{value:'2000'}};
 vm.runInNewContext(source.slice(start,end),{on:(id,event,fn)=>{action=fn;},loadLensFromURL:async p=>{loaded=p;return true;},ui,scheduleRenderAll(){},scheduleRenderPreview(){},toast(){}});
 await action();a.equal(loaded,'./lenses/omit50-best.json');a.equal(ui.prevObjDist.value,'1000000000');
});
