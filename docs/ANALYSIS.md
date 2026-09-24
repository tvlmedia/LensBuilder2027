# Objective analysis

`LBAnalysis.evaluate(prescription, specification)` returns status, explicit failures, first-order metrics, wavelength/field ray distributions, field summaries and limitations. Browser execution is in a worker.

Default fields are 0, .3, .5, .7, .85, 1 of the reference image radius; angles are frozen using `atan(field * referenceCircle/2 / targetEFL)`. F/d/C wavelengths use weights 1/2/1. This is an infinity-conjugate specification. The reference circle defines angular sampling; it is **not a certified usable image-circle result**.

Each wavelength uses a deterministic grid clipped to a disk at the paraxial entrance pupil, centered on a numerically stop-aimed chief. The disk is a paraxial launch approximation. It can undersample aberrated pupil edges and cannot certify high-NA illumination. The fraction of surviving launch samples is reported as pupil survival, not transmission. Misses, TIR and clipped rays count as lost samples. A minimum per-field/per-wavelength ray fraction is a hard constraint.

Spot RMS is computed from real image-plane intercepts about their centroid. Polychromatic RMS uses fixed spectral/launch weights and retains chromatic centroid offsets. Tables also expose tangential/sagittal standard deviations, maximum geometric radius and wavelength-resolved hits.

Distortion is the d-line chief-height error relative to EFL*tan(fieldAngle) at the prescribed image plane. Away from best focus this includes image-plane placement effects; it is not automatically evaluated at best focus. Lateral color is maximum chief-height separation among sampled wavelengths; longitudinal color is F−C **paraxial** BFL difference. This is not full longitudinal aberration of marginal rays.

MTF, diffraction PSF, field-curvature profiles, pupil-weighted radiometry and real-ray longitudinal color are unavailable. The existing chart preview is labelled approximate/experimental and never supplies merit values. It retains deterministic seeded jitter for repeatability.
