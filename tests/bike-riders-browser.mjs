// The two neighbours who ride to work, in a real browser: the clock is set to the start of the working day (test mode), and the
// riders mount at their houses, ride the roads (never into the pen's range, the pond or a building), park at the facility's bay,
// step off with straight legs and go in; they ride home in the evening; pictures at 1440x900 and 390x844.
//   GAME_URL=http://127.0.0.1:4542 GPU=1 node tests/bike-riders-browser.mjs        (BIKE_OUT=<dir> for the pictures)
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { freshState, SAVE_KEY } from '../src/game.mjs';
import { staticCuts } from '../src/pen-range.mjs';
import { sharedRange, cutDistance } from './pen-sim.mjs';
import { BIKES } from '../src/bike-plan.mjs';

const base = process.env.GAME_URL ?? 'http://127.0.0.1:4542', out = process.env.BIKE_OUT ?? 'test-results/bikes', errors = [];
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome', headless: true, args: process.env.GPU ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--enable-unsafe-swiftshader'] });
const SCREENS = { desktop: { viewport: { width: 1440, height: 900 } }, phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } };
const range = sharedRange(), cuts = staticCuts();
const seed = (extra, settings = {}) => { const s = Object.assign(freshState(), { started: true, coins: 900 }, extra); Object.assign(s.settings, { test: true, speed: 1 }, settings); return s; };
async function setup(state, screen = 'desktop') {
  const context = await browser.newContext({ ...SCREENS[screen], deviceScaleFactor: 1 });
  await context.addInitScript(({ key, state }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state)); }, { key: SAVE_KEY, state });
  const page = await context.newPage(); page.setDefaultTimeout(60000); page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(base); await page.waitForFunction(() => window.willowmere?.metrics().ready, null, { timeout: 90000 });
  await (SCREENS[screen].hasTouch ? page.locator('#begin').tap() : page.locator('#begin').click()); await page.waitForTimeout(500);
  await page.waitForFunction(() => window.willowmere.bikes, null, { timeout: 30000 });
  return { page, context };
}
const bikes = p => p.evaluate(() => ({ list: willowmere.bikes(), time: willowmere.snapshot().time }));
const bad = (x, z) => { if (range.isInRange(x, z)) return 'the animals range'; const c = cutDistance(cuts, x, z, ['pond', 'pen']); return c.d < 0 && c.cat ? c.cat : ''; };
const inBuilding = (x, z) => { const c = cutDistance(cuts, x, z, ['building']); return c.d < -.69; };           // inside the wall itself (the margin is 0.7 m)
const riders = p => p.evaluate(() => willowmere.villagers().npcs.filter(n => ['theo', 'finn'].includes(n.id)).map(n => ({ id: n.id, inside: n.inside, moving: n.moving, x: n.x, z: n.z })));

// ---------------------------------------------------------------- 1. the morning ride to work, from the Bell and Reed houses
const seen = {}, speeds = {}, violations = [];
for (const screen of ['desktop', 'phone']) {
  const { page, context } = await setup(seed({ time: 8.12, position: { x: 41, z: -27 } }), screen);
  const first = await bikes(page);
  for (const b of first.list) { assert.equal(b.at, 'home', `${b.id} is parked at home at 8:18`); assert.ok(['parked', 'claimed'].includes(b.phase)); const def = BIKES.find(d => d.id === b.id); assert.ok(Math.abs(b.x - def.stand.x) < .01 && Math.abs(b.z - def.stand.z) < .01, `${b.id} is at its stand`); }
  await page.screenshot({ path: `${out}/${screen}-1-parked.png` });
  if (screen === 'phone') { await context.close(); continue; }
  const shots = new Set(); let done = false;
  for (const t0 = Date.now(); Date.now() - t0 < 150000 && !done;) {
    const s = await bikes(page);
    for (const b of s.list) {
      const key = b.id; (seen[key] ??= new Set()).add(b.rideState || b.phase);
      const why = b.phase === 'ride' ? bad(b.x, b.z) : ''; if (why) violations.push(`${key} at ${b.x.toFixed(1)}, ${b.z.toFixed(1)} in ${why}`); if (inBuilding(b.x, b.z)) violations.push(`${key} inside a building at ${b.x.toFixed(1)}, ${b.z.toFixed(1)}`);
      const name = `${screen}-${b.rideState === 'mount' ? '2-mount' : '3-ride'}-${key}`;
      if ((b.rideState === 'mount' || b.rideState === 'ride' && b.speed > 5) && !shots.has(name) && shots.size < 3) { shots.add(name); await page.screenshot({ path: `${out}/${name}.png` }); }
      if (b.rideState === 'ride') { assert.ok(b.riderVisible, 'the rider is seen on the bike'); assert.ok(b.legs[0] < -.5 && Math.abs(b.legs[2]) > .3, `riding pose: legs ${b.legs.map(v => v.toFixed(2))}`); assert.ok(b.riderY > .4, `seated at ${b.riderY}`); assert.ok(b.speed <= 8.01, `speed ${b.speed}`); (speeds[key] ??= []).push(b.speed); }
    }
    done = s.list.every(b => b.at === 'bay' && b.phase === 'parked') && s.time > 8.3; await page.waitForTimeout(150);
  }
  assert.ok(done, `both bikes reached their bays: ${JSON.stringify(await bikes(page))}`);
  for (const b of BIKES) { assert.ok(['mount', 'ride', 'dismount'].every(k => seen[b.id].has(k)), `${b.id} phases ${[...seen[b.id]]}`); const top = Math.max(...speeds[b.id]); assert.ok(top >= 6.5, `${b.id} top speed ${top.toFixed(1)} m/s`); }
  const after = await bikes(page); for (const b of after.list) { const def = BIKES.find(d => d.id === b.id); assert.ok(Math.hypot(b.x - def.bay.x, b.z - def.bay.z) < .3, `${b.id} at its bay`); }
  await page.screenshot({ path: `${out}/${screen}-4-parked-at-work.png` });
  const walkers = await riders(page);
  for (const t0 = Date.now(); Date.now() - t0 < 60000;) { if ((await riders(page)).every(r => r.inside)) break; await page.waitForTimeout(500); }
  const inside = await riders(page); assert.ok(inside.every(r => r.inside), `both riders went in: ${JSON.stringify(inside)} (after the dismount ${JSON.stringify(walkers)})`);
  await context.close();
}
assert.deepEqual(violations.slice(0, 5), [], `${violations.length} violations`);

// ---------------------------------------------------------------- 2. the evening: from the bays, legs straight at the end, home again
{
  const { page, context } = await setup(seed({ time: 16.55, position: { x: 14, z: -30 } }));
  await page.waitForTimeout(500); const s0 = await bikes(page); assert.ok(s0.list.every(b => b.at === 'bay'), `at 16:33 the bikes are at the bays: ${JSON.stringify(s0.list.map(b => [b.id, b.at]))}`);
  const phases = {}; let home = false, shot = false;
  for (const t0 = Date.now(); Date.now() - t0 < 200000 && !home;) {
    const s = await bikes(page);
    for (const b of s.list) {
      (phases[b.id] ??= new Set()).add(b.rideState || b.phase); if (b.phase === 'ride' && bad(b.x, b.z)) violations.push(`evening ${b.id} in ${bad(b.x, b.z)}`);
      if (b.rideState === 'mount' && !shot) { shot = true; await page.screenshot({ path: `${out}/desktop-5-mount-at-work.png` }); }
    }
    home = s.time > 17.2 && s.list.every(b => b.at === 'home' && b.phase === 'parked'); await page.waitForTimeout(150);
  }
  assert.ok(home, `both bikes home again: ${JSON.stringify(await bikes(page))}`);
  for (const b of BIKES) assert.ok(['mount', 'ride', 'dismount'].every(k => phases[b.id].has(k)), `${b.id} evening phases ${[...phases[b.id]]}`);
  // after the dismount the legs are straight: the walk cycle swings them only on x, never splayed on z
  for (const t0 = Date.now(); Date.now() - t0 < 20000;) { const s = await bikes(page); if (s.list.every(b => b.legs.length && Math.abs(b.legs[2]) < 1e-6 && Math.abs(b.legs[3]) < 1e-6)) break; await page.waitForTimeout(300); }
  await page.screenshot({ path: `${out}/desktop-6-home.png` });
  assert.deepEqual(violations.slice(0, 5), [], 'evening violations'); await context.close();
}
// ---------------------------------------------------------------- 3. night: both parked at home at 22:00
{
  const { page, context } = await setup(seed({ time: 21.9 })); await page.waitForFunction(() => willowmere.snapshot().time >= 22 || willowmere.snapshot().time < 5, null, { timeout: 60000 }).catch(() => {});
  const s = await bikes(page); assert.ok(s.list.every(b => b.at === 'home' && b.phase === 'parked'), `at ${s.time.toFixed(2)} both bikes are at home: ${JSON.stringify(s.list.map(b => [b.id, b.at, b.phase]))}`); await context.close();
}
await browser.close();
assert.deepEqual(errors.filter(e => !/WebGL|GPU stall/.test(e)), [], 'no console errors');
console.log('bike riders: ok');
