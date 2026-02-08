const fs = require('fs/promises');
const path = require('path');

const { artifactsDir } = require('./paths');

function safeSegment(input) {
  return String(input)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function timestampFolder() {
  // e.g. 2026-02-08T15-03-12-123Z
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function writeFailureArtifacts({ page, testInfo, consoleLines }) {
  const folderName = `${timestampFolder()}__${safeSegment(testInfo.title)}`;
  const folder = path.join(artifactsDir(), 'failures', folderName);
  await fs.mkdir(folder, { recursive: true });

  const screenshotPath = path.join(folder, 'screenshot.png');
  const consolePath = path.join(folder, 'console.txt');

  await Promise.allSettled([
    page.screenshot({ path: screenshotPath, fullPage: true }),
    fs.writeFile(consolePath, consoleLines.join('\n') + '\n', 'utf8'),
  ]);

  // Attachments show up in Playwright reporters.
  await testInfo.attach('screenshot', { path: screenshotPath, contentType: 'image/png' });
  await testInfo.attach('console', { path: consolePath, contentType: 'text/plain' });
}

module.exports = {
  writeFailureArtifacts,
};
