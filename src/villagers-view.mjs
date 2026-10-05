// The villagers out of doors: they follow their timetable, walk the lanes between buildings on their legs, take little
// strolls so a few are always on the way somewhere, and say hello when they meet (villagers.mjs has the rules).
// World.updateNpcs hands each frame to this view; it moves world.npcs ({p, mesh, target, …}, made by World.buildVillage).
//
//   const view = new VillagersView(world);   view.update(dt, state)      (only while you are in the village and not paused)
//
// Cost per frame: one pass over the 23 villagers (a few comparisons each; hidden ones are skipped), no path search (a
// walk is read off the lane table), a 250-pair distance check four times a second for the hellos, and one DOM bubble
// that is moved only when its place on the screen changes by a pixel.
import './village.css';
import { MARKET, ATELIER, GREEN, POND, HOUSES } from './content.mjs';
import { walkAvatar } from './avatar.mjs';
import { newGait } from './walk-cycle.mjs';
import { installRoomView } from './room-view.mjs';
import { placeOf, slotOf, lanePath, laneDistance, nearestNode, pickTrip, greeting, hello, TRIP, LANES } from './villagers.mjs';
import { hyp } from './hyp.mjs';

/** Metres from you at which a villager's shadow comes on, and the greater distance at which it goes off again. */
export const SHADOW = { on: 30, off: 38 };
// Only the head and the body cast: a villager's arms and legs are 1 m long, and each caster is a draw in the shadow pass (spec 18).
const TORSO = new Set(['head', 'body']);
const turn = (from, to, k) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * k;
const between = ([a, b]) => a + Math.random() * (b - a);
/** What a villager looks at while standing at a place (a point), or null to keep the way they came. */
function lookOf(spot) {
  const key = spot?.key ?? '';
  if (key === 'market') return MARKET; if (key === 'atelier') return ATELIER; if (key === 'green') return GREEN; if (key === 'pond') return POND;
  if (key === 'stall') return { x: ATELIER.x + 3.2, z: ATELIER.z + 6 };                     // Iris faces her customers
  if (key.startsWith('porch:')) { const h = HOUSES[Number(key.slice(6))]; return h ? { x: h.x, z: h.z } : null; }
  return null;
}

export class VillagersView {
  constructor(world) {
    this.world = world; this.bikes = null; this.bikeLoad = null; this.time = 0; this.launch = 2.5; this.meet = 1; this.trips = 0; this.greetings = 0; this.walking = 0;
    this.talk = { who: null, left: 0, next: null, at: -2 };
    const app = document.getElementById('app') ?? document.body;
    this.bubble = document.createElement('div'); this.bubble.id = 'village-bubble'; this.bubble.hidden = true; this.bubble.setAttribute('aria-hidden', 'true'); app.append(this.bubble);
    // Rests are staggered, so the first strolls start one after another soon after you arrive.
    world.npcs.forEach((n, i) => { n.rest = 2 + (i * 7 % 23) * 1.9; n.said = -99; n.pause = 0; n.wave = 0; n.trip = null; n.at = null; n.last = null; n.moving = false; });
    // The bubble is placed after the picture is drawn: only then is the camera where this frame shows it.
    installRoomView(world).onAfter(() => this.placeBubble());
  }
  /** Stands a villager at a spot at once (the first frame, a loaded save). */
  put(n, spot) {
    n.mesh.position.set(spot.x, 0, spot.z); n.path = []; n.goal = spot; n.at = spot; n.last = null; n.inside = !!spot.inside; n.mesh.visible = !n.inside; n.look = lookOf(spot); n.wander = 3 + Math.random() * 4;
  }
  /** Sends a villager walking to a spot along the lanes. From indoors they step out of the door they went in by. */
  send(n, to) {
    if (this.bikes) to = this.bikes.redirect(n, to);                               // a rider whose bike is on this side goes to the bike first
    const at = n.mesh.position;
    if (n.inside) {
      const door = n.at ?? n.goal;
      if (to.inside && door && hyp(to.x - door.x, to.z - door.z) < .6) { n.goal = to; n.at = to; return; }      // the same door: they stay indoors
      n.inside = false; n.mesh.visible = true; if (door) at.set(door.x, 0, door.z);
    }
    // Where the walk joins the lanes: the node of the spot they stand at, or (turned round on the way) the better of the
    // node behind and the node ahead.
    let via = n.at && hyp(at.x - n.at.x, at.z - n.at.z) < 3 ? n.at.via : null;
    if (!via) {
      const goal = to.via ?? nearestNode(to.x, to.z); let best = Infinity;
      for (const node of [n.last, n.path[0]]) { if (!node?.id) continue; const d = hyp(node.x - at.x, node.z - at.z) + laneDistance(node.id, goal); if (d < best) { best = d; via = node.id; } }
    }
    n.goal = to; n.at = null; n.look = lookOf(to); n.wander = 4 + Math.random() * 5;
    n.path = lanePath({ x: at.x, z: at.z, via: via ?? undefined }, to);
  }
  /** True when someone else stands at (or is on the way to) this very spot. */
  taken(spot, self) { for (const n of this.world.npcs) if (n !== self && n.goal && !n.goal.inside && hyp(n.goal.x - spot.x, n.goal.z - spot.z) < .8) return true; return false; }
  say(n, text, next = null) { const t = this.talk; t.who = n; t.left = 2.3; t.next = next; t.at = -2; this.bubble.textContent = text; this.bubble.style.visibility = 'hidden'; this.bubble.hidden = false; }
  hush() { const t = this.talk; t.who = null; t.next = null; if (!this.bubble.hidden) this.bubble.hidden = true; }
  /** Two villagers meet: they stop, turn to each other, one waves and says hello, the other answers. */
  greet(a, b, hour) {
    const [line, reply] = greeting(a.p, b.p, hour), pa = a.mesh.position, pb = b.mesh.position;
    a.said = b.said = this.time; a.pause = b.pause = 3.4; a.face = Math.atan2(pb.x - pa.x, pb.z - pa.z); b.face = a.face + Math.PI; a.wave = 1.3; b.wave = 0;
    this.say(a, line, { who: b, text: reply }); this.greetings++;
  }

  update(dt, s) {
    const w = this.world, hour = s.time, me = w.player.position; this.time += dt;
    if (typeof window !== 'undefined' && window.willowmere && !window.willowmere.villagers) window.willowmere.villagers = () => this.diagnostics();
    if (this.open !== open) { this.open = open; this.dressing = true; }       // the box opened or shut while we looked away: the outfits follow (world.sync normally has done it already)
    if (w.villagersStale) { w.villagersStale = false; this.dressing = true; } // the clothes finished downloading after the first frame
    if (this.dressing) this.dressing = w.dressVillagers((w.step ?? 0) >= 2 ? 1 : 2) > 0; // the governor (step 2 up) slows the swap to one a frame
    let routed = 0, walking = 0;
    // The two neighbours' motorbikes are a lazy chunk (bike-riders.mjs): loaded on the first frame, in place from the next.
    if (!this.bikeLoad) this.bikeLoad = import('./bike-riders.mjs').then(m => { this.bikes = m.installBikeRiders(this, hour, SHADOW); }, e => console.error(e));
    this.bikes?.tick(hour);
    for (const n of w.npcs) {
      const key = slotOf(n.p, s);
      if (key !== n.goalKey && (routed < 2 || !n.goalKey)) {                      // the timetable moved on (two set off in a frame at most)
        const first = !n.goalKey; routed++; n.goalKey = key; n.anchor = placeOf(n.p, key) ?? placeOf(n.p, 'yard');
        if (first) this.put(n, n.anchor); else if (!n.trip && !n.ride?.busy) this.send(n, n.anchor);  // out on a stroll: they go there when the visit ends
      }
      if (n.trip && !n.ride && !n.path.length && n.pause <= 0) {                             // a stroll: arrived, stay a little, then back to where the day wants them
        if (n.trip.stay === undefined) n.trip.stay = between(TRIP.stay);
        else if ((n.trip.stay -= dt) <= 0) { n.trip = null; n.rest = between(TRIP.rest); this.send(n, n.anchor); }
      }
      const t = n.target;
      if (n.inside) { t.x = n.goal.x; t.z = n.goal.z; t.label = `Knock · ${n.p.name} is at ${n.goal.where}`; t.hit.position.set(t.x, 1, t.z); if (!n.trip) n.rest -= dt; n.moving = false; continue; }
      const at = n.mesh.position, busy = n.ride?.busy; let walk = 0;
      // A car or a motorcycle comes by (they are quick now): the villager stops and steps out of its way, off the lane if there is room.
      if (w.riding && !busy) { const ax = at.x - me.x, az = at.z - me.z, gap = hyp(ax, az); if (gap < 4.2 && gap > .01) { const step = Math.min(1, dt * 5), x = at.x + ax / gap * step, z = at.z + az / gap * step; if (!w.blocked(x, z)) { at.x = x; at.z = z; } n.pause = Math.max(n.pause, .7); n.face = Math.atan2(-ax, -az); } }
      if (busy) this.bikes.step(n, dt);                                              // mounting, riding or dismounting: the bike moves them
      else if (n.pause > 0) { n.pause -= dt; n.mesh.rotation.y = turn(n.mesh.rotation.y, n.face, Math.min(1, dt * 8)); }
      else if (n.path.length) {
        let p = n.path[0], dx = p.x - at.x, dz = p.z - at.z, d = hyp(dx, dz);
        while (d < .25 && n.path.length > 1) { n.last = p; n.path.shift(); p = n.path[0]; dx = p.x - at.x; dz = p.z - at.z; d = hyp(dx, dz); }
        if (d < .25) { n.path.length = 0; n.at = n.goal; n.last = null; }                       // there
        else { walk = Math.min(d, dt * (n.p.child ? TRIP.childSpeed : TRIP.speed)); at.x += dx / d * walk; at.z += dz / d * walk; n.mesh.rotation.y = turn(n.mesh.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 10)); walking++; }
      }
      else if (n.goal?.inside && !n.trip) { n.inside = true; n.mesh.visible = false; }           // in through the door
      else {
        if (!n.trip) n.rest -= dt;
        if (n.look) n.mesh.rotation.y = turn(n.mesh.rotation.y, Math.atan2(n.look.x - at.x, n.look.z - at.z), Math.min(1, dt * 3));
        else if (n.goal && (n.wander -= dt) <= 0) {                                                // a few steps about the yard
          n.wander = 5 + Math.random() * 6; const a = Math.random() * Math.PI * 2, r = .5 + Math.random() * .9, x = n.goal.x + Math.cos(a) * r, z = n.goal.z + Math.sin(a) * r;
          if (!w.blocked(x, z)) n.path = [{ x, z }];
        }
      }
      if (n.ride && !busy && !n.path.length && n.at === n.goal && n.goal.key === 'bike') this.bikes.mount(n);   // reached the bike
      n.moving = walk > 0;
      if (n.inside) { t.x = n.goal.x; t.z = n.goal.z; t.label = `Knock · ${n.p.name} is at ${n.goal.where}`; t.hit.position.set(t.x, 1, t.z); continue; }
      t.x = at.x; t.z = at.z; t.label = `Talk to ${n.p.name}`; t.hit.position.set(t.x, 1, t.z);
      if (!busy) { w.animatePerson(n.mesh, .025, w.t * 6 + n.p.index); at.y = walkAvatar(n.mesh, n.gait ??= newGait(), walk, dt); } // a little sway, then the walk over it, feet on the ground
      if (n.wave > 0 && !busy) { const arm = n.mesh.userData.parts.arm_r; n.wave -= dt; n.armZ ??= arm.rotation.z; arm.rotation.x = -2.6; arm.rotation.z = n.wave > 0 ? .4 + Math.sin(this.time * 9) * .4 : n.armZ; }
      // Shadows only near you, switched with a wide margin (on within 30 m, off beyond 38 m) so one never flickers at the line.
      const gap = hyp(at.x - me.x, at.z - me.z), shadow = n.shadow ? gap < SHADOW.off : gap < SHADOW.on; if (shadow !== n.shadow) { n.shadow = shadow; n.mesh.traverse(m => { if (m.isMesh) m.castShadow = shadow && TORSO.has(m.parent?.name); }); }
    }
    this.walking = walking;
    // A stroll starts whenever too few are on the lanes: the villager who has waited longest past their rest goes.
    if ((this.launch -= dt) <= 0) {
      this.launch = TRIP.every;
      // Whenever fewer than TRIP.walkers are walking (the Pandora box makes no difference).
      if (walking < TRIP.walkers) {
        let who = null;
        for (const n of w.npcs) { if (n.trip || n.ride || n.path.length || n.pause > 0 || n.rest > 0 || !n.goalKey || n.goalKey.startsWith('job:') || n.p.child && n.goalKey === 'school') continue; if (!who || n.rest < who.rest) who = n; }
        if (who) {
          const from = who.at ?? who.anchor, key = pickTrip(who.p, s, from), to = key ? placeOf(who.p, key) : null;
          if (to && !this.taken(to, who)) { who.trip = { key }; this.send(who, to); this.trips++; } else who.rest = 6 + Math.random() * 12;
        }
      }
    }
    // Hellos: two villagers who come close (one of them walking), and whoever you walk past.
    const talk = this.talk;
    if (talk.who) { if ((talk.left -= dt) <= 0) { const next = talk.next; if (next && !next.who.inside) this.say(next.who, next.text); else this.hush(); } }
    else if ((this.meet -= dt) <= 0) {
      this.meet = .25; const list = w.npcs, now = this.time;
      meeting: for (let i = 0; i < list.length; i++) {
        const a = list[i]; if (a.inside || now - a.said < 30) continue; const pa = a.mesh.position;
        if (a.moving && !w.riding && now - a.said > 50 && hyp(pa.x - me.x, pa.z - me.z) < 2.1) {          // you walk by
          a.said = now; a.pause = 1.5; a.face = Math.atan2(me.x - pa.x, me.z - pa.z); a.wave = 1.2; this.say(a, hello(a.p, hour)); this.greetings++; break;
        }
        for (let k = i + 1; k < list.length; k++) {
          const b = list[k]; if (b.inside || now - b.said < 30 || !(a.moving || b.moving)) continue; const pb = b.mesh.position;
          if (Math.abs(pa.x - pb.x) < 2.3 && Math.abs(pa.z - pb.z) < 2.3 && hyp(pa.x - pb.x, pa.z - pb.z) < 2.3) { if (a.moving) this.greet(a, b, hour); else this.greet(b, a, hour); break meeting; }
        }
      }
    }
  }
  /** Moves the bubble over the speaker's head (only when it moved a whole pixel); hides it off the screen and indoors. */
  placeBubble() {
    const talk = this.talk, w = this.world; if (!talk.who) return;
    if (w.location !== 'village' || talk.who.inside) { this.hush(); return; }
    const at = talk.who.mesh.position, p = w.project(at.x, at.z, at.y + (talk.who.p.child ? 1.75 : 2.35)), x = Math.round(p.x), y = Math.round(p.y);
    const spot = x < 70 || x > innerWidth - 70 || y < 96 || y > innerHeight - 40 ? -1 : x * 8192 + y;
    if (spot !== talk.at) { talk.at = spot; this.bubble.style.visibility = spot < 0 ? 'hidden' : ''; if (spot >= 0) this.bubble.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`; }
  }
  /** Read-only numbers for tests and checks (window.willowmere.villagers()). */
  diagnostics() {
    const w = this.world;
    return { walking: this.walking, trips: this.trips, greetings: this.greetings, saying: this.talk.who ? this.bubble.textContent : '', lanes: LANES.ids.length,
      npcs: w.npcs.map(n => ({ id: n.p.id, x: n.mesh.position.x, z: n.mesh.position.z, inside: !!n.inside, moving: !!n.moving, place: n.goal?.key ?? '', where: n.goalKey, trip: n.trip?.key ?? '', stuck: !n.inside && w.blocked(n.mesh.position.x, n.mesh.position.z) })) };
  }
}
