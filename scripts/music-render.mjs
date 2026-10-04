// Renders every music piece offline (the real engine on an OfflineAudioContext inside Chromium), analyses it and writes 16-bit WAVs to listen to later.
//   node scripts/music-render.mjs                 render + analyse every piece, print the table, write WAVs
//   node scripts/music-render.mjs --calibrate     also rewrite src/music/trims.mjs so each piece lands on -20 dBFS RMS (run twice: the limiter bends the first guess)
//   ONLY=village,boss   some pieces    OUT=<folder>   WAV folder (default the notes folder's music-renders)    RATE=44100   sample rate (default 22050)
import { writeFile } from 'node:fs/promises';
import { offlinePage, metrics, writeWav, clickRatio, dB } from '../tests/music-analyse.mjs';

const calibrate = process.argv.includes('--calibrate'), only = process.env.ONLY?.split(','), rate = +(process.env.RATE ?? 22050);
const out = process.env.OUT ?? 'C:/Users/n/source/repos/cute_game-notes/willowmere/music-renders';
const TARGET = -20, root = new URL('..', import.meta.url).pathname.replace(/^\/(\w:)/, '$1').replace(/\/$/, '');
const { browser, page, render, info } = await offlinePage(root);
const { core, world } = await info(), ids = [...core, ...world].filter(id => !only || only.includes(id)), rows = [], trims = {};
const TRIMS = (await import('../src/music/trims.mjs?' + Date.now())).default;
for (const id of ids) {
  const T = await page.evaluate(id => MusicOffline.loop(id), id), seconds = T <= 30 ? T * 2 : T + 3;
  const res = await render({ id, seconds, rate, tier: 'balanced', volume: 1 }), m = metrics(res);
  const click = clickRatio(m.l, m.rate, T, .005, .5, m.seconds), tr = (TRIMS[id] ?? 0) + (TARGET - m.rmsDb);
  trims[id] = Math.round(tr * 10) / 10; rows.push({ id, seconds: +seconds.toFixed(1), peakDb: +m.peakDb.toFixed(1), rmsDb: +m.rmsDb.toFixed(1), dc: +Math.max(m.dcL, m.dcR).toExponential(1), quietDb: +m.quietDb.toFixed(1), click: +click.toFixed(2), low: +m.spec.low.toFixed(2), mid: +m.spec.mid.toFixed(2), high: +m.spec.high.toFixed(3), cen: Math.round(m.spec.centroid), stereoDb: +m.stereoDb.toFixed(2), voices: m.peakVoices, renderS: +(m.totalMs / 1000).toFixed(1), perMinute: +(m.totalMs / 1000 / (m.seconds / 60)).toFixed(1) });
  await writeWav(out, id, res);
}
console.table(rows);
if (calibrate) { await writeFile(new URL('../src/music/trims.mjs', import.meta.url), `// Per-piece loudness trims in dB so every piece reads about ${TARGET} dBFS RMS at full music volume. Written by \`node scripts/music-render.mjs --calibrate\`.\nexport default ${JSON.stringify({ ...TRIMS, ...trims }, null, 1).replace(/\n\s*/g, ' ')};\n`); console.log('trims written'); }
await browser.close();
