// Draw calls, triangles and frame time near the pond: BASE_URL (an older build) against GAME_URL, desktop and a throttled phone.
//   BASE_URL=http://127.0.0.1:4453 GAME_URL=http://127.0.0.1:4452 GPU=1 node tests/pond-perf.mjs
import { chromium } from 'playwright';
import { freshState, SAVE_KEY } from '../src/game.mjs';
import { POND } from '../src/content.mjs';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const out = [];
for (const [label, url] of [['before', process.env.BASE_URL], ['after', process.env.GAME_URL]]) for (const [screen, [w, h, throttle]] of Object.entries({ desktop: [1440, 900, 1], phone: [390, 844, 4] })) {
  const mobile = screen === 'phone', state = Object.assign(freshState(), { started: true, position: { x: POND.x + 1, z: POND.z - POND.d / 2 - .9 } });
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  await ctx.addInitScript(({ key, state }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state)); }, { key: SAVE_KEY, state });
  const page = await ctx.newPage(); await page.goto(url); await page.waitForFunction(() => window.willowmere?.metrics().ready, null, { timeout: 90000 }); await page.locator('#begin').click(); await page.waitForTimeout(4000);
  if (throttle > 1) await (await ctx.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: throttle });
  const frames = () => page.evaluate(() => new Promise(r => { const d = []; let last = performance.now(); const f = t => { d.push(t - last); last = t; if (d.length < 180) requestAnimationFrame(f); else { d.sort((a, b) => a - b); r({ mean: d.reduce((a, b) => a + b) / d.length, p95: d[Math.floor(d.length * .95)] }); } }; requestAnimationFrame(f); }));
  const calls = await page.evaluate(() => willowmere.calls()), idle = await frames();
  let fight = null;
  if (label === 'after') {
    const p = await page.evaluate(([x, z]) => willowmere.project(x, z, .3), [POND.x + 2.5, POND.z - POND.d / 2 + 3.2]); await (mobile ? page.touchscreen.tap(p.x, p.y) : page.mouse.click(p.x, p.y));
    await page.waitForFunction(() => ['bite', 'hooked'].includes(willowmere.metrics().fishing.phase), null, { timeout: 60000, polling: 50 }); await page.keyboard.down('Space'); await page.waitForTimeout(500); fight = await frames(); await page.keyboard.up('Space');
  }
  const pond = await page.evaluate(() => willowmere.metrics().pond);
  out.push({ label, screen, calls, idle, fight, draws: pond?.draws, fish: pond?.n }); console.log(JSON.stringify(out.at(-1))); await ctx.close();
}
await browser.close();
