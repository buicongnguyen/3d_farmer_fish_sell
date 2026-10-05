import assert from 'node:assert/strict';
import { launch, open, shot, save } from './travel-kit.mjs';
import { WORKSHOP } from '../src/content.mjs';

const browser = await launch(), results = [];
try {
  for (const view of ['desktop', 'phone']) {
    const { page, context, errors } = await open(browser, view, s => { s.position = { x: WORKSHOP.x, z: WORKSHOP.z }; s.coins = 2500; }, { quality: view === 'phone' ? 'battery' : 'high' });
    await page.waitForFunction(() => performance.getEntriesByType('resource').some(r => r.name.endsWith('/workshop.glb')));
    await page.waitForTimeout(800);
    const shops = await page.evaluate(() => willowmere.targets().filter(t => t.type === 'shop' && t.id === 'upgrades'));
    assert.equal(shops.length, 1); assert.deepEqual([shops[0].position.x, shops[0].position.z], [WORKSHOP.x, WORKSHOP.z]);
    assert.match(await page.locator('#interact').innerText(), /Visit the Vale workshop/);
    await shot(page, `workshop-${view}-well`); await page.keyboard.press('e');
    await page.waitForSelector('#modal-title:has-text("Vale workshop")');
    await page.locator('[data-action="do"][data-type="upgrade"][data-id="farm"]').click();
    assert.equal((await page.evaluate(() => willowmere.snapshot())).upgrades.farm, 1);
    assert.deepEqual(errors, []); results.push({ view, shop: shops[0].position, upgraded: true }); await context.close();
  }
} finally { await browser.close(); }
await save('workshop-browser', results); console.log('workshop-browser: desktop and phone location, single counter and upgrade passed');
