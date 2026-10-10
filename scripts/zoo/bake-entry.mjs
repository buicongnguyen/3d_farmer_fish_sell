// Bakes Zoo Garden's own shot and summon models (shot-art.ts, shot-art-extra.ts, summon-art.ts: copied unchanged from cute_game
// src/) and the painter's shapes (disguise-fx.ts's geometry table) into one small file that zoo-paint.mjs draws from a
// vertex texture. Run through scripts/bake-zoo-shapes.mjs (it bundles this with esbuild so the .ts files load in node).
//
// A model is baked as its PARTS, not as one frozen lump: every object Zoo animates (userData.anim of shot-art-extra.ts: a flapping
// wing, a smoke puff, a flickering flame, a wobbling bead, a spinning star) is a part of its own, kept in that object's own space
// with the object's place, turn and size and Zoo's animation numbers beside it, so zoo-paint.mjs plays Zoo's playAnims() per
// instance. The halo and sparkle sprites are noted as numbers (size, colour, place, phase); the ink shell (a back-face ball) and
// additive pieces are parts with a flag; lit materials (Lambert / Standard) keep their plain colour and are lit by the game's scene.
import * as T from 'three';
import { makeShot, LOOK_OF } from './shot-art.ts';
import { makeSummon } from './summon-art.ts';

const TINT = '#12ab35', RAW = new T.Color(TINT);
const vivid = color => { const c = new T.Color(color), h = { h: 0, s: 0, l: 0 }; c.getHSL(h); return c.setHSL(h.h, Math.max(.75, h.s), .52); };
const TINTED = vivid(TINT), near = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) < .04;
const srgb = v => Math.max(0, Math.min(255, Math.round((v <= .0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - .055) * 255)));
/** Zoo's animation kinds (shot-art-extra.ts playAnims) as the numbers zoo-paint.mjs switches on; 10 is a summon's pulsing lamp. */
export const ANIM = { flap: 1, puff: 2, wob: 3, swirl: 4, flick: 5, twinkle: 6, zig: 7, spinz: 8, orbit: 9, pulse: 10 };
const r4 = v => +v.toFixed(4);

/**
 * One model: its parts, each {g: 0 solid / 1 translucent / 2 additive, t: takes the shot's colour, m: 0 plain / 1 lit flat / 2 lit
 * smooth / 3 ink shell, d: decoration (thinned first), an: null or [kind, a, b, px, py, pz, rx, ry, rz, sx, sy, sz], list: x y z r g b a
 * per vertex}, plus the halo [size, hex or '' for the shot's own colour] and the sparkles [[hex, size, x, y, z, phase]].
 */
function bakeObject(root, opts = {}) {
  const parts = new Map(), a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3(), n = new T.Vector3(), e1 = new T.Vector3(), e2 = new T.Vector3(), col = new T.Color(), rel = new T.Matrix4();
  const anims = new Map(); for (const x of root.userData.anim ?? []) anims.set(x.o, x);
  for (const [o, x] of opts.anims ?? []) anims.set(o, x);
  const out = { parts: [], halo: null, sparks: [] };
  root.updateMatrixWorld(true);
  root.traverse(o => {
    if (o.isSprite) {
      const hex = '#' + o.material.color.getHexString();
      if (o.name === 'halo') out.halo = [r4(o.scale.x), near(o.material.color, RAW) ? '' : hex];
      else out.sparks.push([hex, r4(o.userData.base ?? o.scale.x), r4(o.position.x), r4(o.position.y), r4(o.position.z), r4(anims.get(o)?.b ?? 0)]);
      return;
    }
    if (!o.isMesh || !o.visible) return;
    let owner = null; for (let q = o; q && q !== root; q = q.parent) if (anims.has(q)) { owner = q; break; }
    if (owner && owner.parent !== root) throw new Error('an animated part must be a child of the model');
    const m = o.material, ink = m.side === T.BackSide, add = m.blending === T.AdditiveBlending, opacity = m.transparent ? m.opacity : 1;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); g.applyMatrix4(owner ? rel.copy(owner.matrixWorld).invert().multiply(o.matrixWorld) : o.matrixWorld);
    const pos = g.getAttribute('position'), vc = m.vertexColors ? g.getAttribute('color') : null, lit = !m.isMeshBasicMaterial, tint = !vc && !ink && near(m.color, TINTED);
    const batch = add ? 2 : ink || opacity < .95 ? 1 : 0, mode = ink ? 3 : lit ? opts.smooth ? 2 : 1 : 0, an = owner ? anims.get(owner) : null;
    const key = [batch, tint ? 1 : 0, mode, owner ? owner.id : 0].join(); let part = parts.get(key);
    if (!part) {
      part = { g: batch, t: tint ? 1 : 0, m: mode, d: an && (an.t === 'puff' || an.t === 'twinkle') ? 1 : 0, an: null, list: [] }; parts.set(key, part);
      if (an) { const p = owner.position, r = owner.rotation, s = owner.scale; if (r.order !== 'XYZ') throw new Error('turn order'); part.an = [ANIM[an.t], an.a, an.b, p.x, p.y, p.z, r.x, r.y, r.z, s.x, s.y, s.z].map(r4); }
    }
    for (let i = 0; i < pos.count; i += 3) {
      a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
      n.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a)); if (n.lengthSq() < 1e-14) continue;
      for (let j = 0; j < 3; j++) {
        const p = j === 0 ? a : j === 1 ? b : c;
        if (tint) col.setRGB(1, 1, 1); else if (vc) col.fromBufferAttribute(vc, i + j); else col.copy(m.color);
        part.list.push(p.x, p.y, p.z, srgb(col.r), srgb(col.g), srgb(col.b), Math.round(opacity * 255));
      }
    }
    g.dispose();
  });
  // The ink shell first: it is drawn under the translucent ball it outlines (Zoo adds it first too).
  out.parts = [...parts.values()].sort((x, y) => (y.m === 3) - (x.m === 3));
  return out;
}
const mesh = (geometry, material) => new T.Mesh(geometry, material);
const flat = (opacity = 1) => new T.MeshBasicMaterial({ color: '#ffffff', transparent: opacity < 1, opacity });
/** A hand-made part: vertices as x y z alpha (white). */
const made = (g, list) => { const out = []; for (let i = 0; i < list.length; i += 4) out.push(list[i], list[i + 1], list[i + 2], 255, 255, 255, Math.round(list[i + 3] * 255)); return { parts: [{ g, t: 0, m: 0, d: 0, an: null, list: out }], halo: null, sparks: [] }; };
/** A flat disc of rings in the ground plane (or facing +z when `up`), alpha by radius: [[radius, alpha], ...] from the centre out. */
function disc(stops, n, up) {
  const list = [], at = (r, q, al) => up ? list.push(Math.cos(q) * r, Math.sin(q) * r, 0, al) : list.push(Math.sin(q) * r, 0, Math.cos(q) * r, al);
  for (let k = 0; k + 1 < stops.length; k++) for (let i = 0; i < n; i++) {
    const q0 = i / n * Math.PI * 2, q1 = (i + 1) / n * Math.PI * 2, [r0, a0] = stops[k], [r1, a1] = stops[k + 1];
    if (r0 > 0) { at(r0, q0, a0); at(r1, q0, a1); at(r1, q1, a1); at(r0, q0, a0); at(r1, q1, a1); at(r0, q1, a0); } else { at(0, 0, a0); at(r1, q0, a1); at(r1, q1, a1); }
  }
  return list;
}

export function bake() {
  // shot-art.ts makes its halo and sparkle sprites only where there is a document: a stand-in canvas is enough to read their numbers.
  globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, beginPath() {}, lineTo() {}, fill() {} }) }) };
  const models = {}, add = (name, model, flags = {}) => { for (const k in flags) if (!flags[k]) delete flags[k]; models[name] = { ...model, flags }; };
  // ---- the painter's shapes (Zoo disguise-fx.ts: the geometries and each material's opacity; mist and rock are its two lit ones)
  const heart = new T.Shape(); heart.moveTo(0, -.6); heart.bezierCurveTo(-1, .05, -.65, .85, 0, .4); heart.bezierCurveTo(.65, .85, 1, .05, 0, -.6);
  const star = new T.Shape(); for (let i = 0; i < 10; i++) { const q = i / 10 * Math.PI * 2, r = i % 2 ? .42 : 1; if (i) star.lineTo(Math.sin(q) * r, Math.cos(q) * r); else star.moveTo(Math.sin(q) * r, Math.cos(q) * r); }
  const G = { orb: new T.IcosahedronGeometry(1, 1), mist: new T.IcosahedronGeometry(1, 1), box: new T.BoxGeometry(1, 1, 1), cone: new T.ConeGeometry(1, 1, 6), ring: new T.RingGeometry(.94, 1, 40).rotateX(-Math.PI / 2), heart: new T.ShapeGeometry(heart), star: new T.ShapeGeometry(star), petal: new T.CircleGeometry(1, 10).rotateX(-Math.PI / 2), rock: new T.IcosahedronGeometry(1, 0), gorb: new T.IcosahedronGeometry(1, 1), gbox: new T.BoxGeometry(1, 1, 1), gring: new T.RingGeometry(.95, 1, 40).rotateX(-Math.PI / 2) };
  const OPACITY = { mist: .5, ring: .75, gorb: .6, gbox: .6, gring: .55 };
  for (const k in G) {
    const lit = k === 'mist' || k === 'rock', m = lit ? new T.MeshLambertMaterial({ color: '#ffffff', transparent: !!OPACITY[k], opacity: OPACITY[k] ?? 1 }) : flat(OPACITY[k] ?? 1);
    add(k, bakeObject(mesh(G[k], m), { smooth: k === 'mist' }));
  }
  // Zoo's cards, with their canvas gradients as vertex alpha (a canvas gradient is linear between its stops, so this is the same picture):
  // the scorch mark (skill-fx.ts burnCard), a shot's halo (shot-art.ts halo: additive), a sparkle (sparkMat: a four-point star, additive)
  // and the laser gaze's hit line on the ground (bandCard: crisp rims at its exact edges, a soft fill).
  add('scorch', made(1, disc([[0, .95], [.225, .7], [.5, 0]], 16)));
  add('halo', made(2, disc([[0, 1], [.175, .45], [.5, 0]], 16, true)));
  { const list = []; for (let i = 0; i < 8; i++) { const p = k => { const rr = (k % 2 ? 3 : 15) / 32, q = k * Math.PI / 4 - Math.PI / 2; list.push(Math.cos(q) * rr, Math.sin(q) * rr, 0, 1); }; list.push(0, 0, 0, 1); p(i); p((i + 1) % 8); } add('spark', made(2, list)); }
  { const list = [], S = [[0, 1], [.06, .95], [.09, .3], [.5, .5], [.91, .3], [.94, .95], [1, 1]], v = (u, z, al) => list.push(u - .5, 0, z, al); for (let i = 0; i + 1 < S.length; i++) { const [u0, a0] = S[i], [u1, a1] = S[i + 1]; v(u0, 0, a0); v(u0, 1, a0); v(u1, 1, a1); v(u0, 0, a0); v(u1, 1, a1); v(u1, 0, a1); } add('gband', made(1, list)); }
  add('dome', bakeObject(mesh(new T.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), flat())));
  // The mark over a shocked creature (Zoo shows ⚡ on its health bar): shot-art-extra.ts's bolt outline, upright, on a dark backing.
  { const s = new T.Shape(); [[0, 1.1], [.22, .45], [.06, .45], [.3, -.1], [.1, -.1], [.28, -1], [-.22, -.05], [-.05, -.05], [-.28, .5], [-.1, .5]].forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y));
    const g = new T.Group(), back = mesh(new T.ShapeGeometry(s), new T.MeshBasicMaterial({ color: '#3a2410' })), front = mesh(new T.ShapeGeometry(s), flat()); back.scale.set(1.45, 1.18, 1); back.position.z = -.02; g.add(back, front); add('zap', bakeObject(g)); }
  // ---- the shots (one per look; `pea` keeps its own yellow, every other bead takes the shot's colour)
  const looks = { bead: 'x', pea: 'pea' }; for (const [kind, look] of Object.entries(LOOK_OF)) if (look !== 'bead') looks[look] ??= kind;
  for (const [look, kind] of Object.entries(looks)) {
    const g = makeShot(kind, .22, TINT), u = g.userData, spin = u.billboard ? g.getObjectByName('spin') : null;
    // poseShot turns a billboard shot's `spin` child (rotation.z = time * 9): the same as a swirl of 9.
    add('shot_' + look, bakeObject(g, { anims: spin ? [[spin, { t: 'swirl', a: 9, b: 0 }]] : [] }), { yaw: !!(u.yaw || u.yawArc), bill: !!u.billboard, spin3: !!u.spin3, flicker: !!u.flicker });
  }
  // ---- the summons Willowmere did not have yet (summon-art.ts animateSummon: the lighthouse's lamp pulses .32 + .05 sin(9 t))
  for (const kind of ['tree', 'lighthouse', 'sandbag']) { const g = makeSummon(kind), lamp = g.getObjectByName('lamp'); add('sum_' + kind, bakeObject(g, { anims: lamp ? [[lamp, { t: 'pulse', a: .32, b: .05 }]] : [] })); }
  return models;
}
