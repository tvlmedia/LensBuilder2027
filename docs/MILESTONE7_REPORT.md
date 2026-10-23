# Milestone 7 — measured delivery report

Version **0.9.0**; branch `feat/physical-pupil-boundaries`, based on verified 0.8.2 commit `b9f6b3156ab3f75c44a67c6410d7e793b470ba11`. The published v0.5.3 branch is not the development base. PR #5 supplies the prerequisite M6 changes. This milestone does not merge or deploy them.

Measured benchmark source fingerprint: `b19199df31190feec8135875f31ca841624b71d22ed0b9cb67dec51581ac6c16`. Full algorithms, state semantics and scientific limitations: [Physical pupil boundaries](PHYSICAL_PUPIL_BOUNDARIES.md). Numerical data: [pupil benchmark](../benchmarks/pupil-boundaries-v1.json) and [regression record](../benchmarks/milestone7-regression-v1.json).

Final delivery fingerprint: `372b095ba0bb80accfdbf488a2b749391d284d9b9af6fea4706adcc0de747341`. Final review aligned the direct wavefront status with EXPERIMENTAL atlas confidence and added the same ambiguity/domain guards to diagnostic focus scans. These guard changes do not alter the benchmark ray paths, areas or phase values; the full test suite was rerun on final source.

## Independent geometry references

Each shape uses at most 16,000 probes, a 2.5 mm square launch domain and depth at most 8. Accuracy is checked on an independent 512² grid. Every classified comparison agrees; the unresolved band is excluded from that accuracy, and remains reported. The boundary error below is maximum bracket-midpoint distance to the independently known boundary.

| Geometry | Area error % | Boundary error mm | Unresolved area % | Probes | Time ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| circle | 0.00873 | 0.002396 | 1.251 | 11841 | 19.48 |
| decentered | 0.01800 | 0.002405 | 1.001 | 9657 | 14.67 |
| ellipse | 0.00341 | 0.002421 | 0.940 | 9153 | 12.32 |
| cat-eye | 0.00321 | 0.002284 | 0.989 | 9545 | 9.26 |
| annulus | 0.02942 | 0.004685 | 2.185 | 15997 | 18.01 |
| disconnected | 0.07867 | 0.002314 | 0.751 | 7521 | 6.14 |

Folded mapping, deliberate inverse failure, multiple roots, real surface clipping, memory limits, serialized reports and browser-worker parity also pass targeted tests. Rings and disconnected islands are detector validation cases, not additional editor aperture types. Finite probes do not certify unseen small features.

## Exact OMIT50: inverse mapping before / after

Same prescription, f/2, 587.5618 nm, image circle Ø46.3 mm, fixed focus. Atlas-assisted runs add an 8,192-probe launch atlas and bounded seeded retries. All rows retain **UNAVAILABLE** diffraction.

| Field | Grid | Unmapped before → after | Adjacent phase waves (unchanged) | Extra traces | After time s |
| --- | ---: | ---: | ---: | ---: | ---: |
| 0 | 256² | 26164 → 26164 | 0.585035 | 41061 | 4.181 |
| 0 | 512² | 104670 → 104670 | 0.299766 | 41027 | 17.037 |
| 0.5 | 256² | 26071 → 26071 | 1.463919 | 41062 | 4.486 |
| 0.5 | 512² | 104268 → 104268 | 0.740699 | 41088 | 17.836 |
| 0.7 | 256² | 26025 → 26025 | 2.189601 | 40994 | 4.534 |
| 0.7 | 512² | 104048 → 104048 | 1.101581 | 40968 | 17.718 |
| 1 | 256² | 26140 → 26139 | 3.362896 | 33581 | 4.484 |
| 1 | 512² | 104483 → 104483 | 1.692489 | 40984 | 17.541 |

At field 1, 256², one failed solve becomes physically blocked after a converged, retraced inverse query. No transmitted samples are recovered. All 512² failure counts remain unchanged; RMS and phase differences remain identical before/after. The 0.25-wave limit has not changed.

| Field | Atlas launch area mm² | Unresolved launch area % | Forward probes |
| --- | ---: | ---: | ---: |
| 0 | 477.1879 | 1.8402 | 8191 |
| 0.5 | 497.4211 | 1.8188 | 8187 |
| 0.7 | 518.8050 | 2.0187 | 8191 |
| 1 | 553.5991 | 2.1851 | 8187 |

These fractions describe launch-domain cells, not failed reference-grid coordinates or energy loss. Forward samples in these OMIT50 atlases are individually transmitted or explicitly clipped, while mixed cells remain uncertain. A valid launch atlas does not settle the inverse coordinate queries outside or near its mapped image. No missing region is filled with artificial zero transmission.

## Matched maximum forward-ray budgets

| Field | Budget | Uniform ms | Adaptive ms | Adaptive unresolved area % | Max bracket width mm | Area difference from uniform mm² |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | 65536 | 118.0 | 259.1 | 0.2567 | 0.018303 | +0.222153 |
| 0 | 262144 | 455.3 | 1190.6 | 0.2567 | 0.018303 | +0.029184 |
| 0.5 | 65536 | 113.6 | 255.7 | 0.2625 | 0.018303 | -0.403509 |
| 0.5 | 262144 | 445.2 | 1212.7 | 0.2625 | 0.018303 | -0.006849 |
| 0.7 | 65536 | 112.1 | 242.9 | 0.2680 | 0.018303 | +0.036033 |
| 0.7 | 262144 | 441.7 | 1188.7 | 0.2680 | 0.018303 | +0.003871 |
| 1 | 65536 | 107.4 | 242.3 | 0.3344 | 0.036607 | -0.059261 |
| 1 | 262144 | 414.0 | 1186.5 | 0.2701 | 0.018303 | +0.072364 |

Uniform budget 65,536 corresponds to 256²; 262,144 corresponds to 512². Adaptive probes never exceed that budget and can finish several probes below it. No misclassified resolved comparisons were found in any of these eight cross-grid checks. Unresolved comparison fractions and actual calls are retained in JSON. Bracket width is a resolution diagnostic, not measured true boundary error for OMIT50. The uniform forward tracer is a numerical reference, not an independent optical ground truth.

Adaptive elapsed time is roughly 2–3 times the uniform forward sweep in this run. The benefit is finer transition localization and explicit uncertainty, not a demonstrated runtime win. Boundary refinement can saturate at depth 10 while additional probes resolve interior OPD. Timings are a single development-machine run with other validation activity, not isolated performance statistics. The process memory snapshot is not peak memory.

## Regression and browser checks

- **178 tests pass**, including the previous 165 plus 13 targeted pupil tests; syntax checks pass.
- **189** geometric prescriptions: maximum absolute dense merit difference **0**.
- **16** physical OMIT50 configurations: exact RMS/PV/status agreement with the archived reference.
- Legacy physical, advanced physical and new pupil benchmark commands pass.
- Browser under `/LensBuilder2027/`: exact OMIT50 field 1/f2/64² atlas shows 8,187 probes, 2.19% unresolved launch area and UNAVAILABLE PSF; no console errors.
- New Lens: budget 256, two workers, FINISHED, 245 stage units, eight dense candidates, best dense merit 79.7410.
- Search Lab: budget 64, two workers, FINISHED, 64 valid evaluations. No candidate adopted into the editor.

The legacy physical benchmark had inherited automatic refinement and exceeded its retained-result estimate before M7. Its original fixed-grid sweep now explicitly disables automatic refinement, reads the exact serialized fixture, and writes `physical-quality-current.json` rather than overwriting the historical reference. Archived 0.8 benchmark files are preserved; the new regression record identifies this run.

## Remaining work

Unseen launch-domain components, sub-cell holes, complete multiple-root isolation and robust inversion around caustics are unresolved. The optional atlas is always EXPERIMENTAL. Neither spectral registration nor propagation physics has been expanded. No reliable OMIT50 f/2 MTF, calibrated throughput, high-NA vector diffraction, manufacturing certification or MTF optimization is claimed.
