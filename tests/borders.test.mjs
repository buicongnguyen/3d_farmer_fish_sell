// The rainbow borders and the banner's words (round 8, builder A): the pure halves of src/borders.mjs and src/region-banner.mjs.
// Nothing here types a number of the ward: every expectation is derived from WARD_OUTLINE, SAFE, BORDER_RUNS and ROADS.
import test from 'node:test';
import assert from 'node:assert/strict';
import { borderQuads, gridKnots, RAINBOW, RIBBON } from '../src/borders.mjs';
import { BORDER_RUNS, REGION, DENS, CELL, HALF, cellIdAt, regionAt } from '../src/regions.mjs';
import { WARD_OUTLINE, SAFE } from '../src/ward.mjs';
import { ROADS, PARKING } from '../src/content.mjs';
import { bannerText, BANNER_SECONDS } from '../src/region-banner.mjs';
import { MIX } from '../src/region-mix.mjs';
import { CREATURES } from '../src/wilds.mjs';

const quads = borderQuads(), STRIPS = 11;
const area = q => { let a = 0; for (let i = 0; i < 4; i++) { const [x0, z0] = q.corners[i], [x1, z1] = q.corners[(i + 1) % 4]; a += x0 * z1 - x1 * z0; } return Math.abs(a) / 2; };
const distanceToRun = (x, z, r) => { const dx = r.bx - r.ax, dz = r.bz - r.az, k = Math.max(0, Math.min(1, ((x - r.ax) * dx + (z - r.az) * dz) / (dx * dx + dz * dz))); return Math.hypot(x - r.ax - dx * k, z - r.az - dz * k); };

test('the ribbon is one mesh of 468 quads: eleven strips a run, a knot at every grid vertex of the world and every ward vertex', () => {
  assert.equal(BORDER_RUNS.length, 40);
  assert.equal(gridKnots().length, 24);
  assert.equal(quads.length, STRIPS * BORDER_RUNS.length + gridKnots().length + WARD_OUTLINE.length);
  assert.equal(quads.length * 2, 936, 'triangles');
  // Every grid knot touches the world; none of the twelve outer lattice corners is one.
  for (const [x, z] of gridKnots()) assert.ok([[-1, -1], [1, -1], [-1, 1], [1, 1]].some(([sx, sz]) => cellIdAt(x + sx, z + sz) !== null), `${x},${z}`);
  assert.equal(gridKnots().some(([x, z]) => Math.abs(x) === HALF && Math.abs(z) === HALF), false);
  // Flat on the ground, knots a millimetre above the ribbons they join.
  const ribbons = quads.slice(0, STRIPS * BORDER_RUNS.length), knots = quads.slice(STRIPS * BORDER_RUNS.length);
  assert.ok(ribbons.every(q => q.y === RIBBON.y) && knots.every(q => q.y === RIBBON.knotY && q.color === '#ffffff') && RIBBON.knotY > RIBBON.y && RIBBON.y > .004);
  assert.deepEqual(knots.map(area).map(a => Math.round(a * 100) / 100).sort((a, b) => a - b), [...Array(4).fill(4.84), ...Array(24).fill(19.36)], '2.2 m ward knots and 4.4 m grid knots');
});

test('each run’s strips: white edges, the accent of the region on each side, seven rainbow stripes; full width on grid runs, half on the ward and the seams', () => {
  assert.equal(RAINBOW.length, 7);
  assert.ok(Math.abs(RIBBON.edge * 2 + RIBBON.side * 2 + RIBBON.stripe * 7 - RIBBON.width) < 1e-9, '0.2 + 0.6 + 7 x 0.34 + 0.6 + 0.2 = 3.98');
  let length = 0;
  BORDER_RUNS.forEach((run, i) => {
    const strips = quads.slice(i * STRIPS, (i + 1) * STRIPS), full = run.kind === 'shared' || run.kind === 'outer', cut = full ? RIBBON.cut : RIBBON.slimCut, long = Math.hypot(run.bx - run.ax, run.bz - run.az);
    assert.equal(run.half, full ? RIBBON.width / 2 : RIBBON.width / 4);
    assert.deepEqual(strips.map(q => q.color), ['#ffffff', run.left ? REGION[run.left].accent : '#ffffff', ...RAINBOW, run.right ? REGION[run.right].accent : '#ffffff', '#ffffff'], `${run.kind} ${run.left} | ${run.right}`);
    if (run.kind === 'outer') assert.ok((run.left === null) !== (run.right === null), 'white beyond the world, the land’s accent inside');
    // The first strip lies on the run's left (the side of its normal), and every corner within the ribbon's half-width of the run.
    const [x, z] = strips[1].corners[0], side = (x - run.ax) * run.nx + (z - run.az) * run.nz; assert.ok(side > 0, 'the left accent is on the left');
    for (const q of strips) for (const [cx, cz] of q.corners) assert.ok(distanceToRun(cx, cz, run) <= run.half + 1e-9);
    // Shortened at both ends, so crossing ribbons meet under a knot and never overlap.
    const total = strips.reduce((sum, q) => sum + area(q), 0); assert.ok(Math.abs(total - (long - 2 * cut) * run.half * 2) < 1e-6, `${run.kind}: ${total}`);
    length += long;
  });
  const perimeter = WARD_OUTLINE.reduce((sum, [x, z], i) => { const [bx, bz] = WARD_OUTLINE[(i + 1) % WARD_OUTLINE.length]; return sum + Math.hypot(bx - x, bz - z); }, 0);
  const seams = BORDER_RUNS.filter(r => r.kind === 'seam').reduce((sum, r) => sum + Math.hypot(r.bx - r.ax, r.bz - r.az), 0);
  assert.ok(Math.abs(length - (32 * CELL + perimeter + seams)) < 1e-6, `${length} m of border`);
});

test('the ward’s ribbon hugs the ring road without touching it: its inner edge is a metre outside the asphalt and the parking', () => {
  const slim = RIBBON.width / 4, road = ROADS.width ?? 5;
  // West, south and east: the ward line is 2 m outside the road's outer edge, the ribbon 0.995 m wide inside the line.
  assert.ok(SAFE.x1 - slim >= ROADS.east + road / 2 + 1 && -SAFE.x0 - slim >= -ROADS.west + road / 2 + 1 && SAFE.z1 - slim >= ROADS.south + road / 2 + 1, 'a metre of grass between the asphalt and the ribbon');
  assert.ok(SAFE.x1 - slim >= PARKING.x1 + 1, 'and a metre clear of the supermarket’s bays');
  // A full ribbon there would reach the asphalt: that is why the ward's is half scale.
  assert.ok(SAFE.x1 - RIBBON.width / 2 < ROADS.east + road / 2 + 1);
  // Every ward quad lies within 1 m of the ward's own line; inside it is the village, outside a home region.
  for (const run of BORDER_RUNS.filter(r => r.kind === 'ward')) { assert.equal(run.left, 'village'); assert.equal(REGION[run.right].kind, 'home'); }
  for (const run of BORDER_RUNS.filter(r => r.kind === 'seam')) assert.ok(REGION[run.left].kind === 'home' && REGION[run.right].kind === 'home' && run.left !== run.right);
});

test('the banner’s words: the village, a peaceful region with the box shut, creatures and bosses with it open, red from four stars', () => {
  assert.equal(BANNER_SECONDS, 2.8);
  assert.deepEqual(bannerText('village', true), { name: 'Willowmere', detail: 'Home, at last', chip: 'Safe', danger: false });
  assert.deepEqual(bannerText('village', false), bannerText('village', true));
  assert.equal(bannerText(null, true), null); assert.equal(bannerText('nowhere', false), null);
  for (const id of Object.keys(REGION).filter(id => id !== 'village')) {
    const r = REGION[id], shut = bannerText(id, false), open = bannerText(id, true);
    assert.deepEqual(shut, { name: r.name, detail: '', chip: `Peaceful · Lv ${r.level}+ when the box is open`, danger: false });
    assert.equal(open.name, r.name); assert.equal(open.danger, r.stars >= 4); assert.ok(open.chip.includes('★'.repeat(r.stars) + ' · Lv ' + r.level + '+'));
    assert.equal(open.chip.startsWith('Dangerous · '), r.stars >= 4);
    // The first three kinds of the region's mix, by name; a den's creature only once its row exists.
    const names = MIX[id].map(([type]) => CREATURES[type]?.name).filter(Boolean).slice(0, 3);
    assert.equal(open.detail, names.length ? `Wild creatures: ${names.join(', ')}` : '');
    const boss = DENS.find(d => d.region === id && !d.titan && !d.event), titan = DENS.find(d => d.region === id && d.titan);
    assert.equal(open.chip.includes('👑'), !!CREATURES[boss.type]); assert.equal(open.chip.includes('🔱'), !!(titan && CREATURES[titan.type]));
  }
  assert.ok(bannerText('east', true).chip.startsWith('★★★ · Lv 7+ · 👑 King Bear')); // the Mountain Turtle joins it when its row exists
  assert.equal(regionAt(SAFE.x0 - 1, 0), 'west'); assert.equal(bannerText(regionAt(SAFE.x0 - 1, 0), false).name, 'Mushroom Forest');
});
