// Draws the grove (grove.mjs): the stumps of cleared village trees and every fruit tree you planted, on the stumps' spots
// and in the three orchard circles. Few draws however many there are: one instanced mesh for all stumps, one for the ring
// round each fruit tree (soil brown; gold when the tree is ready to pick, rose in its best season), and one per kind of
// tree that is actually planted (made the first time it is needed), with the growth stage as the instance's size.
// It also owns what a cleared tree does to the world: the tree's instance is hidden and its trunk stops blocking the way,
// and both come back when a save with fewer cleared trees is loaded. A fruit tree blocks walking, driving and creatures
// like any tree (world.addTreeBlock); whoever stands where a trunk appears is moved just outside it.
//
//   world.grove = new GroveView(world)   once the village's trees exist;   grove.sync(state)   from world.sync()
import * as T from 'three';
import { grovePlan, STAGE, TREE_SIZE } from './grove.mjs';

/** Where a tree model's footprint is centred and where its base is (its own origin is not the trunk: the coconut's is 0.5 m off), as the translation that puts both on the origin. */
export function pivotOf(source) {
  source.updateWorldMatrix(true, true); const box = new T.Box3().setFromObject(source), c = box.getCenter(new T.Vector3()); return new T.Matrix4().makeTranslation(-c.x, -box.min.y, -c.z);
}
const dummy = new T.Object3D(), ZERO = new T.Matrix4().makeScale(0, 0, 0), color = new T.Color();
const RING = { idle: '#a8703f', ready: '#ffd23f', season: '#ff7fb6' };

export class GroveView {
  constructor(world) {
    this.world = world; this.shown = new Map(); this.kinds = new Map(); this.blocks = new Map(); this.key = ''; this.counts = { stumps: 0, trees: 0, kinds: 0 };
    const stump = world.assets.get('stump'); let source = null; stump?.traverse(m => { if (m.isMesh && !source) source = m; });
    this.capacity = Math.max(8, world.trees?.filter(t => !t.gone).length ?? 0);
    this.stumps = source ? this.batch(source.geometry, source.material, this.capacity, false) : null;
    const ring = new T.RingGeometry(.92, 1.12, 28); ring.rotateX(-Math.PI / 2);
    this.rings = this.batch(ring, new T.MeshBasicMaterial({ color: '#ffffff' }), this.capacity + 3, false);
  }
  batch(geometry, material, n, shadow) {
    const mesh = new T.InstancedMesh(geometry, material, n); mesh.count = 0; mesh.visible = false; mesh.castShadow = shadow; mesh.receiveShadow = true; mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.world.outside.add(mesh); return mesh;
  }
  /** The instanced mesh(es) of one kind of fruit tree, with the scale that makes the model TREE_SIZE metres. */
  kind(id, need) {
    let k = this.kinds.get(id);
    if (k && k.capacity >= need) return k;
    const source = this.world.assets.get('crop_' + id); if (!source) return null;
    if (k) for (const m of k.meshes) { m.removeFromParent(); m.dispose(); }
    const size = new T.Box3().setFromObject(source).getSize(new T.Vector3()), capacity = Math.max(8, need * 2), meshes = [];
    source.traverse(m => { if (m.isMesh) meshes.push(this.batch(m.geometry, m.material, capacity, true)); });
    k = { meshes, capacity, scale: TREE_SIZE / Math.max(size.x, size.y, size.z), pivot: pivotOf(source) }; this.kinds.set(id, k); return k;
  }
  /** A village tree was cleared (hide it, free its trunk) or is standing again (a save with fewer cleared trees). */
  setCleared(i, cleared) {
    const w = this.world, t = w.trees?.[i]; if (!t || t.gone) return;
    const entry = w.treeMeshes[t.kind], k = entry.index.get(i); if (k === undefined) return;
    if (cleared) {
      const kept = entry.meshes.map(m => { const old = new T.Matrix4(); m.getMatrixAt(k, old); m.setMatrixAt(k, ZERO); m.instanceMatrix.needsUpdate = true; return old; });
      this.shown.set(i, kept); if (t.block) { w.removeTreeBlock(t.block); t.block = null; }
    } else {
      const kept = this.shown.get(i); entry.meshes.forEach((m, n) => { if (kept?.[n]) { m.setMatrixAt(k, kept[n]); m.instanceMatrix.needsUpdate = true; } });
      this.shown.delete(i); t.block = w.addTreeBlock({ x: t.x, z: t.z, r: .42 * t.s, h: 3.3 * t.s });
    }
    for (const m of entry.meshes) m.computeBoundingSphere?.();
  }
  /** Whoever stands inside a new trunk steps just outside it. */
  nudge(b) {
    const w = this.world, p = w.location === 'village' ? w.player?.position : w.returnPosition; if (!p) return;
    const dx = p.x - b.x, dz = p.z - b.z, d = Math.hypot(dx, dz), out = b.r + .55; if (d >= b.r + .34) return;
    const a0 = d > .01 ? Math.atan2(dz, dx) : Math.PI / 2;
    for (let i = 0; i < 12; i++) { const a = a0 + (i % 2 ? -1 : 1) * Math.ceil(i / 2) * Math.PI / 6, x = b.x + Math.cos(a) * out, z = b.z + Math.sin(a) * out; if (w.location !== 'village' || !w.blocked(x, z)) { p.x = x; p.z = z; return; } }
  }
  sync(s) {
    const w = this.world, plan = grovePlan(s), key = JSON.stringify([s.cleared, plan]); if (key === this.key) return; this.key = key;
    w.clearedShown ??= new Set();
    const cleared = new Set(s.cleared);
    for (const i of [...w.clearedShown]) if (!cleared.has(i)) { w.clearedShown.delete(i); this.setCleared(i, false); }
    for (const i of cleared) if (!w.clearedShown.has(i) && w.trees?.[i] && !w.trees[i].gone) { w.clearedShown.add(i); this.setCleared(i, true); }
    // Stumps.
    if (this.stumps) {
      plan.stumps.slice(0, this.capacity).forEach((p, n) => { dummy.position.set(p.x, 0, p.z); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(1); dummy.updateMatrix(); this.stumps.setMatrixAt(n, dummy.matrix); });
      this.finish(this.stumps, Math.min(plan.stumps.length, this.capacity));
    }
    // Fruit trees, by kind, and the ring round each.
    const byKind = new Map(); for (const t of plan.trees) { if (!byKind.has(t.kind)) byKind.set(t.kind, []); byKind.get(t.kind).push(t); }
    for (const [id, k] of this.kinds) if (!byKind.has(id)) for (const m of k.meshes) this.finish(m, 0);
    for (const [id, list] of byKind) {
      const k = this.kind(id, list.length); if (!k) continue;
      list.forEach((t, n) => { dummy.position.set(t.x, 0, t.z); dummy.rotation.set(0, t.turn, 0); dummy.scale.setScalar(k.scale * STAGE[t.stage]); dummy.updateMatrix(); dummy.matrix.multiply(k.pivot); for (const m of k.meshes) m.setMatrixAt(n, dummy.matrix); });
      for (const m of k.meshes) this.finish(m, list.length);
    }
    const rings = plan.trees.slice(0, this.rings.instanceMatrix.count);
    rings.forEach((t, n) => { dummy.position.set(t.x, t.where === 'orchard' ? .1 : .035, t.z); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(t.where === 'orchard' ? 1.08 : .62 + .38 * STAGE[t.stage]); dummy.updateMatrix(); this.rings.setMatrixAt(n, dummy.matrix); this.rings.setColorAt(n, color.set(t.ready ? t.season ? RING.season : RING.ready : RING.idle)); });
    this.finish(this.rings, rings.length); if (this.rings.instanceColor) this.rings.instanceColor.needsUpdate = true;
    // Trunks: a block for each fruit tree, replaced when the tree grows.
    const want = new Map(plan.trees.map(t => [`${t.id}|${t.stage}`, t]));
    for (const [id, b] of this.blocks) if (!want.has(id)) { w.removeTreeBlock(b); this.blocks.delete(id); }
    for (const [id, t] of want) if (!this.blocks.has(id)) { const b = w.addTreeBlock({ x: t.x, z: t.z, r: t.r, h: t.h, fruit: true }); this.blocks.set(id, b); this.nudge(b); }
    this.counts = { stumps: plan.stumps.length, trees: plan.trees.length, kinds: byKind.size };
  }
  finish(mesh, count) { mesh.count = count; mesh.visible = count > 0; mesh.instanceMatrix.needsUpdate = true; if (count) mesh.computeBoundingSphere(); }
  /** For the diagnostics (window.willowmere): how much is drawn. */
  get metrics() { return { ...this.counts, blocks: this.blocks.size, draws: (this.stumps?.visible ? 1 : 0) + (this.rings.visible ? 1 : 0) + [...this.kinds.values()].reduce((n, k) => n + k.meshes.filter(m => m.visible).length, 0) }; }
}
