// A bounded recovery search, used only after repeated collisions make no forward progress.
// Every half-metre edge keeps the vehicle's full clearance; it never uses the pedestrian route radius.
export function escapeRoute(view, spec, x, z, dx, dz) {
  const N = 97, MID = 48, STEP = .5, start = MID * N + MID, parent = new Int16Array(N * N).fill(-1), queue = [start], offsets = [-1, 1, -N, N, -N - 1, -N + 1, N - 1, N + 1];
  const length = Math.hypot(dx, dz); dx /= length; dz /= length; parent[start] = start;
  let best = start, score = 2;
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q], cx = i % N, cz = Math.floor(i / N), px = x + (cx - MID) * STEP, pz = z + (cz - MID) * STEP;
    const forward = (px - x) * dx + (pz - z) * dz;
    if (forward > score && !view.blocked(px + dx, pz + dz, spec)) { score = forward; best = i; if (forward > 8) break; }
    for (const off of offsets) {
      const j = i + off, nx = j % N, nz = Math.floor(j / N);
      if (j < 0 || j >= parent.length || Math.abs(nx - cx) > 1 || Math.abs(nz - cz) > 1 || parent[j] >= 0) continue;
      const tx = x + (nx - MID) * STEP, tz = z + (nz - MID) * STEP;
      if (view.blocked(tx, tz, spec) || view.blocked((px + tx) / 2, (pz + tz) / 2, spec)) continue;
      parent[j] = i; queue.push(j);
    }
  }
  if (best === start) return null;
  const path = []; for (let i = best; i !== start; i = parent[i]) path.push({ x: x + (i % N - MID) * STEP, z: z + (Math.floor(i / N) - MID) * STEP });
  path.reverse(); for (let i = path.length - 2; i > 0; i--) if ((path[i].x - path[i - 1].x) * (path[i + 1].z - path[i].z) === (path[i].z - path[i - 1].z) * (path[i + 1].x - path[i].x)) path.splice(i, 1);
  return path;
}
