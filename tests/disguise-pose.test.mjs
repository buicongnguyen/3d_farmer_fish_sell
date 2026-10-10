// The hero's skill poses (src/disguise-pose.mjs): a flier does not walk in the air, and every pose gives the standing body back.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newPose, poseStep, castPose, FLIGHT, CAST } from '../src/disguise-pose.mjs';

const limb = z => ({ rotation: { x: 0, y: 0, z } });
const avatar = () => ({ position: { x: 0, y: .02, z: 0 }, rotation: { x: 0, y: .7, z: 0, order: 'XYZ' }, scale: { x: .88, y: .88, z: .88 }, userData: { parts: { head: limb(0), arm_l: limb(-.16), arm_r: limb(.16), leg_l: limb(0), leg_r: limb(0) } } });
const shape = h => JSON.stringify([h.position.y, h.rotation, h.scale, Object.values(h.userData.parts).map(p => p.rotation)]);
/** One frame of the world (it walks the limbs and rests the feet on the ground), then the pose layer, as in the game. */
function frame(P, hero, d, mode, t, walking, ok = true) {
  const p = hero.userData.parts, s = walking ? Math.sin(t * 9) * .5 : 0;
  p.leg_l.rotation.x = s; p.leg_r.rotation.x = -s; p.arm_l.rotation.x = -s * 1.1; p.arm_r.rotation.x = s * 1.1; hero.position.y = .02;
  if (walking) hero.position.x += 4 / 60;
  return poseStep(P, hero, d, mode, ok, false, true, 1 / 60, t);
}

test('superhero flight: the body lies level at one height and the legs do not swing', () => {
  const hero = avatar(), P = newPose(), d = { flight: 12, giant: 0, tank: 0, bats: 0 }, p = hero.userData.parts, standing = shape(hero);
  castPose(P, 'flight'); let t = 0, low = Infinity, high = -Infinity;
  for (let i = 0; i < 180; i++, t += 1 / 60) { const h = frame(P, hero, d, '', t, true); if (i > 90) { low = Math.min(low, p.leg_l.rotation.x, p.leg_r.rotation.x); high = Math.max(high, p.leg_l.rotation.x, p.leg_r.rotation.x); assert.ok(Math.abs(h - FLIGHT.height) <= FLIGHT.bob + .01, 'one height'); } }
  assert.ok(high - low < .001, `legs still in the air (moved ${high - low})`); assert.ok(Math.abs(p.leg_l.rotation.x - .08) < .001);
  assert.ok(hero.rotation.x > 1.1 && hero.rotation.order === 'YXZ', 'pitched forward about its own right axis'); assert.ok(p.arm_r.rotation.x < -2.8, 'a fist out ahead');
  assert.ok(Math.abs(hero.position.y - .02 - FLIGHT.height) < .1);
  // A paused world does not rewrite the height: the pose must not add it up.
  for (let i = 0; i < 60; i++) poseStep(P, hero, d, '', true, false, true, 1 / 60, t); assert.ok(hero.position.y < .02 + FLIGHT.height + .1, 'height is absolute');
  // Landing, then standing: exactly the body it started with.
  d.flight = 0; for (let i = 0; i < 120; i++, t += 1 / 60) frame(P, hero, d, '', t, false);
  assert.equal(P.on, false); assert.equal(shape(hero), standing);
});

test('every skill pose, cut short or run out, gives back the standing pose', () => {
  for (const op of [...Object.keys(CAST), 'dive']) for (const cut of [false, true]) {
    const hero = avatar(), P = newPose(), d = { flight: op === 'flight' || op === 'hover' ? 8 : 0, giant: op === 'giant' ? 10 : 0, tank: op === 'tank' ? 6 : 0, bats: op === 'bats' ? 2.5 : 0 }, standing = shape(hero); let t = 0;
    castPose(P, op); for (let i = 0; i < 20; i++, t += 1 / 60) frame(P, hero, d, op === 'charge' ? 'dash' : '', t, true);
    hero.position.x = 0; assert.notEqual(shape(hero), standing, op + ' poses the hero');
    // Cut: knocked out, indoors or on a seat (ok = false). Otherwise the statuses run out and the pose eases away.
    if (cut) frame(P, hero, d, '', t, false, false); else { for (const k in d) d[k] = 0; for (let i = 0; i < 240; i++, t += 1 / 60) frame(P, hero, d, '', t, false); }
    const turn = Math.round((hero.rotation.y - .7) / (Math.PI * 2)); hero.rotation.y -= turn * Math.PI * 2; hero.rotation.y = +hero.rotation.y.toFixed(9);
    assert.equal(shape(hero), standing, `${op} ${cut ? 'cut' : 'ended'}`);
  }
});
