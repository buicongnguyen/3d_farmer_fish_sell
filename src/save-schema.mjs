// The save's versioning and its settings table, kept apart from the game rules.
//
// A save carries `version`. parseSave (game.mjs) first runs `migrate`, which brings an older save up one version at a time,
// then validates every field. To change the save's shape: raise SAVE_VERSION, add MIGRATIONS[oldVersion] (a pure function from
// the old raw object to the new one), and add a golden fixture under tests/fixtures/saves/ (tests/save-schema.test.mjs).
//
// A setting is one row of SETTINGS. A row without a default is a test failure (tests/save-schema.test.mjs), so a new setting can
// no longer be silently dropped when the game loads (the "ambient" bug of 2026-10-29).

export const SAVE_VERSION = 1;

/** Steps that lift a raw save one version: MIGRATIONS[n] turns a version-n save into a version-(n+1) save. */
export const MIGRATIONS = {};

export class SaveVersionError extends Error {
  constructor(message, newer) {
    super(message);
    this.name = 'SaveVersionError';
    this.newer = newer;
  }
}

/** The raw save at the current version. Throws SaveVersionError for something that is not a save or comes from a newer build. */
export function migrate(raw, target = SAVE_VERSION, steps = MIGRATIONS) {
  if (!raw || typeof raw !== 'object' || !Number.isInteger(raw.version) || raw.version < 1)
    throw new SaveVersionError('This is not a Willowmere save.', false);
  if (raw.version > target) throw new SaveVersionError('This save was made by a newer version of Willowmere.', true);
  let save = raw;
  while (save.version < target) {
    const step = steps[save.version];
    if (!step) throw new SaveVersionError(`No migration from save version ${save.version}.`, false);
    save = { ...step(save), version: save.version + 1 };
  }
  return save;
}

const pick = (list, fallback) => v => (list.includes(v) ? v : fallback);
const volume = v => {
  v = v == null || v === '' ? NaN : +v;
  return v >= 0 ? Math.min(v, 1) : v < 0 ? 0 : 0.7;
};

/** Every setting: its default and how a raw value is cleaned. `on` means anything but an explicit false is on (older saves had no key). */
export const SETTINGS = {
  quality: { default: 'balanced', parse: pick(['high', 'balanced', 'battery'], 'balanced') },
  sound: { default: true, parse: v => v !== false },
  music: { default: true, parse: v => v !== false },
  musicVol: { default: 0.7, parse: volume },
  light: { default: 'day', parse: v => (v === 'cycle' ? 'cycle' : 'day') },
  test: { default: false, parse: v => v === true },
  speed: { default: 1, parse: pick([1, 5, 20], 1) },
  ambient: { default: false, parse: v => v === true },
};

export const defaultSettings = () => Object.fromEntries(Object.entries(SETTINGS).map(([k, row]) => [k, row.default]));

export const parseSettings = raw =>
  Object.fromEntries(
    Object.entries(SETTINGS).map(([k, row]) => [k, row.parse(raw && typeof raw === 'object' ? raw[k] : undefined)]),
  );
