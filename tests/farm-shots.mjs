// Screenshots for the fruit-tree spots and the supermarket (before / after evidence), on three screens.
//   GAME_URL=http://127.0.0.1:<port> GPU=1 MODE=after OUT=<folder> node tests/farm-shots.mjs
// MODE=before runs the same scenes on a build that still has the orchard panel and the country market.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { freshState, SAVE_KEY } from '../src/game.mjs';

const MODE = process.env.MODE ?? 'after', OUT = process.env.OUT ?? `test-results/farm-${MODE}`, base = process.env.GAME_URL ?? 'http://127.0.0.1:4173', after = MODE === 'after';
const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome', headless: true, args: process.env.GPU ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
await mkdir(OUT, { recursive: true });
const SCREENS = { desktop: [1440, 900], landscape: [844, 390], phone: [390, 844] }, errors = [];
const seed = (extra = {}) => Object.assign(freshState(), { started: true, coins: 900, day: 10, time: 9, inventory: { carrot: 6, apple: 4, mango: 3, perch: 2 }, stats: { ...freshState().stats, sales: 260 }, ...extra });
async function open(state, screen) {
  const [width, height] = SCREENS[screen], mobile = screen !== 'desktop';
  const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  await context.addInitScript(({ key, state }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state)); }, { key: SAVE_KEY, state });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.goto(base); await page.waitForFunction(() => window.willowmere?.metrics().ready, null, { timeout: 90000 }); await page.locator('#begin').click(); await page.waitForFunction(() => !document.querySelector('#toast').classList.contains('show'), null, { timeout: 9000 }).catch(() => {}); await page.waitForTimeout(500);
  return { page, context, mobile, tap: (x, y) => mobile ? page.touchscreen.tap(x, y) : page.mouse.click(x, y) };
}
const shot = (page, name, screen) => page.screenshot({ path: `${OUT}/${name}-${screen}.png` });
const act = async (page, mobile) => { if (mobile) await page.locator('#touch-action').tap({ force: true }); else await page.keyboard.press('e'); await page.waitForTimeout(700); };
const CLEARED = [119, 120, 121];

for (const screen of Object.keys(SCREENS)) {
  // 1 + 2. A cleared tree's stump, and the picker (before: the orchard circle's panel).
  {
    const { page, context, mobile } = await open(seed({ cleared: CLEARED, position: after ? { x: -25.8, z: -4.2 } : { x: -20, z: 17.4 } }), screen);
    await shot(page, '1-stump', screen); await act(page, mobile); await shot(page, '2-picker', screen);
    if (after && screen === 'phone') { await page.locator('.modal-content').evaluate(el => el.scrollTo(0, el.scrollHeight)); await page.waitForTimeout(300); await shot(page, '2-picker-scrolled', screen); }
    await context.close();
  }
  // 3. Each growth stage: sapling, young, bearing (after: on the cleared spots; both: in the orchard circles).
  {
    const planted = { 119: { kind: 'mango', day: 10, picked: 0 }, 120: { kind: 'mango', day: 8, picked: 0 }, 121: { kind: 'apple', day: 4, picked: 0 } };
    const trees = [{ kind: 'peach', day: 10, picked: 0 }, { kind: 'peach', day: 9, picked: 0 }, { kind: 'apple', day: 3, picked: 0 }];
    const { page, context, mobile } = await open(seed({ cleared: CLEARED, planted, trees, position: { x: -26.6, z: 4.3 } }), screen);
    await shot(page, '3-stages-spots', screen);
    if (after) { await page.evaluate(() => 0); await act(page, mobile); await shot(page, '3-young-tree-card', screen); await page.keyboard.press('Escape'); }
    await context.close();
    const o = await open(seed({ cleared: CLEARED, planted, trees, position: { x: -14, z: 18.3 } }), screen);
    await shot(o.page, '3-stages-orchard', screen); await o.context.close();
  }
  // 4. East of Willow & Co.: the supermarket from the game camera (before: the trees that stood there).
  {
    const { page, context } = await open(seed({ position: { x: 34, z: -33.6 } }), screen);
    await shot(page, '4-supermarket-from-company', screen); await context.close();
    const d = await open(seed({ position: { x: 42, z: -35.3 } }), screen);
    await shot(d.page, '4-supermarket-door', screen);
    if (after) { await act(d.page, d.mobile); await shot(d.page, '5-shop-panel', screen); }
    await d.context.close();
  }
  // 5 (before). The country market place and its shop panel.
  if (!after) {
    const { page, context, mobile, tap } = await open(seed({ position: { x: 62, z: 0 } }), screen);
    await shot(page, '5-east-gate', screen); await act(page, mobile); await page.waitForTimeout(800); await shot(page, '5-country-place', screen);
    const t = await page.evaluate(() => willowmere.targets().find(t => t.type === 'shop'));
    if (t) { await tap(t.screen.x, t.screen.y); await page.waitForSelector('#modal-title', { timeout: 30000 }).catch(() => {}); await page.waitForTimeout(700); await shot(page, '5-shop-panel', screen); }
    await context.close();
  } else {
    const { page, context } = await open(seed({ position: { x: 62, z: 0 } }), screen);
    await shot(page, '5-east-gate', screen); await context.close();
  }
  // 6. The minimap near the Town Square's east end, and the full Map.
  {
    const { page, context } = await open(seed({ position: { x: 40, z: -30 } }), screen);
    await page.locator('.minimap').screenshot({ path: `${OUT}/6-minimap-${screen}.png` });
    await page.evaluate(() => document.querySelector('[data-action="openMap"]').click()); await page.waitForTimeout(900); await shot(page, '6-map', screen);
    if (screen === 'phone') { await page.locator('.modal-content').evaluate(el => el.scrollTo(0, el.scrollHeight)); await page.waitForTimeout(300); await shot(page, '6-map-directory', screen); }
    await context.close();
  }
  console.log(MODE, screen, 'done');
}
if (errors.length) console.log('page errors:', errors);
await browser.close();
