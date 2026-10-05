// The ways to the west houses' main doors, as the camera and a tap see them. The camera looks down from the south-east, so
// whatever is tall hides, and whatever has a tap box claims, the ground north-west of it. These tests keep that ground
// free where you walk: a tap on a lane, a path or the road walks there; nothing hides you on the lanes; nobody stands
// between the camera and a path; the Vale barn leaves the road to the jeep; the east gate is a plain road gate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HOUSES, RESIDENTS, ROADS, GATE, WINDMILL, WORKSHOP, WEST_LANE, FIELD_LANE, BED_POSITIONS, ORCHARD_POSITIONS } from '../src/content.mjs';
import { CAMERA_YAW, CAMERA_RISE, inVillage } from '../src/field-layout.mjs';
import { inSafeZone } from '../src/wilds.mjs';
import { LOTS, BACK_HOMES, LANES_GRAVEL, lotOf, onLotPath, onRoad, onWay, tapWalks } from '../src/lots.mjs';
import { villageTrees, livingTrees, hides, hidesWalker, hidesWalks, crownOf, WALKS, ROTOR, BLOCKS, blockedAt } from '../src/village-plan.mjs';
import { placeOf, placesOf, WEST_SPOTS } from '../src/villagers.mjs';
import { VEHICLES } from '../src/drive.mjs';

const far = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const SIGHT = { x: Math.sin(CAMERA_YAW) / CAMERA_RISE, z: Math.cos(CAMERA_YAW) / CAMERA_RISE };
/**
 * World.target's tap box for a spot (world.mjs): r x 1.4 wide and deep, 2.5 m tall (5 for a house), centred 1.1 m up.
 * True when the ray of a tap whose ground point is (x, z) passes through it: what World.click's raycast finds.
 */
function rayMeets(t, x, z) {
  const half = t.r * .7, tall = t.type === 'house' ? 5 : 2.5;
  for (let h = Math.max(0, 1.1 - tall / 2); h <= 1.1 + tall / 2; h += .05) if (Math.abs(x + SIGHT.x * h - t.x) < half && Math.abs(z + SIGHT.z * h - t.z) < half) return true;
  return false;
}
/** What a tap at that ground point picks among `targets` (lots-view.mjs wayGuard applies tapWalks to each box). */
const picked = (targets, x, z) => targets.filter(t => rayMeets(t, x, z) && !tapWalks(t, x, z));
const beds = BED_POSITIONS.map((p, i) => ({ type: 'bed', id: i, x: p.x, z: p.z, r: 1.45 }));
const chops = () => livingTrees().map(t => ({ type: 'chop', x: t.x, z: t.z, r: .42 * t.s + 1.35 }));
/** The stump of a cleared tree is a planting spot with the tree's own reach and box (world.mjs `spot`). */
const spots = () => chops().map(t => ({ ...t, type: 'spot' }));
const fixed = () => [...beds, ...chops(), ...spots(), ...ORCHARD_POSITIONS.map((p, i) => ({ type: 'tree', id: i, x: p.x, z: p.z, r: 2 })), { type: 'shop', id: 'upgrades', x: WORKSHOP.x, z: WORKSHOP.z, r: WORKSHOP.r }];
const person = (at, id) => ({ type: 'person', id, x: at.x, z: at.z, r: 1.65 });

test('a tap on a lane, a path or the road walks there: no tap box behind which it lies takes it', () => {
  const [lane, field] = LANES_GRAVEL;
  // The trap: the first bed row's boxes stand between the camera and the Field Lane. Without the rule, half the lane is theirs.
  const lanePoints = []; for (let x = field.x - field.w / 2 + .2; x < field.x + field.w / 2; x += .5) for (const dz of [-.6, 0, .6]) lanePoints.push({ x, z: FIELD_LANE.z + dz });
  const shadowed = lanePoints.filter(p => beds.some(b => rayMeets(b, p.x, p.z)));
  assert.ok(shadowed.length > lanePoints.length * .3, `the bed boxes cover ${shadowed.length} of ${lanePoints.length} points of the Field Lane`);
  for (const p of lanePoints) { assert.ok(onWay(p.x, p.z)); assert.deepEqual(picked(fixed(), p.x, p.z), [], `a tap on the Field Lane at ${p.x.toFixed(1)}, ${p.z.toFixed(1)} walks`); }
  // The same on the West Lane, every front and back path, and all round the ring road (both lanes of it).
  const ways = [...WALKS];
  for (const l of LOTS) for (const path of l.paths) for (let x = path.x - path.w / 2 + .1; x < path.x + path.w / 2; x += .5) ways.push({ x, z: path.z });
  for (const off of [-1.6, 0, 1.6]) { for (let x = ROADS.west; x <= ROADS.east; x += .5) ways.push({ x, z: ROADS.north + off }, { x, z: ROADS.south + off }); for (let z = ROADS.north; z <= ROADS.south; z += .5) ways.push({ x: ROADS.west + off, z }, { x: ROADS.east + off, z }); }
  const all = fixed();
  for (const p of ways) { assert.ok(onWay(p.x, p.z) || onLotPath(p.x, p.z, .01), `${p.x}, ${p.z} is a way`); for (const t of picked(all, p.x, p.z)) assert.ok(far(t, p) <= t.r, `a tap on the way at ${p.x.toFixed(1)}, ${p.z.toFixed(1)} would use ${t.type} ${t.id ?? ''}`); }
  // The east gate is not a thing to use any more (no trip starts there): taps on the east road by it, and on the gate itself, walk.
  for (const [x, z] of [[53.5, -3], [54, -2], [53.8, -1.6], [GATE.x, GATE.z], [GATE.back.x, GATE.back.z]]) { assert.ok(onRoad(x, z)); assert.deepEqual(picked(all, x, z), [], `a tap by the gate at ${x}, ${z} walks`); }
  // What you mean to use still answers: a tap on a bed, on the workshop's counter, on a door from the lane.
  for (const b of beds.slice(0, 6)) assert.deepEqual(picked(beds.slice(0, 6), b.x, b.z).map(t => t.id), [b.id]); assert.equal(picked(all, WORKSHOP.x, WORKSHOP.z).some(t => t.type === 'shop'), true);
  for (const h of BACK_HOMES) { const d = lotOf(h).door, t = { type: 'house', id: h.id, x: d.x, z: d.z, r: d.r }; assert.equal(onWay(d.x, d.z), true, 'the door spot is on its path'); assert.equal(tapWalks(t, d.x + 3, d.z), false, 'a door is never refused'); assert.equal(picked([t], d.x, d.z).length, 1); }
  assert.equal(tapWalks(person({ x: -31, z: 0 }, 'ada'), -31, -2.5), false, 'nor a villager walking the lane');
  // Off the ways nothing changes: a bed's box still takes the taps on the grass and soil behind it.
  assert.equal(onWay(-15, -4.4), false); assert.equal(tapWalks(beds[2], -16.8, -4.4), false);
  assert.equal(onRoad(ROADS.east, 0), true); assert.equal(onRoad(ROADS.east + 6, 0), true, 'the spur'); assert.equal(onRoad(ROADS.east - 3, 0), false); assert.equal(onRoad(0, ROADS.south + 2.6), false);
});

test('nothing hides you on the way to a main door: no crown and no wind pump between the camera and the lanes', () => {
  assert.ok(WALKS.length > 400); for (const p of WALKS) assert.ok(onLotPath(p.x, p.z, .01), `${p.x}, ${p.z} is gravel`);
  for (const h of BACK_HOMES) { const d = lotOf(h).door; assert.ok(WALKS.some(p => far(p, { x: WEST_LANE.x, z: d.z }) < .3), `${h.family}: the junction is checked`); assert.ok(WALKS.some(p => far(p, d) < .01)); }
  // What the first build planted: an avenue of full-grown trees east of the lane, the wind pump beside it, two old farm trees.
  const junction = z => ({ x: WEST_LANE.x, z });
  assert.equal(hidesWalker({ x: -28, z: 3, s: 1.6, kind: 'tree_round' }, WEST_LANE.x, 0), true, 'old tree 120 hid the lane at z 0');
  assert.equal(hidesWalks({ x: -27.4, z: -20.5, s: 1.6, kind: 'tree_blossom' }), true); assert.equal(hidesWalks({ x: -27.4, z: 16.6, s: 1.7, kind: 'tree_round' }), true); assert.equal(hidesWalks({ x: -27.2, z: 23.6, s: 1.6, kind: 'tree_blossom' }), true);
  const oldRotor = { ...ROTOR, x: -28, z: -13.38 }; assert.ok([.3, 1, 1.6].some(y => hides(oldRotor, junction(lotOf(HOUSES[1]).door.z).x, lotOf(HOUSES[1]).door.z, y)), 'the rotor at -28, -14 hid Alder’s junction');
  // Now: every living tree, and the wind pump (rotor and tower), leave every point of the walks in view, head to shin.
  for (const t of livingTrees()) for (const p of WALKS) assert.equal(hidesWalker(t, p.x, p.z), false, `the tree at ${t.x}, ${t.z} hides ${p.x.toFixed(1)}, ${p.z.toFixed(1)}`);
  const tower = { x: WINDMILL.x, z: WINDMILL.z, from: 0, to: 6.8, r: 1.4 };
  for (const p of WALKS) for (const y of [.3, 1, 1.6]) { assert.equal(hides(ROTOR, p.x, p.z, y), false, `the rotor hides ${p.x}, ${p.z}`); assert.equal(hides(tower, p.x, p.z, y), false, `the tower hides ${p.x}, ${p.z}`); }
  assert.ok(WINDMILL.x > WEST_LANE.x + 8 && BLOCKS.some(b => b.name === 'windmill' && b.x === WINDMILL.x && b.z === WINDMILL.z)); assert.ok(inVillage(WINDMILL.x, WINDMILL.z));
  // The two farm trees that stood over the lane are gone and keep their indexes; the avenue's trees are young ones east of
  // the lane (crowns under 4.2 m) or stand west of it.
  const trees = villageTrees(); assert.ok(trees[120].gone && trees[121].gone); assert.deepEqual([trees[120].x, trees[120].z, trees[121].x, trees[121].z], [-28, 3, -27, 10]);
  const avenue = livingTrees().filter(t => Math.abs(t.x - WEST_LANE.x) < 6 && t.z > ROADS.north + 4 && t.z < ROADS.south - 4); assert.ok(avenue.length >= 8, `${avenue.length} trees along the lane`);
  for (const t of avenue) assert.ok(t.x < WEST_LANE.x - WEST_LANE.w / 2 - 1.5 || crownOf(t).to < 4.2 && t.x > WEST_LANE.x + WEST_LANE.w / 2 + 2.5, `the tree at ${t.x}, ${t.z}`);
  // A crown is a drum above the trunk: it hides what is north-west of it, never what is south-east.
  const t = { x: 0, z: 0, s: 1.6, kind: 'tree_round' }; assert.equal(hidesWalker(t, -1.5, -4), true); assert.equal(hidesWalker(t, 1.5, 4), false); assert.equal(hidesWalker(t, 0, 0), true, 'standing under it'); assert.equal(hidesWalker(t, -8, -4), false);
});

test('nobody stands between the camera and a front path: doorsteps, yards and callers keep north of it, and the door stays the nearest thing', () => {
  const reach = 2 * .82; // World: you go in (and so come out) within this of the door's spot
  for (const h of BACK_HOMES) {
    const lot = lotOf(h), d = lot.door, path = lot.paths[0], spots = [];
    for (const p of RESIDENTS.filter(p => p.home === h.id)) for (const key of ['home', 'yard']) spots.push({ ...placeOf(p, key), who: p.id });
    for (const p of RESIDENTS.filter(p => p.home !== h.id)) { const at = placeOf(p, `porch:${h.id}`); assert.ok(at && placesOf(p).includes(`porch:${h.id}`)); spots.push({ ...at, who: p.id }); }
    assert.ok(spots.length >= 23);
    for (const s of spots) {
      const name = `${s.who} ${s.key} at ${h.family}’s (${s.x.toFixed(1)}, ${s.z.toFixed(1)})`;
      assert.ok(s.z <= d.z - 2.5, `${name}: at least 2.5 m north of the path’s middle`); assert.ok(d.z - s.z < 8 && s.x > h.x + 3.3 + .4 && s.x < WEST_LANE.x - WEST_LANE.w / 2 - .5, `${name}: on the front lawn`);
      assert.equal(blockedAt(s.x, s.z), false, name); assert.equal(onLotPath(s.x, s.z, .3), false, `${name}: off the gravel`);
      // Wherever you stand within the door's reach, the door is nearer than this villager (World.nearest picks the nearest).
      assert.ok(far(s, d) > 2 * reach, `${name}: ${far(s, d).toFixed(2)} m from the door’s spot`);
      // Their tap box covers no point of the path or the lane, nor the door's spot; and no tree hides them.
      const box = person(s, s.who);
      for (let x = path.x - path.w / 2; x <= WEST_LANE.x + WEST_LANE.w / 2; x += .25) for (const dz of [-1.2, -.6, 0, .6, 1.2]) assert.equal(rayMeets(box, x, d.z + dz), false, `${name}: covers the path at ${x.toFixed(2)}, ${(d.z + dz).toFixed(1)}`);
      assert.equal(rayMeets(box, d.x, d.z), false); for (const t of livingTrees()) assert.equal(hidesWalker(t, s.x, s.z), false, `${name}: behind the tree at ${t.x}, ${t.z}`);
    }
    // The family's own spots do not share a place.
    const own = spots.filter(s => s.key !== `porch:${h.id}`); for (const a of own) for (const b of own) if (a !== b && a.key === b.key) assert.ok(far(a, b) > 1, `${a.who} and ${b.who} ${a.key}`);
  }
  assert.ok(WEST_SPOTS.step * 1 > 2 * reach && WEST_SPOTS.yard >= 2.5 && WEST_SPOTS.caller >= 2.5);
  // What it was: a yard spot a metre off the path's middle, whose box took the taps on the path.
  const d = lotOf(HOUSES[1]).door; assert.equal(rayMeets(person({ x: -33.8, z: -19.4 }, 'ada'), -33, d.z), true);
});

test('the Vale barn leaves the south road to the jeep, and the east gate leaves the ring road to walkers', () => {
  // drive-view.mjs blocked(): a vehicle is stopped where its radius meets a box. No family's house or barn reaches the tarmac that way.
  const r = VEHICLES.jeep.radius, names = new Set([...LOTS.map(l => l.h.family), ...LOTS.filter(l => l.barn).map(l => l.h.family.toLowerCase() + '-barn')]), boxes = BLOCKS.filter(b => names.has(b.name));
  assert.equal(boxes.length, LOTS.length + 1, 'five houses and the Vale barn');
  for (const b of boxes) for (let x = b.x - b.w / 2 - r; x <= b.x + b.w / 2 + r; x += .1) for (let z = b.z - b.d / 2 - r; z <= b.z + b.d / 2 + r; z += .1) assert.equal(onRoad(x, z), false, `a jeep on the road at ${x.toFixed(1)}, ${z.toFixed(1)} is stopped by ${b.name}`);
  const barn = lotOf(HOUSES[7]).barn, old = { x: -41, z: 29.8, d: 8.4 };
  assert.ok(old.z + old.d / 2 + r > ROADS.south - 2.5 + 1.3, 'the first build’s barn stopped the jeep 1.4 m onto the tarmac');
  assert.ok(barn.z + barn.d / 2 + r <= ROADS.south - 2.5, 'the whole inner lane is free'); assert.ok(barn.z - barn.d / 2 - (HOUSES[7].z + 4) >= 1.2, 'and the barn still stands clear of the house');
  assert.ok(Math.abs(barn.w - 7.4 * barn.scale) < 1e-9 && Math.abs(barn.d - 8.4 * barn.scale) < 1e-9 && barn.scale > .8 && barn.scale < 1);
  assert.ok(WORKSHOP.x < -6 && Math.abs(WORKSHOP.building.z + 9) < 1 && !blockedAt(WORKSHOP.x, WORKSHOP.z), 'the relocated workshop is left of the well, with a clear counter');
  // The gate: on the spur's first metre, inside the footprint and the ward. Nothing is offered there (the country market's
  // trade is at the supermarket), and a save left out on the spur wakes on the ring road beside it.
  assert.ok(inVillage(GATE.x, GATE.z) && inSafeZone(GATE.x, GATE.z, -1) && onRoad(GATE.x, GATE.z) && GATE.x > ROADS.east + 2.5 && GATE.r === undefined, 'a plain road gate: no reach, nothing to use');
  assert.doesNotMatch(readFileSync(new URL('../src/world.mjs', import.meta.url), 'utf8'), /this\.target\('travel'|travel\(\)\{|location='country'/, 'no travel target, no trip, no country place');
  assert.ok(Math.abs(GATE.back.x - ROADS.east) < 2.5 && inSafeZone(GATE.back.x, GATE.back.z, -1) && inVillage(GATE.back.x, GATE.back.z) && !blockedAt(GATE.back.x, GATE.back.z), 'a save left on the spur wakes on the ring road, inside the ward');
});
