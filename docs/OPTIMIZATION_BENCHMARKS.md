# Optical optimization benchmarks — 0.6.0

## Protocol

Seven immutable prescriptions, nine methods, seeds **1001, 1002, 1003**: **189 runs**. Same input, physical bounds, verified catalog, aperture/field weights, merit definition and sampling for each paired comparison. Search grid 7; intermediate grid 15; final independent sunflower grid 19. Budgets are equal **objective-call ceilings**, not equal wall time: OMIT50 3000, analytical singlet 300, all other cases 1000. Derivative probes, failures and stage initializations are charged. Four validation objective calls are additional and identical per run. Early termination is explicitly reported. Deterministic methods repeat the same trajectory across seeds; this does not create three statistically independent trials. Population standard deviation is descriptive for these three runs, not an uncertainty bound. Success means both intermediate and dense improvement with hard constraints, without a quality threshold.

Machine-readable reports: [OMIT50 JSON](../benchmarks/omit50-methods-v1.json), [OMIT50 CSV](../benchmarks/omit50-methods-v1.csv), [other six cases JSON](../benchmarks/optimization-methods-v1.json), [CSV](../benchmarks/optimization-methods-v1.csv). Exact specifications, bounds, operands, source and catalog hashes, seeds, budgets, histories, rejection causes and exported prescriptions are included. Inputs are in [the frozen suite](../benchmarks/optical-suite-v1.json). Search runs record their development commit plus dirty-source hashes. A final serialization verification persists the physically prepared iris actually used by evaluation and freshly remeasures every exported prescription; it does not change any search result.

## OMIT50 result

The exact archived 50 mm f/2, 46.3 mm circle design starts at merit **250.588070278488**, with f/2 center RMS **112.271 µm** and edge RMS **328.064 µm**. The best paired result is block DLS: **211.699181757504**, a **15.52%** reduction. Its center RMS is **97.399 µm**, edge **309.609 µm**. The unchanged pattern method reaches **235.202469134701** at the same 3000-call ceiling; block DLS is **9.99%** lower. Both use all 3000 calls. All original f/2, f/2.8, f/4 and f/5.6 objectives remain active, as do the same eight glass options and physical limits; no glass substitutions occur in this paired geometry experiment.

Ordinary DLS and DE→DLS do not beat pattern search on this fixed fast-lens case. Coupled blocks help, but the result is still a poorly corrected fast lens by production-imaging standards; RMS alone cannot establish imaging quality. The historical 456.914→311.494→278.435→250.588 progression used unequal extra computation and is not evidence for relative algorithm efficiency.

## omit50 — budget 3000

Baseline dense merit: **250.588**. Lower is better only within this case and its fixed merit.

| Method | Median | Best | Worst | Std dev | Success | Calls used (min–max) | Mean wall s |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| coordinate | 244.611 | 244.611 | 244.611 | 0.000 | 100.0% | 3000–3000 | 22.453 |
| pattern | 235.202 | 235.202 | 235.202 | 0.000 | 100.0% | 3000–3000 | 22.586 |
| de | 236.316 | 229.371 | 250.588 | 8.832 | 66.7% | 3000–3000 | 5.758 |
| dls-radius | 238.873 | 238.873 | 238.873 | 0.000 | 100.0% | 1144–1144 | 9.338 |
| dls-curvature | 238.018 | 238.018 | 238.018 | 0.000 | 100.0% | 1141–1141 | 9.356 |
| hybrid | 238.018 | 238.018 | 238.018 | 0.000 | 100.0% | 2191–2191 | 10.099 |
| multistart | 238.378 | 231.283 | 238.378 | 3.345 | 100.0% | 3000–3000 | 24.358 |
| block-dls | 211.699 | 211.699 | 211.699 | 0.000 | 100.0% | 3000–3000 | 23.410 |
| continuation | 234.674 | 234.674 | 234.674 | 0.000 | 100.0% | 3000–3000 | 23.996 |

## cooke — budget 1000

Baseline dense merit: **19.007**. Lower is better only within this case and its fixed merit.

| Method | Median | Best | Worst | Std dev | Success | Calls used (min–max) | Mean wall s |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| coordinate | 18.732 | 18.732 | 18.732 | 0.000 | 100.0% | 1000–1000 | 2.355 |
| pattern | 18.692 | 18.692 | 18.692 | 0.000 | 100.0% | 1000–1000 | 2.291 |
| de | 19.007 | 19.007 | 19.007 | 0.000 | 0.0% | 1000–1000 | 0.403 |
| dls-radius | 17.923 | 17.923 | 17.923 | 0.000 | 100.0% | 1000–1000 | 2.684 |
| dls-curvature | 17.927 | 17.927 | 17.927 | 0.000 | 100.0% | 1000–1000 | 2.688 |
| hybrid | 17.992 | 17.992 | 17.992 | 0.000 | 100.0% | 1000–1000 | 1.817 |
| multistart | 18.469 | 17.372 | 18.469 | 0.517 | 100.0% | 1000–1000 | 2.683 |
| block-dls | 14.396 | 14.396 | 14.396 | 0.000 | 100.0% | 1000–1000 | 2.662 |
| continuation | 18.331 | 18.331 | 18.331 | 0.000 | 100.0% | 1000–1000 | 2.532 |

## double-gauss — budget 1000

Baseline dense merit: **48.681**. Lower is better only within this case and its fixed merit.

| Method | Median | Best | Worst | Std dev | Success | Calls used (min–max) | Mean wall s |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| coordinate | 47.022 | 47.022 | 47.022 | 0.000 | 100.0% | 1000–1000 | 3.652 |
| pattern | 46.648 | 46.648 | 46.648 | 0.000 | 100.0% | 1000–1000 | 3.725 |
| de | 48.681 | 48.681 | 48.681 | 0.000 | 0.0% | 1000–1000 | 0.513 |
| dls-radius | 46.457 | 46.457 | 46.457 | 0.000 | 100.0% | 1000–1000 | 4.116 |
| dls-curvature | 46.139 | 46.139 | 46.139 | 0.000 | 100.0% | 1000–1000 | 4.113 |
| hybrid | 46.994 | 46.994 | 46.994 | 0.000 | 100.0% | 1000–1000 | 2.800 |
| multistart | 47.832 | 47.832 | 47.832 | 0.000 | 100.0% | 1000–1000 | 4.115 |
| block-dls | 43.170 | 43.170 | 43.170 | 0.000 | 100.0% | 1000–1000 | 4.113 |
| continuation | 46.353 | 46.353 | 46.353 | 0.000 | 100.0% | 1000–1000 | 4.114 |

## modified-gauss — budget 1000

Baseline dense merit: **311.494**. Lower is better only within this case and its fixed merit.

| Method | Median | Best | Worst | Std dev | Success | Calls used (min–max) | Mean wall s |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| coordinate | 299.465 | 299.465 | 299.465 | 0.000 | 100.0% | 1000–1000 | 7.523 |
| pattern | 297.253 | 297.253 | 297.253 | 0.000 | 100.0% | 1000–1000 | 7.589 |
| de | 311.494 | 311.494 | 311.494 | 0.000 | 0.0% | 1000–1000 | 1.404 |
| dls-radius | 295.969 | 295.969 | 295.969 | 0.000 | 100.0% | 1000–1000 | 8.378 |
| dls-curvature | 295.726 | 295.726 | 295.726 | 0.000 | 100.0% | 1000–1000 | 8.405 |
| hybrid | 298.087 | 298.087 | 298.087 | 0.000 | 100.0% | 1000–1000 | 5.726 |
| multistart | 302.752 | 300.963 | 302.752 | 0.843 | 100.0% | 1000–1000 | 8.409 |
| block-dls | 271.729 | 271.729 | 271.729 | 0.000 | 100.0% | 1000–1000 | 8.367 |
| continuation | 294.928 | 294.928 | 294.928 | 0.000 | 100.0% | 1000–1000 | 8.382 |

## sonnar — budget 1000

Baseline dense merit: **406.760**. Lower is better only within this case and its fixed merit.

| Method | Median | Best | Worst | Std dev | Success | Calls used (min–max) | Mean wall s |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| coordinate | 349.150 | 349.150 | 349.150 | 0.000 | 100.0% | 1000–1000 | 6.584 |
| pattern | 369.450 | 369.450 | 369.450 | 0.000 | 100.0% | 1000–1000 | 6.447 |
| de | 406.760 | 395.764 | 406.760 | 5.184 | 33.3% | 1000–1000 | 0.910 |
| dls-radius | 383.013 | 383.013 | 383.013 | 0.000 | 100.0% | 1000–1000 | 7.780 |
| dls-curvature | 383.533 | 383.533 | 383.533 | 0.000 | 100.0% | 1000–1000 | 7.756 |
| hybrid | 385.958 | 385.958 | 385.958 | 0.000 | 100.0% | 1000–1000 | 5.231 |
| multistart | 392.687 | 381.531 | 392.687 | 5.259 | 100.0% | 1000–1000 | 7.549 |
| block-dls | 374.086 | 374.086 | 374.086 | 0.000 | 100.0% | 1000–1000 | 6.701 |
| continuation | 380.005 | 380.005 | 380.005 | 0.000 | 100.0% | 1000–1000 | 7.422 |

## poor-focus — budget 1000

Baseline dense merit: **220.710**. Lower is better only within this case and its fixed merit.

| Method | Median | Best | Worst | Std dev | Success | Calls used (min–max) | Mean wall s |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| coordinate | 23.721 | 23.721 | 23.721 | 0.000 | 100.0% | 1000–1000 | 2.099 |
| pattern | 23.276 | 23.276 | 23.276 | 0.000 | 100.0% | 1000–1000 | 2.113 |
| de | 28.446 | 27.288 | 33.235 | 2.574 | 100.0% | 1000–1000 | 0.390 |
| dls-radius | 192.473 | 192.473 | 192.473 | 0.000 | 100.0% | 1000–1000 | 2.591 |
| dls-curvature | 192.466 | 192.466 | 192.466 | 0.000 | 100.0% | 1000–1000 | 2.577 |
| hybrid | 105.928 | 100.673 | 109.989 | 3.814 | 100.0% | 740–1000 | 1.506 |
| multistart | 90.610 | 58.649 | 141.370 | 34.060 | 100.0% | 1000–1000 | 2.514 |
| block-dls | 16.978 | 16.978 | 16.978 | 0.000 | 100.0% | 1000–1000 | 2.613 |
| continuation | 169.327 | 169.327 | 169.327 | 0.000 | 100.0% | 1000–1000 | 2.559 |

## analytic-singlet — budget 300

Baseline dense merit: **4.367**. Lower is better only within this case and its fixed merit.

| Method | Median | Best | Worst | Std dev | Success | Calls used (min–max) | Mean wall s |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| coordinate | 1.127 | 1.127 | 1.127 | 0.000 | 100.0% | 300–300 | 0.137 |
| pattern | 1.126 | 1.126 | 1.126 | 0.000 | 100.0% | 300–300 | 0.132 |
| de | 1.005 | 0.995 | 1.008 | 0.006 | 100.0% | 300–300 | 0.133 |
| dls-radius | 0.959 | 0.959 | 0.959 | 0.000 | 100.0% | 300–300 | 0.147 |
| dls-curvature | 0.965 | 0.965 | 0.965 | 0.000 | 100.0% | 300–300 | 0.150 |
| hybrid | 0.973 | 0.958 | 0.985 | 0.011 | 100.0% | 300–300 | 0.145 |
| multistart | 0.959 | 0.959 | 0.963 | 0.002 | 100.0% | 300–300 | 0.147 |
| block-dls | 0.961 | 0.961 | 0.961 | 0.000 | 100.0% | 298–298 | 0.147 |
| continuation | 0.964 | 0.964 | 0.964 | 0.000 | 100.0% | 300–300 | 0.149 |

## Sampling convergence

All seven selected winners retain improvement at grids 25, 31 and 41; exact measurements are in [sampling convergence](../benchmarks/sampling-convergence-v1.json). This is a post-search diagnostic and does not silently replace the archived final grid 19 objective.

| Case | Selected method | Baseline, grid 41 | Winner, grid 41 |
| --- | --- | ---: | ---: |
| omit50 | block-dls | 250.250 | 211.424 |
| cooke | block-dls | 18.858 | 14.321 |
| double-gauss | block-dls | 48.507 | 43.020 |
| modified-gauss | block-dls | 311.677 | 271.197 |
| sonnar | coordinate | 408.023 | 351.288 |
| poor-focus | block-dls | 220.452 | 16.990 |
| analytic-singlet | hybrid | 4.355 | 0.959 |

The old coordinate method wins the Sonnar case, while block DLS wins the four other topology/reference cases and deliberate defocus. There is no universal winning algorithm. These are small, specific experiments, not a broad benchmark of all feasible prescriptions.

## Throughput and sensitivity

A separate warmed local run is recorded in [optical diagnostics](../benchmarks/optical-diagnostics-v1.json). Whole valid skew-ray traces: **448,393/s** over 100000 rays. Full valid OMIT50 multi-aperture merit: **131.396 evaluations/s**. No optical hot path was rewritten for speed. Search-run wall times above were collected during development, with some concurrent work; use objective budgets for the optical comparison rather than treating those timings as controlled hardware rankings.

| DE workers | Objective proposals/s | Ordered numerical result |
| ---: | ---: | --- |
| 1 | 1600.908 | identical |
| 2 | 2049.980 | identical |
| 4 | 2176.308 | identical |

DE proposals include cheap hard-constraint rejections, so this rate is **not** interchangeable with full valid merit throughput. A 240-proposal run with the same seed and proposal order was repeated after worker startup. DLS runs sequentially; no parallel DLS speedup is claimed.

- dls-curvature: 400 calls in 2.873 s (139.238 calls/s). Last complete Jacobian: 80 calls, 572.584 ms.
- hybrid: 400 calls in 1.919 s (208.427 calls/s). Last complete Jacobian: 80 calls, 565.531 ms.

The separate aberration sensitivity matrix takes 80 evaluations / 1171.170 ms, and records center/edge RMS, spherical-zone, even-fan coma, astigmatism, field curvature, LCA, lateral CA, distortion and ray loss against every normalized variable. Coupling and rejected-column diagnostics are included. Units/scales and the distinction between geometric proxies and Seidel coefficients are documented in [methods](OPTIMIZATION_METHODS.md).

## Additional glass/geometry investigation

Two additional geometry→glass cycles from the block-DLS OMIT50 winner (500 geometry calls per round; 100 per viable glass trial) retained merit **211.699**: no further dense improvement. All trials, constraints and rejected substitutions are retained in [the alternation audit](../benchmarks/omit50-alternation-v1.json). This experiment has extra, variable glass-search cost and is **not** an equal-budget competitor in the tables above. Thin-achromat and partial-dispersion diagnostics use the existing eight verified models only.

## Verification and limits

111 automated tests passed, including independent reference optics, weighted metrics, numerical Jacobian, DLS convergence, bounds, checkpoint replay, hybrid/restarts/continuation, glass alternation and identical 1/2/4 worker outputs. JavaScript syntax checks pass. Browser smoke tests exercised New Lens synthesis, DLS refinement (40.2895→10.6740 on a separate generated Cooke), synthesis pause/autosave/restore/resume, transfer to Search Lab, Search Lab pause/restore/resume to 10,000 evaluations, and dense validation (best 8.29361). Final block-DLS UI refinement also passed (14.0829→10.2402, all hard checks PASS, no console errors). That browser example has a different input and budget and is **not** the fixed-suite comparison.

Independent analytical and separate numerical reference checks are detailed in [optical validation](OPTICAL_VALIDATION.md). No Zemax comparison was performed. Paraxial-pupil sampling, spherical/infinity-conjugate scope, conservative active-bound derivatives and sequential DLS remain limitations. PSF, MTF, transmission/T-stop and fabrication tolerance certification remain unavailable.
