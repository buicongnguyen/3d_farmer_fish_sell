// Zoo Garden's instanced shape painter for skill shots and effects (fetched with the box; nothing here is in the first load).
// Ported from cute_game src/disguise-fx.ts (the painter and its casts), skill-fx.ts (the laser gaze, lightning bolts, crackling
// shots, scorch marks), ribbons.ts (camera-facing ribbons, one draw), boulder-fx.ts (the lobbed rock) and combat-view.ts (how a shot
// is posed); the looks themselves are Zoo's skill-visuals.ts unchanged (zoo-looks.mjs) and the shot / summon models are Zoo's own
// shot-art.ts and summon-art.ts baked by scripts/bake-zoo-shapes.mjs into assets/models/zoo-shapes.bin (fetched on first use).
//
// Zoo keeps one InstancedMesh per shape (13) and a group of meshes per shot. Here every shape and every baked model is a row of one
// float texture (240 vertices a row: position and colour), and the vertex shader reads its row by gl_VertexID, so everything opaque
// is ONE instanced draw and everything translucent a second one, whatever mix of shapes a burst uses. A third (additive: the shots'
// halos and sparkles, a lighthouse beam), a fourth (the hex dome) and a fifth (ribbons) are drawn only while one is out. Fixed pools;
// nothing is created while a fight runs.
// A shot or a summon is drawn as its PARTS: each part Zoo animates (a flapping wing, a smoke puff, a flickering flame, a wobbling
// bead, a spinning star) has Zoo's own numbers beside it and is posed per instance every frame (anim() = Zoo's playAnims()).
// Lit shapes (mist, rock, the boulder, the summons) are lit in the vertex shader by the scene's own sky and sun, as Zoo's Lambert
// materials are; the ink shell of beads and bubbles is Zoo's back-face ball (front faces are dropped in the fragment shader).
import * as T from 'three';
import { LOOKS, LOOK_LIFE, MAX_PER_CAST } from './zoo-looks.mjs';
import { SHOT_COLORS } from './wilds-view.mjs';

const N = 240, CASTS = 48, TAU = Math.PI * 2;
/** Looks that stay on the hero (Zoo's FOLLOW). */
const FOLLOW = new Set(['tank', 'charge', 'parrot', 'shield', 'bats', 'rush', 'whirl', 'ribbon', 'kite', 'dragondance', 'starshield', 'torch']);
/** Zoo combat.ts GAZE and BOULDER. */
export const GAZE = { length: 13, width: 1, arc: 1.8, time: 1.2, rehit: .25 };
export const BOULDER = { range: 14, fallback: 8, time: .6, arc: 4, height: 3, radius: 4.5, power: 3.2, lift: 7 };
/** Shot kind -> Zoo's look (shot-art.ts LOOK_OF; `pea` keeps its own yellow bead). */
const SHOT_LOOK = { pea: 'pea', star: 'star', lotus: 'star', wave: 'water', surf: 'water', ice: 'shard', spike: 'thorn', thornburst: 'thorn', fire: 'fire', fireball: 'fireball', bubble: 'bubble', bigbubble: 'bubble', arrow: 'arrow', rainbow: 'rainbow', missile: 'missile', rocket: 'missile', boulder: 'rock', snowball: 'snow', dragon: 'dragon', shuriken: 'shuriken', thunderbolt: 'bolt', cannonball: 'cannonball', cannon: 'cannonball', drain: 'drain', bat: 'bat', eagle: 'eagle', parrot: 'parrot', anchor: 'anchor', hook: 'anchor', cork: 'cork' };
const ELECTRIC = { volt: 1, missile: 1 };
const EYE = { x: .21, y: .465, z: .55 }, GAZE_BEAM = { start: .7, end: .7 }, GAZE_SPREAD = GAZE.width / 2 - GAZE_BEAM.end / 2;
const WHITE = new T.Color('#ffffff'), HOT = new T.Color('#ff7a2a'), BURNT = new T.Color('#2b1a14'), GLOW_BLUE = new T.Color('#2a8cff'), CORE_WHITE = new T.Color('#f4fdff');
const LASER_GLOW = new T.Color('#ff2a1c'), LASER_MID = new T.Color('#ff7350'), LASER_CORE = new T.Color('#fff4ec'), BAND = new T.Color('#ff3a1a');
const BAR_BACK = new T.Color('#2a2633'), BAR_HIGH = new T.Color('#7be36a'), BAR_MID = new T.Color('#ffc43d'), BAR_LOW = new T.Color('#ff5a4a');
const M = new T.Matrix4(), M2 = new T.Matrix4(), L = new T.Matrix4(), MB = new T.Matrix4(), P2 = new T.Vector3(), Q2 = new T.Quaternion(), S2 = new T.Vector3(), P = new T.Vector3(), Q = new T.Quaternion(), S3 = new T.Vector3(), E = new T.Euler(), tmp = new T.Color(), eyeL = new T.Vector3(), eyeR = new T.Vector3(), U = new T.Vector3(), V = new T.Vector3(), D = new T.Vector3();
const rand = (a, b) => a + Math.random() * (b - a), wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const MAX_SEG = 16, forkAt = new Int8Array(4), SHOCK_MARK = 1.1, ZAP = new T.Color('#ffd23a'), ZAP_HOT = new T.Color('#fff7a8'), TURRET_CORE = new T.Color('#f2fdff'), TURRET_GLOW = new T.Color('#6fdcff'), FUSE = new T.Color('#ffb02e');
/** The scene's light for the lit shapes: the sun's direction and colour, the sky and the ground colour (each already × intensity / π, as three's Lambert has them). */
const LIGHTS = { zSun: { value: new T.Vector3(.35, .85, .4).normalize() }, zSc: { value: new T.Color(.6, .6, .6) }, zSky: { value: new T.Color(.6, .6, .6) }, zGnd: { value: new T.Color(.4, .4, .4) } };
/** Zoo skill-visuals.ts screenPulse: one soft pulse at the screen edges (a roar). A single reused element; skipped for reduced motion. */
let pulseEl = null;
export function screenPulse(color = '#ffb03a') {
  try {
    if (matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    if (!pulseEl) {
      const style = document.createElement('style'); style.textContent = '#skill-pulse{position:fixed;inset:0;z-index:30;pointer-events:none;opacity:0;box-shadow:inset 0 0 46px 10px var(--pulse,#ffb03a)}#skill-pulse.go{animation:skill-pulse .7s ease-out}@keyframes skill-pulse{0%{opacity:0}20%{opacity:.55}100%{opacity:0}}';
      pulseEl = document.createElement('div'); pulseEl.id = 'skill-pulse'; document.head.append(style); document.body.append(pulseEl);
    }
    pulseEl.style.setProperty('--pulse', color); pulseEl.classList.remove('go'); void pulseEl.offsetWidth; pulseEl.classList.add('go');
  } catch { /* no DOM */ }
}

/**
 * One instanced draw whose instances each pick a row of the shape texture. `kind`: 0 solid, 1 translucent, 2 additive. aK = row,
 * alpha, mode: 1 lit flat (rock, the summons), 2 lit smooth and front faces only (mist: Zoo's one single-sided translucent shape;
 * with both faces it would be twice as dense and dark), 3 the ink shell (back faces only).
 */
class Batch {
  constructor(texture, cap, kind) {
    const glow = kind > 0;
    const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.BufferAttribute(new Float32Array(N * 3), 3));
    this.k = new Float32Array(cap * 3); this.ka = new T.InstancedBufferAttribute(this.k, 3); this.ka.setUsage(T.DynamicDrawUsage); geometry.setAttribute('aK', this.ka);
    const material = new T.MeshBasicMaterial({ side: T.DoubleSide, forceSinglePass: true, transparent: glow, depthWrite: !glow, toneMapped: false, fog: false }); if (kind === 2) material.blending = T.AdditiveBlending;
    material.onBeforeCompile = shader => {
      shader.uniforms.zT = { value: texture }; Object.assign(shader.uniforms, LIGHTS);
      shader.vertexShader = 'uniform highp sampler2D zT;uniform vec3 zSun;uniform vec3 zSc;uniform vec3 zSky;uniform vec3 zGnd;\nattribute vec3 aK;\nvarying vec4 vZ;varying float vI;\n' + shader.vertexShader.replace('#include <begin_vertex>', `int zr=int(aK.x+.5);vec3 transformed=texelFetch(zT,ivec2(gl_VertexID,zr),0).xyz;vZ=texelFetch(zT,ivec2(gl_VertexID+${N},zr),0);vZ.a*=aK.y;vI=aK.z;
if(aK.z>.5&&aK.z<2.5){vec3 zn=transformed;if(aK.z<1.5){int zb=gl_VertexID-gl_VertexID%3;vec3 za=texelFetch(zT,ivec2(zb,zr),0).xyz;zn=cross(texelFetch(zT,ivec2(zb+1,zr),0).xyz-za,texelFetch(zT,ivec2(zb+2,zr),0).xyz-za);}
mat3 zm=mat3(instanceMatrix);zn=zm*(zn/vec3(dot(zm[0],zm[0]),dot(zm[1],zm[1]),dot(zm[2],zm[2])));float zl=length(zn);zn=zl>0.?zn/zl:vec3(0.,1.,0.);
vZ.rgb*=mix(zGnd,zSky,.5*zn.y+.5)+zSc*max(dot(zn,zSun),0.);}`);
      shader.fragmentShader = 'varying vec4 vZ;varying float vI;\n' + shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\nif(vI>1.5&&(vI>2.5)==gl_FrontFacing)discard;\ndiffuseColor*=vZ;');
    };
    material.customProgramCacheKey = () => 'zoo-paint2';
    const mesh = this.mesh = new T.InstancedMesh(geometry, material, cap);
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); mesh.setColorAt(0, WHITE); mesh.instanceColor.setUsage(T.DynamicDrawUsage);
    mesh.count = 0; mesh.visible = false; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false; mesh.renderOrder = kind === 2 ? 6 : glow ? 4 : 0; mesh.raycast = () => {}; mesh.name = kind === 2 ? 'zoo-halo' : glow ? 'zoo-glow' : 'zoo-solid';
    this.m = mesh.instanceMatrix.array; this.c = mesh.instanceColor.array; this.n = 0; this.cap = cap;
  }
  commit() {
    const n = this.n, mesh = this.mesh; if (!n && !mesh.count) { mesh.visible = false; return; }
    mesh.count = n; mesh.visible = n > 0; if (!n) return;
    let a = mesh.instanceMatrix; a.clearUpdateRanges(); a.addUpdateRange(0, n * 16); a.needsUpdate = true;
    a = mesh.instanceColor; a.clearUpdateRanges(); a.addUpdateRange(0, n * 3); a.needsUpdate = true;
    if (this.ka) { a = this.ka; a.clearUpdateRanges(); a.addUpdateRange(0, n * 3); a.needsUpdate = true; }
  }
}
/** Zoo's dome material (disguise-fx.ts domeMaterial): a fresnel rim plus a faint honeycomb on a plain basic material. */
function domeMaterial() {
  const m = new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .3, side: T.DoubleSide, forceSinglePass: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false, fog: false });
  m.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vN;varying vec3 vV;varying vec3 vP;').replace('#include <project_vertex>', '#include <project_vertex>\nvec3 nn=normal;\n#ifdef USE_INSTANCING\nnn=mat3(instanceMatrix)*nn;\n#endif\nvN=normalize(normalMatrix*nn);vV=normalize(-mvPosition.xyz);vP=position;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vN;varying vec3 vV;varying vec3 vP;\nfloat hexd(vec2 p){p=abs(p);return max(dot(p,vec2(.866,.5)),p.y);}')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\nfloat rim=pow(1.-abs(dot(normalize(vN),normalize(vV))),2.2);vec2 g=vP.xz*3.2+vec2(vP.y*1.6,0.);vec2 r=vec2(1.,1.732);vec2 a=mod(g,r)-r*.5;vec2 b=mod(g-r*.5,r)-r*.5;vec2 gv=dot(a,a)<dot(b,b)?a:b;float edge=smoothstep(.40,.48,hexd(gv));gl_FragColor.rgb*=.25+rim*1.6+edge*.9;gl_FragColor.a*=.25+rim*.9+edge*.5;');
  };
  m.customProgramCacheKey = () => 'zoo-dome';
  return m;
}
/** Zoo's ribbons.ts: camera-facing glowing quads in one instanced draw (soft glow or hard core by `hard`). */
const RIBBON_VERTEX = `
attribute vec3 aStart; attribute vec3 aEnd; attribute vec3 aShape; attribute vec4 aColor;
varying vec4 vColor; varying float vAcross; varying float vHard;
void main(){
  vec3 s=(modelViewMatrix*vec4(aStart,1.)).xyz, e=(modelViewMatrix*vec4(aEnd,1.)).xyz;
  vec3 p=mix(s,e,position.x), side=cross(e-s,p);
  float l=length(side); side=l>1e-6?side/l:vec3(1.,0.,0.);
  p+=side*position.y*mix(aShape.x,aShape.y,position.x)*.5;
  vAcross=position.y; vColor=aColor; vHard=aShape.z; gl_Position=projectionMatrix*vec4(p,1.);
}`;
const RIBBON_FRAGMENT = `
varying vec4 vColor; varying float vAcross; varying float vHard;
void main(){
  float k=1.-abs(vAcross);
  gl_FragColor=vec4(vColor.rgb,vColor.a*mix(k*(.35+.65*k),smoothstep(0.,.45,k),vHard));
  #include <colorspace_fragment>
}`;
class Ribbons {
  constructor(max) {
    this.max = max; this.count = 0;
    // An InstancedMesh with its own shader (its instanceMatrix is not read): three's InstancedBufferGeometry is not in the first load.
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.BufferAttribute(new Float32Array([0, -1, 0, 1, -1, 0, 0, 1, 0, 1, 1, 0]), 3)); geometry.setIndex([0, 1, 2, 2, 1, 3]);
    this.start = new Float32Array(max * 3); this.end = new Float32Array(max * 3); this.shape = new Float32Array(max * 3); this.color = new Float32Array(max * 4);
    this.attributes = [new T.InstancedBufferAttribute(this.start, 3), new T.InstancedBufferAttribute(this.end, 3), new T.InstancedBufferAttribute(this.shape, 3), new T.InstancedBufferAttribute(this.color, 4)];
    ['aStart', 'aEnd', 'aShape', 'aColor'].forEach((name, i) => { this.attributes[i].setUsage(T.DynamicDrawUsage); geometry.setAttribute(name, this.attributes[i]); });
    this.mesh = new T.InstancedMesh(geometry, new T.ShaderMaterial({ vertexShader: RIBBON_VERTEX, fragmentShader: RIBBON_FRAGMENT, transparent: true, depthWrite: false, side: T.DoubleSide }), max); this.mesh.count = 0;
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 5; this.mesh.visible = false; this.mesh.raycast = () => {}; this.mesh.name = 'zoo-ribbons';
  }
  add(ax, ay, az, bx, by, bz, widthA, widthB, c, alpha, hard = 0) {
    if (this.count >= this.max || !(alpha > 0)) return;
    const i = this.count++;
    this.start[i * 3] = ax; this.start[i * 3 + 1] = ay; this.start[i * 3 + 2] = az; this.end[i * 3] = bx; this.end[i * 3 + 1] = by; this.end[i * 3 + 2] = bz;
    this.shape[i * 3] = widthA; this.shape[i * 3 + 1] = widthB; this.shape[i * 3 + 2] = hard;
    this.color[i * 4] = c.r; this.color[i * 4 + 1] = c.g; this.color[i * 4 + 2] = c.b; this.color[i * 4 + 3] = Math.min(1, alpha);
  }
  commit() {
    this.mesh.count = this.count; this.mesh.visible = this.count > 0; if (!this.count) return;
    for (let i = 0; i < 4; i++) { const a = this.attributes[i]; a.clearUpdateRanges(); a.addUpdateRange(0, this.count * a.itemSize); a.needsUpdate = true; }
  }
}

const vividOf = hex => { const c = new T.Color(hex), h = { h: 0, s: 0, l: 0 }; c.getHSL(h); return c.setHSL(h.h, Math.max(.75, h.s), .52); };

export class ZooPaint {
  constructor(fx) {
    this.fx = fx; this.ready = false; this.loading = null; this.root = new T.Group(); this.root.name = 'zoo-paint'; this.time = 0; this.n = 1; this.painted = 0; this.maxPainted = 0;
    this.casts = Array.from({ length: CASTS }, () => ({ live: false, fn: null, x: 0, z: 0, r: 1, f: 0, color: '#fff', age: 0, life: 1, follow: false, seq: 0 })); this.seq = 0;
    this.ctx = { x: 0, y: 0, z: 0, r: 1, t: 0, a: 0, f: 0, color: '#fff', n: 1, life: 1 };
    this.colors = new Map(); this.tints = new Map(); this.prim = {}; this.models = {}; this.shots = {};
    this.lobs = Array.from({ length: 8 }, () => ({ live: false, x0: 0, y0: 0, z0: 0, x1: 0, z1: 0, age: 0, dur: 1 }));
    this.gz = { live: false, x: 0, z: 0, angle: 0, rate: 0, seen: 0, until: 0, age: 0, sx: NaN, sz: 0, spark: 0 };
    this.bolts = Array.from({ length: 40 }, () => ({ live: false, a: new Float32Array(3), b: new Float32Array(3), seg: new Float32Array(MAX_SEG * 6), n: 0, forks: 0, life: 0, max: 1, width: .1, jag: .2, branches: 0, next: 0, flicker: 1 }));
    this.decals = Array.from({ length: 48 }, () => ({ live: false, x: 0, z: 0, r: .4, age: 0, life: 2 }));
    this.crackles = new Float32Array(24 * 5); this.crackleCount = 0; this.lastZap = -1;
    this.shocked = new Array(32).fill(null); this.shockN = 0; this.cq = new T.Quaternion(); this.world = null; this.raws = new Map();
  }
  /** Fetches and unpacks the shapes once; a failed fetch is tried again on the next call. Until it is here the old spark looks are used. */
  load() {
    return this.loading ??= fetch('./assets/models/zoo-shapes.bin').then(r => { if (!r.ok) throw new Error(String(r.status)); return r.arrayBuffer(); }).then(buffer => { this.build(buffer); }).catch(error => { this.loading = null; console.warn('The fight effects could not load.', error); });
  }
  build(buffer) {
    const view = new DataView(buffer), hl = view.getUint32(0, true), head = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 4, hl)));
    const pos = new Int16Array(buffer, 4 + hl, head.verts * 3), col = new Uint8Array(buffer, 4 + hl + head.verts * 6, head.verts * 4), lin = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const v = i / 255; lin[i] = v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }
    // Parts with the same vertices (the same unit ball in many shots) share their rows.
    let rows = 0, dome = null; const rowOf = new Map(), filled = new Set();
    for (const name in head.models) if (name !== 'dome') for (const p of head.models[name].parts) { const key = p.o + ':' + p.n + ':' + head.models[name].ext; if (!rowOf.has(key)) { rowOf.set(key, rows); rows += Math.ceil(p.n / N); } }
    const data = new Float32Array(rows * N * 2 * 4);
    for (const name in head.models) {
      const m = head.models[name], k = m.ext / 32767;
      if (name === 'dome') { const p = m.parts[0]; dome = new Float32Array(p.n * 3); for (let i = 0; i < p.n * 3; i++) dome[i] = pos[p.o * 3 + i] * k; continue; }
      // One entry per row: which batch (0 solid, 1 translucent, 2 additive), the row, whether it takes the shot's colour, its mode (1 lit flat, 2 lit smooth, 3 ink), Zoo's animation of it, decoration.
      const out = { flags: m.flags ?? {}, bi: [], rows: [], tint: [], mode: [], an: [], deco: [], halo: m.halo ? m.halo[0] : 0, haloColor: m.halo?.[1] ? new T.Color(m.halo[1]) : null, sparks: (m.sparks ?? []).map(s => ({ c: new T.Color(s[0]), s: s[1], x: s[2], y: s[3], z: s[4], ph: s[5] })) };
      for (const p of m.parts) for (let at = 0, row = rowOf.get(p.o + ':' + p.n + ':' + m.ext); at < p.n; at += N, row++) {
        if (!filled.has(row)) {
          filled.add(row); const count = Math.min(N, p.n - at), base = row * N * 8;
          for (let i = 0; i < count; i++) { const v = p.o + at + i, o = base + i * 4, c = base + (N + i) * 4; data[o] = pos[v * 3] * k; data[o + 1] = pos[v * 3 + 1] * k; data[o + 2] = pos[v * 3 + 2] * k; data[c] = lin[col[v * 4]]; data[c + 1] = lin[col[v * 4 + 1]]; data[c + 2] = lin[col[v * 4 + 2]]; data[c + 3] = col[v * 4 + 3] / 255; }
        }
        out.bi.push(p.g); out.rows.push(row); out.tint.push(p.t); out.mode.push(p.m ?? 0); out.an.push(p.an ?? null); out.deco.push(p.d ? 1 : 0);
      }
      this.models[name] = out;
    }
    // RGBA (the default) floats: 1015 is three's FloatType, which the first load does not export.
    const texture = this.texture = new T.DataTexture(data, N * 2, rows, undefined, 1015); texture.needsUpdate = true;
    this.solid = new Batch(texture, 1200, 0); this.glow = new Batch(texture, 900, 1); this.add = new Batch(texture, 200, 2); this.bs = [this.solid, this.glow, this.add];
    for (const name in this.models) { const m = this.models[name]; if (m.rows.length === 1 && !name.includes('_')) this.prim[name] = { b: this.bs[m.bi[0]], row: m.rows[0], mode: m.mode[0] }; }
    const dg = new T.BufferGeometry(), normals = new Float32Array(dome.length);
    for (let i = 0; i < dome.length; i += 3) { const l = Math.hypot(dome[i], dome[i + 1], dome[i + 2]) || 1; normals[i] = dome[i] / l; normals[i + 1] = dome[i + 1] / l; normals[i + 2] = dome[i + 2] / l; }
    dg.setAttribute('position', new T.BufferAttribute(dome, 3)); dg.setAttribute('normal', new T.BufferAttribute(normals, 3));
    const dm = new T.InstancedMesh(dg, domeMaterial(), 6); dm.instanceMatrix.setUsage(T.DynamicDrawUsage); dm.setColorAt(0, WHITE); dm.instanceColor.setUsage(T.DynamicDrawUsage); dm.count = 0; dm.visible = false; dm.frustumCulled = false; dm.castShadow = false; dm.renderOrder = 5; dm.raycast = () => {}; dm.name = 'zoo-dome';
    this.dome = { mesh: dm, m: dm.instanceMatrix.array, c: dm.instanceColor.array, k: null, ka: null, n: 0, cap: 6, commit: Batch.prototype.commit }; this.prim.dome = { b: this.dome, row: 0 };
    this.ribbons = new Ribbons(512);
    this.root.add(this.solid.mesh, this.glow.mesh, this.add.mesh, dm, this.ribbons.mesh); this.fx.root.add(this.root); this.ready = true;
  }
  /** A shot's own colour as it is (Zoo gives the halo of a bead the plain colour, the bead itself the vivid one). */
  rawOf(kind) { let c = this.raws.get(kind); if (!c) this.raws.set(kind, c = new T.Color(SHOT_COLORS[kind] ?? (kind.includes('fire') ? SHOT_COLORS.fire : SHOT_COLORS.pea))); return c; }
  colorOf(hex) { let c = this.colors.get(hex); if (!c) { c = new T.Color(hex); if (this.colors.size < 256) this.colors.set(hex, c); } return c; }
  tintOf(kind) { let c = this.tints.get(kind); if (!c) this.tints.set(kind, c = vividOf(SHOT_COLORS[kind] ?? (kind.includes('fire') ? SHOT_COLORS.fire : SHOT_COLORS.pea))); return c; }
  /** One instance: batch, texture row, alpha, colour, place, size, turn (Euler `order`). */
  inst(b, row, alpha, color, x, y, z, sx, sy, sz, rx, ry, rz, order, mode = 0) {
    const i = b.n; if (i >= b.cap) return; b.n++;
    MB.compose(P.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz, order)), S3.set(sx, sy, sz)); MB.toArray(b.m, i * 16);
    b.c[i * 3] = color.r; b.c[i * 3 + 1] = color.g; b.c[i * 3 + 2] = color.b; if (b.k) { b.k[i * 3] = row; b.k[i * 3 + 1] = alpha; b.k[i * 3 + 2] = mode; }
  }
  /** One shape square to the camera, as a sprite is (a halo, a sparkle, the mark over a shocked creature). */
  bill(k, alpha, color, x, y, z, size) {
    const b = k.b, i = b.n; if (i >= b.cap) return; b.n++;
    MB.compose(P.set(x, y, z), this.cq, S3.set(size, size, size)); MB.toArray(b.m, i * 16);
    b.c[i * 3] = color.r; b.c[i * 3 + 1] = color.g; b.c[i * 3 + 2] = color.b; b.k[i * 3] = k.row; b.k[i * 3 + 1] = alpha; b.k[i * 3 + 2] = 0;
  }
  /** Zoo's Painter.put: the looks of zoo-looks.mjs draw with it. */
  put(kind, color, x, y, z, sx, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) {
    const k = this.prim[kind]; if (!k || this.painted >= MAX_PER_CAST) return; this.painted++;
    this.inst(k.b, k.row, 1, this.colorOf(color), x, y, z, Math.max(1e-4, sx), Math.max(1e-4, sy), Math.max(1e-4, sz), rx, ry, rz, 'YXZ', k.mode);
  }
  /** Zoo's playAnims() for one part (shot-art-extra.ts): the part's own place, turn and size at `t`, into L. `a` = [kind, a, b, place, turn, size]. */
  anim(a, t, seed) {
    let px = a[3], py = a[4], pz = a[5], rx = a[6], ry = a[7], rz = a[8], sx = a[9], sy = a[10], sz = a[11]; const A = a[1], B = a[2];
    switch (a[0]) {
      case 1: rz = A * Math.sin(t * 20 + seed) * .7; break;
      case 2: { const ph = (t * 3 + A) % 1; pz = -B * (.5 + ph); sx = sy = sz = Math.max(.01, B * .22 * (1 - ph * .6)); break; }
      case 3: px = Math.sin(t * 12 + A) * B; break;
      case 4: rz = t * A; break;
      case 5: sz = A * (1.4 + .5 * Math.sin(t * 34 + seed)); break;
      case 6: sx = sy = sz = Math.max(.02, A ? A * (.6 + .5 * Math.sin(t * 26)) : (.5 + .5 * Math.abs(Math.sin(t * 9 + B))) * a[9]); break;
      case 7: sx = A * (.85 + .3 * Math.abs(Math.sin(t * 40 + seed))); break;
      case 8: ry = t * A; break;
      case 9: rz = t * A + B; break;
      case 10: sx = sy = sz = A + B * Math.sin(t * 9); break;
    }
    L.compose(P2.set(px, py, pz), Q2.setFromEuler(E.set(rx, ry, rz, 'XYZ')), S2.set(sx, sy, sz));
  }
  /**
   * A baked model (a shot, a summon; by name or the model itself): its rigid rows with one matrix, each animated part with its own
   * (Zoo's animation at `time`; `seed` shifts the phase as Zoo's does). `tint` colours the parts Zoo paints in the shot's own
   * colour. `thin` < 1 (phones, the governor) drops every second decoration (a smoke puff, a fuse spark); below .4 all of them.
   * The model's matrix is left in M.
   */
  model(name, tint, x, y, z, k, rx, ry, rz, sy = k, time = 0, seed = 0, thin = 1) {
    const m = typeof name === 'string' ? this.models[name] : name; if (!m) return;
    M.compose(P.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz, 'XYZ')), S3.set(k, sy, k));
    for (let j = 0; j < m.rows.length; j++) {
      if (m.deco[j] && (thin < .4 || thin < 1 && (j & 1))) continue;
      const b = this.bs[m.bi[j]], i = b.n; if (i >= b.cap) continue; b.n++;
      const a = m.an[j], c = m.tint[j] ? tint : WHITE; let W = M; if (a) { this.anim(a, time, seed); W = M2.multiplyMatrices(M, L); }
      W.toArray(b.m, i * 16); b.c[i * 3] = c.r; b.c[i * 3 + 1] = c.g; b.c[i * 3 + 2] = c.b; b.k[i * 3] = m.rows[j]; b.k[i * 3 + 1] = 1; b.k[i * 3 + 2] = m.mode[j];
    }
  }
  /** Zoo's DisguiseFx.play: a look at a place for a while. False when the look is not one of Zoo's. */
  play(look, x, z, r, f, life, color) {
    const fn = LOOKS[look]; if (!fn || !this.ready || !Number.isFinite(x + z + r)) return false;
    let c = null; for (let i = 0; i < CASTS; i++) { const o = this.casts[i]; if (!o.live) { c = o; break; } if (!c || o.seq < c.seq) c = o; }
    c.live = true; c.fn = fn; c.x = x; c.z = z; c.r = Math.max(0, Math.min(40, r)); c.f = f ?? 0; c.color = color || '#cfb5f5'; c.age = 0; c.life = Math.max(.05, Math.min(12, life || LOOK_LIFE[look] || .6)); c.follow = FOLLOW.has(look); c.seq = ++this.seq;
    return true;
  }
  /** A look that should end now (a shield knocked down, a wall destroyed). */
  stop(look) { const fn = LOOKS[look]; for (let i = 0; i < CASTS; i++) if (this.casts[i].fn === fn) this.casts[i].live = false; }
  /** Superhero boulder: lobbed from above the hero to the landing spot in `dur` s (Zoo boulder-fx.ts). */
  lob(x0, y0, z0, x1, z1, dur) { let l = this.lobs[0]; for (let i = 0; i < 8; i++) { if (!this.lobs[i].live) { l = this.lobs[i]; break; } } l.live = true; l.x0 = x0; l.y0 = y0 + BOULDER.height; l.z0 = z0; l.x1 = x1; l.z1 = z1; l.age = 0; l.dur = Math.max(.05, dur); }
  /** The laser gaze: start it or steer it (Zoo skill-fx.ts gaze). */
  gaze(x, z, angle, hold) {
    const g = this.gz;
    if (!g.live) { g.live = true; g.angle = angle; g.rate = 0; g.seen = this.time; g.age = 0; g.sx = NaN; g.spark = 0; }
    else { const gap = this.time - g.seen; if (gap > .004) g.rate = Math.max(-4, Math.min(4, wrap(angle - g.angle) / gap)); g.angle = angle; g.seen = this.time; }
    g.x = x; g.z = z; g.until = this.time + hold;
  }
  /** A laser hit: sparks and a scorch on the ground (Zoo burn). */
  burn(x, z) { const fx = this.fx; fx.burst(x, .6, z, Math.ceil(9 * this.n), ['#ffffff', '#ffd27a', '#ff6a3a'], 4.5, 4, .08, .45, true); fx.burst(x, .3, z, 3, ['#4a3a34', '#6a5a52'], 1, 2.5, .12, .7); this.decal(x, z, .5, 2.4); }
  /** An electric burst (Zoo shock): flash, branching arcs, sparks, a ring. */
  shock(x, z, radius, strong = radius >= 1.5, mark = true) {
    const fx = this.fx, r = Math.max(.6, radius); if (mark) this.mark(x, z, r);
    fx.burst(x, .6, z, Math.ceil((strong ? 12 : 6) * this.n), ['#ffffff', '#bfefff', '#5fbfff'], 5 + r, 3, .08, .35, true);
    if (strong) fx.ring(x, z, r, '#9fe6ff', .28, .3, .12);
    const count = Math.max(2, Math.round((strong ? 6 : 3) * this.n));
    for (let i = 0; i < count; i++) { const a = (i + Math.random() * .7) / count * TAU, d = r * rand(.55, 1); this.bolt(x, rand(.7, 1), z, x + Math.sin(a) * d, rand(.05, .8), z + Math.cos(a) * d, rand(.2, .32), strong ? .14 : .1, .16, strong ? 2 : 1); }
    if (this.time - this.lastZap > .09) { this.lastZap = this.time; fx.play('zap'); }
  }
  /** ⚡ on every living creature within r of a spot for SHOCK_MARK seconds (Zoo skill-fx.ts shock: `t.shock`). At most 32 at once. */
  mark(x, z, r) {
    const list = this.world?.pandora?.combat?.host.targets(); if (!list) return;
    for (let i = 0; i < list.length; i++) {
      const e = list[i]; if (!(e.hp > 0) || Math.hypot(e.x - x, e.z - z) > r + (e.radius ?? .5)) continue;
      let on = e.shock > 0; if (!on && this.shockN < 32) { this.shocked[this.shockN++] = e; on = true; } if (on) e.shock = SHOCK_MARK;
    }
  }
  bolt(ax, ay, az, bx, by, bz, life = .2, width = .1, jag = .16, branches = 1) {
    let b = this.bolts[0]; for (let i = 0; i < this.bolts.length; i++) { const o = this.bolts[i]; if (!o.live) { b = o; break; } if (o.life < b.life) b = o; }
    b.live = true; b.a[0] = ax; b.a[1] = ay; b.a[2] = az; b.b[0] = bx; b.b[1] = by; b.b[2] = bz; b.life = b.max = life; b.width = width; b.jag = jag; b.branches = branches; b.next = 0;
  }
  decal(x, z, r, life) { let d = this.decals[0]; for (let i = 0; i < this.decals.length; i++) { const o = this.decals[i]; if (!o.live) { d = o; break; } if (o.life - o.age < d.life - d.age) d = o; } d.live = true; d.x = x; d.z = z; d.r = r; d.age = 0; d.life = life; }
  clear() {
    for (const c of this.casts) c.live = false; for (const l of this.lobs) l.live = false; for (const b of this.bolts) b.live = false; for (const d of this.decals) d.live = false; this.gz.live = false; this.crackleCount = 0;
    for (let i = 0; i < this.shockN; i++) { this.shocked[i].shock = 0; this.shocked[i] = null; } this.shockN = 0;
    if (!this.ready) return; this.solid.n = this.glow.n = this.add.n = this.dome.n = 0; this.ribbons.count = 0; this.solid.commit(); this.glow.commit(); this.add.commit(); this.dome.commit(); this.ribbons.commit();
  }

  /** Every frame, after the world has moved the hero: age the casts and paint everything that is out. */
  frame(dt, world) {
    if (!this.ready) return;
    const fx = this.fx, hero = world.player, combat = world.pandora?.combat, ok = world.location === 'village', ctx = this.ctx, time = this.time += dt;
    this.n = (world.step ?? 0) >= 2 ? .35 : (world.step ?? 0) > 0 || world.state?.settings?.quality === 'battery' || Math.min(innerWidth, innerHeight) < 500 ? .5 : 1;
    this.solid.n = this.glow.n = this.add.n = this.dome.n = 0; this.ribbons.count = 0; this.maxPainted = 0; this.world = world; this.cq.copy(world.camera.quaternion);
    // The scene's own light for the lit shapes (three's Lambert: colour × intensity / π).
    const amb = world.ambient, sun = world.sun;
    if (amb?.groundColor) { LIGHTS.zSky.value.copy(amb.color).multiplyScalar(amb.intensity / Math.PI); LIGHTS.zGnd.value.copy(amb.groundColor).multiplyScalar(amb.intensity / Math.PI); }
    if (sun?.target) { LIGHTS.zSc.value.copy(sun.color).multiplyScalar(sun.visible === false ? 0 : sun.intensity / Math.PI); LIGHTS.zSun.value.copy(sun.position).sub(sun.target.position).normalize(); }
    if (ok) {
      for (let i = 0; i < CASTS; i++) {
        const c = this.casts[i]; if (!c.live) continue; c.age += dt; if (c.age >= c.life) { c.live = false; continue; }
        if (c.follow && hero) { ctx.x = hero.position.x; ctx.z = hero.position.z; ctx.y = hero.position.y + .12; ctx.f = hero.rotation.y; } else { ctx.x = c.x; ctx.z = c.z; ctx.y = .12; ctx.f = c.f; }
        ctx.r = c.r; ctx.t = Math.min(1, c.age / c.life); ctx.a = c.age; ctx.color = c.color; ctx.n = this.n; ctx.life = c.life;
        this.painted = 0; c.fn(this, ctx); if (this.painted > this.maxPainted) this.maxPainted = this.painted;
      }
      this.painted = -1e9;
      if (combat) { for (let i = 0; i < combat.shots.length; i++) { const s = combat.shots[i]; if (s.live) this.shot(s, time); } if (combat.al) this.allies(combat, world, time); }
      for (let i = 0; i < 8; i++) { const l = this.lobs[i]; if (!l.live) continue; l.age += dt; const t = Math.min(1, l.age / l.dur); this.model('shot_rock', WHITE, l.x0 + (l.x1 - l.x0) * t, l.y0 + (0 - l.y0) * t + Math.sin(t * Math.PI) * BOULDER.arc, l.z0 + (l.z1 - l.z0) * t, 1.3 / .22, l.age * 7, l.age * 5, 0); if (l.age >= l.dur) l.live = false; }
      this.drawGaze(dt, hero); this.drawShocked(dt); this.drawBolts(dt); this.drawCrackles(); this.drawDecals(dt);
    }
    this.solid.commit(); this.glow.commit(); this.add.commit(); this.dome.commit(); this.ribbons.commit();
  }
  /** Shocked creatures count their ⚡ down (Zoo drawShocked): the mark rides over them, and they twitch with a small spark now and then. */
  drawShocked(dt) {
    const zap = this.prim.zap, time = this.time;
    for (let i = this.shockN - 1; i >= 0; i--) {
      const e = this.shocked[i]; e.shock = Math.max(0, (e.shock || 0) - dt);
      if (e.shock <= 0 || !(e.hp > 0)) { e.shock = 0; this.shocked[i] = this.shocked[--this.shockN]; this.shocked[this.shockN] = null; continue; }
      const r = e.radius ?? .5;
      if (Math.random() < dt * 7) { const a = Math.random() * TAU, d = r * rand(.4, .9), h = rand(.4, 1.2); this.bolt(e.x + Math.cos(a) * d, h, e.z + Math.sin(a) * d, e.x + Math.cos(a + 1.6) * d, h + rand(-.3, .3), e.z + Math.sin(a + 1.6) * d, .09, .05, .25, 0); }
      if (zap) this.bill(zap, 1, Math.sin(time * 31 + i) > .3 ? ZAP_HOT : ZAP, e.x, r * 2 + 1.05 + Math.sin(time * 9 + i) * .05, e.z, .5 * Math.min(1, e.shock * 6, (SHOCK_MARK - e.shock) * 14 + .3));
    }
  }
  /** One of the player's shots as Zoo draws it (combat-view.ts + poseShot): the look's model, turned and spun by its flags. */
  shot(s, time) {
    // The model of a shot kind is looked up once (no string is built per shot per frame).
    let m = this.shots[s.kind]; if (m === undefined) m = this.shots[s.kind] = this.models['shot_' + (SHOT_LOOK[s.kind] ?? 'bead')] ?? null; if (!m) return;
    const f = m.flags, snow = s.kind === 'snowball', r = s.radius || .22, y = s.kind === 'wave' ? .55 : snow ? r : 1.05; let k = Math.max(1, r / .22), rx = 0, ry = 0, rz = 0;
    if (snow) { rx = time * s.dz * 7; rz = -time * s.dx * 7; } else if (f.bill) rx = -.9; else if (f.spin3) { rx = time * 7; ry = time * 5; } else if (f.yaw) ry = Math.atan2(s.dx, s.dz);
    if (f.flicker) k *= 1 + .1 * Math.sin(time * 30);
    const thin = this.n; this.model(m, this.tintOf(s.kind), s.x, y, s.z, k, rx, ry, rz, k, time, s.x * 3 + s.z, thin);
    // Zoo's additive halo (it breathes) and its twinkling sparkles: left out on the last governor steps, the sparkles on phones too.
    if (thin > .4) {
      if (m.halo) this.bill(this.prim.halo, .55, m.haloColor ?? this.rawOf(s.kind), s.x, y, s.z, m.halo * k * (1 + .12 * Math.sin(time * 18 + s.x)));
      if (thin >= 1) for (let i = 0; i < m.sparks.length; i++) { const q = m.sparks[i]; P2.set(q.x, q.y, q.z).applyMatrix4(M); this.bill(this.prim.spark, 1, q.c, P2.x, P2.y, P2.z, (.5 + .5 * Math.abs(Math.sin(time * 9 + q.ph))) * q.s * k); }
    }
    if (ELECTRIC[s.kind] && this.crackleCount < 24) { const i = this.crackleCount++ * 5, q = this.crackles; q[i] = s.x; q[i + 1] = y; q[i + 2] = s.z; q[i + 3] = s.dx; q[i + 4] = s.dz; }
  }
  /** The summons Zoo has and Willowmere's helper models do not (tree, lighthouse, sandbag wall), and every hittable summon's little health bar. */
  allies(c, world, time) {
    const cam = world.camera.position;
    for (let i = 0; i < c.al.length; i++) {
      const a = c.al[i]; if (!a.live) continue;
      const grow = Math.max(.01, Math.min(1, (c.time - (a.born ?? 0)) * 7, a.life * 5)), frac = a.maxHp > 0 ? Math.max(0, a.hp / a.maxHp) : 1, hurt = a.hurt > 0 ? a.hurt : 0;
      const body = (.82 + .18 * frac) * grow, jolt = hurt > 0 ? Math.sin(hurt * 80) * .06 : 0;
      if (a.kind === 'tree') this.model('sum_tree', WHITE, a.x, 0, a.z, (body + jolt) * (1 + .03 * Math.sin(time * 3)), 0, a.f ?? 0, 0, body - jolt);
      else if (a.kind === 'lighthouse') this.model('sum_lighthouse', WHITE, a.x, 0, a.z, grow, 0, a.f ?? 0, 0, grow, time);
      else if (a.kind === 'sandbag') this.model('sum_sandbag', WHITE, a.x, 0, a.z, body + jolt, 0, a.f ?? 0, 0, body - jolt);
      else if (a.kind === 'turret') {
        // Zoo animateSummon: the tesla orb's white core breathes and its blue glow flares (additive; both faces are drawn here, so half Zoo's .45).
        const kk = grow * (.82 + .18 * frac + jolt), orb = this.prim.orb;
        this.inst(orb.b, orb.row, 1, TURRET_CORE, a.x, 1.22 * kk, a.z, (.24 + .04 * Math.sin(time * 23)) * kk, (.24 + .04 * Math.sin(time * 23)) * kk, (.24 + .04 * Math.sin(time * 23)) * kk, 0, 0, 0, 'YXZ');
        if (this.n > .4) { const g = (.4 + .08 * Math.abs(Math.sin(time * 31))) * kk; this.inst(this.add, orb.row, .23, TURRET_GLOW, a.x, 1.22 * kk, a.z, g, g, g, 0, 0, 0, 'YXZ'); }
      } else if (a.kind === 'cannon') {
        // ... and the cannon's fuse spark flickers.
        const kk = grow * (.82 + .18 * frac + jolt), orb = this.prim.orb, yaw = a.f ?? 0, g = (.08 + .08 * Math.abs(Math.sin(time * 22))) * kk;
        this.inst(orb.b, orb.row, 1, FUSE, a.x - Math.sin(yaw) * .62 * kk, kk, a.z - Math.cos(yaw) * .62 * kk, g, g, g, 0, 0, 0, 'YXZ');
      }
      if (!(a.maxHp > 0) || !(frac < .999 || hurt > 0)) continue;
      // The bar: square to the camera, the fill growing from its left end (Zoo summonHealth).
      const top = a.kind === 'tree' ? 3.2 : a.kind === 'sandbag' ? 2.45 : a.kind === 'cannon' ? 1.55 : a.kind === 'turret' ? 1.8 : 2.1, yaw = Math.atan2(cam.x - a.x, cam.z - a.z), rx = Math.cos(yaw), rz = -Math.sin(yaw), fill = .94 * Math.max(.001, frac), off = -(.94 - fill) / 2, box = this.prim.box;
      this.inst(box.b, box.row, 1, BAR_BACK, a.x, top, a.z, 1, .14, .03, 0, yaw, 0, 'YXZ');
      this.inst(box.b, box.row, 1, frac > .6 ? BAR_HIGH : frac > .3 ? BAR_MID : BAR_LOW, a.x + rx * off + Math.sin(yaw) * .03, top, a.z + rz * off + Math.cos(yaw) * .03, fill, .09, .03, 0, yaw, 0, 'YXZ');
    }
  }
  drawGaze(dt, hero) {
    const g = this.gz; if (!g.live) return; g.age += dt;
    const time = this.time, fade = Math.min(1, g.age / .06) * Math.min(1, Math.max(0, (g.until + .12 - time) / .12)), R = this.ribbons;
    if (fade <= 0) { g.live = false; return; }
    const angle = g.angle + g.rate * Math.min(.05, time - g.seen), ox = hero ? hero.position.x : g.x, oz = hero ? hero.position.z : g.z, head = hero?.userData?.parts?.head;
    if (head) { head.updateWorldMatrix(true, false); eyeL.set(EYE.x, EYE.y, EYE.z).applyMatrix4(head.matrixWorld); eyeR.set(-EYE.x, EYE.y, EYE.z).applyMatrix4(head.matrixWorld); }
    else { const sx = Math.cos(angle) * .18, sz = -Math.sin(angle) * .18, fx = Math.sin(angle) * .46, fz = Math.cos(angle) * .46, y = (hero?.position.y ?? 0) + 1.33; eyeL.set(ox + fx + sx, y, oz + fz + sz); eyeR.set(ox + fx - sx, y, oz + fz - sz); }
    const fx = Math.sin(angle), fz = Math.cos(angle), sx = Math.cos(angle), sz = -Math.sin(angle), cx = ox + fx * GAZE.length, cz = oz + fz * GAZE.length, gy = .06;
    const pulse = fade * (.88 + .12 * Math.sin(time * 63)), wob = 1 + .07 * Math.sin(time * 47), band = this.prim.gband;
    // The hit line on the ground, as wide and as long as what is hit: Zoo's card (crisp rims at its exact edges, a soft warm fill).
    this.inst(band.b, band.row, .55 * fade, BAND, ox, .05, oz, GAZE.width, 1, GAZE.length, 0, angle, 0, 'YXZ');
    for (let k = 0; k < 2; k++) {
      const eye = k ? eyeR : eyeL, side = k ? -1 : 1, ex = cx + sx * GAZE_SPREAD * side, ez = cz + sz * GAZE_SPREAD * side;
      R.add(eye.x, eye.y, eye.z, ex, gy, ez, GAZE_BEAM.start * wob, GAZE_BEAM.end * wob, LASER_GLOW, .9 * pulse, 0);
      R.add(eye.x, eye.y, eye.z, ex, gy, ez, GAZE_BEAM.start * .52, GAZE_BEAM.end * .52, LASER_MID, pulse, .6);
      R.add(eye.x, eye.y, eye.z, ex, gy, ez, .18, .22, LASER_CORE, pulse, 1);
      R.add(eye.x - fx * .12, eye.y, eye.z - fz * .12, eye.x + fx * .18, eye.y, eye.z + fz * .18, .34, .3, LASER_MID, pulse, 0);
      R.add(eye.x - fx * .05, eye.y, eye.z - fz * .05, eye.x + fx * .08, eye.y, eye.z + fz * .08, .13, .11, LASER_CORE, pulse, 1);
    }
    R.add(cx - fx * .55, gy, cz - fz * .55, cx + fx * .3, gy, cz + fz * .3, GAZE.width * 1.1, GAZE.width * .9, LASER_GLOW, .55 * pulse, 0);
    R.add(cx - fx * .3, gy, cz - fz * .3, cx + fx * .15, gy, cz + fz * .15, .35, .3, LASER_CORE, .8 * pulse, .8);
    g.spark -= dt;
    if (g.spark <= 0 && fade > .5) { g.spark = this.n < 1 ? .1 : .05; this.fx.burst(cx, gy + .05, cz, 2, ['#ffffff', '#ffd27a', '#ff6a3a'], 3.5, 3.5, .08, .4, true); }
    if (!(Math.hypot(g.sx - cx, g.sz - cz) <= .45)) { this.decal(cx, cz, .42, 2.2); g.sx = cx; g.sz = cz; }
  }
  jag(b) {
    const ax = b.a[0], ay = b.a[1], az = b.a[2], d = D.set(b.b[0] - ax, b.b[1] - ay, b.b[2] - az), length = d.length() || 1, seg = b.seg;
    d.multiplyScalar(1 / length); U.set(0, 1, 0).cross(d); if (U.lengthSq() < 1e-4) U.set(1, 0, 0); U.normalize(); V.copy(d).cross(U);
    const points = Math.max(3, Math.min(9, Math.round(length / .32) + 2)), amp = b.jag * Math.min(1.4, length);
    let n = 0, forks = 0, px = ax, py = ay, pz = az;
    for (let i = 1; i < points; i++) {
      const s = i / (points - 1), taper = i === points - 1 ? 0 : Math.sin(s * Math.PI), ou = rand(-1, 1) * amp * taper, ov = rand(-1, 1) * amp * taper;
      const x = ax + d.x * length * s + U.x * ou + V.x * ov, y = ay + d.y * length * s + U.y * ou + V.y * ov, z = az + d.z * length * s + U.z * ou + V.z * ov, o = n++ * 6;
      seg[o] = px; seg[o + 1] = py; seg[o + 2] = pz; seg[o + 3] = x; seg[o + 4] = y; seg[o + 5] = z; px = x; py = y; pz = z;
      if (i < points - 1 && forks < b.branches && Math.random() < .45) forkAt[forks++] = n - 1;
    }
    for (let f = 0; f < forks && n + 2 <= MAX_SEG; f++) {
      const k = forkAt[f], reach = length * rand(.18, .32); let bx = seg[k * 6 + 3], by = seg[k * 6 + 4], bz = seg[k * 6 + 5];
      for (let step = 0; step < 2; step++) {
        const turn = rand(-.9, .9), x = bx + (d.x + U.x * turn) * reach * .5 + V.x * rand(-.3, .3) * reach, y = by + (d.y + U.y * turn) * reach * .5 + rand(-.15, .1), z = bz + (d.z + U.z * turn) * reach * .5 + V.z * rand(-.3, .3) * reach, o = n++ * 6;
        seg[o] = bx; seg[o + 1] = by; seg[o + 2] = bz; seg[o + 3] = x; seg[o + 4] = y; seg[o + 5] = z; bx = x; by = y; bz = z;
      }
    }
    b.n = n; b.forks = n - (points - 1); b.flicker = rand(.65, 1);
  }
  drawBolts(dt) {
    const R = this.ribbons;
    for (let j = 0; j < this.bolts.length; j++) {
      const b = this.bolts[j]; if (!b.live) continue; b.life -= dt; if (b.life <= 0) { b.live = false; continue; }
      b.next -= dt; if (b.next <= 0) { b.next = 1 / 30; this.jag(b); }
      const k = Math.sqrt(b.life / b.max) * b.flicker, s = b.seg;
      for (let i = 0; i < b.n; i++) { const o = i * 6, w = b.width * (i < b.n - b.forks ? 1 : .6); R.add(s[o], s[o + 1], s[o + 2], s[o + 3], s[o + 4], s[o + 5], w * 3.6, w * 3.6, GLOW_BLUE, .8 * k, 0); R.add(s[o], s[o + 1], s[o + 2], s[o + 3], s[o + 4], s[o + 5], w, w, CORE_WHITE, k, 1); }
    }
  }
  drawCrackles() {
    const R = this.ribbons, q = this.crackles;
    for (let i = 0; i < this.crackleCount; i++) {
      const o = i * 5, x = q[o], y = q[o + 1], z = q[o + 2], dx = q[o + 3], dz = q[o + 4];
      R.add(x - dx * .9, y, z - dz * .9, x, y, z, .06, .42, GLOW_BLUE, .75, 0); R.add(x - dx * .6, y, z - dz * .6, x, y, z, .02, .12, CORE_WHITE, .95, 1);
      for (let j = 0; j < 2; j++) {
        const a = Math.random() * TAU, r = rand(.2, .38), mx = x + Math.cos(a) * r * .5 + rand(-.08, .08), my = y + rand(-.15, .15), mz = z + Math.sin(a) * r * .5 + rand(-.08, .08), ex = x + Math.cos(a + rand(-.6, .6)) * r, ey = y + rand(-.25, .25), ez = z + Math.sin(a + rand(-.6, .6)) * r;
        R.add(x, y, z, mx, my, mz, .035, .03, CORE_WHITE, .9, 1); R.add(mx, my, mz, ex, ey, ez, .03, .02, CORE_WHITE, .8, 1); R.add(x, y, z, ex, ey, ez, .12, .08, GLOW_BLUE, .45, 0);
      }
    }
    this.crackleCount = 0;
  }
  drawDecals(dt) {
    const k = this.prim.scorch; if (!k) return;
    for (let i = 0; i < this.decals.length; i++) {
      const d = this.decals[i]; if (!d.live) continue; d.age += dt; if (d.age >= d.life) { d.live = false; continue; }
      const cool = Math.min(1, d.age / .4), shrink = d.age > d.life * .7 ? 1 - (d.age - d.life * .7) / (d.life * .3) : 1, r = d.r * (.8 + .2 * cool) * shrink * 2;
      this.inst(k.b, k.row, 1, tmp.copy(HOT).lerp(BURNT, cool), d.x, .04 + i * .0004, d.z, r, 1, r, 0, 0, 0, 'YXZ');
    }
  }
}
