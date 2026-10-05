// The two neighbours' motorbikes, as plain data and rules (no three.js): where each is parked at home and at work, the
// road route between the two, and when a ride is wanted. bike-riders.mjs draws and moves them; the tests read this.
// Nothing here is saved: where a bike is follows from the clock and the day, and nothing reads the Pandora box.
import { LANES, lanePath, pathLength } from './villagers.mjs';
import { ROADS, RESIDENTS } from './content.mjs';
import { hyp } from './hyp.mjs';

/** The bays stand parallel to the building's front, on the strip between its wall (z -36.6 at the police station) and the road's edge (-35.5), nose west. */
const BAY_Z = -35.9;
/** The north road's inner lane: the bike leaves and joins the road here. */
const ROAD_Z = ROADS.north + 1.3;
/** The rides: Theo (Bell garage, east) to the police station; Finn (Reed boathouse, east) to the supermarket. */
export const BIKES = [
  // Theo: the police station's kerb bay, west of the door's end (the strip between the wall and the road's edge)
  { id: 'bike-theo', rider: 'theo', work: 'police', label: 'Theo’s motorbike', color: '#e8433a', stand: { x: 44.4, z: -23.4, rot: Math.PI, via: 'dBell' },
    bay: { x: 12.5, z: BAY_Z, rot: -Math.PI / 2, via: 'nPolice' }, approach: [{ x: 17, z: ROAD_Z }, { x: 14.3, z: BAY_Z }, { x: 12.5, z: BAY_Z }] },
  // Finn: a bay in the supermarket's customer parking, nose north (the shop's own front is lined with its stalls and planters)
  { id: 'bike-finn', rider: 'finn', work: 'supermarket', label: 'Finn’s motorbike', color: '#2f7fe0', stand: { x: 44.4, z: 23.4, rot: 0, via: 'dReed' },
    bay: { x: 52.2, z: -37.6, rot: Math.PI, via: 'ne' }, approach: [{ x: 52.2, z: -34 }, { x: 52.2, z: -37.6 }] },
];
/** Speeds (m/s), the turn rate (rad/s), and the time to mount or dismount. Riders wait until the lane is clear. */
export const RIDE = { speed: 8, slow: 3, accel: 4, brake: 9, turn: 3.6, mount: .6, gap: 3.2, side: 1.15, riders: 2 };
/** The way from the home stand to the work bay: lane nodes only, then straight across the road's width to the bay. */
export function routeOut(b) {
  const path = lanePath({ x: b.stand.x, z: b.stand.z, via: b.stand.via }, { x: b.bay.x, z: b.bay.z, via: b.bay.via });
  path.pop();
  // The first approach point lies on the last stretch of the road: stop there rather than ride on to the node and back.
  const first = b.approach[0];
  while (path.length > 1) { const a = path.at(-2), c = path.at(-1); if (Math.abs(c.z - first.z) < .01 && Math.abs(a.z - first.z) < .01 && (first.x - a.x) * (first.x - c.x) < 0) path.pop(); else break; }
  path.push(...b.approach.map(pt => ({ x: pt.x, z: pt.z })));
  return path;
}
/** The way home: the same route backwards (from the bay to the stand). */
export function routeHome(b) { const out = routeOut(b), back = []; for (let i = out.length - 2; i >= 0; i--) back.push(out[i]); back.push({ x: b.stand.x, z: b.stand.z }); return back; }
export const routeLength = (b, dir) => pathLength(dir === 'out' ? b.stand : b.bay, dir === 'out' ? routeOut(b) : routeHome(b));
/** Where a bike is when nobody has moved it: at the bay through its rider's working day (their own clock: slotOf skews each villager a little), at home otherwise. */
export const parkedAt = (hour, b) => { const p = RESIDENTS.find(q => q.id === b.rider), t = hour + ((p.index * 37) % 9) / 9 * .8 - .4; return t >= 8.3 && t < 16.8 ? 'bay' : 'home'; };
/** Which ride a villager's next place asks for: 'out' (home to work), 'home' (work to home), or '' for a walk. */
export function rideWanted(b, key, at) {
  const dir = key === b.work ? 'out' : key === 'home' || key === 'yard' ? 'home' : '';
  return dir === 'out' && at === 'home' || dir === 'home' && at === 'bay' ? dir : '';
}
export const NODE_IDS = new Set(LANES.ids);
export { hyp };
