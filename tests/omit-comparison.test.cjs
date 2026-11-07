const {test} = require('node:test'), assert = require('node:assert/strict');
const {compare} = require('../ui/omit-comparison');
const engine = require('../optimization/design-challenge');
const best = require('../lenses/omit50-best.json'), m4 = require('../lenses/omit50-historical-m4.json');
test('same reference evaluation reproduces archived field survival, merit and clipping tradeoff', () => {
  const result = compare(engine, best, m4);
  assert.deepEqual(result.merit.map(x => x.toFixed(3)), ['191.718','211.699']);
  assert.deepEqual(result.rows.map(r => r.field), [0,.5,.7,1]);
  assert.deepEqual(result.rows.map(r => [r.best.survival.toFixed(2),r.m4.survival.toFixed(2)]),
    [['91.55','97.18'],['88.38','99.30'],['84.51','100.00'],['82.39','99.30']]);
  assert.ok(result.rows.every(r => r.clippingWarning));
});
test('identical prescriptions do not trigger clipping warnings', () => {
  assert.ok(compare(engine,m4,m4).rows.every(r => !r.clippingWarning));
});
test('missing field data cannot become an apparent zero measurement', () => {
  assert.throws(() => compare({create(){},validate(){return {status:'DENSE VALIDATED',dense:{analysis:{fields:[]}}};}},best,m4), /Missing field/);
});
