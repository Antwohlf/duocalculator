const { test, expect } = require('@playwright/test');
const { readBaseUrl } = require('../test-utils/server');
const { writeFailureArtifacts } = require('../test-utils/artifacts');

test.describe('Reset Functionality', () => {
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

  /**
   * Helper to select a complete course
   */
  async function selectCourse(page) {
    const fromSelect = page.locator('#from-lang-select');
    const toSelect = page.locator('#to-lang-select');
    const sectionSelect = page.locator('#section-select');
    const unitSelect = page.locator('#unit-select');

    await expect
      .poll(async () => fromSelect.locator('option:not([value=""])').count())
      .toBeGreaterThan(0);
    const firstFromLang = await fromSelect.locator('option:not([value=""])').first().getAttribute('value');
    await fromSelect.selectOption(firstFromLang);

    await expect
      .poll(async () => toSelect.locator('option:not([value=""])').count())
      .toBeGreaterThan(0);
    const firstToLang = await toSelect.locator('option:not([value=""])').first().getAttribute('value');
    await toSelect.selectOption(firstToLang);

    await expect
      .poll(async () => sectionSelect.locator('option:not([value=""])').count())
      .toBeGreaterThan(0);
    const firstSection = await sectionSelect.locator('option:not([value=""])').first().getAttribute('value');
    await sectionSelect.selectOption(firstSection);

    await expect
      .poll(async () => unitSelect.locator('option:not([value=""])').count())
      .toBeGreaterThan(0);
    const firstUnit = await unitSelect.locator('option:not([value=""])').first().getAttribute('value');
    await unitSelect.selectOption(firstUnit);
  }

  test('Reset on finish tab reverts form to defaults', async ({ page }) => {
    const baseUrl = await readBaseUrl();
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    await selectCourse(page);

    // Modify inputs
    const minutesPerDay = page.locator('#minutes-per-day');
    const minutesPerActivity = page.locator('#minutes-per-activity');
    
    await minutesPerDay.fill('120');
    await minutesPerActivity.fill('7');

    // Verify changes took effect
    await expect(minutesPerDay).toHaveValue('120');
    await expect(minutesPerActivity).toHaveValue('7');

    // Verify results are populated
    const resultHeadline = page.locator('#result-headline');
    await expect(resultHeadline).not.toContainText('Pick languages');

    // Click reset button in finish panel
    const resetButton = page.locator('#panel-finish [data-reset]');
    await resetButton.click();

    // Wait for reset to complete - explicitly wait for values to change
    await expect(minutesPerDay).toHaveValue('30', { timeout: 10000 });
    await expect(minutesPerActivity).toHaveValue('3.5', { timeout: 10000 });

    // Results should show placeholder
    await expect(resultHeadline).toContainText('Pick languages');

    // Stats should be reset to placeholders
    await expect(page.locator('#stat-finish-date')).toHaveText('—');
    await expect(page.locator('#stat-lessons-left')).toHaveText('—');
    await expect(page.locator('#stat-minutes-day')).toHaveText('—');

    // Selects should be reset
    const fromSelect = page.locator('#from-lang-select');
    const toSelect = page.locator('#to-lang-select');
    await expect(fromSelect).toHaveValue('');
    await expect(toSelect).toBeDisabled();
  });

  test('Reset on pace tab reverts form to defaults', async ({ page }) => {
    const baseUrl = await readBaseUrl();
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    // Switch to pace tab
    const paceTab = page.locator('#tab-pace');
    await paceTab.click();

    const pacePanel = page.locator('#panel-pace');
    await expect(pacePanel).toBeVisible();

    await selectCourse(page);

    // Modify inputs
    const targetDays = page.locator('#target-days');
    const minutesPerActivity = page.locator('#minutes-per-activity');
    
    await targetDays.fill('30');
    await minutesPerActivity.fill('7');

    // Verify changes took effect
    await expect(targetDays).toHaveValue('30');
    await expect(minutesPerActivity).toHaveValue('7');

    // Verify results are populated
    const resultHeadline = page.locator('#result-headline');
    await expect(resultHeadline).not.toContainText('Pick languages');

    // Click reset button in pace panel
    const resetButton = page.locator('#panel-pace [data-reset]');
    await resetButton.click();

    // Wait for reset to complete - explicitly wait for values to change
    await expect(targetDays).toHaveValue('90', { timeout: 10000 });
    await expect(minutesPerActivity).toHaveValue('3.5', { timeout: 10000 });

    // Results should show placeholder
    await expect(resultHeadline).toContainText('Pick languages');

    // Stats should be reset
    await expect(page.locator('#stat-finish-date')).toHaveText('—');
    await expect(page.locator('#stat-lessons-left')).toHaveText('—');
    await expect(page.locator('#stat-minutes-day')).toHaveText('—');

    // Selects should be reset
    const fromSelect = page.locator('#from-lang-select');
    const toSelect = page.locator('#to-lang-select');
    await expect(fromSelect).toHaveValue('');
    await expect(toSelect).toBeDisabled();
  });

  test('Reset clears all form fields including selects', async ({ page }) => {
    const baseUrl = await readBaseUrl();
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    await selectCourse(page);

    const fromSelect = page.locator('#from-lang-select');
    const toSelect = page.locator('#to-lang-select');
    const sectionSelect = page.locator('#section-select');
    const unitSelect = page.locator('#unit-select');

    // Verify all selects have values
    await expect(fromSelect).not.toHaveValue('');
    await expect(toSelect).not.toHaveValue('');
    await expect(sectionSelect).not.toHaveValue('');
    await expect(unitSelect).not.toHaveValue('');

    // Click reset
    const resetButton = page.locator('#panel-finish [data-reset]');
    await resetButton.click();

    // Wait for reset to complete - explicitly wait for selects to clear
    await expect(fromSelect).toHaveValue('', { timeout: 10000 });
    await expect(toSelect).toHaveValue('', { timeout: 10000 });
    await expect(toSelect).toBeDisabled();
    await expect(sectionSelect).toBeDisabled();
    await expect(unitSelect).toBeDisabled();
  });

  test('Reset persists across tab switches', async ({ page }) => {
    const baseUrl = await readBaseUrl();
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    await selectCourse(page);

    // Reset on finish tab
    const resetButton = page.locator('#panel-finish [data-reset]');
    const fromSelect = page.locator('#from-lang-select');
    await resetButton.click();
    
    // Wait for reset to complete
    await expect(fromSelect).toHaveValue('', { timeout: 10000 });

    // Switch to pace tab
    const paceTab = page.locator('#tab-pace');
    await paceTab.click();

    // Results should still be reset
    const resultHeadline = page.locator('#result-headline');
    await expect(resultHeadline).toContainText('Pick languages');

    // Switch back to finish tab
    const finishTab = page.locator('#tab-finish');
    await finishTab.click();

    // Should still be reset
    await expect(resultHeadline).toContainText('Pick languages');
    await expect(fromSelect).toHaveValue('');
  });

  test('Multiple resets work correctly', async ({ page }) => {
    const baseUrl = await readBaseUrl();
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    const resetButton = page.locator('#panel-finish [data-reset]');
    const resultHeadline = page.locator('#result-headline');
    const minutesPerDay = page.locator('#minutes-per-day');

    // First selection and reset
    await selectCourse(page);
    await minutesPerDay.fill('100');
    await resetButton.click();
    await expect(minutesPerDay).toHaveValue('30', { timeout: 10000 });
    await expect(resultHeadline).toContainText('Pick languages');

    // Second selection and reset
    await selectCourse(page);
    await minutesPerDay.fill('200');
    await resetButton.click();
    await expect(minutesPerDay).toHaveValue('30', { timeout: 10000 });
    await expect(resultHeadline).toContainText('Pick languages');
  });

  test('Reset button is visible and accessible', async ({ page }) => {
    const baseUrl = await readBaseUrl();
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    // Finish tab reset button
    const finishResetButton = page.locator('#panel-finish [data-reset]');
    await expect(finishResetButton).toBeVisible();
    await expect(finishResetButton).toBeEnabled();
    await expect(finishResetButton).toContainText('Reset');

    // Switch to pace tab
    const paceTab = page.locator('#tab-pace');
    await paceTab.click();

    // Pace tab reset button
    const paceResetButton = page.locator('#panel-pace [data-reset]');
    await expect(paceResetButton).toBeVisible();
    await expect(paceResetButton).toBeEnabled();
    await expect(paceResetButton).toContainText('Reset');
  });
});
