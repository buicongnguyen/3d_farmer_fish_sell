// Draws the wild creatures (wilds.mjs), after Zoo Garden's creature art and body language (cute_game src/creature-art.ts,
// world.ts animateEnemy / updateEnemyVisual). The models come from wild-creatures.glb (scripts/trim-creatures.mjs): a root
// node per creature with one rigid child per part, `<id>_<part>`, whose origin is the hinge. Each part's pieces are merged
// with their colours baked into the vertices, so a creature is one draw for the body plus four legs or two wings, and every
// creature shares one vertex-colour toon material (the same shader as Willowmere's baked scenery, nothing new to compile).
//
// The file is fetched only when the box is first opened. Level of detail by distance from the view's centre: within
// 16 m a creature is its animated parts; past 20 m it is one merged mesh (legs and wings at rest, one draw); in between
// it keeps the look it has. It casts a shadow as far as the screen reaches, and beyond the view it is hidden and, a
// little farther, has no model at all (the model goes back to a pool per kind).
//
// Nothing here flips from one frame to the next (creature-lod.mjs): the simulation steps every 25 ms (a calm creature
// far away only on every 4th step) while the picture is drawn every frame, so a creature is drawn gliding between the
// place it left and the place the simulation has it (wilds.mjs glideShare); whether it walks is read from the speed
// it is drawn at, with two thresholds; its walking pose (the hop, the leg swing) fades in and out; its facing turns at
// a limited rate; and the switch between the two looks waits until the limbs are at rest, where both look alike.
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon } from './toon.mjs';
import { CREATURES, AI, windupProgress, glideShare } from './wilds.mjs';
import { LOD, nearLook, inView, castsShadow, walking, ease, turnToward } from './creature-lod.mjs';

export const CREATURE_FILE = './assets/models/wild-creatures.glb';
/** The animation's hinge names: it swings leg1 with leg2 and leg0 with leg3 (a trot). */
const HINGES = { leg_bl: 'leg0', leg_fl: 'leg1', leg_br: 'leg2', leg_fr: 'leg3', wing_l: 'wing-l', wing_r: 'wing-r' };
/**
 * Hidden beyond `hide` metres from the view's centre (more when the camera is zoomed out); animated parts within `near`,
 * the merged mesh past `far`. A model is made within `attach` metres past the view and put away `detach` metres past it.
 */
export const VIEW = { hide: 46, near: LOD.near, far: LOD.far, attach: 10, detach: 26 };
/** Facing turns at most this fast (radians a second): calm, and when it is after you. */
const TURN = { calm: 5, alert: 14 };
const SHOT_COLORS = { pea: '#c4ec9f', ice: '#a9eeff', fire: '#ff985f', bubble: '#b6eaff', spike: '#cae482', arrow: '#ffe689', star: '#ffe689', volt: '#8fdcff', rainbow: '#ff9cf5' };
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

export class WildsView {
  /** @param world the Willowmere World. Nothing joins the scene until mount() (the first time the box is opened). */
  constructor(world) {
    this.world = world; this.root = new T.Group(); this.root.name = 'wild-creatures';
    this.material = toon({ vertexColors: true }); this.flash = toon({ vertexColors: true, emissive: '#ffffff', emissiveIntensity: .38 }); // a soft wash: the shape stays readable
    this.templates = new Map(); this.free = new Map(); this.icons = new Map(); this.loading = null; this.ready = false; this.visible = 0; this.failed = false;
    // Shots (the cactus's spines and the player's peas): one instanced draw.
    this.shots = new T.InstancedMesh(new T.IcosahedronGeometry(.17, 1), new T.MeshBasicMaterial({ toneMapped: false }), 22);
    this.shots.setColorAt(0, new T.Color('#ffffff')); this.shots.count = 0; this.shots.frustumCulled = false; this.shots.castShadow = false; this.shots.raycast = () => {}; this.root.add(this.shots);
    this.m4 = new T.Matrix4(); this.spine = new T.Color('#fff1cf'); this.tints = new Map();
  }
  /** Creatures are children of world.outside, so they hide with the village. */
  mount() { if (!this.root.parent) this.world.outside.add(this.root); }
  /** Fetches and prepares the creature kit (once). Resolves when creatures can be drawn. */
  load() {
    return this.loading ??= new GLTFLoader().loadAsync(CREATURE_FILE).then(gltf => {
      gltf.scene.updateMatrixWorld(true);
      for (const node of gltf.scene.children) {
        if (!CREATURES[node.name]) continue;
        const toRoot = node.matrixWorld.clone().invert(), template = new T.Group(); template.name = 'creature-' + node.name;
        for (const part of node.children) {
          const role = part.name.startsWith(node.name + '_') ? part.name.slice(node.name.length + 1) : part.name, { geometry, pivot } = mergePart(part, toRoot); if (!geometry) continue;
          const mesh = new T.Mesh(geometry, this.material); mesh.name = 'creature-' + role; mesh.castShadow = false; mesh.receiveShadow = false;
          if (HINGES[role]) { const hinge = new T.Group(); hinge.name = HINGES[role]; hinge.position.copy(pivot); hinge.add(mesh); template.add(hinge); } else { mesh.position.copy(pivot); template.add(mesh); }
        }
        box.setFromObject(template); template.userData.height = box.max.y; template.userData.footprint = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2;
        // The far look: a creature of several parts merged at rest into one mesh.
        if (template.children.length > 1) {
          template.updateMatrixWorld(true); const pieces = [];
          template.traverse(m => { if (m.isMesh) { const g = m.geometry.clone(); g.applyMatrix4(m.matrixWorld); pieces.push(g); } });
          const far = new T.Mesh(mergeGeometries(pieces, false), this.material); pieces.forEach(p => p.dispose()); far.name = 'creature-far'; far.visible = false; far.castShadow = far.receiveShadow = false; template.add(far);
        }
        this.templates.set(node.name, template);
      }
      gltf.scene.traverse(m => { if (m.isMesh) { m.geometry.dispose(); m.material.dispose?.(); } });
      this.ready = this.templates.size > 0;
    }).catch(error => { console.error('The wild creatures could not load.', error); this.failed = true; this.loading = null; });
  }
  /** A model for a creature: from the pool of its kind, or a new one sharing the kit's geometry. */
  attach(e) {
    if (e.view || !this.ready) return;
    const template = this.templates.get(e.type); if (!template) return;
    let group = this.free.get(e.type)?.pop();
    if (!group) {
      group = template.clone(true); group.rotation.order = 'YXZ';
      const u = group.userData; u.meshes = []; group.traverse(m => { if (m.isMesh) u.meshes.push(m); });
      u.far = group.getObjectByName('creature-far') ?? null; u.body = group.getObjectByName('creature-body') ?? u.meshes[0]; u.parts = group.children.filter(c => c !== u.far);
      u.legs = [0, 1, 2, 3].map(i => group.getObjectByName('leg' + i)).filter(Boolean); u.wings = ['wing-l', 'wing-r'].map(n => group.getObjectByName(n)).filter(Boolean);
      u.height = template.userData.height; u.footprint = template.userData.footprint;
    }
    Object.assign(group.userData, { anim: (e.homeX * 3.7) % 6, drawX: e.x, drawZ: e.z, yaw: e.facing, speed: 0, moving: false, walk: 0, limb: 0, strike: 0, phase: e.phase, close: null, shadow: null, lit: false });
    group.visible = false; this.root.add(group); e.view = group;
  }
  detach(e) {
    const group = e.view; if (!group) return; e.view = null; group.removeFromParent();
    if (group.userData.lit) { group.userData.lit = false; for (const m of group.userData.meshes) m.material = this.material; }
    let list = this.free.get(e.type); if (!list) this.free.set(e.type, list = []); list.push(group);
  }
  /** A small portrait of a creature kind for the target frame, rendered once from its model. */
  icon(type) {
    if (this.icons.has(type)) return this.icons.get(type);
    const template = this.templates.get(type); if (!template || !this.world.snapshot) return '';
    const scene = this.world.iconScene(), model = template.clone(true); model.rotation.y = .5; scene.add(model); model.updateMatrixWorld(true);
    const b = new T.Box3().setFromObject(model), c = b.getCenter(new T.Vector3()), r = b.getSize(new T.Vector3()).length() / 2 * .8, cam = new T.OrthographicCamera(-r, r, r, -r, .01, r * 20);
    cam.position.copy(c).add(new T.Vector3(r * 1.2, r * 1.5, r * 3)); cam.lookAt(c);
    const url = this.world.snapshot(scene, cam, 96); this.icons.set(type, url); return url;
  }
  /** Height of a creature's head above the ground, for the target arrow and floating numbers. */
  top(e) { return (e.view?.userData.height ?? 1.6) * e.def.scale + e.lift + (e.def.flying ? 1 : 0); }
  footprint(e) { return Math.max(e.radius + .35, (e.view?.userData.footprint ?? e.radius) * e.def.scale * 1.15); }

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
  }
  /**
   * Every frame. `focus` is where the camera looks, `reach` how far creatures are worth drawing, `shade` how far they
   * cast shadows, `now` the simulation's clock plus what this frame has gathered towards its next step (creatures are
   * drawn gliding to where the simulation has them). `fx` draws the danger discs of this frame (begin and end are the caller's).
   */
  update(wilds, combat, dt, time, focus, reach, fx, now = wilds.time, shade = VIEW.near) {
    let visible = 0, shots = 0, budget = 3;
    for (let n = 0; n < wilds.list.length; n++) {
      const e = wilds.list[n];
      if (!e.view) {
        // A model only for a creature the view is about to reach; at most a few new ones a frame unless it is already in view.
        const away = len(e.x - focus.x, e.z - focus.z); if (away > reach + VIEW.attach || (away > reach && budget <= 0)) continue;
        this.attach(e); if (!e.view) continue; budget--;
      }
      // Where it is drawn: on the way from the place it last left to the place the simulation has it.
      const group = e.view, u = group.userData, share = glideShare(e, now), x = e.px + (e.x - e.px) * share, z = e.pz + (e.z - e.pz) * share, distance = len(x - focus.x, z - focus.z);
      if (distance > reach + VIEW.detach) { this.detach(e); continue; }
      // Out of sight: no animation, no matrices, no draws. A defeated creature swells and shrinks away instead of blinking out.
      const dying = e.hp <= 0 ? e.dying : 0, show = (e.hp > 0 || dying > 0) && inView(group.visible, distance, reach);
      if (group.visible !== show) { group.visible = show; u.drawX = x; u.drawZ = z; u.yaw = e.facing; u.speed = 0; }
      if (!show) continue;
      visible++;
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
      u.yaw = turnToward(u.yaw, e.facing, e.phase === 'idle' || e.phase === 'return' ? TURN.calm : TURN.alert, dt);
      group.position.set(x, e.lift + (e.def.flying ? 1 + Math.sin(time * 4 + e.homeX) * .15 : 0), z); group.rotation.y = u.yaw;
      let k = e.def.scale;
      if (e.hp <= 0) { const t = 1 - dying / AI.dying; k *= (1 + t * .3) * Math.max(.001, 1 - t); }
      else if (e.leaving > 0) k *= Math.max(.001, e.leaving / AI.leave);
      else if (e.born > 0) { const t = 1 - e.born / AI.born; k *= t * (1.25 - .25 * t); } // pops in a little larger, then settles
      group.scale.setScalar(k);
      if (e.flash > 0) { const f = e.flash / .14; group.scale.x *= 1 + f * .15; group.scale.z *= 1 + f * .15; group.scale.y *= 1 + f * .06; }
      if (e.hp > 0) this.animate(e, group, dt, time);
      // Danger on the ground: the King Bear's slam and the snapping flower's bite; the others warn by pose alone.
      if (e.phase === 'windup' && fx) {
        if (e.slam) fx.decal(x, z, AI.slamRadius, windupProgress(e), '#ff7a2a');
        else if (e.def.telegraph) fx.decal(x + Math.sin(e.facing) * 1.2, z + Math.cos(e.facing) * 1.2, e.def.telegraph, windupProgress(e), '#ff3b3b');
      }
    }
    for (let i = 0; i < wilds.shots.length; i++) { const s = wilds.shots[i]; if (!s.live) continue; this.shots.setMatrixAt(shots, this.m4.makeTranslation(s.x, 1, s.z)); this.shots.setColorAt(shots, this.spine); shots++; }
    if (combat) for (let i = 0; i < combat.shots.length; i++) { const s = combat.shots[i]; if (!s.live) continue; this.shots.setMatrixAt(shots, this.m4.makeTranslation(s.x, 1, s.z)); this.shots.setColorAt(shots, this.tint(s.kind)); shots++; }
    if (shots || this.shots.count) { this.shots.count = shots; this.shots.instanceMatrix.needsUpdate = true; this.shots.instanceColor.needsUpdate = true; } this.shots.visible = shots > 0;
    this.visible = visible;
  }
  /** The colour of a shot kind (gear.mjs `shot`). */
  tint(kind) { let c = this.tints.get(kind); if (!c) this.tints.set(kind, c = new T.Color(SHOT_COLORS[kind] ?? (kind.includes('fire') ? SHOT_COLORS.fire : SHOT_COLORS.pea))); return c; }
  /** Box shut: free what the GPU holds for the creatures (the kit stays parsed, so opening again needs no download). */
  release() { for (const template of this.templates.values()) template.traverse(m => { if (m.isMesh) m.geometry.dispose(); }); }
}
