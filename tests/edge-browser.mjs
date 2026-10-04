// Round 8 in a real browser (builder C): the world has an edge. Thirteen squares of a 5 x 5 grid; walking into any of the twelve
// empty cells stops 2 m inside the line, also round a notch's corner; a tapped walk goes round a notch; a car brakes to a crawl
// before it touches the edge and slides along it; and the game says "The world ends here" once.
//
//   GAME_URL=http://127.0.0.1:<port> GPU=1 node tests/edge-browser.mjs
import assert from 'node:assert/strict';
import { launch, open, metrics, shot, holdStick, save, clearSpot, VIEWS } from './travel-kit.mjs';
import { VEHICLES } from '../src/drive.mjs';
import { CELL, GRID, HALF, GRID_IDS, EDGE_PAD, edgeDistance, inWorld, regionAt, cellIdAt } from '../src/regions.mjs';

const browser = await launch(), results = [], errors = [];
const toastShown = page => page.evaluate(() => { const t = document.getElementById('toast'); return t.classList.contains('show') ? t.textContent : ''; });

/** For each of the twelve empty cells: a start a few metres inside a square that touches it, and the way to walk into it. */
function approaches() {
  const out = [];
  for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) {
    if (GRID_IDS[r][c]) continue;
    const x0 = c * CELL - HALF, z0 = r * CELL - HALF, x1 = x0 + CELL, z1 = z0 + CELL, cx = x0 + CELL / 2, cz = z0 + CELL / 2, name = `row ${r}, column ${c}`;
    // A side neighbour in the world: walk straight across the line, 40 m along it from the cell's middle (off the squares' axes, where trails and stands are).
    const side = [[0, -1, x0 - 6, cz + 40, 1, 0], [0, 1, x1 + 6, cz + 40, -1, 0], [-1, 0, cx + 40, z0 - 6, 0, 1], [1, 0, cx + 40, z1 + 6, 0, -1]].find(([dr, dc]) => GRID_IDS[r + dr]?.[c + dc]);
    if (side) { out.push({ name, cell: [r, c], x: side[2], z: side[3], dx: side[4], dz: side[5], kind: 'side' }); continue; }
    // A far corner cell touches the world at one corner point only: walk at that point from the square diagonal to it.
    const [dr, dc] = [[-1, -1], [-1, 1], [1, -1], [1, 1]].find(([a, b]) => GRID_IDS[r + a]?.[c + b]), px = dc < 0 ? x0 : x1, pz = dr < 0 ? z0 : z1;
    out.push({ name, cell: [r, c], x: px + dc * 7, z: pz + dr * 7, dx: -dc, dz: -dr, kind: 'corner' });
  }
  return out;
}

try {
  // ---------------------------------------------------------------- 1. walking into each of the twelve empty cells
  {
    const list = approaches(); assert.equal(list.length, 12); const rows = [];
    for (const a of list) {
      const start = clearSpot(a.x, a.z, 2.5); // (a trunk on the way would stop the walk before the edge does)
      const { page: p, context, errors: e } = await open(browser, 'landscape', s => { s.position = { ...start }; s.settings.test = true; }); errors.push(e);
      await p.waitForTimeout(300); const stick = await holdStick(p, context, a.dx, a.dz);
      await p.waitForFunction(() => { const t = willowmere.metrics().journey; return t.edgeDistance < 2.4; }, null, { timeout: 30000 }); await p.waitForTimeout(1500);
      const m = await metrics(p); await stick.release();
      const d = edgeDistance(m.position.x, m.position.z);
      assert.ok(cellIdAt(m.position.x, m.position.z) !== null, `${a.name}: still in the world at (${m.position.x.toFixed(2)}, ${m.position.z.toFixed(2)})`);
      assert.ok(d >= EDGE_PAD - 1e-6 && d < EDGE_PAD + .2, `${a.name}: stopped ${d.toFixed(3)} m inside the line (2 m)`); assert.equal(m.journey.edgeDepth, 0); assert.equal(m.journey.edgeTold, true);
      assert.equal(await toastShown(p), 'The world ends here', `${a.name}: the toast`);
      if (a.kind === 'corner') assert.ok(inWorld(m.position.x, m.position.z, EDGE_PAD - 1e-6));
      rows.push({ cell: a.name, from: regionAt(start.x, start.z), kind: a.kind, stoppedAt: [+m.position.x.toFixed(2), +m.position.z.toFixed(2)], metresInside: +d.toFixed(3) });
      if (a.cell[0] === 1 && a.cell[1] === 4) await shot(p, 'edge-walk-844x390');
      await context.close();
    }
    results.push({ name: 'walking into each of the 12 empty cells is stopped 2 m inside the line', rows });
  }
  // ---------------------------------------------------------------- 2. round a notch's corner, on foot: the line there is round, and it is said once
  {
    // In the swamp's north-west corner the empty cell is the diagonal one: its corner (-64, -192) pokes into the world.
    const { page: p, context, errors: e } = await open(browser, 'landscape', s => { s.position = { x: -58, z: -186 }; s.settings.test = true; }); errors.push(e);
    await p.waitForTimeout(300); let stick = await holdStick(p, context, -1, -1);
    await p.waitForFunction(() => willowmere.metrics().journey.edgeTold, null, { timeout: 30000 }); await p.waitForTimeout(800);
    let m = await metrics(p); assert.ok(Math.abs(Math.hypot(m.position.x + 64, m.position.z + 192) - EDGE_PAD) < .2, `stopped on the round line, ${Math.hypot(m.position.x + 64, m.position.z + 192).toFixed(3)} m from the corner`); assert.equal(await toastShown(p), 'The world ends here');
    await stick.release();
    // Past the corner there is world on both sides: west into the Toybox, north into the Frost Peaks. Walk round it.
    // (Due west from here the round line is in the way: a step south-west goes round it, as a player's thumb would.)
    stick = await holdStick(p, context, -1, .5); await p.waitForFunction(() => willowmere.metrics().position.x < -70, null, { timeout: 30000 }); await stick.release(); m = await metrics(p);
    assert.equal(regionAt(m.position.x, m.position.z), 'toy', 'round the corner into the Toybox'); assert.ok(edgeDistance(m.position.x, m.position.z) >= EDGE_PAD - 1e-6);
    // Said once: wait for the toast to go, walk into the edge again, and nothing is said.
    await p.waitForFunction(() => !document.getElementById('toast').classList.contains('show'), null, { timeout: 20000 });
    stick = await holdStick(p, context, 0, -1); await p.waitForFunction(() => willowmere.metrics().journey.edgeDistance < 2.1, null, { timeout: 30000 }); await p.waitForTimeout(700); await stick.release();
    assert.equal(await toastShown(p), '', '"The world ends here" shows once a session'); results.push({ name: 'round a notch corner on foot; the toast shows once' }); await context.close();
  }
  // ---------------------------------------------------------------- 3. a tapped walk from the Frost Peaks to the Beach, round the notch between them
  {
    const from = { x: 0, z: -256 }, to = { x: 128, z: -128 }, start = clearSpot(from.x, from.z, 3), goal = clearSpot(to.x, to.z, 3);
    const { page: p, errors: e } = await open(browser, 'desktop', s => { s.position = { ...start }; }); errors.push(e);
    await p.mouse.move(720, 450); for (let i = 0; i < 6; i++) await p.mouse.wheel(0, 240); await p.waitForTimeout(500); // the widest view: a tap reaches about 40 m
    const t0 = await p.evaluate(() => willowmere.render().t); let taps = 0, least = Infinity, m = await metrics(p);
    while (Math.hypot(m.position.x - goal.x, m.position.z - goal.z) > 2 && taps < 14) {
      // Tap the ground on the straight line to the goal, as far along it as the screen shows clear of the HUD.
      const spot = await p.evaluate(({ goal }) => { const me = willowmere.metrics().position, d = Math.hypot(goal.x - me.x, goal.z - me.z); for (const reach of [38, 30, 22, 14, 8]) { const k = Math.min(1, reach / d), x = me.x + (goal.x - me.x) * k, z = me.z + (goal.z - me.z) * k, s = willowmere.project(x, z, 0); if (s.x > 330 && s.x < 1180 && s.y > 150 && s.y < 680) return { x, z, s }; } return null; }, { goal });
      assert.ok(spot, 'the ground ahead is on the screen'); await p.mouse.click(spot.s.x, spot.s.y); taps++;
      await p.waitForFunction(() => willowmere.metrics().navigation.remaining > 0, null, { timeout: 5000 }).catch(() => {});
      const leg = await p.evaluate(() => new Promise(resolve => { let least = Infinity, n = 0; const tick = () => { const m = willowmere.metrics(); least = Math.min(least, m.journey.edgeDistance); if (m.navigation.remaining === 0 || ++n > 2400) resolve(least); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); }));
      least = Math.min(least, leg); m = await metrics(p);
    }
    const seconds = await p.evaluate(() => willowmere.render().t) - t0;
    assert.ok(Math.hypot(m.position.x - goal.x, m.position.z - goal.z) <= 2, `arrived at (${m.position.x.toFixed(1)}, ${m.position.z.toFixed(1)}) after ${taps} taps`); assert.equal(regionAt(m.position.x, m.position.z), 'ocean');
    assert.ok(seconds < 90, `within 90 s of the game's clock (${seconds.toFixed(1)} s)`); assert.ok(least >= EDGE_PAD - 1e-6, `never nearer the edge than 2 m (${least.toFixed(2)} m at the notch)`); assert.ok(least < 8, 'and it did go by the notch');
    results.push({ name: 'a tapped walk from (0, -256) to (128, -128)', seconds: +seconds.toFixed(1), taps, nearestToEdge: +least.toFixed(2) }); await p.context().close();
  }
  // ---------------------------------------------------------------- 4. the jeep and the motorcycle at the east edge: a crawl when they touch, a slide along it
  for (const id of ['jeep', 'bike']) {
    const spec = VEHICLES[id], line = HALF - EDGE_PAD;
    for (const [name, wx, wz] of [['straight on', 1, 0], ['at 30 degrees', Math.cos(Math.PI / 6), Math.sin(Math.PI / 6)]]) {
      const at = clearSpot(line - 150, wz === 0 ? -30 : -60, 6), heading = Math.atan2(wx, wz);
      const { page: p, context, errors: e } = await open(browser, 'landscape', s => { s.bike = true; s.stats.sales = 250; s.position = { ...at }; s.riding = id; s.heading = heading; s.vehicles[id] = { ...at, rot: heading }; }); errors.push(e);
      await p.waitForTimeout(400); const stick = await holdStick(p, context, wx, wz);
      const run = await p.evaluate(({ line }) => new Promise(resolve => {
        const out = []; let n = 0, since = 0;
        const tick = () => { const d = willowmere.render().drive, t = willowmere.metrics().journey; out.push({ x: d.riding.x, z: d.riding.z, speed: d.riding.speed, bumps: d.bumps, resting: d.resting, depth: t.edgeDepth }); if (d.riding.x > line - .6) since++; if (since > 150 || ++n > 3000) resolve(out); else requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
      }), { line });
      const first = run.findIndex(f => f.x > line - .6), touch = run[Math.max(0, first - 1)], top = Math.max(...run.slice(0, first).map(f => f.speed)), after = run.slice(first);
      assert.ok(first > 0, `${id}, ${name}: it reached the edge`); assert.ok(run.every(f => f.x <= line + 1e-6 && f.depth === 0), `${id}, ${name}: never past the line`);
      assert.ok(top >= spec.cruise, `${id}, ${name}: it came fast (${top.toFixed(1)} m/s)`); assert.ok(touch.speed <= spec.crawl + 1, `${id}, ${name}: at a crawl when it touches (${touch.speed.toFixed(2)} m/s, crawl ${spec.crawl})`);
      const slid = after.at(-1).z - after[0].z, fastest = Math.max(...after.map(f => f.speed));
      if (wz === 0) assert.ok(Math.abs(slid) < 3 || fastest < spec.cruise, `${id}, straight on: it rests against the edge or creeps along it (${slid.toFixed(1)} m, ${fastest.toFixed(1)} m/s)`);
      else { assert.ok(slid > 5, `${id}, at 30 degrees: it slides on along the edge (${slid.toFixed(1)} m south)`); assert.ok(fastest < spec.cruise - .5, `${id}: and not at cruise, as round a trunk (${fastest.toFixed(1)} m/s)`); }
      if (id === 'jeep') await shot(p, wz === 0 ? 'edge-car-stopped-844x390' : 'edge-car-sliding-844x390');
      await stick.release(); assert.equal(await toastShown(p), 'The world ends here');
      results.push({ name: `${id} at the east edge, ${name}`, topSpeed: +top.toFixed(1), speedAtTouch: +touch.speed.toFixed(2), slidMetres: +slid.toFixed(1), fastestAlongIt: +fastest.toFixed(1), framesToEdge: first });
      await context.close();
    }
  }
  assert.deepEqual(errors.flat(), []);
  await save('edge-results', results); console.log(JSON.stringify(results, null, 1)); console.log('edge-browser: all passed');
} catch (error) { console.error(error); console.error('page errors', errors.flat()); process.exitCode = 1; } finally { await browser.close(); }
