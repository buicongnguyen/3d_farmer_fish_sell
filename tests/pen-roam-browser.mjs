// The pen animals roaming in a real browser: the clock runs at 20x (test mode) from seven in the morning to ten at night, positions are
// sampled all the way, and none may be outside the range, in a road or the pond; the gate lets them out by day and they are home at night
// with the gate shut; an animal far from the fence can be tapped to feed it and to collect; pictures at 1440x900 and 390x844.
//   GAME_URL=http://127.0.0.1:4541 GPU=1 node tests/pen-roam-browser.mjs        (PEN_OUT=<dir> for the pictures)
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { freshState, SAVE_KEY } from '../src/game.mjs';
import { PEN } from '../src/pen-roam.mjs';
import { staticCuts } from '../src/pen-range.mjs';
import { sharedRange, cutDistance } from './pen-sim.mjs';

const base = process.env.GAME_URL ?? 'http://127.0.0.1:4541', out = process.env.PEN_OUT ?? 'test-results/pen', errors = [];
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome', headless: true, args: process.env.GPU ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const SCREENS = { desktop: { viewport: { width: 1440, height: 900 } }, phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } };
const range = sharedRange(), cuts = staticCuts();
const seed = (extra = {}, settings = {}) => { const s = Object.assign(freshState(), { started: true, coins: 900 }, extra); s.upgrades.pen = 3; Object.assign(s.settings, settings); return s; };
async function setup(state, screen = 'desktop') {
  const context = await browser.newContext({ ...SCREENS[screen], deviceScaleFactor: 1 });
  await context.addInitScript(({ key, state }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state)); }, { key: SAVE_KEY, state });
  const page = await context.newPage(); page.setDefaultTimeout(60000); page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(base); await page.waitForFunction(() => window.willowmere?.metrics().ready, null, { timeout: 90000 });
  await (SCREENS[screen].hasTouch ? page.locator('#begin').tap() : page.locator('#begin').click()); await page.waitForTimeout(500);
  return { page, context };
}
const pen = p => p.evaluate(() => { const r = willowmere.render().pen; return { ...r, time: willowmere.snapshot().time }; });
const inYard = a => a.x > PEN.x0 && a.x < PEN.x1 && a.z > PEN.z0 && a.z < PEN.z1;
function check(sample, label, log) {
  for (const a of sample.animals) if (a.shown) {
    if (!range.isInRange(a.x, a.z)) { log.push(`${label}: ${a.kind} at (${a.x.toFixed(1)}, ${a.z.toFixed(1)}) is outside the range`); continue; }
    const c = cutDistance(cuts, a.x, a.z); if (c.d < -.001 || (['road', 'pond'].includes(c.cat) && c.d < -.1)) log.push(`${label}: ${a.kind} at (${a.x.toFixed(1)}, ${a.z.toFixed(1)}) is ${c.d.toFixed(2)} m inside the ${c.cat} margin`);
  }
}

// ---------------------------------------------------------------- 1. a day at 20x
{
  const { page, context } = await setup(seed({ time: 7, position: { x: 38, z: -3 } }, { test: true, speed: 20 }));
  await page.waitForFunction(() => willowmere.render().pen.range, null, { timeout: 30000 });
  const first = await pen(page); assert.ok(first.range.usable >= 250 && first.range.times >= 1.5, `the range is made in the browser: ${JSON.stringify(first.range)}`); assert.equal(first.draws, 1, 'the flock is one draw'); assert.equal(first.shadowDraws, 1);
  console.log('range in the browser:', JSON.stringify(first.range));
  const violations = [], seenOut = new Set(); let maxOut = 0, openByDay = false, samples = 0, time = 7;
  for (const t0 = Date.now(); Date.now() - t0 < 60000 && time < 22;) {
    const s = await pen(page); time = s.time; samples++; check(s, `t=${s.time.toFixed(2)}`, violations);
    const outside = s.animals.filter(a => a.shown && !inYard(a)); outside.forEach(a => seenOut.add(a.kind)); maxOut = Math.max(maxOut, outside.length); if (outside.length && s.gateOpen) openByDay = true;
    await page.waitForTimeout(200);
  }
  assert.ok(time >= 21.9, `the clock reached ${time.toFixed(2)}`); assert.ok(openByDay && maxOut >= 2, `${maxOut} animals out at once by day, gate open: ${openByDay}`); assert.ok(seenOut.size >= 2, `kinds seen outside: ${[...seenOut]}`);
  // the clock has stopped at 22:00: everyone walks home (a cow is slow) and the gate shuts
  let home = false, last;
  for (const t0 = Date.now(); Date.now() - t0 < 120000;) { last = await pen(page); check(last, 'night', violations); if (last.animals.filter(a => a.shown).every(a => inYard(a) && a.mode === 'in') && !last.gateOpen) { home = true; break; } await page.waitForTimeout(500); }
  assert.ok(home, `everyone home at night with the gate shut: ${JSON.stringify(last.animals.map(a => [a.kind, a.mode, +a.x.toFixed(1), +a.z.toFixed(1)]))} gate ${last.gateOpen}`);
  await page.waitForTimeout(8000); const night = await pen(page); check(night, 'night+8s', violations); assert.ok(night.animals.filter(a => a.shown).every(a => inYard(a)), 'nobody leaves the yard at night');
  console.log(`day: ${samples} samples, ${violations.length} violations, up to ${maxOut} out at once`); assert.deepEqual(violations.slice(0, 5), [], `${violations.length} violations`);
  await page.screenshot({ path: `${out}/desktop-night-22h.png` }); await context.close();
}

// ---------------------------------------------------------------- 2. noon: pictures, and a tap on an animal far from the fence
for (const screen of ['desktop', 'phone']) {
  const { page, context } = await setup(seed({ time: 11.5, position: { x: 17, z: -12 } }), screen);
  await page.waitForFunction(() => willowmere.render().pen.range, null, { timeout: 30000 }); await page.waitForTimeout(6000);
  const s = await pen(page); const outside = s.animals.filter(a => a.shown && !inYard(a)); assert.ok(outside.length >= 2, `${screen}: ${outside.length} animals out at noon`);
  await page.screenshot({ path: `${out}/${screen}-noon.png` });
  // every animal is a tap target that follows it; tap one that is out of the yard
  const pick = async () => { const list = await page.evaluate(() => willowmere.targets().filter(t => t.id.startsWith?.('animal-')).map(t => ({ id: t.id, label: t.label, type: t.type, x: t.position.x, z: t.position.z, sx: t.screen?.x, sy: t.screen?.y }))); return list.filter(t => !(t.x > PEN.x0 - 1 && t.x < PEN.x1 + 1 && t.z > PEN.z0 - 1 && t.z < PEN.z1 + 1)); };
  let targets = await pick(); assert.ok(targets.length >= 2, `${screen}: ${targets.length} animal targets outside the fence`);
  assert.ok(targets.every(t => t.type === 'feed' && /^Feed the /.test(t.label)), 'before feeding: feed');
  const day = (await page.evaluate(() => willowmere.snapshot())).day; let fed = false;
  for (let tries = 0; tries < 8 && !fed; tries++) {
    targets = await pick(); const vw = SCREENS[screen].viewport; const t = targets.find(t => t.sx > 20 && t.sx < vw.width - 20 && t.sy > 120 && t.sy < vw.height - 160); if (!t) { await page.waitForTimeout(1500); continue; }
    if (screen === 'desktop') await page.mouse.click(t.sx, t.sy); else await page.touchscreen.tap(t.sx, t.sy);
    for (let k = 0; k < 24 && !fed; k++) { await page.waitForTimeout(500); fed = await page.evaluate(d => willowmere.snapshot().fedDay === d, day); }
  }
  assert.ok(fed, `${screen}: tapping an animal outside the fence fed the animals`);
  await page.screenshot({ path: `${out}/${screen}-after-feeding.png` });
  // fed: the same animals now give their goods (collect), wherever they are
  await page.waitForTimeout(1500); targets = await pick(); assert.ok(targets.length >= 1 && targets.every(t => t.type === 'collect' && /^Collect from the /.test(t.label)), `after feeding: ${JSON.stringify(targets.map(t => t.label))}`);
  let collected = false; for (let tries = 0; tries < 8 && !collected; tries++) {
    targets = await pick(); const vw = SCREENS[screen].viewport; const t = targets.find(t => t.sx > 20 && t.sx < vw.width - 20 && t.sy > 120 && t.sy < vw.height - 160); if (!t) { await page.waitForTimeout(1500); continue; }
    if (screen === 'desktop') await page.mouse.click(t.sx, t.sy); else await page.touchscreen.tap(t.sx, t.sy);
    for (let k = 0; k < 24 && !collected; k++) { await page.waitForTimeout(500); collected = await page.evaluate(d => willowmere.snapshot().collectedDay === d, day); }
  }
  assert.ok(collected, `${screen}: tapping an animal outside the fence collected the eggs and milk`);
  console.log(`${screen}: ${outside.length} out at noon; fed and collected by tapping an animal outside the fence`);
  await context.close();
}

// ---------------------------------------------------------------- 3. the evening picture
for (const screen of ['desktop', 'phone']) {
  const { page, context } = await setup(seed({ time: 21.5, position: { x: 17, z: -12 } }), screen); await page.waitForFunction(() => willowmere.render().pen.range, null, { timeout: 30000 }); await page.waitForTimeout(3000);
  let s = await pen(page); for (let k = 0; k < 40 && s.gateOpen; k++) { await page.waitForTimeout(500); s = await pen(page); } // shut once nobody stands in the doorway
  assert.ok(s.animals.filter(a => a.shown).every(a => inYard(a)), `${screen}: all in the yard at 21:30`); assert.equal(s.gateOpen, false, 'gate shut at night');
  await page.screenshot({ path: `${out}/${screen}-night.png` }); await context.close();
}
await browser.close();
assert.deepEqual(errors.filter(e => !/favicon/.test(e)), [], 'no console errors or failed requests');
console.log('pen-roam-browser: ok');
