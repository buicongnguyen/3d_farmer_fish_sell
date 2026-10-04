// What each villager wears: an everyday outfit of real garments (garments.mjs: garment_<id> / kid_<id>, plus a hat and boots
// from gear.mjs) chosen to fit who they are, and, while the Pandora box is open, an adventure outfit for the wilds: the
// same person (body, colour, hat or boots they are known by) in a costume from the gear kit. Pure (no three.js, no DOM,
// nothing saved): the outfit is derived from the resident's id and the box, avatar.mjs builds it, world.dressVillagers swaps it.
//
//   outfitOf(p, open, state?)  -> {look, outfitColor, gear: {garment, hat, wear, boots}} for buildAvatar
//   outfitKey(wants)           -> a string that is equal exactly when two wants draw the same
//
// Row: id: [look, garment, colour, hat, boots | costume, adventure hat, adventure boots]. A look is body-height-ears-hood
// (tall is Willowmere's own body, so no new body file is needed); `colour` dyes the garment and the cloth of a costume.
// Pip wears what her family bought her (state.kidOutfit) under both; she gets no costume, her pick stays visible.
import { KID_OUTFITS } from './content.mjs';
const W = {
  june: ['girl-tall-none-none', 'rose', '#e4688a', '', '', 'armor_aodai', 'hat_lantern', ''],
  pip: ['girl-tall-none-none', '', '#e8b950', 'hat_bunny', '', '', 'hat_frog', 'boots_cowboy'],
  ada: ['girl-tall-none-none', 'plum', '#8a5fa6', 'hat_straw', '', 'armor_wolf', 'hat_wizard', ''],
  ellis: ['sturdy-tall-none-none', 'harbor', '#3f7fb8', 'hat_cowboy', '', 'armor_navy', 'hat_cowboy', 'boots_cowboy'],
  theo: ['boy-tall-none-none', 'honey', '#3577c4', '', 'boots_cowboy', 'armor_space', 'hat_space', 'boots_rocket'],
  bea: ['slim-tall-none-none', 'midnight', '#b8323a', '', '', 'armor_superhero', '', 'boots_cloud'],
  kit: ['boy-tall-none-none', 'rain', '#f08a2c', 'hat_lantern', '', 'dz_mecha', '', ''],
  mara: ['girl-tall-none-none', 'sage', '#4f9a5a', 'hat_bear', '', 'armor_leaf', 'hat_bear', 'boots_cowboy'],
  oren: ['sturdy-tall-none-none', 'honey', '#e2b13a', '', 'boots_cowboy', 'armor_army', 'hat_straw', ''],
  wren: ['girl-tall-none-chick', 'berry', '#e0659c', '', '', 'armor_cloud', '', 'boots_cloud'],
  finn: ['boy-tall-none-none', 'ivory', '#4fb8c4', 'hat_frog', '', 'armor_pirate', 'hat_pirate', ''],
  pearl: ['slim-tall-none-none', 'midnight', '#22304f', 'hat_leather', '', 'armor_knight', 'hat_viking', ''],
  iris: ['slim-tall-none-none', 'festival', '#b43a7a', 'hat_cat', '', 'armor_kimono', 'hat_samurai', ''],
  leo: ['boy-tall-none-none', 'meadow', '#c07a3a', '', '', 'armor_hoodie', 'hat_party', ''],
  faye: ['girl-tall-bunny-none', 'party', '#b07be0', '', '', 'armor_angel', '', 'boots_cloud'],
  hugo: ['sturdy-tall-none-none', 'clay', '#cf7a45', 'hat_chef', '', 'armor_chef', 'hat_chef', ''],
  nell: ['girl-tall-none-none', 'coral', '#ef6a52', 'hat_party', '', 'armor_hawaii', 'crown', ''],
  ash: ['sturdy-tall-none-none', 'fern', '#9a4b2a', '', 'boots_cowboy', 'armor_bone', '', ''],
  fern: ['girl-tall-none-none', 'sky', '#d9b382', '', '', 'armor_leather', 'hat_leather', 'boots_cowboy'],
  cora: ['slim-tall-none-none', 'rose', '#5f86cc', 'hat_graduate', '', 'armor_tux', 'hat_graduate', 'boots_cloud'],
  milo: ['boy-tall-none-none', 'sunny', '#f0c040', '', 'boots_rocket', 'armor_wings', '', 'boots_rocket'],
  sylvie: ['girl-tall-none-fox', 'sage', '#9cc050', '', '', 'armor_leaf', 'hat_bunny', ''],
  hazel: ['slim-tall-none-none', 'ivory', '#f4f1ea', 'hat_halo', '', 'armor_angel', 'hat_halo', 'boots_cloud'],
};
export const OUTFIT_IDS = Object.keys(W);
const KIDS = new Set(['pip', 'kit', 'wren', 'faye', 'milo']);
/** What a villager is dressed in. `state` gives Pip her bought outfit (state.kidOutfit). */
export function outfitOf(p, open = false, state = null) {
  const r = W[p.id] ?? W.june, kid = KIDS.has(p.id), pip = p.id === 'pip', bought = pip ? KID_OUTFITS.find(k => k.id === state?.kidOutfit) : null;
  const garment = bought ? 'kid_' + bought.id : r[1] ? (kid ? 'kid_' : 'garment_') + r[1] : '', colour = bought?.color ?? r[2];
  const gear = { garment, hat: r[3], wear: '', boots: r[4] };
  if (open) { if (r[5]) gear.wear = r[5]; gear.hat = r[6] || (r[5] ? '' : r[3]); gear.boots = r[7] || r[4]; }
  return { look: r[0], outfitColor: colour, gear };
}
export const outfitKey = w => `${w.look}|${w.outfitColor}|${w.gear.garment},${w.gear.hat},${w.gear.wear},${w.gear.boots}`;
/** The colour a villager's portrait badge uses (their everyday garment). */
export const outfitColour = (p, state = null) => outfitOf(p, false, state).outfitColor;
