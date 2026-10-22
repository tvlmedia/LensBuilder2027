# Numerical lens design roadmap

Delivered: spherical analysis/local search; Search Lab with deterministic worker DE and checkpoints; multi-aperture measurement/fan/pupil/focus diagnostics; and [from-scratch synthesis](LENS_SYNTHESIS.md) with Cooke, Double Gauss, Modified Gauss and Sonnar-derived structural generators. No runtime AI, learned scoring or cloud design API is used.

The [synthesis benchmark](SYNTHESIS_BENCHMARK.md) demonstrates newly generated prescriptions and real numerical improvement. The 50 mm f/2 attempt is an experiment, not a production-ready technical or character lens.

Remaining gates:

1. Independent external optical-reference comparisons; real-pupil and image-coverage validation.
2. Eight distinct manufacturer-verified glass models and optional deterministic seed-pair exploration are now available. Further glass expansion, better power/bending strategies, sensitivity-driven search and improved correction of fast large-field lenses.
3. Explicit Pareto selection, richer variable-lock UI, improved budget redistribution and adaptive promotion.
4. Multi-day browser/storage soak tests and worker-based synthesis seed/local stages.
5. Supplied production mount envelope, tolerancing/manufacturability analysis and real transmission data.
6. Deliberate numerical Omit character targets and matched prime sets, only after the technical/measurement foundation is adequate.

Diffraction PSF/MTF is available under the documented scalar-model gates; T-stop, manufacturing cost and production certification remain unavailable.

Delivered in 0.5.2: bounded combined-displacement local refinement, deterministic synthesis checkpoint replay, and explicit dense-gated refinement of existing candidates. The [paired benchmark](GEOMETRY_REFINEMENT.md) measures modest algorithmic gains at equal extra budget; it does not close the optical-quality or external-validation gates.

Delivered in 0.5.3: whole-material glass substitutions with interface-power initialization and strict dense-incumbent acceptance. The [glass-family comparison](GLASS_FAMILY_REFINEMENT.md) improves two of three fixed parents without relaxing their two-glass constraint.

## Milestone 4 — 0.6.0 numerical optimization

- Independent meridional and skew Snell/Newton reference tracing; analytical thick lens and finite-height first-order checks, including pupils, negative power and stop relocation.
- Immutable seven-prescription optical suite, including the exact 0.5.3 OMIT50 and a deliberately defocused case.
- Normalized radius/curvature DLS with central differences, derivative stability and pupil-discontinuity checks, coupled steps, damping and explicit schema-versioned iteration checkpoints.
- Equal-budget coordinate/pattern/DE/DLS/hybrid/multistart/block/weight-continuation experiments across three seeds; machine-readable JSON/CSV and convergence histories.
- Optional spherical-zonal, even-fan coma, astigmatism and field-curvature residuals; verified-glass partial-dispersion diagnostics and audited glass/geometry alternation.
- Focused New Lens method selector and refinement diagnostics; existing synthesis and Search Lab protocols preserved.

See [optical validation](OPTICAL_VALIDATION.md), [methods and limitations](OPTIMIZATION_METHODS.md) and [measured comparisons](OPTIMIZATION_BENCHMARKS.md). Active-constraint derivatives remain conservative, DLS is sequential, and multi-stage refinement has no mid-phase checkpoint. Physical aperture-opening continuation, symmetry/group-power coordinates, rigorous pupil mapping, diffraction PSF/MTF, transmission and fabrication tolerance analysis remain future work. Geometric improvement is not a production-lens certification.

## Milestone 5 — 0.7.0: physical image quality

Implemented independent OPL checks, reference-sphere eikonal mapping, sampled OPD, ANSI/OSA Zernike fits, scalar monochromatic FFT PSF, direct sampled Strehl/energy, complex OTF/PTF and directional MTF. A dedicated finalist worker/UI supports common-focus field/aperture/wavelength sweeps and candidate comparison. Restricted on-axis scalar/paraxial status requires per-prescription convergence. See [physical image quality](PHYSICAL_IMAGE_QUALITY.md) and [validation](DIFFRACTION_VALIDATION.md).

Off-axis diffraction and discrete global-focus diagnostics remain experimental. Combined polychromatic PSF/MTF, quantitative pupil apodization, finite conjugates, high-NA vector diffraction, T-stop and MTF merit operands remain unavailable. OMIT50 f/2 is unresolved at the supported grid limit; no reliable f/2 MTF is claimed. Future work must validate these extensions before production badges or optimization integration.


Delivered in 0.8.0: [bounded error-driven sampling](ADAPTIVE_PUPIL_SAMPLING.md), robust inverse mapping, 512² pupils / 2048² FFT, [registered spectral intensity](POLYCHROMATIC_PSF_MTF.md), stronger convergence and separate numerical/physical confidence. [Milestone 6 report](MILESTONE6_REPORT.md) records the remaining OMIT50 f/2 limitations. Next scientific gates are reliable distorted-pupil boundaries, independently validated oblique-plane propagation and integrated spectral references. MTF-based optimization stays unavailable until those relevant gates pass.

Delivered in 0.8.1: complete convergence comparison history, explicit resource-limit stop reasons and failed-mapping retry diagnostics. No expansion of the validated physical regime.
