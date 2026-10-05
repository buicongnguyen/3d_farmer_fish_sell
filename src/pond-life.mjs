// The living family pond, drawn. A lazy chunk (world.mjs imports it with import() when you come within 45 m of the water): the pond's soft
// shore and water (pond-water.mjs), a school of the fish the pond can catch swimming instanced (one body draw and one tail draw a species,
// as cute_game's fish-school.ts), and the spray, rings and bubbles of a bite (pond-sim.mjs rules). The rod view (rod-fishing.mjs) tells this
// what the simulation is doing; this tells the rod nothing back except where the fish is.
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hyp } from './hyp.mjs';
import { POND } from './content.mjs';
import { FISH_POOLS } from './pond.mjs';
import { School, PondFx, SURFACE, FISH_LOOK, mulberry32 } from './pond-sim.mjs';
import { buildPondWater } from './pond-water.mjs';

// The ground under the pond is at y 0 and the water sheet at SURFACE: a fish drawn 1.7 to 2 times its model size is taller than the water is deep, so
// it is flattened (its model y scale only, tail hinge included) to FISH_DEPTH and stood on FISH_FLOOR, whole above the ground and its back at the surface;
// a roll is limited to 14 cm of swing and lifts it by that.
const FISH_FLOOR = .08, FISH_DEPTH = .3;
const ACTIVE = ['approach', 'nibble', 'bite', 'hooked'];
/** A mesh's geometry with each material's colour baked into vertex colours (cute_game's bake of the kit parts), optionally placed by its own matrix. */
function bakeMesh(mesh, place) {
  const src = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone(), n = src.getAttribute('position').count, colors = new Float32Array(n * 3), mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const vc = src.getAttribute('color'), groups = src.groups.length ? src.groups : [{ start: 0, count: n, materialIndex: 0 }];
  for (const g of groups) { const m = mats[g.materialIndex] ?? mats[0], c = m.color ?? new T.Color('#fff'); for (let i = g.start; i < Math.min(n, g.start + g.count); i++) colors.set([Math.min(1, c.r * 1.2 * (vc && m.vertexColors ? vc.getX(i) : 1)), Math.min(1, c.g * 1.2 * (vc && m.vertexColors ? vc.getY(i) : 1)), Math.min(1, c.b * 1.2 * (vc && m.vertexColors ? vc.getZ(i) : 1))], i * 3); }
  const g = new T.BufferGeometry(); g.setAttribute('position', src.getAttribute('position').clone()); if (src.getAttribute('normal')) g.setAttribute('normal', src.getAttribute('normal').clone()); else g.computeVertexNormals();
  g.setAttribute('color', new T.BufferAttribute(colors, 3)); if (place) g.applyMatrix4(place); src.dispose(); return g;
}
/** Every mesh under `root` (a kit model is a group of parts), baked and merged in the space of `frame`. */
function bakeNode(root, frame) {
  root.updateMatrixWorld(true); const inv = frame.matrixWorld.clone().invert(), parts = [];
  root.traverse(m => { if (m.isMesh) parts.push(bakeMesh(m, inv.clone().multiply(m.matrixWorld))); });
  return parts.length > 1 ? mergeGeometries(parts) : parts[0];
}
function softDot() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,255,255,.85)'); g.addColorStop(.6, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c);
}
function bubbleDot() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.fillStyle = 'rgba(210,244,255,.28)'; x.beginPath(); x.arc(32, 32, 27, 0, 7); x.fill(); x.lineWidth = 5; x.strokeStyle = 'rgba(255,255,255,.95)'; x.stroke();
  x.fillStyle = 'rgba(255,255,255,.95)'; x.beginPath(); x.arc(22, 21, 6, 0, 7); x.fill(); return new T.CanvasTexture(c);
}
function ringDot() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,255,255,0)'); g.addColorStop(.74, 'rgba(255,255,255,.55)'); g.addColorStop(.86, 'rgba(255,255,255,1)'); g.addColorStop(.94, 'rgba(255,255,255,.4)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new T.CanvasTexture(c);
}
/** The look of the effects on this screen. The camera is orthographic and far, so a metre is few pixels (about 30 on a desktop, 20 on a phone):
 * the spray, bubbles, rings and fish are drawn bigger by (what Zoo's camera gives) / (what this one gives), 1.6 to 2.6 times. */
const pixelBoost = camera => { const ppm = innerHeight / Math.max(1, (camera.top - camera.bottom) / camera.zoom); return Math.max(1.6, Math.min(2.6, 50 / ppm)); };
// Matrices written straight into scratch arrays and the instance buffers: a call into three's Matrix4 / Euler with fresh doubles boxes each one
// (a heap number per argument, many fish a frame); these small functions inline into the draw loop and allocate nothing.
const Q = new Float64Array(4), P = new Float64Array(9), A = new Float64Array(16), B = new Float64Array(16);
/** Q = the quaternion of an Euler 'YXZ' rotation (three's setFromEuler for that order), the angles in P[6..8]. */
function quatYXZ() { const x = P[6], y = P[7], z = P[8], c1 = Math.cos(x / 2), c2 = Math.cos(y / 2), c3 = Math.cos(z / 2), s1 = Math.sin(x / 2), s2 = Math.sin(y / 2), s3 = Math.sin(z / 2); Q[0] = s1 * c2 * c3 + c1 * s2 * s3; Q[1] = c1 * s2 * c3 - s1 * c2 * s3; Q[2] = c1 * c2 * s3 - s1 * s2 * c3; Q[3] = c1 * c2 * c3 + s1 * s2 * s3; }
/** m (16 numbers, column-major) = translate(P[0..2]) * rotate(Q) * scale(P[3..5]): three's Matrix4.compose. (Numbers go through P, not arguments: a call that is not inlined boxes each double it is given.) */
function compose(m) {
  const px = P[0], py = P[1], pz = P[2], sx = P[3], sy = P[4], sz = P[5], x = Q[0], y = Q[1], z = Q[2], w = Q[3], x2 = x + x, y2 = y + y, z2 = z + z, xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
  m[0] = (1 - (yy + zz)) * sx; m[1] = (xy + wz) * sx; m[2] = (xz - wy) * sx; m[3] = 0; m[4] = (xy - wz) * sy; m[5] = (1 - (xx + zz)) * sy; m[6] = (yz + wx) * sy; m[7] = 0;
  m[8] = (xz + wy) * sz; m[9] = (yz - wx) * sz; m[10] = (1 - (xx + yy)) * sz; m[11] = 0; m[12] = px; m[13] = py; m[14] = pz; m[15] = 1;
}
/** out[o..o+15] = a * b (three's Matrix4.multiplyMatrices). */
function mul(out, o, a, b) { for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) out[o + c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; }
/** One species from fish.glb's `node` (fish_<species>, with its _body and _tail parts): body and tail geometry baked to vertex colours (the body in the fish's
 * frame, the tail in its own frame so it can swing about `hinge`, where it joins), the scale that makes the fish FISH_LOOK[species].len long, and its y extent. */
export function bakeFish(node, body, tail, species) {
  node.updateMatrixWorld(true); const bg = bakeNode(body, node), tg = tail ? bakeNode(tail, tail) : null; bg.computeBoundingBox(); tg?.computeBoundingBox();
  const hinge = tail ? tail.position.clone() : new T.Vector3();
  if (tg) {
    // Zoo's broad sunfish fin and curved eel tail have off-centre origins. Pivot on
    // their joining edge, preserving the complete model's resting placement.
    const p = tg.getAttribute('position'), seam = new T.Vector3(); let n = 0;
    for (let i = 0; i < p.count; i++) if (p.getZ(i) > tg.boundingBox.max.z - .02) { seam.x += p.getX(i); seam.z += p.getZ(i); n++; }
    seam.divideScalar(n || 1); tg.translate(-seam.x, 0, -seam.z); hinge.add(seam); tg.computeBoundingBox();
  }
  const z0 = Math.min(bg.boundingBox.min.z, tg ? tg.boundingBox.min.z + hinge.z : 9), z1 = bg.boundingBox.max.z, scale = (FISH_LOOK[species]?.len ?? 1.1) / (z1 - z0);
  const top = Math.max(bg.boundingBox.max.y, tg ? tg.boundingBox.max.y + hinge.y : 0), bottom = Math.min(bg.boundingBox.min.y, tg ? tg.boundingBox.min.y + hinge.y : 0);
  return { bg, tg, hinge, scale, top, bottom, half: Math.max(bg.boundingBox.max.x, -bg.boundingBox.min.x) };
}
/** A = the body matrix of fish `f` (a School fish) drawn `fb` times bigger and `fade` (0..1) grown in; the tail is A * tailHinge(). */
export function fishMatrix(k, f, fb, fade) {
  const grow = k.scale * fb * (.2 + .8 * fade), ys = Math.min(1, FISH_DEPTH / ((k.top - k.bottom) * grow));
  const reach = k.half * grow, roll = reach * Math.abs(Math.sin(f.rz)) > .14 ? Math.sign(f.rz) * Math.asin(.14 / reach) : f.rz;
  P[6] = f.rx; P[7] = f.h; P[8] = roll; quatYXZ(); P[0] = f.x; P[1] = FISH_FLOOR - k.bottom * grow * ys + reach * Math.abs(Math.sin(roll)) + f.y; P[2] = f.z; P[3] = P[5] = grow; P[4] = grow * ys; compose(A);
}
/** B = the tail's matrix in the fish's own space: hinged at the joint, swung `f.tail` about y. */
export function tailHinge(k, f) { Q[0] = 0; Q[1] = Math.sin(f.tail / 2); Q[2] = 0; Q[3] = Math.cos(f.tail / 2); P[0] = k.hinge.x; P[1] = k.hinge.y; P[2] = k.hinge.z; P[3] = P[4] = P[5] = 1; compose(B); }
export { A as bodyM, B as tailM, mul as multiply };
const quad = (max, material, order) => { const m = new T.InstancedMesh(new T.PlaneGeometry(1, 1), material, Math.max(1, max)); m.instanceMatrix.setUsage(T.DynamicDrawUsage); m.setColorAt(0, new T.Color('#fff')); m.frustumCulled = false; m.count = 0; m.renderOrder = order; m.castShadow = false; m.raycast = () => {}; return m; };

export class PondLife {
  constructor(world) {
    this.world = world; this.root = new T.Group(); this.root.name = 'pond-life'; this.phone = world.state.settings.quality === 'battery' || Math.min(innerWidth, innerHeight) < 500; this.light = this.phone || (world.step ?? 0) >= 1;
    this.rng = mulberry32(20251005); this.fx = new PondFx({ rng: this.rng, light: this.light }); this.kinds = new Map(); this.layers = []; this.material = world.instMaterial;
    this.water = buildPondWater(); this.root.add(this.water);
    // Spray (additive, soft dots), bubbles (a ring and a glint) and rings on the surface: one draw each.
    this.spray = quad(this.fx.sparks.life.length, new T.MeshBasicMaterial({ map: softDot(), transparent: true, depthWrite: false, blending: T.AdditiveBlending }), 3);
    this.bubbleMesh = quad(this.fx.bubbles.life.length, new T.MeshBasicMaterial({ map: bubbleDot(), transparent: true, depthWrite: false }), 3);
    const rg = new T.PlaneGeometry(2, 2); rg.rotateX(-Math.PI / 2);
    this.ringMesh = new T.InstancedMesh(rg, new T.MeshBasicMaterial({ map: ringDot(), transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, forceSinglePass: true }), this.fx.rings.x.length);
    this.ringMesh.instanceMatrix.setUsage(T.DynamicDrawUsage); this.ringMesh.setColorAt(0, new T.Color('#fff')); this.ringMesh.frustumCulled = false; this.ringMesh.count = 0; this.ringMesh.renderOrder = 2; this.ringMesh.raycast = () => {};
    const sg = new T.PlaneGeometry(1, 1); sg.rotateX(-Math.PI / 2); this.shadows = new T.InstancedMesh(sg, new T.MeshBasicMaterial({ map: softDot(), color: '#0b3550', transparent: true, opacity: .34, depthWrite: false }), 16);
    this.shadows.instanceMatrix.setUsage(T.DynamicDrawUsage); this.shadows.frustumCulled = false; this.shadows.count = 0; this.shadows.renderOrder = 1; this.shadows.raycast = () => {}; this.boost = 1.7;
    this.root.add(this.shadows, this.spray, this.bubbleMesh, this.ringMesh); world.outside.add(this.root);
    if (world.water) world.water.visible = false;
    this.ctx = { float: null, player: null }; this.shown = true;
    this.prev = { phase: 'idle', nibbles: 0, early: 0, missed: 0 }; this.age = 0; this.keep = false; this.landing = null; this.tier = -1; this.restock();
  }
  /** The fish of this pond tier: the species it can catch, 8 of them (5 on a phone). Rebuilt when the pond is upgraded. */
  restock() {
    this.tier = this.world.state.upgrades.pond ?? 0; const pool = FISH_POOLS[Math.min(FISH_POOLS.length - 1, this.tier)];
    for (const l of this.layers) { this.root.remove(l.mesh); l.mesh.dispose(); } this.layers = []; this.kinds.clear(); this.fx.clear();
    this.school = new School(pool, this.light ? 5 : 8, { rng: this.rng, fx: this.fx }); this.age = 0; this.landing = null;
    for (const f of this.school.fish) this.kind(f.species);
  }
  kind(species) {
    let k = this.kinds.get(species); if (k !== undefined) return k;
    const node = this.world.raw.get('fish')?.getObjectByName('fish_' + species), body = node?.getObjectByName('fish_' + species + '_body'), tail = node?.getObjectByName('fish_' + species + '_tail');
    if (!body) { this.kinds.set(species, null); return null; }
    const { bg, tg, hinge, scale, top, bottom, half } = bakeFish(node, body, tail, species), cap = this.light ? 8 : 12;
    const mk = g => { const m = new T.InstancedMesh(g, this.material, cap); m.instanceMatrix.setUsage(T.DynamicDrawUsage); m.count = 0; m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false; m.name = 'pond-fish'; m.raycast = () => {}; this.root.add(m); return m; };
    const layers = [{ mesh: mk(bg), tail: false }]; if (tg) layers.push({ mesh: mk(tg), tail: true });
    this.layers.push(...layers); k = { layers, hinge, scale, top, bottom, half }; this.kinds.set(species, k); return k;
  }
  /** The nearest swimmer of the species becomes the one that takes the float; returns how far off it starts (the simulation counts it in). */
  choose(species, float) { return this.school.choose(species, float); }
  land(species, from, player) { this.keep = true; const f = this.school.land(species, from, { x: player.x, z: player.z, y: 1.2 }); this.landing = f; return f; }
  /** The rod was packed away or the round ended: a fish on the line swims off, spray and bubbles go. */
  end() {
    if (this.school.suitor) this.school.flee(this.school.suitor, 3.2, this.school.float);
    if (!this.keep) { this.fx.sparks.clear(); this.fx.bubbles.clear(); } this.keep = false; this.prev.phase = 'idle';
  }
  /** What the simulation is doing, as water: rings and spray at each step (Zoo's numbers), and the suitor driven to match. */
  follow(dt, s, float, player) {
    const sc = this.school, fx = this.fx, pv = this.prev;
    if (!sc.suitor && ACTIVE.includes(s.phase) && s.pick) sc.choose(s.pick.id, float);
    if (pv.phase === 'cast' && s.phase !== 'cast') { fx.ring(float.x, float.z, .2, 1.2, .6); fx.burst(float.x, float.z, 8, 2, 3, .07); }
    if (s.nibbles > pv.nibbles) fx.ring(float.x, float.z, .15, .5, .35, .6);
    if (s.earlyPresses > pv.early) { fx.ring(float.x, float.z, .2, .8, .4); sc.flee(sc.suitor, 3.2, float); }
    if (s.missedBites > pv.missed) { fx.ring(float.x, float.z, .2, .7, .4); sc.flee(sc.suitor, 3.2, float); }
    if (s.phase === 'bite' && pv.phase !== 'bite') { fx.ring(float.x, float.z, .3, 1.5, .5); fx.burst(float.x, float.z, 10, 3, 4, .07); }
    if (s.phase === 'hooked' && pv.phase !== 'hooked') fx.burst(float.x, float.z, 12, 2.5, 4, .08);
    if (s.phase === 'escaped' && pv.phase !== 'escaped') { if (s.snapped) { fx.ring(float.x, float.z, .3, 2.6, .7, .9); fx.ring(float.x, float.z, .2, 1.6, .5, .7); fx.burst(float.x, float.z, 14, 4, 5, .08); fx.burst(float.x, float.z, 16, 3, 4, .07); fx.sparks.burst(player.x, 1, player.z, 14, 3, 4, .08); fx.shake(.3); sc.flee(sc.suitor, 4.5, float); } else { fx.ring(float.x, float.z, .2, 1.6, .5, .6); fx.burst(float.x, float.z, 8, 2.5, 3.5, .07); sc.flee(sc.suitor, 3.2, float); } }
    else if (sc.suitor && !ACTIVE.includes(s.phase)) sc.flee(sc.suitor, 3.2, float);
    pv.phase = s.phase; pv.nibbles = s.nibbles; pv.early = s.earlyPresses; pv.missed = s.missedBites; sc.drive(dt, s, float, player);
  }
  update(dt) {
    const w = this.world, p = w.player.position, near = w.location === 'village' && hyp(p.x - POND.x, p.z - POND.z) < 45;
    const here = w.location === 'village'; this.near = near; this.root.visible = here; this.water.visible = here;
    if (!near) { if (this.shown) { this.shown = false; for (const l of this.layers) l.mesh.visible = false; this.shadows.visible = this.spray.visible = this.bubbleMesh.visible = this.ringMesh.visible = false; } return; } this.shown = true; dt = Math.min(dt, .1);
    const lite = this.phone || (w.step ?? 0) >= 1; if (lite !== this.light) { this.light = lite; this.fx.setLight(lite); this.restock(); }
    if ((w.state.upgrades.pond ?? 0) !== this.tier) this.restock();
    const rod = w.rodFishing, s = rod.sim, float = rod.bobber.position, sc = this.school, hold = s && s.phase !== 'cast';
    const ctx = this.ctx; ctx.float = hold ? float : null; ctx.player = p; sc.update(dt, ctx); this.age += dt;
    if (this.landing?.done) this.landing = null;
    this.draw(w.camera);
  }
  draw(camera) {
    const sc = this.school, fade = Math.min(1, this.age / .6), b = this.boost = pixelBoost(camera), fb = Math.min(b, 2), shadows = this.shadows, sa = shadows.instanceMatrix.array; let ns = 0;
    const layers = this.layers, fish = sc.fish; for (let i = 0; i < layers.length; i++) layers[i].n = 0;
    for (let fi = 0; fi < fish.length; fi++) {
      const f = fish[fi], k = this.kind(f.species); if (!k) continue;
      if (f.mode !== 'land' && ns < 16 && f.y < .12) { const len = (FISH_LOOK[f.species]?.len ?? 1.1) * fb * (.2 + .8 * fade); Q[0] = 0; Q[1] = Math.sin(f.h / 2); Q[2] = 0; Q[3] = Math.cos(f.h / 2); P[0] = f.x + .12; P[1] = SURFACE + .012; P[2] = f.z + .1; P[3] = len * .42; P[4] = 1; P[5] = len * 1.05; compose(B); for (let i = 0; i < 16; i++) sa[ns * 16 + i] = B[i]; ns++; }
      fishMatrix(k, f, fb, fade);
      for (let li = 0; li < k.layers.length; li++) {
        const l = k.layers[li]; if (l.n >= l.mesh.instanceMatrix.count) continue; const arr = l.mesh.instanceMatrix.array;
        if (l.tail) { tailHinge(k, f); mul(arr, l.n++ * 16, A, B); } else { for (let i = 0; i < 16; i++) arr[l.n * 16 + i] = A[i]; l.n++; }
      }
    }
    shadows.count = ns; shadows.visible = ns > 0; shadows.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < layers.length; i++) { const l = layers[i]; l.mesh.count = l.n; l.mesh.visible = l.n > 0; l.mesh.instanceMatrix.needsUpdate = true; }
    const q = camera.quaternion, sp = this.fx.sparks, bb = this.fx.bubbles, rg = this.fx.rings; Q[0] = q.x; Q[1] = q.y; Q[2] = q.z; Q[3] = q.w;
    let arr = this.spray.instanceMatrix.array, car = this.spray.instanceColor.array;
    for (let i = 0; i < sp.count; i++) { const fd = sp.life[i] / sp.span[i], sz = sp.size[i] * (.4 + fd * .6) * 1.5 * b; P[0] = sp.p[i * 3]; P[1] = sp.p[i * 3 + 1]; P[2] = sp.p[i * 3 + 2]; P[3] = P[4] = P[5] = sz; compose(A); for (let j = 0; j < 16; j++) arr[i * 16 + j] = A[j]; car[i * 3] = sp.c[i * 3]; car[i * 3 + 1] = sp.c[i * 3 + 1]; car[i * 3 + 2] = sp.c[i * 3 + 2]; }
    this.spray.count = sp.count; this.spray.visible = sp.count > 0; if (sp.count) { this.spray.instanceMatrix.needsUpdate = true; this.spray.instanceColor.needsUpdate = true; }
    arr = this.bubbleMesh.instanceMatrix.array;
    for (let i = 0; i < bb.count; i++) { const fd = bb.life[i] / bb.span[i], sz = bb.size[i] * (1.5 - fd * .5) * 2.4 * b; P[0] = bb.p[i * 3]; P[1] = bb.p[i * 3 + 1]; P[2] = bb.p[i * 3 + 2]; P[3] = P[4] = P[5] = sz; compose(A); for (let j = 0; j < 16; j++) arr[i * 16 + j] = A[j]; }
    this.bubbleMesh.count = bb.count; this.bubbleMesh.visible = bb.count > 0; if (bb.count) this.bubbleMesh.instanceMatrix.needsUpdate = true;
    Q[0] = Q[1] = Q[2] = 0; Q[3] = 1; arr = this.ringMesh.instanceMatrix.array; car = this.ringMesh.instanceColor.array;
    for (let i = 0; i < rg.count; i++) { const r = rg.radius(i) * b, a = Math.min(1, rg.alpha(i) * 1.5); P[0] = rg.x[i]; P[1] = SURFACE + .015; P[2] = rg.z[i]; P[3] = P[5] = r; P[4] = 1; compose(A); for (let j = 0; j < 16; j++) arr[i * 16 + j] = A[j]; car[i * 3] = a * .9; car[i * 3 + 1] = a; car[i * 3 + 2] = a; }
    this.ringMesh.count = rg.count; this.ringMesh.visible = rg.count > 0; if (rg.count) { this.ringMesh.instanceMatrix.needsUpdate = true; this.ringMesh.instanceColor.needsUpdate = true; }
  }
  get metrics() {
    const sc = this.school, f = sc.suitor;
    return { ready: true, boost: this.boost, shadows: this.shadows.count, water: this.root.visible && this.water.visible, near: this.near, tier: this.tier, light: this.light, species: [...new Set(sc.fish.map(x => x.species))].sort(), fish: sc.metrics, n: sc.fish.length, suitor: f ? { id: f.id, species: f.species, x: f.x, y: f.y, z: f.z, h: f.h, tail: f.tail, rz: f.rz, mode: f.mode } : null,
      rings: this.fx.rings.count, particles: this.fx.sparks.count + this.fx.bubbles.count, sparks: this.fx.sparks.count, bubbles: this.fx.bubbles.count, draws: this.layers.filter(l => l.n > 0).length + 2 + (this.spray.visible ? 1 : 0) + (this.bubbleMesh.visible ? 1 : 0) + (this.ringMesh.visible ? 1 : 0) };
  }
}
