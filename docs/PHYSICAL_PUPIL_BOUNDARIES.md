# Physical pupil boundaries — Milestone 7 / 0.9.0

The optional **Forward pupil geometry** analysis maps sampled physical ray survival independently of inverse Newton convergence. It provides boundary evidence and explicit uncertainty; it does not certify a continuous pupil or make OMIT50 f/2 diffraction available. Enable it in the existing Wavefront / PSF / MTF panel. Default analysis remains compatible with 0.8.2.

## Coordinates and physical evidence

`physical/pupil-boundary.js` accepts a numerical forward-probe function. The real-lens adapter in `physical/wavefront.js` launches parallel incident rays at the same input plane and direction as the chief ray, traces every sequential surface with aperture clipping enabled, and projects surviving rays onto the existing reference sphere. It retains the actual optical path, including the incident wavefront contribution. It does not call inverse Newton to establish forward survival.

Four states remain distinct:

| State | Evidence |
| --- | --- |
| TRANSMITTED | Successful physical trace and reference-sphere projection |
| PHYSICALLY BLOCKED | Explicit aperture clipping, with compiled surface index, or total internal reflection outside the transmitted sequential path |
| NUMERICAL MAPPING FAILURE | Failed inverse solve, never a synonym for blocked |
| AMBIGUOUS / UNRESOLVED | Mixed boundary cells, invalid/missed forward geometry, projection failure, detected folds or multiple inverse roots |

A miss is conservatively unresolved. Blocking-surface counts refer to adaptively chosen samples, not flux percentages. TIR is not absorption; it blocks the modeled transmitted path. The current editor still describes coaxial spherical surfaces and circular mechanical apertures. Ring and disconnected analytical masks validate the generic detector, not new mechanical aperture formats in the editor.

## Adaptive method and limits

A dyadic quadtree starts at depth 4. Each cell shares nine cached probes with its neighbors. Refinement prioritizes state transitions, singular/fold evidence, unresolved traces, unwrapped OPD range and curvature of the reference-pupil mapping. Priority is scaled by cell width to avoid starving other coarse boundaries. A split is admitted only if all new probes fit the forward-ray budget. Generic maximum depth is 10 and the generic benchmark budget is capped at 300,000 probes. The real-lens UI offers 4,096, 8,192 and 16,384 probes; the API supports 1,089–32,768.

Transitions are returned as transmitted/blocked endpoint brackets, not a convex hull or a radial contour. No edges are joined across uncertain cells. This preserves sampled holes and separate islands. Local Jacobian orientation is checked using mapped triangles; inconsistent orientations across separate cells also mark the mapped region uncertain. This is a conservative fold detector, not a proof that every caustic or inverse branch has been found.

The default launch square is centered on the chief ray and has half-width 1.5 times the entrance-pupil radius. Transmission touching this square's edge withholds diffraction. Transmission observed outside the regular reference-pupil window also withholds diffraction. Neither test proves that distant unobserved islands are absent.

The footprint canvas shows **launch-plane** coordinates, not the reference-sphere FFT coordinates. Area is a sample-weighted estimate in mm². The unresolved fraction is the area of mixed/failed/ambiguous cells divided by this launch square. Homogeneous cells mean agreement of their probes, not a mathematical guarantee for every point inside them. Tiny sub-cell holes and islands can escape all finite probes. An interior mapped-area estimate excludes unresolved boundary cells and is not an energy/throughput integral.

## Integration with existing optics

The forward atlas supplies up to three spatially separated initial guesses near a failed regular-grid mapping. Each guess must independently converge and pass a fresh physical trace. Distinct converged roots remain ambiguous; one successful retry is not proof of global uniqueness. Existing successful inverse results are not replaced. No atlas cell is interpolated into an FFT mask, and failed coordinates are never treated as zero transmission to enable diffraction.

Retry work has a separate soft ray budget of four times the atlas budget, checked between coordinate retries. A retry already in progress can exceed that budget by one bounded group of at most three 24-iteration solves. Reported ray counts include this work. The forward atlas itself obeys its hard unique-probe budget.

The existing regular grid, reference sphere, fixed image plane, phase diagnostics, OPL, spectral registration, energy normalization and convergence criteria remain in use. The 0.25-wave phase limit is unchanged. Detected folds, ambiguous roots and incomplete mappings withhold PSF/MTF. With the optional forward atlas enabled, physical confidence remains EXPERIMENTAL even when regular-grid convergence passes. No nonuniform FFT, arbitrary pupil filling, per-field refocus, cloud computation or AI inference is introduced.

The additional retained and working memory estimates account for atlas samples. Numerical report export retains summary counts, settings, areas and uncertainty while omitting large point/cell/bracket arrays. Request export retains settings and recalculates on import. Wavefront reports use `reference-sphere-3`; the backward-compatible request envelope remains `physical-2`.

## Independent validation and measured outcomes

`tests/reference/pupil-shapes.cjs` supplies independent circular, decentered, elliptical, cat-eye intersection, annular and disconnected masks, analytical areas and closest-boundary distances. The ellipse distance is independently minimized on its analytical parameterization. Tests verify bracket midpoint distance, area error, classifications on a separate grid, retained holes/islands, deliberately failed inverse queries, multiple roots, singular mapping, physical clipping, resource limits and serialization. The physical browser-worker test also exercises the atlas path.

The complete measured tables are in [the Milestone 7 report](MILESTONE7_REPORT.md) and [the machine-readable benchmark](../benchmarks/pupil-boundaries-v1.json). Uniform 256² and 512² forward grids are compared with adaptive atlases at matching **maximum** ray budgets. Actual calls, timings, unresolved areas and cross-sampled disagreement are reported. The reference uses the same physical tracer on a separate grid, so real-lens agreement is numerical cross-validation, not independent validation of the lens model.

OMIT50 uses the unchanged serialized `benchmarks/physical-omit50.json`. At 512² the four phase differences remain 0.299766, 0.740699, 1.101581 and 1.692489 waves. All exceed 0.25. No transmitted samples are recovered in the measured OMIT50 configurations. At field 1 and 256², one failed mapping becomes independently established physical blocking; 512² failures remain unchanged. The useful result is quantified geometry and clipping evidence, not a new usable f/2 MTF.

Equal-budget adaptive sampling gives finer transition brackets but costs more wall time than the uniform forward grid. At the tested maximum depth, larger budgets largely refine OPD in the interior, so boundary uncertainty can plateau. There is no claimed overall speedup, proof of pupil completeness or phase-sampling breakthrough.

## Reproduction and next scientific work

```sh
npm test
npm run check
npm run audit:physical
npm run benchmark:diagnostics
npm run benchmark:physical
npm run benchmark:advanced
npm run benchmark:pupil
```

The pupil benchmark takes several minutes because it runs both old and atlas-assisted inverse sampling at 256² and 512² for four fields. Timings depend on CPU load and runtime; its memory value is a process snapshot, not measured peak memory. Historical benchmark files remain archived; new measurements must not be mistaken for their original provenance.

Next work should establish certified or independently bounded launch-domain completeness, continuation across inverse-map branches, better allocation between boundary and phase error, and reference-pupil quadrature with independently validated propagation. Increasing resolution or relaxing thresholds alone does not establish these properties.
