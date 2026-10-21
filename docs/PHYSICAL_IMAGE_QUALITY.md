# Physical image quality — milestone 5 / 0.7.0

LensBuilder now has a separate Tier 5 wavefront and scalar diffraction analysis area. Geometric optimization stays unchanged. It calculates optical paths, reference-sphere OPD, sampled wavefront maps, ANSI/OSA Zernike fits, pupil-derived monochromatic PSF, energy, direct sampled Strehl, complex OTF/PTF and sagittal/tangential MTF with physical axes. Every result retains its settings, physical image plane, limitations and individual status.

## Workflow

1. Open **Wavefront / PSF / MTF**. Add the current editor prescription, load the analytical f/16 validation example, or load the exact serialized M4 OMIT50.
2. Select fields, apertures, wavelengths, pupil grid and padding. The default is a fixed prescription sensor. Select explicit shared image shift if needed; it applies to all fields/wavelengths. The optional global scan is diagnostic and requires explicit adoption of its shift.
3. Analyze. The worker inverse-maps actual surviving rays, checks phase sampling, then computes diffraction only where supported. On-axis small-NA results receive a restricted badge only after a doubled-grid comparison.
4. Inspect the actual sample map, linear/log PSF, numerical energy/MTF/Zernike values and curve status. If unavailable, increase pupil sampling where feasible; do not interpret an unresolved pupil as an image-quality result.
5. Capture up to four candidate prescriptions and run one shared configuration. MTF overlays use solid tangential and dashed sagittal lines. Different prescription image-plane coordinates are warned about. An exported request includes the actual prescription and settings; importing requires recalculation and does not trust saved badges.

Search Lab and New Lens finalists can be adopted into the editor with their existing undoable action, then captured here. No FFT is added to the high-throughput search loop. Candidate comparisons are lens-relative unless their prescription image-plane coordinates are genuinely the same. Result settings remain frozen until a new analysis.

## Status matrix

| Metric | Status and scope |
|---|---|
| OPL | Validated analytical planar and independently traced spherical cases |
| Wavefront | Validated eikonal / sampled pupil; incomplete mapping or window makes the sampled result experimental |
| Zernike | Validated numerical full-disk fit; clipped fit experimental; incompatible support unavailable |
| On-axis monochromatic PSF/MTF | Validated **within scalar/paraxial assumptions**, only with full nominal coverage, NA proxy <=0.05 and per-prescription convergence |
| Off-axis PSF/MTF | Experimental even if sampled/converged; unavailable if unresolved |
| Multi-aperture / multi-field | Each configuration evaluated separately, with its own status on one common sensor per lens |
| Separate wavelengths | Supported on the same sensor; explicit weights stored; no silent refocus |
| Combined polychromatic PSF/MTF | Unavailable; registered common-grid intensity combination not validated |
| Diagnostic best global focus | Experimental discrete wavefront-RMS scan; not applied automatically |
| T-stop, coatings, illumination | Unavailable |
| MTF merit operands | Unavailable; no production search integration |

## Exact OMIT50 result

The compact fixture `benchmarks/physical-omit50.json` copies the first block-DLS winner (seed 1001) **directly** from `benchmarks/omit50-methods-v1.json`, retaining its prescription. It is not reconstructed from target focal length or spot statistics. Existing dense geometric merit is **211.6991817575039**; the prior center/edge geometric RMS is approximately 97.399/309.609 µm.

At d-line, fixed prescription image plane, piston removed, tilt retained, 64² pupil:

| f-number | Center sampled RMS, waves | Mid-field | Edge | PSF/MTF |
|---|---:|---:|---:|---|
| 2 | 9.722 | 7.968 | 35.628 | Unavailable |
| 2.8 | 8.608 | 4.656 | 15.764 | Unavailable |
| 4 | 5.222 | 2.974 | 6.594 | Unavailable |
| 5.6 | 2.916 | 1.713 | 3.051 | Unavailable at this grid |

These are sampled eikonal diagnostics, not validated complete-pupil optical-quality claims for the unresolved cases. At f/2, failed inverse mappings are also present. Increasing to 256² still leaves neighboring phase steps of **0.585 waves center /3.363 waves edge**, exceeding the 0.25-wave limit. No center, middle or edge production MTF is claimed for this f/2 design.

At f/5.6 and 256², center/edge phase steps fall to about 0.179/0.228 waves and the mapper completes. A center scalar FFT is retained in the benchmark as **EXPERIMENTAL**, not a certified lens result: nominal-disk coverage is about 99.78%, image NA exceeds the validated bound, and a further 512² pupil comparison is unavailable. Its exploratory numbers must not be used as validated OMIT50 MTF. The application explicitly communicates this limitation instead of creating plausible-looking curves from geometric RMS.

## Files and release

- [Wavefront conventions](WAVEFRONT_ENGINE.md)
- [PSF/OTF/MTF mathematics and gates](PSF_MTF_ENGINE.md)
- [Independent validation, convergence and performance](DIFFRACTION_VALIDATION.md)
- Benchmark command: `npm run benchmark:physical`.
- Geometric regression command: `npm run audit:physical`.
- Version 0.7.0 development branch: `feat/wavefront-psf-mtf-engine`, based on validated M4 `8e1ea99`.
- Publication branch remains `feat/validated-lens-optimization`, version 0.5.3 at audit. M4 PR #3 was unmerged. No automatic merge, deployment or Pages-setting change is part of this milestone.

The remaining work is explicit: establish quantitative off-axis pupil transport and sensor projection, add registered energy-conserving spectral intensity integration, extend convergence beyond 256² where useful, and only then consider expensive MTF merit operands. Nothing in this release claims parity with commercial physical-optics solvers.
