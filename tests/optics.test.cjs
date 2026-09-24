const { test } = require("node:test");
const a = require("node:assert/strict");
const O = require("../optics/core.js"),
  M = require("../materials/catalog.js");
function close(x, y, t = 1e-8) {
  a.ok(Math.abs(x - y) < t, `${x} != ${y}`);
}
const singlet = () => ({
  name: "Analytic symmetric thick singlet",
  surfaces: [
    { type: "OBJ", glass: "AIR", t: 0, R: 0, ap: 20 },
    {
      type: "1",
      R: 50,
      t: 5,
      ap: 5,
      glass: "CUSTOM",
      nd: 1.5,
      vd: 60,
      stop: true,
    },
    { type: "2", R: -50, t: 50, ap: 5, glass: "AIR" },
    { type: "IMS", R: 0, t: 0, ap: 20, glass: "AIR" },
  ],
});
test("plane intersection and oblique Snell law", () => {
  const I = O.unit({ x: Math.cos(0.4), y: Math.sin(0.4), z: 0 });
  const d = O.refract(I, { x: -1, y: 0, z: 0 }, 1, 1.5);
  close(d.y, Math.sin(0.4) / 1.5);
  const h = O.intersect(
    { p: { x: -2, y: 0, z: 0 }, d: I },
    { vx: 0, R: 0, ap: 5 },
  );
  close(h.hit.x, 0);
});
test("TIR and reciprocity", () => {
  a.equal(
    O.refract(O.unit({ x: 0.4, y: 1, z: 0 }), { x: -1, y: 0, z: 0 }, 1.5, 1),
    null,
  );
  const I = O.unit({ x: 1, y: 0.2, z: 0.1 }),
    N = O.unit({ x: -1, y: 0.1, z: 0.2 });
  const T = O.refract(I, N, 1, 1.5),
    back = O.refract(O.mul(T, -1), N, 1.5, 1);
  close(O.dot(back, I), -1);
});
test("sphere roots choose vertex hemisphere in both directions and radius signs", () => {
  for (const R of [-50, 50])
    for (const reverse of [false, true]) {
      const x = O.sag(R, 3),
        h = O.intersect(
          {
            p: { x: reverse ? 10 : -10, y: 3, z: 0 },
            d: { x: reverse ? -1 : 1, y: 0, z: 0 },
          },
          { vx: 0, R, ap: 5 },
        );
      close(h.hit.x, x);
    }
});
test("large radius avoids catastrophic vertex cancellation", () => {
  const h = O.intersect(
    { p: { x: -1, y: 1, z: 0 }, d: { x: 1, y: 0, z: 0 } },
    { vx: 0, R: 1e9, ap: 5 },
  );
  close(h.hit.x, 5e-10, 1e-12);
});
test("datasheet indices C d F", () => {
  for (const [g, vals] of [
    ["N-BK7HT", [1.51432, 1.5168, 1.52238]],
    ["N-F2", [1.61506, 1.62005, 1.63208]],
  ])
    [M.wavelengths.C, M.wavelengths.d, M.wavelengths.F].forEach((nm, i) =>
      close(M.index(g, nm), vals[i], 6e-6),
    );
});
test("unknown and legacy substituted glass fail; user nd/Vd marked approximate", () => {
  a.throws(() => M.index("NO_SUCH_GLASS"), /Unknown/);
  a.throws(() => M.index("LASF35"), /explicit/);
  a.equal(
    M.material({ glass: "custom", nd: 1.5, vd: 60 }).model,
    "nd-vd-approximate",
  );
  a.throws(() => M.index("N-F2", 200), /scope/);
});
test("thick lens analytic EFL BFL and determinant", () => {
  const c = O.compile(singlet()),
    f = O.paraxial(c);
  const power = 0.5 * (1 / 50 - 1 / -50 + (0.5 * 5) / (1.5 * 50 * -50));
  close(f.eflMm, 1 / power);
  close(f.bflMm, (1 - (5 * 0.5) / (1.5 * 50)) / power);
  close(f.matrix[0] * f.matrix[3] - f.matrix[1] * f.matrix[2], 1);
  close(f.fNumber, f.eflMm / 10);
});
test("real near-axis ray agrees with paraxial focus", () => {
  const c = O.compile(singlet());
  const t = O.trace(c, {
    p: { x: -1, y: 0.001, z: 0 },
    d: { x: 1, y: 0, z: 0 },
  });
  a.ok(t.ok);
  close(
    t.p.x - (t.p.y * t.d.x) / t.d.y,
    c.surfaces.at(-1).vx + O.paraxial(c).bflMm,
    1e-5,
  );
});
test("chief ray really reaches stop center, finite/infinite conjugates", () => {
  const s = singlet();
  s.surfaces[1].stop = false;
  s.surfaces.splice(3, 0, {
    type: "STOP",
    R: 0,
    t: 40,
    ap: 3,
    glass: "AIR",
    stop: true,
  });
  s.surfaces[2].t = 10;
  for (const distance of [Infinity, 2000]) {
    const c = O.compile(s),
      r = O.aimChief(c, 0.08, distance);
    a.ok(r);
    close(O.trace(c, r, { clip: false, toStop: true }).hit.y, 0, 1e-7);
  }
});
test("invalid geometry, asphere and mirror fail before tracing", () => {
  let s = singlet();
  s.surfaces[1].t = -1;
  a.throws(() => O.compile(s), /thickness/);
  s = singlet();
  s.surfaces[1].conic = -1;
  a.throws(() => O.compile(s), /unsupported/);
  s = singlet();
  s.surfaces[1].glass = "MIRROR";
  a.throws(() => O.compile(s), /Unknown/);
  s = singlet();
  s.surfaces[1].t = 0.1;
  s.surfaces[1].ap = 20;
  s.surfaces[2].ap = 20;
  a.throws(() => O.compile(s), /overlap/);
});
test("clipping and misses are distinct expected ray outcomes", () => {
  const c = O.compile(singlet());
  a.equal(
    O.trace(c, { p: { x: -1, y: 8, z: 0 }, d: { x: 1, y: 0, z: 0 } }).reason,
    "clipped",
  );
  a.equal(
    O.trace(c, { p: { x: -1, y: 60, z: 0 }, d: { x: 1, y: 0, z: 0 } }).reason,
    "miss",
  );
});
module.exports = { singlet, close };
