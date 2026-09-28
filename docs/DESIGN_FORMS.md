# Classical structural design forms

`LBDesignForms` defines serializable group membership, per-element power roles, air-stop region, symmetry/asymmetry strategy, counts and variable classes. It contains **no radius/thickness prescription**. Radius magnitudes are derived from sampled optical power, known refractive indices and bending parameters.

| ID | Elements / groups | Structural starting family |
|---|---:|---|
| `cooke` | 3 / 3 | Air-spaced positive, negative, positive; iris behind the negative element |
| `double-gauss` | 6 / 4 | Positive singlet, cemented positive/negative inner group, air iris, cemented negative/positive group, positive singlet |
| `modified-gauss` | 6 / 4 | Same group relationships with stronger independent front/rear perturbations |
| `sonnar` | 6 / 3 | Asymmetric front positive singlet, cemented positive/negative/positive triplet, iris, cemented negative/positive rear doublet |

The Gauss generator mirrors the front half to initialize the rear half, then perturbs it by up to 4%; Modified Gauss uses up to 25% for radius/thickness asymmetry, plus a broader power-distribution prior. These are initial conditions, not permanent symmetry constraints. The Sonnar-derived generator is a generalized structural family, not a reproduction of a specific historic Sonnar. No optical character is assigned by name.

A cemented group is represented by a **single shared refracting interface** between two media. There are no duplicated equal-radius surfaces with an artificial microscopic air gap. Thickness after the shared interface belongs to the next glass element. Each group uses a common physical clear radius during real-ray sizing. The stop is a separate plane in air, never a surface inside glass.

Allowed construction constraints select among these counts. Cementing disabled currently leaves Cooke available; no unimplemented air-spaced Gauss variant is silently substituted. AUTO reduces Cooke sampling weight for fast or wide normalized-field targets and Sonnar weight for a high BFL/EFL ratio. Surviving families share optimization resources; suitability weights are heuristics, not proven feasibility boundaries.

Historical structural references: [Cooke's history of the triplet](https://cookeoptics.com/cooke-history/) and [H. H. Nasse, ZEISS, Planar (2011)](https://lenspire.zeiss.com/photo/app/uploads/2022/02/technical-article-lens-names-planar.pdf). The latter describes the six-element/four-group symmetrical Planar and the later abandonment of strict symmetry in Biotar designs. Implementation bounds and sampling distributions are our numerical starting strategies, not values copied from those commercial prescriptions.
