const { Worker } = require("node:worker_threads"),
  path = require("node:path");
module.exports = function adapter(file = "evaluation-worker.js") {
  const harness = `const {parentPort}=require('node:worker_threads'),path=require('node:path');const base=${JSON.stringify(path.resolve(__dirname, "../optimization"))};globalThis.postMessage=m=>parentPort.postMessage(m);globalThis.importScripts=(...files)=>files.forEach(f=>require(path.resolve(base,f)));require(path.join(base,${JSON.stringify(file)}));parentPort.on('message',data=>globalThis.onmessage({data}));`;
  const w = new Worker(harness, { eval: true }),
    api = {
      postMessage: (m) => w.postMessage(m),
      terminate: () => w.terminate(),
    };
  w.on("message", (data) => api.onmessage?.({ data }));
  w.on("error", (e) => api.onerror?.(e));
  return api;
};
