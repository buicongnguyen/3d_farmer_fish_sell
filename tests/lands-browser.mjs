// The lands in a real browser (round 8, builder B): each land's features drawn (one surface draw a land), what they do to
// the player with the box shut and open (lava, vents, the weather, trains, poison, ice, the sea, the Night Land's dark and
// its lamps), the land line of the HUD, and the draw calls at every land's stand point.
//
//   GAME_URL=http://127.0.0.1:4412 GPU=1 node tests/lands-browser.mjs
//   MERGED=1 …      after builders A and C are merged into round8: the checks that need their work become hard assertions
//                   (ponds and pools block; World.update drives step() and walk()). Without it they are reported as DEFERRED.
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


const url = process.env.GAME_URL ?? 'http://127.0.0.1:4412', MERGED = !!process.env.MERGED, EVIDENCE = process.env.EVIDENCE ?? '', SCENES = !!process.env.SCENES;
const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome', headless: true, args: process.env.GPU ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [], results = [], deferred = [], numbers = {};
await mkdir('test-results', { recursive: true }); if (EVIDENCE) await mkdir(EVIDENCE, { recursive: true });
const VIEWS = { desktop: { viewport: { width: 1440, height: 900 } }, phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, landscape: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true } };
const STAND = { west: [-128, 0], north: [0, -128], south: [0, 128], east: [128, 0], toy: [-128, -128], candy: [-128, 112], jungle: [-256, 0], ice: [0, -256], ocean: [128, -128], lava: [-20, 270], cloud: [128, 128], shadow: [256, 0] };
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

try {
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
    await p.waitForFunction(() => willowmere.snapshot().hp < 100, null, { timeout: 60000 });
    const first = await lands(p), start = await hp(p); await shot(p, '02-pool-open-start', 'lava-hp-before');
    await p.waitForFunction(until => willowmere.lands().time >= until, first.time + 2.2); await shot(p, '02-pool-open-2s', 'lava-hp-after-2s');
    await p.waitForFunction(until => willowmere.lands().time >= until, first.time + 2.9);
    const left = await hp(p), lost = 100 - left, toast = await toastText(p);
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
  }
  // ---------------------------------------------------------------- a toy train's pass moves you 2.2 m, and hurts only with the box open
  for (const box of [false, true]) {
    const track = FEATURES.toy.tracks[0], angle = Math.PI * .75, spot = { x: track.x + Math.cos(angle) * track.r, z: track.z + Math.sin(angle) * track.r };
    const { page: p, context } = await setup('desktop', at(spot.x, spot.z, s => { s.pandora = box; }));
    assert.equal(await lineText(p), 'Moving trains hurt explorers'); assert.equal((await lands(p)).views.toy, 2, 'Toybox Land: the rails and pond in one draw, the eight cars in another');
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
      assert.equal(style.hidden, false); assert.ok(Math.abs(style.opacity - .93) < .005, `the dark is at ${style.opacity} on foot (${view})`); assert.equal(style.mask, l.holes, 'one mask hole a light'); assert.ok(l.holes >= 1 && l.holes <= 16);
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
    if (MERGED) assert.equal(inside, false, 'a pond blocks a walker'); else if (inside) defer('a pond blocks walking and a tapped walk goes round it; a jeep stops at a lava pool’s bank', 'builder A: fields.mjs adds land-features blockers(id) to the world with each tile (blockers() is real and tested)'); else pass('a pond blocks a walker');
  }
  if (!MERGED) {
    defer('the fog and light crossfade into each land (home colour at the border, the land’s own from 24 m, still its own 2 m inside the outer edge)', 'builder C: applyLights reads LIGHTS (the rows are real and tested)');
    defer('no region tile adds more than 5 main and 3 shadow draws (6 on candy and ice); swamp reeds and pond reeds are different meshes; a lava rock’s glow attribute is non-zero', 'builder A: fieldTrees, fieldCards, loadKit and glow, reading DECOR, CARDS and KIT_TINTS');
    defer('a rider parked in a vent’s ring loses HP; the dark at 0.93 while riding in the far view', 'builder C: a ride seeded by the save (vehicles, riding) and the far-view camera; the rule itself is in tests/land-effects.test.mjs');
  }
  // ---------------------------------------------------------------- draw calls at every stand, near and zoomed out, both settings
  numbers.calls = {};
  for (const [label, view, quality] of [['pc-high', 'desktop', 'high'], ['phone-battery', 'phone', 'battery']]) for (const id of Object.keys(STAND)) {
    const { page: p, context, size } = await setup(view, at(...STAND[id], s => { s.settings.quality = quality; })); await p.waitForTimeout(900);
    const near = await calls(p), l = await lands(p); await zoomOut(p, size); const far = await calls(p);
    numbers.calls[`${id} ${label}`] = { near: near.calls, nearTriangles: near.triangles, far: far.calls, farTriangles: far.triangles, landDraws: Object.values(l.views).reduce((a, b) => a + b, 0), views: l.views };
    const limit = view === 'phone' ? { near: 150, far: 180, triangles: 250000 } : { near: 220, far: 220, triangles: 400000 };
    assert.ok(near.calls <= limit.near, `${id} ${label}: ${near.calls} draws near`); assert.ok(far.calls <= limit.far, `${id} ${label}: ${far.calls} draws zoomed out`); assert.ok(Math.max(near.triangles, far.triangles) <= limit.triangles, `${id} ${label}: ${far.triangles} triangles`);
    for (const [land, n] of Object.entries(l.views)) assert.ok(n <= 3, `${land}: ${n} draws of its own`);
    if (SCENES && EVIDENCE && label === 'pc-high' && LANDS.includes(id)) await shot(p, `10-${id}-far`, `${id}-far-desktop`);
    await context.close();
  }
  pass('draw calls and triangles at the twelve stands, near and zoomed out, on "high" (1440x900) and "battery" (390x844), inside section 18', {});
  // ---------------------------------------------------------------- evidence: every land, far and on foot, at the three sizes
  if (EVIDENCE) {
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
