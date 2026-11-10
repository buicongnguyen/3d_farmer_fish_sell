import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { freshState, parseSave } from '../src/game.mjs';
import {
  SAVE_VERSION,
  SETTINGS,
  SaveVersionError,
  defaultSettings,
  migrate,
  parseSettings,
} from '../src/save-schema.mjs';

const dir = new URL('./fixtures/saves/', import.meta.url);
const json = name => JSON.parse(readFileSync(new URL(name, dir), 'utf8'));
const clone = v => JSON.parse(JSON.stringify(v));

test('every setting in a fresh game has a row in the settings table, and every row is in a fresh game', () => {
  assert.deepEqual(Object.keys(freshState().settings).sort(), Object.keys(SETTINGS).sort());
  assert.deepEqual(freshState().settings, defaultSettings());
});

test('a default setting passes its own parser unchanged', () => {
  assert.deepEqual(parseSettings(defaultSettings()), defaultSettings());
  assert.deepEqual(parseSettings(undefined), defaultSettings());
  assert.deepEqual(parseSettings('junk'), defaultSettings());
});

test('settings that differ from the default survive a save and a load, so a new setting cannot be dropped', () => {
  const odd = {
    quality: 'high',
    sound: false,
    music: false,
    musicVol: 0.25,
    light: 'cycle',
    test: true,
    speed: 20,
    ambient: true,
  };
  assert.deepEqual(Object.keys(odd).sort(), Object.keys(SETTINGS).sort(), 'this test lists every setting');
  for (const [k, v] of Object.entries(odd))
    assert.notDeepEqual(v, SETTINGS[k].default, `${k} is not at its default here`);
  const s = freshState();
  s.settings = odd;
  assert.deepEqual(parseSave(clone(s)).settings, odd);
});

test('a bad setting falls back to its default', () => {
  const got = parseSettings({ quality: 'ultra', speed: 7, light: 'dusk', musicVol: 'loud', ambient: 'yes', sound: 0 });
  assert.equal(got.quality, 'balanced');
  assert.equal(got.speed, 1);
  assert.equal(got.light, 'day');
  assert.equal(got.musicVol, 0.7);
  assert.equal(got.ambient, false);
  assert.equal(got.sound, true, 'sound is off only when it is exactly false');
});

test('parsing a save twice gives the same save', () => {
  for (const file of readdirSync(dir).filter(f => /^v\d+-[\w-]+\.json$/.test(f))) {
    const once = parseSave(json(file));
    assert.deepEqual(parseSave(clone(once)), once, file);
  }
});

test('golden saves: each raw fixture still parses to the stored result', () => {
  const names = readdirSync(dir).filter(f => /^v\d+-[\w-]+\.json$/.test(f));
  assert.ok(names.length >= 3);
  for (const file of names) {
    const expected = json(file.replace('.json', '.parsed.json'));
    assert.deepEqual(
      clone(parseSave(json(file))),
      expected,
      `${file} changed; if the save format changed on purpose, add a migration and re-run scripts/make-save-fixtures.mjs`,
    );
  }
});

test('the golden saves are at a version the game can read', () => {
  for (const file of readdirSync(dir).filter(f => /^v\d+-[\w-]+\.json$/.test(f)))
    assert.ok(json(file).version <= SAVE_VERSION);
});

test('migrate lifts a save one version at a time, keeps what it does not change, and refuses the rest', () => {
  const steps = { 1: s => ({ ...s, coins: (s.coins ?? 0) + 1 }), 2: s => ({ ...s, renamed: s.old, old: undefined }) };
  const got = migrate({ version: 1, coins: 5, old: 'x', keep: true }, 3, steps);
  assert.deepEqual(got, { version: 3, coins: 6, renamed: 'x', old: undefined, keep: true });
  assert.equal(migrate({ version: 3, a: 1 }, 3, steps).a, 1, 'a save at the current version is returned as it is');
  assert.throws(
    () => migrate({ version: 4 }, 3, steps),
    e => e instanceof SaveVersionError && e.newer === true,
  );
  assert.throws(
    () => migrate({ version: 1 }, 3, {}),
    e => e instanceof SaveVersionError && e.newer === false,
  );
  for (const bad of [null, undefined, 'x', 5, {}, { version: 0 }, { version: 1.5 }, { version: '1' }])
    assert.throws(() => migrate(bad), SaveVersionError);
});

test('a save from a newer build is refused by parseSave, never half-read', () => {
  assert.throws(() => parseSave({ ...clone(freshState()), version: SAVE_VERSION + 1 }), SaveVersionError);
});
