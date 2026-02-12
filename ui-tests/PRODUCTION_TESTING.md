# Production Testing Guide

This guide explains how to run the Playwright test suite against the **live production site** (duocalculator.com) to validate JavaScript functionality.

## Quick Start

```bash
# Test production site
cd /Users/ant/clawd/projects/duocalculator
bash scripts/test-production.sh
```

Or test a specific environment:
```bash
bash scripts/test-production.sh https://staging.duocalculator.com
```

## How It Works

The production test setup:
- Uses `playwright.config.prod.js` config
- Sets `baseURL: 'https://www.duocalculator.com'`
- Skips local server startup (no `globalSetup`)
- Runs all 53 Playwright tests against the live site

## What Gets Tested

All JavaScript-intensive functionality on the live site:
- ✅ Tab switching (finish/pace modes)
- ✅ Course selection cascade (from→to→section→unit)
- ✅ Real-time calculations (finish dates, minutes/day)
- ✅ Reset functionality
- ✅ Bug report modal (validation, focus traps)
- ✅ Responsive layout (mobile, tablet, desktop)

## Updating Tests for Production

Current tests use `readBaseUrl()` to get the base URL. For production testing:

**Option 1: Use the helper (current approach)**
```javascript
const { readBaseUrl } = require('../test-utils/server');

test('something', async ({ page }) => {
  const baseUrl = await readBaseUrl();
  await page.goto(`${baseUrl}/`);
  // ...
});
```

**Option 2: Update to use Playwright's baseURL (recommended)**
```javascript
test('something', async ({ page }) => {
  // Automatically uses baseURL from config
  await page.goto('/');
  // ...
});
```

To migrate all tests to Option 2:
1. Add `baseURL: process.env.DUO_BASE_URL || 'http://localhost:3000'` to main playwright.config.js
2. Replace all `await page.goto(\`${baseUrl}/\`)` with `await page.goto('/')`
3. Remove `readBaseUrl()` imports

## Running from OpenClaw

An agent can run production tests with:
```javascript
exec({
  command: 'bash scripts/test-production.sh',
  workdir: '/Users/ant/clawd/projects/duocalculator',
  timeout: 180
});
```

## CI/CD Integration

Add to deployment pipeline:
```yaml
# After deployment
- name: Run production smoke tests
  run: bash scripts/test-production.sh https://www.duocalculator.com
```

## Troubleshooting

**Tests fail with "ERR_NAME_NOT_RESOLVED"**
- Check that the production URL is accessible
- Verify DNS resolution: `nslookup www.duocalculator.com`

**Tests timeout**
- Production site may be slower than local
- Increase timeouts in `playwright.config.prod.js`

**Tests fail but site works manually**
- Check for CORS issues or rate limiting
- Some tests may need production-specific adjustments (e.g., different timing)

## Local Development

Keep using the standard local test command:
```bash
cd ui-tests
npm test
```

This uses `playwright.config.js` which starts a local server automatically.
