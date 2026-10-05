// Round blockers of every width stop a walker, a car and a creature all the way round (round 8; owner: builder C).
// The three lookups read 3 x 3 cells of 8 m; a pond of r 11 or a lava pool of r 15 reaches beyond them (tree-blocks.mjs).
import test from 'node:test';
import { hyp } from '../src/hyp.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WIDE_BLOCK, isWide, wideDepth, blockMirror } from '../src/tree-blocks.mjs';
import { VEHICLES } from '../src/drive.mjs';
import { DriveView } from '../src/drive-view.mjs';

// World cannot be imported under node (it imports style sheets), so its four one-line methods are taken from the source as they are.
const source = readFileSync(new URL('../src/world.mjs', import.meta.url), 'utf8');
const method = name => { const line = source.split(/\r?\n/).find(l => l.startsWith(` ${name}(`)); assert.ok(line, `world.mjs has ${name} on one line`); return line; };
const World = new Function('isWide', 'hyp', `return class{${['addTreeBlock', 'removeTreeBlock', 'treesNear', 'treeBlocked'].map(method).join('\n')}}`)(isWide, hyp);

/** The round blockers of spec 3.9 (ponds; lava pools and the nest, carOnly), a tree and a cage, at awkward places on the 8 m grid. */
const BLOCKS = [
  { name: 'lake r 11', x: 34, z: 160, r: 11 }, { name: 'lake r 9', x: 18, z: 98, r: 9 }, { name: 'pond r 8', x: -100, z: 34, r: 8 }, { name: 'pond r 7', x: -150, z: -30, r: 7 },
  { name: 'candy pond r 6.6', x: -128, z: 128, r: 6.6 }, { name: 'pond r 6', x: -256, z: 20, r: 6 }, { name: 'pond on a cell corner', x: 8, z: -8, r: 6.6 },
  { name: 'lava pool r 15', x: -34, z: 290, r: 15, carOnly: true }, { name: 'lava pool r 11', x: -2, z: 252, r: 11, carOnly: true }, { name: 'nest r 14', x: 28, z: 228, r: 14, carOnly: true },
  { name: 'tree', x: 3.9, z: 7.9, r: .88 }, { name: 'cage', x: -145.59, z: 24.9, r: .95 },
];
/** Bearings out of 360 at which a point `out` metres from the block's edge is NOT stopped. */
const leaks = (b, out, stopped) => { let n = 0; for (let deg = 0; deg < 360; deg++) { const a = deg * Math.PI / 180; if (!stopped(b.x + Math.sin(a) * (b.r + out), b.z + Math.cos(a) * (b.r + out))) n++; } return n; };
const driveWorld = id => { const world = { bounds: { x: 5000, z: 5000 }, colliders: [], location: 'village', path: [], player: { position: { x: 0, y: 0, z: 0 } }, addTreeBlock(t) { return t; }, removeTreeBlock() {}, riding: { id, mesh: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1 } } } }; return { world, view: new DriveView(world) }; };

test('a walker is stopped all the way round every block, however wide, and walks into a carOnly one', () => {
  for (const b of BLOCKS) {
    const w = new World(); w.location = 'village'; w.riding = null; const block = w.addTreeBlock({ ...b });
    assert.equal(isWide(block), b.r > WIDE_BLOCK);
    if (b.carOnly) { assert.equal(leaks(b, .1, (x, z) => w.treeBlocked(x, z)), 360, `${b.name}: a walker may enter`); assert.equal(w.treeBlocked(b.x, b.z), false); w.riding = { id: 'jeep' }; }
    assert.equal(leaks(b, .1, (x, z) => w.treeBlocked(x, z)), 0, `${b.name}: stopped at the bank on every bearing`);
    assert.equal(leaks(b, .5, (x, z) => !w.treeBlocked(x, z)), 0, `${b.name}: free half a metre out`);
    assert.equal(w.treeBlocked(b.x, b.z), true, `${b.name}: stopped in the middle`);
    // Routes and perches find it from afar; removing it frees the ground.
    assert.ok(w.treesNear(b.x + b.r + 3, b.z, 4).includes(block), `${b.name}: treesNear reaches it`);
    w.removeTreeBlock(block); assert.equal(leaks(b, .1, (x, z) => w.treeBlocked(x, z)), 360, `${b.name}: gone when removed`); assert.equal(block.gone, true);
    assert.equal(w.treesNear(b.x, b.z, 4).includes(block), false);
  }
});

test('a jeep and a motorcycle are stopped all the way round every block, carOnly ones included', () => {
  for (const id of ['jeep', 'bike']) for (const b of BLOCKS) {
    const { world, view } = driveWorld(id), spec = VEHICLES[id], block = world.addTreeBlock({ ...b }), edge = spec.body + .25;
    assert.equal(leaks(b, edge - .05, (x, z) => view.blocked(x, z, spec)), 0, `${id}, ${b.name}: blocked at the bank on every bearing`);
    assert.equal(leaks(b, edge - .05, (x, z) => view.depth(x, z, spec) > 0), 0, `${id}, ${b.name}: depth agrees`);
    assert.equal(leaks(b, edge + .05, (x, z) => !view.blocked(x, z, spec) && view.depth(x, z, spec) === 0), 0, `${id}, ${b.name}: free just outside`);
    assert.ok(Math.abs(view.depth(b.x + b.r, b.z, spec) - edge) < 1e-9, `${id}, ${b.name}: depth is metres past the line`);
    world.removeTreeBlock(block); assert.equal(leaks(b, 0, (x, z) => view.blocked(x, z, spec)), 360, `${id}, ${b.name}: gone when removed`);
  }
});

test('Pandora\'s mirror: creatures go round a pond of any width and cross a carOnly block', () => {
  for (const b of BLOCKS) {
    const mirror = blockMirror(), block = { ...b }; mirror.add(block);
    const stopped = (x, z) => mirror.hit(x, z, .35);
    if (b.carOnly) { assert.equal(leaks(b, .1, stopped), 360, `${b.name}: no creature is stopped`); assert.equal(mirror.hit(b.x, b.z, .35), false); continue; }
    assert.equal(leaks(b, .3, stopped), 0, `${b.name}: stopped on every bearing`); assert.equal(leaks(b, .4, (x, z) => !stopped(x, z)), 0, `${b.name}: free outside`);
    mirror.remove(block); assert.equal(leaks(b, .1, stopped), 360, `${b.name}: gone when removed`); assert.equal(mirror.grid.size + mirror.wide.length, 0, 'nothing is left behind');
  }
  // The file that owns the creatures uses that mirror and nothing of its own.
  const view = readFileSync(new URL('../src/pandora-view.mjs', import.meta.url), 'utf8');
  assert.match(view, /const mirror = blockMirror\(\);/); assert.match(view, /const treeAt = mirror\.hit;/); assert.match(view, /\(world\.wideBlocks \?\? \[\]\)\.forEach\(mirror\.add\)/);
});

test('wideDepth: metres inside the grown disc, 0 outside, carOnly only for cars', () => {
  const list = [{ x: 0, z: 0, r: 10 }, { x: 40, z: 0, r: 12, carOnly: true }];
  assert.equal(wideDepth(list, 10.5, 0, 1, false), .5); assert.equal(wideDepth(list, 11.5, 0, 1, false), 0);
  assert.equal(wideDepth(list, 40, 0, 0, false), 0); assert.equal(wideDepth(list, 40, 0, 0, true), 12);
});

test('a toy train shoves a car: world.push with {car: true} moves the vehicle through what stops a car and drops it to a crawl', () => {
  // world.push as it is in the source, on a bare world with a real DriveView.
  const from = source.indexOf('\n push(dx,dz,opts){'), to = source.indexOf('\n }', from); assert.ok(from > 0 && to > from, 'world.mjs has push(dx,dz,opts)');
  const push = new Function("hyp", `return function ${source.slice(from + 2, to + 3)}`)(hyp);
  for (const id of ['jeep', 'bike']) {
    const { world, view } = driveWorld(id), spec = VEHICLES[id], m = world.riding.mesh.position; view.board(world.riding); world.drive = view; world.blocked = () => false; world.walkBlocked = world.blocked;
    const d = world.riding.drive; d.speed = spec.top;
    assert.equal(push.call(world, 2.2, 0), false, 'a gust or a pull leaves a rider alone'); assert.equal(m.x, 0); assert.equal(d.speed, spec.top);
    assert.equal(push.call(world, 2.2, 0, { car: true }), true, 'box shut: the train pushes the car'); assert.ok(Math.abs(m.x - 2.2) < 1e-9); assert.equal(d.speed, spec.top, 'and does not slow it');
    assert.equal(world.player.position.x, m.x, 'the rider goes with the car');
    assert.equal(push.call(world, 0, -2.2, { car: true, crawl: true }), true); assert.ok(Math.abs(m.z + 2.2) < 1e-9); assert.equal(d.speed, spec.crawl, 'box open: down to a crawl');
    d.speed = -spec.cruise; push.call(world, .3, 0, { car: true, crawl: true }); assert.equal(d.speed, -spec.crawl, 'reversing too');
    // A pond in the way: the car is pushed up to its bank and no further.
    const pond = world.addTreeBlock({ x: m.x + 12, z: m.z, r: 9 }), bank = pond.x - pond.r - spec.body - .25, x0 = m.x;
    push.call(world, 6, 0, { car: true }); assert.ok(m.x > x0 && m.x <= bank + 1e-9 && m.x > bank - .31, `${id}: stopped at the bank (${m.x} against ${bank})`); assert.equal(view.blocked(m.x, m.z, spec), false);
    assert.equal(push.call(world, 3, 0, { car: true }), false, 'nothing more to give');
    // On foot the same call walks the player, as before.
    world.riding = null; world.player.position.x = 0; world.player.position.z = 0; assert.equal(push.call(world, 1, 0, { car: true, crawl: true }), true); assert.ok(Math.abs(world.player.position.x - 1) < 1e-9);
    world.location = 'interior'; assert.equal(push.call(world, 1, 0), false, 'never indoors');
  }
});
