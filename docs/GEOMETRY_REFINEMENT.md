# Geometry refinement — 0.5.2

**REFINE GEOMETRY** on a synthesis candidate runs up to 3000 additional local objective evaluations. It remeasures the parent with independent dense pupil sampling, searches within freshly generated bounds, re-sizes clear apertures, and densely validates the proposed result against the same specification and operands. Only a lower dense merit with all hard checks passing replaces the candidate. An unsuccessful attempt retains the parent. This is additional work outside the original synthesis funnel allocation; each attempt's search and dense evaluation counts and before/after scores are saved in `geometryRefinements` and exposed in candidate details/experiment export.

The new `bounded-pattern-extrapolation-v1` algorithm retains bounded coordinate sweeps. After a successful sweep it tries the combined displacement once more, clamped to each variable's bounds. Every trial uses the real optical objective and physical constraints. An invalid or worse trial is discarded. This adds no gradient approximation or untraced acceptance rule. Pending combined moves and the sweep origin are serialized so interrupted synthesis runs resume deterministically.

New UI runs select **Accelerated pattern search**; users can select the original coordinate method. The API's missing `localSearchPolicy` and old saved specifications preserve the original behavior. `pattern-v1` opts into the new local stage; `coordinate-v1` explicitly retains the old one. Existing global DE and optical engine versions remain unchanged.

The standalone refinement action yields to the browser between short batches and saves the final result. An interrupted standalone refinement must be rerun from the saved parent; it does not promise mid-refinement checkpoint persistence. Normal synthesis local-stage checkpoints do preserve accelerated state.

## Equal-budget comparison

Run `npm run benchmark:refinement`. Inputs are the three dense winners from the archived 0.5.1 expanded-glass benchmark. Each method starts independently from the identical target-specific parent with 3000 additional objective evaluations and two dense evaluations. Frozen specifications, operands, resulting prescriptions, per-field metrics and audits are in [refinement-benchmark.json](refinement-benchmark.json). These are three fixed designs, not evidence of universal superiority.

| Target | Parent dense merit | Original method | Pattern method | Pattern center / edge RMS µm |
|---|---:|---:|---:|---:|
| Cooke f/4 Ø30 | 26.891 | 23.247 | 23.166 | 37.354 / 106.400 |
| Double Gauss f/2.8 Ø36 | 54.289 | 49.269 | 48.681 | 70.640 / 136.166 |
| OMIT50 f/2 Ø46.3 | 311.494 | 281.510 | 278.435 | 117.681 / 355.975 |

For the f/2 example this is a 10.61% improvement over the parent after additional computation. At equal extra budget the pattern method improves aggregate merit by 1.09% over the original coordinate method, but its edge RMS is slightly worse (355.975 versus 353.139 µm). Acceptance uses the configured aggregate objective, not an assertion that every individual metric improves. The earlier two-glass baseline was 456.914 with center/edge RMS 165.973/450.499 µm, but that comparison includes both broader glass exploration and additional refinement budget.

All resulting benchmark prescriptions pass the configured hard checks. The f/2 design remains insufficiently corrected for a finished technical cinema lens. Independent external-reference validation, more effective aberration correction, real-pupil coverage, diffraction/MTF and production tolerances remain future work.

## Validation

87 tests pass, covering accepted improvements, unchanged parent on a flat objective, physical constraints, strict evaluation budget, rejection of malformed pattern state, and identical replay at a pending combined move and within the synthesis local stage. JavaScript syntax and diff checks pass. In the real browser, a stored Cooke candidate refined from dense merit 92.1035 to 55.8029 with all hard checks passing and no console errors.
