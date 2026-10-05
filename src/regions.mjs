// The map of round 9 (ring world, stage 1; owner: builder A). Pure: no three.js, no DOM; it imports ward.mjs and den-rows.mjs only.
//
// A circular world of radius R2 centred on the origin. The village is the ward (ward.mjs, a road-hugging rectangle). Round it, inside
// the circle of radius R1, are four home quarters split by the two axes (NE `east`, SE `south`, SW `west`, NW `north`); beyond R1, up to
// R2, are eight 45-degree planets. North is -z, east is +x; a bearing is measured clockwise from north (0 north, 90 east).
// A point is classified by exact comparisons of x and z, never by trig, so every tie is exact: a point on a radial line belongs to the
// region that begins there going clockwise; a point exactly on the inner circle belongs to the outer ring; exactly on the outer circle is
// outside the world (and so is NaN).
//
//   RING                      the one constants block ({R1, R2}); change it and nothing else
//   regionAt(x, z)            'village' | a quarter | a planet | null (outside the world)
//   shapeOf(id)               {kind, r0, r1, b0, b1, x0, x1, z0, z1, cx, cz, label}: bounding box and label anchor (squareOf is the same, kept for old readers)
//   REGION[id]                {id, name, kind, planet, difficulty, level, bossLevel, stars, ground, accent, quarter?, bearings?}
//   DENS                      26 rows {id, type, region, x, z, clear, leash, titan, event, level}
//   BORDER_RUNS, RUNS_OF      36 runs {type: 'seg' | 'arc', kind, half, left, right, length, ...} and the ones that touch each region
//   runDistance, borderDistance, gridBorderDistance, homeBorderDistance, sectorBorderDistance, distanceToRegion
//   edgeDistance, edgeDepth, inWorld, edgeAhead, inWilds, waterAt
//   trailOffset(id, along), trailDistance(x, z)    the four sand trails of the home regions, along the quarters' bisectors
import { SAFE, inSafeZone } from './ward.mjs';
import { denRows } from './den-rows.mjs';

export const RING = Object.freeze({ R1: 160, R2: 296 });   // metres: the inner ring's outer radius, the outer ring's outer radius
export const RADIAL_STEP = 0.8;     // difficulty a planet gains from its inner arc to its rim (used by stage 2)
export const ARC_STEP = 3;          // degrees between mesh points on an arc
export const GATE_END = 67;         // LITERAL: where the east gate's road ends (tests assert it equals GATE_ROAD.x1 of field-layout.mjs, which imports this file)
export const EDGE_PAD = 2;          // nobody walks or drives closer to the edge than this
export const RIM_REACH = RING.R1;   // the minimap: dens this near ride its rim
export const SEA_DEPTH = 32;        // the Beach's sea: the part of `ocean` beyond R2 - SEA_DEPTH
const { R1, R2 } = RING, RAD = Math.PI / 180;
const len = (x, z) => Math.sqrt(x * x + z * z);
export const QUARTER_ID = Object.freeze(['east', 'south', 'west', 'north']);   // NE, SE, SW, NW: bearings [0,90) [90,180) [180,270) [270,360)
// Zoo Garden's numbered order, clockwise from north-north-east (the default of Amendment A5): planets 7, 8, 1, 2, 3, 4, 5, 6.
export const SECTOR_ID = Object.freeze(['cloud', 'shadow', 'toy', 'candy', 'jungle', 'ice', 'ocean', 'lava']);
/** The first draft's zigzag order, only used to turn the hand-solved coordinates of the spec into this order (rotation by whole sectors). */
const ZIGZAG = Object.freeze(['shadow', 'lava', 'ocean', 'jungle', 'toy', 'candy', 'ice', 'cloud']);
export function quarterIndex(x, z) { if (x >= 0 && z < 0) return 0; if (x > 0 && z >= 0) return 1; if (x <= 0 && z > 0) return 2; return 3; }
export function sectorIndex(x, z) {
  switch (quarterIndex(x, z)) { case 0: return x < -z ? 0 : 1; case 1: return x > z ? 2 : 3; case 2: return -x < z ? 4 : 5; default: return x < z ? 6 : 7; }
}
/** Bearing in degrees, 0 to 360, clockwise from north. For drawing and mesh only: classification never uses it. */
export const bearingOf = (x, z) => { const a = Math.atan2(x, -z) / RAD; return a < 0 ? a + 360 : a; };
/** The region of a point: 'village' inside the ward, a quarter inside R1, a planet inside R2, or null outside the world (NaN too). */
export function regionAt(x, z) {
  if (inSafeZone(x, z)) return 'village';
  const r2 = x * x + z * z;
  if (!(r2 < R2 * R2)) return null;
  return r2 < R1 * R1 ? QUARTER_ID[quarterIndex(x, z)] : SECTOR_ID[sectorIndex(x, z)];
}
/** In the world and not in the village: where creatures live and fights happen. */
export const inWilds = (x, z) => { const id = regionAt(x, z); return id !== null && id !== 'village'; };
/** Turns a point written for the zigzag order into this order: planets keep their shape and their own angle inside the sector. */
export function fromZigzag(id, x, z) {
  const k = SECTOR_ID.indexOf(id), j = ZIGZAG.indexOf(id); if (k < 0 || j < 0 || k === j) return { x, z };
  const a = 45 * (k - j) * RAD, c = Math.cos(a), s = Math.sin(a), q = v => Math.round(v * 1000) / 1000;
  return { x: q(x * c - z * s), z: q(z * c + x * s) };
}

// ---------------------------------------------------------------- the regions
const HOME = [ // id, name, difficulty, ground, quarter (Zoo Garden's forest, swamp, meadow and canyon)
  ['west', 'Mushroom Forest', 1, '#5cbf57', 'sw'], ['north', 'Chomper Swamp', 2, '#5fb889', 'nw'], ['south', 'Blue Lake Meadow', 1, '#a6e070', 'se'], ['east', 'Redrock Canyon', 3, '#f1bb7c', 'ne'],
];
const LANDS = [ // planet number (star-map order), id, name, difficulty, ground (the low colour), accent (content.ts PLANET_FACTS)
  [1, 'toy', 'Toybox Land', 2, '#ffe4ef', '#ff8fb8'], [2, 'candy', 'Candy Land', 3, '#ff9fd0', '#ff5fa8'], [3, 'jungle', 'Wild Jungle', 3, '#3f8a3a', '#2f7a34'], [4, 'ice', 'Frost Land', 4, '#cfe6fb', '#7fd3ff'],
  [5, 'ocean', 'Shell Beach', 4, '#f2dca0', '#56bce6'], [6, 'lava', 'Ember Fields', 5, '#6e5a60', '#ff632e'], [7, 'cloud', 'Cloud Meadow', 5, '#bfe8a0', '#9fd8ff'], [8, 'shadow', 'Night Land', 6, '#2a2440', '#8a8ad8'],
];
/** The reference's rules: level = 3 d - 2, boss and titan level = level + 6, stars = clamp(ceil(d / 1.3), 1, 5). In the home regions they are labels only (every home creature plays at power 1). */
const row = (id, name, kind, planet, difficulty, ground, accent, extra = {}) => Object.freeze({ id, name, kind, planet, difficulty, level: Math.max(0, 3 * difficulty - 2), bossLevel: difficulty ? 3 * difficulty + 4 : 0,
  stars: difficulty ? Math.max(1, Math.min(5, Math.ceil(difficulty / 1.3))) : 0, ground, accent, ...extra });
export const REGION = Object.freeze(Object.fromEntries([
  ['village', row('village', 'Willowmere', 'village', 0, 0, '#93e06a', '#93e06a')],
  ...HOME.map(([id, name, d, color, quarter]) => { const i = QUARTER_ID.indexOf(id); return [id, row(id, name, 'home', 0, d, color, color, { quarter, bearings: [90 * i, 90 * i + 90] })]; }),
  ...LANDS.map(([planet, id, name, d, ground, accent]) => { const i = SECTOR_ID.indexOf(id); return [id, row(id, name, 'land', planet, d, ground, accent, { bearings: [45 * i, 45 * i + 45] })]; }),
]));
export const REGION_IDS = Object.freeze(Object.keys(REGION));

/** {kind: 'ward'|'quarter'|'sector', r0, r1, b0, b1, x0, x1, z0, z1, cx, cz}: the region's annulus and bearings, its bounding box, and its label anchor (cx, cz). */
function makeShape(id) {
  if (id === 'village') return Object.freeze({ kind: 'ward', r0: 0, r1: 0, b0: 0, b1: 360, x0: SAFE.x0, x1: SAFE.x1, z0: SAFE.z0, z1: SAFE.z1, cx: (SAFE.x0 + SAFE.x1) / 2, cz: (SAFE.z0 + SAFE.z1) / 2 });
  const R = REGION[id], quarter = R.kind === 'home', [b0, b1] = R.bearings, r0 = quarter ? 0 : R1, r1 = quarter ? R1 : R2;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  const take = (r, b) => { const x = r * Math.sin(b * RAD), z = -r * Math.cos(b * RAD); x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); };
  for (let b = b0; b <= b1 + 1e-9; b += .5) { take(r1, b); take(r0, b); }
  const rho = quarter ? 112 : 228, bearing = (b0 + b1) / 2, cx = Math.round(rho * Math.sin(bearing * RAD) * 1e3) / 1e3, cz = Math.round(-rho * Math.cos(bearing * RAD) * 1e3) / 1e3;
  return Object.freeze({ kind: quarter ? 'quarter' : 'sector', r0, r1, b0, b1, x0, x1, z0, z1, cx, cz });
}
const SHAPES = Object.freeze(Object.fromEntries(REGION_IDS.map(id => [id, makeShape(id)])));
export const shapeOf = id => SHAPES[id] ?? null;
/** Deprecated alias of shapeOf (the bounding box and anchor keep the old names x0, x1, z0, z1, cx, cz). */
export const squareOf = shapeOf;

// ---------------------------------------------------------------- dens
const half = v => Math.round(v * 2) / 2, offSeam = v => v % 32 === 0 ? v + .5 : v;
/** 26 dens from den-rows.mjs: polar to x, z at 0.5 m, never on a 32 m creature seam. `clear` keeps common creatures away (16 m for a boss and the nest, 24 m for a titan); `leash` is how far it leaves its den. */
const den = r => {
  const b = (r.bearing ?? 45 * SECTOR_ID.indexOf(r.region) + r.angle) * RAD, titan = r.type.startsWith('titan_'), x = offSeam(half(r.rho * Math.sin(b))), z = offSeam(half(-r.rho * Math.cos(b)));
  return Object.freeze({ id: 'w:den:' + r.type, type: r.type, region: r.region, x, z, clear: titan ? 24 : 16, leash: r.leash ?? 30, titan, event: r.event ?? null, level: REGION[r.region].bossLevel });
};
export const DENS = Object.freeze(denRows(RING).map(den));

// ---------------------------------------------------------------- borders
/**
 * Every border as a run, generated from RING, SAFE and the ward, never typed by hand. {type: 'seg', ax, az, bx, bz, nx, nz} or {type: 'arc', r, b0, b1};
 * all have kind, half, length, left, right. (nx, nz) is the unit normal (-dz, dx) of a segment; an arc's normal points outward, so its `left` is the
 * region beyond it. Mind the name: it is "left" in the (x, z) plane with z drawn upward; on a north-up map it is the right hand.
 *   ward     8  the ward outline, cut at the four axis points: half scale (0.995 m)
 *   seam     4  home quarter against home quarter, along an axis, from the ward (the gate road's end on the east) to R1
 *   shared   8  a quarter against a planet: arcs of radius R1
 *   sector   8  planet against planet: radials from R1 to R2
 *   outer    8  the world's edge: arcs of radius R2
 */
const FULL = 1.99, SLIM = FULL / 2;
function seg(ax, az, bx, bz, kind, half) {
  const d = len(bx - ax, bz - az), nx = -(bz - az) / d, nz = (bx - ax) / d, mx = (ax + bx) / 2, mz = (az + bz) / 2;
  return Object.freeze({ type: 'seg', ax, az, bx, bz, kind, half, nx, nz, length: d, left: regionAt(mx + nx * .25, mz + nz * .25), right: regionAt(mx - nx * .25, mz - nz * .25) });
}
function arc(r, b0, b1, kind, half) {
  const m = (b0 + b1) / 2 * RAD, nx = Math.sin(m), nz = -Math.cos(m);
  return Object.freeze({ type: 'arc', r, b0, b1, kind, half, length: r * (b1 - b0) * RAD, left: regionAt((r + .25) * nx, (r + .25) * nz), right: regionAt((r - .25) * nx, (r - .25) * nz) });
}
function makeRuns() {
  const out = [], W = SAFE, wp = [[W.x0, W.z0], [0, W.z0], [W.x1, W.z0], [W.x1, 0], [W.x1, W.z1], [0, W.z1], [W.x0, W.z1], [W.x0, 0]];
  wp.forEach(([ax, az], i) => { const [bx, bz] = wp[(i + 1) % 8]; out.push(seg(ax, az, bx, bz, 'ward', SLIM)); });
  out.push(seg(0, W.z0, 0, -R1, 'seam', FULL), seg(GATE_END, 0, R1, 0, 'seam', FULL), seg(0, W.z1, 0, R1, 'seam', FULL), seg(W.x0, 0, -R1, 0, 'seam', FULL));
  for (let k = 0; k < 8; k++) out.push(arc(R1, 45 * k, 45 * k + 45, 'shared', FULL));
  for (let k = 0; k < 8; k++) { const a = 45 * k * RAD; out.push(seg(R1 * Math.sin(a), -R1 * Math.cos(a), R2 * Math.sin(a), -R2 * Math.cos(a), 'sector', FULL)); }
  for (let k = 0; k < 8; k++) out.push(arc(R2, 45 * k, 45 * k + 45, 'outer', FULL));
  return out;
}
export const BORDER_RUNS = Object.freeze(makeRuns());
/** RUNS_OF[id]: the runs that name the region on either side (a planet 4, a quarter 6, the village its ward runs). */
export const RUNS_OF = Object.freeze(Object.fromEntries(REGION_IDS.map(id => [id, Object.freeze(BORDER_RUNS.filter(r => r.left === id || r.right === id))])));
const kindsOf = (...kinds) => Object.fromEntries(REGION_IDS.map(id => [id, RUNS_OF[id].filter(r => kinds.includes(r.kind))]));
const GRID_RUNS_OF = kindsOf('seam', 'shared', 'sector', 'outer'), SHARED_RUNS_OF = Object.fromEntries(REGION_IDS.map(id => [id, REGION[id].kind === 'land' ? RUNS_OF[id].filter(r => r.kind === 'shared') : []])), SECTOR_RUNS_OF = kindsOf('sector');

// ---------------------------------------------------------------- distances
/** Metres from a point to a run: to a segment as before; to an arc, |rho - r| inside its bearings, else the distance to the nearer end. */
export function runDistance(x, z, r) {
  if (r.type === 'seg') { const dx = r.bx - r.ax, dz = r.bz - r.az, k = Math.max(0, Math.min(1, ((x - r.ax) * dx + (z - r.az) * dz) / (dx * dx + dz * dz))); return len(x - r.ax - dx * k, z - r.az - dz * k); }
  const b = bearingOf(x, z);
  if ((b >= r.b0 && b < r.b1) || (r.b1 === 360 && b === 0)) return Math.abs(len(x, z) - r.r);
  const e = a => len(x - r.r * Math.sin(a * RAD), z + r.r * Math.cos(a * RAD)); return Math.min(e(r.b0), e(r.b1));
}
const least = (x, z, runs) => { let d = Infinity; for (let i = 0; i < runs.length; i++) { const v = runDistance(x, z, runs[i]); if (v < d) d = v; } return d; };
/** Outside the world: metres to the disc. */
const outside = (x, z) => { const d = len(x, z) - R2; return d > 0 ? d : 0; };
/** Inside the world: metres to the nearest border run of the region you are in (any kind). Outside: metres to the disc. */
export function borderDistance(x, z) { const id = regionAt(x, z); return id === null ? outside(x, z) : least(x, z, RUNS_OF[id]); }
/** The same, counting every run but the ward's: 'seam', 'shared', 'sector' and 'outer' (the full-width ribbons). Infinity in the village. */
export function gridBorderDistance(x, z) { const id = regionAt(x, z); return id === null ? outside(x, z) : least(x, z, GRID_RUNS_OF[id]); }
/** Only the 'shared' arcs: how deep a point of a planet is from the home ring. Infinity elsewhere. */
export function homeBorderDistance(x, z) { const id = regionAt(x, z); return id === null ? Infinity : least(x, z, SHARED_RUNS_OF[id]); }
/** Only the 'sector' radials (planet against planet). Infinity in a quarter and the village. */
export function sectorBorderDistance(x, z) { const id = regionAt(x, z); return id === null ? Infinity : least(x, z, SECTOR_RUNS_OF[id]); }
/** 0 inside the region; else the least runDistance over its runs. */
export function distanceToRegion(id, x, z) {
  if (regionAt(x, z) === id) return 0;
  const runs = RUNS_OF[id]; return runs ? least(x, z, runs) : Infinity;
}
/** Metres to the edge of the circle (0 outside). Exact: no notches. */
export const edgeDistance = (x, z) => { const d = R2 - len(x, z); return d > 0 ? d : 0; };
/** Metres past the padded line (R2 - EDGE_PAD): 0 inside, smooth beyond; Infinity for a non-finite point so it stays blocked. */
export const edgeDepth = (x, z) => { const r = len(x, z), L = R2 - EDGE_PAD; return r > L ? r - L : r <= L ? 0 : Infinity; };
/** Inside the circle, and at least `pad` metres from its edge (false for NaN). */
export const inWorld = (x, z, pad = 0) => { const r = R2 - pad; return x * x + z * z < r * r; };
/** Metres along a ray (a unit direction) until the padded circle: analytic. Infinity when farther than `max`, 0 when the start is already outside it or not finite. */
export function edgeAhead(x, z, dirX, dirZ, max = 48, pad = EDGE_PAD) {
  const R = R2 - pad, c = x * x + z * z - R * R; if (!(c < 0)) return 0;
  const b = x * dirX + z * dirZ, t = -b + Math.sqrt(b * b - c); return t > max ? Infinity : t;
}
/** The Beach's sea: the part of `ocean` beyond R2 - SEA_DEPTH. */
export const waterAt = (x, z) => regionAt(x, z) === 'ocean' && len(x, z) > R2 - SEA_DEPTH;

// ---------------------------------------------------------------- trails
const smooth = (x, a, b) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/**
 * How far a trail's centreline lies off its bisector, `along` metres from the origin: Zoo Garden's own wander (cute_game src/biomes.ts trailOffset),
 * applied sideways. `id` is there for a later round.
 */
export const trailOffset = (id, along) => (Math.sin(along * .09) * 3 + Math.sin(along * .23) * 1.2) * smooth(along, 18, 30);
const TRAIL_BEARING = { east: 45, south: 135, west: 225, north: 315 };
/** The centreline of a trail at `along` metres along its bisector, wander included. */
export function trailPoint(id, along, out = { x: 0, z: 0 }) {
  const b = TRAIL_BEARING[id] * RAD, s = Math.sin(b), c = Math.cos(b), o = trailOffset(id, along);
  out.x = s * along + c * o; out.z = -c * along + s * o; return out;
}
// `from` is computed, not typed: the first `along` (steps of 0.25 m) whose whole 2.2 m half width lies outside the ward.
function trailFrom(id) {
  const p = { x: 0, z: 0 };
  for (let a = 0; a < R1; a += .25) { trailPoint(id, a, p); if (!inSafeZone(p.x, p.z, 2.2)) return a; }
  return R1;
}
export const TRAILS = Object.freeze(Object.fromEntries(QUARTER_ID.map(id => [id, Object.freeze({ bearing: TRAIL_BEARING[id], from: trailFrom(id), to: R1 })])));
/** Metres from a point to the nearest trail's centreline (to its end beyond it). */
export function trailDistance(x, z) {
  let best = Infinity;
  for (const id in TRAILS) {
    const t = TRAILS[id], b = t.bearing * RAD, s = Math.sin(b), c = Math.cos(b), u = x * s - z * c, k = Math.max(t.from, Math.min(t.to, u)), o = trailOffset(id, k);
    const d = len(x - (s * k + c * o), z - (-c * k + s * o)); if (d < best) best = d;
  }
  return best;
}
