import test from 'node:test';
import assert from 'node:assert/strict';
import { nameLayout } from '../src/villager-labels.mjs';
const person = (id, x, y, distance = 20) => ({ id, name: id, x, y, distance });

test('screen names stay readable inside the free screen space at either phone or desktop size', () => {
  for (const [width, height, cap] of [[390, 844, 6], [1440, 900, 10]]) {
    const candidates = Array.from({ length: 40 }, (_, i) => person('Neighbour' + i, 65 + i % 4 * 83, 200 + Math.floor(i / 4) * 40, i));
    const out = nameLayout(candidates, width, height);
    assert.equal(out.length, cap);
    for (const n of out) { assert.ok(n.x >= 12 && n.x + n.w <= width - 12); assert.ok(n.y >= 112 && n.y + 20 <= height - 48); }
    for (const a of out) for (const b of out) if (a !== b) assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + 20 <= b.y || b.y + 20 <= a.y);
  }
});

test('nearby names win crowded pixels; off-screen and HUD-covered names never draw', () => {
  const out = nameLayout([person('Far', 200, 260, 40), person('Near', 202, 258, 8), person('HUD', 180, 90), person('Edge', -5, 300), person('Thumb', 180, 800)], 390, 844);
  assert.deepEqual(out.map(n => n.id), ['Near']);
  assert.deepEqual(nameLayout([person('Covered', 200, 260)], 390, 844, [{ left: 150, top: 220, right: 250, bottom: 270 }]), []);
});

test('landscape phones keep the phone name limit and leave both thumbs and Home clear', () => {
  const controls = [
    { left: 22, top: 264, right: 118, bottom: 360 },
    { left: 754, top: 296, right: 822, bottom: 364 },
    { left: 692, top: 306, right: 740, bottom: 354 },
  ];
  const candidates = [person('Stick', 70, 315), person('Act', 790, 330), person('Home', 718, 330),
    ...Array.from({ length: 10 }, (_, i) => person('N' + i, 180 + i % 5 * 100, 180 + Math.floor(i / 5) * 50, i + 30))];
  const out = nameLayout(candidates, 844, 390, controls);
  assert.equal(out.length, 6);
  assert.ok(out.every(n => n.id.startsWith('N')));
});
