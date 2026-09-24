const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  { Worker } = require("node:worker_threads"),
  path = require("node:path");
test("actual browser worker protocol: analyze, pause, restore, resume, validate", async () => {
  const harness = `const {parentPort}=require('node:worker_threads'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');const base=${JSON.stringify(path.resolve(__dirname, "../optimization"))};const c=vm.createContext({structuredClone,setTimeout,clearTimeout,console,postMessage:m=>parentPort.postMessage(m),onmessage:null});c.importScripts=(...files)=>files.forEach(f=>vm.runInContext(fs.readFileSync(path.resolve(base,f),'utf8'),c));vm.runInContext(fs.readFileSync(path.join(base,'worker.js'),'utf8'),c);parentPort.on('message',data=>c.onmessage({data}));`;
  const w = new Worker(harness, { eval: true });
  let queue = [],
    waiting = null;
  w.on("message", (m) => {
    if (waiting) {
      const f = waiting;
      waiting = null;
      f(m);
    } else queue.push(m);
  });
  const next = () =>
    queue.length
      ? Promise.resolve(queue.shift())
      : new Promise((r) => (waiting = r));
  const until = async (type) => {
    for (;;) {
      const m = await next();
      if (m.type === "error") throw new Error(m.message);
      if (m.type === type) return m;
    }
  };
  try {
    const input = require("../bijna-goed.json"),
      spec = {
        targetEflMm: 58.01287,
        targetFNumber: 1.46143,
        imageCircleMm: 43.27,
        pupilGrid: 5,
      },
      D = require("../design/merit.js"),
      operands = D.defaultOperands(spec);
    w.postMessage({ type: "analyze", input, spec, operands });
    assert.ok((await until("analysis")).evaluation.analysis.valid);
    w.postMessage({
      type: "start",
      input,
      spec,
      operands,
      variables: [{ surface: 13, key: "t", min: 25, max: 46 }],
      options: { maxEvaluations: 60 },
    });
    await until("progress");
    w.postMessage({ type: "pause" });
    const paused = (await until("paused")).state;
    assert.ok(paused.evaluations >= 1);
    w.postMessage({
      type: "restore",
      state: JSON.parse(JSON.stringify(paused)),
    });
    await until("paused");
    w.postMessage({ type: "resume" });
    const r = (await until("result")).result;
    assert.ok(r.accepted);
    assert.ok(r.state.evaluations <= 60);
  } finally {
    await w.terminate();
  }
});
