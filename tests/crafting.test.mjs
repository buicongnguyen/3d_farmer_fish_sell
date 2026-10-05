import test from 'node:test';
import assert from 'node:assert/strict';
import { CRAFT_CATEGORIES, CRAFT_RECIPES, craftStatus, craft } from '../src/crafting.mjs';
import { ITEMS } from '../src/content.mjs';
import { GEAR, gearStats } from '../src/gear.mjs';
import { freshState, parseSave, act, sellPrice } from '../src/game.mjs';
import { LOOT } from '../src/pandora.mjs';

const stocked = id => {
  const recipe = CRAFT_RECIPES.find(r => r.id === id), state = freshState();
  state.coins = recipe.coins;
  state.inventory = { ...recipe.materials };
  return state;
};

test('reference crafting outputs already have gear assets and use obtainable local materials', () => {
  const ids = CRAFT_RECIPES.map(r => r.id), categories = CRAFT_CATEGORIES.map(c => c.id);
  assert.equal(new Set(ids).size, 14);
  const obtainable = new Set(['wood', ...Object.values(LOOT).flatMap(table => table.map(([id]) => id))]);
  for (const recipe of CRAFT_RECIPES) {
    assert.equal(recipe.result, recipe.id); assert.ok(GEAR[recipe.result]); assert.ok(categories.includes(recipe.category));
    assert.ok(Number.isSafeInteger(recipe.coins) && recipe.coins > 0);
    assert.ok(Object.keys(recipe.materials).length > 0);
    for (const [id, count] of Object.entries(recipe.materials)) {
      assert.ok(ITEMS[id] && obtainable.has(id), `${recipe.id}: ${id} is an existing obtainable material`);
      assert.ok(Number.isSafeInteger(count) && count > 0);
    }
    assert.equal(ITEMS[recipe.result], undefined, 'crafted gear cannot be resold as basket stock');
    assert.ok(Object.isFrozen(recipe) && Object.isFrozen(recipe.materials));
  }
  assert.deepEqual(ids.filter(id => GEAR[id].slot === 'pet').sort(), ['pet_dragon', 'pet_firefly', 'pet_parrot', 'pet_robot', 'pet_sheep', 'pet_turtle']);
  assert.ok(categories.every(category => CRAFT_RECIPES.some(r => r.category === category)));
});

test('fees plus the best material sale value give a meaningful discount from buying gear', () => {
  const state = freshState(); state.upgrades.kitchen = 3;
  for (const recipe of CRAFT_RECIPES) {
    const cost = recipe.coins + Object.entries(recipe.materials).reduce((sum, [id, n]) => sum + sellPrice(state, id, true) * n, 0);
    assert.ok(cost >= GEAR[recipe.result].price * .8 && cost <= GEAR[recipe.result].price * .86,
      `${recipe.id}: materials plus fee ${cost}, atelier ${GEAR[recipe.result].price}`);
  }
});

test('eligibility reports missing coins and each ingredient without changing state', () => {
  const state = freshState(); state.coins = 15; state.inventory = { amber: 1, wood: 1 };
  const before = structuredClone(state), status = craftStatus(state, 'armor_leaf');
  assert.equal(status.ok, false); assert.equal(status.missingCoins, 25);
  assert.deepEqual(status.materials, [{ id: 'amber', have: 1, need: 1, missing: 0 }, { id: 'wood', have: 1, need: 3, missing: 2 }]);
  assert.deepEqual(state, before);
});

test('failed crafts never charge coins, consume materials, or grant ownership', () => {
  for (const setup of [s => { s.coins--; }, s => { delete s.inventory.obsidian; }, s => { s.inventory.obsidian = .5; }, s => { s.coins = NaN; }]) {
    const state = stocked('boots_lava'); setup(state); const before = structuredClone(state);
    assert.equal(craft(state, 'boots_lava').ok, false); assert.deepEqual(state, before);
  }
  for (const id of ['', 'imaginary', '__proto__', 'constructor', 'toString', 'hat_straw', null, 3, {}]) {
    const state = stocked('boots_lava'), before = structuredClone(state);
    assert.equal(craftStatus(state, id).recipe, null); assert.equal(craft(state, id).ok, false); assert.deepEqual(state, before);
  }
});

test('crafting consumes the listed ingredients once and grants unequipped gear that survives saving', () => {
  for (const recipe of CRAFT_RECIPES) {
    const state = stocked(recipe.id); state.coins += 9; state.inventory.carrot = 2; state.energy = 17;
    state.gearOwned = ['hat_straw']; state.gear.hat = 'hat_straw';
    const worn = structuredClone(state.gear), stats = gearStats(state);
    assert.deepEqual(craft(state, recipe.id), { ok: true, id: recipe.id, message: `${GEAR[recipe.id].name} crafted. Find it in your wardrobe.` });
    assert.equal(state.coins, 9); assert.deepEqual(state.inventory, { carrot: 2 }); assert.equal(state.energy, 17);
    assert.deepEqual(state.gear, worn); assert.deepEqual(gearStats(state), stats);
    assert.deepEqual(state.gearOwned, ['hat_straw', recipe.id]);
    const restored = parseSave(JSON.parse(JSON.stringify(state)));
    assert.deepEqual(restored.gearOwned, state.gearOwned); assert.deepEqual(restored.gear, worn);
    assert.deepEqual(restored.inventory, state.inventory); assert.equal(restored.coins, 9);
    assert.ok(act(restored, 'equip', { id: recipe.id }).ok);
    assert.equal(restored.gear[GEAR[recipe.id].slot], recipe.id, 'existing wardrobe action equips the crafted piece');
  }
});

test('partial ingredient balances remain and owned or repeated crafts cannot charge again', () => {
  const state = stocked('armor_wings'); state.coins += 50; state.inventory.obsidian += 2; state.inventory.hide++;
  assert.ok(craft(state, 'armor_wings').ok);
  assert.equal(state.coins, 50); assert.deepEqual(state.inventory, { obsidian: 2, hide: 1 });
  const before = structuredClone(state);
  assert.equal(craftStatus(state, 'armor_wings').owned, true);
  assert.equal(craft(state, 'armor_wings').ok, false); assert.deepEqual(state, before);
  const purchased = stocked('pet_robot'); purchased.gearOwned.push('pet_robot');
  const existing = structuredClone(purchased);
  assert.equal(craft(purchased, 'pet_robot').ok, false); assert.deepEqual(purchased, existing);
});
