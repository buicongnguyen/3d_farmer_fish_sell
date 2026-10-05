// Personal space for walkers. A person already overlapping may step out, but never farther in.
const sq = (x, z) => x * x + z * z;
const clear = (from, x, z, p, room) => { const d = sq(x - p.x, z - p.z); return d >= room * room || d > sq(from.x - p.x, from.z - p.z) + 1e-9; };
const ANGLES = [0, .7, -.7, 1.57, -1.57];
export function peopleClear(w, self, x, z) {
  const from = self ? self.mesh.position : w.player.position;
  if (self && !w.riding && !clear(from, x, z, w.player.position, .9)) return false;
  for (const o of w.npcs) if (o !== self && !o.inside && o.mesh.visible && !o.ride?.busy && !clear(from, x, z, o.mesh.position, self ? .85 : .9)) return false;
  return true;
}
// Try the lane first, then bear right so two people approaching head-on pass on opposite sides.
export function walkPerson(w, n, dx, dz, distance) {
  const at = n.mesh.position, d = Math.hypot(dx, dz); if (!d) return 0;
  dx /= d; dz /= d;
  for (const angle of ANGLES) {
    const c = Math.cos(angle), s = Math.sin(angle), ux = dx * c + dz * s, uz = dz * c - dx * s;
    const x = at.x + ux * distance, z = at.z + uz * distance;
    if (w.blocked(x, z) || !peopleClear(w, n, x, z)) continue;
    at.x = x; at.z = z; return distance;
  }
  return 0;
}
