# From-scratch synthesis benchmark and validation

Measured 2026-09-28T10:04:13.662Z on Node v24.16.0. No input prescription was supplied to any experiment. All use seed 1001, four persistent evaluation workers, verified N-BK7/N-F2, six fields and F/d/C. Full specifications, every retained prescription, hard checks and aperture/field metrics are in [synthesis-benchmark.json](synthesis-benchmark.json).

Run `npm run benchmark:synthesis -- --omit` to reproduce the three targets. Timings depend on the host; numerical results are deterministic. The raw sourceCommit records the clean baseline at process start with workingTree:true; implementation was subsequently committed on the synthesis feature branch.

## Measured results

| Target | Budget | Dense-valid candidates | EFL mm | f/ | BFL mm | Actual rear-to-image mm | Center / edge RMS µm | Initial → search → dense merit |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| COOKE_VALIDATION · Ø30 | 10000 | 4 | 50.006 | 4.000 | 39.050 | 38.200 | 29.297 / 88.300 | 48.055 → 13.742 → 13.774 |
| DOUBLE_GAUSS_VALIDATION · Ø36 | 10000 | 4 | 50.000 | 2.800 | 28.219 | 26.712 | 66.749 / 173.892 | 430.354 → 44.569 → 50.404 |
| OMIT50_TECHNICAL_FOUNDATION · Ø46.3 | 100000 | 4 | 49.918 | 2.000 | 29.037 | 26.575 | 165.973 / 450.499 | 3346.812 → 404.471 → 456.914 |

Cooke validates at f/4 and f/5.6; Double Gauss at f/2.8 and f/5.6. The harder AUTO run validates f/2, f/2.8, f/4 and f/5.6. Search uses pupil grid 7; final resampling uses independent fourfold sunflower grid 19 plus the aperture-footprint audit. Initial merit is that of the selected generated parent under the full search objective; search and dense scores have different sampling and are intentionally shown separately. Neither score is a universal lens-quality rating.

## OMIT50 technical attempt

The strongest dense objective result is a generated Modified Gauss, six elements/four groups. It meets the declared 50 ±1 mm EFL, f/2, 25 mm minimum paraxial BFL and actual rear-to-image clearance, size/geometry/material constraints and sampled survival over the Ø46.3 mm ideal-field configuration. PL-oriented flange distance 52 mm is recorded separately; no production throat envelope was supplied.

At f/2, worst sampled survival across configured fields is 97.18%; maximum chief lateral-color span 5.625 µm; paraxial F−C BFL -0.270 mm; maximum distortion magnitude 1.846%. Center/edge RMS are 165.973 / 450.499 µm.

**The technically well-corrected cinema-lens goal is not achieved by this attempt.** The hard-compliant geometric candidates are preserved, but center and outer-field RMS remain too large to present this as a finished technical lens. No deliberate Omit character was optimized. The narrow two-model glass subset and bounded search are limitations; this run does not prove the target impossible.

The final AUTO funnel generated 9000 seeds; 2222 passed cheap filters, 2222 entered coarse tracing, 62000 global objective evaluations and 16646 local evaluations were consumed, and 8 finalists were audited. Stage rejection counts:

```json
{
  "COARSE": {
    "INVALID_EDGE_THICKNESS": 618,
    "COARSE_COVERAGE_FAILURE": 1003
  },
  "SEEDS": {
    "APERTURE_FAILURE": 1572,
    "BFL_TOO_SHORT": 5196,
    "POWER_DISTRIBUTION": 10
  },
  "GLOBAL": {
    "EFL_OUT_OF_RANGE": 27457,
    "INVALID_EDGE_THICKNESS": 13366,
    "AIR_CLEARANCE": 239,
    "ray survival or chief failure": 22,
    "IMAGE_PLANE_CLEARANCE": 1179,
    "BFL_TOO_SHORT": 147
  },
  "DENSE": {
    "DENSE_INVALID_EDGE_THICKNESS": 2,
    "DENSE_AIR_CLEARANCE": 2
  }
}
```

Minimum BFL and spherical-aperture feasibility block many initial seeds. EFL drift and edge thickness dominate global rejections. Final enlarged aperture checks reject additional edge/air-clearance failures. These counts are observed outcomes, not theoretical lower bounds.

## Funnel throughput

| Target | Seeds + paraxial filter / s | Coarse bundles / s | Global objective attempts / s, 4 workers | Local objective / s | Final audit ms / candidate |
|---|---:|---:|---:|---:|---:|
| COOKE_VALIDATION | 37204.283 | 2225.484 | 6465.927 | 539.053 | 30.002 |
| DOUBLE_GAUSS_VALIDATION | 27869.492 | 1898.533 | 4465.884 | 377.115 | 41.634 |
| OMIT50_TECHNICAL_FOUNDATION | 41522.781 | 1961.920 | 1491.695 | 176.564 | 52.329 |

Global attempts include cheap hard-constraint rejections, so those rates must not be interpreted as full raytraces per second. Dense averages also include candidates rejected by final aperture geometry. Coarse units include sizing and rejection checks. Local refinement runs in bounded main-thread chunks.

A separate warmed, **all-valid** Cooke two-aperture evaluation batch (128 evaluations) measured 390.047 eval/s with 1 worker(s) and 1130.033 eval/s with 4 worker(s). The isolated precompiled paraxial matrix microbenchmark measured 7727800.887 calculations/s over 100,000 calls; it excludes generation, compilation, material lookup and geometry checks.

No million/ten-million optical run or multi-day soak is claimed. Arbitrary user specifications may yield zero survivors. Broader verified materials, stronger seed priors and externally referenced optical validation remain future work.
