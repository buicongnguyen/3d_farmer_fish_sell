import test from 'node:test';
import assert from 'node:assert/strict';
import {freshState,act,parseSave} from '../src/game.mjs';
import {FURNITURE} from '../src/content.mjs';
import {DECOR,DECOR_GROUPS,DEFAULT_SPOTS,SPOTS,SPAWN,MAX_DECOR,PANDORA_SPOT,ROOM,ROOMS,WALLS,WALK,PLAN,residentSpot,decorLayout,defaultDecor,ownedCount,storedCount,placedCount,spotProblem,houseColliders,fixedPieces,wallBoxes,growPoint,parseDecor,roomAt,keepClear} from '../src/home-plan.mjs';
import {findRoute} from '../src/navigation.mjs';

const furnished=()=>{const s=freshState();s.furniture=FURNITURE.map(f=>f.id);s.upgrades={farm:0,pond:0,pen:0,house:3,kitchen:3};return s;};
const BOUNDS=WALK;
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
 s.decor=[{id:'herb',x:P.x,z:P.z-.13,rot:0},{id:'armchair',x:P.stand.x,z:P.stand.z,rot:0},{id:'stool',x:P.x+P.w/2+.1,z:P.z,rot:0},{id:'rug_round',x:P.x,z:P.z+.6,rot:0},{id:'fern',x:-9.1,z:7.7,rot:0},{id:'herb',x:2.15,z:-1.55,rot:0}];
 const loaded=parseSave(JSON.parse(JSON.stringify(s)));
 assert.deepEqual(loaded.decor.map(d=>d.id),['rug_round','fern','herb']);
 assert.equal(placedCount(loaded,'herb'),1);assert.equal(storedCount(loaded,'herb'),ownedCount(loaded,'herb')-1,'the herb waits in storage');
 assert.equal(storedCount(loaded,'armchair'),ownedCount(loaded,'armchair'));assert.equal(storedCount(loaded,'stool'),ownedCount(loaded,'stool'));
 // Nothing can be put back there, with a reason that says why; right beside it is fine.
 assert.match(spotProblem(loaded,'herb',P.x,P.z,0),/Pandora/);assert.match(spotProblem(loaded,'armchair',P.stand.x,P.stand.z,0),/Pandora/);
 assert.ok(act(loaded,'placeDecor',{id:'herb',x:P.x,z:P.z,rot:0}).ok===false);assert.ok(act(loaded,'placeDecor',{id:'herb',x:-1.75,z:7.85,rot:0}).ok);
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
 const bed=fixedPieces(0,s).find(p=>p.role==='bed'),table=s.decor.find(d=>d.id==='dining_table'),door=WALLS.find(w=>w.axis==='x'&&w.at<0&&w.gaps.length).gaps[0],mid=WALLS.find(w=>w.axis==='x'&&w.gaps.length===3).at;
 assert.match(spotProblem(s,'side_table',0,SPAWN.z+.6),/door/i,'the way in from the front door');
 assert.match(spotProblem(s,'side_table',(door[0]+door[1])/2,mid),/wall|door/i,'the bedroom doorway');
 assert.match(spotProblem(s,'side_table',(door[0]+door[1])/2,mid+.8),/door/i,'and the floor in front of it');
 assert.match(spotProblem(s,'side_table',bed.x,bed.z),/already/i,'on the bed');
 assert.match(spotProblem(s,'side_table',SPOTS.kitchen.x,SPOTS.kitchen.z),/walk|already/i,'where you stand to cook');
 assert.match(spotProblem(s,'side_table',table.x,table.z),/already/i,'on the dining table');
 assert.match(spotProblem(s,'side_table',ROOM.w/2+2,0),/inside/i);
 assert.equal(spotProblem(s,'rug_round',table.x,table.z),null,'a rug may lie under the table');
 assert.ok(spotProblem(s,'rug_rect',ROOMS.find(r=>r.id==='nook').rect.x0,1.2),'but never across a wall');
 // A future upgrade's spot stays free even before it is built (the fireplace at home tier 3).
 const fresh=freshState(),fire=fixedPieces(0,s).find(p=>p.role==='fireplace');assert.ok(!fixedPieces(0,fresh).some(p=>p.role==='fireplace'));assert.match(spotProblem(fresh,'side_table',fire.x+.1,fire.z),/already/i);
});
test('moving, turning and packing away pieces, with every change checked',()=>{
 const s=furnished();
 const armchair=decorLayout(s).findIndex(d=>d.id==='armchair');
 assert.ok(act(s,'placeDecor',{index:armchair,x:-3.6,z:4.2,rot:Math.PI/4}).ok);
 assert.deepEqual(s.decor[armchair],{id:'armchair',x:-3.6,z:4.2,rot:.785});
 assert.equal(act(s,'placeDecor',{index:armchair,x:0,z:SPAWN.z+.6,rot:0}).ok,false,'not in the doorway');
 assert.equal(s.decor[armchair].x,-3.6,'a refused move changes nothing');
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
test('the bigger cottage: 1.4 times the first plan each way, with the door, the spawn and the spots where you expect them',()=>{
 // 19.6 x 16.8 m (the first plan was 14 x 12): twice the floor, the furniture its real size.
 assert.equal(PLAN,2);assert.deepEqual([ROOM.w,ROOM.d],[19.6,16.8]);assert.ok(Math.abs(ROOM.w/14-1.4)<1e-9&&Math.abs(ROOM.d/12-1.4)<1e-9);
 assert.ok(Math.abs(WALK.x-(ROOM.w/2-.6))<1e-9&&Math.abs(WALK.z-(ROOM.d/2-.3))<1e-9);
 // You come in just inside the front door, and pressing E there leaves: the door is the only spot in reach.
 assert.equal(SPAWN.x,0);assert.ok(ROOM.d/2-SPAWN.z>1.5&&ROOM.d/2-SPAWN.z<2.5);assert.ok(Math.abs(SPOTS.exit.z-(ROOM.d/2-.8))<1e-9);
 const reach=Object.values(SPOTS).filter(p=>Math.hypot(p.x-SPAWN.x,p.z-SPAWN.z)<p.r);assert.deepEqual(reach,[SPOTS.exit]);
 for(let i=0;i<3;i++){const p=residentSpot(i);assert.ok(Math.hypot(p.x-SPAWN.x,p.z-SPAWN.z)>1.1);assert.equal(roomAt(p).id,'living');}
 for(const p of [...fixedPieces(0,furnished(),{reserve:true}),...DEFAULT_SPOTS])assert.ok(Math.abs(p.x)<=ROOM.w/2&&Math.abs(p.z)<=ROOM.d/2,`${p.kit??p.id} inside the house`);
 assert.ok(wallBoxes().length>10);
 // The rooms tile the house exactly, every room is at least 4 m across (walking space round real-size furniture), and
 // every doorway is 1.5 m or wider and opens between two rooms.
 const area=ROOMS.reduce((n,r)=>n+(r.rect.x1-r.rect.x0)*(r.rect.z1-r.rect.z0),0);assert.ok(Math.abs(area-ROOM.w*ROOM.d)<1e-6);
 for(const r of ROOMS)assert.ok(r.rect.x1-r.rect.x0>=4&&r.rect.z1-r.rect.z0>=6,r.id);
 for(const wall of WALLS)for(const [a,b] of wall.gaps){assert.ok(b-a>=1.5,'a doorway is wide enough');if(wall.at===ROOM.d/2)continue;const m=(a+b)/2,one=wall.axis==='x'?roomAt({x:m,z:wall.at-.5}):roomAt({x:wall.at-.5,z:m}),two=wall.axis==='x'?roomAt({x:m,z:wall.at+.5}):roomAt({x:wall.at+.5,z:m});assert.ok(one&&two&&one.id!==two.id);}
 // Built-in furniture stands against a wall of its own room, never in a doorway, on a spot or on another piece.
 for(const state of [freshState(),furnished()]){
  const pieces=fixedPieces(0,state,{reserve:true}).filter(p=>p.block&&!p.flat&&!p.hang),box=p=>({x0:p.x-p.block[0]/2,x1:p.x+p.block[0]/2,z0:p.z-p.block[1]/2,z1:p.z+p.block[1]/2}),hit=(a,b)=>a.x0<b.x1-1e-6&&a.x1>b.x0+1e-6&&a.z0<b.z1-1e-6&&a.z1>b.z0+1e-6;
  pieces.forEach((p,i)=>{const b=box(p);
   for(const q of pieces.slice(i+1))assert.ok(!hit(b,box(q)),`${p.kit} and ${q.kit} do not overlap`);
   for(const w of wallBoxes())assert.ok(!hit(b,{x0:w.x-w.w/2,x1:w.x+w.w/2,z0:w.z-w.d/2,z1:w.z+w.d/2}),`${p.kit} is not in a wall`);
   for(const zone of keepClear())assert.ok(!hit(b,zone),`${p.kit} keeps the doorways clear`);
   for(const [name,spot] of Object.entries({...SPOTS,spawn:SPAWN}))assert.ok(Math.hypot(Math.max(b.x0-spot.x,0,spot.x-b.x1),Math.max(b.z0-spot.z,0,spot.z-b.z1))>.35,`${p.kit} leaves ${name} free`);
  });
 }
 // Walking space: with everything bought and placed the default way, furniture takes under a third of every room
 // (colliders only: rugs and wall pieces do not count).
 const s=furnished(),cols=houseColliders(0,s).filter(c=>!wallBoxes().some(w=>w.x===c.x&&w.z===c.z));
 for(const r of ROOMS){const floor=(r.rect.x1-r.rect.x0)*(r.rect.z1-r.rect.z0),used=cols.filter(c=>roomAt(c)?.id===r.id).reduce((n,c)=>n+c.w*c.d,0);assert.ok(used/floor<.3,`${r.id}: ${Math.round(used/floor*100)}% of the floor is furniture`);}
});
test('an arrangement saved on the first plan moves onto the bigger one: pieces keep their place in their room, what cannot stand goes to storage',()=>{
 // Each room is stretched between its own walls: corners stay corners, a piece against a wall stays against it.
 assert.deepEqual(growPoint(-6.3,5.3),{x:-9.1,z:7.7});assert.deepEqual(growPoint(6.35,5.3),{x:9.15,z:7.7});assert.deepEqual(growPoint(3.5,2),{x:5.1,z:growPoint(0,2).z});
 assert.deepEqual(growPoint(0,6),{x:growPoint(0,0).x,z:ROOM.d/2});assert.deepEqual(growPoint(-7,-6),{x:-ROOM.w/2,z:-ROOM.d/2});assert.deepEqual(growPoint(7,6),{x:ROOM.w/2,z:ROOM.d/2});
 // The old walls land on the new walls, so nothing changes rooms; order is kept along both axes.
 const OLD_ROOMS={bedroom:[-4.3,-3.7],bath:[.1,-3.7],kitchen:[4.4,-3.7],living:[-1.5,2.3],nook:[5.45,2.3]};
 for(const [id,[x,z]] of Object.entries(OLD_ROOMS))assert.equal(roomAt(growPoint(x,z)).id,id);
 for(let x=-7;x<7;x+=.25)for(const z of [-4,2]){const a=growPoint(x,z),b=growPoint(x+.25,z);assert.ok(b.x>=a.x-1e-9,'left to right stays left to right');}
 for(let z=-6;z<6;z+=.25){const a=growPoint(-3,z),b=growPoint(-3,z+.25);assert.ok(b.z>=a.z-1e-9);}
 // The first plan's default arrangement, saved by a player who moved one thing: every piece finds its place again.
 const first=[{id:'fern',x:-6.3,z:5.3,rot:0},{id:'fern',x:3.25,z:5.3,rot:0},{id:'fern',x:6.35,z:5.3,rot:0},{id:'basket',x:4.55,z:5.25,rot:.5},{id:'stool',x:6.5,z:-.85,rot:0},{id:'armchair',x:-4.75,z:3.85,rot:.55},{id:'floor_lamp',x:-6.35,z:-.8,rot:0},{id:'herb',x:-1.75,z:5.45,rot:0},{id:'herb',x:1.6,z:-.95,rot:0},{id:'rug_rect',x:1.3,z:.75,rot:0},{id:'rug_round',x:5.45,z:3.55,rot:0},{id:'dining_table',x:1.3,z:.75,rot:0},{id:'chair',x:1.3,z:-.15,rot:0},{id:'chair',x:1.3,z:1.65,rot:Math.PI},{id:'bookshelf',x:3.5,z:2,rot:-Math.PI/2},{id:'easel',x:4.75,z:1.95,rot:-.4},{id:'globe',x:-3.1,z:5.25,rot:.3}];
 const old=JSON.parse(JSON.stringify(furnished()));delete old.plan;old.decor=first;
 const loaded=parseSave(old);assert.equal(loaded.plan,PLAN);assert.equal(loaded.decor.length,first.length,'nothing is lost');
 loaded.decor.forEach((d,i)=>{const at=growPoint(first[i].x,first[i].z);assert.equal(d.id,first[i].id);assert.deepEqual({x:d.x,z:d.z},at);assert.equal(spotProblem(loaded,d.id,d.x,d.z,d.rot,i),null,`${d.id} may stand at ${d.x},${d.z}`);});
 // Saving and loading again changes nothing more (the save now carries the plan).
 const again=parseSave(JSON.parse(JSON.stringify(loaded)));assert.deepEqual(again.decor,loaded.decor);
 // A piece that no longer fits where it lands (here: on the chest's place, in a doorway, on the kitchen's new table,
 // on top of another piece) is left out, so it is back in storage; everything else stays.
 const table=fixedPieces(0,furnished()).find(p=>p.kit==='round_table'),inv=(x,z)=>{for(let ox=-7;ox<=7;ox+=.05)for(let oz=-6;oz<=6;oz+=.05){const g=growPoint(ox,oz);if(Math.abs(g.x-x)<.04&&Math.abs(g.z-z)<.04)return{x:Math.round(ox*100)/100,z:Math.round(oz*100)/100};}throw Error('no source point');};
 const onTable=inv(table.x,table.z),tight={...JSON.parse(JSON.stringify(furnished())),decor:[{id:'fern',x:-6.3,z:5.3,rot:0},{id:'stool',x:onTable.x,z:onTable.z,rot:0},{id:'armchair',x:-2.5,z:-.7,rot:0},{id:'fern',x:-6.2,z:5.2,rot:0},{id:'basket',x:20,z:0,rot:0},{id:'rug_round',x:0,z:0,rot:0}]};delete tight.plan;
 const kept=parseSave(tight);assert.deepEqual(kept.decor.map(d=>d.id),['fern','rug_round']);
 assert.equal(storedCount(kept,'stool'),ownedCount(kept,'stool'));assert.equal(storedCount(kept,'armchair'),1);assert.equal(storedCount(kept,'fern'),ownedCount(kept,'fern')-1);
 // parseDecor alone: the same list read as this plan's is taken as it is (no stretching).
 assert.deepEqual(parseDecor([{id:'fern',x:1,z:1,rot:0}],furnished(),PLAN),[{id:'fern',x:1,z:1,rot:0}]);assert.deepEqual(parseDecor([{id:'fern',x:1,z:1,rot:0}],furnished(),undefined),[{id:'fern',...growPoint(1,1),rot:0}]);
 assert.equal(parseDecor(null,furnished(),1),null);
});
