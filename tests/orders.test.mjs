import test from 'node:test';
import assert from 'node:assert/strict';
import { freshState, act, todaysOrders, parseSave } from '../src/game.mjs';
import { CROPS, cropUnlock } from '../src/content.mjs';
import { ordersFor, parseOrders, ORDER_BONUS } from '../src/orders.mjs';

test('three orders a day from three different neighbours, the same every time for that day', () => {
  for (let day = 1; day < 40; day++) {
    const a = ordersFor(day, CROPS, () => true);
    assert.equal(a.length, 3);
    assert.equal(new Set(a.map(o => o.who)).size, 3);
    assert.deepEqual(
      a,
      ordersFor(day, CROPS, () => true),
    );
  }
  assert.notDeepEqual(
    ordersFor(1, CROPS, () => true),
    ordersFor(2, CROPS, () => true),
  );
});

test('orders ask only for crops the chapter has opened and pay above market', () => {
  const s = freshState();
  for (let day = 1; day < 30; day++) {
    s.day = day;
    for (const o of todaysOrders(s)) {
      let worth = 0;
      for (const [id, n] of Object.entries(o.items)) {
        assert.ok(cropUnlock(id) <= s.chapter, id);
        worth += CROPS[id].sell * n;
      }
      assert.equal(o.reward, Math.round(worth * ORDER_BONUS));
    }
  }
});

test('delivering takes the crops, pays, warms the friendship, and only once a day', () => {
  const s = freshState();
  s.day = 3;
  const o = todaysOrders(s)[0];
  assert.equal(act(s, 'fillOrder', { index: 0 }).ok, false);
  for (const [id, n] of Object.entries(o.items)) s.inventory[id] = n + 1;
  const coins = s.coins;
  assert.equal(act(s, 'fillOrder', { index: 0 }).ok, true);
  assert.equal(s.coins, coins + o.reward);
  for (const id of Object.keys(o.items)) assert.equal(s.inventory[id], 1);
  assert.equal(s.friendship[o.who], 1);
  for (const [id, n] of Object.entries(o.items)) s.inventory[id] = n;
  assert.equal(act(s, 'fillOrder', { index: 0 }).ok, false);
  assert.equal(act(s, 'fillOrder', { index: 9 }).ok, false);
  const back = parseSave(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(back.orders, { day: 3, filled: [0] });
});

test('a filled record from another day is dropped', () => {
  assert.deepEqual(parseOrders({ day: 2, filled: [0, 1] }, 3), { day: 3, filled: [] });
  assert.deepEqual(parseOrders({ day: 3, filled: [1, 1, 7, 'x'] }, 3), { day: 3, filled: [1] });
  assert.deepEqual(parseOrders(null, 1), { day: 1, filled: [] });
});
