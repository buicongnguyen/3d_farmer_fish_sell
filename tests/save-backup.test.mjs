import test from 'node:test';import assert from 'node:assert/strict';
import {BASE_KEY,profileStore} from '../src/profiles.mjs';
import {freshState,save,load,unreadSave,UNREAD_KEY,SAVE_KEY} from '../src/game.mjs';
const storage=()=>{const values=new Map();return{values,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};};

test('a save this build cannot read is copied aside before a fresh game replaces it',()=>{
 for(const bad of ['{not json',JSON.stringify({version:99,coins:99999})]){
  const s=storage();s.setItem(SAVE_KEY,bad);const got=load(s);
  assert.equal(got.state.coins,160);assert.ok(got.error);assert.ok(!got.held);
  assert.ok(save(got.state,s));assert.equal(unreadSave(s),bad,'the copy survives the autosave');
 }
});
test('a readable save, or no save, leaves no copy and no error',()=>{
 const s=storage();assert.equal(load(s).error,null);const st=freshState();st.coins=321;save(st,s);
 const got=load(s);assert.equal(got.state.coins,321);assert.equal(got.error,null);assert.equal(unreadSave(s),null);
});
test('when the copy cannot be written, the caller is asked to hold saving',()=>{
 const s=storage(),write=s.setItem;s.setItem(SAVE_KEY,'{broken');s.setItem=(k,v)=>{if(k===UNREAD_KEY)throw Error('quota');write(k,v);};
 const got=load(s);assert.equal(got.held,true);assert.ok(got.error);assert.equal(s.getItem(SAVE_KEY),'{broken');
});
test('storage that cannot be read at all still gives a fresh game and is not held',()=>{
 const got=load({getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}});
 assert.equal(got.state.coins,160);assert.ok(got.error);assert.ok(!got.held);
});
test('each profile keeps its own copy',()=>{
 const s=storage(),two=profileStore(s,1);s.setItem(BASE_KEY+'.profile2','{broken');load(two);
 assert.equal(unreadSave(two),'{broken');assert.equal(unreadSave(profileStore(s,0)),null);assert.equal(s.getItem(BASE_KEY+'.profile2.unread'),'{broken');
});
