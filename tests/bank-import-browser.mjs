// Import must preserve the new save's grass catches while the old world unloads.
import assert from 'node:assert/strict';
import { launch, open, begin, snapshot, save } from './travel-kit.mjs';
import { freshState } from '../src/game.mjs';
import { POND } from '../src/content.mjs';

const browser = await launch();
try {
  const { page, context, errors } = await open(browser, 'desktop', s => { s.settings.test = true; s.position = { x: 0, z: -8 }; });
  const at = { x: POND.x + 1, z: POND.z - POND.d / 2 - .9 }, next = freshState();
  next.started = true; next.settings.test = true; next.position = { ...at }; next.bankCatch = { ...at, fish: { perch: 2 } }; next.inventory.perch = 3;
  await page.evaluate(() => { willowmere.test.open('settings'); window.__beforeBankImport = true; });
  page.once('dialog', d => d.accept());
  await page.locator('#import-file').setInputFiles({ name: 'bank-save.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(next)) });
  await page.waitForFunction(() => !window.__beforeBankImport && window.willowmere?.metrics().ready, null, { timeout: 120000 });
  let state = await snapshot(page);
  assert.deepEqual(state.bankCatch, next.bankCatch, 'old-world unload cannot pack the imported grass catch');
  assert.equal(state.inventory.perch, 3, 'the imported bag is unchanged');
  await begin(page, 'desktop');
  await page.waitForFunction(() => willowmere.metrics().pond?.bankShown === 2, null, { timeout: 30000 });
  await page.keyboard.down('w');
  try { await page.waitForFunction(() => willowmere.snapshot().bankCatch === null, null, { timeout: 10000 }); }
  finally { await page.keyboard.up('w'); }
  state = await snapshot(page); assert.equal(state.inventory.perch, 5, 'walking away packs both fish once');
  await page.reload(); await begin(page, 'desktop');
  state = await snapshot(page); assert.equal(state.inventory.perch, 5); assert.equal(state.bankCatch, null);
  assert.deepEqual(errors, []);
  const result = { importedPending: 2, importedInventory: 3, collectedInventory: 5, reloadInventory: state.inventory.perch, errors };
  await save('bank-import-results', result); console.log(JSON.stringify(result)); await context.close();
} finally { await browser.close(); }
