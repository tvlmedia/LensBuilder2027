const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, "..");
const basePath = (process.env.BASE_PATH || "").replace(/\/$/, "");
if (basePath && !/^\/[A-Za-z0-9_-]+$/.test(basePath)) throw Error("BASE_PATH must be a single URL path segment");
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
};
http
  .createServer((req, res) => {
    let name;
    try {
      name = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    } catch {
      res.writeHead(400);
      return res.end();
    }
    if (basePath) {
      if (!name.startsWith(basePath + "/")) { res.writeHead(404); return res.end("Not found"); }
      name = name.slice(basePath.length);
    }
    if (name === "/") name = "/index.html";
    const file = path.resolve(root, "." + name);
    if (
      !file.startsWith(root + path.sep) ||
      name.split("/").some((p) => p.startsWith("."))
    ) {
      res.writeHead(403);
      return res.end();
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404);
        return res.end("Not found");
      }
      res.writeHead(200, {
        "Content-Type": types[path.extname(file)] || "application/octet-stream",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(data);
    });
  })
  .listen(Number(process.env.PORT || 8080), "127.0.0.1", () =>
    console.log("LensBuilder: http://localhost:" + (process.env.PORT || 8080) + basePath + "/"),
  );
