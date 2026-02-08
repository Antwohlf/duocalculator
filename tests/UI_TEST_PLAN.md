# DuoCalculator UI Test Plan & Implementation Blueprint

**Date:** 2026-02-08  
**Author:** Clawd (sub-agent: bird-ui-test-opus-plan)  
**Status:** PLAN — not yet implemented

---

## 1. Overview

An OpenClaw "bird" skill that runs Playwright-based headless UI tests against the DuoCalculator web app, triggered as a sub-agent task. On completion it produces a concise pass/fail report; on failure it saves screenshots as artifacts.

---

## 2. File Layout

```
/Users/ant/clawd/
├── skills/
│   └── duocalc-test/
│       ├── SKILL.md              # OpenClaw skill manifest (triggers, description)
│       └── README.md             # Human-readable overview
└── projects/
    └── duocalculator/
        └── tests/
            ├── UI_TEST_PLAN.md   # ← this file
            ├── playwright.config.ts
            ├── package.json      # test-only deps (playwright, @playwright/test)
            ├── tsconfig.json
            ├── run.sh            # entry-point script for OpenClaw exec
            ├── specs/
            │   ├── smoke.spec.ts
            │   ├── tab-switching.spec.ts
            │   ├── course-selection.spec.ts
            │   ├── calculation.spec.ts
            │   ├── reset.spec.ts
            │   ├── bug-report-modal.spec.ts
            │   └── responsive.spec.ts
            └── artifacts/        # gitignored; screenshots + report JSON land here
                └── .gitkeep
```

**Why this layout?**
- Tests live *with* the project they test (`projects/duocalculator/tests/`).
- The OpenClaw skill (`skills/duocalc-test/SKILL.md`) is a thin pointer that tells OpenClaw how to invoke the tests; it doesn't contain test code.
- `artifacts/` is ephemeral and gitignored.

---

## 3. Dependencies

```jsonc
// tests/package.json
{
  "private": true,
  "scripts": {
    "test": "npx playwright test",
    "test:headed": "npx playwright test --headed",
    "report": "npx playwright show-report artifacts/report"
  },
  "devDependencies": {
    "@playwright/test": "^1.50.0"
  }
}
```

One-time setup:
```bash
cd /Users/ant/clawd/projects/duocalculator/tests
npm install
npx playwright install chromium   # headless-only; ~150 MB
```

---

## 4. Playwright Config

```ts
// tests/playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
  },
  reporter: [
    ['list'],
    ['json', { outputFile: 'artifacts/report.json' }],
    ['html', { outputFolder: 'artifacts/report', open: 'never' }],
  ],
  outputDir: 'artifacts/test-results',
  webServer: {
    command: 'node ../server.js',
    port: 3000,
    reuseExistingServer: true,
    timeout: 10_000,
  },
});
```

Key decisions:
- **`screenshot: 'only-on-failure'`** — keeps artifacts small; screenshots auto-attach to report.
- **`webServer`** — Playwright auto-starts `server.js` if port 3000 is free, or reuses if already running.
- **`retries: 1`** — one retry to handle flaky network/proxy calls (DuolingoData.com).

---

## 5. Test Scenarios & Assertions

### 5.1 Smoke / Page Load (`smoke.spec.ts`)

| # | Scenario | Assertions |
|---|----------|------------|
| 1 | Page loads without JS errors | No `console.error`; title = "DuoCalculator" |
| 2 | Brand elements visible | Logo img loaded; brand-name text = "DuoCalculator" |
| 3 | From-language select populates | `#from-lang-select` has ≥ 5 `<option>` elements (languages loaded from data) |
| 4 | Initial results placeholder | `#result-headline` contains "Pick a course" |
| 5 | Footer renders | Footer text mentions "Unofficial calculator" |

### 5.2 Tab Switching (`tab-switching.spec.ts`)

| # | Scenario | Assertions |
|---|----------|------------|
| 1 | Default tab is "finish" | `#tab-finish` has `aria-selected="true"`; `#panel-finish` visible |
| 2 | Click "pace" tab | `#panel-pace` visible; `#panel-finish` hidden; `#tab-pace` aria-selected |
| 3 | Click back to "finish" | Panels swap back correctly |
| 4 | Tab keyboard navigation | `Tab` + `Enter` on pace button triggers switch |

### 5.3 Course Selection Flow (`course-selection.spec.ts`)

| # | Scenario | Assertions |
|---|----------|------------|
| 1 | Select "English" as from-language | `#to-lang-select` becomes enabled; has ≥ 1 target language |
| 2 | Select a target language (e.g., Spanish) | `#section-select` becomes enabled; has ≥ 1 section |
| 3 | Select first section | `#unit-select` becomes enabled; has ≥ 1 unit; CEFR hint may appear |
| 4 | Select first unit | Results panel updates: `#result-headline` no longer "Pick a course"; progress bar > 0% or shows data |
| 5 | Swap languages button | Click `#swap-languages`; from/to values swap; downstream selects reset |

### 5.4 Calculation Results (`calculation.spec.ts`)

| # | Scenario | Assertions |
|---|----------|------------|
| 1 | Finish-mode calculation | After full course selection: `#stat-finish-date` ≠ "—"; `#stat-lessons-left` is a number > 0; `#stat-minutes-day` shows a value |
| 2 | Change minutes-per-day | Changing `#minutes-per-day` from 30→60 causes finish date to move earlier |
| 3 | Change minutes-per-activity | Adjusting `#minutes-per-activity` recalculates results |
| 4 | Pace-mode calculation | Switch to pace tab; set `#target-days` = 30; results show required minutes/day |
| 5 | Progress bar accuracy | `#progress-counts` text matches pattern "X of Y lessons completed"; bar fill width > 0 |

### 5.5 Reset (`reset.spec.ts`)

| # | Scenario | Assertions |
|---|----------|------------|
| 1 | Reset on finish tab | Click `[data-reset]` inside `#panel-finish`; form inputs revert to defaults; results show placeholder |
| 2 | Reset on pace tab | Switch to pace tab; fill form; reset; `#target-days` = 90 |

### 5.6 Bug Report Modal (`bug-report-modal.spec.ts`)

| # | Scenario | Assertions |
|---|----------|------------|
| 1 | Open modal | Click `#bug-report-trigger`; modal backdrop visible; focus trapped inside modal |
| 2 | Validation — short description | Submit with < 20 chars; error message visible |
| 3 | Close via ✕ button | Click `#bug-modal-close`; modal hidden |
| 4 | Close via Cancel | Click `#bug-cancel`; modal hidden |
| 5 | Close via Escape key | Press Escape; modal hidden |
| 6 | Char counter updates | Type in `#bug-desc`; `#bug-desc-count` updates |

### 5.7 Responsive Layout (`responsive.spec.ts`)

| # | Scenario | Assertions |
|---|----------|------------|
| 1 | Mobile viewport (375×667) | Controls and results stack vertically; no horizontal scrollbar |
| 2 | Tablet viewport (768×1024) | Layout renders without overflow |
| 3 | Desktop (1280×720) | Side-by-side layout if applicable |

---

## 6. OpenClaw Skill Definition

```yaml
# skills/duocalc-test/SKILL.md
---
name: duocalc-test
description: Run Playwright UI tests for the DuoCalculator web app. Produces a pass/fail report with screenshots on failure.
homepage: null
metadata:
  clawdbot:
    emoji: "🧪"
    os: [darwin, linux]
    requires:
      bins: [node, npx]
---

# duocalc-test — DuoCalculator UI Test Runner

## When to use
- "run duocalculator tests"
- "test the duocalc UI"
- "check if duocalculator is broken"
- "UI smoke test for duocalculator"

## How to invoke

```bash
cd /Users/ant/clawd/projects/duocalculator/tests
bash run.sh
```

Or via OpenClaw sub-agent (exec):

```bash
exec: bash /Users/ant/clawd/projects/duocalculator/tests/run.sh
```

## Artifacts

- `tests/artifacts/report.json` — machine-readable results
- `tests/artifacts/report/` — HTML report (open in browser)
- `tests/artifacts/test-results/` — screenshots & traces for failures

## Interpreting results

After `run.sh` completes, read `artifacts/report.json`:
- `.stats.expected` = total tests
- `.stats.unexpected` = failures
- Each suite/spec has `.status` ("passed" | "failed" | "skipped")

Summarize: "X/Y passed. Failures: [list spec names + screenshot paths]"
```

---

## 7. Runner Script (`run.sh`)

```bash
#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# Ensure deps
if [ ! -d node_modules ]; then
  echo "📦 Installing test dependencies..."
  npm install --silent
  npx playwright install chromium --with-deps 2>/dev/null || npx playwright install chromium
fi

# Clean previous artifacts
rm -rf artifacts/test-results artifacts/report artifacts/report.json

# Run tests
echo "🧪 Running DuoCalculator UI tests..."
npx playwright test --reporter=list,json 2>&1 | tee artifacts/run.log
EXIT_CODE=${PIPESTATUS[0]}

# Summary
if [ -f artifacts/report.json ]; then
  TOTAL=$(node -e "const r=require('./artifacts/report.json'); console.log(r.stats.expected)")
  FAILED=$(node -e "const r=require('./artifacts/report.json'); console.log(r.stats.unexpected)")
  echo ""
  echo "═══════════════════════════════"
  echo "  Results: ${TOTAL} tests, ${FAILED} failures"
  echo "═══════════════════════════════"
  if [ "$FAILED" -gt 0 ]; then
    echo "❌ Screenshots saved in artifacts/test-results/"
    # List failure screenshots
    find artifacts/test-results -name "*.png" 2>/dev/null | while read -r f; do
      echo "  📸 $f"
    done
  else
    echo "✅ All tests passed"
  fi
fi

exit $EXIT_CODE
```

---

## 8. How OpenClaw Invokes This

### Option A: Direct exec (simplest)

The main agent (or a human) runs:
```
exec: bash /Users/ant/clawd/projects/duocalculator/tests/run.sh
```
Then reads `artifacts/report.json` and summarizes.

### Option B: Sub-agent spawn (preferred for autonomy)

The main agent spawns a sub-agent with instructions:
```
Task: Run DuoCalculator UI tests.
1. cd /Users/ant/clawd/projects/duocalculator/tests
2. exec: bash run.sh
3. Read artifacts/report.json
4. If failures: read each failure's screenshot path, attach/describe them
5. Return concise report: pass count, fail count, failure details
```

This keeps the main session clean and lets the sub-agent handle retries or deeper diagnosis.

### Option C: Cron / Heartbeat (scheduled)

Add to `HEARTBEAT.md`:
```
- [ ] Every Sunday: spawn sub-agent to run duocalc-test skill
```

---

## 9. Artifact Management

| Artifact | Retention | Purpose |
|----------|-----------|---------|
| `artifacts/report.json` | Overwritten each run | Machine-readable summary |
| `artifacts/report/` | Overwritten each run | Human-friendly HTML report |
| `artifacts/test-results/*.png` | Overwritten each run | Failure screenshots |
| `artifacts/test-results/*.zip` | Overwritten each run | Playwright traces (for deep debugging) |
| `artifacts/run.log` | Overwritten each run | Raw console output |

Add to `.gitignore`:
```
tests/artifacts/
tests/node_modules/
```

---

## 10. CI (Optional, Future)

If duocalculator gets a GitHub Actions pipeline:

```yaml
# .github/workflows/ui-tests.yml
name: UI Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: cd tests && npm ci && npx playwright install chromium --with-deps
      - run: cd tests && npx playwright test
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: test-artifacts
          path: tests/artifacts/
```

---

## 11. Implementation Checklist

- [ ] Create `tests/` directory structure
- [ ] Write `tests/package.json` and `tests/tsconfig.json`
- [ ] Write `tests/playwright.config.ts`
- [ ] Write `tests/run.sh` (make executable)
- [ ] Implement spec files (start with `smoke.spec.ts`, iterate)
- [ ] Create `skills/duocalc-test/SKILL.md`
- [ ] Install deps: `cd tests && npm install && npx playwright install chromium`
- [ ] Run locally: `bash run.sh` — verify pass/fail
- [ ] Add `tests/artifacts/` to `.gitignore`
- [ ] Document in `TOOLS.md` under duocalculator section

---

## 12. Design Decisions & Rationale

1. **Playwright over Cypress/Puppeteer** — first-class headless support, built-in screenshot-on-failure, trace viewer, TypeScript native, lighter than Cypress.

2. **Separate `tests/package.json`** — the main duocalculator has zero npm deps (vanilla JS + Node stdlib). Adding Playwright to the root would bloat it. Isolated test deps are cleaner.

3. **`webServer` in Playwright config** — auto-manages the dev server lifecycle. No need to manually start/stop `server.js`.

4. **Skill as thin pointer** — the SKILL.md tells OpenClaw *what this does* and *how to run it*. Actual test code stays with the project. This follows the existing pattern (see `skills/qmd/SKILL.md`).

5. **Sub-agent over direct exec** — a sub-agent can read the report JSON, interpret failures, and produce a human-friendly summary. Direct exec just dumps stdout.

6. **Network dependency** — DuoCalculator fetches course data from DuolingoData.com via its proxy endpoint. Tests that select courses will need network access or we mock the API. **Recommendation: start with real network calls** (simpler), add MSW/route-intercept mocking later if flaky.
