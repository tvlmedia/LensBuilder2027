# Design tournaments

Each selected Cooke, Double Gauss, Modified Double Gauss or Sonnar topology runs once per deterministic seed. Seeds generate independent prescriptions through the existing generators, not rescaled historical designs. All runs share a hashed contract: brief, merit, glass restrictions, hard constraints, final sampling and stage allocations. Worker scheduling cannot transfer budget between runs.

## Budget contract

The input is a **maximum work-unit allocation**, not a promise of identical executed ray traces. Divide the total by topology×seed count, floor it, and leave any remainder unallocated. Each run reserves:

- Configured refinement objective budget and up to four independent refinement validations.
- If glass search is enabled, `2 + proposals × (localBudget + 4)` work units for parent/proposal/geometry/validation work.
- Seven Studio validations: up to four archived candidates, refinement return, glass return and final incumbent.
- The remaining allocation (at least 256) goes to existing synthesis: seed construction/paraxial filtering, coarse analyses, global DE, local search and dense archive validation.

All architectures have identical maxima. Geometry rejection, missing proposals and early convergence can leave work unused. **This is not an exact equal-actual-evaluation benchmark.** A cheaper or failed path does not receive redistributed work. Compare scores with the reported costs; do not infer intrinsic superiority or a general runtime advantage from this finite experiment.

## Actual counters

Counters are worker-local and collected at the reused engine boundaries:

- `objectiveCalls`: outer Explorer/Merit requests, including Explorer geometry rejection. Nested Merit calls inside Explorer are counted once. Direct coarse analyses are counted under `analysisCalls`, not invented objective calls.
- `analysisCalls`: existing per-aperture analysis calls. One multi-aperture objective may produce several calls or fail before analysis.
- `traceApiCalls`: public `LBOptics.trace` invocations. Internal tracer calls captured in closures are not included; this is **not total rays**.
- `paraxialCalls`: public first-order API invocations.
- `elapsedMs`: time per category in the worker; includes any configured cooperative yield. Parallel worker time is not wall-clock runtime.

Categories are synthesis, refinement, glass and validation. Dense Explorer calls are attributed to validation even inside synthesis/glass; intermediate refinement validation is also attributed to validation through an optional phase notification. Reload verification uses a separate `checkpointVerification` category and does not consume/steal another run's search allocation. Synthesis seed/coarse/global/local/dense work counts are retained independently of objective counts. Do not subtract objective calls from work-unit allocation as if they were the same unit.

## Acceptance and execution

Synthesis → dense archive → chosen numerical refinement → bounded glass proposals → final independent validation. The incumbent is replaced only when the new dense merit is lower and all Studio hard constraints pass. The current implementation refines the best valid parent per run; it does not fully refine every archived candidate. Physical FFT calculations never enter the geometric objective.

DE, normalized radius/curvature DLS, Block-DLS and existing geometry pattern refinement are selectable. Glass proposals reuse the existing deterministic substitution order, capped by configured count. The cap is a resource policy and may leave promising materials untested.

Up to eight workers run independent topology/seed jobs. Pause is cooperative between bounded phases, preserving checkpoints and cost totals. Actual throughput depends on core count, design complexity, clipping and aperture count. Large user-selected budgets can still take substantial time.

Reproduce the default OMIT50 experiment with `npm run benchmark:studio`; optionally set `LB_STUDIO_BUDGET`. Reports record exact input, source fingerprint, prescription hash, runtime platform, per-topology winners, counts and limitations. See [results](OMIT_STUDIO_BENCHMARK.md).
