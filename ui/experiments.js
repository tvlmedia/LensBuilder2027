(function (root) {
  "use strict";
  const DB = "lensbuilder-numerical-experiments";
  function open() {
    return new Promise((resolve, reject) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () =>
        r.result.createObjectStore("runs", { keyPath: "id" });
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  async function transact(mode, action) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction("runs", mode);
      const request = action(t.objectStore("runs"));
      t.oncomplete = () => {
        db.close();
        resolve(request.result);
      };
      t.onerror = () => {
        db.close();
        reject(t.error);
      };
      t.onabort = () => {
        db.close();
        reject(t.error || Error("Autosave aborted"));
      };
    });
  }
  root.LBExperiments = {
    save: (state) =>
      transact("readwrite", (s) =>
        s.put({ ...state, checkpointAt: new Date().toISOString() }),
      ),
    load: (id) => transact("readonly", (s) => s.get(id)),
    list: () =>
      transact("readonly", (s) => s.getAll()).then((rows) =>
        rows.sort((a, b) => b.checkpointAt.localeCompare(a.checkpointAt)),
      ),
  };
})(globalThis);
