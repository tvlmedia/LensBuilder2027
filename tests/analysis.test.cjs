const { test } = require("node:test"),
  a = require("node:assert/strict");
const A = require("../analysis/evaluate.js"),
  D = require("../design/merit.js"),
  S = require("../optimization/search.js"),
  O = require("../optics/core.js");
const input = require("../bijna-goed.json");
const spec = {
  targetEflMm: 58.01287,
  targetFNumber: 1.4614,
  imageCircleMm: 43.27,
  pupilGrid: 5,
};
test("repeat analysis is bitwise deterministic with six fields and three wavelengths", () => {
  const one = A.evaluate(input, spec),
    two = A.evaluate(input, spec);
  a.ok(one.valid);
  a.equal(one.rows.length, 18);
  a.deepEqual(one, two);
  a.equal(one.fields[0].distortionPercent, 0);
  a.ok(
    one.rows.every(
      (r) =>
        r.accepted + r.failures.clipped === r.launched ||
        r.accepted === r.launched,
    ),
  );
});
test("RMS statistics translation invariance and polychromatic centroid spread", () => {
  a.equal(
    A.statistics([
      { y: -1, z: 0 },
      { y: 1, z: 0 },
    ]).rmsMm,
    1,
  );
  a.equal(
    A.statistics([
      { y: 9, z: 2 },
      { y: 11, z: 2 },
    ]).rmsMm,
    1,
  );
});
test("hard constraints cannot be outweighed by merit", () => {
  const r = D.evaluate(
    input,
    { ...spec, constraints: { minBflMm: 100 } },
    D.defaultOperands(spec),
  );
  a.equal(r.merit.total, Infinity);
  a.equal(r.merit.valid, false);
});
test("target ranges permit intentional nonzero aberration, normalized contributions", () => {
  const r = A.evaluate(input, spec),
    v = r.fields[0].rmsMm;
  const s = D.score(r, [
    {
      metric: "rms",
      field: 0,
      target: [v - 0.1, v + 0.1],
      scale: 0.1,
      weight: 2,
    },
  ]);
  a.equal(s.total, 0);
  a.equal(
    D.score(r, [
      { metric: "rms", field: 0, target: v - 0.2, scale: 0.1, weight: 2 },
    ]).total.toFixed(3),
    "8.000",
  );
  a.throws(
    () => D.score(r, [{ metric: "MTF", target: 0, scale: 1, weight: 1 }]),
    /Unsupported/,
  );
});
test("bounded optimization genuinely improves real optical objective and resumes identically", () => {
  const vars = [{ surface: 13, key: "t", min: 30, max: 46 }],
    ops = D.defaultOperands(spec);
  let s = S.create(input, spec, vars, ops, { maxEvaluations: 45, seed: 42 });
  for (let i = 0; i < 6; i++) S.advance(s);
  let resumed = S.resume(JSON.parse(JSON.stringify(s)));
  while (!s.done) S.advance(s);
  while (!resumed.done) S.advance(resumed);
  a.deepEqual(s.bestVector, resumed.bestVector);
  a.equal(s.bestScore, resumed.bestScore);
  a.ok(s.bestScore < s.initialScore * 0.5);
  a.ok(s.bestVector[0] >= 30 && s.bestVector[0] <= 46);
  const result = S.finish(s);
  a.ok(result.accepted, result.reason);
  a.ok(
    result.after.analysis.fields[0].rmsMm <
      result.before.analysis.fields[0].rmsMm,
  );
  a.deepEqual(input, require("../bijna-goed.json"));
});
test("stop translation preserves total length and rejects overlapping variables", () => {
  const vars = [{ surface: 7, key: "stopPosition", min: -2, max: 2 }],
    s = S.create(input, spec, vars, D.defaultOperands(spec), {
      maxEvaluations: 2,
    });
  const moved = S.prescription(s, [1]);
  a.equal(moved.surfaces[6].t, input.surfaces[6].t + 1);
  a.equal(moved.surfaces[7].t, input.surfaces[7].t - 1);
  a.throws(
    () =>
      S.validateVariables(input, [
        ...vars,
        { surface: 6, key: "t", min: 1, max: 9 },
      ]),
    /share/,
  );
});
test("checkpoint corruption and invalid bounds rejected", () => {
  a.throws(
    () =>
      S.create(
        input,
        spec,
        [{ surface: 1, key: "R", min: -100, max: 100 }],
        D.defaultOperands(spec),
      ),
    /zero/,
  );
  const s = S.create(
    input,
    spec,
    [{ surface: 13, key: "t", min: 30, max: 46 }],
    D.defaultOperands(spec),
  );
  s.bestScore = 0;
  a.throws(() => S.resume(s), /mismatch/);
});
test("multiple selected radii and spacings improve a ray-traced merit within bounds", () => {
  const vars = [
    { surface: 1, key: "R", min: 50, max: 65 },
    { surface: 3, key: "R", min: 34, max: 45 },
    { surface: 6, key: "t", min: 4, max: 9 },
    { surface: 13, key: "t", min: 25, max: 46 },
  ];
  const s = S.create(input, spec, vars, D.defaultOperands(spec), {
    maxEvaluations: 200,
  });
  while (!s.done) S.advance(s);
  const r = S.finish(s);
  a.ok(r.accepted);
  a.ok(r.after.merit.total < r.before.merit.total * 0.2);
  vars.forEach((v, i) =>
    a.ok(s.bestVector[i] >= v.min && s.bestVector[i] <= v.max),
  );
  a.notEqual(r.candidate.surfaces[1].R, input.surfaces[1].R);
  a.equal(r.candidate.surfaces[2].R, input.surfaces[2].R);
});

test("invalid target arrays and nonfinite checkpoint state cannot bypass validation", () => {
  for (const target of [[], [0], [0, 1, 2]])
    a.throws(
      () =>
        D.validateOperands([{ metric: "efl", target, scale: 1, weight: 1 }]),
      /target/,
    );
  const state = S.create(
    input,
    spec,
    [{ surface: 13, key: "t", min: 30, max: 46 }],
    D.defaultOperands(spec),
  );
  for (const bestScore of [undefined, null, NaN, Infinity])
    a.throws(() => S.resume({ ...state, bestScore }), /metadata/);
});

test("low-NA geometric RMS, distortion and color agree with independent thick-lens formulas", () => {
  const M = require("../materials/catalog.js"),
    R = 50,
    t = 5;
  const bfl = (n) => {
    const power = (n - 1) * (2 / R - ((n - 1) * t) / (n * R * R));
    return (1 - (t * (n - 1)) / (n * R)) / power;
  };
  const nd = M.index("N-BK7", M.wavelengths.d),
    power = (nd - 1) * (2 / R - ((nd - 1) * t) / (nd * R * R)),
    efl = 1 / power,
    gap = bfl(nd);
  const lens = {
    surfaces: [
      { type: "OBJ", t: 0, glass: "AIR" },
      { type: "1", R, t, ap: 0.01, glass: "N-BK7", stop: true },
      { type: "2", R: -R, t: gap, ap: 0.01, glass: "AIR" },
      { type: "IMS", R: 0, t: 0, ap: 10, glass: "AIR" },
    ],
  };
  const r = A.evaluate(lens, {
    targetEflMm: efl,
    imageCircleMm: 0.002,
    pupilGrid: 9,
    fields: [0, 1],
    minRayFraction: 0.8,
  });
  a.ok(r.valid, r.errors.join("; "));
  a.ok(
    Math.abs(
      r.longitudinalColorMm -
        (bfl(M.index("N-BK7", M.wavelengths.F)) -
          bfl(M.index("N-BK7", M.wavelengths.C))),
    ) < 1e-10,
  );
  a.ok(Math.abs(r.fields[1].distortionPercent) < 1e-5);
  const slope = 0.001 / efl;
  const heights = A.DEFAULT_WAVES.map((w) => {
    const n = M.index("N-BK7", w.nm);
    return (t / n + gap * (1 - ((n - 1) * t) / (n * R))) * slope;
  });
  a.ok(
    Math.abs(
      r.fields[1].lateralChiefColorMm -
        (Math.max(...heights) - Math.min(...heights)),
    ) < 1e-10,
  );
  a.ok(
    r.rows.find((row) => row.field === 0 && row.nm === M.wavelengths.d).rmsMm <
      1e-8,
  );
});

test("accelerated pattern search improves optics and resumes a pending combined step", () => {
  const variables = [{ surface: 13, key: "t", min: 30, max: 46 }];
  const state = S.create(input, spec, variables, D.defaultOperands(spec),
    { maxEvaluations: 100, patternAcceleration: true });
  while (!state.pendingPattern && !state.done) S.advance(state);
  a.ok(state.pendingPattern, "exercise combined extrapolation checkpoint");
  const resumed = S.resume(JSON.parse(JSON.stringify(state)));
  const bad = structuredClone(state); bad.sweepVector[0] = Infinity;
  a.throws(() => S.resume(bad), /pattern checkpoint/);
  while (!state.done) S.advance(state);
  while (!resumed.done) S.advance(resumed);
  a.deepEqual(state, resumed);
  a.ok(state.evaluations <= 100);
  a.ok(state.bestScore < state.initialScore * 0.5);
  a.ok(S.finish(state).accepted);
  a.ok(state.history.every((h,i) => !i || h.score <= state.history[i-1].score));
});
