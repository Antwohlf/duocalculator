// URL helper that works for both local and production testing
const { readBaseUrl } = require('./server');

/**
 * Get the base URL for tests.
 * - In local mode: reads from temp file (set by global-setup)
 * - In production mode: uses baseURL from playwright config
 */
async function getBaseUrl(page) {
  // If page has baseURL configured (production mode), use that
  if (page.context().baseURL) {
    return page.context().baseURL;
  }
  
  // Otherwise read from temp file (local mode)
  return await readBaseUrl();
}

module.exports = {
  getBaseUrl,
};
