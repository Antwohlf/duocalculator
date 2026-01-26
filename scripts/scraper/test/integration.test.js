import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const fixturesDir = new URL('./fixtures/', import.meta.url);

async function readFixture(name) {
  return readFile(new URL(name, fixturesDir), 'utf8');
}

async function runScraper({ outputDir, htmlMap, fullRefresh }) {
  const fetchCalls = [];
  globalThis.__SCRAPER_FETCHER__ = {
    fetchWithRetry: async (url) => {
      fetchCalls.push(url);
      if (!(url in htmlMap)) {
        throw new Error(`Unexpected fetch: ${url}`);
      }
      return htmlMap[url];
    },
    RateLimiter: class {
      async wait() {}
    },
  };

  const originalArgv = process.argv;
  process.argv = [
    'node',
    'index.js',
    '--output',
    outputDir,
    '--rate-limit',
    '0',
    '--full-refresh',
    String(fullRefresh),
  ];

  const indexUrl = new URL('../index.js', import.meta.url).href;
  try {
    const { scrapePromise } = await import(`${indexUrl}?run=${Date.now()}`);
    await scrapePromise;
  } finally {
    process.argv = originalArgv;
    delete globalThis.__SCRAPER_FETCHER__;
  }

  return fetchCalls;
}

test('scraper produces manifest, courses, and details from fixtures', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'duo-scraper-'));
  const mainHtml = await readFixture('course-list.html');
  const detailHtml = await readFixture('course-detail.html');
  const dailyHtml = await readFixture('dailynews.html');

  const fetchCalls = await runScraper({
    outputDir,
    fullRefresh: true,
    htmlMap: {
      'https://duolingodata.com/': mainHtml,
      'https://duolingodata.com/esfen.html': detailHtml,
      'https://duolingodata.com/dailynews.html': dailyHtml,
    },
  });

  assert.ok(fetchCalls.includes('https://duolingodata.com/'));
  assert.ok(fetchCalls.includes('https://duolingodata.com/esfen.html'));
  assert.ok(fetchCalls.includes('https://duolingodata.com/dailynews.html'));

  const coursesJson = JSON.parse(
    await readFile(join(outputDir, 'courses.json'), 'utf8')
  );
  assert.equal(coursesJson.courses.length, 2);

  const detailJson = JSON.parse(
    await readFile(join(outputDir, 'courses', 'esfen.json'), 'utf8')
  );
  assert.ok(detailJson.meta.detailHrefHash.startsWith('sha256:'));

  const manifest = JSON.parse(
    await readFile(join(outputDir, 'manifest.json'), 'utf8')
  );
  assert.equal(manifest.courseCount, 2);
  assert.ok(manifest.checksum.startsWith('sha256:'));
});

test('scraper skips recently scraped details when incremental', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'duo-scraper-'));
  const coursesDir = join(outputDir, 'courses');
  await mkdir(coursesDir, { recursive: true });

  const recentDetail = {
    meta: {
      key: 'esfen',
      courseTitle: 'English → Spanish',
      scrapedAt: new Date().toISOString(),
      sourceHash: 'sha256:old',
      detailHref: 'https://duolingodata.com/esfen.html',
    },
    totals: { sections: 1, units: 1, activities: 1 },
    sections: [],
  };

  await writeFile(
    join(coursesDir, 'esfen.json'),
    JSON.stringify(recentDetail, null, 2)
  );

  const mainHtml = await readFixture('course-list.html');
  const dailyHtml = await readFixture('dailynews.html');

  const fetchCalls = await runScraper({
    outputDir,
    fullRefresh: false,
    htmlMap: {
      'https://duolingodata.com/': mainHtml,
      'https://duolingodata.com/dailynews.html': dailyHtml,
    },
  });

  assert.ok(fetchCalls.includes('https://duolingodata.com/'));
  assert.ok(fetchCalls.includes('https://duolingodata.com/dailynews.html'));
  assert.ok(
    !fetchCalls.includes('https://duolingodata.com/esfen.html'),
    'Expected detail fetch to be skipped for recent scrape'
  );
});

test('scraper re-fetches when detailHref changes', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'duo-scraper-'));
  const coursesDir = join(outputDir, 'courses');
  await mkdir(coursesDir, { recursive: true });

  const existingDetail = {
    meta: {
      key: 'esfen',
      courseTitle: 'English → Spanish',
      scrapedAt: new Date().toISOString(),
      sourceHash: 'sha256:old',
      detailHref: 'https://duolingodata.com/old.html',
    },
    totals: { sections: 1, units: 1, activities: 1 },
    sections: [],
  };

  await writeFile(
    join(coursesDir, 'esfen.json'),
    JSON.stringify(existingDetail, null, 2)
  );

  const mainHtml = await readFixture('course-list.html');
  const detailHtml = await readFixture('course-detail.html');
  const dailyHtml = await readFixture('dailynews.html');

  const fetchCalls = await runScraper({
    outputDir,
    fullRefresh: false,
    htmlMap: {
      'https://duolingodata.com/': mainHtml,
      'https://duolingodata.com/esfen.html': detailHtml,
      'https://duolingodata.com/dailynews.html': dailyHtml,
    },
  });

  assert.ok(fetchCalls.includes('https://duolingodata.com/esfen.html'));
});
