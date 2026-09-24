(function (root) {
  "use strict";
  const O = root.LBOptics || require("../optics/core.js"),
    M = root.LBMaterials || require("../materials/catalog.js");
  const D = root.LBAberrations || require("./aberrations.js");
  const DEFAULT_FIELDS = [0, 0.3, 0.5, 0.7, 0.85, 1];
  const DEFAULT_WAVES = [
    { nm: M.wavelengths.F, weight: 1 },
    { nm: M.wavelengths.d, weight: 2 },
    { nm: M.wavelengths.C, weight: 1 },
  ];
  const sampleCache = new Map();
  function pupilGrid(n = 9, pattern = "grid") {
    if (!Number.isInteger(n) || n < 3 || n > 41)
      throw new Error("Pupil grid must be an integer 3–41");
    const cacheKey = `${n}:${pattern}`;
    if (sampleCache.has(cacheKey)) return sampleCache.get(cacheKey);
    const out = [];
    if (pattern === "sunflower") {
      const groups = Math.max(1, Math.round((Math.PI * n * n) / 16));
      for (let i = 0; i < groups; i++) {
        const r = Math.sqrt((i + 0.5) / groups),
          angle = i * Math.PI * (3 - Math.sqrt(5));
        for (let k = 0; k < 4; k++) {
          const a = angle + (k * Math.PI) / 2;
          out.push({ y: r * Math.cos(a), z: r * Math.sin(a) });
        }
      }
    } else if (pattern !== "grid") throw new Error("Unknown pupil pattern");
    else
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          const y = (2 * (i + 0.5)) / n - 1,
            z = (2 * (j + 0.5)) / n - 1;
          if (y * y + z * z <= 1) out.push({ y, z });
        }
    out.forEach(Object.freeze);
    Object.freeze(out);
    sampleCache.set(cacheKey, out);
    return out;
  }
  function statistics(hits) {
    if (!hits.length) return null;
    const sw = hits.reduce((v, h) => v + (h.weight ?? 1), 0),
      y = hits.reduce((v, h) => v + h.y * (h.weight ?? 1), 0) / sw,
      z = hits.reduce((v, h) => v + h.z * (h.weight ?? 1), 0) / sw;
    let yy = 0,
      zz = 0,
      yz = 0,
      max = 0;
    for (const h of hits) {
      yy += (h.y - y) ** 2 * (h.weight ?? 1);
      zz += (h.z - z) ** 2 * (h.weight ?? 1);
      yz += (h.y - y) * (h.z - z) * (h.weight ?? 1);
      max = Math.max(max, Math.hypot(h.y - y, h.z - z));
    }
    return {
      covarianceYZmm2: yz / sw,
      majorAxisAngleRad:
        Math.hypot(yy - zz, 2 * yz) < 1e-12 * Math.max(1, yy + zz)
          ? null
          : 0.5 * Math.atan2(2 * yz, yy - zz),
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
      focusPolicy: "fixed-prescription",
      diagnostics: false,
      ...spec,
    };
    if (
      !["fixed-prescription", "global-image-plane-variable"].includes(
        s.focusPolicy,
      )
    )
      throw new Error(
        "Unsupported focus policy; field best focus is diagnostic only",
      );
    if (
      s.validationGrid !== undefined &&
      (!Number.isInteger(s.validationGrid) ||
        s.validationGrid < 19 ||
        s.validationGrid > 41)
    )
      throw new Error("Validation grid must be 19–41");
    for (const k of ["targetEflMm", "imageCircleMm"])
      if (!(s[k] > 0 && Number.isFinite(s[k]))) throw new Error(`Invalid ${k}`);
    if (
      !Array.isArray(s.fields) ||
      s.fields.length < 2 ||
      s.fields.length > 32 ||
      !s.fields.includes(0) ||
      !s.fields.includes(1) ||
      s.fields.some((f) => !Number.isFinite(f) || f < 0 || f > 1)
    )
      throw new Error("Fields must include 0 and 1, within [0,1], at most 32");
    if (
      !Array.isArray(s.wavelengths) ||
      s.wavelengths.length < 1 ||
      s.wavelengths.length > 12 ||
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
    pupilGrid(s.pupilGrid, s.pupilPattern);
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
    const compilation = new Map();
    const compile = (nm) => {
      if (!compilation.has(nm))
        compilation.set(nm, O.compileValidated(validation, nm));
      return compilation.get(nm);
    };
    try {
      compiled = s.wavelengths.map((w) => compile(w.nm));
      reference = compile(M.wavelengths.d);
      first = O.paraxial(reference);
    } catch (e) {
      return invalid([e.message]);
    }
    if (!(first.eflMm > 0 && first.bflMm > 0))
      return invalid(["Positive EFL and BFL required"]);
    if (first.bflMm < (s.constraints?.minBflMm ?? 0))
      return invalid(["BFL minimum violated"]);
    const samples = pupilGrid(s.pupilGrid, s.pupilPattern),
      paraxials = compiled.map(O.paraxial),
      rows = [],
      fields = [],
      errors = [];
    for (const f of s.fields) {
      // Field angle is frozen by the SPECIFICATION, never changed to flatter a candidate.
      const angle = Math.atan((f * s.imageCircleMm) / 2 / s.targetEflMm),
        all = [],
        centroids = [],
        chiefColors = [];
      let minFraction = 1;
      const chiefRef = O.aimChief(reference, angle),
        refHit = chiefRef ? O.trace(reference, chiefRef) : null;
      if (!refHit?.ok) errors.push(`Field ${f}: reference chief ray failed`);
      for (let wi = 0; wi < compiled.length; wi++) {
        const c = compiled[wi],
          wave = s.wavelengths[wi],
          p = paraxials[wi],
          chief = O.aimChief(c, angle),
          hits = [],
          failures = {},
          pupil = [];
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
          if (s.diagnostics)
            pupil.push({
              y: q.y,
              z: q.z,
              ok: tr.ok,
              reason: tr.reason || null,
            });
          if (!tr.ok) {
            failures[tr.reason] = (failures[tr.reason] || 0) + 1;
            continue;
          }
          hits.push({
            y: tr.hit.y,
            z: tr.hit.z,
            pupilY: q.y,
            pupilZ: q.z,
            ...(s.diagnostics
              ? { slopeY: tr.d.y / tr.d.x, slopeZ: tr.d.z / tr.d.x }
              : {}),
          });
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
        if (chiefTrace.ok) {
          centroids.push(chiefTrace.hit.y);
          chiefColors.push({
            nm: wave.nm,
            displacementMm: refHit?.ok ? chiefTrace.hit.y - refHit.hit.y : null,
          });
        }
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
          ...(s.diagnostics
            ? {
                pupil,
                focus: D.focus(hits),
                fans: D.fans(c, angle, refHit?.ok ? refHit.hit : null),
                paraxialFocusXMm: c.surfaces.at(-1).vx + O.paraxial(c).bflMm,
              }
            : {}),
        });
        // Fixed launch weights: clipping loses energy, it cannot reweight each surviving color equally.
        all.push(
          ...hits.map((h) => ({ ...h, weight: wave.weight / samples.length })),
        );
      }
      const ideal = first.eflMm * Math.tan(angle),
        chiefHeight = refHit?.ok ? refHit.hit.y : null,
        referencePlaneX = reference.surfaces.at(-1).vx + first.bflMm,
        referenceHeight = refHit?.ok
          ? refHit.p.y +
            ((referencePlaneX - refHit.p.x) * refHit.d.y) / refHit.d.x
          : null;
      fields.push({
        field: f,
        angleDeg: (angle * 180) / Math.PI,
        idealHeightMm: ideal,
        chiefHeightMm: chiefHeight,
        referenceChiefHeightMm: referenceHeight,
        distortionReferenceXMm: referencePlaneX,
        fixedPlaneMappingPercent:
          f === 0
            ? 0
            : chiefHeight === null
              ? null
              : (100 * (chiefHeight - ideal)) / ideal,
        chiefColorDisplacements: chiefColors,
        realRayFocusColorMm: (() => {
          if (!s.diagnostics) return null;
          const blue = rows.find(
              (r) => r.field === f && r.nm === M.wavelengths.F,
            )?.focus?.bestRmsShiftMm,
            red = rows.find((r) => r.field === f && r.nm === M.wavelengths.C)
              ?.focus?.bestRmsShiftMm;
          return Number.isFinite(blue) && Number.isFinite(red)
            ? blue - red
            : null;
        })(),
        ...(s.diagnostics ? { diagnosticFocus: D.focus(all) } : {}),
        distortionPercent:
          f === 0
            ? 0
            : referenceHeight == null
              ? null
              : (100 * (referenceHeight - ideal)) / ideal,
        lateralChiefColorMm:
          centroids.length === compiled.length
            ? Math.max(...centroids) - Math.min(...centroids)
            : null,
        rayFraction: minFraction,
        ...statistics(all),
      });
    }
    if (s.diagnostics) {
      const axis = fields.find((f) => f.field === 0)?.diagnosticFocus
        ?.bestRmsShiftMm;
      for (const f of fields)
        if (f.diagnosticFocus)
          f.diagnosticFocus.fieldCurvatureRelativeToAxisMm =
            Number.isFinite(axis) &&
            Number.isFinite(f.diagnosticFocus.bestRmsShiftMm)
              ? f.diagnosticFocus.bestRmsShiftMm - axis
              : null;
    }
    const blue = O.paraxial(compile(M.wavelengths.F)),
      red = O.paraxial(compile(M.wavelengths.C));
    return {
      valid: !errors.length,
      errors,
      warnings: validation.warnings,
      firstOrder: first,
      rows,
      fields,
      longitudinalColorMm: blue.bflMm - red.bflMm,
      metricStatus: D.STATUS,
      imagePlaneXMm: reference.imageX,
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
