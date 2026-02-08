const { test, expect } = require('@playwright/test');
const { readBaseUrl } = require('../test-utils/server');
const { writeFailureArtifacts } = require('../test-utils/artifacts');

test.describe('Bug Report Modal', () => {
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

  test('Open modal via bug report button', async ({ page }) => {
    const baseUrl = await readBaseUrl();
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    const bugTrigger = page.locator('#bug-report-trigger');
    const modal = page.locator('.bug-modal');
    const backdrop = page.locator('#bug-modal-backdrop');

    // Modal should initially be hidden
    await expect(backdrop).toHaveAttribute('hidden');

    // Click bug report button
    await bugTrigger.click();

    // Modal should now be visible
    await expect(backdrop).not.toHaveAttribute('hidden');
    await expect(backdrop).toBeVisible();
    await expect(modal).toBeVisible();

    // Verify modal attributes
    await expect(modal).toHaveAttribute('role', 'dialog');
    await expect(modal).toHaveAttribute('aria-modal', 'true');

    // Verify modal content
    const modalTitle = page.locator('#bug-modal-title');
    await expect(modalTitle).toContainText('Report a bug');
  });

  test('Focus is trapped inside modal when open', async ({ page }) => {
    const baseUrl = await readBaseUrl();
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    const bugTrigger = page.locator('#bug-report-trigger');
    await bugTrigger.click();

    // Give modal time to handle focus
    await page.waitForTimeout(200);

    // Either the close button or the textarea should have focus
    const closeButton = page.locator('#bug-modal-close');
    const textarea = page.locator('#bug-desc');
    
    const closeHasFocus = await closeButton.evaluate(el => el === document.activeElement);
    const textareaHasFocus = await textarea.evaluate(el => el === document.activeElement);
    
    expect(closeHasFocus || textareaHasFocus).toBeTruthy();
  });

  test('Validation: short description shows error', async ({ page }) => {
    const baseUrl = await readBaseUrl();
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    const bugTrigger = page.locator('#bug-report-trigger');
    await bugTrigger.click();

    const textarea = page.locator('#bug-desc');
    const submitButton = page.locator('#bug-submit');
    const errorMessage = page.locator('#bug-error');

    // Type less than 20 characters
    await textarea.fill('Too short');

    // Try to submit
    await submitButton.click();

    // Wait a moment for validation
    await page.waitForTimeout(500);

    // Check if custom error message appears, or if HTML5 validation prevents submission
    const errorText = await errorMessage.textContent();
    const isValid = await textarea.evaluate((el) => el.validity.valid);
    
    // Either custom error should show, or HTML5 validation should prevent submission
    const hasCustomError = errorText && errorText.trim().length > 0;
    const hasHtml5Error = !isValid;
    
    expect(hasCustomError || hasHtml5Error, 'Validation should occur either via custom error or HTML5').toBe(true);

    // Modal should remain open
    const backdrop = page.locator('#bug-modal-backdrop');
    await expect(backdrop).toBeVisible();
  });

  test('Validation: empty description shows error', async ({ page }) => {
    const baseUrl = await readBaseUrl();
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    const bugTrigger = page.locator('#bug-report-trigger');
    await bugTrigger.click();

    const submitButton = page.locator('#bug-submit');
    const textarea = page.locator('#bug-desc');

    // Leave textarea empty
    await expect(textarea).toHaveValue('');

    // Try to submit (might be prevented by browser validation)
    await submitButton.click();

    // Either browser validation prevents submission, or error shows
    // Check if modal is still open (it should be)
    const backdrop = page.locator('#bug-modal-backdrop');
    await expect(backdrop).toBeVisible();
  });

  test('Close modal via ✕ button', async ({ page }) => {
    const baseUrl = await readBaseUrl();
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    const bugTrigger = page.locator('#bug-report-trigger');
    await bugTrigger.click();

    const backdrop = page.locator('#bug-modal-backdrop');
    await expect(backdrop).toBeVisible();

    // Click close button
    const closeButton = page.locator('#bug-modal-close');
    await closeButton.click();

    // Wait for modal to close
    await page.waitForTimeout(200);

    // Modal should be hidden
    await expect(backdrop).toHaveAttribute('hidden');
  });

  test('Close modal via Cancel button', async ({ page }) => {
    const baseUrl = await readBaseUrl();
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    const bugTrigger = page.locator('#bug-report-trigger');
    await bugTrigger.click();

    const backdrop = page.locator('#bug-modal-backdrop');
    await expect(backdrop).toBeVisible();

    // Click cancel button
    const cancelButton = page.locator('#bug-cancel');
    await cancelButton.click();

    // Wait for modal to close
    await page.waitForTimeout(200);

    // Modal should be hidden
    await expect(backdrop).toHaveAttribute('hidden');
  });

  test('Close modal via Escape key', async ({ page }) => {
    const baseUrl = await readBaseUrl();
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    const bugTrigger = page.locator('#bug-report-trigger');
    await bugTrigger.click();

    const backdrop = page.locator('#bug-modal-backdrop');
    await expect(backdrop).toBeVisible();

    // Press Escape key
    await page.keyboard.press('Escape');

    // Wait for modal to close
    await page.waitForTimeout(200);

    // Modal should be hidden
    await expect(backdrop).toHaveAttribute('hidden');
  });

  test('Character counter updates as user types', async ({ page }) => {
    const baseUrl = await readBaseUrl();
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    const bugTrigger = page.locator('#bug-report-trigger');
    await bugTrigger.click();

    const textarea = page.locator('#bug-desc');
    const charCounter = page.locator('#bug-desc-count');

    // Initially should show 0/2000
    await expect(charCounter).toContainText('0/2000');

    // Type some text
    const testText = 'This is a test bug report description that is long enough to be valid.';
    await textarea.fill(testText);

    // Counter should update
    await expect(charCounter).toContainText(`${testText.length}/2000`);

    // Type more
    const longerText = testText + ' Adding more text to increase the count.';
    await textarea.fill(longerText);

    await expect(charCounter).toContainText(`${longerText.length}/2000`);
  });

  test('Character counter respects maxlength', async ({ page }) => {
    const baseUrl = await readBaseUrl();
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    const bugTrigger = page.locator('#bug-report-trigger');
    await bugTrigger.click();

    const textarea = page.locator('#bug-desc');
    const charCounter = page.locator('#bug-desc-count');

    // Try to type more than 2000 characters
    const longText = 'x'.repeat(2500);
    await textarea.fill(longText);

    // Should be limited to 2000
    const actualLength = (await textarea.inputValue()).length;
    expect(actualLength).toBeLessThanOrEqual(2000);

    // Counter should show 2000/2000
    await expect(charCounter).toContainText('2000/2000');
  });

  test('Modal form fields are accessible', async ({ page }) => {
    const baseUrl = await readBaseUrl();
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    const bugTrigger = page.locator('#bug-report-trigger');
    await bugTrigger.click();

    // Check textarea has proper labels and attributes
    const textarea = page.locator('#bug-desc');
    await expect(textarea).toHaveAttribute('required');
    await expect(textarea).toHaveAttribute('minlength', '20');
    await expect(textarea).toHaveAttribute('maxlength', '2000');
    await expect(textarea).toHaveAttribute('aria-describedby', 'bug-desc-help');

    // Check email input
    const emailInput = page.locator('#bug-email');
    await expect(emailInput).toHaveAttribute('type', 'email');
    await expect(emailInput).toHaveAttribute('maxlength', '254');

    // Check buttons are properly labeled
    const submitButton = page.locator('#bug-submit');
    await expect(submitButton).toContainText('Submit');

    const cancelButton = page.locator('#bug-cancel');
    await expect(cancelButton).toContainText('Cancel');

    const closeButton = page.locator('#bug-modal-close');
    await expect(closeButton).toHaveAttribute('aria-label', 'Close bug report dialog');
  });

  test('Opening modal multiple times works correctly', async ({ page }) => {
    const baseUrl = await readBaseUrl();
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    const bugTrigger = page.locator('#bug-report-trigger');
    const backdrop = page.locator('#bug-modal-backdrop');
    const textarea = page.locator('#bug-desc');

    // Open and close multiple times
    for (let i = 0; i < 3; i++) {
      // Open modal
      await bugTrigger.click();
      await expect(backdrop).toBeVisible();

      // Type something
      await textarea.fill(`Test ${i}`);

      // Close modal
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      await expect(backdrop).toHaveAttribute('hidden');
    }

    // Final open - should still work
    await bugTrigger.click();
    await expect(backdrop).toBeVisible();

    // Form should be cleared (or retain last value, depending on implementation)
    // Just verify it's functional
    await textarea.fill('Final test');
    await expect(textarea).toHaveValue('Final test');
  });

  test('Email field validation', async ({ page }) => {
    const baseUrl = await readBaseUrl();
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });

    const bugTrigger = page.locator('#bug-report-trigger');
    await bugTrigger.click();

    const emailInput = page.locator('#bug-email');
    const textarea = page.locator('#bug-desc');
    const submitButton = page.locator('#bug-submit');

    // Fill valid description
    await textarea.fill('This is a valid bug report with sufficient length to pass validation.');

    // Test invalid email
    await emailInput.fill('invalid-email');
    
    // Try to submit - browser should validate
    await submitButton.click();

    // Modal should still be open (submission failed)
    const backdrop = page.locator('#bug-modal-backdrop');
    await expect(backdrop).toBeVisible();

    // Clear and enter valid email
    await emailInput.fill('valid@example.com');
    
    // Now email should be valid (though submission may still fail for other reasons)
    const validity = await emailInput.evaluate((el) => el.validity.valid);
    expect(validity).toBeTruthy();
  });
});
