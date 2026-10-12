# Numerical optimization methods (0.6.0)

## What changes, and what stays compatible

The original radius-based coordinate search, pattern extrapolation, differential evolution, synthesis funnel, worker protocol and saved states retain their algorithms and versions. New Lens adds an optional geometry-refinement method selector. The default remains the existing pattern search. DLS and hybrid refinement must pass intermediate and dense validation before replacing a candidate. A new numerical experiment API and CLI compare methods on frozen inputs; no LLM, remote inference or external numerical dependency is used.

`optimization/dls.js` adds `bounded-dls-1`, a damped Gauss–Newton least-squares solver. This is not a claim of equivalence to a commercial optical-design optimizer.

## Coordinates and objective

All design variables are normalized into [0,1] using the **same fixed physical bounds**. Radius and curvature representations are compared; curvature=1/R with sorted inverse bounds. Thickness, air gaps, stop displacement and image gap use linear normalization by their individual allowed interval. Radius bounds cannot cross zero. Stop displacement changes the two adjacent air gaps by equal and opposite amounts. Projection clips trial coordinates to those bounds, followed by all existing real geometry, pupil, glass and mechanical checks. Negligible floating-point cancellation when rebasing an iris exactly on its bound is allowed; genuine out-of-bounds displacement is rejected.

For each enabled squared merit operand, residual = sqrt(aperture weight × operand weight) × target error / scale. The squared residual norm reproduces the existing merit, including cross-aperture CHANGE/RATIO, ranges, minimum and maximum operands. Linear MINIMIZE/MAXIMIZE operands are explicitly unsupported by DLS; the old solvers still support them. Field and aperture weights remain individually inspectable in the merit JSON. Original full-spec OMIT50 comparisons use **exactly the archived operands**, without additional aberration penalties.

Optional operands `sphericalZonal`, `comaEven`, `astigmatism` and `fieldCurvature` request diagnostics automatically. Coma-even is the mean tangential fan error at ±0.8 pupil minus the chief error at zero pupil, in mm, at d wavelength. It distinguishes the even fan component from odd spherical/defocus terms, but also contains higher-order even aberrations: **not a Seidel coma coefficient**. Spherical-zonal is the mean on-axis axial intercept at ±0.8 pupil minus the d paraxial focus. Missing/clipped zones are unavailable, never replaced with zero. Astigmatism and field curvature use the existing least-variance ray planes. The sensitivity report covers these plus center/edge RMS, longitudinal/lateral CA, distortion and ray loss. Different aberration residuals can be weighted independently without inventing a universal quality score.

## Derivatives and damping

For each normalized variable, evaluate central differences at h and h/2 (initial h=1e-4). Derivatives are accepted only when both pairs are physically valid, preserve the exact sampled pupil-survivor identities and agree within a relative norm tolerance of 0.15. Up to four successively smaller step sizes are attempted (divide h by four). This stability tolerance is a numerical derivative safeguard, not an optical acceptance threshold. At an exact parameter bound, or when all probes fail, the column is frozen rather than inventing a derivative. This is conservative and can stall on active constraints.

Report column norms, rejected/insensitive columns, pairwise cosine coupling above 0.98, column-norm ratio and damped elimination-pivot ratio. These are **conditioning indicators, not a spectral condition number**. The finite-difference evaluation count and wall time are reported separately.

The coupled update solves `(JᵀJ + λ diag(max(diag(JᵀJ), maxdiag × 1e-8))) Δ = −Jᵀr` with pivoted elimination. Bound projection and a normalized Euclidean step cap (0.08) limit movement. Accept only a valid lower **actual original merit**, then divide λ by three; otherwise multiply λ by five and retry, up to ten trials. Failed rays and geometry are not smoothed into fictitious residuals. The ray-loss residual is piecewise constant with a fixed pupil mask; its derivative is only trusted in that fixed-mask region. Actual trial merit and final validation still penalize ray loss.

All objective calls count, including invalid perturbations, derivative stability probes and repeated initialization at a stage boundary. No derivatives are free. Early termination is disclosed rather than filling the budget with artificial calls.

## Compared search strategies

| Method | Definition |
| --- | --- |
| coordinate | Original bounded coordinate search |
| pattern | Original coordinate search plus successful-sweep extrapolation |
| de | Existing deferred-generation DE, population 24, mutation 0.7, crossover 0.9 |
| dls-radius / dls-curvature | Same DLS solver, different normalized R / 1/R coordinates |
| hybrid | 35% of objective budget for DE, then DLS from its best feasible elite, within the original bounds |
| multistart | Three DLS allocations, deterministic bounded perturbations around the incumbent, amplitude ±0.04 normalized; retry invalid starts up to eight times, count every probe |
| block-dls | Four alternating coupled curvature+focus and spacing+stop+focus blocks, bounds frozen to the original design |
| continuation | First 30% with residual weights reduced to 0.1 for outer fields and apertures faster than f/4, then original weights. Full physical constraints and full ray tracing remain active throughout |

Continuation here investigates **weight continuation**. It does not implement an aperture-opening homotopy or physically narrower-field search. It cannot certify a relaxed specification: final selection always uses the original full objective and sampling. Group-power and symmetry coordinates and adaptive DE mutation remain unimplemented; radius/curvature and coupled blocks are the measured parameterization investigations.

## Glass and geometry

The verified eight distinct SCHOTT dispersion models remain the catalog. N-BK7HT does not create a ninth distinct model. `synthesis/chromatic.js` exposes exact modeled Abbe and relative partial dispersion PgF=(ng−nF)/(nF−nC), plus thin-contact-achromat primary/secondary color-power diagnostics. These estimates are not used as a substitute for real-ray ranking of separated/cemented groups.

Existing single-element and whole-material-family substitutions preserve surface power where possible, recalculate first order, reoptimize geometry and freshly validate each viable trial. `synthesis/alternation.js` investigates repeated geometry→glass cycles, retains the best validated incumbent, and adds an intermediate-sampling acceptance gate. Every trial remains in the history. Its additional per-trial glass budgets are **not** included in or compared as though equal to the fixed geometry experiment budget; legacy glass counters mix cheap paraxial checks and objective calls, and are labeled accordingly.

## Validation, reproducibility and checkpoints

Every paired experiment has the same start, bounds, catalog, full constraints, operands, search grid and final sunflower validation grid. Four separately counted validation evaluations cover before/after intermediate (15-point regular disk) and before/after final dense sampling (the archived 19-point sunflower disk). Both must improve; otherwise the baseline is retained. Search never overwrites frozen benchmark inputs. Additional 25/31/41 sampling checks diagnose remaining convergence error without silently changing the archived final criterion.

Deterministic coordinate/pattern/DLS methods ignore the seed; their repeats are not independent stochastic replicates. DE and restart draws use the existing deterministic PRNG. Worker evaluation results return in proposal order; 1/2/4 worker comparisons are tested. DLS is sequential; no claim of parallel DLS scaling is made.

DLS state uses schemaVersion=1 and engineVersion=`bounded-dls-1`, independent of legacy checkpoint versions. Checkpoints are taken at **completed iteration boundaries**. Resume checks bounds, metadata, normalized mapping, current residual vector and pupil signature by reevaluation; incompatible versions are rejected. That integrity reevaluation is administrative work, not an additional optimizer step. The experiment's multi-stage orchestration and glass cycles are not resumable midway through a phase; their completed audit histories are serializable. Existing Search Lab and synthesis pause/resume are unchanged. The UI refinement call is an atomic additional operation, as in earlier geometry refinement.

## Running experiments

`npm run benchmark:methods` runs all seven cases, nine methods and seeds 1001/1002/1003. Default per-case budgets: OMIT50=3000, analytical singlet=300, others=1000. Optional environment variables `LB_CASES`, `LB_METHODS`, `LB_SEEDS`, `LB_BUDGET`, `LB_REPORT` select a reproducible subset/output path. JSON stores exact configurations, source/fixture/catalog hashes, inputs by immutable fixture ID, prescriptions, histories, diagnostics and numerical results. CSV contains one row per run. Run `node tools/benchmark-optical-diagnostics.cjs` separately for warmed throughput, worker ordering, sensitivity and sampling checks. No quality labels or production thresholds are inferred from merit alone.
