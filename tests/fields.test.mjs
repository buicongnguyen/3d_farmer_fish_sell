import test from 'node:test';
import assert from 'node:assert/strict';
import {fieldPlan,fieldTrees,fieldCards,inVillage,homeBearing,OUTDOOR_LIMIT,HOMESTEAD} from '../src/field-layout.mjs';
import {inSafeZone} from '../src/ward.mjs';
import {findRoute} from '../src/navigation.mjs';
import {FishingSimulation,LINE_BREAK,STRAIN,lineBreakChance} from '../src/fishing.mjs';

test('distant fields have stable, sparse tree and grass placement without village overlap',()=>{
 for(const [x,z] of [[0,0],[-1,-1],[50,-80],[-500,500]]){
  const plan=fieldPlan(x,z);assert.deepEqual(plan,fieldPlan(x,z));assert.ok(plan.trees.length<=8);assert.ok(plan.grass.length<=100);
  for(const p of [...plan.trees,...plan.grass]){assert.ok(p.x>=x*64&&p.x<(x+1)*64&&p.z>=z*64&&p.z<(z+1)*64);assert.equal(inVillage(p.x,p.z),false);}
 }
 assert.notDeepEqual(fieldPlan(50,80),fieldPlan(50,81));
});
// Round 8, step 0: the plan is behind three functions now (fieldTrees, fieldCards, fieldPlan), and it is still main's plan,
// tree for tree and blade for blade, in every tile (builder A changes it at its own merge, with this test).
const planSum=plan=>{let h=2166136261;const eat=v=>{const s=typeof v==='number'?v.toFixed(6):String(v);for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;};
 for(const t of plan.trees){eat(t.x);eat(t.z);eat(t.scale);eat(t.angle);eat(t.kind);}eat('|');for(const g of plan.grass){eat(g.x);eat(g.z);eat(g.scale);eat(g.angle);}return h;};
test('the plan wrapper gives main’s plan: a checksum of three tiles, and what the new readers need on every tree',()=>{
 // The sums were taken from main f070c02's fieldPlan (trees and grass, six decimals).
 for(const [x,z,trees,grass,sum] of [[0,0,3,45,482908255],[2,0,8,100,3607828339],[-3,1,8,100,2568243610]]){const plan=fieldPlan(x,z);assert.equal(plan.trees.length,trees);assert.equal(plan.grass.length,grass);assert.equal(planSum(plan),sum,`tile ${x},${z}`);}
 for(const [x,z] of [[0,0],[2,0],[-3,1],[9,9]]){
  const plan=fieldPlan(x,z);assert.deepEqual(fieldTrees(x,z),plan.trees);assert.deepEqual(fieldCards(x,z,[]),[]);assert.deepEqual(plan.cards,[]);
  for(const t of plan.trees){assert.ok(Math.abs(t.r-.42*t.scale)<1e-12&&Math.abs(t.h-3.3*t.scale)<1e-12&&t.perch===true,'today’s collider and perch height');assert.equal(inSafeZone(t.x,t.z),false,'no field piece inside the ward');}
 }
 assert.deepEqual(fieldPlan(2,0).regions,['east']);assert.deepEqual(fieldPlan(-3,1).regions,['candy']);assert.deepEqual(fieldPlan(9,9).regions,[]);assert.deepEqual([...fieldPlan(0,0).regions].sort(),['east','south','village']);assert.deepEqual([...fieldPlan(-1,-1).regions].sort(),['north','village','west']);
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
const round=(extra={})=>new FishingSimulation({quality:.3,bait:false,random:()=>.4,choose:()=>({id:'carp',power:.65}),approachFrom:()=>.55,cast:{x:0,z:0},water:{x:0,z:0,r:7},player:{x:0,z:8},...extra});
function advance(s,until,holding=()=>false){for(let i=0;i<3000&&!until(s);i++)s.update(.025,holding(s));assert.ok(until(s));}
test('reference fishing requires a real bite and controlled reeling to land a fish',()=>{
 const s=round();assert.equal(s.phase,'cast');advance(s,s=>s.phase==='nibble');s.press();assert.equal(s.phase,'wait');assert.equal(s.earlyPresses,1);s.release();advance(s,s=>s.phase==='bite');s.update(.025,true);assert.equal(s.phase,'hooked');advance(s,s=>s.finished,s=>s.tension<.6&&s.surge<=0);assert.equal(s.phase,'caught');assert.equal(s.progress,1);
});
test('a strained line is announced, then holds or snaps by the rod\'s chance (the reference\'s line strain)',()=>{
 // The family rod and its first two upgrades snap 60 % of the time, the best pond rod (quality 0.75) 30 %.
 assert.deepEqual([0,1,2,3].map(tier=>lineBreakChance({quality:.3+tier*.15})),[LINE_BREAK.bamboo,LINE_BREAK.bamboo,LINE_BREAK.bamboo,LINE_BREAK.golden]);assert.equal(round().breakChance,.6);
 // Holding Reel through every surge: the warning comes first (from STRAIN.warn), then the roll at full tension.
 const held=round({breakChance:0});advance(held,s=>s.phase==='bite');held.update(.025,true);assert.equal(held.strained,false);advance(held,s=>s.strained,()=>true);assert.ok(held.tension>=STRAIN.warn&&held.tension<1&&held.strains===0);
 let before=0;advance(held,s=>{if(s.strains===0)before=s.progress;return s.strains===1;},()=>true);
 assert.equal(held.phase,'hooked');assert.equal(held.strainsHeld,1);assert.equal(held.tension,STRAIN.relief);assert.ok(held.progress<before&&held.progress>before-STRAIN.slip-.02,'the fish took a little line');assert.equal(held.strained,false);
 // Letting go when warned lands the fish without another roll.
 advance(held,s=>s.finished,s=>s.tension<.6&&s.surge<=0);assert.equal(held.phase,'caught');assert.equal(held.strains,1);
 const snap=round({breakChance:1});advance(snap,s=>s.phase==='bite');snap.update(.025,true);advance(snap,s=>s.finished,()=>true);assert.equal(snap.phase,'escaped');assert.ok(snap.snapped);assert.equal(snap.strains,1);assert.equal(snap.strainsHeld,0);assert.match(snap.reason,/snapped/);
});
test('a slack line loses the fish and missed bites recover into waiting',()=>{
 const s=round();advance(s,s=>s.phase==='bite');advance(s,s=>s.missedBites===1);assert.equal(s.phase,'wait');advance(s,s=>s.phase==='bite');s.press();s.release();advance(s,s=>s.finished);assert.equal(s.phase,'escaped');assert.match(s.reason,/slack/);
});
