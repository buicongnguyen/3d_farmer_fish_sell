import { hyp } from './hyp.mjs';
// How a wild creature's drawing decides things that used to flip from one frame to the next (wilds-view.mjs). Every
// rule here has two thresholds, so a creature that hovers at a boundary keeps the look it has instead of switching
// back and forth, and every change of pose is eased. Pure: numbers in, numbers out.
//
// What was wrong before (measured on a build of dd3e90d, ROUND7-RENDER.md): "is it walking?" was read from how far the
// creature had moved since the last frame. The simulation steps every 25 ms and a calm creature far from the player
// only thinks on every 4th step, so on most frames it had not moved at all and on the others it had: the walking pose
// (a hopper 45 cm in the air, a walker's legs at 0.75 rad) was drawn for single frames. That was the blinking.

/** Metres from the view's centre. `near`/`far`: animated parts inside, one merged mesh outside, unchanged in between. */
export const LOD = { near: 16, far: 20, hide: 4, shadow: 4, start: .3, stop: .12 };
/** Near look (true) or far look: switches in at `near`, out again only past `far`. */
export const nearLook = (was, distance, near = LOD.near, far = LOD.far) => was ? distance < far : distance < near;
/** Drawn at all: appears inside `reach`, disappears only `margin` metres past it. */
export const inView = (was, distance, reach, margin = LOD.hide) => was ? distance < reach + margin : distance < reach;
/** Casts a shadow: inside `reach`, and until `margin` past it once it does. */
export const castsShadow = (was, distance, reach, margin = LOD.shadow) => was ? distance < reach + margin : distance < reach;
/** Walking, from the speed it is drawn moving at (m/s): starts above `start`, stops below `stop`. */
export const walking = (was, speed, start = LOD.start, stop = LOD.stop) => was ? speed > stop : speed > start;
/** Moves `value` towards `target` so that the gap shrinks by `rate` per second (frame-rate independent). */
export const ease = (value, target, rate, dt) => value + (target - value) * (1 - Math.exp(-rate * dt));
/** The shortest signed turn from angle `a` to angle `b` (radians). */
export const turn = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
/** Turns `yaw` towards `target` by at most `rate` radians a second. */
export function turnToward(yaw, target, rate, dt) { const d = turn(yaw, target), step = rate * dt; return Math.abs(d) <= step ? target : yaw + Math.sign(d) * step; }
/**
 * How far past the screen creatures cast shadows: the corner of the ground in view (halfWidth across, halfDepth up the
 * screen), so no shadow appears or disappears on screen at the usual zooms; never under 20 m, never over 40 m (zoomed
 * far out a creature is a few pixels and its shadow fewer).
 */
export const shadowReach = (halfWidth, halfDepth) => Math.min(40, Math.max(20, hyp(halfWidth, halfDepth) + 2));
/** How many cells each way the creature window needs so that none is first seen inside the view (32 m cells; 2..4). */
export const cellRadius = (reach, cell = 32) => Math.min(4, Math.max(2, Math.ceil((reach + 12) / cell)));
