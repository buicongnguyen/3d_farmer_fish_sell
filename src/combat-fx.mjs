// Pooled fight feedback, after Zoo Garden's effects (cute_game src/fx.ts, telegraph.ts, target-marker.ts, sfx.ts):
// chips and glowing sparks (one instanced draw each), shock rings (one instanced draw), slash arcs, danger discs on the
// ground (two instanced draws whatever their number: a boss's charge lane is six discs, a titan's bombard fifteen), the red
// target ring and arrow, floating numbers, a camera shake and small synthesised sounds. Everything is
// made once and reused: a big hit costs the same draws as a small one, and nothing is created while a fight runs.
// The split build (scripts/build.mjs): this file keeps the class with its numbers, the danger discs' begin / decal / end and the
// hit-stop and shake inputs; making the meshes and labels (build) and moving them (the bursts, rings, arcs, floating text, the
// target marker, the sounds) is combat-fx-draw.mjs, fetched by load() when the box is first opened and put onto the prototype.
import * as T from 'three';

const m4 = new T.Matrix4();
export const TARGET_RED = '#ff4d5e';
/** How many danger discs one frame may show (bosses, the lands' weather and the titans together). */
export const DECAL_MAX = 96;

export class CombatFx {
  /** @param {HTMLElement} layer where floating numbers go. */
  constructor(layer) {
    this.coding = null;
    this.root = new T.Group(); this.root.name = 'combat-fx'; this.layer = layer; this.trauma = 0; this.frozen = 0; this.kickX = 0; this.kickZ = 0; this.time = 0;
    this.still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    // The pools, the rings, the arcs, the danger discs, the target's ring and arrow and the labels are made by build()
    // (combat-fx-draw.mjs) when the box is first opened; until then decal() draws nothing and the target stays hidden.
    this.used = 0; this.tones = new Map(); this.rims = this.fills = this.chips = null;
    this.target = new T.Group(); this.target.visible = false; this.target.name = 'target-marker'; this.root.add(this.target);
    this.sound = true; this.audioFn = null; this.ctx = null; this.out = null; this.noise = null; this.last = new Map();
  }
  tone_(hex) { let c = this.tones.get(hex); if (!c) this.tones.set(hex, c = new T.Color(hex)); return c; }
  /** The moving half (combat-fx-draw.mjs), fetched when the box is first opened; a failed fetch is tried again on the next call. */
  load() { return this.coding ??= import('./box-draw.mjs').then(m => { m.installFx(CombatFx); this.build(); }).catch(error => { this.coding = null; console.warn('The fight effects could not load.', error); }); }
  // Until it has arrived the effects are silent and still (nothing is fighting yet); install() replaces these on the prototype.
  burst() {} orbs() {} ring() {} slash() {} text() {} marker() { this.target.visible = false; } update() {} play() {} look() {} cast4() {} specialOf() {}
  begin() { this.used = 0; }
  /** A danger disc for this frame: centre, radius, progress 0–1 of the wind-up, colour. Past DECAL_MAX discs a frame the rest are not drawn. */
  decal(x, z, r, progress, hex = '#ff3b3b') {
    const i = this.used; if (i >= DECAL_MAX || !this.rims) return false; this.used++;
    const p = Math.min(1, Math.max(0, progress)), c = this.tone_(hex), f = p > .001 ? r * p : .0001;
    m4.makeScale(r, 1, r).setPosition(x, .05, z); this.rims.setMatrixAt(i, m4); this.rims.setColorAt(i, c);
    m4.makeScale(f, 1, f).setPosition(x, .055, z); this.fills.setMatrixAt(i, m4); this.fills.setColorAt(i, c);
    return true;
  }
  end() {
    const n = this.used; if (!this.rims) return;
    for (const mesh of [this.rims, this.fills]) { if (!n && !mesh.count) continue; mesh.count = n; mesh.visible = n > 0; mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; }
  }
  /** Camera trauma (0–1): +0.2 a small hit, +0.5 a big one. A directional kick for single blows. */
  shake(amount) { if (!this.still) this.trauma = Math.min(1, this.trauma + amount); }
  kick(dx, dz, amount = .25) { if (!this.still) { this.kickX += dx * amount; this.kickZ += dz * amount; } }
  /** Hit-stop: the fight holds still for a moment (game time only; the camera and the HUD go on). */
  freeze(seconds) { this.frozen = Math.max(this.frozen, seconds); }
  clear() { this.used = 0; this.target.visible = false; this.trauma = this.kickX = this.kickZ = 0; this.frozen = 0; if (!this.chips) return; this.chips.count = this.sparks.count = 0; this.chips.mesh.count = this.sparks.mesh.count = 0; for (const r of this.ringData) r.live = false; for (const s of this.slashes) { s.life = 0; s.mesh.visible = false; } for (const t of this.texts) { t.life = 0; t.el.hidden = true; } this.end(); }
}
