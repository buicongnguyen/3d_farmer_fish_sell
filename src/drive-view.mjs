// Driving in the world (drive.mjs has the rules): moves the vehicle nose first in short sub-steps against houses
// and trees, seats the avatar, carries the pet, and leads the camera. World calls it from the lines that used to
// slide the vehicle under a walking avatar:
//   world.drive.board(ride) / dismount(ride)    stepping in and out
//   world.drive.step(dx, dz, dt)                 instead of the walk, while riding ((dx, dz): where the stick or the route points)
//   world.drive.pose()                           after the walk cycle: the seat, the limbs, the vehicle's mesh
//   world.drive.focus()                          where the camera should look (the player on foot)
//   world.drive.petSpot(pet)                     avatar.mjs: where the companion rides
// No allocation per frame.
import { VEHICLES, newDrive, stepDrive, bump, glance, subSteps, arrivalSpeed, routeSpeed, turnBetween, driveZoom, lookAhead, DRIVE_CAMERA } from './drive.mjs';
import { feetOf } from './avatar.mjs';

/**
 * Where the driver sits, in the model's own units (jeep.glb: the tub's top is at y 1.37 and the right-hand seat, the
 * one behind the steering wheel, at x -0.46; motorcycle.glb: the saddle's top at y 1.17, z -0.81..-0.07), and the pose:
 * `legs` swings both legs forward from the hip (they have no knees: in the jeep they reach into the footwell, hidden by
 * the body, never under the floor), `splay` spreads them round the motorcycle's saddle, `arms` reaches for the wheel or
 * the bars, `lean` tips the rider forward. `pet`: where a walking pet sits; a flying one hovers above that.
 */
export const SEATS = {
  jeep: { x: -.46, y: 1.41, z: -.2, legs: -1.2, splay: 0, arms: -1.25, lean: 0, pet: [.46, 1.39, -.12] },
  bike: { x: 0, y: 1.2, z: -.4, legs: -.62, splay: .42, arms: -1.2, lean: .22, pet: [0, 1.19, -.98] },
};
import { beyondVillage } from './field-layout.mjs'; // the village footprint: inside it a car keeps to cruise speed
/** A tapped route is planned for someone on foot: while it follows one, the vehicle squeezes through what a walker fits through. */
const ON_ROUTE = { radius: .32, body: .05 };
/** Round a trunk: the turns it tries (radians off the nose, to either side), and how long it then keeps to the side it found (seconds). */
const FEEL = [.6, 1.2, 1.8, 2.4, 3], KEEP_SIDE = .6, TURNED = 2;
/** Against a wall: how far along the stick it looks for the wall (metres), and the least share of the stick that must point along the wall for it to slide rather than rest. */
const PRESS = { reach: 1, slide: .5 };
const key = (cx, cz) => (cx + 4096) * 8192 + cz + 4096;

export class DriveView {
  constructor(world) {
    this.world = world; this.zoom = 1; this.lead = { x: 0, y: 0, z: 0 }; this.at = { x: 0, y: 0, z: 0 }; this.stowed = null; this.steps = 0; this.bumps = 0; this.avoid = 0; this.avoidHeading = 0; this.contact = false; this.resting = false; this.walled = false; this.side = 1; this.keepSide = 0;
    // World keeps its trees under string keys; driving asks "is a trunk here?" several times a frame, so they are mirrored under numbers.
    this.trees = new Map();
    const add = world.addTreeBlock.bind(world), remove = world.removeTreeBlock.bind(world);
    world.addTreeBlock = t => { const out = add(t), k = key(Math.floor(t.x / 8), Math.floor(t.z / 8)); let list = this.trees.get(k); if (!list) this.trees.set(k, list = []); list.push(t); return out; };
    world.removeTreeBlock = t => { const list = this.trees.get(key(Math.floor(t.x / 8), Math.floor(t.z / 8))); if (list) { const i = list.indexOf(t); if (i >= 0) list.splice(i, 1); } return remove(t); };
  }
  stateOf(ride) { ride.spec ??= VEHICLES[ride.id] ?? VEHICLES.jeep; ride.mesh.rotation.order = 'YXZ'; return ride.drive ??= newDrive(ride.mesh.rotation.y); }
  /**
   * Something a vehicle of this size cannot drive into at (x, z): the edge of the world, a building, a trunk. (The village's
   * fences stop nobody: they are no obstacle to walkers or to the route finder either, and a tapped route runs through them.)
   */
  blocked(x, z, spec) {
    const w = this.world, bound = w.bounds; if (Math.abs(x) > bound.x || Math.abs(z) > bound.z) return true;
    const r = spec.radius, list = w.colliders;
    for (let i = 0; i < list.length; i++) { const c = list[i]; if (c.location === w.location && Math.abs(x - c.x) < c.w / 2 + r && Math.abs(z - c.z) < c.d / 2 + r) return true; }
    if (w.location !== 'village') return false;
    const cx = Math.floor(x / 8), cz = Math.floor(z / 8), body = spec.body;
    for (let i = cx - 1; i <= cx + 1; i++) for (let k = cz - 1; k <= cz + 1; k++) { const trees = this.trees.get(key(i, k)); if (trees) for (let n = 0; n < trees.length; n++) { const t = trees[n], dx = x - t.x, dz = z - t.z, min = t.r + body + .25; if (dx * dx + dz * dz < min * min) return true; } }
    return false;
  }
  /** How far (metres) a vehicle of this size at (x, z) is past the line `blocked` draws round the edge of the world and the buildings: 0 when clear of them. */
  wallDepth(x, z, spec) {
    const w = this.world, bound = w.bounds, r = spec.radius, list = w.colliders; let deep = Math.max(0, Math.abs(x) - bound.x, Math.abs(z) - bound.z);
    for (let i = 0; i < list.length; i++) { const c = list[i]; if (c.location !== w.location) continue; const px = c.w / 2 + r - Math.abs(x - c.x), pz = c.d / 2 + r - Math.abs(z - c.z); if (px > 0 && pz > 0) deep = Math.max(deep, Math.min(px, pz)); }
    return deep;
  }
  /** The same, trunks included. */
  depth(x, z, spec) {
    const w = this.world; let deep = this.wallDepth(x, z, spec); if (w.location !== 'village') return deep;
    const cx = Math.floor(x / 8), cz = Math.floor(z / 8), body = spec.body;
    for (let i = cx - 1; i <= cx + 1; i++) for (let k = cz - 1; k <= cz + 1; k++) { const trees = this.trees.get(key(i, k)); if (trees) for (let n = 0; n < trees.length; n++) { const t = trees[n], dx = x - t.x, dz = z - t.z, min = t.r + body + .25, d2 = dx * dx + dz * dz; if (d2 < min * min) deep = Math.max(deep, min - Math.sqrt(d2)); } }
    return deep;
  }
  /**
   * May it move to (x, z)? Clear of everything (`deep` 0): only on to free ground. Already `deep` metres inside something's
   * margin (a tapped route squeezes past a wall as a walker would, and then the stick takes over with the vehicle's full
   * size): only to where it is no deeper, so it can leave or slide along, and never drives on in.
   */
  free(x, z, spec, deep) { return deep > 0 ? this.depth(x, z, spec) <= deep : !this.blocked(x, z, spec); }
  board(ride) {
    const d = this.stateOf(ride); d.speed = 0; d.steer = 0; d.straight = 0; d.heading = ride.mesh.rotation.y; this.contact = this.resting = false; this.avoid = 0;
    this.world.player.position.x = ride.mesh.position.x; this.world.player.position.z = ride.mesh.position.z;
  }
  dismount(ride) {
    const p = this.world.player, d = this.stateOf(ride); d.speed = 0; d.steer = 0; d.straight = 0;
    ride.driveSpeed = 0; ride.mesh.rotation.z = 0; p.rotation.x = 0; p.rotation.z = 0; p.position.y = 0;
    if (this.stowed) { this.stowed.visible = true; this.stowed = null; }
  }
  /** One frame of driving. (dx, dz) is where the stick points (zero: no input); a tapped route is followed when it is. */
  step(dx, dz, dt) {
    const w = this.world, ride = w.riding, d = this.stateOf(ride), spec = ride.spec, m = ride.mesh.position, path = w.path;
    let limit = Infinity, size = spec; this.resting = false; if (this.keepSide > 0) this.keepSide -= dt;
    if (this.contact && dx * dx + dz * dz >= .0025) {
      // It has just run into something. While the stick keeps pushing it into a wall it does not ram it again and again:
      // it slides along the wall when enough of the stick points that way, and rests against it (nose on) when not.
      const k = PRESS.reach / Math.hypot(dx, dz), ux = dx * k, uz = dz * k, here = this.wallDepth(m.x, m.z, spec);
      if (this.wallDepth(m.x + ux, m.z + uz, spec) <= here) { this.contact = false; if (this.walled) this.avoid = 0; } // the stick points away from the wall: follow it
      else {
        const alongX = this.wallDepth(m.x + ux, m.z, spec) <= here, alongZ = !alongX && this.wallDepth(m.x, m.z + uz, spec) <= here, share = (alongX ? Math.abs(ux) : alongZ ? Math.abs(uz) : 0) / PRESS.reach;
        this.avoid = 0;
        if (share < PRESS.slide) { this.resting = true; dx = dz = 0; d.speed = 0; }
        else { dx = alongX ? ux : 0; dz = alongX ? 0 : uz; limit = spec.cruise * share; }
      }
    }
    if (!this.resting && dx * dx + dz * dz < .0025) {
      dx = dz = 0;
      if (path.length) {
        // A tapped spot: steer for the next corner of the route, and arrive at the last one slowly enough to stop there.
        // Corners cost no speed, except one so near and so sharp that it lies inside the turning circle (routeSpeed).
        let p = path[0], gap = Math.hypot(p.x - m.x, p.z - m.z);
        while (path.length > 1 && gap < Math.max(1.5, d.speed * .15)) { path.shift(); p = path[0]; gap = Math.hypot(p.x - m.x, p.z - m.z); }
        if (path.length === 1 && gap < 1.2) path.shift(); else { size = ON_ROUTE; dx = p.x - m.x; dz = p.z - m.z; const end = path[path.length - 1]; limit = Math.min(Math.max(2.5, arrivalSpeed(spec, Math.hypot(end.x - m.x, end.z - m.z) - 1)), routeSpeed(spec, gap, turnBetween(d.heading, Math.atan2(dx, dz)))); }
      }
    }
    const want = dx || dz ? Math.atan2(dx, dz) : d.heading; // where it is asked to go
    // Just ran into something: for a moment it steers along it (or round it) instead of straight back into it.
    if (this.avoid > 0 && (dx || dz)) { this.avoid -= dt; dx = Math.sin(this.avoidHeading); dz = Math.cos(this.avoidHeading); }
    const outside = beyondVillage(m.x, m.z);
    const travel = stepDrive(d, spec, dx, dz, dt, w.location === 'village' ? outside : 0, limit), n = subSteps(travel), piece = travel / n, sx = Math.sin(d.heading) * piece, sz = Math.cos(d.heading) * piece;
    // Short pieces, each tested: at 38 m/s a frame covers up to 1.9 m, more than a trunk is thick.
    // Already inside something's margin (`deep` metres): see free().
    let deep = this.blocked(m.x, m.z, size) ? this.depth(m.x, m.z, size) : 0, keep = 0; this.steps = n;
    if (travel > 0) for (let i = 0; i < n; i++) {
      if (this.free(m.x + sx, m.z + sz, size, deep)) { m.x += sx; m.z += sz; if (deep > 0) deep = this.depth(m.x, m.z, size); continue; }
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
    p.rotation.order = 'YXZ'; p.rotation.set(seat.lean, d.heading, lean);
    p.position.set(this.at.x, this.at.y - feetOf(p).hip[0] * p.scale.y * Math.cos(seat.lean), this.at.z);
    if (parts) {
      const side = Math.sign(parts.leg_l.position.x) || 1;
      parts.leg_l.rotation.set(seat.legs, 0, side * seat.splay); parts.leg_r.rotation.set(seat.legs, 0, -side * seat.splay);
      parts.arm_l.rotation.x = seat.arms; parts.arm_r.rotation.x = seat.arms;
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
    const want = ride ? driveZoom(ride.spec ?? VEHICLES.jeep, ride.drive?.speed ?? 0) : 1;
    if (Math.abs(want - this.zoom) > 1e-4) {
      this.zoom += (want - this.zoom) * (1 - Math.exp(-dt * 2.2)); if (Math.abs(want - this.zoom) < .002) this.zoom = want;
      if (cam.isOrthographicCamera) { cam.zoom = 1 / this.zoom; cam.updateProjectionMatrix(); }
    }
    if (!ride?.drive) return p;
    const d = ride.drive, room = cam.isOrthographicCamera ? Math.min(cam.right, cam.top * 1.5) * this.zoom * DRIVE_CAMERA.room : 0, ahead = lookAhead(d.speed, room);
    this.lead.x = p.x + Math.sin(d.heading) * ahead; this.lead.y = 0; this.lead.z = p.z + Math.cos(d.heading) * ahead; return this.lead;
  }
  diagnostics() {
    const ride = this.world.riding, d = ride?.drive;
    return { zoom: this.zoom, steps: this.steps, bumps: this.bumps, resting: this.resting, riding: ride ? { id: ride.id, x: ride.mesh.position.x, z: ride.mesh.position.z, heading: d.heading, speed: d.speed, steer: d.steer, straight: d.straight, cruise: ride.spec.cruise, top: ride.spec.top } : null };
  }
}
export { DRIVE_CAMERA };
