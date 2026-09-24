# Zemax import compatibility

The original importer is incrementally extracted into `import/zemax.js`; supported curvature, spacing, semi-diameter, glass, stop, wavelengths, angular fields and thickness-configuration metadata remain. `import/report.js` scans keywords first. The interface displays counts and locations for SUPPORTED / PARTIALLY SUPPORTED / IGNORED / FAILED.

Mirrors, nonstandard surfaces, nonzero conics, polynomial parameters, unknown keywords, unsupported field types and finite object conjugates are blocked. No mirror is converted to air. Missing custom material dispersion is not fabricated. Unknown glass fails loading before replacing the current prescription. A legacy alias requires an explicit catalog selection or complete user material data.

Partial configuration mapping remains available to the original editor but marks the system unsuitable for optimization. Configuration optimization is independently blocked. Known non-optical settings can be reported ignored; unsupported optical settings are conservatively rejected. This whitelist deliberately rejects many real-world Zemax files. Full Zemax compatibility is **not** claimed. Unsupported source text remains available to the caller; rejected files never replace the active lens.

Imported scalar values still pass through the historical editor's aperture normalization. The optimization evaluator uses the resulting current prescription and revalidates it. It must not be interpreted as exact reproduction of every imported original system.
