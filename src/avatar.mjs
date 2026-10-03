// The modular hero, after Zoo Garden's explorer (cute_game src/assets.ts HeroLibrary / heroKitFor / bakePart /
// dressEars / applyBuild and src/world.ts avatar / wearKit / kitFor): a body file per body x height, ears, tail or an
// animal hood from hero-parts.glb baked into the head and body, and gear from three kit files placed on the body parts
// with the height's FIT (looks.mjs), so every hat, outfit, boot and weapon fits every look.
//
//   buildAvatar(world, {look, outfitColor, gear}) -> THREE.Group
//     look          'body-height-ears-hood' (looks.mjs); default 'girl-tall-none-none'
//     outfitColor   the shirt colour (content.mjs OUTFITS); a worn gear.wear outfit covers most of it
//     gear          {hat, wear, boots, weapon, pet} ids from gear.mjs ('' or missing = none); a pet stands beside
//     userData.parts   {head, body, arm_l, arm_r, leg_l, leg_r, hand_l, hand_r}: the posable pivots (also findable by
//                      their names 'head', 'body', 'arm-left', 'arm-right', 'leg-left', 'leg-right', 'hand-right')
//     userData.limbs   [arm-left, arm-right, leg-left, leg-right] (World.animatePerson)
//     userData.pending true while a file this avatar wants is still loading (avatarAssets() resolves when it lands)
//   A worn weapon is the group named 'weapon' under 'hand-right' (guns carry a 'muzzle' marker).
//
// Cost: one mesh per posable part (six per person, where the raw files drew twenty-two), all with one shared toon
// material. Parts nobody recolours share the template's geometry; a part with shirt cloth shares the positions and
// normals and owns only its colours; a part that gear is merged into owns its geometry. Glowing gear (a halo, lava
// boots, a fire staff) adds one unlit mesh on its part. hero-tall and hero-girl-tall are loaded with the game (World);
// every other body file, hero-parts.glb, gear-wear.glb, gear-weapons.glb and pets.glb load the first time they are worn
// or tried on. Until a file lands the nearest loaded body stands in and the slot stays empty.
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon } from './toon.mjs';
import { OUTFITS } from './content.mjs';
import { BUILD, DEFAULT_LOOK, DEFAULT_PIVOTS, baseBody, bodyFile, fitOf, lookOf, splitLook, toLook } from './looks.mjs';
import { FLYING_PETS, GEAR, gearOf, kitOf } from './gear.mjs';

const PARTS = ['body', 'head', 'arm-left', 'arm-right', 'leg-left', 'leg-right'];
const KEYS = { body: 'body', head: 'head', 'arm-left': 'arm_l', 'arm-right': 'arm_r', 'leg-left': 'leg_l', 'leg-right': 'leg_r' };
/** Willowmere's people are slimmer than the reference's explorer (docs/DESIGN_PLAN.md): the whole rig, gear included. */
export const SLIM = .85;
/** The player's size in the world (NPCs use .79, children .57). */
export const PLAYER_SCALE = .88;
const SHADE = .72, ONE = { scale: [1, 1, 1], offset: [0, 0, 0] };
const LIT = toon({ vertexColors: true }); LIT.name = 'Avatar';
const GLOW = new T.MeshBasicMaterial({ vertexColors: true, toneMapped: false }); GLOW.name = 'Avatar glow';
const white = new T.Color('#ffffff'), tint = new T.Color(), m4 = new T.Matrix4(), m4b = new T.Matrix4();

// ---------------------------------------------------------------- files
let loadScene = async file => (await new GLTFLoader().loadAsync(`./assets/models/${file}.glb`)).scene;
const scenes = new Map(), loading = new Map(), failed = new Set();
/** Tests load the files from disk; this also forgets everything built from the old loader. */
export function useAvatarLoader(load) { loadScene = load; scenes.clear(); loading.clear(); failed.clear(); templates.clear(); kits.clear(); weapons.clear(); pets.clear(); }
/** The parsed file, if it has arrived (World's own hero files count). */
function ready(world, file) {
  if (scenes.has(file)) return scenes.get(file);
  const own = world?.raw?.get?.(file); if (own) { scenes.set(file, own); return own; }
  return null;
}
function request(world, file) {
  if (ready(world, file)) return null;
  if (failed.has(file)) return null; // a missing file is not asked for on every rebuild; the stand-in stays
  if (!loading.has(file)) loading.set(file, Promise.resolve().then(() => loadScene(file)).then(scene => { scenes.set(file, scene); }, () => { failed.add(file); }).finally(() => loading.delete(file)));
  return loading.get(file);
}
/** The files a look and its gear need. */
function filesFor(look, gear) {
  const l = splitLook(toLook(look) ?? DEFAULT_LOOK), files = [bodyFile(l.body, l.height)];
  if (l.ears !== 'none' || l.hood !== 'none') files.push('hero-parts');
  if (gear) for (const id of Object.values(gear)) { const kit = kitOf(id); if (kit && !files.includes(kit)) files.push(kit); }
  return files;
}
/**
 * Null when everything a look and its gear need has loaded; otherwise starts the downloads and returns a promise that
 * settles when they have landed (or failed: the stand-ins remain).
 */
export function avatarAssets(world, { look, gear } = {}) {
  const waits = filesFor(look, gear).map(f => request(world, f)).filter(Boolean);
  return waits.length ? Promise.all(waits).then(() => {}) : null;
}
export const preloadAvatar = (world, wanted) => avatarAssets(world, wanted) ?? Promise.resolve();

// ---------------------------------------------------------------- baking
/** One mesh as a non-indexed, vertex-coloured geometry moved by `matrix`; glowing materials are flagged. */
function bakeMesh(mesh, matrix) {
  const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  for (const key of Object.keys(g.attributes)) if (key !== 'position' && key !== 'normal') g.deleteAttribute(key);
  g.morphAttributes = {}; g.clearGroups();
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  g.applyMatrix4(matrix);
  const e = material?.emissive, strength = e ? (e.r + e.g + e.b) * (material.emissiveIntensity ?? 1) : 0, glow = strength >= 1.2;
  if (glow) tint.copy(e).lerp(material.color ?? e, .3).multiplyScalar(1.08);
  else { tint.copy(material?.color ?? white); if (strength > 0) { tint.r = Math.min(1, tint.r + e.r * .5); tint.g = Math.min(1, tint.g + e.g * .5); tint.b = Math.min(1, tint.b + e.b * .5); } }
  const n = g.getAttribute('position').count, colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { colors[i * 3] = tint.r; colors[i * 3 + 1] = tint.g; colors[i * 3 + 2] = tint.b; }
  g.setAttribute('color', new T.BufferAttribute(colors, 3));
  const name = material?.name ?? '';
  return { g, glow, shirt: /^Hero shirt shade/.test(name) ? SHADE : /^Hero shirt/.test(name) ? 1 : 0 };
}
const merged = list => { if (!list.length) return null; const g = list.length === 1 ? list[0] : mergeGeometries(list, false); if (list.length > 1) list.forEach(p => p.dispose()); return g; };
/** Every mesh under `root`, in `frame`'s space (default: `root`'s own) moved by `matrix`: {lit, glow} merged geometries (either may be null). */
function bakeTree(root, matrix, frame = root) {
  frame.updateMatrixWorld(true);
  const inverse = new T.Matrix4().copy(frame.matrixWorld).invert(), lit = [], glow = [];
  root.traverse(o => { if (!o.isMesh) return; const piece = bakeMesh(o, m4.multiplyMatrices(inverse, o.matrixWorld).premultiply(matrix)); (piece.glow ? glow : lit).push(piece.g); });
  return { lit: merged(lit), glow: merged(glow) };
}
/** T(offset) · S(scale) · T(−pivot): from the default hero's space into a part's (cute_game world.ts wearKit). */
function fitMatrix(tag, fit) {
  const p = DEFAULT_PIVOTS[tag] ?? [0, 0, 0], f = fit?.[tag] ?? ONE;
  return new T.Matrix4().makeTranslation(f.offset[0], f.offset[1], f.offset[2]).multiply(m4b.makeScale(f.scale[0], f.scale[1], f.scale[2])).multiply(new T.Matrix4().makeTranslation(-p[0], -p[1], -p[2]));
}
const keep = g => { if (g) { g.userData.avatarTemplate = true; g.computeBoundingSphere(); } return g; };

// ---------------------------------------------------------------- body templates (one per look)
const templates = new Map();
/**
 * A look's parts, built once: per part its pivot and one vertex-coloured geometry (the body with the tail, the head
 * with and without its ears or hood), and which vertices are shirt cloth. Null until its files have loaded.
 */
function template(world, look) {
  if (templates.has(look)) return templates.get(look);
  const l = splitLook(look), src = ready(world, bodyFile(l.body, l.height)); if (!src) return null;
  const dressed = l.ears !== 'none' || l.hood !== 'none', extras = dressed ? ready(world, 'hero-parts') : null; if (dressed && !extras) return null;
  src.updateMatrixWorld(true); const hero = src.getObjectByName('hero') ?? src;
  const toHero = new T.Matrix4().copy(hero.matrixWorld).invert(), build = BUILD[l.body], fit = fitOf(look);
  const t = { look, fit, parts: {}, hands: {} };
  for (const name of PARTS) {
    const node = hero.getObjectByName(name); if (!node) continue;
    const inverse = new T.Matrix4().copy(node.matrixWorld).invert(), list = [], shirt = [];
    // A build widens the part about its own pivot (cute_game assets.ts applyBuild).
    const widen = !build ? null : name === 'body' ? new T.Matrix4().makeScale(build.torso[0], 1, build.torso[1]) : name === 'head' ? null : new T.Matrix4().makeScale(build.limb, 1, build.limb);
    const meshes = [...(node.isMesh ? [node] : []), ...node.children.filter(c => c.isMesh && c.name !== 'head-leaf')];
    for (const mesh of meshes) {
      const matrix = new T.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld); if (widen) matrix.premultiply(widen);
      const piece = bakeMesh(mesh, matrix); list.push(piece.g);
      for (let i = 0, n = piece.g.getAttribute('position').count; i < n; i++) shirt.push(piece.shirt);
    }
    if (!list.length) continue;
    const position = new T.Vector3().setFromMatrixPosition(m4.multiplyMatrices(toHero, node.matrixWorld));
    if (build) position.x *= name.startsWith('arm') ? build.spread : name.startsWith('leg') ? build.hips : 1;
    const part = t.parts[name] = { position, geometry: merged(list), shirt: shirt.some(v => v > 0) ? Float32Array.from(shirt) : null };
    for (const child of node.children) if (/^hand-/.test(child.name)) t.hands[child.name] = child.position.clone();
    if (name === 'body' && extras && l.ears !== 'none') {
      const tail = extras.getObjectByName('tail-' + l.ears), extra = tail && bakeTree(tail, fitMatrix('body', fit), extras).lit; // modelled on the default hero, in the file's own space
      if (extra) part.geometry = merged([part.geometry, extra]);
    }
    if (name === 'head' && extras) {
      const piece = extras.getObjectByName(l.hood !== 'none' ? 'deco-' + l.hood : 'ears-' + l.ears), extra = piece && bakeTree(piece, fitMatrix('head', fit), extras).lit;
      if (extra) part.dressed = keep(mergeGeometries([part.geometry, extra], false)), extra.dispose(); // the bare head stays: a hat tucks the ears and the hood away
    }
    keep(part.geometry);
  }
  if (!t.parts.body || !t.parts.head) return null;
  templates.set(look, t); return t;
}
/** Loaded looks to stand in for one whose files are still on their way, nearest first. */
function standIns(look) {
  const l = splitLook(look), base = baseBody(l.body);
  return [`${l.body}-${l.height}-none-none`, `${base}-${l.height}-none-none`, `${l.body}-tall-none-none`, `${base}-tall-none-none`, 'girl-tall-none-none', 'boy-tall-none-none'];
}

// ---------------------------------------------------------------- gear kits
const kits = new Map(), weapons = new Map(), pets = new Map();
const partTag = (object, stop) => { for (let o = object; o && o !== stop; o = o.parent) { const at = o.name.indexOf('@'); if (at >= 0) return o.name.slice(at + 1).replace(/_\d+$/, ''); } return undefined; };
/** A kit file as name -> {pieces: [{tag, lit, glow}] (in the default hero's space), markers: [{name, position}]}. */
function kit(world, file) {
  if (kits.has(file)) return kits.get(file);
  const scene = ready(world, file); if (!scene) return null;
  scene.updateMatrixWorld(true);
  const models = new Map();
  for (const node of scene.children) {
    const inverse = new T.Matrix4().copy(node.matrixWorld).invert(), byTag = new Map(), markers = [];
    node.traverse(o => {
      if (o === node) return;
      if (!o.isMesh) { if (/^(muzzle|rod-tip)/.test(o.name)) markers.push({ name: o.name.replace(/_\d+$/, ''), position: new T.Vector3().setFromMatrixPosition(m4.multiplyMatrices(inverse, o.matrixWorld)) }); return; }
      const tag = partTag(o, node) ?? '', piece = bakeMesh(o, new T.Matrix4().multiplyMatrices(inverse, o.matrixWorld));
      if (!byTag.has(tag)) byTag.set(tag, { lit: [], glow: [] });
      byTag.get(tag)[piece.glow ? 'glow' : 'lit'].push(piece.g);
    });
    models.set(node.name, { node, pieces: [...byTag].map(([tag, p]) => ({ tag, lit: keep(merged(p.lit)), glow: keep(merged(p.glow)) })), markers });
  }
  kits.set(file, models); return models;
}
const kitModel = (world, id) => { const file = kitOf(id); return file ? kit(world, file)?.get(id) ?? null : null; };
const moved = (g, matrix) => { const copy = g.clone(); copy.applyMatrix4(matrix); return copy; };
/** A weapon in the hand's space: the same for every look (the hand takes no fit), so built once per weapon. */
function weaponParts(world, id) {
  if (weapons.has(id)) return weapons.get(id);
  const model = kitModel(world, id); if (!model) return null;
  const matrix = fitMatrix('hand-right', null), lit = [], glow = [];
  for (const p of model.pieces) { if (p.lit) lit.push(moved(p.lit, matrix)); if (p.glow) glow.push(moved(p.glow, matrix)); }
  const out = { lit: keep(merged(lit)), glow: keep(merged(glow)), markers: model.markers.map(m => ({ name: m.name, position: m.position.clone().applyMatrix4(matrix) })) };
  weapons.set(id, out); return out;
}
/** A pet's parts: the body (and its glow) as one geometry each, wings on their own pivots so they can flap. */
function petParts(world, id) {
  if (pets.has(id)) return pets.get(id);
  const model = kitModel(world, id); if (!model) return null;
  const node = model.node, inverse = new T.Matrix4().copy(node.matrixWorld).invert(), lit = [], glow = [], wings = [];
  for (const child of node.children) {
    if (/_wing_[lr]/.test(child.name)) { const baked = bakeTree(child, new T.Matrix4()); wings.push({ name: child.name, side: /_wing_l/.test(child.name) ? -1 : 1, position: child.position.clone(), rotation: child.rotation.clone(), lit: keep(baked.lit), glow: keep(baked.glow) }); continue; }
    child.traverse(o => { if (!o.isMesh) return; const piece = bakeMesh(o, new T.Matrix4().multiplyMatrices(inverse, o.matrixWorld)); (piece.glow ? glow : lit).push(piece.g); });
  }
  const out = { lit: keep(merged(lit)), glow: keep(merged(glow)), wings };
  pets.set(id, out); return out;
}
const mesh = (geometry, material, shadow = true) => { const m = new T.Mesh(geometry, material); m.castShadow = shadow; return m; };
/** A pet model (the companion that follows the player, or the one standing beside a portrait). Null until pets.glb has loaded. */
export function buildPet(world, id) {
  const parts = GEAR[id]?.slot === 'pet' ? petParts(world, id) : null; if (!parts) return null;
  const pet = new T.Group(); pet.name = 'pet'; pet.userData.pet = id; pet.userData.flying = FLYING_PETS.includes(id);
  if (parts.lit) pet.add(mesh(parts.lit, LIT)); if (parts.glow) pet.add(mesh(parts.glow, GLOW, false));
  pet.userData.wings = parts.wings.map(w => {
    const node = new T.Group(); node.name = w.name; node.position.copy(w.position); node.rotation.copy(w.rotation);
    if (w.lit) node.add(mesh(w.lit, LIT)); if (w.glow) node.add(mesh(w.glow, GLOW, false));
    pet.add(node); return { node, base: node.rotation.z, side: w.side };
  });
  return pet;
}

// ---------------------------------------------------------------- the avatar
function tintInto(colors, base, shirt, color) {
  for (let i = 0; i < shirt.length; i++) { const f = shirt[i]; if (f > 0) { colors[i * 3] = color.r * f; colors[i * 3 + 1] = color.g * f; colors[i * 3 + 2] = color.b * f; } else if (base) { colors[i * 3] = base[i * 3]; colors[i * 3 + 1] = base[i * 3 + 1]; colors[i * 3 + 2] = base[i * 3 + 2]; } }
}
/** One part's mesh: the template's geometry as it is, with its own colours (shirt cloth), or with gear merged in. */
function partMesh(base, shirt, color, extra) {
  let geometry = base, flag = null;
  if (extra.length) {
    const own = base.clone(); if (shirt) tintInto(own.getAttribute('color').array, null, shirt, color);
    geometry = mergeGeometries([own, ...extra], false); own.dispose(); extra.forEach(g => g.dispose()); flag = 'ownedGeometry';
  } else if (shirt) {
    geometry = new T.BufferGeometry(); geometry.setAttribute('position', base.getAttribute('position')); geometry.setAttribute('normal', base.getAttribute('normal'));
    const colors = new Float32Array(base.getAttribute('color').array); tintInto(colors, null, shirt, color);
    geometry.setAttribute('color', new T.BufferAttribute(colors, 3)); geometry.boundingSphere = base.boundingSphere; flag = 'avatarShared';
  }
  const m = mesh(geometry, LIT); if (flag) m.userData[flag] = true; if (shirt) Object.defineProperty(m.userData, 'shirt', { value: shirt, enumerable: false });
  return m;
}
/**
 * Builds a person: see the top of this file. Synchronous: it uses what has loaded (ask avatarAssets() first, or rebuild
 * when it resolves, to get what was missing).
 */
export function buildAvatar(world, { look = DEFAULT_LOOK, outfitColor = '#849978', gear = null } = {}) {
  const wanted = toLook(look) ?? DEFAULT_LOOK, root = new T.Group(), rig = new T.Group(), parts = {};
  root.name = 'avatar'; rig.name = 'hero'; rig.scale.set(SLIM, 1, SLIM); root.add(rig);
  let t = template(world, wanted), pending = !t;
  if (!t) for (const alt of standIns(wanted)) if ((t = template(world, alt))) break;
  root.userData = { avatar: true, lookId: t?.look ?? wanted, wanted, pending: false };
  // Not enumerable: Object3D.clone() copies userData through JSON, which would serialise every part's geometry.
  Object.defineProperty(root.userData, 'parts', { value: parts, enumerable: false });
  const color = new T.Color(outfitColor), worn = gear ?? {}, fit = t?.fit ?? {};
  const hat = GEAR[worn.hat]?.slot === 'hat' ? kitModel(world, worn.hat) : null;
  // Gear pieces per part, in the part's space (the height's FIT moves and scales each piece from the default hero's pivots).
  const lit = {}, glow = {};
  for (const [slot, fallback] of [['hat', 'head'], ['wear', 'body'], ['boots', 'body']]) {
    const id = worn[slot]; if (!id || GEAR[id]?.slot !== slot) continue;
    const model = kitModel(world, id); if (!model) { pending = true; continue; }
    for (const p of model.pieces) {
      const tag = PARTS.includes(p.tag) ? p.tag : fallback, matrix = fitMatrix(tag, fit);
      if (p.lit) (lit[tag] ??= []).push(moved(p.lit, matrix)); if (p.glow) (glow[tag] ??= []).push(moved(p.glow, matrix));
    }
  }
  for (const name of PARTS) {
    const node = new T.Group(); node.name = name; if (name.startsWith('arm')) node.rotation.order = 'YXZ';
    parts[KEYS[name]] = node; rig.add(node);
    const part = t?.parts[name]; if (!part) continue;
    node.position.copy(part.position);
    const base = name === 'head' && part.dressed && !hat ? part.dressed : part.geometry;
    node.add(partMesh(base, part.shirt, color, lit[name] ?? []));
    if (glow[name]) { const g = mergeGeometries(glow[name], false); glow[name].forEach(p => p.dispose()); const m = mesh(g, GLOW, false); m.userData.ownedGeometry = true; node.add(m); }
  }
  for (const side of ['left', 'right']) {
    const hand = new T.Object3D(); hand.name = 'hand-' + side; const at = t?.hands['hand-' + side]; if (at) hand.position.copy(at); else hand.position.set(0, -.4, .05);
    parts['arm_' + side[0]].add(hand); parts['hand_' + side[0]] = hand;
  }
  if (GEAR[worn.weapon]?.slot === 'weapon') {
    const w = weaponParts(world, worn.weapon);
    if (!w) pending = true; else {
      const group = new T.Group(); group.name = 'weapon'; group.userData.weapon = worn.weapon;
      if (w.lit) group.add(mesh(w.lit, LIT)); if (w.glow) group.add(mesh(w.glow, GLOW, false));
      for (const mk of w.markers) { const o = new T.Object3D(); o.name = mk.name; o.position.copy(mk.position); group.add(o); }
      parts.hand_r.add(group);
    }
  }
  if (GEAR[worn.pet]?.slot === 'pet') { const pet = buildPet(world, worn.pet); if (!pet) pending = true; else { pet.position.set(-.95, 0, .25); pet.rotation.y = .5; root.add(pet); } }
  Object.defineProperty(root.userData, 'limbs', { value: [parts.arm_l, parts.arm_r, parts.leg_l, parts.leg_r], enumerable: false });
  root.userData.pending = pending;
  return root;
}
/** Recolours the shirt cloth of an avatar (a try-on, Pip's new outfit). */
export function tintShirt(avatar, color) {
  const c = tint.set(color); // tint is not used by tintInto
  avatar?.traverse(o => {
    const shirt = o.isMesh ? o.userData.shirt : null; if (!shirt) return;
    const attribute = o.geometry.getAttribute('color'); tintInto(attribute.array, null, shirt, c); attribute.needsUpdate = true;
  });
}
/** Frees what an avatar owns: merged geometries, and the colours of parts that share the template's positions. */
export function disposeAvatar(avatar) {
  avatar?.traverse(o => {
    if (!o.isMesh) return;
    if (o.userData.ownedGeometry) o.geometry.dispose();
    else if (o.userData.avatarShared) { o.geometry.deleteAttribute('position'); o.geometry.deleteAttribute('normal'); o.geometry.dispose(); }
  });
}
/** A relaxed stance for portraits: arms a little out. */
export function restPose(avatar) { const p = avatar?.userData.parts; if (p) { p.arm_l.rotation.set(0, 0, -.16); p.arm_r.rotation.set(0, 0, .16); } return avatar; }

// ---------------------------------------------------------------- the player (world.mjs refreshPlayer) and the companion
/** What the player shows now: the saved look, shirt colour and gear, or what is being tried on (world.tryOn, never saved). */
export function playerWants(world) {
  const s = world.state, t = world.tryOn;
  return { look: t?.look ?? lookOf(s), gear: t?.gear ?? gearOf(s), outfitColor: t?.outfitColor ?? world.previewColor ?? OUTFITS.find(o => o.id === s.outfit)?.color ?? OUTFITS[0].color };
}
/** The player's avatar (the pet is the companion, not part of it). When a file is still loading, `onLoaded` runs once it lands. */
export function playerAvatar(world, onLoaded) {
  const wants = playerWants(world), avatar = buildAvatar(world, { ...wants, gear: { ...wants.gear, pet: '' } });
  avatar.userData.style = styleKey(wants);
  if (onLoaded) avatarAssets(world, wants)?.then(onLoaded);
  return avatar;
}
export const styleKey = wants => `${wants.look}|${wants.outfitColor}|${['hat', 'wear', 'boots', 'weapon', 'pet'].map(slot => wants.gear?.[slot] ?? '').join(',')}`;
const PET_BEHIND = 1.15, PET_SIDE = .95, PET_HOVER = 1.15;
/** Puts the worn pet (or the one tried on) into the world as world.companion; an empty group when there is none. */
export function syncCompanion(world) {
  const id = playerWants(world).gear.pet ?? '', old = world.companion;
  if (old && old.userData.pet === id) return old;
  const pet = (id && buildPet(world, id)) || new T.Group();
  pet.userData.pet = pet.userData.pet ?? ''; pet.userData.wanted = id; pet.scale.setScalar(PLAYER_SCALE);
  if (old) { pet.position.copy(old.position); pet.rotation.y = old.rotation.y; old.removeFromParent(); }
  else if (world.player) pet.position.copy(world.player.position);
  world.companion = pet; world.scene?.add(pet); return pet;
}
/** Per frame: the companion trails the player (a walker hops along, a flyer hovers and flaps). Allocation-free. */
export function updateCompanion(world, dt, time) {
  const pet = world.companion, player = world.player; if (!pet || !player) return;
  if (pet.userData.wanted && !pet.userData.pet) return; // its file is still loading
  const show = !!pet.userData.pet && !world.riding && player.visible; if (pet.visible !== show) pet.visible = show;
  if (!show) return;
  const yaw = player.rotation.y, sx = Math.sin(yaw), cx = Math.cos(yaw);
  const tx = player.position.x - sx * PET_BEHIND + cx * PET_SIDE, tz = player.position.z - cx * PET_BEHIND - sx * PET_SIDE;
  const dx = tx - pet.position.x, dz = tz - pet.position.z, d = Math.hypot(dx, dz), flying = pet.userData.flying;
  if (d > 30 || pet.userData.place !== world.location) { pet.userData.place = world.location; pet.position.x = tx; pet.position.z = tz; pet.rotation.y = yaw; }
  else if (d > .08) { const step = Math.min(d, dt * Math.min(flying ? 14 : 11, 2 + d * 4)); pet.position.x += dx / d * step; pet.position.z += dz / d * step; const want = Math.atan2(dx, dz); pet.rotation.y += Math.atan2(Math.sin(want - pet.rotation.y), Math.cos(want - pet.rotation.y)) * Math.min(1, dt * 10); }
  else pet.rotation.y += Math.atan2(Math.sin(yaw - pet.rotation.y), Math.cos(yaw - pet.rotation.y)) * Math.min(1, dt * 4);
  const moving = d > .25;
  pet.position.y = flying ? PET_HOVER + Math.sin(time * 2.6) * .12 : moving ? Math.abs(Math.sin(time * 11)) * .16 : Math.abs(Math.sin(time * 2.2)) * .02;
  const wings = pet.userData.wings; if (wings) for (let i = 0; i < wings.length; i++) { const w = wings[i]; w.node.rotation.z = w.base + w.side * (Math.sin(time * (flying ? 16 : 5)) * (flying ? .55 : .12) + (flying ? .15 : 0)); }
}
