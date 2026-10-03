// The landscape is deterministic, so revisiting a place keeps its trees in place.
import { regionAt } from './regions.mjs';
import { DECOR } from './region-life.mjs';
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
 * The scenery plan of a 64 m tile, in three functions so that nothing calls itself (round 8; builder A):
 *   fieldTrees(tx, tz)            the blocking pieces: [{x, z, scale, angle, kind, r, h, perch}]. r is the collider radius and
 *                                 h the height a bird lands at, both already scaled; perch is false for what no bird sits on.
 *                                 It reads regions.mjs and region-life.mjs DECOR only: never cages, never creatures. It is
 *                                 what the tiles' colliders, wilds.mjs wildCell and friends.mjs cageSpot use.
 *   fieldCards(tx, tz, keepOut)   the cover and dressing cards: [{x, z, scale, kind, glow}]. keepOut is a list of circles
 *                                 [{x, z, r, kinds}] the caller supplies (cages, lookalike twins).
 *   fieldPlan(tx, tz)             {trees: fieldTrees(tx, tz), grass, cards, regions} for the tile's readers.
 * These have nothing to do with the village's own trees (village-plan.mjs villageTrees: saved indexes, never touched).
 *
 * STEP 0: main's plan is behind all three, in every tile, in or out of the world: the same eight seeded tries for a tree
 * and the same hundred grass blades from one seeded stream, the trees with r, h and perch added from DECOR's stub rows;
 * fieldCards returns []. Builder A replaces the bodies at its own merge (regions, kits, cards, the rim).
 */
const TREE_ROW = Object.fromEntries(DECOR.west.map(row => [row.kind, row]));
function seededTrees(random, cx, cz) {
  const trees = [];
  // Sparse trees leave broad, empty meadows between them.
  for (let i = 0; i < 8; i++) {
    const x = (cx + random()) * FIELD_TILE, z = (cz + random()) * FIELD_TILE;
    const scale = 1.25 + random() * .85, angle = random() * Math.PI * 2, kind = i % 3 ? 'tree_round' : 'tree_pine', row = TREE_ROW[kind];
    if (wild(x, z, 2)) trees.push({ x, z, scale, angle, kind, r: row.r * scale, h: row.h * scale, perch: row.perch });
  }
  return trees;
}
export function fieldTrees(cx, cz) { return seededTrees(fieldRandom(cx, cz), cx, cz); }
export function fieldCards(cx, cz, keepOut = []) { return []; }
/** The regions a tile holds, in the order they are first met on a 9 × 9 sample (one for most tiles, three for a centre tile, none outside the world). */
function tileRegions(cx, cz) {
  const out = [];
  for (let i = 0; i <= 8; i++) for (let k = 0; k <= 8; k++) { const id = regionAt((cx + (i + .5) / 9) * FIELD_TILE, (cz + (k + .5) / 9) * FIELD_TILE); if (id && !out.includes(id)) out.push(id); }
  return out;
}
export function fieldPlan(cx, cz) {
  const random = fieldRandom(cx, cz), trees = seededTrees(random, cx, cz), grass = [];
  for (let i = 0; i < 100; i++) {
    const x = (cx + random()) * FIELD_TILE, z = (cz + random()) * FIELD_TILE;
    const scale = .6 + random() * .7, angle = random() * Math.PI * 2;
    if (wild(x, z)) grass.push({ x, z, scale, angle });
  }
  return { trees, grass, cards: fieldCards(cx, cz, []), regions: tileRegions(cx, cz) };
}

export function homeBearing(player, home = HOMESTEAD, yaw = .38) {
  const dx = home.x - player.x, dz = home.z - player.z;
  // Orthographic camera: right axis and the ground's vertical foreshortening.
  const screenX = dx * Math.cos(yaw) - dz * Math.sin(yaw);
  const screenY = (dx * Math.sin(yaw) + dz * Math.cos(yaw)) * (.87 / Math.hypot(1, .87));
  return { distance: Math.hypot(dx, dz), angle: Math.atan2(screenX, -screenY) * 180 / Math.PI };
}
