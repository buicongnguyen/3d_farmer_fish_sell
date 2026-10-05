// Where the lands' features are and what they do to the player (land-features.mjs, land-effects.mjs). Owner: builder B.
// The numbers are Zoo Garden's (cute_game src/environments.ts, src/lava-weather.ts); the spec's table is 3.9.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DENS, REGION, RING, regionAt, gridBorderDistance, homeBorderDistance } from '../src/regions.mjs';
import { STAND } from './stands.mjs';
import { FEATURES, landClear, waterAt, blockers, mapFeatures, thornPoints, RAIL_HALF, rng } from '../src/land-features.mjs';
import { LandEffects, LAND, ventPhase, ventWarning, thornRaised, trainPosition, turtlePosition, nightShare, VENT_TEXT, BOLT_TEXT, GUST_TEXT } from '../src/land-effects.mjs';
import { forceLavaEvent, nextEvent, lavaEvent } from '../src/lava-weather.mjs';
import { GROUND } from '../src/region-life.mjs';

const len = (x, z) => Math.hypot(x, z), near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
/** A point at `rho` metres on a bearing (degrees clockwise from north). */
const P = (rho, bearing) => [rho * Math.sin(bearing * Math.PI / 180), -rho * Math.cos(bearing * Math.PI / 180)];
const SEA = P(280, 292.5), SAND = P(255, 292.5);
/** A simulation with a recording host. */
function rig(options = {}) {
  const log = { hurt: [], heal: 0, push: [], toast: [], pickup: [] };
  const sim = new LandEffects({ hurt: (share, source) => { log.hurt.push([share, source]); return share * 100; }, heal: share => { log.heal += share; }, push: (dx, dz, opts) => { log.push.push([dx, dz, opts]); return true; }, toast: text => log.toast.push(text), pickup: n => log.pickup.push(n), ...options });
  const total = source => log.hurt.filter(h => !source || h[1] === source).reduce((n, h) => n + h[0], 0);
  /** Steps `seconds` at 20 Hz, standing at (x, z). */
  const run = (seconds, x, z, extra = {}, start = 1000) => { const n = Math.round(seconds * 20); for (let i = 0; i < n; i++) sim.step(.05, { x, z, riding: false, box: true, ...extra }, start + sim.time); };
  return { sim, log, total, run };
}

test('arrival weather leaves the greeting readable and abandoned weather does not follow across regions', () => {
  const r = rig(), [x, z] = STAND.lava, at = { x, z, riding: false, box: true };
  try {
    forceLavaEvent('meteor'); r.sim.step(.05, at, 7000);
    assert.equal(r.log.toast.length, 0); assert.match(r.sim.status(x, z).value, /Meteor shower/,'HUD weather is immediate');
    r.run(3, x, z, {}, 7000); assert.equal(r.log.toast.length, 0, 'the greeting remains readable for three seconds');
    r.run(.3, x, z, {}, 7000); assert.equal(r.log.toast.filter(t => t.includes('Meteor shower')).length, 1);
    forceLavaEvent('storm'); r.sim.step(.05, at, 7010); assert.match(r.log.toast.at(-1), /Magma storm/, 'later changes announce immediately');
    r.sim.drops.push({ kind: 'meteor', x, z, r: 2.6, age: 0, duration: 1.8 });
    r.sim.step(.05, { x: STAND.cloud[0], z: STAND.cloud[1], riding: false, box: true }, 7010);
    assert.equal(r.sim.drops.length, 0, 'a teleport/import cannot turn lava meteors into cloud lightning');
    r.sim.step(.05, at, 7010); const before = r.log.toast.length;
    r.sim.step(.05, { x: 0, z: 0, riding: false, box: true }, 7010); r.run(4, 0, 0);
    assert.equal(r.log.toast.length, before, 'leaving cancels the pending arrival announcement');
  } finally { forceLavaEvent(null); }
});

test('placement: every feature lies inside its own region, clear of the borders, the dens and the titans’ arenas', () => {
  const kinds = ['ponds', 'pools', 'tracks', 'vents', 'poison', 'thorns', 'lamps', 'flowers', 'islands', 'turtles'];
  assert.deepEqual(Object.keys(FEATURES).sort(), Object.keys(REGION).sort());
  for (const id in FEATURES) {
    const f = FEATURES[id], dens = DENS.filter(d => d.region === id);
    for (const kind of kinds) for (const p of f[kind]) {
      const label = `${id} ${kind} at (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`, edge = gridBorderDistance(p.x, p.z);
      assert.equal(regionAt(p.x, p.z), id, label + ' is in its region');
      if (kind === 'turtles') { assert.ok(waterAt(p.x, p.z) && edge >= 6, label + ' swims in the sea'); continue; }
      if (kind === 'islands') { assert.ok(edge >= p.r + 3 && p.r >= 12 && p.r <= 18, label + ' lies whole inside the sector'); continue; }
      // Ponds and pools: their edge 6 m from a border; a track's rail 12 m; every small feature's centre 12 m.
      if (kind === 'ponds' || kind === 'pools') assert.ok(edge - p.r >= 6, label + ` edge ${(edge - p.r).toFixed(1)} m from a border`);
      else assert.ok(edge - (kind === 'tracks' ? p.r : 0) >= 12, label + ` ${edge.toFixed(1)} m from a border`);
      for (const d of dens) {
        const away = len(d.x - p.x, d.z - p.z) - (kind === 'tracks' || kind === 'ponds' || kind === 'pools' ? p.r : 0);
        if (kind === 'tracks') { assert.ok(away >= (d.titan ? 32 : 16) - 1e-6, label + ` ${away.toFixed(2)} m from ${d.type}`); continue; } // a track may touch the arena's edge, not cross it
        assert.ok(away >= 16, label + ` is ${away.toFixed(1)} m from ${d.type}`);
        if (d.titan) assert.ok(len(d.x - p.x, d.z - p.z) >= 32 + (kind === 'ponds' || kind === 'pools' ? p.r : 0) - 1, label + ' is outside the arena of ' + d.type);
      }
    }
  }
  // The counts of spec 3.9.
  const count = id => Object.fromEntries(kinds.map(k => [k, FEATURES[id][k].length]).filter(([, n]) => n));
  assert.deepEqual(count('west'), { ponds: 2 }); assert.deepEqual(count('south'), { ponds: 2 }); assert.deepEqual(count('north'), {}); assert.deepEqual(count('east'), {}); assert.deepEqual(count('village'), {});
  assert.deepEqual(count('toy'), { ponds: 1, tracks: 2 }); assert.deepEqual(count('candy'), { ponds: 1 }); assert.deepEqual(count('jungle'), { ponds: 1, poison: 3, thorns: 6 });
  assert.deepEqual(count('ice'), { ponds: 1 }); assert.deepEqual(count('ocean'), { turtles: 3 }); assert.deepEqual(count('lava'), { pools: 4, vents: 2 }); assert.deepEqual(count('cloud'), { islands: 12 }); assert.deepEqual(count('shadow'), { ponds: 1, lamps: 6, flowers: 15 });
  assert.equal(FEATURES.ice.ice, true);
  // The fixed places of the spec's table.
  const places = list => list.map(p => [p.x, p.z, p.r]);
  // The planets' are the spec's hand-solved places turned into Zoo Garden's numbered order (rounded to the millimetre).
  const round = l => l.map(p => p.map(v => Math.round(v * 10) / 10));
  assert.deepEqual(places(FEATURES.west.ponds), [[-41.5, 82.5, 8], [-34, 121.5, 7]]); assert.deepEqual(places(FEATURES.south.ponds), [[126.5, 30, 9], [93.5, 50.5, 11]]);
  assert.deepEqual(round(places(FEATURES.toy.tracks)), [[178, 86.5, 22], [238, 69, 22]]); assert.deepEqual(FEATURES.toy.tracks.map(t => t.speed), [7, 8]); assert.deepEqual(round(places(FEATURES.toy.ponds)), [[238, 69, 6]]);
  assert.deepEqual(round(places(FEATURES.candy.ponds)), [[35, 258.5, 6.6]]); assert.deepEqual(round(places(FEATURES.jungle.ponds)), [[-42.8, 250, 6]]); assert.deepEqual(round(places(FEATURES.ice.ponds)), [[-258.4, 35, 6.6]]); assert.deepEqual(round(places(FEATURES.shadow.ponds)), [[206.8, -146.7, 6]]);
  assert.deepEqual(round(places(FEATURES.lava.pools)), [[-118, -169.5, 18], [-37, -189.5, 14], [-105.5, -216, 12], [-97, -251.5, 11]]); assert.deepEqual(round(places(FEATURES.lava.vents)), [[-79.5, -163.5, 5.5], [-169.5, -206, 5.5]]);
  // The Beach's sea: the part of the sector beyond R2 - 32, an annular sector.
  assert.deepEqual(FEATURES.ocean.sea, { kind: 'sea', r0: RING.R2 - 32, r1: RING.R2, b0: 270, b1: 315 });
  // Lava's pools cover 8 to 11% of its square; the nest is the dragon's den, with a centre island and ten ring islands at 7 and 11 m.
  const share = FEATURES.lava.pools.reduce((n, p) => n + Math.PI * p.r * p.r, 0) / (Math.PI * (RING.R2 ** 2 - RING.R1 ** 2) / 8); assert.ok(share > .09 && share < .11, `pools cover ${(share * 100).toFixed(1)}%`);
  const dragon = DENS.find(d => d.type === 'dragon'), nest = FEATURES.lava.nest; assert.deepEqual([nest.x, nest.z, nest.r], [dragon.x, dragon.z, 14]);
  assert.equal(FEATURES.lava.nestIslands.length, 11); assert.equal(FEATURES.lava.nestIslands[0].r, 4.5);
  for (const [i, p] of FEATURES.lava.nestIslands.slice(1).entries()) { assert.ok(near(len(p.x - nest.x, p.z - nest.z), i % 2 ? 11 : 7), 'ring island ' + i); assert.ok(p.r >= 2.1 && p.r <= 2.8 + 1e-9 && len(p.x - nest.x, p.z - nest.z) + p.r < nest.r); }
  // The nest and the pools are clear of the other dens and of the scorpion's arena.
  for (const d of DENS.filter(d => d.region === 'lava' && d.type !== 'dragon')) assert.ok(len(d.x - nest.x, d.z - nest.z) - nest.r >= (d.titan ? 32 : 16), `the nest is clear of ${d.type}`);
  // Jungle: patches of r 4.5 and 5.3, walls of r 3.8 with the reference's angle and phase by index; night: lamps of r 8, flowers of r 2.4.
  assert.deepEqual(FEATURES.jungle.poison.map(p => +p.r.toFixed(2)), [4.5, 5.3, 6.1]); FEATURES.jungle.thorns.forEach((w, i) => { assert.equal(w.r, 3.8); assert.ok(near(w.angle, i * 1.71) && near(w.phase, i * 2.17)); assert.equal(thornPoints(w).length, 5); });
  assert.ok(FEATURES.shadow.lamps.every(p => p.r === 8) && FEATURES.shadow.flowers.every(p => p.r === 2.4));
  // The seeded rule: spacing between the points of a kind, and nothing on a pond or on each other.
  const apart = (list, gap) => list.every((a, i) => list.every((b, k) => i === k || len(a.x - b.x, a.z - b.z) > gap));
  assert.ok(apart(FEATURES.jungle.poison, 20) && apart(FEATURES.jungle.thorns, 14) && apart(FEATURES.shadow.lamps, 18) && apart(FEATURES.shadow.flowers, 7));
  for (const [i, a] of FEATURES.cloud.islands.entries()) for (const b of FEATURES.cloud.islands.slice(i + 1)) assert.ok(len(a.x - b.x, a.z - b.z) > a.r + b.r + 4 - 1e-9, 'islands do not touch');
  for (const d of DENS.filter(d => d.region === 'cloud')) assert.ok(FEATURES.cloud.islands.some(p => p.x === d.x && p.z === d.z), `an island under ${d.type}`);
  // The same every time: the tables are frozen and built from fixed seeds.
  assert.ok(Object.isFrozen(FEATURES) && Object.isFrozen(FEATURES.jungle.poison) && Object.isFrozen(FEATURES.shadow.lamps[0]));
  assert.equal(rng(87356)(), rng(87356)());
});

test('the sea, the stands and the blockers: where water is, where nothing may stand, what stops a walker and a car', () => {
  // The sea is the part of the Beach beyond 32 m from the rim, and nowhere else.
  for (let x = -318; x <= 318; x += 4) for (let z = -318; z <= 318; z += 4) assert.equal(waterAt(x, z), regionAt(x, z) === 'ocean' && Math.hypot(x, z) > RING.R2 - 32, `sea at (${x}, ${z})`);
  assert.ok(waterAt(...SEA) && !waterAt(...SAND) && !waterAt(...P(280, 200)) && !waterAt(...P(280, 337.5)));
  // No pond is within 10 m of a stand point, or of the axis a tip land is entered along.
  for (const id in STAND) { const [x, z] = STAND[id]; assert.equal(regionAt(x, z), id); assert.ok(landClear(x, z, 1), `the stand of ${id} is clear land`);
    for (const p of [...FEATURES[id].ponds, ...FEATURES[id].pools]) assert.ok(len(p.x - x, p.z - z) >= 10 && len(p.x - x, p.z - z) - p.r >= 9, `${id}: a pond's centre ${len(p.x - x, p.z - z).toFixed(1)} m from the stand`); }
  // landClear: 'land' is false on every pond, pool, the nest, a vent, a rail, a thorn wall and the sea, and r widens each.
  for (const id in FEATURES) for (const p of [...FEATURES[id].ponds, ...FEATURES[id].pools, ...FEATURES[id].vents]) {
    assert.equal(landClear(p.x, p.z), false); assert.equal(landClear(p.x + p.r - .1, p.z), false); assert.equal(landClear(p.x + p.r + .1, p.z), true); assert.equal(landClear(p.x + p.r + .9, p.z, 1), false); assert.equal(landClear(p.x + p.r + 1.1, p.z, 1), true);
  }
  const nest = FEATURES.lava.nest; assert.equal(landClear(nest.x + 13.9, nest.z), false); assert.equal(landClear(nest.x + 14.1, nest.z), true);
  for (const t of FEATURES.toy.tracks) { assert.equal(landClear(t.x + t.r, t.z), false); assert.equal(landClear(t.x + t.r + RAIL_HALF - .1, t.z), false); assert.equal(landClear(t.x + t.r - RAIL_HALF - .1, t.z), true); assert.equal(landClear(t.x, t.z + t.r + RAIL_HALF + .5, 1), false); }
  for (const w of FEATURES.jungle.thorns) for (const p of thornPoints(w)) assert.equal(landClear(p.x, p.z), false, 'nothing grows in a thorn wall');
  assert.equal(landClear(...SEA), false); assert.equal(landClear(...P(263.5, 292.5)), true); assert.equal(landClear(...P(263.5, 292.5), 1), false); assert.equal(landClear(...P(200, 292.5)), true);
  // 'sea': only in the sea, r inside its edge; 'island': only on a cloud island, r inside its edge.
  assert.equal(landClear(...P(270, 292.5), 0, 'sea'), true); assert.equal(landClear(...P(270, 292.5), 7, 'sea'), false); assert.equal(landClear(...P(272, 292.5), 7, 'sea'), true); assert.equal(landClear(...SAND, 0, 'sea'), false); assert.equal(landClear(0, 0, 0, 'sea'), false);
  const isle = FEATURES.cloud.islands[0]; assert.equal(landClear(isle.x, isle.z, 0, 'island'), true); assert.equal(landClear(isle.x + isle.r - 1, isle.z, 2, 'island'), false); const open = [-60, 0, 60].flatMap(dz => [-60, 0, 60].map(dx => [STAND.cloud[0] + dx, STAND.cloud[1] + dz])).find(([x, z]) => regionAt(x, z) === 'cloud' && !landClear(x, z, 0, 'island')); assert.ok(open && landClear(...open), 'the cloud floor is walkable land');
  assert.equal(landClear(0, 0), true); assert.equal(landClear(500, 500), true);
  // blockers: every pond and lamp post for everyone, every lava pool and the nest for cars only.
  for (const id in FEATURES) {
    const f = FEATURES[id], list = blockers(id);
    assert.equal(list.length, f.ponds.length + f.lamps.length + f.pools.length + (f.nest ? 1 : 0), id);
    for (const p of f.ponds) assert.ok(list.some(b => b.x === p.x && b.z === p.z && b.r === p.r && b.carOnly === false));
    for (const p of [...f.pools, ...(f.nest ? [f.nest] : [])]) assert.ok(list.some(b => b.x === p.x && b.z === p.z && b.r === p.r && b.carOnly === true));
    for (const p of f.lamps) assert.ok(list.some(b => b.x === p.x && b.z === p.z && b.r === .35 && !b.carOnly));
    assert.equal(blockers(id), list, 'the same list every call'); assert.ok(Object.isFrozen(list));
  }
  assert.deepEqual(blockers('nowhere'), []); assert.deepEqual(blockers('north'), []);
  // The map's shapes: one for every feature.
  assert.deepEqual(mapFeatures('lava').map(m => m.kind), ['pool', 'pool', 'pool', 'pool', 'nest', 'vent', 'vent']); assert.equal(mapFeatures('ocean')[0].kind, 'sea'); assert.equal(mapFeatures('toy').filter(m => m.kind === 'track').length, 2);
  assert.equal(mapFeatures('cloud').length, 12); assert.equal(mapFeatures('shadow').length, 22); assert.deepEqual(mapFeatures('east'), []); assert.deepEqual(mapFeatures('moon'), []); assert.equal(mapFeatures('west'), mapFeatures('west'));
  for (const id in FEATURES) for (const m of mapFeatures(id)) assert.ok(/^#[0-9a-f]{6}$/.test(m.color) && (m.kind === 'sea' || (Number.isFinite(m.x) && Number.isFinite(m.z))), `${id} ${m.kind}`);
});

test('lava: 7% every 0.5 s in a pool; the nest turns to lava at the dragon’s second stage, off its islands', () => {
  const pool = FEATURES.lava.pools[0];
  // Arriving in a pool still hurts immediately; the weather waits for the arrival greeting.
  { const order = [], r = rig({ hurt: () => { order.push('hurt'); return 7; }, toast: t => order.push(t) }); forceLavaEvent('normal'); try { r.sim.step(.05, { x: pool.x, z: pool.z, riding: false, box: true }, 1000); } finally { forceLavaEvent(null); }
    assert.deepEqual(order, ['hurt'], 'the arrival weather never masks the immediate burn'); }
  { const r = rig(); forceLavaEvent('normal'); try { r.run(3, pool.x, pool.z); } finally { forceLavaEvent(null); }
    assert.equal(r.log.hurt.length, 6, 'six ticks in 3 s'); assert.ok(r.log.hurt.every(h => h[0] === .07 && h[1] === 'lava')); assert.ok(near(r.total(), .42)); }
  { const r = rig(); forceLavaEvent('normal'); try { r.run(3, pool.x, pool.z, { box: false }); } finally { forceLavaEvent(null); } assert.equal(r.log.hurt.length, 0, 'box shut: nothing hurts'); assert.equal(r.log.toast.length, 0, 'and the weather is not named'); }
  { const r = rig(), [x, z] = STAND.lava; forceLavaEvent('normal'); try { r.run(5, x, z); } finally { forceLavaEvent(null); } assert.equal(r.log.hurt.length, 0, 'the stand is safe ground'); }
  // The nest: a dark basin until stage 2; then 2 s of glow, then lava except on the islands.
  const nest = FEATURES.lava.nest, island = FEATURES.lava.nestIslands[1], between = { x: nest.x + Math.cos(Math.PI / 10) * 5.5, z: nest.z + Math.sin(Math.PI / 10) * 5.5 };
  assert.ok(FEATURES.lava.nestIslands.every(p => len(p.x - between.x, p.z - between.z) > p.r), 'a point of the basin between the islands');
  forceLavaEvent('normal');
  try {
    const r = rig(); r.run(2, between.x, between.z); assert.equal(r.log.hurt.length, 0); assert.equal(r.sim.nestLava, false); assert.equal(r.sim.nestGlow, 0);
    r.sim.setNest(2); assert.equal(r.sim.nestLava, false, 'it glows first'); r.run(1, between.x, between.z); assert.ok(near(r.sim.nestGlow, .5, .03)); assert.equal(r.log.hurt.length, 0);
    r.run(1.1, between.x, between.z); assert.equal(r.sim.nestLava, true); assert.equal(r.sim.nestGlow, 1);
    r.log.hurt.length = 0; r.run(2, between.x, between.z); assert.ok(r.log.hurt.length === 3 || r.log.hurt.length === 4, 'a tick every 0.5 s'); assert.ok(r.log.hurt.every(h => h[0] === .07 && h[1] === 'lava'));
    r.log.hurt.length = 0; r.run(2, island.x, island.z); assert.equal(r.log.hurt.length, 0, 'an island is dry'); r.run(2, nest.x, nest.z); assert.equal(r.log.hurt.length, 0, 'so is the centre');
    r.sim.setNest(3); assert.equal(r.sim.nestLava, true, 'no second warning at stage 3'); r.sim.setNest(1); assert.equal(r.sim.nestLava, false);
  } finally { forceLavaEvent(null); }
});

test('vents: phases 110 and 57, a 5 s warning with one toast, 3 s of eruption at 14% a tick, and fire rain', () => {
  const [a, b] = FEATURES.lava.vents; assert.deepEqual([a.phase, b.phase], [110, 57]);
  // On the ordinary 140 s cycle a vent warns from second 131 - phase and erupts from 136 - phase for 3 s.
  const starts = phase => { for (let t = 0; t < 140; t += .5) if (ventPhase(t, phase) === 'warning' && ventPhase(t - .5, phase) !== 'warning') return t; };
  assert.equal(starts(110), 21); assert.equal(starts(57), 74); assert.equal(starts(57) - starts(110), 53, 'the two warnings start 53 s apart');
  for (const [t, want] of [[20.9, 'idle'], [21, 'warning'], [25.9, 'warning'], [26, 'eruption'], [28.9, 'eruption'], [29, 'idle'], [161, 'warning']]) assert.equal(ventPhase(t, 110), want, `t ${t}`);
  assert.equal(ventPhase(41 - 10, 110 - 90 + 90, 50), ventPhase(31, 110, 50)); assert.equal(ventPhase(31, 110, 50), 'warning', 'every 50 s during the eruption event');
  assert.ok(near(ventWarning(23.5, 110), .5) && ventWarning(27, 110) === 1 && ventWarning(10, 110) === 0);
  // Standing in the first vent's ring through one warning and one eruption (calm weather, so the period is 140).
  const calm = nextEvent('normal', 5000), base = Math.ceil(calm / 140) * 140; // a calm stretch of 120 s holds one whole warning and eruption of the first vent
  const t0 = base + 20 >= calm && base + 30 < calm + 120 ? base : base + 140; assert.equal(lavaEvent(t0 + 20).id === 'normal' || lavaEvent(t0 + 30).id !== 'eruption', true);
  forceLavaEvent('normal');
  try {
    const r = rig(), at = { x: a.x + 1, z: a.z, riding: false, box: true };
    for (let i = 0; i < 20 * 12; i++) r.sim.step(.05, at, t0 + 19 + i * .05); // seconds 19 to 31 of the cycle
    assert.equal(r.log.toast.filter(t => t === VENT_TEXT).length, 1, 'the warning fires once');
    const fire = r.log.hurt.filter(h => h[1] === 'fire' && h[0] === .14); assert.equal(fire.length, 6, '14% every 0.5 s for 3 s in the ring');
    // The same, riding: a rider parked in the ring is hurt exactly as a walker is.
    const rider = rig(); for (let i = 0; i < 20 * 12; i++) rider.sim.step(.05, { ...at, riding: true }, t0 + 19 + i * .05);
    assert.equal(rider.log.hurt.filter(h => h[0] === .14).length, 6);
    // Far from it (over 35 m): no toast, no damage; with the box shut: nothing at all.
    const far = rig(); for (let i = 0; i < 20 * 12; i++) far.sim.step(.05, { x: STAND.lava[0], z: STAND.lava[1], riding: false, box: true }, t0 + 19 + i * .05);
    assert.ok(len(a.x - STAND.lava[0], a.z - STAND.lava[1]) > 35 && regionAt(...STAND.lava) === 'lava'); assert.equal(far.log.toast.filter(t => t === VENT_TEXT).length, 0); assert.equal(far.log.hurt.length, 0);
    const shut = rig(); for (let i = 0; i < 20 * 12; i++) shut.sim.step(.05, { ...at, box: false }, t0 + 19 + i * .05); assert.equal(shut.log.hurt.length, 0); assert.equal(shut.log.toast.length, 0); assert.equal(shut.sim.drops.length, 0);
    // Fire rain: a drop every 0.3 s of the eruption, 3 to 14 m from the vent, landing after 0.8 s for 12% within 1.4 m.
    const rain = rig(), seen = []; for (let i = 0; i < 20 * 12; i++) { rain.sim.step(.05, { x: a.x - 30, z: a.z - 30, riding: false, box: true }, t0 + 19 + i * .05); for (const d of rain.sim.drops) if (!seen.includes(d)) seen.push(d); }
    assert.ok(seen.length >= 8 && seen.length <= 11, `${seen.length} drops in a 3 s eruption`);
    for (const d of seen) { const far = len(d.x - a.x, d.z - a.z); assert.equal(d.kind, 'rain'); assert.ok(far >= 3 - 1e-9 && far <= 14 + 1e-9 && d.r === 1.4 && d.duration === .8); }
    assert.equal(rain.sim.drops.length, 0, 'all landed'); assert.equal(rain.log.hurt.length, 0, 'none on a player 42 m away');
    // A drop that lands on you: 12%.
    const hit = rig(); hit.sim.step(.05, at, t0); hit.sim.drops.push({ kind: 'rain', x: at.x + 1, z: at.z, r: 1.4, age: 0, duration: .8 });
    for (let i = 0; i < 20; i++) hit.sim.step(.05, at, t0 + i * .05); assert.deepEqual(hit.log.hurt, [[.12, 'fire']]);
  } finally { forceLavaEvent(null); }
});

test('the weather: named once as it starts; meteors 30% in 2.6 m after 1.8 s, leaving ore; the storm 10% in 1.4 m; treasure by the vents', () => {
  const [x, z] = STAND.lava, at = { x, z, riding: false, box: true };
  try {
    // Meteors: every 2.6 to 5 s a mark 5 to 17 m from you.
    forceLavaEvent('meteor'); const r = rig(), seen = [];
    for (let i = 0; i < 20 * 40; i++) { r.sim.step(.05, at, 7000 + i * .05); for (const d of r.sim.drops) if (d.kind === 'meteor' && !seen.includes(d)) seen.push(d); }
    assert.equal(r.log.toast.filter(t => t.includes('Meteor shower')).length, 1, 'named once'); assert.match(r.log.toast[0], /^☄️ Meteor shower: 240 seconds remaining\.$/);
    assert.ok(seen.length >= 8 && seen.length <= 15, `${seen.length} meteors in 40 s`);
    for (const d of seen) { const far = len(d.x - x, d.z - z); assert.equal(d.kind, 'meteor'); assert.ok(far >= 5 - 1e-9 && far <= 17 + 1e-9, `a meteor ${far.toFixed(1)} m away`); assert.equal(d.r, 2.6); assert.equal(d.duration, 1.8); assert.equal(regionAt(d.x, d.z), 'lava'); }
    assert.ok(r.sim.ores.length >= seen.length - 2 && r.sim.ores.every(o => o.until > r.sim.time), 'each leaves a crystal'); assert.ok(r.sim.ores.every(o => near(o.until - r.sim.time, 90, 40)));
    // One that lands on you: 30%, through 'fire'. A rider is hurt the same.
    for (const riding of [false, true]) { const h = rig(); h.sim.step(.05, { ...at, riding }, 7000); h.sim.drops.length = 0; h.sim.weather.meteorWait = 99; h.sim.drops.push({ kind: 'meteor', x: x + 2, z, r: 2.6, age: 0, duration: 1.8 });
      for (let i = 0; i < 37; i++) h.sim.step(.05, { ...at, riding }, 7000); assert.deepEqual(h.log.hurt, [[.3, 'fire']]); assert.equal(h.sim.ores.length, 1); }
    // Walking over a crystal picks up 1 or 2.
    { const h = rig(); h.sim.step(.05, at, 7000); h.sim.weather.meteorWait = 99; h.sim.addOre(x + 3, z, 90); h.sim.step(.05, at, 7000); assert.equal(h.log.pickup.length, 0);
      h.sim.step(.05, { ...at, x: x + 2.5 }, 7000); assert.equal(h.log.pickup.length, 1); assert.ok(h.log.pickup[0] === 1 || h.log.pickup[0] === 2); assert.equal(h.sim.ores.length, 0); }
    // A crystal is gone after its time.
    { const h = rig(); forceLavaEvent('normal'); h.sim.step(.05, at, 7000); h.sim.addOre(x + 5, z, 2); h.run(1.5, x, z); assert.equal(h.sim.ores.length, 1); h.run(1, x, z); assert.equal(h.sim.ores.length, 0); assert.equal(h.log.pickup.length, 0); }
    // The storm: every 1.6 to 3.1 s a fireball within 8 m, 1 s, r 1.4, 10%.
    forceLavaEvent('storm'); const s = rig(), balls = [];
    for (let i = 0; i < 20 * 40; i++) { s.sim.step(.05, at, 7000 + i * .05); for (const d of s.sim.drops) if (d.kind === 'fireball' && !balls.includes(d)) balls.push(d); }
    assert.ok(balls.length >= 11 && balls.length <= 26, `${balls.length} fireballs in 40 s`);
    for (const d of balls) { assert.equal(d.kind, 'fireball'); assert.ok(len(d.x - x, d.z - z) <= 8 + 1e-9 && d.r === 1.4 && d.duration === 1); }
    assert.ok(s.log.hurt.every(h => h[0] === .1 && h[1] === 'fire')); assert.equal(s.sim.ores.length, 0, 'a fireball leaves nothing');
    // Treasure: two crystals by each vent within 40 m, every 18 s, for 100 s.
    forceLavaEvent('treasure'); const t = rig(), vent = FEATURES.lava.vents[0], by = { x: vent.x + 12, z: vent.z, riding: false, box: true };
    for (let i = 0; i < 20 * 24; i++) t.sim.step(.05, by, 7000 + i * .05);
    assert.ok(t.sim.ores.length >= 2 && t.sim.ores.length <= 4, `${t.sim.ores.length} crystals after 24 s`); for (const o of t.sim.ores) { const far = len(o.x - vent.x, o.z - vent.z); assert.ok(far >= 2.5 - 1e-9 && far <= 5.5 + 1e-9); }
    // With the box shut the clock does not run: no name, no meteor.
    forceLavaEvent('meteor'); const shut = rig(); for (let i = 0; i < 20 * 20; i++) shut.sim.step(.05, { ...at, box: false }, 7000 + i * .05); assert.equal(shut.log.toast.length, 0); assert.equal(shut.sim.drops.length, 0); assert.equal(shut.sim.status(x, z), null);
    // The land line names the weather and its seconds.
    forceLavaEvent('storm'); const line = rig(); line.sim.step(.05, at, 7000); assert.deepEqual(line.sim.status(x, z), { icon: '🌪️', label: 'Weather', value: 'Magma storm · 240 seconds' });
  } finally { forceLavaEvent(null); }
});

test('toy trains: four cars a loop at 7 and 8 m/s; a pass is 15% and 2.2 m outward, at most once a second; box shut it only moves you', () => {
  const [a, b] = FEATURES.toy.tracks, p0 = trainPosition(a, 0), p1 = trainPosition(a, 1);
  assert.ok(near(len(p0.x - a.x, p0.z - a.z), 22) && near(Math.atan2(p1.z - a.z, p1.x - a.x), 7 / 22), 'the first loop turns at 7 m/s');
  assert.ok(near(trainPosition(b, 1).x, b.x + Math.cos(8 / 22) * 22)); assert.ok(near(len(trainPosition(a, 0, 1).x - p0.x, trainPosition(a, 0, 1).z - p0.z), 2 * 22 * Math.sin(2.4 / 44)), 'cars 2.4 m apart along the rail');
  // Standing on the rail while the train passes: one hit a second at most.
  const spot = trainPosition(a, 3), r = rig(); r.run(6, spot.x, spot.z);
  assert.ok(r.log.hurt.length >= 1 && r.log.hurt.length <= 2, `${r.log.hurt.length} hits from one four-car pass`); assert.ok(r.log.hurt.every(h => h[0] === .15 && h[1] === 'train'));
  assert.equal(r.log.push.length, r.log.hurt.length);
  for (const [dx, dz, opts] of r.log.push) { assert.ok(near(len(dx, dz), 2.2), 'a 2.2 m push'); assert.ok(near(dx / 2.2, (spot.x - a.x) / 22, 1e-6) && near(dz / 2.2, (spot.z - a.z) / 22, 1e-6), 'outward from the loop’s centre'); assert.deepEqual(opts, { car: true, crawl: true }); }
  // The same train never hits twice within a second, even when you stay under all four cars.
  { const t = rig(); let last = -9; for (let i = 0; i < 20 * 30; i++) { const before = t.log.hurt.length; t.sim.step(.05, { x: spot.x, z: spot.z, riding: false, box: true }, 1); if (t.log.hurt.length > before) { assert.ok(t.sim.time - last >= 1 - 1e-6); last = t.sim.time; } } assert.ok(t.log.hurt.length >= 2); }
  // Box shut: pushed, not hurt, and a car is not slowed. Riding with the box open: hurt and shoved, with crawl.
  const shut = rig(); shut.run(6, spot.x, spot.z, { box: false }); assert.equal(shut.log.hurt.length, 0); assert.ok(shut.log.push.length >= 1); assert.deepEqual(shut.log.push[0][2], { car: true, crawl: false });
  const rider = rig(); rider.run(6, spot.x, spot.z, { riding: true }); assert.deepEqual(rider.log.hurt.map(h => h[0]), r.log.hurt.map(h => h[0]), 'a rider is hurt exactly as a walker'); assert.deepEqual(rider.log.push[0][2], { car: true, crawl: true });
  // Off the rail nothing happens; the stand is 17.6 m from both loops.
  const safe = rig(); safe.run(20, ...STAND.toy); assert.equal(safe.log.hurt.length + safe.log.push.length, 0);
  for (const t of FEATURES.toy.tracks) assert.ok(Math.abs(len(t.x - STAND.toy[0], t.z - STAND.toy[1]) - t.r) >= 10, 'the stand is off both loops');
  assert.deepEqual(safe.sim.status(...STAND.toy), { icon: '🚂', label: 'Toy railway', value: 'Moving trains hurt explorers' });
  // With the box shut there is no HP: the line names the push, not a hurt (a reviewer read 'hurt explorers' with the box shut).
  assert.deepEqual(shut.sim.status(...STAND.toy), { icon: '🚂', label: 'Toy railway', value: 'Moving trains push explorers aside' });
});

test('jungle: poison 3.5% every 0.6 s; a raised thorn wall 5% every 0.6 s within 1.4 m, 16 s of every 36, and it does not block', () => {
  const patch = FEATURES.jungle.poison[0], r = rig(); r.run(3, patch.x, patch.z);
  assert.equal(r.log.hurt.length, 5, 'ticks at 0, 0.6, 1.2, 1.8 and 2.4 s'); assert.ok(r.log.hurt.every(h => h[0] === .035 && h[1] === 'poison'));
  assert.equal(r.sim.status(patch.x, patch.z).value, 'Poison gas! Leave the purple ground'); assert.equal(r.sim.status(patch.x + patch.r + 1, patch.z).value, 'Thorn walls rise for 16 of every 36 seconds'); assert.equal(r.sim.status(patch.x, patch.z).icon, '🌿');
  const edge = rig(); edge.run(3, patch.x + patch.r + .2, patch.z); assert.equal(edge.log.hurt.length, 0);
  const shut = rig(); shut.run(3, patch.x, patch.z, { box: false }); assert.equal(shut.log.hurt.length, 0);
  const rider = rig(); rider.run(3, patch.x, patch.z, { riding: true }); assert.equal(rider.log.hurt.length, 5, 'a rider breathes it too');
  // Thorns: the first wall (phase 0) is up for seconds 0 to 16 of every 36.
  assert.ok(thornRaised(0) && thornRaised(15.9) && !thornRaised(16) && !thornRaised(35.9) && thornRaised(36) && thornRaised(30, 10) && !thornRaised(10, 10));
  const wall = FEATURES.jungle.thorns[0], t = rig(); t.run(36, wall.x, wall.z);
  const hits = t.log.hurt.filter(h => h[1] === 'thorn'); assert.ok(hits.length >= 26 && hits.length <= 28, `${hits.length} ticks in 16 s raised`); assert.ok(hits.every(h => h[0] === .05));
  const end = thornPoints(wall)[4], tip = rig(); tip.run(2, end.x + Math.cos(wall.angle) * 1.3, end.z + Math.sin(wall.angle) * 1.3); assert.ok(tip.log.hurt.length > 0, 'within 1.4 m of its end');
  const off = rig(); off.run(2, end.x + Math.cos(wall.angle) * 1.5, end.z + Math.sin(wall.angle) * 1.5); assert.equal(off.log.hurt.length, 0);
  // It hurts and never blocks: a wall is in no blocker list, raised or not.
  assert.equal(blockers('jungle').length, 1); assert.ok(blockers('jungle').every(b => FEATURES.jungle.ponds.some(p => p.x === b.x)));
  const lowered = rig(); lowered.sim.time = 20; lowered.run(5, wall.x, wall.z); assert.equal(lowered.log.hurt.length, 0, 'a lowered wall is harmless');
});

test('ice and the sea: the velocity follows the stick at 2.8 a second and coasts at 1.6; wading is 0.6; a car does neither', () => {
  const [x, z] = STAND.ice, r = rig(), speed = 4.8;
  // One second of full stick east: v = speed × (1 - e^-2.8).
  let w; for (let i = 0; i < 60; i++) w = r.sim.walk({ dx: 1, dz: 0, speed, riding: false }, 1 / 60, x, z);
  assert.ok(near(w.vx, speed * (1 - Math.exp(-2.8)), 1e-6) && w.vz === 0, `after 1 s of input: ${w.vx.toFixed(3)} m/s`); assert.equal(w.limit, 1); assert.equal(w.nodeReach, 1, 'a tapped walk drops a node within 1 m on ice');
  // Then one second of none: it decays by e^-1.6, and is still moving after 0.5 s.
  const before = w.vx; for (let i = 0; i < 30; i++) w = r.sim.walk({ dx: 0, dz: 0, speed, riding: false }, 1 / 60, x, z);
  assert.ok(near(w.vx, before * Math.exp(-.8), 1e-6) && w.vx > 1.5, `0.5 s after release: ${w.vx.toFixed(2)} m/s`);
  for (let i = 0; i < 30; i++) w = r.sim.walk({ dx: 0, dz: 0, speed, riding: false }, 1 / 60, x, z); assert.ok(near(w.vx, before * Math.exp(-1.6), 1e-6));
  // The frame rate does not matter.
  { const a = rig(), b = rig(); let wa, wb; for (let i = 0; i < 20; i++) wa = a.sim.walk({ dx: 0, dz: 1, speed }, .05, x, z); for (let i = 0; i < 100; i++) wb = b.sim.walk({ dx: 0, dz: 1, speed }, .01, x, z); assert.ok(near(wa.vz, wb.vz, 1e-9)); }
  // A rider on ice, and a walker anywhere else: the plain velocity at once.
  w = r.sim.walk({ dx: 0, dz: 1, speed: 20, riding: true }, 1 / 60, x, z); assert.deepEqual([w.vx, w.vz, w.limit, w.nodeReach], [0, 20, 1, .22]);
  w = r.sim.walk({ dx: 1, dz: 0, speed, riding: false }, 1 / 60, 0, 0); assert.deepEqual([w.vx, w.vz, w.limit, w.nodeReach], [speed, 0, 1, .22]);
  w = r.sim.walk({ dx: 0, dz: 0, speed, riding: false }, 1 / 60, 0, 0); assert.deepEqual([w.vx, w.vz], [0, 0], 'off the ice you stop dead');
  // The sea: 0.6 on foot and in a car; the sand 1. walk() returns the velocity before the limit.
  w = r.sim.walk({ dx: 1, dz: 0, speed, riding: false }, 1 / 60, ...SEA); assert.deepEqual([w.vx, w.limit], [speed, .6]);
  assert.equal(r.sim.carLimit(...SEA), .6); assert.equal(r.sim.carLimit(...P(270, 300)), .6); assert.equal(r.sim.carLimit(...SAND), 1); assert.equal(r.sim.carLimit(0, 0), 1);
  // The land line on ice is the reference's.
  assert.deepEqual(r.sim.status(x, z), { icon: '❄️', label: 'Ice', value: 'Slippery — release early to brake' }); assert.equal(r.sim.status(0, 0), null); assert.equal(r.sim.status(...SAND), null); assert.equal(r.sim.status(...STAND.east), null);
  // Ice hurts nobody and steps nothing.
  r.run(5, x, z); assert.equal(r.log.hurt.length + r.log.push.length, 0);
});

test('the cloud: lightning 12% within 1.8 m, 1.2 s after its mark and toast; a gust pushes 3.2 m/s for 3.5 s and turns 2.399 rad', () => {
  const [x, z] = STAND.cloud, at = { x, z, riding: false, box: true };
  // Lightning: the first after 6 s, then every 7 to 13 s, 2 to 9 m from you.
  const r = rig(), seen = [], times = [];
  for (let i = 0; i < 20 * 60; i++) { r.sim.step(.05, at, 1); for (const d of r.sim.drops) if (!seen.includes(d)) { seen.push(d); times.push(r.sim.time); } }
  assert.ok(seen.length >= 5 && seen.length <= 8, `${seen.length} bolts in a minute`); assert.ok(near(times[0], 6, .06));
  for (const d of seen) { const far = len(d.x - x, d.z - z); assert.equal(d.kind, 'bolt'); assert.ok(far >= 2 - 1e-9 && far <= 9 + 1e-9 && d.r === 1.8 && d.duration === 1.2); }
  for (let i = 1; i < times.length; i++) assert.ok(times[i] - times[i - 1] >= 7 - .06 && times[i] - times[i - 1] <= 13 + .06);
  assert.equal(r.log.toast.filter(t => t === BOLT_TEXT).length, seen.length, 'one warning a bolt');
  // One that strikes beside you: 12%, source 'bolt'; a rider the same; outside 1.8 m nothing.
  for (const [dx, riding, want] of [[1.5, false, [[.12, 'bolt']]], [1.5, true, [[.12, 'bolt']]], [1.9, false, []]]) {
    const h = rig(); h.sim.bolt.wait = 99; h.sim.step(.05, { ...at, riding }, 1); h.sim.drops.push({ kind: 'bolt', x: x + dx, z, r: 1.8, age: 0, duration: 1.2 });
    for (let i = 0; i < 25; i++) h.sim.step(.05, { ...at, riding }, 1); assert.deepEqual(h.log.hurt, want);
  }
  // Box shut: no lightning.
  const shut = rig(); shut.run(30, x, z, { box: false }); assert.equal(shut.sim.drops.length, 0); assert.equal(shut.log.toast.filter(t => t === BOLT_TEXT).length, 0); assert.equal(shut.log.hurt.length, 0);
  // Gusts act with the box shut too: one warning at second 18, a push from 20 to 23.5 s, 3.2 m/s; the next turns 2.399 rad.
  const g = rig(); g.sim.bolt.wait = 1e9;
  const sums = [[0, 0], [0, 0]]; let lineSeen = 0;
  for (let i = 0; i < 20 * 50; i++) { const before = g.log.push.length; g.sim.step(.05, { ...at, box: false }, 1); for (const [dx, dz] of g.log.push.slice(before)) { const c = Math.floor((g.sim.time - 1e-9) / 25); sums[c][0] += dx; sums[c][1] += dz; assert.ok(g.sim.time % 25 >= 20 - 1e-6 && g.sim.time % 25 <= 23.5 + .051); } if (g.sim.status(x, z)) lineSeen++; }
  assert.equal(g.log.toast.filter(t => t === GUST_TEXT).length, 2, 'one warning a gust');
  assert.ok(near(len(...sums[0]), 3.2 * 3.5, .2) && near(len(...sums[1]), 3.2 * 3.5, .2), `a gust carries ${len(...sums[0]).toFixed(2)} m`);
  assert.ok(near(Math.atan2(sums[0][1], sums[0][0]), 0, 1e-6), 'the first blows along +x'); const turn = Math.atan2(sums[1][1], sums[1][0]) - Math.atan2(sums[0][1], sums[0][0]); assert.ok(near(((turn % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), 2.399, 1e-6), 'the next has turned 2.399 rad');
  assert.ok(near(lineSeen / 20, 7, .2), 'the land line shows for the 3.5 s of each gust');
  { const s = rig(); s.sim.time = 21; s.sim.step(.05, { ...at, box: false }, 1); assert.deepEqual(s.sim.status(x, z), { icon: '☁️', label: 'Cloud Meadow', value: 'Strong gust — brace' }); }
  // A rider is not moved by a gust.
  const rider = rig(); rider.sim.bolt.wait = 1e9; rider.run(30, x, z, { riding: true }); assert.equal(rider.log.push.length, 0);
  // A gust moves you only through the host's push, which blocks: when the host refuses, the simulation moves nothing itself.
  const wall = rig({ push: () => false }); wall.sim.bolt.wait = 1e9; wall.run(30, x, z); assert.equal(wall.sim.x, x); assert.equal(wall.sim.z, z);
});

test('the Night Land: a lit lamp is a disc for 150 s, heals 3% a second, and is where no creature goes; the dark and its holes', () => {
  const lamps = FEATURES.shadow.lamps, lamp = lamps[0], [x, z] = STAND.shadow, r = rig();
  assert.equal(r.sim.lampAt(lamp.x, lamp.z), false); assert.deepEqual(r.sim.status(x, z), { icon: '🏮', label: 'Light', value: 'Light pillars reveal and repel shadow creatures' });
  // A tap lights it; walking up to it does too.
  assert.equal(r.sim.light(0), true); assert.equal(r.sim.light(99), false); assert.equal(r.sim.lampLit(0), true); assert.equal(r.sim.lampAt(lamp.x + 7.9, lamp.z), true); assert.equal(r.sim.lampAt(lamp.x + 8.1, lamp.z), false);
  assert.equal(r.sim.status(lamp.x + 2, lamp.z).value, 'Safe light — healing');
  r.run(10, lamp.x + 3, lamp.z); assert.ok(near(r.log.heal, .3, 1e-6), `10 s in its light heal ${(r.log.heal * 100).toFixed(1)}%`); assert.equal(r.log.hurt.length, 0);
  r.run(139, x, z); assert.equal(r.sim.lampLit(0), true, 'still lit at 149 s'); assert.ok(near(r.sim.lampLeft(0), 1, .01)); r.run(1.1, x, z); assert.equal(r.sim.lampLit(0), false, 'out after 150 s'); assert.equal(r.sim.lampAt(lamp.x, lamp.z), false);
  const walker = rig(); walker.run(.1, lamps[1].x + 1, lamps[1].z); assert.equal(walker.sim.lampLit(1), true, 'walking up lights it'); assert.equal(walker.sim.lampLit(0), false);
  const shut = rig(); shut.sim.light(0); shut.run(5, lamp.x + 3, lamp.z, { box: false }); assert.equal(shut.log.heal, 0, 'nothing to heal with the box shut');
  // An eclipse puts every lamp out for its length and shrinks your own light to 0.4.
  const e = rig(); e.sim.light(0); e.sim.eclipse(6); assert.equal(e.sim.lampLit(0), false); assert.equal(e.sim.lampAt(lamp.x, lamp.z), false); assert.ok(near(e.sim.holes(x, z)[0].r, 3.6 * .4));
  e.run(6.1, x, z); assert.equal(e.sim.lampLit(0), true, 'the lamp burns on after it'); assert.equal(e.sim.holes(x, z)[0].r, 3.6);
  // The holes: you (3.6 m, 7.5 m with a light trophy), the lit lamps (8 m), the 4 nearest flowers within 28 m (2.4 m). The list is reused.
  const h = rig(), out = []; assert.equal(h.sim.holes(x, z, false, out), out); assert.deepEqual([out[0].x, out[0].z, out[0].r], [x, z, 3.6]); assert.equal(h.sim.holes(x, z, true, out)[0].r, 7.5);
  const flowers = FEATURES.shadow.flowers.map(p => len(p.x - x, p.z - z)).filter(d => d < 28).sort((a, b) => a - b).slice(0, 4);
  assert.equal(out.length, 1 + flowers.length); assert.ok(out.slice(1).every(o => o.r === 2.4)); assert.ok(near(len(out[1].x - x, out[1].z - z), flowers[0]));
  for (let i = 0; i < 4; i++) h.sim.light(i); h.sim.holes(x, z, false, out); assert.equal(out.length, 1 + 4 + flowers.length); assert.ok(out.length <= 9); assert.deepEqual(out.slice(1, 5).map(o => o.r), [8, 8, 8, 8]);
  // The dark: none outside the Night Land, full from 24 m inside its shared border, still full at its outer edge.
  const N = d => P(RING.R1 + d, 67.5);
  assert.equal(nightShare(0, 0), 0); assert.equal(nightShare(...P(120, 70)), 0); assert.equal(nightShare(...STAND.lava), 0, 'not in another land');
  assert.equal(nightShare(...N(0)), 0); assert.ok(near(nightShare(...N(12)), .5, 1e-3)); assert.equal(nightShare(...N(24)), 1); assert.equal(nightShare(...N(100)), 1); assert.equal(nightShare(...N(135.9)), 1); assert.ok(near(homeBorderDistance(...N(135.9)), 135.9, 1e-6));
  assert.equal(LAND.night.opacity, .93); assert.equal(LAND.lamp.seconds, 150);
});

test('nothing hurts with the box shut, in any land; and the ground paint follows the features', () => {
  const spots = [FEATURES.lava.pools[0], FEATURES.lava.vents[0], FEATURES.jungle.poison[0], FEATURES.jungle.thorns[0], trainPosition(FEATURES.toy.tracks[0], 3), { x: STAND.cloud[0], z: STAND.cloud[1] }, { x: STAND.ice[0], z: STAND.ice[1] }, FEATURES.shadow.lamps[0]];
  try { for (const event of ['eruption', 'meteor', 'storm', 'treasure', 'dragon', 'normal']) { forceLavaEvent(event); for (const p of spots) { const r = rig(); r.run(40, p.x, p.z, { box: false }, 5000); assert.equal(r.log.hurt.length, 0, `${event} at (${p.x.toFixed(0)}, ${p.z.toFixed(0)})`); assert.equal(r.log.heal, 0); } } } finally { forceLavaEvent(null); }
  // The paint: a plain {r, g, b} is recoloured in place and returned.
  const grey = () => ({ r: .5, g: .5, b: .5 }), changed = c => c.r !== .5 || c.g !== .5 || c.b !== .5;
  const pond = FEATURES.west.ponds[0]; { const c = grey(); assert.equal(GROUND.west.paint(pond.x + pond.r + .5, pond.z, c), c); assert.ok(changed(c), 'sand round a pond'); assert.ok(!changed(GROUND.west.paint(pond.x + pond.r + 4, pond.z, grey()))); }
  const isle = FEATURES.cloud.islands[0]; assert.ok(!changed(GROUND.cloud.paint(isle.x, isle.z, grey())), 'an island keeps its grass'); { const c = GROUND.cloud.paint(isle.x + isle.r + 4, isle.z - 9, grey()); assert.ok(c.r > .7 && c.b > .85, 'the cloud floor is pale'); }
  assert.ok(GROUND.ocean.paint(...SEA, grey()).b > .6 && !changed(GROUND.ocean.paint(...P(240, 292.5), grey())), 'the sea bed is sea-coloured');
  { const p = FEATURES.lava.pools[0], ring = k => Array.from({ length: 12 }, (_, i) => GROUND.lava.paint(p.x + Math.cos(i / 12 * Math.PI * 2) * (p.r + k), p.z + Math.sin(i / 12 * Math.PI * 2) * (p.r + k), grey()));
    assert.ok(ring(.5).every(c => c.r > .7 && c.b < .1), 'the rim of a pool burns'); assert.ok(ring(1.6).filter(c => c.r < .4 && c.b < .3).length >= 8, 'scorched beyond it (the ember seams cross some of it)'); assert.ok(!changed(GROUND.toy.paint(...STAND.toy, grey())), 'the open ground is unpainted'); }
  for (const id of ['candy', 'toy', 'jungle', 'ice', 'shadow', 'south']) { const p = FEATURES[id].ponds[0]; assert.ok(changed(GROUND[id].paint(p.x, p.z + p.r + .5, grey())), id); }
  assert.equal(GROUND.north.paint, undefined); assert.equal(GROUND.east.paint, undefined);
});
