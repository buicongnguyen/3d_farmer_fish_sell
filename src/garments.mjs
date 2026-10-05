// The village clothes are real garments, not colours: the 13 of the Finch atelier (OUTFITS ids, models garment_<id> in
// wm-garments.glb) and Pip's four (KID_OUTFITS ids, kid_<id> in wm-kids.glb), made by art/blender/build_garments.py. They
// are worn like gear: avatar.mjs reads `gear.garment` (a model id) next to hat, wear, boots, weapon and pet, tints the main
// cloth (the material "Hero shirt <id>") with the outfit colour and fits the pieces to every look. A costume (gear.wear)
// covers them. The Colour row (state `tint`, '' = the garment's own colour) dyes whatever garment is worn.
// This file is tiny on purpose (it is in the first bundle); the panels live in garments-view.mjs, loaded by main.mjs.
export const garmentOf = outfit => 'garment_' + outfit;
export const kidGarmentOf = id => id ? 'kid_' + id : '';
/** The lazy panels (garments-view.mjs) once they have loaded: null until then, and in the node tests that do not need them. */
export const ui = { view: null };
