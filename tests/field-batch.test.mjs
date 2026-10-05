import test from 'node:test';import assert from 'node:assert/strict';
import {freshState,parseSave,bedCount} from '../src/game.mjs';
import {fieldBatch,fieldCounts} from '../src/field-batch.mjs';
test('plant all respects seeds, energy, occupied beds and unlocked family plots',()=>{
 const s=freshState();s.energy=5;s.inventory.seed_carrot=3;s.beds[1]={crop:'radish',planted:0,watered:false};const existing={...s.beds[1]};
 assert.equal(fieldCounts(s,'carrot').plant,2);assert.equal(fieldBatch(s,'plant','carrot').count,2);assert.equal(s.energy,1);assert.equal(s.inventory.seed_carrot,1);assert.deepEqual(s.beds[1],existing);assert.ok(s.beds.slice(bedCount(s)).every(b=>!b));
 const before=JSON.stringify(s);assert.equal(fieldBatch(s,'plant','carrot').ok,false);assert.equal(JSON.stringify(s),before);
 const seedLimited=freshState();seedLimited.plots=2;seedLimited.inventory.seed_carrot=1;assert.equal(fieldBatch(seedLimited,'plant','carrot').count,1);assert.equal(seedLimited.inventory.seed_carrot,undefined);
 const free=freshState();free.energy=100;assert.equal(fieldBatch(free,'plant','tulip').count,6);assert.equal(free.energy,88);assert.equal(fieldBatch(free,'plant','tulip').count,0);
});
test('harvest all collects only ripe unlocked beds, preserves growth and cannot collect twice',()=>{
 const s=freshState();s.elapsed=100;s.energy=0;s.upgrades.farm=3;s.beds[0]={crop:'carrot',planted:0,watered:true};s.beds[1]={crop:'radish',planted:0,watered:true};s.beds[2]={crop:'pumpkin',planted:100,watered:true};s.beds[3]={crop:'tulip',planted:0,watered:false};s.beds[6]={crop:'carrot',planted:0,watered:true};
 const growing=JSON.stringify(s.beds.slice(2));assert.equal(fieldCounts(s).ready,2);assert.equal(fieldBatch(s,'harvest').count,2);assert.equal(s.inventory.carrot,4);assert.equal(s.inventory.radish,4);assert.equal(s.stats.harvests,2);assert.equal(JSON.stringify(s.beds.slice(2)),growing);assert.equal(fieldBatch(s,'harvest').ok,false);assert.equal(s.stats.harvests,2);assert.equal(parseSave(JSON.parse(JSON.stringify(s))).inventory.carrot,4);
});
