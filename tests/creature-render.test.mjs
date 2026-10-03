// The creatures' drawing rules that rest on the seeded spawn plan (round 8, step 0; owner: builder D). Moved here from
// tests/render.test.mjs (builder C's file), where they asserted builder D's plan: the glide between simulation steps and
// the window of cells that widens with the camera. The stands are in the Redrock Canyon ('east').
import test from 'node:test';
import assert from 'node:assert/strict';
import { Wilds, STEP, glideShare, GLIDE_MAX, wildCell, CREATURES, inSafeZone, WILD_CELL } from '../src/wilds.mjs';
import { regionAt } from '../src/regions.mjs';

const seeded = (seed = 7) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

test('a calm creature far away is drawn gliding between its 100 ms moves: no still frames, no jumps', () => {
  const wilds = new Wilds({}, seeded(3));
  // A spot in the Redrock Canyon with creatures near; the player stands where none of them can see them. (The scan stays inside
  // the canyon's square: beyond it the lands are empty until builder D's kinds arrive.)
  let spot = null; for (let x = 70; x < 190 && !spot; x += 8) for (let z = -60; z < 60 && !spot; z += 8) { if (inSafeZone(x, z)) continue; wilds.sync(true, x, z); const calm = wilds.list.filter(e => e.def.speed > 0 && Math.hypot(e.x - x, e.z - z) > e.def.sight + 3 && Math.hypot(e.x - x, e.z - z) < 40); if (calm.length >= 2 && wilds.list.every(e => Math.hypot(e.x - x, e.z - z) > e.def.sight + 3)) spot = { x, z }; }
  assert.ok(spot, 'a calm spot exists');
  wilds.sync(true, spot.x, spot.z); const hero = { x: spot.x, z: spot.z, active: true };
  for (let i = 0; i < 80; i++) wilds.step(STEP, hero);
  const movers = wilds.list.filter(e => e.def.speed > 0 && e.phase === 'idle' && !e.resting && Math.hypot(e.x - spot.x, e.z - spot.z) < 46); assert.ok(movers.length >= 2);
  // 60 frames a second against 40 steps a second, as in the browser: the drawn place, frame by frame.
  const frame = 1 / 60, drawn = new Map(movers.map(e => [e, []])), raw = new Map(movers.map(e => [e, []])); let acc = 0;
  for (let f = 0; f < 600; f++) {
    acc += frame; while (acc >= STEP - 1e-9) { acc -= STEP; wilds.step(STEP, hero); }
    for (const e of movers) { const k = glideShare(e, wilds.time + acc); drawn.get(e).push([e.px + (e.x - e.px) * k, e.pz + (e.z - e.pz) * k]); raw.get(e).push([e.x, e.z]); }
  }
  let wanderers = 0;
  for (const e of movers) {
    const steps = list => list.slice(1).map((p, i) => Math.hypot(p[0] - list[i][0], p[1] - list[i][1])), d = steps(drawn.get(e)), s = steps(raw.get(e)), moved = s.filter(v => v > 0);
    if (moved.length < 20) continue; wanderers++;
    // The simulation itself: mostly still, then a jump of up to 6 cm (0.6 m/s x 0.1 s).
    assert.ok(s.filter(v => v === 0).length > s.length * .5, `${e.type}: simulated places stand still on most frames`); assert.ok(Math.max(...s) > .04);
    // Drawn: no frame jumps more than a walk at 0.6 m/s covers in a frame and a half.
    assert.ok(Math.max(...d) < .6 * frame * 1.6, `${e.type}: drawn step ${Math.max(...d).toFixed(4)} m`);
    assert.ok(d.filter(v => v === 0).length < s.filter(v => v === 0).length * .5, `${e.type}: it keeps moving between simulation steps`);
    for (const p of drawn.get(e)) assert.ok(Number.isFinite(p[0]) && Number.isFinite(p[1]));
  }
  assert.ok(wanderers >= 1, 'at least one wanderer was followed');
  // A respawn is a jump, not a walk: it is not glided.
  const e = movers[0]; e.hp = 0; e.respawn = 0; e.x += 9; hero.x = e.homeX + 60; wilds.step(STEP, hero); assert.equal(e.hp, e.maxHp); assert.equal(glideShare(e, wilds.time), 1); assert.equal(e.px, e.x);
  assert.ok(GLIDE_MAX > 13 * STEP * 4, 'a charge is still a walk');
});

test('the creature window widens for a camera zoomed far out, and every creature in it is the seeded one', () => {
  // Standing at the canyon's stand point (128, 0), where the step 0 densities are already real.
  const wilds = new Wilds({}, seeded(1)); wilds.sync(true, 128, 0); assert.equal(wilds.cells.size, 25);
  wilds.sync(true, 128, 0, 4); assert.equal(wilds.cells.size, 81); const ids = new Set(wilds.list.map(e => e.id)); assert.equal(ids.size, wilds.list.length, 'no creature twice');
  // A cell of the wide window that the 5 x 5 one also holds, in the canyon: its seeded plan is not empty, and every creature of it is in the list.
  const cx = Math.floor(128 / WILD_CELL), cz = Math.floor(0 / WILD_CELL), plan = wildCell(cx - 2, cz); assert.ok(plan.length > 0 && plan.every(c => regionAt(c.x, c.z) === 'east'), 'the checked cell holds canyon creatures');
  for (const c of plan) assert.ok(ids.has(c.id));
  // And one only the wide window holds (four cells west of the stand, in the canyon's strip by the village).
  const wide = wildCell(cx - 4, cz + 1); for (const c of wide) assert.ok(ids.has(c.id));
  wilds.sync(true, 128, 0, 2); assert.equal(wilds.cells.size, 25); assert.ok(wilds.list.length < ids.size);
  assert.ok(Object.keys(CREATURES).length >= 9);
});
