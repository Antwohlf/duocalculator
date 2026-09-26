import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseCourseList, parseCourseDetail, normalizeLevel } from '../parsers.js';

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
  const detail = parseCourseDetail(html, { key: 'esfen', lessonsCount: 18 });

  assert.equal(detail.sections.length, 2);
  assert.equal(detail.sections[0].unitCount, 2);
  assert.equal(detail.sections[0].units.length, 2);
  assert.equal(detail.sections[1].units.length, 1);
  assert.deepEqual(detail.sections.map((section) => section.units.map((unit) => unit.unitIndex)), [[1, 2], [1]]);
  assert.deepEqual(detail.totals, { sections: 2, units: 3, activities: 18, estimated: true });
});

test('parseCourseDetail handles empty detail pages', async () => {
  const html = await readFixture('course-detail-empty.html');
  const detail = parseCourseDetail(html, { key: 'empty' });

  assert.deepEqual(detail.sections, []);
  assert.deepEqual(detail.totals, { sections: 0, units: 0, activities: null, estimated: true });
});

test('footer dates do not become lessons and repeated rows do not become units', () => {
  const html = 'Section 1 (2 units) Basics<br>1 1 First<br>5, 4, 2<br>1 1 First<br>1 2 Second<br>2025, 17';
  const detail = parseCourseDetail(html, { unitsCount: 2, lessonsCount: 19 });
  assert.deepEqual(detail.sections[0].units.map((unit) => unit.unitIndex), [1, 2]);
  assert.equal(detail.totals.activities, 19);
  assert.ok(detail.sections[0].units.every((unit) => unit.activities < 19));
});

test('current section summary overrides stale detail rows', () => {
  const html = 'Section 1 (2 Units) A<br>Section 2 (2 Units) B<br>Section 1 (3 units) A:<br>1 1 First<br>1 2 Second<br>1 3 Stale<br>Section 2 (1 unit) B:<br>2 1 Last';
  const detail = parseCourseDetail(html, { unitsCount: 4, lessonsCount: 24 });
  assert.deepEqual(detail.sections.map((section) => section.unitCount), [2, 2]);
  assert.equal(detail.sections[0].units.length, 2);
  assert.equal(detail.sections[1].units[1].estimated, true);
  assert.equal(detail.totals.activities, 24);
});

test('unknown lesson totals stay unknown across alternative layouts', () => {
  const html = 'Stage 1 (2 units) Grades<br>1 1 First<br>1 2 Second<br>Stage 1 (1 unit) Topics<br>1 1 Topic';
  const detail = parseCourseDetail(html, { unitsCount: 2, lessonsCount: null });
  assert.equal(detail.sections.length, 1);
  assert.equal(detail.totals.units, 2);
  assert.equal(detail.totals.activities, null);
  assert.ok(detail.sections[0].units.every((unit) => unit.activities === null));
});

test('localized section headings preserve real unit positions', () => {
  const examples = [
    '第1阶段 (2个部分) CEFR Intro',
    '1. Kısım (2 ünite) CEFR Intro',
    '1⁠వ విభాగం (2 యూనిట్లు) CEFR Intro',
    'セクション 1 (2ユニット) CEFR Intro',
    '섹션 1 (2개 유닛) CEFR Intro',
    'پہلا سیکشن (2 یونٹس) CEFR Intro',
  ];
  for (const heading of examples) {
    const detail = parseCourseDetail(`${heading}<br>1 1 First<br>1 2 Second`, { unitsCount: 2, lessonsCount: 12 });
    assert.equal(detail.sections.length, 1, heading);
    assert.deepEqual(detail.sections[0].units.map((unit) => unit.unitIndex), [1, 2], heading);
    assert.equal(detail.totals.activities, 12, heading);
  }
});

test('course titles do not become CEFR levels', () => {
  assert.equal(normalizeLevel('Spanish from English'), '');
  assert.equal(normalizeLevel('CEFR Intro:'), 'INTRO');
  assert.equal(normalizeLevel('CEFR B2'), 'B2');
});
