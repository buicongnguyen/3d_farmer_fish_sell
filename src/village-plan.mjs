// Where the village's own scenery stands: its trees (every one can be cleared, and a save remembers which by index), the
// tufts and flowers on its lawns, and the places that must stay clear of them. Pure (no three.js): world.mjs draws it,
// the lanes villagers walk (villagers.mjs) are checked against it, and the tests read it.
//
//   villageTrees()   -> [{x, z, s, kind, gone?}]  index = the tree's id in a save's `cleared` list
//   villageTufts(), villageFlowers()  -> [{x, z, s}]
//   reserved(x, z, pad)   true where no tree, tuft or flower may stand (roads, yards, the farm, the stalls, the grove's path)
//   BLOCKS                the boxes buildings and big props take up, [{x, z, w, d, name}]
//
// The village was made compact (round 7): the four houses south of the ring are gone and the footprint hugs the ring
// road. The first 129 trees are still generated exactly as before, so every tree keeps the index old saves know it by;
// those that would now stand outside the footprint or on something new are simply not there (`gone`: the open fields
// plant that land instead). Trees added for the new layout come after them.
import { HOMES, CIVIC, PARKING, ROADS, POND, MARKET, ATELIER, GREEN, GATE, WOODLAND } from './content.mjs';
import { VILLAGE, inVillage } from './field-layout.mjs';

const rng = (seed = 18) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const front = h => ({ x: Math.sin(h.rot ?? 0), z: Math.cos(h.rot ?? 0) });
/** A yard: the lawn in front of a house (16 m), its sides (11 m each way) and its back (7 m, 16 m with a barn). */
const inYard = (h, x, z) => { const f = front(h), dx = x - h.x, dz = z - h.z, along = dx * f.x + dz * f.z, across = dx * -f.z + dz * f.x; return along > (h.barn ? -16 : -7) && along < 16 && Math.abs(across) < 11; };
const inCivic = (x, z, north, list = CIVIC) => list.some(c => Math.abs(x - c.x) < c.w / 2 + 3 && z > c.z - c.d / 2 - 3 && z < north);
/** The Town Square the first 129 trees were planted round: the four buildings it had then (a later one must not move them). */
const OLD_CIVIC = CIVIC.filter(c => ['school', 'hospital', 'police', 'company'].includes(c.id));

// ---------------------------------------------------------------- the layout the first 129 trees were planted on
const OLD_ROADS = { north: -33, south: 40, west: -52, east: 52 }, P = Math.PI;
const OLD_YARDS = [[-38, -20, -P / 2], [38, -20, P / 2], [-30, 54, P], [38, 20, P / 2, true], [-38, 0, -P / 2], [10, 54, P], [-38, 20, -P / 2, true], [30, 54, P], [-10, 54, P]].map(([x, z, rot, barn]) => ({ x, z, rot, barn }));
function oldReserved(x, z) {
  const R = OLD_ROADS;
  if ([R.north, R.south].some(r => Math.abs(z - r) < 4) && Math.abs(x) < R.east + 4) return true;
  if ([R.west, R.east].some(r => Math.abs(x - r) < 4) && z > R.north - 3 && z < R.south + 3) return true;
  if (Math.abs(z) < 4 && x > R.east && x < R.east + 16) return true;
  if (x > -25 && x < 35 && z > -30 && z < 27) return true; if (x > -4 && x < 37 && z > 17 && z < 37) return true; if (x < -48 && x > -66 && z > 45 && z < 60) return true;
  if (inCivic(x, z, R.north, OLD_CIVIC)) return true;
  return OLD_YARDS.some(h => inYard(h, x, z));
}
const OLD_FARM_TREES = [[-27, -5], [-28, 3], [-27, 10], [-21, 23], [-3, -24], [-14, -20], [-20, -25], [29, 10], [31, 2], [-14, 23]];
/** How many trees the old layout had (119 scattered, 10 on the family land): indexes below this belong to old saves. */
export const OLD_TREES = 129;

// ---------------------------------------------------------------- today's layout
/** The grove at the north-west corner: the woodland trail's start, its eight gathering patches and the path between them. */
export const GROVE = { x0: -52.5, x1: -31, z0: -46.6, z1: -37.2 };
/** The school yard, west of the school. */
export const SCHOOL_YARD = { x0: -31.4, x1: -27.9, z0: -43, z1: -35.5 };
export const gatherSpots = () => Array.from({ length: 8 }, (_, i) => ({ id: `${i % 2 ? 'wood' : 'mushroom'}-${i}`, kind: i % 2 ? 'wood' : 'mushroom', x: -50.5 + i * 2.1, z: i % 2 ? -41.2 : -44.4 }));
const inRect = (r, x, z, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
/** True where the village keeps the ground clear: roads and their verges, yards, the farm, market row, the Town Square. */
export function reserved(x, z, pad = 0) {
  const R = ROADS;
  if ([R.north, R.south].some(r => Math.abs(z - r) < 4 + pad) && Math.abs(x) < R.east + 4) return true;
  if ([R.west, R.east].some(r => Math.abs(x - r) < 4 + pad) && z > R.north - 3 && z < R.south + 3) return true;
  if (Math.abs(z) < 4 + pad && x > R.east && x < GATE.x + 5) return true;                 // the east gate and its spur out to the fields
  if (x > -25 && x < 35 && z > -30 && z < 27) return true;                                 // the homestead: house, fields, pond, pen, barn
  if (x > -4 && x < 37 && z > 17 && z < R.south) return true;                              // market row, the bakery and the village green
  if (inRect(GROVE, x, z, pad) || inRect(SCHOOL_YARD, x, z, pad)) return true;
  if (inCivic(x, z, R.north) || inRect(PARKING, x, z, 1 + pad)) return true;               // the Town Square, the supermarket and its parking
  return HOMES.slice(1).some(h => inYard(h, x, z));
}
/** Trees planted for the compact village: a row behind the grove and the school, a few along the south verge. */
const NEW_TREES = [
  [-55.2, -45.6, 1.9, 'tree_pine'], [-50.6, -47.9, 2.1, 'tree_pine'], [-46.2, -48, 1.8, 'tree_round'], [-41.8, -47.9, 2.2, 'tree_pine'], [-37.4, -48, 1.9, 'tree_round'], [-33.2, -47.8, 2, 'tree_pine'],
  [-54.6, -40.6, 2, 'tree_round'], [-55.4, -36.2, 1.7, 'tree_blossom'], [-29.2, -46.6, 1.8, 'tree_round'],
  [-44, 41.4, 1.7, 'tree_round'], [-31, 41.6, 1.9, 'tree_pine'], [-17, 41.3, 1.6, 'tree_blossom'], [-6.5, 41.6, 1.8, 'tree_round'], [9, 41.4, 1.7, 'tree_round'], [20.5, 41.6, 1.9, 'tree_blossom'], [33, 41.3, 1.7, 'tree_pine'], [45.5, 41.5, 1.8, 'tree_round'],
  // the west verge, the corners, behind the Town Square, and the quiet corner south of the orchard
  [-56.3, -27, 1.8, 'tree_round'], [-56.4, 11.5, 1.9, 'tree_pine'], [-56.1, 29.5, 1.7, 'tree_blossom'], [-55.8, 40.9, 2, 'tree_pine'], [56.2, 41, 1.9, 'tree_round'],
  [-13.9, -47.5, 1.9, 'tree_round'], [2.2, -47.6, 1.8, 'tree_blossom'], [18.3, -47.5, 2, 'tree_pine'],
  [-19.6, 32.3, 1.7, 'tree_blossom'], [-10.4, 31.6, 1.6, 'tree_round'], [-46.9, 32.4, 1.6, 'tree_round'],
];
let trees = null;
/**
 * Every village tree. Index = its id (the `chop` target, a save's `cleared` list). `gone` trees are not in the world.
 * The list is made once and shared: world.mjs adds its own fields (block) to the entries.
 */
export function villageTrees() {
  if (trees) return trees;
  const rand = rng(), list = [];
  for (let i = 0; i < 340 && list.length < 190; i++) { const x = rand() * 128 - 64, z = rand() * 124 - 62; if (oldReserved(x, z)) continue; list.push({ x, z, s: 1.4 + rand() * 1.1, kind: i % 5 === 0 ? 'tree_blossom' : i % 3 === 0 ? 'tree_pine' : 'tree_round' }); }
  for (const [x, z] of OLD_FARM_TREES) list.push({ x, z, s: 1.6, kind: x > 0 ? 'tree_blossom' : 'tree_round' });
  const farm = list.length - OLD_FARM_TREES.length;
  list.forEach((t, i) => { if (!inRect(VILLAGE, t.x, t.z, -.6) || (i < farm ? reserved(t.x, t.z) : crowdsNew(t.x, t.z))) t.gone = true; });
  for (const [x, z, s, kind] of NEW_TREES) list.push({ x, z, s, kind });
  return trees = list;
}
/** A tree of the family land that would stand on something the compact village added. */
const crowdsNew = (x, z) => Math.hypot(x - ATELIER.x, z - ATELIER.z) < 4.5;
export const livingTrees = () => villageTrees().filter(t => !t.gone);

/** The homestead's lawn: where grass tufts may grow between the house, the lanes, the fields, the pen and the pond. */
export function lawn(x, z) {
  if (Math.abs(x) < 2.2 && z > -12 && z < ROADS.south) return false; if (x > -24 && x < -6.5 && z > -5 && z < 10.5) return false; if (x > 7 && x < 24 && z > -24 && z < -13.5) return false;
  if (Math.abs(x - POND.x) < POND.w / 2 + 2 && Math.abs(z - POND.z) < POND.d / 2 + 3.5) return false; if (Math.abs(x) < 6 && z > -19 && z < -8) return false; if (x > 22 && x < 36 && z > -31 && z < -8) return false;
  if (Math.abs(x - MARKET.x) < 3.4 && Math.abs(z - MARKET.z - .6) < 3.6 || Math.abs(x - ATELIER.x) < 3 && Math.abs(z - ATELIER.z - .6) < 3.4) return false;  // the stalls and where you stand at them
  if (x > 19.6 && x < 32.5 && z > 15 && z < 27) return false;                                // the bakery and its oven
  if (Math.abs(x - GREEN.x) < 4 && Math.abs(z - GREEN.z) < 2.6) return false;               // the supper table
  if (z > 24.8 && z < 27.2 && x > 0 && x < 28) return false;                                 // market row's path
  return !(Math.abs(z + 11.5) < 1.6 && x > 0 && x < 20) && !(Math.abs(z - 12.2) < 1.6 && x > 0 && x < 12);
}
const farmland = (x, z) => x > -25 && x < 35 && z > -30 && z < 27 || x > -4 && x < 37 && z > 17 && z < ROADS.south - 3.5;
let tufts = null, flowers = null;
function scatter() {
  if (tufts) return;
  const rand = rng(4721), w = VILLAGE.x1 - VILLAGE.x0, d = VILLAGE.z1 - VILLAGE.z0, point = () => ({ x: VILLAGE.x0 + rand() * w, z: VILLAGE.z0 + rand() * d });
  tufts = []; flowers = [];
  for (let i = 0; i < 900 && tufts.length < 380; i++) { const p = point(); if ((farmland(p.x, p.z) ? !lawn(p.x, p.z) : reserved(p.x, p.z, .5)) || inBlock(p.x, p.z, .3)) continue; tufts.push({ ...p, s: .8 + rand() * .6 }); }
  for (let i = 0; i < 260 && flowers.length < 90; i++) { const p = point(); if (reserved(p.x, p.z, 1) || inBlock(p.x, p.z, .3)) continue; flowers.push({ ...p, s: .8 + rand() * .55 }); }
}
export function villageTufts() { scatter(); return tufts; }
export function villageFlowers() { scatter(); return flowers; }

// ---------------------------------------------------------------- what stands where (boxes), for lanes and tests
/** The two stalls of market row as the world draws them (model width in metres) and the boxes they take up. */
export const STALL = { market: { size: 4.4, w: 4.2, d: 2.3 }, atelier: { size: 4.2, w: 4, d: 2 } };
/** The Hearth bakery's oven, out on the lawn beside the barn. */
export const OVEN = { x: 21.2, z: 21.7 };
/** What stands on the supermarket's walk, under its awning: the fruit crates, the trolley bay, three planters and a bench. */
const SUPER = CIVIC.find(c => c.id === 'supermarket');
export const SUPER_PROPS = SUPER ? [['crates', -4.3, 4.25, 4.8, .8], ['trolleys', 4.9, 4.65, 3.3, 1.4], ['planter-w', -6.6, 5.18, 1.5, .8], ['planter-l', -1.9, 5.18, .9, .8], ['planter-r', 1.9, 5.18, .9, .8], ['bench', -3.6, 5.22, 1.6, .5]]
  .map(([name, x, z, w, d]) => ({ name: 'super-' + name, x: SUPER.x + x, z: SUPER.z + z, w, d })) : [];
/** The boxes buildings and big props take up (the colliders world.mjs makes for them). */
export const BLOCKS = [
  { name: 'homestead', x: 0, z: -14, w: 9.4, d: 6.8 }, { name: 'well', x: -6, z: -9, w: 2.3, d: 2.3 }, { name: 'pond', x: POND.x, z: POND.z, w: POND.w, d: POND.d },
  { name: 'barn', x: 28, z: -19.5, w: 8.4, d: 7.4 }, { name: 'silo', x: 27, z: -27, w: 3.2, d: 3.2 }, { name: 'tractor', x: 30, z: -11, w: 2.6, d: 4 }, { name: 'windmill', x: -28, z: -14, w: 2.4, d: 2.4 },
  { name: 'bakery', x: 27.3, z: 20, w: 7.4, d: 7.2 }, { name: 'vale-barn', x: -27, z: 20, w: 7.4, d: 8.4 },
  { name: 'market', x: MARKET.x, z: MARKET.z + .05, w: STALL.market.w, d: STALL.market.d }, { name: 'atelier', x: ATELIER.x, z: ATELIER.z + .08, w: STALL.atelier.w, d: STALL.atelier.d }, { name: 'oven', x: OVEN.x, z: OVEN.z, w: 2, d: 2 },
  ...HOMES.slice(1).map(h => { const side = Math.abs(front(h).x) > .5; return { name: h.family, x: h.x, z: h.z, w: side ? 6.6 : 8, d: side ? 8 : 6.6 }; }),
  ...CIVIC.map(c => ({ name: c.id, x: c.x, z: c.z, w: c.w, d: c.d })), ...SUPER_PROPS,
];
/** True inside (or within `pad` of) a building's or prop's box. */
export function inBlock(x, z, pad = 0) { for (const b of BLOCKS) if (Math.abs(x - b.x) < b.w / 2 + pad && Math.abs(z - b.z) < b.d / 2 + pad) return true; return false; }
/** True when a villager (or you) cannot stand at (x, z): inside a box (with the walker's .32 m) or a living tree's trunk. */
export function blockedAt(x, z, pad = .32) {
  if (inBlock(x, z, pad)) return true;
  for (const t of villageTrees()) if (!t.gone && Math.hypot(x - t.x, z - t.z) < .42 * t.s + .3) return true;
  return false;
}
/** The first blocked point on the straight walk from a to b (sampled every 25 cm), or null when the way is clear. */
export function firstBlock(a, b, pad = .32) {
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / .25));
  for (let i = 0; i <= n; i++) { const x = a.x + (b.x - a.x) * i / n, z = a.z + (b.z - a.z) * i / n; if (blockedAt(x, z, pad)) return { x, z }; }
  return null;
}
export { inVillage, WOODLAND };
