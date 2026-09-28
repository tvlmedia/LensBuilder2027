# From-scratch numerical lens synthesis

Version 0.5 adds **NEW LENS → GENERATE & OPTIMIZE** to the existing editor. No input prescription, stored historical prescription, AI model or cloud service is used. Manual Design opens the existing editor workflow. [Reproducible experiments and measurements](SYNTHESIS_BENCHMARK.md) document what this implementation actually achieved.

## Workflow

1. Enter positive target EFL and tolerance, geometric f-number, image-circle diameter (or leave it blank and supply both sensor dimensions), construction and mechanical limits. An explicit circle must cover any supplied sensor diagonal. Maximum field height is **circle / 2**: Ø46.3 mm means 23.15 mm.
2. Select AUTO or a family. AUTO filters element/group/cementing constraints and weights seed allocation by speed, normalized field and BFL. It explores suitable families; it does not predict the best lens.
3. Inspect/edit analysis, verified glasses, fields/wavelengths/apertures and `TECHNICAL_BALANCED_v1` operands. Advanced JSON exposes aperture optimization/validation flags and weights, focus policy, rear envelope stations and budget fractions. Press Apply advanced specification after editing it. Changing controls does not modify a running/restored experiment.
4. Start. The funnel generates power-distributed seeds, repairs thickness where possible, solves first order, filters geometry/BFL, sizes apertures from unclipped real rays, traces a coarse bundle, and ranks surviving seeds. Diverse parents enter the existing DE engine. A bounded elite archive preserves family representatives, then the existing coordinate search refines those elites. This is a diverse **scalar-merit** archive, not a Pareto front.
5. Final candidates receive another real-ray aperture-sizing pass, another mechanical check, and independent dense multi-aperture resampling. Invalid finalists remain visible with rejection reasons. Not every run or specification yields a valid result.
6. Inspect prescription/bounds, checks, actual ray layout and multi-aperture metrics. Compare uses the existing measurement laboratory (spots, fans, pupil maps and experimental focus diagnostics). Adopt transfers the primary validated physical iris into the normal editor as one undoable change. Continue Search loads that candidate and constraints into Search Lab; disable individual variables in its parameter editor to lock radii/thicknesses/stop position, or all variables for an element. Geometry search keeps glass fixed.
7. Export the complete experiment JSON or the result-summary CSV. Normal editor Save/Copy JSON retains the adopted specification, provenance and validation metadata. The editor preview sensor remains independently configurable; its approximate preview is not the synthesis measurement.

## Specification and hard checks

Infinity conjugate, coaxial spherical surfaces, object/image media air. Min/max construction counts constrain topology selection; they are not instructions to insert arbitrary extra elements. The four current forms use fixed **counts** but generated dimensions, powers and bending.

Hard constraints cover finite geometry and material data; center and edge thickness; air clearance; spherical aperture feasibility; total first-vertex-to-image optical length; maximum diameter; rear diameter; allowed glasses/unique count; EFL tolerance; physical entrance-pupil f-number; minimum paraxial BFL **and minimum actual rear-vertex-to-image distance**; optional conservative rear envelope stations; and the configured sampled-ray survival at every required field/wavelength/aperture. Failures cannot be offset by a good merit score.

The BFL setting protects both paraxial focus and the common physical image plane during focus refinement. Flange distance is recorded separately: it does not locate an unspecified mount throat. Optional envelope stations have `{distanceFromImageMm, maxDiameterMm}`; each element's conservative axial/radial extent is checked, including the requested clearance. These are user-defined development constraints, not a certified PL mechanical drawing.

Field angles stay frozen at `atan(field × imageCircle / (2 × targetEFL))`. “Coverage” in the pass table means sampled pupil survival over those configured ideal-image fields. Distortion and sensor-plane mapping can change actual image heights. This is **not** a certified image circle or calibrated illumination test. A minimum survival of 0.7 permits clipping; raise it explicitly if required.

`DENSE VALIDATED` means the configured hard checks passed dense geometric sampling. It is not proof of sufficient resolution, manufacturability, a commercial prescription or technical correction. `VALID BUT OUTSIDE SPEC` and `INVALID` are failure distinctions; an interim hard-compliant search result is not yet dense-validated. Merit values have meaning only with their specific operands, weights and samples. PSF, MTF, T-stop, coating transmission, manufacturing cost and intentional Omit character remain unavailable.

## Budgets and performance

Quick/Medium/Deep/Extreme are 10k/100k/1M/10M **maximum funnel stage units**; custom safe-integer budgets start at 256. Each generated seed, coarse bundle, global/local objective evaluation or final dense candidate consumes one unit. Work per unit varies substantially; a dense candidate includes its aperture-footprint audit. `paraxialPassed` is a sub-count, not another charged evaluation. A seed can use multiple cheap matrix solves while repairing geometry.

Default allocation: 9% generated seeds, 9% coarse bundles, 62% global search, 18% local, 2% dense (with enough dense slots reserved for the archive). Unused capacity is not automatically spent: failed seeds, unavailable families, local convergence and the bounded archive can finish below the maximum. JSON exposes fractions and parents/archive sizes. Global budgets are divided across surviving parents. Local refinement is capped at 100,000 evaluations per elite. Stop records a completed batch and remains resumable.

The persistent worker pool runs DE and dense analysis. Seed generation and local refinement run in short main-thread chunks; expensive settings can still delay UI response. The supported large budget is not evidence of a completed 10M optical run or multi-day browser soak test. See the measured funnel benchmark.

## Persistence

The full stage/cursor, seed shortlist, generated prescriptions, RNG/DE population and pending batch, local optimizer, operands, allocations, counters, rejection buckets, archive, software metadata and dense results are serializable. IndexedDB saves approximately every three seconds at completed-step boundaries and on pause/stop/completion. Reload, open New Lens, choose a saved synthesis and Restore; it never silently starts calculating again. Import/export JSON provides an independent checkpoint copy.

Restore checks specification/allocation/topology hashes, counters and array bounds, restores the underlying optimizer, remeasures saved population/elite scores and recomputes saved dense results. Interrupted evaluation batches replay deterministically. Runtime timings and IDs need not match; numerical decisions do not depend on worker scheduling. Corrupted/incompatible checkpoints fail visibly. Hashes detect accidental changes, not hostile tampering.

Storage/quota/worker errors pause the UI with an export/recovery message. Large dense diagnostic archives can consume tens of MB. There is no durable browser background service: closing/suspending the browser pauses actual computation, and a crash can lose work since the last completed save. Additional interactive glass refinement is a separate budgeted operation; its final audit is saved, but an interrupted glass pass must be rerun from the last saved candidate.
