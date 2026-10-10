// The missing workers in a real browser: for three lands (a home region and two planets), on 1440x900 and 390x844: the barred hut
// with its captive and the line a tap gives, the boss beaten with the test hook, the hut opened by a tap, the thank-you, and the
// worker at their facility post with their conversation and favour. Then the People panel, the Map, and the box shut (no huts; the
// rescued stay). Screenshots go to EVIDENCE (default test-results/).
//
//   GAME_URL=http://127.0.0.1:4821 GPU=1 EVIDENCE=<folder> node tests/rescue-browser.mjs      (ONLY=tilly,greta picks the people)
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshState, SAVE_KEY } from '../src/game.mjs';
import { CAMERA_YAW } from '../src/field-layout.mjs';
import { PERSON, hutSpot, THANKS } from '../src/rescued.mjs';

const url = process.env.GAME_URL ?? 'http://127.0.0.1:4821', out = process.env.EVIDENCE ?? 'test-results';
const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome', headless: true, args: process.env.GPU ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [], results = [], numbers = {};
await mkdir(out, { recursive: true });
const VIEWS = { desktop: { viewport: { width: 1440, height: 900 } }, phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } };
const SLOW = 60000, IDS = (process.env.ONLY ?? 'tilly,barnaby,greta').split(',');

async function setup(view, change) {
  const seed = freshState(); seed.started = true; seed.time = 12; change?.(seed);
  const context = await browser.newContext({ ...VIEWS[view], deviceScaleFactor: 1 }), requests = [];
  await context.addInitScript(({ key, seed }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(seed)); }, { key: SAVE_KEY, seed });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message)); page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); }); page.on('request', r => requests.push(r.url()));
  await page.goto(url);
  await page.waitForFunction(() => window.willowmere?.metrics().ready, null, { timeout: 120000 });
  await (VIEWS[view].hasTouch ? page.locator('#begin').tap() : page.locator('#begin').click());
  await page.waitForFunction(() => typeof willowmere.rescue === 'function', null, { timeout: SLOW });
  await page.evaluate(() => willowmere.test?.invulnerable(true));
  const tap = (x, y) => VIEWS[view].hasTouch ? page.touchscreen.tap(x, y) : page.mouse.click(x, y);
  return { page, context, tap, requests, size: VIEWS[view].viewport, view };
}
const rescue = p => p.evaluate(() => willowmere.rescue());
const snapshot = p => p.evaluate(() => willowmere.snapshot());
const toast = p => p.evaluate(() => document.getElementById('toast').textContent);
const shot = (p, name, view) => p.screenshot({ path: `${out}/rescue-${name}-${view}.png` });
async function calls(p, n = 6) { const list = []; for (let i = 0; i < n; i++) { await p.evaluate(() => willowmere.calls()); await p.waitForTimeout(250); const c = await p.evaluate(() => willowmere.calls()); if (c) list.push(c.calls); await p.waitForTimeout(350); } list.sort((a, b) => a - b); return list[0]; } // the least of six: creatures and birds come and go
const front = (at, d, side = 0) => ({ x: at.x + Math.sin(CAMERA_YAW) * d + Math.cos(CAMERA_YAW) * side, z: at.z + Math.cos(CAMERA_YAW) * d - Math.sin(CAMERA_YAW) * side });
const wild = (s, id) => { s.pandora = true; s.hp = 99999; s.settings.test = true; s.position = front(hutSpot(id), 6.5, 1.5); };

try {
  for (const view of Object.keys(VIEWS)) for (const id of IDS) {
    const person = PERSON[id], t = await setup(view, s => wild(s, id)), p = t.page;
    // ---- 1. the barred hut, the captive, the label, the line a tap gives
    await p.waitForFunction(id => willowmere.rescue().huts.find(h => h.id === id)?.built, id, { timeout: SLOW }); await p.waitForTimeout(600);
    let r = await rescue(p), hut = r.huts.find(h => h.id === id);
    assert.equal(r.huts.length, 12, 'twelve huts while the box is open'); assert.equal(hut.state, 'barred'); assert.ok(hut.block && hut.target, 'a collider and a tap');
    assert.ok(hut.label.includes(person.name) && hut.label.startsWith('🔒'), `the label names who is inside (${hut.label})`);
    assert.equal(r.meshes, 2 * r.huts.filter(h => h.built).length, 'a hut is two meshes'); assert.equal(r.shadows, 0, 'and casts no shadow: two draws, by construction');
    assert.ok(hut.screen.x > 0 && hut.screen.x < t.size.width && hut.screen.y > 0 && hut.screen.y < t.size.height, 'the hut is on screen');
    await shot(p, `${id}-1-barred`, view);
    await t.tap(hut.screen.x, hut.screen.y);
    // The boss guards its hut: when it stands in the way the tap is a blow at the boss, and the hut is asked through the hook.
    const said = await p.waitForFunction(() => /shut inside/.test(document.getElementById('toast').textContent), null, { timeout: 8000 }).then(() => 'a tap', () => null);
    if (!said) { await p.evaluate(id => willowmere.rescueTap(id), id); await p.waitForFunction(() => /shut inside/.test(document.getElementById('toast').textContent), null, { timeout: SLOW }); }
    assert.ok(!(await snapshot(p)).rescued[id]);
    results.push(`${view} ${id}: barred hut; ${said ?? 'the hook (the boss took the tap)'} says who is inside`);
    // ---- 2. the boss falls (test hook), the hut can be opened
    let down = false; for (let i = 0; i < 40 && !down; i++) { down = await p.evaluate(den => willowmere.test.defeat(den), person.den); if (!down) await p.waitForTimeout(500); }
    assert.ok(down, 'the boss was there to be beaten');
    await p.waitForFunction(id => willowmere.rescue().huts.find(h => h.id === id)?.state === 'open', id, { timeout: SLOW }); await p.waitForTimeout(500);
    hut = (await rescue(p)).huts.find(h => h.id === id); assert.ok(hut.label.startsWith('🗝'), hut.label);
    // Draw calls of this very frame with and without the huts (both passes): the count over time moves with creatures and birds, so it is drawn twice.
    numbers[`${id}-${view}`] = await p.evaluate(() => willowmere.rescueCost()); assert.ok(numbers[`${id}-${view}`].extra <= 2, `a land with its hut is at most 2 draws more (${numbers[`${id}-${view}`].extra})`);
    await shot(p, `${id}-2-open`, view);
    // ---- 3. a tap opens it: the thank-you, the toast, the save
    await t.tap(hut.screen.x, hut.screen.y);
    await p.waitForFunction(id => willowmere.snapshot().rescued[id] >= 1, id, { timeout: SLOW }); await p.waitForTimeout(700);
    r = await rescue(p); assert.equal(r.cheering, id); assert.equal(r.said, THANKS[id]); assert.match(await toast(p), new RegExp(person.name + ' is free'));
    assert.equal(r.huts.find(h => h.id === id).state, 'rescued');
    await shot(p, `${id}-3-rescued`, view);
    await p.waitForFunction(() => !willowmere.rescue().cheering, null, { timeout: SLOW });
    r = await rescue(p); assert.ok(!r.huts.find(h => h.id === id).target, 'an empty hut takes no tap');
    // ---- 4. at the facility post: a new face, their conversation, their favour
    await p.evaluate(plan => willowmere.facility(plan), person.plan);
    await p.waitForFunction(id => willowmere.metrics().location === 'interior' && willowmere.targets().some(t => t.type === 'person' && t.id === id), id, { timeout: SLOW }); await p.waitForTimeout(2800);
    assert.match(await toast(p), new RegExp(person.name + ' is back at work here'));
    await shot(p, `${id}-4-post`, view);
    const spot = (await p.evaluate(() => willowmere.targets())).find(t => t.type === 'person' && t.id === id);
    const seen = spot.screen.x > 0 && spot.screen.x < t.size.width && spot.screen.y > 0 && spot.screen.y < t.size.height;
    assert.ok(seen || view === 'phone', `${person.name} is on screen at the post`); // a phone shows a part of the building: you walk over
    await p.waitForFunction(() => !document.getElementById('toast').classList.contains('show'), null, { timeout: SLOW }); // the toast would take the tap
    if (seen) await t.tap(spot.screen.x, spot.screen.y);
    const talking = !seen ? false : await p.waitForFunction(() => willowmere.rescue().talking, null, { timeout: 15000 }).then(() => true, () => false);
    if (!talking) { results.push(`${view} ${id}: the tap did not reach the post, opened by the hook`); await p.evaluate(id => willowmere.rescueTalk(id), id); await p.waitForFunction(() => willowmere.rescue().talking, null, { timeout: SLOW }); }
    const choices = p.locator('#rescue-talk .rt-choices button'); assert.equal(await choices.count(), 3);
    const hello = await p.locator('#rescue-talk .rt-say').textContent();
    await choices.nth(0).click(); assert.equal(await choices.count(), 3); const story = await p.locator('#rescue-talk .rt-say').textContent(); await choices.nth(1).click(); await p.waitForTimeout(200);
    const answer = await p.locator('#rescue-talk .rt-say').textContent(); assert.ok(story !== hello && answer !== story && answer !== hello && answer.length > 8, 'the story, then an answer');
    await shot(p, `${id}-5-talk`, view);
    if (await choices.nth(2).textContent() !== 'See you around!') {
      await choices.nth(2).click(); await p.waitForTimeout(200); const after = await snapshot(p);
      assert.equal(after.rescuedPerk[id], after.day, 'the favour is taken for today');
      await choices.nth(2).click(); await p.waitForTimeout(200); assert.match(await p.locator('#rescue-talk .rt-reply').textContent(), /Come back tomorrow/);
      await p.locator('#rescue-talk .rt-close').click();
    } else await choices.nth(2).click();
    assert.ok(!(await rescue(p)).talking);
    results.push(`${view} ${id}: opened after the boss fell; ${person.name} is at the ${person.plan} post and talks`);
    // ---- 5. once: the People panel and the Map
    if (id === IDS[0]) {
      await p.evaluate(() => willowmere.test.leave()); await p.waitForFunction(() => willowmere.metrics().location === 'village', null, { timeout: SLOW });
      await p.evaluate(() => willowmere.test.open('people')); await p.waitForTimeout(500);
      const note = await p.locator('.rescued-note').textContent(); assert.match(note, /1 of 12 are back/); assert.ok(note.includes(person.name) && note.includes('held in'));
      await shot(p, 'people', view);
      await p.evaluate(() => willowmere.test.open('map')); await p.waitForTimeout(1500); await shot(p, 'map', view);
      results.push(`${view}: the People panel lists who is back and who is missing; the Map opens`);
    }
    await t.context.close();
  }
  // ---- 6. the box shut: no hut, no file, no target; the rescued stay at their posts
  {
    const t = await setup('desktop', s => { s.pandora = false; s.settings.test = true; s.rescued = { tilly: 1 }; s.position = front(hutSpot('tilly'), 6.5, 1.5); }), p = t.page;
    await p.waitForTimeout(2500); const r = await rescue(p);
    assert.equal(r.huts.length, 0); assert.equal(r.meshes, 0); assert.ok(!t.requests.some(u => u.includes('rescue-huts.glb')), 'no hut file with the box shut');
    assert.ok(!(await p.evaluate(() => willowmere.targets())).some(t => t.type === 'hut'));
    await shot(p, 'shut-no-hut', 'desktop');
    await p.evaluate(() => willowmere.facility('school'));
    await p.waitForFunction(() => willowmere.metrics().location === 'interior' && willowmere.targets().some(t => t.type === 'person' && t.id === 'tilly'), null, { timeout: SLOW });
    results.push('box shut: no huts, no file; Tilly is still at the school');
    await t.context.close();
  }
  assert.deepEqual(errors, [], 'no page errors, no failed requests');
  console.log(results.map(r => 'ok  ' + r).join('\n')); console.log(JSON.stringify(numbers));
  await writeFile(`${out}/rescue-results.json`, JSON.stringify({ results, numbers }, null, 2));
} catch (error) { console.log(results.map(r => 'ok  ' + r).join('\n')); console.log(JSON.stringify(numbers)); console.error(errors); throw error; } finally { await browser.close(); }
