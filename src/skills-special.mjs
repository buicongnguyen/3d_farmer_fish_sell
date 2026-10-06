// The fourth skill and the words of all four (fetched with the box, never in the first load: box-draw.mjs). Ported from Zoo Garden
// (cute_game src/combat.ts special(), skill-info.ts SPECIAL_INFO and SPECIALS, skill-sounds.ts): each weapon carries a `special`
// (gear.mjs) and a few uniforms replace it while worn (uniform-skills.ts); the numbers below are the reference's. Pure like combat.mjs:
// no three.js, no DOM. install() puts special(), dash() and tick() on Combat's prototype; a cast runs through a fixed pool of delayed
// jobs, and its shots are Combat's own pooled shots, so nothing is created while a fight runs. What it looks like is skill-looks.mjs,
// asked through host.effect('look', x, z, radius, facing, name).
import { SKILLS, TUNING, distanceToSegment } from './combat.mjs';
import { weaponOf } from './gear.mjs';
import { t } from './i18n.mjs';

/** name, icon, cooldown, damage factor, radius where it has one, sound, how the hero casts it (s swing, a aim, w arms out), text. */
export const SPECIALS = {
  fist: { name: 'Punch flurry', icon: '👊', cd: 6, damage: .8, radius: 1.8, sound: 'punch', pose: 's', text: 'Six quick punches in 0.8 s, each ×{dmg} damage in a 1.8 m arc ahead.' },
  crescent: { name: 'Crescent slash', icon: '🌙', cd: 6, damage: 2.4, radius: 3.8, sound: 'swing', pose: 's', text: 'One wide 3.8 m half-circle slash ahead for ×{dmg} damage.' },
  gore: { name: 'Tusk rush', icon: '🐗', cd: 7, damage: 2, sound: 'swing', pose: 's', text: 'Charge 10 m forward, untouchable, goring every enemy on the way for ×{dmg} damage.' },
  wave: { name: 'Blade waves', icon: '🌊', cd: 6, damage: 2, sound: 'swing', pose: 's', text: 'Three piercing blade waves fly 12 m, ×{dmg} damage to everything they pass.' },
  tsunami: { name: 'Wave fan', icon: '🌊', cd: 9, damage: 1.6, sound: 'splash', pose: 's', text: 'Five piercing waves in a wide fan fly 13 m, ×{dmg} damage each.' },
  peastorm: { name: 'Pea barrage', icon: '🟢', cd: 8, damage: .8, sound: 'shoot', pose: 'a', text: 'Spray 14 peas ahead in one second, ×{dmg} damage each.' },
  bigbubble: { name: 'Bubble prison', icon: '🫧', cd: 10, damage: 1.2, sound: 'pop', pose: 'a', text: 'A big bubble flies 11 m: the first enemy hit takes ×{dmg} damage and is trapped for 3 s.' },
  nova: { name: 'Thorn nova', icon: '🌵', cd: 9, damage: 1.1, sound: 'shoot', pose: 'w', text: '24 thorns burst out all around you to 8 m, ×{dmg} damage each.' },
  blizzard: { name: 'Blizzard', icon: '❄️', cd: 9, damage: 1, sound: 'freeze', pose: 'w', text: '24 ice shards burst out all around you to 9 m: ×{dmg} damage and frozen for 1.5 s.' },
  magma: { name: 'Magma pillars', icon: '🌋', cd: 8, damage: 1.5, radius: 1.6, sound: 'boom', pose: 's', text: 'Five lava pillars erupt in a line 8.5 m ahead: ×{dmg} damage within 1.6 m of each.' },
  thunder: { name: 'Thunder chain', icon: '⚡', cd: 9, damage: 2.4, sound: 'zap', pose: 's', text: 'Lightning chains through up to 6 enemies within 10 m: ×{dmg} damage and stunned for 2 s.' },
  bonk: { name: 'Giant bonk', icon: '🔨', cd: 7, damage: 2.2, radius: 3.6, sound: 'boom', pose: 's', text: 'A giant hammer blow just ahead: ×{dmg} damage within 3.6 m, stunned for 3 s.' },
  whirl: { name: 'Moon cyclone', icon: '🌪️', cd: 8, damage: 1.4, radius: 4.4, sound: 'swing', pose: 'w', text: 'Three cyclone pulses around you: ×{dmg} damage within 4.4 m each.' },
  starfall: { name: 'Starfall', icon: '🌠', cd: 9, damage: 1.1, radius: 1.6, sound: 'magic', pose: 'a', text: '12 stars fall around the nearest enemy, ×{dmg} damage within 1.6 m of each.' },
  inferno: { name: 'Inferno ring', icon: '🔥', cd: 9, damage: 1.3, radius: 1.8, sound: 'boom', pose: 'w', text: 'A ring of 10 fire bursts 3.6 m around you, ×{dmg} damage within 1.8 m of each.' },
  laser: { name: 'Rainbow laser', icon: '🌈', cd: 8, damage: 3, sound: 'zap', pose: 'a', text: 'A 14 m rainbow beam straight ahead: ×{dmg} damage to everything in the line.' },
  volley: { name: 'Rifle volley', icon: '🔫', cd: 7, damage: .7, sound: 'shoot', pose: 'a', text: 'Ten rapid shots fly 15 m ahead in one second, ×{dmg} damage each.' },
  anchor: { name: 'Anchor swing', icon: '⚓', cd: 8, damage: 2, radius: 4.4, sound: 'boom', pose: 's', text: 'Swing a heavy anchor all around you: ×{dmg} damage within 4.4 m, knocked back.' },
  lotus: { name: 'Lotus petals', icon: '🪷', cd: 9, damage: .8, sound: 'magic', pose: 'w', text: 'Twelve lotus petals burst out all around you to 8 m, ×{dmg} damage each, and you heal 8% health.' },
  dragon: { name: 'Dragon fan', icon: '🐉', cd: 8, damage: 1.3, sound: 'swing', pose: 's', text: 'Seven waves in a wide fan fly 12 m, ×{dmg} damage each.' },
  eagle: { name: 'Eagle strike', icon: '🦅', cd: 8, damage: 1.8, radius: 3, sound: 'swing', pose: 's', text: 'Dive forward 9 m, hitting enemies on the way for ×2.4, then land in a burst: ×{dmg} damage within 3 m.' },
  goldstar: { name: 'Golden star burst', icon: '⭐', cd: 9, damage: 1.4, radius: 2.6, sound: 'magic', pose: 'w', text: 'Five piercing gold stars fly 11 m, ×{dmg} damage each, with a 2.6 m burst around you.' },
};
/** A uniform in the costume slot replaces the weapon's special while worn (the reference's uniform-skills.ts). */
export const UNIFORM_SPECIAL = { armor_army: 'volley', armor_navy: 'anchor', armor_aodai: 'lotus', armor_aodai_man: 'dragon', armor_usa: 'eagle', armor_vietnam: 'goldstar' };
/** The special in force for a save: the worn uniform's, else the weapon's, else the punch flurry. */
export function specialOf(s) { const u = UNIFORM_SPECIAL[s?.gear?.wear]; if (u) return u; const w = weaponOf(s).special; return SPECIALS[w] ? w : 'fist'; }

const fix = n => String(Math.round(n * 100) / 100);
/** The reference's own wording for the first three (skill-info.ts skillDescription), with the numbers of combat.mjs's TUNING. */
const BASE_TEXT = [
  () => t('Spin for 2.2 s: 10 hits of ×{dmg} damage on every enemy within {r} m.', { dmg: fix(TUNING.whirl.power), r: fix(TUNING.whirl.radius) }),
  () => t('Rush {d} m forward, untouchable, striking each enemy on the way once for ×{dmg} damage.', { d: fix(TUNING.dash.speed * TUNING.dash.time), dmg: fix(TUNING.dash.power) }),
  () => t('Leap and land a {r} m shockwave: ×{dmg} damage, enemies thrown up and stunned 0.8 s.', { r: fix(TUNING.slam.radius), dmg: fix(TUNING.slam.power) }),
];
/** The long tip of slot `index` (the title of its button): "Name · 7 s cooldown — what it does". */
export function skillTip(index, id) {
  const sp = SPECIALS[id] ?? SPECIALS.fist, name = index === 3 ? sp.name : SKILLS[index].name, cd = index === 3 ? sp.cd : SKILLS[index].cd;
  return `${t(name)} · ${t('{cd} s cooldown', { cd })} — ${index === 3 ? t(sp.text, { dmg: fix(sp.damage) }) : BASE_TEXT[index]()}`;
}

// ---------------------------------------------------------------- casting
const JOBS = 48, TAU = Math.PI * 2;
const len = (x, z) => Math.sqrt(x * x + z * z);
const alive = e => e.hp > 0 && !(e.leaving > 0);
/** Shot kinds that are not the plain 19 m/s pea: speed, radius, lift, pierce (the reference's shoot()). */
const SHOTS = { wave: { speed: 13, pierce: true }, dragon: { speed: 13, pierce: true }, bigbubble: { speed: 7, radius: .8, lift: 3 }, star: { pierce: true } };

function job(c, delay, op, x, z, a, b, k, target, stun = 0, lift = 0) {
  let j = null; for (let i = 0; i < c.jobs.length; i++) if (!c.jobs[i].live) { j = c.jobs[i]; break; }
  if (!j) { j = c.jobs[0]; for (let i = 1; i < c.jobs.length; i++) if (c.jobs[i].at < j.at) j = c.jobs[i]; } // full: the oldest goes
  j.live = true; j.at = c.time + delay; j.op = op; j.x = x; j.z = z; j.a = a; j.b = b; j.k = k; j.t = target ?? null; j.stun = stun; j.lift = lift;
}
/** A hit zone with a look: the damage of Combat.area without its white ring. */
function zone(c, x, z, radius, power, stun, lift, look, knock = 1.2) {
  c.host.effect('look', x, z, radius, c.host.facing(), look);
  const list = c.host.targets();
  for (let i = 0; i < list.length; i++) { const e = list[i]; if (alive(e) && len(e.x - x, e.z - z) <= radius + e.radius) c.damage(e, power, stun, lift, knock); }
}
function shot(c, angle, power, range, kind) {
  const s = c.shoot(angle, power, range, kind), k = SHOTS[kind];
  if (k) { s.speed = k.speed ?? 0; s.radius = k.radius ?? 0; s.lift = k.lift ?? 0; s.pierce = !!k.pierce; }
  return s;
}
function run(c, j) {
  const p = c.host.position();
  switch (j.op) {
    case 'zone': zone(c, j.x, j.z, j.a, j.b, j.stun, j.lift, j.k); break;
    case 'pulse': zone(c, p.x, p.z, j.a, j.b, .2, 0, j.k); break;
    case 'shot': shot(c, j.a + (j.x ? (c.random() - .5) * j.x : 0), j.b, j.z, j.k); break;
    case 'punch': c.aim(c.nearest(2.6)); c.host.effect('look', p.x, p.z, 1.8, c.host.facing(), 'fist'); c.arc(1.8, .8, .5, null, 1.2); break;
    case 'meteor': c.host.effect('look', j.x, j.z, 1.6, 0, 'meteor'); break;
    case 'bolt': { const e = j.t; if (!alive(e)) break; c.host.effect('look', j.x, j.z, len(e.x - j.x, e.z - j.z), Math.atan2(e.x - j.x, e.z - j.z), 'bolt'); c.host.effect('impact', e.x, e.z, 1, 0, 0); c.damage(e, 2.4, 2, 0, 1.2); break; }
  }
}
function zoneJob(c, delay, x, z, r, power, stun, lift, look) { job(c, delay, 'zone', x, z, r, power, look, null, stun, lift); }

/** Casts the special `id`; sets cooldowns[3]. Always true: every id falls back to the punch flurry. */
function special(id) {
  const def = SPECIALS[id] ?? SPECIALS.fist; id = SPECIALS[id] ? id : 'fist';
  if (!this.jobs) this.jobs = Array.from({ length: JOBS }, () => ({ live: false, at: 0, op: '', x: 0, z: 0, a: 0, b: 0, k: null, t: null, stun: 0, lift: 0 }));
  const p = this.host.position(), x = p.x, z = p.z, angle = this.aim(), dx = Math.sin(angle), dz = Math.cos(angle), P = def.damage;
  this.sid = id;
  switch (id) {
    case 'fist': for (let i = 0; i < 6; i++) job(this, i * .14, 'punch', 0, 0, 0, 0, null); break;
    case 'crescent': this.host.effect('look', x, z, 3.8, angle, 'crescent'); this.arc(3.8, P, -.05, null, 1.2); break;
    case 'gore': this.rush(2, 28, .36, angle, 'rush'); break;
    case 'wave': this.host.effect('look', x, z, 10, angle, 'surf'); for (const o of [-.28, 0, .28]) shot(this, angle + o, P, 12, 'wave'); break;
    case 'tsunami': this.host.effect('look', x, z, 13, angle, 'surf'); for (const o of [-.5, -.25, 0, .25, .5]) shot(this, angle + o, P, 13, 'wave'); break;
    case 'dragon': this.host.effect('look', x, z, 8, angle, 'dragon'); for (const o of [-.45, -.3, -.15, 0, .15, .3, .45]) shot(this, angle + o, P, 12, 'dragon'); break;
    case 'peastorm': for (let i = 0; i < 14; i++) job(this, i * .07, 'shot', .9, 11, angle, P, 'pea'); break;
    case 'volley': for (let i = 0; i < 10; i++) job(this, i * .06, 'shot', .14, 15, angle, P, 'pea'); break;
    case 'bigbubble': shot(this, angle, P, 11, 'bigbubble').stun = 3; break;
    case 'nova': case 'blizzard': this.host.effect('look', x, z, id === 'nova' ? 8 : 9, angle, id); for (let i = 0; i < 24; i++) shot(this, i * Math.PI / 12, P, id === 'nova' ? 8 : 9, id === 'nova' ? 'spike' : 'ice'); break;
    case 'lotus': this.host.effect('look', x, z, 3, angle, 'lotus'); for (let i = 0; i < 12; i++) shot(this, i * Math.PI / 6, P, 8, 'lotus'); this.host.heal?.(.08); break;
    case 'goldstar': this.host.effect('look', x, z, 2.6, angle, 'goldstar'); for (let i = 0; i < 5; i++) shot(this, angle + i * TAU / 5, P, 11, 'star'); zoneJob(this, .1, x, z, 2.6, 1.2, .3, 1.5, 'goldstar'); break;
    case 'anchor': this.host.effect('look', x, z, 4.4, angle, 'anchor'); zoneJob(this, .15, x, z, 4.4, P, .4, 3, 'anchor'); break;
    case 'eagle': this.rush(2.4, 30, .3, angle, 'eagle'); zoneJob(this, .3, x + dx * 9, z + dz * 9, 3, P, .5, 2, 'eagle'); break;
    case 'magma': for (let i = 1; i <= 5; i++) zoneJob(this, i * .09, x + dx * i * 1.7, z + dz * i * 1.7, 1.6, P, .5, 1.8, 'magma'); break;
    case 'bonk': this.host.effect('look', x + dx * 1.6, z + dz * 1.6, 3.6, angle, 'swing'); zoneJob(this, .12, x + dx * 1.6, z + dz * 1.6, 3.6, P, 3, 2, 'bonk'); break;
    case 'whirl': for (let i = 0; i < 3; i++) job(this, i * .22, 'pulse', 0, 0, 4.4, P, 'whirl'); break;
    case 'inferno': for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5; zoneJob(this, i * .05, x + Math.cos(a) * 3.6, z + Math.sin(a) * 3.6, 1.8, P, .2, 1.2, 'inferno'); } break;
    case 'starfall': {
      const e = this.nearest(13), cx = e ? e.x : x + dx * 6, cz = e ? e.z : z + dz * 6;
      for (let i = 0; i < 12; i++) { const a = this.random() * TAU, r = this.random() * 3.6, sx = cx + Math.cos(a) * r, sz = cz + Math.sin(a) * r; job(this, i * .09, 'meteor', sx, sz, 0, 0, null); zoneJob(this, i * .09 + .22, sx, sz, 1.6, P, .2, 0, 'blast'); }
      break;
    }
    case 'thunder': {
      const list = this.host.targets(), near = []; for (let i = 0; i < list.length; i++) { const e = list[i]; if (alive(e) && len(e.x - x, e.z - z) < 10 + e.radius) near.push(e); }
      near.sort((a, b) => len(a.x - x, a.z - z) - len(b.x - x, b.z - z)); if (near.length > 6) near.length = 6;
      for (let i = 0; i < near.length; i++) job(this, i * .09, 'bolt', i ? near[i - 1].x : x, i ? near[i - 1].z : z, 0, 0, null, near[i]);
      break;
    }
    case 'laser': {
      this.host.effect('look', x, z, 14, angle, 'laser'); const ex = x + dx * 14, ez = z + dz * 14, list = this.host.targets();
      for (let i = 0; i < list.length; i++) { const e = list[i]; if (alive(e) && distanceToSegment(e.x, e.z, x, z, ex, ez) < e.radius + .7) this.damage(e, P, .4, 0, 2); }
      break;
    }
  }
  this.spans[3] = this.cooldowns[3] = def.cd * (this.host.cooldownScale?.() ?? 1);
  return true;
}
/** A rush for a special: another speed and power, ended by Combat.update like the base dash. */
function rush(power, speed, time, angle, look) {
  const p = this.host.position(); this.mode = 'dash'; this.modeStart = this.time; this.modeUntil = this.time + time; this.dirX = Math.sin(angle); this.dirZ = Math.cos(angle); this.struck.clear();
  this.dashing = { speed, power, width: TUNING.dash.width, stun: TUNING.dash.stun, knock: TUNING.dash.knock };
  this.host.effect('look', p.x, p.z, 2, angle, look);
}
function tick() {
  if (!this.jobs) return;
  for (let i = 0; i < this.jobs.length; i++) { const j = this.jobs[i]; if (j.live && j.at <= this.time) { j.live = false; run(this, j); } }
}
/** Puts the fourth skill onto Combat. */
export function install(Combat) { Combat.prototype.special = special; Combat.prototype.rush = rush; Combat.prototype.tick = tick; }
