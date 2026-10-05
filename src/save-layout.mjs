// Old saves in the ring world (round 9, stage 1; spec 5 and Amendment A6). Pure: it imports regions.mjs, ward.mjs and hyp.mjs only.
//
// A save keeps a `layout` field: absent or 1 is round 8's thirteen squares, 2 is the rings. Only four fields are shaped by the world:
// position, vehicles, riding and heading. migrateLayout(raw) returns just those, plus layout and layoutMoved, and never touches anything
// else (defeated, friends, cleared and planted survive a re-layout as they are).
//   - a position in the ward, or in the home ring 8 m inside the inner circle and at least `clear + 24` m from every home den, is kept;
//   - any other position (a planet of the old world, a boss's wake, outside the new circle, not finite) goes to the inner-circle point on
//     the same radial from the village, the nearest free one (stage 2 switches this to the outposts); the player dismounts and the heading resets;
//   - a vehicle's spot that is keepable stays, any other is null (the car is at its park spot: Home and towing bring it back anyway);
//   - it is idempotent: a layout 2 save comes back untouched.
// `blocked(x, z, r)` is an optional predicate (field-layout.mjs fieldBlocked in the game): a spot a trunk or a pond covers is not kept.
import { RING, QUARTER_ID, DENS, inWorld } from './regions.mjs';
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
/** Pure: the save's geometry fields for the ring world. `raw` is the parsed JSON; nothing else in it is read or changed. */
export function migrateLayout(raw, blocked) {
  const out = { position: raw.position, vehicles: raw.vehicles, riding: raw.riding, heading: raw.heading, layout: LAYOUT, layoutMoved: false }, p = raw.position, v = raw.vehicles;
  if (raw.layout >= LAYOUT) return { ...out, layoutMoved: raw.layoutMoved === true };
  if (!(p && keepable(p.x, p.z, blocked))) {
    const finite = !!p && Number.isFinite(p.x) && Number.isFinite(p.z);
    out.position = (finite && ringPoint(p.x, p.z, blocked)) || { ...HOME_SPOT }; out.riding = ''; out.heading = 0; out.layoutMoved = finite && !inSafeZone(p.x, p.z);
  }
  if (v === undefined) return out;
  const keep = s => s && typeof s === 'object' && Number.isFinite(s.rot) && keepable(s.x, s.z, blocked, 2.4) ? { x: s.x, z: s.z, rot: s.rot } : null;
  out.vehicles = { jeep: keep(v?.jeep), bike: keep(v?.bike) };
  if ((v?.jeep && !out.vehicles.jeep) || (v?.bike && !out.vehicles.bike)) out.layoutMoved = true;
  return out;
}
