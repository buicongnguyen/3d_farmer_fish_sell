// Who lives where, and how strong (round 8, step 0 stub; owner: builder D, who replaces the tables below). Pure.
//   MIX[region]       [[creature type, weight], ...]: the kinds a region's spawn slots draw from ([] = nobody lives there yet)
//   DENSITY[region]   mean creatures per 32 m cell with SLOTS 4 (a slot is kept with probability DENSITY / 4)
//   POWER[d]          the stat multiplier of a land of difficulty d (home regions always play at 1). REAL, final.
//
// STUB (step 0): the four home mixes are the spec's (3.1) without `forest_raptor`, so every kind named here exists in
// wilds.mjs CREATURES today; the eight lands are empty. DENSITY holds the start values of spec 3.8 for the home regions
// and 0 for the lands. Builder D adds the hawk, the lands' kinds and tunes each density to its target count.
export const MIX = {
  village: [],
  west: [['mushroom', 20], ['boar', 12], ['bee', 6]],
  north: [['chomper', 14], ['wolf', 10], ['frog', 12], ['mushroom', 6]],
  south: [['mushroom', 12], ['boar', 8], ['bee', 12]],
  east: [['cactus', 14], ['wolf', 8], ['crab', 12]],
  toy: [], candy: [], jungle: [], ice: [], ocean: [], lava: [], cloud: [], shadow: [],
};
export const DENSITY = { village: 0, west: 2.72, north: 2.72, south: 2.4, east: 2.8, toy: 0, candy: 0, jungle: 0, ice: 0, ocean: 0, lava: 0, cloud: 0, shadow: 0 };
/** By difficulty d (Zoo Garden's DIFFICULTY_MULTIPLIERS, boss-patterns.ts:17). A land boss also takes HP × 2.6 and damage × 1.35, a titan × 7 and × 1.6 (builder D). */
export const POWER = Object.freeze([1, 1, 1.7, 2.6, 3.6, 4.8, 6.2]);
