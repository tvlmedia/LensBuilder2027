# LensBuilder2027

A browser lens editor and optical-analysis workspace for spherical photographic/cinema lens experiments. The original surface editor, lens drawing, ray view, autofocus and test-chart preview are preserved. **Analyze / Auto Optimize** provides local optimization. **Search Lab** adds seeded Differential Evolution, uniform exploration, sensitivity, a worker pool, resumable experiments and a diverse candidate archive. **NEW LENS → GENERATE & OPTIMIZE** synthesizes prescriptions from requirements using four classical structural families, physical seed generation and the same numerical search. The measurement laboratory adds multiple apertures, explicit focus/reference-plane definitions, ray fans, zonal spherical-aberration diagnostics and pupil maps. All optimization is numerical and runs without AI/LLMs or cloud APIs.

## Run

Requires Node.js 20+; no packages need installing.

```sh
npm start
```

Open http://localhost:8080. The local server is needed for workers and asset loading. It binds only to your computer. `PORT=8081 npm start` selects another port.

## Use

1. Load/edit a lens with known materials and one stop.
2. Open **Analyze / Auto Optimize** and review targets and hard limits.
3. Analyze six field positions at F/d/C wavelengths.
4. Select variables and bounds. The final image gap starts selected; add radii/air gaps for optical-shape optimization.
5. Run, inspect before/after metrics and merit operands, then adopt a validated improvement. Undo/redo includes adoption as one edit.
6. Export checkpoints/experiments; paused runs can be restored from browser autosave or JSON.

Defaults prioritize spot RMS. Tradeoffs such as worse distortion remain visible. A lower merit does not certify a manufacturable or aesthetically successful cinema lens.

## Scientific scope

Shared tested vector Snell refraction and plane/sphere intersections; EFL/BFL/principal planes; paraxial entrance pupil and f-number; deterministic forward 3D spot analysis; chief-ray distortion and lateral color; paraxial longitudinal color; clipping diagnostics; normalized target/range merit; local bounded search.

**Unavailable:** diffraction PSF/MTF, transmission/T-stop, aspheres/mirrors, mechanical certification, tolerance yield and calibrated character metrics. Preview is approximate. Objective analysis is currently infinity-conjugate, coaxial, in air, at the prescription image plane. Pupil-disk sampling is paraxial; reported survival is not calibrated illumination or certified coverage. Unknown glass and unsupported optical features cause visible errors.

SCHOTT Sellmeier data is verified for N-BK7/N-BK7HT/N-F2. Other original nd/Vd records are approximate and require explicit optimization opt-in.

## Verify

```sh
npm test
npm run check
npm run benchmark
npm run benchmark:search
```

Tests include analytical optics, catalog values, importer compatibility, deterministic multi-variable optimization, independent denser-grid acceptance, checkpoint replay and the real worker protocol. No build/typecheck step applies to these plain JavaScript sources. `check` is syntax validation, not a full lint tool.

See [audit](docs/AUDIT.md), [architecture](docs/ARCHITECTURE.md), [optical engine](docs/OPTICAL_ENGINE.md), [conventions](docs/SIGN_CONVENTION.md), [analysis](docs/ANALYSIS.md), [merit](docs/MERIT_FUNCTION.md), [optimization](docs/OPTIMIZATION.md), [import](docs/ZEMAX_IMPORT.md), [validation](docs/VALIDATION.md) and [roadmap](docs/ROADMAP.md).

For large searches, use [Search Lab instructions and limitations](docs/SEARCH_LAB.md) and [measured worker benchmarks](docs/SEARCH_BENCHMARK.md). Start with a short run to verify your bounds and hard constraints, then increase the evaluation budget.

Version 0.4 changes distortion to a fixed paraxial reference-plane definition and keeps old sensor-plane mapping separately. Old optimization checkpoints require a new experiment because their objectives changed. See [optical metric definitions](docs/OPTICAL_METRICS.md) and [multi-aperture workflow](docs/MULTI_APERTURE_ANALYSIS.md).

Version 0.5 adds [from-scratch synthesis](docs/LENS_SYNTHESIS.md), [structural design forms](docs/DESIGN_FORMS.md), [seed generation](docs/SEED_GENERATION.md) and [verified glass substitution](docs/GLASS_OPTIMIZATION.md). See the [synthesis experiments and funnel benchmark](docs/SYNTHESIS_BENCHMARK.md) for actual Cooke, Double Gauss and harder f/2 results. Densely validated hard constraints do not certify adequate optical correction. Run `npm run benchmark:synthesis -- --omit` to reproduce all three experiments.

### Verified glass exploration (0.5.1)

In **NEW LENS → GENERATE & OPTIMIZE → Materials & analysis**, use **Use expanded verified glass set** to explore eight distinct SCHOTT models. The original two-glass default remains available. See [glass selection and provenance](docs/GLASS_OPTIMIZATION.md) and [measured comparison](docs/GLASS_EXPLORATION.md).

### Further geometry refinement (0.5.2)

Use **REFINE GEOMETRY** on a generated candidate to continue for up to 3000 evaluations; a replacement must pass fresh dense validation and improve its score. New UI runs also use accelerated pattern refinement, with the legacy method still selectable. See [measured comparison and checkpoint behavior](docs/GEOMETRY_REFINEMENT.md).
