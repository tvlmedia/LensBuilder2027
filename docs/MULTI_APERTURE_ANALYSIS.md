# Multi-aperture analysis and optimization

Open Search Lab, capture a lens, then use **Apertures & optical measurement laboratory**. Its defaults list f/2, 2.8, 4 and 5.6, but nothing is applied until requested. Add/remove/edit values, optimization/validation switches and aperture weights. The first optimization aperture is primary. Optimization apertures must also be enabled for validation. Maximum 12 distinct positive apertures; weights are nonnegative, with a positive optimization weight required.

**Apply apertures** writes only analysis configuration, preserving operands. **Rebuild default aperture operands** explicitly replaces operands with generic aperture-specific defaults. These are not Omit artistic targets. The structured merit table supports fields, aperture A, optional comparison B, operation, mode, target/range, scale and operand weight. Read/write buttons synchronize it with the advanced JSON editor; table edits do not silently overwrite JSON.

Aperture configuration example:

```json
"apertures": [
  {"fNumber":2,"optimization":true,"validation":true,"weight":1},
  {"fNumber":2.8,"optimization":true,"validation":true,"weight":1},
  {"fNumber":4,"optimization":false,"validation":true,"weight":1}
]
```

Merit operands require an explicit enabled optimization aperture. Existing types MINIMIZE, MAXIMIZE, TARGET VALUE, TARGET RANGE, MINIMUM and MAXIMUM remain. Numeric units are unchanged: RMS/color mm, distortion %, f-number dimensionless. Directional MINIMIZE/MAXIMIZE are signed linear objectives; target/range/threshold operands are squared normalized errors. Targets and tolerances are user-specified.

Cross-aperture operands use `operation: "CHANGE"` for metric(A)−metric(B), or `"RATIO"` for metric(A)/metric(B), with `aperture` and `compareAperture`. A ratio is rejected if |denominator| is below `ratioFloor` (default 1e−9 in the source metric's units), not silently clamped. The same type/target/range machinery then scores the computed value. The contribution is multiplied by **aperture A's global weight**, independently of the individual operand weight. Both source apertures must be optimization-enabled. For comparing an aperture to another without weighting preference, set their global weights to 1.

The cleanup table separately reports adjacent configured apertures: absolute change = later−earlier, relative change = change/earlier, ratio = earlier/later. Near-zero denominators give null. Underlying values are retained; there is no opaque cleanup/quality score.

## Measurement and comparison

**Dense analysis of captured base** runs in a worker at all validation-enabled apertures, using the frozen captured prescription. It does not change the editor. The table shows RMS and directional RMS, distortion and separate sensor-plane mapping, lateral color, paraxial F–C color, pupil survival and experimental focus diagnostics. Graphs can plot field curves or aperture curves at a selected field, including multiple selected candidates.

Select aperture and field to view geometric spots, tangential/sagittal fans and a pupil-survival map. The on-axis view adds zonal longitudinal spherical-aberration plots. Spot comparison defaults to a common scale across all candidates/fields/apertures; individual scale and wavelength toggles are explicit. The white cross is the full polychromatic centroid, including hidden wavelengths: toggling visibility does not re-center the data.

Search Lab **Compare selected** connects dense-valid elites to this matrix/graph workspace. Its older compact corner summaries still use their explicitly labeled individual scales; use the measurement workspace for honest common-scale comparisons. **Adopt** uses the primary validated iris for a multi-aperture candidate, so the immediately loaded iris is actually one of the measured settings. The experiment retains its original-stop geometry and full configuration.

Presets store the complete analysis specification and operands, including fields, wavelengths, aperture flags/weights, focus policy, constraints and any `validationGrid`. Named presets are local browser storage; export important data. Presets do not contain subjective style judgments. JSON exports include full prescription, software/source provenance, analysis configuration, sampling, statuses and numeric fan/focus/pupil data. CSV exports the tabular matrix; JSON is the complete reproducibility record.

## Search, safety and versioning

Candidate geometry/material/BFL checks precede rays. Each required optimization aperture receives standard configured sampling; failure at an earlier required aperture safely rejects the candidate before subsequent apertures. The old optional coarse gate is disabled for multi-aperture search rather than screening the wrong iris. Dense validation visits all validation-enabled apertures even after failure, with default reference fields/colors plus configured additions. Pupil grid is 19–41 (automatic 2×search+1, or explicit `validationGrid`), using the independent fourfold sunflower pattern. Search never densely evaluates every candidate by default.

Multi-aperture configurations are frozen in experiment/checkpoint state. A canonical FNV-1a configuration hash detects accidental changes to base/specification/variables/operands/algorithm settings; it is not a cryptographic security guarantee. Restore checks that hash, bounds, engine version and numerical scores before resume. Worker-count independence, JSON serialization and all-aperture dense validation are tested. Pausing/stopping/autosave still occur at complete batch boundaries.

**Definition migration:** search engine `numerical-lab-2` and local engine `lb2027-spherical-0.4.0` intentionally reject older checkpoints. Their distortion objective and dense sample pattern changed. Old files remain readable JSON, but continuing their previous population/score history under new definitions would be scientifically incorrect. Recreate a new experiment from their configuration and prescription; retain the old app/branch if the original trajectory itself is needed. No old checkpoint is silently reinterpreted.

See [metric equations/status](OPTICAL_METRICS.md) and [benchmarks](MULTI_APERTURE_BENCHMARK.md). Field-curvature/astigmatic plane interpretation remains experimental, and coma/PSF/MTF/T-stop remain unavailable. No from-scratch lens generator or AI dependency is introduced.
