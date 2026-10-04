// The crops in their beds, in a real browser (crop-cards.mjs): for every crop kind and every stage, planted and watered with the game's own
// actions, the rendered crop stands in the middle of its bed and is as tall as Zoo Garden's (sprout .22, young .34, ripe .78 of the bed's side).
// Measured twice: from the game's own numbers (willowmere.crops(): pivot and picture box through the real camera) and from the pixels
// (a screenshot with the beds empty against one with the crops, the shadow and sparkle switched off). Screenshots go to EVIDENCE.
//   GAME_URL=http://127.0.0.1:<port> GPU=1 node tests/crops-browser.mjs
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { freshState, SAVE_KEY, act } from '../src/game.mjs';
import { CROPS, BED_POSITIONS } from '../src/content.mjs';
import { SHARE } from '../src/crop-cards.mjs';

const EVIDENCE = process.env.EVIDENCE ?? 'C:/Users/n/source/repos/cute_game-notes/willowmere/evidence-crops/after/';
const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome', headless: true, args: process.env.GPU ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const base = process.env.GAME_URL ?? 'http://127.0.0.1:4173', errors = []; await mkdir(EVIDENCE, { recursive: true });
const SCREENS = { desktop: [1440, 900], phone: [390, 844] };
const KINDS = Object.keys(CROPS), BEDS = [1, 3, 8, 10, 13, 15, 20], STAGES = { sprout: null, young: .7, ripe: 1 };
// Planted and watered through act(); the clock then says how far along each one is.
function seed(progress, empty = false) {
  const s = Object.assign(freshState(), { started: true, plots: 12, day: 12, time: 12, elapsed: 1000, energy: 100, position: { x: -15.5, z: -7 } }); s.beds = Array(30).fill(null);
  if (empty) return s;
  KINDS.forEach((crop, k) => {
    s.inventory['seed_' + crop] = 3; const index = BEDS[k];
    assert.ok(act(s, 'plant', { index, crop }).ok !== false, 'plant ' + crop);
    if (progress !== null) { act(s, 'water', { index }); s.beds[index].planted = s.elapsed - CROPS[crop].grow * progress; }
  });
  return s;
}
async function open(state, [width, height]) {
  const mobile = width < 500, context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  await context.addInitScript(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: SAVE_KEY, state });
  const page = await context.newPage(); page.setDefaultTimeout(60000); page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(base); await page.waitForFunction(() => window.willowmere?.metrics().ready, null, { timeout: 90000 }); await page.locator('#begin').click();
  await page.waitForFunction(() => window.willowmere.crops()?.diagnostics(), null, { timeout: 30000 }); await page.waitForTimeout(2200);
  return { page, context };
}
/** The changed pixels between two screenshots, per planted bed (only the pixels near the crop's expected box count: a bird flying past does not), as a box. Decoded and compared in a blank page. */
const decoder = await (await browser.newContext()).newPage();
const boxes = (empties, plants, infos) => decoder.evaluate(async ({ empties, plants, infos }) => {
  const read = async data => { const img = new Image(); img.src = 'data:image/png;base64,' + data; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, img.width, img.height); };
  const E = await Promise.all(empties.map(read)), P = await Promise.all(plants.map(read)), A = E[0], W = A.width, out = {}; for (const i of infos) out[i.bed] = { x0: 1e9, x1: -1, y0: 1e9, y1: -1, n: 0 };
  for (let y = 0; y < A.height; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 4; if (E.some(e => P.some(q => Math.abs(e.data[o] - q.data[o]) + Math.abs(e.data[o + 1] - q.data[o + 1]) + Math.abs(e.data[o + 2] - q.data[o + 2]) < 36))) continue;
    let best = null, d = 1e18; for (const i of infos) { const pad = .25 * i.bedPx; if (x < i.box.x0 - pad || x > i.box.x1 + pad || y < i.box.y0 - pad || y > i.box.y1 + pad) continue; const dd = (x - (i.box.x0 + i.box.x1) / 2) ** 2 + (y - (i.box.y0 + i.box.y1) / 2) ** 2; if (dd < d) { d = dd; best = i; } }
    if (best) { const r = out[best.bed]; r.x0 = Math.min(r.x0, x); r.x1 = Math.max(r.x1, x); r.y0 = Math.min(r.y0, y); r.y1 = Math.max(r.y1, y); r.n++; }
  }
  return out;
}, { empties: empties.map(b => b.toString('base64')), plants: plants.map(b => b.toString('base64')), infos });
const rows = [];
for (const [name, size] of Object.entries(SCREENS)) {
  const empty = await open(seed(null, true), size); await empty.page.evaluate(() => willowmere.crops().setMarks(false)); await empty.page.waitForTimeout(300);
  const flat = [await empty.page.screenshot()]; await empty.page.waitForTimeout(1800); flat.push(await empty.page.screenshot()); await empty.context.close();
  for (const [stage, progress] of Object.entries(STAGES)) {
    const env = await open(seed(stage === 'sprout' ? null : progress), size), { page } = env;
    await page.screenshot({ path: `${EVIDENCE}wm-${name}-${stage}-marks.png` });
    await page.evaluate(() => willowmere.crops().setMarks(false)); await page.waitForTimeout(500);
    const infos = await page.evaluate(() => willowmere.crops().info()), shot = await page.screenshot({ path: `${EVIDENCE}wm-${name}-${stage}.png` }), shot2 = (await page.waitForTimeout(1800), await page.screenshot()), px = await boxes(flat, [shot, shot2], infos);
    assert.equal(infos.length, KINDS.length, 'every planted bed is drawn');
    for (const i of infos) {
      assert.equal(i.stage, stage, `${i.crop} is ${stage}`);
      // From the game's numbers: the pivot is the middle of the bed, the picture is as tall as the share of the bed's side.
      const centre = (i.box.x0 + i.box.x1) / 2 - i.bedScreen.x, tall = (i.box.y1 - i.box.y0) / i.bedPx;
      assert.ok(Math.abs(i.baseScreen.x - i.bedScreen.x) < 1e-6 && Math.abs(i.base.x - BED_POSITIONS[i.bed].x) < 1e-9 && Math.abs(i.base.z - BED_POSITIONS[i.bed].z) < 1e-9, `${i.crop} pivot is the bed's centre`);
      assert.ok(Math.abs(centre) / i.bedPx < .05, `${name} ${stage} ${i.crop}: picture centre off by ${(centre / i.bedPx * 100).toFixed(1)}% of the bed`);
      assert.ok(tall / SHARE[stage] > .9 && tall / SHARE[stage] < 1.36, `${name} ${stage} ${i.crop}: height ${tall.toFixed(3)} bed sides, reference ${SHARE[stage]}`);
      // From the pixels.
      const p = px[i.bed]; assert.ok(p.n > 40, `${name} ${stage} ${i.crop} draws something (${p.n} px)`);
      const pw = p.x1 - p.x0 + 1, ph = p.y1 - p.y0 + 1, dx = (p.x0 + p.x1) / 2 - i.bedScreen.x, ht = ph / i.bedPx;
      assert.ok(Math.abs(dx) / i.bedPx < .05, `${name} ${stage} ${i.crop}: pixels centre off by ${(dx / i.bedPx * 100).toFixed(1)}% pixels ${JSON.stringify(p)} geometry ${JSON.stringify(i.box)} bed ${JSON.stringify(i.bedScreen)}`);
      assert.ok(ht / SHARE[stage] > .88 && ht / SHARE[stage] < 1.12 + 3 / i.bedPx, `${name} ${stage} ${i.crop}: pixel height ${ht.toFixed(3)} bed sides, reference ${SHARE[stage]} pixels ${JSON.stringify(p)} geometry ${JSON.stringify(i.box)}`);
      assert.ok(p.y1 > i.bedScreen.y - .1 * i.bedPx && p.y1 < i.bedScreen.y + .3 * i.bedPx, `${name} ${stage} ${i.crop}: stands on the soil at the bed's middle (bottom ${((p.y1 - i.bedScreen.y) / i.bedPx).toFixed(2)})`);
      assert.ok(pw < 2.4 * i.bedPx * 1.1 && pw / i.bedPx < 1.25 * 1.2, `${name} ${stage} ${i.crop}: not wider than the bed spacing (${(pw / i.bedPx).toFixed(2)} bed sides)`);
      rows.push({ screen: name, stage, crop: i.crop, bedPx: +i.bedPx.toFixed(1), geomCentre: +(centre / i.bedPx * 100).toFixed(1), geomHeight: +tall.toFixed(3), pxCentre: +(dx / i.bedPx * 100).toFixed(1), pxHeight: +ht.toFixed(3), pxWidth: +(pw / i.bedPx).toFixed(2), bottom: +((p.y1 - i.bedScreen.y) / i.bedPx).toFixed(2), ref: SHARE[stage] });
    }
    if (stage === 'ripe') {
      // Tapping a crop's picture picks its own bed, not the one in front of it (the bed tap boxes are low, so a ray through a back picture clears the front bed's box).
      const picks = await page.evaluate(infos => { const w = willowmere.crops().world; w.scene.updateMatrixWorld(true); return infos.flatMap(i => [.5, .3].map(f => { const x = (i.box.x0 + i.box.x1) / 2, y = i.box.y0 + (i.box.y1 - i.box.y0) * f; w.pointer.set(x / innerWidth * 2 - 1, -y / innerHeight * 2 + 1); w.raycast.setFromCamera(w.pointer, w.camera); const hit = w.raycast.intersectObjects(w.activeTargets().map(t => t.hit), false)[0]?.object.userData.target; return { bed: i.bed, f, got: hit?.type === 'bed' ? hit.id : null }; })); }, infos);
      for (const q of picks) assert.ok(q.got === q.bed || q.got === null, `${name}: a tap at ${q.f} of bed ${q.bed}'s picture picks bed ${q.got}`);
      assert.ok(picks.filter(q => q.got === q.bed).length >= picks.length * .7, `${name}: most taps on a picture pick its own bed (${picks.filter(q => q.got === q.bed).length}/${picks.length})`);
    }
    const calls = await page.evaluate(() => willowmere.calls()), info = await page.evaluate(() => willowmere.crops()?.diagnostics()); rows.push({ screen: name, stage, calls, cards: info.cards, ground: info.ground });
    await env.context.close();
  }
}
console.log(JSON.stringify(rows.filter(r => r.crop === undefined), null, 0));
console.table(rows.filter(r => r.crop));
// The crop-cards chunk failing to load (a flaky network, a deploy swapping chunk names) must not take the game down: it starts without the crops, and says so.
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } }); await context.addInitScript(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: SAVE_KEY, state: seed(1) });
  const page = await context.newPage(), warns = []; page.setDefaultTimeout(60000); page.on('console', m => { if (m.type() === 'warning') warns.push(m.text()); });
  await page.route(/chunk-[A-Z0-9]+\.js/, async route => { const r = await route.fetch(); const body = await r.text(); if (body.includes('aInfo')) await route.abort(); else await route.fulfill({ response: r, body }); });
  await page.goto(base); await page.waitForFunction(() => window.willowmere?.metrics().ready, null, { timeout: 90000 }); await page.locator('#begin').click(); await page.waitForTimeout(1500);
  assert.equal(await page.evaluate(() => willowmere.crops() ? 'cards' : 'none'), 'none', 'no crop cards when the chunk is unreachable'); assert.ok(warns.length, 'the failure is warned about'); await context.close();
}
assert.deepEqual(errors, [], 'no console errors');
await browser.close(); console.log('crops-browser: ok');
