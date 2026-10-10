// The disguise kits at work (fetched with the box). Zoo Garden's CombatSimulation.disguise() on Combat: a worn disguise replaces all four
// skills (disguise-kits.mjs). Pure like skills-special.mjs, no three.js and no DOM; looks are asked through host.effect('look', ...).
// Everything lives in fixed pools made on the first cast (64 timed jobs, 12 summons); a creature's status is a number on the creature
// (fear, blind, sheep, charm, taunt, mark: seconds left), so a fight makes no garbage. Hits go through Combat.damage -> host.hit, so a boss
// or a titan is only slowed by any status and lift is scaled as everywhere else. Creatures only: nothing here can reach the village ward.
// Round "disguise-fx": Zoo's numbers (DZ, SUMMON_HP, DECOY below are cute_game combat.ts's), its hittable summons that creatures attack
// (hook(): the creatures' own AI is given the summon as its target, so no creature code changed), the scouting parrot, the binding
// tree, the sheep that keeps walking, the vanish that creatures really lose, and the six uniform kits Zoo has now.
import { Combat, distanceToSegment } from './combat.mjs';
import { KITS, kitInfo, KIT_WEAPON } from './disguise-kits.mjs';

const TAU = Math.PI * 2, JOBS = 64, ALLIES = 12, STATES = ['fear', 'blind', 'charm', 'taunt'];
const STLOOK = { fear: 'st_fear', blind: 'st_blind', charm: 'st_charm', taunt: 'st_taunt' };
/** Zoo combat.ts DZ (metres, seconds, damage factors) for the skills this round ported; the other kits keep the numbers of the first port. */
export const DZ = {
  clones: { count: 4, life: 8, power: .5, cd: .45, reach: 1.4, ring: 1.6 }, stealth: { time: 5 }, sheep: { range: 12, around: 3, count: 3, time: 6 },
  block: { time: 4, reflect: 1.5 }, fireball: { charge: .8, range: 14, fallback: 9, flight: .35, radius: 5, power: 3.5 },
  turret: { life: 12, power: .55, cd: .35, range: 11 }, cannon: { life: 10, power: 1.4, cd: 1.3, range: 12 }, tree: { ahead: 3, life: 6, root: 4, radius: 5, power: .8, cd: 1 },
  parrot: { life: 8, power: .4, cd: .6, reach: 1.4, speed: 7, mark: 8 }, decoy: { ahead: 2.5, life: 6, radius: 4, power: 2.5, freeze: 2 },
  giant: { defence: 20 }, tank: { defence: 30 }, taunt: { defence: 80 },
  popgun: { count: 5, spread: .4, power: 1.2, range: 12 }, sandbag: { time: 6, radius: 2.6, defence: 60, power: .5, knock: 4 }, flare: { range: 12, fallback: 6, delay: .5, radius: 5, blind: 4, mark: 6 },
  airdrop: { range: 14, fallback: 7, count: 5, ring: 2.6, fall: 1.2, spacing: .2, radius: 2.2, power: 2, heal: .15 },
  surfride: { speed: 26, time: .35, power: 1.4 }, whistle: { radius: 8, stun: 2.5 }, lighthouse: { life: 6, turn: Math.PI, reach: 12, width: .3, power: 1.2, blind: 1.5, rehit: .6 },
  ribbon: { speed: 24, time: .35, boost: .3, boostTime: 3 }, fan: { radius: 7, cone: .64, power: 1.2, knock: 5, slow: 3 }, lanterns: { count: 8, ring: 4, rise: 1, spacing: .18, radius: 2.4, power: 1.6, heal: .02 },
  kite: { time: 5, speed: .3 }, ink: { radius: 5, stun: 3, power: .8 }, dragondance: { time: 5, tick: .5, radius: 4.2, power: .7 },
  starshield: { time: 3, radius: 3, power: 1, knock: 4 }, torch: { time: 6, bonus: .3, heal: .1, radius: 6, blind: 2 }, fireworks: { count: 10, range: 14, fallback: 7, spacing: .15, rise: .6, radius: 2.2, power: 1.5 },
  bamboo: { speed: 16, time: .5, radius: 3, power: 1.4, knock: 2 }, drum: { beats: 3, gap: .35, radius: 7, power: .6, knock: 2.5, stun: 1.5 }, bigstar: { range: 14, fallback: 6, delay: .7, radius: 5, power: 4, lift: 1.25, slow: 3 },
};
/** Summons creatures can fight: hit points as a share of your full health, body radius, and whether it draws creatures to it (Zoo SUMMON_HP). */
export const SUMMON_HP = { clone: { hp: .25, r: .45, taunt: true }, snow: { hp: .6, r: .7, taunt: true }, tree: { hp: .8, r: .8 }, cannon: { hp: .5, r: .7 }, turret: { hp: .45, r: .6 }, sandbag: { hp: .9, r: .5 } };
/** Clones stay within `range` m of you; a creature within `lure` m of a decoy goes for it before you (Zoo DECOY). */
export const DECOY = { range: 6, lure: 8 };
const len = (x, z) => Math.sqrt(x * x + z * z);
const alive = e => e.hp > 0 && !(e.leaving > 0);
const big = e => !!(e.def?.boss || e.titan || e.def?.behavior === 'titan');
let baseSkill, baseDamage, baseReset, baseTick, baseShoot;

function ensure(c) {
  if (c.dj) return;
  c.dj = Array.from({ length: JOBS }, () => ({ live: false, at: 0, op: '', n: 0, every: 0, x: 0, z: 0, a: 0, b: 0, s: 0, l: 0, k: '', t: null, kn: 1.2, c: '' }));
  c.al = Array.from({ length: ALLIES }, () => ({ live: false, kind: '', x: 0, z: 0, life: 0, cd: 0, orbit: 0, f: 0, born: 0, hp: 0, maxHp: 0, hurt: 0, ring: 0 }));
  c.d = { flight: 0, shield: 0, stealth: 0, bats: 0, giant: 0, armor: 0, lifesteal: 0, tank: 0, invuln: 0, block: 0, cover: 0, rally: 0, gaze: 0, swift: 0 };
  c.dany = 0; c.hv = 0; c.hvOn = false; c.gstep = 0; c.lx = 0; c.lz = 0; c.cx = 0; c.cz = 0; c.ga = 0; c.ll = 0; c.lc = ''; c.sw = 0;
}
function job(c, delay, op, x, z, a, b, s, l, k, t, n = 1, every = 0, kn = 1.2, color = '') {
  let j = null; for (let i = 0; i < JOBS; i++) if (!c.dj[i].live) { j = c.dj[i]; break; }
  if (!j) { j = c.dj[0]; for (let i = 1; i < JOBS; i++) if (c.dj[i].at < j.at) j = c.dj[i]; }
  j.live = true; j.at = c.time + delay; j.op = op; j.x = x; j.z = z; j.a = a; j.b = b; j.s = s; j.l = l; j.k = k; j.t = t ?? null; j.n = n; j.every = every; j.kn = kn; j.c = color;
}
/** A look: Zoo's (zoo-looks.mjs through skill-looks.mjs) with its own lifetime and colour, read from c.ll / c.lc by the effects. */
function look(c, x, z, r, f, id, life = 0, color = '') { c.ll = life; c.lc = color; c.host.effect('look', x, z, r, f, id); c.ll = 0; c.lc = ''; }
function area(c, x, z, r, power, stun, lift, id, knock = 1.2, color = '', life = 0) {
  if (id) look(c, x, z, r, c.host.facing(), id, life, color);
  const list = c.host.targets();
  for (let i = 0; i < list.length; i++) { const e = list[i]; if (alive(e) && len(e.x - x, e.z - z) <= r + e.radius) c.damage(e, power, stun, lift, knock); }
}
/** A status on a creature: a boss or a titan is only slowed. */
function status(c, e, kind, secs) {
  if (big(e)) { e.slow = Math.max(e.slow || 0, Math.min(secs, 3)); return; }
  if (kind === 'slow') { e.slow = Math.max(e.slow || 0, secs); return; }
  if (kind === 'stun') { e.stun = Math.max(e.stun || 0, secs); return; }
  e[kind] = Math.max(e[kind] || 0, secs); c.dany = Math.max(c.dany, c.time + secs + 1);
}
/** Every creature within r of a spot: a status for `secs`, and a mark (+50 % damage taken) for `mark` seconds. */
function within(c, x, z, r, kind, secs, mark = 0) {
  const list = c.host.targets();
  for (let i = 0; i < list.length; i++) {
    const e = list[i]; if (!alive(e) || len(e.x - x, e.z - z) > r + e.radius) continue;
    if (kind) status(c, e, kind, secs);
    if (mark) { e.mark = Math.max(e.mark || 0, mark); c.dany = Math.max(c.dany, c.time + mark + 1); c.host.effect('impact', e.x, e.z, 1, 0, 0); }
  }
}
/** A summon; a hittable kind (SUMMON_HP) gets its hit points from your full health. */
function ally(c, kind, x, z, life, cd, orbit, f) {
  let a = null; for (let i = 0; i < ALLIES; i++) if (!c.al[i].live) { a = c.al[i]; break; }
  if (!a) { a = c.al[0]; for (let i = 1; i < ALLIES; i++) if (c.al[i].life < a.life) a = c.al[i]; }
  const s = SUMMON_HP[kind];
  a.live = true; a.kind = kind; a.x = x; a.z = z; a.life = life; a.cd = cd; a.orbit = orbit; a.born = c.time; a.f = f ?? c.host.facing(); a.hurt = 0; a.ring = kind === 'sandbag' ? DZ.sandbag.radius : 0;
  a.maxHp = a.hp = s ? Math.max(1, Math.round((c.host.stats().maxHp ?? 100) * s.hp)) : 0;
  return a;
}
/** A summon is gone (destroyed or out of time): clones vanish in a puff, the snow decoy bursts and freezes, a wall falls (Zoo ended()). */
function pop(c, a) {
  if (!a.live) return; a.live = false;
  if (a.kind === 'clone') look(c, a.x, a.z, 1.2, 0, 'poof', .6, '#b9a6e8');
  else if (a.kind === 'snow') { area(c, a.x, a.z, DZ.decoy.radius, DZ.decoy.power, 0, 0, 'iceage', 2, '#e4f9ff'); within(c, a.x, a.z, DZ.decoy.radius, 'stun', DZ.decoy.freeze); }
  else if (a.kind === 'sandbag') { c.d.cover = 0; look(c, a.x, a.z, a.ring || 2.6, 0, 'dust', .8, '#d8c59a'); }
  else if (a.kind === 'tree' || a.kind === 'cannon' || a.kind === 'turret') look(c, a.x, a.z, 1.4, 0, 'dust', .7, '#d8c59a');
}
function popKind(c, kind) { for (let i = 0; i < ALLIES; i++) if (c.al[i].live && c.al[i].kind === kind) pop(c, c.al[i]); }
/** A creature's blow, shot or area reached a summon: it loses hit points and pops at 0 (Zoo hurtAlly). */
function hurtAlly(c, a, amount) { if (!a.live || !(a.hp > 0) || !(amount > 0)) return; a.hp = Math.max(0, a.hp - amount); a.hurt = .25; c.host.effect('impact', a.x, a.z, .5, 0, 0); if (a.hp <= 0) pop(c, a); }
function shotAt(c, x, z, angle, power, range, kind, o) {
  const s = c.shoot(angle, power, range, kind); s.x = x + Math.sin(angle) * .6; s.z = z + Math.cos(angle) * .6; s.speed = o?.speed ?? 0; s.radius = o?.radius ?? 0; s.lift = 0; s.pierce = !!o?.pierce; s.stun = o?.stun ?? 0; s.blast = o?.blast ?? 0; s.grow = 0; s.home = o?.home ?? null; return s;
}
/** The nearest creature to a spot; `home`: only those a clone may reach without leaving your side. */
function nearestTo(c, x, z, range, home) {
  let best = null, bd = Infinity; const list = c.host.targets(), p = home ? c.host.position() : null;
  for (let i = 0; i < list.length; i++) {
    const e = list[i]; if (!alive(e)) continue; if (p && len(e.x - p.x, e.z - p.z) > DECOY.range + DZ.clones.reach + e.radius) continue;
    const d = len(e.x - x, e.z - z); if (d <= range + e.radius && d < bd) { bd = d; best = e; }
  }
  return best;
}
function push(e, x, z, speed) { const d = len(x, z) || 1; e.kx = (e.kx || 0) + x / d * speed; e.kz = (e.kz || 0) + z / d * speed; }
function heal(c, f) { c.host.heal?.(f); }
/** Faster on your feet for a while (Zoo haste(): flight, vanish, tank mode, bat form, the ice rink, the ribbon, the kite). */
function haste(c, amount, time) { c.sw = c.d.swift > 0 ? Math.max(c.sw, amount) : amount; c.d.swift = Math.max(c.d.swift, time); }
/** The nearest creature's spot within `range`, else `fallback` m straight ahead (Zoo spot()). */
const SPOT = { x: 0, z: 0 };
function spot(c, range, fallback, dx, dz) { const t = c.nearest(range), p = c.host.position(); SPOT.x = t ? t.x : p.x + dx * fallback; SPOT.z = t ? t.z : p.z + dz * fallback; return SPOT; }
/** A rush that strikes nobody on the way (ribbon glide, bamboo vault). */
function glide(c, speed, time, angle) { c.rush(0, speed, time, angle, ''); c.dashing.width = -99; }

function run(c, j) {
  const p = c.host.position();
  switch (j.op) {
    case 'area': area(c, j.x, j.z, j.a, j.b, j.s, j.l, j.k, j.kn, j.c); break;
    case 'puls': area(c, p.x, p.z, j.a, j.b, j.s, j.l, j.k, j.kn, j.c); break;
    case 'look': look(c, j.x, j.z, j.a, j.b, j.k, j.s, j.c); break;
    case 'lookme': look(c, p.x, p.z, j.a, j.b, j.k, j.s, j.c); break;
    case 'status': within(c, j.x, j.z, j.a, j.k, j.b, j.l); break;
    case 'gain': heal(c, j.a); break;
    case 'heal': if (len(p.x - j.x, p.z - j.z) < 4) heal(c, .03); break;
    case 'smoke': { const list = c.host.targets(); for (let i = 0; i < list.length; i++) { const e = list[i]; if (alive(e) && len(e.x - j.x, e.z - j.z) < 5 + e.radius) status(c, e, 'blind', 1.2); } if (len(p.x - j.x, p.z - j.z) < 5) c.d.stealth = Math.max(c.d.stealth, .6); break; }
    case 'drain': { const e = j.t; if (!alive(e)) break; look(c, p.x, p.z, len(e.x - p.x, e.z - p.z), Math.atan2(e.x - p.x, e.z - p.z), 'drain', .35, '#ea7a9c'); c.damage(e, .7); heal(c, .035); break; }
    case 'moon': area(c, p.x, p.z, 7, .3, 0, 0, null); break;
    case 'hole': { const list = c.host.targets(); for (let i = 0; i < list.length; i++) { const e = list[i]; if (alive(e) && !big(e) && len(e.x - j.x, e.z - j.z) < 8) push(e, j.x - e.x, j.z - e.z, 7); } area(c, j.x, j.z, 5, .4, 1, 0, null); break; }
    case 'rink': { const list = c.host.targets(); for (let i = 0; i < list.length; i++) { const e = list[i]; if (alive(e) && len(e.x - j.x, e.z - j.z) < 6 + e.radius) e.slow = Math.max(e.slow || 0, 1); } if (len(p.x - j.x, p.z - j.z) < 6) haste(c, .5, .6); break; }
    case 'tank': area(c, p.x, p.z, 2, 1, .3, 1, 'shock'); break;
    case 'fireball': {
      const K = DZ.fireball, t = c.nearest(K.range), tx = t ? t.x : p.x + Math.sin(j.a) * K.fallback, tz = t ? t.z : p.z + Math.cos(j.a) * K.fallback, gap = Math.max(.5, len(tx - p.x, tz - p.z));
      shotAt(c, p.x, p.z, Math.atan2(tx - p.x, tz - p.z), K.power, gap + 1, 'fireball', { speed: Math.max(12, gap / K.flight), radius: .6, blast: K.radius, stun: 2, home: t }); break;
    }
    case 'rocket': { const e = j.t; if (!alive(e)) break; shotAt(c, p.x, p.z, Math.atan2(e.x - p.x, e.z - p.z), 2, 18, j.k, { speed: 18, blast: 2, home: e }); break; }
    case 'pull': { const e = j.t; if (!alive(e)) break; push(e, p.x - e.x, p.z - e.z, len(p.x - e.x, p.z - e.z) * 6); c.damage(e, 1.5, 2); break; }
  }
  if (j.n > 1) { j.n--; j.at += j.every; j.live = true; } else j.live = false;
}

/** Casts skill `index` of the kit `id`: true when it went off (cooldown set by the caller). */
function cast(c, id, index, info) {
  ensure(c);
  const p = c.host.position(), x = p.x, z = p.z, ang = c.aim(), dx = Math.sin(ang), dz = Math.cos(ang), d = c.d, op = info.op, K = DZ;
  if (info.sp) { const c3 = c.cooldowns[3], s3 = c.spans[3]; c.special(info.sp); c.cooldowns[3] = c3; c.spans[3] = s3; return true; }
  switch (op) {
    case 'flight': if (d.flight > 0) d.flight = d.swift = 0; else { d.flight = 12; haste(c, .35, 12); } look(c, x, z, 2.5, 0, 'lift', .9, '#ffffff'); break;
    case 'hover': d.flight = 8; haste(c, .25, 8); look(c, x, z, 2.5, 0, 'lift', .9, '#ffe1ff'); break;
    case 'dive': { const mult = d.flight > 0 ? 4 : 2; d.flight = 0; d.invuln = Math.max(d.invuln, .5); c.host.move(dx * 4, dz * 4); job(c, .18, 'puls', 0, 0, 5, mult, 1, 3, 'crater', null, 1, 0, 1.2, '#ffe0b0'); const q = c.host.position(); look(c, q.x, q.z, 1, 0, 'portal', .35); break; }
    case 'sweep': d.gaze = 1.2; c.ga = ang; break;
    case 'boulder': { const q = spot(c, 14, 8, dx, dz), lx = q.x, lz = q.z; look(c, x, z, len(lx - x, lz - z), Math.atan2(lx - x, lz - z), 'boulder', .6, '#c96a3a'); job(c, .6, 'area', lx, lz, 4.5, 3.2, 0, 3, 'crater', null, 1, 0, 1.2, '#c96a3a'); break; }
    case 'shield': d.block = K.block.time; look(c, x, z, 2.3, 0, 'shield', K.block.time, '#fff3c4'); break;
    case 'energyshield': d.shield = 4; heal(c, .2); look(c, x, z, 2.3, 0, 'shield', 4, '#6fe8ff'); break;
    case 'fireball': look(c, x, z, 1, 0, 'charge', K.fireball.charge, '#ffad6b'); job(c, K.fireball.charge, 'fireball', 0, 0, ang, 0, 0, 0, ''); break;
    case 'heal': look(c, x, z, 4, 0, 'heal', 8, '#bbffb9'); job(c, 0, 'heal', x, z, 0, 0, 0, 0, '', null, 16, .5); break;
    case 'stealth': d.stealth = K.stealth.time; haste(c, .3, K.stealth.time); look(c, x, z, 2, 0, 'poof', .7, '#c0ace8'); break;
    case 'bats': d.bats = 2.5; d.invuln = Math.max(d.invuln, 2.5); haste(c, 1, 2.5); look(c, x, z, 2, 0, 'bats', 2.5, '#6a3d9a'); break;
    case 'teleport': look(c, x, z, 1, 0, 'portal', .45); c.host.move(dx * 8, dz * 8); d.invuln = Math.max(d.invuln, .4); { const q = c.host.position(); look(c, q.x, q.z, 1, 0, 'portal', .45); } break;
    case 'backstab': {
      const t = c.nearest(12); if (!t) return false; const f = t.facing ?? ang, gap = t.radius + .8; look(c, x, z, 1, 0, 'portal', .35);
      c.host.move(t.x - x - Math.sin(f) * gap, t.z - z - Math.cos(f) * gap); c.aim(t); const q = c.host.position(); look(c, q.x, q.z, 1, 0, 'portal', .35); c.damage(t, 3, 1); look(c, t.x, t.z, 2, ang, 'swing'); break;
    }
    case 'giant': d.giant = 10; c.gstep = 0; c.lx = x; c.lz = z; look(c, x, z, 3.2, 0, 'crater', .8, '#c96a3a'); break;
    case 'tank': d.tank = 6; haste(c, .8, 6); job(c, 0, 'tank', 0, 0, 0, 0, 0, 0, '', null, 24, .25); break;
    case 'charge': c.rush(3, 25, .45, ang, 'rush'); break;
    case 'tail': look(c, x, z, 3.6, 0, 'tail', .4, '#5fbf5a'); area(c, x, z, 3.6, 1.8, 0, 0, null, 6); break;
    case 'devour': {
      const t = c.nearest(3.2); if (!t) return false;
      if (!big(t) && t.hp / (t.maxHp || t.hp) < .4) { c.host.hit(t, t.hp + 1, true, 0, 0, 0, dx, dz); if (t.hp <= 0) heal(c, .25); } else c.damage(t, 3, 0, 0, 1);
      look(c, x, z, 2.4, ang, 'bite', .4, '#d4e79a'); break;
    }
    case 'smoke': look(c, x, z, 5, 0, 'smoke', 5); job(c, 0, 'smoke', x, z, 0, 0, 0, 0, '', null, 10, .5); break;
    case 'roar': within(c, x, z, 9, 'fear', 4); look(c, x, z, 9, 0, 'roar', .8, '#79c487'); break;
    case 'taunt': within(c, x, z, 12, 'taunt', 6); d.armor = 6; look(c, x, z, 12, 0, 'taunt', 1, '#ff6a4a'); break;
    case 'sheep': {
      // Zoo: the nearest creature within 12 m and up to two more within 3 m of it, for 6 s: tiny, slow and harmless.
      const t = c.nearest(K.sheep.range); if (!t) return false; const list = c.host.targets(); let more = K.sheep.count - 1;
      status(c, t, 'sheep', K.sheep.time); if (!big(t)) t.stun = Math.max(t.stun || 0, .15);
      for (let i = 0; i < list.length && more > 0; i++) { const e = list[i]; if (e !== t && alive(e) && len(e.x - t.x, e.z - t.z) < K.sheep.around + e.radius) { status(c, e, 'sheep', K.sheep.time); if (!big(e)) e.stun = Math.max(e.stun || 0, .15); more--; } }
      look(c, t.x, t.z, K.sheep.around, 0, 'sheep', 1, '#ccbae8'); break;
    }
    case 'charm': { const t = c.nearest(12); if (!t) return false; status(c, t, 'charm', 8); look(c, t.x, t.z, 1, 0, 'hearts', 2, '#ff80bd'); break; }
    case 'tree': {
      // Zoo's binding tree: it stands 3 m ahead for 6 s, its roots hold everything within 5 m for 4 s and it lashes one creature a second.
      const tx = x + dx * K.tree.ahead, tz = z + dz * K.tree.ahead; popKind(c, 'tree'); ally(c, 'tree', tx, tz, K.tree.life, K.tree.cd, 0, ang);
      within(c, tx, tz, K.tree.radius, 'stun', K.tree.root); look(c, tx, tz, K.tree.radius, 0, 'roots', K.tree.root, '#aad487'); break;
    }
    case 'drain': { const t = c.nearest(11); if (!t) return false; job(c, 0, 'drain', 0, 0, 0, 0, 0, 0, '', t, 7, .35); break; }
    case 'bloodnova': look(c, x, z, 7, 0, 'moon', 6, '#cf6290'); d.lifesteal = 6; job(c, .5, 'moon', 0, 0, 0, 0, 0, 0, '', null, 12, .5); break;
    case 'snowball': { const s = shotAt(c, x, z, ang, 3, 21, 'snowball', { speed: 9, radius: .5, pierce: true, stun: 2 }); s.grow = 1; break; }
    case 'blackhole': { const q = spot(c, 12, 6, dx, dz), hx = q.x, hz = q.z; look(c, hx, hz, 8, 0, 'blackhole', 3, '#9c8ee5'); job(c, 0, 'hole', hx, hz, 0, 0, 0, 0, '', null, 10, .3); job(c, 3, 'area', hx, hz, 5, 3, 1, 2, 'blast', null, 1, 0, 1.5, '#bc97ed'); break; }
    case 'holy': { const q = spot(c, 14, 6, dx, dz), hx = q.x, hz = q.z; look(c, hx, hz, 3.5, 0, 'holy', .8, '#fff1b0'); job(c, .8, 'area', hx, hz, 3.5, 4, 1, 2.5, 'holyhit'); break; }
    case 'clones': {
      // Zoo: four clones in a ring round you (a new cast replaces the old ones); they fight, stay near you and draw the creatures' blows.
      popKind(c, 'clone');
      for (let i = 0; i < K.clones.count; i++) { const a = ang + Math.PI / 4 + i * TAU / K.clones.count, qx = x + Math.sin(a) * K.clones.ring, qz = z + Math.cos(a) * K.clones.ring; ally(c, 'clone', qx, qz, K.clones.life, i * .1, a, ang); look(c, qx - Math.sin(a) * .35, qz - Math.cos(a) * .35, .45, 0, 'poof', .3, '#b9a6e8'); }
      break;
    }
    case 'batcircle': for (let i = 0; i < 5; i++) ally(c, 'bat', x, z, 8, i * .12, i / 5 * TAU); look(c, x, z, 2.6, 0, 'dust', .8, '#b9a6e8'); break;
    case 'turret': case 'cannon': popKind(c, op); ally(c, op, x + dx * 1.5, z + dz * 1.5, K[op].life, 0, 0, ang); look(c, x + dx * 1.5, z + dz * 1.5, 2.2, 0, 'dust', .8, '#d8c59a'); break;
    case 'hook': { const t = c.nearest(14); if (!t) return false; look(c, x, z, len(t.x - x, t.z - z), Math.atan2(t.x - x, t.z - z), 'hook', .25, '#d6c19b'); job(c, .25, 'pull', 0, 0, 0, 0, 0, 0, '', t); break; }
    case 'parrot': popKind(c, 'parrot'); ally(c, 'parrot', x, z, K.parrot.life, 0, 0, ang); look(c, x, z, 1.4, 0, 'poof', .6, '#8ae394'); break;
    case 'missiles': { const list = c.host.targets(); let n = 0; for (let i = 0; i < list.length && n < 6; i++) { const e = list[i]; if (alive(e) && len(e.x - x, e.z - z) < 16 + e.radius) job(c, n++ * .15, 'rocket', 0, 0, 0, 0, 0, 0, 'missile', e); } if (!n) return false; break; }
    case 'cannons': {
      const q = spot(c, 15, 7, dx, dz), tx = q.x, tz = q.z;
      for (let i = 0; i < 12; i++) { const a = c.random() * TAU, r = c.random() * 5, qx = tx + Math.cos(a) * r, qz = tz + Math.sin(a) * r; job(c, i * .13, 'look', qx, qz, 1.8, 0, .5, 0, 'cannonfall', null, 1, 0, 1.2, '#dca66c'); job(c, i * .13 + .5, 'area', qx, qz, 1.8, 1.4, 0, 0, 'blast', null, 1, 0, 2, '#ff8a3d'); }
      break;
    }
    case 'decoy': {
      // Zoo: creatures within 8 m go for the snowman instead of you; when it melts or breaks it bursts and freezes them (pop()).
      const qx = x + dx * K.decoy.ahead, qz = z + dz * K.decoy.ahead; popKind(c, 'snow'); ally(c, 'snow', qx, qz, K.decoy.life, 99, 0, ang);
      look(c, qx, qz, 1.4, 0, 'poof', .6, '#e4f9ff'); look(c, qx, qz, DECOY.lure, 0, 'taunt', 1, '#9fe6ff'); break;
    }
    case 'icefloor': look(c, x, z, 6, 0, 'icefield', 8, '#c2f1ff'); job(c, 0, 'rink', x, z, 0, 0, 0, 0, '', null, 16, .5); break;
    case 'iceage': {
      look(c, x, z, 8, 0, 'iceage', 2.2, '#d0f7ff'); const list = c.host.targets();
      for (let i = 0; i < list.length; i++) { const e = list[i]; if (alive(e) && len(e.x - x, e.z - z) < 8 + e.radius) look(c, e.x, e.z, Math.max(.6, e.radius), 0, 'freeze', 3, '#d0f7ff'); }
      area(c, x, z, 8, .3, 3, 0, null); job(c, 3, 'puls', 0, 0, 8, 2.8, 1, 0, ''); break;
    }
    // ---- Army soldier (Zoo: a toy-box drill: cork popgun, sandbags, a signal flare, parachute supply crates)
    case 'popgun': for (let i = 0; i < K.popgun.count; i++) shotAt(c, x, z, ang + (i / (K.popgun.count - 1) - .5) * K.popgun.spread, K.popgun.power, K.popgun.range, 'cork'); look(c, x + dx * .9, z + dz * .9, .8, 0, 'poof', .4, '#f3e2bd'); break;
    case 'sandbag': popKind(c, 'sandbag'); d.cover = K.sandbag.time; c.cx = x; c.cz = z; ally(c, 'sandbag', x, z, K.sandbag.time, 99, 0, ang); look(c, x, z, K.sandbag.radius, 0, 'dust', .8, '#d8c59a'); area(c, x, z, K.sandbag.radius, K.sandbag.power, 0, 0, null, K.sandbag.knock); break;
    case 'flare': { const q = spot(c, K.flare.range, K.flare.fallback, dx, dz); look(c, q.x, q.z, K.flare.radius, 0, 'flare', K.flare.delay + .9, '#ff6a3a'); job(c, K.flare.delay, 'status', q.x, q.z, K.flare.radius, K.flare.blind, 0, K.flare.mark, 'blind'); break; }
    case 'airdrop': {
      const q = spot(c, K.airdrop.range, K.airdrop.fallback, dx, dz), cx = q.x, cz = q.z;
      for (let i = 0; i < K.airdrop.count; i++) {
        const a = i * Math.PI / 2 + ang, qx = i ? cx + Math.sin(a) * K.airdrop.ring : cx, qz = i ? cz + Math.cos(a) * K.airdrop.ring : cz;
        job(c, i * K.airdrop.spacing, 'look', qx, qz, K.airdrop.radius, 0, K.airdrop.fall, 0, 'parachute', null, 1, 0, 1.2, '#f0ece0'); job(c, i * K.airdrop.spacing + K.airdrop.fall, 'area', qx, qz, K.airdrop.radius, K.airdrop.power, 0, .5, 'dust', null, 1, 0, 1.5, '#e8c27a');
      }
      job(c, K.airdrop.fall, 'gain', 0, 0, K.airdrop.heal, 0, 0, 0, ''); break;
    }
    // ---- Navy sailor (anchor, a wave ride, the bosun's whistle, a lighthouse)
    case 'surfride': look(c, x, z, K.surfride.speed * K.surfride.time, ang, 'surf', .6, '#7fd0ff'); c.rush(K.surfride.power, K.surfride.speed, K.surfride.time, ang, ''); break;
    case 'whistle': look(c, x, z, K.whistle.radius, 0, 'whistle', 1, '#ffffff'); within(c, x, z, K.whistle.radius, 'stun', K.whistle.stun); break;
    case 'lighthouse': { const qx = x + Math.cos(ang) * 1.6, qz = z - Math.sin(ang) * 1.6; popKind(c, 'lighthouse'); ally(c, 'lighthouse', qx, qz, K.lighthouse.life, 0, 0, ang); look(c, qx, qz, 1.6, 0, 'dust', .8, '#d8e8f5'); break; }
    // ---- Ao dai lady (lotus, silk ribbon, paper fan, lanterns)
    case 'ribbon': look(c, x, z, 2, ang, 'ribbon', 1.2, '#ff8fb1'); glide(c, K.ribbon.speed, K.ribbon.time, ang); haste(c, K.ribbon.boost, K.ribbon.boostTime); break;
    case 'fan': {
      look(c, x, z, K.fan.radius, ang, 'fan', .7, '#ffb3cf'); const list = c.host.targets();
      for (let i = 0; i < list.length; i++) { const e = list[i], ex = e.x - x, ez = e.z - z, l = len(ex, ez); if (!alive(e) || l > K.fan.radius + e.radius) continue; if (l === 0 || (ex * dx + ez * dz) / l >= K.fan.cone) { c.damage(e, K.fan.power, 0, 0, K.fan.knock); status(c, e, 'slow', K.fan.slow); } }
      break;
    }
    case 'lanterns':
      for (let i = 0; i < K.lanterns.count; i++) { const a = i / K.lanterns.count * TAU + ang, qx = x + Math.sin(a) * K.lanterns.ring, qz = z + Math.cos(a) * K.lanterns.ring, at = K.lanterns.rise + i * K.lanterns.spacing; look(c, qx, qz, K.lanterns.radius, a, 'lantern', at, '#ff5a4a'); job(c, at, 'area', qx, qz, K.lanterns.radius, K.lanterns.power, 0, 0, ''); job(c, at, 'gain', 0, 0, K.lanterns.heal, 0, 0, 0, ''); }
      break;
    // ---- Ao dai gentleman (dragon fan, a kite, an ink-brush circle, a dragon dance)
    case 'kite': d.flight = K.kite.time; haste(c, K.kite.speed, K.kite.time); look(c, x, z, 2, ang, 'kite', K.kite.time, '#ffd84a'); break;
    case 'ink': look(c, x, z, K.ink.radius, 0, 'ink', K.ink.stun, '#20242c'); area(c, x, z, K.ink.radius, K.ink.power, 0, 0, null, 0); within(c, x, z, K.ink.radius, 'stun', K.ink.stun); break;
    case 'dragondance': look(c, x, z, K.dragondance.radius, 0, 'dragondance', K.dragondance.time, '#e8352b'); job(c, K.dragondance.tick / 2, 'puls', 0, 0, K.dragondance.radius, K.dragondance.power, 0, 0, '', null, K.dragondance.time / K.dragondance.tick, K.dragondance.tick, 1.5); break;
    // ---- Stars and stripes (eagle, star shield, liberty torch, fireworks)
    case 'starshield': d.shield = K.starshield.time; look(c, x, z, 1.6, ang, 'starshield', K.starshield.time, '#3c5bd6'); area(c, x, z, K.starshield.radius, K.starshield.power, 0, 0, null, K.starshield.knock); break;
    case 'torch': d.rally = K.torch.time; heal(c, K.torch.heal); look(c, x, z, K.torch.radius, 0, 'torch', K.torch.time, '#ffb02e'); within(c, x, z, K.torch.radius, 'blind', K.torch.blind); break;
    case 'fireworks': {
      const list = c.host.targets(), F = K.fireworks; let first = -1;
      for (let i = 0; i < F.count; i++) {
        // The next creature within 14 m, round and round; with none, 7 m ahead.
        let t = null; for (let s = 0; s < list.length; s++) { const at = (first + 1 + s) % list.length, e = list[at]; if (alive(e) && len(e.x - x, e.z - z) < F.range + e.radius) { t = e; first = at; break; } }
        const a = c.random() * TAU, r = c.random() * 1.2, qx = (t ? t.x : x + dx * F.fallback) + Math.cos(a) * r, qz = (t ? t.z : z + dz * F.fallback) + Math.sin(a) * r, hex = i % 3 === 0 ? '#ff4d5a' : i % 3 === 1 ? '#ffffff' : '#4d7dff';
        job(c, i * F.spacing, 'look', qx, qz, F.radius, 0, F.rise + .5, 0, 'firework', null, 1, 0, 1.2, hex); job(c, i * F.spacing + F.rise, 'area', qx, qz, F.radius, F.power, 0, .4, '', null, 1, 0, 1.5);
      }
      break;
    }
    // ---- Golden star flag (golden star, bamboo vault, bronze drum, the great golden star)
    case 'bamboo': look(c, x, z, K.bamboo.speed * K.bamboo.time, ang, 'bamboo', K.bamboo.time + .2, '#8fd45a'); glide(c, K.bamboo.speed, K.bamboo.time, ang); job(c, K.bamboo.time, 'puls', 0, 0, K.bamboo.radius, K.bamboo.power, 0, .4, 'dust', null, 1, 0, K.bamboo.knock, '#8fd45a'); break;
    case 'drum': look(c, x, z, K.drum.radius, 0, 'drum', K.drum.gap * K.drum.beats + .4, '#e0a040'); for (let b = 0; b < K.drum.beats; b++) job(c, b * K.drum.gap, 'area', x, z, K.drum.radius, K.drum.power, b === K.drum.beats - 1 ? K.drum.stun : 0, 0, '', null, 1, 0, K.drum.knock); break;
    case 'bigstar': {
      const q = spot(c, K.bigstar.range, K.bigstar.fallback, dx, dz); look(c, q.x, q.z, K.bigstar.radius, 0, 'bigstar', K.bigstar.delay + .5, '#ffe34d');
      job(c, K.bigstar.delay, 'area', q.x, q.z, K.bigstar.radius, K.bigstar.power, 0, K.bigstar.lift, 'goldstar', null, 1, 0, 1.5, '#ffe34d'); job(c, K.bigstar.delay, 'status', q.x, q.z, K.bigstar.radius, K.bigstar.slow, 0, 0, 'slow'); break;
    }
    default: return false;
  }
  return true;
}

function skill(index) {
  const id = this.host.special?.();
  if (!KITS[id]) {
    this.kit = false; if (!baseSkill.call(this, index)) return false;
    // The three base skills as Zoo draws them: the whirlwind's ring round you for its 2.2 s, the dash's streak, the slam's crater as it lands.
    if (index < 3) {
      ensure(this); const p = this.host.position();
      if (index === 0) look(this, p.x, p.z, this.whirlRadius, 0, 'whirl', 2.2, '#e5f6ff'); else if (index === 1) look(this, p.x, p.z, 2, this.host.facing(), 'rush', .24, '#e9fbff'); else job(this, .42, 'lookme', 0, 0, 4.4, 0, .8, 0, 'crater', null, 1, 0, 1.2, '#ffd091');
    }
    return true;
  }
  if (this.mode || index < 0 || index > 3 || this.cooldowns[index] > 0) return false;
  const info = kitInfo(id, index); this.aim();
  if (!cast(this, id, index, info)) return false;
  this.kit = true; this.sid = info.sid; this.spans[index] = this.cooldowns[index] = info.cd * (this.host.cooldownScale?.() ?? 1);
  return true;
}
function damage(target, power, stun = 0, lift = 0, knock = 0) {
  const d = this.d; let steal = 0;
  if (d) {
    if (d.giant > 0) power *= 1.6; if (d.rally > 0) power *= 1 + DZ.torch.bonus; if (d.stealth > 0) { power *= 3; d.stealth = 0; } if (target.mark > 0) power *= 1.5;
    if (d.lifesteal > 0) { const s = this.host.stats(); steal = s.attack * power * .4 / (s.maxHp || 100); }
  }
  baseDamage.call(this, target, power, stun, lift, knock); if (steal > 0) heal(this, steal);
}
function reset() {
  baseReset.call(this); this.kit = false;
  if (!this.dj) return;
  for (let i = 0; i < JOBS; i++) this.dj[i].live = false; for (let i = 0; i < ALLIES; i++) this.al[i].live = false;
  for (const k in this.d) this.d[k] = 0; this.hvOn = true; this.hv = 0;
}
/** One summon's turn (Zoo's ally loop in CombatSimulation.update). */
function allyStep(c, a, dt, p) {
  a.life -= dt; a.cd -= dt; if (a.hurt > 0) a.hurt = Math.max(0, a.hurt - dt);
  if (a.life <= 0) { pop(c, a); return; }
  const kind = a.kind;
  if (kind === 'snow' || kind === 'sandbag') return;
  if (kind === 'lighthouse') {
    // The beam turns half a circle a second; a creature it sweeps over within reach is hit and dazzled, at most once per rehit.
    const L = DZ.lighthouse, list = c.host.targets(); a.f += dt * L.turn; const bx = Math.sin(a.f), bz = Math.cos(a.f);
    for (let i = 0; i < list.length; i++) {
      const e = list[i], ex = e.x - a.x, ez = e.z - a.z, l = len(ex, ez); if (!alive(e) || l > L.reach + e.radius || l < .01 || e.lh > c.time) continue;
      if (Math.abs(Math.atan2(ex * bz - ez * bx, ex * bx + ez * bz)) > L.width + Math.atan2(e.radius, l)) continue;
      e.lh = c.time + L.rehit; c.damage(e, L.power); status(c, e, 'blind', L.blind); c.host.effect('impact', e.x, e.z, .9, 0, 0);
    }
    return;
  }
  if (kind === 'bat') { a.x = p.x + Math.cos(c.time * 3 + a.orbit) * 2.2; a.z = p.z + Math.sin(c.time * 3 + a.orbit) * 2.2; }
  const t = nearestTo(c, a.x, a.z, 13, kind === 'clone');
  if (!t) {
    // Nothing to fight: the parrot and the clones come back to your side.
    if (kind === 'parrot' || kind === 'clone') {
      const gap = len(p.x - a.x, p.z - a.z), near = kind === 'clone' ? DZ.clones.ring + .4 : 1.5;
      if (gap > near) { const st = Math.min(gap - near + .3, dt * (kind === 'parrot' ? DZ.parrot.speed : 8)); a.x += (p.x - a.x) / gap * st; a.z += (p.z - a.z) / gap * st; a.f = Math.atan2(p.x - a.x, p.z - a.z); }
    }
    return;
  }
  const dist = len(t.x - a.x, t.z - a.z), ang = Math.atan2(t.x - a.x, t.z - a.z), reach = kind === 'clone' ? DZ.clones.reach : kind === 'parrot' ? DZ.parrot.reach : kind === 'tree' ? DZ.tree.radius : 1.6; a.f = ang;
  if ((kind === 'clone' || kind === 'parrot') && dist > t.radius + reach * .85) {
    const st = Math.min(dist - t.radius - reach * .8, dt * (kind === 'parrot' ? DZ.parrot.speed : 8)); a.x += Math.sin(ang) * st; a.z += Math.cos(ang) * st;
    if (kind === 'clone') { const gx = a.x - p.x, gz = a.z - p.z, g = len(gx, gz), max = DECOY.range - .3; if (g > max) { a.x = p.x + gx / g * max; a.z = p.z + gz / g * max; } }
  }
  if (a.cd > 0) return;
  if (kind === 'turret' || kind === 'cannon') { const T = DZ[kind]; if (dist > T.range + t.radius) return; shotAt(c, a.x, a.z, ang, T.power, T.range + 1, kind === 'turret' ? 'volt' : 'cannonball', { speed: 17, blast: kind === 'cannon' ? 2 : 0 }); a.cd = T.cd; }
  else if (dist < t.radius + reach) {
    if (kind === 'tree') { c.damage(t, DZ.tree.power, 0, 0, .5); a.cd = DZ.tree.cd; c.host.effect('ring', a.x, a.z, DZ.tree.radius, 0, 0); return; }
    c.damage(t, kind === 'bat' ? .35 : kind === 'parrot' ? DZ.parrot.power : DZ.clones.power, .1); a.cd = kind === 'parrot' ? DZ.parrot.cd : kind === 'clone' ? DZ.clones.cd : .7; look(c, a.x, a.z, 1.4, ang, 'swing');
    if (kind === 'bat') heal(c, .01);
    // The scout's peck marks its target: marked creatures take half as much again.
    if (kind === 'parrot' && t.hp > 0) { t.mark = DZ.parrot.mark; c.dany = Math.max(c.dany, c.time + DZ.parrot.mark + 1); }
  }
}
function tick(dt) {
  baseTick.call(this, dt); const c = this; if (!c.dj) return;
  for (let i = 0; i < JOBS; i++) { const j = c.dj[i]; if (j.live && j.at <= c.time) run(c, j); }
  const d = c.d, p = c.host.position(); let any = false;
  // The laser gaze (Zoo GAZE): one sweep of 1.8 rad in 1.2 s, a 13 m line 1 m wide; a creature is hit again after 0.25 s.
  if (d.gaze > 0) {
    const ang = c.ga - .9 + (1.2 - d.gaze) / 1.2 * 1.8, fx = Math.sin(ang), fz = Math.cos(ang), list = c.host.targets(); look(c, p.x, p.z, 13, ang, 'eyes', .075);
    for (let i = 0; i < list.length; i++) {
      const e = list[i]; if (!alive(e)) continue; const ex = e.x - p.x, ez = e.z - p.z, along = ex * fx + ez * fz, across = Math.abs(ex * fz - ez * fx);
      if (along > 0 && along < 13 && across < e.radius + .5 && !(e.gz > c.time)) { e.gz = c.time + .25; c.damage(e, 1, 0, 0, .5); look(c, p.x + fx * along, p.z + fz * along, .6, ang, 'burn'); }
    }
  }
  for (const k in d) if (d[k] > 0) { d[k] = Math.max(0, d[k] - dt); any = true; }
  // Haste rides on the gear's own speed (the view moves you that much farther each step); `bs` remembers what the gear alone gives.
  const st = c.host.stats(); if (st && st.speed > 0) { if (st.bs === undefined) st.bs = st.speed; st.speed = st.bs * (d.swift > 0 ? 1 + c.sw : 1); }
  if (d.giant > 0) { c.gstep -= dt; if (c.gstep <= 0 && len(p.x - c.lx, p.z - c.lz) > .2) { c.gstep = .45; area(c, p.x, p.z, 2.5, .7, 0, 0, 'crater', 2, '#c96a3a'); } c.lx = p.x; c.lz = p.z; }
  c.hv -= dt;
  if (any || c.hvOn) {
    if (c.hv <= 0) { c.hv = .1; const aura = d.armor > 0 ? 5 : d.lifesteal > 0 ? 6 : 0; if (aura) look(c, 0, d.giant > 0 ? 2 : 1, aura, 0, 'hero'); c.hvOn = any; }
  }
  // creatures under a status
  if (c.dany > c.time) {
    const list = c.host.targets();
    for (let i = 0; i < list.length; i++) {
      const e = list[i]; if (!alive(e)) continue;
      if (e.mark > 0) e.mark -= dt;
      // A sheep keeps walking (slowly) and cannot strike; when the spell ends it is itself again in a puff.
      if (e.sheep > 0) { e.sheep -= dt; e.slow = Math.max(e.slow || 0, .2); e.cooldown = Math.max(e.cooldown || 0, .3); if (e.sheep <= 0) look(c, e.x, e.z, 1, 0, 'poof', .5, '#ccbae8'); }
      for (let s = 0; s < 4; s++) {
        const k = STATES[s]; if (!(e[k] > 0)) continue; e[k] -= dt; e.stun = Math.max(e.stun || 0, .12);
        if (k === 'fear') push(e, e.x - p.x, e.z - p.z, 2.2); else if (k === 'taunt') { if (len(e.x - p.x, e.z - p.z) > 2.5) push(e, p.x - e.x, p.z - e.z, 1.6); }
        else if (k === 'blind') { const a = c.time * 2 + e.x; push(e, Math.sin(a), Math.cos(a), 1.2); }
        else if (k === 'charm') { const o = nearestTo(c, e.x, e.z, 8); if (o && o !== e) { const dd = len(o.x - e.x, o.z - e.z); if (dd > e.radius + o.radius + .3) push(e, o.x - e.x, o.z - e.z, 2.4); else if ((e.cb = (e.cb || 0) - dt) <= 0) { e.cb = .7; c.damage(o, .5, .1); look(c, o.x, o.z, 1, 0, 'blast'); } } }
        if ((e.sl = (e.sl || 0) - dt) <= 0) { e.sl = .6; look(c, e.x, e.z, e.radius, 0, STLOOK[k]); }
      }
    }
  }
  for (let i = 0; i < ALLIES; i++) if (c.al[i].live) allyStep(c, c.al[i], dt, p);
  // The creatures' shots that reach a summon hurt the summon.
  const ws = c.wl?.shots;
  if (ws) for (let n = 0; n < ws.length; n++) {
    const s = ws[n]; if (!s.live) continue;
    for (let i = 0; i < ALLIES; i++) { const a = c.al[i]; if (a.live && a.hp > 0 && len(s.x - a.x, s.z - a.z) < SUMMON_HP[a.kind].r + .45) { hurtAlly(c, a, s.damage); s.live = false; break; } }
  }
  // shots that grow (snowball) or home (rockets); an electric shot or a shell that has just ended bursts as Zoo's do
  for (let i = 0; i < c.shots.length; i++) {
    const s = c.shots[i];
    if (!s.live) { if (s.was) { s.was = false; if (s.kind === 'volt' || s.kind === 'missile') look(c, s.x, s.z, s.blast || .7, 0, 'shock'); else if (s.blast) look(c, s.x, s.z, s.blast, 0, 'blast', 0, s.kind === 'fireball' ? '#ff8a3d' : '#ffe45c'); } continue; }
    s.was = true;
    if (s.grow) s.radius = Math.min(2.6, s.radius + .9 * dt);
    const h = s.home; if (h) { if (alive(h)) { const want = Math.atan2(h.x - s.x, h.z - s.z), now = Math.atan2(s.dx, s.dz), turn = Math.max(-dt * 5, Math.min(dt * 5, Math.atan2(Math.sin(want - now), Math.cos(want - now)))); s.dx = Math.sin(now + turn); s.dz = Math.cos(now + turn); } }
  }
}
/** The summon a creature goes for instead of you: a decoy within its lure first, else a hittable summon nearer than you (Zoo enemyTarget). */
const LURE = { x: 0, z: 0, active: true };
function lureFor(c, e, player) {
  let best = null, bd = Infinity, taunt = false; const mine = len(player.x - e.x, player.z - e.z);
  for (let i = 0; i < ALLIES; i++) {
    const a = c.al[i]; if (!a.live || !(a.hp > 0)) continue; const s = SUMMON_HP[a.kind];
    let ax = a.x, az = a.z; if (a.ring) { const gx = e.x - a.x, gz = e.z - a.z, g = len(gx, gz); if (g < a.ring) continue; ax += gx / g * a.ring; az += gz / g * a.ring; }
    const dd = len(ax - e.x, az - e.z), lures = !!s.taunt && dd < DECOY.lure; if (!lures && (taunt || dd >= mine)) continue;
    if (lures && !taunt || dd < bd) { best = a; bd = dd; taunt = lures; LURE.x = ax; LURE.z = az; }
  }
  return best;
}
/**
 * Joins the kits to the world they fight in, once (skill-looks.mjs calls it with world.pandora): the creatures' own thinking is
 * handed a summon as its target (so they walk to it, wind up and strike it as they would you) and loses you while you are hidden;
 * a blow meant for a summon lands on the summon; a sheep's blow does nothing; the knight's shield blocks from in front; armour,
 * giant form, tank mode and sandbag cover also soften the lands' own damage (lava, fire rain); a disguise fights with its own weapon.
 */
export function hook(pandora) {
  const wilds = pandora?.wilds, c = pandora?.combat; if (!wilds || !c || wilds.dzHook) return; wilds.dzHook = true; c.wl = wilds;
  const life = wilds.life, hurt = wilds.host.hurt, share = wilds.host.hurtShare, land = pandora.hurtFraction, weapon = c.host.weapon;
  wilds.life = function (e, dt, target, region, player, awake) {
    e.lure = null;
    if (c.al && target && player && e.hp > 0 && !big(e)) {
      if (c.d.stealth > 0) target = null;
      else { const a = lureFor(c, e, player); if (a) { e.lure = a; return life.call(this, e, dt, LURE, region, LURE, awake); } }
    }
    return life.call(this, e, dt, target, region, player, awake);
  };
  wilds.host.hurt = (amount, source, e) => {
    const a = source === 'shot' ? null : e?.lure, d = c.d;
    if (a) { if (a.live) hurtAlly(c, a, amount); return; }
    if (e?.sheep > 0) return;
    if (d && d.block > 0 && e && c.blocks(e)) { const f = c.host.facing(), p = c.host.position(); look(c, p.x + Math.sin(f) * .6, p.z + Math.cos(f) * .6, .9, f, 'blast', .3, '#fff3c4'); if (source === 'shot' && alive(e)) c.damage(e, DZ.block.reflect, .2, 0, 1.5); return; }
    hurt(amount, source, e);
  };
  if (share) wilds.host.hurtShare = (amount, source, e) => share(amount * c.taken, source, e);
  if (land) pandora.hurtFraction = (amount, source) => land(amount * c.taken, source);
  c.host.weapon = () => KIT_WEAPON[c.host.special?.()] ?? weapon();
}
export function install() {
  const P = Combat.prototype; if (P.skill === skill) return;
  baseSkill = P.skill; baseDamage = P.damage; baseReset = P.reset; baseTick = P.tick; baseShoot = P.shoot;
  P.shoot = function (a, pw, r, k) { const s = baseShoot.call(this, a, pw, r, k); s.grow = 0; s.home = null; s.was = true; return s; };
  P.skill = skill; P.damage = damage; P.reset = reset; P.tick = tick;
  /** The knight's raised shield stops every blow from a creature in front of you (Zoo blocks()). */
  P.blocks = function (from) { const p = this.host.position(), f = this.host.facing(); return (from.x - p.x) * Math.sin(f) + (from.z - p.z) * Math.cos(f) > 0; };
  Object.defineProperty(P, 'invulnerable', { configurable: true, get() { const d = this.d; return this.mode === 'dash' || !!d && (d.shield > 0 || d.invuln > 0 || d.bats > 0 || d.flight > 0); } });
  // Zoo adds defence (giant 20, tank 30, sandbag cover 60 while you stand inside the wall, challenge 80) to damage × 60 / (defence + 60).
  Object.defineProperty(P, 'taken', { configurable: true, get() {
    const d = this.d; if (!d) return 1; const p = this.host.position(), cover = d.cover > 0 && len(p.x - this.cx, p.z - this.cz) <= DZ.sandbag.radius;
    const bonus = (d.giant > 0 ? DZ.giant.defence : 0) + (d.tank > 0 ? DZ.tank.defence : 0) + (cover ? DZ.sandbag.defence : 0) + (d.armor > 0 ? DZ.taunt.defence : 0); if (!bonus) return 1;
    const base = 60 + Math.max(0, this.host.stats().defense ?? 0); return base / (base + bonus);
  } });
}
export { distanceToSegment };
