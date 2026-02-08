// @ts-check
const path = require('path');

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  testDir: path.join(__dirname, 'tests'),
  timeout: 60_000,
  expect: {
    timeout: 30_000,
  },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ['list'],
    [
      'junit',
      {
        outputFile: path.join(__dirname, 'artifacts', 'junit', 'results.xml'),
      },
    ],
  ],
  outputDir: path.join(__dirname, 'test-results'),
  use: {
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 720 },
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  globalSetup: path.join(__dirname, 'test-utils', 'global-setup.js'),
  globalTeardown: path.join(__dirname, 'test-utils', 'global-teardown.js'),
};

module.exports = config;
