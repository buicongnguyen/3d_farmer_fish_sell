// Fruit trees you plant yourself: what stands where, and the panel you choose one in. Pure (no three.js, no DOM):
// grove-view.mjs draws the plan, main.mjs shows the panel, the tests read both.
//
// A village tree you cleared leaves a stump, and the stump is a planting spot: a fruit tree of any kind (content.mjs TREES)
// may be planted on it, up to plantCap(state) of them (game.mjs). The three orchard circles take the same kinds. A tree is a
// sapling, then young, then bears: 3 fruit a day, 5 in its best season.
//
//   grovePlan(state)                   -> {stumps: [{i, x, z}], trees: [{id, where, index, x, z, kind, stage, ready, season, r, h, turn}]}
//   chopRoom(state)                    -> the line in the "Clear this tree?" panel: how much room is left
//   grovePanel(state, arg, {iconUrl})  -> {title, kicker, html, cls}   arg: 'spot:<tree index>' or 'orchard:<circle>'
//
// Panel buttons (main.mjs): data-action="plantFruit" data-where data-index data-id · "pickFruit" · "uprootFruit".
import { TREES, ITEMS, ORCHARD_POSITIONS, iconUrl as contentIcon } from './content.mjs';
import { villageTrees } from './village-plan.mjs';
import { treeStage, treeReady, treeWait, inSeason, plantCap, plantedCount, CHOP_COST, FRUIT, SEASON_FRUIT } from './game.mjs';

/** A fruit tree's size at each stage (of TREE_SIZE metres), which is also how much of the grown trunk blocks the way. */
export const STAGE = [.35, .65, 1], STAGE_NAMES = ['Sapling', 'Young tree', 'Bearing fruit'], TREE_SIZE = 4.2;
/** A grown fruit tree's trunk: never wider than half a metre, so the lanes the old trees left clear stay clear. */
export const trunkOf = scale => Math.min(.5, .42 * scale);
const entry = (where, index, x, z, t, s, trunk) => {
  const stage = treeStage(s, t);
  return { id: `${where}:${index}`, where, index, x, z, kind: t.kind, stage, ready: treeReady(s, t), season: inSeason(s, t), r: trunk * STAGE[stage], h: 3.3 * STAGE[stage], turn: index * 2.399 };
};
/** Everything the grove draws: the stumps of cleared trees with nothing planted, and every fruit tree (planted spots, then the orchard). */
export function grovePlan(s) {
  const all = villageTrees(), stumps = [], trees = [];
  for (const i of s.cleared ?? []) {
    const t = all[i]; if (!t || t.gone) continue;
    const p = s.planted?.[i];
    if (p && TREES[p.kind]) trees.push(entry('spot', i, t.x, t.z, p, s, trunkOf(t.s))); else stumps.push({ i, x: t.x, z: t.z });
  }
  (s.trees ?? []).forEach((p, i) => { if (p && TREES[p.kind]) trees.push(entry('orchard', i, ORCHARD_POSITIONS[i].x, ORCHARD_POSITIONS[i].z, p, s, .5)); });
  return { stumps, trees };
}
/** One line for the "Clear this tree?" panel: how many fruit trees the land still has room for, said before the coins are spent. */
export function chopRoom(s) {
  const cap = plantCap(s), have = plantedCount(s), room = Math.max(0, cap - have);
  return room ? `Fruit trees planted: ${have} of ${cap}. Room for ${room} more.`
    : `Fruit trees planted: ${have} of ${cap}. This stump cannot be planted until Rich soil makes room, or a fruit tree is cleared.`;
}
/** 'spot:12' -> {where: 'spot', index: 12, orchard: false, tree}. */
export function groveArg(s, arg) {
  const [where, n] = String(arg ?? '').split(':'), index = Number(n), orchard = where === 'orchard';
  return { where: orchard ? 'orchard' : 'spot', index, orchard, tree: (orchard ? s.trees?.[index] : s.planted?.[index]) ?? null };
}

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const coin = '<i class="sv-coin" aria-hidden="true"></i>';
const chip = (text, kind = '') => `<span class="chip${kind ? ' ' + kind : ''}">${text}</span>`;
const SEASON_ICON = { Spring: '🌸', Summer: '☀️', Autumn: '🍂', Winter: '❄️' };
const days = n => `${n} morning${n === 1 ? '' : 's'}`;
/** The panel for a planting spot or an orchard circle: the eight kinds to choose from, or the tree that grows there. */
export function grovePanel(s, arg, { iconUrl = contentIcon } = {}) {
  const { where, index, orchard, tree } = groveArg(s, arg), data = `data-where="${where}" data-index="${index}"`;
  const art = id => `<span class="shop-icon"><img src="${esc(iconUrl(ITEMS[id].icon))}" alt="" loading="lazy" draggable="false"></span>`;
  if (tree) {
    const k = TREES[tree.kind], stage = treeStage(s, tree), left = treeWait(s, tree), ready = treeReady(s, tree), season = inSeason(s, tree);
    const now = left > 0 ? `First fruit in ${days(left)}.` : ready ? `Ready to pick: ${season ? SEASON_FRUIT : FRUIT} ${k.plural}.` : 'Picked today. More fruit tomorrow.';
    return {
      title: k.name, kicker: orchard ? 'YOUR FAMILY ORCHARD' : 'YOUR FRUIT TREES', cls: 'ref-menu grove-modal',
      html: `<div class="shop-list grove-list"><div class="shop-item is-owned">${art(tree.kind)}<div><strong>${esc(k.name)} <small>${STAGE_NAMES[stage]}</small></strong><span class="chips">${chip(`${FRUIT} ${esc(k.plural)} a day`)}${chip(`${SEASON_ICON[k.season]} ${SEASON_FRUIT} in ${k.season}`, season ? 'gold' : '')}${chip(`${coin}${ITEMS[tree.kind].sell} each`, 'gold')}</span><p>${now}</p></div>`
        + `<div class="button-row"><button class="primary" data-action="pickFruit" ${data}${ready ? '' : ' disabled'}>Pick</button></div></div>`
        + `<div class="shop-item grove-clear"><span class="shop-icon" aria-hidden="true">🪓</span><div><strong>Clear this tree</strong><p>${s.settings?.test ? 'Free in test mode' : `${CHOP_COST} coins · 2 energy`} · 2 timber. The spot is then free for another tree.</p></div>`
        + `<div class="button-row"><button class="soft-button" data-action="uprootFruit" ${data} aria-label="Clear this tree">Clear</button></div></div></div>`,
    };
  }
  const cap = plantCap(s), have = plantedCount(s), full = !orchard && have >= cap;
  const head = orchard ? 'A circle in the family orchard. Any kind may grow here.'
    : full ? `Your land holds ${cap} planted fruit trees for now. Rich soil from the Vale workshop makes room for 4 more.`
    : 'This cleared spot is yours to plant. Choose any tree: it bears fruit every day, for good.';
  const rows = Object.entries(TREES).map(([id, k]) => {
    const short = (s.coins ?? 0) < k.price, season = s && inSeason(s, { kind: id });
    return `<div class="shop-item${full ? ' is-locked' : ''}" data-tree="${id}">${art(id)}<div><strong>${esc(k.name)}</strong><span class="chips">${chip(`⏱ ${days(k.grow)}`)}${chip(`${SEASON_ICON[k.season]} best in ${k.season}`, season ? 'gold' : '')}${chip(`${coin}${ITEMS[id].sell} a fruit`, 'gold')}</span>`
      + `<p>${FRUIT} ${esc(k.plural)} a day · ${SEASON_FRUIT} in ${k.season}</p></div><div class="button-row"><button class="primary price-btn${short && !full ? ' cant-afford' : ''}" data-action="plantFruit" ${data} data-id="${id}"${full ? ' disabled' : ''} aria-label="Plant a ${esc(k.name.toLowerCase())} for ${k.price} coins">${coin}<b>${k.price}</b></button></div></div>`;
  }).join('');
  return {
    title: orchard ? 'Plant a promise' : 'Plant a fruit tree', kicker: orchard ? 'YOUR FAMILY ORCHARD' : `FRUIT TREES ${have} / ${cap}`, cls: 'ref-menu grove-modal',
    html: `<p class="panel-intro grove-intro">${head}</p><div class="shop-list grove-list">${rows}</div>`,
  };
}
