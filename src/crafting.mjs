// Vale's recipes use the existing craft-station outputs from cute_game/src/content.ts.
// Willowmere has one material per land instead of the reference's many catalysts:
// gear/battery -> cog; vine -> timber; coral -> crab claw; dragon scale -> hide;
// volcanic catalysts/dragon egg -> obsidian; thunderstone -> feather;
// shadow -> moonstone; fire crystal -> obsidian; the trident's star shard -> pearl.
// Existing ingredient identities are retained. Quantities and coin fees are adapted
// to this game's prices: even selling the materials at the supermarket cannot buy
// the same gear as cheaply. Crafted gear is unique wardrobe ownership, never stock
// that can be sold, and crafting leaves the player's outfit and stamina unchanged.
import { ITEMS } from './content.mjs';
import { GEAR, grantGear } from './gear.mjs';

export const CRAFT_CATEGORIES = Object.freeze([
  { id: 'volcano', label: 'Volcano equipment', icon: '🌋' },
  { id: 'toy-jungle', label: 'Toybox and jungle', icon: '🌿' },
  { id: 'sea-sky-night', label: 'Ocean, cloud and night', icon: '🌙' },
  { id: 'companions', label: 'Companions', icon: '🐾' },
].map(Object.freeze));

const rows = [
  ['boots_lava', 'volcano', 75, { obsidian: 1 }],
  ['sword_obsidian', 'volcano', 140, { obsidian: 4 }],
  ['armor_wings', 'volcano', 105, { obsidian: 3, hide: 2 }],
  ['toy_hammer', 'toy-jungle', 50, { cog: 3 }],
  ['armor_leaf', 'toy-jungle', 40, { amber: 1, wood: 3 }],
  ['trident', 'sea-sky-night', 140, { pearl: 2, claw: 2 }],
  ['armor_cloud', 'sea-sky-night', 160, { feather: 4 }],
  ['hat_lantern', 'sea-sky-night', 120, { moonstone: 1, obsidian: 1 }],
  ['pet_robot', 'companions', 55, { cog: 4 }],
  ['pet_parrot', 'companions', 35, { amber: 1, wood: 1, feather: 1 }],
  ['pet_turtle', 'companions', 85, { pearl: 1, claw: 1 }],
  ['pet_sheep', 'companions', 90, { feather: 4 }],
  ['pet_firefly', 'companions', 80, { moonstone: 1, obsidian: 2 }],
  ['pet_dragon', 'companions', 135, { obsidian: 5 }],
];

/** Immutable rows for the workshop UI; id equals the existing wardrobe result id. */
export const CRAFT_RECIPES = Object.freeze(rows.map(([id, category, coins, materials]) =>
  Object.freeze({ id, result: id, category, coins, materials: Object.freeze(materials) })));
const recipes = Object.fromEntries(CRAFT_RECIPES.map(recipe => [recipe.id, recipe]));
const amount = value => Number.isSafeInteger(value) && value >= 0;

/** Read-only eligibility and ingredient counts. Unknown ids never inspect object prototypes. */
export function craftStatus(state, id) {
  const recipe = typeof id === 'string' && Object.hasOwn(recipes, id) ? recipes[id] : null;
  if (!recipe) return { ok: false, recipe: null, owned: false, missingCoins: 0, materials: [], message: 'That recipe is not in the workshop.' };
  const inventory = state?.inventory;
  const materials = Object.entries(recipe.materials).map(([item, need]) => {
    const value = inventory && Object.hasOwn(inventory, item) ? inventory[item] : 0;
    const have = amount(value) ? value : 0;
    return { id: item, have, need, missing: Math.max(0, need - have) };
  });
  const owned = Array.isArray(state?.gearOwned) && state.gearOwned.includes(recipe.result);
  const valid = !!state && amount(state.coins) && !!inventory && typeof inventory === 'object' && !Array.isArray(inventory)
    && (state.gearOwned === undefined || Array.isArray(state.gearOwned));
  const missingCoins = Math.max(0, recipe.coins - (amount(state?.coins) ? state.coins : 0));
  const missing = materials.filter(item => item.missing);
  const message = !valid ? 'Your coins or inventory could not be read.'
    : owned ? `${GEAR[id].name} is already in your wardrobe.`
    : missingCoins ? `Save ${missingCoins} more coins to craft ${GEAR[id].name.toLowerCase()}.`
    : missing.length ? `Bring ${missing.map(item => `${item.missing} ${ITEMS[item.id].name.toLowerCase()}`).join(', ')}.`
    : `Ready to craft ${GEAR[id].name.toLowerCase()}.`;
  return { ok: valid && !owned && !missingCoins && !missing.length, recipe, owned, missingCoins, materials, message };
}

/** Pay and grant once, only after every requirement passes; equipping remains a wardrobe action. */
export function craft(state, id) {
  const status = craftStatus(state, id);
  if (!status.ok) return { ok: false, message: status.message };
  const recipe = status.recipe;
  if (!grantGear(state, recipe.result)) return { ok: false, message: 'That is already in your wardrobe.' };
  state.coins -= recipe.coins;
  for (const { id: item, need } of status.materials) {
    state.inventory[item] -= need;
    if (!state.inventory[item]) delete state.inventory[item];
  }
  return { ok: true, id: recipe.result, message: `${GEAR[recipe.result].name} crafted. Find it in your wardrobe.` };
}
