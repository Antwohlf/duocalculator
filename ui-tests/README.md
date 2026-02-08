# DuoCalculator UI tests (Playwright)

Minimal but solid UI smoke tests for the DuoCalculator web app.

## What these tests cover

1. **Home loads + language dropdown populates from static `/data`**
   - The test blocks `GET /api/proxy` and asserts languages still load.
2. **Selecting a course loads course details and key metrics render**
   - Verifies course meta + stats placeholders are replaced.
3. **Error handling for missing `/data/manifest.json`**
   - Intercepts the manifest request with a 404 and asserts the “Data verified” badge falls back to a “now-ish” timestamp.

## Prereqs

- Node.js (repo targets `>=18.17`; Node 20/22 recommended)
- Playwright **Chromium** installed (done automatically on `npm ci` via `postinstall`, but you can run `npm run install:browsers` if needed)

## Run locally

From the repo root:

```bash
cd ui-tests
npm ci
npx playwright test
```

Headed:

```bash
npx playwright test --headed
```

Debug:

```bash
PWDEBUG=1 npx playwright test
```

## Artifacts

- JUnit: `ui-tests/artifacts/junit/results.xml`
- On failure: `ui-tests/artifacts/failures/<timestamp>__<test-title>/`
  - `screenshot.png`
  - `console.txt` (browser console + page errors)

Playwright also stores traces/videos in `ui-tests/test-results/` (retain-on-failure).

## How the server is started

Playwright `globalSetup` starts the app via:

```bash
node server.js
```

…on a **random available port**, writes the base URL to `ui-tests/.tmp/baseUrl.txt`, and the tests read that value.

## OpenClaw invocation example

Use an OpenClaw sub-agent `exec` step like:

```bash
cd /Users/ant/clawd/projects/duocalculator/ui-tests && \
  npm ci && \
  npx playwright test
```

If Playwright browsers are missing on the runner, add:

```bash
npx playwright install chromium
```
