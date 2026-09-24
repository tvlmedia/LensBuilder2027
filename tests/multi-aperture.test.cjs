const { test } = require("node:test"),
  assert = require("node:assert/strict");
const O = require("../optics/core"),
  A = require("../analysis/evaluate"),
  U = require("../analysis/multi-aperture"),
  D = require("../analysis/aberrations"),
  M = require("../design/merit"),
  E = require("../optimization/explorer");
const base = require("../bijna-goed.json"),
  spec = {
    targetEflMm: 58.01286972902018,
    targetFNumber: 2,
    imageCircleMm: 44.712,
    pupilGrid: 9,
    minRayFraction: 0.1,
    maxStopRadiusMm: 16,
    focusPolicy: "fixed-prescription",
    apertures: [1.4, 2, 2.8, 5.6],
  };
const near = (a, b, t = 1e-9) => assert.ok(Math.abs(a - b) < t, `${a} vs ${b}`);
test("physical iris changes only two aperture fields; EFL and sensor invariant", () => {
  for (const f of [1.4, 2, 5.6]) {
    const r = U.atAperture(base, f, spec),
      copy = structuredClone(r.system),
      index = copy.surfaces.findIndex((s) => s.stop);
    copy.surfaces[index] = structuredClone(base.surfaces[index]);
    assert.deepEqual(copy, base);
    near(O.paraxial(O.compile(r.system)).fNumber, f);
    near(O.paraxial(O.compile(r.system)).eflMm, spec.targetEflMm);
  }
});
test("unachievable aperture and invalid configuration fail explicitly", () => {
  assert.throws(() => U.atAperture(base, 1.4), /capacity/);
  assert.throws(() => U.configuration({ apertures: [2, 2] }));
  assert.throws(() =>
    U.configuration({
      apertures: [{ fNumber: 2, optimization: true, validation: false }],
    }),
  );
  assert.throws(() =>
    A.settings({ ...spec, focusPolicy: "per-field-autofocus" }),
  );
});
test("distortion invariance across iris sizes and image-plane changes", () => {
  const r = U.evaluate(base, spec);
  assert.ok(r.valid);
  for (const ap of r.apertures)
    near(
      ap.analysis.fields.at(-1).distortionPercent,
      r.fields.at(-1).distortionPercent,
      1e-10,
    );
  const shifted = structuredClone(base);
  shifted.surfaces.at(-2).t = 35.02781561547425;
  const b = U.evaluate(shifted, spec);
  near(r.fields.at(-1).distortionPercent, b.fields.at(-1).distortionPercent);
  assert.ok(
    Math.abs(
      r.fields.at(-1).fixedPlaneMappingPercent -
        b.fields.at(-1).fixedPlaneMappingPercent,
    ) > 10,
  );
});
test("observed aperture case reconstructed by changed sensor gaps, not iris alone", () => {
  const fixture = require("./fixtures/aperture-distortion.json");
  for (const item of fixture.cases) {
    const b = structuredClone(fixture.prescription);
    b.surfaces.at(-2).t = item.imageGapMm;
    const r = U.evaluate(b, {
      ...fixture.specification,
      apertures: [item.fNumber],
    });
    near(
      r.fields.at(-1).fixedPlaneMappingPercent,
      item.oldFixedPlaneMappingPercent,
      1e-8,
    );
    near(r.fields[0].rmsMm, item.centerRmsMm, 0.0001);
  }
});
test("chief-referenced distortion equals independently traced singlet geometry", () => {
  const lens = {
    surfaces: [
      { type: "OBJ", glass: "AIR", R: 0, t: 0, ap: 5 },
      {
        type: "1",
        glass: "CUSTOM",
        nd: 1.5,
        vd: 60,
        R: 50,
        t: 5,
        ap: 3,
        stop: true,
      },
      { type: "2", glass: "AIR", R: -50, t: 48, ap: 3 },
      { type: "IMS", glass: "AIR", R: 0, t: 0, ap: 10 },
    ],
  };
  // Independent 2D geometry: chief hits front vertex; Snell gives internal angle.
  const angle = 0.03,
    n = 1.5,
    inside = Math.asin(Math.sin(angle) / n),
    dx = Math.cos(inside),
    dy = Math.sin(inside),
    cx = -45,
    R = 50;
  const B = -2 * cx * dx,
    C = cx * cx - R * R,
    t = (-B + Math.sqrt(B * B - 4 * C)) / 2,
    x = t * dx,
    y = t * dy;
  const normalAngle = Math.atan2(y, x - cx),
    outAngle = normalAngle + Math.asin(n * Math.sin(inside - normalAngle));
  const power = (n - 1) * (1 / 50 - 1 / -50 + ((n - 1) * 5) / (n * 50 * -50)),
    efl = 1 / power,
    bfl = efl * (1 - (5 * (n - 1)) / (n * 50)),
    height = y + (5 + bfl - x) * Math.tan(outAngle);
  const result = A.evaluate(lens, {
    targetEflMm: efl,
    imageCircleMm: 2 * efl * Math.tan(angle),
    fields: [0, 1],
    wavelengths: [{ nm: 587.5618, weight: 1 }],
    allowApproximateMaterials: true,
  });
  near(
    result.fields[1].distortionPercent,
    (100 * (height - efl * Math.tan(angle))) / (efl * Math.tan(angle)),
    1e-5,
  );
});
test("on-axis lateral color zero, symmetric tangential/sagittal spots and fan odd symmetry", () => {
  const r = U.evaluate(base, { ...spec, apertures: [5.6], diagnostics: true }),
    a = r.apertures[0].analysis,
    f = a.fields[0];
  near(f.lateralChiefColorMm, 0);
  near(f.tangentialRmsMm, f.sagittalRmsMm, 1e-10);
  for (const row of a.rows.filter((r) => r.field === 0)) {
    const fan = row.fans.filter((f) => f.axis === "tangential");
    for (let i = 0; i < fan.length; i++) {
      if (fan[i].ok && fan.at(-1 - i).ok)
        near(fan[i].transverseMm, -fan.at(-1 - i).transverseMm, 1e-8);
    }
    assert.ok(row.fans.some((f) => Number.isFinite(f.longitudinalFocusXMm)));
  }
});
test("least-variance focus solves an independently prescribed linear ray family", () => {
  const h = [-2, -1, 1, 2].map((x) => ({
    y: x,
    z: 2 * x,
    slopeY: -x / 10,
    slopeZ: -x / 20,
  }));
  const f = D.focus(h);
  near(f.tangentialShiftMm, 10);
  near(f.sagittalShiftMm, 40);
  near(f.astigmaticDifferenceMm, -30);
  const variance = (t) =>
    h.reduce(
      (n, r) => n + (r.y + t * r.slopeY) ** 2 + (r.z + t * r.slopeZ) ** 2,
      0,
    );
  assert.ok(variance(f.bestRmsShiftMm) < variance(f.bestRmsShiftMm - 0.1));
  assert.ok(variance(f.bestRmsShiftMm) < variance(f.bestRmsShiftMm + 0.1));
});
test("pupil maps count surviving samples exactly and diagnostics do not refocus RMS", () => {
  const plain = U.evaluate(base, { ...spec, apertures: [2] }),
    diag = U.evaluate(base, { ...spec, apertures: [2], diagnostics: true });
  near(plain.fields[0].rmsMm, diag.fields[0].rmsMm);
  for (const row of diag.rows) {
    assert.equal(row.pupil.length, row.launched);
    assert.equal(row.pupil.filter((p) => p.ok).length, row.accepted);
  }
  assert.ok(diag.fields.every((f) => f.diagnosticFocus));
});
test("aperture-specific and cross-aperture merit use exact metrics and explicit ratio floor", () => {
  const s = { ...spec, apertures: [{ fNumber: 2, weight: 2 }, 2.8] },
    r = U.evaluate(base, s);
  const a = r.apertures[0].analysis.fields[0].rmsMm,
    b = r.apertures[1].analysis.fields[0].rmsMm;
  for (const operation of ["CHANGE", "RATIO"]) {
    const o = {
        metric: "rms",
        field: 0,
        aperture: 2,
        compareAperture: 2.8,
        operation,
        type: "TARGET VALUE",
        target: 0,
        weight: 3,
        scale: 1,
      },
      score = M.score(r, [o]);
    near(score.breakdown[0].value, operation === "CHANGE" ? a - b : a / b);
    near(score.total, 6 * score.breakdown[0].value ** 2);
  }
  assert.equal(
    M.score(r, [
      {
        metric: "rms",
        field: 0,
        aperture: 2,
        compareAperture: 2.8,
        operation: "RATIO",
        ratioFloor: 100,
        target: 0,
        scale: 1,
        weight: 1,
      },
    ]).valid,
    false,
  );
});
test("multi-aperture DE checkpoints resume identically and dense validation visits validation-only apertures", () => {
  const s = {
      ...spec,
      pupilGrid: 5,
      apertures: [2, { fNumber: 4, optimization: false, validation: true }],
    },
    operands = M.defaultOperands(s),
    st = E.create(
      base,
      s,
      [{ surface: 13, key: "t", min: 34, max: 44 }],
      operands,
      { budget: 16, population: 4 },
    );
  E.accept(
    st,
    E.next(st).map((v) => E.evaluate(st, v)),
  );
  const restored = E.restore(JSON.parse(JSON.stringify(st)));
  for (const x of [st, restored])
    while (!x.done)
      E.accept(
        x,
        E.next(x).map((v) => E.evaluate(x, v)),
      );
  assert.deepEqual(st, restored);
  const dense = E.evaluate(st, st.archive[0].vector, true);
  assert.equal(dense.analysis.apertures.length, 2);
  assert.ok(
    dense.analysis.apertures.every(
      (a) => a.analysis.settings.pupilPattern === "sunflower",
    ),
  );
});

test("fourfold dense pupil preserves on-axis symmetry and focus plane covariance", () => {
  const r = U.evaluate(base, {
      ...spec,
      apertures: [5.6],
      pupilGrid: 19,
      pupilPattern: "sunflower",
      diagnostics: true,
    }),
    f = r.fields[0];
  near(f.tangentialRmsMm, f.sagittalRmsMm, 1e-10);
  near(f.diagnosticFocus.astigmaticDifferenceMm, 0, 1e-9);
  const shifted = structuredClone(base);
  shifted.surfaces.at(-2).t += 1;
  const b = U.evaluate(shifted, {
    ...spec,
    apertures: [5.6],
    pupilGrid: 19,
    pupilPattern: "sunflower",
    diagnostics: true,
  });
  near(
    b.fields[0].diagnosticFocus.bestRmsShiftMm,
    f.diagnosticFocus.bestRmsShiftMm - 1,
    1e-9,
  );
  near(
    b.fields[3].diagnosticFocus.fieldCurvatureRelativeToAxisMm,
    r.fields[3].diagnosticFocus.fieldCurvatureRelativeToAxisMm,
    1e-8,
  );
});
test("edited aperture config cannot silently resume and disabled objectives cannot score", () => {
  const s = E.create(
    base,
    { ...spec, apertures: [2, 2.8] },
    [{ surface: 13, key: "t", min: 34, max: 44 }],
    M.defaultOperands({ ...spec, apertures: [2, 2.8] }),
  );
  const bad = structuredClone(s);
  bad.spec.apertures[1] = 4;
  assert.throws(() => E.restore(bad));
  assert.throws(() =>
    M.validateOperands([
      { enabled: false, metric: "efl", target: 50, scale: 1, weight: 1 },
    ]),
  );
});
test("spherical longitudinal fan tends to paraxial focus for small pupil zones", () => {
  const lens = {
    surfaces: [
      { type: "OBJ", glass: "AIR", R: 0, t: 0, ap: 5 },
      { type: "1", glass: "N-BK7", R: 50, t: 5, ap: 0.2, stop: true },
      { type: "2", glass: "AIR", R: -50, t: 50, ap: 3 },
      { type: "IMS", glass: "AIR", R: 0, t: 0, ap: 10 },
    ],
  };
  const r = A.evaluate(lens, {
      targetEflMm: 50,
      imageCircleMm: 0.1,
      fields: [0, 1],
      diagnostics: true,
      pupilGrid: 19,
      pupilPattern: "sunflower",
    }),
    row = r.rows[1];
  const p = row.fans.find(
    (f) => f.axis === "tangential" && Math.abs(f.pupil - 0.1) < 1e-8,
  );
  assert.ok(Math.abs(p.longitudinalFocusXMm - row.paraxialFocusXMm) < 0.0001);
});
