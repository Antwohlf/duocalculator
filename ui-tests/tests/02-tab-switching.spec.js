const { test, expect } = require('@playwright/test');
const { readBaseUrl } = require('../test-utils/server');
const { writeFailureArtifacts } = require('../test-utils/artifacts');

test.describe('Tab Switching', () => {
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

  test('Default tab is "finish"', async ({ page }) => {
    const baseUrl = await readBaseUrl();
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    const finishTab = page.locator('#tab-finish');
    const finishPanel = page.locator('#panel-finish');
    const pacePanel = page.locator('#panel-pace');

    // Finish tab should be selected
    await expect(finishTab).toHaveAttribute('aria-selected', 'true');
    await expect(finishPanel).toBeVisible();
    await expect(finishPanel).not.toHaveAttribute('hidden');

    // Pace panel should be hidden
    await expect(pacePanel).toHaveAttribute('hidden');
  });

  test('Click "pace" tab switches to pace mode', async ({ page }) => {
    const baseUrl = await readBaseUrl();
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    const finishTab = page.locator('#tab-finish');
    const paceTab = page.locator('#tab-pace');
    const finishPanel = page.locator('#panel-finish');
    const pacePanel = page.locator('#panel-pace');

    // Click pace tab
    await paceTab.click();

    // Pace tab should now be selected
    await expect(paceTab).toHaveAttribute('aria-selected', 'true');
    await expect(finishTab).toHaveAttribute('aria-selected', 'false');

    // Pace panel should be visible, finish hidden
    await expect(pacePanel).toBeVisible();
    await expect(pacePanel).not.toHaveAttribute('hidden');
    await expect(finishPanel).toHaveAttribute('hidden');

    // Verify pace-specific input is visible
    const targetDaysInput = page.locator('#target-days');
    await expect(targetDaysInput).toBeVisible();
    await expect(targetDaysInput).toHaveValue('90'); // default value
  });

  test('Click back to "finish" tab', async ({ page }) => {
    const baseUrl = await readBaseUrl();
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    const finishTab = page.locator('#tab-finish');
    const paceTab = page.locator('#tab-pace');
    const finishPanel = page.locator('#panel-finish');
    const pacePanel = page.locator('#panel-pace');

    // Switch to pace
    await paceTab.click();
    await expect(pacePanel).toBeVisible();

    // Switch back to finish
    await finishTab.click();

    // Finish tab should be selected again
    await expect(finishTab).toHaveAttribute('aria-selected', 'true');
    await expect(paceTab).toHaveAttribute('aria-selected', 'false');

    // Finish panel should be visible, pace hidden
    await expect(finishPanel).toBeVisible();
    await expect(finishPanel).not.toHaveAttribute('hidden');
    await expect(pacePanel).toHaveAttribute('hidden');

    // Verify finish-specific input is visible
    const minutesPerDayInput = page.locator('#minutes-per-day');
    await expect(minutesPerDayInput).toBeVisible();
    await expect(minutesPerDayInput).toHaveValue('30'); // default value
  });

  test('Keyboard navigation: Tab + Enter switches tabs', async ({ page }) => {
    const baseUrl = await readBaseUrl();
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    const finishTab = page.locator('#tab-finish');
    const paceTab = page.locator('#tab-pace');
    const pacePanel = page.locator('#panel-pace');

    // Focus on finish tab
    await finishTab.focus();
    await expect(finishTab).toBeFocused();

    // Tab to pace button
    await page.keyboard.press('Tab');
    await expect(paceTab).toBeFocused();

    // Press Enter to activate
    await page.keyboard.press('Enter');

    // Pace panel should now be visible
    await expect(paceTab).toHaveAttribute('aria-selected', 'true');
    await expect(pacePanel).toBeVisible();
  });

  test('Tab state persists when toggling multiple times', async ({ page }) => {
    const baseUrl = await readBaseUrl();
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    const finishTab = page.locator('#tab-finish');
    const paceTab = page.locator('#tab-pace');
    const finishPanel = page.locator('#panel-finish');
    const pacePanel = page.locator('#panel-pace');

    // Toggle multiple times
    await paceTab.click();
    await expect(pacePanel).toBeVisible();

    await finishTab.click();
    await expect(finishPanel).toBeVisible();

    await paceTab.click();
    await expect(pacePanel).toBeVisible();

    await finishTab.click();
    await expect(finishPanel).toBeVisible();

    // Final state should be finish
    await expect(finishTab).toHaveAttribute('aria-selected', 'true');
    await expect(finishPanel).not.toHaveAttribute('hidden');
  });
});
