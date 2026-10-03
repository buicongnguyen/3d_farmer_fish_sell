// Things to do at home and where the family spends its time, after Zoo Garden's cottage (cute_game
// src/house-activities.ts), under Willowmere's rules: there are no health buffs here, so a rest restores energy.
// Pure rules and data (no three.js, no DOM): game.mjs runs them (act 'houseUse'), house-life.mjs shows them, the tests
// check them.
//
// Cooldowns run on state.elapsed (seconds of active play), so a changed clock cannot farm them and a night's sleep
// (+180 s) makes most things ready again. Saved part: state.house = {used: {id: elapsed}, paintings, paintDay}.
import { CROPS, ITEMS, TREES, RESIDENTS, CHAPTERS, FURNITURE, OUTFITS, KID_OUTFITS } from './content.mjs';
import { GEAR } from './gear.mjs';
import { PAID } from './looks.mjs';

/**
 * kind 'rest': restores `energy` and cools down for `cooldown` seconds; 'paint': a picture for the album (and, once a
 * day, a friendship point with Pip); 'log': opens the collection log; 'fun': a line and a sparkle.
 * `role` activities belong to built-in furniture (home-plan.mjs fixedPieces roles), `decor` ones to a placed decoration.
 */
export const ACTIVITIES = {
  sofa: { role: 'sofa', kind: 'rest', icon: '🛋️', name: 'Sofa', verb: 'Sit a while', energy: 20, cooldown: 120, line: 'You sink into the sofa for a moment. Home feels good.' },
  tea: { role: 'tea', kind: 'rest', icon: '🫖', name: 'Kettle', verb: 'Pour a cup of tea', energy: 12, cooldown: 90, line: 'June kept the kettle warm. One cup, just right.' },
  bath: { role: 'bath', kind: 'rest', icon: '🛁', name: 'Bathtub', verb: 'Run a bath', energy: 30, cooldown: 240, line: 'Warm water and lavender soap. Pip insists on bubbles.' },
  sink: { role: 'sink', kind: 'rest', icon: '🚰', name: 'Sink', verb: 'Wash your hands', energy: 5, cooldown: 60, line: 'Fresh, cold water from the old well pipe.' },
  fireplace: { role: 'fireplace', kind: 'rest', icon: '🔥', name: 'Fireplace', verb: 'Warm your hands', energy: 10, cooldown: 120, line: 'The fire crackles. Ada used to roast chestnuts here.' },
  duck: { role: 'duck', kind: 'fun', icon: '🦆', name: 'Duck', verb: 'Squeeze the duck', line: 'Squeak! The rubber duck has seen many adventures.' },
  desk: { role: 'desk', kind: 'fun', icon: '✏️', name: 'Pip’s desk', verb: 'Peek at the homework', line: 'Pip’s homework: “My family”, three stick figures and one very large chicken.' },
  kidbed: { role: 'kidbed', kind: 'fun', icon: '🧸', name: 'Little bed', verb: 'Look at the drawings', line: 'A patchwork quilt and a row of drawings pinned above it.' },
  armchair: { decor: 'armchair', kind: 'rest', icon: '🛋️', name: 'Armchair', verb: 'Curl up with a book', energy: 15, cooldown: 120, line: 'A chapter in the sunny armchair. Lovely.' },
  bookshelf: { decor: 'bookshelf', kind: 'log', icon: '📚', name: 'Bookshelf', verb: 'Collection log', line: 'The family’s notes on everything found so far.' },
  easel: { decor: 'easel', kind: 'paint', icon: '🎨', name: 'Easel', verb: 'Paint a little', cooldown: 150, line: 'A few strokes of willow green. Pip says it needs a chicken.' },
  globe: { decor: 'globe', kind: 'fun', icon: '🌍', name: 'Globe', verb: 'Spin the globe', line: 'Round and round… it stops on Willowmere, of course.' },
  basket: { decor: 'basket', kind: 'fun', icon: '🧶', name: 'Yarn', verb: 'Knit a row', line: 'One more row on June’s scarf. It is getting very long.' },
  dining_table: { decor: 'dining_table', kind: 'fun', icon: '🍽️', name: 'Table', verb: 'Set the table', line: 'Plates, cups and a jar of wildflowers. Supper will be lovely.' },
};
for (const [id, a] of Object.entries(ACTIVITIES)) a.id = id;
export const activityForRole = role => Object.values(ACTIVITIES).find(a => a.role === role);
export const activityForDecor = id => Object.values(ACTIVITIES).find(a => a.decor === id);
export const MAX_PAINTINGS = 99;
export const freshHouse = () => ({ used: {}, paintings: 0, paintDay: 0 });
/** Seconds of play until `id` can be used again (0 = ready); never more than its cooldown. */
export function cooldownLeft(s, id) {
  const a = ACTIVITIES[id], at = s.house?.used?.[id];
  if (!a?.cooldown || typeof at !== 'number') return 0;
  return Math.min(a.cooldown, Math.max(0, at + a.cooldown - (s.elapsed ?? 0)));
}
export const mmss = seconds => { const t = Math.ceil(seconds); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
/**
 * game.mjs act(s, 'houseUse', {id}). Rest: energy (never above 100) and a cooldown; a rest at full energy is still a
 * nice moment but starts no cooldown. Returns {ok, message, gained?, kind}.
 */
export function useActivity(s, arg = {}) {
  const a = ACTIVITIES[arg.id]; if (!a) return { ok: false, message: 'Nothing to do here.' };
  if (a.kind === 'fun' || a.kind === 'log') return { ok: true, message: a.line, kind: a.kind };
  const left = cooldownLeft(s, a.id);
  if (left > 0) return { ok: false, message: `${a.name} is ready again in ${mmss(left)}.`, kind: a.kind };
  const house = (s.house ??= freshHouse()); house.used ??= {};
  if (a.kind === 'rest') {
    const before = s.energy, gained = Math.max(0, Math.min(100, before + a.energy) - before);
    s.energy = before + gained; if (gained > 0) house.used[a.id] = s.elapsed ?? 0;
    return { ok: true, message: gained > 0 ? `${a.line} +${Math.round(gained)} energy` : a.line, gained, kind: 'rest' };
  }
  // paint
  house.used[a.id] = s.elapsed ?? 0; house.paintings = Math.min(MAX_PAINTINGS, (house.paintings ?? 0) + 1);
  let extra = '';
  if (house.paintDay !== s.day) { house.paintDay = s.day; s.friendship ??= {}; if ((s.friendship.pip ?? 0) < 10) { s.friendship.pip = (s.friendship.pip ?? 0) + 1; extra = ' Pip paints beside you. Friendship +1'; } }
  return { ok: true, message: `${a.line} Picture number ${house.paintings} for the album.${extra}`, kind: 'paint' };
}
/** Sanitises the saved house part: stamps not after `elapsed`, a sensible count. */
export function parseHouse(raw, s) {
  const out = freshHouse(), elapsed = s?.elapsed ?? 0;
  if (raw && typeof raw === 'object') {
    for (const id of Object.keys(ACTIVITIES)) { const t = raw.used?.[id]; if (typeof t === 'number' && Number.isFinite(t) && t >= 0 && t <= elapsed) out.used[id] = t; }
    if (Number.isSafeInteger(raw.paintings) && raw.paintings > 0) out.paintings = Math.min(MAX_PAINTINGS, raw.paintings);
    if (Number.isSafeInteger(raw.paintDay) && raw.paintDay > 0 && raw.paintDay <= (s?.day ?? 1)) out.paintDay = raw.paintDay;
  }
  return out;
}

// ---------------------------------------------------------------- the collection log (the bookshelf)
const HARVEST = [...Object.keys(CROPS), ...Object.keys(TREES)], FISH = ['perch', 'carp', 'catfish', 'koi', 'rainbow', 'golden'];
const PANTRY = Object.keys(ITEMS).filter(id => !HARVEST.includes(id) && !FISH.includes(id));
/** Every item id the log counts. */
export const COLLECTIBLES = [...HARVEST, ...FISH, ...PANTRY];
/** Marks an item as found (game.mjs add()). */
export const markFound = (s, id) => { if (s.found && !s.found[id] && COLLECTIBLES.includes(id)) s.found[id] = 1; };
export function parseFound(raw, s) {
  const out = {};
  for (const id of COLLECTIBLES) if (raw?.[id] || (s.inventory?.[id] ?? 0) > 0) out[id] = 1;
  return out;
}
/** What the family has found, grown, met and made, as counts and a percentage. */
export function collectionLog(s) {
  const found = s.found ?? {}, have = list => list.filter(id => found[id] || (s.inventory?.[id] ?? 0) > 0).length;
  const row = (id, label, icon, n, total) => ({ id, label, icon, have: Math.min(n, total), total, pct: total ? Math.round(Math.min(n, total) / total * 100) : 0 });
  const tiers = Object.values(s.upgrades ?? {}).reduce((n, v) => n + v, 0);
  const wardrobe = Math.max(0, (s.owned?.length ?? 1) - 1) + (s.kidOwned?.length ?? 0) + (s.gearOwned?.length ?? 0) + (s.looksOwned?.length ?? 0);
  const rows = [
    row('harvest', 'Harvest grown', '🥕', have(HARVEST), HARVEST.length),
    row('fish', 'Fish caught', '🐟', have(FISH), FISH.length),
    row('pantry', 'Pantry & finds', '🧺', have(PANTRY), PANTRY.length),
    row('neighbours', 'Neighbours met', '👋', Object.keys(s.met ?? {}).length, RESIDENTS.length),
    row('album', 'Family album', '📖', s.chapter ?? 0, CHAPTERS.length),
    row('home', 'Home & farm tiers', '🏡', tiers, 15),
    row('furniture', 'Furniture sets', '🛋️', s.furniture?.length ?? 0, FURNITURE.length),
    row('wardrobe', 'Wardrobe & looks', '👗', wardrobe, OUTFITS.length - 1 + KID_OUTFITS.length + Object.keys(GEAR).length + PAID.length),
  ];
  return { rows, pct: Math.round(rows.reduce((n, r) => n + r.pct, 0) / rows.length), paintings: s.house?.paintings ?? 0 };
}

// ---------------------------------------------------------------- where the family spends its time
const Q = Math.PI / 2;
/**
 * Hangouts: a spot (x, z) to walk to, which way to face, what to do there. `seat` is where the sitter ends up (off the
 * walkable floor: on the sofa), reached with a little hop from the spot. A hangout a decoration stands on is skipped
 * (usableHangouts), so the player may furnish freely.
 */
export const HANGOUTS = [
  { id: 'hello', room: 'living', x: -1, z: 2.7, facing: 0, pose: 'wave' },
  { id: 'chat', room: 'living', x: .7, z: 2.7, facing: -.25, pose: 'stand' },
  { id: 'door', room: 'living', x: 2.4, z: 2.7, facing: .3, pose: 'stand' },
  { id: 'sofa', room: 'living', x: -3.15, z: -.3, facing: 0, pose: 'sit', seat: { x: -4.2, z: -.42, y: .5 } },
  { id: 'teatime', room: 'living', x: -3.7, z: 2.2, facing: -2.45, pose: 'sip' },
  { id: 'counter', room: 'kitchen', x: 3.3, z: -4.35, facing: Math.PI, pose: 'stir' },
  { id: 'fridge', room: 'kitchen', x: 5.85, z: -4.25, facing: .2, pose: 'sip' },
  { id: 'bedside', room: 'bedroom', x: -4.4, z: -2.75, facing: 0, pose: 'stretch' },
  { id: 'basin', room: 'bath', x: .9, z: -3.9, facing: Math.PI, pose: 'brush' },
  { id: 'toys', room: 'nook', x: 5.2, z: 4.3, facing: -.4, pose: 'read' },
  { id: 'drawing', room: 'nook', x: 4.75, z: 1.95, facing: Q, pose: 'paint' },
];
export const hangout = id => HANGOUTS.find(h => h.id === id);
/** Where each kind of person drifts, in turn. */
const ADULT_ROUND = ['counter', 'sofa', 'hello', 'bedside', 'teatime', 'basin', 'chat', 'fridge'];
const CHILD_ROUND = ['toys', 'hello', 'drawing', 'chat', 'teatime', 'door', 'toys', 'sofa'];
const EVENING = ['sofa', 'teatime', 'hello', 'chat', 'door'];
/** How long a stay lasts (seconds of play). */
export const STAY_SECONDS = 24;
const clear = (cols, x, z, pad = .34) => Math.abs(x) <= 6.4 && Math.abs(z) <= 5.7 && !cols.some(c => Math.abs(x - c.x) < c.w / 2 + pad && Math.abs(z - c.z) < c.d / 2 + pad);
/** The hangout ids nothing stands on, given the home's colliders ({x, z, w, d}). */
export function usableHangouts(colliders) { return HANGOUTS.filter(h => clear(colliders, h.x, h.z)).map(h => h.id); }
/**
 * A hangout for each person: by the hour (mornings in the kitchen and the nook, evenings together in the living room)
 * and otherwise each in their own round, moving on every stay. One person per hangout; an unusable or taken one passes
 * to the next in the round.
 * @param {{child:boolean}[]} people @param {number} phase the stay number @param {number} hour the game clock (7–22)
 * @param {string[]} usable usableHangouts() @returns {(string|null)[]}
 */
export function assignHangouts(people, phase, hour, usable) {
  const taken = new Set(), out = [];
  people.forEach((p, i) => {
    const round = hour >= 18 ? EVENING : p.child ? CHILD_ROUND : ADULT_ROUND;
    const first = hour < 11 && phase % 2 === 0 ? 0 : (phase + i * 3) % round.length;
    let pick = null;
    for (let k = 0; k < round.length && !pick; k++) { const id = round[(first + k) % round.length]; if (usable.includes(id) && !taken.has(id)) pick = id; }
    if (!pick) pick = usable.find(id => !taken.has(id)) ?? null;
    if (pick) taken.add(pick); out.push(pick);
  });
  return out;
}
/** Doorway waypoints: [room side, living-room side] for each room that opens onto the living room. */
export const DOORS = { bedroom: [{ x: -2.5, z: -2.2 }, { x: -2.5, z: -.6 }], bath: [{ x: .2, z: -2.2 }, { x: .2, z: -.6 }], kitchen: [{ x: 2.85, z: -2.2 }, { x: 2.85, z: -.6 }], nook: [{ x: 4.7, z: 3.6 }, { x: 3.1, z: 3.6 }] };
/** The waypoints between two rooms (through the living room), ending at `to`. */
export function doorPath(fromRoom, toRoom, to) {
  const out = [];
  if (fromRoom !== toRoom) { if (DOORS[fromRoom]) out.push(DOORS[fromRoom][0], DOORS[fromRoom][1]); if (DOORS[toRoom]) out.push(DOORS[toRoom][1], DOORS[toRoom][0]); }
  out.push({ x: to.x, z: to.z }); return out;
}
