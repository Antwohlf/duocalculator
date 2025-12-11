const BUG_MIN_DESC = 20;
const BUG_MAX_DESC = 2000;
const BUG_MAX_EMAIL = 254;
const RESEND_ENDPOINT = "https://api.resend.com/emails";

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req
      .on("data", (chunk) => chunks.push(chunk))
      .on("end", () => {
        try {
          const raw = Buffer.concat(chunks).toString("utf8") || "{}";
          resolve(JSON.parse(raw));
        } catch (error) {
          reject(new Error("Invalid JSON payload."));
        }
      })
      .on("error", reject);
  });
}

function validatePayload(body) {
  if (!body || typeof body !== "object") {
    return { valid: false, message: "Missing request body." };
  }
  const description = (body.description || "").trim();
  const userEmail = (body.userEmail || "").trim().slice(0, BUG_MAX_EMAIL);

  if (description.length < BUG_MIN_DESC) {
    return { valid: false, message: `Description must be at least ${BUG_MIN_DESC} characters.` };
  }
  if (description.length > BUG_MAX_DESC) {
    return { valid: false, message: `Description must be under ${BUG_MAX_DESC} characters.` };
  }
  return { valid: true, description, userEmail };
}

function buildEmail({ description, userEmail, pageUrl, userAgent }) {
  const from = process.env.RESEND_FROM;
  const to = process.env.RESEND_TO;
  const apiKey = process.env.RESEND_API_KEY;

  if (!from || !to || !apiKey) {
    throw new Error("Missing RESEND_API_KEY, RESEND_FROM, or RESEND_TO environment variables.");
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

  let body;
  try {
    body = await parseBody(req);
  } catch (error) {
    sendJson(res, 400, { error: error.message });
    return;
  }

  const { valid, message, description, userEmail } = validatePayload(body);
  if (!valid) {
    sendJson(res, 400, { error: message });
    return;
  }

  const pageUrl = typeof body.pageUrl === "string" ? body.pageUrl.slice(0, 2048) : "";
  const userAgent = typeof body.userAgent === "string" ? body.userAgent.slice(0, 512) : "";

  let email;
  try {
    email = buildEmail({ description, userEmail, pageUrl, userAgent });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
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
