/* Sequential spherical prescription export. Distances and apertures are in mm. */
(function (root) {
  "use strict";
  const optics = root.LBOptics || require("../optics/core.js");
  const materials = root.LBMaterials || require("../materials/catalog.js");

  function wavelengthRows(lens, activeNm) {
    const specified = lens.presetProvenance?.specification?.wavelengths;
    if (specified?.length) return specified;
    const imported = lens.zemax?.wavelengthsNm;
    if (!imported?.length) return [{nm: activeNm, weight: 1}];
    const weights = new Map();
    for (const match of (lens.originalZmxText || "").matchAll(/^\s*WAVM\s+(\d+)\s+(\S+)\s+(\S+)/gim))
      weights.set(Number(match[1]), Number(match[3]));
    return imported.map((nm, index) => {
      if (imported.length > 1 && !weights.has(index + 1))
        throw new Error("Original wavelength weights unavailable. Load the original ZMX file.");
      return {nm, weight: weights.get(index + 1) ?? 1};
    });
  }

  function serialize(lens, {objectDistance, lensShift = 0, sensorShift = 0, activeNm}) {
    if (!(objectDistance > 0) || !Number.isFinite(lensShift + sensorShift))
      throw new Error("Invalid object distance or focus shift.");
    optics.compile(lens, activeNm);
    const waves = wavelengthRows(lens, activeNm);
    let primary = waves.findIndex(w => Math.abs(w.nm - activeNm) < 1e-8);
    if (primary < 0) throw new Error("Active wavelength is outside the stored spectrum. Select a stored wavelength.");
    const lines = ["MODE SEQ", "NAME " + lens.name.replace(/[\r\n]/g, " "), "UNIT MM"];
    const catalogs = new Set();
    const surfaces = [];
    for (const [index, s] of lens.surfaces.entries()) {
      const aperture = s.ap_optical ?? s.ap;
      if (!Number.isFinite(aperture) || aperture <= 0 || !Number.isFinite(s.R))
        throw new Error("Invalid optical geometry at surface " + index);
      let distance = s.t;
      if (!index) distance = objectDistance + lensShift;
      if (index === lens.surfaces.length - 2) distance += sensorShift - lensShift;
      if (!(distance >= 0) || (!Number.isFinite(distance) && index !== 0))
        throw new Error("Invalid spacing at surface " + index);
      surfaces.push("SURF " + index, "  TYPE STANDARD", "  CURV " + (s.R ? 1/s.R : 0),
        "  DISZ " + (distance === Infinity ? "INFINITY" : distance), "  DIAM " + aperture);
      if (s.stop) surfaces.push("  STOP");
      if (s.glass?.toUpperCase() !== "AIR") {
        const glass = materials.material(s);
        if (glass.model === "nd-vd-approximate" && glass.nd > 1 && glass.Vd > 0) {
          surfaces.push("  COMM " + glass.name.replace(/[\r\n]/g, " ") + " (Lens Builder nd/Vd model)",
            "  GLAS ___BLANK 0 0 " + glass.nd + " " + glass.Vd);
          continue;
        }
        if (glass.model !== "sellmeier")
          throw new Error("No verified catalog dispersion for " + glass.name + " at surface " + index);
        catalogs.add(glass.manufacturer);
        surfaces.push("  GLAS " + glass.name);
      }
    }
    if (catalogs.size) lines.push("GCAT " + [...catalogs].join(" "));
    waves.forEach(({nm, weight}, i) => {
      if (!(nm > 0 && Number.isFinite(nm) && weight >= 0 && Number.isFinite(weight)))
        throw new Error("Invalid wavelength or weight.");
      lines.push("WAVM " + [i+1, nm/1000, weight].join(" "));
    });
    lines.push("PWAV " + (primary + 1));
    const fields = lens.zemax?.fields;
    if (fields?.length) lines.push("FTYP 0", "YFLN " + fields.map(f => f.angleDeg).join(" "),
      "FWGN " + fields.map(f => f.weight).join(" "));
    return [...lines, ...surfaces, ""].join("\r\n");
  }
  root.LBZmxExport = {serialize};
  if (typeof module !== "undefined") module.exports = root.LBZmxExport;
})(globalThis);
