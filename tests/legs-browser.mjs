// After a vehicle the avatar stands the way it always did: for the motorcycle and the jeep, getting off by E, after Home
// while riding, with the Tall body, and after a save with another look is loaded while riding, a second of walking shows
// legs with no splay left on z, a swing like a never-rode avatar's, and the lower foot on the ground.
//
//   GAME_URL=http://127.0.0.1:<port> GPU=1 node tests/legs-browser.mjs      (EVIDENCE=<dir> keeps 8-frame sequences, 100 ms apart)
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { freshState, SAVE_KEY } from '../src/game.mjs';

const url = process.env.GAME_URL ?? 'http://127.0.0.1:4173', evidence = process.env.EVIDENCE;
const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome', headless: true, args: process.env.GPU ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [], results = [];
const VIEWS = { desktop: { viewport: { width: 1440, height: 900 } }, phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } };
const EAST = Math.PI / 2 + .38, AT = { x: -300, z: 10 };
const helpers = () => { window.__frames = (n, each) => new Promise(resolve => { const out = []; let i = 0, last = performance.now(); const tick = now => { out.push(each(i, now - last)); last = now; if (++i >= n) resolve(out); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); }); };
async function setup(view, id, look) {
  const seed = freshState(); seed.started = true; seed.bike = true; seed.stats.sales = 100000; seed.position = { ...AT };
  if (look) seed.look = look; if (id) { seed.riding = id; seed.heading = EAST; seed.vehicles[id] = { ...AT, rot: EAST }; }
  const context = await browser.newContext({ ...VIEWS[view], deviceScaleFactor: 1 });
  await context.addInitScript(({ key, seed }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(seed)); }, { key: SAVE_KEY, seed });
  await context.addInitScript(helpers);
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(url); await page.waitForFunction(() => window.willowmere?.metrics().ready, null, { timeout: 90000 });
  await (VIEWS[view].hasTouch ? page.locator('#begin').tap() : page.locator('#begin').click());
  await page.waitForFunction(() => typeof willowmere.render === 'function', null, { timeout: 15000 });
  await page.waitForTimeout(500); return { page, context };
}
const off = async q => { await q.keyboard.press('e'); await q.waitForFunction(() => !willowmere.render().riding, null, { timeout: 5000 }); };
/** Walks east for a second; what the legs and the feet did. */
async function walk(q, view, name) {
  await q.keyboard.down('d'); await q.waitForTimeout(250);
  const run = await q.evaluate(() => __frames(40, () => { const f = willowmere.feet(), P = willowmere.render().player; return { x: f.legs, z: P.legsZ, low: f.low }; }));
  if (evidence) for (let i = 0; i < 8; i++) { await q.screenshot({ path: `${evidence}/${name}-${view}-${i}.png` }); await q.waitForTimeout(100); }
  await q.keyboard.up('d');
  const swing = Math.max(...run.map(f => Math.max(Math.abs(f.x[0]), Math.abs(f.x[1])))), splay = Math.max(...run.map(f => Math.max(Math.abs(f.z?.[0] ?? 9), Math.abs(f.z?.[1] ?? 9))));
  return { swing, splay, low: [Math.min(...run.map(f => f.low)), Math.max(...run.map(f => f.low))] };
}
const check = (name, got, base) => {
  assert.ok(got.splay < 1e-6, `${name}: no splay left on the legs (z up to ${got.splay.toFixed(3)} rad)`);
  assert.ok(got.swing > base.swing * .6 && got.swing < base.swing * 1.2 + .05, `${name}: walks with the same swing (${got.swing.toFixed(2)} vs ${base.swing.toFixed(2)} rad)`);
  assert.ok(got.low[0] > base.low[0] - .02 && got.low[1] < base.low[1] + .02 && Math.abs(got.low[0]) < .03, `${name}: the lower foot rides on the ground (${got.low.map(v => v.toFixed(3))} vs ${base.low.map(v => v.toFixed(3))})`);
  results.push({ name, ...got });
};
/** A never-rode avatar's walk for a look. */
const baseline = async (view, look, name) => { const { page, context } = await setup(view, null, look); const b = await walk(page, view, name); assert.ok(b.splay < 1e-6); await context.close(); results.push({ name: `${view}: never rode (${look ?? 'default'})`, ...b }); return b; };
try {
  if (evidence) await mkdir(evidence, { recursive: true });
  for (const view of ['desktop', 'phone']) {
    const base = await baseline(view, null, 'never-rode');
    for (const id of ['bike', 'jeep']) {
      { // off by E
        const { page: q, context } = await setup(view, id); assert.equal(await q.evaluate(() => willowmere.render().riding), id);
        assert.ok((await q.evaluate(() => willowmere.render().player)).legs[0] < -.5, 'seated, legs forward');
        await off(q); check(`${view} ${id}: off by E`, await walk(q, view, `after-${id}`), base); await context.close();
      }
      if (view !== 'desktop') continue;
      { // the Tall body
        const tallBase = await baseline(view, 'boy-tall-none-none', 'never-rode-tall');
        const { page: q, context } = await setup(view, id, 'boy-tall-none-none'); await off(q); check(`${view} ${id}: Tall body off by E`, await walk(q, view, `after-${id}-tall`), tallBase); await context.close();
      }
      { // Home keeps you on the vehicle; then E
        const { page: q, context } = await setup(view, id);
        await q.locator('.home-button').click(); await q.waitForFunction(() => willowmere.metrics().journey.home, null, { timeout: 5000 });
        await q.waitForFunction(() => !willowmere.metrics().journey.home && +getComputedStyle(document.getElementById('home-fade')).opacity < .02, null, { timeout: 30000 });
        assert.equal(await q.evaluate(() => willowmere.render().riding), id, 'Home keeps you on the vehicle');
        await off(q); check(`${view} ${id}: off by E after Home`, await walk(q, view, `home-${id}`), base); await context.close();
      }
      { // A save with another look, loaded while riding: the hero is rebuilt (never cached), seated again, then stands properly.
        const grown = await baseline(view, 'boy-grown-none-none', 'never-rode-grown');
        const { page: q, context } = await setup(view, id);
        const next = await q.evaluate(key => JSON.parse(localStorage.getItem(key)), SAVE_KEY); next.look = 'boy-grown-none-none'; next.looksOwned = [...new Set([...(next.looksOwned ?? []), 'grown'])]; next.riding = id;
        await q.locator('[data-panel="settings"]').click(); await q.locator('#import-file').setInputFiles({ name: 'look.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(next)) });
        await q.waitForFunction(() => willowmere.snapshot().look === 'boy-grown-none-none', null, { timeout: 10000 }); await q.keyboard.press('Escape'); await q.waitForTimeout(800);
        if (await q.evaluate(() => willowmere.render().riding)) { assert.ok((await q.evaluate(() => willowmere.render().player)).legs[0] < -.5, 'the rebuilt hero sits'); await off(q); }
        check(`${view} ${id}: look changed while riding`, await walk(q, view, `look-${id}`), grown); await context.close();
      }
    }
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify(results, null, 1)); console.log('legs-browser: all passed');
} catch (error) { console.error(error); console.error('page errors', errors); process.exitCode = 1; } finally { await browser.close(); }
