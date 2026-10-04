// A small visibility graph routes around village buildings without searching an
// enormous world grid. Long meadow walks therefore cost the same as short ones.
import { CELL, GRID, HALF, GRID_IDS, EDGE_PAD } from './regions.mjs';

// ---- The world's edge, for routes (round 8). The world is thirteen squares of a 5 x 5 grid (regions.mjs); the twelve other cells
// are empty and nobody stands within EDGE_PAD of one. A route treats each empty cell as a box (EDGE_BOX wide), so its corner nodes
// round a notch lie outside the line that blocks, and a tapped end point is first moved to the nearest point that is clear of every
// such box (worldPoint): square corners, unlike regions.mjs inWorld, whose corners are round. A point clear by ROUTE_PAD is outside
// every box findRoute inflates (0.33 m).
export const ROUTE_PAD = EDGE_PAD + 1.3;
export const EDGE_BOX = CELL + 2 * (EDGE_PAD + .5);
const EMPTY = [], SQUARES = [];
for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) {
  const x0 = c * CELL - HALF, z0 = r * CELL - HALF, cell = { x0, z0, x1: x0 + CELL, z1: z0 + CELL, x: x0 + CELL / 2, z: z0 + CELL / 2 };
  if (!GRID_IDS[r][c]) { EMPTY.push(cell); continue; }
  const open = (dr, dc) => !!GRID_IDS[r + dr]?.[c + dc];
  // Which sides face an empty cell or the grid's end, and which corners have only their diagonal cell empty (a notch).
  cell.w = !open(0, -1); cell.e = !open(0, 1); cell.n = !open(-1, 0); cell.s = !open(1, 0);
  cell.nw = !cell.n && !cell.w && !open(-1, -1); cell.ne = !cell.n && !cell.e && !open(-1, 1); cell.sw = !cell.s && !cell.w && !open(1, -1); cell.se = !cell.s && !cell.e && !open(1, 1);
  SQUARES.push(cell);
}
/** The empty cells whose route box touches the rectangle from (ax, az) to (bx, bz) grown by `reach`, as obstacles for findRoute. */
export function edgeObstacles(ax, az, bx, bz, reach = 8, out = []) {
  const x0 = Math.min(ax, bx) - reach, x1 = Math.max(ax, bx) + reach, z0 = Math.min(az, bz) - reach, z1 = Math.max(az, bz) + reach, h = EDGE_BOX / 2;
  for (const c of EMPTY) if (c.x + h > x0 && c.x - h < x1 && c.z + h > z0 && c.z - h < z1) out.push({ x: c.x, z: c.z, w: EDGE_BOX, d: EDGE_BOX });
  return out;
}
/** Clear of every empty cell and of the grid's end by `pad` metres, measured square (a box round each empty cell). */
export function worldClear(x, z, pad = ROUTE_PAD) {
  if (Math.abs(x) > HALF - pad || Math.abs(z) > HALF - pad) return false;
  for (const c of EMPTY) if (x > c.x0 - pad && x < c.x1 + pad && z > c.z0 - pad && z < c.z1 + pad) return false;
  return true;
}
/** The nearest point to (x, z) that is `worldClear` by `pad`: the point itself when it already is. From anywhere, also far outside the world. */
export function worldPoint(x, z, pad = ROUTE_PAD, out = { x: 0, z: 0 }) {
  out.x = x; out.z = z; if (worldClear(x, z, pad)) return out;
  const e = 1e-6; let best = Infinity;
  for (const s of SQUARES) {
    // Into the square, kept `pad` off each side that faces the edge...
    const ax = s.x0 + (s.w ? pad + e : 0), bx = s.x1 - (s.e ? pad + e : 0), az = s.z0 + (s.n ? pad + e : 0), bz = s.z1 - (s.s ? pad + e : 0);
    let px = Math.min(bx, Math.max(ax, x)), pz = Math.min(bz, Math.max(az, z));
    // ...and out of the pad x pad corner whose diagonal cell is empty, by the shorter of the two ways out.
    for (const [on, cx, cz, sx, sz] of [[s.nw, s.x0, s.z0, 1, 1], [s.ne, s.x1, s.z0, -1, 1], [s.sw, s.x0, s.z1, 1, -1], [s.se, s.x1, s.z1, -1, -1]]) {
      if (!on || (px - cx) * sx >= pad + e || (pz - cz) * sz >= pad + e) continue;
      const qx = cx + sx * (pad + e), qz = cz + sz * (pad + e);
      if (Math.hypot(qx - x, pz - z) <= Math.hypot(px - x, qz - z)) px = qx; else pz = qz;
    }
    const d = Math.hypot(px - x, pz - z); if (d < best) { best = d; out.x = px; out.z = pz; }
  }
  return out;
}

export function findRoute(start, end, obstacles, bounds) {
  if (![start.x, start.z, end.x, end.z].every(Number.isFinite)) return [];
  const boxes = obstacles.map(c => ({ minX:c.x-c.w/2-.33, maxX:c.x+c.w/2+.33, minZ:c.z-c.d/2-.33, maxZ:c.z+c.d/2+.33 }));
  const valid = p => Math.abs(p.x) <= bounds.x && Math.abs(p.z) <= bounds.z && !boxes.some(b => p.x>b.minX&&p.x<b.maxX&&p.z>b.minZ&&p.z<b.maxZ);
  if (!valid(end)) return [];
  const clear = (a, b) => !boxes.some(box => {
    let low=0, high=1;
    for (const [key,min,max] of [['x',box.minX,box.maxX],['z',box.minZ,box.maxZ]]) {
      const delta=b[key]-a[key];
      if (Math.abs(delta)<1e-9) { if(a[key]<=min||a[key]>=max) return false; }
      else { const t1=(min-a[key])/delta,t2=(max-a[key])/delta;low=Math.max(low,Math.min(t1,t2));high=Math.min(high,Math.max(t1,t2));if(high<=low)return false; }
    }
    return high>0&&low<1;
  });
  if (clear(start,end)) return [{...end}];
  const nodes=[{...start},{...end}];
  for (const b of boxes) for (const x of [b.minX-.4,b.maxX+.4]) for (const z of [b.minZ-.4,b.maxZ+.4]) if(valid({x,z}))nodes.push({x,z});
  const costs=Array(nodes.length).fill(Infinity),previous=Array(nodes.length).fill(-1),closed=new Set();costs[0]=0;
  for(let iteration=0;iteration<nodes.length;iteration++) {
    let current=-1,score=Infinity;
    for(let i=0;i<nodes.length;i++)if(!closed.has(i)&&costs[i]<Infinity){const estimate=costs[i]+Math.hypot(nodes[i].x-end.x,nodes[i].z-end.z);if(estimate<score){score=estimate;current=i;}}
    if(current<0)return [];
    if(current===1){const route=[];for(let i=1;i!==0;i=previous[i])route.unshift(nodes[i]);return route;}
    closed.add(current);
    for(let i=1;i<nodes.length;i++){if(closed.has(i)||i===current)continue;const distance=Math.hypot(nodes[i].x-nodes[current].x,nodes[i].z-nodes[current].z),next=costs[current]+distance;if(next<costs[i]&&clear(nodes[current],nodes[i])){costs[i]=next;previous[i]=current;}}
  }
  return [];
}
