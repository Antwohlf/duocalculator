import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { fetchWithRetry, RateLimiter } from '../fetcher.js';

function startServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, () => resolve(server));
  });
}

function getUrl(server) {
  const { port } = server.address();
  return `http://127.0.0.1:${port}/`;
}

test('fetchWithRetry returns response body on success', async () => {
  const server = await startServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
  });

  const url = getUrl(server);
  const body = await fetchWithRetry(url, {}, 2);
  assert.equal(body, 'ok');

  await new Promise((resolve) => server.close(resolve));
});

test('fetchWithRetry retries and eventually succeeds', async () => {
  let attempts = 0;
  const server = await startServer((req, res) => {
    attempts += 1;
    if (attempts < 3) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('error');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('success');
  });

  const url = getUrl(server);
  const body = await fetchWithRetry(url, {}, 3);
  assert.equal(body, 'success');
  assert.equal(attempts, 3);

  await new Promise((resolve) => server.close(resolve));
});

test('fetchWithRetry throws after exhausting retries', async () => {
  const server = await startServer((req, res) => {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('nope');
  });

  const url = getUrl(server);
  await assert.rejects(
    () => fetchWithRetry(url, {}, 2),
    (err) => err.message.includes('Failed to fetch')
  );

  await new Promise((resolve) => server.close(resolve));
});

test('RateLimiter enforces minimum delay between requests', async () => {
  const limiter = new RateLimiter(25);
  await limiter.wait();
  const start = Date.now();
  await limiter.wait();
  const elapsed = Date.now() - start;

  assert.ok(elapsed >= 20, `Expected >=20ms delay, got ${elapsed}ms`);
});
