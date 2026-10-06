// The wild creatures of the open fields, alive only while the Pandora box is open, after Zoo Garden's home planet
// (cute_game src/enemy-types.ts, world.ts updateEnemyAi, boss-patterns.ts). Pure (no Three.js, no DOM): the facts, the
// seeded spawn plan and a compact simulation with the reference's phases (idle, chase, wind-up, charge, recover, return),
// leash, level of detail and respawn. wilds-view.mjs draws it; combat.mjs hits it.
//
//   wildCell(cx, cz)            the creatures a 32 m cell holds (seeded by region: regions.mjs, region-mix.mjs; none inside the village ward)
//   const wilds = new Wilds(host, random)
//   host.blocked?(x, z)         a tree or a building stands there
//   host.noGo?(x, z)            a place no creature enters (a lit lamp's disc in the Night Land: pandora-view.mjs asks world.lands)
//   host.pull?(dx, dz)          moves the player (a titan's pull): world.push
//   host.hurt(amount, source, creature)          source: 'melee' | 'shot'
//   host.hurtShare?(share, source, creature)     a share of the player's full health (the dragon's fire rain: 'fire')
//   host.eclipse?(seconds, creature)             the Shadow Lord's eclipse: pandora-view.mjs passes it to world.lands
//   host.now?()                                  wall-clock seconds for the lava weather (the dragon's visits); default Date.now() / 1000
//   host.emit?(kind, creature)   'spawn' 'alert' 'windup' 'strike' 'shot' 'defeat' 'respawn' 'leave' 'retire', and for bosses
//                                'callout' (a skill's wind-up starts) 'cast' 'pulse' 'enrage' 'calm' 'resist' 'stage' 'arrive' 'depart'
//   wilds.sync(open, x, z)      loads the cells around the player (or lets every creature leave when the box is shut)
//   wilds.step(dt, player)      player: {x, z, active} (active false: indoors, driving, knocked out)
//   wilds.hit(creature, amount, stun, lift, knock, dirX, dirZ) -> damage dealt
import { FIELD_TILE, fieldTrees } from './field-layout.mjs';
import { WARD_MARGIN, SAFE, WARD_OUTLINE, inSafeZone, wildDepth } from './ward.mjs';
import { REGION, DENS, regionAt, inWorld, borderDistance, gridBorderDistance, levelAt, powerAt, outpostNear } from './regions.mjs';
import { MIX, DENSITY, POWER, RANK, TWIN_BLOCKS, TWIN_GAP } from './region-mix.mjs';
import { FEATURES, landClear, waterAt } from './land-features.mjs';
import { lavaEvent } from './lava-weather.mjs';
import { BOSS_WINDUPS, SKILL, FIRE_RAIN, bossSkill, bossTelegraphs, bossPhase, hitControl, bossCooldownScale, SLOW, RESIST_EVERY } from './boss-patterns.mjs';
import { creature } from './creature-def.mjs';
import { TITAN_ROWS } from './titans.mjs';
// A titan's whole turn (builder D2) is titan-patterns.mjs titanTurn, fetched with import() so that it is not read before the first
// frame (the bundle limit, spec 17.3). main.mjs asks for it at boot, beside titans-view.mjs; a titan stands still until it has
// arrived (titans live only behind the open box, so in play that is never seen). Node tests await loadTitanTurn() first.
let titanTurn = null, titanCode = null;
export const loadTitanTurn = () => titanCode ??= import('./titan-patterns.mjs').then(m => { titanTurn = m.titanTurn; }).catch(error => { titanCode = null; throw error; });
// Hot loops use plain indexed loops and this instead of for-of and Math.hypot: neither makes garbage in any JIT tier.
const len = (x, z) => Math.sqrt(x * x + z * z);

/**
 * The reference's facts (hp, damage, speed m/s, reach, sight, radius, cooldown and wind-up in seconds, drawn scale; the
 * row builder is creature-def.mjs). Coins replace its XP at half the number. `level` is the kind's own label; the level a
 * creature shows comes from its spawn plan (the region's: difficulty × 3 − 2, +6 for a boss).
 */
export const CREATURES = {
  mushroom: creature('Grumpy Mushroom', 45, 6, 2.4, 4, 'hopper', '#ff4d5e', { radius: .55, reach: 1.3, sight: 8, scale: .49 }),
  bee: creature('Cross Wasp', 55, 8, 3.8, 6, 'melee', '#ffd23f', { radius: .5, reach: 1.4, flying: true, cooldown: 1.1, windup: .3, scale: .73 }),
  boar: creature('Wild Boar', 85, 10, 3, 7, 'charger', '#a9744f', { radius: .8, reach: 1.5, cooldown: 2.6, windup: .7, scale: .91 }),
  frog: creature('Poison Frog', 70, 10, 2.8, 8, 'hopper', '#6fd35a', { radius: .6, accent: '#b27dff', cooldown: 1.3, scale: .73, level: 4 }),
  wolf: creature('Grey Wolf', 100, 12, 4.3, 11, 'melee', '#8f9bb3', { sight: 12, cooldown: 1.3, windup: .35, scale: .99, level: 4 }),
  chomper: creature('Snapping Flower', 120, 14, 0, 10, 'rooted', '#58c24a', { radius: .8, reach: 2.5, sight: 7, accent: '#ff4f7a', cooldown: 1.7, windup: .55, scale: .67, level: 4, telegraph: 1.4 }),
  cactus: creature('Prickly Cactus', 140, 15, 0, 15, 'shooter', '#4cb86b', { radius: .75, reach: 11, sight: 11, cooldown: 2.1, windup: .6, scale: .67, level: 7 }),
  crab: creature('Stone Crab', 130, 14, 2.6, 13, 'melee', '#ff6a4d', { radius: .8, windup: .5, scale: .99, level: 7 }),
  bear: creature('King Bear', 800, 26, 2.5, 150, 'boss', '#8b5a3c', { reach: 2.6, sight: 13, radius: 1.4, cooldown: 2.2, windup: .6, scale: 1.85, level: 13, boss: true }),
  // Round 8: the forest hawk, the three other home bosses, and every kind of the eight lands with their bosses and the lava dragon.
  // Each row is Zoo Garden's merged entry (enemy-types.ts ENEMY_TYPES after combatRules), its drawn size from ENEMY_SCALE (1.85 for a
  // boss), coins at half its XP, and its `family`, the shape wilds-view.mjs draws when the kind has no model of its own.
  forest_raptor: creature('Great Forest Hawk', 160, 14, 4.2, 18, 'charger', '#96714c', { family: 'winged', accent: '#e8d2a6', reach: .95, sight: 13, radius: .4, cooldown: 2.8, windup: .75, scale: .725, level: 1, flying: true }),
  treant: creature('Ancient Treant', 700, 22, 2.2, 120, 'boss', '#8a5a3b', { family: 'treant', accent: '#4fbf5a', reach: 2.6, sight: 12, radius: 1.4, cooldown: 2.3, windup: .6, scale: 1.85, level: 7, boss: true }),
  croc: creature('Crocodile King', 850, 25, 2.6, 140, 'boss', '#4f9e5a', { family: 'quadruped', reach: 2.7, sight: 12, radius: 1.4, cooldown: 2.1, windup: .6, scale: 1.85, level: 10, boss: true }),
  mushking: creature('Mushroom King', 950, 24, 2.4, 160, 'boss', '#e95685', { family: 'mushroom', reach: 2.7, sight: 13, radius: 1.5, cooldown: 2.2, windup: .6, scale: 1.85, level: 7, boss: true }),
  jelly: creature('Jelly Jumper', 60, 8, 2.6, 6, 'hopper', '#ff6fae', { family: 'blob', reach: 1.3, sight: 9, radius: .6, cooldown: 1.4, windup: .4, scale: .73, level: 7 }),
  gummy: creature('Gummy Hound', 95, 11, 4, 10, 'melee', '#8ff0d0', { family: 'quadruped', sight: 11, cooldown: 1.3, windup: .35, scale: .91, level: 7 }),
  lollipop: creature('Sugar Shooter', 110, 13, 0, 13, 'shooter', '#ff8fcf', { family: 'lollipop', reach: 11, sight: 11, cooldown: 2, windup: .55, scale: .61, level: 7 }),
  bunny: creature('Marshmallow Bunny', 65, 9, 3.2, 7, 'hopper', '#fff0f6', { family: 'bunny', reach: 1.3, radius: .55, cooldown: 1.2, windup: .35, scale: .51, level: 7 }),
  chocobeetle: creature('Chocolate Beetle', 120, 13, 3.2, 12, 'charger', '#6a3a24', { family: 'crab', reach: 1.5, radius: .75, cooldown: 2.4, windup: .6, scale: .99, level: 7 }),
  cake: creature('Cake King', 900, 24, 2.4, 190, 'boss', '#fff5fb', { family: 'cake', accent: '#ff3355', reach: 2.6, sight: 13, radius: 1.4, cooldown: 2.2, windup: .6, scale: 1.85, level: 13, boss: true }),
  gingerbread: creature('Gingerbread Giant', 850, 24, 2.6, 180, 'boss', '#c9783a', { family: 'biped', reach: 2.6, sight: 13, radius: 1.4, cooldown: 2.1, windup: .6, scale: 1.85, level: 13, boss: true }),
  jellyqueen: creature('Jelly Queen', 1000, 25, 2.8, 200, 'boss', '#e75cad', { family: 'blob', reach: 2.6, sight: 13, radius: 1.5, cooldown: 2.1, windup: .6, scale: 1.85, level: 13, boss: true }),
  snowball: creature('Rolling Snowball', 70, 9, 2.8, 8, 'hopper', '#f6fbff', { family: 'blob', reach: 1.3, sight: 9, radius: .6, cooldown: 1.4, windup: .4, scale: .73, level: 10 }),
  penguin: creature('Penguin Warrior', 110, 13, 3.6, 12, 'melee', '#34405a', { family: 'penguin', accent: '#f6fbff', sight: 11, radius: .65, cooldown: 1.2, windup: .35, scale: .85, level: 10 }),
  icebloom: creature('Ice Blossom', 130, 15, 0, 13, 'rooted', '#9fe8ff', { family: 'flower', accent: '#ffffff', reach: 2.5, sight: 7, radius: .8, cooldown: 1.6, windup: .5, scale: .67, level: 10 }),
  seal: creature('Ice Seal', 120, 13, 3, 12, 'charger', '#9fb4cc', { family: 'quadruped', reach: 1.5, radius: .75, cooldown: 2.4, windup: .6, scale: .99, level: 10 }),
  owl: creature('Snow Owl', 80, 11, 3.6, 10, 'melee', '#f4f7fb', { family: 'winged', reach: 1.4, sight: 12, radius: .55, cooldown: 1.1, windup: .3, scale: .73, level: 10, flying: true }),
  yeti: creature('Snow Yeti', 1000, 28, 2.6, 240, 'boss', '#eef4ff', { family: 'bear', accent: '#a8c8ff', reach: 2.6, sight: 13, radius: 1.4, cooldown: 2.1, windup: .6, scale: 1.85, level: 16, boss: true }),
  mammoth: creature('Ice Mammoth', 1100, 30, 2.4, 250, 'boss', '#8a5a3b', { family: 'quadruped', reach: 3, sight: 13, radius: 1.8, cooldown: 2.3, windup: .6, scale: 1.85, level: 16, boss: true }),
  frostowl: creature('Frost Owl', 1150, 28, 3.2, 260, 'boss', '#cee8ff', { family: 'winged', reach: 2.6, sight: 15, radius: 1.4, cooldown: 2, windup: .6, scale: 1.85, level: 16, boss: true, flying: true }),
  magmaslime: creature('Magma Slime', 80, 11, 2.7, 10, 'hopper', '#ff6a2b', { family: 'blob', accent: '#ffc23d', reach: 1.3, sight: 9, radius: .6, cooldown: 1.3, windup: .4, scale: .85, level: 13 }),
  minislime: creature('Tiny Magma Slime', 24, 5, 3.3, 3, 'hopper', '#ff984a', { family: 'blob', reach: 1.1, sight: 11, radius: .38, cooldown: 1.1, windup: .3, scale: .67, level: 13 }),
  firelizard: creature('Fire Lizard', 120, 14, 3.4, 14, 'charger', '#ff7a45', { family: 'quadruped', reach: 1.5, sight: 11, radius: .8, cooldown: 2.4, windup: .6, scale: .99, level: 13 }),
  volcano: creature('Little Volcano', 150, 17, 0, 17, 'shooter', '#4a3f4f', { family: 'volcano', accent: '#ff6a2b', reach: 11, sight: 11, radius: .75, cooldown: 2, windup: .6, scale: .89, level: 13 }),
  firebat: creature('Fire Bat', 70, 11, 4.6, 10, 'charger', '#5a3a78', { family: 'winged', accent: '#ff6a2b', reach: 1.4, sight: 13, radius: .55, cooldown: 2.2, windup: .55, scale: .73, level: 13, flying: true }),
  magmacrab: creature('Magma Crab', 160, 17, 2.6, 16, 'melee', '#4a3f4f', { family: 'crab', accent: '#ff6a2b', sight: 9, radius: .8, windup: .5, scale: .99, level: 13 }),
  magmaturtle: creature('Magma Turtle', 260, 20, 1.6, 23, 'charger', '#4a3f4f', { family: 'turtle', accent: '#ff6a2b', reach: 1.9, sight: 9, radius: 1, cooldown: 2.8, windup: .8, scale: .99, level: 13 }),
  lavaworm: creature('Lava Worm', 190, 22, 5.5, 22, 'charger', '#b0402a', { family: 'worm', reach: 1.9, sight: 14, cooldown: 3.2, windup: 1.2, scale: .87, level: 13 }),
  golem: creature('Magma Golem', 1200, 32, 2.3, 300, 'boss', '#5a4a58', { family: 'biped', accent: '#ff6a2b', reach: 2.7, sight: 13, radius: 1.5, cooldown: 2.2, windup: .6, scale: 1.85, level: 19, boss: true }),
  dragon: creature('Volcano Dragon', 2600, 36, 3, 700, 'boss', '#e0443a', { family: 'dragon', accent: '#ffd27a', reach: 3, sight: 18, radius: 1.6, cooldown: 2, windup: .6, scale: 1.85, level: 19, boss: true, flying: true }),
  toysoldier: creature('Tin Soldier', 70, 9, 0, 8, 'shooter', '#ed6a7e', { family: 'biped', reach: 11, sight: 11, radius: .6, cooldown: 1.9, windup: .5, scale: .78, level: 4 }),
  windmouse: creature('Clockwork Mouse', 80, 11, 3.6, 9, 'charger', '#90b8f0', { family: 'quadruped', reach: 1.5, sight: 11, radius: .6, cooldown: 2.2, windup: .6, scale: .84, level: 4 }),
  jackbox: creature('Jack-in-the-Box', 90, 12, 2.8, 9, 'hopper', '#c19bff', { family: 'jackbox', reach: 1.4, sight: 9, radius: .6, cooldown: 1.3, windup: .4, scale: .72, level: 4 }),
  robot: creature('Giant Toy Robot', 900, 22, 2.4, 165, 'boss', '#81bfe6', { family: 'robot', reach: 2.7, sight: 13, radius: 1.5, cooldown: 2.1, windup: .6, scale: 1.85, level: 10, boss: true }),
  monkey: creature('Jungle Monkey', 110, 13, 0, 12, 'shooter', '#bb8c5e', { family: 'biped', reach: 11, sight: 12, radius: .6, cooldown: 1.8, windup: .5, scale: .85, level: 7 }),
  snake: creature('Emerald Snake', 100, 14, 4.2, 12, 'charger', '#78c854', { family: 'worm', reach: 1.5, sight: 11, radius: .55, cooldown: 2, scale: .74, level: 7 }),
  chameleon: creature('Hidden Chameleon', 130, 15, 3.4, 15, 'melee', '#67a978', { family: 'quadruped', cooldown: 1.4, windup: .4, scale: .91, level: 7, stealth: 5 }),
  flytrap: creature('Giant Flytrap', 150, 17, 0, 15, 'rooted', '#48b43b', { family: 'flower', accent: '#ee6998', reach: 2.6, sight: 7, radius: .8, cooldown: 1.6, windup: .5, scale: .67, level: 7 }),
  gorilla: creature('Jungle Gorilla', 1000, 27, 2.8, 225, 'boss', '#534c60', { family: 'bear', reach: 2.8, sight: 14, radius: 1.6, cooldown: 2.1, windup: .6, scale: 1.85, level: 13, boss: true }),
  jellyzap: creature('Electric Jellyfish', 110, 14, 3.2, 14, 'charger', '#8bcfea', { family: 'blob', reach: 1.4, sight: 11, radius: .55, cooldown: 2.2, windup: .5, scale: .78, level: 10, where: 'sea' }),
  hammershark: creature('Hammerhead Shark', 170, 19, 4.4, 18, 'charger', '#6d9db4', { family: 'quadruped', reach: 1.8, sight: 12, radius: .9, cooldown: 2.3, windup: .6, scale: .99, level: 10, where: 'sea' }),
  urchin: creature('Coral Urchin', 160, 17, 0, 17, 'shooter', '#b47db8', { family: 'cactus', reach: 10, cooldown: 1.9, windup: .5, scale: .67, level: 10 }),
  leviathan: creature('Ocean Leviathan', 1150, 30, 2.8, 280, 'boss', '#557ebe', { family: 'dragon', reach: 3, sight: 15, radius: 1.8, cooldown: 2, windup: .6, scale: 1.85, level: 16, boss: true }),
  cloudsheep: creature('Cloud Sheep', 140, 16, 3, 17, 'hopper', '#f3f4ff', { family: 'quadruped', reach: 1.4, radius: .65, cooldown: 1.3, windup: .4, scale: .99, level: 13 }),
  thunderbird: creature('Thunderbird', 120, 18, 4.8, 18, 'charger', '#e6c955', { family: 'winged', reach: 1.4, sight: 14, radius: .6, cooldown: 2, windup: .5, scale: .85, level: 13, flying: true }),
  windspirit: creature('Wind Spirit', 170, 19, 0, 20, 'shooter', '#bdebee', { family: 'blob', reach: 12, sight: 12, cooldown: 1.7, windup: .5, scale: .78, level: 13, flying: true }),
  phoenix: creature('Thunder Phoenix', 1200, 32, 3.4, 310, 'boss', '#efa864', { family: 'winged', reach: 2.8, sight: 16, radius: 1.5, cooldown: 2, windup: .6, scale: 1.85, level: 19, boss: true, flying: true }),
  wisp: creature('Night Wisp', 130, 18, 3.8, 20, 'charger', '#75c9ed', { family: 'blob', reach: 1.4, sight: 16, radius: .55, cooldown: 2, windup: .5, scale: .73, level: 16, stealth: 6 }),
  spider: creature('Shadow Spider', 200, 22, 3.9, 23, 'melee', '#664e8c', { family: 'crab', reach: 1.7, sight: 13, radius: .9, cooldown: 1.3, windup: .4, scale: .99, level: 16, stealth: 7 }),
  demoneye: creature('Watchful Eye', 190, 21, 0, 23, 'shooter', '#df739f', { family: 'eye', reach: 12, sight: 14, radius: .8, cooldown: 1.8, windup: .5, scale: .84, level: 16 }),
  shadowlord: creature('Shadow Lord', 1350, 34, 2.8, 400, 'boss', '#58476f', { family: 'biped', accent: '#be91e6', reach: 2.9, sight: 16, radius: 1.6, cooldown: 2, windup: .6, scale: 1.85, level: 22, boss: true }),
};
/**
 * What a few kinds do that their row's numbers do not say (Zoo Garden's world.ts, by type there):
 *   circles    it circles its target while its charge cools down (firebat, thunderbird, jellyzap, wisp)
 *   burst      its wind-up ends in a blast round itself instead of a run: {r, hit, recover, from} (magma turtle, lava worm)
 *   shell      it takes 12 % of a blow, and double while it recovers from its own blast (magma turtle)
 *   splits     the kind that three of spring from it when it falls (magma slime)
 *   telegraph  a danger disc on the ground during its wind-up, and where: 'front' (the default), 'self' or 'target'
 *   worldBoss  an event boss: three stages by thirds of health, no boss health factor (the dragon)
 *   shot       the look of what it shoots (the robot's bolts are 'volt')
 */
const TRAITS = {
  firebat: { circles: true, telegraph: 1.2, telegraphAt: 'target' }, thunderbird: { circles: true }, jellyzap: { circles: true }, wisp: { circles: true },
  magmaturtle: { burst: { r: 2.6, hit: 1.1, recover: 3, from: 1.9 }, shell: true, telegraph: 2.6, telegraphAt: 'self' },
  lavaworm: { burst: { r: 2, hit: 1.3, recover: 3.2, from: 1.2 }, telegraph: 2, telegraphAt: 'self' },
  magmaslime: { splits: 'minislime' },
  dragon: { worldBoss: true }, robot: { shot: 'volt' },
};
for (const type in TRAITS) Object.assign(CREATURES[type], TRAITS[type]);
// The nine titans' rows (titans.mjs, builder D2). Empty until that merge, so this line is inert in step 0.
Object.assign(CREATURES, TITAN_ROWS);

// ---------------------------------------------------------------- where they live
// The village ward (the shape lives in ward.mjs; re-exported here for the files that import it from wilds.mjs).
export { WARD_MARGIN, SAFE, WARD_OUTLINE, inSafeZone, wildDepth };
/**
 * The King Bear's den: an alias of his row in regions.mjs DENS (x, z, type, clear), kept so that existing imports load.
 * Round 8 moved him from the far north-east to the Redrock Canyon, 95.5 m beyond the ward; his creature's id is 'w:den:bear'.
 */
export const DEN = DENS.find(d => d.type === 'bear');
/** Clearances of the spawn plan (spec section 2): the lane along a full ribbon, the ward and the seams, a diagonal land's corner, a neighbour. */
export const SPAWN = Object.freeze({ gridLane: 6, line: 2, apart: 4, trunk: .5 });
/** The east gate's road (field-layout.mjs GATE_ROAD: x 52 to 67, z within 4) lies on the border between the canyon and the meadow: no creature slot or step is valid there. */
const onGate = (x, z) => x > 52 && x < 67 && z > -4 && z < 4;
export const WILD_CELL = 32, WILD_RADIUS = 2, SLOTS = 4;
const cellRandom = (cx, cz) => { let seed = (Math.imul(cx, 0x2c1b3c6d) ^ Math.imul(cz, 0x297a2d39) ^ 0x9a4d0c5) >>> 0; return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; };
const treeCache = new Map();
/** The blocking pieces of one 64 m tile (field-layout.mjs fieldTrees), cached: creatures do not spawn inside a collider. */
function tileTrees(tx, tz) {
  const key = tx + ',' + tz; let trees = treeCache.get(key);
  if (!trees) { if (treeCache.size > 200) treeCache.clear(); trees = fieldTrees(tx, tz); treeCache.set(key, trees); }
  return trees;
}
/**
 * What the spawn plan reads of the land: the blocking pieces of a tile, where a kind may stand, and where the sea is. The
 * defaults are the game's own (field-layout.mjs, land-features.mjs); a test hands in its own to prove a rule before the
 * scenery or the sea it needs exists.
 */
export const SPAWN_ENV = Object.freeze({ trees: tileTrees, landClear, waterAt });
/** True when a blocking piece within `reach` metres of (x, z) fails `test(piece, distance)`; it looks in every tile the reach touches. */
function pieceNear(env, x, z, reach, test) {
  const x0 = Math.floor((x - reach) / FIELD_TILE), x1 = Math.floor((x + reach) / FIELD_TILE), z0 = Math.floor((z - reach) / FIELD_TILE), z1 = Math.floor((z + reach) / FIELD_TILE);
  for (let tx = x0; tx <= x1; tx++) for (let tz = z0; tz <= z1; tz++) { const list = env.trees(tx, tz); for (let i = 0; i < list.length; i++) { const t = list[i]; if (test(t, len(t.x - x, t.z - z))) return true; } }
  return false;
}
/** A piece's kind without its tint ('rock@shadow' is a rock). */
const plainKind = kind => { const at = kind ? kind.indexOf('@') : -1; return at < 0 ? kind : kind.slice(0, at); };
/** A creature of this kind would stand among its doubles here: a blocking lookalike (a snowman for a snowball) within TWIN_GAP metres. */
const amongTwins = (env, type, x, z) => !!TWIN_BLOCKS[type] && pieceNear(env, x, z, TWIN_GAP, (t, d) => d < TWIN_GAP && TWIN_BLOCKS[type].includes(plainKind(t.kind)));
/** A region's mix as two lists, the kinds of the land and the kinds of the sea (a row's `where`), each with its total weight. */
const mixCache = new Map();
function mixOf(region) {
  let m = mixCache.get(region); if (m) return m;
  const split = sea => { const list = (MIX[region] ?? []).filter(([type]) => CREATURES[type] && (CREATURES[type].where === 'sea') === sea); return { list, total: list.reduce((n, [, w]) => n + w, 0) }; };
  mixCache.set(region, m = { land: split(false), sea: split(true) }); return m;
}
/** Largest collider a blocking piece may have (spec 3.5: 1.3 × 1.4) plus the largest common's radius and the trunk gap: how far the collider test looks. */
const COLLIDER_REACH = 1.82 + 1 + .5;
/**
 * The creatures of one cell: [{id, type, x, z, region, level, power, titan, leash, event}]. Seeded, so a place always holds
 * the same creatures. A den's creature comes first (only once its type has a row in CREATURES); the commons come from the
 * region's mix and density (region-mix.mjs). No creature where regionAt is null (outside the world) or in the village.
 */
export function wildCell(cx, cz, env = SPAWN_ENV) {
  const random = cellRandom(cx, cz), out = [];
  for (let i = 0; i < DENS.length; i++) {
    const d = DENS[i]; if (cx !== Math.floor(d.x / WILD_CELL) || cz !== Math.floor(d.z / WILD_CELL) || !CREATURES[d.type]) continue;
    out.push({ id: d.id, type: d.type, x: d.x, z: d.z, region: d.region, level: d.level, power: d.titan || d.event ? (REGION[d.region].kind === 'land' ? POWER[REGION[d.region].difficulty] : 1) : powerAt(d.x, d.z), titan: d.titan, leash: d.leash, event: d.event });
  }
  slots: for (let i = 0; i < SLOTS; i++) {
    // Every slot draws its four numbers whether it is used or not, so one slot never shifts the next.
    const x = (cx + random()) * WILD_CELL, z = (cz + random()) * WILD_CELL, pick = random(), keep = random(), region = regionAt(x, z);
    if (!region || region === 'village') continue;
    const info = REGION[region];
    if (!MIX[region]?.length || keep >= DENSITY[region] / SLOTS) continue;
    // Clear of the ward and the seams, of the lane along every full ribbon, and of the gate's road.
    if (inSafeZone(x, z, SPAWN.line) || outpostNear(x, z) || borderDistance(x, z) < SPAWN.line || gridBorderDistance(x, z) < SPAWN.gridLane || onGate(x, z)) continue;
    // Every den's clearing applies whether or not its creature exists yet, so the commons are the same before and after it arrives.
    for (let k = 0; k < DENS.length; k++) if (len(x - DENS[k].x, z - DENS[k].z) < DENS[k].clear) continue slots;
    if (out.some(o => len(o.x - x, o.z - z) < SPAWN.apart)) continue;
    // The slot's place picks the list: the sea's kinds in the sea (the Beach's jellyfish and sharks), the land's everywhere else.
    const mix = env.waterAt(x, z) ? mixOf(region).sea : mixOf(region).land; if (!mix.list.length) continue;
    let roll = pick * mix.total, at = 0;
    for (let k = 0; k < mix.list.length; k++) { if (roll < mix.list[k][1]) { at = k; break; } roll -= mix.list[k][1]; }
    let type = mix.list[at][0];
    // A blocking lookalike was placed first and may not move, so the creature yields: the slot takes the next kind of the mix,
    // and is dropped if that one would stand among its doubles too.
    if (amongTwins(env, type, x, z)) { type = mix.list[(at + 1) % mix.list.length][0]; if (amongTwins(env, type, x, z)) continue; }
    const def = CREATURES[type];
    if (!env.landClear(x, z, def.radius, def.where ?? 'land')) continue;
    // A Night Land lamp's light repels the shadow creatures (land-effects.mjs lampAt, Wilds host.noGo): none is seeded inside it, so
    // none stands stuck in a lit lamp's disc and none is beside the pillar to take the E that lights it.
    if (region === 'shadow' && FEATURES.shadow.lamps.some(l => len(l.x - x, l.z - z) < l.r + def.radius)) continue;
    if (pieceNear(env, x, z, COLLIDER_REACH, (t, d) => d < t.r + def.radius + SPAWN.trunk)) continue;
    out.push({ id: `w:${cx},${cz}:${i}`, type, x, z, region, level: info.kind === 'land' ? levelAt(x, z) : info.level, power: powerAt(x, z), titan: false, leash: AI.leashHome, event: null });
  }
  return out;
}

// ---------------------------------------------------------------- the simulation
/** The reference's numbers (boss-patterns.ts LEASH, KNOCK_IMPULSE, world.ts updateEnemyAi). */
export const AI = {
  leashHome: 30, leashSight: 1.6, hitGrace: 4, returnSight: 20, returnHeal: .3, wander: 2, wanderSpeed: .6,
  restRange: 48, chargeFrom: 8, chargeSpeed: 13, chargeTime: .75, chargeHit: 1.3, slamRadius: SKILL.slam.radius,
  circleFrom: 8, circleAt: 5, circlePull: .4, circleSpeed: .8,
  recover: .45, bossRecover: .7, shotSpeed: 13, shotLife: 1.4, shotHit: .65, respawn: 22, respawnSpread: 10, bossRespawn: 90, titanRespawn: 600, respawnClear: 22,
  shots: 32, minis: 18, miniRing: .9,
  knock: 6, bossKnock: .15, bossLift: .0625, hardStun: .5, launchStun: .75, gravity: 24, playerRadius: .4, born: .35, leave: .35, dying: .3,
};
export const STEP = .025, MAX_STEPS = 4;
/** A creature that moved farther than this in one step was put there (respawn), not walked: it is drawn there at once. */
export const GLIDE_MAX = 1.5;
/**
 * Where a creature is drawn at `now` (the simulation's clock plus what the frame has gathered towards the next step):
 * between the place it left on its last move and where the simulation has it, over the time that move covers.
 * Returns the share 0..1 of the way (1: on its simulated place).
 */
export const glideShare = (e, now) => e.moveSpan > 0 ? Math.min(1, Math.max(0, (now - e.moveAt) / e.moveSpan)) : 1;
const slotOf = id => { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0; return h % 4; };
/** Wind-up progress 0–1: exactly 1 on the step the blow lands (telegraphs fill with it). */
export const windupProgress = e => e.phase !== 'windup' || !(e.windupTotal > 0) ? 0 : Math.min(1, Math.max(0, 1 - e.phaseTime / e.windupTotal));
/** A creature that chases, winds up or attacks (walking home or idling is calm). */
export const aggro = e => e.hp > 0 && e.phase !== 'idle' && e.phase !== 'return';

export class Wilds {
  constructor(host = {}, random = Math.random) {
    this.host = host; this.random = random; this.list = []; this.cells = new Map(); this.dead = new Map(); this.time = 0; this.tick = 0; this.cx = this.cz = NaN; this.open = false;
    // A barrage is 20 shots at once (boss-patterns.mjs SKILL.barrage), so the pool holds 32: none is ever dropped.
    this.shots = Array.from({ length: AI.shots }, () => ({ live: false, x: 0, z: 0, vx: 0, vz: 0, life: 0, damage: 0, owner: null, kind: '' }));
    this.awake = []; this.removed = false; this.tickEvent = null; this.aim = null; this.player = null; this.slain = new Map(); this.serial = 0;
  }
  make(plan) {
    const def = CREATURES[plan.type], until = this.dead.get(plan.id) ?? 0, power = plan.power ?? 1, titan = plan.titan ?? !!def.titan, event = plan.event ?? null;
    // Level and power belong to the instance (a wolf is Lv 4 in the swamp and Lv 7 in the canyon); a plan without them behaves as
    // before. Health and damage are the kind's × power; a land's boss takes × 2.6 and × 1.35 more, a titan × 7 and × 1.6 anywhere
    // (the home titan at power 1), the dragon the damage factor only (region-mix.mjs RANK, Zoo Garden's world.ts:824).
    const rank = titan ? RANK.titan : def.boss && REGION[plan.region]?.kind === 'land' ? RANK.boss : null;
    const maxHp = Math.round(def.hp * power * (rank && !def.worldBoss ? rank.hp : 1)), damage = def.damage * power * (rank ? rank.damage : 1);
    // An event boss (the dragon) is here only while its lava event runs, and once beaten stays away for the rest of that event.
    const now = event ? this.eventNow() : null, down = event ? now.id !== event || this.slain.get(plan.id) === now.index : until > this.time;
    if (!down) this.dead.delete(plan.id);
    // titanLift, attack and forced are for the titans (titanStep); `hard` keeps a titan and the dragon within `leash` metres of the den, hit or not.
    return { id: plan.id, type: plan.type, def, region: plan.region ?? null, level: plan.level ?? def.level, power, titan, leash: plan.leash ?? AI.leashHome, event, titanLift: 0, attack: null, forced: '',
      hard: titan || !!event, eventLive: !!now && now.id === event, temp: false, baseDamage: damage,
      skill: '', skillCount: 0, marks: [], pulses: [], spinTick: 0, enraged: false, stage: 1, slow: 0, resistAt: -9, callout: '',
      x: plan.x, z: plan.z, homeX: plan.x, homeZ: plan.z, hp: down ? 0 : maxHp, maxHp, damage, radius: def.radius, facing: (plan.x * 12.9898 + plan.z * 78.233) % 6.283,
      phase: 'idle', phaseTime: 0, windupTotal: 0, cooldown: 0, stun: 0, lift: 0, liftV: 0, kx: 0, kz: 0, targetX: plan.x, targetZ: plan.z, respawn: !down ? 0 : event ? Infinity : until - this.time, lastHit: -99,
      attacks: 0, slam: false, charged: false, flash: 0, dying: 0, born: down ? 0 : AI.born, leaving: 0, resting: false, wait: 0, slot: slotOf(plan.id),
      px: plan.x, pz: plan.z, sx: plan.x, sz: plan.z, moveAt: 0, moveSpan: 0, thought: 0 }; // the place it left on its last move and the time that move covers (drawn gliding, see step)
  }
  /** The lava weather's event now: {id, index} (lava-weather.mjs; wall-clock seconds, so a reload does not move it). */
  eventNow() { return lavaEvent(this.host.now?.() ?? Date.now() / 1000); }
  /**
   * Loads the cells around (x, z), 5 × 5 unless `radius` asks for more (a camera zoomed far out sees past two cells), and
   * retires the others. Shut: every creature leaves (a short shrink) and nothing loads.
   */
  sync(open, x, z, radius = WILD_RADIUS) {
    if (!open) {
      if (this.open || this.cells.size) { for (const e of this.list) if (!e.leaving) { e.leaving = AI.leave; this.host.emit?.('leave', e); } this.cells.clear(); this.dead.clear(); this.slain.clear(); this.cx = this.cz = NaN; this.radius = 0; for (const s of this.shots) s.live = false; }
      this.open = false; return;
    }
    this.open = true;
    const cx = Math.floor(x / WILD_CELL), cz = Math.floor(z / WILD_CELL);
    if (cx === this.cx && cz === this.cz && radius === this.radius) return; // same cell and window as last frame: nothing to do, nothing made
    this.cx = cx; this.cz = cz; this.radius = radius;
    for (const [id, cell] of this.cells) {
      const [ix, iz] = cell.at;
      if (Math.abs(ix - cx) <= radius && Math.abs(iz - cz) <= radius) continue;
      for (const e of cell.list) { if (e.hp <= 0 && e.respawn > 0 && !e.event) this.dead.set(e.id, this.time + e.respawn); e.gone = true; this.host.emit?.('retire', e); }
      this.cells.delete(id);
    }
    // The tiny slimes of a split belong to no cell: they go when the window leaves them behind.
    for (const e of this.list) if (e.temp && !e.gone && (Math.abs(Math.floor(e.x / WILD_CELL) - cx) > radius || Math.abs(Math.floor(e.z / WILD_CELL) - cz) > radius)) { e.gone = true; this.host.emit?.('retire', e); }
    for (let ix = cx - radius; ix <= cx + radius; ix++) for (let iz = cz - radius; iz <= cz + radius; iz++) {
      const id = ix + ',' + iz; if (this.cells.has(id)) continue;
      const list = wildCell(ix, iz).map(plan => this.make(plan)); this.cells.set(id, { at: [ix, iz], list });
      for (const e of list) this.host.emit?.('spawn', e);
    }
    this.list = this.list.filter(e => !e.gone); for (const cell of this.cells.values()) for (const e of cell.list) if (!this.list.includes(e)) this.list.push(e);
    if (this.dead.size > 400) for (const [id, until] of this.dead) if (until <= this.time) this.dead.delete(id);
  }
  /**
   * Where a creature may stand: never in the ward, never in a trunk or a lit lamp's light, and never outside its own region
   * (a chase ends at the border ribbon: nothing from a land walks into a home region). A titan and the dragon also stay
   * within their leash of the den, hit or not. A creature made without a region (a test's) goes anywhere.
   */
  walkable(e, x, z) {
    if (inSafeZone(x, z, e.radius) || e.region && (regionAt(x, z) !== e.region || !inWorld(x, z, e.radius) || onGate(x, z))) return false;
    if (e.hard) { const d = len(x - e.homeX, z - e.homeZ); if (d > e.leash && d > len(e.x - e.homeX, e.z - e.homeZ)) return false; }
    return !this.host.blocked?.(x, z) && !this.host.noGo?.(x, z) && !outpostNear(x, z);
  }
  /** Moves by (dx, dz), sliding along what blocks it. The ward and trees stop it. */
  move(e, dx, dz) {
    const x = e.x + dx, z = e.z + dz;
    if (this.walkable(e, x, z)) { e.x = x; e.z = z; return; }
    if (dx && this.walkable(e, x, e.z)) e.x = x; else if (dz && this.walkable(e, e.x, z)) e.z = z;
  }
  /** A blow from the player. Returns the damage dealt. */
  hit(e, amount, stun = 0, lift = 0, knock = 0, dirX = 0, dirZ = 0) {
    if (!(e.hp > 0) || e.leaving > 0 || !(amount > 0)) return 0;
    if (e.def.shell) amount *= e.phase === 'recover' ? 2 : .12; // the magma turtle's shell: soft only while it recovers from its own blast
    const dealt = Math.min(e.hp, amount), boss = e.def.boss || e.titan; e.hp -= dealt; e.lastHit = this.time; e.flash = .14;
    if (e.hp <= 0) {
      // Back after 22 to 32 s, a boss after 90 s, a titan after 600 s; the dragon and a split's tiny slimes never by the clock.
      e.hp = 0; e.respawn = e.event || e.temp ? Infinity : e.titan ? AI.titanRespawn : boss ? AI.bossRespawn : AI.respawn + this.random() * AI.respawnSpread; e.dying = AI.dying; e.phase = 'idle'; e.kx = e.kz = e.stun = e.lift = e.liftV = 0;
      e.marks.length = 0; e.pulses.length = 0; e.skill = e.callout = ''; e.slam = false; e.attack = null; e.titanLift = 0;
      if (e.event) this.slain.set(e.id, this.eventNow().index);
      this.host.emit?.('defeat', e); if (e.def.splits) this.split(e); return dealt;
    }
    // A hit never staggers a boss: a hard stun only slows it (boss-patterns.mjs hitControl), and it says so at most every 0.7 s.
    const control = hitControl(boss, stun);
    if (control.stun) e.stun = Math.max(e.stun, control.stun);
    if (control.slow) { e.slow = Math.max(e.slow, control.slow); if (this.time - e.resistAt >= RESIST_EVERY) { e.resistAt = this.time; this.host.emit?.('resist', e); } }
    if (lift > 0) { e.liftV = Math.max(e.liftV, Math.sqrt(lift * (boss ? AI.bossLift : 1) * AI.gravity)); e.stun = Math.max(e.stun, AI.launchStun); }
    if (knock > 0 && e.def.speed > 0) { const k = knock * AI.knock * (boss ? AI.bossKnock : 1); e.kx += dirX * k; e.kz += dirZ * k; }
    return dealt;
  }
  /** When a magma slime falls, three tiny slimes spring up 0.9 m round it (at most 18 alive at once). They never come back. */
  split(e) {
    let alive = 0; for (let i = 0; i < this.list.length; i++) if (this.list[i].temp && this.list[i].hp > 0) alive++;
    for (let i = 0; i < 3 && alive < AI.minis; i++, alive++) {
      const a = i * Math.PI * 2 / 3, m = this.make({ id: `${e.id}:m${this.serial++}`, type: e.def.splits, x: e.x, z: e.z, region: e.region, level: e.level, power: e.power, leash: e.leash });
      m.temp = true; const x = e.x + Math.cos(a) * AI.miniRing, z = e.z + Math.sin(a) * AI.miniRing;
      if (this.walkable(m, x, z)) { m.x = m.px = m.sx = x; m.z = m.pz = m.sz = z; }
      m.homeX = m.x; m.homeZ = m.z; this.list.push(m); this.host.emit?.('spawn', m);
    }
  }
  shoot(e, target) { this.shootAt(e, target.x, target.z); }
  shootAt(e, x, z) {
    let shot = null; for (let i = 0; i < this.shots.length; i++) if (!this.shots[i].live) { shot = this.shots[i]; break; } if (!shot) return;
    const d = Math.max(.01, len(x - e.x, z - e.z));
    shot.live = true; shot.x = e.x; shot.z = e.z; shot.vx = (x - e.x) / d * AI.shotSpeed; shot.vz = (z - e.z) / d * AI.shotSpeed; shot.life = AI.shotLife; shot.damage = e.damage; shot.owner = e; shot.kind = e.def.shot ?? '';
    this.host.emit?.('shot', e);
  }
  /** A boss's blow on the ground: hurts the player inside `radius` of (x, z), and outside `inner` (a quake's ring). */
  area(e, x, z, radius, hit, inner = 0, source = 'melee') {
    const t = this.aim; if (!t) return false;
    const d = len(t.x - x, t.z - z); if (d >= radius || d < inner) return false;
    this.host.hurt?.(e.damage * hit, source, e); return true;
  }
  /**
   * Starts a wind-up aimed at `at`. A boss picks a skill or a plain strike (boss-patterns.mjs bossSkill; Zoo Garden's
   * beginBossSkill): the skill's own wind-up (× 0.8 below 30 % health), its telegraph discs in e.marks and its callout.
   */
  windup(e, at) {
    const def = e.def;
    e.phase = 'windup'; e.attacks++; e.targetX = at.x; e.targetZ = at.z; if (at !== e) e.facing = Math.atan2(at.x - e.x, at.z - e.z);
    e.skill = !def.boss ? '' : SKILL[e.forced] ? e.forced : bossSkill(e.type, e.attacks, e.hp / e.maxHp, e.skillCount) ?? ''; e.forced = ''; e.marks.length = 0; e.phaseTime = def.windup;
    if (e.skill) {
      e.skillCount++; e.phaseTime = BOSS_WINDUPS[e.skill] * (e.hp < e.maxHp * .3 ? .8 : 1);
      const marks = bossTelegraphs(e.skill, e, at, e.hp < e.maxHp * .5 ? Math.max(2, e.stage) : e.stage, e.attacks); for (let i = 0; i < marks.length; i++) e.marks.push(marks[i]);
      // From its second stage the dragon's rain also drops fire on the player: three drops (five in the third stage) within 4 m.
      if (def.worldBoss && e.stage >= 2 && (e.skill === 'slam' || e.skill === 'rain')) {
        let seed = Math.imul(e.attacks, 9127) >>> 0; const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
        for (let i = 0; i < (e.stage >= 3 ? FIRE_RAIN.lateDrops : FIRE_RAIN.drops); i++) { const a = random() * Math.PI * 2, r = random() * FIRE_RAIN.spread; e.pulses.push({ x: at.x + Math.cos(a) * r, z: at.z + Math.sin(a) * r, r: FIRE_RAIN.radius, inner: 0, left: FIRE_RAIN.delay, total: FIRE_RAIN.delay, hit: 0, share: FIRE_RAIN.share }); }
      }
      e.callout = e.skill; this.host.emit?.('callout', e);
    }
    e.slam = e.skill === 'slam'; e.windupTotal = e.phaseTime; this.host.emit?.('windup', e);
  }
  /** The wind-up is over: the skill lands (Zoo Garden's castBossSkill, with its numbers in boss-patterns.mjs SKILL). */
  cast(e) {
    const def = e.def, skill = e.skill, k = SKILL[skill];
    e.phase = 'recover'; e.phaseTime = AI.bossRecover; e.cooldown = def.cooldown * bossCooldownScale(e) * (e.stage >= 3 ? .8 : 1); e.callout = '';
    if (skill === 'slam') this.area(e, e.x, e.z, k.radius, k.hit);
    else if (skill === 'quake') for (let i = 0; i < k.rings.length; i++) e.pulses.push({ x: e.x, z: e.z, r: k.rings[i] + k.outer, inner: k.rings[i] - k.inner, left: k.first + i * k.gap, total: 0, hit: k.hit, share: 0 });
    else if (skill === 'rain') for (let i = 0; i < e.marks.length; i++) this.area(e, e.marks[i].x, e.marks[i].z, e.marks[i].r, k.hit, 0, 'shot');
    else if (skill === 'barrage') { const count = e.hp < e.maxHp * .5 ? k.hurtShots : k.shots; for (let i = 0; i < count; i++) { const a = i / count * Math.PI * 2 + e.facing; this.shootAt(e, e.x + Math.sin(a) * k.aim, e.z + Math.cos(a) * k.aim); } }
    else if (skill === 'charge') { const dx = e.targetX - e.x, dz = e.targetZ - e.z, d = len(dx, dz) || 1; e.targetX = e.x + dx / d * k.run; e.targetZ = e.z + dz / d * k.run; e.phase = 'charge'; e.phaseTime = k.time; e.charged = false; }
    else if (skill === 'spin') { e.phase = 'spin'; e.phaseTime = k.time; e.spinTick = 0; }
    else if (skill === 'eclipse') { this.area(e, e.x, e.z, k.radius, k.hit, 0, 'shot'); this.host.eclipse?.(k.dark, e); }
    this.host.emit?.('cast', e); e.marks.length = 0;
  }
  /** Every thought of a boss: the dragon's stage, the quake's rings and the fire rain as they land, and the enrage below 30 % health. */
  bossTick(e, dt) {
    if (e.def.worldBoss) { const stage = bossPhase(e.hp, e.maxHp); if (stage !== e.stage) { e.stage = stage; this.host.emit?.('stage', e); } }
    for (let i = e.pulses.length - 1; i >= 0; i--) {
      const p = e.pulses[i]; if ((p.left -= dt) > 0) continue;
      // Fire rain is the land's kind of hurt (a share of full health, a rider is not spared); a ring is the boss's own blow.
      if (p.share) { const t = this.player; if (t && len(t.x - p.x, t.z - p.z) < p.r) this.host.hurtShare?.(p.share, 'fire', e); } else this.area(e, p.x, p.z, p.r, p.hit, p.inner);
      e.pulses.splice(i, 1); this.host.emit?.('pulse', e, p);
    }
    if (!e.enraged && e.hp < e.maxHp * .3 && e.phase !== 'idle' && e.phase !== 'return') { e.enraged = true; this.host.emit?.('enrage', e); }
  }
  /** Back at full strength at home: after the respawn timer, and when the dragon's event begins. */
  revive(e) {
    Object.assign(e, { hp: e.maxHp, x: e.homeX, z: e.homeZ, sx: e.homeX, sz: e.homeZ, px: e.homeX, pz: e.homeZ, moveSpan: 0, phase: 'idle', stun: 0, cooldown: 0, attacks: 0, born: AI.born, lastHit: -99, respawn: 0,
      skill: '', skillCount: 0, enraged: false, stage: 1, slow: 0, callout: '', slam: false, damage: e.baseDamage, attack: null, titanLift: 0 });
    e.marks.length = 0; e.pulses.length = 0; this.dead.delete(e.id);
  }
  /** `target` is the player when it can be fought (null inside the ward, driving, indoors); `near` is how far the player really is. */
  think(e, dt, target, near) {
    const def = e.def;
    e.cooldown = Math.max(0, e.cooldown - dt); e.stun = Math.max(0, e.stun - dt);
    if (e.slow > 0) e.slow = Math.max(0, e.slow - dt);
    const distance = target ? near : Infinity;
    if (def.behavior === 'titan') return this.titanStep(e, dt, target, distance);
    // The test hook (world.pandora.forceSkill sets e.forced): a boss starts that skill's wind-up now, whatever its counter says.
    if (e.forced && def.boss && e.phase !== 'windup' && e.phase !== 'charge' && e.phase !== 'spin') { e.stun = 0; this.windup(e, target ?? this.player ?? e); return; }
    // Level of detail: a calm creature far from the player rests; nearer, it only wanders, so it thinks on every 4th step.
    const calm = e.phase === 'idle' && e.hp === e.maxHp && !e.stun;
    e.resting = calm && near > AI.restRange; if (e.resting) { e.wait = 0; return; }
    if (calm && near > def.sight + 1) { e.wait += dt; if ((this.tick + e.slot) % 4) return; dt = e.wait; e.wait = 0; } else e.wait = 0;
    e.thought = dt; // the time this thought covers: a move made in it is drawn gliding over the same time
    if (def.boss) this.bossTick(e, dt);
    if (e.stun > 0) { if (e.phase !== 'return') e.phase = 'chase'; e.marks.length = 0; e.callout = ''; return; }
    if (e.phase === 'windup') {
      if ((e.phaseTime -= dt) > 0) return;
      if (e.skill) { this.cast(e); return; }
      if (def.burst) { // the magma turtle and the lava worm: a blast round itself, then a long recovery
        this.area(e, e.x, e.z, def.burst.r, def.burst.hit); this.host.emit?.('strike', e);
        e.phase = 'recover'; e.phaseTime = def.burst.recover; e.cooldown = def.cooldown; return;
      }
      if (def.behavior === 'charger') {
        e.phase = 'charge'; e.phaseTime = AI.chargeTime; e.charged = false;
        if (target) { const d = distance || 1, run = AI.chargeSpeed * AI.chargeTime; e.targetX = e.x + (target.x - e.x) / d * run; e.targetZ = e.z + (target.z - e.z) / d * run; }
        this.host.emit?.('strike', e); return;
      }
      if (target) {
        if (def.behavior === 'shooter') this.shoot(e, target);
        else if (distance < def.reach + (def.boss ? .2 : 0) + .4) this.host.hurt?.(e.damage, 'melee', e);
      }
      this.host.emit?.('strike', e); e.phase = 'recover'; e.phaseTime = def.boss ? AI.bossRecover : AI.recover; e.cooldown = def.cooldown * bossCooldownScale(e); return;
    }
    if (e.phase === 'spin') { // a boss's spin: 2.4 s drifting toward the target, a blow every 0.35 s to whoever is inside 3.4 m
      const k = SKILL.spin; e.phaseTime -= dt; e.spinTick -= dt; e.facing += dt * 18;
      if (target && distance > k.stop) this.move(e, (target.x - e.x) / distance * def.speed * k.drift * dt, (target.z - e.z) / distance * def.speed * k.drift * dt);
      if (e.spinTick <= 0) { e.spinTick = k.every; this.area(e, e.x, e.z, k.radius, k.hit); }
      if (e.phaseTime <= 0) { e.phase = 'recover'; e.phaseTime = AI.bossRecover; }
      return;
    }
    if (e.phase === 'charge') {
      // A boss's charge skill runs 14 m at 18 m/s and hits whoever it brushes; a charger's own run is 13 m/s for 0.75 s.
      const skill = e.skill === 'charge', speed = skill ? SKILL.charge.speed : AI.chargeSpeed, dx = e.targetX - e.x, dz = e.targetZ - e.z, d = len(dx, dz);
      if (d > .1) { this.move(e, dx / d * speed * dt, dz / d * speed * dt); e.facing = Math.atan2(dx, dz); }
      if (target && !e.charged && len(target.x - e.x, target.z - e.z) < (skill ? e.radius + SKILL.charge.reach : def.reach + .4)) { e.charged = true; this.host.hurt?.(e.damage * (skill ? SKILL.charge.hit : AI.chargeHit), 'melee', e); }
      if ((e.phaseTime -= dt) <= 0 || d < .3) { e.phase = 'recover'; e.phaseTime = def.boss ? AI.bossRecover : AI.recover; e.cooldown = def.cooldown * bossCooldownScale(e); }
      return;
    }
    if (e.phase === 'recover') { if ((e.phaseTime -= dt) <= 0) e.phase = 'chase'; return; }
    // Leash: a chaser gives up past 1.6 × its sight or 30 m from home, unless it was hit in the last 4 s. A player inside
    // the ward (or driving, or indoors) is no target at all, so the chase ends at the ward line.
    const homeDistance = len(e.x - e.homeX, e.z - e.homeZ), wasChasing = e.phase === 'chase' || e.hp < e.maxHp && e.phase !== 'return', sinceHit = this.time - e.lastHit;
    const chasing = !!target && (sinceHit < AI.hitGrace || (e.phase === 'return' ? distance < def.sight && homeDistance < AI.returnSight
      : wasChasing ? distance <= def.sight * AI.leashSight && homeDistance <= e.leash : distance < def.sight && homeDistance < e.leash));
    let returning = !chasing && (wasChasing || e.phase === 'return');
    if (returning) {
      e.phase = 'return'; e.hp = Math.min(e.maxHp, e.hp + e.maxHp * AI.returnHeal * dt);
      // Home again: healed, calm (an enraged boss calms down), and a damage boost it was lent (a titan's summon) is given back.
      if (homeDistance < .8 || def.speed === 0) { e.hp = e.maxHp; e.phase = 'idle'; returning = false; e.damage = e.baseDamage; if (e.enraged) { e.enraged = false; this.host.emit?.('calm', e); } }
    }
    if (chasing && e.phase !== 'chase') { if (e.phase === 'idle' || e.phase === 'return') this.host.emit?.('alert', e); e.phase = 'chase'; }
    const from = def.burst ? def.burst.from : def.reach + (def.boss ? .2 : 0);
    if (chasing && !e.cooldown && (distance < from || def.behavior === 'charger' && !def.burst && distance < AI.chargeFrom)) { this.windup(e, target); return; }
    const slow = e.slow > 0 ? SLOW : 1;
    // While its charge cools down a firebat, thunderbird, jellyfish or wisp circles its target 5 m out instead of standing in reach.
    if (chasing && def.circles && distance < AI.circleFrom && distance > .001) {
      const side = e.slot % 2 ? 1 : -1, ux = (target.x - e.x) / distance, uz = (target.z - e.z) / distance, radial = (distance - AI.circleAt) * AI.circlePull;
      const vx = -uz * side + ux * radial, vz = ux * side + uz * radial, n = len(vx, vz) || 1, step = def.speed * AI.circleSpeed * slow * dt;
      this.move(e, vx / n * step, vz / n * step); e.facing = Math.atan2(vx, vz); return;
    }
    if (def.speed === 0 || chasing && distance < (def.burst ? def.burst.from : def.reach) * .8) { if (chasing) e.facing = Math.atan2(target.x - e.x, target.z - e.z); return; }
    const gx = chasing ? target.x : returning ? e.homeX : e.homeX + Math.sin(this.time * .25 + e.homeZ) * AI.wander, gz = chasing ? target.z : returning ? e.homeZ : e.homeZ + Math.cos(this.time * .25 + e.homeX) * AI.wander;
    const dx = gx - e.x, dz = gz - e.z, d = len(dx, dz), hurt = def.boss ? (e.hp < e.maxHp * .5 ? 1.35 : 1) * (e.hp < e.maxHp * .3 ? 1.25 : 1) * (e.stage >= 3 ? 1.2 : 1) : 1;
    if (d > .05) { const step = Math.min(d, (chasing ? def.speed * hurt : returning ? def.speed * 1.2 : AI.wanderSpeed) * slow * dt); this.move(e, dx / d * step, dz / d * step); e.facing = Math.atan2(dx, dz); }
  }
  /**
   * A titan's whole turn (builder D2): reached from think() for a row with behavior 'titan'. The code is titan-patterns.mjs titanTurn:
   * its running attacks, its wind-up and marks, the chase under the hard leash (never more than `leash` metres from its den, hit or
   * not), the clamped leap and the summon. It uses the fields make() adds (titanLift, attack, forced, leash), this.host.hurt,
   * this.host.pull, this.host.emit, this.walkable and this.move.
   */
  titanStep(e, dt, target, distance) { if (titanTurn) titanTurn(this, e, dt, target, distance, AI); else loadTitanTurn().catch(() => {}); }
  /**
   * One fixed step. player: {x, z, active} (or null). The work is in small methods (life, spread, clear, glide, fly) on purpose:
   * V8 tiers a function up by how often it runs, and one big method that runs 40 times a second never settled (it was cut back to
   * the interpreter again and again, and every number it handled there was a heap object: 36 KB of garbage a step).
   */
  step(dt, player) {
    if (!(dt > 0)) return;
    this.time += dt; this.tick++;
    // `target` is the player when anything may fight it at all; each creature fights only a player in its own region (below).
    const target = player && player.active !== false && !inSafeZone(player.x, player.z) ? player : null, targetRegion = target ? regionAt(target.x, target.z) : null, awake = this.awake; awake.length = 0;
    this.removed = false; this.tickEvent = null; this.player = player ?? null;
    for (let n = 0; n < this.list.length; n++) this.life(this.list[n], dt, target, targetRegion, player, awake);
    if (this.removed) this.list = this.list.filter(e => !e.gone);
    this.spread(awake); this.clear(awake, target); this.glide(dt); this.fly(dt, target);
  }
  /** One creature's turn: its timers, its lava event, its death and return, its thinking and its knock-back. A calm one joins `awake`. */
  life(e, dt, target, targetRegion, player, awake) {
    e.sx = e.x; e.sz = e.z; e.thought = 0;
    if (e.flash > 0) e.flash = Math.max(0, e.flash - dt); if (e.born > 0) e.born = Math.max(0, e.born - dt); if (e.dying > 0) e.dying = Math.max(0, e.dying - dt);
    if (e.leaving > 0) { if ((e.leaving -= dt) <= 0) { e.gone = true; this.removed = true; this.host.emit?.('retire', e); } return; }
    if (e.event) {
      // The dragon: here at full health the moment its lava event begins, gone when it ends, and never back by the clock.
      const now = this.tickEvent ??= this.eventNow(), on = now.id === e.event;
      if (on && !e.eventLive && e.hp <= 0) { this.revive(e); this.host.emit?.('arrive', e); }
      else if (!on && e.hp > 0) { e.hp = 0; e.respawn = Infinity; e.dying = AI.dying; e.phase = 'idle'; e.marks.length = 0; e.pulses.length = 0; e.skill = e.callout = ''; e.stage = 1; this.host.emit?.('depart', e); }
      if (!on) this.slain.delete(e.id);
      e.eventLive = on;
    }
    if (e.hp <= 0) {
      if (e.temp) { if (!(e.dying > 0)) { e.gone = true; this.removed = true; this.host.emit?.('retire', e); } return; }
      // Back after the timer, once the player has moved away from its home (the reference's 22 m rule).
      if ((e.respawn -= dt) <= 0 && (!player || len(player.x - e.homeX, player.z - e.homeZ) > AI.respawnClear)) { this.revive(e); this.host.emit?.('respawn', e); }
      return;
    }
    // A player standing in another region is no target for it, hit or not: it turns for home and heals.
    this.aim = target && (!e.region || e.region === targetRegion) ? target : null;
    this.think(e, dt, this.aim, player ? len(player.x - e.x, player.z - e.z) : Infinity);
    // Launch height and knock-back slide run for every living creature, also while it is stunned.
    if (e.lift > 0 || e.liftV > 0) { e.liftV = Math.max(-15, e.liftV - AI.gravity * dt); e.lift = Math.max(0, e.lift + e.liftV * dt); if (!e.lift) e.liftV = 0; }
    if (Math.abs(e.kx) > .05 || Math.abs(e.kz) > .05) { this.move(e, e.kx * dt, e.kz * dt); const k = Math.max(0, 1 - dt * 8); e.kx *= k; e.kz *= k; }
    if (!e.resting) awake.push(e);
  }
  /** Nothing piles up: awake creatures push each other apart. */
  spread(awake) {
    for (let i = 0; i < awake.length; i++) for (let j = i + 1; j < awake.length; j++) {
      const a = awake[i], b = awake[j], dx = a.x - b.x, dz = a.z - b.z, min = a.radius + b.radius; if (dx >= min || dx <= -min || dz >= min || dz <= -min) continue;
      const d = len(dx, dz); if (d >= min) continue;
      const moveA = a.def.speed > 0, moveB = b.def.speed > 0; if (!moveA && !moveB) continue;
      const nx = d > 1e-4 ? dx / d : Math.cos(i * 2.399), nz = d > 1e-4 ? dz / d : Math.sin(i * 2.399), push = (min - d + .002) / (moveA && moveB ? 2 : 1);
      if (moveA) this.move(a, nx * push, nz * push); if (moveB) this.move(b, -nx * push, -nz * push);
    }
  }
  /** ... and out of the player's circle (a charge runs through). */
  clear(awake, target) {
    if (!target) return;
    for (let n = 0; n < awake.length; n++) {
      const e = awake[n];
      if (!(e.def.speed > 0) || e.phase === 'charge') continue;
      const dx = e.x - target.x, dz = e.z - target.z, d = len(dx, dz), min = AI.playerRadius + e.radius; if (d >= min) continue;
      const nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0; this.move(e, nx * (min - d + .002), nz * (min - d + .002));
    }
  }
  /**
   * Drawing runs more often than this step (and a calm creature far away moves only on every 4th): each move is kept with
   * the place it started from and the time it covers, so wilds-view.mjs can draw the creature gliding between the two
   * instead of jumping. A jump of more than GLIDE_MAX metres (a respawn, a hard knock) is not a walk and is not glided.
   */
  glide(dt) {
    for (let n = 0; n < this.list.length; n++) {
      const e = this.list[n]; if (e.x === e.sx && e.z === e.sz) continue;
      const far = len(e.x - e.sx, e.z - e.sz) > GLIDE_MAX; e.px = far ? e.x : e.sx; e.pz = far ? e.z : e.sz; e.moveAt = this.time; e.moveSpan = far ? 0 : e.thought > dt ? e.thought : dt;
    }
  }
  /** The shots in flight. */
  fly(dt, target) {
    for (let n = 0; n < this.shots.length; n++) {
      const shot = this.shots[n]; if (!shot.live) continue;
      shot.x += shot.vx * dt; shot.z += shot.vz * dt; shot.life -= dt;
      if (target && len(shot.x - target.x, shot.z - target.z) < AI.shotHit) { this.host.hurt?.(shot.damage, 'shot', shot.owner); shot.live = false; }
      else if (shot.life <= 0 || inSafeZone(shot.x, shot.z) || this.host.blocked?.(shot.x, shot.z)) shot.live = false;
    }
  }
}
