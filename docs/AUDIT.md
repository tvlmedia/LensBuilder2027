# Audit of original application (baseline a6d2930)

The remote repository was empty on 2026-09-24. The supplied five local files are the preserved baseline. There were no tests, dependencies, build system or instructions files.

## Preserve
Surface editing, element insertion, stop selection, JSON save/load, sensor presets, split canvas view, mechanical outlines, chart/custom-image preview, focus mechanisms, Zemax metadata and supported configurations.

## Findings
- `script.js` combines material data, mutable prescription, geometry, rendering, import, persistence and UI in 9,880 lines. Core tests cannot currently run without a DOM.
- Plane/sphere intersections and vector Snell refraction are present in separate 2D/3D implementations. Root selection explicitly checks the vertex-facing hemisphere. Absolute epsilons and ordinary quadratic roots need regression coverage.
- Geometric EFL/entrance-pupil diameter is labelled T-stop. There is no absorption/coating model.
- Glass database contains nd/Vd records, not populated Sellmeier coefficients. Its Cauchy fit assumes a 60/40 split of F–C dispersion and clamps low Abbe numbers. Dispersion is approximate, despite a comment claiming real dispersion. Several aliases are substitutions, not equivalent glass names; unknown glass becomes air.
- Zemax importer drops surface types, conics, polynomial parameters, solves and many settings; MIRROR becomes AIR. Source text is retained but not a compatibility report. OBJ spacing is always zeroed: finite conjugates cannot be reconstructed faithfully.
- Preview reverse traces aim geometrically toward the physical stop without solving for refraction by intervening elements. The LUT collapses distributions to moments. Neither preview path is a diffraction PSF or radiometrically validated image simulation.
- Random pupil jitter prevents identical rerenders. Geometric accepted-ray fractions and cos^4 are used as brightness estimates; usable circle uses an arbitrary relative threshold, not an optical resolution requirement.
- Focus objective uses object-plane reverse-ray spread. This is a preview focus heuristic, not an independently validated image-plane merit function.
- Geometry is silently clamped in editor/import flows. An optimizer must validate candidates before these mutations and must never use editor clamping as a feasibility check.
- CPU rendering is chunked with animation frames but remains on the UI thread. Candidate optimization must use a worker and immutable input snapshots.
- Local storage catches errors; no undo history, versioned project schema or experiment provenance exists.
- Interface is dense with preview controls preceding the prescription; lacks objective analysis, operand breakdown and before/after comparison.

## Required safety before optimization
Analytic plane/sphere/Snell/TIR tests; thick lens and matrix determinant tests; forward/reverse reciprocity; material datasheet checks; pupil aiming residual checks; finite/infinite conjugates; misses and clipped rays explicitly accounted; geometry overlap rejection; determinism; hard-constraint invalidation; optimizer boundedness and real optical improvement; import rejection tests; browser smoke tests preserving original workflows.

## Migration decision
Extract shared refraction, intersections and materials into plain modules usable from the existing script, Node and workers. Add a DOM-free forward sequential evaluator rather than reuse preview heuristics. Preserve the editor and preview and label approximations. First optimization scope: coaxial spherical systems in air, infinity conjugate, fixed glass, fixed apertures, user-selected continuous variables, explicit fixed image plane. Diffraction, MTF, manufacturing yield, auto-design and character claims remain unavailable until separately validated.
