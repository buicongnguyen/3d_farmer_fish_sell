import test from 'node:test';
import assert from 'node:assert/strict';
import { updateVillagerShadow } from '../src/villager-shadows.mjs';

const person = () => {
  const parts = ['head', 'body', 'arm-left', 'arm-right', 'leg-left', 'leg-right'].map(name => ({ isMesh: true, parent: { name }, castShadow: true }));
  return { parts, traverse: fn => parts.forEach(fn) };
};
const casters = n => n.mesh.parts.filter(m => m.castShadow).map(m => m.parent.name);

test('late outfit meshes regain the head/body shadow policy even when the resident remains nearby', () => {
  const n = { mesh: person(), shadow: true };
  updateVillagerShadow(n, 5, false); assert.deepEqual(casters(n), ['head', 'body']);
  n.mesh = person(); updateVillagerShadow(n, 5, false); assert.deepEqual(casters(n), ['head', 'body']);
});

test('driving retains nearby shadows, drops distant detail and restores walking range with hysteresis', () => {
  const n = { mesh: person(), shadow: false };
  updateVillagerShadow(n, 27, false); assert.equal(n.shadow, true);
  updateVillagerShadow(n, 27, true); assert.deepEqual(casters(n), []);
  updateVillagerShadow(n, 18, true); assert.equal(n.shadow, false, 'approaching the outer band stays off');
  updateVillagerShadow(n, 13, true); assert.deepEqual(casters(n), ['head', 'body']);
  updateVillagerShadow(n, 18, true); assert.equal(n.shadow, true, 'leaving through the outer band stays on');
  updateVillagerShadow(n, 21, true); assert.equal(n.shadow, false);
  updateVillagerShadow(n, 27, false); assert.deepEqual(casters(n), ['head', 'body']);
});
