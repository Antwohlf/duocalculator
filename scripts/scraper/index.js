#!/usr/bin/env node
/**
 * DuoCalculator Course Data Scraper
 * Main orchestrator for fetching and parsing Duolingo course data
 * 
 * Usage:
 *   node index.js --output ../data [--rate-limit 500] [--full-refresh false]
 */

import { parseArgs } from 'node:util';
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import * as fetcherModule from './fetcher.js';

const fetcherOverride = globalThis.__SCRAPER_FETCHER__;
const { fetchWithRetry, RateLimiter } = fetcherOverride ?? fetcherModule;
import { parseCourseList, parseCourseDetail, parseDailyNews } from './parsers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REMOTE_BASE = 'https://duolingodata.com/';
const SCHEMA_VERSION = '1.0.0';

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  // Parse args at runtime, not import time
  const { values: args } = parseArgs({
    options: {
      output: { type: 'string', default: '../../data' },
      'rate-limit': { type: 'string', default: '500' },
      'full-refresh': { type: 'string', default: 'false' },
    },
  });

  const outputDir = resolve(__dirname, args.output);
  const coursesDir = join(outputDir, 'courses');
  const rateLimit = parseInt(args['rate-limit'], 10);
  const fullRefresh = args['full-refresh'] === 'true';

  const startTime = Date.now();
  
  console.log('🚀 Starting course data scrape...');
  console.log(`   Output: ${outputDir}`);
  console.log(`   Rate limit: ${rateLimit}ms`);
  console.log(`   Full refresh: ${fullRefresh}`);
  console.log('');

  // Ensure directories exist
  await mkdir(coursesDir, { recursive: true });

  const limiter = new RateLimiter(rateLimit);
  const scrapedAt = new Date().toISOString();
  const failedCourses = [];

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Fetch and parse main course table
  // ─────────────────────────────────────────────────────────────────────────
  console.log('📋 Fetching main course table...');
  const mainHtml = await fetchWithRetry(REMOTE_BASE);
  const courses = parseCourseList(mainHtml);
  console.log(`   Found ${courses.length} courses`);

  // Save courses.json
  const coursesData = {
    meta: {
      scrapedAt,
      totalCourses: courses.length,
      source: REMOTE_BASE,
      schemaVersion: SCHEMA_VERSION,
    },
    courses: courses.map((c) => ({
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
  console.log('');

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Fetch individual course details
  // ─────────────────────────────────────────────────────────────────────────
  const coursesWithDetail = courses.filter((c) => c.detailHref);
  console.log(`📚 Fetching ${coursesWithDetail.length} course details...`);

  let detailCount = 0;
  let skippedCount = 0;
  let rescrapeCount = 0;

  for (const course of coursesWithDetail) {
    const key = extractKey(course.detailHref);
    if (!key) {
      console.log(`   ⚠️  Skipping invalid href: ${course.detailHref}`);
      continue;
    }

    const existingPath = join(coursesDir, `${key}.json`);

    // ─────────────────────────────────────────────────────────────────────
    // Check if we should skip (incremental mode)
    // ─────────────────────────────────────────────────────────────────────
    if (!fullRefresh) {
      try {
        if (await fileExists(existingPath)) {
          const existing = JSON.parse(await readFile(existingPath, 'utf8'));
          
          // Force rescrape if detailHref changed (URL structure changed)
          if (existing.meta?.detailHref !== course.detailHref) {
            console.log(`   🔄 ${key}: detailHref changed, forcing rescrape`);
            rescrapeCount++;
          } else {
            // Skip if scraped within last 6 days
            const existingDate = new Date(existing.meta?.scrapedAt || 0);
            const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
            
            if (existingDate > sixDaysAgo) {
              skippedCount++;
              detailCount++; // Count as successful since we have recent data
              continue;
            }
          }
        }
      } catch {
        // File doesn't exist or is invalid, fetch it
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Rate limit and fetch
    // ─────────────────────────────────────────────────────────────────────
    await limiter.wait();

    try {
      const html = await fetchWithRetry(course.detailHref);
      const detail = parseCourseDetail(html, course);
      
      // Generate hashes for change detection
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
          schemaVersion: SCHEMA_VERSION,
        },
        totals: detail.totals,
        sections: detail.sections,
      };

      await writeFile(
        join(coursesDir, `${key}.json`),
        JSON.stringify(detailData, null, 2)
      );
      detailCount++;
      
      const units = detail.totals?.units || 0;
      const activities = detail.totals?.activities || 0;
      console.log(`   ✅ ${key} (${units} units, ${activities} activities)`);
    } catch (error) {
      failedCourses.push(key);
      console.error(`   ❌ ${key}: ${error.message}`);
    }
  }

  console.log('');
  console.log(`   Scraped: ${detailCount - skippedCount}`);
  console.log(`   Skipped (recent): ${skippedCount}`);
  console.log(`   Rescraped (changed): ${rescrapeCount}`);
  console.log(`   Failed: ${failedCourses.length}`);
  console.log('');

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Fetch daily news
  // ─────────────────────────────────────────────────────────────────────────
  console.log('📰 Fetching daily news...');
  try {
    await limiter.wait();
    const newsUrl = `${REMOTE_BASE}dailynews.html`;
    const newsHtml = await fetchWithRetry(newsUrl);
    const news = parseDailyNews(newsHtml);
    
    await writeFile(
      join(outputDir, 'dailynews.json'),
      JSON.stringify(
        {
          meta: {
            scrapedAt,
            source: newsUrl,
            schemaVersion: SCHEMA_VERSION,
          },
          ...news,
        },
        null,
        2
      )
    );
    console.log(`   ✅ Saved dailynews.json (${news.entries?.length || 0} entries)`);
  } catch (error) {
    console.error(`   ⚠️  Daily news failed: ${error.message}`);
    // Not a critical failure, continue
  }
  console.log('');

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Generate manifest with enriched metadata
  // ─────────────────────────────────────────────────────────────────────────
  console.log('📋 Generating manifest...');
  
  const coursesJson = await readFile(join(outputDir, 'courses.json'), 'utf8');
  const checksum = createHash('sha256').update(coursesJson).digest('hex').slice(0, 16);
  const scrapeDurationMs = Date.now() - startTime;

  const manifest = {
    version: '1.0.0',
    schemaVersion: SCHEMA_VERSION,
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
  console.log('   ✅ Saved manifest.json');
  console.log('');

  // ─────────────────────────────────────────────────────────────────────────
  // Final summary
  // ─────────────────────────────────────────────────────────────────────────
  const durationSec = (scrapeDurationMs / 1000).toFixed(1);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🎉 Scrape complete!');
  console.log(`   Courses: ${courses.length}`);
  console.log(`   Details: ${detailCount}`);
  console.log(`   Duration: ${durationSec}s`);
  
  if (failedCourses.length > 0) {
    console.log(`   ⚠️  Failed courses (${failedCourses.length}): ${failedCourses.slice(0, 10).join(', ')}`);
    if (failedCourses.length > 10) {
      console.log(`       ... and ${failedCourses.length - 10} more`);
    }
  }
  console.log('═══════════════════════════════════════════════════════════════');
}

/**
 * Extract course key from detail href
 * e.g., "https://duolingodata.com/enfes.html" -> "enfes"
 */
function extractKey(href) {
  if (!href) return null;
  try {
    const url = new URL(href);
    const fileName = url.pathname.split('/').pop() || '';
    const match = fileName.match(/^([^.]+)\.html$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Get next Sunday at 3 AM UTC for nextUpdate field
 */
function getNextSunday() {
  const now = new Date();
  const daysUntilSunday = (7 - now.getUTCDay()) % 7 || 7;
  const nextSunday = new Date(now);
  nextSunday.setUTCDate(now.getUTCDate() + daysUntilSunday);
  nextSunday.setUTCHours(3, 0, 0, 0);
  return nextSunday;
}

// Run the scraper
export const scrapePromise = main();

scrapePromise.catch((error) => {
  console.error('');
  console.error('💥 Scraper failed:', error.message);
  console.error('');
  if (error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});
