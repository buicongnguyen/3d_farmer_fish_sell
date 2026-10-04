// The adaptive quality governor in a real browser (round 8 fix): a slowed CPU steps quality down (pixel share, then the shadow map, then
// the shadow pass), an unslowed one gives the steps back, and without ?governor=1 the governor sleeps under automation.
//
//   GAME_URL=http://127.0.0.1:<port> GPU=1 node tests/governor-browser.mjs
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { freshState, SAVE_KEY } from '../src/game.mjs';

const url = process.env.GAME_URL ?? 'http://127.0.0.1:4411';
const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome', headless: true, args: process.env.GPU ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
async function open(query) {
  const seed = freshState(); seed.started = true; seed.position = { x: 8, z: 18 }; seed.time = 12; seed.settings.quality = 'high';
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await context.addInitScript(({ key, seed }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(seed)); }, { key: SAVE_KEY, seed });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.goto(url + query); await page.waitForFunction(() => window.willowmere?.metrics().ready, null, { timeout: 120000 }); await page.locator('#begin').click();
  await page.waitForFunction(() => willowmere.metrics().tilesPending === 0, null, { timeout: 120000 });
  return { page, context, cdp: await context.newCDPSession(page) };
}
const step = page => page.evaluate(() => willowmere.metrics().step);
try {
  const asleep = await open('');
  await asleep.cdp.send('Emulation.setCPUThrottlingRate', { rate: 12 }); await asleep.page.waitForTimeout(14000);
  assert.equal(await step(asleep.page), 0, 'asleep under automation'); await asleep.context.close();
  const { page, context, cdp } = await open('?governor=1');
  assert.equal(await step(page), 0, 'starts at the full setting');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 14 });
  await page.waitForFunction(() => willowmere.metrics().step >= 1, null, { timeout: 60000 });
  const down = await step(page), ratio = await page.evaluate(() => document.getElementById('game').width / innerWidth);
  assert.ok(ratio < 1, `the pixel share fell: ${ratio}`);
  // The pond (8, 18 is 15 m from the water) follows the governor: a step below the top keeps the phone's pond (5 fish, fewer effects), and gives the school back with the step.
  await page.waitForFunction(() => willowmere.metrics().pond?.light === true, null, { timeout: 10000 }); assert.equal((await page.evaluate(() => willowmere.metrics().pond)).n, 5, 'a governed pond keeps 5 fish');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.waitForFunction(s => willowmere.metrics().step < s, down, { timeout: 90000 });
  await page.waitForFunction(() => willowmere.metrics().step === 0 && willowmere.metrics().pond?.light === false, null, { timeout: 90000 }); assert.equal((await page.evaluate(() => willowmere.metrics().pond)).n, 8, 'the full school is back at step 0');
  console.log(`governor-browser: stepped down to ${down} (pixel ratio ${ratio.toFixed(2)}) and back to ${await step(page)}`);
  await context.close();
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
