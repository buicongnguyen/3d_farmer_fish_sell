// Active phone rooms, real walking and taps. GAME_URL=<built-game> GPU=1 node tests/room-focus-browser.mjs
import assert from 'node:assert/strict';
import { launch, open, metrics, shot, save, VIEWS } from './travel-kit.mjs';
import { frameFor } from '../src/room-camera.mjs';

const browser = await launch(), results = [];
const closePanel = p => p.getByRole('button', { name: 'Close panel', exact: true }).click();
async function walk(p, axis, target) {
  const start = (await metrics(p)).position[axis];
  if (Math.abs(start - target) < .16) return;
  const sign = Math.sign(target - start), key = axis === 'x' ? sign > 0 ? 'd' : 'a' : sign > 0 ? 's' : 'w';
  await p.keyboard.down(key);
  try { await p.waitForFunction(({ axis, target, sign }) => (willowmere.metrics().position[axis] - target) * sign >= -.08, { axis, target, sign }, { timeout: 18000 }); }
  finally { await p.keyboard.up(key); }
}
async function focused(p, id, cx, cz) {
  await p.waitForFunction(({ id, cx, cz }) => {
    const r = willowmere.roomView().room(); return r?.id === id && Math.abs(r.x - cx) < .12 && Math.abs(r.z - cz) < .12;
  }, { id, cx, cz }, { timeout: 10000 });
}
const target = (p, type) => p.evaluate(type => {
  const t = willowmere.targets().find(t => t.type === type), at = t && document.elementFromPoint(t.screen.x, t.screen.y);
  return t && { ...t, top: at?.id, overlay: at?.closest('.minimap,.player-card,.top-actions,.tracker-stack,#room-actions')?.className ?? '' };
}, type);
const tap = (p, t) => p.touchscreen.tap(t.screen.x, t.screen.y);
try {
  for (const view of process.env.ONLY?.split(',') ?? ['phone', 'landscape', 'desktop']) {
    if (!VIEWS[view]) {
      const [width, height] = view.split('x').map(Number); assert.ok(width > 0 && height > 0, `valid view ${view}`);
      VIEWS[view] = { viewport: { width, height }, isMobile: width < 1400, hasTouch: width < 1400 };
    }
    const { width, height } = VIEWS[view].viewport, mode = frameFor(width, height);
    const { page: p, context, errors } = await open(browser, view, s => {
      s.position = { x: 0, z: -8.8 }; s.settings.test = true; s.settings.quality = 'battery'; s.decor = [];
      s.upgrades.house = s.upgrades.kitchen = 3;
    });
    await p.keyboard.press('e'); await p.waitForFunction(() => willowmere.metrics().location === 'interior');
    await p.waitForFunction(() => willowmere.roomView().frame());
    if (mode === 'whole') {
      const r = await p.evaluate(() => ({ f: willowmere.roomView().frame(), room: willowmere.roomView().room() }));
      assert.equal(r.room, null); assert.equal(r.f.mode, 'whole');
      if (width === 1440 && height === 900) assert.ok(Math.abs(r.f.d - 26.2) < .05 && Math.abs(r.f.tz - 2.8) < .05, 'desktop whole-house framing unchanged');
      assert.deepEqual(errors, []); results.push({ view, wholeHouse: true }); await context.close(); continue;
    }
    assert.equal(await p.locator('.minimap').isVisible(), false, `${view}: minimap leaves indoor play area clear`);
    // Enter the kitchen through its doorway, then walk to the cooking spot.
    await walk(p, 'x', 4.1); await walk(p, 'z', -4); await walk(p, 'x', 6.9); await walk(p, 'z', -5.8);
    await focused(p, 'kitchen', 6.15, -5.2);
    const kitchen = await target(p, 'kitchen'); assert.equal(kitchen.top, 'game'); assert.equal(kitchen.overlay, '');
    const kitchenFrame = await p.evaluate(() => willowmere.roomView().room());
    await shot(p, `room-${view}-kitchen`); await tap(p, kitchen);
    await p.waitForSelector('#modal-backdrop:not([hidden])'); assert.match(await p.locator('#modal-title').innerText(), /recipe/i);
    await closePanel(p);
    // Cross the living room, pass through the bedroom doorway, and stand by the bed.
    await walk(p, 'x', 4.1); await walk(p, 'z', -.45); await walk(p, 'x', -3.6); await walk(p, 'z', -4); await walk(p, 'x', -5.35);
    await focused(p, 'bedroom', -6, -5.2);
    const bedroom = await target(p, 'bedroom'); assert.equal(bedroom.top, 'game'); assert.equal(bedroom.overlay, '');
    await shot(p, `room-${view}-bedroom`);
    const before = await p.evaluate(() => willowmere.roomView().room());
    // The nearby wardrobe remains tappable and its character-focused view takes precedence over the room view.
    const wardrobe = await target(p, 'wardrobe'); assert.equal(wardrobe.top, 'game'); await tap(p, wardrobe);
    await p.waitForSelector('#modal-title:has-text("Your wardrobe")', { timeout: 30000 }); await p.waitForTimeout(1200);
    const look = await p.evaluate(() => {
      const r = document.querySelector('#modal').getBoundingClientRect(), s = willowmere.metrics().screen;
      return { s, panel: { left: r.left, top: r.top, right: r.right, bottom: r.bottom }, labels: document.querySelector('#room-labels').hidden };
    });
    assert.equal(look.labels, true); assert.ok(look.s.x > 0 && look.s.y > 0);
    assert.ok(mode === 'portrait' ? look.s.y < look.panel.top - 12 : look.s.x < look.panel.left - 12, `${view}: character stays clear of wardrobe panel`);
    await shot(p, `room-${view}-wardrobe`); await closePanel(p); await focused(p, 'bedroom', -6, -5.2); await p.waitForTimeout(900);
    assert.equal(await p.evaluate(() => document.querySelector('#room-labels').hidden), false);
    assert.deepEqual(errors, []); results.push({ view, kitchenFrame, bedroom: before, wardrobe: look }); await context.close();
  }
  await save('room-focus-results', results); console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
