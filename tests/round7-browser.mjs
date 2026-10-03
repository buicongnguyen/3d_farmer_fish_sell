// Round 7 in a real browser: the compact village (six houses, the atelier's stall beside the market, the grove behind
// the school), the ward at the village edge with creatures close by, the King Bear on the minimap and the full map,
// fishing from any bank, villagers walking between buildings, and panels that stay where you scrolled them.
//   GAME_URL=http://127.0.0.1:<port> node tests/round7-browser.mjs      (GPU=1 for a real GPU)
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshState, SAVE_KEY } from '../src/game.mjs';
import { HOUSES, HOMES, POND, FISH_SPOT, MARKET, ATELIER, GATE, WOODLAND, RESIDENTS } from '../src/content.mjs';
import { VILLAGE, inVillage, CAMERA_YAW } from '../src/field-layout.mjs';
import { SAFE, DEN, inSafeZone, wildDepth } from '../src/wilds.mjs';
import { gatherSpots } from '../src/village-plan.mjs';
import { BANK, waterDistance } from '../src/pond.mjs';
import { projection, rimPoint, COLORS } from '../src/minimap.mjs';
import { TRIP } from '../src/villagers.mjs';
import { GEAR } from '../src/gear.mjs';

const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome', headless: true, args: process.env.GPU ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const base = process.env.GAME_URL ?? 'http://127.0.0.1:4173', errors = [], results = []; await mkdir('test-results', { recursive: true });
const SCREENS = { phone: [390, 844], landscape: [844, 390], desktop: [1440, 900] };
const seed = (extra = {}) => Object.assign(freshState(), { started: true, coins: 5000, ...extra });
async function setup(state, screen = 'desktop') {
  const [width, height] = SCREENS[screen], mobile = screen !== 'desktop';
  const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  await context.addInitScript(({ key, state }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state)); }, { key: SAVE_KEY, state });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(base); await page.waitForFunction(() => window.willowmere?.metrics().ready, null, { timeout: 90000 }); await page.locator('#begin').click(); await page.waitForTimeout(400);
  const tap = (x, y) => mobile ? page.touchscreen.tap(x, y) : page.mouse.click(x, y);
  return { page, context, width, height, tap, mobile };
}
const metrics = p => p.evaluate(() => willowmere.metrics()), snapshot = p => p.evaluate(() => willowmere.snapshot());
const prompt = p => p.evaluate(() => document.querySelector('#interact span').textContent);
const title = (p, text) => p.waitForSelector(`#modal-title:has-text("${text}")`, { timeout: 20000 });
const close = p => p.getByRole('button', { name: 'Close panel', exact: true }).click();
const far = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
/** World metres to screen pixels, worked out from where the page says three of its targets are. */
async function screenMap(p) {
  const targets = (await p.evaluate(() => willowmere.targets())).filter(t => t.position && Number.isFinite(t.screen?.x));
  const a = targets[0], b = targets.find(t => far(t.position, a.position) > 8), c = targets.find(t => { const u = [b.position.x - a.position.x, b.position.z - a.position.z], v = [t.position.x - a.position.x, t.position.z - a.position.z]; return Math.abs(u[0] * v[1] - u[1] * v[0]) > 30; });
  const u = [b.position.x - a.position.x, b.position.z - a.position.z], v = [c.position.x - a.position.x, c.position.z - a.position.z], det = u[0] * v[1] - u[1] * v[0];
  const solve = k => { const p1 = b.screen[k] - a.screen[k], p2 = c.screen[k] - a.screen[k]; return [(p1 * v[1] - p2 * u[1]) / det, (u[0] * p2 - v[0] * p1) / det]; };
  const mx = solve('x'), my = solve('y');
  return (x, z) => ({ x: a.screen.x + mx[0] * (x - a.position.x) + mx[1] * (z - a.position.z), y: a.screen.y + my[0] * (x - a.position.x) + my[1] * (z - a.position.z) });
}
/** Pixels of a colour on a canvas: how many, and their middle (canvas pixels). */
const pixels = (p, selector, hex, tolerance = 22) => p.evaluate(({ selector, hex, tolerance }) => {
  const c = document.querySelector(selector), g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data, want = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  let n = 0, sx = 0, sy = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200 && Math.abs(d[i] - want[0]) < tolerance && Math.abs(d[i + 1] - want[1]) < tolerance && Math.abs(d[i + 2] - want[2]) < tolerance) { n++; sx += i / 4 % c.width; sy += Math.floor(i / 4 / c.width); }
  return { n, x: n ? sx / n : 0, y: n ? sy / n : 0, size: c.width };
}, { selector, hex, tolerance });
const stallCounter = s => ({ x: s.x, z: s.z + 2.3 });

try {
  // ---------------------------------------------------------------- 1. the compact village
  {
    const { page: p, context } = await setup(seed({ position: stallCounter(MARKET) }));
    const m = await metrics(p); assert.equal(m.households, 10); assert.equal(m.npcs, 23);
    const targets = await p.evaluate(() => willowmere.targets());
    assert.deepEqual(targets.filter(t => t.type === 'house' && !t.label.includes('back door')).map(t => t.id).sort(), HOMES.map(h => h.id), 'six front doors: the four southern houses are gone');
    assert.deepEqual(targets.filter(t => t.type === 'house' && t.label.includes('back door')).map(t => t.id).sort(), [1, 5, 7], 'and a back door on the west road for the three west houses');
    for (const t of targets) assert.ok(inVillage(t.position.x, t.position.z), `${t.type} ${t.id} is inside the village`);
    const market = targets.find(t => t.type === 'shop' && t.id === 'market'), atelier = targets.find(t => t.type === 'shop' && t.id === 'clothes');
    assert.ok(far(market.position, atelier.position) < 8, `the atelier's counter is ${far(market.position, atelier.position).toFixed(1)} m from the market's`); assert.ok(far(atelier.position, HOUSES[5]) > 40, 'no longer out by the Finch house');
    assert.equal(await prompt(p), 'Browse the village market');
    results.push({ name: 'six houses; the atelier stall beside the market', atelier: atelier.position, market: market.position });
    await p.screenshot({ path: 'test-results/round7-01-market-row.png' }); await context.close();
    // From the market's counter the atelier's stall is on the screen, on every screen; and its counter opens the atelier.
    for (const screen of ['desktop', 'phone', 'landscape']) {
      const v = await setup(seed({ position: stallCounter(MARKET) }), screen), at = (await v.page.evaluate(() => willowmere.targets())).find(t => t.type === 'shop' && t.id === 'clothes').screen;
      assert.ok(at.x > 20 && at.x < v.width - 20 && at.y > 60 && at.y < v.height - 40, `${screen}: the atelier is in view from the market (${Math.round(at.x)}, ${Math.round(at.y)})`); await v.context.close();
    }
    const a = await setup(seed({ position: stallCounter(ATELIER) })); assert.equal(await prompt(a.page), 'Visit the Finch atelier'); await a.page.keyboard.press('e'); await title(a.page, 'The Finch atelier');
    await a.page.locator('[data-action="tab"][data-id="gear"]').click(); await a.page.waitForSelector('[data-shop-tab="gear"]'); await close(a.page); await a.context.close();
    // The grove behind the school: the trail and its eight patches; nothing else answers E there.
    const g = await setup(seed({ position: { x: WOODLAND.x, z: WOODLAND.z } })); assert.equal(await prompt(g.page), 'Follow the woodland trail'); await g.context.close();
    const first = gatherSpots()[0], h = await setup(seed({ position: { x: first.x, z: first.z } })); assert.equal(await prompt(h.page), 'Gather mushroom'); await h.page.keyboard.press('e'); await h.page.waitForFunction(() => willowmere.snapshot().inventory.mushroom === 2, null, { timeout: 5000 }); await h.context.close();
    const e = await setup(seed({ position: { x: GATE.x - .6, z: 0 } })); assert.equal(await prompt(e.page), 'Follow the country road'); assert.equal((await metrics(e.page)).homeGuide.visible, false, 'the gate is used from inside the village'); await e.context.close();
    // Everyone is still in the directory: 24 residents in 10 households, the lodgers under their new roofs; a lodger answers a knock.
    const d = await setup(seed({ position: { x: -22, z: -30 }, time: 10 })); await d.page.locator('[data-panel="people"]').click(); await d.page.waitForSelector('.people-grid');
    assert.equal(await d.page.locator('.resident').count(), 24); assert.equal(await d.page.locator('.household').count(), 10);
    const names = await d.page.locator('.household h3').allInnerTexts(); for (const name of ['Moss barn', 'Hearth bakery', 'Brook schoolhouse', 'Linden clinic rooms']) assert.ok(names.includes(name), name);
    await d.page.locator('[data-action="find"][data-person="cora"]').click(); await title(d.page, 'Cora'); assert.ok((await snapshot(d.page)).met.cora); await close(d.page); await d.context.close();
    results.push({ name: 'lodgings, the grove, the gate, the directory' });
  }

  // ---------------------------------------------------------------- 2. the ward at the village edge
  {
    // Shut: just outside the footprint you are in the open fields (the way-home guide shows); just inside you are not.
    const out = await setup(seed({ position: { x: 0, z: VILLAGE.z1 + 2 } })); assert.equal((await metrics(out.page)).homeGuide.visible, true); assert.equal(await out.page.locator('#home-guide').isVisible(), true); assert.equal((await out.page.evaluate(() => willowmere.map())).caption, 'OPEN FIELDS'); await out.context.close();
    const inn = await setup(seed({ position: { x: 0, z: VILLAGE.z1 - 2 } })); assert.equal((await metrics(inn.page)).homeGuide.visible, false); assert.equal((await inn.page.evaluate(() => willowmere.map())).caption, 'WILLOWMERE'); await inn.context.close();
    // Open: the ribbon is up, creatures live close to the village and none is inside the ward, now or after a while.
    const { page: p, context } = await setup(seed({ pandora: true, position: { x: 4, z: VILLAGE.z1 - 2 } }));
    await p.waitForFunction(() => typeof willowmere.wilds === 'function' && willowmere.wilds().ready && willowmere.wilds().count > 0, null, { timeout: 30000 });
    let w = await p.evaluate(() => willowmere.wilds()); assert.equal(w.ward, true); assert.equal(w.fighting, false, 'no fighting inside the village'); assert.equal(w.zone, null);
    const near = w.creatures.map(c => ({ ...c, depth: wildDepth(c.x, c.z), edge: Math.hypot(Math.max(0, VILLAGE.x0 - c.x, c.x - VILLAGE.x1), Math.max(0, VILLAGE.z0 - c.z, c.z - VILLAGE.z1)) })).sort((a, b) => a.edge - b.edge);
    assert.ok(near.length >= 6, `creatures round the village (${near.length})`); assert.ok(near[0].edge < 24, `the nearest creature is ${near[0].edge.toFixed(1)} m from the village edge (it was 14 m and more before, from a footprint 20 m farther out)`);
    assert.ok(near.filter(c => c.edge < 40).length >= 3, 'several within 40 m');
    for (let i = 0; i < 6; i++) { w = await p.evaluate(() => willowmere.wilds()); for (const c of w.creatures) assert.ok(!inSafeZone(c.x, c.z), `${c.type} at ${c.x.toFixed(1)}, ${c.z.toFixed(1)} is outside the ward`); await p.waitForTimeout(700); }
    await p.screenshot({ path: 'test-results/round7-02-ward-south.png' });
    // Walk out through the ward: the zone banner names the near meadows, the fight is on, the map's caption follows.
    await p.keyboard.down('s'); await p.waitForFunction(z => willowmere.metrics().position.z > z, SAFE.z1 + 4, { timeout: 30000 }); await p.keyboard.up('s'); await p.waitForTimeout(400);
    w = await p.evaluate(() => willowmere.wilds()); assert.equal(w.zone, 'meadow'); assert.equal(w.fighting, true); assert.equal(await p.locator('#home-guide').isVisible(), true);
    assert.match(await p.locator('#pandora-zone').innerText(), /Near meadows/); assert.equal((await p.evaluate(() => willowmere.map())).caption, 'NEAR MEADOWS');
    results.push({ name: 'the ward hugs the village; creatures close by', nearest: +near[0].edge.toFixed(1), within40: near.filter(c => c.edge < 40).length });
    await p.screenshot({ path: 'test-results/round7-03-near-meadows.png' }); await context.close();
  }

  // ---------------------------------------------------------------- 3. the King Bear on the map
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
      await p.locator('.minimap').screenshot({ path: `test-results/round7-04-minimap-crown-${screen}.png` });
      // The full map: the crown at the sheet's north-east corner, and the legend says how far and which way.
      await p.locator('.minimap').click(); await p.waitForSelector('#large-map'); const sheet = await pixels(p, '#large-map', COLORS.boss);
      assert.ok(sheet.n > 40 && sheet.x > 840 * .75 && sheet.y < 580 * .2, `${screen}: the crown is at the sheet's north-east corner`);
      const far = Math.round(Math.hypot(DEN.x - at.x, DEN.z - at.z)); assert.equal(await p.locator('.legend-boss').innerText(), `♛ King Bear · ${far} m north-east`);
      await p.screenshot({ path: `test-results/round7-05-full-map-${screen}.png` }); await context.close();
    }
    // Out by the den: the crown sits on the bear himself, well inside the rim.
    const { page: p, context } = await setup(seed({ pandora: true, hp: 9999, position: { x: DEN.x - 24, z: DEN.z + 18 } }));
    await p.waitForFunction(() => typeof willowmere.wilds === 'function' && willowmere.wilds().creatures.some(c => c.type === 'bear'), null, { timeout: 30000 }); await p.waitForTimeout(600);
    const bear = (await p.evaluate(() => willowmere.wilds())).creatures.find(c => c.type === 'bear'), me = (await metrics(p)).position, map = await p.evaluate(() => willowmere.map()), crown = await pixels(p, '#map-canvas', COLORS.boss);
    const P = projection({ x: me.x, z: me.z, heading: CAMERA_YAW, radius: map.radius, size: crown.size }), spot = P.point(bear.x, bear.z);
    assert.ok(crown.n > 40 && Math.hypot(crown.x - spot.x, crown.y - spot.y) < 12, 'the crown is on the King Bear'); assert.ok(Math.hypot(spot.x - 150, spot.y - 150) < 150 - 30, 'inside the rim');
    results.push({ name: 'the King Bear on the minimap (rim, then his spot) and on the full map with distance and direction' }); await context.close();
  }

  // ---------------------------------------------------------------- 4. fishing from anywhere along the bank
  {
    const x0 = POND.x - POND.w / 2, x1 = POND.x + POND.w / 2, z0 = POND.z - POND.d / 2, z1 = POND.z + POND.d / 2;
    const banks = { north: { x: POND.x + 1, z: z0 - .9 }, east: { x: x1 + .9, z: POND.z - 2 }, south: { x: POND.x - 3, z: z1 + .9 }, west: { x: x0 - .9, z: POND.z + 1 }, dock: FISH_SPOT };
    for (const [name, at] of Object.entries(banks)) for (const screen of name === 'north' ? ['desktop', 'phone', 'landscape'] : ['desktop']) {
      const { page: p, context, height } = await setup(seed({ position: at }), screen);
      assert.equal(await prompt(p), 'Cast your fishing rod', `${name} bank`); assert.equal((await metrics(p)).fishing.equipped, true, 'the rod is out');
      await p.keyboard.press('e'); await p.waitForFunction(() => willowmere.metrics().fishing.line, null, { timeout: 5000 }); await p.waitForFunction(() => willowmere.metrics().fishing.phase !== 'cast', null, { timeout: 5000 }); await p.waitForTimeout(900);
      const f = (await metrics(p)).fishing; assert.ok(f.float.x > x0 && f.float.x < x1 && f.float.z > z0 && f.float.z < z1, `${name}: the float is in the pond (${f.float.x.toFixed(1)}, ${f.float.z.toFixed(1)})`); assert.ok(f.float.y < 1);
      assert.ok(far({ x: f.float.x, z: f.float.z }, at) < BANK.max + 3 && far({ x: f.float.x, z: f.float.z }, at) > 1.5, 'a cast of a sensible length');
      // You and the float are on the screen, clear of the fishing card.
      const card = await p.locator('.fishing-card').boundingBox(), me = (await metrics(p)).screen;
      assert.ok(me.y > 60 && me.y < height - 30, `${name} ${screen}: you are on the screen`); if (card.width > SCREENS[screen][0] * .7) assert.ok(me.y < card.y, `${name} ${screen}: you stand above the card`);
      await p.screenshot({ path: `test-results/round7-06-fishing-${name}-${screen}.png` });
      await p.keyboard.press('Escape'); assert.equal((await metrics(p)).fishing.line, false); await context.close();
    }
    // Away from the water there is no cast; the prompt is whatever else is there.
    const dry = await setup(seed({ position: { x: POND.x, z: z1 + BANK.reach + 1.2 } })); assert.notEqual(await prompt(dry.page), 'Cast your fishing rod'); await dry.context.close();
    // A tap on the pond from across the lawn: you walk to the nearest bit of bank and cast toward the tap.
    const { page: p, context } = await setup(seed({ position: { x: 27, z: 4.5 } })), toScreen = await screenMap(p), tapAt = { x: x1 - 2.5, z: POND.z + .5 }, s = toScreen(tapAt.x, tapAt.z);
    await p.mouse.click(s.x, s.y); await p.waitForFunction(() => willowmere.metrics().fishing.line, null, { timeout: 20000 }); await p.waitForFunction(() => willowmere.metrics().fishing.phase !== 'cast', null, { timeout: 5000 }); await p.waitForTimeout(700);
    const m = await metrics(p); assert.ok(waterDistance(m.position.x, m.position.z) <= BANK.reach + .6, 'you stand at the bank'); assert.ok(m.position.x > x1, 'the east bank, the nearest one');
    assert.ok(far({ x: m.fishing.float.x, z: m.fishing.float.z }, tapAt) < 1.6, `the float is where you tapped (${m.fishing.float.x.toFixed(1)}, ${m.fishing.float.z.toFixed(1)})`);
    results.push({ name: 'fishing from the north, east, south and west banks, the old dock, and by tapping the pond' }); await context.close();
  }

  // ---------------------------------------------------------------- 5. villagers on the move
  {
    // At ten at night the timetable has everyone at home: whoever walks now is out on a stroll.
    const watch = async (state, seconds) => {
      const { page: p, context } = await setup(seed({ time: 22, position: { x: 8, z: 18 }, ...state })); await p.waitForFunction(() => typeof willowmere.villagers === 'function', null, { timeout: 15000 });
      const samples = [], movers = new Set(), kids = new Set(RESIDENTS.filter(r => r.child).map(r => r.id)); let said = '';
      for (const t0 = Date.now(); Date.now() - t0 < seconds * 1000;) {
        const v = await p.evaluate(() => ({ ...willowmere.villagers(), bubble: (() => { const b = document.getElementById('village-bubble'); return b && !b.hidden ? b.textContent : ''; })() }));
        samples.push(v); for (const n of v.npcs) { if (n.moving) movers.add(n.id); assert.equal(n.stuck, false, `${n.id} stands in something at ${n.x.toFixed(1)}, ${n.z.toFixed(1)}`); if (!n.inside) assert.ok(inVillage(n.x, n.z) && inSafeZone(n.x, n.z, -3), `${n.id} is in the village`); }
        if (v.bubble) said = v.bubble; await p.waitForTimeout(500);
      }
      await p.screenshot({ path: `test-results/round7-07-villagers-${state.pandora ? 'open' : 'shut'}.png` }); await context.close();
      return { samples, movers, kids, said, mean: samples.reduce((n, s) => n + s.walking, 0) / samples.length, busy: samples.filter(s => s.walking > 0).length / samples.length, trips: samples.at(-1).trips, greetings: samples.at(-1).greetings };
    };
    const shut = await watch({}, 40);
    assert.ok(shut.trips >= 5, `${shut.trips} strolls started in 40 s`); assert.ok(shut.movers.size >= 5, `${shut.movers.size} different villagers walked`); assert.ok(shut.busy > .8, `someone was walking ${Math.round(shut.busy * 100)} % of the time`);
    assert.ok(shut.mean >= 1.5 && shut.mean <= TRIP.walkers + 3, `${shut.mean.toFixed(1)} walking on average`); assert.ok(Math.max(...shut.samples.map(s => s.walking)) >= 3, 'a few at once');
    const open = await watch({ pandora: true }, 40);
    assert.ok(open.trips >= 1 && open.trips < shut.trips, `fewer strolls while the box is open (${open.trips} against ${shut.trips})`); assert.ok(open.mean < shut.mean, `${open.mean.toFixed(1)} walking on average against ${shut.mean.toFixed(1)}`);
    for (const id of open.movers) assert.ok(!open.kids.has(id), `${id} is a child and stays put while the box is open`); assert.ok(Math.max(...open.samples.map(s => s.walking)) <= TRIP.walkersOpen + 1);
    results.push({ name: 'villagers stroll between buildings', shut: { trips: shut.trips, movers: shut.movers.size, mean: +shut.mean.toFixed(2), busy: +shut.busy.toFixed(2), greetings: shut.greetings, said: shut.said }, open: { trips: open.trips, movers: open.movers.size, mean: +open.mean.toFixed(2) } });
    // By day the timetable adds to it: the morning walk to school and work.
    const day = await setup(seed({ time: 7.9, position: { x: -10, z: -28 } })); await day.page.waitForFunction(() => typeof willowmere.villagers === 'function' && willowmere.villagers().walking >= 4, null, { timeout: 40000 }); await day.page.screenshot({ path: 'test-results/round7-08-morning.png' }); await day.context.close();
  }

  // ---------------------------------------------------------------- 6. the scroll stays put
  {
    const rich = seed({ coins: 60000, day: 3, energy: 40, inventory: { carrot: 9, radish: 7, pumpkin: 5, berry: 6, tulip: 4, sunflower: 4, daisy: 3, apple: 6, peach: 4, mango: 3, perch: 5, carp: 4, catfish: 3, koi: 2, egg: 6, milk: 3, mushroom: 6, wood: 8, game: 2, hide: 3, honey: 3, soup: 4, fishplate: 3, pie: 3, seed_carrot: 6 }, gearOwned: Object.keys(GEAR).slice(0, 12) });
    /** Scrolls the list so that a matching button sits low on the screen, presses it, and returns the offsets before and after. */
    const press = async (v, selector) => {
      const before = await v.page.evaluate(sel => {
        const list = document.querySelector('#modal .modal-content'), buttons = [...list.querySelectorAll(sel)].filter(b => !b.disabled), pick = buttons[Math.floor(buttons.length * .7)], lr = list.getBoundingClientRect(), br = pick.getBoundingClientRect(), max = list.scrollHeight - list.clientHeight;
        let want = list.scrollTop + br.bottom - lr.bottom + 40; if (want < 30) want = Math.min(max, Math.max(30, list.scrollTop + br.top - lr.top - 120)); list.scrollTop = Math.max(0, Math.min(max, want));
        const r = pick.getBoundingClientRect(), strip = document.querySelector('#modal .tabs'); return { top: list.scrollTop, max, x: r.left + r.width / 2, y: r.top + r.height / 2, strip: strip?.scrollLeft ?? 0 };
      }, selector);
      await v.page.waitForTimeout(150); await v.tap(before.x, before.y); await v.page.waitForTimeout(400);
      const after = await v.page.evaluate(() => { const list = document.querySelector('#modal .modal-content'), strip = document.querySelector('#modal .tabs'); return { top: list.scrollTop, max: list.scrollHeight - list.clientHeight, strip: strip?.scrollLeft ?? 0 }; });
      return { before, after };
    };
    const kept = (r, what) => { assert.ok(r.before.top > 25, `${what}: the list was scrolled (${r.before.top})`); assert.ok(Math.abs(r.after.top - Math.min(r.before.top, r.after.max)) <= 1, `${what}: the list stays at ${r.before.top} (it is at ${r.after.top})`); assert.equal(r.after.strip, r.before.strip, `${what}: the tab strip stays`); };
    for (const screen of ['phone', 'desktop', 'landscape']) {
      // The market: sell one, then sell all of a kind (the row goes, the list stays).
      const v = await setup({ ...rich, position: stallCounter(MARKET) }, screen); await v.page.keyboard.press('e'); await title(v.page, 'The village market');
      await v.page.locator('#modal [data-action="tab"][data-id="sell"]').click(); await v.page.waitForSelector('[data-shop-tab="sell"]'); const coins = (await snapshot(v.page)).coins;
      kept(await press(v, '[data-action="sell"][data-one="true"]'), `${screen} sell one`); assert.ok((await snapshot(v.page)).coins > coins, 'it was sold'); kept(await press(v, '.shop-item [data-action="sell"]:not([data-one])'), `${screen} sell all of one kind`);
      // Another tab starts at the top; the tab strip shows the tab you chose, and buying there moves nothing.
      const last = v.page.locator('#modal [data-action="tab"][data-id="furniture"]'); await v.page.evaluate(() => { const s = document.querySelector('#modal .tabs'); s.scrollLeft = s.scrollWidth; }); const b = await last.boundingBox(); await v.tap(b.x + b.width / 2, b.y + b.height / 2); await v.page.waitForSelector('[data-shop-tab="furniture"]');
      const strip = await v.page.evaluate(() => { const s = document.querySelector('#modal .tabs'), a = s.querySelector('.active').getBoundingClientRect(), r = s.getBoundingClientRect(); return { top: document.querySelector('#modal .modal-content').scrollTop, left: s.scrollLeft, scrolls: s.scrollWidth > s.clientWidth + 1, shown: a.left >= r.left - 1 && a.right <= r.right + 1 }; });
      assert.equal(strip.top, 0, 'a new tab starts at the top'); assert.ok(strip.shown, `${screen}: the chosen tab is in view`); if (strip.scrolls) assert.ok(strip.left > 0, `${screen}: the strip did not jump back to its first tab`);
      await v.page.locator('#modal [data-type="furniture"]:not([disabled])').first().click(); await v.page.waitForTimeout(300); assert.equal(await v.page.evaluate(() => document.querySelector('#modal .tabs').scrollLeft), strip.left, `${screen}: the strip stays after a purchase`);
      await close(v.page); await v.context.close();
      // The atelier's gear tab (a long list): buy, with the Pandora box open (its stats strip is added above the list after each redraw).
      const a = await setup({ ...rich, pandora: true, position: stallCounter(ATELIER) }, screen); await a.page.keyboard.press('e'); await title(a.page, 'The Finch atelier');
      await a.page.locator('#modal [data-action="tab"][data-id="gear"]').click(); await a.page.waitForSelector('[data-shop-tab="gear"]'); const owned = (await snapshot(a.page)).gearOwned.length;
      kept(await press(a, '[data-type="buyGear"]'), `${screen} buy gear`); assert.equal((await snapshot(a.page)).gearOwned.length, owned + 1); kept(await press(a, '[data-type="buyGear"]'), `${screen} buy gear again`);
      await close(a.page);
      // The basket with the box open: eating a meal used to push the list down by the height of the stats strip each time.
      await a.page.locator('[data-panel="bag"]').click(); await title(a.page, 'Your everyday basket'); const r1 = await press(a, '[data-type="eat"]'); kept(r1, `${screen} eat`); kept(await press(a, '[data-type="eat"]'), `${screen} eat again`);
      await close(a.page); await a.context.close();
    }
    // Settings on a phone on its side (the panel scrolls there): a switch keeps its place.
    const s = await setup(rich, 'landscape'); await s.page.locator('[data-panel="settings"]').tap(); await title(s.page, 'Just the way you like it');
    kept(await press(s, '[data-action="sound"]'), 'settings sound'); kept(await press(s, '[data-action="light"]:not(.active)'), 'settings light'); await s.context.close();
    results.push({ name: 'panels keep their scroll: market sell, atelier gear, the basket with the box open, settings, the tab strip' });
  }

  assert.deepEqual(errors, []);
  await writeFile('test-results/round7-results.json', JSON.stringify({ url: base, results, errors }, null, 2)); console.log(JSON.stringify({ results, errors }, null, 2));
} catch (error) { console.error(error); console.error(JSON.stringify({ results, errors }, null, 2)); process.exitCode = 1; } finally { await browser.close(); }
