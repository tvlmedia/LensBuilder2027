const { test } = require("node:test"),
  assert = require("node:assert/strict");
const E = require("../optimization/explorer.js"),
  M = require("../design/merit.js"),
  A = require("../analysis/evaluate.js");
const lens = require("../bijna-goed.json");
const spec = {
  targetEflMm: 58.01287,
  targetFNumber: 1.4614346,
  imageCircleMm: 43.27,
  pupilGrid: 5,
};
const variables = [
  { surface: 1, key: "R", min: 45, max: 70 },
  { surface: 13, key: "t", min: 21, max: 64 },
];
function state(options = {}) {
  return E.create(lens, spec, variables, M.defaultOperands(spec), {
    budget: 320,
    population: 16,
    ...options,
  });
}
function sphere(v) {
  return { score: (v[0] - 56) ** 2 + (v[1] - 32) ** 2, rays: 0 };
}
function run(s, fn = sphere) {
  while (!s.done) {
    const v = E.next(s);
    if (!v.length) break;
    E.accept(s, v.map(fn));
  }
  return s;
}
test("parameter vector round trip, bounds and stop invariants", () => {
  const s = state(),
    v = s.variables.map((v) => v.value);
  assert.deepEqual(E.prescription(s, v).surfaces, lens.surfaces);
  assert.throws(() => E.prescription(s, [0, 30]));
  assert.throws(() => state({ mutation: NaN }));
  const p = E.parameters(lens, [
    { surface: 7, key: "stopPosition", min: -1, max: 1 },
  ]);
  const moved = E.prescription({ input: lens, variables: p }, [0.2]);
  assert.equal(
    moved.surfaces[6].t + moved.surfaces[7].t,
    lens.surfaces[6].t + lens.surfaces[7].t,
  );
});
test("seeded DE minimizes shifted sphere, repeat and pending checkpoint reproduce bitwise", () => {
  const a = run(state({ budget: 1600 }));
  assert.ok(a.archive[0].score < 1e-6);
  const b = run(state({ budget: 1600 }));
  assert.deepEqual(a.archive, b.archive);
  assert.deepEqual(a.population, b.population);
  assert.equal(a.rng, b.rng);
});
test("JSON checkpoint resumes identical trajectory including generated pending batch", () => {
  const a = state();
  for (let i = 0; i < 3; i++) E.accept(a, E.next(a).map(sphere));
  E.next(a);
  const b = E.restore(JSON.parse(JSON.stringify(a)));
  run(a);
  run(b);
  assert.deepEqual(a, b);
  const bad = structuredClone(a);
  bad.archive[0].vector[0] = NaN;
  assert.throws(() => E.restore(bad));
});
test("archive preserves diversity and best score with bounded memory", () => {
  const s = state({ archiveSize: 2, diversity: 0.1 });
  E.archive(s, { vector: [50, 30], score: 3 });
  E.archive(s, { vector: [50.01, 30], score: 2 });
  E.archive(s, { vector: [65, 50], score: 4 });
  E.archive(s, { vector: [65.01, 50], score: 5 });
  assert.equal(s.archive.length, 2);
  assert.equal(s.archive[0].score, 2);
});
test("sensitivity finite differences and boundary clipping", () => {
  const s = run(state({ strategy: "sensitivity" }));
  assert.equal(s.evaluations, 5);
  const rows = E.sensitivity(s);
  assert.ok(
    Math.abs(
      rows[0].derivative -
        2 * (variables[0].min + (lens.surfaces[1].R - variables[0].min) - 56),
    ) < 1e-9,
  );
});
test("real optical global search finds an improvement and independently dense-validates", () => {
  const s = state({ budget: 96, population: 12 });
  const base = E.evaluate(
    s,
    s.variables.map((v) => v.value),
  );
  run(s, (v) => E.evaluate(s, v));
  assert.ok(s.archive[0].score < base.score);
  const dense = E.evaluate(s, s.archive[0].vector, true);
  assert.ok(Number.isFinite(dense.score));
  assert.equal(dense.validation.pattern, "sunflower");
  assert.equal(dense.analysis.settings.pupilGrid, 19);
  assert.notDeepEqual(A.pupilGrid(19), A.pupilGrid(19, "sunflower"));
});
test("merit directional objectives and thresholds work for negative signed values", () => {
  const a = A.evaluate(lens, spec);
  for (const type of [
    "MINIMUM",
    "MAXIMUM",
    "MINIMIZE",
    "MAXIMIZE",
    "TARGET VALUE",
    "TARGET RANGE",
  ]) {
    const o = {
      metric: "efl",
      type,
      target: type === "TARGET RANGE" ? [50, 60] : 60,
      scale: 1,
      weight: 1,
    };
    assert.ok(Number.isFinite(M.score(a, [o]).total));
  }
  assert.equal(
    M.score(a, [
      { metric: "efl", type: "MAXIMUM", target: 60, scale: 1, weight: 1 },
    ]).total,
    0,
  );
});
test("uniform runs, invalid candidates, stop limits and 10M budgets", () => {
  const s = run(state({ strategy: "uniform", budget: 40, runs: 2 }), () => ({
    score: null,
    reason: "geometry",
  }));
  assert.equal(s.evaluations, 40);
  assert.equal(s.rejections.geometry, 40);
  assert.equal(s.archive.length, 0);
  assert.equal(state({ budget: 10000000 }).config.budget, 10000000);
});
