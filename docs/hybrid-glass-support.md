# Jupiter-9 / Helios 44-2 material support

The active catalog had no LF7, TK14 or BF16 record or alias. The pinned official
SCHOTT AGF already contained LF7, but the generated runtime subset excluded it.
LF7 is not LLF7, LF5 or a Russian LZOS glass. No equivalent-glass substitution is
introduced. Original names are retained.

| Name | Manufacturer | nd | Vd | Dispersion status |
|---|---|---:|---:|---|
| LF7 | SCHOTT | 1.575011 | 41.490793 | Manufacturer Sellmeier 1, obsolete catalog status |
| LZ_TK14 | LZOS ТК-14 | 1.613091 | 60.58 | Manufacturer nd/Vd; approximate two-term Cauchy |
| LZ_BF16 | LZOS БФ-16 | 1.671025 | 47.29 | Manufacturer nd/Vd; approximate two-term Cauchy |

LF7 comes from the unmodified `materials/sources/schott-june-2025.agf`, downloaded
from [SCHOTT](https://media.schott.com/api/public/content/a79c07aa61da4c05a2c0bbab93d09a7f?download=true&v=3b65e351).
The generated catalog now includes 64 SCHOTT records. LF7 coefficients, with
wavelength in micrometres, are:

- B = [1.268797310, 0.156697051, 0.887676301]
- C = [0.009195539250, 0.04472567640, 106.8203610]
- Manufacturer dispersion range: 334–1060 nm.

The same AGF record supplies its internal-transmission table. LF7 nd is checked
within 0.51e-6 against the printed six-decimal value; all coefficients and range
are compared exactly against the pinned manufacturer record. This is catalog
numerical validation, not melt-specific certification.

The LZOS values are from the [original manufacturer catalog](https://lzos.ru/upload/iblock/818/818322c0e82195aba7b3c9b1441649b9.pdf),
printed pages 54 (ТК-14) and 62 (БФ-16), PDF pages 27 and 31. No verified complete
dispersion coefficients were established from this source. Both glasses therefore
use the existing explicitly approximate model, restricted to its existing
400–700 nm approximation scope. This is not a manufacturer-validated dispersion
fit. Full spectral transmission remains unavailable for these two records.

Regression fixtures are byte-for-byte copies of the two supplied Downloads JSONs:

- `Helios44_front_Jupiter9_rear_native_LensBuilder.json`: 12 surfaces including OBJ/IMS.
- `Jupiter9_front_Helios44_rear_native_LensBuilder.json`: 14 surfaces including OBJ/IMS.

Tests execute the existing JSON sanitizer and actual loadLens material-validation
preflight. Both resolve all original material names; radii, thicknesses, apertures,
stops and ordering are retained. Indices are finite at F/d/C. Inputs are not mutated.
A separate Zemax regression confirms that `GLAS LF7 0 0 1.5 40` resolves the official
catalog and does not accept the inactive 1.5/40 placeholders as optical data.

This change adds material definitions and tests only. It does not certify either
experimental hybrid's optical quality, geometry feasibility or manufacturability.
No raytracer, optimizer or lens design was modified.
