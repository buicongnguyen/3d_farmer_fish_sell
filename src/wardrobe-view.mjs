// The bedroom wardrobe, after Zoo Garden's bag in wardrobe mode (cute_game src/main.ts inventory(), item-groups.ts,
// item-power.ts, try-on.ts): a small mirror with your character, the numbers your gear adds up to, the five worn slots
// (tap ✕ to take one off), then everything you own in labelled groups ("🎩 Hats · 4"), each from the weakest to the
// strongest, with Try on and Wear. The garments (garments-view.mjs) come first, and the Colour row dyes them. The Finch atelier's "Hats & gear" tab uses the
// same rows with prices.
//
//   wardrobeHtml(state, {tryId, folded, iconUrl})   the wardrobe panel body (pure string)
//   gearShopHtml(state, {tryId, folded, iconUrl})   the atelier tab body (pure string; shop-view.mjs)
//   const wardrobe = installWardrobe(world, {state, act, panel, render, openShop})   once (main.mjs)
//   wardrobe.panel() -> {title, kicker, html, cls}; wardrobe.paint() after it is in the page
//
// Buttons: data-gear-try="<id>" (toggle a try-on: shown on the character, never saved), data-gear-action="unequip"
// data-slot, data-gear-action="fold" data-group, data-gear-action="shop"; buying and wearing use main.mjs's
// data-action="do" data-type="buyGear|equip|outfit" data-id.
import * as content from './content.mjs';
import { GEAR, GEAR_SLOTS, SLOT_ICONS, SLOT_NAMES, gearGroups, gearOf, gearStats, perkLabels, powerLabel, previewGear, wearing } from './gear.mjs';
import { avatarAssets, buildAvatar, playerWants, restPose, styleKey } from './avatar.mjs';
import { MirrorPreview, mirrorHtml } from './mirror-view.mjs';
import { garmentOf, ui } from './garments.mjs';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const coin = '<i class="sv-coin" aria-hidden="true"></i>';
const icon = (id, iconUrl) => `<span class="shop-icon"><img src="${esc(iconUrl(GEAR[id].icon))}" alt="" loading="lazy" draggable="false"></span>`;
const chips = id => `<span class="chips"><span class="chip chip-power">${powerLabel(id)}</span>${perkLabels(id).map(p => `<span class="chip">${p}</span>`).join('')}</span>`;
const tryButton = (id, tryId) => `<button class="soft-button try-on" data-gear-try="${id}" aria-pressed="${tryId === id}">${tryId === id ? '👀 Trying on' : '👕 Try on'}</button>`;
/** A labelled, foldable group (cute_game item-groups.ts groupedHtml). */
export function group(panel, id, title, count, body, folded) {
  const shut = folded?.has(`${panel}:${id}`);
  return `<section class="item-group${shut ? ' folded' : ''}" data-group="${id}"><h4 class="item-group-head"><button type="button" data-gear-action="fold" data-group="${panel}:${id}" aria-expanded="${!shut}">${title} · ${count}</button></h4><div class="shop-list">${body}</div></section>`;
}
/** One owned piece: icon, name, its numbers, Try on and Wear (or Take off while worn). */
function ownedRow(s, id, tryId, iconUrl) {
  const it = GEAR[id], on = wearing(s, id);
  const actions = on ? `<button class="soft-button" data-gear-action="unequip" data-slot="${it.slot}">Take off</button>`
    : `${tryButton(id, tryId)}<button class="sky-button equip-btn" data-action="do" data-type="equip" data-id="${id}">Wear</button>`;
  return `<div class="shop-item${on ? ' is-worn' : ''}" data-gear="${id}">${icon(id, iconUrl)}<div><strong>${esc(it.name)}</strong>${on ? '<span class="chip equipped is-worn">✓ Wearing</span>' : ''}${chips(id)}</div><div class="button-row">${actions}</div></div>`;
}
/** One piece at the atelier: its price, or Wear once owned. */
function shopRow(s, id, tryId, iconUrl) {
  const it = GEAR[id], owned = !!s.gearOwned?.includes(id), on = wearing(s, id), poor = (s.coins ?? 0) < it.price;
  const actions = (on ? '' : tryButton(id, tryId)) + (on ? '<button class="primary" disabled>Wearing</button>' : owned ? `<button class="sky-button equip-btn" data-action="do" data-type="equip" data-id="${id}">Wear</button>` : `<button class="primary price-btn${poor ? ' cant-afford' : ''}" data-action="do" data-type="buyGear" data-id="${id}">${coin}<b>${it.price}</b></button>`);
  return `<div class="shop-item${on ? ' is-worn' : owned ? ' is-owned' : ''}" data-gear="${id}">${icon(id, iconUrl)}<div><strong>${esc(it.name)}</strong>${on ? '<span class="chip equipped is-worn">✓ Wearing</span>' : owned ? '<span class="chip equipped">✓ Owned</span>' : ''}${chips(id)}</div><div class="button-row">${actions}</div></div>`;
}
const pct = v => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;
/** "❤️ 135 ⚔️ 16 🛡️ 21 💨 +12% ✨ 8%": what the worn (or tried-on) gear adds up to. */
export function statStripHtml(stats) {
  return `<div class="stat-strip"><span title="Health">❤️ <b>${Math.round(stats.maxHp)}</b></span><span title="Attack">⚔️ <b>${Math.round(stats.attack)}</b></span><span title="Defence">🛡️ <b>${Math.round(stats.defense)}</b></span><span title="Speed">💨 <b>${pct(stats.speed - 1)}</b></span><span title="Critical hits">✨ <b>${Math.round(stats.crit * 100)}%</b></span>${stats.regen ? `<span title="Regeneration">💗 <b>+${stats.regen}/s</b></span>` : ''}</div>`;
}
/** The atelier's gear tab: every piece in labelled groups, weakest to strongest. */
export function gearShopHtml(s, { tryId = '', folded = null, iconUrl = content.iconUrl } = {}) {
  return gearGroups(Object.keys(GEAR)).map(g => group('shop', g.id, `${g.icon} ${g.label}`, g.ids.length, g.ids.map(id => shopRow(s, id, tryId, iconUrl)).join(''), folded)).join('');
}
/** The wardrobe: mirror, numbers, worn slots, then what you own in groups. */
export function wardrobeHtml(s, { tryId = '', tryGarment = '', folded = null, iconUrl = content.iconUrl } = {}) {
  const worn = gearOf(s), shown = GEAR[tryId] ? previewGear(worn, tryId) : worn, stats = gearStats({ gear: shown });
  const slots = GEAR_SLOTS.map(slot => {
    const id = worn[slot], it = GEAR[id];
    return it ? `<div class="wd-slot worn" title="${esc(it.name)}"><img src="${esc(iconUrl(it.icon))}" alt="" draggable="false"><small>${esc(it.name)}</small><button class="wd-off" data-gear-action="unequip" data-slot="${slot}" aria-label="Take off ${esc(it.name)}">✕</button></div>`
      : `<div class="wd-slot empty"><b aria-hidden="true">${SLOT_ICONS[slot]}</b><small>${SLOT_NAMES[slot]}</small></div>`;
  }).join('');
  const owned = (s.gearOwned ?? []).filter(id => GEAR[id]), cloth = content.OUTFITS.find(o => o.id === (tryGarment || s.outfit));
  const clothes = cloth && !worn.wear ? `<div class="wd-slot worn" title="${esc(cloth.name)}"><img src="${esc(iconUrl('items/' + garmentOf(cloth.id)))}" alt="" draggable="false"><small>${esc(cloth.name)}</small></div>` : '<div class="wd-slot empty"><b aria-hidden="true">👗</b><small>Clothes</small></div>';
  const note = s.pandora ? 'Pandora’s box is open: these numbers count out in the wild.' : 'Gear always shows on you. Its numbers only count while Pandora’s box is open.';
  return `<div class="wd-top">${mirrorHtml('wardrobe')}<div class="wd-side">${statStripHtml(stats)}<div class="wd-slots">${clothes}${slots}</div><p class="wd-note">${GEAR[tryId] ? `Trying on <b>${esc(GEAR[tryId].name)}</b>. ` : cloth && tryGarment ? `Trying on <b>${esc(cloth.name)}</b>. ` : ''}${note}</p></div></div>`
    + (ui.view ? ui.view.colourRowHtml(s) + ui.view.clothesHtml(s, { tryGarment, folded, iconUrl }) : '')
    + (owned.length ? gearGroups(owned).map(g => group('wardrobe', g.id, `${g.icon} ${g.label}`, g.ids.length, g.ids.map(id => ownedRow(s, id, tryId, iconUrl)).join(''), folded)).join('')
      : '<div class="empty-state wd-empty"><span>🧵</span><strong>Hats, costumes, boots and little companions will hang here.</strong><p>Iris sells them at the Finch atelier’s stall, beside the village market.</p></div>')
    + '<button class="soft-button wd-shop" data-gear-action="shop">🧵 Order from the Finch atelier</button>';
}

const FOLD_KEY = 'willowmere.folded-groups';
export function installWardrobe(world, deps) {
  if (world.__wardrobe) return world.__wardrobe;
  const preview = new MirrorPreview(world, { reach: 3.75, width: 132, height: 188 });
  let folded = new Set();
  try { const raw = JSON.parse(localStorage.getItem(FOLD_KEY) ?? '[]'); if (Array.isArray(raw)) folded = new Set(raw.filter(v => typeof v === 'string')); } catch { /* a per-device convenience only */ }
  const s = () => deps.state(), shows = () => deps.panel() === 'wardrobe' || (deps.panel() === 'shop' && !!document.querySelector('#modal [data-shop-tab="gear"]'));
  const tryId = () => world.tryOn?.gearId ?? '', tryGarment = () => world.tryOn?.garmentId ?? '';
  function panel() { return { title: 'Your wardrobe', kicker: 'WHAT TO WEAR TODAY', html: wardrobeHtml(s(), { tryId: tryId(), tryGarment: tryGarment(), folded }), cls: 'ref-menu wardrobe-modal' }; }
  const shopHtml = () => gearShopHtml(s(), { tryId: tryId(), folded });
  /** Draws the wardrobe's mirror: you in what you wear, or in what you are trying on. */
  function paint() {
    const slot = document.querySelector('[data-mirror-slot="wardrobe"]'); if (!slot) return;
    const wants = playerWants(world), waiting = avatarAssets(world, wants);
    preview.show(slot, styleKey(wants) + (waiting ? '|loading' : ''), () => restPose(buildAvatar(world, wants)));
    waiting?.then(() => { if (document.querySelector('[data-mirror-slot="wardrobe"]')) paint(); });
  }
  function tryOn(id) {
    const it = GEAR[id]; if (!it) return;
    world.setTryOn(tryId() === id ? null : { gear: previewGear(gearOf(s()), id), gearId: id });
  }
  /** Trying a garment on: the worn clothes with that one instead (a costume would cover it, so it comes off for the try-on). */
  function tryClothes(id) { world.setTryOn(id ? { gear: { ...gearOf(s()), wear: '' }, garment: garmentOf(id), garmentId: id } : null); }
  document.addEventListener('click', e => {
    if (!shows()) return;
    const g = e.target.closest?.('[data-garment-try]');
    if (g) { tryClothes(tryGarment() === g.dataset.garmentTry ? null : g.dataset.garmentTry); deps.render(); return; }
    const t = e.target.closest?.('[data-gear-try]');
    if (t) { tryOn(t.dataset.gearTry); deps.render(); return; }
    const b = e.target.closest?.('[data-gear-action]');
    if (b) {
      const action = b.dataset.gearAction;
      if (action === 'fold') { const key = b.dataset.group; if (folded.has(key)) folded.delete(key); else folded.add(key); try { localStorage.setItem(FOLD_KEY, JSON.stringify([...folded])); } catch { /* fine */ } deps.render(); }
      else if (action === 'unequip') { if (world.tryOn) world.setTryOn(null); deps.act('unequip', { slot: b.dataset.slot }); }
      else if (action === 'shop') deps.openShop?.();
      return;
    }
    // Bought or put on (main.mjs ran the action): the try-on ends, so the character shows what is really worn.
    const done = e.target.closest?.('[data-action="do"][data-type="buyGear"], [data-action="do"][data-type="equip"], [data-action="do"][data-type="outfit"]');
    if (done && world.tryOn) { world.setTryOn(null); deps.render(); }
  });
  return world.__wardrobe = { panel, paint, shopHtml, preview, tryId, tryClothes };
}
