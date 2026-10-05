import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { WORKSHOP, FIELD_LANE, HOUSES, BED_POSITIONS } from '../src/content.mjs';
import { BLOCKS, blockedAt } from '../src/village-plan.mjs';
import { onLotPath } from '../src/lots.mjs';

test('Vale workshop fits left of the well without blocking the home, garden or Field Lane', () => {
  const b = WORKSHOP.building, well = BLOCKS.find(b => b.name === 'well');
  assert.ok(b.x + b.w / 2 + 1 < well.x - well.w / 2); assert.ok(well.x < HOUSES[0].x);
  assert.ok(Math.abs(b.z - well.z) < 1); assert.equal(blockedAt(WORKSHOP.x, WORKSHOP.z), false);
  for (const other of BLOCKS) if (other.name !== 'workshop') assert.ok(Math.abs(b.x - other.x) >= (b.w + other.w) / 2 + .8 || Math.abs(b.z - other.z) >= (b.d + other.d) / 2 + .8, other.name + ' has clearance');
  for (const p of BED_POSITIONS) assert.ok(Math.abs(b.x - p.x) > b.w / 2 + 1.1 || Math.abs(b.z - p.z) > b.d / 2 + 1.2);
  for (let z = WORKSHOP.z; z <= FIELD_LANE.z; z += .1) { assert.equal(blockedAt(WORKSHOP.x, z), false); assert.equal(onLotPath(WORKSHOP.x, z, .01), true); }
  assert.ok(FIELD_LANE.z - WORKSHOP.z > WORKSHOP.r, 'walking the lane does not trigger the counter');
  assert.deepEqual([HOUSES[7].id, HOUSES[7].x, HOUSES[7].z], [7, -41, 20], 'the residence and its save id stay in place');
});

test('the reused Blender workshop fits its collision footprint and asset manifest', async () => {
  const bytes = readFileSync(new URL('../public/assets/models/workshop.glb', import.meta.url));
  const { scene } = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  scene.scale.setScalar(WORKSHOP.building.scale); const box = new T.Box3().setFromObject(scene), b = WORKSHOP.building;
  assert.ok(box.min.x >= -b.w / 2 && box.max.x <= b.w / 2 && box.min.z >= -b.d / 2 && box.max.z <= b.d / 2);
  assert.ok(box.max.y > 3 && box.max.y < 4);
  const entry = JSON.parse(readFileSync(new URL('../docs/asset-manifest.json', import.meta.url))).find(f => f.file === 'workshop.glb');
  assert.equal(bytes.length, entry.bytes); assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
});
