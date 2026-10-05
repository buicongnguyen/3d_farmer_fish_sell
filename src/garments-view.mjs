// The panels of the village clothes (garments.mjs): the Finch atelier's "Clothes" and "For Pip" tabs, the wardrobe's
// clothes group, the Colour row and Pip's live preview. Loaded by main.mjs after the first frame (import()), so the first
// bundle stays small; wardrobe-view.mjs, mirror-view.mjs and shop-view.mjs reach it through garments.mjs `ui.view`.
//
//   clothesHtml(state, {tryGarment, folded, iconUrl})   wardrobe: the garments you own, as a labelled group
//   colourRowHtml(state)                                 the Colour row (swatches, never cards), for the worn garment
//   mirrorClothesHtml(state, iconUrl)                    the mirror's "Clothes" and "Colour" rows
//   shopOutfitsHtml(state, D) / shopKidsHtml(state, D)   the atelier's tabs
//   paintKids(world, state) / tryKid(world, state, id)   Pip's portrait in the "For Pip" tab (nothing is saved by trying on)
//
// Buttons: data-action="do" data-type="outfit|tint|kidOutfit" (main.mjs runs the action), data-garment-try="<outfit id>"
// (wardrobe try-on, wardrobe-view.mjs), data-shop-try (the atelier's Try on, shop-view.mjs onPreviewClick).
import * as content from './content.mjs';
import { garmentOf, kidGarmentOf } from './garments.mjs';
import { outfitOf } from './outfits.mjs';
import { gearOf } from './gear.mjs';
import { group } from './wardrobe-view.mjs';
import { MirrorPreview, mirrorHtml } from './mirror-view.mjs';
import { avatarAssets, buildAvatar, restPose, styleKey } from './avatar.mjs';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const coin = '<i class="sv-coin" aria-hidden="true"></i>';
/** What each garment is, in a line (cards and the wardrobe). */
export const BLURB = {
  meadow: 'Plain linen tunic with patch pockets and a laced neck.', harbor: 'Sailor-collar blouse with a striped V and a red tie.', rose: 'Knit cardigan: four buttons, ribbed cuffs, two pockets.',
  honey: 'Bib overalls over a cream shirt, cuffs rolled up.', plum: 'A chunky knit jumper with a roll neck and ribbed hem.', clay: 'Potter’s apron over a cream shirt, tied in a bow behind.',
  sage: 'Gardener’s vest with a tool pocket and a little trowel.', midnight: 'A long overcoat with a collar and double buttons.', ivory: 'Crisp Sunday shirt: collar, placket and buttoned cuffs.',
  coral: 'Sleeveless summer top with a scoop neck and a frilled hem.', fern: 'Zipped woodland jacket with the hood down and leaf patches.', festival: 'Velvet jacket with gold trim and frogging.', sky: 'Puff-sleeve blouse with a ruffled collar and a bow.',
  sunny: 'Pinafore with crossing straps over a puff-sleeve blouse.', rain: 'Hooded rain coat: wooden toggles, flap pockets, yellow lining.', berry: 'Knit cardigan with five cream buttons and a pocket.', party: 'Dress with puff sleeves, a tiered skirt and a back bow.',
};
/** The Colour row's names (the swatches are the atelier's colours). */
const DYE = { meadow: 'Meadow green', harbor: 'Harbor blue', rose: 'Rose', honey: 'Honey', plum: 'Plum', clay: 'Terracotta', sage: 'Sage', midnight: 'Midnight', ivory: 'Ivory', coral: 'Coral', fern: 'Fern', festival: 'Velvet berry', sky: 'Cloud blue' };
const icon = (id, iconUrl) => `<span class="shop-icon garment-icon"><img src="${esc(iconUrl('items/' + id))}" alt="" loading="lazy" draggable="false"></span>`;
const price = p => `${coin}<b>${p}</b>`;

/** The Colour row: swatches that dye the garment you are wearing (a colour is not a piece of clothing: no cards, no Try on). */
export function colourRowHtml(s) {
  const costume = !!s.gear?.wear;
  const dyes = content.OUTFITS.map(o => `<button class="dye${s.tint === o.color ? ' on' : ''}" style="--dye:${esc(o.color)}" data-action="do" data-type="tint" data-id="${esc(o.color)}" aria-pressed="${s.tint === o.color}" aria-label="${esc(DYE[o.id])}" title="${esc(DYE[o.id])}" ${costume ? 'disabled' : ''}></button>`).join('');
  return `<div class="colour-row" data-colour-row><span class="colour-row-name">Colour</span><div class="dyes"><button class="dye own${s.tint ? '' : ' on'}" data-action="do" data-type="tint" data-id="" aria-pressed="${!s.tint}" title="The garment’s own colour" ${costume ? 'disabled' : ''}>Own</button>${dyes}</div><small>${costume ? 'Take off your costume to dye your clothes.' : 'Dyes the clothes you are wearing. Free.'}</small></div>`;
}
/** The wardrobe's group of owned garments (before the hats): Try on and Wear, like every other piece. */
export function clothesHtml(s, { tryGarment = '', folded = null, iconUrl = content.iconUrl } = {}) {
  const owned = content.OUTFITS.filter(o => (s.owned ?? []).includes(o.id)), costume = !!s.gear?.wear;
  const rows = owned.map(o => {
    const on = s.outfit === o.id && !costume, id = garmentOf(o.id);
    const actions = on ? '<button class="primary" disabled>Wearing</button>' : `<button class="soft-button try-on" data-garment-try="${o.id}" aria-pressed="${tryGarment === o.id}">${tryGarment === o.id ? '👀 Trying on' : '👕 Try on'}</button><button class="sky-button equip-btn" data-action="do" data-type="outfit" data-id="${o.id}">Wear</button>`;
    return `<div class="shop-item${on ? ' is-worn' : ''}" data-garment="${o.id}">${icon(id, iconUrl)}<div><strong>${esc(o.name)}</strong>${on ? '<span class="chip equipped is-worn">✓ Wearing</span>' : ''}<small class="blurb">${esc(BLURB[o.id])}</small></div><div class="button-row">${actions}</div></div>`;
  }).join('');
  return group('wardrobe', 'clothes', '👗 Clothes', owned.length, rows, folded);
}
/** The mirror's rows: your clothes as tiles, then the Colour row. */
export function mirrorClothesHtml(s, iconUrl = content.iconUrl) {
  const costume = !!s.gear?.wear, tiles = content.OUTFITS.filter(o => (s.owned ?? []).includes(o.id)).map(o => {
    const on = s.outfit === o.id && !costume;
    return `<button class="look-chip${on ? ' worn on' : ''}" data-action="do" data-type="outfit" data-id="${o.id}" aria-pressed="${on}" title="${esc(o.name)}"><span class="look-chip-icon"><img class="look-chip-art" src="${esc(iconUrl('items/' + garmentOf(o.id)))}" alt="" width="128" height="128" loading="lazy" draggable="false"></span><span class="look-chip-name">${esc(o.name)}</span>${on ? '<small class="look-state">Wearing</small>' : ''}</button>`;
  }).join('');
  return `<div class="look-row" data-look-row="clothes"><span class="look-row-name">Clothes</span><div class="look-chips">${tiles}</div></div>${colourRowHtml(s)}`;
}

// ---------------------------------------------------------------- the Finch atelier
function card(art, name, desc, state, chips, actions) {
  return `<div class="shop-item${state ? ' ' + state : ''}">${art}<div><strong>${esc(name)}</strong>${chips}<small class="blurb">${esc(desc)}</small></div><div class="button-row">${actions}</div></div>`;
}
const badge = (text, kind = 'owned') => `<span class="chip equipped is-${kind}">${text}</span>`;
function tryButton(o, target) {
  return `<button class="soft-button try-on sv-try" data-shop-try="${o.id}" data-shop-color="${esc(o.color)}" data-shop-label="${esc(o.name)}" data-shop-target="${target}" aria-pressed="false">👕 Try on</button>`;
}
const buyButton = (s, o, type, owned, wearing, label) => `<button class="${owned && !wearing ? 'sky-button equip-btn' : 'primary price-btn'}${owned || wearing || (s.coins ?? 0) >= o.price ? '' : ' cant-afford'}" data-action="do" data-type="${type}" data-id="${o.id}" ${wearing ? 'disabled' : ''}>${wearing ? label : owned ? 'Wear' : price(o.price)}</button>`;
/** "Clothes" tab: every garment of the atelier with its picture, its price and Try on; the Colour row on top. */
export function shopOutfitsHtml(s, D = content) {
  const iconUrl = D.iconUrl ?? content.iconUrl, costume = !!s.gear?.wear;
  return `<div class="owl-note look-note"><span>👕</span><p><strong>Clothes</strong>Real garments, sewn for every body. Tap Try on to see one on you before you buy it. A colour is only a dye (below).</p></div>${colourRowHtml(s)}`
    + `<div class="shop-list sv-looks">${D.OUTFITS.map(o => {
      const wearing = s.outfit === o.id && !costume, owned = (s.owned ?? []).includes(o.id);
      return card(icon(garmentOf(o.id), iconUrl), o.name, BLURB[o.id], wearing ? 'is-worn' : owned ? 'is-owned' : '', wearing ? badge('✓ Wearing', 'worn') : owned ? badge('✓ Owned') : '',
        (wearing ? '' : tryButton(o, 'self')) + buyButton(s, o, 'outfit', owned, wearing, 'Wearing'));
    }).join('')}</div>`;
}
/** "For Pip" tab: her portrait in what she wears (or is trying on), then her four outfits. */
export function shopKidsHtml(s, D = content) {
  const iconUrl = D.iconUrl ?? content.iconUrl;
  return `<div class="owl-note look-note"><span>🎀</span><p><strong>For Pip</strong>A new outfit for Pip’s next little adventure. She wears it in the village and at home.</p></div>`
    + `<div class="kids-stage">${mirrorHtml('kids')}<p class="kids-name" data-shop-name="pip">Pip</p></div>`
    + `<div class="shop-list sv-looks">${D.KID_OUTFITS.map(o => {
      const wearing = s.kidOutfit === o.id, owned = (s.kidOwned ?? []).includes(o.id);
      return card(icon(kidGarmentOf(o.id), iconUrl), o.name, BLURB[o.id], wearing ? 'is-worn' : owned ? 'is-owned' : '', wearing ? badge('✓ Pip is wearing this', 'worn') : owned ? badge('✓ Owned') : '',
        (wearing ? '' : tryButton(o, 'pip')) + buyButton(s, o, 'kidOutfit', owned, wearing, 'Pip is wearing this'));
    }).join('')}</div>`;
}

// ---------------------------------------------------------------- Pip's portrait
let preview = null, trying = '';
const wantsOf = (s, id) => {
  const k = content.KID_OUTFITS.find(k => k.id === id), pip = content.RESIDENTS.find(p => p.id === 'pip');
  return { look: 'girl-tall-none-none', outfitColor: k?.color ?? pip?.color ?? '#d5b456', gear: { garment: kidGarmentOf(id) } };
};
/** Draws Pip into the tab's glass: what she wears, or the outfit being tried on (only when that changed). */
export function paintKids(world, s) {
  const slot = document.querySelector('[data-mirror-slot="kids"]'); if (!slot) return;
  if (trying && !document.querySelector('[data-shop-try][data-shop-target="pip"][aria-pressed="true"]')) trying = ''; // a redraw ended the try-on
  preview ??= new MirrorPreview(world, { reach: 3.1, width: 170, height: 230 });
  const wants = wantsOf(s, trying || s.kidOutfit), waiting = avatarAssets(world, wants);
  preview.show(slot, styleKey(wants) + (waiting ? '|loading' : ''), () => restPose(buildAvatar(world, wants)));
  waiting?.then(() => { if (document.querySelector('[data-mirror-slot="kids"]')) paintKids(world, s); });
}
/** The atelier's Try on for Pip: null puts her back in what she wears. */
export function tryKid(world, s, id) { trying = id ?? ''; paintKids(world, s); }
export const resetKids = () => { trying = ''; };

// ---------------------------------------------------------------- a villager's portrait (the talk panel)
let personPreview = null, personRequest = 0;
/** Draws the villager you talk to in what they wear now (outfits.mjs: their everyday outfit). */
export function paintPerson(world, s, p) {
  const slot = document.querySelector('[data-mirror-slot="person"]'); if (!slot || !p) return;
  const request = ++personRequest;
  personPreview ??= new MirrorPreview(world, { reach: 3.1, width: 170, height: 230 });
  const wants = outfitOf(p, false, s), waiting = avatarAssets(world, wants);
  personPreview.show(slot, styleKey(wants) + (waiting ? '|loading' : ''), () => restPose(buildAvatar(world, wants)));
  waiting?.then(() => { if (request === personRequest && document.querySelector('[data-mirror-slot="person"]')) paintPerson(world, s, p); });
}
