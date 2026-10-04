// Before-and-after numbers for builder A of round 8 (spec 11.4, section 18): boot time on a phone profile and real draw
// calls at fixed spots. It reads only what every build of the round has (metrics().ready, willowmere.calls()), so the same
// file measures round8 before A's work and after it. Not a test: it asserts nothing and prints JSON.
//   GAME_URL=http://127.0.0.1:4411 GPU=1 node tests/borders-measure.mjs <label> [out file]
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { freshState, SAVE_KEY } from '../src/game.mjs';

const label = process.argv[2] ?? 'run', out = process.argv[3];
const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome', headless: true, args: process.env.GPU ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const base = process.env.GAME_URL ?? 'http://127.0.0.1:4173', result = { label, base, boot: {}, calls: {} };
const seed = (position, quality, extra = {}) => { const s = Object.assign(freshState(), { started: true, coins: 5000, day: 1, time: 12, position, ...extra }); s.settings = { ...s.settings, quality, light: 'day' }; return s; };
async function open(state, width, height, mobile, throttle = 1) {
  const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  await context.addInitScript(({ key, state }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state));
    // The first frame after boot: window.willowmere appears at the end of boot(), with the loop already asked for.
    const watch = () => { if (window.willowmere?.metrics().ready) requestAnimationFrame(() => { window.__firstFrame = performance.now(); }); else requestAnimationFrame(watch); }; requestAnimationFrame(watch);
  }, { key: SAVE_KEY, state });
  const page = await context.newPage();
  if (throttle > 1) { const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle }); }
  await page.goto(base); await page.waitForFunction(() => window.__firstFrame > 0, null, { timeout: 180000 });
  return { page, context };
}
const sample = async page => { const all = []; for (let i = 0; i < 6; i++) { await page.evaluate(() => willowmere.calls()); await page.waitForTimeout(400); all.push(await page.evaluate(() => willowmere.calls())); await page.waitForTimeout(600); } const c = all.map(a => a.calls).sort((a, b) => a - b); return { min: c[0], median: c[3], max: c[5], triangles: all[5].triangles }; };
try {
  // Boot: navigation to the first rendered frame, a phone profile (390 x 844, "battery", CPU throttled 4x), a warm cache; three runs at two places.
  for (const [name, position] of [['homestead', { x: 0, z: -8.8 }], ['fields', { x: 128, z: 0 }]]) {
    const warm = await open(seed(position, 'battery'), 390, 844, true); await warm.context.close(); const runs = [];
    for (let i = 0; i < 3; i++) { const { page, context } = await open(seed(position, 'battery'), 390, 844, true, 4); runs.push(Math.round(await page.evaluate(() => window.__firstFrame))); await context.close(); }
    result.boot[name] = { runs, median: [...runs].sort((a, b) => a - b)[1] }; console.log('boot', name, JSON.stringify(result.boot[name]));
  }
  // Real draw calls with the shadow pass, six samples over 6 s, 2.5 s after "Begin", day 1 at 12:00.
  const SPOTS = [['homestead', { x: 0, z: -8.8 }], ['village', { x: 8, z: 18 }], ['fields-128-0', { x: 128, z: 0 }], ['forest', { x: -128, z: 0 }], ['meadow', { x: 0, z: 128 }]];
  for (const [name, position] of SPOTS) for (const [screen, width, height, quality] of [['pc', 1440, 900, 'high'], ['phone', 390, 844, 'battery'], ['landscape', 844, 390, 'battery']]) {
    const { page, context } = await open(seed(position, quality), width, height, quality === 'battery');
    await (quality === 'battery' ? page.locator('#begin').tap() : page.locator('#begin').click()); await page.waitForTimeout(2500);
    await page.waitForFunction(() => (willowmere.metrics().tilesPending ?? 0) === 0, null, { timeout: 120000 });
    result.calls[`${name}-${screen}`] = await sample(page);
    if (screen === 'pc') { await page.mouse.move(720, 450); for (let i = 0; i < 14; i++) await page.mouse.wheel(0, 400); await page.waitForTimeout(1200); result.calls[`${name}-pc-zoom42`] = await sample(page); }
    console.log(name, screen, JSON.stringify(result.calls[`${name}-${screen}`]), screen === 'pc' ? JSON.stringify(result.calls[`${name}-pc-zoom42`]) : ''); await context.close();
  }
  if (out) await writeFile(out, JSON.stringify(result, null, 2));
} finally { await browser.close(); }
