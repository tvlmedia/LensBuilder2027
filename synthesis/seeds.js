(function (root) {
  "use strict";
  const F = root.LBDesignForms || require("./forms.js"),
    P = root.LBSynthesisPhysics || require("./physics.js"),
    O = root.LBOptics || require("../optics/core.js"),
    G = root.LBMaterials || require("../materials/catalog.js");
  function rng(seed) {
    let x = seed >>> 0;
    return () => {
      x = (x + 0x6d2b79f5) >>> 0;
      let t = x;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function generate(s, id, ordinal) {
    const f = F.get(id),
      r = rng(
        (s.seed +
          Math.imul(ordinal + 1, 2654435761) +
          F.forms.findIndex((a) => a.id === id) * 65537) >>>
          0,
      ),
      u = (a, b) => a + (b - a) * r(),
      efl = s.targetEflMm;
    // A separate stream preserves geometry draws and legacy checkpoint replay.
    const glassRandom = rng((s.seed ^ Math.imul(ordinal + 1, 2246822519)) >>> 0),
      choose = (list) => list[s.seedGlassPolicy === "sample-pairs-v1"
        ? Math.floor(glassRandom() * list.length) : 0],
      distinct = (list) => list.filter((name, i) => !list.slice(0, i).some(
        (other) => JSON.stringify([G.catalog[name].B, G.catalog[name].C]) ===
          JSON.stringify([G.catalog[other].B, G.catalog[other].C])));
    const crown = choose(distinct(s.allowedGlasses.filter((g) => G.catalog[g].Vd > 50))),
      flint = choose(distinct(s.allowedGlasses.filter((g) => G.catalog[g].Vd < 50))),
      surfaces = [
        { type: "OBJ", R: 0, t: 0, ap: 1, glass: "AIR", stop: false },
      ],
      powers = [];
    const add = (R, t, glass, group, element, stop = false) =>
      surfaces.push({
        type: stop ? "STOP" : "SPH",
        R,
        t,
        glass,
        ap: 0.01,
        stop,
        group,
        element,
      });
    let groupPowers;
    if (id === "cooke") {
      const neg = u(0.9, 1.8),
        split = u(0.42, 0.58);
      groupPowers = [[(1 + neg) * split], [-neg], [(1 + neg) * (1 - split)]];
    } else if (id === "sonnar") {
      groupPowers = [
        [u(0.7, 1.1)],
        [u(0.3, 0.7), -u(0.8, 1.4), u(0.2, 0.5)],
        [-u(0.3, 0.7), u(0.8, 1.2)],
      ];
    } else {
      const outer = u(0.8, 1.2),
        neg = u(0.65, 1.15),
        pos = u(0.25, 0.55),
        asym = u(1 - f.symmetry, 1 + f.symmetry);
      groupPowers = [
        [outer],
        [pos, -neg],
        [-neg * asym, pos * asym],
        [outer * asym],
      ];
    }
    let element = 0;
    for (let gi = 0; gi < f.groups.length; gi++) {
      const roles = f.groups[gi],
        pp = groupPowers[gi].map((p) => p / efl);
      let c;
      if (id === "cooke")
        c =
          (pp[0] / (G.index(roles[0] > 0 ? crown : flint) - 1)) * u(0.35, 0.8);
      else if (roles.length === 1)
        c = (pp[0] / (G.index(crown) - 1)) * u(0.65, 1.2);
      else if (id === "sonnar") c = u(0.4, 1.2) / efl;
      else if (gi === 1) c = u(0.65, 1.2) / efl;
      else c = -u(1.6, 2.6) / efl;
      for (let ei = 0; ei < roles.length; ei++) {
        const glass = roles[ei] > 0 ? crown : flint,
          power = pp[ei],
          thickness = efl * (roles[ei] > 0 ? u(0.045, 0.09) : u(0.025, 0.05));
        add(1 / c, thickness, glass, gi, element++);
        const next = c - power / (G.index(glass) - 1);
        powers.push({
          group: gi,
          element: element - 1,
          role: roles[ei],
          thinPower: power,
          glass,
          frontCurvature: c,
          rearCurvature: next,
        });
        c = next;
      }
      const gap = efl * (id === "cooke" ? u(0.06, 0.18) : u(0.035, 0.1));
      add(
        1 / c,
        gi === f.groups.length - 1 ? efl : gap,
        "AIR",
        gi,
        element - 1,
      );
      if (gi === f.stopAfter) {
        surfaces.at(-1).t = efl * u(0.07, 0.14);
        add(0, efl * u(0.07, 0.14), "AIR", null, null, true);
      }
    }
    surfaces.push({
      type: "IMS",
      R: 0,
      t: 0,
      ap: s.imageCircleMm / 2,
      glass: "AIR",
      stop: false,
    });
    if (id === "double-gauss" || id === "modified-gauss") {
      // Mirror the front half about the iris, then allow bounded asymmetry.
      const stopIndex = surfaces.findIndex((a) => a.stop),
        left = surfaces.slice(1, stopIndex),
        right = surfaces.slice(stopIndex + 1, -1);
      const magnitude = id === "double-gauss" ? 0.04 : 0.25;
      for (let i = 0; i < right.length; i++) {
        right[i].R =
          -left[left.length - 1 - i].R * u(1 - magnitude, 1 + magnitude);
        if (i < right.length - 1)
          right[i].t =
            left[left.length - 2 - i].t * u(1 - magnitude, 1 + magnitude);
      }
      for (const power of powers) {
        const front = surfaces.findIndex(
          (a) => a.element === power.element && a.glass !== "AIR",
        );
        power.frontCurvature = 1 / surfaces[front].R;
        power.rearCurvature = 1 / surfaces[front + 1].R;
        power.thinPower =
          (G.index(power.glass) - 1) *
          (power.frontCurvature - power.rearCurvature);
      }
      if (powers.some((p) => Math.sign(p.thinPower) !== p.role))
        return {
          ok: false,
          code: "POWER_DISTRIBUTION",
          errors: ["Asymmetry reversed an element role"],
        };
    }
    const lens = {
      name: s.name + " · " + f.name + " · " + ordinal,
      surfaces,
      synthesis: {
        topology: id,
        ordinal,
        seed: s.seed,
        powers,
        origin: "generated from specification; no input prescription",
      },
    };
    const first = P.firstOrder(lens);
    if (!first.ok) return first;
    const scale = efl / first.p.eflMm;
    if (!(scale > 0.15 && scale < 8))
      return {
        ok: false,
        code: "POWER_DISTRIBUTION",
        errors: ["Net power unsuitable"],
      };
    for (const a of surfaces.slice(1, -1)) {
      a.R *= scale;
      a.t *= scale;
    }
    powers.forEach((p) => {
      p.thinPower /= scale;
      p.frontCurvature /= scale;
      p.rearCurvature /= scale;
    });
    const q = P.firstOrder(lens);
    if (!q.ok) return q;
    if (q.p.bflMm < s.minBflMm)
      return {
        ok: false,
        code: "BFL_TOO_SHORT",
        errors: ["Paraxial BFL below limit"],
      };
    surfaces.at(-2).t = q.p.bflMm;
    const stop = surfaces.find((a) => a.stop);
    stop.ap = stop.ap_optical =
      Math.abs(q.p.eflMm * q.p.preStop[0]) / (2 * s.targetFNumber);
    // First-order ray envelope for inexpensive geometry filter before real rays.
    let mat = [1, 0, 0, 1],
      n = 1,
      x = 0;
    const theta = s.imageCircleMm / 2 / efl,
      pupil = efl / (2 * s.targetFNumber),
      entrance = q.p.entrancePupilXMm;
    for (const a of surfaces.slice(1, -1)) {
      if (!a.stop) {
        a.ap = a.ap_optical =
          Math.abs(mat[0]) * pupil +
          Math.abs(mat[1] - mat[0] * entrance) * theta +
          s.apertureMarginMm;
      }
      const nn = G.index(a);
      mat = O.multiply([1, 0, a.R === 0 ? 0 : -(nn - n) / a.R, 1], mat);
      mat = O.multiply([1, a.t / nn, 0, 1], mat);
      n = nn;
      x += a.t;
    }
    // Repair thickness at generated face radii, then solve first order again.
    // Uniform scaling preserves shape; repeat to respect absolute minimum thickness.
    for (let iteration = 0; iteration < 5; iteration++) {
      let start = 1;
      while (start < surfaces.length - 1) {
        let end = start;
        while (surfaces[end].glass !== "AIR") end++;
        const radius = Math.max(
          ...surfaces.slice(start, end + 1).map((a) => a.ap),
        );
        for (let j = start; j <= end; j++)
          if (!surfaces[j].stop)
            surfaces[j].ap = surfaces[j].ap_optical = radius;
        start = end + 1;
      }
      let changed = false;
      for (let j = 1; j < surfaces.length - 2; j++) {
        const a = surfaces[j],
          b = surfaces[j + 1],
          radius = Math.min(a.ap, b.ap);
        if (
          (a.R && radius >= Math.abs(a.R)) ||
          (b.R && radius >= Math.abs(b.R))
        )
          return {
            ok: false,
            code: "APERTURE_FAILURE",
            errors: ["Footprint exceeds spherical hemisphere"],
          };
        const edgeLoss = O.sag(a.R, radius) - O.sag(b.R, radius),
          minimum =
            a.glass === "AIR"
              ? Math.max(s.minAirGapMm, s.minMechanicalClearanceMm)
              : s.minEdgeMm,
          center = a.glass === "AIR" ? minimum : s.minCenterMm;
        const required = Math.max(center, minimum + edgeLoss);
        if (a.t < required) {
          a.t = required + s.targetEflMm * 0.005;
          changed = true;
        }
      }
      if (!changed) break;
      const narrow = structuredClone(lens);
      for (const a of narrow.surfaces.slice(1, -1)) a.ap = a.ap_optical = 0.001;
      const solved = P.firstOrder(narrow);
      if (!solved.ok) return solved;
      const factor = s.targetEflMm / solved.p.eflMm;
      if (!(factor > 0.2 && factor < 5))
        return {
          ok: false,
          code: "POWER_DISTRIBUTION",
          errors: ["Geometry repair could not retain positive power"],
        };
      for (const a of surfaces.slice(1, -1)) {
        a.R *= factor;
        a.t *= factor;
        a.ap *= factor;
        a.ap_optical = a.ap;
      }
      surfaces.at(-2).t = solved.p.bflMm * factor;
      if (surfaces.at(-2).t <= 0)
        return {
          ok: false,
          code: "BFL_TOO_SHORT",
          errors: ["No real rear focus after geometry repair"],
        };
      stop.ap = stop.ap_optical =
        Math.abs(s.targetEflMm * solved.p.preStop[0]) / (2 * s.targetFNumber);
    }
    for (const power of powers) {
      const i = surfaces.findIndex(
        (a) => a.element === power.element && a.glass !== "AIR",
      );
      power.frontCurvature = 1 / surfaces[i].R;
      power.rearCurvature = 1 / surfaces[i + 1].R;
      power.thinPower =
        (G.index(power.glass) - 1) *
        (power.frontCurvature - power.rearCurvature);
    }
    const hard = P.prepare(lens, s);
    if (!hard.ok) return hard;
    return { ...hard, ordinal, topology: id };
  }
  function variables(lens, s) {
    const defs = [],
      stop = lens.surfaces.findIndex((a) => a.stop);
    for (let i = 1; i < lens.surfaces.length - 1; i++) {
      const a = lens.surfaces[i];
      if (a.R) {
        const bounds = [a.R * 0.75, a.R * 1.3].sort((a, b) => a - b);
        defs.push({
          surface: i,
          key: "R",
          min: bounds[0],
          max: bounds[1],
          enabled: true,
        });
      }
      if (
        i === stop ||
        i === stop - 1 ||
        (i === lens.surfaces.length - 2 &&
          s.focusPolicy === "fixed-prescription")
      )
        continue;
      const delta =
        i === lens.surfaces.length - 2
          ? s.targetEflMm * 0.15
          : Math.max(0.3, a.t * 0.3);
      defs.push({
        surface: i,
        key: "t",
        min: Math.max(
          a.glass === "AIR"
            ? Math.max(s.minAirGapMm, s.minMechanicalClearanceMm)
            : s.minCenterMm,
          a.t - delta,
        ),
        max: a.t + delta,
        enabled: true,
      });
    }
    const delta =
      Math.min(lens.surfaces[stop - 1].t, lens.surfaces[stop].t) * 0.3;
    defs.push({
      surface: stop,
      key: "stopPosition",
      min: -delta,
      max: delta,
      enabled: true,
    });
    return defs;
  }
  const api = { generate, variables, rng };
  root.LBSynthesisSeeds = api;
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);
