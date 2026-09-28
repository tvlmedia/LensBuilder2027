/* Structural families, not stored prescriptions. All dimensions are synthesized. */
(function (root) {
  "use strict";
  const forms = [
    {
      id: "cooke",
      name: "Cooke Triplet",
      groups: [[1], [-1], [1]],
      stopAfter: 1,
      symmetry: 0,
      description: "Three air-spaced elements, positive / negative / positive.",
      speed: [3.5, 11],
    },
    {
      id: "double-gauss",
      name: "Double Gauss",
      groups: [[1], [1, -1], [-1, 1], [1]],
      stopAfter: 1,
      symmetry: 0.08,
      description:
        "Six elements in four groups; two cemented inner menisci around a central air stop.",
      speed: [2.8, 8],
    },
    {
      id: "modified-gauss",
      name: "Modified Double Gauss",
      groups: [[1], [1, -1], [-1, 1], [1]],
      stopAfter: 1,
      symmetry: 0.35,
      description:
        "Six-element Gauss form with independently perturbed front/rear power and bending.",
      speed: [2, 5.6],
    },
    {
      id: "sonnar",
      name: "Sonnar-derived",
      groups: [[1], [1, -1, 1], [-1, 1]],
      stopAfter: 1,
      symmetry: 0,
      description:
        "Asymmetric six-element, three-group derivative: front singlet, cemented triplet, rear cemented doublet.",
      speed: [2, 5.6],
    },
  ].map((f) => ({
    ...f,
    elementCountRange: [f.groups.flat().length, f.groups.flat().length],
    groupCountRange: [f.groups.length, f.groups.length],
    allowedVariables: ["R", "t", "stopPosition"],
    sphericalOnly: true,
  }));
  function get(id) {
    const f = forms.find((f) => f.id === id);
    if (!f) throw Error("Unknown topology " + id);
    return structuredClone(f);
  }
  function select(s) {
    const allowed = forms.filter(
      (f) =>
        f.groups.flat().length >= s.minElements &&
        f.groups.flat().length <= s.maxElements &&
        f.groups.length >= s.minGroups &&
        f.groups.length <= s.maxGroups &&
        (s.cementedAllowed || f.groups.every((g) => g.length === 1)),
    );
    const chosen =
      s.topology === "auto"
        ? allowed
        : allowed.filter((f) => f.id === s.topology);
    if (!chosen.length)
      throw Error("No topology fits element/group/cementing limits");
    return chosen.map((f) => ({
      id: f.id,
      weight:
        (s.targetFNumber < 3 && f.id === "cooke" ? 0.25 : 1) *
        (s.minBflMm / s.targetEflMm > 0.8 && f.id === "sonnar" ? 0.4 : 1) *
        (s.targetEflMm / s.imageCircleMm < 0.8 && f.id === "cooke" ? 0.5 : 1),
      reason:
        "Fits construction limits; aperture, normalized field and BFL influence budget priority, not a performance guarantee.",
    }));
  }
  const api = { forms, get, select };
  root.LBDesignForms = api;
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);
