// Pictures of the pen and its meadow at 1440x900 and 390x844: PEN_OUT=<dir> GAME_URL=... GPU=1 node tests/pen-shots.mjs
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { freshState, SAVE_KEY } from '../src/game.mjs';
const url = process.env.GAME_URL ?? 'http://127.0.0.1:4541', out = process.env.PEN_OUT ?? 'test-results/pen';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const VIEWS = { desktop: { viewport: { width: 1440, height: 900 } }, phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } };
const SPOTS = [['pen', 15, -12, 12], ['pen-north', 18, -21, 12], ['pen-night', 15, -12, 21]];
for (const [view, vp] of Object.entries(VIEWS)) for (const [name, x, z, hour] of SPOTS) {
  const seed = freshState(); seed.started = true; seed.position = { x, z }; seed.upgrades.pen = 3; seed.time = hour;
  const context = await browser.newContext({ ...vp, deviceScaleFactor: 1 });
  await context.addInitScript(({ key, seed }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(seed)); }, { key: SAVE_KEY, seed });
  const page = await context.newPage(); await page.goto(url); await page.waitForFunction(() => window.willowmere?.metrics().ready, null, { timeout: 90000 });
  await (vp.hasTouch ? page.locator('#begin').tap() : page.locator('#begin').click()); await page.waitForTimeout(4000);
  await page.screenshot({ path: `${out}/${view}-${name}.png` }); await context.close();
}
await browser.close();
