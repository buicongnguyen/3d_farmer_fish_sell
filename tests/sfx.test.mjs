import test from 'node:test';
import assert from 'node:assert/strict';
import { SFX, sfxFor, coinCount, playNotes } from '../src/sfx.mjs';

test('sounds differ by kind of action and fall back to the plain chime', () => {
  assert.notDeepEqual(sfxFor('sell', true), sfxFor('harvest', true));
  assert.notDeepEqual(sfxFor('claim', true), sfxFor('plant', true));
  assert.deepEqual(sfxFor('somethingNew', true), SFX.good);
  assert.deepEqual(sfxFor('sell', false), SFX.bad);
});

test('every note is well formed', () => {
  for (const [name, notes] of Object.entries(SFX))
    for (const [f, at, len, wave, vol] of notes) {
      assert.ok(f > 50 && f < 4000, name);
      assert.ok(at >= 0 && len > 0 && vol > 0 && vol <= 0.1, name);
      assert.ok(['sine', 'triangle', 'square', 'sawtooth'].includes(wave), name);
    }
});

test('playNotes schedules each note on the context', () => {
  const made = [];
  const node = () => ({
    frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
    gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
    connect: n => n,
    start() {},
    stop() {},
  });
  playNotes(
    { currentTime: 0, destination: {}, createOscillator: () => (made.push(1), node()), createGain: node },
    SFX.claim,
  );
  assert.equal(made.length, SFX.claim.length);
});

test('bigger earnings throw more coins, between 2 and 10', () => {
  assert.equal(coinCount(5), 2);
  assert.equal(coinCount(200), 7);
  assert.equal(coinCount(99999), 10);
});
