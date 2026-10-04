// Tunes region-mix.mjs DENSITY: for every region, the density (creatures a 32 m cell, at most 4) at which the seeded spawn
// plan (wilds.mjs wildCell) holds the region's TARGET count. The count depends on everything that takes a spawn slot away:
// the blocking scenery (region-life.mjs DECOR through field-layout.mjs fieldTrees), the land features (land-features.mjs
// landClear: ponds, pools, rails) and the den clearings. So run it again whenever one of those changes, and paste the line
// it prints over `export const DENSITY` in src/region-mix.mjs:
//
//   node scripts/tune-density.mjs          prints the counts now and the tuned table
//
// A region that cannot reach its target at 4.0 is reported; spec 3.8 then lowers that region's target to what 3.8 a cell gives.
import { wildCell, wildDepth } from '../src/wilds.mjs';
import { MIX, DENSITY, TARGET } from '../src/region-mix.mjs';

const regions = Object.keys(MIX).filter(id => MIX[id].length);
/** Seeded commons by region over every cell that touches the world (±352 m). */
export function census() {
  const count = Object.fromEntries(regions.map(id => [id, 0]));
  for (let cx = -11; cx <= 10; cx++) for (let cz = -11; cz <= 10; cz++) for (const c of wildCell(cx, cz)) if (!c.id.startsWith('w:den:')) count[c.region]++;
  return count;
}
const now = census(), tuned = { village: 0 }, notes = [];
for (const id of regions) {
  const start = DENSITY[id]; let best = null;
  // Every hundredth from 0.5 to 4: the count is not strictly monotone (a kept slot can crowd out its neighbour), so scan, do not bisect.
  for (let d = 50; d <= 400; d++) {
    DENSITY[id] = d / 100; const n = census()[id], off = Math.abs(n - TARGET[id]);
    if (!best || off < best.off || off === best.off && Math.abs(d / 100 - start) < Math.abs(best.d - start)) best = { d: d / 100, n, off };
  }
  DENSITY[id] = start; tuned[id] = best.d;
  notes.push(`${id.padEnd(7)} target ${String(TARGET[id]).padStart(2)}  now ${String(now[id]).padStart(2)} at ${start}  ->  ${best.n} at ${best.d}${best.off > 2 ? '   OUT OF REACH: lower the target (spec 3.8)' : ''}`);
}
console.log(notes.join('\n'));
console.log(`export const DENSITY = { ${Object.entries(tuned).map(([id, d]) => `${id}: ${d}`).join(', ')} };`);
// With the tuned table: a kind of a mix that no kept slot drew (reorder that region's MIX list: the order decides which slot
// holds which kind), and how many creatures live within 20 m of the ward on each side (the user asked for creatures up to the road).
Object.assign(DENSITY, tuned);
const kinds = Object.fromEntries(regions.map(id => [id, new Set()])), close = { west: 0, north: 0, south: 0, east: 0 };
for (let cx = -11; cx <= 10; cx++) for (let cz = -11; cz <= 10; cz++) for (const c of wildCell(cx, cz)) { if (c.id.startsWith('w:den:')) continue; kinds[c.region].add(c.type); if (c.region in close && wildDepth(c.x, c.z) < 20) close[c.region]++; }
for (const id of regions) { const missing = MIX[id].map(([type]) => type).filter(type => !kinds[id].has(type)); if (missing.length) console.log(`${id}: no ${missing.join(', ')} is seeded`); }
console.log('within 20 m of the ward: ' + Object.entries(close).map(([id, n]) => `${id} ${n}`).join(', '));
