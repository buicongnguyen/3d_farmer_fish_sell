// The difficulty curve (Amendment A1): no step above +3 levels along any ray from the centre, each planet starts one above its quarter and ends at Zoo Garden's level.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RING, REGION, SECTOR_ID, LEVELS, levelAt, powerAt, regionAt } from '../src/regions.mjs';
import { POWER } from '../src/region-mix.mjs';

test('720 rays: no level step above +3, power never jumps', () => {
  let worst = 0;
  for (let k = 0; k < 720; k++) {
    const a = (k + .25) * Math.PI / 360; let prev = null, prevP = null;
    for (let r = 40; r < RING.R2 - .1; r += .5) {
      const x = r * Math.sin(a), z = -r * Math.cos(a); if (regionAt(x, z) === 'village') continue;
      const l = levelAt(x, z), p = powerAt(x, z); if (prev !== null) { worst = Math.max(worst, l - prev); assert.ok(p - prevP < .2, `power jump at ${r}`); } prev = l; prevP = p;
    }
  }
  assert.ok(worst <= 3, 'worst step ' + worst);
});
test('planets begin above their quarter and end at the Zoo Garden level and power', () => {
  for (const id of SECTOR_ID) { assert.equal(LEVELS[id].lo, REGION[['east', 'south', 'west', 'north'][SECTOR_ID.indexOf(id) >> 1]].level + 1); assert.ok(Math.abs(LEVELS[id].hi - REGION[id].level) <= 1); }
  assert.equal(POWER[6], 6.2);
});
