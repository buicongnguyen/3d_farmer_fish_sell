// The fruit-tree spots and the supermarket in a real browser: clear a tree, plant a mango and an apple on cleared spots, grow
// them with the test clock, pick, sell; the picker on a phone; the planted tree blocks the way; old saves; the supermarket east
// of Willow & Co. with the better price; chapter six; a save left on the old country road.
//   GAME_URL=http://127.0.0.1:<port> node tests/farm-browser.mjs      (GPU=1 for a real GPU)
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshState, SAVE_KEY, TEST_KEY, CHOP_COST } from '../src/game.mjs';
import { CIVIC, GATE, TREES } from '../src/content.mjs';
import { villageTrees } from '../src/village-plan.mjs';
import { inVillage, CAMERA_YAW } from '../src/field-layout.mjs';

const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome', headless: true, args: process.env.GPU ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const base = process.env.GAME_URL ?? 'http://127.0.0.1:4173', errors = [], results = []; await mkdir('test-results', { recursive: true });
const SCREENS = { phone: [390, 844], landscape: [844, 390], desktop: [1440, 900] };
const seed = (extra = {}) => Object.assign(freshState(), { started: true, coins: 900, ...extra });
async function setup(state, screen = 'desktop') {
  const [width, height] = SCREENS[screen], mobile = screen !== 'desktop';
  const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  await context.addInitScript(({ key, state }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state)); }, { key: SAVE_KEY, state });
  const page = await context.newPage(); page.setDefaultTimeout(60000); page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(base); await page.waitForFunction(() => window.willowmere?.metrics().ready, null, { timeout: 90000 }); await page.locator('#begin').click(); await page.waitForTimeout(400);
  return { page, context, width, height, mobile };
}
const metrics = p => p.evaluate(() => willowmere.metrics()), snapshot = p => p.evaluate(() => willowmere.snapshot());
const prompt = p => p.evaluate(() => document.querySelector('#interact span').textContent);
const waitPrompt = (p, text) => p.waitForFunction(t => document.querySelector('#interact span').textContent === t, text);
const title = (p, text) => p.waitForSelector(`#modal-title:has-text("${text}")`, { timeout: 60000 });
const close = p => p.getByRole('button', { name: 'Close panel', exact: true }).click();
const use = async e => { if (e.mobile) await e.page.locator('#touch-action').tap({ force: true }); else await e.page.keyboard.press('e'); };
const pos = async p => (await metrics(p)).position;
const T = villageTrees(), beside = (i, dx = 1.1, dz = .8) => ({ x: T[i].x + dx, z: T[i].z + dz });
/** Walk with a key for a while; returns how far you got. */
async function walk(p, key, ms = 500) { const a = await pos(p); await p.keyboard.down(key); await p.waitForTimeout(ms); await p.keyboard.up(key); await p.waitForTimeout(80); const b = await pos(p); return Math.hypot(b.x - a.x, b.z - a.z); }
/** The test clock: unlock test mode once, sleep to the next morning n times, then switch it off again. */
async function mornings(p, n) {
  await p.locator('[data-panel="settings"]').click(); await title(p, 'Just the way you like it');
  await p.locator('#test-key').fill(TEST_KEY); await p.locator('[data-action="testKey"]').click(); await p.waitForFunction(() => willowmere.snapshot().settings.test);
  for (let i = 0; i < n; i++) { const day = (await snapshot(p)).day; await p.locator('#modal [data-action="sleep"]').click(); await p.waitForFunction(d => willowmere.snapshot().day === d + 1, day); await p.locator('[data-panel="settings"]').click(); await title(p, 'Just the way you like it'); }
  await p.locator('[data-action="do"][data-type="testOff"]').click(); await p.waitForFunction(() => !willowmere.snapshot().settings.test); await close(p);
}
/** Tap a thing in the world by its target (the game walks there and uses it). */
async function tapTarget(e, type, id) { const t = await e.page.evaluate(({ type, id }) => willowmere.targets().find(t => t.type === type && String(t.id) === String(id)), { type, id }); assert.ok(t, `${type} ${id} is a target`); if (e.mobile) await e.page.touchscreen.tap(t.screen.x, t.screen.y); else await e.page.mouse.click(t.screen.x, t.screen.y); }

const MANGO = 121, APPLE = 120, SM = CIVIC.find(c => c.id === 'supermarket'), SM_WEST = SM.x - SM.w / 2, CO = CIVIC.find(c => c.id === 'company'), DOOR = { x: SM.x, z: SM.z + SM.d / 2 + 1.8 };
try {
  // ---------------------------------------------------------------- 1. clear, plant a mango and an apple, grow, pick
  {
    const e = await setup(seed({ cleared: [MANGO], position: beside(MANGO) })), p = e.page;
    assert.equal(await prompt(p), 'Plant a fruit tree'); assert.equal((await metrics(p)).grove.stumps, 1);
    await use(e); await title(p, 'Plant a fruit tree'); assert.equal(await p.locator('#modal .grove-list .shop-item').count(), 8); assert.equal(await p.locator('#modal .eyebrow').first().textContent(), 'FRUIT TREES 0 / 6');
    await p.locator('[data-action="plantFruit"][data-id="mango"]').click(); await p.waitForFunction(() => !!willowmere.snapshot().planted[121]);
    let s = await snapshot(p); assert.equal(s.coins, 900 - TREES.mango.price); assert.deepEqual(s.planted[MANGO], { kind: 'mango', day: 1, picked: 0 }); assert.equal(await p.locator('#modal-backdrop').isHidden(), true, 'the picker closes');
    await waitPrompt(p, 'Young mango tree · fruit in 3 mornings'); let g = (await metrics(p)).grove; assert.deepEqual([g.stumps, g.trees, g.kinds, g.blocks], [0, 1, 1, 1]);
    // Not stuck beside the new sapling: every direction moves you; and the sapling is in the way when you walk at it.
    for (const key of ['w', 'a', 's', 'd']) assert.ok(await walk(p, key, 260) > .25, `walks ${key}`);
    await p.screenshot({ path: 'test-results/farm-1-sapling.png' });
    // The card of a young tree: its stage, and "Clear this tree".
    await tapTarget(e, 'spot', MANGO); await title(p, 'Mango tree'); assert.match(await p.locator('#modal .grove-list').textContent(), /Sapling.*First fruit in 3 mornings/); assert.equal(await p.locator('[data-action="pickFruit"]').isDisabled(), true); assert.equal(await p.locator('[data-action="uprootFruit"]').count(), 1); await close(p);
    // Clear a second tree through the game (the chop panel now says what the stump is for) and plant an apple on it.
    await tapTarget(e, 'chop', APPLE); await title(p, 'Clear this tree?'); assert.match(await p.locator('#modal .modal-content').textContent(), /planting spot/); await p.locator('[data-action="chopTree"]').click();
    await p.waitForFunction(() => willowmere.snapshot().cleared.includes(120)); await waitPrompt(p, 'Plant a fruit tree'); await use(e); await title(p, 'Plant a fruit tree'); await p.locator('[data-action="plantFruit"][data-id="apple"]').click(); await p.waitForFunction(() => !!willowmere.snapshot().planted[120]);
    s = await snapshot(p); assert.equal(s.coins, 900 - 120 - CHOP_COST - 65); assert.equal(s.inventory.wood, 2);
    // Three mornings on the test clock (switched off again, so the trees have really grown).
    await mornings(p, 3); s = await snapshot(p); assert.equal(s.day, 4); assert.equal(s.settings.test, false);
    await waitPrompt(p, 'Pick fresh apples'); await use(e); await p.waitForFunction(() => willowmere.snapshot().inventory.apple === 3); await waitPrompt(p, 'Picked today · more fruit tomorrow');
    await tapTarget(e, 'spot', MANGO); await p.waitForFunction(() => willowmere.snapshot().inventory.mango === 3, null, { timeout: 60000 }); assert.equal(await p.locator('#modal-backdrop').isHidden(), true, 'a ready tree is picked at once, no panel');
    await p.screenshot({ path: 'test-results/farm-1-grown.png' });
    // Clear the mango again: the spot is a stump once more.
    await p.waitForTimeout(700); /* a second tap on the same thing within 0.6 s is a double tap, and is dropped */ await tapTarget(e, 'spot', MANGO); await title(p, 'Mango tree'); assert.match(await p.locator('#modal .grove-list').textContent(), /Picked today/); await p.locator('[data-action="uprootFruit"]').click(); await p.waitForFunction(() => !willowmere.snapshot().planted[121]);
    g = (await metrics(p)).grove; assert.deepEqual([g.stumps, g.trees], [1, 1]); await waitPrompt(p, 'Plant a fruit tree');
    results.push({ name: 'clear a tree, plant a mango and an apple, three mornings, pick, clear again', coins: (await snapshot(p)).coins }); await e.context.close();
    // A grown fruit tree blocks the way like any tree: walking straight at it (D walks to the screen's right) you are stopped at its
    // trunk or slide round it, and are never inside it. The same block stops the jeep and the creatures (they read world.addTreeBlock).
    const m = T[MANGO], right = { x: Math.cos(CAMERA_YAW), z: -Math.sin(CAMERA_YAW) }, start = { x: m.x - right.x * 2.4, z: m.z - right.z * 2.4 };
    const b = await setup(seed({ day: 9, cleared: [MANGO], planted: { [MANGO]: { kind: 'mango', day: 1, picked: 9 } }, position: start })); assert.equal((await metrics(b.page)).grove.blocks, 1);
    let nearest = Infinity; await b.page.keyboard.down('d'); for (let i = 0; i < 40; i++) { await b.page.waitForTimeout(30); const at = await pos(b.page); nearest = Math.min(nearest, Math.hypot(at.x - m.x, at.z - m.z)); } await b.page.keyboard.up('d');
    const end = await pos(b.page); assert.ok(Math.hypot(end.x - start.x, end.z - start.z) > .8, 'walked up to it'); assert.ok(nearest >= .5 + .3 - .03 && nearest < 1.6, `stopped at the trunk, never inside it (nearest ${nearest.toFixed(2)} m)`);
    results.push({ name: 'a grown fruit tree blocks the way', nearest: +nearest.toFixed(2) }); await b.context.close();
  }
  // ---------------------------------------------------------------- 2. the picker on a phone and on a landscape phone; the limit
  for (const screen of ['phone', 'landscape']) {
    const e = await setup(seed({ cleared: [MANGO], coins: 130, position: beside(MANGO) }), screen), p = e.page;
    await waitPrompt(p, 'Plant a fruit tree'); await use(e); await title(p, 'Plant a fruit tree');
    const fit = await p.evaluate(() => { const c = document.querySelector('#modal .modal-content'), m = document.querySelector('#modal').getBoundingClientRect(); return { scroll: c.scrollWidth - c.clientWidth, left: m.left, right: innerWidth - m.right, page: document.documentElement.scrollWidth - innerWidth, buttons: [...c.querySelectorAll('[data-action="plantFruit"]')].map(b => { const r = b.getBoundingClientRect(); return [Math.round(r.height), Math.round(r.width), r.right <= innerWidth + .5]; }), rows: [...c.querySelectorAll('.shop-item')].map(r => r.getBoundingClientRect().right <= innerWidth + .5) }; });
    assert.ok(fit.scroll <= 1 && fit.page <= 0 && fit.left >= -1 && fit.right >= -1, `${screen}: no sideways scroll (${JSON.stringify(fit)})`); assert.equal(fit.buttons.length, 8);
    for (const [h, w, inside] of fit.buttons) assert.ok(h >= 44 && w >= 44 && inside, `${screen}: a ${w} x ${h} button`); assert.ok(fit.rows.every(Boolean));
    // Not enough coins for the durian at the bottom of the list: a line says so, nothing is planted, and the list stays where it was scrolled.
    await p.locator('#modal .modal-content').evaluate(c => c.scrollTo(0, c.scrollHeight)); const before = await p.locator('#modal .modal-content').evaluate(c => c.scrollTop); assert.ok(before > 10, 'the list scrolls');
    await p.locator('[data-action="plantFruit"][data-id="durian"]').tap(); await p.waitForFunction(() => /Save a little more/.test(document.querySelector('#toast').textContent));
    assert.equal(await p.locator('#modal .modal-content').evaluate(c => c.scrollTop), before, 'the scroll is kept'); assert.deepEqual((await snapshot(p)).planted, {});
    await p.screenshot({ path: `test-results/farm-2-picker-${screen}.png` });
    await p.locator('#modal .modal-content').evaluate(c => c.scrollTo(0, 0)); await p.locator('[data-action="plantFruit"][data-id="mango"]').tap(); await p.waitForFunction(() => willowmere.snapshot().planted[121]?.kind === 'mango'); assert.equal((await snapshot(p)).coins, 10);
    results.push({ name: `the picker fits a ${screen} screen`, buttons: fit.buttons[0] }); await e.context.close();
  }
  {
    const spots = T.map((t, i) => ({ ...t, i })).filter(t => !t.gone).slice(0, 7).map(t => t.i), planted = Object.fromEntries(spots.slice(0, 6).map(i => [i, { kind: 'apple', day: 1, picked: 0 }]));
    const e = await setup(seed({ cleared: spots, planted, position: beside(spots[6]) }), 'phone'), p = e.page;
    await waitPrompt(p, 'Plant a fruit tree'); await use(e); await title(p, 'Plant a fruit tree'); assert.equal(await p.locator('#modal .eyebrow').first().textContent(), 'FRUIT TREES 6 / 6');
    assert.equal(await p.locator('[data-action="plantFruit"]:disabled').count(), 8); assert.match(await p.locator('#modal .grove-intro').textContent(), /holds 6 planted fruit trees/);
    results.push({ name: 'at the limit the picker says so and its buttons are off' }); await e.context.close();
  }
  // ---------------------------------------------------------------- 3. old saves; a save with fewer cleared trees brings the trees back
  {
    const old = seed({ cleared: [MANGO, 127], position: beside(MANGO) }); delete old.planted;                 // a version 1 save from before the fruit-tree spots
    const e = await setup(old), p = e.page; await waitPrompt(p, 'Plant a fruit tree'); const g = (await metrics(p)).grove; assert.equal(g.stumps, 2); assert.deepEqual((await snapshot(p)).planted, {});
    await use(e); await title(p, 'Plant a fruit tree'); await p.locator('[data-action="plantFruit"][data-id="apple"]').click(); await p.waitForFunction(() => willowmere.snapshot().planted[121]?.kind === 'apple');
    // Import a save that cleared nothing: the cleared trees stand again (they used to stay hidden, with their stumps).
    const fresh = seed({ position: beside(MANGO) }); p.once('dialog', d => d.accept());
    await p.locator('#import-file').setInputFiles({ name: 'fresh.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fresh)) });
    await p.waitForFunction(() => willowmere.snapshot().cleared.length === 0); await p.waitForFunction(() => willowmere.metrics().grove.stumps === 0 && willowmere.metrics().grove.trees === 0);
    await p.keyboard.press('Escape').catch(() => {}); await p.waitForTimeout(300); if (await p.locator('#modal-backdrop').isVisible()) await close(p);
    await waitPrompt(p, `Clear this tree · ${CHOP_COST} coins`);
    const stand = await pos(p); assert.ok(Math.hypot(stand.x - T[MANGO].x, stand.z - T[MANGO].z) > .42 * T[MANGO].s + .25, 'you are not standing in the tree that came back');
    results.push({ name: 'old saves get plantable stumps; importing a save restores its trees' }); await e.context.close();
  }
  // ---------------------------------------------------------------- 4. draw calls: stumps, six planted trees of three kinds, a full orchard
  {
    const here = { x: -18, z: 8 }, near = T.map((t, i) => ({ ...t, i })).filter(t => !t.gone).sort((a, b) => Math.hypot(a.x - here.x, a.z - here.z) - Math.hypot(b.x - here.x, b.z - here.z)).slice(0, 14).map(t => t.i);
    const kinds = ['mango', 'apple', 'peach'], planted = Object.fromEntries(near.slice(0, 6).map((i, k) => [i, { kind: kinds[k % 3], day: 1 + k % 3, picked: 0 }]));
    const calls = async state => { const e = await setup(seed({ day: 6, time: 22, position: here, ...state })); await e.page.waitForTimeout(1500); await e.page.evaluate(() => willowmere.calls()); await e.page.waitForTimeout(300); const c = await e.page.evaluate(() => willowmere.calls()), m = await metrics(e.page); await e.page.screenshot({ path: `test-results/farm-4-${state.cleared ? 'grove' : 'baseline'}.png` }); await e.context.close(); return { calls: c.calls, grove: m.grove }; };
    const plain = await calls({}), grove = await calls({ cleared: near, planted, trees: kinds.map(kind => ({ kind, day: 2, picked: 0 })) });
    assert.deepEqual([grove.grove.stumps, grove.grove.trees, grove.grove.kinds], [8, 9, 3]); assert.ok(grove.grove.draws <= 5, `${grove.grove.draws} grove draws`);
    assert.ok(grove.calls - plain.calls <= 8, `${grove.calls} draw calls against ${plain.calls} without the grove`);
    results.push({ name: 'draw calls with 8 stumps, 6 planted trees of 3 kinds and 3 orchard trees', baseline: plain.calls, grove: grove.calls, groveDraws: grove.grove.draws });
  }
  // ---------------------------------------------------------------- 5. the supermarket: in view from Willow & Co., the Map, the better price
  for (const screen of ['desktop', 'landscape', 'phone']) {
    const e = await setup(seed({ inventory: { carrot: 3, mango: 2 }, position: { x: CO.x, z: CO.z + CO.d / 2 + 1.8 } }), screen), p = e.page;
    assert.equal(await prompt(p), 'Visit Willow & Co. offices');
    const t = await p.evaluate(() => willowmere.targets().find(t => t.type === 'shop' && t.id === 'supermarket')); assert.ok(t, 'the supermarket’s door is a shop');
    assert.deepEqual([t.position.x, t.position.z, t.label], [DOOR.x, DOOR.z, 'Shop at the supermarket']); const office = await p.evaluate(() => willowmere.targets().find(t => t.type === 'civic' && t.id === 'company')), perMetre = (t.screen.x - office.screen.x) / (t.position.x - office.position.x), west = office.screen.x + (SM_WEST - office.position.x) * perMetre;
    // From the office's door the supermarket is to the east: its door is on screen on a wide screen; an upright phone (19 m across) shows its west end.
    assert.ok(perMetre > 0 && west > e.width / 2 && west < e.width - 12, `${screen}: the supermarket’s west wall is on screen to the east (x ${Math.round(west)} of ${e.width})`);
    if (screen !== 'phone') assert.ok(t.screen.x < e.width && t.screen.y > 0 && t.screen.y < e.height, `${screen}: its door is on screen (${Math.round(t.screen.x)}, ${Math.round(t.screen.y)})`);
    await p.screenshot({ path: `test-results/farm-5-from-office-${screen}.png` });
    // The Map: its button walks you there; no country road, no country market anywhere.
    await p.evaluate(() => document.querySelector('[data-action="openMap"]').click()); await title(p, 'Find your little adventure');
    const mapText = await p.locator('#modal').textContent(); assert.match(mapText, /Supermarket ↗/); assert.doesNotMatch(mapText, /country/i); assert.equal(await p.locator('[data-action="find"][data-type="travel"]').count(), 0);
    await p.locator('[data-action="find"][data-type="shop"][data-id="supermarket"]').click(); await title(p, 'Willowmere Supermarket');
    const at = await pos(p); assert.ok(Math.hypot(at.x - DOOR.x, at.z - DOOR.z) < 2.2 && inVillage(at.x, at.z), 'you walked to its door');
    assert.equal(await p.locator('#modal .tabs button.active').textContent().then(s => s.replace(/[^A-Za-z ]/g, '').trim()), 'Sell produce'); assert.match(await p.locator('#modal .owl-note').textContent(), /25% more/);
    const rows = await p.locator('#modal .sv-sell .shop-item').allTextContents(); assert.ok(rows.some(r => /Carrot.*23 each/.test(r)) && rows.some(r => /Mango.*60 each/.test(r)), rows.join(' | '));
    let s = await snapshot(p); assert.equal(s.stats.trips, 1); assert.equal(s.stats.sales, 0);
    await p.locator('[data-action="sell"][data-id="carrot"][data-one="true"]').click(); await p.waitForFunction(() => willowmere.snapshot().stats.sales === 23); await p.locator('[data-action="sell"][data-id="mango"]:not([data-one])').click(); await p.waitForFunction(() => willowmere.snapshot().stats.sales === 23 + 120);
    s = await snapshot(p); assert.equal(s.coins, 900 + 143); assert.equal((await metrics(p)).location, 'village');
    await p.screenshot({ path: `test-results/farm-5-shop-${screen}.png` }); await close(p);
    assert.doesNotMatch(await p.evaluate(() => document.body.innerText), /country (market|road)|hillside market/i);
    assert.equal(await p.evaluate(() => willowmere.map().caption), 'WILLOWMERE');
    results.push({ name: `the supermarket: seen from the office, found on the Map, pays 25% more (${screen})`, door: [Math.round(t.screen.x), Math.round(t.screen.y)] }); await e.context.close();
  }
  // ---------------------------------------------------------------- 6. the market pays the plain price for the same fruit
  {
    const e = await setup(seed({ inventory: { mango: 2 }, position: { x: 5.5, z: 23.3 } })), p = e.page; await use(e); await title(p, 'The village market'); await p.locator('[data-action="tab"][data-id="sell"]').click();
    assert.match((await p.locator('#modal .sv-sell .shop-item').allTextContents()).join(' '), /Mango.*48 each/); assert.equal((await snapshot(p)).stats.trips, 0); await e.context.close(); results.push({ name: 'fruit sells at the market for the plain price' });
  }
  // ---------------------------------------------------------------- 7. chapter six, and saves from the country-market days
  {
    const six = seed({ chapter: 5, position: DOOR }), e = await setup(six), p = e.page;
    assert.match(await p.locator('#quest').textContent(), /Beyond the willow.*Visit the supermarket/); assert.equal(await prompt(p), 'Shop at the supermarket');
    await use(e); await title(p, 'Willowmere Supermarket'); await p.waitForFunction(() => /Willowmere Supermarket/.test(document.querySelector('#toast').textContent)); await close(p);
    await p.locator('[data-panel="journal"]').first().click(); await title(p, 'The family album'); assert.equal(await p.locator('.goal.complete').count(), 1); await p.locator('[data-action="claim"]').click(); await p.waitForFunction(() => willowmere.snapshot().chapter === 6);
    results.push({ name: 'a chapter-six save finishes with one visit to the supermarket' }); await e.context.close();
    const later = await setup(seed({ chapter: 7, stats: { ...freshState().stats, trips: 3 }, position: DOOR })); const s = await snapshot(later.page); assert.equal(s.chapter, 7); assert.equal(s.stats.trips, 3); await later.context.close();
    // A save made at the old travel spot ("standing in country": the position was only written in the village) wakes inside the gate.
    const c = await setup(seed({ position: { x: 63, z: 0 } })), at = await pos(c.page), m = await metrics(c.page); assert.equal(m.location, 'village'); assert.ok(Math.abs(at.x - 51) < .6 && Math.abs(at.z) < .6, `at (${at.x.toFixed(1)}, ${at.z.toFixed(1)})`); assert.equal(m.homeGuide.visible, false);
    assert.ok(await walk(c.page, 'a', 300) > .3, 'free to walk'); const targets = await c.page.evaluate(() => willowmere.targets().map(t => t.type)); assert.ok(!targets.includes('travel') && !targets.includes('return'));
    // The gate itself: no prompt to travel, and you can walk out to the open fields on foot.
    const g = await setup(seed({ position: { x: GATE.x - 6, z: 0 } })); assert.equal(await prompt(g.page), 'Explore your village'); await g.page.screenshot({ path: 'test-results/farm-7-gate.png' }); await g.context.close();
    results.push({ name: 'a save left on the country road wakes inside the east gate; the gate has no travel prompt', at: [+at.x.toFixed(1), +at.z.toFixed(1)] }); await c.context.close();
  }
  assert.deepEqual(errors, [], 'no page errors');
  await writeFile('test-results/farm-results.json', JSON.stringify(results, null, 2));
  for (const r of results) console.log('ok', JSON.stringify(r));
  console.log(`farm-browser: ${results.length} checks passed`);
} catch (error) { console.error(error); await writeFile('test-results/farm-results.json', JSON.stringify({ results, errors, error: String(error?.stack ?? error) }, null, 2)); process.exitCode = 1; } finally { await browser.close(); }
