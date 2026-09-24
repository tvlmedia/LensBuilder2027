# Coordinates and units

Lengths are mm, wavelengths nm at API boundaries (converted to µm inside Sellmeier/Cauchy), angles radians internally and degrees in tables. x is the optical axis, increasing from object to image; y/z are transverse. R>0 puts the sphere center after its vertex; R=0 means a plane. Sag is evaluated stably as `(r²/R)/(1+sqrt(1-(r/R)²))`. Only the vertex-facing hemisphere is valid.

A physical surface stores medium **after** refraction and thickness to the next vertex. OBJ/IMS are markers, not refracting surfaces. The numerical evaluator reconstructs vertices independently of cached editor `vx`. It requires air on both sides and exactly one physical stop. The final gap explicitly determines the image plane. Preview focus offsets are excluded from objective analysis; adoption resets them to zero.

Paraxial ray vector is `[y, n*theta]`; translation is `[1,t/n;0,1]`, surface refraction `[1,0;-(n2-n1)/R,1]`. In air, for system matrix `[A,B;C,D]`, EFL=-1/C, BFL=-A/C, FFL=D/C. Front principal coordinate is FFL+EFL; rear principal coordinate is lastVertex+BFL−EFL. Matrices include physical surfaces, not the final image gap.

The pre-stop matrix maps first-vertex coordinates to the stop before refraction. Entrance pupil position is B/A and radius is stopRadius/|A|. These are **paraxial** pupil quantities. A true real-ray chief is solved iteratively to reach stop center. Non-paraxial pupil aberration is not corrected in the disk sampling.

Reference: [optrace ray-transfer matrix documentation](https://drocheam.github.io/optrace/details/matrix_analysis.html). The reduced-angle convention above is related to its angle convention by a change of basis; determinant is unity in reduced coordinates.
