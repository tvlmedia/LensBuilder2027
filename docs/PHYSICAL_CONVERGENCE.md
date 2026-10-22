# Physical convergence — 0.8.0

Numerical convergence and physical validity are separate fields. A numerical PASS cannot validate an unsupported optical approximation. Failures remain visible: MAPPING FAILURE, INSUFFICIENT SAMPLING, NOT CONVERGED or INVALID. A PSF is withheld when pupil mapping or local phase sampling is unresolved.

Two comparisons are required: double the pupil grid at fixed padding, and double Fourier padding at fixed pupil. Compare energy distribution L1, centroid, RMS width, peak density, direct Strehl where defined, encircled energy and tangential/sagittal MTF at 20/40/80 lp/mm. RMS wavefront and first-Airy-radius energy also retain their previous checks. If a requested frequency is outside the sampled range it cannot pass.

Default maximum errors: MTF 0.02, Strehl 0.02, EE 0.02, L1 0.05, centroid 0.25 coarse pixels, relative width 0.05 and relative peak 0.05. RMS wavefront tolerance is 0.001 waves + 2% of the fine RMS. Configured tolerances may tighten these defaults, not loosen them. Phase changes must remain ≤0.25 waves per adjacent pupil sample. Parseval relative error is reported independently at 1e-10 tolerance.

L1 uses the coarse physical image window after conservative resampling. Centroid and width use a common disk of radius max(50 µm, five nominal Airy radii). Full-plane Airy second moments diverge; comparing RMS widths over different FFT extents would not be a meaningful convergence test. The amount of fine energy outside the comparison window is separately bounded.

At the maximum pupil grid without a finer reference, convergence remains unproven. Padding 8 cannot be doubled to 16 by this implementation and does not produce a padding PASS. Memory rejection is likewise not numerical failure evidence about the lens: the requested test was not completed.

Workers report channel progress and run all expensive computations off the UI thread. Cancellation terminates the worker; a 120-second UI timeout bounds each candidate. Large output PSF/OTF buffers are transferred. Batch retained-result estimates are capped at 192 MiB; per-job memory budgets are explicit and the common spectral grid has its own bound. Browser overhead and GC make actual process memory different from estimates.

`npm run benchmark:advanced` records mapping time/ray counts, combined OPD sampling, PSF and MTF timings, spectral integration, memory snapshots and the OMIT challenge. OPD time is included in wavefront sampling, not separately instrumented. The process memory snapshot is **not** a measured peak; no peak-memory or universal performance guarantee is claimed. No global optical cache is used.

For reproduction use `npm test`, `npm run check`, `npm run benchmark:advanced` and `npm run audit:physical`. Historical 0.7 reference data remains in `physical-quality-v1.json`; new measurements are in `advanced-physical-v1.json`. Build metadata identifies source by SHA-256 plus recorded Git parent, since embedding a commit's own hash would change that commit.

## 0.8.1: retained evidence and explicit termination

`convergenceComparisons` retains every executed pupil/padding comparison even when later refinement reaches its grid or memory limit. `samplingTermination` distinguishes CONVERGED, PUPIL_LIMIT, REFERENCE_UNAVAILABLE, VERIFICATION_DISABLED, UNRESOLVED_PUPIL, UNRESOLVED_REFERENCE and AUTOMATIC_REFINEMENT_DISABLED. Grid-limit records include the evaluated grid, required next reference and configured maximum.

`convergence` still describes the accepted/current comparison only; it is deliberately null when the returned finer result has no independent finer reference. Historical comparisons are never reused to assign a success badge to another grid. The UI shows numerical status, model status and stop reason together; exported reports retain the full comparison history.

Inverse-mapping backtrack counts and maximum Jacobian-condition diagnostics now include failed and blocked attempts, rather than successful rays only. The old zero counts in some 0.8.0 reports therefore understated solver work. This is a diagnostic correction: missing samples stay invalid, optical values and eligibility criteria are unchanged.

`npm run benchmark:diagnostics` rechecks all 16 archived OMIT50 field/aperture configurations and asserts exact RMS/PV and status agreement against 0.8.0. Evidence is saved in `benchmarks/physical-diagnostics-v1.json`. Four additional tests cover exhausted grids, memory-blocked references, successful/disabled verification and failed-mapping diagnostics. The complete suite now has 161 passing tests.

## 0.8.2: inspectable acceptance criteria

Every PSF comparison now records individual `checks`: metric, measured difference, maximum allowed difference, unit and PASS/FAIL/NOT APPLICABLE. Tangential and sagittal MTF are reported separately at 20/40/80 lp/mm; each encircled-energy radius has its own check. Wavefront RMS and first-Airy-radius checks are also exposed. `failureReasons` identifies the failing PSF metrics.

A missing required measurement is stored as null plus FAIL and an explicit reason, preserving its meaning through JSON export. It is never converted into zero error. A direct spectral Strehl that is not defined is NOT APPLICABLE, not a manufactured successful measurement. All existing acceptance thresholds remain unchanged, with regression tests comparing the decomposed decision to the previous combined rule.

The UI's “Convergence checks and stopping limits” section presents readable tables for each retained pupil and padding comparison. A group heading summarizes that table's own checks, not unrelated checks. Integrated spectral reports include each wavelength's numerical and physical status and termination reason, so a passing spectral-padding comparison cannot conceal an unconverged contributing channel.

Browser example: the f/16 singlet's 32²→64² comparison has L1 difference 0.055519 against a 0.05 limit, while its RMS, peak, MTF and other displayed checks pass. With maximum pupil64, a required128 reference is unavailable and the result stays NOT CONVERGED. The f/32 spectral example identifies 550 nm as unconverged even though the combined padding comparison passes.

Validation: 165 passing tests, unchanged RMS/PV/eligibility in all 16 archived OMIT50 configurations, and zero merit deviation across all 189 geometric prescriptions. Browser tests covered failed monochromatic and mixed-convergence spectral tables without console errors.
