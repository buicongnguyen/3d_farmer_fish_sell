// GAME_URL=http://127.0.0.1:<port> GPU=1 node tests/villager-labels-browser.mjs
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { launch, open, press } from './travel-kit.mjs';
const out = 'test-results/villager-labels', results = [], errors = [];
await mkdir(out, { recursive: true });
const browser = await launch();
const read = page => page.evaluate(() => [...document.querySelectorAll('#villager-names span:not([hidden])')].map(n => {
  const r = n.getBoundingClientRect(); return { id: n.dataset.villager, name: n.textContent, x: r.x, y: r.y, w: r.width, h: r.height, font: parseFloat(getComputedStyle(n).fontSize), pointer: getComputedStyle(n).pointerEvents };
}));
try {
  for (const view of ['desktop', 'phone', 'landscape']) {
    const phone = view !== 'desktop', cap = phone ? 6 : 10;
    const { page, context, errors: e } = await open(browser, view, s => { s.position = { x: 5.5, z: 32 }; s.time = 12; }, { quality: phone ? 'battery' : 'high' }); errors.push(e);
    try {
      await page.waitForFunction(() => document.querySelectorAll('#villager-names span:not([hidden])').length >= 2, null, { timeout: 30000 });
      const near = await read(page); assert.ok(near.length <= cap);
      await page.screenshot({ path: `${out}/${view}-names.png` });
      const viewport = page.viewportSize(); await page.mouse.move(viewport.width / 2, viewport.height / 2);
      await page.mouse.wheel(0, 2000); await page.waitForTimeout(450);
      const far = await read(page), villagers = await page.evaluate(() => willowmere.villagers().npcs), size = page.viewportSize();
      assert.ok(far.length >= 2 && far.length <= cap, `${view}: bounded names at the wide zoom`);
      for (const n of far) {
        assert.equal(villagers.find(p => p.id === n.id).inside, false, `${view}: no indoor resident label`);
        assert.equal(n.font, near[0].font, `${view}: names do not shrink when zooming out`); assert.ok(n.font >= 12);
        assert.equal(n.pointer, 'none'); assert.ok(n.x >= 0 && n.x + n.w <= size.width && n.y >= 0 && n.y + n.h <= size.height);
      }
      for (const a of far) for (const b of far) if (a !== b) assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, `${view}: labels stay apart`);
      const controls = await page.evaluate(() => [...document.querySelectorAll('#joystick,#touch-action,.home-button')].filter(n => n.offsetParent).map(n => { const r = n.getBoundingClientRect(); return { id: n.id || n.className, left: r.left, top: r.top, right: r.right, bottom: r.bottom }; }));
      for (const n of [...near, ...far]) for (const r of controls) assert.ok(n.x + n.w <= r.left || n.x >= r.right || n.y + n.h <= r.top || n.y >= r.bottom, `${view}: ${n.name} stays clear of ${r.id}`);
      await page.screenshot({ path: `${out}/${view}-wide-names.png` });
      await press(page, view, '[data-action="open"][data-panel="bag"]');
      await page.waitForFunction(() => document.getElementById('villager-names').hidden);
      await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.getElementById('villager-names').hidden);
      results.push({ view, near, far, controls, check: 'fixed readable font, bounded count, no overlap, clear thumb controls, visible residents only, panels hide names' });
    } catch (error) { await page.screenshot({ path: `${out}/${view}-failure.png` }).catch(() => {}); throw error; }
    finally { await context.close(); }
  }
  assert.deepEqual(errors.flat(), []); console.log(JSON.stringify(results)); console.log('villager names browser: ok');
} finally { await writeFile(`${out}/results.json`, JSON.stringify({ results, errors }, null, 2)); await browser.close(); }
