# Verified glass exploration — 0.5.1

Measured 2026-09-29 with `npm run benchmark:synthesis -- --omit --glass-exploration`. Full specifications, prescriptions, aperture metrics and counts are in [glass-exploration-benchmark.json](glass-exploration-benchmark.json). The baseline is the retained [0.5.0 benchmark](SYNTHESIS_BENCHMARK.md). Both use seed 1001, the same target-specific budgets (10k / 10k / 100k), four workers, objectives, geometry constraints and dense validation. The changed inputs are the allowed glass list and the seed pair policy. This is one deterministic run per target, not a multi-seed statistical comparison.

| Target | Baseline → expanded dense merit (lower better) | Baseline → expanded center RMS µm | Baseline → expanded edge RMS µm | Expanded winning pair | Dense-valid candidates |
|---|---:|---:|---:|---|---:|
| Cooke 50 mm f/4 Ø30 | 13.774 → 26.891 | 29.297 → 45.937 | 88.300 → 115.248 | N-SK16 / N-F2 | 6 |
| Double Gauss 50 mm f/2.8 Ø36 | 50.404 → 54.289 | 66.749 → 74.206 | 173.892 → 144.754 | N-LAK22 / N-F2 | 6 |
| OMIT50 50 mm f/2 Ø46.3 | 456.914 → 311.494 | 165.973 → 129.593 | 450.499 → 374.376 | N-SK16 / N-SF10 | 5 |

The f/2 objective improves 31.83%, center RMS 21.92%, edge RMS 16.90%. The winner has EFL 49.9219 mm, and passes the same configured hard/dense checks. These spot sizes remain too large for a finished technical cinema lens. Sampled pupil survival remains a limited coverage check; no MTF, diffraction, T-stop or production certification is claimed.

Wider glass exploration does not uniformly improve a finite-budget search: the Cooke result is worse, and Double Gauss has a better edge but worse aggregate objective. Retain the two-glass default and compare independent runs. The expanded preset is opt-in. Each seed uses one crown/flint pair; arbitrary multi-glass element assignments are not implemented. Optional single-element glass substitution remains a separate explicitly launched operation.

## Data and validation

Six records were promoted from approximate nd/Vd to SCHOTT Sellmeier models: N-LAK22, N-SK16, N-SF6, N-SF10, N-BAK4 and N-PK52A. See [provenance](glass-catalog-provenance.json). This makes eight distinct verified dispersion models plus the optically duplicate N-BK7HT record. No manufacturer availability or transmission is inferred from the coefficients.

84 automated tests pass, including manufacturer nd/Vd agreement, reproducible diverse seed pairs, unchanged legacy seed generation, and seed-stage checkpoint replay. JavaScript syntax checks pass. A real browser run of 1000 units with two workers completed dense validation using the expanded preset and displayed different verified glass pairs without console errors.

The numerical engine version stays `synthesis-1`: missing `seedGlassPolicy` retains the original algorithm, and the new policy is stored in the frozen specification/configuration hash. Old N-BK7/N-F2 synthesis checkpoints preserve their trajectory. Historical approximate analyses involving any of the six promoted names need recalculation against the new verified dispersion model.
