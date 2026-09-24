(function (root) {
  "use strict";
  const O = root.LBOptics || require("../optics/core.js"),
    A = root.LBAnalysis || require("./evaluate.js");
  function configuration(spec) {
    if (
      !Array.isArray(spec.apertures) ||
      !spec.apertures.length ||
      spec.apertures.length > 12
    )
      throw Error("Select 1–12 apertures");
    const out = spec.apertures
      .map((v) => (typeof v === "number" ? { fNumber: v } : v))
      .map((v) => ({ optimization: true, validation: true, weight: 1, ...v }));
    if (
      out.some(
        (v) =>
          !Number.isFinite(v.fNumber) ||
          v.fNumber <= 0 ||
          !Number.isFinite(v.weight) ||
          v.weight < 0 ||
          typeof v.optimization !== "boolean" ||
          typeof v.validation !== "boolean" ||
          (v.optimization && !v.validation),
      )
    )
      throw Error(
        "Invalid aperture; optimization apertures must also be validated",
      );
    if (
      new Set(out.map((v) => v.fNumber)).size !== out.length ||
      !out.some((v) => v.optimization && v.weight > 0)
    )
      throw Error(
        "Apertures must be distinct, with at least one optimization aperture",
      );
    return out;
  }
  function atAperture(input, fNumber, spec = {}) {
    if (!Number.isFinite(fNumber) || fNumber <= 0)
      throw Error("Invalid f-number");
    const c = O.compile(input),
      first = O.paraxial(c),
      index = c.surfaces[c.stopIndex].sourceIndex,
      baseRadius = c.surfaces[c.stopIndex].ap;
    const radius = (baseRadius * first.fNumber) / fNumber,
      maximum = spec.maxStopRadiusMm ?? baseRadius;
    if (!Number.isFinite(maximum) || maximum <= 0)
      throw Error("Invalid physical stop capacity");
    if (radius > maximum + 1e-10)
      throw Error(
        `Requested f/${fNumber} needs stop radius ${radius.toFixed(6)} mm; capacity ${maximum.toFixed(6)} mm`,
      );
    const system = {
      ...input,
      surfaces: input.surfaces.map((s) => ({ ...s })),
    };
    system.surfaces[index].ap = system.surfaces[index].ap_optical = radius;
    const v = O.validate(system, spec.constraints);
    if (v.errors.length) throw Error(v.errors.join("; "));
    return {
      system,
      stopRadiusMm: radius,
      requestedFNumber: fNumber,
      capacityMm: maximum,
    };
  }
  function evaluate(input, spec) {
    const configs = configuration(spec),
      dense = !!spec.validationRun,
      results = [];
    for (const config of configs.filter((v) =>
      dense ? v.validation : v.optimization,
    )) {
      let analysis, aperture;
      try {
        aperture = atAperture(input, config.fNumber, spec);
        analysis = A.evaluate(aperture.system, {
          ...spec,
          apertures: undefined,
        });
      } catch (e) {
        analysis = {
          valid: false,
          errors: [e.message],
          rows: [],
          fields: [],
          warnings: [],
        };
      }
      results.push({ config, ...aperture, analysis });
      // Search may safely reject on any required aperture. Final validation visits all configured apertures.
      if (!analysis.valid && !dense) break;
    }
    const first = results[0]?.analysis || { rows: [], fields: [] },
      errors = results.flatMap((r) =>
        r.analysis.errors.map((e) => `f/${r.config.fNumber}: ${e}`),
      );
    return {
      ...first,
      valid: errors.length === 0,
      errors,
      apertures: results,
      settings: spec,
      rows: results.flatMap((r) =>
        r.analysis.rows.map((row) => ({ ...row, aperture: r.config.fNumber })),
      ),
      cleanup: cleanup(results),
    };
  }
  function cleanup(results) {
    const rows = [];
    for (let i = 1; i < results.length; i++) {
      const a = results[i - 1],
        b = results[i];
      if (!a.analysis.valid || !b.analysis.valid) continue;
      for (const fa of a.analysis.fields) {
        const fb = b.analysis.fields.find((f) => f.field === fa.field);
        if (fb)
          rows.push({
            from: a.config.fNumber,
            to: b.config.fNumber,
            field: fa.field,
            metric: "rms",
            fromMm: fa.rmsMm,
            toMm: fb.rmsMm,
            changeMm: fb.rmsMm - fa.rmsMm,
            relativeChange:
              Math.abs(fa.rmsMm) > 1e-9
                ? (fb.rmsMm - fa.rmsMm) / fa.rmsMm
                : null,
            ratio: Math.abs(fb.rmsMm) > 1e-9 ? fa.rmsMm / fb.rmsMm : null,
          });
      }
    }
    return rows;
  }
  root.LBMultiAperture = { configuration, atAperture, evaluate, cleanup };
  if (typeof module !== "undefined") module.exports = root.LBMultiAperture;
})(globalThis);
