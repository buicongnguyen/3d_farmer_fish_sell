// Old saves in the ring world (round 9, stage 1; spec 5 and Amendment A6). Pure: it imports regions.mjs, ward.mjs and hyp.mjs only.
//
// A save keeps a `layout` field: absent or 1 is round 8's thirteen squares, 2 is the rings. Only four fields are shaped by the world:
// position, vehicles, riding and heading. migrateLayout(raw) returns just those, plus layout and layoutMoved, and never touches anything
// else (defeated, friends, cleared and planted survive a re-layout as they are).
//   - a position in the ward, or in the home ring 8 m inside the inner circle and at least `clear + 24` m from every home den, is kept;
//   - any other position (a planet of the old world, a boss's wake, outside the new circle, not finite) goes to the inner-circle point on
//     the nearest outpost (regions.mjs OUTPOSTS) that is no more dangerous than the place was, judged by the level the new world has at that place scaled
//     into the circle (the inner-circle outpost on the same radial if none); the player dismounts, the heading resets, and the vehicles that cannot be kept are parked beside it;
//   - a vehicle's spot that is keepable stays; any other goes beside the outpost the player was sent to (or null if the player was not moved: Home and towing bring it back);
//   - it is idempotent: a layout 2 save comes back untouched.
// `blocked(x, z, r)` is an optional predicate (field-layout.mjs fieldBlocked in the game): a spot a trunk or a pond covers is not kept.
import { RING, QUARTER_ID, DENS, OUTPOSTS, inWorld, levelAt } from './regions.mjs';
import { inSafeZone } from './ward.mjs';
import { hyp } from './hyp.mjs';

export const LAYOUT = 2;
export const KEEP = RING.R1 - 8;             // 152 m: a place is kept when it is in the ward, or in the home ring 8 m inside the inner circle ...
export const DEN_WAKE = 24;                  // ... and at least `clear + DEN_WAKE` from every home den: 40 m from a boss, 48 m from the Turtle
export const HOME_SPOT = Object.freeze({ x: 0, z: -8 });
const HOME_DENS = DENS.filter(d => QUARTER_ID.includes(d.region));
export const nearDen = (x, z) => HOME_DENS.some(d => hyp(x - d.x, z - d.z) < d.clear + DEN_WAKE);
export const keepable = (x, z, blocked, r = .6) => Number.isFinite(x) && Number.isFinite(z) && !blocked?.(x, z, r) && (inSafeZone(x, z) || (inWorld(x, z, 2) && hyp(x, z) < KEEP && !nearDen(x, z)));
/** Where a place that cannot be kept goes: the nearest free point of the home ring on the same radial from the village (turned a few degrees if it must), or null. */
export function ringPoint(x, z, blocked) {
  const base = Math.atan2(x, -z);
  for (let t = 0; t < 19; t++) {
    const b = base + (t % 2 ? -1 : 1) * (t >> 1) * Math.PI / 36;
    for (let r = KEEP - .5; r > 90; r -= 2) { const px = Math.round(r * Math.sin(b) * 2) / 2, pz = Math.round(-r * Math.cos(b) * 2) / 2; if (keepable(px, pz, blocked) && !inSafeZone(px, pz)) return { x: px, z: pz }; }
  }
  return null;
}
/** The outpost for an old place: the nearest one no more dangerous than the place (its level in this world, the place scaled into the circle), else the inner outpost on the same radial. */
export function outpostFor(x, z) {
  const r = hyp(x, z), k = r > RING.R2 - 6 ? (RING.R2 - 6) / r : 1, qx = x * k, qz = z * k, level = levelAt(qx, qz);
  let best = null, bestD = Infinity;
  for (const o of OUTPOSTS) { const d = hyp(o.x - qx, o.z - qz); if (o.level <= level && d < bestD) { best = o; bestD = d; } }
  if (best) return best;
  const bearing = Math.atan2(x, -z); let inner = OUTPOSTS[0], gap = Infinity;
  for (const o of OUTPOSTS) if (o.inner) { const g = Math.abs(Math.atan2(Math.sin(Math.atan2(o.x, -o.z) - bearing), Math.cos(Math.atan2(o.x, -o.z) - bearing))); if (g < gap) { inner = o; gap = g; } }
  return inner;
}
/** The spot for a person (0), a jeep (1) or a bike (2) beside an outpost, the first of a few that nothing blocks. */
const BESIDE = [[0, 3.4], [6, 5], [-6, 5]];
export function besideOutpost(o, i, blocked) {
  const [dx, dz] = BESIDE[i];
  for (const [mx, mz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { const x = o.x + dx * mx, z = o.z + dz * mz; if (!blocked?.(x, z, i ? 2.4 : .6)) return { x, z }; }
  return { x: o.x + dx, z: o.z + dz };
}
/** Pure: the save's geometry fields for the ring world. `raw` is the parsed JSON; nothing else in it is read or changed. */
export function migrateLayout(raw, blocked) {
  const out = { position: raw.position, vehicles: raw.vehicles, riding: raw.riding, heading: raw.heading, layout: LAYOUT, layoutMoved: false }, p = raw.position, v = raw.vehicles;
  let moved = null;
  if (raw.layout >= LAYOUT) return { ...out, layoutMoved: raw.layoutMoved === true };
  if (!(p && keepable(p.x, p.z, blocked))) {
    const finite = !!p && Number.isFinite(p.x) && Number.isFinite(p.z);
    out.position = finite ? besideOutpost(moved = outpostFor(p.x, p.z), 0, blocked) : { ...HOME_SPOT }; out.riding = ''; out.heading = 0; out.layoutMoved = finite && !inSafeZone(p.x, p.z);
  }
  if (v === undefined) return out;
  const keep = (s, i) => s && typeof s === 'object' && Number.isFinite(s.rot) ? keepable(s.x, s.z, blocked, 2.4) ? { x: s.x, z: s.z, rot: s.rot } : moved ? { ...besideOutpost(moved, i, blocked), rot: 0 } : Number.isFinite(s.x) && Number.isFinite(s.z) ? { ...besideOutpost(outpostFor(s.x, s.z), i, blocked), rot: 0 } : null : null;
  out.vehicles = { jeep: keep(v?.jeep, 1), bike: keep(v?.bike, 2) };
  if ((v?.jeep && !out.vehicles.jeep) || (v?.bike && !out.vehicles.bike)) out.layoutMoved = true;
  return out;
}
