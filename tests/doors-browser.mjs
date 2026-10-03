// The west houses in a real browser: main doors on the east side (the side the camera shows) on the West Lane, back doors
// on the west road, both of them real ways in and out, and the ward just outside the ring road while the Pandora box is open.
//   GAME_URL=http://127.0.0.1:<port> node tests/doors-browser.mjs      (GPU=1 for a real GPU)
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { freshState, SAVE_KEY } from '../src/game.mjs';
import { HOUSES, ROADS, GATE, WEST_LANE, WORKSHOP } from '../src/content.mjs';
import { inVillage } from '../src/field-layout.mjs';
import { SAFE, inSafeZone, wildDepth } from '../src/wilds.mjs';
import { BACK_HOMES, lotOf } from '../src/lots.mjs';

const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome', headless: true, args: process.env.GPU ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const base = process.env.GAME_URL ?? 'http://127.0.0.1:4173', errors = [], results = []; await mkdir('test-results', { recursive: true });
const SCREENS = { phone: [390, 844], landscape: [844, 390], desktop: [1440, 900] };
const seed = (extra = {}) => Object.assign(freshState(), { started: true, coins: 5000, time: 10, ...extra });
async function setup(state, screen = 'desktop') {
  const [width, height] = SCREENS[screen], mobile = screen !== 'desktop';
  const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  await context.addInitScript(({ key, state }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state)); }, { key: SAVE_KEY, state });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(base); await page.waitForFunction(() => window.willowmere?.metrics().ready, null, { timeout: 90000 }); await page.locator('#begin').click(); await page.waitForTimeout(500);
  const tap = (x, y) => mobile ? page.touchscreen.tap(x, y) : page.mouse.click(x, y);
  return { page, context, width, height, tap, mobile };
}
const metrics = p => p.evaluate(() => willowmere.metrics());
const prompt = p => p.evaluate(() => document.querySelector('#interact span').textContent);
const far = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const indoors = p => p.waitForFunction(() => willowmere.metrics().location === 'interior', null, { timeout: 20000 });
const outdoors = p => p.waitForFunction(() => willowmere.metrics().location === 'village', null, { timeout: 20000 });
/** Leave the house by its door: tap the way out. */
async function leave({ page: p, tap }) { await p.waitForTimeout(500); const door = await p.evaluate(() => willowmere.targets().find(t => t.type === 'exit')); await tap(door.screen.x, door.screen.y); await outdoors(p); await p.waitForTimeout(300); }

try {
  // ---------------------------------------------------------------- 1. two doors a house, both real
  for (const h of BACK_HOMES) {
    const lot = lotOf(h);
    const targets = await (async () => { const s = await setup(seed({ position: { x: lot.door.x, z: lot.door.z } })); const t = await s.page.evaluate(() => willowmere.targets()); const m = await metrics(s.page);
      // The main door: its spot is east of the house (screen right of it: the side the camera shows), and E goes in.
      const doors = t.filter(t => t.type === 'house' && t.id === h.id); assert.equal(doors.length, 2, `${h.family}: a main door and a back door`);
      assert.equal(doors[0].label, `Enter ${h.name}`); assert.equal(doors[1].label, `Enter ${h.name} · back door`);
      assert.ok(far(doors[0].position, lot.door) < .01 && far(doors[1].position, lot.back) < .01); assert.ok(doors[0].position.x > h.x + 4 && doors[1].position.x < h.x - 4, `${h.family}: main door east, back door west`);
      assert.ok(doors[0].screen.x > doors[1].screen.x + 100, 'the main door is on the camera’s side');
      assert.ok(far(m.position, lot.door) < .5, `${h.family}: you can stand at the main door`); assert.equal(await prompt(s.page), `Enter ${h.name}`);
      await s.page.screenshot({ path: `test-results/doors-main-${h.family.toLowerCase()}.png` });
      await s.page.keyboard.press('e'); await indoors(s.page); assert.equal((await s.page.evaluate(() => willowmere.map())).caption, h.name.toUpperCase());
      await leave(s); const out = (await metrics(s.page)).position; assert.ok(far(out, lot.door) < .6, `${h.family}: you come out at the main door (${out.x.toFixed(1)}, ${out.z.toFixed(1)})`); assert.equal(await prompt(s.page), `Enter ${h.name}`);
      await s.context.close(); return t; })();
    {
      // The back door, from the west road: its own prompt, in, and out again on the road side.
      const s = await setup(seed({ position: { x: lot.back.x, z: lot.back.z } })); const m = await metrics(s.page);
      assert.ok(far(m.position, lot.back) < .5, `${h.family}: you can stand at the back door`); assert.equal(await prompt(s.page), `Enter ${h.name} · back door`);
      await s.page.screenshot({ path: `test-results/doors-back-${h.family.toLowerCase()}.png` });
      await s.page.keyboard.press('e'); await indoors(s.page); assert.equal((await s.page.evaluate(() => willowmere.map())).caption, h.name.toUpperCase());
      await leave(s); const out = (await metrics(s.page)).position; assert.ok(far(out, lot.back) < .6 && out.x < h.x - 3.5, `${h.family}: you come out at the back door (${out.x.toFixed(1)}, ${out.z.toFixed(1)})`);
      await s.context.close();
    }
    // Nothing else you use hides the doors: no other target's spot within 1.2 m of either.
    for (const t of targets) if (!(t.type === 'house' && t.id === h.id) && t.type !== 'person') for (const d of [lot.door, lot.back]) assert.ok(far(t.position, d) > 1.2, `${t.type} ${t.id} sits on a door of ${h.family}`);
    results.push({ name: `${h.family}: main door (east) and back door (west road) both go in, and you come out where you went in` });
  }
  // ---------------------------------------------------------------- 2. the usual way: from the village centre, by the lanes
  for (const screen of ['desktop', 'phone', 'landscape']) {
    const h = HOUSES[screen === 'desktop' ? 5 : screen === 'phone' ? 1 : 7], lot = lotOf(h);
    const s = await setup(seed({ position: { x: WEST_LANE.x, z: lot.door.z + .2 } }), screen), p = s.page;
    const door = (await p.evaluate(() => willowmere.targets())).find(t => t.type === 'house' && t.id === h.id);
    assert.ok(door.screen.x > 8 && door.screen.x < s.width - 8 && door.screen.y > 60 && door.screen.y < s.height - 60, `${screen}: the main door is on the screen from the lane`);
    await s.tap(door.screen.x, door.screen.y); await indoors(p); await p.screenshot({ path: `test-results/doors-inside-${screen}.png` });
    await leave(s); assert.ok(far((await metrics(p)).position, lot.door) < 2.2, `${screen}: back out by the main door`);
    await s.context.close();
  }
  results.push({ name: 'a tap on a west house from the West Lane walks to its main door and goes in (desktop, phone, landscape)' });
  {
    // The Vale workshop's counter moved with the barn: beside the barn doors, on the lane side.
    const s = await setup(seed({ position: { x: WORKSHOP.x, z: WORKSHOP.z } })); assert.equal(await prompt(s.page), 'Visit the Vale workshop'); assert.ok(far((await metrics(s.page)).position, WORKSHOP) < .5);
    await s.page.screenshot({ path: 'test-results/doors-workshop.png' }); await s.context.close(); results.push({ name: 'the Vale workshop is at the barn doors' });
  }
  // ---------------------------------------------------------------- 3. the ward just outside the ring road
  {
    const outer = { west: ROADS.west - 2.5, east: ROADS.east + 2.5, south: ROADS.south + 2.5, north: ROADS.north - 2.5 }, onRing = c => c.x > outer.west && c.x < outer.east && c.z > outer.north && c.z < outer.south;
    for (const [side, at] of [['west', { x: ROADS.west - 1.5, z: 6 }], ['south', { x: -8, z: ROADS.south + 1.5 }], ['east', { x: ROADS.east + 1.5, z: 6 }]]) {
      const { page: p, context } = await setup(seed({ pandora: true, position: at }));
      await p.waitForFunction(() => typeof willowmere.wilds === 'function' && willowmere.wilds().ready && willowmere.wilds().count > 0, null, { timeout: 30000 });
      let w = await p.evaluate(() => willowmere.wilds()); assert.equal(w.ward, true); assert.equal(w.fighting, false, `${side}: no fighting on the road`); assert.equal((await p.evaluate(() => willowmere.map())).caption, 'WILLOWMERE');
      const road = c => side === 'west' ? outer.west - c.x : side === 'east' ? c.x - outer.east : c.z - outer.south;
      const near = w.creatures.map(c => ({ ...c, d: road(c) })).filter(c => c.d > 0).sort((a, b) => a.d - b.d);
      assert.ok(near.length && near[0].d < 30, `${side}: the nearest creature is ${near[0]?.d.toFixed(1)} m beyond the road`);
      for (let i = 0; i < 5; i++) { w = await p.evaluate(() => willowmere.wilds()); for (const c of w.creatures) { assert.ok(!inSafeZone(c.x, c.z), `${side}: ${c.type} at ${c.x.toFixed(1)}, ${c.z.toFixed(1)} is inside the ward`); assert.ok(!onRing(c), `${side}: ${c.type} is on the road`); } await p.waitForTimeout(600); }
      // Everything you can use is inside the ward.
      for (const t of await p.evaluate(() => willowmere.targets())) assert.ok(inSafeZone(t.position.x, t.position.z, -1) && inVillage(t.position.x, t.position.z), `${t.type} ${t.id} at ${t.position.x.toFixed(1)}, ${t.position.z.toFixed(1)} is inside the ward`);
      await p.screenshot({ path: `test-results/doors-ward-${side}.png` }); await context.close();
    }
    results.push({ name: 'box open: the ward is 2 m beyond the road on the west, south and east; no creature inside it or on the road; every target inside it' });
    // Three steps beyond the west road you are in the near meadows; on the road you are in the village.
    const { page: p, context } = await setup(seed({ pandora: true, position: { x: ROADS.west, z: 8 } }));
    await p.keyboard.down('a'); await p.waitForFunction(x => willowmere.metrics().position.x < x, SAFE.x0 - 3, { timeout: 30000 }); await p.keyboard.up('a'); await p.waitForTimeout(400);
    const m = await metrics(p); assert.ok(wildDepth(m.position.x, m.position.z) > 0); assert.equal((await p.evaluate(() => willowmere.map())).caption, 'NEAR MEADOWS'); assert.equal((await p.evaluate(() => willowmere.wilds())).fighting, true);
    await context.close(); results.push({ name: 'the near meadows begin right beyond the west road' });
  }
  {
    // The east gate is on the ring's side of the ward: the trip to the country market and back, safely.
    const { page: p, context } = await setup(seed({ pandora: true, position: { x: GATE.x - 1.5, z: 0 } })); assert.equal(await prompt(p), 'Follow the country road'); assert.equal((await metrics(p)).homeGuide.visible, false);
    await p.keyboard.press('e'); await p.waitForFunction(() => willowmere.metrics().location === 'country', null, { timeout: 20000 }); await p.waitForTimeout(400);
    const back = (await p.evaluate(() => willowmere.targets())).find(t => t.type === 'return'); await p.mouse.click(back.screen.x, back.screen.y); await outdoors(p); await p.waitForTimeout(400);
    const at = (await metrics(p)).position; assert.ok(inSafeZone(at.x, at.z, -1) && inVillage(at.x, at.z) && Math.abs(at.x - (GATE.x - 1.5)) < .6, `back at the gate (${at.x.toFixed(1)}, ${at.z.toFixed(1)})`);
    await context.close(); results.push({ name: 'the east gate: out to the country market and back, inside the ward' });
  }
  assert.deepEqual(errors, [], 'no page errors'); console.log(JSON.stringify({ pass: true, results }, null, 1));
} catch (error) { console.error(error); console.error(JSON.stringify({ errors, results }, null, 1)); process.exitCode = 1; } finally { await browser.close(); }
