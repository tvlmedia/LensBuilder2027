# Engineering export

Select a freshly validated finalist in **Final validation**, then open **Engineering export**. Download three complementary files:

- **JSON** (`omit-engineering-1`): authoritative complete package containing prescription, verified glass catalog records and dispersion model coefficients, clear semi-apertures, stop, first-order specifications, required image circle, wavelengths, multi-aperture geometric measurements, merit breakdown, hard checks, original brief/targets/settings, per-stage costs, refinement history, software/build fingerprint and any physical reports computed for this finalist.
- **CSV**: surface and field/aperture performance records with explicit mm/µm/percent units. `record` identifies the row type. Empty cells mean not applicable. This convenient table is not the full reproducibility package.
- **Markdown report**: readable prescription/specifications/performance/constraints and limitations. Consult accompanying JSON for full dispersion models and physical numerical details.

Clear aperture is reported as **semi-aperture**, not diameter. Optical length includes the last-surface/image gap. Requested image circle is labeled sampled coverage; it is not a certified usable circle. No T-stop, production tolerance, barrel dimensions, coatings, ghost/flare prediction or manufacturing readiness is inferred.

Physical results retain their original per-metric status and convergence information. If physical analysis was not run, the report says NOT RUN. If it did not converge or its model does not support a trusted result, PSF/MTF remains UNAVAILABLE. Imported projects must be geometrically reverified and physical reports recomputed before relying on them.

All exports are **research engineering packages, not manufacturing-ready prescriptions**. PL intent and 52 mm flange metadata do not establish mount compatibility. Mechanical and manufacturing verification remain separate work.

To keep checkpoints and exports practical, Studio retains measured field/aperture statistics and optical-layout rays, but omits bulk per-ray `rows`/`hits` arrays. Recompute raw samples with the existing analysis engine from the exported prescription and settings when needed. This compaction does not change measured metrics.
