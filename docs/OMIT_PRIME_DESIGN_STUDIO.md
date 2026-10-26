# OMIT Prime Design Studio — 1.0

Open **NEW PROJECT · OMIT Studio** in the main toolbar. All computation stays in local browser workers. The studio orchestrates the existing synthesis, geometry, glass and physical engines; it adds no ray tracer, AI or cloud computation.

## Workflow

1. **Design brief:** start from OMIT 50 Full Frame. Review EFL/tolerance, f-number, circle, elements/groups, dimensions, verified glass list, thickness, air gaps, rear clearance and mount notes. Complete brief JSON exposes wavelengths, mechanical-envelope stations and the remaining construction policies. Apply JSON before editing individual fields.
2. **Generate candidates:** choose architectures, deterministic seeds (one independent run per topology/seed), total work allocation, workers and refinement method. Each run can contribute up to four dense finalists. Set character targets before starting.
3. **Design tournament:** create and run. Compare measured candidates, stage progress, actual calls, elapsed time, remaining synthesis allocation and dense convergence. Pause finishes the current bounded phase. Resume continues its saved state.
4. **Optical refinement:** inspect accepted/rejected changes and stage costs. The existing refinement engine requires independent improvement; Studio additionally enforces the brief's front diameter and separate rear-distance constraints.
5. **Character analysis:** edit explicit merit operands and inspect the selected finalist across fields and apertures. Presets are optimization choices, not appearance predictions.
6. **Final validation:** select a finalist, inspect its optical layout and constraints, adopt it as one editor undo transaction, or run physical analysis. The detailed existing Wavefront/PSF/MTF panel remains available.
7. **Engineering export:** download JSON, CSV and a readable Markdown report for the selected finalist.

## Starting assumptions

OMIT 50 uses 50 mm, f/2, 46.3 mm required image circle, at most eight elements and six groups, spherical surfaces and intended PL mount with 52 mm flange distance. Initial editable assumptions include 140 mm optical length including image gap, 70 mm maximum/front diameter, 60 mm rear diameter, 15 mm optical BFL and rear vertex–sensor clearance, 1 mm center thickness, 0.5 mm edge thickness, 0.2 mm air gap and N-BK7/N-F2 with at most two glass types. They are not established mechanical requirements. The glass catalog can be changed before starting.

**Flange focal distance is not BFL.** Optical BFL, rear vertex–sensor distance and flange metadata are separate. Envelope stations can restrict available diameter by distance from the image plane. Without flange position, barrel and mount geometry, PL compatibility remains unverified.

## Projects and history

Save uses the existing local IndexedDB checkpoint store. Download checkpoints for portable backups; browser storage can be cleared externally. A running project's brief, operands and budgets are frozen. Editing form fields does not rewrite existing candidates: **Create project & run tournament** creates a new contract. Save/Resume preserves the existing contract. Duplicate copies the brief/settings/targets into a fresh project with no consumed work or results.

Reload/import removes trusted ranking badges and physical reports. **Resume / verify** recomputes geometric validity and scores before adoption/export; rerun physical analysis when needed. Extra verification work is recorded separately. Checkpoints retain prescriptions, topology, seed, counts, refinement history and software/build provenance. Cooperative pause preserves a completed bounded phase; an abrupt worker/browser crash may lose work since the last checkpoint. A synthesis checkpoint resumes deterministically; refinement/glass phases are atomic and have no mid-phase checkpoint.

## Validation language

- **DENSE VALIDATED:** current independent dense sampling has a finite merit and passes all implemented hard geometry/construction/material/EFL/aperture/field-survival constraints. It does not mean good optical correction.
- **INVALID:** one or more numerical or brief constraints failed. It cannot be ranked/adopted/exported as a finalist.
- **PAUSED / UNVERIFIED:** saved or incomplete work; reverify before relying on results.
- **Geometric feasibility PASS:** implemented checks passed at sampled conditions. Required image-circle coverage is sampled ray survival, not a continuous coverage or transmission certificate.
- **Optical correction:** inspect actual RMS, color, distortion and merit breakdown against the desired limits. No blanket quality certification.
- **Mechanical UNVERIFIED / Manufacturing UNVERIFIED:** no mount fit, barrel, tolerance, fabrication or assembly qualification.

Physical status labels are inherited unchanged. `VALIDATED` OPL and `VALIDATED EIKONAL / SAMPLED PUPIL` wavefront do not validate the diffraction approximation. `UNAVAILABLE` PSF/MTF means insufficient numerical convergence or unsupported conditions; no estimate is substituted. Experimental pupil/off-axis/clipped-pupil metrics remain experimental. See [physical validity](PHYSICAL_IMAGE_QUALITY.md), [adaptive sampling](ADAPTIVE_PUPIL_SAMPLING.md) and [pupil boundaries](PHYSICAL_PUPIL_BOUNDARIES.md).

See [tournament accounting](DESIGN_TOURNAMENT.md), [character presets](OMIT_CHARACTER_PRESETS.md), [exports](ENGINEERING_EXPORT.md) and [measured OMIT50 results](OMIT_STUDIO_BENCHMARK.md).
