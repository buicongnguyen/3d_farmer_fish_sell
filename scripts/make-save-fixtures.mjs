// Writes the golden save fixtures: node scripts/make-save-fixtures.mjs
// Each fixture is a raw save (`<name>.json`) and what parseSave makes of it (`<name>.parsed.json`).
//  - The raw saves of OLDER versions (v1-*.json) are history: they are checked in and never rewritten, so a migration is always
//    tested against a real old save. Only their `.parsed.json` is refreshed.
//  - The raw saves of the CURRENT version (v<SAVE_VERSION>-*.json) are written here from the game's own state.
// Re-run it ONLY when a change to the save format or to the parser is meant (and add a migration for a format change);
// tests/save-schema.test.mjs compares against these files.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { freshState, parseSave } from '../src/game.mjs';
import { SAVE_VERSION } from '../src/save-schema.mjs';

const dir = new URL('../tests/fixtures/saves/', import.meta.url);
const mid = freshState();
Object.assign(mid, {
  started: true,
  day: 12,
  time: 15.5,
  elapsed: 9000,
  coins: 4200,
  energy: 61,
  chapter: 3,
  plots: 6,
});
mid.inventory = { seed_carrot: 4, carrot: 9, seed_pumpkin: 1 };
mid.beds[0] = { crop: 'carrot', grown: 1, watered: false };
mid.beds[1] = { crop: 'pumpkin', grown: 2, watered: true };
mid.upgrades = { ...mid.upgrades, farm: 2 };
mid.met = { ...mid.met, ada: true };
mid.friendship = { ...mid.friendship, ada: 4 };
mid.restDay = 12;
mid.restCount = 1;
mid.settings = {
  quality: 'high',
  sound: false,
  music: true,
  musicVol: 0.3,
  light: 'cycle',
  test: false,
  speed: 5,
  ambient: true,
};
const current = { [`v${SAVE_VERSION}-fresh`]: freshState(), [`v${SAVE_VERSION}-midgame`]: mid };
for (const [name, raw] of Object.entries(current))
  writeFileSync(new URL(`${name}.json`, dir), JSON.stringify(raw, null, 2) + '\n');
const names = readdirSync(dir).filter(f => /^v\d+-[\w-]+\.json$/.test(f));
for (const file of names) {
  const raw = JSON.parse(readFileSync(new URL(file, dir), 'utf8'));
  writeFileSync(new URL(file.replace('.json', '.parsed.json'), dir), JSON.stringify(parseSave(raw), null, 2) + '\n');
}
console.log('wrote', names.join(', '));
