// The living family pond in a real browser, at 1440x900 and 390x844: the water moves, the fish swim and wag and stay inside, the species are the
// ones the pond can catch at each tier, a real fish takes the float (swims in, nibbles, grabs it, thrashes while hooked), rings and spray and
// bubbles appear at each step and are gone afterwards, an early press scares the fish off, a catch leaps from the water, a pack-away leaves nothing.
//   GAME_URL=http://127.0.0.1:<port> node tests/pond-browser.mjs      (GPU=1 for a real GPU)
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshState, SAVE_KEY } from '../src/game.mjs';
import { POND } from '../src/content.mjs';
import { FISH_POOLS } from '../src/pond.mjs';
import { landFish } from './fishing-controls.mjs';

const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome', headless: true, args: process.env.GPU ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const base = process.env.GAME_URL ?? 'http://127.0.0.1:4173', errors = [], results = []; await mkdir('test-results', { recursive: true });
const SCREENS = { desktop: [1440, 900], phone: [390, 844] };
const x0 = POND.x - POND.w / 2, x1 = POND.x + POND.w / 2, z0 = POND.z - POND.d / 2, z1 = POND.z + POND.d / 2;
const AT = { x: POND.x + 1, z: z0 - .9 }, AIM = { x: POND.x + 2.5, z: z0 + 3.2 };
const seed = (extra = {}, pond = 0) => { const s = Object.assign(freshState(), { started: true, coins: 500, ...extra }); s.upgrades.pond = pond; return s; };
async function setup(state, screen) {
  const [width, height] = SCREENS[screen], mobile = screen !== 'desktop';
  const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  await context.addInitScript(({ key, state }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state)); }, { key: SAVE_KEY, state });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(base); await page.waitForFunction(() => window.willowmere?.metrics().ready && willowmere.project, null, { timeout: 90000 }); await page.locator('#begin').click();
  await page.waitForFunction(() => willowmere.metrics().pond?.ready, null, { timeout: 30000 }); await page.waitForTimeout(800);
  const cdp = mobile ? await context.newCDPSession(page) : null, touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y]) => ({ x: Math.round(x), y: Math.round(y), id: 1 })) });
  const finger = mobile ? { down: (x, y) => touch('touchStart', [[x, y]]), move: (x, y) => touch('touchMove', [[x, y]]), up: () => touch('touchEnd', []) } : null;
  const tap = (x, y) => mobile ? page.touchscreen.tap(x, y) : page.mouse.click(x, y);
  const point = async at => { const s = await page.evaluate(([x, z]) => willowmere.project(x, z, .3), [at.x, at.z]); assert.ok(s.x > 4 && s.x < width - 4 && s.y > 4 && s.y < height - 4, 'the point is on the screen'); await tap(s.x, s.y); };
  return { page, context, width, height, mobile, screen, finger, tap, point };
}
const pond = p => p.evaluate(() => willowmere.metrics().pond);
// A recorder in the page: a sample every 40 ms of the pond, the float and the phase, kept in window.__rec.
const record = p => p.evaluate(() => { window.__rec = []; clearInterval(window.__recTimer); const t0 = performance.now(); window.__recTimer = setInterval(() => { const m = willowmere.metrics(), q = m.pond; window.__rec.push({ t: performance.now() - t0, phase: m.fishing.phase, float: m.fishing.float, landing: m.fishing.landing, suitor: q.suitor, fish: q.fish.map(f => [f.id, f.x, f.z, f.h, f.tail, f.rz, f.mode]), rings: q.rings, sparks: q.sparks, bubbles: q.bubbles, particles: q.particles, draws: q.draws }); }, 40); });
const rec = async p => p.evaluate(() => { clearInterval(window.__recTimer); return window.__rec; });
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const between = (rec, from, to) => rec.filter(r => r.t >= from && r.t <= to);
const diffFraction = (p, a, b) => p.evaluate(async ([a, b]) => { const load = async s => { const img = new Image(); img.src = 'data:image/png;base64,' + s; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; }; const A = await load(a), B = await load(b); let n = 0; for (let i = 0; i < A.length; i += 4) if (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) > 36) n++; return n / (A.length / 4); }, [a, b]);
const clipOf = async (p, w, h) => { const a = await p.evaluate(([x, z]) => willowmere.project(x, z, .3), [x0 + 1, z0 + 1]), b = await p.evaluate(([x, z]) => willowmere.project(x, z, .3), [x1 - 1, z1 - 1]); const x = Math.max(0, Math.min(a.x, b.x)), y = Math.max(0, Math.min(a.y, b.y)); return { x, y, width: Math.min(w - x, Math.abs(a.x - b.x)), height: Math.min(h - y, Math.abs(a.y - b.y)) }; };

try {
  for (const screen of Object.keys(SCREENS)) {
    const light = screen === 'phone', N = light ? 5 : 8;
    // ---------------------------------------------------------------- 1. the water and the fish move with nobody fishing
    {
      const t = await setup(seed({ position: AT }), screen), p = t.page, clip = await clipOf(p, t.width, t.height);
      const a = (await p.screenshot({ clip })).toString('base64'); await p.waitForTimeout(700); const b = (await p.screenshot({ clip })).toString('base64');
      const frac = await diffFraction(p, a, b); assert.ok(frac > .004, `${screen}: the picture of the pond changes in 0.7 s (${(frac * 100).toFixed(2)} % of its pixels)`);
      await record(p); await p.waitForTimeout(2500); const r = await rec(p), first = r[0], last = r.at(-1);
      assert.equal(first.fish.length, N, `${screen}: ${N} fish swim`);
      const moved = first.fish.filter(f => { const g = last.fish.find(q => q[0] === f[0]); return Math.hypot(g[1] - f[1], g[2] - f[2]) > .4; }).length; assert.ok(moved >= N - 2, `${screen}: ${moved} of ${N} fish moved more than 0.4 m in 2.5 s`);
      assert.ok(first.fish.some(f => { const g = last.fish.find(q => q[0] === f[0]); return Math.abs(Math.atan2(Math.sin(g[3] - f[3]), Math.cos(g[3] - f[3]))) > .1; }), `${screen}: headings change`);
      for (const s of r) for (const f of s.fish) assert.ok(f[1] > x0 + .4 && f[1] < x1 - .4 && f[2] > z0 + .4 && f[2] < z1 - .4, `${screen}: every fish stays in the water (${f[1].toFixed(1)}, ${f[2].toFixed(1)})`);
      let close = 0; for (const s of r) for (let i = 0; i < s.fish.length; i++) for (let j = i + 1; j < s.fish.length; j++) if (Math.hypot(s.fish[i][1] - s.fish[j][1], s.fish[i][2] - s.fish[j][2]) < .15) close++; assert.ok(close < 75, `${screen}: no two fish sit on one spot (${close} samples)`);
      const tails = new Map(); for (const s of r) for (const f of s.fish) { const q = tails.get(f[0]) ?? [9, -9]; tails.set(f[0], [Math.min(q[0], f[4]), Math.max(q[1], f[4])]); }
      assert.ok([...tails.values()].every(([lo, hi]) => hi - lo > .3 && hi < .61 && lo > -.61), `${screen}: every tail wags within 0.6 rad`);
      assert.ok(r.some(s => s.rings > 0), `${screen}: now and then a fish stirs a ring on the surface`);
      await p.screenshot({ path: `test-results/pond-${screen}-idle.png`, clip });
      const q = await p.evaluate(() => ({ pond: willowmere.metrics().pond, calls: willowmere.calls(), nodes: willowmere.metrics().calls })); assert.ok(q.pond.draws <= 18, `${screen}: the pond draws ${q.pond.draws} (limit 18 with spray, rings and bubbles)`);
      results.push({ name: `${screen}: the water changes (${(frac * 100).toFixed(1)} %), ${moved}/${N} fish swim, turn, wag and stay inside; ${q.pond.draws} pond draws, calls ${JSON.stringify(q.calls)}` }); await t.context.close();
    }
    // ---------------------------------------------------------------- 1b. effects and fish are drawn big enough for the screen, and each fish has a shadow
    {
      const t = await setup(seed({ position: AT }), screen), m = await pond(t.page);
      assert.ok(m.boost >= 1.6 && (light ? m.boost >= 2 : true), `${screen}: effects are scaled for pixels per metre (${m.boost.toFixed(2)}x)`); assert.ok(m.shadows >= N - 1, `${screen}: a soft shadow under each fish (${m.shadows})`);
      results.push({ name: `${screen}: effects drawn ${m.boost.toFixed(2)}x, ${m.shadows} fish shadows` }); await t.context.close();
    }
    // ---------------------------------------------------------------- 1c. the water stays when the pond is far but on screen
    if (!light) {
      const t = await setup(seed({ position: { x: POND.x + 42, z: POND.z + 6 } }), screen), p = t.page; await p.keyboard.down('Shift'); await p.keyboard.down('d');
      await p.waitForFunction(() => { const m = willowmere.metrics().pond; return m && !m.near; }, null, { timeout: 20000, polling: 100 }); await p.waitForTimeout(300);
      await p.keyboard.up('d'); await p.keyboard.up('Shift'); const m = await pond(p);
      assert.equal(m.near, false); assert.equal(m.water, true, 'the water and the bank are still drawn more than 45 m away');
      results.push({ name: 'far from the pond (more than 45 m) the water and the bank still draw; only the fish stop' }); await t.context.close();
    }
    // ---------------------------------------------------------------- 2. the fish are the ones this tier catches
    if (!light) for (let tier = 0; tier < 4; tier++) {
      const t = await setup(seed({ position: AT }, tier), screen), m = await pond(t.page);
      assert.deepEqual(m.species, [...FISH_POOLS[tier]].sort(), `tier ${tier}: the swimmers are exactly what the pond can catch`); assert.equal(m.tier, tier);
      results.push({ name: `tier ${tier}: ${m.species.join(', ')} swim` }); await t.context.close();
    }
    // ---------------------------------------------------------------- 3. a whole bite: a real fish swims in, nibbles, takes the float; thrashes while hooked; leaps to you
    {
      const t = await setup(seed({ position: AT }, 2), screen), p = t.page; await record(p); await t.point(AIM);
      await p.waitForFunction(() => willowmere.metrics().fishing.phase === 'bite', null, { timeout: 45000, polling: 30 });
      await p.screenshot({ path: `test-results/pond-${screen}-bite.png` });
      await landFish(p, { touch: t.mobile ? t.finger : false }); await p.waitForTimeout(150);
      const caught = await p.evaluate(() => ({ landing: willowmere.metrics().fishing.landing, pond: willowmere.metrics().pond })); await p.waitForTimeout(3500); const r = await rec(p), end = await pond(p);
      const ph = n => r.filter(s => s.phase === n), cast = ph('cast'), approach = ph('approach'), nibble = ph('nibble'), bite = ph('bite'), hooked = ph('hooked'), wait = ph('wait');
      assert.ok(approach.length && nibble.length && bite.length && hooked.length, `${screen}: every phase was seen`);
      const fl = s => s.float, su = s => s.suitor && dist(s.suitor, fl(s));
      // The fish that takes the float swims in: its distance falls over the approach and it is a catchable species.
      const a0 = su(approach[0]), a1 = su(approach.at(-1)); assert.ok(a0 > a1 - .05 && a1 < .95, `${screen}: the suitor swims in (${a0?.toFixed(2)} -> ${a1?.toFixed(2)} m)`);
      assert.ok(FISH_POOLS[2].includes(approach[0].suitor.species), `${screen}: it is a fish of this pond`);
      const nd = nibble.map(su); assert.ok(Math.max(...nd) < .95 && Math.max(...nd) - Math.min(...nd) > .12, `${screen}: it holds close and darts at each nibble (${Math.min(...nd).toFixed(2)}..${Math.max(...nd).toFixed(2)} m)`);
      const bd = bite.slice(Math.floor(bite.length / 3)).map(su); assert.ok(Math.max(...bd) < .45, `${screen}: at the bite it has the float (${Math.max(...bd).toFixed(2)} m)`);
      const waitY = wait.map(s => s.float.y).reduce((a, b) => a + b, 0) / wait.length, biteY = bite.map(s => s.float.y); assert.ok(waitY - Math.min(...biteY) > .1, `${screen}: the float goes under at the bite (${waitY.toFixed(2)} -> ${Math.min(...biteY).toFixed(2)})`);
      assert.ok(Math.max(...biteY) - Math.min(...biteY) > .015, `${screen}: the float shakes at the bite`);
      // Rings at the cast landing, each nibble and the bite, within 150 ms.
      const ringsWithin = (from, ms) => between(r, from.t, from.t + ms).some(s => s.rings > 0);
      const firstWait = wait[0]; assert.ok(ringsWithin(firstWait, 150), `${screen}: a ring where the float lands`); assert.ok(ringsWithin(bite[0], 150), `${screen}: a ring at the bite`);
      assert.ok(nibble.some((s, i) => i && nibble[i - 1].rings < s.rings || ringsWithin(s, 150)), `${screen}: rings at the nibbles`);
      assert.ok(between(r, bite[0].t, bite[0].t + 150).some(s => s.sparks > 0), `${screen}: spray at the bite`);
      // Hooked: it thrashes, stays by the float, bubbles and sparks all the time.
      const ht = hooked.slice(0, 50), hf = ht.map(s => s.suitor?.rz ?? 0), tl = ht.map(s => s.suitor?.tail ?? 0);
      assert.ok(Math.max(...hf) - Math.min(...hf) > .3 && Math.max(...tl) - Math.min(...tl) > .3, `${screen}: the hooked fish rolls and beats its tail (${(Math.max(...hf) - Math.min(...hf)).toFixed(2)}, ${(Math.max(...tl) - Math.min(...tl)).toFixed(2)} rad)`);
      assert.ok(hooked.every(s => !s.suitor || su(s) < 1.2), `${screen}: the hooked fish stays within 1.2 m of the float`);
      const withParticles = hooked.filter(s => s.particles > 0).length / hooked.length; assert.ok(withParticles >= (light ? .4 : .8), `${screen}: spray or bubbles in ${(withParticles * 100).toFixed(0)} % of the hooked samples`);
      assert.ok(hooked.some(s => s.bubbles > 0), `${screen}: bubbles rise from the hooked fish (a phone too)`);
      // The catch: the fish leaps from the water; the splash is there at once; everything is gone 3 s later.
      assert.ok(caught.landing, `${screen}: the catch is in the air`); const land = r.filter(s => s.landing), l0 = land[0];
      assert.ok(l0 && l0.fish.some(f => f[6] === 'land' && f[1] > x0 - .5 && f[1] < x1 + .5 && f[2] > z0 && f[2] < z1 + .5 || f[6] === 'land'), `${screen}: a fish is leaping`);
      assert.ok(between(r, land[0].t, land[0].t + 120).some(s => s.rings > 0 && s.sparks > 0), `${screen}: a ring and a splash at the water`);
      assert.equal(end.particles, 0, `${screen}: no spray or bubbles 3 s after the catch`); assert.ok(end.rings <= (light ? 1 : 3), `${screen}: only ambient ripples are left (${end.rings}; they come every 0.45 s on a desktop and live 1.1 s)`); assert.equal(end.n, N, `${screen}: the school is restocked (${end.n})`); assert.equal(end.suitor, null);
      results.push({ name: `${screen}: a full bite - ${a0.toFixed(1)} m swim-in, darts, float under by ${(waitY - Math.min(...biteY)).toFixed(2)} m, thrash, ${(withParticles * 100).toFixed(0)} % spray, splash, restock` }); await t.context.close();
    }
    // ---------------------------------------------------------------- 4. an early press scares the suitor off; a pack-away leaves nothing
    {
      const t = await setup(seed({ position: AT }), screen), p = t.page; await t.point(AIM);
      await p.waitForFunction(() => ['approach', 'nibble'].includes(willowmere.metrics().fishing.phase), null, { timeout: 45000, polling: 30 });
      await record(p); const reel = await p.locator('#reel-button').boundingBox();
      if (t.mobile) { await t.finger.down(reel.x + reel.width / 2, reel.y + reel.height / 2); await p.waitForTimeout(80); await t.finger.up(); } else { await p.keyboard.down('Space'); await p.waitForTimeout(80); await p.keyboard.up('Space'); }
      await p.waitForTimeout(700); const r = await rec(p), t0 = r.find(s => s.phase === 'wait')?.t ?? 0, after = between(r, t0, t0 + 600);
      let fastest = 0; for (let i = 1; i < after.length; i++) for (const f of after[i].fish) { const g = after[i - 1].fish.find(q => q[0] === f[0]); if (g) fastest = Math.max(fastest, Math.hypot(f[1] - g[1], f[2] - g[2]) / ((after[i].t - after[i - 1].t) / 1000)); }
      assert.ok(fastest > 2, `${screen}: the scared fish bolts at ${fastest.toFixed(1)} m/s`); assert.ok(after.some(s => s.rings > 0), `${screen}: a ring where the float was pulled`); assert.ok(r.some(s => s.phase === 'wait'), `${screen}: the line goes back to waiting`);
      // Pack away mid-line: any move.
      await p.waitForFunction(() => willowmere.metrics().fishing.phase !== 'idle', null, { timeout: 5000 }).catch(() => {}); if ((await p.evaluate(() => willowmere.metrics().fishing.phase)) === 'idle') await t.point(AIM);
      await p.waitForFunction(() => ['bite', 'hooked'].includes(willowmere.metrics().fishing.phase), null, { timeout: 45000, polling: 30 });
      if (t.mobile) { await t.finger.down(reel.x + reel.width / 2, reel.y + reel.height / 2); await p.waitForTimeout(500); } else { await p.keyboard.down('Space'); await p.waitForTimeout(500); }
      await p.keyboard.up('Space').catch(() => {}); if (t.mobile) await t.finger.up(); await p.keyboard.down('w'); await p.waitForTimeout(150); await p.keyboard.up('w');
      assert.equal((await p.evaluate(() => willowmere.metrics().fishing.phase)), 'idle', `${screen}: a move packs the rod away`);
      await p.waitForTimeout(1800); const e = await pond(p); assert.equal(e.particles, 0, `${screen}: nothing left in the air after a pack-away`); assert.equal(e.suitor, null); assert.ok(e.rings <= 1, `${screen}: rings gone (${e.rings})`);
      results.push({ name: `${screen}: an early press scares the fish off at ${fastest.toFixed(1)} m/s; a pack-away leaves nothing` }); await t.context.close();
    }
  }
  assert.deepEqual(errors, [], 'no console errors');
  await writeFile('test-results/pond-report.json', JSON.stringify(results, null, 2)); console.log(JSON.stringify({ pass: results.length, results }, null, 2));
} catch (error) { console.error(JSON.stringify({ pass: results.length, results, errors }, null, 2)); console.error(error); process.exitCode = 1; }
finally { await browser.close(); }
