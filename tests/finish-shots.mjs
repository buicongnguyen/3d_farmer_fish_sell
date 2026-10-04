// Evidence screenshots for the round 8 finish (not a pass/fail suite): GAME_URL, EVIDENCE=<dir>, SHOTS=ember,toast,... ; GPU=1.
import { chromium } from 'playwright';
import { freshState, SAVE_KEY } from '../src/game.mjs';
import { DENS } from '../src/regions.mjs';
import { cageSpot } from '../src/friends.mjs';
const url = process.env.GAME_URL, out = process.env.EVIDENCE, want = (process.env.SHOTS ?? 'ember,toast,panel,phone').split(',');
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const VIEWS = { '1440x900': { viewport: { width: 1440, height: 900 } }, '390x844': { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, '844x390': { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true } };
async function open(view, change, begin = true) {
  const seed = freshState(); seed.started = true; seed.time = 12; change?.(seed);
  const context = await browser.newContext({ ...VIEWS[view], deviceScaleFactor: 1 });
  await context.addInitScript(({ key, seed }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(seed)); }, { key: SAVE_KEY, seed });
  const page = await context.newPage(); await page.goto(url);
  await page.waitForFunction(() => window.willowmere?.metrics().ready, null, { timeout: 120000 });
  if (begin) { await page.evaluate(() => document.getElementById('begin').click()); await page.waitForTimeout(1500); }
  return { page, context };
}
const den = id => DENS.find(d => d.id === id);
const at = (x, z, extra) => s => { s.position = { x, z }; s.pandora = true; s.hp = 99999; s.settings.test = true; extra?.(s); };
if (want.includes('ember')) for (const view of Object.keys(VIEWS)) for (const box of [false, true]) {
  const d = den('w:den:golem'), { page, context } = await open(view, s => { at(d.x + 6, d.z + 8)(s); s.pandora = box; });
  await page.waitForTimeout(4000); await page.screenshot({ path: `${out}/ember-golem-${box ? 'open' : 'shut'}-${view}.png` }); await context.close();
}
if (want.includes('toast')) for (const view of ['1440x900', '390x844']) {
  const { page, context } = await open(view, at(-40, 236), false); await page.waitForTimeout(500);
  await page.evaluate(() => document.getElementById('begin').click()); await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}/wake-far-${view}.png` }); await context.close();
}
if (want.includes('panel')) for (const view of ['1440x900', '390x844']) {
  const { page, context } = await open(view, s => { s.pandora = true; s.position = { x: 0, z: 0 }; }); await page.waitForTimeout(500);
  await page.evaluate(() => { const b = document.createElement('button'); b.dataset.action = 'open'; b.dataset.panel = 'pandora'; document.body.append(b); b.click(); }); await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}/pandora-panel-${view}.png` }); await context.close();
}
if (want.includes('phone')) for (const view of ['390x844', '844x390']) {
  // The treant's slam callout and Clover's cage with the way-home tag; the crowded minimap rims at a land's edge, Shell Beach and the Night Land.
  const t = den('w:den:treant'), c = cageSpot('clover');
  for (const [name, x, z, extra] of [['treant', t.x, t.z + 9, s => { s.defeated = {}; }], ['clover-cage', c.x + 4, c.z + 5, s => { s.defeated.bear = true; }], ['ember-edge', -20, 312], ['beach', 190, -128], ['night', 256, 0]]) {
    const { page, context } = await open(view, s => { at(x, z, extra)(s); }); await page.waitForTimeout(3500);
    if (name === 'treant') await page.evaluate(() => willowmere.test?.skill?.('w:den:treant', 'slam')).catch(() => {});
    await page.waitForTimeout(600); await page.screenshot({ path: `${out}/phone-${name}-${view}.png` }); await context.close();
  }
}
if (want.includes('minimap')) for (const [name, x, z] of [['ember-edge', -20, 312], ['beach', 190, -128], ['night', 256, 0], ['ember-south', -20, 318]]) {
  const seed = freshState(); seed.started = true; at(x, z)(seed);
  const context = await browser.newContext({ ...VIEWS['390x844'], deviceScaleFactor: 3 });
  await context.addInitScript(({ key, seed }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(seed)); }, { key: SAVE_KEY, seed });
  const page = await context.newPage(); await page.goto(url); await page.waitForFunction(() => window.willowmere?.metrics().ready, null, { timeout: 120000 });
  await page.locator('#begin').tap(); await page.waitForTimeout(4000);
  await page.locator('.minimap').screenshot({ path: `${out}/minimap-${name}-390x844.png` }); await context.close();
}
if (want.includes('map')) for (const view of ['390x844', '844x390', '1440x900']) for (const [name, x, z] of [['village', 0, 20], ['ember', -20, 270]]) {
  const { page, context } = await open(view, at(x, z)); await page.waitForTimeout(1500);
  await page.evaluate(() => { const b = document.createElement('button'); b.dataset.action = 'open'; b.dataset.panel = 'map'; document.body.append(b); b.click(); }); await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/map-${name}-${view}.png` }); await context.close();
}
await browser.close();
