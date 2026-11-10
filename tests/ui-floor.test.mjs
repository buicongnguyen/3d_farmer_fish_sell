import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const dir = new URL('../src/', import.meta.url);
const sheets = readdirSync(dir).filter(f => f.endsWith('.css'));

test('no stylesheet sets text smaller than 11 px', () => {
  const small = [];
  for (const file of sheets) {
    const text = readFileSync(new URL(file, dir), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of text.matchAll(/font-size\s*:\s*([\d.]+)px/g)) if (Number(m[1]) < 11) small.push(`${file}: ${m[0]}`);
  }
  assert.deepEqual(small, []);
});

test('the touch floor sheet exists, is imported last, and sets 44 px', () => {
  const css = readFileSync(new URL('ui-floor.css', dir), 'utf8');
  assert.match(css, /min-height:\s*44px/);
  const main = readFileSync(new URL('main.mjs', dir), 'utf8');
  const imports = [...main.matchAll(/^import '([^']+\.css)';/gm)].map(m => m[1]);
  assert.equal(imports.at(-1), './ui-floor.css');
});
