# Incremental architecture

The original HTML/CSS/editor remains the application. Plain script modules expose browser globals and CommonJS exports; there are no runtime packages or bundling requirements.

- `materials/catalog.js`: material models, provenance and canonical wavelengths.
- `optics/core.js`: shared geometry/refraction plus independent forward sequential/matrix evaluation.
- `analysis/evaluate.js`: deterministic bundles and measured field summaries.
- `design/merit.js`: configurable normalized operands.
- `optimization/search.js`: pure checkpointable local search.
- `optimization/worker.js`: browser scheduling and message protocol.
- `import/report.js`, `import/zemax.js`: compatibility and extracted importer.
- `ui/history.js`: bounded prescription history, ignores derived vertex caches.
- `ui/designer.js`: integrated analysis/optimization dialog, before/after tables and spots, checkpoint controls.
- `script.js`: preserved surface editor, focus, drawing, preview and persistence. Numerical primitives/materials/importer delegate to the above modules.

`window.LensBuilder` is the explicit editor boundary: snapshot, load, adopt, undo/redo, sensor, preview and importer. Objective evaluations use cloned prescription data, never DOM state. Checkpoints omit nested prior project records to prevent unbounded experiment nesting.

Native prescription JSON schema 2 is backward compatible with unversioned prescriptions. New metadata retains project, import report and surface capabilities. Future schema versions are rejected. Existing save/copy controls remain; optimizer offers additional experiment/checkpoint exports. Sensor dimensions are recorded through the reference circle in the analysis spec, while original sensor UI persistence remains unchanged.

## Numerical Search Lab extension

- `optimization/explorer.js`: seeded DE/uniform/sensitivity, compact vectors, scalar/diverse archive, deterministic batch coordinator, state validation and dense resampling.
- `optimization/evaluation-worker.js`, `optimization/pool.js`: persistent evaluators, base/config transfer once, bounded vector batches, errors and shutdown.
- `optimization/refine-worker.js`: local refinement in a separate worker, followed by standard and dense analysis.
- `ui/experiments.js`: atomic IndexedDB experiment storage.
- `ui/search-lab.js`: Search Lab configuration, run lifecycle, throttled progress, saved experiments, selected candidate comparisons and guarded adoption.

Generation bookkeeping happens on the main thread; expensive evaluation and refinement do not. No runtime dependencies or AI services are added. [Search Lab](SEARCH_LAB.md) documents algorithm, persistence and scientific limits.

Version 0.4 adds `analysis/aberrations.js` (pure diagnostic algebra/fans/status), `analysis/multi-aperture.js` (physical iris settings and evaluation composition) and `ui/measurement-lab.js` (aperture/merit controls, plots/presets/exports). The worker pool and parameter search architecture are retained; the evaluator visits required apertures and short-circuits safe failures.

## From-scratch synthesis (0.5)

`synthesis/forms.js`, `specification.js`, `seeds.js` and `physics.js` supply structural families, normalized requirements, deterministic power-derived prescriptions, physical iris solving and additional hard constraints. `synthesis/engine.js` is a checkpointable stage coordinator using the existing DE, coordinate search and evaluator pool. `synthesis/glass.js` performs explicit single-glass trials with reoptimization. `ui/synthesis.js` adds the New Lens entry point, persistence and candidate workflow. No original optimizer is replaced.

Only specifications carrying `synthesis` invoke the new pre-merit physical constraint/iris solve. Legacy Search Lab measurements retain their existing behavior. Global/dense evaluations use the existing workers; synthesis seed/local stages yield in small main-thread chunks. Adoption suppresses intermediate table/history records and preserves validated apertures and seed metadata. `LBSearchLab.loadGenerated` is the explicit bridge for continuing a generated design.
