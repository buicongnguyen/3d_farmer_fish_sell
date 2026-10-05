// The neighbours who ride to work (bike-plan.mjs has the plan): a lazy chunk, loaded by the villagers' view after the first frames.
// Two motorbikes (motorcycle.glb with its own paint), each parked at a house and at a bay by a facility's door. A rider walks to the
// bike beside them, mounts (the seat pose of drive-view.mjs eased in), rides the lane net at 7-9 m/s (slower in turns, stopping for
// people), parks, dismounts (standPose: legs straight) and walks on. The villager's own avatar is the rider (built by the same avatar
// builder as everybody's: only the pose is written here). No allocation per frame; nothing is saved.
import * as T from 'three';
import { seatPose, standPose, SEATS } from './drive-view.mjs';
import { feetOf } from './avatar.mjs';
import { BIKES, RIDE, routeOut, routeHome, parkedAt, rideWanted } from './bike-plan.mjs';
import { hyp } from './hyp.mjs';

const turnTo = (a, b, max) => { const d = Math.atan2(Math.sin(b - a), Math.cos(b - a)); return a + Math.max(-max, Math.min(max, d)); };
const SIZE = 2.8, SWEEP = 4.5, HALF = 1.6;
/**
 * The model is one toon material with its colours in the vertices, so a bike's own paint is made by copying the geometry and
 * recolouring the green body vertices (keeping each one's baked light and shade); everything else (rubber, steel, lamps) stays.
 */
function paint(root, hex) {
  const target = new T.Color(hex), seen = new Map();
  root.traverse(m => {
    if (!m.isMesh || !m.geometry?.attributes.color) return;
    let g = seen.get(m.geometry); if (!g) {
      g = m.geometry.clone(); const c = g.attributes.color, n = c.itemSize;
      for (let i = 0; i < c.count; i++) { const r = c.getX(i), gr = c.getY(i), b = c.getZ(i); if (gr > r * 1.5 && gr > b * 1.5 && gr > .02) { const k = gr / .34; c.setXYZ(i, Math.min(1, target.r * k), Math.min(1, target.g * k), Math.min(1, target.b * k)); } }
      c.needsUpdate = true; seen.set(m.geometry, g);
    }
    m.geometry = g; m.castShadow = false;
  });
}
class Bike {
  constructor(world, def, hour) {
    this.def = def; this.world = world; this.at = parkedAt(hour, def); this.phase = 'parked'; this.rider = null; this.speed = 0; this.route = null; this.i = 0; this.wait = 0; this.shadow = false;
    this.seatAt = { x: 0, y: 0, z: 0 }; this.seat = { x: 0, y: 0, z: 0, legs: 0, splay: 0, arms: 0, lean: 0 };
    const mesh = this.mesh = world.sized('motorcycle', world.outside, def.stand.x, def.stand.z, SIZE);
    paint(mesh, def.color);
    this.collider = { x: 0, z: 0, w: .9, d: 2.1, location: 'village' }; world.colliders.push(this.collider);
    this.park(this.at === 'home' ? def.stand : def.bay, this.at === 'home' ? def.stand.rot : def.bay.rot);
  }
  park(spot, rot) { const m = this.mesh, c = this.collider, across = Math.abs(Math.cos(rot)) > .7; m.position.set(spot.x, 0, spot.z); m.rotation.set(0, rot, 0); c.x = spot.x; c.z = spot.z; c.w = across ? .9 : 2.1; c.d = across ? 2.1 : .9; }
  /** The spot beside the bike (its left) that a rider walks to, with the lane node to join. */
  beside() { const m = this.mesh, h = m.rotation.y; return { x: m.position.x + Math.cos(h) * RIDE.side, z: m.position.z - Math.sin(h) * RIDE.side, inside: false, via: this.at === 'home' ? this.def.stand.via : this.def.bay.via, key: 'bike', where: this.def.label }; }
  /** The seat in the world (into this.seatAt): the model's seat point, turned with the heading and the lean. */
  seatSpot() {
    const m = this.mesh, k = m.scale.x, s = SEATS.bike, h = m.rotation.y, lean = m.rotation.z, sin = Math.sin(h), cos = Math.cos(h), lx = s.x - Math.sin(lean) * s.y, ly = s.y * Math.cos(lean), a = this.seatAt;
    a.x = m.position.x + (lx * cos + s.z * sin) * k; a.y = ly * k; a.z = m.position.z + (-lx * sin + s.z * cos) * k; return a;
  }
  /** The rider's limbs and height `k` of the way to sitting (0 standing, 1 seated), at the bike's heading. The caller places x and z. */
  pose(p, k) {
    const s = SEATS.bike, c = this.seat, seat = this.seatSpot();
    c.legs = s.legs * k; c.splay = s.splay * k; c.arms = s.arms * k; c.lean = s.lean * k;
    seatPose(p, c, this.mesh.rotation.y, this.mesh.rotation.z * k);
    p.position.y = (seat.y - feetOf(p).hip[0] * p.scale.y * Math.cos(c.lean)) * k;
  }
}

export class BikeRiders {
  constructor(view, hour, shadow) {
    this.view = view; this.shadow = shadow; this.bikes = BIKES.map(def => new Bike(view.world, def, hour)); this.byRider = new Map(this.bikes.map(b => [b.def.rider, b])); this.rides = 0;
    if (typeof window !== 'undefined' && window.willowmere) window.willowmere.bikes = () => this.diagnostics();
  }
  /** A villager is about to be sent to `to`: a rider whose bike is on this side goes to the bike first. Returns where to send them. */
  redirect(n, to) {
    const b = this.byRider.get(n.p.id); if (!b || n.noRide) return to;
    if (n.ride && !n.ride.busy) this.release(n);                                      // sent elsewhere before reaching the bike: look again
    if (n.ride || b.phase !== 'parked') return to;
    const dir = rideWanted(b.def, to.key, b.at); if (!dir) return to;
    n.ride = { bike: b, dir, busy: false, phase: 'walk', t: 0, from: { x: 0, z: 0 }, exit: { x: 0, z: 0 } }; b.phase = 'claimed'; b.rider = n; return b.beside();
  }
  release(n) { const r = n.ride; if (r && !r.busy) { r.bike.phase = 'parked'; r.bike.rider = null; n.ride = null; } }
  mount(n) {
    const r = n.ride, b = r.bike; r.busy = true; r.phase = 'mount'; r.t = 0; b.phase = 'mount'; b.collider.x = b.collider.z = 1e4;
    b.route = r.dir === 'out' ? routeOut(b.def) : routeHome(b.def); b.i = 0; b.speed = 0; b.wait = 0; n.mesh.visible = true; n.path = []; n.moving = false; this.rides++;
    r.from.x = n.mesh.position.x; r.from.z = n.mesh.position.z;
  }
  /** One frame of a busy rider (mounting, riding, dismounting); the view skips the walk for them. */
  step(n, dt) {
    const r = n.ride, b = r.bike, m = b.mesh, p = n.mesh;
    if (r.phase === 'mount') {
      r.t += dt; const k = Math.min(1, r.t / RIDE.mount), e = k * k * (3 - 2 * k), seat = b.seatSpot();
      b.pose(p, e); p.position.x = r.from.x + (seat.x - r.from.x) * e; p.position.z = r.from.z + (seat.z - r.from.z) * e; p.rotation.y = turnTo(p.rotation.y, m.rotation.y, 8 * dt);
      if (k >= 1) { r.phase = 'ride'; b.phase = 'ride'; }
    } else if (r.phase === 'ride') this.ride(n, dt);
    else if (r.phase === 'dismount') {
      r.t += dt; const k = Math.min(1, r.t / RIDE.mount), e = k * k * (3 - 2 * k);
      b.pose(p, 1 - e); p.position.x = r.from.x + (r.exit.x - r.from.x) * e; p.position.z = r.from.z + (r.exit.z - r.from.z) * e;
      if (k >= 1) { this.finish(n); return; }
    }
    this.light(b);
  }
  ride(n, dt) {
    const r = n.ride, b = r.bike, m = b.mesh, w = this.view.world;
    let goal = b.route[b.i], x = m.position.x, z = m.position.z, dx = goal.x - x, dz = goal.z - z, d = hyp(dx, dz); const last = b.i === b.route.length - 1;
    while (!last && d < 1.1 && b.i < b.route.length - 1) { b.i++; goal = b.route[b.i]; dx = goal.x - x; dz = goal.z - z; d = hyp(dx, dz); }
    const end = b.i === b.route.length - 1;
    if (end && d < .2) {                                                                // parked: step off to the left
      const h = m.rotation.y; r.phase = 'dismount'; r.t = 0; b.speed = 0; r.exit.x = x + Math.cos(h) * RIDE.side; r.exit.z = z - Math.sin(h) * RIDE.side; r.from.x = n.mesh.position.x; r.from.z = n.mesh.position.z; return;
    }
    // Heading: turned towards the next point at a limited rate; the bike waits to be roughly aligned before it pulls away.
    const want = Math.atan2(dx, dz), before = m.rotation.y; m.rotation.y = turnTo(before, want, RIDE.turn * dt);
    const err = Math.abs(Math.atan2(Math.sin(want - m.rotation.y), Math.cos(want - m.rotation.y)));
    let target = err > .6 ? 0 : RIDE.speed * (1 - .62 * Math.min(1, err / .8));
    if (!end) { const nx = b.route[b.i + 1], bend = Math.abs(Math.atan2(Math.sin(Math.atan2(nx.x - goal.x, nx.z - goal.z) - want), Math.cos(Math.atan2(nx.x - goal.x, nx.z - goal.z) - want))); if (bend > .5 && d < 7) target = Math.min(target, RIDE.slow + (RIDE.speed - RIDE.slow) * Math.max(0, (d - 1) / 6)); }
    else target = Math.min(target, Math.max(1, d * 1.6));
    // People in the way: you (on foot or in a vehicle), the other villagers and the other bike, within a gap ahead of the nose.
    const sin = Math.sin(m.rotation.y), cos = Math.cos(m.rotation.y), me = w.riding ? w.riding.mesh.position : w.player.position; let near = this.ahead(x, z, sin, cos, me.x, me.z, Infinity);
    for (const o of w.npcs) { if (o === n || o.inside || !o.mesh.visible) continue; near = this.ahead(x, z, sin, cos, o.mesh.position.x, o.mesh.position.z, near); }
    for (const o of this.bikes) if (o !== b && o.phase !== 'parked') near = this.ahead(x, z, sin, cos, o.mesh.position.x, o.mesh.position.z, near);
    if (near < SWEEP) { target = Math.min(target, Math.max(0, (near - 1.4) * 1.5)); if (target < .3) { b.wait += dt; if (b.wait > RIDE.wait) target = RIDE.creep; } } else b.wait = 0;
    b.speed = b.speed < target ? Math.min(target, b.speed + RIDE.accel * dt) : Math.max(target, b.speed - RIDE.brake * dt);
    const step = Math.min(b.speed * dt, d); m.position.x += sin * step; m.position.z += cos * step;
    // A little lean into the turn; the rider sits on the seat at the bike's heading.
    const turned = Math.atan2(Math.sin(m.rotation.y - before), Math.cos(m.rotation.y - before)) / Math.max(dt, 1e-3); m.rotation.z += (-turned * .07 * Math.min(1, b.speed / RIDE.speed) - m.rotation.z) * Math.min(1, dt * 6);
    const seat = b.seatSpot(); b.pose(n.mesh, 1); n.mesh.position.x = seat.x; n.mesh.position.z = seat.z;
  }
  ahead(x, z, sin, cos, ox, oz, near) { const ax = ox - x, az = oz - z, fwd = ax * sin + az * cos; if (fwd < .3 || fwd > SWEEP + 1) return near; return Math.abs(ax * cos - az * sin) < HALF && fwd < near ? fwd : near; }
  finish(n) {
    const r = n.ride, b = r.bike, m = b.mesh, p = n.mesh, ex = r.exit.x, ez = r.exit.z; standPose(p); p.position.set(ex, 0, ez);
    b.at = r.dir === 'out' ? 'bay' : 'home'; b.phase = 'parked'; b.rider = null; m.rotation.z = 0; const spot = b.at === 'home' ? b.def.stand : b.def.bay; b.park(spot, spot.rot);
    n.ride = null; n.noRide = true; n.path = []; n.at = null; n.last = null; this.view.send(n, n.anchor); n.noRide = false;
  }
  /** Shadows follow the villagers' rule (on within SHADOW.on of you, off beyond SHADOW.off) for the bike. */
  light(b) {
    const me = this.view.world.player.position, gap = hyp(b.mesh.position.x - me.x, b.mesh.position.z - me.z), on = b.shadow ? gap < this.shadow.off : gap < this.shadow.on;
    if (on !== b.shadow) { b.shadow = on; b.mesh.traverse(o => { if (o.isMesh) o.castShadow = on; }); }
  }
  /** Each frame: the evening rule (both bikes are home by 22:00 even if their riders strayed). */
  tick(hour) {
    if (hour >= 21.5 || hour < 5) for (const b of this.bikes) if (b.at === 'bay' && b.phase === 'parked') { b.at = 'home'; b.park(b.def.stand, b.def.stand.rot); }
  }
  diagnostics() {
    return this.bikes.map(b => { const n = b.rider, parts = n?.mesh.userData.parts, m = b.mesh;
      return { id: b.def.id, rider: b.def.rider, at: b.at, phase: b.phase, x: m.position.x, z: m.position.z, heading: m.rotation.y, speed: b.speed, rides: this.rides, rideState: n?.ride?.phase ?? '',
        riderY: n ? n.mesh.position.y : 0, riderVisible: n ? n.mesh.visible : false, riderX: n ? n.mesh.position.x : 0, riderZ: n ? n.mesh.position.z : 0, legs: parts ? [parts.leg_l.rotation.x, parts.leg_r.rotation.x, parts.leg_l.rotation.z, parts.leg_r.rotation.z] : [] }; });
  }
}
export const installBikeRiders = (view, hour, shadow) => new BikeRiders(view, hour, shadow);
