import test from 'node:test';
import assert from 'node:assert/strict';
import { freshState, act } from '../src/game.mjs';
import { guideStep, guideProgress } from '../src/guide.mjs';

test('the guide walks hello, plant, water, sleep, harvest, sell, then ends', () => {
  const s = freshState();
  assert.equal(guideStep(s).id, 'hello');
  s.met.ada = true;
  assert.equal(guideStep(s).id, 'plant');
  s.beds[0] = { crop: 'carrot', grown: 0, watered: false };
  assert.equal(guideStep(s).id, 'water');
  s.beds[0].watered = true;
  assert.equal(guideStep(s).id, 'sleep');
  s.day = 2;
  assert.equal(guideStep(s).id, 'harvest');
  s.stats.harvests = 1;
  assert.equal(guideStep(s).id, 'sell');
  s.stats.sales = 5;
  assert.equal(guideStep(s), null);
  assert.equal(guideProgress(s), 6);
});

test('the guide stays away from an established save', () => {
  const s = freshState();
  s.chapter = 2;
  assert.equal(guideStep(s), null);
  assert.ok(act);
});
