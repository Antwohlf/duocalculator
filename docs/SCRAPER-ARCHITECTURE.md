# DuoCalculator Data Scraping Architecture

## Executive Summary

Move from client-side proxy scraping to pre-scraped static JSON files, updated weekly via GitHub Actions. **Zero cost, significantly faster load times.**

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GITHUB ACTIONS (Weekly)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌────────────────┐    ┌────────────────────────────┐   │
│  │   Trigger   │───▶│  Node.js       │───▶│  Validation Step           │   │
│  │  (cron)     │    │  Scraper       │    │  (error threshold check)   │   │
│  │  Sun 3am    │    │                │    │  Fail if >10% errors       │   │
│  └─────────────┘    └───────┬────────┘    └────────────┬───────────────┘   │
│                             │                          │                   │
│                             ▼                          ▼                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     SCRAPING SEQUENCE                                │   │
│  │  1. Fetch main table → parse courses.json                           │   │
│  │  2. For each course with detailHref (compare for changes):           │   │
│  │     - Check if detailHref changed → force rescrape if so            │   │
│  │     - Fetch detail page (rate limited: 500ms between requests)      │   │
│  │     - Parse sections/units → data/courses/{courseKey}.json          │   │
│  │     - Add sourceHash, scrapeWarnings to output                      │   │
│  │  3. Fetch dailynews.html → data/dailynews.json                      │   │
│  │  4. Generate manifest.json with enriched metadata                   │   │
│  │  5. Run validation script (schema check, error rate < 10%)           │   │
│  │  6. On validation success → Commit & Push; On failure → Rollback    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        STATIC DATA (in repo)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  data/                                                                      │
│  ├── manifest.json          ← metadata, timestamps, version               │
│  ├── courses.json           ← main course table (all courses)             │
│  ├── dailynews.json         ← daily news feed                             │
│  └── courses/               ← individual course details                   │
│      ├── enfes.json         ← Spanish for English speakers                │
│      ├── defes.json         ← Spanish for German speakers                 │
│      ├── enfr.json          ← French for English speakers                 │
│      └── ... (~100 files)                                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. App loads → fetch /data/manifest.json (tiny, cached)                   │
│  2. fetch /data/courses.json (course list)                                 │
│  3. User selects course → fetch /data/courses/{key}.json                   │
│  4. All files served via Vercel CDN with immutable cache                   │
│                                                                             │
│  Fallback chain:                                                           │
│  ┌─────────────┐    ┌────────────────┐    ┌────────────────┐              │
│  │ Static JSON │───▶│ Proxy scrape   │───▶│ Synthetic data │              │
│  │ (primary)   │    │ (fallback)     │    │ (last resort)  │              │
│  └─────────────┘    └────────────────┘    └────────────────┘              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
duocalculator/
├── .github/
│   └── workflows/
│       └── scrape-courses.yml    ← GitHub Actions workflow
│
├── scripts/
│   ├── scraper/
│   │   ├── index.js              ← Main scraper entry point
│   │   ├── parsers.js            ← HTML parsing (reuse from app.js)
│   │   ├── fetcher.js            ← Rate-limited HTTP fetcher
│   │   └── writers.js            ← JSON file writers
│   └── package.json              ← Scraper dependencies (cheerio, etc)
│
├── data/                         ← Scraped data (auto-generated)
│   ├── manifest.json
│   ├── courses.json
│   ├── dailynews.json
│   └── courses/
│       └── *.json
│
├── api/
│   └── proxy.js                  ← Keep as fallback
│
├── app.js                        ← Modified to use static data
└── index.html
```

---

## Data Schemas

### manifest.json
```json
{
  "version": "1.0.0",
  "schemaVersion": "1.0.0",
  "scrapedAt": "2026-01-25T03:00:00Z",
  "scrapedAtUnix": 1737774000,
  "lastSuccessfulScrape": "2026-01-25T03:00:00Z",
  "lastAttemptedScrape": "2026-01-25T03:00:00Z",
  "scrapeDurationMs": 45000,
  "courseCount": 286,
  "detailCount": 105,
  "failedCourses": ["obsolete-course-key"],
  "checksum": "sha256:abc123...",
  "source": "https://duolingodata.com/",
  "nextUpdate": "2026-02-01T03:00:00Z"
}
```

### courses.json (course list)
```json
{
  "meta": {
    "scrapedAt": "2026-01-25T03:00:00Z",
    "totalCourses": 286,
    "source": "https://duolingodata.com/",
    "schemaVersion": "1.0.0"
  },
  "courses": [
    {
      "courseId": "enfes-001",
      "key": "enfes",
      "title": "English → Spanish",
      "fromLang": "English",
      "toLang": "Spanish",
      "fromCode": "en",
      "toCode": "es",
      "level": "CEFR A2",
      "levelShort": "A2",
      "unitsCount": 211,
      "lessonsCount": 2847,
      "storiesCount": 148,
      "learnersMillions": 34.2,
      "updated": "2024.12",
      "lastUpdated": "2026-01-25T03:00:00Z",
      "detailHref": "https://duolingodata.com/enfes.html",
      "detailKey": "enfes",
      "detailAvailable": true,
      "hasDetail": true
    }
    // ... more courses
  ]
}
```

### courses/{key}.json (course detail)
```json
{
  "meta": {
    "key": "enfes",
    "courseTitle": "English → Spanish",
    "scrapedAt": "2026-01-25T03:00:00Z",
    "sourceHash": "sha256:def456...",
    "fromLang": "English",
    "toLang": "Spanish",
    "fromCode": "en",
    "toCode": "es",
    "level": "CEFR A2",
    "levelShort": "A2",
    "detailHref": "https://duolingodata.com/enfes.html",
    "detailHrefHash": "sha256:href789...",
    "scrapeWarnings": []
  },
  "totals": {
    "sections": 16,
    "units": 211,
    "activities": 2847
  },
  "sections": [
    {
      "sectionIndex": 1,
      "unitCount": 15,
      "title": "Form basic sentences",
      "rawTitle": "Section 1 (15 units) Form basic sentences",
      "cefr": "A1",
      "units": [
        {
          "sectionIndex": 1,
          "unitIndex": 1,
          "title": "Order food and drink",
          "activities": 12,
          "activityPattern": ["lesson", "lesson", "practice", "..."]
        }
        // ... more units
      ]
    }
    // ... more sections
  ]
}
```

### dailynews.json
```json
{
  "meta": {
    "scrapedAt": "2026-01-25T03:00:00Z",
    "source": "https://duolingodata.com/dailynews.html"
  },
  "entries": [
    {
      "date": "2026-01-23",
      "items": [
        {
          "course": "enfes",
          "change": "New unit added",
          "details": "Unit 212: Advanced grammar"
        }
      ]
    }
  ]
}
```

---

## GitHub Actions Workflow

```yaml
# .github/workflows/scrape-courses.yml
name: Scrape Duolingo Course Data

on:
  schedule:
    # Every Sunday at 3:00 AM UTC
    - cron: '0 3 * * 0'
  workflow_dispatch:  # Manual trigger
    inputs:
      full_refresh:
        description: 'Force full refresh of all courses'
        type: boolean
        default: false

permissions:
  contents: write
  issues: write

jobs:
  scrape:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    outputs:
      validation_passed: ${{ steps.validate.outputs.passed }}
      validation_errors: ${{ steps.validate.outputs.error_count }}
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 1
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: scripts/package-lock.json
      
      - name: Install scraper dependencies
        working-directory: scripts
        run: npm ci
      
      - name: Run scraper
        id: scrape
        working-directory: scripts
        run: |
          node scraper/index.js \
            --output ../data \
            --rate-limit 500 \
            --full-refresh ${{ inputs.full_refresh || 'false' }}
        env:
          USER_AGENT: 'duocalculator-scraper/1.0 (+https://github.com/duocalculator)'
      
      - name: Validate scraped data
        id: validate
        run: |
          node scripts/scraper/validate.js --data data/ --error-threshold 10
          echo "passed=true" >> $GITHUB_OUTPUT
          echo "error_count=0" >> $GITHUB_OUTPUT
      
      - name: Rollback on validation failure
        if: failure() && steps.validate.outcome == 'failure'
        run: |
          echo "Validation failed, rolling back to data-stable branch..."
          git checkout data-stable -- data/ || echo "No data-stable branch, keeping previous data"
      
      - name: Check for changes
        id: check
        run: |
          if git diff --quiet data/; then
            echo "changed=false" >> $GITHUB_OUTPUT
            echo "No changes detected"
          else
            echo "changed=true" >> $GITHUB_OUTPUT
            echo "Changes detected:"
            git diff --stat data/
          fi
      
      - name: Commit and push
        if: steps.check.outputs.changed == 'true' && steps.validate.outputs.passed == 'true'
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          
          # Stage data files
          git add data/
          
          # Create commit with summary
          COURSE_COUNT=$(jq -r '.courses | length' data/courses.json)
          TIMESTAMP=$(jq -r '.scrapedAt' data/manifest.json)
          ERROR_COUNT=$(jq -r '.failedCourses | length' data/manifest.json)
          
          git commit -m "chore(data): update course data

          - Courses: ${COURSE_COUNT}
          - Scraped: ${TIMESTAMP}
          - Failed courses: ${ERROR_COUNT}
          - Validation: PASSED
          - Triggered by: ${{ github.event_name }}"
          
          # Create/update data-stable tag for rollback support
          git tag -f data-stable
          
          git push && git push origin data-stable
      
      - name: Skip commit on validation failure
        if: steps.validate.outputs.passed != 'true'
        run: |
          echo "❌ Data validation failed (error rate >10%). Skipping commit."
          echo "Previous stable data retained. Manual review required."
          exit 1
      
      - name: Summary
        if: always()
        run: |
          echo "## Scrape Summary" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          if [ -f data/manifest.json ]; then
            echo "- **Scraped at:** $(jq -r '.scrapedAt' data/manifest.json)" >> $GITHUB_STEP_SUMMARY
            echo "- **Courses:** $(jq -r '.courseCount' data/manifest.json)" >> $GITHUB_STEP_SUMMARY
            echo "- **Details scraped:** $(jq -r '.detailCount' data/manifest.json)" >> $GITHUB_STEP_SUMMARY
            echo "- **Failed courses:** $(jq -r '.failedCourses | length' data/manifest.json)" >> $GITHUB_STEP_SUMMARY
            echo "- **Duration:** $(jq -r '.scrapeDurationMs / 1000 | round' data/manifest.json)s" >> $GITHUB_STEP_SUMMARY
            echo "- **Validation:** ${{ steps.validate.outputs.passed == 'true' && '✅ PASSED' || '❌ FAILED' }}" >> $GITHUB_STEP_SUMMARY
          fi
          echo "- **Changes committed:** ${{ steps.check.outputs.changed }}" >> $GITHUB_STEP_SUMMARY

  notify-on-failure:
    needs: scrape
    if: failure()
    runs-on: ubuntu-latest
    steps:
      - name: Notify via GitHub Issue
        uses: actions/github-script@v7
        with:
          script: |
            const title = `Scraper failed: ${new Date().toISOString().split('T')[0]}`;
            const body = `The weekly course data scrape failed.
            
            **Workflow run:** ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
            
            **Status:** 
            - Validation: ${{ needs.scrape.outputs.validation_passed }}
            - Errors detected: ${{ needs.scrape.outputs.validation_errors }}
            
            **Action:** Previous data has been retained. Please check the logs and re-run manually if needed.`;
            
            // Check for existing open issue
            const issues = await github.rest.issues.listForRepo({
              owner: context.repo.owner,
              repo: context.repo.repo,
              labels: 'scraper-failure',
              state: 'open'
            });
            
            if (issues.data.length === 0) {
              await github.rest.issues.create({
                owner: context.repo.owner,
                repo: context.repo.repo,
                title,
                body,
                labels: ['scraper-failure', 'automated']
              });
            }
```

---

## Scraper Implementation

### scripts/package.json
```json
{
  "name": "duocalculator-scraper",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "scrape": "node scraper/index.js --output ../data",
    "scrape:full": "node scraper/index.js --output ../data --full-refresh true"
  },
  "dependencies": {
    "cheerio": "^1.0.0",
    "node-fetch": "^3.3.2"
  }
}
```

### scripts/scraper/index.js
```javascript
#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { fetchWithRetry, RateLimiter } from './fetcher.js';
import { parseCourseList, parseCourseDetail, parseDailyNews } from './parsers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REMOTE_BASE = 'https://duolingodata.com/';

const { values: args } = parseArgs({
  options: {
    output: { type: 'string', default: '../data' },
    'rate-limit': { type: 'string', default: '500' },
    'full-refresh': { type: 'string', default: 'false' },
  },
});

const outputDir = join(__dirname, args.output);
const coursesDir = join(outputDir, 'courses');
const rateLimit = parseInt(args['rate-limit'], 10);
const fullRefresh = args['full-refresh'] === 'true';

async function main() {
  const startTime = Date.now();
  console.log('🚀 Starting course data scrape...');
  console.log(`   Output: ${outputDir}`);
  console.log(`   Rate limit: ${rateLimit}ms`);
  console.log(`   Full refresh: ${fullRefresh}`);

  // Ensure directories exist
  await mkdir(coursesDir, { recursive: true });

  const limiter = new RateLimiter(rateLimit);
  const scrapedAt = new Date().toISOString();
  const failedCourses = [];

  // 1. Fetch and parse main course table
  console.log('\n📋 Fetching main course table...');
  const mainHtml = await fetchWithRetry(REMOTE_BASE);
  const courses = parseCourseList(mainHtml);
  console.log(`   Found ${courses.length} courses`);

  // Save courses.json
  const coursesData = {
    meta: {
      scrapedAt,
      totalCourses: courses.length,
      source: REMOTE_BASE,
      schemaVersion: '1.0.0',
    },
    courses: courses.map(c => ({
      ...c,
      courseId: c.key,
      lastUpdated: scrapedAt,
      detailKey: extractKey(c.detailHref),
      detailAvailable: !!c.detailHref,
    })),
  };
  await writeFile(
    join(outputDir, 'courses.json'),
    JSON.stringify(coursesData, null, 2)
  );
  console.log('   ✅ Saved courses.json');

  // 2. Fetch individual course details
  const coursesWithDetail = courses.filter(c => c.detailHref);
  console.log(`\n📚 Fetching ${coursesWithDetail.length} course details...`);

  let detailCount = 0;
  for (const course of coursesWithDetail) {
    const key = extractKey(course.detailHref);
    if (!key) continue;

    // Check if we should skip (incremental mode)
    let forceRescrape = false;
    if (!fullRefresh) {
      const existingPath = join(coursesDir, `${key}.json`);
      try {
        const existing = JSON.parse(await readFile(existingPath, 'utf8'));
        
        // Force rescrape if detailHref changed
        if (existing.meta?.detailHref !== course.detailHref) {
          console.log(`   🔄 Forcing rescrape ${key} (detailHref changed)`);
          forceRescrape = true;
        } else {
          // Skip if scraped within last 6 days
          const existingDate = new Date(existing.meta.scrapedAt);
          const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
          if (existingDate > sixDaysAgo) {
            console.log(`   ⏭️  Skipping ${key} (recent)`);
            detailCount++;
            continue;
          }
        }
      } catch {
        // File doesn't exist, fetch it
      }
    }

    await limiter.wait();

    try {
      const html = await fetchWithRetry(course.detailHref);
      const detail = parseCourseDetail(html, course);
      const sourceHash = createHash('sha256').update(html).digest('hex').slice(0, 16);
      const detailHrefHash = createHash('sha256').update(course.detailHref).digest('hex').slice(0, 16);
      
      const detailData = {
        meta: {
          key,
          courseTitle: course.title,
          scrapedAt,
          sourceHash: `sha256:${sourceHash}`,
          fromLang: course.fromLang,
          toLang: course.toLang,
          fromCode: course.fromCode,
          toCode: course.toCode,
          level: course.level,
          levelShort: course.levelShort,
          detailHref: course.detailHref,
          detailHrefHash: `sha256:${detailHrefHash}`,
          scrapeWarnings: detail.warnings || [],
        },
        totals: detail.totals,
        sections: detail.sections,
      };

      await writeFile(
        join(coursesDir, `${key}.json`),
        JSON.stringify(detailData, null, 2)
      );
      detailCount++;
      console.log(`   ✅ ${key} (${detail.totals?.units || 0} units)`);
    } catch (error) {
      failedCourses.push(key);
      console.error(`   ❌ ${key}: ${error.message}`);
    }
  }

  // 3. Fetch daily news
  console.log('\n📰 Fetching daily news...');
  try {
    await limiter.wait();
    const newsHtml = await fetchWithRetry(`${REMOTE_BASE}dailynews.html`);
    const news = parseDailyNews(newsHtml);
    await writeFile(
      join(outputDir, 'dailynews.json'),
      JSON.stringify({ meta: { scrapedAt, source: `${REMOTE_BASE}dailynews.html` }, ...news }, null, 2)
    );
    console.log('   ✅ Saved dailynews.json');
  } catch (error) {
    console.error(`   ❌ Daily news failed: ${error.message}`);
  }

  // 4. Generate manifest with enriched metadata
  const coursesJson = await readFile(join(outputDir, 'courses.json'), 'utf8');
  const checksum = createHash('sha256').update(coursesJson).digest('hex').slice(0, 16);
  const scrapeDurationMs = Date.now() - startTime;

  const manifest = {
    version: '1.0.0',
    schemaVersion: '1.0.0',
    scrapedAt,
    scrapedAtUnix: Math.floor(new Date(scrapedAt).getTime() / 1000),
    lastSuccessfulScrape: scrapedAt,
    lastAttemptedScrape: scrapedAt,
    scrapeDurationMs,
    courseCount: courses.length,
    detailCount,
    failedCourses,
    checksum: `sha256:${checksum}`,
    source: REMOTE_BASE,
    nextUpdate: getNextSunday().toISOString(),
  };

  await writeFile(
    join(outputDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  console.log('\n✅ Saved manifest.json');
  console.log(`\n🎉 Scrape complete! ${courses.length} courses, ${detailCount} details, ${scrapeDurationMs}ms`);
  if (failedCourses.length > 0) {
    console.log(`   ⚠️  Failed courses: ${failedCourses.join(', ')}`);
  }
}

function extractKey(href) {
  if (!href) return null;
  const match = href.match(/\/([^/]+)\.html$/);
  return match ? match[1] : null;
}

function getNextSunday() {
  const now = new Date();
  const daysUntilSunday = (7 - now.getUTCDay()) % 7 || 7;
  const nextSunday = new Date(now);
  nextSunday.setUTCDate(now.getUTCDate() + daysUntilSunday);
  nextSunday.setUTCHours(3, 0, 0, 0);
  return nextSunday;
}

main().catch((error) => {
  console.error('💥 Scraper failed:', error);
  process.exit(1);
});
```

### scripts/scraper/fetcher.js
```javascript
import fetch from 'node-fetch';

const USER_AGENT = process.env.USER_AGENT || 
  'duocalculator-scraper/1.0 (+https://github.com/duocalculator)';

export async function fetchWithRetry(url, options = {}, retries = 3) {
  const headers = {
    'User-Agent': USER_AGENT,
    'Accept': 'text/html,application/xhtml+xml',
    ...options.headers,
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, { ...options, headers });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.text();
    } catch (error) {
      if (attempt === retries) throw error;
      const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
      console.log(`   ⚠️  Retry ${attempt}/${retries} for ${url} (waiting ${delay}ms)`);
      await sleep(delay);
    }
  }
}

export class RateLimiter {
  constructor(minDelayMs) {
    this.minDelayMs = minDelayMs;
    this.lastRequest = 0;
  }

  async wait() {
    const now = Date.now();
    const elapsed = now - this.lastRequest;
    if (elapsed < this.minDelayMs) {
      await sleep(this.minDelayMs - elapsed);
    }
    this.lastRequest = Date.now();
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### scripts/scraper/parsers.js
```javascript
import * as cheerio from 'cheerio';

// Language mappings (copy from app.js or import shared)
const LANGUAGE_NAME_OVERRIDES = {
  en: 'English', es: 'Spanish', fr: 'French', de: 'German',
  it: 'Italian', pt: 'Portuguese', ja: 'Japanese', ko: 'Korean',
  zh: 'Chinese', ru: 'Russian', ar: 'Arabic', hi: 'Hindi',
  // ... add rest from app.js
};

export function parseCourseList(html) {
  const $ = cheerio.load(html);
  const courses = [];
  
  // Find the main course table
  const table = $('table').first();
  if (!table.length) return courses;

  const headers = [];
  table.find('thead th').each((i, th) => {
    headers.push($(th).text().trim().toLowerCase());
  });

  const findCol = (patterns) => {
    return headers.findIndex(h => 
      patterns.some(p => p.test(h))
    );
  };

  const courseCol = findCol([/course/, /name/]);
  const fromCol = findCol([/^from/, /base/]);
  const toCol = findCol([/^to/, /learn/]);
  const levelCol = findCol([/cefr/, /level/]);
  const unitsCol = findCol([/unit/]);
  const lessonsCol = findCol([/lesson/]);
  const updatedCol = findCol([/updated/]);

  table.find('tbody tr').each((i, row) => {
    const cells = $(row).find('td');
    if (cells.length < 3) return;

    const getCell = (idx) => idx >= 0 ? $(cells[idx]) : null;
    const getText = (cell) => cell?.text()?.replace(/\s+/g, ' ').trim() || '';
    const getNum = (cell) => parseInt(getText(cell).replace(/[^\d]/g, ''), 10) || null;

    const courseCell = getCell(courseCol) || $(cells[0]);
    const link = courseCell.find('a[href$=".html"]').attr('href');
    const detailHref = link ? new URL(link, 'https://duolingodata.com/').href : null;

    const codes = extractCodes(detailHref);
    const fromLang = languageCodeToName(codes.from) || getText(getCell(fromCol));
    const toLang = languageCodeToName(codes.to) || getText(getCell(toCol)) || getText(courseCell);

    const levelText = getText(getCell(levelCol));
    const levelShort = normalizeLevel(levelText);

    const key = detailHref || 
      `fallback:${fromLang.toLowerCase()}::${toLang.toLowerCase()}::${levelShort || 'v1'}`;

    courses.push({
      key,
      title: `${fromLang} → ${toLang}`,
      fromLang,
      toLang,
      fromCode: codes.from,
      toCode: codes.to,
      level: levelText || null,
      levelShort: levelShort || null,
      unitsCount: getNum(getCell(unitsCol)),
      lessonsCount: getNum(getCell(lessonsCol)),
      updated: getText(getCell(updatedCol)) || null,
      detailHref,
      hasDetail: !!detailHref,
    });
  });

  return courses.filter(c => c.fromLang && c.toLang && c.fromLang !== c.toLang);
}

export function parseCourseDetail(html, meta) {
  const $ = cheerio.load(html);
  const sections = [];
  
  // Parse the course detail page structure
  // This mirrors the logic in app.js parseCourseDetail
  const text = $('body').text();
  const lines = text.split(/\n/);
  
  let currentSection = null;
  const sectionRegex = /section\s*(\d+)\s*\((\d+)\s*units?\)/i;
  const unitRegex = /^\s*(\d+)\s+(\d+)\s+(.+)$/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const sectionMatch = trimmed.match(sectionRegex);
    if (sectionMatch) {
      currentSection = {
        sectionIndex: parseInt(sectionMatch[1], 10),
        unitCount: parseInt(sectionMatch[2], 10),
        title: trimmed.replace(sectionRegex, '').trim(),
        rawTitle: trimmed,
        cefr: '',
        units: [],
      };
      sections.push(currentSection);
      continue;
    }

    if (currentSection) {
      const unitMatch = trimmed.match(unitRegex);
      if (unitMatch) {
        currentSection.units.push({
          sectionIndex: currentSection.sectionIndex,
          unitIndex: parseInt(unitMatch[1], 10),
          activities: parseInt(unitMatch[2], 10),
          title: unitMatch[3].trim(),
          activityPattern: [],
        });
      }
    }
  }

  const totals = sections.reduce((acc, s) => {
    acc.sections++;
    acc.units += s.units.length;
    acc.activities += s.units.reduce((sum, u) => sum + (u.activities || 0), 0);
    return acc;
  }, { sections: 0, units: 0, activities: 0 });

  return { sections, totals, meta };
}

export function parseDailyNews(html) {
  const $ = cheerio.load(html);
  const entries = [];
  
  // Parse daily news structure
  $('body').find('p, div, li').each((i, el) => {
    const text = $(el).text().trim();
    if (text.length > 10 && text.length < 500) {
      entries.push({ text, index: i });
    }
  });

  return { entries: entries.slice(0, 50) }; // Limit to recent items
}

function extractCodes(href) {
  if (!href) return { from: null, to: null };
  const match = href.match(/\/([a-z]{2,5})f([a-z]{2,5})\.html$/i);
  return match ? { to: match[1], from: match[2] } : { from: null, to: null };
}

function languageCodeToName(code) {
  return code ? (LANGUAGE_NAME_OVERRIDES[code.toLowerCase()] || null) : null;
}

function normalizeLevel(text) {
  if (!text) return '';
  const match = text.match(/([A-C][0-3](?:\+|-)?)/i);
  return match ? match[1].toUpperCase() : '';
}
```

---

## Client Integration

### Modified app.js (key changes)

```javascript
// New constants
const DATA_BASE = '/data';
const MANIFEST_URL = `${DATA_BASE}/manifest.json`;
const COURSES_URL = `${DATA_BASE}/courses.json`;
const COURSE_DETAIL_URL = (key) => `${DATA_BASE}/courses/${key}.json`;

// Cache for manifest
let dataManifest = null;

async function loadCourses() {
  dom.fromLangSelect.disabled = true;
  dom.toLangSelect.disabled = true;
  dom.fromLangSelect.innerHTML = `<option value="">Loading languages…</option>`;

  try {
    // Try static data first
    const { courses, manifest } = await loadStaticCourseData();
    
    if (courses && courses.length > 0) {
      state.courses = courses;
      state.courseMap = new Map(courses.map(c => [c.key, c]));
      dataManifest = manifest;
      
      renderDataLastUpdated(manifest);
      populateFromLanguageSelect();
      dom.fromLangSelect.disabled = false;
      
      // Continue with stored state restoration...
      await restoreStoredState();
      return;
    }
  } catch (error) {
    console.warn('Static data unavailable, falling back to proxy:', error);
  }

  // Fallback to proxy (existing code)
  await loadCoursesViaProxy();
}

async function loadStaticCourseData() {
  // Fetch manifest first (small, tells us freshness)
  const manifestRes = await fetch(MANIFEST_URL);
  if (!manifestRes.ok) throw new Error('Manifest not found');
  const manifest = await manifestRes.json();

  // Fetch courses
  const coursesRes = await fetch(COURSES_URL);
  if (!coursesRes.ok) throw new Error('Courses not found');
  const data = await coursesRes.json();

  return { courses: data.courses, manifest };
}

async function ensureCourseDetail(courseKey) {
  if (state.courseDetailCache.has(courseKey)) {
    state.currentCourseData = state.courseDetailCache.get(courseKey);
    renderCourseMeta(state.currentCourseData);
    return;
  }

  const meta = state.courseMap.get(courseKey);
  if (!meta) {
    showDetailError('Course not found', courseKey);
    return;
  }

  // Try static data first
  const staticKey = meta.detailKey || extractKeyFromHref(meta.detailHref);
  if (staticKey && meta.detailAvailable) {
    try {
      const res = await fetch(COURSE_DETAIL_URL(staticKey));
      if (res.ok) {
        const detail = await res.json();
        state.courseDetailCache.set(courseKey, detail);
        state.currentCourseData = detail;
        renderCourseMeta(detail);
        return;
      }
    } catch (error) {
      console.warn(`Static detail for ${staticKey} unavailable:`, error);
    }
  }

  // Fallback to proxy (on-demand scraping)
  try {
    await loadCourseDetailViaProxy(courseKey, meta);
  } catch (error) {
    showDetailError('Unable to load course details. Please try again later.', courseKey);
  }
}

function showDetailError(message, courseKey) {
  const detailContainer = document.getElementById('course-details');
  if (detailContainer) {
    detailContainer.innerHTML = `
      <div class="error-state">
        <h2>Course Details Unavailable</h2>
        <p>${message}</p>
        <p><small>Course: ${courseKey}</small></p>
        <button onclick="location.reload()">Retry</button>
      </div>
    `;
  }
}

function extractKeyFromHref(href) {
  if (!href) return null;
  const match = href.match(/\/([^/]+)\.html$/);
  return match ? match[1] : null;
}

function renderDataLastUpdated(manifest) {
  if (!manifest) return;
  
  const lastUpdated = document.getElementById('data-last-updated');
  if (!lastUpdated) return;
  
  const date = new Date(manifest.scrapedAt);
  const relative = getRelativeTime(date);
  
  lastUpdated.textContent = `Data updated ${relative}`;
  lastUpdated.title = `Last scraped: ${date.toLocaleString()}`;
}

function getRelativeTime(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  return date.toLocaleDateString();
}
```

### HTML addition (index.html)

```html
<!-- Add near the top of body, before main content -->
<div id="data-status-banner"></div>

<!-- Course details container -->
<div id="course-details" class="course-details-container"></div>
```

### CSS addition (styles.css)

```css
.error-state {
  padding: 2rem;
  background-color: #fee2e2;
  border: 1px solid #fca5a5;
  border-radius: 6px;
  text-align: center;
  color: #7f1d1d;
}

.error-state h2 {
  margin-top: 0;
}

.error-state button {
  padding: 0.5rem 1rem;
  background-color: #dc2626;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}

.error-state button:hover {
  background-color: #b91c1c;
}
```

---

## Monitoring & Alerts

### GitHub Actions Status Checks
- **Trigger:** Every weekly scrape run
- **Check:** Validation passes before commit
- **Action on failure:** Auto-rollback to `data-stable` tag
- **Notification:** GitHub issue created automatically

### Rollback Procedure

**Automatic (via GitHub Actions):**
```bash
# When validation fails
git checkout data-stable -- data/
```

**Manual (if needed):**
```bash
# View previous stable versions
git tag -l 'data-*'

# Rollback to a specific version
git checkout data-stable -- data/
git add data/
git commit -m "chore(data): manual rollback to stable version"
git push
```

### Maintenance Checklist

- [ ] Monitor GitHub Actions workflow for failures (weekly)
- [ ] Review failed course list in manifest.json
- [ ] Test rollback procedure monthly

---

## Migration Plan

### Phase 1: Setup & Validation (Day 1-2)
1. Create `scripts/scraper/` directory with `index.js`, `fetcher.js`, `parsers.js`
2. Create `scripts/scraper/validate.js` with validation logic
3. Create `.github/workflows/scrape-courses.yml` with validation step
4. Run scraper locally to generate initial `data/` files
5. Test validation script: `node scripts/scraper/validate.js --data data/ --error-threshold 10`
6. Commit everything and create initial `data-stable` tag

### Phase 2: Workflow Testing (Day 3-4)
1. Trigger workflow manually via GitHub Actions UI
2. Verify validation passes before commit
3. Verify data files are committed correctly
4. Test rollback: revert to `data-stable` tag and verify data reverts
5. Check that `data-stable` tag is updated after successful scrape
6. Test data files are accessible via production CDN

### Phase 3: Client Integration (Day 5-6)
1. Modify `app.js` to use static-first loading (no synthetic data fallback)
2. Add "Last Updated" display to HTML
3. Implement `renderDataLastUpdated()` function
4. Add `showDetailError()` for unavailable course details
5. Test thoroughly:
   - Fresh data loads from static files
   - Course details load from static files
   - Fallback to proxy works when static missing
   - Error states display correctly
   - No synthetic data is ever generated
6. Deploy to production

### Phase 4: Monitor (Week 2+)
1. Verify weekly cron job runs successfully (Sunday 3 AM UTC)
2. Monitor GitHub Actions usage (should be <5 min/week)
3. Verify "Last Updated" display shows correctly on production
4. Review failed course list weekly for patterns
5. Test manual rollback procedure monthly
6. Keep `data-stable` tag updated after each successful run

---

## Cost & Performance Analysis

### GitHub Actions Usage
- **Weekly scrape:** ~2-3 minutes
- **Monthly usage:** ~12 minutes
- **Free tier:** 2000 minutes/month
- **Buffer:** 99.4% of free tier remaining

### Repository Size
- **courses.json:** ~50KB
- **Individual details:** ~2-10KB each × ~100 files = ~500KB
- **Total data/:** ~600KB
- **Git history:** Minimal (weekly diffs only)

### Performance Improvement
| Metric | Before (Proxy) | After (Static) |
|--------|----------------|----------------|
| Initial load | 800-1500ms | 50-100ms |
| Course detail | 300-800ms | 30-80ms |
| CDN cacheable | ❌ | ✅ |
| Works offline | ❌ | Partial ✅ |

### Reliability
- **Before:** Dependent on duolingodata.com uptime
- **After:** Static files always available; graceful degradation

---

## Error Handling & User-Facing States

### Client-Side Fallback Chain (No Synthetic Data)

```
┌─────────────────────────────────────────────────────────────┐
│                    Error Handling Flow                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Static JSON fetch fails                                    │
│       │                                                      │
│       ▼                                                      │
│  ┌─────────────┐                                            │
│  │ Try proxy   │──▶ Success? Use proxy data                 │
│  └─────────────┘                                            │
│       │ Fail                                                │
│       ▼                                                      │
│  Display "Data unavailable" message                         │
│  (No synthetic/estimated data generation)                   │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  GitHub Actions scrape fails (Validation)                   │
│       │                                                      │
│       ▼                                                      │
│  Validation error rate >10%?                                │
│       │                                                      │
│       ├─▶ YES: Rollback to data-stable tag                  │
│       │         Create GitHub issue with details            │
│       │         Keep site stable with previous data         │
│       │                                                      │
│       └─▶ NO: Commit new data with warnings logged          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Simple Error Handling

| Scenario | Message | Action |
|----------|---------|--------|
| **Data Available** | "Data updated 2 days ago" | Normal operation |
| **Static Unavailable** | "Loading from remote source..." | Fallback to proxy scraping |
| **All Sources Failed** | "Unable to load course data. Please refresh the page." | Show error dialog, disable features |

### Server-Side Validation

```javascript
// In GitHub Actions validation script
async function validateScrapedData(dataDir, errorThreshold = 10) {
  const manifest = JSON.parse(await readFile(join(dataDir, 'manifest.json'), 'utf8'));
  const courses = JSON.parse(await readFile(join(dataDir, 'courses.json'), 'utf8'));
  
  const errors = [];
  
  // Check manifest schema
  const requiredFields = [
    'version', 'schemaVersion', 'scrapedAt', 'courseCount', 
    'failedCourses', 'checksum'
  ];
  for (const field of requiredFields) {
    if (!(field in manifest)) {
      errors.push(`Missing manifest field: ${field}`);
    }
  }
  
  // Check courses schema
  if (!Array.isArray(courses.courses) || courses.courses.length === 0) {
    errors.push('Courses array is empty or missing');
  } else {
    for (const course of courses.courses) {
      if (!course.courseId || !course.key) {
        errors.push(`Invalid course: missing courseId or key`);
      }
    }
  }
  
  // Check that failed course count matches manifest
  const courseFilesAvailable = manifest.courseCount;
  const courseFilesFailed = manifest.failedCourses?.length || 0;
  const errorRate = (courseFilesFailed / courseFilesAvailable) * 100;
  
  if (errorRate > errorThreshold) {
    errors.push(
      `Error rate ${errorRate.toFixed(1)}% exceeds threshold ${errorThreshold}%`
    );
  }
  
  if (errors.length > 0) {
    console.error(`❌ Validation FAILED with ${errors.length} errors:`);
    errors.forEach(err => console.error(`   - ${err}`));
    return { passed: false, errors, errorRate };
  }
  
  console.log(`✅ Validation PASSED (error rate: ${errorRate.toFixed(1)}%)`);
  return { passed: true, errors: [], errorRate };
}
```

---

## Checklist

### Scraper Implementation
- [ ] Create `scripts/scraper/index.js` with detailHref change detection
- [ ] Create `scripts/scraper/fetcher.js` with rate limiting
- [ ] Create `scripts/scraper/parsers.js` with HTML parsing logic
- [ ] Create `scripts/scraper/validate.js` with schema validation
- [ ] Create `scripts/package.json` with dependencies (cheerio, node-fetch)
- [ ] Test scraper locally: `cd scripts && npm install && npm run scrape`
- [ ] Verify all schema fields are present in output files

### Schema & Data Quality
- [ ] Verify manifest.json has all fields: `lastSuccessfulScrape`, `lastAttemptedScrape`, `scrapeDurationMs`, `failedCourses`, `schemaVersion`
- [ ] Verify courses.json includes: `courseId`, `lastUpdated`, `detailAvailable`, `detailKey`
- [ ] Verify course detail files include: `sourceHash`, `scrapeWarnings`, `meta.courseTitle`
- [ ] Test validation script with error threshold of 10%
- [ ] Ensure detailHrefHash is computed for change detection

### GitHub Actions Workflow
- [ ] Create `.github/workflows/scrape-courses.yml` with:
  - [x] Cron schedule (Sunday 3 AM UTC)
  - [x] Manual trigger with full-refresh option
  - [x] Validation step before commit
  - [x] Rollback on validation failure to `data-stable` tag
  - [x] Automatic GitHub issue creation on failure
- [ ] Test manual workflow trigger
- [ ] Verify workflow creates `data-stable` tag after success
- [ ] Test rollback procedure by forcing validation failure

### Client-Side Implementation
- [ ] Modify `app.js` for static-first loading (remove all synthetic data generation)
- [ ] Add `loadStaticCourseData()` function
- [ ] Add fallback to proxy (no synthetic data)
- [ ] Add error handling for unavailable courses
- [ ] Remove all synthetic data references from codebase
- [ ] Add `renderDataLastUpdated()` function for "Last Updated" display
- [ ] Add `showDetailError()` function for course detail failures

### UI & UX
- [ ] Add "Last Updated" display to HTML (index.html)
- [ ] Add error state styling to CSS (error-state class only)
- [ ] Test data loads and "Last Updated" displays correctly
- [ ] Test error modal displays when no sources available

### Deployment
- [ ] Create runbook for manual rollback

### Testing & Validation
- [ ] Run full scrape locally and validate output
- [ ] Test static data loading in development
- [ ] Test proxy fallback (simulate static failure)
- [ ] Test error states (unavailable message)
- [ ] Verify no synthetic data is generated anywhere
- [ ] Test on multiple browsers and devices

### Deployment
- [ ] Commit all code and `data/` directory
- [ ] Create initial `data-stable` tag: `git tag data-stable && git push origin data-stable`
- [ ] Deploy to production
- [ ] Verify data files accessible via CDN
- [ ] Monitor first 24 hours for issues

### Post-Launch Monitoring (Week 1+)
- [ ] Verify weekly cron job runs successfully
- [ ] Check GitHub Actions usage (<5 min/week)
- [ ] Verify "Last Updated" display shows correctly
- [ ] Check for any rollback events
- [ ] Test manual rollback procedure
