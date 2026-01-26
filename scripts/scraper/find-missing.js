#!/usr/bin/env node
/**
 * Find which course detail is missing
 */

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const coursesJsonPath = '/Users/ant/clawd/duocalculator/data/courses.json';
const coursesDirPath = '/Users/ant/clawd/duocalculator/data/courses';

async function findMissing() {
  const data = JSON.parse(await readFile(coursesJsonPath, 'utf8'));
  const courses = data.courses;

  // Get all courses that should have details
  const expectedKeys = courses
    .filter(c => c.detailHref !== null)
    .map(c => c.detailKey);

  // Get actual scraped files
  const files = await readdir(coursesDirPath);
  const scrapedKeys = files
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));

  // Find missing
  const missing = expectedKeys.filter(k => !scrapedKeys.includes(k));
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔍 MISSING COURSE DETAILS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`Expected to scrape: ${expectedKeys.length}`);
  console.log(`Actually scraped:   ${scrapedKeys.length}`);
  console.log(`Missing:            ${missing.length}`);
  console.log('');

  if (missing.length > 0) {
    console.log('Missing course(s):');
    missing.forEach(key => {
      const course = courses.find(c => c.detailKey === key);
      console.log(`  ❌ ${key}`);
      console.log(`     Title: ${course.title}`);
      console.log(`     URL:   ${course.detailHref}`);
      console.log('');
    });
  } else {
    console.log('✅ All courses with detailHref were scraped!');
  }
  
  console.log('═══════════════════════════════════════════════════════════════');
}

findMissing().catch(console.error);
