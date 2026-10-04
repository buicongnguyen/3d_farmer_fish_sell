// Evidence shots for the maps (round 8, builder F; spec 11.4). Not a test: it only takes pictures and prints numbers.
//   GAME_URL=http://127.0.0.1:4417 GPU=1 OUT=<folder> node tests/maps-shots.mjs [only]
// The minimap at (0, 0), (40, 40) and candy's stand (-128, 112), box open, at each screen (its CSS size is 150, 120 or 96 px);
// the Map on World, Village and Me and at k = 1.5 and 4; a downed boss with its timer; the sleeping dragon; a locked and an open
// cage badge (drawn from a seeded view until builder E's cageStatuses is merged); the box shut; and draw calls at four spots.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshState, SAVE_KEY } from '../src/game.mjs';

const base = process.env.GAME_URL ?? 'http://127.0.0.1:4417', out = process.env.OUT ?? 'test-results/maps-shots', only = process.argv[2] ?? '';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome', headless: true, args: process.env.GPU ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const SCREENS = { pc: [1440, 900], landscape: [844, 390], phone: [390, 844] };
const seed = (extra = {}) => Object.assign(freshState(), { started: true, coins: 5000, hp: 9999, ...extra });
async function setup(state, screen) {
  const [width, height] = SCREENS[screen], mobile = screen !== 'pc';
  const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  await context.addInitScript(({ key, state }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state)); }, { key: SAVE_KEY, state });
  const page = await context.newPage(); page.on('pageerror', e => console.error('PAGE ERROR', e.message));
  await page.goto(base); await page.waitForFunction(() => window.willowmere?.metrics().ready, null, { timeout: 120000 }); await page.locator('#begin').click(); await page.waitForTimeout(1500);
  return { page, context, width, height };
}
/** Beats a den's creature the way a player does (a tap on it, then the fight runs on in test mode): the maps then show it down. */
async function fell(page, type, touch = false) {
  await page.waitForFunction(t => typeof willowmere.wilds === 'function' && willowmere.wilds().creatures.some(c => c.type === t), type, { timeout: 90000 });
  for (let i = 0; i < 40; i++) {
    const den = await page.evaluate(t => willowmere.metrics().dens.find(d => d.type === t), type); if (den.down) return den;
    const c = await page.evaluate(t => willowmere.wilds().creatures.find(c => c.type === t), type);
    if (c && c.hp > 0 && c.screen) { if (touch) await page.touchscreen.tap(c.screen.x, c.screen.y); else await page.mouse.click(c.screen.x, c.screen.y); }
    await page.waitForTimeout(1500);
  }
  return page.evaluate(t => willowmere.metrics().dens.find(d => d.type === t), type);
}
const numbers = {};
const STANDS = { centre: { x: 0, z: 0 }, village: { x: 40, z: 40 }, candy: { x: -128, z: 112 } };
try {
  for (const screen of Object.keys(SCREENS)) {
    if (only && only !== screen) continue;
    // The minimap at the three stands, box open.
    for (const [name, at] of Object.entries(STANDS)) {
      const { page, context } = await setup(seed({ pandora: true, position: at }), screen);
      await page.waitForFunction(() => document.getElementById('map-canvas').__mini?.terrain, null, { timeout: 60000 }).catch(() => {}); await page.waitForTimeout(700);
      const info = await page.evaluate(() => { const c = document.getElementById('map-canvas'), m = c.__mini; return { css: c.clientWidth, px: m?.px, rim: m?.rim.map(r => `${r.id.slice(6)} ${r.text}${r.labelled ? '' : ' (dart only)'}`), on: m?.on, caption: willowmere.map().caption }; });
      numbers[`minimap-${name}-${screen}`] = info;
      await page.locator('.minimap').screenshot({ path: `${out}/minimap-${name}-${screen}.png` });
      if (name === 'centre') await page.screenshot({ path: `${out}/hud-${screen}.png` });
      if (name !== 'village') {
        // The Map, opened where you stand: Village inside the ward, Me outside it; then World and two fixed zooms.
        await page.locator('.minimap').click(); await page.waitForSelector('#large-map'); await page.waitForFunction(() => document.getElementById('large-map').__sheet?.terrain.ready, null, { timeout: 60000 }); await page.waitForTimeout(300);
        const sheet = () => page.evaluate(() => { const s = document.getElementById('large-map').__sheet; return { preset: s.preset, k: +s.cam.k.toFixed(3), w: s.w, h: s.h, labels: s.labels.length, markers: s.markers.length }; });
        numbers[`map-open-${name}-${screen}`] = await sheet(); await page.screenshot({ path: `${out}/map-${name === 'centre' ? 'village' : 'me'}-${screen}.png` });
        if (name === 'centre') {
          await page.locator('[data-map="world"]').click(); await page.waitForTimeout(250); numbers[`map-world-${screen}`] = await sheet(); await page.screenshot({ path: `${out}/map-world-${screen}.png` });
          const croc = await page.evaluate(() => { const c = document.getElementById('large-map'), r = c.getBoundingClientRect(), m = c.__sheet.markers.find(m => m.id === 'w:den:croc'); return { x: r.left + c.clientLeft + m.x, y: r.top + c.clientTop + m.y }; });
          await page.mouse.click(croc.x, croc.y); await page.waitForTimeout(250); await page.screenshot({ path: `${out}/map-world-picked-${screen}.png` });
          for (const k of [1.5, 4]) {
            await page.locator('[data-map="world"]').click(); await page.waitForTimeout(120);
            // Zoom to k with the wheel over the sheet's middle (it is anchored on the cursor), then drag toward the candy corner at k = 4.
            const box = await page.locator('#large-map').boundingBox(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            for (let i = 0; i < 40; i++) { const now = await page.evaluate(() => document.getElementById('large-map').__sheet.cam.k); if (now >= k * .995) break; await page.mouse.wheel(0, -Math.min(120, Math.log(k / now) / .0015)); await page.waitForTimeout(60); }
            if (k === 4) { for (let i = 0; i < 2; i++) { await page.mouse.move(box.x + box.width * .3, box.y + box.height * .6); await page.mouse.down(); await page.mouse.move(box.x + box.width * .8, box.y + box.height * .15, { steps: 6 }); await page.mouse.up(); } }
            await page.waitForTimeout(250); numbers[`map-k${k}-${screen}`] = await sheet(); await page.screenshot({ path: `${out}/map-k${k}-${screen}.png` });
          }
          // The den list under the sheet.
          await page.locator('.den-list').scrollIntoViewIfNeeded(); await page.waitForTimeout(200); await page.screenshot({ path: `${out}/map-denlist-${screen}.png` });
        }
      }
      await context.close();
    }
    // Box shut: fills, borders, names and levels; no crown, no list.
    {
      const { page, context } = await setup(seed({ position: { x: 0, z: 0 } }), screen); await page.waitForTimeout(900);
      await page.locator('.minimap').screenshot({ path: `${out}/minimap-shut-${screen}.png` });
      await page.locator('.minimap').click(); await page.waitForSelector('#large-map'); await page.waitForFunction(() => document.getElementById('large-map').__sheet?.terrain.ready, null, { timeout: 60000 });
      await page.locator('[data-map="world"]').click(); await page.waitForTimeout(300); await page.screenshot({ path: `${out}/map-world-shut-${screen}.png` }); await context.close();
    }
    // A downed boss with its timer: beat the King Bear through the test hook, by his den.
    {
      const { page, context } = await setup(seed({ pandora: true, settings: { ...freshState().settings, test: true }, gear: { ...freshState().gear, weapon: 'sword_obsidian' }, gearOwned: ['sword_obsidian'], position: { x: 144, z: -18 } }), screen);
      const beaten = await fell(page, 'bear', screen !== 'pc');
      numbers[`downed-${screen}`] = beaten; await page.waitForTimeout(600);
      await page.locator('.minimap').screenshot({ path: `${out}/minimap-bear-${beaten?.down ? 'down' : 'up'}-${screen}.png` });
      await page.locator('.minimap').click(); await page.waitForSelector('#large-map'); await page.waitForFunction(() => document.getElementById('large-map').__sheet?.terrain.ready, null, { timeout: 60000 }); await page.waitForTimeout(300);
      await page.screenshot({ path: `${out}/map-bear-${beaten?.down ? 'down' : 'up'}-${screen}.png` }); await context.close();
    }
    // The sleeping dragon (its nest in the Ember Fields), then the dragon here (the test hook forces the lava event).
    {
      const { page, context } = await setup(seed({ pandora: true, settings: { ...freshState().settings, test: true }, position: { x: 0, z: 236 } }), screen); await page.waitForTimeout(1200);
      numbers[`dragon-${screen}`] = await page.evaluate(() => { const d = willowmere.metrics().dens.find(d => d.event); return { down: d.down, left: Math.round(d.left), event: willowmere.metrics().lavaEvent }; });
      await page.locator('.minimap').screenshot({ path: `${out}/minimap-dragon-asleep-${screen}.png` });
      await page.locator('.minimap').click(); await page.waitForSelector('#large-map'); await page.waitForFunction(() => document.getElementById('large-map').__sheet?.terrain.ready, null, { timeout: 60000 }); await page.waitForTimeout(300); await page.screenshot({ path: `${out}/map-dragon-asleep-${screen}.png` });
      await page.keyboard.press('Escape'); await page.evaluate(() => willowmere.test?.lavaEvent?.('dragon')); await page.waitForTimeout(700); await page.locator('.minimap').screenshot({ path: `${out}/minimap-dragon-here-${screen}.png` });
      await context.close();
    }
  }
  // Draw calls and triangles with the maps on the screen, on both settings (willowmere.calls(), read twice 200 ms apart).
  if (!only || only === 'calls') for (const [label, screen, quality] of [['pc-high', 'pc', 'high'], ['phone-battery', 'phone', 'battery']]) {
    for (const [name, at, pandora] of [['village (8, 18), box shut', { x: 8, z: 18 }, false], ['homestead (0, -8.8), box shut', { x: 0, z: -8.8 }, false], ['fields (128, 0), box open', { x: 128, z: 0 }, true], ['candy stand (-128, 112), box open', { x: -128, z: 112 }, true]]) {
      const { page, context } = await setup(seed({ pandora, time: 12, position: at, settings: { ...freshState().settings, quality } }), screen); await page.waitForTimeout(2500);
      const samples = []; for (let i = 0; i < 6; i++) { await page.evaluate(() => willowmere.calls()); await page.waitForTimeout(200); samples.push(await page.evaluate(() => willowmere.calls())); await page.waitForTimeout(800); }
      const calls = samples.map(s => s?.calls ?? 0).sort((a, b) => a - b); numbers[`calls ${label} ${name}`] = { min: calls[0], median: calls[3], max: calls[5], triangles: Math.max(...samples.map(s => s?.triangles ?? 0)), mapDraws: await page.evaluate(() => willowmere.map().draws) };
      await context.close();
    }
  }
  await writeFile(`${out}/numbers${only ? '-' + only : ''}.json`, JSON.stringify(numbers, null, 1)); console.log(JSON.stringify(numbers, null, 1));
} catch (error) { console.error(error); process.exitCode = 1; } finally { await browser.close(); }
