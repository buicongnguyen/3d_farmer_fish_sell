// The regions in a real browser (round 8; owner: builder A; spec 12.3): the rainbow ribbon, the banner on crossing a border,
// the ward as the one line between the village and the wilds, what a field tile costs to draw, the tile queue, stand-in
// shapes while a kit is on its way, and the village exactly as it was.
// Every row is true at A's own merge, with the stub tables of region-life.mjs, and stays true when builder B's tables land.
//   GAME_URL=http://127.0.0.1:4411 node tests/borders-browser.mjs      (GPU=1 for a real GPU)
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshState, SAVE_KEY } from '../src/game.mjs';
import { SAFE, WARD_OUTLINE } from '../src/ward.mjs';
import { BORDER_RUNS, REGION, regionAt } from '../src/regions.mjs';
import { DECOR, CARDS, RIM_KINDS } from '../src/region-life.mjs';
import { villageTrees } from '../src/village-plan.mjs';
import { HOMESTEAD } from '../src/field-layout.mjs';

const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome', headless: true, args: process.env.GPU ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const base = process.env.GAME_URL ?? 'http://127.0.0.1:4173', errors = [], results = []; await mkdir('test-results', { recursive: true });
const SCREENS = { phone: [390, 844], landscape: [844, 390], desktop: [1440, 900] };
const seed = (extra = {}) => Object.assign(freshState(), { started: true, coins: 5000, day: 1, time: 12, ...extra });
const HIGH = { ...freshState().settings, quality: 'high' };
async function setup(state, screen = 'desktop', { begin = true, route } = {}) {
  const [width, height] = SCREENS[screen], mobile = screen !== 'desktop';
  if (mobile) state.settings = { ...state.settings, quality: 'battery' };
  const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  await context.addInitScript(({ key, state }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state));
    const watch = () => { if (window.willowmere?.metrics().ready) { window.__boot = { ready: performance.now(), tiles: willowmere.metrics().tiles, pending: willowmere.metrics().tilesPending }; requestAnimationFrame(() => { window.__boot.frame = performance.now(); }); } else requestAnimationFrame(watch); }; requestAnimationFrame(watch);
  }, { key: SAVE_KEY, state });
  const page = await context.newPage(); page.setDefaultTimeout(90000); page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  if (route) await route(page);
  await page.goto(base); await page.waitForFunction(() => window.willowmere?.metrics().ready && window.willowmere.regions, null, { timeout: 180000 });
  if (begin) { await (mobile ? page.locator('#begin').tap() : page.locator('#begin').click()); await page.waitForTimeout(400); }
  return { page, context, width, height, mobile };
}
const metrics = p => p.evaluate(() => willowmere.metrics()), regions = p => p.evaluate(() => willowmere.regions());
const settled = p => p.waitForFunction(() => willowmere.metrics().tilesPending === 0, null, { timeout: 180000 });
const calls = async p => { await p.evaluate(() => willowmere.calls()); await p.waitForTimeout(400); return p.evaluate(() => willowmere.calls()); };
/** Hold a key until the player's region changes (or the time is up); returns the region reached. */
async function walkUntil(p, key, from, ms = 6000) {
  await p.keyboard.down(key);
  try { await p.waitForFunction(from => willowmere.metrics().region !== from, from, { timeout: ms }); } finally { await p.keyboard.up(key); }
  await p.waitForTimeout(250); return (await metrics(p)).region;
}
/** Counts the pixels of some colours in a part of the picture (a screenshot: the game's canvas keeps no drawing buffer to read). */
async function count(p, clip, colors, tolerance = 24) {
  const png = (await p.screenshot({ clip })).toString('base64');
  return p.evaluate(async ({ png, colors, tolerance }) => {
    const image = new Image(); image.src = 'data:image/png;base64,' + png; await image.decode();
    const c = document.createElement('canvas'); c.width = image.width; c.height = image.height; const g = c.getContext('2d'); g.drawImage(image, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data, want = Object.entries(colors).map(([name, hex]) => [name, [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))]), out = Object.fromEntries(want.map(([name]) => [name, 0]));
    for (let i = 0; i < d.length; i += 4) for (const [name, [r, gr, b]] of want) if (Math.abs(d[i] - r) < tolerance && Math.abs(d[i + 1] - gr) < tolerance && Math.abs(d[i + 2] - b) < tolerance) out[name]++;
    return out;
  }, { png, colors, tolerance });
}
const KINDS = id => DECOR[id].length;

try {
  // ---------------------------------------------------------------- 1. the ribbon: one mesh, 936 triangles, there with the box shut and open
  for (const box of [false, true]) {
    const { page: p, context } = await setup(seed({ position: { x: SAFE.x0 + 1.5, z: 6 }, pandora: box, settings: HIGH })); await settled(p);
    const r = await regions(p), quads = 11 * BORDER_RUNS.length + 24 + WARD_OUTLINE.length;
    assert.equal(BORDER_RUNS.length, 40); assert.equal(r.border.triangles, 2 * quads); assert.equal(r.border.triangles, 936); assert.ok(r.border.visible, `the ribbon is drawn with the box ${box ? 'open' : 'shut'}`);
    assert.equal(r.border.curtain, true, 'the outer shimmer on "high"');
    // The ribbon's own colours are on the screen beside the road: its violet and its red stripe, west of the player.
    const stripes = await count(p, { x: 300, y: 250, width: 700, height: 450 }, { violet: '#c66bff', red: '#ff4d5e', green: '#5fd66a' });
    assert.ok(stripes.violet > 200 && stripes.red > 200 && stripes.green > 200, `rainbow stripes on screen (${JSON.stringify(stripes)})`);
    if (!box) await p.screenshot({ path: 'test-results/borders-01-ward-west.png' });
    results.push({ name: `the ribbon, box ${box ? 'open' : 'shut'}`, triangles: r.border.triangles, stripes }); await context.close();
  }
  {
    // On "battery" the shimmer is off; the ribbon stays.
    const { page: p, context } = await setup(seed({ position: { x: 0, z: -300 } }), 'phone'); await settled(p);
    const r = await regions(p); assert.equal(r.border.curtain, false); assert.ok(r.border.visible); await context.close();
  }

  // ---------------------------------------------------------------- 2. exactly one banner on crossing the ward line and on crossing x = 192, box shut and open
  for (const box of [false, true]) {
    const { page: p, context } = await setup(seed({ position: { x: SAFE.x0 + 1.2, z: 6 }, pandora: box, hp: 100 })); await settled(p);
    let r = await regions(p); assert.equal(r.banner.count, 0, 'no banner on arriving'); assert.equal((await metrics(p)).region, 'village');
    assert.equal(await walkUntil(p, 'a', 'village'), 'west'); r = await regions(p);
    assert.equal(r.banner.count, 1, 'one banner on the way out'); assert.equal(r.banner.name, 'Mushroom Forest'); assert.ok(r.banner.showing);
    assert.equal(await p.locator('#region-banner strong').textContent(), 'Mushroom Forest');
    if (box) { assert.match(r.banner.detail, /^Wild creatures: /); assert.match(r.banner.chip, /^★ · Lv 1\+/); } else { assert.equal(r.banner.detail, ''); assert.equal(r.banner.chip, 'Peaceful · Lv 1+ when the box is open'); }
    const size = parseFloat(await p.locator('#region-banner strong').evaluate(e => getComputedStyle(e).fontSize)); assert.ok(size >= 28 && size <= 46, `title ${size}px`);
    assert.equal(await p.locator('#region-banner').evaluate(e => getComputedStyle(e).pointerEvents), 'none', 'the banner never takes a tap');
    await p.screenshot({ path: `test-results/borders-02-banner-${box ? 'open' : 'shut'}.png` });
    await p.waitForTimeout(3100); assert.equal((await regions(p)).banner.showing, false, 'gone after 2.8 s');
    assert.equal(await walkUntil(p, 'd', 'west'), 'village'); r = await regions(p);
    assert.equal(r.banner.count, 2); assert.equal(r.banner.name, 'Willowmere'); assert.equal(r.banner.chip, 'Safe');
    await p.waitForTimeout(600); assert.equal((await regions(p)).banner.count, 2, 'standing still shows nothing more');
    results.push({ name: `one banner each way across the ward line, box ${box ? 'open' : 'shut'}` }); await context.close();
  }
  for (const box of [false, true]) {
    const { page: p, context } = await setup(seed({ position: { x: 189.5, z: 12 }, pandora: box, hp: 100 })); await settled(p);
    assert.equal((await metrics(p)).region, 'east'); assert.equal((await regions(p)).banner.count, 0);
    assert.equal(await walkUntil(p, 'd', 'east'), 'shadow'); const r = await regions(p);
    assert.equal(r.banner.count, 1, 'one banner on crossing x = 192'); assert.equal(r.banner.name, 'Night Land');
    if (box) { assert.ok(r.banner.danger && r.banner.chip.startsWith('Dangerous · ★★★★★ · Lv 16+')); assert.equal(await p.locator('#region-banner span.danger').count(), 1); } else assert.equal(r.banner.chip, 'Peaceful · Lv 16+ when the box is open');
    await p.screenshot({ path: `test-results/borders-03-land-banner-${box ? 'open' : 'shut'}.png` });
    results.push({ name: `one banner on crossing into a land, box ${box ? 'open' : 'shut'}`, chip: r.banner.chip }); await context.close();
  }
  for (const screen of ['phone', 'landscape']) {
    // On a phone the title is 20 to 30 px and the whole banner is on the screen.
    const { page: p, context, width } = await setup(seed({ position: { x: -8, z: SAFE.z1 - 1.2 } }), screen); await settled(p);
    await p.evaluate(() => { const game = document.getElementById('game'); game.focus?.(); });
    assert.equal(await walkUntil(p, 's', 'village'), 'south'); const r = await regions(p); assert.equal(r.banner.count, 1); assert.equal(r.banner.name, 'Blue Lake Meadow');
    const boxes = await p.evaluate(() => { const b = document.getElementById('region-banner').getBoundingClientRect(), s = getComputedStyle(document.querySelector('#region-banner strong')); return { left: b.left, right: b.right, top: b.top, font: parseFloat(s.fontSize), page: document.documentElement.scrollWidth }; });
    assert.ok(boxes.font >= 20 && boxes.font <= 30, `phone title ${boxes.font}px`); assert.ok(boxes.left >= 0 && boxes.right <= width && boxes.page <= width, `the banner is on the screen (${JSON.stringify(boxes)})`);
    // Willowmere's phone HUD fills the top of the screen: the banner sits clear of the album card, the calendar, the minimap, the way-home card and the controls.
    const clash = await p.evaluate(() => { const b = document.getElementById('region-banner').getBoundingClientRect(); return ['#quest', '#calendar', '#map-canvas', '#map-caption', '#home-guide', '#joystick', '#touch-action', '#interact'].filter(sel => { const e = document.querySelector(sel); if (!e || !e.getClientRects().length) return false; const r = e.getBoundingClientRect(); return r.width > 0 && !(r.right <= b.left || r.left >= b.right || r.bottom <= b.top || r.top >= b.bottom); }); });
    assert.deepEqual(clash, [], `the banner covers nothing of the HUD on ${screen}`);
    await p.screenshot({ path: `test-results/borders-04-banner-${screen}.png` }); results.push({ name: `the banner on ${screen}`, ...boxes }); await context.close();
  }

  // ---------------------------------------------------------------- 3. the ward line is the one line: a step inside, a step outside, box open
  {
    const inside = await setup(seed({ position: { x: SAFE.x0 + .6, z: 6 }, pandora: true, hp: 100 })); await inside.page.waitForFunction(() => typeof willowmere.wilds === 'function'); await settled(inside.page);
    let w = await inside.page.evaluate(() => willowmere.wilds()); assert.equal(w.fighting, false); assert.equal(w.zone, null); assert.equal((await inside.page.evaluate(() => willowmere.map())).caption, 'WILLOWMERE');
    assert.equal(await inside.page.locator('#combat-pad:visible').count(), 0, 'no skill pad one step inside the ward'); await inside.context.close();
    const outside = await setup(seed({ position: { x: SAFE.x0 - .6, z: 6 }, pandora: true, hp: 100 })); await outside.page.waitForFunction(() => typeof willowmere.wilds === 'function'); await settled(outside.page);
    w = await outside.page.evaluate(() => willowmere.wilds()); assert.equal(w.fighting, true); assert.equal(w.zone, 'west'); assert.equal((await outside.page.evaluate(() => willowmere.map())).caption, 'MUSHROOM FOREST');
    assert.equal(await outside.page.locator('#combat-pad:visible').count(), 1, 'the skill pad one step outside'); await outside.context.close();
    results.push({ name: 'one step inside the ward: no fight; one step outside: the skill pad and the home region’s caption' });
  }

  // ---------------------------------------------------------------- 4. what a tile costs to draw
  {
    const stands = [['east', { x: 128, z: 0 }], ['centre', { x: 0, z: -8.8 }], ['rim', { x: 0, z: -300 }], ['west', { x: -128, z: 0 }], ['candy', { x: -128, z: 112 }]], seen = new Map();
    for (const [name, position] of stands) {
      const { page: p, context } = await setup(seed({ position, settings: HIGH })); await settled(p); const r = await regions(p), m = await metrics(p);
      assert.equal(m.tiles, 25); assert.equal(m.fields.loadedTiles, 25);
      for (const t of r.tiles) {
        const id = `${t.x},${t.z}`, centre = (t.x === -1 || t.x === 0) && (t.z === -1 || t.z === 0), land = t.regions.find(id => REGION[id].kind === 'land'), kinds = t.regions.filter(id => id !== 'village').reduce((n, id) => n + KINDS(id), 0);
        if (t.land) { assert.ok(t.draws <= 2 && t.shadowDraws === 0, `rim tile ${id}: ${t.draws} draws, ${t.shadowDraws} shadow`); assert.equal(t.blocking, 0); assert.equal(t.cards, 0); assert.equal(t.rim, RIM_KINDS[t.land].length ? 20 : 0); assert.equal(t.draws, t.rim ? 2 : 1); }
        else if (t.regions.length) {
          // The ground, one batch a blocking kind, one batch of cards. Three kinds a region (four on candy and ice), so 5 (6) main draws; a centre tile holds two home regions: 8.
          const limit = centre ? 8 : land === 'candy' || land === 'ice' ? 6 : 5;
          assert.ok(t.draws <= limit && t.draws <= 2 + kinds, `tile ${id} (${t.regions}): ${t.draws} main draws`); assert.ok(t.shadowDraws <= (centre ? 6 : 3), `tile ${id}: ${t.shadowDraws} shadow draws`);
          assert.ok(t.blocking <= 40 && t.cards <= 220);
        } else assert.equal(t.draws, 1, 'beyond the rim: bare ground only');
        seen.set(id, t);
      }
      const c = await calls(p); results.push({ name: `tiles round ${name}`, tiles: r.tiles.length, calls: c, mostDraws: Math.max(...r.tiles.map(t => t.draws)), triangles: r.tiles.reduce((n, t) => n + t.triangles, 0) });
      if (name === 'east') { await p.screenshot({ path: 'test-results/borders-05-east-128.png' }); results.at(-1).note = 'measureCalls() at (128, 0), box shut, default zoom, "high"'; }
      if (name === 'rim') { assert.ok(r.tiles.some(t => t.land === 'ice'), 'the rim beyond the Frost Land is loaded'); await p.screenshot({ path: 'test-results/borders-06-rim.png' }); }
      await context.close();
    }
    assert.ok([...seen.values()].some(t => t.land) && seen.has('0,0') && seen.has('-1,-1'));
  }

  // ---------------------------------------------------------------- 5. boot builds nine tiles and queues sixteen, one a frame; a jump builds its nine at once
  {
    const { page: p, context } = await setup(seed({ position: { x: 100, z: 100 } }), 'desktop', { begin: false });
    const boot = await p.evaluate(() => window.__boot); assert.ok(boot.tiles >= 9 && boot.tiles <= 12, `${boot.tiles} tiles at the first frame`); assert.ok(boot.tiles + boot.pending >= 25, `nine built, the rest queued (${JSON.stringify(boot)})`);
    await settled(p); const m = await metrics(p); assert.equal(m.tiles, 25); assert.equal(m.tilesPending, 0); assert.equal(m.fields.createdTiles, 25); assert.equal(m.fields.queued, 0);
    // Counted in the page: the number of tiles never grows by more than one from one frame to the next while the queue empties.
    const second = await setup(seed({ position: { x: -100, z: 100 } }), 'desktop', { begin: false });
    const steps = await second.page.evaluate(() => new Promise(resolve => { const seen = []; let last = willowmere.metrics().tiles; const tick = () => { const now = willowmere.metrics().tiles; if (now !== last) { seen.push(now - last); last = now; } if (now >= 25) resolve(seen); else requestAnimationFrame(tick); }; tick(); }));
    assert.ok(steps.every(n => n === 1), `one tile a frame (${steps})`); await second.context.close();
    results.push({ name: 'nine tiles at boot, sixteen queued, one a frame', boot: { tiles: boot.tiles, pending: boot.pending, ms: Math.round(boot.frame) }, steps: steps.length }); await context.close();
  }

  // ---------------------------------------------------------------- 6. a tile whose kit is on its way shows stand-in shapes, never bare ground, and fills when the kit lands
  {
    // Which kits are fetched depends on the tables: with step 0's stub tables every kind is in the shipped scenery kit and nothing waits.
    const stand = { x: -128, z: 0 }, fetched = t => t.kinds.filter(k => !k.startsWith('scenery/'));
    const gate = { open: null }, hold = new Promise(resolve => { gate.open = resolve; });
    const route = page => page.route(/\/assets\/models\/(wilds|worlds-[a-z]+)\.glb/, async r => { await hold; await r.continue(); });
    const { page: p, context } = await setup(seed({ position: stand }), 'desktop', { route });
    await p.waitForFunction(() => willowmere.metrics().fields.queued === 0, null, { timeout: 120000 }); await p.waitForTimeout(500);
    let r = await regions(p), here = r.tiles.filter(t => t.regions.includes('west')); const held = r.tiles.filter(t => fetched(t).length);
    assert.ok(r.tiles.every(t => t.draws === 1 + t.kinds.length + (t.cards ? 1 : 0)), 'no tile is bare ground: every kind is drawn, in its real shape or as a stand-in');
    for (const t of held) assert.ok(t.standIns === fetched(t).length && t.waiting.length === fetched(t).length, `tile ${t.x},${t.z}: stand-in shapes while its kit is held back (${t.standIns} of ${fetched(t).length})`);
    assert.equal((await metrics(p)).tilesPending, held.length, 'a tile is pending while it holds a stand-in');
    if (held.length) await p.screenshot({ path: 'test-results/borders-07-stand-ins.png' });
    const blocks = here.map(t => t.blocking); gate.open(); await settled(p); await p.waitForTimeout(600); r = await regions(p); here = r.tiles.filter(t => t.regions.includes('west'));
    assert.ok(r.tiles.every(t => t.standIns === 0 && t.waiting.length === 0), 'every tile is filled once its kits have landed'); assert.deepEqual(here.map(t => t.blocking), blocks, 'the pieces and their colliders did not move');
    assert.notEqual(r.glowPatched, false, 'the glow shader patch found its two places in three’s toon shader');
    await p.screenshot({ path: 'test-results/borders-08-filled.png' });
    results.push({ name: 'stand-ins while a kit is on its way, then filled', tilesHeld: held.length, kinds: [...new Set(held.flatMap(fetched))], cardKinds: (await metrics(p)).fields.cardKinds, note: held.length ? 'live' : 'the tables name no fetched kit yet: nothing waits (it goes live with builder B’s tables)' }); await context.close();
  }

  // ---------------------------------------------------------------- 7. the village is as it was: stumps, a fruit tree, a perch
  {
    const T = villageTrees(), beside = i => ({ x: T[i].x + 1.1, z: T[i].z + .8 });
    const { page: p, context } = await setup(seed({ cleared: [3, 127, 160], planted: { 127: { kind: 'apple', day: 1, picked: 0 } }, position: beside(3) })); await settled(p);
    const m = await metrics(p); assert.deepEqual([m.grove.stumps, m.grove.trees], [2, 1], 'two stumps (3 and 160) and one fruit tree (127), as on main');
    await p.waitForFunction(() => document.querySelector('#interact span')?.textContent === 'Plant a fruit tree', null, { timeout: 30000 });
    const s = await p.evaluate(() => willowmere.snapshot()); assert.deepEqual(s.cleared, [3, 127, 160]); assert.equal(s.planted[127].kind, 'apple');
    const perch = await p.evaluate(({ x, z }) => willowmere.perchNear(x, z, 40), HOMESTEAD); assert.ok(perch && Math.hypot(perch.x - HOMESTEAD.x, perch.z - HOMESTEAD.z) < 40, 'a bird can still perch on a village tree');
    assert.ok(T.some(t => Math.hypot(t.x - perch.x, t.z - perch.z) < .01), 'and it is one of the village’s own trees'); assert.equal(regionAt(perch.x, perch.z), 'village');
    // No field piece inside the ward: the four centre tiles hold fewer blocking pieces than a whole tile's table.
    const r = await regions(p); for (const t of r.tiles.filter(t => t.regions.includes('village'))) assert.ok(t.blocking < 12, `centre tile ${t.x},${t.z}: ${t.blocking}`);
    await p.screenshot({ path: 'test-results/borders-09-village.png' }); results.push({ name: 'the village as it was: stumps 3 and 160, the apple on 127, a perch by the homestead', grove: m.grove }); await context.close();
  }

  // ---------------------------------------------------------------- 8. the far view shows 6 of the 14 birds (3 on "battery"): each bird is three draws
  for (const [quality, cap] of [['high', 6], ['battery', 3]]) {
    const { page: p, context } = await setup(seed({ position: { x: 128, z: 0 }, settings: { ...freshState().settings, quality } })); await settled(p);
    let b = (await regions(p)).birds; assert.equal(b.count, 14); assert.equal(b.shown + b.resting, 14, 'near the ground every bird that is not resting is shown');
    const near = (await calls(p)).calls;
    await p.mouse.move(720, 450); for (let i = 0; i < 14; i++) await p.mouse.wheel(0, 400); await p.waitForTimeout(700);
    assert.ok((await metrics(p)).cameraTop > 28.5, 'zoomed right out'); b = (await regions(p)).birds; assert.ok(b.shown <= cap, `${b.shown} birds shown in the far view on "${quality}"`); assert.equal(b.count, 14);
    const far = (await calls(p)).calls;
    for (let i = 0; i < 14; i++) await p.mouse.wheel(0, -400); await p.waitForTimeout(700); b = (await regions(p)).birds; assert.equal(b.shown + b.resting, 14, 'and they are back when the view is near again');
    results.push({ name: `far view on "${quality}": ${cap} birds`, calls: { near, far } }); await context.close();
  }

  // ---------------------------------------------------------------- 9. boot time on a phone profile (recorded; tests/borders-measure.mjs compares it with round8 before A)
  {
    const runs = [];
    for (let i = 0; i < 3; i++) { const { page: p, context } = await setup(seed({ position: { x: 0, z: -8.8 } }), 'phone', { begin: false }); runs.push(Math.round((await p.evaluate(() => window.__boot)).frame)); await context.close(); }
    results.push({ name: 'boot to the first frame, 390 x 844, warm cache, no throttle (ms)', runs });
  }

  assert.deepEqual(errors, []);
  await writeFile('test-results/borders-results.json', JSON.stringify({ base, results, errors }, null, 2));
  console.log(JSON.stringify({ base, results, errors }, null, 2));
} finally { await browser.close(); }
