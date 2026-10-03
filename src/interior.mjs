// Willowmere house interiors in the Zoo Garden cottage style (cute_game src/house.ts + house-view.ts): a dollhouse with
// five rooms in their own colours (bedroom, bathroom, kitchen, living room and Pip's corner), plank floors in two warm
// shades and checker tiles in the kitchen and bathroom, full-height side walls and partitions with a wainscot, skirting
// and trim, low cut-away walls on the camera side (the front wall and the middle row, with doorways), glowing windows,
// warm lamp light and soft light pools on the floor. The plan, the built-in furniture and the decorations come from
// home-plan.mjs; every household gets its own colours (PALETTES).
//
//   buildInteriorRoom(world, {houseId, state, HOUSES, RESIDENTS, KID_OUTFITS?})
//
// It replaces the body of World.buildInterior(): it clears world.inside (and the interior targets, colliders and
// labels), then builds the room into world.inside. Interactive targets keep their types and ids:
//   exit/door · bedroom/sleep · kitchen/cook · wardrobe/wardrobe · person/<resident id> · mirror/mirror (your home)
// plus fun/<thing> (the sofa, the bath, the duck…: target.activity names its house-rules.mjs ACTIVITIES entry; at home
// house-life.mjs runs it, elsewhere decor-view.mjs toasts its line). The residents are house-life.mjs's: they walk
// between the rooms, and their targets and labels follow them.
// Other modules add their own props with onInteriorBuild(fn), or after World.buildInterior() as before (the Pandora
// chest; home-plan.mjs PANDORA_SPOT keeps its place free of decorations).
// Each target's hit box also covers the furniture it stands for, so a click on the bed, the stove or the wardrobe uses
// it. Walkable bounds stay World.bounds {x:6.4,z:5.7}; the player spawns at (0,0,4). The view (perspective camera,
// label chips, hover glow) is room-view.mjs, installed here the first time a house is entered.
//
// Furniture comes from the already-loaded kit (world.assets, baked from house.glb), all at one scale (home-plan K);
// glowing parts (window light, lamp shades, fire) are rebuilt from world.raw so they stay bright. After placing, the
// opaque pieces, the glow parts and the floor light pools are merged into three meshes (ownedGeometry, disposed on the
// next rebuild). The room shell (floors, walls, two warm point lights) is cached per household (world.__interiorShells)
// and never disposed, so re-entering or a rebuild after a purchase, a new day or a decoration only re-places furniture.
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as content from './content.mjs';
import { K, ROOM, ROOMS, WALLS, SPOTS, roomAt, wallSpans, fixedPieces, decorLayout, defaultDecor, houseColliders, DECOR, SET_NAMES } from './home-plan.mjs';
import { installRoomView } from './room-view.mjs';
import { installHouseLife } from './house-life.mjs';
import { ACTIVITIES, activityForRole, activityForDecor } from './house-rules.mjs';

export { ROOM };

/** Per-household colours: wall colour per room, floors per room, wood trim. Your homestead wears the reference's. */
const pal = (bedroom, bath, kitchen, living, nook, livingFloor, bedroomFloor, nookFloor, kitchenTiles, bathTiles, trim) =>
  ({ walls: { bedroom, bath, kitchen, living, nook }, floors: { living: livingFloor, bedroom: bedroomFloor, nook: nookFloor, kitchen: kitchenTiles, bath: bathTiles }, trim });
export const PALETTES = [
  pal('#d3c6ff', '#9fe0ee', '#b8ead2', '#ffdcae', '#ffcadb', ['#d7965a', '#c9874d'], ['#c68456', '#b9774b'], ['#e8b37b', '#dca46b'], ['#fff3dc', '#f0b9a0'], ['#e4f6ff', '#a9dcf2'], '#a8683f'),
  pal('#ffd1de', '#bfe3ff', '#fff0b2', '#c9f0c0', '#ffe0c2', ['#e0a467', '#d39457'], ['#d39457', '#c58649'], ['#e9b074', '#dda466'], ['#ffffff', '#9fd8f0'], ['#ffffff', '#b8e4ff'], '#b0703f'),
  pal('#bfe3ff', '#b5f3ef', '#ffe39a', '#cfe0ff', '#ffd1de', ['#c98a55', '#b97a48'], ['#b97a48', '#ab6e3e'], ['#d39662', '#c58856'], ['#f6f6f6', '#ff9d7a'], ['#f2fbff', '#a0dcef'], '#8f5a35'),
  pal('#fff0b2', '#c9f0e4', '#ffd6a0', '#c6efb8', '#ffe4ef', ['#d99c5e', '#c98b50'], ['#c98b50', '#bb7e45'], ['#e3a96c', '#d59b5e'], ['#fffaf0', '#8fd36a'], ['#ffffff', '#bfe8d8'], '#9a6238'),
  pal('#b5f3ef', '#d6ecff', '#e1f6ff', '#a9e4f2', '#fff0b2', ['#c79a6b', '#b88a5c'], ['#b88a5c', '#aa7d50'], ['#d2a678', '#c4986a'], ['#ffffff', '#5cc6e0'], ['#ffffff', '#c4e6ff'], '#8a6040'),
  pal('#e5d4ff', '#bfe3ff', '#ffe4ef', '#ffcadb', '#fff0b2', ['#e8b37b', '#dca46b'], ['#dca46b', '#cf965d'], ['#f0bf88', '#e2b07a'], ['#fff7fb', '#ff94b3'], ['#ffffff', '#ffd1e3'], '#b07048'),
  pal('#ffe0c2', '#9fe0ee', '#ffcba8', '#fff1c9', '#d3c6ff', ['#d18a4c', '#c27b40'], ['#c27b40', '#b46f37'], ['#dc9758', '#ce894b'], ['#fff3dc', '#ff9656'], ['#e4f6ff', '#a9dcf2'], '#94552c'),
  pal('#d9ccff', '#b5f3ef', '#fff4cf', '#e2d8ff', '#ffdcae', ['#b9794a', '#ad6e40'], ['#ad6e40', '#a06338'], ['#c48555', '#b67849'], ['#f6f2ff', '#a996ff'], ['#ffffff', '#c0eeea'], '#7f4f2e'),
  pal('#ffd9d4', '#d6ecff', '#dff3ff', '#ffe4c4', '#c9f0c0', ['#d7965a', '#c98650'], ['#c98650', '#bb7946'], ['#e1a266', '#d39458'], ['#ffffff', '#ff8f86'], ['#ffffff', '#c8e4ff'], '#a0603a'),
  pal('#f4ffd8', '#bfe3ff', '#e4f6ff', '#fff2b8', '#ffd1de', ['#c68456', '#b9774b'], ['#b9774b', '#ab6b42'], ['#d29062', '#c48254'], ['#fffef4', '#bfe58f'], ['#ffffff', '#b8e4ff'], '#8c5a34'),
];

const BASE = '#6e4330', VOID = '#2a1d1a', EXTERIOR = '#e9c39a';
const color = new T.Color();
const vertexMaterial = new T.MeshStandardMaterial({ vertexColors: true, roughness: .86 });
const glowMaterial = new T.MeshBasicMaterial({ vertexColors: true, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });

/** A non-indexed box with one baked colour, ready to merge (cute_game house-view.ts slab()). */
function slab(w, h, d, x, y, z, hex) {
  const g = new T.BoxGeometry(w, h, d).toNonIndexed(); g.translate(x, y, z); g.deleteAttribute('uv');
  const c = color.set(hex), n = g.getAttribute('position').count, colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new T.BufferAttribute(colors, 3)); return g;
}
const shade = (hex, k) => '#' + color.set(hex).multiplyScalar(k).getHexString();
const mix = (a, b, t) => '#' + new T.Color(a).lerp(new T.Color(b), t).getHexString();

// ---------------------------------------------------------------- the room shell
/** Plank rows across z in staggered boards (reference: planks in two shades). */
function planks(pieces, r, shades, seed) {
  const rows = Math.max(1, Math.round((r.z1 - r.z0) / .5)), d = (r.z1 - r.z0) / rows, tones = [...shades, mix(shades[0], shades[1], .5)];
  for (let i = 0; i < rows; i++) {
    let x = r.x0, k = (i * 7 + seed) % 5;
    while (x < r.x1 - .01) {
      const len = Math.min(r.x1 - x, 1.5 + ((i * 13 + k * 5 + seed) % 7) * .32), z = r.z0 + (i + .5) * d;
      pieces.push(slab(len - .03, .08, d - .035, x + len / 2, -.04, z, tones[(i + k) % tones.length]));
      x += len; k++;
    }
    pieces.push(slab(r.x1 - r.x0, .07, d, (r.x0 + r.x1) / 2, -.05, r.z0 + (i + .5) * d, shade(shades[1], .7))); // seams
  }
}
function tiles(pieces, r, pair, size = .7) {
  const nx = Math.max(1, Math.round((r.x1 - r.x0) / size)), nz = Math.max(1, Math.round((r.z1 - r.z0) / size)), w = (r.x1 - r.x0) / nx, d = (r.z1 - r.z0) / nz;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) pieces.push(slab(w - .03, .08, d - .03, r.x0 + (i + .5) * w, -.04, r.z0 + (j + .5) * d, pair[(i + j) % 2]));
  pieces.push(slab(r.x1 - r.x0, .07, r.z1 - r.z0, (r.x0 + r.x1) / 2, -.05, (r.z0 + r.z1) / 2, shade(pair[1], .75)));
}
/** Builds (once per household) the shell: void, base slab, floors, walls, lights. */
function buildShell(houseId) {
  const p = PALETTES[houseId % PALETTES.length] ?? PALETTES[0], t = ROOM.thick, half = t / 2;
  const group = new T.Group(); group.name = `interior-shell-${houseId}`;
  const voidPlane = new T.Mesh(new T.PlaneGeometry(240, 240), new T.MeshBasicMaterial({ color: VOID })); voidPlane.rotation.x = -Math.PI / 2; voidPlane.position.y = -.62; group.add(voidPlane);
  const solid = [];
  solid.push(slab(ROOM.w + 1, .56, ROOM.d + 1, 0, -.36, 0, BASE));                     // the dark base seen at the cut edges
  solid.push(slab(ROOM.w + 1.04, .1, ROOM.d + 1.04, 0, -.11, 0, shade(p.trim, 1.08)));   // a lighter lip on top of it
  ROOMS.forEach((room, i) => room.pattern === 'tiles' ? tiles(solid, room.rect, p.floors[room.id], room.id === 'bath' ? .58 : .72) : planks(solid, room.rect, p.floors[room.id], houseId + i * 3));
  for (const wall of WALLS) {
    const full = wall.height === 'full', h = full ? ROOM.full : ROOM.low;
    for (const [a, b] of wallSpans(wall)) {
      const mid = (a + b) / 2, len = b - a;
      for (const side of [-1, 1]) {
        const probe = wall.axis === 'x' ? { x: mid, z: wall.at + side * .45 } : { x: wall.at + side * .45, z: mid }, room = roomAt(probe), hex = room ? p.walls[room.id] : EXTERIOR;
        const face = (fh, y, depth, c, off = 0) => solid.push(wall.axis === 'x' ? slab(len, fh, depth, mid, y, wall.at + side * (half / 2 + off), c) : slab(depth, fh, len, wall.at + side * (half / 2 + off), y, mid, c));
        face(h, h / 2, half, hex);
        if (!room) continue;
        if (full) { // a wainscot below a rail, like a papered cottage wall
          face(.95, .475, .03, shade(hex, .9), half / 2 + .015);
          face(.07, .97, .05, shade(p.trim, 1.25), half / 2 + .025);
        }
        face(.16, .08, .04, shade(hex, .72), half / 2 + .02); // skirting board
      }
      solid.push(wall.axis === 'x' ? slab(len + .04, .09, t + .08, mid, h + .045, wall.at, p.trim) : slab(t + .08, .09, len + .04, wall.at, h + .045, mid, p.trim));
    }
  }
  // Thresholds in the doorways.
  for (const wall of WALLS) for (const [a, b] of wall.gaps) solid.push(wall.axis === 'x' ? slab(b - a, .014, t + .06, (a + b) / 2, .007, wall.at, p.trim) : slab(t + .06, .014, b - a, wall.at, .007, (a + b) / 2, p.trim));
  const g = mergeGeometries(solid, false); solid.forEach(s => s.dispose());
  const shell = new T.Mesh(g, vertexMaterial); shell.name = 'interior-room'; shell.receiveShadow = true; group.add(shell);
  group.traverse(o => { if (o.isMesh) o.castShadow = false; });
  // Warm light: a lamp light over the living room and a softer fill over the back rooms (no shadows).
  const lamp = new T.PointLight('#ffc47a', 24, 16, 1.25); lamp.position.set(-1, 4.4, 2); group.add(lamp);
  const fill = new T.PointLight('#fff1c8', 16, 14, 1.3); fill.position.set(0, 3.6, -3.8); group.add(fill);
  group.userData.palette = p;
  return group;
}

// ---------------------------------------------------------------- glowing kit parts and light pools
/** The emissive parts of a kit node (window light, lamp shades, flames) as one unlit vertex-coloured geometry, in the
 * same local space as the baked asset world.assets.get(name). Cached per world. */
function glowFor(world, name) {
  const cache = world.__interiorGlow ??= new Map();
  if (cache.has(name)) return cache.get(name);
  let geometry = null;
  const node = world.raw?.get('house')?.getObjectByName(name);
  if (node) {
    const root = new T.Group(), copy = node.clone(true); copy.position.set(0, 0, 0); root.add(copy); root.updateMatrixWorld(true);
    const pieces = [];
    copy.traverse(m => {
      if (!m.isMesh || Array.isArray(m.material)) return;
      const e = m.material.emissive, strength = m.material.emissiveIntensity ?? 1;
      if (!e || e.r + e.g + e.b < .9 || strength <= 0) return;
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      for (const key of Object.keys(g.attributes)) if (key !== 'position' && key !== 'normal') g.deleteAttribute(key);
      g.applyMatrix4(m.matrixWorld);
      const c = e.clone().lerp(m.material.color ?? e, .3).multiplyScalar(1.08), n = g.getAttribute('position').count, colors = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
      g.setAttribute('color', new T.BufferAttribute(colors, 3)); pieces.push(g);
    });
    if (pieces.length) { geometry = mergeGeometries(pieces, false); pieces.forEach(p => p.dispose()); }
  }
  cache.set(name, geometry); return geometry;
}
function addGlow(world, object, name) {
  const g = glowFor(world, name); if (!g || !object) return;
  const m = new T.Mesh(g, glowMaterial); m.name = `${name}-glow`; m.castShadow = false; m.renderOrder = 1; object.add(m);
}
let poolMap = null;
const poolTexture = () => {
  if (poolMap) return poolMap;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,214,140,.55)'); r.addColorStop(.55, 'rgba(255,200,120,.2)'); r.addColorStop(1, 'rgba(255,190,110,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128); poolMap = new T.CanvasTexture(c); poolMap.colorSpace = T.SRGBColorSpace; return poolMap;
};
// One additive material for every light pool; each pool's strength is baked into its vertex colour, so all the pools of
// a room merge into a single draw (bakeStatics).
const poolMaterial = new T.MeshBasicMaterial({ map: null, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false });
/** A warm light pool on the floor (additive, no light cost): a flat quad whose vertex colour is its strength. */
function pool(parent, x, z, r, strength = 1) {
  if (!poolMaterial.map) poolMaterial.map = poolTexture();
  const g = new T.PlaneGeometry(r * 2, r * 1.8); g.rotateX(-Math.PI / 2); g.translate(x, .05, z); g.deleteAttribute('normal');
  const n = g.getAttribute('position').count; g.setAttribute('color', new T.BufferAttribute(new Float32Array(n * 3).fill(strength), 3));
  const m = new T.Mesh(g, poolMaterial); m.renderOrder = 2; m.userData.ownedGeometry = true; m.userData.pool = true; parent.add(m); return m;
}
/**
 * Merges what was just placed into a few draws, like the reference's one-batch interior (house-view.ts build()): every
 * opaque baked kit piece (they share World's vertex-colour material) into one mesh, every glowing part into one, every
 * light pool into one. Characters and target hit boxes stay separate.
 */
function bakeStatics(inside, placed) {
  inside.updateMatrixWorld(true);
  const inverse = new T.Matrix4().copy(inside.matrixWorld).invert(), local = new T.Matrix4();
  const solid = [], glow = [], pools = []; let solidMaterial = null;
  const take = (list, m) => { const g = m.geometry.clone(); g.applyMatrix4(local.multiplyMatrices(inverse, m.matrixWorld)); list.push(g); m.removeFromParent(); if (m.userData.ownedGeometry) m.geometry.dispose(); };
  for (const o of [...placed, ...inside.children.filter(c => c.userData.pool)]) {
    if (!o?.parent) continue;
    const meshes = []; o.traverse(m => { if (m.isMesh) meshes.push(m); });
    for (const m of meshes) {
      const mat = m.material;
      if (mat === glowMaterial) take(glow, m);
      else if (mat === poolMaterial) take(pools, m);
      else if (!Array.isArray(mat) && mat.vertexColors && !mat.transparent && m.geometry.getAttribute('color') && (solidMaterial ??= mat) === mat) take(solid, m);
    }
    let left = false; o.traverse(m => { if (m !== o && (m.isMesh || m.isSprite)) left = true; });
    if (!left && !o.isMesh) o.removeFromParent();
  }
  const add = (list, material, name, shadows) => {
    if (!list.length) return null;
    const g = mergeGeometries(list, false); list.forEach(p => p.dispose()); if (!g) return null;
    const m = new T.Mesh(g, material); m.name = name; m.userData.ownedGeometry = true; m.castShadow = m.receiveShadow = shadows; inside.add(m); return m;
  };
  add(solid, solidMaterial, 'interior-furniture', true);
  const lit = add(glow, glowMaterial, 'interior-glow', false); if (lit) lit.renderOrder = 1;
  const pl = add(pools, poolMaterial, 'interior-light-pools', false); if (pl) pl.renderOrder = 2;
}

// ---------------------------------------------------------------- placing kit pieces
const boundsCache = new Map();
function kitBounds(world, kit) {
  if (!boundsCache.has(kit)) { const src = world.assets.get(kit); boundsCache.set(kit, src ? new T.Box3().setFromObject(src) : null); }
  return boundsCache.get(kit);
}
/** Puts a plan piece (home-plan.mjs) into the room; returns the placed object. */
export function placePiece(world, parent, placed, p) {
  if (!world.assets?.has(p.kit)) return null;
  const scale = K * (p.s ?? 1);
  let y = p.y ?? 0;
  if (p.hang) { const b = kitBounds(world, p.kit); y = p.y - (b ? (b.min.y + b.max.y) / 2 : 0) * scale; }
  const o = world.asset(p.kit, parent, p.x, p.z, scale, y, p.rot ?? 0); placed?.push(o);
  if (p.glow) addGlow(world, o, p.kit);
  return o;
}
const boxOf = o => { const b = new T.Box3().setFromObject(o); return { x0: b.min.x, x1: b.max.x, y0: Math.max(0, b.min.y), y1: b.max.y, z0: b.min.z, z1: b.max.z }; };
const union = (a, b) => !a ? b : !b ? a : { x0: Math.min(a.x0, b.x0), x1: Math.max(a.x1, b.x1), y0: Math.min(a.y0, b.y0), y1: Math.max(a.y1, b.y1), z0: Math.min(a.z0, b.z0), z1: Math.max(a.z1, b.z1) };

/**
 * Clears the previous interior exactly like World.buildInterior used to: every child of world.inside leaves it and
 * every interior target, collider and label chip is dropped (whoever adds their own after a build, such as the Pandora
 * chest, adds them again after each build). Not disposed: the cached shells and anything flagged userData.persist (the
 * residents' avatars, which house-life.mjs owns and puts back).
 */
function clearInterior(world) {
  const shells = new Set(Object.values(world.__interiorShells ?? {}));
  for (const child of [...world.inside.children]) {
    if (!shells.has(child) && !child.userData.persist) child.traverse(o => { if (o.userData.ownedGeometry) o.geometry.dispose(); if (o.isSprite) { o.material.map?.dispose(); o.material.dispose(); } });
    world.inside.remove(child);
  }
  world.labels = world.labels.filter(l => l.parent);
  world.targets = world.targets.filter(t => t.location !== 'interior');
  world.colliders = world.colliders.filter(c => c.location !== 'interior');
  world.__roomHotspots = [];
}
const buildHooks = [];
/**
 * Adds a prop to every interior build. fn({world, houseId, home, state, inside, place, target, chip}) runs after the
 * furniture is placed and before it is merged: place(piece) puts a house-kit piece (home-plan.mjs P() shape) and
 * returns it; target(type, id, label, x, z, r) makes an interior target; chip(target, icon, text, box, lift) gives it a
 * label on the thing and a hit box fitted to `box` ({x0, x1, y0, y1, z0, z1}). Meshes you add to `inside` yourself are
 * removed on the next build (flag a mesh with userData.ownedGeometry to have its geometry disposed then).
 */
export function onInteriorBuild(fn) { if (!buildHooks.includes(fn)) buildHooks.push(fn); return () => { const i = buildHooks.indexOf(fn); if (i >= 0) buildHooks.splice(i, 1); }; }
/** Makes a target's (invisible) hit box cover the thing it stands for too, so a click on the furniture uses it. */
function fitHit(target, box, low = false) {
  if (!box || !target.hit) return;
  // `low`: a low thing in front of something else (the kettle's table before the sofa) keeps a low box, so taps on what is behind it still reach it.
  const r = target.r * 1.4, spot = { x0: target.x - .6, x1: target.x + .6, y0: 0, y1: low ? Math.max(.3, box.y1) : 2.2, z0: target.z - .6, z1: target.z + .6 }, b = union(spot, box);
  target.hit.position.set((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2);
  target.hit.scale.set((b.x1 - b.x0) / r, (b.y1 - b.y0) / 2.5, (b.z1 - b.z0) / r);
  target.hit.updateMatrixWorld(true);
}
/** Little things to use around the house, as [icon, name, verb, line] (house-rules.mjs ACTIVITIES; kept for older callers). */
const legacy = a => [a.icon, a.name, a.verb, a.line];
export const FUN = Object.fromEntries(Object.values(ACTIVITIES).filter(a => a.role).map(a => [a.role, legacy(a)]));
FUN.mirror = ['🪞', 'Mirror', 'Look in the mirror', 'Looking lovely today.'];
export const DECOR_FUN = Object.fromEntries(Object.values(ACTIVITIES).filter(a => a.decor).map(a => [a.decor, legacy(a)]));
/**
 * Where you stand to use a piece: in front of it (its +z turned by rot), clear of colliders; when something stands in
 * front (the coffee table before the sofa), beside it instead, so a tap on the piece always finds a way there.
 */
function standSpot(world, p, box) {
  const fx = Math.sin(p.rot ?? 0), fz = Math.cos(p.rot ?? 0), depth = box ? Math.abs(fx) * (box.x1 - box.x0) + Math.abs(fz) * (box.z1 - box.z0) : 1;
  const width = box ? Math.abs(fz) * (box.x1 - box.x0) + Math.abs(fx) * (box.z1 - box.z0) : 1;
  for (const extra of [.55, .8, 1.1, .35]) { const x = p.x + fx * (depth / 2 + extra), z = p.z + fz * (depth / 2 + extra); if (!world.blocked(x, z)) return { x, z }; }
  for (const extra of [.55, .8]) for (const side of [1, -1]) for (const forward of [0, .5]) {
    const x = p.x + fz * side * (width / 2 + extra) + fx * forward * depth, z = p.z - fx * side * (width / 2 + extra) + fz * forward * depth; if (!world.blocked(x, z)) return { x, z };
  }
  return { x: p.x + fx * (depth / 2 + .55), z: p.z + fz * (depth / 2 + .55) };
}

/**
 * Builds the inside of a house into world.inside.
 * @param {object} world the Willowmere World (needs inside, assets, raw, asset, collider, target, character, labels, targets, colliders)
 * @param {{houseId:number, state:object, HOUSES:object[], RESIDENTS:object[], KID_OUTFITS?:object[]}} options
 * @returns {{palette:object, targets:object[]}} the palette used and the interior targets created
 */
export function buildInteriorRoom(world, { houseId, state, RESIDENTS = content.RESIDENTS, KID_OUTFITS = content.KID_OUTFITS } = {}) {
  clearInterior(world);
  const view = installRoomView(world);
  if (world.location === 'interior') view.swapIn();
  const id = Number(houseId) || 0, home = id === 0, s = state ?? world.state;
  const residents = RESIDENTS.filter(p => p.home === id), hasChild = home || residents.some(p => p.child);
  const life = installHouseLife(world);
  const shells = world.__interiorShells ??= {};
  const shell = shells[id] ??= buildShell(id);
  world.inside.add(shell);
  const inside = world.inside, placed = [], hotspots = [], roles = {};
  const moving = home && Number.isInteger(world.__decorMoving) ? world.__decorMoving : -1;

  // Colliders first (walls, built-in furniture, decorations), so stand spots can avoid them.
  const colliders = houseColliders(id, s, { skip: moving, hasChild });
  for (const c of colliders) world.collider(c.x, c.z, c.w, c.d, 'interior');

  // Built-in furniture of this household.
  for (const p of fixedPieces(id, s, { hasChild })) {
    const o = placePiece(world, inside, placed, p); if (!o || !p.role) continue;
    (roles[p.role] ??= []).push({ p, box: boxOf(o) });
  }
  // Decorations: your own arrangement at home; other households show their whole furniture.
  const layout = home ? decorLayout(s) : defaultDecor({ furniture: Object.keys(SET_NAMES) }), decorFun = [];
  world.__decorBoxes = [];
  layout.forEach((d, i) => {
    const piece = DECOR[d.id]; if (!piece || i === moving) { world.__decorBoxes.push(null); return; }
    const o = placePiece(world, inside, placed, { kit: piece.kit, x: d.x, z: d.z, rot: d.rot, s: piece.s ?? 1, glow: piece.glow, y: piece.flat ? .012 + (i % 4) * .004 : 0 });
    const box = o ? boxOf(o) : null; world.__decorBoxes.push(box);
    if (piece.kit === 'floor_lamp') pool(inside, d.x, d.z + .3, 1.5, .9);
    if (box && activityForDecor(d.id)) decorFun.push({ d, i, box });
  });

  // Light pools under the windows, lamps and fire.
  pool(inside, -2.75, -4.7, 1.9, .7); pool(inside, .12, -4.4, 1.6, .55); pool(inside, 5.9, -3.55, 1.7, .6); pool(inside, -5.8, .55, 1.8, .55); pool(inside, 5.9, 4.65, 1.6, .55);
  pool(inside, -5.6, -4.9, 1.1, .8); pool(inside, -1.2, 1.8, 3.6, .5);
  if (roles.fireplace) pool(inside, -5.2, 3.3, 1.7, 1);

  const chip = (target, ic, text, box, lift = false, low = false) => { hotspots.push({ target, icon: ic, text, box, lift }); fitHit(target, box, low); return target; };
  const all = role => (roles[role] ?? []).reduce((b, r) => union(b, r.box), null);
  chip(spot(world, 'bedroom', 'sleep', home ? 'Rest & begin a new day' : 'Visit the family bedroom', SPOTS.bedroom), '🛏️', home ? 'Bed' : 'Bedroom', all('bed'));
  chip(spot(world, 'kitchen', 'cook', 'Cook a family recipe', SPOTS.kitchen), '🍳', 'Kitchen', all('kitchen'));
  chip(spot(world, 'wardrobe', 'wardrobe', home ? 'Open your wardrobe' : 'A neighbour’s wardrobe', SPOTS.wardrobe), '👗', 'Wardrobe', all('wardrobe'));
  chip(spot(world, 'exit', 'door', 'Step outside', SPOTS.exit), '🚪', 'Outside', all('door'));
  // The mirror: the character builder at home (mirror-view.mjs), a kind word elsewhere.
  if (roles.mirror) {
    const r = roles.mirror[0], at = standSpot(world, r.p, r.box);
    const t = home ? world.target('mirror', 'mirror', 'Look in the mirror', at.x, at.z, 1.25, inside) : world.target('fun', 'mirror', FUN.mirror[2], at.x, at.z, 1.25, inside);
    if (!home) { t.line = FUN.mirror[3]; t.icon = FUN.mirror[0]; }
    chip(t, FUN.mirror[0], 'Mirror', r.box);
  }
  // The little things to use (fun/<role>): house-rules.mjs says what each does.
  for (const role of ['sofa', 'tea', 'bath', 'duck', 'sink', 'fireplace', 'desk', 'kidbed']) {
    const r = roles[role]?.[0], a = activityForRole(role); if (!r || !a) continue;
    // The kettle stands on the coffee table: a tap on either pours a cup. You stand at the table's right front corner,
    // with a small reach, so the prompt never mixes it up with the sofa's spot (behind it).
    const table = role === 'tea' ? all('teatable') : null, box = union(r.box, table), corner = table && { x: table.x1 + .6, z: table.z1 - .1 };
    const at = corner && !world.blocked(corner.x, corner.z) ? corner : standSpot(world, table ? { x: (table.x0 + table.x1) / 2, z: (table.z0 + table.z1) / 2, rot: 0 } : r.p, table ?? r.box), name = role === 'kidbed' && home ? 'Pip’s bed' : a.name;
    const t = world.target('fun', role, a.verb, at.x, at.z, role === 'duck' ? .9 : role === 'tea' ? .8 : 1.25, inside); t.line = a.line; t.icon = a.icon; t.activity = a.id;
    chip(t, a.icon, name, box, role === 'duck', role === 'tea');
  }
  // Placed decorations you can use: the bookshelf, the globe, the easel… (never in reach of the front door's spot).
  for (const { d, i, box } of decorFun) {
    const a = activityForDecor(d.id), at = standSpot(world, { x: d.x, z: d.z, rot: d.rot }, box);
    if (Math.hypot(at.x - SPOTS.exit.x, at.z - SPOTS.exit.z) < 2.2) continue;
    const t = world.target('fun', `${d.id}-${i}`, a.verb, at.x, at.z, 1.0, inside); t.line = a.line; t.icon = a.icon; t.activity = a.id;
    chip(t, a.icon, a.name, box);
  }
  // The household's residents: house-life.mjs keeps them walking between the rooms.
  const kid = s.kidOutfit ? KID_OUTFITS.find(k => k.id === s.kidOutfit)?.color : null;
  life.sync({ houseId: id, residents, state: s, colliders, hotspots, kidColor: kid });
  // Props from other modules.
  if (buildHooks.length) {
    const api = { world, houseId: id, home, state: s, inside, place: p => placePiece(world, inside, placed, p), target: (type, tid, label, x, z, r = 1.25) => world.target(type, tid, label, x, z, r, inside), chip };
    for (const fn of buildHooks) { try { fn(api); } catch (error) { console.error(error); } }
  }
  bakeStatics(inside, placed);
  world.__roomHotspots = hotspots;
  return { palette: shell.userData.palette, targets: world.targets.filter(t => t.location === 'interior') };
}
function spot(world, type, id, text, at) { return world.target(type, id, text, at.x, at.z, at.r, world.inside); }
