// Keeps recently published chunks in the next deploy (run in CI after `npm run build`, before the Pages upload).
//
// Why: game.js loads most of the game in chunk-<hash>.js files, some only when needed (a house interior, the creatures
// when the Pandora box opens). Each deploy used to publish only the new build, so a phone that loaded the game shortly
// before a release (GitHub Pages lets browsers keep files for ten minutes, and a tab can stay open for hours) asked for
// chunks that no longer existed: the village, houses or creatures failed to load. Old and new chunks never clash (the
// name is the content hash), so the deploy now also carries every chunk published in the last KEEP_DAYS days.
//
// The list lives on the site itself as assets/chunks.json ({ "chunk-X.js": "first published ISO date", ... }).
// Network trouble never fails a deploy: the build is published as it is, with a warning.
//
//   node scripts/keep-chunks.mjs [site URL]     (default: the Pages URL of this repository)
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';

const SITE = (process.argv[2] ?? process.env.SITE_URL ?? 'https://buicongnguyen.github.io/3d_farmer_fish_sell').replace(/\/$/, '');
const KEEP_DAYS = 7, DIR = 'dist/assets', NAME = /chunk-[A-Z0-9]+\.js/g;
const now = new Date(), cutoff = now.getTime() - KEEP_DAYS * 864e5;
const get = async (path, type = 'text') => { const r = await fetch(`${SITE}/${path}`, { cache: 'no-store' }); if (!r.ok) throw new Error(`${r.status} ${path}`); return type === 'text' ? r.text() : Buffer.from(await r.arrayBuffer()); };

const built = new Set((await readdir(DIR)).filter(f => /^chunk-[A-Z0-9]+\.js$/.test(f)));
let kept = {};
try { kept = JSON.parse(await get('assets/chunks.json')); }
catch {
  // First run (no list on the site yet): what the live game.js imports, directly or through other chunks.
  try {
    const page = await get(''), entry = page.match(/assets\/game\.js[^"']*/)?.[0] ?? 'assets/game.js', seen = new Set(), queue = [...(await get(entry)).matchAll(NAME)].map(m => m[0]);
    while (queue.length) { const name = queue.pop(); if (seen.has(name)) continue; seen.add(name); try { for (const m of (await get(`assets/${name}`)).matchAll(NAME)) queue.push(m[0]); } catch {} }
    for (const name of seen) kept[name] = now.toISOString();
  } catch (error) { console.warn(`keep-chunks: the live site could not be read (${error.message}); publishing this build only.`); }
}
let added = 0, failed = 0, bytes = 0;
const next = {};
for (const [name, since] of Object.entries(kept)) {
  if (!/^chunk-[A-Z0-9]+\.js$/.test(name) || !(Date.parse(since) >= cutoff)) continue;
  next[name] = since;
  if (built.has(name)) continue;
  try { const body = await get(`assets/${name}`, 'buffer'); await writeFile(`${DIR}/${name}`, body); added++; bytes += body.length; }
  catch { failed++; delete next[name]; }
}
for (const name of built) next[name] ??= now.toISOString();
await writeFile(`${DIR}/chunks.json`, JSON.stringify(next, null, 0));
let total = 0; for (const name of Object.keys(next)) total += (await stat(`${DIR}/${name}`)).size;
console.log(`keep-chunks: ${built.size} built, ${added} kept from earlier deploys (${(bytes / 1e6).toFixed(2)} MB)${failed ? `, ${failed} no longer on the site` : ''}; ${Object.keys(next).length} chunks, ${(total / 1e6).toFixed(1)} MB published.`);
