(function (root) {
  "use strict";
  class Pool {
    constructor(
      count = 2,
      factory = () => new Worker("./optimization/evaluation-worker.js"),
    ) {
      if (!Number.isInteger(count) || count < 1 || count > 64)
        throw Error("Workers must be 1–64");
      this.workers = [];
      this.pending = new Map();
      this.serial = 0;
      this.closed = false;
      this.busy = 0;
      for (let i = 0; i < count; i++) {
        const w = factory();
        this.workers.push(w);
        w.onmessage = ({ data }) => {
          const p = this.pending.get(data.id);
          if (!p) return;
          this.pending.delete(data.id);
          data.error ? p.reject(Error(data.error)) : p.resolve(data);
        };
        w.onerror = (e) =>
          this.close(Error(e.message || "Evaluation worker failed"));
      }
    }
    request(w, data) {
      if (this.closed) return Promise.reject(Error("Pool closed"));
      return new Promise((resolve, reject) => {
        const id = ++this.serial;
        this.pending.set(id, { resolve, reject });
        w.postMessage({ ...data, id });
      });
    }
    async init(state) {
      // The complete prescription/configuration is sent once, not once per candidate.
      const compact = {
        input: state.input,
        variables: state.variables,
        spec: state.spec,
        operands: state.operands,
        config: state.config,
      };
      await Promise.all(
        this.workers.map((w) =>
          this.request(w, { type: "init", state: compact }),
        ),
      );
    }
    async evaluate(vectors, dense = false) {
      const output = new Array(vectors.length);
      const started = performance.now();
      let occupiedMs = 0;
      let cursor = 0;
      await Promise.all(
        this.workers.map(async (w) => {
          while (cursor < vectors.length) {
            const offset = cursor;
            cursor += 4;
            const batch = vectors.slice(offset, offset + 4);
            this.busy++;
            const chunkStart = performance.now();
            try {
              const r = await this.request(w, {
                type: "evaluate",
                vectors: batch,
                dense,
              });
              r.results.forEach((v, i) => (output[offset + i] = v));
            } finally {
              occupiedMs += performance.now() - chunkStart;
              this.busy--;
            }
          }
        }),
      );
      this.utilization =
        occupiedMs /
        Math.max(1, performance.now() - started) /
        this.workers.length;
      return output;
    }
    close(error = Error("Pool stopped")) {
      this.closed = true;
      this.workers.forEach((w) => w.terminate());
      for (const p of this.pending.values()) p.reject(error);
      this.pending.clear();
    }
  }
  root.LBEvaluationPool = Pool;
  if (typeof module !== "undefined") module.exports = Pool;
})(globalThis);
