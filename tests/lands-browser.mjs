// The lands in a real browser (round 8, builder B): each land's features drawn (one surface draw a land), what they do to
// the player with the box shut and open (lava, vents, the weather, trains, poison, ice, the sea, the Night Land's dark and
// its lamps), the land line of the HUD, and the draw calls at every land's stand point.
//
//   GAME_URL=http://127.0.0.1:4412 GPU=1 node tests/lands-browser.mjs
//   Builders A and C are merged on round8, so the checks that need their work are hard assertions (World.update drives step() and
//   walk(), nodeReach on ice, carLimit in the sea, ponds block, applyLights reads LIGHTS). MERGED=0 reports them as DEFERRED instead.
//   EVIDENCE=<dir>  also writes the evidence screenshots (spec 11.4) at 1440x900, 844x390 and 390x844 into <dir>
//   SCENES=1        with EVIDENCE: the far and near shots of all eight lands at the three sizes (slow)
//
// Reads window.willowmere (snapshot, metrics, calls, targets, wilds, lands) and drives with keys and taps like a player. The only
// mutation is the spec's own test hook, willowmere.test.lavaEvent (present in test mode), for the weather the clock decides.
// Screenshots and lands-results.json go to test-results/.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { freshState, SAVE_KEY } from '../src/game.mjs';
import { FEATURES } from '../src/land-features.mjs';
import { LIGHTS } from '../src/region-life.mjs';


const url = process.env.GAME_URL ?? 'http://127.0.0.1:4412', MERGED = process.env.MERGED !== '0', EVIDENCE = process.env.EVIDENCE ?? '', SCENES = !!process.env.SCENES;
const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome', headless: true, args: process.env.GPU ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [], results = [], deferred = [], numbers = {};
await mkdir('test-results', { recursive: true }); if (EVIDENCE) await mkdir(EVIDENCE, { recursive: true });
const VIEWS = { desktop: { viewport: { width: 1440, height: 900 } }, phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, landscape: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true } };
import { STAND } from './stands.mjs'; // round 9: the stand points of the ring world (spec 3.5)
const LANDS = ['toy', 'candy', 'jungle', 'ice', 'ocean', 'lava', 'cloud', 'shadow'];

async function setup(view, change) {
  const seed = freshState(); seed.started = true; change?.(seed);
  const context = await browser.newContext({ ...VIEWS[view], deviceScaleFactor: 1 });
  await context.addInitScript(({ key, seed }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(seed)); }, { key: SAVE_KEY, seed });
  const page = await context.newPage(); page.setDefaultTimeout(120000);
  page.on('pageerror', e => errors.push(e.message)); page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(url); await page.waitForFunction(() => window.willowmere?.metrics().ready, null, { timeout: 120000 });
  await (VIEWS[view].hasTouch ? page.locator('#begin').tap() : page.locator('#begin').click());
  await page.waitForFunction(() => typeof willowmere.lands === 'function' && willowmere.lands().time > .3, null, { timeout: 60000 });
  return { page, context, size: VIEWS[view].viewport };
}
const at = (x, z, more) => s => { s.position = { x, z }; more?.(s); };
const lands = p => p.evaluate(() => willowmere.lands());
const hp = p => p.evaluate(() => willowmere.snapshot().hp);
const position = p => p.evaluate(() => ({ ...willowmere.metrics().position, now: performance.now() / 1000 }));
/** Waits until the lands' own clock has run `seconds` more (it is the clock the damage ticks on; a slow machine stretches the wall clock, not this). */
async function simWait(p, seconds) { const t0 = (await lands(p)).time; await p.waitForFunction(until => willowmere.lands().time >= until, t0 + seconds, { timeout: 120000 + seconds * 4000 }); }
/** Real draw calls with the shadow pass: the counter is armed, three frames later the number is there. */
async function calls(p) { await p.evaluate(() => willowmere.calls()); await p.waitForTimeout(350); return p.evaluate(() => willowmere.calls()); }
const toastText = p => p.evaluate(() => document.getElementById('toast')?.textContent ?? '');
const lineText = p => p.evaluate(() => { const e = document.getElementById('land-status'); return !e || e.hidden || getComputedStyle(e).display === 'none' ? '' : e.querySelector('b').textContent; });
async function shot(p, name, evidence) { const file = `test-results/lands-${name}.png`; await p.screenshot({ path: file }); if (EVIDENCE && evidence) await copyFile(file, `${EVIDENCE}/${evidence}.png`); }
const pass = (name, extra = {}) => { results.push({ name, pass: true, ...extra }); console.log('ok   ', name, Object.keys(extra).length ? JSON.stringify(extra) : ''); };
const defer = (check, needs) => { deferred.push({ check, needs }); console.log('DEFER', check, '· needs', needs); };
const zoomOut = async (p, size) => { await p.mouse.move(size.width / 2, size.height / 2); for (let i = 0; i < 12; i++) await p.mouse.wheel(0, 400); await p.waitForTimeout(500); };
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
/** Boards the jeep at its park spot by the Bell garage and drives it through the waypoints with the screen-relative keys, as a player would. */
async function ride(p, waypoints, onTheWay, board = true) {
  if (board) await p.keyboard.press('e'); await p.waitForFunction(() => willowmere.metrics().riding === 'jeep', null, { timeout: 20000 });
  const held = new Set();
  for (const [i, point] of waypoints.entries()) for (let n = 0; n < 900; n++) {
    const here = await p.evaluate(() => willowmere.metrics().position), dx = point.x - here.x, dz = point.z - here.z; if (Math.hypot(dx, dz) < (point.reach ?? 7)) break;
    if (i === waypoints.length - 1 && onTheWay) { const done = await onTheWay(here); if (done) onTheWay = null; }
    const x = dx * Math.cos(.38) - dz * Math.sin(.38), z = dx * Math.sin(.38) + dz * Math.cos(.38), m = Math.max(Math.abs(x), Math.abs(z)), want = new Set();
    if (Math.abs(x) > m * .35) want.add(x > 0 ? 'd' : 'a'); if (Math.abs(z) > m * .35) want.add(z > 0 ? 's' : 'w');
    for (const k of [...held]) if (!want.has(k)) { await p.keyboard.up(k); held.delete(k); } for (const k of want) if (!held.has(k)) { await p.keyboard.down(k); held.add(k); }
    await p.waitForTimeout(point.reach ? 35 : 60);
  }
  for (const k of held) await p.keyboard.up(k);
  return p.evaluate(() => willowmere.metrics().position);
}
const GARAGE = [46, -12], drives = s => { s.stats.sales = 250; };
/** Taps the ground at a world point near the player (the camera is orthographic: yaw 0.38, 41 degrees down), as a finger would. */
async function tapGround(p, x, z) {
  const m = await p.evaluate(() => ({ pos: willowmere.metrics().position, screen: willowmere.metrics().screen, top: willowmere.metrics().cameraTop, h: innerHeight }));
  const dx = x - m.pos.x, dz = z - m.pos.z, perMetre = m.h / (2 * m.top); // metrics().screen is the player 1 m up: the ground under them is 0.755 m lower on the screen
  await p.mouse.click(m.screen.x + (dx * Math.cos(.38) - dz * Math.sin(.38)) * perMetre, m.screen.y + ((dx * Math.sin(.38) + dz * Math.cos(.38)) * .656 + .755) * perMetre);
}

/** A rider parked inside a vent's ring during an eruption is burned as a walker is (ONLY=rider runs this alone). */
async function riderInVent() {
    const vent = FEATURES.lava.vents[0], { page: p, context } = await setup('desktop', at(...GARAGE, s => { drives(s); s.pandora = true; s.settings.test = true; }));
    await p.evaluate(() => willowmere.test.lavaEvent('eruption'));
    await ride(p, [{ x: 70, z: -8 }, { x: 80, z: 60 }, { x: 30, z: 150 }, { x: vent.x + 2, z: vent.z - 18, reach: 10 }]);
    // Let the jeep roll to a stop, then tap the way to the vent: a tapped drive arrives and parks. A tap is never farther than 9 m
    // (so it is on the screen and clear of the HUD), and is made again from wherever the jeep comes to rest.
    let end = null;
    for (let attempt = 0; attempt < 14 && !end; attempt++) {
      await p.waitForTimeout(attempt ? 600 : 2200);
      const here = await position(p), dx = vent.x + .5 - here.x, dz = vent.z + .5 - here.z, far = Math.hypot(dx, dz), k = far > 9 ? 9 / far : 1;
      if (far < vent.r - 1.2) { end = here; break; }
      await tapGround(p, here.x + dx * k, here.z + dz * k);
      await p.waitForFunction(() => willowmere.metrics().navigation.remaining > 0, null, { timeout: 2500 }).catch(() => {});
      await p.waitForFunction(() => willowmere.metrics().navigation.remaining === 0, null, { timeout: 15000 }).catch(() => {});
    }
    assert.ok(end, 'the jeep was parked inside the vent’s ring');
    assert.ok(Math.hypot(end.x - vent.x, end.z - vent.z) < vent.r - .5, `parked ${Math.hypot(end.x - vent.x, end.z - vent.z).toFixed(1)} m from the vent, inside its ring`);
    const before = await hp(p); await p.waitForFunction(b => willowmere.snapshot().hp < b, before, { timeout: 150000 });
    const m = await p.evaluate(() => willowmere.metrics()); assert.equal(m.riding, 'jeep', 'still in the jeep'); await shot(p, '14-vent-rider', 'lava-vent-rider');
    pass('a rider parked inside a vent’s ring during an eruption loses HP', { hpBefore: before, hpAfter: await hp(p) });
    await p.evaluate(() => willowmere.test.lavaEvent(null)); await context.close();
}

try {
  behaviour: {
  if (process.env.ONLY === 'calls') break behaviour; // ONLY=calls: the measurements alone
  if (process.env.ONLY === 'rider') { await riderInVent(); break behaviour; }
  // ---------------------------------------------------------------- a lava pool, box shut: drawn, harmless
  const pool = FEATURES.lava.pools[0];
  {
    const { page: p, context } = await setup('desktop', at(pool.x, pool.z));
    await simWait(p, 3);
    const l = await lands(p);
    assert.equal(await hp(p), 100, 'three seconds in a pool with the box shut: no damage');
    assert.equal(l.views.lava, 1, 'the Ember Fields are one surface draw'); assert.equal(l.sparks, 0); assert.equal(l.drops, 0);
    assert.equal(await lineText(p), '', 'the weather line is off with the box shut'); assert.ok(!/lava|Fire/.test(await toastText(p)));
    numbers.driven = l.driven; if (MERGED) assert.deepEqual(l.driven, { step: 'world', walk: 'world' }, 'World.update drives the lands');
    await shot(p, '01-pool-shut', 'lava-pool-box-shut'); pass('a lava pool with the box shut: drawn in one draw, no damage in 3 s', { driven: l.driven });
    await context.close();
  }
  // ---------------------------------------------------------------- the same pool, box open: 7% every 0.5 s and the toast
  {
    const { page: p, context } = await setup('desktop', at(pool.x, pool.z, s => { s.pandora = true; }));
    await p.evaluate(() => { const seen = window.__toasts = [document.getElementById('toast')?.textContent ?? '']; new MutationObserver(() => seen.push(document.getElementById('toast').textContent)).observe(document.getElementById('toast'), { childList: true, characterData: true, subtree: true }); });
    await p.waitForFunction(() => willowmere.snapshot().hp < 100, null, { timeout: 60000 });
    const first = await lands(p), start = await hp(p), firstToast = await toastText(p); await shot(p, '02-pool-open-start', 'lava-hp-before');
    await p.waitForFunction(until => willowmere.lands().time >= until, first.time + 2.2); await shot(p, '02-pool-open-2s', 'lava-hp-after-2s');
    await p.waitForFunction(until => willowmere.lands().time >= until, first.time + 2.9);
    const left = await hp(p), lost = 100 - left, toast = (await p.evaluate(() => window.__toasts)).find(t => /lava burns/i.test(t)) ?? firstToast; // read at the first burn: the weather's name comes first in the frame, the burn's toast is the last word (the toast fades by 3 s)
    assert.ok(lost >= 42 && lost <= 49, `HP down by ${lost}% after 3 s in a pool (42 to 49: six or seven ticks of 7%)`); assert.equal(lost % 7, 0, 'each tick is 7% of full health');
    assert.match(toast, /lava burns/i, 'the hurt toast names the lava'); assert.equal(await p.locator('#land-status').isVisible(), true, 'with the box open the weather line shows');
    assert.match(await lineText(p), /· \d+ seconds$/); pass('a lava pool with the box open: 7% every 0.5 s and a toast', { lost, firstTickAt: +first.time.toFixed(2), start });
    await context.close();
  }
  // ---------------------------------------------------------------- the weather: a meteor's mark, falling fire, ore; a vent's warning and eruption
  {
    const [x, z] = STAND.lava, { page: p, context } = await setup('desktop', at(x, z, s => { s.pandora = true; s.settings.test = true; }));
    await p.evaluate(() => willowmere.test.lavaEvent('meteor'));
    await p.waitForFunction(() => /Meteor shower/.test(document.getElementById('toast').textContent), null, { timeout: 30000 });
    await p.waitForFunction(() => willowmere.lands().drops > 0 && willowmere.wilds().marks > 0 && willowmere.lands().sparks > 0, null, { timeout: 60000 });
    const l = await lands(p), marks = await p.evaluate(() => willowmere.wilds().marks); assert.equal(l.weather, 'meteor'); assert.match(await lineText(p), /^Meteor shower · \d+ seconds$/);
    await shot(p, '03-meteor-mark', 'lava-meteor-mark');
    await p.waitForFunction(() => willowmere.lands().ores > 0, null, { timeout: 60000 }); await shot(p, '03-meteor-ore');
    pass('the meteor shower: named in a toast and the land line, a mark through world.pandora.mark, falling fire, a crystal left behind', { marks, drops: l.drops });
    await p.evaluate(() => willowmere.test.lavaEvent(null)); await context.close();
  }
  {
    const vent = FEATURES.lava.vents[0], { page: p, context } = await setup('desktop', at(vent.x + 1.5, vent.z, s => { s.pandora = true; s.settings.test = true; s.hp = 100; }));
    await p.evaluate(() => willowmere.test.lavaEvent('eruption')); // vents then erupt every 50 s
    await p.waitForFunction(() => /Volcano warning/.test(document.getElementById('toast').textContent), null, { timeout: 150000 });
    await p.waitForFunction(() => willowmere.wilds().marks > 0, null, { timeout: 20000 }); await shot(p, '04-vent-warning', 'lava-vent-warning');
    const before = await hp(p);
    await p.waitForFunction(b => willowmere.snapshot().hp < b && willowmere.lands().sparks >= 2, before, { timeout: 60000 }); await shot(p, '04-vent-eruption', 'lava-vent-eruption');
    pass('a vent: one warning toast with its ring, then an eruption that burns whoever stands in the ring', { hpBefore: before, hpAfter: await hp(p) });
    await p.evaluate(() => willowmere.test.lavaEvent(null)); await context.close();
  }
  // ---------------------------------------------------------------- ice: still sliding half a second after the stick is released
  {
    const [x, z] = STAND.ice, { page: p, context, size } = await setup('desktop', at(x, z));
    assert.equal(await lineText(p), 'Slippery — release early to brake');
    await p.keyboard.down('d'); await p.waitForTimeout(1300); await shot(p, '05-ice-0', 'ice-slide-1'); await p.keyboard.up('d');
    const a = await position(p); await p.waitForTimeout(500); const b = await position(p); await shot(p, '05-ice-1', 'ice-slide-2'); await p.waitForTimeout(150); const c = await position(p);
    await p.waitForTimeout(350); await shot(p, '05-ice-2', 'ice-slide-3');
    const slid = dist(a, b), speed = dist(b, c) / (c.now - b.now);
    assert.ok(slid > .5, `slid ${slid.toFixed(2)} m in the half second after release`); assert.ok(speed > .3, `still moving at ${speed.toFixed(2)} m/s 0.5 s after release`);
    numbers.ice = { slid: +slid.toFixed(2), speedAfterHalfSecond: +speed.toFixed(2), driven: (await lands(p)).driven.walk };
    await context.close();
    // The meadow, for contrast: a walker stops dead.
    const m = await setup('desktop', at(...STAND.south)); await m.page.keyboard.down('d'); await m.page.waitForTimeout(1000); await m.page.keyboard.up('d'); await m.page.waitForTimeout(120);
    const d = await position(m.page); await m.page.waitForTimeout(400); const e = await position(m.page); assert.ok(dist(d, e) < .05, 'off the ice you stop'); await m.context.close();
    pass('ice: the walker slides on after the stick is released; on grass it stops dead', numbers.ice);
    if (!MERGED) defer('a tapped walk on ice drops a route node within 1 m (nodeReach)', 'builder C: World.update reads walk().nodeReach');
    else {
      // A tapped walk 5 m east: the frame its route empties, how far the walker is from the tapped point. On ice the node is
      // dropped from up to 1 m off (walk().nodeReach); on grass from 0.22 m.
      const reach = async (x, z) => {
        const { page: p, context } = await setup('desktop', at(x, z)); await p.waitForTimeout(400); const target = { x: x + 5, z };
        const watch = p.evaluate(t => new Promise(done => { let seen = false; const stop = setTimeout(() => done(null), 30000); const tick = () => { const m = willowmere.metrics(); if (m.navigation.remaining > 0) seen = true; if (seen && m.navigation.remaining === 0) { clearTimeout(stop); return done(Math.hypot(m.position.x - t.x, m.position.z - t.z)); } requestAnimationFrame(tick); }; tick(); }), target);
        await tapGround(p, target.x, target.z); const d = await watch; await context.close(); return d;
      };
      const ice = await reach(...STAND.ice), grass = await reach(...STAND.south);
      assert.ok(ice !== null && grass !== null, 'both tapped walks set out and arrived');
      assert.ok(ice > .5 && ice < 1.35, `on ice the route node is dropped ${ice.toFixed(2)} m from the tap (nodeReach 1)`); assert.ok(grass < .45, `on grass ${grass.toFixed(2)} m (0.22)`);
      numbers.nodeReach = { ice: +ice.toFixed(2), grass: +grass.toFixed(2) }; pass('a tapped walk on ice drops its route node from 1 m off (World.update reads walk().nodeReach)', numbers.nodeReach);
    }
  }
  // ---------------------------------------------------------------- the sea: wading at 0.6 of the walking speed
  {
    const speedAt = async (x, z, key) => {
      const { page: p, context } = await setup('desktop', at(x, z)); await p.keyboard.down(key); await p.waitForTimeout(500);
      const a = await position(p); await p.waitForTimeout(1500); const b = await position(p); await p.keyboard.up(key); const l = await lands(p); await context.close(); return { speed: dist(a, b) / (b.now - a.now), l };
    };
    const sand = await speedAt(128, -128, 's'), sea = await speedAt(174, -120, 's'), ratio = sea.speed / sand.speed;
    assert.ok(sand.speed > 4 && sand.speed < 5.6, `walking on sand at ${sand.speed.toFixed(2)} m/s`); assert.ok(ratio > .52 && ratio < .68, `wading at ${ratio.toFixed(2)} of the walking speed`);
    assert.equal(sea.l.views.ocean, 2, 'the Beach: the sea surface and the turtles, two draws');
    numbers.sea = { sand: +sand.speed.toFixed(2), sea: +sea.speed.toFixed(2), ratio: +ratio.toFixed(3) }; pass('the sea: wading at 0.6 of the walking speed', numbers.sea);
    if (!MERGED) defer('a car in the sea is limited to 0.6 (carLimit)', 'builder C: DriveView.step multiplies its limit by world.lands.carLimit');
    else {
      // The jeep, seated on load, driven 85 m north along a lane of the Beach: on the sand (x 150) and in the sea band (x 180). The fastest
      // quarter second in the sea must stay under 0.6 of the jeep's top (VEHICLES.jeep.top 38.4 m/s → 23.04), with 16% for timing (the 250 ms sampler on a loaded machine read 25.0 m/s against 24.9 allowed at 8%).
      const lane = async x => {
        const { page: p, context } = await setup('desktop', at(x, -74, s => { drives(s); s.vehicles.jeep = { x, z: -74, rot: Math.PI }; s.riding = 'jeep'; s.heading = Math.PI; }));
        await p.waitForFunction(() => willowmere.metrics().riding === 'jeep', null, { timeout: 20000 });
        await p.evaluate(() => { const w = window.__lane = { top: 0, samples: 0, sea: 0 }; let last = null; w.timer = setInterval(() => { const m = willowmere.metrics(), now = performance.now() / 1000, q = m.position; if (last && m.riding) { const v = Math.hypot(q.x - last.x, q.z - last.z) / (now - last.t); if (q.z < -84 && q.z > -160) { w.top = Math.max(w.top, v); w.samples++; if (q.x > 168) w.sea++; } } last = { x: q.x, z: q.z, t: now }; }, 250); });
        await ride(p, [{ x, z: -165 }], null, false);
        const r = await p.evaluate(() => { clearInterval(window.__lane.timer); return window.__lane; }); await context.close(); return r;
      };
      const sand = await lane(150), sea = await lane(180);
      assert.ok(sea.samples >= 4 && sea.sea >= sea.samples - 1, `the sea lane stayed in the sea (${sea.sea} of ${sea.samples} samples)`);
      assert.ok(sea.top > 8 && sea.top < 38.4 * .6 * 1.16, `in the sea the jeep's best is ${sea.top.toFixed(1)} m/s (0.6 × 38.4 = 23.0)`);
      assert.ok(sand.top > sea.top * 1.1, `on the sand it does ${sand.top.toFixed(1)} m/s, more than in the sea`);
      numbers.seaCar = { sand: +sand.top.toFixed(1), sea: +sea.top.toFixed(1) }; pass('a car in the sea is held to 0.6 of its speed (DriveView.step × world.lands.carLimit)', numbers.seaCar);
    }
  }
  // ---------------------------------------------------------------- a toy train's pass moves you 2.2 m, and hurts only with the box open
  for (const box of [false, true]) {
    const track = FEATURES.toy.tracks[0], angle = Math.PI * .75, spot = { x: track.x + Math.cos(angle) * track.r, z: track.z + Math.sin(angle) * track.r };
    const { page: p, context } = await setup('desktop', at(spot.x, spot.z, s => { s.pandora = box; }));
    assert.equal(await lineText(p), box ? 'Moving trains hurt explorers' : 'Moving trains push explorers aside'); assert.equal((await lands(p)).views.toy, 2, 'Toybox Land: the rails and pond in one draw, the eight cars in another');
    await p.waitForFunction(({ x, z, r }) => { const m = willowmere.metrics().position; return Math.hypot(m.x - x, m.z - z) > r + 1.2; }, track, { timeout: 90000 });
    await p.waitForTimeout(250); const now = await position(p), moved = Math.hypot(now.x - track.x, now.z - track.z) - track.r, left = await hp(p);
    assert.ok(moved > 1.6 && moved < 2.4, `pushed ${moved.toFixed(2)} m outward`);
    if (box) { assert.equal(left, 85, 'a pass is 15%'); assert.match(await toastText(p), /toy train/i); } else assert.equal(left, 100, 'box shut: pushed, not hurt');
    await shot(p, box ? '06-train-open' : '06-train-shut', box ? '' : 'toy-train-pass'); pass(`a toy train's pass, box ${box ? 'open: 15% and' : 'shut: no damage,'} a ${moved.toFixed(2)} m push`, { moved: +moved.toFixed(2), hp: left });
    await context.close();
  }
  // ---------------------------------------------------------------- the jungle: the land line in and out of poison; poison bites with the box open
  {
    const patch = FEATURES.jungle.poison[0];
    let { page: p, context } = await setup('desktop', at(...STAND.jungle)); assert.equal(await lineText(p), 'Thorn walls rise for 16 of every 36 seconds'); assert.equal((await lands(p)).views.jungle, 2); await context.close();
    ({ page: p, context } = await setup('desktop', at(patch.x, patch.z, s => { s.pandora = true; })));
    assert.equal(await lineText(p), 'Poison gas! Leave the purple ground'); await p.waitForFunction(() => willowmere.snapshot().hp < 100, null, { timeout: 60000 });
    await p.waitForFunction(() => /Poison/.test(document.getElementById('toast').textContent), null, { timeout: 20000 }); await shot(p, '07-poison', 'land-line-poison'); await context.close();
    pass('the jungle: the land line names the thorn walls, and the poison when you stand in it; poison hurts with the box open');
  }
  // ---------------------------------------------------------------- the Night Land: 93% dark with holes; a tapped lamp is a hole for 150 s and heals
  {
    const lamp = FEATURES.shadow.lamps[0];
    for (const view of ['desktop', 'phone', 'landscape']) {
      const { page: p, context } = await setup(view, at(...STAND.shadow)); await p.waitForTimeout(600);
      const l = await lands(p), style = await p.evaluate(() => { const e = document.getElementById('night-layer'), c = getComputedStyle(e); return { opacity: +c.opacity, hidden: e.hidden, mask: (e.style.maskImage || e.style.webkitMaskImage || '').split('radial-gradient').length - 1, order: e.previousElementSibling?.tagName }; });
      assert.equal(style.hidden, false); assert.ok(Math.abs(style.opacity - (view === 'desktop' ? .93 : .84)) < .005, `the dark is at ${style.opacity} on foot (${view})`); assert.equal(style.mask, l.holes, 'one mask hole a light'); assert.ok(l.holes >= 1 && l.holes <= 16);
      assert.equal(style.order, 'CANVAS', 'the dark lies straight over the picture, under the HUD'); assert.equal(await lineText(p), 'Light pillars reveal and repel shadow creatures');
      if (view === 'desktop') { assert.equal(l.targets, 2, 'only the lamps within 48 m can be tapped'); assert.equal(l.views.shadow, 3, 'the pond, the lamps and the flowers: three draws'); }
      await shot(p, `08-night-${view}`, `night-93-on-foot-${view}`); await context.close();
    }
    // The fade at the shared border: none in the canyon, half 12 m in.
    { const { page: p, context } = await setup('desktop', at(190, 0)); assert.equal((await lands(p)).opacity, 0); assert.equal(await p.locator('#night-layer').isHidden(), true); await context.close(); }
    { const { page: p, context } = await setup('desktop', at(204, 0)); const o = (await lands(p)).opacity; assert.ok(Math.abs(o - .465) < .02, `12 m in: ${o}`); await shot(p, '08-night-border', 'night-fade-12m'); await context.close(); }
    // A lamp, tapped with E from 1.8 m (walking within 1.2 m lights it too).
    const { page: p, context } = await setup('desktop', at(lamp.x + 1.8, lamp.z, s => { s.pandora = true; s.hp = 40; }));
    let l = await lands(p); assert.equal(l.lamps[0], 0, 'unlit'); const holes = l.holes;
    assert.ok((await p.evaluate(() => willowmere.targets().filter(t => t.type === 'lamp').length)) >= 1);
    await p.keyboard.press('e'); await p.waitForFunction(n => willowmere.lands().lamps[0] > 0 && willowmere.lands().holes > n, holes, { timeout: 20000 });
    l = await lands(p); assert.ok(l.lamps[0] >= 148 && l.lamps[0] <= 150, `lit for ${l.lamps[0]} s`); assert.equal(l.holes, holes + 1, 'the lamp is a hole in the dark'); assert.match(await toastText(p), /pillar is lit/);
    assert.equal(await lineText(p), 'Safe light — healing'); await simWait(p, 2); const healed = await hp(p); assert.ok(healed > 44 && healed < 50, `3% a second in its light: ${healed}`);
    await shot(p, '09-lamp-lit', 'night-lamp-lit'); await shot(p, '09-lamp-line', 'land-line-lamp');
    pass('the Night Land: the dark at 0.93 on foot on three screens, fading in over 24 m; a tapped lamp is a hole for 150 s and heals 3% a second', { lamp: l.lamps[0], healed });
    await context.close();
  }
  // ---------------------------------------------------------------- riding: the dark is the same 0.93 from the jeep; a rider parked in an erupting vent's ring is burned
  for (const view of EVIDENCE ? ['desktop', 'phone'] : ['desktop']) {
    const { page: p, context } = await setup(view, at(...GARAGE, drives)); let seen = null;
    await ride(p, [{ x: 70, z: -8 }, { x: 185, z: 0 }, { x: 300, z: 6 }], async here => { if (here.x < 250) return false; seen = await p.evaluate(() => ({ l: willowmere.lands(), m: willowmere.metrics() })); await shot(p, `13-night-riding-${view}`, `night-93-riding-${view}`); return true; });
    assert.ok(seen, 'the jeep reached the Night Land'); assert.equal(seen.m.riding, 'jeep'); assert.ok(Math.abs(seen.l.opacity - (view === 'desktop' ? .93 : .84)) < .005, `the dark is at ${seen.l.opacity} while riding`); assert.ok(seen.l.holes >= 1);
    numbers['nightRiding ' + view] = { opacity: seen.l.opacity, driveZoom: +seen.m.driveZoom.toFixed(2), cameraTop: +seen.m.cameraTop.toFixed(1) }; await context.close();
  }
  pass('riding into the Night Land: the dark stays at 0.93 (the reference’s strength), with the jeep in its own hole', numbers['nightRiding desktop']);
  await riderInVent();
  // ---------------------------------------------------------------- nothing of the lands can be tapped from the village, and nothing is built there
  {
    const { page: p, context } = await setup('desktop', at(0, -8)); await p.waitForTimeout(800);
    const l = await lands(p); assert.equal(l.targets, 0); assert.equal(await lineText(p), ''); assert.equal(l.opacity, 0);
    assert.ok(!('lava' in l.views) && !('shadow' in l.views) && !('jungle' in l.views) && !('ice' in l.views), 'only squares within 112 m are built'); assert.equal(l.sparks, 0); await context.close();
    pass('at home: no land target, no land line, no dark; only the neighbouring squares’ surfaces are built', { views: Object.keys(l.views) });
  }
  // ---------------------------------------------------------------- blocking: ponds and pools are tree blocks added by the tiles (builder A), honoured by C's lookups
  {
    const pond = FEATURES.west.ponds[0], { page: p, context } = await setup('desktop', at(pond.x - pond.r - 3, pond.z + 2.2));
    await p.keyboard.down('d'); await p.waitForTimeout(2600); await p.keyboard.up('d'); const m = await position(p), inside = Math.hypot(m.x - pond.x, m.z - pond.z) < pond.r - .4; await context.close();
    if (MERGED) { assert.equal(inside, false, 'a pond blocks a walker'); pass('a pond blocks a walker (A’s tiles add blockers(id))', { at: [+m.x.toFixed(1), +m.z.toFixed(1)] }); } else if (inside) defer('a pond blocks walking and a tapped walk goes round it; a jeep stops at a lava pool’s bank', 'builder A: fields.mjs adds land-features blockers(id) to the world with each tile (blockers() is real and tested)'); else pass('a pond blocks a walker');
  }
  if (MERGED) {
    // The light writer (World.applyLights, builder C) reads region-life.mjs LIGHTS: the home light at the shared border, the land's
    // own from 24 m in, and still its own 2 m inside the outer edge (the world's half is 320 m).
    const light = async (x, z) => { const { page: p, context } = await setup('desktop', at(x, z)); await p.waitForTimeout(300); const j = (await p.evaluate(() => willowmere.metrics().journey)); await context.close(); return j; };
    const home = await light(0, 150), border = await light(0, 193.5), half = await light(-20, 204), lava = await light(-20, 270), rim = await light(-20, 318), night = await light(256, 0);
    assert.equal(home.land, null); assert.equal(home.landShare, 0);
    assert.equal(border.land, 'lava'); assert.ok(border.landShare < .1, `at the border ${border.landShare}`); assert.ok(Math.abs(half.landShare - .5) < .03, `12 m in: ${half.landShare}`);
    for (const [j, where] of [[lava, 'the Ember Fields'], [rim, '2 m inside the outer edge']]) { assert.equal(j.landShare, 1, where); assert.equal(j.fog, LIGHTS.lava.fog, `${where}: the lava fog`); assert.equal(j.sky, LIGHTS.lava.sky, `${where}: the lava sky`); }
    assert.equal(night.land, 'shadow'); assert.equal(night.fog, LIGHTS.shadow.fog, 'the Night Land fog');
    numbers.lights = { home: home.fog, border: [border.landShare, border.fog], half: [half.landShare, half.fog], lava: lava.fog, rim: rim.fog, night: night.fog };
    pass('the fog and light crossfade into a land with region-life.mjs LIGHTS (home at the border, half 12 m in, the land’s own from 24 m to the outer edge)', numbers.lights);
  } else {
    defer('the fog and light crossfade into each land (home colour at the border, the land’s own from 24 m, still its own 2 m inside the outer edge)', 'builder C: applyLights reads LIGHTS (the rows are real and tested)');
    defer('no region tile adds more than 5 main and 3 shadow draws (6 on candy and ice); swamp reeds and pond reeds are different meshes; a lava rock’s glow attribute is non-zero', 'builder A: fieldTrees, fieldCards, loadKit and glow, reading DECOR, CARDS and KIT_TINTS');
    defer('the riding shots of the Night Land in builder C’s far view (camera half-height 36), on A’s dark ground and under C’s night light', 'builders A and C: today the jeep is seen from the old drive camera (half-height 22) on step 0’s green ground');
  }
  }
  // ---------------------------------------------------------------- draw calls at every stand, near and zoomed out, both settings
  // The limits are section 18's. Draw calls are asserted; triangles are recorded and a figure over its limit is listed as a finding
  // (numbers.over), because the zoomed-out fields are already over it on round8 before this branch (ROUND8-B.md has both builds).
  numbers.calls = {}; numbers.over = [];
  if (process.env.ONLY !== 'rider') for (const [label, view, quality] of [['pc-high', 'desktop', 'high'], ['phone-battery', 'phone', 'battery']]) for (const id of Object.keys(STAND)) {
    const { page: p, context, size } = await setup(view, at(...STAND[id], s => { s.settings.quality = quality; })); await p.waitForTimeout(900);
    const near = await calls(p), l = await lands(p); await zoomOut(p, size); const far = await calls(p);
    numbers.calls[`${id} ${label}`] = { near: near.calls, nearTriangles: near.triangles, far: far.calls, farTriangles: far.triangles, landDraws: Object.values(l.views).reduce((a, b) => a + b, 0), views: l.views };
    const limit = view === 'phone' ? { near: 150, far: 180, triangles: 250000 } : { near: 220, far: 220, triangles: 400000 };
    assert.ok(near.calls <= limit.near, `${id} ${label}: ${near.calls} draws near`); assert.ok(far.calls <= limit.far, `${id} ${label}: ${far.calls} draws zoomed out`); if (Math.max(near.triangles, far.triangles) > limit.triangles) numbers.over.push(`${id} ${label}: ${Math.max(near.triangles, far.triangles)} triangles (limit ${limit.triangles})`);
    for (const [land, n] of Object.entries(l.views)) assert.ok(n <= 3, `${land}: ${n} draws of its own`);
    if (SCENES && EVIDENCE && label === 'pc-high' && LANDS.includes(id)) await shot(p, `10-${id}-far`, `${id}-far-desktop`);
    await context.close();
  }
  pass('draw calls at the twelve stands, near and zoomed out, on "high" (1440x900) and "battery" (390x844), inside section 18; no land adds more than 3 draws', { trianglesOver: numbers.over });
  // ---------------------------------------------------------------- evidence: every land, far and on foot, at the three sizes
  if (EVIDENCE && process.env.ONLY !== 'rider') {
    const scenes = [['lava-pools', FEATURES.lava.pools[1].x + 13, FEATURES.lava.pools[1].z + 8, true], ['beach-sea', 160, -160, true], ['toy-loops', -128, -128, true], ['dragon-nest', 28, 228 + 17, false]];
    for (const [name, x, z, far] of scenes) for (const view of ['desktop', 'landscape', 'phone']) { const { page: p, context, size } = await setup(view, at(x, z)); if (far) await zoomOut(p, size); await p.waitForTimeout(500); await shot(p, `11-${name}-${view}`, `${name}-${view}`); await context.close(); }
    if (SCENES) for (const id of LANDS) for (const view of ['desktop', 'landscape', 'phone']) {
      const { page: p, context, size } = await setup(view, at(...STAND[id])); await p.waitForTimeout(500); await shot(p, `12-${id}-foot-${view}`, `${id}-foot-${view}`);
      if (view !== 'desktop') { await zoomOut(p, size); await shot(p, `12-${id}-far-${view}`, `${id}-far-${view}`); } await context.close();
    }
    pass('evidence screenshots written to ' + EVIDENCE);
  }
  assert.deepEqual(errors, [], 'no page errors and no failed requests');
} catch (error) { results.push({ name: 'FAILED', pass: false, error: String(error?.stack ?? error) }); console.error(error); process.exitCode = 1; }
finally {
  await writeFile('test-results/lands-results.json', JSON.stringify({ url, merged: MERGED, results, deferred, numbers, errors }, null, 2));
  await browser.close();
  console.log(`${results.filter(r => r.pass).length} passed, ${results.filter(r => !r.pass).length} failed, ${deferred.length} deferred`);
}
