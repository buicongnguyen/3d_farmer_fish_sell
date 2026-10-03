// Where the fruit-tree spots and the supermarket (wm-farm) meet the west doors and the tight ward (wm-doors) and bank fishing
// (wm-fish): saved tree indexes, the supermarket's corner of the ring road, the plain east gate, taps on stumps by a lane.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CIVIC, PARKING, ROADS, GATE, WEST_LANE } from '../src/content.mjs';
import { VILLAGE, inVillage } from '../src/field-layout.mjs';
import { SAFE, inSafeZone } from '../src/wilds.mjs';
import { villageTrees, livingTrees, hidesWalks, reserved, blockedAt, OLD_TREES } from '../src/village-plan.mjs';
import { LOTS, LANES_GRAVEL, onLotPath, onRoad, onWay, tapWalks } from '../src/lots.mjs';
import { LANES, laneDistance, lanePath, placeOf, placesOf } from '../src/villagers.mjs';
import { RESIDENTS } from '../src/content.mjs';
import { freshState, act, parseSave, ACTIONS } from '../src/game.mjs';
import { grovePlan } from '../src/grove.mjs';

const SM = CIVIC.find(c => c.id === 'supermarket'), MAIN = 'b17c1ba', MAIN_TREES = 157;
const checksum = list => { let sum = 0; for (const t of list) for (const v of [t.x, t.z, t.s, t.kind.length]) sum = (Math.imul(sum, 31) + Math.round(v * 1000)) | 0; return sum; };
/** A source file without its comments. */
const source = name => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('every tree index main has means the same tree; the West Lane’s trees keep theirs; gone is both branches’ lists together', async t => {
  const trees = villageTrees();
  assert.equal(OLD_TREES, 129); assert.equal(trees.length, 173, '129 old, round 7’s 28, the West Lane’s 16');
  // The first 157 as origin/main (b17c1ba) has them: place, size and kind. The number is main's own list, checked below
  // against a checkout of main's sources whenever the commit is at hand (a shallow clone has no history: the number stands in).
  assert.equal(checksum(trees.slice(0, MAIN_TREES)), 2059356877);
  await t.test('against origin/main’s own village plan (git show into a temp dir)', async s => {
    let dir;
    try {
      const files = ['village-plan.mjs', 'content.mjs', 'field-layout.mjs'].map(f => [f, execFileSync('git', ['show', `${MAIN}:src/${f}`], { cwd: new URL('..', import.meta.url), stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 24 })]);
      dir = mkdtempSync(join(tmpdir(), 'willowmere-main-')); mkdirSync(join(dir, 'src'));
      for (const [f, text] of files) writeFileSync(join(dir, 'src', f), text);
    } catch { s.skip(`commit ${MAIN} is not in this clone`); return; }
    try {
      const main = (await import(pathToFileURL(join(dir, 'src', 'village-plan.mjs')).href)).villageTrees();
      assert.equal(main.length, MAIN_TREES); assert.equal(checksum(main), 2059356877);
      main.forEach((m, i) => assert.deepEqual([trees[i].x, trees[i].z, trees[i].s, trees[i].kind], [m.x, m.z, m.s, m.kind], `tree ${i}`));
      // Nothing that main had removed came back, so no stump of an old save moves under a tree.
      main.forEach((m, i) => { if (m.gone) assert.ok(trees[i].gone, `tree ${i} was gone on main`); });
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  // wm-doors appended sixteen as 157..172: the avenue's first and last, the two on the front lawns.
  assert.deepEqual([trees[157].x, trees[157].z, trees[157].kind], [-26.4, -24.5, 'tree_round']); assert.deepEqual([trees[168].x, trees[168].z], [-37.4, -28.2]); assert.deepEqual([trees[172].x, trees[172].z, trees[172].kind], [-34.6, 11.4, 'tree_blossom']);
  assert.ok(trees.slice(157).every(k => !k.gone));
  // Gone: the supermarket's nine (wm-farm) and the lanes' three (wm-doors), with everything outside the tight footprint.
  for (const i of [11, 43, 88, 98, 102, 116, 13, 14, 46, 119, 120, 121]) assert.ok(trees[i].gone, `tree ${i}`);
  assert.equal(livingTrees().length, 47);
  assert.deepEqual(trees.map((k, i) => k.gone ? -1 : i).filter(i => i >= 0 && i < 157), [3, 12, 18, 30, 37, 51, 55, 67, 69, 105, 114, 122, 123, 124, 125, 126, 127, 128, 130, 131, 132, 133, 134, 135, 137, 151, 152, 153, 154, 155, 156]);
  // No standing tree is inside the supermarket, on its parking, on a lane, a front or back path, or at a family barn.
  for (const [i, k] of trees.entries()) {
    if (k.gone) continue; const r = .42 * k.s;
    assert.ok(inVillage(k.x, k.z), `tree ${i} in the village`);
    assert.ok(!(Math.abs(k.x - SM.x) < SM.w / 2 + r && Math.abs(k.z - SM.z) < SM.d / 2 + r), `tree ${i} in the supermarket`);
    assert.ok(!(k.x > PARKING.x0 - r && k.x < PARKING.x1 + r && k.z > PARKING.z0 - r && k.z < ROADS.north - 2.5), `tree ${i} on the parking`);
    assert.equal(onLotPath(k.x, k.z, r), false, `tree ${i} on a lane or a path`); assert.equal(onRoad(k.x, k.z), false, `tree ${i} on the road`);
    for (const l of LOTS) if (l.barn) assert.ok(!(Math.abs(k.x - l.barn.x) < l.barn.w / 2 + r && Math.abs(k.z - l.barn.z) < l.barn.d / 2 + r), `tree ${i} in the ${l.h.family} barn`);
  }
  // A save that cleared trees on either side's list still loads with the same list, and only standing trees are spots.
  const s = freshState(); s.cleared = [3, 11, 119, 127, 160]; const p = parseSave(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(p.cleared, [3, 11, 119, 127, 160]); assert.deepEqual(grovePlan(p).stumps.map(k => k.i), [3, 127, 160]);
});

test('the supermarket’s corner: parking off the road’s tarmac, inside the footprint and the ward; its lane node on the net', () => {
  // The ring's north-east corner is tarmac for x 49.5..54.5, z -35.5..-30.5 (the north road runs the ring's whole width; the
  // east road ends there). The parking is the same 4.5 m wide and begins where that tarmac ends, so it lies wholly north of it.
  const edge = ROADS.north - 2.5;
  assert.ok(PARKING.z1 <= edge && PARKING.x1 <= ROADS.east + 2.5 && PARKING.x0 >= SM.x + SM.w / 2, 'north of the north road’s outer edge, east of the building');
  for (let x = PARKING.x0; x <= PARKING.x1; x += .25) for (let z = PARKING.z0; z < edge; z += .25) {
    assert.equal(onRoad(x, z), false, `parking at ${x}, ${z} is not the road`); assert.ok(inVillage(x, z) || x === VILLAGE.x1, `parking at ${x}, ${z} in the village`); assert.ok(inSafeZone(x, z, -1), `a metre inside the ward at ${x}, ${z}`); assert.ok(reserved(x, z), 'kept clear of trees and flowers');
  }
  assert.ok(VILLAGE.x1 - PARKING.x1 >= 1 && PARKING.z0 - VILLAGE.z0 >= 1 && SAFE.x1 - PARKING.x1 >= 2 && PARKING.z0 - SAFE.z0 >= 2, 'a metre of verge inside the footprint, two inside the ward');
  // The four bays world.mjs paints (lines every 2.2 m from z0 + .6) lie between the parking's ends.
  for (let i = 0; i <= 4; i++) { const z = PARKING.z0 + .6 + i * 2.2; assert.ok(z > PARKING.z0 && z < edge, `bay line ${i}`); }
  assert.match(source('world.mjs'), /P\.z0\+\.6\+i\*2\.2/);
  // The east road, the spur and the gate are far south of it; the spur leaves the ring at z 0.
  assert.ok(Math.abs(GATE.z) < .01 && GATE.z - 2.5 > edge + 30);
  // The lane node on the north road's inner edge in front of the door: in the village, three metres inside the ward, joined both ways.
  const n = LANES.nodes.nSuper; assert.ok(n && inVillage(n.x, n.z) && inSafeZone(n.x, n.z, -3) && !blockedAt(n.x, n.z));
  assert.ok(LANES.edges.some(([a, b]) => a === 'nCompany' && b === 'nSuper') && LANES.edges.some(([a, b]) => a === 'nSuper' && b === 'ne') && !LANES.edges.some(([a, b]) => a === 'nCompany' && b === 'ne'));
  for (const id of ['wlN', 'wField', 'wlS', 'dAlder', 'dFinch', 'dVale']) { assert.ok(LANES.nodes[id], id); assert.ok(laneDistance('nSuper', id) < 320, `nSuper to ${id}`); }
  // Everyone reaches every place of their day, the supermarket's three from their homes on either side of the village.
  for (const p of RESIDENTS) for (const key of placesOf(p)) { const to = placeOf(p, key), path = lanePath(placeOf(p, 'home'), to); assert.ok(LANES.nodes[to.via], `${p.id} ${key}`); assert.deepEqual(path.at(-1), { x: to.x, z: to.z }, `${p.id} reaches ${key}`); }
});

test('the east gate is a plain road gate: no trip, no country place, nothing to tap', () => {
  assert.ok(ACTIONS.has('trip'), 'the visit to the supermarket still counts (chapter six)'); assert.equal(GATE.r, undefined);
  assert.ok(onRoad(GATE.x, GATE.z) && inVillage(GATE.x, GATE.z) && inSafeZone(GATE.x, GATE.z, -1), 'where the ring road ends and the spur begins');
  const world = source('world.mjs'), main = source('main.mjs');
  assert.doesNotMatch(world, /this\.target\('travel'|\btravel\(\)|location='country'|COUNTRY ROAD/); assert.match(world, /this\.sign\(this\.outside,'EAST GATE · OPEN FIELDS',GATE\.x\+2,0\)/);
  assert.doesNotMatch(main, /'travel'|world\.travel|country (market|road)/i);
  // An old save out on the spur (where the trip began on main: x 60..66) wakes on the ring road, inside the ward.
  for (const x of [60, 63, 66]) { const at = parseSave({ ...JSON.parse(JSON.stringify(freshState())), position: { x, z: 0 } }).position; assert.deepEqual(at, { ...GATE.back }); assert.ok(inSafeZone(at.x, at.z, -1) && inVillage(at.x, at.z) && onRoad(at.x, at.z)); }
});

test('a stump or a fruit tree beside a lane: within reach a tap opens its card, on the lane beyond reach the tap walks; planting is never refused for the view', () => {
  const trees = villageTrees(), avenue = [157, 158, 159, 160, 161, 162, 169, 170], [lane] = LANES_GRAVEL;
  for (const i of avenue) {
    const k = trees[i], spot = { type: 'spot', id: i, x: k.x, z: k.z, r: .42 * k.s + 1.35 };
    assert.ok(Math.abs(k.x - (WEST_LANE.x + WEST_LANE.w / 2)) < 4, `tree ${i} stands by the West Lane`);
    assert.equal(tapWalks(spot, k.x, k.z), false, 'a tap on the stump itself is the stump’s');
    // Between the stump and the lane (lawn, in and out of reach) a tap is the stump's: you walk up to it and its card opens.
    for (const dx of [-.8, -1.6, -2.6]) { assert.equal(onWay(k.x + dx, k.z), false); assert.equal(tapWalks(spot, k.x + dx, k.z), false); }
    // The whole lane is beyond the stump's reach (the avenue stands 3.3 m from its edge): a tap anywhere on it walks, though
    // the stump's unseen tap box covers the lane behind it from the camera.
    for (const [x, z] of [[lane.x + lane.w / 2 - .05, k.z], [lane.x, k.z], [lane.x - 1, k.z], [lane.x + 1, k.z + 3], [lane.x + 1, k.z - 3]]) { assert.ok(onWay(x, z)); assert.ok(Math.hypot(x - k.x, z - k.z) > spot.r); assert.equal(tapWalks(spot, x, z), true, `a tap on the lane at ${x}, ${z} walks`); }
  }
  // The rule itself: a way within a spot's reach still answers for the spot (a stump whose reach takes in a path's edge).
  const near = { type: 'spot', id: 0, x: lane.x + lane.w / 2 + .6, z: 5, r: 1.8 }; assert.ok(onWay(lane.x + 1, 5)); assert.equal(tapWalks(near, lane.x + 1, 5), false); assert.equal(tapWalks(near, lane.x - 1.2, 5), true);
  // Every one of them can be cleared and planted with any kind, the tallest included: a fruit tree is the player's choice,
  // so the sight-line rule (village-plan.mjs hidesWalks) is for the village's own trees only.
  const s = Object.assign(freshState(), { coins: 5000, energy: 100 }); s.settings.test = true;
  for (const i of avenue) { assert.ok(act(s, 'chop', { index: i }).ok, `clear ${i}`); assert.ok(act(s, 'plantSpot', { index: i, id: 'coconut' }).ok, `plant on ${i}`); }
  assert.deepEqual(Object.keys(parseSave(JSON.parse(JSON.stringify(s))).planted).map(Number), avenue);
  assert.ok(livingTrees().every(k => !hidesWalks(k)), 'the village’s own trees still leave the lanes in view');
  assert.doesNotMatch(source('grove.mjs') + source('grove-view.mjs') + source('game.mjs'), /hidesWalk/);
  // world.mjs gives every target the lane rule, stumps and fruit trees included (they are `spot` targets made by World.target).
  assert.match(source('world.mjs'), /this\.targets\.push\(spot\);wayGuard\(spot\);return spot;/);
  // At the pond's bank a stump in reach does not take the E key from the water, as a tree does not (rod-fishing.mjs).
  assert.match(source('rod-fishing.mjs'), /t\.type!=='fish'&&t\.type!=='chop'&&t\.type!=='spot'&&/);
});
