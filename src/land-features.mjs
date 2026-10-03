// Where each region's terrain features are (round 8; owner: builder B). Pure: it imports regions.mjs and nothing above it.
// Adapted from Zoo Garden (cute_game src/environments.ts createEnvironmentLayout; src/world.ts:555-563 for the ponds) to a
// flat world of 128 m squares: the fixed features are offsets from their square's centre (spec 3.9), the small ones are
// seeded with the reference's own generator and seeds, drawing points uniformly in the square instead of on a disc.
//
//   FEATURES[id]        what a region holds, built once: {ponds, tracks, poison, thorns, pools, vents, nest, nestIslands, sea,
//                       turtles, islands, lamps, flowers, ice}. A list a region lacks is empty (nest and sea: null; ice: false).
//   landClear(x, z, r = 0, where = 'land')
//                       'land'   false on a pond, a lava pool, the nest, a vent, a rail, a thorn wall, a lamp post or the sea
//                                (blocking pieces, land cards, land creatures); r widens every feature
//                       'sea'    true only in the Beach's sea, r metres inside its edge (coral cards, the sea kinds)
//                       'island' true only on a Cloud Meadow island, r metres inside its edge (its trees, tufts and flowers)
//   waterAt(x, z)       true in the Beach's sea
//   blockers(id)        [{x, z, r, carOnly}]: the round things that stop movement: ponds and lamp posts (everyone), lava pools
//                       and the nest's basin (cars only)
//   mapFeatures(id)     [{kind, x, z, r, color, …}]: the same features as flat shapes for a map (world.lands.mapFeatures)
import { CELL, DENS, squareOf } from './regions.mjs';

const len = (x, z) => Math.sqrt(x * x + z * z), freeze = Object.freeze;
/** Zoo Garden's own generator (environments.ts rng). */
export function rng(seed) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
/** Water looks of the reference's ponds (pond-view.ts LOOKS): water, sand, deep, shallow. */
export const POND_LOOKS = freeze({
  home: { water: '#5ec8ff', sand: '#e6dc9e', deep: '#5ab4d8', shallow: '#9bd3dc' },
  candy: { water: '#ff9fd2', sand: '#ffd8ec', deep: '#e06aa8', shallow: '#f6a9cc' },
  ice: { water: '#7fd3ff', sand: '#eef6ff', deep: '#3f9fcf', shallow: '#a9dcef' },
  toy: { water: '#6fd3ff', sand: '#ffe9a8', deep: '#2f93ad', shallow: '#86cfd0' },
  jungle: { water: '#4fa88a', sand: '#d8c890', deep: '#2a7a62', shallow: '#6fae8f' },
  shadow: { water: '#3f3a7a', sand: '#5a5478', deep: '#25204a', shallow: '#4a4672' },
});
export const RAIL_HALF = 1.6;        // a rail bed's half width: nothing grows or spawns on it
export const SEA_DEPTH = 24;         // the Beach's sea band, along its two outer sides
export const FEATURE_RULE = freeze({ border: 12, den: 20, arena: 32 });

const at = (id, dx, dz, extra) => { const s = squareOf(id); return { x: s.cx + dx, z: s.cz + dz, ...extra }; };
const pond = (id, dx, dz, r, look) => freeze(at(id, dx, dz, { r, look }));
const dens = id => DENS.filter(d => d.region === id);
/**
 * The seeded rule for small features (spec 3.9): the reference's scatter(count, seed, minDistance, spacing) with its own
 * seeds, uniform in the square. A point is kept when it is 12 m from every side, 20 m from every den, outside every titan's
 * 32 m arena by its own radius, clear of the larger features (`keep`) and `spacing` from the points before it.
 */
function scatter(id, count, seed, spacing, radius, keep = () => true) {
  const random = rng(seed), s = squareOf(id), out = [], home = dens(id);
  for (let attempt = 0; out.length < count && attempt < 20000; attempt++) {
    const x = s.x0 + random() * CELL, z = s.z0 + random() * CELL, r = typeof radius === 'function' ? radius(out.length) : radius;
    if (Math.min(x - s.x0, s.x1 - x, z - s.z0, s.z1 - z) < FEATURE_RULE.border) continue;
    if (home.some(d => len(d.x - x, d.z - z) < (d.titan ? FEATURE_RULE.arena + r : FEATURE_RULE.den))) continue;
    if (!keep(x, z, r) || out.some(p => len(p.x - x, p.z - z) <= spacing)) continue;
    out.push(freeze({ x, z, r, id: out.length }));
  }
  return out;
}
const off = (list, gap) => (x, z, r) => list.every(p => len(p.x - x, p.z - z) > p.r + r + gap);

function build() {
  const F = {};
  const blank = () => ({ ponds: [], tracks: [], poison: [], thorns: [], pools: [], vents: [], nest: null, nestIslands: [], sea: null, turtles: [], islands: [], lamps: [], flowers: [], ice: false });
  for (const id of ['village', 'west', 'north', 'south', 'east', 'toy', 'candy', 'jungle', 'ice', 'ocean', 'lava', 'cloud', 'shadow']) F[id] = blank();
  // Home: the forest's two ponds and the Blue Lake (world.ts:555). The swamp and the canyon have no water there either.
  F.west.ponds = [pond('west', 28, 34, 8, 'home'), pond('west', -22, -30, 7, 'home')];
  F.south.ponds = [pond('south', 18, -30, 9, 'home'), pond('south', 34, 32, 11, 'home')];
  // Toy: two of the three railways (r 22, 7 and 8 m/s; environments.ts:69) and one pond, in the middle of the second loop.
  F.toy.tracks = [freeze(at('toy', -28, 28, { r: 22, speed: 7, id: 0 })), freeze(at('toy', 28, -28, { r: 22, speed: 8, id: 1 }))];
  F.toy.ponds = [pond('toy', 28, -28, 6, 'toy')];
  F.candy.ponds = [pond('candy', 0, 0, 6.6, 'candy')];
  // Jungle: a pond, 2 poison patches (r 4.5 + 0.8 a step) and 4 thorn walls (r 3.8; angle and phase by index), the reference's seeds.
  F.jungle.ponds = [pond('jungle', 0, 20, 6, 'jungle')];
  F.jungle.poison = scatter('jungle', 2, 87356, 20, i => 4.5 + (i % 4) * .8, off(F.jungle.ponds, 3));
  F.jungle.thorns = scatter('jungle', 4, 97632, 14, 3.8, (x, z, r) => off(F.jungle.ponds, 3)(x, z, r) && off(F.jungle.poison, 2)(x, z, r)).map(p => freeze({ ...p, angle: p.id * 1.71, phase: p.id * 2.17 }));
  F.ice.ponds = [pond('ice', -20, 0, 6.6, 'ice')]; F.ice.ice = true;
  // The Beach: sand, with the sea as a band along the two outer sides (east and north), and three turtles circling in it.
  { const s = squareOf('ocean'); F.ocean.sea = freeze({ x: s.x1 - SEA_DEPTH, z: s.z0 + SEA_DEPTH, x0: s.x0, x1: s.x1, z0: s.z0, z1: s.z1 });
    F.ocean.turtles = [freeze(at('ocean', 52, 28, { r: 1.2, id: 0 })), freeze(at('ocean', -8, -52, { r: 1.2, id: 1 })), freeze(at('ocean', 52, -52, { r: 1.2, id: 2 }))]; }
  // Lava: three of the five pools (9% of the square), two of the six vents with the reference's first two phases, and the
  // dragon's nest: a basin round its den with a centre island and ten ring islands.
  F.lava.pools = [freeze(at('lava', -34, 34, { r: 15, id: 0 })), freeze(at('lava', -2, -4, { r: 11, id: 1 })), freeze(at('lava', -46, -4, { r: 11, id: 2 }))];
  F.lava.vents = [freeze(at('lava', 0, -50, { r: 5.5, id: 0, phase: 110 })), freeze(at('lava', -4, 46, { r: 5.5, id: 1, phase: 57 }))];
  { const d = DENS.find(d => d.type === 'dragon'), islands = [freeze({ x: d.x, z: d.z, r: 4.5, id: 0 })];
    for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5, far = i % 2 ? 11 : 7; islands.push(freeze({ x: d.x + Math.cos(a) * far, z: d.z + Math.sin(a) * far, r: 2.1 + (i % 3) * .35, id: i + 1 })); }
    F.lava.nest = freeze({ x: d.x, z: d.z, r: 14, id: 0 }); F.lava.nestIslands = islands; }
  // Cloud: eight grass islands on the cloud floor, one under each den, the rest by the reference's islandField rule (seed 75632).
  { const s = squareOf('cloud'), random = rng(75632), list = dens('cloud').map((d, i) => freeze({ x: d.x, z: d.z, r: d.titan ? 18 : 16, id: i }));
    for (let attempt = 0; list.length < 8 && attempt < 30000; attempt++) {
      const x = s.x0 + random() * CELL, z = s.z0 + random() * CELL, r = 12 + random() * 6;
      if (Math.min(x - s.x0, s.x1 - x, z - s.z0, s.z1 - z) < r + 3 || !list.every(o => len(o.x - x, o.z - z) > o.r + r + 4)) continue;
      list.push(freeze({ x, z, r, id: list.length }));
    }
    F.cloud.islands = list; }
  // Night: a pond, 4 light pillars (r 8) and 10 crystal flowers (r 2.4), the reference's seeds.
  F.shadow.ponds = [pond('shadow', 0, -20, 6, 'shadow')];
  F.shadow.lamps = scatter('shadow', 4, 54467, 18, 8, off(F.shadow.ponds, 2));
  F.shadow.flowers = scatter('shadow', 10, 44713, 7, 2.4, (x, z) => F.shadow.ponds.every(p => len(p.x - x, p.z - z) > p.r + 2) && F.shadow.lamps.every(p => len(p.x - x, p.z - z) > 2));
  for (const id in F) { for (const key in F[id]) if (Array.isArray(F[id][key])) freeze(F[id][key]); freeze(F[id]); }
  return freeze(F);
}
export const FEATURES = build();
const SEA = FEATURES.ocean.sea, IDS = Object.keys(FEATURES).filter(id => id !== 'village');
const inSquare = (s, x, z) => x >= s.x0 && x < s.x1 && z >= s.z0 && z < s.z1;
/** Metres into the sea (negative on the sand), for a point of the Beach's square. */
const seaDepth = (x, z) => Math.max(x - SEA.x, SEA.z - z);

/** True in the Beach's sea: its band along the east and north sides. */
export const waterAt = (x, z) => inSquare(SEA, x, z) && seaDepth(x, z) > 0;
/** The five points of a thorn wall (environments.ts dynamicObstacles): along its angle at -3, -1.5, 0, 1.5 and 3 m. */
export const thornPoints = wall => [-3, -1.5, 0, 1.5, 3].map(t => ({ x: wall.x + Math.cos(wall.angle) * t, z: wall.z + Math.sin(wall.angle) * t, r: .75 }));
// Every round thing of every region, for landClear (the square test comes first, so a far point costs four comparisons a region).
const ROUNDS = Object.fromEntries(IDS.map(id => { const f = FEATURES[id]; return [id, [...f.ponds, ...f.pools, ...f.vents, ...(f.nest ? [f.nest] : []), ...f.thorns.map(t => ({ x: t.x, z: t.z, r: 3.4 })), ...f.lamps.map(l => ({ x: l.x, z: l.z, r: .6 }))]]; }));
const SQUARES = IDS.map(id => [id, squareOf(id)]);
export function landClear(x, z, r = 0, where = 'land') {
  if (where === 'sea') return inSquare(SEA, x, z) && seaDepth(x, z) >= r;
  if (where === 'island') { const list = FEATURES.cloud.islands; for (let i = 0; i < list.length; i++) if (len(list[i].x - x, list[i].z - z) <= list[i].r - r) return true; return false; }
  for (let k = 0; k < SQUARES.length; k++) {
    const s = SQUARES[k][1]; if (x < s.x0 - r - 1 || x > s.x1 + r + 1 || z < s.z0 - r - 1 || z > s.z1 + r + 1) continue;
    const id = SQUARES[k][0], rounds = ROUNDS[id], tracks = FEATURES[id].tracks;
    for (let i = 0; i < rounds.length; i++) if (len(rounds[i].x - x, rounds[i].z - z) < rounds[i].r + r) return false;
    for (let i = 0; i < tracks.length; i++) if (Math.abs(len(tracks[i].x - x, tracks[i].z - z) - tracks[i].r) < RAIL_HALF + r) return false;
    if (id === 'ocean' && inSquare(SEA, x, z) && seaDepth(x, z) > -r) return false;
  }
  return true;
}
const BLOCKERS = Object.fromEntries(Object.keys(FEATURES).map(id => { const f = FEATURES[id]; return [id, freeze([
  ...f.ponds.map(p => freeze({ x: p.x, z: p.z, r: p.r, carOnly: false })), ...f.lamps.map(p => freeze({ x: p.x, z: p.z, r: .35, carOnly: false })),
  ...f.pools.map(p => freeze({ x: p.x, z: p.z, r: p.r, carOnly: true })), ...(f.nest ? [freeze({ x: f.nest.x, z: f.nest.z, r: f.nest.r, carOnly: true })] : []),
])]; }));
const NONE = freeze([]);
export const blockers = id => BLOCKERS[id] ?? NONE;
const MAP = {};
/** A region's features as flat shapes for a map: discs {kind, x, z, r, color}, a 'track' ring, a 'thorn' line, the 'sea' {x, z, x0, x1, z0, z1}. */
export function mapFeatures(id) {
  if (MAP[id]) return MAP[id];
  const f = FEATURES[id]; if (!f) return NONE;
  const out = [], add = (kind, list, color, extra) => { for (const p of list) out.push(freeze({ kind, x: p.x, z: p.z, r: p.r, color: typeof color === 'function' ? color(p) : color, ...extra?.(p) })); };
  if (f.sea) out.push(freeze({ kind: 'sea', ...f.sea, r: 0, color: '#56bce6' }));
  add('island', f.islands, '#bfe8a0'); add('pond', f.ponds, p => POND_LOOKS[p.look].water); add('pool', f.pools, '#ff632e');
  if (f.nest) add('nest', [f.nest], '#3c3549');
  add('vent', f.vents, '#fa6851'); add('track', f.tracks, '#8c9bab'); add('poison', f.poison, '#9869bf');
  add('thorn', f.thorns, '#648344', p => ({ angle: p.angle })); add('lamp', f.lamps, '#ffde8c', p => ({ id: p.id })); add('flower', f.flowers, '#80dcd1');
  return MAP[id] = freeze(out);
}
