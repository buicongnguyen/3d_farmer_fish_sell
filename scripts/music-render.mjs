// Renders every music piece offline (the real engine on an OfflineAudioContext inside Chromium), analyses it and writes 16-bit WAVs to listen to later.
//   node scripts/music-render.mjs                 render + analyse every piece, print the table, write WAVs
//   node scripts/music-render.mjs --calibrate     also rewrite src/music/trims.mjs: each piece lands on -20 dBFS RMS at the balanced tier, the battery and high tiers get their own offsets (TIER_TRIMS),
//                                                 and each stinger is trimmed to sit 3 dB over the village bed (STING). Phones: the table shows the level through a 350 Hz high-pass too (phone, loss).
//   ONLY=village,boss   some pieces    OUT=<folder>   WAV folder (default the notes folder's music-renders)    RATE=44100   sample rate (default 22050)
import { writeFile } from 'node:fs/promises';
import { offlinePage, metrics, writeWav, clickRatio, dB, rms, decode } from '../tests/music-analyse.mjs';

const calibrate = process.argv.includes('--calibrate'), only = process.env.ONLY?.split(','), rate = +(process.env.RATE ?? 22050);
const out = process.env.OUT ?? 'C:/Users/n/source/repos/cute_game-notes/willowmere/music-renders';
const TARGET = -20, root = new URL('..', import.meta.url).pathname.replace(/^\/(\w:)/, '$1').replace(/\/$/, '');
const { browser, page, render, info } = await offlinePage(root);
const { core, world } = await info(), ids = [...core, ...world].filter(id => !only || only.includes(id)), rows = [], trims = {};
const M = await import('../src/music/trims.mjs?' + Date.now()), TRIMS = M.default;
for (const id of ids) {
  const T = await page.evaluate(id => MusicOffline.loop(id), id), seconds = T <= 30 ? T * 2 : T + 3;
  const res = await render({ id, seconds, rate, tier: 'balanced', volume: 1 }), m = metrics(res);
  const click = clickRatio(m.l, m.rate, T, .005, .5, m.seconds), tr = (TRIMS[id] ?? 0) + (TARGET - m.rmsDb);
  trims[id] = Math.round(tr * 10) / 10; rows.push({ id, seconds: +seconds.toFixed(1), peakDb: +m.peakDb.toFixed(1), rmsDb: +m.rmsDb.toFixed(1), dc: +Math.max(m.dcL, m.dcR).toExponential(1), quietDb: +m.quietDb.toFixed(1), click: +click.toFixed(2), phone: +m.phoneDb.toFixed(1), loss: +(m.phoneDb - m.rmsDb).toFixed(1), low: +m.spec.low.toFixed(2), mid: +m.spec.mid.toFixed(2), high: +m.spec.high.toFixed(3), cen: Math.round(m.spec.centroid), stereoDb: +m.stereoDb.toFixed(2), voices: m.peakVoices, renderS: +(m.totalMs / 1000).toFixed(1), perMinute: +(m.totalMs / 1000 / (m.seconds / 60)).toFixed(1) });
  await writeWav(out, id, res);
}
console.table(rows);
if (calibrate) {
  const secondsOf = async id => { const T = await page.evaluate(id => MusicOffline.loop(id), id); return T <= 30 ? T * 2 : T + 3; }, r1 = x => Math.round(x * 10) / 10;
  const level = async (id, tier, total) => metrics(await render({ id, seconds: await secondsOf(id), rate, tier, volume: 1, trims: { [id]: total } })).rmsDb;
  // A phone speaker loses the lows: a piece that loses more than 5 dB through the 350 Hz high-pass is lifted by half the excess, at most 1.5 dB (it stays inside the 3 dB spread).
  const aim = Object.fromEntries(rows.map(r => [r.id, TARGET + Math.max(0, Math.min(1.5, (-r.loss - 5) * .5))]));
  const base = {}, tierTrims = [{}, {}, {}];
  for (const id of ids) { let t = trims[id]; for (let k = 0; k < 2; k++) t += aim[id] - await level(id, 'balanced', t); base[id] = r1(t); }
  for (const [ti, tier] of [[0, 'battery'], [2, 'high']]) for (const id of ids) { let t = base[id]; for (let k = 0; k < 2; k++) t += aim[id] - await level(id, tier, t); const off = r1(t - base[id]); if (Math.abs(off) >= .3) tierTrims[ti][id] = off; }
  // Stingers: each alone, so its RMS over its own length (and a tail of .2 s) is the village bed's RMS plus 3 dB.
  const bed = metrics(await render({ id: 'village', seconds: 46, rate, tier: 'balanced', volume: 1, trims: { village: base.village } })).rmsDb, sting = {}; console.log(`village bed ${bed.toFixed(1)} dBFS; stingers aim at ${(bed + 3).toFixed(1)}`);
  for (const name of (await info()).stingers) { let x = 0; for (let k = 0; k < 3; k++) { const res = await page.evaluate(o => MusicOffline.sting(o), { name, seconds: 8, rate, sting: { [name]: x } }), l = decode(res.l), r = decode(res.r), n = Math.min(l.length, Math.ceil((res.len + .2) * rate)), v = 10 * Math.log10((rms(l, 0, n) ** 2 + rms(r, 0, n) ** 2) / 2); x += bed + 3 - v; x = Math.max(-14, Math.min(9, x)); } sting[name] = r1(x); }
  const lit = o => JSON.stringify(o).replace(/"(\w+)":/g, '$1: ').replace(/,/g, ', ').replace(/^\{(.)/, '{ $1').replace(/(.)\}$/, '$1 }');
  const text = [`// Per-piece loudness trims in dB so every piece reads about ${TARGET} dBFS RMS at full music volume at the balanced tier. Written by \`node scripts/music-render.mjs --calibrate\`.`, `export default ${lit({ ...TRIMS, ...base })};`,
    '/** Offsets added to the base trims at the battery (0) and high (2) tiers: each tier has layers of its own (percussion, extra voices) and so lands on its own level. */', `export const TIER_TRIMS = [${tierTrims.map(lit).join(', ')}];`,
    "/** A stinger's trim in dB: each lands about 3 dB above the village bed (design 5.2). */", `export const STING = ${lit(sting)};`, ''].join('\n');
  await writeFile(new URL('../src/music/trims.mjs', import.meta.url), text); console.log('trims written', JSON.stringify(tierTrims), JSON.stringify(sting));
}
await browser.close();
