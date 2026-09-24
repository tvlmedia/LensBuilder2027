/* Dedicated numerical evaluator; no DOM and no network APIs. */
importScripts(
  "../materials/catalog.js",
  "../optics/core.js",
  "../analysis/aberrations.js",
  "../analysis/evaluate.js",
  "../analysis/multi-aperture.js",
  "../design/merit.js",
  "./search.js",
  "./explorer.js",
);
let state;
onmessage = ({ data }) => {
  try {
    if (data.type === "analysis") {
      const spec = {
        ...data.spec,
        diagnostics: true,
        validationRun: true,
        pupilPattern: "sunflower",
        pupilGrid:
          data.spec.validationGrid ??
          Math.max(19, Math.min(41, 2 * (data.spec.pupilGrid || 9) + 1)),
      };
      const analysis = spec.apertures
        ? LBMultiAperture.evaluate(data.input, spec)
        : LBAnalysis.evaluate(data.input, spec);
      postMessage({ id: data.id, analysis });
      return;
    }
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
