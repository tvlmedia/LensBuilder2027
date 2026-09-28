/* Synthesis-only hard constraints and a physical iris solve. No merit surrogate. */
(function (root) {
  "use strict";
  const O = root.LBOptics || require("../optics/core.js"),
    G = root.LBMaterials || require("../materials/catalog.js");
  const clone = (x) => structuredClone(x);
  function limits(s) {
    return {
      minEdgeMm: s.minEdgeMm,
      minCenterMm: s.minCenterMm,
      minAirGapMm: Math.max(s.minAirGapMm, s.minMechanicalClearanceMm),
      maxDiameterMm: s.maxDiameterMm,
      maxLengthMm: s.maxOpticalLengthMm,
      minBflMm: s.minBflMm,
    };
  }
  function construction(lens) {
    const a = lens.surfaces.slice(1, -1);
    let groups = 0,
      elements = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i].glass !== "AIR") {
        elements++;
        if (i === 0 || a[i - 1].glass === "AIR") groups++;
      }
    }
    return {
      elements,
      groups,
      glasses: [
        ...new Set(a.filter((s) => s.glass !== "AIR").map((s) => s.glass)),
      ],
    };
  }
  function code(errors) {
    const t = errors.join(";");
    return /edge/.test(t)
      ? "INVALID_EDGE_THICKNESS"
      : /center/.test(t)
        ? "CENTER_THICKNESS"
        : /air clearance|overlap/.test(t)
          ? "AIR_CLEARANCE"
          : /diameter/.test(t)
            ? "DIAMETER_LIMIT"
            : /material|Material/.test(t)
              ? "MATERIAL_INVALID"
              : "INVALID_GEOMETRY";
  }
  function firstOrder(lens) {
    const v = O.validate(lens);
    if (v.errors.length)
      return { ok: false, code: code(v.errors), errors: v.errors };
    try {
      return {
        ok: true,
        p: O.paraxial(O.compileValidated(v, G.wavelengths.d)),
        v,
      };
    } catch (e) {
      return { ok: false, code: "PARAXIAL_FAILURE", errors: [e.message] };
    }
  }
  function prepare(lens, s) {
    // Copy only surfaces: required for pure evaluation/worker consistency.
    const system = { ...lens, surfaces: lens.surfaces.map((a) => ({ ...a })) };
    const before = firstOrder(system);
    if (!before.ok) return { ...before, system };
    const iris = system.surfaces.find((a) => a.stop);
    const radius =
      Math.abs(before.p.eflMm * before.p.preStop[0]) / (2 * s.targetFNumber);
    if (!Number.isFinite(radius) || radius <= 0 || 2 * radius > s.maxDiameterMm)
      return {
        ok: false,
        code: "APERTURE_FAILURE",
        errors: ["Required physical iris exceeds diameter limit"],
        system,
      };
    iris.ap = iris.ap_optical = radius;
    const v = O.validate(system, limits(s));
    if (v.errors.length)
      return { ok: false, code: code(v.errors), errors: v.errors, system };
    const p = O.paraxial(O.compileValidated(v, G.wavelengths.d)),
      counts = construction(system),
      checks = {
        geometry: true,
        efl: Math.abs(p.eflMm - s.targetEflMm) <= s.eflToleranceMm + 1e-9,
        fNumber: Math.abs(p.fNumber - s.targetFNumber) <= s.fNumberTolerance,
        bfl: p.bflMm >= s.minBflMm,
        rearToImage: p.imageDistanceMm >= s.minBflMm,
        construction:
          counts.elements >= s.minElements &&
          counts.elements <= s.maxElements &&
          counts.groups >= s.minGroups &&
          counts.groups <= s.maxGroups &&
          (s.cementedAllowed || counts.elements === counts.groups),
        materials:
          counts.glasses.length <= s.maxUniqueGlasses &&
          counts.glasses.every((g) => s.allowedGlasses.includes(g)),
        rearDiameter: 2 * system.surfaces.at(-2).ap <= s.maxRearDiameterMm,
        rearClearance: true,
      };
    // Configurable axial stations measured forward from sensor. A spherical element
    // envelope uses the larger face radius conservatively; no invented PL throat.
    for (let i = 0; i < v.surfaces.length - 1; i++) {
      const a = v.surfaces[i],
        b = v.surfaces[i + 1];
      if (a.glass === "AIR") continue;
      const radius = Math.max(a.ap, b.ap),
        lo = a.vx + Math.min(0, O.sag(a.R, a.ap)),
        hi = b.vx + Math.max(0, O.sag(b.R, b.ap));
      for (const e of s.rearClearanceEnvelope) {
        const x = v.imageX - e.distanceFromImageMm;
        if (
          x >= lo - s.minMechanicalClearanceMm &&
          x <= hi + s.minMechanicalClearanceMm &&
          2 * (radius + s.minMechanicalClearanceMm) > e.maxDiameterMm
        )
          checks.rearClearance = false;
      }
    }
    const fail = Object.entries(checks).find(([, value]) => !value);
    return {
      ok: !fail,
      system,
      p,
      checks,
      counts,
      code: fail
        ? {
            efl: "EFL_OUT_OF_RANGE",
            fNumber: "APERTURE_FAILURE",
            bfl: "BFL_TOO_SHORT",
            rearToImage: "IMAGE_PLANE_CLEARANCE",
            materials: "MATERIAL_INVALID",
            rearDiameter: "REAR_DIAMETER",
            rearClearance: "REAR_CLEARANCE",
            construction: "TOPOLOGY_CONSTRAINT",
          }[fail[0]]
        : null,
      errors: fail ? [fail[0] + " outside specification"] : [],
    };
  }
  function apertures(lens, s, grid = 7) {
    // Unclipped physical rays estimate face footprints. Stop radius stays fixed.
    // Trace failures are not hidden; final clipped tracing decides coverage.
    const out = clone(lens),
      f = firstOrder(out);
    if (!f.ok) return f;
    const required = out.surfaces.slice(1, -1).map(() => 0);
    let rays = 0,
      failed = 0;
    for (const w of s.wavelengths) {
      const nm = typeof w === "number" ? w : w.nm;
      const c = O.compile(out, nm),
        p = O.paraxial(c);
      for (const field of s.fields) {
        const chief = O.aimChief(
          c,
          Math.atan((field * s.imageCircleMm) / 2 / s.targetEflMm),
        );
        if (!chief) {
          failed++;
          continue;
        }
        for (let j = -grid; j <= grid; j++)
          for (let k = -grid; k <= grid; k++) {
            if (j * j + k * k > grid * grid) continue;
            const tr = O.trace(
              c,
              {
                p: {
                  ...chief.p,
                  y: chief.p.y + (j / grid) * p.entrancePupilRadiusMm,
                  z: (k / grid) * p.entrancePupilRadiusMm,
                },
                d: chief.d,
              },
              { clip: false, record: true },
            );
            rays++;
            if (!tr.ok) {
              failed++;
              continue;
            }
            tr.points.forEach((h, i) => {
              required[i] = Math.max(required[i], Math.hypot(h.y, h.z));
            });
          }
      }
    }
    if (!rays || required.some((v, i) => v === 0 && !out.surfaces[i + 1].stop))
      return {
        ok: false,
        code: "RAYTRACE_FAILURE",
        errors: ["Cannot determine clear apertures"],
      };
    required.forEach((r, i) => {
      const a = out.surfaces[i + 1];
      if (!a.stop) a.ap = a.ap_optical = r + s.apertureMarginMm;
    });
    // Equal mechanical radius across every cemented group avoids unsupported ledges.
    let start = 1;
    while (start < out.surfaces.length - 1) {
      let end = start;
      while (out.surfaces[end].glass !== "AIR") end++;
      const radius = Math.max(
        ...out.surfaces.slice(start, end + 1).map((a) => a.ap),
      );
      for (let i = start; i <= end; i++)
        if (!out.surfaces[i].stop)
          out.surfaces[i].ap = out.surfaces[i].ap_optical = radius;
      start = end + 1;
    }
    const checked = prepare(out, s);
    return {
      ...checked,
      footprints: {
        grid,
        rays,
        failed,
        marginMm: s.apertureMarginMm,
        required,
      },
    };
  }
  const api = { limits, construction, firstOrder, prepare, apertures, code };
  root.LBSynthesisPhysics = api;
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);
