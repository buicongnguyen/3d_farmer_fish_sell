// Rod fishing the simple way (as in Zoo Garden) in a real browser: stand at the pond's edge and point at the water to cast
// there; no panel, one round Reel button and a one-line hint; the village keeps living; any move packs the rod away at
// once and you walk; pointing elsewhere casts again; one control lands the fish.
//   GAME_URL=http://127.0.0.1:<port> node tests/fishing-simple-browser.mjs      (GPU=1 for a real GPU)
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshState, SAVE_KEY } from '../src/game.mjs';
import { POND, WOODLAND, FISH_SPOT } from '../src/content.mjs';
import { BANK, waterDistance, FISH_POOLS } from '../src/pond.mjs';
import { landFish } from './fishing-controls.mjs';

const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome', headless: true, args: process.env.GPU ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const base = process.env.GAME_URL ?? 'http://127.0.0.1:4173', errors = [], results = []; await mkdir('test-results', { recursive: true });
const SCREENS = { desktop: [1440, 900], phone: [390, 844], landscape: [844, 390] };
const x0 = POND.x - POND.w / 2, x1 = POND.x + POND.w / 2, z0 = POND.z - POND.d / 2, z1 = POND.z + POND.d / 2;
// Three places at the water's edge, 0.9 m from it, and a spot of water about 4 m out from each (not straight ahead).
const BANKS = {
  north: { at: { x: POND.x + 1, z: z0 - .9 }, aim: { x: POND.x + 2.5, z: z0 + 3.2 }, again: { x: POND.x - 2, z: z0 + 2.4 } },
  east: { at: { x: x1 + .9, z: POND.z - 2 }, aim: { x: x1 - 3.4, z: POND.z - .5 }, again: { x: x1 - 2.2, z: POND.z - 3 } },
  south: { at: { x: POND.x - 3, z: z1 + .9 }, aim: { x: POND.x - 1.5, z: z1 - 3.2 }, again: { x: POND.x - 5, z: z1 - 2.4 } },
};
const POOL = FISH_POOLS[0];   // the family pond before any upgrade
const seed = (extra = {}) => Object.assign(freshState(), { started: true, coins: 500, ...extra });
async function setup(state, screen = 'desktop') {
  const [width, height] = SCREENS[screen], mobile = screen !== 'desktop';
  const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  await context.addInitScript(({ key, state }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state)); }, { key: SAVE_KEY, state });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(base); await page.waitForFunction(() => window.willowmere?.metrics().ready && willowmere.project, null, { timeout: 90000 }); await page.locator('#begin').click(); await page.waitForTimeout(500);
  const tap = (x, y) => mobile ? page.touchscreen.tap(x, y) : page.mouse.click(x, y);
  // A finger that stays down (the thumb stick, a held Reel): real touch events, sent through the DevTools protocol.
  const cdp = mobile ? await context.newCDPSession(page) : null, touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y]) => ({ x: Math.round(x), y: Math.round(y), id: 1 })) });
  const finger = mobile ? { down: (x, y) => touch('touchStart', [[x, y]]), move: (x, y) => touch('touchMove', [[x, y]]), up: () => touch('touchEnd', []) } : null;
  /** Point at a place in the world: on the water's surface (0.3 m up) or on the ground. */
  const point = async (at, y = .3) => { const s = await page.evaluate(([x, z, y]) => willowmere.project(x, z, y), [at.x, at.z, y]); assert.ok(s.x > 4 && s.x < width - 4 && s.y > 4 && s.y < height - 4, `the point is on the screen (${Math.round(s.x)}, ${Math.round(s.y)})`); await tap(s.x, s.y); return s; };
  return { page, context, width, height, tap, point, mobile, screen, finger };
}
const metrics = p => p.evaluate(() => willowmere.metrics()), snapshot = p => p.evaluate(() => willowmere.snapshot());
const far = (a, b) => Math.hypot(a.x - b.x, a.z - b.z), inPond = p => p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1;
const toastText = p => p.evaluate(() => { const t = document.querySelector('#toast'); return t.classList.contains('show') ? t.textContent : ''; });
const box = (p, sel) => p.evaluate(sel => { const e = document.querySelector(sel); if (!e || e.hidden || getComputedStyle(e).display === 'none' || getComputedStyle(e).visibility === 'hidden') return null; const r = e.getBoundingClientRect(); return r.width ? { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom } : null; }, sel);
const inside = (pt, r, pad = 0) => !!r && pt.x > r.x - pad && pt.x < r.r + pad && pt.y > r.y - pad && pt.y < r.b + pad;
const overlap = (a, b) => !!a && !!b && a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b;
const lineOut = (p, timeout = 1500) => p.waitForFunction(() => willowmere.metrics().fishing.line, null, { timeout, polling: 30 });
const phase = (p, name, timeout = 8000) => p.waitForFunction(n => willowmere.metrics().fishing.phase === n, name, { timeout, polling: 30 });
const settled = async p => { await p.waitForFunction(() => !['cast', 'idle'].includes(willowmere.metrics().fishing.phase), null, { timeout: 5000 }); await p.waitForTimeout(350); return (await metrics(p)).fishing; };
/** Counts frames from the first key or pointer press until the line is gone and until you have moved. */
const watch = p => p.evaluate(() => {
  const w = window.__watch = { line: -1, moved: -1, n: -1 }, at = { ...willowmere.metrics().position };
  const start = () => { if (w.n >= 0) return; w.n = 0; const frame = () => { w.n++; const m = willowmere.metrics(); if (w.line < 0 && !m.fishing.line) w.line = w.n; if (w.moved < 0 && Math.hypot(m.position.x - at.x, m.position.z - at.z) > .005) w.moved = w.n; if (w.n < 120) requestAnimationFrame(frame); }; requestAnimationFrame(frame); };
  for (const type of ['keydown', 'pointerdown']) addEventListener(type, start, { capture: true, once: true });
});
const watched = p => p.evaluate(() => window.__watch);
async function packedAway(p, note) {
  await p.waitForFunction(() => !willowmere.metrics().fishing.line, null, { timeout: 400, polling: 'raf' });
  const f = (await metrics(p)).fishing; assert.equal(f.phase, 'idle', note); assert.equal(f.line, false); assert.equal(f.bobber, false, `${note}: no float left`);
  assert.equal(await box(p, '#reel-button'), null, `${note}: the Reel button is gone`); assert.equal(await box(p, '#fish-hint'), null, `${note}: the hint is gone`);
  assert.equal(await p.evaluate(() => document.querySelector('#modal-backdrop').hidden && document.querySelector('#activity').hidden), true, `${note}: no dialog`);
  assert.equal(await p.evaluate(() => document.body.classList.contains('rod-fishing')), false);
}
/** One started line from a bank: tap the water and check the cast, the screen and the world. */
async function castFrom(t, name) {
  const { page: p, point, mobile, screen, width, height } = t, bank = BANKS[name], note = `${name} bank, ${screen}`;
  const before = await snapshot(p), m0 = await metrics(p); assert.equal(m0.fishing.equipped, true, `${note}: the rod is out at the edge`);
  // One way to cast on the screen: the pill says to point at the water, in this screen's words.
  assert.equal(await p.locator('#interact span').textContent(), mobile ? 'Tap the water to cast' : 'Click the water to cast', `${note}: the pill`); assert.equal(await p.evaluate(() => document.body.classList.contains('at-pond')), true);
  await point(bank.aim); await lineOut(p); const f = await settled(p), m = await metrics(p), s = await snapshot(p);
  assert.ok(far(m.position, m0.position) < .15, `${note}: you cast from where you stand`);
  assert.ok(far({ x: f.float.x, z: f.float.z }, bank.aim) < .6, `${note}: the float is where you pointed (${f.float.x.toFixed(1)}, ${f.float.z.toFixed(1)})`); assert.ok(inPond({ x: f.float.x, z: f.float.z }) && f.float.y < 1);
  assert.ok(Math.abs(before.energy - s.energy) < .5, `${note}: a cast costs no energy (${(before.energy - s.energy).toFixed(2)})`);
  // No panel: nothing but the round button and one line of hint.
  assert.equal(await p.evaluate(() => document.querySelector('#activity').hidden), true, `${note}: no activity sheet`); assert.equal(await p.locator('.fishing-card, .rod-card, #fish-meters, meter').count(), 0, `${note}: no card, no meters`);
  assert.equal(await p.evaluate(() => [...document.querySelectorAll('button')].some(b => b.offsetParent && /pack away/i.test(b.textContent))), false, `${note}: no Pack away button`);
  const reel = await box(p, '#reel-button'), hint = await box(p, '#fish-hint'), stick = await box(p, '#joystick'), limit = mobile ? 96 : 110;
  assert.ok(reel && reel.w <= limit && reel.h <= limit && reel.w >= 56, `${note}: a round Reel button (${reel?.w})`); assert.ok(reel.x >= 0 && reel.y >= 0 && reel.r <= width && reel.b <= height, `${note}: Reel is on the screen`);
  assert.ok(hint && hint.w <= 220 && hint.h <= 34, `${note}: a one-line hint (${hint?.w.toFixed(0)}x${hint?.h.toFixed(0)})`); assert.ok(hint.x >= 0 && hint.r <= width && !overlap(hint, reel), `${note}: the hint sits clear of Reel`);
  assert.match(await p.locator('#fish-hint').textContent(), /Wait for a fish|A fish is coming|A nibble|Bite!/);
  if (mobile) { assert.ok(stick, `${note}: the thumb stick stays`); assert.ok(!overlap(stick, reel) && !overlap(stick, hint)); assert.equal(await box(p, '#touch-action'), null, `${note}: ACT steps aside`); }
  assert.equal(await box(p, '#action-wrap'), null, `${note}: no prompt pill while the line is out`);
  // You and the float: on the screen, under nothing. (The welcome message has gone by now.)
  await p.waitForFunction(() => !document.querySelector('#toast').classList.contains('show'), null, { timeout: 8000 });
  const seen = await p.evaluate(() => { const m = willowmere.metrics(), f = m.fishing.float, float = willowmere.project(f.x, f.z, f.y), top = q => { const e = document.elementFromPoint(q.x, q.y); return e ? e.id || e.className || e.tagName : 'off screen'; }; return { me: m.screen, float, over: { me: top(m.screen), float: top(float) } }; });
  for (const [who, at] of [['you', seen.me], ['the float', seen.float]]) {
    assert.ok(at.x > 8 && at.x < width - 8 && at.y > 8 && at.y < height - 8, `${note}: ${who} on the screen (${Math.round(at.x)}, ${Math.round(at.y)})`);
    assert.ok(!inside(at, reel, 6) && !inside(at, hint, 4) && !(mobile && inside(at, stick, 4)), `${note}: ${who} clear of the controls`);
  }
  assert.equal(seen.over.float, 'game', `${note}: nothing covers the float (${seen.over.float})`); assert.equal(seen.over.me, 'game', `${note}: nothing covers you (${seen.over.me})`);
  return { before, bank, note };
}

const act = async t => { if (t.mobile) { const b = await box(t.page, '#touch-action'); assert.ok(b, 'ACT is on the screen'); await t.tap(b.x + b.w / 2, b.y + b.h / 2); } else await t.page.keyboard.press('e'); };
const press = async (t, sel) => { const b = await box(t.page, sel); assert.ok(b, sel + ' is on the screen'); await t.tap(b.x + b.w / 2, b.y + b.h / 2); };
const TOO_EARLY = 'Too early! Wait for a bite';
const running = async p => { const t0 = (await snapshot(p)).time; await p.waitForTimeout(700); return (await snapshot(p)).time > t0; };
const arrived = (p, at, timeout = 8000) => p.waitForFunction(g => { const m = willowmere.metrics(); return Math.hypot(m.position.x - g.x, m.position.z - g.z) < .6 && !m.navigation.remaining; }, at, { timeout });
// KEEP_GOING=1 runs every review section even after one fails (to see all that is broken at once).
const failed = [], section = async run => { try { await run(); } catch (error) { if (!process.env.KEEP_GOING) throw error; failed.push(error); console.error(String(error.message).split('\n')[0]); } };
// ONLY=review runs the checks added after the reviews (sections 6 to 13) and skips the first five.
const first = async () => {
  // ---------------------------------------------------------------- 1. cast by pointing, from three banks, on three screens
  for (const screen of Object.keys(SCREENS)) for (const name of Object.keys(BANKS)) {
    const t = await setup(seed({ position: BANKS[name].at }), screen), { page: p, point } = t, { bank, note } = await castFrom(t, name);
    await p.screenshot({ path: `test-results/fishing-simple-${screen}-${name}-wait.png` });
    // The village is alive while you fish: the clock runs and the neighbours walk.
    const t0 = await p.evaluate(() => ({ t: willowmere.render().t, time: willowmere.snapshot().time, npcs: willowmere.villagers().npcs.map(n => [n.x, n.z]) })); await p.waitForTimeout(1500);
    const t1 = await p.evaluate(() => ({ t: willowmere.render().t, time: willowmere.snapshot().time, npcs: willowmere.villagers().npcs.map(n => [n.x, n.z]) }));
    assert.ok(t1.t > t0.t + 1 && t1.time > t0.time, `${note}: time passes`); assert.ok(t1.npcs.some((n, i) => Math.hypot(n[0] - t0.npcs[i][0], n[1] - t0.npcs[i][1]) > .05), `${note}: somebody in the village moved`);
    // Pointing at another spot of water casts again there: free, and without a step.
    await p.waitForFunction(() => ['wait', 'approach', 'nibble'].includes(willowmere.metrics().fishing.phase), null, { timeout: 15000, polling: 30 });
    const e0 = (await snapshot(p)).energy, at0 = (await metrics(p)).position; await point(bank.again); await p.waitForFunction(() => willowmere.metrics().fishing.phase === 'cast', null, { timeout: 1500, polling: 'raf' }).catch(() => { });
    const again = await settled(p), m = await metrics(p);
    assert.ok(far({ x: again.float.x, z: again.float.z }, bank.again) < .6, `${note}: the float moved to the new spot (${again.float.x.toFixed(1)}, ${again.float.z.toFixed(1)})`);
    assert.equal(Math.floor((await snapshot(p)).energy), Math.floor(e0), `${note}: casting again is free`); assert.ok(far(m.position, at0) < .05, `${note}: you did not move`); assert.equal(m.fishing.line, true);
    await p.keyboard.press('Escape'); await packedAway(p, `${note}, Escape`); assert.equal(await toastText(p), 'Fishing line reeled in.');
    results.push({ name: `point and cast, no panel, a live village, cast again: ${note}` }); await t.context.close();
  }

  // ---------------------------------------------------------------- 2. any move packs the rod away at once, and you walk
  for (const screen of Object.keys(SCREENS)) {
    // Move keys (a keyboard works on every screen).
    for (const [key, name] of [['d', 'south'], ['ArrowUp', 'north'], ['a', 'east']]) {
      if (screen !== 'desktop' && key !== 'd') continue;
      const t = await setup(seed({ position: BANKS[name].at }), screen), { page: p, point } = t; await point(BANKS[name].aim); await lineOut(p); await settled(p);
      const from = (await metrics(p)).position; await watch(p); await p.keyboard.down(key); await packedAway(p, `${key} on ${screen}`); await p.waitForTimeout(300); await p.keyboard.up(key);
      const w = await watched(p), to = (await metrics(p)).position;
      assert.ok(w.line >= 0 && w.line <= 3, `${key} on ${screen}: packed away within ${w.line} frames`); assert.ok(w.moved >= 0 && w.moved <= 3, `${key} on ${screen}: walking within ${w.moved} frames`);
      assert.ok(far(from, to) > .5, `${key} on ${screen}: you walked ${far(from, to).toFixed(2)} m`); assert.equal(await toastText(p), 'Fishing line reeled in.');
      results.push({ name: `a move key packs the rod away within ${w.line} frame(s) and you walk: ${key}, ${screen}` }); await t.context.close();
    }
    // The thumb stick.
    if (screen !== 'desktop') {
      const t = await setup(seed({ position: BANKS.north.at }), screen), { page: p, point } = t; await point(BANKS.north.aim); await lineOut(p); await settled(p);
      const from = (await metrics(p)).position, stick = await box(p, '#joystick'), cx = stick.x + stick.w / 2, cy = stick.y + stick.h / 2; await watch(p);
      await t.finger.down(cx, cy); await t.finger.move(cx, cy - 17); await t.finger.move(cx, cy - 34); await packedAway(p, `stick on ${screen}`); await p.waitForTimeout(300); await t.finger.up();
      const w = await watched(p), to = (await metrics(p)).position;
      assert.ok(w.line >= 0 && w.line <= 4, `stick on ${screen}: packed away within ${w.line} frames`); assert.ok(far(from, to) > .4, `stick on ${screen}: you walked ${far(from, to).toFixed(2)} m`); assert.equal(await toastText(p), 'Fishing line reeled in.');
      assert.ok(await box(p, '#touch-action'), 'ACT is back'); results.push({ name: `the thumb stick (a real finger) packs the rod away and you walk: ${screen}` }); await t.context.close();
    }
    // A tap on the grass, 6 m from the pond: you walk there, and the rod goes back in the bag on the way.
    {
      const t = await setup(seed({ position: BANKS.south.at }), screen), { page: p, point } = t; await point(BANKS.south.aim); await lineOut(p); await settled(p);
      const grass = { x: BANKS.south.at.x - 1, z: z1 + 6 }; await watch(p); await point(grass, 0); await packedAway(p, `ground tap on ${screen}`);
      const w = await watched(p), m = await metrics(p); assert.ok(w.line >= 0 && w.line <= 3, `ground tap on ${screen}: packed away within ${w.line} frames`); assert.ok(m.navigation.remaining > 0, 'a walk is under way');
      await p.waitForFunction(g => { const m = willowmere.metrics(); return Math.hypot(m.position.x - g.x, m.position.z - g.z) < 1 && !m.navigation.remaining; }, grass, { timeout: 15000 });
      const end = await metrics(p); assert.ok(waterDistance(end.position.x, end.position.z) > BANK.reach); assert.equal(end.fishing.equipped, false, 'outside the border the rod is put away'); assert.equal(end.fishing.line, false);
      results.push({ name: `a tap on the ground packs the rod away and you walk there: ${screen}` }); await t.context.close();
    }
  }

  // The Home button is a move too: the rod is packed away and you set off.
  {
    const t = await setup(seed({ position: BANKS.north.at })), { page: p, point } = t; await point(BANKS.north.aim); await lineOut(p); await settled(p);
    await p.locator('.home-button').click(); await packedAway(p, 'the Home button'); assert.ok((await metrics(p)).navigation.remaining > 0, 'walking home');
    results.push({ name: 'the Home button packs the rod away and you walk home' }); await t.context.close();
  }

  // ---------------------------------------------------------------- 3. from afar: walk to the bank, then cast toward the tap
  for (const screen of ['desktop', 'phone']) {
    const from = { x: BANKS.south.at.x, z: z1 + 8 }, t = await setup(seed({ position: from }), screen), { page: p, point } = t, aim = { x: POND.x - 2, z: z1 - 2.5 };
    assert.ok(waterDistance(from.x, from.z) > BANK.reach && !(await metrics(p)).fishing.equipped); await point(aim); await p.waitForTimeout(250); assert.equal((await metrics(p)).fishing.line, false, 'no cast from afar');
    await lineOut(p, 20000); const f = await settled(p), m = await metrics(p);
    assert.ok(waterDistance(m.position.x, m.position.z) <= BANK.reach, `${screen}: you stand at the bank (${waterDistance(m.position.x, m.position.z).toFixed(2)} m)`); assert.ok(m.position.z > z1, 'the south bank, the nearest');
    assert.ok(far({ x: f.float.x, z: f.float.z }, aim) < 1.6, `${screen}: the float is where you tapped`); assert.equal(m.navigation.remaining, 0);
    results.push({ name: `a tap on the pond from 8 m away walks to the bank and casts toward the tap: ${screen}` }); await t.context.close();
  }

  // ---------------------------------------------------------------- 4. E at the bank; E with the line out; an early press; too tired
  {
    const t = await setup(seed({ position: BANKS.south.at })), { page: p, point } = t, at = BANKS.south.at;
    await p.keyboard.press('e'); await lineOut(p); let f = await settled(p); const length = far({ x: f.float.x, z: f.float.z }, at);
    assert.ok(inPond({ x: f.float.x, z: f.float.z }) && length >= BANK.min - .05 && length <= BANK.max + BANK.reach, `E casts ${length.toFixed(1)} m into the pond`);
    const e0 = (await snapshot(p)).energy; await p.keyboard.press('e'); await p.waitForTimeout(400); const same = (await metrics(p)).fishing;
    assert.ok(far({ x: same.float.x, z: same.float.z }, { x: f.float.x, z: f.float.z }) < .05 && same.line && Math.floor((await snapshot(p)).energy) === Math.floor(e0), 'E with the line out changes nothing');
    assert.equal(await p.evaluate(() => document.querySelector('#modal-backdrop').hidden), true);
    // An early press: the float jerks 0.7 m toward you and the fish has to come again.
    await p.waitForFunction(() => willowmere.metrics().fishing.phase === 'wait', null, { timeout: 15000, polling: 30 }); f = (await metrics(p)).fishing;
    await p.keyboard.press('Space'); await p.waitForTimeout(350); const pulled = (await metrics(p)).fishing, moved = far({ x: f.float.x, z: f.float.z }, { x: pulled.float.x, z: pulled.float.z });
    assert.ok(moved > .55 && moved < .85, `the float moved ${moved.toFixed(2)} m`); assert.ok(far({ x: pulled.float.x, z: pulled.float.z }, at) < far({ x: f.float.x, z: f.float.z }, at), 'toward you');
    assert.equal(await p.locator('#fish-hint').textContent(), TOO_EARLY); assert.equal(pulled.line, true);
    // Opening a panel packs away too.
    await p.keyboard.press('i'); await p.waitForSelector('#modal-title'); const m = await metrics(p); assert.equal(m.fishing.line, false); assert.equal(await box(p, '#reel-button'), null);
    results.push({ name: 'E casts at the bank and does nothing with the line out; an early press scares the fish; a panel packs away' }); await t.context.close();
    // Too tired: no line, and the game says why.
    const tired = await setup(seed({ position: BANKS.south.at, energy: 2 })); await tired.point(BANKS.south.aim); await tired.page.waitForTimeout(500);
    assert.equal((await metrics(tired.page)).fishing.line, false); assert.match(await toastText(tired.page), /Rest or eat/); assert.equal(await box(tired.page, '#reel-button'), null);
    assert.equal(await tired.page.locator('#interact span').textContent(), 'Too tired · rest or eat first'); assert.ok(await tired.page.locator('#interact').evaluate(b => b.classList.contains('waiting')), 'the pill waits');
    assert.ok(Math.abs((await snapshot(tired.page)).energy - 2) < .5, 'nothing spent');
    results.push({ name: 'too tired to hook a fish: refused at the cast with its reason, the pill says so, no line, nothing spent' }); await tired.context.close();
  }

  // ---------------------------------------------------------------- 5. one control lands the fish; then the green Cast button
  for (const screen of Object.keys(SCREENS)) {
    const t = await setup(seed({ position: BANKS.south.at }), screen), { page: p, point, mobile } = t, button = p.locator('#reel-button'); await point(BANKS.south.aim); await lineOut(p);
    const before = await snapshot(p); await phase(p, 'bite', 45000);
    assert.ok(await button.evaluate(b => b.classList.contains('bite')), `${screen}: the button pulses at the bite`); assert.equal(await p.locator('#fish-hint').textContent(), 'Bite! Press Reel!');
    assert.ok(Math.abs(before.energy - (await snapshot(p)).energy) < .5, `${screen}: waiting for the bite costs nothing`);
    const r = await box(p, '#reel-button'); if (mobile) await t.finger.down(r.x + r.w / 2, r.y + r.h / 2); else await p.keyboard.down('Space');
    await phase(p, 'hooked', 2000); await p.waitForTimeout(200); assert.equal(Math.round(before.energy - (await snapshot(p)).energy), 3, `${screen}: three energy when the fish is hooked`); assert.equal(await button.getAttribute('aria-pressed'), 'true'); assert.ok(await button.evaluate(b => b.classList.contains('down') && !b.classList.contains('bite')));
    assert.match(await p.locator('#fish-hint').textContent(), /Hold Reel to pull it in|Surge! Let go!|Easy… let the line go/); assert.equal(await p.locator('meter').count(), 0);
    await p.screenshot({ path: `test-results/fishing-simple-${screen}-hooked.png` });
    if (mobile) await t.finger.up(); else await p.keyboard.up('Space');
    await landFish(p, { touch: mobile && t.finger });
    const after = await snapshot(p), gained = POOL.filter(id => (after.bankCatch?.fish[id] ?? 0) > (before.bankCatch?.fish[id] ?? 0));
    if (after.stats.fish === before.stats.fish) { results.push({ name: `the fish got away on ${screen} (${await toastText(p)}): the Cast button is offered all the same` }); }
    else { assert.equal(after.stats.fish, before.stats.fish + 1); assert.equal(gained.length, 1, `${screen}: one fish from the pond's pool waits on the grass`); assert.deepEqual(after.inventory, before.inventory, `${screen}: the catch waits outside the basket until you walk away`); assert.match(await toastText(p), /Worth \d+ coins/); }
    // The green Cast button, for six seconds.
    assert.ok(await button.evaluate(b => b.classList.contains('cast') && !b.hidden), `${screen}: the green Cast button`); assert.equal(await p.locator('#reel-text').textContent(), 'Cast'); assert.equal(await box(p, '#fish-hint'), null);
    assert.equal(Math.round(before.energy - after.energy), 3, `${screen}: one fish, three energy in all`);
    // One way to cast on the screen: while the Cast button is up there is no pill and no ACT.
    assert.equal(await box(p, '#action-wrap'), null, `${screen}: no pill beside the Cast button`); assert.equal(await box(p, '#touch-action'), null, `${screen}: no ACT beside the Cast button`);
    await p.screenshot({ path: `test-results/fishing-simple-${screen}-cast-again.png` });
    if (screen === 'desktop') { const e = (await snapshot(p)).energy; await button.click(); await lineOut(p); assert.ok(Math.abs(e - (await snapshot(p)).energy) < .5, 'Cast is free'); assert.equal(await p.locator('#reel-text').textContent(), 'Reel'); assert.ok(!(await button.evaluate(b => b.classList.contains('cast')))); await p.keyboard.press('Escape'); await packedAway(p, 'after Cast'); }
    else if (screen === 'phone') { await p.waitForFunction(() => document.querySelector('#reel-button').hidden, null, { timeout: 8000 }); assert.ok(await box(p, '#touch-action'), 'ACT is back'); assert.equal((await metrics(p)).fishing.line, false); assert.ok(await box(p, '#action-wrap'), 'the pill is back'); assert.equal(await p.locator('#interact span').textContent(), 'Tap the water to cast'); }
    else { await p.keyboard.down('d'); await p.waitForFunction(() => document.querySelector('#reel-button').hidden, null, { timeout: 500, polling: 'raf' }); await p.keyboard.up('d'); }
    if (after.stats.fish > before.stats.fish) results.push({ name: `press at the bite, hold to pull, let go on a surge: a fish landed with one control (${mobile ? 'a real finger on the Reel button' : 'Space'}), then Cast: ${screen}` });
    await t.context.close();
  }
  assert.ok(results.some(r => r.name.startsWith('press at the bite')), 'at least one fish was landed');

};
try {
  if (process.env.ONLY !== 'review') await first();

  // ---------------------------------------------------------------- 6. the woodland hunt keeps its card, and its two buttons work
  await section(async () => {
  for (const screen of ['desktop', 'phone']) {
    const t = await setup(seed({ position: { x: WOODLAND.x, z: WOODLAND.z + 1.5 } }), screen), p = t.page; await act(t); await p.waitForSelector('[data-action="track"]', { timeout: 8000 });
    assert.equal(await p.locator('#activity .fishing-card').count(), 1); assert.equal(await box(p, '#reel-button'), null); assert.equal(await running(p), false, 'the hunt holds the village still');
    // Leave: the card closes at once and the village runs again.
    await press(t, '[data-action="cancelActivity"]'); await p.waitForFunction(() => document.querySelector('#activity').hidden, null, { timeout: 600 }); assert.equal(await running(p), true, screen + ': the village runs after Leave');
    // Track: the card closes at once, with a catch or a kind word, never the 14 s timeout.
    await act(t); await p.waitForSelector('[data-action="track"]', { timeout: 8000 }); const before = await snapshot(p);
    await press(t, '[data-action="track"]'); await p.waitForFunction(() => document.querySelector('#activity').hidden, null, { timeout: 600 });
    const after = await snapshot(p), said = await toastText(p); assert.equal(await running(p), true, screen + ': the village runs after Track');
    if (after.huntDay === after.day) assert.ok(after.energy < before.energy, 'a hunt costs energy'); else assert.equal(said, 'The trail went quiet. You can try again.');
    if (screen === 'desktop' && after.huntDay !== after.day) { await p.waitForTimeout(650); await act(t); await p.waitForSelector('[data-action="track"]', { timeout: 8000 }); await p.keyboard.press('Escape'); assert.equal(await p.evaluate(() => document.querySelector('#activity').hidden), true); }
    results.push({ name: 'the woodland hunt keeps its card; Track and Leave answer a ' + (t.mobile ? 'tap' : 'click') + ': ' + screen }); await t.context.close();
  }

  });
  // ---------------------------------------------------------------- 7. at the old dock: a tap on the ground is a walk, with or without the line out
  await section(async () => {
  const DOCK = { x: 13, z: 10.4 }, DOCK_AIM = { x: 14, z: 6.5 };
  assert.ok(Math.hypot(DOCK.x - FISH_SPOT.x, DOCK.z - FISH_SPOT.z) < 1.2, 'the dock bank is beside the old fishing spot');
  for (const screen of ['desktop', 'phone']) {
    // With the line out: taps all round you, down to 1.5 m away, pack the rod away and you walk.
    for (const [dx, dz] of [[-1.5, .3], [-2.5, 1], [0, 2], [1.5, .5], [0, 3]]) {
      const t = await setup(seed({ position: DOCK }), screen), { page: p, point } = t, note = 'ground tap ' + dx + ', ' + dz + ' m from you at the dock, ' + screen, to = { x: DOCK.x + dx, z: DOCK.z + dz }; await point(DOCK_AIM); await lineOut(p); await settled(p);
      const from = (await metrics(p)).position; await point(to, 0); await packedAway(p, note); await arrived(p, to);
      const end = await metrics(p); assert.ok(far(from, end.position) > .9, note + ': you walked ' + far(from, end.position).toFixed(2) + ' m'); assert.equal(end.fishing.line, false); await t.context.close();
    }
    results.push({ name: 'at the dock, a tap on the ground near you packs the rod away and you walk there: ' + screen });
    // No line out: a tap on the grass behind you is a walk, not a cast.
    {
      const t = await setup(seed({ position: DOCK }), screen), { page: p, point } = t, e0 = (await snapshot(p)).energy, grass = { x: DOCK.x, z: DOCK.z + 2 };
      await point(grass, 0); await p.waitForTimeout(400); assert.equal((await metrics(p)).fishing.line, false, screen + ': a tap on the grass casts nothing'); await arrived(p, grass);
      await p.waitForTimeout(400); const m = await metrics(p), s = await snapshot(p); assert.equal(m.fishing.line, false); assert.equal(await box(p, '#reel-button'), null); assert.ok(e0 - s.energy < .5, screen + ': no energy spent (' + (e0 - s.energy).toFixed(2) + ')');
      results.push({ name: 'at the dock with no line out, a tap on the grass walks there and casts nothing: ' + screen }); await t.context.close();
    }
  }

  });
  // ---------------------------------------------------------------- 8. E / ACT is offered exactly at the pond's border; where it is offered it works; no press costs energy
  await section(async () => {
  for (const screen of ['desktop', 'phone']) {
    for (const at of [{ x: 12, z: 11.2 }, { x: 12, z: 11.9 }, { x: 12, z: 12.4 }, { x: 10.2, z: 12 }, { x: 12, z: 12.6 }, { x: 12, z: 12.9 }]) {
      const t = await setup(seed({ position: at }), screen), p = t.page, off = waterDistance(at.x, at.z), edge = off <= BANK.reach, note = 'E at ' + at.x + ', ' + at.z + ' (' + off.toFixed(1) + ' m from the water), ' + screen, e0 = (await snapshot(p)).energy;
      const m0 = await metrics(p), label = await p.locator('#interact span').textContent();
      assert.equal(/water to cast/.test(label), edge, note + ': the pill says "' + label + '"'); assert.doesNotMatch(label, /fishing rod/i); assert.equal(m0.navigation.nearest === 'fish', edge, note + ': the cast is ' + (edge ? '' : 'not ') + 'offered');
      assert.equal(m0.fishing.equipped, edge, note + ': the rod is in your hand exactly where you can cast'); assert.equal(await p.evaluate(() => document.body.classList.contains('at-pond')), edge);
      if (edge) {
        // Offered: it casts, the line stays out, the Reel button is there, and nothing says "reeled in".
        await act(t); await lineOut(p); await p.waitForTimeout(1500); const m = await metrics(p); assert.equal(m.fishing.line, true, note + ': the line stays out'); assert.ok(await box(p, '#reel-button'), note + ': the Reel button');
        assert.notEqual(await toastText(p), 'Fishing line reeled in.', note); assert.ok(far(m.position, at) < .3, note + ': cast from where you stand');
      } else {
        // Not offered: three presses start nothing.
        for (let i = 0; i < 3; i++) { if (t.mobile) { const b = await p.evaluate(() => { const r = document.querySelector('#touch-action').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }); await t.tap(b.x, b.y); } else await p.keyboard.press('e'); await p.waitForTimeout(700); }
        assert.equal((await metrics(p)).fishing.line, false, note); assert.notEqual(await toastText(p), 'Fishing line reeled in.', note); assert.equal(await box(p, '#reel-button'), null);
      }
      const spent = e0 - (await snapshot(p)).energy; assert.ok(Math.abs(spent) < .5, note + ': ' + spent.toFixed(2) + ' energy spent'); await t.context.close();
    }
    // Five casts in a row from the sand rim (cast, pack away, cast …): the line goes out five times and the energy does not move.
    {
      const at = { x: 12, z: 12.4 }, t = await setup(seed({ position: at }), screen), p = t.page, e0 = (await snapshot(p)).energy;
      for (let i = 0; i < 5; i++) { await act(t); await lineOut(p); await p.waitForTimeout(300); await p.keyboard.press('Escape'); await packedAway(p, 'cast ' + (i + 1)); await p.waitForTimeout(700); }
      assert.equal((await metrics(p)).fishing.casts, 5); assert.ok(Math.abs(e0 - (await snapshot(p)).energy) < .5, screen + ': five casts cost ' + (e0 - (await snapshot(p)).energy).toFixed(2) + ' energy'); await t.context.close();
    }
    results.push({ name: 'E / ACT by the dock: offered and working within ' + BANK.reach + ' m of the water, not offered beyond; five casts cost no energy: ' + screen });
  }
  // The map's "Fishing dock" still leads to the water and casts there, once, free.
  {
    const t = await setup(seed({ position: { x: 12, z: 17 } })), p = t.page, e0 = (await snapshot(p)).energy; await p.keyboard.press('m'); await p.locator('[data-action="find"][data-type="fish"]').click();
    await lineOut(p, 20000); await p.waitForTimeout(1200); const m = await metrics(p); assert.equal(m.fishing.line, true, 'the line stays out at the dock'); assert.ok(waterDistance(m.position.x, m.position.z) <= BANK.reach - .5, 'you stand at the water');
    assert.ok(Math.hypot(m.position.x - FISH_SPOT.x, m.position.z - FISH_SPOT.z) < 2.5, 'by the dock'); assert.equal(m.fishing.casts, 1); assert.ok(Math.abs(e0 - (await snapshot(p)).energy) < .5);
    results.push({ name: 'the map\'s Fishing dock walks to the water by the dock and casts once' }); await t.context.close();
  }

  });
  // ---------------------------------------------------------------- 9. a pond tap that never became a cast is forgotten; a second tap elsewhere is a new aim
  await section(async () => {
  for (const [screen, how] of [['desktop', 'a move key'], ['desktop', 'a panel'], ['phone', 'the thumb stick']]) {
    // A far tap, cancelled: E / ACT at the bank later casts straight out, not at the old tap.
    const old = { x: 11, z: 7.5 }, t = await setup(seed({ position: { x: 13, z: 18.5 } }), screen), { page: p, point } = t; await point(old);
    await p.waitForFunction(() => willowmere.metrics().navigation.pending === 'fish', null, { timeout: 2000 });
    if (how === 'a move key') { await p.keyboard.down('d'); await p.waitForTimeout(500); await p.keyboard.up('d'); }
    else if (how === 'a panel') { await p.keyboard.press('i'); await p.waitForSelector('#modal-title'); await p.keyboard.press('Escape'); await p.waitForFunction(() => document.querySelector('#modal-backdrop').hidden); }
    else { const s = await box(p, '#joystick'), cx = s.x + s.w / 2, cy = s.y + s.h / 2; await t.finger.down(cx, cy); await t.finger.move(cx + 30, cy); await p.waitForTimeout(500); await t.finger.up(); }
    await p.waitForTimeout(200); const cancelled = await metrics(p); assert.equal(cancelled.navigation.pending, undefined, how + ': the walk to the bank is cancelled'); assert.equal(cancelled.navigation.remaining, 0);
    const bank = { x: 16.5, z: 10.6 }; await point(bank, 0); await arrived(p, bank, 15000);
    await p.waitForTimeout(300); assert.equal((await metrics(p)).fishing.line, false, 'walking to the bank casts nothing'); const me = (await metrics(p)).position; await act(t); await lineOut(p); const f = await settled(p), float = { x: f.float.x, z: f.float.z };
    assert.ok(Math.abs(float.x - me.x) < .4, screen + ': the float is straight out from you (' + float.x.toFixed(1) + ', ' + float.z.toFixed(1) + ')'); assert.ok(far(float, old) > 3, screen + ': not at the cancelled tap');
    assert.ok(Math.abs(far(float, me) - waterDistance(me.x, me.z) - BANK.cast) < .4, screen + ': ' + BANK.cast + ' m over the water');
    results.push({ name: 'a tap on the pond cancelled by ' + how + ' does not aim a later E / ACT: ' + screen }); await t.context.close();
  }
  for (const screen of ['desktop', 'phone']) {
    // Two taps on two spots of water, one right after the other: the second is a new aim and the line is cast there at once.
    const t = await setup(seed({ position: BANKS.south.at }), screen), { page: p, tap } = t, bank = BANKS.south, at = async q => p.evaluate(([x, z]) => willowmere.project(x, z, .3), [q.x, q.z]);
    const a = await at(bank.aim), b = await at(bank.again), t0 = Date.now(); await tap(a.x, a.y); await tap(b.x, b.y); const gap = Date.now() - t0; await lineOut(p); let f = await settled(p);
    assert.ok(gap < 600, screen + ': the two taps were ' + gap + ' ms apart'); assert.ok(far({ x: f.float.x, z: f.float.z }, bank.again) < .6, screen + ': the float is at the second spot (' + f.float.x.toFixed(1) + ', ' + f.float.z.toFixed(1) + ')'); assert.equal(f.casts, 2, 'cast, then cast again');
    // The same spot twice is a double tap: one cast, not two.
    await p.keyboard.press('Escape'); await packedAway(p, 'Escape'); await p.waitForTimeout(700); const t1 = Date.now(); await tap(a.x, a.y); await tap(a.x + 3, a.y + 2); const twice = Date.now() - t1; await lineOut(p); f = await settled(p);
    assert.ok(twice < 600); assert.equal(f.casts, 3, screen + ': a double tap on one spot casts once'); assert.ok(far({ x: f.float.x, z: f.float.z }, bank.aim) < .6);
    // E after packing away goes back to that last spot.
    if (!t.mobile) { await p.keyboard.press('Escape'); await packedAway(p, 'Escape'); await p.waitForTimeout(700); await p.keyboard.press('e'); await lineOut(p); const g = await settled(p); assert.ok(far({ x: g.float.x, z: g.float.z }, bank.aim) < .6, 'E casts to the last spot'); }
    results.push({ name: 'a second tap on another spot of water re-casts at once (' + gap + ' ms after the first); the same spot twice is one cast: ' + screen }); await t.context.close();
  }
  });
  // ---------------------------------------------------------------- 10. one border: cast in place anywhere inside it, a far tap always ends inside it
  await section(async () => {
  for (const screen of ['desktop', 'phone']) {
    // 2.6 m from the water (the rod is already in your hand): a tap on the water casts from where you stand.
    {
      const at = { x: POND.x - 3, z: z1 + 2.6 }, t = await setup(seed({ position: at }), screen), { page: p, point } = t, aim = { x: POND.x - 2, z: z1 - 2 };
      assert.equal((await metrics(p)).fishing.equipped, true); await point(aim); await lineOut(p); const f = await settled(p), m = await metrics(p);
      assert.ok(far(m.position, at) < .15, screen + ': no step before the cast (' + far(m.position, at).toFixed(2) + ' m)'); assert.ok(far({ x: f.float.x, z: f.float.z }, aim) < .6); await p.waitForTimeout(800); assert.equal((await metrics(p)).fishing.line, true, 'the line stays out'); await t.context.close();
    }
    // From off two corners of the pond: the walk ends inside the border, the cast follows, and afterwards the cast is still on offer there.
    for (const [from, aim] of [[{ x: x1 + 5, z: z1 + 5 }, { x: x1 - 1.5, z: z1 - 1.5 }], [{ x: x0 - 5, z: z1 + 5 }, { x: x0 + 1.5, z: z1 - 1.5 }]]) {
      const t = await setup(seed({ position: from }), screen), { page: p, point } = t, note = 'from ' + from.x + ', ' + from.z + ', ' + screen; assert.ok(waterDistance(from.x, from.z) > BANK.reach + 2);
      await point(aim); await lineOut(p, 20000); const f = await settled(p), m = await metrics(p), off = waterDistance(m.position.x, m.position.z);
      assert.ok(off <= BANK.reach - .5, note + ': you stop ' + off.toFixed(2) + ' m from the water, inside the border'); assert.ok(far({ x: f.float.x, z: f.float.z }, aim) < 1.6, note + ': the float is where you tapped');
      await p.keyboard.press('Escape'); await packedAway(p, note); await p.waitForTimeout(700); assert.equal((await metrics(p)).navigation.nearest, 'fish', note + ': the cast is on offer where you stopped'); assert.match(await p.locator('#interact span').textContent(), /water to cast/);
      await act(t); await lineOut(p); await p.waitForTimeout(800); assert.equal((await metrics(p)).fishing.line, true); await t.context.close();
    }
    results.push({ name: 'one border of ' + BANK.reach + ' m: a tap from 2.6 m casts in place; a far tap at a corner ends inside the border and the cast stays on offer: ' + screen });
  }
  });
  // ---------------------------------------------------------------- 11. landscape phone: at the border every bit of water you can see can be tapped
  await section(async () => {
  for (const [name, at] of [['east', { x: x1 + .9, z: POND.z - 2 }], ['north-east', { x: x1 + .9, z: z0 - .9 }], ['north', BANKS.north.at]]) {
    const t = await setup(seed({ position: at }), 'landscape'), { page: p, tap } = t, note = name + ' bank, landscape'; await p.waitForFunction(() => !document.querySelector('#toast').classList.contains('show'), null, { timeout: 8000 }); await p.waitForTimeout(400);
    const scan = await p.evaluate(({ x0, x1, z0, z1 }) => {
      const stack = document.querySelector('.tracker-stack'), parts = [...stack.querySelectorAll('.day-chip, .quest-tracker')].map(e => e.getBoundingClientRect()), points = [];
      for (let x = x0 + .8; x <= x1 - .8; x += .5) for (let z = z0 + .8; z <= z1 - .8; z += .5) { const s = willowmere.project(x, z, .3); if (s.x < 2 || s.y < 2 || s.x > innerWidth - 2 || s.y > innerHeight - 2) continue; const e = document.elementFromPoint(s.x, s.y); points.push({ x, z, sx: s.x, sy: s.y, top: e ? e.id || String(e.className) || e.tagName : '', hud: !!e?.closest('.tracker-stack'), under: parts.some(r => s.x > r.left && s.x < r.right && s.y > r.top && s.y < r.bottom) }); }
      return { points, opacity: Number(getComputedStyle(stack).opacity), edge: document.body.classList.contains('at-pond') };
    }, { x0, x1, z0, z1 });
    assert.equal(scan.edge, true, note); assert.ok(scan.opacity <= .5, note + ': the tracker fades (' + scan.opacity + ')'); assert.ok(scan.points.length > 20, note + ': the pond is on the screen');
    assert.deepEqual(scan.points.filter(q => q.hud).map(q => q.top), [], note + ': the tracker takes no tap on the water');
    const under = scan.points.filter(q => q.under).sort((a, b) => far(a, at) - far(b, at));
    if (under.length) { const q = under[0]; await tap(q.sx, q.sy); await lineOut(p); const f = await settled(p), m = await metrics(p); assert.ok(far(m.position, at) < .15, note + ': cast in place'); assert.ok(far({ x: f.float.x, z: f.float.z }, q) < Math.max(.6, far(q, at) - BANK.max - waterDistance(at.x, at.z) + .6), note + ': the float went to the water under the tracker'); }
    await p.screenshot({ path: 'test-results/fishing-simple-landscape-' + name + '-tracker.png' });
    results.push({ name: 'landscape phone, ' + name + ' bank: the tracker and calendar chip fade and let taps through (' + under.length + ' of ' + scan.points.length + ' water points lie under them' + (under.length ? '; one tapped, line out' : '') + ')' }); await t.context.close();
  }
  // Away from the pond the tracker is itself again.
  { const t = await setup(seed({ position: { x: POND.x, z: z1 + 8 } }), 'landscape'), p = t.page; assert.equal(await p.evaluate(() => document.body.classList.contains('at-pond')), false); assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector('.tracker-stack')).opacity), '1'); assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector('#quest')).pointerEvents), 'auto'); await t.context.close(); }
  });
  // ---------------------------------------------------------------- 12. on a vehicle a tap on the water says why nothing happens
  await section(async () => {
  for (const screen of ['desktop', 'landscape']) {
    const t = await setup(seed({ position: { x: 5, z: -6 }, bike: true }), screen), { page: p, point } = t; await act(t); await p.waitForFunction(() => willowmere.render().riding, null, { timeout: 8000 });
    await p.waitForTimeout(600); const from = (await metrics(p)).position; await point({ x: x0 + 1.5, z: z0 + 1.5 }); await p.waitForTimeout(300);
    assert.equal(await toastText(p), 'Step out to fish', screen); const m = await metrics(p); assert.equal(m.fishing.line, false); assert.equal(m.navigation.pending, undefined); assert.ok(await p.evaluate(() => willowmere.render().riding), 'still riding'); assert.ok(far(m.position, from) < .3);
    results.push({ name: 'riding: a tap on the water toasts "Step out to fish": ' + screen }); await t.context.close();
  }
  });
  // ---------------------------------------------------------------- 13. the hints fit one line; too tired after a catch there is no Cast button
  await section(async () => {
  for (const screen of Object.keys(SCREENS)) {
    const t = await setup(seed({ position: BANKS.south.at }), screen), { page: p, point } = t; await point(BANKS.south.aim); await lineOut(p); await p.waitForFunction(() => willowmere.metrics().fishing.phase === 'wait', null, { timeout: 15000, polling: 30 });
    if (t.mobile) await press(t, '#reel-button'); else await p.keyboard.press('Space'); await p.waitForFunction(text => document.querySelector('#fish-hint').textContent === text, TOO_EARLY, { timeout: 1500, polling: 'raf' });
    const hint = await box(p, '#fish-hint'), lines = await p.evaluate(() => { const e = document.querySelector('#fish-hint'), range = document.createRange(); range.selectNodeContents(e); return new Set([...range.getClientRects()].map(r => Math.round(r.top))).size; });
    assert.equal(lines, 1, screen + ': "' + TOO_EARLY + '" is on one line'); assert.ok(hint.h <= 34 && hint.w <= 220 && hint.x >= 0 && hint.r <= t.width, screen + ': the hint is ' + hint.w.toFixed(0) + 'x' + hint.h.toFixed(0));
    results.push({ name: 'the "too early" hint fits one line (' + hint.w.toFixed(0) + 'x' + hint.h.toFixed(0) + ' px): ' + screen }); await t.context.close();
  }
  {
    // Energy for one fish and no more: the fish is hooked and played, and afterwards no Cast button is offered that could only refuse.
    const t = await setup(seed({ position: BANKS.south.at, energy: 4 })), { page: p, point } = t; await point(BANKS.south.aim); await lineOut(p); assert.ok(Math.abs((await snapshot(p)).energy - 4) < .5, 'the cast was free');
    await landFish(p); await p.waitForTimeout(400); const s = await snapshot(p); assert.ok(s.energy < 3, 'the hook took its three energy (' + s.energy.toFixed(1) + ' left)');
    assert.equal(await box(p, '#reel-button'), null, 'no Cast button when too tired'); assert.equal(await p.locator('#interact span').textContent(), 'Too tired · rest or eat first');
    await point(BANKS.south.aim); await p.waitForTimeout(500); assert.equal((await metrics(p)).fishing.line, false); assert.match(await toastText(p), /Rest or eat/);
    results.push({ name: 'too tired after a catch: no Cast button, the pill and a tap on the water both say to rest' }); await t.context.close();
  }
  });
  // Not covered here: "a blow packs the rod away" (main.mjs fishingFrame, hp falling). Creatures live only outside the village
  // footprint and the read-only test hooks cannot place one by the pond or lower hp, so that path has no browser check.
  assert.equal(failed.length, 0, failed.length + ' review section(s) failed');
  assert.deepEqual(errors, [], 'no console errors');
  await writeFile('test-results/fishing-simple-report.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ pass: results.length, results }, null, 2));
} catch (error) { console.error(JSON.stringify({ pass: results.length, results, errors }, null, 2)); console.error(error); process.exitCode = 1; }
finally { await browser.close(); }
