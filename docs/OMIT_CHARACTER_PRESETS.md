# Editable character targets

All presets expose the existing merit operands as editable JSON. Lower merit is better **for that particular objective**. There is no universal cinematic-quality score. Geometric RMS cannot establish bokeh, swirl, flare or visual rendering.

Default normalized fields are 0, 0.30, 0.50, 0.70, 0.85 and 1. Default geometric apertures are f/2, f/2.8, f/4 and f/5.6; custom lists are supported. Reapply the preset after changing fields/apertures. Each aperture must be enabled for optimization. Original aperture weights/optimization flags supplied through complete brief JSON are preserved when the numeric aperture list is unchanged.

## Exact default operands

Every aperture receives the following operands. Units are mm except f-number, normalized field, survival fraction and distortion percent. Weight/scale are passed to the unchanged existing merit definition (squared normalized residual penalties); scale is a tolerance/normalization, not a fabrication tolerance or pass certificate.

| Metric | Target | Scale | Weight |
| --- | --- | --- | --- |
| EFL | Brief target (50 mm default) | Brief EFL tolerance (1 mm default) | 10 |
| Geometric f-number | Current aperture | 0.05 | 3 |
| RMS at each field | 0 mm | See preset below | 2 at field ≤0.70; 1 outside |
| Lateral color at each nonzero field | −0.015…+0.015 mm | 0.01 mm | 1 |
| Distortion at each nonzero field | CLEAN: −1…+1%; others: −2…+2% | 1 percentage point | 0.5 |
| Longitudinal color | −0.1…+0.1 mm | 0.1 mm | 0.5 |
| Pupil survival | Minimum brief survival (0.70 default) | 0.1 | 2 |

RMS normalization at field `h`:

- **CLEAN CINEMA:** 0.04 mm across the field at all apertures.
- **VINTAGE CHARACTER:** `0.03 + 0.22 h²` mm. The center remains strongly weighted while outer-field residuals are more permissive.
- **OMIT SIGNATURE:** `0.03 + 0.12 h²` mm; multiply by 0.6 at f/4 and smaller apertures (larger f-numbers). This tightens absolute stopped-down demands, without rewarding degradation at f/2.

These defaults are hypotheses to inspect and edit, not scientifically established appearance categories. The default 6-field, 4-aperture configuration has 80 operands. RMS target must remain zero; negative-quality ratio/change objectives are excluded from Studio optimization. Cross-aperture performance is compared numerically in the table rather than rewarded by an arbitrary improvement ratio.

`fieldCurvature` and `astigmatism` can be added as explicit supported diagnostic operands, with field/aperture, target, scale and weight. They use existing focus diagnostics and can add analysis cost. Physical pupil coverage/ambiguity diagnostics are available for finalists; geometric pupil survival is not pupil area, transmission or T-stop. Physical MTF and experimental pupil metrics are not enabled as trusted merit operands.

Changing a preset or its units changes merit meaning. Never compare numerical scores across objectives without remeasuring both prescriptions under the same one.
