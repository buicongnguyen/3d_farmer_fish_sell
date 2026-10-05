import test from 'node:test';
import assert from 'node:assert/strict';
import {LINES,nextLine,witness,canWatch,reactToCatch} from '../src/catch-reactions.mjs';
import {ROADS} from '../src/content.mjs';
const npc=(x=203,z=200)=>({p:{child:false},mesh:{visible:true,position:{x,z}},pause:0,path:[{x:210,z:200}]});
function world(){const calls=[],w={player:{position:{x:200,z:200}},npcs:[npc()],location:'village',villagers:{time:50,say:(...args)=>calls.push(args)}};return{w,calls};}
test('all 60 catch lines cycle without repeats, including across bag boundaries',()=>{
 for(const kind of Object.keys(LINES)){
  const memory={},seen=Array.from({length:LINES[kind].length},()=>nextLine(memory,kind,'Silver carp',()=>.3));
  assert.equal(new Set(seen).size,LINES[kind].length);assert.ok(seen.every(s=>!s.includes('{fish}')));
  assert.notEqual(nextLine(memory,kind,'Silver carp',()=>.3),seen.at(-1));
 }
});
test('a catch gets a player line then one nearby onlooker who resumes the same route',()=>{
 const {w,calls}=world(),n=w.npcs[0],path=n.path;
 reactToCatch(w,'perch',{...w.player.position});assert.equal(calls.length,1);assert.equal(calls[0][0].mesh,w.player);
 calls[0][2]();assert.equal(calls.length,2);assert.equal(calls[1][0],n);assert.equal(n.pause,2.3);assert.equal(n.path,path);assert.equal(n.wave,1.5);
 assert.equal(witness(w,51),undefined,'same spectator has a cooldown');
});
test('no ghost cheers after leaving, going inside, recasting or a delayed download',()=>{
 for(const change of [w=>w.player.position.x+=10,w=>w.location='interior',w=>w.paused=true,w=>w.fishing={}]){
  const {w,calls}=world();reactToCatch(w,'koi',{...w.player.position});change(w);calls[0][2]();assert.equal(calls.length,1);
 }
 const {w,calls}=world();reactToCatch(w,'koi',{x:0,z:0});assert.equal(calls.length,0);
});
test('workers and crowded walkers can cheer without stopping; hidden/distant/riding people cannot react',()=>{
 const {w,calls}=world(),n=w.npcs[0];n.working=true;
 reactToCatch(w,'golden',{...w.player.position});calls[0][2]();assert.equal(calls.length,2);assert.equal(n.pause,0);
 n.working=false;n.catchSaid=-99;w.npcs.push(npc(204,200));assert.equal(canWatch(w,n),false);
 w.npcs=[n];n.inside=true;assert.equal(witness(w,50),undefined);n.inside=false;n.ride={busy:true};assert.equal(witness(w,50),undefined);
 n.ride=null;n.mesh.visible=false;assert.equal(witness(w,50),undefined);n.mesh.visible=true;n.mesh.position.x=220;assert.equal(witness(w,50),undefined);
 n.mesh.position={x:0,z:ROADS.south};assert.equal(canWatch(w,n),false,'never stop on the road');
});
