// Evidence for merge F (not a test): the maps in the integrated round 8 game, at 1440x900 and 390x844.
//   GAME_URL=http://127.0.0.1:<port> GPU=1 node tests/maps-merge-shots.mjs <out dir>
// The prisons' badges and rows, the nine titans, builder B's land features at k 2 (Ember, Beach, Toybox, Cloud), a jeep parked at
// (250, 0) after a reload (C's saved vehicles), and six draw-call samples at the homestead.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshState, SAVE_KEY } from '../src/game.mjs';
import { squareOf } from '../src/regions.mjs';

const base = process.env.GAME_URL ?? 'http://127.0.0.1:4173', out = process.argv[2] ?? 'test-results/merge-F'; await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: process.env.GPU ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--enable-unsafe-swiftshader'] });
const SCREENS = { desktop: [1440, 900], phone: [390, 844] }, notes = {};
const seed = extra => Object.assign(freshState(), { started: true, coins: 5000, pandora: true, hp: 9999, settings: { ...freshState().settings, test: true }, ...extra });
async function setup(state, screen) {
  const [width, height] = SCREENS[screen], mobile = screen === 'phone';
  const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  await context.addInitScript(({ key, state }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state)); }, { key: SAVE_KEY, state });
  const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(base); await page.waitForFunction(() => window.willowmere?.metrics().ready, null, { timeout: 180000 }); await page.locator('#begin').click();
  await page.waitForFunction(() => document.getElementById('map-canvas').__mini?.terrain === true, null, { timeout: 90000 }); await page.waitForTimeout(1500);
  await page.evaluate(() => document.getElementById('toast')?.setAttribute('hidden', ''));
  return { page, context, errors };
}
async function openMap(p) { await p.keyboard.press('m'); await p.waitForSelector('#large-map', { timeout: 30000 }); await p.waitForFunction(() => document.getElementById('large-map').__sheet?.terrain.ready, null, { timeout: 60000 }); await p.waitForTimeout(300); }
const sheet = p => p.evaluate(() => { const s = document.getElementById('large-map').__sheet; return { cam: s.cam, w: s.w, h: s.h, markers: s.markers, labels: s.labels, draws: s.draws }; });
async function press(p, key) { const n = (await sheet(p)).draws; await p.keyboard.press(key); await p.waitForFunction(n => document.getElementById('large-map').__sheet.draws > n, n, { timeout: 10000 }).catch(() => {}); await p.waitForTimeout(40); }
/** Zooms to k and centres (x, z) with the keys, as a player would; it zooms first, as the World view is locked at the centre. */
async function goTo(p, x, z, k) {
  for (let i = 0; i < 60; i++) { const s = await sheet(p), dx = (x - s.cam.cx) * s.cam.k / s.w, dz = (z - s.cam.cz) * s.cam.k / s.h; const key = s.cam.k < k / 1.3 ? '+' : Math.max(Math.abs(dx), Math.abs(dz)) > .12 ? (Math.abs(dx) > Math.abs(dz) ? (dx < 0 ? 'ArrowLeft' : 'ArrowRight') : (dz < 0 ? 'ArrowUp' : 'ArrowDown')) : s.cam.k > k * 1.3 ? '-' : null; if (!key) return s; if (process.env.DEBUG) console.log(key, JSON.stringify(s.cam), s.w, s.h); await press(p, key); }
  return sheet(p);
}
const shotSheet = async (p, name) => { await p.locator('#large-map').scrollIntoViewIfNeeded(); await p.waitForTimeout(150); await p.screenshot({ path: `${out}/${name}.png` }); };

try {
  for (const screen of ['desktop', 'phone']) {
    // 1. The canyon with Clover's cage locked: the minimap's badge, the World sheet with titans and cages, the den list's cage row.
    let { page: p, context, errors } = await setup(seed({ position: { x: 128, z: 6 } }), screen);
    await p.screenshot({ path: `${out}/01-canyon-minimap-${screen}.png` }); await p.locator('.minimap').screenshot({ path: `${out}/01b-minimap-close-${screen}.png` });
    notes[`minimap-${screen}`] = await p.evaluate(() => document.getElementById('map-canvas').__mini.cages);
    await openMap(p); await p.locator('[data-map="world"]').click(); await p.waitForTimeout(300); await shotSheet(p, `02-world-${screen}`);
    let s = await sheet(p); notes[`world-${screen}`] = { titans: s.markers.filter(m => m.kind === 'titan').length, bosses: s.markers.filter(m => m.kind === 'boss').length, cages: s.markers.filter(m => m.kind === 'cage').map(m => `${m.id}:${m.state}`) };
    await p.locator('.den-row.cage').first().scrollIntoViewIfNeeded(); await p.waitForTimeout(150); await p.screenshot({ path: `${out}/03-den-list-cage-${screen}.png` });
    // 2. Builder B's features at k 2.
    for (const id of ['lava', 'ocean', 'toy', 'cloud']) { const sq = squareOf(id); await goTo(p, sq.cx, sq.cz, 2); await shotSheet(p, `04-${id}-k2-${screen}`); }
    console.log(screen, 'errors', errors); await context.close();
    // 3. Clover waits (the King Bear beaten once), zoomed onto the cage.
    ({ page: p, context, errors } = await setup(seed({ position: { x: 128, z: 6 }, defeated: { bear: true } }), screen));
    await openMap(p); s = await sheet(p); const bear = s.markers.find(m => m.id === 'w:den:bear'); await goTo(p, bear ? (bear.wx ?? 100) : 100, bear ? (bear.wz ?? 0) : 0, 6); await shotSheet(p, `05-clover-waits-${screen}`); await context.close();
    // 4. A jeep parked at (250, 0), after a reload: its glyph on the World sheet.
    ({ page: p, context, errors } = await setup(seed({ position: { x: 244, z: 4 }, pandora: false, stats: { ...freshState().stats, sales: 250 }, vehicles: { jeep: { x: 250, z: 0, rot: 0 }, bike: null } }), screen));
    await p.reload(); await p.waitForFunction(() => window.willowmere?.metrics().ready, null, { timeout: 180000 }); await p.locator('#begin').click(); await p.waitForTimeout(1500);
    await openMap(p); await p.locator('[data-map="world"]').click(); await p.waitForTimeout(300); s = await sheet(p); notes[`jeep-${screen}`] = s.markers.filter(m => m.kind === 'vehicle').map(m => ({ id: m.id, wx: m.wx, wz: m.wz }));
    await goTo(p, 250, 0, 2.5); await shotSheet(p, `06-parked-jeep-${screen}`); await context.close();
  }
  // 5. The homestead's draw calls on "high", six samples with the birds settled (deferred check 8).
  {
    const { page: p, context } = await setup(seed({ pandora: false, position: { x: 0, z: -8.8 } }), 'desktop'); await p.waitForTimeout(6000); const calls = [];
    for (let i = 0; i < 6; i++) { calls.push(await p.evaluate(() => willowmere.calls())); await p.waitForTimeout(800); }
    notes.homestead = { settings: await p.evaluate(() => willowmere.metrics().quality ?? null), calls: calls.map(c => c?.calls), triangles: calls.map(c => c?.triangles) }; await context.close();
  }
  await writeFile(`${out}/notes.json`, JSON.stringify(notes, null, 2)); console.log(JSON.stringify(notes, null, 2));
} catch (error) { console.error(error); process.exitCode = 1; } finally { await browser.close(); }
