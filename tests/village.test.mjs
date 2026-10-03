// The compact village (round 7): six houses and four lodgings, market row with the atelier's stall, a footprint and a
// ward that hug the ring road, trees that keep their saved indexes, lanes for the villagers and their strolls.
import test from 'node:test';
import assert from 'node:assert/strict';
import { HOUSES, HOMES, RESIDENTS, CIVIC, ROADS, POND, FISH_SPOT, MARKET, ATELIER, GREEN, GATE, WOODLAND, WORKPLACE, RACE_POINTS, ORCHARD_POSITIONS, BED_POSITIONS } from '../src/content.mjs';
import { VILLAGE, inVillage, fieldPlan, HOMESTEAD } from '../src/field-layout.mjs';
import { SAFE, WARD_MARGIN, inSafeZone } from '../src/wilds.mjs';
import { villageTrees, livingTrees, villageTufts, villageFlowers, reserved, lawn, gatherSpots, OLD_TREES, BLOCKS, STALL, blockedAt, inBlock, firstBlock } from '../src/village-plan.mjs';
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
  const back = Math.min(...CIVIC.map(c => c.z - c.d / 2)), margin = { west: ROADS.west - 2.5 - VILLAGE.x0, east: VILLAGE.x1 - (ROADS.east + 2.5), north: back - VILLAGE.z0, south: VILLAGE.z1 - (ROADS.south + 2.5) };
  for (const [side, m] of Object.entries(margin)) assert.ok(m >= 3 && m <= 7, `${side} verge ${m.toFixed(1)} m`);
  assert.ok((VILLAGE.x1 - VILLAGE.x0) * (VILLAGE.z1 - VILLAGE.z0) < 132 * 128 * .66, 'a third smaller than the old 132 x 128 footprint');
  assert.deepEqual(SAFE, { x0: VILLAGE.x0 - WARD_MARGIN, x1: VILLAGE.x1 + WARD_MARGIN, z0: VILLAGE.z0 - WARD_MARGIN, z1: VILLAGE.z1 + WARD_MARGIN });
  // Everything the village offers is inside the footprint.
  const things = [...HOMES, ...CIVIC, ...gatherSpots(), WOODLAND, ...RACE_POINTS, ...ORCHARD_POSITIONS, ...BED_POSITIONS, FISH_SPOT, GREEN, MARKET, ATELIER, HOMESTEAD, ...BLOCKS];
  for (const t of things) assert.ok(inVillage(t.x, t.z), `${t.name ?? t.id ?? ''} at ${t.x},${t.z}`);
  // The gate to the country road: used from inside the footprint (its reach is 3 m), and it lies inside the ward.
  assert.ok(inVillage(GATE.x - 3 * .82, GATE.z)); assert.ok(inSafeZone(GATE.x, GATE.z)); assert.ok(inVillage(ROADS.east + 8, 0), 'where you step back in from the country market');
  // The old south row (z 54) and the old woodland corner are open fields now.
  for (const [x, z] of [[-30, 54], [10, 54], [30, 54], [-10, 54], [-58, 50]]) assert.equal(inVillage(x, z), false);
});

test('the open fields fill the freed land right up to the footprint, and keep off the gate’s road', () => {
  const trees = [], grass = [];
  for (let cx = -2; cx <= 1; cx++) for (let cz = -2; cz <= 1; cz++) { const plan = fieldPlan(cx, cz); trees.push(...plan.trees); grass.push(...plan.grass); }
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
  const within = (r, p) => p.x >= r.x0 && p.x < r.x1 && p.z >= r.z0 && p.z < r.z1;
  for (const r of edge) assert.ok(grass.some(p => within(r, p)) || trees.some(p => within(r, p)), `field scenery by the edge at ${r.x0},${r.z0}`);
  const own = [...villageTufts(), ...villageFlowers(), ...livingTrees()];
  for (const side of ['north', 'south', 'west', 'east']) {
    const band = p => side === 'north' ? p.z < VILLAGE.z0 + 6 : side === 'south' ? p.z > VILLAGE.z1 - 3.6 : side === 'west' ? p.x < VILLAGE.x0 + 3.6 : p.x > VILLAGE.x1 - 6.6;
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
  assert.equal(trees[0].gone, true, 'the far north belt is open fields'); assert.ok(!trees[119].gone && !trees[127].gone, 'the trees on the family land stay');
  const living = livingTrees(); assert.ok(living.length >= 60 && living.length <= 110, `${living.length} trees`); assert.ok(trees.slice(OLD_TREES).every(t => !t.gone) && trees.length - OLD_TREES >= 15, 'new trees come after the old ones');
  // No tree steals the E key: nothing you use lies within a tree's own reach (its trunk plus 1.35 m).
  const spots = [...gatherSpots(), WOODLAND, GATE, FISH_SPOT, GREEN, { x: MARKET.x, z: MARKET.z + 2.2 }, { x: ATELIER.x, z: ATELIER.z + 2.3 }, ...ORCHARD_POSITIONS, ...BED_POSITIONS, ...CIVIC.map(c => ({ x: c.x, z: c.z + c.d / 2 + 1.8 })), ...HOMES.map(h => ({ x: h.x + Math.sin(h.rot) * 4.7, z: h.z + Math.cos(h.rot) * 4.7 })), { x: 17, z: -13 }, { x: 12, z: -13 }];
  for (const t of living) for (const s of spots) assert.ok(far(t, s) > .42 * t.s + 1.35, `a tree at ${t.x.toFixed(1)},${t.z.toFixed(1)} is in reach of the spot at ${s.x},${s.z}`);
  // A save that cleared trees which are gone now still loads, and its other trees are the same trees.
  const s = freshState(); s.cleared = [0, 3, 119, 127]; assert.deepEqual(parseSave(JSON.parse(JSON.stringify(s))).cleared, [0, 3, 119, 127]);
});

test('tufts and flowers: inside the footprint, off the roads and lanes, the same every time', () => {
  const tufts = villageTufts(), flowers = villageFlowers(); assert.equal(tufts, villageTufts());
  assert.ok(tufts.length >= 250 && tufts.length <= 400, `${tufts.length} tufts`); assert.ok(flowers.length >= 30 && flowers.length <= 90, `${flowers.length} flowers`);
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

test('strolls: box shut, anyone may walk to the market, the stall, the green, the pond or a neighbour; box open, short walks only and children stay', () => {
  const random = seeded(5); assert.ok(TRIP.walkersOpen < TRIP.walkers && TRIP.reachOpen < TRIP.reach / 2);
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
  // Open: no child goes anywhere; a grown-up's walk is at most TRIP.reachOpen metres of lane, every step of it inside the ward.
  let walks = 0;
  for (const p of RESIDENTS) for (const time of [9, 13, 20, 22]) {
    const s = day(time, { pandora: true }), at = placeOf(p, slotOf(p, s));
    for (let i = 0; i < 30; i++) {
      const key = pickTrip(p, s, at, random); if (p.child) { assert.equal(key, null, `${p.id} stays put while the box is open`); continue; } if (!key) continue; walks++;
      const to = placeOf(p, key), path = lanePath(at, to); assert.ok(pathLength(at, path) <= TRIP.reachOpen, `${p.id} ${at.key} -> ${key}: ${pathLength(at, path).toFixed(0)} m`);
      for (const step of path) assert.ok(inVillage(step.x, step.z) && inSafeZone(step.x, step.z, -3));
    }
  }
  assert.ok(walks > 300, 'grown-ups still stroll while it is open');
});

test('hellos: by name, by the hour, children their own way', () => {
  const r = () => 0, ada = who('ada'), theo = who('theo'), pip = who('pip'), milo = who('milo');
  assert.deepEqual(greeting(ada, theo, 9, r), ['Morning, Theo!', 'Morning, Ada!']); assert.deepEqual(greeting(ada, theo, 14, r), ['Afternoon, Theo!', 'Afternoon, Ada!']); assert.equal(greeting(ada, theo, 20, r)[0], 'Evening, Theo!');
  assert.deepEqual(greeting(pip, milo, 12, r), ['Hi Milo!', 'Hi Pip!']); assert.equal(greeting(pip, ada, 12, r)[0], 'Hello, Ada!'); assert.equal(hello(ada, 9, r), 'Morning, Rowan!'); assert.equal(hello(pip, 9, r), 'Hi Rowan!');
  const random = seeded(3); for (let i = 0; i < 60; i++) { const [a, b] = greeting(ada, theo, 7 + i % 15, random); assert.ok(a.length > 3 && a.length < 26 && b.length > 3 && b.length < 28); assert.ok(!/day/.test(a) || 7 + i % 15 < 17.5, 'no "lovely day" at night'); }
});
