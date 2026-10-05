// Builds the inside of a Town Square building from a plan (facility-plans.mjs) with the house interior's own pieces (interior.mjs
// exports its shell helpers and baking): shell (floors, walls, doorways, two warm lights), the pieces (house kit and the fp_* props of
// facility-props.glb, all in world.assets), colliders from each placed piece's real box, targets and label chips, and the villagers
// whose timetable has them here now. Everything is merged into a few draws (bakeStatics). `leaveFacility` disposes it all.
//
//   buildFacility(world, {plan, deps})   deps: {state(), openPanel(name, arg), toast(text)}
//   leaveFacility(world)
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ROOM, wallSpans } from './home-plan.mjs';
import { slab, planks, tiles, shade, pool, bakeStatics, clearInterior, placePiece, boxOf, union, fitHit, vertexMaterial, VOID, EXTERIOR, BASE } from './interior.mjs';
import { installRoomView } from './room-view.mjs';
import { buildAvatar, disposeAvatar, avatarAssets } from './avatar.mjs';
import { outfitOf } from './outfits.mjs';
import { slotOf } from './villagers.mjs';
import { RESIDENTS } from './content.mjs';
import { FACILITY_EXIT, occupants } from './facility-plans.mjs';

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
export const peopleKey = (plan, state) => occupants(plan, state, RESIDENTS, slotOf).map(o => o.p.id).join(',');

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
  occupants(plan, state, RESIDENTS, slotOf).forEach(({ p, at }, i) => {
    const wants = outfitOf(p, false, state), avatar = buildAvatar(world, wants);
    avatar.scale.multiplyScalar(p.child ? .57 : .79); avatar.name = 'facility-' + p.id; avatar.rotation.y = at.rot ?? 0;
    const parts = avatar.userData.parts, hip = parts.leg_l.position.y * avatar.scale.y;
    avatar.position.set(at.x, at.sit ? at.sit - hip : 0, at.z); inside.add(avatar);
    if (avatar.userData.pending) avatarAssets(world, wants)?.then(() => { if (world.facility?.plan === plan) world.buildInterior(); });
    const height = p.child ? 1.55 : 2.15, target = world.target('person', p.id, `Talk to ${p.name}`, at.x, at.z, 1.1, inside); target.hit.position.set(at.x, 1.1, at.z);
    hotspots.push({ target, icon: '💬', text: p.name, box: { x0: at.x - .4, x1: at.x + .4, y0: Math.max(0, avatar.position.y), y1: avatar.position.y + height, z0: at.z - .4, z1: at.z + .4 }, person: true });
    people.push({ p, avatar, parts, at, seed: i * 1.7, y0: avatar.position.y, pose: at.pose ?? (at.sit ? 'sit' : p.child && !at.sit ? 'play' : 'stand') });
  });
  bakeStatics(inside, placed);
  world.__roomHotspots = hotspots;
  return { targets: world.targets.filter(t => t.location === 'interior'), people: people.length };
}

/** Idle poses (called every frame while inside): sitters sit, the teacher points, the yard children hop. */
export function animatePeople(world, t) {
  for (const m of world.__facilityPeople ?? []) {
    const p = m.parts, a = m.avatar, s = t + m.seed; let rx = 0, rz = .1, lx = 0, lz = -.1, legs = 0, hop = 0;
    if (m.pose === 'sit') { rx = -.55; lx = -.55; legs = -1.4; }
    else if (m.pose === 'teach') { rx = -2.3 + Math.sin(s * 1.6) * .18; rz = .3; }
    else if (m.pose === 'play') { const k = Math.sin(s * 3.2); hop = Math.max(0, k) * .18; rx = -1.2 * k; lx = 1.2 * k; legs = k * .5; }
    p.arm_r.rotation.set(rx, 0, rz); p.arm_l.rotation.set(lx, 0, lz); p.leg_l.rotation.x = legs; p.leg_r.rotation.x = m.pose === 'play' ? -legs : legs;
    p.head.rotation.y = m.pose === 'sit' ? Math.sin(s * .4) * .12 : Math.sin(s * .5) * .3; a.position.y = m.y0 + hop;
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
