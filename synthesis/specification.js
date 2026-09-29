(function (root) {
  "use strict";
  const A = root.LBAnalysis || require("../analysis/evaluate.js"),
    MA = root.LBMultiAperture || require("../analysis/multi-aperture.js"),
    F = root.LBDesignForms || require("./forms.js"),
    G = root.LBMaterials || require("../materials/catalog.js");
  function specification(raw = {}) {
    if (raw.seedGlassPolicy != null && !["first-pair-v1", "sample-pairs-v1"].includes(raw.seedGlassPolicy))
      throw Error("Unknown seed glass policy");
    const s = {
      name: "NEW_LENS",
      topology: "auto",
      targetEflMm: 50,
      eflToleranceMm: 1,
      targetFNumber: 4,
      fNumberTolerance: 0.02,
      imageCircleMm: 30,
      mount: "Custom",
      flangeFocalDistanceMm: 52,
      minBflMm: 15,
      minElements: 3,
      maxElements: 8,
      minGroups: 3,
      maxGroups: 6,
      sphericalOnly: true,
      cementedAllowed: true,
      maxOpticalLengthMm: 140,
      maxDiameterMm: 70,
      maxRearDiameterMm: 60,
      minCenterMm: 1,
      minEdgeMm: 0.5,
      minAirGapMm: 0.2,
      minMechanicalClearanceMm: 0.2,
      rearClearanceEnvelope: [],
      allowedGlasses: ["N-BK7", "N-F2"],
      maxUniqueGlasses: 2,
      objectDistance: "infinity",
      fields: [0, 0.3, 0.5, 0.7, 0.85, 1],
      wavelengths: A.DEFAULT_WAVES,
      pupilGrid: 7,
      validationGrid: 19,
      minRayFraction: 0.7,
      focusPolicy: "global-image-plane-variable",
      budget: 10000,
      workers: 2,
      seed: 1001,
      algorithm: "de",
      seedFraction: 0.18,
      localFraction: 0.18,
      denseFraction: 0.02,
      parentsPerTopology: 2,
      archiveSize: 8,
      apertureMarginMm: 0.25,
      ...structuredClone(raw),
    };
    if (
      raw.imageCircleMm == null &&
      raw.sensorWidthMm != null &&
      raw.sensorHeightMm != null
    )
      s.imageCircleMm = Math.hypot(raw.sensorWidthMm, raw.sensorHeightMm);
    s.sensorDiagonalMm =
      raw.sensorWidthMm != null && raw.sensorHeightMm != null
        ? Math.hypot(raw.sensorWidthMm, raw.sensorHeightMm)
        : null;
    s.maxFieldHeightMm = s.imageCircleMm / 2;
    for (const k of [
      "targetEflMm",
      "eflToleranceMm",
      "targetFNumber",
      "fNumberTolerance",
      "imageCircleMm",
      "maxOpticalLengthMm",
      "maxDiameterMm",
      "maxRearDiameterMm",
      "minCenterMm",
      "minEdgeMm",
      "apertureMarginMm",
    ])
      if (!Number.isFinite(s[k]) || s[k] <= 0) throw Error("Invalid " + k);
    for (const k of [
      "minBflMm",
      "flangeFocalDistanceMm",
      "minAirGapMm",
      "minMechanicalClearanceMm",
    ])
      if (!Number.isFinite(s[k]) || s[k] < 0) throw Error("Invalid " + k);
    for (const k of [
      "minElements",
      "maxElements",
      "minGroups",
      "maxGroups",
      "budget",
      "workers",
      "seed",
      "parentsPerTopology",
      "archiveSize",
      "maxUniqueGlasses",
    ])
      if (!Number.isSafeInteger(s[k]) || s[k] < (k === "seed" ? 0 : 1))
        throw Error("Invalid " + k);
    if (
      s.budget < 256 ||
      s.workers > 64 ||
      s.seed > 4294967295 ||
      s.parentsPerTopology > 8 ||
      s.archiveSize > 32 ||
      s.maxElements > 16 ||
      s.maxGroups > 16 ||
      s.minElements > s.maxElements ||
      s.minGroups > s.maxGroups
    )
      throw Error("Specification/budget bounds invalid");
    if (
      !s.sphericalOnly ||
      s.objectDistance !== "infinity" ||
      s.algorithm !== "de"
    )
      throw Error(
        "Synthesis currently supports spherical infinity designs with DE only",
      );
    if (
      !Array.isArray(s.allowedGlasses) ||
      s.allowedGlasses.length < 2 ||
      s.allowedGlasses.some((g) => G.catalog[g]?.model !== "sellmeier")
    )
      throw Error("Select at least two verified Sellmeier glasses");
    if (
      !s.allowedGlasses.some((g) => G.catalog[g].Vd > 50) ||
      !s.allowedGlasses.some((g) => G.catalog[g].Vd < 50)
    )
      throw Error(
        "Seed generation needs verified crown and flint representatives",
      );
    for (const k of ["seedFraction", "localFraction", "denseFraction"])
      if (!Number.isFinite(s[k]) || s[k] <= 0 || s[k] >= 0.5)
        throw Error("Invalid budget fraction");
    if (s.seedFraction + s.localFraction + s.denseFraction >= 0.8)
      throw Error("Reserve at least 20% for global search");
    if (
      !Array.isArray(s.rearClearanceEnvelope) ||
      s.rearClearanceEnvelope.some(
        (e) =>
          !Number.isFinite(e.distanceFromImageMm) ||
          e.distanceFromImageMm < 0 ||
          !Number.isFinite(e.maxDiameterMm) ||
          e.maxDiameterMm <= 0,
      )
    )
      throw Error("Invalid rear clearance envelope");
    s.apertures = MA.configuration({
      apertures: raw.apertures || [
        s.targetFNumber,
        Math.max(s.targetFNumber * 1.4, 5.6),
      ],
    });
    if (
      !s.apertures.some(
        (a) => a.fNumber === s.targetFNumber && a.optimization && a.validation,
      )
    )
      throw Error("Primary target aperture must be optimized and validated");
    if (s.apertures.some((a) => a.fNumber < s.targetFNumber))
      throw Error("Primary target must be the fastest configured aperture");
    if ((raw.sensorWidthMm != null) !== (raw.sensorHeightMm != null))
      throw Error("Supply both sensor dimensions or neither");
    if (
      raw.sensorWidthMm != null &&
      (!Number.isFinite(raw.sensorWidthMm) ||
        !Number.isFinite(raw.sensorHeightMm) ||
        raw.sensorWidthMm <= 0 ||
        raw.sensorHeightMm <= 0)
    )
      throw Error("Invalid sensor dimensions");
    if (
      s.sensorDiagonalMm != null &&
      s.imageCircleMm + 1e-9 < s.sensorDiagonalMm
    )
      throw Error("Image circle must cover the supplied sensor diagonal");
    if (s.eflToleranceMm >= s.targetEflMm)
      throw Error("EFL tolerance must be smaller than positive target EFL");
    if (s.maxUniqueGlasses < 2)
      throw Error("These seed forms require at least a crown and a flint");
    A.settings(s);
    F.select(s);
    return s;
  }
  const api = { specification };
  root.LBSynthesisSpec = api;
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);
