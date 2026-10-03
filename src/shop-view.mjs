// Willowmere shop panels in the Zoo Garden "Little outfitters" style (cute_game src/main.ts shop(), look-shop.ts,
// style.css .panel-tabs/.shop-item): pill category tabs with the active one in sunny yellow, big white item cards
// with an art tile, a green price pill, "✓ Owned / Wearing / At home" badges and an Equip/Wear button, and for
// clothes a fitting-room preview of your character that "Try on" recolours before you buy.
//
//   renderShop({state, tab, shopId, data, helpers}) -> {title, kicker, html, cls, tab, tabs}
//
//   state    the game state (coins, inventory, outfit, owned, body, kidOutfit, kidOwned, furniture, upgrades, bike)
//   tab      the requested tab id ('seeds' | 'sell' | 'upgrades' | 'outfits' | 'kids' | 'furniture'); a tab this
//            shop does not offer falls back to its first tab, and the tab used is returned as `tab`
//   shopId   main.mjs's panelArg: 'market' (or undefined) | 'country' | 'clothes' | 'upgrades'
//   data     optional {CROPS, ITEMS, OUTFITS, KID_OUTFITS, FURNITURE, UPGRADES, iconUrl}; defaults to content.mjs
//   helpers  optional {sellPrice(state,id,country), itemName(id)}; defaults to game.mjs
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
//   outfits     data-action="do" data-type="body" data-id="girl|boy" · data-type="outfit" data-id (disabled while worn)
//   kids        data-action="do" data-type="kidOutfit" data-id
//   furniture   data-action="do" data-type="furniture" data-id (disabled when at home)
// "Try on" buttons use data-shop-try (no data-action, so main.mjs ignores them); a document listener that renderShop()
// installs once recolours the fitting-room figure. installShopPreview({onTryOn}) can also tint the 3D character.
import * as content from './content.mjs';
import * as game from './game.mjs';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TAB_NAMES = { seeds: 'Seeds', sell: 'Sell produce', upgrades: 'Improvements', outfits: 'Outfits', kids: 'For Pip', furniture: 'Furniture' };
const TAB_ICONS = { seeds: '🌱', sell: '🧺', upgrades: '🔨', outfits: '👗', kids: '🎀', furniture: '🛋️' };
/** The shops: which tabs each offers (same lists and labels as main.mjs had), its title and its look. */
export const SHOPS = {
  market: { title: 'The village market', icon: '👩‍🌾', tone: 'market', blurb: 'Seeds for your beds, coins for your basket, and something nice for home.', tabs: [['seeds', 'Seeds'], ['sell', 'Sell produce'], ['upgrades', 'Improvements'], ['outfits', 'Outfits'], ['kids', 'For Pip'], ['furniture', 'Furniture']] },
  country: { title: 'The hillside market', icon: '🧑‍🌾', tone: 'country', blurb: 'The hillside traders pay 25% more for village produce.', tabs: [['sell', 'Trade basket'], ['seeds', 'Seeds']] },
  clothes: { title: 'The Finch atelier', icon: '🧵', tone: 'atelier', blurb: 'Iris sews a colour for every season. Try a look on before you buy it.', tabs: [['outfits', 'Your wardrobe'], ['kids', 'For Pip']] },
  upgrades: { title: 'The Vale workshop', icon: '🪚', tone: 'workshop', blurb: 'Ash and Fern build things to keep: better beds, a bigger home, furniture made by hand.', tabs: [['upgrades', 'Improvements'], ['furniture', 'Furniture']] },
};
export const shopOf = shopId => SHOPS[shopId] ?? SHOPS.market;

const btn = (text, action, data = '', cls = '') => `<button class="${cls}" data-action="${action}" ${data}>${text}</button>`;
const coin = '<i class="sv-coin" aria-hidden="true"></i>';
const price = n => `${coin}<b>${n}</b> coins`;
const badge = (text, kind = 'owned') => `<span class="sv-badge sv-${kind}">${text}</span>`;
function art(item, iconUrl, cls = 'sv-art') {
  if (item?.img) return `<span class="${cls}"><img src="${item.img}" alt="" draggable="false"></span>`;
  return item?.icon ? `<span class="${cls}"><img src="${esc(iconUrl(item.icon))}" alt="" loading="lazy" draggable="false"></span>` : `<span class="${cls} sv-emoji">${item?.emoji ?? '🌿'}</span>`;
}
/** A toy figure in an outfit colour: hair by body style, head, shirt with arms, trousers and shoes (CSS only). */
export function figure(color, { body = 'girl', child = false, id = '' } = {}) {
  return `<span class="sv-figure ${body === 'boy' ? 'boy' : 'girl'}${child ? ' child' : ''}" style="--shirt:${esc(color)}"${id ? ` data-shop-figure="${esc(id)}"` : ''} aria-hidden="true"><i class="hair"></i><i class="head"></i><i class="arm l"></i><i class="arm r"></i><i class="shirt"></i><i class="legs"></i><i class="shoe l"></i><i class="shoe r"></i></span>`;
}
function card({ artHtml, name, count = '', chips = '', desc = '', actions = '', state = '' }) {
  return `<article class="sv-card${state ? ' ' + state : ''}">${artHtml}<div class="sv-info"><h3>${esc(name)}${count ? ` <small>${count}</small>` : ''}</h3>${chips ? `<div class="sv-chips">${chips}</div>` : ''}${desc}</div><div class="sv-actions">${actions}</div></article>`;
}
const chip = (text, kind = '') => `<span class="sv-chip${kind ? ' ' + kind : ''}">${text}</span>`;

/** Renders one shop panel; see the comment at the top of this file. */
export function renderShop({ state, tab, shopId, data = {}, helpers = {} } = {}) {
  ensurePreview();
  const s = state, D = { ...content, ...data }, H = { sellPrice: game.sellPrice, itemName: game.itemName, ...helpers };
  const { CROPS, ITEMS, OUTFITS, KID_OUTFITS, FURNITURE, UPGRADES, iconUrl } = D;
  const shop = shopOf(shopId), country = shopId === 'country', tabs = shop.tabs;
  if (!tabs.some(([id]) => id === tab)) tab = tabs[0][0];
  const afford = n => (s.coins ?? 0) >= n ? '' : ' cant-afford';
  let body = '';

  if (tab === 'seeds') {
    body = `<div class="sv-grid">${Object.entries(CROPS).map(([id, c]) => {
      const have = s.inventory?.['seed_' + id] ?? 0;
      return card({ artHtml: art(c, iconUrl), name: c.name, count: have ? `×${have} seeds` : '', chips: chip(`🌾 ${c.yield} a bed`) + chip(`${coin}${c.sell} each`, 'gold') + chip(`⏱ ${c.grow}s`),
        desc: `<p>Harvest ${c.yield} · sell ${c.sell} each</p>`, actions: c.free ? badge('🌸 Free cuttings · plant in any bed') : btn(price(c.price * 3) + ' · 3 seeds', 'do', `data-type="buySeed" data-id="${id}"`, 'small-button sv-buy' + afford(c.price * 3)) });
    }).join('')}</div><div class="note sv-note">🌳 Visit the three circles south of your garden to plant permanent orchard trees.</div>`;
  }
  if (tab === 'sell') {
    const produce = Object.entries(s.inventory ?? {}).filter(([id, n]) => ITEMS[id] && n > 0), each = id => H.sellPrice(s, id, country);
    const total = produce.reduce((n, [id, q]) => n + each(id) * q, 0);
    body = `<p class="panel-intro">${country ? 'The hillside traders pay 25% more for your village produce.' : 'Fresh from your little farm. Thank you for growing with us.'} Selling all includes cooked meals; keep any recipe ingredients you need.</p>`
      + `<div class="sv-sell-all"><span class="sv-sell-art">🧺</span><span><small>TOTAL BASKET VALUE</small><b>${total} coins</b></span>${btn('Sell all produce', 'sell', total ? '' : 'disabled', 'primary sv-big')}</div>`
      + `<div class="sv-grid sv-sell">${produce.map(([id, n]) => card({ artHtml: art(ITEMS[id], iconUrl), name: H.itemName(id), count: `×${n}`, chips: chip(`${coin}${each(id)} each`, 'gold') + (ITEMS[id].energy ? chip(`⚡ +${ITEMS[id].energy}`) : ''),
        desc: `<p>${n} in your basket · ${each(id)} coins each</p>`, actions: btn('Sell one', 'sell', `data-id="${id}" data-one="true"`, 'text-button') + btn(`Sell ${n} · ${n * each(id)}`, 'sell', `data-id="${id}"`, 'small-button sv-buy') })).join('')
      || '<div class="empty-state sv-empty"><span>🌾</span><strong>Your first harvest will look lovely here.</strong><p>Bring crops, fish, eggs or a home-cooked dish to sell.</p></div>'}</div>`;
  }
  if (tab === 'upgrades') {
    body = `<div class="sv-grid sv-wide">${Object.entries(UPGRADES).map(([id, u]) => {
      const level = s.upgrades?.[id] ?? 0, done = level >= 3;
      return card({ artHtml: art(u, iconUrl), name: u.name, state: done ? 'is-owned' : '',
        chips: `<span class="eyebrow">TIER ${level} / 3</span><span class="tier-dots sv-dots">${[0, 1, 2].map(n => `<i class="${level > n ? 'filled' : ''}"></i>`).join('')}</span>`,
        desc: `<p>${esc(u.desc[level] ?? 'A little dream, fully grown.')}</p>`,
        actions: (done ? badge('✓ Complete') : '') + btn(done ? 'Complete' : price(u.cost[level]), 'do', `data-type="upgrade" data-id="${id}" ${done ? 'disabled' : ''}`, 'small-button sv-buy' + (done ? '' : afford(u.cost[level]))) });
    }).join('')}${H.bedCount ? (() => { const beds = H.bedCount(s), full = beds >= 30, cost = H.plotCost(s); return card({ artHtml: '<span class="sv-art sv-emoji">🧺</span>', name: 'Expand the fields', state: full ? 'is-owned' : '', chips: `<span class="eyebrow">${beds} / 30 BEDS</span>`, desc: '<p>Turn two more garden beds, a little at a time. Clear nearby trees to open up your land.</p>', actions: btn(full ? 'Complete' : price(cost), 'do', `data-type="plot" ${full ? 'disabled' : ''}`, 'small-button sv-buy' + (full ? '' : afford(cost))) }); })() : ''}${card({ artHtml: '<span class="sv-art sv-emoji">🛵</span>', name: 'A little motorcycle', state: s.bike ? 'is-owned' : '', chips: '<span class="eyebrow">THE OPEN ROAD</span>',
      desc: '<p>Parked beside the Bell garage. Yours for every adventure.</p>', actions: (s.bike ? badge('✓ Owned') : '') + btn(s.bike ? 'Owned' : price(350), 'do', `data-type="bike" ${s.bike ? 'disabled' : ''}`, 'small-button sv-buy' + (s.bike ? '' : afford(350))) })}</div>`;
  }
  if (tab === 'outfits') {
    const worn = OUTFITS.find(o => o.id === s.outfit) ?? OUTFITS[0];
    body = `<div class="sv-fitting"><div class="sv-stage">${figure(worn.color, { body: s.body, id: 'self' })}<span class="sv-stage-name" data-shop-name="self">${esc(worn.name)}</span></div>`
      + `<div class="sv-fitting-side"><span class="eyebrow">YOUR CHARACTER</span><div class="body-picker sv-body">${btn('Soft bob', 'do', 'data-type="body" data-id="girl"', s.body === 'girl' ? 'active' : '')}${btn('Short hair', 'do', 'data-type="body" data-id="boy"', s.body === 'boy' ? 'active' : '')}</div>`
      + `<p class="sv-hint">Tap <b>Try on</b> to see a colour on your character. Bought outfits stay in your wardrobe and are free to wear again.</p></div></div>`
      + `<div class="sv-grid sv-looks">${OUTFITS.map(o => {
        const wearing = s.outfit === o.id, owned = (s.owned ?? []).includes(o.id);
        return card({ artHtml: `<span class="sv-art sv-swatch" style="--shirt:${esc(o.color)}">${figure(o.color, { body: s.body })}</span>`, name: o.name, state: wearing ? 'is-worn' : owned ? 'is-owned' : '',
          chips: wearing ? badge('✓ Wearing', 'worn') : owned ? badge('✓ Owned') : '',
          actions: (wearing ? '' : `<button class="sv-try" data-shop-try="${o.id}" data-shop-color="${esc(o.color)}" data-shop-label="${esc(o.name)}" data-shop-target="self" aria-pressed="false">👕 Try on</button>`)
            + btn(wearing ? 'Wearing' : owned ? 'Wear' : price(o.price), 'do', `data-type="outfit" data-id="${o.id}" ${wearing ? 'disabled' : ''}`, 'small-button ' + (owned && !wearing ? 'sv-equip' : 'sv-buy') + (owned || wearing ? '' : afford(o.price))) });
      }).join('')}</div>`;
  }
  if (tab === 'kids') {
    const worn = KID_OUTFITS.find(o => o.id === s.kidOutfit), pip = (D.RESIDENTS ?? []).find(p => p.id === 'pip');
    body = `<div class="sv-fitting"><div class="sv-stage kid">${figure(worn?.color ?? pip?.color ?? '#d5b456', { body: 'girl', child: true, id: 'pip' })}<span class="sv-stage-name" data-shop-name="pip">${esc(worn?.name ?? 'Pip’s everyday clothes')}</span></div>`
      + `<div class="sv-fitting-side"><span class="eyebrow">FOR PIP</span><p class="panel-intro">A new outfit for Pip’s next little adventure. Purchases appear on her character in the village and at home.</p></div></div>`
      + `<div class="sv-grid sv-looks">${KID_OUTFITS.map(o => {
        const wearing = s.kidOutfit === o.id, owned = (s.kidOwned ?? []).includes(o.id);
        return card({ artHtml: `<span class="sv-art sv-swatch" style="--shirt:${esc(o.color)}">${figure(o.color, { body: 'girl', child: true })}</span>`, name: o.name, state: wearing ? 'is-worn' : owned ? 'is-owned' : '',
          chips: wearing ? badge('✓ Pip is wearing this', 'worn') : owned ? badge('✓ Owned') : '',
          actions: (wearing ? '' : `<button class="sv-try" data-shop-try="${o.id}" data-shop-color="${esc(o.color)}" data-shop-label="${esc(o.name)}" data-shop-target="pip" aria-pressed="false">👕 Try on</button>`)
            + btn(wearing ? 'Pip is wearing this' : owned ? 'Wear' : price(o.price), 'do', `data-type="kidOutfit" data-id="${o.id}"`, 'small-button ' + (owned && !wearing ? 'sv-equip' : 'sv-buy') + (owned || wearing ? '' : afford(o.price))) });
      }).join('')}</div>`;
  }
  if (tab === 'furniture') {
    body = `<p class="panel-intro">Made here, made to keep. Every piece is delivered straight to a cosy spot in your home.</p><div class="sv-grid">${FURNITURE.map(f => {
      const home = (s.furniture ?? []).includes(f.id);
      return card({ artHtml: art(f, iconUrl), name: f.name, state: home ? 'is-owned' : '', chips: home ? badge('✓ At home') : '',
        desc: `<p>${esc(f.desc ?? '')}</p>`, actions: btn(home ? 'At home' : price(f.price), 'do', `data-type="furniture" data-id="${f.id}" ${home ? 'disabled' : ''}`, 'small-button sv-buy' + (home ? '' : afford(f.price))) });
    }).join('')}</div>`;
  }

  const tabBar = `<nav class="tabs sv-tabs" aria-label="Shop categories">${tabs.map(([id, name]) => `<button class="${tab === id ? 'active' : ''}" aria-pressed="${tab === id}" data-action="tab" data-id="${id}"><span aria-hidden="true">${TAB_ICONS[id] ?? '•'}</span>${esc(name)}</button>`).join('')}</nav>`;
  const purse = `<div class="sv-keeper"><span class="sv-keeper-icon" aria-hidden="true">${shop.icon}</span><p>${esc(shop.blurb)}</p><span class="sv-purse">${coin}<b>${(s.coins ?? 0).toLocaleString()}</b></span></div>`;
  return {
    title: shop.title, kicker: `${s.coins} COINS IN YOUR PURSE`, tab, tabs: tabs.map(([id, name]) => ({ id, name, icon: TAB_ICONS[id] })),
    cls: `wide-modal shop-modal shop-${shop.tone}`, html: `${purse}${tabBar}<div class="sv-body" data-shop-tab="${tab}">${body}</div>`,
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
