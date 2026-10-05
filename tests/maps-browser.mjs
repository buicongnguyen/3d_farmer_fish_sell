// The maps in a real browser (round 8; owner: builder F): the round minimap and the Map window "The village & beyond".
//   1. the minimap: a true circle with you in the middle, NORTH UP (N at the top), the room plan indoors, the caption pill
//      whole on every screen, a tap opens the Map
//   2. borders on the minimap: the rainbow ribbon at a region line and at the ward line, the violet dashes with the box open
//   3. every nearby boss and titan: nine crowns on the rim at the village centre, at the bearings of spec 10.2, each with its
//      distance (the four nearest on the 96 px phone minimap: the rule the rim mock fixed); in reach on its spot; a titan violet
//   4. the Map window: opens on Village inside the ward and on Me outside it; wheel, pinch, drag, the five buttons and the keys
//      move the camera; the pan clamp at all four edges; World shows 13 fills and all 26 dens at one size; labels of 11 px and
//      more that never cover one another; a tap on a crown names it; the den list; nothing of it with the box shut
//   5. a downed boss grey with its timer; the sleeping dragon with its countdown
//   6. the twelve directory buttons still route
//   7. the prisons (padlock, key, gone) on both maps and in the den list; the nine titans violet at their live places (merge F)
//   GAME_URL=http://127.0.0.1:<port> node tests/maps-browser.mjs      (GPU=1 for a real GPU)
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshState, SAVE_KEY } from '../src/game.mjs';
import { DEN } from '../src/wilds.mjs';
import { SAFE } from '../src/ward.mjs';
import { projection, rimPoint, compass, COLORS, TERRAIN, ON_MAP } from '../src/minimap.mjs';
import { STAND } from './stands.mjs';
import { sheetProjection, sheetLimits, SHEET } from '../src/world-sheet.mjs';
import { REGION, REGION_IDS, DENS, squareOf } from '../src/regions.mjs';
import { mapFeatures } from '../src/land-features.mjs';
/** The Beach's sea on the sheet: builder B's sea row, in its own colour (merge F). */
const SEA_COLOR = mapFeatures('ocean').find(f => f.kind === 'sea').color;
import { CIVIC, PARKING, ROADS } from '../src/content.mjs';
import { LANES_GRAVEL } from '../src/lots.mjs';

const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome', headless: true, args: process.env.GPU ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const base = process.env.GAME_URL ?? 'http://127.0.0.1:4173', errors = [], results = []; await mkdir('test-results', { recursive: true });
const SCREENS = { phone: [390, 844], landscape: [844, 390], desktop: [1440, 900] };
const seed = (extra = {}) => Object.assign(freshState(), { started: true, coins: 5000, ...extra });
const home = (extra = {}) => seed({ coins: 3000, energy: 40, position: { x: 0, z: -8.8 }, upgrades: { farm: 1, pond: 1, pen: 1, house: 3, kitchen: 3 }, furniture: ['rug', 'sofa', 'plants', 'books', 'dining', 'art'], ...extra });
const tested = (extra = {}) => seed({ pandora: true, hp: 9999, settings: { ...freshState().settings, test: true }, gear: { ...freshState().gear, weapon: 'sword_obsidian' }, gearOwned: ['sword_obsidian'], ...extra });
async function setup(state, screen = 'desktop', scale = 1) {
  const [width, height] = SCREENS[screen], mobile = screen !== 'desktop';
  const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: scale });
  await context.addInitScript(({ key, state }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state)); }, { key: SAVE_KEY, state });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(base); await page.waitForFunction(() => window.willowmere?.metrics().ready, null, { timeout: 120000 }); await page.locator('#begin').click(); await page.waitForTimeout(400);
  // The terrain cache is built over the first frames; the maps below are read once it is whole.
  await page.waitForFunction(() => document.getElementById('map-canvas').__mini?.terrain === true, null, { timeout: 60000 });
  return { page, context, width, height, mobile };
}
const metrics = p => p.evaluate(() => willowmere.metrics());
const enter = async p => { await p.keyboard.press('e'); await p.waitForFunction(() => willowmere.metrics().location === 'interior', null, { timeout: 30000 }); await p.waitForTimeout(900); };
/** Pixels of a colour on a canvas: how many, their middle and their box (canvas pixels), optionally inside a box. */
const pixels = (p, selector, hex, tolerance = 22, box = null) => p.evaluate(({ selector, hex, tolerance, box }) => {
  const c = document.querySelector(selector), g = c.getContext('2d'), x0 = Math.max(0, Math.floor(box?.x0 ?? 0)), y0 = Math.max(0, Math.floor(box?.y0 ?? 0)), w = Math.min(c.width, Math.ceil(box?.x1 ?? c.width)) - x0, h = Math.min(c.height, Math.ceil(box?.y1 ?? c.height)) - y0;
  if (w <= 0 || h <= 0) return { n: 0, x: 0, y: 0, size: c.width };
  const d = g.getImageData(x0, y0, w, h).data, want = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  let n = 0, sx = 0, sy = 0, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200 && Math.abs(d[i] - want[0]) < tolerance && Math.abs(d[i + 1] - want[1]) < tolerance && Math.abs(d[i + 2] - want[2]) < tolerance) { const x = x0 + i / 4 % w, y = y0 + Math.floor(i / 4 / w); n++; sx += x; sy += y; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  return { n, x: n ? sx / n : 0, y: n ? sy / n : 0, minX, maxX, minY, maxY, size: c.width };
}, { selector, hex, tolerance, box });
const mini = p => p.evaluate(() => { const c = document.getElementById('map-canvas'), m = c.__mini; return { px: m.px, radius: m.radius, css: c.clientWidth, on: m.on, rim: m.rim.map(r => ({ id: r.id, x: r.x, y: r.y, far: r.far, text: r.text, labelled: r.labelled, size: r.size, s: r.s, lx: r.lx, ly: r.ly })) }; });
/** Opens the Map and waits for its sheet. */
async function openMap(p) { await p.locator('.minimap').click(); await p.waitForSelector('#large-map', { timeout: 15000 }); await p.waitForFunction(() => document.getElementById('large-map').__sheet?.terrain.ready, null, { timeout: 60000 }); await p.waitForTimeout(120); }
const sheet = p => p.evaluate(() => { const c = document.getElementById('large-map'), s = c.__sheet, r = c.getBoundingClientRect(); return { ...s, left: r.left + c.clientLeft, top: r.top + c.clientTop, bitmap: [c.width, c.height], box: [c.clientWidth, c.clientHeight] }; });
/** Waits for the sheet to be drawn again after an input, and returns it. */
async function after(p, act) { const before = (await sheet(p)).draws; await act(); await p.waitForFunction(n => document.getElementById('large-map').__sheet.draws > n, before, { timeout: 10000 }); await p.waitForTimeout(40); return sheet(p); }
const apart = (labels, where) => { for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) { const a = labels[i], b = labels[j]; assert.ok(!(Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2 * .9), `${where}: "${a.text}" over "${b.text}"`); } };
/** Beats a den's creature the way a player does (a tap on it; the fight runs on, three times as hard in test mode). */
async function fell(page, type, touch) {
  await page.waitForFunction(t => typeof willowmere.wilds === 'function' && willowmere.wilds().creatures.some(c => c.type === t), type, { timeout: 90000 });
  for (let i = 0; i < 60; i++) {
    const den = await page.evaluate(t => willowmere.metrics().dens.find(d => d.type === t), type); if (den.down) return den;
    const c = await page.evaluate(t => willowmere.wilds().creatures.find(c => c.type === t), type);
    if (c && c.hp > 0 && c.screen) { if (touch) await page.touchscreen.tap(c.screen.x, c.screen.y); else await page.mouse.click(c.screen.x, c.screen.y); }
    await page.waitForTimeout(1500);
  }
  return page.evaluate(t => willowmere.metrics().dens.find(d => d.type === t), type);
}

try {
  // ---------------------------------------------------------------- 1. the minimap: a true circle, centred on you, north up, the room plan indoors, a tap opens the Map
  for (const screen of ['desktop', 'phone', 'landscape']) {
    const { page: p, context } = await setup(home({ pandora: true, position: { x: 0, z: -8.8 } }), screen); await p.waitForTimeout(600);
    const look = () => p.evaluate(() => {
      const c = document.getElementById('map-canvas'), r = c.getBoundingClientRect(), cs = getComputedStyle(c), g = c.getContext('2d'), px = (x, y) => [...g.getImageData(x, y, 1, 1).data], n = document.getElementById('map-north').getBoundingClientRect(), b = document.querySelector('.minimap').getBoundingClientRect();
      return { w: r.width, h: r.height, radius: cs.borderRadius, corner: px(3, 3)[3], corner2: px(c.width - 4, c.height - 4)[3], centre: px(c.width / 2, c.height / 2), edge: px(c.width / 2, 6)[3], north: { x: (n.left + n.width / 2 - b.left) / b.width, y: (n.top + n.height / 2 - b.top) / b.height }, caption: document.getElementById('map-caption').textContent, map: willowmere.map() };
    });
    let m = await look(); assert.ok(Math.abs(m.w - m.h) < .5 && m.w >= 80, `${screen}: the canvas is square (${m.w} x ${m.h})`); assert.equal(m.radius, '50%'); assert.equal(m.corner, 0); assert.equal(m.corner2, 0); assert.equal(m.edge, 255, 'drawn out to the rim');
    assert.ok(m.centre[3] === 255 && m.centre[0] > 200 && m.centre[1] > 200 && m.centre[2] > 200, 'you are the white arrow in the middle'); assert.equal(m.caption, 'WILLOWMERE'); assert.equal(m.map.place, 'village');
    // North up, as the reference's minimap: N sits at the top of the rim and the map is not turned with the camera.
    assert.ok(Math.abs(m.north.x - .5) < .03 && m.north.y < .06, `${screen}: N is at the top of the rim (${m.north.x.toFixed(2)}, ${m.north.y.toFixed(2)})`); assert.equal(m.map.heading, 0);
    // The north road runs straight across the map (it would slant by 22 degrees on a map turned with the camera), and the pond lies east of the lane.
    const road = await pixels(p, '#map-canvas', COLORS.road, 14), P = projection({ x: 0, z: -8.8, heading: 0, radius: m.map.radius, size: road.size }), north = P.point(0, ROADS.north), south = P.point(0, ROADS.south);
    const strip = await pixels(p, '#map-canvas', COLORS.road, 14, { x0: 40, x1: 260, y0: north.y - 9, y1: north.y + 9 });
    assert.ok(strip.n > 220 * 6, `${screen}: the north road lies level across the map (${strip.n} px in its strip)`); assert.ok(Math.abs(strip.y - north.y) < 2 && Math.abs(strip.x - 150) < 16, 'a rim crown may cover an end of the strip'); assert.ok(south.y > 150 && north.y < 150 && road.n > strip.n);
    await enter(p); await p.waitForTimeout(500); m = await look(); assert.equal(m.caption, 'YOUR HOMESTEAD'); assert.equal(m.map.place, 'interior'); if (screen === 'phone' || screen === 'landscape') assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector('.minimap')).display), 'none', 'a phone folds the minimap away indoors: a tall one shows the whole house, a landscape one would cover its back wall'); else assert.ok(Math.abs(m.north.x - .5) < .03 && m.north.y < .06, 'north is straight up indoors'); assert.equal(m.corner, 0);
    assert.equal((await pixels(p, '#map-canvas', COLORS.boss)).n, 0, 'the room plan carries no crown');
    await context.close();
    // South of the village the caption names the region you stand in (the Blue Lake Meadow), and the map opens up.
    const f = await setup(home({ pandora: true, position: { x: 10, z: 95 } }), screen); await f.page.waitForFunction(() => willowmere.map().caption === 'BLUE LAKE MEADOW', null, { timeout: 30000 });
    const far = await f.page.evaluate(() => willowmere.map()); assert.ok(far.radius > 46 && far.radius <= 120, 'the map opens up in the fields');
    // The caption pill is whole on the screen and the page is no wider than the screen, for this region's name and for every other
    // (the longest, "BLUE LAKE MEADOW", used to be cut by 13 px on a 390 px phone and gave the page a sideways scroll).
    const pill = await f.page.evaluate(names => {
      const el = document.getElementById('map-caption'), mm = document.querySelector('.minimap').getBoundingClientRect(), was = el.textContent, out = { shown: getComputedStyle(el).display !== 'none', bad: [], live: null, short: null };
      const read = () => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width, scroll: document.documentElement.scrollWidth, inner: innerWidth, centre: (r.left + r.right) / 2 - (mm.left + mm.right) / 2 }; };
      out.live = { text: was, ...read() };
      if (out.shown) for (const name of names) { el.textContent = name; const r = read(); if (r.right > innerWidth - 2 || r.left < 0 || r.scroll > innerWidth) out.bad.push(`${name}: ${r.left.toFixed(1)}..${r.right.toFixed(1)} of ${innerWidth}, page ${r.scroll}`); if (name === 'NIGHT LAND') out.short = r; }
      el.textContent = was; return out;
    }, [...Object.values(REGION).map(r => r.name.toUpperCase()), 'BEYOND THE MAP', 'YOUR HOMESTEAD']);
    assert.equal(pill.live.text, 'BLUE LAKE MEADOW'); assert.ok(pill.live.scroll <= pill.live.inner, `${screen}: the page is no wider than the screen (${pill.live.scroll} of ${pill.live.inner})`);
    if (pill.shown) { assert.ok(pill.live.right <= pill.live.inner - 2 && pill.live.left >= 0, `${screen}: the caption is whole on the screen (${pill.live.left.toFixed(1)}..${pill.live.right.toFixed(1)} of ${pill.live.inner})`); assert.deepEqual(pill.bad, [], `${screen}: every region's caption fits`); assert.ok(Math.abs(pill.short.centre) < 1, `${screen}: a short caption is still centred under the minimap (${pill.short.centre.toFixed(2)} px off)`); }
    if (screen !== 'desktop') await f.page.screenshot({ path: `test-results/maps-00-caption-${screen}.png`, clip: { x: f.width - 220, y: 0, width: 220, height: Math.min(f.height, 260) } });
    await f.page.locator('.minimap').click(); await f.page.waitForSelector('#large-map', { timeout: 10000 }); assert.ok(await f.page.locator('#modal-title').count());
    if (screen === 'phone') await f.page.screenshot({ path: 'test-results/maps-01-map-phone.png' }); await f.context.close();
  }
  results.push({ name: 'the minimap is a true circle centred on you, north up with N at the top, the room plan indoors and the Map on a tap' });

  // ---------------------------------------------------------------- 2. borders on the minimap
  {
    // Box shut, in the Redrock Canyon 4 m east of its line with the Chomper Swamp (the north axis): the ribbon's red band runs straight up the map there.
    const line = await setup(seed({ position: { x: 4, z: -100 } })); await line.page.waitForTimeout(700);
    const map = await line.page.evaluate(() => willowmere.map()), P = projection({ x: 4, z: -100, radius: map.radius, size: 300 }), at = P.point(0, -100);
    const near = { x0: at.x - 14, x1: at.x + 14, y0: 70, y1: 215 }, red = await pixels(line.page, '#map-canvas', COLORS.band[0], 50, near), blue = await pixels(line.page, '#map-canvas', COLORS.band[2], 50, near), yellow = await pixels(line.page, '#map-canvas', COLORS.band[1], 26, near);
    assert.ok(red.n > 60 && blue.n > 60 && yellow.n > 60, `the three bands of the ribbon are drawn (${red.n}, ${yellow.n}, ${blue.n} px)`);
    assert.ok(Math.abs(red.x - at.x) < 6 && Math.abs(blue.x - at.x) < 6 && red.maxY - red.minY > 100, `a ribbon along the region line, 4 m west of you (red at x ${red.x.toFixed(1)}, the line at ${at.x.toFixed(1)})`);
    assert.ok(red.x < yellow.x + 3 && yellow.x < blue.x + 3 || red.x > yellow.x - 3 && yellow.x > blue.x - 3, 'red, yellow, blue side by side');
    assert.equal((await pixels(line.page, '#map-canvas', COLORS.ward, 12)).n, 0, 'no ward dashes with the box shut'); assert.equal((await pixels(line.page, '#map-canvas', COLORS.boss)).n, 0, 'and no crown');
    await line.page.locator('.minimap').screenshot({ path: 'test-results/maps-02-border-line.png' }); await line.context.close();
    // The ward line: always there as the village's own (half-width) ribbon; with the box open the violet dashes lie on it.
    for (const box of [false, true]) {
      const { page: p, context } = await setup(seed({ pandora: box, position: { x: SAFE.x1 - 12, z: 10 } })); await p.waitForTimeout(700);
      const m = await p.evaluate(() => willowmere.map()), W = projection({ x: SAFE.x1 - 12, z: 10, radius: m.radius, size: 300 }), edge = W.point(SAFE.x1, 10), band = { x0: edge.x - 10, x1: edge.x + 10, y0: 60, y1: 240 };
      const ribbon = await pixels(p, '#map-canvas', COLORS.band[0], 20, band), dashes = await pixels(p, '#map-canvas', COLORS.ward, 14, band);
      assert.ok(ribbon.n > 40 && Math.abs(ribbon.x - edge.x) < 5 && ribbon.maxY - ribbon.minY > 120, `box ${box ? 'open' : 'shut'}: the rainbow border runs down the ward's east line (${ribbon.n} px at x ${ribbon.x.toFixed(1)}, the line at ${edge.x.toFixed(1)})`);
      if (box) assert.ok(dashes.n > 40 && Math.abs(dashes.x - edge.x) < 4, `the violet dashes on the ward line (${dashes.n} px)`); else assert.equal(dashes.n, 0);
      await p.locator('.minimap').screenshot({ path: `test-results/maps-03-ward-${box ? 'open' : 'shut'}.png` }); await context.close();
    }
    results.push({ name: 'the minimap shows the rainbow border at a region line and at the ward line; the violet ward dashes only with the box open' });
  }

  // ---------------------------------------------------------------- 3. every boss and titan near you
  {
    const bearingOf = (d, at) => Math.atan2(d.x - at.x, -(d.z - at.z)), turn = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
    for (const screen of ['desktop', 'landscape', 'phone']) {
      const at = { x: 0, z: 0 }, { page: p, context } = await setup(tested({ position: at }), screen); await p.evaluate(() => willowmere.test.lavaEvent('normal')); await p.waitForTimeout(900);
      const m = await mini(p), half = 150;
      // Five rim crowns at the village centre: the four home bosses and the Mountain Turtle, nothing else within 160 m. Each at the bearing of its den: north is up.
      assert.deepEqual(m.rim.map(r => r.id.slice(6)), ['treant', 'croc', 'mushking', 'bear', 'titan_turtle'], `${screen}: the rim set of spec 6.2`); assert.deepEqual(m.on, []);
      for (const r of m.rim) { const d = DENS.find(o => o.id === r.id); assert.ok(turn(Math.atan2(r.x - half, -(r.y - half)), bearingOf(d, at)) < 1e-6, `${screen}: ${r.id} at its bearing`); assert.ok(Math.hypot(r.x - half, r.y - half) < half - r.s); }
      assert.deepEqual(m.rim.map(r => r.text), ['122', '122', '122', '122', '117']);
      // Sizes are in CSS pixels: a crown at least 5 px in radius, a distance at least 9 px high, whatever the minimap's size on the screen.
      assert.ok(m.rim.every(r => r.s / m.px >= 5 * .8 - 1e-6 && r.size / m.px >= 9 - 1e-6), `${screen}: marker and text sizes (${(m.rim[0].s / m.px).toFixed(1)} px, ${(m.rim[0].size / m.px).toFixed(1)} px at ${m.css} px across)`);
      // The rule the rim mock fixed: every marker carries its distance on the 150 and 120 px minimaps; on the 96 px one the four nearest do.
      const labelled = m.rim.filter(r => r.labelled).map(r => r.id.slice(6));
      if (m.css < 110) { assert.equal(labelled.length, 4, `${screen}: the four nearest carry their distance (${m.css} px across)`); assert.ok(labelled.includes('titan_turtle')); } else assert.equal(labelled.length, 5, `${screen}: all five carry their distance (${m.css} px across)`);
      // The pixels agree: five dark discs (four red, one violet for the titan) on the rim, a crown glyph in each.
      const boss = await pixels(p, '#map-canvas', COLORS.boss), titan = await pixels(p, '#map-canvas', COLORS.titan), turtle = m.rim.find(r => r.id === 'w:den:titan_turtle');
      assert.ok(boss.n > 4 * 40, `${screen}: the bosses' discs (${boss.n} px)`); assert.ok(titan.n > 30 && Math.hypot(titan.x - turtle.x, titan.y - turtle.y) < turtle.s, `${screen}: the titan is violet (${titan.n} px at ${titan.x.toFixed(0)}, ${titan.y.toFixed(0)})`);
      for (const r of m.rim.filter(r => !r.id.includes('titan'))) { const c = await pixels(p, '#map-canvas', COLORS.boss, 22, { x0: r.x - r.s, x1: r.x + r.s, y0: r.y - r.s, y1: r.y + r.s }); assert.ok(c.n > 20, `${screen}: a crown where ${r.id} rides the rim`); }
      await p.locator('.minimap').screenshot({ path: `test-results/maps-04-rim-${screen}.png` }); await context.close();
    }
    // At (40, 40): seven. At the Candy Land's stand, reach 120 m: five dens on their spots and four on the rim; the hydra's disc is violet and larger.
    const mid = await setup(tested({ position: { x: 40, z: 40 } })); await mid.page.evaluate(() => willowmere.test.lavaEvent('normal')); await mid.page.waitForTimeout(900);
    assert.deepEqual((await mini(mid.page)).rim.map(r => `${r.id.slice(6)} ${r.text}`), ['treant 151', 'croc 176', 'mushking 71', 'bear 116', 'titan_turtle 146', 'cake 148', 'robot 158']); await mid.context.close();
    const stand = { x: STAND.candy[0], z: STAND.candy[1] }, c = await setup(tested({ position: stand })); await c.page.evaluate(() => willowmere.test.lavaEvent('normal'));
    await c.page.waitForFunction(() => willowmere.map().radius === 120, null, { timeout: 30000 }); await c.page.waitForTimeout(500);
    const cm = await mini(c.page); assert.deepEqual(cm.on.map(id => id.slice(6)), ['gorilla', 'cake', 'gingerbread', 'jellyqueen', 'titan_hydra']); assert.deepEqual(cm.rim.map(r => `${r.id.slice(6)} ${r.text}`), ['treant 244', 'croc 364', 'mushking 130', 'bear 299']);
    const C = projection({ x: stand.x, z: stand.z, radius: 120, size: 300 }), hydra = C.point(DENS.find(d => d.type === 'titan_hydra').x, DENS.find(d => d.type === 'titan_hydra').z), cake = C.point(DENS.find(d => d.type === 'cake').x, DENS.find(d => d.type === 'cake').z), around = (pt, r) => ({ x0: pt.x - r, x1: pt.x + r, y0: pt.y - r, y1: pt.y + r });
    const violet = await pixels(c.page, '#map-canvas', COLORS.titan, 22, around(hydra, 16)), red = await pixels(c.page, '#map-canvas', COLORS.boss, 22, around(cake, 16));
    assert.ok(violet.n > 60 && red.n > 40 && Math.hypot(violet.x - hydra.x, violet.y - hydra.y) < 3 && Math.hypot(red.x - cake.x, red.y - cake.y) < 3, `the hydra on its spot in violet, the Cake King in red (${violet.n}, ${red.n} px)`);
    assert.ok(violet.maxX - violet.minX > (red.maxX - red.minX) * 1.15, `a titan's marker is larger (${violet.maxX - violet.minX} px across against ${red.maxX - red.minX})`);
    await c.page.locator('.minimap').screenshot({ path: 'test-results/maps-05-candy.png' }); await c.context.close();
    results.push({ name: 'every boss and titan near you: five on the rim at the village centre at their bearings with their distances, five on their spots at the Candy Land’s stand, the titan violet and larger' });
  }

  // ---------------------------------------------------------------- 4. the Map window
  for (const screen of ['desktop', 'phone']) {
    const touch = screen === 'phone', { page: p, context, width, height } = await setup(tested({ position: { x: 6, z: 30 }, defeated: { croc: true } }), screen, touch ? 2 : 1); await p.evaluate(() => willowmere.test.lavaEvent('normal')); await p.waitForTimeout(400);
    await openMap(p); let s = await sheet(p);
    // It opens on Village inside the ward. The sheet is the panel's width by min(width, 50dvh) on a portrait phone and by
    // min(0.7 width, 56vh) on a PC; its bitmap is that times the device's pixel ratio, so text is as large as it is drawn.
    assert.equal(s.preset, 'village', `${screen}: opens on Village inside the ward`); const L = sheetLimits(s.w, s.h);
    assert.ok(Math.abs(s.cam.k - L.kVillage) < 1e-6 && Math.abs(s.kMin - Math.min(s.w, s.h) / TERRAIN.size) < 1e-9 && s.kMax === 8);
    assert.deepEqual(s.bitmap, [Math.round(s.w * (touch ? 2 : 1)), Math.round(s.h * (touch ? 2 : 1))], `${screen}: the bitmap is the box times the pixel ratio`);
    if (touch) assert.ok(Math.abs(s.h - Math.min(s.w, height * .5)) < 9, `${screen}: ${s.w} x ${s.h}`); else assert.ok(Math.abs(s.h - Math.min(s.w * .7, height * .56)) < 9, `${screen}: ${s.w} x ${s.h}`);
    assert.equal(await p.locator('#large-map').evaluate(c => getComputedStyle(c).touchAction), 'none');
    // The Village preset: its thirteen names, every label 11 px or more and none over another; the Supermarket, its parking, a lane and the gate's spur are drawn.
    const places = s.labels.filter(l => l.kind === 'place').map(l => l.text).sort(); assert.deepEqual(places, ['Alder', 'Bell', 'Clinic', 'Finch', 'Hearth', 'Home', 'Moss', 'Police', 'Reed', 'School', 'Supermarket', 'Vale', 'Willow & Co.'].sort(), `${screen}: the village's thirteen names`);
    assert.ok(s.labels.every(l => l.size >= 11), `${screen}: no label under 11 px`); apart(s.labels, `${screen} Village`);
    const V = sheetProjection(s.cam, s.w, s.h), dpr = s.dpr, spot = (x, z, r = 2) => { const q = V.point(x, z); return { x0: (q.x - r) * dpr, x1: (q.x + r) * dpr, y0: (q.y - r) * dpr, y1: (q.y + r) * dpr }; };
    const market = CIVIC.find(c => c.id === 'supermarket'), lane = LANES_GRAVEL[0];
    for (const [what, color, x, z] of [['the Supermarket', COLORS.civic.supermarket, market.x - 3, market.z], ['its parking', COLORS.parking, (PARKING.x0 + PARKING.x1) / 2, PARKING.z0 + 2], ['a lane', COLORS.lane, lane.x, lane.z], ['the east gate\'s spur', COLORS.road, ROADS.east + 9, 0], ['the ring road', COLORS.road, 0, ROADS.south]])
      assert.ok((await pixels(p, '#large-map', color, 16, spot(x, z))).n > 4, `${screen}: ${what} is drawn on the Map`);
    assert.ok((await pixels(p, '#large-map', COLORS.ward, 14)).n > 60, 'the ward line while the box is open');
    await p.screenshot({ path: `test-results/maps-06-village-${screen}.png` });
    // The five buttons are 44 px or more and carry data-map. World: the whole world, at kMin.
    const buttons = await p.evaluate(() => [...document.querySelectorAll('[data-map]')].map(b => { const r = b.getBoundingClientRect(); return { name: b.dataset.map, w: r.width, h: r.height, action: b.dataset.action ?? null }; }));
    assert.deepEqual(buttons.map(b => b.name), ['world', 'village', 'me', 'out', 'in']); assert.ok(buttons.every(b => b.w >= 44 && b.h >= 44 && b.action === null), `${screen}: 44 px buttons`);
    s = await after(p, () => p.locator('[data-map="world"]').click()); assert.equal(s.preset, 'world'); assert.ok(Math.abs(s.cam.k - s.kMin) < 1e-9 && s.cam.cx === 0 && s.cam.cz === 0);
    assert.equal(await p.locator('[data-map="world"]').getAttribute('aria-pressed'), 'true'); assert.equal(await p.locator('[data-map="out"]').isDisabled(), true, 'nothing further out than the world');
    // Thirteen fills (twelve regions and the village) in the cache it blits; each square in its ground colour on the sheet; the border's bands.
    assert.equal(s.terrain.ready, true); assert.deepEqual([...s.terrain.fills].sort(), [...REGION_IDS.map(id => REGION[id].ground), COLORS.feature.sea].sort(), `${screen}: 13 fills and the Beach’s sea (builder B’s waterAt)`);
    const W = sheetProjection(s.cam, s.w, s.h);
    for (const id of REGION_IDS) { if (id === 'village') continue; const sq = squareOf(id); let seen = 0; for (const [dx, dz] of [[46, 46], [-46, 46], [46, -46], [-46, -46], [0, 50], [50, 0], [-50, 0], [0, -50]]) { const q = W.point(sq.cx + dx, sq.cz + dz); const at = { x0: (q.x - 1.5) * dpr, x1: (q.x + 1.5) * dpr, y0: (q.y - 1.5) * dpr, y1: (q.y + 1.5) * dpr }; seen += (await pixels(p, '#large-map', REGION[id].ground, 10, at)).n > 0 || id === 'ocean' && (await pixels(p, '#large-map', SEA_COLOR, 10, at)).n > 0 ? 1 : 0; } assert.ok(seen >= 3, `${screen}: ${id} in its ground colour (${seen} of 8 points)`); }
    const edge = W.point(-296, 0), far = W.point(296, 0), top = W.point(0, -296); assert.ok(edge.x >= -1e-6 && far.x <= s.w + 1e-6 && top.y >= -1e-6, 'the whole disc is on the sheet');
    const bands = await pixels(p, '#large-map', COLORS.casingOuter, 45, { x0: 0, x1: s.w * dpr, y0: (top.y - 4) * dpr, y1: (top.y + 4) * dpr }); assert.ok(bands.n > 30, `${screen}: the world's edge is drawn (${bands.n} px of its casing along the Frost Land's north side)`);
    // All 26 dens, every one the same size at this zoom and at k = 4: crown r 8, titan r 10.4 (CSS pixels).
    const densOn = s => s.markers.filter(m => m.kind === 'boss' || m.kind === 'titan'); let marks = densOn(s);
    assert.equal(marks.length, 26, `${screen}: every boss and titan on the World preset`); assert.ok(marks.every(m => m.r === (m.kind === 'titan' ? SHEET.titan : SHEET.crown)));
    for (const m of marks) { const d = DENS.find(o => o.id === m.id), q = W.point(d.x, d.z); assert.ok(Math.hypot(m.x - q.x, m.y - q.y) < .01 && m.x > 0 && m.x < s.w && m.y > 0 && m.y < s.h, m.id); }
    const around = (m, r) => ({ x0: (m.x - r) * dpr, x1: (m.x + r) * dpr, y0: (m.y - r) * dpr, y1: (m.y + r) * dpr }), hydra = marks.find(m => m.id === 'w:den:titan_hydra'), cake = marks.find(m => m.id === 'w:den:cake');
    const size = async (m, color) => { const c = await pixels(p, '#large-map', color, 22, around(m, 13)); return (c.maxX - c.minX + 1) / dpr; };
    const wide = { boss: await size(cake, COLORS.boss), titan: await size(hydra, COLORS.titan) }; assert.ok(Math.abs(wide.boss - 14.4) < 2 && Math.abs(wide.titan - 18.7) < 2 && wide.titan > wide.boss * 1.15, `${screen}: a crown 16 px across and a titan's 20.8 at kMin, less the ring that overlaps their rim (${wide.boss}, ${wide.titan})`);
    assert.ok(s.labels.every(l => l.size >= 11), `${screen}: World: no label under 11 px`); apart(s.labels, `${screen} World`);
    assert.ok(s.labels.filter(l => l.kind === 'region').length >= (touch ? 9 : 12), `${screen}: the regions are named on the World preset (${s.labels.filter(l => l.kind === 'region').length} of 12; a name with no room clear of the crowns is left out)`); assert.ok(s.labels.some(l => l.kind === 'timer'), 'the sleeping dragon carries its countdown on the sheet'); assert.equal(s.countdown, true);
    await p.screenshot({ path: `test-results/maps-07-world-${screen}.png` });
    // A tap on a crown names it under the sheet; a tap on bare ground clears the line.
    const croc = marks.find(m => m.id === 'w:den:croc'); s = await after(p, () => touch ? p.touchscreen.tap(s.left + croc.x + 3, s.top + croc.y - 2) : p.mouse.click(s.left + croc.x + 3, s.top + croc.y - 2));
    assert.equal(s.picked, 'w:den:croc'); assert.match(await p.locator('#map-pick').innerText(), /^♛ Crocodile King · Lv 10 · Chomper Swamp · 1[45]\d m north(-west)?$/); assert.equal(s.preset, 'world', 'a tap does not move the sheet');
    await p.screenshot({ path: `test-results/maps-08-picked-${screen}.png` });
    // The wheel zooms on the cursor: the world point under it stays under it.
    const box = { x: s.left, y: s.top }, wheelAt = { x: s.w * .7, y: s.h * .3 };
    if (!touch) {
      s = await after(p, () => p.locator('[data-map="village"]').click()); const kv = s.cam.k, under = sheetProjection(s.cam, s.w, s.h).world(wheelAt.x, wheelAt.y);
      await p.mouse.move(box.x + wheelAt.x, box.y + wheelAt.y); s = await after(p, () => p.mouse.wheel(0, -400));
      assert.ok(Math.abs(s.cam.k - kv * Math.exp(400 * .0015)) < 1e-6, `the wheel: k ${s.cam.k}`); assert.equal(s.preset, ''); const now = sheetProjection(s.cam, s.w, s.h).point(under.x, under.z); assert.ok(Math.hypot(now.x - wheelAt.x, now.y - wheelAt.y) < .5, `anchored on the cursor (${now.x.toFixed(1)}, ${now.y.toFixed(1)} against ${wheelAt.x.toFixed(1)}, ${wheelAt.y.toFixed(1)})`);
      assert.equal(await p.evaluate(() => document.querySelector('.modal-content').scrollTop), 0, 'the wheel over the sheet does not scroll the panel');
      s = await after(p, () => p.mouse.wheel(0, 400)); assert.ok(Math.abs(s.cam.k - kv) < 1e-6);
      for (let i = 0; i < 12 && s.cam.k > s.kMin + 1e-9; i++) s = await after(p, () => p.mouse.wheel(0, 600)); assert.ok(Math.abs(s.cam.k - s.kMin) < 1e-9 && s.cam.cx === 0 && s.cam.cz === 0, 'wheeled all the way out: the whole world, centred');
      // A drag pans: the sheet follows the pointer.
      s = await after(p, () => p.locator('[data-map="village"]').click()); const c0 = { ...s.cam };
      await p.mouse.move(box.x + s.w / 2, box.y + s.h / 2); await p.mouse.down(); await p.mouse.move(box.x + s.w / 2 + 60, box.y + s.h / 2 - 40, { steps: 5 }); s = await after(p, () => p.mouse.up().then(() => p.locator('#large-map').focus()).then(() => p.keyboard.press('ArrowLeft')).then(() => p.keyboard.press('ArrowRight')));
      assert.ok(Math.abs(s.cam.cx - (c0.cx - 60 / c0.k)) < 2.5 / c0.k + 1e-6 && Math.abs(s.cam.cz - (c0.cz + 40 / c0.k)) < 2.5 / c0.k + 1e-6, `a drag of (60, -40) px moves the centre by (-60, 40) px (${(s.cam.cx - c0.cx).toFixed(2)}, ${(s.cam.cz - c0.cz).toFixed(2)} m at ${c0.k.toFixed(2)} px a metre)`); assert.equal(s.cam.k, c0.k);
    } else {
      // A pinch (two fingers through the browser's own touch input) zooms on their midpoint; one finger drags.
      const cdp = await context.newCDPSession(p), mid = { x: box.x + s.w / 2, y: box.y + s.h / 2 }, fingers = d => [{ x: mid.x - d, y: mid.y, id: 1 }, { x: mid.x + d, y: mid.y, id: 2 }], under = W.world(s.w / 2, s.h / 2);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: fingers(30) });
      for (const d of [40, 50, 60, 75, 90]) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: fingers(d) }); await p.waitForTimeout(30); }
      s = await after(p, () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }).then(() => p.locator('[data-map="in"]').click()).then(() => p.locator('[data-map="out"]').click()));
      assert.ok(s.cam.k > s.kMin * 2.6 && s.cam.k < s.kMin * 3.4, `a pinch from 60 to 180 px apart triples the zoom (${(s.cam.k / s.kMin).toFixed(2)}x)`); const now = sheetProjection(s.cam, s.w, s.h).point(under.x, under.z); assert.ok(Math.hypot(now.x - s.w / 2, now.y - s.h / 2) < 3, 'anchored on the midpoint');
      assert.equal(s.picked, 'w:den:croc', 'a pinch is not a tap');
      const c0 = { ...s.cam }; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: mid.x, y: mid.y, id: 1 }] });
      for (const d of [10, 20, 30, 40]) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: mid.x + d, y: mid.y + d / 2, id: 1 }] }); await p.waitForTimeout(30); }
      s = await after(p, () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }).then(() => p.locator('[data-map="in"]').click()).then(() => p.locator('[data-map="out"]').click()));
      assert.ok(s.cam.cx < c0.cx - 20 / c0.k && s.cam.cz < c0.cz - 8 / c0.k, `a one-finger drag pans (${(s.cam.cx - c0.cx).toFixed(1)}, ${(s.cam.cz - c0.cz).toFixed(1)} m)`); assert.ok(Math.abs(s.cam.k - c0.k) < 1e-6);
      assert.equal(await p.evaluate(() => scrollY), 0, 'the page did not scroll under the fingers');
    }
    // The buttons: + and − step the zoom about the middle; Village and Me are presets.
    s = await after(p, () => p.locator('[data-map="world"]').click()); const k0 = s.cam.k;
    s = await after(p, () => p.locator('[data-map="in"]').click()); assert.ok(Math.abs(s.cam.k - k0 * 1.6) < 1e-6 && s.preset === '');
    s = await after(p, () => p.locator('[data-map="out"]').click()); assert.ok(Math.abs(s.cam.k - k0) < 1e-6);
    s = await after(p, () => p.locator('[data-map="me"]').click()); assert.equal(s.preset, 'me'); assert.ok(Math.abs(s.cam.cx - 6) < .01 && Math.abs(s.cam.cz - 30) < .01 && Math.abs(s.cam.k - Math.min(s.w, s.h) / 192) < 1e-6, 'Me: 192 m across, on you');
    s = await after(p, () => p.locator('[data-map="village"]').click()); assert.equal(s.preset, 'village');
    // The keys: + and −, the arrows, 0 for World, Home for Village.
    await p.locator('#large-map').focus(); const v0 = { ...s.cam };
    s = await after(p, () => p.keyboard.press('+')); assert.ok(Math.abs(s.cam.k - v0.k * 1.6) < 1e-6, 'the + key');
    s = await after(p, () => p.keyboard.press('-')); assert.ok(Math.abs(s.cam.k - v0.k) < 1e-6, 'the − key');
    s = await after(p, () => p.keyboard.press('ArrowRight')); assert.ok(s.cam.cx > v0.cx + 1 && Math.abs(s.cam.cz - v0.cz) < 1e-6, 'the right arrow looks east');
    s = await after(p, () => p.keyboard.press('ArrowDown')); assert.ok(s.cam.cz > v0.cz + 1, 'the down arrow looks south');
    s = await after(p, () => p.keyboard.press('ArrowLeft')); s = await after(p, () => p.keyboard.press('ArrowUp')); assert.ok(Math.abs(s.cam.cx - v0.cx) < 1e-6 && Math.abs(s.cam.cz - v0.cz) < 1e-6, 'left and up bring it back');
    s = await after(p, () => p.keyboard.press('0')); assert.equal(s.preset, 'world', 'the 0 key'); s = await after(p, () => p.keyboard.press('Home')); assert.equal(s.preset, 'village', 'the Home key');
    // The pan clamp at all four edges: the centre stops 336 m less half the view from the middle.
    s = await after(p, () => p.keyboard.press('+')); assert.ok(s.cam.k > 3 && s.w / s.cam.k < 300, 'zoomed in: the view is far smaller than the world');
    for (const [key, axis, sign] of [['ArrowLeft', 'cx', -1], ['ArrowUp', 'cz', -1], ['ArrowRight', 'cx', 1], ['ArrowDown', 'cz', 1]]) {
      const limit = TERRAIN.half - (axis === 'cx' ? s.w : s.h) / 2 / s.cam.k; let guard = 0;
      while (Math.abs(s.cam[axis] - sign * limit) > 1e-6 && guard++ < 80) s = await after(p, () => p.keyboard.press(key));
      assert.ok(Math.abs(s.cam[axis] - sign * limit) < 1e-6, `${screen}: the ${key} edge: ${s.cam[axis]} (limit ${sign * limit})`); await p.keyboard.press(key); await p.waitForTimeout(80); assert.ok(Math.abs((await sheet(p)).cam[axis] - sign * limit) < 1e-6, 'and no further');
    }
    // Zoomed in on the Candy Land: the same crown sizes on the glass, the full name with its stars and level, den names.
    s = await after(p, () => p.locator('[data-map="world"]').click());
    const candy = sheetProjection(s.cam, s.w, s.h).point(...STAND.candy);
    if (!touch) { await p.mouse.move(box.x + candy.x, box.y + candy.y); for (let i = 0; i < 30 && s.cam.k < 3.99; i++) s = await after(p, () => p.mouse.wheel(0, -Math.min(300, Math.log(4 / s.cam.k) / .0015))); }
    else { for (let i = 0; i < 8 && s.cam.k < 3.5; i++) s = await after(p, () => p.locator('[data-map="in"]').click()); for (const key of ['ArrowLeft', 'ArrowDown']) for (let i = 0; i < 14; i++) { const P4 = sheetProjection(s.cam, s.w, s.h).point(...STAND.candy); if (key === 'ArrowLeft' ? P4.x > s.w * .4 : P4.y < s.h * .6) break; s = await after(p, () => p.keyboard.press(key)); } }
    marks = densOn(s); assert.ok(s.cam.k > 3.4 && marks.length >= 1 && marks.length < 26, `${screen}: zoomed in to ${s.cam.k.toFixed(2)} px a metre, ${marks.length} dens in view`); assert.ok(marks.every(m => m.r === (m.kind === 'titan' ? SHEET.titan : SHEET.crown)));
    const near = marks.find(m => m.kind === 'boss' && m.x > 14 && m.x < s.w - 14 && m.y > 14 && m.y < s.h - 14); if (near) { const across = await size(near, COLORS.boss); assert.ok(Math.abs(across - wide.boss) < 14, `${screen}: a crown is as large at k = ${s.cam.k.toFixed(1)} as at kMin (${across} px against ${wide.boss})`); }
    assert.ok(s.labels.some(l => l.kind === 'region' && l.text === 'Candy Land') && s.labels.some(l => l.kind === 'level' && /★★★ · Lv 7\+|Lv 7\+/.test(l.text)), `${screen}: ${s.labels.map(l => l.text).join(', ')}`);
    // A den well inside the sheet carries its name at this zoom (one at the sheet's edge has no room for it).
    if (marks.some(m => m.x > 110 && m.x < s.w - 110 && m.y > 30 && m.y < s.h - 40)) assert.ok(s.labels.some(l => l.kind === 'den'), `${screen}: den names at k ${s.cam.k.toFixed(1)}: ${s.labels.map(l => l.text).join(', ')}`);
    assert.ok(s.labels.every(l => l.size >= 11)); apart(s.labels, `${screen} k4`); await p.screenshot({ path: `test-results/maps-09-k4-${screen}.png` });
    // The den list under the sheet: a row for every den with its name, level and distance, grouped by region, yours first; a tick for one beaten before.
    const rows = await p.evaluate(() => [...document.querySelectorAll('.den-row[data-den]')].map(r => ({ id: r.dataset.den, text: r.innerText.replace(/\s+/g, ' ').trim(), group: r.closest('.den-group').dataset.region, title: r.closest('.den-group').querySelector('h4').innerText.replace(/\s+/g, ' ').trim(), done: !!r.querySelector('.den-done'), down: r.classList.contains('down') })));
    assert.equal(rows.length, 26, `${screen}: 26 rows`); assert.deepEqual(rows.map(r => r.id), ['west', 'north', 'south', 'east', 'toy', 'candy', 'jungle', 'ice', 'ocean', 'lava', 'cloud', 'shadow'].flatMap(id => DENS.filter(d => d.region === id).map(d => d.id)), 'grouped by region');
    const row = id => rows.find(r => r.id === id), farTo = d => Math.round(Math.hypot(d.x - 6, d.z - 30)), way = d => compass(d.x - 6, d.z - 30), turtleDen = DENS.find(d => d.type === 'titan_turtle');
    assert.equal(row('w:den:bear').text, `♛ King Bear Lv 13 ${farTo(DEN)} m ${way(DEN)}`); assert.equal(row('w:den:bear').title, 'Redrock Canyon ★★★ · Lv 7+'); assert.equal(row('w:den:titan_turtle').text, `♛ Ancient Mountain Turtle Lv 13 · titan ${farTo(turtleDen)} m ${way(turtleDen)}`);
    assert.match(row('w:den:croc').text, /^♛ Crocodile King Lv 10 ✓ \d+ m [a-z-]+$/); assert.equal(row('w:den:croc').done, true, 'a tick for a kind beaten before'); assert.equal(rows.filter(r => r.done).length, 1);
    assert.match(row('w:den:dragon').text, /^♛ Volcano Dragon Lv 19 away, next visit in \d+:\d\d$/); assert.equal(row('w:den:dragon').down, true); assert.equal(rows.filter(r => r.down).length, 1);
    assert.equal(await p.locator('.legend-den').count(), 1); assert.equal(await p.locator('.legend-titan').count(), 1); assert.equal(await p.locator('.legend-cage').count(), 1); assert.equal(await p.locator('.legend-boss').count(), 0, 'the single King Bear line is gone');
    await p.locator('.den-list').scrollIntoViewIfNeeded(); await p.waitForTimeout(150); await p.screenshot({ path: `test-results/maps-10-denlist-${screen}.png` });
    // Closed and opened again it starts from its opening preset.
    await p.keyboard.press('Escape'); await p.waitForFunction(() => document.getElementById('modal-backdrop').hidden); await openMap(p); s = await sheet(p); assert.equal(s.preset, 'village', 'opened again: Village'); assert.equal(s.picked, '');
    await context.close();
    // Outside the ward it opens on Me: centred on you, 192 m across.
    const out = await setup(tested({ position: { x: STAND.east[0], z: STAND.east[1] } }), screen, touch ? 2 : 1); await openMap(out.page); const o = await sheet(out.page);
    assert.equal(o.preset, 'me', `${screen}: opens on Me outside the ward`); assert.ok(Math.abs(o.cam.cx - STAND.east[0]) < .5 && Math.abs(o.cam.cz - STAND.east[1]) < .5 && Math.abs(o.cam.k - Math.min(o.w, o.h) / 192) < 1e-6);
    const you = o.markers.find(m => m.kind === 'you'); assert.ok(Math.abs(you.x - o.w / 2) < 2 && Math.abs(you.y - o.h / 2) < 2 && you.r === 9, 'you in the middle');
    assert.ok(o.labels.some(l => l.kind === 'region' && /Redrock Canyon|Canyon/.test(l.text))); assert.ok(o.labels.every(l => l.size >= 11)); apart(o.labels, `${screen} Me`);
    assert.equal(await out.page.evaluate(() => document.querySelector('.den-group').dataset.region), 'east', 'the den list starts with the region you stand in');
    await out.page.screenshot({ path: `test-results/maps-11-me-${screen}.png` }); await out.context.close();
    // Box shut: fills, borders, names and levels; no crown, no badge, no den list.
    const shut = await setup(seed({ position: { x: 6, z: 30 } }), screen, touch ? 2 : 1); assert.equal((await pixels(shut.page, '#map-canvas', COLORS.boss)).n, 0, 'no crown on the minimap while the box is shut'); assert.deepEqual((await mini(shut.page)).rim, []);
    await shut.page.keyboard.press('m'); await shut.page.waitForSelector('#large-map'); await shut.page.waitForFunction(() => document.getElementById('large-map').__sheet?.terrain.ready, null, { timeout: 60000 });
    const q = await after(shut.page, () => shut.page.locator('[data-map="world"]').click());
    assert.deepEqual([...new Set(q.markers.map(m => m.kind))].sort(), ['home', 'vehicle', 'you'], `${screen}: box shut: no den and no cage on the Map (home, the parked jeep and motorcycle, and you)`); assert.equal((await pixels(shut.page, '#large-map', COLORS.boss)).n, 0); assert.equal((await pixels(shut.page, '#large-map', COLORS.titan)).n, 0); assert.equal((await pixels(shut.page, '#large-map', COLORS.ward, 12)).n, 0);
    assert.equal(await shut.page.locator('.den-list').count(), 0); assert.equal(await shut.page.locator('.legend-den').count(), 0); assert.equal(q.countdown, false);
    assert.equal(q.labels.filter(l => l.kind === 'region').length, 12); assert.equal(q.labels.filter(l => l.kind === 'level').length, 12, `${screen}: box shut: every region's name and level`); apart(q.labels, `${screen} World shut`);
    await shut.page.screenshot({ path: `test-results/maps-12-world-shut-${screen}.png` }); await shut.context.close();
  }
  results.push({ name: 'the Map window: opens on Village or Me; wheel, pinch, drag, buttons and keys move it; the clamp holds at four edges; 13 fills, 26 dens of one size, labels of 11 px that never overlap; a tap names a crown; the den list; nothing of it with the box shut' });

  // ---------------------------------------------------------------- 5. a downed boss with its timer; the sleeping dragon
  {
    const { page: p, context } = await setup(tested({ position: { x: 118, z: -58 } })); await p.evaluate(() => willowmere.test.lavaEvent('normal'));
    const beaten = await fell(p, 'bear', false);
    assert.equal(beaten.down, true, 'the King Bear is beaten'); assert.ok(beaten.left > 20 && beaten.left <= 90, `back in ${beaten.left.toFixed(0)} s`); await p.waitForTimeout(500);
    // The minimap: a grey crown on his den with the timer under it, no dark red one there.
    const m = await mini(p), map = await p.evaluate(() => willowmere.map()), me = (await metrics(p)).position, P = projection({ x: me.x, z: me.z, radius: map.radius, size: 300 }), den = P.point(DEN.x, DEN.z);
    assert.ok(m.on.includes('w:den:bear')); const grey = await pixels(p, '#map-canvas', '#b5b1ba', 34, { x0: den.x - 14, x1: den.x + 14, y0: den.y - 14, y1: den.y + 14 }), red = await pixels(p, '#map-canvas', COLORS.boss, 16, { x0: den.x - 9, x1: den.x + 9, y0: den.y - 9, y1: den.y + 9 });
    assert.ok(grey.n > 30 && red.n === 0, `a grey crown on the den (${grey.n} grey px, ${red.n} red)`);
    await p.locator('.minimap').screenshot({ path: 'test-results/maps-13-minimap-bear-down.png' });
    // The Map: grey, with its timer on the sheet and "resting, back in" in his row, with the tick of a kind beaten.
    await openMap(p); const s = await sheet(p), mark = s.markers.find(k => k.id === 'w:den:bear'); assert.equal(mark.down, true); assert.ok(s.labels.some(l => l.kind === 'timer' && /^[01]:\d\d$/.test(l.text)), `a timer on the sheet (${s.labels.filter(l => l.kind === 'timer').map(l => l.text)})`);
    const text = (await p.locator('.den-row[data-den="w:den:bear"]').innerText()).replace(/\s+/g, ' ').trim(); assert.match(text, /King Bear Lv 13 ✓ resting, back in [01]:\d\d · (right here|\d+ m [a-z-]+)$/); assert.ok(await p.locator('.den-row[data-den="w:den:bear"].down').count());
    await p.screenshot({ path: 'test-results/maps-14-map-bear-down.png' }); await context.close();
    results.push({ name: 'a downed boss is grey with its return timer on the minimap, on the Map and in the den list', left: beaten.left });
    // The dragon: asleep (grey on its nest, a countdown) until its event; here (an orange ring, no countdown) while the lava weather says "dragon".
    const nestDen = DENS.find(k => k.event === 'dragon'), d = await setup(tested({ position: { x: nestDen.x, z: nestDen.z + 25 } })); await d.page.evaluate(() => willowmere.test.lavaEvent('normal')); await d.page.waitForFunction(() => document.getElementById('map-canvas').__mini.on.includes('w:den:dragon'), null, { timeout: 30000 }); await d.page.waitForTimeout(400);
    const nest = (await metrics(d.page)).dens.find(k => k.event === 'dragon'); assert.equal(nest.down, true); assert.ok(nest.left > 0 && nest.left < 3600 * 6, `the next visit in ${nest.left.toFixed(0)} s, not a respawn timer`);
    const dm = await d.page.evaluate(() => willowmere.map()), dpos = (await metrics(d.page)).position, D = projection({ x: dpos.x, z: dpos.z, radius: dm.radius, size: 300 }), at = D.point(nestDen.x, nestDen.z), boxAt = { x0: at.x - 12, x1: at.x + 12, y0: at.y - 12, y1: at.y + 12 };
    assert.ok((await pixels(d.page, '#map-canvas', COLORS.boss, 16, boxAt)).n === 0, 'asleep: no dark crown on the nest'); assert.ok(!(await mini(d.page)).rim.some(r => r.id === 'w:den:dragon'), 'and never on the rim');
    await d.page.locator('.minimap').screenshot({ path: 'test-results/maps-15-dragon-asleep.png' });
    await d.page.evaluate(() => willowmere.test.lavaEvent('dragon')); await d.page.waitForFunction(() => !willowmere.metrics().dens.find(k => k.event === 'dragon').down, null, { timeout: 10000 }); await d.page.waitForTimeout(500);
    assert.ok((await pixels(d.page, '#map-canvas', COLORS.boss, 16, boxAt)).n > 30 && (await pixels(d.page, '#map-canvas', COLORS.dragon, 30, boxAt)).n > 3, 'here: the boss crown with an orange ring');
    await d.page.locator('.minimap').screenshot({ path: 'test-results/maps-16-dragon-here.png' }); await d.page.evaluate(() => willowmere.test.lavaEvent(null)); await d.context.close();
    results.push({ name: 'the sleeping dragon is grey on its nest with the time to its next visit, never on the rim; while it is here it wears an orange ring', next: nest.left });
  }

  // ---------------------------------------------------------------- 6. the directory buttons still route
  {
    const { page: p, context } = await setup(home({ position: { x: 0, z: -8.8 } }));
    await p.locator('[data-panel="map"]').click(); await p.waitForSelector('#large-map');
    const names = await p.evaluate(() => [...document.querySelectorAll('.quick-locations button')].map(b => ({ text: b.innerText.trim(), action: b.dataset.action, type: b.dataset.type, id: b.dataset.id })));
    assert.deepEqual(names.map(n => n.text), ['Home ↗', 'Garden ↗', 'Fishing dock ↗', 'Market ↗', 'Atelier ↗', 'Workshop ↗', 'Woodland ↗', 'School ↗', 'Clinic ↗', 'Police ↗', 'Willow & Co. ↗', 'Supermarket ↗']); assert.ok(names.every(n => n.action === 'find' && n.type && n.id));
    await p.keyboard.press('Escape');
    for (const n of names) {
      await p.keyboard.press('m'); await p.waitForSelector('#large-map'); await p.locator(`[data-action="find"][data-type="${n.type}"][data-id="${n.id}"]`).click();
      await p.waitForFunction(() => document.getElementById('modal-backdrop').hidden, null, { timeout: 10000 }); await p.waitForFunction(() => /^On the way · /.test(document.getElementById('toast').textContent), null, { timeout: 10000 }).catch(() => {});
      const toast = await p.locator('#toast').innerText(); assert.match(toast, /^On the way · /, `${n.text}: ${toast}`); await p.waitForTimeout(250);
    }
    const moved = (await metrics(p)).position; assert.ok(Math.hypot(moved.x, moved.z + 8.8) > .5, 'and you set off');
    results.push({ name: 'the twelve directory buttons under the sheet still route' }); await context.close();
  }

  // ---------------------------------------------------------------- 7. the prisons and the titans on both maps (merge F: builder E's cageStatuses and D2's titans are real)
  // At (128, 0) with the box open: Clover's cage by the King Bear is a padlock badge on his crown while he has never been beaten, a key
  // badge once he has (Clover waits), and gone once Clover is rescued; on the minimap, on the Map and as a row under his den.
  for (const screen of ['desktop', 'phone']) {
    const touch = screen !== 'desktop';
    for (const [label, extra, want] of [['locked', {}, 'locked'], ['open', { defeated: { bear: true } }, 'open'], ['rescued', { defeated: { bear: true }, friends: [{ id: 'clover', rescuedAt: 1, home: true }] }, null]]) {
      const { page: p, context } = await setup(tested({ position: { x: STAND.east[0], z: STAND.east[1] }, ...extra }), screen, touch ? 2 : 1);
      await p.waitForFunction(() => document.getElementById('map-canvas').__mini.on.includes('w:den:bear') || document.getElementById('map-canvas').__mini.rim.some(r => r.id === 'w:den:bear'), null, { timeout: 30000 }); await p.waitForTimeout(300);
      const cages = (await metrics(p)).cages.filter(c => c.id === 'clover'), m = await mini(p).then(async v => ({ ...v, cages: await p.evaluate(() => document.getElementById('map-canvas').__mini.cages) }));
      if (want) { assert.equal(cages[0]?.state, want, `${screen} ${label}: metrics().cages`); assert.ok(m.cages.includes(`clover:${want}`), `${screen} ${label}: a ${want} badge on the King Bear's crown on the minimap (${m.cages})`); }
      else { assert.ok(cages.every(c => c.state === 'rescued'), `${screen} rescued: the cage stands empty`); assert.ok(!m.cages.some(c => c.startsWith('clover')), `${screen} rescued: no badge on the minimap`); }
      if (label !== 'rescued') await p.locator('.minimap').screenshot({ path: `test-results/maps-17-minimap-cage-${label}-${screen}.png` });
      await openMap(p); let s = await sheet(p); const badge = s.markers.find(k => k.kind === 'cage' && k.id === 'clover');
      if (want) { assert.equal(badge?.state, want, `${screen} ${label}: the badge on the Map`); const row = (await p.locator('.den-row.cage[data-cage="clover"]').innerText()).replace(/\s+/g, ' ').trim(); assert.equal(row, want === 'locked' ? '🔒 Locked cage · by the King Bear' : '🗝 Clover is waiting · by the King Bear'); }
      else { assert.equal(badge, undefined, `${screen} rescued: no badge on the Map`); assert.equal(await p.locator('.den-row.cage[data-cage="clover"]').count(), 0, 'and no row'); }
      // Zoomed onto the den: the cage stands apart from the crown with its own marker and name.
      if (want) { const bear = s.markers.find(k => k.id === 'w:den:bear'); for (let i = 0; i < 40 && (s.cam.k < 7 || Math.abs(DEN.x - s.cam.cx) * s.cam.k > s.w * .2 || Math.abs(DEN.z - s.cam.cz) * s.cam.k > s.h * .2); i++) { const dx = (DEN.x - s.cam.cx) * s.cam.k / s.w, dz = (DEN.z - s.cam.cz) * s.cam.k / s.h, key = Math.max(Math.abs(dx), Math.abs(dz)) > .2 ? (Math.abs(dx) > Math.abs(dz) ? (dx < 0 ? 'ArrowLeft' : 'ArrowRight') : (dz < 0 ? 'ArrowUp' : 'ArrowDown')) : '+'; s = await after(p, () => p.keyboard.press(key)); } const own = s.markers.find(k => k.kind === 'cage' && k.id === 'clover'); assert.ok(own && bear, `${screen} ${label}: cage and King Bear at k ${s.cam.k.toFixed(1)}`); apart(s.labels, `${screen} cage ${label}`); await p.screenshot({ path: `test-results/maps-18-map-cage-${label}-${screen}.png` }); }
      await context.close();
    }
    // The titan by the canyon (builder D2): violet, on the sheet at its live place, and in the den list as a titan.
    const { page: p, context } = await setup(tested({ position: { x: STAND.east[0], z: STAND.east[1] } }), screen, touch ? 2 : 1); await openMap(p);
    const s = await after(p, () => p.locator('[data-map="world"]').click()), live = (await metrics(p)).dens.filter(d => d.titan);
    assert.equal(live.length, 9, `${screen}: nine titans in metrics().dens`); const marks = s.markers.filter(k => k.kind === 'titan'); assert.equal(marks.length, 9, `${screen}: nine titan markers on World`); assert.ok(marks.every(k => k.r === SHEET.titan));
    const turtle = live.find(d => d.type === 'titan_turtle'), mark = marks.find(k => k.id === turtle.id), P = sheetProjection(s.cam, s.w, s.h), at = P.point(turtle.x, turtle.z); assert.ok(Math.hypot(mark.x - at.x, mark.y - at.y) < 1, `${screen}: the turtle's marker at its live place`);
    assert.ok((await pixels(p, '#large-map', COLORS.titan, 20)).n > 40, `${screen}: violet titan crowns on the sheet`);
    await p.screenshot({ path: `test-results/maps-19-world-titans-${screen}.png` }); await context.close();
  }
  results.push({ name: 'prisons: a padlock badge, then a key, then nothing on both maps and in the den list; the nine titans violet at their live places' });

  assert.deepEqual(errors, []);
  await writeFile('test-results/maps-results.json', JSON.stringify({ url: base, results, errors }, null, 2)); console.log(JSON.stringify({ results, errors }, null, 2));
} catch (error) { console.error(error); console.error(JSON.stringify({ results, errors }, null, 2)); process.exitCode = 1; } finally { await browser.close(); }
