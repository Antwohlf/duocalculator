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
  retries: process.env.CI ? 2 : 1, // More retries for flaky network
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ['list'],
    [
      'junit',
      {
        outputFile: path.join(__dirname, 'artifacts', 'junit', 'results-prod.xml'),
      },
    ],
  ],
  outputDir: path.join(__dirname, 'test-results-prod'),
  use: {
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 720 },
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    // Point to production site
    baseURL: process.env.PROD_URL || 'https://www.duocalculator.com',
  },
  // NO globalSetup/globalTeardown - we don't start a local server
};

module.exports = config;
