// Village and wilds VFX (the "add some vfx, don't make the game slow" rounds). Fetched with import() by outdoors.mjs after the
// village stands; nothing here is in the first-load bundle. main.mjs calls world.vfx?.(type, arg) after an action succeeds, and the
// Pandora view after a boss arrives or its quake lands.
//
// ONE THREE.Points draw for everything, one ShaderMaterial (one program, compiled at install), motion in the vertex shader:
//   layer 0  the home ambience round the player: the season's petals / golden pollen / leaves / snow in the village and the home
//            regions (spores in the Mushroom Forest, wind dust in Redrock Canyon); on a rain day the rain itself (streaks that
//            fall in the shader: the 120 CPU-written line segments world.mjs drew before are gone)
//   layer 1  a land's own air (embers, blue snow flurries, bubbles, sugar sparkles, confetti, cloud fluff, jungle midges);
//            it fades in with world.landShare, the same 24 m crossfade as the land's light, and the home layer fades out
//   layer 2  critters: butterflies by day (spring to autumn, no rain), fireflies at dusk (light cycle on, from 17:30)
//   layer 3  sun glints twinkling on the family pond (daytime, within 45 m of the pond)
//   layer 4  the rain on the ground: splash rings at a new spot every cycle and a few puddle glints (rain days)
//   layer 5  anchored life, written once where it lives: chimney smoke (chimney caps found in the baked village), warm window glow
//            at dusk (window glass found the same way), the cooking fire's steam, sparks and glow, dragonflies and water striders on
//            the pond, foam beads and sparkles along its water line, the outposts' beacons and lamp glow out in the wilds
//   layer 9  one-shot bursts written once at spawn into a ring of slots (origin, velocity, birth, life, kind): sparkles, droplets,
//            dust puffs, confetti, a soft ring, leaf bits, a shimmer column, a gust of leaves, hearts, a shock ring on the ground.
//            The shader moves and fades them from (time - birth); the CPU never touches a live burst again.
// Ambient layers wrap their points in a 64 m box that follows the player and fade them out towards its rim (no pop at the edge);
// a layer with nothing to show writes alpha 0 and its points leave the screen in the vertex shader (no fragments). When every
// layer is empty and no burst is alive the Points object is hidden: 0 draws. Per frame the CPU sets a few uniforms; nothing is
// allocated. Density scales with the Graphics setting (high 1, balanced 0.6, battery 0.3), the governor's step (1, .75, .5, 0)
// and prefers-reduced-motion (the screen-filling layers 0 and 1 off, fireflies halved, bursts smaller, coins do not fly).
// Additive and normal points share the draw through premultiplied blending (an additive point writes alpha 0).
// The Night Land's dark is a DOM layer over the canvas, so its motes are DOM too: a few glowing dots just above #night-layer
// (CSS animations of transform and opacity only), shown only while that layer is.
import * as T from 'three';
import { markRange } from './changed-buffers.mjs';
import { regionAt, REGION, OUTPOSTS } from './regions.mjs';
import { calendar } from './game.mjs';
import { BED_POSITIONS, POND, HOUSES } from './content.mjs';
import { OVEN } from './village-plan.mjs';
import { outline } from './pond-water.mjs';
import { hyp } from './hyp.mjs';
import { VERT, FRAG } from './vfx-glsl.mjs';

const N = { home: 220, land: 220, glow: 90, pond: 40, ground: 90, anchor: 480, burst: 192 }, BOX = 64, POND_Y = .33;
const P = (shape, add, fall, sway, spin, size, dx, dz, y0, y1, colors) => ({ shape, add, fall, sway, spin, size, dx, dz, y0, y1, colors });
// shape: 0 soft disc, 1 petal, 2 leaf, 3 glow, 4 bubble, 5 star sparkle, 6 confetti, 7 puff, 8 ring, 9 droplet, 10 rain streak,
// 11 heart, 12 dragonfly, 13 strider, 14 ground ring, 15 butterfly
export const PRESETS = {
  petals: P(1, 0, .75, 1.1, 1.6, 0.62, .5, .15, 0, 9, ['#ff5fa2', '#ff8cc2', '#ffb3d4']),
  pollen: P(5, 0, -.05, .8, .5, .6, .25, .1, .3, 6, ['#ffc21a', '#ffd84d', '#ffab1f']),
  leaves: P(2, 0, 1, 1.4, 2.2, 0.72, .8, .25, 0, 9, ['#ff8a2a', '#e8501f', '#ffc23a']),
  snow: P(0, 0, 1, .6, 0, 0.42, .3, 0, 0, 10, ['#ffffff', '#eaf6ff', '#ffffff']),
  rain: P(10, 0, 13, 0, 0, 1.3, 1.1, .3, 0, 14, ['#8cc8ff', '#e8f6ff', '#6fb6ff']),
  fireflies: P(3, 1, -.06, .9, 0, 1.5, 0, 0, .3, 2.6, ['#fff08a', '#d8ff7a', '#ffd860']),
  butterflies: P(15, 0, 0, 1.6, 0, 1.15, .3, .1, .5, 2.4, ['#ff8a1f', '#3fb4ff', '#ffd23a']),
  spores: P(3, 1, -.25, .6, 0, 0.52, .1, 0, 0, 5, ['#8ff5dc', '#d39cff', '#c8ff8a']),
  dust: P(0, 0, .05, .9, 0, 0.3, 1.1, .25, .2, 5, ['#f8dcaa', '#ecc48a', '#fff0d0']),
  embers: P(3, 1, -1.3, .7, 0, 0.5, .3, .1, 0, 9, ['#ff7a1f', '#ffc65a', '#ff4a1a']),
  bubbles: P(4, 0, -.7, .35, 0, 0.6, 0, 0, 0, 4, ['#5fcbff', '#8edcff', '#bfefff']),
  flurry: P(5, 0, .9, .7, .6, 0.5, .5, .1, 0, 10, ['#7fc4ff', '#a8d8ff', '#5fb0f5']),
  sugar: P(5, 1, .35, .6, .8, 0.46, .1, 0, 0, 8, ['#ffc6e6', '#ffffff', '#ff9fd0']),
  confetti: P(6, 0, .7, 1, 3, 0.5, .2, .1, 0, 9, ['#ff4f6a', '#3fa9ff', '#ffd23a']),
  fluff: P(7, 0, -.08, .5, .3, 1.1, .6, .1, 1, 7, ['#ffffff', '#f2f8ff', '#e6f2ff']),
  midges: P(3, 1, -.04, .7, 0, 0.42, 0, 0, .3, 3, ['#d8ff7a', '#9cff8a', '#fff08a']),
  splash: P(14, 0, 0, 0, 0, 1, 0, 0, 0, 1, ['#e2f3ff', '#ffffff', '#ffffff']),
};
const SEASONS = ['petals', 'pollen', 'leaves', 'snow'];
const HOME_AIR = { west: 'spores', east: 'dust' }; // the village, Blue Lake Meadow and Chomper Swamp follow the season
// No entry for the Night Land: its dark is a DOM layer over the canvas (land-view.mjs #night-layer); its motes are DOM (nightMotes).
// Frost Land's ground is white: its flurries are blue-tinted star flakes, not the village's white snow.
const LAND_AIR = { lava: 'embers', ice: 'flurry', ocean: 'bubbles', candy: 'sugar', toy: 'confetti', cloud: 'fluff', jungle: 'midges' };
// Burst kinds (the shader's table): 0 spark, 1 droplet, 2 puff, 3 confetti, 4 ring, 5 leaf bit, 6 shimmer column, 7 gust, 8 heart, 9 shock ring
export const KIND = { spark: 0, drop: 1, puff: 2, confetti: 3, ring: 4, leaf: 5, column: 6, gust: 7, heart: 8, shock: 9 };
// Anchored sorts (layer 5): their alphas are the uK uniform array.
export const SORT = { smoke: 0, glow: 1, sparks: 2, dragonfly: 3, strider: 4, foam: 5, beacon: 6 };
const GUST_COLORS = [['#7fd858', '#5fc23a', '#ff6fae'], ['#6fcf3f', '#a6e05a', '#ffd23a'], ['#ff8a2a', '#e8501f', '#ffc23a']];
const GLASS = ['#8FE6FF', '#7FE3FF'], CHARCOAL = '#3A3D4A';

// A small seeded random (cosmetic only: gameplay's Math.random and seeds stay as they were).
let seed = 7;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
// Reused option records for the dust and gusts (spawned every few metres or seconds: no allocation).
const DUST_RIDE = { spread: .6, up: .5, life: .75, size: 1.4, colors: null, jitter: .2 }, DUST_RUN = { spread: .5, up: .35, life: .55, size: .9, colors: null, jitter: .3 };
const DOOR = { spread: 1.6, up: .5, life: .7, size: 1.2, colors: ['#fff4e0', '#f2e2c4'], jitter: .25 };
const GUST = { spread: .5, up: .2, life: 4.2, size: .8, colors: null, jitter: 5, vx: 0, vz: 0 };
const COLORS = new Map(), colorOf = hex => { let c = COLORS.get(hex); if (!c) COLORS.set(hex, c = new T.Color(hex)); return c; };
const QUALITY = { high: 1, balanced: .6, battery: .3 }, STEP = [1, .75, .5, 0], ANCHOR_STEP = [1, .85, .6, 0];

export class Vfx {
  constructor(world) {
    this.world = world;
    const total = N.home + N.land + N.glow + N.pond + N.ground + N.anchor + N.burst, pos = new Float32Array(total * 3), A = new Float32Array(total * 4), B = new Float32Array(total * 4), C = new Float32Array(total * 3);
    let i = 0;
    const layer = (l, n) => { for (let k = 0; k < n; k++, i++) { pos.set([rnd(), rnd(), rnd()], i * 3); A.set([rnd(), rnd(), rnd(), (k + .5) / n], i * 4); B.set([l, 0, 0, rnd()], i * 4); } };
    layer(0, N.home); layer(1, N.land); layer(2, N.glow);
    this.pondStart = i; layer(3, N.pond);
    for (let k = this.pondStart; k < i; k++) { pos[k * 3] = POND.x + (pos[k * 3] - .5) * (POND.w - 4); pos[k * 3 + 1] = POND_Y; pos[k * 3 + 2] = POND.z + (pos[k * 3 + 2] - .5) * (POND.d - 3.5); }
    layer(4, N.ground);
    this.anchorStart = i; for (let k = 0; k < N.anchor; k++, i++) { B[i * 4] = 5; B[i * 4 + 1] = 7; }
    this.burstStart = i; for (let k = 0; k < N.burst; k++, i++) { B[i * 4] = 9; A[i * 4 + 3] = -1e6; B[i * 4 + 2] = 1; }
    const g = this.geometry = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('aA', new T.BufferAttribute(A, 4)); g.setAttribute('aB', new T.BufferAttribute(B, 4)); g.setAttribute('aC', new T.BufferAttribute(C, 3));
    for (const k of ['position', 'aA', 'aB', 'aC']) g.getAttribute(k).setUsage(T.DynamicDrawUsage);
    g.boundingSphere = new T.Sphere(new T.Vector3(), 1e5);
    const v4 = () => [0, 1, 2, 3, 4].map(() => new T.Vector4());
    this.u = { uTime: { value: 0 }, uScale: { value: 20 }, uMax: { value: 64 }, uMax2: { value: 64 }, uBox: { value: BOX }, uKd: { value: 1 }, uCenter: { value: new T.Vector3() }, uWind: { value: new T.Vector2(.62, .28) }, uP: { value: v4() }, uQ: { value: v4() }, uR: { value: v4() }, uCol: { value: Array.from({ length: 15 }, () => new T.Color()) }, uK: { value: [0, 0, 0, 0, 0, 0, 0, 0] } };
    this.material = new T.ShaderMaterial({ name: 'vfx-points', uniforms: this.u, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, depthTest: true, blending: T.CustomBlending, blendSrc: T.OneFactor, blendDst: T.OneMinusSrcAlphaFactor, blendSrcAlpha: T.OneFactor, blendDstAlpha: T.OneMinusSrcAlphaFactor, fog: false });
    const pts = this.points = new T.Points(g, this.material);
    pts.name = 'vfx'; pts.frustumCulled = false; pts.renderOrder = 6; pts.matrixAutoUpdate = false; pts.castShadow = pts.receiveShadow = false;
    world.scene.add(pts);
    // Layer state: the preset shown, the one wanted, the alpha now and wanted, the density. Then one channel per anchored sort.
    this.layers = [0, 1, 2, 3, 4].map(() => ({ preset: null, want: null, alpha: 0, target: 0, density: 0 }));
    this.sorts = [0, 1, 2, 3, 4, 5, 6, 7].map(() => ({ alpha: 0, target: 0 }));
    this.layers[2].preset = this.layers[2].want = 'fireflies'; this.setPreset(2, 'fireflies');
    this.setPreset(3, { shape: 5, add: 1, fall: 0, sway: 0, spin: 0, size: .75, dx: 0, dz: 0, y0: 0, y1: 1, colors: ['#ffffff', '#fff6c8', '#e8fbff'] });
    this.layers[3].preset = this.layers[3].want = 'glints';
    this.layers[4].preset = this.layers[4].want = 'splash'; this.setPreset(4, 'splash');
    // Every field the frame reads is made here, so the object's shape never changes after install (V8 keeps the methods optimised).
    this.cursor = 0; this.home = 'village'; this.dustT = 0; this.wasIndoors = false; this.last = new T.Vector3(); this.ground = new Map();
    this.n = 0; this.m = 0; this.live = 0; this.moving = false; this.dustAt = 0; this.off = false; this.any = false; this.settled = false; this.h = -1; this.day = -1; this.rain = false; this.season = 0; this.hooked = false; this.tap = null; this.tapAt = { x: 0, y: 0 }; this.coinEls = null;
    this.touch = false; this.gustAt = 20; this.anchors = 0; this.marks = { windows: 0, chimneys: 0, ms: 0, at: [] }; this.motes = null; this.nightEl = null; this.motesOn = false;
    this.reduce = matchMedia?.('(prefers-reduced-motion: reduce)'); this.stats = { spawned: 0 };
    this.maxPoint = world.renderer.capabilities?.maxPointSize ?? 64;
    try { const gl = world.renderer.getContext(); this.maxPoint = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1]; } catch { /* keep 64 */ }
    this.placeStatic();
    // One program, compiled now (not on the first frame that shows a petal).
    pts.visible = true; try { world.renderer.compile(pts, world.camera, world.scene); } catch (e) { console.warn('vfx warm-up', e); } pts.visible = false;
    // Chimneys and windows are read from the baked village in slices after install (a one-off, off the first frames).
    setTimeout(() => this.scanMarks(), 1500);
  }
  setPreset(l, p) {
    const pre = typeof p === 'string' ? PRESETS[p] : p, u = this.u;
    u.uP.value[l].set(pre.fall, pre.sway, pre.spin, pre.size); u.uQ.value[l].set(pre.dx, pre.dz, pre.y0, pre.y1);
    u.uR.value[l].z = pre.shape; u.uR.value[l].w = pre.add;
    for (let k = 0; k < 3; k++) u.uCol.value[l * 3 + k].set(pre.colors[k]);
  }
  /** Writes one anchored point (layer 5): sort, place, size, colour, phase. Returns false when the block is full. */
  anchor(sort, x, y, z, size, hex, phase = rnd()) {
    if (this.anchors >= N.anchor) return false;
    const i = this.anchorStart + this.anchors++, g = this.geometry, Pa = g.getAttribute('position').array, A = g.getAttribute('aA').array, B = g.getAttribute('aB').array, C = g.getAttribute('aC').array, c = colorOf(hex);
    Pa[i * 3] = x; Pa[i * 3 + 1] = y; Pa[i * 3 + 2] = z; A[i * 4] = phase; A[i * 4 + 1] = rnd(); A[i * 4 + 2] = rnd(); A[i * 4 + 3] = rnd() * .999;
    B[i * 4 + 1] = sort; B[i * 4 + 3] = size; C[i * 3] = c.r; C[i * 3 + 1] = c.g; C[i * 3 + 2] = c.b;
    return true;
  }
  /** One upload of the anchored block after points were added. */
  flushAnchors() {
    const g = this.geometry, s = this.anchorStart, n = N.anchor;
    markRange(g.getAttribute('position'), s * 3, n * 3); markRange(g.getAttribute('aA'), s * 4, n * 4); markRange(g.getAttribute('aB'), s * 4, n * 4); markRange(g.getAttribute('aC'), s * 3, n * 3);
  }
  /** What lives in known places: the cooking fire, the pond's dragonflies, striders and shore, the outposts' beacons and lamps. */
  placeStatic() {
    // The cooking fire by the village green (the kitchen pot at OVEN): steam over the pot, sparks, a warm glow at dusk.
    for (let k = 0; k < 6; k++) this.anchor(SORT.smoke, OVEN.x + (rnd() - .5) * .3, 1.5, OVEN.z + (rnd() - .5) * .3, .9, k % 2 ? '#f6efe6' : '#e9e1d8', k / 6);
    for (let k = 0; k < 10; k++) this.anchor(SORT.sparks, OVEN.x + (rnd() - .5) * .6, .7, OVEN.z + (rnd() - .5) * .6, .32, k % 3 ? '#ffb43a' : '#ff6a1f', k / 10);
    this.anchor(SORT.glow, OVEN.x, .7, OVEN.z, 3.2, '#ff9a3a');
    // The pond: dragonflies looping over the water, striders gliding, foam beads and sparkles on the water line.
    const dragon = ['#1fb8e8', '#ff4a5a', '#3fd06a', '#1fb8e8', '#9a5cff'];
    for (let k = 0; k < 5; k++) this.anchor(SORT.dragonfly, POND.x + (k - 2) * 3.4, POND_Y, POND.z + (k % 2 ? -1.6 : 1.6), 1.3, dragon[k], k / 5);
    for (let k = 0; k < 10; k++) this.anchor(SORT.strider, POND.x + (rnd() - .5) * (POND.w - 6), POND_Y + .02, POND.z + (rnd() - .5) * (POND.d - 5), 1.1, '#ffffff', rnd());
    const line = outline(-.15);
    for (let k = 0; k < line.length; k++) for (let h = 0; h < 2; h++) {
      const a = line[k], b = line[(k + 1) % line.length], f = (h + rnd() * .5) / 2;
      this.anchor(SORT.foam, POND.x + a[0] + (b[0] - a[0]) * f, POND_Y + .03, POND.z + a[1] + (b[1] - a[1]) * f, .55 + rnd() * .3, rnd() < .8 ? '#ffffff' : '#eafaff', rnd());
    }
    // The outposts out in the wilds: a column of rising gold motes over each Home pad, a warm glow on the lamp.
    for (const o of OUTPOSTS) {
      for (let k = 0; k < 9; k++) this.anchor(SORT.beacon, o.x, 0, o.z, 1.5, k % 3 ? '#ffd23a' : '#5fd0ff', k / 9 + rnd() * .04);
      const r = o.x * .013; this.anchor(SORT.glow, o.x - 1.3 * Math.cos(r), 2.4, o.z + 1.3 * Math.sin(r), 2.4, '#ffd06a');
    }
    this.flushAnchors();
  }
  /** Chimney caps (the rural kit's charcoal flue, the house kit's dark stone rim) and window glass in the baked village (and the homestead and workshop, which are live), by their kit colours.
   *  Read in 6 ms slices once, a while after install. */
  scanMarks() {
    const w = this.world, meshes = [], t0 = performance.now();
    w.villageCells?.traverse(m => { if (m.isMesh && !m.isInstancedMesh) meshes.push(m); });
    HOUSES[0]?.group?.traverse(m => { if (m.isMesh && !m.isInstancedMesh) meshes.push(m); });
    w.workshop?.traverse?.(m => { if (m.isMesh && !m.isInstancedMesh) meshes.push(m); });
    const glass = GLASS.map(h => new T.Color(h)), coal = new T.Color(CHARCOAL), cap = new T.Color().setRGB(.262, .301, .376), near = (c, r, g, b) => Math.abs(c.r - r) + Math.abs(c.g - g) + Math.abs(c.b - b) < .05;
    const wins = [], chims = [], a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3(), e1 = new T.Vector3(), e2 = new T.Vector3();
    const add = (list, x, y, z, nx, nz, area, gap) => {
      for (const k of list) if (Math.abs(k.x / k.w - x) < gap && Math.abs(k.y / k.w - y) < gap && Math.abs(k.z / k.w - z) < gap && k.nx * nx + k.nz * nz > -.2) { k.x += x * area; k.y += y * area; k.z += z * area; k.w += area; k.top = Math.max(k.top, y); k.x0 = Math.min(k.x0, x); k.x1 = Math.max(k.x1, x); k.z0 = Math.min(k.z0, z); k.z1 = Math.max(k.z1, z); return; }
      list.push({ x: x * area, y: y * area, z: z * area, w: area, nx, nz, top: y, x0: x, x1: x, z0: z, z1: z });
    };
    let mi = 0;
    const slice = () => {
      const until = performance.now() + 6;
      while (mi < meshes.length && performance.now() < until) {
        const m = meshes[mi++], geo = m.geometry, pos = geo?.getAttribute('position'); if (!pos) continue;
        const col = geo.getAttribute('color'), mat = Array.isArray(m.material) ? m.material[0] : m.material, mc = mat?.color, idx = geo.index, n = idx ? idx.count : pos.count;
        if (!col && !(mc && (glass.some(q => near(mc, q.r, q.g, q.b)) || near(mc, coal.r, coal.g, coal.b) || near(mc, cap.r, cap.g, cap.b)))) continue;
        m.updateWorldMatrix(true, false);
        for (let t = 0; t < n; t += 3) {
          const i0 = idx ? idx.getX(t) : t;
          let r = mc?.r ?? 1, gg = mc?.g ?? 1, bb = mc?.b ?? 1; if (col) { r = col.getX(i0); gg = col.getY(i0); bb = col.getZ(i0); }
          const isGlass = near(glass[0], r, gg, bb) || near(glass[1], r, gg, bb), isCoal = !isGlass && (near(coal, r, gg, bb) || near(cap, r, gg, bb)); if (!isGlass && !isCoal) continue;
          a.fromBufferAttribute(pos, i0).applyMatrix4(m.matrixWorld); b.fromBufferAttribute(pos, idx ? idx.getX(t + 1) : t + 1).applyMatrix4(m.matrixWorld); c.fromBufferAttribute(pos, idx ? idx.getX(t + 2) : t + 2).applyMatrix4(m.matrixWorld);
          e1.subVectors(b, a); e2.subVectors(c, a); e1.cross(e2); const area = e1.length() / 2; if (area < 1e-4) continue; e1.multiplyScalar(1 / (2 * area));
          const x = (a.x + b.x + c.x) / 3, y = (a.y + b.y + c.y) / 3, z = (a.z + b.z + c.z) / 3;
          if (isGlass && Math.abs(e1.y) < .3 && y > .6) add(wins, x, y, z, e1.x, e1.z, area, .8);
          else if (isCoal && e1.y > .8 && y > 2.6) add(chims, x, y, z, 0, 0, area, .9);
        }
      }
      if (mi < meshes.length) { setTimeout(slice, 30); return; }
      this.placeMarks(wins, chims, performance.now() - t0);
    };
    slice();
  }
  placeMarks(wins, chims, ms) {
    // A window is a cluster of glass (both faces of the pane: the glow sits on the side with more area, which faces out of the wall),
    // biggest first, at most 150; a chimney is a small, square dark cap 4 m up or more (up to 16; a dark beam over a barn door is not one).
    wins.sort((p, q) => q.w - p.w); chims.sort((p, q) => q.w - p.w);
    let nw = 0, nc = 0;
    for (const k of chims) { if (nc >= 16 || k.w > 1.2 || k.top < 4 || k.x1 - k.x0 > 1.1 || k.z1 - k.z0 > 1.1) continue; const x = k.x / k.w, z = k.z / k.w; for (let j = 0; j < 7; j++) this.anchor(SORT.smoke, x + (rnd() - .5) * .15, k.top + .15, z + (rnd() - .5) * .15, 1, j % 2 ? '#f4eee8' : '#e4ddd6', j / 7); nc++; this.marks.at.push([Math.round(x), Math.round(k.top), Math.round(z)]); }
    for (const k of wins) { if (nw >= 150 || k.w < .12) continue; const s = Math.min(2.2, Math.max(.9, Math.sqrt(k.w) * 2.1)), l = Math.max(.01, hyp(k.nx, k.nz)); if (this.anchor(SORT.glow, k.x / k.w + k.nx / l * .14, k.y / k.w, k.z / k.w + k.nz / l * .14, s, nw % 5 ? '#ffc35a' : '#ffa94a')) nw++; }
    this.marks.windows = nw; this.marks.chimneys = nc; this.marks.ms = Math.round(ms);
    this.flushAnchors();
  }
  /** How many of a burst a setting allows. */
  scale() { const w = this.world, q = QUALITY[w.state.settings.quality] ?? .6, step = w.step ?? 0; return (q === .3 ? .5 : 1) * (step >= 3 ? .4 : step >= 2 ? .6 : 1) * (this.reduce?.matches ? .5 : 1); }
  /** Write n burst points from (x, y, z): velocities spread by `spread` round `up` (plus vx, vz), colours from `colors`. birth = now + delay. */
  spawn(kind, x, y, z, n, { spread = 2, up = 3, life = .9, size = .3, colors = ['#ffe27a'], delay = 0, jitter = .25, vx = 0, vz = 0 } = {}) {
    n = Math.max(1, Math.round(n * this.scale()));
    const g = this.geometry, P = g.getAttribute('position'), A = g.getAttribute('aA'), B = g.getAttribute('aB'), C = g.getAttribute('aC'), t = this.world.t + delay, first = this.cursor;
    for (let k = 0; k < n; k++) {
      const i = this.burstStart + this.cursor, a = rnd() * 6.2832, sp = spread * (.35 + .65 * rnd());
      P.array[i * 3] = x + (rnd() - .5) * jitter; P.array[i * 3 + 1] = y; P.array[i * 3 + 2] = z + (rnd() - .5) * jitter;
      A.array[i * 4] = Math.cos(a) * sp + vx; A.array[i * 4 + 1] = up * (.6 + .6 * rnd()); A.array[i * 4 + 2] = Math.sin(a) * sp + vz; A.array[i * 4 + 3] = t + rnd() * .04;
      B.array[i * 4] = 9; B.array[i * 4 + 1] = kind; B.array[i * 4 + 2] = life * (.8 + .4 * rnd()); B.array[i * 4 + 3] = size * (.75 + .5 * rnd());
      const cc = colorOf(colors[k % colors.length]); C.array[i * 3] = cc.r; C.array[i * 3 + 1] = cc.g; C.array[i * 3 + 2] = cc.b;
      this.cursor = (this.cursor + 1) % N.burst;
    }
    // One upload range per attribute (a wrapped run marks the whole ring: it happens once every 192 points).
    const lo = this.cursor > first ? first : 0, hi = this.cursor > first ? this.cursor : N.burst, s = this.burstStart + lo, c = hi - lo;
    markRange(P, s * 3, c * 3); markRange(A, s * 4, c * 4); markRange(B, s * 4, c * 4); markRange(C, s * 3, c * 3);
    // Frames to stay drawn: the longest life at 60 fps and more (a slower phone just keeps the draw a little longer, never cuts a burst).
    this.live = Math.max(this.live, Math.ceil((delay + life * 1.25) * 75)); this.stats.spawned += n; this.points.visible = true;
  }
  /** The feedback of an action that went through (main.mjs runAction), or of a wilds event (pandora-view.mjs). */
  act(type, arg) {
    // The coins fly on the HUD wherever you sell (the market, a shop indoors); the bursts are drawn outdoors only.
    const w = this.world; if (type === 'sell') this.coins(); if (w.location !== 'village') return;
    const bed = Number.isInteger(arg?.index) && (type === 'plant' || type === 'water' || type === 'harvest') ? BED_POSITIONS[arg.index] : null;
    const near = w.nearest?.(), p = w.player.position, x = bed?.x ?? (near && hyp(near.x - p.x, near.z - p.z) < 4 ? near.x : p.x), z = bed?.z ?? (near && hyp(near.x - p.x, near.z - p.z) < 4 ? near.z : p.z);
    if (type === 'harvest') { this.spawn(KIND.spark, x, .6, z, 18, { spread: 2.4, up: 3.4, life: 1, size: 1.05, colors: ['#ffe14d', '#fff6b0', '#ffb83d'] }); this.spawn(KIND.ring, x, .25, z, 1, { spread: 0, up: 0, life: .55, size: 4.42, colors: ['#ffe27a'], jitter: 0 }); this.spawn(KIND.leaf, x, .5, z, 6, { spread: 2, up: 3, life: 1.1, size: 0.51, colors: ['#5fcf3f', '#8fe05a'] }); }
    else if (type === 'water') { this.spawn(KIND.drop, x, 2.1, z, 22, { spread: .5, up: -1, life: .6, size: .52, colors: ['#5cc8ff', '#9fe0ff', '#ffffff'], jitter: 1.2 }); this.spawn(KIND.ring, x, .1, z, 2, { spread: 0, up: 0, life: .6, size: 3.4, colors: ['#8fdcff'], delay: .3, jitter: .5 }); }
    else if (type === 'plant') this.spawn(KIND.puff, x, .15, z, 6, { spread: 1, up: .4, life: .7, size: 0.94, colors: ['#a8784a', '#c49464'] });
    else if (type === 'pickTree' || type === 'pickSpot') { this.spawn(KIND.leaf, x, 2.6, z, 10, { spread: 1.8, up: .6, life: 1.4, size: 0.58, colors: ['#4fbf3a', '#8fe05a', '#ffd23a'], jitter: 1.4 }); this.spawn(KIND.spark, x, 2, z, 8, { spread: 1.6, up: 2, life: .8, size: 0.65, colors: ['#ffe14d', '#ffffff'] }); }
    else if (type === 'chop' || type === 'uproot') { this.spawn(KIND.leaf, x, .8, z, 10, { spread: 2.4, up: 3, life: 1, size: 0.44, colors: ['#c8894e', '#e8b070', '#7a5230'] }); this.spawn(KIND.puff, x, .2, z, 5, { spread: 1.2, up: .3, life: .8, size: 1.19, colors: ['#e8d2a8'] }); }
    else if (type === 'catch' || type === 'gather' || type === 'feed' || type === 'collect') this.spawn(KIND.spark, p.x, 1.4, p.z, 10, { spread: 1.8, up: 2.6, life: .8, size: 0.61, colors: ['#ffe14d', '#bff5ff', '#ffffff'] });
    else if (type === 'talk' || type === 'gift') { // hearts pop over the villager's head (over yours when they are not near)
      const npc = w.npcs?.find(n => n.p?.id === arg?.id)?.mesh?.position, h = npc && hyp(npc.x - p.x, npc.z - p.z) < 8 ? npc : p, gift = type === 'gift';
      this.spawn(KIND.heart, h.x, 2.5, h.z, gift ? 3 : 1, { spread: gift ? 1.4 : .2, up: 1.4, life: gift ? 1.5 : 1.2, size: gift ? .95 : .8, colors: ['#ff3f7a', '#ff6f9a', '#ff2f62'], jitter: .3 });
      this.spawn(KIND.spark, h.x, 2.3, h.z, gift ? 8 : 4, { spread: 1.2, up: 1.6, life: .7, size: .45, colors: ['#ff8fc0', '#ffffff'] });
    }
    else if (type === 'claim' || type === 'festival' || type === 'race' || type === 'hire') { this.spawn(KIND.confetti, p.x, 2.2, p.z, 36, { spread: 3.6, up: 5.5, life: 1.7, size: .8, colors: ['#ff4f6a', '#3fa9ff', '#ffd23a', '#5fd36a', '#c77dff'] }); this.spawn(KIND.ring, p.x, 1, p.z, 1, { spread: 0, up: 0, life: .7, size: 6.8, colors: ['#ffe27a'], jitter: 0 }); this.spawn(KIND.spark, p.x, 1.6, p.z, 12, { spread: 2.6, up: 3, life: 1, size: 0.75, colors: ['#ffffff', '#ffe14d'] }); if (type === 'claim') this.column(p.x, p.z); }
    else if (type === 'upgrade') this.column(p.x, p.z);
    else if (type === 'arrive' || type === 'quake') { // a boss lands (or its quake lands): a shock ring along the ground and a ring of dust
      const r = Math.min(9, arg?.r ?? 6), cx = arg?.x ?? p.x, cz = arg?.z ?? p.z;
      this.spawn(KIND.shock, cx, .08, cz, 1, { spread: 0, up: 0, life: .65, size: r * 2.4, colors: ['#fff1c8'], jitter: 0 });
      this.spawn(KIND.puff, cx, .2, cz, type === 'arrive' ? 18 : 10, { spread: r * .9, up: .6, life: 1.1, size: 1.7, colors: ['#e8cfa0', '#d6b88a', '#f2e2c4'], jitter: 1 });
    }
  }
  /** A shimmer column round the player: gold and white sparkles spiral up, a ring along the ground. */
  column(x, z) {
    this.spawn(KIND.column, x, .2, z, 36, { spread: 1.3, up: 2.6, life: 1.6, size: 1, colors: ['#ffe14d', '#ffffff', '#ffc23a', '#bff5ff'], jitter: .2 });
    this.spawn(KIND.shock, x, .08, z, 1, { spread: 0, up: 0, life: .7, size: 5, colors: ['#ffe27a'], jitter: 0 });
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
    if (this.off) { this.points.visible = false; if (this.motesOn) this.showMotes(false); return; }
    this.u.uTime.value = w.t;
    const ride = w.riding, me = ride ? ride.mesh.position : w.player.position, indoors = w.location !== 'village';
    // The shader reads the player's (or the car's) own position vector: three uploads it, nothing is copied here.
    if (this.u.uCenter.value !== me) this.u.uCenter.value = me;
    if (this.wasIndoors !== indoors) { this.wasIndoors = indoors; if (!indoors) this.spawn(KIND.puff, me.x, .2, me.z, 7, DOOR); }
    if (++this.n >= 4) { this.n = 0; this.view(); if (++this.m >= 6) { this.m = 0; this.decide(indoors, me); } }
    // Running dust: Shift, the touch stick held (a full push counts, looked at in dust()), or a vehicle; every other frame.
    if (!indoors && (ride || this.touch || w.keys.has('shift'))) { if (this.n % 2 === 0) this.dust(ride, me); } else this.moving = false;
    if (!this.settled) this.ease();
    if (this.live > 0) this.live--;
    this.points.visible = this.any || this.live > 0;
  }
  /** The canvas height for the point sizes (the shader takes the metres-to-pixels scale from the projection): an integer compare. */
  view() {
    const h = this.world.renderer.domElement.height; if (h === this.h) return;
    this.h = h; this.u.uScale.value = h; this.u.uMax.value = Math.min(this.maxPoint, Math.round(h * .09)); this.u.uMax2.value = Math.min(this.maxPoint, Math.round(h * .36));
  }
  /** Running feet (sprint, a full stick push) and a vehicle's rear wheels at speed, spaced by distance travelled. */
  dust(ride, me) {
    const w = this.world, t = w.t, dt = t - this.dustAt, moved = hyp(me.x - this.last.x, me.z - this.last.z); this.last.copy(me); this.dustAt = t;
    const was = this.moving; this.moving = true;
    if (!was || dt <= 0 || dt > .2 || moved >= 3) return;
    // On foot a touch player has no sprint: a full push (4.8 m/s) kicks up the same small puffs as a Shift run (7 m/s).
    const shift = w.keys.has('shift'), full = !shift && this.touch && w.stick.x * w.stick.x + w.stick.y * w.stick.y > .8;
    const speed = moved / dt, fast = ride ? speed > 7 : speed > (full ? 4.2 : 5.5) && (shift || full) && !w.jump?.airborne;
    if (!fast) return;
    this.dustT -= moved; if (this.dustT > 0) return;
    this.dustT = ride ? 2.2 : 1.6; const o = ride ? DUST_RIDE : DUST_RUN; o.colors = this.dustColor(me.x, me.z);
    if (!ride) { this.spawn(KIND.puff, me.x, .15, me.z, 2, o); return; }
    const hd = ride.drive?.heading ?? ride.mesh.rotation.y, sx = Math.sin(hd), cz = Math.cos(hd);
    for (let k = -1; k <= 1; k += 2) this.spawn(KIND.puff, me.x - sx * 1.5 + cz * .75 * k, .25, me.z - cz * 1.5 - sx * .75 * k, 1, o);
  }
  /** Ease every layer's and sort's alpha towards its target (about 0.8 s for a full fade at 60 fps); swap a preset only while the
   *  layer is invisible. Stops once all are there. */
  ease() {
    const R = this.u.uR.value, K = this.u.uK.value, dt = 1 / 60, kd = this.u.uKd.value > 0; let any = false, settled = true;
    for (let l = 0; l < 5; l++) {
      const L = this.layers[l], goal = L.want === L.preset ? L.target : 0, gap = goal - L.alpha;
      L.alpha = Math.abs(gap) <= dt * 1.2 ? goal : L.alpha + (gap > 0 ? dt : -dt) * 1.2;
      if (L.alpha <= 0 && L.want !== L.preset && L.want) { L.preset = L.want; this.setPreset(l, L.want); }
      if (L.alpha !== (L.want === L.preset ? L.target : 0)) settled = false;
      R[l].x = L.alpha; R[l].y = L.density; if (L.alpha > 0 && L.density > 0) any = true;
    }
    for (let k = 0; k < 8; k++) {
      const S = this.sorts[k], gap = S.target - S.alpha;
      S.alpha = Math.abs(gap) <= dt ? S.target : S.alpha + (gap > 0 ? dt : -dt);
      if (S.alpha !== S.target) settled = false;
      K[k] = S.alpha; if (S.alpha > 0 && kd) any = true;
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
    const w = this.world, s = w.state, L = this.layers, S = this.sorts, q = QUALITY[s.settings.quality] ?? .6, step = w.step ?? 0, gov = STEP[step], reduce = !!this.reduce?.matches;
    const dens = q * gov, night = s.settings.light === 'cycle' ? Math.min(1, Math.max(0, (s.time - 17.5) / 3)) : 0, share = indoors ? 0 : w.landShare ?? 0;
    const id = indoors ? null : regionAt(me.x, me.z);
    // The calendar's record is made once a day, not at every check.
    if (s.day !== this.day) { this.day = s.day; this.rain = calendar(s).rain; this.season = Math.floor((s.day - 1) / 7) % 4; }
    if (id && REGION[id]?.kind !== 'land') this.home = id;
    const homeAir = HOME_AIR[this.home] ?? SEASONS[this.season], rain = this.rain, out = !indoors;
    const land = w.lightAt?.id, night1 = night * (1 - share), pond = out && hyp(me.x - POND.x, me.z - POND.z) < 45;
    // The rain falls everywhere outdoors (as the old CPU rain did); the season's air is off while it does.
    this.aim(L[0], rain ? 'rain' : homeAir, !out ? 0 : rain ? 1 : reduce ? 0 : 1 - share, rain ? Math.max(.3, dens) * (reduce ? .5 : 1) : dens);
    this.aim(L[1], land && LAND_AIR[land] ? LAND_AIR[land] : L[1].want, !out || reduce || !land ? 0 : share, dens);
    // Critters: butterflies by day where the season's air is (not in the forest or the canyon, not in winter or rain), fireflies at dusk.
    const fly = night > .25, flutter = !HOME_AIR[this.home] && this.season < 3 && !rain;
    this.aim(L[2], fly ? 'fireflies' : 'butterflies', !out ? 0 : fly ? night1 : flutter ? .95 * (1 - night) * (1 - share) : 0, fly ? dens * (reduce ? .5 : 1) : dens * .5);
    this.aim(L[3], 'glints', pond && !rain ? .9 * (1 - night) : 0, Math.min(1, dens * 1.4));
    this.aim(L[4], 'splash', out && rain ? 1 - share * .5 : 0, Math.max(.3, dens));
    // Anchored life (each sort culls itself beyond 80 m, the beacons beyond 190 m, in the shader).
    const calm = !rain && this.season < 3, kd = Math.min(1, .5 + .5 * q) * ANCHOR_STEP[step];
    if (kd !== this.u.uKd.value) { this.u.uKd.value = kd; this.settled = false; }
    this.want(SORT.smoke, out ? .9 : 0); this.want(SORT.glow, out ? night : 0); this.want(SORT.sparks, out ? .45 + .55 * night : 0);
    this.want(SORT.dragonfly, pond && calm ? 1 - night : 0); this.want(SORT.strider, pond && !rain && this.season !== 3 ? 1 - night * .8 : 0);
    this.want(SORT.foam, pond ? .85 - .35 * night : 0); this.want(SORT.beacon, out ? .75 + .25 * night : 0);
    if (out && !rain && !reduce && night < .7 && this.season < 3 && !HOME_AIR[this.home] && share < .5 && w.t > this.gustAt) this.gust(me);
    this.nightMotes(out);
    if (!this.hooked && window.willowmere) { this.hooked = true; try { window.willowmere.vfx = () => this.info(); window.willowmere.vfxAct = (type, arg) => this.act(type, arg); window.willowmere.vfxShow = on => { this.off = !on; }; window.willowmere.vfxGust = () => this.gust(this.world.player.position); window.willowmere.vfxWorld = () => ({ w: this.world, home: HOUSES[0].group }); } catch { /* frozen */ } }
  }
  /** An anchored sort's wish (its alpha eases there). */
  want(k, target) { const S = this.sorts[k]; if (S.target !== target) { S.target = target; this.settled = false; } }
  /** Now and then a gust carries a handful of the season's leaves or petals across the view (village and home meadows, by day). */
  gust(me) {
    const w = this.world; this.gustAt = w.t + 22 + rnd() * 26;
    const a = rnd() * 6.2832, sp = 3.2 + rnd() * 1.5; GUST.vx = Math.cos(a) * sp; GUST.vz = Math.sin(a) * sp; GUST.colors = GUST_COLORS[Math.min(2, this.season)];
    this.spawn(KIND.gust, me.x - GUST.vx * 1.8, 1.2, me.z - GUST.vz * 1.8, 18, GUST);
  }
  /** The Night Land's motes: DOM dots over its DOM dark, shown only while #night-layer is (checked every 0.4 s). */
  nightMotes(out) {
    if (!this.nightEl || !this.nightEl.isConnected) this.nightEl = document.getElementById('night-layer');
    const on = out && !!this.nightEl && !this.nightEl.hidden && !this.reduce?.matches;
    if (on !== this.motesOn) this.showMotes(on);
  }
  showMotes(on) {
    this.motesOn = on;
    if (on && !this.motes) {
      const st = document.createElement('style');
      st.textContent = '#vfx-motes{position:absolute;inset:0;pointer-events:none;overflow:hidden}#vfx-motes i{position:absolute;width:12px;height:12px;margin:-6px;border-radius:50%;background:radial-gradient(circle,#fff 0 18%,#bfe8ff 34%,rgba(130,170,255,.35) 60%,rgba(130,170,255,0) 72%);opacity:0;animation:vfx-mote var(--d) ease-in-out var(--w) infinite}#vfx-motes i.g{background:radial-gradient(circle,#fff 0 18%,#fff0a8 34%,rgba(255,210,120,.3) 60%,rgba(255,210,120,0) 72%)}@keyframes vfx-mote{0%{opacity:0;transform:translate(0,0) scale(.6)}30%{opacity:.95}60%{opacity:.55}100%{opacity:0;transform:translate(var(--x),var(--y)) scale(1.1)}}';
      document.head.append(st);
      const box = this.motes = document.createElement('div'); box.id = 'vfx-motes'; box.setAttribute('aria-hidden', 'true');
      for (let k = 0; k < 18; k++) { const e = document.createElement('i'); if (k % 3 === 0) e.className = 'g'; e.style.cssText = `left:${(rnd() * 100).toFixed(1)}%;top:${(8 + rnd() * 84).toFixed(1)}%;--d:${(5 + rnd() * 6).toFixed(1)}s;--w:${(-rnd() * 8).toFixed(1)}s;--x:${Math.round((rnd() - .5) * 90)}px;--y:${Math.round(-30 - rnd() * 70)}px`; box.append(e); }
    }
    if (on && this.motes && this.nightEl && this.motes.previousElementSibling !== this.nightEl) this.nightEl.after(this.motes);
    if (this.motes) this.motes.style.display = on ? '' : 'none';
  }
  /** A layer's wish; the alphas ease (and the uniforms are written) only when one changed. */
  aim(L, want, target, density) { if (L.want === want && L.target === target && L.density === density) return; L.want = want; L.target = target; L.density = density; this.settled = false; }
  info() { return { visible: this.points.visible, layers: this.layers.map(L => ({ preset: L.preset, alpha: +L.alpha.toFixed(2), density: +L.density.toFixed(2) })), sorts: this.sorts.map(S => +S.alpha.toFixed(2)), anchors: this.anchors, marks: this.marks, motes: this.motesOn, spawned: this.stats.spawned, live: this.live > 0 }; }
}

export function installVfx(world, installRoomView) {
  if (world.__vfx) return world.__vfx;
  const fx = world.__vfx = new Vfx(world);
  world.vfx = (type, arg) => { try { fx.act(type, arg); } catch (e) { console.warn('vfx', e); } };
  addEventListener('pointerdown', e => { fx.tap = fx.tapAt; fx.tapAt.x = e.clientX; fx.tapAt.y = e.clientY; }, { passive: true, capture: true });
  // The touch stick held: only then does the frame look at the stick for running dust.
  const stick = document.getElementById('joystick');
  if (stick) { stick.addEventListener('pointerdown', () => { fx.touch = true; }, { passive: true }); for (const k of ['pointerup', 'pointercancel', 'lostpointercapture']) stick.addEventListener(k, () => { fx.touch = false; }, { passive: true }); }
  installRoomView(world).onFrame(() => fx.frame());
  return fx;
}
