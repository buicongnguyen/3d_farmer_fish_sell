// What the disguise skills put in the world besides sparks (fetched with the box): the helpers as little toon models (after Zoo
// Garden's summon-art.ts: shadow clone, tesla turret, cannon, bat, parrot, snow decoy, sheep), the robot's tank treads, the shield
// bubble, the flier's shadow on the ground, the vanish fade, and the hero's own pose (disguise-pose.mjs) driven from Combat's statuses.
// Everything is made once, on the first kit cast: one InstancedMesh per kind (vertex colours baked into one geometry each), one of
// boxes and one of wings for every moving limb, so all bats cost two draws and nothing is created while a fight runs.
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { newPose, poseStep, castPose, release } from './disguise-pose.mjs';
import { KIT_COLOR } from './disguise-kits.mjs';

const PI = Math.PI, H = PI / 2;
/** Each row: shape (s sphere, b box, c cone, t tube, l low sphere, p taper), colour, x y z, size x y z, turn x y z. Zoo's numbers. */
const pair = (rows, f) => { for (const s of [-1, 1]) rows.push(...f(s)); return rows; };
const ART = {
  clone: () => pair([['b', '#474064', 0, .85, 0, .5, .7, .35], ['s', '#51466d', 0, 1.48, 0, .32], ['b', '#ddb8a0', 0, 1.48, .28, .46, .13, .07], ['b', '#bb6689', 0, 1.15, 0, .55, .12, .4], ['b', '#bba7d6', .35, 1.1, -.2, .08, 1.2, .08, 0, 0, -.5]], s => [['s', '#181629', s * .12, 1.5, .33, .04]]),
  turret: () => { const r = [['t', '#4a5868', 0, .08, 0, .7, .16, .7], ['t', '#8fa3b8', 0, .55, 0, .16, .8, .16], ['t', '#4a5868', 0, 1, 0, .22, .08, .22], ['b', '#6ff2ff', 0, .55, .17, .06, .5, .04], ['s', '#f2fdff', 0, 1.22, 0, .27]]; for (let i = 0; i < 3; i++) { const a = i * PI * 2 / 3; r.push(['b', '#2c3440', Math.sin(a) * .62, .08, Math.cos(a) * .62, .22, .12, .36, 0, a, 0]); } for (let i = 0; i < 4; i++) r.push(['t', i % 2 ? '#d98a3a' : '#f0a050', 0, .3 + i * .17, 0, .3 - i * .03, .07, .3 - i * .03]); return r; },
  cannon: () => pair([['b', '#8a5a32', 0, .34, -.05, .8, .18, 1.1], ['p', '#2d323d', 0, .72, .2, .34, 1.5, .34, H - .2, 0, 0], ['t', '#c8a24a', 0, .78, .88, .31, .1, .31, H - .2, 0, 0], ['t', '#c8a24a', 0, .7, -.15, .34, .08, .34, H - .2, 0, 0], ['s', '#2d323d', 0, .78, -.58, .2], ['l', '#1d2028', -.9, .16, .5, .17], ['l', '#1d2028', -.68, .16, .62, .17], ['l', '#1d2028', -.8, .38, .56, .17], ['l', '#ffb02e', 0, 1, -.62, .12]], s => [['b', '#6e4526', s * .36, .5, -.05, .08, .34, 1], ['t', '#6b4423', s * .62, .36, 0, .36, .1, .36, 0, 0, H], ['t', '#c8a24a', s * .7, .36, 0, .12, .06, .12, 0, 0, H]]),
  bat: () => pair([['s', '#583963', 0, .65, 0, .2, .3, .2], ['s', '#795182', 0, .93, .04, .19]], s => [['c', '#fffdf0', s * .05, .84, .2, .03, .1, .03, PI, 0, 0], ['c', '#795182', s * .12, 1.13, .02, .1, .27, .08], ['s', '#ffbfa3', s * .07, .96, .2, .035]]),
  parrot: () => pair([['s', '#e8352b', 0, 0, 0, .26, .3, .34], ['s', '#ff5a4a', 0, .3, .16, .2], ['c', '#ffd84a', 0, .27, .4, .07, .16, .07, H + .4, 0, 0], ['b', '#3c94e4', 0, -.05, -.42, .14, .06, .42, .35, 0, 0], ['b', '#ffd84a', 0, -.1, -.6, .1, .05, .24, .5, 0, 0]], s => [['s', '#ffffff', s * .11, .36, .31, .055], ['s', '#1a1a22', s * .12, .36, .34, .03]]),
  snow: () => pair([['s', '#e5f5ff', 0, .48, 0, .55], ['s', '#faffff', 0, 1.12, 0, .38], ['b', '#da655b', 0, .85, 0, .72, .13, .65], ['b', '#da655b', .24, .63, .4, .16, .5, .09], ['c', '#f5a24b', 0, 1.12, .43, .09, .32, .09, H, 0, 0], ['t', '#344b70', 0, 1.47, 0, .43, .08, .43], ['t', '#344b70', 0, 1.64, 0, .27, .3, .27]], s => [['s', '#343c50', s * .13, 1.23, .32, .05], ['b', '#856040', s * .7, .7, 0, .5, .06, .06, 0, 0, s * .4]]),
  sheep: () => pair([['s', '#f6f0dc', 0, .55, 0, .65, .43, .45], ['s', '#b7a698', 0, .62, .49, .23, .26, .24]], s => [['s', '#e9dbc5', s * .25, .75, .43, .19, .09, .09], ['b', '#776959', s * .32, .17, -.26, .12, .3, .12], ['b', '#776959', s * .32, .17, .24, .12, .3, .12], ['s', '#342f34', s * .12, .69, .67, .045]]),
  tank: () => pair([['b', '#4a5868', 0, 1.05, 1.05, .2, .2, 1.1], ['b', '#6ff2ff', 0, 1.05, 1.6, .26, .26, .1]], s => { const r = [['b', '#2c3440', s * .62, .28, 0, .34, .46, 1.7], ['b', '#6ff2ff', s * .62, .53, 0, .36, .04, 1.72]]; for (let w = 0; w < 4; w++) r.push(['s', '#8fa3b8', s * .8, .28, (w / 3 - .5) * 1.3, .05, .13, .13]); return r; }),
};
const CAP = { clone: 4, turret: 3, cannon: 3, bat: 9, parrot: 2, snow: 3, sheep: 8 }, KINDS = Object.keys(CAP), BOXES = 40, WINGS = 18;
const C = { leg: new T.Color('#342f48'), arm: new T.Color('#70618d'), arc: new T.Color('#bff4ff'), blue: new T.Color('#3c94e4'), gold: new T.Color('#ffd84a'), wing: new T.Color('#6c4780') };
const base = new T.Matrix4(), local = new T.Matrix4(), out = new T.Matrix4(), v = new T.Vector3(), q = new T.Quaternion(), s3 = new T.Vector3(), eu = new T.Euler();
/** `base` = a model's place, heading and size. */
const place = (x, y, z, yaw, k) => base.compose(v.set(x, y, z), q.setFromEuler(eu.set(0, yaw, 0, 'XYZ')), s3.set(k, k, k));
/** One part of the model at `base`: its own place, turn (in `order`) and size. */
function part(mesh, i, x, y, z, rx, ry, rz, sx, sy, sz, order = 'XYZ') { local.compose(v.set(x, y, z), q.setFromEuler(eu.set(rx, ry, rz, order)), s3.set(sx, sy, sz)); mesh.setMatrixAt(i, out.multiplyMatrices(base, local)); }

function bake(shapes, rows) {
  const pieces = [], o = new T.Object3D(), color = new T.Color();
  for (const [k, hex, x, y, z, sx, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0] of rows) {
    o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.rotation.set(rx, ry, rz); o.updateMatrix();
    const g = (shapes[k].index ? shapes[k].toNonIndexed() : shapes[k].clone()).applyMatrix4(o.matrix), n = g.getAttribute('position').count, colors = new Float32Array(n * 3);
    color.set(hex); for (let i = 0; i < n; i++) color.toArray(colors, i * 3);
    g.setAttribute('color', new T.BufferAttribute(colors, 3)); g.deleteAttribute('uv'); pieces.push(g);
  }
  const merged = mergeGeometries(pieces, false); pieces.forEach(p => p.dispose()); return merged;
}
function build(fx) {
  const shapes = { s: new T.IcosahedronGeometry(1, 1), b: new T.BoxGeometry(1, 1, 1), c: new T.CylinderGeometry(0, 1, 1, 6), t: new T.CylinderGeometry(1, 1, 1, 8), l: new T.IcosahedronGeometry(1, 0), p: new T.CylinderGeometry(.75, 1, 1, 10) };
  const m = { root: new T.Group(), kinds: {} }, paint = new T.MeshLambertMaterial({ vertexColors: true, flatShading: true }), tint = new T.MeshLambertMaterial({ flatShading: true });
  const inst = (geometry, material, cap) => { const mesh = new T.InstancedMesh(geometry, material, cap); mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); mesh.frustumCulled = false; mesh.count = 0; mesh.visible = false; mesh.raycast = () => {}; m.root.add(mesh); return mesh; };
  m.root.name = 'disguise-models';
  for (const k of KINDS) m.kinds[k] = inst(bake(shapes, ART[k]()), paint, CAP[k]);
  m.boxes = inst(shapes.b, tint, BOXES); m.wings = inst(new T.CylinderGeometry(0, 1, 1, 6).scale(.35, .65, .06).rotateZ(-H).translate(.3, 0, 0), tint, WINGS);
  for (const mesh of [m.boxes, m.wings]) { for (let i = 0; i < mesh.instanceMatrix.count; i++) mesh.setColorAt(i, C.wing); mesh.instanceColor.setUsage(T.DynamicDrawUsage); }
  const one = (geometry, material) => { const mesh = new T.Mesh(geometry, material); mesh.visible = false; mesh.raycast = () => {}; m.root.add(mesh); return mesh; };
  m.tank = one(bake(shapes, ART.tank()), paint);
  m.bubble = one(new T.IcosahedronGeometry(1.15, 2), new T.MeshBasicMaterial({ color: '#a1f5ef', transparent: true, opacity: .24, depthWrite: false })); m.bubble.renderOrder = 5;
  m.blob = one(new T.RingGeometry(.001, .5, 20).rotateX(-H), new T.MeshBasicMaterial({ color: '#10202a', transparent: true, opacity: .3, depthWrite: false })); m.blob.renderOrder = 3;
  for (const k in shapes) if (k !== 'b') shapes[k].dispose();
  fx.root.add(m.root); return m;
}

// ---------------------------------------------------------------- vanish: the hero's own materials, faded (Zoo: opacity 0.25)
const faded = new Map(), swapped = [];
function fade(hero, on) {
  if (on) hero.traverse(o => {
    if (!o.isMesh || Array.isArray(o.material) || !o.material) return;
    let f = faded.get(o.material);
    if (!f) { f = o.material.clone(); f.onBeforeCompile = o.material.onBeforeCompile; f.customProgramCacheKey = o.material.customProgramCacheKey; f.transparent = true; f.opacity = (o.material.opacity ?? 1) * .28; faded.set(o.material, f); }
    swapped.push(o, o.material); o.material = f;
  });
  else { for (let i = 0; i < swapped.length; i += 2) if (swapped[i].material === faded.get(swapped[i + 1])) swapped[i].material = swapped[i + 1]; swapped.length = 0; }
}
/** A new avatar (the wardrobe, a look): the old one's faded copies are let go. */
function forget() { swapped.length = 0; for (const f of faded.values()) f.dispose(); faded.clear(); }

/** The hero's side of a kit cast: its pose (true when disguise-pose.mjs poses it) and the colour of its bubble and trail. */
export function heroCast(fx, op, id) { fx.kc = KIT_COLOR[id] ?? '#ffffff'; fx.glide = id === 'dz_superhero'; fx.dm ??= build(fx); fx.dm.bubble.material.color.set(id === 'dz_mecha' ? '#6fe8ff' : id === 'dz_knight' || id === 'dz_usa' ? '#fff3c4' : '#a1f5ef'); return castPose(fx.hp ??= newPose(), op); }
/** Knocked out, or the box shut: the pose is dropped at once (fx.clear() runs at both). */
export function heroCut(fx) { fx.cut = true; }

let wings = 0;
/** One bat at a place: its body and its two flapping wings. */
function bat(m, n, x, y, z, yaw, k, t) {
  if (n.bat >= CAP.bat) return; place(x, y, z, yaw, k); m.kinds.bat.setMatrixAt(n.bat++, base); const flap = Math.sin(t * 18) * .6;
  for (let s = -1; s <= 1; s += 2) part(m.wings, wings++, s * .12, .75, 0, 0, s < 0 ? PI : 0, s * flap, 1, 1, 1, 'ZYX');
}
/** Every frame, after the world has walked the hero and before the picture: the pose, then the models. */
export function heroFrame(fx, dt) {
  const w = fx.world, hero = w?.player, c = w?.pandora?.combat; if (!hero || !c) return;
  const P = fx.hp ??= newPose(), d = c.d ?? null, riding = !!w.riding, ok = w.location === 'village' && !riding && !fx.cut, time = fx.time;
  if (P.who && P.who !== hero) { forget(); fx.hid = false; }
  if (fx.cut) { fx.cut = false; if (P.on) release(P, hero, riding); }
  const h = poseStep(P, hero, d, c.mode, ok, riding, fx.glide === true, dt, time);
  const hidden = ok && !!d && d.stealth > 0; if (hidden !== (fx.hid === true)) { fx.hid = hidden; fade(hero, hidden); }
  const m = fx.dm; if (!m) return;
  const px = hero.position.x, pz = hero.position.z, f = hero.rotation.y, size = P.s0 * P.big;
  // The flier's shadow on the ground, its trail, the bubble, the treads.
  m.blob.visible = ok && h > .08; if (m.blob.visible) { m.blob.position.set(px, .04, pz); m.blob.scale.setScalar(size * Math.max(.45, 1.15 - h * .3)); m.blob.material.opacity = .34 - Math.min(.16, h * .08); }
  if (ok && h > .5 && P.move > .5 && (fx.trailT = (fx.trailT ?? 0) - dt) <= 0) { fx.trailT = (fx.thin ?? 1) < 1 ? .1 : .05; fx.sparks.emit(px - Math.sin(f) * 1.1, hero.position.y + .35, pz - Math.cos(f) * 1.1, 0, -.4, 0, .45, .5, fx.trailT > .07 || Math.random() < .5 ? fx.kc : '#ffffff', 0); }
  m.bubble.visible = ok && !!d && d.shield > 0 && !(d.bats > 0); if (m.bubble.visible) { m.bubble.position.set(px, hero.position.y + 1.1 * size, pz); m.bubble.scale.setScalar(size * (1 + Math.sin(time * 6) * .03)); }
  m.tank.visible = ok && !!d && d.tank > 0; if (m.tank.visible) { m.tank.position.set(px, 0, pz); m.tank.rotation.y = f; m.tank.scale.setScalar(size * Math.min(1, (6 - d.tank) * 8, d.tank * 8)); }
  // The helpers and the bats.
  const K = m.kinds, n = fx.dn ??= { clone: 0, turret: 0, cannon: 0, bat: 0, parrot: 0, snow: 0, sheep: 0 }; for (let i = 0; i < KINDS.length; i++) n[KINDS[i]] = 0;
  let boxes = 0; wings = 0;
  if (ok && c.al) for (let i = 0; i < c.al.length; i++) {
    const a = c.al[i]; if (!a.live) continue;
    const k = Math.max(.01, Math.min(1, (c.time - (a.born ?? 0)) * 7, a.life * 5)), yaw = a.f ?? 0, t = time + i * 1.7;
    if (a.kind === 'bat') { bat(m, n, a.x, .7, a.z, -(c.time * 3 + a.orbit), k, t); continue; }
    const kind = a.kind, mesh = K[kind]; if (!mesh || n[kind] >= CAP[kind]) continue;
    if (kind === 'parrot') {
      // The scout circles its captain while the marks last.
      const o = time * 1.9 + i; place(px + Math.sin(o) * 2.6, 1.7 + Math.sin(time * 5) * .12, pz + Math.cos(o) * 2.6, o + H, k); mesh.setMatrixAt(n.parrot++, base); const flap = Math.sin(time * 22) * .7;
      for (let s = -1; s <= 1; s += 2) { part(m.boxes, boxes, s * (.2 + Math.cos(flap) * .22), .08 + Math.sin(flap) * .22, 0, 0, 0, s * flap, .42, .05, .26); m.boxes.setColorAt(boxes++, s < 0 ? C.blue : C.gold); }
      continue;
    }
    place(a.x, 0, a.z, yaw, k); mesh.setMatrixAt(n[kind]++, base);
    if (kind === 'clone') { const sw = Math.sin(t * 10); for (let s = -1; s <= 1; s += 2) { part(m.boxes, boxes, s * .16, .26, 0, s * sw * .35, 0, 0, .18, .5, .22); m.boxes.setColorAt(boxes++, C.leg); part(m.boxes, boxes, s * .36, .85, 0, -s * sw * .4, 0, 0, .18, .6, .2); m.boxes.setColorAt(boxes++, C.arm); } }
    else if (kind === 'turret') for (let j = 0; j < 3; j++) { const o = j * PI * 2 / 3 + time * 9; part(m.boxes, boxes, Math.sin(o) * .38, 1.22 + Math.cos(o * 2) * .08, Math.cos(o) * .38, 0, o + .6, 0, .03, .03, .5); m.boxes.setColorAt(boxes++, C.arc); }
  }
  // Bat form: the hero is four bats (the pose layer has shrunk the body away).
  if (ok && P.gone > .05) for (let i = 0; i < 4; i++) { const o = time * 3 + i * H; bat(m, n, px + Math.sin(o) * .8, hero.position.y + .5 + Math.sin(o * 2) * .15, pz + Math.cos(o) * .8, -o, P.gone, time + i); }
  // Sheep: a creature under the spell is drawn as one (wilds-draw.mjs shrinks its own model away).
  if (ok && c.dany > c.time) { const list = c.host.targets(); for (let i = 0; i < list.length && n.sheep < CAP.sheep; i++) { const e = list[i]; if (!(e.sheep > 0) || !(e.hp > 0)) continue; place(e.x, Math.abs(Math.sin(time * 6 + i)) * .12, e.z, e.facing ?? 0, 1.2 * Math.min(1, e.sheep * 4) * Math.max(1, (e.radius ?? .5) * 1.4)); K.sheep.setMatrixAt(n.sheep++, base); } }
  for (let i = 0; i < KINDS.length; i++) { const mesh = K[KINDS[i]], count = n[KINDS[i]]; mesh.count = count; mesh.visible = count > 0; if (count) mesh.instanceMatrix.needsUpdate = true; }
  m.boxes.count = boxes; m.boxes.visible = boxes > 0; if (boxes) { m.boxes.instanceMatrix.needsUpdate = true; m.boxes.instanceColor.needsUpdate = true; }
  m.wings.count = wings; m.wings.visible = wings > 0; if (wings) m.wings.instanceMatrix.needsUpdate = true;
}
