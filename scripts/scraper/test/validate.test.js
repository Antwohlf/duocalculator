import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const execFileAsync = promisify(execFile);
const scraperDir = fileURLToPath(new URL('../', import.meta.url));
const fixturesDir = new URL('./fixtures/validate/', import.meta.url);

async function runValidate(fixtureName, extraArgs = []) {
  const dataDir = fileURLToPath(new URL(`${fixtureName}/`, fixturesDir));
  try {
    const result = await execFileAsync('node', ['validate.js', '--data', dataDir, ...extraArgs], {
      cwd: scraperDir,
      env: process.env,
    });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return {
      code: error.code ?? 1,
      stdout: error.stdout ?? '',
      stderr: error.stderr ?? error.message,
    };
  }
}

test('validate passes on well-formed data', async () => {
  const result = await runValidate('valid');
  assert.equal(result.code, 0);
});

test('validate fails when manifest is missing required fields', async () => {
  const result = await runValidate('invalid-missing-manifest-field');
  assert.equal(result.code, 1);
  assert.match(result.stderr, /missing required field/i);
});

test('validate fails when courses are empty', async () => {
  const result = await runValidate('invalid-empty-courses');
  assert.equal(result.code, 1);
  assert.match(result.stderr, /courses array is empty/i);
});

test('validate fails when detail files are invalid', async () => {
  const result = await runValidate('invalid-detail');
  assert.equal(result.code, 1);
  assert.match(result.stderr, /missing meta object/i);
});

test('validate enforces error rate threshold', async () => {
  const result = await runValidate('invalid-error-rate', ['--error-threshold', '10']);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /exceeds threshold/i);
});

test('v2 validation rejects a missing active detail', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'duo-validate-'));
  const manifest = JSON.parse(await readFile(new URL('valid/manifest.json', fixturesDir)));
  const courses = JSON.parse(await readFile(new URL('valid/courses.json', fixturesDir)));
  manifest.schemaVersion = '2.0.0';
  courses.meta.schemaVersion = '2.0.0';
  courses.courses[0].detailHref = 'https://duolingodata.com/esfen.html';
  courses.courses[0].unitsCount = 2;
  courses.courses[0].lessonsCount = 10;
  await mkdir(join(dataDir, 'courses'));
  await writeFile(join(dataDir, 'manifest.json'), JSON.stringify(manifest));
  await writeFile(join(dataDir, 'courses.json'), JSON.stringify(courses));
  const result = await execFileAsync('node', ['validate.js', '--data', dataDir, '--error-threshold', '0'], { cwd: scraperDir }).catch((error) => error);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /missing detail for esfen/i);
});
