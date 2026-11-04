# Optical design development — v1.1

## Published foundation

Phase A completed before v1.1 work: PR #7 merged with history into feat/validated-lens-optimization as **012c9e65aea2a4f5e8d787d0410b47c016ac5f8e**. [Pages deployment 40553047781](https://github.com/tvlmedia/LensBuilder2027/actions/runs/40553047781) succeeded. The actual [live site](https://tvlmedia.github.io/LensBuilder2027/) showed VERSION 1.0; 51 runtime assets matched the validated source byte-for-byte. Studio completed 16 finalists in its browser smoke, New Lens produced 8 candidates, Search Lab completed 64/64 valid evaluations, and relative workers loaded under /LensBuilder2027/ without console errors. Baseline: 194 tests, 189 geometric references with zero delta, 16 physical configurations with exact RMS/PV/status agreement.

v1.1 development starts from that publication commit on feat/optical-design-breakthrough. It is proposed by PR only; no automatic merge or Pages deployment.

## Why the old tournament was weaker

Exact historical merit 211.6991817575039 was reproduced before algorithm changes. It has six elements/four groups using N-LAK22 and N-SF10. The v1.0 Studio default used only N-BK7/N-F2, different character operands (80 rather than the historical 48), and 15 mm rear/BFL assumptions instead of 25 mm. Thus its reported ~644 result was not a controlled optical comparison. Its per-run generation allocation was about 1707 synthesis units plus 256 refinement and bounded glass work, whereas the historical specification had a 100,000-unit search and subsequent refinement experiments. Those historical units are not retrospectively equated to the new measured objective counts; complete cumulative historical development cost is unknown. Glass restrictions, initialization and budget matter alongside optimization strategy.

## Changes

1. Optional achromatic-v1 seed power balancing solves the thin-element total power and first-order chromatic power balance with actual verified crown/flint Abbe data. Existing topology geometry, bending, stop and symmetry generation, thick/paraxial screening and physical rejection remain in use. No historical prescription is scaled/copied; legacy-v1 remains unchanged.
2. Physical aperture/field continuation progresses f/4 → 2.8 → 2.4 → 2 with field diameter fractions .5, .7, .85, 1 for the f/2 task. Final full-frame multi-aperture merit and hard constraints remain exact. Both dense and intermediate validation protect the incumbent.
3. Controlled orchestration composes existing DE generation, bounded pattern search, block-DLS, multi-start, catalog glass substitution with geometry compensation, and late dense basin probes. One independently revalidated incumbent per run; no worse replacement. The original synthesis archive retains diverse initial parents. No new learned scores, dispersion data or optical metric definitions.
4. Actual objective accounting includes standalone coarse analysis, refinement, glass and validation. Checkpoints preserve deterministic state and counters; restored candidates must be reverified. Large searches are split into bounded phases, with a first refinement cap of 2048.
5. Studio adds the exact historical benchmark preset, original-reference comparison, seed policy and controlled direct/continuation selectors. Existing histories, convergence, character analysis and engineering export remain. OMIT Signature stays separate from the historical objective, with no invented cinematic score.

## Seed experiment

Each row uses 128 generation attempts, original physical constraints and coarse three-field analysis. Same attempts, not equal ray-work; rejected seeds are recorded. RMS sum is a coarse diagnostic in mm, not the historical merit. Improved feasibility does not guarantee lower final optical error.

| Topology | Seed | Policy | Paraxial pass | Coarse valid | Median RMS sum mm | Median absolute LCA mm |
|---|---:|---|---:|---:|---:|---:|
| cooke | 1001 | legacy-v1 | 118 | 21 | 5.589 | 0.1871 |
| cooke | 1001 | achromatic-v1 | 123 | 41 | 5.552 | 0.0845 |
| double-gauss | 1001 | legacy-v1 | 46 | 16 | 4.329 | 0.3498 |
| double-gauss | 1001 | achromatic-v1 | 114 | 77 | 3.188 | 0.1630 |
| modified-gauss | 1001 | legacy-v1 | 52 | 20 | 3.547 | 0.1561 |
| modified-gauss | 1001 | achromatic-v1 | 110 | 69 | 3.203 | 0.1951 |
| sonnar | 1001 | legacy-v1 | 29 | 7 | 5.077 | 0.2456 |
| sonnar | 1001 | achromatic-v1 | 97 | 55 | 5.214 | 0.1538 |
| cooke | 2002 | legacy-v1 | 113 | 17 | 5.021 | 0.1950 |
| cooke | 2002 | achromatic-v1 | 123 | 46 | 5.740 | 0.0969 |
| double-gauss | 2002 | legacy-v1 | 43 | 12 | 4.637 | 0.2610 |
| double-gauss | 2002 | achromatic-v1 | 119 | 79 | 3.172 | 0.1264 |
| modified-gauss | 2002 | legacy-v1 | 44 | 19 | 4.315 | 0.2458 |
| modified-gauss | 2002 | achromatic-v1 | 115 | 82 | 3.137 | 0.1476 |
| sonnar | 2002 | legacy-v1 | 32 | 11 | 4.854 | 0.1919 |
| sonnar | 2002 | achromatic-v1 | 104 | 55 | 5.027 | 0.1220 |

Full provenance/costs/rejections: [seed-quality-v1.json](../benchmarks/seed-quality-v1.json). Improvement is strongest in feasible Gauss yield. Some topology/seed metrics worsen; the policy remains explicitly experimental rather than replacing legacy initialization.

## Validation and scope

See [the challenge report](OMIT50_OPTIMIZATION_CHALLENGE.md) for all 20 equal-budget runs, best/median results, prescriptions and tradeoffs. Regression gates cover unchanged legacy seed replay, continuation's final contract, hard constraints, exact accounting including glass, incumbent monotonicity, deterministic resume, corrupt checkpoints, real worker imports and the saved winner's fresh dense/holdout validation. Physical thresholds remain unchanged.

Remaining work: more independent seeds; external optical-reference validation; better throughput/coverage objectives alongside merit; chromatic correction without sacrificing edge performance; convergence-valid diffraction at practical sampling; robust tolerancing, mechanics and transmission data. The three-element winner is a feasible numerical prescription, not a manufactured or mount-certified cinema lens. An exploratory fixed-aperture local probe was not incorporated into this release or the controlled leaderboard.

## Final release verification (2026-10-29)

- 206/206 automated tests passed; JavaScript syntax checks passed.
- 189 historical geometric prescriptions rechecked: maximum dense-merit difference 0.
- 16 physical reference configurations: exact RMS, PV and status equality. Existing baseline files retained unchanged.
- Local browser under `/LensBuilder2027/`: controlled historical preset loaded through relative asset paths; two workers completed generated/reference runs at exactly 1024 evaluations each. Pause at a stable checkpoint, page reload, unverified-result gating and resume succeeded. Two reloads incurred four separately displayed verification calls, total 2052 = 2048 search + 4 verification. Reference smoke merit 211.3979; generated Modified Gauss smoke 502.2160. These small runs are not the 10k leaderboard.
- Finalist physical worker completed with experimental wavefront and unavailable PSF/MTF, preserving reasons in the UI. Engineering export view opened with the selected finalist. No browser console errors.
- Phase A live Studio/New Lens/Search Lab results are recorded above. v1.1 remains a review branch; the actual live release remains v1.0.
