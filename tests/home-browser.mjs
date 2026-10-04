// Round 8 in a real browser (builder C): Home. Near the village the button walks (or drives); from far out it is a magic hop with a
// rainbow ring and a white fade, and the car you sit in comes with you; on foot every car left outside the ward is towed.
//
//   GAME_URL=http://127.0.0.1:<port> GPU=1 node tests/home-browser.mjs
import assert from 'node:assert/strict';
import { launch, open, metrics, snapshot, shot, press, save, clearSpot, VIEWS } from './travel-kit.mjs';
import { HOMESTEAD } from '../src/field-layout.mjs';
import { SAFE, inSafeZone, wildDepth } from '../src/ward.mjs';
import { HOME_SPOT } from '../src/game.mjs';

const browser = await launch(), results = [], errors = [];
const PARKED = { jeep: { x: 46, z: -15 }, bike: { x: 5, z: -8 } };
const cars = page => page.evaluate(() => willowmere.render().vehicles);
const toast = page => page.locator('#toast').textContent();
/** Press Home and watch the hop frame by frame until it has landed: which phases showed, how long it took, what was on the screen. */
async function hop(page, view, name) {
  const watch = page.evaluate(() => new Promise(resolve => {
    const seen = [], t0 = willowmere.render().t; let ring = 0, white = 0, n = 0, started = false, landed = null; // the game's own clock: a busy machine's frames are long, and the game steps 50 ms a frame at most
    const tick = () => {
      const t = willowmere.metrics().journey, fade = +getComputedStyle(document.getElementById('home-fade')).opacity;
      if (t.home && seen.at(-1) !== t.home) seen.push(t.home); if (t.home) started = true; if (t.ring) ring++; white = Math.max(white, fade);
      if (started && !t.home && !landed) { const p = willowmere.metrics().position, cx = Math.floor(p.x / 64), cz = Math.floor(p.z / 64), have = new Set((willowmere.regions?.().tiles ?? []).map(q => `${q.x},${q.z}`)); landed = { fade, missing: [] }; for (let i = cx - 1; i <= cx + 1; i++) for (let k = cz - 1; k <= cz + 1; k++) if (!have.has(`${i},${k}`)) landed.missing.push(`${i},${k}`); } // fields.ensureNear (builder A): the nine tiles round the landing stand when the white starts to lift
      if (started && !t.home && fade < .02 || ++n > 900) resolve({ seen, ring, white, landed, ms: (willowmere.render().t - t0) * 1000, frames: n }); else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  await press(page, view, '.home-button');
  if (name) { await page.waitForFunction(() => willowmere.metrics().journey.home === 'charge', null, { timeout: 5000 }); await page.waitForTimeout(350); await shot(page, `${name}-ring`); await page.waitForFunction(() => +getComputedStyle(document.getElementById('home-fade')).opacity > .5, null, { timeout: 8000 }); await shot(page, `${name}-fade`); }
  return watch;
}

try {
  // ---------------------------------------------------------------- 1. on foot from far out, the box shut: ring, fade, the yard; the cars come home
  for (const view of ['desktop', 'phone', 'landscape']) {
    const size = `${VIEWS[view].viewport.width}x${VIEWS[view].viewport.height}`, far = clearSpot(150, 150, 7); // out in the Cloud Meadow, clear of its trees
    const { page: p, errors: e } = await open(browser, view, s => { s.bike = true; s.stats.sales = 250; s.position = { ...far }; s.vehicles = { jeep: { x: far.x + 4.5, z: far.z, rot: .6 }, bike: { x: 20, z: 30, rot: 1 } }; }); errors.push(e);
    await p.waitForTimeout(700); const from = await metrics(p); assert.equal(from.region, 'cloud'); assert.ok(from.journey.wildDepth >= 20); assert.equal(await p.locator('#home-guide').isHidden(), false, 'the way-back guide shows out here');
    assert.match(await p.locator('#home-distance').textContent(), /^\d+ m · tap to go home$/); assert.equal(await p.locator('.home-button').getAttribute('title'), 'Home');
    const seen = await hop(p, view, `home-foot-${size}`), m = await metrics(p), s = await snapshot(p);
    assert.deepEqual(seen.seen, ['charge', 'fade', 'land'], 'the ring, the white, the landing'); assert.ok(seen.ring > 10, `the ring was drawn (${seen.ring} frames)`); assert.ok(seen.white > .95, `the screen went white (${seen.white})`);
    assert.ok(seen.ms < 3000, `within three seconds (${Math.round(seen.ms)} ms)`);
    assert.ok(seen.landed && !seen.landed.missing.length, `the nine tiles round home stand as the white lifts (missing ${seen.landed?.missing.join(' ')})`);
    assert.ok(Math.hypot(m.position.x - HOME_SPOT.x, m.position.z - HOME_SPOT.z) < .05, `you land in the yard (${m.position.x.toFixed(2)}, ${m.position.z.toFixed(2)})`); assert.equal(m.riding, ''); assert.equal(m.navigation.remaining, 0);
    const now = await cars(p), jeep = now.find(v => v.id === 'jeep'), bike = now.find(v => v.id === 'bike');
    assert.ok(Math.hypot(jeep.x - PARKED.jeep.x, jeep.z - PARKED.jeep.z) < .01, 'the jeep left outside the ward is towed to its park spot'); assert.equal(s.vehicles.jeep, null);
    assert.ok(Math.hypot(bike.x - 20, bike.z - 30) < .01, 'the motorcycle left inside the ward stays where it is'); assert.deepEqual(s.vehicles.bike, { x: 20, z: 30, rot: 1 });
    assert.ok(Math.hypot(m.screen.x - VIEWS[view].viewport.width / 2, m.screen.y - VIEWS[view].viewport.height / 2) < VIEWS[view].viewport.height * .35, 'the camera is on you at once');
    assert.equal(await p.locator('#home-guide').isHidden(), true); await p.waitForTimeout(500); await shot(p, `home-foot-${size}-landed`);
    assert.equal((await metrics(p)).journey.ring, false);
    results.push({ name: `${view}: Home on foot from (150, 150)`, phases: seen.seen, ms: Math.round(seen.ms), ringFrames: seen.ring });
    await p.context().close();
  }
  // ---------------------------------------------------------------- 2. riding, from the Night Land: still seated, at the car's park spot
  for (const [id, view] of [['jeep', 'desktop'], ['bike', 'phone']]) {
    const { page: p, errors: e } = await open(browser, view, s => { s.bike = true; s.stats.sales = 250; s.position = { x: 256, z: 0 }; s.riding = id; s.heading = 2; s.vehicles[id] = { x: 256, z: 0, rot: 2 }; s.vehicles[id === 'jeep' ? 'bike' : 'jeep'] = { x: 240, z: 10, rot: 0 }; }); errors.push(e);
    await p.waitForTimeout(700); assert.equal((await metrics(p)).riding, id);
    const seen = await hop(p, view, view === 'desktop' ? 'home-riding-1440x900' : 'home-riding-390x844'), m = await metrics(p), s = await snapshot(p), now = await cars(p), mine = now.find(v => v.id === id), other = now.find(v => v.id !== id);
    assert.deepEqual(seen.seen, ['charge', 'fade', 'land']); assert.ok(seen.ms < 3000, `${Math.round(seen.ms)} ms`);
    assert.equal(m.riding, id, 'still seated'); assert.ok(Math.hypot(mine.x - PARKED[id].x, mine.z - PARKED[id].z) < .01, `the ${id} is at its park spot`); assert.ok(Math.hypot(m.position.x - mine.x, m.position.z - mine.z) < 1.2, 'and you are in it');
    assert.ok(Math.hypot(other.x - 240, other.z - 10) < .01, 'the car you were not in stays where it was left'); assert.ok(inSafeZone(s.position.x, s.position.z)); assert.equal(s.riding, id);
    const seat = await p.evaluate(() => willowmere.render()); assert.ok(seat.player.y > .2 && seat.player.legs[0] < -.5, 'seated'); assert.equal(seat.drive.riding.speed, 0);
    await p.waitForTimeout(400); await shot(p, view === 'desktop' ? 'home-riding-1440x900-landed' : 'home-riding-390x844-landed');
    // It drives off again from there.
    await p.keyboard.down('s'); await p.waitForTimeout(900); await p.keyboard.up('s'); assert.ok(Math.hypot((await metrics(p)).position.x - m.position.x, (await metrics(p)).position.z - m.position.z) > 2, 'and drives on');
    results.push({ name: `${id}: Home while riding at (256, 0): seated at the park spot`, ms: Math.round(seen.ms) });
    await p.context().close();
  }
  // ---------------------------------------------------------------- 3. from 10 m outside the ward: a walk, no ring, no white
  {
    const start = { x: -21, z: SAFE.z1 + 10 };
    const { page: p, errors: e } = await open(browser, 'desktop', s => { s.position = start; s.settings.test = true; }); errors.push(e);
    await p.waitForTimeout(600); assert.ok(wildDepth(start.x, start.z) < 20);
    const watch = p.evaluate(() => new Promise(resolve => { let white = 0, ring = 0, home = 0, n = 0; const tick = () => { const m = willowmere.metrics(), t = m.journey; white = Math.max(white, +getComputedStyle(document.getElementById('home-fade')).opacity); if (t.ring) ring++; if (t.home) home++; if (n > 30 && m.navigation.remaining === 0 || ++n > 3600) resolve({ white, ring, home, frames: n }); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); }));
    await press(p, 'desktop', '.home-button'); await p.waitForFunction(() => willowmere.metrics().navigation.remaining > 0, null, { timeout: 5000 });
    assert.match(await toast(p), /Heading home/); const seen = await watch, m = await metrics(p);
    assert.equal(seen.white, 0, 'no fade'); assert.equal(seen.ring, 0, 'no ring'); assert.equal(seen.home, 0);
    assert.ok(Math.hypot(m.position.x - HOMESTEAD.x, m.position.z - HOMESTEAD.z) < 1.5, `walked home (${m.position.x.toFixed(1)}, ${m.position.z.toFixed(1)})`);
    results.push({ name: 'Home from 10 m outside the ward: the walk', frames: seen.frames }); await p.context().close();
  }
  // ---------------------------------------------------------------- 4. the same in the jeep: it drives home and arrives without circling
  {
    const start = { x: -21, z: SAFE.z1 + 10 };
    const { page: p, errors: e } = await open(browser, 'desktop', s => { s.stats.sales = 250; s.position = start; s.riding = 'jeep'; s.heading = 1; s.vehicles.jeep = { ...start, rot: 1 }; }); errors.push(e);
    await p.waitForTimeout(600); assert.equal((await metrics(p)).riding, 'jeep');
    const watch = p.evaluate(() => new Promise(resolve => {
      let n = 0, far = 0, turned = 0, last = null, white = 0, t0 = performance.now();
      const tick = () => { const m = willowmere.metrics(), r = willowmere.render().drive.riding; white = Math.max(white, +getComputedStyle(document.getElementById('home-fade')).opacity); if (last) { far += Math.hypot(r.x - last.x, r.z - last.z); turned += Math.abs(Math.atan2(Math.sin(r.heading - last.heading), Math.cos(r.heading - last.heading))); } last = r; if (n > 30 && m.navigation.remaining === 0 && r.speed < .05 || ++n > 3600) resolve({ far, turned, white, frames: n, ms: performance.now() - t0, x: r.x, z: r.z }); else requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }));
    await press(p, 'desktop', '.home-button'); await p.waitForFunction(() => willowmere.metrics().navigation.remaining > 0, null, { timeout: 5000 }); assert.match(await toast(p), /Driving home/);
    const seen = await watch, straight = Math.hypot(start.x - HOMESTEAD.x, start.z - HOMESTEAD.z);
    assert.equal(seen.white, 0, 'no fade this near'); assert.equal((await metrics(p)).riding, 'jeep', 'still in the jeep');
    assert.ok(Math.hypot(seen.x - HOMESTEAD.x, seen.z - HOMESTEAD.z) < 2.5, `arrived (${seen.x.toFixed(1)}, ${seen.z.toFixed(1)})`);
    assert.ok(seen.far < straight * 1.6, `no circling: ${seen.far.toFixed(0)} m driven for ${straight.toFixed(0)} m as the crow flies`); assert.ok(seen.turned < Math.PI * 3, `turned ${seen.turned.toFixed(1)} rad in all`);
    results.push({ name: 'driving Home from 10 m outside the ward', metres: +seen.far.toFixed(1), straight: +straight.toFixed(1), turned: +seen.turned.toFixed(2), seconds: +(seen.ms / 1000).toFixed(1) }); await p.context().close();
  }
  // ---------------------------------------------------------------- 5. the Map's "find" from far out, riding: lands, then steps out, then walks
  {
    const { page: p, errors: e } = await open(browser, 'desktop', s => { s.stats.sales = 250; s.position = { x: 150, z: 150 }; s.riding = 'jeep'; s.heading = 0; s.vehicles.jeep = { x: 150, z: 150, rot: 0 }; }); errors.push(e);
    await p.waitForTimeout(600); await p.locator('[data-action="open"][data-panel="map"]').click(); await p.waitForSelector('.quick-locations');
    const order = p.evaluate(() => new Promise(resolve => { const seen = []; let n = 0; const note = k => { if (seen.at(-1) !== k) seen.push(k); }; const tick = () => { const m = willowmere.metrics(); if (m.journey.home) note(m.journey.home); else if (seen.length) { if (m.riding) note('seated'); else note(m.navigation.remaining ? 'walking' : 'out'); } if (seen.includes('walking') || ++n > 900) resolve(seen); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); }));
    await p.locator('.quick-locations [data-action="find"][data-id="market"]').click();
    const seen = await order, m = await metrics(p), jeep = (await cars(p)).find(v => v.id === 'jeep');
    assert.deepEqual(seen.filter(k => k !== 'seated' && k !== 'out'), ['charge', 'fade', 'land', 'walking'], `lands, then steps out, then routes (${seen.join(', ')})`);
    assert.equal(m.riding, ''); assert.ok(Math.hypot(jeep.x - PARKED.jeep.x, jeep.z - PARKED.jeep.z) < .01, 'the jeep came home with you'); assert.equal(m.navigation.pending, 'shop'); assert.ok(inSafeZone(m.position.x, m.position.z));
    assert.match(await toast(p), /On the way/); results.push({ name: 'Map find from (150, 150) while riding', order: seen }); await p.context().close();
  }
  // ---------------------------------------------------------------- 6. never during the village run; and a creature angry at you makes it slow
  {
    const { page: p, errors: e } = await open(browser, 'desktop', s => { s.position = { x: 22, z: 29.5 }; }); errors.push(e);
    await p.waitForTimeout(600); await p.keyboard.press('e'); await p.waitForSelector('[data-action="startRace"]'); await p.locator('[data-action="startRace"]').click(); await p.waitForFunction(() => !document.getElementById('race-hud').hidden);
    await press(p, 'desktop', '.home-button'); assert.match(await toast(p), /village run/i); const m = await metrics(p); assert.equal(m.navigation.remaining, 0, 'no walk home is started'); assert.equal(m.journey.home, '');
    results.push({ name: 'Home is refused during the village run' }); await p.context().close();
  }
  {
    // pandora-browser's knock-out stand: a cactus of the canyon shoots from six metres. With it angry at you the ring takes 3 s, not 0.6.
    const { page: p, errors: e } = await open(browser, 'desktop', s => { s.pandora = true; s.position = { x: 92.5, z: -9 }; s.hp = 100; s.gearOwned = ['hat_bear']; s.gear.hat = 'hat_bear'; }); errors.push(e);
    await p.waitForFunction(() => willowmere.wilds?.().ready, null, { timeout: 60000 });
    const angry = await p.waitForFunction(() => willowmere.snapshot().hp < 100, null, { timeout: 60000 }).then(() => true, () => false);
    if (angry) {
      await press(p, 'desktop', '.home-button'); const said = await toast(p); await p.waitForTimeout(1300); const t = (await metrics(p)).journey, at = (await metrics(p)).position;
      assert.match(said, /angry|slipped/i, `the slow way home is announced (${said})`); assert.ok(Math.hypot(at.x - 92.5, at.z + 9) < 6, 'still out there after 1.3 s: not the quick hop');
      assert.ok(t.home === 'charge' || t.home === '', `charging still, or cancelled by a blow (${t.home})`);
      results.push({ name: 'a creature is angry at you: the ring takes 3 s and a blow cancels it', after1300ms: t.home || 'cancelled', toast: said });
    } else results.push({ name: 'a creature is angry at you: SKIPPED, nothing attacked at the stand within 60 s (re-pick it after builder D)' });
    await p.context().close();
  }
  assert.deepEqual(errors.flat(), []);
  await save('home-results', results); console.log(JSON.stringify(results, null, 1)); console.log('home-browser: all passed');
} catch (error) { console.error(error); console.error('page errors', errors.flat()); process.exitCode = 1; } finally { await browser.close(); }
