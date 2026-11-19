# Manufacturer catalog and legacy import validation — 2026-11-19

## Outcome

63 SCHOTT materials now use their exact manufacturer Sellmeier coefficients,
individual wavelength ranges and internal-transmission tables. This includes all
61 previously supported SCHOTT names, plus historical BAF9 and K11. All existing
nd/Vd values already matched the manufacturer records; none required correction.
52 previously approximate models have been upgraded. No lens prescription or
ray-intersection/refraction algorithm was edited.

Four LZOS names have original manufacturer nd/Vd data and remain explicitly
**APPROXIMATE** two-term Cauchy models. No SCHOTT replacements are assigned.

The per-material inventory, previous model, nd/Vd and validity range are in
[material-catalog-audit.json](material-catalog-audit.json).

## Sources and reproducibility

- [SCHOTT official AGF download](https://media.schott.com/api/public/content/a79c07aa61da4c05a2c0bbab93d09a7f?download=true&v=3b65e351):
  archive entry `schott glasses preferred and special June-2025-B.AGF`.
  The unmodified extracted source is `materials/sources/schott-june-2025.agf`.
  Its SHA-256 and retrieval date are recorded in the audit JSON.
- [SCHOTT datasheet collection](https://media.schott.com/api/public/content/820eba3413cc4e788433a3751f8edba9?download=true&v=97b3ea2b):
  independent printed d/F/C index checks for N-BK7 and N-LAK9, PDF pages 13/53.
- [LZOS original manufacturer catalog](https://lzos.ru/upload/iblock/818/818322c0e82195aba7b3c9b1441649b9.pdf):
  TK16, BF7, TF2, OF1, printed pages 54, 62, 72, 74 respectively.
- [Ansys AGF specification](https://ansyshelp.ansys.com/public/Views/Secured/Zemax/v251/en/OpticStudio_User_Guide/OpticStudio_Help/topics/The_AGF_BGF_File_Formats.html):
  formula 2, CD alternating B/C slots, LD in micrometres, IT internal transmission
  at wavelength in micrometres and thickness in millimetres.
- [Zemax explanation of catalog GLAS placeholders](https://community.zemax.com/got-a-question-7/differences-in-zmx-files-for-systems-that-are-equal-in-file-comparer-5249):
  trailing values do not define dispersion for an ordinary catalog glass.

Regenerate offline with `node tools/import-schott-agf.cjs`. Only the original
supported names plus BAF9/K11 are selected from the 366-record archive; the full
archive is not automatically offered as new UI materials. Formula types other
than Sellmeier 1 are rejected by this targeted build-time importer.

Manufacturer identity is stored independently from the exact material name.
N-BK7 and N-BK7HT retain separate records: their published B/C are equal, their
transmission is different. Legacy substitution suggestions are error text only;
they are never aliases or automatic selections.

## Accuracy and validity

For all 63 SCHOTT entries, tests compare the runtime coefficients and ranges to
the pinned AGF, independently evaluate d/F/C indices, and recover the published
nd/Vd. Maximum residuals against rounded NM values: nd **4.077452e-6** (N-SF8),
Vd **0.004469773** (N-BK10). Tolerances are 5.1e-6 and 0.0051 respectively;
BAF9/K11, published with six decimals, use 0.51e-6 for both. Independent printed
d/F/C values use 5.1e-6, matching their five decimal places.

This verifies catalog calculations, not a particular manufactured melt. No new
temperature, pressure, stress or melt correction model is introduced. AIR remains
the existing n=1 reference medium.

62 of the 63 SCHOTT models cover the entire 380–800 nm interval. N-SF66 begins at
390 nm. Outside each LD range, index evaluation throws an explicit error rather
than extrapolating. A dispersion-valid wavelength does not imply good transmission.

| Original name | Manufacturer | nd | Vd | Status |
|---|---|---:|---:|---|
| LZ_TK16 | LZOS ТК-16 | 1.612694 | 58.35 | Manufacturer nd/Vd; approximate dispersion |
| LZ_TF2 | LZOS ТФ-2 | 1.672680 | 32.23 | Manufacturer nd/Vd; approximate dispersion |
| LZ_OF1 | LZOS ОФ-1 | 1.529492 | 51.81 | Manufacturer nd/Vd; approximate dispersion |
| LZ_BF7 | LZOS БФ-7 | 1.579595 | 53.86 | Manufacturer nd/Vd; approximate dispersion |

For these four glasses, verified Sellmeier coefficients and spectral transmission
remain unavailable in the implemented sources. The 400–700 nm fallback scope is
explicitly an approximation scope, **not** a manufacturer-validated fit range.
No partial dispersion or absorption is invented. Unknown names still fail with
an actionable request for original manufacturer data.

## Internal transmission

`LBMaterials.internalTransmission(surface, wavelengthNm, glassPathMm)` returns
an object with `value`, `status`, and `includesReflections:false`. It uses
`tau(path) = tau(reference) ** (path/referenceThickness)`. The path is the actual
distance travelled inside glass, not necessarily the surface's axial thickness.
Between recorded wavelengths it interpolates the absorption coefficient and
labels the result approximate. No extrapolation is allowed. Missing data, or
interpolation next to a rounded zero, returns `value:null` with a reason.

This API does not claim a T-stop or lens throughput. It does not apply absorption
to existing preview/PSF algorithms. Coating and Fresnel surface losses are separate
and remain excluded. Tabulated transmission has the manufacturer's precision and
is not proof of melt-specific performance; exact tabulated zero is retained as
published, not evidence of an infinite absorption coefficient.

## Import behavior and geometry

`parseZemaxGlassLine()` now reads explicit nd/Vd slots only for `___BLANK` model
glass. Numeric placeholders on a named catalog GLAS are ignored. Unknown named
glass cannot become traceable through accidental `1.5 40` placeholders; unsupported
solves and incomplete model definitions produce clear errors. No arbitrary scan
of numeric GLAS fields remains.

`material()` explicitly rejects null, empty, boolean, array and nonfinite custom
data. Verified catalog Sellmeier records retain existing precedence over imported
cached nd/Vd. Explicit JSON nd/Vd for a non-Sellmeier material remain preserved and
labeled user-supplied/unverified. In particular, the supplied OF1 values
**1.5294833987115803 / 51.5964672381125** are retained rather than overwritten with
the current LZOS catalog pair. The original catalog edition/melt behind those
values is not established.

Schema version 2 and its project wrapper remain supported. JSON material errors
no longer trigger a misleading “Not Zemax sequential text” fallback. Imports keep
optical apertures and image aperture rather than applying UI clamping or the
currently selected sensor height. All material failures are reported together.

The original `Downloads/OMIT_50mm_raytracer_schema_v2.json` is copied unchanged to
`tests/fixtures/omit-legacy-schema-v2.json`. Both automated and browser checks found:

- 13 surface records, including OBJ, stop and IMS, in unchanged order;
- stop at record 7, radius 14.12034788946519 mm;
- last image gap 39.022664738919666 mm;
- image vertex 90.22266473891966 mm after the first optical vertex;
- all radii, spacings, apertures, glass assignments preserved;
- no unresolved material names; four approximate-material warnings.

The original corresponding Zemax text was **not located**. The ZMX fixture is
explicitly labeled a reconstruction from that JSON, with deliberately inactive
`1.5 40` placeholders to test the reported failure mode. It is not represented as
the user's original ZMX. Its OF1 uses the catalog, while the JSON retains its
explicit user model, so their dispersion is intentionally not claimed identical.

## Verification

- Baseline before changes: 231/231 tests passed.
- Updated suite: 240/240 tests passed; all JavaScript syntax checks passed.
- 189 archived geometric dense evaluations: maximum merit difference **0**.
- Existing Best/M4 numerical reference tests and physical/worker tests pass.
- Local browser under `/LensBuilder2027/`: original schema-v2 JSON and reconstructed
  ZMX accepted; 13 table records, correct glass names and image gap; no captured
  browser-console errors during those tests.
- No lens preset, surface geometry, optical engine, deployment or version was changed.

Models upgraded from Cauchy can produce different chromatic predictions for other
existing lenses. That is the intended catalog correction, not a geometry change.
The full per-glass upgrade list is in the audit JSON. Publication as v1.1.10 was subsequently authorized by the user.
