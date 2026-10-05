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

test('interleaved catches use unique slots that stay stable between catches and across reloads', () => {
  const bank = { ...anchor, fish: { perch: 1, carp: 1 } }, p = pond(bank); p.syncBank();
  bank.fish.perch++; p.syncBank();
  const snapshot = p => p.bankFish.map(({ key, slot, x, z, h }) => ({ key, slot, x, z, h })), before = snapshot(p);
  assert.equal(new Set(p.bankFish.map(f => f.slot)).size, 3); p.syncBank(); assert.deepEqual(snapshot(p), before);
  const reload = pond(structuredClone(bank)); reload.syncBank();
  assert.deepEqual(snapshot(reload), before); assert.equal(p.bankTotal, 3);
});

test('nine to twenty-four identical catches have distinct positions, and huge saves stay bounded', () => {
  const bank = { ...anchor, fish: { perch: 0, carp: 1 } }, p = pond(bank);
  for (let count = 1; count <= BANK_FISH_LIMIT; count++) {
    bank.fish.perch = count; p.syncBank();
    const shown = Math.min(count + 1, BANK_FISH_LIMIT);
    assert.equal(p.bankFish.length, shown); assert.equal(new Set(p.bankFish.map(f => f.slot)).size, shown);
    assert.equal(new Set(p.bankFish.map(f => [f.x, f.z, f.lift].join(','))).size, shown);
  }
  bank.fish.perch = 100000; p.syncBank();
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

test('coloured pond fish have no paired hint, and deep hints stay clear of visible fish', () => {
  globalThis.innerHeight = 900;
  const p = pond(null), mesh = () => {
    const m = new T.InstancedMesh(new T.PlaneGeometry(), new T.MeshBasicMaterial(), 40);
    m.setColorAt(0, new T.Color('#fff')); return m;
  };
  const body = { mesh: mesh(), n: 0, tail: false };
  const kind = { layers: [body], scale: 1, top: .3, bottom: 0, half: .25 };
  Object.assign(p, { age: 1, layers: [body], kind: species => species === 'perch' ? kind : null,
    shadows: mesh(), spray: mesh(), bubbleMesh: mesh(), ringMesh: mesh(), deepPose: {}, deepShadows: 0 });
  const camera = new T.OrthographicCamera(-10, 10, 10, -10), swimmer = { ...p.school.fish[0], species: 'perch', x: POND.x, z: POND.z, mode: 'swim' };
  p.school.fish = [-.03, 0, .15].map(y => ({ ...swimmer, y }));
  p.draw(camera);
  assert.equal(body.mesh.count, 3); assert.equal(p.shadows.count, 0, 'bob height does not add a shadow over coloured bodies');
  p.school.fish.push({ ...swimmer, species: 'missing', y: 0 }, { ...swimmer, species: 'missing', hidden: true }, { ...swimmer, species: 'missing', mode: 'land' });
  p.draw(camera);
  assert.equal(p.shadows.count, 1, 'only the missing-model swimmer gets a hint; hidden and landed fish do not');

  p.deepShadows = 7;
  p.school.fish = Array.from({ length: 7 }, (_, i) => ({ ...swimmer, y: 0, ...deepFishPose(i, p.school.t, {}) }));
  p.draw(camera);
  assert.equal(p.deepShown, 0, 'no independent deep hint covers a coloured fish at the same place');
  assert.equal(p.shadows.count, 0);
  p.school.fish.length = 0; p.draw(camera);
  assert.equal(p.deepShown, 7); assert.equal(p.shadows.count, 7, 'deep hints return when the water above them is clear');
  for (const m of [body.mesh, p.shadows, p.spray, p.bubbleMesh, p.ringMesh]) { m.geometry.dispose(); m.material.dispose(); m.dispose(); }
});
