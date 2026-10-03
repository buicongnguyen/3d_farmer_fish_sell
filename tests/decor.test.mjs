import test from 'node:test';
import assert from 'node:assert/strict';
import {freshState,act,parseSave} from '../src/game.mjs';
import {FURNITURE} from '../src/content.mjs';
import {DECOR,DECOR_GROUPS,DEFAULT_SPOTS,SPOTS,SPAWN,MAX_DECOR,PANDORA_SPOT,residentSpot,decorLayout,defaultDecor,ownedCount,storedCount,placedCount,spotProblem,houseColliders,fixedPieces,wallBoxes} from '../src/home-plan.mjs';
import {findRoute} from '../src/navigation.mjs';

const furnished=()=>{const s=freshState();s.furniture=FURNITURE.map(f=>f.id);s.upgrades={farm:0,pond:0,pen:0,house:3,kitchen:3};return s;};
const BOUNDS={x:6.4,z:5.7};
const free=(cols,p)=>Math.abs(p.x)<=BOUNDS.x&&Math.abs(p.z)<=BOUNDS.z&&!cols.some(c=>Math.abs(p.x-c.x)<c.w/2+.32&&Math.abs(p.z-c.z)<c.d/2+.32);

test('a fresh save starts with the default arrangement and gifts waiting in storage',()=>{
 const s=freshState();assert.equal(s.decor,null);
 assert.deepEqual(decorLayout(s).map(d=>d.id).sort(),['basket','fern','fern']);
 assert.equal(storedCount(s,'stool'),1);assert.equal(storedCount(s,'side_table'),1);
 assert.equal(ownedCount(s,'armchair'),0);
 for(const d of Object.values(DECOR)){assert.ok(DECOR_GROUPS.some(([g])=>g===d.group),d.name);assert.ok(d.from.length);}
});
test('every furniture set brings pieces to place, and the shop sets all exist',()=>{
 const sources=new Set(Object.values(DECOR).flatMap(d=>d.from.map(([s])=>s)));
 for(const f of FURNITURE)assert.ok(sources.has(f.id),`${f.id} brings decorations`);
 for(const source of sources)assert.ok(source==='starter'||FURNITURE.some(f=>f.id===source),source);
});
test('the default arrangement is legal and every room and spot can still be reached',()=>{
 for(const s of [freshState(),furnished()]){
  const layout=defaultDecor(s);s.decor=layout;
  layout.forEach((d,i)=>assert.equal(spotProblem(s,d.id,d.x,d.z,d.rot,i),null,`${d.id} at ${d.x},${d.z}`));
  const cols=houseColliders(0,s),spots={spawn:SPAWN,...SPOTS,r0:residentSpot(0),r1:residentSpot(1),r2:residentSpot(2)};
  for(const [k,p] of Object.entries(spots))assert.ok(free(cols,p),`${k} is free`);
  for(const [a,pa] of Object.entries(spots))for(const [b,pb] of Object.entries(spots))if(a!==b)assert.ok(findRoute(pa,pb,cols,BOUNDS).length,`route ${a} -> ${b}`);
 }
 // Other households show their whole home: still walkable.
 for(const id of [1,4,9]){const cols=houseColliders(id,freshState(),{hasChild:id!==4});assert.ok(findRoute(SPAWN,SPOTS.kitchen,cols,BOUNDS).length);assert.ok(findRoute(SPAWN,SPOTS.bedroom,cols,BOUNDS).length);}
});
test('a save with a piece on the place kept for Pandora’s box gets that piece back in storage; rugs may stay',()=>{
 const s=furnished(),P=PANDORA_SPOT;
 // An arrangement from before the box had this place: the herb pot that used to stand by that wall, an armchair where you
 // now stand to use the box, a stool half on its floor, a rug under it, and pieces elsewhere.
 s.decor=[{id:'herb',x:-1.18,z:-.95,rot:0},{id:'armchair',x:P.stand.x,z:P.stand.z,rot:0},{id:'stool',x:P.x+P.w/2+.1,z:P.z,rot:0},{id:'rug_round',x:P.x,z:P.z+.6,rot:0},{id:'fern',x:-6.3,z:5.3,rot:0},{id:'herb',x:1.6,z:-.95,rot:0}];
 const loaded=parseSave(JSON.parse(JSON.stringify(s)));
 assert.deepEqual(loaded.decor.map(d=>d.id),['rug_round','fern','herb']);
 assert.equal(placedCount(loaded,'herb'),1);assert.equal(storedCount(loaded,'herb'),ownedCount(loaded,'herb')-1,'the herb waits in storage');
 assert.equal(storedCount(loaded,'armchair'),ownedCount(loaded,'armchair'));assert.equal(storedCount(loaded,'stool'),ownedCount(loaded,'stool'));
 // Nothing can be put back there, with a reason that says why; right beside it is fine.
 assert.match(spotProblem(loaded,'herb',P.x,P.z,0),/Pandora/);assert.match(spotProblem(loaded,'armchair',P.stand.x,P.stand.z,0),/Pandora/);
 assert.ok(act(loaded,'placeDecor',{id:'herb',x:P.x,z:P.z,rot:0}).ok===false);assert.ok(act(loaded,'placeDecor',{id:'herb',x:-1.75,z:5.45,rot:0}).ok);
 // A save that never rearranged anything (decor null) simply gets the new default, which is legal.
 const plain=furnished();const again=parseSave(JSON.parse(JSON.stringify(plain)));assert.equal(again.decor,null);
 for(const d of defaultDecor(again))assert.ok(!(Math.abs(d.x-P.x)<P.w/2+.2&&Math.abs(d.z-P.z)<P.d/2+.2)||DECOR[d.id].flat,`${d.id} is off the box`);
});
test('placing a piece from storage makes the arrangement your own and uses one piece',()=>{
 const s=freshState();
 const r=act(s,'placeDecor',{id:'stool',x:-2.3,z:3.6,rot:0});assert.ok(r.ok,r.message);
 assert.equal(s.decor.length,4);assert.deepEqual(s.decor.at(-1),{id:'stool',x:-2.3,z:3.6,rot:0});
 assert.equal(storedCount(s,'stool'),0);
 assert.equal(act(s,'placeDecor',{id:'stool',x:2.3,z:3.6,rot:0}).ok,false,'only one stool owned');
 assert.equal(act(s,'placeDecor',{id:'armchair',x:2.3,z:3.6,rot:0}).ok,false,'armchair comes with the reading nook');
 assert.equal(act(s,'placeDecor',{id:'unicorn',x:0,z:0}).ok,false);
});
test('pieces cannot block doorways, walls, built-ins, people or each other; rugs go under things',()=>{
 const s=furnished();s.decor=defaultDecor(s);
 assert.match(spotProblem(s,'side_table',0,4.6),/door/i,'the way in from the front door');
 assert.match(spotProblem(s,'side_table',-2.5,-1.4),/wall|door/i,'the bedroom doorway');
 assert.match(spotProblem(s,'side_table',-4.4,-4.6),/already/i,'on the bed');
 assert.match(spotProblem(s,'side_table',SPOTS.kitchen.x,SPOTS.kitchen.z),/walk|already/i,'where you stand to cook');
 assert.match(spotProblem(s,'side_table',1.3,.75),/already/i,'on the dining table');
 assert.match(spotProblem(s,'side_table',9,0),/inside/i);
 assert.equal(spotProblem(s,'rug_round',1.3,.75),null,'a rug may lie under the table');
 assert.ok(spotProblem(s,'rug_rect',3.9,1.2),'but never across a wall');
 // A future upgrade's spot stays free even before it is built (the fireplace at home tier 3).
 const fresh=freshState();assert.match(spotProblem(fresh,'side_table',-6.3,3.3),/already/i);
});
test('moving, turning and packing away pieces, with every change checked',()=>{
 const s=furnished();
 const armchair=decorLayout(s).findIndex(d=>d.id==='armchair');
 assert.ok(act(s,'placeDecor',{index:armchair,x:-2.6,z:4.2,rot:Math.PI/4}).ok);
 assert.deepEqual(s.decor[armchair],{id:'armchair',x:-2.6,z:4.2,rot:.785});
 assert.equal(act(s,'placeDecor',{index:armchair,x:0,z:4.8,rot:0}).ok,false,'not in the doorway');
 assert.equal(s.decor[armchair].x,-2.6,'a refused move changes nothing');
 const before=s.decor[armchair].rot;assert.ok(act(s,'rotateDecor',{index:armchair}).ok);assert.equal(s.decor[armchair].rot,Math.round((before+Math.PI/4)*1000)/1000);
 for(let i=0;i<8;i++)act(s,'rotateDecor',{index:armchair});assert.ok(s.decor[armchair].rot<Math.PI*2);
 const n=s.decor.length;assert.ok(act(s,'removeDecor',{index:armchair}).ok);assert.equal(s.decor.length,n-1);assert.equal(storedCount(s,'armchair'),1);
 assert.equal(act(s,'removeDecor',{index:99}).ok,false);assert.equal(act(s,'rotateDecor',{index:-1}).ok,false);
});
test('the arrangement survives a save and impossible saved pieces are dropped',()=>{
 const s=freshState();act(s,'placeDecor',{id:'side_table',x:-2.3,z:3.6,rot:1});
 const copy=parseSave(JSON.parse(JSON.stringify(s)));assert.deepEqual(copy.decor,s.decor);
 assert.equal(parseSave(JSON.parse(JSON.stringify(freshState()))).decor,null);
 const bad=parseSave({...JSON.parse(JSON.stringify(s)),decor:[{id:'side_table',x:1,z:1,rot:0},{id:'side_table',x:2,z:2,rot:0},{id:'armchair',x:0,z:0},{id:'nope',x:0,z:0},{id:'fern',x:Infinity,z:0},{id:'fern',x:99,z:0},'junk',{id:'fern',x:-1,z:2,rot:'x'}]});
 assert.deepEqual(bad.decor,[{id:'side_table',x:1,z:1,rot:0},{id:'fern',x:-1,z:2,rot:0}]);
 assert.ok(parseSave({...JSON.parse(JSON.stringify(s)),decor:Array(200).fill({id:'fern',x:0,z:0})}).decor.length<=MAX_DECOR);
});
test('the plan keeps the spawn, the door and the interactive spots of the old room',()=>{
 assert.deepEqual(SPAWN,{x:0,z:4});assert.deepEqual({x:SPOTS.exit.x,z:SPOTS.exit.z},{x:0,z:5.2});
 // Pressing E at the spawn leaves: the door is the nearest thing in reach.
 const reach=Object.values(SPOTS).filter(p=>Math.hypot(p.x-SPAWN.x,p.z-SPAWN.z)<p.r);assert.deepEqual(reach,[SPOTS.exit]);
 for(let i=0;i<3;i++){const p=residentSpot(i);assert.ok(Math.hypot(p.x-SPAWN.x,p.z-SPAWN.z)>1.1);}
 for(const p of [...fixedPieces(0,furnished()),...DEFAULT_SPOTS])assert.ok(Math.abs(p.x)<=7&&Math.abs(p.z)<=6,`${p.kit??p.id} inside the house`);
 assert.ok(wallBoxes().length>10);
});
