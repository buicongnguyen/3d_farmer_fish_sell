// Who lives where (round 8, builder D): the 26 dens, the seeded spawn plan by region with every clearance, the sea's kinds
// and the land's, the lookalike rule, the counts against their targets, each kind's drawn size, level and power per
// creature, the scaled health, damage and coins of every den, the magma slime's split and a made-up titan.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CREATURES, Wilds, wildCell, wildDepth, inSafeZone, SPAWN, SPAWN_ENV, WILD_CELL, AI, STEP, DEN } from '../src/wilds.mjs';
import { REGION, DENS, regionAt, borderDistance, gridBorderDistance, trailPoint, trailDistance, TRAILS } from '../src/regions.mjs';
import { MIX, DENSITY, TARGET, POWER, RANK, coinFactor, LOOKALIKES, TWIN_BLOCKS, TWIN_GAP } from '../src/region-mix.mjs';
import { LOOT, defeatCoins } from '../src/pandora.mjs';
import { FIELD_TILE, fieldTrees } from '../src/field-layout.mjs';
import { FEATURES, landClear, waterAt } from '../src/land-features.mjs';
import { creature } from '../src/creature-def.mjs';
import { freshState, act } from '../src/game.mjs';

const seeded = seed => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const LANDS = Object.keys(REGION).filter(id => REGION[id].kind === 'land'), HOMES = Object.keys(REGION).filter(id => REGION[id].kind === 'home');
/** Every seeded creature of the world (cells out to ±352 m), with an optional land of the test's own. */
const everyone = env => { const out = []; for (let cx = -11; cx <= 10; cx++) for (let cz = -11; cz <= 10; cz++) out.push(...wildCell(cx, cz, env)); return out; };
const commons = env => everyone(env).filter(c => !c.id.startsWith('w:den:'));
const near = (a, b, tolerance = 1e-6) => Math.abs(a - b) <= tolerance;

test('26 dens: each in its own region, 36 m from every grid border, 56 m from the next den, off every cell seam', () => {
  assert.equal(DENS.length, 26); assert.equal(new Set(DENS.map(d => d.id)).size, 26);
  for (const d of DENS) {
    assert.equal(d.id, 'w:den:' + d.type); assert.equal(regionAt(d.x, d.z), d.region, d.id);
    assert.ok(gridBorderDistance(d.x, d.z) >= 36 - 1e-9, `${d.id} is ${gridBorderDistance(d.x, d.z).toFixed(1)} m from a grid border`);
    assert.ok(d.x % WILD_CELL !== 0 && d.z % WILD_CELL !== 0, `${d.id} is off the 32 m cell seams`);
    for (const o of DENS) if (o !== d) assert.ok(Math.hypot(o.x - d.x, o.z - d.z) >= 56, `${d.id} and ${o.id} are 56 m apart`);
    assert.equal(d.level, REGION[d.region].bossLevel); assert.equal(d.clear, d.titan ? 24 : 16);
  }
  // 16 bosses (4 at home, 12 in the lands), the dragon's nest, and 9 titans (the Mountain Turtle at home, in the canyon).
  assert.equal(DENS.filter(d => !d.titan && !d.event).length, 16); assert.deepEqual(DENS.filter(d => d.event).map(d => [d.type, d.event, d.region]), [['dragon', 'dragon', 'lava']]); assert.equal(DENS.filter(d => d.titan).length, 9);
  // The seven bosses of the three-den lands and the nest keep a 24 m leash (a boss left alone cannot carry you into the titan's trigger).
  for (const d of DENS) assert.equal(d.leash, !d.titan && ['candy', 'ice', 'lava'].includes(d.region) ? 24 : 30, d.id);
  // The east trail's near edge (half-width 2.2 m) passes the Mountain Turtle's den at 26 m or more: outside its 24 m trigger.
  const turtle = DENS.find(d => d.type === 'titan_turtle'); let least = Infinity; const tp = { x: 0, z: 0 };
  for (let a = TRAILS.east.from; a <= TRAILS.east.to; a += .05) { trailPoint('east', a, tp); least = Math.min(least, Math.hypot(tp.x - turtle.x, tp.z - turtle.z)); }
  assert.ok(least - 2.2 >= 26, `the trail's edge is ${(least - 2.2).toFixed(2)} m from the turtle's den`); assert.ok(near(least, trailDistance(turtle.x, turtle.z), .05));
});

test('every kind of a mix has its row, its loot and its drawn size; levels follow 3 d − 2, a boss six more', () => {
  for (const [region, mix] of Object.entries(MIX)) for (const [type, weight] of mix) { assert.ok(CREATURES[type], `${type} (${region}) has a row`); assert.ok(LOOT[type]?.length, `${type} has loot`); assert.ok(weight > 0); }
  for (const id of [...HOMES, ...LANDS]) assert.ok(MIX[id].length >= 3, `${id} has its kinds`);
  assert.deepEqual(MIX.village, []);
  // The reference's own mixes (enemy-types.ts HOME_SPAWNS, PLANET_SPAWNS), by weight; the forest hawk is a mix entry of weight 6 here.
  const weights = id => Object.fromEntries(MIX[id]);
  assert.deepEqual(weights('west'), { mushroom: 20, boar: 12, bee: 6, forest_raptor: 6 }); assert.deepEqual(weights('north'), { chomper: 14, wolf: 10, frog: 12, mushroom: 6 });
  assert.deepEqual(weights('south'), { mushroom: 12, boar: 8, bee: 12 }); assert.deepEqual(weights('east'), { cactus: 14, wolf: 8, crab: 12 });
  assert.deepEqual(weights('toy'), { toysoldier: 20, windmouse: 18, jackbox: 16 }); assert.deepEqual(weights('candy'), { jelly: 26, gummy: 16, lollipop: 16, bunny: 18, chocobeetle: 12 });
  assert.deepEqual(weights('jungle'), { monkey: 18, snake: 16, chameleon: 16, flytrap: 12 }); assert.deepEqual(weights('ice'), { snowball: 24, penguin: 18, icebloom: 14, seal: 14, owl: 16 });
  assert.deepEqual(weights('ocean'), { jellyzap: 18, hammershark: 14, urchin: 14, crab: 12 }); assert.deepEqual(weights('lava'), { magmaslime: 22, firelizard: 12, volcano: 12, firebat: 20, magmacrab: 10, magmaturtle: 10, lavaworm: 8 });
  assert.deepEqual(weights('cloud'), { cloudsheep: 22, thunderbird: 18, windspirit: 14 }); assert.deepEqual(weights('shadow'), { wisp: 22, spider: 18, demoneye: 14 });
  // Drawn size: Zoo Garden's ENEMY_SCALE (enemy-types.ts:814-826), the hawk's 1.45 × 0.5, 1.85 for every boss and the dragon.
  const SCALE = { toysoldier: .78, windmouse: .84, jackbox: .72, jelly: .73, gummy: .91, lollipop: .61, bunny: .51, chocobeetle: .99, monkey: .85, snake: .74, chameleon: .91, flytrap: .67,
    snowball: .73, penguin: .85, icebloom: .67, seal: .99, owl: .73, jellyzap: .78, hammershark: .99, urchin: .67, magmaslime: .85, minislime: .67, firelizard: .99, volcano: .89, firebat: .73, magmacrab: .99, magmaturtle: .99, lavaworm: .87,
    cloudsheep: .99, thunderbird: .85, windspirit: .78, wisp: .73, spider: .99, demoneye: .84, forest_raptor: .725, mushroom: .49, boar: .91, bee: .73, wolf: .99, chomper: .67, frog: .73, cactus: .67, crab: .99 };
  for (const [type, scale] of Object.entries(SCALE)) assert.equal(CREATURES[type].scale, scale, `${type} is drawn at ${scale}`);
  for (const [type, def] of Object.entries(CREATURES)) if (!def.titan) { assert.equal(def.scale, def.boss ? 1.85 : SCALE[type], `${type}: a size from the table`); assert.equal(def.boss, def.behavior === 'boss'); }
  // The merged numbers of a few rows, each against the reference's combatRules entry.
  const facts = type => { const d = CREATURES[type]; return [d.hp, d.damage, d.speed, d.reach, d.sight, d.radius, d.cooldown, d.windup, d.behavior]; };
  assert.deepEqual(facts('forest_raptor'), [160, 14, 4.2, .95, 13, .4, 2.8, .75, 'charger']); assert.ok(CREATURES.forest_raptor.flying);
  assert.deepEqual(facts('toysoldier'), [70, 9, 0, 11, 11, .6, 1.9, .5, 'shooter']); assert.deepEqual(facts('monkey'), [110, 13, 0, 11, 12, .6, 1.8, .5, 'shooter']);
  assert.deepEqual(facts('jellyzap'), [110, 14, 3.2, 1.4, 11, .55, 2.2, .5, 'charger']); assert.deepEqual(facts('magmaturtle'), [260, 20, 1.6, 1.9, 9, 1, 2.8, .8, 'charger']);
  assert.deepEqual(facts('lavaworm'), [190, 22, 5.5, 1.9, 14, .7, 3.2, 1.2, 'charger']); assert.deepEqual(facts('minislime'), [24, 5, 3.3, 1.1, 11, .38, 1.1, .3, 'hopper']);
  assert.deepEqual(facts('mushking'), [950, 24, 2.4, 2.7, 13, 1.5, 2.2, .6, 'boss']); assert.deepEqual(facts('dragon'), [2600, 36, 3, 3, 18, 1.6, 2, .6, 'boss']);
  assert.deepEqual([CREATURES.chameleon.stealth, CREATURES.wisp.stealth, CREATURES.spider.stealth], [5, 6, 7]); assert.deepEqual(['owl', 'firebat', 'thunderbird', 'windspirit', 'frostowl', 'phoenix', 'dragon'].map(t => !!CREATURES[t].flying), Array(7).fill(true));
  assert.deepEqual(Object.keys(CREATURES).filter(t => CREATURES[t].where === 'sea').sort(), ['hammershark', 'jellyzap'], 'the two kinds of the sea');
  // Coins are half the reference's XP.
  assert.deepEqual(['forest_raptor', 'treant', 'croc', 'mushking', 'robot', 'dragon', 'minislime', 'wisp'].map(t => CREATURES[t].coins), [18, 120, 140, 160, 165, 700, 3, 20]);
  // Levels: 3 d − 2 for a region's creatures, six more for its boss; the stars are the banner's.
  for (const id of [...HOMES, ...LANDS]) { const r = REGION[id]; assert.equal(r.level, 3 * r.difficulty - 2, id); assert.equal(r.bossLevel, r.level + 6, id); }
  assert.deepEqual(POWER, [1, 1, 1.7, 2.6, 3.6, 4.8, 6.2]);
});

test('the seeded plan: every creature in its own region and clear of the ward, the borders, the seams, the corners, the dens, the light of every lamp and every collider', () => {
  const all = everyone(), list = all.filter(c => !c.id.startsWith('w:den:'));
  assert.equal(new Set(all.map(c => c.id)).size, all.length, 'no id twice');
  for (const c of list) {
    const def = CREATURES[c.type], region = REGION[c.region];
    assert.equal(c.region, regionAt(c.x, c.z), `${c.id} is seeded in the region it stands in`); assert.ok(region && c.region !== 'village');
    assert.ok(MIX[c.region].some(([type]) => type === c.type), `${c.type} belongs to ${c.region}`);
    assert.ok(!inSafeZone(c.x, c.z, SPAWN.line), `${c.id}: 2 m from the ward`);
    assert.ok(borderDistance(c.x, c.z) >= SPAWN.line, `${c.id}: 2 m from the ward line and every seam`); assert.ok(gridBorderDistance(c.x, c.z) >= SPAWN.gridLane, `${c.id}: 6 m from every grid border`);
    assert.ok(!(c.x > 52 && c.x < 67 && Math.abs(c.z) < 4), `${c.id}: off the gate's road, which lies on a region border`);
    for (const d of DENS) assert.ok(Math.hypot(c.x - d.x, c.z - d.z) >= d.clear, `${c.id} is outside the clearing of ${d.id}`);
    assert.ok(landClear(c.x, c.z, def.radius, def.where ?? 'land'), `${c.id} stands where its kind may`);
    for (const l of FEATURES.shadow.lamps) assert.ok(Math.hypot(c.x - l.x, c.z - l.z) >= l.r + def.radius, `${c.id} is outside the light of lamp ${l.id}`);
    // No creature inside a collider: every blocking piece of the tiles round it is at least its own radius and the creature's away.
    const tx = Math.floor(c.x / FIELD_TILE), tz = Math.floor(c.z / FIELD_TILE);
    for (let ix = tx - 1; ix <= tx + 1; ix++) for (let iz = tz - 1; iz <= tz + 1; iz++) for (const t of fieldTrees(ix, iz)) assert.ok(Math.hypot(t.x - c.x, t.z - c.z) >= t.r + def.radius, `${c.id} is clear of a ${t.kind}`);
    // Level and power belong to the creature: its region's, and power 1 in every home region whatever its label.
    assert.equal(c.level, region.level); assert.equal(c.power, region.kind === 'land' ? POWER[region.difficulty] : 1); assert.equal(c.titan, false); assert.equal(c.event, null); assert.equal(c.leash, AI.leashHome);
    for (const o of list) if (o !== c && Math.abs(o.x - c.x) < 4 && Math.abs(o.z - c.z) < 4 && Math.floor(o.x / 32) === Math.floor(c.x / 32) && Math.floor(o.z / 32) === Math.floor(c.z / 32)) assert.ok(Math.hypot(o.x - c.x, o.z - c.z) >= SPAWN.apart, 'neighbours of a cell are 4 m apart');
  }
  // A wolf is Lv 4 in the swamp and Lv 7 in the canyon.
  assert.deepEqual([...new Set(list.filter(c => c.type === 'wolf').map(c => `${c.region}:${c.level}`))].sort(), ['east:7', 'north:4']);
});

test('counts: every region holds its target within 2, every kind of its mix lives there, and creatures live right up to the road', () => {
  const list = commons(), count = {}, kinds = {}, close = { west: 0, north: 0, south: 0, east: 0 };
  for (const c of list) { count[c.region] = (count[c.region] ?? 0) + 1; (kinds[c.region] ??= new Set()).add(c.type); if (c.region in close && wildDepth(c.x, c.z) < 20) close[c.region]++; }
  assert.deepEqual(TARGET, { village: 0, west: 37, north: 36, south: 33, east: 32, toy: 32, candy: 51, jungle: 37, ice: 50, ocean: 35, lava: 43, cloud: 32, shadow: 32 });
  for (const id of [...HOMES, ...LANDS]) {
    assert.ok(Math.abs(count[id] - TARGET[id]) <= 2, `${id} holds ${count[id]} of ${TARGET[id]} (run node scripts/tune-density.mjs after the scenery or the land features change)`);
    assert.ok(DENSITY[id] > 0 && DENSITY[id] <= 4, `${id}: at most 4 a cell`);
    // Every kind of the mix, the sea's two included (the Beach's sea is land-features.mjs waterAt, builder B).
    const expected = MIX[id].map(([type]) => type);
    assert.deepEqual([...kinds[id]].sort(), expected.sort(), `every kind of ${id}'s mix lives there (reorder its MIX list if a kind is missing: region-mix.mjs)`);
  }
  assert.equal(count.village, undefined); assert.equal(list.length, Object.values(count).reduce((a, b) => a + b, 0));
  // Up to the road. The spec asks for three within 20 m of the ward on each side; the swamp's strip seeds two at its target count
  // (three at a density that seeds 43 of its 39), so the rule here is two on every side, three on at least three sides, fourteen in all.
  for (const id of HOMES) assert.ok(close[id] >= 2, `${id}: ${close[id]} creatures within 20 m of the ward`);
  assert.ok(HOMES.filter(id => close[id] >= 3).length >= 3 && Object.values(close).reduce((a, b) => a + b, 0) >= 14, JSON.stringify(close));
  assert.ok(Math.min(...list.map(c => wildDepth(c.x, c.z))) < 8, 'the nearest lives within a few metres of the ward line');
  // The commons are the same before and after the titans' rows arrive: every den's clearing applies whether or not its creature exists.
  const before = commons().map(c => `${c.id}:${c.type}:${c.x}:${c.z}`), added = [];
  for (const d of DENS) if (!CREATURES[d.type]) { CREATURES[d.type] = creature('Made-up titan', 1500, 30, 1.4, 1500, 'titan', '#888888', { titan: true, boss: true, radius: 3.15, reach: 4.875, sight: 22 }); added.push(d.type); }
  try {
    const after = everyone(); assert.deepEqual(after.filter(c => !c.id.startsWith('w:den:')).map(c => `${c.id}:${c.type}:${c.x}:${c.z}`), before);
    assert.equal(after.filter(c => c.id.startsWith('w:den:')).length, 26, 'every den holds its creature once every kind has a row');
    for (const c of after.filter(c => c.titan)) { const d = DENS.find(x => x.id === c.id); assert.deepEqual([c.x, c.z, c.leash, c.level, c.titan], [d.x, d.z, 30, d.level, true]); }
  } finally { for (const type of added) delete CREATURES[type]; }
});

test('the Beach, by place: the jellyfish and the sharks only in the sea, the urchins and the crabs only on sand', () => {
  // The sea is builder B's (land-features.mjs waterAt): a band along the Beach's two outer sides. A slot in it draws the mix's sea kinds.
  const beach = commons().filter(c => c.region === 'ocean'), wet = beach.filter(c => waterAt(c.x, c.z)), dry = beach.filter(c => !waterAt(c.x, c.z));
  for (const c of wet) assert.ok(c.type === 'jellyzap' || c.type === 'hammershark', `${c.type} in the sea`);
  for (const c of dry) assert.ok(c.type === 'urchin' || c.type === 'crab', `${c.type} on the sand`);
  assert.ok(wet.length >= 4 && dry.length >= 4, `at least four of each pair (${wet.length} in the sea, ${dry.length} on sand)`);
  for (const type of ['jellyzap', 'hammershark', 'urchin', 'crab']) assert.ok(beach.some(c => c.type === type), `a ${type} lives on the Beach`);
  for (const c of wet) assert.ok(landClear(c.x, c.z, CREATURES[c.type].radius, 'sea'), `${c.id} is wholly in the sea`);
  assert.ok(Math.abs(beach.length - TARGET.ocean) <= 2, `the Beach holds ${beach.length}`);
  // Everywhere else the plan does not depend on the sea: with it dried up only the Beach changes.
  const dried = { ...SPAWN_ENV, waterAt: () => false, landClear: (x, z, r, where) => where !== 'sea' && landClear(x, z, r, where) };
  assert.deepEqual(commons(dried).filter(c => c.region !== 'ocean').map(c => c.id), commons().filter(c => c.region !== 'ocean').map(c => c.id));
  assert.ok(commons(dried).filter(c => c.region === 'ocean').every(c => !waterAt(c.x, c.z) && CREATURES[c.type].where !== 'sea'));
});

test('lookalikes: a creature never stands among its doubles, and the blocking half of the table is the creature\'s to yield', () => {
  assert.deepEqual(LOOKALIKES, { toadstools: ['mushroom', 'mushking'], bush: ['frog'], gumdrops: ['jelly'], snowman: ['snowball'], snow_rock: ['snowball'], toyblock: ['jackbox'], coral: ['urchin'], skyrock: ['cloudsheep'], rock: ['spider'] });
  assert.deepEqual(TWIN_BLOCKS, { jackbox: ['toyblock'], snowball: ['snowman', 'snow_rock'], cloudsheep: ['skyrock'], spider: ['rock'] }); assert.equal(TWIN_GAP, 8);
  for (const [creatureType, pieces] of Object.entries(TWIN_BLOCKS)) for (const piece of pieces) assert.ok(LOOKALIKES[piece].includes(creatureType));
  // With the real scenery of the day: no twin within 8 m of its blocking lookalike.
  const pieces = (x, z) => { const out = [], tx = Math.floor(x / FIELD_TILE), tz = Math.floor(z / FIELD_TILE); for (let ix = tx - 1; ix <= tx + 1; ix++) for (let iz = tz - 1; iz <= tz + 1; iz++) out.push(...fieldTrees(ix, iz)); return out; };
  for (const c of commons()) if (TWIN_BLOCKS[c.type]) for (const t of pieces(c.x, c.z)) assert.ok(!TWIN_BLOCKS[c.type].includes(String(t.kind).split('@')[0]) || Math.hypot(t.x - c.x, t.z - c.z) >= TWIN_GAP, `${c.id} (${c.type}) is 8 m from a ${t.kind}`);
  // And with pieces of the test's own added to the real scenery: a snowman beside every snowball's slot, a tinted rock beside every spider's.
  const plain = commons(), near = (list, kind) => (tx, tz) => list.filter(c => Math.floor(c.x / FIELD_TILE) === tx && Math.floor(c.z / FIELD_TILE) === tz).map(c => ({ x: c.x + 3, z: c.z, r: .5, kind }));
  for (const [type, kind, region] of [['snowball', 'snowman', 'ice'], ['snowball', 'snow_rock', 'ice'], ['jackbox', 'toyblock', 'toy'], ['cloudsheep', 'skyrock', 'cloud'], ['spider', 'rock@shadow', 'shadow']]) {
    const twins = plain.filter(c => c.type === type); assert.ok(twins.length >= 3, `${type} is seeded (${twins.length})`);
    const extra = near(twins, kind), env = { ...SPAWN_ENV, trees: (tx, tz) => [...SPAWN_ENV.trees(tx, tz), ...extra(tx, tz)] }, after = commons(env).filter(c => c.region === region), ids = new Map(after.map(c => [c.id, c]));
    assert.equal(after.filter(c => c.type === type && twins.some(t => t.id === c.id)).length, 0, `no ${type} is left beside a ${kind}`);
    // Each such slot took the next kind of the mix (or was dropped when that one is a twin of something near too); nothing else moved.
    const order = MIX[region].map(([id]) => id);
    for (const t of twins) { const now = ids.get(t.id); if (now) { assert.equal(now.type, order[(order.indexOf(type) + 1) % order.length]); assert.deepEqual([now.x, now.z], [t.x, t.z]); } }
    assert.ok(twins.some(t => ids.has(t.id)), 'the slot is kept for the next kind');
    for (const c of plain.filter(c => c.region === region && c.type !== type)) assert.equal(ids.get(c.id)?.type, c.type, 'the others are as they were');
  }
  // A rock is the spider's double only: a mushroom beside a rock stays (the reference's forest has both).
  const west = plain.filter(c => c.region === 'west'), rocks = near(west, 'rock'), rocky = commons({ ...SPAWN_ENV, trees: (tx, tz) => [...SPAWN_ENV.trees(tx, tz), ...rocks(tx, tz)] }).filter(c => c.region === 'west');
  assert.ok(rocky.length > 0 && rocky.every(c => west.find(w => w.id === c.id)?.type === c.type));
});

test('level and power per creature: the scaled health, damage and coins of every den are the table\'s', () => {
  // Spec 4.2: land boss HP × POWER × 2.6 and damage × POWER × 1.35; home bosses unscaled; the dragon POWER and the damage factor, no × 2.6.
  const TABLE = { treant: [700, 22, 120], croc: [850, 25, 140], mushking: [950, 24, 160], bear: [800, 26, 150], robot: [3978, 50.5, 211], cake: [6084, 84.2, 312], gingerbread: [5746, 84.2, 295], jellyqueen: [6760, 87.8, 328],
    gorilla: [6760, 94.8, 369], yeti: [9360, 136.1, 490], mammoth: [10296, 145.8, 510], frostowl: [10764, 136.1, 530], leviathan: [10764, 145.8, 571], golem: [14976, 207.4, 756], dragon: [12480, 233.3, 1764], phoenix: [14976, 207.4, 781], shadowlord: [21762, 284.6, 1232] };
  assert.deepEqual(RANK, { boss: { hp: 2.6, damage: 1.35 }, titan: { hp: 7, damage: 1.6 } }); assert.equal(coinFactor(4.8), .6 + .4 * 4.8);
  const wilds = new Wilds({ now: () => 0 }, seeded(3)), plans = new Map(everyone().filter(c => c.id.startsWith('w:den:')).map(c => [c.type, c]));
  let checked = 0;
  for (const d of DENS) {
    if (!CREATURES[d.type] || CREATURES[d.type].titan) continue; // the nine titans' numbers are asserted in titans.test (builder D2)
    const plan = plans.get(d.type), e = wilds.make(plan), [hp, damage, coins] = TABLE[d.type]; checked++;
    assert.equal(e.maxHp, hp, `${d.type}: ${hp} health`); assert.ok(near(e.damage, damage, .051), `${d.type}: ${damage} damage (${e.damage.toFixed(2)})`); assert.equal(defeatCoins(d.type, d.region), coins, `${d.type}: ${coins} coins`);
    assert.deepEqual([e.level, e.region, e.leash, e.titan, e.baseDamage], [d.level, d.region, d.leash, false, e.damage]); assert.equal(e.power, REGION[d.region].kind === 'land' ? POWER[REGION[d.region].difficulty] : 1);
    assert.equal(e.hard, !!d.event, 'only the dragon (and a titan) is held to its leash whatever happens');
  }
  assert.equal(checked, 17, '16 bosses and the dragon');
  // A common in a land: the kind's own numbers × the land's power; the same kind at home is unscaled (the crab lives in both).
  const sand = wilds.make({ id: 'a', type: 'crab', x: 100, z: -100, region: 'ocean', level: 10, power: 3.6 }), canyon = wilds.make({ id: 'b', type: 'crab', x: 100, z: 0, region: 'east', level: 7, power: 1 });
  assert.deepEqual([sand.maxHp, sand.hp, sand.level, canyon.maxHp, canyon.damage, canyon.level], [468, 468, 10, 130, 14, 7]); assert.ok(near(sand.damage, 14 * 3.6));
  // A plan without level and power behaves as before round 8.
  const plain = wilds.make({ id: 'c', type: 'wolf', x: 100, z: 0 }); assert.deepEqual([plain.maxHp, plain.damage, plain.level, plain.power, plain.region, plain.leash], [100, 12, 4, 1, null, 30]);
  // The payment follows the creature: act('defeat', {type, region, titan}) pays by the region and records the kind as beaten.
  const s = freshState(); s.pandora = true; const coins = s.coins;
  assert.equal(act(s, 'defeat', { type: 'shadowlord', region: 'shadow', titan: false }).coins, 1232); assert.equal(s.coins, coins + 1232); assert.deepEqual(s.defeated, { shadowlord: true });
  assert.equal(act(s, 'defeat', { type: 'wisp', region: 'shadow' }).coins, Math.round(20 * (.6 + .4 * 6.2))); assert.equal(act(s, 'defeat', { type: 'wolf' }).coins, 11, 'no region: the kind\'s own coins');
});

test('a made-up titan: × 7 health and × 1.6 damage at home and in a land, 600 s to come back, held within its leash, never staggered', () => {
  CREATURES.titan_made = creature('Made-up Titan', 1500, 30, 1.4, 1500, 'titan', '#778899', { titan: true, boss: true, radius: 3.15, reach: 4.875, sight: 22, scale: 1.8, cooldown: 2.4, windup: .8 });
  try {
    const events = [], wilds = new Wilds({ emit: (kind, e) => events.push(kind) }, seeded(5));
    const home = wilds.make({ id: 'w:den:titan_made', type: 'titan_made', x: 40, z: -100, region: 'east', level: 13, power: 1, titan: true, leash: 30 });
    assert.deepEqual([home.maxHp, home.damage, home.titan, home.hard, home.leash], [10500, 48, true, true, 30], 'the home titan takes the titan\'s factors at power 1');
    const land = wilds.make({ id: 'w:den:titan_far', type: 'titan_made', x: -154, z: -154, region: 'toy', level: 10, power: 1.7, titan: true, leash: 30 });
    assert.equal(land.maxHp, 17850); assert.ok(near(land.damage, 81.6)); assert.equal(defeatCoins('titan_made', 'toy'), 1920); assert.equal(defeatCoins('titan_made', 'east'), 1500);
    // The def's own `titan` is enough when a plan does not say.
    assert.equal(wilds.make({ id: 't', type: 'titan_made', x: 40, z: -100 }).titan, true);
    // The hard leash: no step ends more than 30 m from the den, though a creature already outside may still walk back.
    home.born = 0; wilds.list.push(home); wilds.open = true;
    assert.equal(wilds.walkable(home, 40 + 29, -100), true); assert.equal(wilds.walkable(home, 40 + 31, -100), false);
    home.x = 40 + 35; assert.equal(wilds.walkable(home, 40 + 34, -100), true, 'closer to home is allowed'); assert.equal(wilds.walkable(home, 40 + 36, -100), false); home.x = 40;
    // Hit control: a hard stun becomes a slow, the knock-back a nudge, the launch a sixteenth.
    wilds.hit(home, 10, 1.5, 0, 0); assert.equal(home.stun, 0); assert.ok(near(home.slow, .9)); assert.ok(events.includes('resist'));
    // Defeated: 600 s, not a boss's 90.
    assert.equal(AI.titanRespawn, 600); wilds.hit(home, 99999); assert.equal(home.hp, 0); assert.equal(home.respawn, 600);
    const far = { x: 40 + 60, z: -100, active: true }; for (let t = 0; t < 599; t += 1) wilds.step(1, far); assert.equal(home.hp, 0); wilds.step(1, far); wilds.step(1, far); assert.equal(home.hp, 10500, 'back after ten minutes');
    // The save remembers it like any kind; the coins carry no extra titan factor (the titan's own XP is already its size).
    const s = freshState(); s.pandora = true; assert.equal(act(s, 'defeat', { type: 'titan_made', region: 'east', titan: true }).coins, 1500); assert.equal(s.defeated.titan_made, true);
  } finally { delete CREATURES.titan_made; }
});

test('a dead magma slime leaves three tiny slimes that never come back; at most eighteen at once', () => {
  const events = [], wilds = new Wilds({ emit: (kind, e) => events.push([kind, e.type]) }, seeded(11)); wilds.open = true;
  const slime = wilds.make({ id: 'w:1,8:0', type: 'magmaslime', x: -100, z: -220, region: 'lava', level: 13, power: 4.8 }); slime.born = 0; wilds.list.push(slime);
  assert.equal(slime.maxHp, 384); assert.equal(CREATURES.magmaslime.splits, 'minislime'); assert.ok(!MIX.lava.some(([type]) => type === 'minislime'), 'the tiny slime is in no mix');
  wilds.hit(slime, 999);
  const minis = wilds.list.filter(e => e.type === 'minislime'); assert.equal(minis.length, 3);
  for (const m of minis) { assert.ok(near(Math.hypot(m.x - slime.x, m.z - slime.z), .9), '0.9 m round it'); assert.deepEqual([m.region, m.level, m.power, m.maxHp, m.temp], ['lava', 13, 4.8, Math.round(24 * 4.8), true]); assert.ok(near(m.damage, 24)); }
  assert.equal(events.filter(([k, t]) => k === 'spawn' && t === 'minislime').length, 3);
  // A tiny slime dies for good: it is taken out of the list when it has shrunk away, and nothing brings it back.
  const far = { x: -100, z: -220 + 60, active: true }; wilds.hit(minis[0], 999); assert.equal(minis[0].respawn, Infinity);
  for (let t = 0; t < 1; t += STEP) wilds.step(STEP, far); assert.equal(wilds.list.includes(minis[0]), false); assert.equal(wilds.list.filter(e => e.type === 'minislime').length, 2);
  for (let t = 0; t < 60; t += .5) wilds.step(.5, far); assert.equal(wilds.list.filter(e => e.type === 'minislime').length, 2);
  // The big one does come back (22 to 32 s), and splitting again never passes eighteen living tiny slimes.
  assert.equal(slime.hp, slime.maxHp);
  for (let i = 0; i < 12; i++) { const again = wilds.make({ id: 'x' + i, type: 'magmaslime', x: -100 + i, z: -228, region: 'lava', level: 13, power: 4.8 }); wilds.list.push(again); wilds.hit(again, 999); }
  assert.equal(wilds.list.filter(e => e.type === 'minislime' && e.hp > 0).length, 18);
  // They belong to no cell: when the window of cells moves away they go.
  wilds.sync(true, -100, -220); assert.ok(wilds.list.some(e => e.temp)); wilds.sync(true, 200, 0); assert.equal(wilds.list.some(e => e.temp), false);
});

test('the creature files: one per square, trimmed from the reference, and the home file with the three new home bosses', () => {
  const roots = file => { const b = readFileSync(new URL(`../public/assets/models/${file}.glb`, import.meta.url)), j = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8')); return { names: j.scenes[j.scene ?? 0].nodes.map(i => j.nodes[i].name), bytes: b.length }; };
  const FILES = { 'wild-creatures': ['mushroom', 'boar', 'bee', 'wolf', 'frog', 'crab', 'chomper', 'cactus', 'bear', 'treant', 'croc', 'mushking'], 'c-candy': ['jelly', 'gummy'], 'c-ice': ['snowball', 'penguin', 'icebloom', 'yeti', 'mammoth'],
    'c-lava': ['magmaslime', 'minislime', 'firelizard', 'magmacrab'], 'c-jungle': ['chameleon', 'flytrap'], 'c-cloud': ['cloudsheep'] };
  const modelled = new Set(['forest_raptor']);
  for (const [file, names] of Object.entries(FILES)) { const f = roots(file); assert.deepEqual(f.names, names, file); assert.ok(f.bytes < 460000, `${file}.glb is ${f.bytes} bytes`); for (const name of names) { assert.ok(CREATURES[name], name); modelled.add(name); } }
  assert.ok(roots('forest-birds').names.includes('forest_raptor'), 'the hawk is the bird Willowmere already ships');
  // Every other kind is drawn by the reference's procedural code, from its row's family: 22 commons and 11 bosses.
  const procedural = Object.keys(CREATURES).filter(type => !CREATURES[type].titan && !modelled.has(type));
  assert.equal(procedural.length, 33); assert.equal(procedural.filter(type => CREATURES[type].boss).length, 11);
  for (const type of Object.keys(CREATURES)) if (!CREATURES[type].titan && !['mushroom', 'boar', 'bee', 'wolf', 'frog', 'crab', 'chomper', 'cactus', 'bear'].includes(type)) assert.ok(CREATURES[type].family, `${type} has a family to be drawn from until (or instead of) its model`);
  assert.deepEqual(procedural.filter(type => CREATURES[type].boss).sort(), ['cake', 'dragon', 'frostowl', 'gingerbread', 'golem', 'gorilla', 'jellyqueen', 'leviathan', 'phoenix', 'robot', 'shadowlord']);
});
