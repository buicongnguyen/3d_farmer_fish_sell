// The basket, in the reference's grouped tiles (cute_game src/main.ts inventory() + item-groups.ts): one small header
// per kind of thing ("🥕 Harvest · 3") and, inside each group, compact tiles from the least to the most valuable.
// Meals come first (you eat them), then what you sell, then seeds.
//
//   bagHtml(state, {art, itemName, sellPrice})   the panel body (pure string)
//     art(id)                 -> the item's picture markup (main.mjs img())
//     itemName(id), sellPrice(state, id)   game.mjs
// Buttons keep main.mjs's attributes: data-action="do" data-type="eat" data-id="<meal>".
import { CROPS, ITEMS, TREES } from './content.mjs';
import { FISH_POOLS } from './pond.mjs';

export const BAG_GROUPS = [['meal', '🍲', 'Meals'], ['harvest', '🥕', 'Harvest'], ['fish', '🐟', 'Fish'], ['pantry', '🧺', 'Pantry & finds'], ['seed', '🌱', 'Seeds']];
const FISH = [...new Set(FISH_POOLS.flat())];
/** Which group an inventory id belongs to. */
export function bagGroupOf(id) {
  if (id.startsWith('seed_')) return 'seed';
  if (ITEMS[id]?.energy) return 'meal';
  if (CROPS[id] || TREES[id]) return 'harvest';
  if (FISH.includes(id)) return 'fish';
  return 'pantry';
}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** The basket's groups: [{id, icon, label, entries: [[itemId, count], …]}], empty groups left out, cheapest first. */
export function bagGroups(s, sellPrice = () => 0) {
  const worth = id => id.startsWith('seed_') ? CROPS[id.slice(5)]?.price ?? 0 : sellPrice(s, id);
  const entries = Object.entries(s.inventory ?? {}).filter(([, n]) => n > 0);
  return BAG_GROUPS.map(([id, icon, label]) => ({ id, icon, label, entries: entries.filter(([item]) => bagGroupOf(item) === id).sort((a, b) => worth(a[0]) - worth(b[0]) || (a[0] < b[0] ? -1 : 1)) })).filter(g => g.entries.length);
}
export function bagHtml(s, { art, itemName, sellPrice }) {
  const groups = bagGroups(s, sellPrice);
  const tile = ([id, n]) => {
    const energy = ITEMS[id]?.energy, seed = id.startsWith('seed_'), price = seed ? 0 : sellPrice(s, id);
    return `<article class="item-card bag-tile">${art(id)}<span class="quantity">×${n}</span><h3>${esc(itemName(id))}</h3><p>${seed ? 'Plant in a bed' : `<i class="sv-coin" aria-hidden="true"></i>${price} each`}${energy ? ` · ⚡ +${energy}` : ''}</p>${energy ? `<button class="small-button" data-action="do" data-type="eat" data-id="${id}">Eat</button>` : ''}</article>`;
  };
  const body = groups.map(g => `<section class="item-group" data-group="${g.id}"><h4 class="item-group-head"><span>${g.icon} ${g.label} · ${g.entries.length}</span></h4><div class="card-grid bag-grid">${g.entries.map(tile).join('')}</div></section>`).join('');
  return `<p class="panel-intro">Keep ingredients for supper, or bring your harvest to the village market.</p>${body || '<div class="card-grid"><div class="empty-state">Your next little adventure will fill this basket.</div></div>'}<div class="note">Your rod and watering can are always with you. Seeds and furniture stay safe when you sell produce.</div>`;
}
