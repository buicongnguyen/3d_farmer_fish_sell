// Rescued friends: who is held, where the cages stand, and the rules (round 8; owner: builder E). Pure: no three.js, no DOM.
// After Zoo Garden's friends (cute_game src/friends-state.ts, friends.ts, cage-spots.ts, friend-crew.ts): a locked cage
// stands beside a boss, beating that boss opens it for good, and walking up to it frees a small helper who follows you
// home and then works for you. friends-view.mjs draws it.
//
// It imports nothing from game.mjs or pandora.mjs (game.mjs imports this file): it builds its own {ok, message} answers and
// writes state.inventory itself, as pandora.mjs pandoraAct's 'pickup' case does.
//
// REAL from step 0 (pure geometry other builders read):
//   FRIENDS, CAGES, CAGE_GAP, RESCUE_REACH, cageCandidates(bx, bz), cageSpot(id)
//   POSTS, POST_GAP, hiredSpots(), postClear(x, z), postSpot(id)     where a friend stands at the homestead by day
// The rules, by builder E (the names and shapes step 0 fixed):
//   cageState(state, id)        'hidden' | 'locked' | 'open' | 'rescued'; every cage is hidden while the box is shut
//   cageStatuses(state, out)    [{id, den, x, z, state}] for each cage not hidden
//   parseFriends(raw)           the save's `friends` list [{id, rescuedAt (the day number), home}], cleaned
//   friendYield(state)          adds the morning yields of the friends at home, returns the line to append
//   friendsLine(state)          the People panel's line ("Rescued friends 1 / 3 · …"), '' until somebody is rescued
//   friendsAct(s, type, arg)    the actions 'rescue' {id, x, z} and 'friendHome' {x, z}
//   also FRIEND_IDS, BOSS_NAMES, RESCUE_LINES, lockedHint, cageLabel, FRIEND_YIELDS, GROWTH, friendStage, friendHeight, friendOf,
//   following, followGoal
import { FIELD_TILE, fieldTrees } from './field-layout.mjs';
import { DENS, REGION } from './regions.mjs';
import { landClear } from './land-features.mjs';
import { inSafeZone } from './ward.mjs';
import { blockedAt } from './village-plan.mjs';
import { onWay } from './lots.mjs';
import { JOB_SPOTS } from './villagers.mjs';
import { markFound } from './house-rules.mjs';

/** Shirt (`tint`) and hair colours, the reference's own three (friends-state.ts FRIENDS). */
export const FRIENDS = Object.freeze({
  sprout: Object.freeze({ name: 'Sprout', role: 'garden', tint: '#ffe14d', hair: '#ff8c42' }),
  clover: Object.freeze({ name: 'Clover', role: 'farm', tint: '#d98a4e', hair: '#f2c14e' }),
  pepper: Object.freeze({ name: 'Pepper', role: 'cook', tint: '#f6f1e7', hair: '#2d2a44' }),
});
/** Where each prisoner is kept: beside which boss (regions.mjs DENS), in which region. */
export const CAGES = Object.freeze({
  sprout: Object.freeze({ region: 'west', boss: 'treant', den: 'w:den:treant' }),
  clover: Object.freeze({ region: 'east', boss: 'bear', den: 'w:den:bear' }),
  pepper: Object.freeze({ region: 'toy', boss: 'robot', den: 'w:den:robot' }),
});
/** A cage stands this far from its den; a rescue works from this near an open cage; the cage's own collider. */
export const CAGE_GAP = 6.5, RESCUE_REACH = 2.4, CAGE_RADIUS = .95;
/**
 * The spots a cage tries, in order (cage-spots.ts, copied): toward the village centre (0, 0) from the boss's den, then
 * swinging out by 0.35 rad on alternate sides. Twelve candidates, each CAGE_GAP from the den.
 */
export function cageCandidates(bx, bz) {
  const base = Math.atan2(-bz, -bx), spots = [];
  for (let i = 0; i < 12; i++) { const a = base + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * .35; spots.push({ x: bx + Math.cos(a) * CAGE_GAP, z: bz + Math.sin(a) * CAGE_GAP }); }
  return spots;
}
const spots = new Map();
/**
 * Where a friend's cage stands: the first candidate on clear land with no blocking piece within the piece's radius + 1.1 m
 * (friend-crew.ts cageSpot). It reads fieldTrees only, and fieldTrees does not read cages, so neither calls the other.
 * A pure function of the seed: the same spot on every call.
 */
export function cageSpot(id) {
  if (spots.has(id)) return spots.get(id);
  const cage = CAGES[id], den = cage && DENS.find(d => d.id === cage.den); if (!den) return null;
  const candidates = cageCandidates(den.x, den.z);
  const clear = p => {
    if (!landClear(p.x, p.z, CAGE_RADIUS)) return false;
    // The pieces of every tile within 3 m of the spot (a collider is at most 1.82 m; the test reaches radius + 1.1 m).
    for (let tx = Math.floor((p.x - 3) / FIELD_TILE); tx <= Math.floor((p.x + 3) / FIELD_TILE); tx++) for (let tz = Math.floor((p.z - 3) / FIELD_TILE); tz <= Math.floor((p.z + 3) / FIELD_TILE); tz++)
      for (const t of fieldTrees(tx, tz)) if (Math.hypot(t.x - p.x, t.z - p.z) < t.r + 1.1) return false;
    return true;
  };
  const at = candidates.find(clear) ?? candidates[0], spot = Object.freeze({ x: at.x, z: at.z });
  spots.set(id, spot); return spot;
}

// ---------------------------------------------------------------- posts at the homestead
/** Where each friend would like to stand by day: Sprout by the beds, Clover by the track, Pepper before the house (spec 16.2). */
export const POSTS = Object.freeze({ sprout: Object.freeze({ x: -12.5, z: 9 }), clover: Object.freeze({ x: 12.5, z: -10 }), pepper: Object.freeze({ x: 3, z: -5 }) });
/** A friend's post keeps this far (metres) from every spot a hired neighbour can stand on. */
export const POST_GAP = 2.5;
/** Every spot a hired neighbour can stand on: villagers.mjs puts a worker at its job's spot, or 1.2 m to either side of it. */
export const hiredSpots = () => Object.values(JOB_SPOTS).flatMap(at => [-1.2, 0, 1.2].map(dx => ({ x: at.x + dx, z: at.z })));
/**
 * May a friend stand here? Inside the ward, clear of every building, prop and living tree by 0.6 m (village-plan.mjs blockedAt), off
 * every way made for walking (lots.mjs onWay: the ring road, the two lanes, the lots' paths) and POST_GAP from the hired neighbours.
 * It does NOT ask village-plan.mjs reserved(): the homestead itself is reserved ground, and the posts are on it.
 */
export function postClear(x, z) {
  if (!inSafeZone(x, z) || blockedAt(x, z, .6) || onWay(x, z)) return false;
  for (const s of hiredSpots()) if (Math.hypot(s.x - x, s.z - z) < POST_GAP) return false;
  return true;
}
const posts = new Map();
/** A friend's post: POSTS[id] when a friend may stand there, else the nearest point of a 0.5 m square spiral round it that is clear. */
export function postSpot(id) {
  if (posts.has(id)) return posts.get(id);
  const want = POSTS[id]; if (!want) return null;
  let at = want;
  if (!postClear(want.x, want.z)) search: for (let ring = 1; ring <= 40; ring++) {
    let best = null, least = Infinity;
    for (let i = -ring; i <= ring; i++) for (let k = -ring; k <= ring; k++) {
      if (Math.max(Math.abs(i), Math.abs(k)) !== ring) continue;
      const x = want.x + i * .5, z = want.z + k * .5, d = Math.hypot(i, k);
      if (d < least && postClear(x, z)) { best = { x, z }; least = d; }
    }
    if (best) { at = best; break search; }
  }
  const spot = Object.freeze({ x: at.x, z: at.z }); posts.set(id, spot); return spot;
}

// ---------------------------------------------------------------- the rules (cute_game src/friends.ts, friends-state.ts, growth.ts)
export const FRIEND_IDS = Object.freeze(Object.keys(FRIENDS));
/** The bosses' names for the locked cage's line (cute_game enemy-types.ts; kept here so this file stays below wilds.mjs in the import chain). */
export const BOSS_NAMES = Object.freeze({ treant: 'Ancient Treant', bear: 'King Bear', robot: 'Giant Toy Robot' });
/** The thank-you and a short story line, per friend (cute_game src/friend-ui.ts RESCUE_LINES, unchanged). */
export const RESCUE_LINES = Object.freeze({
  sprout: Object.freeze(['Thank you! I am Sprout.', 'The treant caught me watering its roots. Now I will tend your garden!']),
  clover: Object.freeze(['You beat the bear! I am Clover.', 'It caught me sharing its honey with hens. I will care for your animals!']),
  pepper: Object.freeze(['Free at last! I am Pepper.', 'The robot wanted a cook who never sleeps. I would love to cook for you!']),
});
/** What a locked cage says when tapped (friend-ui.ts lockedHint). */
export const lockedHint = (id, name = BOSS_NAMES[CAGES[id]?.boss]) => id === 'pepper' ? 'Beat a boss in another land to open this cage.' : `Defeat the ${name ?? 'boss'} nearby to open this cage.`;
/** The label over a cage: "Locked cage" with a lock, the friend's name with a key once open, nothing on an empty one (friend-crew.ts). */
export const cageLabel = (id, state) => state === 'open' ? `🗝️ ${FRIENDS[id].name}` : state === 'locked' ? '🔒 Locked cage' : '';
/**
 * What each friend brings every morning once it is home, for no wage. Willowmere's helpers work by a morning yield (content.mjs JOBS,
 * game.mjs payWorkers), so the reference's live work becomes that: Sprout the farmhand's yield, Clover the herder's, Pepper one Garden
 * soup (content.mjs RECIPES.soup). friends.test.mjs holds the numbers to content.mjs.
 */
export const FRIEND_YIELDS = Object.freeze({ sprout: Object.freeze({ carrot: 3, radish: 2 }), clover: Object.freeze({ egg: 2, milk: 1 }), pepper: Object.freeze({ soup: 1 }) });
/** What the People panel says a friend does. */
const WORK = Object.freeze({ sprout: 'tends the beds: 3 carrots and 2 radishes each morning', clover: 'cares for the animals: 2 eggs and a milk each morning', pepper: 'cooks: a Garden soup each morning' });
/** Growing up (growth.ts, by days only: there are no counted jobs here): half your height when freed, 0.75 after 1 day, 0.8 after 3. */
export const GROWTH = Object.freeze([Object.freeze({ height: .5, days: 0 }), Object.freeze({ height: .75, days: 1 }), Object.freeze({ height: .8, days: 3 })]);
export function friendStage(friend, day) { const days = friend && Number.isFinite(day) ? day - friend.rescuedAt : 0; let stage = 0; GROWTH.forEach((g, i) => { if (days >= g.days) stage = i; }); return stage; }
/** A friend's height as a share of the player's, on day `day`. */
export const friendHeight = (friend, day) => GROWTH[friendStage(friend, day)].height;
/** A following friend's spot (friend-crew.ts followGoal): behind you and to your left, 1.6 m back plus 0.8 m for each further friend. */
export function followGoal(hero, facing, slot) {
  const back = 1.6 + slot * .8, side = .8 * (slot % 2 ? -1 : 1);
  return { x: hero.x - Math.sin(facing) * back - Math.cos(facing) * side, z: hero.z - Math.cos(facing) * back + Math.sin(facing) * side };
}

const open = state => state?.pandora === true;
const listOf = state => Array.isArray(state?.friends) ? state.friends : [];
export const friendOf = (state, id) => listOf(state).find(f => f.id === id);
/** Friends freed and still walking home behind you. */
export const following = state => listOf(state).filter(f => !f.home);
const LAND_TYPES = new Set(DENS.filter(d => REGION[d.region]?.kind === 'land').map(d => d.type));
/** Has any boss, titan or dragon away from home been beaten (friends.ts beatAwayBoss)? */
const beatAwayBoss = state => { const d = state?.defeated; if (!d) return false; for (const type of LAND_TYPES) if (d[type] === true) return true; return false; };
/**
 * 'hidden' | 'locked' | 'open' | 'rescued' (friends.ts cageState). With the box shut every cage is hidden. Sprout's and Clover's are
 * locked until their own boss has been beaten once; Pepper's is not there at all until any boss in a land has been. A boss coming back
 * never locks a cage again: state.defeated only ever gains kinds.
 */
export function cageState(state, id) {
  const cage = CAGES[id]; if (!cage || !open(state)) return 'hidden';
  if (friendOf(state, id)) return 'rescued';
  if (id === 'pepper') return beatAwayBoss(state) ? 'open' : 'hidden';
  return state.defeated?.[cage.boss] === true ? 'open' : 'locked';
}
/** Every cage that is not hidden, for the maps and the tests: [{id, den, x, z, state}], written into `out`. */
export function cageStatuses(state, out = []) {
  out.length = 0;
  for (const id of FRIEND_IDS) { const s = cageState(state, id); if (s === 'hidden') continue; const at = cageSpot(id); out.push({ id, den: CAGES[id].den, x: at.x, z: at.z, state: s }); }
  return out;
}
/**
 * The save's `friends`, cleaned (friends-state.ts parseFriends): at most three, each id one of the three and used once, a finite
 * `rescuedAt` (the day number) and a boolean `home`; anything else is dropped. A save from before the round has none: nobody rescued.
 */
export function parseFriends(raw) {
  const out = []; if (!Array.isArray(raw)) return out;
  for (const v of raw.slice(0, 32)) {
    if (!v || typeof v !== 'object' || Array.isArray(v) || typeof v.id !== 'string' || !Object.hasOwn(FRIENDS, v.id) || out.some(f => f.id === v.id)) continue;
    if (typeof v.rescuedAt !== 'number' || !Number.isFinite(v.rescuedAt) || typeof v.home !== 'boolean') continue;
    out.push({ id: v.id, rescuedAt: Math.max(0, Math.floor(v.rescuedAt)), home: v.home });
    if (out.length === FRIEND_IDS.length) break;
  }
  return out;
}
const names = list => list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
/**
 * The morning's yields of every friend that is home, put in the basket; returns the text game.mjs payWorkers appends to its line
 * (" · Sprout and Clover filled your basket."), '' when nobody is home. No wage is taken.
 */
export function friendYield(state) {
  const home = listOf(state).filter(f => f.home && Object.hasOwn(FRIEND_YIELDS, f.id)); if (!home.length) return '';
  const bag = state.inventory ??= {};
  for (const f of home) for (const [item, n] of Object.entries(FRIEND_YIELDS[f.id])) { markFound(state, item); bag[item] = (bag[item] ?? 0) + n; }
  return ` · ${names(home.map(f => FRIENDS[f.id].name))} filled your basket.`;
}
/** The People panel's line: "Rescued friends 2 / 3 · Sprout tends the beds: … · Clover is following you home". '' until somebody is rescued. */
export function friendsLine(state) {
  const list = listOf(state).filter(f => Object.hasOwn(FRIENDS, f.id)); if (!list.length) return '';
  return `Rescued friends ${list.length} / ${FRIEND_IDS.length}` + list.map(f => ` · ${FRIENDS[f.id].name} ${f.home ? WORK[f.id] : 'is following you home'}`).join('');
}
const answer = (ok, message, extra) => ({ ok, message, ...extra });
/**
 * 'rescue' {id, x, z}: frees a prisoner, only from an open cage and only from within RESCUE_REACH of it (friends.ts rescue; the place is
 * `arg`'s, else the save's own). Once per friend. The answer's line is the friend's story, which the game toasts; `hello` is the line
 * that floats over the friend.
 * 'friendHome' {x, z}: every friend still following reaches the village and goes to work (friends.ts arriveHome): when you stand
 * inside the ward, or at once when the box is shut.
 */
export function friendsAct(s, type, arg = {}) {
  const x = Number.isFinite(arg?.x) ? arg.x : s.position?.x, z = Number.isFinite(arg?.z) ? arg.z : s.position?.z;
  if (type === 'rescue') {
    const id = arg?.id; if (typeof id !== 'string' || !Object.hasOwn(FRIENDS, id)) return answer(false, 'Nobody is waiting here.');
    const state = cageState(s, id);
    if (state === 'locked') return answer(false, '🔒 ' + lockedHint(id));
    if (state === 'rescued') return answer(false, `${FRIENDS[id].name} is already free.`);
    if (state !== 'open') return answer(false, 'Nobody is waiting here.');
    const at = cageSpot(id);
    if (!(Math.hypot(x - at.x, z - at.z) <= RESCUE_REACH)) return answer(false, `Walk up to the cage to free ${FRIENDS[id].name}.`);
    if (!Array.isArray(s.friends)) s.friends = [];
    s.friends.push({ id, rescuedAt: Number.isFinite(s.day) ? s.day : 0, home: false });
    return answer(true, '💖 ' + RESCUE_LINES[id][1], { id, hello: RESCUE_LINES[id][0] });
  }
  if (type === 'friendHome') {
    const walking = following(s); if (!walking.length) return answer(false, 'No friend is on the way home.');
    const who = names(walking.map(f => FRIENDS[f.id].name));
    if (open(s) && !(Number.isFinite(x) && Number.isFinite(z) && inSafeZone(x, z))) return answer(false, `${who} will follow you to Willowmere.`);
    for (const f of walking) f.home = true;
    return answer(true, `🏡 ${who} reached Willowmere and went to work!`, { ids: walking.map(f => f.id) });
  }
  return answer(false, 'Nobody is waiting here.');
}
