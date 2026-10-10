// The hero's skill poses (fetched with the box). One layer that writes the avatar's body over the walk cycle while a skill is on, after
// Zoo Garden (cute_game flight-pose.ts superheroFlightPose, world.ts animatePlayer: dash, giant, bat form): a flier is horizontal with
// a fist out and its legs together, never walking in the air. Pure: no three.js, no DOM; `hero` is an avatar (position, rotation, scale,
// userData.parts {head, arm_l, arm_r, leg_l, leg_r}) and every number it writes is absolute, so the order of the frame cannot add up.
//
// The contract with the rest of the game:
//   * World.frame writes the limbs' x rotation and the ground height every frame it runs; poseStep() runs after it (room.onFrame, before
//     the picture) and overwrites. What the world never rewrites (the body's pitch and bank, its rotation order, the scale, the head, a
//     limb's splay) is put back by release(), exactly, the moment no pose is on or the hero may not be posed (indoors, riding, knocked out).
//   * The height is one number: FLIGHT.height (Zoo's 1.7 m) eased by `fly`; nothing else lifts the hero for a kit skill.
const TAU = Math.PI * 2;
/** Flying: metres up, the glide's pitch and the hover's lean (radians, Zoo's 1.2 and 0.18), the ease up and down (1/s), the bob and the most bank. */
export const FLIGHT = { height: 1.7, pitch: 1.2, hover: .18, up: 5, down: 7, bob: .08, bank: .35 };
/** Meteor dive: seconds to the crater (the damage lands at 0.18 s), the leap of a dive from the ground, the nose-down pitch, the squash on landing. */
export const DIVE = { time: .18, hop: 1.4, pitch: 1.9, land: .25 };
/** Giant form: twice the size (Zoo's visualScale). */
export const GIANT = 2;
/** A cast's pose and how long it is held (seconds): what the arms, the head and the body do for each kit skill. */
export const CAST = {
  sweep: ['gaze', 1.35], boulder: ['throw', .75], shield: ['guard', .7], energyshield: ['guard', .7], heal: ['up', .7], stealth: ['sign', .5], bats: ['sign', .35],
  teleport: ['sign', .3], backstab: ['chop', .35], giant: ['flex', .8], tank: ['flex', .5], tail: ['turn', .4], devour: ['lunge', .4], smoke: ['place', .45],
  roar: ['roar', .8], taunt: ['roar', .7], breath: ['roar', .6], sheep: ['point', .5], charm: ['point', .5], blackhole: ['point', .6], parrot: ['point', .5],
  cannons: ['point', .6], missiles: ['both', .9], hook: ['point', .45], drain: ['both', 2.3], holy: ['up', .8], roots: ['place', .5], bloodnova: ['up', .8],
  snowball: ['bowl', .5], clones: ['sign', .5], batcircle: ['up', .5], turret: ['place', .5], cannon: ['place', .5], decoy: ['place', .5], icefloor: ['place', .5],
  iceage: ['up', .7], fireball: ['gather', 1], silk: ['chop', .45], flight: ['', 0], hover: ['', 0], charge: ['', 0],
};
export const newPose = () => ({ who: null, on: false, fly: 0, move: 0, bank: 0, big: 1, gone: 0, s0: 1, gy: 0, wy: NaN, armL: 0, armR: 0, hx: 0, hy: 0, hz: 0, lx: 0, lz: 0, yaw: 0, cast: '', ct: 0, cd: 0, turn: 0, aim: 0, dive: 0, dh: 0, land: 0, h: 0 });
const mix = (a, b, k) => a + (b - a) * k, smooth = k => k * k * (3 - 2 * k), clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
const set = (part, x, z) => { if (part) { part.rotation.x = x; part.rotation.z = z; } };
const rest = (z, side) => Math.abs(z) < .6 ? z : side * .16;
function calm(P) { P.fly = P.move = P.bank = P.gone = P.dive = P.land = P.h = P.aim = 0; P.big = 1; P.cast = ''; }

/**
 * A kit skill has just been cast: starts its pose. True when this layer poses the cast (the caller then skips its own spin or swing).
 * A dive starts from where the flier is (or from a leap), falls to the ground in DIVE.time and lands in a squash.
 */
export function castPose(P, op) {
  const row = CAST[op]; if (op === 'dive') { P.dh = Math.max(DIVE.hop, FLIGHT.height * smooth(P.fly)); P.fly = 0; P.dive = DIVE.time; P.land = 0; P.cast = ''; P.aim = .4; return true; }
  if (!row) return false;
  endTurn(P); P.cast = row[0]; P.ct = 0; P.cd = row[1]; P.turn = 0; P.aim = .4; return true;
}
/** A tail sweep is one whole turn: whatever is left of it is given at once, so the hero faces where it did. */
function endTurn(P) { if (P.cast === 'turn' && P.who) P.who.rotation.y += TAU - P.turn; }
/** Everything the layer wrote, undone: straight legs, arms at rest, head as it was, the body upright at its own size on the ground. */
export function release(P, hero, keepBody = false) {
  const p = hero.userData.parts, r = hero.rotation; endTurn(P);
  if (p.head) { p.head.rotation.x = P.hx; p.head.rotation.y = P.hy; p.head.rotation.z = P.hz; }
  hero.scale.x = hero.scale.y = hero.scale.z = P.s0;
  // On a seat the rider's pose is drive-view's (seatPose, written every frame): only the size and the head are ours to give back.
  if (!keepBody) { set(p.leg_l, 0, 0); set(p.leg_r, 0, 0); set(p.arm_l, 0, P.armL); set(p.arm_r, 0, P.armR); r.order = 'XYZ'; r.x = 0; r.z = 0; hero.position.y = P.gy; }
  P.on = false; P.wy = NaN; calm(P);
}
/**
 * One frame. `d` is Combat's kit statuses ({flight, giant, tank, bats}: seconds left) or null, `mode` Combat's mode ('dash' while a
 * dash or a charge runs), `ok` whether the hero may be posed at all (out of doors, on foot, the box open), `keepBody` that a seat
 * owns the body, `glide` that this disguise flies level when it moves (the superhero; the fairy floats upright). Returns the height
 * in metres the hero is lifted to (for the shadow under it).
 */
export function poseStep(P, hero, d, mode, ok, keepBody, glide, dt, time) {
  const parts = hero.userData.parts; if (!parts?.leg_l) return 0;
  const pos = hero.position, rot = hero.rotation;
  if (P.who !== hero) { P.who = hero; P.on = false; calm(P); P.wy = NaN; P.lx = pos.x; P.lz = pos.z; P.yaw = rot.y; }
  if (!ok) { if (P.on) release(P, hero, keepBody); else calm(P); P.lx = pos.x; P.lz = pos.z; P.yaw = rot.y; return 0; }
  const flying = !!d && d.flight > 0, giant = !!d && d.giant > 0, tank = !!d && d.tank > 0, bats = !!d && d.bats > 0, dash = mode === 'dash';
  P.fly += ((flying ? 1 : 0) - P.fly) * (1 - Math.exp(-dt * (flying ? FLIGHT.up : FLIGHT.down))); if (!flying && P.fly < .004) P.fly = 0;
  P.big += ((giant ? GIANT : 1) - P.big) * (1 - Math.exp(-dt * 6)); if (!giant && P.big < 1.004) P.big = 1;
  P.gone += ((bats ? 1 : 0) - P.gone) * (1 - Math.exp(-dt * 16)); if (!bats && P.gone < .004) P.gone = 0;
  if (P.cast) { P.ct += dt; if (P.ct >= P.cd) { endTurn(P); P.cast = ''; } }
  if (P.dive > 0) { P.dive -= dt; if (P.dive <= 0) { P.dive = 0; P.land = DIVE.land; } } else if (P.land > 0) P.land = Math.max(0, P.land - dt);
  if (P.aim > 0) P.aim = Math.max(0, P.aim - dt);
  // How it moves: the speed over the ground (a blink is not a walk) and the turn, for the glide and its bank.
  const dx0 = pos.x - P.lx, dz0 = pos.z - P.lz, speed = dt > 0 ? Math.sqrt(dx0 * dx0 + dz0 * dz0) / dt : 0, k6 = 1 - Math.exp(-dt * 6); P.lx = pos.x; P.lz = pos.z;
  P.move += ((speed > .6 && speed < 40 ? 1 : 0) - P.move) * k6;
  const turned = Math.atan2(Math.sin(rot.y - P.yaw), Math.cos(rot.y - P.yaw)); P.yaw = rot.y;
  P.bank += (clamp(dt > 0 && P.cast !== 'turn' ? -turned / dt * .1 : 0, -FLIGHT.bank, FLIGHT.bank) - P.bank) * k6;
  const active = P.fly > 0 || P.big > 1 || P.gone > 0 || !!P.cast || dash || tank || P.dive > 0 || P.land > 0 || P.aim > 0;
  if (!active) { if (P.on) release(P, hero, false); P.h = 0; return 0; }
  const L = parts.arm_l, R = parts.arm_r, ll = parts.leg_l, lr = parts.leg_r, head = parts.head;
  if (!P.on) { P.on = true; P.armL = rest(L.rotation.z, -1); P.armR = rest(R.rotation.z, 1); if (head) { P.hx = head.rotation.x; P.hy = head.rotation.y; P.hz = head.rotation.z; } P.s0 = hero.scale.x; P.wy = NaN; }
  // The ground height is the world's: taken whenever the world has rewritten it since our last write, kept while the world stands still.
  if (pos.y !== P.wy) P.gy = pos.y;
  let lean = 0, roll = 0, y = 0, sx = 1, sy = 1, sz = 1, hx = P.hx, hy = P.hy;
  // The limbs start from what the walk gave them; the caller's half-second aim at a cast is taken off the right arm (the walk swings the arms as a mirror pair).
  let ax = L.rotation.x, az = P.armL, bx = P.aim > 0 ? -ax : R.rotation.x, bz = P.armR, cx = ll.rotation.x, cz = 0, ex = lr.rotation.x, ez = 0;
  if (P.cast) {
    const t = P.ct / P.cd, e = clamp(Math.min(P.ct / .1, (P.cd - P.ct) / .16), 0, 1);
    switch (P.cast) {
      case 'up': ax = mix(ax, -2.7, e); bx = mix(bx, -2.7, e); az = mix(az, -.3, e); bz = mix(bz, .3, e); lean -= .12 * e; hx -= .25 * e; break;
      case 'guard': ax = mix(ax, -1.45, e); bx = mix(bx, -1.45, e); az = mix(az, .55, e); bz = mix(bz, -.55, e); lean += .1 * e; break;
      case 'sign': ax = mix(ax, -1.2, e); bx = mix(bx, -1.2, e); az = mix(az, .6, e); bz = mix(bz, -.6, e); hx += .15 * e; break;
      case 'place': ax = mix(ax, -.8, e); bx = mix(bx, -.8, e); lean += .45 * e; break;
      case 'point': ax = mix(ax, -.5, e); bx = mix(bx, -1.55, e); lean += .08 * e; break;
      case 'both': ax = mix(ax, -1.5, e); bx = mix(bx, -1.5, e); lean += .1 * e; break;
      case 'throw': { const u = clamp((t - .6) / .4, 0, 1), a = mix(-2.9, -.9, u) * e; ax = mix(ax, a, e); bx = mix(bx, a, e); lean += (t < .6 ? -.25 * e : .35 * Math.sin(u * Math.PI)); break; }
      case 'gather': { const out = t < .78; ax = mix(ax, out ? -2.6 : -1.5, e); bx = mix(bx, out ? -2.6 : -1.5, e); az = mix(az, out ? -.7 : 0, e); bz = mix(bz, out ? .7 : 0, e); lean += (out ? -.15 : .3) * e; break; }
      case 'chop': bx = mix(-2.7, .2, clamp(t * 1.6, 0, 1)); lean += .22 * e; break;
      case 'flex': { const p = 1 + .06 * Math.sin(t * Math.PI); ax = mix(ax, -1, e); bx = mix(bx, -1, e); az = mix(az, -1.2, e); bz = mix(bz, 1.2, e); hx -= .3 * e; sx *= p; sy *= p; sz *= p; break; }
      case 'roar': ax = mix(ax, .7, e); bx = mix(bx, .7, e); az = mix(az, -.6, e); bz = mix(bz, .6, e); lean += .32 * e; hx -= .4 * e; break;
      case 'lunge': ax = mix(ax, -1.4, e); bx = mix(bx, -1.4, e); lean += .55 * e; hx += .15 * e; break;
      case 'turn': { const a = smooth(clamp(t, 0, 1)) * TAU; rot.y += a - P.turn; P.yaw = rot.y; P.turn = a; az = mix(az, -1, e); bz = mix(bz, 1, e); lean += .2 * e; break; }
      case 'bowl': bx = mix(1, -1.4, clamp(t * 1.4, 0, 1)); lean += .45 * e; break;
      case 'gaze': hy += (-.6 + 1.2 * clamp(P.ct / 1.2, 0, 1)) * e; hx -= .06 * e; break;
    }
  }
  // Zoo's dash: a deep lean, arms swept back, one leg ahead, off the ground a little. A robot on its treads keeps its legs still.
  if (dash) { lean = .55; ax = bx = 1.2; cx = .8; ex = -.4; y += .15; }
  if (tank) { cx = ex = 0; ax = Math.min(ax, -.35); bx = Math.min(bx, -.35); }
  if (P.fly > 0) {
    // Legs stop walking almost at once and trail together; the right fist leads a glide, the left arm lies along the body; a hover holds both a little out.
    const k = smooth(P.fly), kl = Math.min(1, P.fly * 5), m = glide ? smooth(clamp(P.move, 0, 1)) : 0;
    cx = mix(cx, .08, kl); ex = mix(ex, .08, kl); cz = -.06 * kl; ez = .06 * kl;
    if (!P.cast) { ax = mix(ax, mix(-.35, .12, m), k); az = mix(az, mix(-.55, -.1, m), k); bx = mix(bx, mix(-.35, -2.95, m), k); bz = mix(bz, mix(.55, .12, m), k); hx += mix(-.12, -1.05, m) * k; }
    lean += mix(FLIGHT.hover, FLIGHT.pitch, m) * k; roll = P.bank * k * m;
    y += (FLIGHT.height + Math.sin(time * 3) * FLIGHT.bob) * k;
  }
  if (P.dive > 0) { const t = 1 - P.dive / DIVE.time; y = P.dh * (1 - t * t); lean = DIVE.pitch; roll = 0; ax = bx = -2.95; az = -.1; bz = .1; cx = ex = .08; hx = P.hx - 1; }
  else if (P.land > 0) { const e = Math.sin((1 - P.land / DIVE.land) * Math.PI); sx *= 1 + .18 * e; sz *= 1 + .18 * e; sy *= 1 - .22 * e; ax = mix(ax, -.9, e); bx = mix(bx, -.9, e); lean += .3 * e; }
  set(L, ax, az); set(R, bx, bz); set(ll, cx, cz); set(lr, ex, ez);
  if (head) { head.rotation.x = hx; head.rotation.y = hy; }
  // Pitch about the hero's own right axis (YXZ), so a glide to the east leans forward too.
  rot.order = 'YXZ'; rot.x = lean; rot.z = roll;
  const s = P.s0 * P.big * (1 - .999 * smooth(P.gone)); hero.scale.x = s * sx; hero.scale.y = s * sy; hero.scale.z = s * sz;
  pos.y = P.wy = P.gy + y; P.h = y;
  return y;
}
