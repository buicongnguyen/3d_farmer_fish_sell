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
// STUBS in step 0, each replaced by builder E (the names and shapes are final):
//   cageState(state, id)        'hidden' | 'locked' | 'open' | 'rescued'          stub: 'hidden'
//   cageStatuses(state, out)    [{id, den, x, z, state}] for each cage not hidden   stub: empties `out` and returns it
//   parseFriends(raw)           the save's `friends` list, cleaned                  stub: []
//   friendYield(state)          adds the morning yields, returns the line to append stub: ''
//   friendsLine(state)          the People panel's line ("Rescued friends 1 / 3")   stub: ''
//   friendsAct(s, type, arg)    the actions 'rescue' and 'friendHome'               stub: a refusal with a line
import { FIELD_TILE, fieldTrees } from './field-layout.mjs';
import { DENS } from './regions.mjs';
import { landClear } from './land-features.mjs';

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

// ---------------------------------------------------------------- stubs (builder E)
export const cageState = (state, id) => 'hidden';
export const cageStatuses = (state, out = []) => { out.length = 0; return out; };
export const parseFriends = raw => [];
export const friendYield = state => '';
export const friendsLine = state => '';
export const friendsAct = (s, type, arg = {}) => ({ ok: false, message: 'Nobody is waiting here.' });
