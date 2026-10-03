// How the jeep and the motorcycle drive. Pure (no three.js, no DOM): node tests it.
//
// The models' noses point along +z (grille, headlights and hood at z > 0, tail lamps at z < 0), so a vehicle whose
// heading is h is drawn with rotation.y = h and travels along (sin h, cos h): the nose leads. (Before round 7 the mesh was
// turned to the avatar's facing plus half a turn, so it drove tail first.)
//
// Controls stay screen-relative like walking: the stick says where you want to go, and the vehicle steers its nose
// towards that at a limited rate. It never jumps to a heading, it cannot slide sideways, and it has no reverse gear:
// pull the stick back and it eases off, swings round and drives off nose first.
//
// Speed (walking is 4.8 m/s; the brief asks for 4x to 8x):
//   * `cruise` 4x (19.2 m/s) is reached in about a second and is the limit inside the village footprint;
//   * on open ground, after `boostAfter` seconds at cruise, it builds on to `top` 8x (38.4 m/s);
//   * steering takes NO speed off (round 8): a right angle, a weave, any change of direction up to `REVERSE.from`
//     radians is driven at full speed and does not hold the build-up to top speed back. Only a real reversal (the stick
//     pulled roughly opposite to the nose) eases off, so that it swings round instead of driving a wide circle;
//   * coming back towards the village it brakes in time: the limit at d metres outside the village is
//     sqrt(cruise² + 2 · brake · d).
// Turning is arcade grip: `turn` radians a second at a standstill, easing to `fast` at top speed (a right angle at
// 38.4 m/s in about a second for the jeep, less for the motorcycle; before round 8 it was grip / speed, 0.5 rad/s there).
//   The motorcycle is the nimble one: quicker off the mark, a faster turn at every speed.
export const WALK_SPEED = 4.8;
export const VEHICLES = {
  jeep: { cruise: WALK_SPEED * 4, top: WALK_SPEED * 8, accel: 16, boost: 6, brake: 22, crawl: 5, turn: 3, fast: 2.6, steer: 9, boostAfter: .6, radius: 1.9, body: 1.25, length: 4.8 },
  bike: { cruise: WALK_SPEED * 4, top: WALK_SPEED * 8, accel: 24, boost: 9.6, brake: 28, crawl: 6, turn: 4.6, fast: 3.9, steer: 12, boostAfter: .35, radius: .95, body: .5, length: 2.8 },
};
/** A reversal: the stick more than `from` radians off the nose starts to take speed off, all of it (down to `crawl`) at `full`. */
export const REVERSE = { from: 2.2, full: 3 };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (v, a, b) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
/** The shortest signed turn from heading a to heading b. */
export const turnBetween = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
/** A parked vehicle's driving state. `heading` is where its nose points (atan2(x, z)); `straight`: seconds it has been at cruise or faster. */
export const newDrive = (heading = 0) => ({ heading, speed: 0, steer: 0, straight: 0 });
/** The fastest it may go `outside` metres beyond the village footprint (0 inside it). */
export const openLimit = (spec, outside) => outside > 0 ? Math.min(spec.top, Math.sqrt(spec.cruise * spec.cruise + 2 * spec.brake * outside)) : spec.cruise;
/** How fast it can turn at a speed (radians a second): the standstill rate, easing to `fast` at top speed. */
export const turnRate = (spec, speed) => spec.turn + (spec.fast - spec.turn) * clamp(Math.abs(speed) / spec.top, 0, 1);
/** The speed it aims for: the open-ground limit once it has been at cruise a while, else cruise. Steering takes nothing off; a reversal does. */
export function targetSpeed(spec, d, error, outside) {
  const open = openLimit(spec, outside), base = d.straight >= spec.boostAfter ? open : Math.min(spec.cruise, open);
  return base + (Math.min(base, spec.crawl) - base) * smooth(Math.abs(error), REVERSE.from, REVERSE.full);
}
/**
 * Following a tapped route: the fastest it can go and still reach a corner `gap` metres away, `error` radians off the
 * nose. A corner inside its turning circle (gap < 2 · radius · sin error) would be circled for ever, so there, and only
 * there, it takes the corner slower. A corner ahead, or far enough away, costs nothing.
 */
export function routeSpeed(spec, gap, error) {
  const off = Math.sin(Math.min(Math.abs(error), Math.PI / 2));
  return off < 1e-3 ? Infinity : Math.max(spec.crawl, spec.fast * .85 * gap / (2 * off));
}
/**
 * One step. `wantX, wantZ`: where the stick points on the ground (any length; 0, 0: no input, it brakes to a stop).
 * `outside`: metres beyond the village footprint. `limit`: a speed cap from the caller (arriving at a tapped spot).
 * Updates d.heading, d.speed, d.steer, d.straight and returns the distance to travel along the new heading.
 */
export function stepDrive(d, spec, wantX, wantZ, dt, outside = 0, limit = Infinity) {
  const input = wantX * wantX + wantZ * wantZ > 1e-6;
  let target = 0;
  if (input) {
    const error = turnBetween(d.heading, Math.atan2(wantX, wantZ));
    // The wheel follows the stick with a little lag, and turns the nose at a limited rate: no snap.
    d.steer += (clamp(error / .3, -1, 1) - d.steer) * (1 - Math.exp(-spec.steer * dt));
    const step = d.steer * turnRate(spec, d.speed) * dt;
    // On the stick's line it stays there (the wheel is still unwinding: it used to carry the nose a hair past and back).
    d.heading += step * error > 0 ? Math.sign(step) * Math.min(Math.abs(step), Math.abs(error)) : Math.abs(error) < 1e-9 ? 0 : step;
    d.heading = Math.atan2(Math.sin(d.heading), Math.cos(d.heading));
    // The build-up to top speed waits for cruise, not for a straight line: steering does not reset it.
    d.straight = d.speed >= spec.cruise * .85 ? d.straight + dt : 0;
    target = Math.min(limit, targetSpeed(spec, d, error, outside));
  } else { d.steer *= Math.exp(-spec.steer * dt); d.straight = 0; }
  if (d.speed < target) d.speed = Math.min(target, d.speed + (d.speed < spec.cruise ? spec.accel : spec.boost) * dt);
  else d.speed = Math.max(target, d.speed - spec.brake * dt);
  return d.speed * dt;
}
/** A bump: what is left of the speed after running into something. */
export const bump = speed => Math.min(speed, 3);
/** The pieces a move of `distance` metres is cut into so that no piece is longer than `max`: nothing thin is stepped over. */
export const subSteps = (distance, max = .5) => Math.max(1, Math.ceil(Math.abs(distance) / max));
/** The speed from which it can still stop in `distance` metres. */
export const arrivalSpeed = (spec, distance) => Math.sqrt(2 * spec.brake * Math.max(0, distance));
/**
 * The camera while driving: how much farther back it stands at a speed (1 standing, `max` flat out), and how far ahead
 * of the vehicle it looks (metres), never more than `room` (a share of the ground in view).
 */
export const DRIVE_CAMERA = { zoom: 1.45, lead: .3, follow: 10, room: .45 };
export const driveZoom = (spec, speed) => 1 + (DRIVE_CAMERA.zoom - 1) * smooth(speed, spec.cruise * .5, spec.top);
export const lookAhead = (speed, room) => Math.min(room, speed * DRIVE_CAMERA.lead);
