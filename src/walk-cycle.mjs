// A shared walk cycle for anyone built from the hero's parts (cute_game src/walk-cycle.ts): legs swing about the hips
// and the arms counter-swing, the cadence follows the ground actually covered (so feet do not skate), and a blend fades
// the cycle in when walking starts and out when the walker stops. No allocation per frame.
/** Fastest cadence (radians a second). */
const MAX_RATE = 18;
export const newGait = () => ({ phase: 0, blend: 0 });
/** Advances a gait by the distance covered this frame. `leg` is the walker's hip height in metres. */
export function stepGait(g, dist, dt, leg) {
  const moving = dist > dt * .05;
  if (moving) g.phase = (g.phase + Math.min(dist / (leg * 1.1) * Math.PI, MAX_RATE * dt)) % (Math.PI * 2);
  g.blend += ((moving ? 1 : 0) - g.blend) * (1 - Math.exp(-dt * (moving ? 12 : 8)));
  if (!moving && g.blend < .01) g.blend = 0;
  return g;
}
/** The swing amplitude (radians) at a speed: 0.45 at a stroll up to 0.8 at a run. */
export const gaitSwing = (speed, leg) => Math.min(.8, .45 + speed / leg * .02);
/**
 * Blends the walk swing over whatever pose the limbs hold (x rotations only; an arm's splay on z is kept).
 * `parts` is an avatar's userData.parts. Returns the body bob (metres at scale 1) to add to the walker's height.
 */
export function applyGait(parts, g, swing, arms = true) {
  if (g.blend <= 0) return 0;
  const s = Math.sin(g.phase) * swing, b = g.blend, k = 1 - b;
  parts.leg_l.rotation.x = parts.leg_l.rotation.x * k + s * b;
  parts.leg_r.rotation.x = parts.leg_r.rotation.x * k - s * b;
  if (arms) { parts.arm_l.rotation.x = parts.arm_l.rotation.x * k - s * 1.1 * b; parts.arm_r.rotation.x = parts.arm_r.rotation.x * k + s * 1.1 * b; }
  return Math.abs(Math.cos(g.phase)) * .06 * b;
}
