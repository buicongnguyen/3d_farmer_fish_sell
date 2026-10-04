import { hyp } from './hyp.mjs';
// A shared walk cycle for anyone built from the hero's parts (after cute_game src/walk-cycle.ts): legs swing about the
// hips and the arms counter-swing, the cadence follows the ground actually covered, and a blend fades the cycle in when
// walking starts and out when the walker stops. No allocation per frame.
//
// Two things the reference leaves to chance are worked out here, because Willowmere's bodies run from Tiny (hips at
// 0.42) to Grown-up (hips at 1.62) and one fixed swing cannot suit both:
//   * the swing angle follows the leg: a rigid leg swung by A lifts its foot by leg x (1 - cos A), so long legs take a
//     smaller angle (the body may sink SINK metres at a footfall, no more) and short legs a wider, quicker one;
//   * the walker's height comes from its feet: groundOffset() returns how far to lower (or lift) the body so that its
//     lower foot rests exactly on the ground at every moment of the cycle. Feet never float and never sink.
// The foot's lowest point at an angle is read from a small table made once from the leg's own vertices (soleTable), so
// heels, toes and boots are all counted.
/** Fastest cadence (radians a second): about four steps a second; quicker reads as a blur, not legs. */
export const MAX_RATE = 13;
/** One step covers this many leg lengths when nothing limits it (the reference's figure). */
export const STRIDE = 1.1;
/** How far the body may sink at a footfall (metres). 0.11 gives Willowmere's own tall body its familiar half-radian swing. */
export const SINK = .11;
/** The widest swing (radians): what the reference allows at a run. */
export const MAX_SWING = .8;
export const newGait = () => ({ phase: 0, blend: 0, swing: .5 });
/**
 * The swing amplitude (radians) for a speed (m/s) and a leg (hip height in metres): the angle whose stride matches the
 * ground a step covers, never more than the leg can take without the body sinking over SINK.
 */
export function gaitSwing(speed, leg) {
  const L = Math.max(.05, leg), sink = Math.acos(Math.max(0, 1 - SINK / L));
  // The ground one step covers: STRIDE leg lengths, or more when the cadence is already at its fastest.
  const step = Math.max(STRIDE * L, speed * Math.PI / MAX_RATE), want = Math.asin(Math.min(1, step / (2 * L)));
  return Math.max(.2, Math.min(MAX_SWING, sink, want));
}
/** The ground a step covers at a swing: the planted foot travels from the front of the stride to the back. */
export const stepLength = (leg, swing) => 2 * Math.max(.05, leg) * Math.sin(swing);
/**
 * Advances a gait by the distance covered this frame. `leg` is the walker's hip height in metres; `swing` the amplitude
 * it walks with (gaitSwing): one step per stride of that swing, so the planted foot does not skate (up to MAX_RATE).
 */
export function stepGait(g, dist, dt, leg, swing = g.swing ?? .5) {
  const moving = dist > dt * .05;
  if (moving) g.phase = (g.phase + Math.min(dist / stepLength(leg, swing) * Math.PI, MAX_RATE * dt)) % (Math.PI * 2);
  g.blend += ((moving ? 1 : 0) - g.blend) * (1 - Math.exp(-dt * (moving ? 12 : 8)));
  if (!moving && g.blend < .01) g.blend = 0;
  return g;
}
/**
 * Blends the walk swing over whatever pose the limbs hold (x rotations only; an arm's splay on z is kept).
 * `parts` is an avatar's userData.parts. The walker's height is groundOffset()'s to give.
 */
export function applyGait(parts, g, swing = g.swing ?? .5, arms = true) {
  if (g.blend <= 0) return;
  const s = Math.sin(g.phase) * swing, b = g.blend, k = 1 - b;
  parts.leg_l.rotation.x = parts.leg_l.rotation.x * k + s * b;
  parts.leg_r.rotation.x = parts.leg_r.rotation.x * k - s * b;
  if (arms) { parts.arm_l.rotation.x = parts.arm_l.rotation.x * k - s * 1.1 * b; parts.arm_r.rotation.x = parts.arm_r.rotation.x * k + s * 1.1 * b; }
}

// ---------------------------------------------------------------- feet on the ground
/** The sole table: the lowest point of a leg (in the leg's own space, below its hip pivot) at SOLE.n angles from -max to max. */
export const SOLE = { max: 1.6, n: 65 };
const STEP = SOLE.max * 2 / (SOLE.n - 1);
/**
 * Fills a sole table from a leg's vertices (a flat x, y, z array in the leg's space): at each angle the lowest
 * y cos a - z sin a, which is where the leg's lowest point ends up when the leg turns by a about its hip (x axis).
 * Passing `into` lowers an existing table (a second mesh on the same leg, such as glowing boots).
 */
export function soleTable(positions, into = null) {
  const table = into ?? new Float32Array(SOLE.n).fill(Infinity);
  // Between two samples the true curve can dip under the straight line by at most reach x step² / 8 (under a
  // millimetre); the table is lowered by that much, so a foot placed by it is never below the ground.
  let reach = 0; for (let k = 1; k < positions.length; k += 3) reach = Math.max(reach, hyp(positions[k], positions[k + 1]));
  const slack = reach * STEP * STEP / 8;
  for (let i = 0; i < SOLE.n; i++) {
    const a = -SOLE.max + i * STEP, c = Math.cos(a), s = Math.sin(a); let low = Infinity;
    for (let k = 1; k < positions.length; k += 3) { const y = positions[k] * c - positions[k + 1] * s; if (y < low) low = y; }
    if (low - slack < table[i]) table[i] = low - slack;
  }
  return table;
}
/** The table read at an angle (radians, clamped to the table's reach), between its samples. */
export function soleAt(table, angle) {
  const f = (Math.max(-SOLE.max, Math.min(SOLE.max, angle)) + SOLE.max) / STEP, i = Math.min(SOLE.n - 2, Math.floor(f)), t = f - i;
  return table[i] + (table[i + 1] - table[i]) * t;
}
/**
 * How far to move a walker up (+) or down (−), in its own model units, so that its lower foot rests on the ground with
 * the legs turned by angleL and angleR. `feet` is {hip: [yLeft, yRight], low: [tableLeft, tableRight]} (avatar.mjs
 * feetOf). Multiply by the walker's scale for metres.
 */
export function groundOffset(feet, angleL = 0, angleR = 0) {
  return -Math.min(feet.hip[0] + soleAt(feet.low[0], angleL), feet.hip[1] + soleAt(feet.low[1], angleR));
}
