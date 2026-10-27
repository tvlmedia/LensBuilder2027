# OMIT50 Studio tournament — measured result

The default 1.0 tournament did **not** improve the historical OMIT50 lens. Cooke wins this finite new-character tournament, but that is not evidence that Cooke is intrinsically the best architecture.

## Reproduction

Run `npm run benchmark:studio`. Exact inputs and results: [machine report](../benchmarks/omit-studio-v1.json). The exact reference is `benchmarks/physical-omit50.json`, SHA-256 `ca4b7dafa2f81a9c8fd7b8c8a3437e55777726a46b12229686d681439e6adefe`. No historical prescription was used as a synthesis seed. Source fingerprint: `1786bc9296156d7dcb102ead1b21d138e03350db59c46201b2215ddea743dcd7`.

Four topologies × seeds 1001 and 2002; 16,384 maximum work units, 2,048 per run: 1,707 synthesis, 256 Block-DLS refinement, four refinement validations, 74 glass work units (two proposals, 32 local evaluations each), seven Studio validations. Same final grid (19), fields, wavelengths, apertures, brief and character operands. Runtime 40.119 s on darwin/arm64, Node v24.16.0; CLI runs sequentially for reproducibility, unlike browser worker scheduling. Runtime includes reference/validation/report preparation and is not an isolated throughput benchmark.

## Best fresh valid candidate per topology

All values below use the same Studio OMIT Signature objective, including f/2, 2.8, 4 and 5.6. RMS columns are f/2. Lower merit is better within this objective.

| Topology | Candidate | Studio merit | Center RMS µm | Edge RMS µm |
| --- | --- | ---: | ---: | ---: |
| cooke | cooke-1001-0 | 242.1540 | 67.5987 | 679.8704 |
| double-gauss | double-gauss-2002-0 | 506.7121 | 204.1322 | 568.1398 |
| modified-gauss | modified-gauss-1001-0 | 599.9797 | 121.3524 | 1062.6318 |
| sonnar | sonnar-1001-1 | 1096.6969 | 249.0612 | 893.3822 |

## Historical before/after

The historical prescription uses N-LAK22/N-SF10. The default Studio brief deliberately allows only N-BK7/N-F2; its Studio constraint gate therefore returns MATERIAL_INVALID. No same-brief Studio merit improvement is reported against that ineligible reference. Both prescriptions are instead independently remeasured with the original historical objective and sampling below. This is a descriptive comparison, **not a controlled optimizer comparison with identical glass freedom or development budget**.

| Historical objective / measurement | Exact historical reference | New tournament winner |
| --- | ---: | ---: |
| Dense merit | 211.6991817575 | 644.3055433819 |
| Center RMS f/2 µm | 97.3992 | 67.5987 |
| Mid-field RMS f/2 µm | 128.1984 | 240.0855 |
| Edge RMS f/2 µm | 309.6094 | 679.8704 |

Historical merit is reproduced exactly (211.6991817575039). The new winner is 204.35% worse under that merit definition. Its center is better, but its edge is substantially worse. Do not compare its Studio merit directly with historical merit.

## Actual measured costs

| Category | Objective attempts | Per-aperture analyses | Public trace API calls |
| --- | ---: | ---: | ---: |
| synthesis | 10912 | 9570 | 6259337 |
| validation | 124 | 496 | 2934456 |
| refinement | 2048 | 8176 | 5641440 |
| glass | 440 | 1395 | 1036613 |

Total objective attempts: 13524. Direct coarse analysis and rejected generation are separately recorded in the machine report. Counts are not equivalent to allocation work units or total rays. Equal maximum allocations were used; actual analyses differ because geometry rejects and early termination differ. This is **not an exact equal-actual-evaluation benchmark** and unused work was not redistributed.

## Prescription and limitations

Best new candidate: **cooke-1001-0**, 3 elements / 3 groups, N-BK7/N-F2. EFL 50.2778 mm, geometric f/2.0000, required image circle 46.3 mm. Full reproducible [engineering JSON](../benchmarks/omit-studio-winner.json), [CSV](../benchmarks/omit-studio-winner.csv), and [readable prescription](../benchmarks/omit-studio-winner.md).

All implemented hard constraints pass for the new winner. This does not mean it is optically well-corrected. Finite seeded exploration, the restrictive glass set, capped deterministic glass proposals, field aberrations and chromatic correction remain limitations. Physical FFT analysis was not part of this tournament; no new trusted f/2 MTF is claimed. Mechanical PL fit and manufacturing readiness remain UNVERIFIED.
