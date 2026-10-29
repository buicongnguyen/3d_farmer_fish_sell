// The "Drifting petals & butterflies" switch: off for new games and old saves, and kept across a save and a reload.
import test from 'node:test';
import assert from 'node:assert/strict';
import { freshState, parseSave } from '../src/game.mjs';

test('ambient petals and butterflies are off by default', () => {
  assert.equal(freshState().settings.ambient, false);
  const old = structuredClone(freshState()); delete old.settings.ambient;
  assert.equal(parseSave(old).settings.ambient, false, 'a save from before the switch starts calm');
});

test('turning the switch on survives a save and a load', () => {
  const s = freshState(); s.settings.ambient = true;
  assert.equal(parseSave(structuredClone(s)).settings.ambient, true);
});
