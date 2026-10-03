import test from 'node:test';
import assert from 'node:assert/strict';
import {fieldPlan,inVillage,homeBearing,OUTDOOR_LIMIT,HOMESTEAD} from '../src/field-layout.mjs';
import {findRoute} from '../src/navigation.mjs';
import {freshState,parseSave} from '../src/game.mjs';
import {FishingSimulation} from '../src/fishing.mjs';

test('distant fields have stable, sparse tree and grass placement without village overlap',()=>{
 for(const [x,z] of [[0,0],[-1,-1],[50,-80],[-500,500]]){
  const plan=fieldPlan(x,z);assert.deepEqual(plan,fieldPlan(x,z));assert.ok(plan.trees.length<=8);assert.ok(plan.grass.length<=100);
  for(const p of [...plan.trees,...plan.grass]){assert.ok(p.x>=x*64&&p.x<(x+1)*64&&p.z>=z*64&&p.z<(z+1)*64);assert.equal(inVillage(p.x,p.z),false);}
 }
 assert.notDeepEqual(fieldPlan(50,80),fieldPlan(50,81));
});
test('saves retain distant coordinates in every direction and reject invalid values',()=>{
 for(const x of [-12000,12000])for(const z of [-8000,8000]){const s=freshState();s.position={x,z};assert.deepEqual(parseSave(s).position,s.position);}
 const s=freshState();s.position={x:Infinity,z:1e20};assert.deepEqual(parseSave(s).position,{x:-15,z:OUTDOOR_LIMIT});
});
test('home arrow follows screen-space direction, including diagonals and rotated camera',()=>{
 for(const [x,z,angle] of [[0,10,0],[10,0,-90],[0,-10,180],[-10,0,90]]){const b=homeBearing({x,z},{x:0,z:0},0);assert.ok(Math.abs(Math.abs(b.angle)-Math.abs(angle))<.001);assert.equal(b.distance,10);}
 assert.equal(homeBearing(HOMESTEAD).distance,0);
 for(const x of [-200,200])for(const z of [-200,200]){const b=homeBearing({x,z});assert.ok(Number.isFinite(b.angle));assert.ok(b.distance>250);}
});
test('long-distance routes avoid buildings without a world-sized grid',()=>{
 const boxes=[{x:0,z:0,w:10,d:10},{x:12,z:2,w:6,d:8}],bounds={x:OUTDOOR_LIMIT,z:OUTDOOR_LIMIT};
 for(const start of [{x:-20000,z:0},{x:20000,z:0},{x:0,z:-20000},{x:0,z:20000}]){
  const end={x:-8,z:2},path=findRoute(start,end,boxes,bounds);assert.ok(path.length>0&&path.length<12);assert.deepEqual(path.at(-1),end);
  let previous=start;for(const p of path){for(let i=0;i<=1000;i++){const x=previous.x+(p.x-previous.x)*i/1000,z=previous.z+(p.z-previous.z)*i/1000;assert.equal(boxes.some(c=>Math.abs(x-c.x)<c.w/2+.32&&Math.abs(z-c.z)<c.d/2+.32),false);}previous=p;}
 }
 assert.deepEqual(findRoute({x:0,z:10},{x:0,z:0},boxes,bounds),[]);
 assert.deepEqual(findRoute({x:0,z:10},{x:Infinity,z:0},boxes,bounds),[]);
});
const round=()=>new FishingSimulation({quality:.3,bait:false,random:()=>.4,choose:()=>({id:'carp',power:.65}),approachFrom:()=>.55,cast:{x:0,z:0},water:{x:0,z:0,r:7},player:{x:0,z:8}});
function advance(s,until,holding=()=>false){for(let i=0;i<3000&&!until(s);i++)s.update(.025,holding(s));assert.ok(until(s));}
test('reference fishing requires a real bite and controlled reeling to land a fish',()=>{
 const s=round();assert.equal(s.phase,'cast');advance(s,s=>s.phase==='nibble');s.press();assert.equal(s.phase,'wait');assert.equal(s.earlyPresses,1);s.release();advance(s,s=>s.phase==='bite');s.update(.025,true);assert.equal(s.phase,'hooked');advance(s,s=>s.finished,s=>s.tension<.6&&s.surge<=0);assert.equal(s.phase,'caught');assert.equal(s.progress,1);
});
test('a slack line loses the fish and missed bites recover into waiting',()=>{
 const s=round();advance(s,s=>s.phase==='bite');advance(s,s=>s.missedBites===1);assert.equal(s.phase,'wait');advance(s,s=>s.phase==='bite');s.press();s.release();advance(s,s=>s.finished);assert.equal(s.phase,'escaped');assert.match(s.reason,/slack/);
});
