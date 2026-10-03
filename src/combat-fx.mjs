// Pooled fight feedback, after Zoo Garden's effects (cute_game src/fx.ts, telegraph.ts, target-marker.ts, sfx.ts):
// chips and glowing sparks (one instanced draw each), shock rings (one instanced draw), slash arcs, danger discs on the
// ground, the red target ring and arrow, floating numbers, a camera shake and small synthesised sounds. Everything is
// made once and reused: a big hit costs the same draws as a small one, and nothing is created while a fight runs.
import * as T from 'three';
import { toon } from './toon.mjs';

const TAU = Math.PI * 2, UP = new T.Vector3(0, 1, 0);
const m4 = new T.Matrix4(), quat = new T.Quaternion(), scale = new T.Vector3(), pos = new T.Vector3(), color = new T.Color(), flat = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), -Math.PI / 2);
const between = (a, b) => a + Math.random() * (b - a);
export const TARGET_RED = '#ff4d5e';
/** Danger on the ground: a faint disc, a brighter one growing to full as the blow lands, an edge (the reference's TELEGRAPH_LOOK). */
const DECAL = { base: .2, fill: .45, edge: .85 };

let dot = null;
function softDot() {
  if (dot) return dot;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.25, 'rgba(255,255,255,.85)'); r.addColorStop(.6, 'rgba(255,255,255,.22)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64); return dot = new T.CanvasTexture(c);
}

/** Particles in flat arrays, drawn by one InstancedMesh. Glow particles face the camera and may fly home to a point. */
class Pool {
  constructor(max, glow) {
    this.max = max; this.glow = glow; this.count = 0;
    const material = glow ? new T.MeshBasicMaterial({ map: softDot(), transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false, fog: false }) : new T.MeshBasicMaterial({ toneMapped: false });
    this.mesh = new T.InstancedMesh(glow ? new T.PlaneGeometry(1, 1) : new T.IcosahedronGeometry(.5, 0), material, max);
    this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); this.mesh.setColorAt(0, color.set('#ffffff')); this.mesh.instanceColor.setUsage(T.DynamicDrawUsage);
    this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.castShadow = false; this.mesh.renderOrder = glow ? 6 : 0; this.mesh.raycast = () => {};
    this.p = new Float32Array(max * 3); this.v = new Float32Array(max * 3); this.life = new Float32Array(max); this.span = new Float32Array(max); this.size = new Float32Array(max);
    this.spin = new Float32Array(max); this.grav = new Float32Array(max); this.home = new Float32Array(max); this.arrive = new Array(max).fill(null);
  }
  emit(x, y, z, vx, vy, vz, life, size, hex, gravity = 12, homeAfter = 0, arrive = null) {
    let i = this.count; if (i >= this.max) i = Math.floor(Math.random() * this.max); else this.count++;
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z; this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    this.life[i] = this.span[i] = life; this.size[i] = size; this.spin[i] = between(-10, 10); this.grav[i] = gravity; this.home[i] = homeAfter; this.arrive[i] = arrive;
    this.mesh.setColorAt(i, color.set(hex));
  }
  update(dt, camera, target) {
    const { p, v, life, span, size } = this; let dirty = false;
    for (let i = this.count - 1; i >= 0; i--) {
      life[i] -= dt;
      const homing = this.home[i] > 0 && span[i] - life[i] > this.home[i] && target;
      if (homing) { // loot and coins fly to the player, faster the longer they are on their way
        const dx = target.x - p[i * 3], dy = 1 - p[i * 3 + 1], dz = target.z - p[i * 3 + 2], d = Math.sqrt(dx * dx + dy * dy + dz * dz), speed = 9 + (span[i] - life[i]) * 22;
        if (d < .45 || life[i] <= 0) { this.arrive[i]?.(); life[i] = 0; } else { p[i * 3] += dx / d * speed * dt; p[i * 3 + 1] += dy / d * speed * dt; p[i * 3 + 2] += dz / d * speed * dt; }
      }
      if (life[i] <= 0) { // the last particle takes this slot
        const last = --this.count;
        if (i !== last) { for (let k = 0; k < 3; k++) { p[i * 3 + k] = p[last * 3 + k]; v[i * 3 + k] = v[last * 3 + k]; } life[i] = life[last]; span[i] = span[last]; size[i] = size[last]; this.spin[i] = this.spin[last]; this.grav[i] = this.grav[last]; this.home[i] = this.home[last]; this.arrive[i] = this.arrive[last]; this.mesh.getColorAt(last, color); this.mesh.setColorAt(i, color); }
        dirty = true; continue;
      }
      if (!homing) {
        v[i * 3 + 1] -= this.grav[i] * dt; p[i * 3] += v[i * 3] * dt; p[i * 3 + 1] += v[i * 3 + 1] * dt; p[i * 3 + 2] += v[i * 3 + 2] * dt;
        if (p[i * 3 + 1] < .06 && this.grav[i] > 0) { p[i * 3 + 1] = .06; v[i * 3 + 1] *= -.35; v[i * 3] *= .6; v[i * 3 + 2] *= .6; }
      }
    }
    for (let i = 0; i < this.count; i++) {
      const k = life[i] / span[i], s = size[i] * (this.glow ? .4 + k * .8 : Math.min(1, k * 2.2));
      if (this.glow) quat.copy(camera.quaternion); else quat.setFromAxisAngle(UP, this.spin[i] * life[i]);
      m4.compose(pos.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]), quat, scale.set(s, s, s)); this.mesh.setMatrixAt(i, m4);
    }
    if (this.count || dirty || this.mesh.count) { this.mesh.count = this.count; this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true; }
    this.mesh.visible = this.count > 0;
  }
}

export class CombatFx {
  /** @param {HTMLElement} layer where floating numbers go. */
  constructor(layer) {
    this.root = new T.Group(); this.root.name = 'combat-fx'; this.layer = layer; this.trauma = 0; this.frozen = 0; this.kickX = 0; this.kickZ = 0; this.time = 0;
    this.still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.chips = new Pool(160, false); this.sparks = new Pool(120, true); this.root.add(this.chips.mesh, this.sparks.mesh);
    // Shock rings: additive, so fading is just a darker colour and all of them share one instanced draw.
    const ringGeo = new T.RingGeometry(.84, 1, 48); ringGeo.rotateX(-Math.PI / 2);
    this.rings = new T.InstancedMesh(ringGeo, new T.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, toneMapped: false, fog: false }), 24);
    this.rings.instanceMatrix.setUsage(T.DynamicDrawUsage); this.rings.setColorAt(0, color.set('#ffffff')); this.rings.frustumCulled = false; this.rings.count = 0; this.rings.renderOrder = 5; this.rings.raycast = () => {};
    this.ringData = Array.from({ length: 24 }, () => ({ live: false, x: 0, y: 0, z: 0, from: 0, to: 1, life: 0, span: 1, color: new T.Color() })); this.root.add(this.rings);
    // Slash arcs: a few partial rings, each with its own material so they can fade on their own.
    this.slashes = Array.from({ length: 4 }, () => { const mesh = new T.Mesh(new T.RingGeometry(.55, 1, 20, 1, -1.1, 2.2).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, toneMapped: false, fog: false })); mesh.visible = false; mesh.renderOrder = 6; mesh.raycast = () => {}; this.root.add(mesh); return { mesh, life: 0, span: .22 }; });
    // Danger discs (begin, decal…, end each frame).
    this.circle = new T.CircleGeometry(1, 40).rotateX(-Math.PI / 2); this.edge = new T.RingGeometry(.94, 1, 48).rotateX(-Math.PI / 2);
    this.decals = []; this.used = 0; this.looks = new Map();
    // The target: an open red ring under the creature you fight and a bobbing arrow over its head.
    this.target = new T.Group(); this.target.visible = false; this.target.name = 'target-marker';
    this.targetRing = new T.Mesh(new T.RingGeometry(.86, 1, 48, 1, 0, Math.PI * 1.7).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: TARGET_RED, transparent: true, opacity: .9, depthWrite: false, side: T.DoubleSide, toneMapped: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    this.targetRing.renderOrder = 7; this.targetRing.raycast = () => {};
    const head = new T.ConeGeometry(.26, .36, 6).rotateX(Math.PI).translate(0, .18, 0), shaft = new T.CylinderGeometry(.09, .09, .3, 6).translate(0, .5, 0);
    this.arrow = new T.Group(); for (const g of [head, shaft]) { const mesh = new T.Mesh(g, toon({ color: TARGET_RED, emissive: '#7a0a18', emissiveIntensity: .6 })); mesh.raycast = () => {}; this.arrow.add(mesh); }
    this.target.add(this.targetRing, this.arrow); this.root.add(this.target);
    // Floating numbers: a fixed set of labels, placed every frame from their world point.
    this.texts = Array.from({ length: 18 }, () => { const el = document.createElement('span'); el.className = 'float'; el.hidden = true; layer?.append(el); return { el, life: 0, span: .9, x: 0, y: 0, z: 0, side: 0 }; }); this.textFlip = 1;
    this.sound = true; this.ctx = null; this.out = null; this.noise = null; this.last = new Map();
  }
  look(hex) {
    let set = this.looks.get(hex);
    if (!set) { const make = (opacity, order) => new T.MeshBasicMaterial({ color: hex, transparent: true, opacity, depthWrite: false, side: T.DoubleSide, toneMapped: false, fog: false, polygonOffset: true, polygonOffsetFactor: -order, polygonOffsetUnits: -order }); set = { base: make(DECAL.base, 1), fill: make(DECAL.fill, 2), edge: make(DECAL.edge, 3) }; this.looks.set(hex, set); }
    return set;
  }
  begin() { this.used = 0; }
  /** A danger disc for this frame: centre, radius, progress 0–1 of the wind-up, colour. */
  decal(x, z, r, progress, hex = '#ff3b3b') {
    let d = this.decals[this.used];
    if (!d) { const group = new T.Group(), base = new T.Mesh(this.circle), fill = new T.Mesh(this.circle), edge = new T.Mesh(this.edge); [base, fill, edge].forEach((mesh, i) => { mesh.renderOrder = i + 1; mesh.raycast = () => {}; mesh.name = 'attack-telegraph'; group.add(mesh); }); d = { group, base, fill, edge }; this.decals.push(d); this.root.add(group); }
    this.used++;
    const look = this.look(hex), p = Math.min(1, Math.max(0, progress));
    d.base.material = look.base; d.fill.material = look.fill; d.edge.material = look.edge; d.group.visible = true; d.group.position.set(x, .05, z);
    d.base.scale.setScalar(r); d.edge.scale.setScalar(r); d.fill.visible = p > .001; d.fill.scale.setScalar(Math.max(.001, r * p)); d.fill.position.y = .005; d.edge.position.y = .01;
  }
  end() { for (let i = this.used; i < this.decals.length; i++) this.decals[i].group.visible = false; }

  burst(x, y, z, n = 10, hex = '#ffffff', speed = 5, up = 4, size = .12, life = .8, glow = false) {
    const pool = glow ? this.sparks : this.chips, list = Array.isArray(hex) ? hex : null;
    for (let i = 0; i < n; i++) { const a = Math.random() * TAU, s = between(.35, 1) * speed; pool.emit(x, y, z, Math.cos(a) * s, between(.4, 1) * up, Math.sin(a) * s, life * between(.7, 1.2), size * between(.7, 1.4) * (glow ? 2.6 : 1), list ? list[i % list.length] : hex, glow ? 0 : 12); }
  }
  /** Glowing orbs pop out of a point, then fly to the player (coins). `arrive` runs as each one lands. */
  orbs(x, z, n, hex, arrive) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU; this.sparks.emit(x, .8, z, Math.cos(a) * between(2, 4), between(4, 7), Math.sin(a) * between(2, 4), 2.2, .5, hex, 9, .28 + i * .04, arrive); } }
  ring(x, z, to = 4, hex = '#ffffff', life = .5, from = .3, y = .08) {
    let r = this.ringData.find(r => !r.live); if (!r) { r = this.ringData[0]; for (const o of this.ringData) if (o.life < r.life) r = o; }
    r.live = true; r.x = x; r.y = y; r.z = z; r.from = from; r.to = to; r.life = r.span = life; r.color.set(hex);
  }
  /** The swoosh of a swing: a partial ring in front of the attacker. */
  slash(x, z, facing, radius = 2.2, hex = '#ffffff', y = .9) {
    let s = this.slashes.find(s => s.life <= 0) ?? this.slashes[0];
    s.life = s.span = .22; s.mesh.visible = true; s.mesh.position.set(x, y, z); s.mesh.rotation.y = facing - Math.PI / 2; s.mesh.scale.setScalar(radius); s.mesh.material.color.set(hex);
  }
  /** Floating text over a world point. Styles: dmg, crit, hurt, heal, coin, item, alert. */
  text(x, y, z, message, style = 'dmg') {
    let t = this.texts.find(t => t.life <= 0); if (!t) { t = this.texts[0]; for (const o of this.texts) if (o.life < t.life) t = o; }
    this.textFlip = -this.textFlip; t.x = x; t.y = y; t.z = z; t.side = this.textFlip * between(.1, .3); t.life = t.span = style === 'alert' ? .7 : style === 'item' || style === 'coin' ? 1.2 : .9;
    t.el.textContent = message; t.el.className = 'float ' + style; t.el.hidden = false;
  }
  /** Camera trauma (0–1): +0.2 a small hit, +0.5 a big one. A directional kick for single blows. */
  shake(amount) { if (!this.still) this.trauma = Math.min(1, this.trauma + amount); }
  kick(dx, dz, amount = .25) { if (!this.still) { this.kickX += dx * amount; this.kickZ += dz * amount; } }
  /** Hit-stop: the fight holds still for a moment (game time only; the camera and the HUD go on). */
  freeze(seconds) { this.frozen = Math.max(this.frozen, seconds); }
  marker(dt, x, z, footprint, height) {
    this.target.visible = true; const r = footprint * (1 + Math.sin(this.time * 6) * .06);
    this.targetRing.position.set(x, .07, z); this.targetRing.scale.setScalar(r); this.targetRing.rotation.y += dt;
    this.arrow.position.set(x, height + .35 + Math.abs(Math.sin(this.time * 4)) * .35, z); this.arrow.rotation.y = this.time * 2.5;
  }
  /** Every frame: moves the pools, fades arcs and rings, places the floating numbers and shakes the camera. */
  update(dt, camera, target, width, height) {
    this.time += dt; this.chips.update(dt, camera, target); this.sparks.update(dt, camera, target);
    let n = 0;
    for (let i = 0; i < this.ringData.length; i++) {
      const r = this.ringData[i]; if (!r.live) continue; r.life -= dt; if (r.life <= 0) { r.live = false; continue; }
      const k = 1 - r.life / r.span, s = r.from + (r.to - r.from) * (1 - (1 - k) * (1 - k));
      m4.compose(pos.set(r.x, r.y, r.z), quat.identity(), scale.set(s, 1, s)); this.rings.setMatrixAt(n, m4); this.rings.setColorAt(n, color.copy(r.color).multiplyScalar(1 - k)); n++;
    }
    if (n || this.rings.count) { this.rings.count = n; this.rings.instanceMatrix.needsUpdate = true; this.rings.instanceColor.needsUpdate = true; } this.rings.visible = n > 0;
    for (let i = 0; i < this.slashes.length; i++) { const s = this.slashes[i]; if (s.life <= 0) continue; s.life -= dt; const k = Math.max(0, s.life / s.span); s.mesh.material.opacity = k * .9; s.mesh.rotation.y -= dt * 7; s.mesh.visible = s.life > 0; }
    for (let i = 0; i < this.texts.length; i++) {
      const t = this.texts[i]; if (t.life <= 0) continue; t.life -= dt; if (t.life <= 0) { t.el.hidden = true; continue; }
      const k = 1 - t.life / t.span; pos.set(t.x, t.y + .5 + k * 1.3, t.z).project(camera);
      const pop = k < .15 ? .6 + k / .15 * .6 : 1.2 - Math.min(1, (k - .15) / .2) * .2;
      t.el.style.transform = `translate(${((pos.x + 1) * width / 2 + t.side * 90).toFixed(1)}px,${((1 - pos.y) * height / 2).toFixed(1)}px) translate(-50%,-50%) scale(${pop.toFixed(2)})`; t.el.style.opacity = k > .7 ? ((1 - k) / .3).toFixed(2) : '1';
    }
    // Shake: trauma squared, decaying within a second; the kick eases back quickly. Added after the camera has followed the player.
    if (this.trauma > 0 || Math.abs(this.kickX) > .001 || Math.abs(this.kickZ) > .001) {
      const power = this.trauma * this.trauma * .5, t = this.time * 38; camera.position.x += Math.sin(t) * power + this.kickX; camera.position.z += Math.cos(t * 1.31) * power + this.kickZ; camera.position.y += Math.sin(t * .77) * power * .5;
      this.trauma = Math.max(0, this.trauma - dt * 1.4); const ease = Math.max(0, 1 - dt * 14); this.kickX *= ease; this.kickZ *= ease; camera.updateMatrixWorld();
    }
  }
  clear() { this.chips.count = this.sparks.count = 0; this.chips.mesh.count = this.sparks.mesh.count = 0; for (const r of this.ringData) r.live = false; for (const s of this.slashes) { s.life = 0; s.mesh.visible = false; } for (const t of this.texts) { t.life = 0; t.el.hidden = true; } this.used = 0; this.end(); this.target.visible = false; this.trauma = this.kickX = this.kickZ = 0; this.frozen = 0; }

  // ---- little sounds (WebAudio, nothing to download)
  audio() {
    if (!this.sound) return null;
    try {
      this.ctx ??= new AudioContext(); if (this.ctx.state === 'suspended') this.ctx.resume();
      if (!this.out) { this.out = this.ctx.createGain(); this.out.gain.value = .5; this.out.connect(this.ctx.destination); }
      if (!this.noise) { this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate); const data = this.noise.getChannelData(0); let seed = 7; for (let i = 0; i < data.length; i++) { seed = (seed * 16807) % 2147483647; data[i] = seed / 1073741823.5 - 1; } }
      return this.ctx;
    } catch { return null; }
  }
  tone(ctx, at, type, from, to, length, volume) { const osc = ctx.createOscillator(), gain = ctx.createGain(); osc.type = type; osc.frequency.setValueAtTime(from, at); osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), at + length); gain.gain.setValueAtTime(volume, at); gain.gain.exponentialRampToValueAtTime(.0008, at + length); osc.connect(gain); gain.connect(this.out); osc.start(at); osc.stop(at + length + .02); }
  hiss(ctx, at, filter, from, to, length, volume, q = 1) { const src = ctx.createBufferSource(), band = ctx.createBiquadFilter(), gain = ctx.createGain(); src.buffer = this.noise; band.type = filter; band.Q.value = q; band.frequency.setValueAtTime(from, at); band.frequency.exponentialRampToValueAtTime(Math.max(40, to), at + length); gain.gain.setValueAtTime(volume, at); gain.gain.exponentialRampToValueAtTime(.0008, at + length); src.connect(band); band.connect(gain); gain.connect(this.out); src.start(at, Math.random() * .5); src.stop(at + length + .02); }
  /** punch swing shoot hit crit hurt poof coin boom alert pickup whirl ready */
  play(sound) {
    const ctx = this.audio(); if (!ctx) return;
    const now = ctx.currentTime, previous = this.last.get(sound) ?? -1; if (now - previous < (sound === 'hit' || sound === 'coin' ? .045 : .02)) return; this.last.set(sound, now);
    const t = now + .005, pitch = between(.95, 1.05); // a little pitch spread, so a repeated sound never rings the same
    switch (sound) {
      case 'punch': case 'swing': this.hiss(ctx, t, 'bandpass', (sound === 'swing' ? 2200 : 1400) * pitch, 380, .11, .16, 1.4); break;
      case 'whirl': this.hiss(ctx, t, 'bandpass', 700 * pitch, 2600, .32, .14, 1.8); break;
      case 'shoot': this.tone(ctx, t, 'sine', 900 * pitch, 280, .1, .08); break;
      case 'hit': this.hiss(ctx, t, 'lowpass', 2400 * pitch, 300, .07, .22); this.tone(ctx, t, 'triangle', 190 * pitch, 80, .1, .2); break;
      case 'crit': this.hiss(ctx, t, 'lowpass', 3200, 400, .09, .26); this.tone(ctx, t, 'triangle', 220, 70, .14, .24); this.tone(ctx, t + .02, 'sine', 1200, 2100, .16, .07); break;
      case 'hurt': this.tone(ctx, t, 'square', 260 * pitch, 120, .14, .05); this.hiss(ctx, t, 'lowpass', 900, 200, .12, .12); break;
      case 'poof': this.hiss(ctx, t, 'lowpass', 1800, 200, .25, .2); this.tone(ctx, t, 'sine', 520 * pitch, 180, .18, .06); break;
      case 'coin': this.tone(ctx, t, 'square', 1320, 1320, .05, .022); this.tone(ctx, t + .05, 'square', 1760, 1760, .09, .022); break;
      case 'pickup': this.tone(ctx, t, 'sine', 420 * pitch, 980, .09, .08); break;
      case 'boom': this.tone(ctx, t, 'sine', 140, 40, .32, .3); this.hiss(ctx, t, 'lowpass', 1200, 120, .3, .24); break;
      case 'alert': this.tone(ctx, t, 'square', 660, 990, .07, .03); this.tone(ctx, t + .07, 'square', 990, 1320, .08, .026); break;
      case 'ready': this.tone(ctx, t, 'sine', 880, 1320, .09, .03); break;
    }
  }
}
