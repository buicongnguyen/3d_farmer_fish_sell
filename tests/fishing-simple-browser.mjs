// Rod fishing the simple way (as in Zoo Garden) in a real browser: stand at the pond's edge and point at the water to cast
// there; no panel, one round Reel button and a one-line hint; the village keeps living; any move packs the rod away at
// once and you walk; pointing elsewhere casts again; one control lands the fish.
//   GAME_URL=http://127.0.0.1:<port> node tests/fishing-simple-browser.mjs      (GPU=1 for a real GPU)
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshState, SAVE_KEY } from '../src/game.mjs';
import { POND, WOODLAND } from '../src/content.mjs';
import { BANK, waterDistance } from '../src/pond.mjs';
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
const POOL = ['perch', 'carp', 'catfish'];   // the family pond before any upgrade
const seed = (extra = {}) => Object.assign(freshState(), { started: true, coins: 500, ...extra });
async function setup(state, screen = 'desktop') {
  const [width, height] = SCREENS[screen], mobile = screen !== 'desktop';
  const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  await context.addInitScript(({ key, state }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state)); }, { key: SAVE_KEY, state });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(base); await page.waitForFunction(() => window.willowmere?.metrics().ready && willowmere.project, null, { timeout: 90000 }); await page.locator('#begin').click(); await page.waitForTimeout(500);
  const tap = (x, y) => mobile ? page.touchscreen.tap(x, y) : page.mouse.click(x, y);
  /** Point at a place in the world: on the water's surface (0.3 m up) or on the ground. */
  const point = async (at, y = .3) => { const s = await page.evaluate(([x, z, y]) => willowmere.project(x, z, y), [at.x, at.z, y]); assert.ok(s.x > 4 && s.x < width - 4 && s.y > 4 && s.y < height - 4, `the point is on the screen (${Math.round(s.x)}, ${Math.round(s.y)})`); await tap(s.x, s.y); return s; };
  return { page, context, width, height, tap, point, mobile, screen };
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
  await point(bank.aim); await lineOut(p); const f = await settled(p), m = await metrics(p), s = await snapshot(p);
  assert.ok(far(m.position, m0.position) < .15, `${note}: you cast from where you stand`);
  assert.ok(far({ x: f.float.x, z: f.float.z }, bank.aim) < .6, `${note}: the float is where you pointed (${f.float.x.toFixed(1)}, ${f.float.z.toFixed(1)})`); assert.ok(inPond({ x: f.float.x, z: f.float.z }) && f.float.y < 1);
  assert.equal(Math.round(before.energy - s.energy), 3, `${note}: three energy for a started line`);
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

try {
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
      await p.mouse.move(cx, cy); await p.mouse.down(); await p.mouse.move(cx, cy - 34, { steps: 2 }); await packedAway(p, `stick on ${screen}`); await p.waitForTimeout(300); await p.mouse.up();
      const w = await watched(p), to = (await metrics(p)).position;
      assert.ok(w.line >= 0 && w.line <= 4, `stick on ${screen}: packed away within ${w.line} frames`); assert.ok(far(from, to) > .4, `stick on ${screen}: you walked ${far(from, to).toFixed(2)} m`); assert.equal(await toastText(p), 'Fishing line reeled in.');
      assert.ok(await box(p, '#touch-action'), 'ACT is back'); results.push({ name: `the thumb stick packs the rod away and you walk: ${screen}` }); await t.context.close();
    }
    // A tap on the grass, 6 m from the pond: you walk there, and the rod goes back in the bag on the way.
    {
      const t = await setup(seed({ position: BANKS.south.at }), screen), { page: p, point } = t; await point(BANKS.south.aim); await lineOut(p); await settled(p);
      const grass = { x: BANKS.south.at.x - 1, z: z1 + 6 }; await watch(p); await point(grass, 0); await packedAway(p, `ground tap on ${screen}`);
      const w = await watched(p), m = await metrics(p); assert.ok(w.line >= 0 && w.line <= 3, `ground tap on ${screen}: packed away within ${w.line} frames`); assert.ok(m.navigation.remaining > 0, 'a walk is under way');
      await p.waitForFunction(g => { const m = willowmere.metrics(); return Math.hypot(m.position.x - g.x, m.position.z - g.z) < 1 && !m.navigation.remaining; }, grass, { timeout: 15000 });
      const end = await metrics(p); assert.ok(waterDistance(end.position.x, end.position.z) > BANK.near); assert.equal(end.fishing.equipped, false, 'far from the water the rod is put away'); assert.equal(end.fishing.line, false);
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
    assert.ok(waterDistance(from.x, from.z) > BANK.near && !(await metrics(p)).fishing.equipped); await point(aim); await p.waitForTimeout(250); assert.equal((await metrics(p)).fishing.line, false, 'no cast from afar');
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
    assert.equal(await p.locator('#fish-hint').textContent(), 'Too early! Wait for the bobber to sink.'); assert.equal(pulled.line, true);
    // Opening a panel packs away too.
    await p.keyboard.press('i'); await p.waitForSelector('#modal-title'); const m = await metrics(p); assert.equal(m.fishing.line, false); assert.equal(await box(p, '#reel-button'), null);
    results.push({ name: 'E casts at the bank and does nothing with the line out; an early press scares the fish; a panel packs away' }); await t.context.close();
    // Too tired: no line, and the game says why.
    const tired = await setup(seed({ position: BANKS.south.at, energy: 2 })); await tired.point(BANKS.south.aim); await tired.page.waitForTimeout(500);
    assert.equal((await metrics(tired.page)).fishing.line, false); assert.match(await toastText(tired.page), /Rest or eat/); assert.equal(await box(tired.page, '#reel-button'), null);
    results.push({ name: 'too tired to cast: a message, no line' }); await tired.context.close();
  }

  // ---------------------------------------------------------------- 5. one control lands the fish; then the green Cast button
  for (const screen of Object.keys(SCREENS)) {
    const t = await setup(seed({ position: BANKS.south.at }), screen), { page: p, point, mobile } = t, button = p.locator('#reel-button'); await point(BANKS.south.aim); await lineOut(p);
    const before = await snapshot(p); await phase(p, 'bite', 45000);
    assert.ok(await button.evaluate(b => b.classList.contains('bite')), `${screen}: the button pulses at the bite`); assert.equal(await p.locator('#fish-hint').textContent(), 'Bite! Press Reel!');
    const r = await box(p, '#reel-button'); if (mobile) { await p.mouse.move(r.x + r.w / 2, r.y + r.h / 2); await p.mouse.down(); } else await p.keyboard.down('Space');
    await phase(p, 'hooked', 2000); await p.waitForTimeout(200); assert.equal(await button.getAttribute('aria-pressed'), 'true'); assert.ok(await button.evaluate(b => b.classList.contains('down') && !b.classList.contains('bite')));
    assert.match(await p.locator('#fish-hint').textContent(), /Hold Reel to pull it in|Surge! Let go!|Easy… let the line go/); assert.equal(await p.locator('meter').count(), 0);
    await p.screenshot({ path: `test-results/fishing-simple-${screen}-hooked.png` });
    if (mobile) await p.mouse.up(); else await p.keyboard.up('Space');
    await landFish(p, { touch: mobile });
    const after = await snapshot(p), gained = POOL.filter(id => (after.inventory[id] ?? 0) > (before.inventory[id] ?? 0));
    if (after.stats.fish === before.stats.fish) { results.push({ name: `the fish got away on ${screen} (${await toastText(p)}): the Cast button is offered all the same` }); }
    else { assert.equal(after.stats.fish, before.stats.fish + 1); assert.equal(gained.length, 1, `${screen}: one fish from the pond's pool`); assert.match(await toastText(p), /Worth \d+ coins/); }
    // The green Cast button, for six seconds.
    assert.ok(await button.evaluate(b => b.classList.contains('cast') && !b.hidden), `${screen}: the green Cast button`); assert.equal(await p.locator('#reel-text').textContent(), 'Cast'); assert.equal(await box(p, '#fish-hint'), null);
    await p.screenshot({ path: `test-results/fishing-simple-${screen}-cast-again.png` });
    if (screen === 'desktop') { const e = (await snapshot(p)).energy; await button.click(); await lineOut(p); assert.equal(Math.round(e - (await snapshot(p)).energy), 3); assert.equal(await p.locator('#reel-text').textContent(), 'Reel'); assert.ok(!(await button.evaluate(b => b.classList.contains('cast')))); await p.keyboard.press('Escape'); await packedAway(p, 'after Cast'); }
    else if (screen === 'phone') { await p.waitForFunction(() => document.querySelector('#reel-button').hidden, null, { timeout: 8000 }); assert.ok(await box(p, '#touch-action'), 'ACT is back'); assert.equal((await metrics(p)).fishing.line, false); }
    else { await p.keyboard.down('d'); await p.waitForFunction(() => document.querySelector('#reel-button').hidden, null, { timeout: 500, polling: 'raf' }); await p.keyboard.up('d'); }
    if (after.stats.fish > before.stats.fish) results.push({ name: `press at the bite, hold to pull, let go on a surge: a fish landed with one control (${mobile ? 'the Reel button' : 'Space'}), then Cast: ${screen}` });
    await t.context.close();
  }
  assert.ok(results.some(r => r.name.startsWith('press at the bite')), 'at least one fish was landed');

  // ---------------------------------------------------------------- 6. the woodland hunt keeps its card
  {
    const t = await setup(seed({ position: { x: WOODLAND.x, z: WOODLAND.z + 1.5 } })), p = t.page; await p.keyboard.press('e'); await p.waitForSelector('[data-action="track"]', { timeout: 8000 });
    assert.equal(await p.locator('#activity .fishing-card').count(), 1); assert.equal(await box(p, '#reel-button'), null); await p.keyboard.press('Escape'); assert.equal(await p.evaluate(() => document.querySelector('#activity').hidden), true);
    results.push({ name: 'the woodland hunt keeps its card' }); await t.context.close();
  }
  assert.deepEqual(errors, [], 'no console errors');
  await writeFile('test-results/fishing-simple-report.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ pass: results.length, results }, null, 2));
} catch (error) { console.error(JSON.stringify({ pass: results.length, results, errors }, null, 2)); console.error(error); process.exitCode = 1; }
finally { await browser.close(); }
