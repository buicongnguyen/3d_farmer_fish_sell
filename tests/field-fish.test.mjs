import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { FieldFish, FIELD_FISH } from '../src/field-fish.mjs';
import { FEATURES } from '../src/land-features.mjs';

// Exercise the renderer's real school/update logic without a browser canvas or GPU.
function fixture(region = 'west', models = true) {
  const pond = FEATURES[region].ponds[0], fish = new T.Group();
  if (models) for (const species of FIELD_FISH[region]) {
    const node = new T.Group(), body = new T.Mesh(new T.BoxGeometry(.3, .2, 1), new T.MeshBasicMaterial());
    node.name = 'fish_' + species; body.name = node.name + '_body'; node.add(body); fish.add(node);
  }
  const world = { player: { position: { x: pond.x + pond.r + 1, z: pond.z } }, location: 'village',
    state: { settings: { quality: 'high' } }, raw: new Map([['fish', fish]]), paused: false };
  const view = Object.assign(Object.create(FieldFish.prototype), { world, root: new T.Group(),
    material: new T.MeshBasicMaterial({ vertexColors: true }), schools: new Map(), kinds: new Map(),
    frame: 0, active: [], holes: [], ctx: { player: null }, shown: 0,
    shadows: new T.InstancedMesh(new T.PlaneGeometry(), new T.MeshBasicMaterial(), 54) });
  view.shadows.count = 0;
  return { world, view, pond };
}
globalThis.innerWidth = 1200;
globalThis.innerHeight = 900;

test('outdoor ponds retain a moving hint for every fish when phone quality reduces the detailed bodies', () => {
  const { world, view } = fixture(); view.update(0);
  assert.equal(view.shown, 6); assert.equal(view.shadows.count, 6); assert.equal(view.diagnostics().draws, 4);
  const buffer = view.shadows.instanceMatrix.array, school = [...view.schools.values()][0].school;
  const before = school.fish.map(f => [f.x, f.z]);
  world.state.settings.quality = 'battery'; view.update(.05);
  assert.equal(view.shown, 3); assert.equal(view.diagnostics().hints, 6); assert.equal(view.diagnostics().draws, 4);
  assert.equal(view.shadows.instanceMatrix.array, buffer, 'quality changes reuse the fixed GPU buffer');
  assert.ok(school.fish.some((f, i) => f.x !== before[i][0] || f.z !== before[i][1]));
  school.fish.forEach((f, i) => {
    assert.ok(Math.abs(buffer[i * 16 + 12] - f.x) < .0001);
    assert.ok(Math.abs(buffer[i * 16 + 14] - f.z) < .0001);
    assert.ok(Math.abs(buffer[i * 16 + 13] - .034) < .000001, 'hints sit above outdoor water');
  });
});

test('outdoor hints pause with the school and clear indoors or away from ponds', () => {
  const { world, view } = fixture(); view.update(.05);
  const buffer = Array.from(view.shadows.instanceMatrix.array); world.paused = true; view.update(1);
  assert.deepEqual(Array.from(view.shadows.instanceMatrix.array), buffer);
  world.location = 'home'; view.update(.05);
  assert.equal(view.root.visible, false); assert.equal(view.shadows.count, 0); assert.equal(view.diagnostics().draws, 0);
  world.location = 'village'; view.update(.05); assert.equal(view.shadows.count, 6);
  world.player.position = { x: 0, z: 0 }; view.update(.05);
  assert.equal(view.shadows.visible, false); assert.equal(view.shadows.count, 0);
});

test('missing detailed fish models still leave all six silhouettes', () => {
  const { view } = fixture('west', false); view.update(.05);
  assert.equal(view.shown, 0); assert.equal(view.shadows.count, 6); assert.equal(view.diagnostics().draws, 1);
});

test('Night Land reveals hints for the full school on phone quality', () => {
  const { world, view } = fixture('shadow'); world.state.settings.quality = 'battery'; view.update(.05);
  assert.equal(view.shown, 3); assert.equal(view.shadows.count, 6); assert.equal(view.holes.length, 6);
  const school = [...view.schools.values()][0].school;
  school.fish.forEach((f, i) => assert.deepEqual(view.holes[i], { x: f.x, z: f.z, r: 1.5 }));
});
