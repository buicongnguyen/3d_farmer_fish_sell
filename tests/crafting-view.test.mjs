import test from 'node:test';
import assert from 'node:assert/strict';
import { renderCrafting, craft } from '../src/crafting-view.mjs';
import { CRAFT_RECIPES, CRAFT_CATEGORIES } from '../src/crafting.mjs';
import { ITEMS } from '../src/content.mjs';

const state = () => ({ coins: 1000, gearOwned: [], inventory: Object.fromEntries(CRAFT_RECIPES.flatMap(r => Object.keys(r.materials)).map(id => [id, 100])) });
const buttons = html => [...html.matchAll(/<button\b[^>]*data-action="craft"[^>]*>/g)].map(m => m[0]);

test('crafting filters recipes accessibly, falls back to all and never mutates state', () => {
  const s = state(), before = structuredClone(s), all = renderCrafting(s);
  assert.equal(buttons(all).length, CRAFT_RECIPES.length); assert.ok(buttons(all).every(button => !button.includes('disabled')));
  assert.match(all, /aria-pressed="true" data-action="craftCategory" data-id="all"/);
  assert.match(all, /wardrobe; equip it there/); assert.match(all, /stats apply while Pandora’s box is open/);
  for (const category of CRAFT_CATEGORIES) {
    const html = renderCrafting(s, category.id), recipes = CRAFT_RECIPES.filter(r => r.category === category.id);
    assert.equal(buttons(html).length, recipes.length);
    for (const recipe of recipes) assert.ok(html.includes(`data-recipe="${recipe.id}"`));
    assert.ok(html.includes(`aria-pressed="true" data-action="craftCategory" data-id="${category.id}"`));
  }
  assert.equal(renderCrafting(s, 'unknown'), all); assert.deepEqual(s, before);
});

test('missing ingredients and coins show have/need counts and disable crafting; ownership stays visible', () => {
  const recipe = CRAFT_RECIPES.find(r => r.id === 'sword_obsidian'), s = state();
  s.coins = recipe.coins - 7; s.inventory.obsidian = recipe.materials.obsidian - 1;
  let html = renderCrafting(s, recipe.category), button = buttons(html).find(b => b.includes(`data-id="${recipe.id}"`));
  assert.ok(button.includes('disabled')); assert.match(html, /3 \/ 4/); assert.match(html, /need 1 more/); assert.match(html, /need 7 more/);
  s.coins = 1000; s.inventory.obsidian = 100; assert.equal(craft(s, recipe.id).ok, true);
  html = renderCrafting(s, recipe.category); button = buttons(html).find(b => b.includes(`data-id="${recipe.id}"`));
  assert.ok(button.includes('disabled')); assert.match(html, /✓ Owned/); assert.match(html, /already in your wardrobe/);
});

test('material labels are escaped and arbitrary category input cannot become HTML', () => {
  const original = ITEMS.wood.name;
  try {
    ITEMS.wood.name = '<img src=x onerror="bad()"> & timber';
    const html = renderCrafting(state(), '<script>bad()</script>');
    assert.ok(!html.includes('<script>')); assert.ok(!html.includes('<img src=x'));
    assert.ok(html.includes('&lt;img src=x onerror=&quot;bad()&quot;&gt; &amp; timber'));
  } finally { ITEMS.wood.name = original; }
});
