// What grows in each region, its ground and its light (region-life.mjs), against the copied kit files. Owner: builder B.
// The tables are Zoo Garden's (cute_game src/biomes.ts, src/toon.ts, src/world.ts KIT_TINTS); the counts are spec 3.5.
//
// The plan itself (field-layout.mjs fieldTrees, fieldCards) is builder A's. Until A's plan reads these tables (step 0's
// stub plants main's eight trees a tile whatever the table says), the plan checks below run on `standIn`, a 30-line
// planner that applies the spec's placement rules to the tables; from A's merge on they run on the real plan.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DECOR, CARDS, RIM_KINDS, GROUND, LIGHTS, KIT_TINTS } from '../src/region-life.mjs';
import { REGION, REGION_IDS, DENS, regionAt, squareOf, borderDistance, trailDistance } from '../src/regions.mjs';
import { inSafeZone } from '../src/ward.mjs';
import { landClear, blockers, waterAt, FEATURES } from '../src/land-features.mjs';
import { fieldTrees, fieldCards, fieldPlan, GATE_ROAD } from '../src/field-layout.mjs';
import { VEHICLES } from '../src/drive.mjs';
import { DriveView } from '../src/drive-view.mjs';

const KIT_FILE = { scenery: 'scenery', wilds: 'wilds', bright: 'worlds-bright', harsh: 'worlds-harsh', dressing: 'worlds-dressing' };
const HOME = ['west', 'north', 'south', 'east'], LANDS = REGION_IDS.filter(id => REGION[id].kind === 'land');
const file = name => readFileSync(new URL(`../public/assets/models/${name}.glb`, import.meta.url));
/** The root names of a GLB, their materials, and the top of each root's model at scale 1 (from the position bounds). */
function roots(name) {
  const b = file(name), j = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString()), out = {};
  const top = (i, s, y) => { const n = j.nodes[i], ns = s * (n.scale?.[1] ?? 1), ny = y + s * (n.translation?.[1] ?? 0); let t = -Infinity; if (n.mesh !== undefined) for (const p of j.meshes[n.mesh].primitives) t = Math.max(t, ny + ns * j.accessors[p.attributes.POSITION].max[1]); for (const c of n.children ?? []) t = Math.max(t, top(c, ns, ny)); return t; };
  const mats = i => { const n = j.nodes[i], m = new Set(); if (n.mesh !== undefined) for (const p of j.meshes[n.mesh].primitives) m.add(j.materials[p.material]?.name); for (const c of n.children ?? []) for (const x of mats(c)) m.add(x); return m; };
  for (const i of j.scenes[j.scene ?? 0].nodes) { assert.ok(!(j.nodes[i].name in out), `${name}: the root ${j.nodes[i].name} is there once`); out[j.nodes[i].name] = { h: top(i, 1, 0), materials: [...mats(i)] }; }
  out.__glow = (j.materials ?? []).filter(m => m.emissiveFactor?.some(v => v > 0)).map(m => m.name);
  return out;
}
const KITS = Object.fromEntries(Object.entries(KIT_FILE).map(([kit, name]) => [kit, roots(name)]));
const TREES = ['tree_round', 'tree_pine', 'tree_blossom', 'tree_swamp', 'tree_dead', 'candy_tree', 'jungletree', 'palm', 'snow_pine', 'ash_tree', 'cloudtree', 'deadtree'];

test('the kit files are Zoo Garden’s, byte for byte', () => {
  const want = { // bytes and SHA-256 recorded from the reference's files at f7d3584 (ROUND8-STEP0.md section 2)
    wilds: [68132, '3fad6b623772a80660a8c10b0a6d0fee2315a80c0d1681d224974b8b9e44cc04'], 'worlds-bright': [128608, '6991ea4a070e5824276d902b1f2e52c038ad489907edc65f196027579d316a5f'],
    'worlds-harsh': [97076, '31d83e4eecdf6e46caeeb5e5cb8dcfec6d661f214633a44bf9352dd6fed2ab36'], 'worlds-dressing': [51692, '6b37ce0f60400c83af32f714380201aab8cee1409454cb2f1d45a74f9a6c663f'],
    cage: [39668, 'eb40e1356157bf077fbe0c6e52f13f3b5a64986f384e307e084b32dbc812abfd'], scenery: [84676, 'd8c69cb11469032a6bdc713b7dd117f2d608dd6631a00786d2d41b0f9efb6764'],
  };
  for (const [name, [bytes, sha]] of Object.entries(want)) { const b = file(name); assert.equal(b.length, bytes, name); assert.equal(createHash('sha256').update(b).digest('hex'), sha, name); }
});

test('every kind of every table is a root of its kit file, with the height, the glow and the tint the file has', () => {
  assert.deepEqual(Object.keys(DECOR).sort(), [...REGION_IDS].sort()); assert.deepEqual(Object.keys(CARDS).sort(), [...REGION_IDS].sort()); assert.deepEqual(Object.keys(RIM_KINDS).sort(), [...REGION_IDS].sort());
  for (const id of REGION_IDS) {
    const names = new Set();
    for (const row of DECOR[id]) {
      const root = KITS[row.kit]?.[row.kind]; assert.ok(root, `${id}: ${row.kit}/${row.kind} is in ${KIT_FILE[row.kit]}.glb`);
      const key = row.kit + '/' + row.kind + (row.tint ? '@' + row.tint : ''); assert.ok(!names.has(key), `${id}: ${key} once`); names.add(key);
      assert.ok(row.r > 0 && row.h > 0 && typeof row.perch === 'boolean' && typeof row.glow === 'boolean' && row.count > 0, `${id} ${row.kind}: r, h, perch, glow, count`);
      assert.equal(row.perch, TREES.includes(row.kind), `${row.kind}: only trees are perches`);
      // h is the model's own top (the three field trees keep main's 3.3, a little inside their crowns).
      if (['tree_round', 'tree_pine', 'tree_blossom'].includes(row.kind)) { assert.equal(row.h, 3.3); assert.ok(root.h >= 3.3); assert.deepEqual([...row.scale], [1.25, 2.1]); }
      else { assert.ok(Math.abs(row.h - root.h) < .03, `${row.kind}: h ${row.h} against the file's ${root.h.toFixed(2)}`); assert.deepEqual([...row.scale], [.9, 1.3]); }
      assert.ok(row.scale[0] >= .8 && row.r * row.scale[1] <= 1.82, `${row.kind}: no collider over 1.82 m`);
      assert.equal(row.glow, root.materials.some(m => KITS[row.kit].__glow.includes(m)), `${row.kind}: glow as its materials are`);
      assert.ok([undefined, 'land', 'sea', 'island'].includes(row.where));
      if (row.tint) { assert.ok(KIT_TINTS[row.tint], row.tint); assert.ok(root.materials.some(m => m in KIT_TINTS[row.tint]), `${row.kind}@${row.tint} recolours a material the piece has`); }
    }
    for (const row of CARDS[id]) {
      const root = KITS[row.kit]?.[row.kind]; assert.ok(root, `${id}: ${row.kit}/${row.kind} is in ${KIT_FILE[row.kit]}.glb`);
      const key = row.kit + '/' + row.kind + (row.tint ? '@' + row.tint : ''); assert.ok(!names.has(key), `${id}: ${key} once`); names.add(key);
      assert.ok(row.cls === 'cover' || row.cls === 'dressing'); assert.equal(row.cls === 'dressing', row.kit === 'dressing', `${row.kind}: dressing is the dressing kit's nine kinds, nothing else`);
      assert.ok(row.glow === 0 || row.glow === 1); assert.equal(row.glow, ['embers', 'glow_shrooms'].includes(row.kind) ? 1 : 0, `${row.kind}: only embers and night shrooms glow`);
      if (row.tint) {
        assert.equal(row.tint, id, 'a tinted card takes its own land’s palette'); assert.ok(KIT_TINTS[row.tint] && ['flowers', 'bush', 'tuft'].includes(row.kind), 'only kinds the reference flags tint');
        // The flower model has no material any palette names (Stem, Petal …), so flowers@<land> looks as flowers do, in the reference too; the copy is kept because the spec's 24 card kinds count it.
        assert.equal(root.materials.some(m => m in KIT_TINTS[row.tint]), row.kind !== 'flowers', `${row.kind}@${row.tint}`);
      }
    }
    for (const row of RIM_KINDS[id]) assert.ok(KITS[row.kit]?.[row.kind], `${id} rim: ${row.kit}/${row.kind}`);
  }
  // The tinted copies the spec names, and no tint on ice's dry bush.
  const tinted = REGION_IDS.flatMap(id => [...DECOR[id], ...CARDS[id]].filter(r => r.tint).map(r => `${r.kit}/${r.kind}@${r.tint}`)).sort();
  assert.deepEqual(tinted, ['scenery/bush@jungle', 'scenery/flowers@candy', 'scenery/flowers@jungle', 'scenery/flowers@toy', 'scenery/rock@shadow', 'scenery/tuft@shadow']);
  assert.equal(CARDS.ice.find(r => r.kind === 'dry_bush').tint, undefined); assert.deepEqual(Object.keys(KIT_TINTS).sort(), ['candy', 'ice', 'jungle', 'lava', 'shadow', 'toy']);
  assert.equal(KIT_TINTS.candy['Leaf A'], '#ff7fb8'); assert.equal(KIT_TINTS.shadow.Rock, '#6d6690'); assert.equal(KIT_TINTS.toy.Grass, undefined);
  // A kit a region needs is one of the five, and every kit is needed by somebody.
  const used = new Set(REGION_IDS.flatMap(id => [...DECOR[id], ...CARDS[id], ...RIM_KINDS[id]].map(r => r.kit))); assert.deepEqual([...used].sort(), Object.keys(KIT_FILE).sort());
});

test('the counts a 64 m tile are the spec’s: the forest 40 blocking pieces, the meadow 16; never over 40 and 220', () => {
  const blocking = id => DECOR[id].reduce((n, r) => n + r.count, 0), cards = (id, cls) => CARDS[id].filter(r => !cls || r.cls === cls).reduce((n, r) => n + r.count, 0);
  assert.deepEqual(Object.fromEntries(REGION_IDS.map(id => [id, blocking(id)])), { village: 0, west: 40, north: 24, south: 16, east: 28, toy: 7, candy: 22, jungle: 10, ice: 22, ocean: 5, lava: 14, cloud: 8, shadow: 10 });
  assert.deepEqual(Object.fromEntries(REGION_IDS.map(id => [id, cards(id)])), { village: 0, west: 202, north: 181, south: 202, east: 87, toy: 61, candy: 100, jungle: 94, ice: 70, ocean: 82, lava: 76, cloud: 85, shadow: 56 });
  for (const id of REGION_IDS) { assert.ok(blocking(id) <= 40 && cards(id) <= 220, id); assert.ok(DECOR[id].length <= (id === 'candy' || id === 'ice' ? 4 : 3), `${id}: at most three blocking kinds (four on candy and ice)`); }
  const row = (id, kind) => [...DECOR[id], ...CARDS[id]].find(r => r.kind === kind);
  assert.deepEqual(DECOR.west.map(r => [r.kind, r.count, r.r]), [['tree_round', 18, .42], ['tree_pine', 18, .42], ['rock', 4, .7]]);
  assert.deepEqual(DECOR.east.map(r => [r.kind, r.count, r.r, r.glow]), [['rock_red', 14, 1.1, false], ['tree_dead', 8, .35, false], ['crystals', 6, .5, true]]);
  assert.deepEqual(DECOR.lava.map(r => [r.kind, r.count, r.r, r.glow]), [['lava_rock', 6, .85, true], ['obsidian', 4, .5, false], ['ash_tree', 4, .35, true]]);
  assert.deepEqual(DECOR.ice.map(r => [r.kind, r.count, r.r]), [['snow_pine', 12, .45], ['ice_spire', 4, .55], ['snow_rock', 4, .8], ['snowman', 2, .45]]);
  assert.deepEqual(DECOR.candy.map(r => [r.kind, r.count, r.r]), [['candy_tree', 8, .35], ['candy_cane', 7, .3], ['donut', 3, .9], ['cupcake', 4, .6]]);
  // Cover is halved on "battery" and dressing is left out (the reference's classes): a meadow tile keeps 33 flowers and no pebbles.
  assert.equal(row('south', 'flowers').cls, 'cover'); assert.equal(row('south', 'flowers').count / 2, 33); assert.equal(row('west', 'toadstools').cls, 'cover'); assert.equal(row('south', 'pebbles').cls, 'dressing');
  for (const id of HOME) assert.equal(row(id, 'pebbles').count, 42, 'pebbles in all four home regions');
  for (const kind of ['bush', 'log']) assert.equal(row('west', kind).cls, 'cover', `${kind} is a card here`);
  // The canyon has no green card at all; lava has no cover, only embers that glow.
  assert.deepEqual(CARDS.east.map(r => r.kind), ['dry_bush', 'pebbles']); assert.deepEqual(CARDS.lava.map(r => [r.kind, r.glow]), [['embers', 1]]);
  // Where things grow: coral in the sea, the Beach's palms, ferns and shells on sand, the Cloud Meadow's on islands only.
  assert.equal(row('ocean', 'coral').where, 'sea'); for (const kind of ['palm', 'fern', 'shells']) assert.ok([undefined, 'land'].includes(row('ocean', kind).where));
  for (const r of [...DECOR.cloud, ...CARDS.cloud]) assert.equal(r.where, 'island', r.kind);
  // The rim: a land's own kinds; none off the Beach and the Cloud Meadow; none for a home region (it has no outer side).
  assert.deepEqual(Object.fromEntries(REGION_IDS.map(id => [id, RIM_KINDS[id].map(r => r.kind)])), { village: [], west: [], north: [], south: [], east: [], toy: ['toyblock', 'toyball'], candy: ['candy_tree', 'candy_cane', 'cupcake'], jungle: ['jungletree', 'fern'], ice: ['snow_pine', 'ice_spire'], ocean: [], lava: ['lava_rock', 'obsidian', 'mini_volcano'], cloud: [], shadow: ['deadtree'] });
  assert.ok(Object.isFrozen(DECOR) && Object.isFrozen(DECOR.west) && Object.isFrozen(DECOR.west[0]) && Object.isFrozen(CARDS.lava[0]));
});

test('ground and light: every region has its colours, every land its light; lava’s sun is 2.0', () => {
  const hex = /^#[0-9a-f]{6}$/;
  for (const id of REGION_IDS) {
    const g = GROUND[id];
    if (REGION[id].kind === 'land') { for (const key of ['low', 'high', 'patch', 'rim']) assert.match(g[key], hex, `${id}.${key}`); assert.equal(g.low, REGION[id].ground, `${id}: the region's ground colour is its low colour`); const l = LIGHTS[id]; for (const key of ['sky', 'ground', 'sun', 'fog', 'background']) assert.match(l[key], hex, `${id} light ${key}`); assert.equal(l.sunIntensity, id === 'lava' ? 2 : 2.4); assert.equal(l.background, l.fog); }
    else { assert.match(g.base, hex); assert.equal(g.base, REGION[id].ground); assert.equal(LIGHTS[id], undefined, 'home and the village keep toon.mjs LIGHT'); }
    if (g.paint) assert.equal(typeof g.paint, 'function');
  }
  assert.equal(GROUND.toy.checker, true); assert.equal(GROUND.lava.scorch, '#3a2f3a'); assert.deepEqual(Object.keys(LIGHTS).sort(), [...LANDS].sort());
  // The reference's rows (toon.ts:26-33; fog and background are each planet's sky colour).
  assert.deepEqual({ ...LIGHTS.lava }, { sky: '#ffd2b8', ground: '#6a3a3a', sun: '#ffc9a0', sunIntensity: 2, fog: '#ffb08a', background: '#ffb08a' });
  assert.deepEqual({ ...LIGHTS.shadow }, { sky: '#6a6aa8', ground: '#1a1430', sun: '#8a8ad8', sunIntensity: 2.4, fog: '#0d0b1a', background: '#0d0b1a' });
  assert.deepEqual(LANDS.map(id => LIGHTS[id].fog), ['#ffe9f6', '#ffc9ea', '#bfe8b0', '#d8f0ff', '#aee8ff', '#ffb08a', '#9fd8ff', '#0d0b1a']);
  // Hot reads as hot: lava's fog is the warmest of all (red well over blue), the night's the darkest.
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); for (const id of LANDS) if (id !== 'lava') assert.ok(rgb(LIGHTS.lava.fog)[0] - rgb(LIGHTS.lava.fog)[2] > rgb(LIGHTS[id].fog)[0] - rgb(LIGHTS[id].fog)[2], id);
  assert.ok(rgb(LIGHTS.shadow.fog).reduce((a, b) => a + b) < 60);
});

// ---------------------------------------------------------------- the plan
const REAL = fieldPlan(-2, 0).cards.length > 0; // builder A's plan reads the tables (step 0's stub has no cards)
const rand = seed => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const hashOf = (text, a, b) => { let h = 2166136261 ^ Math.imul(a, 73856093) ^ Math.imul(b, 19349663); for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619); return h >>> 0; };
const TITANS = DENS.filter(d => d.titan);
const tileRegions = (tx, tz) => { const out = []; for (let i = 0; i <= 8; i++) for (let k = 0; k <= 8; k++) { const id = regionAt((tx + (i + .5) / 9) * 64, (tz + (k + .5) / 9) * 64); if (id && id !== 'village' && !out.includes(id)) out.push(id); } return out; };
/** The spec's placement rules (3.5 "Where no piece goes") applied to the tables: a stand-in for builder A's plan until it is merged. */
function standIn(tx, tz) {
  const trees = [], cards = [];
  for (const id of tileRegions(tx, tz)) {
    for (const [rows, out, blocking] of [[DECOR[id], trees, true], [CARDS[id], cards, false]]) for (const row of rows) {
      const random = rand(hashOf(id + row.kind, tx, tz));
      for (let i = 0; i < row.count; i++) {
        const x = (tx + random()) * 64, z = (tz + random()) * 64, scale = blocking ? row.scale[0] + random() * (row.scale[1] - row.scale[0]) : .7 + random() * .6, r = blocking ? row.r * scale : 0, pad = blocking ? 2 : 0;
        if (regionAt(x, z) !== id || inSafeZone(x, z) || borderDistance(x, z) < 3 || trailDistance(x, z) < 5) continue;
        if (x > GATE_ROAD.x0 && x < GATE_ROAD.x1 + pad && z > GATE_ROAD.z0 - pad && z < GATE_ROAD.z1 + pad) continue;
        if (!landClear(x, z, r, row.where ?? 'land')) continue;
        if (blocking && TITANS.some(d => Math.hypot(d.x - x, d.z - z) < 32)) continue;
        out.push(blocking ? { x, z, scale, angle: random() * 6.283, kind: row.kind, r, h: row.h * scale, perch: row.perch } : { x, z, scale, kind: row.kind, glow: row.glow });
      }
    }
  }
  return { trees, cards };
}
const planTrees = (tx, tz) => REAL ? fieldTrees(tx, tz) : standIn(tx, tz).trees, planCards = (tx, tz) => REAL ? fieldCards(tx, tz, []) : standIn(tx, tz).cards;
const kindsOf = (id, table) => new Set(table[id].map(r => r.kind));

test('a tile’s plan: its own regions’ kinds, inside the budget, clear of borders, trails, titans and every feature', t => {
  t.diagnostic(REAL ? 'on builder A’s plan (fieldTrees, fieldCards)' : 'on the stand-in planner: builder A’s plan does not read the tables yet');
  let blockingMost = 0, cardsMost = 0, coral = 0, palms = 0, cloud = 0;
  for (let tx = -5; tx <= 4; tx++) for (let tz = -5; tz <= 4; tz++) {
    const regions = tileRegions(tx, tz), trees = planTrees(tx, tz), cards = planCards(tx, tz);
    if (!regions.length) continue;
    blockingMost = Math.max(blockingMost, trees.length); cardsMost = Math.max(cardsMost, cards.length);
    assert.ok(trees.length <= 40, `tile ${tx},${tz}: ${trees.length} blocking pieces`); assert.ok(cards.length <= 220, `tile ${tx},${tz}: ${cards.length} cards`);
    for (const p of trees) {
      const id = regionAt(p.x, p.z), where = DECOR[id]?.find(r => r.kind === p.kind)?.where ?? 'land'; assert.ok(regions.includes(id) && kindsOf(id, DECOR).has(p.kind), `${p.kind} at (${p.x.toFixed(0)}, ${p.z.toFixed(0)}) belongs to ${id}`);
      assert.ok(!inSafeZone(p.x, p.z) && borderDistance(p.x, p.z) >= 3 - 1e-9 && trailDistance(p.x, p.z) >= 5 - 1e-9, `${p.kind} at (${p.x.toFixed(1)}, ${p.z.toFixed(1)}): off the ward, the borders and the trails`);
      assert.ok(landClear(p.x, p.z, p.r, where), `${p.kind} at (${p.x.toFixed(1)}, ${p.z.toFixed(1)}) stands clear of every feature`);
      for (const d of TITANS) assert.ok(Math.hypot(d.x - p.x, d.z - p.z) >= 32 - 1e-9, `${p.kind} in the arena of ${d.type}`);
      assert.ok(p.r > 0 && p.r <= 1.82 && p.h > 0 && typeof p.perch === 'boolean');
      if (p.kind === 'palm') { palms++; assert.ok(!waterAt(p.x, p.z), 'a palm on sand'); } if (id === 'cloud') { cloud++; assert.ok(FEATURES.cloud.islands.some(i => Math.hypot(i.x - p.x, i.z - p.z) <= i.r - p.r + 1e-9), 'on an island'); }
    }
    for (const c of cards) {
      const id = regionAt(c.x, c.z), row = CARDS[id]?.find(r => r.kind === c.kind); assert.ok(row && regions.includes(id), `card ${c.kind} belongs to ${id}`);
      assert.ok(!inSafeZone(c.x, c.z) && borderDistance(c.x, c.z) >= 3 - 1e-9 && trailDistance(c.x, c.z) >= 5 - 1e-9);
      assert.ok(landClear(c.x, c.z, 0, row.where ?? 'land'), `card ${c.kind} at (${c.x.toFixed(1)}, ${c.z.toFixed(1)}) is where its kind grows`);
      if (c.kind === 'coral') { coral++; assert.ok(waterAt(c.x, c.z), 'coral only in the sea'); } else if (id === 'ocean') assert.ok(!waterAt(c.x, c.z), `${c.kind} on sand`);
      assert.equal(c.glow, row.glow);
    }
  }
  assert.ok(coral > 4 && palms > 4 && cloud > 8, `the Beach has coral (${coral}) and palms (${palms}), the islands their trees (${cloud})`);
  // A whole forest tile holds the table's 40 less what the trail, the ponds and the borders take; the canyon has no tuft or flowers anywhere.
  const forest = planTrees(-3, -1).length; assert.ok(forest >= 26 && forest <= 40, `a forest tile: ${forest}`); const meadow = planTrees(0, 2).length; assert.ok(meadow >= 9 && meadow <= 16, `a meadow tile: ${meadow}`);
  for (let tx = 1; tx <= 2; tx++) for (let tz = -1; tz <= 0; tz++) for (const c of planCards(tx, tz)) if (regionAt(c.x, c.z) === 'east') assert.ok(c.kind !== 'tuft' && c.kind !== 'flowers');
  t.diagnostic(`most blocking pieces in a tile ${blockingMost}, most cards ${cardsMost}`);
});

/** A bare world for DriveView (the rig of tests/render.test.mjs, copied): flat ground and the trunks a test puts there. */
function driveWorld(id, x, z, heading = 0) {
  const world = { bounds: { x: 1e6, z: 1e6 }, colliders: [], location: 'village', path: [], player: { position: { x, y: 0, z } }, addTreeBlock() {}, removeTreeBlock() {}, riding: { id, mesh: { position: { x, y: 0, z }, rotation: { x: 0, y: heading, z: 0 }, scale: { x: 1 } } } };
  const view = new DriveView(world); view.board(world.riding); return { world, view, d: world.riding.drive, m: world.riding.mesh.position, spec: world.riding.spec };
}
test('a jeep can still drive the real scenery: 20 s through each home region on 8 headings, nothing driven through, nothing wedged', t => {
  // Each run drives the region's own square, repeated without end (its four tiles and its ponds), so the 760 m of a run are all
  // that region's scenery at its own density. The numbers go to the hand-off note for open question 14.
  const dt = 1 / 60, jeep = VEHICLES.jeep, report = {};
  for (const id of HOME) {
    const s = squareOf(id), tx0 = Math.floor(s.x0 / 64), tz0 = Math.floor(s.z0 / 64), base = [];
    for (let u = 0; u < 2; u++) for (let v = 0; v < 2; v++) for (const p of planTrees(tx0 + u, tz0 + v)) if (regionAt(p.x, p.z) === id) base.push({ x: p.x - s.x0, z: p.z - s.z0, r: p.r });
    for (const b of blockers(id)) base.push({ x: b.x - s.x0, z: b.z - s.z0, r: b.r });
    let total = 0, least = Infinity, top = 0, closest = Infinity, runs = 0, bumps = 0;
    for (let n = 0; n < 8; n++) {
      const a = n * Math.PI / 4 + .38, sx = Math.sin(a), sz = Math.cos(a);
      // Start on open ground: the first point of a small spiral from the square's centre that is 4 m clear of everything.
      let x0 = 64, z0 = 64; for (let k = 0; k < 400; k++) { const px = 64 + Math.cos(k * 2.4) * k * .15, pz = 64 + Math.sin(k * 2.4) * k * .15; if (base.every(b => Math.hypot(b.x - px, b.z - pz) > b.r + 4)) { x0 = px; z0 = pz; break; } }
      const { world, view, d, m, spec } = driveWorld('jeep', x0, z0, a), seen = new Set(), trees = [];
      for (let i = 0; i < 1200; i++) {
        const cx = Math.floor(m.x / 128), cz = Math.floor(m.z / 128);
        for (let u = cx - 1; u <= cx + 1; u++) for (let v = cz - 1; v <= cz + 1; v++) { const k = u + ',' + v; if (seen.has(k)) continue; seen.add(k); for (const b of base) { const tr = { x: b.x + u * 128, z: b.z + v * 128, r: b.r }; trees.push(tr); world.addTreeBlock(tr); } }
        view.step(sx, sz, dt); if (d.speed >= spec.top) top += dt;
        if (i % 4 === 0) for (const tr of trees) { if (Math.abs(tr.x - m.x) > 20 || Math.abs(tr.z - m.z) > 20) continue; const gap = Math.hypot(tr.x - m.x, tr.z - m.z) - tr.r; if (gap < closest) closest = gap; }
      }
      const made = (m.x - x0) * sx + (m.z - z0) * sz; total += made; least = Math.min(least, made); bumps += view.bumps; runs++;
    }
    report[id] = { pieces: base.length, mean: Math.round(total / runs), least: Math.round(least), topSeconds: +(top / runs).toFixed(1), bumps };
    assert.ok(closest >= jeep.body + .25 - 1e-6, `${id}: never nearer a piece than the jeep's body (${closest.toFixed(2)} m)`);
    assert.ok(least > 100, `${id}: ${least.toFixed(0)} m made good at the least in 20 s`);
  }
  t.diagnostic(`${REAL ? 'real plan' : 'stand-in plan'}: ` + JSON.stringify(report));
  // The forest is the thickest and so the slowest; the meadow the most open.
  assert.ok(report.west.pieces > report.south.pieces * 2, 'the forest holds more than twice the meadow’s pieces'); assert.ok(report.south.mean >= report.west.mean, 'and the meadow drives the faster');
});
