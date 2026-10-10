// Bakes Zoo Garden's own shot and summon models (shot-art.ts, shot-art-extra.ts, summon-art.ts: copied unchanged from cute_game
// src/, fdd3056) and the painter's shapes (disguise-fx.ts's geometry table) into one small file that zoo-paint.mjs draws from a
// vertex texture. Run through scripts/bake-zoo-shapes.mjs (it bundles this with esbuild so the .ts files load in node).
import * as T from 'three';
import { makeShot, LOOK_OF } from './shot-art.ts';
import { makeSummon } from './summon-art.ts';

const LIGHT = new T.Vector3(.35, .85, .4).normalize(), TINT = '#12ab35';
const vivid = color => { const c = new T.Color(color), h = { h: 0, s: 0, l: 0 }; c.getHSL(h); return c.setHSL(h.h, Math.max(.75, h.s), .52); };
const TINTED = vivid(TINT), near = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) < .04;
const srgb = v => Math.max(0, Math.min(255, Math.round((v <= .0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - .055) * 255)));

/** One model: parts keyed by glow / tint, each a flat list of [x,y,z, r,g,b,a] per vertex (colours in sRGB bytes). */
function bakeObject(root, opts = {}) {
  const parts = new Map(), a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3(), n = new T.Vector3(), e1 = new T.Vector3(), e2 = new T.Vector3(), col = new T.Color();
  root.updateMatrixWorld(true);
  root.traverse(o => {
    if (!o.isMesh || !o.visible) return;
    const m = o.material; if (m.side === T.BackSide) return; // the toon ink shell needs a material of its own
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
    const pos = g.getAttribute('position'), vc = m.vertexColors ? g.getAttribute('color') : null;
    const lit = !m.isMeshBasicMaterial, opacity = m.transparent ? m.opacity : 1, glow = opacity < .95 || m.blending === T.AdditiveBlending, tint = !vc && near(m.color, TINTED);
    const key = (glow ? 'g' : 's') + (tint ? 't' : ''); let list = parts.get(key); if (!list) parts.set(key, list = []);
    for (let i = 0; i < pos.count; i += 3) {
      a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
      n.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a)); if (n.lengthSq() < 1e-14) continue; n.normalize();
      const shade = lit ? .66 + .34 * Math.max(0, n.dot(LIGHT)) + .06 * Math.max(0, -n.y) : 1;
      for (let j = 0; j < 3; j++) {
        const p = j === 0 ? a : j === 1 ? b : c;
        if (tint) col.setRGB(1, 1, 1); else if (vc) col.fromBufferAttribute(vc, i + j); else col.copy(m.color);
        const s = opts.smooth ? .7 + .3 * Math.max(0, e1.copy(p).normalize().dot(LIGHT)) : shade;
        list.push(p.x, p.y, p.z, srgb(col.r * s), srgb(col.g * s), srgb(col.b * s), Math.round(opacity * (opts.alpha ?? 1) * 255));
      }
    }
    g.dispose();
  });
  return parts;
}
const mesh = (geometry, material) => new T.Mesh(geometry, material);
const flat = (opacity = 1) => new T.MeshBasicMaterial({ color: '#ffffff', transparent: opacity < 1, opacity });

export function bake() {
  const models = {}, add = (name, parts, flags = {}) => { models[name] = { parts, flags }; };
  // ---- the painter's shapes (Zoo disguise-fx.ts: the geometries and each material's opacity)
  const heart = new T.Shape(); heart.moveTo(0, -.6); heart.bezierCurveTo(-1, .05, -.65, .85, 0, .4); heart.bezierCurveTo(.65, .85, 1, .05, 0, -.6);
  const star = new T.Shape(); for (let i = 0; i < 10; i++) { const q = i / 10 * Math.PI * 2, r = i % 2 ? .42 : 1; if (i) star.lineTo(Math.sin(q) * r, Math.cos(q) * r); else star.moveTo(Math.sin(q) * r, Math.cos(q) * r); }
  const G = { orb: new T.IcosahedronGeometry(1, 1), mist: new T.IcosahedronGeometry(1, 1), box: new T.BoxGeometry(1, 1, 1), cone: new T.ConeGeometry(1, 1, 6), ring: new T.RingGeometry(.94, 1, 40).rotateX(-Math.PI / 2), heart: new T.ShapeGeometry(heart, 6), star: new T.ShapeGeometry(star), petal: new T.CircleGeometry(1, 10).rotateX(-Math.PI / 2), rock: new T.IcosahedronGeometry(1, 0), gorb: new T.IcosahedronGeometry(1, 1), gbox: new T.BoxGeometry(1, 1, 1), gring: new T.RingGeometry(.95, 1, 40).rotateX(-Math.PI / 2) };
  const OPACITY = { mist: .5, ring: .75, gorb: .6, gbox: .6, gring: .55 };
  for (const k in G) {
    const lit = k === 'mist' || k === 'rock', m = lit ? new T.MeshLambertMaterial({ color: '#ffffff', transparent: !!OPACITY[k], opacity: OPACITY[k] ?? 1 }) : flat(OPACITY[k] ?? 1);
    add(k, bakeObject(mesh(G[k], m), { smooth: k === 'mist' }));
  }
  // A scorch mark: a soft dark disc (Zoo skill-fx.ts draws a radial-gradient card; here the fade is in the vertices' alpha).
  { const list = [], n = 16; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, b = (i + 1) / n * Math.PI * 2; list.push(0, 0, 0, 255, 255, 255, 242, Math.sin(a) * .5, 0, Math.cos(a) * .5, 255, 255, 255, 0, Math.sin(b) * .5, 0, Math.cos(b) * .5, 255, 255, 255, 0); } add('scorch', new Map([['g', list]])); }
  add('dome', bakeObject(mesh(new T.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), flat())));
  // ---- the shots (one per look; `pea` keeps its own yellow, every other bead takes the shot's colour)
  const looks = { bead: 'x', pea: 'pea' }; for (const [kind, look] of Object.entries(LOOK_OF)) if (look !== 'bead') looks[look] ??= kind;
  for (const [look, kind] of Object.entries(looks)) { const g = makeShot(kind, .22, TINT), u = g.userData, anims = (u.anim ?? []).map(x => x.t); add('shot_' + look, bakeObject(g), { yaw: !!(u.yaw || u.yawArc), bill: !!u.billboard, spin3: !!u.spin3, flicker: !!u.flicker, spinz: anims.includes('spinz') }); }
  // ---- the summons Willowmere did not have yet
  for (const kind of ['tree', 'lighthouse', 'sandbag']) add('sum_' + kind, bakeObject(makeSummon(kind)));
  return models;
}
