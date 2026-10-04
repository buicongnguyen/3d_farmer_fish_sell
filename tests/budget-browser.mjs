// The section 18 triangle and draw lines in a real browser (round 8 fix). Phone is "battery" at 390x844, PC "high" at 1440x900.
// The village's fixed pieces were one baked mesh with a 74 m bounding sphere, so it was never culled: it was drawn (twice on PC, with its
// shadow) from the village, the homestead, the four home squares around it and the borders 80 m away, and put the phone over 250,000
// triangles and the PC over 400,000. It is now baked in 32 m cells, and World.cullView drops cells and tile batches that cannot show or shade
// anything on screen. Each spot is read six times, 0.5 s apart, after the tiles settle; the median must be inside the line.
//
//   GAME_URL=http://127.0.0.1:4418 GPU=1 node tests/budget-browser.mjs
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshState, SAVE_KEY } from '../src/game.mjs';

const url = process.env.GAME_URL ?? 'http://127.0.0.1:4418';
const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome', headless: true, args: process.env.GPU ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const VIEWS = { pc: { viewport: { width: 1440, height: 900 }, quality: 'high', triangles: 400000 }, phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, quality: 'battery', triangles: 250000 } };
// [name, x, z, box open, riding]: the spots the reviews measured over the line. The village's draw lines: PC 240, phone main's 98 + 20.
const SPOTS = [['village', 8, 18, false], ['village, box open', 8, 18, true], ['homestead', 0, -8, false], ['north middle, box open', 0, -128, true], ['croc den, box open', 21.9, -139.6, true],
  ['toy border, box open', -67, -128, true], ['village border', 54, 0, false], ['west village in the jeep, box open', -35, -16, true, true]];
const errors = [], results = [];
await mkdir('test-results', { recursive: true });
const median = a => [...a].sort((p, q) => p - q)[a.length >> 1];
try {
  for (const [view, v] of Object.entries(VIEWS)) for (const [name, x, z, box, riding] of SPOTS) {
    const seed = freshState(); seed.started = true; seed.position = { x, z }; seed.time = 12; seed.pandora = box; seed.settings.quality = v.quality;
    if (riding) { seed.stats.sales = 999; seed.riding = 'jeep'; seed.vehicles = { jeep: { x, z, rot: 0 }, bike: null }; }
    const context = await browser.newContext({ viewport: v.viewport, isMobile: !!v.isMobile, hasTouch: !!v.hasTouch, deviceScaleFactor: 1 });
    await context.addInitScript(({ key, seed }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(seed)); }, { key: SAVE_KEY, seed });
    const page = await context.newPage(); page.setDefaultTimeout(120000);
    page.on('pageerror', e => errors.push(e.message)); page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    await page.goto(url); await page.waitForFunction(() => window.willowmere?.metrics().ready, null, { timeout: 120000 });
    await (v.hasTouch ? page.locator('#begin').tap() : page.locator('#begin').click());
    await page.waitForFunction(() => willowmere.metrics().tilesPending === 0 && willowmere.metrics().fields.queued === 0, null, { timeout: 120000 });
    await page.waitForTimeout(2500);
    const triangles = [], draws = [];
    for (let i = 0; i < 6; i++) { await page.evaluate(() => willowmere.calls()); await page.waitForTimeout(500); const c = await page.evaluate(() => willowmere.calls()); triangles.push(c.triangles); draws.push(c.calls); }
    const m = await page.evaluate(() => willowmere.metrics()), row = { view, name, x, z, box, riding: m.riding, at: [Math.round(m.position.x), Math.round(m.position.z)], triangles: median(triangles), draws: median(draws), most: Math.max(...triangles) };
    results.push(row); console.log(JSON.stringify(row));
    assert.ok(Math.hypot(m.position.x - x, m.position.z - z) < 3, `${view} ${name}: still at the spot`);
    assert.ok(row.triangles < v.triangles, `${view} ${name}: ${row.triangles.toLocaleString()} triangles against the line of ${v.triangles.toLocaleString()}`);
    if (name.startsWith('village') && !riding) assert.ok(row.draws <= (view === 'pc' ? 240 : 118), `${view} ${name}: ${row.draws} draws`);
    await context.close();
  }
  assert.deepEqual(errors, []);
  console.log(`budget-browser: ${results.length} spots inside the section 18 triangle lines`);
} finally {
  await writeFile('test-results/budget-results.json', JSON.stringify({ results, errors }, null, 2));
  await browser.close();
}
