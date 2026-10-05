// Willowmere shop panels in the Zoo Garden "Little outfitters" style (cute_game src/main.ts shop(), look-shop.ts,
// style.css .panel-tabs/.shop-item): pill category tabs with the active one in sunny yellow, big white item cards
// with an art tile, a green price pill, "✓ Owned / Wearing / At home" badges and an Equip/Wear button, and for
// clothes a fitting-room preview of your character that "Try on" recolours before you buy.
//
//   renderShop({state, tab, shopId, data, helpers}) -> {title, kicker, html, cls, tab, tabs}
//
//   state    the game state (coins, inventory, outfit, owned, body, kidOutfit, kidOwned, furniture, upgrades, bike, gear, gearOwned)
//   tab      the requested tab id ('seeds' | 'sell' | 'upgrades' | 'crafting' | 'outfits' | 'gear' | 'kids' | 'furniture'); a tab this
//            shop does not offer falls back to its first tab, and the tab used is returned as `tab`
//   shopId   main.mjs's panelArg: 'market' (or undefined) | 'supermarket' | 'clothes' | 'upgrades'
//   data     optional {CROPS, ITEMS, OUTFITS, KID_OUTFITS, FURNITURE, UPGRADES, iconUrl}; defaults to content.mjs
//   helpers  optional {sellPrice(state,id,premium), itemName(id)}; defaults to game.mjs (the supermarket pays the premium)
//
// Returns the modal title and kicker (same text as before, e.g. "The village market", "<n> COINS IN YOUR PURSE"),
// the body html, the modal class ('wide-modal shop-modal shop-<id>') and the tab list. main.mjs uses it as:
//   const v=renderShop({state:s,tab:shopTab,shopId:panelArg}); shopTab=v.tab; shell(v.title,v.kicker,v.html,v.cls);
//
// Every button keeps the old data attributes and meaning, so main.mjs's click handler and the tests work unchanged:
//   tabs        data-action="tab" data-id="<tab>"
//   seeds       data-action="do" data-type="buySeed" data-id="<crop>"
//   sell        data-action="sell" data-id="<item>" data-one="true" (one) · data-action="sell" data-id="<item>" (all of
//               it) · data-action="sell" (everything; disabled when the basket is worth nothing)
//   upgrades    data-action="do" data-type="upgrade" data-id="<id>" (disabled at tier 3) · data-type="bike" (disabled when owned)
//   outfits     the real garments (garments-view.mjs): data-action="do" data-type="outfit" data-id (disabled while worn), the Colour
//               row (data-type="tint") and a picture of each; the body picker lives in the mirror's Body row only
//   kids        data-action="do" data-type="kidOutfit" data-id
//   furniture   data-action="do" data-type="furniture" data-id (disabled when at home)
// "Try on" buttons use data-shop-try (no data-action, so main.mjs ignores them); a document listener that renderShop()
// installs once reports them to installShopPreview({onTryOn}): the 3D character wears the garment, Pip's portrait changes.
import * as content from './content.mjs';
import * as game from './game.mjs';
import { ui } from './garments.mjs';
const LOADING = '<p class="panel-intro">Taking the clothes off their hangers…</p>';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TAB_NAMES = { seeds: 'Seeds', sell: 'Sell produce', upgrades: 'Improvements', crafting: 'Crafting', outfits: 'Clothes', gear: 'Hats & gear', kids: 'For Pip', furniture: 'Furniture' };
const TAB_ICONS = { seeds: '🌱', sell: '🧺', upgrades: '🔨', crafting: '🛠️', outfits: '👗', gear: '🎩', kids: '🎀', furniture: '🛋️' };
/** The shops: which tabs each offers (same lists and labels as main.mjs had), its title and its look. */
export const SHOPS = {
  market: { title: 'The village market', icon: '👩‍🌾', tone: 'market', keeper: 'Harvest market', blurb: 'Seeds for your beds, coins for your basket, and something nice for home.', tabs: [['seeds', 'Seeds'], ['sell', 'Sell produce'], ['upgrades', 'Improvements'], ['outfits', 'Clothes'], ['kids', 'For Pip'], ['furniture', 'Furniture']] },
  // The hillside traders' country market moved into town: the big shop east of Willow & Co., with the same better prices.
  supermarket: { title: 'Willowmere Supermarket', icon: '🛒', tone: 'super', keeper: 'Hillside traders', blurb: 'The hillside traders moved into town, and they still pay 25% more for village produce.', tabs: [['sell', 'Sell produce'], ['seeds', 'Seeds']] },
  clothes: { title: 'The Finch atelier', icon: '🧵', tone: 'atelier', keeper: 'Iris & Leo', blurb: 'Iris sews real clothes for every season. Try a look on before you buy it.', tabs: [['outfits', 'Clothes'], ['gear', 'Hats & gear'], ['kids', 'For Pip']] },
  upgrades: { title: 'The Vale workshop', icon: '🪚', tone: 'workshop', keeper: 'Ash & Fern', blurb: 'Ash and Fern turn your gathered materials into equipment and companions, and build improvements for your home.', tabs: [['upgrades', 'Improvements'], ['crafting', 'Crafting'], ['furniture', 'Furniture']] },
};
export const shopOf = shopId => SHOPS[shopId] ?? SHOPS.market;

const btn = (text, action, data = '', cls = '') => `<button class="${cls}" data-action="${action}" ${data}>${text}</button>`;
const coin = '<i class="sv-coin" aria-hidden="true"></i>';
const price = n => `${coin}<b>${n}</b>`;
const badge = (text, kind = 'owned') => `<span class="chip equipped is-${kind}">${text}</span>`;
function art(item, iconUrl, cls = 'shop-icon') {
  if (item?.img) return `<span class="${cls}"><img src="${item.img}" alt="" draggable="false"></span>`;
  return item?.icon ? `<span class="${cls}"><img src="${esc(iconUrl(item.icon))}" alt="" loading="lazy" draggable="false"></span>` : `<span class="${cls}">${item?.emoji ?? '🌿'}</span>`;
}
function card({ artHtml, name, count = '', chips = '', desc = '', actions = '', state = '' }) {
  return `<div class="shop-item${state ? ' ' + state : ''}">${artHtml.replace('class="sv-art', 'class="shop-icon')}<div><strong>${esc(name)}${count ? ` <small>${count}</small>` : ''}</strong>${chips ? `<span class="chips">${chips}</span>` : ''}${desc}</div><div class="button-row">${actions}</div></div>`;
}
const chip = (text, kind = '') => `<span class="chip${kind ? ' ' + kind : ''}">${text}</span>`;

/** Renders one shop panel; see the comment at the top of this file. */
export function renderShop({ state, tab, shopId, data = {}, helpers = {} } = {}) {
  ensurePreview();
  const s = state, D = { ...content, ...data }, H = { sellPrice: game.sellPrice, itemName: game.itemName, ...helpers };
  const { CROPS, ITEMS, OUTFITS, KID_OUTFITS, FURNITURE, UPGRADES, iconUrl } = D;
  const shop = shopOf(shopId), country = shopId === 'supermarket', tabs = shop.tabs;
  if (!tabs.some(([id]) => id === tab)) tab = tabs[0][0];
  const afford = n => (s.coins ?? 0) >= n ? '' : ' cant-afford';
  let body = '';

  if (tab === 'seeds') {
    body = `<div class="shop-list">${Object.entries(CROPS).map(([id, c]) => {
      const have = s.inventory?.['seed_' + id] ?? 0;
      return card({ artHtml: art(c, iconUrl), name: c.name, count: have ? `×${have} seeds` : '', chips: chip(`🌾 ${c.yield} a bed`) + chip(`${coin}${c.sell} each`, 'gold') + chip(`⏱ ${c.grow}s`),
        desc: `<p>Harvest ${c.yield} · sell ${c.sell} each</p>`, actions: c.free ? badge('🌸 Free cuttings · plant in any bed') : btn(price(c.price * 3) + ' · 3 seeds', 'do', `data-type="buySeed" data-id="${id}"`, 'primary price-btn' + afford(c.price * 3)) });
    }).join('')}</div><div class="note sv-note">🌳 Fruit trees need no seeds: clear a village tree and plant one on its stump, or use the three circles south of your garden.</div>`;
  }
  if (tab === 'sell') {
    const produce = Object.entries(s.inventory ?? {}).filter(([id, n]) => ITEMS[id] && n > 0), each = id => H.sellPrice(s, id, country);
    const total = produce.reduce((n, [id, q]) => n + each(id) * q, 0);
    body = `<p class="panel-intro">${country ? 'The supermarket pays 25% more for your village produce.' : 'Fresh from your little farm. Thank you for growing with us.'} Selling all includes cooked meals; keep any recipe ingredients you need.</p>`
      + `<div class="sell-all-row">${btn(`Sell all produce → ${coin}<b>${total}</b>`, 'sell', total ? '' : 'disabled', 'primary sell-produce')}</div>`
      + `<div class="shop-list sv-sell">${produce.map(([id, n]) => card({ artHtml: art(ITEMS[id], iconUrl), name: H.itemName(id), count: `×${n}`, chips: chip(`${coin}${each(id)} each`, 'gold') + (ITEMS[id].energy ? chip(`⚡ +${ITEMS[id].energy}`) : ''),
        desc: `<p>${n} in your basket · ${each(id)} coins each</p>`, actions: btn('Sell 1', 'sell', `data-id="${id}" data-one="true"`, 'soft-button') + btn(`Sell ${n} · ${n * each(id)}`, 'sell', `data-id="${id}"`, 'primary price-btn') })).join('')
      || '<div class="empty-state sv-empty"><span>🌾</span><strong>Your first harvest will look lovely here.</strong><p>Bring crops, fish, eggs or a home-cooked dish to sell.</p></div>'}</div>`;
  }
  if (tab === 'upgrades') {
    body = `<div class="shop-list sv-wide">${Object.entries(UPGRADES).map(([id, u]) => {
      const level = s.upgrades?.[id] ?? 0, done = level >= 3;
      return card({ artHtml: art(u, iconUrl), name: u.name, state: done ? 'is-owned' : '',
        chips: `<span class="eyebrow">TIER ${level} / 3</span><span class="tier-dots sv-dots">${[0, 1, 2].map(n => `<i class="${level > n ? 'filled' : ''}"></i>`).join('')}</span>`,
        desc: `<p>${esc(u.desc[level] ?? 'A little dream, fully grown.')}</p>`,
        actions: (done ? badge('✓ Complete') : '') + btn(done ? 'Complete' : price(u.cost[level]), 'do', `data-type="upgrade" data-id="${id}" ${done ? 'disabled' : ''}`, 'primary price-btn' + (done ? '' : afford(u.cost[level]))) });
    }).join('')}${H.bedCount ? (() => { const beds = H.bedCount(s), full = beds >= 30, cost = H.plotCost(s); return card({ artHtml: '<span class="shop-icon">🧺</span>', name: 'Expand the fields', state: full ? 'is-owned' : '', chips: `<span class="eyebrow">${beds} / 30 BEDS</span>`, desc: '<p>Turn two more garden beds, a little at a time. Clear nearby trees to open up your land.</p>', actions: btn(full ? 'Complete' : price(cost), 'do', `data-type="plot" ${full ? 'disabled' : ''}`, 'primary price-btn' + (full ? '' : afford(cost))) }); })() : ''}${card({ artHtml: '<span class="shop-icon">🛵</span>', name: 'A little motorcycle', state: s.bike ? 'is-owned' : '', chips: '<span class="eyebrow">THE OPEN ROAD</span>',
      desc: '<p>Parked beside the Bell garage. Yours for every adventure.</p>', actions: (s.bike ? badge('✓ Owned') : '') + btn(s.bike ? 'Owned' : price(350), 'do', `data-type="bike" ${s.bike ? 'disabled' : ''}`, 'primary price-btn' + (s.bike ? '' : afford(350))) })}</div>`;
  }
  if (tab === 'outfits') body = ui.view?.shopOutfitsHtml(s, D) ?? LOADING; // the real garments (garments-view.mjs)
  if (tab === 'crafting') body = H.craftingHtml ?? '<p class="panel-intro" role="status">Opening the recipe book…</p>';
  if (tab === 'gear') {
    // Hats, outfits, boots, weapons and pets from the reference's outfitters (gear.mjs), in groups from the weakest to the
    // strongest. helpers.gearHtml is the wardrobe's own rendering (it knows what is being tried on and which groups are folded).
    body = `<div class="owl-note look-note"><span>🎩</span><p><strong>Hats &amp; gear</strong>Try a piece on to see it on your character. What you buy hangs in your wardrobe at home.</p></div>`
      + (H.gearHtml ?? ''); // the wardrobe's own rendering (wardrobe-view.mjs, loaded after the first frame)
  }
  if (tab === 'kids') body = ui.view?.shopKidsHtml(s, D) ?? LOADING;
  if (tab === 'furniture') {
    body = `<p class="panel-intro">Made here, made to keep. Every piece is delivered straight to a cosy spot in your home.</p><div class="shop-list">${FURNITURE.map(f => {
      const home = (s.furniture ?? []).includes(f.id);
      return card({ artHtml: art(f, iconUrl), name: f.name, state: home ? 'is-owned' : '', chips: home ? badge('✓ At home') : '',
        desc: `<p>${esc(f.desc ?? '')}</p>`, actions: btn(home ? 'At home' : price(f.price), 'do', `data-type="furniture" data-id="${f.id}" ${home ? 'disabled' : ''}`, 'primary price-btn' + (home ? '' : afford(f.price))) });
    }).join('')}</div>`;
  }

  const tabBar = `<nav class="tabs sv-tabs" aria-label="Shop categories">${tabs.map(([id, name]) => `<button class="${tab === id ? 'active' : ''}" aria-pressed="${tab === id}" data-action="tab" data-id="${id}"><span aria-hidden="true">${TAB_ICONS[id] ?? '•'}</span>${esc(name)}</button>`).join('')}</nav>`;
  const purse = tab === 'outfits' || tab === 'kids' || tab === 'gear' ? '' : `<div class="owl-note"><span aria-hidden="true">${shop.icon}</span><p><strong>${esc(shop.keeper ?? shop.title)}</strong>${esc(shop.blurb)}</p></div>`;
  return {
    title: shop.title, kicker: `$ ${(s.coins ?? 0).toLocaleString()} COINS IN YOUR PURSE`, tab, tabs: tabs.map(([id, name]) => ({ id, name, icon: TAB_ICONS[id] })),
    cls: `shop-modal ref-menu shop-${shop.tone}`, html: `${tabBar}${purse}<div class="shop-body" data-shop-tab="${tab}">${body}</div>`,
  };
}
/** Just the body html (tabs + cards), for callers that build their own shell. */
export const renderShopHtml = options => renderShop(options).html;
export { TAB_NAMES };

// ---------------------------------------------------------------- Try on (fitting-room preview)
let previewInstalled = false, previewCallback = null;
function onPreviewClick(e) {
  const b = e.target.closest?.('[data-shop-try]'); if (!b) return;
  const root = b.closest('#modal') ?? document, target = b.dataset.shopTarget;
  const fig = root.querySelector(`[data-shop-figure="${target}"]`), name = root.querySelector(`[data-shop-name="${target}"]`), on = b.getAttribute('aria-pressed') !== 'true';
  root.querySelectorAll(`[data-shop-try][data-shop-target="${target}"]`).forEach(x => { x.setAttribute('aria-pressed', 'false'); x.textContent = '👕 Try on'; });
  if (fig) { if (!fig.dataset.base) fig.dataset.base = fig.style.getPropertyValue('--shirt'); fig.style.setProperty('--shirt', on ? b.dataset.shopColor : fig.dataset.base); fig.classList.remove('sv-pop'); void fig.offsetWidth; fig.classList.add('sv-pop'); }
  if (name) { if (!name.dataset.base) name.dataset.base = name.textContent; name.textContent = on ? `Trying on · ${b.dataset.shopLabel}` : name.dataset.base; }
  if (on) { b.setAttribute('aria-pressed', 'true'); b.textContent = '👀 Trying on'; }
  fig?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  previewCallback?.(target, on ? b.dataset.shopColor : null, on ? b.dataset.shopTry : null);
}
function ensurePreview() {
  if (previewInstalled || typeof document === 'undefined') return;
  document.addEventListener('click', onPreviewClick); previewInstalled = true;
}
/**
 * "Try on" buttons recolour the fitting-room figure (local only, nothing is bought). renderShop() installs this once by
 * itself; call installShopPreview({onTryOn}) only to also preview on the 3D character:
 * onTryOn(target 'self'|'pip', color|null, outfitId|null) — null when the preview ends. Returns an uninstall function.
 */
export function installShopPreview({ onTryOn = null } = {}) {
  ensurePreview(); previewCallback = onTryOn;
  return () => { document.removeEventListener('click', onPreviewClick); previewInstalled = false; previewCallback = null; };
}
