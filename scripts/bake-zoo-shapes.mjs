// node scripts/bake-zoo-shapes.mjs  ->  public/assets/models/zoo-shapes.bin
// Zoo Garden's shot and summon models and the skill painter's shapes, baked for src/zoo-paint.mjs (see scripts/zoo/bake-entry.mjs).
// Layout: u32 header bytes, the header as JSON ({models: {name: {flags, ext, halo, sparks, parts: [{g, t, m, d, an, n, o}]}}, verts}),
// then for every vertex int16 x y z (× ext / 32767 of its model) and, after all positions, uint8 r g b a (sRGB).
// A part: g 0 solid / 1 translucent / 2 additive; t takes the shot's colour; m 0 plain / 1 lit flat / 2 lit smooth / 3 ink shell;
// d decoration; an Zoo's animation of it (or absent); n vertices from vertex o. Parts with the same vertices share them.
import { build } from 'esbuild';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'zoo-bake-')), out = join(dir, 'bake.mjs');
await build({ entryPoints: ['scripts/zoo/bake-entry.mjs'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'warning' });
const { bake } = await import(pathToFileURL(out).href), models = bake();
await rm(dir, { recursive: true, force: true });

const header = { models: {}, verts: 0 }, pos = [], rgba = [], seen = new Map();
for (const [name, model] of Object.entries(models)) {
  let ext = 1e-6; for (const part of model.parts) for (let i = 0; i < part.list.length; i += 7) ext = Math.max(ext, Math.abs(part.list[i]), Math.abs(part.list[i + 1]), Math.abs(part.list[i + 2]));
  ext = +ext.toFixed(5);
  const parts = [];
  for (const part of model.parts) {
    const list = part.list, q = [], c = [];
    for (let i = 0; i < list.length; i += 7) { for (let k = 0; k < 3; k++) q.push(Math.round(list[i + k] / ext * 32767)); c.push(list[i + 3], list[i + 4], list[i + 5], list[i + 6]); }
    const key = ext + '|' + q.join() + '|' + c.join(); let o = seen.get(key);
    if (o === undefined) { seen.set(key, o = header.verts); for (const v of q) pos.push(v); for (const v of c) rgba.push(v); header.verts += list.length / 7; }
    const row = { g: part.g, t: part.t, m: part.m, n: list.length / 7, o }; if (part.d) row.d = 1; if (part.an) row.an = part.an; parts.push(row);
  }
  const m = header.models[name] = { flags: model.flags, ext, parts }; if (model.halo) m.halo = model.halo; if (model.sparks?.length) m.sparks = model.sparks;
}
let json = JSON.stringify(header); while (Buffer.byteLength(json) % 4) json += ' ';
const head = Buffer.from(json), buffer = Buffer.alloc(4 + head.length + header.verts * 6 + header.verts * 4);
buffer.writeUInt32LE(head.length, 0); head.copy(buffer, 4);
Buffer.from(new Int16Array(pos).buffer).copy(buffer, 4 + head.length); Buffer.from(new Uint8Array(rgba).buffer).copy(buffer, 4 + head.length + header.verts * 6);
await writeFile('public/assets/models/zoo-shapes.bin', buffer);
let rows = 0; const NAMES = ['', 'flap', 'puff', 'wob', 'swirl', 'flick', 'twinkle', 'zig', 'spinz', 'orbit', 'pulse'];
for (const [name, m] of Object.entries(header.models)) {
  for (const p of m.parts) rows += Math.ceil(p.n / 240);
  console.log(name.padEnd(18), m.parts.map(p => `${['solid', 'glow', 'add'][p.g]}${p.t ? '+tint' : ''}${['', '+lit', '+smooth', '+ink'][p.m]}${p.an ? '~' + NAMES[p.an[0]] : ''} ${p.n / 3}`).join(', '), m.halo ? 'halo ' + m.halo.join(' ') : '', m.sparks ? m.sparks.length + ' sparkle(s)' : '', JSON.stringify(m.flags));
}
console.log(`zoo-shapes.bin: ${buffer.length.toLocaleString('en-US')} bytes (header ${head.length.toLocaleString('en-US')}), ${header.verts / 3} triangles stored, ${rows} part rows`);
