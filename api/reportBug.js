const BUG_MIN_DESC = 20;
const BUG_MAX_DESC = 2000;
const BUG_MAX_EMAIL = 254;
const BUG_MAX_URL = 2048;
const BUG_MAX_UA = 512;
const RESEND_ENDPOINT = "https://api.resend.com/emails";

const MAX_BODY_SIZE = 16 * 1024; // 16 KB
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const RATE_LIMIT_MAX = 5;
const rateLimitMap = new Map();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTROL_CHARS_REGEX = /[\u0000-\u001F\u007F]/;

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

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const lengthHeader = req.headers["content-length"];
    if (lengthHeader) {
      const parsedLength = Number(lengthHeader);
      if (Number.isFinite(parsedLength) && parsedLength > MAX_BODY_SIZE) {
        const error = new Error("Payload too large.");
        error.statusCode = 413;
        reject(error);
        return;
      }
    }

    const chunks = [];
    let received = 0;

    req
      .on("data", (chunk) => {
        received += chunk.length;
        if (received > MAX_BODY_SIZE) {
          const error = new Error("Payload too large.");
          error.statusCode = 413;
          req.destroy(error);
          return;
        }
        chunks.push(chunk);
      })
      .on("end", () => {
        try {
          const raw = Buffer.concat(chunks).toString("utf8") || "{}";
          resolve(JSON.parse(raw));
        } catch (error) {
          const parseError = new Error("Invalid JSON payload.");
          parseError.statusCode = 400;
          reject(parseError);
        }
      })
      .on("error", (error) => {
        if (error?.statusCode) {
          reject(error);
        } else {
          const generic = new Error("Failed to read request body.");
          generic.statusCode = 400;
          reject(generic);
        }
      });
  });
}

function validatePayload(body) {
  if (!body || typeof body !== "object") {
    return { valid: false, message: "Missing request body.", statusCode: 400 };
  }

  const description = typeof body.description === "string" ? body.description.trim() : "";
  const userEmail = typeof body.userEmail === "string" ? body.userEmail.trim() : "";
  const pageUrl = typeof body.pageUrl === "string" ? body.pageUrl.trim() : "";
  const userAgent = typeof body.userAgent === "string" ? body.userAgent.trim() : "";

  if (description.length < BUG_MIN_DESC) {
    return {
      valid: false,
      message: `Description must be at least ${BUG_MIN_DESC} characters.`,
      statusCode: 400,
    };
  }
  if (description.length > BUG_MAX_DESC) {
    return {
      valid: false,
      message: `Description must be under ${BUG_MAX_DESC} characters.`,
      statusCode: 400,
    };
  }
  if (CONTROL_CHARS_REGEX.test(description)) {
    return {
      valid: false,
      message: "Description contains invalid control characters.",
      statusCode: 400,
    };
  }

  if (userEmail) {
    if (userEmail.length > BUG_MAX_EMAIL) {
      return {
        valid: false,
        message: `Email must be under ${BUG_MAX_EMAIL} characters.`,
        statusCode: 400,
      };
    }
    if (!EMAIL_REGEX.test(userEmail)) {
      return { valid: false, message: "Invalid email format.", statusCode: 400 };
    }
  }

  if (pageUrl.length > BUG_MAX_URL) {
    return {
      valid: false,
      message: `URL must be under ${BUG_MAX_URL} characters.`,
      statusCode: 400,
    };
  }

  if (userAgent.length > BUG_MAX_UA) {
    return {
      valid: false,
      message: `User agent must be under ${BUG_MAX_UA} characters.`,
      statusCode: 400,
    };
  }

  return {
    valid: true,
    description,
    userEmail,
    pageUrl,
    userAgent,
  };
}

function buildEmail({ description, userEmail, pageUrl, userAgent }) {
  const from = process.env.RESEND_FROM;
  const to = process.env.RESEND_TO;
  const apiKey = process.env.RESEND_API_KEY;

  if (!from || !to || !apiKey) {
    const error = new Error("Server configuration error.");
    error.statusCode = 500;
    throw error;
  }

  const subject = "DuoCalculator bug report";
  const lines = [
    "New bug report submitted:",
    "",
    `Description:`,
    description,
    "",
    `Page URL: ${pageUrl || "n/a"}`,
    `User agent: ${userAgent || "n/a"}`,
    `User email: ${userEmail || "n/a"}`,
  ];

  const payload = {
    from,
    to: [to],
    subject,
    text: lines.join("\n"),
  };

  if (userEmail) {
    payload.reply_to = [userEmail];
  }

  return { apiKey, payload };
}

async function sendResendEmail({ apiKey, payload }) {
  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  let data = null;
  try {
    data = await response.json();
  } catch (error) {
    // ignore parse errors
  }

  if (!response.ok) {
    const message = data?.message || data?.error || `Resend error (${response.status})`;
    const error = new Error(message);
    error.statusCode = response.status;
    throw error;
  }

  return data;
}

module.exports = async function reportBugHandler(req, res) {
  if (req.method && req.method.toUpperCase() === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.end();
    return;
  }

  if (!req.method || req.method.toUpperCase() !== "POST") {
    sendJson(res, 405, { error: "Only POST requests are supported." });
    return;
  }

  const rateCheck = checkRateLimit(req);
  if (!rateCheck.allowed) {
    sendJson(res, 429, { error: "Too many requests. Please try again later." });
    return;
  }

  let body;
  try {
    body = await parseBody(req);
  } catch (error) {
    const statusCode = error.statusCode || 400;
    sendJson(res, statusCode, { error: error.message || "Invalid request." });
    return;
  }

  const { valid, message, statusCode, description, userEmail, pageUrl, userAgent } =
    validatePayload(body);
  if (!valid) {
    sendJson(res, statusCode || 400, { error: message });
    return;
  }

  let email;
  try {
    email = buildEmail({ description, userEmail, pageUrl, userAgent });
  } catch (error) {
    const status = error.statusCode || 500;
    sendJson(res, status, { error: error.message || "Failed to prepare bug report." });
    return;
  }

  try {
    await sendResendEmail(email);
    sendJson(res, 200, { ok: true });
  } catch (error) {
    const statusCode = error.statusCode || 502;
    sendJson(res, statusCode, { error: error.message || "Failed to send bug report." });
  }
};
