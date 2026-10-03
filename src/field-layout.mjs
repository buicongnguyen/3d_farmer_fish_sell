// The landscape is deterministic, so revisiting a place keeps its trees in place.
export const FIELD_TILE = 64;
export const FIELD_RADIUS = 2;
export const OUTDOOR_LIMIT = 32768;
export const HOMESTEAD = { x: 0, z: -8.6 };
/** The spur of the county road that leaves the village by the east gate (world.mjs draws it from x 54.5 to 65.5): the fields keep off it. */
const GATE_ROAD = { x0: 52, x1: 67, z0: -4, z1: 4 };

/** The village camera (world.mjs): turned CAMERA_YAW round the player, CAMERA_RISE up for every metre back, so it looks down at CAMERA_PITCH (41 degrees). */
export const CAMERA_YAW = .38, CAMERA_RISE = .87, CAMERA_PITCH = Math.atan(CAMERA_RISE);
/**
 * The village footprint: the ring road (content.mjs ROADS: x -52…52, z -33…37, 5 m wide) and the Town Square on its north
 * side (back walls at z -43.6), with a few metres of verge. East it reaches a little farther, for the gate to the country
 * road. Inside it the village keeps its own trees, tufts and flowers (village-plan.mjs); outside, the open fields begin.
 */
export const VILLAGE = { x0: -58, x1: 61, z0: -49, z1: 43 };
export function inVillage(x, z) { return x > VILLAGE.x0 && x < VILLAGE.x1 && z > VILLAGE.z0 && z < VILLAGE.z1; }
/** How far outside a rectangle {x0, x1, z0, z1} a point lies (0 inside). */
export const beyondRect = (r, x, z) => Math.hypot(Math.max(0, r.x0 - x, x - r.x1), Math.max(0, r.z0 - z, z - r.z1));
/** Metres beyond the village footprint (0 inside). */
export const beyondVillage = (x, z) => beyondRect(VILLAGE, x, z);
export function fieldRandom(cx, cz) {
  let seed = (Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663) ^ 0x57a811) >>> 0;
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
/** Open land: outside the village footprint and off the gate's road (`pad` keeps a tree's trunk and crown clear of it). */
const wild = (x, z, pad = 0) => !inVillage(x, z) && !(x > GATE_ROAD.x0 && x < GATE_ROAD.x1 + pad && z > GATE_ROAD.z0 - pad && z < GATE_ROAD.z1 + pad);
export function fieldPlan(cx, cz) {
  const random = fieldRandom(cx, cz), trees = [], grass = [];
  // Sparse trees leave broad, empty meadows between them.
  for (let i = 0; i < 8; i++) {
    const x = (cx + random()) * FIELD_TILE, z = (cz + random()) * FIELD_TILE;
    const scale = 1.25 + random() * .85, angle = random() * Math.PI * 2;
    if (wild(x, z, 2)) trees.push({ x, z, scale, angle, kind: i % 3 ? 'tree_round' : 'tree_pine' });
  }
  for (let i = 0; i < 100; i++) {
    const x = (cx + random()) * FIELD_TILE, z = (cz + random()) * FIELD_TILE;
    const scale = .6 + random() * .7, angle = random() * Math.PI * 2;
    if (wild(x, z)) grass.push({ x, z, scale, angle });
  }
  return { trees, grass };
}

export function homeBearing(player, home = HOMESTEAD, yaw = .38) {
  const dx = home.x - player.x, dz = home.z - player.z;
  // Orthographic camera: right axis and the ground's vertical foreshortening.
  const screenX = dx * Math.cos(yaw) - dz * Math.sin(yaw);
  const screenY = (dx * Math.sin(yaw) + dz * Math.cos(yaw)) * (.87 / Math.hypot(1, .87));
  return { distance: Math.hypot(dx, dz), angle: Math.atan2(screenX, -screenY) * 180 / Math.PI };
}
