# Optical validation — Milestone 4

## Scope and independent reference

`tests/reference/independent.cjs` does not import the optical engine. It intersects a sag graph by Newton iteration and applies scalar angular Snell refraction. Production uses a stable sphere quadratic and vector Snell refraction. The reference traces meridional rays through all seven frozen prescriptions (including separated elements and cemented interfaces), positive/negative radii, planes, and three wavelengths. Chief rays computed by production must reach the stop center in the reference implementation. This is an independent implementation cross-check, **not Zemax validation** and not a proof for every possible optical system.

First order is checked using two differential real rays, independently of production matrix multiplication, at both front and rear stop locations. EFL, BFL, both principal planes, entrance pupil location/radius, geometric f-number and finite-conjugate magnification are checked, including negative power. A thick singlet additionally has fixed analytical expectations from the thick-lens equation. Manufacturer Sellmeier coefficients are evaluated with an algebraically different expression and checked against tabulated nd/Vd.

Tolerances: intersection/refraction 1e-8 mm/rad; multi-surface meridional image intercept 2e-8 mm; stop-center residual 2e-7 mm; finite-height first order 2e-5 mm (finite-difference truncation); analytical thick lens 1e-8; index formula 1e-14; manufacturer rounded nd 6e-6 and Vd 0.006. These are numerical regression tolerances, not fabrication tolerances.

References: [MIT thick-lens lecture](https://ocw.mit.edu/courses/2-71-optics-spring-2009/0783da3aa46b10365378d762a37bc716_JmK0vSLULP8.pdf), [Thorlabs optical systems](https://www.thorlabs.com/catalogpages/711.pdf), [SCHOTT N-F2](https://media.schott.com/api/public/content/061f3156c83a44ed9220770b0f65a869?v=d69b35e0), and the archived manufacturer coefficients/source hash in `glass-catalog-provenance.json`. Equal mathematical equations necessarily share physical assumptions; separate numerical implementations reduce common coding errors, not common-model errors.

## Conventions and metrics

Lengths are mm, x is the optical axis increasing toward the image, y tangential and z sagittal. Positive radius has its center to the right of the vertex. Dispersion uses wavelengths in nm externally and micrometers inside Sellmeier. The d reference is 587.5618 nm, F=486.1327, C=656.2725. Default spectral weights F:d:C=1:2:1.

| Quantity | Definition and reference |
| --- | --- |
| EFL/BFL | Reduced-angle ABCD in air: EFL=-1/C, BFL=-A/C, measured from rear vertex for BFL |
| Principal planes | Front=(D-1)/C from front vertex; rear=last vertex+(1-A)/C |
| Entrance pupil | Stop imaged through preceding optics: x=Bstop/Astop; radius=stop radius/abs(Astop), before stop refraction |
| f-number | abs(EFL)/(2 entrance pupil radius); iris size is physical, independent of metadata |
| Field | angle=atan(field × specified image-circle diameter/(2 × target EFL)); remains frozen during optimization |
| RMS | sqrt(weighted variance y + weighted variance z) about the weighted centroid at the fixed prescription image plane |
| Tangential/sagittal RMS | sqrt(weighted variance y/z), same plane and centroid |
| Spectral weighting | Each surviving ray retains wavelength weight/launched count; clipped colors do not regain lost energy |
| Longitudinal CA | F BFL minus C BFL, signed paraxial mm |
| Lateral CA | max minus min chief-ray y over wavelengths at the fixed sensor; signed offsets relative to d also exposed |
| Distortion | 100(chief y − EFLactual tan(angle))/(EFLactual tan(angle)) at the **d paraxial focal plane**; zero on axis. Sensor mapping is a separate quantity |
| Pupil survival | accepted/launched, minimum across wavelengths per field; optimizer ray loss=1−minimum across fields |
| Focus | Least-variance outgoing-ray plane: Δx=−cov(position,slope)/var(slope); tangential and sagittal separately |
| Astigmatism | tangential best-focus shift minus sagittal shift; geometric diagnostic, not a Seidel coefficient |
| Field curvature | best radial-RMS plane shift minus the on-axis best radial-RMS shift |
| Ray fans | transverse image error along each pupil diameter; all wavelengths referenced to d chief at fixed sensor |
| Spherical diagnostic | on-axis zonal outgoing axial intercept relative to same-wavelength paraxial focus; no fitted Seidel coefficient |

Search samples a regular disk grid, final validation uses an independently positioned fourfold sunflower disk. Both approximate the **paraxial entrance pupil**, centered on a numerically aimed chief. Pupil aberration and radiometric pupil mapping are not solved. Sampling convergence is evidence, not proof of exact pupil integration. The image plane is a single physical gap variable, never independently refocused per field during merit evaluation.

## Frozen inputs and audit

`benchmarks/optical-suite-v1.json` freezes Cooke, Double Gauss, Modified Gauss, Sonnar, exact 0.5.3 OMIT50, a deliberately defocused Cooke, and an analytical singlet. Source paths and commit are recorded; the SHA256 is in `baseline-audit.json`. Only the analytical singlet has independent expected first-order values. Archived merit values are regression observations, not optical truth. Never update these inputs to make a new algorithm look better.

The 0.5.3 baseline passed 89 tests. The expanded-glass synthesis benchmark reproduced all archived initial/dense scores and statuses; geometry and glass-family refinements reproduced their full numerical outputs after excluding timing/provenance. Archived files were restored unchanged. No ray-tracer correction was justified by these checks.

## Limits

Infinity-conjugate, coaxial, spherical sequential imaging remains the production analysis scope. Geometric spots do not establish imaging quality, MTF, diffraction PSF, transmission or T-stop; those remain unavailable. Clear-aperture, sag, overlap, thickness, length and rear-clearance checks do not certify manufacturability or mechanical tolerances. No external commercial optical software was used.
