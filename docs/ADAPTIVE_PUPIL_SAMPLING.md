# Adaptive pupil sampling — 0.8.0

The production method is error-driven **uniform** refinement (32 → 64 → 128 → 256 → 512), bounded by an explicit maximum grid and memory budget. It stops only after independent finer-pupil and doubled-padding comparisons pass. The returned solution is the coarser member of the accepted pair; the finer reference is recorded in sampling history. Reaching the limit is NOT convergence.

Local diagnostics use unwrapped optical path differences, not differences of wrapped complex phases. Adjacent differences above 0.25 waves are unsafe. The engine records maximum gradient, second-difference curvature, unsafe-edge count and an orange phase-risk mask. A first-order power-of-two grid estimate is diagnostic only: it does not establish convergence or fix mapping/model errors.

Quadtree and boundary-only refinement were evaluated conceptually but are not used for the regular FFT: nonuniform samples require a validated quadrature/NUFFT or interpolation of the **unwrapped** wavefront and aperture. Adding samples near a boundary without correct area weights changes pupil amplitude. This milestone avoids introducing that unvalidated operation. No claim of locally adaptive FFT sampling is made.

The benchmark singlet needs 155,553 cumulative ray calls for automatic 32/64/128 analysis versus 473,911 for a single 256² pupil: 67.2% fewer mapping ray calls, with RMS 0.00977570 versus 0.00976824 waves. This compares ray counts, not equal end-to-end costs: the automatic path additionally performs convergence FFTs, and the single 256 grid is not independently certified. Difficult lenses may cost more because every level is recomputed.

Inverse mapping uses a chief-ray fallback, bounded Newton steps, residual-decreasing backtracking, determinant and Jacobian-condition checks, and explicit clipping. Failed coordinates remain invalid. At OMIT50 full field on 256², unresolved mappings fell from 28,914 to 26,140; none of the remaining failures are inside the nominal disk. This does not prove all outside failures are blocked: a distorted real pupil can extend outside the nominal paraxial disk. They still prevent diffraction eligibility. Robust retries also cost extra ray traces.

Limits: pupil ≤512², FFT ≤2048²; supported padding 2/4/8 subject to FFT size. The 512²/2048² mode requires raising the default memory budget to 768 MiB. Estimates include working and retained arrays but cannot guarantee browser RSS. A 1024² pupil is not enabled: the phase-only estimate already reaches 4096² at OMIT50's edge and neither a larger FFT nor pupil alone validates the high-NA model. Per-job geometry reuses entrance-pupil radius; no cross-prescription cache or approximate pupil fill is used.

See `benchmarks/advanced-mapping-probe.json`, `benchmarks/advanced-physical-v1.json` and [convergence](PHYSICAL_CONVERGENCE.md).
