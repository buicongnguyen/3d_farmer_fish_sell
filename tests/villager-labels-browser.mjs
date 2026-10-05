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
// Read after the name overlay's own frame callback. The fixed-height NPC projection removes walking/camera motion;
// what remains must be one constant offset, rather than body bob or integer-pixel jumps.
const movingNames = page => page.evaluate(() => new Promise(resolve => {
  const series = new Map(), started = performance.now(); let done = false;
  const finish = () => {
    if (done) return; done = true; clearTimeout(timer);
    resolve({ elapsed: performance.now() - started, walkers: [...series.values()].filter(s => s.samples >= 20 && s.distance >= .5).map(s => ({
      id: s.id, samples: s.samples, distance: s.distance, xSpan: s.maxX - s.minX, ySpan: s.maxY - s.minY,
      maxFrameDelta: s.maxFrameDelta, maxFromFirst: s.maxFromFirst,
    })) });
  };
  const timer = setTimeout(finish, 55000);
  willowmere.roomView().onAfter(() => {
    if (done) return;
    const people = willowmere.villagers().npcs;
    for (const node of document.querySelectorAll('#villager-names span:not([hidden])')) {
      const id = node.dataset.villager, n = people.find(p => p.id === id);
      if (!n?.moving || n.inside || id === 'theo' || id === 'finn') continue; // seated riders have a different anchor
      const probe = willowmere.test.npc(id); if (!probe || probe.pending) continue;
      const r = node.getBoundingClientRect(), x = r.x + r.width / 2 - probe.screen.x, y = r.y - probe.screen.y;
      let s = series.get(id);
      if (!s) { s = { id, samples: 0, distance: 0, minX: x, maxX: x, minY: y, maxY: y, firstX: x, firstY: y, x, y, wx: n.x, wz: n.z, maxFrameDelta: 0, maxFromFirst: 0 }; series.set(id, s); continue; }
      const step = Math.hypot(n.x - s.wx, n.z - s.wz); if (step <= .00001) continue;
      s.samples++; s.distance += step; s.minX = Math.min(s.minX, x); s.maxX = Math.max(s.maxX, x); s.minY = Math.min(s.minY, y); s.maxY = Math.max(s.maxY, y);
      s.maxFrameDelta = Math.max(s.maxFrameDelta, Math.hypot(x - s.x, y - s.y));
      s.maxFromFirst = Math.max(s.maxFromFirst, Math.hypot(x - s.firstX, y - s.firstY));
      s.x = x; s.y = y; s.wx = n.x; s.wz = n.z;
    }
    if (performance.now() - started >= 6000 && [...series.values()].some(s => s.samples >= 20 && s.distance >= .5)) finish();
  });
}));
try {
  for (const view of ['desktop', 'phone', 'landscape']) {
    const phone = view !== 'desktop', cap = phone ? 6 : 10;
    const { page, context, errors: e } = await open(browser, view, s => { s.position = { x: 5.5, z: 32 }; s.time = 12; s.settings.test = true; }, { quality: phone ? 'battery' : 'high' }); errors.push(e);
    try {
      await page.waitForFunction(() => document.querySelectorAll('#villager-names span:not([hidden])').length >= 2, null, { timeout: 30000 });
      const near = await read(page); assert.ok(near.length <= cap);
      await page.screenshot({ path: `${out}/${view}-names.png` });
      if (view !== 'landscape') {
        const motion = await movingNames(page); results.push({ view, check: 'moving names keep a steady ground-relative offset', motion });
        assert.ok(motion.walkers.length, `${view}: sampled at least 20 real moving frames over half a metre`);
        for (const n of motion.walkers) assert.ok(n.xSpan <= .1 && n.ySpan <= .1, `${view}: ${n.id} name shakes ${n.xSpan.toFixed(3)}px horizontally / ${n.ySpan.toFixed(3)}px vertically`);
        await page.screenshot({ path: `${out}/${view}-moving-names.png` });
      }
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
