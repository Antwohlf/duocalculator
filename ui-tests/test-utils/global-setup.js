const fs = require('fs/promises');
const path = require('path');

const { startServer } = require('./server');
const { artifactsDir } = require('./paths');

module.exports = async () => {
  // Ensure artifact dirs exist (Playwright's junit reporter does not always create parents).
  await fs.mkdir(path.join(artifactsDir(), 'junit'), { recursive: true });
  await fs.mkdir(path.join(artifactsDir(), 'failures'), { recursive: true });

  const { baseUrl } = await startServer();
  // Helpful for debugging; tests read from tmp file.
  process.env.DUO_BASE_URL = baseUrl;
};
