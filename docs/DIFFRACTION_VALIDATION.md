# Validation and convergence — 0.7.0

## 0.8.0 update

0.8.0 adds independent spectral-shift/overlap and sensor-transform tests, high-resolution checks, stronger convergence and cancellation tests. See [Milestone 6 results](MILESTONE6_REPORT.md). Historical results below describe 0.7; current eligibility requires the stronger checks.

## Historical 0.7 implementation

## Evidence and reproducibility

Run `npm test`, `npm run check`, `npm run benchmark:physical`, and `npm run audit:physical`. Benchmarks are in `benchmarks/physical-quality-v1.json`; the before/after geometric audit is in `benchmarks/physical-baseline-audit.json`. This milestone started from commit `8e1ea99cbd4275b381e95b89ef1ada2b3996a67e`, not published 0.5.3. PR #3 was open/unmerged at audit. All 111 pre-existing tests passed before changes; all 189 archived optimization prescriptions reproduced their stored merit with maximum absolute difference **0**, both before and after optional OPL accumulation.

The physical tests use analytical or independently implemented references, not snapshots of the production equations alone:

| Quantity | Independent evidence | Acceptance tolerance |
|---|---|---|
| OPL | Homogeneous air; oblique planar Snell; plate; multiple/cemented media; dispersive F/d/C; reverse propagation; identical-index subdivision | 1e-10 mm planar |
| Real-lens OPL | Existing test-only Newton sag intersections and angular Snell tracer; independently sum distances | 1e-9 mm |
| Reference sphere | Ideal converging spherical eikonal is constant on reference sphere | 1e-12 mm |
| Exit pupil | Independent infinitesimal-angle ray conjugate | 1e-9 mm |
| OPD | Independent meridional Newton/angular-Snell path + sphere, on/off axis | 2e-10 mm |
| Inverse pupil map | Reproject actual traced launch solutions; clip actual surfaces | <1e-8 mm |
| Low-NA defocus | Real singlet image shift compared with quadratic paraxial OPD | <2% magnitude difference |
| Complex FFT | Independent direct DFT and inverse round trip | 1e-12 / 1e-13 |
| Airy radial intensity | Independent Bessel J1 series; `(2 J1(x)/x)^2` | 0.003 normalized intensity |
| First Airy minimum | `r=1.219669891 lambda N` | one padded image pixel |
| Energy within first Airy minimum | `1-J0²-J1²`, value 0.837785 | 0.004 absolute |
| Normalization / Parseval | Unit total energy and `sum |FFT(P)|² = M² clearCells` | 1e-12 |
| Circular MTF | Analytical disk autocorrelation, DC=1, cutoff, monotonicity, axis symmetry | 0.004 absolute; DC 1e-14 |
| Defocus Strehl | Exact uniform-disk integral `[sin(pi PV)/(pi PV)]²`, PV=0.3 waves | 0.002 |
| Known Zernikes | Independently specified defocus/coma/spherical coefficients, ANSI normalization | 1e-13 waves |
| Orientation / registration | Elliptical aperture has different directional cutoff; linear phase translates image and gives nonzero OTF phase | 1e-12 numerical identities |
| Spectral scaling | Same dimensionless pupil gives image pitch proportional to wavelength, cutoff inverse | 1e-14 |
| Worker / persistence | Actual browser-worker script in isolated VM; request round trip; version rejection | Exact PSF array equality |

`tests/reference/independent.cjs` has no production imports. The DFT and Bessel series are not the production FFT implementation. Neither a fitted RMS blur nor a cached ideal Airy result supplies real-lens image quality.

## Mathematical convergence

For a 550 nm clear circular pupil, image f/10, extent ±1.25 pupil radii, padding 4:

| Pupil grid | MTF at 0.4 cutoff | Absolute error vs 0.5046315755 | First-Airy energy |
|---|---:|---:|---:|
| 32² | 0.5080916031 | 0.0034600276 | 0.8377792564 |
| 64² | 0.5048249027 | 0.0001933273 | 0.8377512613 |
| 128² | 0.5045914397 | 0.0000401358 | 0.8378143130 |

The report includes padding 2/4/8 for clear, 0.3-wave PV defocus and 0.1-wave RMS coma pupils. Padding halves image pitch when doubled; it does not replace finer pupil integration. The test also compares circular analytic MTF across the entire directional frequency axis, not just this table's point. Rasterized aperture convergence need not be monotonic at every frequency.

For the analytical thick singlet at f/16 and d-line, 64² →128² changes wavefront RMS by **0.00000811 waves**, MTF(20/40/80) by at most **0.000484**, Strehl by **0.00000623**, and first-Airy energy by **0.0000640**. The Double Gauss f/16 comparison changes those MTF values by at most **0.001444**. These support the restricted scalar/paraxial badge; they do not certify real-world glass, coatings, manufacturing tolerances or off-axis diffraction.

## Performance

The recorded single-machine Node run (darwin arm64; exact runtime in JSON) measured the same fixed 100,000-ray Double Gauss workload after 5,000 warm-up rays: roughly **478k rays/s without OPL**, **438k rays/s with OPL**. This is optional-path overhead within one implementation, not a historical engine speed comparison.

At 64² pupil /256² FFT, singlet wavefront sampling took about **17 ms**, PSF **2 ms**, and OTF/MTF **3 ms**. Full singlet analysis including Zernike and doubled-grid validation took about **133 ms**; Double Gauss f/16 about **411 ms**. The 12 OMIT50 field/aperture combinations took about **1.12 s**, predominantly ray mapping because unresolved cases correctly skip FFT. A separate 256² pupil /1024² FFT stopped-down OMIT run took about **1.34 s**. Timings are illustrative, machine/load dependent, and are not geometric merit evaluations/sec.

Approximate live numerical FFT buffers are 3 MiB at 256² and 48 MiB at 1024², excluding JS objects, saved results and worker-transfer copies. Process memory is recorded in the JSON. A conservative 192 MiB retained-result estimate limits batches and candidate comparisons. Jobs run outside the UI thread and can be cancelled by terminating the worker.

## Scope not validated

Polychromatic image registration/integration, vector/high-NA diffraction, off-axis projection onto an oblique flat sensor, radiometric pupil transport, quantitative coatings/transmission, finite conjugates and MTF-based optimization remain outside the validated scope. A passed finite-grid comparison is a numerical check, not proof of accuracy for an arbitrary lens.

## Final release checks

The final automated suite contains **138 passing tests** (111 existing plus 27 new); JavaScript syntax checks and whitespace checks pass. Browser smoke checks exercised the actual worker through the dedicated panel at both `/` and `/LensBuilder2027/`, a converged f/16 singlet result, candidate comparison, and existing workflows. New Lens completed a 256-unit smoke run with eight densely validated candidates (best dense merit 79.7410); its finalist transfer to Search Lab worked. The final Search Lab smoke run completed 64/64 valid evaluations with no captured browser errors. The Pages-prefixed static/worker/fixture path test is also automated.

The build fingerprint includes every physical-engine module. Pages was verified to publish only `feat/validated-lens-optimization`; the development branch is not deployed by this workflow.
