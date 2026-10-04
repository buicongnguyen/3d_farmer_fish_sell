// Evidence shots and numbers for builder A of round 8 (the regions, the rainbow borders, the field tiles). Not a test: it
// asserts nothing, it writes pictures and a JSON of measurements.
//   GAME_URL=http://127.0.0.1:4411 GPU=1 node tests/borders-shots.mjs [out dir] [only: a name filter]
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { freshState, SAVE_KEY } from '../src/game.mjs';
import { SAFE } from '../src/ward.mjs';

const out = process.argv[2] ?? 'test-results/borders', only = process.argv[3] ?? '';
const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome', headless: true, args: process.env.GPU ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const base = process.env.GAME_URL ?? 'http://127.0.0.1:4173', errors = [], numbers = {}; await mkdir(out, { recursive: true });
const SCREENS = { phone: [390, 844], landscape: [844, 390], desktop: [1440, 900] };
const seed = (extra = {}) => Object.assign(freshState(), { started: true, coins: 5000, day: 1, time: 12, ...extra });
async function setup(state, screen, { route, settle = true } = {}) {
  const [width, height] = SCREENS[screen], mobile = screen !== 'desktop';
  state.settings = { ...state.settings, quality: mobile ? 'battery' : 'high', light: 'day' };
  const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  await context.addInitScript(({ key, state }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state)); }, { key: SAVE_KEY, state });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  if (route) await route(page);
  await page.goto(base); await page.waitForFunction(() => window.willowmere?.metrics().ready, null, { timeout: 120000 }); await page.locator('#begin').click();
  await page.waitForFunction(settle => window.willowmere.regions && (settle ? willowmere.metrics().tilesPending === 0 : willowmere.metrics().fields.queued === 0), settle, { timeout: 120000 }); await page.waitForTimeout(1200);
  return { page, context };
}
const calls = async page => { const all = []; for (let i = 0; i < 6; i++) { await page.evaluate(() => willowmere.calls()); await page.waitForTimeout(400); all.push(await page.evaluate(() => willowmere.calls())); await page.waitForTimeout(600); } const c = all.map(a => a.calls).sort((a, b) => a - b); return { min: c[0], median: c[3], max: c[5], triangles: all[5].triangles }; };
// name, position, save extras, zoom the wheel out (desktop only)
const SPOTS = [
  ['ward-west', { x: SAFE.x0 + 1.5, z: 6 }], ['ward-south', { x: -6, z: SAFE.z1 - 1.5 }], ['ward-east', { x: SAFE.x1 - 2.5, z: 12 }], ['ward-north', { x: 6, z: SAFE.z0 + 3 }],
  ['ward-west-open', { x: SAFE.x0 + 1.5, z: 6 }, { pandora: true }], ['ward-south-open', { x: -6, z: SAFE.z1 - 1.5 }, { pandora: true }], ['ward-east-open', { x: SAFE.x1 - 2.5, z: 12 }, { pandora: true }], ['ward-north-open', { x: 6, z: SAFE.z0 + 3 }, { pandora: true }],
  ['seam-southwest', { x: -60, z: 52 }], ['seam-northeast', { x: 60, z: -57 }],
  ['shared-east-shadow', { x: 186, z: 4 }], ['shared-west-toy', { x: -128, z: -60 }], ['outer-rim-ice', { x: 0, z: -312 }], ['outer-rim-ocean', { x: 186, z: -128 }], ['notch-toy', { x: -186, z: -70 }],
  ['east-128', { x: 128, z: 0 }], ['meadow-cards', { x: 0, z: 128 }], ['forest', { x: -128, z: 0 }], ['swamp', { x: 0, z: -128 }], ['trail-south', { x: 2, z: 70 }],
  ['homestead', { x: 0, z: -8.8 }], ['village', { x: 8, z: 18 }],
  ['toy', { x: -128, z: -128 }], ['candy', { x: -128, z: 112 }], ['jungle', { x: -256, z: 0 }], ['ice', { x: 0, z: -256 }], ['ocean', { x: 128, z: -128 }], ['lava', { x: -20, z: 270 }], ['cloud', { x: 128, z: 128 }], ['shadow', { x: 256, z: 0 }],
];
try {
  for (const [name, position, extra = {}] of SPOTS) {
    if (only && !name.includes(only)) continue;
    for (const screen of Object.keys(SCREENS)) {
      const { page, context } = await setup(seed({ position, ...extra }), screen);
      await page.screenshot({ path: `${out}/${name}-${screen}.png` });
      numbers[`${name}-${screen}`] = { ...(await calls(page)), fields: (await page.evaluate(() => willowmere.metrics().fields)) };
      if (screen === 'desktop') {
        // The far view: the wheel zoomed right out (zoom 42).
        await page.mouse.move(720, 450); for (let i = 0; i < 12; i++) await page.mouse.wheel(0, 400); await page.waitForTimeout(900);
        await page.screenshot({ path: `${out}/${name}-far.png` }); numbers[`${name}-far`] = await calls(page);
        // And close up (zoom 6): the cards and the pieces as you see them at your feet.
        for (let i = 0; i < 30; i++) await page.mouse.wheel(0, -400); await page.waitForTimeout(900); await page.screenshot({ path: `${out}/${name}-close.png` });
      }
      console.log(name, screen, JSON.stringify(numbers[`${name}-${screen}`]));
      await context.close();
    }
  }
  // Stand-in shapes while a kit is on its way, then the same view filled (the kit files are held back, then let through).
  // With tables that name no fetched kit (step 0's stubs) the two pictures are the same.
  for (const [name, position] of [['standins-east', { x: 100, z: -40 }], ['standins-west', { x: -128, z: 0 }]]) {
    if (only && !name.includes(only)) continue;
    for (const screen of Object.keys(SCREENS)) {
      const gate = { open: null }, hold = new Promise(resolve => { gate.open = resolve; });
      const { page, context } = await setup(seed({ position }), screen, { settle: false, route: page => page.route(/\/assets\/models\/(wilds|worlds-[a-z]+)\.glb/, async r => { await hold; await r.continue(); }) });
      const held = await page.evaluate(() => willowmere.regions().tiles.filter(t => t.standIns).length); await page.screenshot({ path: `${out}/${name}-${screen}-1-held.png` });
      gate.open(); await page.waitForFunction(() => willowmere.metrics().tilesPending === 0, null, { timeout: 120000 }); await page.waitForTimeout(1500); await page.screenshot({ path: `${out}/${name}-${screen}-2-filled.png` });
      numbers[`${name}-${screen}`] = { tilesWithStandIns: held, refills: (await page.evaluate(() => willowmere.metrics().fields)).refills }; console.log(name, screen, JSON.stringify(numbers[`${name}-${screen}`]));
      if (screen === 'desktop' && name === 'standins-east') { const atlas = await page.evaluate(() => willowmere.cardAtlas()); writeFileSync(`${out}/card-atlas.png`, Buffer.from(atlas.image.split(',')[1], 'base64')); numbers.cardAtlas = atlas.cells; }
      await context.close();
    }
  }
  await writeFile(`${out}/numbers${only ? '-' + only : ''}.json`, JSON.stringify({ base, numbers, errors }, null, 2));
  console.log('errors', errors);
} finally { await browser.close(); }
