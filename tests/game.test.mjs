import test from 'node:test';
import assert from 'node:assert/strict';
import {freshState,act,tick,ripe,parseSave,bedCount,chapterReady,calendar,save,load,DEFEATED_MAX,HOME_SPOT} from '../src/game.mjs';
import {CREATURES} from '../src/wilds.mjs';
import {RESIDENTS,HOUSES,CHAPTERS,CROPS,UPGRADES,ITEMS,OUTFITS} from '../src/content.mjs';
import {inWorld,RING,shapeOf,REGION_IDS} from '../src/regions.mjs';
import {SAFE,inSafeZone} from '../src/ward.mjs';
import {JEEP_SALES} from '../src/drive.mjs';
import {JEEP_SALES as PROMPT_SALES} from '../src/prompts.mjs';
import {GATE} from '../src/content.mjs';

test('village has 24 people including the player across 10 households (six houses, four lodgings)',()=>{assert.equal(RESIDENTS.length+1,24);assert.equal(HOUSES.length,10);assert.equal(new Set(RESIDENTS.map(p=>p.id)).size,23);for(const h of HOUSES)assert.ok(RESIDENTS.some(p=>p.home===h.id));});
test('a complete growing and trade cycle makes a sustainable profit',()=>{const s=freshState();const coins=s.coins;assert.ok(act(s,'buySeed',{id:'carrot'}).ok);assert.ok(act(s,'plant',{index:0,crop:'carrot'}).ok);s.elapsed+=100;assert.equal(ripe(s,s.beds[0]),false);assert.ok(act(s,'water',{index:0}).ok);s.elapsed+=33;assert.ok(ripe(s,s.beds[0]));assert.ok(act(s,'harvest',{index:0}).ok);assert.equal(s.inventory.carrot,2);assert.ok(act(s,'sell',{id:'carrot'}).ok);assert.ok(s.coins>coins);assert.equal(s.stats.sales,38);assert.equal(s.inventory.seed_carrot,8);});
test('failed planting, overspending and locked beds leave resources unchanged',()=>{const s=freshState();s.coins=0;const snapshot=structuredClone(s);assert.equal(act(s,'buySeed',{id:'berry'}).ok,false);assert.equal(act(s,'plant',{index:6,crop:'carrot'}).ok,false);assert.equal(act(s,'plant',{index:-1,crop:'carrot'}).ok,false);assert.equal(act(s,'plant',{index:0,crop:'berry'}).ok,false);assert.equal(act(s,'upgrade',{id:'pond'}).ok,false);assert.deepEqual(s,snapshot);});
test('watering is not charged twice and harvest rewards cannot duplicate',()=>{const s=freshState();act(s,'plant',{index:0,crop:'carrot'});act(s,'water',{index:0});const e=s.energy;assert.equal(act(s,'water',{index:0}).ok,false);assert.equal(s.energy,e);s.elapsed+=40;act(s,'harvest',{index:0});assert.equal(act(s,'harvest',{index:0}).ok,false);assert.equal(s.inventory.carrot,2);});
test('orchard matures after two mornings and pays once daily',()=>{const s=freshState();assert.ok(act(s,'plantTree',{index:0,id:'apple'}).ok);assert.equal(act(s,'pickTree',{index:0}).ok,false);act(s,'sleep');assert.equal(act(s,'pickTree',{index:0}).ok,false);act(s,'sleep');assert.ok(act(s,'pickTree',{index:0}).ok);assert.equal(s.inventory.apple,3);assert.equal(act(s,'pickTree',{index:0}).ok,false);act(s,'sleep');act(s,'pickTree',{index:0});assert.equal(s.inventory.apple,6);});
test('pen products require care and reset at dawn',()=>{const s=freshState();s.upgrades.pen=2;assert.equal(act(s,'collect').ok,false);act(s,'feed');act(s,'collect');assert.equal(s.inventory.egg,3);assert.equal(s.inventory.milk,1);assert.equal(act(s,'feed').ok,false);assert.equal(act(s,'collect').ok,false);act(s,'sleep');act(s,'feed');act(s,'collect');assert.equal(s.inventory.milk,2);});
test('cooking consumes exact ingredients, kitchen gates recipes, food restores energy',()=>{const s=freshState();s.inventory={carrot:2,mushroom:1,perch:1};assert.equal(act(s,'cook',{id:'fishplate'}).ok,false);assert.ok(act(s,'cook',{id:'soup'}).ok);assert.equal(s.inventory.carrot,undefined);assert.equal(s.inventory.soup,1);s.energy=30;assert.ok(act(s,'eat',{id:'soup'}).ok);assert.equal(s.energy,65);assert.equal(act(s,'eat',{id:'soup'}).ok,false);});
test('festival accepts owned food on the festival day only once',()=>{const s=freshState();s.inventory.soup=3;assert.equal(act(s,'festival',{id:'soup'}).ok,false);s.day=3;const cash=s.coins;assert.ok(act(s,'festival',{id:'soup'}).ok);assert.equal(s.coins,cash+230);assert.equal(s.inventory.soup,2);assert.equal(act(s,'festival',{id:'soup'}).ok,false);});
test('friendship conversations and gifts have independent daily caps',()=>{const s=freshState();act(s,'talk',{id:'ada'});act(s,'talk',{id:'ada'});assert.equal(s.friendship.ada,1);s.inventory.carrot=2;act(s,'gift',{id:'ada',item:'carrot'});assert.equal(s.friendship.ada,3);assert.equal(act(s,'gift',{id:'ada',item:'carrot'}).ok,false);assert.equal(s.inventory.carrot,1);act(s,'sleep');act(s,'talk',{id:'ada'});assert.equal(s.friendship.ada,4);});
test('cosmetics are paid once and remain equipable at zero coins',()=>{const s=freshState();act(s,'outfit',{id:'harbor'});assert.equal(s.coins,85);act(s,'outfit',{id:'meadow'});s.coins=0;assert.ok(act(s,'outfit',{id:'harbor'}).ok);assert.equal(s.outfit,'harbor');assert.equal(act(s,'outfit',{id:'festival'}).ok,false);});
test('all eight story chapters can be completed and rewards are one-time',()=>{const s=freshState();act(s,'talk',{id:'ada'});s.stats={harvests:3,fish:2,sales:200,feeds:1,trips:1,cooked:1,festivals:1,races:1};s.upgrades.house=1;s.upgrades.pond=2;s.trees=[{kind:'apple',day:1,picked:0},{kind:'peach',day:1,picked:0},null];for(const p of RESIDENTS.slice(0,12))s.met[p.id]=true;for(let i=0;i<8;i++){assert.ok(chapterReady(s));assert.ok(act(s,'claim').ok);assert.equal(s.chapter,i+1);}const coins=s.coins;assert.equal(act(s,'claim').ok,false);assert.equal(s.coins,coins);});
test('save round-trip preserves progression and rejects impossible imported values',()=>{const s=freshState();act(s,'plant',{index:0,crop:'carrot'});act(s,'talk',{id:'ada'});s.coins=345;const copy=parseSave(JSON.parse(JSON.stringify(s)));assert.equal(copy.coins,345);assert.deepEqual(copy.beds,s.beds);assert.deepEqual(copy.met,s.met);const corrupt=parseSave({...s,coins:-100,energy:Infinity,day:NaN,chapter:999,owned:['imaginary'],outfit:'imaginary',upgrades:{farm:1000},plots:1000,inventory:{carrot:-5,seed_carrot:2,unknown:99},position:{x:Infinity,z:-999}});assert.equal(corrupt.coins,0);assert.equal(corrupt.energy,100);assert.equal(corrupt.day,1);assert.equal(corrupt.chapter,8);assert.equal(bedCount(corrupt),30);assert.deepEqual(corrupt.inventory,{seed_carrot:2});assert.equal(corrupt.outfit,'meadow');assert.throws(()=>parseSave({version:99}));});
test('storage failure is reported and malformed JSON does not crash loading',()=>{const bad={setItem(){throw Error('quota');},getItem(){return '{broken';}};assert.equal(save(freshState(),bad),false);assert.ok(load(bad).error);});
test('imported content names cannot use inherited object keys as crops, trees, items or jobs',()=>{
 const s=freshState(),helper=RESIDENTS.find(p=>p.home>0&&!p.child).id;
 s.inventory={carrot:2,constructor:3,seed_constructor:4};s.beds[0]={crop:'constructor',planted:0,watered:true};s.trees[0]={kind:'toString',day:1,picked:0};s.hired[helper]='constructor';
 const back=parseSave(JSON.parse(JSON.stringify(s)));assert.deepEqual(back.inventory,{carrot:2});assert.equal(back.beds[0],null);assert.equal(back.trees[0],null);assert.deepEqual(back.hired,{});
 assert.ok(act(back,'sleep').ok);assert.equal(back.coins,s.coins,'invalid workers never turn savings into NaN');
});
test('years and seasons advance and rain waters planted beds',()=>{const s=freshState();s.day=4;act(s,'plant',{index:0,crop:'carrot'});act(s,'sleep');assert.equal(s.beds[0].watered,true);s.day=29;assert.deepEqual(calendar(s),{season:'Spring',day:1,year:2,festival:false,rain:false});});
test('supermarket premium (the old country market price), fishing tiers and bounded daily activities',()=>{const s=freshState();s.inventory.carrot=2;act(s,'sell',{id:'carrot',country:true});assert.equal(s.stats.sales,46);s.upgrades.pond=3;act(s,'catch',{roll:.99});assert.equal(s.inventory.guardian,1);act(s,'catch',{roll:.5});assert.equal(s.inventory.golden,1);act(s,'hunt');assert.equal(act(s,'hunt').ok,false);act(s,'race',{seconds:30});assert.equal(act(s,'race',{seconds:30}).ok,false);});
test('full upgrades and shopping cannot duplicate purchases',()=>{const s=freshState();s.coins=100000;for(const id of Object.keys(UPGRADES)){for(let n=0;n<3;n++)assert.ok(act(s,'upgrade',{id}).ok);assert.equal(act(s,'upgrade',{id}).ok,false);}act(s,'furniture',{id:'rug'});assert.equal(act(s,'furniture',{id:'rug'}).ok,false);act(s,'bike');assert.equal(act(s,'bike').ok,false);});
test('sleep advances watered crops and zero energy cannot softlock the farm',()=>{const s=freshState();act(s,'plant',{index:0,crop:'pumpkin'});act(s,'water',{index:0});s.energy=0;act(s,'sleep');assert.equal(s.energy,100);assert.ok(ripe(s,s.beds[0]));s.energy=0;act(s,'rest');assert.equal(s.energy,25);});
// The world has an edge (round 8, spec 7.3). The test that kept places 12 km out came here from tests/fields.test.mjs in step 0; this is its rule now.
const again=s=>parseSave(JSON.parse(JSON.stringify(s)));
const HOME={x:0,z:-8};
test('a save keeps any place in the world, in every square; one outside it wakes in the homestead yard with the cars parked',()=>{
 assert.deepEqual({...HOME_SPOT},HOME);assert.ok(inSafeZone(HOME.x,HOME.z));
 // Every region's anchor, and points just over two metres inside the circle's edge.
 const kept=[...REGION_IDS.map(id=>({x:shapeOf(id).cx,z:shapeOf(id).cz})),{x:RING.R2-2.1,z:0},{x:-RING.R2+2.1,z:0},{x:0,z:RING.R2-2.1},{x:0,z:-RING.R2+2.1},{x:250,z:0},{x:-250,z:-20}];
 for(const at of kept){const s=freshState();s.position={...at};s.vehicles.jeep={x:at.x,z:at.z,rot:.5};assert.deepEqual(again(s).position,at,`(${at.x}, ${at.z}) is kept`);assert.deepEqual(again(s).vehicles.jeep,{x:at.x,z:at.z,rot:.5});}
 // Outside: the old endless fields, beyond the circle (the old squares' corners and tips among them), nearer the edge than two metres, broken values.
 const lost=[{x:230,z:-190},{x:-210,z:210},{x:300,z:0},{x:-12000,z:8000},{x:12000,z:-8000},{x:-1200,z:1800},{x:RING.R2-1,z:0},{x:0,z:RING.R2+.5},{x:Infinity,z:1e20},{x:NaN,z:0},{x:'12',z:3},{x:5}];
 for(const at of lost){
  const s=freshState();s.position=at;s.bike=true;s.stats.sales=JEEP_SALES;s.riding='jeep';s.heading=1.2;s.vehicles={jeep:{x:100,z:0,rot:1},bike:{x:120,z:5,rot:2}};
  const raw=JSON.parse(JSON.stringify(s));if(at.x===Infinity)raw.position={x:Infinity,z:1e20};if(Number.isNaN(at.x))raw.position={x:NaN,z:0};
  const back=parseSave(raw);assert.deepEqual(back.position,HOME,`(${at.x}, ${at.z}) goes home`);assert.deepEqual(back.vehicles,{jeep:null,bike:null},'cars parked');assert.equal(back.riding,'');assert.equal(back.heading,0);
  assert.ok(inWorld(back.position.x,back.position.z,2));
 }
 // A missing position is the same; a save with no position at all is not a crash.
 const bare=JSON.parse(JSON.stringify(freshState()));delete bare.position;assert.deepEqual(parseSave(bare).position,HOME);
});
test('a vehicle left outside the world is parked; one you may not drive yet is not ridden; a heading is a number',()=>{
 const s=freshState();s.position={x:150,z:-20};s.vehicles={jeep:{x:230,z:-190,rot:1},bike:{x:RING.R2-1,z:0,rot:1}};
 let back=again(s);assert.deepEqual(back.vehicles,{jeep:null,bike:null});assert.deepEqual(back.position,{x:150,z:-20},'you stay where you are');
 s.vehicles={jeep:{x:100,z:20,rot:Infinity},bike:{x:100,z:20,rot:-2.5}};const raw=JSON.parse(JSON.stringify(s));raw.vehicles.jeep.rot='east';back=parseSave(raw);assert.equal(back.vehicles.jeep,null,'a rot that is not a number');assert.deepEqual(back.vehicles.bike,{x:100,z:20,rot:-2.5});
 // Riding needs the right to ride: the motorcycle bought, the jeep unlocked by sales (the same number the prompt and the door use).
 assert.equal(JEEP_SALES,200);assert.equal(PROMPT_SALES,JEEP_SALES,'prompts.mjs re-exports drive.mjs\'s number');
 for(const [riding,change,want]of [['bike',t=>{t.bike=false;},''],['bike',t=>{t.bike=true;},'bike'],['jeep',t=>{t.stats.sales=JEEP_SALES-1;},''],['jeep',t=>{t.stats.sales=JEEP_SALES;},'jeep']]){
  const t=freshState();t.position={x:150,z:-20};t.riding=riding;t.heading=2;change(t);const r=again(t);assert.equal(r.riding,want,`${riding}: ${want||'not ridden'}`);assert.deepEqual(r.position,{x:150,z:-20},'the place is kept either way');
 }
 for(const heading of ['north',null,NaN,Infinity,{}]){const t=JSON.parse(JSON.stringify(freshState()));t.heading=heading;assert.equal(parseSave(t).heading,0);}
 for(const heading of [0,-3.1,1.951,6.5]){const t=freshState();t.heading=heading;assert.equal(again(t).heading,heading);}
});
test('an old save without `vehicles`: outside the ward it goes home (a player the lost car left stranded), inside it keeps its place',()=>{
 const old=at=>{const s=JSON.parse(JSON.stringify(freshState()));for(const k of ['vehicles','riding','heading','defeated','friends'])delete s[k];s.position=at;s.cleared=[3,127];s.planted={127:{kind:'apple',day:1,picked:0}};return s;};
 for(const at of [{x:SAFE.x1+1,z:0},{x:150,z:150},{x:0,z:SAFE.z1+30},{x:-250,z:-20}]){const back=parseSave(old(at));assert.deepEqual(back.position,HOME,`(${at.x}, ${at.z}) goes home`);assert.deepEqual(back.vehicles,{jeep:null,bike:null});assert.equal(back.riding,'');}
 for(const at of [{x:SAFE.x1-1,z:0},{x:-21,z:30},{x:0,z:-4},{x:46,z:-12}]){const back=parseSave(old(at));assert.deepEqual(back.position,at,`(${at.x}, ${at.z}) is kept`);assert.deepEqual(back.vehicles,{jeep:null,bike:null});assert.equal(back.riding,'');assert.equal(back.heading,0);
  assert.deepEqual(back.cleared,[3,127]);assert.deepEqual(Object.keys(back.planted),['127'],'cleared and planted are untouched by the new rules');}
 // With the field (a save of this round), the same far place is kept: on foot, far out, is where you left yourself.
 const now=freshState();now.position={x:150,z:150};now.cleared=[3,127];now.planted={127:{kind:'apple',day:1,picked:0}};const kept=again(now);assert.deepEqual(kept.position,{x:150,z:150});assert.deepEqual(kept.cleared,[3,127]);assert.deepEqual(Object.keys(kept.planted),['127']);
 // The gate's spur: a save made on the old trip road still wakes on the ring road inside the gate, and that place is then kept (it is in the ward).
 for(const field of [true,false]){const s=old({x:62,z:1});if(field)s.vehicles={jeep:null,bike:null};const back=parseSave(s);assert.deepEqual(back.position,{x:GATE.back.x,z:GATE.back.z});assert.ok(inSafeZone(back.position.x,back.position.z));}
});
test('a save from before `defeated` was kept: the Bear hat or the Royal crown proves the King Bear was beaten',()=>{
 const old=gear=>{const s=JSON.parse(JSON.stringify(freshState()));delete s.defeated;s.gearOwned=gear;return s;};
 assert.deepEqual(parseSave(old(['hat_bear'])).defeated,{bear:true});assert.deepEqual(parseSave(old(['crown'])).defeated,{bear:true});assert.deepEqual(parseSave(old(['hat_bear','crown'])).defeated,{bear:true});
 assert.deepEqual(parseSave(old([])).defeated,{},'neither drop: nothing is known to be beaten');
 // A save that has the field is believed as it is, hat or no hat.
 const s=freshState();s.gearOwned=['hat_bear'];assert.deepEqual(again(s).defeated,{});s.defeated={wolf:true};assert.deepEqual(again(s).defeated,{wolf:true});
});
// Round 8, step 0: the save fields the round needs exist, default for an old save, and round trip (builder C tightens the rules, spec 7.3).
test('round 8 save fields: vehicles, riding, heading, defeated and friends default for old saves and round trip',()=>{
 const fresh=freshState();assert.deepEqual(fresh.vehicles,{jeep:null,bike:null});assert.equal(fresh.riding,'');assert.equal(fresh.heading,0);assert.deepEqual(fresh.defeated,{});assert.deepEqual(fresh.friends,[]);
 // A save from main has none of them.
 const old=JSON.parse(JSON.stringify(freshState()));for(const k of ['vehicles','riding','heading','defeated','friends'])delete old[k];old.cleared=[3,127];old.planted={127:{kind:'apple',day:1,picked:0}};
 const parsed=parseSave(old);assert.deepEqual(parsed.vehicles,{jeep:null,bike:null});assert.equal(parsed.riding,'');assert.equal(parsed.heading,0);assert.deepEqual(parsed.defeated,{});assert.deepEqual(parsed.friends,[]);
 assert.deepEqual(parsed.cleared,[3,127]);assert.deepEqual(Object.keys(parsed.planted),['127'],'cleared and planted are untouched by the new fields');
 // A round trip keeps what was saved.
 const s=freshState();s.stats.sales=JEEP_SALES;s.position={x:150,z:-20};s.vehicles={jeep:{x:150,z:-20,rot:1.25},bike:null};s.riding='jeep';s.heading=1.25;s.defeated={bear:true,titan_turtle:true};
 const back=parseSave(JSON.parse(JSON.stringify(s)));assert.deepEqual(back.vehicles,s.vehicles);assert.equal(back.riding,'jeep');assert.equal(back.heading,1.25);assert.deepEqual(back.defeated,{bear:true,titan_turtle:true});
 // Junk falls back to the defaults; a `defeated` key that is not a creature's name, or not `true`, is dropped.
 const junk=parseSave({...JSON.parse(JSON.stringify(freshState())),vehicles:{jeep:{x:'far',z:0,rot:0},bike:7},riding:'horse',heading:'north',defeated:{bear:true,'Bear!':true,wolf:1,x:true},friends:'everyone'});
 assert.deepEqual(junk.vehicles,{jeep:null,bike:null});assert.equal(junk.riding,'');assert.equal(junk.heading,0);assert.deepEqual(junk.defeated,{bear:true});assert.deepEqual(junk.friends,[]);
 // Beating a creature is remembered for good; the two friend actions answer with a line (friends.mjs, builder E).
 const open=freshState();act(open,'pandora',{open:true});assert.ok(act(open,'defeat',{type:'bear'}).ok);assert.deepEqual(open.defeated,{bear:true});assert.deepEqual(parseSave(JSON.parse(JSON.stringify(open))).defeated,{bear:true});
 for(const type of ['rescue','friendHome']){const r=act(freshState(),type,{id:'sprout'});assert.equal(r.ok,false);assert.ok(r.message.length>3);}
 act(open,'sleep');assert.doesNotMatch(act(open,'sleep').message,/undefined/);
});
// Every kind beaten is remembered ('defeat' records commons too), and the round ends with 69 kinds: 9 today, the hawk, 3 home bosses,
// 34 land commons, 12 land bosses, the dragon and 9 titans. A cap under that would forget the last recorded ones, the late bosses and titans.
test('a save remembers every kind beaten: 69 kinds fit under the cap, with room',()=>{
 assert.ok(DEFEATED_MAX>=69+32,'room beyond the round\'s 69 kinds');
 const letters='abcdefghijklmnopqrstuvwxyz',name=i=>'kind_'+letters[Math.floor(i/26)]+letters[i%26];
 const s=freshState();for(let i=0;i<69;i++)s.defeated[name(i)]=true;s.defeated.titan_eye=true;
 const back=parseSave(JSON.parse(JSON.stringify(s)));assert.equal(Object.keys(back.defeated).length,70);assert.equal(back.defeated.titan_eye,true,'the last one recorded is still there');assert.equal(back.defeated[name(68)],true);
 const many=freshState();for(let i=0;i<DEFEATED_MAX+40;i++)many.defeated[name(i)]=true;assert.equal(Object.keys(parseSave(JSON.parse(JSON.stringify(many))).defeated).length,DEFEATED_MAX,'junk cannot grow it without end');
 // Through the action itself: seventy different kinds beaten, saved and loaded.
 const open=freshState();act(open,'pandora',{open:true});const kinds=Object.keys(CREATURES);for(const type of kinds)assert.ok(act(open,'defeat',{type}).ok,type);
 assert.deepEqual(Object.keys(parseSave(JSON.parse(JSON.stringify(open))).defeated).sort(),[...kinds].sort());assert.ok(kinds.length<=DEFEATED_MAX);
});
