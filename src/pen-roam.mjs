// How the pen animals move, after Zoo Garden's farm animals (cute_game src/farm-roam.ts), cut down to Willowmere's
// fenced pen. Pure (no three.js): node runs it for minutes of game time in the tests.
//
// An animal picks a spot it can walk to in a straight line (checked clear once, when it is picked), turns towards it on
// the spot, walks there, then rests a good while: cows and pigs graze head down and shuffle a step now and then; hens
// and the duck peck, sit, take a dust bath or look about. They keep room between them, step away when you walk up to
// them, and never leave the yard: the fence, the coop, the trough, the hay and the egg basket are all kept off.
// What Willowmere decides stays Willowmere's: which animals there are (PEN_ROSTER by pen level) and where you feed
// them and collect (world.mjs targets).
const TAU = Math.PI * 2;
/** The yard inside the fence (world metres; world.mjs builds the fence on these lines) and the gate's opening on the south side. */
export const PEN = { x0: 7.9, x1: 22.9, z0: -23, z1: -14.6, gate: [13, 15.5] };
/** Things standing in the yard, as keep-out circles (world.mjs places them): the coop, the hay bale, the feed trough, the egg basket. */
export const PEN_PROPS = [{ id: 'coop', x: 10.5, z: -20.5, r: 1.75 }, { id: 'hay_bale', x: 21, z: -20.5, r: .95 }, { id: 'feed_trough', x: 17, z: -15.4, r: 1.05 }, { id: 'egg_basket', x: 12, z: -15.6, r: .7 }];
/** Who lives in the pen: shown from pen level `level` on (the same five as before round 7), with a breed coat (pen-view.mjs COATS). */
export const PEN_ROSTER = [{ kind: 'chicken', level: 0, coat: 0 }, { kind: 'chicken', level: 1, coat: 1 }, { kind: 'duck', level: 0, coat: 0 }, { kind: 'cow', level: 2, coat: 0 }, { kind: 'pig', level: 3, coat: 0 }];
export const penShown = (animal, level) => level >= animal.level;
/** Body radius kept off the fence and the props (metres, at the size they are drawn). */
export const roamRadius = w => w.kind === 'cow' ? .85 : w.kind === 'pig' ? .6 : .34;
/** Centre-to-centre room two animals keep. */
export function spacing(a, b) {
  if (a.kind === 'cow' || b.kind === 'cow') return a.kind === b.kind ? 3 : 2;
  return a.kind === 'pig' || b.kind === 'pig' ? 1.6 : 1.3;
}
/** The pen as a place to roam: blocked(x, z, r) is true where a body of radius r would touch the fence or a prop. */
export function penArea(pen = PEN, props = PEN_PROPS) {
  return { pen, props, blocked(x, z, r) {
    if (x < pen.x0 + .3 + r || x > pen.x1 - .3 - r || z < pen.z0 + .3 + r || z > pen.z1 - .3 - r) return true;
    for (let i = 0; i < props.length; i++) { const p = props[i], dx = x - p.x, dz = z - p.z, min = p.r + r; if (dx * dx + dz * dz < min * min) return true; }
    return false;
  } };
}
/** A straight walk is clear when points every 0.3 m along it are (checked once, when a goal is picked). */
export function segmentClear(area, ax, az, bx, bz, r) {
  const d = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(d / .3));
  for (let i = 1; i <= n; i++) if (area.blocked(ax + (bx - ax) * i / n, az + (bz - az) * i / n, r)) return false;
  return true;
}
/** Whether (x, z) keeps its room from every other animal, where it stands and where it is heading. */
export function spotFree(w, x, z, all) {
  for (let i = 0; i < all.length; i++) { const o = all[i]; if (o === w || o.hidden) continue; const need = spacing(w, o); if (Math.hypot(o.x - x, o.z - z) < need || (o.walking && Math.hypot(o.goalX - x, o.goalZ - z) < need)) return false; }
  return true;
}
/** A spot d0..d1 metres from (x, z) the animal can walk to straight; null when a few tries find none. */
export function spotNear(area, rng, w, all, x, z, d0, d1, tries = 10) {
  const r = roamRadius(w);
  for (let i = 0; i < tries; i++) {
    const a = rng() * TAU, d = d0 + rng() * (d1 - d0), gx = x + Math.sin(a) * d, gz = z + Math.cos(a) * d;
    if (area.blocked(gx, gz, r) || !spotFree(w, gx, gz, all) || !segmentClear(area, w.x, w.z, gx, gz, r)) continue;
    return { x: gx, z: gz };
  }
  return null;
}
/** A free place to stand anywhere in the yard. */
export function spawnSpot(area, rng, w, all) {
  const p = area.pen, r = roamRadius(w);
  for (let i = 0; i < 60; i++) { const x = p.x0 + rng() * (p.x1 - p.x0), z = p.z0 + rng() * (p.z1 - p.z0); if (!area.blocked(x, z, r) && (i > 45 || spotFree(w, x, z, all))) return { x, z }; }
  return { x: (p.x0 + p.x1) / 2, z: (p.z0 + p.z1) / 2 };
}
export function newRoamer(uid, kind, at, rng) {
  return { uid, kind, hidden: false, x: at.x, z: at.z, heading: rng() * TAU, goalX: at.x, goalZ: at.z, speed: 0, walking: false, rest: kind === 'cow' || kind === 'pig' ? 'graze' : 'peck', restT: 1 + rng() * 4,
    peck: 0, peckT: 1 + rng() * 3, graze: 0, sit: 0, flap: 0, flee: 0, shuffle: 0, shuffleT: 2 + rng() * 4, walkT: 0, phase: rng() * 6 };
}
/** Starts a rest where the animal stands: what it does and for how long (long rests keep the yard calm). */
export function startRest(w, rng) {
  w.walking = false; const k = rng();
  if (w.kind === 'cow') { w.rest = 'graze'; w.restT = 6 + rng() * 10; }
  else if (w.kind === 'pig') { w.rest = k < .8 ? 'graze' : 'sit'; w.restT = 4 + rng() * 7; }
  else { w.rest = k < .6 ? 'peck' : k < .78 ? 'sit' : k < .9 ? 'dust' : 'look'; w.restT = w.rest === 'peck' ? 2.5 + rng() * 5 : w.rest === 'look' ? 1.5 + rng() * 2 : 7 + rng() * 10; }
}
/** Picks the next walk: mostly a short stroll, now and then across the yard; nothing clear: rest again. */
export function pickGoal(w, all, area, rng) {
  const cow = w.kind === 'cow', far = rng() < .25, g = far ? spotNear(area, rng, w, all, w.x, w.z, 3, 9, 12) ?? spotNear(area, rng, w, all, w.x, w.z, .8, 3) : spotNear(area, rng, w, all, w.x, w.z, cow ? 1.5 : .8, cow ? 4.5 : 3);
  if (!g) { startRest(w, rng); w.restT = Math.min(w.restT, 2); return; }
  walkTo(w, g.x, g.z);
}
export function walkTo(w, x, z) { w.goalX = x; w.goalZ = z; w.walking = true; w.rest = 'none'; w.walkT = 4 + Math.hypot(x - w.x, z - w.z) * (w.kind === 'cow' ? 5 : 3); }
/** Top walking speed (m/s): a cow ambles, a hen trots; twice that when it is making way for you. */
export const topSpeed = w => (w.kind === 'cow' ? .55 : w.kind === 'pig' ? .7 : .95) * (w.flee > 0 ? (w.kind === 'cow' ? 1.8 : 2.3) : 1);
/** One step of one animal: make way for the player, rest, or walk its clear line; keep a little apart from the others. */
export function stepRoamer(w, all, area, rng, dt, player) {
  const cow = w.kind === 'cow', r = roamRadius(w), bird = w.kind === 'chicken' || w.kind === 'duck';
  w.flee = Math.max(0, w.flee - dt);
  if (player && w.flee <= 0) {
    const dx = w.x - player.x, dz = w.z - player.z, d = Math.hypot(dx, dz), shy = cow ? 1.9 : 1.5;
    if (d < shy) {
      const base = d > 1e-3 ? Math.atan2(dx, dz) : rng() * TAU, run = cow ? 1.6 : 2.2;
      for (const turn of [0, .6, -.6, 1.2, -1.2, 1.8, -1.8]) {
        const gx = w.x + Math.sin(base + turn) * run, gz = w.z + Math.cos(base + turn) * run;
        if (!area.blocked(gx, gz, r) && segmentClear(area, w.x, w.z, gx, gz, r)) { walkTo(w, gx, gz); w.walkT = 4; w.flee = cow ? 1.2 : .8; w.peck = 0; w.sit = 0; if (bird) w.flap = 1; break; }
      }
    }
  }
  // The head: grazing holds it down with a chew; pecking is a quick dip now and then. Sitting settles the body.
  const grazing = !w.walking && w.rest === 'graze';
  w.graze += ((grazing ? 1 : 0) - w.graze) * Math.min(1, dt * 2.5);
  w.sit += ((!w.walking && (w.rest === 'sit' || w.rest === 'dust') ? 1 : 0) - w.sit) * Math.min(1, dt * 3);
  w.peckT -= dt; if (w.peckT <= 0) { const pecking = !w.walking && w.rest === 'peck'; w.peckT = pecking ? .5 + rng() * 1.2 : 2 + rng() * 4; w.peck = cow ? 0 : 1; }
  w.peck = Math.max(0, w.peck - dt * 1.6);
  w.flap = Math.max(0, w.flap - dt * 2.5); if (bird && (w.rest === 'dust' && !w.walking ? rng() < dt * .6 : rng() < dt * .04)) w.flap = 1;
  const px = w.x, pz = w.z;
  if (!w.walking) {
    w.restT -= dt;
    if (grazing) { w.shuffleT -= dt; if (w.shuffleT <= 0) { w.shuffleT = 3 + rng() * 4; w.shuffle = 1.2; w.heading += (rng() - .5) * .8; } w.shuffle = Math.max(0, w.shuffle - dt); } else w.shuffle = 0;
    w.speed += ((w.shuffle > 0 ? .12 : 0) - w.speed) * Math.min(1, dt * 4);
    if (w.speed > .01) { w.x += Math.sin(w.heading) * w.speed * dt; w.z += Math.cos(w.heading) * w.speed * dt; }
    if (w.restT <= 0) pickGoal(w, all, area, rng);
  } else {
    const dx = w.goalX - w.x, dz = w.goalZ - w.z, d = Math.hypot(dx, dz);
    let taken = false, ax = 0, az = 0;
    for (let i = 0; i < all.length; i++) {
      const o = all[i]; if (o === w || o.hidden) continue;
      const need = spacing(w, o), ox = w.x - o.x, oz = w.z - o.z, od = Math.hypot(ox, oz), reach = need + .8;
      // Someone settled on the goal meanwhile: stop short. Someone close ahead: steer round (both bear right, so they pass).
      if (w.flee <= 0 && !o.walking && d < need + .5 && Math.hypot(o.x - w.goalX, o.z - w.goalZ) < need) taken = true;
      if (od > 1e-3 && od < reach && ox * dx + oz * dz < 0) { const k = (1 - od / reach) * 1.6 / od, side = o.walking && (o.goalX - o.x) * dx + (o.goalZ - o.z) * dz < 0 ? (w.uid < o.uid ? 1.2 : .8) : .5; ax += ox * k + oz * k * side; az += oz * k - ox * k * side; }
    }
    if (d < (cow ? .35 : .15) || taken || (w.walkT -= dt) <= 0) startRest(w, rng);
    else {
      const want = Math.atan2(dx / d + ax, dz / d + az), turn = Math.atan2(Math.sin(want - w.heading), Math.cos(want - w.heading)), rate = cow ? 1.6 : 4;
      w.heading += Math.max(-rate * dt, Math.min(rate * dt, turn));
      // Turn on the spot first, then slow while still turning: the walk stays on the line that was checked clear.
      w.speed = Math.min(topSpeed(w), w.speed + dt * 2) * (Math.abs(turn) > 1 ? 0 : Math.abs(turn) > .45 ? .3 : 1);
      w.x += Math.sin(w.heading) * w.speed * dt; w.z += Math.cos(w.heading) * w.speed * dt;
    }
  }
  // Personal space: an overlap is pushed out gently (a hen gives way to a cow).
  for (let i = 0; i < all.length; i++) {
    const o = all[i]; if (o === w || o.hidden) continue;
    let dx = w.x - o.x, dz = w.z - o.z, d = Math.hypot(dx, dz); const need = spacing(w, o); if (d >= need) continue;
    if (d < 1e-3) { const a = (w.uid * 2.399) % TAU; dx = Math.sin(a); dz = Math.cos(a); d = 1; }
    const share = w.kind === o.kind ? .5 : cow ? .15 : .85, push = Math.min((need - Math.hypot(w.x - o.x, w.z - o.z)) * share, dt * 3);
    w.x += dx / d * push; w.z += dz / d * push;
  }
  // The yard wins: a move into the fence or a prop is undone and the walk ends (one already standing there may walk out).
  if ((w.x !== px || w.z !== pz) && area.blocked(w.x, w.z, r) && !area.blocked(px, pz, r)) { w.x = px; w.z = pz; w.speed = 0; if (w.walking) { startRest(w, rng); if (!cow) w.restT = Math.min(w.restT, .6 + rng()); } else w.shuffle = 0; }
  // The walk cycle keeps time with the ground covered (cute_game farm-view.ts: 7 rad/s for a cow, 16 for a hen, at full stride).
  w.phase += dt * (cow ? 7 : w.kind === 'pig' ? 10 : 16) * Math.min(1, w.speed / .3);
}
/** Feeding time: everyone shown walks to a free place by the trough and pecks or grazes there a while. */
export function callToTrough(all, area, rng, trough = PEN_PROPS[2]) {
  for (const w of all) {
    if (w.hidden) continue; const r = roamRadius(w);
    for (let i = 0; i < 20; i++) { const a = (rng() - .5) * 2.4, d = trough.r + r + .15 + rng() * 1.3, x = trough.x + Math.sin(a) * d * 1.4, z = trough.z - Math.cos(a) * d; if (!area.blocked(x, z, r) && spotFree(w, x, z, all)) { walkTo(w, x, z); w.walkT = 14; w.flee = 0; break; } }
  }
}
