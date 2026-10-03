// What grows and lies in each region, and its ground and light (round 8, step 0 stub; owner: builder B, who replaces the
// tables below with the reference's, spec 3.5 and 3.7). Pure data. Builder A's field plan (field-layout.mjs, fields.mjs)
// and builder C's applyLights read it; nobody else writes it.
//
// The shapes are final; the values are stubs unless marked REAL.
//   DECOR[id]      blocking pieces of a region's tiles: [{kind, kit, count, r, h, perch, scale: [min, max], glow}]
//                    kind   the root's name in its kit file          kit    'scenery' | 'wilds' | 'bright' | 'harsh' | 'dressing'
//                    count  pieces a 64 m tile                       r      collider radius at scale 1 (metres)
//                    h      the model's height at scale 1 (birds perch there)    perch  true only for tree kinds
//                    scale  the seeded range of a piece's scale      glow   the piece has emissive parts (world.loadKit bakes them)
//                  optional: where ('land' | 'sea' | 'island'), tint (a KIT_TINTS key, e.g. 'shadow' for rock@shadow)
//   CARDS[id]      cover and dressing cards: [{kind, kit, count, cls: 'cover' | 'dressing', glow}] (same optional fields)
//   RIM_KINDS[id]  [{kind, kit}]: what stands on the rim tiles beside a land ([] for the Beach and the Cloud Meadow)
//   GROUND[id]     home and village: {base}; a land: {low, high, patch, rim} with optional scorch (lava), checker (toy)
//                  and paint(x, z, color), a hook a land may supply for features that are ground colour only
//   LIGHTS[id]     a land's light: {sky, ground, sun, sunIntensity, fog, background}; a region without a row keeps toon.mjs LIGHT
//   KIT_TINTS[id]  a land's recolours by material name: {materialName: '#hex'}
//
// STUB (step 0): every region grows today's two field trees (the round tree two times in three and the pine one in three of
// eight tries a tile) and its card is the tuft; every rim stands in pines; no light rows; no tints. The GROUND colours are
// REAL (spec 3.1, 3.2, 3.5); there is no `paint` yet.
const TREES = Object.freeze([
  Object.freeze({ kind: 'tree_round', kit: 'scenery', count: 5, r: .42, h: 3.3, perch: true, scale: Object.freeze([1.25, 2.1]), glow: false }),
  Object.freeze({ kind: 'tree_pine', kit: 'scenery', count: 3, r: .42, h: 3.3, perch: true, scale: Object.freeze([1.25, 2.1]), glow: false }),
]);
const TUFT = Object.freeze([Object.freeze({ kind: 'tuft', kit: 'scenery', count: 100, cls: 'cover', glow: 0 })]);
const PINE_RIM = Object.freeze([Object.freeze({ kind: 'tree_pine', kit: 'scenery' })]);
const IDS = ['village', 'west', 'north', 'south', 'east', 'toy', 'candy', 'jungle', 'ice', 'ocean', 'lava', 'cloud', 'shadow'];
const every = value => Object.fromEntries(IDS.map(id => [id, value]));
export const DECOR = every(TREES);
export const CARDS = every(TUFT);
export const RIM_KINDS = every(PINE_RIM);
export const GROUND = {
  village: { base: '#93e06a' },
  west: { base: '#5cbf57' }, north: { base: '#5fb889' }, south: { base: '#a6e070' }, east: { base: '#f1bb7c' },
  toy: { low: '#ffe4ef', high: '#e2f0ff', patch: '#ffe4ef', checker: true, rim: '#fff4c8' },
  candy: { low: '#ff9fd0', high: '#ffc4e4', patch: '#ffd0ea', rim: '#ffe98a' },
  jungle: { low: '#3f8a3a', high: '#5aa84a', patch: '#3c9440', rim: '#8a6a3a' },
  ice: { low: '#cfe6fb', high: '#f4faff', patch: '#b9d6f2', rim: '#b9d6f2' },
  ocean: { low: '#f2dca0', high: '#e8cf8a', patch: '#f4e2b0', rim: '#56bce6' },
  lava: { low: '#6e5a60', high: '#8a6f6a', patch: '#55424a', scorch: '#3a2f3a', rim: '#4f4450' },
  cloud: { low: '#bfe8a0', high: '#d8f5c0', patch: '#e6f4ff', rim: '#e1f3ff' },
  shadow: { low: '#2a2440', high: '#3a3258', patch: '#3b3160', rim: '#1e1a30' },
};
export const LIGHTS = {};
export const KIT_TINTS = {};
