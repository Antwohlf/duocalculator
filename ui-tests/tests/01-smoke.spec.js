const { test, expect } = require('@playwright/test');
const { readBaseUrl } = require('../test-utils/server');
const { writeFailureArtifacts } = require('../test-utils/artifacts');

test.describe('DuoCalculator Smoke Tests', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const consoleLines = [];

    page.on('console', (msg) => {
      const loc = msg.location();
      const where = loc && loc.url ? ` (${loc.url}:${loc.lineNumber ?? 0}:${loc.columnNumber ?? 0})` : '';
      consoleLines.push(`[console:${msg.type()}] ${msg.text()}${where}`);
    });

    page.on('pageerror', (err) => {
      consoleLines.push(`[pageerror] ${String(err && err.stack ? err.stack : err)}`);
    });

    testInfo._duoConsoleLines = consoleLines;
  });

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status === 'failed' || testInfo.status === 'timedOut') {
      const consoleLines = testInfo._duoConsoleLines || [];
      await writeFailureArtifacts({ page, testInfo, consoleLines });
    }
  });

  test('Page loads without JavaScript errors', async ({ page }, testInfo) => {
    const baseUrl = await readBaseUrl();
    const consoleLines = testInfo._duoConsoleLines;

    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    // Wait for app to initialize
    await page.waitForSelector('.app', { state: 'visible' });

    // Check page title
    await expect(page).toHaveTitle('DuoCalculator');

    // Verify no console errors (filter out non-error messages)
    const errors = consoleLines.filter(line => 
      line.includes('[console:error]') || line.includes('[pageerror]')
    );
    expect(errors.length, `Console errors detected:\n${errors.join('\n')}`).toBe(0);
  });

  test('Brand elements are visible and correct', async ({ page }) => {
    const baseUrl = await readBaseUrl();
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    // Brand logo
    const logo = page.locator('.brand-mascot');
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute('src', 'assets/logo.png');
    await expect(logo).toHaveAttribute('alt', 'DuoCalculator logo');

    // Brand name
    const brandName = page.locator('.brand-name');
    await expect(brandName).toBeVisible();
    await expect(brandName).toHaveText('DuoCalculator');

    // Brand tagline
    const tagline = page.locator('.brand-tagline');
    await expect(tagline).toBeVisible();
    await expect(tagline).toContainText('Plan your language learning journey');
  });

  test('From-language select populates on load', async ({ page }) => {
    const baseUrl = await readBaseUrl();
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    const fromSelect = page.locator('#from-lang-select');
    await expect(fromSelect).toBeEnabled();

    // Wait for languages to load
    await expect
      .poll(async () => fromSelect.locator('option:not([value=""])').count())
      .toBeGreaterThan(5);
  });

  test('Initial results placeholder is shown', async ({ page }) => {
    const baseUrl = await readBaseUrl();
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    // Wait for app to fully initialize
    await page.waitForSelector('.app', { state: 'visible' });

    const headline = page.locator('#result-headline');
    await expect(headline).toBeVisible();
    await expect(headline).toContainText('Pick languages');

    // Stats should show placeholders
    await expect(page.locator('#stat-finish-date')).toHaveText('—');
    await expect(page.locator('#stat-lessons-left')).toHaveText('—');
    await expect(page.locator('#stat-minutes-day')).toHaveText('—');
  });

  test('Footer renders with correct text', async ({ page }) => {
    const baseUrl = await readBaseUrl();
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    const footer = page.locator('.app-footer');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText('Unofficial calculator');
    await expect(footer).toContainText('DuolingoData.com');

    // Bug report button should be in footer
    const bugButton = page.locator('#bug-report-trigger');
    await expect(bugButton).toBeVisible();
    await expect(bugButton).toContainText('Report bug');
  });

  test('Data verified badge shows timestamp', async ({ page }) => {
    const baseUrl = await readBaseUrl();
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    const badge = page.locator('#data-verified-badge');
    await expect(badge).toBeVisible();

    const timeEl = page.locator('#last-updated-time');
    await expect(timeEl).toBeVisible();

    // Wait for JS to set datetime attribute
    await expect
      .poll(async () => (await timeEl.getAttribute('datetime')) || '')
      .not.toBe('');
  });
});
