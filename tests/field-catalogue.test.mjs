import test from 'node:test';import assert from 'node:assert/strict';
import {CROPS} from '../src/content.mjs';
import {freshState,act,parseSave} from '../src/game.mjs';
import {fieldBatch} from '../src/field-batch.mjs';
export const NEW_PLANTS=['mint','chili','candy','bean','star','coffee','moonflower','magnetmelon','melon','clover','glowshroom','iceberry','goldcorn','dragonfruit','rainbowrose'];
test('all 15 reference bed plants can be obtained, batch planted, watered, saved, harvested and sold',()=>{
 assert.equal(Object.keys(CROPS).length,22);
 for(const id of NEW_PLANTS){const c=CROPS[id],s=freshState();s.coins=1000;assert.ok(c.grow<=180);
  if(!c.free)assert.ok(act(s,'buySeed',{id}).ok,id);const planted=fieldBatch(s,'plant',id);assert.equal(planted.count,c.free?6:3,id);
  for(let index=0;index<planted.count;index++)assert.ok(act(s,'water',{index}).ok,id);
  const restored=parseSave(JSON.parse(JSON.stringify(s)));assert.equal(restored.beds[0].crop,id);restored.elapsed+=c.grow;assert.equal(fieldBatch(restored,'harvest').count,planted.count);assert.equal(restored.inventory[id],planted.count*c.yield);assert.ok(act(restored,'sell',{id}).ok,id);assert.equal(restored.inventory[id],undefined);assert.ok(restored.coins>1000,id+' is profitable');
 }
});
