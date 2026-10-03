// The Ember Fields' weather clock (round 8, step 0; owner: builder B). Pure. Ported from Zoo Garden (cute_game
// src/lava-weather.ts lavaEvent): every 360 s cycle is 240 s of one event, picked by weight from the cycle's number, then
// 120 s of calm. Time is wall-clock seconds (Date.now() / 1000), so the same second gives the same event on every visit.
// The tide offset, the online snapshot and the three-players summon of the reference are not ported; LavaWeather.step
// (meteors, fire rain, ore) is builder B's, in land-effects.mjs.
//
//   lavaEvent(t)          {id, index, left}: the event at second t and the seconds it (or the calm) has left
//   nextEvent(id, t)      the first second >= t at which the event is `id` (the dragon's next visit, for the maps)
//   forceLavaEvent(id)    tests only (window.willowmere.test.lavaEvent): every lavaEvent() answers `id` until null
export const LAVA_EVENT_WEIGHTS = Object.freeze({ eruption: 2, meteor: 2, storm: 1.5, dragon: 1.5, treasure: 1.5 });
export const LAVA_EVENT_INFO = Object.freeze({ normal: { name: 'Calm fields', icon: '🌋' }, eruption: { name: 'Volcano awakens', icon: '🌋' }, meteor: { name: 'Meteor shower', icon: '☄️' }, storm: { name: 'Magma storm', icon: '🌪️' }, dragon: { name: 'Dragon invasion', icon: '🐉' }, treasure: { name: 'Treasure eruption', icon: '💎' } });
export const LAVA_CYCLE_SECONDS = 360, LAVA_ACTIVE_SECONDS = 240;
const TOTAL = Object.values(LAVA_EVENT_WEIGHTS).reduce((a, b) => a + b, 0); // 8.5
function unit(seed) { let value = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b); value ^= value >>> 13; value = Math.imul(value, 0xc2b2ae35); return ((value ^ (value >>> 16)) >>> 0) / 4294967296; }
let forced = null;
/** The event of cycle `index` (never 'normal'). */
export function cycleEvent(index) {
  let value = unit(index) * TOTAL;
  for (const key in LAVA_EVENT_WEIGHTS) { value -= LAVA_EVENT_WEIGHTS[key]; if (value < 0) return key; }
  return 'treasure';
}
export function lavaEvent(timeSeconds) {
  const time = Number.isFinite(timeSeconds) ? Math.max(0, timeSeconds) : 0, index = Math.floor(time / LAVA_CYCLE_SECONDS), phase = time - index * LAVA_CYCLE_SECONDS;
  if (forced) return { id: forced, index, left: forced === 'normal' ? LAVA_CYCLE_SECONDS - LAVA_ACTIVE_SECONDS : LAVA_ACTIVE_SECONDS, forced: true };
  if (phase >= LAVA_ACTIVE_SECONDS) return { id: 'normal', index, left: LAVA_CYCLE_SECONDS - phase };
  return { id: cycleEvent(index), index, left: LAVA_ACTIVE_SECONDS - phase };
}
/** The first second >= t at which the (unforced) event is `id`, stepping forward cycle by cycle; Infinity if none within `cycles`. */
export function nextEvent(id, timeSeconds, cycles = 2000) {
  const time = Number.isFinite(timeSeconds) ? Math.max(0, timeSeconds) : 0, first = Math.floor(time / LAVA_CYCLE_SECONDS);
  if (id === 'normal') return time - first * LAVA_CYCLE_SECONDS >= LAVA_ACTIVE_SECONDS ? time : first * LAVA_CYCLE_SECONDS + LAVA_ACTIVE_SECONDS;
  for (let index = first; index < first + cycles; index++) {
    if (cycleEvent(index) !== id) continue;
    if (index > first) return index * LAVA_CYCLE_SECONDS;
    if (time - first * LAVA_CYCLE_SECONDS < LAVA_ACTIVE_SECONDS) return time; // it is on now
  }
  return Infinity;
}
/** Tests only: every lavaEvent() answers this event until it is set back to null. Returns what is forced now. */
export function forceLavaEvent(id) {
  if (id === null || id === undefined) forced = null;
  else if (id === 'normal' || id in LAVA_EVENT_WEIGHTS) forced = id;
  return forced;
}
