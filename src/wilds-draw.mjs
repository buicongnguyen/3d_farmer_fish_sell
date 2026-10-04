// The drawing half of wilds-view.mjs (see the note at the top of that file): fetched with the box's first opening, and put onto
// WildsView's prototype by install(). Everything here is the same code as before the split, moved; the reference's procedural
// creature (speciesTemplate) and the read of a creature file (mergePart) with it.
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CREATURES, AI, windupProgress, glideShare } from './wilds.mjs';
import { squareOf } from './regions.mjs';
import { waterAt } from './land-features.mjs';
import { BOSS_TELEGRAPH_COLORS } from './boss-patterns.mjs';
import { nearLook, inView, castsShadow, walking, ease, turnToward } from './creature-lod.mjs';
import { LAND_KITS, KIT_REACH, WARM, GLINT, HINGES, VIEW, TURN, SHOT_COLORS, FIRE_MARK } from './wilds-view.mjs';

const box = new T.Box3();
// Hot loops use plain indexed loops and this instead of for-of and Math.hypot: neither makes garbage in any JIT tier.
const len = (x, z) => Math.sqrt(x * x + z * z);

/** A float copy of a (possibly quantised) vec3 attribute; getX and friends undo the normalisation. */
function floats(a) { const out = new Float32Array(a.count * 3); for (let i = 0; i < a.count; i++) { out[i * 3] = a.getX(i); out[i * 3 + 1] = a.getY(i); out[i * 3 + 2] = a.getZ(i); } return new T.BufferAttribute(out, 3); }
/** The meshes of one part, in the hinge's space, merged with their material colours in the vertices. */
function mergePart(node, toRoot) {
  const pieces = [], pivot = new T.Vector3().setFromMatrixPosition(new T.Matrix4().multiplyMatrices(toRoot, node.matrixWorld)), toPivot = new T.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z);
  node.traverse(m => {
    if (!m.isMesh) return;
    let g = new T.BufferGeometry(); g.setAttribute('position', floats(m.geometry.getAttribute('position')));
    const normal = m.geometry.getAttribute('normal'); if (normal) g.setAttribute('normal', floats(normal));
    if (m.geometry.index) g.setIndex(m.geometry.index.clone());
    g = g.index ? g.toNonIndexed() : g; g.applyMatrix4(new T.Matrix4().multiplyMatrices(toPivot, new T.Matrix4().multiplyMatrices(toRoot, m.matrixWorld)));
    if (!normal) g.computeVertexNormals();
    const c = m.material.color ?? new T.Color('#ffffff'), n = g.getAttribute('position').count, colors = new Float32Array(n * 3); for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new T.BufferAttribute(colors, 3)); pieces.push(g);
  });
  const merged = mergeGeometries(pieces, false); pieces.forEach(p => p.dispose()); return { geometry: merged, pivot };
}

/**
 * Zoo Garden's procedural creature (world.ts speciesModel, by the row's `family`), as a template: every shape merged into one
 * vertex-coloured body mesh, the two wings of a winged kind kept as hinges. A boss wears its crown. The reference sets a
 * boss's 1.85 size inside the model; here the row's `scale` does, as for every other creature.
 */
export function speciesTemplate(def, material) {
  const parts = { body: [], 'wing-l': [], 'wing-r': [] }, color = def.color, accent = def.accent, family = def.family, m = new T.Matrix4(), q = new T.Quaternion(), tint = new T.Color();
  const add = (geometry, hex, x = 0, y = 0, z = 0, opts = {}) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry; if (g !== geometry) geometry.dispose(); g.deleteAttribute('uv');
    q.setFromEuler(new T.Euler(0, 0, opts.rz ?? 0)); g.applyMatrix4(m.compose(new T.Vector3(x, y, z), q, new T.Vector3(opts.sx ?? 1, opts.sy ?? 1, opts.sz ?? 1)));
    tint.set(hex); const n = g.getAttribute('position').count, colors = new Float32Array(n * 3); for (let i = 0; i < n; i++) colors.set([tint.r, tint.g, tint.b], i * 3);
    g.setAttribute('color', new T.BufferAttribute(colors, 3)); parts[opts.part ?? 'body'].push(g);
  };
  const ball = (hex, r, x, y, z, opts) => add(new T.IcosahedronGeometry(r, 1), hex, x, y, z, opts), box = (hex, w, h, d, x, y, z) => add(new T.BoxGeometry(w, h, d), hex, x, y, z);
  const cyl = (hex, top, bottom, h, x, y, z, sides = 12) => add(new T.CylinderGeometry(top, bottom, h, sides), hex, x, y, z);
  const hinges = { 'wing-l': new T.Vector3(), 'wing-r': new T.Vector3() };
  if (['quadruped', 'turtle', 'crab', 'dragon'].includes(family)) {
    ball(color, .8, 0, .64, 0, { sy: .7, sz: 1.35 }); ball(color, .48, 0, .95, 1);
    for (const x of [-.58, .58]) for (const z of [-.66, .66]) cyl(accent, .16, .2, .55, x, .28, z);
    if (family === 'crab') for (const x of [-1, 1]) ball(accent, .35, x, .95, .85);
    if (family === 'turtle') ball('#506353', .84, 0, .87, 0, { sy: .65 });
    if (family === 'dragon') for (const x of [-1, 1]) { const part = x < 0 ? 'wing-l' : 'wing-r'; hinges[part].set(x * .45, 1.1, -.15); add(new T.ConeGeometry(.7, 1.5, 3), accent, x * .45, 0, 0, { rz: x * .8, part }); }
  } else if (family === 'flower' || family === 'cactus' || family === 'lollipop') {
    cyl(color, .15, .3, 1.2, 0, .6, 0); ball(color, .55, 0, 1.45, 0);
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ball(accent, .25, Math.cos(a) * .48, 1.45 + Math.sin(a) * .48, .06); }
  } else if (family === 'volcano') { cyl(color, .5, 1.1, 1.1, 0, .55, 0); ball('#ffb338', .35, 0, 1.1, 0); }
  else if (family === 'robot' || family === 'jackbox') { box(color, 1.2, 1.1, 1, 0, .65, 0); box(accent, .95, .7, .8, 0, 1.6, 0); for (const x of [-.72, .72]) box(color, .3, .8, .3, x, .9, 0); }
  else if (family === 'worm') { for (let i = 0; i < 4; i++) ball(i % 2 ? color : accent, .36, Math.sin(i) * .17, .3 + i * .32, 0); }
  else { ball(color, .65, 0, .65, 0); ball(color, .45, 0, 1.2, .15); for (const x of [-.42, .42]) ball(accent, .2, x, .2, .25); }
  if (family === 'mushroom') { cyl(accent, 0, .95, .58, 0, 1.72, 0, 12); ball(color, .65, 0, 1.78, 0); }
  if (family === 'bunny') for (const x of [-.22, .22]) ball(accent, .18, x, 1.94, 0, { sy: 2.3 });
  if (family === 'winged') for (const x of [-1, 1]) { const part = x < 0 ? 'wing-l' : 'wing-r'; hinges[part].set(x * .3, 1.05, 0); ball(accent, .45, x * .36, 0, 0, { sx: 1.5, sy: .18, sz: .75, part }); }
  if (family === 'treant') { cyl(color, .55, .7, 1.8, 0, .9, 0); ball(accent, .95, 0, 2, 0); for (const x of [-1, 1]) box(color, .3, 1.3, .3, x * .7, 1.1, 0); }
  if (family === 'cake') { cyl(accent, .85, .85, .3, 0, .55, 0); cyl(color, .7, .8, .6, 0, 1, 0); ball('#f06179', .23, 0, 1.9, 0); }
  if (family === 'eye') { ball('#fff4de', .43, 0, 1.25, .4); ball('#db627c', .2, 0, 1.25, .78); }
  for (const x of [-.18, .18]) ball('#333441', .062, x, 1.25, .56);
  if (def.boss) cyl('#ffda5a', .36, .3, .28, 0, 2.1, 0, 5);
  const template = new T.Group(); template.name = 'creature-procedural';
  for (const [name, list] of Object.entries(parts)) {
    if (!list.length) continue;
    const mesh = new T.Mesh(mergeGeometries(list, false), material); list.forEach(g => g.dispose()); mesh.castShadow = mesh.receiveShadow = false;
    if (name === 'body') { mesh.name = 'creature-body'; template.add(mesh); } else { mesh.name = 'creature-' + name; const hinge = new T.Group(); hinge.name = name; hinge.position.copy(hinges[name]); hinge.add(mesh); template.add(hinge); }
  }
  return template;
}

/** WildsView's drawing methods (they read and write the fields its constructor makes). */
const METHODS = {
  /** Reads a creature file: every root named in CREATURES (or only those in `names`) becomes that kind's template. */
  read(url, names = null) {
    return new GLTFLoader().loadAsync(url).then(gltf => {
      gltf.scene.updateMatrixWorld(true);
      for (const node of gltf.scene.children) {
        if (!CREATURES[node.name] || names && !names.includes(node.name)) continue;
        const toRoot = node.matrixWorld.clone().invert(), template = new T.Group(); template.name = 'creature-' + node.name;
        for (const part of node.children) {
          const role = part.name.startsWith(node.name + '_') ? part.name.slice(node.name.length + 1) : part.name, { geometry, pivot } = mergePart(part, toRoot); if (!geometry) continue;
          const mesh = new T.Mesh(geometry, this.material); mesh.name = 'creature-' + role; mesh.castShadow = false; mesh.receiveShadow = false;
          if (HINGES[role]) { const hinge = new T.Group(); hinge.name = HINGES[role]; hinge.position.copy(pivot); hinge.add(mesh); template.add(hinge); } else { mesh.position.copy(pivot); template.add(mesh); }
        }
        this.addTemplate(node.name, template);
      }
      gltf.scene.traverse(m => { if (m.isMesh) { m.geometry.dispose(); m.material.dispose?.(); } });
    });
  },
  /**
   * A template from elsewhere (a land's own creature file, a titan's, a procedural stand-in): stored under its creature type, so
   * attach() draws that kind from it. It is measured, and given its far look (a creature of several parts merged at rest into
   * one mesh) if it has none. A template it replaces is let go: its pool is emptied and a creature still drawn from it changes
   * to the new one on its next frame in view. Returns a resolved promise.
   */
  addTemplate(type, group) {
    if (group.userData.height === undefined) { box.setFromObject(group); group.userData.height = box.max.y; group.userData.footprint = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2; }
    if (group.children.length > 1 && !group.getObjectByName('creature-far')) {
      group.updateMatrixWorld(true); const pieces = [];
      group.traverse(m => { if (m.isMesh) { const g = m.geometry.clone(); g.applyMatrix4(m.matrixWorld); pieces.push(g); } });
      const far = new T.Mesh(mergeGeometries(pieces, false), this.material); pieces.forEach(p => p.dispose()); far.name = 'creature-far'; far.visible = false; far.castShadow = far.receiveShadow = false; group.add(far);
    }
    const old = this.templates.get(type);
    if (old && old !== group) { old.traverse(m => { if (m.isMesh) m.geometry.dispose(); }); this.free.delete(type); this.icons.delete(type); }
    this.templates.set(type, group); this.stand.delete(type); return Promise.resolve(group);
  },
  /**
   * Loads the named roots of a creature file as templates, once per file: a land's own models (LAND_KITS), or a titan's
   * (titans-view.mjs). Until it resolves those kinds are drawn from their stand-ins. A file that fails is asked for again
   * on the next call.
   */
  addKit(url, names = []) {
    let kit = this.kits.get(url);
    if (!kit) this.kits.set(url, kit = this.read(url, names).then(() => { for (const type of names) if (this.templates.has(type)) this.warm(type); return true; })
      .catch(error => { console.warn('A creature file could not load: ' + url, error); this.kits.delete(url); return false; }));
    return kit;
  },
  /** With the box open: asks for the file of every square within KIT_REACH metres of (x, z). Cheap enough for a call a second. */
  near(x, z) {
    for (const id in LAND_KITS) {
      const [url, names] = LAND_KITS[id]; if (this.kits.has(url)) continue;
      const s = squareOf(id), dx = Math.max(s.x0 - x, 0, x - s.x1), dz = Math.max(s.z0 - z, 0, z - s.z1);
      if (len(dx, dz) < KIT_REACH) this.addKit(url, names);
    }
  },
  /** The template a kind is drawn from: its model, else the reference's procedural shapes for its family (made when first needed). */
  template(type) {
    let template = this.templates.get(type);
    if (!template && CREATURES[type]?.family) { template = speciesTemplate(CREATURES[type], this.material); this.addTemplate(type, template); this.stand.add(type); }
    return template ?? null;
  },
  /** A fresh model of a kind (not in the scene), sharing its template's geometry. */
  clone(type, template) {
    const group = template.clone(true); group.rotation.order = 'YXZ';
    const u = group.userData; u.meshes = []; group.traverse(m => { if (m.isMesh) u.meshes.push(m); });
    u.far = group.getObjectByName('creature-far') ?? null; u.body = group.getObjectByName('creature-body') ?? u.meshes[0]; u.parts = group.children.filter(c => c !== u.far);
    u.legs = [0, 1, 2, 3].map(i => group.getObjectByName('leg' + i)).filter(Boolean); u.wings = ['wing-l', 'wing-r'].map(n => group.getObjectByName(n)).filter(Boolean);
    u.height = template.userData.height; u.footprint = template.userData.footprint; u.template = template;
    return group;
  },
  /** A model for a creature: from the pool of its kind, or a new one sharing the kit's geometry. */
  attach(e) {
    if (e.view) return;
    const template = this.template(e.type); if (!template) return;
    const group = this.free.get(e.type)?.pop() ?? this.clone(e.type, template);
    Object.assign(group.userData, { anim: (e.homeX * 3.7) % 6, drawX: e.x, drawZ: e.z, yaw: e.facing, speed: 0, moving: false, walk: 0, limb: 0, strike: 0, phase: e.phase, close: null, shadow: null, lit: false });
    group.visible = false; this.root.add(group); e.view = group;
  },
  /** A small portrait of a creature kind for the target frame, rendered once from its model. */
  icon(type) {
    if (this.icons.has(type)) return this.icons.get(type);
    const template = this.template(type); if (!template || !this.world.snapshot) return '';
    const scene = this.world.iconScene(), model = template.clone(true); model.rotation.y = .5; scene.add(model); model.updateMatrixWorld(true);
    const b = new T.Box3().setFromObject(model), c = b.getCenter(new T.Vector3()), r = b.getSize(new T.Vector3()).length() / 2 * .8, cam = new T.OrthographicCamera(-r, r, r, -r, .01, r * 20);
    cam.position.copy(c).add(new T.Vector3(r * 1.2, r * 1.5, r * 3)); cam.lookAt(c);
    const url = this.world.snapshot(scene, cam, 96); this.icons.set(type, url); return url;
  },
  /** Body language: hoppers squash and stretch, walkers trot, flyers flap, rooted plants sway; a crouch before a blow, a lunge on it. */
  animate(e, group, dt, time) {
    const u = group.userData, def = e.def, behavior = def.behavior, walk = u.walk, rest = 1 - walk;
    // The cycle runs at the walking rate while any of the walk still shows, so a hop that is fading out lands instead of freezing.
    u.anim += dt * (3 + ((e.phase === 'charge' ? 22 : 10) - 3) * Math.min(1, walk * 1.5));
    if (u.phase !== e.phase) { if (u.phase === 'windup') u.strike = .25; u.phase = e.phase; }
    u.strike = Math.max(0, u.strike - dt);
    const o = u.anim, s = Math.sin(o), windup = windupProgress(e);
    let lean = 0, roll = 0, lift = 0, sx = 1, sy = 1, sz = 1, shake = 0;
    // Each pose is the resting one (a slow breath) mixed with the walking one by `walk` (0 at rest, 1 walking): nothing snaps.
    if (behavior === 'hopper') {
      // A stroll takes small hops, a chase the full ones.
      const h = Math.abs(Math.sin(o * .6)), size = walk * Math.min(1, .45 + u.speed * .3);
      lift = h * .45 * size; sx = sz = 1 + (1 - h) * .12 * walk; sy = 1 + (h * .08 - (1 - h) * .15) * walk + Math.sin(o) * .03 * rest;
    }
    else if (behavior === 'rooted' || behavior === 'shooter') { roll = Math.sin(time * 1.5 + e.homeX) * .08; lean = Math.sin(time * 1.1 + e.homeZ) * .05; }
    else if (!def.flying) { lift = Math.abs(Math.cos(o)) * .07 * walk; roll = s * .06 * walk; sy = 1 + Math.sin(o) * .02 * rest; }
    if (u.close !== false) {
      // `limb` fades the legs and wings to rest before the merged mesh takes over, and in again after it hands back.
      const swing = .75 * walk * u.limb, flap = (def.flying ? .55 : .2) * u.limb;
      for (let i = 0; i < u.legs.length; i++) u.legs[i].rotation.x = (i === 1 || i === 2 ? s : -s) * swing;
      for (let i = 0; i < u.wings.length; i++) u.wings[i].rotation.z = (i ? -1 : 1) * Math.sin(time * (def.flying ? 16 : 6) + e.homeX) * flap;
    }
    if (windup > 0) { sx *= 1 + windup * .2; sy *= 1 - windup * .25; sz *= 1 + windup * .2; lean = -windup * .2; shake = Math.sin(time * 60) * .04 * windup; }
    if (u.strike > 0) lean = (behavior === 'rooted' ? .55 : .4) * (u.strike / .25);
    if (e.phase === 'charge') lean = .25;
    if (e.stun > .25 && !e.lift) roll = Math.sin(time * 20) * .1;
    group.position.y += lift; group.position.x += shake; group.rotation.x = lean; group.rotation.z = roll; group.scale.x *= sx; group.scale.y *= sy; group.scale.z *= sz;
  },
  /** One creature of this frame: its danger discs, its model, where it is drawn, whether it shows, its pose. (A method of its own so V8 optimizes it: update is one long call a frame.) */
  one(e, dt, time, focus, reach, fx, now, shade, sight, dark, px, pz, candidates) {
    // Danger on the ground, whether or not the creature itself is in view or hidden by the dark: a boss's skill (its discs
    // fill as the wind-up runs), the dragon's fire rain as it falls, and the few commons the reference telegraphs.
    if (fx && e.hp > 0 && len(e.x - focus.x, e.z - focus.z) < reach + VIEW.detach) {
      if (e.phase === 'windup') {
        const p = windupProgress(e), size = e.def.telegraph;
        if (e.marks.length) { const hex = BOSS_TELEGRAPH_COLORS[e.skill] ?? '#ff3b3b'; for (let i = 0; i < e.marks.length; i++) fx.decal(e.marks[i].x, e.marks[i].z, e.marks[i].r, p, hex); }
        else if (size) { const at = e.def.telegraphAt; if (at === 'self') fx.decal(e.x, e.z, size, p, '#ff3b3b'); else if (at === 'target') fx.decal(e.targetX, e.targetZ, size, p, '#ff3b3b'); else fx.decal(e.x + Math.sin(e.facing) * 1.2, e.z + Math.cos(e.facing) * 1.2, size, p, '#ff3b3b'); }
      }
      for (let i = 0; i < e.pulses.length; i++) { const q = e.pulses[i]; if (q.total > 0) fx.decal(q.x, q.z, q.r, 1 - q.left / q.total, FIRE_MARK); }
    }
    if (e.view && e.view.userData.template !== this.templates.get(e.type)) this.detach(e); // its kind's own model has arrived
    if (!e.view) {
      // A model only for a creature the view is about to reach; at most a few new ones a frame unless it is already in view.
      const away = len(e.x - focus.x, e.z - focus.z); if (away > reach + VIEW.attach || (away > reach && this.budget <= 0)) return;
      this.attach(e); if (!e.view) return; this.budget--;
    }
    // Where it is drawn: on the way from the place it last left to the place the simulation has it.
    const group = e.view, u = group.userData, share = glideShare(e, now), x = e.px + (e.x - e.px) * share, z = e.pz + (e.z - e.pz) * share, distance = len(x - focus.x, z - focus.z);
    if (distance > reach + VIEW.detach) { this.detach(e); return; }
    // What the player cannot see is not drawn. In the Night Land's dark a creature shows only inside a light (the player's own,
    // a lamp's, a flower's); outside every one its eyes glint instead, within 22 m. A titan glows by itself and is always
    // drawn. Elsewhere a stealthy kind (the chameleon) shows only within its stealth distance, or while it is stunned.
    let seen = true;
    if (e.hp > 0) {
      const away = len(x - px, z - pz);
      if (dark && e.titan) { if (sight.out && sight.out.length < 16) { const h = this.lights[sight.out.length]; h.x = x; h.z = z; h.r = e.radius + 8; sight.out.push(h); } }
      else if (dark) {
        seen = away < sight.hole; const holes = sight.holes;
        if (!seen && holes) for (let i = 0; i < holes.length; i++) if (len(x - holes[i].x, z - holes[i].z) < holes[i].r) { seen = true; break; }
        if (!seen && away < GLINT.reach && this.glints < GLINT.max) { this.glints++; candidates.push(e, away); this.glint(this.glints - 1, e, x, z, u.yaw); }
      } else if (e.def.stealth && away >= e.def.stealth && !(e.stun > 0)) seen = false;
    }
    // Out of sight: no animation, no matrices, no draws. A defeated creature swells and shrinks away instead of blinking out.
    const dying = e.hp <= 0 ? e.dying : 0, show = seen && (e.hp > 0 || dying > 0) && inView(group.visible, distance, reach);
    if (group.visible !== show) { group.visible = show; u.drawX = x; u.drawZ = z; u.yaw = e.facing; u.speed = 0; }
    if (!show) return;
    this.nVisible++;
    // Walking is read from the speed it is drawn at (not from one frame's step), and the walking pose fades in and out.
    if (dt > 0) { u.speed = ease(u.speed, len(x - u.drawX, z - u.drawZ) / dt, 14, dt); u.moving = e.hp > 0 && walking(u.moving, u.speed); u.walk = ease(u.walk, u.moving ? 1 : 0, u.moving ? 12 : 7, dt); if (!u.moving && u.walk < .004) u.walk = 0; }
    u.drawX = x; u.drawZ = z;
    // Near: animated parts. Far: the one merged mesh. Going far, the limbs first come to rest (where the two look the same).
    const wantNear = !u.far || nearLook(u.close === true, distance), limbRate = dt * 5;
    u.limb = wantNear ? Math.min(1, u.limb + limbRate) : Math.max(0, u.limb - limbRate);
    const close = wantNear || u.limb > 0;
    if (u.close !== close) { u.close = close; if (u.far) { u.far.visible = !close; for (let i = 0; i < u.parts.length; i++) u.parts[i].visible = close; } }
    const shadow = castsShadow(u.shadow === true, distance, shade);
    if (u.shadow !== shadow) { u.shadow = shadow; u.body.castShadow = shadow; if (u.far) u.far.castShadow = shadow; }
    const lit = e.flash > 0; if (u.lit !== lit) { u.lit = lit; for (let i = 0; i < u.meshes.length; i++) u.meshes[i].material = lit ? this.flash : this.material; }
    u.yaw = e.phase === 'spin' ? e.facing : turnToward(u.yaw, e.facing, e.phase === 'idle' || e.phase === 'return' ? TURN.calm : TURN.alert, dt);
    // A flyer hovers a metre up; a titan's leap lifts it (titanLift); a creature of the sea is drawn half a metre down while it is in water.
    const sunk = e.def.where === 'sea' && waterAt(x, z) ? -.5 : 0;
    group.position.set(x, sunk + e.lift + (e.titanLift ?? 0) + (e.def.flying ? 1 + Math.sin(time * 4 + e.homeX) * .15 : 0), z); group.rotation.y = u.yaw;
    let k = e.def.scale;
    if (e.hp <= 0) { const t = 1 - dying / AI.dying; k *= (1 + t * .3) * Math.max(.001, 1 - t); }
    else if (e.leaving > 0) k *= Math.max(.001, e.leaving / AI.leave);
    else if (e.born > 0) { const t = 1 - e.born / AI.born; k *= t * (1.25 - .25 * t); } // pops in a little larger, then settles
    group.scale.setScalar(k);
    if (e.flash > 0) { const f = e.flash / .14; group.scale.x *= 1 + f * .15; group.scale.z *= 1 + f * .15; group.scale.y *= 1 + f * .06; }
    if (e.hp > 0) this.animate(e, group, dt, time);
  },
  /**
   * Every frame. `focus` is where the camera looks, `reach` how far creatures are worth drawing, `shade` how far they
   * cast shadows, `now` the simulation's clock plus what this frame has gathered towards its next step (creatures are
   * drawn gliding to where the simulation has them). `fx` draws the danger discs of this frame (begin and end are the caller's).
   * `sight` is what the player can see: {x, z} where they stand, and in the Night Land's dark {dark: true, hole, holes, out}: the
   * radius of the player's own light, the other lights [{x, z, r}] (world.lands.holes) and the list this fills with the lights
   * the creatures make themselves (world.lands.creatureHoles: a titan's glow, then the nearest eye glints).
   */
  update(wilds, combat, dt, time, focus, reach, fx, now = wilds.time, shade = VIEW.near, sight = null) {
    let shots = 0; this.nVisible = 0; this.budget = 3; this.glints = 0;
    const dark = !!sight?.dark, px = sight?.x ?? focus.x, pz = sight?.z ?? focus.z, candidates = this.candidates; candidates.length = 0;
    if (sight?.out) sight.out.length = 0;
    // One kind's spare models a frame (warm): the pool is full before the first fight in a region needs it.
    if (this.warming.length) {
      const type = this.warming.shift(), template = this.template(type);
      if (template) { let list = this.free.get(type); if (!list) this.free.set(type, list = []); while (list.length < WARM) list.push(this.clone(type, template)); }
    }
    for (let n = 0; n < wilds.list.length; n++) this.one(wilds.list[n], dt, time, focus, reach, fx, now, shade, sight, dark, px, pz, candidates);
    // The eyes in the dark: one instanced draw, and the nearest few as small holes in the dark (world.lands.creatureHoles).
    if (this.eyes) { const n = this.glints * 2; if (n || this.eyes.count) { this.eyes.count = n; this.eyes.instanceMatrix.needsUpdate = true; } this.eyes.visible = n > 0; }
    this.glinting = this.glints;
    if (sight?.out && candidates.length) {
      for (let k = 0; k < GLINT.holes; k++) {
        let best = -1; for (let i = 0; i < candidates.length; i += 2) if (candidates[i] && (best < 0 || candidates[i + 1] < candidates[best + 1])) best = i;
        if (best < 0 || sight.out.length >= 16) break;
        const e = candidates[best], u = e.view.userData, h = this.lights[sight.out.length]; candidates[best] = null;
        h.x = u.drawX + Math.sin(u.yaw) * GLINT.forward * e.def.scale; h.z = u.drawZ + Math.cos(u.yaw) * GLINT.forward * e.def.scale; h.r = GLINT.hole * e.def.scale; sight.out.push(h);
      }
    }
    const cap = this.shots.instanceMatrix.count;
    for (let i = 0; i < wilds.shots.length && shots < cap; i++) { const s = wilds.shots[i]; if (!s.live) continue; this.shots.setMatrixAt(shots, this.m4.makeTranslation(s.x, 1, s.z)); this.shots.setColorAt(shots, s.kind ? this.tint(s.kind) : this.spine); shots++; }
    if (combat) for (let i = 0; i < combat.shots.length && shots < cap; i++) { const s = combat.shots[i]; if (!s.live) continue; this.shots.setMatrixAt(shots, this.m4.makeTranslation(s.x, 1, s.z)); this.shots.setColorAt(shots, this.tint(s.kind)); shots++; }
    if (shots || this.shots.count) { this.shots.count = shots; this.shots.instanceMatrix.needsUpdate = true; this.shots.instanceColor.needsUpdate = true; } this.shots.visible = shots > 0;
    this.visible = this.nVisible;
  },
  /** Two glowing eyes for creature number `index` of this frame's dark (Zoo Garden's updateEyeGlints): unlit, so they show through the night. */
  glint(index, e, x, z, yaw) {
    if (!this.eyes) {
      this.eyes = new T.InstancedMesh(new T.IcosahedronGeometry(GLINT.size, 1), new T.MeshBasicMaterial({ color: GLINT.color, toneMapped: false, fog: false }), GLINT.max * 2);
      this.eyes.name = 'eye-glints'; this.eyes.frustumCulled = false; this.eyes.castShadow = false; this.eyes.raycast = () => {}; this.eyes.count = 0; this.root.add(this.eyes);
    }
    const s = e.def.scale, y = (e.def.flying ? 1 : 0) + GLINT.up * s, fx = x + Math.sin(yaw) * GLINT.forward * s, fz = z + Math.cos(yaw) * GLINT.forward * s, side = GLINT.side * s;
    for (let k = 0; k < 2; k++) { const d = k ? 1 : -1; this.eyes.setMatrixAt(index * 2 + k, this.m4.makeScale(s, s, s).setPosition(fx + Math.cos(yaw) * side * d, y, fz - Math.sin(yaw) * side * d)); }
  },
  /** The colour of a shot kind (gear.mjs `shot`). */
  tint(kind) { let c = this.tints.get(kind); if (!c) this.tints.set(kind, c = new T.Color(SHOT_COLORS[kind] ?? (kind.includes('fire') ? SHOT_COLORS.fire : SHOT_COLORS.pea))); return c; },
  /** Box shut: free what the GPU holds for the creatures (the kit stays parsed, so opening again needs no download). */
  release() { for (const template of this.templates.values()) template.traverse(m => { if (m.isMesh) m.geometry.dispose(); }); },
};
/** Puts the drawing methods onto the class, replacing its waiting stand-ins. */
export function install(View) { Object.assign(View.prototype, METHODS); }
