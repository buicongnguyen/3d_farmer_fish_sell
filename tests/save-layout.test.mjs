// Old saves in the ring world (src/save-layout.mjs, round 9 stage 1; spec 5 and Amendment A6): the pure migration and what parseSave does with it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateLayout, keepable, nearDen, KEEP, HOME_SPOT, LAYOUT } from '../src/save-layout.mjs';
import { inWorld, regionAt, DENS, QUARTER_ID } from '../src/regions.mjs';
import { inSafeZone } from '../src/ward.mjs';
import { freshState, parseSave } from '../src/game.mjs';

const old = (x, z, extra = {}) => ({ position: { x, z }, vehicles: undefined, riding: 'jeep', heading: 1.2, ...extra });
const same = (m, x, z) => m.position.x === x && m.position.z === z;
const homeDens = DENS.filter(d => QUARTER_ID.includes(d.region));

test('a round 8 position in the ward or the home ring (clear of every home den) is kept; any other goes to the inner ring on the same radial', () => {
  assert.equal(LAYOUT, 2); assert.equal(KEEP, 152);
  for (const [x, z] of [[12, 3], [0, -4], [-90, 60 - 140], [0, 128]]) { const m = migrateLayout(old(x, z)); assert.ok(same(m, x, z) === keepable(x, z), `(${x}, ${z})`); }
  const kept = migrateLayout(old(12, 3)); assert.deepEqual(kept.position, { x: 12, z: 3 }); assert.equal(kept.layout, 2); assert.equal(kept.layoutMoved, false); assert.equal(kept.riding, 'jeep');
  // The old forest centre is kept only when no home den is within clear + 24 m of it; the old jungle tip (-300, 40) is outside the new circle and goes to the ring on its radial.
  for (const [x, z] of [[-300, 40], [180, 20], [-128, -128], [-60, -190], [227, -185]]) {
    const m = migrateLayout(old(x, z)); assert.ok(!same(m, x, z), `(${x}, ${z}) moved`); const p = m.position;
    assert.ok(inSafeZone(p.x, p.z) || (inWorld(p.x, p.z, 2) && Math.hypot(p.x, p.z) < KEEP && !nearDen(p.x, p.z)), `(${x}, ${z}) -> (${p.x}, ${p.z}) is a place a player may wake`);
    assert.equal(m.riding, ''); assert.equal(m.heading, 0); assert.equal(m.layoutMoved, true);
    if (Math.hypot(p.x, p.z) > 100) assert.ok(Math.abs(Math.atan2(p.x * z - p.z * x, p.x * x + p.z * z)) < 45 * Math.PI / 180 + 1e-9, 'on (or near) the same radial');
  }
  // Garbage in: the homestead, no cars, the new layout.
  for (const bad of [{ position: { x: NaN, z: 1 } }, { position: null }, { position: { x: 'a', z: 2 } }, {}]) { const m = migrateLayout({ riding: 'jeep', heading: 2, ...bad }); assert.deepEqual(m.position, HOME_SPOT); assert.equal(m.riding, ''); assert.equal(m.layout, 2); }
});

test('vehicles: a spot that is keepable stays, any other is null (parked); idempotent; a layout 2 save is untouched', () => {
  const m = migrateLayout(old(-300, 40, { vehicles: { jeep: { x: -300, z: 40, rot: 1 }, bike: { x: 20, z: 5, rot: 0 } } }));
  assert.equal(m.vehicles.jeep, null); assert.deepEqual(m.vehicles.bike, { x: 20, z: 5, rot: 0 });
  const twice = migrateLayout({ ...m, layout: m.layout }); assert.deepEqual(twice.position, m.position); assert.equal(twice.layout, 2); assert.equal(twice.layoutMoved, m.layoutMoved);
  const fresh = { position: { x: 250, z: 0 }, vehicles: { jeep: { x: 250, z: 0, rot: 1 }, bike: null }, riding: 'jeep', heading: 2, layout: 2 };
  assert.deepEqual(migrateLayout(fresh), { position: { x: 250, z: 0 }, vehicles: fresh.vehicles, riding: 'jeep', heading: 2, layout: 2, layoutMoved: false });
  assert.equal(migrateLayout(old(5, 5, { vehicles: undefined })).vehicles, undefined, 'a save with no vehicles field keeps that, for the lost-car rule of parseSave');
});

test('corpus: every old position on a 4 m grid wakes in the ward or the home ring, inside the circle, clear of every home den', () => {
  let n = 0, kept = 0;
  for (let x = -330; x <= 330; x += 4) for (let z = -330; z <= 330; z += 4) {
    const m = migrateLayout(old(x, z, { vehicles: { jeep: { x, z, rot: 0 }, bike: null } })), p = m.position, r = regionAt(p.x, p.z); n++; if (same(m, x, z)) kept++;
    assert.ok(r === 'village' || QUARTER_ID.includes(r), `(${x}, ${z}) -> ${r}`); assert.ok(inWorld(p.x, p.z, 2));
    if (r !== 'village') for (const d of homeDens) assert.ok(Math.hypot(p.x - d.x, p.z - d.z) >= d.clear + 24 - 1e-9, `(${x}, ${z}) -> (${p.x}, ${p.z}) is ${Math.hypot(p.x - d.x, p.z - d.z).toFixed(1)} m from ${d.id}`);
    if (m.vehicles.jeep) assert.ok(keepable(m.vehicles.jeep.x, m.vehicles.jeep.z));
  }
  assert.ok(kept > 2000 && kept < 4000 && n > 20000, `${kept} of ${n} positions kept`);
});

test('parseSave runs the migration first and changes nothing else; a save the ring game wrote is never moved', () => {
  const base = JSON.parse(JSON.stringify(freshState())); delete base.layout; delete base.layoutMoved;
  base.coins = 321; base.defeated = { bear: true, treant: true }; base.cleared = [123, 127]; base.position = { x: -300, z: 40 }; base.riding = 'jeep'; base.stats.sales = 500; base.vehicles = { jeep: { x: -300, z: 40, rot: 1 }, bike: null };
  const s = parseSave(base);
  assert.equal(s.layout, 2); assert.equal(s.layoutMoved, true); assert.equal(s.riding, ''); assert.equal(s.heading, 0); assert.deepEqual(s.vehicles, { jeep: null, bike: null }); assert.ok(inWorld(s.position.x, s.position.z, 2) && !inSafeZone(s.position.x, s.position.z));
  assert.equal(s.coins, 321); assert.deepEqual(s.defeated, { bear: true, treant: true }); assert.deepEqual(s.cleared, [123, 127]);
  const ring = JSON.parse(JSON.stringify(s)); ring.position = { x: 250, z: 0 }; ring.layoutMoved = false; assert.deepEqual(parseSave(ring).position, { x: 250, z: 0 }, 'layout 2: kept wherever it is in the circle');
  assert.equal(parseSave(JSON.parse(JSON.stringify(freshState()))).layout, 2); assert.equal(freshState().layoutMoved, false);
});
