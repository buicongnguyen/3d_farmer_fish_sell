// The family pond's living water, the rules only (no three.js: tests/pond-life.test.mjs runs them in Node).
// Ported from the user's cute_game (Zoo Garden): fishing-view.ts updateFish / drawSuitor / updateFight / land (the swim, the turn,
// the depth bob, the tail, the flee, the suitor and the thrash), its Effects.burst / Effects.ring (fx.ts ParticlePool, ring) as
// flat-array pools, and its ambient ripples. The reference's pond is round, Willowmere's is a rectangle: only inside() differs.
// The fish are the ones the pond can catch (FISH_POOLS in pond.mjs); the outcome of a bite stays in fishing.mjs, this only shows it.
import { POND } from './content.mjs';
import { hyp } from './hyp.mjs';

export const SURFACE = .3;
/** Display length in metres (the camera is orthographic and far, so a little bigger than Zoo's), and the tail swing in radians. */
export const FISH_LOOK = { perch: { len: 1.1, wag: .6 }, carp: { len: 1.3, wag: .6 }, koi: { len: 1.4, wag: .6 }, catfish: { len: 1.6, wag: .6 }, rainbow: { len: 1.1, wag: .6 }, golden: { len: 1.2, wag: .6 }, clown: { len: 1, wag: .6 }, puffer: { len: 1, wag: .35 }, sunfish: { len: 1.25, wag: .45 }, eel: { len: 1.5, wag: .8 }, guardian: { len: 1.8, wag: .6 }, icepike: { len: 1.4, wag: .6 }, angler: { len: 1.2, wag: .5 } };
export const RESTOCK = 3;
const TAU = Math.PI * 2;
export function mulberry32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** Turn `from` toward `to` by `amount` (0..1) of the way round the short side (Zoo's turn()). */
export const turn = (from, to, amount) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * Math.min(1, amount);
export const inside = (x, z, margin = .8, pond = POND) => Math.abs(x - pond.x) <= pond.w / 2 - margin && Math.abs(z - pond.z) <= pond.d / 2 - margin;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Pooled spray: flat arrays, nothing allocated per frame. `kill` is a height below which a falling spark is gone (it hit the water). */
export class Sparks {
  constructor(max, { kill = -1, rng = Math.random } = {}) {
    this.max = max; this.count = 0; this.kill = kill; this.rng = rng;
    this.p = new Float32Array(max * 3); this.v = new Float32Array(max * 3); this.c = new Float32Array(max * 3);
    this.life = new Float32Array(max); this.span = new Float32Array(max); this.size = new Float32Array(max); this.grav = new Float32Array(max); this.rise = new Uint8Array(max);
    this.done = null;
  }
  emit(x, y, z, vx, vy, vz, life, size, r = 1, g = 1, b = 1, gravity = 12) {
    let i = this.count; if (i >= this.max) i = Math.floor(this.rng() * this.max); else this.count++;
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z; this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    this.c[i * 3] = r; this.c[i * 3 + 1] = g; this.c[i * 3 + 2] = b; this.life[i] = this.span[i] = life; this.size[i] = size; this.grav[i] = gravity; this.rise[i] = 0; return i;
  }
  /** Zoo's Effects.burst for glow sparks: white and pale blue, flung out and up, then pulled down by gravity. */
  burst(x, y, z, n, speed = 2, up = 3, size = .07, life = .55) {
    for (let k = 0; k < n; k++) { const a = this.rng() * TAU, s = speed * (.35 + this.rng() * .65), blue = k % 2;
      this.emit(x, y, z, Math.cos(a) * s, up * (.5 + this.rng() * .5), Math.sin(a) * s, life * (.7 + this.rng() * .5), size * (.7 + this.rng() * .6), blue ? .75 : 1, blue ? .92 : 1, 1, 12); }
  }
  /** A bubble: rises at `rise` m/s with a little sway, then pops (done(x,y,z) is told). */
  bubble(x, y, z, rise = .35, life = .7, size = .09) { this.rise[this.emit(x, y, z, (this.rng() - .5) * .12, rise, (this.rng() - .5) * .12, life, size * (.7 + this.rng() * .6), .9, 1, 1, 0)] = 1; }
  remove(i) {
    const last = --this.count; if (i === last) return;
    for (let k = 0; k < 3; k++) { this.p[i * 3 + k] = this.p[last * 3 + k]; this.v[i * 3 + k] = this.v[last * 3 + k]; this.c[i * 3 + k] = this.c[last * 3 + k]; }
    this.life[i] = this.life[last]; this.span[i] = this.span[last]; this.size[i] = this.size[last]; this.grav[i] = this.grav[last]; this.rise[i] = this.rise[last];
  }
  update(dt) {
    for (let i = 0; i < this.count; i++) {
      this.v[i * 3 + 1] -= this.grav[i] * dt; this.life[i] -= dt;
      this.p[i * 3] += this.v[i * 3] * dt; this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt; this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
      if (this.life[i] <= 0 || (this.kill > 0 && this.v[i * 3 + 1] < 0 && this.p[i * 3 + 1] < this.kill)) { if (this.done && this.rise[i]) this.done(this.p[i * 3], this.p[i * 3 + 1], this.p[i * 3 + 2]); this.remove(i--); }
    }
  }
  clear() { this.count = 0; }
}

/** Pooled rings on the surface: expand from `from` to `to` metres over `life` seconds while they fade. */
export class Rings {
  constructor(max) { this.max = max; this.count = 0; this.x = new Float32Array(max); this.z = new Float32Array(max); this.from = new Float32Array(max); this.to = new Float32Array(max); this.life = new Float32Array(max); this.span = new Float32Array(max); this.opacity = new Float32Array(max); }
  add(x, z, from, to, life, opacity = .8) {
    let i = this.count; if (i >= this.max) { i = 0; for (let k = 1; k < this.count; k++) if (this.life[k] < this.life[i]) i = k; } else this.count++;
    this.x[i] = x; this.z[i] = z; this.from[i] = from; this.to[i] = to; this.life[i] = this.span[i] = life; this.opacity[i] = opacity;
  }
  update(dt) {
    for (let i = 0; i < this.count; i++) { this.life[i] -= dt; if (this.life[i] > 0) continue; const l = --this.count; if (i !== l) { this.x[i] = this.x[l]; this.z[i] = this.z[l]; this.from[i] = this.from[l]; this.to[i] = this.to[l]; this.life[i] = this.life[l]; this.span[i] = this.span[l]; this.opacity[i] = this.opacity[l]; } i--; }
  }
  radius(i) { const k = 1 - this.life[i] / this.span[i]; return this.from[i] + (this.to[i] - this.from[i]) * k; }
  alpha(i) { return this.opacity[i] * this.life[i] / this.span[i]; }
  clear() { this.count = 0; }
}

/** The pond effects the school and the rod ask for, with Zoo's numbers. `light` (a phone) keeps fewer of everything. */
export class PondFx {
  constructor({ rng = Math.random, light = false } = {}) {
    this.rng = rng; this.rings = new Rings(8); this.sparks = new Sparks(96, { kill: SURFACE, rng }); this.bubbles = new Sparks(24, { rng }); this.setLight(light);
    this.bubbles.done = (x, y, z) => this.ring(x, z, .05, .3, .25, .35); this.shakes = 0;
  }
  /** A phone, or a governor step below the top, keeps fewer of everything: the pools stay as built, only their caps move. */
  setLight(light) { this.light = light; this.rings.max = light ? 4 : 8; this.sparks.max = light ? 48 : 96; this.bubbles.max = light ? 8 : 24; for (const p of [this.rings, this.sparks, this.bubbles]) p.count = Math.min(p.count, p.max); }
  ring(x, z, from, to, life, opacity = .8) { this.rings.add(x, z, from, to, life, opacity); }
  burst(x, z, n, speed, up, size) { this.sparks.burst(x, SURFACE + .02, z, n, speed, up, size); }
  spark(x, z, size = .06, speed = 1.5, up = 2) { this.sparks.burst(x, SURFACE + .02, z, 1, speed, up, size, .5); }
  bubble(x, y, z) { if (this.bubbles.max) this.bubbles.bubble(x, y, z); }
  shake(a) { this.shakes += a; }
  update(dt) { this.rings.update(dt); this.sparks.update(dt); this.bubbles.update(dt); }
  clear() { this.rings.clear(); this.sparks.clear(); this.bubbles.clear(); }
  get active() { return this.rings.count + this.sparks.count + this.bubbles.count; }
}

/** The swimmers. `pool` is the species the pond can catch at this tier; `n` how many swim. */
export class School {
  constructor(pool, n, { rng = mulberry32(7), fx = new PondFx({ rng }), pond = POND } = {}) {
    this.pool = pool; this.n = n; this.rng = rng; this.fx = fx; this.pond = pond; this.fish = []; this.suitor = null; this.pending = []; this.t = 0; this.ids = 0; this.ambient = 2;
    for (let i = 0; i < n; i++) this.add(pool[i % pool.length]);
  }
  between(a, b) { return a + this.rng() * (b - a); }
  /** Change the quality budget without replacing a hooked fish, a landing arc or the remaining swimmers. */
  resize(n) {
    this.n = n;
    while (this.fish.length > n) {
      let remove = -1;
      for (let i = this.fish.length - 1; i >= 0; i--) {
        const f = this.fish[i]; if (f.mode !== 'swim' && f.mode !== 'flee') continue;
        if (remove < 0) remove = i;
        if (this.count(f.species) > 1) { remove = i; break; }
      }
      if (remove < 0) break; // Only active bites/landing arcs may temporarily exceed the budget.
      this.fish.splice(remove, 1);
    }
    while (this.fish.length + this.pending.length < n) {
      let pick = this.pool[0], least = Infinity;
      for (const species of this.pool) { const count = this.count(species); if (count < least) { least = count; pick = species; } }
      this.add(pick, true);
    }
  }
  /** A new fish: inside the water, or (fromEdge) entering at the rim like Zoo's restocked fish. */
  add(species, fromEdge = false) {
    const p = this.pond, f = { id: ++this.ids, species, x: 0, z: 0, y: 0, h: this.rng() * TAU, sp: this.between(.5, 1.1), gx: 0, gz: 0, gt: 0, wig: this.rng() * TAU, mode: 'swim', t: this.rng() * 20, tail: 0, rz: 0, rx: 0, fleeT: 0, fleeSp: 3.2, ang: 0, lt: 0, from: null, to: null, last: 0 };
    if (fromEdge) { const side = this.rng() < .5 ? -1 : 1; f.x = p.x + side * (p.w / 2 - .85); f.z = p.z + this.between(-1, 1) * (p.d / 2 - 1); f.h = side < 0 ? Math.PI / 2 : -Math.PI / 2; }
    else { f.x = p.x + this.between(-1, 1) * (p.w / 2 - 1.2); f.z = p.z + this.between(-1, 1) * (p.d / 2 - 1.2); }
    this.goal(f); this.fish.push(f); return f;
  }
  /** A new goal inside the pond, away from the float and from where you stand. */
  goal(f, ctx = this) {
    const p = this.pond;
    for (let k = 0; k < 8; k++) {
      const gx = p.x + this.between(-1, 1) * (p.w / 2 - .9), gz = p.z + this.between(-1, 1) * (p.d / 2 - .9);
      f.gx = gx; f.gz = gz;
      if (ctx.float && hyp(gx - ctx.float.x, gz - ctx.float.z) < 2) continue;
      if (ctx.player && hyp(gx - ctx.player.x, gz - ctx.player.z) < 2.2) continue;
      break;
    }
    f.gt = 8; f.sp = this.between(.5, 1.1);
  }
  /** Away from a point: a goal on the far side of the pond from (x, z). */
  awayGoal(f, x, z) {
    const p = this.pond, a = Math.atan2(f.x - x, f.z - z) + this.between(-.5, .5);
    f.gx = clamp(f.x + Math.sin(a) * 3.5, p.x - p.w / 2 + .9, p.x + p.w / 2 - .9); f.gz = clamp(f.z + Math.cos(a) * 3.5, p.z - p.d / 2 + .9, p.z + p.d / 2 - .9); f.gt = 2.5;
  }
  count(species) { let n = 0; for (let i = 0; i < this.fish.length; i++) if (this.fish[i].species === species && this.fish[i].mode !== 'land') n++; return n; }
  get light() { return this.fx.light; }
  get swimmers() { return this.fish.filter(f => f.mode === 'swim' || f.mode === 'flee'); }
  /** The fish that will take the float: the nearest swimmer of the species (one enters from the rim if none swims). Returns its distance. */
  choose(species, float) {
    let best = null, bd = 1e9;
    for (const f of this.fish) if (f.species === species && f.mode === 'swim') { const d = hyp(f.x - float.x, f.z - float.z); if (d < bd) { bd = d; best = f; } }
    if (!best) { best = this.add(species, true); best.temp = true; bd = hyp(best.x - float.x, best.z - float.z); }
    best.mode = 'suitor'; best.ang = Math.atan2(best.z - float.z, best.x - float.x); this.suitor = best; return clamp(bd, 1.1, 4.5);
  }
  flee(f, speed = 3.2, from = null) { if (!f || f.mode === 'land') return; f.mode = 'flee'; f.fleeT = 1.4; f.fleeSp = speed; f.rz = 0; f.rx = 0; if (from) this.awayGoal(f, from.x, from.z); if (this.suitor === f) this.suitor = null; }
  /** The suitor, as the simulation shows it (fishing.mjs phases): swims in, holds off, darts at each nibble, grabs at the bite, thrashes while hooked. */
  drive(dt, s, float, player) {
    const f = this.suitor; if (!f) return; const t = this.t, wag = FISH_LOOK[f.species]?.wag ?? .5, dx = float.x - f.x, dz = float.z - f.z;
    f.rz += (0 - f.rz) * Math.min(1, dt * 6); f.y += (0 - f.y) * Math.min(1, dt * 8); f.rx = 0;
    if (s.phase === 'approach' || s.phase === 'nibble') {
      const d = s.phase === 'approach' ? Math.max(s.fishDistance, .55) : .5 - Math.sin(Math.max(0, s.dart) / .3 * Math.PI) * .32;
      const tx = float.x + Math.cos(f.ang) * d, tz = float.z + Math.sin(f.ang) * d, gap = hyp(tx - f.x, tz - f.z);
      f.h = turn(f.h, Math.atan2(s.phase === 'nibble' && gap < .6 ? dx : tx - f.x, s.phase === 'nibble' && gap < .6 ? dz : tz - f.z), dt * 4);
      const sp = gap > .08 ? Math.min(2.2, .5 + gap * 2.2) : 0;
      if (s.phase === 'nibble') { const k = Math.min(1, dt * 9); f.x += (tx - f.x) * k; f.z += (tz - f.z) * k; } else { f.x += Math.sin(f.h) * sp * dt; f.z += Math.cos(f.h) * sp * dt; }
      f.tail = Math.sin(t * (s.phase === 'approach' ? 9 : 14) + f.wig) * wag;
    } else if (s.phase === 'bite') {
      const k = Math.min(1, dt * 10), hx = float.x - Math.sin(f.h) * .12, hz = float.z - Math.cos(f.h) * .12;
      f.x += (hx - f.x) * k; f.z += (hz - f.z) * k; f.h += Math.sin(t * 20) * dt * 3; f.tail = Math.sin(t * 22) * wag; f.rz = Math.sin(t * 15) * .15;
    } else if (s.phase === 'hooked') {
      const surging = s.surge > 0, away = Math.atan2(float.x - player.x, float.z - player.z), side = Math.sin(t * (surging ? 14 : 6)) * (surging ? .55 : .2);
      const tx = float.x - Math.sin(away) * .35 + Math.cos(away) * side, tz = float.z - Math.cos(away) * .35 - Math.sin(away) * side, k = Math.min(1, dt * 6);
      f.x += (tx - f.x) * k; f.z += (tz - f.z) * k; f.h = away + Math.sin(t * 12) * .5; f.rz = Math.sin(t * 18) * .4;
      f.y = surging ? Math.abs(Math.sin(t * 9)) * .3 : f.y; f.tail = Math.sin(t * 26) * Math.min(.6, wag * 1.2);
      if (this.fx.bubbles.max && this.rng() < dt * (surging ? 9 : 6)) this.fx.bubble(f.x, SURFACE - .1, f.z);
      if (surging) { if (this.rng() < dt * 30) this.fx.spark(f.x, f.z, .09, 2.5, 4); if (this.rng() < dt * 4) this.fx.ring(f.x, f.z, .3, 1, .4, .6); } else if (this.rng() < dt * 8) this.fx.spark(f.x, f.z, .06, 1, 2);
    }
    if (s.phase === 'bite') { if (this.rng() < dt * 25) this.fx.spark(float.x, float.z, .06, 1.5, 2); if (this.fx.bubbles.max && this.rng() < dt * 3) this.fx.bubble(f.x, SURFACE - .1, f.z); }
  }
  /** Fish leap to the player: 0.65 s arc, 2.2 m high, spinning (fishing-view land()). `to` is where the arms are (x, z, and a height). */
  land(species, from, to) {
    let f = this.suitor && this.suitor.species === species ? this.suitor : null; this.suitor = null;
    if (!f) { f = this.add(species); f.x = from.x; f.z = from.z; }
    f.mode = 'land'; f.lt = 0; f.from = { x: f.x, z: f.z }; f.to = { x: to.x, z: to.z, y: to.y ?? 1.2 }; f.rx = 0; f.rz = 0;
    this.fx.ring(f.x, f.z, .3, 2, .5, .7); this.fx.burst(f.x, f.z, 20, 5, 7, .09);
    return f;
  }
  update(dt, ctx = {}) {
    this.t += dt; const { float = null, player = null } = ctx, p = this.pond, fish = this.fish;
    this.float = float; this.player = player;
    for (let i = fish.length - 1; i >= 0; i--) {
      const f = fish[i], wag = FISH_LOOK[f.species]?.wag ?? .5; f.t += dt; f.last = 0;
      if (f.mode === 'land') {
        f.lt += dt; const k = Math.min(1, f.lt / .65); f.x = f.from.x + (f.to.x - f.from.x) * k; f.z = f.from.z + (f.to.z - f.from.z) * k; f.y = f.to.y * k + Math.sin(k * Math.PI) * 2.2; f.rx += dt * 9; f.h += dt * 5; f.tail = Math.sin(f.t * 26) * wag;
        if (k >= 1) { fish.splice(i, 1); f.done = true; this.pending.push(RESTOCK); }
        continue;
      }
      if (f.mode === 'suitor') continue;
      const fleeing = f.mode === 'flee';
      if (fleeing) { f.fleeT -= dt; if (f.fleeT <= 0) { f.mode = 'swim'; this.goal(f, this); if (f.temp && fish.length > this.n) { fish.splice(i, 1); continue; } } }
      else {
        if (float && hyp(f.x - float.x, f.z - float.z) < 1.3) this.awayGoal(f, float.x, float.z);
        if (player && hyp(f.x - player.x, f.z - player.z) < 2) this.awayGoal(f, player.x, player.z);
      }
      f.gt -= dt; if (!fleeing && (hyp(f.gx - f.x, f.gz - f.z) < .3 || f.gt <= 0)) this.goal(f, this);
      const sp = fleeing ? f.fleeSp : f.sp, bearing = Math.atan2(f.gx - f.x, f.gz - f.z); f.h = turn(f.h, bearing, dt * (fleeing ? 6 : 3));
      const ox = f.x, oz = f.z; f.x += Math.sin(f.h) * sp * dt; f.z += Math.cos(f.h) * sp * dt;
      const m = .55; f.x = clamp(f.x, p.x - p.w / 2 + m, p.x + p.w / 2 - m); f.z = clamp(f.z, p.z - p.d / 2 + m, p.z + p.d / 2 - m);
      if (f.x !== ox + Math.sin(f.h) * sp * dt || f.z !== oz + Math.cos(f.h) * sp * dt) { if (!fleeing) this.goal(f, this); else this.awayGoal(f, f.x - Math.sin(f.h), f.z - Math.cos(f.h)); }
      f.y = Math.sin(f.t * 1.3 + f.wig) * .012; f.tail = Math.sin(f.t * (fleeing ? 22 : 9) + f.wig) * wag; f.rz += (0 - f.rz) * Math.min(1, dt * 6);
    }
    // Two fish never share a spot: a gentle push apart.
    for (let i = 0; i < fish.length; i++) for (let j = i + 1; j < fish.length; j++) {
      const a = fish[i], b = fish[j]; if (a.mode === 'land' || b.mode === 'land' || a.mode === 'suitor' || b.mode === 'suitor') continue;
      const dx = b.x - a.x, dz = b.z - a.z, d = hyp(dx, dz);
      if (d < .55) { const push = (.55 - d) * Math.min(1, dt * 3) * .5, nx = d > .001 ? dx / d : 1, nz = d > .001 ? dz / d : 0; a.x -= nx * push; a.z -= nz * push; b.x += nx * push; b.z += nz * push; }
    }
    // Restock three seconds after a catch (Zoo's RESTOCK_AFTER_CATCH), entering from the rim.
    for (let i = this.pending.length - 1; i >= 0; i--) {
      this.pending[i] -= dt; if (this.pending[i] > 0) continue; this.pending.splice(i, 1); if (fish.length >= this.n) continue;
      let pick = this.pool[0], least = 1e9; for (let pi = 0; pi < this.pool.length; pi++) { const sp = this.pool[pi], c = this.count(sp); if (c < least) { least = c; pick = sp; } }
      this.add(pick, true);
    }
    // Ambient ripples: now and then one swimming fish nudges the surface (Zoo's ambientRipples).
    this.ambient -= dt;
    if (this.ambient <= 0) {
      let ns = 0; for (let i = 0; i < fish.length; i++) if (fish[i].mode === 'swim' || fish[i].mode === 'flee') ns++;
      this.ambient = Math.max(this.light ? 2.4 : 0, this.between(1.2, 3.2) / Math.max(1, this.n / 3));
      if (ns) { let k = Math.floor(this.rng() * ns); for (let i = 0; i < fish.length; i++) { const f = fish[i]; if ((f.mode === 'swim' || f.mode === 'flee') && k-- === 0) { this.fx.ring(f.x, f.z, .12, .7, 1.1, .25); break; } } }
    }
    this.fx.update(dt);
  }
  /** What the tests read. */
  get metrics() { return this.fish.map(f => ({ id: f.id, species: f.species, x: f.x, z: f.z, y: f.y, h: f.h, tail: f.tail, rz: f.rz, mode: f.mode })); }
}
