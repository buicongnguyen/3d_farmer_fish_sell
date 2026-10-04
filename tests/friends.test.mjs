// Rescued friends (round 8; owner: builder E). Step 0 wrote the first two geometry tests; the rules below them are the reference's
// cases (cute_game tests/friends.test.ts, tests/w9-review.test.ts:73-77) ported to Willowmere's helper model (spec 12.3, 16).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FRIENDS, CAGES, CAGE_GAP, CAGE_RADIUS, RESCUE_REACH, cageCandidates, cageSpot, POSTS, POST_GAP, hiredSpots, postClear, postSpot,
  FRIEND_IDS, RESCUE_LINES, FRIEND_YIELDS, GROWTH, cageState, cageStatuses, cageLabel, lockedHint, parseFriends, friendYield, friendsLine, friendsAct, friendStage, friendHeight, followGoal, following } from '../src/friends.mjs';
import { DENS, REGION, gridBorderDistance, regionAt } from '../src/regions.mjs';
import { FIELD_TILE, fieldTrees, fieldCards } from '../src/field-layout.mjs';
import { freshState, act, parseSave, ACTIONS, payWorkers } from '../src/game.mjs';
import { JOBS, RECIPES, ITEMS } from '../src/content.mjs';
import { SAFE } from '../src/ward.mjs';
import { inSafeZone } from '../src/ward.mjs';
import { reserved, inBlock, blockedAt } from '../src/village-plan.mjs';
import { onWay } from '../src/lots.mjs';
import { JOB_SPOTS } from '../src/villagers.mjs';

test('each cage stands 6.5 m from its den, on its village side, inside its region and clear of the borders', () => {
  assert.deepEqual(Object.keys(CAGES), Object.keys(FRIENDS));
  for (const [id, cage] of Object.entries(CAGES)) {
    const den = DENS.find(d => d.id === cage.den), at = cageSpot(id); assert.ok(den, id); assert.equal(den.type, cage.boss); assert.equal(den.region, cage.region);
    assert.ok(Math.abs(Math.hypot(at.x - den.x, at.z - den.z) - CAGE_GAP) < 1e-9); assert.ok(Math.hypot(at.x, at.z) < Math.hypot(den.x, den.z), 'toward the village');
    assert.equal(regionAt(at.x, at.z), cage.region); assert.ok(gridBorderDistance(at.x, at.z) > 29.5, id); assert.equal(cageSpot(id), at, 'the same spot on every call'); assert.ok(CAGE_RADIUS < 4, 'an ordinary block of the 8 m grid');
  }
});

test('each friend\'s post is at the homestead, where a friend may stand: off the ways, clear of buildings and trees, clear of the hired neighbours', () => {
  // The spots a hired neighbour stands on: every job's spot and 1.2 m to either side (villagers.mjs placeOf 'job:').
  const hired = hiredSpots(); assert.equal(hired.length, Object.keys(JOB_SPOTS).length * 3); assert.ok(hired.some(s => s.x === 13.8 && s.z === -12.4), 'a herder can stand at (13.8, -12.4)');
  for (const id of Object.keys(FRIENDS)) {
    const want = POSTS[id], at = postSpot(id); assert.ok(want && at, id);
    assert.deepEqual(at, want, id + ': the wanted post is clear as it is'); assert.equal(postSpot(id), at); assert.equal(postClear(at.x, at.z), true);
    assert.ok(inSafeZone(at.x, at.z)); assert.equal(blockedAt(at.x, at.z, .6), false); assert.equal(inBlock(at.x, at.z, .6), false); assert.equal(onWay(at.x, at.z), false);
    for (const s of hired) assert.ok(Math.hypot(s.x - at.x, s.z - at.z) >= POST_GAP, `${id}: ${POST_GAP} m from a hired neighbour at (${s.x}, ${s.z})`);
    // The homestead is reserved ground, so reserved() is NOT part of the rule: it would send every friend off the farm.
    assert.equal(reserved(at.x, at.z), true, id + ': on the homestead');
  }
  // The measured clearances the spec states: Sprout 2.9 m, Clover 2.7 m, Pepper 13 m from the nearest hired neighbour.
  const nearest = id => Math.min(...hired.map(s => Math.hypot(s.x - POSTS[id].x, s.z - POSTS[id].z)));
  assert.ok(Math.abs(nearest('sprout') - 2.91) < .01); assert.ok(Math.abs(nearest('clover') - 2.73) < .01); assert.ok(nearest('pepper') > 13);
  // The rule itself: not on the road, not in the house, not on a hired neighbour, not beyond the ward.
  assert.equal(postClear(0, -14), false, 'inside the homestead house'); assert.equal(postClear(15, -12.4), false, 'on the herder'); assert.equal(postClear(200, 0), false, 'outside the ward');
  assert.equal(postSpot('nobody'), null);
});

// ---------------------------------------------------------------- the rules (builder E)
const opened = change => { const s = freshState(); s.started = true; s.pandora = true; change?.(s); return s; };
const beside = (id, d = 1.5) => { const at = cageSpot(id); return { id, x: at.x + d, z: at.z }; };

test('twelve candidates, each 6.5 m from the den, the first toward the village; the chosen spot is clear of every blocking piece', () => {
  for (const [id, cage] of Object.entries(CAGES)) {
    const den = DENS.find(d => d.id === cage.den), spots = cageCandidates(den.x, den.z);
    assert.equal(spots.length, 12); for (const p of spots) assert.ok(Math.abs(Math.hypot(p.x - den.x, p.z - den.z) - CAGE_GAP) < 1e-9);
    const k = CAGE_GAP / Math.hypot(den.x, den.z); assert.ok(Math.abs(spots[0].x - den.x * (1 - k)) < 1e-9 && Math.abs(spots[0].z - den.z * (1 - k)) < 1e-9, id + ': the first candidate is on the line to (0, 0)');
    assert.equal(new Set(spots.map(p => `${p.x.toFixed(3)},${p.z.toFixed(3)}`)).size, 12);
    // Clear of every blocking piece of the tiles round it by the piece's radius + 1.1 m, and one of the twelve.
    const at = cageSpot(id); assert.ok(spots.some(p => p.x === at.x && p.z === at.z)); assert.ok(Object.isFrozen(at));
    const tx = Math.floor(at.x / FIELD_TILE), tz = Math.floor(at.z / FIELD_TILE);
    for (let i = tx - 1; i <= tx + 1; i++) for (let j = tz - 1; j <= tz + 1; j++) for (const t of fieldTrees(i, j)) assert.ok(Math.hypot(t.x - at.x, t.z - at.z) >= t.r + 1.1, `${id}: clear of the piece at (${t.x.toFixed(1)}, ${t.z.toFixed(1)})`);
    // With the keep-out circle fields.mjs builds from cageSpot, no card stands within 2 m of a cage.
    for (let i = tx - 1; i <= tx + 1; i++) for (let j = tz - 1; j <= tz + 1; j++) for (const c of fieldCards(i, j, [{ x: at.x, z: at.z, r: 2 }])) assert.ok(Math.hypot(c.x - at.x, c.z - at.z) >= 2, id + ': a card within 2 m');
  }
  // cageSpot reads fieldTrees only: neither it nor its file touches the cards, so the two never call each other.
  const source = readFileSync(new URL('../src/friends.mjs', import.meta.url), 'utf8');
  assert.ok(!/fieldCards|fieldPlan/.test(source)); assert.ok(!/from '\.\/(game|pandora|wilds)\.mjs'/.test(source), 'below game.mjs, pandora.mjs and wilds.mjs in the import chain');
});

test('a cage opens only after its own boss, never locks again, and every cage is hidden while the box is shut', () => {
  const s = opened();
  assert.deepEqual(FRIEND_IDS, ['sprout', 'clover', 'pepper']); assert.deepEqual(FRIEND_IDS.map(id => CAGES[id].boss), ['treant', 'bear', 'robot']);
  assert.equal(cageState(s, 'sprout'), 'locked'); assert.equal(cageState(s, 'clover'), 'locked'); assert.equal(cageState(s, 'pepper'), 'hidden');
  assert.deepEqual(cageStatuses(s).map(c => [c.id, c.den, c.state]), [['sprout', 'w:den:treant', 'locked'], ['clover', 'w:den:bear', 'locked']]);
  // Another home boss opens nothing; a common kind opens nothing.
  s.defeated.croc = true; s.defeated.mushking = true; s.defeated.wolf = true; assert.equal(cageState(s, 'sprout'), 'locked'); assert.equal(cageState(s, 'clover'), 'locked'); assert.equal(cageState(s, 'pepper'), 'hidden');
  s.defeated.treant = true; assert.equal(cageState(s, 'sprout'), 'open'); assert.equal(cageState(s, 'clover'), 'locked');
  s.defeated.bear = true; assert.equal(cageState(s, 'clover'), 'open'); assert.equal(cageState(s, 'pepper'), 'hidden', 'the bear is a home boss');
  // Pepper: any boss, titan or dragon of a land, her own robot need not be the one.
  for (const den of DENS.filter(d => REGION[d.region].kind === 'land')) { const t = opened(x => { x.defeated[den.type] = true; }); assert.equal(cageState(t, 'pepper'), 'open', den.type); assert.equal(cageState(t, 'sprout'), 'locked'); }
  for (const den of DENS.filter(d => REGION[d.region].kind === 'home')) assert.equal(cageState(opened(x => { x.defeated[den.type] = true; }), 'pepper'), 'hidden', den.type);
  // `defeated` only ever gains kinds (the 'defeat' action), so a boss coming back cannot lock a cage again: beating it twice changes nothing.
  s.defeated.gorilla = true; const twice = opened(x => { x.defeated = { ...s.defeated }; }); assert.deepEqual(cageStatuses(twice).map(c => c.state), ['open', 'open', 'open']);
  // The list is reused, carries the spot, and is empty with the box shut.
  const list = []; assert.equal(cageStatuses(s, list), list); assert.equal(list.length, 3); for (const c of list) { const at = cageSpot(c.id); assert.equal(c.x, at.x); assert.equal(c.z, at.z); }
  s.pandora = false; for (const id of FRIEND_IDS) assert.equal(cageState(s, id), 'hidden'); assert.equal(cageStatuses(s, list).length, 0);
  s.friends = [{ id: 'sprout', rescuedAt: 1, home: true }]; assert.equal(cageState(s, 'sprout'), 'hidden', 'an empty cage is gone too while the box is shut'); s.pandora = true; assert.equal(cageState(s, 'sprout'), 'rescued');
  assert.equal(cageState(s, 'nobody'), 'hidden'); assert.equal(cageState(null, 'sprout'), 'hidden');
  // Labels and the locked line (cute_game friend-crew.ts:94, main.ts:775).
  assert.equal(cageLabel('sprout', 'locked'), '🔒 Locked cage'); assert.equal(cageLabel('sprout', 'open'), '🗝️ Sprout'); assert.equal(cageLabel('sprout', 'rescued'), '');
  assert.equal(lockedHint('sprout'), 'Defeat the Ancient Treant nearby to open this cage.'); assert.equal(lockedHint('clover'), 'Defeat the King Bear nearby to open this cage.');
});

test('rescue works only from an open cage, only from within 2.4 m, and only once', () => {
  const s = opened(); s.day = 4;
  assert.ok(ACTIONS.has('rescue') && ACTIONS.has('friendHome'));
  let r = act(s, 'rescue', beside('sprout')); assert.equal(r.ok, false); assert.equal(r.message, '🔒 Defeat the Ancient Treant nearby to open this cage.'); assert.deepEqual(s.friends, []);
  r = act(s, 'rescue', beside('pepper')); assert.equal(r.ok, false); assert.ok(r.message.length > 3); // no cage there at all
  for (const bad of [{}, { id: 'nobody' }, { id: 7 }, null]) { r = friendsAct(s, 'rescue', bad ?? undefined); assert.equal(r.ok, false); assert.ok(r.message.length > 3); }
  s.defeated.treant = true;
  r = act(s, 'rescue', beside('sprout', RESCUE_REACH + .05)); assert.equal(r.ok, false); assert.match(r.message, /Walk up to the cage/); assert.deepEqual(s.friends, []);
  r = act(s, 'rescue', { id: 'sprout', x: 0, z: 0 }); assert.equal(r.ok, false, 'not from the village');
  s.position = { x: 0, z: -8 }; r = act(s, 'rescue', { id: 'sprout' }); assert.equal(r.ok, false, 'without a place the save\'s own position counts');
  s.pandora = false; r = act(s, 'rescue', beside('sprout')); assert.equal(r.ok, false, 'no cage while the box is shut'); s.pandora = true;
  r = act(s, 'rescue', beside('sprout', RESCUE_REACH - .01)); assert.equal(r.ok, true); assert.equal(r.id, 'sprout');
  assert.equal(r.message, '💖 ' + RESCUE_LINES.sprout[1]); assert.equal(r.hello, 'Thank you! I am Sprout.');
  assert.deepEqual(s.friends, [{ id: 'sprout', rescuedAt: 4, home: false }]); assert.equal(cageState(s, 'sprout'), 'rescued'); assert.deepEqual(following(s).map(f => f.id), ['sprout']);
  r = act(s, 'rescue', beside('sprout')); assert.equal(r.ok, false); assert.match(r.message, /already free/); assert.equal(s.friends.length, 1);
  // No coins and no item for the rescue itself.
  const fresh = opened(); assert.equal(s.coins, fresh.coins); assert.deepEqual(s.inventory, fresh.inventory);
  // The reference's lines, unchanged.
  assert.deepEqual(RESCUE_LINES.clover, ['You beat the bear! I am Clover.', 'It caught me sharing its honey with hens. I will care for your animals!']);
  assert.deepEqual(RESCUE_LINES.pepper, ['Free at last! I am Pepper.', 'The robot wanted a cook who never sleeps. I would love to cook for you!']);
  // From the save's own position, standing by the cage.
  const t = opened(x => { x.defeated.bear = true; const at = cageSpot('clover'); x.position = { x: at.x, z: at.z + 2 }; }); assert.equal(act(t, 'rescue', { id: 'clover' }).ok, true);
});

test('a follower arrives when you stand inside the ward, and at once when the box shuts', () => {
  const s = opened(x => { x.defeated.treant = x.defeated.bear = true; });
  let r = act(s, 'friendHome', { x: 0, z: 0 }); assert.equal(r.ok, false); assert.ok(r.message.length > 3); // nobody is following
  assert.equal(act(s, 'rescue', beside('sprout')).ok, true); assert.equal(act(s, 'rescue', beside('clover')).ok, true);
  r = act(s, 'friendHome', beside('sprout')); assert.equal(r.ok, false); assert.match(r.message, /Sprout and Clover will follow you/);
  r = act(s, 'friendHome', { x: SAFE.x0 - 1, z: 0 }); assert.equal(r.ok, false, 'a metre outside the ward'); assert.equal(following(s).length, 2);
  assert.equal(friendsLine(s), 'Rescued friends 2 / 3 · Sprout is following you home · Clover is following you home');
  r = act(s, 'friendHome', { x: SAFE.x0 + 1, z: 0 }); assert.equal(r.ok, true); assert.equal(r.message, '🏡 Sprout and Clover reached Willowmere and went to work!'); assert.deepEqual(r.ids, ['sprout', 'clover']);
  assert.ok(s.friends.every(f => f.home === true)); assert.equal(act(s, 'friendHome', { x: 0, z: 0 }).ok, false, 'once');
  assert.match(friendsLine(s), /^Rescued friends 2 \/ 3 · Sprout tends the beds: 3 carrots and 2 radishes each morning · Clover cares for the animals/);
  assert.equal(friendsLine(freshState()), ''); assert.equal(friendsLine({}), '');
  // The box shut while a friend still follows: it counts as arrived wherever you are.
  const t = opened(x => { x.defeated.treant = true; }); act(t, 'rescue', beside('sprout')); t.pandora = false;
  r = act(t, 'friendHome', beside('sprout')); assert.equal(r.ok, true); assert.equal(r.message, '🏡 Sprout reached Willowmere and went to work!'); assert.equal(t.friends[0].home, true);
  // Followers stand behind you and to your left, a row each (cute_game friend-crew.ts followGoal): facing +z from the origin.
  const a = followGoal({ x: 0, z: 0 }, 0, 0), b = followGoal({ x: 0, z: 0 }, 0, 1);
  assert.ok(Math.abs(a.x + .8) < 1e-9 && Math.abs(a.z + 1.6) < 1e-9); assert.ok(Math.abs(b.x - .8) < 1e-9 && Math.abs(b.z + 2.4) < 1e-9);
});

test('morning yields: Sprout the farmhand\'s, Clover the herder\'s, Pepper one Garden soup, and no wage', () => {
  assert.deepEqual(FRIEND_YIELDS.sprout, JOBS.farmhand.yields); assert.deepEqual(FRIEND_YIELDS.clover, JOBS.herder.yields); assert.deepEqual(FRIEND_YIELDS.pepper, { soup: 1 });
  assert.ok(RECIPES.soup && ITEMS.soup); for (const y of Object.values(FRIEND_YIELDS)) for (const item of Object.keys(y)) assert.ok(ITEMS[item], item);
  const s = freshState(); s.friends = [{ id: 'sprout', rescuedAt: 1, home: true }, { id: 'clover', rescuedAt: 1, home: false }];
  const coins = s.coins, had = { ...s.inventory };
  let r = act(s, 'sleep'); assert.equal(r.ok, true); assert.match(r.message, / · Sprout filled your basket\.$/); assert.equal(s.coins, coins, 'no wage');
  assert.equal(s.inventory.carrot, (had.carrot ?? 0) + 3); assert.equal(s.inventory.radish, (had.radish ?? 0) + 2); assert.equal(s.inventory.egg ?? 0, had.egg ?? 0, 'a friend still on the way brings nothing');
  s.friends[1].home = true; s.friends.push({ id: 'pepper', rescuedAt: 2, home: true });
  r = act(s, 'sleep'); assert.match(r.message, / · Sprout, Clover and Pepper filled your basket\.$/); assert.equal(s.coins, coins);
  assert.equal(s.inventory.carrot, (had.carrot ?? 0) + 6); assert.equal(s.inventory.egg, (had.egg ?? 0) + 2); assert.equal(s.inventory.milk, (had.milk ?? 0) + 1); assert.equal(s.inventory.soup, (had.soup ?? 0) + 1);
  // Beside a hired neighbour: the wage is the neighbour's alone, and both lines show.
  const t = freshState(); t.hired = { ada: 'farmhand' }; t.friends = [{ id: 'clover', rescuedAt: 1, home: true }]; const before = t.coins;
  const line = payWorkers(t); assert.equal(t.coins, before - JOBS.farmhand.wage); assert.match(line, /1 helper paid 40 coins and filled your basket\..* · Clover filled your basket\.$/);
  // Nobody home: nothing is added and the line is untouched (tests/farm.test.mjs holds the hired line).
  const u = freshState(), bag = { ...u.inventory }; assert.equal(friendYield(u), ''); assert.deepEqual(u.inventory, bag);
  assert.equal(friendYield({ friends: [{ id: 'sprout', rescuedAt: 0, home: true }] }), ' · Sprout filled your basket.');
});

test('friends grow by days: 0.5 of your height when freed, 0.75 after a day, 0.8 after three', () => {
  assert.deepEqual(GROWTH.map(g => [g.height, g.days]), [[.5, 0], [.75, 1], [.8, 3]]);
  const f = { id: 'sprout', rescuedAt: 10, home: true };
  assert.deepEqual([10, 11, 12, 13, 14, 400].map(day => friendHeight(f, day)), [.5, .75, .75, .8, .8, .8]);
  assert.deepEqual([10, 11, 13].map(day => friendStage(f, day)), [0, 1, 2]);
  assert.equal(friendHeight(f, 9), .5, 'a clock set back never shrinks below the first stage'); assert.equal(friendHeight(null, 0), .5, 'a prisoner'); assert.equal(friendHeight(f, NaN), .5);
});

test('the save keeps the friends: a round trip, an old save, and junk dropped', () => {
  const s = opened(x => { x.defeated.treant = true; x.day = 6; }); act(s, 'rescue', beside('sprout')); s.friends.push({ id: 'pepper', rescuedAt: 2, home: true });
  const back = parseSave(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(back.friends, [{ id: 'sprout', rescuedAt: 6, home: false }, { id: 'pepper', rescuedAt: 2, home: true }]); assert.equal(cageState(back, 'sprout'), 'rescued');
  const old = JSON.parse(JSON.stringify(freshState())); delete old.friends; assert.deepEqual(parseSave(old).friends, []);
  // At most three, each id once and one of the three, a finite rescuedAt and a boolean home; anything else is dropped.
  assert.deepEqual(parseFriends([{ id: 'sprout', rescuedAt: 3, home: true }, { id: 'sprout', rescuedAt: 9, home: false }, { id: 'ada', rescuedAt: 1, home: true }, { id: 'clover', rescuedAt: '4', home: true }, { id: 'clover', rescuedAt: 4, home: 1 },
    { id: 'clover', rescuedAt: Infinity, home: true }, null, 7, 'pepper', ['pepper'], { id: 'pepper', rescuedAt: 2.7, home: false, gear: { hat: 'crown' }, extra: 1 }]), [{ id: 'sprout', rescuedAt: 3, home: true }, { id: 'pepper', rescuedAt: 2, home: false }]);
  for (const junk of [undefined, null, 'everyone', 7, {}, { 0: { id: 'sprout', rescuedAt: 1, home: true } }]) assert.deepEqual(parseFriends(junk), []);
  assert.deepEqual(parseFriends([{ id: '__proto__', rescuedAt: 1, home: true }, { id: 'constructor', rescuedAt: 1, home: true }, { id: 'pepper', rescuedAt: -4, home: true }]), [{ id: 'pepper', rescuedAt: 0, home: true }]);
  assert.equal(parseFriends(Array.from({ length: 40 }, () => ({ id: 'sprout', rescuedAt: 1, home: true }))).length, 1);
});
