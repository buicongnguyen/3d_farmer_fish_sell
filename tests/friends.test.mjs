// Rescued friends (round 8; owner: builder E). Step 0 wrote the geometry tests below; builder E adds the rules (spec 12.3).
import test from 'node:test';
import assert from 'node:assert/strict';
import { FRIENDS, CAGES, CAGE_GAP, CAGE_RADIUS, cageSpot, POSTS, POST_GAP, hiredSpots, postClear, postSpot } from '../src/friends.mjs';
import { DENS, gridBorderDistance, regionAt } from '../src/regions.mjs';
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
