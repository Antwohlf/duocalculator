/**
 * HTTP fetching with retries and rate limiting
 * Part of duocalculator scraper
 */

import fetch from 'node-fetch';

const USER_AGENT = process.env.USER_AGENT || 
  'duocalculator-scraper/1.0 (+https://github.com/duocalculator)';

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
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    ...options.headers,
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, { 
        ...options, 
        headers,
        timeout: 30000, // 30 second timeout
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.text();
    } catch (error) {
      const isLastAttempt = attempt === retries;
      
      if (isLastAttempt) {
        throw new Error(`Failed to fetch ${url} after ${retries} attempts: ${error.message}`);
      }
      
      // Exponential backoff: 2s, 4s, 8s... capped at 10s
      const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
      console.log(`   ⚠️  Retry ${attempt}/${retries} for ${url} (waiting ${delay}ms)`);
      await sleep(delay);
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
  return new Promise(resolve => setTimeout(resolve, ms));
}

export { sleep };
