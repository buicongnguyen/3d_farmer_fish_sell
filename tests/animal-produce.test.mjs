import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { freshState, act, parseSave } from '../src/game.mjs';
import { ANIMAL_PRODUCT, AnimalProduce, produceReady } from '../src/animal-produce.mjs';
import { PEN_ROSTER, penShown } from '../src/pen-roam.mjs';
import { rigOf } from '../src/pen-view.mjs';

const bytes = readFileSync(new URL('../public/assets/models/animal-produce.glb', import.meta.url));
const { scene } = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');

test('the produce kit contains the four original Blender products within a small asset budget', () => {
  assert.deepEqual(scene.children.map(n => n.name), ['egg', 'milk', 'duck_egg', 'truffle']); assert.ok(bytes.length < 24000);
  const record = JSON.parse(readFileSync(new URL('../docs/asset-manifest.json', import.meta.url))).find(f => f.file === 'animal-produce.glb');
  assert.equal(record.bytes, bytes.length); assert.equal(record.sha256, createHash('sha256').update(bytes).digest('hex'));
  for (const node of scene.children) { let vertices = 0; node.traverse(m => { if (m.isMesh) vertices += m.geometry.getAttribute('position').count; }); assert.ok(vertices > 30); }
});

test('readiness follows feeding/collection/dawn and the pig gives one persisted truffle at level three', () => {
  for (let level = 0; level <= 3; level++) {
    const s = freshState(); s.upgrades.pen = level; assert.equal(produceReady(s), false);
    assert.equal(act(s, 'feed').ok, true); assert.equal(produceReady(s), true);
    assert.equal(act(s, 'collect').ok, true); assert.equal(produceReady(s), false);
    assert.equal(s.inventory.egg, level + 1); assert.equal(s.inventory.milk ?? 0, level < 2 ? 0 : level === 2 ? 1 : 2);
    assert.equal(s.inventory.truffle ?? 0, level === 3 ? 1 : 0); assert.equal(act(s, 'collect').ok, false);
    assert.equal(parseSave(structuredClone(s)).inventory.truffle ?? 0, level === 3 ? 1 : 0);
    act(s, 'sleep'); assert.equal(produceReady(s), false); act(s, 'feed'); assert.equal(produceReady(s), true);
  }
});

test('ready models follow shown animals, animate collection once and stop at dawn', async () => {
  const state = freshState(), kits = new Map(scene.children.map(n => ['animal-produce/' + n.name, { geometry: rigOf(n, '').parts[0].geometry }])); state.upgrades.pen = 3;
  const view = { world: { outside: new T.Group(), kits, location: 'village', loadKit: async () => true }, animals: PEN_ROSTER.map((spec, uid) => ({ spec, walker: { uid, x: uid * 3, z: 5 }, rig: { height: 1 }, size: 1, seed: uid, shown: penShown(spec, 3) })) };
  const products = new AnimalProduce(view); await Promise.resolve();
  products.update(.016, 1, state); assert.equal(products.diagnostics().shown, 0);
  act(state, 'feed'); products.update(.016, 2, state);
  const d = products.diagnostics(); assert.equal(d.loaded, true); assert.equal(d.shown, 5); assert.equal(d.draws, 4);
  assert.deepEqual(d.products.map(p => p.product), PEN_ROSTER.map(a => ANIMAL_PRODUCT[a.kind]));
  view.animals[0].walker.x = 99; products.update(.016, 3, state);
  const matrix = new T.Matrix4(); products.meshes.get('egg').getMatrixAt(0, matrix); assert.equal(matrix.elements[12], 99); assert.ok(matrix.elements[13] > 1.3);
  act(state, 'collect'); products.update(.016, 3.1, state); assert.equal(products.diagnostics().shown, 0); assert.equal(products.flights.length, 5);
  products.update(.7, 4, state); assert.equal(products.flights.length, 0); assert.equal(products.diagnostics().draws, 0);
  act(state, 'sleep'); act(state, 'feed'); products.update(.016, 5, state); act(state, 'sleep'); products.update(.016, 6, state);
  assert.equal(products.flights.length, 0, 'dawn does not pretend the previous day was collected');
  view.world.location = 'interior'; products.update(.016, 7, state); assert.equal(products.root.visible, false);
});
