const http = require("http");
const path = require("path");
const fs = require("fs/promises");

const proxyHandler = require("./api/proxy");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

const ROOT_DIR = __dirname;
const PORT = Number(process.env.PORT) || 3000;

async function serveStatic(url, res) {
  let filePath = decodeURIComponent(url.pathname);
  if (filePath === "/") {
    filePath = "/index.html";
  }

  const fullPath = path.join(ROOT_DIR, filePath);
  if (!fullPath.startsWith(ROOT_DIR)) {
    res.statusCode = 403;
    res.end("Forbidden");
    return;
  }

  try {
    const file = await fs.readFile(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    const type = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": "public, max-age=60",
    });
    res.end(file);
  } catch (error) {
    if (error.code === "ENOENT") {
      res.statusCode = 404;
      res.end("Not found");
    } else {
      res.statusCode = 500;
      res.end("Server error");
    }
  }
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith("/api/proxy")) {
    req.query = Object.fromEntries(url.searchParams.entries());
    await proxyHandler(req, res);
    return;
  }

  await serveStatic(url, res);
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    console.error("Unexpected server error:", error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end("Unexpected server error");
    } else {
      res.end();
    }
  });
});

server.listen(PORT, () => {
  console.log(`duocalculator dev server running at http://localhost:${PORT}`);
});
