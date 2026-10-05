// Measures the village in all 16 times of day x seasons (three passes each) and fits the level compensation VCOMP in scores-core.mjs so that morning and day sit together,
// the evening 1 dB and the night 2 dB under them (design: at most 3 dB apart).
//   node scripts/music-vary.mjs            print the table of levels (dBFS RMS at full volume) and the spread
//   node scripts/music-vary.mjs --fit      also rewrite VCOMP (run twice: the limiter and the bass enhancer bend the first guess)
//   TIER=high   the tier to render (default balanced)
import { readFile, writeFile } from 'node:fs/promises';
import { offlinePage, metrics } from '../tests/music-analyse.mjs';

const fit = process.argv.includes('--fit'), tier = process.env.TIER ?? 'balanced', TODS = ['morning', 'day', 'evening', 'night'], SEASONS = ['spring', 'summer', 'autumn', 'winter'], OFF = { morning: 0, day: 0, evening: -1, night: -2 };
const root = new URL('..', import.meta.url).pathname.replace(/^\/(\w:)/, '$1').replace(/\/$/, '');
const { browser, page, render } = await offlinePage(root), { VCOMP } = await import('../src/music/scores-core.mjs?' + Date.now()), table = {}, comp = {};
for (const tod of TODS) { table[tod] = {}; comp[tod] = {}; for (const season of SEASONS) { const res = await render({ id: 'village', seconds: 138, rate: 22050, tier, volume: 1, variant: { tod, season, rain: false, riding: 0, farm: false } }); table[tod][season] = metrics(res).rmsDb; comp[tod][season] = VCOMP[tod]?.[season] ?? 0; } }
const ref = table.day.summer, all = TODS.flatMap(t => SEASONS.map(s => table[t][s] - OFF[t] - ref));
console.table(Object.fromEntries(TODS.map(t => [t, Object.fromEntries(SEASONS.map(s => [s, +table[t][s].toFixed(1)]))])));
console.log(`spread after removing the intended night and evening steps: ${(Math.max(...all) - Math.min(...all)).toFixed(1)} dB; the loudest variant ${Math.max(...TODS.flatMap(t => SEASONS.map(s => table[t][s]))).toFixed(1)}, the quietest ${Math.min(...TODS.flatMap(t => SEASONS.map(s => table[t][s]))).toFixed(1)}`);
if (fit) {
  const next = {}; for (const t of TODS) for (const s of SEASONS) { const c = Math.round((comp[t][s] + (ref + OFF[t] - table[t][s])) * 10) / 10; if (Math.abs(c) >= .1) (next[t] ??= {})[s] = c; }
  const p = new URL('../src/music/scores-core.mjs', import.meta.url); let src = await readFile(p, 'utf8'); src = src.replace(/export const VCOMP = \{.*\};/, `export const VCOMP = ${JSON.stringify(next).replace(/"(\w+)":/g, '$1: ').replace(/,/g, ', ').replace(/\{/g, '{ ').replace(/\}/g, ' }')};`); await writeFile(p, src); console.log('VCOMP written', JSON.stringify(next));
}
await browser.close();
