// Round 7, the pure parts: the creature drawing's two-threshold rules and the glide between simulation steps
// (creature-lod.mjs, wilds.mjs), the shadow box and its texel snap (sun-shadow.mjs), the vehicle's heading and speed
// (drive.mjs, drive-view.mjs) and the pen animals' roaming (pen-roam.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { LOD, nearLook, inView, castsShadow, walking, ease, turnToward, shadowReach, cellRadius } from '../src/creature-lod.mjs';
import { SUN_OFFSET, SHADOW, SHADOW_UP, lightAxes, viewVolume, roomVolume, shadowBox, texelSize, snapTarget, texelOf, fitShadow, followSun, shadowMapSize } from '../src/sun-shadow.mjs';
import { VEHICLES, WALK_SPEED, ROUTE_CRAWL, COAST, newDrive, stepDrive, openLimit, turnRate, targetSpeed, routeSpeed, glance, bump, turnBetween, subSteps, arrivalSpeed, driveZoom, lookAhead, DRIVE_CAMERA, FAR_VIEW, FAR_DEPTH, farZoom, SHADOW_VIEW, shadowShare, cameraRig, RIG } from '../src/drive.mjs';
import { inWorld, edgeDistance, edgeDepth, edgeAhead, EDGE_PAD, RING, regionAt, shapeOf, homeBorderDistance } from '../src/regions.mjs';
import { findRoute, clampToWorld, edgeSlide, ROUTE_PAD } from '../src/navigation.mjs';
const R2 = RING.R2, R1 = RING.R1, P = (rho, bearing) => [rho * Math.sin(bearing * Math.PI / 180), -rho * Math.cos(bearing * Math.PI / 180)];
import { landLightAt, mixLight, LIGHT_FADE } from '../src/light-mix.mjs';
import { SAFE, wildDepth } from '../src/ward.mjs';
import { inVillage, beyondVillage, CAMERA_YAW } from '../src/field-layout.mjs';
import { BLOCKS, livingTrees } from '../src/village-plan.mjs';
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
      // Keys, as fingers press them: A let go a moment before D goes down (no input in between), or both down for a moment
      // (they cancel: no input either). Up to COAST seconds of that is coasted through; it used to brake at once and send
      // the build-up back to nought, which cost the jeep three seconds at 8x for every change of side.
      for (const gap of [1 / 60, .05, .1]) for (const step of [dt, 1 / 30]) {
        const t = run(outside).d; let least = Infinity, resets = 0, held = t.straight;
        for (let time = 0; time < 9; time += step) { const phase = time % .5, side = Math.floor(time / .5) % 2 ? -1 : 1; stepDrive(t, spec, phase < gap - 1e-9 ? 0 : side, 0, step, outside); least = Math.min(least, t.speed); if (t.straight < held) resets++; held = t.straight; }
        assert.equal(least, full, `${id}, ${where}: left and right with ${gap.toFixed(3)} s of no input between them: ${least.toFixed(1)} of ${full} m/s`); assert.equal(resets, 0);
      }
      // Longer than that it does brake (letting go is how it stops), but the build-up is kept while it is still above cruise.
      assert.ok(COAST >= .1 && COAST <= .15); { const t = run(outside).d, built = t.straight; for (let i = 0; i < 24; i++) stepDrive(t, spec, 0, 0, dt, outside); assert.ok(t.speed < full - 4 && t.speed > 0, `${id}: 0.4 s without input brakes (${t.speed.toFixed(1)} m/s)`); if (t.speed >= spec.cruise * .85) assert.equal(t.straight, built); else assert.equal(t.straight, 0); }
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
    // ...and away from it (where it is still beside that wall; a slanted stick has mostly slid off its end by now): it leaves the margin and drives off within two seconds.
    cases++; if (m.x < 15 || Math.abs(m.z - house.z) > house.d / 2) continue;
    for (let time = 0; time < 2; time += dt) view.step(1, 0, dt);
    assert.equal(view.blocked(m.x, m.z, spec), false); assert.ok(m.x > 35 && d.speed === spec.cruise, `${id}: drove off east (${m.x.toFixed(1)}, ${d.speed.toFixed(1)} m/s)`); left++;
  }
  assert.ok(cases > 1500 && squeezed > cases * .3 && left > 100, `${squeezed} of ${cases} runs began inside the margin, ${left} ended against the wall`);
});

test('the stick held into a wall: it rests against it, or slides along it, and does not ram it again and again', () => {
  for (const id of ['jeep', 'bike']) for (const dt of [1 / 60, 1 / 30]) {
    const spec = VEHICLES[id], setUp = heading => { const w = driveWorld(id, 0, 0, heading); w.world.location = 'field'; w.world.colliders.push({ location: 'field', x: 0, z: 30, w: 400, d: 6 }); return w; };
    // Nose on to a long wall (and up to 7 degrees off): one bump, then it stands still. (Until round 8's review this was up to
    // 30 degrees off; "up" and "right" on a screen turned 0.38 rad meet every wall at 22, so the keys stopped dead at each barn.)
    for (const a of [0, .08, -.12]) {
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

test('a held stick keeps making progress: along a wall met at an angle, round a corner, out of a pocket, off a wedge', () => {
  const dt = 1 / 60, rad = Math.PI / 180;
  for (const id of ['jeep', 'bike']) {
    const spec = VEHICLES[id], clear = (view, m, what) => assert.equal(view.blocked(m.x, m.z, spec), false, `${id}, ${what}: inside something at (${m.x.toFixed(2)}, ${m.z.toFixed(2)})`);
    // A long wall (its face at z 27), the stick 20, 45 and 70 degrees off square, to either side: it slides along it at a
    // steady speed (the share of cruise that points along the wall, never less than half), nose along the wall, no bumps.
    for (const deg of [20, 45, 70]) for (const side of [1, -1]) {
      const a = side * deg * rad, sx = Math.sin(a), sz = Math.cos(a), { world, view, d, m } = driveWorld(id, 0, 0, a); world.location = 'field'; world.colliders.push({ location: 'field', x: 0, z: 30, w: 4000, d: 6 });
      let frames = 0; while (!view.bumps && frames < 600) { view.step(sx, sz, dt); frames++; } assert.ok(view.bumps, 'it reached the wall');
      for (let i = 0; i < 120; i++) view.step(sx, sz, dt); // the nose comes round
      const bumps = view.bumps, x = m.x, want = spec.cruise * Math.max(.5, Math.sin(deg * rad)); let least = Infinity, most = 0, swing = 0;
      for (let i = 0; i < 300; i++) { const h = d.heading; view.step(sx, sz, dt); least = Math.min(least, d.speed); most = Math.max(most, d.speed); swing = Math.max(swing, Math.abs(turnBetween(h, d.heading))); assert.equal(view.resting, false); assert.ok(m.z <= 27 - spec.radius + 1e-9, `${id}: into the wall (z ${m.z.toFixed(3)})`); }
      assert.equal(view.bumps, bumps, `${id}, ${deg} degrees: sliding, no bumps`); assert.ok(Math.abs(least - want) < 1e-6 && most - least < 1e-6 && swing < 1e-9, `${id}, ${deg} degrees: ${least.toFixed(2)} to ${most.toFixed(2)} m/s, wanted a steady ${want.toFixed(2)}`);
      assert.ok((m.x - x) * side > want * 5 * .99, `${id}, ${deg} degrees: ${((m.x - x) * side).toFixed(0)} m along the wall in 5 s`);
    }
    // A house (8 by 6.6 m) met square on within 2.5 m of a corner, and met 22 degrees off (a key on the turned screen) anywhere
    // along its front: it goes round and on. Dead centre and square on it rests (the test above).
    const house = { location: 'field', x: 0, z: 30, w: 8, d: 6.6 }, half = house.w / 2 + spec.radius; let met = 0;
    for (const [a, offs] of [[0, [half - .2, half - 1, half - 2.3, .2 - half, 1 - half, 2.3 - half]], [.38, [-half - 9, -half - 6, -half - 3, -half]], [-.38, [half + 9, half + 6, half + 3, half]]]) for (const off of offs) {
      const sx = Math.sin(a), sz = Math.cos(a), { world, view, d, m } = driveWorld(id, off, 0, a); world.location = 'field'; world.colliders.push(house); let rested = 0, least = Infinity;
      for (let i = 0; i < 420; i++) { view.step(sx, sz, dt); clear(view, m, 'the house'); if (view.resting) rested++; if (view.bumps) least = Math.min(least, d.speed); }
      if (view.bumps) met++; assert.ok(rested === 0 && (least >= 2 || !view.bumps), `${id}, ${off.toFixed(1)} m off the middle: never rested (${rested} frames), never under ${least.toFixed(1)} m/s`);
      assert.ok(m.x * sx + m.z * sz > 70 && d.speed === spec.cruise, `${id}, ${off.toFixed(1)} m off the middle, stick at ${a}: past the house (${m.x.toFixed(0)}, ${m.z.toFixed(0)}) at ${d.speed.toFixed(1)} m/s`);
    }
    assert.ok(met >= 11, `${id}: ${met} of 14 runs met the house`);
    // A fence of 10 cm posts half a metre apart, met at 20 and 45 degrees: felt along to its end, never through it.
    for (const deg of [20, 45]) {
      const a = deg * rad, sx = Math.sin(a), sz = Math.cos(a), { world, view, m } = driveWorld(id, 500, 0, a); for (let px = 400; px <= 560; px += .5) world.addTreeBlock({ x: px, z: 30, r: .1 });
      for (let i = 0; i < 600; i++) { view.step(sx, sz, dt); clear(view, m, 'the fence'); assert.ok(m.z < 30 || m.x > 560, `${id}: through the fence at x ${m.x.toFixed(1)}`); }
      assert.ok(view.bumps > 0 && m.x > 560 && m.z > 60, `${id}, ${deg} degrees: round the end of the fence (${m.x.toFixed(0)}, ${m.z.toFixed(0)})`);
    }
    // A pocket: the barn with the tractor parked off its corner, as in the village, the stick held screen-right. It slid
    // along the tractor into the barn's wall and stayed; now it turns round, follows the tractor out and goes on east.
    // (The motorcycle fits between the two, 2.8 m apart, and slides through.)
    {
      const sx = Math.cos(CAMERA_YAW), sz = -Math.sin(CAMERA_YAW), { world, view, m } = driveWorld(id, 10, -6.5, Math.PI / 2); world.location = 'field';
      world.colliders.push({ location: 'field', x: 28, z: -19.5, w: 8.4, d: 7.4 }, { location: 'field', x: 30, z: -11, w: 2.6, d: 4 }); let turned = false, time = 0;
      while (m.x < 60 && time < 12) { view.step(sx, sz, dt); time += dt; clear(view, m, 'the pocket'); turned ||= view.round; }
      assert.ok(turned === (id === 'jeep') && m.x >= 60 && time < 6, `${id}: out of the barn-and-tractor pocket in ${time.toFixed(1)} s (x ${m.x.toFixed(1)})`);
    }
    // A wall with a pocket at either end: try the other side, then use the bounded recovery route out of the pocket.
    {
      const sx = Math.sin(.38), sz = Math.cos(.38), { world, view, d, m } = driveWorld(id, 0, 0, .38); world.location = 'field';
      world.colliders.push({ location: 'field', x: 0, z: 30, w: 20, d: 6 }, { location: 'field', x: -12, z: 25, w: 4, d: 12 }, { location: 'field', x: 12, z: 25, w: 4, d: 12 }); let east = 0, west = 0;
      for (let i = 0; i < 900; i++) { const x = m.x; view.step(sx, sz, dt); clear(view, m, 'two pockets'); if (i > 60 && m.x > x + .05) east++; if (i > 60 && m.x < x - .05) west++; }
      assert.ok(east > 10 && west > 10, `${id}: it tried the other way (${east} frames east, ${west} west)`);
      for (let i = 0; i < 1500 && m.z < 45; i++) { view.step(sx, sz, dt); clear(view, m, 'the recovered pocket'); }
      assert.ok(m.z > 45, `${id}: recovered instead of resting forever (${m.x.toFixed(1)}, ${m.z.toFixed(1)})`);
    }
    // Wedged: nose up against two trunks too close to pass between, the stick pulled back. It used to hop from one to the
    // other for good, nose still to the trunks; now it stops, turns round on the spot and drives off.
    {
      const gap = spec.body + .25 + .76, { world, view, d, m } = driveWorld(id, 58.13 + gap - 1.51, -44.71 - (gap - 1.51) * 1.6, .607), x0 = m.x, z0 = m.z, sx = -.7, sz = -.72; world.addTreeBlock({ x: 58.5 - gap * .8, z: -42.96, r: .79 }); world.addTreeBlock({ x: 58.5 + gap * .8, z: -42.8, r: .73 });
      for (let i = 0; i < 360; i++) { view.step(sx, sz, dt); clear(view, m, 'the trunks'); }
      assert.ok((m.x - x0) * sx + (m.z - z0) * sz > 50 && d.speed >= spec.cruise, `${id}: off the pair of trunks, ${((m.x - x0) * sx + (m.z - z0) * sz).toFixed(0)} m made good in 6 s`);
    }
  }
});

/** The village as the game builds it (village-plan.mjs): every building and big prop, every living tree. */
function villageWorld(id, x, z, heading) {
  const w = driveWorld(id, x, z, heading); w.world.colliders.push(...BLOCKS.map(b => ({ location: 'village', x: b.x, z: b.z, w: b.w, d: b.d }))); for (const t of livingTrees()) w.world.addTreeBlock({ x: t.x, z: t.z, r: .42 * t.s }); return w;
}
/** Where a key points on the ground: `a` radians clockwise from screen-up (world.mjs turns the stick by the camera's yaw). */
const screenStick = a => { const x = Math.sin(a), z = -Math.cos(a); return [x * Math.cos(CAMERA_YAW) + z * Math.sin(CAMERA_YAW), -x * Math.sin(CAMERA_YAW) + z * Math.cos(CAMERA_YAW)]; };

test('in the real village a held key gets the vehicle out: the motorcycle from its park spot with D held, and from all over', () => {
  const dt = 1 / 60;
  // The motorcycle where it is parked (5, -8, nose east), D held: tests/pandora-browser.mjs drives exactly this. With rest
  // below 30 degrees it stopped for good against the barn's west wall at (22.70, -15.14), 1.4 s in.
  {
    const { view, d, m, spec } = villageWorld('bike', 5, -8, Math.PI / 2), [sx, sz] = screenStick(Math.PI / 2); let time = 0, rested = 0, least = Infinity;
    while (m.x < 95 && time < 30) { view.step(sx, sz, dt); time += dt; assert.equal(view.blocked(m.x, m.z, spec), false); if (view.resting) rested++; if (time > 1) least = Math.min(least, d.speed); }
    assert.ok(m.x >= 95 && time < 9, `out east of the village in ${time.toFixed(2)} s (x ${m.x.toFixed(1)})`); assert.equal(rested, 0, 'it never rests on the way'); assert.ok(least >= 5, `never slower than ${least.toFixed(1)} m/s once under way`);
  }
  // From a grid of spots all over the village, each of the eight key directions held for up to 30 s: nothing is driven
  // into, and nearly every run is 30 m outside the village by then. (At the merge base 8 % of such runs never left, at
  // 1c553b7, before this fix, 25 %; what is left is the jeep wedged between a wall and a trunk, where it rests.)
  let runs = 0, out = 0, total = 0, still = 0;
  for (const id of ['jeep', 'bike']) for (let x = -54; x <= 58; x += 14) for (let z = -45; z <= 40; z += 14) for (let k = 0; k < 8; k++) {
    const { view, d, m, spec } = villageWorld(id, x + .13, z + .29, k * Math.PI / 4 + 1), [sx, sz] = screenStick(k * Math.PI / 4); if (view.blocked(m.x, m.z, spec)) continue;
    let time = 0; while (time < 30 && beyondVillage(m.x, m.z) < 30) { view.step(sx, sz, dt); time += dt; assert.equal(view.blocked(m.x, m.z, spec), false, `${id} from (${x}, ${z}), key ${k}: inside something at (${m.x.toFixed(2)}, ${m.z.toFixed(2)})`); }
    runs++; if (beyondVillage(m.x, m.z) >= 30) { out++; total += time; } else if (d.speed === 0 && view.resting) still++;
  }
  assert.ok(runs > 400, `${runs} runs`); assert.ok(out >= runs * .97, `${out} of ${runs} runs left the village (${still} of the rest are at rest)`); assert.ok(total / out < 7, `${(total / out).toFixed(2)} s on average`);
});

// A frozen copy of the field plan of main f070c02 (eight seeded tries for a tree a 64 m tile, none in the village footprint or on the
// gate's road). This test is about steering, not about this round's scenery, so it keeps its own trees and its numbers for good;
// whether a jeep can drive the real forest is asserted with the real tables in tests/region-life.test.mjs (builder B).
function frozenTrees(cx, cz) {
  let seed = (Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663) ^ 0x57a811) >>> 0;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }, trees = [];
  const onGateRoad = (x, z) => x > 52 && x < 67 + 2 && z > -4 - 2 && z < 4 + 2;
  for (let i = 0; i < 8; i++) {
    const x = (cx + random()) * 64, z = (cz + random()) * 64, scale = 1.25 + random() * .85; random();
    if (!inVillage(x, z) && !onGateRoad(x, z)) trees.push({ x, z, scale });
  }
  return trees;
}
test('trees in the real fields cost a swerve, not the drive: nothing is driven through, nothing wedges, top speed comes back', () => {
  // The fields as the game planted them before round 8 (frozenTrees, above), each tile loaded as the vehicle comes near, 20 s with the stick held one way.
  const dt = 1 / 60, result = {};
  for (const id of ['jeep', 'bike']) {
    let total = 0, runs = 0, least = Infinity, top = 0, bumps = 0, closest = Infinity;
    for (let seed = 0; seed < 14; seed++) for (let n = 0; n < 8; n++) {
      const a = n * Math.PI / 4 + .38, sx = Math.sin(a), sz = Math.cos(a), { world, view, d, m, spec } = driveWorld(id, 200 + seed * 37, -200 - seed * 53), seen = new Set(), trees = [], x0 = m.x, z0 = m.z;
      for (let i = 0; i < 1200; i++) {
        const cx = Math.floor(m.x / 64), cz = Math.floor(m.z / 64);
        for (let u = cx - 1; u <= cx + 1; u++) for (let v = cz - 1; v <= cz + 1; v++) { const k = u + ',' + v; if (seen.has(k)) continue; seen.add(k); for (const p of frozenTrees(u, v)) { const t = { x: p.x, z: p.z, r: .42 * p.scale }; trees.push(t); world.addTreeBlock(t); } }
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
  assert.ok(area.blocked(PEN.x0, -19, .3) && area.blocked(PEN_PROPS[0].x, PEN_PROPS[0].z, .3) && !area.blocked(15, -21, .3));
  assert.ok(area.blocked((PEN.gate[0] + PEN.gate[1]) / 2, PEN.z1, .3), 'the open gate is no way out');
});

// ---------------------------------------------------------------- 6. round 8: the far view, the world's edge, routes, the light
test('the far view: a second pull-back by distance beyond the ward, the larger of it and the speed one; shadows by the view; the rig stands back', () => {
  assert.equal(FAR_VIEW, 36); assert.deepEqual(FAR_DEPTH, [24, 84]);
  assert.equal(farZoom(15, 0), 1); assert.equal(farZoom(15, 24), 1, 'nothing up to 24 m beyond the ward'); assert.ok(Math.abs(farZoom(15, 84) - 2.4) < 1e-12, 'the default view opens 2.4x at 84 m, as deep as the home ring is at its narrowest'); assert.equal(farZoom(15, 5000), farZoom(15, 84));
  assert.ok(Math.abs(farZoom(15, 54) - 1.7) < 1e-12, 'half way, half of it'); for (let d = 0, last = 1; d <= 120; d++) { const z = farZoom(15, d); assert.ok(z >= last); last = z; }
  assert.equal(farZoom(36, 104), 1, 'a player already zoomed out to 36 gets none'); assert.equal(farZoom(42, 104), 1); assert.ok(Math.abs(farZoom(6, 104) * 6 - FAR_VIEW) < 1e-9, 'whatever the wheel says below that, the view opens to 36');
  // It starts just inside a home region's square and is full three quarters across it (east: x 80.5 to 160.5).
  assert.equal(farZoom(15, wildDepth(SAFE.x1 + 24, 0)), 1); assert.ok(farZoom(15, wildDepth(SAFE.x1 + 104, 0)) > 2.39); assert.equal(farZoom(15, wildDepth(SAFE.x1 - 3, 0)), 1, 'inside the ward: nothing');
  // The two are combined by max: at top speed near the ward the speed one leads, far out the far one.
  const spec = VEHICLES.jeep; assert.equal(Math.max(driveZoom(spec, spec.top), farZoom(15, 30)), DRIVE_CAMERA.zoom); assert.ok(Math.max(driveZoom(spec, spec.top), farZoom(15, 104)) < DRIVE_CAMERA.zoom * 2.4 - .5, 'never the product');
  // Shadows: full while the view is what the shadow box is fitted for (the default zoom at the drive camera's 1.45), none from 28.5.
  assert.ok(Math.abs(SHADOW_VIEW.full - 21.75) < 1e-9); assert.equal(SHADOW_VIEW.none, 28.5);
  assert.equal(shadowShare(15), 1); assert.equal(shadowShare(21.75), 1); assert.equal(shadowShare(28.5), 0); assert.equal(shadowShare(36), 0); assert.equal(shadowShare(42), 0, 'the wheel\'s widest view has none');
  assert.ok(shadowShare(25) > .3 && shadowShare(25) < .7); for (let v = 15, last = 1; v <= 42; v += .25) { const k = shadowShare(v); assert.ok(k <= last); last = k; }
  // The rig: 45 m back (59.65 m from its focus) until the view is too tall for that; a portrait phone's far view (36 x 1.35) stands 69.9 m off.
  assert.ok(Math.abs(RIG.distance - 59.65) < .01);
  const near = cameraRig(15), wide = cameraRig(36, 1), tall = cameraRig(36 * 1.35, 1);
  assert.ok(Math.abs(near.back - 45) < 1e-9 && near.far === 220 && near.fogNear === 80 && near.fogFar === 160, 'the village view is today\'s');
  assert.ok(Math.abs(wide.back - 45) < 1e-9 && wide.far === 220, 'a landscape far view still fits'); assert.ok(Math.abs(wide.fogNear - (59.65 + 36 * 1.151)) < .01 && Math.abs(wide.fogFar - wide.fogNear - 120) < 1e-9, 'the fog stands off beyond the view');
  assert.ok(Math.abs(tall.distance - 69.9) < .05, `portrait: ${tall.distance.toFixed(2)} m`); assert.ok(Math.abs(tall.far - (220 + (tall.distance - RIG.distance) * 2)) < 1e-9); assert.ok(tall.distance - 48.6 * 1.151 >= 14 - 1e-9, 'the ground at the bottom of the screen is 14 m clear of the camera plane');
  for (let h = 10; h <= 60; h += 2) { const r = cameraRig(h, .5); assert.ok(r.fogNear >= 80 && r.fogNear >= r.distance + h * 1.151 - 1e-9 && r.far >= 220); }
});

/** The file's plain rig with the world's edge: edgeDepth and edgeAhead as World has them, built from regions.mjs. */
function edgeWorld(id, x, z, heading) {
  const w = driveWorld(id, x, z, heading); w.world.bounds = { x: R2 - EDGE_PAD, z: R2 - EDGE_PAD, r: R2 - EDGE_PAD };
  w.world.edgeDepth = (px, pz) => edgeDepth(px, pz); w.world.edgeAhead = (px, pz, dx, dz) => edgeAhead(px, pz, dx, dz);
  return w;
}
test('the world\'s edge is a circular wall a car meets at a crawl, at any angle, and slides along; beside it, it keeps top speed', () => {
  assert.deepEqual(edgeSlide(100, 0, 3, 4), { x: 0, z: 4 }, 'the part of a move along the wall'); assert.deepEqual(edgeSlide(100, 0, -3, 4), { x: -3, z: 4 }, 'a move away from it is left alone');
  for (const id of ['jeep', 'bike']) {
    const spec = VEHICLES[id];
    // Straight at the east rim from 48 m; at 10 degrees to it; the diagonal toward the north-west; and straight at the south rim.
    const nw = Math.atan2(-1, 1), ten = Math.PI / 2 - 80 * Math.PI / 180;
    for (const [name, x, z, heading] of [['straight at the east rim', R2 - EDGE_PAD - 48, 0, Math.PI / 2], ['at 10 degrees to the east rim', R2 - EDGE_PAD - 40, -40, ten], ['toward the north-west rim', -161.29, -94, nw], ['straight at the south rim', 0, R2 - EDGE_PAD - 48, 0]]) {
      const { world, view, d, m } = edgeWorld(id, x, z, heading); d.speed = spec.top; d.straight = 5;
      const sx = Math.sin(heading), sz = Math.cos(heading); let touch = null, fastest = 0, before = d.speed;
      assert.ok(Number.isFinite(edgeAhead(x, z, sx, sz, 400)), `${name}: the ray meets the edge`);
      for (let i = 0; i < 600 && touch === null; i++) { before = d.speed; view.step(sx, sz, 1 / 60); assert.ok(world.edgeDepth(m.x, m.z) === 0, `${id}, ${name}: never past the line`); if (view.bumps) touch = before; fastest = Math.max(fastest, d.speed); }
      assert.ok(touch !== null, `${id}, ${name}: it reaches the edge`); assert.ok(touch <= spec.crawl + .5, `${id}, ${name}: at a crawl when it touches (${touch.toFixed(2)} m/s; crawl ${spec.crawl})`);
      assert.ok(fastest >= spec.top - 1e-9, `${id}, ${name}: it was flat out before it braked`); assert.ok(inWorld(m.x, m.z, EDGE_PAD - 1e-6));
    }
    // Held at 30 degrees into the east rim: it slides along the circle (a wall, not a trunk) and never stops dead, whatever the bearing (here 0 and 45 degrees round).
    for (const [x0, z0, turn] of [[R2 - EDGE_PAD - 30, 20, 30], [...P(R2 - EDGE_PAD - 30, 45), 30]]) {
      const around = Math.atan2(x0, z0), heading = around - turn * Math.PI / 180, { world, view, d, m } = edgeWorld(id, x0, z0, heading), sx = Math.sin(heading), sz = Math.cos(heading); d.speed = spec.cruise;
      const bearing = () => Math.atan2(m.x, -m.z); const b0 = bearing(); let worst = 0, moved = 0;
      for (let i = 0; i < 300; i++) { const px = m.x, pz = m.z; view.step(sx, sz, 1 / 60); assert.equal(world.edgeDepth(m.x, m.z), 0); if (view.bumps && edgeDistance(m.x, m.z) < EDGE_PAD + .6) { moved += Math.hypot(m.x - px, m.z - pz); worst = Math.max(worst, d.speed); } }
      assert.ok(view.walled, 'the edge counts as a wall, not a trunk'); assert.ok(moved > 8, `${id}: it slides on along the edge (${moved.toFixed(1)} m)`); assert.ok(worst < spec.cruise, `${id}: slower than cruise against it (${worst.toFixed(1)} m/s)`); assert.ok(d.speed > 0, 'and does not stop dead'); assert.ok(inWorld(m.x, m.z, EDGE_PAD - 1e-6)); assert.notEqual(bearing(), b0);
    }
    // Running along a rim, 40 m inside it: nothing ahead of the nose for 2.4 s, so top speed is kept.
    {
      const { world, view, d, m } = edgeWorld(id, R2 - EDGE_PAD - 40, 0, 0); d.speed = spec.top; d.straight = 5; let least = Infinity;
      for (let i = 0; i < 150; i++) { view.step(0, 1, 1 / 60); least = Math.min(least, d.speed); }
      assert.ok(least >= spec.top - 1e-9, `${id}: ${least.toFixed(2)} m/s beside the edge`); assert.ok(m.z > spec.top * 2.4); assert.equal(view.bumps, 0);
    }
    // With the stick let go it coasts and brakes by itself; a rig without an edge (every other test in this file) is open ground.
    const plain = driveWorld(id, R2 - 10, 0, Math.PI / 2); plain.d.speed = spec.top; plain.d.straight = 5; for (let i = 0; i < 60; i++) plain.view.step(1, 0, 1 / 60); assert.ok(plain.m.x > R2 + 20 && plain.d.speed >= spec.top - 1e-9, 'no edgeDepth: no edge');
  }
});
test('routes keep to the world: a disc is convex, so a tapped end is moved off the edge and every pair of regions has a route inside it; a pond gone round at its bank', () => {
  const bounds = { x: R2 - EDGE_PAD, z: R2 - EDGE_PAD, r: R2 - EDGE_PAD };
  assert.equal(ROUTE_PAD, EDGE_PAD + 1.3);
  const along = (route, from, each) => { let a = from; for (const b of route) { const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / .5); for (let i = 0; i <= n; i++) each(a.x + (b.x - a.x) * i / n, a.z + (b.z - a.z) * i / n); a = b; } };
  const route = (from, to) => { const end = clampToWorld(to.x, to.z, ROUTE_PAD), start = clampToWorld(from.x, from.z, ROUTE_PAD); return { start, end, path: findRoute(start, end, [], bounds) }; };
  // findRoute keeps its box test and gains the circle: a point beyond bounds.r is not a place a route can end.
  assert.deepEqual(findRoute({ x: 0, z: 0 }, { x: R2 - 1, z: 0 }, [], bounds), [], 'beyond the padded circle'); assert.equal(findRoute({ x: 0, z: 0 }, { x: R2 - 3, z: 0 }, [], bounds).length, 1); assert.equal(findRoute({ x: 0, z: 0 }, { x: R2 - 1, z: 0 }, [], { x: 300, z: 300 }).length, 1, 'no r: the box alone, as the rooms');
  // Every pair of regions' anchors: a route, all of it inside the circle.
  const ids = ['west', 'north', 'south', 'east', 'toy', 'candy', 'jungle', 'ice', 'ocean', 'lava', 'cloud', 'shadow', 'village'], centre = id => ({ x: shapeOf(id).cx, z: shapeOf(id).cz });
  for (const p of ids) for (const q of ids) { if (p === q) continue; const r = route(centre(p), centre(q)); assert.ok(r.path.length, `${p} to ${q}`); along(r.path, r.start, (x, z) => assert.ok(inWorld(x, z, 2), `${p} to ${q} at (${x.toFixed(1)}, ${z.toFixed(1)})`)); }
  // A tap a metre inside the edge, on it, beyond it and far outside ends where a route can end.
  for (const [x, z] of [[R2 - 1, 0], [R2, 0], [R2 + 40, 3], [0, -R2 + .5], [210, 210], [5000, 5000], [-190, -66], [NaN, 4]]) {
    const end = clampToWorld(x, z); assert.ok(inWorld(end.x, end.z, 2), `(${x}, ${z}) -> (${end.x.toFixed(2)}, ${end.z.toFixed(2)})`);
    if (Number.isNaN(x)) continue;
    const r = route({ x: 0, z: 0 }, { x, z }); assert.ok(r.path.length, `a route to (${x}, ${z})`); assert.ok(inWorld(r.path.at(-1).x, r.path.at(-1).z, 2));
    if (inWorld(x, z, ROUTE_PAD + 2.5)) assert.deepEqual(end, { x, z }, 'a point well inside is left alone');
  }
  assert.deepEqual(clampToWorld(100, 20), { x: 100, z: 20 }); assert.ok(Math.abs(clampToWorld(R2 - 1, 0).x - (R2 - ROUTE_PAD)) < 1e-4, 'moved the least it can be, along the radius');
  // A start inside the edge's band (a walker can stand 2 m from it): one straight leg out, then the route.
  const from = { x: R2 - EDGE_PAD, z: 0 }, b = route(from, { x: 128, z: 0 }); assert.ok(Math.hypot(b.start.x - from.x, b.start.z - from.z) > 1 && b.path.length, 'the start is moved, and a route is found from there'); along([b.start], from, (x, z) => assert.ok(inWorld(x, z, EDGE_PAD - 1e-6)));
  assert.equal(findRoute(from, { x: 128, z: 0 }, [], bounds).length, 1, 'here the straight line is clear anyway');
  // A pond (r 11): world.routeObstacles gives a box of 2 x (r + 0.8), so the path stays outside the bank a walker is stopped at (r + 0.3); the old 1.6 r box was inside it.
  const pond = { x: 34, z: 160, r: 11 }, box = w => [{ x: pond.x, z: pond.z, w, d: w }], open = { x: 5000, z: 5000 }, src = { x: 34, z: 130 }, dst = { x: 34, z: 190 };
  let nearest = Infinity; along(findRoute(src, dst, box(2 * (pond.r + .8)), open), src, (x, z) => { nearest = Math.min(nearest, Math.hypot(x - pond.x, z - pond.z)); }); assert.ok(nearest > pond.r + .3 + .5, `round the pond ${nearest.toFixed(2)} m from its centre`);
  let old = Infinity; along(findRoute(src, dst, box(pond.r * 1.6), open), src, (x, z) => { old = Math.min(old, Math.hypot(x - pond.x, z - pond.z)); }); assert.ok(old < pond.r + .3, `the old box led through the bank (${old.toFixed(2)} m)`);
});
test('the light of a place: home light everywhere but inside a land, fading in over 24 m from the home region it touches, kept to its outer edge', () => {
  const LIGHTS = { lava: { sky: '#ffd2b8', ground: '#6a3a3a', sun: '#ffc9a0', sunIntensity: 2, fog: '#ffb08a', background: '#ffb08a' }, shadow: { sky: '#6a6aa8', ground: '#1a1430', sun: '#8a8ad8', sunIntensity: 2.4, fog: '#0d0b1a', background: '#0d0b1a' } };
  assert.equal(LIGHT_FADE, 24);
  // Into the Ember Fields from the swamp, along the middle of its sector: 0 at the arc, half at 12 m, full from 24 m, and still full 2 m inside the outer edge.
  const L = d => P(R1 + d, 337.5);
  for (const [d, share] of [[.0001, 0], [6, .15625], [12, .5], [24, 1], [96, 1], [R2 - 2 - R1, 1]]) { const at = landLightAt(...L(d), LIGHTS); assert.equal(at.id, 'lava'); assert.ok(Math.abs(at.share - share) < 1e-9, `${d} m: ${at.share}`); }
  assert.ok(homeBorderDistance(...L(R2 - 2 - R1)) > 100, 'the outer edge is not a border the light fades back at');
  assert.ok(Math.abs(landLightAt(...L(12), LIGHTS).share - .5) < 1e-9); assert.equal(landLightAt(...L(R2 - 2 - R1), LIGHTS).share, 1); assert.equal(landLightAt(...P(280, 340), LIGHTS).share, 1, 'beside its outer side: its own light');
  // Home regions, the village, a land with no row (the stub table) and beyond the world: the home light.
  for (const [x, z] of [[0, 0], [100, 0], [0, 100], P(R1 - .1, 337.5), [-100, -100], [400, 0], P(250, 200)]) assert.deepEqual(landLightAt(x, z, LIGHTS), { id: null, share: 0 }, `(${x}, ${z}): ${regionAt(x, z)}`);
  assert.deepEqual(landLightAt(...L(96), {}), { id: null, share: 0 }, 'step 0\'s empty table: every place keeps the home light');
  // A planet fades from the home arc it touches, the same at any bearing.
  const two = { ocean: LIGHTS.lava }; assert.ok(Math.abs(landLightAt(...P(R1 + 6, 280), two).share - landLightAt(...P(R1 + 6, 300), two).share) < 1e-9); assert.equal(landLightAt(...P(R1 + 30, 290), two).share, 1);
  // The crossfade on plain values.
  const home = { sky: '#e8f6ff', ground: '#9ccf7a', sun: '#fff4dd', sunIntensity: 2.4, fog: '#bfe8ff', background: '#9fdcff' };
  assert.deepEqual(mixLight(home, LIGHTS.lava, 0), home); assert.deepEqual(mixLight(home, LIGHTS.lava, 1), LIGHTS.lava); assert.deepEqual(mixLight(home, null, .7), home);
  const half = mixLight(home, LIGHTS.lava, .5); assert.ok(Math.abs(half.sunIntensity - 2.2) < 1e-9); assert.equal(half.fog, '#dfccc4');
});

// Round 8 fix: three.js r180 draws a transparent DoubleSide material twice (back, then front) unless forceSinglePass is set, and
// flags material.needsUpdate before each pass, so the program lookup ran every frame (the region curtain, the ward, the rings).
// Every transparent double-sided material the game makes in code must be single-pass.
test('every transparent double-sided material is drawn in one pass (forceSinglePass)', async () => {
  const { readdir, readFile } = await import('node:fs/promises');
  const files = (await readdir(new URL('../src/', import.meta.url))).filter(f => f.endsWith('.mjs')), offenders = [];
  for (const file of files) {
    const text = await readFile(new URL(`../src/${file}`, import.meta.url), 'utf8');
    for (const m of text.matchAll(/new T\.Mesh\w*Material\(\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\)/g)) {
      const body = m[1].replace(/\s/g, '');
      if (/transparent:true/.test(body) && /side:T\.DoubleSide/.test(body) && !/forceSinglePass:true/.test(body)) offenders.push(`${file}: ${m[0].slice(0, 90)}`);
    }
  }
  assert.deepEqual(offenders, []);
});
