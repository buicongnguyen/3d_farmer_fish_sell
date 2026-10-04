// What grows and lies in each region, and its ground and light (round 8; owner: builder B). Pure data: it imports
// land-features.mjs (for the ground paint) and nothing above it. Builder A's field plan (field-layout.mjs, fields.mjs) and
// builder C's applyLights read it; nobody else writes it.
//
// Everything here is Zoo Garden's (cute_game): the kinds and their classes from src/biomes.ts (DECOR, HOME_DECOR,
// PLANET_DECOR, DRESSING), the lights from src/toon.ts PLANET_LIGHT, the tints from src/world.ts KIT_TINTS, the ground
// colours from src/ground.ts and src/content.ts PLANET_FACTS. What is adapted: counts are pieces a 64 m tile, not a world
// (spec 3.5: the home regions at two fifths to a half of the reference's density, the lands at its own), and `bush` and
// `log` are cards.
//
//   DECOR[id]      blocking pieces of a region's tiles: [{kind, kit, count, r, h, perch, scale: [min, max], glow}]
//                    kind   the root's name in its kit file          kit    'scenery' | 'wilds' | 'bright' | 'harsh' | 'dressing'
//                    count  pieces a 64 m tile                       r      collider radius at scale 1 (metres)
//                    h      the model's height at scale 1, read from the kit file (birds perch there)
//                    perch  true only for tree kinds                 scale  the seeded range of a piece's scale
//                    glow   the piece has emissive parts (world.loadKit bakes them)
//                  optional: where ('land', the default | 'sea' | 'island': land-features.mjs landClear), tint (a KIT_TINTS key:
//                  the piece is drawn from the tinted copy 'kit/kind@tint')
//   CARDS[id]      cover and dressing cards: [{kind, kit, count, cls: 'cover' | 'dressing', glow: 0 | 1}] (same optional fields)
//   RIM_KINDS[id]  [{kind, kit}]: what stands on the rim tiles beside a land ([] for the Beach, the Cloud Meadow and home)
//   GROUND[id]     home and village: {base}; a land: {low, high, patch, rim} with optional scorch (lava), checker (toy);
//                  and, where a region has features that are ground colour, paint(x, z, color): it recolours `color`
//                  ({r, g, b} in three.js's working space, a T.Color or a plain object) in place and returns it
//   LIGHTS[id]     a land's light: {sky, ground, sun, sunIntensity, fog, background}; a region without a row keeps toon.mjs LIGHT
//   KIT_TINTS[id]  a land's recolours by material name: {materialName: '#hex'}
import { FEATURES, POND_LOOKS } from './land-features.mjs';

const freeze = Object.freeze;
const TREE = freeze([1.25, 2.1]), KIT = freeze([.9, 1.3]); // scale ranges: the three field trees keep main's; every kit piece 0.9 to 1.3
// [kind, kit, r, h, perch, glow, scale]: one row a blocking kind. h is the top of the model at scale 1, measured from the GLB's
// position bounds (the three scenery trees keep 3.3, the height main's birds already land at).
const KIND = Object.fromEntries([
  ['tree_round', 'scenery', .42, 3.3, true, false, TREE], ['tree_pine', 'scenery', .42, 3.3, true, false, TREE], ['tree_blossom', 'scenery', .42, 3.3, true, false, TREE],
  ['rock', 'scenery', .7, .64, false, false], ['tree_swamp', 'wilds', .55, 3.41, true, false], ['rock_red', 'wilds', 1.1, 1.4, false, false],
  ['tree_dead', 'wilds', .35, 2.98, true, false], ['crystals', 'wilds', .5, 1.12, false, true],
  ['toyblock', 'bright', 1.3, 1.66, false, false], ['toyball', 'bright', .9, 1.74, false, false],
  ['candy_tree', 'bright', .35, 3.4, true, false], ['candy_cane', 'bright', .3, 2.18, false, false], ['donut', 'bright', .9, 1.54, false, false], ['cupcake', 'bright', .6, 1.48, false, false],
  ['jungletree', 'bright', .6, 4.98, true, false], ['palm', 'bright', .35, 4.68, true, false], ['cloudtree', 'bright', .4, 3.54, true, false], ['skyrock', 'bright', .8, 1.31, false, true],
  ['snow_pine', 'harsh', .45, 4, true, false], ['ice_spire', 'harsh', .55, 2.76, false, true], ['snow_rock', 'harsh', .8, .9, false, false], ['snowman', 'harsh', .45, 1.64, false, false],
  ['lava_rock', 'harsh', .85, .95, false, true], ['obsidian', 'harsh', .5, 1.36, false, false], ['ash_tree', 'harsh', .35, 3.2, true, true], ['deadtree', 'harsh', .35, 3.4, true, true],
].map(([kind, kit, r, h, perch, glow, scale = KIT]) => [kind, { kind, kit, r, h, perch, scale, glow }]));
const piece = (kind, count, extra) => freeze({ ...KIND[kind], count, ...extra });
const COVER_KIT = { tuft: 'scenery', flowers: 'scenery', bush: 'scenery', toadstools: 'wilds', log: 'wilds', reeds: 'wilds', dry_bush: 'wilds', fern: 'wilds', gumdrops: 'bright', coral: 'bright' };
const cover = (kind, count, extra) => freeze({ kind, kit: COVER_KIT[kind], count, cls: 'cover', glow: 0, ...extra });
const dressing = (kind, count, extra) => freeze({ kind, kit: 'dressing', count, cls: 'dressing', glow: 0, ...extra });
const rim = (...kinds) => freeze(kinds.map(kind => freeze({ kind, kit: KIND[kind]?.kit ?? COVER_KIT[kind] ?? 'harsh' })));
const PEBBLES = dressing('pebbles', 42); // DRESSING.home: 700 pebbles over the whole home world is 42 a tile, in all four home regions

// DECOR and CARDS themselves stay open (every row and list in them is frozen): fields.test's withTables swaps whole regions in and out.
export const DECOR = ({
  village: freeze([]), // inside the ward the village keeps its own trees (village-plan.mjs)
  west: freeze([piece('tree_round', 18), piece('tree_pine', 18), piece('rock', 4)]),
  north: freeze([piece('tree_swamp', 20), piece('rock', 4)]),
  south: freeze([piece('tree_round', 7), piece('tree_blossom', 5), piece('rock', 4)]),
  east: freeze([piece('rock_red', 14), piece('tree_dead', 8), piece('crystals', 6)]),
  toy: freeze([piece('toyblock', 4), piece('toyball', 3)]),
  candy: freeze([piece('candy_tree', 8), piece('candy_cane', 7), piece('donut', 3), piece('cupcake', 4)]),
  jungle: freeze([piece('jungletree', 10)]),
  ice: freeze([piece('snow_pine', 12), piece('ice_spire', 4), piece('snow_rock', 4), piece('snowman', 2)]),
  ocean: freeze([piece('palm', 5)]), // on sand only: 'land' is everywhere but the sea
  lava: freeze([piece('lava_rock', 6), piece('obsidian', 4), piece('ash_tree', 4)]),
  cloud: freeze([piece('cloudtree', 5, { where: 'island' }), piece('skyrock', 3, { where: 'island' })]),
  shadow: freeze([piece('deadtree', 7), piece('rock', 3, { tint: 'shadow' })]),
});
export const CARDS = ({
  village: freeze([]),
  west: freeze([cover('tuft', 70), cover('toadstools', 32), cover('flowers', 24), cover('bush', 26), cover('log', 8), PEBBLES]),
  north: freeze([cover('reeds', 39), cover('tuft', 60), cover('toadstools', 20), cover('bush', 12), cover('log', 8), PEBBLES]),
  south: freeze([cover('tuft', 70), cover('flowers', 66), cover('toadstools', 8), cover('bush', 16), PEBBLES]),
  east: freeze([cover('dry_bush', 45), PEBBLES]), // no green card at all: the canyon reads hot by colour
  toy: freeze([cover('flowers', 6, { tint: 'toy' }), dressing('toy_bits', 55)]),
  candy: freeze([cover('gumdrops', 14), cover('flowers', 10, { tint: 'candy' }), dressing('sprinkles', 76)]),
  jungle: freeze([cover('fern', 18), cover('flowers', 6, { tint: 'jungle' }), cover('bush', 8, { tint: 'jungle' }), dressing('jungle_bloom', 62)]),
  ice: freeze([cover('dry_bush', 8), dressing('ice_shards', 62)]), // dry_bush has no tint flag in the reference, so none here
  ocean: freeze([cover('fern', 6), cover('coral', 16, { where: 'sea' }), dressing('shells', 60)]),
  lava: freeze([dressing('embers', 76, { glow: 1 })]),
  cloud: freeze([cover('tuft', 16, { where: 'island' }), cover('flowers', 9, { where: 'island' }), dressing('sky_bloom', 60, { where: 'island' })]),
  shadow: freeze([cover('tuft', 8, { tint: 'shadow' }), dressing('glow_shrooms', 48, { glow: 1 })]),
});
const NO_RIM = freeze([]);
export const RIM_KINDS = freeze({
  village: NO_RIM, west: NO_RIM, north: NO_RIM, south: NO_RIM, east: NO_RIM, // only a land has an outer side
  toy: rim('toyblock', 'toyball'), candy: rim('candy_tree', 'candy_cane', 'cupcake'), jungle: rim('jungletree', 'fern'), ice: rim('snow_pine', 'ice_spire'),
  ocean: NO_RIM, lava: rim('lava_rock', 'obsidian', 'mini_volcano'), cloud: NO_RIM, shadow: rim('deadtree'), // the Beach's rim is open sea, the Cloud Meadow's cloud sea
});

// ---------------------------------------------------------------- the ground's paint
/** '#rrggbb' as {r, g, b} in three.js's working space (linear sRGB), so a mix here matches a T.Color's own lerp. */
const lin = hex => { const n = parseInt(hex.slice(1), 16), f = v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return { r: f(n >> 16 & 255), g: f(n >> 8 & 255), b: f(n & 255) }; };
const mix = (c, to, t) => { c.r += (to.r - c.r) * t; c.g += (to.g - c.g) * t; c.b += (to.b - c.b) * t; };
const smooth = (v, a, b) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const len = (x, z) => Math.sqrt(x * x + z * z);
/** A soft halo of `color` round each disc of `list`: full at its edge, gone `reach` metres out (the family pond's sand, fields.mjs). */
const halo = (list, color, reach, strength = .85) => { const to = list.map(p => lin(typeof color === 'function' ? color(p) : color)); return (x, z, c) => { for (let i = 0; i < list.length; i++) { const d = len(list[i].x - x, list[i].z - z) - list[i].r; if (d < reach) mix(c, to[i], (1 - smooth(d, .4, reach)) * strength); } }; };
const pondSand = id => halo(FEATURES[id].ponds, p => POND_LOOKS[p.look].sand, 2.6);
const painter = (...steps) => (x, z, color) => { for (let i = 0; i < steps.length; i++) steps[i](x, z, color); return color; };
// The Cloud Meadow: pale cloud floor everywhere but on its eight grass islands, whose edges are soft over 3 m.
const CLOUD_FLOOR = lin('#e6f4ff'), CLOUD_PUFF = lin('#f6fbff');
function cloudFloor(x, z, c) {
  const list = FEATURES.cloud.islands; let near = Infinity;
  for (let i = 0; i < list.length; i++) { const d = len(list[i].x - x, list[i].z - z) - list[i].r; if (d < near) near = d; }
  const t = smooth(near, -1.5, 1.5); if (t <= 0) return;
  mix(c, CLOUD_FLOOR, t); mix(c, CLOUD_PUFF, t * .5 * (.5 + .5 * Math.sin(x * .21 + Math.sin(z * .17) * 2) * Math.sin(z * .19 + 1.3)));
}
// The Beach: the ground under the sea is sea-coloured (far tiles show it before the surface mesh is built), with wet sand at its edge.
const SEA_BLUE = lin('#56bce6'), WET_SAND = lin('#d9c184');
function beachSea(x, z, c) { const s = FEATURES.ocean.sea; if (x < s.x0 || x > s.x1 || z < s.z0 || z > s.z1) return; const d = Math.max(x - s.x, s.z - z); if (d > -3) mix(c, WET_SAND, smooth(d, -3, 0) * .7); if (d > 0) mix(c, SEA_BLUE, smooth(d, 0, 1.2)); }

export const GROUND = freeze({
  village: freeze({ base: '#93e06a' }),
  west: freeze({ base: '#5cbf57', paint: painter(pondSand('west')) }), north: freeze({ base: '#5fb889' }),
  south: freeze({ base: '#a6e070', paint: painter(pondSand('south')) }), east: freeze({ base: '#f1bb7c' }),
  toy: freeze({ low: '#ffe4ef', high: '#e2f0ff', patch: '#ffe4ef', checker: true, rim: '#fff4c8', paint: painter(pondSand('toy')) }),
  candy: freeze({ low: '#ff9fd0', high: '#ffc4e4', patch: '#ffd0ea', rim: '#ffe98a', paint: painter(pondSand('candy')) }), // the candy pond's pink sand
  jungle: freeze({ low: '#3f8a3a', high: '#5aa84a', patch: '#3c9440', rim: '#8a6a3a', paint: painter(pondSand('jungle')) }),
  ice: freeze({ low: '#cfe6fb', high: '#f4faff', patch: '#b9d6f2', rim: '#b9d6f2', paint: painter(pondSand('ice')) }),
  ocean: freeze({ low: '#f2dca0', high: '#e8cf8a', patch: '#f4e2b0', rim: '#56bce6', paint: painter(beachSea) }),
  lava: freeze({ low: '#6e5a60', high: '#8a6f6a', patch: '#55424a', scorch: '#3a2f3a', rim: '#4f4450', paint: painter(halo([...FEATURES.lava.pools, FEATURES.lava.nest, ...FEATURES.lava.vents], '#3a2f3a', 3.2, .9)) }),
  cloud: freeze({ low: '#bfe8a0', high: '#d8f5c0', patch: '#e6f4ff', rim: '#e1f3ff', paint: painter(cloudFloor) }),
  shadow: freeze({ low: '#2a2440', high: '#3a3258', patch: '#3b3160', rim: '#1e1a30', paint: painter(pondSand('shadow')) }),
});

// ---------------------------------------------------------------- light and tints (copied)
const light = (fog, sky, ground, sun, sunIntensity = 2.4) => freeze({ sky, ground, sun, sunIntensity, fog, background: fog });
/** PLANET_LIGHT (toon.ts:24-35) with each planet's sky colour as fog and background (content.ts PLANET_FACTS); lava's sun is 2.0 (LIGHT.lavaSun). */
export const LIGHTS = freeze({
  toy: light('#ffe9f6', '#fff6fb', '#ffc4e4', '#fff8f0'), candy: light('#ffc9ea', '#fff0fa', '#ff9fd0', '#fff0f6'),
  jungle: light('#bfe8b0', '#e8ffe0', '#3f7a3a', '#fff4c0'), ice: light('#d8f0ff', '#f4fbff', '#b8d8f0', '#f4fbff'),
  ocean: light('#aee8ff', '#e8fbff', '#6fb0d8', '#fffbe8'), lava: light('#ffb08a', '#ffd2b8', '#6a3a3a', '#ffc9a0', 2),
  cloud: light('#9fd8ff', '#ffffff', '#8fb8e8', '#ffffff'), shadow: light('#0d0b1a', '#6a6aa8', '#1a1430', '#8a8ad8'),
});
/** KIT_TINTS (world.ts:86-94): a planet's palette for the shared scenery kit, by material name ("A" the darker lower lobe, "B" the crown). The cloud has none. */
export const KIT_TINTS = freeze({
  candy: freeze({ 'Leaf A': '#ff7fb8', 'Leaf B': '#ffb8d9', 'Blossom A': '#a97cff', 'Blossom B': '#dcc8ff', 'Pine A': '#ff8a5c', 'Pine B': '#ffc49a', Bark: '#b06a52', Grass: '#ff9ccf', Rock: '#d7a3e8' }),
  ice: freeze({ 'Leaf A': '#8fcbe6', 'Leaf B': '#dcf5ff', 'Blossom A': '#b5e2fa', 'Blossom B': '#ecfaff', 'Pine A': '#7fbcd8', 'Pine B': '#d0f0fb', Bark: '#8b9db5', Grass: '#c6ecf7', Rock: '#b9d6e6' }),
  lava: freeze({ 'Leaf A': '#7e3f36', 'Leaf B': '#b0604a', 'Blossom A': '#ff6a2a', 'Blossom B': '#ffb36b', 'Pine A': '#6a3a32', 'Pine B': '#9a5a48', Bark: '#4a3434', Grass: '#8c5a48', Rock: '#5e4553' }),
  toy: freeze({ 'Leaf A': '#34b84a', 'Leaf B': '#8fe06a', 'Pine A': '#2f8fe0', 'Pine B': '#7cc8ff' }),
  jungle: freeze({ 'Leaf A': '#1c8a3a', 'Leaf B': '#3cc04e', 'Pine A': '#18763a', 'Pine B': '#2fae52', Grass: '#3fbf4f' }),
  shadow: freeze({ 'Leaf A': '#554a96', 'Leaf B': '#8f7fd6', 'Blossom A': '#8f6ff0', 'Blossom B': '#d3c3ff', 'Pine A': '#4a4080', 'Pine B': '#7a6cc0', Bark: '#3e3656', Grass: '#73699b', Rock: '#6d6690' }),
});
