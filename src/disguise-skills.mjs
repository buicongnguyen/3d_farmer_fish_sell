// The disguise kits at work (fetched with the box). Zoo Garden's CombatSimulation.disguise() on Combat: a worn disguise replaces all four
// skills (disguise-kits.mjs). Pure like skills-special.mjs, no three.js and no DOM; looks are asked through host.effect('look', ...).
// Everything lives in fixed pools made on the first cast (40 timed jobs, 8 allies); a creature's status is a number on the creature
// (fear, blind, sheep, charm, taunt, mark: seconds left), so a fight makes no garbage. Hits go through Combat.damage -> host.hit, so a boss
// or a titan is only slowed by any status and lift is scaled as everywhere else. Creatures only: nothing here can reach the village ward.
import { Combat, distanceToSegment } from './combat.mjs';
import { KITS, kitInfo } from './disguise-kits.mjs';

const TAU = Math.PI * 2, JOBS = 40, ALLIES = 8, STATES = ['fear', 'blind', 'sheep', 'charm', 'taunt'];
const STLOOK = { fear: 'st_fear', blind: 'st_blind', sheep: 'st_sheep', charm: 'st_charm', taunt: 'st_taunt' };
const len = (x, z) => Math.sqrt(x * x + z * z);
const alive = e => e.hp > 0 && !(e.leaving > 0);
const big = e => !!(e.def?.boss || e.titan || e.def?.behavior === 'titan');
let baseSkill, baseDamage, baseReset, baseTick, baseShoot;

function ensure(c) {
  if (c.dj) return;
  c.dj = Array.from({ length: JOBS }, () => ({ live: false, at: 0, op: '', n: 0, every: 0, x: 0, z: 0, a: 0, b: 0, s: 0, l: 0, k: '', t: null }));
  c.al = Array.from({ length: ALLIES }, () => ({ live: false, kind: '', x: 0, z: 0, life: 0, cd: 0, orbit: 0 }));
  c.d = { flight: 0, shield: 0, stealth: 0, bats: 0, giant: 0, armor: 0, lifesteal: 0, tank: 0 }; c.dany = 0; c.hv = 0; c.hvOn = false; c.gstep = 0; c.lx = 0; c.lz = 0;
}
function job(c, delay, op, x, z, a, b, s, l, k, t, n = 1, every = 0) {
  let j = null; for (let i = 0; i < JOBS; i++) if (!c.dj[i].live) { j = c.dj[i]; break; }
  if (!j) { j = c.dj[0]; for (let i = 1; i < JOBS; i++) if (c.dj[i].at < j.at) j = c.dj[i]; }
  j.live = true; j.at = c.time + delay; j.op = op; j.x = x; j.z = z; j.a = a; j.b = b; j.s = s; j.l = l; j.k = k; j.t = t ?? null; j.n = n; j.every = every;
}
const look = (c, x, z, r, f, id) => c.host.effect('look', x, z, r, f, id);
function area(c, x, z, r, power, stun, lift, id, knock = 1.2) {
  if (id) look(c, x, z, r, c.host.facing(), id);
  const list = c.host.targets();
  for (let i = 0; i < list.length; i++) { const e = list[i]; if (alive(e) && len(e.x - x, e.z - z) <= r + e.radius) c.damage(e, power, stun, lift, knock); }
}
/** A status on a creature: a boss or a titan is only slowed. */
function status(c, e, kind, secs) { if (big(e)) { e.slow = Math.max(e.slow || 0, Math.min(secs, 3)); return; } e[kind] = secs; c.dany = c.time + secs + 1; }
function ally(c, kind, x, z, life, cd, orbit) {
  let a = null; for (let i = 0; i < ALLIES; i++) if (!c.al[i].live) { a = c.al[i]; break; }
  if (!a) { a = c.al[0]; for (let i = 1; i < ALLIES; i++) if (c.al[i].life < a.life) a = c.al[i]; }
  a.live = true; a.kind = kind; a.x = x; a.z = z; a.life = life; a.cd = cd; a.orbit = orbit; a.born = c.time; a.f = c.host.facing();
}
function shotAt(c, x, z, angle, power, range, kind, o) {
  const s = c.shoot(angle, power, range, kind); s.x = x + Math.sin(angle) * .6; s.z = z + Math.cos(angle) * .6; s.speed = o?.speed ?? 0; s.radius = o?.radius ?? 0; s.lift = 0; s.pierce = !!o?.pierce; s.stun = o?.stun ?? 0; s.blast = o?.blast ?? 0; s.grow = 0; s.home = o?.home ?? null; return s;
}
function nearestTo(c, x, z, range) { let best = null, bd = Infinity; const list = c.host.targets(); for (let i = 0; i < list.length; i++) { const e = list[i]; if (!alive(e)) continue; const d = len(e.x - x, e.z - z); if (d <= range + e.radius && d < bd) { bd = d; best = e; } } return best; }
function push(e, x, z, speed) { const d = len(x, z) || 1; e.kx = (e.kx || 0) + x / d * speed; e.kz = (e.kz || 0) + z / d * speed; }
function heal(c, f) { c.host.heal?.(f); }

function run(c, j) {
  const p = c.host.position();
  switch (j.op) {
    case 'area': area(c, j.x, j.z, j.a, j.b, j.s, j.l, j.k); break;
    case 'puls': area(c, p.x, p.z, j.a, j.b, j.s, j.l, j.k); break;
    case 'heal': if (len(p.x - j.x, p.z - j.z) < 4) heal(c, .03); break;
    case 'smoke': { const list = c.host.targets(); for (let i = 0; i < list.length; i++) { const e = list[i]; if (alive(e) && len(e.x - j.x, e.z - j.z) < 5 + e.radius) status(c, e, 'blind', 1.2); } if (len(p.x - j.x, p.z - j.z) < 5) c.d.stealth = Math.max(c.d.stealth, .6); break; }
    case 'roots': area(c, j.x, j.z, 6, .3, .5, 0, 'roots'); heal(c, .01); break;
    case 'drain': { const e = j.t; if (!alive(e)) break; look(c, p.x, p.z, len(e.x - p.x, e.z - p.z), Math.atan2(e.x - p.x, e.z - p.z), 'drain'); c.damage(e, .7); heal(c, .035); break; }
    case 'moon': area(c, p.x, p.z, 7, .3, 0, 0, null); look(c, p.x, p.z, 7, 0, 'moon'); break;
    case 'hole': { const list = c.host.targets(); for (let i = 0; i < list.length; i++) { const e = list[i]; if (alive(e) && !big(e) && len(e.x - j.x, e.z - j.z) < 7) push(e, j.x - e.x, j.z - e.z, 7); } area(c, j.x, j.z, 5, .4, 1, 0, 'blackhole'); break; }
    case 'rink': { const list = c.host.targets(); for (let i = 0; i < list.length; i++) { const e = list[i]; if (alive(e) && len(e.x - j.x, e.z - j.z) < 6 + e.radius) e.slow = Math.max(e.slow || 0, 1); } look(c, j.x, j.z, 6, 0, 'icefield'); break; }
    case 'tank': area(c, p.x, p.z, 2, 1, .3, 1, 'shock'); break;
    case 'fall': look(c, j.x, j.z, 2, 0, 'cannonfall'); break;
    case 'fireball': shotAt(c, p.x, p.z, j.a, 3, 14, 'fireball', { speed: 14, radius: 1, blast: 4, stun: 2 }); break;
    case 'rocket': { const e = j.t; if (!alive(e)) break; shotAt(c, p.x, p.z, Math.atan2(e.x - p.x, e.z - p.z), 2, 18, j.k, { speed: 18, blast: 2, home: e }); break; }
    case 'pull': { const e = j.t; if (!alive(e)) break; push(e, p.x - e.x, p.z - e.z, len(p.x - e.x, p.z - e.z) * 6); c.damage(e, 1.5, 2); break; }
    case 'gaze': {
      const sx = p.x, sz = p.z, ang = j.a, fx = Math.sin(ang), fz = Math.cos(ang); look(c, sx, sz, 13, ang, 'eyes');
      const list = c.host.targets(); for (let i = 0; i < list.length; i++) { const e = list[i]; if (!alive(e)) continue; const dx = e.x - sx, dz = e.z - sz, along = dx * fx + dz * fz, across = Math.abs(dx * fz - dz * fx); if (along > 0 && along < 13 && across < e.radius + .5 && !(e.gz > c.time)) { e.gz = c.time + .3; c.damage(e, 1, 0, 0, .5); look(c, e.x, e.z, .6, ang, 'burn'); } }
      break;
    }
    case 'breath': { const ang = j.a; for (let i = 0; i < 9; i++) { const o = (i - 4) * .12, d = 1.2 + i % 3 * 2.4; area(c, p.x + Math.sin(ang + o) * d, p.z + Math.cos(ang + o) * d, 1.3, .9, .1, 0, 'flame', 2); } break; }
  }
  if (j.n > 1) { j.n--; j.at += j.every; j.live = true; } else j.live = false;
}

const POINTS = {
  fireball(c, p, ang) { look(c, p.x, p.z, 1, 0, 'charge'); job(c, .8, 'fireball', 0, 0, ang, 0, 0, 0, ''); },
  silk(c, p, ang) { look(c, p.x, p.z, 10, ang, 'silk'); for (let i = 0; i < 5; i++) shotAt(c, p.x, p.z, ang + (i - 2) * .22, .9, 11, 'silk', { speed: 14, pierce: true, stun: .6 }); },
  breath(c, p, ang) { look(c, p.x, p.z, 7, ang, 'flame'); for (let i = 0; i < 3; i++) job(c, i * .1, 'breath', 0, 0, ang, 0, 0, 0, ''); },
};
/** Casts skill `index` of the kit `id`: true when it went off (cooldown set by the caller). */
function cast(c, id, index, info) {
  ensure(c);
  const p = c.host.position(), x = p.x, z = p.z, ang = c.aim(), dx = Math.sin(ang), dz = Math.cos(ang), d = c.d, op = info.op;
  if (info.sp) { const c3 = c.cooldowns[3], s3 = c.spans[3]; c.special(info.sp); c.cooldowns[3] = c3; c.spans[3] = s3; return true; }
  if (POINTS[op]) { POINTS[op](c, p, ang); return true; }
  switch (op) {
    case 'flight': d.flight = d.flight > 0 ? 0 : 12; look(c, x, z, 2.5, 0, 'lift'); break;
    case 'hover': d.flight = 8; look(c, x, z, 2.5, 0, 'lift'); break;
    case 'dive': { const mult = d.flight > 0 ? 4 : 2; d.flight = 0; c.host.move(dx * 4, dz * 4); const q = c.host.position(); job(c, .18, 'puls', 0, 0, 5, mult, 1, 3, 'crater'); look(c, q.x, q.z, 1, 0, 'portal'); break; }
    case 'sweep': for (let s = 0; s <= 8; s++) job(c, s * .15, 'gaze', 0, 0, ang - .6 + s * .15, 0, 0, 0, ''); break;
    case 'boulder': { const t = c.nearest(14), lx = t ? t.x : x + dx * 8, lz = t ? t.z : z + dz * 8; look(c, lx, lz, 4.5, 0, 'boulder'); job(c, .6, 'area', lx, lz, 4.5, 3.2, 0, 3, 'crater'); break; }
    case 'shield': case 'energyshield': d.shield = 4; if (op === 'energyshield') heal(c, .2); look(c, x, z, 2.3, 0, 'shield'); break;
    case 'heal': look(c, x, z, 4, 0, 'heal'); job(c, 0, 'heal', x, z, 0, 0, 0, 0, '', null, 16, .5); break;
    case 'stealth': d.stealth = 5; look(c, x, z, 2, 0, 'poof'); break;
    case 'bats': d.bats = 2.5; d.shield = 2.5; look(c, x, z, 2, 0, 'bats'); break;
    case 'teleport': look(c, x, z, 1, 0, 'portal'); c.host.move(dx * 8, dz * 8); { const q = c.host.position(); look(c, q.x, q.z, 1, 0, 'portal'); } break;
    case 'backstab': {
      const t = c.nearest(12); if (!t) return false; const f = t.facing ?? ang, gap = t.radius + .8; look(c, x, z, 1, 0, 'portal');
      c.host.move(t.x - x - Math.sin(f) * gap, t.z - z - Math.cos(f) * gap); c.aim(t); const q = c.host.position(); look(c, q.x, q.z, 1, 0, 'portal'); c.damage(t, 3, 1); look(c, t.x, t.z, 2, ang, 'swing'); break;
    }
    case 'giant': d.giant = 10; c.gstep = 0; c.lx = x; c.lz = z; look(c, x, z, 3.2, 0, 'crater'); break;
    case 'tank': d.tank = 6; job(c, 0, 'tank', 0, 0, 0, 0, 0, 0, '', null, 24, .25); break;
    case 'charge': c.rush(3, 25, .45, ang, 'rush'); break;
    case 'tail': look(c, x, z, 3.6, 0, 'tail'); area(c, x, z, 3.6, 1.8, 0, 0, null, 6); break;
    case 'devour': {
      const t = c.nearest(3.2); if (!t) return false;
      if (!big(t) && t.hp / (t.maxHp || t.hp) < .4) { c.host.hit(t, t.hp + 1, true, 0, 0, 0, dx, dz); if (t.hp <= 0) heal(c, .25); } else c.damage(t, 3, 0, 0, 1);
      look(c, x, z, 2.4, ang, 'bite'); break;
    }
    case 'smoke': look(c, x, z, 5, 0, 'smoke'); job(c, 0, 'smoke', x, z, 0, 0, 0, 0, '', null, 10, .5); break;
    case 'roar': case 'taunt': case 'sheep': case 'charm': {
      const t = c.nearest(12), cx = op === 'sheep' || op === 'charm' ? (t ? t.x : x) : x, cz = op === 'sheep' || op === 'charm' ? (t ? t.z : z) : z, r = op === 'sheep' ? 3 : op === 'charm' ? 1 : op === 'roar' ? 9 : 12;
      const kind = op === 'roar' ? 'fear' : op === 'sheep' ? 'sheep' : op, secs = op === 'charm' ? 8 : op === 'roar' ? 4 : 6, list = c.host.targets();
      for (let i = 0; i < list.length; i++) { const e = list[i]; if (alive(e) && len(e.x - cx, e.z - cz) < r + e.radius) status(c, e, kind, secs); }
      if (op === 'taunt') d.armor = 6; look(c, cx, cz, r, 0, op === 'roar' ? 'roar' : op === 'charm' ? 'hearts' : op === 'taunt' ? 'taunt' : 'sheepspell'); break;
    }
    case 'roots': look(c, x, z, 6, 0, 'roots'); area(c, x, z, 6, 1, 4, 0, null); job(c, .5, 'roots', x, z, 0, 0, 0, 0, '', null, 8, .5); break;
    case 'drain': { const t = c.nearest(11); if (!t) return false; job(c, 0, 'drain', 0, 0, 0, 0, 0, 0, '', t, 7, .35); break; }
    case 'bloodnova': look(c, x, z, 7, 0, 'moon'); d.lifesteal = 6; job(c, .5, 'moon', 0, 0, 0, 0, 0, 0, '', null, 12, .5); break;
    case 'snowball': { const s = shotAt(c, x, z, ang, 3, 21, 'snowball', { speed: 9, radius: .5, pierce: true, stun: 2 }); s.grow = 1; break; }
    case 'blackhole': { const t = c.nearest(12), hx = t ? t.x : x, hz = t ? t.z : z; look(c, hx, hz, 7, 0, 'blackhole'); job(c, 0, 'hole', hx, hz, 0, 0, 0, 0, '', null, 10, .3); job(c, 3, 'area', hx, hz, 5, 3, 1, 2, 'blast'); break; }
    case 'holy': { const t = c.nearest(14), hx = t ? t.x : x, hz = t ? t.z : z; look(c, hx, hz, 3.5, 0, 'holy'); job(c, .8, 'area', hx, hz, 3.5, 4, 1, 2.5, 'holyhit'); break; }
    case 'clones': for (let i = 0; i < 2; i++) ally(c, 'clone', x + Math.cos(i * Math.PI) * 1.5, z + Math.sin(i * Math.PI) * 1.5, 8, i * .12, 0); look(c, x, z, 2.6, 0, 'poof'); break;
    case 'batcircle': for (let i = 0; i < 5; i++) ally(c, 'bat', x, z, 8, i * .12, i / 5 * TAU); look(c, x, z, 2.6, 0, 'bats'); break;
    case 'turret': case 'cannon': ally(c, op, x + dx * 1.5, z + dz * 1.5, op === 'turret' ? 12 : 10, .3, 0); look(c, x, z, 2.2, 0, 'poof'); break;
    case 'hook': { const t = c.nearest(14); if (!t) return false; look(c, x, z, len(t.x - x, t.z - z), Math.atan2(t.x - x, t.z - z), 'hook'); job(c, .25, 'pull', 0, 0, 0, 0, 0, 0, '', t); break; }
    case 'parrot': { const list = c.host.targets(); for (let i = 0; i < list.length; i++) { const e = list[i]; if (alive(e) && len(e.x - x, e.z - z) < 12 + e.radius) { e.mark = 8; c.damage(e, .5); look(c, e.x, e.z, 1, 0, 'blast'); } } look(c, x, z, 2, 0, 'parrot'); ally(c, 'parrot', x, z, 8, 99, 0); break; }
    case 'missiles': { const list = c.host.targets(); let n = 0; for (let i = 0; i < list.length && n < 6; i++) { const e = list[i]; if (alive(e) && len(e.x - x, e.z - z) < 16 + e.radius) job(c, n++ * .15, 'rocket', 0, 0, 0, 0, 0, 0, id === 'dz_army' ? 'rocket' : 'missile', e); } if (!n) return false; break; }
    case 'cannons': { const t = c.nearest(14), tx = t ? t.x : x, tz = t ? t.z : z; for (let i = 0; i < 12; i++) { const a = c.random() * TAU, r = c.random() * 4, qx = tx + Math.cos(a) * r, qz = tz + Math.sin(a) * r; job(c, i * .15, 'fall', qx, qz, 0, 0, 0, 0, ''); job(c, i * .15 + .5, 'area', qx, qz, 2, 1.5, .5, 1, 'blast'); } break; }
    case 'decoy': { const qx = x + dx * 2.5, qz = z + dz * 2.5; ally(c, 'snow', qx, qz, 6, 99, 0); const list = c.host.targets(); for (let i = 0; i < list.length; i++) { const e = list[i]; if (alive(e) && len(e.x - qx, e.z - qz) < 8) status(c, e, 'blind', 6); } look(c, qx, qz, 2, 0, 'poof'); job(c, 6, 'area', qx, qz, 4, 2.5, 2, 0, 'iceage'); break; }
    case 'icefloor': look(c, x, z, 6, 0, 'icefield'); job(c, 0, 'rink', x, z, 0, 0, 0, 0, '', null, 16, .5); break;
    case 'iceage': look(c, x, z, 8, 0, 'iceage'); area(c, x, z, 8, .3, 3, 0, null); job(c, 3, 'puls', 0, 0, 8, 2.8, 1, 0, 'freeze'); break;
    default: return false;
  }
  return true;
}

function skill(index) {
  const id = this.host.special?.();
  if (!KITS[id]) { this.kit = false; return baseSkill.call(this, index); }
  if (this.mode || index < 0 || index > 3 || this.cooldowns[index] > 0) return false;
  const info = kitInfo(id, index); this.aim();
  if (!cast(this, id, index, info)) return false;
  this.kit = true; this.sid = info.sid; this.spans[index] = this.cooldowns[index] = info.cd * (this.host.cooldownScale?.() ?? 1);
  return true;
}
function damage(target, power, stun = 0, lift = 0, knock = 0) {
  const d = this.d; let steal = 0;
  if (d) {
    if (d.giant > 0) power *= 1.6; if (d.stealth > 0) { power *= 3; d.stealth = 0; } if (target.mark > 0) power *= 1.5;
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
function tick(dt) {
  baseTick.call(this, dt); const c = this; if (!c.dj) return;
  for (let i = 0; i < JOBS; i++) { const j = c.dj[i]; if (j.live && j.at <= c.time) run(c, j); }
  const d = c.d, p = c.host.position(); let any = false;
  for (const k in d) if (d[k] > 0) { d[k] = Math.max(0, d[k] - dt); any = true; }
  if (d.giant > 0) { c.gstep -= dt; if (c.gstep <= 0 && len(p.x - c.lx, p.z - c.lz) > .2) { c.gstep = .45; area(c, p.x, p.z, 2.5, .7, 0, 0, 'crater', 2); } c.lx = p.x; c.lz = p.z; }
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
      for (let s = 0; s < 5; s++) {
        const k = STATES[s]; if (!(e[k] > 0)) continue; e[k] -= dt; e.stun = Math.max(e.stun || 0, .12);
        if (k === 'fear') push(e, e.x - p.x, e.z - p.z, 2.2); else if (k === 'taunt') { if (len(e.x - p.x, e.z - p.z) > 2.5) push(e, p.x - e.x, p.z - e.z, 1.6); }
        else if (k === 'blind') { const a = c.time * 2 + e.x; push(e, Math.sin(a), Math.cos(a), 1.2); }
        else if (k === 'charm') { const o = nearestTo(c, e.x, e.z, 8, e); if (o && o !== e) { const dd = len(o.x - e.x, o.z - e.z); if (dd > e.radius + o.radius + .3) push(e, o.x - e.x, o.z - e.z, 2.4); else if ((e.cb = (e.cb || 0) - dt) <= 0) { e.cb = .7; c.damage(o, .5, .1); look(c, o.x, o.z, 1, 0, 'blast'); } } }
        if ((e.sl = (e.sl || 0) - dt) <= 0) { e.sl = .6; look(c, e.x, e.z, e.radius, 0, STLOOK[k]); }
      }
    }
  }
  // allies
  for (let i = 0; i < ALLIES; i++) {
    const a = c.al[i]; if (!a.live) continue; a.life -= dt; a.cd -= dt; if (a.life <= 0) { a.live = false; continue; }
    if (a.kind === 'bat') { a.x = p.x + Math.cos(c.time * 3 + a.orbit) * 2.2; a.z = p.z + Math.sin(c.time * 3 + a.orbit) * 2.2; }
    if (a.kind === 'snow' || a.kind === 'parrot') continue;
    const t = nearestTo(c, a.x, a.z, 13); if (!t) continue;
    const dist = len(t.x - a.x, t.z - a.z), ang = Math.atan2(t.x - a.x, t.z - a.z); a.f = ang;
    if (a.kind === 'clone' && dist > 1.3) { const st = Math.min(dist - 1.2, dt * 8); a.x += Math.sin(ang) * st; a.z += Math.cos(ang) * st; }
    if (a.cd > 0) continue;
    if (a.kind === 'turret' || a.kind === 'cannon') { shotAt(c, a.x, a.z, ang, a.kind === 'turret' ? .65 : 1.2, 14, a.kind === 'turret' ? 'volt' : 'cannonball', { speed: 17, blast: a.kind === 'cannon' ? 2 : 0 }); a.cd = a.kind === 'turret' ? .5 : .8; }
    else if (dist < t.radius + 1.6) { c.damage(t, a.kind === 'bat' ? .35 : .6, .1); a.cd = .7; look(c, a.x, a.z, 1.4, ang, 'swing'); if (a.kind === 'bat') heal(c, .01); }
  }
  // shots that grow (snowball) or home (rockets)
  for (let i = 0; i < c.shots.length; i++) {
    const s = c.shots[i]; if (!s.live) continue;
    if (s.grow) s.radius = Math.min(2.6, s.radius + .9 * dt);
    const h = s.home; if (h) { if (alive(h)) { const want = Math.atan2(h.x - s.x, h.z - s.z), now = Math.atan2(s.dx, s.dz), turn = Math.max(-dt * 5, Math.min(dt * 5, Math.atan2(Math.sin(want - now), Math.cos(want - now)))); s.dx = Math.sin(now + turn); s.dz = Math.cos(now + turn); } }
  }
}
export function install() {
  const P = Combat.prototype; if (P.skill === skill) return;
  baseSkill = P.skill; baseDamage = P.damage; baseReset = P.reset; baseTick = P.tick; baseShoot = P.shoot;
  P.shoot = function (a, pw, r, k) { const s = baseShoot.call(this, a, pw, r, k); s.grow = 0; s.home = null; return s; };
  P.skill = skill; P.damage = damage; P.reset = reset; P.tick = tick;
  Object.defineProperty(P, 'invulnerable', { configurable: true, get() { const d = this.d; return this.mode === 'dash' || !!d && (d.shield > 0 || d.stealth > 0 || d.bats > 0 || d.flight > 0); } });
  Object.defineProperty(P, 'taken', { configurable: true, get() { const d = this.d; return !d ? 1 : (d.armor > 0 ? .43 : 1) * (d.giant > 0 ? .75 : 1); } });
}
export { distanceToSegment };
