const { test } = require("node:test"),
  assert = require("node:assert/strict");
const Pool = require("../optimization/pool.js"),
  adapter = require("../tools/worker-adapter.cjs"),
  E = require("../optimization/explorer.js"),
  M = require("../design/merit.js");
const spec = { targetEflMm: 58, imageCircleMm: 43.27, pupilGrid: 5 };
const make = () =>
  E.create(
    require("../bijna-goed.json"),
    spec,
    [{ surface: 13, key: "t", min: 21, max: 64 }],
    M.defaultOperands(spec),
    { budget: 48, population: 8 },
  );
test("actual evaluation workers match pure API and search is invariant to worker count", async () => {
  const a = make(),
    b = E.restore(JSON.parse(JSON.stringify(a)));
  const pools = [new Pool(1, adapter), new Pool(3, adapter)];
  try {
    for (const [i, s] of [a, b].entries()) {
      await pools[i].init(s);
      while (!s.done) {
        const vectors = E.next(s);
        E.accept(s, await pools[i].evaluate(vectors));
      }
    }
    assert.deepEqual(a, b);
    const direct = E.evaluate(a, a.archive[0].vector, true),
      [worker] = await pools[0].evaluate([a.archive[0].vector], true);
    assert.deepEqual(worker, direct);
  } finally {
    pools.forEach((p) => p.close());
  }
});
test("worker failure is surfaced and closing rejects pending evaluations", async () => {
  const p = new Pool(1, adapter);
  try {
    await p.init(make());
    await assert.rejects(p.evaluate([[NaN]]), /bounds/);
    const pending = p.evaluate([[32]]);
    p.close();
    await assert.rejects(pending, /stopped/);
  } finally {
    p.close();
  }
});

test("multi-aperture worker results and dense diagnostics match pure evaluator", async () => {
  const s = make();
  s.spec.apertures = [2, 2.8, 4, 5.6];
  s.operands = M.defaultOperands(s.spec);
  const p = new Pool(2, adapter);
  try {
    await p.init(s);
    const v = s.variables.map((v) => v.value);
    const [r] = await p.evaluate([v], true);
    assert.deepEqual(r, E.evaluate(s, v, true));
    assert.equal(r.analysis.apertures.length, 4);
  } finally {
    p.close();
  }
});
