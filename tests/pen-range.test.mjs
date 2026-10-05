// The pen's roaming range (pen-range.mjs) and the animals walking it: the range is clear of everything it must be, connected,
// reachable through the gate; hours of simulated days at 30 Hz put no animal on a road, in the pond or anywhere outside it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { staticCuts, fenceCuts, wantsOut, gateOpenAt, DAY } from '../src/pen-range.mjs';
import { PEN, PEN_PROPS, PEN_ROSTER, penFence, roamRadius } from '../src/pen-roam.mjs';
import { LANES } from '../src/villagers.mjs';
import { ROADS, POND } from '../src/content.mjs';
import { SAFE } from '../src/ward.mjs';
import { simulate, sharedRange, cutDistance } from './pen-sim.mjs';

const range = sharedRange(), cuts = staticCuts(), penArea = (PEN.x1 - PEN.x0) * (PEN.z1 - PEN.z0);

test('the pen grew about 30 % where there is room (north, a little west and east), keeping its gate and props sensible', () => {
  const w = PEN.x1 - PEN.x0, d = PEN.z1 - PEN.z0;
  assert.ok(d / 8.4 > 1.25 && d / 8.4 < 1.35, `depth ${d} m against 8.4`); assert.ok(w > 15 && w < 17.5, `width ${w} m against 15`);
  assert.ok(PEN.gate[0] > PEN.x0 + 4 && PEN.gate[1] < PEN.x1 - 4 && PEN.gate[1] - PEN.gate[0] >= 2.5, 'a gate at least 2.5 m wide, not in a corner');
  for (const p of PEN_PROPS) assert.ok(p.x - p.r >= PEN.x0 + .3 && p.x + p.r <= PEN.x1 - .3 && p.z - p.r >= PEN.z0 + .3 && p.z + p.r <= PEN.z1 - .3, `${p.id} inside the fence`);
  const trough = PEN_PROPS[2], basket = PEN_PROPS[3]; assert.ok(trough.x + trough.r < PEN.gate[0] && basket.x + basket.r < PEN.gate[0], 'the trough and the basket stand beside the gate, not in it');
  const pieces = penFence(); assert.equal(pieces.filter(p => p.rot !== 0).length, 8); assert.ok(pieces.every(p => p.x >= PEN.x0 - 1e-9 && p.x <= PEN.x1 + 1e-9 && p.z >= PEN.z0 - 1e-9 && p.z <= PEN.z1 + 1e-9));
  assert.ok(!pieces.some(p => p.z === PEN.z1 && p.x > PEN.gate[0] && p.x < PEN.gate[1]), 'the gate is open');
  // north of the pen: the road's verge; west: the house lane; east: the barn
  assert.ok(PEN.z0 > ROADS.north + 2.5 + 1.5 && PEN.x0 > LANES.nodes.hNE.x + .5 && PEN.x1 < 23.8);
});

test('the range is a rectangle three times the pen in each direction, centred on it, inside the ward', () => {
  const r = range.rect, cx = (PEN.x0 + PEN.x1) / 2, cz = (PEN.z0 + PEN.z1) / 2;
  assert.ok(Math.abs((r.x1 - r.x0) - 3 * (PEN.x1 - PEN.x0)) < 1e-6 && Math.abs((r.z1 - r.z0) - 3 * (PEN.z1 - PEN.z0)) < 1e-6);
  assert.ok(Math.abs((r.x0 + r.x1) / 2 - cx) < 1e-6 && Math.abs((r.z0 + r.z1) / 2 - cz) < 1e-6);
  for (const p of range.samples(.5)) assert.ok(p.x > SAFE.x0 && p.x < SAFE.x1 && p.z > SAFE.z0 && p.z < SAFE.z1);
});

test('no point of the range lies within the margin of a road, the pond, a building, a lane, a tree, a bed, a prop or the fence', () => {
  const samples = range.samples(.4); assert.ok(samples.length > 1500, `${samples.length} sample points`);
  for (const p of samples) { const c = cutDistance(cuts, p.x, p.z); assert.ok(c.d > -.2, `(${p.x.toFixed(1)}, ${p.z.toFixed(1)}) is ${c.d.toFixed(2)} m inside the ${c.cat} margin`); }
  // the margins the plan promises, measured from the surface itself: asphalt 1.5 m, the pond 2.5, gravel 0.4, buildings 0.45
  const cat = (name, m) => assert.ok(cuts.rects.some(s => s.cat === name && s.m === m), `${name} margin ${m}`);
  cat('road', 1.5); cat('pond', 2.5); cat('lane', .4); cat('building', .45);
  // the pond and the north road, the two the user named, checked by hand (grid slack 0.2 m)
  for (const p of samples) {
    const dx = Math.max(0, Math.abs(p.x - POND.x) - POND.w / 2), dz = Math.max(0, Math.abs(p.z - POND.z) - POND.d / 2); assert.ok(Math.hypot(dx, dz) > 2.5 - .2);
    assert.ok(Math.abs(p.z - ROADS.north) > 2.5 + 1.5 - .2 || Math.abs(p.x) > ROADS.east + 4);
  }
});

test('the real figure: more than one and a half pens usable in one connected piece, and the report says what cut the rest', () => {
  const rep = range.report(); assert.ok(rep.usable >= 1.5 * penArea, `${rep.usable} m2 usable, ${rep.times} x the pen`); assert.ok(rep.usable <= rep.total);
  assert.equal(range.pieces(), 1, 'one connected piece'); assert.ok(Math.abs(rep.total - 9 * penArea) < 12, `the rectangle is nine pens (${rep.total} m2 against ${(9 * penArea).toFixed(0)})`);
  for (const k of ['road', 'lane', 'building', 'fence', 'unreachable']) assert.ok(rep.cut[k] > 0, `${k} cuts some`);
  const sum = Object.values(rep.cut).reduce((a, b) => a + b, 0) + rep.usable; assert.ok(Math.abs(sum - rep.total) < 1, `every square metre is counted once (${sum.toFixed(1)} of ${rep.total})`);
});

test("the pen's own interior is in the range, and the gate connects it to the meadow outside", () => {
  let n = 0;
  for (let z = PEN.z0 + 1.2; z < PEN.z1 - .6; z += .5) for (let x = PEN.x0 + 1; x < PEN.x1 - 1; x += .5) {
    if (PEN_PROPS.some(p => Math.hypot(x - p.x, z - p.z) < p.r + .7)) continue; n++;
    assert.ok(range.isInRange(x, z), `(${x}, ${z}) inside the pen is in the range`); assert.ok(isFinite(range.homeDistance(x, z, .34)));
  }
  assert.ok(n > 200);
  const g = range.gatePoints(); for (const p of [g.inside, g.outside]) assert.ok(range.isInRange(p.x, p.z), "the gate's two sides are in the range");
  const far = range.samples(1).filter(p => !range.inPen(p.x, p.z) && Math.hypot(p.x - g.x, p.z - PEN.z1) > 12); assert.ok(far.length > 20, `${far.length} far points`);
  for (const r of [roamRadius({ kind: 'chicken' }), roamRadius({ kind: 'pig' }), roamRadius({ kind: 'cow' })]) {
    assert.ok(isFinite(range.homeDistance(g.outside.x, g.outside.z, r)), `radius ${r} passes the gate`);
    const reach = far.filter(p => isFinite(range.homeDistance(p.x, p.z, r))); assert.ok(reach.length > (r < .4 ? 20 : 5), `radius ${r}: ${reach.length} far points`);
    const route = range.routeTo(reach[0].x, reach[0].z, r); assert.ok(route && route[0].z < PEN.z1 && route[1].z > PEN.z1, 'the route goes out through the gate'); for (const p of route) assert.ok(range.isInRange(p.x, p.z));
  }
  // shut at night: the bars block the opening; open by day
  range.setGate(false); assert.ok(range.blocked(g.x, PEN.z1, .3)); assert.ok(!range.blocked(g.x, PEN.z1 - 2, .3)); range.setGate(true); assert.ok(!range.blocked(g.x, PEN.z1, .3));
});

test('a cut cell is never stood on: blocked() agrees with the cut-outs, and a body keeps its radius off them', () => {
  for (const r of [.34, .6, .85]) for (const p of range.samples(.7)) if (!range.blocked(p.x, p.z, r)) {
    const c = cutDistance(cuts, p.x, p.z); assert.ok(c.d > r - .45 || range.inPen(p.x, p.z), `r ${r} at (${p.x.toFixed(1)}, ${p.z.toFixed(1)}): ${c.d.toFixed(2)} from ${c.cat}`);
  }
  for (const p of [{ x: 0, z: ROADS.north }, { x: POND.x, z: POND.z }, { x: 28, z: -19.5 }, { x: 0, z: -14 }, { x: -3, z: -25 }, { x: 60, z: 0 }]) assert.ok(range.blocked(p.x, p.z, .1), `${p.x}, ${p.z}`);
});

test('the hours: out at half past seven, called home from just after six, the gate open while anyone is out', () => {
  const w = { uid: 0 }; assert.ok(!wantsOut(w, 7.2) && wantsOut(w, 8) && wantsOut(w, 12) && !wantsOut(w, 18.9) && !wantsOut(w, 22) && !wantsOut(w, 3));
  assert.ok(gateOpenAt(12, false) && !gateOpenAt(22, false) && gateOpenAt(22, true) && !gateOpenAt(5, false)); assert.ok(DAY.out >= 7 && DAY.home <= 18.5);
});

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
test('20 seeds x 10 simulated hours at 30 Hz (noon to ten at night): never outside the range, never in a road or the pond, all home at night, nobody stuck', { timeout: 600000 }, () => {
  const totals = { chicken: 0, duck: 0, cow: 0, pig: 0 }; let worst = 0;
  for (const seed of SEEDS) {
    const r = simulate({ seed, from: 12, hours: 10, every: 3 });
    assert.deepEqual(r.violations.slice(0, 3), [], `seed ${seed}`); assert.equal(r.insideAtEnd, r.shown, `seed ${seed}: everyone is back in the pen at 22:00 (${JSON.stringify(r.final)})`);
    assert.equal(r.shut, 0, `seed ${seed}: the gate was never shut on an animal outside`);
    assert.ok(r.maxStuck <= 600, `seed ${seed}: stuck for ${r.maxStuck.toFixed(0)} s at ${JSON.stringify(r.stuckAt)}`); worst = Math.max(worst, r.maxStuck);
    for (const k of Object.keys(totals)) totals[k] += r.kinds[k] ?? 0;
  }
  for (const k of Object.keys(totals)) assert.ok(totals[k] > 0, `${k}s spent time outside the pen`);
  assert.ok(worst <= 600, 'longest stand-still ' + worst);
});

test('20 seeds from half past six: every animal leaves by the gate in the morning and keeps to the range', { timeout: 600000 }, () => {
  for (const seed of SEEDS) {
    const r = simulate({ seed: seed + 100, from: 6.5, hours: 3, every: 3 }); assert.deepEqual(r.violations.slice(0, 3), [], `seed ${seed}`);
    assert.equal(r.left, r.shown, `seed ${seed}: all ${r.shown} leave the yard by day (${r.left} did)`); assert.ok(r.gateTraffic >= 3, `seed ${seed}: ${r.gateTraffic} went out through the gate`); assert.ok(r.maxStuck <= 600);
  }
});

test('the smaller pens (levels 0 to 2) work the same way, and a hidden animal is left alone', () => {
  for (const level of [0, 1, 2]) {
    const r = simulate({ seed: 7 + level, from: 12, hours: 10, level, every: 6 }); assert.deepEqual(r.violations.slice(0, 2), []); assert.equal(r.insideAtEnd, r.shown);
    assert.equal(r.shown, PEN_ROSTER.filter(a => a.level <= level).length);
  }
});
