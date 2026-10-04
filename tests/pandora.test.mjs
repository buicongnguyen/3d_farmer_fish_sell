import test from 'node:test';
import { existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { freshState, act, parseSave, sellPrice } from '../src/game.mjs';
import { ITEMS, CROPS, ROADS } from '../src/content.mjs';
import { inVillage, VILLAGE } from '../src/field-layout.mjs';
import { GEAR, gearStats, weaponOf } from '../src/gear.mjs';
import { pandoraOpen, maxHp, hurt, recover, foodHeal, rollLoot, knockoutLoss, combatStats, spareGearCoins, defeatCoins, LOOT, HEAL, KNOCKOUT, HELPERS_LINE } from '../src/pandora.mjs';
import { CREATURES, SAFE, WARD_MARGIN, DEN, WILD_CELL, WILD_RADIUS, AI, STEP, Wilds, wildCell, inSafeZone, wildDepth, windupProgress, aggro } from '../src/wilds.mjs';
import { regionAt, REGION, DENS, borderDistance, squareOf } from '../src/regions.mjs';
import { SKILL } from '../src/boss-patterns.mjs';
import { MIX } from '../src/region-mix.mjs';
import { Combat, Drops, SKILLS, TUNING, DROP, damageTaken, hitDamage, attackRange, attackCooldown, dropVisible } from '../src/combat.mjs';

// Gear comes from gear.mjs: the tests pick pieces by what they are (a sword, a gun, armour), not by id.
const weaponId = kind => Object.keys(GEAR).find(id => GEAR[id].slot === 'weapon' && GEAR[id].kind === kind && !(GEAR[id].spread > 1));
const armourIds = () => ['hat', 'wear', 'boots'].map(slot => Object.keys(GEAR).find(id => GEAR[id].slot === slot && (GEAR[id].def > 0 || GEAR[id].hp > 0)) ?? '');
const seeded = seed => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const open = () => { const s = freshState(); assert.ok(act(s, 'pandora', { open: true }).ok); return s; };
/** A Wilds with recorded events and blows, and a Combat on top of it for a player at `player`. */
function arena({ player = { x: 120, z: 0, active: true }, state = open(), random = seeded(7), blocked } = {}) {
  const events = [], blows = [], effects = [];
  const wilds = new Wilds({ blocked, emit: (kind, e) => events.push([kind, e.type]), hurt: (amount, source, e) => blows.push({ amount, source, type: e?.type }) }, random);
  const pose = { facing: 0 };
  const combat = new Combat({ position: () => player, facing: () => pose.facing, face: a => { pose.facing = a; }, targets: () => wilds.list, weapon: () => weaponOf(state), stats: () => combatStats(state),
    move: (dx, dz) => { player.x += dx; player.z += dz; }, hit: (t, amount, critical, stun, lift, knock, dx, dz) => wilds.hit(t, amount, stun, lift, knock, dx, dz), effect: (kind, x, z, r) => effects.push([kind, r]) }, random);
  const run = (seconds, each) => { for (let t = 0; t < seconds - 1e-9; t += STEP) { each?.(); combat.update(STEP); wilds.step(STEP, player); } };
  return { wilds, combat, player, state, events, blows, effects, pose, run };
}
/**
 * Puts one creature of `type` at (x, z) in an arena whose cells are otherwise empty. It belongs to the region it stands in (a
 * creature never leaves its own region); `options.plan` adds to its spawn plan (level, power, leash...).
 */
function withCreature(type, x, z, options) {
  const a = arena(options), e = a.wilds.make({ id: `t:${type}`, type, x, z, region: regionAt(x, z), ...options?.plan }); e.born = 0;
  a.wilds.list.push(e); a.wilds.open = true; return { ...a, e };
}

test('the box starts shut; act toggles it and old saves default to shut with full health', () => {
  const s = freshState(); assert.equal(s.pandora, false); assert.equal(s.hp, 100); assert.equal(pandoraOpen(s), false);
  assert.equal(act(s, 'pandora', {}).ok, false); assert.equal(act(s, 'pandora', { open: 'yes' }).ok, false);
  assert.equal(act(s, 'pandora', { open: false }).ok, false, 'already shut');
  assert.ok(act(s, 'pandora', { open: true }).ok); assert.equal(s.pandora, true); assert.equal(act(s, 'pandora', { open: true }).ok, false, 'already open');
  s.hp = 37; const saved = parseSave(JSON.parse(JSON.stringify(s))); assert.equal(saved.pandora, true); assert.equal(saved.hp, 37);
  assert.ok(act(s, 'pandora', { open: false }).ok); assert.equal(s.pandora, false); assert.equal(s.hp, maxHp(s), 'shutting the box rests you');
  const old = JSON.parse(JSON.stringify(freshState())); delete old.pandora; delete old.hp;
  const parsed = parseSave(old); assert.equal(parsed.pandora, false); assert.equal(parsed.hp, 100);
  assert.equal(parseSave({ ...old, pandora: 'true', hp: -5 }).pandora, false); assert.equal(parseSave({ ...old, hp: -5 }).hp, 0); assert.equal(parseSave({ ...old, hp: 'full' }).hp, 100);
});

test('with the box shut nothing is fought, dropped or lost', () => {
  const s = freshState(), before = JSON.stringify(s);
  assert.equal(act(s, 'defeat', { type: 'mushroom' }).ok, false); assert.equal(act(s, 'pickup', { id: 'honey', count: 1 }).ok, false); assert.equal(act(s, 'knockout').ok, false);
  assert.deepEqual(hurt(s, 50), { damage: 0, out: false }); recover(s, 10, 'home'); assert.equal(foodHeal(s, 30), 0);
  assert.equal(JSON.stringify(s), before);
  const wilds = new Wilds(); wilds.sync(false, 200, 0); wilds.step(STEP, { x: 200, z: 0 }); assert.equal(wilds.list.length, 0); assert.equal(wilds.cells.size, 0);
});

test('creature facts follow the reference and every creature has loot that Willowmere knows', () => {
  // Every kind that is not a titan (the nine titans are builder D2's rows, checked in titans.test): the nine of round 7, the forest
  // hawk, the three other home bosses, the 33 commons of the eight lands with the tiny slime, their 12 bosses and the dragon.
  const kinds = Object.keys(CREATURES).filter(type => !CREATURES[type].titan);
  assert.deepEqual(kinds.sort(), ['bear', 'bee', 'boar', 'bunny', 'cactus', 'cake', 'chameleon', 'chocobeetle', 'chomper', 'cloudsheep', 'crab', 'croc', 'demoneye', 'dragon', 'firebat', 'firelizard', 'flytrap', 'forest_raptor', 'frog', 'frostowl',
    'gingerbread', 'golem', 'gorilla', 'gummy', 'hammershark', 'icebloom', 'jackbox', 'jelly', 'jellyqueen', 'jellyzap', 'lavaworm', 'leviathan', 'lollipop', 'magmacrab', 'magmaslime', 'magmaturtle', 'mammoth', 'minislime', 'monkey', 'mushking',
    'mushroom', 'owl', 'penguin', 'phoenix', 'robot', 'seal', 'shadowlord', 'snake', 'snowball', 'spider', 'thunderbird', 'toysoldier', 'treant', 'urchin', 'volcano', 'windmouse', 'windspirit', 'wisp', 'wolf', 'yeti']);
  assert.equal(kinds.length, 60);
  const m = CREATURES.mushroom, bear = CREATURES.bear;
  assert.deepEqual([m.hp, m.damage, m.speed, m.reach, m.sight, m.radius, m.cooldown, m.windup], [45, 6, 2.4, 1.3, 8, .55, 1.5, .45]);
  assert.deepEqual([bear.hp, bear.damage, bear.reach, bear.radius, bear.boss, bear.coins], [800, 26, 2.6, 1.4, true, 150]);
  assert.equal(CREATURES.boar.behavior, 'charger'); assert.equal(CREATURES.cactus.behavior, 'shooter'); assert.equal(CREATURES.chomper.speed, 0); assert.ok(CREATURES.bee.flying);
  for (const type of kinds) {
    const def = CREATURES[type];
    assert.ok(def.coins > 0 && def.windup >= .25, `${type}: a wind-up you can react to`);
    assert.ok(LOOT[type]?.length, `${type} drops something`);
    for (const [id, chance, min, max] of LOOT[type]) { assert.ok(ITEMS[id] || CROPS[id.slice(5)] || GEAR[id], `${type} drops a known item: ${id}`); assert.ok(!(ITEMS[id] && GEAR[id]), `${id} is one thing`); assert.ok(chance > 0 && chance <= 1 && min >= 1 && max >= min); if (GEAR[id]) assert.equal(max, 1); }
  }
  for (const id of ['hide', 'honey', 'tusk', 'claw', 'nectar', 'spine', 'cog', 'sugar', 'amber', 'icecrystal', 'pearl', 'obsidian', 'feather', 'moonstone']) { assert.ok(sellPrice(freshState(), id) > 0, `${id} sells at the market`); assert.ok(existsSync(new URL(`../public/assets/icons/${ITEMS[id].icon}.webp`, import.meta.url)), `${id} has its icon`); }
});

test('spawn plan: seeded by region, none inside the village ward or a den’s clearing, one King Bear in his canyon den', () => {
  // The ward hugs the village: the footprint (the ring road's outer edge and the Town Square, with a metre of verge) and a metre more on every side.
  assert.deepEqual(SAFE, { x0: VILLAGE.x0 - WARD_MARGIN, x1: VILLAGE.x1 + WARD_MARGIN, z0: VILLAGE.z0 - WARD_MARGIN, z1: VILLAGE.z1 + WARD_MARGIN }); assert.ok(WARD_MARGIN >= 1 && WARD_MARGIN <= 2);
  assert.ok(SAFE.x1 - SAFE.x0 < 116 && SAFE.z1 - SAFE.z0 < 94, 'much smaller than the old 148 x 144 ward, and than round 7’s 127 x 100');
  // No creature is ever placed on the ring road (the road with the yellow dashes) or within a metre of it.
  const onRoad = (x, z, pad = 1) => Math.abs(x) < ROADS.east + 2.5 + pad && z > ROADS.north - 2.5 - pad && z < ROADS.south + 2.5 + pad;
  let nearest = Infinity, total = 0; const types = {}, dens = [];
  // The same scan as before round 8 (±448 m): wider than the world, so it also shows that nothing is seeded outside it.
  for (let cx = -14; cx <= 14; cx++) for (let cz = -14; cz <= 14; cz++) {
    const cell = wildCell(cx, cz); assert.deepEqual(cell, wildCell(cx, cz), 'deterministic');
    assert.ok(cell.length <= 5);
    for (const c of cell) {
      total++;
      assert.ok(!inSafeZone(c.x, c.z, 1) && !inVillage(c.x, c.z), `${c.id} at ${c.x.toFixed(0)},${c.z.toFixed(0)} is outside the ward`);
      assert.ok(!onRoad(c.x, c.z), `${c.id} is off the road`);
      assert.ok(borderDistance(c.x, c.z) >= 2, `${c.id} is 2 m or more from the ward line, the seams and every border`); nearest = Math.min(nearest, wildDepth(c.x, c.z));
      assert.equal(c.region, regionAt(c.x, c.z), `${c.id} is seeded in the region it stands in`); assert.ok(REGION[c.region] && c.region !== 'village');
      if (c.id.startsWith('w:den:')) { dens.push(c); continue; }
      assert.ok(MIX[c.region].some(([id]) => id === c.type), `${c.type} belongs to ${c.region}`);
      assert.ok(Math.abs(c.x) < 320 && Math.abs(c.z) < 320, `${c.id} is inside the world`);
      (types[c.region] ??= new Set()).add(c.type);
      for (const d of DENS) assert.ok(Math.hypot(c.x - d.x, c.z - d.z) >= d.clear, `${c.id} is outside the clearing of ${d.id}`);
    }
  }
  assert.ok(total > 250 && total < 420, `all twelve regions are populated (${total}); counts, kinds and clearances by region are in region-mix.test`);
  assert.equal(DENS.length, 26);
  // A den holds its creature once the kind has a row: the 16 bosses and the dragon's nest here (the nine titans come with their rows).
  const expected = DENS.filter(d => CREATURES[d.type]).map(d => [d.id, d.type, d.x, d.z]), byId = (a, b) => a[0] < b[0] ? -1 : 1;
  assert.deepEqual(dens.map(b => [b.id, b.type, b.x, b.z]).sort(byId), expected.sort(byId));
  assert.ok(dens.some(b => b.id === 'w:den:bear' && b.x === DEN.x && b.z === DEN.z)); assert.ok(expected.length >= 17);
  assert.equal(Object.keys(types).length, 12);
  // The cells that lie wholly inside the ward hold nothing at all; creatures begin right outside it, and do live that close.
  for (let cx = -1; cx <= 0; cx++) for (let cz = -1; cz <= 0; cz++) assert.equal(wildCell(cx, cz).length, 0);
  assert.ok(nearest >= 2 && nearest < 8, `a creature lives within a few metres of the ward line (${nearest.toFixed(1)} m; the old ward kept them 6 m and more away, 14 m from the old footprint)`);
  let close = 0; for (let cx = -3; cx <= 3; cx++) for (let cz = -3; cz <= 3; cz++) for (const c of wildCell(cx, cz)) if (wildDepth(c.x, c.z) < 20) close++;
  assert.ok(close >= 8, `creatures all round the village edge (${close} within 20 m of the ward)`);
  assert.equal(regionAt(0, 0), 'village'); assert.equal(regionAt(SAFE.x1 + 1, 0), 'east'); assert.equal(regionAt(SAFE.x1 + 30, 0), 'east'); assert.equal(regionAt(0, SAFE.z0 - 100), 'north'); assert.equal(regionAt(0, SAFE.z1 + 30), 'south');
  // The King Bear moved in round 8: from the far north-east (outside the world now) to the Redrock Canyon, 95.5 m beyond the ward.
  assert.ok(Math.abs(wildDepth(DEN.x, DEN.z) - 95.5) < 1 && regionAt(DEN.x, DEN.z) === 'east'); assert.equal(regionAt(227, -185), null);
});

test('creatures exist only while the box is open: a window of cells follows the player and empties when it shuts', () => {
  const events = [], wilds = new Wilds({ emit: (kind, e) => events.push(kind) }, seeded(3));
  wilds.sync(false, 150, 20); assert.equal(wilds.list.length, 0);
  wilds.sync(true, 150, 20); const first = wilds.list.length;
  assert.equal(wilds.cells.size, (WILD_RADIUS * 2 + 1) ** 2); assert.ok(first > 12 && first < 110, `a living field, not a horde (${first})`);
  assert.ok(wilds.list.every(e => e.hp === e.maxHp && !inSafeZone(e.x, e.z) && Math.abs(e.x - 150) < WILD_CELL * 3 && Math.abs(e.z - 20) < WILD_CELL * 3));
  assert.equal(events.filter(k => k === 'spawn').length, first);
  const ids = wilds.list.map(e => e.id).sort(); wilds.sync(true, 151, 21); assert.deepEqual(wilds.list.map(e => e.id).sort(), ids, 'same cell, same creatures');
  // One cell west (east of the stand lies the Night Land, empty until its kinds arrive: the new column must hold someone).
  wilds.sync(true, 150 - WILD_CELL, 20); assert.equal(wilds.cells.size, 25); assert.ok(wilds.list.some(e => !ids.includes(e.id)) && wilds.list.length < first * 2);
  assert.equal(new Set(wilds.list.map(e => e.id)).size, wilds.list.length, 'no creature twice');
  // In the middle of the village the window holds nothing near the player.
  const home = new Wilds({}, seeded(3)); home.sync(true, 0, -8); assert.ok(home.list.every(e => !inSafeZone(e.x, e.z)));
  // Shutting the box: they shrink away over a third of a second, then none are left and none come back.
  wilds.sync(false, 150 - WILD_CELL, 20); assert.ok(wilds.list.length > 0 && wilds.list.every(e => e.leaving > 0)); assert.equal(wilds.cells.size, 0);
  for (let t = 0; t < .5; t += STEP) wilds.step(STEP, { x: 118, z: 20, active: true });
  assert.equal(wilds.list.length, 0); wilds.sync(false, 500, 500); wilds.step(STEP, null); assert.equal(wilds.list.length, 0);
});

test('damage taken: amount × 60 / (defence + 60), never under 1; test mode halves it; gear counts', () => {
  assert.equal(damageTaken(26, 0), 26); assert.equal(damageTaken(26, 60), 13); assert.equal(damageTaken(10, 20), 8); assert.equal(damageTaken(1, 1000), 1); assert.equal(damageTaken(12, -5), 12);
  const s = open(); assert.deepEqual(hurt(s, 26), { damage: 26, out: false }); assert.equal(s.hp, 74);
  assert.deepEqual([gearStats(s).maxHp, gearStats(s).attack, gearStats(s).defense], [100, 10, 0], 'bare: 100 health, 10 attack'); assert.equal(weaponOf(s).kind, 'fist'); assert.equal(weaponOf(freshState()).range, 1);
  const [hat, wear, boots] = armourIds(), sword = weaponId('sword'); assert.ok(sword && (hat || wear || boots), 'gear.mjs offers a sword and some armour');
  s.gear = { hat, wear, boots, weapon: sword, pet: '' };
  const g = gearStats(s); assert.ok(g.defense > 0 && g.maxHp > 100 && g.attack > 10, 'worn gear gives health, attack and defence');
  assert.equal(maxHp(s), Math.round(g.maxHp)); assert.equal(combatStats(s).attack, g.attack); assert.equal(combatStats(s).defense, g.defense); assert.equal(weaponOf(s), GEAR[sword]);
  const first = damageTaken(26, g.defense); assert.ok(first < 26, 'defence takes its share'); assert.equal(hurt(s, 26).damage, first); assert.equal(s.hp, 74 - first);
  s.settings.test = true; assert.equal(hurt(s, 26).damage, damageTaken(13, g.defense)); assert.equal(combatStats(s).attack, g.attack * 3);
  s.settings.test = false; s.hp = 5; assert.deepEqual(hurt(s, 500), { damage: damageTaken(500, g.defense), out: true }); assert.equal(s.hp, 0);
});

test('a blow: attack × multiplier, doubled on a crit, within ±10 %', () => {
  assert.equal(hitDamage(10, 1, false, .5), 10); assert.equal(hitDamage(10, 1, false, 0), 9); assert.equal(hitDamage(10, 1, false, 1), 11); assert.equal(hitDamage(10, 1.5, true, .5), 30); assert.equal(hitDamage(.1, 1, false, 0), 1);
  assert.equal(attackRange({ kind: 'fist', range: 1 }, .8), 1.8); assert.equal(attackRange({ kind: 'sword', range: 2 }, .7), 2.7); assert.equal(attackRange({ kind: 'gun', range: 8 }, .7), 8);
  assert.equal(attackCooldown({ kind: 'fist', cooldown: .5 }), .5); assert.equal(attackCooldown({ kind: 'sword' }), .4); assert.ok(Math.abs(attackCooldown({ kind: 'gun', cooldown: .6 }, .5) - .4) < 1e-9);
});

test('knock-out is gentle: wake rested an hour later, lose 5 % of coins up to 30, nothing in test mode', () => {
  const s = open(); s.coins = 400; s.hp = 0; s.time = 10; const inventory = JSON.stringify(s.inventory);
  assert.equal(knockoutLoss(s), 20); const r = act(s, 'knockout'); assert.ok(r.ok); assert.equal(r.loss, 20);
  assert.equal(s.coins, 380); assert.equal(s.hp, maxHp(s)); assert.equal(s.time, 11); assert.equal(JSON.stringify(s.inventory), inventory, 'the basket is untouched'); assert.equal(s.pandora, true);
  s.coins = 5000; s.time = 21.6; act(s, 'knockout'); assert.equal(s.coins, 5000 - KNOCKOUT.cap); assert.equal(s.time, 22);
  s.coins = 7; act(s, 'knockout'); assert.equal(s.coins, 7, 'small purses lose nothing'); s.coins = 0; assert.ok(act(s, 'knockout').ok); assert.equal(s.coins, 0);
  s.coins = 5000; s.settings.test = true; assert.equal(act(s, 'knockout').loss, 0); assert.equal(s.coins, 5000);
});

test('health returns fast at home, slowly in the village, and food heals while the box is open', () => {
  const s = open(); s.hp = 20;
  recover(s, 1, 'wild'); assert.equal(s.hp, 20); recover(s, 1, 'village'); assert.equal(s.hp, 20 + HEAL.village); recover(s, 1, 'home'); assert.equal(s.hp, 24 + HEAL.home);
  recover(s, 60, 'home'); assert.equal(s.hp, 100); s.hp = 0; recover(s, 5, 'home'); assert.equal(s.hp, 0, 'a knock-out waits for the wake-up');
  s.hp = 40; s.energy = 100; s.inventory.soup = 2; s.inventory.honey = 1;
  const meal = act(s, 'eat', { id: 'soup' }); assert.ok(meal.ok, 'full of energy but hurt: eating is allowed'); assert.equal(s.hp, 75); assert.match(meal.message, /\+35 health/);
  assert.ok(act(s, 'eat', { id: 'honey' }).ok); assert.equal(s.hp, 95); s.hp = 100; assert.equal(act(s, 'eat', { id: 'soup' }).ok, false); assert.equal(s.inventory.soup, 1);
  const shut = freshState(); shut.inventory.soup = 1; shut.hp = 10; assert.equal(act(shut, 'eat', { id: 'soup' }).ok, false, 'box shut: food is only for energy');
});

test('rewards: coins at once, seeded loot, pickups land in the basket', () => {
  const s = open(), coins = s.coins;
  const win = act(s, 'defeat', { type: 'wolf' }); assert.ok(win.ok); assert.equal(win.coins, 11); assert.equal(s.coins, coins + 11); assert.equal(act(s, 'defeat', { type: 'unicorn' }).ok, false);
  // In a land the coins follow the land's power (the kind's coins × (0.6 + 0.4 × power)); at home they are the kind's own, whatever the region's label.
  assert.equal(defeatCoins('robot', 'toy'), 211); assert.equal(defeatCoins('wolf', 'east'), 11); assert.equal(defeatCoins('crab', 'ocean'), Math.round(13 * (.6 + .4 * 3.6))); assert.equal(defeatCoins('dragon', 'lava'), 1764);
  const purse0 = s.coins, robot = act(s, 'defeat', { type: 'robot', region: 'toy', titan: false }); assert.equal(robot.coins, 211); assert.equal(s.coins, purse0 + 211); assert.equal(s.defeated.robot, true); assert.equal(s.defeated.wolf, true);
  assert.deepEqual(rollLoot('bear', seeded(1)), rollLoot('bear', seeded(1)));
  const always = rollLoot('bear', () => 0), never = rollLoot('bear', () => .999);
  assert.deepEqual(always.map(l => l.id), ['game', 'hide', 'honey', 'hat_bear', 'crown']); assert.deepEqual(always.map(l => l.count), [2, 2, 1, 1, 1]);
  assert.deepEqual(never.map(l => [l.id, l.count]), [['game', 4], ['hide', 3]], 'sure drops only, at their most');
  assert.deepEqual(rollLoot('nothing'), []);
  let dropped = 0; const r = seeded(11); for (let i = 0; i < 400; i++) dropped += rollLoot('mushroom', r).length; assert.ok(dropped > 200 && dropped < 280, `about 60 % (${dropped})`);
  assert.ok(act(s, 'pickup', { id: 'hide', count: 2 }).ok); assert.equal(s.inventory.hide, 2); assert.ok(act(s, 'pickup', { id: 'seed_berry', count: 1 }).ok); assert.equal(s.inventory.seed_berry, 1);
  for (const bad of [{ id: 'gold_bar', count: 1 }, { id: 'hide', count: 0 }, { id: 'hide', count: 99 }, { id: 'seed_dragon', count: 1 }, { id: 'crown', count: 2 }, {}]) assert.equal(act(s, 'pickup', bad).ok, false);
  // The King Bear's gear goes to the wardrobe; a second copy turns into coins.
  const purse = s.coins, crown = act(s, 'pickup', { id: 'crown', count: 1 }); assert.ok(crown.ok); assert.equal(crown.gear, 'crown'); assert.ok(s.gearOwned.includes('crown')); assert.equal(s.inventory.crown, undefined); assert.equal(s.coins, purse);
  const spare = act(s, 'pickup', { id: 'crown', count: 1 }); assert.ok(spare.ok); assert.equal(spare.coins, spareGearCoins('crown')); assert.equal(s.coins, purse + spare.coins); assert.equal(s.gearOwned.filter(id => id === 'crown').length, 1);
  s.gear.hat = 'crown'; assert.ok(combatStats(s).attack > 10, 'the crown counts once worn');
  assert.equal(combatStats(freshState()).speed, 1); const fast = Object.keys(GEAR).find(id => GEAR[id].speed > 0); if (fast) { const runner = open(); runner.gear = { ...runner.gear, [GEAR[fast].slot]: fast }; assert.ok(combatStats(runner).speed > 1, 'quick gear quickens your step'); }
  assert.deepEqual(parseSave(JSON.parse(JSON.stringify(s))).inventory.hide, 2, 'the new materials survive a save');
});

test('drops: tossed, at rest within 1.5 m, pulled in by the magnet after 0.6 s, gone after 30 s', () => {
  const drops = new Drops(seeded(5)), picked = [];
  const d = drops.spawn('hide', 2, 100, 0); assert.equal(drops.count, 1); assert.ok(d.y > 0 && d.vy > 0);
  for (let t = 0; t < .5; t += STEP) drops.step(STEP, { x: 100, z: 0 }, x => picked.push(x));
  assert.equal(picked.length, 0, 'not before the magnet delay'); assert.ok(d.live);
  for (let t = 0; t < 2; t += STEP) drops.step(STEP, null); assert.ok(d.resting); const reach = Math.hypot(d.x - 100, d.z); assert.ok(reach > .2 && reach < 3, `landed ${reach.toFixed(2)} m away`);
  for (let t = 0; t < 1; t += STEP) drops.step(STEP, { x: 104.5, z: 0 }, x => picked.push(x)); assert.equal(picked.length, 0, 'out of the magnet’s reach');
  for (let t = 0; t < 1.5; t += STEP) drops.step(STEP, { x: 100, z: 0 }, x => picked.push(x)); assert.deepEqual(picked.map(p => [p.item, p.count]), [['hide', 2]]); assert.equal(drops.count, 0);
  const lost = drops.spawn('honey', 1, 300, 300); for (let t = 0; t < DROP.life + .1; t += .1) drops.step(.1, { x: 0, z: 0 }, x => picked.push(x)); assert.equal(lost.live, false); assert.equal(picked.length, 1);
  assert.ok(dropVisible(10, 0)); assert.ok([...Array(40)].some((_, i) => !dropVisible(3, i * .05)), 'blinks near the end');
  for (let i = 0; i < DROP.max + 5; i++) drops.spawn('hide', 1, i, 0); assert.equal(drops.count, DROP.max, 'a fixed pool');
});

test('a creature notices, winds up, strikes, and gives up at the ward: it never enters the village', () => {
  const { wilds, e, player, events, blows, run } = withCreature('wolf', SAFE.x1 + 14, 0, { player: { x: SAFE.x1 + 40, z: 0, active: true } });
  run(1); assert.equal(e.phase, 'idle', 'out of sight: calm'); assert.ok(Math.hypot(e.x - e.homeX, e.z - e.homeZ) <= AI.wander + .1);
  player.x = SAFE.x1 + 22; run(.2); assert.equal(e.phase, 'chase'); assert.deepEqual(events.filter(([k]) => k === 'alert'), [['alert', 'wolf']]);
  let winding = 0, peak = 0; run(4, () => { if (e.phase === 'windup') { winding += STEP; peak = Math.max(peak, windupProgress(e)); } });
  assert.ok(blows.length >= 2 && blows.every(b => b.amount === 12 && b.source === 'melee'), `the wolf bites (${blows.length})`); assert.ok(winding >= .3 && peak > .9, 'each bite is telegraphed'); assert.ok(aggro(e));
  // The player walks back into the village, slower than the wolf: it follows to the ward line and no farther, bites
  // nothing through the ward, then walks home and heals.
  wilds.hit(e, 30); let nearest = Infinity, inside = -1;
  for (let i = 0; i < 700; i++) {
    player.x = Math.max(SAFE.x1 - 10, player.x - 3 * STEP); if (inside < 0 && inSafeZone(player.x, player.z)) inside = blows.length;
    wilds.step(STEP, player); nearest = Math.min(nearest, e.x - e.radius); assert.ok(!inSafeZone(e.x, e.z, e.radius - .01), `outside the ward at step ${i}`);
  }
  assert.ok(nearest < SAFE.x1 + 3, `it came to the ward line (${nearest.toFixed(1)})`); assert.ok(inside >= 0 && blows.length === inside, 'no bites through the ward');
  run(12); assert.equal(e.phase, 'idle'); assert.equal(e.hp, e.maxHp, 'healed on the way home'); assert.ok(Math.hypot(e.x - e.homeX, e.z - e.homeZ) < 3);
});

test('a driver, a sleeper and a far-away player are left alone; far creatures rest', () => {
  const { e, player, blows, run } = withCreature('mushroom', 120, 0, { player: { x: 122, z: 0, active: false } });
  run(3); assert.equal(e.phase, 'idle'); assert.equal(blows.length, 0, 'inactive player (driving, indoors): ignored');
  player.active = true; run(.5); assert.equal(e.phase !== 'idle', true);
  const far = withCreature('boar', 300, 0, { player: { x: 300 + AI.restRange + 5, z: 0, active: true } });
  const at = [far.e.x, far.e.z]; far.run(2); assert.ok(far.e.resting); assert.deepEqual([far.e.x, far.e.z], at, 'resting creatures do not even wander');
});

test('boar charge, cactus shot, snapping flower, King Bear slam', () => {
  const boar = withCreature('boar', 150, 0, { player: { x: 157, z: 0, active: true } });
  let charged = false; boar.run(3, () => { charged ||= boar.e.phase === 'charge'; }); assert.ok(charged, 'charges from 8 m'); assert.ok(boar.blows.some(b => b.amount === 13), 'a charge hits for 1.3 ×');
  const cactus = withCreature('cactus', 200, 0, { player: { x: 208, z: 0, active: true } });
  cactus.run(3); assert.equal(cactus.e.x, 200, 'rooted'); assert.ok(cactus.events.some(([k]) => k === 'shot')); assert.ok(cactus.blows.some(b => b.source === 'shot' && b.amount === 15));
  const dodge = withCreature('cactus', 200, 0, { player: { x: 208, z: 0, active: true } });
  dodge.run(3, () => { dodge.player.z += 5 * STEP; }); assert.equal(dodge.blows.length, 0, 'a walking player sidesteps the spines');
  const flower = withCreature('chomper', 200, 0, { player: { x: 202, z: 0, active: true } });
  flower.run(2.5); assert.ok(flower.blows.length >= 1 && flower.e.x === 200); assert.equal(CREATURES.chomper.telegraph, 1.4);
  const bear = withCreature('bear', DEN.x, DEN.z, { player: { x: DEN.x + 3, z: DEN.z, active: true } });
  const slams = []; bear.run(12, () => { if (bear.e.phase === 'windup' && bear.e.slam && !slams.includes(bear.e.attacks)) slams.push(bear.e.attacks); });
  assert.deepEqual(slams.slice(0, 1), [2], 'a strike, then his first skill, the slam (bosses.test has the whole pattern)'); assert.ok(bear.blows.some(b => b.amount === 26 * SKILL.slam.hit) && bear.blows.some(b => b.amount === 26));
});

test('basic attacks by weapon: fists reach 1 m with a third heavy punch, a sword sweeps, a gun shoots', () => {
  const fist = withCreature('mushroom', 121.5, 0, { random: () => .5 }); fist.e.def = { ...fist.e.def, speed: 0 };
  assert.equal(fist.combat.basic(fist.e), 'fist'); assert.equal(fist.e.hp, 45 - 10); assert.equal(fist.combat.basic(fist.e), '', 'cooling down');
  fist.run(.5); assert.equal(fist.combat.basic(), 'fist'); fist.run(.5); assert.equal(fist.combat.basic(), 'fist'); assert.equal(fist.e.hp, 45 - 10 - 10 - 15, 'the third punch is heavier');
  assert.ok(Math.abs(fist.pose.facing - Math.PI / 2) < 1e-6, 'turned to the creature'); assert.ok(fist.effects.filter(([k]) => k === 'arc').length === 3);
  const out = withCreature('mushroom', 124, 0, { random: () => .5 }); assert.equal(out.combat.basic(out.e), 'fist', 'out of reach: a swing at the air'); assert.equal(out.e.hp, 45);
  const armed = open(); armed.gear = { weapon: weaponId('sword') }; const blade = weaponOf(armed);
  const sword = withCreature('bear', 120 + attackRange(blade, 1.4) - .2, 0, { state: armed, random: () => .5 }); sword.e.def = { ...sword.e.def, speed: 0, sight: 0 };
  assert.equal(sword.combat.basic(sword.e), 'sword'); assert.equal(sword.e.hp, 800 - hitDamage(combatStats(armed).attack, TUNING.sword.power, false, .5), 'a sword reaches farther and hits for 1.1 ×');
  assert.ok(attackRange(blade, 1.4) > attackRange(weaponOf(open()), 1.4) && Math.abs(sword.combat.attackCooldown - attackCooldown(blade)) < 1e-9);
  const gunner = open(); gunner.gear = { weapon: weaponId('gun') }; const barrel = weaponOf(gunner);
  const gun = withCreature('bear', 120 + Math.min(7, attackRange(barrel) - 1), 0, { state: gunner, random: () => .5 }); gun.e.def = { ...gun.e.def, speed: 0, sight: 0 };
  assert.equal(gun.combat.basic(gun.e), 'gun'); assert.equal(gun.e.hp, 800, 'the shot is on its way'); gun.run(.6); assert.equal(gun.e.hp, 800 - hitDamage(combatStats(gunner).attack, 1, false, .5)); assert.ok(gun.combat.shots.every(s => !s.live));
  const crit = withCreature('wolf', 121.5, 0, { random: () => 0 }); crit.combat.basic(crit.e); assert.equal(crit.e.hp, 100 - hitDamage(10, 1, true, 0));
});

test('skills: whirlwind hits ten times around, dash strikes along the path, ground slam launches; each has a cooldown', () => {
  assert.deepEqual(SKILLS.map(s => [s.id, s.cd, s.key]), [['whirl', 7, '1'], ['dash', 4, '2'], ['slam', 9, '3']]);
  const whirl = withCreature('bear', 122, 0, { random: () => .5 }); whirl.e.def = { ...whirl.e.def, speed: 0, sight: 0 };
  assert.ok(whirl.combat.skill(0)); assert.equal(whirl.combat.skill(0), false, 'on cooldown'); assert.ok(whirl.combat.spinning);
  whirl.run(2.4); assert.equal(whirl.e.hp, 800 - 10 * Math.round(10 * .55)); assert.equal(whirl.effects.filter(([k, r]) => k === 'ring' && r === TUNING.whirl.radius).length, 10);
  assert.ok(whirl.combat.cooldowns[0] > 4 && whirl.combat.cooldowns[0] < 5); whirl.run(5); assert.ok(whirl.combat.skill(0), 'ready again after 7 s');
  const dash = withCreature('bear', 124, 0, { random: () => .5 }); dash.e.def = { ...dash.e.def, speed: 0, sight: 0 };
  assert.ok(dash.combat.skill(1)); assert.ok(dash.combat.locksMovement && dash.combat.invulnerable); dash.run(.3);
  assert.ok(Math.abs(dash.player.x - (120 + TUNING.dash.speed * TUNING.dash.time)) < .01, `dashed 7.2 m (${dash.player.x.toFixed(2)})`); assert.equal(dash.e.hp, 800 - 17, 'struck once on the way'); assert.equal(dash.combat.locksMovement, false);
  const slam = withCreature('wolf', 123, 0, { random: () => .5 }); slam.e.def = { ...slam.e.def, speed: 0, sight: 0 };
  assert.ok(slam.combat.skill(2)); slam.run(.2); assert.ok(slam.combat.airborne > 1, 'leaping'); assert.equal(slam.e.hp, 100); slam.run(.3);
  assert.equal(slam.e.hp, 100 - 23); assert.ok(slam.e.lift > 0 && slam.e.stun > 0, 'launched and stunned'); assert.equal(slam.combat.airborne, 0); slam.run(1.5); assert.equal(slam.e.lift, 0);
  assert.equal(slam.combat.skill(7), false);
});

test('shots follow the weapon: ice stuns, a fireball bursts, a spread fans out; a worn pet shoots what comes near', () => {
  const still = a => { for (const e of a.wilds.list) e.def = { ...e.def, speed: 0, sight: 0 }; return a; };
  const ice = still(withCreature('wolf', 126, 0, { random: () => .5 })); ice.combat.shoot(Math.PI / 2, 1, 9, 'ice'); ice.run(.5);
  assert.equal(ice.e.hp, 90); assert.ok(ice.e.stun > .9, 'frozen for a moment');
  const fire = withCreature('wolf', 126, 0, { random: () => .5 }); const beside = fire.wilds.make({ id: 't:2', type: 'mushroom', x: 127.2, z: .8, region: 'east' }); fire.wilds.list.push(beside); still(fire);
  fire.combat.shoot(Math.PI / 2, 1, 9, 'fireball'); fire.run(.5); assert.equal(fire.e.hp, 100 - 10 - 6, 'the hit and its own burst'); assert.equal(beside.hp, 45 - 6, 'the burst reaches a neighbour');
  const fan = still(withCreature('bear', 124, 0, { random: () => .5 })); const spread = { kind: 'gun', range: 7, cooldown: .75, spread: 5, shot: 'spike' };
  fan.combat.host.weapon = () => spread; assert.equal(fan.combat.basic(fan.e), 'gun'); assert.equal(fan.combat.shots.filter(s => s.live).length, 5); assert.ok(fan.combat.shots.every(s => !s.live || s.kind === 'spike'));
  fan.run(.6); assert.ok(fan.e.hp < 800 && fan.e.hp >= 800 - 5 * Math.round(10 * .45), 'each of the five is weaker');
  const pet = still(withCreature('wolf', 124, 0, { random: () => .5 })); pet.combat.host.pet = () => ({ x: 119, z: 1, dmg: .3, cd: 1.2, shot: 'arrow' });
  pet.run(3); assert.equal(pet.e.hp, 100 - 3 * 3, 'three pet shots in 3 s, each 0.3 x attack');
  pet.e.x = 140; const hp = pet.e.hp; pet.run(2); assert.equal(pet.e.hp, hp, 'nothing in reach: the pet waits');
});

test('knock-back pushes a creature but never into the village; a defeated creature pays once and returns later', () => {
  const edge = withCreature('wolf', SAFE.x1 + 1.2, 0, { player: { x: SAFE.x1 + 3, z: 0, active: true } });
  edge.wilds.hit(edge.e, 5, 0, 0, 3, -1, 0); edge.run(.6); assert.ok(!inSafeZone(edge.e.x, edge.e.z, edge.e.radius - .01), 'the ward holds');
  const open = withCreature('wolf', 150, 0, { player: { x: 160, z: 30, active: false } });
  open.wilds.hit(open.e, 5, 0, 0, 3, 1, 0); open.run(.6); assert.ok(open.e.x > 151.5, `pushed back ${(open.e.x - 150).toFixed(2)} m`);
  const fight = withCreature('mushroom', 121, 0, { random: seeded(9) }); fight.e.def = { ...fight.e.def, speed: 0 };
  assert.equal(fight.wilds.hit(fight.e, 100), 45); assert.equal(fight.e.hp, 0); assert.equal(fight.wilds.hit(fight.e, 100), 0, 'already down');
  assert.deepEqual(fight.events.filter(([k]) => k === 'defeat'), [['defeat', 'mushroom']]); assert.ok(fight.e.respawn >= AI.respawn && fight.e.respawn <= AI.respawn + AI.respawnSpread);
  fight.run(AI.respawn + AI.respawnSpread + 1); assert.equal(fight.e.hp, 0, 'not while the player stands on its home');
  fight.player.x = 121 + AI.respawnClear + 2; fight.run(.1); assert.equal(fight.e.hp, 45); assert.ok(fight.events.some(([k]) => k === 'respawn'));
});

test('trees block creatures and nothing is created while a fight runs', () => {
  const wall = withCreature('wolf', 150, 0, { player: { x: 160, z: 0, active: true }, blocked: x => x > 154 && x < 156 });
  wall.run(3); assert.ok(wall.e.x <= 154 + 1e-6, 'stopped by the trees');
  const a = arena({ player: { x: 160, z: 0, active: true } }); a.wilds.sync(true, 160, 0);
  const shots = a.wilds.shots, pool = a.combat.shots, awake = a.wilds.awake; a.run(5, () => a.combat.basic());
  assert.equal(a.wilds.shots, shots); assert.equal(a.combat.shots, pool); assert.equal(a.wilds.awake, awake, 'the same arrays are reused');
});

// Round 8 (spec 4.4): every creature stays in its own region, so a chase ends at the border ribbon and nothing from a land walks into a home region.
test('a creature stops at its region’s border: at a grid line, at a seam and at the ward; hit from across, it still does not cross', () => {
  // A grid line: the Redrock Canyon ends at x = 192, where the Night Land begins. A canyon wolf chases you up to the line and no farther.
  const line = 192, canyon = withCreature('wolf', line - 12, 10, { player: { x: line - 6, z: 10, active: true } }); assert.equal(canyon.e.region, 'east');
  canyon.run(1); assert.equal(canyon.e.phase !== 'idle', true, 'it is after you');
  canyon.wilds.hit(canyon.e, 30); canyon.player.x = line + 3; assert.equal(regionAt(canyon.player.x, canyon.player.z), 'shadow');
  const before = canyon.blows.length; let most = -Infinity; canyon.run(3, () => { most = Math.max(most, canyon.e.x); assert.equal(regionAt(canyon.e.x, canyon.e.z), 'east'); });
  assert.ok(most < line, 'it never crosses'); assert.equal(canyon.blows.length, before, 'a player across the line is no target'); assert.equal(canyon.e.phase === 'return' || canyon.e.phase === 'idle', true, 'it turns for home');
  canyon.run(10); assert.equal(canyon.e.phase, 'idle'); assert.equal(canyon.e.hp, canyon.e.maxHp, 'and heals on the way');
  // Shot from across the line it does not come, however often: it only heals.
  for (let i = 0; i < 6; i++) { canyon.wilds.hit(canyon.e, 20); canyon.run(1, () => assert.equal(regionAt(canyon.e.x, canyon.e.z), 'east')); }
  assert.equal(canyon.blows.length, before); assert.ok(canyon.e.x < line);
  // A knock-back cannot carry it over either.
  const edge = withCreature('wolf', line - 1.2, 10, { player: { x: line - 3, z: 10, active: false } }); edge.wilds.hit(edge.e, 5, 0, 0, 3, 1, 0); edge.run(.6); assert.equal(regionAt(edge.e.x, edge.e.z), 'east');
  // The other way: a Night Land creature (six times the strength) never walks into the canyon after you.
  const night = withCreature('spider', line + 8, 10, { player: { x: line + 4, z: 10, active: true }, plan: { level: 16, power: 6.2 } }); assert.equal(night.e.region, 'shadow'); assert.equal(night.e.maxHp, 1240);
  night.run(1); night.wilds.hit(night.e, 10); night.player.x = line - 2; let least = Infinity; night.run(4, () => { least = Math.min(least, night.e.x); }); assert.ok(least >= line, `the spider stays in its land (${least.toFixed(2)})`);
  // A seam between two home regions (the canyon and the swamp meet on a line from the ward's corner to the centre cell's): the same.
  assert.equal(regionAt(62, -56), 'east'); assert.equal(regionAt(57, -58), 'north');
  const seam = withCreature('wolf', 63, -50, { player: { x: 62, z: -56, active: true } }); assert.equal(seam.e.region, 'east'); seam.run(1); assert.ok(aggro(seam.e));
  seam.wilds.hit(seam.e, 30); seam.player.x = 56; seam.player.z = -60; assert.equal(regionAt(56, -60), 'north'); const bites = seam.blows.length;
  seam.run(4, () => assert.equal(regionAt(seam.e.x, seam.e.z), 'east', 'it stays on its side of the seam')); assert.equal(seam.blows.length, bites);
  seam.run(10); assert.equal(seam.e.hp, seam.e.maxHp);
  // The ward line is one more border of its region (the test above walks a wolf up to it); a creature made without a region goes anywhere, as before round 8.
  const free = arena({ player: { x: line + 3, z: 10, active: true } }), loose = free.wilds.make({ id: 't:loose', type: 'wolf', x: line - 4, z: 10 }); loose.born = 0; free.wilds.list.push(loose); free.wilds.open = true;
  free.run(3); assert.ok(loose.x > line - 1, 'no region, no border'); assert.ok(free.blows.length > 0);
});

test('the helpers’ line is said once, the first time the box is opened, and the save remembers it', () => {
  const s = freshState(), first = act(s, 'pandora', { open: true }); assert.ok(first.message.startsWith('The lid lifts. Something stirs in the far fields… wild creatures now roam beyond the village.')); assert.ok(first.message.endsWith(HELPERS_LINE));
  assert.equal(HELPERS_LINE, 'Three little helpers slipped out of the box too. The bosses have caged them.'); assert.equal(s.pandoraSeen, true);
  act(s, 'pandora', { open: false }); const again = act(s, 'pandora', { open: true }); assert.equal(again.message, 'The lid lifts. Something stirs in the far fields… wild creatures now roam beyond the village.');
  const saved = parseSave(JSON.parse(JSON.stringify(s))); act(saved, 'pandora', { open: false }); assert.ok(!act(saved, 'pandora', { open: true }).message.includes('helpers'), 'not after a reload either');
  const old = JSON.parse(JSON.stringify(freshState())); delete old.pandoraSeen; old.pandora = true; const loaded = parseSave(old); act(loaded, 'pandora', { open: false }); assert.ok(act(loaded, 'pandora', { open: true }).message.endsWith(HELPERS_LINE), 'an old save hears it the first time it opens the box in this round');
});
