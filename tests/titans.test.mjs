// The nine titans (round 8, builder D2): the ported patterns against Zoo Garden's own, the rows, the turn in the simulation
// (hard leash, clamped leap, marks, summon, pull), the loot and the eighteen trophies. Spec 4.2 to 4.5, 12.3.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { freshState, act } from '../src/game.mjs';
import { ITEMS } from '../src/content.mjs';
import { GEAR, gearStats, kitOf, gearOf, FLYING_PETS } from '../src/gear.mjs';
import { LOOT, rollLoot, spareGearCoins, maxHp, defeatCoins } from '../src/pandora.mjs';
import { CREATURES, AI, STEP, Wilds, wildCell, windupProgress, loadTitanTurn } from '../src/wilds.mjs';
import { DENS, REGION, regionAt, squareOf, LEVELS, levelAt } from '../src/regions.mjs';
import { SAFE, inSafeZone } from '../src/ward.mjs';
import { POWER } from '../src/region-mix.mjs';
import { TITAN_ROWS, TITAN_GEAR, TITAN_LOOT, TITAN_LOOT_SPEC, TITAN_IDS, TITAN_SIZE, titanStats } from '../src/titans.mjs';
import { TITAN, TITAN_WINDUPS, TITAN_COLORS, TITAN_CALLOUTS, TITAN_LIFE, TITAN_MOVE_SETS, isTitanSkill, titanTelegraphs, beginTitanAttack, stepTitanAttack, titanSkill, titanState, titanAttacks, titanMarks, titanLimit } from '../src/titan-patterns.mjs';
// wilds.mjs fetches a titan's turn (titan-patterns.mjs titanTurn) with import(), so that it is not read before the first frame: wait for it here.
await loadTitanTurn();

const SKILLS = Object.keys(TITAN_WINDUPS);
const lcg = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const open = () => { const s = freshState(); assert.ok(act(s, 'pandora', { open: true }).ok); return s; };
const denOf = type => DENS.find(d => d.type === type);
/** A player standing (dx, dz) from a titan's den. */
const beside = (type, dx, dz) => ({ x: denOf(type).x + dx, z: denOf(type).z + dz, active: true });
/** The outward end of a titan's leash along the radius from the village: {x, z, ux, uz} (ux, uz the unit vector pointing to the rim). */
const rimEnd = (a, k = titanLimit(a.e)) => { const r = Math.hypot(a.den.x, a.den.z), ux = a.den.x / r, uz = a.den.z / r; return { x: a.den.x + ux * k, z: a.den.z + uz * k, ux, uz }; };
/** A Wilds with one titan at its den (and whatever commons its cells seed), a player and the blows, pulls and events it causes. */
function arena(type, { player, blocked, list = false } = {}) {
  const den = denOf(type), blows = [], pulls = [], events = [];
  const hero = player ?? { x: den.x, z: den.z + 40, active: true };
  const wilds = new Wilds({ blocked, hurt: (amount, source, e) => blows.push({ amount, source, type: e?.type }), pull: (dx, dz) => pulls.push([dx, dz]), emit: (kind, e) => events.push([kind, e.type]) }, lcg(5));
  if (list) wilds.sync(true, den.x, den.z);
  const e = list ? wilds.list.find(c => c.id === den.id) : wilds.make(wildCell(Math.floor(den.x / 32), Math.floor(den.z / 32)).find(p => p.id === den.id));
  if (!list) wilds.list.push(e);
  e.born = 0;
  const run = (seconds, each) => { for (let t = 0; t < seconds - 1e-9; t += STEP) { each?.(t); wilds.step(STEP, hero); } };
  return { wilds, e, den, hero, blows, pulls, events, run, home: () => Math.hypot(e.x - den.x, e.z - den.z) };
}

// ---------------------------------------------------------------- the port
// Made from Zoo Garden's own src/titan-patterns.ts (f7d3584) with the generator below: for every skill, the marks of a wind-up
// (source (30, 0) radius 3.15 facing 0.7, aimed at (38, 9), a second target at (22, -6), seed 91571) and every hit, pull and burst
// of the attack stepped at 25 ms. The port gives the same bytes.
const GOLDEN = {"sweep":{"marks":8,"first":[25.6,2.68,1.2,1.3,null,-1.023358,false],"markHash":"f9860df0d8246b3d","traceHash":"e497e671e077ebec","events":2,"mult":[0.9]},"pull":{"marks":1,"first":[30,0,7.15,1.1,null,null,false],"markHash":"2f629dcc7f838535","traceHash":"9d39a81ba932ddf3","events":56,"mult":[]},"lines":{"marks":42,"first":[33.51,4.17,1.3,1.2,1,null,false],"markHash":"ec802d48849d22fc","traceHash":"e1dc1c7b54c1fb75","events":8,"mult":[1.2]},"bombard":{"marks":16,"first":[38,9,2.4,1.3,0,null,false],"markHash":"4cf2a50a98a4a4d0","traceHash":"f5a64d9425fc9e5c","events":6,"mult":[1.3]},"leap":{"marks":1,"first":[38,9,6.5,1,null,null,false],"markHash":"fb71304e0e6c8720","traceHash":"f61d0a1112840aa2","events":2,"mult":[2.2]},"donut":{"marks":2,"first":[30,0,14.15,1.6,null,null,false],"markHash":"98d993786143ade8","traceHash":"ead2f306b96f46f7","events":2,"mult":[1.7]},"orbs":{"marks":1,"first":[30,0,4.15,1,null,null,false],"markHash":"ca8f3d833ce368e7","traceHash":"93bed9c6708b9ece","events":4,"mult":[1.2]},"pools":{"marks":5,"first":[38,9,2.8,1.2,null,null,false],"markHash":"2b8c8e20909f61a4","traceHash":"3bfed033f2daaa15","events":14,"mult":[0.3]},"summon":{"marks":1,"first":[30,0,5.15,1.1,null,null,false],"markHash":"e9388453fcc29c02","traceHash":"e67409cd1cde45c5","events":2,"mult":[]},"stomp4":{"marks":4,"first":[38.45,8.23,3.6,1,0,null,false],"markHash":"94ef76d164237cac","traceHash":"d1d8c1f65f222711","events":5,"mult":[1.4]}};
function trace(P) {
  const source = { x: 30, z: 0, radius: 3.15, facing: .7 }, target = { id: 'player', x: 38, z: 9 }, others = [target, { id: 'b', x: 22, z: -6 }], out = {};
  for (const skill of Object.keys(P.TITAN_WINDUPS)) {
    const marks = P.titanTelegraphs(skill, source, target, others, lcg(91571)), a = P.beginTitanAttack(skill, source, marks, others), steps = [];
    for (let i = 0; i < 400; i++) { const r = P.stepTitanAttack(a, .025, source, others); if (r.hits.length || r.pulls.length || r.bursts.length || r.summon) steps.push([i, r.hits.map(h => [h.id, h.multiplier, h.source]), r.pulls.map(p => [p.id, +p.x.toFixed(6), +p.z.toFixed(6)]), r.bursts.map(b => [+b.x.toFixed(2), +b.z.toFixed(2), +b.r.toFixed(2)]), r.summon]); if (r.done) { steps.push(['done', i]); break; } }
    const m = marks.map(p => [p.x, p.z, p.r, +p.delay.toFixed(4), p.k ?? null, p.a === undefined ? null : +p.a.toFixed(6), !!p.safe]);
    out[skill] = { marks: marks.length, first: m[0], markHash: createHash('sha256').update(JSON.stringify(m)).digest('hex').slice(0, 16), traceHash: createHash('sha256').update(JSON.stringify(steps)).digest('hex').slice(0, 16), events: steps.length, mult: [...new Set(steps.flatMap(t => (t[1] ?? []).map?.(h => h[1]) ?? []))] };
  }
  return out;
}
const P = { TITAN_WINDUPS, titanTelegraphs, beginTitanAttack, stepTitanAttack };

test('the ported patterns give the reference’s marks, hits, pulls and bursts for each of the ten skills', async t => {
  assert.deepEqual(SKILLS, ['sweep', 'pull', 'lines', 'bombard', 'leap', 'donut', 'orbs', 'pools', 'summon', 'stomp4']);
  assert.deepEqual(trace(P), GOLDEN);
  assert.deepEqual(TITAN_WINDUPS, { sweep: 1.3, pull: 1.1, lines: 1.2, bombard: 1.3, leap: 1, donut: 1.6, orbs: 1, pools: 1.2, summon: 1.1, stomp4: 1 });
  assert.deepEqual(TITAN_LIFE, { sweep: 2.2, pull: 1.35, lines: 1.2, bombard: 2.3, leap: .8, donut: .35, orbs: 7, pools: 7, summon: .3, stomp4: 1.3 });
  for (const skill of SKILLS) { assert.match(TITAN_COLORS[skill], /^#[0-9a-f]{6}$/); assert.ok(TITAN_CALLOUTS[skill].startsWith('⚠️ ')); assert.ok(isTitanSkill(skill)); }
  assert.equal(isTitanSkill('slam'), false); assert.equal(isTitanSkill(''), false); assert.equal(isTitanSkill('toString'), false);
  // With Zoo Garden beside this repo, the same trace is taken from its TypeScript, live.
  const reference = new URL('../../cute_game/src/titan-patterns.ts', import.meta.url);
  await t.test('live, against cute_game/src/titan-patterns.ts', { skip: !existsSync(reference) || !process.features?.typescript ? 'the reference is not beside this repo, or this node cannot load TypeScript' : false }, async () => {
    assert.deepEqual(trace(await import(reference.href)), GOLDEN);
  });
});

// The reference's own cases (cute_game tests/titans.test.ts), ported.
const source = { x: 30, z: 0, radius: 4, facing: 0 }, target = { id: 'player', x: 30, z: 10 };
const attack = skill => beginTitanAttack(skill, source, titanTelegraphs(skill, source, target, [target], () => .5), [target]);
test('every titan action shows marks and ends with finite effects', () => {
  for (const skill of SKILLS) {
    const a = attack(skill); assert.ok(a.marks.length, skill); let step;
    for (let i = 0; i < 150 && !step?.done; i++) step = stepTitanAttack(a, .05, source, [target]);
    assert.equal(step?.done, true, skill); assert.ok(a.orbs.every(o => Number.isFinite(o.x) && Number.isFinite(o.z)));
    assert.equal(JSON.parse(JSON.stringify(a)).skill, skill, 'an attack is plain data');
  }
});
test('the death ring hurts its outer band while the green inner circle is safe', () => {
  const result = stepTitanAttack(attack('donut'), .05, source, [{ id: 'safe', x: 30, z: 4 }, { id: 'edge', x: 30, z: 7 }, { id: 'outside', x: 30, z: 16 }]);
  assert.deepEqual(result.hits.map(h => h.id), ['edge']); assert.equal(result.hits[0].multiplier, 1.7);
  const marks = titanTelegraphs('donut', source, target); assert.deepEqual(marks.map(m => [m.r, !!m.safe]), [[15, false], [5.5, true]]);
});
test('a bombardment warns before it lands and hits the centre of its mark once', () => {
  const a = attack('bombard'); assert.equal(a.marks.length, 15); assert.equal(stepTitanAttack(a, .44, source, [target]).hits.length, 0);
  const impact = stepTitanAttack(a, .02, source, [target]); assert.ok(impact.hits.some(h => h.id === 'player' && h.multiplier === 1.3 && h.source === 'hazard'));
  assert.equal(stepTitanAttack(a, .01, source, [target]).hits.length, 0);
});
test('the pull drags a walker but not a flyer, and bursts after its warning', () => {
  const a = attack('pull'), flying = { ...target, id: 'fly', airborne: true };
  const first = stepTitanAttack(a, .1, source, [target, flying]); assert.deepEqual(first.pulls.map(p => p.id), ['player']); assert.ok(first.pulls[0].z < 0); assert.equal(first.hits.length, 0);
  // 10 m away: (9 - 0.25 x 10) m/s for 0.1 s.
  assert.ok(near(first.pulls[0].z, -.65)); assert.equal(first.pulls[0].x, 0);
  const final = stepTitanAttack(a, 1.21, source, [{ ...target, z: 0 }]); assert.equal(final.hits[0].multiplier, 1.8);
});
test('poison pools tick every half second and stand still while the world is paused', () => {
  const a = attack('pools'); assert.ok(a.marks.length >= 5); assert.equal(stepTitanAttack(a, .39, source, [target]).hits.length, 0); assert.equal(stepTitanAttack(a, 0, source, [target]).hits.length, 0);
  assert.equal(a.age, .39); const tick = stepTitanAttack(a, .02, source, [target]); assert.equal(tick.hits.length, 1); assert.equal(tick.hits[0].multiplier, .3);
  assert.equal(stepTitanAttack(a, .48, source, [target]).hits.length, 0); assert.equal(stepTitanAttack(a, .03, source, [target]).hits.length, 1);
});
test('the leap lands on its mark, harder in the middle', () => {
  const a = attack('leap'); assert.ok(stepTitanAttack(a, .4, source, []).move.y > 7);
  const land = stepTitanAttack(a, .4, source, [target, { ...target, id: 'edge', x: 34 }]); assert.deepEqual(land.move, { x: 30, z: 10, y: Math.sin(Math.PI) * 8 }); assert.deepEqual(land.hits.map(h => h.multiplier), [2.2, 1.5]);
});
test('homing orbs speed up, do not tunnel, and hit once each', () => {
  const a = attack('orbs'); assert.equal(a.orbs.length, 5); let hits = 0; for (let i = 0; i < 150; i++) hits += stepTitanAttack(a, .05, source, [target]).hits.length;
  assert.ok(hits > 0 && hits <= 5); assert.equal(stepTitanAttack(a, 1, source, [target]).hits.length, 0);
  for (const orb of attack('orbs').orbs) assert.ok(near(Math.hypot(orb.vx, orb.vz), 6));
});
test('the other four: the sweep, the rays, the stomps and the summon', () => {
  // The sweep: eight marks on its starting line, a beam turning 3.5 rad in 2.2 s that hits at most every 0.45 s.
  const sweep = attack('sweep'); assert.equal(sweep.marks.length, 8); assert.ok(sweep.marks.every(m => m.r === 1.2 && near(m.a, -1.75)));
  let hits = [], ages = []; for (let i = 0; i < 88; i++) { const r = stepTitanAttack(sweep, .025, source, [target]); if (r.hits.length) { hits.push(...r.hits); ages.push(sweep.age); } }
  assert.ok(hits.length >= 1 && hits.every(h => h.multiplier === .9 && h.source === 'shot')); for (let i = 1; i < ages.length; i++) assert.ok(ages[i] - ages[i - 1] >= .45 - 1e-9);
  assert.equal(stepTitanAttack(attack('sweep'), .5, source, [{ id: 'far', x: 30, z: 22 }]).hits.length, 0, 'the beam reaches radius + 17 m, no farther');
  // The rays: six of seven marks, 2.3 m apart, each bursting 0.06 + 0.11 k s in.
  const lines = attack('lines'); assert.equal(lines.marks.length, 42); assert.deepEqual([...new Set(lines.marks.map(m => m.k))], [1, 2, 3, 4, 5, 6, 7]);
  assert.ok(near(Math.hypot(lines.marks[1].x - lines.marks[0].x, lines.marks[1].z - lines.marks[0].z), 2.3, .011));
  const onRay = { id: 'ray', x: lines.marks[2].x, z: lines.marks[2].z }; assert.equal(stepTitanAttack(lines, .38, source, [onRay]).hits.length, 0); const burst = stepTitanAttack(lines, .02, source, [onRay]); assert.equal(burst.hits[0].multiplier, 1.2);
  // The stomps: four marks of 3.6 m, 0.35 s apart.
  const stomps = attack('stomp4'); assert.deepEqual(stomps.marks.map(m => [m.r, m.k, +m.delay.toFixed(2)]), [[3.6, 0, 1], [3.6, 1, 1.35], [3.6, 2, 1.7], [3.6, 3, 2.05]]);
  const got = []; for (let i = 0; i < 52; i++) for (const h of stepTitanAttack(stomps, .025, source, [target]).hits) got.push([h.multiplier, +stomps.age.toFixed(3)]);
  assert.deepEqual(got.map(g => g[0]), [1.4, 1.4, 1.4, 1.4]); assert.deepEqual(got.map(g => g[1]), [.075, .425, .775, 1.125]);
  // The summon asks once, at once.
  const call = attack('summon'), first = stepTitanAttack(call, .025, source, [target]); assert.equal(first.summon, true); assert.equal(first.hits.length, 0); assert.equal(stepTitanAttack(call, .025, source, [target]).summon, false);
});

// ---------------------------------------------------------------- the rows
// Spec 4.2 and 4.3: sized reach and radius, the drawn scale, speed, flying, the skills in order.
const ROWS = {
  titan_turtle: ['Ancient Mountain Turtle', 'east', 1500, 30, 3000, 22, 4.875, 3.15, 1.8, 1.4, false, ['stomp4', 'lines', 'leap', 'summon', 'donut']],
  titan_clock: ['Clockwork Spider', 'toy', 1500, 30, 3000, 22, 4.875, 3.15, 1.8, 2, false, ['bombard', 'sweep', 'summon', 'lines', 'orbs']],
  titan_hydra: ['Three-Headed Candy Hydra', 'candy', 1600, 32, 3400, 22, 4.875, 2.85, 1.725, 1.8, false, ['sweep', 'orbs', 'pools', 'bombard', 'summon']],
  titan_flower: ['Death Flower Rafflesia', 'jungle', 1650, 32, 3400, 20, 6.75, 3, 1.8, 0, false, ['pull', 'pools', 'orbs', 'summon', 'donut']],
  titan_crystal: ['Ice Crystal Queen', 'ice', 1700, 34, 3800, 22, 4.875, 2.7, 1.65, 1.6, true, ['lines', 'orbs', 'donut', 'sweep', 'bombard']],
  titan_kraken: ['Abyssal Kraken', 'ocean', 1750, 34, 3800, 22, 6, 3.3, 1.8, 1.6, false, ['pull', 'sweep', 'stomp4', 'pools', 'bombard']],
  titan_scorpion: ['Inferno Scorpion', 'lava', 1800, 38, 4400, 22, 5.25, 3.3, 1.8, 2, false, ['pools', 'leap', 'lines', 'sweep', 'stomp4']],
  titan_whale: ['Celestial Cloud Whale', 'cloud', 1850, 38, 4400, 24, 5.25, 3.45, 1.875, 2.2, true, ['bombard', 'orbs', 'pull', 'lines', 'donut']],
  titan_eye: ['Void Eye', 'shadow', 2000, 40, 5200, 24, 5.625, 2.85, 1.725, 1.8, true, ['sweep', 'pull', 'orbs', 'donut', 'lines', 'bombard']],
};
/** Spec 4.2: scaled health, damage and coins. */
const SCALED = { titan_turtle: [10500, 48, 1500], titan_clock: [17850, 81.6, 1920], titan_hydra: [29120, 133.1, 2788], titan_flower: [30030, 133.1, 2788], titan_crystal: [42840, 195.8, 3876], titan_kraken: [44100, 195.8, 3876], titan_scorpion: [60480, 291.8, 5544], titan_whale: [62160, 291.8, 5544], titan_eye: [86800, 396.8, 8008] };

test('nine titans, one in each land and one in the canyon, with the sized numbers of the reference', () => {
  assert.deepEqual([...TITAN_IDS].sort(), Object.keys(ROWS).sort()); assert.equal(TITAN_SIZE, .75);
  assert.equal(new Set(Object.values(TITAN_ROWS).map(d => d.land)).size, 9);
  for (const [id, [name, land, hp, damage, xp, sight, reach, radius, scale, speed, flying, skills]] of Object.entries(ROWS)) {
    const d = TITAN_ROWS[id]; assert.equal(CREATURES[id], d, `${id} is in CREATURES`);
    assert.deepEqual([d.name, d.land, d.hp, d.damage, d.xp, d.coins, d.sight, d.reach, d.radius, d.scale, d.speed, d.flying], [name, land, hp, damage, xp, xp / 2, sight, reach, radius, scale, speed, flying], id);
    assert.deepEqual([d.behavior, d.boss, d.titan, d.windup], ['titan', true, true, .8], id); assert.ok(d.cooldown >= 2.1 && d.cooldown <= 2.6);
    assert.deepEqual([...d.skills], skills, `${id}: skills in order`); assert.deepEqual([...TITAN_MOVE_SETS[id]], skills); assert.ok(skills.length >= 5 && skills.every(isTitanSkill));
    for (const key of ['color', 'accent', 'glow']) assert.match(d[key], /^#[0-9a-f]{6}$/);
    // Its den: in its own land, with the clearing and the leash of a titan, and at the level the row shows.
    const den = denOf(id); assert.ok(den.titan); assert.deepEqual([den.region, den.leash, den.clear, den.level], [land, 30, 24, REGION[land].kind === 'land' ? Math.min(LEVELS[land].hi + 1, levelAt(den.x, den.z) + 3) : d.level]); assert.equal(regionAt(den.x, den.z), land);
    // Its model: one file of its own, the root named after the type, and as tall as the reference draws it (height x 0.75).
    const file = new URL(`../public/assets/models/${d.file}.glb`, import.meta.url); assert.ok(existsSync(file), `${d.file}.glb`);
    const b = readFileSync(file), json = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8')); assert.deepEqual(json.scenes[0].nodes.map(i => json.nodes[i].name), [id]);
    const top = Math.max(...json.meshes.flatMap(m => m.primitives.map(p => json.accessors[p.attributes.POSITION].max[1]))); assert.ok(near(top * d.scale, d.height, .02), `${id}: ${top} x ${d.scale} is ${d.height} m tall`);
    assert.ok(b.length < 80_000, `${d.file}.glb is a small file (${b.length} bytes)`);
  }
  // The all-of-them file is not shipped.
  assert.equal(existsSync(new URL('../public/assets/models/titans.glb', import.meta.url)), false);
});

test('the scaled health, damage and coins of the nine titans are the table’s', () => {
  for (const [id, [hp, damage, coins]] of Object.entries(SCALED)) {
    const info = REGION[TITAN_ROWS[id].land], land = info.kind === 'land', stats = titanStats(id, land ? POWER[info.difficulty] : 1, land);
    assert.equal(stats.hp, hp, id); assert.ok(near(stats.damage, damage, .05), `${id}: ${stats.damage}`); assert.equal(stats.coins, coins, id);
  }
  assert.equal(titanStats('bear'), null);
});
// Builder D's make() applies the factors (it reads only def.titan and the plan's power) and Wilds.hit the titan's own respawn;
// at step 0 make() scales nothing and the respawn is a boss's. These hold on round8 once D has merged.
test('in the simulation a titan has the table’s health and damage, and is back after 600 s', { skip: !AI.titanRespawn ? 'waits for builder D: make() scaling by power and AI.titanRespawn' : false }, () => {
  for (const [id, [hp, damage]] of Object.entries(SCALED)) { const { e } = arena(id); assert.equal(e.maxHp, hp, id); assert.ok(near(e.damage, damage, .05), id); }
  assert.equal(AI.titanRespawn, 600); const { wilds, e } = arena('titan_clock'); wilds.hit(e, 1e9); assert.equal(e.respawn, 600);
});

test('titans.mjs reads nothing of wilds.mjs, and the two files load in either order', async () => {
  const text = readFileSync(new URL('../src/titans.mjs', import.meta.url), 'utf8'), imports = [...text.matchAll(/^import .* from '(.+)';/gm)].map(m => m[1]);
  assert.deepEqual(imports.sort(), ['./content.mjs', './creature-def.mjs']);
  const patterns = [...readFileSync(new URL('../src/titan-patterns.mjs', import.meta.url), 'utf8').matchAll(/^import .* from '(.+)';/gm)].map(m => m[1]);
  assert.ok(!patterns.some(p => /wilds|gear|pandora/.test(p)), 'titan-patterns.mjs is below wilds.mjs in the import chain');
  for (const order of [['titans', 'wilds'], ['wilds', 'titans'], ['titan-patterns', 'wilds'], ['gear', 'titans'], ['pandora', 'titans']]) {
    const loaded = []; for (const name of order) loaded.push(await import(`../src/${name}.mjs?order=${order.join('-')}`));
    const wilds = loaded[order.indexOf('wilds')]; if (wilds) assert.equal(Object.keys(wilds.CREATURES).filter(id => wilds.CREATURES[id].titan).length, 9);
  }
});

// ---------------------------------------------------------------- which attack
test('strike, skill, strike, skill in reach; all skills under 30 %; a far target always gets a skill', () => {
  const list = ['a', 'b', 'c'];
  assert.deepEqual([1, 2, 3, 4].map(n => titanSkill(list, n, 1, 0)), [null, 'a', null, 'a']);
  assert.deepEqual([0, 1, 2, 3, 4].map(k => titanSkill(list, 2, 1, k)), ['a', 'b', 'c', 'a', 'b']);
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(n => !!titanSkill(list, n, .2, 0)), [true, true, true, true, true, true, true]);
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(n => !!titanSkill(list, n, .4, 0)), [false, true, true, true, true, true, false]);
  assert.equal(titanSkill([], 2, 1, 0), null); assert.equal(titanSkill(undefined, 2, 1, 0), null);
  // In the simulation: the target stands 15 m off (past reach + 1, inside 24 m): every attack is a skill, in the row's order.
  const a = arena('titan_clock', { player: beside('titan_clock', 0, 15) }), seen = [];
  a.run(60, () => { const s = a.e.attack; if (a.e.phase === 'windup' && s && seen.at(-1)?.[0] !== a.e.attacks) seen.push([a.e.attacks, s.skill, a.e.windupTotal]); a.hero.x = a.e.x; a.hero.z = a.e.z + 15; });
  assert.ok(seen.length >= 8, `${seen.length} attacks in a minute`); assert.ok(seen.every(([count, skill]) => count % 2 === 0 && skill), 'every one a skill, the count even');
  assert.deepEqual(seen.slice(0, 7).map(s => s[1]), ['bombard', 'sweep', 'summon', 'lines', 'orbs', 'bombard', 'sweep']);
  assert.ok(seen.every(([, skill, windup]) => windup === TITAN_WINDUPS[skill]), 'each skill’s own wind-up');
  // In reach, it alternates, starting with a plain strike of its own 0.8 s wind-up.
  const b = arena('titan_turtle', { player: beside('titan_turtle', 0, 4.4) }), kinds = [];
  b.run(20, () => { if (b.e.phase === 'windup' && kinds.at(-1)?.[0] !== b.e.attacks) kinds.push([b.e.attacks, b.e.attack.skill, b.e.windupTotal]); b.hero.x = b.e.x; b.hero.z = b.e.z + 4.4; });
  assert.deepEqual(kinds.slice(0, 4).map(k => k[1]), ['', 'stomp4', '', 'lines']); assert.equal(kinds[0][2], .8);
  assert.ok(b.blows.some(h => h.amount === b.e.damage && h.source === 'melee'), 'the plain strike lands for its damage');
});

test('a wind-up is 0.8 x under 30 % health, the cooldown 0.7 x under half and 0.6 x once enraged; it calms at home', () => {
  const a = arena('titan_hydra', { player: beside('titan_hydra', 0, 14) }), e = a.e;
  const cast = () => { for (let i = 0; i < 200 && e.phase === 'windup'; i++) a.wilds.step(STEP, a.hero); };
  a.run(.1); assert.equal(e.phase, 'windup'); assert.equal(e.windupTotal, 1.3); cast(); assert.equal(e.cooldown, e.def.cooldown, 'full cooldown at full health');
  e.hp = e.maxHp * .45; e.cooldown = 0; e.phase = 'chase'; a.run(.05); assert.equal(e.phase, 'windup'); cast(); assert.ok(near(e.cooldown, e.def.cooldown * .7), `${e.cooldown}`);
  e.hp = e.maxHp * .2; e.cooldown = 0; e.phase = 'chase'; a.run(.05); assert.equal(e.attack.enraged, true); assert.equal(e.enraged, true);
  assert.equal(e.callout, TITAN_CALLOUTS[e.attack.skill], 'the bar’s line is on the creature during the wind-up'); assert.ok(near(e.windupTotal, TITAN_WINDUPS[e.attack.skill] * .8)); cast(); assert.ok(near(e.cooldown, e.def.cooldown * .7 * .6)); assert.equal(e.callout, '');
  // The player leaves: it walks home, heals, and is calm again.
  a.hero.x = 0; a.hero.z = 0; a.run(40); assert.equal(e.phase, 'idle'); assert.equal(e.hp, e.maxHp); assert.equal(e.attack?.enraged ?? false, false); assert.equal(e.enraged, false);
});

// ---------------------------------------------------------------- the hard leash
test('no titan ends a step, or a leap, more than 30 m from its den: hit every second for a minute, and pushed', () => {
  for (const id of TITAN_IDS) {
    const den = denOf(id), sq = squareOf(den.region), toward = Math.atan2(sq.cx - den.x, sq.cz - den.z);
    const hero = { x: den.x + Math.sin(toward) * 40, z: den.z + Math.cos(toward) * 40, active: true }; assert.equal(regionAt(hero.x, hero.z), den.region);
    const a = arena(id, { player: hero, list: true }); let far = 0, leaps = 0, lifted = 0, hits = 0;
    for (let i = 0; i < 2400; i++) {
      if (i % 40 === 0) hits += a.wilds.hit(a.e, 1, 1, 2, 3, Math.sin(toward), Math.cos(toward)) ? 1 : 0; // a blow with a stun, a launch and a knock toward the player
      a.wilds.step(STEP, hero); far = Math.max(far, a.home()); lifted = Math.max(lifted, a.e.titanLift);
      if (a.e.phase === 'leap') leaps++;
      for (const m of titanMarks(a.e)) if (a.e.attack.skill === 'leap') assert.ok(Math.hypot(m.x - den.x, m.z - den.z) <= 30, `${id}: the leap’s mark is inside the leash`);
    }
    assert.equal(hits, 60); assert.ok(far <= 30, `${id} strayed ${far.toFixed(2)} m`);
    if (a.e.def.speed > 0) assert.ok(far > titanLimit(a.e) - .5 && far <= titanLimit(a.e) + .5, `${id} came to the end of its leash (${far.toFixed(2)} m of ${titanLimit(a.e)})`); else assert.equal(far, 0, 'the flower is rooted');
    if (a.e.def.skills.includes('leap')) { assert.ok(leaps > 0 && lifted > 7.9, `${id} leapt`); assert.ok(lifted <= 8); }
    assert.equal(a.e.kx, 0); assert.equal(a.e.stun, 0);
  }
  // The player walks into it at the end of its leash for ten seconds: the push out of the player's circle never carries it past 30 m.
  const a = arena('titan_whale'), e = a.e; e.x = a.den.x + titanLimit(e); let far = 0;
  a.hero.x = e.x - 6; a.hero.z = e.z;
  for (let i = 0; i < 400; i++) { a.hero.x = Math.min(a.hero.x + 5 * STEP, e.x + 1); a.wilds.step(STEP, a.hero); far = Math.max(far, a.home()); }
  assert.ok(far <= 30 && far >= 29, `pushed to ${far.toFixed(3)} m`);
  for (const id of TITAN_IDS) { const d = TITAN_ROWS[id]; assert.ok(near(titanLimit({ leash: 30, radius: d.radius }) + d.radius + .4, 29.75), id); }
});

test('a leap is clamped to the leash before its mark is shown, and lands where the mark is', () => {
  const a = arena('titan_scorpion'), e = a.e, den = a.den, limit = titanLimit(e); e.x = den.x - 20; e.z = den.z;
  a.hero.x = den.x - 43; a.hero.z = den.z; // 23 m from it, 43 m from the den, in the same land
  assert.equal(regionAt(a.hero.x, a.hero.z), 'lava'); assert.ok(near(limit, 30 - 3.3 - .65));
  e.forced = 'leap'; a.run(.05); assert.equal(e.phase, 'windup'); assert.equal(e.attack.skill, 'leap');
  const [mark] = titanMarks(e); assert.equal(mark.r, 6.5); assert.ok(near(mark.x, den.x - limit, .011) && near(mark.z, den.z, .011), `the mark is at the leash, not on the player: ${mark.x}`);
  assert.ok(windupProgress(e) > 0);
  a.run(1); assert.equal(e.phase, 'leap'); assert.equal(titanMarks(e).length, 0); a.run(.4); assert.ok(e.titanLift > 7 && e.x < den.x - 20 && e.x > den.x - limit);
  a.run(.45); assert.equal(e.titanLift, 0); assert.ok(near(e.x, den.x - limit, .011)); assert.ok(['recover', 'chase', 'windup'].includes(e.phase));
  // A landing the titan could not stand on (a lit lamp's disc, a tree) becomes a leap on the spot.
  const hx = denOf('titan_turtle').x - 12, hz = denOf('titan_turtle').z, b = arena('titan_turtle', { blocked: (x, z) => Math.hypot(x - hx, z - hz) < 3 }); b.hero.x = hx; b.hero.z = hz; b.e.forced = 'leap'; b.run(.05);
  assert.deepEqual([titanMarks(b.e)[0].x, titanMarks(b.e)[0].z], [b.e.x, b.e.z].map(v => Math.round(v * 100) / 100));
});

test('no mark is kept inside the ward or beyond the world', () => {
  // The turtle at the south end of its leash, the target on the ward line: about 30 m off, so the skills are asked for by name.
  const a = arena('titan_turtle'), e = a.e, south = a.den.z + titanLimit(e); e.x = a.den.x; e.z = south; a.hero.x = e.x; a.hero.z = SAFE.z0 - .2;
  assert.equal(inSafeZone(a.hero.x, a.hero.z), false); let dropped = 0, kept = 0;
  for (let round = 0; round < 12; round++) for (const skill of SKILLS) {
    e.phase = 'chase'; e.forced = skill; e.cooldown = 9; a.wilds.step(STEP, a.hero); assert.equal(e.attack.skill, skill);
    const raw = titanTelegraphs(skill, { x: e.x, z: e.z, radius: e.radius, facing: e.facing }, a.hero, [{ id: 'player', x: a.hero.x, z: a.hero.z }], () => .5).length;
    for (const m of titanMarks(e)) { kept++; assert.ok(!inSafeZone(m.x, m.z), `${skill}: a mark at ${m.x}, ${m.z} is inside the ward`); assert.ok(regionAt(m.x, m.z)); }
    if (skill === 'stomp4') dropped += raw - titanMarks(e).length;
    e.attack.active.length = 0; e.x = a.den.x; e.z = south; e.titanLift = 0;
  }
  assert.ok(kept > 500 && dropped > 0, `${kept} kept, ${dropped} stomps on the ward’s side dropped`);
  // The same titan by the ward (a den it does not have), so that half of a bombardment would fall inside.
  const b = arena('titan_turtle'), t = b.wilds.make({ id: 't:near', type: 'titan_turtle', x: 10, z: SAFE.z0 - 8, region: 'east', leash: 30, titan: true }); t.born = 0; b.wilds.list.push(t);
  b.hero.x = 10; b.hero.z = SAFE.z0 - 14; t.forced = 'bombard'; b.wilds.step(STEP, b.hero); const marks = titanMarks(t);
  assert.ok(marks.length >= 3 && marks.length < 15, `${marks.length} of 15 kept`); assert.ok(marks.every(m => !inSafeZone(m.x, m.z)));
  b.run(4); assert.ok(b.wilds.list.includes(t));
  // The Void Eye at the rim end of its leash, close to the world's edge: nothing lands outside the world.
  const c = arena('titan_eye'), eye = c.e, ce = rimEnd(c, 38); eye.x = ce.x; eye.z = ce.z; c.hero.x = eye.x - ce.ux * 12; c.hero.z = eye.z - ce.uz * 12; let outside = 0;
  for (const skill of ['bombard', 'lines', 'sweep', 'pools']) { eye.phase = 'chase'; eye.forced = skill; c.wilds.step(STEP, c.hero); for (const m of titanMarks(eye)) assert.ok(regionAt(m.x, m.z), `${skill} at ${m.x}`); outside += titanTelegraphs(skill, { x: eye.x, z: eye.z, radius: eye.radius, facing: eye.facing }, c.hero, [], lcg(3)).filter(m => !regionAt(m.x, m.z)).length; eye.attack.active.length = 0; }
  assert.ok(outside > 0, 'some would have');
  // A sweep whose every mark fell away keeps its starting angle.
  const d = arena('titan_eye'), far = d.e, de = rimEnd(d, 38); far.x = de.x; far.z = de.z; d.hero.x = far.x - de.ux * 10 - de.uz * 17; d.hero.z = far.z - de.uz * 10 + de.ux * 17; far.forced = 'sweep'; d.wilds.step(STEP, d.hero);
  assert.ok(titanMarks(far).length >= 1 && Number.isFinite(titanMarks(far)[0].a));
});

test('a player in another region, inside the ward or out of reach is no target; a titan that gives up goes home and heals', () => {
  // The turtle's canyon and the planets beyond it meet on the inner circle: a player 20 m away along the radius, across the line.
  const a = arena('titan_turtle'), e = a.e, te = rimEnd(a); e.x = te.x; e.z = te.z; a.hero.x = e.x + te.ux * 20; a.hero.z = e.z + te.uz * 20; assert.notEqual(regionAt(a.hero.x, a.hero.z), 'east'); assert.ok(regionAt(a.hero.x, a.hero.z));
  a.wilds.hit(e, 100); a.run(3); assert.ok(['return', 'idle'].includes(e.phase), e.phase); assert.equal(a.blows.length, 0); assert.equal(titanMarks(e).length, 0);
  a.run(30); assert.equal(e.hp, e.maxHp); assert.equal(e.phase, 'idle');
  // Seen from inside its own region at 21 m (sight 22): it wakes, and winds up at once (inside 24 m).
  const b = arena('titan_turtle', { player: beside('titan_turtle', 0, -21) }); b.run(.1); assert.ok(b.events.some(([kind]) => kind === 'alert')); assert.equal(b.e.phase, 'windup');
  // At 23 m, beyond its sight, it sleeps on; hit, it comes.
  const c = arena('titan_turtle', { player: beside('titan_turtle', 0, -23) }); c.run(2); assert.equal(c.e.phase, 'idle'); assert.equal(c.events.length, 0);
  c.wilds.hit(c.e, 5); c.run(.1); assert.notEqual(c.e.phase, 'idle');
  // Far away and calm it rests; calm and out of sight it thinks on every 4th step, like every creature.
  const d = arena('titan_clock', { player: beside('titan_clock', 0, 60) }); d.run(1); assert.equal(d.e.resting, true); assert.ok(!d.wilds.awake.includes(d.e));
});

test('down, a titan’s attacks and marks are gone; back, it starts afresh', () => {
  const a = arena('titan_hydra', { player: beside('titan_hydra', 0, 12) }), e = a.e;
  e.forced = 'pools'; a.run(1.4); assert.equal(titanAttacks(e).length, 1); assert.equal(titanAttacks(e)[0].skill, 'pools');
  e.forced = 'bombard'; a.run(.3); assert.ok(titanMarks(e).length > 0);
  a.wilds.hit(e, 1e9); assert.equal(e.hp, 0); assert.equal(titanAttacks(e).length, 0); assert.equal(titanMarks(e).length, 0);
  const blows = a.blows.length; a.run(8); assert.equal(a.blows.length, blows, 'its pools die with it');
  a.hero.x = 0; a.hero.z = 0; e.respawn = .1; a.run(.5); assert.ok(e.hp > 0); a.hero.x = denOf('titan_hydra').x; a.hero.z = denOf('titan_hydra').z + 12; a.run(.2);
  assert.equal(e.attack.active.length, 0); assert.equal(e.attack.skills <= 1, true); assert.equal(e.titanLift, 0);
});

// ---------------------------------------------------------------- summon and pull
test('a summon brings four commons of its own region to its side, at 1.3 x their damage, once or three times over', () => {
  const a = arena('titan_turtle', { player: beside('titan_turtle', 0, 15) }), e = a.e, pack = [], tx = a.den.x, tz = a.den.z;
  const add = (id, type, x, z, region = 'east', power = 1) => { const m = a.wilds.make({ id, type, x, z, region, power }); m.born = 0; a.wilds.list.push(m); return m; };
  for (let i = 0; i < 5; i++) pack.push(add('p' + i, 'wolf', tx - 25 + i, tz + 20));
  const rooted = add('rooted', 'cactus', tx + 18, tz), other = add('other', 'boar', tx + 8, tz + 18, 'south'), far = add('far', 'wolf', tx + 70, tz), boss = add('boss', 'bear', tx + 13, tz + 2), strong = add('strong', 'crab', tx - 12, tz - 16, 'east', 2.6);
  pack[0].hp = 10;
  const cast = () => { e.forced = 'summon'; e.phase = 'chase'; a.run(1.1 + .1); };
  cast(); const called = a.wilds.list.filter(m => m !== e && Math.abs(Math.hypot(m.x - e.x, m.z - e.z) - (e.radius + 2)) < 1.5);
  assert.equal(e.attack.summoned.length, 4); assert.ok(called.length >= 3, `${called.length} stand at its side`);
  for (const m of e.attack.summoned) { assert.ok(!m.def.boss && m.def.speed > 0 && m.region === 'east'); assert.ok(near(m.damage, m.def.damage * m.power * 1.3), `${m.id}: ${m.damage}`); assert.notEqual(m.phase, 'idle'); }
  assert.ok(e.attack.summoned.includes(pack[0])); assert.equal(pack[0].hp > 10, true, 'healed');
  for (const m of [rooted, other, far, boss]) { assert.ok(!e.attack.summoned.includes(m), m.id); assert.equal(m.damage, m.def.damage); }
  // Twice more: set, not multiplied.
  cast(); cast(); for (const m of e.attack.summoned) assert.ok(near(m.damage, m.def.damage * m.power * 1.3), `${m.id} after three summons: ${m.damage}`);
  if (e.attack.summoned.includes(strong)) assert.ok(near(strong.damage, CREATURES.crab.damage * 2.6 * 1.3));
  // Home again (or down), each goes back to its own damage.
  const list = [...e.attack.summoned]; list[0].phase = 'idle'; list[1].hp = 0; a.wilds.step(STEP, a.hero);
  assert.equal(list[0].damage, list[0].def.damage * list[0].power); assert.equal(list[1].damage, list[1].def.damage * list[1].power); assert.equal(e.attack.summoned.length, 2);
  assert.equal(TITAN.summon, 4); assert.equal(TITAN.summonRange, 60); assert.equal(TITAN.summonBoost, 1.3);
});

test('the pull moves the player only through host.pull, which never puts them in a blocked point', () => {
  // The player's own rule, as world.push has it: one axis at a time, through `blocked`.
  const flower = denOf('titan_flower'), rock = { x: flower.x, z: flower.z + 7, r: 1.5 }, blocked = (x, z) => Math.hypot(x - rock.x, z - rock.z) < rock.r;
  const hero = { x: flower.x - .4, z: flower.z + 12, active: true }, wilds = new Wilds({ hurt: () => {}, pull: (dx, dz) => { if (!blocked(hero.x + dx, hero.z)) hero.x += dx; if (!blocked(hero.x, hero.z + dz)) hero.z += dz; } }, lcg(2));
  const den = denOf('titan_flower'), e = wilds.make(wildCell(Math.floor(den.x / 32), Math.floor(den.z / 32)).find(p => p.id === den.id)); e.born = 0; wilds.list.push(e);
  const seen = { x: hero.x, z: hero.z }; let moved = 0;
  e.forced = 'pull'; for (let i = 0; i < 120; i++) { wilds.step(STEP, hero); assert.ok(!blocked(hero.x, hero.z), `inside the rock at step ${i}`); moved += Math.hypot(hero.x - seen.x, hero.z - seen.z); seen.x = hero.x; seen.z = hero.z; }
  assert.ok(moved > 2 && hero.z < flower.z + 12, `pulled ${moved.toFixed(2)} m toward it`); assert.ok(Math.hypot(hero.x - rock.x, hero.z - rock.z) >= rock.r);
  // Without a host.pull nothing moves the player, and a frozen player is never written to.
  const still = Object.freeze({ x: flower.x, z: flower.z + 12, active: true }), plain = new Wilds({}, lcg(2)), f = plain.make({ id: 'f', type: 'titan_flower', x: flower.x, z: flower.z, region: 'jungle', leash: 30 }); f.born = 0; plain.list.push(f);
  f.forced = 'pull'; for (let i = 0; i < 120; i++) plain.step(STEP, still);
});

// ---------------------------------------------------------------- loot and trophies
// Spec 4.5: [slot, name, sell, stats, traits, pet shot / damage / cooldown].
const TROPHIES = {
  hat_t_turtle: ['hat', 'Ancient Mountain Helm', 900, { def: 30, hp: 150, regen: 3 }], pet_t_turtle: ['pet', 'Little Mountain Turtle', 1400, { def: 25, hp: 120, regen: 3 }, ['bubble', .5, 1.6]],
  hat_t_hydra: ['hat', 'Candy Hydra Crown', 900, { atk: 16, crit: .08, hp: 60 }], pet_t_hydra: ['pet', 'Little Candy Hydra', 1400, { atk: 12 }, ['rainbow', .8, .9]],
  hat_t_crystal: ['hat', 'Ice Crystal Crown', 950, { crit: .12, def: 18, hp: 80, light: true }], pet_t_crystal: ['pet', 'Little Crystal Queen', 1450, { crit: .1, light: true }, ['ice', .7, 1.1]],
  hat_t_scorpion: ['hat', 'Inferno Scorpion Helm', 1000, { atk: 20, def: 12, lavaproof: true }], pet_t_scorpion: ['pet', 'Little Inferno Scorpion', 1500, { atk: 14, lavaproof: true }, ['fire', .9, 1]],
  hat_t_clock: ['hat', 'Clockwork Crown', 900, { speed: .18, atk: 10, xp: .3 }], pet_t_clock: ['pet', 'Little Clockwork Spider', 1400, { speed: .15, xp: .25 }, ['spike', .6, .8]],
  hat_t_flower: ['hat', 'Rafflesia Crown', 950, { hp: 120, regen: 5, antidote: true }], pet_t_flower: ['pet', 'Little Rafflesia', 1450, { hp: 100, regen: 6, antidote: true }, ['bubble', .6, 1.2]],
  hat_t_kraken: ['hat', 'Kraken Tentacle Hat', 950, { def: 16, atk: 12, luck: .4 }], pet_t_kraken: ['pet', 'Little Abyssal Kraken', 1450, { def: 12, luck: .35 }, ['bubble', .7, 1.1]],
  hat_t_whale: ['hat', 'Cloud Whale Hat', 1000, { speed: .22, hp: 140, xp: .2 }], pet_t_whale: ['pet', 'Little Cloud Whale', 1500, { hp: 150, speed: .2, xp: .2 }, ['ice', .7, 1.2]],
  hat_t_eye: ['hat', 'Void Eye Crown', 1100, { atk: 22, crit: .1, light: true, luck: .25 }], pet_t_eye: ['pet', 'Little Void Eye', 1600, { atk: 16, crit: .08, light: true, luck: .2 }, ['rainbow', 1, 1]],
};
const STAT_KEYS = ['hp', 'atk', 'def', 'crit', 'speed', 'regen', 'luck', 'xp', 'light', 'lavaproof', 'antidote'];
const glbRoots = file => { const b = readFileSync(new URL(`../public/assets/models/${file}.glb`, import.meta.url)), j = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8')); return { bytes: b.length, roots: j.scenes[0].nodes.map(i => j.nodes[i]), nodes: j.nodes }; };

test('the eighteen trophies are gear with the reference’s stats, a model file and an icon each, and a spare pays its sell value', () => {
  assert.equal(Object.keys(TITAN_GEAR).length, 18); assert.deepEqual(Object.keys(TITAN_GEAR).sort(), Object.keys(TROPHIES).sort());
  for (const [id, [slot, name, sell, stats, shot]] of Object.entries(TROPHIES)) {
    const g = GEAR[id]; assert.ok(g, `${id} is in GEAR`); assert.deepEqual([g.id, g.slot, g.name, g.trophy, g.icon], [id, slot, name, true, 'items/' + id]);
    assert.deepEqual(Object.fromEntries(STAT_KEYS.filter(k => g[k] !== undefined).map(k => [k, g[k]])), stats, id);
    if (shot) assert.deepEqual([g.pet.shot, g.pet.dmg, g.pet.cd], shot, id); else assert.equal(g.pet, undefined);
    // Its own file, named by `kit`, holding one root named after the gear id with the anchor child avatar.mjs reads.
    const file = id.replace(/_/g, '-'); assert.equal(g.kit, file); assert.equal(kitOf(id), file);
    const glb = glbRoots(file); assert.deepEqual(glb.roots.map(n => n.name), [id]); assert.equal(glb.nodes[glb.roots[0].children[0]].name, slot === 'hat' ? id + '@head' : id + '_body'); assert.ok(glb.bytes < 80_000);
    const icon = new URL(`../public/assets/icons/${g.icon}.webp`, import.meta.url); assert.ok(existsSync(icon), `${id} icon`);
    // The price is four times the reference's sell value, so a second copy trades for exactly that value.
    assert.equal(g.price, sell * 4); assert.equal(spareGearCoins(id), sell);
  }
  // Earned, worn for real numbers, saved by the ordinary gear rules; a second one becomes coins.
  for (const key of ['turtle', 'eye']) {
    const s = open(), hat = 'hat_t_' + key, pet = 'pet_t_' + key, before = gearStats(s), coins = s.coins;
    const first = act(s, 'pickup', { id: hat, count: 1 }); assert.ok(first.ok); assert.equal(first.gear, hat); assert.ok(s.gearOwned.includes(hat)); assert.equal(s.inventory[hat], undefined);
    assert.ok(act(s, 'pickup', { id: pet, count: 1 }).ok); assert.ok(act(s, 'equip', { id: hat }).ok); assert.ok(act(s, 'equip', { id: pet }).ok);
    assert.deepEqual([gearOf(s).hat, gearOf(s).pet], [hat, pet]); assert.notDeepEqual(gearStats(s), before);
    const second = act(s, 'pickup', { id: hat, count: 1 }); assert.ok(second.ok); assert.equal(second.coins, TROPHIES[hat][2]); assert.equal(s.coins, coins + TROPHIES[hat][2]);
  }
  const worn = open(); worn.gearOwned = ['hat_t_turtle', 'pet_t_turtle']; worn.gear = { ...worn.gear, hat: 'hat_t_turtle', pet: 'pet_t_turtle' };
  assert.equal(maxHp(worn), 100 + 150 + 120); assert.equal(gearStats(worn).defense, 55); assert.equal(gearStats(worn).regen, 6);
});

test('each titan drops its own hat at 12 % and pet at 6 %, and its land’s material', () => {
  const material = { titan_turtle: ['honey', 2, 4], titan_hydra: ['sugar', 8, 12], titan_crystal: ['icecrystal', 8, 12], titan_scorpion: ['obsidian', 5, 8], titan_clock: ['cog', 10, 15], titan_flower: ['amber', 3, 5], titan_kraken: ['pearl', 4, 6], titan_whale: ['feather', 8, 12], titan_eye: ['moonstone', 3, 5] };
  for (const id of TITAN_IDS) {
    const key = id.replace('titan_', ''), rows = TITAN_LOOT_SPEC[id], [name, min, max] = material[id];
    assert.deepEqual(rows.slice(0, 2), [['hat_t_' + key, .12, 1, 1], ['pet_t_' + key, .06, 1, 1]], id);
    const of = rows.filter(r => r[0] === name); assert.ok(of.length && of.every(r => r[1] === 1 && r[3] <= 9), `${id}: no pick-up carries more than nine`);
    assert.deepEqual([of.reduce((n, r) => n + r[2], 0), of.reduce((n, r) => n + r[3], 0)], [min, max], `${id}: ${name} ${min} to ${max}`);
    assert.deepEqual(rows.slice(2).filter(r => r[0] !== name), id === 'titan_turtle' ? [['crown', .3, 1, 1]] : []);
    // What pandora.mjs holds: the same rows, less only those whose item content.mjs does not have yet (the lands' materials are builder D's).
    assert.equal(LOOT[id], TITAN_LOOT[id]); assert.deepEqual(LOOT[id], rows.filter(([item]) => ITEMS[item] || GEAR[item]));
    assert.ok(LOOT[id].length >= 2); for (const [item] of LOOT[id]) assert.ok(ITEMS[item] || GEAR[item], `${id} drops a known item: ${item}`);
    // The best roll gives both trophies; the worst gives neither.
    assert.deepEqual(rollLoot(id, () => 0).filter(d => GEAR[d.id]?.trophy).map(d => d.id), ['hat_t_' + key, 'pet_t_' + key]); assert.equal(rollLoot(id, () => .99).some(d => GEAR[d.id]?.trophy), false);
  }
  assert.deepEqual(rollLoot('titan_turtle', () => .5).map(d => d.id), ['honey']);
});
test('with the lands’ materials in content.mjs, no titan loot row is left out', { skip: !ITEMS.cog ? 'waits for builder D: the eight materials in content.mjs ITEMS' : false }, () => {
  assert.deepEqual(TITAN_LOOT, TITAN_LOOT_SPEC); for (const id of ['cog', 'sugar', 'amber', 'icecrystal', 'pearl', 'obsidian', 'feather', 'moonstone']) assert.ok(ITEMS[id], id);
});

test('a defeated titan is recorded once, pays its coins, and its state is on the creature only', () => {
  const s = open(), coins = s.coins, win = act(s, 'defeat', { type: 'titan_turtle' }); assert.ok(win.ok); assert.ok(win.coins >= 1500); assert.equal(s.coins, coins + win.coins); assert.equal(s.defeated.titan_turtle, true);
  const a = arena('titan_turtle'); assert.equal(a.e.attack, null); a.run(.1); const state = titanState(a.e); assert.equal(a.e.attack, state); assert.deepEqual(Object.keys(state).sort(), ['active', 'bursts', 'enraged', 'marks', 'me', 'skill', 'skills', 'summoned', 'targets']);
});

// ---------------------------------------------------------------- with builder D merged (round 8 merge of D2)
test('a titan pays its coins x (0.6 + 0.4 x its land\'s power), and more for worn xp', () => {
  for (const d of DENS.filter(d => d.titan && TITAN_ROWS[d.type])) {
    const info = REGION[d.region], factor = info.kind === 'land' ? .6 + .4 * POWER[info.difficulty] : 1;
    assert.equal(defeatCoins(d.type, d.region), Math.round(CREATURES[d.type].coins * factor), d.type);
    assert.ok(defeatCoins(d.type, d.region, .2) > defeatCoins(d.type, d.region), `${d.type} with xp`);
  }
});

test('the trophies\' traits reach gearStats, and the crystal, whale and eye pets fly (the reference\'s pet-pen.ts FLYING_PETS)', () => {
  const worn = gear => gearStats({ ...freshState(), gear: { hat: '', wear: '', boots: '', weapon: '', pet: '', ...gear } });
  assert.equal(worn({}).lavaproof, false); assert.equal(worn({ hat: 'hat_t_scorpion' }).lavaproof, true); assert.equal(worn({ pet: 'pet_t_flower' }).antidote, true);
  assert.equal(worn({ hat: 'hat_t_crystal' }).light, true); assert.ok(worn({ hat: 'hat_t_kraken' }).luck > worn({}).luck);
  for (const id of ['pet_t_crystal', 'pet_t_whale', 'pet_t_eye']) assert.ok(FLYING_PETS.includes(id), id);
  assert.ok(!FLYING_PETS.includes('pet_t_turtle'));
});
