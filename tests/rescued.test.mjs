// The missing workers (src/rescued.mjs): three small tests. Where the huts stand, what every person has, and saves.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PEOPLE, PERSON, HUT_GAP, HUT_RADIUS, HUT_RULE, hutSpot, hutClear, hutState, hutStatuses, postsFor, rescuedList, heldIn, peopleHtml, THANKS } from '../src/rescued.mjs';
import { DENS, REGION, OUTPOSTS, regionAt, borderDistance, trailDistance } from '../src/regions.mjs';
import { landClear } from '../src/land-features.mjs';
import { cageSpot, FRIEND_IDS } from '../src/friends.mjs';
import { FACILITIES } from '../src/facility-plans.mjs';
import { RESIDENTS } from '../src/content.mjs';
import { outfitOf, outfitKey } from '../src/outfits.mjs';
import { freshState, parseSave, act } from '../src/game.mjs';
import { TALK } from '../src/rescued-talk.mjs';
import { t, setLanguage } from '../src/i18n.mjs';

const far = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

test('a hut stands in every land that has a boss, clear of its den, borders, ponds, outposts, cages and the trail', () => {
  const lands = Object.keys(REGION).filter(id => DENS.some(d => d.region === id && !d.titan && !d.event));
  assert.equal(lands.length, 12); assert.deepEqual(PEOPLE.map(p => p.land).sort(), [...lands].sort(), 'one rescue for each land with a boss');
  const spots = PEOPLE.map(p => {
    const s = hutSpot(p.id), den = DENS.find(d => d.id === p.den);
    assert.ok(den && !den.titan && den.region === p.land && den.type === p.boss, `${p.id}: the den is the land's boss`);
    assert.ok(s.clear && hutClear(s.x, s.z, den), `${p.id}: the rule holds at (${s.x}, ${s.z})`);
    assert.equal(regionAt(s.x, s.z), p.land);
    const d = far(s, den); assert.ok(d >= HUT_GAP - .05 && d <= HUT_GAP + 4.05, `${p.id}: ${d.toFixed(1)} m from the den`);
    assert.ok(d < den.clear, `${p.id}: inside the den's clearing, where no common creature is placed`);
    assert.ok(borderDistance(s.x, s.z) >= HUT_RULE.border && trailDistance(s.x, s.z) >= HUT_RULE.trail && landClear(s.x, s.z, HUT_RADIUS + .6));
    for (const o of OUTPOSTS) assert.ok(far(o, s) >= HUT_RULE.outpost);
    for (const other of DENS) if (other !== den) assert.ok(far(other, s) >= HUT_RULE.den);
    for (const id of FRIEND_IDS) assert.ok(far(cageSpot(id), s) >= HUT_RULE.cage, `${p.id}: clear of ${id}'s cage`);
    assert.equal(hutSpot(p.id), s, 'the same spot on every call');
    return s;
  });
  for (let i = 0; i < spots.length; i++) for (let k = i + 1; k < spots.length; k++) assert.ok(far(spots[i], spots[k]) > 40);
});

test('every missing worker has a post, a hut, an unlock, an outfit of their own, a conversation and Vietnamese', () => {
  const glb = readFileSync(new URL('../public/assets/models/rescue-huts.glb', import.meta.url)), json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8')), nodes = new Set(json.nodes.map(n => n.name));
  for (const part of ['hut_door', 'hut_bar', 'hut_captive']) assert.ok(nodes.has(part), part);
  const names = new Set(RESIDENTS.map(p => p.name)), looks = new Set(RESIDENTS.map(p => outfitKey(outfitOf(p)))), posts = [];
  assert.equal(PEOPLE.length, 12); assert.equal(new Set(PEOPLE.map(p => p.hut)).size, 12, 'twelve hut styles');
  setLanguage('vi');
  try {
    for (const p of PEOPLE) {
      assert.ok(!names.has(p.name) && !RESIDENTS.some(r => r.id === p.id), `${p.name} is nobody the village already has`); names.add(p.name);
      assert.ok(nodes.has('hut_' + p.hut), `${p.id}: hut_${p.hut} is in rescue-huts.glb`);
      const plan = FACILITIES[p.plan]; assert.ok(plan, `${p.id}: the plan ${p.plan}`);
      assert.ok(plan.rooms.some(r => p.post.x > r.rect.x0 + .5 && p.post.x < r.rect.x1 - .5 && p.post.z > r.rect.z0 + .5 && p.post.z < r.rect.z1 - .5), `${p.id}: the post is inside a room`);
      for (const at of [...Object.values(plan.staff), ...posts.filter(o => o.plan === p.plan)]) assert.ok(far(at, p.post) >= 1.2, `${p.id}: nobody else stands on the post`);
      posts.push({ plan: p.plan, ...p.post });
      const key = outfitKey(outfitOf(p)); assert.ok(!looks.has(key), `${p.id}: an outfit nobody else wears`); looks.add(key);
      assert.ok(p.unlock.length > 10 && Object.keys(p.perk).length >= 1 && p.role && p.line);
      for (const text of [p.name, p.role, p.line, p.unlock, THANKS[p.id]]) assert.notEqual(t(text), text, `Vietnamese for “${text}”`);
      const talk = TALK[p.id]; assert.deepEqual(Object.keys(talk), ['root', 'adv', 'job']);
      for (const node of Object.values(talk)) {
        assert.equal(node.choices.length, 3); assert.notEqual(t(node.say), node.say);
        for (const c of node.choices) { assert.notEqual(t(c.text), c.text); if (c.reply) assert.notEqual(t(c.reply), c.reply); assert.ok(c.next === undefined || talk[c.next]); }
      }
    }
    assert.notEqual(t('🔒 Tilly is shut inside. The boss of this land holds the key.'), '🔒 Tilly is shut inside. The boss of this land holds the key.');
    assert.ok(!/Tilly/.test(t('🏠 Tilly is free and hurries home to work: School cook.')));
  } finally { setLanguage('en'); }
});

test('an old save loads with nobody rescued; a rescue is kept, shows at the facility and brings its perk once a day', () => {
  const old = JSON.parse(JSON.stringify(freshState())); delete old.rescued; delete old.rescuedPerk;
  let s = parseSave(old); assert.deepEqual(s.rescued, {}); assert.deepEqual(s.rescuedPerk, {});
  assert.deepEqual(parseSave({ ...old, rescued: { tilly: 3, nobody: 2, gus: 'x', nora: -1 } }).rescued, { tilly: 3 });
  // Box shut: no huts, nobody held, the village as it was.
  assert.equal(hutState('tilly', s), 'hidden'); assert.equal(hutStatuses(s).length, 0); assert.equal(heldIn('west', s), null); assert.equal(peopleHtml(s), ''); assert.deepEqual(postsFor('school', s), []);
  assert.equal(act(s, 'hut', { id: 'tilly' }).ok, false);
  // Box open: barred until the land's boss is beaten, then it opens, once, from beside the hut.
  s.pandora = true; const at = hutSpot('tilly');
  assert.equal(hutState('tilly', s), 'barred'); assert.equal(hutStatuses(s).length, 12); assert.equal(heldIn('west', s).id, 'tilly');
  assert.match(act(s, 'hut', { id: 'tilly', x: at.x, z: at.z + 2 }).message, /Tilly is shut inside/);
  s.defeated.treant = true; assert.equal(hutState('tilly', s), 'open'); assert.equal(hutState('gus', s), 'barred');
  assert.equal(act(s, 'hut', { id: 'tilly', x: at.x + 30, z: at.z }).ok, false, 'not from afar');
  const r = act(s, 'hut', { id: 'tilly', x: at.x, z: at.z + 2.5 }); assert.ok(r.ok && r.hello === THANKS.tilly); assert.equal(s.rescued.tilly, s.day);
  assert.equal(hutState('tilly', s), 'rescued'); assert.equal(act(s, 'hut', { id: 'tilly', x: at.x, z: at.z }).ok, false); assert.equal(heldIn('west', s), null);
  assert.deepEqual(postsFor('school', s).map(o => [o.p.id, o.at]), [['tilly', PERSON.tilly.post]]); assert.deepEqual(rescuedList(s), [PERSON.tilly]);
  assert.match(peopleHtml(s), /1 of 12 are back/);
  // The perk: once a day; and passive perks on the civic actions.
  s.energy = 40; assert.ok(act(s, 'perk', { id: 'tilly' }).ok); assert.equal(s.energy, 65); assert.equal(act(s, 'perk', { id: 'tilly' }).ok, false); assert.equal(act(s, 'perk', { id: 'nora' }).ok, false, 'Nora is not back');
  const before = s.coins; assert.ok(act(s, 'civic', { id: 'police' }).ok); assert.equal(s.coins, before + 40);
  s.rescued.gus = s.day; s.civicDay.police = 0; s.energy = 60; const c2 = s.coins; assert.ok(act(s, 'civic', { id: 'police' }).ok); assert.equal(s.coins, c2 + 55, 'Gus: the patrol pays 15 more');
  // Saved, loaded, and the box shut again: the rescued stay, the huts go.
  s = parseSave(JSON.parse(JSON.stringify(s))); assert.deepEqual(s.rescued, { tilly: 1, gus: 1 }); assert.equal(s.rescuedPerk.tilly, 1);
  s.pandora = false; assert.equal(hutStatuses(s).length, 0); assert.equal(postsFor('school', s).length, 1); assert.match(peopleHtml(s), /Tilly/); assert.ok(!/held in/.test(peopleHtml(s)));
  s.day++; s.energy = 10; assert.ok(act(s, 'perk', { id: 'tilly' }).ok, 'again the next day');
});
