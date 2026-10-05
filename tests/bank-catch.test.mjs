import test from 'node:test';
import assert from 'node:assert/strict';
import {freshState,act,parseSave} from '../src/game.mjs';
import {POND} from '../src/content.mjs';
import {PACK_DISTANCE,packBankCatch,parseBankCatch} from '../src/bank-catch.mjs';
const at={x:POND.x+1,z:POND.z-POND.d/2-.9};
function catchFish(){const s=freshState();s.position={...at};act(s,'catch',{roll:0,bank:at});return s;}
test('bank catches count immediately but enter the inventory only after departure, once',()=>{
 const s=catchFish(),id=Object.keys(s.bankCatch.fish)[0];act(s,'catch',{roll:0,bank:at});
 assert.equal(s.inventory[id],undefined);assert.equal(s.stats.fish,2);assert.equal(s.found[id],1);
 assert.equal(packBankCatch(s,{x:at.x+PACK_DISTANCE,z:at.z}),0);
 assert.equal(packBankCatch(s,{x:at.x+PACK_DISTANCE+.01,z:at.z}),2);
 assert.equal(packBankCatch(s,at),0);assert.equal(s.inventory[id],2);assert.equal(s.bankCatch,null);
});
test('bank catches survive reload and cannot duplicate across collecting and reloading',()=>{
 const s=catchFish(),loaded=parseSave(JSON.parse(JSON.stringify(s)));
 assert.deepEqual(loaded.bankCatch,s.bankCatch);assert.deepEqual(loaded.inventory,s.inventory);
 assert.equal(packBankCatch(loaded,at,'interior'),1);
 const again=parseSave(loaded);assert.equal(again.bankCatch,null);assert.deepEqual(again.inventory,loaded.inventory);
});
test('relocated or riding saves recover pending catches into the bag',()=>{
 for(const patch of [{position:{x:0,z:-4}},{riding:'bike',bike:true},{bankCatch:{x:NaN,z:0,fish:{perch:2}}}]){
  const s=catchFish(),raw={...s,...patch},expected=Object.values(raw.bankCatch.fish).reduce((a,b)=>a+b,0),loaded=parseSave(raw);
  assert.equal(loaded.bankCatch,null);assert.equal(Object.keys(raw.bankCatch.fish).reduce((n,id)=>n+(loaded.inventory[id]??0),0),expected);
 }
});
test('malformed saved catch counts are bounded, known fish only; old catches stay valid',()=>{
 assert.deepEqual(parseBankCatch({x:at.x,z:at.z,fish:{perch:2.9,carp:Infinity,golden:999999,unknown:2,egg:1}}),{...at,fish:{perch:2,golden:99999}});
 assert.equal(parseBankCatch({fish:{perch:-2}}),null);
 const s=freshState();act(s,'catch',{roll:0});assert.equal(s.bankCatch,null);assert.equal(s.inventory.perch,1);
});

