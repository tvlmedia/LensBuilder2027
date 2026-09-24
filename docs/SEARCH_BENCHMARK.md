# Search throughput measurements

Measured on the current development machine, Node v24.16.0, 2026-09-24. `npm run benchmark:search` uses the **actual evaluation-worker implementation** through a small Node worker_threads adapter. It does not emulate CPU work, skip ray tracing or substitute a simpler merit. The browser UI also displays its own measured run rate.

512 seeded image-gap variations of the bundled Biotar; 13 physical surfaces, six fields, F/d/C, grid9, 1242 sampled rays/candidate. All 512 valid. Workers are initialized and warmed with 32 candidates before timed measurement. Startup/warmup is reported separately in [raw measurements](search-benchmark.json).

| Workers | Evaluations/s | Sampled rays/s | Wall ms/candidate |
|---:|---:|---:|---:|
| 1 | 289.4 | 359,423 | 3.456 |
| 2 | 550.6 | 683,798 | 1.816 |
| 4 | 1018.7 | 1,265,171 | 0.982 |

These are hardware/workload-dependent sample measurements, not performance guarantees. Wall ms/candidate with parallel workers is aggregate throughput, not individual candidate latency. Chief-ray aiming rays are additional work and excluded from the sampled-ray numerator. Node/browser scheduling, other applications, lens complexity, clipping and different analysis settings all affect speed. A browser smoke run measured about 650 eval/s with two workers; after resume with four workers the cumulative rate changed, as expected.

The original 25-analysis baseline before this phase was 3.81 ms/evaluation in the main Node context. This small-run measurement is not directly comparable to pooled throughput, which includes worker messaging and compact-result transport. A first prototype benchmark used a Node VM sandbox and imposed severe artificial overhead; it was discarded. The retained harness executes bundled modules normally in worker threads.

## Profile and changes

In a separate 64-candidate instrumented pass, total 232.4 ms: public real-ray trace calls consumed 207.7 ms inclusive (~89%); chief aiming 11.1 ms (~5%); material indices 0.39 ms; validated surface compilation 0.77 ms; geometry validation 0.73 ms. Timings overlap and instrumentation itself costs time. Surface intersections/Snell are included in tracing; allocations/GC and main-thread rendering were not independently quantified. No unsupported speedup claim is made for those subcategories.

Changes retain the same optics: validate once and compile each unique wavelength once per candidate; reuse paraxial results across fields; cache immutable pupil coordinates; clone just the surface records when materializing a parameter vector; transfer the base/configuration once per worker and vectors in small batches. Search replies omit full spot clouds; only explicitly dense-validated elites retain them. Progress paints at most twice per second. The traced arithmetic is unchanged and analytical regression tests still pass.

The current bottleneck is ray tracing, not glass lookup. A future typed-array/SIMD/WASM kernel should first have equivalence tests for sphere roots, grazing rays, TIR, clipping and aiming. Increasing worker count is the measured throughput improvement in this increment.

## Validation performed

All 46 automated tests pass. Tests include analytical optical invariants, shifted sphere and Rosenbrock minimization, hard bounds and iris motion, sensitivity derivatives, seed replay, JSON pending-batch resume, worker-count invariance, rejection statistics, archive diversity, stop conditions, dense sampling and worker errors. Browser checks include parallel search, dense validation, IndexedDB save, reload/restore, resume and stop after batch, local refinement, comparison, adoption and undo. The browser restored at 12,352 evaluations and continued beyond 29,000. No claim of a completed 1M/10M optical run or multi-day soak test is made.

A second workload, an N-BK7 thick singlet with six fields, F/d/C and grid9, measured 1,402 / 2,639 / 4,580 eval/s with 1 / 2 / 4 workers (512 valid candidates each). Separate warm microbenchmarks measured approximately 0.00029 ms per surface-record candidate clone, 0.00005 ms per cached pupil lookup and 0.00107 ms for merit-only scoring. These isolate tiny operations and should not be interpreted as end-to-end speedups.
