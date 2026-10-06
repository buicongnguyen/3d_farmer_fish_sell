// Rooftop perches for the field birds (FieldBirds in fields.mjs). Fetched with import() once the village stands, so the
// first-load bundle does not grow.
//
//   new RoofPerches(world)        reads the roofs once: vertical probes over each building's box in BLOCKS (village-plan.mjs)
//                                 against the baked village cells (the homestead's live group and the Vale workshop's mesh
//                                 for those two). A probe point is a perch when it is a ridge (lower on both sides across,
//                                 level along) or a flat patch (a flat roof, a chimney top, a parapet), high on the building.
//                                 Up to 6 per roof, at least 1.2 m apart, so two birds on one ridge stand 0.6 m apart or more.
//   .spots                        [{x, y, z, facing, ax, az, name, taken, gone}]  y is the roof surface (the bird's feet)
//   .near(x, z, reach, tree)      a free spot within reach (40% of the time when a tree is also free), none in the rain
//   .take(b, spot) / .rise(b)     a bird lands there (wings folded) / leaves (wings spread, spot free)
//   .foot(b)                      metres from the bird's origin down to its feet, for its species
//   .watch(b, i, player)          shortens the rest when you (4.5 m on foot, 6 m riding) or the rain come
//   .idle(b, dt, time)            the visible rest: head turns, a hop along the ridge, a wing shuffle, a tail flick
//   .tick()                       the homestead's roof is read again after a house upgrade; the workshop once it has loaded
// Nothing here allocates per frame. The village is the same with the Pandora box open or shut, and so are the perches.
import * as T from 'three';
import { BLOCKS } from './village-plan.mjs';
import { HOUSES } from './content.mjs';
import { hyp } from './hyp.mjs';

const STEP = .2, BIN = .5, GAP = 1.2, MAX = 6, SKIP = new Set(['pond', 'tractor', 'oven']);
// A resting bird tips its head up a little (forward is +z, so a negative x turn).
const pitchOf = b => b.kind === 'field-gull' ? -.18 : -.3;
const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

/** Triangles (9 floats each, world space) of `meshes` whose centre lies inside one of `boxes` (expanded) and reaches 1.2 m up. */
export function gather(meshes, boxes) {
  const out = boxes.map(() => []), v = new T.Vector3(), p = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (const m of meshes) {
    const pos = m.geometry?.getAttribute('position'); if (!pos) continue; const index = m.geometry.index, n = index ? index.count : pos.count;
    m.updateWorldMatrix(true, false);
    for (let t = 0; t < n; t += 3) {
      let top = -Infinity;
      for (let k = 0; k < 3; k++) { v.fromBufferAttribute(pos, index ? index.getX(t + k) : t + k).applyMatrix4(m.matrixWorld); p[k * 3] = v.x; p[k * 3 + 1] = v.y; p[k * 3 + 2] = v.z; top = Math.max(top, v.y); }
      if (top < 1.2) continue;
      const cx = (p[0] + p[3] + p[6]) / 3, cz = (p[2] + p[5] + p[8]) / 3;
      for (let i = 0; i < boxes.length; i++) { const b = boxes[i]; if (Math.abs(cx - b.x) < b.w / 2 + b.pad && Math.abs(cz - b.z) < b.d / 2 + b.pad) out[i].push(...p); }
    }
  }
  return out;
}

/** The highest surface over (px, pz) among the triangles `list` (indices into `tris`): [y, upness of its normal], or y -Infinity. */
function top(tris, list, px, pz, hit) {
  hit[0] = -Infinity; hit[1] = 0;
  for (const t of list) {
    const o = t * 9, ax = tris[o], ay = tris[o + 1], az = tris[o + 2], bx = tris[o + 3], by = tris[o + 4], bz = tris[o + 5], cx = tris[o + 6], cy = tris[o + 7], cz = tris[o + 8];
    const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (Math.abs(d) < 1e-9) continue;
    const l1 = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / d, l2 = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / d, l3 = 1 - l1 - l2;
    if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
    const y = l1 * ay + l2 * by + l3 * cy; if (y <= hit[0]) continue;
    const ex = bx - ax, ey = by - ay, ez = bz - az, fx = cx - ax, fy = cy - ay, fz = cz - az, nx = ey * fz - ez * fy, ny = ez * fx - ex * fz, nz = ex * fy - ey * fx;
    hit[0] = y; hit[1] = Math.abs(ny) / Math.max(1e-9, Math.sqrt(nx * nx + ny * ny + nz * nz));
  }
  return hit;
}

/** Perch spots on one building box from its triangles: ridges first, then flat patches, highest first, GAP apart, at most MAX. */
export function roofSpots(box, tris) {
  const n = tris.length / 9; if (!n) return [];
  const x0 = box.x - box.w / 2 - box.pad, z0 = box.z - box.d / 2 - box.pad, W = box.w + box.pad * 2, D = box.d + box.pad * 2;
  const gx = Math.ceil(W / BIN), gz = Math.ceil(D / BIN), bins = Array.from({ length: gx * gz }, () => []);
  for (let t = 0; t < n; t++) {
    const o = t * 9, lx = Math.min(tris[o], tris[o + 3], tris[o + 6]), hx = Math.max(tris[o], tris[o + 3], tris[o + 6]), lz = Math.min(tris[o + 2], tris[o + 5], tris[o + 8]), hz = Math.max(tris[o + 2], tris[o + 5], tris[o + 8]);
    for (let i = Math.max(0, Math.floor((lx - x0) / BIN)); i <= Math.min(gx - 1, Math.floor((hx - x0) / BIN)); i++) for (let k = Math.max(0, Math.floor((lz - z0) / BIN)); k <= Math.min(gz - 1, Math.floor((hz - z0) / BIN)); k++) bins[i * gz + k].push(t);
  }
  const nx = Math.floor(W / STEP) + 1, nz = Math.floor(D / STEP) + 1, H = new Float32Array(nx * nz), U = new Float32Array(nx * nz), hit = [0, 0];
  let high = -Infinity;
  for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
    const px = x0 + i * STEP, pz = z0 + k * STEP, bi = Math.min(gx - 1, Math.floor((px - x0) / BIN)), bk = Math.min(gz - 1, Math.floor((pz - z0) / BIN));
    top(tris, bins[bi * gz + bk], px, pz, hit); H[i * nz + k] = hit[0]; U[i * nz + k] = hit[1]; high = Math.max(high, hit[0]);
  }
  const floor = Math.max(1.4, high * .55), h = (i, k) => i < 0 || k < 0 || i >= nx || k >= nz ? -Infinity : H[i * nz + k], level = (a, b) => Math.abs(a - b) < .03, drop = (a, b) => b < a - .03;
  const long = box.w >= box.d, found = [];
  for (let i = 1; i < nx - 1; i++) for (let k = 1; k < nz - 1; k++) {
    const y = h(i, k); if (!(y >= floor)) continue;
    const W1 = h(i - 1, k), E1 = h(i + 1, k), N1 = h(i, k - 1), S1 = h(i, k + 1);
    let ax = 0, az = 0, kind = 0, x = x0 + i * STEP, z = z0 + k * STEP, ty = y;
    const peak = (L1, R1, L2, R2) => y >= L1 && y >= R1 && Math.min(y - L2, y - R2) > .03;
    const along = (A1, B1, A2, B2) => level(y, A1) && level(y, B1) && level(y, A2) && level(y, B2);
    // The apex of a tent between samples, when both sides slope gently (a gable): back to the true ridge line and its height.
    const apex = (L1, R1) => { if (!(y - L1 < .3 && y - R1 < .3)) return 0; const right = R1 >= L1, s = (y - (right ? L1 : R1)) / STEP; if (s < .15) return 0; const d = Math.min(STEP / 2, Math.max(0, ((right ? R1 : L1) - y + s * STEP) / (2 * s))); ty = y + s * d; return right ? d : -d; };
    if (peak(W1, E1, h(i - 2, k), h(i + 2, k)) && along(N1, S1, h(i, k - 2), h(i, k + 2))) { az = 1; kind = 2; x += apex(W1, E1); } // a ridge running north-south
    else if (peak(N1, S1, h(i, k - 2), h(i, k + 2)) && along(W1, E1, h(i - 2, k), h(i + 2, k))) { ax = 1; kind = 2; z += apex(N1, S1); } // a ridge running east-west
    else if (U[i * nz + k] > .9 && level(y, W1) && level(y, E1) && level(y, N1) && level(y, S1) && (long ? level(y, h(i - 2, k)) && level(y, h(i + 2, k)) : level(y, h(i, k - 2)) && level(y, h(i, k + 2)))) { ax = long ? 1 : 0; az = long ? 0 : 1; kind = 1; } // flat
    else if (y >= W1 && y >= E1 && y >= N1 && y >= S1 && y >= Math.max(h(i - 1, k - 1), h(i + 1, k + 1), h(i - 1, k + 1), h(i + 1, k - 1)) && Math.min(y - h(i - 2, k), y - h(i + 2, k), y - h(i, k - 2), y - h(i, k + 2)) > .03) kind = 1; // a summit (a pyramid roof's top, a chimney cap), not a point on a sloping hip
    if (!kind) continue;
    found.push({ x, z, y: ty, ax, az, score: ty * .5 + kind * .6 + hash(i, k) * .1 });
  }
  // Spread them out: each pick is the best mix of height, kind and distance from the picks so far (GAP at least).
  const spots = [];
  while (spots.length < MAX) {
    let best = null, value = -Infinity;
    for (const f of found) { let d = 3; for (const s of spots) d = Math.min(d, hyp(s.x - f.x, s.z - f.z)); if (d < GAP) continue; const v = d + f.score; if (v > value) { value = v; best = f; } }
    if (!best) break;
    const f = best, r = hash(f.x, f.z), across = r < .6, sign = (r * 10 | 0) % 2 ? 1 : -1; // most face across the ridge, looking down off the roof
    const facing = !f.ax && !f.az ? r * Math.PI * 2 : across ? Math.atan2(f.az * sign, -f.ax * sign) : Math.atan2(f.ax * sign, f.az * sign);
    spots.push({ x: f.x, y: f.y, z: f.z, facing, ax: f.ax, az: f.az, name: box.name, taken: false, gone: false });
  }
  return spots;
}

export class RoofPerches {
  constructor(world) {
    this.world = world; this.feet = new Map(); this.homeLevel = world.homeLevel; this.workshop = false;
    const boxes = BLOCKS.filter(b => !SKIP.has(b.name) && !b.name.startsWith('super-')).map(b => ({ ...b, pad: Math.min(1, .15 * Math.max(b.w, b.d)) }));
    this.boxes = boxes; this.lib = { gather, roofSpots }; const cells = []; world.villageCells?.traverse(m => { if (m.isMesh && !m.isInstancedMesh) cells.push(m); });
    const tris = gather(cells, boxes);
    this.spots = [];
    boxes.forEach((b, i) => { if (b.name !== 'homestead' && b.name !== 'workshop') this.spots.push(...roofSpots(b, tris[i])); });
    this.read('homestead'); this.tick();
  }
  /** Reads one live building again (the homestead after an upgrade, the workshop once loaded); birds on its old spots take off. */
  read(name) {
    const box = this.boxes.find(b => b.name === name), source = name === 'homestead' ? HOUSES[0].group : this.world.workshop; if (!box || !source) return;
    for (const s of this.spots) if (s.name === name) s.gone = true;
    this.spots = this.spots.filter(s => s.name !== name || s.taken);
    const meshes = []; source.traverse(m => { if (m.isMesh && !m.isInstancedMesh) meshes.push(m); });
    this.spots.push(...roofSpots(box, gather(meshes, [box])[0]));
  }
  tick() {
    const w = this.world;
    if (w.homeLevel !== this.homeLevel) { this.homeLevel = w.homeLevel; this.read('homestead'); }
    if (!this.workshop && w.workshop) { this.workshop = true; this.read('workshop'); }
  }
  near(x, z, reach, tree) {
    if (this.world.rain?.visible || tree && Math.random() >= .4) return null;
    let count = 0;
    for (const s of this.spots) if (!s.taken && !s.gone && hyp(s.x - x, s.z - z) < reach) count++;
    if (!count) return null;
    let pick = Math.floor(Math.random() * count);
    for (const s of this.spots) if (!s.taken && !s.gone && hyp(s.x - x, s.z - z) < reach && pick-- === 0) return s;
    return null;
  }
  foot(b) {
    let f = this.feet.get(b.kind);
    if (f === undefined) {
      // The lowest point of the resting pose (wings folded, body tipped up), so neither the feet nor the tail sink into the roof.
      const m = b.mesh, order = m.rotation.order, rx = m.rotation.x, ry = m.rotation.y, rz = m.rotation.z, y = m.position.y; m.rotation.set(pitchOf(b), 0, 0, 'YXZ'); m.position.y = 0; this.fold(b, 1, 0);
      m.updateMatrixWorld(true); const box = new T.Box3().setFromObject(m, true); f = Math.max(0, -box.min.y);
      m.rotation.set(rx, ry, rz, order); m.position.y = y; this.fold(b, 0, 0); this.feet.set(b.kind, f);
    }
    return f;
  }
  /** Wings folded by k (1 folded along the back, 0 spread as in flight): rolled on edge, swept back, a little shorter; lift raises them. */
  fold(b, k, lift) {
    const L = b.left, R = b.right, gull = b.kind === 'field-gull', span = 1 - (gull ? .5 : .15) * k, roll = (gull ? .25 : .5) * k, sweep = (gull ? 1.68 : 1.55) * k;
    L.rotation.order = R.rotation.order = 'YZX'; L.rotation.set(roll, -sweep, -lift); R.rotation.set(roll, sweep, lift); L.scale.set(span, 1, 1 - .6 * k); R.scale.copy(L.scale);
  }
  take(b, s) { s.taken = true; b.roof = s; b.tree = null; b.rT = 1 + Math.random() * 2; b.rA = -1; b.rP = 0; b.rYaw = 0; b.rTurn = 0; b.rHop = 0; b.rFrom = 0; b.rTo = 0; b.mesh.rotation.order = 'YXZ'; }
  /** Called when the landing glide ends: the turn from the flight heading to the spot's facing eases out over the first second. */
  settle(b) { const s = b.roof; let d = b.mesh.rotation.y - s.facing; d = Math.atan2(Math.sin(d), Math.cos(d)); b.rYaw = d; b.rTurn = 0; b.mesh.rotation.z = 0; this.fold(b, 1, 0); }
  rise(b) { if (b.roof) b.roof.taken = false; b.roof = null; b.mesh.rotation.x = 0; b.mesh.rotation.order = 'XYZ'; this.fold(b, 0, 0); }
  watch(b, i, player) {
    const s = b.roof, w = this.world, ride = w.riding?.mesh?.position, near = hyp(player.x - s.x, player.z - s.z) < (ride ? 6 : 4.5) || ride && hyp(ride.x - s.x, ride.z - s.z) < 6;
    if (near || w.rain?.visible) b.timer = Math.min(b.timer, .08 + (i % 4) * .12); // a ripple of take-offs, not all at once
  }
  idle(b, dt, time) {
    const s = b.roof, m = b.mesh;
    b.rT -= dt;
    if (b.rA < 0 && b.rT <= 0) { // the next small thing: 0 turn the head, 1 hop along the ridge, 2 shuffle the wings, 3 flick the tail
      const r = Math.random(); b.rA = r < .45 ? 0 : r < .65 ? 1 : r < .85 ? 2 : 3; b.rP = 0;
      if (b.rA === 0) { b.rTurn = (Math.random() - .5) * 1.4; b.rA = -1; }
      if (b.rA === 1) { b.rFrom = b.rHop; b.rTo = b.rHop > .05 ? -.2 : b.rHop < -.05 ? (Math.random() < .5 ? 0 : .2) : (Math.random() < .5 ? -.2 : .2); }
      b.rT = .8 + Math.random() * 2.6;
    }
    let arc = 0, fold = 1, lift = 0, pitch = pitchOf(b) + Math.sin(time * 2.3 + b.phase) * .02;
    if (b.rA >= 1) {
      b.rP += dt / (b.rA === 1 ? .32 : b.rA === 2 ? .7 : .3); const k = Math.min(1, b.rP), bump = Math.sin(k * Math.PI);
      if (b.rA === 1) { b.rHop = b.rFrom + (b.rTo - b.rFrom) * k; arc = bump * .09; fold = 1 - bump * .35; }
      else if (b.rA === 2) { fold = 1 - bump * .6; lift = bump * .3 * Math.abs(Math.sin(k * Math.PI * 3)); }
      else pitch += bump * .14; // the tail flicks up
      if (k >= 1) b.rA = -1;
    }
    b.rYaw += (b.rTurn - b.rYaw) * Math.min(1, dt * 7);
    m.position.set(s.x + s.ax * b.rHop, s.y + this.foot(b) + arc, s.z + s.az * b.rHop);
    m.rotation.set(pitch, s.facing + b.rYaw, 0); this.fold(b, fold, lift);
  }
  /** Birds resting on roofs: [{x, z, spot, feet, visible, hop}] for the browser suites (feet: the bird's lowest point). */
  report(birds) { const out = []; for (const b of birds) if (b.state === 'perch' && b.roof) out.push({ x: b.mesh.position.x, z: b.mesh.position.z, spot: b.roof.y, feet: b.mesh.position.y - this.foot(b), visible: b.mesh.visible, hop: b.rA === 1, name: b.roof.name }); return out; }
}
