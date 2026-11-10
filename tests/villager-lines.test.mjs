import test from 'node:test';
import assert from 'node:assert/strict';
import { freshState, parseSave, act, seedCost, REST_PER_DAY, sellPrice } from '../src/game.mjs';
import { ITEMS, RESIDENTS, CROPS } from '../src/content.mjs';
import { setLanguage } from '../src/i18n.mjs';
import {
  LINES,
  HEART_SCENES,
  REFUSALS,
  residentLine,
  refusalLine,
  allLines,
  missingVietnamese,
} from '../src/villager-lines.mjs';
import { heartBeats } from '../src/story.mjs';
import {
  GIFTS,
  PERKS,
  HEART_BEATS,
  HEART_LEVELS,
  KEY_VILLAGERS,
  heartPerks,
  giftTaste,
  loadStory,
} from '../src/story-rules.mjs';
import { en } from '../src/story-text.mjs';

setLanguage('en');
await loadStory();
const person = id => RESIDENTS.find(r => r.id === id);
const state = (day = 1, extra = {}) => Object.assign(freshState(), { day }, extra);
const play = s => {
  let guard = 0;
  while (s.pendingScenes.length && guard++ < 99) act(s, 'sceneNext');
};

test('there are eight key villagers with loved and disliked items that exist', () => {
  assert.equal(KEY_VILLAGERS.length, 8);
  for (const id of KEY_VILLAGERS) {
    assert.ok(person(id), id);
    const g = GIFTS[id];
    assert.ok(g.loved.length >= 2 && g.disliked.length >= 2, id);
    for (const item of [...g.loved, ...g.disliked]) assert.ok(ITEMS[item], `${id}: ${item} is not an item`);
    assert.equal(g.loved.filter(i => g.disliked.includes(i)).length, 0);
    assert.equal(giftTaste(id, g.loved[0]), 'loved');
    assert.equal(giftTaste(id, g.disliked[0]), 'disliked');
    assert.equal(giftTaste(id, 'iceberry'), 'liked');
    assert.ok(REFUSALS[id]);
  }
  assert.equal(giftTaste('kit', 'carrot'), 'liked');
});

test('every villager has rotating lines, in two languages, none over 140 characters', () => {
  assert.deepEqual(missingVietnamese(), []);
  for (const line of allLines()) assert.ok(en(line).length <= 140, en(line));
  for (const id of KEY_VILLAGERS)
    assert.ok(LINES[id].length >= 6 && LINES[id].length <= 10, `${id}: ${LINES[id].length}`);
  for (const p of RESIDENTS) {
    if (p.id === 'june' || p.id === 'pip' || KEY_VILLAGERS.includes(p.id)) continue;
    assert.ok(LINES[p.id]?.length >= 2 && LINES[p.id].length <= 3, `${p.id} needs 2 or 3 extra lines`);
  }
});

test('a line is never empty and is the same all day, for every resident', () => {
  for (const p of RESIDENTS) {
    if (p.id === 'june' || p.id === 'pip') continue;
    for (let day = 1; day <= 60; day += 3)
      for (const chapter of [0, 4, 8])
        for (const hearts of [0, 5, 10]) {
          const s = state(day, { chapter, friendship: { [p.id]: hearts } });
          const line = residentLine(s, p);
          assert.ok(line && line.length > 3, `${p.id} day ${day}`);
          assert.equal(residentLine({ ...s, coins: 999 }, p), line);
        }
  }
});

test('key villagers say different things on different days, seasons, chapters and hearts', () => {
  for (const id of KEY_VILLAGERS) {
    const p = person(id);
    const days = new Set();
    for (let day = 1; day <= 90; day++) days.add(residentLine(state(day, { chapter: 5, friendship: { [id]: 6 } }), p));
    assert.ok(days.size >= 5, `${id}: ${days.size} lines`);
    const cold = residentLine(state(1, { chapter: 0 }), p),
      warm = new Set();
    for (let day = 1; day <= 60; day++) warm.add(residentLine(state(day, { chapter: 8, friendship: { [id]: 10 } }), p));
    assert.ok(![...warm].every(l => l === cold));
  }
  assert.notEqual(
    residentLine(state(2, { chapter: 8, friendship: { ada: 10 } }), person('ada')),
    residentLine(state(3, { chapter: 0 }), person('ada')),
  );
  const hearty = new Set();
  for (let day = 1; day <= 60; day++) hearty.add(residentLine(state(day, { friendship: { hugo: 9 } }), person('hugo')));
  assert.ok([...hearty].some(l => l.includes('ovens are open')));
  const coldHearts = new Set();
  for (let day = 1; day <= 60; day++)
    coldHearts.add(residentLine(state(day, { friendship: { hugo: 0 } }), person('hugo')));
  assert.ok(![...coldHearts].some(l => l.includes('ovens are open')));
});

test('the talk action returns the rotating line, and still gives a friendship point a day', () => {
  const s = state(7, { chapter: 5 });
  const r = act(s, 'talk', { id: 'theo' });
  assert.equal(r.message, residentLine(s, person('theo')));
  assert.equal(s.friendship.theo, 1);
  act(s, 'talk', { id: 'theo' });
  assert.equal(s.friendship.theo, 1);
});

test('gifts: loved +4, ordinary +2, disliked 0 with a polite refusal and the item kept', () => {
  const s = state(3);
  s.inventory = { pie: 1, carrot: 1, chili: 1, daisy: 3 };
  assert.equal(act(s, 'gift', { id: 'ada', item: 'pie' }).ok, true);
  assert.equal(s.friendship.ada, 4);
  assert.equal(act(s, 'gift', { id: 'kit', item: 'carrot' }).ok, true);
  assert.equal(s.friendship.kit, 2);
  s.friendship.hugo = 0;
  const no = act(s, 'gift', { id: 'hugo', item: 'chili' });
  assert.equal(no.ok, false);
  assert.equal(no.message, refusalLine('hugo'));
  assert.equal(s.inventory.chili, 1, 'the item is kept');
  assert.equal(s.friendship.hugo, 0);
  assert.notEqual(s.gifted.hugo, s.day, 'a refused gift does not use the day');
  assert.equal(act(s, 'gift', { id: 'hugo', item: 'daisy' }).ok, true);
  assert.equal(s.friendship.hugo, 2);
  assert.equal(act(s, 'gift', { id: 'hugo', item: 'daisy' }).ok, false, 'one gift a day');
});

test('every heart scene has 3 to 5 beats of known speakers, matching the rules', () => {
  const who = new Set(['you', 'narrator', ...RESIDENTS.map(r => r.id)]);
  for (const id of KEY_VILLAGERS)
    for (const lv of HEART_LEVELS) {
      const beats = HEART_SCENES[id][lv];
      assert.ok(beats.length >= 3 && beats.length <= 5, `${id} ${lv}`);
      assert.equal(beats.length, HEART_BEATS[id][lv]);
      assert.ok(
        beats.some(b => b[0] === id),
        `${id} speaks in their own scene`,
      );
      for (const [w] of beats) assert.ok(who.has(w), w);
      assert.equal(heartBeats(state(), id, lv).length, beats.length);
    }
  assert.ok(HEART_LEVELS.join() === '2,5,8');
});

test('a heart scene is queued once, when the friendship crosses 2, 5 and 8, and never played inside act()', () => {
  const s = state(5);
  s.inventory.pie = 9;
  s.friendship.ada = 0;
  act(s, 'talk', { id: 'ada' });
  assert.deepEqual(s.pendingScenes, [], 'one heart is not enough');
  assert.equal(s.friendship.ada, 1);
  act(s, 'sleep');
  act(s, 'talk', { id: 'ada' });
  assert.equal(s.friendship.ada, 2);
  assert.deepEqual(s.pendingScenes, [{ k: 'h', id: 'ada', lv: 2, b: 0 }]);
  assert.equal(s.coins, 160, 'nothing was paid yet');
  act(s, 'sleep');
  act(s, 'talk', { id: 'ada' });
  assert.equal(s.pendingScenes.length, 1, 'not queued twice');
  play(s);
  assert.equal(s.heartScenes.ada, 1);
  assert.equal(s.inventory.pie, 10, 'the perk of 2 hearts: a pie');
  act(s, 'sleep');
  act(s, 'talk', { id: 'ada' });
  assert.deepEqual(s.pendingScenes, [], 'a played scene does not come back');
  s.friendship.ada = 10;
  act(s, 'sleep');
  act(s, 'talk', { id: 'ada' });
  assert.deepEqual(
    s.pendingScenes.map(e => e.lv),
    [5, 8],
  );
  play(s);
  assert.equal(s.heartScenes.ada, 7);
  act(s, 'sleep');
  act(s, 'talk', { id: 'ada' });
  assert.deepEqual(s.pendingScenes, []);
});

test('each of the 24 heart scene perks works', () => {
  for (const id of KEY_VILLAGERS)
    for (const lv of HEART_LEVELS) {
      const perk = PERKS[id][lv];
      const s = state(10);
      s.friendship[id] = lv;
      s.talked[id] = s.day;
      act(s, 'water', { index: 0 }); // any ok action; talk was done today
      s.pendingScenes = [];
      for (const l of HEART_LEVELS) if (l < lv) s.heartScenes[id] = (s.heartScenes[id] ?? 0) | { 2: 1, 5: 2, 8: 4 }[l];
      const before = { coins: s.coins, inv: { ...s.inventory }, perks: heartPerks(s), seed: seedCost(s, 'pumpkin') };
      act(s, 'rest');
      assert.deepEqual(
        s.pendingScenes.map(e => `${e.id}${e.lv}`),
        [`${id}${lv}`],
        `${id} ${lv} queued`,
      );
      assert.deepEqual(heartPerks(s), before.perks, 'lasting perks wait for the scene to end');
      play(s);
      assert.equal(s.heartScenes[id] & { 2: 1, 5: 2, 8: 4 }[lv], { 2: 1, 5: 2, 8: 4 }[lv]);
      if (perk.coins) assert.equal(s.coins, before.coins + perk.coins);
      for (const [item, n] of Object.entries(perk.items ?? {})) {
        assert.ok(ITEMS[item], item);
        assert.equal(s.inventory[item], (before.inv[item] ?? 0) + n);
      }
      const after = heartPerks(s);
      assert.ok(Math.abs(after.rest - before.perks.rest - (perk.rest ?? 0)) < 1e-9);
      assert.ok(Math.abs(after.sell - before.perks.sell - (perk.sell ?? 0)) < 1e-9);
      assert.ok(Math.abs(after.seeds - before.perks.seeds - (perk.seeds ?? 0)) < 1e-9);
      assert.equal(after.love - before.perks.love, perk.love ?? 0);
      if (perk.seeds) assert.ok(seedCost(s, 'pumpkin') < before.seed);
    }
});

test('the lasting perks change the rules: rests, selling price, seed cost and gift points', () => {
  const s = state(4);
  s.chapter = 8;
  s.coins = 5000;
  s.inventory = { carrot: 10, apple: 5, daisy: 1, tulip: 1, pie: 1 };
  const price = sellPrice(s, 'carrot'),
    seeds = seedCost(s, 'pumpkin');
  s.heartScenes = { ada: 2, ellis: 2, theo: 2, bea: 2 };
  assert.ok(sellPrice(s, 'carrot') >= price);
  assert.ok(seedCost(s, 'pumpkin') < seeds);
  let rests = 0;
  s.restDay = 0;
  while (act(s, 'rest').ok && rests < 9) rests++;
  assert.equal(rests, REST_PER_DAY + 1, 'Ada at 5 hearts: one more rest a day');
  const k = state(4);
  k.inventory = { daisy: 1 };
  k.heartScenes = { bea: 2 };
  act(k, 'gift', { id: 'kit', item: 'daisy' });
  assert.equal(k.friendship.kit, 2, 'the bonus is for the key villagers only');
  const k2 = state(4);
  k2.inventory = { carrot: 1 };
  k2.heartScenes = { bea: 2, nell: 2 };
  act(k2, 'gift', { id: 'oren', item: 'carrot' });
  const k3 = state(4);
  k3.inventory = { tulip: 1 };
  k3.heartScenes = { bea: 2, nell: 2 };
  act(k3, 'gift', { id: 'bea', item: 'tulip' });
  assert.equal(k3.friendship.bea, 6, 'loved gift 4 + two love perks');
});

test('heart scenes and the new keys survive a save and a load', () => {
  const s = state(9, { chapter: 2 });
  s.friendship.mara = 5;
  act(s, 'talk', { id: 'mara' });
  act(s, 'sceneNext');
  const back = parseSave(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(back.pendingScenes, s.pendingScenes);
  assert.deepEqual(back.heartScenes, s.heartScenes);
  assert.deepEqual(back.yesterday, s.yesterday);
  assert.ok(CROPS.carrot);
});

test('sleeping records yesterday: what was harvested, caught and sold', () => {
  const s = state(3);
  s.stats.harvests = 4;
  s.stats.fish = 2;
  s.stats.sales = 120;
  act(s, 'sleep');
  assert.deepEqual(s.yesterday, { h: 4, f: 2, s: 120 });
  s.stats.harvests = 5;
  act(s, 'sleep');
  assert.deepEqual(s.yesterday, { h: 1, f: 0, s: 0 });
});

test('Vietnamese mode returns Vietnamese text for a key villager and for the original line', () => {
  const s = state(1, { chapter: 0 });
  setLanguage('vi');
  const a = residentLine(s, person('ada')),
    k = residentLine(s, person('kit'));
  setLanguage('en');
  assert.match(a, /[à-ỹ]/);
  assert.ok(k.length > 3);
});
