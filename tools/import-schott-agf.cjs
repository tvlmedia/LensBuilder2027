// Offline reproducible import of manufacturer data; no network needed at runtime.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const source = 'https://media.schott.com/api/public/content/a79c07aa61da4c05a2c0bbab93d09a7f?download=true&v=3b65e351';
function parse(text) {
  const records = {}; let g;
  for (const line of text.split(/\r?\n/)) {
    const [key, ...v] = line.trim().split(/\s+/);
    if (key === 'NM') {
      g = records[v[0]] = {name:v[0], manufacturer:'SCHOTT', formula:Number(v[1]), nd:Number(v[3]), Vd:Number(v[4]), catalogStatus:Number(v[6]), model:'sellmeier', verification:'manufacturer-agf', source, transmission:[]};
    } else if (g && key === 'CD') {
      g.B = [v[0],v[2],v[4]].map(Number); g.C = [v[1],v[3],v[5]].map(Number);
    } else if (g && key === 'LD') g.rangeNm = v.slice(0,2).map(x=>Number(x)*1000);
    else if (g && key === 'IT') g.transmission.push({nm:Number(v[0])*1000,value:Number(v[1]),thicknessMm:Number(v[2])});
  }
  return records;
}
function generate() {
  const file = fs.readFileSync(path.join(root,'materials/sources/schott-june-2025.agf'));
  const all = parse(file.toString('utf8'));
  const before = require('../materials/sources/legacy-values.json');
  const selected = [...Object.keys(before), 'BAF9','K11','LF7'].sort().map(name=> {
    const g = all[name];
    if (!g || g.formula !== 2 || !g.B?.every(Number.isFinite) || !g.C?.every(Number.isFinite) || !g.rangeNm?.every(Number.isFinite) || !(g.nd>1 && g.Vd>0)) throw Error('Unsupported/incomplete AGF record: '+name);
    if (!g.transmission.length) g.transmission = null;
    return g;
  });
  const catalogPath = path.join(root,'materials/catalog.js');
  const generated = '  // BEGIN GENERATED SCHOTT\n  // tools/import-schott-agf.cjs; SCHOTT June 2025. Each name is an independent record.\n  for (const g of [\n'+selected.map(g=>'    '+JSON.stringify(g)).join(',\n')+'\n  ]) catalog[g.name] = g;\n  // END GENERATED SCHOTT';
  fs.writeFileSync(catalogPath,fs.readFileSync(catalogPath,'utf8').replace(/  \/\/ BEGIN GENERATED SCHOTT[\s\S]*?  \/\/ END GENERATED SCHOTT/,generated));
  const audit = {source, retrieved:'2026-11-19', sha256:crypto.createHash('sha256').update(file).digest('hex'), records:selected.map(g=>({name:g.name,before:before[g.name]??null,nd:g.nd,Vd:g.Vd,rangeNm:g.rangeNm,model:g.model,verification:g.verification}))};
  fs.writeFileSync(path.join(root,'docs/material-catalog-audit.json'),JSON.stringify(audit,null,2)+'\n');
  console.log('Imported '+selected.length+' SCHOTT records');
}
if (require.main === module) generate();
module.exports = {parse};
