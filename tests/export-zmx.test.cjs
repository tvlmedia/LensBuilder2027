const {test} = require('node:test');
const assert = require('node:assert/strict');
const {serialize} = require('../import/export-zmx');
const {parseZemaxSequentialText} = require('../import/zemax');
const optics = require('../optics/core');
const best = require('../lenses/omit50-best.json');
const options = {objectDistance: Infinity, activeNm: 587.5618};

test('OMIT 50 Best ZMX preserves spectral weights, stop, geometry and paraxial performance', () => {
  const text = serialize(best, options);
  assert.match(text, /DISZ INFINITY/);
  assert.match(text, /PWAV 2/);
  const copy = parseZemaxSequentialText(text);
  assert.equal(copy.surfaces.length, 9);
  const waves = best.presetProvenance.specification.wavelengths;
  const records = [...text.matchAll(/^WAVM (\d+) (\S+) (\S+)/gm)];
  assert.equal(records.length, waves.length);
  for (const [i, wave] of waves.entries()) {
    assert.ok(Math.abs(Number(records[i][2])*1000-wave.nm) < 1e-10);
    assert.equal(Number(records[i][3]), wave.weight);
    const expected = optics.paraxial(optics.compile(best,wave.nm));
    const actual = optics.paraxial(optics.compile(copy,wave.nm));
    for (const key of ['eflMm','fNumber','bflMm','imageDistanceMm'])
      assert.ok(Math.abs(expected[key]-actual[key]) < 1e-11);
  }
  for (const [i,s] of copy.surfaces.entries()) {
    const original = best.surfaces[i];
    for (const key of ['t','ap','glass','stop']) assert.equal(s[key], original[key]);
    assert.ok(Math.abs(s.R-original.R) < 1e-12);
  }
});

test('exports edited surfaces and current conjugates without changing the lens', () => {
  const lens = structuredClone(best);
  lens.surfaces[1].R += 2;
  lens.surfaces[5].ap_optical -= 1;
  const before = structuredClone(lens);
  const text = serialize(lens, {...options, objectDistance: 2000, lensShift: 1, sensorShift: 3});
  assert.match(text, /DISZ 2001\r/);
  // Local importer supports infinity only. Verify finite distance above, then inspect other records.
  const copy = parseZemaxSequentialText(text.replace('DISZ 2001\r','DISZ INFINITY\r'));
  assert.ok(Math.abs(copy.surfaces[1].R-lens.surfaces[1].R)<1e-12);
  assert.equal(copy.surfaces[5].ap, lens.surfaces[5].ap_optical);
  assert.equal(copy.surfaces[7].t, lens.surfaces[7].t+2);
  assert.deepEqual(lens,before);
});

test('default Concept exports its actual approximate glass models', () => {
  const fs = require('node:fs'), vm = require('node:vm');
  const source = fs.readFileSync(require.resolve('../script.js'), 'utf8');
  const factory = source.match(/function omit50ConceptV1\(\) \{[\s\S]*?\n  \}/)[0];
  const concept = vm.runInNewContext(factory + ';omit50ConceptV1()');
  const text = serialize(concept, options);
  assert.match(text, /COMM N-LAK9 .*\r\n  GLAS ___BLANK/);
  const imported = parseZemaxSequentialText(text);
  const materials = require('../materials/catalog');
  for (const [i,s] of concept.surfaces.entries()) {
    for (const nm of [486.1327,587.5618,656.2725])
      assert.equal(materials.index(imported.surfaces[i],nm),materials.index(s,nm));
  }
});
