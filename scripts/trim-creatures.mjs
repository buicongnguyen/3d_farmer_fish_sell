// Cuts Zoo Garden's creatures.glb (26 creatures, 875 KB) down to the ones that live in Willowmere's fields while the
// Pandora box is open. Nodes, meshes, materials, accessors and buffer views that nothing uses any more are dropped and the
// binary chunk is rebuilt, so the file the game downloads on the first open holds only what it draws.
//
//   node scripts/trim-creatures.mjs [source.glb] [out.glb] [names]
//
// Defaults: ../cute_game/public/assets/models/creatures.glb -> public/assets/models/wild-creatures.glb, with the roots of DEFAULT_KEEP.
// `names` is a comma-separated list of root names that replaces that list (round 8: one file per land, per titan and per trophy), e.g.
//   node scripts/trim-creatures.mjs ../cute_game/public/assets/models/creatures.glb public/assets/models/c-candy.glb jelly,gummy
//   node scripts/trim-creatures.mjs ../cute_game/public/assets/models/titans.glb public/assets/models/t-turtle.glb titan_turtle
import { readFileSync, writeFileSync } from 'node:fs';

export const DEFAULT_KEEP = ['mushroom', 'boar', 'bee', 'wolf', 'frog', 'crab', 'chomper', 'cactus', 'bear'];
export const KEEP = process.argv[4] ? process.argv[4].split(',').map(name => name.trim()).filter(Boolean) : DEFAULT_KEEP;
const source = process.argv[2] ?? '../cute_game/public/assets/models/creatures.glb';
const out = process.argv[3] ?? 'public/assets/models/wild-creatures.glb';

const file = readFileSync(source);
if (file.readUInt32LE(0) !== 0x46546c67) throw new Error('Not a GLB file.');
const jsonLength = file.readUInt32LE(12), json = JSON.parse(file.subarray(20, 20 + jsonLength).toString('utf8'));
const binLength = file.readUInt32LE(20 + jsonLength), bin = file.subarray(28 + jsonLength, 28 + jsonLength + binLength);

// A remap table per kind: old index -> new index, filled in the order things are first used.
const maps = { nodes: new Map(), meshes: new Map(), materials: new Map(), accessors: new Map(), bufferViews: new Map() };
const use = (kind, index) => { if (index === undefined) return undefined; const map = maps[kind]; if (!map.has(index)) map.set(index, map.size); return map.get(index); };
const scene = json.scenes[json.scene ?? 0], roots = scene.nodes.filter(i => KEEP.includes(json.nodes[i].name));
const missing = KEEP.filter(name => !roots.some(i => json.nodes[i].name === name));
if (missing.length) throw new Error(`Missing creatures: ${missing.join(', ')}`);
const visit = i => { use('nodes', i); for (const child of json.nodes[i].children ?? []) visit(child); };
roots.sort((a, b) => KEEP.indexOf(json.nodes[a].name) - KEEP.indexOf(json.nodes[b].name)).forEach(visit);

const list = kind => [...maps[kind].keys()];
const nodes = list('nodes').map(i => { const n = { ...json.nodes[i] }; if (n.children) n.children = n.children.map(c => maps.nodes.get(c)); if (n.mesh !== undefined) n.mesh = use('meshes', n.mesh); return n; });
const meshes = list('meshes').map(i => ({ ...json.meshes[i], primitives: json.meshes[i].primitives.map(p => ({ ...p,
  attributes: Object.fromEntries(Object.entries(p.attributes).map(([key, a]) => [key, use('accessors', a)])),
  ...(p.indices !== undefined ? { indices: use('accessors', p.indices) } : {}), ...(p.material !== undefined ? { material: use('materials', p.material) } : {}) })) }));
const accessors = list('accessors').map(i => ({ ...json.accessors[i], bufferView: use('bufferViews', json.accessors[i].bufferView) }));
// Rebuild the binary chunk from the views still in use, each aligned to 4 bytes.
const chunks = []; let offset = 0;
const bufferViews = list('bufferViews').map(i => {
  const view = json.bufferViews[i], bytes = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength), pad = (4 - offset % 4) % 4;
  if (pad) { chunks.push(Buffer.alloc(pad)); offset += pad; }
  const next = { ...view, buffer: 0, byteOffset: offset }; chunks.push(bytes); offset += bytes.length; return next;
});
if (offset % 4) { chunks.push(Buffer.alloc(4 - offset % 4)); offset += 4 - offset % 4; }
const result = { asset: json.asset, ...(json.extensionsUsed ? { extensionsUsed: json.extensionsUsed } : {}), ...(json.extensionsRequired ? { extensionsRequired: json.extensionsRequired } : {}),
  scene: 0, scenes: [{ name: out.replace(/^.*[\\/]/, '').replace(/\.glb$/i, ''), nodes: roots.map(i => maps.nodes.get(i)) }], nodes, meshes, materials: list('materials').map(i => json.materials[i]), accessors, bufferViews, buffers: [{ byteLength: offset }] };

let text = Buffer.from(JSON.stringify(result), 'utf8'); if (text.length % 4) text = Buffer.concat([text, Buffer.alloc(4 - text.length % 4, 0x20)]);
const header = Buffer.alloc(12), jsonHead = Buffer.alloc(8), binHead = Buffer.alloc(8);
header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + text.length + 8 + offset, 8);
jsonHead.writeUInt32LE(text.length, 0); jsonHead.writeUInt32LE(0x4e4f534a, 4); binHead.writeUInt32LE(offset, 0); binHead.writeUInt32LE(0x004e4942, 4);
writeFileSync(out, Buffer.concat([header, jsonHead, text, binHead, ...chunks]));
const triangles = meshes.reduce((n, m) => n + m.primitives.reduce((k, p) => k + (p.indices !== undefined ? accessors[p.indices].count : accessors[p.attributes.POSITION].count) / 3, 0), 0);
console.log(`${out}: ${roots.length} roots (${KEEP.join(', ')}), ${nodes.length} nodes, ${meshes.length} meshes, ${Math.round(triangles)} triangles, ${12 + 8 + text.length + 8 + offset} bytes (from ${file.length})`);
