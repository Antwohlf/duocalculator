const http = require("http");
const path = require("path");
const fs = require("fs/promises");
const fsSync = require("fs");

const proxyHandler = require("./api/proxy");
const reportBugHandler = require("./api/reportBug");

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
const DOTENV_PATH = path.join(ROOT_DIR, ".env");

function loadEnvFile() {
  if (!fsSync.existsSync(DOTENV_PATH)) return;
  try {
    const contents = fsSync.readFileSync(DOTENV_PATH, "utf8");
    contents.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) return;
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      if (!key) return;
      const quoteMatch = value.match(/^(['"])(.*)\1$/);
      if (quoteMatch) {
        value = quoteMatch[2];
      }
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    });
  } catch (error) {
    console.warn("Failed to read .env file:", error);
  }
}

loadEnvFile();

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

  if (url.pathname === "/api/report-bug") {
    await reportBugHandler(req, res);
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
