import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { freshState, parseSave, act, ACTIONS } from '../src/game.mjs';
import { CHAPTERS, RESIDENTS } from '../src/content.mjs';
import { setLanguage } from '../src/i18n.mjs';
import { SCENES, ENDINGS, sceneFor, endingFor, viewPending, allLines, missingVietnamese } from '../src/story.mjs';
import { CHAPTER_BEATS, FINAL_BEATS, ENDING_IDS, loadStory, hooks } from '../src/story-rules.mjs';
import { en } from '../src/story-text.mjs';
import { sceneHtml } from '../src/scene-view.mjs';

setLanguage('en');
await loadStory();
const WHO = new Set(['ada', 'june', 'pip', 'you', 'narrator', ...RESIDENTS.map(r => r.id)]);
const done = n => {
  const s = freshState();
  s.chapter = n;
  return s;
};
const raw = (s, i) => sceneFor(s, i, true);
const dir = new URL('./fixtures/saves/', import.meta.url);
const fixture = name => JSON.parse(readFileSync(new URL(name, dir), 'utf8'));

test('there is one scene per chapter, each with 4 to 8 beats and a known speaker, matching the lengths the rules use', () => {
  assert.equal(SCENES.length, CHAPTERS.length);
  SCENES.forEach((_, i) => {
    const beats = raw(done(i + 1), i);
    assert.ok(beats.length >= 4 && beats.length <= 8, `chapter ${i}: ${beats.length} beats`);
    assert.equal(beats.length, i === 7 ? FINAL_BEATS.open : CHAPTER_BEATS[i], `chapter ${i} length in story-rules.mjs`);
    for (const b of beats) assert.ok(WHO.has(b.who), `${b.who} in chapter ${i}`);
  });
  const chosen = done(8);
  chosen.ending = 'stay';
  assert.equal(raw(chosen, 7).length, FINAL_BEATS.chosen);
});

test('every line has an English and a Vietnamese half, and no English line is over 140 characters', () => {
  assert.deepEqual(missingVietnamese(), []);
  for (const line of allLines()) {
    assert.ok(en(line).length <= 140, `${en(line).length}: ${en(line)}`);
    assert.ok(en(line).length > 3);
  }
});

test('scenes react to what the player did', () => {
  const text = (s, i) =>
    raw(s, i)
      .map(b => b.text)
      .join('\n');
  const a = done(2),
    b = done(2);
  b.stats.harvests = 12;
  assert.notEqual(text(a, 1), text(b, 1));
  b.stats.fish = 9;
  assert.notEqual(text(a, 2), text(b, 2));
  const c = done(4),
    d = done(4);
  d.stats.feeds = 8;
  assert.notEqual(text(c, 4), text(d, 4));
  const e = done(8),
    f = done(8);
  f.projects = { well: 3, cart: 4 };
  assert.notEqual(text(e, 7), text(f, 7));
  const g = done(6),
    h = done(6);
  h.friendship.hugo = 6;
  assert.notEqual(text(g, 6), text(h, 6));
  const lanterns = done(6);
  lanterns.projects = { lanterns: 9 };
  assert.notEqual(text(g, 5), text(lanterns, 5));
});

test('claiming a chapter queues its scene; sceneNext walks it and removes it at the end', () => {
  const s = freshState();
  s.met.ada = true;
  assert.equal(act(s, 'claim').ok, true);
  assert.deepEqual(s.pendingScenes, [{ k: 'c', i: 0, b: 0 }]);
  const view = viewPending(s);
  assert.equal(view.total, CHAPTER_BEATS[0]);
  for (let i = 1; i < view.total; i++) assert.equal(act(s, 'sceneNext').ok, true);
  assert.equal(viewPending(s).index, view.total - 1);
  assert.equal(act(s, 'sceneNext').ok, true);
  assert.deepEqual(s.pendingScenes, []);
  assert.equal(act(s, 'sceneNext').ok, false);
});

function toTheChoice() {
  const s = freshState();
  s.chapter = 7;
  s.trees = [{ kind: 'apple', day: 1, picked: 0 }, { kind: 'apple', day: 1, picked: 0 }, null];
  s.upgrades.pond = 2;
  for (const r of RESIDENTS.slice(0, 12)) s.met[r.id] = true;
  assert.equal(act(s, 'claim').ok, true);
  assert.equal(s.chapter, 8);
  return s;
}

test('the final choice has two exclusive endings; each changes the last scene and the closing text', () => {
  const out = {};
  for (const id of ENDING_IDS) {
    const s = toTheChoice();
    assert.equal(endingFor(s), null);
    assert.equal(viewPending(s).total, FINAL_BEATS.open);
    for (let i = 0; i < FINAL_BEATS.choiceAt; i++) assert.equal(act(s, 'sceneNext').ok, true);
    const last = viewPending(s).beat;
    assert.deepEqual(
      last.choices.map(c => c.id),
      ENDING_IDS,
    );
    assert.match(sceneHtml(last, 5, 6), /data-type="choose" data-id="stay"/);
    assert.match(sceneHtml(last, 5, 6), /data-type="choose" data-id="share"/);
    assert.equal(act(s, 'sceneNext').ok, false, 'the scene waits for the choice');
    assert.equal(act(s, 'choose', { id: 'nonsense' }).ok, false);
    assert.equal(act(s, 'choose', { id }).ok, true);
    assert.equal(s.ending, id);
    const other = ENDING_IDS.find(x => x !== id);
    assert.equal(act(s, 'choose', { id: other }).ok, false, 'one time only');
    assert.equal(s.ending, id);
    const after = viewPending(s);
    assert.equal(after.total, FINAL_BEATS.chosen);
    assert.equal(after.index, FINAL_BEATS.choiceAt);
    assert.equal(after.beat.choices, undefined);
    while (s.pendingScenes.length) assert.equal(act(s, 'sceneNext').ok, true);
    out[id] = {
      scene: sceneFor(s, 7)
        .map(b => b.text)
        .join(' '),
      ending: endingFor(s),
    };
    assert.equal(parseSave(JSON.parse(JSON.stringify(s))).ending, id, 'the choice survives a save');
  }
  assert.notEqual(out.stay.scene, out.share.scene);
  assert.notEqual(out.stay.ending.closing, out.share.ending.closing);
  assert.equal(ENDING_IDS.length, 2);
  assert.ok(ENDINGS.stay && ENDINGS.share);
});

test('choose is refused before the last chapter is claimed', () => {
  const s = freshState();
  assert.equal(act(s, 'choose', { id: 'stay' }).ok, false);
  assert.equal(s.ending, '');
});

test('a save that finished the story before the choice existed is offered the choice', () => {
  const s = parseSave({ ...fixture('v2-midgame.json'), chapter: 8 });
  assert.equal(s.ending, '');
  act(s, 'talk', { id: 'ada' });
  const e = s.pendingScenes.find(x => x.k === 'c' && x.i === 7);
  assert.ok(e && e.b === FINAL_BEATS.choiceAt);
});

test('new actions are on the whitelist', () => {
  assert.ok(ACTIONS.has('choose') && ACTIONS.has('sceneNext'));
});

test('old saves still parse, with the new keys at their defaults; junk in the new keys is cleaned', () => {
  const names = readdirSync(dir).filter(f => /^v[12]-.*\.json$/.test(f) && !f.endsWith('.parsed.json'));
  assert.ok(names.length >= 5);
  for (const f of names) {
    const s = parseSave(fixture(f));
    if (f.startsWith('v1-')) {
      assert.deepEqual(s.pendingScenes, []);
      assert.equal(s.ending, '');
      assert.deepEqual(s.yesterday, { h: 0, f: 0, s: 0 });
      assert.ok(Object.values(s.heartScenes).every(v => v === 0));
    }
  }
  const odd = parseSave({
    ...fixture('v2-fresh.json'),
    chapter: 3,
    ending: 'stay',
    heartScenes: { ada: 99, ghost: 3, hugo: 'x' },
    pendingScenes: [
      { k: 'c', i: 99, b: 0 },
      { k: 'c', i: 7, b: 0 },
      { k: 'h', id: 'ghost', lv: 2 },
      { k: 'h', id: 'ada', lv: 5, b: 99 },
      7,
      null,
      { k: 'h', id: 'hugo', lv: 5, b: 99 },
    ],
    yesterday: { h: -3, f: 'x', s: 12.9 },
  });
  assert.equal(odd.ending, '', 'no ending before the last chapter');
  assert.equal(odd.heartScenes.ada, 7);
  assert.equal(odd.heartScenes.hugo, undefined);
  assert.equal(odd.heartScenes.ghost, undefined);
  assert.deepEqual(odd.pendingScenes, [{ k: 'h', id: 'hugo', lv: 5, b: 3 }]);
  assert.deepEqual(odd.yesterday, { h: 0, f: 0, s: 12 });
});

test('sceneHtml draws a beat with a portrait, the name, the text and a Next or Close button', () => {
  const beat = { who: 'ada', text: 'Come in <out> of the cold.' };
  const html = sceneHtml(beat, 0, 4, {});
  assert.match(html, /scene-portrait/);
  assert.match(html, /Ada/);
  assert.match(html, /&lt;out&gt;/);
  assert.match(html, /data-action="do" data-type="sceneNext"[^>]*>Next</);
  assert.match(sceneHtml(beat, 3, 4, {}), />Close</);
  assert.doesNotMatch(sceneHtml({ who: 'narrator', text: 'x y' }, 0, 4), /scene-portrait/);
  assert.match(sceneHtml({ who: 'you', text: 'Hi.' }, 0, 2, { you: 'Rowan' }), /Rowan/);
});

test('the lazy hooks are filled by loadStory', () => {
  assert.ok(hooks.story && hooks.family && hooks.lines);
});
