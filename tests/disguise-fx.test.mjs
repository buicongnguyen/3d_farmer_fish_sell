// Zoo Garden's painter looks and summon rules on Combat (src/zoo-looks.mjs, src/disguise-skills.mjs): two small tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Combat } from '../src/combat.mjs';
import { install as installSpecial, SPECIALS } from '../src/skills-special.mjs';
import { install as installKits, hook, SUMMON_HP } from '../src/disguise-skills.mjs';
import { KITS } from '../src/disguise-kits.mjs';
import { LOOKS, MAX_PER_CAST, SHAPES } from '../src/zoo-looks.mjs';

installSpecial(Combat); installKits();
/** A fight with a plain host: `kit` is what host.special() answers (a disguise id or a weapon special). */
function fight(kit) {
  const me = { x: 0, z: 0, f: 0 }, list = [], looks = [], stats = { attack: 10, crit: 0, maxHp: 200, defense: 20, speed: 1 };
  const host = { position: () => me, facing: () => me.f, face: a => { me.f = a; }, targets: () => list, weapon: () => ({ kind: 'fist' }), special: () => kit, stats: () => stats, move: (dx, dz) => { me.x += dx; me.z += dz; }, heal: () => {},
    hit: (t, amount, crit, stun) => { t.hp -= amount; if (stun > 0) t.stun = Math.max(t.stun, stun); }, effect: (kind, x, z, r, f, id) => { if (kind === 'look') looks.push({ id, r, life: c.ll, color: c.lc }); } };
  const c = new Combat(host, () => .5), foe = (x, z, hp = 5000) => { const e = { x, z, hp, maxHp: hp, radius: .5, def: {}, stun: 0, slow: 0, cooldown: 0 }; list.push(e); return e; };
  const run = seconds => { for (let t = 0; t < seconds; t += 1 / 30) c.update(1 / 30); };
  return { c, me, list, looks, stats, host, foe, run };
}
/** Creatures as wilds.mjs hands them to life(): what the hook wraps. */
function lands(f) {
  const seen = [], hurts = [], shares = [], land = [];
  const wilds = { list: f.list, shots: [], hit: () => 0, host: { hurt: a => hurts.push(a), hurtShare: s => shares.push(s) }, life(e, dt, target) { seen.push(target); } };
  const pandora = { wilds, combat: f.c, hurtFraction: s => { land.push(s); return s; } }; hook(pandora);
  return { wilds, pandora, seen, hurts, shares, land };
}

test('every look a kit skill, a weapon special or a base skill asks for is one of Zoo\'s builders (or a known plain one) and paints within a cast\'s budget', () => {
  const PLAIN = new Set(['', 'swing', 'hero', 'st_fear', 'st_blind', 'st_charm', 'st_taunt', 'holyhit', 'eyes', 'burn', 'shock', 'boulder', 'fist', 'crescent', 'dragon', 'nova', 'blizzard']), ALIAS = { laser: 'rainbow' }, used = new Set();
  const cast = (kit, index) => { const f = fight(kit); for (let i = 0; i < 3; i++) f.foe(Math.sin(i) * 2.5, 2.5 + i * .4); assert.ok(f.c.skill(index), `${kit}/${index} casts with creatures in reach`); f.run(4); for (const l of f.looks) { used.add(l.id); if (!PLAIN.has(l.id)) assert.ok(LOOKS[ALIAS[l.id] ?? l.id], `${kit}/${index}: look "${l.id}" is not in Zoo's table`); } return f; };
  for (const id of Object.keys(KITS)) for (let i = 0; i < 4; i++) cast(id, i);
  for (const id of Object.keys(SPECIALS)) cast(id, 3);
  const base = [0, 1, 2].map(i => cast('fist', i).looks.map(l => l.id)); assert.deepEqual([base[0][0], base[1][0], base[2].includes('crater')], ['whirl', 'rush', true], 'whirlwind, dash and slam are drawn by Zoo\'s looks');
  for (const want of ['sandbag', 'lighthouse', 'tree'].map(k => k === 'sandbag' ? 'dust' : k === 'tree' ? 'roots' : 'dust').concat(['flare', 'parachute', 'whistle', 'ribbon', 'fan', 'lantern', 'kite', 'ink', 'dragondance', 'starshield', 'torch', 'firework', 'bamboo', 'drum', 'bigstar'])) assert.ok(used.has(want), `the uniform kits use Zoo's "${want}"`);
  // Each builder, at three moments of its life, at full density: only known shapes, finite numbers, at most MAX_PER_CAST pieces.
  let n = 0; const painter = { put(kind, color, ...rest) { n++; assert.ok(SHAPES.includes(kind) && typeof color === 'string' && rest.every(v => v === undefined || Number.isFinite(v)), `${kind} ${color} ${rest}`); } };
  for (const id of used) { const fn = LOOKS[ALIAS[id] ?? id]; if (!fn) continue; for (const t of [.05, .5, .95]) { n = 0; fn(painter, { x: 1, y: .12, z: 2, r: 4, t, a: t * 1.5, f: .7, color: '#ff8fb1', n: 1, life: 1.5 }); assert.ok(n > 0 && n <= MAX_PER_CAST, `${id} paints ${n}`); } }
});

test('summons take the creatures\' blows, the hidden hero is lost, a sheep is harmless and comes back, armour softens the lands, a disguise fights with its own weapon', () => {
  // Shadow clones: four, each a quarter of your health; a creature near one goes for it and its blow lands on the clone.
  let f = fight('dz_ninja'), w = lands(f); const far = f.foe(0, 5); assert.ok(f.c.skill(0));
  const clones = f.c.al.filter(a => a.live && a.kind === 'clone'); assert.equal(clones.length, 4); assert.equal(clones[0].maxHp, Math.round(200 * SUMMON_HP.clone.hp));
  w.wilds.life(far, .1, f.me, '', f.me, []); assert.notEqual(w.seen[0], f.me, 'the creature is handed a clone as its target'); assert.equal(far.lure?.kind, 'clone');
  const mark = far.lure; w.wilds.host.hurt(30, 'melee', far); assert.equal(mark.hp, 20); assert.deepEqual(w.hurts, []); w.wilds.host.hurt(30, 'melee', far); assert.equal(mark.live, false, 'a clone out of hit points is gone'); assert.equal(f.c.al.filter(a => a.live).length, 3);
  f.run(9); assert.equal(f.c.al.filter(a => a.live).length, 0, 'clones last 8 s');
  // Vanish: creatures lose you (no target), and you are not simply untouchable.
  f = fight('dz_ninja'); w = lands(f); const near = f.foe(0, 3); f.c.skill(1); f.run(.1); f.me.x = 9; w.wilds.life(near, .1, f.me, '', f.me, []); assert.ok(w.seen[0] !== f.me && w.seen[0].x === 0, 'it looks where you vanished'); w.wilds.host.hurt(10, 'melee', near); assert.deepEqual(w.hurts, [], 'and strikes at nothing'); assert.equal(f.c.invulnerable, false);
  // Sheep spell: 6 s, harmless meanwhile, itself again afterwards.
  f = fight('dz_mage'); w = lands(f); const ewe = f.foe(0, 4); f.c.skill(2); assert.ok(ewe.sheep > 5.9); w.wilds.host.hurt(10, 'melee', ewe); assert.deepEqual(w.hurts, []); f.run(6.3); assert.ok(!(ewe.sheep > 0)); assert.ok(f.looks.some(l => l.id === 'poof')); w.wilds.host.hurt(10, 'melee', ewe); assert.deepEqual(w.hurts, [10]);
  // Challenge: +80 defence on 20 of your own, for blows and for the lands' own damage (lava, fire rain).
  f = fight('dz_knight'); w = lands(f); f.foe(0, 4); f.c.skill(2); assert.ok(Math.abs(f.c.taken - 80 / 160) < 1e-9); w.wilds.host.hurtShare(.2, 'fire'); w.pandora.hurtFraction(.2, 'lava'); assert.ok(Math.abs(w.shares[0] - .1) < 1e-9 && Math.abs(w.land[0] - .1) < 1e-9);
  // Scout parrot: it flies out, pecks and marks. Binding tree: 3 m ahead, roots hold for 4 s, creatures may attack it.
  f = fight('dz_pirate'); w = lands(f); const prey = f.foe(0, 6); f.c.skill(2); f.run(2.5); assert.ok(prey.mark > 0 && prey.hp < 5000, 'pecked and marked');
  f = fight('dz_fairy'); w = lands(f); const held = f.foe(0, 5); f.c.skill(3); const tree = f.c.al.find(a => a.live && a.kind === 'tree'); assert.ok(tree && Math.abs(tree.z - 3) < 1e-9 && tree.maxHp === 160); assert.ok(held.stun > 3.9);
  assert.equal(f.host.weapon().kind, 'gun', 'the fairy fights with her own bubble wand'); assert.equal(f.host.weapon().shot, 'bubble');
});
