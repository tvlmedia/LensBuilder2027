/* Dedicated numerical evaluator; no DOM and no network APIs. */
importScripts(
  "../materials/catalog.js",
  "../optics/core.js",
  "../analysis/evaluate.js",
  "../design/merit.js",
  "./search.js",
  "./explorer.js",
);
let state;
onmessage = ({ data }) => {
  try {
    if (data.type === "init") {
      state = data.state;
      postMessage({ id: data.id, ready: true });
      return;
    }
    if (!state) throw Error("Worker not initialized");
    postMessage({
      id: data.id,
      results: data.vectors.map((v) =>
        LBExplorer.evaluate(state, v, !!data.dense),
      ),
    });
  } catch (e) {
    postMessage({ id: data.id, error: e.message });
  }
};
