(function (root) {
  "use strict";
  function clean(value) {
    const s = structuredClone(value);
    s.surfaces?.forEach((s) => {
      delete s.vx;
    });
    return s;
  }
  class History {
    constructor(limit = 80) {
      this.limit = limit;
      this.past = [];
      this.future = [];
      this.current = null;
    }
    record(value) {
      const v = clean(value);
      if (JSON.stringify(v) === JSON.stringify(this.current)) return;
      if (this.current) this.past.push(this.current);
      if (this.past.length > this.limit) this.past.shift();
      this.current = v;
      this.future = [];
    }
    undo() {
      if (!this.past.length) return null;
      this.future.push(this.current);
      this.current = this.past.pop();
      return structuredClone(this.current);
    }
    redo() {
      if (!this.future.length) return null;
      this.past.push(this.current);
      this.current = this.future.pop();
      return structuredClone(this.current);
    }
  }
  root.LBHistory = History;
  if (typeof module !== "undefined") module.exports = History;
})(globalThis);
