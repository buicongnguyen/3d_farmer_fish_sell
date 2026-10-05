// GAME_URL=http://127.0.0.1:4591 GPU=1 EVIDENCE=test-results/crafting node tests/crafting-browser.mjs
import assert from 'node:assert/strict';
import { launch, open, begin, snapshot, press, shot, save } from './travel-kit.mjs';
import { WORKSHOP, UPGRADES } from '../src/content.mjs';

const browser = await launch(), results = [];
const interact = async (page, view) => {
  if (view === 'desktop') return page.keyboard.press('e');
  const box = await page.locator('#touch-action').boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
};
try {
  for (const view of ['desktop', 'phone', 'landscape']) {
    const { page, context, errors } = await open(browser, view, s => {
      s.position = { x: WORKSHOP.x, z: WORKSHOP.z }; s.coins = 2000;
      s.inventory = { obsidian: 1, wood: 3 }; s.settings.sound = false;
    }, { quality: view === 'desktop' ? 'high' : 'battery' });
    try {
      await page.waitForFunction(() => /Visit the Vale workshop/.test(document.getElementById('interact').textContent));
      await interact(page, view);
      await page.waitForSelector('#modal-title:has-text("Vale workshop")');
      assert.equal(await page.locator('[data-type="upgrade"]').count(), 5);
      await press(page, view, '[data-action="tab"][data-id="crafting"]');
      await page.waitForSelector('[data-recipe="boots_lava"]');
      assert.equal(await page.locator('[data-recipe]').count(), 14);
      assert.equal(await page.locator('[data-action="craft"][data-id="sword_obsidian"]').isDisabled(), true);
      assert.equal(await page.locator('[data-action="craft"][data-id="boots_lava"]').isEnabled(), true);
      assert.match(await page.locator('[data-recipe="sword_obsidian"]').textContent(), /need 3 more/);
      const width = await page.locator('#modal .modal-content').evaluate(el => ({ scroll: el.scrollWidth, client: el.clientWidth }));
      assert.ok(width.scroll <= width.client + 1, `${view}: recipe cards fit the panel (${JSON.stringify(width)})`);
      await shot(page, `crafting-${view}-recipes`);
      await press(page, view, '[data-action="craftCategory"][data-id="companions"]');
      assert.equal(await page.locator('[data-recipe]').count(), 6);
      await press(page, view, '[data-action="craftCategory"][data-id="volcano"]');
      assert.equal(await page.locator('[data-recipe]').count(), 3);
      const before = await snapshot(page);
      await press(page, view, '[data-action="craft"][data-id="boots_lava"]');
      const crafted = await snapshot(page);
      assert.equal(crafted.coins, before.coins - 75);
      assert.deepEqual(crafted.inventory, { wood: 3 });
      assert.deepEqual(crafted.gearOwned, ['boots_lava']); assert.equal(crafted.gear.boots, '');
      assert.equal(await page.locator('[data-action="craft"][data-id="boots_lava"]').isDisabled(), true);
      await shot(page, `crafting-${view}-crafted`);
      // Improvements still work in the same workshop after crafting.
      await press(page, view, '[data-action="tab"][data-id="upgrades"]');
      await press(page, view, '[data-type="upgrade"][data-id="farm"]');
      const improved = await snapshot(page);
      assert.equal(improved.upgrades.farm, 1); assert.equal(improved.coins, crafted.coins - UPGRADES.farm.cost[0]);
      await page.reload(); await begin(page, view);
      const restored = await snapshot(page);
      assert.equal(restored.coins, improved.coins); assert.deepEqual(restored.inventory, crafted.inventory);
      assert.deepEqual(restored.gearOwned, ['boots_lava']); assert.equal(restored.upgrades.farm, 1);
      // Use the map's Home shortcut, enter normally and wear the crafted item in the wardrobe.
      await press(page, view, '[data-action="open"][data-panel="map"]');
      await press(page, view, '[data-action="find"][data-type="house"][data-id="0"]');
      await page.waitForFunction(() => willowmere.metrics().location === 'interior', null, { timeout: 30000 });
      await page.waitForTimeout(700);
      if (view !== 'desktop') {
        // The phone centres the current room: walk through the bedroom door before tapping its wardrobe.
        for (const spot of [{ x: -3.6, z: 2 }, { x: -3.6, z: -3.4 }]) {
          const screen = await page.evaluate(p => willowmere.project(p.x, p.z, 0), spot);
          await page.touchscreen.tap(screen.x, screen.y);
          await page.waitForFunction(p => Math.hypot(willowmere.metrics().position.x - p.x, willowmere.metrics().position.z - p.z) < .4, spot, { timeout: 15000 });
          await page.waitForTimeout(500);
        }
      }
      const wardrobe = await page.evaluate(() => willowmere.targets().find(t => t.type === 'wardrobe'));
      assert.ok(wardrobe, 'home wardrobe exists');
      await (view === 'desktop' ? page.mouse.click(wardrobe.screen.x, wardrobe.screen.y) : page.touchscreen.tap(wardrobe.screen.x, wardrobe.screen.y));
      await page.waitForSelector('#modal-title:has-text("Your wardrobe")', { timeout: 20000 });
      await press(page, view, '[data-type="equip"][data-id="boots_lava"]');
      assert.equal((await snapshot(page)).gear.boots, 'boots_lava');
      await shot(page, `crafting-${view}-equipped`);
      assert.deepEqual(errors, []); results.push({ view, recipes: 14, crafting: true, improvements: true, saved: true, equipped: true, width });
    } catch (error) { await shot(page, `crafting-${view}-failure`).catch(() => {}); throw error; }
    finally { await context.close(); }
  }
} finally { await save('crafting-browser', results); await browser.close(); }
console.log(JSON.stringify(results)); console.log('crafting-browser: desktop/phone/landscape craft, improvements, save and wardrobe passed');
