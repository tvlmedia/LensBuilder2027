# Numerical lens design roadmap

Product rule: **no AI/LLM designer, natural-language design assistant, model inference or generative-AI dependency**. Codex develops the software; the finished application makes lens-search decisions using physics, constraints, objective measurements and seeded numerical algorithms.

Delivered: existing spherical-lens analysis/local optimization; Search Lab with parallel DE, uniform exploration, finite-difference sensitivity, multi-start seeds, diverse scalar-merit archive, persistent checkpoints, independent dense pupil resampling, comparison and adoption. See SEARCH_LAB.md for exact limits.

Next reliability gates:

1. External reference comparisons and real-pupil sampling/coverage verification. Extend benchmark/profiling and overnight storage/recovery testing across browsers; optimize intersection/refraction allocations only with equivalence tests.
2. Pareto archive/crowding, LHS/low-discrepancy sampling, adaptive coarse→fine promotion, automated refinement and richer graphical merit/parameter editing.
3. Ray fans, sagittal/tangential field curvature, astigmatism, improved chromatic analysis and pupil diagnostics. Keep unimplemented diffraction PSF/MTF unavailable.
4. Classical numerical DesignForms: Cooke Triplet, Double Gauss, Biotar-like and Sonnar-derived. Generate seeds, paraxially filter, globally search, locally refine and independently validate. No AI design decisions.
5. OMIT50 numerical target: 50 mm, geometric f/2, reference circle ≥46.3 mm, PL mechanical envelope, 52 mm flange distance, ≤8 elements. Flange distance must be modeled mechanically, not silently equated to BFL.
6. Measurable nonzero aberration ranges and aperture-dependent character, manufacturing/tolerance sensitivity and matched sets. No vintage image filters, invented T-stops or subjective LLM scoring.

A successful existing-prescription search is not evidence that arbitrary new lens topologies or production-ready cinema optics can already be generated.
