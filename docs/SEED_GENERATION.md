# Numerical seed generation

Inputs are a normalized NewLensSpecification, family ID and integer ordinal. A Mulberry32 stream combines the user seed, ordinal and family index. It is deterministic bounded random sampling, not LHS/Sobol or an exhaustive Cartesian enumeration.

1. Select representative verified crown/flint glasses by Abbe number (>50 / <50). Draw signed relative powers with positive outer and negative inner roles.
2. Select front curvature/bending; derive the next curvature using the thin-element starting approximation `power = (n_d - 1) × (c_front - c_rear)`. This is a *seed construction rule*. Actual system power always comes from the complete thick-element reduced-angle matrix, including cemented interfaces and separations.
3. Create real thicknesses and gaps scaled to the focal-length request, plus a separate air iris. Gauss halves are mirrored/perturbed as described in DESIGN_FORMS.
4. Solve target EFL by uniformly scaling dimensions with `target / current EFL`. The exact first-order system is recomputed. Reject nonpositive/unsuitable power and inadequate BFL. Place one common initial image plane at d-line paraxial focus.
5. Compute a paraxial pupil and field footprint, then repair too-thin glass/air regions using the endpoint sag difference. Repeat geometry adjustment and uniform first-order scale up to five times; absolute thickness limits are rechecked. No overlap is accepted merely because a repair was attempted.
6. Solve the physical iris radius from `abs(EFL × preStop.A) / (2 × target fNumber)`. All later synthesis evaluations perform this physical pupil solve too. F-number is not a UI label or a throughput-derived T-stop.
7. After cheap mechanical/paraxial filtering, trace real unclipped pupil rays to estimate required surface radii plus a configurable margin. Shared cemented faces use the same maximum group radius. Recheck geometry, trace clipped coarse bundles, and retain a bounded diverse shortlist for each family.

The seed's power/curvature metadata reflects the generated prescription after geometry repairs. It is provenance for the seed; later optimized dimensions are authoritative.

## Optimization and final aperture audit

Generated radius bounds are 0.75–1.3 times each initial radius, ordered to preserve sign. Thickness/gap ranges depend on the generated magnitude and absolute minima. The image gap receives a broader ±0.15 target-EFL range only for global-image-plane-variable focus. Stop translation changes its neighboring air gaps oppositely and cannot simultaneously vary those gaps. Existing DE normalizes diversity/scales by each bound width; raw mm magnitudes are not compared as equal parameter distances.

Curvature would handle passage through a plane more naturally, but this milestone deliberately retains the tested radius representation with sign-preserving bounds. No discontinuous radius sign crossing is enabled.

Final footprint sizing uses all requested fields/wavelengths, the primary aperture, and a denser pupil grid; it can enlarge or shrink apertures. It is followed by fresh mechanical and clipped, independent sunflower-pupil validation at every validation aperture. Required-ray failures are counted. Finite sampling and paraxial pupil placement remain limitations; an aperture estimate is not a manufacturing drawing or a proof of unvignetted real-pupil coverage.

A finalist that had a good search merit but fails after final aperture sizing is shown as INVALID. It is not adopted as a densely validated lens. The benchmark records these failures as well as successful survivors.
