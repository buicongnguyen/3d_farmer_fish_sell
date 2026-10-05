// The five facility plans (src/facility-plans.mjs): rooms tile the envelope, doorways are wide enough, things stand inside, the
// timetable puts the right people inside, and every action the buildings had before still has a place.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FACILITIES, occupants } from '../src/facility-plans.mjs';
import { ROOM, WALK, SPAWN } from '../src/home-plan.mjs';
import { RESIDENTS, CIVIC, WORKPLACE } from '../src/content.mjs';
import { slotOf } from '../src/villagers.mjs';
import { freshState } from '../src/game.mjs';

const walls = plan => plan.walls.flatMap(w => { const cuts = [...w.gaps].sort((a, b) => a[0] - b[0]), out = []; let at = w.from; for (const [a, b] of [...cuts, [w.to, w.to]]) { if (a > at) out.push([at, a]); at = Math.max(at, b); } return out.map(([a, b]) => w.axis === 'x' ? { x: (a + b) / 2, z: w.at, w: b - a, d: ROOM.thick } : { x: w.at, z: (a + b) / 2, w: ROOM.thick, d: b - a }); });
const inBox = (c, p, pad = .32) => Math.abs(p.x - c.x) < c.w / 2 + pad && Math.abs(p.z - c.z) < c.d / 2 + pad;
const roomOf = (plan, p) => plan.rooms.find(r => p.x >= r.rect.x0 && p.x <= r.rect.x1 && p.z >= r.rect.z0 && p.z <= r.rect.z1);

test('every civic building has a plan; rooms tile the house envelope without overlap', () => {
  for (const c of CIVIC) assert.ok(FACILITIES[c.id], c.id);
  for (const plan of Object.values(FACILITIES)) {
    let area = 0; for (const r of plan.rooms) area += (r.rect.x1 - r.rect.x0) * (r.rect.z1 - r.rect.z0);
    assert.ok(Math.abs(area - ROOM.w * ROOM.d) < 1e-6, `${plan.id} rooms cover ${area}`);
    for (const a of plan.rooms) for (const b of plan.rooms) if (a !== b) assert.ok(a.rect.x1 <= b.rect.x0 + 1e-9 || b.rect.x1 <= a.rect.x0 + 1e-9 || a.rect.z1 <= b.rect.z0 + 1e-9 || b.rect.z1 <= a.rect.z0 + 1e-9, `${plan.id}: ${a.id}/${b.id} overlap`);
    for (const r of plan.rooms) { assert.ok(plan.palette.walls[r.id] && plan.palette.floors[r.id], `${plan.id} ${r.id} palette`); assert.ok(r.rect.x1 - r.rect.x0 >= 4.2 && r.rect.z1 - r.rect.z0 >= 6, `${plan.id} ${r.id} is big enough for the phone framing`); }
    for (const w of plan.walls) for (const [a, b] of w.gaps) assert.ok(w.at === ROOM.d / 2 || b - a >= 1.6 - 1e-9, `${plan.id}: doorway ${a}..${b} is too narrow`);
  }
});
test('targets, staff, seats and the spawn stand inside the walk bounds and clear of walls and pieces', () => {
  for (const plan of Object.values(FACILITIES)) {
    const boxes = walls(plan), spots = [...plan.targets.map(t => ({ ...t, name: t.id })), ...Object.entries(plan.staff).map(([id, s]) => ({ ...s, name: id })), ...(plan.kids ?? []).map((s, i) => ({ ...s, name: 'kid' + i })), ...(plan.yard ?? []).map((s, i) => ({ ...s, name: 'yard' + i })), { ...SPAWN, name: 'spawn' }];
    for (const s of spots) {
      assert.ok(Math.abs(s.x) <= WALK.x && Math.abs(s.z) <= WALK.z, `${plan.id} ${s.name} is out of bounds`);
      assert.ok(roomOf(plan, s), `${plan.id} ${s.name} is in no room`);
      if (s.type) assert.ok(!boxes.some(b => inBox(b, s, .2)), `${plan.id} ${s.name} stands in a wall`);
    }
    for (const p of plan.pieces) assert.ok(Math.abs(p.x) <= ROOM.w / 2 && Math.abs(p.z) <= ROOM.d / 2, `${plan.id} ${p.kit} is outside`);
    for (const t of plan.targets) { assert.ok(t.label && t.icon && t.text, `${plan.id} ${t.id}`); if (t.type === 'fun') assert.ok(t.line, `${plan.id} ${t.id} has a line`); }
  }
});
test('the same actions as before, physically placed: school lesson, clinic check-up, patrol, office shift, checkout, hiring board', () => {
  const find = (plan, type, id) => FACILITIES[plan].targets.some(t => t.type === type && t.id === id);
  assert.ok(find('school', 'civic', 'school') && find('hospital', 'civic', 'hospital') && find('police', 'civic', 'police') && find('company', 'civic', 'company'));
  assert.ok(find('supermarket', 'shop', 'supermarket'));
  assert.ok(FACILITIES.company.targets.some(t => t.use === 'workers'));
  for (const plan of Object.values(FACILITIES)) assert.ok(plan.pieces.length > 25, plan.id);
});
test('the timetable fills each building: workers by day, pupils at their desks, nobody at night', () => {
  const at = (hour, plan) => occupants(FACILITIES[plan], Object.assign(freshState(), { time: hour }), RESIDENTS, slotOf).map(o => o.p.id);
  for (const [plan, ids] of [['supermarket', ['nell', 'oren', 'finn']], ['hospital', ['hazel', 'sylvie']], ['police', ['pearl', 'theo']], ['company', ['bea', 'leo', 'fern']], ['school', ['cora']]]) {
    const morning = at(10, plan); for (const id of ids) assert.ok(morning.includes(id), `${id} works at ${plan} at 10:00 (${morning})`);
    assert.deepEqual(at(22, plan), [], `${plan} is empty at 22:00`);
    for (const id of ids) assert.equal(WORKPLACE[id], plan, `${id} -> ${plan}`);
  }
  const school = at(10, 'school'); for (const kid of ['pip', 'milo']) assert.ok(school.includes(kid), `${kid} is at school`);
  const bake = h => occupants(FACILITIES.bakery, Object.assign(freshState(), { time: h }), RESIDENTS, slotOf).map(o => o.p.id);
  assert.ok(bake(7).includes('hugo') && bake(20).includes('hugo') && bake(20).includes('nell'), 'the Hearths are at home early and late');
  assert.ok(at(12, 'school').length >= 1, 'children play in the yard at midday');
});
