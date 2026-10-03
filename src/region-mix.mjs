// Who lives where, and how strong (round 8, builder D). Pure, no imports.
//   MIX[region]       [[creature type, weight], ...]: the kinds a region's spawn slots draw from. A kind whose row says
//                     where: 'sea' (the jellyfish, the hammerhead) is drawn only for a slot in the sea; the others only on land.
//   DENSITY[region]   mean creatures per 32 m cell with SLOTS 4 (a slot is kept with probability DENSITY / 4, so 4 is the ceiling)
//   TARGET[region]    how many creatures the region should hold (spec 3.8); DENSITY is tuned until the seeded count is within 2
//   POWER[d]          the stat multiplier of a land of difficulty d (home regions always play at 1)
//   LOOKALIKES        scenery that looks like a creature, and the creature(s) it looks like (Zoo Garden's biomes.ts LOOKALIKES)
//   TWIN_BLOCKS       the blocking half of that table, by creature: a slot of that kind within TWIN_GAP metres of such a piece yields
//
// The mixes are Zoo Garden's own (enemy-types.ts HOME_SPAWNS and PLANET_SPAWNS). The forest hawk is a fixed six in the
// reference; here it is a mix entry of weight 6, about 5 of the forest's 37.
export const MIX = {
  village: [],
  west: [['mushroom', 20], ['boar', 12], ['bee', 6], ['forest_raptor', 6]],
  north: [['chomper', 14], ['wolf', 10], ['frog', 12], ['mushroom', 6]],
  south: [['mushroom', 12], ['boar', 8], ['bee', 12]],
  east: [['cactus', 14], ['wolf', 8], ['crab', 12]],
  toy: [['toysoldier', 20], ['windmouse', 18], ['jackbox', 16]],
  candy: [['jelly', 26], ['gummy', 16], ['lollipop', 16], ['bunny', 18], ['chocobeetle', 12]],
  jungle: [['monkey', 18], ['snake', 16], ['chameleon', 16], ['flytrap', 12]],
  ice: [['snowball', 24], ['penguin', 18], ['icebloom', 14], ['seal', 14], ['owl', 16]],
  ocean: [['jellyzap', 18], ['hammershark', 14], ['urchin', 14], ['crab', 12]],
  // The order of a list has no meaning but one: a slot's seeded number walks it, so the order decides which slot holds which kind.
  // Lava's is not the reference's order: in that one no kept slot of the Ember Fields drew a magma turtle (tune-density.mjs lists a missing kind).
  lava: [['firebat', 20], ['magmaslime', 22], ['magmaturtle', 10], ['lavaworm', 8], ['firelizard', 12], ['volcano', 12], ['magmacrab', 10]],
  cloud: [['cloudsheep', 22], ['thunderbird', 18], ['windspirit', 14]],
  shadow: [['wisp', 22], ['spider', 18], ['demoneye', 14]],
};
/** The count each region is tuned to (spec 3.8): the reference's own density on a 128 m square, capped where den clearings leave too few slots. */
export const TARGET = Object.freeze({ village: 0, west: 37, north: 39, south: 37, east: 33, toy: 19, candy: 28, jungle: 22, ice: 28, ocean: 21, lava: 25, cloud: 19, shadow: 19 });
/**
 * Tuned with `node scripts/tune-density.mjs` against the scenery and the land features of the day (it prints this table).
 * The seeded count moves whenever the blocking scenery (region-life.mjs DECOR) or the land features (land-features.mjs)
 * change, so the script is run again after such a merge; tests/region-mix.test.mjs fails if a count is more than 2 off.
 */
export const DENSITY = { village: 0, west: 3.05, north: 2.17, south: 2.6, east: 3.04, toy: 2.11, candy: 3.14, jungle: 1.78, ice: 3.42, ocean: 2.33, lava: 2.88, cloud: 1.76, shadow: 1.79 };
/** By difficulty d (Zoo Garden's DIFFICULTY_MULTIPLIERS, boss-patterns.ts:17). */
export const POWER = Object.freeze([1, 1, 1.7, 2.6, 3.6, 4.8, 6.2]);
/** What a boss and a titan take on top of POWER (world.ts:824): health and damage. A home boss takes neither; the home titan takes the titan's at power 1; the dragon no health factor. */
export const RANK = Object.freeze({ boss: { hp: 2.6, damage: 1.35 }, titan: { hp: 7, damage: 1.6 } });
/** Coins in a land: the kind's coins × (0.6 + 0.4 × POWER), the reference's XP rule (boss-patterns.ts:20). */
export const coinFactor = power => .6 + .4 * power;
export const LOOKALIKES = Object.freeze({
  toadstools: ['mushroom', 'mushking'], bush: ['frog'], gumdrops: ['jelly'], snowman: ['snowball'], snow_rock: ['snowball'],
  toyblock: ['jackbox'], coral: ['urchin'], skyrock: ['cloudsheep'], rock: ['spider'],
});
/** Scenery is planned before creatures here, so for a blocking lookalike the creature yields (for a card, the card does: fields.mjs). */
export const TWIN_BLOCKS = Object.freeze({ jackbox: ['toyblock'], snowball: ['snowman', 'snow_rock'], cloudsheep: ['skyrock'], spider: ['rock'] });
export const TWIN_GAP = 8;
