"use strict";
importScripts(
  "../materials/catalog.js",
  "../optics/core.js",
  "../analysis/evaluate.js",
  "../design/merit.js",
  "search.js",
);
let state = null,
  paused = true,
  timer = null,
  lastPost = 0;
function post(type, extra = {}) {
  postMessage({ type, ...extra });
}
function tick() {
  timer = null;
  if (paused || !state) return;
  try {
    LBSearch.advance(state);
    const now = Date.now();
    if (now - lastPost > 500 || state.done) {
      post("progress", { state });
      lastPost = now;
    }
    if (state.done) {
      paused = true;
      post("result", { result: LBSearch.finish(state) });
    } else timer = setTimeout(tick, 0);
  } catch (e) {
    paused = true;
    post("error", { message: e.message });
  }
}
onmessage = ({ data }) => {
  try {
    if (data.type === "start") {
      if (timer) clearTimeout(timer);
      state = LBSearch.create(
        data.input,
        data.spec,
        data.variables,
        data.operands,
        data.options,
      );
      paused = false;
      post("progress", { state });
      timer = setTimeout(tick, 0);
    } else if (data.type === "restore") {
      if (timer) clearTimeout(timer);
      state = LBSearch.resume(data.state);
      paused = true;
      post("paused", { state });
    } else if (data.type === "pause") {
      paused = true;
      if (timer) clearTimeout(timer);
      post("paused", { state });
    } else if (data.type === "resume") {
      if (!state) throw new Error("No checkpoint");
      if (!paused) return;
      paused = false;
      timer = setTimeout(tick, 0);
    } else if (data.type === "stop") {
      paused = true;
      if (timer) clearTimeout(timer);
      if (state) post("result", { result: LBSearch.finish(state) });
    } else if (data.type === "analyze") {
      const evaluation = LBMerit.evaluate(data.input, data.spec, data.operands);
      post("analysis", { evaluation });
    }
  } catch (e) {
    paused = true;
    post("error", { message: e.message });
  }
};
