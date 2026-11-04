# OMIT50 optimization challenge — v1.1

## Result

Newly generated Cooke case **cooke-direct-2002** reaches merit **191.71823128235255**, **9.44% lower** than the exact historical reference. The best reoptimized reference is **reference-direct-2002**, merit **211.0679652144112**, 0.30% lower. Lower merit is better under this frozen objective; this is not a general image-quality percentage.

| Prescription | Dense merit | Center RMS µm | Mid RMS µm | Edge RMS µm | Signed longitudinal color mm | Min f/2 sampled survival |
|---|---:|---:|---:|---:|---:|---:|
| reference | 211.6992 | 97.399 | 128.198 | 309.609 | -0.178354 | 97.18% |
| refined | 211.0680 | 99.704 | 123.982 | 305.492 | -0.178439 | 97.18% |
| new | 191.7182 | 96.927 | 96.110 | 290.156 | -0.212714 | 82.39% |

The new winner improves all three reported RMS measurements, edge astigmatism (2.22148 → 1.29883 mm) and edge lateral chief color (0.007359 → 0.004766 mm), but worsens absolute paraxial longitudinal color (0.178354 → 0.212714 mm). Its lower ray survival means part of the RMS advantage can depend on clipping; the original 70% minimum was preserved, not tightened or relaxed. This is not evidence of an unvignetted 46.3 mm usable image circle. The reoptimized historical lens slightly worsens center RMS while improving the aggregate objective.

Fresh 19-grid re-evaluation reproduced every finalist score exactly. Independent 23-grid sunflower holdout: reference 211.2511556942161, refined 210.62758394745666, new 192.94246683010118; all pass original hard constraints. Holdout was used after selection, not to tune the winner.

## Equal-budget comparison

Two deterministic seeds (1001, 2002), five sources, two strategies: **20 completed runs, each exactly 10,000 counted evaluations**, 200,000 total. No failed/incomplete run is omitted. Wall time 26.27 minutes on darwin/arm64, Node v24.16.0, two workers. Runtime is machine/load dependent. Full per-stage costs, ray API counts, elapsed times, acceptance history, seed rejection counts and contracts are in [the report](../benchmarks/omit50-challenge-v1.json).

| Source/topology/strategy | Valid/total | Best merit | Median merit |
|---|---:|---:|---:|
| generated/cooke/aperture-continuation | 2/2 | 212.1080 | 217.1562 |
| generated/cooke/direct | 2/2 | 191.7182 | 259.2879 |
| generated/double-gauss/aperture-continuation | 2/2 | 223.5308 | 243.8209 |
| generated/double-gauss/direct | 2/2 | 229.6182 | 241.9564 |
| generated/modified-gauss/aperture-continuation | 2/2 | 309.4006 | 323.3437 |
| generated/modified-gauss/direct | 2/2 | 303.4606 | 308.5475 |
| reference/modified-gauss/aperture-continuation | 2/2 | 211.0720 | 211.1661 |
| reference/modified-gauss/direct | 2/2 | 211.0680 | 211.1065 |
| generated/sonnar/aperture-continuation | 2/2 | 556.9121 | 635.2366 |
| generated/sonnar/direct | 2/2 | 510.7771 | 567.7361 |

With only two seeds, the median is the average of the two values, not a robust population estimate. Cooke direct wins the best-case comparison but its median is worse than Cooke continuation. Continuation is not uniformly superior; modified Gauss and Sonnar favor direct search in this experiment. Reference warm starts include historical development effort, which is not charged as fresh-design work.

## Frozen contract

The reference prescription is [physical-omit50.json](../benchmarks/physical-omit50.json), not the older system embedded in the optical suite. Specification and all 48 operands come from the suite's omit50 case: EFL 50 ±1 mm; geometric f/2 ±0.02; requested circle 46.3 mm; 3–8 elements, 3–6 groups, at most two glass types; BFL and rear image clearance at least 25 mm; maximum length 140 mm, element diameter 70 mm, rear diameter 60 mm; minimum center 1 mm, edge 0.5 mm, air gap and mechanical clearance 0.2 mm. PL flange 52 mm is separate and does not certify mount compatibility.

Verified catalog: N-BK7, N-F2, N-LAK22, N-SK16, N-SF6, N-SF10, N-BAK4, N-PK52A. Fields 0, .3, .5, .7, .85, 1; F/d/C weights 1/2/1; apertures 2, 2.8, 4, 5.6. Search grid 7, dense validation 19 sunflower. Late search uses dense sampling, without modifying the final merit. Global image-plane variable; no per-field refocus to hide aberrations.

One outer Explorer/Merit request or standalone optical analysis counts once; nested per-aperture analyses are reported separately, not double-counted. Failed geometry attempts invoked through the objective still count. Seed generation/paraxial rejection and tracing costs are tracked separately. Equal objective counts are not equal CPU/ray costs. Reload verification is reported as additional overhead. Final rechecks and physical/sensitivity diagnostics are outside the optimization budget.

## Prescriptions and diagnostics

- [Best new prescription](../benchmarks/omit50-challenge-new.json): three elements/three groups, N-LAK22/N-SF10. Full surfaces, apertures, image gap, operands and validation included.
- [Best refined prescription](../benchmarks/omit50-challenge-refined.json).
- [Post-selection diagnostics](../benchmarks/omit50-challenge-analysis.json): holdout, per-variable sensitivities, multi-aperture metrics and twelve physical configurations.

Central-difference sensitivities use ±0.1% of each parameter's allowed span and include invalid-probe flags. Among valid probes for the new winner, front radius R1 and the final image gap are strong local edge-RMS sensitivities; R3 strongly affects edge astigmatism. These derivatives describe the whole coupled system, not unique per-surface Seidel contributions. Existing DLS/block-DLS Jacobians provide sensitivity-based optimization. Clipped-pupil Zernike fits remain experimental; there is no certified spherical/coma decomposition.

Physical engine: three prescriptions × f/2 and f/5.6 × field 0 and 1, pupil 64 with maximum 128, convergence enabled. **PSF/MTF unavailable in all twelve configurations** under unchanged reliability gates. f/2 wavefront remains experimental. No MTF inferred from RMS, no trusted experimental MTF objective, no T-stop or manufacturing claim.

## Reproduce

Run from repository root with Node 20+:

```sh
npm test
npm run check
# Full archived comparison (~26 minutes on the recorded machine):
LB_CHALLENGE_BUDGET=10000 LB_CHALLENGE_WORKERS=2 npm run benchmark:challenge
npm run analyze:challenge
npm run benchmark:seed-quality
# Smaller deterministic development comparison (one pair, 2048 each):
LB_CHALLENGE_FILTER=reference LB_CHALLENGE_SEEDS=1001 LB_CHALLENGE_REPORT=/tmp/omit50-smoke.json npm run benchmark:challenge
# Resume matching saved contracts after interruption:
LB_CHALLENGE_BUDGET=10000 LB_CHALLENGE_RESUME=1 npm run benchmark:challenge
```

Checkpoints are written after bounded phases to /tmp/lensbuilder-m9-checkpoints; choose a persistent directory with LB_CHALLENGE_CHECKPOINTS for long searches. Use separate directories for different budgets. Completed checkpoints are reverified on resume. 10k/100k/1m budgets are supported; 100k/1m were not run in this release. Normal tests use small budgets. Browser total budget is divided among all topology/seed/reference runs.

Report source fingerprint records the benchmark source, not necessarily the final UI patch. After this run the first refinement epoch was capped at 2048 for responsiveness at large budgets; this leaves all recorded 10,000-budget runs unchanged (their first epoch is 1500). The final UI/report tooling changes do not change optical definitions.
