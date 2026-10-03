// The Willowmere cottage plan, after the Zoo Garden cottage (cute_game src/house.ts): rooms, walls with doorways, the
// built-in furniture of every household, and the decorations the player can place in their own home (houseId 0).
// Pure data and geometry (no Three.js, no DOM), shared by game.mjs (decor actions and save checks), interior.mjs (the
// view) and the tests.
//
// Plan (x right, z toward the camera; the front door is on the camera side, z = 6). Low cut-away walls (front and the
// middle row) let the camera see in, like the reference's dollhouse; side walls and room partitions are full height.
//
//   z -6 +----------------+----------+----------------+
//        |   bedroom      |   bath   |    kitchen     |
//  z -1.4 +-----[ ]-------+---[ ]----+--[ ]-----------+   (low wall, three doorways)
//        |            living room          |  Pip's   |
//        |                                [ ] corner  |
//    z 6 +-------------[ door ]------------+----------+   (low front wall)
//     x -7            -1.6      1.8       3.9         7
//
// Interactive targets keep their types and ids (exit · bedroom/sleep · kitchen/cook · wardrobe/wardrobe ·
// person/<id>); the player spawns at (0, 4) and walks inside World.bounds {x: 6.4, z: 5.7}.

/** Furniture scale: the house kit is modelled at the reference's 1 m scale; Willowmere's people are 1.2x taller. */
export const K = 1.2;
const Q = Math.PI / 2;
export const ROOM = { w: 14, d: 12, full: 3.1, low: .66, thick: .22 };
export const SPAWN = { x: 0, z: 4 };
/** Interactive spots: where you stand to use a thing (World targets, radius in metres). */
export const SPOTS = {
  exit: { x: 0, z: 5.2, r: 1.6 },
  bedroom: { x: -3.35, z: -2.45, r: 1.8 },
  kitchen: { x: 3.6, z: -3.4, r: 1.8 },
  wardrobe: { x: -5.35, z: -2.55, r: 1.5 },
};
/**
 * The place kept for Pandora's box (pandora-view.mjs puts the chest here): against the living room's low back wall,
 * between the bedroom and the bathroom doorways, facing the camera. It is in view the moment you step in, on a phone
 * too (which sees about twelve of the house's fourteen metres, centred on you), and nothing stands in front of it.
 * `w` and `d` are the floor kept free for it; `body` is the chest's own footprint, a collider in your home, so you and
 * the family walk round it (houseColliders); `stand` is where you stand to use it: at its front right corner, so you do
 * not hide it, and a metre from the bathroom doorway's mouth, so a tap on the floor there still walks you through.
 * Decorations keep clear of the floor and of the stand spot (pandoraZones, keepClear), and a saved arrangement with a
 * piece there gets that piece back in storage (parseDecor).
 */
export const PANDORA_SPOT = { x: -1.18, z: -.82, rot: 0, w: 1.15, d: .9, body: [1.09, .81], stand: { x: -.45, z: .15 } };
/** Residents stand in the living room in front of the sofa: index i at (-1 + 1.7 i, 2.7). */
export const residentSpot = i => ({ x: -1 + i * 1.7, z: 2.7 });

export const ROOMS = [
  { id: 'bedroom', name: 'Bedroom', rect: { x0: -7, x1: -1.6, z0: -6, z1: -1.4 }, pattern: 'planks' },
  { id: 'bath', name: 'Bathroom', rect: { x0: -1.6, x1: 1.8, z0: -6, z1: -1.4 }, pattern: 'tiles' },
  { id: 'kitchen', name: 'Kitchen', rect: { x0: 1.8, x1: 7, z0: -6, z1: -1.4 }, pattern: 'tiles' },
  { id: 'living', name: 'Living room', rect: { x0: -7, x1: 3.9, z0: -1.4, z1: 6 }, pattern: 'planks' },
  { id: 'nook', name: 'Pip’s corner', rect: { x0: 3.9, x1: 7, z0: -1.4, z1: 6 }, pattern: 'planks' },
];
/** 'x': the wall runs along x at z = at; 'z': along z at x = at. Gaps are doorways [from, to]. */
export const WALLS = [
  { axis: 'x', at: -6, from: -7.11, to: 7.11, height: 'full', gaps: [] },
  { axis: 'x', at: 6, from: -7.11, to: 7.11, height: 'low', gaps: [[-1.05, 1.05]] },
  { axis: 'x', at: -1.4, from: -7, to: 7, height: 'low', gaps: [[-3.2, -1.8], [-.55, .95], [2.15, 3.55]] },
  { axis: 'z', at: -7, from: -6, to: 6, height: 'full', gaps: [] },
  { axis: 'z', at: 7, from: -6, to: 6, height: 'full', gaps: [] },
  { axis: 'z', at: -1.6, from: -6, to: -1.4, height: 'full', gaps: [] },
  { axis: 'z', at: 1.8, from: -6, to: -1.4, height: 'full', gaps: [] },
  { axis: 'z', at: 3.9, from: -1.4, to: 6, height: 'full', gaps: [[2.8, 4.4]] },
];
export const roomAt = p => ROOMS.find(r => p.x >= r.rect.x0 && p.x <= r.rect.x1 && p.z >= r.rect.z0 && p.z <= r.rect.z1);
/** The solid spans of a wall (its gaps cut out). */
export function wallSpans(wall) {
  const spans = [], cuts = [...wall.gaps].sort((a, b) => a[0] - b[0]); let at = wall.from;
  for (const [a, b] of cuts) { if (a > at) spans.push([at, a]); at = Math.max(at, b); }
  if (at < wall.to) spans.push([at, wall.to]);
  return spans;
}
/** Wall boxes as colliders {x, z, w, d}. */
export function wallBoxes() {
  const t = ROOM.thick, out = [];
  for (const wall of WALLS) for (const [a, b] of wallSpans(wall)) {
    const mid = (a + b) / 2, len = b - a;
    out.push(wall.axis === 'x' ? { x: mid, z: wall.at, w: len, d: t } : { x: wall.at, z: mid, w: t, d: len });
  }
  return out;
}

// ---------------------------------------------------------------- built-in furniture
// A piece: kit (house.glb node), x, z, rot (turns the front, +z, toward: 0 camera, Q +x, -Q -x, PI back wall), s (scale
// on top of K), y (lift: on a counter or table), block [w, d] (collision box in world axes, metres), glow (lamp shades,
// flames, window light stay bright), hang (wall piece: y is its centre height), role (what it is for: labels, hover).
const P = (kit, x, z, o = {}) => ({ kit, x, z, rot: 0, s: 1, y: 0, ...o });
/** House kit sizes at scale 1 (measured from house.glb): [width x, height y, depth z]. */
export const KIT_SIZE = {
  sofa: [2, 1.02, .86], armchair: [1, 1.02, .86], coffee_table: [.9, .63, .9], fireplace: [1.8, 1.97, .89], rug_round: [2.6, .03, 2.6], rug_rect: [2.2, .03, 1.5],
  bookshelf: [1.28, 2, .44], floor_lamp: [.6, 1.67, .6], plant_big: [.71, 1.42, .65], plant_small: [.28, .49, .27], dining_table: [1.4, 1.11, .9], chair: [.45, .97, .45],
  bed: [1.5, 1, 2.14], nightstand: [.5, .52, .5], lamp_small: [.32, .42, .34], wardrobe: [1.3, 2.17, .72], mirror: [.7, 1.54, .4], counter: [2.44, 1.2, .72], stove: [.8, 1.11, .71],
  fridge: [.75, 1.78, .75], bathtub: [1.75, .8, .92], sink: [.58, 1.6, .58], towel_rack: [.82, 1.02, .16], desk: [1.3, 1.16, .65], globe: [.55, 1.07, .44], workbench: [1.6, 1.23, .71],
  easel: [.75, 1.6, .59], yarn_basket: [.64, .62, .62], door_frame: [1.9, 2.46, .39], duck: [.17, .23, .3], stool: [.4, .48, .4], round_table: [1, .93, 1], welcome_mat: [1.2, .02, .7],
  trophy: [.33, .3, .22], radio: [.5, .6, .28], books: [.3, .2, .23], kettle: [.3, .33, .39], window: [1.5, 1.38, .24], picture: [.9, .65, .09], photo: [.42, .36, .07], painting: [.62, .5, .07],
};
/** The axis-aligned footprint [w, d] of a kit piece turned by rot (scaled by K and s, shrunk a little). */
export function kitFootprint(kit, rot = 0, s = 1, shrink = .92) {
  const [w0, , d0] = KIT_SIZE[kit] ?? [.6, 1, .6], w = w0 * K * s * shrink, d = d0 * K * s * shrink, c = Math.abs(Math.cos(rot)), n = Math.abs(Math.sin(rot));
  return [w * c + d * n, w * n + d * c];
}
const blocked = (p, shrink = .94) => ({ ...p, block: kitFootprint(p.kit, p.rot, p.s, shrink) });

/** One signature piece per household in the right-hand corner, so homes differ in what is in them too. */
const SIGNATURE = { 1: 'yarn_basket', 2: 'workbench', 3: 'plant_big', 4: 'globe', 5: 'easel', 6: 'round_table', 7: 'workbench', 8: 'bookshelf', 9: 'plant_big' };

/**
 * The built-in furniture of a household. Your homestead grows with its upgrades (kitchen and home tiers); other
 * households show their whole home. `reserve` lists every tier's pieces (decorations keep clear of future upgrades).
 */
export function fixedPieces(houseId = 0, s = {}, { reserve = false, hasChild = true } = {}) {
  const home = Number(houseId) === 0, up = s.upgrades ?? {}, kitchen = home && !reserve ? up.kitchen ?? 0 : 3, house = home && !reserve ? up.house ?? 0 : 3;
  const art = !home || (s.furniture ?? []).includes('art') || reserve;
  const out = [
    // Windows (glowing panes) on the back and side walls, a picture over the bed.
    P('window', -2.75, -5.86, { hang: true, y: 1.95, glow: true }),
    P('window', .12, -5.86, { hang: true, y: 2.0, glow: true }),
    P('window', 6.86, -3.55, { hang: true, y: 2.0, rot: -Q, glow: true }),
    P('window', -6.86, .55, { hang: true, y: 1.95, rot: Q, glow: true }),
    P('window', 6.86, 4.65, { hang: true, y: 1.95, rot: -Q, glow: true }),
    P('picture', -4.4, -5.9, { hang: true, y: 2.35 }),
    // Bedroom: the bed against the back wall, nightstand and lamp, the wardrobe on the left wall, a mirror.
    blocked(P('bed', -4.4, -4.62, { role: 'bed' })),
    blocked(P('nightstand', -5.75, -5.5)),
    P('lamp_small', -5.75, -5.5, { y: .52 * K, glow: true }),
    blocked(P('wardrobe', -6.45, -3.0, { rot: Q, role: 'wardrobe' })),
    blocked(P('mirror', -1.98, -4.35, { rot: -Q, role: 'mirror' })),
    P('rug_round', -4.15, -2.42, { s: .62, flat: true }),
    // Bathroom: tub with a duck, sink, towels, a bath mat.
    blocked(P('bathtub', -.42, -5.3, { role: 'bath' })),
    P('duck', -.05, -5.28, { y: .52 * K, rot: -.5, role: 'duck' }),
    blocked(P('sink', 1.22, -5.48, { role: 'sink' })),
    blocked(P('towel_rack', -1.4, -3.2, { rot: Q })),
    P('rug_rect', .2, -3.1, { s: .55, flat: true }),
    // Kitchen: counter, stove and fridge along the back wall, the kettle on the counter.
    blocked(P('counter', 3.45, -5.45, { role: 'kitchen' }), .97),
    blocked(P('stove', 5.43, -5.45, { role: 'kitchen' }), .97),
    blocked(P('fridge', 6.42, -5.42, { role: 'kitchen' }), .97),
    P('kettle', 2.55, -5.42, { y: .92 * K, rot: -.3 }),
    // Living room: the sofa against the low wall facing the camera, a coffee table on a round rug, the front door.
    blocked(P('sofa', -4.7, -.55, { s: .95, role: 'sofa' })),
    P('rug_round', -4.7, .8, { flat: true }),
    blocked(P('coffee_table', -4.7, 1.0, { role: 'teatable' })),
    P('kettle', -4.55, .92, { y: .63 * K, rot: .4, role: 'tea' }),
    P('door_frame', 0, 6.0, { glow: true, role: 'door' }),
    P('welcome_mat', 0, 5.3, { flat: true }),
  ];
  // Kitchen tiers: a little round table, then herbs and a mat, then recipe books.
  if (kitchen >= 1) out.push(blocked(P('round_table', 5.55, -2.85)), blocked(P('stool', 4.6, -2.65)), blocked(P('stool', 6.48, -2.3)));
  if (kitchen >= 2) out.push(P('plant_small', 3.75, -5.5, { y: 1.1, s: 1.1 }), P('plant_small', 4.45, -5.52, { y: 1.1 }), P('rug_rect', 3.4, -3.2, { s: .7, flat: true }));
  if (kitchen >= 3) out.push(P('books', 2.05 + .25, -5.5, { y: 1.1, rot: .4 }));
  // Pip's corner: a child's bed (home tier 1, or a household with a child), Pip's desk (tier 2).
  if (home ? house >= 1 : hasChild) out.push(blocked(P('bed', 5.45, .02, { s: .85, role: 'kidbed' })));
  if (home && house >= 2) out.push(blocked(P('desk', 6.45, 2.3, { rot: -Q, glow: true, role: 'desk' })), blocked(P('chair', 5.72, 2.3, { rot: Q })));
  if (!home && SIGNATURE[houseId]) out.push(blocked(P(SIGNATURE[houseId], hasChild ? 6.3 : 5.5, hasChild ? 2.6 : .4, { rot: -Q, s: SIGNATURE[houseId] === 'workbench' ? 1 : 1.05 })));
  // The fireplace (home tier 3) on the left wall of the living room.
  if (home ? house >= 3 : houseId % 2 === 1) out.push(blocked(P('fireplace', -6.36, 3.3, { rot: Q, glow: true, role: 'fireplace' })));
  // The memory wall (Gathering art set): a painting and photos.
  if (art) out.push(P('painting', -6.9, 5.1, { hang: true, y: 1.85, rot: Q, s: 1.25 }), P('photo', -6.9, -.55, { hang: true, y: 2.2, rot: Q, s: 1.3 }), P('photo', 6.9, .1, { hang: true, y: 2.25, rot: -Q, s: 1.3 }));
  return out;
}

// ---------------------------------------------------------------- decorations
/** Catalog groups, in the order the Decorate panel shows them (reference item-groups.ts headers). */
export const DECOR_GROUPS = [
  ['seating', '🪑', 'Seating'], ['tables', '🍽️', 'Tables'], ['storage', '📚', 'Shelves'], ['lights', '💡', 'Lights'],
  ['plants', '🪴', 'Plants'], ['rugs', '🧶', 'Rugs'], ['fun', '🎨', 'Keepsakes'],
];
/**
 * Pieces the player can place, move, turn and pack away in their home. `from` says where they come from: 'starter'
 * (every home has them) or a FURNITURE set bought at the Vale workshop ('rug', 'sofa', 'plants', 'books', 'dining',
 * 'art'), with how many. `flat` pieces (rugs) lie on the floor: you walk over them and things stand on them.
 */
export const DECOR = {
  armchair: { name: 'Sunny armchair', kit: 'armchair', group: 'seating', from: [['sofa', 1]], desc: 'A deep yellow chair for long stories.' },
  stool: { name: 'Painted stool', kit: 'stool', group: 'seating', from: [['starter', 1], ['dining', 1]], desc: 'Small, sturdy, always where you need it.' },
  chair: { name: 'Wooden chair', kit: 'chair', group: 'seating', from: [['dining', 2]], desc: 'Pull up a chair, there is room.' },
  dining_table: { name: 'Gathering table', kit: 'dining_table', group: 'tables', from: [['dining', 1]], desc: 'There is always room for one more guest.' },
  side_table: { name: 'Round side table', kit: 'round_table', group: 'tables', s: .8, from: [['starter', 1]], desc: 'Just right for a teapot and a book.' },
  bookshelf: { name: 'Family bookshelf', kit: 'bookshelf', group: 'storage', from: [['books', 1]], desc: 'Books and all the stories to come.' },
  floor_lamp: { name: 'Reading lamp', kit: 'floor_lamp', group: 'lights', from: [['sofa', 1]], glow: true, desc: 'A warm pool of light for evenings.' },
  fern: { name: 'Potted fern', kit: 'plant_big', group: 'plants', from: [['starter', 2], ['plants', 1]], desc: 'A leafy friend for a bright corner.' },
  herb: { name: 'Herb pot', kit: 'plant_small', group: 'plants', s: 1.5, from: [['plants', 2]], desc: 'Basil and thyme, a little garden indoors.' },
  rug_rect: { name: 'Meadow rug', kit: 'rug_rect', group: 'rugs', s: 1.2, flat: true, from: [['rug', 1]], desc: 'A woven rug in Leo’s best colours.' },
  rug_round: { name: 'Round rag rug', kit: 'rug_round', group: 'rugs', s: .7, flat: true, from: [['rug', 1]], desc: 'Soft under bare feet.' },
  basket: { name: 'Yarn basket', kit: 'yarn_basket', group: 'fun', from: [['starter', 1]], desc: 'June’s knitting, never quite finished.' },
  easel: { name: 'Painter’s easel', kit: 'easel', group: 'fun', from: [['art', 1]], desc: 'Pip paints the willow, again and again.' },
  globe: { name: 'Spinning globe', kit: 'globe', group: 'fun', from: [['art', 1]], desc: 'Every road leads back to Willowmere.' },
};
export const MAX_DECOR = 40;
/** The FURNITURE set names, for "From the …" lines (content.mjs FURNITURE names, kept here to stay pure). */
export const SET_NAMES = { starter: 'A housewarming gift', rug: 'Woven meadow rug', sofa: 'Sunday reading nook', plants: 'Windowsill garden', books: 'Family library', dining: 'Gathering table', art: 'Memory wall' };
const unlocked = (s, source) => source === 'starter' || (s.furniture ?? []).includes(source);
/** How many of a piece the home owns (placed or in storage). */
export function ownedCount(s, id) { const d = DECOR[id]; return d ? d.from.reduce((n, [source, k]) => n + (unlocked(s, source) ? k : 0), 0) : 0; }
/** The footprint [w, d] of a decoration turned by rot. */
export const decorFootprint = (id, rot = 0) => kitFootprint(DECOR[id]?.kit, rot, DECOR[id]?.s ?? 1, .9);
/**
 * Where the pieces of a set go when it arrives (and the starter gifts): the default arrangement, used while the player
 * has not rearranged anything (state.decor === null) and for the other households.
 */
export const DEFAULT_SPOTS = [
  { id: 'fern', x: -6.3, z: 5.3, rot: 0 }, { id: 'fern', x: 3.25, z: 5.3, rot: 0 }, { id: 'fern', x: 6.35, z: 5.3, rot: 0 },
  { id: 'basket', x: 4.55, z: 5.25, rot: .5 }, { id: 'stool', x: 6.5, z: -.85, rot: 0, need: 'dining' },
  { id: 'armchair', x: -4.75, z: 3.85, rot: .55 }, { id: 'floor_lamp', x: -6.35, z: -.8, rot: 0 },
  { id: 'herb', x: -1.75, z: 5.45, rot: 0 }, { id: 'herb', x: 1.6, z: -.95, rot: 0 }, // one by the front door (Pandora's box has the wall between the doorways), one by the back wall
  { id: 'rug_rect', x: 1.3, z: .75, rot: 0 }, { id: 'rug_round', x: 5.45, z: 3.55, rot: 0 },
  { id: 'dining_table', x: 1.3, z: .75, rot: 0 }, { id: 'chair', x: 1.3, z: -.15, rot: 0 }, { id: 'chair', x: 1.3, z: 1.65, rot: Math.PI },
  { id: 'bookshelf', x: 3.5, z: 2.0, rot: -Q },
  { id: 'easel', x: 4.75, z: 1.95, rot: -.4 }, { id: 'globe', x: -3.1, z: 5.25, rot: .3 },
];
/**
 * The default arrangement for what a home owns: each owned piece fills its default spots in order (a spot with `need`
 * only when that set is owned). Gifts without a spot (a stool, a side table) wait in storage for you to place them.
 */
export function defaultDecor(s) {
  const left = {}; for (const id of Object.keys(DECOR)) left[id] = ownedCount(s, id);
  return DEFAULT_SPOTS.filter(p => (!p.need || unlocked(s, p.need)) && left[p.id]-- > 0).map(({ id, x, z, rot }) => ({ id, x, z, rot }));
}
/** What stands in the home now: the player's own arrangement, or the default one. */
export const decorLayout = s => Array.isArray(s.decor) ? s.decor : defaultDecor(s);
export const placedCount = (s, id) => decorLayout(s).filter(d => d.id === id).length;
export const storedCount = (s, id) => Math.max(0, ownedCount(s, id) - placedCount(s, id));

// ---------------------------------------------------------------- where a piece may stand
const box = (x, z, w, d) => ({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
const overlap = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
const circleHits = (b, c, r) => { const dx = Math.max(b.x0 - c.x, 0, c.x - b.x1), dz = Math.max(b.z0 - c.z, 0, c.z - b.z1); return dx * dx + dz * dz < r * r; };
/** The floor kept for Pandora's box and the spot you use it from. */
export const pandoraZones = () => [box(PANDORA_SPOT.x, PANDORA_SPOT.z, PANDORA_SPOT.w + .1, PANDORA_SPOT.d + .1), box(PANDORA_SPOT.stand.x, PANDORA_SPOT.stand.z, .9, .7)];
/** Places that must stay free so every room and every interactive spot can be reached. */
export function keepClear() {
  const zones = [box(0, 4.7, 2.8, 2.6), ...pandoraZones()]; // the way in from the front door; Pandora's box and where you stand at it
  for (const wall of WALLS) for (const [a, b] of wall.gaps) {
    if (wall.axis === 'x' && wall.at === 6) continue;
    zones.push(wall.axis === 'x' ? { x0: a - .05, x1: b + .05, z0: wall.at - 1.05, z1: wall.at + 1.05 } : { x0: wall.at - 1.05, x1: wall.at + 1.05, z0: a - .05, z1: b + .05 });
  }
  return zones;
}
const SPOT_CIRCLES = () => [...Object.values(SPOTS).map(p => ({ ...p, r: .8 })), { ...SPAWN, r: .85 }, ...[0, 1, 2].map(i => ({ ...residentSpot(i), r: .6 }))];
/** Inner faces of the outer walls. */
const INNER = { x0: -7 + ROOM.thick / 2 + .02, x1: 7 - ROOM.thick / 2 - .02, z0: -6 + ROOM.thick / 2 + .02, z1: 6 - ROOM.thick / 2 - .02 };

/**
 * Why a decoration cannot stand at (x, z) turned by rot, or null when it can. `ignore` is the layout index of the piece
 * being moved. Checks the house walls, the built-in furniture of every home tier, the doorways and the spots people use,
 * and the other placed pieces; rugs only need to lie inside the house without crossing a wall.
 */
export function spotProblem(s, id, x, z, rot = 0, ignore = -1) {
  const d = DECOR[id];
  if (!d) return 'That piece is not part of your home.';
  if (![x, z, rot].every(Number.isFinite)) return 'Choose a spot on the floor.';
  const [w, dd] = decorFootprint(id, rot), b = box(x, z, w, dd);
  if (b.x0 < INNER.x0 || b.x1 > INNER.x1 || b.z0 < INNER.z0 || b.z1 > INNER.z1) return 'Keep it inside the house.';
  if (wallBoxes().some(c => overlap(b, box(c.x, c.z, c.w + .04, c.d + .04)))) return 'Too close to a wall.';
  if (d.flat) return null;
  if (fixedPieces(0, s, { reserve: true }).some(p => p.block && !p.flat && overlap(b, box(p.x, p.z, p.block[0], p.block[1])))) return 'Something is already there.';
  if (pandoraZones().some(zone => overlap(b, zone))) return 'That place is kept for the Pandora box.';
  if (keepClear().some(zone => overlap(b, zone))) return 'Keep the doorways clear.';
  if (SPOT_CIRCLES().some(c => circleHits(b, c, c.r))) return 'Leave room to walk there.';
  const layout = decorLayout(s);
  for (let i = 0; i < layout.length; i++) {
    const o = layout[i]; if (i === ignore || !DECOR[o.id] || DECOR[o.id].flat) continue;
    const [ow, od] = decorFootprint(o.id, o.rot); if (overlap(b, box(o.x, o.z, ow, od))) return 'Something is already there.';
  }
  return null;
}
/** Colliders for World (x, z, w, d): walls, built-in furniture and the decorations standing in the home. */
export function houseColliders(houseId, s, { skip = -1, hasChild = true } = {}) {
  const out = wallBoxes();
  for (const p of fixedPieces(houseId, s, { hasChild })) if (p.block && !p.flat && !p.hang) out.push({ x: p.x, z: p.z, w: p.block[0], d: p.block[1] });
  if (Number(houseId) === 0) out.push({ x: PANDORA_SPOT.x, z: PANDORA_SPOT.z, w: PANDORA_SPOT.body[0], d: PANDORA_SPOT.body[1] }); // Pandora's box stands in your home
  const layout = Number(houseId) === 0 ? decorLayout(s) : defaultDecor({ furniture: Object.keys(SET_NAMES) });
  layout.forEach((p, i) => { if (i === skip || !DECOR[p.id] || DECOR[p.id].flat) return; const [w, d] = decorFootprint(p.id, p.rot); out.push({ x: p.x, z: p.z, w, d }); });
  return out;
}

// ---------------------------------------------------------------- actions (game.mjs act() delegates here)
const TURN = Math.PI / 4, TAU = Math.PI * 2;
const angle = r => Math.round((((r % TAU) + TAU) % TAU) * 1000) / 1000;
const pos = v => Math.round(v * 100) / 100;
const result = (ok, message) => ({ ok, message });
/** The arrangement to edit: the default one becomes the player's own the first time anything is moved. */
const editable = s => { if (!Array.isArray(s.decor)) s.decor = defaultDecor(s).map(p => ({ ...p })); return s.decor; };

/** Place a piece from storage ({id, x, z, rot}) or move a placed one ({index, x, z, rot}). */
export function placeDecor(s, arg = {}) {
  const x = Number(arg.x), z = Number(arg.z), rot = angle(Number(arg.rot ?? 0));
  if (Number.isInteger(arg.index)) {
    const layout = decorLayout(s), piece = layout[arg.index];
    if (!piece) return result(false, 'That piece is not in your home.');
    const problem = spotProblem(s, piece.id, x, z, rot, arg.index); if (problem) return result(false, problem);
    const list = editable(s); Object.assign(list[arg.index], { x: pos(x), z: pos(z), rot });
    return result(true, `${DECOR[piece.id].name} moved.`);
  }
  const d = DECOR[arg.id];
  if (!d) return result(false, 'That piece is not part of your home.');
  if (storedCount(s, arg.id) < 1) return result(false, ownedCount(s, arg.id) ? `Every ${d.name.toLowerCase()} is already placed.` : 'Find this piece at the Vale workshop first.');
  if (decorLayout(s).length >= MAX_DECOR) return result(false, `Your home already holds ${MAX_DECOR} pieces.`);
  const problem = spotProblem(s, arg.id, x, z, rot); if (problem) return result(false, problem);
  editable(s).push({ id: arg.id, x: pos(x), z: pos(z), rot });
  return result(true, `${d.name} placed.`);
}
/** Turn a placed piece 45° (or to `rot`). */
export function rotateDecor(s, arg = {}) {
  const piece = Number.isInteger(arg.index) ? decorLayout(s)[arg.index] : null;
  if (!piece) return result(false, 'That piece is not in your home.');
  const rot = angle(arg.rot === undefined ? piece.rot + TURN : Number(arg.rot));
  const problem = spotProblem(s, piece.id, piece.x, piece.z, rot, arg.index); if (problem) return result(false, `No room to turn it here. ${problem}`);
  editable(s)[arg.index].rot = rot;
  return result(true, `${DECOR[piece.id].name} turned.`);
}
/** Pack a placed piece away into storage. */
export function removeDecor(s, arg = {}) {
  const piece = Number.isInteger(arg.index) ? decorLayout(s)[arg.index] : null;
  if (!piece) return result(false, 'That piece is not in your home.');
  editable(s).splice(arg.index, 1);
  return result(true, `${DECOR[piece.id].name} packed away.`);
}
/**
 * A saved arrangement, checked: known pieces inside the house, no more of each than the home owns. A piece that stands
 * on the place kept for Pandora's box (or where you stand to use it) is left out, which puts it back in storage: saves
 * from before the box had that place may have one there (the herb pot that used to stand by that wall, for one).
 */
export function parseDecor(raw, s) {
  if (!Array.isArray(raw)) return null;
  const seen = {}, out = [];
  for (const p of raw.slice(0, MAX_DECOR * 2)) {
    if (!p || typeof p !== 'object' || !DECOR[p.id] || ![p.x, p.z].every(v => typeof v === 'number' && Number.isFinite(v))) continue;
    if (Math.abs(p.x) > 7 || Math.abs(p.z) > 6) continue;
    if (!DECOR[p.id].flat) { const [w, d] = decorFootprint(p.id, typeof p.rot === 'number' && Number.isFinite(p.rot) ? p.rot : 0), b = box(p.x, p.z, w, d); if (pandoraZones().some(zone => overlap(b, zone))) continue; }
    if ((seen[p.id] = (seen[p.id] ?? 0) + 1) > ownedCount(s, p.id)) continue;
    out.push({ id: p.id, x: pos(p.x), z: pos(p.z), rot: angle(typeof p.rot === 'number' && Number.isFinite(p.rot) ? p.rot : 0) });
    if (out.length >= MAX_DECOR) break;
  }
  return out;
}
