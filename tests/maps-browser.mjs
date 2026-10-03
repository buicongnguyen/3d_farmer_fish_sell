// The maps in a real browser (round 8; owner: builder F): the round minimap and the Map window.
// Created in step 0 from two blocks that asserted the maps in other builders' suites, moved with their step 0 values:
//   1. the minimap block of tests/round6-browser.mjs (a true circle, you in the middle, the room plan indoors, the Map on a tap)
//   2. the King Bear block of tests/round7-browser.mjs (no crown with the box shut; a crown on the rim toward his den; on the
//      Map a crown at the sheet's edge and the legend with distance and direction; beside the den, the crown on the bear)
// Builder F replaces the assertions with those of spec 12.3 (north up, nine rim crowns, the zoomable Map).
//   GAME_URL=http://127.0.0.1:<port> node tests/maps-browser.mjs      (GPU=1 for a real GPU)
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshState, SAVE_KEY } from '../src/game.mjs';
import { CAMERA_YAW } from '../src/field-layout.mjs';
import { DEN } from '../src/wilds.mjs';
import { projection, rimPoint, compass, COLORS } from '../src/minimap.mjs';

const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome', headless: true, args: process.env.GPU ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const base = process.env.GAME_URL ?? 'http://127.0.0.1:4173', errors = [], results = []; await mkdir('test-results', { recursive: true });
const SCREENS = { phone: [390, 844], landscape: [844, 390], desktop: [1440, 900] };
const seed = (extra = {}) => Object.assign(freshState(), { started: true, coins: 5000, ...extra });
const home = (extra = {}) => seed({ coins: 3000, energy: 40, position: { x: 0, z: -8.8 }, upgrades: { farm: 1, pond: 1, pen: 1, house: 3, kitchen: 3 }, furniture: ['rug', 'sofa', 'plants', 'books', 'dining', 'art'], ...extra });
async function setup(state, screen = 'desktop') {
  const [width, height] = SCREENS[screen], mobile = screen !== 'desktop';
  const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  await context.addInitScript(({ key, state }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state)); }, { key: SAVE_KEY, state });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(base); await page.waitForFunction(() => window.willowmere?.metrics().ready, null, { timeout: 90000 }); await page.locator('#begin').click(); await page.waitForTimeout(400);
  return { page, context, width, height, mobile };
}
const metrics = p => p.evaluate(() => willowmere.metrics());
const enter = async p => { await p.keyboard.press('e'); await p.waitForFunction(() => willowmere.metrics().location === 'interior', null, { timeout: 30000 }); await p.waitForTimeout(900); };
/** Pixels of a colour on a canvas: how many, and their middle (canvas pixels). */
const pixels = (p, selector, hex, tolerance = 22) => p.evaluate(({ selector, hex, tolerance }) => {
  const c = document.querySelector(selector), g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data, want = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  let n = 0, sx = 0, sy = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200 && Math.abs(d[i] - want[0]) < tolerance && Math.abs(d[i + 1] - want[1]) < tolerance && Math.abs(d[i + 2] - want[2]) < tolerance) { n++; sx += i / 4 % c.width; sy += Math.floor(i / 4 / c.width); }
  return { n, x: n ? sx / n : 0, y: n ? sy / n : 0, size: c.width };
}, { selector, hex, tolerance });

try {
  // ---------------------------------------------------------------- 1. the minimap: a true circle, centred on you, north on the rim, the room plan indoors, a tap opens the Map
  for (const screen of ['desktop', 'phone', 'landscape']) {
    const { page: p, context } = await setup(home({ pandora: true, position: { x: 0, z: -8.8 } }), screen); await p.waitForTimeout(600);
    const look = () => p.evaluate(() => {
      const c = document.getElementById('map-canvas'), r = c.getBoundingClientRect(), cs = getComputedStyle(c), g = c.getContext('2d'), px = (x, y) => [...g.getImageData(x, y, 1, 1).data], n = document.getElementById('map-north').getBoundingClientRect(), b = document.querySelector('.minimap').getBoundingClientRect();
      return { w: r.width, h: r.height, radius: cs.borderRadius, corner: px(3, 3)[3], corner2: px(c.width - 4, c.height - 4)[3], centre: px(c.width / 2, c.height / 2), edge: px(c.width / 2, 6)[3], north: { x: (n.left + n.width / 2 - b.left) / b.width, y: (n.top + n.height / 2 - b.top) / b.height }, caption: document.getElementById('map-caption').textContent, map: willowmere.map() };
    });
    let m = await look(); assert.ok(Math.abs(m.w - m.h) < .5 && m.w >= 80, `${screen}: the canvas is square (${m.w} x ${m.h})`); assert.equal(m.radius, '50%'); assert.equal(m.corner, 0); assert.equal(m.corner2, 0); assert.equal(m.edge, 255, 'drawn out to the rim');
    assert.ok(m.centre[3] === 255 && m.centre[0] > 200 && m.centre[1] > 200 && m.centre[2] > 200, 'you are the white arrow in the middle'); assert.equal(m.caption, 'WILLOWMERE'); assert.equal(m.map.place, 'village');
    assert.ok(m.north.x > .6 && m.north.x < .8 && m.north.y < .12, `${screen}: N rides the rim to the upper right (the camera is turned)`);
    await enter(p); await p.waitForTimeout(500); m = await look(); assert.equal(m.caption, 'YOUR HOMESTEAD'); assert.equal(m.map.place, 'interior'); assert.ok(Math.abs(m.north.x - .5) < .03 && m.north.y < .06, 'north is straight up indoors'); assert.equal(m.corner, 0);
    await context.close();
    // South of the village the caption names the region you stand in (the Blue Lake Meadow), and the map opens up.
    const f = await setup(home({ pandora: true, position: { x: 0, z: 95 } }), screen); await f.page.waitForFunction(() => willowmere.map().caption === 'BLUE LAKE MEADOW', null, { timeout: 30000 });
    const far = await f.page.evaluate(() => willowmere.map()); assert.ok(far.radius > 46 && far.radius <= 120, 'the map opens up in the fields');
    await f.page.locator('.minimap').click(); await f.page.waitForSelector('#large-map', { timeout: 10000 }); assert.ok(await f.page.locator('#modal-title').count());
    if (screen === 'phone') await f.page.screenshot({ path: 'test-results/maps-01-map-phone.png' }); await f.context.close();
  }
  results.push({ name: 'the minimap is a true circle centred on you, with north on the rim, the room plan indoors and the full map on a tap', pass: true });

  // ---------------------------------------------------------------- 2. the King Bear on the maps
  {
    const at = { x: 6, z: 30 };
    // Shut: no crown on the minimap, no word of him on the full map.
    const shut = await setup(seed({ position: at })); await shut.page.waitForTimeout(600);
    assert.equal((await pixels(shut.page, '#map-canvas', COLORS.boss)).n, 0, 'no crown while the box is shut');
    await shut.page.keyboard.press('m'); await shut.page.waitForSelector('#large-map'); assert.equal(await shut.page.locator('.legend-boss').count(), 0); assert.equal((await pixels(shut.page, '#large-map', COLORS.boss)).n, 0); await shut.context.close();
    // Open: a crown on the rim, in the den's direction.
    for (const screen of ['desktop', 'phone']) {
      const { page: p, context } = await setup(seed({ pandora: true, position: at }), screen); await p.waitForTimeout(900);
      const map = await p.evaluate(() => willowmere.map()), crown = await pixels(p, '#map-canvas', COLORS.boss);
      const P = projection({ x: at.x, z: at.z, heading: CAMERA_YAW, radius: map.radius, size: crown.size }), want = rimPoint(P, DEN.x, DEN.z, 6.5 * crown.size / 100);
      assert.equal(want.off, true); assert.ok(crown.n > 40, `${screen}: the crown's disc is drawn (${crown.n} px)`); assert.ok(Math.hypot(crown.x - want.x, crown.y - want.y) < 9, `${screen}: on the rim toward the den (${crown.x.toFixed(0)}, ${crown.y.toFixed(0)} vs ${want.x.toFixed(0)}, ${want.y.toFixed(0)})`);
      await p.locator('.minimap').screenshot({ path: `test-results/maps-02-minimap-crown-${screen}.png` });
      // The full map: the crown on the sheet's east edge (his den is in the Redrock Canyon), and the legend says how far and which way.
      await p.locator('.minimap').click(); await p.waitForSelector('#large-map'); const sheet = await pixels(p, '#large-map', COLORS.boss);
      assert.ok(sheet.n > 40 && sheet.x > 840 * .75 && sheet.y > 580 * .2 && sheet.y < 580 * .8, `${screen}: the crown is on the sheet's east edge (${sheet.x.toFixed(0)}, ${sheet.y.toFixed(0)})`);
      const far = Math.round(Math.hypot(DEN.x - at.x, DEN.z - at.z)); assert.equal(compass(DEN.x - at.x, DEN.z - at.z), 'east'); assert.equal(await p.locator('.legend-boss').innerText(), `♛ King Bear · ${far} m east`);
      await p.screenshot({ path: `test-results/maps-03-full-map-${screen}.png` }); await context.close();
    }
    // Out by the den: the crown sits on the bear himself, well inside the rim.
    const { page: p, context } = await setup(seed({ pandora: true, hp: 9999, position: { x: 128, z: -8 } }));
    await p.waitForFunction(() => typeof willowmere.wilds === 'function' && willowmere.wilds().creatures.some(c => c.type === 'bear'), null, { timeout: 30000 }); await p.waitForTimeout(600);
    const bear = (await p.evaluate(() => willowmere.wilds())).creatures.find(c => c.type === 'bear'), me = (await metrics(p)).position, map = await p.evaluate(() => willowmere.map()), crown = await pixels(p, '#map-canvas', COLORS.boss);
    const P = projection({ x: me.x, z: me.z, heading: CAMERA_YAW, radius: map.radius, size: crown.size }), spot = P.point(bear.x, bear.z);
    assert.ok(crown.n > 40 && Math.hypot(crown.x - spot.x, crown.y - spot.y) < 12, 'the crown is on the King Bear'); assert.ok(Math.hypot(spot.x - 150, spot.y - 150) < 150 - 30, 'inside the rim');
    results.push({ name: 'the King Bear on the minimap (rim, then his spot) and on the full map with distance and direction' }); await context.close();
  }

  assert.deepEqual(errors, []);
  await writeFile('test-results/maps-results.json', JSON.stringify({ url: base, results, errors }, null, 2)); console.log(JSON.stringify({ results, errors }, null, 2));
} catch (error) { console.error(error); console.error(JSON.stringify({ results, errors }, null, 2)); process.exitCode = 1; } finally { await browser.close(); }
