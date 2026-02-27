const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs/promises");

const host = "127.0.0.1";
const port = Number.parseInt(process.env.PORT || "4173", 10);
const rootDir = path.resolve(__dirname, "..", "..");

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

function sanitizePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const normalized = path.posix.normalize(decoded);
  const withoutLeadingSlash = normalized.replace(/^\/+/, "");
  return withoutLeadingSlash || "index.html";
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return contentTypes[ext] || "application/octet-stream";
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
    res.end("Bad Request");
    return;
  }

  const relativePath = sanitizePath(req.url);
  const absolutePath = path.resolve(rootDir, relativePath);
  const relativeToRoot = path.relative(rootDir, absolutePath);

  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  let filePath = absolutePath;
  try {
    const stats = await fs.stat(filePath);
    if (stats.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    const file = await fs.readFile(filePath);
    res.writeHead(200, { "content-type": getContentType(filePath) });
    res.end(file);
  } catch (error) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not Found");
  }
});

server.listen(port, host, () => {
  process.stdout.write(`Static server listening on http://${host}:${port}\n`);
});

function shutdown() {
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
