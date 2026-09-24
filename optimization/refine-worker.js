importScripts(
  "../materials/catalog.js",
  "../optics/core.js",
  "../analysis/evaluate.js",
  "../design/merit.js",
  "./search.js",
  "./explorer.js",
);
onmessage = ({ data }) => {
  try {
    const { state, vector } = data;
    // Translate stop displacement bounds into the refined candidate's local reference frame.
    const input = LBExplorer.prescription(state, vector),
      variables = state.variables.map((v, i) => ({
        ...v,
        min: v.key === "stopPosition" ? v.min - vector[i] : v.min,
        max: v.key === "stopPosition" ? v.max - vector[i] : v.max,
      }));
    const local = LBSearch.create(
      input,
      state.spec,
      variables,
      state.operands,
      { maxEvaluations: 600 },
    );
    while (!local.done) LBSearch.advance(local);
    const final = local.bestVector.map((x, i) =>
      state.variables[i].key === "stopPosition" ? x + vector[i] : x,
    );
    const standard = LBExplorer.evaluate(state, final),
      dense = LBExplorer.evaluate(state, final, true);
    postMessage({
      vector: final,
      standard,
      dense,
      evaluations: local.evaluations,
    });
  } catch (e) {
    postMessage({ error: e.message });
  }
};
