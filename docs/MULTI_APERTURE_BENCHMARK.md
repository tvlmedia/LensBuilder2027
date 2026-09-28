# Multi-aperture benchmark and validation

Measured on the development machine with Node v24.16.0, bundled Biotar, six fields, F/d/C, 32 candidates per case after four warmup candidates. These are workload-dependent measurements, not throughput guarantees. Dense cases include independent grid19 pupil sampling, fans, focus diagnostics and result transport.

| Apertures | Sampling | Workers | Evaluations/s | Valid / attempted |
|---|---|---:|---:|---:|
| existing physical stop | Search grid9 | 1 | 254.0 | 32/32 |
| existing physical stop | Search grid9 | 4 | 709.0 | 32/32 |
| existing physical stop | Dense + diagnostics | 1 | 48.5 | 32/32 |
| existing physical stop | Dense + diagnostics | 4 | 135.3 | 32/32 |
| [2] | Search grid9 | 1 | 244.7 | 32/32 |
| [2] | Search grid9 | 4 | 657.6 | 32/32 |
| [2] | Dense + diagnostics | 1 | 46.5 | 32/32 |
| [2] | Dense + diagnostics | 4 | 135.2 | 32/32 |
| [2, 2.8] | Search grid9 | 1 | 123.6 | 32/32 |
| [2, 2.8] | Search grid9 | 4 | 355.8 | 32/32 |
| [2, 2.8] | Dense + diagnostics | 1 | 23.4 | 32/32 |
| [2, 2.8] | Dense + diagnostics | 4 | 72.2 | 32/32 |
| [2, 2.8, 4, 5.6] | Search grid9 | 1 | 66.7 | 32/32 |
| [2, 2.8, 4, 5.6] | Search grid9 | 4 | 211.9 | 32/32 |
| [2, 2.8, 4, 5.6] | Dense + diagnostics | 1 | 12.1 | 32/32 |
| [2, 2.8, 4, 5.6] | Dense + diagnostics | 4 | 36.1 | 32/32 |

Baseline before this milestone was remeasured at 294 / 557 / 1024 evaluations/s with 1 / 2 / 4 workers over 512 candidates. The new 32-candidate cases include proportionally more scheduling overhead and are not directly equivalent. Multi-aperture work scales approximately with aperture count. Dense diagnostic transport is substantially more expensive and is reserved for selected candidates.

61 tests pass, including an independently calculated singlet chief ray, aperture/focus invariants, the reconstructed distortion fixture, ray-fan symmetry, least-variance focus algebra, pupil symmetry, convergence, cross-aperture merit, configuration integrity and worker equality. No commercial reference dataset or multi-day soak test has been completed. Field-curvature/astigmatic interpretation remains experimental. Raw measurements: [JSON](multi-aperture-benchmark.json).
