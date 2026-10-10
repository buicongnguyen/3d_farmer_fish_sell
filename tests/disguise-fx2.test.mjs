// Round "disguise-fx2": two tiny checks of what the browser cannot count.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GEAR } from '../src/gear.mjs';
import { KITS, KIT_HAND, KIT_WEAPON } from '../src/disguise-kits.mjs';

test('the shapes file holds every shot as its parts: Zoo\'s animations by number, a halo, the ink shell first, mist and rock for the scene\'s light', () => {
  const buffer = readFileSync('public/assets/models/zoo-shapes.bin'), hl = buffer.readUInt32LE(0), head = JSON.parse(buffer.subarray(4, 4 + hl).toString('utf8')), M = head.models;
  assert.equal(buffer.length, 4 + hl + head.verts * 10, 'header + int16 xyz + rgba per vertex');
  const kinds = name => M[name].parts.filter(p => p.an).map(p => p.an[0]).sort((a, b) => a - b).join();
  // 1 flap, 2 puff, 3 wobble, 4 swirl, 5 flicker, 6 twinkle, 7 zig, 8 spin (scripts/zoo/bake-entry.mjs ANIM)
  assert.equal(kinds('shot_bat'), '1,1'); assert.equal(kinds('shot_parrot'), '1,1'); assert.equal(kinds('shot_eagle'), '1,1');
  assert.equal(kinds('shot_missile'), '2,2,2,5'); assert.equal(kinds('shot_water'), '2,2,2'); assert.equal(kinds('shot_rainbow'), '3,3,3,3,3,3');
  assert.equal(kinds('shot_fire'), '5,5,5'); assert.equal(kinds('shot_fireball'), '4,4'); assert.equal(kinds('shot_star'), '4'); assert.equal(kinds('shot_shuriken'), '8'); assert.equal(kinds('shot_bolt'), '7');
  for (const name in M) {
    const m = M[name];
    for (const p of m.parts) { assert.ok(p.o + p.n <= head.verts && p.n % 3 === 0, name); if (p.an) assert.ok(p.an.length === 12 && p.an[0] >= 1 && p.an[0] <= 10 && p.an.every(Number.isFinite), name + ' animation'); }
    if (!name.startsWith('shot_')) continue;
    if (name !== 'shot_rock') assert.ok(m.halo?.[0] > 0, name + ' has a halo');
    const ink = m.parts.findIndex(p => p.m === 3); if (ink >= 0) assert.equal(ink, 0, name + ': the ink shell is drawn first');
  }
  for (const name of ['shot_bead', 'shot_pea', 'shot_bubble', 'shot_snow', 'shot_cannonball', 'shot_drain']) assert.equal(M[name].parts[0].m, 3, name + ' is inked');
  assert.equal(M.mist.parts[0].m, 2); assert.equal(M.rock.parts[0].m, 1); assert.equal(M.shot_rock.parts[0].m, 1); assert.equal(M.halo.parts[0].g, 2); assert.equal(M.spark.parts[0].g, 2);
  assert.ok(M.sum_lighthouse.parts.some(p => p.g === 2) && M.sum_lighthouse.parts.some(p => p.an?.[0] === 10), 'the lighthouse: an additive beam and a pulsing lamp');
  assert.equal(M.shot_star.sparks.length, 2); assert.equal(M.shot_cork.sparks.length, 1);
});

test('Zoo\'s look builders make no array, object or closure per call, and every disguise has a hand weapon that exists', () => {
  const source = readFileSync('src/zoo-looks.mjs', 'utf8').replace(/\r\n/g, '\n'), body = source.slice(source.indexOf('\nconst SHAPES'));
  const inside = body.split('\n').filter(line => /^\s/.test(line)).join('\n');
  assert.equal(inside.match(/(^|[=(,:?]|\bof|\breturn)\s*\[\s*("|-?\d|Z\d)/gm), null, 'no constant array is built inside a builder');
  assert.equal(inside.match(/\.forEach\(|\.map\(|\.filter\(|return \{/g), null, 'no closure and no result object per call');
  assert.ok(/^const Z0 = \[/m.test(source), 'the hoisted arrays are module constants');
  for (const id in KITS) {
    assert.ok(id in KIT_HAND, id + ' has a hand entry'); const hand = KIT_HAND[id], w = KIT_WEAPON[id];
    if (hand) { assert.equal(GEAR[hand]?.slot, 'weapon', hand); assert.equal(GEAR[hand].kind, w.kind, id + ': the model in the hand is the kind of weapon it fights with'); } else assert.equal(w.kind === 'gun', false, id + ': bare hands do not shoot');
  }
});
