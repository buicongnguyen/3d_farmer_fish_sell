// The Blender products from cute_game/farm.glb, hovering over the animals that made them.
import * as T from 'three';
import { toon } from './toon.mjs';

export const ANIMAL_PRODUCT = { chicken: 'egg', duck: 'duck_egg', cow: 'milk', pig: 'truffle' };
export const produceReady = s => s.fedDay === s.day && s.collectedDay !== s.day;

export class AnimalProduce {
  constructor(view) {
    this.view = view; this.world = view.world; this.root = new T.Group(); this.root.name = 'animal-produce'; this.world.outside.add(this.root);
    this.meshes = new Map(); this.ready = false; this.day = 0; this.flights = []; this.shown = 0;
    this.m = new T.Matrix4(); this.v = new T.Vector3(); this.q = new T.Quaternion(); this.s = new T.Vector3(); this.e = new T.Euler();
    this.world.loadKit('animal-produce').then(ok => { if (ok) this.build(); }).catch(error => console.warn('Animal produce could not load.', error));
  }
  build() {
    for (const product of Object.values(ANIMAL_PRODUCT)) {
      const source = this.world.kits.get('animal-produce/' + product); if (!source) continue;
      const geometry = source.geometry.clone(); geometry.computeBoundingBox(); const b = geometry.boundingBox;
      const size = product === 'truffle' ? .65 : .8, scale = size / Math.max(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z);
      geometry.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2); geometry.scale(scale, scale, scale);
      const mesh = new T.InstancedMesh(geometry, toon({ vertexColors: true, emissive: '#fff1bc', emissiveIntensity: .18 }), 10);
      mesh.name = 'ready-' + product; mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); mesh.count = 0; mesh.frustumCulled = false; mesh.castShadow = false; mesh.raycast = () => {};
      this.meshes.set(product, mesh); this.root.add(mesh);
    }
  }
  update(dt, time, state) {
    const ready = produceReady(state), view = this.view;
    if (this.ready && !ready && this.day === state.day && state.collectedDay === state.day) {
      for (const a of view.animals) if (a.shown) this.flights.push({ product: ANIMAL_PRODUCT[a.spec.kind], x: a.walker.x, z: a.walker.z, y: a.rig.height * a.size + .4, age: 0 });
    }
    this.ready = ready; this.day = state.day; this.shown = 0; this.root.visible = this.world.location === 'village';
    for (const mesh of this.meshes.values()) mesh.count = 0;
    if (ready) for (const a of view.animals) if (a.shown) {
      const y = a.rig.height * a.size + .4 + Math.sin(time * 2.8 + a.seed) * .07;
      this.put(ANIMAL_PRODUCT[a.spec.kind], a.walker.x, y, a.walker.z, time * .55 + a.seed, 1); this.shown++;
    }
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const f = this.flights[i]; f.age += dt; if (f.age >= .65) { this.flights.splice(i, 1); continue; }
      this.put(f.product, f.x, f.y + f.age * 2, f.z, time, 1 - f.age / .65);
    }
    for (const mesh of this.meshes.values()) { mesh.visible = mesh.count > 0; if (mesh.count) mesh.instanceMatrix.needsUpdate = true; }
  }
  put(product, x, y, z, angle, size) {
    const mesh = this.meshes.get(product); if (!mesh || mesh.count >= mesh.instanceMatrix.count) return;
    this.m.compose(this.v.set(x, y, z), this.q.setFromEuler(this.e.set(0, angle, 0)), this.s.setScalar(size)); mesh.setMatrixAt(mesh.count++, this.m);
  }
  diagnostics() {
    return { loaded: this.meshes.size === 4, ready: this.ready, shown: this.root.visible ? this.shown : 0, flights: this.flights.length, draws: this.root.visible ? [...this.meshes.values()].filter(m => m.visible).length : 0,
      products: this.ready ? this.view.animals.filter(a => a.shown).map(a => ({ uid: a.walker.uid, kind: a.spec.kind, product: ANIMAL_PRODUCT[a.spec.kind], x: a.walker.x, z: a.walker.z })) : [] };
  }
}
