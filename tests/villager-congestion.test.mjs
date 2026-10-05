import test from 'node:test';
import assert from 'node:assert/strict';
import {walkPerson} from '../src/village-walk.mjs';

function crossing(count,reverse=false){
 const npcs=Array.from({length:count},(_,index)=>{
  const a=index/count*Math.PI*2+.3,x=Math.cos(a)*5,z=Math.sin(a)*5;
  return{p:{index},mesh:{visible:true,position:{x,z}},path:[{x:0,z:0},{x:-x,z:-z}],destination:{x:-x,z:-z}};
 });
 if(reverse)npcs.reverse();
 return{npcs,player:{position:{x:30,z:30}},blocked:()=>false};
}

test('five and eight walkers sharing a junction clear the jam without losing routes or personal space',()=>{
 // With forward/sideways-only steering all five stop around this shared waypoint for at least 60s.
 for(const count of [5,8])for(const fps of [20,30,60])for(const reverse of [false,true]){
  const w=crossing(count,reverse);let finished=false,yields=0;
  for(let frame=0;frame<fps*30;frame++){
   for(const n of w.npcs){
    const target=n.path[0];if(!target)continue;
    const at=n.mesh.position,dx=target.x-at.x,dz=target.z-at.z,d=Math.hypot(dx,dz),before={...at};
    if(d<.25)n.path.shift();else walkPerson(w,n,dx,dz,Math.min(d,2.6/fps),1/fps);
    if(n.traffic?.announce){n.traffic.announce=false;yields++;}
    assert.ok(Math.hypot(at.x-before.x,at.z-before.z)<=2.6/fps+1e-9,'recovery walks at normal speed, never teleports');
   }
   for(let i=0;i<count;i++)for(let j=i+1;j<count;j++){
    const a=w.npcs[i].mesh.position,b=w.npcs[j].mesh.position;
    assert.ok(Math.hypot(a.x-b.x,a.z-b.z)>=.85-1e-9,'everyone retains personal space');
   }
   if(w.npcs.every(n=>!n.path.length)){finished=true;break;}
  }
  assert.ok(yields>0,'the jam exercises give-way recovery');
  assert.ok(finished,`${count} walkers clear at ${fps}fps, reverse=${reverse}`);
  for(const n of w.npcs)assert.ok(Math.hypot(n.mesh.position.x-n.destination.x,n.mesh.position.z-n.destination.z)<.25,'original destination is reached');
 }
});

test('a give-way move is cancelled when the destination changes and never crosses a wall or player',()=>{
 const w=crossing(5),n=w.npcs[0];n.traffic={x:0,z:0,best:0,wait:0,aside:{x:8,z:8,left:1.6}};
 const at=n.mesh.position;
 walkPerson(w,n,10-at.x,0-at.z,.1,.04);
 assert.equal(n.traffic.x,10);assert.equal(n.traffic.aside,null,'a new assignment discards the old detour');
 w.npcs=[n];n.mesh.position={x:0,z:-1};w.player.position={x:0,z:0};w.blocked=(x,z)=>Math.abs(x)>.15||z<-3;
 for(let frame=0;frame<600;frame++){
  const p=n.mesh.position;walkPerson(w,n,-p.x,4-p.z,.043,1/60);
  assert.equal(w.blocked(p.x,p.z),false);assert.ok(Math.hypot(p.x,p.z)>=.9-1e-9);
 }
 w.player.position={x:30,z:30};
 for(let frame=0;frame<300;frame++){const p=n.mesh.position,d=Math.hypot(p.x,4-p.z);if(d<.25)break;walkPerson(w,n,-p.x,4-p.z,Math.min(.043,d),1/60);}
 assert.ok(n.mesh.position.z>3.75,'resumes when the player clears the narrow lane');
});
