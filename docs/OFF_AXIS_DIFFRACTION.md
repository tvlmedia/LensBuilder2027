# Off-axis diffraction — 0.8.0

Monochromatic FFT PSFs describe a local plane normal to the chief ray. They are not automatically flat-sensor PSFs. Optical axis is x; y is tangential (field plane), z sagittal. The physical reference retains the actual wavelength-dependent chief-ray image position, direction, paraxial exit-pupil location and reference sphere.

For chief direction (cos θ, sin θ, 0), the tangential basis in the chief-normal plane is (−sin θ, cos θ, 0). Transporting a point u on that basis parallel to the chief ray until it intersects x = sensor x gives a tangential sensor displacement u/cos θ. Sagittal displacement is unchanged. The affine transport therefore has scaleX = 1/cos θ and scaleY = 1, centered at the actual chief-ray intercept. Conservative pixel integration preserves total energy under this area change.

An independent line/plane-intersection test checks this transformation against the implementation, and scalar test pupils verify energy preservation. These validate the geometry of parallel ray-tube transport, **not** propagation of an oblique diffraction field. Obliquity amplitude, nonparallel angular components, field-dependent pupil distortion and high-NA/vector effects remain outside this approximation. Every off-axis spectral result remains EXPERIMENTAL. No threshold was raised.

The existing paraxial exit-pupil and reference-sphere tests remain in the suite. Robust inverse tracing now checks local Jacobian conditioning and mapping residuals. These additions do not constitute independent validation of the complete fast-lens exit pupil. Nominal-disk coverage and blocked square fraction have different denominators; neither is a certified physical throughput measurement.

The conservative validated monochromatic regime remains on-axis, complete mapped pupil, image-space NA proxy ≤0.05, phase-resolved and numerically converged. Even inside it, the claim is explicitly scalar/paraxial and uniform amplitude. A reliable extension requires independent oblique-plane diffraction integration or an external optical reference with matched pupil, illumination and focus conventions. OMIT50 f/2 is not promoted.
