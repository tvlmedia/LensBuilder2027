(function (root) {
  "use strict";
  const O = root.LBOptics || require("../optics/core.js");
  const STATUS = {
    spherical: {
      method: "GEOMETRIC zonal axial intercept",
      validation:
        "VALIDATED symmetry and paraxial limit; external reference pending",
    },
    lateralColor: {
      method: "GEOMETRIC signed chief offsets at fixed sensor, d reference",
      validation: "VALIDATED on-axis symmetry; external reference pending",
    },
    fNumber: {
      method: "PARAXIAL entrance-pupil diameter",
      validation: "VALIDATED matrix/iris invariants; not transmission",
    },
    distortion: {
      method: "GEOMETRIC chief ray at d-line paraxial focus",
      validation: "VALIDATED analytic/invariance tests",
    },
    longitudinalColor: {
      method: "PARAXIAL F-C BFL",
      validation: "VALIDATED analytic tests",
    },
    fans: {
      method: "GEOMETRIC chief-referenced transverse rays",
      validation: "VALIDATED symmetry tests",
    },
    focus: {
      method: "GEOMETRIC least-variance outgoing ray planes",
      validation:
        "EXPERIMENTAL optical interpretation; analytic minimum tested",
    },
    pupil: {
      method: "GEOMETRIC paraxial-pupil sampling",
      validation: "APPROXIMATE; not illumination",
    },
    coma: { method: "UNAVAILABLE" },
    psf: { method: "UNAVAILABLE" },
    mtf: { method: "UNAVAILABLE" },
    tStop: { method: "UNAVAILABLE" },
  };
  function focus(hits) {
    if (hits.length < 4) return null;
    let sw = 0,
      y = 0,
      z = 0,
      sy = 0,
      sz = 0;
    for (const h of hits) {
      const w = h.weight ?? 1;
      sw += w;
      y += w * h.y;
      z += w * h.z;
      sy += w * h.slopeY;
      sz += w * h.slopeZ;
    }
    y /= sw;
    z /= sw;
    sy /= sw;
    sz /= sw;
    let cy = 0,
      cz = 0,
      vy = 0,
      vz = 0;
    for (const h of hits) {
      const w = h.weight ?? 1;
      cy += w * (h.y - y) * (h.slopeY - sy);
      cz += w * (h.z - z) * (h.slopeZ - sz);
      vy += w * (h.slopeY - sy) ** 2;
      vz += w * (h.slopeZ - sz) ** 2;
    }
    const tangent = vy / sw > 1e-18 ? -cy / vy : null,
      sagittal = vz / sw > 1e-18 ? -cz / vz : null;
    return {
      tangentialShiftMm: tangent,
      sagittalShiftMm: sagittal,
      bestRmsShiftMm: (vy + vz) / sw > 1e-18 ? -(cy + cz) / (vy + vz) : null,
      astigmaticDifferenceMm:
        tangent !== null && sagittal !== null ? tangent - sagittal : null,
    };
  }
  function fans(c, angle, referenceHit, count = 21) {
    const chief = O.aimChief(c, angle),
      p = O.paraxial(c),
      out = [];
    if (!chief) return out;
    for (const axis of ["tangential", "sagittal"])
      for (let i = 0; i < count; i++) {
        const q = (2 * i) / (count - 1) - 1,
          ray = {
            p: {
              ...chief.p,
              y:
                chief.p.y +
                (axis === "tangential" ? q * p.entrancePupilRadiusMm : 0),
              z: axis === "sagittal" ? q * p.entrancePupilRadiusMm : 0,
            },
            d: chief.d,
          },
          r = O.trace(c, ray);
        out.push({
          axis,
          pupil: q,
          ok: r.ok,
          reason: r.reason || null,
          transverseMm:
            r.ok && referenceHit
              ? axis === "tangential"
                ? r.hit.y - referenceHit.y
                : r.hit.z - referenceHit.z
              : null,
          longitudinalFocusXMm:
            axis === "tangential" &&
            angle === 0 &&
            Math.abs(q) > 1e-6 &&
            r.ok &&
            Math.abs(r.d.y / r.d.x) > 1e-12
              ? r.p.x - r.p.y / (r.d.y / r.d.x)
              : null,
        });
      }
    return out;
  }
  root.LBAberrations = { STATUS, focus, fans };
  if (typeof module !== "undefined") module.exports = root.LBAberrations;
})(globalThis);
