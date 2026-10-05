// Focused handoff smoke: local music/appearance parity, outdoor schools, phone views and an old save.
// GAME_URL=http://127.0.0.1:4587 GPU=1 node tests/village-handoff-browser.mjs
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshState, SAVE_KEY } from '../src/game.mjs';
import { FEATURES } from '../src/land-features.mjs';
import { FIELD_FISH } from '../src/field-fish.mjs';
const out = 'test-results/handoff', report = [], errors = [];
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const url = process.env.GAME_URL ?? 'http://127.0.0.1:4587';
async function setup(state, viewport, phone = false) {
  const context = await browser.newContext({ viewport, isMobile: phone, hasTouch: phone, deviceScaleFactor: 1 });
  await context.addInitScript(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: SAVE_KEY, state });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(url); await page.waitForFunction(() => window.willowmere?.metrics().ready, null, { timeout: 90000 });
  await page.locator('#begin').click(); await page.waitForFunction(() => willowmere.test.music, null, { timeout: 30000 });
  return { page, context };
}
const seed = (position, extra = {}) => { const s = Object.assign(freshState(), { started: true, time: 11, position }, extra); s.settings.test = true; return s; };
try {
  for (const [name, viewport, phone] of [['desktop', { width: 1440, height: 900 }, false], ['portrait', { width: 390, height: 844 }, true], ['landscape', { width: 844, height: 390 }, true]]) {
    const s = seed({ x: 17, z: -5 }); s.upgrades.pond = 3; s.upgrades.pen = 3;
    const { page, context } = await setup(s, viewport, phone);
    await page.waitForFunction(() => willowmere.render().pen.range && willowmere.test.npc('june')?.outfit && !willowmere.test.npc('june')?.pending);
    await page.waitForTimeout(1500);
    const parity = await page.evaluate(() => {
      const clothes = willowmere.test.npc('june').outfit, before = willowmere.test.music.probe(); willowmere.test.box(true);
      return { clothes, afterClothes: willowmere.test.npc('june').outfit, before, after: willowmere.test.music.probe() };
    });
    assert.equal(parity.afterClothes, parity.clothes); assert.equal(parity.after.region, 'village'); assert.equal(parity.after.fight, null); assert.equal(parity.after.threatened, false);
    await page.waitForTimeout(800); await page.screenshot({ path: `${out}/${name}-pond.png` });
    const music = await page.evaluate(() => willowmere.test.music.state()); assert.equal(music.plan.main, 'village'); assert.equal(music.plan.fight, null); assert.equal(music.plan.tension, false);
    report.push({ view: name, localMusic: music.plan.main, calls: await page.evaluate(() => willowmere.calls()), range: await page.evaluate(() => willowmere.render().pen.range) });
    // A held outdoor fight stops affecting the local score on the next probe.
    await page.evaluate(() => willowmere.test.music.force({ region: 'west', inside: true, fight: { kind: 'boss', region: 'west', phase: 1 }, threatened: true }));
    await page.waitForFunction(() => willowmere.test.music.state().plan.fight === 'boss');
    await page.evaluate(() => willowmere.test.music.force({ region: 'village', inside: false }));
    await page.waitForFunction(() => { const p = willowmere.test.music.state().plan; return p.main === 'village' && p.fight === null && !p.tension; });
    await context.close();
  }
  for (const [region, pool] of Object.entries(FIELD_FISH)) for (const [i, pond] of FEATURES[region].ponds.entries()) {
    const phone = region === 'toy', s = seed({ x: pond.x, z: pond.z + pond.r + 1 });
    const { page, context } = await setup(s, phone ? { width: 390, height: 844 } : { width: 1440, height: 900 }, phone);
    const id = `${region}-${i}`; await page.waitForFunction(id => willowmere.render().fieldFish?.ponds.includes(id), id);
    const a = await page.evaluate(() => willowmere.render().fieldFish); await page.waitForTimeout(1500);
    const b = await page.evaluate(() => willowmere.render().fieldFish), school = b.schools.find(s => s.id === id);
    assert.ok(b.fish >= (phone ? 3 : 6)); assert.ok(b.draws <= 12, `${id}: ${b.draws} fish draws`);
    assert.deepEqual([...new Set(school.fish.map(f => f.species))].sort(), [...pool].sort());
    for (const f of school.fish) assert.ok(Math.hypot(f.x - pond.x, f.z - pond.z) < pond.r - .4, `${id}: fish on the water`);
    assert.notDeepEqual(school.fish, a.schools.find(s => s.id === id).fish, 'the school swims');
    await page.screenshot({ path: `${out}/${id}.png` }); report.push({ pond: id, fish: b.fish, draws: b.draws, species: pool });
    await context.close();
  }
  const old = seed({ x: 12, z: 10.6 }, { cleared: [3, 127], planted: { 127: { kind: 'apple', day: 1, picked: 0 } }, inventory: { perch: 2, golden: 1, seed_carrot: 6 } });
  for (const key of ['vehicles', 'riding', 'heading', 'defeated', 'friends', 'house', 'look']) delete old[key];
  const { page, context } = await setup(old, { width: 1440, height: 900 });
  const saved = await page.evaluate(() => willowmere.snapshot()); assert.deepEqual(saved.cleared, old.cleared); assert.deepEqual(saved.planted, old.planted); assert.deepEqual(saved.inventory, old.inventory);
  const actual = await page.evaluate(() => willowmere.render().player); assert.ok(actual.z < -2, 'the enlarged pond moves an old dock save onto dry land');
  report.push({ oldSave: 'progress and trees retained, player safely on land' }); await context.close();
  assert.deepEqual(errors, []); await writeFile(`${out}/results.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
  console.log('village handoff browser: ok');
} finally { await browser.close(); }
