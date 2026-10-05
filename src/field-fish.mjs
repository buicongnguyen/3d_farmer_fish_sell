// Ambient schools in the existing outdoor ponds. Zoo Garden fish models, shared instanced
// body/tail batches and a single surface-silhouette batch; no shadow maps or dependence on Pandora.
import * as T from 'three';
import { FEATURES } from './land-features.mjs';
import { School, FISH_LOOK, mulberry32 } from './pond-sim.mjs';
import { bakeFish, fishMatrix, tailHinge, bodyM, tailM, multiply, buildFishShadows, shadowMatrix } from './pond-life.mjs';

export const FIELD_FISH = {
  west: ['perch', 'carp', 'catfish'], south: ['koi', 'clown', 'sunfish'],
  toy: ['perch', 'puffer', 'rainbow'], candy: ['clown', 'rainbow', 'golden'],
  jungle: ['carp', 'eel', 'puffer'], ice: ['icepike', 'perch', 'koi'],
  shadow: ['angler', 'eel', 'rainbow'],
};
const PONDS = Object.entries(FIELD_FISH).flatMap(([region, pool]) => FEATURES[region].ponds.map((p, i) => ({ ...p, pool, region, id: `${region}-${i}` })));

export class FieldFish {
  constructor(world) {
    this.world = world; this.root = new T.Group(); this.root.name = 'outdoor-pond-fish';
    // Keep the small schools legible in Night Land as well as the bright ponds.
    this.material = new T.MeshBasicMaterial({ vertexColors: true });
    world.outside.add(this.root); this.schools = new Map(); this.kinds = new Map(); this.frame = 0;
    this.active = []; this.holes = []; this.ctx = { player: null }; this.shown = 0;
    this.shadows = buildFishShadows(PONDS.length * 6); this.root.add(this.shadows);
  }
  kind(species) {
    if (this.kinds.has(species)) return this.kinds.get(species);
    const node = this.world.raw.get('fish')?.getObjectByName('fish_' + species);
    const body = node?.getObjectByName('fish_' + species + '_body'), tail = node?.getObjectByName('fish_' + species + '_tail');
    if (!body) return null;
    const k = bakeFish(node, body, tail, species);
    const batch = geometry => {
      const mesh = new T.InstancedMesh(geometry, this.material, 32);
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); mesh.count = 0;
      mesh.castShadow = mesh.receiveShadow = false; mesh.frustumCulled = false; mesh.raycast = () => {};
      this.root.add(mesh); return mesh;
    };
    k.body = batch(k.bg); k.tail = k.tg ? batch(k.tg) : null; k.count = 0;
    this.kinds.set(species, k); return k;
  }
  update(dt) {
    const w = this.world, p = w.player.position, outdoors = w.location === 'village';
    this.root.visible = outdoors; this.active.length = 0; this.shown = 0; this.frame++;
    let lights = 0, hints = 0;
    for (const k of this.kinds.values()) k.count = 0;
    if (outdoors) for (let i = 0; i < PONDS.length; i++) {
      const pond = PONDS[i]; if (Math.hypot(p.x - pond.x, p.z - pond.z) > pond.r + 32) continue;
      let entry = this.schools.get(pond.id);
      if (!entry) {
        // The swim rectangle fits inside the circular water, with room for the whole fish.
        const shape = { x: pond.x, z: pond.z, w: pond.r * 1.25, d: pond.r * 1.25 };
        entry = { pond, school: new School(pond.pool, 6, { pond: shape, rng: mulberry32(7919 + i * 137) }), last: 0 };
        // Outdoor water is flat at .02, below the raised family pond's surface.
        for (const f of entry.school.fish) f.shadowY = .034;
        this.schools.set(pond.id, entry);
      }
      entry.last = this.frame; this.active.push(pond.id); this.ctx.player = p;
      if (!w.paused) entry.school.update(Math.min(dt, .05), this.ctx);
      const light = w.state.settings.quality === 'battery' || Math.min(innerWidth, innerHeight) < 500 || (w.step ?? 0) > 0;
      const n = light ? 3 : 6;
      for (let j = 0; j < entry.school.fish.length; j++) {
        const f = entry.school.fish[j];
        // Keep the whole school readable when detailed bodies are reduced on phones.
        shadowMatrix(f, (FISH_LOOK[f.species]?.len ?? 1.1) * 1.25);
        this.shadows.instanceMatrix.array.set(tailM, hints++ * 16);
        if (pond.region === 'shadow') { const h = this.holes[lights] ?? (this.holes[lights] = { x: 0, z: 0, r: 1.5 }); h.x = f.x; h.z = f.z; lights++; }
        if (j >= n) continue;
        const k = this.kind(f.species); if (!k || k.count >= 32) continue;
        fishMatrix(k, f, 1.25, 1); bodyM[13] -= .06;
        k.body.instanceMatrix.array.set(bodyM, k.count * 16);
        if (k.tail) { tailHinge(k, f); multiply(k.tail.instanceMatrix.array, k.count * 16, bodyM, tailM); }
        k.count++; this.shown++;
      }
    }
    this.holes.length = lights;
    this.shadows.count = hints; this.shadows.visible = hints > 0;
    if (hints) this.shadows.instanceMatrix.needsUpdate = true;
    // Keep geometry shared, and retain only recently visited schools.
    for (const entry of this.schools.values()) if (this.frame - entry.last > 600) this.schools.delete(entry.pond.id);
    for (const k of this.kinds.values()) {
      k.body.count = k.count; k.body.visible = k.count > 0; if (k.count) k.body.instanceMatrix.needsUpdate = true;
      if (k.tail) { k.tail.count = k.count; k.tail.visible = k.count > 0; if (k.count) k.tail.instanceMatrix.needsUpdate = true; }
    }
  }
  diagnostics() {
    return { ponds: [...this.active], fish: this.shown, hints: this.shadows.count, draws: [...this.kinds.values()].reduce((n, k) => n + (k.count ? k.tail ? 2 : 1 : 0), this.shadows.count ? 1 : 0),
      schools: [...this.schools.values()].filter(e => this.active.includes(e.pond.id)).map(e => ({ id: e.pond.id, x: e.pond.x, z: e.pond.z, r: e.pond.r, fish: e.school.fish.map(f => ({ species: f.species, x: f.x, z: f.z })) })) };
  }
}
