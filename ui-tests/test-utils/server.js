// Minimal server lifecycle helper for Playwright.
const { spawn } = require('child_process');
const fs = require('fs/promises');
const net = require('net');
const path = require('path');

const { projectRoot, tmpDir } = require('./paths');

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function getAvailablePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close((err) => {
        if (err) return reject(err);
        if (!port) return reject(new Error('Unable to determine ephemeral port'));
        resolve(port);
      });
    });
  });
}

async function waitForReady(url, { timeoutMs = 30_000 } = {}) {
  const start = Date.now();
  // Node >=18 has global fetch.
  // eslint-disable-next-line no-undef
  while (Date.now() - start < timeoutMs) {
    try {
      // eslint-disable-next-line no-undef
      const res = await fetch(url, { redirect: 'follow' });
      if (res.ok) return;
    } catch (e) {
      // ignore and retry
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Server did not become ready in ${timeoutMs}ms: ${url}`);
}

function pidFilePath() {
  return path.join(tmpDir(), 'server.pid');
}

function baseUrlFilePath() {
  return path.join(tmpDir(), 'baseUrl.txt');
}

async function startServer() {
  await ensureDir(tmpDir());

  const port = await getAvailablePort();
  const baseUrl = `http://127.0.0.1:${port}`;

  const child = spawn(process.execPath, ['server.js'], {
    cwd: projectRoot(),
    env: {
      ...process.env,
      PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const serverLogs = [];
  child.stdout.on('data', (buf) => serverLogs.push(`[stdout] ${buf.toString('utf8')}`));
  child.stderr.on('data', (buf) => serverLogs.push(`[stderr] ${buf.toString('utf8')}`));

  await fs.writeFile(pidFilePath(), String(child.pid), 'utf8');
  await fs.writeFile(baseUrlFilePath(), baseUrl, 'utf8');

  try {
    await waitForReady(`${baseUrl}/`);
  } catch (err) {
    // Best effort cleanup + include logs.
    try {
      child.kill('SIGTERM');
    } catch (_) {}
    const logText = serverLogs.join('');
    throw new Error(`${err.message}\n\nServer logs:\n${logText}`);
  }

  return { baseUrl, pid: child.pid };
}

async function readBaseUrl() {
  const text = await fs.readFile(baseUrlFilePath(), 'utf8');
  return text.trim();
}

async function stopServer() {
  let pidRaw;
  try {
    pidRaw = await fs.readFile(pidFilePath(), 'utf8');
  } catch (e) {
    return;
  }

  const pid = Number(pidRaw);
  if (!pid) return;

  try {
    process.kill(pid, 'SIGTERM');
  } catch (e) {
    // already stopped
  }

  // Remove temp files.
  await Promise.allSettled([
    fs.rm(pidFilePath(), { force: true }),
    fs.rm(baseUrlFilePath(), { force: true }),
  ]);
}

module.exports = {
  startServer,
  stopServer,
  readBaseUrl,
};
