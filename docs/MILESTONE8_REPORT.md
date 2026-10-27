# Milestone 8 release validation — 1.0.0

## Baseline and scope

Started from published `feat/validated-lens-optimization` commit `4a326271344339a06e33913f82c5cbbbf70b2cfc`. GitHub PRs #1–#6 are merged; #3–#6 were explicitly rechecked before publishing this branch. Development branch: `feat/omit-prime-design-studio`. No history rewrite, optical metric redefinition or new physics engine.

The release adds the seven-stage Studio, original-brief contracts, four topology families, deterministic independent seeds, bounded refinement/glass integration, actual cost accounting, editable multi-aperture character targets, numerical finalist tables/layouts, separate physical analysis, checkpoint lifecycle, adopt/undo and JSON/CSV/Markdown engineering export. See the dedicated workflow, tournament, character and export documents.

## Automated verification

- Full suite: **194 passed**, including the original 178 and 16 Studio tests.
- JavaScript syntax checks: pass.
- Geometric regression audit: **189 serialized prescriptions**, maximum absolute dense-merit difference **0**, before/after physical analysis.
- Physical diagnostics regression: **16 reference configurations**, exact RMS/PV and status agreement. All three diagnostic termination examples retained.
- Full physical benchmark completed, including the OMIT50 unsupported/unresolved cases and tracing throughput diagnostics; no scientific status upgrades were introduced.
- Default Studio benchmark: eight runs, four architectures, 16,384 maximum work units, 13,524 actual objective attempts plus separately counted coarse analyses/generation. Detailed costs, exact inputs, winners and limitations are committed.
- GitHub Pages subpath imports: automated path checks and actual browser worker execution under `/LensBuilder2027/`.

## Browser smoke tests (2026-10-26)

Local production-style path: `http://localhost:8081/LensBuilder2027/`.

- Studio f/4, 30 mm circle, f/4+5.6, four architectures, seed 1001, 2,048 maximum units, two workers: **16 valid finalists**, best dense merit **35.8044**. This is a functional test, separate from the full-frame f/2 challenge.
- Pause at a stable checkpoint, save, reload and resume: passed. Completed project reloaded and independently reverified with unchanged winner/merits. Verification adds separately reported work; no cached badge is blindly trusted.
- Candidate numerical tables, dense convergence and optical layout rendered. Character operands regenerated for custom apertures.
- Adoption changed the editor; one undo restored every surface input/select value exactly.
- Finalist physical worker completed at f/4. Wavefront retained its sampled-eikonal label; unresolved PSF/MTF displayed **UNAVAILABLE**, with phase-sampling/model limitations. Detailed-panel bridge loaded the finalist correctly.
- Existing physical f/16 singlet: numerical **CONVERGED**, **VALIDATED SCALAR/PARAXIAL REGIME**, wavefront RMS 0.0097757 waves, direct sampled Strehl 0.99623.
- Existing New Lens: 256-unit budget, two workers, eight dense candidates; best dense merit **79.7410**, matching prior publication smoke result.
- Existing Search Lab: **64/64 evaluations**, 64 valid, two workers; completed successfully.
- Engineering JSON/CSV/Markdown buttons exercised; serializer contents, glass models, units and invalid-result refusal tested automatically.
- No browser console errors. Existing editor autofocus/clip warnings occurred on the initially restored user lens; they are not Studio worker failures.

## Optical result and release boundaries

[OMIT50 tournament report](OMIT_STUDIO_BENCHMARK.md): Cooke is the best new Studio candidate, but its historical-objective merit is **644.305543381911**, versus **211.6991817575039** for the exact historical reference. Center RMS improves; edge RMS worsens substantially. Different allowed glass sets make this a descriptive before/after, not a controlled optimizer superiority claim. No optical breakthrough or production-ready lens is claimed.

Physical MTF remains unavailable when convergence/model conditions fail; no estimated replacement, T-stop or manufacturing tolerance is introduced. Mechanical PL fit and manufacturing readiness remain unverified. Budgets are equal maxima, not equal actual ray/analysis work. Cancellation waits for a bounded phase; no mid-refinement checkpoint exists.

The branch is prepared for review. This milestone does **not** merge or deploy automatically; the live publication stays on v0.9.0 until a reviewed release is merged and deployed.
