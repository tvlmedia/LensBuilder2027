# Merit and constraints

Each operand has metric, target, scale and weight; field-specific RMS additionally specifies `field`. Supported metrics: EFL mm, paraxial f-number, field RMS mm, maximum lateral chief-color separation mm, F−C paraxial longitudinal color mm, signed worst-magnitude distortion %, and maximum ray-loss fraction.

For scalar target t, error=e=value−t. For range [lo,hi], e is zero inside the range, value−lo below, and value−hi above. Contribution=weight*(e/scale)^2. Total is the sum of these dimensionless contributions. Scales must be finite positive, weights finite nonnegative. Values and each contribution are returned. Unavailable metrics are errors, not zeros.

This supports intentional nonzero **measured** RMS/color/distortion targets; it does not claim a physically implemented swirl/glow control. Default numerical weights are starting choices, not aesthetic or manufacturing truth. Changing EFL/f-number controls updates untouched default operands automatically. Edited custom operands remain independent, with a visible review message; **Reset operands to current targets** recreates the defaults.

Hard geometry limits are validated separately and cannot be outweighed. Available limits: min center/edge thickness, min air gap, max diameter, max optical length including sensor gap, minimum BFL. Minimum sampled pupil survival also applies. These are a limited geometric feasibility model, not a PL-mount clearance certification. No full image-circle guarantee is implemented.
