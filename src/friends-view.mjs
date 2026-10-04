// Cages, prisoners, followers and friends at their posts, drawn (round 8; owner: builder E; the rules are friends.mjs).
// After Zoo Garden's friend-crew.ts (cages, the rescue, following, posts), friend-view.ts (the friend's look and poses) and
// friend-ui.ts (the lines). installFriends(world, pandora, deps) is called once from main.mjs boot(), after installPandora,
// installLands and installTitans; deps = {state(), act(type, arg), toast(message), persist(), hud()}.
//
// Everything here is a call into another builder's seam, never an edit of one:
//   world.addTreeBlock({x, z, r: CAGE_RADIUS, perch: false}) / world.removeTreeBlock(block)   the cage's collider, while the box is open
//   world.target('cage', id, label, x, z, RESCUE_REACH) / world.removeTarget(spot)            the cage's tap and prompt, with spot.use;
//       registered only while you are within 48 m of the cage and removed beyond 56 m (tests/doors-browser.mjs wants every listed
//       target inside the ward from the ring road)
//   deps.act('rescue', {id, x, z}) / deps.act('friendHome', {x, z})                           runAction: toasts the answer, saves, HUD
//   world.followers.push({moveTo(x, z)})                                                      Home and a knock-out bring followers along
//   installRoomView(world).onFrame(step)                                                      once a frame, before the picture is drawn
//
// Draw cost (spec 16.3, 18): a cage is two merged vertex-coloured meshes (frame, door) from cage.glb, loaded the first time a cage
// that is not hidden is within 96 m (the reference's bars, floor and roof stand in until then); a prisoner or a friend is the
// player's own avatar kit (avatar.mjs buildAvatar: six meshes, one shared material) on the child-size body, and casts no shadow.
// With the box shut nothing of a cage exists: no mesh, no collider, no target, no label. Rescued friends stay, at the homestead.
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon } from './toon.mjs';
import { installRoomView } from './room-view.mjs';
import { buildAvatar, avatarAssets, disposeAvatar, walkAvatar, PLAYER_SCALE } from './avatar.mjs';
import { HEIGHT_RATIO } from './looks.mjs';
import { newGait } from './walk-cycle.mjs';
import { findRoute } from './navigation.mjs';
import { CAMERA_YAW } from './field-layout.mjs';
import { inSafeZone } from './ward.mjs';
import { FRIENDS, FRIEND_IDS, CAGE_RADIUS, RESCUE_REACH, cageSpot, cageState, cageLabel, lockedHint, postSpot, friendHeight, followGoal } from './friends.mjs';

/** A cage's model is asked for within `load` of it and dropped beyond `drop`; its tap exists within `tapIn` and goes beyond `tapOut` (the 48 m rule). */
export const REACH = Object.freeze({ load: 96, drop: 112, tapIn: 48, tapOut: 56, label: 34, name: 9 });
/** Following (friend-crew.ts): up to 7.5 m/s, standing 0.25 m short of the goal, snapping to you beyond 22 m; `home` is the walk to a post. */
export const FOLLOW = Object.freeze({ speed: 7.5, stand: .25, snap: 22, home: 3.4 });
/** The child-size body every friend is built on (public/assets/models/hero-tiny.glb). */
export const FRIEND_LOOK = 'boy-tiny-none-none';
/** The root scale for a share of the player's height: the default player is the tall body at PLAYER_SCALE (friend-view.ts friendScale). */
export const friendScale = share => PLAYER_SCALE * HEIGHT_RATIO.tall / HEIGHT_RATIO.tiny * share;
/** Freed friends wear a work hat (display only, never saved); prisoners have none (friend-view.ts WORK_HATS). */
export const WORK_HATS = Object.freeze({ sprout: 'hat_straw', clover: 'hat_cowboy', pepper: 'hat_chef' });
/** A friend stands at its post by day: from 6:00 until 21:00. */
export const atPost = time => !(time >= 21 || time < 6);
const ROLE_ICON = { garden: '🌱', farm: '🐄', cook: '🍳' }, ROLE_POSE = { garden: 'plant', farm: 'feed', cook: 'cook' };
const HAIR = new T.Color('#7C4527'); // hero_spec.py 'Hero hair', baked into the head's vertex colours
const colour = new T.Color(), v3 = new T.Vector3(), len = Math.hypot;

// ---------------------------------------------------------------- the cage's model (cage.glb, or the reference's stand-in)
const CAGE_LIT = toon({ vertexColors: true }); CAGE_LIT.name = 'Cage';
const kit = { ready: false, requested: false, failed: false, parts: null };
/** A geometry with nothing but positions, normals and one colour. */
function painted(geometry, tint) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry; if (g !== geometry) geometry.dispose();
  for (const key of Object.keys(g.attributes)) if (key !== 'position' && key !== 'normal') g.deleteAttribute(key);
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  const n = g.getAttribute('position').count, colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { colors[i * 3] = tint.r; colors[i * 3 + 1] = tint.g; colors[i * 3 + 2] = tint.b; }
  g.setAttribute('color', new T.BufferAttribute(colors, 3)); return g;
}
const merge = list => { const g = list.length > 1 ? mergeGeometries(list, false) : list[0] ?? null; if (list.length > 1) list.forEach(p => p.dispose()); g?.computeBoundingSphere(); return g; };
/** One root of cage.glb as one vertex-coloured geometry in the file's own space (cute_game assets.ts mergedParts). */
function bakeRoot(root) {
  const pieces = [];
  root.traverse(o => { if (!o.isMesh) return; const material = Array.isArray(o.material) ? o.material[0] : o.material, g = painted(o.geometry.clone(), material?.color ?? colour.set('#ffffff')); g.applyMatrix4(o.matrixWorld); pieces.push(g); });
  return merge(pieces);
}
function loadKit(onReady) {
  if (kit.requested) return; kit.requested = true;
  new GLTFLoader().loadAsync('./assets/models/cage.glb').then(gltf => {
    gltf.scene.updateMatrixWorld(true);
    const cage = gltf.scene.getObjectByName('cage'), door = gltf.scene.getObjectByName('cage_door');
    const parts = { cage: cage && bakeRoot(cage), cage_door: door && bakeRoot(door) };
    if (!parts.cage || !parts.cage_door) throw Error('cage.glb: a root is missing');
    kit.parts = parts; kit.ready = true; onReady();
  }).catch(() => { kit.failed = true; }); // the stand-in stays
}
let standIn = null;
/** Bars, a floor and a roof until cage.glb lands (friend-crew.ts cagePart), merged into one mesh a part. */
function standInParts() {
  if (standIn) return standIn;
  const bars = angles => angles.map(d => { const a = d * Math.PI / 180; return painted(new T.CylinderGeometry(.026, .026, 1.45, 5), colour.set('#56607a')).translate(.7 * Math.sin(a), .83, .7 * Math.cos(a)); });
  const frame = bars([70, 100, 130, 160, 190, 220, 250, 280]);
  frame.push(painted(new T.CylinderGeometry(.76, .76, .12, 16), colour.set('#b5793f')).translate(0, .06, 0), painted(new T.ConeGeometry(.78, .34, 16), colour.set('#d9534a')).translate(0, 1.72, 0));
  return standIn = { cage: merge(frame), cage_door: merge(bars([-43, -14, 14, 43])) };
}

// ---------------------------------------------------------------- a friend's look and poses (friend-view.ts)
/** The friend's own hair colour, written over the kit's brown in the head's vertex colours (friend-view.ts recolourHair). Returns the vertices changed. */
function recolourHair(avatar, hex) {
  const head = avatar.userData.parts?.head; if (!head) return 0;
  let changed = 0; colour.set(hex);
  for (const mesh of head.children) {
    if (!mesh.isMesh) continue;
    const from = mesh.geometry.getAttribute('color'); if (!from) continue;
    const near = i => Math.abs(from.getX(i) - HAIR.r) + Math.abs(from.getY(i) - HAIR.g) + Math.abs(from.getZ(i) - HAIR.b) < .03;
    let hit = false; for (let i = 0; i < from.count && !hit; i++) hit = near(i);
    if (!hit) continue;
    let colors = from;
    if (!mesh.userData.ownedGeometry && !mesh.userData.avatarShared) {
      // The head's geometry is the template's, shared with every avatar of the look: this friend gets its own colours only.
      const base = mesh.geometry, own = new T.BufferGeometry(); own.setAttribute('position', base.getAttribute('position')); own.setAttribute('normal', base.getAttribute('normal'));
      colors = new T.BufferAttribute(new Float32Array(from.array), 3); own.setAttribute('color', colors); own.boundingSphere = base.boundingSphere;
      mesh.geometry = own; mesh.userData.avatarShared = true;
    }
    const hits = []; for (let i = 0; i < from.count; i++) if (near(i)) hits.push(i);
    for (const i of hits) colors.setXYZ(i, colour.r, colour.g, colour.b);
    changed += hits.length; colors.needsUpdate = true;
  }
  return changed;
}
/** A prisoner (no hat) or a freed friend (its work hat) at `share` of the player's height, casting no shadow. */
function buildFriend(world, id, share, freed) {
  const f = FRIENDS[id], root = buildAvatar(world, { look: FRIEND_LOOK, outfitColor: f.tint, gear: freed ? { hat: WORK_HATS[id] } : null });
  root.name = 'friend-' + id; root.userData.hair = recolourHair(root, f.hair); root.userData.friend = id;
  root.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  root.scale.setScalar(friendScale(share));
  const rig = root.children[0]; if (rig) rig.rotation.order = 'YXZ';
  return root;
}
/**
 * Small rigid poses on the avatar's parts and a lean of the whole rig (friend-view.ts poseFriend): idle, walk, sad (head hung, arms
 * limp, a slow sway), plant, feed, cook, cheer. `t` is the friend's own clock in seconds. Returns the lift in metres.
 */
function poseFriend(root, pose, t) {
  const p = root.userData.parts, rig = root.children[0]; if (!p || !rig) return 0;
  const armL = p.arm_l, armR = p.arm_r, head = p.head;
  armL.rotation.set(0, 0, -.3); armR.rotation.set(0, 0, .3); p.leg_l.rotation.set(0, 0, 0); p.leg_r.rotation.set(0, 0, 0); head.rotation.set(0, 0, 0);
  let lean = 0, lift = 0, roll = 0;
  switch (pose) {
    case 'walk': lean = .1; break;
    case 'sad': head.rotation.set(.45 + Math.max(0, Math.sin(t * .9)) * .15, Math.sin(t * .4) * .25, 0); armL.rotation.set(-.25, 0, -.08); armR.rotation.set(-.25, 0, .08); roll = Math.sin(t * 1.1) * .05; lean = .08; break;
    case 'plant': lean = .25; head.rotation.set(.35, 0, 0); armR.rotation.set(-1 + Math.sin(t * 5) * .2, 0, .2); armL.rotation.set(-.4, 0, -.3); break;
    case 'feed': { const k = Math.max(0, Math.sin(t * 5)); armR.rotation.set(-.6 - k, 0, .25); armL.rotation.set(-.5, 0, -.3); head.rotation.set(.2, 0, 0); lean = .1; break; }
    case 'cook': armR.rotation.set(-1.1 + Math.sin(t * 6) * .25, 0, .25 + Math.cos(t * 6) * .25); armL.rotation.set(-.9, 0, -.2); head.rotation.set(.2 + Math.sin(t * 3) * .06, Math.sin(t * 1.5) * .2, 0); lean = .12; break;
    case 'cheer': armL.rotation.set(-2.6, 0, -.4); armR.rotation.set(-2.6, 0, .4); lift = Math.abs(Math.sin(t * 8)) * .12; break;
    default: armL.rotation.set(0, 0, -.3 - Math.sin(t * 2) * .05); armR.rotation.set(0, 0, .3 + Math.sin(t * 2) * .05); head.rotation.set(0, Math.sin(t * .6) * .3, 0);
  }
  rig.rotation.x = lean; rig.rotation.z = roll;
  return lift;
}

// ---------------------------------------------------------------- the installer
export function installFriends(world, pandora, deps = {}) {
  if (world.__friends) return world.__friends;
  if (!world.renderer || !deps.state) return world.__friends = {}; // a bare world (tests)
  const room = installRoomView(world), state = () => deps.state();
  const group = new T.Group(); group.name = 'friends';
  const cages = new Map(), actors = new Map();
  let mounted = false, layer = null, lastT = world.t, said = null, homeTry = 0, bursts = 0;
  const mount = () => { if (!mounted) { mounted = true; world.outside.add(group); } };
  const here = () => world.player.position;

  // ---- labels: a cage's ("🔒 Locked cage", "🗝️ Sprout"), a friend's name, and the line a friend says when it is freed
  function tag(className) {
    if (!layer) { layer = document.createElement('div'); layer.id = 'friend-tags'; (document.getElementById('app') ?? document.body).appendChild(layer); }
    const el = document.createElement('div'); el.className = className; el.hidden = true; layer.appendChild(el); return el;
  }
  function place(el, show, text, x, y, z) {
    if (show) { v3.set(x, y, z).project(world.camera); show = v3.z < 1 && Math.abs(v3.x) < 1.15 && Math.abs(v3.y) < 1.15; }
    if (el.hidden === show) el.hidden = !show; if (!show) return;
    if (el.textContent !== text) el.textContent = text;
    el.style.transform = `translate(${((v3.x + 1) * innerWidth / 2).toFixed(1)}px, ${((1 - v3.y) * innerHeight / 2).toFixed(1)}px) translate(-50%, -100%)`;
  }

  // ---- cages
  const cageMesh = (name, shadow) => { const parts = kit.ready ? kit.parts : standInParts(), m = new T.Mesh(parts[name], CAGE_LIT); m.name = name; m.castShadow = shadow; m.scale.setScalar(1.2); return m; }; // shown 1.2x, so it reads at the game camera
  function dropPrisoner(c) { if (c.prisoner) { c.prisoner.removeFromParent(); disposeAvatar(c.prisoner); c.prisoner = null; } }
  function dropModel(c) { dropPrisoner(c); if (c.group) { c.group.removeFromParent(); c.group = c.frame = c.door = c.pop = null; } }
  function dropCage(c) {
    dropModel(c);
    if (c.block) { world.removeTreeBlock(c.block); c.block = null; }
    if (c.target) { world.removeTarget(c.target); c.target = null; }
    if (c.label) { c.label.remove(); c.label = null; }
    cages.delete(c.id);
  }
  function addPrisoner(c) {
    dropPrisoner(c); if (!c.group) return;
    // Until hero-tiny.glb lands the prisoner is not shown (a taller body would stand in); it is built again when the file arrives.
    const wait = avatarAssets(world, { look: FRIEND_LOOK });
    if (wait) wait.then(() => { if (c.group && c.prisoner && cages.get(c.id) === c) addPrisoner(c); });
    c.prisoner = buildFriend(world, c.id, friendHeight(null, 0), false); c.prisoner.position.set(0, 0, .22); c.prisoner.visible = !c.prisoner.userData.pending; c.group.add(c.prisoner);
  }
  function buildModel(c) {
    mount();
    const g = c.group = new T.Group(); g.name = 'cage-' + c.id; g.position.set(c.x, 0, c.z); g.rotation.y = CAMERA_YAW; // the door faces the camera
    c.kit = kit.ready ? 'glb' : 'bars'; c.frame = cageMesh('cage', true); g.add(c.frame); // only the frame casts a shadow
    c.door = c.state === 'rescued' ? null : cageMesh('cage_door', false); if (c.door) g.add(c.door);
    group.add(g); if (c.state !== 'rescued') addPrisoner(c);
  }
  function rescue(id) {
    const c = cages.get(id), p = here(); if (!c || c.state !== 'open') return false;
    const result = deps.act('rescue', { id, x: p.x, z: p.z }); if (!result?.ok) return false;
    // The door pops off and tumbles away; the prisoner steps out cheering and starts to follow (friend-crew.ts rescue).
    c.state = 'rescued'; if (c.target) { world.removeTarget(c.target); c.target = null; }
    if (c.door) c.pop = { t: 0, vx: (Math.random() - .5) * 2, vz: 2.6 };
    dropPrisoner(c);
    const friend = state().friends.find(f => f.id === id), a = actor(friend); a.x = c.x + .9; a.z = c.z + 1.2; a.facing = 0; a.cheer = 1.6; a.route = null; a.shown = true;
    const fx = pandora?.fx;
    if (fx) {
      fx.burst(a.x, .8, a.z, 30, ['#ffe66d', '#ffffff', FRIENDS[id].tint], 5, 6, .14, .9); bursts++;
      // The reference's `level` fanfare (cute_game sfx.ts:78): the fight's own `level` sound (combat-fx-draw.mjs, builder D), so the sound setting holds.
      fx.play?.('level');
    }
    said = { id, text: result.hello ?? '', life: 3.2, el: said?.el ?? tag('friend-say') };
    return true;
  }
  /** A tap (or E) on a cage: rescue when open, a hint when locked (friend-crew.ts tapCage). The world has walked you up to it first. */
  function tapCage(id) {
    const c = cages.get(id); if (!c) return;
    if (c.state === 'open') { if (!rescue(id)) deps.toast?.(`Walk up to the cage to free ${FRIENDS[id].name}.`); }
    else if (c.state === 'locked') deps.toast?.('🔒 ' + lockedHint(id));
  }
  function stepCages(s, dt, village) {
    const p = here();
    for (const id of FRIEND_IDS) {
      const now = cageState(s, id); let c = cages.get(id);
      if (now === 'hidden') { if (c) dropCage(c); continue; }
      if (!c) { const at = cageSpot(id); cages.set(id, c = { id, x: at.x, z: at.z, state: now, group: null, frame: null, door: null, prisoner: null, block: null, target: null, label: null, pop: null, kit: '', t: FRIEND_IDS.indexOf(id) * 1.7 }); }
      // Solid while the box is open, so you and the creatures walk round it.
      c.block ??= world.addTreeBlock({ x: c.x, z: c.z, r: CAGE_RADIUS, perch: false });
      if (c.state !== now) { // a boss fell (locked -> open), or the save changed under us; a rescue sets 'rescued' itself and keeps the door for its tumble
        c.state = now; dropModel(c); if (c.target) c.target.label = cageLabel(id, now);
      }
      const d = village ? len(p.x - c.x, p.z - c.z) : Infinity;
      if (d < REACH.load) { if (!kit.requested) loadKit(() => { for (const o of cages.values()) if (!o.pop) dropModel(o); }); if (!c.group) buildModel(c); }
      else if (d > REACH.drop && c.group) dropModel(c);
      // The tap and the prompt: the 48 m rule. An empty cage is only scenery: no label, no tap.
      const tappable = now !== 'rescued';
      if (tappable && d < REACH.tapIn && !c.target) { c.target = world.target('cage', id, cageLabel(id, now), c.x, c.z, RESCUE_REACH); c.target.use = () => tapCage(id); }
      else if (c.target && (!tappable || d > REACH.tapOut)) { world.removeTarget(c.target); c.target = null; }
      if (tappable && d < REACH.label) { place(c.label ??= tag('friend-tag cage-tag'), true, cageLabel(id, now), c.x, 2.95, c.z); c.label.classList.toggle('open', now === 'open'); }
      else if (c.label) place(c.label, false);
      c.t += dt; if (c.prisoner?.visible) c.prisoner.position.y = poseFriend(c.prisoner, 'sad', c.t);
      if (c.pop && c.door) {
        const k = c.pop; k.t += dt; c.door.position.set(k.vx * k.t, Math.max(0, 2.2 * k.t - 4.9 * k.t * k.t), k.vz * k.t); c.door.rotation.x = -k.t * 4;
        if (k.t > .9) { c.door.removeFromParent(); c.door = null; c.pop = null; }
      }
      // Walking up to an open cage frees the prisoner too (on foot: a driver steps out first).
      if (now === 'open' && village && !world.riding && !world.paused && d < RESCUE_REACH) rescue(id);
    }
  }

  // ---- friends: following you home, then at their posts
  function actor(f) {
    let a = actors.get(f.id); if (a) return a;
    const post = postSpot(f.id);
    a = { id: f.id, root: null, share: 0, x: post.x, z: post.z, facing: CAMERA_YAW, t: Math.random() * 9, gait: newGait(), pose: 'idle', cheer: 0, route: null, shown: false, moved: 0, name: null };
    actors.set(f.id, a); return a;
  }
  function dress(a, share) {
    if (a.root) { a.root.removeFromParent(); disposeAvatar(a.root); }
    mount();
    // Built again once the body and the work hat have landed (gear-wear.glb comes the first time a friend is freed).
    const wait = avatarAssets(world, { look: FRIEND_LOOK, gear: { hat: WORK_HATS[a.id] } });
    if (wait) wait.then(() => { if (actors.get(a.id) === a) a.share = 0; });
    a.root = buildFriend(world, a.id, share, true); a.share = share; a.root.visible = false; group.add(a.root);
  }
  function dropActor(a) { if (a.root) { a.root.removeFromParent(); disposeAvatar(a.root); } a.name?.remove(); actors.delete(a.id); }
  const turn = (a, to, dt) => { a.facing += Math.atan2(Math.sin(to - a.facing), Math.cos(to - a.facing)) * Math.min(1, dt * 10); };
  /** Moves towards a goal; true once within `stand` of it (friend-crew.ts walk). `a.moved` is the metres covered this frame. */
  function walk(a, gx, gz, dt, speed, stand) {
    const dx = gx - a.x, dz = gz - a.z, d = len(dx, dz);
    if (d <= stand + .02) return true;
    const step = Math.min(d - stand, Math.max(speed * .5, Math.min(speed, d * 2.5)) * dt); a.x += dx / d * step; a.z += dz / d * step; a.moved = step;
    turn(a, Math.atan2(dx, dz), dt); a.pose = 'walk'; return false;
  }
  /** A friend that has reached the village walks to its post round the buildings (navigation.mjs findRoute), or is simply there. */
  function sendHome(a) {
    const post = postSpot(a.id);
    if (world.location === 'village' && a.shown) {
      const from = { x: a.x, z: a.z }, route = findRoute(from, post, world.routeObstacles(from, post), world.bounds);
      if (route.length) { a.route = route; a.cheer = 1; return; }
    }
    a.x = post.x; a.z = post.z; a.route = null;
  }
  function stepFriends(s, dt, village) {
    const p = here(), list = s.friends ?? [], open = s.pandora === true, riding = !!world.riding;
    for (const a of [...actors.values()]) if (!list.some(f => f.id === a.id)) dropActor(a);
    // Reaching the village: inside the ward (every house is inside it), or at once when the box is shut.
    if (!world.paused && list.some(f => !f.home) && (homeTry -= dt) <= 0) {
      const at = village ? p : world.returnPosition ?? p;
      if (!open || inSafeZone(at.x, at.z)) { homeTry = 1; const result = deps.act('friendHome', { x: at.x, z: at.z }); if (result?.ok) for (const id of result.ids ?? []) { const a = actors.get(id); if (a) sendHome(a); } }
    }
    let slot = 0;
    for (const f of list) {
      const a = actor(f), share = friendHeight(f, s.day); a.t += dt; a.moved = 0; a.pose = 'idle';
      let show = village;
      if (!f.home) {
        // Following, on foot: hidden while you ride, standing beside you when you step out (spec 16.2).
        show &&= !riding;
        const goal = followGoal(p, world.player.rotation.y, slot++);
        if (show && (!a.shown || len(goal.x - a.x, goal.z - a.z) > FOLLOW.snap)) { a.x = goal.x; a.z = goal.z; a.facing = world.player.rotation.y; }
        if (show) { if (a.cheer > 0) { a.cheer -= dt; a.pose = 'cheer'; } else walk(a, goal.x, goal.z, dt, FOLLOW.speed, FOLLOW.stand); }
      } else {
        const post = postSpot(f.id);
        show &&= atPost(s.time) || !!a.route;
        if (a.cheer > 0) { a.cheer -= dt; a.pose = 'cheer'; }
        else if (a.route?.length) { const next = a.route[0]; if (walk(a, next.x, next.z, dt, FOLLOW.home, .06)) a.route.shift(); }
        else {
          a.route = null; a.x = post.x; a.z = post.z;
          // At the post: looking round, and now and then a little of its own work.
          turn(a, CAMERA_YAW, dt * .3); a.pose = Math.sin(a.t * .35 + FRIEND_IDS.indexOf(f.id) * 2.1) > .45 ? ROLE_POSE[FRIENDS[f.id].role] : 'idle';
        }
      }
      a.shown = show;
      if (show && (!a.root || a.share !== share)) dress(a, share);
      if (a.root && a.root.visible !== show) a.root.visible = show;
      if (a.root && show) {
        const lift = poseFriend(a.root, a.pose, a.t);
        a.root.position.set(a.x, walkAvatar(a.root, a.gait, a.moved, dt) + lift, a.z); a.root.rotation.y = a.facing;
      }
      const near = show && f.home && len(p.x - a.x, p.z - a.z) < REACH.name;
      if (near || a.name) place(a.name ??= tag('friend-tag'), near, `${ROLE_ICON[FRIENDS[f.id].role]} ${FRIENDS[f.id].name}`, a.x, 2.2 * share + .45, a.z);
    }
    if (said) {
      const a = actors.get(said.id); said.life -= dt;
      place(said.el, said.life > 0 && !!a?.shown, said.text, a?.x ?? 0, 2.9, a?.z ?? 0);
      if (said.life <= 0) { said.el.remove(); said = null; }
    }
  }

  // Home (a teleport) and a knock-out bring every follower along: it stands behind you where you land.
  world.followers.push({ moveTo(x, z) { let slot = 0; for (const f of state().friends ?? []) { if (f.home) continue; const a = actors.get(f.id), goal = followGoal({ x, z }, world.player.rotation.y, slot++); if (a) { a.x = goal.x; a.z = goal.z; a.route = null; } } } });

  room.onFrame(() => {
    if (!world.ready || !world.player) return;
    if (window.willowmere && !window.willowmere.friends) window.willowmere.friends = diagnostics;
    const dt = world.paused ? 0 : Math.min(.05, Math.max(0, world.t - lastT)); lastT = world.t;
    const s = state(), village = world.location === 'village';
    if (layer && layer.hidden === village) layer.hidden = !village;
    if (s.pandora === true || cages.size) stepCages(s, dt, village);
    if (s.friends?.length || actors.size) stepFriends(s, dt, village);
  });

  /** Read-only numbers for tests and performance checks (window.willowmere.friends()). */
  function diagnostics() {
    const spot = (x, y, z) => { v3.set(x, y, z).project(world.camera); return { x: (v3.x + 1) * innerWidth / 2, y: (1 - v3.y) * innerHeight / 2 }; };
    const height = o => { if (!o || !o.parent) return 0; const box = new T.Box3().setFromObject(o); return box.max.y - box.min.y; };
    let meshes = 0; group.traverse(o => { if (o.isMesh && o.visible && (!o.parent || o.parent.visible)) meshes++; });
    return {
      kit: kit.ready ? 'glb' : kit.failed ? 'failed' : kit.requested ? 'loading' : 'none', mounted, meshes, player: height(world.player),
      cages: [...cages.values()].map(c => ({ id: c.id, state: c.state, x: c.x, z: c.z, built: !!c.group, kit: c.group ? c.kit : '', door: !!c.door, popping: !!c.pop, prisoner: !!c.prisoner?.visible, prisonerHeight: height(c.prisoner), hair: c.prisoner?.userData.hair ?? 0,
        shadows: c.group ? (() => { let n = 0; c.group.traverse(o => { if (o.isMesh && o.castShadow) n++; }); return n; })() : 0,
        block: !!c.block && !c.block.gone, target: !!c.target, label: c.label && !c.label.hidden ? c.label.textContent : '', screen: spot(c.x, 1.2, c.z) })),
      actors: [...actors.values()].map(a => ({ id: a.id, x: a.x, z: a.z, shown: !!a.shown && !!a.root?.visible, pose: a.pose, share: a.share, height: height(a.root), hair: a.root?.userData.hair ?? 0, pending: !!a.root?.userData.pending, routing: a.route?.length ?? 0, cheering: a.cheer > 0,
        hat: !!a.root?.userData.parts?.head?.children.some(m => m.userData.ownedGeometry), name: a.name && !a.name.hidden ? a.name.textContent : '', screen: spot(a.x, .6, a.z) })),
      said: said ? { id: said.id, text: said.text, shown: !said.el.hidden } : null, bursts,
    };
  }
  return world.__friends = { group, cages, actors, diagnostics, rescue, tapCage };
}
