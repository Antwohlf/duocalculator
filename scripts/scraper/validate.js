#!/usr/bin/env node
/**
 * Data validation script for scraped course data
 * Validates schema compliance and error thresholds before commit
 */

import { parseArgs } from 'node:util';
import { readFile, readdir, access } from 'node:fs/promises';
import { join } from 'node:path';

const { values: args } = parseArgs({
  options: {
    data: { type: 'string', default: './data' },
    'error-threshold': { type: 'string', default: '0' },
    verbose: { type: 'boolean', default: false },
  },
});

const dataDir = args.data;
const errorThreshold = parseInt(args['error-threshold'], 10);
const verbose = args.verbose;

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function validateScrapedData() {
  const errors = [];
  const warnings = [];

  console.log('🔍 Validating scraped data...');
  console.log(`   Data directory: ${dataDir}`);
  console.log(`   Error threshold: ${errorThreshold}%`);
  console.log('');

  // Check required files exist
  const requiredFiles = ['manifest.json', 'courses.json'];
  for (const file of requiredFiles) {
    const path = join(dataDir, file);
    if (!(await fileExists(path))) {
      errors.push(`Missing required file: ${file}`);
    }
  }

  if (errors.length > 0) {
    return { passed: false, errors, warnings, errorRate: 100 };
  }

  // Validate manifest.json schema
  console.log('📋 Validating manifest.json...');
  let manifest;
  try {
    manifest = JSON.parse(await readFile(join(dataDir, 'manifest.json'), 'utf8'));
  } catch (e) {
    errors.push(`Invalid manifest.json: ${e.message}`);
    return { passed: false, errors, warnings, errorRate: 100 };
  }

  const manifestRequiredFields = [
    'version',
    'schemaVersion',
    'scrapedAt',
    'scrapedAtUnix',
    'lastSuccessfulScrape',
    'lastAttemptedScrape',
    'scrapeDurationMs',
    'courseCount',
    'detailCount',
    'failedCourses',
    'checksum',
    'source',
    'nextUpdate',
  ];

  for (const field of manifestRequiredFields) {
    if (!(field in manifest)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Type checks for manifest
  if (manifest.scrapedAtUnix && typeof manifest.scrapedAtUnix !== 'number') {
    errors.push('manifest.scrapedAtUnix must be a number');
  }
  if (manifest.courseCount && typeof manifest.courseCount !== 'number') {
    errors.push('manifest.courseCount must be a number');
  }
  if (manifest.detailCount && typeof manifest.detailCount !== 'number') {
    errors.push('manifest.detailCount must be a number');
  }
  if (manifest.failedCourses && !Array.isArray(manifest.failedCourses)) {
    errors.push('manifest.failedCourses must be an array');
  }

  if (verbose) {
    console.log(`   ✓ Scraped at: ${manifest.scrapedAt}`);
    console.log(`   ✓ Course count: ${manifest.courseCount}`);
    console.log(`   ✓ Detail count: ${manifest.detailCount}`);
    console.log(`   ✓ Failed courses: ${manifest.failedCourses?.length || 0}`);
  }

  // Validate courses.json schema
  console.log('📋 Validating courses.json...');
  let coursesData;
  try {
    coursesData = JSON.parse(await readFile(join(dataDir, 'courses.json'), 'utf8'));
  } catch (e) {
    errors.push(`Invalid courses.json: ${e.message}`);
    return { passed: false, errors, warnings, errorRate: 100 };
  }

  // Check courses meta
  if (!coursesData.meta) {
    errors.push('courses.json missing meta field');
  } else {
    const metaFields = ['scrapedAt', 'totalCourses', 'source', 'schemaVersion'];
    for (const field of metaFields) {
      if (!(field in coursesData.meta)) {
        errors.push(`courses.json missing meta.${field}`);
      }
    }
  }

  // Check courses array
  if (!Array.isArray(coursesData.courses)) {
    errors.push('courses.json courses field must be an array');
  } else if (coursesData.courses.length === 0) {
    errors.push('courses.json courses array is empty');
  } else {
    const courseRequiredFields = [
      'courseId',
      'key',
      'title',
      'fromLang',
      'toLang',
      'lastUpdated',
      'detailAvailable',
    ];

    let invalidCourses = 0;
    for (const course of coursesData.courses) {
      for (const field of courseRequiredFields) {
        if (!(field in course)) {
          if (verbose) {
            warnings.push(`Course ${course.key || 'unknown'} missing field: ${field}`);
          }
          invalidCourses++;
          break;
        }
      }
    }

    if (invalidCourses > 0) {
      warnings.push(`${invalidCourses} courses have incomplete data`);
    }

    if (verbose) {
      console.log(`   ✓ Total courses: ${coursesData.courses.length}`);
      console.log(`   ✓ Courses with details: ${coursesData.courses.filter(c => c.detailAvailable).length}`);
    }
  }

  // Validate course detail files
  console.log('📋 Validating course detail files...');
  const coursesDir = join(dataDir, 'courses');
  let detailFiles = [];
  
  try {
    detailFiles = (await readdir(coursesDir)).filter(f => f.endsWith('.json'));
  } catch {
    warnings.push('No courses/ directory found');
  }

  let validDetails = 0;
  let invalidDetails = 0;

  for (const file of detailFiles) {
    try {
      const detail = JSON.parse(await readFile(join(coursesDir, file), 'utf8'));
      
      // Check required detail fields
      const detailRequiredFields = ['meta', 'totals', 'sections'];
      let valid = true;
      
      for (const field of detailRequiredFields) {
        if (!(field in detail)) {
          if (field === 'meta') {
            errors.push(`${file} missing meta object`);
          } else if (verbose) {
            warnings.push(`${file} missing field: ${field}`);
          }
          valid = false;
          break;
        }
      }

      // Check meta fields
      if (detail.meta) {
        const metaRequiredFields = [
          'key',
          'courseTitle',
          'scrapedAt',
          'sourceHash',
          'detailHref',
          'detailHrefHash',
        ];
        
        for (const field of metaRequiredFields) {
          if (!(field in detail.meta)) {
            if (verbose) {
              warnings.push(`${file} missing meta.${field}`);
            }
            valid = false;
            break;
          }
        }
      }

      // Check totals
      if (detail.totals) {
        if (typeof detail.totals.sections !== 'number' ||
            typeof detail.totals.units !== 'number' ||
            (typeof detail.totals.activities !== 'number' && detail.totals.activities !== null)) {
          if (verbose) {
            warnings.push(`${file} has invalid totals`);
          }
          valid = false;
        }
      }

      // Check sections array
      if (detail.sections && !Array.isArray(detail.sections)) {
        if (verbose) {
          warnings.push(`${file} sections is not an array`);
        }
        valid = false;
      }

      if (valid) {
        validDetails++;
      } else {
        invalidDetails++;
      }
    } catch (e) {
      errors.push(`Invalid ${file}: ${e.message}`);
      invalidDetails++;
    }
  }

  if (verbose) {
    console.log(`   ✓ Valid detail files: ${validDetails}`);
    console.log(`   ✓ Invalid detail files: ${invalidDetails}`);
  }

  if (manifest.schemaVersion === '2.0.0' && Array.isArray(coursesData.courses)) {
    const expected = coursesData.courses.filter((course) => course.detailAvailable);
    let placeholderUnits = 0;
    let placeholderCourses = 0;
    const activeKeys = new Set(expected.map((course) => course.detailKey));
    if (activeKeys.size !== expected.length) errors.push('Duplicate detail keys in course index');
    if (manifest.courseCount !== coursesData.courses.length) errors.push('Manifest course count differs from index');
    if (manifest.detailCount !== expected.length) errors.push('Manifest detail count differs from index');
    if (manifest.failedCourses?.length) errors.push('Scrape has failed courses');
    if (detailFiles.length !== expected.length) errors.push('Detail file count differs from active index');
    for (const file of detailFiles) {
      if (!activeKeys.has(file.slice(0, -5))) errors.push(`${file} is an orphan detail file`);
    }
    for (const course of expected) {
      const key = course.detailKey;
      if (!key || !/^[a-zA-Z0-9_-]+$/.test(key)) {
        errors.push(`Invalid detail key for ${course.title}`);
        continue;
      }
      const path = join(coursesDir, `${key}.json`);
      if (!(await fileExists(path))) {
        errors.push(`Missing detail for ${key}`);
        continue;
      }
      let detail;
      try { detail = JSON.parse(await readFile(path, 'utf8')); }
      catch (error) { errors.push(`Invalid detail for ${key}: ${error.message}`); continue; }
      const fail = (message) => errors.push(`${key}: ${message}`);
      if (detail.meta?.key !== key || detail.meta?.detailHref !== course.detailHref ||
          detail.meta?.parserVersion !== 3 ||
          detail.meta?.indexUnitsCount !== course.unitsCount ||
          detail.meta?.indexLessonsCount !== course.lessonsCount) fail('stale or mismatched source metadata');
      if (detail.meta?.scrapedAt !== manifest.scrapedAt &&
          Date.parse(detail.meta?.scrapedAt) < Date.now() - 6 * 86400000) fail('stale detail');
      if (!Array.isArray(detail.sections) || !detail.sections.length) { fail('has no sections'); continue; }
      if (Array.isArray(detail.meta?.sourceSectionCounts) &&
          (detail.meta.sourceSectionCounts.length !== detail.sections.length ||
           detail.meta.sourceSectionCounts.some((count, index) => count !== detail.sections[index].unitCount))) {
        fail('section sizes differ from source summary');
      }
      const seenSections = new Set();
      let previousSectionIndex = 0;
      let units = 0;
      let lessons = 0;
      let coursePlaceholders = 0;
      for (const section of detail.sections) {
        if (!Number.isInteger(section.sectionIndex) || section.sectionIndex <= previousSectionIndex || seenSections.has(section.sectionIndex)) fail('out-of-order or invalid section index');
        previousSectionIndex = section.sectionIndex;
        seenSections.add(section.sectionIndex);
        if (!Array.isArray(section.units) || section.units.length !== section.unitCount) { fail(`section ${section.sectionIndex} unit count differs`); continue; }
        const positions = new Set();
        let badPositions = false;
        for (const unit of section.units) {
          units++;
          if (/details unavailable/i.test(unit.title || '')) coursePlaceholders++;
          if (unit.sectionIndex !== section.sectionIndex || !Number.isInteger(unit.unitIndex) ||
              unit.unitIndex < 1 || unit.unitIndex > section.unitCount || positions.has(unit.unitIndex)) badPositions = true;
          positions.add(unit.unitIndex);
          if (course.lessonsCount == null) {
            if (unit.activities !== null) fail('unknown lesson total has numeric unit estimate');
          } else if (!Number.isInteger(unit.activities) || unit.activities < 1) fail('invalid unit lesson estimate');
          else lessons += unit.activities;
        }
        if (badPositions) fail(`section ${section.sectionIndex} has invalid unit positions`);
      }
      if (units !== course.unitsCount || detail.totals?.units !== units || detail.totals?.sections !== detail.sections.length) fail(`unit totals differ from index (${units} vs ${course.unitsCount})`);
      if (course.lessonsCount == null) {
        if (detail.totals?.activities !== null) fail('unknown lesson total has numeric total');
      } else if (lessons !== course.lessonsCount || detail.totals?.activities !== lessons) fail(`lesson totals differ from index (${lessons} vs ${course.lessonsCount})`);
      if (coursePlaceholders) {
        placeholderUnits += coursePlaceholders;
        placeholderCourses++;
        if (!detail.meta?.scrapeWarnings?.some((warning) => /missing unit details/i.test(warning))) fail('unit placeholders lack source warning');
      }
    }
    console.log(`   Source gaps: ${placeholderUnits} unit titles across ${placeholderCourses} courses`);
    if (placeholderUnits) warnings.push(`${placeholderUnits} unit titles unavailable in ${placeholderCourses} source pages`);
  }

  // Calculate error rate
  const totalCourses = manifest.courseCount || 1;
  const failedCount = (manifest.failedCourses?.length || 0) + invalidDetails;
  const errorRate = (failedCount / totalCourses) * 100;

  console.log('');
  console.log('📊 Validation Summary:');
  console.log(`   Total courses: ${totalCourses}`);
  console.log(`   Detail files: ${detailFiles.length}`);
  console.log(`   Failed/invalid: ${failedCount}`);
  console.log(`   Error rate: ${errorRate.toFixed(1)}%`);
  console.log(`   Threshold: ${errorThreshold}%`);

  // Check if error rate exceeds threshold
  if (errorRate > errorThreshold) {
    errors.push(
      `Error rate ${errorRate.toFixed(1)}% exceeds threshold ${errorThreshold}%`
    );
  }

  // Final result
  const passed = errors.length === 0;

  console.log('');
  if (passed) {
    console.log(`✅ Validation PASSED (error rate: ${errorRate.toFixed(1)}%)`);
  } else {
    console.error(`❌ Validation FAILED with ${errors.length} errors:`);
    errors.forEach(err => console.error(`   - ${err}`));
  }

  if (warnings.length > 0) {
    console.log(`⚠️  ${warnings.length} warnings:`);
    warnings.slice(0, 10).forEach(warn => console.log(`   - ${warn}`));
    if (warnings.length > 10) {
      console.log(`   ... and ${warnings.length - 10} more`);
    }
  }

  return { passed, errors, warnings, errorRate };
}

// Run validation
validateScrapedData()
  .then(({ passed, errors, errorRate }) => {
    // Output for GitHub Actions
    console.log('');
    console.log(`::set-output name=passed::${passed}`);
    console.log(`::set-output name=error_count::${errors.length}`);
    console.log(`::set-output name=error_rate::${errorRate.toFixed(1)}`);
    
    process.exit(passed ? 0 : 1);
  })
  .catch((error) => {
    console.error('💥 Validation script failed:', error);
    process.exit(1);
  });
