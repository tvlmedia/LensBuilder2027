const { test } = require("node:test"),
  a = require("node:assert/strict");
const I = require("../import/report.js"),
  History = require("../ui/history.js");
const valid =
  "VERS 1\nMODE SEQ\nUNIT MM\nSURF 0\nDISZ INFINITY\nSURF 1\nTYPE STANDARD\nCURV .02\nDISZ 5\nDIAM 5\nGLAS N-BK7\nSTOP\nSURF 2\nCURV -.02\nDISZ 50\nDIAM 5\nSURF 3\n";
test("supported spherical Zemax report", () => {
  const r = I.inspect(valid);
  a.equal(r.blocked, false);
  a.ok(r.supported.length > 10);
});
test("mirrors/aspheres/pickups/unknown tokens fail visibly", () => {
  for (const line of [
    "TYPE EVENASPH",
    "CONI -1",
    "PARM 1 1e-5",
    "GLAS MIRROR",
    "PICK 1 2",
    "FUTURE_OPTICAL_FEATURE 3",
  ]) {
    const r = I.inspect(valid + "\n" + line);
    a.ok(r.blocked, line);
    a.equal(r.failed.length, 1);
    a.match(I.describe(r), /FAILED: 1/);
  }
});
test("finite conjugates, nonangular fields and vignetting factors not silently ignored", () => {
  for (const text of [
    valid.replace("DISZ INFINITY", "DISZ 2000"),
    valid + "FTYP 1",
    valid + "VDXN .1",
  ])
    a.ok(I.inspect(text).blocked);
});
test("partial configuration import excluded from optimization", () => {
  const r = I.inspect(valid + "MNUM 2\nTHIC 1 2 4");
  a.ok(r.blocked);
  a.equal(r.partial.length, 2);
});
test("history ignores derived vertices and keeps adoption atomic", () => {
  const h = new History(),
    original = { surfaces: [{ R: 10, t: 2, vx: 1 }] },
    changed = { surfaces: [{ R: 20, t: 3, vx: 2 }] };
  h.record(original);
  h.record({ ...original, surfaces: [{ R: 10, t: 2, vx: 99 }] });
  a.equal(h.past.length, 0);
  h.record(changed);
  a.deepEqual(h.undo(), { surfaces: [{ R: 10, t: 2 }] });
  a.deepEqual(h.redo(), { surfaces: [{ R: 20, t: 3 }] });
  h.undo();
  h.record({ surfaces: [{ R: 30 }] });
  a.equal(h.redo(), null);
});
test("actual legacy importer extracted: units, curvatures, material, stop, wavelength", () => {
  const Z = require("../import/zemax.js");
  const s = Z.parseZemaxSequentialText(
    valid.replace("UNIT MM", "UNIT CM") + "WAVM 1 .5875618 1\nPWAV 1",
  );
  a.equal(s.surfaces[1].R, 500);
  a.equal(s.surfaces[1].t, 50);
  a.equal(s.surfaces[1].ap, 50);
  a.equal(s.surfaces[1].glass, "N-BK7");
  a.equal(s.surfaces[1].stop, true);
  a.ok(Math.abs(s.zemax.primaryWavelengthNm - 587.5618) < 1e-9);
  a.ok(!s.importReport.blocked);
  a.throws(() => Z.parseZemaxSequentialText(valid + "GLAS MIRROR"), /FAILED/);
});
test("actual importer keeps custom nd/Vd and zoom thickness metadata", () => {
  const Z = require("../import/zemax.js");
  const custom = Z.parseZemaxSequentialText(
    valid.replace("GLAS N-BK7", "GLAS ___BLANK 0 0 1.6 40"),
  );
  a.equal(custom.surfaces[1].nd, 1.6);
  a.equal(custom.surfaces[1].vd, 40);
  const zoom = Z.parseZemaxSequentialText(valid + "MNUM 2\nTHIC 1 2 9");
  a.equal(zoom.zoom.configs[1].thicknessOverrides["1"], 9);
  a.ok(zoom.importReport.blocked);
});

test("invalid or missing numerical/material data produces a failed import report", () => {
  const Z = require("../import/zemax.js");
  for (const text of [
    valid.replace("DIAM 5", "DIAM 0"),
    valid.replace("DIAM 5", ""),
    valid.replace("CURV .02", "CURV abc"),
    valid.replace("GLAS N-BK7", "GLAS UNKNOWN"),
    valid.replace("GLAS N-BK7", "GLAS ___BLANK 0 0 1.6"),
  ]) {
    a.throws(
      () => Z.parseZemaxSequentialText(text),
      (e) => e.importReport?.blocked && e.importReport.failed.length > 0,
    );
  }
});
