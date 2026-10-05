import test from 'node:test';import assert from 'node:assert/strict';
import {BASE_KEY,PROFILE_KEY,activeSlot,setActiveSlot,slotKey,profileStore} from '../src/profiles.mjs';
import {freshState,save,load} from '../src/game.mjs';
const storage=()=>{const values=new Map();return{values,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};};
test('existing saves remain Profile 1 and all three stories stay independent',()=>{
 const s=storage(),old=freshState();old.coins=987;old.day=7;save(old,s);const original=s.getItem(BASE_KEY);
 assert.equal(activeSlot(s),0);assert.equal(load(profileStore(s)).state.coins,987);
 for(const slot of [1,2]){setActiveSlot(s,slot);const store=profileStore(s),next=load(store).state;assert.equal(next.coins,160);next.coins=slot*123;next.day=slot+10;assert.ok(save(next,store));}
 assert.equal(s.getItem(BASE_KEY),original);assert.deepEqual([0,1,2].map(n=>load(profileStore(s,n)).state.coins),[987,123,246]);
});
test('old-tab autosave during switching or in another tab cannot overwrite the selected profile',()=>{
 const s=storage(),tab1=profileStore(s,0),tab2=profileStore(s,1),a=freshState(),b=freshState();a.coins=111;b.coins=222;save(a,tab1);save(b,tab2);
 setActiveSlot(s,1);a.coins=333;save(a,tab1);assert.equal(load(tab2).state.coins,222);assert.equal(load(tab1).state.coins,333);
});
test('invalid slots and storage failures cannot change profile or corrupt another save',()=>{
 const s=storage();setActiveSlot(s,2);for(const n of [-1,3,.5,NaN,'1']){assert.equal(setActiveSlot(s,n),false);assert.throws(()=>slotKey(n));}assert.equal(activeSlot(s),2);
 s.values.set(PROFILE_KEY,'garbage');assert.equal(activeSlot(s),0);
 const bad={getItem(){throw Error('blocked');},setItem(){throw Error('quota');}};assert.equal(activeSlot(bad),0);assert.equal(setActiveSlot(bad,1),false);assert.equal(save(freshState(),profileStore(bad)),false);
});
