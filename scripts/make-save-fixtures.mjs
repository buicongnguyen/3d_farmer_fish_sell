// Writes the golden save fixtures: node scripts/make-save-fixtures.mjs
// Each fixture is a raw save (`<name>.json`) and what parseSave makes of it (`<name>.parsed.json`).
// Re-run it ONLY when a change to the save format is meant (and add a migration); tests/save-schema.test.mjs compares against these files.
import { writeFileSync } from 'node:fs';
import { freshState, parseSave } from '../src/game.mjs';

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
mid.beds[0] = { crop: 'carrot', planted: 8800, watered: true };
mid.beds[1] = { crop: 'pumpkin', planted: 8000, watered: false };
mid.upgrades = { ...mid.upgrades, farm: 2 };
mid.met = { ...mid.met, ada: true };
mid.friendship = { ...mid.friendship, ada: 4 };
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
const fixtures = {
  'v1-fresh': freshState(),
  'v1-midgame': mid,
  // An old, sparse save: most fields missing or odd; the parser must fill, clamp and drop.
  'v1-sparse-odd': {
    version: 1,
    coins: -50,
    day: 'x',
    energy: 400,
    inventory: { carrot: 3, nonsense: 9 },
    settings: { quality: 'ultra', musicVol: '2' },
  },
};
for (const [name, raw] of Object.entries(fixtures)) {
  writeFileSync(new URL(`${name}.json`, dir), JSON.stringify(raw, null, 2) + '\n');
  writeFileSync(
    new URL(`${name}.parsed.json`, dir),
    JSON.stringify(parseSave(JSON.parse(JSON.stringify(raw))), null, 2) + '\n',
  );
}
console.log('wrote', Object.keys(fixtures).join(', '));
