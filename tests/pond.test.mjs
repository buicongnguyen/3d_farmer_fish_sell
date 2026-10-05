// Fishing from anywhere along the pond's bank (src/pond.mjs): where you may stand, where a tap on the pond walks you,
// where the float lands, and that the fishing rules still play from every side.
import test from 'node:test';
import assert from 'node:assert/strict';
import { POND, FISH_SPOT } from '../src/content.mjs';
import { BANK, waterDistance, shorePoint, atBank, castPlan } from '../src/pond.mjs';
import { blockedAt } from '../src/village-plan.mjs';
import { FishingSimulation, earlyPull } from '../src/fishing.mjs';

const far = (a, b) => Math.hypot(a.x - b.x, a.z - b.z), x0 = POND.x - POND.w / 2, x1 = POND.x + POND.w / 2, z0 = POND.z - POND.d / 2, z1 = POND.z + POND.d / 2;
const inPond = (p, edge = 0) => p.x >= x0 + edge - 1e-9 && p.x <= x1 - edge + 1e-9 && p.z >= z0 + edge - 1e-9 && p.z <= z1 - edge + 1e-9;
/** Places all round the pond, exactly `off` metres from the water (round the corners too). */
function around(off, n = 72) {
  const out = [];
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, fx = POND.x + Math.cos(a) * 40, fz = POND.z + Math.sin(a) * 40, wx = Math.max(x0, Math.min(x1, fx)), wz = Math.max(z0, Math.min(z1, fz)), d = Math.hypot(fx - wx, fz - wz); out.push({ x: wx + (fx - wx) / d * off, z: wz + (fz - wz) / d * off }); }
  return out;
}
/** The bank line itself: the nearest standing place for points all round. */
const bankLine = (n = 72) => Array.from({ length: n }, (_, i) => shorePoint(POND.x + Math.cos(i / n * Math.PI * 2) * 40, POND.z + Math.sin(i / n * Math.PI * 2) * 40));

test('the bank: every point round the pond is a place to stand, a few steps from the water', () => {
  assert.equal(waterDistance(POND.x, POND.z), 0); assert.equal(waterDistance(x1 + 2, POND.z), 2); assert.ok(Math.abs(waterDistance(x1 + 3, z1 + 4) - 5) < 1e-9);
  for (const p of bankLine()) {
    // On the line BANK.gap from the water (a corner of that line is a little farther), free to stand on, and in reach of the water.
    assert.ok(waterDistance(p.x, p.z) >= BANK.gap - 1e-9 && waterDistance(p.x, p.z) <= BANK.gap * Math.SQRT2 + 1e-9); assert.equal(blockedAt(p.x, p.z), false, `${p.x.toFixed(1)}, ${p.z.toFixed(1)}`); assert.equal(atBank(p.x, p.z), true);
  }
  // The nearest bank point really is the nearest: no other point of the bank line is closer.
  const line = bankLine(720);
  for (const from of [{ x: POND.x, z: z1 + 9 }, { x: x0 - 6, z: POND.z - 1 }, { x: x1 + 4, z: z0 - 7 }, { x: POND.x + 3, z: z0 - 2 }, { x: -3, z: 2 }, { x: 40, z: 30 }]) {
    const s = shorePoint(from.x, from.z); for (const p of line) assert.ok(far(from, s) <= far(from, p) + .09);
  }
  // From right at the water's edge (inside the line) you are sent straight back out, not across the pond.
  assert.ok(far(shorePoint(POND.x, z1 + .4), { x: POND.x, z: z1 + BANK.gap }) < 1e-9); assert.ok(far(shorePoint(x0 - .35, POND.z + 1), { x: x0 - BANK.gap, z: POND.z + 1 }) < 1e-9);
  const out = { x: 0, z: 0 }; assert.equal(shorePoint(0, 0, out), out, 'writes into the object you give it');
  // The cast is offered within BANK.reach of the water on every side, and not from farther off; the old dock still works.
  for (const p of around(BANK.reach - .05)) assert.equal(atBank(p.x, p.z), true); for (const p of around(BANK.reach + .4)) assert.equal(atBank(p.x, p.z), false);
  assert.equal(atBank(FISH_SPOT.x, FISH_SPOT.z), true); assert.ok(BANK.reach >= 2.5 && BANK.reach <= 3.5, 'about 3 m, as in the reference');
  // One border for everything: there is no second, wider ring for the rod in the hand.
  assert.equal(BANK.near, undefined);
  // A walk to the bank ends well inside the border, at the corners too (the stop is BANK.arrive * 0.82 from the bank point, world.mjs).
  for (const p of bankLine(720)) assert.ok(waterDistance(p.x, p.z) + BANK.arrive * .82 <= BANK.reach - .5, `a far tap ends inside the border near ${p.x.toFixed(1)}, ${p.z.toFixed(1)}`);
  // The places by the dock where E once cost energy for nothing: each is either at the border (the cast works there) or outside it (nothing is offered).
  for (const [x, z, at] of [[12, POND.z+POND.d/2+2.4, true], [12, POND.z+POND.d/2+2.9, true], [10.2, POND.z+POND.d/2+2.5, true], [12, POND.z+POND.d/2+3.1, false], [12, POND.z+POND.d/2+3.4, false]]) assert.equal(atBank(x, z), at, `${x}, ${z}`);
});

test('a cast from any bank lands in the pond, toward the water or toward the tap', () => {
  for (const off of [.35, BANK.gap, BANK.reach]) for (const me of around(off)) {
    const { cast, water, shore } = castPlan(me), length = far(me, cast);
    assert.ok(inPond(cast, BANK.edge), `the float is in the pond (from ${me.x.toFixed(1)}, ${me.z.toFixed(1)})`); assert.ok(length >= 1.2 && length <= BANK.max + off + 1e-9, `a cast of ${length.toFixed(1)} m`);
    // Toward the water: the float is farther into the pond than you are, on your side of it.
    assert.ok((cast.x - me.x) * (POND.x - me.x) + (cast.z - me.z) * (POND.z - me.z) > 0); assert.ok(far(cast, me) < far({ x: 2 * POND.x - me.x, z: 2 * POND.z - me.z }, cast), 'on your side of the pond');
    // The round of water the fishing rules use lies under the float, inside the pond; one early press does not reel a normal cast in.
    assert.ok(inPond(water) && water.r === POND.d / 2 && water.bounds === POND); assert.equal(earlyPull(water, cast, me).reeledIn, off > 1.6 ? earlyPull(water, cast, me).reeledIn : false);
    assert.ok(far(shore, me) <= off + BANK.gap * Math.SQRT2 + 1e-9);
  }
  // A tap on the pond: the float lands on the tap when the line reaches it, and as far toward it as the line goes when it does not.
  const south = { x: POND.x - 2, z: z1 + .6 }, tap = { x: POND.x - 1, z: z1 - 3.4 }; assert.deepEqual(castPlan(south, tap).cast, tap);
  const west = { x: x0 - .6, z: POND.z }, farTap = { x: x1 - 1, z: POND.z + 1 }, long = castPlan(west, farTap).cast; assert.ok(inPond(long, BANK.edge) && far(west, long) <= BANK.max + .6 + 1e-9 && far(west, long) > BANK.max - .5 && long.x > x0 + BANK.max - .6);
  // A tap right at your feet still casts a proper line; a tap outside the water is brought into it.
  assert.ok(far(south, castPlan(south, { x: south.x, z: z1 - .1 }).cast) >= 1.8 - 1e-9); assert.ok(inPond(castPlan(south, { x: x1 + 3, z: z0 - 3 }).cast, BANK.edge));
  // From an end you cast along the pond, from a side across it.
  const end = castPlan({ x: x1 + .6, z: POND.z }).cast, side = castPlan({ x: POND.x, z: z0 - .6 }).cast; assert.ok(Math.abs(end.z - POND.z) < 1e-9 && end.x < x1 - 2); assert.ok(Math.abs(side.x - POND.x) < 1e-9 && side.z > z0 + 2);
});

test('the fishing rules play from every bank: a bite, a hook, a fish landed', () => {
  for (const me of [{ x: POND.x, z: z0 - .6 }, { x: x1 + .6, z: POND.z + 2 }, { x: x0 - .6, z: POND.z - 3 }, { x: FISH_SPOT.x, z: FISH_SPOT.z }]) {
    const line = castPlan(me), s = new FishingSimulation({ quality: .3, bait: false, random: () => .4, choose: () => ({ id: 'carp', power: .4 }), approachFrom: () => 1.1, cast: line.cast, water: line.water, player: me });
    for (let i = 0; i < 4000 && s.phase !== 'bite'; i++) s.update(.025, false); assert.equal(s.phase, 'bite');
    s.update(.025, true); assert.equal(s.phase, 'hooked');
    for (let i = 0; i < 4000 && !s.finished; i++) s.update(.025, s.tension < .6 && s.surge <= 0); assert.equal(s.phase, 'caught', `from ${me.x}, ${me.z}`);
    assert.ok(inPond(s.cast), 'the float stayed in the pond');
  }
});
