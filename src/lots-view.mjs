// Builds the families' lots as lots.mjs lays them out: the drive or the front and back paths, the picket fence with its
// gate, the mailbox, the barn, the back door on the back wall and its `house` target, and the two gravel lanes of the
// west side. Called from World.buildVillage, so everything here is baked with the rest of the village (no extra draws).
//
//   buildLanes(world, {flat})        the West Lane and the Field Lane
//   buildLot(world, h, {flat, box})  one family's lot (after world.buildHouse(h))
import { LANES_GRAVEL, lotOf } from './lots.mjs';
import { WORKSHOP } from './content.mjs';

const GRAVEL = '#f2d38e';
export function buildLanes(world, { flat }) { for (const p of LANES_GRAVEL) flat(p.x, p.z, p.w, p.d, GRAVEL); }
export function buildLot(world, h, { flat, box }) {
  const lot = lotOf(h);
  for (const p of lot.paths) flat(p.x, p.z, p.w, p.d, GRAVEL);
  world.fence(lot.fence.x1, lot.fence.z1, lot.fence.x2, lot.fence.z2, 'picket_fence', lot.fence.gap);
  world.mailbox(lot.mailbox.x, lot.mailbox.z, lot.mailbox.rot);
  if (lot.barn && world.assets.has('barn')) { world.asset('barn', world.outside, lot.barn.x, lot.barn.z, 1, 0, lot.barn.rot); world.collider(lot.barn.x, lot.barn.z, lot.barn.w, lot.barn.d); }
  if (h.id === 7) world.sized('storage-chest', world.outside, WORKSHOP.chest.x, WORKSHOP.chest.z, 1.7);
  if (!lot.back) return;
  // The main door's spot follows the model's own front door (world.buildHouse put it at the middle of the front).
  const main = world.targets.find(t => t.type === 'house' && t.id === h.id); main.x = lot.door.x; main.z = lot.door.z; main.hit.position.set(main.x, main.hit.position.y, main.z);
  // The back door, in the kit's own style (build_rural.py door()): white frame and head, the family's accent colour, a
  // pane of glass, a brass knob, on a little wooden stoop with a step. It sits on the house's back wall, in house metres.
  const g = h.group, d = lot.backDoor, y = d.floor, mid = y + d.h / 2, out = -1; // out: the back wall looks down -z
  for (const sx of [-1, 1]) box(g, d.x + sx * (d.w / 2 + .07), mid + .05, d.z + out * .09, .14, d.h + .1, .18, '#ffffff');
  box(g, d.x, y + d.h + .1, d.z + out * .1, d.w + .46, .16, .22, '#ffffff');
  box(g, d.x, mid, d.z + out * .07, d.w, d.h, .1, h.accent);
  box(g, d.x, mid + d.h * .2, d.z + out * .13, d.w * .62, d.h * .26, .04, '#8FE6FF');
  for (const sx of [-1, 1]) box(g, d.x + sx * d.w * .21, mid - d.h * .22, d.z + out * .13, d.w * .32, d.h * .3, .04, h.trim);
  box(g, d.x - d.w / 2 + .14, mid - .05, d.z + out * .16, .1, .1, .1, '#FFC83A');
  box(g, d.x, y / 2, d.z + out * .55, 1.7, y, .9, '#D99A5B'); box(g, d.x, y / 4, d.z + out * 1.12, 1.3, y / 2, .32, '#C0733A');
  for (const sx of [-1, 1]) box(g, d.x + sx * .78, y + .45, d.z + out * .93, .09, .9, .09, '#ffffff');   // two little posts
  world.target('house', h.id, `Enter ${h.name} · back door`, lot.back.x, lot.back.z, lot.back.r);
}
