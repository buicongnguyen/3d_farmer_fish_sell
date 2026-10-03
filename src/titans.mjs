// The nine titans' data (round 8, step 0 stub; owner: builder D2, who fills the three tables). Pure. It imports
// creature-def.mjs and nothing from wilds.mjs, gear.mjs or pandora.mjs: those three merge these tables in with one line each
// (wilds.mjs Object.assign(CREATURES, TITAN_ROWS); gear.mjs spreads TITAN_GEAR into its table; pandora.mjs
// Object.assign(LOOT, TITAN_LOOT)), so builder D2 never edits them.
//   TITAN_ROWS    {titan_turtle: creature(...), ...}: rows for wilds.mjs CREATURES, with behavior 'titan' and titan: true
//   TITAN_GEAR    {hat_t_turtle: {name, slot: 'hat', price, ...}, pet_t_turtle: {...}, ...}: 18 rows in gear.mjs's table shape
//   TITAN_LOOT    {titan_turtle: [[item, chance, min, max], ...], ...}: rows for pandora.mjs LOOT
//
// STUB (step 0): three empty objects, so every merge line is inert.
import { creature } from './creature-def.mjs';
export const TITAN_ROWS = {};
export const TITAN_GEAR = {};
export const TITAN_LOOT = {};
/** The row builder builder D2 uses for TITAN_ROWS (re-exported so the import above is not dead while the table is empty). */
export { creature };
