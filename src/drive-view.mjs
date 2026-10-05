// Driving in the world (drive.mjs has the rules): moves the vehicle nose first in short sub-steps against houses
// and trees, seats the avatar, carries the pet, and leads the camera. World calls it from the lines that used to
// slide the vehicle under a walking avatar:
//   world.drive.board(ride) / dismount(ride)    stepping in and out
//   world.drive.step(dx, dz, dt)                 instead of the walk, while riding ((dx, dz): where the stick or the route points)
//   world.drive.pose()                           after the walk cycle: the seat, the limbs, the vehicle's mesh
//   world.drive.focus()                          where the camera should look (the player on foot)
//   world.drive.petSpot(pet)                     avatar.mjs: where the companion rides
// No allocation per frame.
import { VEHICLES, newDrive, stepDrive, bump, glance, subSteps, arrivalSpeed, routeSpeed, turnBetween, driveZoom, farZoom, openLimit, lookAhead, DRIVE_CAMERA } from './drive.mjs';
import { wildDepth } from './ward.mjs';
import { isWide, wideDepth } from './tree-blocks.mjs';
import { feetOf } from './avatar.mjs';
import { escapeRoute } from './drive-escape.mjs';

/**
 * Where the driver sits, in the model's own units (jeep.glb: the tub's top is at y 1.37 and the right-hand seat, the
 * one behind the steering wheel, at x -0.46; motorcycle.glb: the saddle's top at y 1.17, z -0.81..-0.07), and the pose:
 * `legs` swings both legs forward from the hip (they have no knees: in the jeep they reach into the footwell, hidden by
 * the body, never under the floor), `splay` spreads them round the motorcycle's saddle, `arms` reaches for the wheel or
 * the bars, `lean` tips the rider forward. `pet`: where a walking pet sits; a flying one hovers above that.
 */
export const SEATS = {
  jeep: { x: -.46, y: 1.41, z: -.2, legs: -1.2, splay: 0, arms: -1.25, lean: 0, pet: [.46, 1.39, -.12] },
  stand: { legs: 0, splay: 0, arms: 0, lean: 0 },
  bike: { x: 0, y: 1.2, z: -.4, legs: -.62, splay: .42, arms: -1.2, lean: .22, pet: [0, 1.19, -.98] },
};
import { beyondVillage } from './field-layout.mjs'; // the village footprint: inside it a car keeps to cruise speed
import { hyp } from './hyp.mjs';
import { slidePoint } from './navigation.mjs';
/** A tapped route is planned for someone on foot: while it follows one, the vehicle squeezes through what a walker fits through. */
/** The rider's pose, written in one place: the tilt on the seat, and the legs (swung forward, splayed round the saddle) and arms. */
export function seatPose(p, seat, heading, lean) {
  const parts = p.userData.parts; p.rotation.order = 'YXZ'; p.rotation.set(seat.lean, heading, lean);
  const side = Math.sign(parts.leg_l.position.x) || 1;
  parts.leg_l.rotation.set(seat.legs, 0, side * seat.splay); parts.leg_r.rotation.set(seat.legs, 0, -side * seat.splay);
  parts.arm_l.rotation.x = seat.arms; parts.arm_r.rotation.x = seat.arms;
}
/** Everything seatPose wrote, undone (the heading kept): the walk cycle only swings the legs on x, so a leg's splay on z would stay. */
export function standPose(p) { seatPose(p, SEATS.stand, p.rotation.y, 0); p.rotation.order = 'XYZ'; p.position.y = 0; }
const ON_ROUTE = { radius: .32, body: .05 };
/** Round a trunk: the turns it tries (radians off the nose, to either side), and how long it then keeps to the side it found (seconds). */
const FEEL = [.6, 1.2, 1.8, 2.4, 3], KEEP_SIDE = .6, TURNED = 2;
/**
 * Against a wall: how far along the stick it looks for the wall (metres); the least share of the stick that must point
 * along the wall for it to slide rather than rest (`slide`: the sine of 10 degrees, so it rests only with the stick all but
 * square on; `hold` more to leave a rest, so a thumb wavering at the threshold does not start and stop it); and the least
 * share of cruise it slides at (`least`). The screen is turned 0.38 rad, so "right" or "up" on the keys meets every
 * wall in the village 22 degrees off square: with a threshold of a half (30 degrees) those stopped dead at the first barn.
 * In a pocket (the wall it slides along runs into a second one: the barn and the tractor parked beside it, two market
 * stalls too close to pass between) it follows the second wall out, as long as that takes it no more than `back` of
 * the stick backwards, and keeps to that until the stick's own way is open or the stick has moved by `same` radians.
 * Back along the wall it came sliding down (a tractor met on the way to the barn's corner) it turns round on the spot
 * first (`about`: until the nose is that near the way out; a U-turn driven would carry it off the wall and round it would
 * go again), and only once for as long as it stays against walls: between two pockets it would go to and fro for ever.
 * Square on, but with the end of the wall within `corner` metres to one side (a clipped house corner, the well, the
 * silo): it goes round that end instead of resting, the side the stick leans to first.
 */
const PRESS = { reach: 1, slide: .17, hold: .05, least: .5, back: .75, same: .35, corner: 2.5, about: .6 };
/**
 * Wedged: the stick held for `time` seconds with `bumps` blows or more and still within `room` metres of where that began
 * (nose up against a pair of trunks with the stick pulled back; a trunk beside a wall). It stops and turns on the spot
 * to where the stick points (within `facing`), tries once more, and if that ends the same way it rests there until the stick moves.
 * Wedged against a wall by a trunk in its way along it (the tree off the hospital's corner, too near for the jeep), it
 * first takes that for a pocket and follows the wall the other way.
 */
const JAM = { room: 1.5, time: 1, bumps: 4, facing: .3 };
const key = (cx, cz) => (cx + 4096) * 8192 + cz + 4096;

export class DriveView {
  constructor(world) {
    this.world = world; this.zoom = 1; this.lead = { x: 0, y: 0, z: 0 }; this.at = { x: 0, y: 0, z: 0 }; this.stowed = null; this.steps = 0; this.bumps = 0; this.avoid = 0; this.avoidHeading = 0; this.contact = false; this.resting = false; this.rested = false; this.round = false; this.roundX = 0; this.roundZ = 0; this.roundStick = 0; this.slideX = 0; this.slideZ = 0; this.turnedBack = false; this.jam = { x: 0, z: 0, t: 0, bumps: 0, stick: 0, held: false, pivot: false, tried: false, stuck: false, wall: false, walled: false }; this.walled = false; this.side = 1; this.keepSide = 0;
    // World keeps its trees under string keys; driving asks "is a trunk here?" several times a frame, so they are mirrored under numbers.
    // Wide ones (tree-blocks.mjs: a pond, a lava pool, the nest) reach past the 3 x 3 cells read below, so they keep a short list of their own.
    this.trees = new Map(); this.wide = [];
    const add = world.addTreeBlock.bind(world), remove = world.removeTreeBlock.bind(world);
    world.addTreeBlock = t => { const out = add(t); if (isWide(t)) { this.wide.push(t); return out; } const k = key(Math.floor(t.x / 8), Math.floor(t.z / 8)); let list = this.trees.get(k); if (!list) this.trees.set(k, list = []); list.push(t); return out; };
    world.removeTreeBlock = t => { const list = isWide(t) ? this.wide : this.trees.get(key(Math.floor(t.x / 8), Math.floor(t.z / 8))); if (list) { const i = list.indexOf(t); if (i >= 0) list.splice(i, 1); } return remove(t); };
  }
  stateOf(ride) { ride.spec ??= VEHICLES[ride.id] ?? VEHICLES.jeep; ride.mesh.rotation.order = 'YXZ'; return ride.drive ??= newDrive(ride.mesh.rotation.y); }
  /**
   * Something a vehicle of this size cannot drive into at (x, z): the edge of the world, a building, a trunk. (The village's
   * fences stop nobody: they are no obstacle to walkers or to the route finder either, and a tapped route runs through them.)
   */
  blocked(x, z, spec) {
    const w = this.world, bound = w.bounds; if (Math.abs(x) > bound.x || Math.abs(z) > bound.z || (w.edgeDepth?.(x, z) ?? 0) > 0) return true; // the grid's end, and the edge of the thirteen squares (world.edgeDepth; a plain test rig has none)
    const r = spec.radius, list = w.colliders;
    for (let i = 0; i < list.length; i++) { const c = list[i]; if (c.location === w.location && Math.abs(x - c.x) < c.w / 2 + r && Math.abs(z - c.z) < c.d / 2 + r) return true; }
    if (w.location !== 'village') return false;
    const cx = Math.floor(x / 8), cz = Math.floor(z / 8), body = spec.body;
    for (let i = cx - 1; i <= cx + 1; i++) for (let k = cz - 1; k <= cz + 1; k++) { const trees = this.trees.get(key(i, k)); if (trees) for (let n = 0; n < trees.length; n++) { const t = trees[n], dx = x - t.x, dz = z - t.z, min = t.r + body + .25; if (dx * dx + dz * dz < min * min) return true; } }
    return wideDepth(this.wide, x, z, body + .25, true) > 0;
  }
  /** How far (metres) a vehicle of this size at (x, z) is past the line `blocked` draws round the edge of the world and the buildings: 0 when clear of them. */
  wallDepth(x, z, spec) {
    const w = this.world, bound = w.bounds, r = spec.radius, list = w.colliders; let deep = Math.max(0, Math.abs(x) - bound.x, Math.abs(z) - bound.z, w.edgeDepth?.(x, z) ?? 0); // the world's edge is a wall: the car slides along it
    for (let i = 0; i < list.length; i++) { const c = list[i]; if (c.location !== w.location) continue; const px = c.w / 2 + r - Math.abs(x - c.x), pz = c.d / 2 + r - Math.abs(z - c.z); if (px > 0 && pz > 0) deep = Math.max(deep, Math.min(px, pz)); }
    return deep;
  }
  /** The same, trunks included. */
  depth(x, z, spec) {
    const w = this.world; let deep = this.wallDepth(x, z, spec); if (w.location !== 'village') return deep;
    const cx = Math.floor(x / 8), cz = Math.floor(z / 8), body = spec.body;
    for (let i = cx - 1; i <= cx + 1; i++) for (let k = cz - 1; k <= cz + 1; k++) { const trees = this.trees.get(key(i, k)); if (trees) for (let n = 0; n < trees.length; n++) { const t = trees[n], dx = x - t.x, dz = z - t.z, min = t.r + body + .25, d2 = dx * dx + dz * dz; if (d2 < min * min) deep = Math.max(deep, min - Math.sqrt(d2)); } }
    return Math.max(deep, wideDepth(this.wide, x, z, body + .25, true));
  }
  /**
   * May it move to (x, z)? Clear of everything (`deep` 0): only on to free ground. Already `deep` metres inside something's
   * margin (a tapped route squeezes past a wall as a walker would, and then the stick takes over with the vehicle's full
   * size): only to where it is no deeper, so it can leave or slide along, and never drives on in.
   */
  free(x, z, spec, deep) { return deep > 0 ? this.depth(x, z, spec) <= deep : !this.blocked(x, z, spec); }
  // A repeated tree/wall jam needs the tree included in the wall escape route too.
  alongDepth(x, z, spec) { return this.jam.walled ? this.depth(x, z, spec) : this.wallDepth(x, z, spec); }
  /**
   * Something outside the driving shoves the vehicle by (dx, dz): a toy train (world.push with {car: true}). It moves in hops of 0.3 m
   * at most, one axis at a time, only on to ground `free` allows, so nothing is stepped through; the rider goes with it. `crawl`:
   * the speed drops to the vehicle's crawl. Returns true if it moved.
   */
  shove(ride, dx, dz, crawl = false) {
    const d = this.stateOf(ride), spec = ride.spec, m = ride.mesh.position, n = Math.max(1, Math.ceil(hyp(dx, dz) / .3)); let moved = false;
    for (let i = 0; i < n; i++) {
      const deep = this.depth(m.x, m.z, spec), x = m.x + dx / n, z = m.z + dz / n;
      if (dx && this.free(x, m.z, spec, deep)) { m.x = x; moved = true; }
      if (dz && this.free(m.x, z, spec, deep)) { m.z = z; moved = true; }
    }
    if (crawl && Math.abs(d.speed) > spec.crawl) { d.speed = Math.sign(d.speed) * spec.crawl; d.straight = 0; }
    this.world.player.position.x = m.x; this.world.player.position.z = m.z;
    return moved;
  }
  board(ride) {
    this.escape = this.escapeWatch = null;
    const d = this.stateOf(ride); d.speed = 0; d.steer = 0; d.straight = 0; d.heading = ride.mesh.rotation.y; this.contact = this.resting = this.rested = this.round = this.turnedBack = this.jam.held = false; this.slideX = this.slideZ = 0; this.avoid = 0;
    this.world.player.position.x = ride.mesh.position.x; this.world.player.position.z = ride.mesh.position.z;
  }
  dismount(ride) {
    const p = this.world.player, d = this.stateOf(ride); d.speed = 0; d.steer = 0; d.straight = 0;
    ride.driveSpeed = 0; ride.mesh.rotation.z = 0; standPose(p);
    if (this.stowed) { this.stowed.visible = true; this.stowed = null; }
  }
  /** One frame of driving. (dx, dz) is where the stick points (zero: no input); a tapped route is followed when it is. */
  step(dx, dz, dt) {
    const w = this.world, ride = w.riding, d = this.stateOf(ride), spec = ride.spec, m = ride.mesh.position, path = w.path;
    let limit = Infinity, size = spec; this.resting = false; if (this.keepSide > 0) this.keepSide -= dt;
    const held = dx * dx + dz * dz >= .0025, jam = this.jam;
    if (this.escape && !this.escape.length) this.escape = null;
    // Sustained collisions can oscillate around a tree without tripping the old position-based jam timer.
    if (held) {
      const angle = Math.atan2(dx, dz), watch = this.escapeWatch;
      if (!watch || Math.abs(turnBetween(watch.angle, angle)) > PRESS.same) { this.escape = null; const next = this.escapeWatch ??= {}; next.x = m.x; next.z = m.z; next.angle = angle; next.t = 0; next.bumps = this.bumps; }
      else if ((m.x - watch.x) * Math.sin(angle) + (m.z - watch.z) * Math.cos(angle) > 2) { watch.x = m.x; watch.z = m.z; watch.t = 0; watch.bumps = this.bumps; }
      else if (!this.escape && (watch.t += dt) > 4) { if (this.bumps - watch.bumps >= 4 || this.contact) this.escape = escapeRoute(this, spec, m.x, m.z, dx, dz); watch.t = 0; watch.bumps = this.bumps; }
    } else this.escape = this.escapeWatch = null;
    if (this.escape?.length) {
      const p = this.escape[0], tx = p.x - m.x, tz = p.z - m.z, gap = hyp(tx, tz), heading = Math.atan2(tx, tz);
      d.speed = 0;
      if (!Number.isFinite(gap)) this.escape = null;
      else if (gap < 1e-6) this.escape.shift();
      else { stepDrive(d, spec, tx, tz, dt, 0, 0);
      if (Math.abs(turnBetween(d.heading, heading)) < .03) {
        const step = Math.min(gap, dt * 3), x = m.x + tx / gap * step, z = m.z + tz / gap * step;
        if (this.free(x, z, spec, this.depth(m.x, m.z, spec))) { m.x = x; m.z = z; d.speed = 3; if (gap <= step + 1e-6) this.escape.shift(); } else this.escape = null;
      } }
      this.contact = this.round = this.resting = jam.held = false; this.avoid = 0; ride.driveSpeed = d.speed; w.player.position.x = m.x; w.player.position.z = m.z; return;
    }
    if (held) {
      // Wedged? (see JAM) Counted from where the stick was first held this way; moving on, or moving the stick, starts it again.
      const stick = Math.atan2(dx, dz);
      if (!jam.held || Math.abs(m.x - jam.x) > JAM.room || Math.abs(m.z - jam.z) > JAM.room || Math.abs(turnBetween(jam.stick, stick)) > PRESS.same) { jam.held = true; jam.x = m.x; jam.z = m.z; jam.stick = stick; jam.t = 0; jam.bumps = this.bumps; jam.pivot = jam.tried = jam.stuck = jam.wall = jam.walled = false; }
      else if (!jam.stuck && !jam.pivot && (jam.t += dt) > JAM.time) {
        if (this.bumps - jam.bumps >= JAM.bumps) { if (!jam.tried && Math.abs(turnBetween(d.heading, stick)) >= JAM.facing) jam.pivot = true; else if (this.contact && !this.round && !jam.walled) jam.wall = jam.walled = true; else jam.stuck = true; }
        jam.t = 0; jam.bumps = this.bumps;
      }
      if (jam.pivot && Math.abs(turnBetween(d.heading, stick)) < JAM.facing) { jam.pivot = false; jam.tried = true; jam.t = 0; jam.bumps = this.bumps; }
    } else jam.held = false;
    if (held && jam.stuck) { this.resting = true; this.avoid = 0; dx = dz = 0; d.speed = 0; }
    else if (held && jam.pivot) { this.avoid = 0; this.contact = this.round = false; d.speed = 0; limit = 0; }
    else if (this.contact && held) {
      // It has just run into something. While the stick keeps pushing it into a wall it does not ram it again and again:
      // it slides along the wall whenever the stick is more than a little off square, goes round a near corner or out of a
      // pocket, and rests against it (nose on) only when square on to a long wall or in a dead end (see PRESS).
      const k = PRESS.reach / hyp(dx, dz), ux = dx * k, uz = dz * k, here = this.wallDepth(m.x, m.z, spec);
      if (this.wallDepth(m.x + ux, m.z + uz, spec) <= here) { this.contact = this.round = this.turnedBack = false; this.slideX = this.slideZ = 0; if (this.walled) this.avoid = 0; } // the stick points away from the wall: follow it
      else {
        const R = PRESS.reach, stick = Math.atan2(ux, uz), forced = jam.wall; let ax = 0, az = 0, share = 0; jam.wall = false;
        const edgeAt = w.edgeDepth?.(m.x + ux, m.z + uz) ?? 0, edgeHit = edgeAt > 0 && this.wallDepth(m.x + ux, m.z + uz, spec) <= edgeAt + 1e-9;
        if (edgeHit) {
          // The thing pressed against is the circular edge: follow its tangent at the share of the stick that points along it; square on, rest nose on.
          const rr = hyp(m.x, m.z) || 1, tx = -m.z / rr, tz = m.x / rr, s = ux * tx + uz * tz; this.round = false; share = Math.abs(s) / R;
          if (share >= PRESS.slide + (this.rested ? PRESS.hold : 0)) { ax = Math.sign(s) * tx; az = Math.sign(s) * tz; }
        }
        else if (this.round && Math.abs(turnBetween(this.roundStick, stick)) < PRESS.same && this.wallDepth(m.x + this.roundX * R, m.z + this.roundZ * R, spec) <= here) { ax = this.roundX; az = this.roundZ; } // still on its way out of a pocket
        else {
          // The way along the wall: the axis that is open (at a corner where both are, the one more of the stick points along).
          const openX = this.wallDepth(m.x + ux, m.z, spec) <= here, openZ = this.wallDepth(m.x, m.z + uz, spec) <= here; this.round = false;
          if ((openX || openZ) && !forced) { const alongX = openX && (!openZ || Math.abs(ux) >= Math.abs(uz)); ax = alongX ? Math.sign(ux) : 0; az = alongX ? 0 : Math.sign(uz); share = Math.abs(alongX ? ux : uz) / R;
            if (share < PRESS.slide + (this.rested ? PRESS.hold : 0)) for (let n = 0, first = (alongX ? ux : uz) < 0 ? -1 : 1; n < 2 && !this.round; n++) {
              // All but square on: is the end of the wall near? Step along it, half a metre at a time, to where the stick's way is open.
              const side = n ? -first : first, tx = alongX ? side : 0, tz = alongX ? 0 : side;
              for (let c = .5; c <= PRESS.corner + 1e-9; c += .5) { const at = this.wallDepth(m.x + tx * c, m.z + tz * c, spec); if (at > here) break; if (this.wallDepth(m.x + tx * c + ux, m.z + tz * c + uz, spec) <= at) { this.round = true; this.roundStick = stick; ax = this.roundX = tx; az = this.roundZ = tz; break; } }
            }
          }
          else {
            // A pocket: neither. Out along the wall that costs less of the stick, if that is not too much (and not back the way it slid in).
            const bx = -Math.sign(ux), bz = -Math.sign(uz), canX = bx !== 0 && !(this.turnedBack && bx === -this.slideX) && this.wallDepth(m.x + bx * R, m.z, spec) <= here, canZ = bz !== 0 && !(this.turnedBack && bz === -this.slideZ) && this.wallDepth(m.x, m.z + bz * R, spec) <= here, outX = canX && (!canZ || Math.abs(ux) <= Math.abs(uz));
            if ((outX || canZ) && Math.abs(outX ? ux : uz) / R <= PRESS.back) { this.round = true; this.roundStick = stick; ax = this.roundX = outX ? bx : 0; az = this.roundZ = outX ? 0 : bz; if (ax === -this.slideX && az === -this.slideZ) this.turnedBack = true; }
            else if (forced) jam.stuck = true;
          }
        }
        this.avoid = 0;
        if (!this.round && share < PRESS.slide + (this.rested ? PRESS.hold : 0)) { this.resting = true; dx = dz = 0; d.speed = 0; }
        else {
          dx = this.slideX = ax; dz = this.slideZ = az; limit = spec.cruise * Math.max(PRESS.least, share);
          if (this.round && this.turnedBack && Math.abs(turnBetween(d.heading, Math.atan2(ax, az))) > PRESS.about) { d.speed = 0; limit = 0; jam.t = 0; jam.bumps = this.bumps; } // turning round on the spot (which is not being wedged)
        }
      }
    }
    this.rested = this.resting;
    if (!this.resting && dx * dx + dz * dz < .0025) {
      dx = dz = 0;
      if (path.length) {
        // A tapped spot: steer for the next corner of the route, and arrive at the last one slowly enough to stop there.
        // Corners cost no speed, except one so near and so sharp that it lies inside the turning circle (routeSpeed).
        let p = path[0], gap = hyp(p.x - m.x, p.z - m.z);
        while (path.length > 1 && gap < Math.max(1.5, d.speed * .15)) { path.shift(); p = path[0]; gap = hyp(p.x - m.x, p.z - m.z); }
        if (path.length === 1 && gap < 1.2) path.shift(); else { size = ON_ROUTE; dx = p.x - m.x; dz = p.z - m.z; const end = path[path.length - 1]; limit = Math.min(Math.max(2.5, arrivalSpeed(spec, hyp(end.x - m.x, end.z - m.z) - 1)), routeSpeed(spec, gap, turnBetween(d.heading, Math.atan2(dx, dz)))); }
      }
    }
    const want = dx || dz ? Math.atan2(dx, dz) : d.heading; // where it is asked to go
    // The world's edge ahead of the nose (world.edgeAhead: metres to the line that blocks, up to 48): asked to go on, it brakes in time to
    // meet that line at a crawl, at any angle; a heading that never meets it is not slowed. Added to the limits above, never instead of them.
    if ((dx || dz) && w.edgeAhead) limit = Math.min(limit, Math.max(spec.crawl, arrivalSpeed(spec, w.edgeAhead(m.x, m.z, Math.sin(d.heading), Math.cos(d.heading)) - 1)));
    // Just ran into something: for a moment it steers along it (or round it) instead of straight back into it.
    if (this.avoid > 0 && (dx || dz)) { this.avoid -= dt; dx = Math.sin(this.avoidHeading); dz = Math.cos(this.avoidHeading); }
    const outside = beyondVillage(m.x, m.z);
    // The land it drives on may slow it (world.lands.carLimit, builder B: 0.6 in the sea): that share of what it could do here.
    const land = w.location === 'village' ? w.lands?.carLimit(m.x, m.z) ?? 1 : 1; if (w.lands && w.landCalls) w.landCalls.car++; if (land < 1) limit = Math.min(limit, openLimit(spec, outside) * land);
    const travel = stepDrive(d, spec, dx, dz, dt, w.location === 'village' ? outside : 0, limit), n = subSteps(travel), piece = travel / n, sx = Math.sin(d.heading) * piece, sz = Math.cos(d.heading) * piece;
    // Short pieces, each tested: at 38 m/s a frame covers up to 1.9 m, more than a trunk is thick.
    // Already inside something's margin (`deep` metres): see free().
    let deep = this.blocked(m.x, m.z, size) ? this.depth(m.x, m.z, size) : 0, keep = 0; this.steps = n;
    if (travel > 0) for (let i = 0; i < n; i++) {
      if (this.free(m.x + sx, m.z + sz, size, deep)) { m.x += sx; m.z += sz; if (deep > 0) deep = this.depth(m.x, m.z, size); continue; }
      // The world's edge is a circle: the move is replaced by its part along the wall (edgeSlide), kept on the padded line.
      if ((w.edgeDepth?.(m.x + sx, m.z + sz) ?? 0) > 0) {
        const q = slidePoint(m.x, m.z, sx, sz, this.slideTmp ??= { x: 0, z: 0, sx: 0, sz: 0 });
        if (this.free(q.x, q.z, size, deep)) { keep = hyp(q.sx, q.sz) / piece; m.x = q.x; m.z = q.z; this.avoid = .25; this.avoidHeading = Math.atan2(q.sx, q.sz); d.speed = glance(spec, d.speed, keep, false); this.contact = true; this.walled = true; this.bumps++; break; }
      }
      // Against a wall: slide along it with the speed that points that way.
      const wall = this.wallDepth(m.x + sx, m.z + sz, size) > this.wallDepth(m.x, m.z, size), alongX = wall && this.free(m.x + sx, m.z, size, deep), alongZ = wall && !alongX && this.free(m.x, m.z + sz, size, deep);
      if (alongX) m.x += sx; else if (alongZ) m.z += sz;
      if (alongX || alongZ) { keep = Math.abs(alongX ? sx : sz) / piece; this.avoid = .25; this.avoidHeading = alongX ? Math.atan2(sx, 0) : Math.atan2(0, sz); } // the nose swings along the wall it slides on, so it still leads
      let round = alongX || alongZ;
      // A trunk or a corner: feel for a way round, a little to one side (the one it is asked to go to first), then the
      // other, and steer that way. Having gone round one to one side it keeps to that side for a moment: wedged between two
      // trunks it used to bounce from one to the other and stay there for good; now it follows the second one round. (Not
      // once that has turned it more than TURNED from where it is asked to go: in a grove that would lead it away.)
      if (!round) for (let n = 0, off = turnBetween(d.heading, want), kept = this.keepSide > 0 && Math.abs(off) < TURNED, first = kept ? this.side : off < 0 ? -1 : 1; n < FEEL.length * 2 && !round; n++) {
        const k = kept ? n % FEEL.length : n >> 1, side = kept ? (n < FEEL.length ? first : -first) : n & 1 ? -first : first;
        const h = d.heading + side * FEEL[k], reach = Math.max(piece, .1), tx = Math.sin(h) * reach, tz = Math.cos(h) * reach;
        if (this.free(m.x + tx, m.z + tz, size, deep)) { m.x += tx; m.z += tz; keep = Math.cos(FEEL[k]); this.avoid = .4; this.avoidHeading = h; this.side = side; this.keepSide = wall ? 0 : KEEP_SIDE; round = true; }
      }
      // A glancing blow keeps the speed that points along it (round a trunk, cruise and with it the build-up to top speed); nose on it is down to a crawl.
      d.speed = round ? glance(spec, d.speed, keep, !wall) : bump(d.speed) * .2; if (d.speed < spec.cruise * .85) d.straight = 0; this.contact = true; this.walled = wall; this.bumps++; break;
    }
    ride.driveSpeed = d.speed;
    w.player.position.x = m.x; w.player.position.z = m.z;
  }
  /** The vehicle's mesh, the rider on the seat with the limbs posed, the hand weapon put away. */
  pose() {
    const w = this.world, ride = w.riding, d = this.stateOf(ride), mesh = ride.mesh, seat = SEATS[ride.id] ?? SEATS.jeep, p = w.player, k = mesh.scale.x, parts = p.userData.parts;
    const sin = Math.sin(d.heading), cos = Math.cos(d.heading), lean = ride.id === 'bike' ? -d.steer * Math.min(1, d.speed / ride.spec.cruise) * .3 : -d.steer * Math.min(1, d.speed / ride.spec.cruise) * .035;
    mesh.position.y = 0; mesh.rotation.y = d.heading; mesh.rotation.z = lean;
    this.spot(mesh, seat.x, seat.y, seat.z, sin, cos, k, lean);
    // The hips rest on the seat whatever the avatar's height.
    seatPose(p, seat, d.heading, lean);
    p.position.set(this.at.x, this.at.y - feetOf(p).hip[0] * p.scale.y * Math.cos(seat.lean), this.at.z);
    if (parts) {
      const weapon = parts.hand_r?.children.length ? parts.hand_r.getObjectByName('weapon') : null;
      if (weapon && weapon.visible) { weapon.visible = false; this.stowed = weapon; }
    }
  }
  /** A seat-space point (model units) in the world, into this.at. */
  spot(mesh, x, y, z, sin, cos, k, lean) {
    const lx = x - Math.sin(lean) * y, ly = y * Math.cos(lean);
    this.at.x = mesh.position.x + (lx * cos + z * sin) * k; this.at.y = ly * k; this.at.z = mesh.position.z + (-lx * sin + z * cos) * k; return this.at;
  }
  /** avatar.mjs updateCompanion: the pet rides along (a walker on its seat, a flyer just above it). Returns the heading to face. */
  petSpot(pet) {
    const ride = this.world.riding, d = this.stateOf(ride), seat = SEATS[ride.id] ?? SEATS.jeep, at = this.spot(ride.mesh, seat.pet[0], seat.pet[1], seat.pet[2], Math.sin(d.heading), Math.cos(d.heading), ride.mesh.scale.x, ride.mesh.rotation.z);
    pet.position.set(at.x, at.y, at.z); return d.heading;
  }
  /** Where the camera should look: ahead of a moving vehicle (the player on foot). Also eases the pull-back with speed. */
  focus(dt) {
    const w = this.world, ride = w.riding, p = w.player.position, cam = w.camera;
    // Two pull-backs, the larger of the two: by speed, and by how far beyond the ward it is (the far view, drive.mjs farZoom).
    const want = ride ? Math.max(driveZoom(ride.spec ?? VEHICLES.jeep, ride.drive?.speed ?? 0), w.location === 'village' ? farZoom(w.zoom, wildDepth(p.x, p.z)) : 1) : 1;
    if (Math.abs(want - this.zoom) > 1e-4) {
      this.zoom += (want - this.zoom) * (1 - Math.exp(-dt * 2.2)); if (Math.abs(want - this.zoom) < .002) this.zoom = want;
      if (cam.isOrthographicCamera) { cam.zoom = 1 / this.zoom; cam.updateProjectionMatrix(); }
    }
    if (!ride?.drive) return p;
    const d = ride.drive, room = cam.isOrthographicCamera ? Math.min(cam.right, cam.top * 1.5) * this.zoom * DRIVE_CAMERA.room : 0, ahead = lookAhead(d.speed, room);
    this.lead.x = p.x + Math.sin(d.heading) * ahead; this.lead.y = 0; this.lead.z = p.z + Math.cos(d.heading) * ahead; return this.lead;
  }
  /** The wheel or a pinch changed world.zoom from `before` to `after` while the far view is open: the pull-back is rescaled at once, so the picture stays as it is. */
  keepView(before, after) {
    const w = this.world, p = w.player?.position, cam = w.camera;
    if (!w.riding || !p || w.location !== 'village' || farZoom(after, wildDepth(p.x, p.z)) <= 1) return;
    this.zoom = Math.max(1, this.zoom * before / after); if (cam.isOrthographicCamera) { cam.zoom = 1 / this.zoom; cam.updateProjectionMatrix(); }
  }
  diagnostics() {
    const ride = this.world.riding, d = ride?.drive;
    return { zoom: this.zoom, steps: this.steps, bumps: this.bumps, resting: this.resting, riding: ride ? { id: ride.id, x: ride.mesh.position.x, z: ride.mesh.position.z, heading: d.heading, speed: d.speed, steer: d.steer, straight: d.straight, cruise: ride.spec.cruise, top: ride.spec.top } : null };
  }
}
export { DRIVE_CAMERA };
