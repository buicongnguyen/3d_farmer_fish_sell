import { hyp } from './hyp.mjs';
// Round blockers too wide for the 8 m grid (round 8; owner: builder C). Pure.
//
// world.addTreeBlock files a block under the 8 m cell of its centre, and the three lookups (World.treeBlocked through
// treesNear, DriveView.blocked and depth, Pandora's treeAt) read only the 3 x 3 cells round the asking point. That finds
// every block whose radius plus the asker's margin is at most 8 m: every tree (r under 1 m), every cage. A pond of r 9 or
// 11, a lava pool of r 11 or 15 and the dragon's nest of r 14 are wider, and a car or a walker would pass through the part
// of their bank that lies two cells from the centre. So a block with r over WIDE_BLOCK is kept out of the grid, in a short
// list that each lookup walks in full (a dozen blocks in the whole world, and only those of the tiles that are built).
//
// carOnly: a block that stops cars and nobody on foot (a lava pool, the nest basin; spec 3.9). Walkers, creatures, shots
// and dashes ask with cars = false.

/** A block wider than this (metres) is kept in the wide list, not in the grid. 8 m minus the widest margin (a jeep's 1.5 m), with room to spare. */
export const WIDE_BLOCK = 4;
export const isWide = t => t.r > WIDE_BLOCK;
/** How far (metres) the point is inside the nearest wide block grown by `pad`: 0 when clear of them all. `cars`: carOnly blocks count. */
export function wideDepth(list, x, z, pad, cars) {
  let deep = 0;
  for (let i = 0; i < list.length; i++) { const t = list[i]; if (t.carOnly && !cars) continue; const dx = x - t.x, dz = z - t.z, min = t.r + pad, d2 = dx * dx + dz * dz; if (d2 < min * min) deep = Math.max(deep, min - Math.sqrt(d2)); }
  return deep;
}

/**
 * A mirror of the world's blocks under number keys, for a caller that asks "is something round here?" many times a step
 * without making garbage (Pandora's creatures, shots and dashes). add and remove take the block world.addTreeBlock was given;
 * hit(x, z, pad) is true inside any mirrored block grown by pad. `cars` false (the default): carOnly blocks are left out.
 */
export function blockMirror({ cars = false } = {}) {
  const grid = new Map(), wide = [], cellKey = (x, z) => (Math.floor(x / 8) + 4096) * 8192 + Math.floor(z / 8) + 4096;
  return {
    grid, wide,
    add(t) { if (t.carOnly && !cars) return; if (isWide(t)) { wide.push(t); return; } const k = cellKey(t.x, t.z); let list = grid.get(k); if (!list) grid.set(k, list = []); list.push(t); },
    remove(t) { if (isWide(t)) { const i = wide.indexOf(t); if (i >= 0) wide.splice(i, 1); return; } const k = cellKey(t.x, t.z), list = grid.get(k); if (list) { const i = list.indexOf(t); if (i >= 0) list.splice(i, 1); if (!list.length) grid.delete(k); } },
    hit(x, z, pad = .3) {
      const cx = Math.floor(x / 8) + 4096, cz = Math.floor(z / 8) + 4096;
      for (let i = cx - 1; i <= cx + 1; i++) for (let k = cz - 1; k <= cz + 1; k++) { const list = grid.get(i * 8192 + k); if (list) for (let n = 0; n < list.length; n++) { const t = list[n]; if (hyp(x - t.x, z - t.z) < t.r + pad) return true; } }
      return wideDepth(wide, x, z, pad, cars) > 0;
    },
  };
}
