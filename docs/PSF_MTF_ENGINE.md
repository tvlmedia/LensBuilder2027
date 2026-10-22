# Scalar diffraction PSF, OTF and MTF — 0.7.0

## 0.8.0 update

0.8.0 supports bounded 2048² FFTs and registered polychromatic intensities. See [spectral integration](POLYCHROMATIC_PSF_MTF.md) and [stronger convergence](PHYSICAL_CONVERGENCE.md). Integrated real-lens spectra remain EXPERIMENTAL; MTF merit remains unavailable.

## Historical 0.7 implementation

## Numerical model

`physical/fourier.js` implements dependency-free complex radix-2 1D/2D FFTs. The clear reference-sphere pupil has uniform projected amplitude, `P = mask * exp(i 2π OPD_waves)`. Blocked cells are exactly zero. There is no RMS-to-Gaussian conversion, synthetic coating transmission or substitution of an Airy curve for an aberrated result.

The scalar paraxial image amplitude is the Fourier transform of P. This is a restricted model, not vector diffraction, polarization, calibrated photometry, measured transmission or high-NA Debye integration. Uniform projected amplitude neglects pupil-ray density/apodization. The conservative badge boundary `pupilRadius / referenceRadius <= 0.05` limits use to a small-angle model; it is not a proved universal percentage error bound against Maxwell's equations.

For square pupil pitch du, vacuum wavelength lambda in mm, reference radius R, and padded FFT dimension M:

```
imagePitchMm = lambda * R / (M * du)
PSF = fftshift(abs(FFT(P))²) / sum(abs(FFT(P))²)
imageFNumber = R / (2 * nominalPupilRadius)
nominal circular cutoff = 1 / (lambda * imageFNumber)
```

Physical scaling uses image-space pupil geometry, not nominal EFL divided by entrance-pupil diameter. Pupil cell centers are used consistently. Padding 2, 4 or 8 samples the same transform more finely; it does not improve the pupil phase approximation. Maximum FFT size is 1024²; pupil sizes are 16–256 powers of two. The source mask has a clear border and occupies less than half the padded width, preventing circular autocorrelation overlap.

The PSF is unit discrete total energy. Density in inverse mm² is pixel energy divided by image pixel area. UI linear/log brightness is separately scaled to the individual PSF peak and says so; compare the numerical peak density or energy, not apparent display brightness. The five-decade log view is display-only.

## Energy and Strehl

Encircled energy is the sum of PSF pixel energy inside specified physical radii about the chief-reference origin, not a separately optimized centroid. Radii include the nominal first Airy radius, twice/five times that radius, and 5/10/25/50 µm. Pixel inclusion is discrete and must converge with padding.

Direct sampled Strehl is maximum aberrated PSF intensity divided by the maximum flat-phase PSF intensity with **the same sampled support and total energy**. Uniform amplitude gives the exact discrete ideal peak `clearCellCount²`, so another FFT is unnecessary. This is not a Maréchal estimate. The finite image grid can underestimate a continuous displaced peak; padding convergence matters. A clipped-pupil Strehl of one means ideal for that clipped support, not ideal for a full circular pupil.

## OTF, MTF, phase and directions

`OTF = FFT(ifftshift(PSF)) / DC`. Real and imaginary arrays remain available. `MTF = hypot(real,imag)` and `PTF = atan2(imag,real)`; directional entries preserve both components and phase. Frequency step is `1 / (M * imagePitchMm)` in cycles/mm, equivalent to lp/mm.

Tangential is along the field plane, i.e. projected chief-normal y; sagittal is z. The FFT column axis is therefore tangential and row axis sagittal for the supported field convention. A tilted pupil's OTF phase is retained. For off-axis fields the image coordinates lie in the chief-normal plane; oblique flat-sensor projection and quantitative pupil apodization are unvalidated. All such diffraction results are experimental even when the numerical convergence check passes.

The analytical clear circular pupil has

```
MTF(nu) = (2/pi) * (acos(nu) - nu * sqrt(1-nu²)), 0 <= nu <= 1
MTF = 0 above cutoff
```

See [MIT 2.710, incoherent imaging and MTF](https://web.mit.edu/2.710/Fall06/2.710-wk11-a-sl.pdf). This expression is a validation reference only; real lens curves come from their computed complex pupils.

## Availability gates

Diffraction is unavailable if ray mapping is incomplete/folded, the clear pupil touches the grid border, or neighboring clear samples differ by more than 0.25 waves. This conservative phase rule avoids displaying a known undersampled FFT; passing it alone is not proof of convergence.

`VALIDATED SCALAR/PARAXIAL REGIME` additionally requires on-axis field, NA proxy <=0.05, complete nominal disk coverage, and a doubled-pupil-grid comparison. Required changes: RMS <=0.001 waves +2% of fine RMS; Strehl, first-Airy-radius energy and both directional MTF at 20/40/80 lp/mm <=0.02 absolute. Unrepresentable frequencies fail comparison. These are engineering acceptance criteria, not absolute error bounds. If the next grid exceeds limits, or verification is disabled, diffraction remains experimental. A 256² result cannot receive the badge because 512² pupil convergence is not implemented.

## Spectral and optimization scope

Multiple wavelengths are individually traced on one fixed physical image plane. Spectral weights are validated, stored and used by the explicit focus diagnostic. **Polychromatic PSF/MTF combination is unavailable.** Registration and energy-conserving resampling on a common sensor grid have not been validated; the app neither recenters wavelengths and sums them nor averages MTF magnitudes.

MTF merit operands are unavailable. Tier 5 runs only by request on finalists, in a dedicated worker. Existing geometric searches and their operands are unchanged. No neural network, inference service or external runtime dependency is used.
