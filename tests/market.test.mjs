import test from 'node:test';
import assert from 'node:assert/strict';
import { act, freshState, parseSave, sellPrice } from '../src/game.mjs';
import { DEMAND, demandRate, fullLeft, parseSoldToday, sellRun } from '../src/market.mjs';

const again = s => parseSave(JSON.parse(JSON.stringify(s)));

test('the first units of a kind sell at full price, the next at half, the rest at a fifth', () => {
  assert.equal(demandRate(0), 1);
  assert.equal(demandRate(5), 1);
  assert.equal(demandRate(6), 0.5);
  assert.equal(demandRate(11), 0.5);
  assert.equal(demandRate(12), 0.2);
  assert.equal(demandRate(999), 0.2);
  assert.equal(DEMAND[0].upTo, 6);
});

test('sellRun adds the steps up and says how many went at the full price', () => {
  assert.deepEqual(sellRun(20, 0, 3), { total: 60, full: 3 });
  assert.deepEqual(sellRun(20, 4, 4), { total: 20 + 20 + 10 + 10, full: 2 });
  assert.deepEqual(sellRun(20, 0, 14), { total: 6 * 20 + 6 * 10 + 2 * 4, full: 6 });
  assert.deepEqual(sellRun(20, 0, 0), { total: 0, full: 0 });
});

test('a small sale pays exactly what it always did', () => {
  const s = freshState();
  s.inventory = { carrot: 4 };
  act(s, 'sell', {});
  assert.equal(s.coins, 160 + sellPrice(s, 'carrot') * 4);
  assert.equal(s.stats.sales, sellPrice(s, 'carrot') * 4);
});

test('a big sale of one kind pays less for the surplus and says so', () => {
  const s = freshState();
  s.inventory = { carrot: 20 };
  const full = sellPrice(s, 'carrot');
  const r = act(s, 'sell', {});
  assert.ok(r.ok);
  assert.equal(s.stats.sales, 6 * full + 6 * Math.floor(full / 2) + 8 * Math.floor(full / 5));
  assert.ok(s.stats.sales < 20 * full);
  assert.match(r.message, /had its fill/);
});

test('the appetite is counted for the day: selling in two goes is the same as in one', () => {
  const a = freshState(),
    b = freshState();
  a.inventory = { carrot: 14 };
  b.inventory = { carrot: 14 };
  act(a, 'sell', {});
  act(b, 'sell', { id: 'carrot', one: true });
  for (let i = 0; i < 13; i++) act(b, 'sell', { id: 'carrot', one: true });
  assert.equal(a.stats.sales, b.stats.sales);
});

test('each kind has its own appetite, and the next morning it starts again', () => {
  const s = freshState();
  s.inventory = { carrot: 6, radish: 6 };
  act(s, 'sell', {});
  assert.equal(s.stats.sales, 6 * sellPrice(s, 'carrot') + 6 * sellPrice(s, 'radish'), 'two kinds, both at full price');
  s.inventory = { carrot: 6 };
  const before = s.stats.sales;
  act(s, 'sell', {});
  assert.equal(
    s.stats.sales - before,
    6 * Math.floor(sellPrice(s, 'carrot') / 2),
    'a seventh to twelfth carrot sells at half',
  );
  act(s, 'sleep');
  s.inventory = { carrot: 6 };
  const morning = s.stats.sales;
  act(s, 'sell', {});
  assert.equal(s.stats.sales - morning, 6 * sellPrice(s, 'carrot'), 'a new day, full price again');
});

test('fullLeft counts what is left at full price today', () => {
  assert.equal(fullLeft({ day: 3, counts: { carrot: 4 } }, 3, 'carrot'), 2);
  assert.equal(fullLeft({ day: 2, counts: { carrot: 4 } }, 3, 'carrot'), 6, 'yesterday does not count');
  assert.equal(fullLeft(undefined, 3, 'carrot'), 6);
  assert.equal(fullLeft({ day: 3, counts: { carrot: 50 } }, 3, 'carrot'), 0);
});

test("today's counts survive a save; another day's, unknown kinds and odd values are dropped", () => {
  const s = freshState();
  s.inventory = { carrot: 3 };
  act(s, 'sell', {});
  assert.deepEqual(again(s).soldToday, { day: 1, counts: { carrot: 3 } });
  const raw = JSON.parse(JSON.stringify(s));
  raw.soldToday = { day: 1, counts: { carrot: 2.7, bogus: 4, radish: -1, perch: 'x' } };
  assert.deepEqual(parseSave(raw).soldToday, { day: 1, counts: { carrot: 2 } });
  raw.soldToday.day = 7;
  assert.deepEqual(parseSave(raw).soldToday, { day: 0, counts: {} });
  assert.deepEqual(
    parseSoldToday('junk', 1, () => true),
    { day: 0, counts: {} },
  );
});
