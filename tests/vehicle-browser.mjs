// Round 8 in a real browser (builder C): the car is never lost. A reload while driving puts you back in it, where it was, facing
// the way it faced; a car parked far out is where you left it; a knock-out tows it home; and a 230 m drive at top speed streams
// the fields one tile a frame without the car ever ending a frame inside a trunk.
//
//   GAME_URL=http://127.0.0.1:<port> GPU=1 node tests/vehicle-browser.mjs
import assert from 'node:assert/strict';
import { launch, open, begin, metrics, snapshot, shot, holdStick, save } from './travel-kit.mjs';
import { VEHICLES } from '../src/drive.mjs';
import { inWorld, regionAt } from '../src/regions.mjs';
import { inSafeZone } from '../src/ward.mjs';
import { fieldTrees, FIELD_TILE } from '../src/field-layout.mjs';

const browser = await launch(), results = [], errors = [];
const turn = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const drive = page => page.evaluate(() => willowmere.render().drive);
const stopped = page => page.waitForFunction(() => { const r = willowmere.render().drive.riding; return r && r.speed < .05; }, null, { timeout: 30000 });
const PARKED = { jeep: { x: 46, z: -15 }, bike: { x: 5, z: -8 } };

try {
  // ---------------------------------------------------------------- 1. a reload while driving, far out
  {
    // The jeep stands far out in the Redrock Canyon where it was left; you are beside it. Board it and drive east into the Night Land.
    const { page: p, errors: e } = await open(browser, 'desktop', s => { s.stats.sales = 250; s.position = { x: 202.5, z: 20 }; s.vehicles.jeep = { x: 200, z: 20, rot: 0 }; }); errors.push(e);
    await p.waitForTimeout(600);
    const before = await p.evaluate(() => ({ car: willowmere.render().vehicles.find(v => v.id === 'jeep'), prompt: document.querySelector('#interact span').textContent }));
    assert.ok(Math.hypot(before.car.x - 200, before.car.z - 20) < .01, 'the jeep is where the save left it, not at its park spot'); assert.match(before.prompt, /jeep/i, 'and can be boarded there');
    await p.keyboard.press('e'); await p.waitForFunction(() => willowmere.metrics().riding === 'jeep', null, { timeout: 8000 });
    assert.equal((await snapshot(p)).riding, 'jeep', 'boarding is in the save');
    await p.keyboard.down('d'); await p.waitForFunction(() => willowmere.metrics().position.x >= 250, null, { timeout: 30000 });
    // (a) still rolling: reload with the key down.
    await p.reload(); await p.keyboard.up('d'); await begin(p, 'desktop');
    let m = await metrics(p), d = await drive(p);
    assert.equal(m.riding, 'jeep', 'still in the jeep after a reload while it was moving'); assert.ok(m.position.x >= 250 && inWorld(m.position.x, m.position.z, 2), `in the world at (${m.position.x.toFixed(1)}, ${m.position.z.toFixed(1)})`);
    assert.ok(Math.hypot(d.riding.x - m.position.x, d.riding.z - m.position.z) < 1, 'the car is under you'); { const saved = await snapshot(p); assert.ok(Math.hypot(saved.position.x - d.riding.x, saved.position.z - d.riding.z) < .01, 'the saved place is that of the car, not of the seat: no drift from reload to reload'); } assert.ok(Math.abs(turn(d.riding.heading, m.heading)) < 1e-6);
    assert.ok(Math.abs(turn(m.heading, Math.PI / 2 + .38)) < .1, `facing the way it drove (${m.heading.toFixed(3)} rad)`); assert.equal(d.riding.speed, 0, 'at a standstill: a reload is not a crash');
    // (b) stopped at a known place: within 1 m and 0.1 rad.
    await p.keyboard.down('a'); await p.waitForTimeout(700); await p.keyboard.up('a'); await stopped(p); await p.waitForTimeout(200);
    const at = await metrics(p); await shot(p, 'vehicle-reload-before-1440x900');
    await p.reload(); await begin(p, 'desktop'); await p.waitForTimeout(400); m = await metrics(p); d = await drive(p);
    assert.equal(m.riding, 'jeep'); assert.ok(Math.hypot(m.position.x - at.position.x, m.position.z - at.position.z) < 1, `within a metre (${Math.hypot(m.position.x - at.position.x, m.position.z - at.position.z).toFixed(3)} m)`);
    assert.ok(Math.abs(turn(m.heading, at.heading)) < .1, `same heading (${Math.abs(turn(m.heading, at.heading)).toFixed(4)} rad off)`);
    const seat = await p.evaluate(() => willowmere.render().player); assert.ok(seat.y > .2 && seat.legs[0] < -.5, 'seated');
    assert.match(await p.locator('#location-text').textContent(), /jeep/i); await shot(p, 'vehicle-reload-after-1440x900');
    results.push({ name: 'reload while driving: still in the jeep, same place, same heading', at: [+at.position.x.toFixed(2), +at.position.z.toFixed(2)], after: [+m.position.x.toFixed(2), +m.position.z.toFixed(2)], heading: +m.heading.toFixed(3), region: regionAt(m.position.x, m.position.z) });
    // ---------------------------------------------------------------- 2. parked far out, then a reload
    await p.keyboard.press('e'); await p.waitForFunction(() => willowmere.metrics().riding === '', null, { timeout: 8000 });
    let s = await snapshot(p); const car = s.vehicles.jeep;
    assert.equal(s.riding, ''); assert.ok(car && Math.hypot(car.x - d.riding.x, car.z - d.riding.z) < .01, 'stepping out saves where the jeep stands');
    assert.deepEqual(JSON.parse(await p.evaluate(key => localStorage.getItem(key), 'willowmere.save.v1')).vehicles.jeep, car, 'and writes it to storage at once');
    await p.reload(); await begin(p, 'desktop'); await p.waitForTimeout(400); m = await metrics(p);
    const parked = (await p.evaluate(() => willowmere.render().vehicles)).find(v => v.id === 'jeep');
    assert.equal(m.riding, ''); assert.ok(Math.hypot(parked.x - car.x, parked.z - car.z) < .01 && Math.abs(turn(parked.yaw, car.rot)) < 1e-6, 'the jeep is where you parked it');
    assert.ok(Math.hypot(m.position.x - parked.x, m.position.z - parked.z) < 3, `you stand ${Math.hypot(m.position.x - parked.x, m.position.z - parked.z).toFixed(2)} m from it`);
    assert.match(await p.locator('#interact span').textContent(), /jeep/i, 'the board prompt is offered'); await shot(p, 'vehicle-parked-far-1440x900');
    await p.keyboard.press('e'); await p.waitForFunction(() => willowmere.metrics().riding === 'jeep', null, { timeout: 8000 });
    // The motorcycle, never touched, is still at its park spot with nothing saved for it.
    const bike = (await p.evaluate(() => willowmere.render().vehicles)).find(v => v.id === 'bike'); assert.ok(Math.hypot(bike.x - PARKED.bike.x, bike.z - PARKED.bike.z) < .01); assert.equal((await snapshot(p)).vehicles.bike, null);
    results.push({ name: 'parked far out, reload: the jeep is where it was left and can be boarded', car, region: regionAt(car.x, car.z) });
    await p.context().close();
  }
  // ---------------------------------------------------------------- 3. a knock-out tows every car left outside the ward
  {
    // The stand of pandora-browser's knock-out: six metres from a seeded cactus of the canyon. Both vehicles are parked beside you, out there.
    const { page: p, errors: e } = await open(browser, 'desktop', s => { s.pandora = true; s.position = { x: 92.5, z: -9 }; s.hp = 6; s.coins = 400; s.bike = true; s.stats.sales = 250; s.vehicles = { jeep: { x: 97, z: -5, rot: 1 }, bike: { x: 96, z: -13, rot: 2 } }; }); errors.push(e);
    const far = await p.evaluate(() => willowmere.render().vehicles); assert.ok(far.every(v => v.x > 90), 'both stand out in the canyon');
    await p.waitForFunction(() => willowmere.metrics().location === 'interior', null, { timeout: 120000 });
    const s = await snapshot(p), cars = await p.evaluate(() => willowmere.render().vehicles);
    assert.deepEqual(s.vehicles, { jeep: null, bike: null }, 'both are back at their park spots in the save'); assert.equal(s.riding, '');
    for (const v of cars) assert.ok(Math.hypot(v.x - PARKED[v.id].x, v.z - PARKED[v.id].z) < .01, `the ${v.id} is waiting at its park spot`);
    assert.ok(inSafeZone(s.position.x, s.position.z)); results.push({ name: 'knock-out: both vehicles towed to their park spots', coins: s.coins });
    await p.context().close();
  }
  // ---------------------------------------------------------------- 4. a jeep left inside the village is where it was left, too
  {
    const { page: p, errors: e } = await open(browser, 'desktop', s => { s.stats.sales = 250; s.position = { x: 19, z: 36 }; s.vehicles.jeep = { x: 17, z: 37, rot: 1.57 }; }); errors.push(e);
    await p.waitForTimeout(400); const car = (await p.evaluate(() => willowmere.render().vehicles)).find(v => v.id === 'jeep');
    assert.ok(Math.hypot(car.x - 17, car.z - 37) < .01, 'a jeep left on the south road is still there'); assert.match(await p.locator('#interact span').textContent(), /jeep/i);
    results.push({ name: 'a jeep left inside the village is where it was left' }); await p.context().close();
  }
  // ---------------------------------------------------------------- 5. 230 m at top speed: from the Frost Peaks down into the swamp
  {
    // The start: on the line x = 0 if no trunk stands there, else the nearest clear spot beside it (the field plan is seeded, and builder A's and B's change it).
    const room = x => { let d = Infinity; for (let i = -1; i <= 0; i++) for (let k = -6; k <= -4; k++) for (const t of fieldTrees(i, k)) d = Math.min(d, Math.hypot(t.x - x, t.z + 300) - t.r); return d; };
    const x0 = [0, 2, -2, 4, -4, 6, -6, 8, -8].find(x => room(x) > 4); assert.ok(x0 !== undefined, 'a clear start near (0, -300)');
    const { page: p, context, errors: e } = await open(browser, 'landscape', s => { s.stats.sales = 250; s.position = { x: x0, z: -300 }; s.riding = 'jeep'; s.heading = 0; s.vehicles.jeep = { x: x0, z: -300, rot: 0 }; }); errors.push(e);
    await p.waitForTimeout(800); let m = await metrics(p); assert.equal(m.riding, 'jeep'); assert.equal(m.region, 'ice'); assert.ok(Math.abs(m.heading) < 1e-6, 'facing south, as saved');
    const stick = await holdStick(p, context, 0, 1);
    const run = await p.evaluate(() => new Promise(resolve => {
      const out = []; let last = willowmere.metrics().fields.createdTiles, n = 0;
      const tick = () => { const d = willowmere.render().drive, f = willowmere.metrics().fields; out.push({ x: d.riding.x, z: d.riding.z, speed: d.riding.speed, built: f.createdTiles - last, bumps: d.bumps }); last = f.createdTiles; if (d.riding.z >= -70 || ++n > 3000) resolve(out); else requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }));
    await stick.release(); m = await metrics(p);
    const spec = VEHICLES.jeep, top = Math.max(...run.map(f => f.speed)), built = Math.max(...run.map(f => f.built)), total = run.reduce((n, f) => n + f.built, 0);
    assert.ok(run.at(-1).z >= -70, `it got there (z ${run.at(-1).z.toFixed(1)} after ${run.length} frames)`); assert.ok(top >= spec.top - .01, `38.4 m/s is reached (${top.toFixed(2)})`);
    assert.ok(built <= 1, `no frame builds more than one tile (${built})`); assert.ok(total >= 10, `the fields streamed in as it went (${total} tiles)`);
    // Never inside a trunk: every frame's place against the field plan the game itself planted.
    let nearest = Infinity;
    for (const f of run) { const tx = Math.floor(f.x / FIELD_TILE), tz = Math.floor(f.z / FIELD_TILE); for (let i = tx - 1; i <= tx + 1; i++) for (let k = tz - 1; k <= tz + 1; k++) for (const t of fieldTrees(i, k)) nearest = Math.min(nearest, Math.hypot(t.x - f.x, t.z - f.z) - t.r - spec.body - .25); }
    assert.ok(nearest > -.02, `the car never ends a frame inside a trunk's margin (nearest ${nearest.toFixed(3)} m)`);
    assert.equal(regionAt(m.position.x, m.position.z), 'north', 'through the Frost Peaks into the swamp'); /* The stick points due south all the way; each trunk met costs a swerve to one side (drive-view.mjs), so the car ends beside the line, not on it. Builder A's trail (no scenery within 5 m of x = 0 in the swamp) straightens the second half. */
    results.push({ name: '230 m at top speed: one tile a frame, never inside a trunk', frames: run.length, topSpeed: +top.toFixed(2), tilesBuilt: total, mostInOneFrame: built, bumps: run.at(-1).bumps, nearestTrunkMargin: +nearest.toFixed(3), endsAt: [+m.position.x.toFixed(1), +m.position.z.toFixed(1)] });
    await context.close();
  }
  assert.deepEqual(errors.flat(), []);
  await save('vehicle-results', results); console.log(JSON.stringify(results, null, 1)); console.log('vehicle-browser: all passed');
} catch (error) { console.error(error); console.error('page errors', errors.flat()); process.exitCode = 1; } finally { await browser.close(); }
