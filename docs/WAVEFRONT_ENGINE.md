# Wavefront engine — 0.7.0

## 0.8.0 update

0.8.0 adds bounded inverse Newton backtracking, conditioning checks, unwrapped phase-gradient/curvature diagnostics and 512² sampling. Missing mappings stay invalid. See [adaptive sampling](ADAPTIVE_PUPIL_SAMPLING.md) and [off-axis limits](OFF_AXIS_DIFFRACTION.md).

## Historical 0.7 implementation

## Supported model and coordinates

Centered spherical/planar sequential lenses, object at infinity, object and image media air; wavelengths 400–700 nm. Lengths and OPL are mm, wavelength input is nm. The existing ray tracer's x axis is axial; field lies in x/y; z is sagittal. Field angle is `atan(field * imageCircleMm / (2 * targetEflMm))`. The target EFL defines the field convention; it is not substituted for measured focal length in diffraction scaling.

`physical/wavefront.js` does not refocus the lens. It clones the prescription, optionally closes the real stop with the existing d-line aperture convention, and adds the explicitly requested common image shift to the final air gap. Approximate dispersion requires opt-in. Different wavelengths use the same physical iris and sensor position. The preview's finite-object rendering/focus metadata does not define this infinity-conjugate analysis.

## Optical path

`LBOptics.trace(compiled, ray, {opticalPath:true})` adds `opticalPathMm`, `geometricLengthMm` and `opticalPathToLastSurfaceMm`. With `record:true`, it also returns per-segment lengths, indices and optical paths. Each completed segment contributes `n(lambda) * hypot(dx,dy,dz)`, using the incident medium at each interface and the final medium to the sensor. Cemented interfaces change the index without inventing an air gap. Stop-only traces terminate before refraction at the stop. Failed rays have no successful-path result. Default geometric result fields remain unchanged and distance accumulation is skipped when disabled.

The OPL begins at the specified launch point, not at an unspecified wavefront at infinity. Absolute OPL therefore depends on launch position; OPD includes the incident eikonal below.

## Reference sphere and eikonal

The chief ray is aimed through the stop center. Its intersection with the selected physical image plane is reference point I. From the paraxial rear-system reduced-angle matrix `[A,B;C,D]`, starting just before the stop interface, the exit pupil is at `xLast - B/D` with radius `abs(A - B*C/D) * stopRadius`. Infinite exit pupils and unsupported reference geometries are unavailable.

The reference sphere is centered on I. Its chief-axis pole is in the paraxial exit-pupil plane: `R = (imageX - exitPupilX) / chiefOutgoing.dx`. For a last-surface point p and outgoing unit direction d, use the near intersection

```
b = dot(p - I, d)
tSphere = -b - sqrt(b*b - |p-I|² + R²)
Q = p + tSphere*d
```

A negative distance is the homogeneous image-space backward extension to a virtual reference surface. It does not trace backward through the glass. Opposite-hemisphere intersections are rejected. The reference sphere convention follows the usual exit-pupil wavefront reference; see the [OpTaliX reference manual](https://optenso.com/download/optalix_reference.pdf).

The incident rays are launched on one axial plane, which is not an equal-phase plane off axis. Consequently

```
S(Q) = dot(pLaunch - pChiefLaunch, incidentDirection)
       + OPL_to_last_surface + tSphere
OPD(Q) = S(Q) - S(Qchief)
```

Positive OPD means greater optical path. This is the phase convention in `exp(+i 2π OPD / lambda)` with forward FFT sign −i. Unit image/object indices are enforced by the existing prescription validation. OPD is evaluated on one reference sphere, not between arbitrary sensor hits.

## Pupil mapping and statistics

FFT samples must be uniform in projected reference-sphere coordinates. The engine solves a two-variable inverse ray map for each Cartesian cell center. Tangential basis is perpendicular to the outgoing chief ray in x/y; sagittal is +z. Unclipped rays guide Newton inversion; each solution is retraced with actual aperture clipping. A local determinant sign change, singularity or failed mapping is reported, not filled. The residual tolerance is 1e-8 mm, with at most 12 iterations.

The square extends to ±1.25 nominal exit-pupil radii by default. It does not impose a circular clear mask: actual surviving rays determine support. A clear border or unresolved/folded mapping blocks diffraction. `pupilCoverage` means fraction of sampled cells inside the nominal paraxial disk that survive. It is neither measured illumination nor the geometrical area fraction of the entire square. With incomplete mapping, RMS/PV describe surviving samples only and carry experimental status.

Piston is removed by the clear-cell mean. Optional tilt removal is a joint least-squares plane on actual support. It is explicit, recorded and changes image registration. **Defocus is never subtracted.** RMS and PV use equal projected-pupil cell weights. Both mm and waves (`OPD / (nm * 1e-6)`) are retained. Wavefront maps display these actual cells with gray missing/blocked regions and nearest-cell rendering.

## Zernike fit

ANSI/OSA ordering `j = (n(n+2)+m)/2`, negative m sine, positive m cosine. Radial polynomial uses the factorial series; normalization is `sqrt(2(n+1)/(1+delta(m,0)))`. See [NIST JRES 125.024, Appendix 9](https://nvlpubs.nist.gov/nistpubs/jres/125/jres.125.024.pdf). Default maximum radial order is 4. A reorthogonalized QR least-squares fit uses actual surviving cells; reported coefficients are waves. The fit is diagnostic and does not alter diffraction phase.

Full-disk normalization is retained under clipping, where orthogonality and universal coefficient comparability are lost. Clipped fits are experimental; support outside the defined disk, insufficient samples and rank deficiency make the fit unavailable. Compare coefficients only for identical pupil, wavelength, piston/tilt and focus conventions.

## Focus diagnostic

`focusScan` evaluates 3–17 explicit offsets on a fixed 32² pupil and minimizes weighted mean-square wavefront error over every selected field, aperture and wavelength at one shared shift. It is a discrete experimental diagnostic, not a continuous optimal-focus guarantee. It returns `applied:false`; the UI requires an explicit “Use diagnostic shift” action and a new analysis. No per-field or per-wavelength autofocus exists in this engine.
