import test from 'node:test';
import assert from 'node:assert/strict';
import { freshState, parseSave, act } from '../src/game.mjs';
import { ITEMS } from '../src/content.mjs';
import { FACILITIES } from '../src/facility-plans.mjs';
import { TALES, TALE_IDS, taleSpot, taleEvent, taleBeat, taleDone, decoratePlan, momentOf, taleList } from '../src/tales.mjs';

test('every building has a tale of four beats at spots it really has, asking for items that exist', () => {
  assert.deepEqual(TALE_IDS.sort(), Object.keys(FACILITIES).sort(), 'one tale per building');
  for (const id of TALE_IDS) {
    const tale = TALES[id], spots = new Set(FACILITIES[id].targets.filter(t => t.type === 'fun').map(t => t.id));
    assert.equal(tale.beats.length, 4, id); assert.ok(tale.beats[0].at, `${id} begins with a visit to the building`);
    for (const beat of tale.beats) {
      if (beat.at) assert.ok(spots.has(beat.at.slice(4)), `${id}: the spot ${beat.at} exists`);
      for (const item of Object.keys(beat.needs ?? {})) assert.ok(ITEMS[item], `${id}: ${item} is an item`);
      assert.ok(beat.ask && beat.line, `${id}: every beat says what to do and what happened`);
    }
    for (const m of tale.moments) assert.ok(spots.has(m.at), `${id}: the moment spot ${m.at} exists`);
    assert.ok(tale.reward.coins > 0 && tale.memory);
  }
});

test('the school tale: clues, three right answers, timber for a ladder, the bell; the reward once', () => {
  const s = freshState(); s.inventory.wood = 0; const coins = s.coins;
  assert.equal(taleEvent(s, 'answer').length, 0, 'answers count only once the tale has begun');
  assert.equal(taleSpot(s, 'school', 'yard'), null, 'a spot out of turn keeps its own line');
  assert.match(taleSpot(s, 'school', 'lockers').line, /straw/);
  for (let i = 0; i < 2; i++) assert.equal(taleEvent(s, 'answer').length, 0);
  assert.match(taleEvent(s, 'answer')[0].line, /crow/); assert.equal(taleBeat(s, 'school').at, 'fun:yard');
  const missing = taleSpot(s, 'school', 'yard'); assert.ok(missing.missing, 'without timber the spot says what it needs'); assert.equal(s.tales.school.step, 2);
  s.inventory.wood = 3; assert.match(taleSpot(s, 'school', 'yard').line, /bell/); assert.equal(s.inventory.wood, 1, 'two timber handed over');
  const end = taleSpot(s, 'school', 'trophy'); assert.ok(end.done); assert.equal(s.coins, coins + TALES.school.reward.coins); assert.ok(taleDone(s, 'school'));
  assert.equal(taleSpot(s, 'school', 'trophy'), null, 'a finished tale pays once');
});

test('actions move tales on: a check-up, a patrol, a feed, a shift, checkout sales, cooking', () => {
  const s = freshState();
  for (const [id, spot] of [['hospital', 'reception'], ['police', 'evidence'], ['company', 'boss'], ['supermarket', 'bins'], ['bakery', 'counter']]) taleSpot(s, id, spot);
  s.inventory.carrot = 9; taleSpot(s, 'hospital', 'pharmacy');
  assert.equal(taleEvent(s, 'civic', { id: 'hospital' })[0].tale, 'hospital');
  assert.equal(taleEvent(s, 'civic', { id: 'police' })[0].tale, 'police'); assert.equal(taleEvent(s, 'feed')[0].tale, 'police');
  assert.equal(taleEvent(s, 'civic', { id: 'company' })[0].tale, 'company');
  assert.equal(taleEvent(s, 'sell', { country: false }).length, 0, 'only sales at the supermarket checkout count');
  taleEvent(s, 'sell', { country: true }); taleEvent(s, 'sell', { country: true }); assert.equal(taleEvent(s, 'sell', { country: true })[0].tale, 'supermarket');
  s.inventory.pumpkin = 1; s.inventory.egg = 1; taleSpot(s, 'bakery', 'pantry'); assert.equal(taleEvent(s, 'cook')[0].tale, 'bakery');
});

test('a daily moment: one spot a day, a gift once, and its spot sparkles until then', () => {
  const s = freshState(); s.day = 4; const m = momentOf(s, 'company'), energy = s.energy = 50, coins = s.coins;
  const plan = decoratePlan(FACILITIES.company, s);
  assert.ok(plan.targets.find(t => t.type === 'fun' && t.id === 'boss').text.startsWith('✨'), 'the tale spot sparkles');
  assert.ok(plan.targets.find(t => t.type === 'fun' && t.id === m.at).text.startsWith('✨'), 'the moment spot sparkles');
  if (m.at !== 'boss') { const r = taleSpot(s, 'company', m.at); assert.equal(r.line, m.line); assert.ok(s.energy > energy || s.coins > coins); assert.equal(taleSpot(s, 'company', m.at), null, 'once a day'); }
  s.day = 5; assert.notEqual(momentOf(s, 'company').at === m.at && TALES.company.moments.length > 1, true, 'another spot the next day');
});

test('saves keep tales safely; the album lists every tale', () => {
  const s = freshState(); taleSpot(s, 'vale', 'bench'); s.taleMoments = { vale: 1 };
  const back = parseSave(JSON.parse(JSON.stringify({ ...s, tales: { ...s.tales, school: { step: 99, count: -4 }, nowhere: { step: 1 } }, taleMoments: { vale: 1, school: 999 } })));
  assert.deepEqual(back.tales.vale, { step: 1, count: 0 }); assert.equal(back.tales.school.step, 4); assert.equal(back.tales.nowhere, undefined);
  assert.deepEqual(back.taleMoments, { vale: 1 }, 'no moment claimed in the future');
  assert.equal(taleList(back).length, TALE_IDS.length);
  assert.ok(act(freshState(), 'sleep').ok, 'an old save without tales still plays');
});
