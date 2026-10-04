// The adaptive quality governor (src/governor.mjs): slow seconds step quality down, fast ones give it back, loads and menus never count.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Governor, TOP } from '../src/governor.mjs';

const run = (g, fps, seconds, playing = true) => { let moves = 0; for (let i = 0; i < Math.round(seconds * fps); i++) moves += g.sample(1 / fps, playing); return moves; };

test('a steady 60 fps never moves; the first seconds are a grace period', () => {
  const g = new Governor(); assert.equal(run(g, 60, 30), 0); assert.equal(g.step, 0);
});
test('three slow seconds after the grace step quality down, one step at a time, to the last step and no further', () => {
  const g = new Governor(); assert.equal(run(g, 20, 3), 0, 'grace'); assert.equal(run(g, 20, 3), 1); assert.equal(g.step, 1);
  run(g, 20, 60); assert.equal(g.step, TOP);
});
test('ten fast seconds give a step back; a slow second in between starts the count again', () => {
  const g = new Governor(); run(g, 20, 8); assert.ok(g.step >= 1); const was = g.step;
  run(g, 60, 5); run(g, 20, 1); run(g, 60, 8); assert.ok(g.step >= was - 1 && g.step >= 1, 'not yet'); run(g, 60, 30); assert.equal(g.step, 0);
});
test('a pause, a menu or a long hitch resets the count and brings the grace back', () => {
  const g = new Governor(); run(g, 20, 5); assert.equal(g.step, 0); g.sample(1, true); run(g, 20, 2, false); run(g, 20, 5); assert.equal(g.step, 0);
});
