// The family pond's bank: you can fish from anywhere along it. Pure (no three.js): rod-fishing.mjs offers the cast when
// you stand at the water, world.mjs walks you to the bank when you tap the pond, main.mjs asks where the float lands.
//
//   waterDistance(x, z)        metres to the water's edge (0 on the water)
//   shorePoint(x, z, out)      the nearest place to stand on the bank
//   atBank(x, z)               true when a cast can start from here
//   castPlan(player, tap)      -> {cast, water, shore}: where the float lands (always in the pond, toward the tap or
//                              straight out from where you stand) and the round of water the fishing rules use
import { POND } from './content.mjs';
import { hyp } from './hyp.mjs';

/**
 * Metres. `reach` is THE border of the pond: within it of the water you are "at the pond" (as in the reference, which
 * casts from where you stand within 3 m of the rim). Everything asks the same question through atBank(): the rod in your
 * hand, the prompt pill, a cast in place when you point at the water, the Cast button, and when the rod is packed away.
 * `gap` is where a walk to the bank ends (well inside the border, at the corners too), `arrive` how near that point counts.
 */
export const BANK = { gap: .8, reach: 3, arrive: 1.1, r: 1.5, cast: 3.4, min: 1.8, max: 7, edge: .7 };
/** The species the pond can catch at each upgrade tier (main.mjs picks the bite from it, pond-life.mjs swims exactly these). */
export const FISH_POOLS = [['perch', 'carp', 'catfish'], ['perch', 'carp', 'koi'], ['carp', 'koi', 'rainbow'], ['koi', 'rainbow', 'golden']];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const waterDistance = (x, z) => hyp(Math.max(0, Math.abs(x - POND.x) - POND.w / 2), Math.max(0, Math.abs(z - POND.z) - POND.d / 2));
export const atBank = (x, z) => waterDistance(x, z) <= BANK.reach;
/** The nearest place to stand on the bank, `gap` metres from the water (from inside that line: straight out). */
export function shorePoint(x, z, out = { x: 0, z: 0 }, gap = BANK.gap) {
  const hw = POND.w / 2 + gap, hd = POND.d / 2 + gap, dx = x - POND.x, dz = z - POND.z;
  let px = clamp(dx, -hw, hw), pz = clamp(dz, -hd, hd);
  if (Math.abs(dx) < hw && Math.abs(dz) < hd) { if (hw - Math.abs(dx) < hd - Math.abs(dz)) px = dx < 0 ? -hw : hw; else pz = dz < 0 ? -hd : hd; }
  out.x = POND.x + px; out.z = POND.z + pz; return out;
}
/** A point kept inside the pond, `edge` metres from its rim. */
function inWater(p, edge = BANK.edge) { p.x = clamp(p.x, POND.x - POND.w / 2 + edge, POND.x + POND.w / 2 - edge); p.z = clamp(p.z, POND.z - POND.d / 2 + edge, POND.z + POND.d / 2 - edge); return p; }
/**
 * Where a cast from `player` lands. With a `tap` on the pond: at the tap, no farther than the line reaches (BANK.max
 * metres over the water); without one: straight out from where you stand. Never closer than BANK.min to the bank.
 * `water` is the round of water under the float (the pond is a rectangle, the fishing rules know a circle).
 */
export function castPlan(player, tap = null) {
  const shore = shorePoint(player.x, player.z), off = waterDistance(player.x, player.z);
  // Straight out: toward the pond's middle line (its long axis), so from an end you cast along the pond, from a side across it.
  const spine = (POND.w - POND.d) / 2, mid = { x: POND.x + clamp(player.x - POND.x, -spine, spine), z: POND.z };
  const aim = tap ? { x: tap.x, z: tap.z } : mid;
  let dx = aim.x - player.x, dz = aim.z - player.z, d = hyp(dx, dz);
  if (d < .01) { dx = POND.x - player.x; dz = POND.z - player.z; d = hyp(dx, dz) || 1; }
  dx /= d; dz /= d;
  const length = clamp(tap ? d : off + BANK.cast, off + BANK.min, off + BANK.max);
  const cast = inWater({ x: player.x + dx * length, z: player.z + dz * length });
  const water = { x: POND.x + clamp(cast.x - POND.x, -spine, spine), z: POND.z, r: POND.d / 2 };
  return { cast, water, shore };
}
