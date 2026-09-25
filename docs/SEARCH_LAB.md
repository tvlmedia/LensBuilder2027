# Numerical Search Lab

This milestone extends the existing editor and local optimizer. The finished application uses **physics, numerical constraints and seeded search only**. No AI, LLM, inference service, API key or network connection is involved in optimization. Serve the static files locally or on GitHub Pages; once loaded, the workers use bundled code/data. Browser refresh still needs the static files available: this is not an installable offline PWA.

## Working workflow

1. Load a spherical lens in the editor and open **Search Lab**. Capture its prescription. The preview focus shift is excluded: evaluation uses the stored image gap and infinity conjugate.
2. Edit specification/constraints, variable definitions and operands. JSON editors deliberately expose all numerical settings. `enabled: false` locks variables. R/t/stopPosition use mm; t can be glass thickness or an air gap. Iris translation changes both adjacent air gaps while preserving length; these gaps cannot simultaneously be independent variables. Bounds preserve radius sign. Scale defaults to bound width. Magnitude controls regenerate bounds around the captured base.
3. Optionally run **Sensitivity**. It evaluates baseline and ±1% of each enabled parameter's bound width, clipped at bounds. The report retains all metrics, finite-difference derivatives and merit deltas. HIGH/MEDIUM/LOW compares merit changes within this experiment; it is not a global sensitivity claim.
4. Start **Differential Evolution** or **uniform parameter exploration**. Select budget (10k/100k/1M/10M/custom), worker count, seed and independent runs. There is no Cartesian-product expansion and no 100k search cap. Counts must be safe integers. Population is 4–4096, worker count 1–64, archive 1–100, variables 1–64. These are memory/scheduling safeguards, not evaluation-budget limits.
5. Pause, resume, stop, export or restore. Editor access remains available using **Back to editor**. Configuration edits affect the next experiment, not the frozen active run.
6. Select elite candidates and optionally locally refine them (existing coordinate search, up to 600 extra evaluations each). Dense-validate before judging final performance or adopting. Compare 2–6 with actual traced meridional layouts, corner spots, optical metrics, merit contributions and parameter differences.
7. Adopt any dense-valid candidate as one undoable change. A candidate need not improve every metric: the user chooses the tradeoff. If the editor changed, adoption is blocked until the experiment base is explicitly loaded through its undoable button.

## Algorithm and reproducibility

`optimization/explorer.js` is a pure numerical API: `create`, `next`, `accept`, `evaluate`, `restore`, `parameters`, `prescription`, `sensitivity`. `evaluate(state, vector)` returns compact objective/metric data; dense evaluation also returns the prescription, spots and traced layout. Existing `LBAnalysis.evaluate(system, specification)` stays DOM-free.

DE uses **rand/1/bin** with forced crossover in at least one dimension, three distinct donors excluding the target, and reflected bounds. Whole-generation proposals use the previous population. Selection occurs in original candidate order after the entire batch returns, regardless of worker completion order. Uniform samples and initial DE populations use the stored Mulberry32 state. Seed must be an unsigned 32-bit integer. The first run includes the base vector; later runs use `seed + runIndex` modulo 2³² and independent initialization. Runs share a diverse archive, not their populations. Per-run budgets are approximately total budget / runs, rounded to complete batches; total evaluations never exceed the budget.

The DE mutation and deferred-update approach are consistent with the [SciPy algorithm documentation](https://docs.scipy.org/doc/scipy/reference/generated/scipy.optimize.differential_evolution.html). This is an independent JavaScript implementation, not a SciPy dependency or a claim of identical trajectories.

Same seed/configuration/engine and evaluation-based stopping produce the same trajectory independent of worker count (tested on 1 and 3 workers). Wall-time stops depend on hardware/load. Floating-point differences across JS engines/platforms remain possible. Saved metadata includes source SHA-256 and the Git parent at source stamping, not a fabricated final commit identifier.

## Evaluation tiers and numerical limits

- Geometry/material checks happen before real rays; invalid candidates cannot compensate through merit weights.
- Positive paraxial EFL/BFL and configured minimum BFL gate real tracing.
- Optional experimental coarse gate: fields 0/1, d-line and grid 5. It only rejects invalid analyses, never compares coarse scores to standard scores. Sampling can cause false rejection; off by default.
- Every surviving search candidate receives the configured standard multi-field/multi-wavelength analysis.
- Dense validation uses 19–41 pupil-grid-equivalent resolution, an independently distributed equal-area sunflower disk, default six fields and F/d/C plus additional configured fields/wavelengths. Dense and search scores are displayed separately. This is geometric resampling, **not independent external Zemax validation**.

The pupil model is still a paraxial entrance disk centered on a numerically aimed chief. Survival is not calibrated illumination, certified image-circle coverage or a T-stop. Hard coverage is represented only by per-field sampled ray survival. PSF/MTF/transmission remain unavailable. Lateral CA is chief-ray spread, LoCA is paraxial F–C BFL difference. No new wave-optical accuracy is claimed.

## Merit semantics

Existing target and range operands remain compatible. An explicit `type` supports:

| Type | Contribution |
|---|---|
| TARGET VALUE | weight × ((value − target)/scale)² |
| TARGET RANGE | squared distance outside [low, high], zero inside |
| MINIMUM | squared shortfall below target |
| MAXIMUM | squared excess above target |
| MINIMIZE | weight × value/scale |
| MAXIMIZE | −weight × value/scale |

Directional objectives are signed and monotonic, so total merit can be negative. For magnitude suppression of signed metrics (e.g. LoCA), use TARGET VALUE zero, not MINIMIZE. `scale` is positive normalization/tolerance, not an extra deadband; use a target range for that. Metrics: EFL, BFL, f-number, field RMS, worst signed distortion, lateral color, LoCA, ray loss and pupil survival. Deliberate nonzero corner RMS ranges are supported. The JSON editor currently requires a scalar `target` (use 0) even for directional operands.

## Archive and storage

The bounded elite archive ranks scalar merit and suppresses near-duplicates by RMS normalized parameter distance `(difference / bound width)`. It keeps a nearby candidate only if its score is better. This is **not a Pareto-front archive**; useful but worse-scoring tradeoffs may be discarded. Increase diversity/size or use different merit experiments for now. Full prescriptions are reconstructed from base + vector; millions of prescriptions are never stored. History is decimated to at most 2048 points.

IndexedDB stores named experiments atomically approximately every 10 seconds, at pause/stop and after validation. Checkpoints include base, variables, bounds, specification, operands, RNG, pending proposals, population/scores, archive, counters, history, rejection reasons, elapsed time and software provenance. Pause/stop drains the current batch. A crash can lose the interval since the last completed save plus an in-flight batch. A large population can increase this interval. Storage failure pauses search and tells the user to export. Browser eviction, device sleep and OS process termination are not prevented; export important experiments. No multi-day durability claim has been tested.

Restore checks schema/state/bounds; resume re-evaluates stored population/archive scores in workers before trusting them. Restored dense results are discarded until recomputed. Validation/refinement computations are separate from the main search budget; refinement counts are exported. Dense validation is manually requested after search, not periodically automatic.

## Current omissions

LHS/Sobol, CMA-ES, Pareto/crowding selection, adaptive promising-candidate promotion, automatic sensitivity→global→refinement pipelines, field-curvature/ray-fan/astigmatism analysis, glass/aperture/asphere variation, true image-coverage certification and from-scratch topology generation remain future increments. There is no ML or LLM component planned for any of them.

## Version 0.4: measurement laboratory

[Multi-aperture analysis](MULTI_APERTURE_ANALYSIS.md) adds aperture-specific and cross-aperture merit, a structured operand editor, numerical presets, common-scale comparison and JSON/CSV diagnostics. The original definition of distortion changed: see [investigation and equations](OPTICAL_METRICS.md). Checkpoint engine versions changed accordingly; prior score histories cannot be silently resumed. Geometric field-curvature/astigmatic diagnostics are now experimental, rather than entirely unavailable. Coma, diffraction, transmission and from-scratch generation remain unavailable. The above description of older limits is superseded where the new documents explicitly say so.
