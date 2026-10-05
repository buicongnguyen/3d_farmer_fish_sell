// Every villager keeps their own everyday garments, hat and boots whether Pandora is open or shut.
// Pure (no three.js, DOM or saved outfit): avatar.mjs builds it; dressVillagers updates it after a purchase.
//
//   outfitOf(p, open, state?)  -> {look, outfitColor, gear: {garment, hat, wear, boots}} for buildAvatar
//   outfitKey(wants)           -> a string that is equal exactly when two wants draw the same
//
// Row: id: [look, garment, colour, hat, boots]. A look is body-height-ears-hood
// (tall is Willowmere's own body, so no new body file is needed); `colour` dyes the garment.
// Pip wears what her family bought her (state.kidOutfit), else the sunny pinafore.
import { KID_OUTFITS } from './content.mjs';
const W = {
  june: ['girl-tall-none-none', 'rose', '#e4688a', '', ''],
  pip: ['girl-tall-none-none', 'sunny', '#e8b950', 'hat_bunny', ''],
  ada: ['girl-tall-none-none', 'plum', '#8a5fa6', 'hat_straw', ''],
  ellis: ['sturdy-tall-none-none', 'harbor', '#3f7fb8', 'hat_cowboy', ''],
  theo: ['boy-tall-none-none', 'honey', '#3577c4', '', 'boots_cowboy'],
  bea: ['slim-tall-none-none', 'midnight', '#b8323a', '', ''],
  kit: ['boy-tall-none-none', 'rain', '#f08a2c', 'hat_lantern', ''],
  mara: ['girl-tall-none-none', 'sage', '#4f9a5a', 'hat_bear', ''],
  oren: ['sturdy-tall-none-none', 'honey', '#e2b13a', '', 'boots_cowboy'],
  wren: ['girl-tall-none-chick', 'berry', '#e0659c', '', ''],
  finn: ['boy-tall-none-none', 'ivory', '#4fb8c4', 'hat_frog', ''],
  pearl: ['slim-tall-none-none', 'midnight', '#22304f', 'hat_leather', ''],
  iris: ['slim-tall-none-none', 'festival', '#b43a7a', 'hat_cat', ''],
  leo: ['boy-tall-none-none', 'meadow', '#c07a3a', '', ''],
  faye: ['girl-tall-bunny-none', 'party', '#b07be0', '', ''],
  hugo: ['sturdy-tall-none-none', 'clay', '#cf7a45', 'hat_chef', ''],
  nell: ['girl-tall-none-none', 'coral', '#ef6a52', 'hat_party', ''],
  ash: ['sturdy-tall-none-none', 'fern', '#9a4b2a', '', 'boots_cowboy'],
  fern: ['girl-tall-none-none', 'sky', '#d9b382', '', ''],
  cora: ['slim-tall-none-none', 'rose', '#5f86cc', 'hat_graduate', ''],
  milo: ['boy-tall-none-none', 'sunny', '#f0c040', '', 'boots_rocket'],
  sylvie: ['girl-tall-none-fox', 'sage', '#9cc050', '', ''],
  hazel: ['slim-tall-none-none', 'ivory', '#f4f1ea', 'hat_halo', ''],
};
export const OUTFIT_IDS = Object.keys(W);
const KIDS = new Set(['pip', 'kit', 'wren', 'faye', 'milo']);
/** What a villager is dressed in. `state` gives Pip her bought outfit (state.kidOutfit). */
export function outfitOf(p, _open = false, state = null) {
  const r = W[p.id] ?? W.june, kid = KIDS.has(p.id), pip = p.id === 'pip', bought = pip ? KID_OUTFITS.find(k => k.id === state?.kidOutfit) : null;
  const garment = bought ? 'kid_' + bought.id : r[1] ? (kid ? 'kid_' : 'garment_') + r[1] : '', colour = bought?.color ?? r[2];
  const gear = { garment, hat: r[3], wear: '', boots: r[4] };
  return { look: r[0], outfitColor: colour, gear };
}
export const outfitKey = w => `${w.look}|${w.outfitColor}|${w.gear.garment},${w.gear.hat},${w.gear.wear},${w.gear.boots}`;
/** The colour a villager's portrait badge uses (their everyday garment). */
export const outfitColour = (p, state = null) => outfitOf(p, false, state).outfitColor;
