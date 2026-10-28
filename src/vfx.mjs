// Village and wilds VFX (the "add some vfx, don't make the game slow" round). Fetched with import() by outdoors.mjs after the
// village stands; nothing here is in the first-load bundle. main.mjs calls world.vfx?.(type, arg) after an action succeeds.
//
// ONE THREE.Points draw for everything, one ShaderMaterial (one program, compiled at install), motion in the vertex shader:
//   layer 0  the home ambience round the player: the season's petals / golden pollen / leaves / snow in the village and the home
//            regions (spores in the Mushroom Forest, wind dust in Redrock Canyon); off while the existing rain falls
//   layer 1  a land's own air (embers, snow flurries, bubbles, star motes, sugar sparkles, confetti, cloud fluff, jungle midges);
//            it fades in with world.landShare, the same 24 m crossfade as the land's light, and the home layer fades out
//   layer 2  fireflies at dusk (light cycle on, from 18:00) in the village and the home regions
//   layer 3  sun glints twinkling on the family pond (daytime, within 45 m of the pond)
//   layer 4  one-shot bursts written once at spawn into a ring of slots (origin, velocity, birth, life, kind): sparkles, droplets,
//            dust puffs, confetti, a soft ring, leaf bits. The shader moves and fades them from (time - birth); the CPU never
//            touches a live burst again.
// Ambient layers wrap their points in a 64 m box that follows the player and fade them out towards its rim (no pop at the edge);
// a layer with nothing to show writes alpha 0 and its points leave the screen in the vertex shader (no fragments). When every
// layer is empty and no burst is alive the Points object is hidden: 0 draws. Per frame the CPU sets a few uniforms; nothing is
// allocated. Density scales with the Graphics setting (high 1, balanced 0.6, battery 0.3), the governor's step (1, .75, .5, 0)
// and prefers-reduced-motion (the screen-filling layers 0 and 1 off, fireflies halved, bursts smaller, coins do not fly).
// Additive and normal points share the draw through premultiplied blending (an additive point writes alpha 0).
import * as T from 'three';
import { markRange } from './changed-buffers.mjs';
import { regionAt, REGION } from './regions.mjs';
import { calendar } from './game.mjs';
import { BED_POSITIONS, POND } from './content.mjs';
import { hyp } from './hyp.mjs';
import { VERT, FRAG } from './vfx-glsl.mjs';

const N = { home: 220, land: 220, glow: 90, pond: 40, burst: 192 }, BOX = 64, POND_Y = .33;
const P = (shape, add, fall, sway, spin, size, dx, dz, y0, y1, colors) => ({ shape, add, fall, sway, spin, size, dx, dz, y0, y1, colors });
// shape: 0 soft disc, 1 petal, 2 leaf, 3 glow, 4 bubble, 5 star sparkle, 6 confetti, 7 puff, 8 ring, 9 droplet
export const PRESETS = {
  petals: P(1, 0, .75, 1.1, 1.6, 0.62, .5, .15, 0, 9, ['#ff5fa2', '#ff8cc2', '#ffb3d4']),
  pollen: P(5, 1, -.05, .8, .5, 0.46, .25, .1, .3, 6, ['#ffe066', '#fff1b0', '#ffc94a']),
  leaves: P(2, 0, 1, 1.4, 2.2, 0.72, .8, .25, 0, 9, ['#ff8a2a', '#e8501f', '#ffc23a']),
  snow: P(0, 0, 1, .6, 0, 0.42, .3, 0, 0, 10, ['#ffffff', '#eaf6ff', '#ffffff']),
  fireflies: P(3, 1, -.06, .9, 0, 1.5, 0, 0, .3, 2.6, ['#fff08a', '#d8ff7a', '#ffd860']),
  spores: P(3, 1, -.25, .6, 0, 0.52, .1, 0, 0, 5, ['#8ff5dc', '#d39cff', '#c8ff8a']),
  dust: P(0, 0, .05, .9, 0, 0.3, 1.1, .25, .2, 5, ['#f8dcaa', '#ecc48a', '#fff0d0']),
  embers: P(3, 1, -1.3, .7, 0, 0.5, .3, .1, 0, 9, ['#ff7a1f', '#ffc65a', '#ff4a1a']),
  bubbles: P(4, 0, -.7, .35, 0, 0.6, 0, 0, 0, 4, ['#e8fbff', '#bdeeff', '#ffffff']),
  stars: P(5, 1, -.02, .25, .4, 0.56, .05, 0, 1, 9, ['#ffffff', '#c4c4ff', '#ffe9a8']),
  sugar: P(5, 1, .35, .6, .8, 0.46, .1, 0, 0, 8, ['#ffc6e6', '#ffffff', '#ff9fd0']),
  confetti: P(6, 0, .7, 1, 3, 0.5, .2, .1, 0, 9, ['#ff4f6a', '#3fa9ff', '#ffd23a']),
  fluff: P(7, 0, -.08, .5, .3, 1.4, .6, .1, 1, 7, ['#ffffff', '#f2f8ff', '#e6f2ff']),
  midges: P(3, 1, -.04, .7, 0, 0.42, 0, 0, .3, 3, ['#d8ff7a', '#9cff8a', '#fff08a']),
};
const SEASONS = ['petals', 'pollen', 'leaves', 'snow'];
const HOME_AIR = { west: 'spores', east: 'dust' }; // the village, Blue Lake Meadow and Chomper Swamp follow the season
const LAND_AIR = { lava: 'embers', ice: 'snow', ocean: 'bubbles', shadow: 'stars', candy: 'sugar', toy: 'confetti', cloud: 'fluff', jungle: 'midges' };
// Burst kinds (the shader's table): 0 spark, 1 droplet, 2 puff, 3 confetti, 4 ring, 5 leaf bit
export const KIND = { spark: 0, drop: 1, puff: 2, confetti: 3, ring: 4, leaf: 5 };

// A small seeded random (cosmetic only: gameplay's Math.random and seeds stay as they were).
let seed = 7;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
// Reused option records for the dust (spawned every few metres while running or driving: no allocation).
const DUST_RIDE = { spread: .6, up: .5, life: .75, size: 1.4, colors: null, jitter: .2 }, DUST_RUN = { spread: .5, up: .35, life: .55, size: .9, colors: null, jitter: .3 };
const DOOR = { spread: 1.6, up: .5, life: .7, size: 1.2, colors: ['#fff4e0', '#f2e2c4'], jitter: .25 };
const COLORS = new Map(), colorOf = hex => { let c = COLORS.get(hex); if (!c) COLORS.set(hex, c = new T.Color(hex)); return c; };
const QUALITY = { high: 1, balanced: .6, battery: .3 }, STEP = [1, .75, .5, 0];

export class Vfx {
  constructor(world) {
    this.world = world;
    const total = N.home + N.land + N.glow + N.pond + N.burst, pos = new Float32Array(total * 3), A = new Float32Array(total * 4), B = new Float32Array(total * 4), C = new Float32Array(total * 3);
    let i = 0;
    const layer = (l, n) => { for (let k = 0; k < n; k++, i++) { pos.set([rnd(), rnd(), rnd()], i * 3); A.set([rnd(), rnd(), rnd(), (k + .5) / n], i * 4); B.set([l, 0, 0, rnd()], i * 4); } };
    layer(0, N.home); layer(1, N.land); layer(2, N.glow);
    this.pondStart = i; layer(3, N.pond);
    for (let k = this.pondStart; k < i; k++) { pos[k * 3] = POND.x + (pos[k * 3] - .5) * (POND.w - 4); pos[k * 3 + 1] = POND_Y; pos[k * 3 + 2] = POND.z + (pos[k * 3 + 2] - .5) * (POND.d - 3.5); }
    this.burstStart = i; for (let k = 0; k < N.burst; k++, i++) { B[i * 4] = 4; A[i * 4 + 3] = -1e6; B[i * 4 + 2] = 1; }
    const g = this.geometry = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('aA', new T.BufferAttribute(A, 4)); g.setAttribute('aB', new T.BufferAttribute(B, 4)); g.setAttribute('aC', new T.BufferAttribute(C, 3));
    for (const k of ['position', 'aA', 'aB', 'aC']) g.getAttribute(k).setUsage(T.DynamicDrawUsage);
    g.boundingSphere = new T.Sphere(new T.Vector3(), 1e5);
    const v4 = () => [0, 1, 2, 3].map(() => new T.Vector4());
    this.u = { uTime: { value: 0 }, uScale: { value: 20 }, uMax: { value: 64 }, uBox: { value: BOX }, uCenter: { value: new T.Vector3() }, uP: { value: v4() }, uQ: { value: v4() }, uR: { value: v4() }, uCol: { value: Array.from({ length: 12 }, () => new T.Color()) } };
    this.material = new T.ShaderMaterial({ name: 'vfx-points', uniforms: this.u, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, depthTest: true, blending: T.CustomBlending, blendSrc: T.OneFactor, blendDst: T.OneMinusSrcAlphaFactor, blendSrcAlpha: T.OneFactor, blendDstAlpha: T.OneMinusSrcAlphaFactor, fog: false });
    const pts = this.points = new T.Points(g, this.material);
    pts.name = 'vfx'; pts.frustumCulled = false; pts.renderOrder = 6; pts.matrixAutoUpdate = false; pts.castShadow = pts.receiveShadow = false;
    world.scene.add(pts);
    // Layer state: the preset shown, the one wanted, the alpha now and wanted, the density.
    this.layers = [0, 1, 2, 3].map(() => ({ preset: null, want: null, alpha: 0, target: 0, density: 0 }));
    this.layers[2].preset = this.layers[2].want = 'fireflies'; this.setPreset(2, 'fireflies');
    this.setPreset(3, { shape: 5, add: 1, fall: 0, sway: 0, spin: 0, size: .75, dx: 0, dz: 0, y0: 0, y1: 1, colors: ['#ffffff', '#fff6c8', '#e8fbff'] });
    this.layers[3].preset = this.layers[3].want = 'glints';
    // Every field the frame reads is made here, so the object's shape never changes after install (V8 keeps the methods optimised).
    this.cursor = 0; this.home = 'village'; this.dustT = 0; this.wasIndoors = false; this.last = new T.Vector3(); this.ground = new Map();
    this.n = 0; this.m = 0; this.live = 0; this.moving = false; this.dustAt = 0; this.off = false; this.any = false; this.settled = false; this.h = -1; this.day = -1; this.rain = false; this.hooked = false; this.tap = null; this.tapAt = { x: 0, y: 0 }; this.coinEls = null;
    this.reduce = matchMedia?.('(prefers-reduced-motion: reduce)'); this.stats = { spawned: 0 };
    this.maxPoint = world.renderer.capabilities?.maxPointSize ?? 64;
    try { const gl = world.renderer.getContext(); this.maxPoint = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1]; } catch { /* keep 64 */ }
    // One program, compiled now (not on the first frame that shows a petal).
    pts.visible = true; try { world.renderer.compile(pts, world.camera, world.scene); } catch (e) { console.warn('vfx warm-up', e); } pts.visible = false;
  }
  setPreset(l, p) {
    const pre = typeof p === 'string' ? PRESETS[p] : p, u = this.u;
    u.uP.value[l].set(pre.fall, pre.sway, pre.spin, pre.size); u.uQ.value[l].set(pre.dx, pre.dz, pre.y0, pre.y1);
    u.uR.value[l].z = pre.shape; u.uR.value[l].w = pre.add;
    for (let k = 0; k < 3; k++) u.uCol.value[l * 3 + k].set(pre.colors[k]);
  }
  /** How many of a burst a setting allows. */
  scale() { const w = this.world, q = QUALITY[w.state.settings.quality] ?? .6, step = w.step ?? 0; return (q === .3 ? .5 : 1) * (step >= 3 ? .4 : step >= 2 ? .6 : 1) * (this.reduce?.matches ? .5 : 1); }
  /** Write n burst points from (x, y, z): velocities spread by `spread` round `up`, colours from `colors`. birth = now + delay. */
  spawn(kind, x, y, z, n, { spread = 2, up = 3, life = .9, size = .3, colors = ['#ffe27a'], delay = 0, jitter = .25 } = {}) {
    n = Math.max(1, Math.round(n * this.scale()));
    const g = this.geometry, P = g.getAttribute('position'), A = g.getAttribute('aA'), B = g.getAttribute('aB'), C = g.getAttribute('aC'), t = this.world.t + delay, first = this.cursor;
    for (let k = 0; k < n; k++) {
      const i = this.burstStart + this.cursor, a = rnd() * 6.2832, sp = spread * (.35 + .65 * rnd());
      P.array[i * 3] = x + (rnd() - .5) * jitter; P.array[i * 3 + 1] = y; P.array[i * 3 + 2] = z + (rnd() - .5) * jitter;
      A.array[i * 4] = Math.cos(a) * sp; A.array[i * 4 + 1] = up * (.6 + .6 * rnd()); A.array[i * 4 + 2] = Math.sin(a) * sp; A.array[i * 4 + 3] = t + rnd() * .04;
      B.array[i * 4] = 4; B.array[i * 4 + 1] = kind; B.array[i * 4 + 2] = life * (.8 + .4 * rnd()); B.array[i * 4 + 3] = size * (.75 + .5 * rnd());
      const cc = colorOf(colors[k % colors.length]); C.array[i * 3] = cc.r; C.array[i * 3 + 1] = cc.g; C.array[i * 3 + 2] = cc.b;
      this.cursor = (this.cursor + 1) % N.burst;
    }
    // One upload range per attribute (a wrapped run marks the whole ring: it happens once every 192 points).
    const lo = this.cursor > first ? first : 0, hi = this.cursor > first ? this.cursor : N.burst, s = this.burstStart + lo, c = hi - lo;
    markRange(P, s * 3, c * 3); markRange(A, s * 4, c * 4); markRange(B, s * 4, c * 4); markRange(C, s * 3, c * 3);
    // Frames to stay drawn: the longest life at 60 fps and more (a slower phone just keeps the draw a little longer, never cuts a burst).
    this.live = Math.max(this.live, Math.ceil((delay + life * 1.25) * 75)); this.stats.spawned += n; this.points.visible = true;
  }
  /** The feedback of an action that went through (main.mjs runAction). */
  act(type, arg) {
    // The coins fly on the HUD wherever you sell (the market, a shop indoors); the bursts are drawn in the village only.
    const w = this.world; if (type === 'sell') this.coins(); if (w.location !== 'village') return;
    const bed = Number.isInteger(arg?.index) && (type === 'plant' || type === 'water' || type === 'harvest') ? BED_POSITIONS[arg.index] : null;
    const near = w.nearest?.(), p = w.player.position, x = bed?.x ?? (near && hyp(near.x - p.x, near.z - p.z) < 4 ? near.x : p.x), z = bed?.z ?? (near && hyp(near.x - p.x, near.z - p.z) < 4 ? near.z : p.z);
    if (type === 'harvest') { this.spawn(KIND.spark, x, .6, z, 18, { spread: 2.4, up: 3.4, life: 1, size: 1.05, colors: ['#ffe14d', '#fff6b0', '#ffb83d'] }); this.spawn(KIND.ring, x, .25, z, 1, { spread: 0, up: 0, life: .55, size: 4.42, colors: ['#ffe27a'], jitter: 0 }); this.spawn(KIND.leaf, x, .5, z, 6, { spread: 2, up: 3, life: 1.1, size: 0.51, colors: ['#5fcf3f', '#8fe05a'] }); }
    else if (type === 'water') { this.spawn(KIND.drop, x, 2.1, z, 22, { spread: .5, up: -1, life: .6, size: .52, colors: ['#5cc8ff', '#9fe0ff', '#ffffff'], jitter: 1.2 }); this.spawn(KIND.ring, x, .1, z, 2, { spread: 0, up: 0, life: .6, size: 3.4, colors: ['#8fdcff'], delay: .3, jitter: .5 }); }
    else if (type === 'plant') this.spawn(KIND.puff, x, .15, z, 6, { spread: 1, up: .4, life: .7, size: 0.94, colors: ['#a8784a', '#c49464'] });
    else if (type === 'pickTree' || type === 'pickSpot') { this.spawn(KIND.leaf, x, 2.6, z, 10, { spread: 1.8, up: .6, life: 1.4, size: 0.58, colors: ['#4fbf3a', '#8fe05a', '#ffd23a'], jitter: 1.4 }); this.spawn(KIND.spark, x, 2, z, 8, { spread: 1.6, up: 2, life: .8, size: 0.65, colors: ['#ffe14d', '#ffffff'] }); }
    else if (type === 'chop' || type === 'uproot') { this.spawn(KIND.leaf, x, .8, z, 10, { spread: 2.4, up: 3, life: 1, size: 0.44, colors: ['#c8894e', '#e8b070', '#7a5230'] }); this.spawn(KIND.puff, x, .2, z, 5, { spread: 1.2, up: .3, life: .8, size: 1.19, colors: ['#e8d2a8'] }); }
    else if (type === 'catch' || type === 'gift' || type === 'gather') this.spawn(KIND.spark, p.x, 1.4, p.z, 10, { spread: 1.8, up: 2.6, life: .8, size: 0.61, colors: type === 'gift' ? ['#ff8fc0', '#ffd1e6'] : ['#ffe14d', '#bff5ff', '#ffffff'] });
    else if (type === 'claim' || type === 'festival' || type === 'race' || type === 'hire') { this.spawn(KIND.confetti, p.x, 2.2, p.z, 36, { spread: 3.6, up: 5.5, life: 1.7, size: .8, colors: ['#ff4f6a', '#3fa9ff', '#ffd23a', '#5fd36a', '#c77dff'] }); this.spawn(KIND.ring, p.x, 1, p.z, 1, { spread: 0, up: 0, life: .7, size: 6.8, colors: ['#ffe27a'], jitter: 0 }); this.spawn(KIND.spark, p.x, 1.6, p.z, 12, { spread: 2.6, up: 3, life: 1, size: 0.75, colors: ['#ffffff', '#ffe14d'] }); }
  }
  /** Coins fly from where you tapped (or the middle) to the coin counter, which bumps as they land (DOM, eight reused spans). */
  coins() {
    const to = document.getElementById('coins'); if (!to) return;
    const r = to.getBoundingClientRect(), x1 = r.left + r.width / 2, y1 = r.top + r.height / 2;
    const bump = () => to.animate?.([{ transform: 'scale(1)' }, { transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 180, easing: 'ease-out' });
    if (this.reduce?.matches) { bump(); return; }
    if (!this.coinEls) { this.coinEls = []; for (let k = 0; k < 8; k++) { const e = document.createElement('i'); e.setAttribute('aria-hidden', 'true'); e.style.cssText = 'position:fixed;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff6b8 0 18%,#ffd23a 40%,#e89a12 100%);box-shadow:0 0 0 2px #b8730a inset,0 2px 6px rgba(120,70,0,.35);pointer-events:none;z-index:60;opacity:0;will-change:transform'; document.body.append(e); this.coinEls.push(e); } }
    const x0 = this.tap?.x ?? innerWidth / 2, y0 = this.tap?.y ?? innerHeight / 2, n = Math.max(3, Math.round(8 * this.scale()));
    for (let k = 0; k < n; k++) {
      const e = this.coinEls[k], sx = x0 + (rnd() - .5) * 60, sy = y0 + (rnd() - .5) * 40, mx = (sx + x1) / 2 + (rnd() - .5) * 120, my = Math.min(sy, y1) - 80 - rnd() * 60;
      const at = f => { const a = (1 - f) * (1 - f), b = 2 * (1 - f) * f, c = f * f; return `translate(${a * sx + b * mx + c * x1}px,${a * sy + b * my + c * y1}px) scale(${1.1 - .45 * f})`; };
      const anim = e.animate([{ transform: at(0), opacity: 0 }, { transform: at(.15), opacity: 1, offset: .12 }, { transform: at(.5), opacity: 1 }, { transform: at(.8), opacity: 1 }, { transform: at(1), opacity: .9 }], { duration: 560, delay: k * 45, easing: 'cubic-bezier(.5,0,.9,.6)', fill: 'none' });
      if (k === n - 1) anim.onfinish = bump; else if (k === 0) anim.onfinish = bump;
    }
  }
  /** Once a frame before the picture is drawn (room-view onFrame). In the steady state it reads one double (the time) and counts
   *  frames in small integers: V8 leaves a method called once a frame unoptimised for a long time, and unoptimised code boxes every
   *  double it loads or computes (ROUND8-PERF2), so the float work runs only every few frames or while something moves. */
  frame() {
    const w = this.world; if (!w.ready || !w.player) return;
    // vfxShow(false) (probes): no VFX work at all, for a same-page before / after.
    if (this.off) { this.points.visible = false; return; }
    this.u.uTime.value = w.t;
    const ride = w.riding, me = ride ? ride.mesh.position : w.player.position, indoors = w.location !== 'village';
    // The shader reads the player's (or the car's) own position vector: three uploads it, nothing is copied here.
    if (this.u.uCenter.value !== me) this.u.uCenter.value = me;
    if (this.wasIndoors !== indoors) { this.wasIndoors = indoors; if (!indoors) this.spawn(KIND.puff, me.x, .2, me.z, 7, DOOR); }
    if (++this.n >= 4) { this.n = 0; this.view(); if (++this.m >= 6) { this.m = 0; this.decide(indoors, me); } }
    if (!indoors && (ride || w.keys.has('shift'))) { if (this.n % 2 === 0) this.dust(ride, me); } else this.moving = false;
    if (!this.settled) this.ease();
    if (this.live > 0) this.live--;
    this.points.visible = this.any || this.live > 0;
  }
  /** The canvas height for the point sizes (the shader takes the metres-to-pixels scale from the projection): an integer compare. */
  view() {
    const h = this.world.renderer.domElement.height; if (h === this.h) return;
    this.h = h; this.u.uScale.value = h; this.u.uMax.value = Math.min(this.maxPoint, Math.round(h * .09));
  }
  /** Running feet (sprint) and a vehicle's rear wheels at speed, spaced by distance travelled (looked at every other frame). */
  dust(ride, me) {
    const w = this.world, t = w.t, dt = t - this.dustAt, moved = hyp(me.x - this.last.x, me.z - this.last.z); this.last.copy(me); this.dustAt = t;
    const was = this.moving; this.moving = true;
    if (!was || dt <= 0 || dt > .2 || moved >= 3) return;
    const speed = moved / dt, fast = ride ? speed > 7 : speed > 5.5 && !w.jump?.airborne;
    if (!fast) return;
    this.dustT -= moved; if (this.dustT > 0) return;
    this.dustT = ride ? 2.2 : 1.6; const o = ride ? DUST_RIDE : DUST_RUN; o.colors = this.dustColor(me.x, me.z);
    if (!ride) { this.spawn(KIND.puff, me.x, .15, me.z, 2, o); return; }
    const hd = ride.drive?.heading ?? ride.mesh.rotation.y, sx = Math.sin(hd), cz = Math.cos(hd);
    for (let k = -1; k <= 1; k += 2) this.spawn(KIND.puff, me.x - sx * 1.5 + cz * .75 * k, .25, me.z - cz * 1.5 - sx * .75 * k, 1, o);
  }
  /** Ease every layer's alpha towards its target (about 0.8 s for a full fade at 60 fps); swap a preset only while the layer is invisible. Stops once all are there. */
  ease() {
    const R = this.u.uR.value, dt = 1 / 60; let any = false, settled = true;
    for (let l = 0; l < 4; l++) {
      const L = this.layers[l], goal = L.want === L.preset ? L.target : 0, gap = goal - L.alpha;
      L.alpha = Math.abs(gap) <= dt * 1.2 ? goal : L.alpha + (gap > 0 ? dt : -dt) * 1.2;
      if (L.alpha <= 0 && L.want !== L.preset && L.want) { L.preset = L.want; this.setPreset(l, L.want); }
      if (L.alpha !== (L.want === L.preset ? L.target : 0)) settled = false;
      R[l].x = L.alpha; R[l].y = L.density; if (L.alpha > 0 && L.density > 0) any = true;
    }
    this.any = any; this.settled = settled;
  }
  dustColor(x, z) {
    const id = regionAt(x, z) ?? 'village'; let c = this.ground.get(id);
    if (!c) { const g = new T.Color(REGION[id]?.ground ?? '#93e06a').lerp(new T.Color('#fffaf0'), .72); c = ['#' + g.getHexString(), '#' + g.clone().multiplyScalar(.9).getHexString()]; this.ground.set(id, c); }
    return c;
  }
  /** What each layer should show here and now (every 0.4 s). */
  decide(indoors, me) {
    const w = this.world, s = w.state, L = this.layers, q = QUALITY[s.settings.quality] ?? .6, gov = STEP[w.step ?? 0], reduce = !!this.reduce?.matches;
    const dens = q * gov, night = s.settings.light === 'cycle' ? Math.min(1, Math.max(0, (s.time - 17.5) / 3)) : 0, share = indoors ? 0 : w.landShare ?? 0;
    const id = indoors ? null : regionAt(me.x, me.z);
    // The calendar's record is made once a day, not at every check.
    if (s.day !== this.day) { this.day = s.day; this.rain = calendar(s).rain; }
    if (id && REGION[id]?.kind !== 'land') this.home = id;
    const homeAir = HOME_AIR[this.home] ?? SEASONS[Math.floor((s.day - 1) / 7) % 4];
    const land = w.lightAt?.id, night1 = night * (1 - share), pond = hyp(me.x - POND.x, me.z - POND.z) < 45 && !indoors;
    this.aim(L[0], homeAir, indoors || this.rain || reduce ? 0 : 1 - share, dens);
    this.aim(L[1], land && LAND_AIR[land] ? LAND_AIR[land] : L[1].want, indoors || reduce || !land ? 0 : share, dens);
    this.aim(L[2], 'fireflies', indoors ? 0 : night1, dens * (reduce ? .5 : 1));
    this.aim(L[3], 'glints', pond ? .9 * (1 - night) : 0, Math.min(1, dens * 1.4));
    if (!this.hooked && window.willowmere) { this.hooked = true; try { window.willowmere.vfx = () => this.info(); window.willowmere.vfxAct = (type, arg) => this.act(type, arg); window.willowmere.vfxShow = on => { this.off = !on; }; } catch { /* frozen */ } }
  }
  /** A layer's wish; the alphas ease (and the uniforms are written) only when one changed. */
  aim(L, want, target, density) { if (L.want === want && L.target === target && L.density === density) return; L.want = want; L.target = target; L.density = density; this.settled = false; }
  info() { return { visible: this.points.visible, layers: this.layers.map(L => ({ preset: L.preset, alpha: +L.alpha.toFixed(2), density: +L.density.toFixed(2) })), spawned: this.stats.spawned, live: this.live > 0 }; }
}

export function installVfx(world, installRoomView) {
  if (world.__vfx) return world.__vfx;
  const fx = world.__vfx = new Vfx(world);
  world.vfx = (type, arg) => { try { fx.act(type, arg); } catch (e) { console.warn('vfx', e); } };
  addEventListener('pointerdown', e => { fx.tap = fx.tapAt; fx.tapAt.x = e.clientX; fx.tapAt.y = e.clientY; }, { passive: true, capture: true });
  installRoomView(world).onFrame(() => fx.frame());
  return fx;
}
