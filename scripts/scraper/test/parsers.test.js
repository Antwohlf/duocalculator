import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseCourseList, parseCourseDetail } from '../parsers.js';

const fixturesDir = new URL('./fixtures/', import.meta.url);

async function readFixture(name) {
  return readFile(new URL(name, fixturesDir), 'utf8');
}

test('parseCourseList extracts courses and normalizes fields', async () => {
  const html = await readFixture('course-list.html');
  const expected = JSON.parse(await readFixture('expected-courses.json'));

  const courses = parseCourseList(html);
  assert.deepEqual(courses, expected);
});

test('parseCourseList returns empty array for malformed HTML', async () => {
  const html = await readFixture('course-list-malformed.html');
  const courses = parseCourseList(html);
  assert.deepEqual(courses, []);
});

test('parseCourseDetail extracts sections, units, and totals', async () => {
  const html = await readFixture('course-detail.html');
  const detail = parseCourseDetail(html, { key: 'esfen' });

  assert.equal(detail.sections.length, 2);
  assert.equal(detail.sections[0].unitCount, 2);
  assert.equal(detail.sections[0].units.length, 2);
  assert.equal(detail.sections[1].units.length, 1);
  assert.deepEqual(detail.totals, { sections: 2, units: 3, activities: 18 });
});

test('parseCourseDetail handles empty detail pages', async () => {
  const html = await readFixture('course-detail-empty.html');
  const detail = parseCourseDetail(html, { key: 'empty' });

  assert.deepEqual(detail.sections, []);
  assert.deepEqual(detail.totals, { sections: 0, units: 0, activities: 0 });
});
