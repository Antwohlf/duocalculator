#!/usr/bin/env node
/**
 * Analyze course coverage from courses.json
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const coursesPath = '/Users/ant/clawd/duocalculator/data/courses.json';

async function analyze() {
  const data = JSON.parse(await readFile(coursesPath, 'utf8'));
  const courses = data.courses;

  const total = courses.length;
  const withDetail = courses.filter(c => c.detailHref !== null).length;
  const withoutDetail = courses.filter(c => c.detailHref === null).length;

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 COURSE COVERAGE ANALYSIS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`Total courses:              ${total}`);
  console.log(`Courses WITH detailHref:    ${withDetail}`);
  console.log(`Courses WITHOUT detailHref: ${withoutDetail}`);
  console.log('');
  console.log(`Match check: ${withDetail} scraped vs ${withDetail} with detailHref`);
  console.log(`✅ ${withDetail === 238 ? 'MATCH!' : 'MISMATCH!'}`);
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('⏱️  RUNTIME ESTIMATION');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`Rate limit per request:     500ms`);
  console.log(`Courses to scrape:          ${withDetail}`);
  console.log(`Total delay time:           ${(withDetail * 500) / 1000}s (${(withDetail * 500 / 60000).toFixed(1)} min)`);
  console.log(`Network/parsing overhead:   ~30-60s estimate`);
  console.log(`Expected total runtime:     ~3-4 minutes`);
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔍 COURSES WITHOUT DETAIL PAGES (sample)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  
  const noDetailSample = courses
    .filter(c => c.detailHref === null)
    .slice(0, 10);
  
  noDetailSample.forEach(c => {
    console.log(`${c.title.padEnd(40)} | ${c.unitsCount} units | key: ${c.key}`);
  });
  
  if (withoutDetail > 10) {
    console.log(`... and ${withoutDetail - 10} more`);
  }
  console.log('');
}

analyze().catch(console.error);
