import test from 'node:test';
import assert from 'node:assert/strict';
import {OUTSIDE_PONDS,atBank,waterDistance,waterPond,fishingPond,shorePoint,castPlan,fishPool} from '../src/pond.mjs';
import {freshState,act,parseSave} from '../src/game.mjs';
import {packBankCatch} from '../src/bank-catch.mjs';
import {bankFishSpot} from '../src/bank-fish.mjs';

test('every outside pond supports shore approach and bounded casts around its circular bank',()=>{
 for(const pond of OUTSIDE_PONDS)for(let i=0;i<16;i++){
  const a=i*Math.PI/8,p={x:pond.x+Math.sin(a)*(pond.r+.9),z:pond.z+Math.cos(a)*(pond.r+.9)};
  assert.equal(fishingPond(p.x,p.z),pond);assert.ok(atBank(p.x,p.z));
  assert.equal(waterPond(pond.x,pond.z),pond);
  const far={x:pond.x+Math.sin(a)*(pond.r+8),z:pond.z+Math.cos(a)*(pond.r+8)},shore=shorePoint(far.x,far.z,undefined,undefined,pond);
  assert.ok(atBank(shore.x,shore.z,pond));assert.ok(waterDistance(shore.x,shore.z,pond)>.5);
  for(const tap of [null,pond]){const plan=castPlan(p,tap);assert.ok(Math.hypot(plan.cast.x-pond.x,plan.cast.z-pond.z)<pond.r-.6);assert.ok(Math.hypot(plan.cast.x-p.x,plan.cast.z-p.z)<10);assert.equal(plan.water.surface,.02);}
  for(let slot=0;slot<24;slot++){const spot=bankFishSpot(p,slot);assert.ok(waterDistance(spot.x,spot.z,pond)>=1.3);}
 }
});
test('outside catches match the visible regional pool and survive save, then pack exactly once',()=>{
 for(const pond of OUTSIDE_PONDS)for(let i=0;i<pond.pool.length;i++){
  const s=freshState(),p={x:pond.x,z:pond.z+pond.r+.9},id=pond.pool[i];s.position=p;
  assert.deepEqual(fishPool(0,p),pond.pool);assert.ok(act(s,'catch',{roll:(i+.1)/pond.pool.length,bank:p}).ok);
  assert.equal(s.bankCatch.fish[id],1);assert.equal(s.inventory[id],undefined);
  const loaded=parseSave(JSON.parse(JSON.stringify(s)));assert.equal(loaded.bankCatch.fish[id],1);
  assert.equal(packBankCatch(loaded,{x:p.x,z:p.z+4}),1);assert.equal(loaded.inventory[id],1);assert.equal(packBankCatch(loaded,p),0);
 }
});
