const ALLOWED_HOSTS = new Set(["duolingodata.com", "www.duolingodata.com"]);
const REMOTE_BASE = "https://duolingodata.com/";

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
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

async function fetchRemote(target) {
  let upstream;
  try {
    upstream = await fetch(target.href, {
      headers: {
        "User-Agent": "duocalculator/1.0 (+https://github.com/duocalculator)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
  } catch (error) {
    throw createError(502, "Failed to reach DuolingoData.com.");
  }

  const bodyText = await upstream.text();
  return { upstream, bodyText };
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
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
