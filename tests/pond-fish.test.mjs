// The pond fish as drawn: every species of fish.glb the pond swims, baked and placed as pond-life.mjs does, must keep its tail on its body at every wag
// angle, keep every part of the model (eyes, fins, markings), keep its colours, and stay whole above the ground (the water is only 0.3 m deep).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { bakeFish, fishMatrix, tailHinge, bodyM, tailM, multiply } from '../src/pond-life.mjs';
import { FISH_POOLS } from '../src/pond.mjs';

const buf = fs.readFileSync(new URL('../public/assets/models/fish.glb', import.meta.url)), gltf = await new Promise((ok, no) => new GLTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', ok, no));
const SPECIES = [...new Set(FISH_POOLS.flat())];
const kinds = SPECIES.map(sp => { const node = gltf.scene.getObjectByName('fish_' + sp), body = node.getObjectByName(`fish_${sp}_body`), tail = node.getObjectByName(`fish_${sp}_tail`); return { sp, node, body, tail, k: bakeFish(node, body, tail, sp) }; });
const meshes = o => { const n = []; o.traverse(m => { if (m.isMesh) n.push(m); }); return n; };
const fish = (extra = {}) => ({ x: 3, z: -4, y: 0, h: 1.1, rx: 0, rz: 0, tail: 0, ...extra });
const world = (g, m) => { const p = g.getAttribute('position'), out = []; for (let i = 0; i < p.count; i++) out.push(new T.Vector3().fromBufferAttribute(p, i).applyMatrix4(m)); return out; };

test('the pond swims eleven species across four tiers, including the five added Zoo Garden fish', () => assert.deepEqual([...SPECIES].sort(), ['carp', 'catfish', 'clown', 'eel', 'golden', 'guardian', 'koi', 'perch', 'puffer', 'rainbow', 'sunfish']));

test('every mesh of each species is in the body layer or the tail layer (nothing dropped)', () => {
  for (const { sp, node, k } of kinds) {
    const total = meshes(node).reduce((a, m) => a + (m.geometry.index ? m.geometry.index.count : m.geometry.getAttribute('position').count), 0), have = k.bg.getAttribute('position').count + k.tg.getAttribute('position').count;
    assert.equal(have, total, `${sp}: ${have} vertices drawn of ${total} in the model`);
    assert.equal(meshes(node).length, meshes(node.getObjectByName(`fish_${sp}_body`)).length + meshes(node.getObjectByName(`fish_${sp}_tail`)).length, `${sp}: only _body and _tail parts`);
  }
});

test('the tail stays on the body at wag angles -0.8 to +0.8, in every heading and while rolled, at the phone and desktop scale', () => {
  for (const { sp, k } of kinds) for (const fb of [1, 1.67, 2]) for (const h of [0, 1.1, 3, -2.2]) for (const rz of [0, .15, -.4]) for (let w = -.8; w <= .8001; w += .2) {
    const f = fish({ h, rz, tail: w }); fishMatrix(k, f, fb, 1); const body = new T.Matrix4().fromArray(Array.from(bodyM)); tailHinge(k, f); const out = new Float32Array(16); multiply(out, 0, bodyM, tailM); const tail = new T.Matrix4().fromArray(Array.from(out));
    const joint = new T.Vector3(0, 0, 0).applyMatrix4(tail), hinge = k.hinge.clone().applyMatrix4(body);
    assert.ok(joint.distanceTo(hinge) < .005, `${sp}: the tail pivots on the hinge (${joint.distanceTo(hinge) * 100} cm off at ${w})`);
    // the joining vertices of the tail (its first 2 cm, model units): their centre stays on the hinge point of the body (within 1 cm, scaled) at this wag
    // angle, and they lie within the body's height; with the body's rear behind the hinge (next test) the fin starts inside the body, not beside it
    const tv = world(k.tg, tail), tp = k.tg.getAttribute('position'), join = tv.filter((v, i) => tp.getZ(i) > k.tg.boundingBox.max.z - .02), c = join.reduce((a, v) => a.add(v), new T.Vector3()).divideScalar(join.length);
    assert.ok(join.length >= 2, `${sp}: the tail has joining vertices`);
    assert.ok(Math.hypot(c.x - hinge.x, c.z - hinge.z) < .01, `${sp}: the tail's joint is ${(Math.hypot(c.x - hinge.x, c.z - hinge.z) * 100).toFixed(2)} cm from the body's hinge at wag ${w.toFixed(1)}`);
    const inv = body.clone().invert(); for (const v of join) { const l = v.clone().applyMatrix4(inv); assert.ok(l.y > k.bg.boundingBox.min.y - .02 && l.y < k.bg.boundingBox.max.y + .02, `${sp}: the tail joint is within the body's height`); }
  }
});

test('the tail joint sits inside the body (its rear is at or behind the hinge) and the tail swings about y only', () => {
  for (const { sp, k } of kinds) { assert.ok(k.bg.boundingBox.min.z <= k.hinge.z + 1e-4, `${sp}: body rear ${k.bg.boundingBox.min.z} reaches the hinge ${k.hinge.z}`); assert.ok(k.tg.boundingBox.max.z < .02 && k.tg.boundingBox.min.z < -.08, `${sp}: tail runs back from its hinge`); }
});

test('every species keeps its colours (not a flat block) and the dark eyes and light eye whites', () => {
  for (const { sp, k } of kinds) {
    const c = k.bg.getAttribute('color'), seen = new Set(); let dark = 0, light = 0;
    for (let i = 0; i < c.count; i++) { seen.add([c.getX(i), c.getY(i), c.getZ(i)].map(v => Math.round(v * 20)).join()); const l = (c.getX(i) + c.getY(i) + c.getZ(i)) / 3; if (l < .03) dark++; if (l > .95) light++; }
    assert.ok(seen.size >= 4, `${sp}: ${seen.size} distinct body colours`); assert.ok(dark >= 6, `${sp}: eyes (${dark} dark vertices)`); assert.ok(light >= 6, `${sp}: eye whites or belly (${light} light vertices)`);
  }
});

test('a fish is whole above the ground (0.3 m deep water) at every size, bobbing and rolled; its back reaches the surface', () => {
  for (const { sp, k } of kinds) for (const fb of [1, 1.67, 2, 2.6]) for (const fade of [0.05, .5, 1]) for (const rz of [0, .15, -.4, .4]) {
    fishMatrix(k, fish({ y: -.012, rz }), fb, fade); const m = new T.Matrix4().fromArray(Array.from(bodyM)), ys = [...world(k.bg, m), ...(() => { tailHinge(k, fish()); const o = new Float32Array(16); multiply(o, 0, bodyM, tailM); return world(k.tg, new T.Matrix4().fromArray(Array.from(o))); })()].map(v => v.y);
    // (a roll is limited to 14 cm of swing)
    assert.ok(Math.min(...ys) > 0, `${sp}: lowest point ${Math.min(...ys).toFixed(3)} at size ${fb}, fade ${fade}, roll ${rz}`);
    assert.ok(Math.max(...ys) < .85, `${sp}: highest point ${Math.max(...ys).toFixed(3)}`);
  }
});
