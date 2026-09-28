# Optical metrics: definitions and validation scope

LensBuilder uses geometric sequential tracing of coaxial spherical surfaces, infinity conjugates and air object/image spaces. Distances are mm, wavelength nm, angles rad internally. x is the propagation axis; fields are in the x/y meridional plane. Image y is tangential/radial; z is sagittal/azimuthal. These are coordinates in the common flat image plane, not a tilted plane perpendicular to each chief ray.

**A passing numerical test or denser pupil resampling is not external certification of an entire lens.** No commercial ray-tracer reference dataset was supplied for this milestone. Status metadata separates method from validation scope. Unknown material dispersion is never invented; approximate nd/Vd records still need explicit opt-in.

## Distortion investigation and corrected definition

Previously `distortionPercent` was 100 × (real d-line chief height at the prescription sensor − EFL × tan θ) / (EFL × tan θ). It did not use a spot centroid. That number mixes distortion with a magnification change caused by moving the sensor away from the paraxial focal plane.

The bundled Biotar reproduces the reported case:

| Iris | Image gap mm | Old sensor-plane mapping % | Center RMS mm (grid9) |
|---|---:|---:|---:|
| f/1.4 | 42.104618 | +5.037874 | 2.84984 |
| f/2 | 35.027816 | −5.930000 | 0.18444 |
| f/5.6 | 37.124813 | −2.680000 | 0.03622 |

With only the iris changed and the original image gap held fixed, all three mapping values remain +5.037874%. The two alternate gaps were **reconstructed from the reported mapping values**, not obtained from the original user files. Their matching RMS ranges strongly support a changed-image-plane explanation; they do not establish which historical UI action caused it. The frozen reconstruction is in `tests/fixtures/aperture-distortion.json`.

The new **F-tan(θ) distortion** convention is:

- θ = atan(normalized field × specified reference-circle radius / specified target EFL). Field angles are frozen by the specification; candidate EFL never redefines them.
- Ideal height = actual candidate d-line EFL × tan θ.
- Reference plane = last physical vertex x + d-line paraxial BFL.
- Actual height = d-line chief-ray outgoing straight line evaluated at that reference plane.
- Distortion % = 100 × (actual − ideal) / ideal. On-axis is defined as zero by rotational symmetry; positive means greater image height (pincushion convention), negative smaller (barrel).

Chief means the ray numerically aimed through the center of the specified physical stop (pupil coordinate zero). Aiming initially ignores clipping, then the chief is traced with physical aperture clipping enabled. An unavailable/clipped chief causes invalid analysis rather than being replaced by a bundle centroid. The paraxial entrance pupil only supplies the starting guess. Stop **location** can affect chief rays; changing only centered stop **radius** does not change a surviving chief's path. Centroid motion and partial pupil clipping do not enter distortion.

`fixedPlaneMappingPercent` retains the previous sensor-plane quantity with an explicit name. `chiefHeightMm`, `referenceChiefHeightMm`, `idealHeightMm`, `distortionReferenceXMm` and `imagePlaneXMm` are exported. The reconstructed Biotar has approximately −1.33595% edge distortion on the paraxial reference plane at all three apertures/gaps.

This follows the distinction in the [OpticStudio Field Curvature and Distortion reference](https://ansyshelp.ansys.com/public/Views/Secured/Zemax/v251/en/OpticStudio_User_Guide/OpticStudio_Help/topics/Field_Curvature_and_Distortion.html). Tests use a separate trigonometric/analytic singlet calculation plus stop-radius and image-plane invariants. This is a deliberate metric-definition change: old objective totals must not be compared to new totals or resumed as if unchanged.

## f-number and aperture

For the reduced-angle paraxial matrix to the stop, entrance-pupil radius is physical stop radius / |A_preStop|. Paraxial f-number = |d-line EFL| / entrance-pupil diameter. Requested stop radius = current stop radius × current paraxial f-number / requested f-number. Only the designated stop's optical aperture fields change; all curvatures, thicknesses, sensor position, field/wavelength definitions and focus state remain unchanged.

Default iris capacity is the captured physical stop radius. An explicit `maxStopRadiusMm` can declare a larger available opening; sphere/geometry constraints still apply. Requests exceeding capacity fail explicitly. Other apertures can still clip rays; requested paraxial f-number does not certify throughput, illumination or that this iris is the only limiting aperture. The editor's Set f/ command now uses the same pure calculation instead of its previous iterative estimator/global aperture clamp.

T-stop, transmission and diffraction numerical aperture performance are not inferred. T-stop is unavailable.

## Spots and directional statistics

The fixed-plane spot centroid and covariance use surviving rays, with spectral weight divided by the **launched** sample count. RMS = sqrt(var(y)+var(z)); tangential RMS = sqrt(var(y)); sagittal RMS = sqrt(var(z)). `covarianceYZmm2` and `majorAxisAngleRad` describe the second-moment ellipse; orientation is null for an isotropic distribution. These describe geometry, not a PSF. No Airy disk or MTF is synthesized.

Search normally uses a deterministic square-grid disk; dense validation uses a denser equal-area radial/golden-angle disk arranged in fourfold rotational groups. The fourfold symmetry prevents finite sampling from falsely creating on-axis tangential/sagittal separation. Different sampling remains essential because clipping/RMS may move with sample density. A well-behaved small-aperture singlet has convergence tests; a strongly vignetted fast lens may need further resolution.

## Chromatic metrics

- **Paraxial longitudinal color**: F-line BFL − C-line BFL, mm, measured from the same last physical vertex. Positive means blue paraxial focus is farther right than red. Verified against material indices and paraxial formulas; independent of iris radius.
- **Lateral chief color**: signed chief displacement at each configured wavelength relative to the d-line chief, at the common prescription image plane. `chiefColorDisplacements` exports each wavelength; `lateralChiefColorMm` is max−min of configured chief heights (nonnegative span). If d is absent from configured colors it is still traced as reference. This is not a polychromatic spot-centroid measurement.
- **Real-ray focus color (experimental)**: difference between F/C least-variance real-ray best-focus shifts, available with diagnostics and both wavelengths. It depends on pupil, clipping and aberrations; it is not paraxial LoCA. Per-wavelength focus values remain available even when F/C are not both configured.

## Ray fans and longitudinal spherical aberration

Tangential fan varies normalized pupil y from −1 to +1 with z=0. Sagittal fan varies pupil z with tangential offset zero. Traces use the same approximate entrance disk centered on the numerically aimed chief. Each wavelength is compared to the d-line chief at the **fixed image plane**. Plots show image-y residual for tangential rays and image-z residual for sagittal rays, µm; exported residuals are mm. Lost rays are null with reasons; lines break across unavailable data.

The conventions follow the [OpticStudio Ray Aberration reference](https://ansyshelp.ansys.com/public/Views/Secured/Zemax/v251/en/OpticStudio_User_Guide/OpticStudio_Help/topics/Ray_Aberration_rays_and_spots.html). Our propagation/transverse coordinate names differ from OpticStudio. The paraxial entrance-disk approximation remains a limitation ([Ansys pupil discussion](https://optics.ansys.com/hc/en-us/articles/42661958583571-Paraxial-vs-Real-pupils-in-optical-system)).

For on-axis meridional rays, axial intersection = last ray position x − y/(dy/dx). Zero-zone/parallel slopes are omitted. The plotted longitudinal spherical aberration is this intersection minus the **same-wavelength paraxial focus x**, in mm, versus positive pupil zone. It includes real marginal-ray behavior; clipping leaves gaps. Symmetry and the near-axis paraxial limit are tested. No subjective glow/character score is assigned.

## Focus, field curvature and astigmatic diagnostics

Normal RMS always uses one prescription image plane. `fixed-prescription` does not refocus anything. `global-image-plane-variable` requires the final image gap to be an enabled search variable; every aperture/field shares that one candidate gap. The preview's separate autofocus is not used by the numerical lab.

For a traced outgoing ray with image intercept y and slope s=dy/dx, the intercept at a longitudinal offset Δ is y+Δs. The centroid-referenced variance is a quadratic. Its minimum is:

Δ_T = −cov(y,s_y) / var(s_y)

Δ_S = −cov(z,s_z) / var(s_z)

Δ_RMS = −[cov(y,s_y)+cov(z,s_z)] / [var(s_y)+var(s_z)]

Degenerate slope variance returns unavailable. Astigmatic difference is Δ_T−Δ_S, mm. Field-curvature diagnostic is Δ_RMS(field)−Δ_RMS(on-axis). Raw shifts are relative to the common physical image plane, not hidden changes to it. Polychromatic results use the same fixed launch weights; row diagnostics give individual wavelengths.

The algebraic minimum is independently tested using prescribed linear ray families and translation of the sensor. **Optical interpretation remains EXPERIMENTAL**: these are finite-bundle least-variance planes, not claimed Seidel/Petzval surfaces or exact infinitesimal sagittal/tangential foci. The fixed set of surviving rays is extrapolated; a returned plane may lie outside a physical useful image-space region. No merit operand currently treats these diagnostics as certified aberration targets.

## Pupil maps and unavailable metrics

Pupil maps record every attempted normalized entrance-disk sample, success/failure and reason. Green reaches the image, red is lost. This reveals sampled clipping, not natural irradiance weighting, transmission or a validated cat-eye ratio. Coma scalar analysis is unavailable; fans/spots expose raw asymmetric structure without inventing a coma score. PSF, MTF, wavefront/OPD, diffraction, radiometry and manufacturing performance remain unavailable.

## Synthesis compliance

Synthesis hard checks are evaluated separately from soft merit. Minimum BFL protects both the paraxial BFL and the actual last-vertex-to-common-image-plane distance; these two measured distances are reported separately. Flange focal distance is metadata unless the user supplies explicit rear-envelope stations. The image-circle diameter defines ideal normalized-field angles, with radius = diameter/2. The coverage check is sampled pupil survival at those angles, not certified real image coverage. A DENSE VALIDATED status means configured hard compliance under the declared resampling, not sufficient cinema resolution or correction.
