// The pen animals, drawn like Zoo Garden's (cute_game src/farm-view.ts): the same farm.glb models, split into the same
// rigid parts at the same hinges (rigOf: body with a bird's wings and tail, head, a quadruped's tail, each leg), the
// same breed coats (COATS: coat colour, second colour, fleck share, with the fleck pattern hashed from the part's own
// coordinates) and the same motion (pen-roam.mjs with the reference's poses: a walk with swinging legs and a little
// bob, pecking, grazing with a slow chew, sitting, a dust bath, a flap, tails that swish).
//
// One thing is done differently, for cost. The reference draws one InstancedMesh per kind and part, which pays off for
// its herds of ten. Willowmere's pen holds five animals of four kinds: per kind and part that is 14 draws and 4 more
// in the shadow pass, against 5 + 5 for the static models this replaces. So the whole flock is ONE mesh: every part's
// vertices carry the number of the part's bone (rigid skinning, one bone a vertex), the breed colours are baked into
// the vertex colours, and each frame only the bones' matrices are written. One draw and one shadow draw for the pen,
// whatever the pen level; three.js skins the shadow pass too. Nothing is allocated per frame.
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon, depthFor } from './toon.mjs';
import { PEN, PEN_PROPS, PEN_ROSTER, penShown, penArea, newRoamer, spawnSpot, stepRoamer, callToTrough } from './pen-roam.mjs';
import { hyp } from './hyp.mjs';

const PART_NAME = /_(body|head|wing_[lr]|leg_[lr]|leg_[fb][lr]|tail)(?:_\d+)?$/;
/** Drawn larger than life so they read from the village camera (30 px to the metre): about the sizes of the old models. */
export const SHOWN = { chicken: 1.6, duck: 1.3, cow: 1.1, pig: 1.1 };
/** Breed coats (the reference's table): [coat, second colour, fleck share]. */
export const COATS = {
  chicken: [['#fffcf2', '#fffcf2', 0], ['#b8592b', '#7e3418', .18], ['#2a2a30', '#2f6b4f', .3], ['#ece6da', '#4a4646', .34], ['#efb85f', '#d4913a', .12]],
  cow: [['#fffaf0', '#3b3440', 0], ['#b97a42', '#8a5630', 0], ['#fffaf0', '#a03a24', 0], ['#2f2b32', '#222026', 0], ['#cc6a2a', '#b0561e', 0]],
  duck: [['#fffaf0', '#d6e4d5', 0], ['#356d50', '#a87a49', .2], ['#b39168', '#72583c', .1]],
  pig: [['#ffb4c0', '#e58f9d', 0], ['#ffb4c0', '#694d4a', .25], ['#ba794d', '#845035', .1]],
};
/** Which materials are coat (1) or patch (2), and the colour their shading is measured against. */
const COAT_PARTS = {
  chicken: { 'Farm feather': [1, '#fffcf2'] }, cow: { 'Farm cow': [1, '#fffaf0'], 'Farm cow patch': [2, '#3b3440'] }, duck: { 'Farm duck': [1, '#fffaf0'] }, pig: { 'Farm pig': [1, '#ffb4c0'] },
};
const fract = v => v - Math.floor(v);
/** The reference's fleck pattern (its vertex shader): a hash of the part-local position in 1/24 m cells. */
const fleck = (x, y, z) => fract(Math.sin(Math.floor(x * 24) * 12.9898 + Math.floor(y * 24) * 78.233 + Math.floor(z * 24) * 37.719) * 43758.5453);
const floats = a => { const out = new Float32Array(a.count * 3); for (let i = 0; i < a.count; i++) { out[i * 3] = a.getX(i); out[i * 3 + 1] = a.getY(i); out[i * 3 + 2] = a.getZ(i); } return new T.BufferAttribute(out, 3); };

/**
 * Splits a farm.glb animal into what moves, as the reference's rigOf does: {parts: [{draw, pivot, sign, geometry}], height}.
 * `draw` is 'body' | 'head' | 'tail' | 'leg'; each geometry is in its hinge's space, with the breed's colours in its vertices.
 */
export function rigOf(root, kind, coat = 0) {
  root.updateMatrixWorld(true);
  const toRoot = root.matrixWorld.clone().invert(), found = new Map(), coats = COAT_PARTS[kind] ?? {}, breed = (COATS[kind] ?? [])[coat] ?? (COATS[kind] ?? [])[0];
  const a = breed ? new T.Color(breed[0]) : null, b = breed ? new T.Color(breed[1]) : null, share = breed ? breed[2] : 0;
  let height = 0;
  root.traverse(o => {
    if (!o.isMesh || Array.isArray(o.material)) return;
    let named = o; while (named && named !== root && !PART_NAME.test(named.name)) named = named.parent;
    const own = !!named && named !== root, role = own ? PART_NAME.exec(named.name)[1] : 'body';
    const pivot = own ? new T.Vector3().setFromMatrixPosition(toRoot.clone().multiply(named.matrixWorld)) : new T.Vector3();
    let g = new T.BufferGeometry(); g.setAttribute('position', floats(o.geometry.getAttribute('position')));
    const normal = o.geometry.getAttribute('normal'); if (normal) g.setAttribute('normal', floats(normal));
    if (o.geometry.index) g.setIndex(o.geometry.index.clone());
    g = g.index ? g.toNonIndexed() : g; g.applyMatrix4(toRoot.clone().multiply(o.matrixWorld)); if (!normal) g.computeVertexNormals();
    g.computeBoundingBox(); height = Math.max(height, g.boundingBox.max.y);
    const color = o.material.color ?? new T.Color('#ffffff'), mark = coats[o.material.name], n = g.getAttribute('position').count, colors = new Float32Array(n * 3);
    // A coat part keeps only its shade (against the model's own coat colour); the breed gives the colour.
    const base = mark ? new T.Color(mark[1]) : null, shade = mark ? Math.min(1.2, Math.max(.5, (color.r + color.g + color.b) / Math.max(1e-3, base.r + base.g + base.b))) : 1;
    for (let i = 0; i < n; i++) colors.set([color.r, color.g, color.b], i * 3);
    g.setAttribute('color', new T.BufferAttribute(colors, 3));
    const entry = found.get(role) ?? { list: [], pivot }; entry.list.push({ g, mask: mark && breed ? mark[0] : 0, shade }); found.set(role, entry);
  });
  const quadruped = [...found.keys()].some(r => r.startsWith('leg_f'));
  const drawOf = r => r === 'head' ? 'head' : r.startsWith('leg_') ? 'leg' : r === 'tail' && quadruped ? 'tail' : 'body';
  const parts = [];
  const add = (draw, roles, pivot, sign = 1) => {
    const list = [];
    for (const r of roles) for (const piece of found.get(r).list) {
      const g = piece.g; g.translate(-pivot.x, -pivot.y, -pivot.z);
      if (piece.mask) { const p = g.getAttribute('position'), c = g.getAttribute('color'); for (let i = 0; i < p.count; i++) { const tint = piece.mask === 2 || fleck(p.getX(i), p.getY(i), p.getZ(i)) < share ? b : a; c.setXYZ(i, piece.shade * tint.r, piece.shade * tint.g, piece.shade * tint.b); } }
      list.push(g);
    }
    const geometry = list.length > 1 ? mergeGeometries(list, false) : list[0]; if (list.length > 1) list.forEach(g => g.dispose());
    parts.push({ draw, pivot, sign, geometry });
  };
  const roles = [...found.keys()], body = roles.filter(r => drawOf(r) === 'body');
  if (body.length) add('body', body, found.get(body.includes('body') ? 'body' : body[0]).pivot);
  for (const draw of ['head', 'tail']) { const list = roles.filter(r => drawOf(r) === draw); if (list.length) add(draw, list, found.get(list[0]).pivot); }
  for (const r of roles.filter(r => drawOf(r) === 'leg')) add('leg', [r], found.get(r).pivot, r === 'leg_l' || r === 'leg_fl' || r === 'leg_br' ? 1 : -1);
  return { parts, height };
}

export class PenView {
  /** @param world the World (its farm.glb is world.raw 'farm'); state() gives the game state (upgrades.pen, fedDay). */
  constructor(world, state) {
    this.world = world; this.state = state; this.area = penArea(); this.mesh = null; this.bones = []; this.animals = []; this.time = 0; this.fed = null; this.level = -1;
    let seed = 20261003; this.rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    this.m = new T.Matrix4(); this.root = new T.Matrix4(); this.local = new T.Matrix4(); this.q = new T.Quaternion(); this.e = new T.Euler(); this.v = new T.Vector3(); this.s = new T.Vector3(); this.one = new T.Vector3(1, 1, 1); this.zero = new T.Matrix4().makeScale(0, 0, 0);
    this.player = { x: 0, z: 0 }; this.range = null; this.mod = null; this.people = []; this.spots = []; this.frame = 0; this.anyOut = false;
    this.build();
  }
  build() {
    const farm = this.world.raw.get('farm'); if (!farm) return;
    const pieces = [], rosterWalkers = [];
    for (const [uid, spec] of PEN_ROSTER.entries()) {
      const node = farm.getObjectByName(spec.kind); if (!node) continue;
      const source = node.clone(true); source.position.set(0, 0, 0); source.rotation.set(0, 0, 0); source.scale.setScalar(1);
      const rig = rigOf(source, spec.kind, spec.coat), first = this.bones.length, walker = newRoamer(uid, spec.kind, { x: 0, z: 0 }, this.rng);
      Object.assign(walker, spawnSpot(this.area, this.rng, walker, rosterWalkers)); walker.goalX = walker.x; walker.goalZ = walker.z; rosterWalkers.push(walker);
      for (const part of rig.parts) {
        const index = this.bones.length, n = part.geometry.getAttribute('position').count, skin = new Uint16Array(n * 4), weight = new Float32Array(n * 4);
        for (let i = 0; i < n; i++) { skin[i * 4] = index; weight[i * 4] = 1; }
        part.geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(skin, 4)); part.geometry.setAttribute('skinWeight', new T.Float32BufferAttribute(weight, 4));
        pieces.push(part.geometry);
        const bone = new T.Bone(); bone.matrixAutoUpdate = false; bone.matrixWorldAutoUpdate = false; this.bones.push(bone);
      }
      this.animals.push({ spec, walker, rig, first, size: SHOWN[spec.kind] * (.95 + this.rng() * .1), seed: this.rng() * 10, shown: false });
    }
    if (!pieces.length) return;
    const geometry = mergeGeometries(pieces, false); pieces.forEach(g => g.dispose());
    const mesh = this.mesh = new T.SkinnedMesh(geometry, toon({ vertexColors: true })); mesh.name = 'pen-animals';
    mesh.bind(new T.Skeleton(this.bones, this.bones.map(() => new T.Matrix4())), new T.Matrix4());
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.raycast = () => {}; depthFor(mesh);
    // The flock never leaves the yard: a fixed sphere round it serves the view's and the shadow's culling.
    mesh.boundingSphere = new T.Sphere(new T.Vector3((PEN.x0 + PEN.x1) / 2, 1, (PEN.z0 + PEN.z1) / 2), hyp(PEN.x1 - PEN.x0, PEN.z1 - PEN.z0) / 2 + 2);
    mesh.boundingBox = new T.Box3(new T.Vector3(PEN.x0 - 1, 0, PEN.z0 - 1), new T.Vector3(PEN.x1 + 1, 3, PEN.z1 + 1));
    this.world.outside.add(mesh);
    this.walkers = rosterWalkers; this.triangles = geometry.getAttribute('position').count / 3;
    this.load();
  }
  /** After the first frame: the roaming range (pen-range.mjs, a chunk of its own: the range, the day's routine, the animals' tap targets) is made and takes over. */
  load() { import('./pen-range.mjs').then(m => m.attachRange(this, m)); }
  /** Every frame: who is shown for the pen level, feeding time, the roam step, the bones. */
  update(dt, time) {
    const mesh = this.mesh, w = this.world; if (!mesh) return;
    const s = this.state(), level = s.upgrades?.pen ?? 0;
    if (level !== this.level) { this.level = level; for (const a of this.animals) { a.shown = penShown(a.spec, level); a.walker.hidden = !a.shown; } }
    if (this.fed === null) this.fed = s.fedDay; else if (s.fedDay !== this.fed) { this.fed = s.fedDay; if (s.fedDay === s.day) { if (this.mod) this.mod.callFed(this.walkers, this.range, this.rng); else callToTrough(this.walkers, this.area, this.rng); } }
    if (w.location !== 'village') return;
    const p = w.player.position, near = !w.riding && p.x > PEN.x0 - 3 && p.x < PEN.x1 + 3 && p.z > PEN.z0 - 3 && p.z < PEN.z1 + 3; this.player.x = p.x; this.player.z = p.z;
    // Far from the view nothing is posed: the mesh is culled by its sphere anyway, and the yard keeps no secrets.
    if (Math.abs(w.follow.x - mesh.boundingSphere.center.x) > 90 || Math.abs(w.follow.z - mesh.boundingSphere.center.z) > 90) return;
    if (dt > 0 && this.mod) this.mod.tickRoam(this, dt, s, p);
    else if (dt > 0) for (let i = 0; i < this.animals.length; i++) { const a = this.animals[i]; if (a.shown) stepRoamer(a.walker, this.walkers, this.area, this.rng, dt, near ? this.player : null); }
    for (let i = 0; i < this.animals.length; i++) this.pose(this.animals[i], time);
  }
  /** One animal's bones, with the reference's poses. */
  pose(a, time) {
    const w = a.walker, parts = a.rig.parts, bones = this.bones;
    if (!a.shown) { for (let k = 0; k < parts.length; k++) bones[a.first + k].matrixWorld.copy(this.zero); return; }
    const cow = w.kind === 'cow', quad = cow || w.kind === 'pig', moving = w.speed > .05, scale = a.size;
    // Hens hop a little as they walk; a sitting or dust-bathing bird settles onto the ground (and wobbles in the dust).
    const bob = moving ? Math.abs(Math.sin(w.phase)) * (quad ? .03 : .05) : 0, settle = quad ? -w.sit * .06 * scale : -w.sit * .13 * scale, dust = w.rest === 'dust' ? Math.sin(time * 13 + a.seed) * .18 * w.sit : 0;
    this.root.compose(this.v.set(w.x, bob + settle, w.z), this.q.setFromEuler(this.e.set(0, w.heading, dust)), this.s.setScalar(scale));
    const swing = moving ? Math.sin(w.phase) * (quad ? .45 : .7) * Math.min(1, w.speed / .3) : 0;
    for (let k = 0; k < parts.length; k++) {
      const part = parts[k], at = part.pivot; let rx = 0, ry = 0, rz = 0;
      // Grazing: head down to the grass with a slow chew; pecking: a quick dip.
      if (part.draw === 'head') { rx = Math.max(w.peck * .9, w.graze * (cow ? .75 : .6)) + w.graze * Math.sin(time * 6 + a.seed) * .06 + Math.sin(time * 2 + a.seed) * .05; ry = Math.sin(time * .7 + a.seed) * .15 * (1 - w.graze * .6); }
      else if (part.draw === 'leg') rx = part.sign * swing * (1 - w.sit);
      else if (part.draw === 'tail') ry = Math.sin(time * 3 + a.seed) * .35;
      else rz = moving ? Math.sin(w.phase) * .04 : 0;
      this.local.compose(this.v.set(at.x, at.y + (part.draw === 'leg' ? 0 : w.flap * .08), at.z), this.q.setFromEuler(this.e.set(rx, ry, rz)), this.one);
      bones[a.first + k].matrixWorld.multiplyMatrices(this.root, this.local);
    }
  }
  diagnostics() {
    return { skinned: true, draws: this.mesh ? 1 : 0, shadowDraws: this.mesh?.castShadow ? 1 : 0, triangles: this.triangles ?? 0, bones: this.bones.length, level: this.level,
      range: this.range ? this.range.report() : null, gateOpen: this.range?.gateOpen ?? true, animals: this.animals.map(a => ({ mode: a.walker.mode ?? 'in', uid: a.walker.uid, kind: a.spec.kind, coat: a.spec.coat, shown: a.shown, x: a.walker.x, z: a.walker.z, heading: a.walker.heading, speed: a.walker.speed, walking: a.walker.walking, rest: a.walker.rest, parts: a.rig.parts.length })) };
  }
}
