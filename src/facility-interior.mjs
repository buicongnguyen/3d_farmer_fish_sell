// Builds the inside of a Town Square building from a plan (facility-plans.mjs) with the house interior's own pieces (interior.mjs
// exports its shell helpers and baking): shell (floors, walls, doorways, two warm lights), the pieces (house kit and the fp_* props of
// facility-props.glb, all in world.assets), colliders from each placed piece's real box, targets and label chips, and the villagers
// whose timetable has them here now. Everything is merged into a few draws (bakeStatics). `leaveFacility` disposes it all.
//
//   buildFacility(world, {plan, deps})   deps: {state(), openPanel(name, arg), toast(text)}
//   leaveFacility(world)
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ROOM, SPAWN, wallSpans } from './home-plan.mjs';
import { findRoute } from './navigation.mjs';
import { slab, planks, tiles, shade, pool, bakeStatics, clearInterior, placePiece, boxOf, union, fitHit, vertexMaterial, VOID, EXTERIOR, BASE } from './interior.mjs';
import { installRoomView } from './room-view.mjs';
import { buildAvatar, disposeAvatar, avatarAssets } from './avatar.mjs';
import { outfitOf } from './outfits.mjs';
import { slotOf } from './villagers.mjs';
import { RESIDENTS } from './content.mjs';
import { FACILITY_EXIT, occupants, phaseOf } from './facility-plans.mjs';

const roomAt = (plan, p) => plan.rooms.find(r => p.x >= r.rect.x0 && p.x <= r.rect.x1 && p.z >= r.rect.z0 && p.z <= r.rect.z1);
export const shellKey = id => 'f:' + id;

function buildShell(plan) {
  const p = plan.palette, t = ROOM.thick, half = t / 2, group = new T.Group(); group.name = 'facility-shell-' + plan.id;
  const voidPlane = new T.Mesh(new T.PlaneGeometry(240, 240), new T.MeshBasicMaterial({ color: VOID })); voidPlane.rotation.x = -Math.PI / 2; voidPlane.position.y = -.62; group.add(voidPlane);
  const solid = [];
  solid.push(slab(ROOM.w + 1, .56, ROOM.d + 1, 0, -.36, 0, BASE), slab(ROOM.w + 1.04, .1, ROOM.d + 1.04, 0, -.11, 0, shade(p.trim, 1.08)));
  plan.rooms.forEach((room, i) => room.pattern === 'tiles' ? tiles(solid, room.rect, p.floors[room.id], .72) : planks(solid, room.rect, p.floors[room.id], i * 3 + plan.id.length));
  for (const wall of plan.walls) {
    const full = wall.height === 'full', h = full ? ROOM.full : ROOM.low;
    for (const [a, b] of wallSpans(wall)) {
      const mid = (a + b) / 2, len = b - a;
      for (const side of [-1, 1]) {
        const probe = wall.axis === 'x' ? { x: mid, z: wall.at + side * .45 } : { x: wall.at + side * .45, z: mid }, room = roomAt(plan, probe), hex = room ? p.walls[room.id] : EXTERIOR;
        const face = (fh, y, depth, c, off = 0) => solid.push(wall.axis === 'x' ? slab(len, fh, depth, mid, y, wall.at + side * (half / 2 + off), c) : slab(depth, fh, len, wall.at + side * (half / 2 + off), y, mid, c));
        face(h, h / 2, half, hex);
        if (!room) continue;
        if (full) { face(.95, .475, .03, shade(hex, .9), half / 2 + .015); face(.07, .97, .05, shade(p.trim, 1.25), half / 2 + .025); }
        face(.16, .08, .04, shade(hex, .72), half / 2 + .02);
      }
      solid.push(wall.axis === 'x' ? slab(len + .04, .09, t + .08, mid, h + .045, wall.at, p.trim) : slab(t + .08, .09, len + .04, wall.at, h + .045, mid, p.trim));
    }
  }
  for (const wall of plan.walls) for (const [a, b] of wall.gaps) solid.push(wall.axis === 'x' ? slab(b - a, .014, t + .06, (a + b) / 2, .007, wall.at, p.trim) : slab(t + .06, .014, b - a, wall.at, .007, (a + b) / 2, p.trim));
  const g = mergeGeometries(solid, false); solid.forEach(s => s.dispose());
  const mesh = new T.Mesh(g, vertexMaterial); mesh.name = 'interior-room'; mesh.receiveShadow = true; group.add(mesh);
  const lamp = new T.PointLight('#ffc47a', 38, 23, 1.25); lamp.position.set(-1.4, 5.6, 2.8); group.add(lamp);
  const fill = new T.PointLight('#fff1c8', 26, 20, 1.3); fill.position.set(0, 4.6, -5.3); group.add(fill);
  return group;
}

/** Wall boxes of a plan as colliders {x, z, w, d}. */
export function planWallBoxes(plan) {
  const t = ROOM.thick, out = [];
  for (const wall of plan.walls) for (const [a, b] of wallSpans(wall)) { const mid = (a + b) / 2, len = b - a; out.push(wall.axis === 'x' ? { x: mid, z: wall.at, w: len, d: t } : { x: wall.at, z: mid, w: t, d: len }); }
  return out;
}
/** What the timetable puts inside now, as a key that changes when someone arrives or leaves (the view rebuilds then). */
export const peopleKey = (plan, state, world) => occupants(plan, state, RESIDENTS, slotOf, awayOf(world)).map(o => o.p.id).join(',') + '|' + phaseOf(plan, state.time);
/** Is this villager out on a stroll just now (walking the lanes, in plain sight)? Then they are not shown inside as well. The outdoor villagers stand still while you are indoors, so the answer holds for the whole visit. */
const awayOf = world => p => { const list = world?.npcs; if (list) for (let i = 0; i < list.length; i++) if (list[i].p === p) return !!list[i].trip; return false; };

/**
 * Where you stand to talk to someone at the spot `at`: the nearest free floor in front of them, else beside or behind (a pupil sits
 * inside a desk's box, a clerk behind a counter: the walk to a target ends at its own x, z, so that must be floor you can reach).
 */
const RING = [0, .6, -.6, 1.2, -1.2, 1.9, -1.9, Math.PI];
function standBy(world, at) {
  const walls = world.colliders.filter(c => c.location === 'interior'), door = { x: SPAWN.x, z: SPAWN.z };
  for (const d of [.95, 1.3, 1.7, 2.2, 2.8]) for (const turn of RING) {
    const a = (at.rot ?? 0) + turn, x = at.x + Math.sin(a) * d, z = at.z + Math.cos(a) * d;
    if (Math.abs(x) < ROOM.w / 2 - .5 && Math.abs(z) < ROOM.d / 2 - .5 && !world.blocked(x, z) && findRoute(door, { x, z }, walls, world.bounds).length) return { x, z };
  }
  return at;
}
const AMBIENT_POOLS = [[0, 2.8, 4.8, .45]];
export function buildFacility(world, { plan, deps }) {
  disposePeople(world);
  clearInterior(world);
  const view = installRoomView(world); if (world.location === 'interior') view.swapIn();
  const state = deps.state(), inside = world.inside, placed = [], hotspots = [], boxes = {}, shells = world.__interiorShells ??= {};
  const key = shellKey(plan.id), shell = shells[key] ??= buildShell(plan); inside.add(shell);
  world.__decorBoxes = [];
  // Pieces first (their real boxes make the colliders and the label boxes), then the walls' colliders.
  for (const piece of plan.pieces) {
    const o = placePiece(world, inside, placed, piece); if (!o) continue;
    const box = boxOf(o); if (piece.role) boxes[piece.role] = union(boxes[piece.role], box);
    if (piece.block !== false && !piece.hang && !piece.y && box.y1 > .2) { const w = Math.max(.2, box.x1 - box.x0 - .14), d = Math.max(.2, box.z1 - box.z0 - .14); world.collider((box.x0 + box.x1) / 2, (box.z0 + box.z1) / 2, w, d, 'interior'); }
  }
  for (const c of planWallBoxes(plan)) world.collider(c.x, c.z, c.w, c.d, 'interior');
  for (const piece of plan.pieces) if (piece.kit === 'window' && piece.rot === 0) pool(inside, piece.x, -7.1, 1.7, .55);
  for (const [x, z, r, s] of AMBIENT_POOLS) pool(inside, x, z, r, s);

  const chip = (target, icon, text, box, lift = false) => { hotspots.push({ target, icon, text, box, lift }); fitHit(target, box); return target; };
  for (const d of plan.targets) {
    const t = world.target(d.type, d.id, d.label, d.x, d.z, d.r, inside); t.icon = d.icon; if (d.line) t.line = d.line;
    if (d.use === 'workers') t.use = () => deps.openPanel('workers');
    chip(t, d.icon, d.text, boxes[d.role] ?? { x0: d.x - .5, x1: d.x + .5, y0: 0, y1: 1.2, z0: d.z - .5, z1: d.z + .5 });
  }
  const ex = world.target('exit', 'door', 'Step outside', FACILITY_EXIT.x, FACILITY_EXIT.z, FACILITY_EXIT.r, inside);
  chip(ex, '🚪', 'Outside', { x0: -1.05, x1: 1.05, y0: 0, y1: 1.7, z0: 8.1, z1: 8.7 });

  // The villagers whose timetable has them here now.
  const people = world.__facilityPeople = [];
  occupants(plan, state, RESIDENTS, slotOf, awayOf(world)).concat(world.rescuedPosts?.(plan.id, state) ?? []).forEach(({ p, at, role }, i) => {
    const wants = outfitOf(p, false, state), avatar = buildAvatar(world, wants);
    avatar.scale.multiplyScalar(p.child ? .57 : .79); avatar.name = 'facility-' + p.id; avatar.rotation.y = at.rot ?? 0;
    const parts = avatar.userData.parts, hip = parts.leg_l.position.y * avatar.scale.y;
    avatar.position.set(at.x, at.sit ? at.sit - hip : 0, at.z); inside.add(avatar);
    if (avatar.userData.pending) avatarAssets(world, wants)?.then(() => { if (world.facility?.plan === plan) world.buildInterior(); });
    const height = p.child ? 1.55 : 2.15, stand = standBy(world, at), target = world.target('person', p.id, `Talk to ${p.name}`, stand.x, stand.z, 1.3, inside); target.hit.scale.set(.95, p.child ? .7 : .9, .6); target.hit.position.set(at.x, avatar.position.y + height * .5, at.z); target.role = role; // a tap box the size of the person: pupils sit a desk apart
    hotspots.push({ target, icon: '💬', text: p.name, box: { x0: at.x - .4, x1: at.x + .4, y0: Math.max(0, avatar.position.y), y1: avatar.position.y + height, z0: at.z - .4, z1: at.z + .4 }, person: true });
    people.push({ p, avatar, parts, at, role, sit: !!at.sit, seed: i * 1.7, y0: avatar.position.y, pose: at.pose ?? (at.sit ? 'sit' : p.child && !at.sit ? 'play' : 'stand') });
  });
  bakeStatics(inside, placed);
  world.__roomHotspots = hotspots;
  return { targets: world.targets.filter(t => t.location === 'interior'), people: people.length };
}

/** Idle poses (called every frame while inside; nothing is made here): sitters sit, the teacher points, the yard children hop, clerks type, readers read, lunch is eaten, shoppers reach for a shelf, Finn carries a crate. */
export function animatePeople(world, t) {
  const list = world.__facilityPeople; if (!list) return;
  for (let i = 0; i < list.length; i++) {
    const m = list[i], p = m.parts, a = m.avatar, s = t + m.seed, pose = m.pose; let rx = 0, rz = .1, lx = 0, lz = -.1, legs = m.sit ? -1.4 : 0, hop = 0, nod = 0;
    if (pose === 'sit') { rx = -.55; lx = -.55; }
    else if (pose === 'teach') { rx = -2.3 + Math.sin(s * 1.6) * .18; rz = .3; }
    else if (pose === 'play') { const k = Math.sin(s * 3.2); hop = Math.max(0, k) * .18; rx = -1.2 * k; lx = 1.2 * k; legs = k * .5; }
    else if (pose === 'type') { rx = -1.05 + Math.sin(s * 9) * .07; lx = -1.05 + Math.cos(s * 8) * .07; rz = -.12; lz = .12; }
    else if (pose === 'read') { rx = -1.25; lx = -1.25; rz = -.3; lz = .3; nod = .28 + Math.sin(s * .6) * .05; }
    else if (pose === 'eat') { const k = Math.max(0, Math.sin(s * 1.3)); rx = -.7 - k * 1.2; rz = -.25 * k; lx = -.5; nod = k * .12; }
    else if (pose === 'shop') { const k = Math.max(0, Math.sin(s * .7)); rx = -.5 - k * 1.3; lx = -.9; lz = .2; }
    else if (pose === 'carry') { rx = -1.1; lx = -1.1; rz = -.2; lz = .2; hop = Math.abs(Math.sin(s * 1.4)) * .02; }
    p.arm_r.rotation.set(rx, 0, rz); p.arm_l.rotation.set(lx, 0, lz); p.leg_l.rotation.x = legs; p.leg_r.rotation.x = pose === 'play' ? -legs : legs;
    p.head.rotation.set(nod, pose === 'sit' || nod ? Math.sin(s * .4) * .12 : Math.sin(s * .5) * .3, 0); a.position.y = m.y0 + hop;
  }
}
function disposePeople(world) { for (const m of world.__facilityPeople ?? []) { m.avatar.removeFromParent(); disposeAvatar(m.avatar); } world.__facilityPeople = []; }

/** Leaving: the villagers, the room, the shell and its lights go; nothing stays in memory but the loaded props. */
export function leaveFacility(world, plan) {
  disposePeople(world);
  const shells = world.__interiorShells ?? {}, key = plan && shellKey(plan.id), shell = shells[key];
  if (key) delete shells[key];
  clearInterior(world);
  if (shell) { shell.removeFromParent(); shell.traverse(o => { o.geometry?.dispose(); if (o.material && o.material !== vertexMaterial) o.material.dispose(); }); }
  world.__roomHotspots = [];
}
