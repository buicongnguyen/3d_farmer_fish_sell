// GAME_URL=http://127.0.0.1:<port> GPU=1 EVIDENCE=test-results/workshop node tests/workshop-browser.mjs
import assert from 'node:assert/strict';
import { launch, open, shot, save, press, holdStick } from './travel-kit.mjs';
import { WORKSHOP, FIELD_LANE } from '../src/content.mjs';
import { CAMERA_YAW } from '../src/field-layout.mjs';

const browser = await launch(), results = [];
const position = page => page.evaluate(() => willowmere.metrics().position);
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const tapPoint = async (page, view, x, z, y = 0) => {
  const p = await page.evaluate(p => willowmere.project(p.x, p.z, p.y), { x, z, y });
  const size = page.viewportSize(); assert.ok(p.x > 4 && p.x < size.width - 4 && p.y > 90 && p.y < size.height - 110, 'world tap is visible and clear of screen edges');
  await (view === 'desktop' ? page.mouse.click(p.x, p.y) : page.touchscreen.tap(p.x, p.y));
  return p;
};
try {
  for (const view of ['desktop', 'phone']) {
    // Start on the clear lawn over five metres away, with the visible building ahead.
    const b = WORKSHOP.building, start = { x: b.x + Math.sin(CAMERA_YAW) * 8, z: b.z + Math.cos(CAMERA_YAW) * 8 };
    const { page, context, errors } = await open(browser, view, s => { s.position = start; s.coins = 2500; }, { quality: view === 'phone' ? 'battery' : 'high' });
    try {
      await page.waitForFunction(() => performance.getEntriesByType('resource').some(r => r.name.endsWith('/workshop.glb')) && typeof willowmere.project === 'function');
      await page.waitForTimeout(800);
      const shops = await page.evaluate(() => willowmere.targets().filter(t => t.type === 'shop' && t.id === 'upgrades'));
      assert.equal(shops.length, 1); assert.deepEqual(shops[0].position, { x: WORKSHOP.x, z: WORKSHOP.z });
      const before = await position(page); assert.ok(distance(before, WORKSHOP) > 5, 'start away from the interaction hotspot');
      await shot(page, `workshop-${view}-approach`);
      // Hits the actual upper-front structure, which the old counter-only hitbox missed.
      const buildingTap = await tapPoint(page, view, b.x, b.z + b.d / 2, 2.3);
      await page.waitForFunction(() => { const n = willowmere.metrics().navigation; return n.pending === 'shop' && n.pendingId === 'upgrades' && n.remaining > 0; }, null, { timeout: 5000 });
      await page.waitForSelector('#modal-title:has-text("Vale workshop")', { timeout: 20000 });
      const arrived = await position(page);
      assert.ok(distance(before, arrived) > 3 && distance(arrived, WORKSHOP) < WORKSHOP.r, 'building tap walks to the clear counter and opens its shop');
      await press(page, view, '[data-action="do"][data-type="upgrade"][data-id="farm"]');
      assert.equal((await page.evaluate(() => willowmere.snapshot())).upgrades.farm, 1);
      await shot(page, `workshop-${view}-purchase`); await page.keyboard.press('Escape');
      // Empty lane beside the counter must still mean walking.
      const lane = { x: WORKSHOP.x, z: FIELD_LANE.z };
      await tapPoint(page, view, lane.x, lane.z);
      await page.waitForFunction(() => { const n = willowmere.metrics().navigation; return !n.pending && n.remaining > 0; }, null, { timeout: 5000 });
      await page.waitForFunction(p => Math.hypot(willowmere.metrics().position.x - p.x, willowmere.metrics().position.z - p.z) < .4 && !willowmere.metrics().navigation.remaining, lane, { timeout: 10000 });
      assert.equal(await page.locator('#modal-backdrop').isHidden(), true, 'lane walking does not open the workshop');
      if (view === 'phone') {
        // Enter reach with the real thumb stick, then use ACT instead of keyboard E.
        const stick = await holdStick(page, context, 0, -1);
        try { await page.waitForFunction(() => /Visit the Vale workshop/.test(document.getElementById('interact').textContent), null, { timeout: 5000 }); }
        finally { await stick.release(); }
        // ACT deliberately pulses while available; tap its measured centre without waiting for that animation to stop.
        const act = await page.locator('#touch-action').boundingBox(); assert.ok(act);
        await page.touchscreen.tap(act.x + act.width / 2, act.y + act.height / 2);
        await page.waitForSelector('#modal-title:has-text("Vale workshop")');
        await shot(page, 'workshop-phone-act');
      }
      assert.deepEqual(errors, []); results.push({ view, before, arrived, buildingTap, upgraded: true, laneWalk: true, act: view === 'phone' });
    } catch (error) { await shot(page, `workshop-${view}-failure`).catch(() => {}); throw error; }
    finally { await context.close(); }
  }
} finally { await save('workshop-browser', results); await browser.close(); }
console.log(JSON.stringify(results)); console.log('workshop-browser: building approach, touch purchase, empty lane and phone ACT passed');
