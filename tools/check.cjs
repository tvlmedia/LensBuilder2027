const fs = require("node:fs"),
  path = require("node:path"),
  cp = require("node:child_process");
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(js|cjs)$/.test(p)) {
      const r = cp.spawnSync(process.execPath, ["--check", p], {
        stdio: "inherit",
      });
      if (r.status) process.exit(r.status);
    }
  }
}
walk(path.resolve(__dirname, ".."));
console.log(
  "All JavaScript syntax checks passed (no build step or TypeScript).",
);
