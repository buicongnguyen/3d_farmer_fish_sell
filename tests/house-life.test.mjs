import test from 'node:test';
import assert from 'node:assert/strict';
import {freshState,act,parseSave} from '../src/game.mjs';
import {FURNITURE,ITEMS,CROPS} from '../src/content.mjs';
import {PANDORA_SPOT,SPOTS,DECOR,houseColliders,fixedPieces,spotProblem,defaultDecor,roomAt} from '../src/home-plan.mjs';
import {ACTIVITIES,HANGOUTS,DOORS,COLLECTIBLES,STAY_SECONDS,activityForRole,activityForDecor,cooldownLeft,collectionLog,usableHangouts,assignHangouts,doorPath,hangout,mmss} from '../src/house-rules.mjs';
import {ROOM_TALK,PERSONA_TALK,EXCHANGES,TalkBag,lineFor,exchangeFor} from '../src/house-talk.mjs';
import {newGait,stepGait,applyGait,gaitSwing} from '../src/walk-cycle.mjs';
import {findRoute} from '../src/navigation.mjs';

const furnished=()=>{const s=freshState();s.furniture=FURNITURE.map(f=>f.id);s.upgrades={farm:0,pond:0,pen:0,house:3,kitchen:3};return s;};
const BOUNDS={x:6.4,z:5.7};

test('resting at home restores energy under Willowmere’s rules and cools down on play time',()=>{
 const s=freshState();s.energy=30;
 let r=act(s,'houseUse',{id:'sofa'});assert.ok(r.ok);assert.equal(s.energy,50);assert.match(r.message,/\+20 energy/);
 r=act(s,'houseUse',{id:'sofa'});assert.equal(r.ok,false);assert.equal(s.energy,50);assert.match(r.message,/ready again in 2:00/);assert.equal(cooldownLeft(s,'sofa'),120);
 s.elapsed+=119;assert.equal(act(s,'houseUse',{id:'sofa'}).ok,false);s.elapsed+=1;assert.ok(act(s,'houseUse',{id:'sofa'}).ok);assert.equal(s.energy,70);
 assert.ok(act(s,'houseUse',{id:'bath'}).ok);assert.equal(s.energy,100);assert.ok(act(s,'houseUse',{id:'tea'}).ok,'a rest at full energy is still a nice moment');assert.equal(s.energy,100);assert.equal(cooldownLeft(s,'tea'),0,'and starts no cooldown');
 // A night's sleep makes everything ready again.
 s.energy=10;act(s,'houseUse',{id:'bath'});assert.equal(cooldownLeft(s,'bath'),240);act(s,'sleep');assert.equal(cooldownLeft(s,'bath'),60);act(s,'sleep');assert.equal(cooldownLeft(s,'bath'),0);
 assert.equal(act(s,'houseUse',{id:'trampoline'}).ok,false);assert.equal(mmss(61),'1:01');
 for(const a of Object.values(ACTIVITIES)){assert.ok(a.icon&&a.name&&a.verb&&a.line,a.id);if(a.kind==='rest')assert.ok(a.energy>0&&a.energy<=30&&a.cooldown>=60,a.id);assert.ok(a.role||a.decor,a.id);}
});
test('painting adds to the album, and Pip paints along once a day',()=>{
 const s=freshState();s.friendship.pip=2;
 let r=act(s,'houseUse',{id:'easel'});assert.ok(r.ok);assert.equal(s.house.paintings,1);assert.equal(s.friendship.pip,3);assert.match(r.message,/Friendship \+1/);
 assert.equal(act(s,'houseUse',{id:'easel'}).ok,false);s.elapsed+=150;r=act(s,'houseUse',{id:'easel'});assert.ok(r.ok);assert.equal(s.house.paintings,2);assert.equal(s.friendship.pip,3,'one friendship point a day');
 act(s,'sleep');act(s,'houseUse',{id:'easel'});assert.equal(s.friendship.pip,4);
});
test('the house part of a save is checked on load, and old saves get a fresh one',()=>{
 const s=freshState();s.energy=10;s.elapsed=500;act(s,'houseUse',{id:'sofa'});act(s,'houseUse',{id:'easel'});
 const copy=parseSave(JSON.parse(JSON.stringify(s)));assert.deepEqual(copy.house,s.house);
 const odd=parseSave({...JSON.parse(JSON.stringify(s)),house:{used:{sofa:99999,bath:-4,teleporter:1,tea:'x'},paintings:1e9,paintDay:77}});
 assert.deepEqual(odd.house,{used:{},paintings:99,paintDay:0});
 const old=JSON.parse(JSON.stringify(freshState()));delete old.house;delete old.found;assert.deepEqual(parseSave(old).house,{used:{},paintings:0,paintDay:0});
});
test('the collection log counts what the family has found, grown, met and made',()=>{
 const s=freshState();let log=collectionLog(s);assert.equal(log.rows.length,8);assert.equal(log.rows.find(r=>r.id==='harvest').have,0);
 act(s,'plant',{index:0,crop:'carrot'});act(s,'water',{index:0});s.elapsed+=40;act(s,'harvest',{index:0});act(s,'sell',{id:'carrot'});
 assert.equal(s.inventory.carrot,undefined);assert.equal(s.found.carrot,1,'found things stay found after they are sold');
 act(s,'catch',{roll:0});act(s,'talk',{id:'ada'});s.coins=1000;act(s,'buyGear',{id:'hat_straw'});act(s,'look',{id:'girl-tall-none-fox'});
 log=collectionLog(s);const row=id=>log.rows.find(r=>r.id===id);
 assert.equal(row('harvest').have,1);assert.equal(row('fish').have,1);assert.equal(row('neighbours').have,1);assert.equal(row('wardrobe').have,2);assert.ok(log.pct>0&&log.pct<20);
 assert.equal(new Set(COLLECTIBLES).size,COLLECTIBLES.length);for(const id of COLLECTIBLES)assert.ok(ITEMS[id]||CROPS[id],id);assert.equal(COLLECTIBLES.length,Object.keys(ITEMS).length);
 // Old saves: what is in the basket counts as found.
 const old=JSON.parse(JSON.stringify(freshState()));delete old.found;old.inventory={perch:2,egg:1};assert.deepEqual(parseSave(old).found,{perch:1,egg:1});
});
test('activities belong to furniture that exists, and the tea kettle stands on the coffee table',()=>{
 const roles=new Set(fixedPieces(0,furnished()).map(p=>p.role).filter(Boolean));
 for(const a of Object.values(ACTIVITIES)){if(a.role)assert.ok(roles.has(a.role),`${a.id} has its furniture`);if(a.decor)assert.ok(DECOR[a.decor],`${a.id} is a decoration`);}
 assert.equal(activityForRole('tea').id,'tea');assert.equal(activityForDecor('bookshelf').kind,'log');assert.equal(activityForRole('wardrobe'),undefined);
 const pieces=fixedPieces(0,freshState()),kettle=pieces.find(p=>p.role==='tea'),table=pieces.find(p=>p.role==='teatable');
 assert.ok(Math.hypot(kettle.x-table.x,kettle.z-table.z)<.3);assert.ok(pieces.some(p=>p.role==='mirror'));assert.ok(pieces.some(p=>p.role==='wardrobe'));
});
test('a spot is kept free for Pandora’s box: no furniture, no decoration, and you can walk to it',()=>{
 const P=PANDORA_SPOT;assert.equal(roomAt(P).id,'living');assert.ok(P.x-P.w/2<-6.7,'against the west wall');
 for(const s of [freshState(),furnished()]){
  const cols=houseColliders(0,s);
  // Nothing built in or placed by default overlaps the box's footprint, and its stand spot is walkable and reachable.
  for(const c of cols.filter(c=>c.w>.3||c.d>.3)){const overlap=Math.abs(c.x-P.x)<(c.w+P.w)/2&&Math.abs(c.z-P.z)<(c.d+P.d)/2;assert.ok(!overlap||Math.abs(c.x)>6.8,`free of ${JSON.stringify(c)}`);}
  const withBox=[...cols,{x:P.x,z:P.z,w:P.w,d:P.d}];
  assert.ok(findRoute({x:0,z:4},P.stand,withBox,BOUNDS).length,'a way from the door to the box');
  for(const spot of Object.values(SPOTS))assert.ok(findRoute({x:0,z:4},spot,withBox,BOUNDS).length,'the box blocks no spot');
  for(const id of Object.keys(DECOR)){assert.ok(spotProblem(s,id,P.x,P.z,0)!==null,`${id} cannot stand on the box`);if(!DECOR[id].flat)assert.ok(spotProblem(s,id,P.stand.x,P.stand.z,0)!==null,`${id} cannot stand where you use the box`);}
  defaultDecor(s).forEach((d,i)=>{const t={...s,decor:defaultDecor(s)};assert.equal(spotProblem(t,d.id,d.x,d.z,d.rot,i),null,`${d.id} keeps its default spot`);});
 }
});
test('hangouts: enough stay free in every home state, each can be walked to through the doorways, nobody shares one',()=>{
 assert.equal(new Set(HANGOUTS.map(h=>h.id)).size,HANGOUTS.length);
 for(const h of HANGOUTS)assert.equal(roomAt(h).id,h.room,h.id);
 for(const [room,[inner,outer]] of Object.entries(DOORS)){assert.equal(roomAt(inner).id,room);assert.equal(roomAt(outer).id,'living');}
 for(const s of [freshState(),furnished()]){
  const cols=houseColliders(0,s),usable=usableHangouts(cols);
  assert.ok(usable.length>=8,`${usable.length} hangouts free`);for(const room of ['living','kitchen','bedroom','bath','nook'])assert.ok(usable.some(id=>hangout(id).room===room),`a hangout in the ${room}`);
  // Every usable hangout is reached from every other through the door waypoints, each leg routed round the furniture.
  for(const a of usable)for(const b of usable){if(a===b)continue;let at=hangout(a);for(const leg of doorPath(hangout(a).room,hangout(b).room,hangout(b))){assert.ok(findRoute(at,leg,cols,BOUNDS).length,`${a} -> ${b} via ${leg.x},${leg.z}`);at=leg;}}
  for(let phase=0;phase<40;phase++)for(const hour of [8,13,20]){
   const ids=assignHangouts([{child:false},{child:true},{child:false}],phase,hour,usable);
   assert.equal(ids.length,3);assert.equal(new Set(ids).size,3);for(const id of ids)assert.ok(usable.includes(id));
   if(hour>=18)for(const id of ids)assert.equal(hangout(id).room,'living','evenings together in the living room');
  }
  // Mornings start in the kitchen and the nook; over a day each person visits several rooms.
  assert.deepEqual(assignHangouts([{child:false},{child:true}],0,8,usable).map(id=>hangout(id).room),['kitchen','nook']);
  const rooms=new Set();for(let phase=0;phase<12;phase++)rooms.add(hangout(assignHangouts([{child:false}],phase,13,usable)[0]).room);assert.ok(rooms.size>=4);
 }
 // A decoration on a hangout takes it out of the round; with nothing free, nobody is sent anywhere.
 const blocked=usableHangouts([...houseColliders(0,freshState()),{x:hangout('hello').x,z:hangout('hello').z,w:.6,d:.6}]);assert.ok(!blocked.includes('hello'));
 assert.deepEqual(assignHangouts([{child:false}],0,13,[]),[null]);assert.ok(STAY_SECONDS>=15);
});
test('talk: every room has lines for kids and grown-ups, June and Pip have their own, and a bag does not repeat itself',()=>{
 for(const room of ['living','kitchen','bedroom','bath','nook']){for(const age of ['kid','grown'])assert.ok(ROOM_TALK[room][age].length>=5,`${room} ${age}`);assert.ok(EXCHANGES[room].length>=2);}
 for(const h of HANGOUTS)assert.ok(ROOM_TALK[h.room],h.room);
 assert.ok(PERSONA_TALK.june.length>=5&&PERSONA_TALK.pip.length>=5);
 const all=[...Object.values(ROOM_TALK).flatMap(r=>[...r.kid,...r.grown]),...PERSONA_TALK.june,...PERSONA_TALK.pip];for(const line of all)assert.ok(line.length<=80&&!/[—–]/.test(line),line);
 const bag=new TalkBag(),pool=ROOM_TALK.kitchen.kid,seen=[];for(let i=0;i<Math.ceil(pool.length*.75);i++)seen.push(bag.pick('k',pool));assert.equal(new Set(seen).size,seen.length);
 assert.ok(PERSONA_TALK.pip.includes(lineFor(new TalkBag(),{id:'pip',child:true,room:'nook'},()=>0)));assert.ok(ROOM_TALK.nook.kid.includes(lineFor(new TalkBag(),{id:'pip',child:true,room:'nook'},()=>.9)));
 assert.ok(ROOM_TALK.bath.grown.includes(lineFor(new TalkBag(),{id:'ada',child:false,room:'bath'},()=>0)),'neighbours use the room pools');
 const pair=exchangeFor(new TalkBag(),'kitchen');assert.equal(pair.length,2);assert.equal(exchangeFor(new TalkBag(),'attic'),null);
});
test('the walk cycle follows the ground covered: legs counter-swing, arms oppose them, and it fades out when standing',()=>{
 const rot=()=>({rotation:{x:0}}),parts={leg_l:rot(),leg_r:rot(),arm_l:rot(),arm_r:rot()},g=newGait();
 for(let i=0;i<30;i++)stepGait(g,1.5/60,1/60,.77);assert.ok(g.blend>.9);assert.ok(g.phase>0);
 const bob=applyGait(parts,g,gaitSwing(1.5,.77));assert.ok(bob>=0&&bob<=.06);
 assert.ok(Math.abs(parts.leg_l.rotation.x+parts.leg_r.rotation.x)<1e-9);assert.ok(parts.leg_l.rotation.x*parts.arm_l.rotation.x<=0,'the arm swings against its leg');
 for(let i=0;i<120;i++)stepGait(g,0,1/60,.77);assert.equal(g.blend,0);assert.equal(applyGait(parts,g,.5),0);
});
test('the basket shows its things in labelled groups of compact tiles, meals first, cheapest first',async()=>{
 const {bagHtml,bagGroups,bagGroupOf}=await import('../src/bag-view.mjs'),{sellPrice,itemName}=await import('../src/game.mjs');
 const s=freshState();s.inventory={seed_carrot:6,seed_pumpkin:2,golden:1,perch:2,pumpkin:1,carrot:4,apple:3,soup:1,egg:2,wood:5};
 const groups=bagGroups(s,sellPrice);assert.deepEqual(groups.map(g=>g.id),['meal','harvest','fish','pantry','seed']);
 assert.deepEqual(groups.find(g=>g.id==='harvest').entries.map(e=>e[0]),['carrot','apple','pumpkin']);assert.deepEqual(groups.find(g=>g.id==='fish').entries.map(e=>e[0]),['perch','golden']);
 assert.equal(bagGroupOf('milk'),'pantry');assert.equal(bagGroupOf('pie'),'meal');assert.equal(bagGroupOf('tulip'),'harvest');
 const html=bagHtml(s,{art:id=>`<i data-art="${id}"></i>`,itemName,sellPrice});
 assert.match(html,/🍲 Meals · 1/);assert.match(html,/🥕 Harvest · 3/);assert.match(html,/🌱 Seeds · 2/);assert.match(html,/<h3>Carrot<\/h3>/);assert.match(html,/data-action="do" data-type="eat" data-id="soup"/);assert.equal((html.match(/class="item-card bag-tile"/g)??[]).length,10);
 assert.match(bagHtml(freshState(),{art:()=>'',itemName,sellPrice}),/Seeds · 3/);const empty=freshState();empty.inventory={};assert.match(bagHtml(empty,{art:()=>'',itemName,sellPrice}),/empty-state/);
});
