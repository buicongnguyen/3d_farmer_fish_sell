import { hyp } from './hyp.mjs';
import { PEN, PEN_PROPS, roamRadius, walkTo, startRest, pickGoal, spotNear, stepRoamer, callToTrough } from './pen-roam.mjs';
import { ROADS, POND, PARKING, BED_POSITIONS, ORCHARD_POSITIONS } from './content.mjs';
import { BLOCKS, villageTrees } from './village-plan.mjs';
import { LANES_GRAVEL, LOTS } from './lots.mjs';
import { SAFE } from './ward.mjs';
// Where the pen animals may roam by day (round 10): a rectangle three times the pen's width and depth (nine times its
// area) centred on it, less everything an animal must not stand on or beside. Pure (no three.js): node walks animals over
// it for simulated days in the tests. Loaded after the first frame (it is not in the first-load bundle).
//
// The region is a grid of 25 cm cells made once, from the same plans the villagers' lanes and the colliders come from
// (BLOCKS, villageTrees, ROADS, the pond, the beds, the gravel), and from whatever else the world adds at start (colliders, tap
// spots, parked vehicles: `extra`). A cell is cut when it lies within a margin of a cut-out; what is left and can be walked to
// from the pen's gate is the range. For every cell the grid also keeps its clearance (distance to the nearest cut cell), so
// "a body of radius r may stand here" is one lookup, and the way back to the pen from anywhere (a flow field per body size).
//
// The cut-outs, in the order they are counted: the ward (outside SAFE), the roads (asphalt, 1.5 m margin), the gravel lanes and
// paths (1 m: the farm track, the front lane, the north lane, the West Lane, the lots' paths), the pond (2.5 m), buildings and big props
// (1 m), the fence (not at the gate), trees (0.8 m), the beds, the orchard, parked vehicles, hay rolls and other loose props, doorsteps, then
// what cannot be reached from the gate any more. The lanes the villagers walk over grass (villagers.mjs LANES) are not cut:
// animals give way to the walker instead (pen-roam flee rule), the same as to you.
export const CELL = .25, FACTOR = 3, RMIN = .5;
const CATS = ['ward', 'road', 'lane', 'pond', 'building', 'fence', 'tree', 'bed', 'orchard', 'vehicle', 'prop', 'door', 'extra', 'unreachable'];
const R = ROADS, SIDE = 2.5;
/** What is cut, from the plans alone: rects {cat, x, z, w, d, m} and circles {cat, x, z, r, m} (m: the margin kept clear round it). */
export function staticCuts() {
  const rects = [], circles = [], rect = (cat, x, z, w, d, m) => rects.push({ cat, x, z, w, d, m }), circle = (cat, x, z, r, m) => circles.push({ cat, x, z, r, m });
  // asphalt: the ring road, the east spur, the supermarket's parking
  rect('road', 0, R.north, R.east * 2 + SIDE * 2, 5, 1.5); rect('road', 0, R.south, R.east * 2 + SIDE * 2, 5, 1.5);
  rect('road', R.west, (R.north + R.south) / 2, 5, R.south - R.north, 1.5); rect('road', R.east, (R.north + R.south) / 2, 5, R.south - R.north, 1.5); rect('road', R.east + 8, 0, 11, 5, 1.5);
  rect('road', (PARKING.x0 + PARKING.x1) / 2, (PARKING.z0 + R.north - 2.5) / 2, PARKING.x1 - PARKING.x0, R.north - 2.5 - PARKING.z0, 1.5);
  // gravel (world.mjs buildVillage): the front lane, the farm track, the pond lane, the north lane; the West Lane, the Field Lane and each lot's paths
  rect('lane', 0, (-10 + R.south) / 2, 3.4, R.south + 10, .8); rect('lane', 10, -11.5, 18, 2.6, .8); rect('lane', 6, 12.2, 10, 2.4, .8); rect('lane', 0, (R.north - 17.5) / 2, 2.6, -R.north - 17.5, .8);
  for (const p of LANES_GRAVEL) rect('lane', p.x, p.z, p.w, p.d, .8);
  for (const lot of LOTS) for (const p of lot.paths) rect('lane', p.x, p.z, p.w, p.d, .8);
  rect('pond', POND.x, POND.z, POND.w, POND.d, 2.5);
  for (const b of BLOCKS) if (b.name !== 'pond') rect('building', b.x, b.z, b.w, b.d, .7);
  rect('building', 0, -6.4, 12, .3, .8); // the homestead's picket fence
  for (const t of villageTrees()) if (!t.gone) circle('tree', t.x, t.z, .42 * t.s, .8);
  for (const b of BED_POSITIONS) rect('bed', b.x, b.z, 2.1, 2.2, 1);
  for (const o of ORCHARD_POSITIONS) circle('orchard', o.x, o.z, 1.3, 1);
  rect('vehicle', 46, -15, 2.4, 4.8, 1); rect('vehicle', 5, -8, 2.8, 1.2, 1);               // the jeep, the motorcycle (world.mjs PARK)
  for (const [x, z] of [[33.5, -14], [34.5, -11.6], [36.4, -13.4]]) circle('prop', x, z, 1.3, 1); // the hay rolls beside the barn
  rect('door', 0, -10.6, 3.6, 3, 0); rect('door', 28.4, -14.4, 5, 2.6, .4);                // the homestead's doorstep, the Moss barn's
  return { rects, circles };
}
/** The pen's own fence as cut rects: the four sides 0.6 m thick, the south side open at the gate. */
export function fenceCuts(pen = PEN) {
  const t = .3, w = pen.x1 - pen.x0, d = pen.z1 - pen.z0, [g0, g1] = pen.gate, mid = (a, b) => (a + b) / 2, r = (x0, x1, z0, z1) => ({ cat: 'fence', x: mid(x0, x1), z: mid(z0, z1), w: x1 - x0, d: z1 - z0, m: 0 });
  return { rects: [r(pen.x0 - t, pen.x1 + t, pen.z0 - t, pen.z0 + t), r(pen.x0 - t, pen.x0 + t, pen.z0, pen.z1), r(pen.x1 - t, pen.x1 + t, pen.z0, pen.z1), r(pen.x0 - t, g0, pen.z1 - t, pen.z1 + t), r(g1, pen.x1 + t, pen.z1 - t, pen.z1 + t)], circles: [], w, d };
}

export class PenRange {
  /** @param o {pen, props, factor, extra: {rects, circles}} */
  constructor(o = {}) {
    const pen = this.pen = o.pen ?? PEN, props = this.props = o.props ?? PEN_PROPS, f = o.factor ?? FACTOR, cell = this.cell = o.cell ?? CELL;
    const cx = (pen.x0 + pen.x1) / 2, cz = (pen.z0 + pen.z1) / 2, hw = (pen.x1 - pen.x0) * f / 2, hd = (pen.z1 - pen.z0) * f / 2;
    this.rect = { x0: cx - hw, x1: cx + hw, z0: cz - hd, z1: cz + hd };
    const W = this.W = Math.ceil((hw * 2) / cell), H = this.H = Math.ceil((hd * 2) / cell), N = W * H, ox = this.ox = this.rect.x0, oz = this.oz = this.rect.z0;
    this.gateOpen = true; this.confine = false; this.byCat = {}; this.cutCats = new Uint8Array(N); // 0 = valid, else 1 + index in CATS
    const st = staticCuts(), fe = fenceCuts(pen), rects = [...st.rects, ...fe.rects, ...(o.extra?.rects ?? [])], circles = [...st.circles, ...(o.extra?.circles ?? []), ...props.map(p => ({ cat: 'fence', x: p.x, z: p.z, r: p.r, m: 0 }))];
    this.sources = { rects, circles };
    const cut = this.cutCats, mark = (cat, i) => { if (!cut[i]) { cut[i] = 1 + CATS.indexOf(cat); this.byCat[cat] = (this.byCat[cat] ?? 0) + 1; } };
    // the cut-outs are applied one category at a time, in CATS order, so each cell is credited to the first category that cuts it
    for (const cat of CATS) {
      if (cat === 'ward') { for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const x = ox + (i + .5) * cell, z = oz + (j + .5) * cell; if (x < SAFE.x0 || x > SAFE.x1 || z < SAFE.z0 || z > SAFE.z1) mark('ward', j * W + i); } continue; }
      for (const s of rects) if (s.cat === cat) {
        const e = s.m, i0 = Math.max(0, Math.floor((s.x - s.w / 2 - e - ox) / cell)), i1 = Math.min(W - 1, Math.floor((s.x + s.w / 2 + e - ox) / cell)), j0 = Math.max(0, Math.floor((s.z - s.d / 2 - e - oz) / cell)), j1 = Math.min(H - 1, Math.floor((s.z + s.d / 2 + e - oz) / cell));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const x = ox + (i + .5) * cell, z = oz + (j + .5) * cell; if (hyp(Math.max(0, Math.abs(x - s.x) - s.w / 2), Math.max(0, Math.abs(z - s.z) - s.d / 2)) < e || (e === 0 && Math.abs(x - s.x) < s.w / 2 && Math.abs(z - s.z) < s.d / 2)) mark(cat, j * W + i); }
      }
      for (const s of circles) if (s.cat === cat) {
        const e = s.r + s.m, i0 = Math.max(0, Math.floor((s.x - e - ox) / cell)), i1 = Math.min(W - 1, Math.floor((s.x + e - ox) / cell)), j0 = Math.max(0, Math.floor((s.z - e - oz) / cell)), j1 = Math.min(H - 1, Math.floor((s.z + e - oz) / cell));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (hyp(ox + (i + .5) * cell - s.x, oz + (j + .5) * cell - s.z) < e) mark(cat, j * W + i);
      }
    }
    // The range is the ground the smallest animal (a hen, 0.3 m round) can stand on and walk to from the pen through the gate: flood fill (4 neighbours) over the cells with that much room.
    // What is left over (a pocket behind the barn, a sliver beside a wall) is cut too, as 'unreachable'. The room itself (clearance) stays what the cut-outs leave, for the bigger animals.
    const free = new Uint8Array(N); for (let k = 0; k < N; k++) free[k] = cut[k] ? 0 : 1;
    this.clear = edt(free, W, H, cell);
    const seed = this.cellOf((pen.x0 + pen.x1) / 2, pen.z1 - 2), seen = new Uint8Array(N), stack = [seed]; seen[seed] = 1;
    if (!cut[seed]) while (stack.length) {
      const c = stack.pop(), i = c % W, j = (c - i) / W;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= W || b >= H) continue; const k = b * W + a; if (!seen[k] && !cut[k] && this.clear[k] >= RMIN) { seen[k] = 1; stack.push(k); } }
    }
    for (let k = 0; k < N; k++) if (!cut[k] && !seen[k]) mark('unreachable', k);
    this.valid = seen; let n = 0; for (let k = 0; k < N; k++) if (seen[k]) n++;
    this.cells = n; this.fields = new Map(); this.pick = (a, b, c, d) => pickOut(a, b, c, d);
  }
  cellOf(x, z) { const i = Math.floor((x - this.ox) / this.cell), j = Math.floor((z - this.oz) / this.cell); return i < 0 || j < 0 || i >= this.W || j >= this.H ? -1 : j * this.W + i; }
  /** True where an animal may be (a valid cell, reachable from the gate). */
  isInRange(x, z) { const k = this.cellOf(x, z); return k >= 0 && this.valid[k] === 1; }
  /** Metres from (x, z) to the nearest cut cell's edge (0 outside the range). */
  clearance(x, z) { const k = this.cellOf(x, z); return k < 0 ? 0 : this.clear[k]; }
  /** Usable area in square metres, and as a multiple of the pen's. */
  area() { return this.cells * this.cell * this.cell; }
  penArea() { return (this.pen.x1 - this.pen.x0) * (this.pen.z1 - this.pen.z0); }
  /** Square metres each cut-out took (counted once, in CATS order) and what stays. */
  report() { const c = this.cell * this.cell, cut = {}; for (const k of CATS) if (this.byCat[k]) cut[k] = +(this.byCat[k] * c).toFixed(1); return { total: +(this.W * this.H * c).toFixed(1), usable: +this.area().toFixed(1), pen: +this.penArea().toFixed(1), times: +(this.area() / this.penArea()).toFixed(2), cut }; }
  inPen(x, z, m = 0) { const p = this.pen; return x > p.x0 + m && x < p.x1 - m && z > p.z0 + m && z < p.z1 - m; }
  /** True where a body of radius r would touch a cut-out, the range's edge, or (gate shut) the gate's bars. */
  blocked(x, z, r) {
    const k = this.cellOf(x, z); if (k < 0 || !this.valid[k] || this.clear[k] < r) return true;
    if (this.confine && !(x > this.pen.x0 && x < this.pen.x1 && z > this.pen.z0 && z < this.pen.z1)) return true; // an animal in the yard stays in it until it sets out
    if (!this.gateOpen) { const p = this.pen, g = p.gate; if (hyp(Math.max(0, g[0] - x, x - g[1]), z - p.z1) < r + .3) return true; }
    return false;
  }
  /** The pen's gate: its middle, a point just inside it and one just outside. */
  gatePoints() { const p = this.pen, x = (p.gate[0] + p.gate[1]) / 2; return { x, inside: { x, z: p.z1 - 1.6 }, outside: { x, z: p.z1 + 1.3 } }; }
  /** The cells a body of radius r can stand on (clearance at least r). */
  standable(k, r) { return this.valid[k] === 1 && this.clear[k] >= r; }
  /** Metres to the pen along the walkable cells for a body of radius r (0 inside the yard, Infinity where it cannot get back): a flow field, made once per radius. */
  field(r) {
    const key = r.toFixed(2); let f = this.fields.get(key); if (f) return f;
    const { W, H, cell } = this, N = W * H; f = new Float64Array(N).fill(Infinity);
    const heap = [], push = (d, k) => { heap.push([d, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } }, pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let m = i; const a = 2 * i + 1, b = a + 1; if (a < heap.length && heap[a][0] < heap[m][0]) m = a; if (b < heap.length && heap[b][0] < heap[m][0]) m = b; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const k = j * W + i; if (this.standable(k, r) && this.inPen(this.ox + (i + .5) * cell, this.oz + (j + .5) * cell)) { f[k] = 0; push(0, k); } }
    const DI = [1, -1, 0, 0, 1, 1, -1, -1], DJ = [0, 0, 1, -1, 1, -1, 1, -1];
    while (heap.length) {
      const [d, k] = pop(); if (d > f[k]) continue; const i = k % W, j = (k - i) / W;
      for (let n = 0; n < 8; n++) {
        const a = i + DI[n], b = j + DJ[n]; if (a < 0 || b < 0 || a >= W || b >= H) continue; const q = b * W + a; if (!this.standable(q, r)) continue;
        if (n >= 4 && (!this.standable(j * W + a, r) || !this.standable(b * W + i, r))) continue;
        const nd = d + (n < 4 ? cell : cell * 1.4142); if (nd < f[q]) { f[q] = nd; push(nd, q); }
      }
    }
    this.fields.set(key, f); return f;
  }
  /** Walking distance to the pen from (x, z) for radius r. */
  homeDistance(x, z, r) { const k = this.cellOf(x, z); return k < 0 ? Infinity : this.field(r)[k]; }
  /** The point `look` cells down the flow field from (x, z): where to walk to get closer to the pen. False when there is no way. */
  descend(x, z, r, out, look = 8) {
    const f = this.field(r), { W, H, cell } = this; let k = this.cellOf(x, z); if (k < 0 || !isFinite(f[k])) return false;
    for (let s = 0; s < look && f[k] > 0; s++) {
      const i = k % W, j = (k - i) / W; let best = k;
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { const a = i + di, b = j + dj; if ((!di && !dj) || a < 0 || b < 0 || a >= W || b >= H) continue; const q = b * W + a; if (f[q] < f[best] || (f[q] === f[best] && q < best && f[q] < f[k])) best = q; }
      if (best === k) break; k = best;
    }
    const i = k % W; out.x = this.ox + (i + .5) * cell; out.z = this.oz + ((k - i) / W + .5) * cell; return true;
  }
  /** A way out from the gate to (x, z): points the animal walks through in order, or null when there is none. Made by walking the flow field down from the goal. */
  routeTo(x, z, r) {
    const f = this.field(r); let k = this.cellOf(x, z); if (k < 0 || !isFinite(f[k])) return null;
    const { W, H, cell } = this, back = [], at = { x, z };
    for (let s = 0; s < 4000 && f[k] > 0; s++) {
      const i = k % W, j = (k - i) / W; let best = k;
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { const a = i + di, b = j + dj; if ((!di && !dj) || a < 0 || b < 0 || a >= W || b >= H) continue; const q = b * W + a; if (f[q] < f[best]) best = q; }
      if (best === k) return null; k = best; if (s % 6 === 0) back.push({ x: this.ox + (best % W + .5) * cell, z: this.oz + (Math.floor(best / W) + .5) * cell });
    }
    back.reverse(); const g = this.gatePoints(); return [g.inside, g.outside, ...back.filter(p => !this.inPen(p.x, p.z, -.5) && hyp(p.x - g.outside.x, p.z - g.outside.z) > 1.2), at];
  }
  /** True when the straight line from (ax, az) to (bx, bz) crosses only valid cells (every 10 cm). */
  lineValid(ax, az, bx, bz) { const n = Math.max(1, Math.ceil(hyp(bx - ax, bz - az) / .1)); for (let i = 1; i <= n; i++) { const k = this.cellOf(ax + (bx - ax) * i / n, az + (bz - az) * i / n); if (k < 0 || !this.valid[k]) return false; } return true; }
  /** The nearest cell a body of radius r may stand on and walk home from, within 8 m and in a straight line over valid ground (never across the fence); false when none. */
  nearestFree(x, z, r, out, penOnly = false) {
    const f = this.field(r), ci = Math.floor((x - this.ox) / this.cell), cj = Math.floor((z - this.oz) / this.cell), rad = Math.ceil(8 / this.cell), cell = this.cell;
    let best = Infinity, bi = 0, bj = 0;
    for (let ring = 0; ring <= rad && best === Infinity; ring++) {
      for (let dj = -ring; dj <= ring; dj++) for (let di = -ring; di <= ring; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== ring) continue; const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= this.W || j >= this.H) continue;
        const k = j * this.W + i; if (!isFinite(f[k]) || this.clear[k] < r) continue; const d = di * di + dj * dj; if (d >= best || (penOnly && !this.inPen(this.ox + (i + .5) * cell, this.oz + (j + .5) * cell, r))) continue;
        if (this.lineValid(x, z, this.ox + (i + .5) * cell, this.oz + (j + .5) * cell)) { best = d; bi = i; bj = j; }
      }
    }
    if (best === Infinity) return false; out.x = this.ox + (bi + .5) * cell; out.z = this.oz + (bj + .5) * cell; return true;
  }
  /** A random standable cell some animal of radius r can also walk home from. */
  randomSpot(rng, r, out, tries = 40) { for (let t = 0; t < tries; t++) { const x = this.rect.x0 + rng() * (this.rect.x1 - this.rect.x0), z = this.rect.z0 + rng() * (this.rect.z1 - this.rect.z0), k = this.cellOf(x, z); if (k >= 0 && this.clear[k] >= r + .25 && isFinite(this.field(r)[k]) && !this.inPen(x, z)) { out.x = x; out.z = z; return true; } } return false; }
  /** Grid cells' centres as a list of points every `step` metres, for the tests. */
  samples(step = 1) { const out = []; for (let z = this.rect.z0; z < this.rect.z1; z += step) for (let x = this.rect.x0; x < this.rect.x1; x += step) if (this.isInRange(x, z)) out.push({ x, z }); return out; }
  /** Connected pieces of the range (4 neighbours); after the flood fill from the gate there is one. */
  pieces() {
    const { W, H } = this, seen = new Uint8Array(W * H); let count = 0;
    for (let s = 0; s < W * H; s++) { if (!this.valid[s] || seen[s]) continue; count++; const stack = [s]; seen[s] = 1; while (stack.length) { const c = stack.pop(), i = c % W, j = (c - i) / W; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= W || b >= H) continue; const k = b * W + a; if (this.valid[k] && !seen[k]) { seen[k] = 1; stack.push(k); } } } }
    return count;
  }
  /** Gate and yard, for the roam: the gate is shut at night. */
  setGate(open) { this.gateOpen = open; }
}

/** Euclidean distance (metres, less half a cell) from each valid cell to the nearest cut one (Felzenszwalb and Huttenlocher's transform). */
function edt(valid, W, H, cell) {
  const INF = 1e12, f = new Float64Array(Math.max(W, H)), d = new Float64Array(Math.max(W, H)), v = new Int32Array(Math.max(W, H)), z = new Float64Array(Math.max(W, H) + 1), g = new Float64Array(W * H);
  for (let k = 0; k < W * H; k++) g[k] = valid[k] ? INF : 0;
  const pass = (n, get, put) => {
    for (let q = 0; q < n; q++) f[q] = get(q);
    let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < n; q++) { let s; for (;;) { s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); if (s > z[k] || k === 0) break; k--; } if (s <= z[k]) { v[k] = q; z[k] = -INF; z[k + 1] = INF; } else { k++; v[k] = q; z[k] = s; z[k + 1] = INF; } }
    k = 0; for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; put(q, d[q]); }
  };
  for (let i = 0; i < W; i++) pass(H, q => g[q * W + i], (q, val) => { g[q * W + i] = val; });
  for (let j = 0; j < H; j++) pass(W, q => g[j * W + q], (q, val) => { g[j * W + q] = val; });
  const out = new Float32Array(W * H); for (let k = 0; k < W * H; k++) out[k] = valid[k] ? Math.max(0, Math.sqrt(g[k]) * cell - cell / 2) : 0;
  return out;
}

// ---------------------------------------------------------------- the day: out through the gate, over the range, home at night
/** The pen's hours: the gate opens at `out`, everyone is called home from `home`; each animal keeps a few minutes' difference of its own. */
export const DAY = { out: 7.5, home: 18.1, spread: .5 };
/** Whether the animal should be out of the pen at this hour (0 to 24). */
export const wantsOut = (w, hour) => hour >= DAY.out + (w.uid % 5) * DAY.spread / 5 && hour < DAY.home + (w.uid % 3) * DAY.spread / 3;
/** The gate is open from the first leaving until the last one is back. */
export const gateOpenAt = (hour, anyOutside) => (hour >= DAY.out && hour < DAY.home + DAY.spread) || anyOutside;
/** Shuts or opens the gate: open by day, and always while someone is outside or within 2.2 m of it, so no one is ever caught in the doorway. */
export function updateGate(range, all, hour) {
  let busy = false; const g = range.gatePoints();
  for (let i = 0; i < all.length && !busy; i++) { const w = all[i]; busy = !w.hidden && (w.mode !== 'in' || hyp(w.x - g.x, w.z - range.pen.z1) < 2.2); }
  range.setGate(gateOpenAt(hour, busy)); return busy;
}
const SCRATCH = { x: 0, z: 0 }, KINDS = { cow: [1.5, 7], pig: [1.5, 6], chicken: [1, 6], duck: [1.5, 8] };
/** A new animal's range state: where it is (`in` the yard, `out` roaming, `home` on its way back). */
export function startOut(w, range, rng, hour) {
  w.mode = range.inPen(w.x, w.z) ? 'in' : 'out'; w.route = null; w.patchT = 0; w.patchX = w.x; w.patchZ = w.z; w.leaveT = 4 + rng() * 50; w.stuckT = 0; w.rescues = 0; w.px0 = w.x; w.pz0 = w.z; w.pt = 0; w.fedCall = 0; w.homeT = 0;
  if (w.mode === 'in' && wantsOut(w, hour) && rng() < .7 && !w.hidden) { const spot = { x: 0, z: 0 }; if (range.randomSpot(rng, roamRadius(w), spot, 80) && range.homeDistance(spot.x, spot.z, roamRadius(w)) < 80) { w.x = spot.x; w.z = spot.z; w.goalX = w.x; w.goalZ = w.z; w.mode = 'out'; w.patchX = w.x; w.patchZ = w.z; w.patchT = 300 + rng() * 600; } }
}
/** A patch of ground an animal likes today: ducks the south side towards the water, hens the near ground, cows and pigs anywhere. */
function newPatch(w, range, rng) {
  const r = roamRadius(w), spot = SCRATCH; let bx = w.x, bz = w.z, best = -Infinity;
  for (let i = 0; i < 8; i++) {
    if (!range.randomSpot(rng, r, spot)) continue;
    const near = range.homeDistance(spot.x, spot.z, r), score = w.kind === 'duck' ? spot.z * .5 - near * .02 : w.kind === 'chicken' ? -near * (.5 + rng()) : rng() * 20 - (w.kind === 'pig' ? near * .2 : 0);
    if (score > best) { best = score; bx = spot.x; bz = spot.z; }
  }
  w.patchX = bx; w.patchZ = bz; w.patchT = 420 + rng() * 900;
}
/** The roam's goal picker: short hops (long ones now and then) that lean towards the animal's patch. */
function pickOut(w, all, range, rng) {
  if (w.mode !== 'out') return pickGoal(w, all, range, rng);
  const [d0, d1] = KINDS[w.kind] ?? KINDS.chicken, far = rng() < .3; let best = null, score = Infinity;
  for (let i = 0; i < 4; i++) {
    const g = spotNear(range, rng, w, all, w.x, w.z, far ? d1 : d0, far ? d1 + 6 : d1, 6); if (!g) continue;
    const s = hyp(g.x - w.patchX, g.z - w.patchZ) * (w.patchT > 0 ? 1 : .2) + rng() * 4; if (s < score) { score = s; best = g; }
  }
  if (!best) { startRest(w, rng); w.restT = Math.min(w.restT, 2); return; }
  walkTo(w, best.x, best.z);
}
/** Starts a walk to the pen's trough for animals that were called to eat while out (they stay a while, then go back out). */
export function callOne(w, all, range, rng, trough = PEN_PROPS[2]) { callToTrough(all, range, rng, trough, o => o !== w); w.fedCall = 0; w.leaveT = 20 + rng() * 40; }
/** Feeding time: the animals in the yard walk to the trough, the ones roaming are called and come back to it. */
export function callFed(all, range, rng) {
  for (const w of all) if (!w.hidden && w.mode === 'out') w.fedCall = 1;
  callToTrough(all, range, rng, PEN_PROPS[2], w => w.mode !== 'in');
  for (const w of all) if (w.mode === 'in') w.leaveT = Math.max(w.leaveT, 15 + rng() * 35);
}
/**
 * One step of one animal (use instead of stepRoamer): decides in / out / home from the hour, walks the route through the
 * gate, keeps it in the range, and lets stepRoamer do the walking, resting, flee and personal space.
 * `people` are {x, z, shy?} whom the animal steps away from; `hour` is the game clock.
 */
export function stepOut(w, all, range, rng, dt, people, hour, clock = 1) {
  const r = roamRadius(w); if (w.mode === undefined) startOut(w, range, rng, hour);
  w.leaveT -= dt * clock; w.patchT -= dt; if (w.ghost > 0) w.ghost -= dt; w.rush = w.mode === 'home' || w.route != null;
  const want = wantsOut(w, hour), inPen = range.inPen(w.x, w.z);
  if (w.mode === 'in') {
    if (want && w.leaveT <= 0 && range.gateOpen && isFinite(range.homeDistance(w.x, w.z, r))) {
      newPatch(w, range, rng); w.route = range.routeTo(w.patchX, w.patchZ, r); if (w.route) { w.mode = 'out'; w.route = w.route.slice(); w.flee = 0; const p = w.route.shift(); walkTo(w, p.x, p.z); w.walkT = 30; }
      else w.leaveT = 20;
    }
  } else if (w.mode === 'out' && (!want || w.fedCall)) { w.mode = 'home'; w.route = null; w.homeT = 0; }
  else if (w.mode === 'home' && inPen) { w.mode = 'in'; w.leaveT = Math.max(w.leaveT, 4 + rng() * 40); if (w.fedCall) callOne(w, all, range, rng); }
  range.confine = w.mode === 'in'; stepRoamer(w, all, range, rng, dt, people); range.confine = false;
  if (w.mode === 'out' && w.patchT <= 0 && !w.route) newPatch(w, range, rng);
  // routes and the way home: the next point when the last walk is over
  if (!w.walking && w.mode === 'home') { if (range.descend(w.x, w.z, r, SCRATCH, 4)) { walkTo(w, SCRATCH.x, SCRATCH.z); w.walkT = 20; w.flee = 0; } else if (!inPen && range.nearestFree(w.x, w.z, r, SCRATCH)) { walkTo(w, SCRATCH.x, SCRATCH.z); w.walkT = 10; } }
  else if (!w.walking && w.route?.length) { const p = w.route.shift(); walkTo(w, p.x, p.z); w.walkT = 20; if (!w.route.length) w.route = null; }
  if (w.mode === 'home') { w.homeT += dt; }
  // a body pushed into a cut cell, or never let out: back to the nearest free ground
  if ((range.blocked(w.x, w.z, r * .9) || !isFinite(range.homeDistance(w.x, w.z, r))) && range.nearestFree(w.x, w.z, r, SCRATCH, w.mode === 'in')) { const d = hyp(SCRATCH.x - w.x, SCRATCH.z - w.z), k = Math.min(1, dt * 2.5 / Math.max(d, 1e-3)); w.x += (SCRATCH.x - w.x) * k; w.z += (SCRATCH.z - w.z) * k; w.rescues++; }
  // progress watch: a walk that gains nothing for long is dropped (and the animal goes home to start over)
  w.pt += dt; if (w.pt >= 1) { const moved = hyp(w.x - w.px0, w.z - w.pz0); w.px0 = w.x; w.pz0 = w.z; w.pt = 0; if (w.walking && moved < .05) w.stuckT += 1; else w.stuckT = Math.max(0, w.stuckT - 2); }
  if (w.stuckT > 12) { w.ghost = 8; }
  if (w.stuckT > 20) { w.stuckT = 0; w.route = null; if (w.mode === 'out') { w.mode = 'home'; w.leaveT = 40; } startRest(w, rng); w.restT = 1; }
}
/** The people animals step away from: your position (a vehicle widens it), then the villagers on the lanes. Fills the list in place. */
export function fillPeople(list, player, riding, npcs) {
  let n = 0; const put = (x, z, shy) => { const o = list[n] ?? (list[n] = { x: 0, z: 0, shy: 0 }); o.x = x; o.z = z; o.shy = shy; n++; };
  put(player.x, player.z, riding ? 2.5 : 0);
  for (let i = 0; i < npcs.length; i++) { const m = npcs[i].mesh; if (m?.visible && !npcs[i].inside) put(m.position.x, m.position.z, -.4); }
  list.length = n; return list;
}

// ---------------------------------------------------------------- the pen view's side of it (kept here so it is not in the first-load bundle)
/** Makes the range from the plans and what the world holds (colliders, tap spots, parked vehicles), puts the animals on it, and gives every animal a tap target that follows it. */
export function attachRange(view, mod) {
  const w = view.world, rects = [], circles = [], skip = new Set(['person', 'feed', 'collect', 'chop', 'spot', 'fish', 'dismount']);
  for (const c of w.colliders) if (c.location === 'village') rects.push({ cat: 'extra', x: c.x, z: c.z, w: c.w, d: c.d, m: .7 });
  for (const t of w.targets) if (t.location === 'village' && !skip.has(t.type)) circles.push({ cat: 'extra', x: t.x, z: t.z, r: .8, m: .4 });
  for (const v of w.vehicles) rects.push({ cat: 'vehicle', x: v.mesh.position.x, z: v.mesh.position.z, w: 2.4, d: 4.8, m: 1 });
  const range = new PenRange({ extra: { rects, circles } }), hour = view.state().time ?? 12;
  for (const a of view.animals) startOut(a.walker, range, view.rng, hour);
  // Every animal is a tap target that follows it (a tap feeds, or collects once fed): it works wherever the animal has wandered.
  for (const a of view.animals) { const spot = w.target('feed', 'animal-' + a.walker.uid, 'Feed the ' + a.spec.kind, a.walker.x, a.walker.z, 2.3); spot.hit.scale.set(.55, 1, .55); spot.location = 'hidden'; view.spots.push({ a, spot }); }
  const r = range.rect, mesh = view.mesh; mesh.boundingSphere.center.set((r.x0 + r.x1) / 2, 1, (r.z0 + r.z1) / 2); mesh.boundingSphere.radius = hyp(r.x1 - r.x0, r.z1 - r.z0) / 2 + 2;
  mesh.boundingBox.min.set(r.x0 - 1, 0, r.z0 - 1); mesh.boundingBox.max.set(r.x1 + 1, 3, r.z1 + 1);
  view.range = range; view.area = range; view.mod = mod;
}
/** One frame of the pen's day: the people to keep clear of, each shown animal's step (thinned when the governor is down and the animal is far), the gate, the tap targets. */
export function tickRoam(view, dt, s, p) {
  const w = view.world, hour = s.time ?? 12, thin = (w.step ?? 0) >= 2; view.frame++;
  fillPeople(view.people, p, !!w.riding, w.npcs); let out = false;
  for (let i = 0; i < view.animals.length; i++) {
    const a = view.animals[i]; if (!a.shown) continue; const k = a.walker; if (k.mode !== 'in') out = true;
    // the governor's steps thin the far ones: past 35 m an animal is stepped every other frame, twice as long
    const far = thin && hyp(k.x - w.follow.x, k.z - w.follow.z) > 35; if (far && ((view.frame + i) & 1)) continue;
    stepOut(k, view.walkers, view.range, view.rng, far ? dt * 2 : dt, view.people, hour, s.settings?.test ? s.settings.speed : 1);
  }
  view.anyOut = out; updateGate(view.range, view.walkers, hour);
  const fed = s.fedDay === s.day;
  for (const { a, spot } of view.spots) {
    const k = a.walker; spot.location = a.shown ? 'village' : 'hidden'; spot.x = k.x; spot.z = k.z; spot.hit.position.set(k.x, 1.1, k.z);
    spot.type = fed ? 'collect' : 'feed'; spot.label = (fed ? 'Collect from the ' : 'Feed the ') + a.spec.kind;
  }
}
