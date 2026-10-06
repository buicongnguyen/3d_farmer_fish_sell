// Shadow proxies (docs/SHADOW-PROXIES.md): the shadow pass draws a low-polygon stand-in of the heavy casters instead of the
// real mesh. At the village centre on "high" the shadow pass was about 45% of the frame's triangles, most of it tree crowns,
// villagers' heads and bodies and the baked village cells, drawn a second time into a 2048 map whose texel is 4 to 5 cm.
//
// A proxy is a child of the mesh it stands for, on layer 1 only (SHADOW_LAYER), with castShadow on; the real mesh casts
// nothing. The main camera sees layer 0 only, so a proxy is never in the main pass (no new main draws), and install() lets the
// shadow pass see layer 1 as well (three's WebGLShadowMap tests each caster against the MAIN camera's layers). Being a child,
// a proxy hides with its mesh (cullView, the tile and village culling, a villager indoors) and follows its pose.
//
// Two shapes:
//   hull(geometry)    a stack of 8-sided rings: at a few heights, the cross-section's extent in eight directions (its support
//                     function), the heights chosen where the profile bends most. Trees, bushes, rocks, heads and bodies: about
//                     100 triangles for a 550-triangle tree. Instanced meshes get an instanced proxy that shares their matrices.
//   cluster(geometry) the village cells: each connected part keeps its own vertices merged on a grid a quarter of its middle
//                     size (a house wall keeps its corners, a lamp post its thickness); parts smaller than DROP cast nothing.
// Everything is made once (geometries are cached per source geometry); nothing runs per frame.
import * as T from 'three';
import { depthFor } from './toon.mjs';
import { SUN_OFFSET } from './sun-shadow.mjs';

export const SHADOW_LAYER = 1;
/** Hull: directions round the axis, the most rings, the profile error (share of the size) a ring is added for, the outward stretch. */
export const HULL = { sides: 12, rings: 7, fine: 16, tolerance: .03, grow: 1.01, minTriangles: 100, maxAspect: 1.8 };
/** Cluster: parts under DROP metres (longest side) cast nothing; the grid is the part's middle side x GRID, within [MIN, MAX] metres. */
export const CLUSTER = { drop: .3, grid: .25, min: .02, max: .4 };
/**
 * The silhouette check every proxy passes before it is used: the real mesh and the proxy are drawn as seen from the sun on a
 * grid of FIT.grid cells across them; the proxy is refused when it darkens more than FIT.extra, or leaves out more than
 * FIT.missing, of the real shadow's cells. A tree or a person turns, so they are checked from FIT.turns sun bearings; the
 * village cells stand still and are checked from the sun's one bearing. (A palm's fronds are sparse: their hull would cast
 * a solid disc, so a palm keeps its own shadow.)
 */
export const FIT = { grid: 40, extra: .2, missing: .15, turns: 4 };

const proxyMaterial = new T.MeshBasicMaterial(), hulls = new WeakMap();
let installed = null;

/** Lets the shadow pass see SHADOW_LAYER as well as what the camera sees (once per renderer). */
export function install(renderer) {
  if (installed === renderer) return; installed = renderer;
  const map = renderer.shadowMap, render = map.render;
  map.render = function (lights, scene, camera) { const mask = camera.layers.mask; camera.layers.mask = mask | 1 << SHADOW_LAYER; try { render.call(this, lights, scene, camera); } finally { camera.layers.mask = mask; } };
}

/** The mesh that casts for `mesh`: its proxy if it has one. */
export const caster = mesh => mesh.userData.proxy ?? mesh;
/** Turns a mesh's shadow on or off: on its proxy when it has one (the real mesh then never casts). */
export function cast(mesh, on) { const p = mesh.userData.proxy; if (p) { p.castShadow = on; mesh.castShadow = false; } else mesh.castShadow = on; }

/** Hangs `geometry` under `mesh` as its shadow proxy and moves the mesh's shadow onto it. Returns the proxy. */
export function attach(mesh, geometry) {
  let proxy;
  if (mesh.isInstancedMesh) {
    proxy = new T.InstancedMesh(geometry, proxyMaterial, 0); proxy.instanceMatrix = mesh.instanceMatrix;
    // The same matrices and always the same number of them (a grove that grows or fells trees changes the real mesh only).
    // ... and the real mesh's bounding sphere, so the shadow camera culls the two alike.
    Object.defineProperty(proxy, 'count', { get() { return this.parent?.count ?? 0; }, set() {} });
    Object.defineProperty(proxy, 'boundingSphere', { get() { const p = this.parent; if (p.boundingSphere === null) p.computeBoundingSphere(); return p.boundingSphere; }, set() {} });
    depthFor(proxy);
  } else proxy = new T.Mesh(geometry, proxyMaterial);
  // Hidden with the real mesh (a child of a hidden mesh is never drawn) and tested against the shadow camera like it.
  proxy.frustumCulled = mesh.frustumCulled; proxy.layers.set(SHADOW_LAYER); proxy.name = 'shadow-proxy'; proxy.userData.shadowOf = true;
  proxy.castShadow = mesh.castShadow; mesh.castShadow = false; proxy.receiveShadow = false; proxy.matrixAutoUpdate = false;
  // Not enumerable: Object3D.clone() copies userData through JSON (avatar.mjs keeps its parts the same way).
  Object.defineProperty(mesh.userData, 'proxy', { value: proxy, enumerable: false, configurable: true, writable: true });
  mesh.add(proxy); proxy.updateMatrixWorld(true);
  return proxy;
}

const triangles = g => (g.index ? g.index.count : g.getAttribute('position').count) / 3;
/**
 * The proxy of an instanced mesh (trees, bushes, rocks) when it pays: at least HULL.minTriangles a copy. A roundish footprint
 * tries the hull first (a fence or a wall section is long and thin, and a ring round it would cast a fat shadow); what the hull
 * cannot follow tries the cluster. Either must pass the silhouette check (fits). Returns the proxy or null.
 */
export function instanced(inst) {
  if (inst.userData.proxy) return inst.userData.proxy;
  const g = hullOf(inst.geometry); return g ? attach(inst, g) : null;
}
/** A villager's head or body (any rigid mesh): its hull proxy, made the first time its shadow is wanted. */
export function rigid(mesh) { if (mesh.userData.proxy) return mesh.userData.proxy; const g = hullOf(mesh.geometry); if (!g) mesh.userData.noProxy = true; return g ? attach(mesh, g) : null; }

export function hullOf(geometry) {
  if (hulls.has(geometry)) return hulls.get(geometry);
  let out = null;
  if (triangles(geometry) >= HULL.minTriangles) {
    geometry.computeBoundingBox(); const b = geometry.boundingBox, w = b.max.x - b.min.x, d = b.max.z - b.min.z;
    if (Math.max(w, d) <= HULL.maxAspect * Math.max(1e-6, Math.min(w, d))) out = hull(geometry);
    if (out && (triangles(out) >= triangles(geometry) * .8 || !fits(geometry, out, FIT.turns))) { out.dispose(); out = null; }
    // A shape the hull cannot follow (a frog's legs, a wolf, a bushy tree with gaps) may still merge on a grid.
    if (!out) { out = cluster(geometry); if (out && !fits(geometry, out, FIT.turns)) { out.dispose(); out = null; } }
  }
  hulls.set(geometry, out); return out;
}

/**
 * A closed stack of HULL.sides-sided rings round `geometry` (its own space). At HULL.fine + 1 heights the cross-section is read
 * (where its triangles' edges cross that height, and every vertex within half a step of it); each ring stands round the middle
 * of that cross-section and reaches its extent in each direction. The rings kept are the ends and then, one at a time, the
 * height the kept rings miss by most, until they miss by less than HULL.tolerance of the size or HULL.rings are kept.
 */
export function hull(geometry, { sides = HULL.sides, rings = HULL.rings, fine = HULL.fine, tolerance = HULL.tolerance, grow = HULL.grow } = {}) {
  const p = geometry.getAttribute('position'), index = geometry.index, n = index ? index.count : p.count, at = i => index ? index.getX(i) : i;
  geometry.computeBoundingBox(); const b = geometry.boundingBox, y0 = b.min.y, y1 = b.max.y, H = y1 - y0;
  if (!(H > 1e-4)) return null;
  const cos = [], sin = []; for (let k = 0; k < sides; k++) { cos.push(Math.cos(k * 2 * Math.PI / sides)); sin.push(Math.sin(k * 2 * Math.PI / sides)); }
  const L = fine + 1, cx = new Float64Array(L), cz = new Float64Array(L), r = new Float64Array(L * sides), half = H / fine / 2;
  // Each point of the cross-section at level j, by callback: vertices near it, then edge crossings.
  const level = (j, f) => {
    const h = Math.min(y1 - H * .01, Math.max(y0 + H * .01, y0 + H * j / fine)), lo = y0 + H * j / fine - half, hi = lo + 2 * half;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y >= lo && y <= hi) f(p.getX(i), p.getZ(i)); }
    for (let t = 0; t < n; t += 3) for (let e = 0; e < 3; e++) {
      const a = at(t + e), c = at(t + (e + 1) % 3), ya = p.getY(a), yc = p.getY(c);
      if ((ya - h) * (yc - h) > 0 || ya === yc) continue;
      const s = (h - ya) / (yc - ya); f(p.getX(a) + (p.getX(c) - p.getX(a)) * s, p.getZ(a) + (p.getZ(c) - p.getZ(a)) * s);
    }
  };
  for (let j = 0; j < L; j++) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    level(j, (x, z) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; });
    if (x0 > x1) { x0 = x1 = (b.min.x + b.max.x) / 2; z0 = z1 = (b.min.z + b.max.z) / 2; }
    const mx = cx[j] = (x0 + x1) / 2, mz = cz[j] = (z0 + z1) / 2, o = j * sides;
    level(j, (x, z) => { for (let k = 0; k < sides; k++) { const v = (x - mx) * cos[k] + (z - mz) * sin[k]; if (v > r[o + k]) r[o + k] = v; } });
  }
  const keep = [0, fine], size = Math.max(H, b.max.x - b.min.x, b.max.z - b.min.z);
  while (keep.length < rings) {
    keep.sort((a, c) => a - c); let worst = -1, miss = tolerance * size;
    for (let q = 0; q + 1 < keep.length; q++) for (let j = keep[q] + 1; j < keep[q + 1]; j++) {
      const a = keep[q], c = keep[q + 1], s = (j - a) / (c - a);
      let e = Math.hypot(cx[j] - (cx[a] + (cx[c] - cx[a]) * s), cz[j] - (cz[a] + (cz[c] - cz[a]) * s));
      for (let k = 0; k < sides; k++) e = Math.max(e, Math.abs(r[j * sides + k] - (r[a * sides + k] + (r[c * sides + k] - r[a * sides + k]) * s)));
      if (e > miss) { miss = e; worst = j; }
    }
    if (worst < 0) break; keep.push(worst);
  }
  keep.sort((a, c) => a - c);
  const R = keep.length, pos = new Float32Array((R * sides + 2) * 3), idx = [];
  keep.forEach((j, i) => { for (let k = 0; k < sides; k++) { const v = (i * sides + k) * 3, e = Math.max(0, r[j * sides + k]) * grow; pos[v] = cx[j] + cos[k] * e; pos[v + 1] = y0 + H * j / fine; pos[v + 2] = cz[j] + sin[k] * e; } });
  const top = R * sides, bottom = top + 1;
  pos.set([cx[fine], y1, cz[fine]], top * 3); pos.set([cx[0], y0, cz[0]], bottom * 3);
  for (let i = 0; i + 1 < R; i++) for (let k = 0; k < sides; k++) {
    const a = i * sides + k, c = i * sides + (k + 1) % sides, d = a + sides, e = c + sides;
    idx.push(a, d, c, c, d, e);
  }
  for (let k = 0; k < sides; k++) { const k1 = (k + 1) % sides; idx.push(top, (R - 1) * sides + k1, (R - 1) * sides + k, bottom, k, k1); }
  const out = new T.BufferGeometry(); out.setAttribute('position', new T.BufferAttribute(pos, 3)); out.setIndex(idx);
  out.computeBoundingSphere(); out.computeBoundingBox(); return out;
}

/**
 * The cluster proxy of a baked village cell: connected parts (joined where they share a corner) are read apart; a part whose
 * longest side is under CLUSTER.drop is left out; every other part's vertices are merged on a grid of its middle side x
 * CLUSTER.grid (at least CLUSTER.min, at most CLUSTER.max metres), each merged vertex at the mean of those it stands for, and
 * the triangles that collapse or repeat are dropped. Returns null when that saves less than a fifth.
 */
export function cluster(geometry, { drop = CLUSTER.drop, grid = CLUSTER.grid, min = CLUSTER.min, max = CLUSTER.max } = {}) {
  const p = geometry.getAttribute('position'), V = p.count, index = geometry.index, n = index ? index.count : V, at = i => index ? index.getX(i) : i;
  const up = new Int32Array(V); for (let i = 0; i < V; i++) up[i] = i;
  const find = i => { while (up[i] !== i) { up[i] = up[up[i]]; i = up[i]; } return i; }, join = (a, c) => { a = find(a); c = find(c); if (a !== c) up[c] = a; };
  const same = new Map();
  for (let i = 0; i < V; i++) { const k = ((Math.round(p.getX(i) * 500) + 131072) * 262144 + Math.round(p.getZ(i) * 500) + 131072) * 65536 + Math.round(p.getY(i) * 500) + 32768, j = same.get(k); if (j === undefined) same.set(k, i); else join(j, i); }
  for (let t = 0; t < n; t += 3) { join(at(t), at(t + 1)); join(at(t), at(t + 2)); }
  const box = new Map();
  for (let i = 0; i < V; i++) { const root = find(i); let q = box.get(root); if (!q) box.set(root, q = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]); const x = p.getX(i), y = p.getY(i), z = p.getZ(i); if (x < q[0]) q[0] = x; if (y < q[1]) q[1] = y; if (z < q[2]) q[2] = z; if (x > q[3]) q[3] = x; if (y > q[4]) q[4] = y; if (z > q[5]) q[5] = z; }
  const step = new Map();
  for (const [root, q] of box) { const s = [q[3] - q[0], q[4] - q[1], q[5] - q[2]].sort((a, c) => a - c); step.set(root, s[2] < drop ? 0 : Math.min(max, Math.max(min, s[1] * grid))); }
  const merged = new Map(), sums = [], of = new Int32Array(V).fill(-1);
  for (let i = 0; i < V; i++) {
    const root = find(i), g = step.get(root); if (!g) continue;
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), key = `${root}|${Math.floor(x / g)}|${Math.floor(y / g)}|${Math.floor(z / g)}`;
    let m = merged.get(key); if (m === undefined) { merged.set(key, m = sums.length / 4); sums.push(0, 0, 0, 0); }
    sums[m * 4] += x; sums[m * 4 + 1] += y; sums[m * 4 + 2] += z; sums[m * 4 + 3]++; of[i] = m;
  }
  const seen = new Set(), idx = [];
  for (let t = 0; t < n; t += 3) {
    const a = of[at(t)], c = of[at(t + 1)], d = of[at(t + 2)];
    if (a < 0 || a === c || c === d || a === d) continue;
    const lo = Math.min(a, c, d), key = lo === a ? `${a},${c},${d}` : lo === c ? `${c},${d},${a}` : `${d},${a},${c}`;
    if (seen.has(key)) continue; seen.add(key); idx.push(a, c, d);
  }
  if (idx.length / 3 > n / 3 * .8) return null;
  const pos = new Float32Array(sums.length / 4 * 3);
  for (let m = 0; m < sums.length / 4; m++) { const k = sums[m * 4 + 3]; pos[m * 3] = sums[m * 4] / k; pos[m * 3 + 1] = sums[m * 4 + 1] / k; pos[m * 3 + 2] = sums[m * 4 + 2] / k; }
  const out = new T.BufferGeometry(); out.setAttribute('position', new T.BufferAttribute(pos, 3)); out.setIndex(idx);
  out.computeBoundingSphere(); return out;
}

/** Every casting cell of a baked village group gets its cluster proxy (once). */
export function cells(group) {
  for (const m of group.children) if (m.userData.casts && !m.userData.proxy) { const g = cluster(m.geometry); if (g && fits(m.geometry, g, 1, { grid: 96 })) attach(m, g); else g?.dispose(); }
}

/**
 * Whether `proxy` casts nearly the shadow `real` does (FIT): both are drawn, flat, as the sun sees them from `turns` bearings
 * (the sun's own first, then turned round the up axis), on one grid over the two.
 */
export function fits(real, proxy, turns = 1, { grid = FIT.grid, extra = FIT.extra, missing = FIT.missing } = {}) {
  const l = Math.hypot(SUN_OFFSET[0], SUN_OFFSET[1], SUN_OFFSET[2]), dy = SUN_OFFSET[1] / l, flat = Math.hypot(SUN_OFFSET[0], SUN_OFFSET[2]) / l, yaw0 = Math.atan2(SUN_OFFSET[0], SUN_OFFSET[2]);
  for (let t = 0; t < turns; t++) {
    const yaw = yaw0 + t * 2 * Math.PI / turns, d = [Math.sin(yaw) * flat, dy, Math.cos(yaw) * flat];
    // Two axes across the sun's direction: one level, one tilted.
    const ax = [Math.cos(yaw), 0, -Math.sin(yaw)], ay = [d[1] * ax[2] - d[2] * ax[1], d[2] * ax[0] - d[0] * ax[2], d[0] * ax[1] - d[1] * ax[0]];
    const box = [Infinity, Infinity, -Infinity, -Infinity];
    for (const g of [real, proxy]) { const p = g.getAttribute('position'); for (let i = 0; i < p.count; i++) { const u = p.getX(i) * ax[0] + p.getY(i) * ax[1] + p.getZ(i) * ax[2], v = p.getX(i) * ay[0] + p.getY(i) * ay[1] + p.getZ(i) * ay[2]; if (u < box[0]) box[0] = u; if (v < box[1]) box[1] = v; if (u > box[2]) box[2] = u; if (v > box[3]) box[3] = v; } }
    const cell = Math.max(box[2] - box[0], box[3] - box[1]) / grid || 1, a = shade(real, ax, ay, box, cell, grid), b = shade(proxy, ax, ay, box, cell, grid);
    let both = 0, onlyA = 0, onlyB = 0; for (let i = 0; i < a.length; i++) { if (a[i] && b[i]) both++; else if (a[i]) onlyA++; else if (b[i]) onlyB++; }
    const real0 = both + onlyA; if (!real0) return false;
    fits.last = [onlyB / real0, onlyA / real0];
    if (onlyB > extra * real0 || onlyA > missing * real0) return false;
  }
  return true;
}
/** The grid cells (centres) a geometry covers, seen along the sun: one byte a cell. */
function shade(g, ax, ay, box, cell, grid) {
  const n = grid + 1, out = new Uint8Array(n * n), p = g.getAttribute('position'), index = g.index, count = index ? index.count : p.count, at = i => index ? index.getX(i) : i, u = [0, 0, 0], v = [0, 0, 0];
  for (let t = 0; t < count; t += 3) {
    for (let k = 0; k < 3; k++) { const i = at(t + k), x = p.getX(i), y = p.getY(i), z = p.getZ(i); u[k] = (x * ax[0] + y * ax[1] + z * ax[2] - box[0]) / cell; v[k] = (x * ay[0] + y * ay[1] + z * ay[2] - box[1]) / cell; }
    const area = (u[1] - u[0]) * (v[2] - v[0]) - (u[2] - u[0]) * (v[1] - v[0]); if (Math.abs(area) < 1e-9) continue;
    const i0 = Math.max(0, Math.ceil(Math.min(u[0], u[1], u[2]) - .5)), i1 = Math.min(n - 1, Math.floor(Math.max(u[0], u[1], u[2]) - .5)), j0 = Math.max(0, Math.ceil(Math.min(v[0], v[1], v[2]) - .5)), j1 = Math.min(n - 1, Math.floor(Math.max(v[0], v[1], v[2]) - .5));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = i + .5, y = j + .5, w0 = ((u[1] - x) * (v[2] - y) - (u[2] - x) * (v[1] - y)) / area, w1 = ((u[2] - x) * (v[0] - y) - (u[0] - x) * (v[2] - y)) / area;
      if (w0 >= 0 && w1 >= 0 && w0 + w1 <= 1) out[j * n + i] = 1;
    }
  }
  return out;
}
/**
 * Other heavy still casters under `root` (the home, the Town Square's buildings, the workshop: meshes placed whole, not baked
 * into cells) get a cluster proxy too: plain meshes of at least `least` triangles that cast, not a person's part.
 */
export function statics(root, least = 1000) {
  const list = [];
  root.traverse(m => { if (m.isMesh && !m.isInstancedMesh && !m.isSkinnedMesh && m.castShadow && !m.userData.proxy && !m.userData.shadowOf && triangles(m.geometry) >= least) list.push(m); });
  for (const m of list) { let person = false; for (let q = m.parent; q; q = q.parent) if (q.userData.avatar || q.name === 'hero') person = true; if (person) continue; const g = cluster(m.geometry); if (g && fits(m.geometry, g, FIT.turns, { grid: 64 })) attach(m, g); else g?.dispose(); }
}
