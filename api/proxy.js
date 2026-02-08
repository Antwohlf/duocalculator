const ALLOWED_HOSTS = new Set(["duolingodata.com", "www.duolingodata.com"]);
const REMOTE_BASE = "https://duolingodata.com/";

const FETCH_TIMEOUT_MS = 8000;
const MAX_RESPONSE_BYTES = 1024 * 1024; // 1 MB

const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const RATE_LIMIT_MAX = 60;
const rateLimitMap = new Map();

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

function cleanupRateLimits(now) {
  for (const [ip, timestamps] of rateLimitMap.entries()) {
    const recent = timestamps.filter((ts) => now - ts <= RATE_LIMIT_WINDOW_MS);
    if (recent.length === 0) {
      rateLimitMap.delete(ip);
    } else {
      rateLimitMap.set(ip, recent);
    }
  }
}

function checkRateLimit(req) {
  const now = Date.now();
  cleanupRateLimits(now);

  const ip = getClientIp(req);
  const timestamps = rateLimitMap.get(ip) || [];
  const recent = timestamps.filter((ts) => now - ts <= RATE_LIMIT_WINDOW_MS);

  if (recent.length >= RATE_LIMIT_MAX) {
    return { allowed: false };
  }

  recent.push(now);
  rateLimitMap.set(ip, recent);
  return { allowed: true };
}

function resolveTarget(requestedUrl) {
  let target;
  try {
    target = new URL(requestedUrl, REMOTE_BASE);
  } catch (error) {
    throw createError(400, "Invalid target URL.");
  }

  if (!ALLOWED_HOSTS.has(target.hostname)) {
    throw createError(400, "Only duolingodata.com resources are permitted.");
  }

  if (target.protocol !== "https:") {
    throw createError(400, "Only HTTPS requests are allowed.");
  }

  return target;
}

async function readTextWithLimit(response, maxBytes) {
  const lengthHeader = response.headers.get("content-length");
  if (lengthHeader) {
    const parsedLength = Number(lengthHeader);
    if (Number.isFinite(parsedLength) && parsedLength > maxBytes) {
      throw createError(413, "Upstream response too large.");
    }
  }

  if (!response.body || typeof response.body.getReader !== "function") {
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > maxBytes) {
      throw createError(413, "Upstream response too large.");
    }
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let received = 0;
  let output = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        // ignore
      }
      throw createError(413, "Upstream response too large.");
    }
    output += decoder.decode(value, { stream: true });
  }

  output += decoder.decode();
  return output;
}

async function fetchRemote(target) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let upstream;
  try {
    upstream = await fetch(target.href, {
      headers: {
        "User-Agent": "duocalculator/1.0 (+https://github.com/duocalculator)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw createError(504, "DuolingoData.com request timed out.");
    }
    throw createError(502, "Failed to reach DuolingoData.com.");
  } finally {
    clearTimeout(timer);
  }

  const bodyText = await readTextWithLimit(upstream, MAX_RESPONSE_BYTES);
  return { upstream, bodyText };
}

module.exports = async function proxyHandler(req, res) {
  if (req.method && req.method.toUpperCase() === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.end();
    return;
  }

  if (req.method && req.method.toUpperCase() !== "GET") {
    sendJson(res, 405, { error: "Only GET requests are supported." });
    return;
  }

  const rateCheck = checkRateLimit(req);
  if (!rateCheck.allowed) {
    sendJson(res, 429, { error: "Too many requests. Please try again later." });
    return;
  }

  const query = req.query || {};
  const targetUrl = query.url;
  if (!targetUrl) {
    sendJson(res, 400, { error: "Missing url parameter." });
    return;
  }

  try {
    const target = resolveTarget(targetUrl);
    const { upstream, bodyText } = await fetchRemote(target);
    if (!upstream.ok) {
      sendJson(res, upstream.status, {
        error: `Upstream responded with status ${upstream.status}`,
      });
      return;
    }

    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
    sendJson(res, 200, {
      url: target.href,
      body: bodyText,
      status: upstream.status,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    sendJson(res, statusCode, { error: error.message || "Proxy error." });
  }
};

module.exports.resolveTarget = resolveTarget;
