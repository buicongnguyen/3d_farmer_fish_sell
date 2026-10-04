// How the jeep and the motorcycle drive. Pure (no three.js, no DOM): node tests it.
//
// The models' noses point along +z (grille, headlights and hood at z > 0, tail lamps at z < 0), so a vehicle whose
// heading is h is drawn with rotation.y = h and travels along (sin h, cos h): the nose leads. (Before round 7 the mesh was
// turned to the avatar's facing plus half a turn, so it drove tail first.)
//
// Controls stay screen-relative like walking: the stick says where you want to go, and the vehicle steers its nose
// towards that at a limited rate. It never jumps to a heading, it cannot slide sideways, and it has no reverse gear:
// pull the stick back and it swings round in a U-turn and drives off nose first.
//
// Speed (walking is 4.8 m/s; the brief asks for 4x to 8x):
//   * `cruise` 4x (19.2 m/s) is reached in about a second and is the limit inside the village footprint;
//   * on open ground, after `boostAfter` seconds at cruise, it builds on to `top` 8x (38.4 m/s);
//   * steering takes NO speed off (round 8): a right angle, a weave, the stick thrown from full left to full right, a
//     stick pulled straight back: every change of direction is driven at full speed and none of them holds the build-up
//     to top speed back. (A first version still eased off for a stick more than 2.2 rad off the nose; pure left then
//     pure right is exactly that, so it is gone. The price is a U-turn about 30 m across for the jeep at top speed.)
//     Nor does a moment without input between left and right (`COAST`): it used to brake at once and start the build-up again;
//   * coming back towards the village it brakes in time: the limit at d metres outside the village is
//     sqrt(cruise² + 2 · brake · d).
// Turning is arcade grip: `turn` radians a second at a standstill, easing to `fast` at top speed (a right angle at
// 38.4 m/s in about a second for the jeep, less for the motorcycle; before round 8 it was grip / speed, 0.5 rad/s there).
//   The motorcycle is the nimble one: quicker off the mark, a faster turn at every speed.
export const WALK_SPEED = 4.8;
/** Produce sales that unlock Theo's jeep (game.mjs parseSave and prompts.mjs both read it here; prompts.mjs re-exports it for main.mjs). */
export const JEEP_SALES = 200;
export const VEHICLES = {
  jeep: { cruise: WALK_SPEED * 4, top: WALK_SPEED * 8, accel: 16, boost: 6, brake: 22, crawl: 5, turn: 3, fast: 2.6, steer: 9, boostAfter: .6, radius: 1.9, body: 1.25, length: 4.8 },
  bike: { cruise: WALK_SPEED * 4, top: WALK_SPEED * 8, accel: 24, boost: 9.6, brake: 28, crawl: 6, turn: 4.6, fast: 3.9, steer: 12, boostAfter: .35, radius: .95, body: .5, length: 2.8 },
};
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (v, a, b) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
/** The shortest signed turn from heading a to heading b. */
export const turnBetween = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
/** A parked vehicle's driving state. `heading` is where its nose points (atan2(x, z)); `straight`: seconds it has been at cruise or faster. */
export const newDrive = (heading = 0) => ({ heading, speed: 0, steer: 0, straight: 0, idle: 0 });
/** Seconds without input that it coasts through at its speed before it starts to brake: A let go a little before D is pressed, both down for a moment, a thumb lifted and put back. */
export const COAST = .12;
/** The fastest it may go `outside` metres beyond the village footprint (0 inside it). */
export const openLimit = (spec, outside) => outside > 0 ? Math.min(spec.top, Math.sqrt(spec.cruise * spec.cruise + 2 * spec.brake * outside)) : spec.cruise;
/** How fast it can turn at a speed (radians a second): the standstill rate, easing to `fast` at top speed. */
export const turnRate = (spec, speed) => spec.turn + (spec.fast - spec.turn) * clamp(Math.abs(speed) / spec.top, 0, 1);
/** The speed it aims for: the open-ground limit once it has been at cruise a while, else cruise. Where the stick points takes nothing off. */
export function targetSpeed(spec, d, outside) {
  const open = openLimit(spec, outside); return d.straight >= spec.boostAfter ? open : Math.min(spec.cruise, open);
}
/**
 * Following a tapped route: the fastest it can go and still reach a corner `gap` metres away, `error` radians off the
 * nose. A corner inside its turning circle (gap < 2 · radius · sin error) would be circled for ever, so there, and only
 * there, it takes the corner slower: as slow as it takes (down to `ROUTE_CRAWL`, a turning circle half a metre across,
 * well inside the 1.2 m within which a tapped spot counts as reached). A corner ahead, or far enough away, costs nothing.
 */
export const ROUTE_CRAWL = 1.5;
export function routeSpeed(spec, gap, error) {
  const off = Math.sin(Math.min(Math.abs(error), Math.PI / 2));
  return off < 1e-3 ? Infinity : Math.max(ROUTE_CRAWL, spec.fast * .85 * gap / (2 * off));
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
    target = Math.min(limit, targetSpeed(spec, d, outside)); d.idle = 0;
  } else {
    // No input: after a moment (COAST) it brakes to a stop. The build-up to top speed is lost once it has slowed below cruise, not at once.
    d.steer *= Math.exp(-spec.steer * dt); d.idle = (d.idle ?? 0) + dt; if (d.speed < spec.cruise * .85) d.straight = 0;
    if (d.idle <= COAST + 1e-9) return d.speed * dt;
  }
  if (d.speed < target) d.speed = Math.min(target, d.speed + (d.speed < spec.cruise ? spec.accel : spec.boost) * dt);
  else d.speed = Math.max(target, d.speed - spec.brake * dt);
  return d.speed * dt;
}
/** A bump: what is left of the speed after running into something. */
export const bump = speed => Math.min(speed, 3);
/**
 * A glancing blow: it goes on along a wall or round a trunk and keeps the part of its speed that points that way
 * (`keep`: the cosine of the angle it is turned through). Along a wall never less than a crawl. Round a trunk never less
 * than cruise when the way round is ahead of it (so a tree costs a swerve, not the build-up to top speed), and half of
 * cruise when it has to turn more than a right angle to get round.
 */
export const glance = (spec, speed, keep, trunk = false) => Math.max(2, Math.min(speed, Math.max(trunk ? spec.cruise * (keep > 0 ? 1 : .5) : spec.crawl, speed * keep)));
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
/**
 * The far view (round 8): a second pull-back, by how far beyond the ward the car is (ward.mjs wildDepth), so that out in the
 * regions the borders round you are in view. `FAR_VIEW`: the half-height (metres, before the portrait factor) it opens to;
 * `FAR_DEPTH`: metres beyond the ward where it starts and where it is full. `zoom` is world.zoom (the wheel's own half-height):
 * a player already zoomed out to FAR_VIEW or more gets 1. DriveView.focus takes the larger of this and driveZoom, never the product.
 */
export const FAR_VIEW = 36;
export const FAR_DEPTH = [24, 104];
export const farZoom = (zoom, depth) => 1 + (Math.max(1, FAR_VIEW / zoom) - 1) * smooth(depth, FAR_DEPTH[0], FAR_DEPTH[1]);
/**
 * Shadows by the view's effective half-height (world.zoom / camera.zoom, before the portrait factor), however the view got wide
 * (speed, the far view, the wheel): full up to `full` (the default zoom 15 at the drive camera's 1.45, which the shadow box is
 * fitted for), faded to nothing at `none`; above that the shadow pass is not drawn at all, and it comes back below `full`.
 */
export const SHADOW_VIEW = { full: 15 * DRIVE_CAMERA.zoom, none: 28.5 };
export const shadowShare = view => 1 - smooth(view, SHADOW_VIEW.full, SHADOW_VIEW.none);
/**
 * The camera rig for an effective half-height `half` (metres, the portrait factor included): `distance` from the camera to its
 * focus, so the ground at the bottom of the screen stays 14 m clear of the camera plane (59.65 m, today's 45 m back and 39.15 m up,
 * until the view is wider than that allows); the far plane and the fog's near distance move out with it. `share`: the far view's share, 0 to 1.
 */
export const RIG = { distance: 45 * Math.hypot(1, .87), far: 220, fog: 80 };
export function cameraRig(half, share = 0, out = {}) {
  const d = Math.max(RIG.distance, half * 1.151 + 14), near = Math.max(RIG.fog, d + half * 1.151);
  out.distance = d; out.back = d / Math.hypot(1, .87); out.far = RIG.far + (d - RIG.distance) * 2; out.fogNear = near; out.fogFar = near + 80 + 40 * share; return out;
}
