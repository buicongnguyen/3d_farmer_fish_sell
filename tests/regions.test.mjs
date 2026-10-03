// Round 8: the ward as a shape (ward.mjs) and the map of thirteen squares (regions.mjs). Owner: builder A.
// No test types a ward number: each reads WARD_OUTLINE and SAFE and derives what it expects.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as ward from '../src/ward.mjs';
import * as regions from '../src/regions.mjs';
import * as wilds from '../src/wilds.mjs';
import { VILLAGE, GATE_ROAD } from '../src/field-layout.mjs';

const { SAFE, WARD_OUTLINE, WARD_MARGIN, inSafeZone, wildDepth } = ward;
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const HOME = ['west', 'north', 'south', 'east'], LANDS = ['toy', 'candy', 'jungle', 'ice', 'ocean', 'lava', 'cloud', 'shadow'];
const segment = (x, z, r) => { const dx = r.bx - r.ax, dz = r.bz - r.az, k = Math.max(0, Math.min(1, ((x - r.ax) * dx + (z - r.az) * dz) / (dx * dx + dz * dz))); return Math.hypot(x - r.ax - dx * k, z - r.az - dz * k); };
const lengthOf = r => Math.hypot(r.bx - r.ax, r.bz - r.az);
/** Even-odd point-in-polygon, independent of ward.mjs. */
function inPolygon(x, z, poly) { let inside = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside; } return inside; }
function polygonDepth(x, z, poly) { if (inPolygon(x, z, poly)) return 0; let d = Infinity; for (let i = 0; i < poly.length; i++) { const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length]; d = Math.min(d, segment(x, z, { ax, az, bx, bz })); } return d; }

test('the ward: a rectangle that hugs the village, one export, re-exported by wilds.mjs', () => {
  assert.equal(WARD_OUTLINE.length, 4, 'round 8 supports a rectangle only');
  let area = 0; for (let i = 0; i < 4; i++) { const [ax, az] = WARD_OUTLINE[i], [bx, bz] = WARD_OUTLINE[(i + 1) % 4]; assert.ok(ax === bx || az === bz, 'axis-aligned sides'); area += ax * bz - bx * az; }
  assert.ok(area > 0, 'clockwise on a north-up map (x east, z south)');
  const xs = WARD_OUTLINE.map(p => p[0]), zs = WARD_OUTLINE.map(p => p[1]);
  assert.deepEqual(SAFE, { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) }, 'SAFE is its bounding box');
  for (const [x, z] of WARD_OUTLINE) assert.ok(Math.abs(x) <= 60 && Math.abs(z) <= 60, 'each side keeps 4 m of strip inside the centre cell');
  assert.ok(SAFE.x0 <= VILLAGE.x0 && SAFE.x1 >= VILLAGE.x1 && SAFE.z0 <= VILLAGE.z0 && SAFE.z1 >= VILLAGE.z1, 'it contains the footprint');
  assert.deepEqual(SAFE, { x0: VILLAGE.x0 - WARD_MARGIN, x1: VILLAGE.x1 + WARD_MARGIN, z0: VILLAGE.z0 - WARD_MARGIN, z1: VILLAGE.z1 + WARD_MARGIN });
  // inSafeZone and wildDepth agree with a point-in-polygon test of the outline, on a 1 m grid (off the line itself).
  for (let x = -70.25; x <= 70.25; x += 1) for (let z = -70.25; z <= 70.25; z += 1) {
    assert.equal(inSafeZone(x, z), inPolygon(x, z, WARD_OUTLINE), `inSafeZone at ${x}, ${z}`);
    assert.ok(near(wildDepth(x, z), polygonDepth(x, z, WARD_OUTLINE), 1e-9), `wildDepth at ${x}, ${z}`);
  }
  assert.equal(inSafeZone(SAFE.x1 + 1, 0), false); assert.equal(inSafeZone(SAFE.x1 + 1, 0, 2), true, 'within the pad'); assert.equal(inSafeZone(SAFE.x1 - 1, 0, -2), false, 'a negative pad asks for room inside');
  // The five names still load from wilds.mjs, and they are the same things.
  for (const name of ['WARD_MARGIN', 'SAFE', 'WARD_OUTLINE', 'inSafeZone', 'wildDepth']) assert.equal(wilds[name], ward[name], name);
});

/** Everything that is written in CELL, so that it can be run on a copy with CELL = 256 as well. */
function gridChecks(m) {
  const { CELL, HALF, GRID, GRID_IDS, regionAt, cellIdAt, squareOf, REGION, BORDER_RUNS, RUNS_OF } = m, C = CELL / 2;
  assert.equal(HALF, CELL * 2.5); assert.equal(GRID, 5); assert.equal(CELL % 128, 0, 'tiles are 64 m and creature cells 32 m');
  // The thirteen squares: at their centres, and a line belongs to the square on its +x or +z side.
  let squares = 0;
  for (let row = 0; row < 5; row++) for (let col = 0; col < 5; col++) {
    const id = GRID_IDS[row][col], cx = (col - 2) * CELL, cz = (row - 2) * CELL;
    assert.equal(id !== null, Math.abs(col - 2) + Math.abs(row - 2) <= 2, 'the diamond of the drawing');
    assert.equal(cellIdAt(cx, cz), id);
    if (id === null) { for (const [dx, dz] of [[0, 0], [C - 1, C - 1], [1 - C, 1 - C], [C - 1, 1 - C]]) assert.equal(regionAt(cx + dx, cz + dz), null, `empty cell ${row}, ${col}`); continue; }
    squares++; const s = squareOf(id); assert.deepEqual(s, { x0: cx - C, x1: cx + C, z0: cz - C, z1: cz + C, cx, cz });
    if (id === 'village') continue;
    assert.equal(regionAt(cx, cz), id); assert.equal(regionAt(s.x0, cz), id, 'the west line is its own'); assert.equal(regionAt(cx, s.z0), id, 'the north line is its own'); assert.equal(regionAt(s.x0, s.z0), id, 'and that corner');
    assert.equal(regionAt(s.x1 - 1e-6, s.z1 - 1e-6), id);
  }
  assert.equal(squares, 13); assert.equal(Object.keys(REGION).length, 13);
  // All 36 grid vertices: each belongs to the cell on its +x, +z side.
  let vertices = 0;
  for (let i = 0; i <= 5; i++) for (let k = 0; k <= 5; k++) { const x = i * CELL - HALF, z = k * CELL - HALF, id = GRID_IDS[k]?.[i] ?? null; assert.equal(cellIdAt(x, z), id); if ([[i, k], [i - 1, k], [i, k - 1], [i - 1, k - 1]].some(([c, r]) => GRID_IDS[r]?.[c])) vertices++; }
  assert.equal(vertices, 24, '24 grid vertices touch the world');
  for (const [x, z] of [[HALF + 1, 0], [-HALF - 1, 0], [0, HALF + 1], [0, -HALF - 1], [HALF, 0], [0, HALF], [1e4, 1e4]]) assert.equal(regionAt(x, z), null, 'beyond the grid');
  // The centre cell: the ward is the village, the rest belongs to the four home regions by side.
  assert.equal(regionAt(0, 0), 'village');
  const mid = { north: [(SAFE.x0 + SAFE.x1) / 2, SAFE.z0 - 1], south: [(SAFE.x0 + SAFE.x1) / 2, SAFE.z1 + 1], west: [SAFE.x0 - 1, (SAFE.z0 + SAFE.z1) / 2], east: [SAFE.x1 + 1, (SAFE.z0 + SAFE.z1) / 2] };
  for (const id of HOME) { assert.equal(regionAt(...mid[id]), id, `1 m outside the ${id} side`); assert.equal(regionAt(mid[id][0] * .9, mid[id][1] * .9), 'village'); }
  const area = { village: 0, west: 0, north: 0, south: 0, east: 0 }, step = .5;
  for (let x = -C + step / 2; x < C; x += step) for (let z = -C + step / 2; z < C; z += step) { const id = regionAt(x, z); assert.ok(id in area, `the centre cell holds only the village and the home regions (${id} at ${x}, ${z})`); area[id] += step * step; }
  assert.ok(near(Object.values(area).reduce((a, b) => a + b, 0), CELL * CELL, 1e-6));
  const wardArea = (SAFE.x1 - SAFE.x0) * (SAFE.z1 - SAFE.z0); assert.ok(Math.abs(area.village - wardArea) < 120, 'the village region is the ward');
  // Each strip is the trapezoid between its side of the ward and its side of the cell.
  const trapezoid = (a, b, h) => (a + b) / 2 * h;
  assert.ok(Math.abs(area.west - trapezoid(SAFE.z1 - SAFE.z0, CELL, SAFE.x0 + C)) < 60); assert.ok(Math.abs(area.east - trapezoid(SAFE.z1 - SAFE.z0, CELL, C - SAFE.x1)) < 60);
  assert.ok(Math.abs(area.north - trapezoid(SAFE.x1 - SAFE.x0, CELL, SAFE.z0 + C)) < 60); assert.ok(Math.abs(area.south - trapezoid(SAFE.x1 - SAFE.x0, CELL, C - SAFE.z1)) < 60);

  // ---- the border runs
  const kinds = k => BORDER_RUNS.filter(r => r.kind === k), perimeter = WARD_OUTLINE.reduce((n, [ax, az], i) => { const [bx, bz] = WARD_OUTLINE[(i + 1) % WARD_OUTLINE.length]; return n + Math.hypot(bx - ax, bz - az); }, 0);
  assert.deepEqual([kinds('shared').length, kinds('outer').length, kinds('ward').length, kinds('seam').length, BORDER_RUNS.length], [12, 20, WARD_OUTLINE.length, 4, 36 + WARD_OUTLINE.length]);
  const seamLength = kinds('seam').reduce((n, r) => n + lengthOf(r), 0), total = BORDER_RUNS.reduce((n, r) => n + lengthOf(r), 0);
  assert.ok(near(total, 32 * CELL + perimeter + seamLength, 1e-6), 'grid runs + the ward outline + the seams');
  const pairs = kinds('shared').map(r => [r.left, r.right].sort((a, b) => HOME.includes(b) - HOME.includes(a)).join('-')).sort();
  assert.deepEqual(pairs, ['east-cloud', 'east-ocean', 'east-shadow', 'north-ice', 'north-ocean', 'north-toy', 'south-candy', 'south-cloud', 'south-lava', 'west-candy', 'west-jungle', 'west-toy']);
  for (const r of BORDER_RUNS) {
    const mx = (r.ax + r.bx) / 2, mz = (r.az + r.bz) / 2;
    assert.ok(near(Math.hypot(r.nx, r.nz), 1) && near(r.nx * (r.bx - r.ax) + r.nz * (r.bz - r.az), 0), 'a unit normal');
    assert.equal(regionAt(mx + r.nx * .5, mz + r.nz * .5), r.left); assert.equal(regionAt(mx - r.nx * .5, mz - r.nz * .5), r.right);
    assert.equal(r.half, r.kind === 'shared' || r.kind === 'outer' ? 1.99 : .995);
    if (r.kind === 'shared') { assert.ok(HOME.includes(r.left) !== HOME.includes(r.right) && LANDS.includes(r.left) !== LANDS.includes(r.right), 'a home region against a land: no two lands share a run'); assert.ok(near(lengthOf(r), CELL)); }
    if (r.kind === 'outer') { assert.ok((r.left === null) !== (r.right === null)); assert.ok(LANDS.includes(r.left ?? r.right), 'only lands have outer sides'); assert.ok(near(lengthOf(r), CELL)); }
    if (r.kind === 'ward') { assert.equal(r.left, 'village'); assert.ok(HOME.includes(r.right)); }
    if (r.kind === 'seam') {
      assert.ok(HOME.includes(r.left) && HOME.includes(r.right) && r.left !== r.right);
      assert.ok(near(Math.abs(r.ax), C) && near(Math.abs(r.az), C), 'it starts at a corner of the centre cell');
      assert.ok(WARD_OUTLINE.some(([x, z]) => x === r.bx && z === r.bz), 'and ends on a ward vertex');
    }
    // No run lies on a side of the centre cell: a home region runs across it into its strip.
    if (r.kind !== 'seam') assert.ok(!((Math.abs(r.ax) === C && r.ax === r.bx && Math.abs(r.az) <= C && Math.abs(r.bz) <= C) || (Math.abs(r.az) === C && r.az === r.bz && Math.abs(r.ax) <= C && Math.abs(r.bx) <= C)), 'not a side of the centre cell');
  }
  assert.deepEqual(kinds('ward').map(r => r.right), ['north', 'east', 'south', 'west']);
  assert.deepEqual(kinds('seam').map(r => [r.left, r.right].sort().join('-')), ['north-west', 'east-north', 'east-south', 'south-west']);
  for (const id of HOME) assert.equal(RUNS_OF[id].length, 6, `${id}: three grid runs, its side of the ward, two seams`);
  for (const id of LANDS) assert.equal(RUNS_OF[id].length, 4); assert.equal(RUNS_OF.village.length, WARD_OUTLINE.length);
  // On each side of each seam, the two regions it names.
  for (const r of kinds('seam')) for (const t of [.2, .5, .8]) { const x = r.ax + (r.bx - r.ax) * t, z = r.az + (r.bz - r.az) * t; assert.equal(regionAt(x + r.nx, z + r.nz), r.left); assert.equal(regionAt(x - r.nx, z - r.nz), r.right); }
  return { perimeter, seamLength, total };
}

test('regionAt, the squares and the border runs, as the grid is drawn', () => {
  const { regionAt, CELL, DENS, REGION } = regions, sums = gridChecks(regions);
  assert.equal(CELL, 128);
  assert.equal(regionAt(227, -185), null, 'the King Bear’s old den is outside the world');
  // The numbers the spec prints, recomputed: 409 m of ward ribbon, seams of 15.88 and 23.72 m, 4,584.2 m in all.
  assert.ok(near(sums.perimeter, 409, .01)); assert.ok(near(sums.seamLength, 79.2, .05)); assert.ok(near(sums.total, 4584.2, .05));
  const seams = regions.BORDER_RUNS.filter(r => r.kind === 'seam').map(lengthOf).map(v => v.toFixed(2)); assert.deepEqual(seams, ['15.88', '15.88', '23.72', '23.72']);
  // The table of 1.2.
  const want = { village: [0, 0], west: [-128, 0], north: [0, -128], south: [0, 128], east: [128, 0], toy: [-128, -128], candy: [-128, 128], jungle: [-256, 0], ice: [0, -256], ocean: [128, -128], lava: [0, 256], cloud: [128, 128], shadow: [256, 0] };
  for (const [id, [cx, cz]] of Object.entries(want)) { const s = regions.squareOf(id); assert.deepEqual([s.cx, s.cz], [cx, cz], id); }
  // The regions' facts: level = 3 d - 2, boss level + 6, stars by difficulty; the names of 3.1 and 3.2.
  assert.deepEqual(Object.values(REGION).map(r => `${r.id}:${r.kind}:${r.planet}:${r.difficulty}:${r.level}:${r.bossLevel}:${r.stars}`), ['village:village:0:0:0:0:0', 'west:home:0:1:1:7:1', 'north:home:0:2:4:10:2', 'south:home:0:1:1:7:1', 'east:home:0:3:7:13:3',
    'toy:land:1:2:4:10:2', 'candy:land:2:3:7:13:3', 'jungle:land:3:3:7:13:3', 'ice:land:4:4:10:16:4', 'ocean:land:5:4:10:16:4', 'lava:land:6:5:13:19:4', 'cloud:land:7:5:13:19:4', 'shadow:land:8:6:16:22:5']);
  assert.deepEqual(Object.values(REGION).map(r => r.name), ['Willowmere', 'Mushroom Forest', 'Chomper Swamp', 'Blue Lake Meadow', 'Redrock Canyon', 'Toybox Land', 'Candy Land', 'Wild Jungle', 'Frost Land', 'Shell Beach', 'Ember Fields', 'Cloud Meadow', 'Night Land']);
  for (const r of Object.values(REGION)) { assert.match(r.ground, /^#[0-9a-f]{6}$/); assert.match(r.accent, /^#[0-9a-f]{6}$/); }
  // The dens: 26, each in its own region, 36 m or more from every grid border, 56 m or more from the next, off every 32 m cell seam.
  assert.equal(DENS.length, 26); assert.equal(new Set(DENS.map(d => d.id)).size, 26);
  assert.deepEqual(DENS.filter(d => d.titan).map(d => d.type), ['titan_turtle', 'titan_clock', 'titan_hydra', 'titan_flower', 'titan_crystal', 'titan_kraken', 'titan_scorpion', 'titan_whale', 'titan_eye']);
  for (const d of DENS) {
    assert.equal(d.id, 'w:den:' + d.type); assert.equal(regionAt(d.x, d.z), d.region, d.id); assert.equal(d.clear, d.titan ? 24 : 16); assert.equal(d.level, REGION[d.region].bossLevel); assert.equal(d.event, d.type === 'dragon' ? 'dragon' : null);
    assert.ok(regions.gridBorderDistance(d.x, d.z) >= 36, `${d.id} is ${regions.gridBorderDistance(d.x, d.z)} m from a grid border`); assert.ok(d.x % 32 !== 0 && d.z % 32 !== 0, 'off every cell seam');
    for (const o of DENS) if (o !== d) assert.ok(Math.hypot(o.x - d.x, o.z - d.z) >= 56, `${d.id} and ${o.id}`);
    assert.equal(d.leash, ['cake', 'gingerbread', 'jellyqueen', 'yeti', 'mammoth', 'frostowl', 'golem', 'dragon'].includes(d.type) ? 24 : 30);
  }
  assert.deepEqual(DENS.slice(0, 5).map(d => [d.type, d.x, d.z]), [['treant', -152, 26], ['croc', 26, -152], ['mushking', -26, 152], ['bear', 152, -26], ['titan_turtle', 112, 28]]);
  assert.deepEqual(DENS.filter(d => d.region === 'lava').map(d => [d.type, d.x, d.z]), [['golem', -28, 228], ['dragon', 28, 228], ['titan_scorpion', 28, 284]]);
  // The ward moves no den: the home bosses are 95.5 to 110.5 m beyond it, the Mountain Turtle 55.5 m.
  assert.deepEqual(DENS.slice(0, 5).map(d => +wildDepth(d.x, d.z).toFixed(1)), [95.5, 102, 110.5, 95.5, 55.5]);
  assert.equal(wilds.DEN, DENS.find(d => d.type === 'bear'), 'wilds.mjs DEN is the bear’s row');
});

test('distances: to a border, to a full ribbon, to the home side, to the edge', () => {
  const { BORDER_RUNS, RUNS_OF, regionAt, borderDistance, gridBorderDistance, homeBorderDistance, edgeDistance, inWorld, inWilds, squareOf, CELL, HALF, EDGE_PAD, RIM_REACH } = regions;
  assert.equal(EDGE_PAD, 2); assert.equal(RIM_REACH, 1.25 * CELL);
  // 0 on every run (in the region on either side), and wildDepth just outside a ward side.
  for (const r of BORDER_RUNS) for (const t of [.1, .5, .9]) { const x = r.ax + (r.bx - r.ax) * t, z = r.az + (r.bz - r.az) * t; for (const side of [1e-7, -1e-7]) if (regionAt(x + r.nx * side, z + r.nz * side) !== null) assert.ok(borderDistance(x + r.nx * side, z + r.nz * side) < 1e-5, `${r.kind} ${r.left}|${r.right}`); }
  for (const [x, z] of [[SAFE.x1 + 3, 5], [SAFE.x0 - 2.5, -10], [3, SAFE.z0 - 4], [-20, SAFE.z1 + 6]]) assert.ok(near(borderDistance(x, z), wildDepth(x, z), 1e-9));
  assert.ok(near(borderDistance(SAFE.x1 - 5, 0), 5), 'inside the ward: to the ward line');
  // gridBorderDistance: the nearest 'shared' or 'outer' run of the region, never a side line extended past where a run exists.
  const brute = (x, z, kinds) => Math.min(...RUNS_OF[regionAt(x, z)].filter(r => kinds.includes(r.kind)).map(r => segment(x, z, r)));
  let checked = 0;
  for (const id of HOME) { const s = squareOf(id); for (let x = Math.min(s.x0, -CELL / 2) + 1; x < Math.max(s.x1, CELL / 2); x += 2) for (let z = Math.min(s.z0, -CELL / 2) + 1; z < Math.max(s.z1, CELL / 2); z += 2) { if (regionAt(x, z) !== id) continue; checked++; assert.ok(near(gridBorderDistance(x, z), brute(x, z, ['shared', 'outer']), 1e-9), `${id} at ${x}, ${z}`); } }
  assert.ok(checked > 16000, `${checked} points of the home regions, strips included`);
  assert.equal(regionAt(-56.09, 41.72), 'south'); assert.ok(near(gridBorderDistance(-56.09, 41.72), 23.64, .01), 'the distance to a run, not 7.91 m by the side lines');
  assert.equal(gridBorderDistance(0, 0), Infinity, 'the village has no full ribbon'); assert.ok(near(gridBorderDistance(SAFE.x1 + 1, 0), Math.hypot(CELL / 2 - SAFE.x1 - 1, CELL / 2)), 'a metre outside the ward: the ward and the seams are ignored, the nearest full ribbon begins at the cell’s corner');
  for (const id of LANDS) { const s = squareOf(id); for (const [dx, dz] of [[10, 30], [100, 64], [64, 120]]) { const x = s.x0 + dx, z = s.z0 + dz; assert.ok(near(gridBorderDistance(x, z), Math.min(x - s.x0, s.x1 - x, z - s.z0, s.z1 - z)), `${id}: in a land, the least distance to its square’s sides`); } }
  // homeBorderDistance: 0 on a land's shared sides, and not 0 on its outer sides.
  const lava = squareOf('lava'); assert.ok(homeBorderDistance(0, lava.z0 + 1e-7) < 1e-5); assert.ok(homeBorderDistance(0, lava.z1 - 2) > 100, 'two metres inside the south edge the home border is far');
  assert.ok(near(homeBorderDistance(0, lava.z0 + 24), 24)); assert.ok(near(homeBorderDistance(lava.x0 + 2, lava.cz), CELL / 2), 'beside an outer side: still measured to the shared one');
  const toy = squareOf('toy'); assert.ok(homeBorderDistance(toy.cx, toy.z1 - 1e-7) < 1e-5 && homeBorderDistance(toy.x1 - 1e-7, toy.cz) < 1e-5 && homeBorderDistance(toy.x0 + 1, toy.z0 + 1) > 100);
  assert.equal(homeBorderDistance(1e4, 0), Infinity);
  // Outside the world: metres to the nearest in-world square.
  assert.ok(near(borderDistance(HALF + 10, 0), 10)); assert.ok(near(borderDistance(-CELL * 1.5 - 3, -CELL / 2 - 4), 3), 'in a notch: 3 m from the Toybox, 4 m from the Jungle');
  assert.ok(near(borderDistance(CELL * 1.5 + 3, CELL * 1.5 + 4), 5), 'round the corner of a diagonal land');
  // edgeDistance: to the nearest empty cell or to ±HALF, round at a notch's corner, 0 outside.
  assert.ok(near(edgeDistance(HALF - 3, 0), 3)); assert.ok(near(edgeDistance(0, -HALF + 7), 7)); assert.equal(edgeDistance(HALF + 1, 0), 0); assert.equal(edgeDistance(-CELL * 2, -CELL * 2), 0);
  const notch = [-CELL * 1.5, -CELL / 2]; // the corner of the empty cell between the Jungle and the Toybox
  assert.ok(near(edgeDistance(notch[0] + 3, notch[1] + 4), 5), 'Euclidean: the corner is round'); assert.ok(near(edgeDistance(notch[0] + 3, notch[1] - 10), 3)); assert.ok(near(edgeDistance(notch[0] - 10, notch[1] + 4), 4));
  assert.ok(edgeDistance(0, 0) > CELL);
  assert.equal(inWorld(notch[0] + 1, notch[1] + 1), true); assert.equal(inWorld(notch[0] + 1, notch[1] + 1, EDGE_PAD), false); assert.equal(inWorld(notch[0] + 2, notch[1] + 2, EDGE_PAD), true); assert.equal(inWorld(notch[0] - 1, notch[1] - 1), false);
  // inWilds: inside the world and not in the village (so: not inSafeZone there).
  for (let x = -HALF - 16; x <= HALF + 16; x += 16) for (let z = -HALF - 16; z <= HALF + 16; z += 16) assert.equal(inWilds(x + .5, z + .5), regionAt(x + .5, z + .5) !== null && !inSafeZone(x + .5, z + .5));
  assert.equal(inWilds(0, 0), false); assert.equal(inWilds(SAFE.x1 + 1, 0), true); assert.equal(inWilds(HALF + 5, 0), false);
});

test('edgeAhead measures to the padded world, the line that blocks', () => {
  const { edgeAhead, inWorld, HALF, EDGE_PAD } = regions;
  // Straight at the east edge from 30 m inside it: 28 m to the block line.
  assert.ok(near(edgeAhead(HALF - 30, 0, 1, 0), 28, .05)); assert.equal(edgeAhead(HALF - 30, 0, -1, 0), Infinity, 'driving away from it');
  assert.equal(edgeAhead(HALF - 60, 0, 1, 0), Infinity, 'farther than the 48 m look-ahead'); assert.equal(edgeAhead(0, 0, 1, 0), Infinity);
  assert.equal(edgeAhead(HALF - 1, 0, 1, 0), 0, 'already inside the pad');
  // At 10 degrees to the edge the block line is met 28 / sin(10°) m along the ray: beyond the look-ahead from 30 m, in reach from 9 m.
  const a = 10 * Math.PI / 180; assert.equal(edgeAhead(HALF - 30, 0, Math.sin(a), Math.cos(a)), Infinity); assert.ok(near(edgeAhead(HALF - 9, 0, Math.sin(a), Math.cos(a)), 7 / Math.sin(a), .05));
  // The ray from (-161.29, -94) heading south-west passes within half a metre of the notch corner (-192, -64): it never leaves the
  // world, yet it passes inside the pad, so the answer is finite, and the point it names is the last one in the padded world.
  const d = Math.SQRT1_2, hit = edgeAhead(-161.29, -94, -d, d); assert.ok(Number.isFinite(hit) && hit > 30 && hit < 48, `${hit}`);
  assert.equal(regions.regionAt(-161.29 - d * 60, -94 + d * 60) !== null, true, 'the ray itself stays in the world');
  assert.equal(inWorld(-161.29 - d * hit, -94 + d * hit, EDGE_PAD), true); assert.equal(inWorld(-161.29 - d * (hit + .1), -94 + d * (hit + .1), EDGE_PAD), false);
  // A wider pad is met sooner.
  assert.ok(edgeAhead(HALF - 30, 0, 1, 0, 48, 5) < edgeAhead(HALF - 30, 0, 1, 0, 48, 2));
});

test('the four trails: the reference’s wander, from the ward line to the far side of each home square', () => {
  const { trailOffset, trailDistance, TRAILS, CELL, DENS } = regions;
  assert.equal(TRAILS.east.from, GATE_ROAD.x1, 'the east trail starts where the gate’s road ends'); assert.equal(TRAILS.west.from, -SAFE.x0); assert.equal(TRAILS.north.from, -SAFE.z0); assert.equal(TRAILS.south.from, SAFE.z1);
  for (const id of HOME) assert.equal(TRAILS[id].to, CELL * 1.5, 'trails stop at the planet border');
  // cute_game src/biomes.ts trailOffset: (sin(0.09 t) * 3 + sin(0.23 t) * 1.2), eased in between 18 and 30 m.
  assert.equal(trailOffset('east', 10), 0); assert.ok(near(trailOffset('east', 90), Math.sin(8.1) * 3 + Math.sin(20.7) * 1.2)); assert.ok(near(trailOffset('east', 90), 4.06, .01)); assert.equal(trailOffset('west', 90), trailOffset('east', 90));
  let lo = Infinity, hi = -Infinity; for (let x = 64; x <= 192; x += .1) { lo = Math.min(lo, trailOffset('east', x)); hi = Math.max(hi, trailOffset('east', x)); } assert.ok(near(lo, -3.70, .02) && near(hi, 4.18, .02), `the canyon’s trail wanders ${lo.toFixed(2)} to ${hi.toFixed(2)} m`);
  // On a trail the distance is 0; beside it, the sideways distance; beyond its end, the distance to the end.
  assert.ok(trailDistance(100, trailOffset('east', 100)) < 1e-9); assert.ok(trailDistance(-100, trailOffset('west', 100)) < 1e-9); assert.ok(trailDistance(trailOffset('north', 100), -100) < 1e-9); assert.ok(trailDistance(trailOffset('south', 100), 100) < 1e-9);
  assert.ok(near(trailDistance(100, trailOffset('east', 100) + 7), 7)); assert.ok(near(trailDistance(CELL * 1.5 + 10, trailOffset('east', CELL * 1.5)), 10)); assert.ok(trailDistance(0, 0) > 40, 'no trail inside the ward');
  // The Mountain Turtle's den is clear of the east trail: 29.1 m from its centreline (spec 4.1).
  const turtle = DENS.find(d => d.type === 'titan_turtle'); let least = Infinity; for (let x = 67; x <= 192; x += .05) least = Math.min(least, Math.hypot(x - turtle.x, trailOffset('east', x) - turtle.z));
  assert.ok(near(least, 29.12, .05), `${least.toFixed(2)} m`); assert.ok(least - 2.2 >= 26, 'the trail’s near edge is 26 m or more from the den');
});

test('a copy with CELL = 256 keeps every assertion that is written in CELL', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'willowmere-regions-'));
  try {
    const source = readFileSync(new URL('../src/regions.mjs', import.meta.url), 'utf8'); assert.match(source, /export const CELL = 128;/);
    writeFileSync(join(dir, 'regions.mjs'), source.replace('export const CELL = 128;', 'export const CELL = 256;'));
    writeFileSync(join(dir, 'ward.mjs'), readFileSync(new URL('../src/ward.mjs', import.meta.url), 'utf8'));
    const big = await import(pathToFileURL(join(dir, 'regions.mjs')).href);
    assert.equal(big.CELL, 256); assert.equal(big.HALF, 640); gridChecks(big);
    assert.equal(big.regionAt(227, -185), 'ocean', 'in the wider world the old den is back inside');
    for (const d of big.DENS) assert.equal(big.regionAt(d.x, d.z), d.region, `${d.id} follows its square`);
    assert.ok(near(big.edgeAhead(big.HALF - 30, 0, 1, 0), 28, .05)); assert.equal(big.TRAILS.east.to, 384); assert.equal(big.RIM_REACH, 320);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
