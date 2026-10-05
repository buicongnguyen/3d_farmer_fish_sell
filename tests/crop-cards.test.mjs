// The centring and sizing maths of the crop cards (src/crop-cards.mjs): with the real crop models, every crop kind and stage
// stands on the middle of its bed (pivot within a centimetre of the footprint's centre, base on the soil) and is as tall as the reference's table says.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { fitModel, viewBasis, viewBounds, stageOf, stageHeight, popScale, modelOf, refitFactor, SHARE, BED_SIDE, CROP_MODEL } from '../src/crop-cards.mjs';
import { CROPS, BED_POSITIONS } from '../src/content.mjs';
import { CAMERA_YAW } from '../src/field-layout.mjs';

globalThis.self ??= globalThis;
const load = async file => { const b = fs.readFileSync(new URL('../public/assets/models/' + file, import.meta.url)); return new Promise((res, rej) => new GLTFLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '', res, rej)).then(g => g.scene); };
const scene = await load('crops.glb'), models = id => scene.getObjectByName('crop_' + id);

test('every crop kind has a model, the flowers use the reference flower models', () => {
  for (const id of Object.keys(CROPS)) assert.ok(models(modelOf(id)), `${id} -> crop_${modelOf(id)}`);
  assert.ok(models('sprout'));
  for (const f of ['tulip', 'sunflower', 'daisy']) assert.ok(CROP_MODEL[f]);
});

test('normalising puts the footprint centre on the pivot, the base on the soil and the picture one unit tall (every crop kind)', () => {
  for (const id of [...Object.keys(CROPS).map(modelOf), 'sprout']) {
    const fit = fitModel(models(id)), box = new T.Box3().setFromObject(fit.holder), c = box.getCenter(new T.Vector3());
    assert.ok(Math.abs(c.x) < .01 && Math.abs(c.z) < .01, `${id}: footprint centre off by ${c.x.toFixed(4)}, ${c.z.toFixed(4)} m`);
    assert.ok(Math.abs(box.min.y) < .01, `${id}: base ${box.min.y} m above the soil`);
    const b = fit.bounds; assert.ok(Math.abs(b.top - Math.min(0, b.bottom) - 1) < 1e-6, `${id}: picture is ${b.top - Math.min(0, b.bottom)} tall`);
  }
});

test('normalising ignores where the model started: a model far from its own origin, rotated or scaled, ends up the same', () => {
  const base = models('pumpkin'), odd = base.clone(true); odd.position.set(5, -2, 9); odd.scale.setScalar(3);
  const a = fitModel(base), b = fitModel(odd);
  assert.ok(Math.abs(a.bounds.left - b.bounds.left) < 1e-6 && Math.abs(a.bounds.top - b.bounds.top) < 1e-6);
  const holder = new T.Group(), part = new T.Mesh(new T.BoxGeometry(1, 2, 1), new T.MeshBasicMaterial()); part.position.set(40, 30, -20); holder.add(part);
  const fit = fitModel(holder), box = new T.Box3().setFromObject(fit.holder), c = box.getCenter(new T.Vector3());
  assert.ok(Math.abs(c.x) < .01 && Math.abs(c.z) < .01 && Math.abs(box.min.y) < .01);
});

test('the stage table is Zoo Garden\'s: sprout under half grown, young from half, ripe at full, with .22 / .34 / .78 of the bed side', () => {
  assert.deepEqual(SHARE, { sprout: .22, young: .34, ripe: .78 });
  assert.equal(stageOf(false, 0), 'sprout'); assert.equal(stageOf(true, .49), 'sprout'); assert.equal(stageOf(true, .5), 'young'); assert.equal(stageOf(true, .99), 'young'); assert.equal(stageOf(true, 1), 'ripe');
  assert.equal(stageOf(false, 1), 'sprout', 'an unwatered seed never grows');
  assert.ok(Math.abs(stageHeight('ripe') - .78 * BED_SIDE) < 1e-9);
  // Zoo's own ratios: STAGE_SCALE young .55 : ripe 1.25 = .44 (here .34 / .78 = .436), sprout fitted at .256 of ripe (here .22 / .78 = .28).
  assert.ok(Math.abs(SHARE.young / SHARE.ripe - .55 / 1.25) < .01);
  assert.ok(Math.abs(SHARE.sprout / SHARE.ripe - .32 / 1.25 / .9) < .06);
});

test('the pop on a stage change starts small, overshoots, and settles at 1', () => {
  assert.ok(Math.abs(popScale(0) - .35) < 1e-9); assert.equal(popScale(1), 1); assert.equal(popScale(3), 1);
  let max = 0; for (let t = 0; t <= 1; t += .02) max = Math.max(max, popScale(t)); assert.ok(max > 1.02 && max < 1.2);
});

test('ripe crops of neighbouring beds (beside, behind, diagonal; any two kinds) do not overlap on the screen: the bed spacing stays as it was', () => {
  const basis = viewBasis(), screen = p => ({ x: p.x * basis.right.x + p.z * basis.right.z, y: p.x * basis.up.x + p.z * basis.up.z }), h = stageHeight('ripe');
  const boxes = Object.keys(CROPS).map(modelOf).map(id => { const b = fitModel(models(id)).bounds; return { id, l: b.left * h, r: b.right * h, t: b.top * h, b: b.bottom * h }; });
  assert.ok(Math.abs(BED_POSITIONS[1].x - BED_POSITIONS[0].x - 2.6) < 1e-9 && Math.abs(BED_POSITIONS[6].z - BED_POSITIONS[0].z - 2.7) < 1e-9, 'bed spacing unchanged');
  let worst = 0, who = "";
  for (const [i, j] of [[0, 1], [0, 6], [0, 7], [1, 6]]) {
    const a = screen(BED_POSITIONS[i]), c = screen(BED_POSITIONS[j]), dx = c.x - a.x, dy = c.y - a.y;
    for (const A of boxes) for (const B of boxes) {
      const w = Math.min(A.r, B.r + dx) - Math.max(A.l, B.l + dx), v = Math.min(A.t, B.t + dy) - Math.max(A.b, B.b + dy);
      if (w > 0 && v > 0) { const f = w * v / Math.min((A.r - A.l) * (A.t - A.b), (B.r - B.l) * (B.t - B.b)); if (f > worst) { worst = f; who = `${A.id} at bed ${i} / ${B.id} at bed ${j}`; } }
    }
  }
  console.log(`widest neighbouring overlap of the pictures' boxes: ${(worst * 100).toFixed(1)}% (${who})`); assert.ok(worst < .2, `neighbouring ripe pictures overlap by ${(worst * 100).toFixed(1)}% of the smaller (${who})`);
});

test('every fruit tree kind stands on its spot: the trunk base (lowest vertices) is on the ring centre and the collider, whatever the turn of the tree, even when the canopy leans (grove-view pivotOf)', async () => {
  const { pivotOf } = await import('../src/grove-view.mjs'), fruit = await load('fruit_crops.glb');
  for (const id of ['apple', 'peach', 'mango', 'grape', 'pineapple', 'coconut', 'lychee', 'durian']) {
    const src = fruit.getObjectByName('crop_' + id); assert.ok(src, id); src.updateWorldMatrix(true, true);
    const pts = []; src.traverse(m => { const p = m.isMesh && m.geometry.getAttribute('position'); if (p) for (let i = 0; i < p.count; i++) pts.push(new T.Vector3().fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld)); });
    const lo = Math.min(...pts.map(p => p.y)), hi = Math.max(...pts.map(p => p.y)), base = pts.filter(p => p.y <= lo + .05 * (hi - lo));
    const pivot = pivotOf(src);
    for (const turn of [0, 1.1, 2.399, 5.2]) for (const scale of [.5, 1.3]) {
      const m = new T.Matrix4().compose(new T.Vector3(10, 0, -4), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), turn), new T.Vector3(scale, scale, scale)).multiply(pivot);
      const c = base.map(p => p.clone().applyMatrix4(m)).reduce((a, p) => a.add(p), new T.Vector3()).multiplyScalar(1 / base.length), low = Math.min(...pts.map(p => p.clone().applyMatrix4(m).y));
      assert.ok(Math.hypot(c.x - 10, c.z + 4) < .01, `${id}: trunk base ${(Math.hypot(c.x - 10, c.z + 4) * 100).toFixed(1)} cm off its spot at turn ${turn}`);
      assert.ok(Math.abs(low) < .01, `${id}: base ${low} m above the ground`);
    }
  }
});

test('refitFactor: a thin or pale model whose picture is short is scaled up to fill its share, never past the cell', () => {
  assert.equal(refitFactor(1), 1); assert.equal(refitFactor(.9), 1); assert.ok(Math.abs(refitFactor(.78) - 1 / .78) < 1e-9); assert.equal(refitFactor(.3), 1.35);
});
