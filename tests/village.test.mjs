// The compact village (round 7): six houses and four lodgings, market row with the atelier's stall, a footprint and a
// ward that hug the ring road, trees that keep their saved indexes, lanes for the villagers and their strolls.
import test from 'node:test';
import assert from 'node:assert/strict';
import { HOUSES, HOMES, RESIDENTS, CIVIC, ROADS, POND, FISH_SPOT, MARKET, ATELIER, GREEN, GATE, WOODLAND, WORKPLACE, RACE_POINTS, ORCHARD_POSITIONS, BED_POSITIONS, WORKSHOP, WEST_LANE, FIELD_LANE } from '../src/content.mjs';
import { VILLAGE, inVillage, fieldPlan, HOMESTEAD } from '../src/field-layout.mjs';
import { SAFE, WARD_MARGIN, inSafeZone } from '../src/wilds.mjs';
import { villageTrees, livingTrees, villageTufts, villageFlowers, reserved, lawn, gatherSpots, OLD_TREES, BLOCKS, STALL, GROVE, blockedAt, inBlock, firstBlock } from '../src/village-plan.mjs';
import { LOTS, BACK_HOMES, LANES_GRAVEL, lotOf, frontOf, toWorld, onLotPath, HALF_DEPTH } from '../src/lots.mjs';
import { wildCell, wildDepth } from '../src/wilds.mjs';
import { regionAt } from '../src/regions.mjs';
import { LANES, lanePath, laneDistance, nearestNode, pathLength, placeOf, placesOf, slotOf, pickTrip, tripsOf, greeting, hello, TRIP } from '../src/villagers.mjs';
import { freshState, act, parseSave } from '../src/game.mjs';

const who = id => RESIDENTS.find(p => p.id === id), far = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
/** A seeded 0–1 generator, so the samples are the same on every run. */
const seeded = (seed = 7) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const day = (time, extra = {}) => ({ time, pandora: false, hired: {}, ...extra });

test('six houses, ten households, twenty-four residents: the four southern families lodge in village buildings', () => {
  // ids are the indexes saves and code know (HOUSES[resident.home]); nothing shifted.
  assert.deepEqual(HOUSES.map(h => h.id), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]); assert.deepEqual(HOUSES.map(h => h.family), ['Rowan', 'Alder', 'Bell', 'Moss', 'Reed', 'Finch', 'Hearth', 'Vale', 'Brook', 'Linden']);
  assert.deepEqual(HOMES.map(h => h.id), [0, 1, 2, 4, 5, 7], 'the houses that stand and can be entered');
  assert.deepEqual(Object.fromEntries(HOUSES.filter(h => h.lodge).map(h => [h.id, h.lodge])), { 3: 'barn', 6: 'bakery', 8: 'school', 9: 'hospital' });
  // No house stands outside the ring any more: all six are inside it.
  for (const h of HOMES) assert.ok(h.z > ROADS.north && h.z < ROADS.south && h.x > ROADS.west && h.x < ROADS.east, h.name);
  // Everyone is still here, in the household they always belonged to.
  assert.equal(RESIDENTS.length + 1, 24);
  assert.deepEqual(Object.fromEntries(['mara', 'oren', 'wren', 'hugo', 'nell', 'cora', 'milo', 'sylvie', 'hazel'].map(id => [id, who(id).home])), { mara: 3, oren: 3, wren: 3, hugo: 6, nell: 6, cora: 8, milo: 8, sylvie: 9, hazel: 9 });
  for (const p of RESIDENTS) assert.ok(HOUSES[p.home], p.id);
  // Home for a lodger is the door of their building: the barn by the pen, the bakery by the green, the school, the clinic.
  const building = { barn: { x: 28, z: -19.5 }, bakery: { x: 27, z: 20 }, school: CIVIC[0], hospital: CIVIC[1] };
  for (const p of RESIDENTS) {
    const h = HOUSES[p.home], home = placeOf(p, 'home'), yard = placeOf(p, 'yard');
    assert.equal(home.inside, true); assert.equal(yard.inside, false); assert.ok(far(home, yard) < 12, `${p.id}: the yard is by the door`);
    if (h.lodge) { assert.ok(far(home, building[h.lodge]) < 9, `${p.id} lives at the ${h.lodge}`); assert.match(home.where, /barn|bakery|schoolhouse|clinic/); }
    else assert.ok(far(home, h) < 7, `${p.id} lives at the ${h.family} house`);
  }
  // Work: a Town Square building, the atelier's stall (Iris) or the market (Hugo); every such place has a spot.
  for (const [id, place] of Object.entries(WORKPLACE)) assert.ok(placeOf(who(id), place), `${id} works at ${place}`);
  assert.equal(WORKPLACE.iris, 'stall'); assert.ok(far(placeOf(who('iris'), 'stall'), ATELIER) < 4.5, 'Iris stands by her stall');
  // Friendships, hiring and the story know the same people as before.
  const s = freshState(); for (const p of RESIDENTS) { assert.ok(act(s, 'talk', { id: p.id }).ok); }
  assert.equal(Object.keys(s.met).length, 23); assert.ok(act(s, 'hire', { id: 'mara', job: 'herder' }).ok); assert.ok(act(s, 'hire', { id: 'hugo', job: 'farmhand' }).ok); assert.equal(act(s, 'hire', { id: 'wren', job: 'gardener' }).ok, false);
  const back = parseSave(JSON.parse(JSON.stringify(s))); assert.deepEqual(back.met, s.met); assert.deepEqual(back.hired, s.hired); assert.equal(back.friendship.cora, 1);
});

test('market row: the atelier’s stall stands beside the village market, with room to stand and no tree near', () => {
  assert.equal(ATELIER.z, MARKET.z); const gap = far(MARKET, ATELIER); assert.ok(gap > STALL.market.size / 2 + STALL.atelier.size / 2 + 1 && gap < 9, `side by side (${gap.toFixed(1)} m apart)`);
  assert.ok(far(ATELIER, HOMESTEAD) < far({ x: -35, z: 9 }, HOMESTEAD), 'nearer home than it was by the Finch house'); assert.ok(Math.abs(ATELIER.x) < 15, 'just off the homestead lane');
  for (const stall of [MARKET, ATELIER]) {
    const stand = { x: stall.x, z: stall.z + 2.3 };
    assert.equal(blockedAt(stand.x, stand.z), false, 'you can stand at the counter'); assert.equal(blockedAt(stall.x, stall.z), true, 'the stall itself is solid');
    assert.equal(reserved(stand.x, stand.z), true, 'kept clear of trees');
    for (const t of livingTrees()) assert.ok(far(t, stand) > .42 * t.s + 1.35 + 2, 'no tree in reach of the counter');
  }
});

test('the footprint hugs the ring road and the Town Square, and the ward hugs the footprint', () => {
  // West, south and east: the footprint ends a metre beyond the outer edge of the ring road (the road with the yellow dashes),
  // and the ward a metre beyond that: 2 m from the road, never more than 3. North: behind the Town Square and the grove's trees.
  const back = Math.min(...CIVIC.map(c => c.z - c.d / 2)), outer = { west: ROADS.west - 2.5, east: ROADS.east + 2.5, south: ROADS.south + 2.5 };
  const margin = { west: outer.west - VILLAGE.x0, east: VILLAGE.x1 - outer.east, south: VILLAGE.z1 - outer.south }, ward = { west: outer.west - SAFE.x0, east: SAFE.x1 - outer.east, south: SAFE.z1 - outer.south };
  for (const [side, m] of Object.entries(margin)) assert.ok(m >= .5 && m <= 2, `${side} verge ${m.toFixed(1)} m`);
  for (const [side, m] of Object.entries(ward)) assert.ok(m >= 1.5 && m <= 3, `the ward is ${m.toFixed(1)} m beyond the ${side} road’s outer edge`);
  assert.ok(back - VILLAGE.z0 >= 3 && back - VILLAGE.z0 <= 7 && back - SAFE.z0 <= 7, 'north: just behind the Town Square'); assert.ok(GROVE.z0 - SAFE.z0 >= 1 && GROVE.z0 - SAFE.z0 <= 4, 'and behind the grove');
  assert.ok(WARD_MARGIN <= 2);
  assert.ok((VILLAGE.x1 - VILLAGE.x0) * (VILLAGE.z1 - VILLAGE.z0) < 132 * 128 * .66, 'a third smaller than the old 132 x 128 footprint');
  assert.deepEqual(SAFE, { x0: VILLAGE.x0 - WARD_MARGIN, x1: VILLAGE.x1 + WARD_MARGIN, z0: VILLAGE.z0 - WARD_MARGIN, z1: VILLAGE.z1 + WARD_MARGIN });
  // Everything the village offers is inside the footprint.
  const things = [...HOMES, ...CIVIC, ...gatherSpots(), WOODLAND, ...RACE_POINTS, ...ORCHARD_POSITIONS, ...BED_POSITIONS, FISH_SPOT, GREEN, MARKET, ATELIER, HOMESTEAD, ...BLOCKS];
  for (const t of things) assert.ok(inVillage(t.x, t.z), `${t.name ?? t.id ?? ''} at ${t.x},${t.z}`);
  // The east gate stands where the spur leaves the ring road for the open fields: inside the footprint and the ward. No trip
  // starts there any more; a save left out on the spur wakes on the ring road beside it.
  assert.ok(inVillage(GATE.x, GATE.z) && inSafeZone(GATE.x, GATE.z, -1)); assert.ok(GATE.x > ROADS.east && GATE.x < ROADS.east + 4); assert.ok(inVillage(GATE.back.x, GATE.back.z), 'where a save left on the spur wakes');
  // The old south row (z 54) and the old woodland corner are open fields now.
  for (const [x, z] of [[-30, 54], [10, 54], [30, 54], [-10, 54], [-58, 50]]) assert.equal(inVillage(x, z), false);
});

test('the open fields fill the freed land right up to the footprint, and keep off the gate’s road', () => {
  // Round 8: the grass blades are gone; a tile's ground cover is its cards (field-layout.mjs fieldCards), counted here in their place.
  const trees = [], grass = [];
  for (let cx = -2; cx <= 1; cx++) for (let cz = -2; cz <= 1; cz++) { const plan = fieldPlan(cx, cz); assert.deepEqual(plan.grass, []); trees.push(...plan.trees); grass.push(...plan.cards); }
  for (const p of [...trees, ...grass]) { assert.equal(inVillage(p.x, p.z), false); assert.ok(!(p.x > 52 && p.x < 67 && Math.abs(p.z) < 4), 'nothing on the road out of the east gate'); }
  // Land the old footprint (|x| < 66, |z| < 64) kept bare of field grass is planted now.
  const freed = p => Math.abs(p.x) < 66 && Math.abs(p.z) < 64;
  assert.ok(grass.filter(freed).length > 100, `grass on the freed belt (${grass.filter(freed).length})`); assert.ok(trees.filter(freed).length >= 6, `trees on the freed belt (${trees.filter(freed).length})`);
  assert.ok(grass.filter(p => p.z > 44 && p.z < 64 && Math.abs(p.x) < 45).length >= 12, 'where the four houses stood');
  // No bare seam: walking round the village just outside the footprint, every stretch of 30 m has field grass within 12 m of the edge,
  // and just inside it the village's own tufts, flowers or trees take over.
  const edge = [], step = 30;
  for (let x = VILLAGE.x0; x < VILLAGE.x1; x += step) { edge.push({ x0: x, x1: x + step, z0: VILLAGE.z0 - 12, z1: VILLAGE.z0 }, { x0: x, x1: x + step, z0: VILLAGE.z1, z1: VILLAGE.z1 + 12 }); }
  for (let z = VILLAGE.z0; z < VILLAGE.z1; z += step) { edge.push({ x0: VILLAGE.x0 - 12, x1: VILLAGE.x0, z0: z, z1: z + step }, { x0: VILLAGE.x1, x1: VILLAGE.x1 + 12, z0: z, z1: z + step }); }
  // A stretch is read 3 m past each end: builder B's real tables are sparse in places (Redrock Canyon: 45 dry bushes and 42 pebbles a
  // 64 m tile, against step 0's 100 tufts), and the east gate's trail keeps its own clearance, so a piece just past a stretch's end counts.
  const within = (r, p) => r.x1 - r.x0 > 12 ? p.x >= r.x0 - 3 && p.x < r.x1 + 3 && p.z >= r.z0 && p.z < r.z1 : p.x >= r.x0 && p.x < r.x1 && p.z >= r.z0 - 3 && p.z < r.z1 + 3;
  for (const r of edge) assert.ok(grass.some(p => within(r, p)) || trees.some(p => within(r, p)), `field scenery by the edge at ${r.x0},${r.z0}`);
  const own = [...villageTufts(), ...villageFlowers(), ...livingTrees()];
  // West, south and east the road itself is the edge (a metre of verge): the village's own scenery comes up to the road's inner side.
  for (const side of ['north', 'south', 'west', 'east']) {
    const band = p => side === 'north' ? p.z < VILLAGE.z0 + 6 : side === 'south' ? p.z > ROADS.south - 2.5 - 9 : side === 'west' ? p.x < ROADS.west + 2.5 + 9 : p.x > ROADS.east - 2.5 - 9;
    assert.ok(own.filter(band).length >= 8, `the village’s own scenery reaches its ${side} edge (${own.filter(band).length})`);
  }
});

test('trees keep the indexes saves know them by; those the compact village has no room for are simply gone', () => {
  const trees = villageTrees(); assert.equal(trees, villageTrees(), 'made once');
  // The first 129 are the old village's trees, exactly: a checksum of their places and sizes, and a few known ones.
  let sum = 0; for (const t of trees.slice(0, OLD_TREES)) for (const v of [t.x, t.z, t.s]) sum = (Math.imul(sum, 31) + Math.round(v * 1000)) | 0;
  assert.equal(sum, -1545086089); assert.equal(OLD_TREES, 129);
  assert.ok(Math.abs(trees[0].x + 15.2998) < 1e-3 && Math.abs(trees[0].z + 52.0052) < 1e-3 && trees[0].kind === 'tree_round'); assert.deepEqual([trees[119].x, trees[119].z, trees[119].kind], [-27, -5, 'tree_round']); assert.deepEqual([trees[127].x, trees[127].z, trees[127].kind], [31, 2, 'tree_blossom']);
  // Gone: outside the footprint, or on something the new layout keeps clear. Living: inside, and (the scattered ones) off the reserved ground.
  trees.forEach((t, i) => {
    if (t.gone) { if (i < 119) assert.ok(!inVillage(t.x, t.z) || reserved(t.x, t.z) || Math.min(t.x - VILLAGE.x0, VILLAGE.x1 - t.x, t.z - VILLAGE.z0, VILLAGE.z1 - t.z) < .6, `tree ${i}`); return; }
    assert.ok(inVillage(t.x, t.z), `tree ${i} stands in the village`); if (i < 119) assert.equal(reserved(t.x, t.z), false, `tree ${i}`);
  });
  assert.equal(trees[0].gone, true, 'the far north belt is open fields'); assert.ok(trees[119].gone && !trees[127].gone, 'the trees on the family land stay, but for the one the Field Lane now runs over');
  const living = livingTrees(); assert.ok(living.length >= 45 && living.length <= 110, `${living.length} trees`); assert.equal(trees.length - OLD_TREES, 28 + 16, 'the trees planted in round 7 come after the old ones and keep their indexes; the West Lane’s sixteen come last');
  assert.ok(trees.slice(OLD_TREES + 28).every(t => !t.gone && inVillage(t.x, t.z) && t.x < -25));
  // Of those, the ones on the old verge beyond the road are outside the tight footprint now, and one stood where the Vale barn is: gone, not renumbered.
  trees.slice(OLD_TREES, OLD_TREES + 28).forEach((t, k) => assert.equal(!!t.gone, !inVillage(t.x, t.z) || Math.abs(t.x - VILLAGE.x0) < .6 || Math.abs(t.z - VILLAGE.z1) < .6 || Math.abs(t.x - VILLAGE.x1) < .6 || reserved(t.x, t.z) && t.x < -30 && t.z > 20, `new tree ${OLD_TREES + k} at ${t.x},${t.z}`));
  assert.deepEqual([trees[129].x, trees[129].z], [-55.2, -45.6]); assert.deepEqual([trees[156].x, trees[156].z], [-46.9, 32.4]);
  // No tree steals the E key: nothing you use lies within a tree's own reach (its trunk plus 1.35 m).
  const spots = [...gatherSpots(), WOODLAND, GATE, FISH_SPOT, GREEN, { x: MARKET.x, z: MARKET.z + 2.2 }, { x: ATELIER.x, z: ATELIER.z + 2.3 }, ...ORCHARD_POSITIONS, ...BED_POSITIONS, ...CIVIC.map(c => ({ x: c.x, z: c.z + c.d / 2 + 1.8 })), { x: HOMES[0].x, z: HOMES[0].z + 5 }, ...LOTS.flatMap(l => l.back ? [l.door, l.back] : [l.door]), WORKSHOP, { x: 17, z: -13 }, { x: 12, z: -13 }];
  for (const t of living) for (const s of spots) assert.ok(far(t, s) > .42 * t.s + 1.35, `a tree at ${t.x.toFixed(1)},${t.z.toFixed(1)} is in reach of the spot at ${s.x},${s.z}`);
  // A save that cleared trees which are gone now still loads, and its other trees are the same trees.
  const s = freshState(); s.cleared = [0, 3, 119, 127]; assert.deepEqual(parseSave(JSON.parse(JSON.stringify(s))).cleared, [0, 3, 119, 127]);
});

test('tufts and flowers: inside the footprint, off the roads and lanes, the same every time', () => {
  const tufts = villageTufts(), flowers = villageFlowers(); assert.equal(tufts, villageTufts());
  assert.ok(tufts.length >= 210 && tufts.length <= 400, `${tufts.length} tufts (the larger pond replaces some grass)`); assert.ok(flowers.length >= 30 && flowers.length <= 90, `${flowers.length} flowers`);
  for (const t of [...tufts, ...flowers]) assert.ok(inVillage(t.x, t.z));
  for (const f of flowers) assert.equal(reserved(f.x, f.z, 1), false);
  for (const t of tufts) { assert.ok(!(Math.abs(t.x) < 2.2 && t.z > -12 && t.z < ROADS.south), 'not on the front lane'); assert.ok(!(Math.abs(t.z - ROADS.south) < 2.5 || Math.abs(t.z - ROADS.north) < 2.5 && Math.abs(t.x) < ROADS.east), 'not on the road'); assert.equal(inBlock(t.x, t.z), false, 'not inside a building'); }
  for (const f of flowers) assert.equal(inBlock(f.x, f.z), false);
  assert.equal(lawn(MARKET.x, MARKET.z + 1), false); assert.equal(lawn(ATELIER.x, ATELIER.z + 2), false); assert.equal(lawn(27, 20), false, 'the bakery'); assert.equal(lawn(-3.5, 2), true);
});

test('the lanes: one connected net inside the village, clear of buildings and trees, reaching every villager’s spots', () => {
  assert.ok(LANES.ids.length >= 40);
  for (const [a, b] of LANES.edges) { assert.ok(LANES.nodes[a] && LANES.nodes[b], `${a}-${b}`); assert.equal(firstBlock(LANES.nodes[a], LANES.nodes[b]), null, `the lane ${a}-${b} is clear`); }
  for (const id of LANES.ids) { const n = LANES.nodes[id]; assert.ok(inVillage(n.x, n.z), id); for (const other of LANES.ids) assert.ok(laneDistance(id, other) < 320, `${id} to ${other}`); }
  assert.equal(laneDistance('s0', 's0'), 0); assert.ok(Math.abs(laneDistance('row0', 'row1') - MARKET.x) < 1e-9); assert.equal(nearestNode(MARKET.x, 27), 'row1');
  const taken = new Map();
  for (const p of RESIDENTS) for (const key of placesOf(p)) {
    const s = placeOf(p, key); assert.ok(s, `${p.id} has a spot at ${key}`); assert.equal(s.key, key); assert.ok(s.where, `${p.id} ${key} has a name`);
    assert.equal(blockedAt(s.x, s.z), false, `${p.id} at ${key} (${s.x.toFixed(1)}, ${s.z.toFixed(1)}) stands free`); assert.ok(inVillage(s.x, s.z) && inSafeZone(s.x, s.z, -3), `${p.id} at ${key} is well inside the ward`);
    assert.ok(LANES.nodes[s.via], `${p.id} ${key}: lane node ${s.via}`); assert.equal(firstBlock(s, LANES.nodes[s.via]), null, `${p.id}: the way from ${key} to the lane is clear`);
    // Where the timetable sends several at once, each has a place of their own.
    if (['yard', 'market', 'green', 'schoolyard', 'stall'].includes(key)) { const at = `${key}:${Math.round(s.x * 2)}:${Math.round(s.z * 2)}`; assert.ok(!taken.has(at), `${p.id} and ${taken.get(at)} share a spot at ${key}`); taken.set(at, p.id); }
  }
  assert.equal(placeOf(who('ada'), 'porch:1'), null, 'nobody calls at their own gate'); assert.equal(placeOf(who('ada'), 'nowhere'), null);
});

test('a walk follows the lanes from door to door, and never crosses a building or a tree', () => {
  const random = seeded(11), onLane = (a, b) => LANES.edges.some(([m, n]) => (LANES.nodes[m] === a && LANES.nodes[n] === b) || (LANES.nodes[n] === a && LANES.nodes[m] === b));
  for (let i = 0; i < 400; i++) {
    const p = RESIDENTS[Math.floor(random() * RESIDENTS.length)], keys = placesOf(p), from = placeOf(p, keys[Math.floor(random() * keys.length)]), to = placeOf(p, keys[Math.floor(random() * keys.length)]);
    const path = lanePath(from, to); assert.deepEqual(path.at(-1), { x: to.x, z: to.z }); assert.ok(path.length <= 22);
    let at = from; for (const [k, step] of path.entries()) { assert.equal(firstBlock(at, step), null, `${p.id} ${from.key} -> ${to.key}, leg ${k}`); if (k > 0 && k < path.length - 1) assert.ok(onLane(at, step), 'the middle of a walk is all lanes'); at = step; }
    assert.ok(pathLength(from, path) >= far(from, to) - 1e-9); assert.ok(pathLength(from, path) < 260, `${p.id} ${from.key} -> ${to.key}: ${pathLength(from, path).toFixed(0)} m`);
  }
  // The same door: straight there. Turned round in the middle of a lane: the walk starts from the nearest corner.
  const ada = who('ada'); assert.equal(lanePath(placeOf(ada, 'home'), placeOf(ada, 'yard')).length, 1);
  const mid = lanePath({ x: 0, z: 20 }, placeOf(ada, 'market')); assert.ok(mid.length <= 3 && firstBlock({ x: 0, z: 20 }, mid[0]) === null);
  // The lanes are shorter than going round by the ring: Ada to the market crosses the fields' north side.
  assert.ok(pathLength(placeOf(ada, 'home'), lanePath(placeOf(ada, 'home'), placeOf(ada, 'market'))) < 110);
});

test('the timetable: school, work in the Town Square, Iris at her stall, home at night; a hired neighbour works for you', () => {
  for (const p of RESIDENTS.filter(p => p.child)) { assert.equal(slotOf(p, day(9.6)), 'school'); assert.equal(slotOf(p, day(12)), 'schoolyard'); assert.equal(slotOf(p, day(21)), 'home'); assert.equal(placeOf(p, 'schoolyard').inside, false); }
  assert.equal(slotOf(who('iris'), day(10)), 'stall'); assert.equal(slotOf(who('iris'), day(14.5)), 'stall'); assert.equal(placeOf(who('iris'), 'stall').inside, false);
  assert.equal(slotOf(who('hugo'), day(10)), 'market'); assert.equal(slotOf(who('cora'), day(10)), 'school'); assert.equal(slotOf(who('hazel'), day(10)), 'hospital'); assert.equal(slotOf(who('pearl'), day(14.5)), 'police');
  for (const p of RESIDENTS) { assert.ok(['home', 'yard'].includes(slotOf(p, day(22))), `${p.id} at 22:00`); assert.ok(placeOf(p, slotOf(p, day(22)))); for (let t = 7; t <= 22; t += .25) assert.ok(placeOf(p, slotOf(p, day(t))), `${p.id} at ${t}`); }
  assert.equal(slotOf(who('oren'), day(10, { hired: { oren: 'farmhand' } })), 'job:farmhand'); assert.equal(slotOf(who('oren'), day(20, { hired: { oren: 'farmhand' } })), 'home');
  // The lodgers who work where they live do not walk to work: the same door.
  assert.deepEqual(placeOf(who('cora'), 'home'), { ...placeOf(who('cora'), 'school'), key: 'home', where: 'the schoolhouse' }); assert.ok(far(placeOf(who('hazel'), 'home'), placeOf(who('hazel'), 'hospital')) < 1e-9);
});

test('strolls: anyone may walk to the market, the stall, the green, the pond or a neighbour, and the Pandora box changes none of it', () => {
  const random = seeded(5); assert.deepEqual(Object.keys(TRIP).filter(k => /open/i.test(k)), [], 'no limits for an open box');
  for (const p of RESIDENTS) for (const time of [9, 13, 16, 20, 22]) {
    const at = placeOf(p, slotOf(p, day(time))), seen = new Set();
    for (let i = 0; i < 40; i++) {
      const key = pickTrip(p, day(time), at, random); if (!key) continue; seen.add(key);
      const to = placeOf(p, key); assert.ok(to && !to.inside, 'a stroll ends out of doors'); assert.notEqual(key, at.key); assert.ok(far(to, at) >= (key === 'yard' ? 1.5 : 6));
      const path = lanePath(at, to); assert.ok(pathLength(at, path) <= TRIP.reach);
      assert.ok(tripsOf(p, day(time)).includes(key));
    }
    if (p.child && time >= 18.5) assert.deepEqual([...seen], at.key === 'yard' ? [] : ['yard'], `${p.id}: after dark a child only slips out to the yard`); else assert.ok(seen.size >= 2, `${p.id} at ${time}: ${[...seen].join(', ')}`);
  }
  // By day the grown-ups' haunts are the market, the atelier's stall, the green, the pond lane and two neighbours' gates.
  const all = new Set(); for (const p of RESIDENTS.filter(p => !p.child)) for (const key of tripsOf(p, day(13))) all.add(key.split(':')[0]);
  assert.deepEqual([...all].sort(), ['atelier', 'green', 'market', 'pond', 'porch']);
  // Already at the market: somewhere else.
  const nell = who('nell'), market = placeOf(nell, 'market'); for (let i = 0; i < 30; i++) assert.notEqual(pickTrip(nell, day(13), market, random), 'market');
  // Open or shut, the same villager at the same moment picks the same stroll (same dice), children included, and no walk is longer than TRIP.reach.
  let walks = 0, kids = 0;
  for (const p of RESIDENTS) for (const time of [9, 13, 16, 20, 22]) {
    const shut = day(time), open = day(time, { pandora: true }), at = placeOf(p, slotOf(p, shut)); assert.equal(slotOf(p, open), slotOf(p, shut), `${p.id} keeps the timetable`); assert.deepEqual(tripsOf(p, open), tripsOf(p, shut));
    const a = seeded(11 + time), b = seeded(11 + time);
    for (let i = 0; i < 30; i++) {
      const key = pickTrip(p, open, at, a); assert.equal(key, pickTrip(p, shut, at, b), `${p.id} at ${time}: the box changes nothing`); if (!key) continue; walks++; if (p.child) kids++;
      const path = lanePath(at, placeOf(p, key)); assert.ok(pathLength(at, path) <= TRIP.reach); for (const step of path) assert.ok(inVillage(step.x, step.z) && inSafeZone(step.x, step.z, -3));
    }
  }
  assert.ok(walks > 800 && kids > 100, `grown-ups and children stroll while it is open (${walks} walks, ${kids} children's)`);
});

test('hellos: by name, by the hour, children their own way', () => {
  const r = () => 0, ada = who('ada'), theo = who('theo'), pip = who('pip'), milo = who('milo');
  assert.deepEqual(greeting(ada, theo, 9, r), ['Morning, Theo!', 'Morning, Ada!']); assert.deepEqual(greeting(ada, theo, 14, r), ['Afternoon, Theo!', 'Afternoon, Ada!']); assert.equal(greeting(ada, theo, 20, r)[0], 'Evening, Theo!');
  assert.deepEqual(greeting(pip, milo, 12, r), ['Hi Milo!', 'Hi Pip!']); assert.equal(greeting(pip, ada, 12, r)[0], 'Hello, Ada!'); assert.equal(hello(ada, 9, r), 'Morning, Rowan!'); assert.equal(hello(pip, 9, r), 'Hi Rowan!');
  const random = seeded(3); for (let i = 0; i < 60; i++) { const [a, b] = greeting(ada, theo, 7 + i % 15, random); assert.ok(a.length > 3 && a.length < 26 && b.length > 3 && b.length < 28); assert.ok(!/day/.test(a) || 7 + i % 15 < 17.5, 'no "lovely day" at night'); }
});

// ---------------------------------------------------------------- the west houses: main doors to the village, back doors to the road
const along = (a, b, step = .5) => { const n = Math.max(1, Math.ceil(far(a, b) / step)); return Array.from({ length: n + 1 }, (_, i) => ({ x: a.x + (b.x - a.x) * i / n, z: a.z + (b.z - a.z) * i / n })); };
test('the west houses turn their main doors east, to the West Lane and the village centre', () => {
  assert.deepEqual(BACK_HOMES.map(h => h.id), [1, 5, 7], 'Alder, Finch, Vale'); assert.deepEqual(HOMES.slice(1).filter(h => h.x < 0).map(h => h.id), [1, 5, 7], 'every house on the west side');
  assert.ok(WEST_LANE.x > Math.max(...BACK_HOMES.map(h => h.x)) + 8 && WEST_LANE.x < -25, 'the lane runs between the houses and the family fields');
  const [lane, field] = LANES_GRAVEL;
  assert.ok(Math.abs(lane.z - lane.d / 2 - (ROADS.north + 2.5)) < .01 && Math.abs(lane.z + lane.d / 2 - (ROADS.south - 2.5)) < .01, 'the West Lane joins the north road and the south road');
  assert.ok(Math.abs(field.x - field.w / 2 - (WEST_LANE.x + WEST_LANE.w / 2)) < .01 && Math.abs(field.x + field.w / 2 + 1.7) < .01 && field.z === FIELD_LANE.z, 'the Field Lane joins it to the homestead’s front lane (3.4 m wide at x 0)');
  for (const h of BACK_HOMES) {
    const f = frontOf(h), lot = lotOf(h), name = h.family;
    assert.ok(f.x > .999 && Math.abs(f.z) < 1e-9, `${name}: the front faces +x`);
    // The main door's spot: east of the house, in front of its own front door, free to stand on, nearer the village centre than the house.
    assert.ok(lot.door.x > h.x + HALF_DEPTH + 1 && Math.abs(lot.door.z - h.z) < 2 && lot.door.r >= 2, `${name}: door spot`); assert.equal(blockedAt(lot.door.x, lot.door.z), false);
    assert.ok(far(lot.door, HOMESTEAD) < far(h, HOMESTEAD));
    // A roomy approach: the front path is 2.6 m wide, at least 5 m long, with no fence, building or tree trunk within 2 m of it.
    const path = lot.paths[0]; assert.ok(path.d >= 2.6 && path.w >= 5 && Math.abs(path.z - lot.door.z) < .01); assert.ok(lot.fence.x1 < h.x - HALF_DEPTH && lot.fence.x2 < h.x - HALF_DEPTH, `${name}: the fence is behind the house`);
    for (const p of along({ x: h.x + HALF_DEPTH + .4, z: lot.door.z }, { x: WEST_LANE.x, z: lot.door.z })) { assert.ok(onLotPath(p.x, p.z, .01), `${name}: gravel at ${p.x.toFixed(1)}`); for (const dz of [-2, 0, 2]) assert.equal(blockedAt(p.x, p.z + dz), false, `${name}: clear at ${p.x.toFixed(1)}, ${(p.z + dz).toFixed(1)}`); }
    // From the door to the garden gate without leaving the gravel: front path, West Lane, Field Lane.
    const way = [lot.door, { x: WEST_LANE.x, z: lot.door.z }, { x: WEST_LANE.x, z: FIELD_LANE.z }, { x: -1.8, z: FIELD_LANE.z }];
    for (let i = 1; i < way.length; i++) for (const p of along(way[i - 1], way[i])) { assert.ok(onLotPath(p.x, p.z, .01), `${name}: on gravel at ${p.x.toFixed(1)}, ${p.z.toFixed(1)}`); assert.equal(blockedAt(p.x, p.z), false); }
    // The villagers' gate node is on the West Lane in front of the door, and their way to your gate keeps to the lanes inside the ring.
    const gate = LANES.nodes[placeOf(RESIDENTS.find(p => p.home === h.id), 'home').via]; assert.ok(Math.abs(gate.x - WEST_LANE.x) < .01 && Math.abs(gate.z - h.z) < .01, `${name}: gate node`);
    const walk = lanePath({ x: gate.x, z: gate.z, via: gate.id }, { x: 0, z: -4.6, via: 'hFront' }); assert.ok(pathLength(gate, walk) < 75, `${name}: ${pathLength(gate, walk).toFixed(0)} m to your gate`);
    for (const p of walk) assert.ok(p.x > ROADS.west + 4 && p.x <= .01, `${name}: the walk stays between the west road and the front lane`);
    // Residents stand on the door's side: their doorstep and yard are east of the house.
    for (const p of RESIDENTS.filter(p => p.home === h.id)) for (const key of ['home', 'yard']) assert.ok(placeOf(p, key).x > h.x + HALF_DEPTH, `${p.id} ${key}`);
  }
  // The Vale barn stands beside the house, not in front of its door, and the workshop's counter is at its doors on the lane side.
  const vale = lotOf(HOUSES[7]); assert.ok(vale.barn.x - vale.barn.w / 2 < HOUSES[7].x && vale.barn.z - vale.barn.d / 2 > HOUSES[7].z + 4, 'south of the house'); assert.ok(vale.barn.z + vale.barn.d / 2 < ROADS.south - 2.5, 'off the south road');
  assert.ok(BLOCKS.some(b => b.name === 'vale-barn' && b.x === vale.barn.x && b.z === vale.barn.z)); assert.equal(blockedAt(WORKSHOP.x, WORKSHOP.z), false); assert.ok(WORKSHOP.x > vale.barn.x + vale.barn.w / 2 && WORKSHOP.x < WEST_LANE.x - 1.3);
  // The east houses still face their road.
  for (const id of [2, 4]) { const lot = lotOf(HOUSES[id]); assert.ok(frontOf(HOUSES[id]).x > .999 && !lot.back && lot.paths.length === 1 && lot.fence.x1 > HOUSES[id].x); }
});

test('two ways in: a back door on the west road side, with its own gate and path', () => {
  const inner = ROADS.west + 2.5;
  for (const h of BACK_HOMES) {
    const lot = lotOf(h), name = h.family, wall = toWorld(h, lot.backDoor.x, lot.backDoor.z);
    assert.ok(wall.x < h.x - 2 && wall.x > h.x - HALF_DEPTH, `${name}: the door is on the west wall`); assert.ok(Math.abs(wall.z - lot.back.z) < .01);
    assert.ok(lot.back.x < h.x - HALF_DEPTH - 1 && lot.back.x > inner + 1, `${name}: the back door’s spot is between the house and the road`); assert.equal(blockedAt(lot.back.x, lot.back.z), false);
    assert.ok(far(lot.door, lot.back) > lot.door.r + lot.back.r + 3, `${name}: the two doors’ spots are well apart`);
    // Standing on either spot, that door is the nearer one (World.nearest picks it).
    assert.ok(far(lot.back, lot.back) < far(lot.back, lot.door));
    // The back path: gravel from the road's inner edge to the stoop, through a gate in the picket fence.
    const path = lot.paths[1]; assert.ok(Math.abs(path.x - path.w / 2 - inner) < .01 && Math.abs(path.x + path.w / 2 - (h.x - HALF_DEPTH)) < .01 && path.d >= 1.6, `${name}: back path`);
    for (const p of along({ x: inner + .1, z: lot.back.z }, { x: h.x - HALF_DEPTH - .4, z: lot.back.z })) { assert.ok(onLotPath(p.x, p.z, .01)); assert.equal(blockedAt(p.x, p.z), false, `${name}: clear at ${p.x.toFixed(1)}`); }
    assert.ok(lot.fence.x1 === lot.fence.x2 && lot.fence.x1 > inner && lot.fence.x1 < lot.back.x + 1 && Math.abs(lot.fence.gap.z - lot.back.z) < .01, `${name}: the gate is on the path`);
    // The fence's 2 m segments: exactly one is left out, the one the path goes through.
    const open = Array.from({ length: 10 }, (_, i) => h.z - 9 + i * 2).filter(z => Math.abs(z - lot.fence.gap.z) < lot.fence.gap.r); assert.equal(open.length, 1, `${name}: one gate`); assert.ok(Math.abs(open[0] - lot.back.z) <= .2);
    assert.ok(Math.abs(lot.mailbox.z - lot.back.z) > 1.2 && Math.abs(lot.mailbox.z - lot.back.z) < 3, `${name}: the mailbox stands beside the gate`);
    for (const t of livingTrees()) for (const s of [lot.door, lot.back]) assert.ok(far(t, s) > .42 * t.s + 1.35, `${name}: no tree steals the door`);
  }
});

test('with the box open the ward runs just outside the ring road, and everything you use is inside it', () => {
  const outer = { west: ROADS.west - 2.5, east: ROADS.east + 2.5, south: ROADS.south + 2.5, north: ROADS.north - 2.5 };
  assert.equal(outer.west - SAFE.x0, 2); assert.equal(SAFE.x1 - outer.east, 2); assert.equal(SAFE.z1 - outer.south, 2);
  for (const d of [outer.west - SAFE.x0, SAFE.x1 - outer.east, SAFE.z1 - outer.south]) assert.ok(d > 0 && d <= 3, 'within 3 m of the road’s outer edge');
  // North: one straight line behind the Town Square, the grove and the row of trees behind them (the tightest rectangle).
  const behind = Math.min(GROVE.z0, ...CIVIC.map(c => c.z - c.d / 2), ...gatherSpots().map(g => g.z - 1.5), ...livingTrees().filter(t => t.z < outer.north).map(t => t.z - .42 * t.s));
  assert.ok(behind - SAFE.z0 > 0 && behind - SAFE.z0 <= 2, `the north line is ${(behind - SAFE.z0).toFixed(1)} m behind the last thing that stands there`);
  // Every interaction spot, every door (front and back), every villager's place and every lane node is inside the ward.
  const spots = [...LOTS.flatMap(l => l.back ? [l.door, l.back] : [l.door]), { x: HOMES[0].x, z: HOMES[0].z + 5 }, WORKSHOP, GATE, WOODLAND, FISH_SPOT, GREEN, ...gatherSpots(), ...ORCHARD_POSITIONS, ...BED_POSITIONS, ...RACE_POINTS,
    { x: MARKET.x, z: MARKET.z + 2.2 }, { x: ATELIER.x, z: ATELIER.z + 2.3 }, ...CIVIC.map(c => ({ x: c.x, z: c.z + c.d / 2 + 1.8 })), { x: 17, z: -13 }, { x: 12, z: -13 }, { x: HOUSES[2].x + 8, z: HOUSES[2].z + 8 }, { x: 5, z: -6 }];
  for (const s of spots) assert.ok(inSafeZone(s.x, s.z, -1) && inVillage(s.x, s.z), `the spot at ${s.x}, ${s.z} is inside the ward`);
  for (const b of BLOCKS) for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) assert.ok(inSafeZone(b.x + sx * b.w / 2, b.z + sz * b.d / 2, -1), `${b.name} is inside the ward`);
  for (const x of [POND.x - POND.w / 2 - 1.9, POND.x + POND.w / 2 + 1.9]) for (const z of [POND.z - POND.d / 2 - 1.9, POND.z + POND.d / 2 + 1.9]) assert.ok(inSafeZone(x, z, -3), 'the pond’s banks');
  for (const id of LANES.ids) assert.ok(inSafeZone(LANES.nodes[id].x, LANES.nodes[id].z, -3), `lane node ${id}`);
  // The whole ring road is inside the ward with room to spare, so nothing wild can stand or be pushed onto it (a creature keeps its own radius outside the line).
  for (const [x, z] of [[outer.west, 0], [outer.east, 0], [0, outer.south], [0, outer.north], [outer.west, outer.south], [outer.east, outer.north]]) assert.ok(inSafeZone(x, z, -1.5));
  // No creature is placed inside the ward or on the road, and the home regions still begin right beyond the line.
  let nearest = Infinity, n = 0;
  for (let cx = -4; cx <= 4; cx++) for (let cz = -4; cz <= 4; cz++) for (const c of wildCell(cx, cz)) {
    n++; assert.ok(!inSafeZone(c.x, c.z, 1), `${c.id} is outside the ward`); assert.ok(!(c.x > outer.west && c.x < outer.east && c.z > outer.north && c.z < outer.south), `${c.id} is off the road ring`);
    nearest = Math.min(nearest, wildDepth(c.x, c.z));
  }
  assert.ok(n > 60); assert.ok(nearest >= 2 && nearest < 8, `the nearest creature is ${nearest.toFixed(1)} m beyond the ward`); assert.equal(regionAt(SAFE.x0 - 2.5, 0), 'west'); assert.equal(regionAt(SAFE.x0 + 1, 0), 'village');
  // The spur runs out through the ward into the open fields; the gate is on the ring's side of the line.
  assert.ok(GATE.x > SAFE.x1 - 1.5 && GATE.x < SAFE.x1 - 1); assert.equal(inSafeZone(ROADS.east + 12, 0), false);
});
