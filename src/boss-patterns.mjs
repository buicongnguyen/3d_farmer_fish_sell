// The bosses' skill patterns, ported from Zoo Garden (cute_game src/boss-patterns.ts; round 8, builder D). Pure: the
// lists, the wind-ups, the rule that picks an attack, the telegraph discs, and how a boss takes a hit. The numbers are
// the reference's own. wilds.mjs runs them (Wilds.think), wilds-view.mjs draws the discs, combat-hud.mjs shows the callout.
//
// Not ported: bossScale (scaling by player count and player level: Willowmere has one player and no player level), and
// the titans' entries, which the reference merges into these tables: the titans' skills are titan-patterns.mjs (builder D2).

/** Seconds of warning before each skill lands (× 0.8 below 30 % health). */
export const BOSS_WINDUPS = Object.freeze({ slam: 1.1, quake: 1.2, charge: 1, barrage: .9, rain: 1.3, spin: .7, eclipse: 1.2 });
/** Each boss's own list, used in order (the n-th skill it casts is list[n % length]). */
export const BOSS_SKILLS = Object.freeze({
  bear: ['slam', 'charge', 'quake'], treant: ['slam', 'rain', 'barrage'], croc: ['charge', 'spin', 'slam'], mushking: ['rain', 'spin', 'slam'],
  cake: ['barrage', 'rain', 'slam'], gingerbread: ['charge', 'barrage', 'spin'], jellyqueen: ['quake', 'barrage', 'rain'],
  yeti: ['slam', 'rain', 'quake'], mammoth: ['charge', 'quake', 'slam'], frostowl: ['barrage', 'charge', 'rain'],
  golem: ['slam', 'rain', 'barrage'], dragon: ['barrage', 'rain', 'charge', 'quake'], robot: ['barrage', 'charge', 'quake', 'spin'],
  gorilla: ['slam', 'charge', 'rain', 'quake'], leviathan: ['barrage', 'rain', 'quake', 'charge'], phoenix: ['barrage', 'rain', 'charge', 'spin'],
  shadowlord: ['eclipse', 'rain', 'spin', 'barrage', 'quake'],
});
/** What each skill does, in the reference's numbers (world.ts castBossSkill, the spin and boss-charge branches, the quake pulses). */
export const SKILL = Object.freeze({
  slam: { radius: 4.8, hit: 1.6 },
  quake: { radius: 9, rings: [3, 6, 9], first: .12, gap: .32, hit: 1.1, inner: 2.4, outer: .4 },
  charge: { marks: 6, step: 2, radius: 1.3, run: 14, speed: 18, time: .7, hit: 1.3, reach: .6 },
  barrage: { radius: 2.2, shots: 14, hurtShots: 20, aim: 10 },
  rain: { radius: 2, marks: 3, hurtMarks: 4, near: 2, far: 6.5, hit: 1.3 },
  spin: { radius: 3.4, time: 2.4, every: .35, hit: .5, drift: 1.1, stop: 1.5 },
  eclipse: { radius: 7, hit: .9, dark: 6 },
});
/** The dragon's fire rain, from its second stage, on every `rain` (world.ts:1311-1314; environments.ts addFireRain). */
export const FIRE_RAIN = Object.freeze({ drops: 3, lateDrops: 5, spread: 4, delay: 1.1, radius: 1.4, share: .12 });
/** Three stages by thirds of health belong to the dragon; ordinary bosses enrage below 30 %. */
export function bossPhase(hp, maxHp) { const fraction = maxHp > 0 ? hp / maxHp : 1; return fraction < 1 / 3 ? 3 : fraction < 2 / 3 ? 2 : 1; }
/** `attackCount` is one-based; `skillCount` is the number of skills already used. Returns the skill's name, or null for a plain strike. */
export function bossSkill(type, attackCount, hpFraction, skillCount) {
  const skills = BOSS_SKILLS[type]; if (!skills) return attackCount % 3 === 0 ? 'slam' : null;
  const special = hpFraction < .3 || attackCount % 2 === 0 || hpFraction < .5 && attackCount % 3 !== 1;
  return special ? skills[Math.max(0, skillCount) % skills.length] : null;
}
/** The discs a skill shows during its wind-up: [{x, z, r, delay}]. `phase` 2 and more (below half health) adds a fourth rain disc. */
export function bossTelegraphs(skill, from, target, phase = 1, seed = 1) {
  const delay = BOSS_WINDUPS[skill], round = n => Math.round(n * 100) / 100, point = (p, r) => ({ x: round(p.x), z: round(p.z), r, delay });
  if (skill === 'charge') {
    const distance = Math.hypot(target.x - from.x, target.z - from.z) || 1, dx = (target.x - from.x) / distance, dz = (target.z - from.z) / distance;
    return Array.from({ length: SKILL.charge.marks }, (_, i) => point({ x: from.x + dx * (i + 1) * SKILL.charge.step, z: from.z + dz * (i + 1) * SKILL.charge.step }, SKILL.charge.radius));
  }
  if (skill === 'rain') {
    let value = seed >>> 0; const random = () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
    const marks = [point(target, SKILL.rain.radius)];
    for (let i = 1; i < (phase >= 2 ? SKILL.rain.hurtMarks : SKILL.rain.marks); i++) { const angle = random() * Math.PI * 2, distance = SKILL.rain.near + random() * (SKILL.rain.far - SKILL.rain.near); marks.push(point({ x: target.x + Math.cos(angle) * distance, z: target.z + Math.sin(angle) * distance }, SKILL.rain.radius)); }
    return marks;
  }
  return [point(from, SKILL[skill].radius)];
}
/** Disc colours (the reference's showSkillWindup): meteor rain orange, the charge lane amber, every other skill red. */
export const BOSS_TELEGRAPH_COLORS = Object.freeze({ slam: '#ff3b3b', quake: '#ff3b3b', charge: '#ffb13d', barrage: '#ff3b3b', rain: '#ff7a1f', spin: '#ff3b3b', eclipse: '#ff3b3b' });
/** The callout floated above a boss at the start of a wind-up, and shown on its bar (one per skill, never a toast). */
export const BOSS_CALLOUTS = Object.freeze({ slam: '⚠️ SLAM', quake: '⚠️ QUAKE', charge: '⚠️ CHARGE', barrage: '⚠️ BARRAGE', rain: '⚠️ METEOR RAIN', spin: '⚠️ SPIN', eclipse: '⚠️ ECLIPSE' });
/** Callouts show only to a player this close to the boss (metres). */
export const CALLOUT_RANGE = 30;
/** The ordinary creatures the reference telegraphs on the ground; every other creature warns by pose alone. `at`: around itself, in front of it, or where it will land. */
export const CREATURE_TELEGRAPHS = Object.freeze({ magmaturtle: { r: 2.6, at: 'self' }, lavaworm: { r: 2, at: 'self' }, firebat: { r: 1.2, at: 'target' }, chomper: { r: 1.4, at: 'front' } });
/**
 * How a boss takes a hit: never staggered, so its wind-up and skill go on; a hard stun (0.5 s or more) only slows it, for
 * 0.6 × the stun's length. An ordinary creature is stunned by a hard stun and by nothing shorter.
 */
export const HARD_STUN = .5, RESIST_SLOW = .6, SLOW = .45, RESIST_EVERY = .7;
export function hitControl(boss, stun) { const hard = stun >= HARD_STUN; return boss ? { stun: 0, slow: hard ? stun * RESIST_SLOW : 0 } : { stun: hard ? stun : 0, slow: 0 }; }
/** Launch height for a lift: the reference scales a boss's launch velocity by 0.25, so the height by its square, 1/16 (wilds.mjs AI.bossLift). */
export const BOSS_LIFT = .25;
export const liftHeight = (boss, height) => boss ? height * BOSS_LIFT * BOSS_LIFT : height;
/** A boss attacks faster as it weakens: × 0.7 below half health, × 0.6 once enraged. Skills, strikes and charges alike. */
export const bossCooldownScale = e => e.def.boss ? (e.hp < e.maxHp * .5 ? .7 : 1) * (e.enraged ? .6 : 1) : 1;
/** Leash: a chaser gives up past 1.6 × its sight or `leash` metres from home, unless it was hit in the last 4 s. */
export const LEASH = Object.freeze({ sight: 1.6, home: 30, hitGrace: 4 });
export const keepsChasing = (distance, sight, homeDistance, sinceHit, leash = LEASH.home) => sinceHit < LEASH.hitGrace || distance <= sight * LEASH.sight && homeDistance <= leash;
