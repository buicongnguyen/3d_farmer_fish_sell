// GAME_URL=http://127.0.0.1:4591 GPU=1 EVIDENCE=test-results/crafting-load node tests/crafting-load-browser.mjs
// Exercise the actual lazy recipe chunk and real touch controls; a failed module
// is recovered through a fresh document, without buying or losing anything.
import assert from 'node:assert/strict';
import { launch, open, begin, snapshot, press, shot, save } from './travel-kit.mjs';
import { WORKSHOP } from '../src/content.mjs';

const browser = await launch(), results = [], view = 'phone';
const recipeMarker = 'That recipe is not in the workshop.';
const seed = s => {
  s.position = { x: WORKSHOP.x, z: WORKSHOP.z }; s.coins = 1000;
  s.inventory = { obsidian: 1, wood: 3 }; s.settings.sound = false;
};
const possessions = s => ({ coins: s.coins, inventory: s.inventory, gearOwned: s.gearOwned, gear: s.gear });
async function bounded(promise, message) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), 30000); })]); }
  finally { clearTimeout(timer); }
}
async function workshop(page) {
  await page.waitForFunction(() => /Visit the Vale workshop/.test(document.getElementById('interact').textContent));
  const box = await page.locator('#touch-action').boundingBox(); assert.ok(box);
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForSelector('#modal-title:has-text("Vale workshop")');
}
async function recipes(page) {
  await press(page, view, '[data-action="tab"][data-id="crafting"]');
  await page.waitForSelector('[data-recipe="boots_lava"]');
  assert.equal(await page.locator('[data-recipe]').count(), 14);
}

try {
  // Register after normal boot so only deferred modules are intercepted. Match
  // the real recipe code instead of relying on the build's hashed chunk name.
  {
    const { page, context, errors } = await open(browser, view, seed, { quality: 'battery' });
    let aborted = 0, recovered = 0;
    try {
      const before = possessions(await snapshot(page));
      await page.route(/\.m?js(?:\?|$)/, async route => {
        const response = await route.fetch(), text = await response.text();
        if (text.includes(recipeMarker)) {
          if (!aborted) { aborted++; await route.abort('failed'); return; }
          recovered++;
        }
        await route.fulfill({ response });
      });
      await workshop(page);
      await press(page, view, '[data-action="tab"][data-id="crafting"]');
      await page.waitForSelector('[data-action="craftRetry"]');
      assert.equal(aborted, 1);
      assert.match(await page.locator('#modal .modal-content').textContent(), /recipe book could not load.*Check your connection, then reload the game/s);
      assert.equal(await page.locator('[data-action="craftRetry"]').textContent(), 'Reload game');
      assert.equal(await page.locator('[data-recipe]').count(), 0);
      assert.deepEqual(possessions(await snapshot(page)), before, 'a failed download spends nothing');
      await shot(page, 'crafting-load-phone-failure');
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
        press(page, view, '[data-action="craftRetry"]'),
      ]);
      await begin(page, view);
      assert.deepEqual(possessions(await snapshot(page)), before, 'Reload game preserves coins, materials and wardrobe');
      await workshop(page); await recipes(page);
      assert.equal(recovered, 1, 'the recovered document loads the previously failed recipe chunk');
      assert.deepEqual(possessions(await snapshot(page)), before, 'opening the recovered book spends nothing');
      assert.equal(await page.locator('[data-action="craft"][data-id="boots_lava"]').isEnabled(), true);
      assert.deepEqual(errors, []);
      await shot(page, 'crafting-load-phone-recovered');
      results.push({ view, aborted, recovered, reloaded: true, possessionsUnchanged: true });
    } catch (error) { await shot(page, 'crafting-load-phone-test-failure').catch(() => {}); throw error; }
    finally { await context.close(); }
  }
  {
    const { page, context, errors } = await open(browser, view, seed, { quality: 'battery' });
    let release, arrived, intercepted = false, delivered = false;
    const delayed = new Promise(resolve => { release = resolve; });
    const arrival = new Promise(resolve => { arrived = resolve; });
    try {
      const before = possessions(await snapshot(page));
      await page.route(/\.m?js(?:\?|$)/, async route => {
        const response = await route.fetch(), text = await response.text();
        if (text.includes(recipeMarker)) { intercepted = true; await delayed; }
        await route.fulfill({ response });
        if (text.includes(recipeMarker)) { delivered = true; arrived(); }
      });
      await workshop(page);
      await press(page, view, '[data-action="tab"][data-id="crafting"]');
      await page.waitForSelector('#modal [role="status"]:has-text("Opening the recipe book")');
      // Leave the loading tab, then close the shop before its download arrives.
      await press(page, view, '[data-action="tab"][data-id="upgrades"]');
      assert.equal(await page.locator('[data-type="upgrade"]').count(), 5);
      await press(page, view, '#modal [data-action="close"]');
      assert.equal(await page.locator('#modal-backdrop').isHidden(), true);
      release();
      await bounded(arrival, 'delayed recipe chunk did not arrive');
      await page.waitForTimeout(300);
      assert.ok(intercepted && delivered, 'the recipe chunk actually arrives after leaving its tab');
      assert.equal(await page.locator('#modal-backdrop').isHidden(), true, 'late completion never reopens the closed menu');
      await workshop(page);
      assert.equal(await page.locator('[data-action="tab"][data-id="upgrades"]').getAttribute('class'), 'active');
      assert.equal(await page.locator('[data-type="upgrade"]').count(), 5, 'reopening keeps Improvements selected');
      assert.equal(await page.locator('[data-recipe]').count(), 0);
      await recipes(page);
      assert.deepEqual(possessions(await snapshot(page)), before);
      assert.deepEqual(errors, []);
      await shot(page, 'crafting-load-phone-late-completion');
      results.push({ view, delayed: true, closedStayedClosed: true, improvementsKept: true, recipesReady: true });
    } catch (error) { await shot(page, 'crafting-load-phone-delay-failure').catch(() => {}); throw error; }
    finally { release(); await context.close(); }
  }
} finally { await save('crafting-load-browser', results); await browser.close(); }
console.log(JSON.stringify(results));
console.log('crafting-load-browser: phone failed download, saved reload recovery and late completion passed');
