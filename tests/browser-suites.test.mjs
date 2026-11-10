// Every browser suite is in exactly one list of tests/browser-suites.json: the deploy gate or the nightly sweep.
import test from 'node:test';
import assert from 'node:assert/strict';
import { suiteLists } from '../scripts/browser-suites.mjs';

test('each browser suite is listed once, in the gate or in the nightly sweep', async () => {
  const { gate, nightly, files } = await suiteLists(), listed = [...gate, ...nightly];
  assert.ok(gate.length > 0, 'the deploy gate is empty (pages.yml builds its job matrix from it)');
  assert.deepEqual(listed.filter((name, i) => listed.indexOf(name) !== i), [], 'a suite is listed twice');
  assert.deepEqual(listed.filter(name => !files.includes(name)), [], 'a listed suite has no file in tests/');
  assert.deepEqual(files.filter(name => !listed.includes(name)), [], 'a suite in tests/ is in neither list: add it to tests/browser-suites.json');
});
