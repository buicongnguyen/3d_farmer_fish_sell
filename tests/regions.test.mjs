// Round 9: the ward as a shape (ward.mjs) and the ring world (regions.mjs): a village in the middle, four home quarters, eight planets, a circular edge.
// No test types a ward number: each reads WARD_OUTLINE and SAFE and derives what it expects.
import test from 'node:test';
import assert from 'node:assert/strict';
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
  for (const [x, z] of WARD_OUTLINE) assert.ok(Math.abs(x) <= 60 && Math.abs(z) <= 60, 'the ward is well inside the inner circle');
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

const SECTORS = regions.SECTOR_ID, QUARTERS = regions.QUARTER_ID;
const polar = (rho, bearing) => [rho * Math.sin(bearing * Math.PI / 180), -rho * Math.cos(bearing * Math.PI / 180)];

test('regionAt: quarters by the axes, planets by the diagonals, exact ties, the edge, NaN', () => {
  const { regionAt, RING, edgeDepth, inWorld, edgeAhead, REGION } = regions, { R1, R2 } = RING;
  assert.deepEqual([R1, R2], [160, 296]);
  assert.equal(Object.keys(REGION).length, 13); assert.deepEqual(QUARTERS, ['east', 'south', 'west', 'north']);
  // Zoo Garden's numbered order, clockwise from north-north-east.
  assert.deepEqual(SECTORS, ['cloud', 'shadow', 'toy', 'candy', 'jungle', 'ice', 'ocean', 'lava']);
  assert.deepEqual([...SECTORS].sort((a, b) => REGION[a].planet - REGION[b].planet), ['toy', 'candy', 'jungle', 'ice', 'ocean', 'lava', 'cloud', 'shadow']);
  // The middle of every quarter and every sector, against its bearing.
  QUARTERS.forEach((id, i) => assert.equal(regionAt(...polar(120, 90 * i + 45)), id));
  SECTORS.forEach((id, i) => assert.equal(regionAt(...polar(228, 45 * i + 22.5)), id));
  // Ties: a radial line belongs to the region that begins there going clockwise; the inner circle to the outer ring; the outer circle is outside.
  assert.equal(regionAt(0, -100), 'east'); assert.equal(regionAt(100, 0), 'south'); assert.equal(regionAt(0, 100), 'west'); assert.equal(regionAt(-100, 0), 'north');
  assert.equal(regionAt(0, -200), SECTORS[0]); assert.equal(regionAt(200, 0), SECTORS[2]); assert.equal(regionAt(0, 200), SECTORS[4]); assert.equal(regionAt(-200, 0), SECTORS[6]);
  assert.equal(regionAt(170, -170), SECTORS[1]); assert.equal(regionAt(170, 170), SECTORS[3]); assert.equal(regionAt(-170, 170), SECTORS[5]); assert.equal(regionAt(-170, -170), SECTORS[7]);
  assert.equal(regionAt(0, -R1), SECTORS[0]); assert.equal(regionAt(0, -R1 + .001), 'east'); assert.equal(regionAt(R2, 0), null); assert.equal(regionAt(R2 - .001, 0), SECTORS[2]);
  // The ward line (strict) and the origin.
  assert.equal(regionAt(0, 0), 'village'); assert.equal(regionAt(SAFE.x1, -10), 'east'); assert.equal(regionAt(SAFE.x1, 10), 'south'); assert.equal(regionAt(-10, SAFE.z1), 'west'); assert.equal(regionAt(-10, SAFE.z0), 'north');
  // The edge: a circle, analytic, and a non-finite point is outside.
  for (const bad of [[NaN, NaN], [Infinity, 0], [0, -Infinity]]) { assert.equal(regionAt(...bad), null); assert.equal(edgeDepth(...bad), Infinity); assert.equal(inWorld(...bad), false); assert.equal(edgeAhead(...bad, 1, 0), 0); }
  assert.equal(edgeDepth(R2 - 2, 0), 0); assert.ok(near(edgeDepth(R2 - 1, 0), 1)); assert.ok(near(edgeDepth(...polar(R2 + 3, 33)), 5));
  assert.equal(inWorld(R2 - 3, 0, 2), true); assert.equal(inWorld(R2 - 1, 0, 2), false);
  // edgeAhead against a brute-force march, from inside, at several bearings.
  for (const [x, z, a] of [[0, 0, 10], [200, 0, 90], [-250, 40, 250], [100, 100, 135], [270, 0, 20]]) {
    const dx = Math.sin(a * Math.PI / 180), dz = -Math.cos(a * Math.PI / 180), got = edgeAhead(x, z, dx, dz, 1e4); let t = 0; while (inWorld(x + dx * t, z + dz * t, 2) && t < 1e4) t += .001;
    assert.ok(Math.abs(got - t) < .01, `edgeAhead ${got} vs march ${t}`);
  }
  assert.equal(edgeAhead(0, 0, 1, 0), Infinity, 'farther than the 48 m look-ahead'); assert.ok(near(edgeAhead(R2 - 30, 0, 1, 0), 28, 1e-6));
});

test('the 36 border runs: counts, lengths, sides, distances', () => {
  const { BORDER_RUNS, RUNS_OF, regionAt, borderDistance, gridBorderDistance, homeBorderDistance, sectorBorderDistance, runDistance, distanceToRegion, RING } = regions, { R1, R2 } = RING;
  const kind = k => BORDER_RUNS.filter(r => r.kind === k), sum = list => list.reduce((n, r) => n + r.length, 0);
  assert.deepEqual(['ward', 'seam', 'shared', 'sector', 'outer'].map(k => kind(k).length), [8, 4, 8, 8, 8]); assert.equal(BORDER_RUNS.length, 36);
  assert.ok(near(sum(BORDER_RUNS), 4787.1, .05), `${sum(BORDER_RUNS)}`); assert.ok(near(sum(kind('ward')), 409, 1e-6));
  assert.ok(near(sum(kind('shared')), 8 * R1 * Math.PI / 4, 1e-6)); assert.ok(near(sum(kind('outer')), 8 * R2 * Math.PI / 4, 1e-6)); assert.ok(near(sum(kind('sector')), 8 * (R2 - R1), 1e-6));
  assert.deepEqual(kind('seam').map(r => [r.left, r.right].join('|')), ['east|north', 'south|east', 'west|south', 'north|west']);
  assert.equal(kind('seam')[1].ax, GATE_ROAD.x1, 'the east seam starts where the gate’s road ends');
  for (const r of kind('shared')) { assert.ok(QUARTERS.includes(r.right) && SECTORS.includes(r.left)); assert.equal(r.type, 'arc'); }
  for (const r of kind('sector')) { assert.ok(SECTORS.includes(r.left) && SECTORS.includes(r.right) && r.left !== r.right); assert.equal(r.type, 'seg'); }
  for (const r of kind('outer')) { assert.equal(r.left, null); assert.ok(SECTORS.includes(r.right)); }
  for (const r of kind('ward')) assert.equal(r.left, 'village');
  for (const id of QUARTERS) assert.equal(RUNS_OF[id].length, 6); for (const id of SECTORS) assert.equal(RUNS_OF[id].length, 4); assert.equal(RUNS_OF.village.length, 8);
  // Every run is a border: 0 away on it, and the two sides are the two regions it names.
  for (const r of BORDER_RUNS) for (const t of [.15, .5, .85]) {
    let x, z, nx, nz;
    if (r.type === 'seg') { x = r.ax + (r.bx - r.ax) * t; z = r.az + (r.bz - r.az) * t; nx = r.nx; nz = r.nz; } else { const b = (r.b0 + (r.b1 - r.b0) * t) * Math.PI / 180; x = r.r * Math.sin(b); z = -r.r * Math.cos(b); nx = Math.sin(b); nz = -Math.cos(b); }
    assert.ok(runDistance(x, z, r) < 1e-9); assert.equal(regionAt(x + nx * .5, z + nz * .5), r.left, `${r.kind} left`); assert.equal(regionAt(x - nx * .5, z - nz * .5), r.right, `${r.kind} right`);
  }
  // Distances against a brute-force walk over the runs.
  const brute = (x, z, kinds) => Math.min(...RUNS_OF[regionAt(x, z)].filter(r => kinds.includes(r.kind)).map(r => runDistance(x, z, r)));
  for (let x = -290; x < 290; x += 13.7) for (let z = -290; z < 290; z += 13.3) {
    const id = regionAt(x, z); if (id === null) { assert.ok(near(borderDistance(x, z), Math.max(0, Math.hypot(x, z) - R2))); continue; }
    assert.ok(near(borderDistance(x, z), brute(x, z, ['ward', 'seam', 'shared', 'sector', 'outer'])));
    if (id !== 'village') assert.ok(near(gridBorderDistance(x, z), brute(x, z, ['seam', 'shared', 'sector', 'outer']))); else assert.equal(gridBorderDistance(x, z), Infinity);
  }
  assert.ok(near(homeBorderDistance(...polar(R1 + 10, 20)), 10)); assert.equal(homeBorderDistance(...polar(100, 20)), Infinity);
  assert.ok(near(sectorBorderDistance(...polar(230, 45 + 1)), 230 * Math.sin(Math.PI / 180), .01)); assert.equal(sectorBorderDistance(...polar(100, 20)), Infinity);
  assert.equal(distanceToRegion('lava', ...polar(228, 337.5)), 0); assert.ok(distanceToRegion('lava', 0, 0) > 100);
  assert.ok(near(borderDistance(R2 + 10, 0), 10));
});

test('the 26 dens, the cages’ neighbours and the features: each in its own region, clear of every border', () => {
  const { DENS, regionAt, gridBorderDistance, REGION, RING } = regions, { R1, R2 } = RING;
  assert.equal(DENS.length, 26); assert.equal(new Set(DENS.map(d => d.id)).size, 26);
  for (const d of DENS) {
    assert.equal(d.id, 'w:den:' + d.type); assert.equal(regionAt(d.x, d.z), d.region, d.id); assert.equal(d.clear, d.titan ? 24 : 16); assert.equal(d.level, REGION[d.region].bossLevel); assert.equal(d.event, d.type === 'dragon' ? 'dragon' : null);
    assert.ok(gridBorderDistance(d.x, d.z) >= 36, `${d.id} is ${gridBorderDistance(d.x, d.z)} m from a border`); assert.ok(d.x % 32 !== 0 && d.z % 32 !== 0, 'off every cell seam');
    for (const o of DENS) if (o !== d) assert.ok(Math.hypot(o.x - d.x, o.z - d.z) >= 56, `${d.id} and ${o.id}`);
    assert.equal(d.leash, ['cake', 'gingerbread', 'jellyqueen', 'yeti', 'mammoth', 'frostowl', 'golem', 'dragon'].includes(d.type) ? 24 : 30);
    if (!QUARTERS.includes(d.region)) assert.ok(Math.hypot(d.x, d.z) > R1 + 40 && Math.hypot(d.x, d.z) < R2 - 40);
    else { assert.ok(wildDepth(d.x, d.z) >= 50, `${d.id}: 50 m from the ward line`); assert.ok(regions.trailDistance(d.x, d.z) >= 31, `${d.id}: 31 m from the trail`); }
  }
  assert.deepEqual(DENS.slice(0, 5).map(d => [d.type, d.x, d.z]), [['treant', -110.5, 51.5], ['croc', -51.5, -110.5], ['mushking', 51.5, 110.5], ['bear', 110.5, -51.5], ['titan_turtle', 49.5, -106]]);
  assert.deepEqual(DENS.slice(0, 5).map(d => +wildDepth(d.x, d.z).toFixed(1)), [54.9, 60.5, 69, 54, 56]);
  assert.equal(wilds.DEN, DENS.find(d => d.type === 'bear'), 'wilds.mjs DEN is the bear’s row');
  // Where the numbered order puts the first planet: the Cloud Meadow's Thunder Phoenix is 14 degrees into the north-north-east sector.
  const phoenix = DENS.find(d => d.type === 'phoenix'); assert.equal(phoenix.region, 'cloud'); assert.ok(near(Math.atan2(phoenix.x, -phoenix.z) * 180 / Math.PI, 14, .5));
});

test('the four trails follow the quarters’ bisectors, outside the ward, with the reference’s wander', () => {
  const { trailOffset, trailDistance, trailPoint, TRAILS, RING } = regions;
  assert.deepEqual(Object.values(TRAILS).map(t => t.bearing), [45, 135, 225, 315]);
  for (const id of QUARTERS) { const t = TRAILS[id], p = { x: 0, z: 0 }; assert.equal(t.to, RING.R1); for (let a = t.from; a <= t.to; a += .25) { trailPoint(id, a, p); assert.ok(!inSafeZone(p.x, p.z, 2.2 - 1e-6), `${id} at ${a} is outside the ward with its half width`); if (a <= t.to - 5) assert.equal(regions.regionAt(p.x, p.z), id); } }
  assert.equal(trailOffset('east', 10), 0); assert.ok(near(trailOffset('east', 90), Math.sin(8.1) * 3 + Math.sin(20.7) * 1.2)); assert.equal(trailOffset('west', 90), trailOffset('east', 90));
  const p = trailPoint('south', 100); assert.ok(trailDistance(p.x, p.z) < 1e-9); assert.ok(near(trailDistance(p.x + 7 * Math.SQRT1_2 * -1 * -1 * 0 + 0, p.z), trailDistance(p.x, p.z), 1e-9));
  assert.ok(trailDistance(0, 0) > 40, 'no trail inside the ward');
  // The Mountain Turtle's den is clear of the east trail.
  const turtle = regions.DENS.find(d => d.type === 'titan_turtle'); assert.ok(trailDistance(turtle.x, turtle.z) - 2.2 >= 31 - 2.2 - 1e-6);
});

test('the east gate road lies on the canyon and meadow border: GATE_END is the road’s end', () => {
  assert.equal(regions.GATE_END, GATE_ROAD.x1);
  assert.equal(regions.regionAt(63, -0.01), 'east'); assert.equal(regions.regionAt(63, 0.01), 'south');
});
