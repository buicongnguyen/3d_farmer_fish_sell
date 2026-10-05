import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { POND } from '../src/content.mjs';
import { waterDistance, FISH_POOLS } from '../src/pond.mjs';
import { BANK_FISH_LIMIT, bankFishSpot, deepFishPose } from '../src/bank-fish.mjs';
import { PondLife, shadowMatrix, tailM } from '../src/pond-life.mjs';
import { School, PondFx, mulberry32 } from '../src/pond-sim.mjs';

const anchor = { x: POND.x, z: POND.z + POND.d / 2 + .8 };
function pond(bankCatch) {
  const p = Object.create(PondLife.prototype);
  Object.assign(p, { world: { state: { bankCatch, upgrades: { pond: 0 } }, blocked: () => false }, school: new School(FISH_POOLS[0], 8), bankFish: [], bankAnchor: null, bankTotal: 0, root: new T.Group(), layers: [], kinds: new Map(), fx: new PondFx(), rng: mulberry32(11), light: false, kind() {} });
  return p;
}

test('bank pile stays on dry ground around every side and tries the other side of an obstacle', () => {
  const anchors = [anchor, { x: POND.x, z: POND.z - POND.d / 2 - .8 }, { x: POND.x + POND.w / 2 + .8, z: POND.z }, { x: POND.x - POND.w / 2 - .8, z: POND.z }];
  for (const a of anchors) for (let slot = 0; slot < BANK_FISH_LIMIT; slot++) {
    const spot = bankFishSpot(a, slot); assert.ok(waterDistance(spot.x, spot.z) >= 1.35); assert.ok(Math.hypot(spot.x - a.x, spot.z - a.z) > 1.3);
  }
  const blocked = (x, z) => x > anchor.x;
  const spot = bankFishSpot(anchor, 0, blocked); assert.ok(!blocked(spot.x, spot.z));
});

test('bank counts create stable fish positions across more catches and a reload, bounded for huge saves', () => {
  const bank = { ...anchor, fish: { perch: 1, carp: 1 } }, p = pond(bank); p.syncBank();
  const before = p.bankFish.map(f => ({ key: f.key, x: f.x, z: f.z }));
  bank.fish.perch++; p.syncBank();
  for (const old of before) { const f = p.bankFish.find(f => f.key === old.key); assert.deepEqual({ key: f.key, x: f.x, z: f.z }, old); }
  const reload = pond(structuredClone(bank)); reload.syncBank();
  for (const f of p.bankFish) { const reloaded = reload.bankFish.find(other => other.key === f.key); assert.deepEqual([reloaded.x, reloaded.z, reloaded.h], [f.x, f.z, f.h]); }
  assert.equal(p.bankTotal, 3); bank.fish.perch = 100000; p.syncBank();
  assert.equal(p.bankTotal, 100001); assert.equal(p.bankFish.length, BANK_FISH_LIMIT);
});

test('a catch lands into its saved grass slot; resize and tier changes preserve the leap, collection hides it', () => {
  const p = pond({ ...anchor, fish: { perch: 1 } }); p.school.choose('perch', { x: POND.x, z: POND.z });
  const f = p.land('perch', { x: POND.x, z: POND.z }, anchor), target = p.bankFish[0];
  assert.equal(f.bankKey, target.key); assert.deepEqual([f.to.x, f.to.z], [target.x, target.z]); assert.equal(f.to.ground, true);
  p.school.resize(5); assert.ok(p.school.fish.includes(f));
  p.world.state.upgrades.pond = 1; p.restock(); assert.equal(p.landing, f); assert.ok(p.school.fish.includes(f));
  p.school.update(.65); assert.equal(f.done, true); assert.ok(Math.abs(f.rz - Math.PI / 2) < 1e-8); assert.deepEqual([f.x, f.z], [target.x, target.z]);
  const airborne = p.land('perch', { x: POND.x, z: POND.z }, anchor);
  p.world.state.bankCatch = null; p.syncBank();
  assert.equal(airborne.hidden, true); assert.equal(p.bankTotal, 0); assert.equal(p.bankFish.length, 0);
});

test('deep fish drift visibly inside the pond and silhouette matrices stay horizontal above water', () => {
  const a = {}, b = {};
  for (let i = 0; i < 7; i++) for (let t = 0; t < 300; t += 7) {
    deepFishPose(i, t, a); deepFishPose(i, t + 1, b);
    assert.ok(Math.abs(a.x - POND.x) < POND.w / 2 - 1.5); assert.ok(Math.abs(a.z - POND.z) < POND.d / 2 - 1.3);
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > .001); shadowMatrix(a, 1.6);
    const geometry = new T.PlaneGeometry(); geometry.rotateX(-Math.PI / 2); geometry.applyMatrix4(new T.Matrix4().fromArray(tailM));
    const positions = geometry.getAttribute('position'); for (let n = 0; n < positions.count; n++) assert.ok(Math.abs(positions.getY(n) - .312) < 1e-6); geometry.dispose();
  }
  shadowMatrix({ x: 8, z: 9, h: 0, shadowY: .034 }, 1); assert.ok(Math.abs(tailM[13] - .034) < 1e-10);
});
