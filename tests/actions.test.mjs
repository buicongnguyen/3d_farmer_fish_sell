// The stray "That action is not available." toast: every action a button or a module can send is one act() knows, an
// unknown one says nothing at all, every refusal has its own helpful line, and the prompt pill tells the truth about
// this moment (prompts.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {freshState,act,ACTIONS,knownAction,UNKNOWN} from '../src/game.mjs';
import {pandoraAct} from '../src/pandora.mjs';
import {ACTIVITIES,cooldownLeft} from '../src/house-rules.mjs';
import {promptFor,JEEP_SALES,EFFORT} from '../src/prompts.mjs';

const dir=new URL('../src/',import.meta.url),sources=Object.fromEntries(readdirSync(dir).filter(f=>f.endsWith('.mjs')).map(f=>[f,readFileSync(new URL(f,dir),'utf8')]));
const GENERIC=/not available|unavailable action|invalid action/i;

test('act() handles exactly the actions in ACTIONS, and an unknown one says nothing',()=>{
 // The switch in act() and the list agree (the list is what main.mjs checks before sending).
 const game=sources['game.mjs'],body=game.slice(game.indexOf('export function act('),game.indexOf('const number=')),cases=[...body.matchAll(/case '([A-Za-z]+)'/g)].map(m=>m[1]);
 assert.deepEqual([...new Set(cases)].sort(),[...ACTIONS].sort());assert.ok(ACTIONS.size>=50);
 for(const type of ACTIONS){const r=act(freshState(),type,{});assert.notEqual(r.unknown,true,`${type} is handled`);assert.equal(typeof r.ok,'boolean');assert.ok(typeof r.message==='string'&&r.message.length>3,`${type} answers with a line`);assert.doesNotMatch(r.message,GENERIC,type);}
 // Anything else: no message, so nothing can be toasted. The state is untouched.
 for(const type of [undefined,null,'','fly','Plant','do','constructor','toString','__proto__',7,{}]){
  const s=freshState(),before=JSON.stringify(s),r=act(s,type,{id:'x'});
  assert.deepEqual(r,{ok:false,message:'',unknown:true},String(type));assert.equal(JSON.stringify(s),before);assert.equal(knownAction(type),false);
 }
 assert.equal(UNKNOWN.message,'');assert.ok(Object.isFrozen(UNKNOWN));assert.equal(pandoraAct(freshState(),'fly').message,'');
 // The generic line is gone from the game altogether.
 for(const [file,text] of Object.entries(sources))assert.doesNotMatch(text.replace(/\/\/.*$/gm,'').replace(/\/\*[\s\S]*?\*\//g,''),/That action is not available/,file);
});
test('every button and every call in the sources sends an action the game knows',()=>{
 // What a source sends: [type, …] and the slips found ("do" without a data-type).
 const audit=text=>{const types=[],slips=[];
  // Buttons: data-action="do" always comes with its data-type (written in the markup, or through btn(text,'do',data)).
  for(const m of text.matchAll(/data-action="do"([^>]{0,160})/g)){if(!/data-type=/.test(m[1]))slips.push(m[0].slice(0,90));const t=m[1].match(/data-type="([A-Za-z]+)"/);if(t)types.push(t[1]);}
  for(const m of text.matchAll(/'do',\s*([`'][^`']*[`'])/g)){const t=m[1].match(/data-type="([A-Za-z]+)"/);if(t)types.push(t[1]);else slips.push(m[0].slice(0,90));}
  for(const m of text.matchAll(/[`']do\|data-type="([A-Za-z]+)"/g))types.push(m[1]);
  for(const m of text.matchAll(/[`']do\|(?!data-type=)/g))slips.push(text.slice(m.index,m.index+60));
  // Calls: runAction('x'…), deps.act('x'…), act(state, 'x'…).
  for(const m of text.matchAll(/(?:runAction|deps\.act(?:\?\.)?)\(\s*'([A-Za-z]+)'/g))types.push(m[1]);
  for(const m of text.matchAll(/(?<![A-Za-z.])act\(\s*(?:state\(\)|state|s)\s*,\s*'([A-Za-z]+)'/g))types.push(m[1]);
  return {types,slips};};
 // The audit sees what it should (and would see a slip).
 assert.deepEqual(audit('<button data-action="do" data-type="eat" data-id="x">').types,['eat']);assert.equal(audit('<button class="a" data-action="do" data-id="x">Eat</button>').slips.length,1);
 assert.deepEqual(audit("btn('Cook','do',`data-type=\"cook\" data-id=\"${id}\"`)").types,['cook']);assert.equal(audit("btn('Cook','do',`data-id=\"${id}\"`)").slips.length,1);
 assert.deepEqual(audit("card(x,'Cook',`do|data-type=\"cook\" data-id=\"1\"`)").types,['cook']);assert.equal(audit("card(x,'Cook',`do|data-id=\"1\"`)").slips.length,1);
 assert.deepEqual(audit("runAction('water',{index:id});deps.act?.('houseUse',{id});deps.act('look',{id});act(state(), 'defeat', {});act(s, 'knockout');react(s,'nope')").types,['water','houseUse','look','defeat','knockout']);
 const sent=new Map();
 for(const [file,text] of Object.entries(sources)){const {types,slips}=audit(text);assert.deepEqual(slips,[],`${file}: a "do" button without a data-type`);for(const type of types)if(!sent.has(type))sent.set(type,file);}
 assert.ok(sent.size>=45,`${sent.size} action types are sent`);
 for(const [type,where] of sent)assert.ok(ACTIONS.has(type),`${type} (sent from ${where}) is an action the game knows`);
 // The two places a type comes from a variable are guarded: the "do" dispatcher needs a data-type, and runAction asks knownAction first.
 const main=sources['main.mjs'];assert.match(main,/case 'do':if\(d\.type\)runAction\(d\.type,/);assert.match(main,/function runAction\(type,arg=\{\},refresh=true\)\{if\(!knownAction\(type\)\)/);
 assert.match(main,/type==='feed'\|\|type==='collect'\)runAction\(type\)/);
 assert.match(main,/function toast\(message\)\{if\(!message\)return;/,'an empty message is never shown');
});
test('every refusal says what is wrong or when to come back',()=>{
 const s=freshState();s.energy=0;s.coins=0;
 const cases=[
  ['plant',{index:0,crop:'carrot'},/rest|meal/i],['water',{index:0},/Plant a seed/],['harvest',{index:0},/longer/],['buySeed',{id:'carrot'},/coins/],['sell',{},/no produce/],['upgrade',{id:'farm'},/harvests/],
  ['plantTree',{index:0,id:'apple'},/Save/],['pickTree',{index:0},/sapling/],['cast',{},/Rest or eat/],['feed',{},/Rest first/],['collect',{},/feed trough/],['gift',{id:'ada',item:'carrot'},/gift/],
  ['outfit',{id:'sky'},/coins|unavailable/],['kidOutfit',{id:'x'},/unavailable/],['furniture',{id:'rug'},/Save/],['cook',{id:'soup'},/ingredients/],['eat',{id:'soup'},/cooked meal/],['festival',{id:'soup'},/supper|dish/],
  ['bike',{},/350/],['gather',{id:'mushroom',spot:'mushroom-0'},/rest/i],['hunt',{},/Rest/],['race',{seconds:99},/minute/],['civic',{id:'hospital'},/30 coins/],['plot',{},/coins/],['chop',{index:1},/coins/],
  ['lesson',{id:'x'},/subject/],['answer',{given:'1'},/subject/],['hire',{id:'ada',job:'farmhand'},/hello/],['release',{id:'ada'},/not working/],['testSpeed',{id:5},/Unlock/],['testCoins',{},/Unlock/],['testMode',{key:'no'},/key/],['claim',{},/chapter/],
  ['look',{id:'girl-grown-none-none'},/110 coins/],['buyGear',{id:'hat_straw'},/coins/],['equip',{id:'hat_straw'},/wardrobe/],['unequip',{slot:'hat'},/Nothing to take off/],['houseUse',{id:'x'},/Nothing to do/],
  ['placeDecor',{id:'armchair',x:0,z:0},/workshop/],['rotateDecor',{index:99},/not in your home/],['removeDecor',{index:99},/not in your home/],
  ['pandora',{},/Open or close/],['defeat',{type:'boar'},/Nothing to defeat/],['pickup',{id:'hide',count:1},/Nothing to pick up/],['knockout',{},/safe and sound/],
 ];
 for(const [type,arg,want] of cases){const r=act(s,type,arg);assert.equal(r.ok,false,type);assert.match(r.message,want,`${type}: ${r.message}`);assert.doesNotMatch(r.message,GENERIC);}
 // Things at home cool down with a line of their own and the time left ("The kettle is still warming up again · ready in 1:30").
 const home=freshState();home.energy=10;
 for(const a of Object.values(ACTIVITIES).filter(a=>a.cooldown)){
  assert.ok(a.again&&a.again.length>8&&!/[.!]$/.test(a.again),`${a.id} has a line for while it cools down`);
  assert.ok(act(home,'houseUse',{id:a.id}).ok);const r=act(home,'houseUse',{id:a.id});home.energy=10;
  assert.equal(r.ok,false);assert.equal(r.left,cooldownLeft(home,a.id));assert.ok(r.message.startsWith(a.again+' · ready in '),r.message);assert.match(r.message,/ready in \d:\d\d$/);
 }
 assert.equal(act(home,'houseUse',{id:'tea'}).message,'The kettle is still warming up again · ready in 1:30');
});
test('the prompt pill tells the truth about this moment: what the thing does now, or why it has to wait',()=>{
 const s=freshState(),bed={type:'bed',id:0,label:'Tend garden bed'};
 assert.equal(promptFor(s,null),null);
 assert.deepEqual(promptFor(s,bed),{label:'Plant a seed',wait:false});
 act(s,'plant',{index:0,crop:'carrot'});assert.deepEqual(promptFor(s,bed),{label:'Water the carrot',wait:false});
 act(s,'water',{index:0});let p=promptFor(s,bed);assert.equal(p.wait,true);assert.match(p.label,/^Growing carrot · \d+ seconds$/);
 const first=Number(p.label.match(/(\d+) second/)[1]);s.elapsed+=10;assert.equal(Number(promptFor(s,bed).label.match(/(\d+) second/)[1]),first-10,'the seconds count down');
 s.elapsed+=first;assert.deepEqual(promptFor(s,bed),{label:'Harvest carrot',wait:false});
 const dry=freshState();act(dry,'plant',{index:0,crop:'carrot'});dry.energy=0;assert.deepEqual(promptFor(dry,bed),{label:'Too tired · rest or eat first',wait:true});
 // The orchard: a sapling, a young tree, fruit, picked today.
 const tree={type:'tree',id:0,label:'Plant an orchard tree'};assert.deepEqual(promptFor(s,tree),{label:'Plant an orchard tree',wait:false});
 s.coins=500;act(s,'plantTree',{index:0,id:'apple'});assert.deepEqual(promptFor(s,tree),{label:'Young apple tree · fruit in 2 mornings',wait:true});
 act(s,'sleep');assert.deepEqual(promptFor(s,tree),{label:'Young apple tree · fruit in 1 morning',wait:true});
 act(s,'sleep');assert.deepEqual(promptFor(s,tree),{label:'Pick fresh apples',wait:false});assert.ok(act(s,'pickTree',{index:0}).ok);assert.deepEqual(promptFor(s,tree),{label:'Picked today · more fruit tomorrow',wait:true});
 // The animals, the woods, the pond.
 const feed={type:'feed',id:'animals',label:'Feed your animals'},collect={type:'collect',id:'basket',label:'Collect eggs & milk'};
 assert.deepEqual(promptFor(s,collect),{label:'Fill the feed trough first',wait:true});assert.deepEqual(promptFor(s,feed),{label:'Feed your animals',wait:false});
 act(s,'feed');assert.deepEqual(promptFor(s,feed),{label:'The animals are fed for today',wait:true});assert.deepEqual(promptFor(s,collect),{label:'Collect eggs & milk',wait:false});
 act(s,'collect');assert.deepEqual(promptFor(s,collect),{label:'The basket fills again tomorrow',wait:true});
 const patch={type:'gather',id:'mushroom-0',label:'Gather mushroom'};assert.equal(promptFor(s,patch).wait,false);act(s,'gather',{id:'mushroom',spot:'mushroom-0'});assert.deepEqual(promptFor(s,patch),{label:'This patch regrows tomorrow',wait:true});
 const trail={type:'hunt',id:'woodland',label:'Follow the woodland trail'};assert.equal(promptFor(s,trail).wait,false);act(s,'hunt');assert.deepEqual(promptFor(s,trail),{label:'The woodland rests until tomorrow',wait:true});
 const pond={type:'fish',id:'pond',label:'Cast your fishing rod'};assert.equal(promptFor(s,pond).wait,false);s.energy=EFFORT.cast-1;assert.deepEqual(promptFor(s,pond),{label:'Too tired · rest or eat first',wait:true});
 // Vehicles: the jeep says how far there is to go, the motorcycle where to buy it.
 const jeep={type:'vehicle',id:'jeep',label:'Borrow the Bell family jeep'};s.stats.sales=50;assert.deepEqual(promptFor(s,jeep),{label:`Theo’s jeep · sell ${JEEP_SALES-50} more coins of produce`,wait:true});s.stats.sales=JEEP_SALES;assert.deepEqual(promptFor(s,jeep),{label:jeep.label,wait:false});
 assert.match(promptFor(s,{type:'vehicle',id:'bike',label:'Ride the motorcycle'}).label,/workshop/);s.bike=true;assert.equal(promptFor(s,{type:'vehicle',id:'bike',label:'Ride the motorcycle'}).label,'Ride the motorcycle');
 // Things at home: the wait shows on the pill; in a neighbour's house the same sofa is only a kind word.
 const sofa={type:'fun',id:'sofa',label:'Sit a while',activity:'sofa'};s.energy=20;assert.deepEqual(promptFor(s,sofa),{label:'Sit a while',wait:false});
 act(s,'houseUse',{id:'sofa'});assert.deepEqual(promptFor(s,sofa),{label:'Sofa · ready in 2:00',wait:true});assert.deepEqual(promptFor(s,sofa,{home:false}),{label:'Sit a while',wait:false});
 s.elapsed+=120;assert.equal(promptFor(s,sofa).wait,false);
 // Everything else keeps its own label and is ready (a door, a neighbour, a creature in reach).
 for(const t of [{type:'exit',id:'door',label:'Step outside'},{type:'person',id:'ada',label:'Talk to Ada'},{type:'creature',id:'w1',label:'Attack · Wild Boar'},{type:'dismount',id:'jeep',label:'Park & step out'}])assert.deepEqual(promptFor(s,t),{label:t.label,wait:false});
 // A label is never empty and never generic, whatever the state.
 for(const t of [bed,tree,feed,collect,patch,trail,pond,jeep,sofa])for(const state of [freshState(),s]){const q=promptFor(state,t);assert.ok(q.label.length>3);assert.doesNotMatch(q.label,GENERIC);}
});
