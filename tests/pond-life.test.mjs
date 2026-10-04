// The living pond's rules (src/pond-sim.mjs, src/pond.mjs): where the fish may swim, who swims, how the suitor behaves, the pools. Pure, no browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { POND } from '../src/content.mjs';
import { FISH_POOLS } from '../src/pond.mjs';
import { School, PondFx, Sparks, Rings, FISH_LOOK, inside, mulberry32, turn, SURFACE, RESTOCK } from '../src/pond-sim.mjs';
import { outline } from '../src/pond-water.mjs';
import { FishingSimulation } from '../src/fishing.mjs';

const step = (s, seconds, ctx = {}, dt = 1 / 60) => { for (let t = 0; t < seconds; t += dt) s.update(dt, ctx); };
const inRect = (f, m) => Math.abs(f.x - POND.x) <= POND.w / 2 - m && Math.abs(f.z - POND.z) <= POND.d / 2 - m;

test('every swimmer stays inside the pond rectangle, for a minute, with and without a float and a player', () => {
  for (const ctx of [{}, { float: { x: POND.x, z: POND.z }, player: { x: POND.x, z: POND.z - POND.d / 2 - 1 } }]) {
    const s = new School(FISH_POOLS[1], 8, { rng: mulberry32(3) });
    for (let t = 0; t < 60; t += 1 / 30) { s.update(1 / 30, ctx); for (const f of s.fish) assert.ok(inRect(f, .5), `fish ${f.id} at ${f.x.toFixed(2)},${f.z.toFixed(2)}`); }
  }
});
test('the swim has limits: speed about 0.5 to 1.1 m/s, a smooth turn, a small depth bob, a tail that stays in its swing', () => {
  const s = new School(FISH_POOLS[0], 8, { rng: mulberry32(11) }), last = new Map(s.fish.map(f => [f.id, { x: f.x, z: f.z, h: f.h }]));
  let fastest = 0;
  for (let i = 0; i < 1800; i++) {
    s.update(1 / 60, {});
    for (const f of s.fish) {
      const l = last.get(f.id), v = Math.hypot(f.x - l.x, f.z - l.z) * 60; fastest = Math.max(fastest, v);
      assert.ok(v < 2.4, `speed ${v}`); // 1.1 m/s plus the gentle push apart
      assert.ok(Math.abs(Math.atan2(Math.sin(f.h - l.h), Math.cos(f.h - l.h))) * 60 < 10, 'turn rate (at most 3 x pi rad/s: Zoo turns by dt * 3 of the angle left)');
      assert.ok(Math.abs(f.y) <= .0125); assert.ok(Math.abs(f.tail) <= FISH_LOOK[f.species].wag + 1e-6); last.set(f.id, { x: f.x, z: f.z, h: f.h });
    }
  }
  assert.ok(fastest > .5, 'they do swim');
});
test('the same seed gives the same pond, another seed another', () => {
  const run = seed => { const s = new School(FISH_POOLS[2], 8, { rng: mulberry32(seed) }); step(s, 5); return JSON.stringify(s.metrics); };
  assert.equal(run(5), run(5)); assert.notEqual(run(5), run(6));
});
test('who swims: exactly the species the tier can catch, all of them, 3/3/2 of eight; rainbow and golden swim at tiers 2 and 3, the catfish is gone at tier 1', () => {
  FISH_POOLS.forEach((pool, tier) => {
    const s = new School(pool, 8), kinds = new Set(s.fish.map(f => f.species));
    assert.deepEqual([...kinds].sort(), [...pool].sort(), 'tier ' + tier); assert.deepEqual(pool.map(p => s.count(p)).sort(), [2, 3, 3]);
    for (const p of pool) assert.ok(FISH_LOOK[p], p + ' has a look');
  });
  assert.ok(new School(FISH_POOLS[2], 8).fish.some(f => f.species === 'rainbow')); assert.ok(new School(FISH_POOLS[3], 8).fish.some(f => f.species === 'golden'));
  assert.ok(!new School(FISH_POOLS[1], 8).fish.some(f => f.species === 'catfish'));
  assert.equal(new School(FISH_POOLS[0], 5).fish.length, 5);
});
test('fish keep away from the float', () => {
  const float = { x: POND.x + 1, z: POND.z }, player = { x: POND.x - 3, z: POND.z - POND.d / 2 - .8 };
  const s = new School(FISH_POOLS[0], 8, { rng: mulberry32(2) }); let closest = 1e9;
  for (let t = 0; t < 40; t += 1 / 30) { s.update(1 / 30, { float, player }); if (t > 3) for (const f of s.fish) closest = Math.min(closest, Math.hypot(f.x - float.x, f.z - float.z)); }
  assert.ok(closest > .7, `no swimmer came within 0.7 m of the float (${closest.toFixed(2)})`);
});
test('the suitor swims in, holds off, darts at each nibble, takes the float at the bite, thrashes while hooked and bolts when it is lost', () => {
  const float = { x: POND.x, z: POND.z }, player = { x: POND.x, z: POND.z - POND.d / 2 - 1 };
  const s = new School(FISH_POOLS[1], 8, { rng: mulberry32(4) }); step(s, 2);
  const far = s.choose('koi', float); assert.ok(far >= 1.1 && far <= 4.5); const f = s.suitor; assert.equal(f.species, 'koi'); assert.equal(f.mode, 'suitor');
  const sim = { phase: 'approach', fishDistance: far, dart: 0, surge: 0 };
  const run = (sec, fn) => { for (let t = 0; t < sec; t += 1 / 60) { fn?.(t); s.update(1 / 60, { float, player }); s.drive(1 / 60, sim, float, player); } };
  const d = () => Math.hypot(f.x - float.x, f.z - float.z);
  sim.fishDistance = .55; run(3); assert.ok(Math.abs(d() - .55) < .25, 'it holds about .55 m off ' + d());
  sim.phase = 'nibble'; let lo = 9, hi = 0; run(1.2, t => { sim.dart = Math.max(0, .3 - (t % .6)); lo = Math.min(lo, d()); hi = Math.max(hi, d()); });
  assert.ok(hi - lo > .15 && hi < .95, `it darts (${lo.toFixed(2)}..${hi.toFixed(2)})`);
  sim.phase = 'bite'; sim.dart = 0; run(1); assert.ok(d() < .25, 'at the bite it has the float ' + d());
  sim.phase = 'hooked'; sim.surge = .6; let rz = [9, -9], tail = [9, -9];
  run(1.5, () => { rz = [Math.min(rz[0], f.rz), Math.max(rz[1], f.rz)]; tail = [Math.min(tail[0], f.tail), Math.max(tail[1], f.tail)]; });
  assert.ok(rz[1] - rz[0] > .3 && tail[1] - tail[0] > .3, 'it thrashes'); assert.ok(d() < 1, 'within 1 m of the float');
  assert.ok(s.fx.sparks.count + s.fx.bubbles.count + s.fx.rings.count > 0, 'spray, bubbles and rings while it thrashes');
  s.flee(f, 3.2, float); assert.equal(f.mode, 'flee'); const x = f.x, z = f.z; run(.5); assert.ok(Math.hypot(f.x - x, f.z - z) > .8, 'it bolts'); run(1.5); assert.equal(f.mode, 'swim'); assert.equal(s.suitor, null);
});
test('a species with no swimmer left enters from the rim; a landed fish is restocked after 3 s and the school stays full', () => {
  const s = new School(FISH_POOLS[0], 8, { rng: mulberry32(9) }); s.fish = s.fish.filter(f => f.species !== 'catfish');
  const float = { x: POND.x, z: POND.z }; s.choose('catfish', float); assert.equal(s.suitor.species, 'catfish');
  const landed = s.land('catfish', float, { x: POND.x, z: POND.z - 6, y: 1.2 }); assert.equal(landed.mode, 'land'); step(s, .8); assert.ok(landed.done, 'the leap takes 0.65 s');
  const n = s.fish.length; step(s, RESTOCK + .2); assert.equal(s.fish.length, n + 1); assert.ok(s.pool.every(p => s.count(p) >= 1));
});
test('the effects pools: recycled, never growing; spray dies on the water; bubbles rise and pop with a ring; a phone has fewer', () => {
  const fx = new PondFx({ rng: mulberry32(1) });
  for (let i = 0; i < 50; i++) fx.burst(0, 0, 20, 3, 4, .07); assert.ok(fx.sparks.count <= fx.sparks.max);
  for (let i = 0; i < 40; i++) fx.ring(0, 0, .1, 1, .5); assert.ok(fx.rings.count <= fx.rings.max);
  fx.update(.016); assert.ok(fx.sparks.count > 0); for (let i = 0; i < 120; i++) fx.update(.016); assert.equal(fx.sparks.count, 0, 'the spray fell back'); assert.equal(fx.rings.count, 0);
  fx.bubble(0, SURFACE - .1, 0); assert.equal(fx.bubbles.count, 1); const y0 = fx.bubbles.p[1]; fx.update(.2); assert.ok(fx.bubbles.p[1] > y0, 'it rises');
  for (let i = 0; i < 90 && fx.bubbles.count; i++) fx.update(.016); assert.equal(fx.bubbles.count, 0); assert.ok(fx.rings.count > 0, 'the pop is a small ring');
  const light = new PondFx({ light: true }); assert.equal(light.bubbles.max, 0); light.bubble(0, 0, 0); assert.equal(light.bubbles.count, 0); assert.ok(light.rings.max < fx.rings.max && light.sparks.max < fx.sparks.max);
  const r = new Rings(2); r.add(0, 0, 0, 1, 1); assert.equal(r.radius(0), 0); r.update(.5); assert.ok(Math.abs(r.radius(0) - .5) < 1e-6); assert.ok(r.alpha(0) < .8);
  const sp = new Sparks(3); for (let i = 0; i < 9; i++) sp.emit(0, 1, 0, 0, 0, 0, 1, .1); assert.equal(sp.count, 3);
});
test('the water outline is a rounded rectangle on the water line, and the shore fades out within 1.2 m (the bank logic reaches 3 m)', () => {
  const pts = outline(0); assert.equal(pts.length, 44);
  for (const [x, z] of pts) assert.ok(Math.abs(x) <= POND.w / 2 + 1e-6 && Math.abs(z) <= POND.d / 2 + 1e-6);
  assert.ok(Math.max(...pts.map(p => p[0])) > POND.w / 2 - .01);
  const out = outline(1.2); assert.ok(Math.max(...out.map(p => p[0])) <= POND.w / 2 + 1.2 + 1e-6);
  assert.ok(inside(POND.x, POND.z) && !inside(POND.x + POND.w / 2, POND.z)); assert.ok(Math.abs(turn(0, Math.PI * 2 - .1, 1) + .1) < 1e-9);
});
test('the simulation still decides the outcome: the view only reads its counters', () => {
  const sim = new FishingSimulation({ quality: .3, bait: false, random: () => .4, choose: () => ({ id: 'koi', power: .3 }), approachFrom: () => 1.1, cast: { x: 0, z: 0 } });
  assert.equal(sim.phase, 'cast'); for (const k of ['nibbles', 'earlyPresses', 'missedBites', 'fishDistance', 'dart']) assert.equal(typeof sim[k], 'number', k);
});
