// Fruit trees on the spots of cleared village trees (game.mjs plantSpot / pickSpot / uproot, grove.mjs), the farm fixes
// that came with them, and the Willowmere Supermarket that took over the country market's trade.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { freshState, act, parseSave, calendar, plantCap, plantedCount, fruitTrees, livingTree, treeStage, treeWait, treeReady, fruitToday, sellPrice, chapterReady, payWorkers, CHOP_COST, FRUIT, SEASON_FRUIT, ACTIONS } from '../src/game.mjs';
import { TREES, ITEMS, CIVIC, PARKING, WORKPLACE, JOBS, CHAPTERS, RESIDENTS, ROADS, GATE, ORCHARD_POSITIONS, iconUrl } from '../src/content.mjs';
import { villageTrees, livingTrees, reserved, BLOCKS, SUPER_PROPS, inBlock, blockedAt, OLD_TREES } from '../src/village-plan.mjs';
import { chopRoom, grovePlan, grovePanel, groveArg, STAGE, trunkOf } from '../src/grove.mjs';
import { promptFor } from '../src/prompts.mjs';
import { inVillage } from '../src/field-layout.mjs';
import { inSafeZone } from '../src/wilds.mjs';
import { LANES, laneDistance, placeOf, placesOf, slotOf, lanePath } from '../src/villagers.mjs';
import { SHOPS, renderShop } from '../src/shop-view.mjs';
import { collectionLog } from '../src/house-rules.mjs';

const living = () => villageTrees().map((t, i) => ({ ...t, i })).filter(t => !t.gone);
const cleared = (n, extra = {}) => { const s = Object.assign(freshState(), { coins: 5000, ...extra }); s.cleared = living().slice(0, n).map(t => t.i); return s; };
const sleep = (s, n = 1) => { for (let i = 0; i < n; i++) act(s, 'sleep'); };

test('eight kinds of fruit tree, each with a price, a time to grow, a best season, a plural and a fruit with its picture', () => {
  assert.deepEqual(Object.keys(TREES), ['apple', 'grape', 'peach', 'mango', 'pineapple', 'coconut', 'lychee', 'durian']);
  const table = Object.fromEntries(Object.entries(TREES).map(([id, t]) => [id, [t.price, ITEMS[id].sell, t.grow, t.season, t.plural]]));
  assert.deepEqual(table, {
    apple: [65, 32, 2, 'Autumn', 'apples'], grape: [80, 28, 2, 'Autumn', 'grapes'], peach: [95, 42, 2, 'Summer', 'peaches'], mango: [120, 48, 3, 'Summer', 'mangoes'],
    pineapple: [150, 56, 3, 'Summer', 'pineapples'], coconut: [170, 60, 4, 'Winter', 'coconuts'], lychee: [200, 66, 4, 'Spring', 'lychees'], durian: [260, 90, 5, 'Autumn', 'durians'],
  });
  for (const id of Object.keys(TREES)) { assert.ok(existsSync(new URL(`../public/${iconUrl(ITEMS[id].icon).slice(2)}`, import.meta.url)), `${id} has an icon`); assert.ok(sellPrice(freshState(), id) > 0); }
  // The bookshelf's harvest row counts the five new fruits.
  assert.equal(collectionLog(freshState()).rows.find(r => r.id === 'harvest').total, 7 + 8);
  for (const type of ['plantSpot', 'pickSpot', 'uproot']) assert.ok(ACTIONS.has(type));
});

test('a cleared tree leaves a spot that takes any fruit tree; nothing else does', () => {
  const s = cleared(2), [a, b] = s.cleared, standing = living()[5].i, gone = villageTrees().findIndex(t => t.gone);
  assert.ok(act(s, 'plantSpot', { index: a, id: 'mango' }).ok); assert.equal(s.coins, 5000 - 120); assert.deepEqual(s.planted[a], { kind: 'mango', day: 1, picked: 0 });
  assert.match(act(s, 'plantSpot', { index: a, id: 'apple' }).message, /already/);
  assert.match(act(s, 'plantSpot', { index: standing, id: 'apple' }).message, /Clear a tree first/, 'a standing tree is not a spot');
  for (const index of [gone, 9999, -1, 1.5, undefined, 'x']) assert.equal(act(s, 'plantSpot', { index, id: 'apple' }).ok, false, `spot ${index}`);
  assert.equal(act(s, 'plantSpot', { index: b, id: 'banana' }).ok, false); assert.equal(act(s, 'plantSpot', { index: b }).ok, false);
  s.coins = 64; assert.match(act(s, 'plantSpot', { index: b, id: 'apple' }).message, /Save a little more/); assert.equal(s.planted[b], undefined);
  s.coins = 65; assert.ok(act(s, 'plantSpot', { index: b, id: 'apple' }).ok); assert.equal(s.coins, 0); assert.equal(plantedCount(s), 2); assert.equal(fruitTrees(s), 2);
  // Clearing a tree through the game makes its spot at once.
  const t = cleared(0); assert.ok(act(t, 'chop', { index: standing }).ok); assert.ok(act(t, 'plantSpot', { index: standing, id: 'durian' }).ok); assert.equal(t.coins, 5000 - CHOP_COST - 260);
});

test('the cap: 8 planted trees, 4 more with each tier of rich soil (so tier 1 now does something)', () => {
  const s = cleared(20); assert.equal(plantCap(s), 8);
  for (let i = 0; i < 8; i++) assert.ok(act(s, 'plantSpot', { index: s.cleared[i], id: 'apple' }).ok);
  const full = act(s, 'plantSpot', { index: s.cleared[8], id: 'apple' }); assert.equal(full.ok, false); assert.match(full.message, /holds 8 planted fruit trees/); assert.equal(s.coins, 5000 - 8 * 65);
  assert.ok(act(s, 'upgrade', { id: 'farm' }).ok); assert.equal(plantCap(s), 12); assert.ok(act(s, 'plantSpot', { index: s.cleared[8], id: 'apple' }).ok);
  assert.deepEqual([0, 1, 2, 3].map(farm => plantCap({ upgrades: { farm } })), [8, 12, 16, 20]);
  // The orchard's three circles are apart from the cap, and take every kind too.
  for (const [i, id] of ['durian', 'grape', 'coconut'].entries()) assert.ok(act(s, 'plantTree', { index: i, id }).ok); assert.equal(fruitTrees(s), 12);
});

test('a new farm has room for one of every kind on its stumps, and the "Clear this tree?" panel says how much room is left', () => {
  const s = cleared(Object.keys(TREES).length + 1, { coins: 9000 }); assert.ok(plantCap(freshState()) >= Object.keys(TREES).length, 'the first limit is not below the number of kinds');
  assert.equal(chopRoom(s), 'Fruit trees planted: 0 of 8. Room for 8 more.');
  for (const [n, id] of Object.keys(TREES).entries()) assert.ok(act(s, 'plantSpot', { index: s.cleared[n], id }).ok, `${id} on stump ${n + 1}`);
  assert.deepEqual(Object.values(s.planted).map(t => t.kind).sort(), Object.keys(TREES).sort());
  // Full: the panel says so before the 15 coins are spent on a stump that cannot be planted.
  assert.match(chopRoom(s), /^Fruit trees planted: 8 of 8. This stump cannot be planted until Rich soil makes room/);
  s.upgrades.farm = 1; assert.equal(chopRoom(s), 'Fruit trees planted: 8 of 12. Room for 4 more.');
});

test('a tree is a sapling, then young, then bears: 3 fruit a day, 5 in its best season, once a day', () => {
  const s = cleared(2), [m, a] = s.cleared; act(s, 'plantSpot', { index: m, id: 'mango' }); act(s, 'plantSpot', { index: a, id: 'apple' });
  const stages = []; for (let d = 0; d < 4; d++) { stages.push([treeStage(s, s.planted[m]), treeStage(s, s.planted[a]), treeWait(s, s.planted[m])]); if (d < 3) sleep(s); }
  assert.deepEqual(stages, [[0, 0, 3], [0, 1, 2], [1, 2, 1], [2, 2, 0]], 'mango: 3 mornings, apple: 2');
  assert.ok(treeReady(s, s.planted[m])); assert.equal(calendar(s).season, 'Spring'); assert.equal(fruitToday(s, s.planted[m]), FRUIT);
  const picked = act(s, 'pickSpot', { index: m }); assert.ok(picked.ok); assert.equal(picked.message, 'Three fresh mangoes, straight from the tree.'); assert.equal(s.inventory.mango, 3);
  assert.match(act(s, 'pickSpot', { index: m }).message, /tomorrow/); assert.equal(treeReady(s, s.planted[m]), false);
  sleep(s); assert.ok(act(s, 'pickSpot', { index: m }).ok); assert.equal(s.inventory.mango, 6);
  // Summer (days 8 to 14) is the mango's season: five a day. The apple still gives three (a bonus, never a penalty).
  while (calendar(s).season !== 'Summer') sleep(s);
  const summer = act(s, 'pickSpot', { index: m }); assert.equal(summer.message, 'Five fresh mangoes: Summer is their season.'); assert.equal(s.inventory.mango, 6 + SEASON_FRUIT);
  assert.ok(act(s, 'pickSpot', { index: a }).ok); assert.equal(s.inventory.apple, 3);
  // A young tree says how long, an empty spot asks for a sapling.
  const y = cleared(1); act(y, 'plantSpot', { index: y.cleared[0], id: 'durian' }); assert.match(act(y, 'pickSpot', { index: y.cleared[0] }).message, /Fruit in 5 morning/);
  assert.match(act(y, 'pickSpot', { index: 127 }).message, /sapling/);
  // Test mode: fruit at once.
  const t = cleared(1); t.settings.test = true; act(t, 'plantSpot', { index: t.cleared[0], id: 'lychee' }); assert.equal(treeStage(t, t.planted[t.cleared[0]]), 2); assert.ok(act(t, 'pickSpot', { index: t.cleared[0] }).ok);
  // The orchard's trees follow the same rule: the old two mornings for apple and peach, the plural spelled right.
  const o = freshState(); o.coins = 500; act(o, 'plantTree', { index: 0, id: 'peach' }); assert.equal(act(o, 'pickTree', { index: 0 }).ok, false); sleep(o, 2);
  assert.equal(act(o, 'pickTree', { index: 0 }).message, 'Three fresh peaches, straight from the tree.'); assert.equal(o.inventory.peach, 3);
});

test('clearing a fruit tree gives the spot back; clearing only works on a tree that stands', () => {
  const s = cleared(1), i = s.cleared[0]; act(s, 'plantSpot', { index: i, id: 'grape' }); const coins = s.coins, energy = s.energy;
  const r = act(s, 'uproot', { index: i }); assert.ok(r.ok); assert.match(r.message, /spot is free/); assert.equal(s.planted[i], undefined); assert.equal(s.coins, coins - CHOP_COST); assert.equal(s.energy, energy - 2); assert.equal(s.inventory.wood, 2);
  assert.ok(s.cleared.includes(i), 'the spot stays a spot'); assert.ok(act(s, 'plantSpot', { index: i, id: 'apple' }).ok);
  assert.equal(act(s, 'uproot', { index: 999 }).ok, false); s.energy = 0; assert.match(act(s, 'uproot', { index: i }).message, /tired/); assert.ok(s.planted[i]);
  // An orchard circle can be cleared the same way.
  const o = freshState(); act(o, 'plantTree', { index: 1, id: 'apple' }); assert.ok(act(o, 'uproot', { index: 1, orchard: true }).ok); assert.equal(o.trees[1], null); assert.ok(act(o, 'plantTree', { index: 1, id: 'grape' }).ok);
  // chop: a tree the village has no room for, or one that does not exist, costs nothing and gives nothing (it used to take 15 coins).
  const gone = villageTrees().findIndex(t => t.gone), c = freshState();
  for (const index of [gone, villageTrees().length, 999]) { assert.equal(act(c, 'chop', { index }).ok, false); assert.equal(livingTree(index), false); }
  assert.equal(c.coins, 160); assert.deepEqual(c.cleared, []); assert.equal(c.inventory.wood, undefined);
});

test('the prompt pill for a spot: plant, young, pick, picked today', () => {
  const s = cleared(1), i = s.cleared[0], spot = { type: 'spot', id: i, label: 'Plant a fruit tree' };
  assert.deepEqual(promptFor(s, spot), { label: 'Plant a fruit tree', wait: false });
  act(s, 'plantSpot', { index: i, id: 'mango' }); assert.deepEqual(promptFor(s, spot), { label: 'Young mango tree · fruit in 3 mornings', wait: true });
  sleep(s, 2); assert.deepEqual(promptFor(s, spot), { label: 'Young mango tree · fruit in 1 morning', wait: true });
  sleep(s); assert.deepEqual(promptFor(s, spot), { label: 'Pick fresh mangoes', wait: false });
  act(s, 'pickSpot', { index: i }); assert.deepEqual(promptFor(s, spot), { label: 'Picked today · more fruit tomorrow', wait: true });
  const o = freshState(); o.coins = 500; act(o, 'plantTree', { index: 0, id: 'peach' }); sleep(o, 2); assert.equal(promptFor(o, { type: 'tree', id: 0 }).label, 'Pick fresh peaches');
});

test('old saves: cleared trees become plantable spots; planted trees are checked; a save left on the gate’s road wakes inside the gate', () => {
  // A version 1 save from before fruit-tree spots: no `planted` field at all.
  const old = JSON.parse(JSON.stringify(freshState())); delete old.planted; old.cleared = [123, 127]; old.coins = 300;
  const s = parseSave(old); assert.deepEqual(s.planted, {}); assert.deepEqual(s.cleared, [123, 127]);
  assert.deepEqual(grovePlan(s).stumps.map(p => p.i), [123, 127], 'two stumps, both plantable'); assert.ok(act(s, 'plantSpot', { index: 123, id: 'mango' }).ok); assert.ok(act(s, 'plantSpot', { index: 127, id: 'apple' }).ok);
  // Round trip.
  const again = parseSave(JSON.parse(JSON.stringify(s))); assert.deepEqual(again.planted, s.planted); assert.equal(again.coins, 300 - 120 - 65);
  // What does not belong is dropped; a paid tree displaced by the layout keeps growing on a free stump.
  const gone = villageTrees().findIndex(t => t.gone), raw = JSON.parse(JSON.stringify(freshState()));
  raw.cleared = [123, 124, gone]; raw.day = 9; raw.coins = 100;
  raw.planted = { 123: { kind: 'mango', day: 4, picked: 8 }, 124: { kind: 'banana', day: 1 }, 125: { kind: 'apple', day: 1 }, [gone]: { kind: 'durian', day: 2 }, x: { kind: 'apple' }, 1.5: { kind: 'apple' }, 9999: null };
  const p = parseSave(raw); assert.deepEqual(p.planted, { 123: { kind: 'mango', day: 4, picked: 8 }, 124: { kind: 'durian', day: 2, picked: 0 } }); assert.equal(p.coins, 100, 'the displaced durian survives without repurchasing or regrowing it');
  assert.deepEqual(parseSave({ ...raw, planted: 'junk' }).planted, {}); assert.deepEqual(parseSave({ ...raw, planted: [1, 2] }).planted, {});
  // More trees than the land holds (an edited save): the extra ones are paid back.
  const many = JSON.parse(JSON.stringify(freshState())); many.cleared = living().slice(0, 11).map(t => t.i); many.planted = Object.fromEntries(many.cleared.map(i => [i, { kind: 'apple', day: 1, picked: 0 }]));
  const m = parseSave(many); assert.equal(plantedCount(m), 8); assert.equal(m.coins, 160 + 3 * 65);
  // A future day or pick is clamped.
  const f = parseSave({ ...JSON.parse(JSON.stringify(freshState())), day: 3, cleared: [123], planted: { 123: { kind: 'apple', day: 50, picked: 90 } } }); assert.deepEqual(f.planted[123], { kind: 'apple', day: 3, picked: 3 });
  // The country market is gone. A save made at its travel spot (or while "in country": the position was only ever written in the
  // village) stood out on the spur by the gate: it wakes on the ring road just inside the east gate (GATE.back). Other positions are left alone.
  for (const [x, z] of [[63, 0], [60.6, 1.2], [65.4, -3]]) assert.deepEqual(parseSave({ ...JSON.parse(JSON.stringify(freshState())), position: { x, z } }).position, { ...GATE.back });
  for (const [x, z] of [[52, 0], [63, 12], [250, 0], [-15, 0]]) assert.deepEqual(parseSave({ ...JSON.parse(JSON.stringify(freshState())), position: { x, z } }).position, { x, z });
  assert.ok(inVillage(GATE.back.x, GATE.back.z) && inSafeZone(GATE.back.x, GATE.back.z, -1) && !blockedAt(GATE.back.x, GATE.back.z), 'inside the village and a metre and more inside the ward');
});

test('layout migration preserves displaced fruit trees, surviving IDs and the daily harvest across repeated loads', () => {
  const all = villageTrees(), gone = all.findIndex(t => t.gone), missing = all.length + 7, kept = living()[0].i;
  const raw = Object.assign(freshState(), { day: 9, cleared: [gone, missing, kept], planted: {
    [gone]: { kind: 'durian', day: 2, picked: 9 }, [missing]: { kind: 'mango', day: 3, picked: 8 }, [kept]: { kind: 'apple', day: 1, picked: 0 },
  } });
  const s = parseSave(raw);
  assert.equal(plantedCount(s), 3); assert.equal(s.coins, raw.coins); assert.deepEqual(s.planted[kept], raw.planted[kept]);
  for (const [i, tree] of Object.entries(s.planted)) { assert.ok(livingTree(+i) && s.cleared.includes(+i)); assert.ok(treeWait(s, tree) === 0, 'mature trees stay mature'); }
  const durian = Object.keys(s.planted).find(i => s.planted[i].kind === 'durian'), mango = Object.keys(s.planted).find(i => s.planted[i].kind === 'mango');
  assert.equal(act(s, 'pickSpot', { index: +durian }).ok, false, 'migration cannot grant a second harvest today');
  assert.equal(act(s, 'pickSpot', { index: +mango }).ok, true, 'the displaced tree can still be picked normally');
  assert.equal(grovePlan(s).trees.length, 3, 'all owned trees have visible, interactive locations');
  assert.deepEqual(parseSave(JSON.parse(JSON.stringify(s))), s, 'saving again neither moves trees nor adds refunds');
});

test('the orchard hand picks what is ready each morning and never plants; the last chapter counts every fruit tree', () => {
  assert.equal(JOBS.picker.name, 'Orchard hand'); assert.equal(JOBS.picker.wage, 35);
  const s = cleared(3); const [a, b, c] = s.cleared; act(s, 'plantSpot', { index: a, id: 'apple' }); act(s, 'plantSpot', { index: b, id: 'durian' }); act(s, 'plantTree', { index: 0, id: 'peach' });
  s.met.ada = true; assert.ok(act(s, 'hire', { id: 'ada', job: 'picker' }).ok);
  sleep(s); assert.equal(s.inventory.apple, undefined, 'nothing is ready after one morning');
  sleep(s); assert.equal(s.inventory.apple, 3); assert.equal(s.inventory.peach, 3); assert.equal(s.inventory.durian, undefined); assert.equal(s.planted[a].picked, s.day); assert.equal(act(s, 'pickSpot', { index: a }).ok, false, 'already picked for you today');
  sleep(s); assert.equal(s.inventory.apple, 6); assert.equal(s.planted[c], undefined, 'the free spot stays free: a helper never plants'); assert.equal(plantedCount(s), 2);
  // Two hands do not pick twice.
  s.met.ellis = true; act(s, 'hire', { id: 'ellis', job: 'picker' }); sleep(s); assert.equal(s.inventory.apple, 9);
  const text = payWorkers(Object.assign(freshState(), { hired: { ada: 'picker' }, coins: 100 })); assert.match(text, /1 helper paid 35 coins/);
  // "Plant two fruit trees": the orchard and the planted spots count together, so a save that had two orchard trees still has it.
  const [label, check] = CHAPTERS[7].goals[0]; assert.equal(label, 'Plant two fruit trees');
  const o = freshState(); assert.equal(check(o), false); o.trees[0] = { kind: 'apple', day: 1, picked: 0 }; assert.equal(check(o), false); o.cleared = [123]; o.planted = { 123: { kind: 'mango', day: 1, picked: 0 } }; assert.ok(check(o));
  const two = freshState(); two.trees = [{ kind: 'apple', day: 1, picked: 0 }, { kind: 'peach', day: 1, picked: 0 }, null]; assert.ok(check(two)); const v1 = JSON.parse(JSON.stringify(two)); delete v1.planted; assert.ok(check(v1), 'a save without the field');
});

test('what the grove draws: stumps for empty spots, a tree per planting, a trunk no wider than the tree that stood there', () => {
  const s = cleared(3, { day: 6 }); const [a, b, c] = s.cleared, all = villageTrees();
  s.planted = { [a]: { kind: 'mango', day: 6, picked: 0 }, [b]: { kind: 'apple', day: 1, picked: 6 } }; s.trees = [null, { kind: 'peach', day: 5, picked: 0 }, null];
  const plan = grovePlan(s); assert.deepEqual(plan.stumps, [{ i: c, x: all[c].x, z: all[c].z }]);
  assert.deepEqual(plan.trees.map(t => [t.id, t.kind, t.stage, t.ready]), [[`spot:${a}`, 'mango', 0, false], [`spot:${b}`, 'apple', 2, false], ['orchard:1', 'peach', 1, false]]);
  assert.deepEqual([plan.trees[0].x, plan.trees[0].z], [all[a].x, all[a].z], 'on the very spot of the tree that was cleared');
  assert.deepEqual([plan.trees[2].x, plan.trees[2].z], [ORCHARD_POSITIONS[1].x, ORCHARD_POSITIONS[1].z]);
  for (const t of plan.trees) { const full = t.where === 'spot' ? trunkOf(all[t.index].s) : .5; assert.ok(Math.abs(t.r - full * STAGE[t.stage]) < 1e-9); assert.ok(t.r <= .5 && t.r <= .42 * (all[t.index]?.s ?? 2)); }
  assert.deepEqual(STAGE, [.35, .65, 1]);
  // A gone tree in `cleared` (an old save) draws nothing; a standing tree draws nothing here either.
  const gone = villageTrees().findIndex(t => t.gone); assert.deepEqual(grovePlan({ ...freshState(), cleared: [gone, 9999] }), { stumps: [], trees: [] });
  s.day = 7; assert.ok(grovePlan(s).trees[1].ready, 'ready again the next morning');
});

test('the picker: eight rows with a picture, a price, what it gives and when; the limit; the planted tree’s card', () => {
  const s = cleared(9, { coins: 130 }), i = s.cleared[0], v = grovePanel(s, `spot:${i}`);
  assert.equal(v.title, 'Plant a fruit tree'); assert.equal(v.kicker, 'FRUIT TREES 0 / 8'); assert.doesNotMatch(v.html, /undefined|NaN|\[object/);
  const rows = [...v.html.matchAll(/<div class="shop-item[^"]*" data-tree="(\w+)">(.*?)<\/button><\/div><\/div>/g)]; assert.deepEqual(rows.map(r => r[1]), Object.keys(TREES));
  for (const [, id, html] of rows) {
    assert.match(html, new RegExp(`<img src="[^"]*${id}\\.webp"`)); assert.ok(html.includes(`<b>${TREES[id].price}</b>`)); assert.ok(html.includes(`${ITEMS[id].sell} a fruit`)); assert.ok(html.includes(`best in ${TREES[id].season}`)); assert.ok(html.includes(`3 ${TREES[id].plural} a day`));
    assert.ok(html.includes(`data-action="plantFruit" data-where="spot" data-index="${i}" data-id="${id}"`)); assert.equal(html.includes('cant-afford'), TREES[id].price > 130, `${id} affordable`); assert.doesNotMatch(html, / disabled/);
  }
  // At the limit: every button is off and the reason is said.
  for (let k = 1; k < 9; k++) s.planted[s.cleared[k]] = { kind: 'apple', day: 1, picked: 0 };
  const full = grovePanel(s, `spot:${i}`); assert.equal(full.kicker, 'FRUIT TREES 8 / 8'); assert.match(full.html, /holds 8 planted fruit trees/); assert.equal((full.html.match(/data-action="plantFruit"[^>]* disabled/g) ?? []).length, 8);
  // An orchard circle takes the same eight, without the limit.
  const o = grovePanel(s, 'orchard:2'); assert.equal(o.kicker, 'YOUR FAMILY ORCHARD'); assert.equal((o.html.match(/data-action="plantFruit" data-where="orchard" data-index="2"/g) ?? []).length, 8); assert.doesNotMatch(o.html, / disabled/);
  // A planted tree: its stage, what it gives, Pick (off until ready), Clear this tree.
  const p = s.cleared[1], card = grovePanel(s, `spot:${p}`); assert.equal(card.title, 'Apple tree'); assert.match(card.html, /Sapling/); assert.match(card.html, /First fruit in 2 mornings/); assert.match(card.html, /data-action="pickFruit"[^>]* disabled/); assert.match(card.html, /data-action="uprootFruit" data-where="spot"/);
  s.day = 3; const ready = grovePanel(s, `spot:${p}`); assert.match(ready.html, /Bearing fruit/); assert.match(ready.html, /Ready to pick: 3 apples/); assert.doesNotMatch(ready.html, /data-action="pickFruit"[^>]* disabled/);
  assert.deepEqual(groveArg(s, 'orchard:1'), { where: 'orchard', index: 1, orchard: true, tree: null }); assert.equal(groveArg(s, `spot:${p}`).tree.kind, 'apple');
});

// ------------------------------------------------------------------------------------------------ the supermarket
const SM = CIVIC.find(c => c.id === 'supermarket'), CO = CIVIC.find(c => c.id === 'company');
test('the supermarket stands east of Willow & Co., on the Town Square, inside the village and well inside the ward', () => {
  assert.deepEqual({ ...SM }, { id: 'supermarket', shop: true, name: 'Willowmere Supermarket', verb: 'Shop at the supermarket', x: 42, z: -41, w: 15, d: 8, h: 8.6 });
  assert.equal(SM.x - SM.w / 2 - (CO.x + CO.w / 2), 4, 'four metres east of the office'); assert.equal(SM.x - CO.x, 16, 'on the Town Square’s 16 m pitch');
  assert.ok(SM.w * SM.d > 2 * CO.w * CO.d * .9, 'a big building: about twice the office’s footprint'); assert.ok(SM.z + SM.d / 2 < ROADS.north - 2.5, 'north of the road');
  const door = { x: SM.x, z: SM.z + SM.d / 2 + 1.8 };
  // What the ward must cover at the north-east (to reconcile with a ward that hugs the ring road): the building, its walk and
  // door, the parking and a metre round them: x <= 55.5, z >= -46.5.
  const need = [[SM.x - SM.w / 2 - 1, SM.z - SM.d / 2 - 1], [PARKING.x1 + 1, PARKING.z0 - 1], [PARKING.x1 + 1, PARKING.z1], [55.5, -46.5], [door.x, door.z], [SM.x, SM.z]];
  // The ward (wilds.mjs SAFE) is one metre beyond the footprint, so the metre round the parking is the ward's margin: the
  // things themselves stand in the village, and everything with its metre is inside the ward.
  for (const [x, z] of need) assert.ok(inSafeZone(x, z), `(${x}, ${z}) inside the ward`);
  for (const [x, z] of [[SM.x - SM.w / 2, SM.z - SM.d / 2], [PARKING.x0, PARKING.z0], [PARKING.x1, PARKING.z0], [PARKING.x1, PARKING.z1], [door.x, door.z], [SM.x, SM.z]]) assert.ok(inVillage(x, z), `(${x}, ${z}) in the village`);
  assert.ok(PARKING.x0 >= SM.x + SM.w / 2 && PARKING.x1 <= 55.5 - 1 && PARKING.z0 >= -46.5 + 1);
  // Its box and the things on its walk are colliders; the door spot and the staff's spots are free.
  for (const name of ['supermarket', ...SUPER_PROPS.map(b => b.name)]) assert.ok(BLOCKS.some(b => b.name === name), name);
  assert.equal(SUPER_PROPS.length, 6); for (const b of SUPER_PROPS) assert.ok(b.z + b.d / 2 <= SM.z + 5.6 && Math.abs(b.x - SM.x) + b.w / 2 <= SM.w / 2, `${b.name} within the model's footprint`);
  assert.equal(blockedAt(door.x, door.z), false); assert.ok(inBlock(SM.x, SM.z));
});

test('nine old trees made way for it and none was renumbered; no tree stands in it, on its parking or in reach of its door', () => {
  const trees = villageTrees(), away = [11, 13, 14, 43, 46, 88, 98, 102, 116];
  for (const i of away) assert.ok(trees[i].gone, `tree ${i} is gone`); assert.ok(!trees[18].gone, 'tree 18 behind the building stays');
  // Every one of the nine stood on the new ground, and they are the only living trees the supermarket removed (tree 13 also lies outside the tight footprint; with the West Lane's changes 47 stand).
  for (const i of away) assert.ok(trees[i].x > SM.x - SM.w / 2 - 3 && trees[i].x < PARKING.x1 + 1 && trees[i].z < ROADS.north);
  assert.equal(livingTrees().length, 47); assert.equal(trees.length, OLD_TREES + 28 + 16);
  const door = { x: SM.x, z: SM.z + SM.d / 2 + 1.8 };
  for (const [i, t] of trees.entries()) {
    if (t.gone) continue;
    assert.ok(!(Math.abs(t.x - SM.x) < SM.w / 2 + 1 && Math.abs(t.z - SM.z) < SM.d / 2 + 1), `tree ${i} in the building`);
    assert.ok(!(t.x > PARKING.x0 - 1 && t.x < PARKING.x1 + 1 && t.z > PARKING.z0 - 1 && t.z < ROADS.north), `tree ${i} on the parking`);
    assert.ok(Math.hypot(t.x - door.x, t.z - door.z) > .42 * t.s + 1.35 + .5, `tree ${i} would steal the door's E key`);
  }
  assert.ok(reserved(52, -40) && reserved(SM.x, SM.z - 5));
  // A planting spot has the reach of the tree that stood there (world.mjs), so no spot covers another thing to use: village.test checks every
  // tree's reach against every interaction spot, the supermarket's door included.
  assert.match(readFileSync(new URL('../src/world.mjs', import.meta.url), 'utf8'), /this\.target\('chop',i,[^;]*,t\.x,t\.z,\.42\*t\.s\+1\.35\);this\.target\('spot',i,'Plant a fruit tree',t\.x,t\.z,\.42\*t\.s\+1\.35\)/);
});

test('it takes over the country market’s trade: the same better price, a shop not an office, no country place left in the game', () => {
  assert.equal(SHOPS.country, undefined); assert.equal(SHOPS.supermarket.title, 'Willowmere Supermarket'); assert.deepEqual(SHOPS.supermarket.tabs.map(t => t[0]), ['sell', 'seeds']);
  const s = freshState(); s.inventory = { carrot: 4, mango: 2 };
  assert.equal(sellPrice(s, 'carrot'), 19); assert.equal(sellPrice(s, 'carrot', true), 23); assert.equal(sellPrice(s, 'mango', true), 60);
  const here = renderShop({ state: s, tab: 'sell', shopId: 'supermarket' }), market = renderShop({ state: s, tab: 'sell', shopId: 'market' });
  assert.equal(here.title, 'Willowmere Supermarket'); assert.equal(here.tab, 'sell'); assert.match(here.cls, /shop-super/); assert.ok(here.html.includes('23 each') && here.html.includes('60 each')); assert.ok(market.html.includes('19 each') && market.html.includes('48 each'));
  assert.match(here.html, /25% more/); assert.equal(renderShop({ state: s, tab: 'outfits', shopId: 'supermarket' }).tab, 'sell');
  // The first visit is the trip chapter six asks for; a chapter-six save finishes by going there, later saves are untouched.
  const six = Object.assign(freshState(), { chapter: 5 }); assert.equal(CHAPTERS[5].goals[0][0], 'Visit the supermarket'); assert.equal(chapterReady(six), false);
  const trip = act(six, 'trip'); assert.ok(trip.ok); assert.match(trip.message, /Supermarket/); assert.ok(chapterReady(six)); assert.ok(act(six, 'claim').ok); assert.equal(six.chapter, 6);
  const later = parseSave(JSON.parse(JSON.stringify(Object.assign(freshState(), { chapter: 7, stats: { ...freshState().stats, trips: 1 } })))); assert.equal(later.chapter, 7); assert.equal(later.stats.trips, 1);
  // No words about the old place are left for the player to read (comments aside), in any source or in the page.
  const dir = new URL('../src/', import.meta.url);
  for (const f of readdirSync(dir).filter(f => /\.(mjs|css)$/.test(f))) {
    const text = readFileSync(new URL(f, dir), 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(text, /country (market|road)|COUNTRY (MARKET|ROAD)|hillside market|'travel'|world\.travel|shop-country/i, f);
  }
  for (const c of CHAPTERS) assert.doesNotMatch(c.text + c.memory + c.goals.map(g => g[0]).join(), /country market/i);
  for (const p of RESIDENTS) assert.doesNotMatch(p.line, /country market/i);
  assert.match(RESIDENTS.find(p => p.id === 'bea').line, /supermarket/);
});

test('Nell, Oren and Finn work at the supermarket, reached by the lane along the north road', () => {
  assert.deepEqual(['nell', 'oren', 'finn'].map(id => WORKPLACE[id]), ['supermarket', 'supermarket', 'supermarket']);
  assert.ok(LANES.nodes.nSuper); assert.deepEqual([LANES.nodes.nSuper.x, LANES.nodes.nSuper.z], [SM.x, ROADS.north + 1.3]);
  assert.ok(Math.abs(laneDistance('nCompany', 'ne') - (laneDistance('nCompany', 'nSuper') + laneDistance('nSuper', 'ne'))) < 1e-9, 'the node lies on the old lane');
  const spots = [];
  for (const id of ['nell', 'oren', 'finn']) {
    const p = RESIDENTS.find(r => r.id === id), at = placeOf(p, 'supermarket');
    assert.ok(placesOf(p).includes('supermarket')); assert.equal(at.via, 'nSuper'); assert.equal(at.inside, true, 'indoors: you knock'); assert.equal(at.where, 'Willowmere Supermarket');
    assert.equal(blockedAt(at.x, at.z), false, `${id} stands free`); assert.ok(inSafeZone(at.x, at.z, -3), 'three metres inside the ward'); assert.ok(Math.abs(at.x - SM.x) < SM.w / 2);
    for (const time of [8.9, 10, 11.4, 13.6, 16]) assert.equal(slotOf(p, { time, hired: {} }), 'supermarket', `${id} at ${time}`);
    assert.notEqual(slotOf(p, { time: 20, hired: {} }), 'supermarket');
    const path = lanePath(placeOf(p, 'home'), at); assert.ok(path.length >= 2); spots.push(at);
  }
  for (const [i, a] of spots.entries()) for (const b of spots.slice(i + 1)) assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > 1, 'a place each');
  // The orchard hand's place is by the orchard, free of the trees' trunks.
  const ada = RESIDENTS.find(r => r.id === 'ada'), job = placeOf(ada, 'job:picker'); assert.ok(job && !blockedAt(job.x, job.z)); for (const o of ORCHARD_POSITIONS) assert.ok(Math.hypot(o.x - job.x, o.z - job.z) > 1.4);
});
