# OMIT 50 — Full Frame — engineering review

Candidate: cooke-1001-0 · cooke · seed 1001
Software: 1.0.0 · contract 311098b3

**Research prescription. Not manufacturing-ready.**

Dense merit: 242.153961010135
EFL: 50.27777560864356 mm · BFL: 35.666796546580386 mm · geometric f/1.9999999999999998
Required image circle: 46.3 mm — sampled coverage only.
Optical length including image gap: 64.95682348979628 mm; front diameter: 36.91412831612412 mm.
Intended mount: PL; flange focal distance: 52 mm. Mechanical compatibility UNVERIFIED.

## Prescription

| Surface | Radius mm | Thickness mm | Glass | Clear semi-aperture mm | Stop |
| --- | ---: | ---: | --- | ---: | --- |
| 0 | 0 | 0 | AIR | 1 |  |
| 1 | 28.641886033844717 | 9.716289170850006 | N-BK7 | 18.45706415806206 |  |
| 2 | -104.21903314517722 | 2.9973764897159807 | AIR | 18.45706415806206 |  |
| 3 | -42.234780930909814 | 1.7977894976567916 | N-F2 | 13.283298566386295 |  |
| 4 | 96.63007485720946 | 7.006201962008672 | AIR | 13.283298566386295 |  |
| 5 | 0 | 3.5204327690513315 | AIR | 9.662662578191306 | YES |
| 6 | 57.35839704544693 | 5.150377241943525 | N-BK7 | 13.246673907589775 |  |
| 7 | -46.59832905344963 | 34.76835635856996 | AIR | 13.246673907589775 |  |
| 8 | 0 | 0 | AIR | 23.15 |  |

## Measured performance

| f-number | Field | RMS µm | Lateral color µm | Distortion % | Sampled survival |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 2 | 0 | 67.5987 | 0.0000 | 0.0000 | 0.9155 |
| 2 | 0.3 | 135.5718 | 1.1413 | 0.0472 | 0.9049 |
| 2 | 0.5 | 240.0855 | 1.1704 | 0.0919 | 0.8908 |
| 2 | 0.7 | 372.1453 | 1.5114 | 0.0713 | 0.8697 |
| 2 | 0.85 | 467.9736 | 2.5177 | -0.0240 | 0.8415 |
| 2 | 1 | 679.8704 | 2.9044 | -0.1362 | 0.8380 |
| 2.8 | 0 | 50.3078 | 0.0000 | 0.0000 | 0.9577 |
| 2.8 | 0.3 | 51.4443 | 1.1413 | 0.0472 | 0.9542 |
| 2.8 | 0.5 | 100.0471 | 1.1704 | 0.0919 | 0.9401 |
| 2.8 | 0.7 | 181.4155 | 1.5114 | 0.0713 | 0.9155 |
| 2.8 | 0.85 | 251.1269 | 2.5177 | -0.0240 | 0.9049 |
| 2.8 | 1 | 375.9485 | 2.9044 | -0.1362 | 0.9507 |
| 4 | 0 | 55.1388 | 0.0000 | 0.0000 | 0.9718 |
| 4 | 0.3 | 34.2134 | 1.1413 | 0.0472 | 0.9718 |
| 4 | 0.5 | 43.1634 | 1.1704 | 0.0919 | 0.9577 |
| 4 | 0.7 | 94.9424 | 1.5114 | 0.0713 | 0.9437 |
| 4 | 0.85 | 140.1876 | 2.5177 | -0.0240 | 0.9331 |
| 4 | 1 | 188.6213 | 2.9044 | -0.1362 | 0.9472 |
| 5.6 | 0 | 47.1266 | 0.0000 | 0.0000 | 0.9859 |
| 5.6 | 0.3 | 28.2367 | 1.1413 | 0.0472 | 0.9789 |
| 5.6 | 0.5 | 20.9762 | 1.1704 | 0.0919 | 0.9718 |
| 5.6 | 0.7 | 56.7679 | 1.5114 | 0.0713 | 0.9613 |
| 5.6 | 0.85 | 88.8848 | 2.5177 | -0.0240 | 0.9507 |
| 5.6 | 1 | 126.6253 | 2.9044 | -0.1362 | 0.9613 |

## Validation

- geometry: PASS
- efl: PASS
- fNumber: PASS
- bfl: PASS
- rearToImage: PASS
- construction: PASS
- materials: PASS
- rearDiameter: PASS
- rearClearance: PASS
- coverage: PASS
- frontDiameter: PASS
- opticalBfl: PASS
- rearImageClearance: PASS
- Optical correction: Inspect measured targets; dense-valid is not well-corrected
- Mechanical: UNVERIFIED
- Manufacturing: UNVERIFIED

## Physical analysis

NOT RUN. PSF/MTF unavailable in this package.

- Research engineering package, not manufacturing-ready
- PL flange distance is metadata; mount geometry and rear clearance need mechanical verification
- No production tolerances supplied
- Geometric RMS does not predict bokeh, swirl, flare or cinematic appearance
- Missing physical PSF/MTF remains unavailable; no estimated substitute

Full brief, glass dispersion models, operands, evaluation costs and history are included in the JSON package.