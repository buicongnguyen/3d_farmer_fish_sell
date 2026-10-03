// The landscape is deterministic, so revisiting a place keeps its trees in place.
export const FIELD_TILE = 64;
export const FIELD_RADIUS = 2;
export const OUTDOOR_LIMIT = 32768;
export const HOMESTEAD = { x: 0, z: -8.6 };

export function inVillage(x, z) { return Math.abs(x) < 66 && Math.abs(z) < 64; }
export function fieldRandom(cx, cz) {
  let seed = (Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663) ^ 0x57a811) >>> 0;
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
export function fieldPlan(cx, cz) {
  const random = fieldRandom(cx, cz), trees = [], grass = [];
  // Sparse trees leave broad, empty meadows between them.
  for (let i = 0; i < 8; i++) {
    const x = (cx + random()) * FIELD_TILE, z = (cz + random()) * FIELD_TILE;
    const scale = 1.25 + random() * .85, angle = random() * Math.PI * 2;
    if (!inVillage(x, z)) trees.push({ x, z, scale, angle, kind: i % 3 ? 'tree_round' : 'tree_pine' });
  }
  for (let i = 0; i < 100; i++) {
    const x = (cx + random()) * FIELD_TILE, z = (cz + random()) * FIELD_TILE;
    const scale = .6 + random() * .7, angle = random() * Math.PI * 2;
    if (!inVillage(x, z)) grass.push({ x, z, scale, angle });
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
