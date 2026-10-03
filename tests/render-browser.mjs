// Round 7 in a real browser: far, calm creatures do not blink (read from the game's own pixels, frame by frame), the
// sun's shadow grid stays on the ground while the camera moves, the pen animals are Zoo Garden's and stay in their
// yard, and the jeep and the motorcycle drive nose first at 4x to 8x walking speed with the driver seated.
//
//   GAME_URL=http://127.0.0.1:<port> node tests/render-browser.mjs      (GPU=1 uses the real GPU instead of SwiftShader)
//
// Reads only window.willowmere (render, project, wilds, metrics, calls); everything is driven by keys like a player.
// Results go to test-results/render-results.json, filmstrips to test-results/render-*.png.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshState, SAVE_KEY } from '../src/game.mjs';
import { Wilds, inSafeZone } from '../src/wilds.mjs';
import { lightAxes } from '../src/sun-shadow.mjs';
import { VEHICLES } from '../src/drive.mjs';
import { PEN, PEN_ROSTER, penShown } from '../src/pen-roam.mjs';
import { HOUSES } from '../src/content.mjs';

const url = process.env.GAME_URL ?? 'http://127.0.0.1:4173';
const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome', headless: true, args: process.env.GPU ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [], results = [];
await mkdir('test-results', { recursive: true });
const VIEWS = { desktop: { viewport: { width: 1440, height: 900 } }, phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } };
/** In the page: run a function after each of the game's frames, and read a rectangle of the game's canvas (CSS pixels). */
function helpers() {
  window.__frames = (n, each) => new Promise(resolve => { const out = []; let i = 0, last = performance.now(); const tick = now => { out.push(each(i, now - last)); last = now; if (++i >= n) resolve(out); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  window.__grab = (x, y, w, h) => { const c = document.getElementById('game'), gl = c.getContext('webgl2'), k = c.width / innerWidth, bw = Math.round(w * k), bh = Math.round(h * k), px = new Uint8Array(bw * bh * 4); gl.readPixels(Math.round(x * k), c.height - Math.round(y * k) - bh, bw, bh, gl.RGBA, gl.UNSIGNED_BYTE, px); return { w: bw, h: bh, px }; };
  window.__changed = (a, b, tol = 24) => { let n = 0; for (let i = 0; i < a.px.length; i += 4) if (Math.abs(a.px[i] - b.px[i]) > tol || Math.abs(a.px[i + 1] - b.px[i + 1]) > tol || Math.abs(a.px[i + 2] - b.px[i + 2]) > tol) n++; return n; };
}
async function setup(view, change) {
  const seed = freshState(); seed.started = true; change?.(seed);
  const context = await browser.newContext({ ...VIEWS[view], deviceScaleFactor: 1 });
  await context.addInitScript(({ key, seed }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(seed)); }, { key: SAVE_KEY, seed });
  await context.addInitScript(helpers);
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message)); page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(url); await page.waitForFunction(() => window.willowmere?.metrics().ready, null, { timeout: 90000 });
  await (VIEWS[view].hasTouch ? page.locator('#begin').tap() : page.locator('#begin').click());
  await page.waitForFunction(() => typeof willowmere.render === 'function', null, { timeout: 15000 });
  return { page, context };
}
const turn = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
/** A place in the fields where every creature is calm (none can see you) and some stand at mid and far distance. */
function calmSpot() {
  const wilds = new Wilds({}, Math.random); let best = null;
  for (let x = 90; x <= 330; x += 6) for (let z = -150; z <= 150; z += 6) {
    if (inSafeZone(x, z, 12)) continue; wilds.sync(true, x, z);
    const near = wilds.list.map(e => ({ e, d: Math.hypot(e.x - x, e.z - z) })); if (near.some(n => n.d < n.e.def.sight + 3.5)) continue;
    const walkers = near.filter(n => n.d < 21 && n.e.def.speed > 0), kinds = new Set(walkers.map(n => n.e.def.behavior)).size, score = walkers.length + kinds * 2;
    if (walkers.length >= 2 && (!best || score > best.score)) best = { x, z, score };
  }
  return best;
}

try {
  // ---------------------------------------------------------------- 1. far, calm creatures do not blink
  {
    const spot = calmSpot(); assert.ok(spot, 'a calm spot in the fields');
    const { page: p, context } = await setup('desktop', s => { s.pandora = true; s.position = { x: spot.x, z: spot.z }; });
    await p.waitForFunction(() => willowmere.wilds?.().ready && willowmere.wilds().visible > 0, null, { timeout: 30000 }); await p.waitForTimeout(2500);
    const out = await p.evaluate(async () => {
      const W = 110, H = 130, me = willowmere.metrics().position, seen = () => willowmere.render().creatures.filter(c => c.draw?.visible && c.hp > 0);
      const tracks = seen().map(c => ({ id: c.id, type: c.type, phase: c.phase, d: Math.hypot(c.x - me.x, c.z - me.z), s: willowmere.project(c.draw.x, c.draw.z, .4) }))
        .filter(c => c.d > 9 && c.s.x > W / 2 + 2 && c.s.x < innerWidth - W / 2 - 2 && c.s.y > H * .68 + 2 && c.s.y < innerHeight - H * .32 - 2)
        .map(c => ({ ...c, x0: Math.round(c.s.x - W / 2), y0: Math.round(c.s.y - H * .68), changed: [], y: [], yaw: [], lod: [], shadow: [], phases: new Set(), area: 0, prev: null }));
      const ms = await __frames(180, (i, dt) => { const now = new Map(seen().map(c => [c.id, c])); for (const t of tracks) { const c = now.get(t.id); if (!c) continue; const g = __grab(t.x0, t.y0, W, H); if (t.prev) t.changed.push(__changed(t.prev, g)); else { const k = [g.px[0], g.px[1], g.px[2]]; for (let n = 0; n < g.px.length; n += 4) if (Math.abs(g.px[n] - k[0]) + Math.abs(g.px[n + 1] - k[1]) + Math.abs(g.px[n + 2] - k[2]) > 60) t.area++; } t.prev = g; t.y.push(c.draw.y); t.yaw.push(c.draw.yaw); t.lod.push(c.draw.close); t.shadow.push(c.draw.shadow); t.phases.add(c.phase); } return dt; });
      return { ms, tracks: tracks.map(t => ({ id: t.id, type: t.type, d: t.d, area: t.area, changed: t.changed, y: t.y, yaw: t.yaw, lod: t.lod, shadow: t.shadow, phases: [...t.phases] })) };
    });
    const idle = out.tracks.filter(t => t.phases.every(ph => ph === 'idle') && t.changed.length > 100 && t.area > 150); assert.ok(idle.length >= 2, `calm creatures on screen (${idle.length})`);
    const rows = idle.map(t => {
      const jump = list => Math.max(...list.slice(1).map((v, i) => Math.abs(v - list[i]))), flips = list => list.slice(1).filter((v, i) => v !== list[i]).length;
      return { type: t.type, distance: +t.d.toFixed(1), area: t.area, worstChange: Math.max(...t.changed), worstShare: +(Math.max(...t.changed) / t.area).toFixed(2), yJump: +jump(t.y).toFixed(3), yawJump: +Math.max(...t.yaw.slice(1).map((v, i) => Math.abs(turn(t.yaw[i], v)))).toFixed(3), lodFlips: flips(t.lod), shadowFlips: flips(t.shadow) };
    });
    for (const r of rows) {
      // The old build drew a hopper 45 cm up for single frames: 100 % and more of its silhouette changed between two frames.
      assert.ok(r.worstShare <= .6, `${r.type} at ${r.distance} m: ${r.worstChange} of its ${r.area} pixels changed between two frames (${r.worstShare})`);
      assert.ok(r.yJump <= .07, `${r.type}: drawn height jumped ${r.yJump} m in a frame`); assert.ok(r.yawJump <= .13, `${r.type}: facing jumped ${r.yawJump} rad in a frame`);
      assert.ok(r.lodFlips <= 1 && r.shadowFlips <= 1, `${r.type}: look ${r.lodFlips}, shadow ${r.shadowFlips} switches while standing still`);
    }
    results.push({ name: 'far, calm creatures: frame-to-frame pixel change stays small', spot, rows }); await p.screenshot({ path: 'test-results/render-01-creatures.png' }); await context.close();
  }
  // ---------------------------------------------------------------- 2. the shadow grid stays on the ground
  {
    const { page: p, context } = await setup('desktop', s => { s.position = { x: 2, z: 30 }; });
    await p.waitForTimeout(800); await p.keyboard.down('d');
    const frames = await p.evaluate(() => __frames(90, () => { const R = willowmere.render(); return { sun: R.sun, cam: [R.camera.x, R.camera.z] }; }));
    await p.keyboard.up('d');
    const axes = lightAxes(), first = frames[0].sun, dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    assert.equal(first.type, 1, 'PCFShadowMap, as the reference'); assert.ok(first.box.right - first.box.left < 96 && first.box.top - first.box.bottom < 96, 'the box hugs the view');
    assert.ok(Math.hypot(frames.at(-1).cam[0] - frames[0].cam[0], frames.at(-1).cam[1] - frames[0].cam[1]) > 4, 'the camera moved');
    let off = 0; for (const f of frames) { assert.deepEqual(f.sun.box, first.box, 'one box while moving'); const a = dot(f.sun.target, axes.x) / f.sun.texel[0], b = dot(f.sun.target, axes.y) / f.sun.texel[1]; off = Math.max(off, Math.abs(a - Math.round(a)), Math.abs(b - Math.round(b))); assert.ok(Math.hypot(f.sun.target[0] - f.cam[0], f.sun.target[2] - f.cam[1]) < .2, 'the sun follows the camera'); }
    assert.ok(off < 2e-3, `the sun looks at whole texels (${off.toFixed(5)} of a texel off at most)`);
    // Zoomed far out the box still covers the view (it used to stay 96 m wide while the view was 134 m).
    await p.mouse.move(720, 450); for (let i = 0; i < 8; i++) await p.mouse.wheel(0, 240); await p.waitForTimeout(400);
    const wide = await p.evaluate(() => willowmere.render()); assert.ok(wide.sun.box.right - wide.sun.box.left >= wide.camera.right * 1.6, 'the box grows with the view');
    results.push({ name: 'shadow: one box while moving, target on whole texels', texel: first.texel, box: first.box, worstTexelOffset: off, zoomedOut: wide.sun.box }); await context.close();
  }
  // ---------------------------------------------------------------- 3. the pen animals
  for (const level of [0, 3]) {
    const { page: p, context } = await setup('desktop', s => { s.position = { x: 15, z: -11.5 }; s.upgrades.pen = level; });
    await p.waitForTimeout(600); const a = await p.evaluate(() => willowmere.render().pen); await p.waitForTimeout(9000); const b = await p.evaluate(() => willowmere.render().pen);
    assert.equal(a.skinned, true); assert.equal(a.draws, 1, 'one draw for the whole pen'); assert.deepEqual(a.animals.map(x => x.kind), PEN_ROSTER.map(x => x.kind));
    assert.deepEqual(a.animals.map(x => x.shown), PEN_ROSTER.map(x => penShown(x, level)), `pen level ${level}: the same animals as before`);
    for (const x of b.animals.filter(x => x.shown)) assert.ok(x.x > PEN.x0 && x.x < PEN.x1 && x.z > PEN.z0 && x.z < PEN.z1, `${x.kind} is in the yard`);
    const moved = b.animals.filter((x, i) => x.shown && Math.hypot(x.x - a.animals[i].x, x.z - a.animals[i].z) > .15).length; assert.ok(moved >= 1, 'they walk about');
    await p.evaluate(() => willowmere.calls()); await p.waitForTimeout(200); const calls = await p.evaluate(() => willowmere.calls());
    results.push({ name: `pen level ${level}`, shown: a.animals.filter(x => x.shown).length, triangles: a.triangles, bones: a.bones, moved, realCalls: calls });
    await p.screenshot({ path: `test-results/render-03-pen-${level}.png` }); await context.close();
  }
  // ---------------------------------------------------------------- 4 and 5. vehicles
  for (const id of ['jeep', 'bike']) {
    // The jeep stands by the Bell garage (world.mjs), the motorcycle in the homestead's yard.
    const bell = HOUSES[2], start = id === 'jeep' ? { x: bell.x + 8, z: bell.z + 8 } : { x: 5, z: -6 };
    const { page: q, context } = await setup('desktop', s => { s.bike = true; s.stats.sales = 100000; s.position = start; });
    await q.waitForTimeout(500); await q.keyboard.press('e'); await q.waitForFunction(() => willowmere.render().riding, null, { timeout: 8000 });
    const sample = n => q.evaluate(n => __frames(n, (i, ms) => { const R = willowmere.render(), v = R.vehicles.find(c => c.id === R.riding); return { ms, x: v.x, z: v.z, nose: v.nose, speed: R.drive.riding.speed, player: R.player, screen: willowmere.metrics().screen }; }), n);
    // The motorcycle first leaves the yard through the gap in the fence (south), then both head east into the fields.
    if (id === 'bike') { await q.keyboard.down('s'); await q.waitForTimeout(1500); await q.keyboard.up('s'); }
    await q.keyboard.down('d'); const run = await sample(420); await q.keyboard.up('d');
    const lead = [], speeds = []; let worstTurn = 0;
    for (let i = 1; i < run.length; i++) { const a = run[i - 1], b = run[i], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz); worstTurn = Math.max(worstTurn, Math.abs(turn(a.nose, b.nose)) / Math.max(.004, b.ms / 1000)); if (d < .03 || b.speed <= VEHICLES[id].crawl + 1) continue; /* slower than that it is sliding along something it ran into */ lead.push(Math.cos(Math.atan2(dx, dz) - b.nose)); speeds.push(d / (b.ms / 1000)); }
    lead.sort((a, b) => a - b); const spec = VEHICLES[id], last = run.at(-1), top = Math.max(...run.map(f => f.speed));
    assert.ok(lead[Math.floor(lead.length * .1)] > .9, `${id}: the nose leads (${lead[Math.floor(lead.length * .1)].toFixed(2)} at the 10th percentile; the old build: -1)`);
    assert.ok(worstTurn <= spec.turn * 2.1 + .2, `${id} turns smoothly (${worstTurn.toFixed(1)} rad/s at most; the old build: 30)`);
    assert.ok(top >= spec.cruise - .1, `${id} reaches 4x walking (${top.toFixed(1)} m/s)`); assert.ok(top <= spec.top + .01);
    assert.ok(Math.cos(last.player.yaw - last.nose) > .99, 'the driver faces the way the nose points'); assert.ok(last.player.y > .2, 'seated up on the seat'); assert.ok(last.player.legs[0] < -.5 && last.player.legs[1] < -.5, 'legs forward, seated');
    assert.ok(last.screen.x > 100 && last.screen.x < 1340 && last.screen.y > 80 && last.screen.y < 820, 'the camera keeps up');
    results.push({ name: `${id}: nose first, 4x to 8x`, noseLeadsP10: +lead[Math.floor(lead.length * .1)].toFixed(3), topSpeed: +top.toFixed(1), worstTurnRate: +worstTurn.toFixed(2), endsAt: [+last.x.toFixed(0), +last.z.toFixed(0)], frameMsMedian: run.map(f => f.ms).sort((a, b) => a - b)[210] });
    await q.screenshot({ path: `test-results/render-04-${id}.png` });
    // Steering takes no speed off: flat out on open ground, a right angle to the left (up the screen), then back to the right.
    // (A run that meets a tree is a bump, not a turn: it is driven again a little farther on.)
    let steer = null;
    for (let attempt = 0; attempt < 12 && !steer; attempt++) {
      await q.keyboard.down('d'); await q.waitForFunction(top => willowmere.render().drive.riding.speed >= top - .01, spec.top, { timeout: 20000 }); await q.waitForTimeout(400);
      const before = await q.evaluate(() => willowmere.render().drive);
      await q.keyboard.down('w'); await q.keyboard.up('d'); const left = await sample(84);
      await q.keyboard.down('d'); await q.keyboard.up('w'); const right = await sample(84); await q.keyboard.up('d');
      const after = await q.evaluate(() => willowmere.render().drive); if (after.bumps !== before.bumps) continue;
      const both = [...left, ...right], reach = (frames, to) => { let t = 0; for (const f of frames) { t += f.ms / 1000; if (Math.abs(turn(f.nose, to)) < .06) return t; } return null; }, north = before.riding.heading + Math.sign(turn(before.riding.heading, left.at(-1).nose)) * Math.PI / 2;
      let rate = 0, along = 1; for (let i = 1; i < both.length; i++) { const a = both[i - 1], b = both[i]; rate = Math.max(rate, Math.abs(turn(a.nose, b.nose)) / Math.max(.004, b.ms / 1000)); along = Math.min(along, Math.cos(Math.atan2(b.x - a.x, b.z - a.z) - b.nose)); }
      steer = { name: `${id}: a right angle left and right at top speed`, attempt, slowest: +Math.min(...both.map(f => f.speed)).toFixed(2), top: spec.top, leftOff: +Math.abs(turn(left.at(-1).nose, north)).toFixed(3), rightOff: +Math.abs(turn(right.at(-1).nose, before.riding.heading)).toFixed(3), secondsLeft: reach(left, north), secondsRight: reach(right, before.riding.heading), worstTurnRate: +rate.toFixed(2), noseLeadsWorst: +along.toFixed(3) };
    }
    assert.ok(steer, `${id}: a clear run for the right-angle check`);
    assert.ok(steer.slowest >= spec.top * .95, `${id}: steering takes no speed off (${steer.slowest} of ${spec.top} m/s at the least)`);
    assert.ok(steer.leftOff < .06 && steer.rightOff < .06, `${id}: the nose reaches the new heading (${steer.leftOff}, ${steer.rightOff} rad off)`);
    assert.ok(steer.secondsLeft != null && steer.secondsLeft <= (id === 'bike' ? .8 : 1.15) && steer.secondsRight <= (id === 'bike' ? .8 : 1.15), `${id}: a right angle at top speed in ${steer.secondsLeft} s and ${steer.secondsRight} s`);
    assert.ok(steer.worstTurnRate <= spec.turn * 2.1 + .2 && steer.noseLeadsWorst > .9, `${id}: no snap, no slide (${steer.worstTurnRate} rad/s, ${steer.noseLeadsWorst})`);
    results.push(steer);
    // The same for the stick thrown from pure left to pure right (A then D and back, nothing else held): half a turn each
    // time, which is what "move left and right" is on a keyboard. Flat out throughout, and the build-up is never set back.
    let flip = null;
    for (let attempt = 0; attempt < 12 && !flip; attempt++) {
      await q.keyboard.down('d'); await q.waitForFunction(top => willowmere.render().drive.riding.speed >= top - .01, spec.top, { timeout: 20000 }); await q.waitForTimeout(400);
      const before = await q.evaluate(() => willowmere.render().drive), frames = [];
      for (const [n, count] of [24, 42, 24, 42].entries()) { const [on, off] = n % 2 ? ['d', 'a'] : ['a', 'd']; await q.keyboard.down(on); await q.keyboard.up(off); frames.push(...await sample(count)); }
      const after = await q.evaluate(() => willowmere.render().drive); await q.keyboard.up('d'); if (after.bumps !== before.bumps) continue;
      let along = 1; for (let i = 1; i < frames.length; i++) { const a = frames[i - 1], b = frames[i]; along = Math.min(along, Math.cos(Math.atan2(b.x - a.x, b.z - a.z) - b.nose)); }
      flip = { name: `${id}: pure left then pure right, four times, at top speed`, attempt, slowest: +Math.min(...frames.map(f => f.speed)).toFixed(2), top: spec.top, buildUpGained: +(after.riding.straight - before.riding.straight).toFixed(2), seconds: +(frames.reduce((sum, f) => sum + f.ms, 0) / 1000).toFixed(2), noseLeadsWorst: +along.toFixed(3) };
    }
    assert.ok(flip, `${id}: a clear run for the left-right check`);
    assert.ok(flip.slowest >= spec.top - .01, `${id}: left and right takes no speed off (${flip.slowest} of ${spec.top} m/s at the least)`);
    assert.ok(flip.buildUpGained > flip.seconds * .8 && flip.noseLeadsWorst > .9, `${id}: the build-up runs on (${flip.buildUpGained} s in ${flip.seconds} s), nose first (${flip.noseLeadsWorst})`);
    results.push(flip);
    await q.keyboard.press('e'); await q.waitForFunction(() => !willowmere.render().riding, null, { timeout: 5000 }); const out = await q.evaluate(() => willowmere.render().player); assert.ok(Math.abs(out.y) < .2, 'back on the ground');
    await context.close();
  }
  assert.deepEqual(errors, []);
  await writeFile('test-results/render-results.json', JSON.stringify(results, null, 1));
  console.log(JSON.stringify(results, null, 1)); console.log('render-browser: all passed');
} catch (error) { console.error(error); console.error('page errors', errors); process.exitCode = 1; } finally { await browser.close(); }
