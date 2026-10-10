// node scripts/hoist-zoo-looks.mjs  (after: esbuild ../cute_game/src/skill-visuals.ts --format=esm > src/zoo-looks.mjs, with the two header lines kept)
// Zoo's look builders make a small array of colours (or of numbers) each time they run; here every such constant array becomes a
// module constant (Z0, Z1, ...), made once, so painting a look allocates nothing. Only literals of strings, numbers and other
// hoisted arrays are moved, and only where an expression starts (never an index like a[0]). Running it twice changes nothing.
import { readFileSync, writeFileSync } from 'node:fs';
const file = 'src/zoo-looks.mjs'; let s = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const start = s.indexOf('\nconst SHAPES'); if (start < 0) throw new Error('header moved');
let head = s.slice(0, start + 1), body = s.slice(start + 1); const made = [], known = new Map();
for (const line of head.match(/^const Z\d+ = .*;$/gm) ?? []) { const [, name, value] = line.match(/^const (Z\d+) = (.*);$/); known.set(value, name); made.push(line); }
head = head.replace(/^const Z\d+ = .*;\n/gm, '');
const ATOM = String.raw`(?:"[^"\n]*"|-?\d*\.?\d+(?:e-?\d+)?|Z\d+)`;
const re = new RegExp(String.raw`(^|[=(,:?\[]|\bof|\breturn)(\s*)\[\s*` + ATOM + String.raw`(?:\s*,\s*` + ATOM + String.raw`)+\s*\]`, 'gm');
// Two builders allocate in other ways: one result object per call, one closure per call. Each is rewritten by its exact text
// (if Zoo changes these lines the script stops here, so the new text gets looked at).
const FIXES = [
  ['  return { r: radius * (0.25 + 0.4 * (1 - (1 - k) ** 2)), fade: 1 - k };', '  WHIRL_RING.r = radius * (0.25 + 0.4 * (1 - (1 - k) ** 2));\n  WHIRL_RING.fade = 1 - k;\n  return WHIRL_RING;'],
  ['const WHIRL_PULSE = 0.45;\n', 'const WHIRL_PULSE = 0.45, WHIRL_RING = { r: 0, fade: 0 };\n'],
  ['  discs.forEach(([col, k], i) => p.put("petal", col, x + fx * i * 0.015, y, z + fz * i * 0.015, R * k, 0.02, R * k, PI / 2, c.f));', '  for (let i = 0; i < discs.length; i++) p.put("petal", discs[i][0], x + fx * i * 0.015, y, z + fz * i * 0.015, R * discs[i][1], 0.02, R * discs[i][1], PI / 2, c.f);'],
];
for (const [from, to] of FIXES) { if (body.includes(to)) continue; if (!body.includes(from)) throw new Error('Zoo changed: ' + from.slice(0, 60)); body = body.replace(from, () => to); }
for (let pass = 0; pass < 4; pass++) body = body.split('\n').map(line => /^\s/.test(line) ? line.replace(re, (all, before, gap) => {
  const value = all.slice(before.length + gap.length).replace(/\s+/g, ' '); let name = known.get(value);
  if (!name) { name = 'Z' + made.length; known.set(value, name); made.push(`const ${name} = ${value};`); }
  return before + gap + name;
}) : line).join('\n');
head = head.replace('Do not edit by hand: re-run that line.', 'Do not edit by hand: re-run that line, then node scripts/hoist-zoo-looks.mjs (its constant colour arrays are made once, below, instead of on every call).');
writeFileSync(file, head + made.join('\n') + (made.length ? '\n' : '') + body);
console.log(made.length, 'constant arrays hoisted');
