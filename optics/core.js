/* DOM-free, coaxial sequential spherical optics. Internal lengths: mm. */
(function (root) {
  "use strict";
  const M = root.LBMaterials || require("../materials/catalog.js");
  const EPS = Object.freeze({ distance: 1e-8, direction: 1e-12, aim: 1e-7 });
  const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
  const mul = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
  function unit(v) {
    const h = Math.hypot(v.x, v.y, v.z);
    if (!Number.isFinite(h) || h < EPS.direction)
      throw new Error("Invalid ray vector");
    return mul(v, 1 / h);
  }
  function refract(I, N, n1, n2) {
    if (!(n1 > 0 && n2 > 0 && Number.isFinite(n1 + n2)))
      throw new Error("Invalid refractive index");
    I = unit(I);
    N = unit(N);
    if (dot(I, N) > 0) N = mul(N, -1);
    const c = -dot(I, N),
      eta = n1 / n2,
      k = 1 - eta * eta * (1 - c * c);
    if (k < -1e-14) return null;
    return unit(add(mul(I, eta), mul(N, eta * c - Math.sqrt(Math.max(0, k)))));
  }
  function sag(R, r) {
    if (R === 0) return 0;
    const q = 1 - (r / R) ** 2;
    if (q < 0) return NaN;
    return (r * r) / R / (1 + Math.sqrt(q));
  }
  function intersect(ray, s) {
    const { p, d } = ray,
      R = s.R,
      vx = s.vx;
    if (![p.x, p.y, p.z, d.x, d.y, d.z, R, vx].every(Number.isFinite))
      return null;
    let roots;
    if (R === 0) {
      if (Math.abs(d.x) < EPS.direction) return null;
      roots = [(vx - p.x) / d.x];
    } else {
      const x = p.x - vx,
        A = dot(d, d),
        B = 2 * ((x - R) * d.x + p.y * d.y + p.z * d.z),
        C = x * (x - 2 * R) + p.y * p.y + p.z * p.z;
      const disc = B * B - 4 * A * C;
      if (disc < 0 || A < EPS.direction) return null;
      const q = -0.5 * (B + (B < 0 ? -1 : 1) * Math.sqrt(disc));
      roots = q === 0 ? [-B / (2 * A)] : [q / A, C / q];
    }
    for (const t0 of roots.sort((a, b) => a - b)) {
      if (t0 < -EPS.distance || !Number.isFinite(t0)) continue;
      const t = Math.max(0, t0),
        hit = add(p, mul(d, t)),
        r = Math.hypot(hit.y, hit.z);
      if (
        R !== 0 &&
        Math.abs(hit.x - vx - sag(R, r)) >
          EPS.distance * Math.max(1, Math.abs(vx), Math.abs(R))
      )
        continue;
      const normal =
        R === 0
          ? { x: -1, y: 0, z: 0 }
          : unit({ x: hit.x - vx - R, y: hit.y, z: hit.z });
      return { hit, t, normal, vignetted: r > s.ap + EPS.distance };
    }
    return null;
  }
  function validate(system, limits = {}) {
    const errors = [],
      warnings = [];
    const src = system?.surfaces;
    for (const [key, value] of Object.entries(limits))
      if (
        ![
          "minEdgeMm",
          "minCenterMm",
          "minAirGapMm",
          "maxDiameterMm",
          "maxLengthMm",
          "minBflMm",
        ].includes(key) ||
        !Number.isFinite(value) ||
        value < 0
      )
        errors.push(`Invalid/unsupported constraint ${key}`);
    if (!Array.isArray(src) || src.length < 4)
      return {
        errors: ["Need OBJ, at least two physical surfaces, and IMS"],
        warnings,
      };
    if (Number(src[0].t || 0) !== 0)
      errors.push("Finite OBJ spacing unsupported by infinity evaluator");
    if (src[0].type !== "OBJ" || src.at(-1).type !== "IMS")
      errors.push("Prescription must start with OBJ and end with IMS");
    if (src[0].stop || src.at(-1).stop)
      errors.push("OBJ/IMS cannot be aperture stops");
    if (src.filter((s) => s.stop).length !== 1)
      errors.push("Exactly one aperture stop is required");
    if (system.importReport?.blocked)
      errors.push("Import report contains unsupported optical features");
    let x = 0;
    const surfaces = [];
    src.slice(1, -1).forEach((s, i) => {
      const ap = Number(s.ap_optical ?? s.ap),
        R = Number(s.R),
        t = Number(s.t);
      if (![ap, R, t].every(Number.isFinite) || ap <= 0 || t < 0)
        errors.push(`Surface ${i + 1}: invalid radius, aperture or thickness`);
      if (
        (s.surfaceType &&
          !["STANDARD", "SPHERICAL", "PLANE"].includes(
            s.surfaceType.toUpperCase(),
          )) ||
        Number(s.conic || 0) !== 0 ||
        Object.values(s.aspheric || {}).some((v) => Number(v) !== 0)
      )
        errors.push(`Surface ${i + 1}: unsupported surface model`);
      if (["MECH", "BAFFLE", "HOUSING"].includes(s.type))
        errors.push(
          `Surface ${i + 1}: mechanical-only surfaces unavailable in evaluator`,
        );
      if (R !== 0 && ap >= Math.abs(R))
        errors.push(`Surface ${i + 1}: clear aperture reaches sphere equator`);
      try {
        const m = M.material(s);
        if (m.model === "nd-vd-approximate")
          warnings.push(
            `Surface ${i + 1}: APPROXIMATE nd/Vd dispersion (${m.name})`,
          );
      } catch (e) {
        errors.push(`Surface ${i + 1}: ${e.message}`);
      }
      if (ap * 2 > (limits.maxDiameterMm ?? Infinity))
        errors.push(`Surface ${i + 1}: diameter limit`);
      surfaces.push({ ...s, R, t, ap, vx: x, sourceIndex: i + 1 });
      x += t;
    });
    if (src[0].glass && src[0].glass !== "AIR")
      errors.push("Object medium must be AIR");
    if (surfaces.at(-1)?.glass !== "AIR")
      errors.push("Image medium must be AIR");
    for (let i = 0; i < surfaces.length - 1; i++) {
      const a = surfaces[i],
        b = surfaces[i + 1],
        r = Math.min(a.ap, b.ap);
      // Difference of two coaxial spherical sags is monotonic in r: endpoint checks suffice.
      const minGap = Math.min(a.t, a.t + sag(b.R, r) - sag(a.R, r));
      const glass = a.glass !== "AIR";
      const minimum = glass
        ? (limits.minEdgeMm ?? 0.05)
        : (limits.minAirGapMm ?? 0);
      if (!Number.isFinite(minGap) || minGap < minimum - EPS.distance)
        errors.push(
          `Surfaces ${i + 1}/${i + 2}: overlap or insufficient ${glass ? "edge thickness" : "air clearance"}`,
        );
      if (glass && a.t < (limits.minCenterMm ?? 0.1))
        errors.push(`Surface ${i + 1}: center thickness limit`);
    }
    const rear = surfaces.at(-1);
    if (rear && rear.t < Math.max(0, sag(rear.R, rear.ap)) + EPS.distance)
      errors.push("Image plane intersects or precedes rear surface");
    if (x > (limits.maxLengthMm ?? Infinity))
      errors.push("Optical length including image gap exceeds limit");
    return { errors, warnings, surfaces, imageX: x };
  }
  function compile(system, nm = M.wavelengths.d, limits = {}) {
    const v = validate(system, limits);
    if (v.errors.length) throw new Error(v.errors.join("; "));
    return compileValidated(v, nm);
  }
  // Internal fast path: caller must supply an unchanged successful validate() result.
  function compileValidated(v, nm) {
    if (v.errors.length) throw new Error(v.errors.join("; "));
    let before = 1;
    const surfaces = v.surfaces.map((s) => {
      const n2 = M.index(s, nm);
      const out = { ...s, n1: before, n2 };
      before = n2;
      return out;
    });
    return {
      ...v,
      surfaces,
      nm,
      stopIndex: surfaces.findIndex((s) => s.stop),
      startX:
        Math.min(...surfaces.map((s) => s.vx + Math.min(0, sag(s.R, s.ap)))) -
        1,
    };
  }
  function trace(c, ray, { clip = true, toStop = false, record = false } = {}) {
    let p = ray.p,
      d = unit(ray.d);
    const points = [];
    for (let i = 0; i < c.surfaces.length; i++) {
      const s = c.surfaces[i],
        h = intersect({ p, d }, s);
      if (!h) return { ok: false, reason: "miss", surface: i };
      if (clip && h.vignetted)
        return { ok: false, reason: "clipped", surface: i };
      if (record) points.push(h.hit);
      if (toStop && i === c.stopIndex)
        return { ok: true, hit: h.hit, d, points };
      const next = refract(d, h.normal, s.n1, s.n2);
      if (!next) return { ok: false, reason: "tir", surface: i };
      p = h.hit;
      d = next;
    }
    if (Math.abs(d.x) < EPS.direction)
      return { ok: false, reason: "parallel_image" };
    const t = (c.imageX - p.x) / d.x;
    if (t < 0) return { ok: false, reason: "image_behind_ray" };
    return { ok: true, hit: add(p, mul(d, t)), p, d, points };
  }
  function multiply(a, b) {
    return [
      a[0] * b[0] + a[1] * b[2],
      a[0] * b[1] + a[1] * b[3],
      a[2] * b[0] + a[3] * b[2],
      a[2] * b[1] + a[3] * b[3],
    ];
  }
  function paraxial(c) {
    let mat = [1, 0, 0, 1],
      preStop = null;
    c.surfaces.forEach((s, i) => {
      if (i === c.stopIndex) preStop = mat.slice();
      mat = multiply([1, 0, s.R === 0 ? 0 : -(s.n2 - s.n1) / s.R, 1], mat);
      if (i < c.surfaces.length - 1) mat = multiply([1, s.t / s.n2, 0, 1], mat);
    });
    const [A, B, C, D] = mat;
    if (Math.abs(C) < 1e-14)
      throw new Error("Afocal system: focal metrics unavailable");
    const efl = -1 / C,
      bfl = -A / C,
      ffl = D / C,
      length = c.surfaces.at(-1).vx;
    if (!preStop || Math.abs(preStop[0]) < 1e-12)
      throw new Error("Entrance pupil at infinity unsupported");
    const pupilRadius = c.surfaces[c.stopIndex].ap / Math.abs(preStop[0]);
    return {
      matrix: mat,
      eflMm: efl,
      bflMm: bfl,
      fflMm: ffl,
      frontPrincipalMm: ffl + efl,
      rearPrincipalMm: length + bfl - efl,
      entrancePupilXMm: preStop[1] / preStop[0],
      entrancePupilRadiusMm: pupilRadius,
      fNumber: Math.abs(efl) / (2 * pupilRadius),
      preStop,
      imageDistanceMm: c.imageX - length,
      tStop: null,
    };
  }
  function aimChief(c, angleRad, objectDistanceMm = Infinity) {
    const f = paraxial(c),
      slope = Math.tan(angleRad),
      x = c.startX;
    const object = { x: -objectDistanceMm, y: -objectDistanceMm * slope, z: 0 };
    let y = (x - f.entrancePupilXMm) * slope;
    function ray(v) {
      const p = { x, y: v, z: 0 };
      return {
        p,
        d: Number.isFinite(objectDistanceMm)
          ? unit({ x: p.x - object.x, y: p.y - object.y, z: 0 })
          : unit({ x: 1, y: slope, z: 0 }),
      };
    }
    for (let it = 0; it < 16; it++) {
      const r = trace(c, ray(y), { clip: false, toStop: true });
      if (!r.ok) return null;
      if (Math.abs(r.hit.y) < EPS.aim)
        return { ...ray(y), residualMm: Math.abs(r.hit.y) };
      const h = 1e-4,
        r2 = trace(c, ray(y + h), { clip: false, toStop: true });
      if (!r2.ok) return null;
      const derivative = (r2.hit.y - r.hit.y) / h;
      if (Math.abs(derivative) < 1e-8) return null;
      y -= Math.max(
        -c.surfaces[0].ap,
        Math.min(c.surfaces[0].ap, r.hit.y / derivative),
      );
    }
    return null;
  }
  const api = {
    EPS,
    dot,
    add,
    mul,
    unit,
    refract,
    sag,
    intersect,
    validate,
    compile,
    compileValidated,
    trace,
    multiply,
    paraxial,
    aimChief,
  };
  root.LBOptics = api;
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);
