const { test } = require("node:test"),
  assert = require("node:assert/strict");
const F = require("../synthesis/forms"),
  S = require("../synthesis/specification"),
  G = require("../synthesis/seeds"),
  P = require("../synthesis/physics"),
  O = require("../optics/core"),
  E = require("../synthesis/engine"),
  X = require("../optimization/explorer");
function good(id = "cooke", override = {}) {
  const s = S.specification({ topology: id, ...override });
  for (let i = 0; i < 500; i++) {
    const a = G.generate(s, id, i);
    if (a.ok) {
      const b = P.apertures(a.system, s, 3);
      if (b.ok) return { s, ...b };
    }
  }
  throw Error("No generated seed");
}
for (const id of F.forms.map((f) => f.id))
  test(
    id +
      " generates reproducible physical prescriptions from structure, including real cemented interfaces",
    () => {
      const { s, system } = good(id),
        f = F.get(id),
        counts = P.construction(system);
      assert.deepEqual(F.get(id), JSON.parse(JSON.stringify(f)));
      assert.equal(counts.elements, f.groups.flat().length);
      assert.equal(counts.groups, f.groups.length);
      assert.deepEqual(G.generate(s, id, 17), G.generate(s, id, 17));
      assert.ok(
        Math.abs(O.paraxial(O.compile(system)).eflMm - s.targetEflMm) < 1e-8,
      );
      assert.ok(
        Math.abs(O.paraxial(O.compile(system)).fNumber - s.targetFNumber) <
          1e-8,
      );
      assert.ok(
        system.synthesis.powers.every((a) => Math.sign(a.thinPower) === a.role),
      );
      assert.equal(P.prepare(JSON.parse(JSON.stringify(system)), s).ok, true);
      const physical = system.surfaces.slice(1, -1);
      assert.equal(
        physical.filter(
          (a, i) => a.glass !== "AIR" && physical[i + 1]?.glass !== "AIR",
        ).length,
        counts.elements - counts.groups,
      );
    },
  );
test("circle diameter and sensor diagonal preserve the requested corner field", () => {
  assert.equal(
    S.specification({ imageCircleMm: 46.3 }).maxFieldHeightMm,
    23.15,
  );
  assert.equal(
    S.specification({ sensorWidthMm: 36, sensorHeightMm: 24 }).imageCircleMm,
    Math.hypot(36, 24),
  );
  assert.equal(
    S.specification({
      sensorWidthMm: 36,
      sensorHeightMm: 24,
      imageCircleMm: 50,
    }).maxFieldHeightMm,
    25,
  );
});
test("topology and material limits fail explicitly rather than silently substituting", () => {
  assert.throws(() =>
    S.specification({ topology: "double-gauss", cementedAllowed: false }),
  );
  assert.throws(() => S.specification({ allowedGlasses: ["UNKNOWN", "N-F2"] }));
  assert.throws(() => S.specification({ topology: "cooke", maxElements: 2 }));
});
test("sag, edge thickness, air space, BFL and clear apertures are hard constraints", () => {
  const { system, s } = good();
  const a = structuredClone(system);
  a.surfaces[1].t = 0.01;
  assert.equal(P.prepare(a, s).ok, false);
  const b = structuredClone(system);
  b.surfaces[2].t = -1;
  assert.equal(P.prepare(b, s).ok, false);
  assert.equal(
    P.prepare(system, { ...s, minBflMm: 1000 }).code,
    "BFL_TOO_SHORT",
  );
  assert.equal(
    P.prepare(system, { ...s, maxRearDiameterMm: 1 }).code,
    "REAR_DIAMETER",
  );
  assert.equal(O.sag(50, 10), -O.sag(-50, 10));
  assert.ok(P.apertures(system, s, 5).footprints.rays > 0);
});
test("radius parameter round trip preserves sign and stop stays in air", () => {
  const { system, s } = good("double-gauss"),
    vars = G.variables(system, s),
    x = E.makeJob(E.create(s), { system, ordinal: 1 }, 32);
  assert.deepEqual(
    X.prescription(
      x,
      x.variables.map((v) => v.value),
    ).surfaces,
    system.surfaces,
  );
  assert.ok(vars.filter((v) => v.key === "R").every((v) => v.min * v.max > 0));
  const v = vars.find((v) => v.key === "stopPosition");
  assert.equal(system.surfaces[v.surface - 1].glass, "AIR");
  assert.equal(system.surfaces[v.surface].glass, "AIR");
});
test("from-empty Cooke synthesis numerically improves and densely validates without violating hard constraints", async () => {
  const s = E.create({
    topology: "cooke",
    budget: 3000,
    parentsPerTopology: 1,
    archiveSize: 2,
  });
  while (!s.done) await E.step(s);
  const good = s.results.filter((a) => a.status === "DENSE VALIDATED");
  assert.ok(good.length);
  assert.ok(good.some((a) => a.score < a.initialScore * 0.8));
  for (const a of good) {
    assert.ok(Object.values(a.checks).every(Boolean));
    assert.equal(a.dense.analysis.apertures.length, 2);
    assert.ok(a.system.synthesis.origin.includes("no input prescription"));
  }
  assert.ok(s.rejections.INVALID_EDGE_THICKNESS > 0);
});
test("whole synthesis checkpoint resumes bitwise numerical trajectory", async () => {
  let a = E.create({
    topology: "cooke",
    budget: 800,
    parentsPerTopology: 1,
    archiveSize: 2,
  });
  for (let i = 0; i < 10; i++) await E.step(a);
  let b = E.restore(JSON.parse(JSON.stringify(a)));
  while (!a.done) await E.step(a);
  while (!b.done) await E.step(b);
  assert.deepEqual(a.results, b.results);
  assert.deepEqual(a.counts, b.counts);
  const bad = JSON.parse(JSON.stringify(b));
  bad.spec.imageCircleMm++;
  assert.throws(() => E.restore(bad));
});

test("f-number is solved by the physical iris; a wide-angle field is not silently reduced", () => {
  const { s, system } = good();
  const a = P.prepare(system, { ...s, targetFNumber: 2 });
  assert.equal(a.ok, true);
  const x = O.paraxial(O.compile(system)),
    y = O.paraxial(O.compile(a.system));
  assert.ok(Math.abs(y.fNumber - 2) < 1e-10);
  assert.equal(y.eflMm, x.eflMm);
  assert.equal(
    a.system.surfaces.find((a) => a.stop).ap,
    2 * system.surfaces.find((a) => a.stop).ap,
  );
  const bigger = S.specification({ ...s, imageCircleMm: 46.3 });
  assert.equal(E.analysisSpec(bigger).maxFieldHeightMm, 23.15);
});
test("configurable rear envelope rejects occupied mechanical stations without assuming PL geometry", () => {
  const { s, system } = good(),
    c = O.compile(system),
    a = c.surfaces.find((a) => a.glass !== "AIR");
  const station = c.imageX - (a.vx + a.t / 2);
  assert.equal(
    P.prepare(system, {
      ...s,
      rearClearanceEnvelope: [
        { distanceFromImageMm: station, maxDiameterMm: 1 },
      ],
    }).code,
    "REAR_CLEARANCE",
  );
  assert.equal(P.prepare(system, { ...s, flangeFocalDistanceMm: 1 }).ok, true);
});
test("thickened seeds retain actual power metadata and positive/negative element roles", () => {
  const { system } = good("modified-gauss", {
    targetFNumber: 2,
    imageCircleMm: 36,
  });
  for (const p of system.synthesis.powers) {
    const i = system.surfaces.findIndex(
      (a) => a.element === p.element && a.glass !== "AIR",
    );
    assert.ok(Math.abs(p.frontCurvature - 1 / system.surfaces[i].R) < 1e-12);
    assert.ok(Math.abs(p.rearCurvature - 1 / system.surfaces[i + 1].R) < 1e-12);
    assert.equal(Math.sign(p.thinPower), p.role);
  }
});
test("a pre-ray BFL failure cannot enter global optimization", async () => {
  const s = E.create({ topology: "cooke", budget: 256, minBflMm: 1000 });
  while (!s.done) await E.step(s);
  assert.equal(s.counts.global, 0);
  assert.equal(s.counts.coarse, 0);
  assert.equal(s.results.length, 0);
  assert.ok(s.rejections.BFL_TOO_SHORT > 0);
});
test("custom field operands and fixed image-gap policy are honored", () => {
  const { s, system } = good("cooke", {
    fields: [0, 0.25, 1],
    focusPolicy: "fixed-prescription",
  });
  assert.ok(
    E.operands(s)
      .filter((a) => a.metric === "rms")
      .every((a) => s.fields.includes(a.field)),
  );
  assert.ok(
    !G.variables(system, s).some(
      (a) => a.key === "t" && a.surface === system.surfaces.length - 2,
    ),
  );
});
test("synthesis worker count does not change prescriptions or numerical results", async () => {
  const Pool = require("../optimization/pool"),
    adapter = require("../tools/worker-adapter.cjs");
  const out = [];
  for (const workers of [1, 3]) {
    const s = E.create({
      topology: "cooke",
      budget: 600,
      parentsPerTopology: 1,
      archiveSize: 2,
    });
    const pool = new Pool(workers, adapter);
    try {
      while (!s.done) await E.step(s, pool);
      out.push(s);
    } finally {
      pool.close();
    }
  }
  assert.deepEqual(out[0].results, out[1].results);
  assert.deepEqual(out[0].counts, out[1].counts);
});
test("glass substitution is re-traced and re-optimized with an explicit audit trail", async () => {
  const Glass = require("../synthesis/glass");
  const { s, system } = good();
  const item = { system, topology: "cooke", ordinal: 0 };
  const r = await Glass.optimize(item, s, E.operands(s), { perTrialBudget: 8 });
  assert.ok(r.glassSearch.evaluations > 0);
  assert.equal(r.glassSearch.trials.length, 3);
  assert.ok(r.glassSearch.trials.every((t) => typeof t.status === "string"));
  assert.ok(P.prepare(r.system, s).ok);
});
test("complete budget including local and dense stages is never exceeded at small custom budgets", async () => {
  const s = E.create({
    budget: 256,
    seedFraction: 0.45,
    localFraction: 0.3,
    denseFraction: 0.04,
    archiveSize: 32,
    parentsPerTopology: 8,
  });
  while (!s.done) await E.step(s);
  assert.ok(
    ["seeds", "coarse", "global", "local", "dense"].reduce(
      (n, k) => n + s.counts[k],
      0,
    ) <= s.spec.budget,
  );
});

test("mechanical minimum BFL also protects the actual common image plane", () => {
  const { s, system } = good();
  const near = structuredClone(system);
  near.surfaces.at(-2).t = s.minBflMm - 1;
  const p = P.prepare(near, s);
  assert.equal(p.code, "IMAGE_PLANE_CLEARANCE");
  assert.ok(p.p.bflMm >= s.minBflMm);
  assert.equal(p.checks.rearToImage, false);
});
test("checkpoint population ranks are measured again before resume", async () => {
  const s = E.create({
    topology: "cooke",
    budget: 1000,
    parentsPerTopology: 1,
    archiveSize: 2,
  });
  while (!s.current || !s.current.population.length) await E.step(s);
  const raw = JSON.parse(JSON.stringify(s));
  const i = raw.current.scores.findIndex(Number.isFinite);
  assert.ok(i >= 0);
  raw.current.scores[i] += 1;
  assert.throws(() => E.restore(raw), /rankings changed/);
});
