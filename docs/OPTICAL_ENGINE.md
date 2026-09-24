# Implemented optical engine

`optics/core.js` supplies pure plane/sphere intersection, vector refraction, geometry validation, forward 3D sequential tracing, cardinal points and real chief-ray aiming. The legacy editor and reverse preview now call the **same tested intersection/refraction primitives**. Legacy focus and preview algorithms remain separate and approximate.

Quadratic roots use q/A and C/q with the sphere's constant term formed relative to its vertex. Hemisphere selection uses stable sag. TIR, missed surfaces, aperture clipping, and image-plane direction failure have distinct outcomes. Invalid systems fail before tracing. Geometry rejects negative distances, equator-reaching apertures, intersecting neighboring spherical surfaces and insufficient glass center/edge thickness. Coaxial spherical gap extrema occur at center or common aperture edge. These checks do not establish complete mechanical manufacturability.

`materials/catalog.js` retains the original nd/Vd entries with explicit approximate provenance. N-BK7, N-BK7HT and N-F2 have SCHOTT Sellmeier coefficients; the supported evaluation band is conservatively limited to 400–700 nm. No absorption, coating, cost or availability properties are invented. Air is n=1. Unknown materials throw; old approximate aliases no longer silently substitute another manufacturer/material. Bundled conceptual presets use their former substitute names explicitly, with notes.

Other materials with both nd and Vd use a two-term Cauchy approximation, constrained to nd and nF−nC. This does not recover true partial dispersion. Optimization requires explicit opt-in for these records. Verified catalog models take precedence over approximate imported nd/Vd values for recognized catalog names. Missing Vd is not invented.

Catalog data: [SCHOTT optical glass datasheets, May 2019](https://www.schott.com/en-gb/products/optical-glass/-/media/Project/OnEx/Products/O/optical-glass/Downloads/schott-optical-glass-collection-datasheets-english-may2019.pdf?rev=5358bb64e13a44f2b37f5065490509af), N-BK7HT and N-F2 pages; [SCHOTT N-BK7 datasheet](https://media.schott.com/api/public/content/41e799d0bf874807a0bb8e702fbb75b5?v=54856406). Only numerical properties are transcribed.

Unavailable: aspheric/reflection/freeform/decentered systems; diffraction, wavefront propagation, physical transmission and T-stop. Surface metadata can retain conic/aspheric/coating/group fields, but unsupported optical behavior is rejected, never silently traced as a sphere.
