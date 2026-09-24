(function (root) {
  "use strict";
  const O = root.LBOptics || require("../optics/core.js"),
    M = root.LBMaterials || require("../materials/catalog.js");
  const DEFAULT_FIELDS = [0, 0.3, 0.5, 0.7, 0.85, 1];
  const DEFAULT_WAVES = [
    { nm: M.wavelengths.F, weight: 1 },
    { nm: M.wavelengths.d, weight: 2 },
    { nm: M.wavelengths.C, weight: 1 },
  ];
  function pupilGrid(n = 9) {
    if (!Number.isInteger(n) || n < 3 || n > 41)
      throw new Error("Pupil grid must be an integer 3–41");
    const out = [];
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const y = (2 * (i + 0.5)) / n - 1,
          z = (2 * (j + 0.5)) / n - 1;
        if (y * y + z * z <= 1) out.push({ y, z });
      }
    return out;
  }
  function statistics(hits) {
    if (!hits.length) return null;
    const sw = hits.reduce((v, h) => v + (h.weight ?? 1), 0),
      y = hits.reduce((v, h) => v + h.y * (h.weight ?? 1), 0) / sw,
      z = hits.reduce((v, h) => v + h.z * (h.weight ?? 1), 0) / sw;
    let yy = 0,
      zz = 0,
      max = 0;
    for (const h of hits) {
      yy += (h.y - y) ** 2 * (h.weight ?? 1);
      zz += (h.z - z) ** 2 * (h.weight ?? 1);
      max = Math.max(max, Math.hypot(h.y - y, h.z - z));
    }
    return {
      centroidYmm: y,
      centroidZmm: z,
      rmsMm: Math.sqrt((yy + zz) / sw),
      tangentialRmsMm: Math.sqrt(yy / sw),
      sagittalRmsMm: Math.sqrt(zz / sw),
      maxRadiusMm: max,
    };
  }
  function settings(spec = {}) {
    const s = {
      targetEflMm: 50,
      imageCircleMm: 43.27,
      fields: DEFAULT_FIELDS,
      wavelengths: DEFAULT_WAVES,
      pupilGrid: 9,
      minRayFraction: 0.5,
      allowApproximateMaterials: false,
      ...spec,
    };
    for (const k of ["targetEflMm", "imageCircleMm"])
      if (!(s[k] > 0 && Number.isFinite(s[k]))) throw new Error(`Invalid ${k}`);
    if (
      !Array.isArray(s.fields) ||
      s.fields.length < 2 ||
      s.fields.length > 16 ||
      !s.fields.includes(0) ||
      !s.fields.includes(1) ||
      s.fields.some((f) => !Number.isFinite(f) || f < 0 || f > 1)
    )
      throw new Error("Fields must include 0 and 1, within [0,1], at most 16");
    if (
      !Array.isArray(s.wavelengths) ||
      s.wavelengths.length < 1 ||
      s.wavelengths.length > 9 ||
      s.wavelengths.some(
        (w) =>
          !(
            w.nm >= 400 &&
            w.nm <= 700 &&
            w.weight > 0 &&
            Number.isFinite(w.weight)
          ),
      )
    )
      throw new Error("Invalid weighted visible wavelengths");
    if (
      !Number.isFinite(s.minRayFraction) ||
      s.minRayFraction <= 0 ||
      s.minRayFraction > 1
    )
      throw new Error("Invalid minimum ray fraction");
    pupilGrid(s.pupilGrid);
    return s;
  }
  function evaluateInternal(system, spec = {}) {
    const s = settings(spec),
      validation = O.validate(system, s.constraints);
    const invalid = (errors) => ({
      valid: false,
      errors,
      warnings: validation.warnings,
      rows: [],
      fields: [],
    });
    if (validation.errors.length) return invalid(validation.errors);
    if (validation.warnings.length && !s.allowApproximateMaterials)
      return invalid([
        "Approximate material dispersion requires explicit opt-in",
        ...validation.warnings,
      ]);
    let compiled, reference, first;
    try {
      compiled = s.wavelengths.map((w) =>
        O.compile(system, w.nm, s.constraints),
      );
      reference = O.compile(system, M.wavelengths.d, s.constraints);
      first = O.paraxial(reference);
    } catch (e) {
      return invalid([e.message]);
    }
    if (!(first.eflMm > 0 && first.bflMm > 0))
      return invalid(["Positive EFL and BFL required"]);
    if (first.bflMm < (s.constraints?.minBflMm ?? 0))
      return invalid(["BFL minimum violated"]);
    const samples = pupilGrid(s.pupilGrid),
      rows = [],
      fields = [],
      errors = [];
    for (const f of s.fields) {
      // Field angle is frozen by the SPECIFICATION, never changed to flatter a candidate.
      const angle = Math.atan((f * s.imageCircleMm) / 2 / s.targetEflMm),
        all = [],
        centroids = [];
      let minFraction = 1;
      const chiefRef = O.aimChief(reference, angle),
        refHit = chiefRef ? O.trace(reference, chiefRef) : null;
      if (!refHit?.ok) errors.push(`Field ${f}: reference chief ray failed`);
      for (let wi = 0; wi < compiled.length; wi++) {
        const c = compiled[wi],
          wave = s.wavelengths[wi],
          p = O.paraxial(c),
          chief = O.aimChief(c, angle),
          hits = [],
          failures = {};
        if (!chief) {
          errors.push(`Field ${f}, ${wave.nm} nm: chief aiming failed`);
          continue;
        }
        for (const q of samples) {
          const r = {
            p: {
              x: chief.p.x,
              y: chief.p.y + q.y * p.entrancePupilRadiusMm,
              z: q.z * p.entrancePupilRadiusMm,
            },
            d: chief.d,
          };
          const tr = O.trace(c, r);
          if (!tr.ok) {
            failures[tr.reason] = (failures[tr.reason] || 0) + 1;
            continue;
          }
          hits.push({ y: tr.hit.y, z: tr.hit.z, pupilY: q.y, pupilZ: q.z });
        }
        const fraction = hits.length / samples.length;
        minFraction = Math.min(minFraction, fraction);
        if (hits.length < 4 || fraction < s.minRayFraction)
          errors.push(
            `Field ${f}, ${wave.nm} nm: insufficient rays (${hits.length}/${samples.length})`,
          );
        const stat = statistics(hits),
          chiefTrace = O.trace(c, chief);
        if (!chiefTrace.ok)
          errors.push(`Field ${f}, ${wave.nm} nm: chief clipped`);
        if (chiefTrace.ok) centroids.push(chiefTrace.hit.y);
        rows.push({
          field: f,
          nm: wave.nm,
          weight: wave.weight,
          rayFraction: fraction,
          launched: samples.length,
          accepted: hits.length,
          failures,
          ...stat,
          hits,
        });
        // Fixed launch weights: clipping loses energy, it cannot reweight each surviving color equally.
        all.push(
          ...hits.map((h) => ({ ...h, weight: wave.weight / samples.length })),
        );
      }
      const ideal = first.eflMm * Math.tan(angle),
        chiefHeight = refHit?.ok ? refHit.hit.y : null;
      fields.push({
        field: f,
        angleDeg: (angle * 180) / Math.PI,
        idealHeightMm: ideal,
        chiefHeightMm: chiefHeight,
        distortionPercent:
          f === 0
            ? 0
            : chiefHeight == null
              ? null
              : (100 * (chiefHeight - ideal)) / ideal,
        lateralChiefColorMm:
          centroids.length === compiled.length
            ? Math.max(...centroids) - Math.min(...centroids)
            : null,
        rayFraction: minFraction,
        ...statistics(all),
      });
    }
    const blue = O.paraxial(O.compile(system, M.wavelengths.F)),
      red = O.paraxial(O.compile(system, M.wavelengths.C));
    return {
      valid: !errors.length,
      errors,
      warnings: validation.warnings,
      firstOrder: first,
      rows,
      fields,
      longitudinalColorMm: blue.bflMm - red.bflMm,
      settings: s,
      limitations: [
        "Geometric ray analysis; PSF/MTF and transmission unavailable",
        "Uniform sampling of paraxial entrance-pupil disk, centered on numerically aimed chief; ray fraction is sampled pupil survival, not calibrated illumination or guaranteed image circle",
        "Infinity conjugate only; fixed prescription image plane; no automatic refocus",
        "RMS is centroid-referenced; polychromatic RMS includes centroid color separation",
      ],
    };
  }
  function evaluate(system, spec = {}) {
    settings(spec);
    try {
      return evaluateInternal(system, spec);
    } catch (e) {
      return {
        valid: false,
        errors: [`Numerical evaluation failed: ${e.message}`],
        warnings: [],
        rows: [],
        fields: [],
      };
    }
  }
  const api = {
    DEFAULT_FIELDS,
    DEFAULT_WAVES,
    pupilGrid,
    statistics,
    settings,
    evaluate,
  };
  root.LBAnalysis = api;
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);
