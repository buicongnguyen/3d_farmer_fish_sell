// The jump rules (jump.mjs, ported from Zoo Garden's jump-rules.ts): heights, the three jumps, the landing lag, the input buffer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JUMP, JumpState, JumpInput, jumpSpeed } from '../src/jump.mjs';

const fly = (s, seconds, dt = 1 / 60) => { let landed = false, peak = 0; for (let t = 0; t < seconds; t += dt) { if (s.step(dt)) landed = true; peak = Math.max(peak, s.height); } return { landed, peak }; };

test('a single jump rises about 2 m and lands back on 0', () => {
  const s = new JumpState(); assert.equal(s.jump(), 1);
  const r = fly(s, 1);
  assert.ok(Math.abs(r.peak - JUMP.rise[0]) < .2, `peak ${r.peak}`); assert.ok(r.landed); assert.equal(s.height, 0); assert.equal(s.airborne, false);
});

test('three jumps in the air, then no more', () => {
  const s = new JumpState();
  assert.equal(s.jump(), 1); fly(s, .1); assert.equal(s.jump(), 2); fly(s, .1); assert.equal(s.jump(), 3); assert.equal(s.jump(), 0, 'a fourth is refused');
  assert.ok(jumpSpeed(1) > jumpSpeed(3), 'each extra jump adds less');
});

test('a landing lag holds the next jump for a moment; cancel clears it', () => {
  const s = new JumpState(); s.jump(); while (!s.step(1 / 60));
  assert.equal(s.jump(), 0, 'right after landing'); fly(s, JUMP.landLag + .05); assert.equal(s.jump(), 1);
  s.cancel(); assert.equal(s.height, 0); assert.equal(s.airborne, false); assert.equal(s.jump(), 1, 'cancel also drops the lag');
});

test('a press just before landing is remembered; a held button does the extra jumps at the top', () => {
  const s = new JumpState(), input = new JumpInput();
  input.down(); assert.equal(input.wants(s, 1 / 60), true); s.jump(); input.done();
  assert.equal(input.wants(s, 1 / 60), false, 'consumed');
  let extra = 0; for (let t = 0; t < 1.5; t += 1 / 60) { s.step(1 / 60); if (input.wants(s, 1 / 60)) { if (s.jump()) extra++; input.done(); } }
  assert.equal(extra, 2, 'holding gives the double and the triple jump, never a bounce off the ground'); assert.equal(s.airborne, false);
  input.up(); assert.equal(input.wants(s, 1 / 60), false);
});
