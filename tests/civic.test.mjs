import test from 'node:test';
import assert from 'node:assert/strict';
import {freshState,act,parseSave} from '../src/game.mjs';
import {CIVIC} from '../src/content.mjs';

test('four civic buildings each offer one daily activity', () => {
  assert.deepEqual(CIVIC.map(c=>c.id),['school','hospital','police','company']);
  const s=freshState();s.energy=50;
  assert.ok(act(s,'civic',{id:'hospital'}).ok);assert.equal(s.energy,100);assert.equal(s.coins,130);
  assert.equal(act(s,'civic',{id:'hospital'}).ok,false);
  assert.ok(act(s,'civic',{id:'company'}).ok);assert.equal(s.coins,205);assert.equal(s.energy,85);
  assert.ok(act(s,'civic',{id:'police'}).ok);assert.equal(s.coins,245);
  assert.ok(act(s,'civic',{id:'school'}).ok);assert.equal(s.coins,225);
  assert.equal(act(s,'civic',{id:'bank'}).ok,false);
  act(s,'sleep');assert.ok(act(s,'civic',{id:'company'}).ok);
  const back=parseSave(JSON.parse(JSON.stringify(s)));
  assert.equal(back.civicDay.company,s.day);assert.equal(back.stats.shifts,2);
});

test('civic activities refuse when broke or exhausted', () => {
  const s=freshState();s.coins=5;assert.equal(act(s,'civic',{id:'school'}).ok,false);
  s.energy=3;assert.equal(act(s,'civic',{id:'company'}).ok,false);assert.equal(s.coins,5);
});
