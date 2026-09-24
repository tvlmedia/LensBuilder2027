# Validation record — first local-optimization increment

Validated on 2026-09-24 with Node v24.16.0 and the Codex in-app Chromium browser, serving the actual application at localhost:8080. 30 automated tests pass (`npm test`). All JavaScript parses (`npm run check`); `git diff --check` passes. There is no TypeScript or build pipeline. Syntax checking is not represented as full static linting.

## Numerical references

| Behavior | Independent reference/check |
| --- | --- |
| Plane refraction | Scalar Snell law at oblique incidence |
| TIR | Above-critical-angle rejection |
| Reciprocity | Reverse refracted ray returns antiparallel to incident ray |
| Positive/negative spheres | Analytic vertex sag; forward and reverse hemisphere selection |
| Near-planar sphere | R=10^9 mm, 1 mm ray height, expected sag 5×10^-10 mm |
| Glass dispersion | SCHOTT N-BK7HT/N-F2 C/d/F tabulated indices within 6×10^-6 |
| EFL/BFL | Independent thick-lens lensmaker formula |
| Matrix determinant | Unity in reduced-angle coordinates |
| Near-axis real rays | Intersection with analytic paraxial focal plane within 10^-5 mm |
| Chief rays | Solved stop-center residual <10^-7 mm, finite/infinite launch conjugates |
| Spot RMS | Translation invariance; low-NA monochromatic spot approaches zero at analytic focus |
| Distortion | Low-NA/low-field limit approaches zero at analytic focal plane |
| Chromatic analysis | Independent thick-lens BFL difference and image-height matrix coefficients |
| Invalid candidates | Thickness, collision, unsupported model/material, aperture loss and BFL constraints |
| Optimization | Bounded real-ray merit improvement for image gap and separately multiple radii/air gaps |
| Determinism | Identical full analysis and exact checkpoint replay after serialization |
| Worker lifecycle | Actual worker script: analysis, start, pause, restore, resume, denser validation |
| Import | Actual extracted parser: units, stop, custom material, wavelengths, configuration metadata; rejects unsupported/missing data |
| History | Derived vertex caches ignored; undo/redo and branch invalidation |

These are analytical/unit/regression validations. No full external Zemax/Code V comparison dataset has been supplied or validated. High-NA real-pupil radiometry, complete coverage and manufacturing quality are not established.

## Reproducible benchmark

`npm run benchmark` uses the unchanged `bijna-goed.json`, six fields, F/d/C, 9×9 launch grid, target EFL 58.01287 mm and f/1.4614346, reference circle 43.27 mm. Only surface 13 image gap varies in [21.05230899,63.15692698] mm. Independent acceptance grid is 19×19.

| Quantity | Result |
| --- | ---: |
| Mean new analysis, 25 warmed calls | ~3.84 ms |
| Evaluations to convergence | 45 |
| Search plus denser validation | ~186 ms |
| Image gap before / after | 42.10462 / 32.45607 mm |
| Dense-grid merit before / after | 27548.61674 / 1252.72256 |
| Dense-grid central RMS before / after | 2.61017 / 0.51998 mm |

Timings are machine-specific Node measurements, not browser guarantees or a speedup over the old renderer. Improvement mainly corrects image-plane placement in an unfocused starting prescription. The final RMS remains very large; this is **not** evidence of a production-quality cine lens. Distortion/color tradeoffs remain visible. A separate 200-evaluation test changes two radii and two spacings, improves the denser-grid objective and respects every variable bound/lock.

## Actual browser smoke checks

- Application starts, restores the supplied prescription and draws lens/rays and chart preview.
- Existing EFL/BFL remain finite; f-number is labelled geometrically and T-stop is unavailable.
- Analyze produces wavelength/field spots and metric/operand tables.
- Auto Optimize runs in a worker and shows denser-grid before/after results.
- Adoption updates the original editor; one Undo restores the previous image gap, Redo restores the result.
- A manual radius edit is undone correctly.
- Completed autosave restores; Stop & validate reconstructs results for export.
- Valid spherical Zemax paste loads four expected rows; Undo restores the prior 15-row prescription.
- MIRROR import visibly reports FAILED and preserves the current prescription.
- No browser console errors during the final import/undo smoke check.

## Remaining quality boundaries

Paraxial entrance-pupil disk sampling, approximate legacy materials, finite-conjugate preview heuristics and geometric preview brightness remain explicitly limited. No manufactured-lens accuracy, full Zemax compatibility, diffraction/MTF, autonomous design, optical character scoring or tolerance yield is claimed. The next technical gate is independent real-pupil and multi-field comparison against trusted reference exports before expanding autonomous design.

## Numerical Search Lab follow-up

The subsequent DE/worker-pool milestone has its own [benchmark and validation record](SEARCH_BENCHMARK.md) and [scope](SEARCH_LAB.md). It includes mathematical-function optimization and worker-count-invariant replay tests. The historical local-optimizer benchmark above remains unchanged.
