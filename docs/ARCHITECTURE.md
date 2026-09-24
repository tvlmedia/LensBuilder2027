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
