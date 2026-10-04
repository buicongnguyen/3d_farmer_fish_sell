// The titans' skill patterns (round 8; owner: builder D2). Pure (no Three.js, no DOM).
//
// Part 1 is Zoo Garden's src/titan-patterns.ts:1-63 with the types stripped and every number unchanged: the ten skills'
// wind-ups, colours and callouts, the marks a wind-up shows (titanTelegraphs) and what the attack then does, step by step
// (beginTitanAttack, stepTitanAttack). sanitizeTitanAttacks (:65-83) is not ported: it is for online play. Two things differ:
// TITAN_MOVE_SETS is built from titans.mjs TITAN_ROWS, and a mark made from the caster ({...source, r}) copies only its x and z
// (the reference spreads its whole enemy into the mark; here the caster is a simulation creature with forty fields).
//
// Part 2 is Willowmere's: titanSkill (the reference's bossSkill rule, boss-patterns.ts:30-34, for a list handed in) and
// titanTurn, a titan's whole turn inside wilds.mjs (Wilds.titanStep calls it), after world.ts:1281-1318 and :1347-1350,
// with the three things the spec adds (4.3): the hard leash, the clamped leap, and a summon that does not stack.
import { TITAN_ROWS } from './titans.mjs';
import { regionAt } from './regions.mjs';
import { hyp } from './hyp.mjs';

// ================================================================ part 1: the port
export const TITAN_WINDUPS = Object.freeze({ sweep: 1.3, pull: 1.1, lines: 1.2, bombard: 1.3, leap: 1, donut: 1.6, orbs: 1, pools: 1.2, summon: 1.1, stomp4: 1 });
export const TITAN_COLORS = Object.freeze({ sweep: '#ff3bd0', pull: '#8a5aff', lines: '#ff7a1f', bombard: '#ff3b3b', leap: '#ffb13d', donut: '#ff2a2a', orbs: '#b06aff', pools: '#7fff5a', summon: '#ffe14d', stomp4: '#ff5a3b' });
export const TITAN_CALLOUTS = Object.freeze({ sweep: '⚠️ SWEEPING BEAM', pull: '⚠️ BLACK HOLE', lines: '⚠️ SEISMIC RAYS', bombard: '⚠️ BOMBARDMENT', leap: '⚠️ LEAP CRUSH', donut: '⚠️ DEATH RING — STAY CLOSE!', orbs: '⚠️ HOMING ORBS', pools: '⚠️ POISON POOLS', summon: '⚠️ SUMMON', stomp4: '⚠️ REPEATED STOMPS' });
/** How long each attack runs after its wind-up, in seconds. */
export const TITAN_LIFE = Object.freeze({ sweep: 2.2, pull: 1.35, lines: 1.2, bombard: 2.3, leap: .8, donut: .35, orbs: 7, pools: 7, summon: .3, stomp4: 1.3 });
export const TITAN_MOVE_SETS = Object.freeze(Object.fromEntries(Object.entries(TITAN_ROWS).map(([id, d]) => [id, d.skills])));
export const isTitanSkill = skill => !!skill && Object.hasOwn(TITAN_WINDUPS, skill);
const distance = (a, b) => hyp(a.x - b.x, a.z - b.z);
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
/**
 * The marks of a wind-up: [{x, z, r, delay, k?, a?, safe?}]. source {x, z, radius, facing}; target {x, z}; targets [{id, x, z}]
 * (those within 30 m get a mark of their own for bombard, pools and the stomps); `random` is seeded by the caller.
 */
export function titanTelegraphs(skill, source, target, targets = [], random = Math.random) {
  const delay = TITAN_WINDUPS[skill], marks = [], near = targets.filter(p => distance(p, source) < 30);
  const add = (x, z, r, extra = {}) => marks.push({ x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100, r, delay, ...extra });
  if (skill === 'sweep') { const a = Math.atan2(target.x - source.x, target.z - source.z) - 1.75; for (let n = 1; n <= 8; n++) add(source.x + Math.sin(a) * (source.radius + n * 2), source.z + Math.cos(a) * (source.radius + n * 2), 1.2, { a }); }
  if (skill === 'pull') add(source.x, source.z, source.radius + 4);
  if (skill === 'lines') for (let i = 0; i < 6; i++) { const a = source.facing + i / 6 * Math.PI * 2; for (let k = 1; k <= 7; k++) add(source.x + Math.sin(a) * (source.radius + k * 2.3), source.z + Math.cos(a) * (source.radius + k * 2.3), 1.3, { k }); }
  if (skill === 'bombard') { for (const p of near) add(p.x, p.z, 2.4, { k: 0 }); for (let i = 0; i < 14; i++) { const a = random() * Math.PI * 2, r = source.radius + 2 + random() * 16; add(source.x + Math.sin(a) * r, source.z + Math.cos(a) * r, 2.4, { k: 1 + i % 4 }); } }
  if (skill === 'leap') add(target.x, target.z, 6.5);
  if (skill === 'donut') { add(source.x, source.z, source.radius + 11); add(source.x, source.z, source.radius + 1.5, { safe: true }); }
  if (skill === 'orbs') add(source.x, source.z, source.radius + 1);
  if (skill === 'pools') { for (const p of near) add(p.x, p.z, 2.8); while (marks.length < 5) { const a = random() * Math.PI * 2, r = source.radius + 3 + random() * 9; add(source.x + Math.sin(a) * r, source.z + Math.cos(a) * r, 2.8); } }
  if (skill === 'summon') add(source.x, source.z, source.radius + 2);
  if (skill === 'stomp4') for (let k = 0; k < 4; k++) { const p = near[k % Math.max(1, near.length)] ?? target; add(p.x + (random() - .5) * 2, p.z + (random() - .5) * 2, 3.6, { delay: delay + k * .35, k }); }
  return marks;
}
/** An attack as it starts: {skill, age, life, origin, facing, radius, marks, fired, nextHit, orbs}. */
export function beginTitanAttack(skill, source, marks, targets) {
  const orbs = skill === 'orbs' ? Array.from({ length: 5 }, (_, i) => { const a = source.facing + i * Math.PI * 2 / 5; return { x: source.x + Math.sin(a) * source.radius, z: source.z + Math.cos(a) * source.radius, vx: Math.sin(a) * 6, vz: Math.cos(a) * 6, targetId: targets.length ? targets[i % targets.length].id : undefined, done: false }; }) : [];
  return { skill, age: 0, life: TITAN_LIFE[skill], origin: { x: source.x, z: source.z }, facing: source.facing, radius: source.radius, marks: marks.map(p => ({ ...p })), fired: [], nextHit: {}, orbs };
}
/**
 * One fixed step of an attack: {hits: [{id, multiplier, source}], pulls: [{id, x, z}], bursts: [mark], summon, move?, done}.
 * All delayed attacks pause with the world and die with their caster. `source` is where the caster is now ({x, z}).
 */
export function stepTitanAttack(a, dt, source, targets) {
  const out = { hits: [], pulls: [], bursts: [], summon: false, done: false }; if (!(dt > 0) || !Number.isFinite(dt) || a.age >= a.life) { out.done = a.age >= a.life; return out; }
  a.age = Math.min(a.life, a.age + dt);
  const here = (r) => ({ x: source.x, z: source.z, r, delay: 0 });
  const hit = (p, multiplier, kind = 'melee', key = '', period = 0) => { const k = key + ':' + p.id; if (period && (a.nextHit[k] ?? -1) > a.age) return; if (period) a.nextHit[k] = a.age + period; out.hits.push({ id: p.id, multiplier, source: kind }); };
  const once = (index, time, fn) => { if (!a.fired.includes(index) && a.age >= time) { a.fired.push(index); fn(); } };
  const area = (p, multiplier, kind = 'melee', inner = 0) => { out.bursts.push(p); for (const target of targets) { const d = distance(p, target); if (d < p.r && (inner === 0 || d > inner)) hit(target, multiplier, kind); } };
  if (a.skill === 'sweep') { const angle = (a.marks[0]?.a ?? a.facing) + a.age / 2.2 * 3.5; for (const p of targets) { const d = distance(source, p), delta = wrap(Math.atan2(p.x - source.x, p.z - source.z) - angle); if (d < a.radius + 17 && Math.abs(delta) < .16 + 1 / Math.max(3, d)) hit(p, .9, 'shot', 'beam', .45); } }
  if (a.skill === 'pull') { for (const p of targets) { const d = distance(source, p); if (!p.airborne && d < a.radius + 16 && d > a.radius + .5) { const step = Math.max(0, Math.min(d - a.radius, dt * (9 - d * .25))); out.pulls.push({ id: p.id, x: (source.x - p.x) / d * step, z: (source.z - p.z) / d * step }); } } once(0, 1.3, () => area(here(a.radius + 4.5), 1.8)); }
  if (a.skill === 'lines') a.marks.forEach((p, i) => once(i, .06 + (p.k ?? 0) * .11, () => area({ ...p, r: p.r + .2 }, 1.2)));
  if (a.skill === 'bombard') a.marks.forEach((p, i) => once(i, .45 + (p.k ?? 0) * .38, () => area(p, 1.3, 'hazard')));
  if (a.skill === 'leap') { const p = a.marks[0] ?? { ...a.origin, r: 6.5, delay: 0 }, f = a.age / .8; out.move = { x: a.origin.x + (p.x - a.origin.x) * f, z: a.origin.z + (p.z - a.origin.z) * f, y: Math.sin(f * Math.PI) * 8 }; once(0, .8, () => { out.bursts.push(p); for (const t of targets) { const d = distance(p, t); if (d < p.r) hit(t, d < 3 ? 2.2 : 1.5); } }); }
  if (a.skill === 'donut') once(0, 0, () => area(here(a.radius + 11), 1.7, 'hazard', a.radius + 1.5));
  if (a.skill === 'summon') once(0, 0, () => { out.summon = true; out.bursts.push(here(a.radius + 2)); });
  if (a.skill === 'stomp4') a.marks.forEach((p, i) => once(i, .06 + (p.k ?? i) * .35, () => area(p, 1.4)));
  if (a.skill === 'pools' && a.age >= .4) for (let i = 0; i < a.marks.length; i++) { const p = a.marks[i]; for (const t of targets) if (distance(p, t) < p.r) hit(t, .3, 'hazard', 'pool' + i, .5); }
  if (a.skill === 'orbs') for (const orb of a.orbs) {
    if (orb.done) continue; const target = targets.find(t => t.id === orb.targetId);
    if (target) { const d = distance(orb, target); if (d < 1.3) { hit(target, 1.2, 'shot'); orb.done = true; continue; } const acceleration = a.age < .6 ? 4 : 11; orb.vx += (target.x - orb.x) / d * acceleration * dt; orb.vz += (target.z - orb.z) / d * acceleration * dt; const speed = hyp(orb.vx, orb.vz); if (speed > 7.5) { orb.vx *= 7.5 / speed; orb.vz *= 7.5 / speed; } }
    const from = { x: orb.x, z: orb.z }; orb.x += orb.vx * dt; orb.z += orb.vz * dt;
    if (target) { const dx = orb.x - from.x, dz = orb.z - from.z, len = dx * dx + dz * dz, f = len ? Math.max(0, Math.min(1, ((target.x - from.x) * dx + (target.z - from.z) * dz) / len)) : 0; if (hyp(target.x - from.x - dx * f, target.z - from.z - dz * f) < 1.3) { hit(target, 1.2, 'shot'); orb.done = true; } }
  }
  out.done = a.age >= a.life; return out;
}

// ================================================================ part 2: Willowmere's
/**
 * Which skill an attack is, or null for a plain strike (the reference's bossSkill, boss-patterns.ts:30-34, for a list handed in):
 * attackCount is one-based; skillCount is how many skills were used before. A skill when health is under 30 %, or the count is
 * even, or health is under 50 % and count % 3 is not 1; the skills go round the list in order.
 */
export function titanSkill(skills, attackCount, hpFraction, skillCount) {
  if (!skills?.length) return null;
  const special = hpFraction < .3 || attackCount % 2 === 0 || hpFraction < .5 && attackCount % 3 !== 1;
  return special ? skills[Math.max(0, skillCount) % skills.length] : null;
}
/** The reference's generator for a wind-up's marks (world.ts:107), seeded with attackCount x 91571 (world.ts:1315). */
export const seeded = seed => () => { seed = Math.imul(seed ^ seed >>> 15, 1 | seed); seed ^= seed + Math.imul(seed ^ seed >>> 7, 61 | seed); return ((seed ^ seed >>> 14) >>> 0) / 4294967296; };
/**
 * trigger: a wind-up may start whenever the target is within 24 m (world.ts:1452). leashMargin: see titanLimit. recover: after a skill (world.ts:1349) and after a leap (:1293).
 * summon: up to four creatures within 60 m, at 1.3 x their damage. bursts: what the view has not drawn yet is capped.
 */
export const TITAN = Object.freeze({ trigger: 24, leashMargin: .65, recover: .7, leapRecover: .5, leapTime: .8, summon: 4, summonRange: 60, summonBoost: 1.3, bursts: 24, strikeReach: .6 });
const len = (x, z) => Math.sqrt(x * x + z * z);
/**
 * How far from its den a titan's centre may be by its own steps and its leap: the den's `leash` less its own radius and 0.65 m.
 * wilds.mjs pushes a creature out of the player's circle after it has thought, by at most its radius and the player's 0.4 m:
 * so a titan the player walks into still ends the step inside its leash, and its far edge never passes it by its own doing.
 */
export const titanLimit = e => e.leash - e.radius - TITAN.leashMargin;
/** The titan's own state, kept on the creature's `attack` field (wilds.mjs make() gives it as null). */
export const titanState = e => e.attack ??= { skill: '', marks: [], active: [], skills: 0, enraged: false, summoned: [], bursts: [], targets: [], me: { id: 'player', x: 0, z: 0, airborne: false } };
/** The attacks a titan has running and the marks of its wind-up, for the view: nothing once it is down. */
export const titanAttacks = e => e.hp > 0 && e.attack ? e.attack.active : NONE;
export const titanMarks = e => e.hp > 0 && e.attack && e.phase === 'windup' ? e.attack.marks : NONE;
const NONE = Object.freeze([]);
/** A mark stays only where a fight can be: inside the world and outside the village ward (spec 4.3). */
const markKept = m => { const region = regionAt(m.x, m.z); return !!region && region !== 'village'; };

/**
 * Starts a wind-up: `skill` is a titan skill or '' for a plain strike; `aim` is the point it is aimed at. The creature's own `skill`
 * and `callout` fields are written too (the skill's name, and the line the boss bar prints during the wind-up).
 */
function windUp(w, e, s, skill, aim, limit) {
  const def = e.def;
  e.facing = Math.atan2(aim.x - e.x, aim.z - e.z); e.targetX = aim.x; e.targetZ = aim.z; e.slam = false;
  if (skill) {
    s.skills++; s.skill = e.skill = skill; e.callout = TITAN_CALLOUTS[skill]; e.phaseTime = e.windupTotal = TITAN_WINDUPS[skill] * (e.hp < e.maxHp * .3 ? .8 : 1);
    let point = aim;
    if (skill === 'leap') {
      // The landing is clamped to the leash before the mark is shown, and never a place the titan could not stand.
      let x = aim.x, z = aim.z; const d = len(x - e.homeX, z - e.homeZ);
      if (d > limit) { x = e.homeX + (x - e.homeX) / d * limit; z = e.homeZ + (z - e.homeZ) / d * limit; }
      point = w.walkable(e, x, z) ? { x, z } : { x: e.x, z: e.z };
    }
    const marks = titanTelegraphs(skill, { x: e.x, z: e.z, radius: e.radius, facing: e.facing }, point, s.targets, seeded(e.attacks * 91571)), kept = marks.filter(markKept);
    // The sweep reads its starting angle from its first mark: one is kept (with no size) if every one fell away.
    s.marks = kept.length || !marks.length ? kept : [{ ...marks[0], r: 0 }];
  } else { s.skill = e.skill = e.callout = ''; s.marks = []; e.phaseTime = e.windupTotal = def.windup; }
  e.phase = 'windup'; w.host.emit?.('windup', e);
}
/** A creature's own damage: what make() gave it (`baseDamage`, once wilds.mjs keeps it), else its kind's x its plan's power. */
const ownDamage = m => m.baseDamage ?? m.def.damage * (m.power ?? 1);
/** The summon: up to four living commons of the titan's own region within 60 m come to its side, healed and angry, at 1.3 x their damage (set, not multiplied). */
function summon(w, e, s) {
  let n = 0;
  for (let i = 0; i < w.list.length && n < TITAN.summon; i++) {
    const m = w.list[i];
    if (m === e || !(m.hp > 0) || m.leaving > 0 || m.def.boss || m.type === 'minislime' || !(m.def.speed > 0) || m.region !== e.region || len(m.x - e.x, m.z - e.z) >= TITAN.summonRange) continue;
    const angle = e.facing + (n + .5) * Math.PI / 2, x = e.x + Math.sin(angle) * (e.radius + 2), z = e.z + Math.cos(angle) * (e.radius + 2);
    if (w.walkable(m, x, z)) { m.x = x; m.z = z; }
    m.hp = m.maxHp; m.damage = ownDamage(m) * TITAN.summonBoost; m.phase = 'chase'; m.lastHit = w.time; m.resting = false; m.stun = 0;
    if (!s.summoned.includes(m)) s.summoned.push(m);
    n++;
  }
}
/**
 * A titan's whole turn (Wilds.titanStep): its running attacks, its wind-up, the chase and the way home.
 * `target` is the player when it can be fought, `distance` how far it is, `AI` wilds.mjs's numbers.
 */
export function titanTurn(w, e, dt, target, distance, AI) {
  const def = e.def, s = titanState(e), host = w.host, limit = titanLimit(e);
  // Back from a defeat: what it was doing is forgotten.
  if (!e.attacks && e.phase === 'idle' && (s.skills || s.active.length || s.marks.length || e.titanLift)) { s.skills = 0; s.active.length = 0; s.marks = []; s.skill = e.skill = e.callout = ''; s.enraged = e.enraged = false; e.titanLift = 0; }
  // Every creature stays in its own region, and a player standing in another one is no target (spec 4.4).
  if (target && e.region && regionAt(target.x, target.z) !== e.region) { target = null; distance = Infinity; }
  // A titan is never staggered and never slid: nothing but its own steps and its leap moves it.
  e.kx = e.kz = 0; e.stun = 0;
  // Summoned creatures go back to their own damage once they are home again, or down.
  for (let i = s.summoned.length - 1; i >= 0; i--) { const m = s.summoned[i]; if (m.gone || !(m.hp > 0) || m.phase === 'idle') { m.damage = ownDamage(m); s.summoned.splice(i, 1); } }
  // The hard leash, first of all: whatever pushed it (the player's own circle) is undone.
  let home = len(e.x - e.homeX, e.z - e.homeZ);
  if (home > limit && e.phase !== 'leap') { e.x = e.homeX + (e.x - e.homeX) / home * limit; e.z = e.homeZ + (e.z - e.homeZ) / home * limit; home = limit; }
  const calm = e.phase === 'idle' && e.hp === e.maxHp && !s.active.length && !e.forced;
  e.resting = calm && distance > AI.restRange; if (e.resting) return;
  // Level of detail, as every creature's: calm and out of sight, it only wanders, so it thinks on every 4th step.
  if (calm && distance > def.sight + 1) { e.wait += dt; if ((w.tick + e.slot) % 4) return; dt = e.wait; e.wait = 0; } else e.wait = 0;
  e.thought = dt;
  const targets = s.targets; targets.length = 0; if (target) { s.me.x = target.x; s.me.z = target.z; targets.push(s.me); }
  // Running attacks (world.ts updateTitanAttacks): several may overlap, pools and orbs last seven seconds.
  if (s.active.length) {
    for (let i = 0; i < s.active.length; i++) {
      const a = s.active[i], r = stepTitanAttack(a, dt, e, targets);
      for (let k = 0; k < r.hits.length; k++) host.hurt?.(e.damage * r.hits[k].multiplier, r.hits[k].source, e);
      for (let k = 0; k < r.pulls.length; k++) host.pull?.(r.pulls[k].x, r.pulls[k].z);
      if (r.move) { e.x = r.move.x; e.z = r.move.z; e.titanLift = r.move.y; if (r.done) { e.titanLift = 0; e.phase = 'recover'; e.phaseTime = TITAN.leapRecover; } }
      for (let k = 0; k < r.bursts.length && s.bursts.length < TITAN.bursts; k++) s.bursts.push({ x: r.bursts[k].x, z: r.bursts[k].z, r: r.bursts[k].r, skill: a.skill });
      if (r.summon) summon(w, e, s);
    }
    for (let i = s.active.length - 1; i >= 0; i--) if (s.active[i].age >= s.active[i].life) s.active.splice(i, 1);
  }
  if (e.phase === 'leap') { if (!s.active.some(a => a.skill === 'leap')) { e.phase = 'recover'; e.phaseTime = TITAN.leapRecover; e.titanLift = 0; } return; }
  if (e.phase === 'windup') {
    if ((e.phaseTime -= dt) > 0) return;
    // The blow (world.ts castBossSkill): cooldown x 0.7 under half health and x 0.6 once enraged.
    e.cooldown = def.cooldown * (e.hp < e.maxHp * .5 ? .7 : 1) * (s.enraged ? .6 : 1);
    if (s.skill) {
      const skill = s.skill; s.active.push(beginTitanAttack(skill, { x: e.x, z: e.z, radius: e.radius, facing: e.facing }, s.marks, targets)); s.marks = []; s.skill = e.skill = e.callout = '';
      if (skill === 'leap') { e.phase = 'leap'; e.phaseTime = TITAN.leapTime; } else { e.phase = 'recover'; e.phaseTime = TITAN.recover; }
    } else {
      if (target && distance < def.reach + TITAN.strikeReach) host.hurt?.(e.damage, 'melee', e);
      e.phase = 'recover'; e.phaseTime = AI.bossRecover;
    }
    host.emit?.('strike', e); return;
  }
  // The test hook (willowmere.test.skill): that skill's wind-up starts now, whatever the counters say.
  if (e.forced) {
    const forced = isTitanSkill(e.forced) ? e.forced : ''; e.forced = '';
    if (forced) { e.attacks++; windUp(w, e, s, forced, target ?? { x: e.x + Math.sin(e.facing) * (e.radius + 6), z: e.z + Math.cos(e.facing) * (e.radius + 6) }, limit); return; }
  }
  if (e.phase === 'recover') { if ((e.phaseTime -= dt) <= 0) e.phase = 'chase'; return; }
  // The chase: given up past 1.6 x its sight unless it was hit in the last 4 s. Its leash needs no test: it cannot leave it.
  const wasChasing = e.phase === 'chase' || e.hp < e.maxHp && e.phase !== 'return', sinceHit = w.time - e.lastHit;
  const chasing = !!target && (sinceHit < AI.hitGrace || (e.phase === 'return' ? distance < def.sight && home < AI.returnSight : wasChasing ? distance <= def.sight * AI.leashSight : distance < def.sight));
  let returning = !chasing && (wasChasing || e.phase === 'return');
  if (returning) { e.phase = 'return'; e.hp = Math.min(e.maxHp, e.hp + e.maxHp * AI.returnHeal * dt); if (home < .8 || def.speed === 0) { e.hp = e.maxHp; e.phase = 'idle'; returning = false; s.enraged = e.enraged = false; } }
  if (chasing && e.phase !== 'chase') { if (e.phase === 'idle' || e.phase === 'return') host.emit?.('alert', e); e.phase = 'chase'; }
  // Enraged the first time it fights under 30 % health; calm again once home (world.ts:1415, :1449).
  if (chasing && !s.enraged && e.hp < e.maxHp * .3) s.enraged = e.enraged = true; // titans-view.mjs shows it (the toast, the shout) from this state
  if (chasing && !e.cooldown && distance < TITAN.trigger) {
    // A far target always gets a skill: the count is made odd first, so it is even after the increment (world.ts:1304).
    if (distance > def.reach + 1) e.attacks |= 1;
    e.attacks++;
    windUp(w, e, s, titanSkill(def.skills, e.attacks, e.hp / e.maxHp, s.skills) ?? '', target, limit); return;
  }
  if (def.speed === 0 || chasing && distance < def.reach * .8) { if (chasing) e.facing = Math.atan2(target.x - e.x, target.z - e.z); return; }
  const gx = chasing ? target.x : returning ? e.homeX : e.homeX + Math.sin(w.time * .25 + e.homeZ) * AI.wander, gz = chasing ? target.z : returning ? e.homeZ : e.homeZ + Math.cos(w.time * .25 + e.homeX) * AI.wander;
  const dx = gx - e.x, dz = gz - e.z, d = len(dx, dz); if (d <= .05) return;
  const hurt = (e.hp < e.maxHp * .5 ? 1.35 : 1) * (e.hp < e.maxHp * .3 ? 1.25 : 1), step = Math.min(d, (chasing ? def.speed * hurt : returning ? def.speed * 1.2 : AI.wanderSpeed) * dt);
  // No step ends beyond the leash, hit or not: a step that would is bent along the leash's circle.
  let nx = e.x + dx / d * step, nz = e.z + dz / d * step; const out = len(nx - e.homeX, nz - e.homeZ);
  if (out > limit) { nx = e.homeX + (nx - e.homeX) / out * limit; nz = e.homeZ + (nz - e.homeZ) / out * limit; }
  const ox = e.x, oz = e.z; w.move(e, nx - ox, nz - oz);
  if (len(e.x - e.homeX, e.z - e.homeZ) > limit + 1e-6) { e.x = ox; e.z = oz; }
  e.facing = Math.atan2(dx, dz);
}
