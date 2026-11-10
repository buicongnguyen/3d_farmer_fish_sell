import test from 'node:test';
import assert from 'node:assert/strict';
import { freshState, act } from '../src/game.mjs';
import { setLanguage } from '../src/i18n.mjs';
import { FAMILY_LINES, familyLine } from '../src/family.mjs';
import { loadStory } from '../src/story-rules.mjs';
import { en, vi, hasBoth } from '../src/story-text.mjs';

setLanguage('en');
await loadStory();
const at = (day, chapter, extra = {}) => Object.assign(freshState(), { day, chapter }, extra);

test('June and Pip each have at least 8 distinct lines, in two languages, none over 140 characters', () => {
  for (const who of ['june', 'pip']) {
    const mine = FAMILY_LINES.filter(l => l[0] === who);
    assert.ok(mine.length >= 12, `${who}: ${mine.length}`);
    assert.equal(new Set(mine.map(l => l[4])).size, mine.length);
    for (const l of mine) {
      assert.ok(hasBoth(l[4]));
      assert.ok(en(l[4]).length <= 140 && en(l[4]).length > 3);
      assert.notEqual(en(l[4]), vi(l[4]));
    }
  }
});

test('a line is never empty, for every day, chapter and speaker, and does not change within a day', () => {
  for (const who of ['june', 'pip'])
    for (let chapter = 0; chapter <= 8; chapter++)
      for (let day = 1; day <= 40; day++) {
        const s = at(day, chapter, { yesterday: { h: day % 2, f: day % 3 === 0 ? 1 : 0, s: 0 } });
        const line = familyLine(s, who);
        assert.ok(line && line.length > 3);
        assert.equal(familyLine(s, who), line);
        assert.equal(familyLine({ ...s, coins: 5 }, who), line, 'coins do not change it');
      }
});

test('the lines change across the days and the chapters', () => {
  for (const who of ['june', 'pip']) {
    const days = new Set();
    for (let day = 1; day <= 60; day++) days.add(familyLine(at(day, 5), who));
    assert.ok(days.size >= 5, `${who}: ${days.size} different lines in a chapter`);
    const early = new Set(),
      late = new Set();
    for (let day = 1; day <= 60; day++) {
      early.add(familyLine(at(day, 0), who));
      late.add(familyLine(at(day, 8), who));
    }
    assert.notDeepEqual([...early].sort(), [...late].sort());
  }
});

test('lines react to yesterday: a harvest, a catch, a sale, the rain', () => {
  const lines = (who, chapter, extra) => {
    const out = new Set();
    for (let day = 1; day <= 60; day++) out.add(familyLine(at(day, chapter, extra(day)), who));
    return out;
  };
  const sold = lines('june', 4, day => ({ day, yesterday: { h: 0, f: 0, s: 90 } }));
  assert.ok([...sold].some(l => l.includes('You sold well yesterday')));
  const fished = lines('june', 4, day => ({ day, yesterday: { h: 0, f: 3, s: 0 } }));
  assert.ok([...fished].some(l => l.includes('Fish for supper')));
  const harvested = lines('pip', 1, day => ({ day, yesterday: { h: 4, f: 0, s: 0 } }));
  assert.ok([...harvested].some(l => l.includes('carried the carrot')));
  const rainy = new Set();
  for (let seed = 0; seed < 30; seed++) rainy.add(familyLine(at(6, 7), 'pip', seed));
  assert.ok(
    [...rainy].some(l => l.includes('Rain. Pip, three puddles')),
    'day 6 follows the rain of day 5',
  );
});

test('Pip grows up: early lines are small, late lines are older', () => {
  const seen = chapter => {
    const out = new Set();
    for (let day = 1; day <= 80; day++)
      out.add(familyLine(at(day, chapter, { yesterday: { h: 1, f: 1, s: 1 } }), 'pip'));
    return out;
  };
  const early = seen(0),
    late = seen(7);
  assert.ok(![...early].some(l => late.has(l)), 'chapters 1 and 8 share no line for Pip');
  assert.ok([...early].some(l => l.includes('worm') || l.includes('stairs') || l.includes('carrot')));
  assert.ok([...late].some(l => l.includes('pond') || l.includes('doorframe') || l.includes('notebook')));
});

test('the talk action returns the family line for June and Pip', () => {
  const s = at(9, 3, { yesterday: { h: 1, f: 0, s: 0 } });
  assert.equal(act(s, 'talk', { id: 'pip' }).message, familyLine(s, 'pip'));
  assert.equal(act(s, 'talk', { id: 'june' }).message, familyLine(s, 'june'));
});

test('Vietnamese mode returns the Vietnamese half', () => {
  const s = at(9, 3);
  const english = familyLine(s, 'june');
  setLanguage('vi');
  const viet = familyLine(s, 'june');
  setLanguage('en');
  assert.notEqual(english, viet);
  assert.ok(/[à-ỹ]/.test(viet));
});
