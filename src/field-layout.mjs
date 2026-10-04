// The landscape is deterministic, so revisiting a place keeps its trees in place.
import { regionAt, cellIdAt, borderDistance, trailDistance, squareOf, REGION, REGION_IDS, DENS } from './regions.mjs';
import { DECOR, CARDS, RIM_KINDS } from './region-life.mjs';
import { landClear } from './land-features.mjs';
export const FIELD_TILE = 64;
export const FIELD_RADIUS = 2;
export const OUTDOOR_LIMIT = 32768;
export const HOMESTEAD = { x: 0, z: -8.6 };
/** The spur of the county road that leaves the village by the east gate (world.mjs draws it from x 54.5 to 65.5, out through the ward): the fields keep off it. */
export const GATE_ROAD = { x0: 52, x1: 67, z0: -4, z1: 4 };

/** The village camera (world.mjs): turned CAMERA_YAW round the player, CAMERA_RISE up for every metre back, so it looks down at CAMERA_PITCH (41 degrees). */
export const CAMERA_YAW = .38, CAMERA_RISE = .87, CAMERA_PITCH = Math.atan(CAMERA_RISE);
/**
 * The village footprint: the ring road (content.mjs ROADS: x -52…52, z -33…37, 5 m wide, so its outer edge is at x ±54.5
 * and z 39.5) with one metre of verge on the west, south and east, and on the north the Town Square and the grove behind
 * the school (back walls at z -43.6, the grove's row of trees at z -48). Inside it the village keeps its own trees, tufts
 * and flowers (village-plan.mjs); outside, the open fields begin. The ward (wilds.mjs SAFE) is one metre beyond it.
 */
export const VILLAGE = { x0: -55.5, x1: 55.5, z0: -49, z1: 40.5 };
export function inVillage(x, z) { return x > VILLAGE.x0 && x < VILLAGE.x1 && z > VILLAGE.z0 && z < VILLAGE.z1; }
/** How far outside a rectangle {x0, x1, z0, z1} a point lies (0 inside). */
export const beyondRect = (r, x, z) => Math.hypot(Math.max(0, r.x0 - x, x - r.x1), Math.max(0, r.z0 - z, z - r.z1));
/** Metres beyond the village footprint (0 inside). */
export const beyondVillage = (x, z) => beyondRect(VILLAGE, x, z);
export function fieldRandom(cx, cz) {
  let seed = (Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663) ^ 0x57a811) >>> 0;
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
/** Open land: outside the village footprint and off the gate's road (`pad` keeps a tree's trunk and crown clear of it). */
const wild = (x, z, pad = 0) => !inVillage(x, z) && !(x > GATE_ROAD.x0 && x < GATE_ROAD.x1 + pad && z > GATE_ROAD.z0 - pad && z < GATE_ROAD.z1 + pad);
/**
 * The scenery plan of a 64 m tile, in functions that never call each other in a circle (round 8; builder A; spec 3.5):
 *   fieldTrees(tx, tz)            the blocking pieces: [{x, z, scale, angle, kind, r, h, perch, key}]. r is the collider radius
 *                                 and h the height a bird lands at, both already scaled; perch is false for what no bird sits
 *                                 on; key names the baked model ('scenery/tree_round', 'scenery/rock@shadow'). It reads
 *                                 regions.mjs, region-life.mjs DECOR, land-features.mjs landClear and the dens: never cages,
 *                                 never creatures. The tiles' colliders, wilds.mjs wildCell and friends.mjs cageSpot use it.
 *   fieldCards(tx, tz, keepOut)   the cover and dressing cards: [{x, z, scale, kind, glow, cls, key, turn}]. keepOut is a list
 *                                 of circles [{x, z, r, kinds}] the caller supplies (cages, lookalike twins); a circle
 *                                 without `kinds` keeps every card out.
 *   fieldRim(tx, tz)              outside the world: {land, pieces}: the nearest land and its 20 rim pieces (none for a land
 *                                 without rim kinds); {land: null, pieces: []} in the world and beyond the rim (±448 m).
 *   fieldPlan(tx, tz)             {trees, grass: [], cards, regions, rim, land} for the tile's readers.
 * These have nothing to do with the village's own trees (village-plan.mjs villageTrees: saved indexes, never touched):
 * nothing here is ever placed inside the ward.
 *
 * How a tile is filled. Each region the tile holds has its own seeded stream, so a centre tile's two strips never disturb
 * each other. A row of DECOR or CARDS asks for `count` pieces on a whole tile; where a tile holds only part of a region
 * (the four centre tiles) or a titan's clearing, the count follows the share of the tile that is open to it. A piece that
 * lands on a narrow no-go strip is tried again somewhere else, as the reference does (biomes.ts scatterRule), so a tile
 * away from the village and the dens holds exactly its table's counts.
 * Where no piece goes: inside the ward; within 3 m of a border (plus its collider for a blocking piece); within 5 m of a
 * trail; on the east gate's road (with 2 m more for a blocking piece); where landClear is false for its `where`; within
 * 32 m of a titan's den (blocking pieces only); a blocking piece within 1.2 m of another one's collider; a card inside a
 * collider or in one of the caller's circles.
 */
export const TILE_MAX = Object.freeze({ blocking: 40, cards: 220, rim: 20 });
export const CLEAR = Object.freeze({ border: 3, trail: 5, titan: 32, gap: 1.2 });
export const RIM_TILES = 7; // rim tiles exist for tile indices -7…6 on each axis (±448 m); nothing is ever planned beyond
const TITANS = DENS.filter(d => d.titan);
const hashOf = text => { let h = 2166136261; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619); return h >>> 0; };
/** A tile's own seeded stream for one purpose (a region's pieces, its cards, the rim): mulberry32, keyed by tile and purpose. */
function tileRandom(cx, cz, purpose) {
  let a = (Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663) ^ hashOf(purpose)) >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const titanNear = (x, z) => TITANS.some(d => Math.hypot(d.x - x, d.z - z) < CLEAR.titan);
/** The name a row's baked model is stored under in world.kits: 'kit/kind', or 'kit/kind@tint' for a recoloured copy. */
export const modelKey = row => `${row.kit}/${row.kind}${row.tint ? '@' + row.tint : ''}`;
/**
 * What a tile holds: [{id, share, open}] for every region met on a 9 × 9 sample, in the order first met. `share` is the part
 * of the tile inside the region, `open` the part of that share outside every titan's clearing. Empty outside the world.
 */
const SAMPLES = 9;
function tileShares(cx, cz) {
  const mid = cellIdAt((cx + .5) * FIELD_TILE, (cz + .5) * FIELD_TILE); if (mid === null) return [];
  const box = { x0: cx * FIELD_TILE, x1: (cx + 1) * FIELD_TILE, z0: cz * FIELD_TILE, z1: (cz + 1) * FIELD_TILE }, titan = TITANS.some(d => beyondRect(box, d.x, d.z) < CLEAR.titan);
  if (mid !== 'village' && !titan) return [{ id: mid, share: 1, open: 1 }];
  const out = [], by = {};
  for (let i = 0; i < SAMPLES; i++) for (let k = 0; k < SAMPLES; k++) {
    const x = (cx + (i + .5) / SAMPLES) * FIELD_TILE, z = (cz + (k + .5) / SAMPLES) * FIELD_TILE, id = regionAt(x, z); if (!id) continue;
    if (!by[id]) out.push(by[id] = { id, share: 0, open: 0 });
    by[id].share++; if (!titan || !titanNear(x, z)) by[id].open++;
  }
  for (const row of out) { row.open /= row.share; row.share /= SAMPLES * SAMPLES; }
  return out;
}
const memos = [];
const memo = (limit, make) => { const map = new Map(); memos.push(map); return (cx, cz) => { const key = cx + ',' + cz; let value = map.get(key); if (!value) { if (map.size > limit) map.clear(); map.set(key, value = make(cx, cz)); } return value; }; };
const sharesOf = memo(600, tileShares);
/** Forgets every planned tile. The plans are remembered because the tables never change while the game runs; a test that swaps a table calls this. */
export function resetFieldPlan() { for (const map of memos) map.clear(); }
const between = (random, [a, b]) => a + random() * (b - a);

const treesOf = memo(600, (cx, cz) => {
  const trees = [];
  for (const { id, share, open } of sharesOf(cx, cz)) {
    if (id === 'village') continue;
    const random = tileRandom(cx, cz, 'blocking:' + id);
    for (const row of DECOR[id] ?? []) {
      const want = Math.round(row.count * share * open), where = row.where ?? 'land', key = modelKey(row);
      for (let placed = 0, tries = 0; placed < want && tries < want * 12 && trees.length < TILE_MAX.blocking; tries++) {
        const x = (cx + random()) * FIELD_TILE, z = (cz + random()) * FIELD_TILE, scale = between(random, row.scale), angle = random() * Math.PI * 2, r = row.r * scale;
        if (regionAt(x, z) !== id || !wild(x, z, 2) || borderDistance(x, z) < CLEAR.border + r || trailDistance(x, z) < CLEAR.trail || titanNear(x, z) || !landClear(x, z, r, where)) continue;
        if (trees.some(t => Math.hypot(t.x - x, t.z - z) < t.r + r + CLEAR.gap)) continue;
        trees.push({ x, z, scale, angle, kind: row.kind, r, h: row.h * scale, perch: !!row.perch, key }); placed++;
      }
    }
  }
  return trees;
});
/** The blocking pieces of a tile (trees, rocks, toy blocks…): the same list on every call. Do not change what it returns. */
export function fieldTrees(cx, cz) { return treesOf(cx, cz); }
/** The cover and dressing cards of a tile; `keepOut` circles [{x, z, r, kinds}] drop the cards of those kinds (every kind without `kinds`). */
export function fieldCards(cx, cz, keepOut = []) {
  const cards = [], trees = treesOf(cx, cz);
  for (const { id, share } of sharesOf(cx, cz)) {
    if (id === 'village') continue;
    const random = tileRandom(cx, cz, 'cards:' + id);
    for (const row of CARDS[id] ?? []) {
      const want = Math.round(row.count * share), where = row.where ?? 'land', key = modelKey(row), dressing = row.cls === 'dressing', glow = row.glow ? 1 : 0;
      for (let placed = 0, tries = 0; placed < want && tries < want * 8 && cards.length < TILE_MAX.cards; tries++) {
        // The sizes are the reference's (biomes.ts planDecor): cover 0.8 to 1.25, the tiny dressing 1.6 to 2.4.
        const x = (cx + random()) * FIELD_TILE, z = (cz + random()) * FIELD_TILE, scale = dressing ? 1.6 + random() * .8 : .8 + random() * .45, turn = random();
        if (regionAt(x, z) !== id || !wild(x, z) || borderDistance(x, z) < CLEAR.border || trailDistance(x, z) < CLEAR.trail || !landClear(x, z, 0, where)) continue;
        if (trees.some(t => Math.hypot(t.x - x, t.z - z) < t.r + .3)) continue;
        // A card inside one of the caller's circles is dropped, not moved: the cards outside the circles are the same with and without them.
        if (keepOut.some(c => (!c.kinds || c.kinds.includes(row.kind)) && Math.hypot(c.x - x, c.z - z) < c.r)) { placed++; continue; }
        cards.push({ x, z, scale, kind: row.kind, glow, cls: dressing ? 'dressing' : 'cover', key, turn }); placed++;
      }
    }
  }
  return cards;
}
/** The regions a tile holds, in the order they are first met on a 9 × 9 sample (one for most tiles, three for a centre tile, none outside the world). */
export const tileRegions = (cx, cz) => sharesOf(cx, cz).map(row => row.id);

const LANDS = REGION_IDS.filter(id => REGION[id].kind === 'land').sort((a, b) => REGION[a].planet - REGION[b].planet);
/** The land a point outside the world belongs to: the in-world square nearest it; on a tie, the lower planet number. */
export function nearestLand(x, z) {
  let best = null, least = Infinity;
  for (const id of LANDS) { const d = beyondRect(squareOf(id), x, z); if (d < least - 1e-9) { least = d; best = id; } }
  return best;
}
const rimOf = memo(400, (cx, cz) => {
  const x = (cx + .5) * FIELD_TILE, z = (cz + .5) * FIELD_TILE;
  if (cx < -RIM_TILES || cx >= RIM_TILES || cz < -RIM_TILES || cz >= RIM_TILES || cellIdAt(x, z) !== null) return { land: null, pieces: [] };
  const land = nearestLand(x, z), kinds = RIM_KINDS[land] ?? [], pieces = [];
  if (kinds.length) {
    // One kind a tile (one draw), picked by the tile's seed; no colliders, no cover, nothing casts a shadow.
    const random = tileRandom(cx, cz, 'rim'), row = kinds[Math.floor(random() * kinds.length)], key = modelKey(row);
    for (let tries = 0; pieces.length < TILE_MAX.rim && tries < TILE_MAX.rim * 12; tries++) {
      const px = (cx + random()) * FIELD_TILE, pz = (cz + random()) * FIELD_TILE, scale = 1.6 + random() * .6, angle = random() * Math.PI * 2;
      if (borderDistance(px, pz) < CLEAR.border + 1) continue;
      pieces.push({ x: px, z: pz, scale, angle, kind: row.kind, key });
    }
  }
  return { land, pieces };
});
/** A tile outside the world: {land, pieces}. The rim is scenery only: nothing in it blocks, perches or casts a shadow. */
export function fieldRim(cx, cz) { return rimOf(cx, cz); }
export function fieldPlan(cx, cz) {
  const rim = rimOf(cx, cz);
  return { trees: fieldTrees(cx, cz), grass: [], cards: fieldCards(cx, cz, []), regions: tileRegions(cx, cz), rim: rim.pieces, land: rim.land };
}

export function homeBearing(player, home = HOMESTEAD, yaw = .38) {
  const dx = home.x - player.x, dz = home.z - player.z;
  // Orthographic camera: right axis and the ground's vertical foreshortening.
  const screenX = dx * Math.cos(yaw) - dz * Math.sin(yaw);
  const screenY = (dx * Math.sin(yaw) + dz * Math.cos(yaw)) * (.87 / Math.hypot(1, .87));
  return { distance: Math.hypot(dx, dz), angle: Math.atan2(screenX, -screenY) * 180 / Math.PI };
}
