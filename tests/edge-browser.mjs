// Round 9 in a real browser: the world is a disc of radius 296 m and its edge is a circular wall. Walking into it at any bearing stops 2 m inside the
// line; a stick held at an angle to it slides along it and never stops dead; a tapped walk to a point beyond it ends inside; a car brakes to a crawl before
// it touches the edge and slides along it; and the game says "The world ends here" once.
//
//   GAME_URL=http://127.0.0.1:<port> GPU=1 node tests/edge-browser.mjs
import assert from 'node:assert/strict';
import { launch, open, metrics, shot, holdStick, save, clearSpot } from './travel-kit.mjs';
import { VEHICLES } from '../src/drive.mjs';
import { RING, EDGE_PAD, edgeDistance, inWorld, regionAt } from '../src/regions.mjs';

const browser = await launch(), results = [], errors = [], R2 = RING.R2, LINE = R2 - EDGE_PAD, RAD = Math.PI / 180;
const toastShown = page => page.evaluate(() => { const t = document.getElementById('toast'); return t.classList.contains('show') ? t.textContent : ''; });
const polar = (rho, bearing) => ({ x: rho * Math.sin(bearing * RAD), z: -rho * Math.cos(bearing * RAD) });
/** The outward unit vector at a bearing, turned `off` degrees clockwise (the stick's direction in world axes). */
const outward = (bearing, off = 0) => ({ dx: Math.sin((bearing + off) * RAD), dz: -Math.cos((bearing + off) * RAD) });
const bearingOf = p => Math.atan2(p.x, -p.z) / RAD;
const turn = (a, b) => { let d = (b - a) % 360; if (d > 180) d -= 360; if (d < -180) d += 360; return d; };
const BEARINGS = [0, 45, 90, 135, 180, 225, 270, 315].map(b => b + 12);

try {
  // ---------------------------------------------------------------- 1. on foot: straight into the rim at eight bearings, and held at 40 degrees to it
  {
    const rows = [];
    for (const b0 of BEARINGS) for (const off of [0, 40]) {
      // (a trunk on the way stops the walk before the wall does: that bearing is tried again 5 degrees on, up to four times)
      let tried = 0, b = b0, got = null;
      for (; tried < 4 && !got; tried++, b = b0 + 5 * (tried)) {
        const start = clearSpot(polar(R2 - 30, b).x, polar(R2 - 30, b).z, 2.5), { dx, dz } = outward(b, off);
        const { page: p, context, errors: e } = await open(browser, 'landscape', s => { s.position = { ...start }; s.settings.test = true; }); errors.push(e);
        await p.waitForTimeout(300); const stick = await holdStick(p, context, dx, dz);
        const reached = await p.waitForFunction(() => willowmere.metrics().journey.edgeDistance < 2.4, null, { timeout: 25000 }).then(() => true, () => false);
        if (reached) { got = { p, context, stick, start }; break; }
        await stick.release(); await context.close();
      }
      assert.ok(got, `bearing ${b0}: the wall was reached on one of four tries`);
      const { p, context, stick, start } = got, name = `bearing ${b}, ${off ? 'held 40 degrees off' : 'straight on'}`; await p.waitForTimeout(1200);
      const m1 = await metrics(p); await p.waitForTimeout(2000); const m2 = await metrics(p); await stick.release();
      const d1 = edgeDistance(m1.position.x, m1.position.z), d2 = edgeDistance(m2.position.x, m2.position.z), moved = Math.hypot(m2.position.x - m1.position.x, m2.position.z - m1.position.z);
      for (const [m, d] of [[m1, d1], [m2, d2]]) { assert.ok(inWorld(m.position.x, m.position.z, EDGE_PAD - 1e-6), `${name}: still in the world`); assert.ok(d >= EDGE_PAD - 1e-5 && d < EDGE_PAD + .3, `${name}: ${d.toFixed(3)} m inside the line (2 m)`); assert.equal(m.journey.edgeDepth, 0); }
      assert.equal(m1.journey.edgeTold, true);
      if (off) assert.ok(moved > 1.5, `${name}: it slides along the wall (a rim tree may slow it) (${moved.toFixed(1)} m in 2 s)`); else assert.ok(moved < 1.5, `${name}: square on to the wall it stays (${moved.toFixed(1)} m)`);
      rows.push({ name, region: regionAt(start.x, start.z), metresInside: +d2.toFixed(3), moved: +moved.toFixed(1) });
      if (b === BEARINGS[1] && off) await shot(p, 'edge-walk-844x390');
      await context.close();
    }
    results.push({ name: 'on foot at 8 bearings: stopped 2 m inside the circle, sliding along it when held at an angle', rows });
  }
  // ---------------------------------------------------------------- 2. a tapped walk to a point beyond the rim ends inside it
  {
    const b = 200, start = clearSpot(polar(R2 - 14, b).x, polar(R2 - 14, b).z, 3), beyond = polar(R2 + 18, b + 6);
    const { page: p, errors: e } = await open(browser, 'desktop', s => { s.position = { ...start }; }); errors.push(e);
    await p.mouse.move(720, 450); for (let i = 0; i < 6; i++) await p.mouse.wheel(0, 240); await p.waitForTimeout(500);
    const tap = await p.evaluate(({ beyond }) => willowmere.project(beyond.x, beyond.z, 0), { beyond });
    if (tap.x > 100 && tap.x < 1340 && tap.y > 100 && tap.y < 800) {
      await p.mouse.click(tap.x, tap.y); await p.waitForTimeout(600);
      await p.waitForFunction(() => willowmere.metrics().navigation.remaining === 0, null, { timeout: 40000 }); await p.waitForTimeout(400);
      const m = await metrics(p), d = edgeDistance(m.position.x, m.position.z); assert.ok(d >= EDGE_PAD - 1e-6 && d < 6, `a tap outside the world ends ${d.toFixed(2)} m inside it`); results.push({ name: 'a tapped walk to a point beyond the rim ends inside it', metresInside: +d.toFixed(2) });
    } else results.push({ name: 'a tapped walk beyond the rim: the point was off the screen, skipped', tap });
    await p.context().close();
  }
  // ---------------------------------------------------------------- 3. the jeep and the motorcycle at the rim: a crawl when they touch, a slide along it
  for (const id of ['jeep', 'bike']) {
    const spec = VEHICLES[id];
    for (const [name, off] of [['straight on', 0], ['at 30 degrees', 30]]) {
      const b = off ? 292.5 : 112.5, p0 = polar(LINE - 150, b), at = clearSpot(p0.x, p0.z, 6), { dx: wx, dz: wz } = outward(b, off), heading = Math.atan2(wx, wz);
      const { page: p, context, errors: e } = await open(browser, 'landscape', s => { s.bike = true; s.stats.sales = 250; s.position = { ...at }; s.riding = id; s.heading = heading; s.vehicles[id] = { ...at, rot: heading }; }); errors.push(e);
      await p.waitForTimeout(400); const stick = await holdStick(p, context, wx, wz);
      const run = await p.evaluate(({ line }) => new Promise(resolve => {
        const out = []; let n = 0, since = 0;
        const tick = () => { const d = willowmere.render().drive, t = willowmere.metrics().journey, r = Math.hypot(d.riding.x, d.riding.z); out.push({ x: d.riding.x, z: d.riding.z, r, speed: d.riding.speed, bumps: d.bumps, depth: t.edgeDepth }); if (r > line - .6) since++; if (since > 150 || ++n > 3000) resolve(out); else requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
      }), { line: LINE });
      const first = run.findIndex(f => f.r > LINE - .6), touch = run[Math.max(0, first - 1)], top = Math.max(...run.slice(0, first).map(f => f.speed)), after = run.slice(first);
      assert.ok(first > 0, `${id}, ${name}: it reached the edge`); { const past = run.filter(f => f.r > LINE + 1e-6 || f.depth !== 0); assert.ok(!past.length, `${id}, ${name}: never past the line (${past.length} frames, first ${JSON.stringify(past[0])})`); }
      assert.ok(top >= spec.cruise, `${id}, ${name}: it came fast (${top.toFixed(1)} m/s)`); assert.ok(touch.speed <= spec.crawl + 1, `${id}, ${name}: at a crawl when it touches (${touch.speed.toFixed(2)} m/s, crawl ${spec.crawl})`);
      const slid = Math.abs(turn(bearingOf(after[0]), bearingOf(after.at(-1)))) * RAD * LINE, fastest = Math.max(...after.map(f => f.speed));
      if (off === 0) assert.ok(slid < 4 || fastest < spec.cruise, `${id}, straight on: it rests against the edge or creeps along it (${slid.toFixed(1)} m, ${fastest.toFixed(1)} m/s)`);
      else { assert.ok(slid > 5, `${id}, at 30 degrees: it slides on along the edge (${slid.toFixed(1)} m)`); assert.ok(fastest < spec.cruise - .5, `${id}: and not at cruise, as round a trunk (${fastest.toFixed(1)} m/s)`); }
      if (id === 'jeep') await shot(p, off === 0 ? 'edge-car-stopped-844x390' : 'edge-car-sliding-844x390');
      await stick.release(); assert.equal((await metrics(p)).journey.edgeTold, true, 'the edge was announced (the toast itself is gone after 4.5 s)');
      results.push({ name: `${id} at the rim, ${name}`, topSpeed: +top.toFixed(1), speedAtTouch: +touch.speed.toFixed(2), slidMetres: +slid.toFixed(1), fastestAlongIt: +fastest.toFixed(1), framesToEdge: first });
      await context.close();
    }
  }
  assert.deepEqual(errors.flat(), []);
  await save('edge-results', results); console.log(JSON.stringify(results, null, 1)); console.log('edge-browser: all passed');
} catch (error) { console.error(error); console.error('page errors', errors.flat()); process.exitCode = 1; } finally { await browser.close(); }
