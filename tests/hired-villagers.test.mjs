import test from 'node:test';
import assert from 'node:assert/strict';
import { RESIDENTS, JOBS } from '../src/content.mjs';
import { freshState, act, parseSave } from '../src/game.mjs';
import { placeOf, slotOf, jobRank, lanePath, LANES } from '../src/villagers.mjs';
import { blockedAt, firstBlock } from '../src/village-plan.mjs';
import { walkPerson } from '../src/village-walk.mjs';
import { BIKES, rideWanted } from '../src/bike-plan.mjs';

const adults = RESIDENTS.filter(p => p.home > 0 && !p.child);
const gap = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

test('every hired role has distinct reachable stations, including a whole group of helpers', () => {
  for (const job of Object.keys(JOBS)) {
    const s = freshState(); s.time = 10; s.hired = Object.fromEntries(adults.map(p => [p.id, job]));
    const spots = [];
    for (const [i, p] of adults.entries()) {
      assert.equal(slotOf(p, s), 'job:' + job); assert.equal(jobRank(p, s), i);
      const at = placeOf(p, slotOf(p, s), s);
      assert.equal(at.inside, false); assert.equal(blockedAt(at.x, at.z), false, `${job}: ${p.name} stands outside obstacles`);
      assert.equal(firstBlock(LANES.nodes[at.via], at), null, `${job}: ${p.name} can reach the station`);
      for (const earlier of spots) assert.ok(gap(earlier, at) >= 1.8 - 1e-9, `${job}: helpers have room to pass`);
      spots.push(at);
    }
    const loaded = parseSave(JSON.parse(JSON.stringify(s)));
    assert.deepEqual(adults.map(p => placeOf(p, slotOf(p, loaded), loaded)), spots, 'a reload keeps station assignments');
    delete s.hired[adults[0].id]; assert.equal(jobRank(adults[1], s), 0, 'a released helper frees a station');
  }
});

test('work hours and assignment changes preserve morning wages and ordinary routines', () => {
  const p = adults[0], s = freshState(); s.coins = 1000; s.time = 10; s.met[p.id] = true;
  const normal = slotOf(p, s), before = s.coins;
  assert.equal(act(s, 'hire', { id: p.id, job: 'fisher' }).ok, true);
  assert.equal(s.coins, before - JOBS.fisher.wage); assert.equal(slotOf(p, s), 'job:fisher');
  act(s, 'sleep'); assert.equal(s.coins, before - JOBS.fisher.wage * 2);
  assert.equal(s.inventory.perch, 2); assert.equal(s.inventory.carp, 1);
  assert.ok(!slotOf(p, s).startsWith('job:'), 'the workday has not begun at 7am');
  s.time = 10; assert.equal(slotOf(p, s), 'job:fisher');
  act(s, 'release', { id: p.id }); assert.equal(slotOf(p, s), slotOf(p, Object.assign(freshState(), { time: 10, day: s.day })));
  s.hired[p.id] = 'fisher'; s.coins = 0; act(s, 'sleep'); s.time = 10;
  assert.equal(s.hired[p.id], undefined); assert.equal(slotOf(p, s), slotOf(p, Object.assign(freshState(), { time: 10, day: s.day })), 'unpaid helpers return to their usual routine (the day turns whom they call on: villagers.mjs CALLS)');
  assert.equal(s.inventory.perch, 2, 'unpaid work does not grant extra produce');
  for (const bike of BIKES) assert.equal(rideWanted(bike, 'job:fisher', 'home'), '', 'a farm assignment does not start an obsolete workplace commute');
});

test('shoppers can pass a busy market, arrive, and leave without overlapping', () => {
  // Six approaching villagers and seventeen shoppers already at their places. The former 0.95m rows
  // occupied the shared lane node and left several arrivals circling or stopped indefinitely.
  const people = RESIDENTS.map((p, i) => {
    const goal = placeOf(p, 'market'), position = i < 6 ? { x: -3, z: 26 + i * 1.1 } : { x: goal.x, z: goal.z };
    return { p, mesh: { visible: true, position }, goal, path: i < 6 ? lanePath(position, goal) : [] };
  });
  const world = { npcs: people, player: { position: { x: 100, z: 100 } }, blocked: blockedAt };
  const advance = () => {
    for (let frame = 0; frame < 1200 && people.some(n => n.path.length); frame++) {
      for (const n of people) {
        if (!n.path.length) continue;
        const at = n.mesh.position, next = n.path[0], dx = next.x - at.x, dz = next.z - at.z, d = Math.hypot(dx, dz);
        if (d < .25) n.path.shift(); else walkPerson(world, n, dx, dz, Math.min(.13, d));
      }
      for (let i = 0; i < people.length; i++) for (let j = i + 1; j < people.length; j++) assert.ok(gap(people[i].mesh.position, people[j].mesh.position) >= .85 - 1e-8, 'personal space is retained');
    }
    assert.ok(people.every(n => !n.path.length), 'every walker reaches the destination within one minute');
  };
  advance();
  for (const n of people.slice(0, 6)) n.path = lanePath({ ...n.mesh.position, via: 'row1' }, placeOf(n.p, 'yard'));
  advance();
});
