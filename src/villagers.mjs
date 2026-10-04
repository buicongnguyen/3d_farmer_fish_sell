// The villagers' day: where each one lives, works and likes to go, the lanes they walk, and the little trips that take
// them from one building to another. Pure (no three.js, no DOM): villagers-view.mjs moves the people, the tests read it.
//
//   placeOf(p, key)        -> {x, z, inside, where, via, key}   a villager's own spot at a place
//   slotOf(p, state)       -> the place key the timetable wants now ('home', 'yard', 'school', 'market', 'job:fisher' …)
//   lanePath(from, to)     -> [{x, z}, …] the walk from one spot to another along the lanes (no search at run time)
//   pickTrip(p, state, at, random) -> a place key to stroll to, or null
//
// Six families have a house (content.mjs HOMES); four lodge in a village building (HOUSES[i].lodge): the Moss family in
// the barn by the animal pen, the Hearths in their bakery by the green, the Brooks at the school, the Lindens at the
// clinic. "Home" for them is that building's door; their yard is the ground beside it.
//
// Trips (round 7: "people should go outside from this building to the other building sometimes"): besides the
// timetable, every few seconds one villager who has been still for a while walks to another place (the market, the
// atelier's stall, the green, the pond lane, a neighbour's porch), stays a little, and walks back to where the
// timetable wants them, so a few people are always on the lanes. While the Pandora box is open they stay near home:
// fewer walkers, short trips only, children not at all.
import { HOUSES, CIVIC, WORKPLACE, FISH_SPOT, MARKET, ATELIER, GREEN, POND, ROADS, RESIDENTS, WEST_LANE, FIELD_LANE } from './content.mjs';

import { lotOf } from './lots.mjs';
import { hyp } from './hyp.mjs';
const front = h => ({ x: Math.sin(h.rot ?? 0), z: Math.cos(h.rot ?? 0) });
const KIDS = RESIDENTS.filter(p => p.child);
/** A villager's place among their own household (0, 1, 2 …). */
const rankOf = p => Math.max(0, RESIDENTS.filter(q => q.home === p.home).findIndex(q => q.id === p.id));

// ---------------------------------------------------------------- the lanes
// Villagers keep to the ring road's inner edge, the West Lane in front of the west houses, the Field Lane, the
// homestead's lanes, the east families' drives, market row and a few footpaths between yards. A walk is: your spot -> its lane node -> the shortest way over the lanes -> the other spot.
const W = ROADS.west + 1.3, E = ROADS.east - 1.3, N = ROADS.north + 1.3, S = ROADS.south - 1.3, WL = WEST_LANE.x;
const NODES = {
  // the ring road (its inner edge)
  nw: [W, N], ne: [E, N], sw: [W, S], se: [E, S],
  wAlder: [W, -20], wFinch: [W, 0], wVale: [W, 20], eBell: [E, -20], eGate: [E, 0], eReed: [E, 20],
  nYard: [-29.7, N], nSchool: [-22, N], nClinic: [-6, N], n0: [0, N], nPolice: [10, N], nCompany: [26, N], nSuper: [42, N], s0: [0, S],
  // the families' gates: the two east drives, and on the West Lane the front paths of the three west houses
  dAlder: [WL, -20], dFinch: [WL, 0], dVale: [WL, 20], dBell: [45.2, -20], dReed: [45.2, 20],
  // the West Lane from the north road to the south road, and where the Field Lane leaves it for the homestead's gate
  wlN: [WL, N], wField: [WL, FIELD_LANE.z], wlS: [WL, S],
  // the homestead: the north lane, round the east side of the house, out by the front gate, down the front lane
  hNorth: [0, -18.6], hNE: [6.4, -18.6], hEast: [6.4, -11.5], hBike: [7.5, -9], hFence: [7.5, -5.2], hGate: [0, -7.4], hFront: [0, -3.8],
  track: [19, -11.5], barn: [24.8, -12.2], pondLane: [0, 12.2], dock: [10.4, 12.3], farm: [-12, 12.5],
  // market row and the green
  row0: [0, 26], row1: [MARKET.x, 26], row2: [ATELIER.x, 26], row3: [18.2, 26.3], bakery: [27, 26.3], green: [18, 30.4],
  // the Field Lane's end by the garden gate; footpaths: the West Lane to the farm gate, Vale and Reed to market row
  field0: [-7.4, FIELD_LANE.z], finch3: [WL, 12.6],
  vale1: [WL, 29.4], vale2: [-24.5, 29.6], rowW: [-4, 27.2], reed1: [43.8, 26.8], reed2: [34, 26.8],
};
const EDGES = [
  ['nw', 'wlN'], ['wlN', 'nYard'], ['nYard', 'nSchool'], ['nSchool', 'nClinic'], ['nClinic', 'n0'], ['n0', 'nPolice'], ['nPolice', 'nCompany'], ['nCompany', 'nSuper'], ['nSuper', 'ne'],
  ['nw', 'wAlder'], ['wAlder', 'wFinch'], ['wFinch', 'wVale'], ['wVale', 'sw'], ['ne', 'eBell'], ['eBell', 'eGate'], ['eGate', 'eReed'], ['eReed', 'se'], ['sw', 'wlS'], ['wlS', 's0'], ['s0', 'se'],
  ['eBell', 'dBell'], ['eReed', 'dReed'],
  ['wlN', 'dAlder'], ['dAlder', 'wField'], ['wField', 'dFinch'], ['dFinch', 'finch3'], ['finch3', 'dVale'], ['dVale', 'vale1'], ['vale1', 'wlS'],
  ['n0', 'hNorth'], ['hNorth', 'hNE'], ['hNE', 'hEast'], ['hEast', 'hBike'], ['hBike', 'hFence'], ['hFence', 'hFront'], ['hGate', 'hFront'], ['hFront', 'pondLane'], ['pondLane', 'row0'], ['row0', 's0'],
  ['hEast', 'track'], ['track', 'barn'], ['pondLane', 'dock'], ['pondLane', 'farm'],
  ['row0', 'row1'], ['row1', 'row2'], ['row2', 'row3'], ['row3', 'bakery'], ['row3', 'green'],
  ['wField', 'field0'], ['field0', 'hFront'], ['finch3', 'farm'],
  ['vale1', 'vale2'], ['vale2', 'rowW'], ['rowW', 'row0'], ['dReed', 'reed1'], ['reed1', 'reed2'], ['reed2', 'bakery'],
];
/** The lane graph: nodes {id: {x, z}}, edges [[a, b]], and the shortest way between every two nodes (made once). */
export const LANES = (() => {
  const ids = Object.keys(NODES), n = ids.length, index = new Map(ids.map((id, i) => [id, i])), nodes = Object.fromEntries(ids.map(id => [id, { x: NODES[id][0], z: NODES[id][1], id }]));
  const dist = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, k) => i === k ? 0 : Infinity)), next = Array.from({ length: n }, () => Array(n).fill(-1));
  for (const [a, b] of EDGES) { const i = index.get(a), k = index.get(b), d = hyp(nodes[a].x - nodes[b].x, nodes[a].z - nodes[b].z); dist[i][k] = dist[k][i] = d; next[i][k] = k; next[k][i] = i; }
  for (let m = 0; m < n; m++) for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) if (dist[i][m] + dist[m][k] < dist[i][k]) { dist[i][k] = dist[i][m] + dist[m][k]; next[i][k] = next[i][m]; }
  return { ids, index, nodes, edges: EDGES, dist, next };
})();
/** The lane node nearest to a point. */
export function nearestNode(x, z) { let best = '', far = Infinity; for (const id of LANES.ids) { const p = LANES.nodes[id], d = hyp(p.x - x, p.z - z); if (d < far) { far = d; best = id; } } return best; }
/** Metres along the lanes between two nodes. */
export const laneDistance = (a, b) => LANES.dist[LANES.index.get(a)][LANES.index.get(b)];
/**
 * The walk from `from` to `to`: [{x, z}, …] ending at `to`. Each end names its lane node (`via`), or the nearest one is
 * taken (someone turned round in the middle of a lane). A corner you would only walk back from is left out.
 */
export function lanePath(from, to) {
  const a = from.via ?? nearestNode(from.x, from.z), b = to.via ?? nearestNode(to.x, to.z), path = [];
  if (a !== b) {
    let i = LANES.index.get(a); const end = LANES.index.get(b);
    for (let guard = 0; i !== end && i >= 0 && guard < 64; guard++) { path.push(LANES.nodes[LANES.ids[i]]); i = LANES.next[i][end]; }
    path.push(LANES.nodes[b]);
    // Standing between the first two nodes already (or nearer the second): skip the first; the same at the far end.
    if (path.length > 1 && shortcut(from, path[0], path[1])) path.shift();
    if (path.length > 1 && shortcut(to, path.at(-1), path.at(-2))) path.pop();
  }
  path.push({ x: to.x, z: to.z });
  return path;
}
/** True when going p -> node -> onward doubles back: p lies along node -> onward, close to that lane. */
function shortcut(p, node, onward) {
  const dx = onward.x - node.x, dz = onward.z - node.z, len = hyp(dx, dz) || 1, along = ((p.x - node.x) * dx + (p.z - node.z) * dz) / len, off = Math.abs((p.x - node.x) * dz - (p.z - node.z) * dx) / len;
  return along > 0 && along < len && off < 1.6;
}
export const pathLength = (from, path) => { let d = 0, at = from; for (const p of path) { d += hyp(p.x - at.x, p.z - at.z); at = p; } return d; };

// ---------------------------------------------------------------- places
/** The lodgings: the door the family goes in by (hidden indoors), the ground beside it, the lane node, and what to call it. */
const LODGE = {
  barn: { where: 'the Moss barn', via: 'barn', door: (p, k) => ({ x: 27 + k, z: -14.9 }), yard: (p, k) => [{ x: 26.6, z: -12.4 }, { x: 25.2, z: -10.4 }, { x: 27.2, z: -9.8 }][k % 3], porch: [-1.6, 3.4] },
  bakery: { where: 'the Hearth bakery', via: 'bakery', door: (p, k) => ({ x: 26.2 + k * 1.6, z: 24.5 }), yard: (p, k) => ({ x: 25 + k * 3.2, z: 25.4 }), porch: [1.6, 1.2] },
  school: { where: 'the schoolhouse', via: 'nSchool', civic: 'school', yardVia: 'nYard', yard: (p, k) => ({ x: -28.9, z: -36.4 - k * 1.5 }), porch: [-.9, 2.2] },
  hospital: { where: 'the clinic rooms', via: 'nClinic', civic: 'hospital', yardVia: 'n0', yard: (p, k) => ({ x: 1.4 + k * 1.5, z: -37 - k * .9 }), porch: [.6, 1.6] },
};
const DRIVES = { 1: 'dAlder', 2: 'dBell', 4: 'dReed', 5: 'dFinch', 7: 'dVale' };
/**
 * Where people stand at a west house: always on the far side of the front path from the camera (north of it), so that a
 * tap on the path or on the door never meets a villager's tap box, which covers the ground behind them. In metres north
 * of the path's centre line: the doorstep (`step`, "Knock"), the family's yard spots and a caller's. Each is farther from
 * the door's spot than twice the reach you go in from (lots.mjs: 2 m x .82), so wherever you stand to use the door, and
 * wherever you come out, the door is the nearest thing.
 */
export const WEST_SPOTS = { step: 3.4, yard: 2.8, caller: 3.2 };
/** `out` metres in front of a west house's main door spot (toward the lane), `north` metres to the door's far side from the camera. */
const westSpot = (h, out, north) => { const d = lotOf(h).door, f = front(h); return { x: d.x + f.x * out + f.z * north, z: d.z + f.z * out - f.x * north }; };
const civicSpot = (p, c) => ({ x: c.x + (p.index % 5 - 2) * 1.62, z: c.z + c.d / 2 + 3.6 });
export const JOB_SPOTS = { farmhand: { x: -15, z: 11.6, via: 'farm' }, fisher: { x: FISH_SPOT.x + 2.5, z: FISH_SPOT.z + .8, via: 'dock' }, herder: { x: 15, z: -12.4, via: 'track' }, gardener: { x: -10, z: 11.6, via: 'farm' }, picker: { x: -17, z: 13.6, via: 'farm' } };
/** The places a villager's day and strolls are made of. */
export const PLACES = ['home', 'yard', 'market', 'atelier', 'green', 'pond', 'schoolyard'];
/**
 * A villager's own spot at a place: {x, z, inside, where, via, key}. `inside` places hide the villager (you knock at the
 * door); `via` is the lane node the spot is reached from. Returns null for a place this villager has no spot at.
 */
export function placeOf(p, key) {
  const h = HOUSES[p.home], f = front(h), side = (p.index % 5 - 2) * .9, rank = rankOf(p), lodge = LODGE[h.lodge];
  const spot = (x, z, inside, where, via) => ({ x, z, inside, where, via, key });
  if (key === 'home') {
    if (lodge?.civic) { const c = CIVIC.find(c => c.id === lodge.civic), at = civicSpot(p, c); return spot(at.x, at.z, true, lodge.where, lodge.via); }
    if (lodge) { const at = lodge.door(p, rank); return spot(at.x, at.z, true, lodge.where, lodge.via); }
    if (h.back) { const at = westSpot(h, -.4, WEST_SPOTS.step + rank * 1.1); return spot(at.x, at.z, true, `${h.family} house`, DRIVES[h.id]); } // along the front wall, north of the main door
    return spot(h.x + f.x * 5.2 - f.z * (2.6 + side * .4), h.z + f.z * 5.2 + f.x * (2.6 + side * .4), true, `${h.family} house`, h.id === 0 ? 'hGate' : DRIVES[h.id]);
  }
  if (key === 'yard') {
    if (lodge) { const at = lodge.yard(p, rank); return spot(at.x, at.z, false, 'home', lodge.yardVia ?? lodge.via); }
    if (h.back) { const at = westSpot(h, 2.7, WEST_SPOTS.yard + (p.index % 3) * 1.7); return spot(at.x, at.z, false, 'home', DRIVES[h.id]); } // the front lawn by the lane, north of the path
    const wide = (p.index % 3 - 1) * 2.2; return spot(h.x + f.x * 7.2 - f.z * wide, h.z + f.z * 7.2 + f.x * wide, false, 'home', h.id === 0 ? 'hGate' : DRIVES[h.id]);
  }
  if (key === 'market') return spot(MARKET.x - 3.4 + (p.index % 6) * 1.36, MARKET.z + 3.7 + Math.floor(p.index / 6) * .95, false, 'the market', 'row1'); // a place each, in front of the stall
  if (key === 'atelier') return spot(ATELIER.x - 1.2 + (p.index % 3) * 1.3, ATELIER.z + 4.5 + (p.index % 2) * .9, false, 'the atelier’s stall', 'row2');
  if (key === 'stall') return spot(ATELIER.x + 3.2, ATELIER.z + 1, false, 'the atelier’s stall', 'row2');           // Iris, beside her stall
  if (key === 'green') return spot(GREEN.x - 4.2 + (p.index % 6) * 1.68, GREEN.z + 2.7 + Math.floor(p.index / 6) * .95, false, 'the village green', 'green');
  if (key === 'pond') return spot(3.2 + (p.index % 4) * 1.9, 13.9 + (p.index % 2) * .7, false, 'the pond lane', 'pondLane');
  if (key === 'schoolyard') { const k = Math.max(0, KIDS.findIndex(q => q.id === p.id)); return spot(-30.6 + (k % 2) * 1.5, -41.6 + Math.floor(k / 2) * 1.9, false, 'the school yard', 'nYard'); }
  if (key.startsWith('porch:')) { // a neighbour's gate: just inside their fence, or beside their lodging's door
    const host = HOUSES[Number(key.slice(6))]; if (!host || host.id === h.id) return null;
    const g = front(host), away = p.index % 2 ? 1.5 : -1.5, guest = LODGE[host.lodge];
    if (guest) { const at = guest.yard(p, 0); return spot(at.x + guest.porch[0] + away * .5, at.z + guest.porch[1], false, `${host.family}’s`, guest.yardVia ?? guest.via); }
    if (host.id === 0) return spot(away * 1.4, -4.6, false, 'your gate', 'hFront');
    if (host.back) { const at = westSpot(host, 1.4, WEST_SPOTS.caller + (p.index % 2) * 1.5); return spot(at.x, at.z, false, `${host.family}’s gate`, DRIVES[host.id]); } // on the front lawn, north of the path
    return spot(host.x + g.x * 8.7 - g.z * away, host.z + g.z * 8.7 + g.x * away, false, `${host.family}’s gate`, DRIVES[host.id]);
  }
  if (key.startsWith('job:')) { const at = JOB_SPOTS[key.slice(4)]; return at ? spot(at.x + (p.index % 3 - 1) * 1.2, at.z, false, 'your farm', at.via) : null; }
  const c = CIVIC.find(c => c.id === key); if (!c) return null;
  const at = civicSpot(p, c); return spot(at.x, at.z, true, c.name, { school: 'nSchool', hospital: 'nClinic', police: 'nPolice', company: 'nCompany', supermarket: 'nSuper' }[c.id]);
}
/** Every place key this villager can be sent to (for maps and tests). */
export function placesOf(p) {
  const keys = ['home', 'yard', 'market', 'atelier', 'green', 'pond', ...HOUSES.filter(h => h.id !== p.home).map(h => `porch:${h.id}`)];
  if (p.child) keys.push('school', 'schoolyard'); if (WORKPLACE[p.id]) keys.push(WORKPLACE[p.id]); if (!p.child && p.home > 0) keys.push(...Object.keys(JOB_SPOTS).map(j => 'job:' + j));
  return [...new Set(keys)];
}

// ---------------------------------------------------------------- the timetable
/**
 * Where the day wants a villager now. Each has a plan of hours and places; a hired neighbour works for you from 8:30 to
 * 17:00. About half the day is indoors (home, school, a Town Square job), where the villager is hidden and answers a knock.
 */
const PLANS = new WeakMap(), JOBS = new Map();
/** A villager's day as [hour, place] pairs: fixed for the villager, so it is made once (the timetable is asked for every villager every frame). */
function planOf(p) {
  let plan = PLANS.get(p); if (plan) return plan;
  const work = p.child ? 'school' : WORKPLACE[p.id], treat = p.index % 2 ? 'market' : 'green';
  plan = p.child ? [[0, 'home'], [8, 'school'], [11.5, 'schoolyard'], [12.5, 'school'], [15, treat], [18, 'home']]
    : work ? [[0, 'home'], [8.3, work], [12, treat], [13, work], [16.8, 'yard'], [19, 'home']]
    : p.index % 2 ? [[0, 'yard'], [9, 'home'], [11, treat], [12.5, 'home'], [15, 'yard'], [17.5, 'home']] : [[0, 'home'], [8.5, 'yard'], [10.3, treat], [12, 'home'], [14, 'yard'], [16.3, treat], [18, 'home']];
  PLANS.set(p, plan); return plan;
}
export function slotOf(p, s) {
  const t = s.time + ((p.index * 37) % 9) / 9 * .8 - .4, job = s.hired?.[p.id];
  if (job && t >= 8.5 && t < 17) { let key = JOBS.get(job); if (!key) JOBS.set(job, key = 'job:' + job); return key; }
  const plan = planOf(p); let key = plan[0][1]; for (let i = 0; i < plan.length; i++) if (t >= plan[i][0]) key = plan[i][1]; return key;
}

// ---------------------------------------------------------------- trips
/** Walkers kept on the lanes, seconds between launches, the stay at the far end, the rest between one villager's trips, how far a trip may be. */
export const TRIP = {
  walkers: 4, walkersOpen: 2, every: 1.6, stay: [7, 13], rest: [40, 95], restOpen: [60, 130],
  reach: 115, reachOpen: 46, speed: 2.6, childSpeed: 2.3,
};
/** The two households a villager calls on: the next and the one before in the round of the village. */
const ROUND = [0, 1, 8, 9, 3, 2, 4, 6, 7, 5];
function friendsOf(p) { const i = ROUND.indexOf(p.home), n = ROUND.length; return [ROUND[(i + 1) % n], ROUND[(i + n - 1) % n]].filter(id => id !== p.home); }
/** Where a villager might stroll to (place keys, most likely first in the list as often as it should be drawn). */
export function tripsOf(p, s) {
  const [a, b] = friendsOf(p), day = s.time >= 8 && s.time < 18.5;
  if (p.child) return day ? ['green', 'schoolyard', `porch:${a}`, 'pond', 'market'] : ['yard'];           // after dark a child only slips out to the yard
  return day ? ['market', 'market', 'atelier', 'green', 'pond', `porch:${a}`, `porch:${b}`] : ['yard', `porch:${a}`, `porch:${b}`, 'green', 'market', 'pond'];
}
/**
 * A place for a stroll from the spot `at` (with its `via`), or null: one of the villager's haunts, not where they are,
 * within reach along the lanes. While the Pandora box is open (`s.pandora`): children stay put and grown-ups keep to
 * short walks, so everyone stays well inside the ward.
 */
export function pickTrip(p, s, at, random = Math.random) {
  const open = s.pandora === true; if (open && p.child) return null;
  const reach = open ? TRIP.reachOpen : TRIP.reach, list = tripsOf(p, s), start = Math.floor(random() * list.length);
  for (let i = 0; i < list.length; i++) {
    const key = list[(start + i) % list.length], to = placeOf(p, key); if (!to || at.key === key) continue;
    if (hyp(to.x - at.x, to.z - at.z) < (key === 'yard' ? 1.5 : 6)) continue;        // not worth the walk (a step out to your own yard always is)
    if (pathLength(at, lanePath(at, to)) <= reach) return key;
  }
  return null;
}

// ---------------------------------------------------------------- hellos
const pick = (list, random) => list[Math.floor(random() * list.length) % list.length];
/** What one villager says to another in passing, and the answer: [hello, reply]. */
export function greeting(a, b, hour = 12, random = Math.random) {
  const time = hour < 12 ? 'Morning' : hour < 17.5 ? 'Afternoon' : 'Evening';
  if (a.child && b.child) return [pick([`Hi ${b.name}!`, 'Race you!', 'Tag, you’re it!'], random), pick([`Hi ${a.name}!`, 'Wait for me!', 'No fair!'], random)];
  if (a.child) return [pick([`Hello, ${b.name}!`, `Hi ${b.name}!`], random), pick([`Hello, little ${a.name}.`, 'Mind the puddles!', `Hello, ${a.name}!`], random)];
  return [pick([`${time}, ${b.name}!`, `Hello, ${b.name}!`, `Lovely ${hour < 17.5 ? 'day' : 'evening'}, ${b.name}.`, `${time}!`], random), pick([`${time}, ${a.name}!`, `Good to see you, ${a.name}.`, 'Off to the market?', 'Say hello at home!', `Hello, ${a.name}!`], random)];
}
/** What a villager says when you walk by. */
export const hello = (p, hour = 12, random = Math.random) => p.child ? pick(['Hi Rowan!', 'Hello!'], random) : pick([`${hour < 12 ? 'Morning' : hour < 17.5 ? 'Afternoon' : 'Evening'}, Rowan!`, 'Hello, Rowan!', `Lovely ${hour < 17.5 ? 'day' : 'evening'}!`], random);
export { POND };
