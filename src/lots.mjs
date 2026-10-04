// The families' lots: everything that follows a house's doors. Pure (no three.js, no DOM): world.mjs builds what this
// says (lots-view.mjs), the minimap draws the same paths, the village plan keeps trees off them, and the tests read it.
//
//   lotOf(h)   -> {door, back?, paths, fence, mailbox, barn?, backDoor?}
//       door      {x, z, r}        where you stand to go in by the main door (the first `house` target of the house)
//       back      {x, z, r}        the same for the back door (west houses only)
//       paths     [{x, z, w, d}]   gravel: the front path (and the back path), as boxes on the ground
//       fence     {x1, z1, x2, z2, gap: {x, z, r}}   the picket fence along the road, with its gate
//       mailbox   {x, z, rot}
//       barn      {x, z, rot, w, d}   the family's barn, when it has one
//       backDoor  {x, z, floor, w, h} the back door on the house's own back wall, in the house's local metres
//   LANES_GRAVEL   [{x, z, w, d}]  the West Lane and the Field Lane
//
// The two east houses face the east road: a drive runs from the door to the road, the fence and the mailbox stand along
// it. The three west houses (content.mjs `back`) face east instead, toward the village centre and the camera, which looks
// from the south-east and could never show a door on a west wall. Their main doors open on the West Lane (a front path
// 5 m long, no fence in the way), and the west road keeps a way in: a gate in the picket fence, a short path and a back
// door with a stoop. You come out of a house where you went in (world.mjs keeps the spot).
import { HOMES, ROADS, WEST_LANE, FIELD_LANE } from './content.mjs';
import { hyp } from './hyp.mjs';

export const frontOf = h => ({ x: Math.sin(h.rot ?? 0), z: Math.cos(h.rot ?? 0) });
/** A point of the house's own plan (x across the front, z out of the front door) in world metres. */
export const toWorld = (h, x, z) => { const c = Math.cos(h.rot ?? 0), s = Math.sin(h.rot ?? 0); return { x: h.x + x * c + z * s, z: h.z - x * s + z * c }; };
/** How far the door spots stand from the middle of a house, and the houses' half depth (their collider). */
export const DOOR_REACH = 4.7, HALF_DEPTH = 3.3;
/** The back wall of each house model that has a back door (rural kit, art/blender/build_rural.py): where the door goes. */
/** Where the front door is along the front of those models (the ranch's door is in its long wing, left of the middle). */
const FRONT_DOOR = { farm_c: -1.6, farm_a: 0 };
const BACK_WALL = { farm_c: { x: -1, z: -2.3, floor: .35, w: .9, h: 1.9 }, farm_a: { x: -1, z: -2.6, floor: .45, w: .9, h: 1.8 } };
const R = ROADS, ROAD_HALF = 2.5;

export function lotOf(h) {
  const f = frontOf(h), door = { x: h.x + f.x * DOOR_REACH, z: h.z + f.z * DOOR_REACH, r: 2 };
  // A barn turned side-on is 7.4 m by 8.4 m at full size. The Vale workshop's is a little smaller (`scale`), so that it
  // stands clear of the house and a jeep's width (drive.mjs VEHICLES.jeep.radius) back from the south road's tarmac.
  const size = h.barn?.scale ?? 1, barn = h.barn ? { ...h.barn, scale: size, w: 7.4 * size, d: 8.4 * size } : null;
  if (!h.back) {
    // Facing its road: a gravel drive to the road, the fence 4.2 m inside the road's centre line, the mailbox by the gate.
    const side = Math.abs(f.x) > .5, roadX = f.x > .5 ? R.east : f.x < -.5 ? R.west : h.x, roadZ = side ? h.z : f.z > 0 ? R.south : R.north, sx = h.x + f.x * 3.5, sz = h.z + f.z * 3.5;
    const fx = roadX - f.x * 4.2, fz = roadZ - f.z * 4.2, px = -f.z, pz = f.x;
    return {
      door, barn, paths: [side ? { x: (sx + roadX) / 2, z: h.z, w: Math.abs(roadX - sx), d: 2.6 } : { x: h.x, z: (sz + roadZ) / 2, w: 2.6, d: Math.abs(roadZ - sz) }],
      fence: { x1: fx - px * 10, z1: fz - pz * 10, x2: fx + px * 10, z2: fz + pz * 10, gap: { x: side ? fx : h.x, z: side ? h.z : fz, r: 2 } },
      mailbox: { x: fx + px * 2.4 - f.x * .2, z: fz + pz * 2.4 - f.z * .2, rot: (h.rot ?? 0) + Math.PI },
    };
  }
  // A west house: the main door faces the West Lane, the back door the west road.
  const main = toWorld(h, FRONT_DOOR[h.rural] ?? 0, DOOR_REACH); door.x = main.x; door.z = main.z;
  const wall = BACK_WALL[h.rural], at = toWorld(h, wall.x, wall.z), inner = R.west + ROAD_HALF, fenceX = R.west + 4.2, laneEdge = WEST_LANE.x - WEST_LANE.w / 2, frontX = h.x + 3.5;
  return {
    door, barn, backDoor: wall,
    back: { x: h.x - f.x * DOOR_REACH, z: at.z, r: 1.8 },
    paths: [{ x: (frontX + laneEdge) / 2, z: door.z, w: laneEdge - frontX, d: 2.6 }, { x: (inner + h.x - HALF_DEPTH) / 2, z: at.z, w: h.x - HALF_DEPTH - inner, d: 1.8 }],
    fence: { x1: fenceX, z1: h.z - 10, x2: fenceX, z2: h.z + 10, gap: { x: fenceX, z: at.z, r: 1.1 } },
    mailbox: { x: fenceX + .2, z: at.z - 1.9, rot: Math.PI / 2 },
  };
}
/** The lots of the houses that stand (not the homestead, which has its own lanes). */
export const LOTS = HOMES.slice(1).map(h => ({ h, ...lotOf(h) }));
/** The houses with a back door. */
export const BACK_HOMES = HOMES.filter(h => h.back);
/** The gravel of the West Lane (north road to south road) and of the Field Lane (West Lane to the homestead's front lane). */
export const LANES_GRAVEL = [
  { x: WEST_LANE.x, z: (R.north + R.south) / 2, w: WEST_LANE.w, d: R.south - R.north - ROAD_HALF * 2 },
  { x: (WEST_LANE.x + WEST_LANE.w / 2 - 1.7) / 2, z: FIELD_LANE.z, w: -1.7 - (WEST_LANE.x + WEST_LANE.w / 2), d: FIELD_LANE.w },
];
/** True on (or within `pad` of) a lot's paths or the two lanes. */
export function onLotPath(x, z, pad = 0) {
  for (const p of LANES_GRAVEL) if (Math.abs(x - p.x) < p.w / 2 + pad && Math.abs(z - p.z) < p.d / 2 + pad) return true;
  for (const lot of LOTS) for (const p of lot.paths) if (Math.abs(x - p.x) < p.w / 2 + pad && Math.abs(z - p.z) < p.d / 2 + pad) return true;
  return false;
}
/** True on the tarmac of the ring road or of the spur out of the east gate. */
export function onRoad(x, z) {
  if ((Math.abs(z - R.north) < ROAD_HALF || Math.abs(z - R.south) < ROAD_HALF) && Math.abs(x) < R.east + ROAD_HALF) return true;
  if ((Math.abs(x - R.west) < ROAD_HALF || Math.abs(x - R.east) < ROAD_HALF) && z > R.north - ROAD_HALF && z < R.south + ROAD_HALF) return true;
  return Math.abs(z) < ROAD_HALF && x > R.east && x < R.east + 13.5;
}
/** True on something made for walking along: the road, the two lanes, a lot's paths. */
export const onWay = (x, z) => onRoad(x, z) || onLotPath(x, z);
/**
 * A tap on a way walks there. The camera looks down from the south-east, so the tall, unseen box you tap to use a thing
 * (a garden bed, the gate, a tree) also covers the ground behind it: a stretch of the Field Lane behind the bed row, the
 * ring road's outer lane behind the gate. `target` is what the tap's ray met, (x, z) the ground under the tap: when that
 * ground is a way and lies beyond the target's own reach, the tap means "walk here", not "use that". Doors and people
 * are left alone (you tap a house's wall or a villager's head, both well away from where they stand).
 */
export const tapWalks = (target, x, z) => target.type !== 'house' && target.type !== 'person' && onWay(x, z) && hyp(x - target.x, z - target.z) > target.r;
