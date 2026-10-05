// Positions for the catch resting beside a fishing spot; save counts remain unlimited.
import { POND } from './content.mjs';
import { waterDistance } from './pond.mjs';

export const BANK_FISH_LIMIT = 24;
/** Place a compact pile on dry grass, clear of the angler and nearby obstacles. */
export function bankFishSpot(anchor, slot, blocked = () => false) {
  const dx = anchor.x - POND.x, dz = anchor.z - POND.z;
  const eastWest = Math.abs(dx) - POND.w / 2 > Math.abs(dz) - POND.d / 2;
  const nx = eastWest ? Math.sign(dx) || 1 : 0, nz = eastWest ? 0 : Math.sign(dz) || 1;
  const tx = nz, tz = -nx, col = slot % 4, row = Math.floor(slot / 4) % 6;
  // A stack grows over a small patch instead of spreading across a path or into water.
  const side = 1.35 + col * .22, back = .8 + row * .22;
  let best = null;
  for (let pass = 0; pass < 8; pass++) {
    const sign = pass % 2 ? -1 : 1, extra = Math.floor(pass / 2) * .55;
    const x = anchor.x + tx * side * sign + nx * (back + extra), z = anchor.z + tz * side * sign + nz * (back + extra);
    if (waterDistance(x, z) < 1.35 || blocked(x, z) || blocked(x + tx * .65, z + tz * .65) || blocked(x - tx * .65, z - tz * .65)) continue;
    best = { x, z, h: Math.atan2(tx * sign, tz * sign) + (slot % 3 - 1) * .18, y: .02 + Math.floor(slot / 8) * .055 }; break;
  }
  // A valid fishing position always has some dry ground; keep the fallback outside water.
  if (!best) {
    const out = Math.max(back, 1.5 - waterDistance(anchor.x, anchor.z));
    best = { x: anchor.x + tx * side + nx * out, z: anchor.z + tz * side + nz * out, h: Math.atan2(tx, tz), y: .02 };
  }
  return best;
}

/** Stable, slow deep swimmers: hints cost one quad each even on low quality. */
export function deepFishPose(index, time, out, pond = POND) {
  const a = index * 2.399963 + time * (.065 + index * .004), b = a * 1.13 + index;
  const rx = (pond.w / 2 - 1.8) * (.45 + (index % 3) * .2), rz = (pond.d / 2 - 1.6) * (.5 + (index % 2) * .27);
  out.x = pond.x + Math.sin(a) * rx; out.z = pond.z + Math.cos(b) * rz;
  out.h = Math.atan2(Math.cos(a) * rx, -Math.sin(b) * rz * 1.13); return out;
}
