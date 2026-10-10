// node scripts/bake-zoo-shapes.mjs  ->  public/assets/models/zoo-shapes.bin
// Zoo Garden's shot and summon models and the skill painter's shapes, baked for src/zoo-paint.mjs (see scripts/zoo/bake-entry.mjs).
// Layout: u32 header bytes, the header as JSON ({models: {name: {flags, ext, parts: [{g, t, n, o}]}}, verts}), then for every
// vertex int16 x y z (× ext / 32767 of its model) and, after all positions, uint8 r g b a (sRGB).
import { build } from 'esbuild';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'zoo-bake-')), out = join(dir, 'bake.mjs');
await build({ entryPoints: ['scripts/zoo/bake-entry.mjs'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'warning' });
const { bake } = await import(pathToFileURL(out).href), models = bake();
await rm(dir, { recursive: true, force: true });

const header = { models: {}, verts: 0 }, pos = [], rgba = [];
for (const [name, model] of Object.entries(models)) {
  let ext = 1e-6; for (const list of model.parts.values()) for (let i = 0; i < list.length; i += 7) ext = Math.max(ext, Math.abs(list[i]), Math.abs(list[i + 1]), Math.abs(list[i + 2]));
  const parts = [];
  for (const [key, list] of model.parts) {
    parts.push({ g: key[0] === 'g' ? 1 : 0, t: key.endsWith('t') ? 1 : 0, n: list.length / 7, o: header.verts });
    for (let i = 0; i < list.length; i += 7) { for (let k = 0; k < 3; k++) pos.push(Math.round(list[i + k] / ext * 32767)); rgba.push(list[i + 3], list[i + 4], list[i + 5], list[i + 6]); header.verts++; }
  }
  header.models[name] = { flags: model.flags, ext: +ext.toFixed(5), parts };
}
let json = JSON.stringify(header); while (Buffer.byteLength(json) % 4) json += ' ';
const head = Buffer.from(json), buffer = Buffer.alloc(4 + head.length + header.verts * 6 + header.verts * 4);
buffer.writeUInt32LE(head.length, 0); head.copy(buffer, 4);
Buffer.from(new Int16Array(pos).buffer).copy(buffer, 4 + head.length); Buffer.from(new Uint8Array(rgba).buffer).copy(buffer, 4 + head.length + header.verts * 6);
await writeFile('public/assets/models/zoo-shapes.bin', buffer);
console.log(`zoo-shapes.bin: ${buffer.length.toLocaleString('en-US')} bytes, ${header.verts / 3} triangles`);
for (const [name, m] of Object.entries(header.models)) console.log(name.padEnd(18), m.parts.map(p => `${p.g ? 'glow' : 'solid'}${p.t ? '+tint' : ''} ${p.n / 3}`).join(', '), JSON.stringify(m.flags));
