const {test} = require('node:test'), a = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const M = require('../materials/catalog'), Z = require('../import/zemax');
const {parse} = require('../tools/import-schott-agf.cjs');
const agf = parse(fs.readFileSync(require.resolve('../materials/sources/schott-june-2025.agf'),'utf8'));
const fixture = require('./fixtures/omit-legacy-schema-v2.json');
const zmx = fs.readFileSync(require.resolve('./fixtures/omit-legacy-reconstructed.zmx'),'utf8');
const near=(x,y,t=1e-12)=>a.ok(Math.abs(x-y)<=t,`${x} != ${y} (tolerance ${t})`);

test('all 63 SCHOTT records match pinned manufacturer coefficients, ranges, nd/Vd and transmission',()=>{
  const glasses=Object.values(M.catalog).filter(g=>g.manufacturer==='SCHOTT');
  a.equal(glasses.length,63);
  for(const g of glasses){
    a.deepEqual(g,agf[g.name]);
    const nd=M.index(g.name,M.wavelengths.d);
    near(nd,g.nd,5.1e-6); // nd published to five decimals in preferred catalog.
    near((nd-1)/(M.index(g.name,M.wavelengths.F)-M.index(g.name,M.wavelengths.C)),g.Vd,.0051);
    for(const nm of [M.wavelengths.C,M.wavelengths.d,M.wavelengths.F,800]){
      // Independent algebraic form, directly from manufacturer CD slots.
      const r=agf[g.name],l=nm/1000;
      near(M.index(g.name,nm),Math.sqrt(1+r.B.map((b,i)=>b/(1-r.C[i]/l**2)).reduce((a,b)=>a+b,0)));
    }
    if(g.rangeNm[0]<=380) a.ok(Number.isFinite(M.index(g.name,380)));
    a.throws(()=>M.index(g.name,g.rangeNm[0]-.01),/no|unavailable/);
    a.throws(()=>M.index(g.name,g.rangeNm[1]+.01),/extrapolation/);
    for(const r of g.transmission){a.ok(r.value>=0&&r.value<=1&&r.thicknessMm>0);near(M.internalTransmission(g.name,r.nm,r.thicknessMm).value,r.value);}
  }
  // Historical NM records publish six decimals rather than five/two.
  for(const name of ['BAF9','K11']){
    const g=M.catalog[name],d=M.index(name,M.wavelengths.d);
    near(d,g.nd,.51e-6);
    near((d-1)/(M.index(name,M.wavelengths.F)-M.index(name,M.wavelengths.C)),g.Vd,.51e-6);
  }
});

test('independent SCHOTT datasheet d/F/C tabulated indices agree to displayed precision',()=>{
  // SCHOTT Optical Glass Datasheet Collection, PDF pp. 13 and 53.
  // https://media.schott.com/api/public/content/820eba3413cc4e788433a3751f8edba9?download=true&v=97b3ea2b
  for(const [name,nd,nF,nC] of [['N-BK7',1.51680,1.52238,1.51432],['N-LAK9',1.69100,1.69979,1.68716]])
    for(const [line,n] of [['d',nd],['F',nF],['C',nC]]) near(M.index(name,M.wavelengths[line]),n,5.1e-6);
});

test('BK7HT is a distinct manufacturer record with equal dispersion but different transmission',()=>{
  a.notEqual(M.catalog['N-BK7'],M.catalog['N-BK7HT']);
  near(M.index('N-BK7',380),M.index('N-BK7HT',380));
  near(M.internalTransmission('N-BK7',380,25).value,.983);
  near(M.internalTransmission('N-BK7HT',380,25).value,.992);
  a.throws(()=>M.material('BK7'),/No substitution/);
  a.throws(()=>M.material('F2'),/explicit glass selection/);
});

test('internal transmission scales with actual glass path, reports interpolation, never claims surface throughput',()=>{
  near(M.internalTransmission('N-BK7',380,50).value,.983**2);
  near(M.internalTransmission('N-BK7',380,0).value,1);
  const t=M.internalTransmission('N-BK7',385,25);
  near(t.value,Math.sqrt(.983*.989));a.equal(t.includesReflections,false);a.match(t.status,/approximate/);
  a.equal(M.internalTransmission('LZ_TK16',550,5).value,null);
  a.throws(()=>M.internalTransmission('N-BK7',280,5),/no extrapolation/);
  a.throws(()=>M.internalTransmission('N-BK7',550,-1),/Invalid/);
});

test('LZOS names use original manufacturer nd/Vd, remain approximate and cannot masquerade as SCHOTT',()=>{
  for(const [name,nd,Vd] of [['LZ_TK16',1.612694,58.35],['LZ_TF2',1.672680,32.23],['LZ_OF1',1.529492,51.81],['LZ_BF7',1.579595,53.86]]){
    const g=M.material(name);a.equal(g.manufacturer,'LZOS');a.equal(g.model,'nd-vd-approximate');a.equal(g.nd,nd);a.equal(g.Vd,Vd);
    near(M.index(name,M.wavelengths.d),nd);
    near((nd-1)/(M.index(name,M.wavelengths.F)-M.index(name,M.wavelengths.C)),Vd,1e-9);
    a.throws(()=>M.index(name,380),/approximation scope/);
  }
});

test('null, blanks, booleans and partial custom definitions cannot become numeric material data',()=>{
  for(const v of [null,undefined,'', ' ',false,[],{},NaN,Infinity]){
    a.throws(()=>M.material({glass:'UNKNOWN',nd:v,vd:40}),/Unknown material/);
    a.throws(()=>M.material({glass:'UNKNOWN',nd:1.6,vd:v}),/Unknown material/);
  }
  a.throws(()=>M.material(null),/Missing material/);
  a.equal(M.material({glass:'CUSTOM',nd:'1.6',vd:'40'}).verification,'user-supplied-unverified');
});

test('named GLAS placeholders never override catalog dispersion or authorize an unknown glass',()=>{
  const s=Z.parseZemaxSequentialText(zmx);
  a.equal(s.surfaces.length,13);a.equal(s.surfaces[7].stop,true);
  for(const [i,p] of s.surfaces.entries()){
    const ref=fixture.surfaces[i];near(p.R,ref.R);near(p.t,ref.t);near(p.ap,ref.ap);a.equal(p.glass,ref.glass);a.equal(p.stop,ref.stop);
  }
  a.equal(s.surfaces[1].nd,null);near(M.index(s.surfaces[1],M.wavelengths.d),1.612694);
  a.ok(s.importReport.materialWarnings.some(w=>w.includes('LZ_TK16')));
  a.throws(()=>Z.parseZemaxSequentialText(zmx.replace('GLAS LZ_TK16','GLAS MISSING')),/MISSING/);
  a.throws(()=>Z.parseZemaxSequentialText(zmx.replace('GLAS LZ_TK16 0','GLAS LZ_TK16 2')),/Unsupported GLAS solve/);
  a.throws(()=>Z.parseZemaxSequentialText(zmx.replace('GLAS LZ_TK16 0 0 1.5 40','GLAS ___BLANK 0 0 0 0 1.6 40')),/requires explicit/);
});

function nativeContext(){
  const src=fs.readFileSync(require.resolve('../script.js'),'utf8');
  const ctx={clone:structuredClone,normalizeGlassInput:s=>s,generateSurfaceLabels(){}};
  const start=src.indexOf('  const DRAW_MODE_SET'),end=src.indexOf('  let lens = sanitizeLens',start);
  vm.runInNewContext(src.slice(start,end),ctx);
  return ctx;
}
test('real schemaVersion 2 sanitizer preserves all 13 surface records and explicit OF1 values',()=>{
  const context=nativeContext(), original=structuredClone(fixture), result=context.sanitizeLens(fixture);
  a.equal(result.schemaVersion,2);a.equal(result.surfaces.length,13);
  near(result.surfaces.slice(1,-1).reduce((x,s)=>x+s.t,0),90.22266473891966);
  for(const [i,s] of result.surfaces.entries())for(const key of ['R','t','ap','ap_optical','ap_mech','glass','originalGlass','stop','nd','vd'])a.equal(s[key],fixture.surfaces[i][key],`${i}:${key}`);
  for(const s of result.surfaces)a.ok(Number.isFinite(M.index(s)));
  a.equal(M.material(result.surfaces[8]).nd,fixture.surfaces[8].nd);
  a.equal(M.material(result.surfaces[8]).verification,'user-supplied-unverified');
  a.deepEqual(fixture,original);
});

test('JSON material errors are reported without a misleading Zemax format fallback',async()=>{
  const source=fs.readFileSync(require.resolve('../script.js'),'utf8');
  let zemaxCalls=0;
  const context={FileReader:class{readAsText(){this.result=JSON.stringify(fixture);this.onload();}},ui:{footerWarn:{}},loadLens(){throw Error('Unknown material example');},importZemaxText(){zemaxCalls++;},toast(){}};
  vm.runInNewContext(source.slice(source.indexOf(' function loadLensFromFile'),source.indexOf('  // -------------------- lens JSON export/copy')),context);
  await a.rejects(context.loadLensFromFile({name:'lens.json'}),/Unknown material example/);a.equal(zemaxCalls,0);
  a.doesNotMatch(context.ui.footerWarn.textContent,/Not Zemax/);
});
