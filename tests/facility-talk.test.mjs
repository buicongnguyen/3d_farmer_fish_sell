// The conversations by choice (src/talk-*.mjs) and the things that answer a tap (src/talk-things.mjs): every question has exactly
// three answers, every `next` exists, every line has its Vietnamese, everyone who can be inside a building has a conversation that
// fits; the day's memory deals another tree the second time, caps the little effects, and old saves load.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validate, measure, pair, dealTree, listsFor, remember, applyEffect, memory, fits, ENERGY_TIP, PANELS } from '../src/facility-talk.mjs';
import { THINGS, thingAnswer, thingLines } from '../src/talk-things.mjs';
import { FACILITIES, occupants } from '../src/facility-plans.mjs';
import { RESIDENTS, WORKPLACE } from '../src/content.mjs';
import { CALLS, slotOf } from '../src/villagers.mjs';
import { freshState, parseSave, act } from '../src/game.mjs';

const TOWN = ['school', 'hospital', 'police', 'supermarket', 'company'], TABLES = Object.fromEntries(await Promise.all(TOWN.map(async id => [id, (await import(`../src/talk-${id}.mjs`)).default]))), COMMON = (await import('../src/talk-common.mjs')).default;
const vietnamese = /[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i;

test('every tree is sound: three answers to every question, every next exists, 2 to 4 questions deep, English and Vietnamese on every line', () => {
  let trees = 0, lines = 0; const ids = new Set();
  for (const [name, table] of [...Object.entries(TABLES), ['common', COMMON]]) {
    assert.deepEqual(validate(table, name), [], name); const m = measure(table); trees += m.trees; lines += m.lines;
    for (const list of Object.values(table)) for (const tree of list) {
      assert.ok(!ids.has(tree.id), `${tree.id} is used once`); ids.add(tree.id);
      for (const node of Object.values(tree.nodes)) for (const text of [node.say, ...node.choices.flatMap(c => [c[0], c[1]])]) {
        const [en, vi] = pair(text); assert.ok(vi.trim() && (en.length < 26 || vietnamese.test(vi) && en !== vi), `${tree.id}: Vietnamese for "${en.slice(0, 40)}"`);
        assert.ok(!/[—–`]|\$\{/.test(text) && !/^Theo /.test(vi), `${tree.id}: plain punctuation ("${en.slice(0, 40)}")`); assert.ok(en.length <= 180 && vi.length <= 180, `${tree.id}: a short line`);
      }
    }
  }
  assert.ok(trees >= 100 && lines >= 1400, `${trees} trees, ${lines} lines`);
  // The people: at least 4 trees for the main ones (the first always fits), 2 for a pupil, a role table for the callers of each building.
  for (const id of TOWN) {
    const plan = FACILITIES[id], table = TABLES[id];
    for (const who of Object.keys(plan.staff)) { assert.ok(table[who].filter(t => !t.when?.night).length >= 4, `${who} has four conversations`); assert.equal(table[who][0].when, undefined, `${who}: the first always fits`); }
    assert.ok(table['@' + plan.role].filter(t => !t.when?.who).length >= 2, `${id}: two conversations any caller can have`);
    for (const who of Object.keys(plan.lodgers ?? {})) assert.ok(table[who].some(t => t.when?.night), `${who} has an evening at home`);
  }
  for (const kid of RESIDENTS.filter(p => p.child)) assert.ok(TABLES.school[kid.id].length >= 2, kid.id);
  for (const [key, text] of thingLines()) { const [en, vi] = pair(text); assert.ok(en.length > 8 && vietnamese.test(vi), `${key}: "${en.slice(0, 40)}"`); }
  for (const key of Object.keys(THINGS)) { const [id, spot] = key.split(':'); assert.ok(FACILITIES[id].targets.some(t => t.type === 'fun' && t.id === spot), `${key} is a thing in the plan`); }
  assert.ok(Object.keys(THINGS).length >= 28);
});
test('whoever is inside has something to say; the day remembers; effects are capped; old saves load', () => {
  for (const id of TOWN) for (const day of [1, 2, 3, 5, 10]) for (const time of [7.2, 9, 10, 11.7, 12.5, 13.5, 15, 16.3, 21]) {
    const s = Object.assign(freshState(), { day, time }), plan = FACILITIES[id];
    for (const o of occupants(plan, s, RESIDENTS, slotOf)) {
      const lists = listsFor(TABLES[id], o.p.id, o.role === 'guest' ? plan.role : null), tree = dealTree(lists.flat(), s, o.p.id, o.role === 'home', o.p.index);
      assert.ok(tree, `${id} day ${day} ${time}: ${o.p.id} (${o.role}) has a conversation`); assert.ok(!tree.when?.who || tree.when.who === o.p.id);
    }
  }
  for (const who of Object.keys(CALLS)) assert.ok(!WORKPLACE[who] || !FACILITIES[WORKPLACE[who]], `${who} has no Town Square job`);
  // The same person twice in a day: another tree; all used up: they start again. A new day forgets.
  const s = Object.assign(freshState(), { time: 10 }), cora = TABLES.school.cora, first = dealTree(cora, s, 'cora'); remember(s, first);
  const second = dealTree(cora, s, 'cora'); assert.notEqual(second.id, first.id); for (const t of cora) remember(s, t); assert.ok(dealTree(cora, s, 'cora'));
  assert.ok(fits(cora.find(t => t.when?.night), { ...s, time: 21 }, 'cora', true) && !fits(cora[0], s, 'cora', true) && !fits(cora.find(t => t.when?.night), s, 'cora', false));
  assert.ok(dealTree(COMMON['@cover'], s, 'ada'));
  // Effects: a panel effect only opens an existing panel; the pick-me-up is +5 once a day; a thing's sweet once a day; no coins, ever.
  for (const effect of Object.keys(PANELS)) assert.ok(applyEffect(s, effect).panel);
  s.energy = 50; const coins = s.coins; assert.equal(applyEffect(s, 'energy').energy, ENERGY_TIP); assert.equal(applyEffect(s, 'energy').energy, 0); assert.equal(s.energy, 55);
  assert.equal(thingAnswer(s, 'company', 'coffee').energy, 5); assert.equal(thingAnswer(s, 'company', 'coffee').energy, undefined); assert.equal(thingAnswer(s, 'supermarket', 'sample').energy, 3); assert.equal(s.energy, 63);
  for (let i = 0; i < 30; i++) for (const key of Object.keys(THINGS)) { const [id, spot] = key.split(':'); assert.ok(thingAnswer(s, id, spot).text[0]); }
  assert.equal(s.energy, 63); assert.equal(s.coins, coins);
  assert.ok(thingAnswer(s, 'supermarket', 'shelves', true).text[0] && THINGS['supermarket:shelves'].prices.length);
  // The suggestion box: a note today, the same note waiting, an answer tomorrow.
  const box = Object.assign(freshState(), { day: 4 }); assert.match(thingAnswer(box, 'company', 'box').text[0], /drop it in/); assert.match(thingAnswer(box, 'company', 'box').text[0], /in the box/);
  box.day = 5; assert.match(thingAnswer(box, 'company', 'box').text[0], /reply is pinned/); assert.equal(memory(box).note, 0);
  s.day++; assert.deepEqual(memory(s).seen, {}); assert.equal(applyEffect(s, 'energy').energy, ENERGY_TIP);
  // Saves: the memory survives a save and a load; an old save (no `chat`) and a broken one get the default.
  const kept = parseSave(JSON.parse(JSON.stringify(s))); assert.deepEqual(kept.chat, s.chat);
  const old = JSON.parse(JSON.stringify(freshState())); delete old.chat; assert.deepEqual(parseSave(old).chat, freshState().chat);
  assert.deepEqual(parseSave({ ...old, chat: { day: 'x', seen: 7, used: null, note: -3 } }).chat, freshState().chat);
  // Talking still makes friends once a day, as outdoors.
  const f = freshState(); act(f, 'talk', { id: 'cora' }); act(f, 'talk', { id: 'cora' }); assert.equal(f.friendship.cora, 1);
  assert.ok(fs.readFileSync(new URL('../src/main.mjs', import.meta.url), 'utf8').includes("import('./facility-talk-view.mjs')"), 'the talk view is fetched on demand');
});
