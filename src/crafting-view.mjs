// Vale's crafting counter: pure HTML, using the shop's responsive cards and gear art.
import { CRAFT_CATEGORIES, CRAFT_RECIPES, craftStatus } from './crafting.mjs';
import { GEAR, SLOT_NAMES, powerLabel, perkLabels } from './gear.mjs';
import { ITEMS, iconUrl } from './content.mjs';
export { craft } from './crafting.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const categories = [{ id: 'all', label: 'All recipes', icon: '🔨' }, ...CRAFT_CATEGORIES];
const coin = '<i class="sv-coin" aria-hidden="true"></i>';

function recipeCard(state, recipe) {
  const item = GEAR[recipe.result], status = craftStatus(state, recipe.id), id = esc(recipe.id);
  const materials = status.materials.map(({ id, have, need, missing }) => `<p>${esc(ITEMS[id]?.name ?? id)} <span class="chip ${missing ? 'chip-miss' : 'equipped'}" aria-label="${esc(have)} of ${esc(need)} required">${esc(have)} / ${esc(need)}</span>${missing ? ` · need ${esc(missing)} more` : ' ✓'}</p>`).join('');
  const stats = [powerLabel(recipe.result), ...perkLabels(recipe.result)].filter(Boolean).map(label => `<span class="chip">${esc(label)}</span>`).join('');
  return `<div class="shop-item${status.owned ? ' is-owned' : ''}" data-gear="${esc(recipe.result)}" data-recipe="${id}">
    <span class="shop-icon"><img src="${esc(iconUrl(item.icon))}" alt="" loading="lazy" draggable="false"></span>
    <div><strong>${esc(item.name)}</strong>${status.owned ? '<span class="chip equipped">✓ Owned</span>' : ''}
      <p>${esc(item.desc ?? `${SLOT_NAMES[item.slot]} for your wardrobe.`)}</p>
      <span class="chips" aria-label="Adventuring stats">${stats}</span>
      <div class="shop-list" aria-label="Materials">${materials}<p><span class="chip ${status.missingCoins ? 'chip-miss' : 'gold'}">${coin}${esc(recipe.coins)} coins</span> fee${status.missingCoins ? ` · need ${esc(status.missingCoins)} more` : ''}</p><p id="craft-status-${id}">${esc(status.message)}</p></div>
    </div>
    <div class="button-row"><button type="button" class="primary" data-action="craft" data-id="${id}" aria-label="Craft ${esc(item.name)}" aria-describedby="craft-status-${id}"${status.ok ? '' : ' disabled'}>${status.owned ? 'Owned' : 'Craft'}</button></div>
  </div>`;
}

/** Category buttons use craftCategory; craft buttons use recipe ids. Rendering never changes state. */
export function renderCrafting(state, category = 'all') {
  if (!categories.some(c => c.id === category)) category = 'all';
  const rows = CRAFT_RECIPES.filter(recipe => category === 'all' || recipe.category === category);
  return `<section class="shop-body" aria-label="Workshop crafting">
    <p class="panel-intro">Combine gathered materials with a coin fee. Crafted gear stays in your wardrobe; equip it there. Adventuring stats apply while Pandora’s box is open.</p>
    <nav class="chips" aria-label="Crafting categories">${categories.map(c => `<button type="button" class="soft-button${category === c.id ? ' active' : ''}" aria-pressed="${category === c.id}" data-action="craftCategory" data-id="${esc(c.id)}"><span aria-hidden="true">${esc(c.icon)}</span> ${esc(c.label)}</button>`).join(' ')}</nav>
    <div class="shop-list">${rows.map(recipe => recipeCard(state, recipe)).join('') || '<p class="empty-state">No recipes in this category yet.</p>'}</div>
  </section>`;
}
