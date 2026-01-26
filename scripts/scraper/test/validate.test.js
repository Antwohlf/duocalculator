import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const scraperDir = new URL('../', import.meta.url);
const fixturesDir = new URL('./fixtures/validate/', import.meta.url);

async function runValidate(fixtureName, extraArgs = []) {
  const dataDir = new URL(`${fixtureName}/`, fixturesDir).pathname;
  try {
    const result = await execFileAsync('node', ['validate.js', '--data', dataDir, ...extraArgs], {
      cwd: scraperDir.pathname,
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
