# Whole-material glass refinement — 0.5.3

Single-element substitution was ineffective for many new-glass proposals under a two-unique-glass limit: changing one of several crown elements introduces a third material. OPTIMIZE GLASS now additionally replaces all elements of a repeated material together. It preserves interface paraxial power for this initialization, then restores target EFL, checks mechanics, reoptimizes and densely validates the result. It does not relax the glass-count constraint.

Selection is now based on a freshly measured dense incumbent. Previously a later trial could overwrite a better accepted dense result because acceptance compared against the original parent. Every physically viable refined trial now gets dense validation, and only a strict improvement over the best dense score can be accepted. A stale cached parent score no longer controls acceptance.

## Reproducible comparison

Run `npm run benchmark:glass`. The frozen parents are the three pattern-refined 0.5.2 designs in `refinement-benchmark.json`. Both methods use the same specifications/operands and 200 local evaluations per viable proposal. The comparison disables/enables family proposals in the new dense-ranking implementation. The family method explores more proposals, so this is **not an equal-total-budget comparison**. Full prescriptions, trial audits and scores are in [glass-family-benchmark.json](glass-family-benchmark.json).

| Target | Parent / single-element-only dense merit | With families | Improvement | Final center / edge RMS µm | Counted evaluation units: single / family |
|---|---:|---:|---:|---:|---:|
| Cooke f/4 Ø30 | 23.166 | 19.007 | 17.95% | 24.370 / 98.658 | 1840 / 3261 |
| Double Gauss f/2.8 Ø36 | 48.681 | 48.681 | none; parent retained | 70.640 / 136.166 | 1256 / 3492 |
| OMIT50 f/2 Ø46.3 | 278.435 | 250.588 | 10.00% | 112.271 / 328.064 | 1256 / 2482 |

The Cooke replaces both N-SK16 crown elements with N-BK7. The f/2 Modified Gauss replaces all four N-SK16 elements with N-LAK22 and retains N-SF10 flints. Both winners preserve the maximum of two glass types and pass the frozen hard/dense checks. The f/2 spot sizes remain too large to describe this as a finished technical cinema lens. A finite proposal list and fixed local budget do not establish a global optimum.

89 automated tests pass. New checks cover repeated-material replacement under the two-glass limit, cemented interface power preservation, proposal deduplication, immutable input, fresh evaluation of an intentionally stale cached score, strict dense ranking and invalid budgets. Existing optimizer, checkpoint and worker tests remain passing. Syntax and diff checks pass.

Browser validation: OPTIMIZE GLASS improved a saved Cooke candidate from dense merit 92.1035 to 81.1060, retained all hard checks, autosaved successfully, and restored the same result after reload. No console errors were reported.
