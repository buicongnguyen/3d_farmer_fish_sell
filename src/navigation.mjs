// A small visibility graph routes around village buildings without searching an
// enormous world grid. Long meadow walks therefore cost the same as short ones.
import { RING, EDGE_PAD } from './regions.mjs';
import { hyp } from './hyp.mjs';

// ---- The world's edge (round 9). The world is a disc of radius R2 (regions.mjs): it is convex, so a straight leg between two points
// inside it never leaves it and a route needs no obstacles for the edge. Nobody stands within EDGE_PAD of the rim; a tapped end is
// projected onto the circle R2 - ROUTE_PAD, and findRoute honours `bounds.r` (the padded circle) next to its box test.
export const ROUTE_PAD = EDGE_PAD + 1.3;
/** Projects (x, z) radially onto the disc of radius R2 - pad (the point itself when it is already inside). Non-finite input gives the origin. */
export function clampToWorld(x, z, pad = ROUTE_PAD, out = { x: 0, z: 0 }) {
  const r = hyp(x, z), L = RING.R2 - pad;
  if (!Number.isFinite(r)) { out.x = 0; out.z = 0; return out; }
  if (r <= L) { out.x = x; out.z = z; return out; }
  out.x = x / r * L; out.z = z / r * L; return out;
}
/** The part of a move (vx, vz) at (x, z) that runs along the circular wall: v minus its outward component. Allocation-free (`out` is reused). */
/** Where a move (vx, vz) from (x, z) ends when it slides along the wall: the point of edgeSlide, kept on the padded circle. `out` also receives the slide itself as (sx, sz). */
export function slidePoint(x, z, vx, vz, out = { x: 0, z: 0, sx: 0, sz: 0 }) {
  edgeSlide(x, z, vx, vz, SLIDE); out.sx = SLIDE.x; out.sz = SLIDE.z; return clampToWorld(x + SLIDE.x, z + SLIDE.z, EDGE_PAD + 1e-6, out);
}
const SLIDE = { x: 0, z: 0 };
export function edgeSlide(x, z, vx, vz, out = { x: 0, z: 0 }) {
  const r = hyp(x, z); if (!(r > 0)) { out.x = vx; out.z = vz; return out; }
  const nx = x / r, nz = z / r, d = Math.max(0, vx * nx + vz * nz);
  out.x = vx - d * nx; out.z = vz - d * nz; return out;
}

export function findRoute(start, end, obstacles, bounds) {
  if (![start.x, start.z, end.x, end.z].every(Number.isFinite)) return [];
  const boxes = obstacles.map(c => ({ minX:c.x-c.w/2-.33, maxX:c.x+c.w/2+.33, minZ:c.z-c.d/2-.33, maxZ:c.z+c.d/2+.33 }));
  const valid = p => Math.abs(p.x) <= bounds.x && Math.abs(p.z) <= bounds.z && (bounds.r === undefined || p.x * p.x + p.z * p.z <= bounds.r * bounds.r) && !boxes.some(b => p.x>b.minX&&p.x<b.maxX&&p.z>b.minZ&&p.z<b.maxZ);
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
    for(let i=0;i<nodes.length;i++)if(!closed.has(i)&&costs[i]<Infinity){const estimate=costs[i]+hyp(nodes[i].x-end.x,nodes[i].z-end.z);if(estimate<score){score=estimate;current=i;}}
    if(current<0)return [];
    if(current===1){const route=[];for(let i=1;i!==0;i=previous[i])route.unshift(nodes[i]);return route;}
    closed.add(current);
    for(let i=1;i<nodes.length;i++){if(closed.has(i)||i===current)continue;const distance=hyp(nodes[i].x-nodes[current].x,nodes[i].z-nodes[current].z),next=costs[current]+distance;if(next<costs[i]&&clear(nodes[current],nodes[i])){costs[i]=next;previous[i]=current;}}
  }
  return [];
}
