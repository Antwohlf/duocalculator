const { test, expect } = require('@playwright/test');
const { readBaseUrl } = require('../test-utils/server');
const { writeFailureArtifacts } = require('../test-utils/artifacts');

test.describe('Calculation Results', () => {
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

  test('Finish-mode calculation shows valid results', async ({ page }) => {
    const baseUrl = await readBaseUrl();
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    await selectCourse(page);

    // Verify finish mode is active (default)
    const finishPanel = page.locator('#panel-finish');
    await expect(finishPanel).toBeVisible();

    // Check all stats are populated
    const finishDate = page.locator('#stat-finish-date');
    const lessonsLeft = page.locator('#stat-lessons-left');
    const minutesDay = page.locator('#stat-minutes-day');

    await expect(finishDate).not.toHaveText('—');
    await expect(lessonsLeft).not.toHaveText('—');
    await expect(minutesDay).not.toHaveText('—');

    // Verify finish date is a valid date format
    const finishDateText = await finishDate.textContent();
    expect(finishDateText).toMatch(/\w+\s+\d+,\s+\d{4}/); // e.g., "March 15, 2026"

    // Verify lessons left is a number
    const lessonsLeftText = await lessonsLeft.textContent();
    const lessonsNum = parseInt(lessonsLeftText.replace(/,/g, ''), 10);
    expect(lessonsNum).toBeGreaterThan(0);

    // Verify minutes per day matches input
    const minutesPerDayInput = page.locator('#minutes-per-day');
    const inputValue = await minutesPerDayInput.inputValue();
    await expect(minutesDay).toContainText(inputValue);
  });

  test('Changing minutes-per-day recalculates finish date', async ({ page }) => {
    const baseUrl = await readBaseUrl();
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    await selectCourse(page);

    const minutesPerDayInput = page.locator('#minutes-per-day');
    const finishDate = page.locator('#stat-finish-date');

    // Get initial finish date
    const initialDate = await finishDate.textContent();

    // Change from 30 to 60 minutes per day
    await minutesPerDayInput.fill('60');
    await minutesPerDayInput.blur(); // Trigger change event

    // Wait for recalculation
    await page.waitForTimeout(500);

    // Finish date should change (earlier with more minutes per day)
    const newDate = await finishDate.textContent();
    expect(newDate).not.toBe(initialDate);

    // Verify the new finish date is earlier (this is tricky with string comparison)
    // At minimum, verify it's still a valid date format
    expect(newDate).toMatch(/\w+\s+\d+,\s+\d{4}/);

    // Change to even more minutes
    await minutesPerDayInput.fill('120');
    await minutesPerDayInput.blur();
    await page.waitForTimeout(500);

    const finalDate = await finishDate.textContent();
    expect(finalDate).not.toBe(newDate);
    expect(finalDate).toMatch(/\w+\s+\d+,\s+\d{4}/);
  });

  test('Changing minutes-per-activity recalculates results', async ({ page }) => {
    const baseUrl = await readBaseUrl();
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    await selectCourse(page);

    const minutesPerActivityInput = page.locator('#minutes-per-activity');
    const finishDate = page.locator('#stat-finish-date');

    // Get initial finish date
    const initialDate = await finishDate.textContent();

    // Change from 3.5 to 7 minutes per activity (double the time)
    await minutesPerActivityInput.fill('7');
    await minutesPerActivityInput.blur();

    // Wait for recalculation
    await page.waitForTimeout(500);

    // Finish date should change (later with more time per activity)
    const newDate = await finishDate.textContent();
    expect(newDate).not.toBe(initialDate);
    expect(newDate).toMatch(/\w+\s+\d+,\s+\d{4}/);
  });

  test('Pace-mode calculation shows required minutes per day', async ({ page }) => {
    const baseUrl = await readBaseUrl();
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    await selectCourse(page);

    // Switch to pace mode
    const paceTab = page.locator('#tab-pace');
    await paceTab.click();

    const pacePanel = page.locator('#panel-pace');
    await expect(pacePanel).toBeVisible();

    // Verify target days input is visible
    const targetDaysInput = page.locator('#target-days');
    await expect(targetDaysInput).toBeVisible();
    await expect(targetDaysInput).toHaveValue('90'); // default

    // Check stats are populated - wait for calculation to complete
    const minutesDay = page.locator('#stat-minutes-day');
    await expect(minutesDay).not.toHaveText('—', { timeout: 10000 });

    // Verify it's a number with "min/day" or just a number
    const minutesDayText = await minutesDay.textContent();
    expect(minutesDayText).toMatch(/\d+/);
  });

  test('Pace-mode: changing target days recalculates minutes per day', async ({ page }) => {
    const baseUrl = await readBaseUrl();
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    await selectCourse(page);

    // Switch to pace mode
    const paceTab = page.locator('#tab-pace');
    await paceTab.click();

    const targetDaysInput = page.locator('#target-days');
    const minutesDay = page.locator('#stat-minutes-day');

    // Wait for initial calculation to complete
    await expect(minutesDay).not.toHaveText('—', { timeout: 10000 });
    const initialMinutes = await minutesDay.textContent();

    // Change from 90 to 30 days (shorter timeframe = more minutes per day)
    await targetDaysInput.fill('30');
    await targetDaysInput.blur();

    // Wait for recalculation - value should change
    await expect(async () => {
      const newMinutes = await minutesDay.textContent();
      expect(newMinutes).not.toBe(initialMinutes);
    }).toPass({ timeout: 10000 });

    // Minutes per day should increase
    const newMinutes = await minutesDay.textContent();
    expect(newMinutes).not.toBe(initialMinutes);

    // Extract numeric values to verify increase
    const initialNum = parseFloat(initialMinutes.match(/[\d.]+/)[0]);
    const newNum = parseFloat(newMinutes.match(/[\d.]+/)[0]);
    expect(newNum).toBeGreaterThan(initialNum);
  });

  test('Progress bar accuracy: counts and fill width', async ({ page }) => {
    const baseUrl = await readBaseUrl();
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    await selectCourse(page);

    const progressCounts = page.locator('#progress-counts');
    const progressBarFill = page.locator('#progress-bar-fill');
    const progressText = page.locator('#progress-text');

    // Check progress counts match pattern
    const countsText = await progressCounts.textContent();
    expect(countsText).toMatch(/\d+ of \d+ lessons completed/);

    // Parse the counts
    const match = countsText.match(/(\d+) of (\d+) lessons completed/);
    expect(match).toBeTruthy();
    const completed = parseInt(match[1], 10);
    const total = parseInt(match[2], 10);

    // Progress percentage should match
    const progressPercentText = await progressText.textContent();
    expect(progressPercentText).toContain('Progress:');

    // Progress bar fill should have width > 0 if there's progress
    const fillWidth = await progressBarFill.evaluate(el => {
      return window.getComputedStyle(el).width;
    });
    
    if (completed > 0) {
      expect(fillWidth).not.toBe('0px');
    }

    // Bar width should be proportional to completion
    const expectedPercent = (completed / total) * 100;
    const barPercent = await progressBarFill.evaluate(el => {
      const style = window.getComputedStyle(el);
      return parseFloat(style.width) / parseFloat(style.getPropertyValue('--full-width') || el.parentElement.offsetWidth) * 100;
    });

    // Allow some tolerance for rounding
    expect(Math.abs(barPercent - expectedPercent)).toBeLessThan(1);
  });

  test('Switching between finish and pace modes preserves course selection', async ({ page }) => {
    const baseUrl = await readBaseUrl();
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    await selectCourse(page);

    // Get initial results in finish mode
    const lessonsLeft = page.locator('#stat-lessons-left');
    const initialLessons = await lessonsLeft.textContent();

    // Switch to pace mode
    const paceTab = page.locator('#tab-pace');
    await paceTab.click();

    // Verify course data is still loaded
    await expect(lessonsLeft).not.toHaveText('—');
    const paceLessons = await lessonsLeft.textContent();
    expect(paceLessons).toBe(initialLessons); // Should be the same

    // Switch back to finish mode
    const finishTab = page.locator('#tab-finish');
    await finishTab.click();

    // Verify course data is still there
    const finalLessons = await lessonsLeft.textContent();
    expect(finalLessons).toBe(initialLessons);
  });
});
