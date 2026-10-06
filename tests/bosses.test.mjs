// The bosses (round 8, builder D): the reference's rule that picks an attack, each boss's own list, the seven skills with
// their telegraphs and numbers, enrage, how a boss takes a hit, and the lava dragon's visits. The first block is Zoo
// Garden's own test (cute_game tests/boss-patterns.test.ts), ported; the rest drives the simulation (wilds.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BOSS_SKILLS, BOSS_WINDUPS, BOSS_CALLOUTS, BOSS_TELEGRAPH_COLORS, SKILL, FIRE_RAIN, CREATURE_TELEGRAPHS, bossPhase, bossSkill, bossTelegraphs, hitControl, liftHeight, bossCooldownScale, keepsChasing } from '../src/boss-patterns.mjs';
import { CREATURES, Wilds, AI, STEP, SAFE, inSafeZone, windupProgress, wildCell } from '../src/wilds.mjs';
import { DENS, REGION, regionAt, powerAt } from '../src/regions.mjs';
import { POWER } from '../src/region-mix.mjs';
import { forceLavaEvent, cycleEvent, LAVA_CYCLE_SECONDS } from '../src/lava-weather.mjs';

const seeded = seed => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const near = (a, b, tolerance = 1e-6) => Math.abs(a - b) <= tolerance;
const BOSSES = Object.keys(CREATURES).filter(type => CREATURES[type].boss && !CREATURES[type].titan), SKILLS = ['slam', 'quake', 'charge', 'barrage', 'rain', 'spin', 'eclipse'];
/** One boss at its den (or at `at`), a player `away` metres east of it, and everything it does recorded. */
function fight(type, { away = 2.5, at = null, clock = { t: 0 }, plan = {} } = {}) {
  const den = DENS.find(d => d.type === type), x = at?.x ?? den.x, z = at?.z ?? den.z, region = at?.region ?? den?.region ?? regionAt(x, z);
  const events = [], blows = [], shares = [], dark = [];
  const wilds = new Wilds({ emit: (kind, e, extra) => events.push([kind, e.type, extra]), hurt: (amount, source, e) => blows.push({ amount, source, at: wilds.time }), hurtShare: (share, source) => shares.push({ share, source, at: wilds.time }), eclipse: seconds => dark.push(seconds), now: () => clock.t }, seeded(7));
  const info = REGION[region], e = wilds.make({ id: 'w:den:' + type, type, x, z, region, level: info.bossLevel, power: info.kind === 'land' ? POWER[info.difficulty] : 1, leash: den?.leash ?? 30, event: den?.event ?? null, ...plan }); e.born = 0;
  wilds.list.push(e); wilds.open = true;
  const player = { x: x + away, z, active: true };
  const run = (seconds, each) => { for (let t = 0; t < seconds - 1e-9; t += STEP) { each?.(); wilds.step(STEP, player); } };
  /** Starts `skill` now (the test hook's way) and runs to the moment it lands; returns the marks it showed. */
  const cast = skill => { e.forced = skill; e.cooldown = 0; wilds.step(STEP, player); assert.equal(e.phase, 'windup'); assert.equal(e.skill, skill); const marks = e.marks.map(m => ({ ...m })), total = e.windupTotal; let peak = 0; while (e.phase === 'windup') { peak = Math.max(peak, windupProgress(e)); wilds.step(STEP, player); } return { marks, total, peak }; };
  return { wilds, e, player, events, blows, shares, dark, run, cast, clock };
}

test('the reference\'s rule: a strike, then a skill, in turn; faster below half health; every attack a skill below 30 %', () => {
  // cute_game tests/boss-patterns.test.ts, word for word.
  assert.equal(bossPhase(200, 300), 1); assert.equal(bossPhase(199, 300), 2); assert.equal(bossPhase(100, 300), 2); assert.equal(bossPhase(99, 300), 3);
  assert.equal(bossSkill('bear', 1, 1, 0), null); assert.equal(bossSkill('bear', 2, 1, 0), 'slam'); assert.equal(bossSkill('bear', 4, 1, 1), 'charge'); assert.equal(bossSkill('bear', 6, 1, 2), 'quake'); assert.equal(bossSkill('bear', 8, 1, 3), 'slam');
  assert.equal(bossSkill('bear', 3, .49, 1), 'charge'); assert.equal(bossSkill('bear', 1, .29, 2), 'quake'); assert.equal(bossSkill('shadowlord', 2, 1, 0), 'eclipse');
  assert.equal(Object.keys(BOSS_SKILLS).length, 17, '16 bosses and the dragon (the nine titans\' lists are titan-patterns.mjs)');
  // A boss with no list keeps the old rule: a slam on every third attack.
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(n => bossSkill('nobody', n, 1, 0)), [null, null, 'slam', null, null, 'slam']);
  // In reach: strike, skill, strike, skill; below half the plain strike is only every third; below 30 % all skills.
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(n => !!bossSkill('croc', n, 1, 0)), [false, true, false, true, false, true]);
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(n => !!bossSkill('croc', n, .45, 0)), [false, true, true, true, true, true, false]);
  assert.deepEqual([1, 2, 3, 4, 5].map(n => !!bossSkill('croc', n, .2, 0)), [true, true, true, true, true]);
  const marks = bossTelegraphs('charge', { x: 0, z: 0 }, { x: 10, z: 0 }); assert.equal(marks.length, 6); assert.deepEqual(marks.at(-1), { x: 12, z: 0, r: 1.3, delay: 1 });
  const from = { x: 0, z: 0 }, target = { x: 5, z: 7 }, initial = bossTelegraphs('rain', from, target, 1, 15), late = bossTelegraphs('rain', from, target, 2, 15);
  assert.equal(initial.length, 3); assert.equal(late.length, 4); assert.deepEqual(initial[0], { ...target, r: 2, delay: 1.3 }); assert.deepEqual(initial, bossTelegraphs('rain', from, target, 1, 15));
  for (const mark of late.slice(1)) { const d = Math.hypot(mark.x - target.x, mark.z - target.z); assert.ok(d <= 6.51 && d >= 1.99); }
  for (const skill of SKILLS) for (const marker of bossTelegraphs(skill, { x: 1, z: 2 }, { x: 4, z: 5 })) assert.ok(marker.r > 0 && marker.delay === BOSS_WINDUPS[skill]);
});

test('each boss has its own list of three to five skills, a wind-up, a disc colour and a callout for each', () => {
  assert.deepEqual(BOSS_SKILLS, {
    treant: ['slam', 'rain', 'barrage'], croc: ['charge', 'spin', 'slam'], mushking: ['rain', 'spin', 'slam'], bear: ['slam', 'charge', 'quake'],
    robot: ['barrage', 'charge', 'quake', 'spin'], cake: ['barrage', 'rain', 'slam'], gingerbread: ['charge', 'barrage', 'spin'], jellyqueen: ['quake', 'barrage', 'rain'],
    gorilla: ['slam', 'charge', 'rain', 'quake'], yeti: ['slam', 'rain', 'quake'], mammoth: ['charge', 'quake', 'slam'], frostowl: ['barrage', 'charge', 'rain'],
    leviathan: ['barrage', 'rain', 'quake', 'charge'], golem: ['slam', 'rain', 'barrage'], phoenix: ['barrage', 'rain', 'charge', 'spin'], shadowlord: ['eclipse', 'rain', 'spin', 'barrage', 'quake'],
    dragon: ['barrage', 'rain', 'charge', 'quake'],
  });
  assert.deepEqual(BOSSES.sort(), Object.keys(BOSS_SKILLS).sort(), 'every boss in the game has a list, and every list a boss');
  assert.equal(BOSSES.length, 17);
  for (const type of BOSSES) { assert.equal(CREATURES[type].scale, 1.85, `${type} is drawn at 1.85`); assert.ok(BOSS_SKILLS[type].length >= 3 && BOSS_SKILLS[type].length <= 5); assert.ok(DENS.some(d => d.type === type), `${type} has a den`); }
  assert.deepEqual(BOSS_WINDUPS, { slam: 1.1, quake: 1.2, charge: 1, barrage: .9, rain: 1.3, spin: .7, eclipse: 1.2 });
  assert.deepEqual(BOSS_TELEGRAPH_COLORS, { slam: '#ff3b3b', quake: '#ff3b3b', charge: '#ffb13d', barrage: '#ff3b3b', rain: '#ff7a1f', spin: '#ff3b3b', eclipse: '#ff3b3b' });
  for (const skill of SKILLS) assert.ok(BOSS_CALLOUTS[skill].startsWith('⚠️ '), skill);
  // Sight is each boss's own (12 to 18 m), not a flat 13.
  assert.deepEqual(['treant', 'croc', 'bear', 'gorilla', 'frostowl', 'leviathan', 'phoenix', 'shadowlord', 'dragon'].map(t => CREATURES[t].sight), [12, 12, 13, 14, 15, 15, 16, 16, 18]);
  assert.deepEqual(CREATURE_TELEGRAPHS, { magmaturtle: { r: 2.6, at: 'self' }, lavaworm: { r: 2, at: 'self' }, firebat: { r: 1.2, at: 'target' }, chomper: { r: 1.4, at: 'front' } });
  for (const [type, t] of Object.entries(CREATURE_TELEGRAPHS)) { assert.equal(CREATURES[type].telegraph, t.r, type); assert.equal(CREATURES[type].telegraphAt ?? 'front', t.at, type); }
});

test('in a fight the King Bear strikes, slams, strikes, charges, strikes, quakes: his own list, in order', () => {
  const { e, blows, events, run } = fight('bear', { away: 2.5 });
  const seen = []; run(26, () => { if (e.phase === 'windup' && seen.at(-1)?.[0] !== e.attacks) seen.push([e.attacks, e.skill]); });
  assert.deepEqual(seen.slice(0, 6).map(([, skill]) => skill), ['', 'slam', '', 'charge', '', 'quake']);
  assert.deepEqual(events.filter(([k]) => k === 'callout').length, events.filter(([k]) => k === 'cast').length + (e.phase === 'windup' && e.skill ? 1 : 0), 'every skill is called out, then cast');
  assert.ok(blows.some(b => b.amount === 26) && blows.some(b => near(b.amount, 26 * 1.6)), 'a plain strike for 26, a slam for 1.6 ×');
});

test('slam: a red disc of 4.8 m on itself for 1.1 s, then 1.6 × to whoever is inside', () => {
  const inside = fight('treant', { away: 4.5 }), a = inside.cast('slam');
  assert.deepEqual(a.marks, [{ x: inside.e.homeX, z: inside.e.homeZ, r: 4.8, delay: 1.1 }]); assert.ok(near(a.total, 1.1)); assert.ok(a.peak > .95, 'the disc fills as the blow lands');
  assert.deepEqual(inside.blows.map(b => [b.amount, b.source]), [[22 * 1.6, 'melee']]); assert.ok(inside.e.slam === true && inside.e.phase === 'recover');
  const outside = fight('treant', { away: 5 }); outside.cast('slam'); assert.equal(outside.blows.length, 0, '5 m away: clear of it');
  assert.equal(AI.slamRadius, 4.8);
});

test('quake: a 9 m disc, then three rings at 0.12, 0.44 and 0.76 s, 1.1 × each, each only in its own band', () => {
  for (const [away, ring] of [[2, 0], [5, 1], [8, 2]]) {
    const f = fight('bear', { away }), a = f.cast('quake'), landed = f.wilds.time;
    assert.deepEqual(a.marks.map(m => m.r), [9]); assert.ok(near(a.total, 1.2));
    assert.equal(f.e.pulses.length, 3); f.e.def = { ...f.e.def, speed: 0 }; f.run(1);
    assert.deepEqual(f.blows.map(b => near(b.amount, 26 * 1.1)), [true], `at ${away} m one ring hits`);
    assert.ok(near(f.blows[0].at - landed, .12 + ring * .32, STEP + 1e-6), `the ${['first', 'second', 'third'][ring]} ring, ${(f.blows[0].at - landed).toFixed(3)} s after the cast`);
    assert.equal(f.events.filter(([k]) => k === 'pulse').length, 3); assert.equal(f.e.pulses.length, 0);
  }
  // The bands: 0.6 to 3.4 m, 3.6 to 6.4 m, 6.6 to 9.4 m.
  const k = SKILL.quake; assert.deepEqual(k.rings.map(r => [near(r - k.inner, [.6, 3.6, 6.6][k.rings.indexOf(r)]), near(r + k.outer, [3.4, 6.4, 9.4][k.rings.indexOf(r)])]), [[true, true], [true, true], [true, true]]);
  const gap = fight('bear', { away: 3.5 }); gap.cast('quake'); gap.e.def = { ...gap.e.def, speed: 0 }; gap.run(1); assert.equal(gap.blows.length, 0, 'between two rings: untouched');
});

test('charge: six amber discs every 2 m toward you, then 14 m at 18 m/s and one hit of 1.3 × as it passes', () => {
  const f = fight('croc', { away: 6 }), start = { x: f.e.x, z: f.e.z }, a = f.cast('charge');
  assert.equal(a.marks.length, 6); assert.deepEqual(a.marks.map(m => [near(m.x, start.x + (a.marks.indexOf(m) + 1) * 2, .01), near(m.z, start.z, .01), m.r]), Array(6).fill([true, true, 1.3]));
  assert.equal(f.e.phase, 'charge'); let fastest = 0, last = f.e.x; f.run(.8, () => { fastest = Math.max(fastest, (f.e.x - last) / STEP); last = f.e.x; });
  assert.ok(near(fastest, 18, .5), `it runs at 18 m/s (${fastest.toFixed(1)})`); assert.ok(f.e.x - start.x > 11.5 && f.e.x - start.x <= 14.01, `it ran ${(f.e.x - start.x).toFixed(1)} m`);
  assert.deepEqual(f.blows.map(b => near(b.amount, 25 * 1.3)), [true], 'one hit, not one a step');
  const miss = fight('croc', { away: 6 }); miss.e.forced = 'charge'; miss.wilds.step(STEP, miss.player); miss.player.z += 6; miss.run(2.2); assert.equal(miss.blows.length, 0, 'step out of the lane and it runs past');
});

test('barrage: 14 shots in a ring, 20 below half health, none dropped; the robot\'s are electric', () => {
  const f = fight('robot', { away: 8 }); f.e.def = { ...f.e.def, speed: 0 }; const a = f.cast('barrage');
  assert.deepEqual(a.marks.map(m => m.r), [2.2]); assert.ok(near(a.total, .9));
  const live = f.wilds.shots.filter(s => s.live); assert.equal(live.length, 14); assert.ok(live.every(s => s.kind === 'volt' && near(Math.hypot(s.vx, s.vz), 13) && near(s.damage, f.e.damage)));
  const headings = live.map(s => Math.atan2(s.vx, s.vz)).sort((p, q) => p - q); for (let i = 1; i < 14; i++) assert.ok(near(headings[i] - headings[i - 1], Math.PI * 2 / 14, 1e-6), 'evenly round');
  f.run(1.5); assert.ok(f.wilds.shots.every(s => !s.live), 'gone after 1.4 s');
  assert.ok(f.blows.length <= 1 && f.blows.every(b => b.source === 'shot' && near(b.amount, 22 * 1.7 * 1.35)), 'one of the ring is aimed your way');
  const hurt = fight('treant', { away: 8 }); hurt.e.def = { ...hurt.e.def, speed: 0 }; hurt.e.hp = hurt.e.maxHp * .45; hurt.cast('barrage');
  assert.equal(hurt.wilds.shots.filter(s => s.live).length, 20); assert.ok(hurt.wilds.shots.filter(s => s.live).every(s => s.kind === ''), 'the others shoot their own colour');
  assert.equal(hurt.wilds.shots.length, 32, 'a pool of 32: a barrage and a neighbour\'s shots fit');
});

test('rain: three orange discs (four below half health), one on you, 1.3 × in each', () => {
  const f = fight('mushking', { away: 6 }); f.e.def = { ...f.e.def, speed: 0 }; const a = f.cast('rain');
  assert.equal(a.marks.length, 3); assert.deepEqual([a.marks[0].x, a.marks[0].z, a.marks[0].r], [f.player.x, f.player.z, 2]); assert.ok(near(a.total, 1.3));
  assert.ok(f.blows.length >= 1 && f.blows.every(b => near(b.amount, 24 * 1.3) && b.source === 'shot'), 'standing on the disc');
  const late = fight('mushking', { away: 6 }); late.e.def = { ...late.e.def, speed: 0 }; late.e.hp = late.e.maxHp * .4; assert.equal(late.cast('rain').marks.length, 4);
  const dodge = fight('mushking', { away: 6 }); dodge.e.def = { ...dodge.e.def, speed: 0 }; dodge.e.forced = 'rain'; dodge.wilds.step(STEP, dodge.player);
  const marks = dodge.e.marks.map(m => ({ ...m })); dodge.player.x += 30; dodge.run(1.5); assert.equal(dodge.blows.length, 0, 'walk off the discs and the rain misses');
  for (const m of marks.slice(1)) { const d = Math.hypot(m.x - marks[0].x, m.z - marks[0].z); assert.ok(d >= 1.99 && d <= 6.51); }
});

test('spin: 2.4 s drifting toward you, 0.5 × every 0.35 s inside 3.4 m', () => {
  const f = fight('croc', { away: 3 }), a = f.cast('spin'), from = f.e.x;
  assert.deepEqual(a.marks.map(m => m.r), [3.4]); assert.ok(near(a.total, .7)); assert.equal(f.e.phase, 'spin');
  f.run(2.3); assert.equal(f.e.phase, 'spin'); f.run(.2); assert.equal(f.e.phase, 'recover'); assert.ok(f.e.x > from, 'it drifts toward the player');
  assert.equal(f.blows.length, 7, 'seven ticks in 2.4 s'); assert.ok(f.blows.every(b => near(b.amount, 25 * .5)));
  for (let i = 1; i < f.blows.length; i++) assert.ok(near(f.blows[i].at - f.blows[i - 1].at, .35, STEP + 1e-6));
  const far = fight('croc', { away: 9 }); far.e.def = { ...far.e.def, speed: 0 }; far.cast('spin'); far.run(2.4); assert.equal(far.blows.length, 0);
});

test('eclipse: 0.9 × inside 7 m, then six seconds of dark handed to the land', () => {
  const f = fight('shadowlord', { away: 6 }), a = f.cast('eclipse');
  assert.deepEqual(a.marks.map(m => m.r), [7]); assert.ok(near(a.total, 1.2)); assert.deepEqual(f.dark, [6]);
  assert.deepEqual(f.blows.map(b => near(b.amount, 34 * 6.2 * 1.35 * .9, 1e-6)), [true]); assert.equal(f.blows[0].source, 'shot');
  const out = fight('shadowlord', { away: 7.5 }); out.e.def = { ...out.e.def, speed: 0 }; out.cast('eclipse'); assert.equal(out.blows.length, 0); assert.deepEqual(out.dark, [6], 'the dark falls whether or not it hit');
});

test('enrage: once, the first time it is below 30 % while it fights; skills wind up × 0.8; cooldowns × 0.7 and × 0.6; it calms at home', () => {
  const f = fight('bear', { away: 2.5 });
  f.run(3); assert.equal(f.e.enraged, false);
  assert.equal(bossCooldownScale(f.e), 1); f.e.hp = f.e.maxHp * .45; assert.equal(bossCooldownScale(f.e), .7);
  f.e.hp = f.e.maxHp * .25; f.run(.1); assert.equal(f.e.enraged, true); assert.equal(f.events.filter(([k]) => k === 'enrage').length, 1); assert.ok(near(bossCooldownScale(f.e), .42));
  f.run(8); assert.equal(f.events.filter(([k]) => k === 'enrage').length, 1, 'only once');
  // Below 30 % every attack is a skill, and its wind-up is four fifths as long.
  const windups = []; f.e.hp = f.e.maxHp * .25; f.run(10, () => { if (f.e.phase === 'windup' && f.e.skill && windups.at(-1)?.[0] !== f.e.attacks) windups.push([f.e.attacks, f.e.skill, f.e.windupTotal]); f.e.hp = Math.min(f.e.hp, f.e.maxHp * .25); });
  assert.ok(windups.length >= 3); for (const [, skill, total] of windups) assert.ok(near(total, BOSS_WINDUPS[skill] * .8), `${skill} winds up in ${total}`);
  // A boss's cooldown after a skill: its own × 0.7 × 0.6.
  const cool = fight('bear', { away: 2.5 }); cool.e.hp = cool.e.maxHp * .2; cool.e.def = { ...cool.e.def, speed: 0 }; cool.cast('slam'); assert.ok(near(cool.e.cooldown, 2.2 * .42, STEP + 1e-6));
  // The player leaves (into the village): it walks home, heals, and is calm again.
  f.player.x = 0; f.player.z = 0; f.run(30); assert.equal(f.e.phase, 'idle'); assert.equal(f.e.hp, f.e.maxHp); assert.equal(f.e.enraged, false); assert.equal(f.events.filter(([k]) => k === 'calm').length, 1);
  // Hurt, it is quicker: × 1.35 below half, × 1.25 more below 30 %.
  const quick = fight('bear', { away: 12 }); quick.e.cooldown = 99; let x0 = quick.e.x; quick.run(1); const full = quick.e.x - x0;
  const hurt = fight('bear', { away: 12 }); hurt.e.cooldown = 99; hurt.e.hp = hurt.e.maxHp * .25; x0 = hurt.e.x; hurt.run(1); assert.ok(near((hurt.e.x - x0) / full, 1.35 * 1.25, .06), `${((hurt.e.x - x0) / full).toFixed(2)} × as fast`);
});

test('a hit never staggers a boss: a hard stun becomes a slow of 0.6 × its length, a knock a nudge, a launch one sixteenth', () => {
  assert.deepEqual(hitControl(true, 1), { stun: 0, slow: .6 }); assert.deepEqual(hitControl(true, .4), { stun: 0, slow: 0 }); assert.deepEqual(hitControl(false, 1), { stun: 1, slow: 0 }); assert.deepEqual(hitControl(false, .4), { stun: 0, slow: 0 });
  assert.equal(liftHeight(true, 1.6), .1); assert.equal(liftHeight(false, 1.6), 1.6); assert.equal(AI.bossLift, .0625);
  assert.equal(keepsChasing(20, 13, 10, 9), true); assert.equal(keepsChasing(21, 13, 10, 9), false); assert.equal(keepsChasing(20, 13, 31, 9), false); assert.equal(keepsChasing(99, 13, 99, 3.9), true); assert.equal(keepsChasing(10, 13, 25, 9, 24), false);
  // In the simulation: the stun does not interrupt the wind-up; the slow walks at 0.45 of the speed for 0.6 s of every second of stun.
  const f = fight('bear', { away: 2.5 }); f.e.forced = 'slam'; f.wilds.step(STEP, f.player); f.wilds.hit(f.e, 5, 1);
  assert.equal(f.e.stun, 0); assert.ok(near(f.e.slow, .6)); assert.equal(f.e.phase, 'windup');
  assert.equal(f.events.filter(([k]) => k === 'resist').length, 1); f.wilds.hit(f.e, 5, 1); f.wilds.hit(f.e, 5, 1); assert.equal(f.events.filter(([k]) => k === 'resist').length, 1, 'RESIST at most every 0.7 s');
  f.run(1.2); assert.equal(f.blows.length, 1, 'the slam still lands'); f.wilds.hit(f.e, 5, 1); assert.equal(f.events.filter(([k]) => k === 'resist').length, 2);
  const slowed = fight('bear', { away: 12 }); slowed.e.cooldown = 99; slowed.wilds.hit(slowed.e, 1, 5); let x0 = slowed.e.x; slowed.run(1); const crawl = slowed.e.x - x0;
  const brisk = fight('bear', { away: 12 }); brisk.e.cooldown = 99; brisk.wilds.hit(brisk.e, 1, 0); x0 = brisk.e.x; brisk.run(1); assert.ok(near(crawl / (brisk.e.x - x0), .45, .03));
  // The same lift on a boss and on a common: the boss rises one sixteenth as high.
  const peak = type => { const g = fight(type, { away: 40, at: { x: 130, z: 20, region: 'east' } }); g.wilds.hit(g.e, 1, 0, 1.6); const v = g.e.liftV; let top = 0; g.run(1.5, () => { top = Math.max(top, g.e.lift); }); assert.ok(top > 0 && g.e.lift === 0, 'up and down again'); return v * v / (2 * AI.gravity); };
  const boss = peak('bear'), common = peak('wolf'); assert.ok(near(boss / common, 1 / 16), `a boss's launch is ${(boss / common).toFixed(4)} of a common's`); assert.ok(near(common, .8), 'a lift of 1.6 throws a common 0.8 m up');
  // Knock-back: × 0.15.
  const push = type => { const g = fight(type, { away: 40, at: { x: 130, z: 20, region: 'east' } }); g.wilds.hit(g.e, 1, 0, 0, 3, 1, 0); return g.e.kx; };
  assert.ok(near(push('bear') / push('wolf'), .15), 'the push a boss is given is 0.15 of a common'); assert.ok(near(push('wolf'), 3 * AI.knock));
});

test('no boss fights a player inside the ward, a driver, or a player in another region; a candy boss that is not hit gives up 24 m from its den', () => {
  const f = fight('bear', { away: 2.5 }); f.player.x = SAFE.x1 - 2; f.player.z = 0; f.e.x = SAFE.x1 + 3; f.e.z = 0; f.e.homeX = f.e.x; f.e.homeZ = 0;
  f.run(6); assert.equal(f.blows.length, 0); assert.equal(f.e.phase, 'idle'); assert.ok(!inSafeZone(f.e.x, f.e.z, f.e.radius - .01));
  f.e.forced = 'slam'; f.run(1.5); assert.equal(f.blows.length, 0, 'even a forced slam cannot reach into the ward');
  const driver = fight('bear', { away: 2.5 }); driver.player.active = false; driver.run(5); assert.equal(driver.blows.length, 0); assert.equal(driver.e.phase, 'idle');
  // The Cake King's leash is 24 m (three dens share that square): led away without a hit, he turns back there.
  const cake = fight('cake', { away: 10 }); assert.equal(cake.e.leash, 24); let reach = 0, quit = false;
  cake.run(40, () => { cake.player.x = cake.e.x + 9; cake.player.z = cake.e.z; if (cake.e.phase === 'return') quit = true; if (!quit) reach = Math.max(reach, Math.hypot(cake.e.x - cake.e.homeX, cake.e.z - cake.e.homeZ)); });
  assert.ok(quit, 'he gives up'); assert.ok(reach > 22 && reach < 24.6, `he came ${reach.toFixed(1)} m from his den`);
  const bear = fight('bear', { away: 10 }); let far = 0, gave = false; bear.run(40, () => { bear.player.x = bear.e.x + 9; bear.player.z = bear.e.z; if (bear.e.phase === 'return') gave = true; if (!gave) far = Math.max(far, Math.hypot(bear.e.x - bear.e.homeX, bear.e.z - bear.e.homeZ)); });
  assert.ok(far > 28 && far < 30.6, `the King Bear's leash is 30 m (${far.toFixed(1)})`);
});

test('the lava dragon: away until its event, here at full health within a step of it, gone when it ends, never 24 m from its nest', () => {
  const nest = DENS.find(d => d.type === 'dragon'), DRAGON_HP = Math.round(12480 * powerAt(nest.x, nest.z) / 4.8); assert.deepEqual([nest.event, nest.leash, nest.region, nest.x, nest.z], ['dragon', 24, 'lava', -142, -206.5]);
  // The seeded plan always holds the nest's creature; whether it is here is the weather's.
  const plan = wildCell(Math.floor(nest.x / 32), Math.floor(nest.z / 32)).find(c => c.id === 'w:den:dragon'); assert.deepEqual([plan.type, plan.event, plan.leash, plan.power], ['dragon', 'dragon', 24, powerAt(nest.x, nest.z)]);
  // The wall clock: find a cycle that is not the dragon's followed by one that is (lava-weather.mjs cycleEvent).
  let calm = 0; while (cycleEvent(calm) === 'dragon' || cycleEvent(calm + 1) !== 'dragon') calm++;
  const clock = { t: calm * LAVA_CYCLE_SECONDS + 10 }, f = fight('dragon', { away: 40, clock });
  assert.equal(f.e.hp, 0, 'the nest is empty in any other weather'); assert.equal(f.e.respawn, Infinity); assert.deepEqual([f.e.maxHp, f.e.hard, f.e.leash], [12480, true, 24]); assert.ok(near(f.e.damage, 233.28));
  f.run(40); assert.equal(f.e.hp, 0, 'no timer brings it'); assert.equal(f.events.filter(([k]) => k === 'arrive' || k === 'respawn').length, 0);
  clock.t = (calm + 1) * LAVA_CYCLE_SECONDS + .01; f.wilds.step(STEP, f.player);
  assert.equal(f.e.hp, 12480, 'at full health within one step of the event starting'); assert.deepEqual(f.events.filter(([k]) => k === 'arrive').map(([, type]) => type), ['dragon']); assert.ok(near(f.e.x, nest.x, .05) && near(f.e.z, nest.z, .05), 'at its nest');
  // It fights with its own list, flies, and never ends a step more than 24 m from its nest, though it is hit every second for a minute.
  let farthest = 0, steps = 0; const skills = new Set(), track = () => { farthest = Math.max(farthest, Math.hypot(f.e.x - nest.x, f.e.z - nest.z)); if (f.e.skill) skills.add(f.e.skill); };
  f.player.x = nest.x - 2.5; f.player.z = nest.z; f.run(12, track);
  // Then the player runs for the far side of the Ember Fields, 14 m ahead of it, hitting it every second.
  f.run(60, () => { if (steps++ % 40 === 0) f.wilds.hit(f.e, 1); f.player.x = Math.max(-58, f.e.x - 14); f.player.z = f.e.z + 6; track(); });
  assert.ok(farthest <= 24 + 1e-6 && farthest > 15, `the dragon went ${farthest.toFixed(2)} m from its nest at most`); assert.ok(aggroed(f.e)); assert.ok(skills.size >= 1 && [...skills].every(s => BOSS_SKILLS.dragon.includes(s)));
  // Three stages by thirds of health. From the second, every rain also drops fire on you: three drops (five in the third stage)
  // within 4 m, 1.1 s later, 12 % of your full health within 1.4 m, and the nest is told (it turns to lava: land-view.mjs).
  f.e.def = { ...f.e.def, speed: 0 }; f.e.hp = f.e.maxHp * .6; f.e.phase = 'chase'; f.wilds.step(STEP, f.player); assert.equal(f.e.stage, 2); assert.equal(f.events.filter(([k]) => k === 'stage').length, 1);
  f.player.x = f.e.x + 6; f.player.z = f.e.z; f.e.pulses.length = 0; f.shares.length = 0; f.e.forced = 'rain'; f.e.cooldown = 0; f.wilds.step(STEP, f.player);
  const drops = f.e.pulses.filter(p => p.share); assert.equal(drops.length, FIRE_RAIN.drops); for (const p of drops) { assert.ok(Math.hypot(p.x - f.player.x, p.z - f.player.z) <= 4 + 1e-9); assert.deepEqual([p.r, p.share, p.total], [1.4, .12, 1.1]); }
  f.player.x = drops[0].x; f.player.z = drops[0].z; f.run(1.2); assert.ok(f.shares.length >= 1 && f.shares.every(s => s.share === .12 && s.source === 'fire'), 'fire rain is a share of your full health');
  f.e.hp = f.e.maxHp * .3; f.e.phase = 'chase'; f.wilds.step(STEP, f.player); assert.equal(f.e.stage, 3); f.e.pulses.length = 0; f.e.forced = 'rain'; f.e.cooldown = 0; f.e.phase = 'chase'; f.wilds.step(STEP, f.player); assert.equal(f.e.pulses.filter(p => p.share).length, FIRE_RAIN.lateDrops);
  // The third stage: skills cool down × 0.8 more.
  const third = fight('dragon', { away: 5, clock }); third.e.def = { ...third.e.def, speed: 0 }; third.e.hp = third.e.maxHp * .32; third.cast('quake'); assert.ok(near(third.e.cooldown, 2 * .7 * .8, STEP + 1e-6));
  // The event ends: it flies away, and its health does not come back by the clock.
  clock.t = (calm + 1) * LAVA_CYCLE_SECONDS + 241; f.wilds.step(STEP, f.player); assert.equal(f.e.hp, 0); assert.deepEqual(f.events.filter(([k]) => k === 'depart').map(([, type]) => type), ['dragon']); assert.equal(f.e.respawn, Infinity); assert.equal(f.e.stage, 1);
  f.run(5); assert.equal(f.e.hp, 0);
  // Beaten during its event it stays away for the rest of it, also for a cell that is loaded again; the next event brings it back.
  let next = calm + 2; while (cycleEvent(next) !== 'dragon') next++;
  clock.t = next * LAVA_CYCLE_SECONDS + 5; f.wilds.step(STEP, f.player); assert.equal(f.e.hp, 12480); f.wilds.hit(f.e, 99999); assert.equal(f.e.respawn, Infinity);
  f.run(120); assert.equal(f.e.hp, 0); assert.equal(f.wilds.make(plan).hp, 0, 'made again in the same event: still beaten');
  clock.t = next * LAVA_CYCLE_SECONDS + 300; f.wilds.step(STEP, f.player); let after = next + 1; while (cycleEvent(after) !== 'dragon') after++;
  clock.t = after * LAVA_CYCLE_SECONDS + 5; f.wilds.step(STEP, f.player); assert.equal(f.e.hp, 12480, 'the next dragon event'); assert.equal(f.wilds.make(plan).hp, DRAGON_HP);
  // The test hook's override (window.willowmere.test.lavaEvent) is read through the same clock.
  const hooked = fight('dragon', { away: 40, clock: { t: calm * LAVA_CYCLE_SECONDS + 10 } }); assert.equal(hooked.e.hp, 0);
  try { forceLavaEvent('dragon'); hooked.wilds.step(STEP, hooked.player); assert.equal(hooked.e.hp, 12480); forceLavaEvent('normal'); hooked.wilds.step(STEP, hooked.player); assert.equal(hooked.e.hp, 0); } finally { forceLavaEvent(null); }
});
const aggroed = e => e.hp > 0 && e.phase !== 'idle' && e.phase !== 'return';

test('the magma turtle and the lava worm blast round themselves instead of running; the turtle\'s shell is soft only while it recovers', () => {
  const turtle = fight('magmaturtle', { away: 1.5, at: { x: -86.5, z: -230.5, region: 'lava' } });
  let charged = false; turtle.run(4, () => { charged ||= turtle.e.phase === 'charge'; });
  assert.equal(charged, false, 'it does not run'); assert.ok(turtle.blows.length >= 1 && turtle.blows.every(b => near(b.amount, 20 * 4.8 * 1.1)), 'its blast hits for 1.1 × inside 2.6 m');
  const shell = fight('magmaturtle', { away: 30, at: { x: -86.5, z: -230.5, region: 'lava' } }); assert.ok(near(shell.wilds.hit(shell.e, 100), 12), 'a blow of 100 takes 12'); shell.e.phase = 'recover'; assert.equal(shell.wilds.hit(shell.e, 100), 200, 'and 200 while it recovers');
  const worm = fight('lavaworm', { away: 1, at: { x: -86.5, z: -230.5, region: 'lava' } }); let ran = false; worm.run(4, () => { ran ||= worm.e.phase === 'charge'; });
  assert.equal(ran, false); assert.ok(worm.blows.some(b => near(b.amount, 22 * 4.8 * 1.3)));
  // The four that circle while their charge cools down.
  for (const type of ['firebat', 'thunderbird', 'jellyzap', 'wisp']) assert.equal(CREATURES[type].circles, true, type);
  const bat = fight('firebat', { away: 6, at: { x: -86.5, z: -230.5, region: 'lava' } }); bat.e.cooldown = 3; const angle0 = Math.atan2(bat.e.z - bat.player.z, bat.e.x - bat.player.x); let swept = 0, last = angle0;
  bat.run(2, () => { const a = Math.atan2(bat.e.z - bat.player.z, bat.e.x - bat.player.x); swept += Math.abs(Math.atan2(Math.sin(a - last), Math.cos(a - last))); last = a; });
  assert.ok(swept > 1, `it circles (${swept.toFixed(2)} rad in 2 s)`); assert.ok(near(Math.hypot(bat.e.x - bat.player.x, bat.e.z - bat.player.z), 5, 1.2), 'about 5 m out');
});

test('telegraphs are two instanced draws whatever their number, and the shots a pool the view can hold', () => {
  const fx = readFileSync(new URL('../src/combat-fx.mjs', import.meta.url), 'utf8'), view = readFileSync(new URL('../src/wilds-view.mjs', import.meta.url), 'utf8');
  assert.match(fx, /export const DECAL_MAX = 96;/); const made = readFileSync(new URL('../src/combat-fx-draw.mjs', import.meta.url), 'utf8'); assert.equal((made.match(/ = disc\(/g) ?? []).length, 2, 'two meshes: the base with its edge, and the fill (made by build(), in the half the split build fetches later)');
  const decal = fx.slice(fx.indexOf('  decal(x, z, r, progress'), fx.indexOf('  end() {')); assert.ok(decal.length > 100 && !/new T\./.test(decal), 'a disc makes nothing: it is an instance of the two meshes');
  assert.match(view, /new T\.MeshBasicMaterial\(\{ toneMapped: false \}\), 80\)/, 'the shots mesh holds 32 of the creatures\', 32 of the player\'s and sixteen spare');
  assert.equal(AI.shots, 32);
});
