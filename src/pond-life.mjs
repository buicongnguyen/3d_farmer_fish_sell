// The living family pond, drawn. A lazy chunk (world.mjs imports it with import() when you come within 45 m of the water): the pond's soft
// shore and water (pond-water.mjs), a school of the fish the pond can catch swimming instanced (one body draw and one tail draw a species,
// as cute_game's fish-school.ts), and the spray, rings and bubbles of a bite (pond-sim.mjs rules). The rod view (rod-fishing.mjs) tells this
// what the simulation is doing; this tells the rod nothing back except where the fish is.
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon } from './toon.mjs';
import { POND } from './content.mjs';
import { FISH_POOLS } from './pond.mjs';
import { School, PondFx, SURFACE, FISH_LOOK, mulberry32 } from './pond-sim.mjs';
import { buildPondWater } from './pond-water.mjs';

const ACTIVE = ['approach', 'nibble', 'bite', 'hooked'], ONE = new T.Vector3(1, 1, 1);
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
const quad = (max, material, order) => { const m = new T.InstancedMesh(new T.PlaneGeometry(1, 1), material, Math.max(1, max)); m.instanceMatrix.setUsage(T.DynamicDrawUsage); m.setColorAt(0, new T.Color('#fff')); m.frustumCulled = false; m.count = 0; m.renderOrder = order; m.castShadow = false; m.raycast = () => {}; return m; };

export class PondLife {
  constructor(world) {
    this.world = world; this.root = new T.Group(); this.root.name = 'pond-life'; this.light = world.state.settings.quality === 'battery' || Math.min(innerWidth, innerHeight) < 500;
    this.rng = mulberry32(20251005); this.fx = new PondFx({ rng: this.rng, light: this.light }); this.kinds = new Map(); this.layers = []; this.material = toon({ vertexColors: true });
    this.water = buildPondWater(); this.root.add(this.water);
    // Spray (additive, soft dots), bubbles (a ring and a glint) and rings on the surface: one draw each.
    this.spray = quad(this.fx.sparks.max, new T.MeshBasicMaterial({ map: softDot(), transparent: true, depthWrite: false, blending: T.AdditiveBlending }), 3);
    this.bubbleMesh = quad(this.fx.bubbles.max, new T.MeshBasicMaterial({ map: bubbleDot(), transparent: true, depthWrite: false }), 3);
    const rg = new T.RingGeometry(.82, 1, 48); rg.rotateX(-Math.PI / 2);
    this.ringMesh = new T.InstancedMesh(rg, new T.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, forceSinglePass: true }), this.fx.rings.max);
    this.ringMesh.instanceMatrix.setUsage(T.DynamicDrawUsage); this.ringMesh.setColorAt(0, new T.Color('#fff')); this.ringMesh.frustumCulled = false; this.ringMesh.count = 0; this.ringMesh.renderOrder = 2; this.ringMesh.raycast = () => {};
    this.root.add(this.spray, this.bubbleMesh, this.ringMesh); world.outside.add(this.root);
    if (world.water) world.water.visible = false;
    this.m = new T.Matrix4(); this.hinge = new T.Matrix4(); this.out = new T.Matrix4(); this.q = new T.Quaternion(); this.e = new T.Euler(0, 0, 0, 'YXZ'); this.p = new T.Vector3(); this.s = new T.Vector3(); this.col = new T.Color();
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
    node.updateMatrixWorld(true); const bg = bakeNode(body, node), tg = tail ? bakeNode(tail, tail) : null; bg.computeBoundingBox(); tg?.computeBoundingBox();
    const hinge = tail ? tail.position.clone() : new T.Vector3(), z0 = Math.min(bg.boundingBox.min.z, tg ? tg.boundingBox.min.z + hinge.z : 9), z1 = bg.boundingBox.max.z, scale = (FISH_LOOK[species]?.len ?? 1.1) / (z1 - z0);
    const top = Math.max(bg.boundingBox.max.y, tg ? tg.boundingBox.max.y + hinge.y : 0) * scale, cap = this.light ? 8 : 12;
    const mk = g => { const m = new T.InstancedMesh(g, this.material, cap); m.instanceMatrix.setUsage(T.DynamicDrawUsage); m.count = 0; m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false; m.name = 'pond-fish'; m.raycast = () => {}; this.root.add(m); return m; };
    const layers = [{ mesh: mk(bg), tail: false }]; if (tg) layers.push({ mesh: mk(tg), tail: true });
    this.layers.push(...layers); k = { layers, hinge, scale, y: SURFACE - top - .035 }; this.kinds.set(species, k); return k;
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
    if (s.phase === 'escaped' && pv.phase !== 'escaped') { if (s.snapped) { fx.burst(float.x, float.z, 14, 4, 5, .08); fx.burst(float.x, float.z, 16, 3, 4, .07); fx.shake(.3); sc.flee(sc.suitor, 4.5, float); } else sc.flee(sc.suitor, 3.2, float); }
    else if (sc.suitor && !ACTIVE.includes(s.phase)) sc.flee(sc.suitor, 3.2, float);
    pv.phase = s.phase; pv.nibbles = s.nibbles; pv.early = s.earlyPresses; pv.missed = s.missedBites; sc.drive(dt, s, float, player);
  }
  update(dt) {
    const w = this.world, p = w.player.position, near = w.location === 'village' && Math.hypot(p.x - POND.x, p.z - POND.z) < 45;
    this.root.visible = near; if (!near) return; dt = Math.min(dt, .1);
    if ((w.state.upgrades.pond ?? 0) !== this.tier) this.restock();
    const rod = w.rodFishing, s = rod.sim, float = rod.bobber.position, sc = this.school, hold = s && s.phase !== 'cast';
    sc.update(dt, { float: hold ? float : null, player: p }); this.age += dt;
    if (this.landing?.done) this.landing = null;
    this.draw(w.camera);
  }
  draw(camera) {
    const sc = this.school, fade = Math.min(1, this.age / .6);
    for (const l of this.layers) l.n = 0;
    for (const f of sc.fish) {
      const k = this.kind(f.species); if (!k) continue; this.e.set(f.rx, f.h, f.rz); this.q.setFromEuler(this.e);
      this.p.set(f.x, k.y + f.y, f.z); this.s.setScalar(k.scale * (.2 + .8 * fade)); this.m.compose(this.p, this.q, this.s);
      for (const l of k.layers) {
        if (l.n >= l.mesh.instanceMatrix.count) continue;
        if (l.tail) { this.hinge.compose(k.hinge, this.q.set(0, Math.sin(f.tail / 2), 0, Math.cos(f.tail / 2)), ONE); this.out.multiplyMatrices(this.m, this.hinge); l.mesh.setMatrixAt(l.n++, this.out); } else l.mesh.setMatrixAt(l.n++, this.m);
      }
    }
    for (const l of this.layers) { l.mesh.count = l.n; l.mesh.visible = l.n > 0; l.mesh.instanceMatrix.needsUpdate = true; }
    const q = camera.quaternion, sp = this.fx.sparks, bb = this.fx.bubbles, rg = this.fx.rings;
    for (let i = 0; i < sp.count; i++) { const fd = sp.life[i] / sp.span[i]; this.p.set(sp.p[i * 3], sp.p[i * 3 + 1], sp.p[i * 3 + 2]); this.s.setScalar(sp.size[i] * (.4 + fd * .6) * 1.5); this.m.compose(this.p, q, this.s); this.spray.setMatrixAt(i, this.m); this.spray.setColorAt(i, this.col.setRGB(sp.c[i * 3], sp.c[i * 3 + 1], sp.c[i * 3 + 2])); }
    this.spray.count = sp.count; this.spray.visible = sp.count > 0; if (sp.count) { this.spray.instanceMatrix.needsUpdate = true; this.spray.instanceColor.needsUpdate = true; }
    for (let i = 0; i < bb.count; i++) { const fd = bb.life[i] / bb.span[i]; this.p.set(bb.p[i * 3], bb.p[i * 3 + 1], bb.p[i * 3 + 2]); this.s.setScalar(bb.size[i] * (1.5 - fd * .5) * 1.4); this.m.compose(this.p, q, this.s); this.bubbleMesh.setMatrixAt(i, this.m); }
    this.bubbleMesh.count = bb.count; this.bubbleMesh.visible = bb.count > 0; if (bb.count) this.bubbleMesh.instanceMatrix.needsUpdate = true;
    this.q.identity();
    for (let i = 0; i < rg.count; i++) { const r = rg.radius(i), a = Math.min(1, rg.alpha(i) * 1.5); this.p.set(rg.x[i], SURFACE + .015, rg.z[i]); this.s.set(r, 1, r); this.m.compose(this.p, this.q, this.s); this.ringMesh.setMatrixAt(i, this.m); this.ringMesh.setColorAt(i, this.col.setRGB(a * .9, a, a)); }
    this.ringMesh.count = rg.count; this.ringMesh.visible = rg.count > 0; if (rg.count) { this.ringMesh.instanceMatrix.needsUpdate = true; this.ringMesh.instanceColor.needsUpdate = true; }
  }
  get metrics() {
    const sc = this.school, f = sc.suitor;
    return { ready: true, tier: this.tier, light: this.light, species: [...new Set(sc.fish.map(x => x.species))].sort(), fish: sc.metrics, n: sc.fish.length, suitor: f ? { id: f.id, species: f.species, x: f.x, y: f.y, z: f.z, h: f.h, tail: f.tail, rz: f.rz, mode: f.mode } : null,
      rings: this.fx.rings.count, particles: this.fx.sparks.count + this.fx.bubbles.count, sparks: this.fx.sparks.count, bubbles: this.fx.bubbles.count, draws: this.layers.filter(l => l.n > 0).length + 2 + (this.spray.visible ? 1 : 0) + (this.bubbleMesh.visible ? 1 : 0) + (this.ringMesh.visible ? 1 : 0) };
  }
}
