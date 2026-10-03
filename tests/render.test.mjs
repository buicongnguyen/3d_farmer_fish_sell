// Round 7, the pure parts: the creature drawing's two-threshold rules and the glide between simulation steps
// (creature-lod.mjs, wilds.mjs), the shadow box and its texel snap (sun-shadow.mjs), the vehicle's heading and speed
// (drive.mjs, drive-view.mjs) and the pen animals' roaming (pen-roam.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { LOD, nearLook, inView, castsShadow, walking, ease, turnToward, shadowReach, cellRadius } from '../src/creature-lod.mjs';
import { Wilds, STEP, glideShare, GLIDE_MAX, wildCell, CREATURES, inSafeZone, WILD_CELL } from '../src/wilds.mjs';
import { SUN_OFFSET, SHADOW, SHADOW_UP, lightAxes, viewVolume, roomVolume, shadowBox, texelSize, snapTarget, texelOf, fitShadow, followSun, shadowMapSize } from '../src/sun-shadow.mjs';
import { VEHICLES, WALK_SPEED, ROUTE_CRAWL, newDrive, stepDrive, openLimit, turnRate, targetSpeed, routeSpeed, glance, bump, turnBetween, subSteps, arrivalSpeed, driveZoom, lookAhead, DRIVE_CAMERA } from '../src/drive.mjs';
import { fieldPlan } from '../src/field-layout.mjs';
import { DriveView } from '../src/drive-view.mjs';
import { PEN, PEN_PROPS, PEN_ROSTER, penShown, penArea, newRoamer, spawnSpot, stepRoamer, roamRadius, spacing, callToTrough } from '../src/pen-roam.mjs';

const seeded = (seed = 7) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// ---------------------------------------------------------------- 1. creatures
test('level of detail, culling, shadows and walking each keep their state between two thresholds', () => {
  assert.equal(nearLook(false, 15.9), true); assert.equal(nearLook(false, 16.1), false);
  assert.equal(nearLook(true, 19.9), true, 'near stays near until 20 m'); assert.equal(nearLook(true, 20.1), false);
  // A creature drifting to and fro across 16 m (the old single threshold flipped on every crossing) switches once.
  let near = false, flips = 0; for (let i = 0; i < 400; i++) { const d = 16 + Math.sin(i * .3) * 1.5, next = nearLook(near, d); if (next !== near) flips++; near = next; }
  assert.equal(flips, 1);
  assert.equal(inView(false, 46.5, 46), false); assert.equal(inView(true, 46.5, 46), true); assert.equal(inView(true, 46 + LOD.hide + .1, 46), false);
  assert.equal(castsShadow(false, 30, 34), true); assert.equal(castsShadow(true, 37, 34), true); assert.equal(castsShadow(true, 39, 34), false);
  assert.equal(walking(false, .2), false); assert.equal(walking(false, .4), true); assert.equal(walking(true, .2), true); assert.equal(walking(true, .1), false);
  assert.ok(Math.abs(ease(0, 1, 10, .1) - (1 - Math.exp(-1))) < 1e-12); assert.equal(ease(3, 3, 9, .1), 3);
  assert.ok(Math.abs(turnToward(0, 3, 5, .1) - .5) < 1e-12, 'at most rate x dt'); assert.equal(turnToward(0, .2, 5, .1), .2); assert.ok(turnToward(3, -3, 5, .01) > 3, 'the short way round');
  assert.equal(shadowReach(24, 23.3), Math.hypot(24, 23.3) + 2); assert.equal(shadowReach(5, 5), 20); assert.equal(shadowReach(70, 70), 40);
  assert.equal(cellRadius(46), 2); assert.equal(cellRadius(60), 3); assert.equal(cellRadius(99), 4); assert.equal(cellRadius(400), 4);
});

test('a calm creature far away is drawn gliding between its 100 ms moves: no still frames, no jumps', () => {
  const wilds = new Wilds({}, seeded(3));
  // A spot in the meadows with creatures near; the player stands where none of them can see them.
  let spot = null; for (let x = 90; x < 400 && !spot; x += 8) for (let z = -200; z < 200 && !spot; z += 8) { if (inSafeZone(x, z)) continue; wilds.sync(true, x, z); const calm = wilds.list.filter(e => e.def.speed > 0 && Math.hypot(e.x - x, e.z - z) > e.def.sight + 3 && Math.hypot(e.x - x, e.z - z) < 40); if (calm.length >= 2 && wilds.list.every(e => Math.hypot(e.x - x, e.z - z) > e.def.sight + 3)) spot = { x, z }; }
  assert.ok(spot, 'a calm spot exists');
  wilds.sync(true, spot.x, spot.z); const hero = { x: spot.x, z: spot.z, active: true };
  for (let i = 0; i < 80; i++) wilds.step(STEP, hero);
  const movers = wilds.list.filter(e => e.def.speed > 0 && e.phase === 'idle' && !e.resting && Math.hypot(e.x - spot.x, e.z - spot.z) < 46); assert.ok(movers.length >= 2);
  // 60 frames a second against 40 steps a second, as in the browser: the drawn place, frame by frame.
  const frame = 1 / 60, drawn = new Map(movers.map(e => [e, []])), raw = new Map(movers.map(e => [e, []])); let acc = 0;
  for (let f = 0; f < 600; f++) {
    acc += frame; while (acc >= STEP - 1e-9) { acc -= STEP; wilds.step(STEP, hero); }
    for (const e of movers) { const k = glideShare(e, wilds.time + acc); drawn.get(e).push([e.px + (e.x - e.px) * k, e.pz + (e.z - e.pz) * k]); raw.get(e).push([e.x, e.z]); }
  }
  let wanderers = 0;
  for (const e of movers) {
    const steps = list => list.slice(1).map((p, i) => Math.hypot(p[0] - list[i][0], p[1] - list[i][1])), d = steps(drawn.get(e)), s = steps(raw.get(e)), moved = s.filter(v => v > 0);
    if (moved.length < 20) continue; wanderers++;
    // The simulation itself: mostly still, then a jump of up to 6 cm (0.6 m/s x 0.1 s).
    assert.ok(s.filter(v => v === 0).length > s.length * .5, `${e.type}: simulated places stand still on most frames`); assert.ok(Math.max(...s) > .04);
    // Drawn: no frame jumps more than a walk at 0.6 m/s covers in a frame and a half.
    assert.ok(Math.max(...d) < .6 * frame * 1.6, `${e.type}: drawn step ${Math.max(...d).toFixed(4)} m`);
    assert.ok(d.filter(v => v === 0).length < s.filter(v => v === 0).length * .5, `${e.type}: it keeps moving between simulation steps`);
    for (const p of drawn.get(e)) assert.ok(Number.isFinite(p[0]) && Number.isFinite(p[1]));
  }
  assert.ok(wanderers >= 1, 'at least one wanderer was followed');
  // A respawn is a jump, not a walk: it is not glided.
  const e = movers[0]; e.hp = 0; e.respawn = 0; e.x += 9; hero.x = e.homeX + 60; wilds.step(STEP, hero); assert.equal(e.hp, e.maxHp); assert.equal(glideShare(e, wilds.time), 1); assert.equal(e.px, e.x);
  assert.ok(GLIDE_MAX > 13 * STEP * 4, 'a charge is still a walk');
});

test('the creature window widens for a camera zoomed far out, and every creature in it is the seeded one', () => {
  const wilds = new Wilds({}, seeded(1)); wilds.sync(true, 200, 40); assert.equal(wilds.cells.size, 25);
  wilds.sync(true, 200, 40, 4); assert.equal(wilds.cells.size, 81); const ids = new Set(wilds.list.map(e => e.id)); assert.equal(ids.size, wilds.list.length, 'no creature twice');
  const cx = Math.floor(200 / WILD_CELL), cz = Math.floor(40 / WILD_CELL); for (const plan of wildCell(cx + 4, cz - 4)) assert.ok(ids.has(plan.id));
  wilds.sync(true, 200, 40, 2); assert.equal(wilds.cells.size, 25); assert.ok(wilds.list.length < ids.size);
  assert.ok(Object.keys(CREATURES).length >= 9);
});

// ---------------------------------------------------------------- 2. the sun
test('the shadow camera axes are the ones three.js builds, and the box holds everything the camera can see', () => {
  const axes = lightAxes(); for (const a of [axes.x, axes.y, axes.z]) assert.ok(Math.abs(Math.hypot(...a) - 1) < 1e-12);
  assert.ok(Math.abs(dot(axes.x, axes.y)) < 1e-12 && Math.abs(dot(axes.x, axes.z)) < 1e-12 && Math.abs(dot(axes.y, axes.z)) < 1e-12);
  const length = Math.hypot(...SUN_OFFSET); assert.ok(Math.abs(axes.z[0] - SUN_OFFSET[0] / length) < 1e-12 && axes.z[1] > .7, 'z points back to the sun');
  // Matrix4.lookAt: x = up x z (normalised), y = z x x.
  const up = SHADOW_UP, cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], x = cross(up, axes.z), l = Math.hypot(...x);
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(axes.x[i] - x[i] / l) < 1e-12);
  for (const [w, h] of [[24, 15], [9.36, 20.25], [32.5, 15], [67.2, 42], [9.6, 6], [26.2, 56.7], [34.8, 21.75]]) {
    const points = viewVolume(w, h), box = shadowBox(points, axes);
    for (const p of points) { const a = dot(p, axes.x), b = dot(p, axes.y), depth = box.distance - dot(p, axes.z); assert.ok(a >= box.left + SHADOW.margin - 1e-9 && a <= box.right - SHADOW.margin + 1e-9 && b >= box.bottom + SHADOW.margin - 1e-9 && b <= box.top - SHADOW.margin + 1e-9, `${w}x${h}: a view corner lies in the box`); assert.ok(depth > box.near && depth < box.far, 'between near and far'); }
    // Anything up to 10 m tall between a point in view and the sun is inside too.
    for (const p of points) { const lift = (SHADOW.height - p[1]) / axes.z[1], caster = [p[0] + axes.z[0] * lift, SHADOW.height, p[2] + axes.z[2] * lift], depth = box.distance - dot(caster, axes.z); assert.ok(depth >= box.near, `a caster above a view corner is beyond the near plane (${depth.toFixed(1)})`); }
    for (const edge of [box.left, box.right, box.bottom, box.top]) assert.ok(Math.abs(edge / SHADOW.step - Math.round(edge / SHADOW.step)) < 1e-9, 'edges on the 4 m grid');
    // The box hugs the view: smaller than the old fixed 96 x 96 m at the usual zooms.
    if (h <= 21) assert.ok((box.right - box.left) * (box.top - box.bottom) < 96 * 96 * .75, `${w}x${h}: ${(box.right - box.left)} x ${(box.top - box.bottom)}`);
  }
  // A small zoom step keeps the box (it is rounded to the grid), so pinching does not re-cut the shadows every frame.
  assert.deepEqual(shadowBox(viewVolume(24, 15), axes), shadowBox(viewVolume(24.2, 15.12), axes));
  const room = shadowBox(roomVolume(11.3, 9.9, 5), axes, { height: 5 }); assert.ok(room.right - room.left <= 40 && room.top - room.bottom <= 40);
  assert.equal(shadowMapSize('high'), 2048); assert.equal(shadowMapSize('balanced'), 1024); assert.equal(shadowMapSize('battery'), 0);
});

test('the sun looks at whole shadow texels, so a point on the ground keeps its place in the shadow map while the camera moves', () => {
  const axes = lightAxes(), box = shadowBox(viewVolume(24, 15), axes), [tx, ty] = texelSize(box, 1024), random = seeded(11), still = [37.25, 0, -12.5], phases = [];
  for (let i = 0; i < 400; i++) {
    const x = (random() - .5) * 6000, z = (random() - .5) * 6000, t = snapTarget(x, 0, z, axes, tx, ty);
    const a = dot(t, axes.x) / tx, b = dot(t, axes.y) / ty; assert.ok(Math.abs(a - Math.round(a)) < 1e-6 && Math.abs(b - Math.round(b)) < 1e-6, 'on the texel grid');
    assert.ok(Math.abs(dot([t[0] - x, t[1], t[2] - z], axes.x)) <= tx / 2 + 1e-9 && Math.abs(dot([t[0] - x, t[1], t[2] - z], axes.y)) <= ty / 2 + 1e-9, 'moved by half a texel at most');
    assert.ok(Math.abs(dot([t[0] - x, t[1], t[2] - z], axes.z)) < 1e-9, 'not along the light');
    const at = texelOf(still, t, box, axes, 1024); phases.push([at[0] - Math.floor(at[0]), at[1] - Math.floor(at[1])]);
  }
  for (const p of phases) assert.ok(Math.abs(p[0] - phases[0][0]) < 1e-5 && Math.abs(p[1] - phases[0][1]) < 1e-5, 'the same fraction of a texel from every camera place');
  // Without the snap (what the game did before) the fraction wanders over the whole texel.
  const free = []; for (let i = 0; i < 50; i++) { const at = texelOf(still, [i * .037, 0, 0], box, axes, 1024); free.push(at[0] - Math.floor(at[0])); }
  assert.ok(Math.max(...free) - Math.min(...free) > .5);
});

test('fitting and following a light: the box, biases from the texel size, the sun on its own direction', () => {
  const camera = { left: 0, right: 0, top: 0, bottom: 0, near: 0, far: 0, up: { set(x, y, z) { this.v = [x, y, z]; } }, updates: 0, updateProjectionMatrix() { this.updates++; } };
  const set = function (x, y, z) { this.x = x; this.y = y; this.z = z; }, light = { shadow: { camera, bias: 0, normalBias: 0, radius: 0 }, position: { set }, target: { position: { set } } };
  const box = fitShadow(light, { halfWidth: 24, halfHeight: 15 }, 1024);
  assert.equal(camera.updates, 1); assert.deepEqual(camera.up.v, SHADOW_UP); assert.equal(camera.left, box.left); assert.equal(camera.far, box.far);
  assert.ok(light.shadow.bias < 0 && Math.abs(light.shadow.bias * (box.far - box.near) + SHADOW.depthBias) < 1e-12, 'the same depth in metres whatever the box');
  assert.ok(Math.abs(light.shadow.normalBias - Math.max(...box.texel) * SHADOW.normalTexels) < 1e-12);
  followSun(light, box, 12.34, -56.78); const axes = lightAxes(), t = light.target.position, s = light.position;
  assert.ok(Math.abs(Math.hypot(s.x - t.x, s.y - t.y, s.z - t.z) - box.distance) < 1e-9);
  assert.ok(Math.abs((s.x - t.x) / box.distance - axes.z[0]) < 1e-9 && Math.abs((s.y - t.y) / box.distance - axes.z[1]) < 1e-9);
  assert.ok(Math.hypot(t.x - 12.34, t.z + 56.78) < Math.hypot(...box.texel));
  const high = fitShadow(light, { halfWidth: 24, halfHeight: 15 }, 2048); assert.ok(Math.abs(high.texel[0] * 2 - box.texel[0]) < 1e-12, 'twice the map, half the texel');
  const room = fitShadow(light, { room: [11.3, 9.9, 5] }, 1024); assert.equal(room.fixed, true); followSun(light, room, 0, 0); assert.equal(light.target.position.x, 0);
});

// ---------------------------------------------------------------- 4 and 5. vehicles
test('a vehicle drives nose first, steers at a limited rate and never reverses', () => {
  for (const id of ['jeep', 'bike']) {
    const spec = VEHICLES[id], d = newDrive(0), dt = 1 / 60; let x = 0, z = 0;
    // The stick points east (+x) while the nose points south (+z): it turns towards east, moving along its nose all the while.
    let biggest = 0;
    for (let i = 0; i < 240; i++) { const before = d.heading, travel = stepDrive(d, spec, 1, 0, dt, 500); assert.ok(travel >= 0, 'never backwards'); x += Math.sin(d.heading) * travel; z += Math.cos(d.heading) * travel; biggest = Math.max(biggest, Math.abs(turnBetween(before, d.heading)) / dt); }
    assert.ok(Math.abs(turnBetween(d.heading, Math.PI / 2)) < .01, `${id} ends heading east`); assert.ok(x > 20 && z > 0 && z < 12, `${id} went east in an arc (${x.toFixed(1)}, ${z.toFixed(1)})`);
    assert.ok(biggest <= spec.turn + 1e-9 && biggest > 1, `${id}: no snap (${biggest.toFixed(2)} rad/s at most)`);
    // Stick pulled right back at top speed: a U-turn at full speed, round in well under two seconds, nose first all the way.
    const from = d.heading; let frames = 0, slowest = Infinity, fastest = 0, last = d.speed; while (Math.abs(turnBetween(d.heading, from + Math.PI)) > .05 && frames < 600) { const before = d.heading; stepDrive(d, spec, -1, 0, dt, 500); slowest = Math.min(slowest, d.speed); fastest = Math.max(fastest, Math.abs(turnBetween(before, d.heading)) / dt); frames++; assert.ok(d.speed >= last, `${id}: a U-turn takes no speed off`); last = d.speed; }
    assert.ok(frames < (id === 'bike' ? 60 : 90), `${id} turns round in ${(frames / 60).toFixed(2)} s`); assert.ok(slowest > spec.top * .85 && d.speed === spec.top, `${id}: flat out through the U-turn (${slowest.toFixed(1)} m/s at the least)`); assert.ok(fastest <= spec.turn + 1e-9);
    // No input: it brakes to a stop and stays where it points.
    const heading = d.heading; for (let i = 0; i < 200; i++) stepDrive(d, spec, 0, 0, dt, 500); assert.equal(d.speed, 0); assert.equal(d.heading, heading);
  }
  // Arcade grip: the rate eases from `turn` at a standstill to `fast` at top speed, never more, never a crawl.
  for (const spec of Object.values(VEHICLES)) { assert.equal(turnRate(spec, 0), spec.turn); assert.equal(turnRate(spec, spec.top), spec.fast); assert.equal(turnRate(spec, 99), spec.fast); assert.ok(spec.fast < spec.turn && spec.fast >= 2.4); for (let v = 0; v < spec.top; v += 2) assert.ok(turnRate(spec, v + 2) <= turnRate(spec, v) && turnRate(spec, v) <= spec.turn); }
  for (const v of [0, 10, 19.2, 30, 38.4]) assert.ok(turnRate(VEHICLES.bike, v) > turnRate(VEHICLES.jeep, v) * 1.4, 'the motorcycle is the nimble one');
});

test('steering takes no speed off: a right angle and a weave at full speed, 8x reached while turning, 4x in the village', () => {
  assert.equal(WALK_SPEED, 4.8);
  const dt = 1 / 60, times = {};
  for (const id of ['jeep', 'bike']) {
    const spec = VEHICLES[id]; assert.equal(spec.cruise, WALK_SPEED * 4); assert.equal(spec.top, WALK_SPEED * 8);
    const run = outside => { const d = newDrive(0), at = {}; for (let i = 1; i <= 600; i++) { stepDrive(d, spec, 0, 1, dt, outside); if (!at.cruise && d.speed >= spec.cruise) at.cruise = i * dt; if (!at.top && d.speed >= spec.top) at.top = i * dt; } return { d, at }; };
    const open = run(400); assert.ok(open.at.cruise < 1.5, `${id} at 4x in ${open.at.cruise.toFixed(2)} s`); assert.ok(open.at.top > 2 && open.at.top < 5.5, `${id} at 8x in ${open.at.top.toFixed(2)} s`); assert.equal(open.d.speed, spec.top);
    const village = run(0); assert.equal(village.d.speed, spec.cruise, 'the village limit'); assert.equal(village.at.top, undefined);
    // Coming home flat out: the limit falls with the distance left, at no more than the brakes can do.
    assert.equal(openLimit(spec, 0), spec.cruise); assert.equal(openLimit(spec, 1000), spec.top); for (let m = 0; m < 40; m += .5) assert.ok(openLimit(spec, m + .5) >= openLimit(spec, m));
    const d = newDrive(0); d.speed = spec.top; d.straight = 9; let left = 60; while (left > 0) { left -= stepDrive(d, spec, 0, 1, dt, left); } assert.ok(d.speed <= spec.cruise + 1, `${id} enters the village at ${d.speed.toFixed(1)} m/s`);
    // ...and it brakes just the same when it comes home in a weave.
    const w = newDrive(0); w.speed = spec.top; w.straight = 9; left = 60; for (let i = 0; left > 0; i++) { const a = (Math.floor(i * dt / .3) % 2 ? -1 : 1) * .9; left -= stepDrive(w, spec, Math.sin(a), Math.cos(a), dt, left) * Math.cos(w.heading); } assert.ok(w.speed <= spec.cruise + 1, `${id} weaves into the village at ${w.speed.toFixed(1)} m/s`);
    for (const [where, outside, full] of [['open ground', 400, spec.top], ['the village', 0, spec.cruise]]) {
      // A right angle (the stick at 90 degrees to the nose, which is "left" or "right" while driving up the screen).
      for (const side of [1, -1]) {
        const t = run(outside).d; let least = Infinity, took = null, fastest = 0, x = 0, z = 0;
        for (let i = 1; i <= 180; i++) { const before = t.heading, travel = stepDrive(t, spec, side, 0, dt, outside); x += Math.sin(t.heading) * travel; z += Math.cos(t.heading) * travel; least = Math.min(least, t.speed); fastest = Math.max(fastest, Math.abs(turnBetween(before, t.heading)) / dt); if (took == null && Math.abs(turnBetween(t.heading, side * Math.PI / 2)) < .05) took = i * dt; assert.ok(Math.sign(turnBetween(before, t.heading)) !== -side, 'it turns the short way and never back'); }
        assert.equal(least, full, `${id}, ${where}: a right angle at ${least.toFixed(1)} of ${full} m/s`);
        assert.ok(took != null && took <= (id === 'bike' ? .6 : 1), `${id}, ${where}: a right angle takes ${took} s`); assert.ok(fastest <= turnRate(spec, full) + 1e-9, 'the rate is bounded: no snap');
        assert.ok(z > 0 && z < full * .55 && x * side > full * 1.5, `${id}, ${where}: an arc, not a slide (${x.toFixed(1)}, ${z.toFixed(1)})`);
        if (side === 1) times[`${id} ${where}`] = took;
      }
      // A weave: the stick thrown left and right of the road, from a narrow one to pure left then pure right (A then D
      // with no W: half a turn each time, which a first version still braked for) and beyond, slowly and quickly, at 60
      // and at 15 frames a second. Nothing comes off the speed and the build-up to 8x is never set back.
      for (const swing of [.8, Math.PI / 3, 70 * Math.PI / 180, Math.PI / 2, 2.4, 3]) for (const period of [.25, .4, .7, 1, 1.2]) for (const step of [dt, 1 / 15]) {
        const t = run(outside).d; let least = Infinity, held = t.straight, resets = 0;
        for (let time = 0; time < 9; time += step) { const a = (Math.floor(time / period) % 2 ? -1 : 1) * swing; stepDrive(t, spec, Math.sin(a), Math.cos(a), step, outside); least = Math.min(least, t.speed); if (t.straight < held) resets++; held = t.straight; }
        assert.equal(least, full, `${id}, ${where}: the stick thrown ${swing.toFixed(2)} rad to each side every ${period} s at ${Math.round(1 / step)} fps: ${least.toFixed(1)} of ${full} m/s`); assert.equal(resets, 0, 'the build-up is never reset');
      }
      // A stick pulled straight back, again and again: the same.
      { const t = run(outside).d; let least = Infinity; for (let i = 0; i < 600; i++) { const back = Math.floor(i * dt / 1.5) % 2; stepDrive(t, spec, 0, back ? -1 : 1, dt, outside); least = Math.min(least, t.speed); } assert.equal(least, full, `${id}, ${where}: U-turns at ${least.toFixed(1)} of ${full} m/s`); assert.ok(t.straight > 15); }
    }
    // The build-up to 8x does not wait for a straight line: from a standstill, changing direction by a right angle every second.
    const z = newDrive(0); let top = null; for (let i = 1; i <= 600 && top == null; i++) { const east = Math.floor(i * dt) % 2 === 0; stepDrive(z, spec, east ? 1 : 0, east ? 0 : 1, dt, 400); if (z.speed >= spec.top) top = i * dt; }
    assert.ok(top != null && top <= open.at.top + .05, `${id}: 8x in ${top} s while zigzagging (${open.at.top.toFixed(2)} s in a straight line)`);
    // The speed it aims for does not know where the stick points: only the village limit and the build-up count.
    assert.equal(targetSpeed.length, 3); assert.equal(targetSpeed(spec, { straight: 9 }, 400), spec.top); assert.equal(targetSpeed(spec, { straight: 9 }, 0), spec.cruise); assert.equal(targetSpeed(spec, { straight: 0 }, 400), spec.cruise);
    // Setting off, then a half turn 1.5 s later (at cruise, the build-up just begun): it goes on building.
    const u = newDrive(0); let least = Infinity; for (let i = 0; i < 90; i++) stepDrive(u, spec, 0, 1, dt, 400); const built = u.straight; for (let i = 0; i < 120; i++) { stepDrive(u, spec, 1, 0, dt, 400); stepDrive(u, spec, -1, 0, dt, 400); least = Math.min(least, u.speed); assert.ok(u.straight > built); }
    assert.ok(built > 0 && least >= spec.cruise && u.speed === spec.top, `${id}: 8x while the stick flips left and right every frame`);
    assert.ok(open.at.top > open.at.cruise * 2);
  }
  assert.ok(times['bike open ground'] < times['jeep open ground'] && times['bike the village'] < times['jeep the village'], 'the motorcycle turns the quicker');
  assert.ok(VEHICLES.bike.accel > VEHICLES.jeep.accel && VEHICLES.bike.boost > VEHICLES.jeep.boost);
  // Collision pieces: at top speed and the longest frame (0.05 s) no piece is longer than half a metre.
  const travel = VEHICLES.jeep.top * .05; assert.ok(travel / subSteps(travel) <= .5 && subSteps(travel) >= 4); assert.equal(subSteps(0), 1); assert.equal(subSteps(.3), 1);
  assert.ok(Math.abs(arrivalSpeed(VEHICLES.jeep, 11) ** 2 / (2 * VEHICLES.jeep.brake) - 11) < 1e-9);
  assert.equal(driveZoom(VEHICLES.jeep, 0), 1); assert.equal(driveZoom(VEHICLES.jeep, VEHICLES.jeep.top), DRIVE_CAMERA.zoom); assert.equal(lookAhead(38.4, 5), 5); assert.ok(lookAhead(10, 50) < 5);
});

/** A bare world for DriveView: flat ground, the colliders and trunks a test puts there. */
function driveWorld(id, x, z, heading = 0) {
  const world = { bounds: { x: 5000, z: 5000 }, colliders: [], location: 'village', path: [], player: { position: { x, y: 0, z } }, addTreeBlock() {}, removeTreeBlock() {}, riding: { id, mesh: { position: { x, y: 0, z }, rotation: { x: 0, y: heading, z: 0 }, scale: { x: 1 } } } };
  const view = new DriveView(world); view.board(world.riding); return { world, view, d: world.riding.drive, m: world.riding.mesh.position, spec: world.riding.spec };
}

test('flat out in a tight turn nothing thin is stepped over: every half-metre piece is tested', () => {
  const frames = [.05, 1 / 60, .033, .05, .021]; let hits = 0, most = 0, runs = 0;
  for (const id of ['jeep', 'bike']) for (const route of [false, true]) for (let n = 0; n < 60; n++) {
    // Open ground (x 500), a wall 10 cm thick across z = 20 and a fence of 10 cm posts half a metre apart across z = -20.
    const side = n % 2 ? 1 : -1, start = side * (n % 7) * 1.3, { world, view, d, m, spec } = driveWorld(id, 500 + n * .137, start, side > 0 ? -1.5 + n * .05 : Math.PI + 1.5 - n * .05);
    world.colliders.push({ location: 'village', x: 500, z: 20, w: 400, d: .1 }); for (let px = 300; px <= 700; px += .5) world.addTreeBlock({ x: px, z: -20, r: .1 });
    d.speed = spec.top; d.straight = 9;
    // By stick it swings round at its full rate towards the barrier; on a tapped route it is as slim as a walker (0.32 m).
    if (route) world.path = [{ x: m.x + side * 3, z: side * 400 }];
    const bumps = view.bumps;
    for (let i = 0; i < 100; i++) {
      const dt = frames[(i + n) % frames.length]; view.step(0, route ? 0 : side, dt); most = Math.max(most, d.speed);
      assert.ok(view.steps >= d.speed * dt / .5 - 1e-9 || view.bumps > bumps, 'pieces of half a metre at most');
      assert.ok(m.z < 20 && m.z > -20, `${id}${route ? ' on a route' : ''}, run ${n}: went through at frame ${i} (z ${m.z.toFixed(2)})`);
      if (view.bumps === bumps) { d.speed = spec.top; d.straight = 9; } // flat out until it gets there
    }
    runs++; if (view.bumps > bumps) hits++;
  }
  assert.equal(hits, runs, `every run ran into the barrier (${hits} of ${runs})`); assert.equal(most, VEHICLES.jeep.top);
  // The thinnest thing there is: between two posts the fence is 0.62 m deep for a vehicle on a route, more than a piece.
  assert.ok(2 * Math.sqrt((.1 + .05 + .25) ** 2 - .25 ** 2) > .5);
});

test('a tapped route is driven at full speed round its corners, and a corner too near to turn into is not circled', () => {
  for (const id of ['jeep', 'bike']) {
    const spec = VEHICLES[id], dt = 1 / 60;
    // Right-angle corners 60 m apart: nothing is taken off for them (the arrival at the end still slows it).
    for (const [where, x, full] of [['the village', 0, spec.cruise], ['open ground', 600, spec.top]]) {
      const { world, view, d, m } = driveWorld(id, x, -50); world.path = [{ x, z: 10 }, { x: x + 60, z: 10 }, { x: x + 60, z: 70 }, { x: x + 120, z: 70 }, { x: x + 120, z: 400 }];
      if (full === spec.cruise) world.location = 'field'; // anywhere but the village map counts as inside the limit
      let frames = 0, least = Infinity, reached = false; while (world.path.length > 1 && frames < 3000) { view.step(0, 0, dt); frames++; if (d.speed >= full) reached = true; if (reached) least = Math.min(least, d.speed); }
      assert.equal(world.path.length, 1, `${id}, ${where}: round all four corners`); assert.ok(reached); assert.equal(least, full, `${id}, ${where}: corners at ${least.toFixed(1)} of ${full} m/s`);
      while (world.path.length && frames < 6000) { view.step(0, 0, dt); frames++; } assert.equal(world.path.length, 0, 'arrived'); assert.ok(Math.hypot(m.x - x - 120, m.z - 400) < 1.3 && d.speed < 8);
    }
    // A spot right beside it, and a hairpin of corners 6 m apart, at cruise: reached in a few seconds, no orbit.
    for (const path of [[{ x: 4, z: 0 }], [{ x: -3, z: -2 }], [{ x: 0, z: 30 }, { x: 30, z: 30 }, { x: 30, z: 36 }, { x: 0, z: 36 }, { x: 0, z: 42 }, { x: 30, z: 42 }]]) {
      const { world, view, d } = driveWorld(id, 0, 0); d.speed = spec.cruise; world.path = path.map(p => ({ ...p })); const length = path.reduce((sum, p, i) => sum + Math.hypot(p.x - (path[i - 1]?.x ?? 0), p.z - (path[i - 1]?.z ?? 0)), 0);
      let frames = 0; while (world.path.length && frames < 3000) { view.step(0, 0, dt); frames++; }
      assert.ok(frames * dt < 2.5 + length / 6, `${id}: ${path.length} corners, ${length.toFixed(0)} m in ${(frames * dt).toFixed(1)} s`);
    }
    assert.ok(routeSpeed(spec, 60, Math.PI / 2) > spec.top); assert.equal(routeSpeed(spec, 5, 0), Infinity); assert.ok(routeSpeed(spec, 3, Math.PI / 2) < spec.cruise); assert.equal(routeSpeed(spec, .1, 3), ROUTE_CRAWL);
    // Every spot within 3 m, every 3 degrees round it, from a standstill to cruise, at 60 and at 20 frames a second: it gets
    // there in a few seconds. (With a floor of `crawl` the jeep's turning circle was 1.7 m against the 1.2 m that counts
    // as there: spots 1.2 to 2.3 m to its side were circled for ever.)
    assert.ok(ROUTE_CRAWL / spec.turn < .6, 'at the slowest the turning circle is well inside 1.2 m');
    let taps = 0, longest = 0;
    for (const v of [0, 3, 5, 10, spec.cruise]) for (const step of [dt, 1 / 20]) for (let r = 1.2; r < 3.01; r += .1) for (let a = -180; a < 180; a += 3) {
      const { world, view, d } = driveWorld(id, 0, 0); world.location = 'field'; d.speed = v; world.path = [{ x: Math.sin(a * Math.PI / 180) * r, z: Math.cos(a * Math.PI / 180) * r }];
      let time = 0; while (world.path.length && time < 6) { view.step(0, 0, step); time += step; }
      assert.equal(world.path.length, 0, `${id} at ${v} m/s: a tap ${r.toFixed(1)} m away, ${a} degrees off the nose, is never reached`); taps++; longest = Math.max(longest, time);
    }
    assert.ok(taps > 20000 && longest < 3.5, `${id}: ${taps} taps, ${longest.toFixed(2)} s at the longest`);
  }
});

test('a route squeezed past a building, then the stick: the vehicle never drives on into it, and can still leave', () => {
  const house = { location: 'village', x: 10, z: -40, w: 10, d: 6.8 }; let cases = 0, squeezed = 0, left = 0;
  for (const id of ['jeep', 'bike']) for (const dt of [1 / 60, 1 / 30]) for (const off of [.4, .7, 1.1, 1.4]) for (let from = -32; from >= -44; from -= 1) for (const stick of [[-1, 0], [-1, -.5], [-1, .5], [-.3, -1]]) for (const v of [6, VEHICLES[id].cruise]) {
    // A tapped route runs down the east wall (x 15) with the centre `off` metres from it: it fits as a walker (0.32 m), not as a jeep (1.9 m).
    const { world, view, d, m, spec } = driveWorld(id, 15 + off, -25, Math.PI); world.colliders.push(house); world.path = [{ x: 15 + off, z: -70 }];
    for (let i = 0; i < 600 && m.z > from; i++) { view.step(0, 0, dt); d.speed = Math.min(d.speed, v); }
    // Then the stick, at the building.
    let deep = view.depth(m.x, m.z, spec); if (deep > 0) squeezed++;
    for (let i = 0; i < 120; i++) {
      view.step(stick[0], stick[1], dt); const now = view.depth(m.x, m.z, spec);
      assert.ok(now <= deep + 1e-9, `${id}: ${now.toFixed(2)} m into the wall's margin, from ${deep.toFixed(2)}`); deep = now;
      assert.ok(Math.abs(m.x - house.x) >= house.w / 2 || Math.abs(m.z - house.z) >= house.d / 2, `${id}: its centre is inside the building at (${m.x.toFixed(2)}, ${m.z.toFixed(2)})`);
    }
    // ...and away from it (where it is still beside that wall): it leaves the margin and drives off within two seconds.
    cases++; if (m.x < 15 || Math.abs(m.z - house.z) > house.d / 2) continue;
    for (let time = 0; time < 2; time += dt) view.step(1, 0, dt);
    assert.equal(view.blocked(m.x, m.z, spec), false); assert.ok(m.x > 35 && d.speed === spec.cruise, `${id}: drove off east (${m.x.toFixed(1)}, ${d.speed.toFixed(1)} m/s)`); left++;
  }
  assert.ok(cases > 1500 && squeezed > cases * .3 && left > cases * .2, `${squeezed} of ${cases} runs began inside the margin, ${left} ended against the wall`);
});

test('the stick held into a wall: it rests against it, or slides along it, and does not ram it again and again', () => {
  for (const id of ['jeep', 'bike']) for (const dt of [1 / 60, 1 / 30]) {
    const spec = VEHICLES[id], setUp = heading => { const w = driveWorld(id, 0, 0, heading); w.world.location = 'field'; w.world.colliders.push({ location: 'field', x: 0, z: 30, w: 400, d: 6 }); return w; };
    // Nose on (and up to 25 degrees off, which is what "up" is on a screen turned 0.38 rad): one bump, then it stands still.
    for (const a of [0, .08, -.2, .38, -.43]) {
      const { view, d, m } = setUp(a), stick = [Math.sin(a), Math.cos(a)]; let frames = 0; while (!view.bumps && frames < 600) { view.step(...stick, dt); frames++; }
      assert.ok(view.bumps && m.z < 30 - 3 - spec.radius + 1e-9, 'it reached the wall and stopped short of it');
      for (let i = 0; i < 20; i++) view.step(...stick, dt); // the nose settles
      const bumps = view.bumps, at = { x: m.x, z: m.z, heading: d.heading };
      for (let i = 0; i < 240; i++) { view.step(...stick, dt); assert.equal(d.speed, 0, `${id}: resting, not ${d.speed.toFixed(1)} m/s`); assert.equal(view.resting, true); }
      assert.equal(view.bumps, bumps, `${id}: no more bumps while it rests`); assert.deepEqual({ x: m.x, z: m.z, heading: d.heading }, at, 'it does not move and its nose does not swing');
      // Stick pulled away: it turns round and leaves at full cruise.
      for (let i = 0; i < 240; i++) view.step(0, -1, dt); assert.equal(view.resting, false); assert.ok(m.z < -10 && d.speed === spec.cruise, `${id} drove away (z ${m.z.toFixed(1)})`);
    }
    // 45 degrees to the wall: it slides along it, steadily (no saw-tooth in the speed, no swinging nose), without a bump once the nose is round.
    for (const side of [1, -1]) {
      const { view, d, m } = setUp(side * Math.PI / 4); let frames = 0; while (!view.bumps && frames < 600) { view.step(side, 1, dt); frames++; }
      for (let i = 0; i < 60; i++) view.step(side, 1, dt);
      const bumps = view.bumps, x = m.x; let least = Infinity, most = 0, swing = 0;
      for (let i = 0; i < 180; i++) { const h = d.heading; view.step(side, 1, dt); least = Math.min(least, d.speed); most = Math.max(most, d.speed); swing = Math.max(swing, Math.abs(turnBetween(h, d.heading))); }
      assert.equal(view.bumps, bumps, `${id}: sliding, no bumps`); assert.ok(least > spec.cruise * .6 && most - least < .01 && swing < 1e-9, `${id}: a steady ${least.toFixed(1)} to ${most.toFixed(1)} m/s along the wall`);
      assert.ok((m.x - x) * side > least * 180 * dt * .99 && m.z < 30 - 3 - spec.radius + 1e-9);
    }
  }
});

test('trees in the real fields cost a swerve, not the drive: nothing is driven through, nothing wedges, top speed comes back', () => {
  // The fields as the game plants them (field-layout.mjs), each tile loaded as the vehicle comes near, 20 s with the stick held one way.
  const dt = 1 / 60, result = {};
  for (const id of ['jeep', 'bike']) {
    let total = 0, runs = 0, least = Infinity, top = 0, bumps = 0, closest = Infinity;
    for (let seed = 0; seed < 14; seed++) for (let n = 0; n < 8; n++) {
      const a = n * Math.PI / 4 + .38, sx = Math.sin(a), sz = Math.cos(a), { world, view, d, m, spec } = driveWorld(id, 200 + seed * 37, -200 - seed * 53), seen = new Set(), trees = [], x0 = m.x, z0 = m.z;
      for (let i = 0; i < 1200; i++) {
        const cx = Math.floor(m.x / 64), cz = Math.floor(m.z / 64);
        for (let u = cx - 1; u <= cx + 1; u++) for (let v = cz - 1; v <= cz + 1; v++) { const k = u + ',' + v; if (seen.has(k)) continue; seen.add(k); for (const p of fieldPlan(u, v).trees) { const t = { x: p.x, z: p.z, r: .42 * p.scale }; trees.push(t); world.addTreeBlock(t); } }
        view.step(sx, sz, dt); if (d.speed >= spec.top) top += dt;
        if (i % 4 === 0) for (const t of trees) { const gap = Math.hypot(t.x - m.x, t.z - m.z) - t.r; if (gap < closest) closest = gap; }
      }
      const made = (m.x - x0) * sx + (m.z - z0) * sz; total += made; least = Math.min(least, made); bumps += view.bumps; runs++;
    }
    const spec = VEHICLES[id]; result[id] = { mean: total / runs, least, top: top / runs };
    assert.ok(closest >= spec.body + .25 - 1e-6, `${id}: never nearer a trunk than its body (${closest.toFixed(2)} m)`);
    assert.ok(bumps > runs, 'the runs do meet trees');
    // Before: a jeep wedged between two trunks stayed there (6 m made good in 20 s at the least; 455 m on average, the motorcycle 574 m).
    assert.ok(least > 300, `${id}: ${least.toFixed(0)} m made good at the least`); assert.ok(result[id].mean > (id === 'bike' ? 610 : 520), `${id}: ${result[id].mean.toFixed(0)} m on average`); assert.ok(result[id].top > (id === 'bike' ? 9 : 4.5), `${id}: ${result[id].top.toFixed(1)} s at 8x`);
  }
  // Two trunks with a gap 20 cm too narrow between them, driven straight at it: round them and on, from every small offset.
  for (const id of ['jeep', 'bike']) for (let n = -6; n <= 6; n++) {
    const { world, view, d, m, spec } = driveWorld(id, 500 + n * .3, 0), half = .7 + spec.body + .25 - .1; for (const side of [-1, 1]) world.addTreeBlock({ x: 500 + side * half, z: 40 + (side > 0 ? .8 : 0), r: .7 });
    for (let i = 0; i < 360; i++) { view.step(0, 1, dt); assert.equal(view.blocked(m.x, m.z, spec), false); }
    assert.ok(view.bumps > 0 && m.z > 80 && d.speed >= spec.cruise, `${id}, ${n}: past the pair of trunks (z ${m.z.toFixed(0)}, ${d.speed.toFixed(1)} m/s)`);
  }
  // What a blow leaves: round a trunk that is ahead, cruise (and so the build-up); more than a right angle round, half of that; along a wall, the part that points along it; nose on, nearly nothing.
  const jeep = VEHICLES.jeep; assert.equal(glance(jeep, jeep.top, Math.cos(.6), true), jeep.top * Math.cos(.6)); assert.equal(glance(jeep, jeep.cruise, Math.cos(1.2), true), jeep.cruise); assert.equal(glance(jeep, jeep.top, Math.cos(1.8), true), jeep.cruise / 2);
  assert.equal(glance(jeep, jeep.top, .5), jeep.top / 2); assert.equal(glance(jeep, jeep.top, 0), jeep.crawl); assert.equal(glance(jeep, 1, 1), 2); assert.ok(bump(jeep.top) * .2 < 1);
});

// ---------------------------------------------------------------- 3. the pen
test('pen animals stay in the yard, off the coop, the trough, the hay and the basket, apart from each other, for ten minutes', () => {
  const area = penArea(), rng = seeded(5), all = [];
  for (const [uid, spec] of PEN_ROSTER.entries()) { const w = newRoamer(uid, spec.kind, { x: 0, z: 0 }, rng); Object.assign(w, spawnSpot(area, rng, w, all)); all.push(w); }
  assert.deepEqual(PEN_ROSTER.map(a => a.kind), ['chicken', 'chicken', 'duck', 'cow', 'pig']);
  assert.deepEqual([0, 1, 2, 3].map(level => PEN_ROSTER.filter(a => penShown(a, level)).length), [2, 3, 4, 5], 'the same animals per pen level as before');
  const seen = { walked: new Set(), rests: new Set(), turnedFirst: 0, moved: all.map(() => 0) }, dt = 1 / 30;
  for (let i = 0; i < 30 * 600; i++) {
    for (const [n, w] of all.entries()) {
      const x = w.x, z = w.z, heading = w.heading; stepRoamer(w, all, area, rng, dt, null); seen.moved[n] += Math.hypot(w.x - x, w.z - z);
      const r = roamRadius(w); assert.ok(w.x > PEN.x0 + r && w.x < PEN.x1 - r && w.z > PEN.z0 + r && w.z < PEN.z1 - r, `${w.kind} inside the fence at step ${i}`);
      for (const p of PEN_PROPS) assert.ok(Math.hypot(w.x - p.x, w.z - p.z) >= p.r + r - 1e-6, `${w.kind} off the ${p.id}`);
      assert.ok(Math.hypot(w.x - x, w.z - z) <= 2.4 * dt + 1e-9, 'no jump');
      if (w.walking) { seen.walked.add(w.kind); if (w.speed === 0 && w.heading !== heading) seen.turnedFirst++; } else seen.rests.add(w.rest);
      assert.ok(Math.abs(turnBetween(heading, w.heading)) <= 4 * dt + .81, 'turns at a limited rate (a grazing shuffle may turn its head a little)');
    }
  }
  assert.deepEqual([...seen.walked].sort(), ['chicken', 'cow', 'duck', 'pig']); for (const rest of ['peck', 'graze', 'sit']) assert.ok(seen.rests.has(rest), rest);
  assert.ok(seen.turnedFirst > 20, 'turns on the spot before walking'); for (const m of seen.moved) assert.ok(m > 15, 'everyone gets about');
  let close = 0; for (const a of all) for (const b of all) if (a !== b && Math.hypot(a.x - b.x, a.z - b.z) < spacing(a, b) * .6) close++; assert.equal(close, 0, 'nobody stands in a heap');
});

test('pen animals step away from you, come to the trough when fed, and a hidden one takes no room', () => {
  const area = penArea(), rng = seeded(9), hen = newRoamer(0, 'chicken', { x: 15, z: -19 }, rng), cow = newRoamer(1, 'cow', { x: 19, z: -19 }, rng), all = [hen, cow];
  hen.rest = 'sit'; hen.restT = 99; const player = { x: 15.6, z: -19 };
  for (let i = 0; i < 60; i++) stepRoamer(hen, all, area, rng, 1 / 30, player);
  assert.ok(Math.hypot(hen.x - player.x, hen.z - player.z) > 1.5, 'the hen made way'); assert.ok(!area.blocked(hen.x, hen.z, roamRadius(hen)));
  callToTrough(all, area, rng); assert.ok(hen.walking && cow.walking); const trough = PEN_PROPS.find(p => p.id === 'feed_trough');
  for (let i = 0; i < 30 * 25; i++) for (const w of all) stepRoamer(w, all, area, rng, 1 / 30, null);
  assert.ok(Math.hypot(hen.goalX - trough.x, hen.goalZ - trough.z) < 4 && hen.goalZ < trough.z, 'the hen was called to the yard side of the trough');
  cow.hidden = true; const lone = newRoamer(2, 'pig', { x: cow.x + .2, z: cow.z }, rng); for (let i = 0; i < 30; i++) stepRoamer(lone, [lone, cow], area, rng, 1 / 30, null); assert.ok(Math.hypot(lone.x - cow.x, lone.z - cow.z) < 1.5, 'no push from an animal that is not there');
  assert.ok(area.blocked(PEN.x0, -19, .3) && area.blocked(10.5, -20.5, .3) && !area.blocked(15, -18, .3));
  assert.ok(area.blocked((PEN.gate[0] + PEN.gate[1]) / 2, PEN.z1, .3), 'the open gate is no way out');
});
