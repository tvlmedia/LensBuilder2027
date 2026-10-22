# Milestone 6 — 0.8.0 implementation and scientific report

Development starts at validated 0.7 commit `3345ba26e7121754b30639ef5df917773020fd8d`, on `feat/advanced-physical-optics`. The initial remote audit found PR #3 and #4 open and unmerged; the publication branch remained at `60507b1374869b03ec5617a15b7d98a2bd170780` (0.5.3). This branch includes those prerequisites. It is not an independent patch against 0.5.3. No merge or deployment is part of this milestone.

## Delivered

- Robust inverse pupil mapping with explicit failures, conditioning and unwrapped phase-risk diagnostics.
- Error-driven uniform pupil refinement; configurable limits through 512² pupil and 2048² FFT.
- Separate pupil/padding convergence including PSF shape, centroid, width, energy and directional MTF.
- Registered polychromatic intensity, explicit spectral weights and complex OTF on a shared physical grid, preserving chromatic displacement and a common focus plane.
- Independent affine sensor geometry tests; off-axis wave propagation remains experimental.
- Worker progress, hard cancellation, timeout, buffer transfer, cost estimates, JSON request and numerical report export.
- Existing geometric search remains unchanged. No AI services, physical merit operands or MTF-driven refinement were added.

## Scientific evidence

The 138-test baseline, syntax checks, historical physical benchmark and all 189 geometric prescriptions were reproduced before edits. The updated suite has 157 tests, including controlled shifted spectra, exact overlap references, diffraction scales, defocus, energy, high-resolution FFT, mapping, sensor geometry and worker cancellation. The post-change geometric audit reports maximum merit difference **0** across all 189 prescriptions.

The analytical singlet and Double Gauss f/16 examples pass the stricter numerical checks inside the restricted on-axis scalar model (approximately 0.220 s and 0.532 s on this machine). A clear 512² pupil / 2048² FFT has energy 0.9999999999997702 and Parseval relative error 1.05e-13, with PSF 185 ms and MTF 172 ms. This synthetic case does not validate fast-lens physics.

Automatic sampling uses 67.2% fewer mapping ray calls than a single 256² singlet sample in the recorded comparison; see [method and qualifications](ADAPTIVE_PUPIL_SAMPLING.md). The real-lens spectral example is still NOT CONVERGED overall despite its spectral-padding check passing. It remains physically EXPERIMENTAL.

## OMIT50 results

Source is the exact serialized `benchmarks/physical-omit50.json`. Historical dense merit 211.6991817575039 remains unchanged in the complete geometric audit. The following diagnostic values use 64² pupil samples at 587.5618 nm and a fixed prescription plane. They are sampled wavefront values, not converged physical image-quality claims.

| f-number | Field | RMS waves | Maximum adjacent waves | PSF/MTF |
|---|---|---|---|---|
| 2 | 0 | 9.72182 | 2.31612 | UNAVAILABLE |
| 2 | 0.5 | 7.96781 | 5.30797 | UNAVAILABLE |
| 2 | 0.7 | 16.91154 | 8.22136 | UNAVAILABLE |
| 2 | 1 | 35.62802 | 12.84972 | UNAVAILABLE |
| 2.8 | 0 | 8.60769 | 1.65488 | UNAVAILABLE |
| 2.8 | 0.5 | 4.65632 | 1.32907 | UNAVAILABLE |
| 2.8 | 0.7 | 6.36543 | 2.01150 | UNAVAILABLE |
| 2.8 | 1 | 15.76402 | 4.31423 | UNAVAILABLE |
| 4 | 0 | 5.22167 | 1.15575 | UNAVAILABLE |
| 4 | 0.5 | 2.97393 | 0.92372 | UNAVAILABLE |
| 4 | 0.7 | 2.85657 | 0.94593 | UNAVAILABLE |
| 4 | 1 | 6.59412 | 1.84275 | UNAVAILABLE |
| 5.6 | 0 | 2.91644 | 0.71241 | UNAVAILABLE |
| 5.6 | 0.5 | 1.71326 | 0.55272 | UNAVAILABLE |
| 5.6 | 0.7 | 1.44408 | 0.53376 | UNAVAILABLE |
| 5.6 | 1 | 3.05060 | 0.85610 | UNAVAILABLE |

The f/2 challenge was repeated at 512², padding 2, on all four fields:

| Field | Maximum adjacent waves | Total seconds | Mapping ray calls |
|---|---|---|---|
| 0 | 0.299766 | 15.98 | 8,234,702 |
| 0.5 | 0.740699 | 16.64 | 8,373,357 |
| 0.7 | 1.101581 | 16.47 | 8,402,936 |
| 1 | 1.692489 | 16.38 | 8,559,381 |

All exceed the 0.25-wave adjacent-sample limit. On-axis changed from 0.5850 waves at 256² to 0.2998 at 512²; full field changed from 3.3629 to 1.6925. This approximately halving behavior supports real unresolved unwrapped phase variation rather than a wrapped-phase display artifact. A phase-gradient-only extrapolation suggests at least 1024² on-axis and 4096² at the edge, but does not guarantee convergence.

A second, separate gate is unresolved inverse mapping outside the nominal disk. No remaining failures were found inside that disk in these probes, and the local valid Jacobians are well-conditioned; that does not certify the distorted outer pupil. Failed samples are not silently classified as blocked. Increasing FFT padding cannot repair either missing rays or aliased pupil phase. A third independent limitation is the high-NA/off-axis physical approximation. Thus no OMIT50 f/2 MTF or polychromatic improvement is claimed and no MTF-based local refinement was attempted.

## Performance and limits

Recorded on Node v24.16.0, Darwin arm64; timings are machine-dependent. OMIT50 512² mapping requires about 16–17 seconds per field here. The benchmark process RSS snapshot was 791,576,576 bytes after multiple sequential cases; it is not a peak measurement. Large grids have conservative allocation estimates, but browser overhead/GC is additional. OPD work is included in mapping/wavefront timing. The high-resolution FFT benchmark measures a clear synthetic pupil; OMIT50's FFT is correctly withheld.

[Convergence rules](PHYSICAL_CONVERGENCE.md), [spectral conventions](POLYCHROMATIC_PSF_MTF.md) and [off-axis model limits](OFF_AXIS_DIFFRACTION.md) describe the exact supported claims. A locally adaptive nonuniform FFT, 1024² pupil, vector diffraction, calibrated transmission, integrated external real-lens validation and MTF optimization remain unsupported.

## Reproduce

```sh
npm test
npm run check
npm run benchmark:advanced
npm run audit:physical
PORT=8081 BASE_PATH=/LensBuilder2027 node tools/server.cjs
```

Open `/LensBuilder2027/` on that server. In Wavefront / PSF / MTF load the f/16 singlet and Analyze: the monochromatic case passes. For spectral analysis choose f/32, `550:1,587.5618:2,620:1`, registered polychromatic mode, pupil64/max128/padding4: four results appear, with the integrated result experimental and not fully converged. A larger grid is never relabeled validated merely for existing.

Machine-readable evidence: `advanced-baseline-audit.json`, `advanced-mapping-probe.json`, `advanced-physical-v1.json` in `benchmarks/`. The historical 0.7 physical benchmark remains unchanged for comparison. The final benchmark records the stamped build fingerprint; reproducibility is defined by the algorithm, prescription and settings, not identical elapsed times.

## Browser regression evidence

Tested on the local `/LensBuilder2027/` Pages-style path: singlet monochromatic analysis, three-channel polychromatic analysis, progress messages, unavailable OMIT50 spectral result, and cancellation during a 512² mapping job. New Lens completed a 256-unit-budget run with eight dense candidates (best dense merit 79.7410); Search Lab completed 64/64 valid evaluations. No browser console errors were observed in these runs. These are smoke tests, not multi-day memory or browser-compatibility certification.

An additional browser f/16 spectral run at 550/587.5618/620 nm (1/2/1, pupil64/max128/padding4) passed numerical convergence while retaining physical EXPERIMENTAL status. Its energy error was 6.88e-15. Numerical JSON export was downloaded and inspected: version 0.8.0, build fingerprint, full prescription and confidence were retained, bulk PSF arrays omitted.

## Follow-up 0.8.1

Convergence history is now retained when refinement stops at a resource limit, and the UI explicitly distinguishes numerical status, physical model status and termination reason. Failed/blocked inverse-mapping attempts now contribute to retry and condition diagnostics. These changes improve diagnosis, not the supported optical regime.

The 16-case physical regression benchmark preserves RMS, PV and eligibility exactly. All 161 tests pass; the complete 189-prescription geometric audit was rerun. Browser verification exercised a failed 32→64 comparison with a 64 maximum and confirmed the visible grid-limit reason and retained comparison history. See [convergence details](PHYSICAL_CONVERGENCE.md) and `benchmarks/physical-diagnostics-v1.json`.
