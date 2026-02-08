/**
 * HTTP fetching with retries and rate limiting
 * Part of duocalculator scraper
 */

import fetch from 'node-fetch';

const USER_AGENT =
  process.env.USER_AGENT || 'duocalculator-scraper/1.0 (+https://github.com/duocalculator)';

const DEFAULT_TIMEOUT_MS = 30000;

function parseRetryAfterMs(retryAfter) {
  if (!retryAfter || typeof retryAfter !== 'string') return null;
  const trimmed = retryAfter.trim();
  if (!trimmed) return null;

  // "Retry-After" can be seconds or an HTTP date.
  const seconds = Number(trimmed);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000);
  }

  const dateMs = Date.parse(trimmed);
  if (Number.isFinite(dateMs)) {
    const delta = dateMs - Date.now();
    return delta > 0 ? delta : 0;
  }

  return null;
}

/**
 * Fetch a URL with exponential backoff retry logic
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options
 * @param {number} retries - Number of retry attempts
 * @returns {Promise<string>} - Response text
 */
export async function fetchWithRetry(url, options = {}, retries = 3) {
  const headers = {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    ...options.headers,
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutMs =
      typeof options.timeoutMs === 'number' && Number.isFinite(options.timeoutMs)
        ? options.timeoutMs
        : DEFAULT_TIMEOUT_MS;

    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      if (response.status === 429) {
        const retryAfterHeader = response.headers.get('retry-after');
        const retryAfterMs = parseRetryAfterMs(retryAfterHeader);

        if (attempt === retries) {
          throw new Error('HTTP 429: Too Many Requests');
        }

        const fallbackDelay = Math.min(1000 * Math.pow(2, attempt), 10000);
        const delay = Math.min(retryAfterMs ?? fallbackDelay, 60000);
        console.log(
          `   ⏳ HTTP 429 for ${url} (Retry-After: ${retryAfterHeader || 'n/a'}). Waiting ${delay}ms...`,
        );
        await sleep(delay);
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      const isLastAttempt = attempt === retries;

      if (isLastAttempt) {
        const message = error?.name === 'AbortError' ? 'Request timed out' : error.message;
        throw new Error(`Failed to fetch ${url} after ${retries} attempts: ${message}`);
      }

      // Exponential backoff: 2s, 4s, 8s... capped at 10s
      const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
      console.log(`   ⚠️  Retry ${attempt}/${retries} for ${url} (waiting ${delay}ms)`);
      await sleep(delay);
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Rate limiter to space out HTTP requests
 */
export class RateLimiter {
  /**
   * @param {number} minDelayMs - Minimum milliseconds between requests
   */
  constructor(minDelayMs) {
    this.minDelayMs = minDelayMs;
    this.lastRequest = 0;
  }

  /**
   * Wait until it's safe to make another request
   */
  async wait() {
    const now = Date.now();
    const elapsed = now - this.lastRequest;

    if (elapsed < this.minDelayMs) {
      const waitTime = this.minDelayMs - elapsed;
      await sleep(waitTime);
    }

    this.lastRequest = Date.now();
  }
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { sleep };
