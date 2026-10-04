// The sun's shadow, kept still (after Zoo Garden: cute_game src/camera-rig.ts shadowBox / lightAxes, world.ts followSun).
//
// The sun follows the camera, so its shadow map slides over the world as you walk. A shadow map is a grid of texels;
// when the grid slides by a fraction of a texel, every shadow edge is drawn from slightly different samples and
// crawls, and a thin thing (a fence picket, a villager's arm) is caught by a texel in one frame and missed in the next,
// so it blinks. Three rules stop that:
//   1. the shadow box has one size for a view (it is fitted when the zoom, the screen or the quality changes, never
//      from frame to frame), and its edges lie on a coarse grid, so a small zoom step keeps the same box;
//   2. the point the sun looks at is moved onto whole texels of that box, along the shadow camera's own axes, so the
//      texel grid is fixed to the ground;
//   3. the box holds exactly what the camera can see (the ground in view and what stands on it), so no shadow ends at
//      an edge that moves with you, and the texels are as small as the view allows.
//
// Pure (no three.js, no DOM): numbers and plain arrays, so node can test it. followSun() and fitShadow() only write to
// the light and the camera they are given.
import { CAMERA_YAW, CAMERA_RISE } from './field-layout.mjs';
import { hyp } from './hyp.mjs';

/** Where the sun stands from the point it looks at (world.mjs has always used this direction). */
export const SUN_OFFSET = [-24, 42, 22];
/**
 * `height`: nothing taller is in view (the school, 9.5 m; a field tree, 3.3 x 2.1 = 7 m). `margin`: slack round the view
 * for the snap and a tree top that leans over the edge. `step`: the box's edges lie on this grid (metres). `near`: the
 * shadow camera's near plane. `depthBias`: how far (metres) a surface is moved towards the light before the test;
 * `normalTexels`: how far, in texels, it is moved along its own normal (one and a half texels cover the filter's reach).
 */
export const SHADOW = { height: 10, margin: 1.5, step: 4, near: 1, pad: 2, depthBias: .02, normalTexels: 1.5, radius: 1 };
/** The shadow map's side in texels for a graphics setting (0: no shadows). */
export const shadowMapSize = quality => quality === 'high' ? 2048 : quality === 'battery' ? 0 : 1024;

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/**
 * The shadow camera's "up": the way the village camera looks along the ground (up the screen). The shadow box's y axis
 * then runs up the screen and its x axis across it, so the box hugs the view (with +y as up the same view needs a box
 * half as large again, and every texel is that much coarser).
 */
export const SHADOW_UP = [-Math.sin(CAMERA_YAW), 0, -Math.cos(CAMERA_YAW)];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/**
 * The axes of a directional light's shadow camera, the way three.js builds them (Matrix4.lookAt): z points from the
 * target back to the light, x = up × z, y = z × x. Each is a unit [x, y, z].
 */
export function lightAxes(offset = SUN_OFFSET, up = SHADOW_UP) {
  const length = Math.hypot(offset[0], offset[1], offset[2]), z = [offset[0] / length, offset[1] / length, offset[2] / length];
  const side = cross(up, z), flat = Math.hypot(side[0], side[1], side[2]), x = [side[0] / flat, side[1] / flat, side[2] / flat];
  return { x, y: cross(z, x), z, length };
}
/**
 * What the village camera shows, as eight points relative to the point it looks at: the four corners of the ground in
 * view, and the same screen corners `height` metres up. The camera is orthographic, turned `yaw` round the target and
 * `rise` up for every metre back; halfWidth and halfHeight are its right and top.
 */
export function viewVolume(halfWidth, halfHeight, height = SHADOW.height, yaw = CAMERA_YAW, rise = CAMERA_RISE) {
  const sin = rise / hyp(1, rise), cos = 1 / hyp(1, rise), points = [];
  // Screen right on the ground, and "up the screen" on the ground (away from the camera).
  const rx = Math.cos(yaw), rz = -Math.sin(yaw), ux = -Math.sin(yaw), uz = -Math.cos(yaw);
  for (const h of [0, height]) for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    // A point h metres up shows at screen height b * sin + h * cos, so the ground under it lies h * cos / sin nearer the camera.
    const a = sx * halfWidth, b = (sy * halfHeight - h * cos) / sin;
    points.push([rx * a + ux * b, h, rz * a + uz * b]);
  }
  return points;
}
/** The eight corners of a box standing on the ground: for the inside of a house. */
export function roomVolume(halfWidth, halfDepth, height) {
  const points = [];
  for (const h of [0, height]) for (const x of [-1, 1]) for (const z of [-1, 1]) points.push([x * halfWidth, h, z * halfDepth]);
  return points;
}
/**
 * The shadow box for a set of points (relative to the sun's target): left, right, bottom, top in the light's x and y,
 * with `margin` round them and the edges rounded outwards onto the `step` grid; `distance` is how far back the light
 * stands so that everything, and anything up to `height` above the ground between it and the light, is beyond `near`;
 * `far` reaches the farthest point.
 */
export function shadowBox(points, axes = lightAxes(), { margin = SHADOW.margin, step = SHADOW.step, near = SHADOW.near, pad = SHADOW.pad, height = SHADOW.height } = {}) {
  let left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity, toward = -Infinity, away = Infinity;
  for (const p of points) {
    const a = dot(p, axes.x), b = dot(p, axes.y), c = dot(p, axes.z);
    if (a < left) left = a; if (a > right) right = a; if (b < bottom) bottom = b; if (b > top) top = b;
    // A caster may stand anywhere on the light's ray above a point in view, up to `height` above the ground.
    const reach = c + Math.max(0, height - p[1]) / Math.max(.05, axes.z[1]);
    if (reach > toward) toward = reach; if (c < away) away = c;
  }
  const out = v => Math.ceil((v + margin) / step - 1e-9) * step, back = v => Math.floor((v - margin) / step + 1e-9) * step;
  const distance = Math.ceil(toward + near + pad);
  return { left: back(left), right: out(right), bottom: back(bottom), top: out(top), near, far: Math.ceil(distance - away + pad), distance };
}
/** A texel's size in metres along the light's x and y. */
export const texelSize = (box, mapSize) => [(box.right - box.left) / mapSize, (box.top - box.bottom) / mapSize];
/**
 * Moves the point the sun looks at onto the shadow map's texel grid: along the light's x and y to the nearest whole
 * texel (never more than half a texel each way). The light stands `distance` back along its z from the result, so the
 * shadow camera, too, sits on whole texels and its grid stays where it is on the ground while the camera moves.
 * Writes [x, y, z] into `out`.
 */
export function snapTarget(x, y, z, axes, texelX, texelY, out = [0, 0, 0]) {
  const a = x * axes.x[0] + y * axes.x[1] + z * axes.x[2], b = x * axes.y[0] + y * axes.y[1] + z * axes.y[2];
  const da = Math.round(a / texelX) * texelX - a, db = Math.round(b / texelY) * texelY - b;
  out[0] = x + axes.x[0] * da + axes.y[0] * db; out[1] = y + axes.x[1] * da + axes.y[1] * db; out[2] = z + axes.x[2] * da + axes.y[2] * db;
  return out;
}
/** Where a world point falls in the shadow map, in texels from the box's left and bottom (for tests: a fixed point keeps its fraction). */
export function texelOf(point, target, box, axes, mapSize) {
  const [tx, ty] = texelSize(box, mapSize), d = [point[0] - target[0], point[1] - target[1], point[2] - target[2]];
  return [(dot(d, axes.x) - box.left) / tx, (dot(d, axes.y) - box.bottom) / ty];
}

// ---------------------------------------------------------------- the light (duck-typed: a THREE.DirectionalLight)
const AXES = lightAxes(), spot = [0, 0, 0];
/**
 * Fits a light's shadow box to a view and sets its biases for the texel size it then has. `view` is
 * {halfWidth, halfHeight} for the village camera or {room: [halfWidth, halfDepth, height]} indoors. Returns the box.
 */
export function fitShadow(light, view, mapSize) {
  const points = view.room ? roomVolume(view.room[0], view.room[1], view.room[2]) : viewVolume(view.halfWidth, view.halfHeight);
  const box = shadowBox(points, AXES, view.room ? { height: view.room[2] } : undefined), camera = light.shadow.camera, [tx, ty] = texelSize(box, mapSize || 1024);
  camera.up.set(SHADOW_UP[0], SHADOW_UP[1], SHADOW_UP[2]);
  camera.left = box.left; camera.right = box.right; camera.bottom = box.bottom; camera.top = box.top; camera.near = box.near; camera.far = box.far; camera.updateProjectionMatrix();
  // three.js adds `bias` to a depth that runs 0..1 from near to far, and moves the tested point `normalBias` metres along its normal.
  light.shadow.bias = -SHADOW.depthBias / (box.far - box.near); light.shadow.normalBias = Math.max(tx, ty) * SHADOW.normalTexels; light.shadow.radius = SHADOW.radius;
  box.texel = [tx, ty]; box.mapSize = mapSize; box.fixed = !!view.room;
  return box;
}
/** Every frame: the sun looks at the texel nearest (x, 0, z) and stands back along its own direction. */
export function followSun(light, box, x, z) {
  if (box.fixed) { spot[0] = x; spot[1] = 0; spot[2] = z; } else snapTarget(x, 0, z, AXES, box.texel[0], box.texel[1], spot);
  light.target.position.set(spot[0], spot[1], spot[2]);
  light.position.set(spot[0] + AXES.z[0] * box.distance, spot[1] + AXES.z[1] * box.distance, spot[2] + AXES.z[2] * box.distance);
}
