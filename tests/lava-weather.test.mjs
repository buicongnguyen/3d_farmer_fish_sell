// The Ember Fields' weather clock (lava-weather.mjs), ported from Zoo Garden's lavaEvent. Owner: builder B.
import test from 'node:test';
import assert from 'node:assert/strict';
import { lavaEvent, nextEvent, forceLavaEvent, cycleEvent, LAVA_EVENT_WEIGHTS, LAVA_CYCLE_SECONDS, LAVA_ACTIVE_SECONDS, LAVA_EVENT_INFO } from '../src/lava-weather.mjs';

// The reference's own function (cute_game src/lava-weather.ts lavaEvent), kept here word for word so the port is checked against it.
function reference(timeSeconds) {
  const unit = seed => { let value = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b); value ^= value >>> 13; value = Math.imul(value, 0xc2b2ae35); return ((value ^ (value >>> 16)) >>> 0) / 4294967296; };
  const time = Number.isFinite(timeSeconds) ? Math.max(0, timeSeconds) : 0, index = Math.floor(time / 360), phase = time - index * 360;
  if (phase >= 240) return { id: 'normal', index, left: 360 - phase };
  let value = unit(index) * 8.5, id = 'treasure';
  for (const [key, weight] of Object.entries({ eruption: 2, meteor: 2, storm: 1.5, dragon: 1.5, treasure: 1.5 })) { value -= weight; if (value < 0) { id = key; break; } }
  return { id, index, left: 240 - phase };
}

test('lava events: the reference’s event for cycles 0 to 199, 240 s of event then 120 s of calm', () => {
  assert.equal(LAVA_CYCLE_SECONDS, 360); assert.equal(LAVA_ACTIVE_SECONDS, 240); assert.deepEqual(LAVA_EVENT_WEIGHTS, { eruption: 2, meteor: 2, storm: 1.5, dragon: 1.5, treasure: 1.5 });
  const kinds = new Set(), counts = {};
  for (let cycle = 0; cycle < 200; cycle++) {
    const start = lavaEvent(cycle * 360); kinds.add(start.id); counts[start.id] = (counts[start.id] ?? 0) + 1;
    assert.deepEqual(start, reference(cycle * 360)); assert.equal(start.id, cycleEvent(cycle));
    assert.notEqual(start.id, 'normal'); assert.equal(start.left, 240);
    assert.equal(lavaEvent(cycle * 360 + 239).id, start.id); assert.equal(lavaEvent(cycle * 360 + 239).left, 1);
    assert.equal(lavaEvent(cycle * 360 + 240).id, 'normal'); assert.equal(lavaEvent(cycle * 360 + 240).left, 120); assert.equal(lavaEvent(cycle * 360 + 359).left, 1);
    assert.deepEqual(lavaEvent(cycle * 360 + 100.5), reference(cycle * 360 + 100.5)); assert.deepEqual(lavaEvent(cycle * 360), start, 'the same second gives the same event');
  }
  assert.deepEqual([...kinds].sort(), Object.keys(LAVA_EVENT_WEIGHTS).sort()); assert.equal(lavaEvent(NaN).index, 0); assert.equal(lavaEvent(-50).index, 0);
  assert.ok(counts.dragon > 15 && counts.dragon < 60, `the dragon comes in about 17.6% of the cycles (${counts.dragon} of 200)`);
  for (const id of ['normal', ...Object.keys(LAVA_EVENT_WEIGHTS)]) assert.ok(LAVA_EVENT_INFO[id].name && LAVA_EVENT_INFO[id].icon);
  // Wall-clock seconds work the same (today's date is a few million cycles in).
  const now = 1790000000; assert.deepEqual(lavaEvent(now), reference(now));
});

test('nextEvent finds the first second of the next event of a kind, stepping cycle by cycle', () => {
  for (const id of Object.keys(LAVA_EVENT_WEIGHTS)) for (const t of [0, 17, 250, 1000.5, 36000, 1790000000]) {
    const at = nextEvent(id, t); assert.ok(Number.isFinite(at) && at >= t); assert.equal(lavaEvent(at).id, id, `${id} from ${t}`);
    // No earlier one: every cycle that starts (or is running) between t and `at` is another event.
    for (let c = Math.floor(t / 360); c * 360 < at; c++) { const start = Math.max(t, c * 360); if (start < at && start - c * 360 < 240) assert.notEqual(lavaEvent(start).id, id, `cycle ${c} is not ${id}`); }
    assert.ok(at === t || at % 360 === 0, 'it is on now, or it begins at the start of a cycle');
  }
  // While the event is on, the answer is now.
  const dragon = nextEvent('dragon', 0); assert.equal(nextEvent('dragon', dragon + 100), dragon + 100); assert.ok(nextEvent('dragon', dragon + 240) > dragon + 240, 'once it is over, the next one');
  assert.equal(nextEvent('normal', 10), 240); assert.equal(nextEvent('normal', 300), 300); assert.equal(nextEvent('nothing', 0, 50), Infinity);
});

test('forceLavaEvent overrides the clock for tests, until it is set back to null', () => {
  try {
    assert.equal(forceLavaEvent('dragon'), 'dragon');
    for (const t of [0, 250, 5000]) { const e = lavaEvent(t); assert.equal(e.id, 'dragon'); assert.equal(e.forced, true); assert.equal(e.left, 240); }
    assert.equal(forceLavaEvent('picnic'), 'dragon', 'an unknown event is ignored'); assert.equal(forceLavaEvent('normal'), 'normal'); assert.equal(lavaEvent(10).id, 'normal');
    assert.equal(forceLavaEvent(null), null); assert.deepEqual(lavaEvent(250), reference(250));
  } finally { forceLavaEvent(null); }
});
