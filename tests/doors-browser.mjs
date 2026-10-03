// The west houses in a real browser: main doors on the east side (the side the camera shows) on the West Lane, back doors
// on the west road, both of them real ways in and out, and the ward just outside the ring road while the Pandora box is open.
//   GAME_URL=http://127.0.0.1:<port> node tests/doors-browser.mjs      (GPU=1 for a real GPU)
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { freshState, SAVE_KEY } from '../src/game.mjs';
import { HOUSES, ROADS, GATE, WEST_LANE, FIELD_LANE, WORKSHOP, BED_POSITIONS } from '../src/content.mjs';
import { inVillage, CAMERA_YAW, CAMERA_RISE } from '../src/field-layout.mjs';
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
/**
 * Where the ground point g is on the screen, measured from where the player is drawn (metrics().screen: the player's
 * position one metre up), so it holds while the camera is still catching up. The village camera is orthographic, turned
 * CAMERA_YAW and looking down at CAMERA_RISE (world.mjs resize() and update()); `zoom` is the default.
 */
function onScreen(m, g, { width, height }, zoom = 15) {
  const sy = Math.sin(CAMERA_YAW), cy = Math.cos(CAMERA_YAW), n = Math.hypot(1, CAMERA_RISE), dx = g.x - m.position.x, dz = g.z - m.position.z, aspect = width / height, scale = zoom * (aspect < .8 ? 1.35 : 1);
  return { x: m.screen.x + (dx * cy - dz * sy) / (scale * aspect) * width / 2, y: m.screen.y + (1 + CAMERA_RISE * (sy * dx + cy * dz)) / n / scale * height / 2 };
}
/** Tap the ground at g and say what the game took it for: 'walk', or the target's type and id. */
async function tapGround(s, g) {
  const px = onScreen(await metrics(s.page), g, s); assert.ok(px.x > 4 && px.x < s.width - 4 && px.y > 70 && px.y < s.height - 110, `the ground at ${g.x}, ${g.z} is on the screen`);
  await s.tap(px.x, px.y); await s.page.waitForTimeout(120); const nav = (await metrics(s.page)).navigation;
  return nav.pending ? `${nav.pending}:${nav.pendingId}` : nav.remaining > 0 ? 'walk' : 'nothing';
}
/** Walk (by the tapped route) until you stop; returns where. */
async function settle(p) { let last = null; for (let i = 0; i < 80; i++) { await p.waitForTimeout(250); const m = await metrics(p); if (last && far(last, m.position) < .01 && !m.navigation.remaining) return m.position; last = m.position; } return last; }
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
      await s.page.keyboard.press('e'); await indoors(s.page); await s.page.waitForFunction(name => willowmere.map().caption === name, h.name.toUpperCase(), { timeout: 10000 });
      await leave(s); const out = (await metrics(s.page)).position; assert.ok(far(out, lot.door) < .6, `${h.family}: you come out at the main door (${out.x.toFixed(1)}, ${out.z.toFixed(1)})`); assert.equal(await prompt(s.page), `Enter ${h.name}`);
      await s.context.close(); return t; })();
    {
      // The back door, from the west road: its own prompt, in, and out again on the road side.
      const s = await setup(seed({ position: { x: lot.back.x, z: lot.back.z } })); const m = await metrics(s.page);
      assert.ok(far(m.position, lot.back) < .5, `${h.family}: you can stand at the back door`); assert.equal(await prompt(s.page), `Enter ${h.name} · back door`);
      await s.page.screenshot({ path: `test-results/doors-back-${h.family.toLowerCase()}.png` });
      await s.page.keyboard.press('e'); await indoors(s.page); await s.page.waitForFunction(name => willowmere.map().caption === name, h.name.toUpperCase(), { timeout: 10000 });
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
    // The east gate is a plain road gate on the ring's side of the ward (the country market's trade is at the supermarket):
    // nothing travels. At the gate, with the box open, nothing is offered, E goes nowhere and you stay in the village.
    const { page: p, context } = await setup(seed({ pandora: true, position: { x: GATE.x - .6, z: 0 } })); assert.doesNotMatch(await prompt(p), /country|Follow/i); assert.equal((await metrics(p)).homeGuide.visible, false);
    assert.equal((await p.evaluate(() => willowmere.targets())).some(t => t.type === 'travel' || t.type === 'return'), false, 'no travel target, no way back from anywhere');
    await p.keyboard.press('e'); await p.waitForTimeout(600); const here = await metrics(p); assert.equal(here.location, 'village'); assert.ok(far(here.position, { x: GATE.x - .6, z: 0 }) < .3, 'E at the gate goes nowhere');
    await context.close();
    // A save left out on the spur, where the trip used to begin, wakes on the ring road beside the gate, inside the ward.
    const old = await setup(seed({ pandora: true, position: { x: 63, z: 0 } })), at = (await metrics(old.page)).position;
    assert.ok(inSafeZone(at.x, at.z, -1) && inVillage(at.x, at.z) && far(at, GATE.back) < .6, `woke at the gate (${at.x.toFixed(1)}, ${at.z.toFixed(1)})`); assert.equal((await metrics(old.page)).location, 'village');
    await old.context.close(); results.push({ name: 'the east gate: nothing travels, E stays in the village, a save left out on the spur wakes on the ring road inside the ward' });
  }
  // ---------------------------------------------------------------- 4. taps on the ways walk; the ways are in view
  for (const screen of ['desktop', 'phone']) {
    {
      // The Field Lane runs behind the first bed row: a tap on its gravel walks along it (it used to pick the bed in front).
      const s = await setup(seed({ position: { x: -6, z: FIELD_LANE.z } }), screen);
      for (const x of screen === 'phone' ? [-10, -12] : [-10, -12, -16, -18, -20, -22, -24]) for (const dz of [0, -.5]) assert.equal(await tapGround(s, { x, z: FIELD_LANE.z + dz }), 'walk', `${screen}: a tap on the Field Lane at x ${x} walks`);
      const goal = { x: screen === 'phone' ? -12 : -18, z: FIELD_LANE.z }; assert.equal(await tapGround(s, goal), 'walk'); const end = await settle(s.page);
      assert.ok(far(end, goal) < .6, `${screen}: the walk ends on the lane (${end.x.toFixed(1)}, ${end.z.toFixed(1)})`); assert.equal(await s.page.locator('#modal-title:visible').count(), 0, 'no panel opened');
      // A bed is still one tap away: tap its soil.
      const bed = BED_POSITIONS[screen === 'phone' ? 4 : 2]; assert.equal(await tapGround(s, { x: bed.x, z: bed.z + .2 }), `bed:${BED_POSITIONS.indexOf(bed)}`, `${screen}: a tap on a bed still tends it`);
      await s.context.close();
    }
    for (const h of BACK_HOMES) for (const time of [10, 17.4]) {
      // The front path, at an hour when the family is out in the yard: taps on it walk, and by the door the door answers.
      const lot = lotOf(h), s = await setup(seed({ time, position: { x: WEST_LANE.x, z: lot.door.z } }), screen);
      for (const x of [-33, -34]) assert.equal(await tapGround(s, { x, z: lot.door.z }), 'walk', `${screen} ${h.family} ${time}: a tap on the front path at x ${x} walks`);
      for (const x of [-33.5, -32.6]) for (const dz of [-.9, .9]) assert.equal(await tapGround(s, { x, z: lot.door.z + dz }), 'walk');
      assert.equal(await tapGround(s, lot.door), `house:${h.id}`, `${screen} ${h.family}: a tap at the door goes in`);
      await s.context.close();
    }
    {
      // The east road past the gate: taps on both lanes walk, and so does a tap on the gate itself (nothing travels).
      const s = await setup(seed({ position: { x: ROADS.east, z: -8 } }), screen);
      for (const g of [{ x: 53.5, z: -3 }, { x: 54, z: -2 }, { x: 52, z: -3 }, { x: 53.6, z: -1.2 }]) assert.equal(await tapGround(s, g), 'walk', `${screen}: a tap on the east road at ${g.x}, ${g.z} walks`);
      assert.equal(await tapGround(s, GATE), 'walk', `${screen}: a tap on the gate walks there`); assert.equal((await metrics(s.page)).location, 'village'); await s.context.close();
    }
  }
  results.push({ name: 'taps on the Field Lane, the front paths and the east road walk there (desktop, phone); a bed and a door still answer their own taps, a tap on the gate walks' });
  {
    // Standing where a tap on a door leaves you (and where you come out), at any hour, the prompt is the door's.
    for (const h of BACK_HOMES) for (const time of [10, 13, 17.4, 21]) for (const [dx, dz] of [[1.6, 0], [1.1, -1.2], [1.1, 1.2], [0, -1.5]]) {
      const lot = lotOf(h), s = await setup(seed({ time, position: { x: lot.door.x + dx, z: lot.door.z + dz } }));
      assert.equal(await prompt(s.page), `Enter ${h.name}`, `${h.family} at ${time}: the prompt ${dx}, ${dz} from the door`); await s.context.close();
    }
    // On the ring road by the gate, and at the gate, no trip is offered.
    for (const at of [{ x: 52.7, z: 0 }, { x: 53.5, z: 0 }, { x: 54, z: 2 }, { x: 53.5, z: 1.8 }, GATE.back, { x: GATE.x, z: GATE.z }]) { const s = await setup(seed({ position: at })); assert.doesNotMatch(await prompt(s.page), /country|Follow/i, `on the road at ${at.x}, ${at.z}`); await s.context.close(); }
    results.push({ name: 'by a main door the prompt is always the door’s (no villager nearer); on the ring road and at the gate no trip is offered' });
  }
  {
    // On the West Lane you can see yourself: at each junction and between them the player's figure is drawn in full (no crown, no wind pump over it).
    for (const z of [...BACK_HOMES.map(h => lotOf(h).door.z), -24, 0, 6.5, 13, 28.5]) {
      const a = await setup(seed({ position: { x: WEST_LANE.x, z } })), m = await metrics(a.page), clip = { x: Math.round(m.screen.x - 40), y: Math.round(m.screen.y - 62), width: 80, height: 96 };
      const shot = await a.page.screenshot({ clip, path: `test-results/doors-lane-z${z}.png` });
      // Count the pixels of your hair and of your shirt in the patch round you (a whole figure: about 316 and 269).
      const seen = await a.page.evaluate(async ({ clip, png }) => {
        const img = await new Promise(done => { const i = new Image(); i.onload = () => done(i); i.src = 'data:image/png;base64,' + png; }), c = document.createElement('canvas'); c.width = clip.width; c.height = clip.height;
        const g = c.getContext('2d'); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, clip.width, clip.height).data; let hair = 0, shirt = 0;
        for (let i = 0; i < d.length; i += 4) { const r = d[i], gr = d[i + 1], b = d[i + 2]; if (r > 95 && r < 175 && gr > 45 && gr < 105 && b < 75 && r > gr * 1.45) hair++; if (Math.abs(r - gr) < 40 && gr > 100 && gr < 175 && b < 150 && r < 170 && gr - b > 5 && gr - b < 60 && r < gr + 5) shirt++; }
        return { hair, shirt };
      }, { clip, png: shot.toString('base64') });
      assert.ok(seen.hair >= 250 && seen.shirt >= 215, `on the West Lane at z ${z} you are in view (hair ${seen.hair} of 316 px, shirt ${seen.shirt} of 269 px)`); await a.context.close();
    }
    results.push({ name: 'on the West Lane, at every junction and between them, nothing stands between the camera and you' });
  }
  assert.deepEqual(errors, [], 'no page errors'); console.log(JSON.stringify({ pass: true, results }, null, 1));
} catch (error) { console.error(error); console.error(JSON.stringify({ errors, results }, null, 1)); process.exitCode = 1; } finally { await browser.close(); }
