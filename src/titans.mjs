// The nine titans' data (round 8; owner: builder D2), from Zoo Garden's src/titan-content.ts. Pure. It imports
// creature-def.mjs and content.mjs, and nothing from wilds.mjs, gear.mjs or pandora.mjs: those three merge these tables in with
// one line each (wilds.mjs Object.assign(CREATURES, TITAN_ROWS); gear.mjs spreads TITAN_GEAR into its table; pandora.mjs
// Object.assign(LOOT, TITAN_LOOT)).
//   TITAN_ROWS    {titan_turtle: creature(...), ...}: rows for wilds.mjs CREATURES, with behavior 'titan', boss and titan true,
//                 `skills` (the order they are used in), `glow`, `land` (the region the den is in) and `file` (its own model,
//                 public/assets/models/<file>.glb, fetched by titans-view.mjs when its den comes within 96 m).
//   TITAN_GEAR    {hat_t_turtle: {name, slot: 'hat', price, kit: 'hat-t-turtle', trophy: true, ...}, pet_t_turtle: {...}}:
//                 18 rows in gear.mjs's table shape. `kit` names the row's own model file without the extension; gear.mjs kitOf
//                 returns it, and avatar.mjs fetches that file the first time the trophy is worn, tried on or shown.
//   TITAN_LOOT    {titan_turtle: [[item, chance, min, max], ...], ...}: rows for pandora.mjs LOOT
//   TITAN_LOOT_SPEC  the same rows before the one filter below
//
// What is the reference's and what is not:
//   copied      names, hp, damage, speed, sight, cooldown, wind-up, colours, flying, the skill lists; the trophies' names, stats,
//               traits and pet shots; the 12 % and 6 % of a hat and a pet.
//   sized       reach, radius, height and scale are stored x 0.75 (creature-sizes.ts TITAN_SIZE): the reference sizes its rows at
//               load, Willowmere's rows carry their numbers themselves, so it is done once, here.
//   adapted     coins = XP / 2 (Willowmere has no player level); a trophy's price is four times the reference's sell value, so a
//               spare (pandora.mjs spareGearCoins: a quarter of the price) pays exactly that sell value; loot the reference
//               drops for crafting becomes the land's one material (spec 4.5).
import { creature } from './creature-def.mjs';
import { ITEMS } from './content.mjs';

/** creature-sizes.ts:11. Applied to reach, radius, height and the drawn scale when the rows below are written. */
export const TITAN_SIZE = .75;
const sized = v => Math.round(v * TITAN_SIZE * 1e4) / 1e4;
/** One row: the reference's own numbers in, the sized row out. */
const titan = (name, land, level, hp, damage, speed, reach, sight, xp, radius, cooldown, scale, height, color, accent, glow, flying, skills, file) =>
  creature(name, hp, damage, speed, xp / 2, 'titan', color, { accent, glow, reach: sized(reach), sight, radius: sized(radius), cooldown, windup: .8, scale: sized(scale), height: sized(height), level, boss: true, titan: true, flying, land, xp, skills: Object.freeze(skills), file });

export const TITAN_ROWS = {
  titan_turtle: titan('Ancient Mountain Turtle', 'east', 13, 1500, 30, 1.4, 6.5, 22, 3000, 4.2, 2.6, 2.4, 5.2, '#6b8a4a', '#c9a86a', '#8fe05a', false, ['stomp4', 'lines', 'leap', 'summon', 'donut'], 't-turtle'),
  titan_hydra: titan('Three-Headed Candy Hydra', 'candy', 13, 1600, 32, 1.8, 6.5, 22, 3400, 3.8, 2.4, 2.3, 6, '#ff5aa8', '#8ae0ff', '#ffe14d', false, ['sweep', 'orbs', 'pools', 'bombard', 'summon'], 't-hydra'),
  titan_crystal: titan('Ice Crystal Queen', 'ice', 16, 1700, 34, 1.6, 6.5, 22, 3800, 3.6, 2.3, 2.2, 6.4, '#9fe8ff', '#e8f8ff', '#6a8cff', true, ['lines', 'orbs', 'donut', 'sweep', 'bombard'], 't-crystal'),
  titan_scorpion: titan('Inferno Scorpion', 'lava', 19, 1800, 38, 2, 7, 22, 4400, 4.4, 2.2, 2.4, 4.6, '#3a2a2e', '#ff6a2b', '#ffc23d', false, ['pools', 'leap', 'lines', 'sweep', 'stomp4'], 't-scorpion'),
  titan_clock: titan('Clockwork Spider', 'toy', 10, 1500, 30, 2, 6.5, 22, 3000, 4.2, 2.4, 2.4, 5, '#c89a3a', '#8a8ea0', '#3fb0ff', false, ['bombard', 'sweep', 'summon', 'lines', 'orbs'], 't-clock'),
  titan_flower: titan('Death Flower Rafflesia', 'jungle', 13, 1650, 32, 0, 9, 20, 3400, 4, 2.2, 2.4, 5.4, '#c0203a', '#ffe0b0', '#4fbf5a', false, ['pull', 'pools', 'orbs', 'summon', 'donut'], 't-flower'),
  titan_kraken: titan('Abyssal Kraken', 'ocean', 16, 1750, 34, 1.6, 8, 22, 3800, 4.4, 2.3, 2.4, 5.6, '#8a3a9a', '#ff9ad8', '#3fd0c0', false, ['pull', 'sweep', 'stomp4', 'pools', 'bombard'], 't-kraken'),
  titan_whale: titan('Celestial Cloud Whale', 'cloud', 19, 1850, 38, 2.2, 7, 24, 4400, 4.6, 2.3, 2.5, 4, '#dff0ff', '#8ab8ff', '#fff27a', true, ['bombard', 'orbs', 'pull', 'lines', 'donut'], 't-whale'),
  titan_eye: titan('Void Eye', 'shadow', 22, 2000, 40, 1.8, 7.5, 24, 5200, 3.8, 2.1, 2.3, 5, '#2a1a3e', '#b06aff', '#ff3b6a', true, ['sweep', 'pull', 'orbs', 'donut', 'lines', 'bombard'], 't-eye'),
};
export const TITAN_IDS = Object.freeze(Object.keys(TITAN_ROWS));
/** What a titan takes on top of its land's POWER (world.ts:824): health x 7, damage x 1.6; coins x (0.6 + 0.4 POWER) in a land (spec 3.4, 4.2). */
export const TITAN_FACTOR = Object.freeze({ hp: 7, damage: 1.6 });
/** The numbers of spec 4.2 for a titan at a land's power (1 at home): {hp, damage, coins}. wilds.mjs make() and pandora.mjs 'defeat' apply them (builder D). */
export function titanStats(type, power = 1, land = true) {
  const def = TITAN_ROWS[type]; if (!def) return null;
  return { hp: Math.round(def.hp * power * TITAN_FACTOR.hp), damage: def.damage * power * TITAN_FACTOR.damage, coins: land ? Math.round(def.xp / 2 * (.6 + .4 * power)) : def.xp / 2 };
}

// ---------------------------------------------------------------- trophies: nine hats and nine pets (titan-content.ts:279-601)
/** A trophy's price is this many times the reference's sell value; a spare pays a quarter of the price, which is that sell value. */
const PRICE = 4;
const hat = (key, name, sell, stats) => ({ name, slot: 'hat', price: sell * PRICE, kit: 'hat-t-' + key, trophy: true, ...stats });
// A pet's `scale` is not read by the drawing (avatar.mjs draws every pet at the player's own scale): the trophies' meshes are 0.70 m
// tall in the file, so they stand 0.62 m beside you, like the other pets. The number is kept in the shape gear.mjs uses.
const pet = (key, name, sell, stats, dmg, cd, shot) => ({ name, slot: 'pet', price: sell * PRICE, kit: 'pet-t-' + key, trophy: true, ...stats, pet: { scale: .5, dmg, cd, shot } });
export const TITAN_GEAR = {
  hat_t_turtle: hat('turtle', 'Ancient Mountain Helm', 900, { def: 30, hp: 150, regen: 3 }),
  hat_t_hydra: hat('hydra', 'Candy Hydra Crown', 900, { atk: 16, crit: .08, hp: 60 }),
  hat_t_crystal: hat('crystal', 'Ice Crystal Crown', 950, { crit: .12, def: 18, hp: 80, light: true }),
  hat_t_scorpion: hat('scorpion', 'Inferno Scorpion Helm', 1000, { atk: 20, def: 12, lavaproof: true }),
  hat_t_clock: hat('clock', 'Clockwork Crown', 900, { speed: .18, atk: 10, xp: .3 }),
  hat_t_flower: hat('flower', 'Rafflesia Crown', 950, { hp: 120, regen: 5, antidote: true }),
  hat_t_kraken: hat('kraken', 'Kraken Tentacle Hat', 950, { def: 16, atk: 12, luck: .4 }),
  hat_t_whale: hat('whale', 'Cloud Whale Hat', 1000, { speed: .22, hp: 140, xp: .2 }),
  hat_t_eye: hat('eye', 'Void Eye Crown', 1100, { atk: 22, crit: .1, light: true, luck: .25 }),
  pet_t_turtle: pet('turtle', 'Little Mountain Turtle', 1400, { def: 25, hp: 120, regen: 3 }, .5, 1.6, 'bubble'),
  pet_t_hydra: pet('hydra', 'Little Candy Hydra', 1400, { atk: 12 }, .8, .9, 'rainbow'),
  pet_t_crystal: pet('crystal', 'Little Crystal Queen', 1450, { crit: .1, light: true }, .7, 1.1, 'ice'),
  pet_t_scorpion: pet('scorpion', 'Little Inferno Scorpion', 1500, { atk: 14, lavaproof: true }, .9, 1, 'fire'),
  pet_t_clock: pet('clock', 'Little Clockwork Spider', 1400, { speed: .15, xp: .25 }, .6, .8, 'spike'),
  pet_t_flower: pet('flower', 'Little Rafflesia', 1450, { hp: 100, regen: 6, antidote: true }, .6, 1.2, 'bubble'),
  pet_t_kraken: pet('kraken', 'Little Abyssal Kraken', 1450, { def: 12, luck: .35 }, .7, 1.1, 'bubble'),
  pet_t_whale: pet('whale', 'Little Cloud Whale', 1500, { hp: 150, speed: .2, xp: .2 }, .7, 1.2, 'ice'),
  pet_t_eye: pet('eye', 'Little Void Eye', 1600, { atk: 16, crit: .08, light: true, luck: .2 }, 1, 1, 'rainbow'),
};

// ---------------------------------------------------------------- loot (titan-content.ts:602-915, spec 4.5)
// Every titan: its own hat at 12 % and its own pet at 6 %, then its land's material. A pick-up carries at most nine of a thing
// (pandora.mjs 'pickup'), so a drop of 8 to 12 or of 10 to 15 is two rows whose sums have the same ends.
const trophies = key => [['hat_t_' + key, .12, 1, 1], ['pet_t_' + key, .06, 1, 1]];
export const TITAN_LOOT_SPEC = {
  titan_turtle: [...trophies('turtle'), ['honey', 1, 2, 4], ['crown', .3, 1, 1]],
  titan_hydra: [...trophies('hydra'), ['sugar', 1, 4, 6], ['sugar', 1, 4, 6]],
  titan_crystal: [...trophies('crystal'), ['icecrystal', 1, 4, 6], ['icecrystal', 1, 4, 6]],
  titan_scorpion: [...trophies('scorpion'), ['obsidian', 1, 5, 8]],
  titan_clock: [...trophies('clock'), ['cog', 1, 5, 7], ['cog', 1, 5, 8]],
  titan_flower: [...trophies('flower'), ['amber', 1, 3, 5]],
  titan_kraken: [...trophies('kraken'), ['pearl', 1, 4, 6]],
  titan_whale: [...trophies('whale'), ['feather', 1, 4, 6], ['feather', 1, 4, 6]],
  titan_eye: [...trophies('eye'), ['moonstone', 1, 3, 5]],
};
/** The eight lands' materials are content.mjs ITEMS rows of builder D's. Until they are there, a row that names one is left out, so nothing unknown is ever dropped. */
const known = id => !!ITEMS[id] || !!TITAN_GEAR[id] || id === 'crown';
export const TITAN_LOOT = Object.fromEntries(Object.entries(TITAN_LOOT_SPEC).map(([type, rows]) => [type, rows.filter(([id]) => known(id))]));
/** The row builder (re-exported for the tests' made-up rows). */
export { creature };
