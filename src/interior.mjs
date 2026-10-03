// Willowmere house interiors in the Zoo Garden dollhouse style (cute_game src/house.ts + house-view.ts):
// a dark base slab, plank floors in two warm shades, checker tiles in the kitchen corner, papered
// walls with a wainscot, rail and skirting on the two walls the camera faces (back and left), low
// cut-away walls on the camera side (front and right) with capped tops, one short partition between
// the bedroom and the kitchen, yellow-lit windows, warm lamp light and soft light pools on the floor.
// Every household gets its own wallpaper, floor and tile colours (PALETTES).
//
//   buildInteriorRoom(world, {houseId, state, HOUSES, RESIDENTS, KID_OUTFITS?})
//
// It replaces the body of World.buildInterior(): it clears world.inside (and the interior targets,
// colliders and labels) exactly like the old code, then builds the room into world.inside. Interactive
// targets keep the old types, ids, labels, positions and radii:
//   exit/door (0,5.2) · bedroom/sleep (-3,-1) · kitchen/cook (3.5,-2.5) · wardrobe/wardrobe (-4.2,2.5)
//   person/<resident id> (-1+i*1.7, 2.7)
// The room spans x -7..7, z -6..6 (walkable bounds stay World.bounds {x:6.4,z:5.7}); the player
// spawns at (0,0,4) and the camera scale indoors stays 10.
//
// Furniture comes from the already-loaded kit (world.assets, baked from house.glb) and is placed with
// world.sized / world.mounted; glowing parts of the kit (window light, lamp shades, fire) are rebuilt from
// world.raw so they stay bright. After placing, the opaque pieces, the glow parts and the floor light pools
// are merged into three meshes (about 55 fewer draws than one mesh per piece), flagged ownedGeometry so the
// next rebuild disposes them. Label chips over the bed, kitchen, wardrobe and door are sprites in
// world.labels. The room shell (floors, papered walls, partition, two warm point lights) is cached per
// household on the world (world.__interiorShells) and never disposed, so re-entering or a rebuild after a
// purchase or a new day only re-places furniture. HOUSES is accepted for symmetry; looks are keyed by houseId.
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as content from './content.mjs';

/** Room size (x -W/2..W/2, z -D/2..D/2), wall heights and the zone lines. */
export const ROOM = { w: 14, d: 12, wall: 3.6, low: .55, thick: .25, split: .8, backRow: -2.6 };

// Per-household look: wallpaper colour + pattern for the bedroom (back-left), kitchen (back-right) and
// living room (left wall), plank shades, kitchen tiles and the wood trim. Vivid and warm, never grey.
export const PALETTES = [
 {bed:['#d9cbff','dots'],kitchen:['#b8ead2','stripes'],living:['#ffdcae','flowers'],planks:['#d7965a','#c9874d','#e0a266'],bedPlanks:['#c68456','#b9774b','#d08d5c'],tiles:['#fff3dc','#f0b9a0'],trim:'#a8683f',wainscot:'#f4a65e'},
 {bed:['#ffd1de','flowers'],kitchen:['#fff0b2','stripes'],living:['#c9f0c0','dots'],planks:['#e0a467','#d39457','#e9b074'],bedPlanks:['#d39457','#c58649','#dd9f63'],tiles:['#ffffff','#9fd8f0'],trim:'#b0703f',wainscot:'#7fc8a0'},
 {bed:['#bfe3ff','diamonds'],kitchen:['#ffe39a','stripes'],living:['#cfe0ff','stripes'],planks:['#c98a55','#b97a48','#d39662'],bedPlanks:['#b97a48','#ab6e3e','#c48553'],tiles:['#f6f6f6','#ff9d7a'],trim:'#8f5a35',wainscot:'#5f9ee6'},
 {bed:['#fff0b2','flowers'],kitchen:['#ffd6a0','dots'],living:['#c6efb8','stripes'],planks:['#d99c5e','#c98b50','#e3a96c'],bedPlanks:['#c98b50','#bb7e45','#d4975b'],tiles:['#fffaf0','#8fd36a'],trim:'#9a6238',wainscot:'#6cbf55'},
 {bed:['#b5f3ef','dots'],kitchen:['#e1f6ff','diamonds'],living:['#a9e4f2','stripes'],planks:['#c79a6b','#b88a5c','#d2a678'],bedPlanks:['#b88a5c','#aa7d50','#c39567'],tiles:['#ffffff','#5cc6e0'],trim:'#8a6040',wainscot:'#3fb3c8'},
 {bed:['#e5d4ff','flowers'],kitchen:['#ffe4ef','dots'],living:['#ffcadb','stripes'],planks:['#e8b37b','#dca46b','#f0bf88'],bedPlanks:['#dca46b','#cf965d','#e5b077'],tiles:['#fff7fb','#ff94b3'],trim:'#b07048',wainscot:'#ff8fb8'},
 {bed:['#ffe0c2','dots'],kitchen:['#ffcba8','diamonds'],living:['#fff1c9','flowers'],planks:['#d18a4c','#c27b40','#dc9758'],bedPlanks:['#c27b40','#b46f37','#cd874b'],tiles:['#fff3dc','#ff9656'],trim:'#94552c',wainscot:'#ff9a4a'},
 {bed:['#d9ccff','stripes'],kitchen:['#fff4cf','dots'],living:['#e2d8ff','diamonds'],planks:['#b9794a','#ad6e40','#c48555'],bedPlanks:['#ad6e40','#a06338','#b8794b'],tiles:['#f6f2ff','#a996ff'],trim:'#7f4f2e',wainscot:'#9b7bff'},
 {bed:['#ffd9d4','flowers'],kitchen:['#dff3ff','stripes'],living:['#ffe4c4','dots'],planks:['#d7965a','#c98650','#e1a266'],bedPlanks:['#c98650','#bb7946','#d4925c'],tiles:['#ffffff','#ff8f86'],trim:'#a0603a',wainscot:'#ef6b5e'},
 {bed:['#f4ffd8','dots'],kitchen:['#e4f6ff','diamonds'],living:['#fff2b8','stripes'],planks:['#c68456','#b9774b','#d29062'],bedPlanks:['#b9774b','#ab6b42','#c48256'],tiles:['#fffef4','#bfe58f'],trim:'#8c5a34',wainscot:'#e8b93a'},
];
/** One signature piece per household (house.glb names), so homes differ in what is in them too. */
const SIGNATURE = {1:['yarn_basket',1.1],2:['workbench',2.2],3:['plant_big',1.9],4:['globe',1.2],5:['easel',2.3],6:['round_table',1.5],7:['workbench',2.2],8:['bookshelf',2.2],9:['plant_big',1.9]};

const BASE = '#6e4330', VOID = '#2a1d1a';
const Q = Math.PI / 2;
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
function mergedMesh(pieces, material) {
  const g = mergeGeometries(pieces, false); pieces.forEach(p => p.dispose());
  const m = new T.Mesh(g, material); m.receiveShadow = true; return m;
}

// ---------------------------------------------------------------- textures (cached for the session)
const textures = new Map();
function canvasTexture(key, size, draw, repeat = true) {
  if (textures.has(key)) return textures.get(key);
  const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = T.RepeatWrapping;
  textures.set(key, t); return t;
}
/** Wallpaper tile: a base colour and a tone-on-tone pattern (stripes, dots, flowers or diamonds). */
function wallpaper(hex, pattern) {
  return canvasTexture(`paper:${hex}:${pattern}`, 128, (g, s) => {
    g.fillStyle = hex; g.fillRect(0, 0, s, s);
    const ink = mix(hex, '#ffffff', .45), deep = shade(hex, .9);
    if (pattern === 'stripes') { g.fillStyle = deep; g.fillRect(0, 0, 22, s); g.fillRect(64, 0, 22, s); g.fillStyle = ink; g.fillRect(28, 0, 6, s); g.fillRect(92, 0, 6, s); }
    else if (pattern === 'dots') { g.fillStyle = ink; for (const [x, y] of [[32, 32], [96, 96], [96, 32], [32, 96]]) { g.beginPath(); g.arc(x, y, (x + y) % 128 ? 9 : 12, 0, 7); g.fill(); } }
    else if (pattern === 'diamonds') { g.fillStyle = deep; for (const [x, y] of [[64, 0], [0, 64], [128, 64], [64, 128]]) { g.beginPath(); g.moveTo(x, y - 30); g.lineTo(x + 30, y); g.lineTo(x, y + 30); g.lineTo(x - 30, y); g.fill(); } g.fillStyle = ink; g.beginPath(); g.arc(64, 64, 7, 0, 7); g.fill(); }
    else { // flowers: five round petals and a sunny centre, twice per tile
      for (const [x, y, r] of [[34, 36, 9], [96, 98, 8]]) {
        g.fillStyle = ink; for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; g.beginPath(); g.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * .72, 0, 7); g.fill(); }
        g.fillStyle = '#ffd25a'; g.beginPath(); g.arc(x, y, r * .55, 0, 7); g.fill();
      }
      g.fillStyle = deep; for (const [x, y] of [[96, 30], [30, 98]]) { g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
    }
  });
}
/** A soft round light pool, drawn additively on the floor under lamps and in front of windows. */
const poolTexture = () => canvasTexture('pool', 128, (g, s) => {
  const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  r.addColorStop(0, 'rgba(255,214,140,.55)'); r.addColorStop(.55, 'rgba(255,200,120,.2)'); r.addColorStop(1, 'rgba(255,190,110,0)');
  g.fillStyle = r; g.fillRect(0, 0, s, s);
}, false);

const materials = new Map();
function paperMaterial(hex, pattern, repeatX, repeatY) {
  const key = `${hex}:${pattern}:${repeatX.toFixed(2)}:${repeatY.toFixed(2)}`;
  if (!materials.has(key)) {
    const map = wallpaper(hex, pattern).clone(); map.needsUpdate = true; map.repeat.set(repeatX, repeatY);
    materials.set(key, new T.MeshStandardMaterial({ map, roughness: .92 }));
  }
  return materials.get(key);
}
// One additive material for every light pool; each pool's strength is baked into its vertex colour, so all the
// pools of a room merge into a single draw (bakeStatics).
const poolMaterial = new T.MeshBasicMaterial({ map: null, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false });
const voidMaterial = new T.MeshBasicMaterial({ color: VOID });

// ---------------------------------------------------------------- the room shell
/** A papered wall face: wallpaper above a wainscot, a rail between and a skirting board below. */
function paperedWall(group, pieces, { axis, at, from, to, height, hex, pattern, pal, inward }) {
  const len = to - from, mid = (from + to) / 2, t = ROOM.thick, dado = 1.05;
  // Wallpaper only on the room side; the slab behind it is plain trim colour.
  const upper = height - dado, geo = axis === 'x' ? new T.BoxGeometry(len, upper, .04) : new T.BoxGeometry(.04, upper, len);
  const mesh = new T.Mesh(geo, paperMaterial(hex, pattern, len / 1.6, upper / 1.6));
  mesh.position.set(axis === 'x' ? mid : at + inward * (t / 2 + .02), dado + upper / 2, axis === 'x' ? at + inward * (t / 2 + .02) : mid);
  mesh.receiveShadow = true; group.add(mesh);
  const face = (h, y, depth, c) => pieces.push(axis === 'x' ? slab(len, h, depth, mid, y, at + inward * (t / 2 + depth / 2), c) : slab(depth, h, len, at + inward * (t / 2 + depth / 2), y, mid, c));
  pieces.push(axis === 'x' ? slab(len, height, t, mid, height / 2, at, shade(hex, .82)) : slab(t, height, len, at, height / 2, mid, shade(hex, .82)));
  face(dado, dado / 2, .05, pal.wainscot);
  for (let s = from + .45; s < to - .2; s += .9) // wainscot panel grooves
    pieces.push(axis === 'x' ? slab(.05, dado - .3, .02, s, dado / 2 + .05, at + inward * (t / 2 + .06), shade(pal.wainscot, .86)) : slab(.02, dado - .3, .05, at + inward * (t / 2 + .06), dado / 2 + .05, s, shade(pal.wainscot, .86)));
  face(.12, dado, .1, pal.trim);              // dado rail
  face(.2, .1, .08, shade(pal.trim, .8));     // skirting
  // Top cap.
  pieces.push(axis === 'x' ? slab(len + .06, .1, t + .1, mid, height + .05, at, pal.trim) : slab(t + .1, .1, len + .06, at, height + .05, mid, pal.trim));
}
/** A low cut-away wall (front and right): the camera sees over it, like the reference's front wall. */
function lowWall(pieces, { axis, at, from, to, gaps = [], pal, hex }) {
  const spans = []; let p = from;
  for (const [a, b] of gaps) { if (a > p) spans.push([p, a]); p = b; } if (p < to) spans.push([p, to]);
  for (const [a, b] of spans) {
    const len = b - a, mid = (a + b) / 2, h = ROOM.low, t = ROOM.thick;
    pieces.push(axis === 'x' ? slab(len, h, t, mid, h / 2, at, hex) : slab(t, h, len, at, h / 2, mid, hex));
    pieces.push(axis === 'x' ? slab(len + .04, .09, t + .1, mid, h + .045, at, pal.trim) : slab(t + .1, .09, len + .04, at, h + .045, mid, pal.trim));
    pieces.push(axis === 'x' ? slab(len, .16, .04, mid, .08, at - .15, shade(pal.trim, .8)) : slab(.04, .16, len, at - .15, .08, mid, shade(pal.trim, .8)));
  }
}
/** Plank rows across z in staggered boards of three shades (reference: planks in two shades). */
function planks(pieces, x0, x1, z0, z1, shades, seed) {
  const rowD = .5, rows = Math.round((z1 - z0) / rowD), d = (z1 - z0) / rows;
  for (let r = 0; r < rows; r++) {
    let x = x0, k = (r * 7 + seed) % 5;
    while (x < x1 - .01) {
      const len = Math.min(x1 - x, 1.6 + ((r * 13 + k * 5 + seed) % 7) * .35), z = z0 + (r + .5) * d;
      pieces.push(slab(len - .03, .08, d - .035, x + len / 2, -.04, z, shades[(r + k) % shades.length]));
      x += len; k++;
    }
    pieces.push(slab(x1 - x0, .07, d, (x0 + x1) / 2, -.05, z0 + (r + .5) * d, shade(shades[1], .7))); // seam shadow under the boards
  }
}
function tiles(pieces, x0, x1, z0, z1, pair) {
  const nx = Math.round((x1 - x0) / .8), nz = Math.round((z1 - z0) / .8), w = (x1 - x0) / nx, d = (z1 - z0) / nz;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) pieces.push(slab(w - .03, .08, d - .03, x0 + (i + .5) * w, -.04, z0 + (j + .5) * d, pair[(i + j) % 2]));
  pieces.push(slab(x1 - x0, .07, z1 - z0, (x0 + x1) / 2, -.05, (z0 + z1) / 2, shade(pair[1], .75)));
}

/** Builds (once per household) the shell: void, base slab, floors, walls, partition, light. */
function buildShell(houseId) {
  const pal = PALETTES[houseId % PALETTES.length] ?? PALETTES[0], W = ROOM.w / 2, D = ROOM.d / 2, t = ROOM.thick, split = ROOM.split, row = ROOM.backRow;
  const group = new T.Group(); group.name = `interior-shell-${houseId}`;
  const voidPlane = new T.Mesh(new T.PlaneGeometry(220, 220), voidMaterial); voidPlane.rotation.x = -Math.PI / 2; voidPlane.position.y = -.62; group.add(voidPlane);
  const solid = [];
  solid.push(slab(ROOM.w + .9, .5, ROOM.d + .9, 0, -.33, 0, BASE));                 // the dark base slab seen at the cut edges
  planks(solid, -W, W, row, D, pal.planks, houseId);                                  // living room
  planks(solid, -W, split, -D, row, pal.bedPlanks, houseId + 3);                      // bedroom
  tiles(solid, split, W, -D, row, pal.tiles);                                         // kitchen corner
  solid.push(slab(.08, .012, -row - D + .1, split, .006, (row - D) / 2, pal.trim));   // threshold strips
  solid.push(slab(ROOM.w, .012, .08, 0, .006, row, pal.trim));
  // Back wall: bedroom paper on the left of the partition, kitchen paper on the right; left wall: living paper,
  // with the bedroom paper behind the bed corner.
  paperedWall(group, solid, { axis: 'x', at: -D - t / 2, from: -W - t, to: split, height: ROOM.wall, hex: pal.bed[0], pattern: pal.bed[1], pal, inward: 1 });
  paperedWall(group, solid, { axis: 'x', at: -D - t / 2, from: split, to: W + t, height: ROOM.wall, hex: pal.kitchen[0], pattern: pal.kitchen[1], pal, inward: 1 });
  paperedWall(group, solid, { axis: 'z', at: -W - t / 2, from: -D, to: row, height: ROOM.wall, hex: pal.bed[0], pattern: pal.bed[1], pal, inward: 1 });
  paperedWall(group, solid, { axis: 'z', at: -W - t / 2, from: row, to: D + t, height: ROOM.wall, hex: pal.living[0], pattern: pal.living[1], pal, inward: 1 });
  // The partition between bedroom and kitchen (papered on both faces), and two stub walls marking the back rooms.
  const pd = 2.5, ph = ROOM.wall - .2;
  solid.push(slab(t * .8, ph, pd, split, ph / 2, -D + pd / 2, pal.trim));
  for (const [side, paper] of [[-1, pal.bed], [1, pal.kitchen]]) {
    const m = new T.Mesh(new T.BoxGeometry(.03, ph - 1.05, pd), paperMaterial(paper[0], paper[1], pd / 1.6, (ph - 1.05) / 1.6));
    m.position.set(split + side * (t * .4 + .015), 1.05 + (ph - 1.05) / 2, -D + pd / 2); group.add(m);
    solid.push(slab(.05, 1.05, pd, split + side * (t * .4 + .025), .525, -D + pd / 2, pal.wainscot));
    solid.push(slab(.1, .12, pd, split + side * (t * .4 + .05), 1.05, -D + pd / 2, pal.trim));
  }
  solid.push(slab(t, .1, pd + .06, split, ph + .05, -D + pd / 2, pal.trim));
  lowWall(solid, { axis: 'x', at: row, from: -W, to: -W + 1.3, pal, hex: pal.living[0] });
  lowWall(solid, { axis: 'x', at: row, from: W - 1.1, to: W, pal, hex: pal.kitchen[0] });
  // Cut-away walls on the camera side, with the doorway in the front one.
  lowWall(solid, { axis: 'x', at: D + t / 2, from: -W - t, to: W + t, gaps: [[-1.15, 1.15]], pal, hex: pal.living[0] });
  lowWall(solid, { axis: 'z', at: W + t / 2, from: -D - t, to: D, pal, hex: pal.kitchen[0] });
  const shell = mergedMesh(solid, vertexMaterial); shell.name = 'interior-room'; group.add(shell);
  // Walls do not throw the outdoor sun's shadow across the room.
  group.traverse(o => { if (o.isMesh) o.castShadow = false; });
  // Warm light: one lamp light over the living room and a cooler fill from the windows (no shadows).
  const lamp = new T.PointLight('#ffc47a', 26, 17, 1.25); lamp.position.set(.4, 4.6, 1.2); group.add(lamp);
  const fill = new T.PointLight('#fff1c8', 14, 12, 1.4); fill.position.set(-1, 3.2, -3.8); group.add(fill);
  group.userData.palette = pal;
  return group;
}

// ---------------------------------------------------------------- glowing kit parts
/** The emissive parts of a kit node (window light, lamp shades, flames) as one unlit vertex-coloured mesh,
 * in the same local space as the baked asset world.assets.get(name). Cached per world. */
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
/** A warm light pool on the floor (additive, no light cost): a flat quad whose vertex colour is its strength. */
function pool(parent, x, z, r, strength = 1) {
  if (!poolMaterial.map) poolMaterial.map = poolTexture();
  const g = new T.PlaneGeometry(r * 2, r * 1.8); g.rotateX(-Math.PI / 2); g.translate(x, .045, z); g.deleteAttribute('normal');
  const n = g.getAttribute('position').count; g.setAttribute('color', new T.BufferAttribute(new Float32Array(n * 3).fill(strength), 3));
  const m = new T.Mesh(g, poolMaterial); m.renderOrder = 2; m.userData.ownedGeometry = true; m.userData.pool = true; parent.add(m); return m;
}

/**
 * Merges what was just placed into a few draws, like the reference's one-batch interior (house-view.ts build()):
 * every opaque baked kit piece (they share World's vertex-colour material) into one mesh, every glowing part into one,
 * every light pool into one. Characters, labels and target hit boxes stay separate. The merged geometry is flagged
 * ownedGeometry, so the next rebuild disposes it.
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
  const pool = add(pools, poolMaterial, 'interior-light-pools', false); if (pool) pool.renderOrder = 2;
}

// ---------------------------------------------------------------- placing kit furniture
function placeFactory(world, parent, placed) {
  const has = name => world.assets?.has(name);
  return {
    /** world.sized + optional glow + optional collider; returns the placed object (or null if the kit lacks it). */
    put(name, x, z, size, { y = 0, rot = 0, glow = false, block = null } = {}) {
      if (!has(name)) return null;
      const o = world.sized(name, parent, x, z, size, y, rot); placed.push(o);
      if (glow) addGlow(world, o, name);
      if (block) world.collider(x, z, block[0], block[1], 'interior');
      return o;
    },
    /** world.mounted on a wall: rot turns it onto the left wall (Q) or keeps it on the back wall (0). */
    hang(name, x, z, size, centerY, { rot = 0, glow = false } = {}) {
      if (!has(name)) return null;
      const o = world.mounted(name, parent, x, z, size, centerY); o.rotation.y = rot; placed.push(o);
      if (glow) addGlow(world, o, name);
      return o;
    },
  };
}
/** The top of a placed object, for setting things on it (a lamp on a nightstand). */
const topOf = o => o ? new T.Box3().setFromObject(o).max.y : 0;

/** Clears the previous interior exactly like World.buildInterior used to. */
function clearInterior(world) {
  const shells = new Set(Object.values(world.__interiorShells ?? {}));
  for (const child of [...world.inside.children]) {
    if (!shells.has(child)) child.traverse(o => { if (o.userData.ownedGeometry) o.geometry.dispose(); if (o.isSprite) { o.material.map?.dispose(); o.material.dispose(); } });
    world.inside.remove(child);
  }
  world.labels = world.labels.filter(l => l.parent);
  world.targets = world.targets.filter(t => t.location !== 'interior');
  world.colliders = world.colliders.filter(c => c.location !== 'interior');
}
/** A label chip like the reference's (dark glass pill, icon and name) over a usable thing. World disposes sprite
 * textures and materials when the interior is rebuilt, and shows world.labels indoors. */
function label(world, text, x, z, y) {
  const c = document.createElement('canvas'), g = c.getContext('2d'), font = '900 30px Nunito, system-ui, sans-serif';
  g.font = font; const w = Math.ceil(g.measureText(text).width) + 44, h = 50;
  c.width = w; c.height = h + 8; g.font = font;
  g.fillStyle = 'rgba(20,34,26,.28)'; g.beginPath(); g.roundRect(2, 6, w - 4, h, h / 2); g.fill();
  g.fillStyle = 'rgba(27,47,35,.86)'; g.beginPath(); g.roundRect(2, 2, w - 4, h, h / 2); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2; g.stroke();
  g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 3);
  const map = new T.CanvasTexture(c); map.colorSpace = T.SRGBColorSpace;
  const sprite = new T.Sprite(new T.SpriteMaterial({ map, depthTest: false, toneMapped: false, transparent: true }));
  const height = .62; sprite.scale.set(height * c.width / c.height, height, 1); sprite.position.set(x, y, z); sprite.renderOrder = 5;
  world.inside.add(sprite); world.labels?.push(sprite); return sprite;
}

/**
 * Builds the inside of a house into world.inside.
 * @param {object} world the Willowmere World (needs inside, assets, raw, sized, mounted, collider, target, character, sign, labels, targets, colliders)
 * @param {{houseId:number, state:object, HOUSES:object[], RESIDENTS:object[], KID_OUTFITS?:object[]}} options
 * @returns {{palette:object, targets:object[]}} the palette used and the interior targets created
 */
export function buildInteriorRoom(world, { houseId, state, HOUSES = content.HOUSES, RESIDENTS = content.RESIDENTS, KID_OUTFITS = content.KID_OUTFITS } = {}) {
  clearInterior(world);
  const id = Number(houseId) || 0, home = id === 0, s = state ?? world.state, furniture = s.furniture ?? [], up = s.upgrades ?? {};
  const owns = f => !home || furniture.includes(f);
  // Shell (cached per household).
  const shells = world.__interiorShells ??= {};
  const shell = shells[id] ??= buildShell(id);
  world.inside.add(shell);
  const pal = shell.userData.palette, inside = world.inside, placed = [], { put, hang } = placeFactory(world, inside, placed), D = ROOM.d / 2, W = ROOM.w / 2;

  // Windows with light on the back wall (bedroom and kitchen) and on the left wall, with sunny pools below.
  hang('window', -4.4, -D + .12, 2.2, 2.45, { glow: true }); pool(inside, -4.4, -2.2, 2.2, .8);
  hang('window', 3.0, -D + .12, 2.0, 2.55, { glow: true }); pool(inside, 3.0, -3.4, 1.8, .7);
  hang('window', -W + .12, 4.3, 2.0, 2.4, { rot: Q, glow: true }); pool(inside, -4.9, 4.4, 1.9, .6);
  hang('picture', -.45, -D + .1, 1.15, 2.75);

  // Bedroom (back-left): the bed against the back wall, a nightstand with a lamp, a round rug.
  put('bed', -4.4, -4.45, 3.0, { block: [2.1, 3.0] });
  const stand = put('nightstand', -6.25, -5.4, .95, { block: [.8, .7] });
  put('lamp_small', -6.25, -5.4, .62, { y: topOf(stand), glow: true }); pool(inside, -6.1, -4.9, 1.1, .8);
  put('rug_round', -3.6, -2.3, 2.6, { y: .012 });
  spot(world, 'bedroom', 'sleep', home ? 'Rest & begin a new day' : 'Visit the family bedroom', -3, -1, 1.8);
  label(world, home ? '🛏️ Bed · rest' : '🛏️ Bedroom', -4.4, -4.4, 2.4);

  // Kitchen (back-right): counter, stove and fridge along the back wall; tiers add a second counter, an oven and herbs.
  put('counter', 1.95, -5.38, 1.8);
  put('stove', 3.6, -5.36, 1.55);
  put('fridge', 6.25, -5.25, 1.6);
  put('kettle', 1.7, -5.4, .42, { y: .98 });
  world.collider(3.9, -5.25, 6.2, 1.5, 'interior');
  if (home && up.kitchen >= 1) put('counter', 4.9, -5.38, 1.25);
  if (home && up.kitchen >= 2) put('stove', 6.15, -3.55, 1.25, { rot: -Q, block: [1.1, 1.1] });
  if (home && up.kitchen >= 3) { put('plant_small', 2.4, -5.4, .55, { y: .98 }); put('plant_small', 5.0, -5.4, .5, { y: .98 }); }
  spot(world, 'kitchen', 'cook', 'Cook a family recipe', 3.5, -2.5, 1.8);
  label(world, '🍳 Kitchen', 3.6, -5.2, 2.5);

  // Living room: sofa facing the camera, a coffee table on a round rug, a ceiling lamp's warm pool.
  put('rug_round', .4, 1.0, 4.5, { y: .03 });
  put('coffee_table', .4, 1.0, 1.9);
  put('sofa', .4, -1.1, 3.1, { block: [3, 1.3] });
  put('kettle', .5, .65, .35, { y: .7 });
  pool(inside, .4, .6, 3.4, .55);
  put('plant_big', 6.15, 5.05, 1.7);
  put('plant_big', -6.15, 5.15, 1.5);

  // Wardrobe on the left wall (opens the outfit panel).
  put('wardrobe', -6.35, 2.95, 2.1, { rot: Q, block: [1.1, 1.5] });
  spot(world, 'wardrobe', 'wardrobe', 'Choose an outfit', -4.2, 2.5, 1.5);
  label(world, '👗 Wardrobe', -6.2, 2.95, 2.8);

  // Purchased furniture (state.furniture) and the Family home tiers, as before: other homes show everything.
  if (!home || up.house >= 1) { put('bed', 5.55, 3.0, 2.4, { rot: -Q, block: [2.3, 1.5] }); put('yarn_basket', 4.4, 4.75, 1); }
  if (owns('rug')) put('rug_rect', -3.5, 3.4, 3.4, { y: .015 });
  if (owns('sofa')) { put('armchair', 3.35, .35, 1.7, { rot: -Q * .8 }); put('floor_lamp', 4.45, -.8, 1.9, { glow: true }); pool(inside, 4.3, -.5, 1.6, .9); }
  if (owns('plants')) { put('plant_small', -6.4, -3.3, 1.4); put('plant_small', 6.3, -1.8, 1.4); }
  if (owns('books')) put('bookshelf', -2.45, -5.6, 2.1, { block: [1.5, .8] });
  if (owns('dining')) { put('dining_table', -3.4, 4.6, 2.2, { block: [2, 1.2] }); put('chair', -4.95, 4.6, 1.1, { rot: Q }); put('chair', -1.85, 4.6, 1.1, { rot: -Q }); }
  if (owns('art')) { hang('painting', 5.2, -D + .1, 1.3, 2.65); hang('photo', -2.45, -D + .1, .7, 2.95); hang('photo', -W + .1, -.5, .8, 2.85, { rot: Q }); put('globe', -1.75, -2.45, 1.05); }
  if (home && up.house >= 2) { put('desk', -.45, -5.4, 1.9, { block: [1.8, 1], glow: true }); put('chair', -.45, -4.45, 1.0, { rot: Math.PI }); }
  if (home && up.house >= 3) { const fire = put('fireplace', -6.45, -.7, 2.2, { rot: Q, glow: true, block: [1, 2] }); if (fire) pool(inside, -5.3, -.7, 1.6, 1); }
  const sig = !home && SIGNATURE[id]; if (sig) put(sig[0], 6.2, .6, sig[1], { rot: -Q });

  // The front door: frame, welcome mat and the exit target.
  put('door_frame', 0, D + .02, 2.6, { glow: true });
  put('welcome_mat', 0, 5.1, 2.1, { y: .03 });
  spot(world, 'exit', 'door', 'Step outside', 0, 5.2, 1.6);
  label(world, '🚪 Outside', 0, 6.35, 1.25);

  // The household's residents, as before.
  for (const [i, p] of RESIDENTS.filter(p => p.home === id).entries()) {
    const kid = p.id === 'pip' && s.kidOutfit ? KID_OUTFITS.find(k => k.id === s.kidOutfit)?.color : null;
    const mesh = world.character(p.index % 2 ? 'hero-tall' : 'hero-girl-tall', kid ?? p.color);
    mesh.scale.multiplyScalar(p.child ? .57 : .79); mesh.position.set(-1 + i * 1.7, 0, 2.7); inside.add(mesh);
    world.target('person', p.id, `Talk to ${p.name}`, -1 + i * 1.7, 2.7, 1.1, inside);
  }
  bakeStatics(inside, placed);
  return { palette: pal, targets: world.targets.filter(t => t.location === 'interior') };
}
function spot(world, type, id, text, x, z, r) { return world.target(type, id, text, x, z, r, world.inside); }
