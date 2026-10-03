// The map of round 8 (step 0; owner: builder A). Pure: no three.js, no DOM; it imports ward.mjs and nothing else.
//
// Thirteen equal squares on a 5 × 5 grid: the village's cell in the middle, a home region on each side of it (west forest,
// north swamp, south meadow, east canyon) and eight lands beyond them. The twelve other cells are not part of the world.
// North is -z, east is +x. A point exactly on a grid line belongs to the square on its +x or +z side.
//
// The village region is the ward (ward.mjs), not the whole centre cell: the rest of the centre cell is split by side into
// four strips that belong to the home regions, so their creatures come right up to the ring road.
//
//   regionAt(x, z)            'village' | a home region | a land | null (outside the world)
//   cellIdAt(x, z)            the grid alone: 'village' for the whole centre cell
//   squareOf(id)              {x0, x1, z0, z1, cx, cz}; for 'village' the centre cell (geometry only)
//   REGION[id]                {id, name, kind: 'village'|'home'|'land', planet, difficulty, level, bossLevel, stars, ground, accent}
//   DENS                      26 rows {id, type, region, x, z, clear, leash, titan, event, level}
//   BORDER_RUNS, RUNS_OF      the border segments (below) and the ones that touch each region
//   borderDistance, gridBorderDistance, homeBorderDistance, edgeDistance, inWorld, edgeAhead, inWilds
//   trailOffset(id, along), trailDistance(x, z)    the four sand trails of the home regions
import { SAFE, WARD_OUTLINE, inSafeZone } from './ward.mjs';

export const CELL = 128;                              // the one number to change. Must be a multiple of 128 (64 m tiles, 32 m creature cells)
export const GRID = 5, HALF = CELL * GRID / 2;        // 320
export const EDGE_PAD = 2;                            // nobody walks or drives closer to the edge than this
export const RIM_REACH = 1.25 * CELL;                 // the minimap: dens this near ride its rim (160 m)
export const GRID_IDS = [                             // [row][col], row 0 is north
  [null,     null,    'ice',     null,    null    ],
  [null,     'toy',   'north',   'ocean', null    ],
  ['jungle', 'west',  'village', 'east',  'shadow'],
  [null,     'candy', 'south',   'cloud', null    ],
  [null,     null,    'lava',    null,    null    ],
];
const C = CELL / 2, len = (x, z) => Math.sqrt(x * x + z * z);
export const cellOf = v => Math.floor((v + HALF) / CELL);
/** The grid alone: 'village' for the whole centre cell, null outside the thirteen squares. */
export const cellIdAt = (x, z) => GRID_IDS[cellOf(z)]?.[cellOf(x)] ?? null;
/** Which side's strip a point of the centre cell (outside the ward) lies in. Each value is 0 on that side of SAFE and 1 on that side of the cell; a tie goes to the first of west, north, south, east. */
function stripSide(x, z) {
  const w = (SAFE.x0 - x) / (SAFE.x0 + C), n = (SAFE.z0 - z) / (SAFE.z0 + C), s = (z - SAFE.z1) / (C - SAFE.z1), e = (x - SAFE.x1) / (C - SAFE.x1);
  let best = 'west', value = w;
  if (n > value) { best = 'north'; value = n; }
  if (s > value) { best = 'south'; value = s; }
  if (e > value) best = 'east';
  return best;
}
/** The region of a point: 'village' inside the ward, a home region in its square and its strip of the centre cell, a land, or null outside the world. */
export function regionAt(x, z) {
  const id = GRID_IDS[cellOf(z)]?.[cellOf(x)] ?? null;
  if (id !== 'village') return id;
  return inSafeZone(x, z) ? 'village' : stripSide(x, z);
}
/** In the world and not in the village: where creatures live and fights happen. */
export const inWilds = (x, z) => { const id = regionAt(x, z); return id !== null && id !== 'village'; };

const SQUARES = {};
for (let row = 0; row < GRID; row++) for (let col = 0; col < GRID; col++) {
  const id = GRID_IDS[row][col]; if (!id) continue;
  const x0 = col * CELL - HALF, z0 = row * CELL - HALF;
  SQUARES[id] = Object.freeze({ x0, x1: x0 + CELL, z0, z1: z0 + CELL, cx: x0 + C, cz: z0 + C });
}
/** {x0, x1, z0, z1, cx, cz} of a region's square (for 'village' the centre cell: it is geometry only). */
export const squareOf = id => SQUARES[id] ?? null;

// ---------------------------------------------------------------- the regions
const HOME = [ // id, name, difficulty, ground and accent (Zoo Garden's forest, swamp, meadow and canyon: minimap.ts:17-18, ground.ts:20)
  ['west', 'Mushroom Forest', 1, '#5cbf57'], ['north', 'Chomper Swamp', 2, '#5fb889'], ['south', 'Blue Lake Meadow', 1, '#a6e070'], ['east', 'Redrock Canyon', 3, '#f1bb7c'],
];
const LANDS = [ // planet number (star-map order), id, name, difficulty, ground (the low colour), accent (content.ts PLANET_FACTS)
  [1, 'toy', 'Toybox Land', 2, '#ffe4ef', '#ff8fb8'], [2, 'candy', 'Candy Land', 3, '#ff9fd0', '#ff5fa8'], [3, 'jungle', 'Wild Jungle', 3, '#3f8a3a', '#2f7a34'], [4, 'ice', 'Frost Land', 4, '#cfe6fb', '#7fd3ff'],
  [5, 'ocean', 'Shell Beach', 4, '#f2dca0', '#56bce6'], [6, 'lava', 'Ember Fields', 5, '#6e5a60', '#ff632e'], [7, 'cloud', 'Cloud Meadow', 5, '#bfe8a0', '#9fd8ff'], [8, 'shadow', 'Night Land', 6, '#2a2440', '#8a8ad8'],
];
/** The reference's rules: level = 3 d - 2, boss and titan level = level + 6, stars = clamp(ceil(d / 1.3), 1, 5). In the home regions they are labels only (every home creature plays at power 1). */
const row = (id, name, kind, planet, difficulty, ground, accent) => Object.freeze({ id, name, kind, planet, difficulty, level: Math.max(0, 3 * difficulty - 2), bossLevel: difficulty ? 3 * difficulty + 4 : 0,
  stars: difficulty ? Math.max(1, Math.min(5, Math.ceil(difficulty / 1.3))) : 0, ground, accent });
export const REGION = Object.freeze(Object.fromEntries([
  ['village', row('village', 'Willowmere', 'village', 0, 0, '#93e06a', '#93e06a')],
  ...HOME.map(([id, name, d, color]) => [id, row(id, name, 'home', 0, d, color, color)]),
  ...LANDS.map(([planet, id, name, d, ground, accent]) => [id, row(id, name, 'land', planet, d, ground, accent)]),
]));
export const REGION_IDS = Object.freeze(Object.keys(REGION));

// ---------------------------------------------------------------- dens
/**
 * 26 dens: 4 home bosses, 12 land bosses, 8 land titans, the home titan (the Ancient Mountain Turtle) and the lava dragon's
 * nest. Positions are offsets from the square's centre, so they follow CELL. `clear` keeps common creatures away (16 m for a
 * boss and the nest, 24 m for a titan) whether or not the den's type exists yet; `leash` is how far it leaves its den.
 */
const den = (region, type, dx, dz, extra = {}) => {
  const s = SQUARES[region], titan = type.startsWith('titan_');
  return Object.freeze({ id: 'w:den:' + type, type, region, x: s.cx + dx, z: s.cz + dz, clear: titan ? 24 : 16, leash: 30, titan, event: null, level: REGION[region].bossLevel, ...extra });
};
export const DENS = Object.freeze([
  den('west', 'treant', -24, 26), den('north', 'croc', 26, -24), den('south', 'mushking', -26, 24), den('east', 'bear', 24, -26), den('east', 'titan_turtle', -16, 28),
  den('toy', 'robot', 26, 26), den('toy', 'titan_clock', -26, -26),
  den('candy', 'cake', 28, -28, { leash: 24 }), den('candy', 'gingerbread', -28, -28, { leash: 24 }), den('candy', 'jellyqueen', 28, 28, { leash: 24 }), den('candy', 'titan_hydra', -28, 28),
  den('jungle', 'gorilla', 24, 26), den('jungle', 'titan_flower', -28, -26),
  den('ice', 'yeti', -28, 28, { leash: 24 }), den('ice', 'mammoth', 28, 28, { leash: 24 }), den('ice', 'frostowl', -28, -28, { leash: 24 }), den('ice', 'titan_crystal', 28, -28),
  den('ocean', 'leviathan', -26, 26), den('ocean', 'titan_kraken', 26, -26),
  den('lava', 'golem', -28, -28, { leash: 24 }), den('lava', 'dragon', 28, -28, { leash: 24, event: 'dragon' }), den('lava', 'titan_scorpion', 28, 28),
  den('cloud', 'phoenix', -26, -26), den('cloud', 'titan_whale', 26, 26),
  den('shadow', 'shadowlord', -24, -26), den('shadow', 'titan_eye', 28, 26),
]);

// ---------------------------------------------------------------- borders
/**
 * Every border as a straight run {ax, az, bx, bz, left, right, kind, half, nx, nz}, generated from GRID_IDS and
 * WARD_OUTLINE, never typed by hand. (nx, nz) is the unit normal (-dz, dx) of the run's direction, and `left` is the
 * region on that side, `right` the one on the other (null beyond the world). Mind the name: it is "left" in the (x, z)
 * plane with z drawn upward; on a north-up map it is the right hand. A ward run has the village on its left.
 *   shared  12  a home region against a land: a full ribbon, half-width 1.99 m
 *   outer   20  the world's outer edge: a full ribbon
 *   ward     4  the ward outline: half scale (0.995 m)
 *   seam     4  between two home regions, from a corner of the centre cell to the matching corner of the ward: half scale
 * The four sides of the centre cell carry no run (a home region runs across them into its strip); no two lands share a side.
 */
const FULL = 1.99, SLIM = FULL / 2;
function makeRun(ax, az, bx, bz, kind) {
  const d = len(bx - ax, bz - az), nx = -(bz - az) / d, nz = (bx - ax) / d, mx = (ax + bx) / 2, mz = (az + bz) / 2;
  return Object.freeze({ ax, az, bx, bz, left: regionAt(mx + nx * .25, mz + nz * .25), right: regionAt(mx - nx * .25, mz - nz * .25), kind, half: kind === 'shared' || kind === 'outer' ? FULL : SLIM, nx, nz });
}
function makeRuns() {
  const shared = [], outer = [], at = (r, c) => GRID_IDS[r]?.[c] ?? null;
  for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) {
    const id = at(r, c); if (!id) continue;
    const x0 = c * CELL - HALF, z0 = r * CELL - HALF, x1 = x0 + CELL, z1 = z0 + CELL;
    // [neighbour, the side as a segment]: north, west (outer only: a shared side is made once, by the cell on its north or west), south, east.
    for (const [other, seg, own] of [[at(r - 1, c), [x0, z0, x1, z0], false], [at(r, c - 1), [x0, z0, x0, z1], false], [at(r + 1, c), [x0, z1, x1, z1], true], [at(r, c + 1), [x1, z0, x1, z1], true]]) {
      if (!other) outer.push(makeRun(...seg, 'outer'));
      else if (own && id !== 'village' && other !== 'village') shared.push(makeRun(...seg, 'shared'));
    }
  }
  const ward = WARD_OUTLINE.map(([ax, az], i) => { const [bx, bz] = WARD_OUTLINE[(i + 1) % WARD_OUTLINE.length]; return makeRun(ax, az, bx, bz, 'ward'); });
  // A seam runs from a corner of the centre cell toward the matching corner of the ward, up to the first point inside it.
  const seams = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => makeRun(sx * C, sz * C, sx < 0 ? SAFE.x0 : SAFE.x1, sz < 0 ? SAFE.z0 : SAFE.z1, 'seam'));
  return [...shared, ...outer, ...ward, ...seams];
}
export const BORDER_RUNS = Object.freeze(makeRuns());
/** RUNS_OF[id]: the runs that name the region on either side (a land 4, a home region 6, the village its ward runs). */
export const RUNS_OF = Object.freeze(Object.fromEntries(REGION_IDS.map(id => [id, Object.freeze(BORDER_RUNS.filter(r => r.left === id || r.right === id))])));
const GRID_RUNS_OF = Object.fromEntries(REGION_IDS.map(id => [id, RUNS_OF[id].filter(r => r.kind === 'shared' || r.kind === 'outer')]));
const SHARED_RUNS_OF = Object.fromEntries(REGION_IDS.map(id => [id, RUNS_OF[id].filter(r => r.kind === 'shared')]));

// ---------------------------------------------------------------- distances
function segmentDistance(x, z, r) {
  const dx = r.bx - r.ax, dz = r.bz - r.az, k = Math.max(0, Math.min(1, ((x - r.ax) * dx + (z - r.az) * dz) / (dx * dx + dz * dz)));
  return len(x - r.ax - dx * k, z - r.az - dz * k);
}
const least = (x, z, runs) => { let d = Infinity; for (let i = 0; i < runs.length; i++) { const v = segmentDistance(x, z, runs[i]); if (v < d) d = v; } return d; };
const rectDistance = (x, z, x0, z0, x1, z1) => len(Math.max(0, x0 - x, x - x1), Math.max(0, z0 - z, z - z1));
const SQUARE_LIST = Object.values(SQUARES);
/** Outside the world: metres to the nearest in-world square (the rim uses it). */
function worldDistance(x, z) { let d = Infinity; for (const s of SQUARE_LIST) { const v = rectDistance(x, z, s.x0, s.z0, s.x1, s.z1); if (v < d) d = v; } return d; }
/** Inside the world: metres to the nearest border run of the region you are in (any kind). Outside: metres to the nearest in-world square. */
export function borderDistance(x, z) { const id = regionAt(x, z); return id === null ? worldDistance(x, z) : least(x, z, RUNS_OF[id]); }
/** The same, counting only 'shared' and 'outer' runs (the full-width ribbons). Infinity in the village, which has none. */
export function gridBorderDistance(x, z) { const id = regionAt(x, z); return id === null ? worldDistance(x, z) : least(x, z, GRID_RUNS_OF[id]); }
/** The same, counting only 'shared' runs: how deep a point of a land is from the home region it touches. Infinity where there is none. */
export function homeBorderDistance(x, z) { const id = regionAt(x, z); return id === null ? Infinity : least(x, z, SHARED_RUNS_OF[id]); }
/** Metres to the nearest empty cell or to ±HALF; 0 outside the world. Euclidean, so a notch's corner is round. */
export function edgeDistance(x, z) {
  const c = cellOf(x), r = cellOf(z); if (!(GRID_IDS[r]?.[c])) return 0;
  let d = Infinity;
  for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
    if (GRID_IDS[r + dr]?.[c + dc]) continue;
    const x0 = (c + dc) * CELL - HALF, z0 = (r + dr) * CELL - HALF, v = rectDistance(x, z, x0, z0, x0 + CELL, z0 + CELL); if (v < d) d = v;
  }
  return d;
}
/** In one of the thirteen squares, and at least `pad` metres from the edge. */
export const inWorld = (x, z, pad = 0) => cellIdAt(x, z) !== null && edgeDistance(x, z) >= pad;
/**
 * Metres along a ray (a unit direction) until inWorld(x, z, pad) first fails: the padded world, the same line that blocks.
 * Sampled every metre up to `max` and refined with five bisections; Infinity when the edge is farther than `max`, 0 when
 * the start is already outside the padded world.
 */
export function edgeAhead(x, z, dirX, dirZ, max = 48, pad = EDGE_PAD) {
  if (!inWorld(x, z, pad)) return 0;
  if (edgeDistance(x, z) >= max + pad) return Infinity;
  for (let t = 1; t <= max; t++) {
    if (inWorld(x + dirX * t, z + dirZ * t, pad)) continue;
    let lo = t - 1, hi = t;
    for (let i = 0; i < 5; i++) { const mid = (lo + hi) / 2; if (inWorld(x + dirX * mid, z + dirZ * mid, pad)) lo = mid; else hi = mid; }
    return lo;
  }
  return Infinity;
}

// ---------------------------------------------------------------- trails
const smooth = (x, a, b) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/**
 * The four sand trails of the home regions, along the axes from the ward line to the far side of each home square.
 * `from` and `to` are distances from the origin along the trail's axis. The east trail starts where the gate's road ends
 * (field-layout.mjs GATE_ROAD.x1; tests/regions.test.mjs keeps the two equal).
 */
export const TRAILS = Object.freeze({
  west: Object.freeze({ axis: 'x', sign: -1, from: -SAFE.x0, to: CELL * 1.5 }), north: Object.freeze({ axis: 'z', sign: -1, from: -SAFE.z0, to: CELL * 1.5 }),
  south: Object.freeze({ axis: 'z', sign: 1, from: SAFE.z1, to: CELL * 1.5 }), east: Object.freeze({ axis: 'x', sign: 1, from: 67, to: CELL * 1.5 }),
});
/**
 * How far a trail's centreline lies off its axis, `along` metres from the origin: Zoo Garden's own wander
 * (cute_game src/biomes.ts trailOffset). The east and west trails are at z = trailOffset(id, |x|), the north and south
 * ones at x = trailOffset(id, |z|). The same curve serves all four, as in the reference; `id` is there for a later round.
 */
export const trailOffset = (id, along) => (Math.sin(along * .09) * 3 + Math.sin(along * .23) * 1.2) * smooth(along, 18, 30);
/** Metres from a point to the nearest trail's centreline (sideways while beside a trail, to its end beyond it). */
export function trailDistance(x, z) {
  let best = Infinity;
  for (const id in TRAILS) {
    const t = TRAILS[id], along = (t.axis === 'x' ? x : z) * t.sign, side = t.axis === 'x' ? z : x, k = Math.max(t.from, Math.min(t.to, along)), d = len(along - k, side - trailOffset(id, k));
    if (d < best) best = d;
  }
  return best;
}
