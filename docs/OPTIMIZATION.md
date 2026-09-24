# Existing-lens optimization

Open **Analyze / Auto Optimize**. Defaults are based on current EFL, f-number and sensor diagonal. Preview rendering pauses to keep interaction responsive. Choose bounded radii/thicknesses/air gaps; a separate plane iris in air can translate by compensating the gaps on either side. Unselected parameters and all materials/apertures remain fixed. Radius bounds cannot cross zero. The image gap is selected initially, so the first run provides a multi-field image-plane adjustment. Select radii and other spacings for lens-shape optimization.

The implemented algorithm is deterministic bounded coordinate pattern search. It evaluates both signed steps for each parameter, accepts improvements, and halves normalized steps after a sweep without improvement. It has a finite evaluation budget and minimum step; it is a local search and cannot guarantee a global optimum. Integer seed is recorded for experiment identity; no random numbers occur in objective evaluation/search.

A candidate with violated hard constraints has infinite merit. Every accepted result must also improve on a separate denser grid (2n+1, capped at 41). This reduces sampling artifacts; it does not replace independent optical-software validation or prove manufacturing quality. The result table exposes regressions in individual measurements even when total merit improves.

Workers support pause/resume/stop. State includes input, specification, operand definitions, variable bounds, current vector, sweep cursor, step, score, evaluation count, convergence history and version. Autosave is browser-origin storage at progress updates (at most ~500 ms between posts plus one evaluation); storage errors are visible. Export checkpoints for durable backups. Restoring validates schema and recomputes the saved merit. A refreshed browser can restore autosave and resume. For a completed checkpoint, **Stop & validate** reconstructs the before/after result. No claim is made that closed tabs continue computing.

Adoption is explicit and one undo transaction. It resets preview focus offsets and disables automatic refocus. Adoption is blocked if the editor changed since the run, to preserve newer edits. Native JSON includes the adopted run/settings/validation in `project`. Failed/high-grid-regressing candidates cannot be adopted through the result button.

Not implemented: global search, autonomous starting architecture generation, glass selection, Pareto archive, manufacturing yield, matched prime sets, multi-configuration optimization or character inference. Existing zoom editing/import metadata is retained but excluded from optimization.

Experiment metadata includes engine version, a source SHA-256 fingerprint and the Git base commit at stamping time. `node tools/build-info.cjs` refreshes `build-info.js` after source changes; the base commit is labelled as a parent, not falsely claimed as the final release commit.
