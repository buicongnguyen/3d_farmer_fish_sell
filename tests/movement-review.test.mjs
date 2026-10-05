import test from 'node:test';
import assert from 'node:assert/strict';
import { peopleClear, walkPerson } from '../src/village-walk.mjs';
import { BikeRiders } from '../src/bike-riders.mjs';
import { BIKES } from '../src/bike-plan.mjs';
import { DriveView } from '../src/drive-view.mjs';
import { BLOCKS, livingTrees } from '../src/village-plan.mjs';
import { beyondVillage, CAMERA_YAW } from '../src/field-layout.mjs';
import * as T from 'three';

const person = (x, z) => ({ mesh: { visible: true, position: { x, z } } });
const world = people => ({ npcs: people, player: { position: { x: 30, z: 30 } }, blocked: () => false });

test('walkers pass head-on and walk around a stationary player without overlapping', () => {
  const a = person(0, -4), b = person(0, 4), w = world([a, b]);
  for (let i = 0; i < 180; i++) {
    if (a.mesh.position.z < 4) walkPerson(w, a, -a.mesh.position.x, 4 - a.mesh.position.z, .1);
    if (b.mesh.position.z > -4) walkPerson(w, b, -b.mesh.position.x, -4 - b.mesh.position.z, .1);
    assert.ok(Math.hypot(a.mesh.position.x - b.mesh.position.x, a.mesh.position.z - b.mesh.position.z) >= .85 - 1e-9);
  }
  assert.ok(a.mesh.position.z > 3.8 && b.mesh.position.z < -3.8, 'both pass and finish');
  a.mesh.position.x = 0; a.mesh.position.z = -4; b.inside = true; w.player.position = { x: 0, z: 0 };
  for (let i = 0; i < 140; i++) { walkPerson(w, a, -a.mesh.position.x, 4 - a.mesh.position.z, Math.min(.1, Math.hypot(a.mesh.position.x, 4 - a.mesh.position.z))); assert.ok(Math.hypot(a.mesh.position.x, a.mesh.position.z) >= .9 - 1e-9); }
  assert.ok(a.mesh.position.z > 3.8, 'passes the player');
});

test('player movement stops before a resident, but an overlap can escape', () => {
  const n = person(0, 0), w = world([n]); w.player.position = { x: 0, z: -1 };
  assert.equal(peopleClear(w, null, 0, -.85), false);
  w.player.position.z = -.3;
  assert.equal(peopleClear(w, null, 0, -.4), true);
  assert.equal(peopleClear(w, null, 0, -.2), false);
  n.inside = true; assert.equal(peopleClear(w, null, 0, -.2), true);
});

test('walkers cannot sidestep into a wall while avoiding a person', () => {
  const n = person(0, -1), w = world([n]); w.player.position = { x: 0, z: 0 }; w.blocked = (x, z) => Math.abs(x) > .02;
  for (let i = 0; i < 100; i++) walkPerson(w, n, 0, 10, .1);
  assert.ok(n.mesh.position.z <= -.9 && Math.abs(n.mesh.position.x) <= .02);
});

test('bikes keep clearance for as long as a player or animal blocks them, then resume', () => {
  for (const animal of [false, true]) {
    const n = person(0, 0), blocker = { x: 0, z: 1.6 }, w = world([n]);
    if (animal) w.pen = { animals: [{ shown: true, walker: blocker }] }; else w.player.position = blocker;
    const m = { position: { x: 0, z: 0 }, rotation: { y: 0, z: 0 } }, b = { mesh: m, route: [{ x: 0, z: 100 }], i: 0, speed: 8, pose() {}, seatSpot() { return m.position; } };
    n.ride = { bike: b, phase: 'ride' }; const view = { view: { world: w }, bikes: [b], ahead: BikeRiders.prototype.ahead };
    for (let i = 0; i < 400; i++) { BikeRiders.prototype.ride.call(view, n, .05); assert.ok(m.position.z <= .2 + 1e-9, 'no creep or braking overshoot through the obstacle'); }
    assert.ok(b.speed < .01);
    blocker.x = 20; for (let i = 0; i < 40; i++) BikeRiders.prototype.ride.call(view, n, .05);
    assert.ok(m.position.z > 6 && b.speed > 7, 'continues once the lane clears');
  }
});

test('sleeping during a commute parks the bike and clears the previous day’s rider pose', () => {
  const mesh = new T.Group(); mesh.userData.parts = Object.fromEntries(['leg_l', 'leg_r', 'arm_l', 'arm_r'].map(k => [k, new T.Group()]));
  mesh.rotation.set(.2, 1, .1); mesh.position.y = 1; mesh.userData.parts.leg_l.rotation.z = .4;
  const n = { mesh, ride: { busy: true }, trip: {}, goalKey: 'police', path: [{ x: 1, z: 1 }] };
  const b = { def: BIKES[0], rider: n, phase: 'ride', at: 'home', speed: 8, park(spot) { this.spot = spot; } };
  const view = { day: 1, bikes: [b], light() {} }; BikeRiders.prototype.tick.call(view, 7, 2);
  assert.equal(n.ride, null); assert.equal(n.goalKey, ''); assert.equal(n.trip, null); assert.equal(mesh.position.y, 0); assert.equal(mesh.userData.parts.leg_l.rotation.z, 0);
  assert.equal(b.phase, 'parked'); assert.equal(b.speed, 0); assert.equal(b.spot, BIKES[0].stand);
});

test('opposing bikes pull aside and pass instead of waiting forever or crossing each other', () => {
  const riders = [person(0, -5), person(0, 5)], w = world(riders), bikes = riders.map((n, i) => {
    const mesh = { position: { ...n.mesh.position }, rotation: { y: i ? Math.PI : 0, z: 0 } };
    const bike = { def: { id: String(i) }, mesh, phase: 'ride', route: [{ x: 0, z: i ? -100 : 100 }], i: 0, speed: 8, pose() {}, seatSpot() { return mesh.position; } }; n.ride = { bike, phase: 'ride' }; return bike;
  });
  const view = { view: { world: w }, bikes, ahead: BikeRiders.prototype.ahead }; let nearest = Infinity;
  for (let i = 0; i < 500; i++) { for (const n of riders) BikeRiders.prototype.ride.call(view, n, .02); nearest = Math.min(nearest, Math.hypot(bikes[0].mesh.position.x - bikes[1].mesh.position.x, bikes[0].mesh.position.z - bikes[1].mesh.position.z)); }
  assert.ok(nearest >= 1.4 - 1e-6, `safe passing gap ${nearest}`);
  assert.ok(bikes[0].mesh.position.z > 10 && bikes[1].mesh.position.z < -10, 'both continue on their routes');
});

test('a passing bike checks its return to the lane and never detours toward a waypoint behind it', () => {
  for (const behind of [false, true]) {
    const n = person(0, 0), w = world([n]); w.blocked = (x, z) => x > .8 && x < 1.4 && z > 4.7 && z < 5.3;
    const mesh = { position: { x: 0, z: 0 }, rotation: { y: 0, z: 0 } }, bike = { def: { id: '1' }, mesh, phase: 'ride', route: [{ x: 0, z: behind ? -20 : 20 }], i: 0, speed: 0, pose() {}, seatSpot() { return mesh.position; } };
    const other = { def: { id: '0' }, phase: 'ride', mesh: { position: { x: 0, z: 7 }, rotation: { y: Math.PI } } }; n.ride = { bike, phase: 'ride' };
    const view = { view: { world: w }, bikes: [bike, other], ahead: BikeRiders.prototype.ahead };
    for (let i = 0; i < 10; i++) BikeRiders.prototype.ride.call(view, n, .02);
    assert.equal(bike.route.length, 1, behind ? 'does not add repeated detours when the route goal is behind' : 'obstacle intersects only the return segment, so passing is rejected');
    assert.equal(bike.passing, false);
  }
});

test('a shove exactly onto a recovery waypoint never corrupts the vehicle position', () => {
  const w = { bounds: { x: 5000, z: 5000 }, colliders: [], location: 'village', path: [], player: { position: { x: 0, z: 0 } }, addTreeBlock() {}, removeTreeBlock() {}, riding: { id: 'jeep', mesh: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1 } } } };
  const view = new DriveView(w); view.board(w.riding); view.escapeWatch = { x: 0, z: 0, angle: 0, t: 0, bumps: 0 }; view.escape = [{ x: 0, z: 0 }, { x: 0, z: 2 }];
  view.step(0, 1, .05); assert.equal(view.escape.length, 1); assert.equal(w.riding.mesh.position.x, 0); assert.equal(w.riding.mesh.position.z, 0);
  view.step(0, 1, .05); assert.ok(w.riding.mesh.position.z > 0 && Number.isFinite(w.riding.mesh.position.x));
});

test('jeep recovers from the clinic and school tree corners without crossing any obstacle', () => {
  for (const [x, z, key] of [[-26, -31, 1], [-26, -31, 2], [-54, -45, 2], [-40, -31, 2]]) {
    const w = { bounds: { x: 5000, z: 5000 }, colliders: BLOCKS.map(b => ({ ...b, location: 'village' })), location: 'village', path: [], player: { position: { x, z } }, addTreeBlock() {}, removeTreeBlock() {}, riding: { id: 'jeep', mesh: { position: { x: x + .13, y: 0, z: z + .29 }, rotation: { x: 0, y: key * Math.PI / 4 + 1, z: 0 }, scale: { x: 1 } } } };
    const view = new DriveView(w); view.board(w.riding); for (const t of livingTrees()) w.addTreeBlock({ x: t.x, z: t.z, r: .42 * t.s });
    const a = key * Math.PI / 4, dx = Math.sin(a) * Math.cos(CAMERA_YAW) - Math.cos(a) * Math.sin(CAMERA_YAW), dz = -Math.sin(a) * Math.sin(CAMERA_YAW) - Math.cos(a) * Math.cos(CAMERA_YAW), p = w.riding.mesh.position;
    let recovered = false;
    for (let i = 0; i < 3600 && beyondVillage(p.x, p.z) < 30; i++) { view.step(dx, dz, 1 / 60); recovered ||= !!view.escape?.length; assert.equal(view.blocked(p.x, p.z, w.riding.spec), false); }
    assert.ok(recovered, 'exercises the recovery route'); assert.ok(beyondVillage(p.x, p.z) >= 30, `leaves the corner from ${x},${z},${key}`);
  }
});
