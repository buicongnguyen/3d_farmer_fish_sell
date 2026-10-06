// The rooftop perch maths (roof-perches.mjs): spots sit on a gable's ridge line at its height, or on a flat roof, 1.2 m apart.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { gather, roofSpots } from '../src/roof-perches.mjs';

const mesh = quads => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(quads.flatMap(([a, b, c, d]) => [...a, ...b, ...c, ...a, ...c, ...d]), 3)); return new T.Mesh(g); };
test('a gable roof gives perches on its ridge, at the ridge height', () => {
  // An 8 x 6 m roof at (10, 20), ridge along x at 5 m (offset 0.07 m from the probe grid), eaves at 3 m.
  const rz = 20.07, roof = mesh([[[6, 3, 17], [14, 3, 17], [14, 5, rz], [6, 5, rz]], [[6, 5, rz], [14, 5, rz], [14, 3, 23], [6, 3, 23]]]);
  roof.rotation.y = 0; const box = { name: 'house', x: 10, z: 20, w: 8, d: 6, pad: 1 }, spots = roofSpots(box, gather([roof], [box])[0]);
  assert.ok(spots.length >= 3 && spots.length <= 6, `${spots.length} spots`);
  for (const s of spots) { assert.ok(Math.abs(s.y - 5) < .02, `on the ridge: y ${s.y}`); assert.ok(Math.abs(s.z - rz) < .03, `on the ridge line: z ${s.z}`); assert.equal(s.ax, 1); }
  for (const a of spots) for (const b of spots) if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= 1.2);
});
test('a flat roof gives perches on its top; ground and low parts give none', () => {
  const top = mesh([[[0, 6, 0], [10, 6, 0], [10, 6, 6], [0, 6, 6]]]), low = mesh([[[-3, 1, -3], [13, 1, -3], [13, 1, 9], [-3, 1, 9]]]);
  const box = { name: 'shop', x: 5, z: 3, w: 10, d: 6, pad: 1 }, spots = roofSpots(box, gather([top, low], [box])[0]);
  assert.ok(spots.length > 0); for (const s of spots) assert.ok(Math.abs(s.y - 6) < 1e-4 && s.x > 0 && s.x < 10 && s.z > 0 && s.z < 6);
  assert.equal(roofSpots(box, gather([low], [box])[0]).length, 0);
});
