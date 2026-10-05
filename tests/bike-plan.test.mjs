// The two riders' plan (bike-plan.mjs): who rides, the routes stay on the lane net and off the pen's roaming range, the stands and
// bays are clear of roads and buildings, the rides follow the timetable, both bikes are home by 22:00, and the Pandora box changes nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BIKES, RIDE, routeOut, routeHome, routeLength, parkedAt, rideWanted, NODE_IDS } from '../src/bike-plan.mjs';
import { LANES, placeOf, slotOf, TRIP } from '../src/villagers.mjs';
import { RESIDENTS, WORKPLACE, CIVIC } from '../src/content.mjs';
import { staticCuts } from '../src/pen-range.mjs';
import { sharedRange, cutDistance } from './pen-sim.mjs';
const range = sharedRange(), cuts = staticCuts(), who = id => RESIDENTS.find(p => p.id === id);
const edges = new Set(LANES.edges.flatMap(([a, b]) => [a + '>' + b, b + '>' + a]));
const nodeAt = pt => LANES.ids.find(id => Math.abs(LANES.nodes[id].x - pt.x) < 1e-6 && Math.abs(LANES.nodes[id].z - pt.z) < 1e-6);
const samples = path => { const out = []; for (let i = 1; i < path.length; i++) { const a = path[i - 1], b = path[i], n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / .25); for (let k = 0; k <= n; k++) out.push({ x: a.x + (b.x - a.x) * k / n, z: a.z + (b.z - a.z) * k / n }); } return out; };

test('two bikes, two residents whose workplace is a facility, one bike each, from east houses to the Town Square', () => {
  assert.equal(BIKES.length, RIDE.riders); assert.equal(new Set(BIKES.map(b => b.rider)).size, 2); assert.equal(new Set(BIKES.map(b => b.color)).size, 2);
  for (const b of BIKES) { const p = who(b.rider); assert.ok(p && !p.child && WORKPLACE[p.id] === b.work && CIVIC.some(c => c.id === b.work), b.id); assert.ok(placeOf(p, 'home').x > 30, 'an east house'); }
});
test('routes follow the lane net only (every stretch is a lane edge), start at the stand and end at the bay, and home is the same way back', () => {
  for (const b of BIKES) {
    const out = routeOut(b), home = routeHome(b), mid = out.slice(0, -b.approach.length);
    assert.ok(mid.every(pt => nodeAt(pt)), `${b.id}: lane nodes`); for (let i = 1; i < mid.length; i++) assert.ok(edges.has(nodeAt(mid[i - 1]) + '>' + nodeAt(mid[i])), `${b.id}: edge ${i}`);
    assert.deepEqual(out.at(-1), { x: b.bay.x, z: b.bay.z }); assert.deepEqual(home.at(-1), { x: b.stand.x, z: b.stand.z }); assert.equal(home[0].x, out.at(-2).x);
    const len = routeLength(b, 'out'); assert.ok(len > 40 && len < 120, `${b.id} ${len.toFixed(0)} m`); assert.ok(Math.abs(len - routeLength(b, 'home')) < 3);
    const t = len / (RIDE.speed * .8); assert.ok(t > 6 && t < 25, `a ride takes ${t.toFixed(0)} s`);
  }
});
test('routes may share the garden lanes with animals, but avoid the pen fence and pond; parking avoids buildings', () => {
  for (const b of BIKES) {
    for (const pt of samples(routeOut(b))) { assert.ok(!range.inPen(pt.x, pt.z), `${b.id} inside the pen`); const c = cutDistance(cuts, pt.x, pt.z, ['pen', 'fence', 'pond']); assert.ok(c.d > 0 || !c.cat, `${b.id} in ${c.cat}`); }
    for (const at of [b.stand, b.bay]) { const c = cutDistance(cuts, at.x, at.z, ['building', 'tree', 'pond', 'fence', 'pen']); assert.ok(c.d > -.8, `${b.id} parking is ${c.d} from ${c.cat}`); }
  }
});
test('the day: bikes at home before 8:30 and after 16:50, at the bays in between; a ride when a rider goes the other way; never for a walk', () => {
  for (const b of BIKES) { assert.equal(parkedAt(7, b), 'home'); assert.equal(parkedAt(12, b), 'bay'); assert.equal(parkedAt(17.3, b), 'home'); assert.equal(parkedAt(22, b), 'home'); const p = who(b.rider); for (let t = 0; t < 24; t += .1) assert.equal(parkedAt(t, b) === 'bay', slotOf(p, { time: t }) !== 'home' && slotOf(p, { time: t }) !== 'yard', `${b.rider} at ${t.toFixed(1)}`); }
  for (const b of BIKES) {
    assert.equal(rideWanted(b, b.work, 'home'), 'out'); assert.equal(rideWanted(b, 'yard', 'bay'), 'home'); assert.equal(rideWanted(b, 'home', 'bay'), 'home');
    assert.equal(rideWanted(b, b.work, 'bay'), '', 'back from the market: a walk'); assert.equal(rideWanted(b, 'market', 'home'), ''); assert.equal(rideWanted(b, 'yard', 'home'), '');
    const p = who(b.rider); let rides = 0, at = 'home', last = '';
    for (let t = 0; t < 24; t += .05) { const key = slotOf(p, { time: t }); if (key === last) continue; last = key; const dir = rideWanted(b, key, at); if (dir) { rides++; at = dir === 'out' ? 'bay' : 'home'; } }
    assert.equal(rides, 2, `${b.rider} rides to work and home once each`); assert.equal(at, 'home', 'home by night');
  }
});
test('the villagers behave the same whether the Pandora box is open or shut: nothing here reads it', () => {
  for (const f of ['bike-plan.mjs', 'bike-riders.mjs', 'villagers.mjs', 'villagers-view.mjs']) assert.ok(!/pandora/i.test(readFileSync(new URL('../src/' + f, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')), f);
  assert.equal(TRIP.walkers, 4); assert.equal(TRIP.reach, 115);
  const p = who('theo'); for (const t of [0, 9, 13, 18]) assert.equal(slotOf(p, { time: t, pandora: { open: true } }), slotOf(p, { time: t, pandora: { open: false } }));
});
