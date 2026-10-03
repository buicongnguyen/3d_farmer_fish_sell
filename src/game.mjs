import {inWorld} from './regions.mjs';
import {inSafeZone} from './ward.mjs';
import {JEEP_SALES} from './drive.mjs';
import { CROPS,ITEMS,TREES,OUTFITS,KID_OUTFITS,FURNITURE,UPGRADES,RECIPES,RESIDENTS,CHAPTERS,SEASONS,MAX_BEDS,JOBS,GATE } from './content.mjs';
import { placeDecor,rotateDecor,removeDecor,parseDecor,PLAN } from './home-plan.mjs';
import { pandoraAct,foodHeal,canHeal } from './pandora.mjs';
import { DEFAULT_LOOK,lookAction,bodyAction,parseLook } from './looks.mjs';
import { emptyGear,buyGear,equipGear,unequipGear,parseGear } from './gear.mjs';
import { freshHouse,useActivity,parseHouse,parseFound,markFound } from './house-rules.mjs';
import { villageTrees } from './village-plan.mjs';
import { parseFriends,friendYield,friendsAct } from './friends.mjs';
export const SAVE_KEY='willowmere.save.v1';
// The most kinds a save remembers as beaten (state.defeated). pandora.mjs 'defeat' records every kind, commons included: the round ends
// with 69 kinds (tests/game.test.mjs counts them against this), so 64 would drop the last recorded ones, the late bosses and titans.
export const DEFEATED_MAX=128;
// Where a save wakes when its own place cannot be kept (outside the world, or a player the old endless fields left stranded): the homestead's yard.
export const HOME_SPOT=Object.freeze({x:0,z:-8});
export const freshState=()=>({version:1,day:1,time:8,elapsed:0,coins:160,energy:100,chapter:0,inventory:{'seed_carrot':6,'seed_radish':3,'seed_pumpkin':2},beds:Array(MAX_BEDS).fill(null),plots:0,cleared:[],planted:{},hired:{},learned:{},learnDay:0,learnCount:0,trees:Array(3).fill(null),upgrades:{farm:0,pond:0,pen:0,house:0,kitchen:0},owned:['meadow'],outfit:'meadow',body:'girl',look:DEFAULT_LOOK,looksOwned:[],gear:emptyGear(),gearOwned:[],house:freshHouse(),found:{},kidOwned:[],kidOutfit:'',furniture:[],decor:null,plan:PLAN,met:{},friendship:{},talked:{},gifted:{},stats:{harvests:0,fish:0,sales:0,feeds:0,trips:0,cooked:0,festivals:0,races:0,lessons:0,checkups:0,patrols:0,shifts:0,answers:0,chops:0},civicDay:{school:0,hospital:0,police:0,company:0},fedDay:0,collectedDay:0,festivalDay:0,raceDay:0,huntDay:0,gathered:{},bike:false,pandora:false,hp:100,position:{x:0,z:-4},vehicles:{jeep:null,bike:null},riding:'',heading:0,defeated:{},friends:[],settings:{quality:'balanced',sound:true,test:false,speed:1,light:'day'},started:false});
export const calendar=s=>({season:SEASONS[Math.floor((s.day-1)/7)%4],day:(s.day-1)%7+1,year:Math.floor((s.day-1)/28)+1,festival:s.day%3===0,rain:s.day%5===0});
export const bedCount=s=>Math.min(MAX_BEDS,6+s.plots*2);
export const plotCost=s=>40+s.plots*20;
// ---- Fruit trees. The three orchard circles (s.trees) and the spot of any village tree you cleared (s.planted, keyed by the
// tree's index) hold a tree of a kind you choose: {kind, day planted, day last picked}. A tree is a sapling, then young, then
// bears for ever: FRUIT a day, SEASON_FRUIT in the kind's best season (a bonus, never a penalty).
export const FRUIT=3,SEASON_FRUIT=5;
/** How many cleared spots may hold a fruit tree: more with each tier of Rich soil (8, 12, 16, 20), beside the 3 orchard circles.
 * Eight to begin with: one of every kind. */
export const plantCap=s=>8+4*(s.upgrades?.farm??0);
export const plantedCount=s=>Object.keys(s.planted??{}).length;
/** Every fruit tree you have: the orchard's and the planted spots'. */
export const fruitTrees=s=>(s.trees??[]).filter(Boolean).length+plantedCount(s);
/** A village tree that stands in the world (not one the compact village has no room for). */
export const livingTree=i=>Number.isInteger(i)&&i>=0&&!!villageTrees()[i]&&!villageTrees()[i].gone;
/** 0 sapling, 1 young, 2 bearing. Test mode grows at once. */
export const treeStage=(s,t)=>{const grow=TREES[t.kind]?.grow??2,age=s.day-t.day;return s.settings?.test||age>=grow?2:age>=Math.ceil(grow/2)?1:0;};
/** Mornings until the first fruit (0 when bearing). */
export const treeWait=(s,t)=>s.settings?.test?0:Math.max(0,(TREES[t.kind]?.grow??2)-(s.day-t.day));
export const inSeason=(s,t)=>calendar(s).season===TREES[t.kind]?.season;
export const fruitToday=(s,t)=>inSeason(s,t)?SEASON_FRUIT:FRUIT;
/** Bearing and not picked today. */
export const treeReady=(s,t)=>!!t&&treeWait(s,t)===0&&(t.picked!==s.day||!!s.settings?.test);
export const TEST_KEY='buicongnguyen';
export const CHOP_COST=15;
export const LESSON_CAP=30;
export const ripe=(s,b)=>!!b&&b.watered&&(s.settings?.test||s.elapsed-b.planted>=CROPS[b.crop].grow);
export const cropProgress=(s,b)=>b?(b.watered?s.settings?.test?1:Math.min(1,(s.elapsed-b.planted)/CROPS[b.crop].grow):0):0;
export const currentChapter=s=>CHAPTERS[s.chapter];
export const chapterReady=s=>!!currentChapter(s)&&currentChapter(s).goals.every(([,check])=>check(s));
export const itemName=id=>id.startsWith('seed_')?`${CROPS[id.slice(5)]?.name??'Unknown'} seeds`:ITEMS[id]?.name??id;
export const sellPrice=(s,id,country=false)=>Math.floor((ITEMS[id]?.sell??0)*(country?1.25:1)*(RECIPES[id]&&s.upgrades.kitchen===3?1.25:1));
const add=(s,id,n=1)=>{markFound(s,id);return s.inventory[id]=(s.inventory[id]??0)+n;};
const has=(s,id,n=1)=>(s.inventory[id]??0)>=n;
const take=(s,id,n=1)=>{s.inventory[id]-=n;if(s.inventory[id]<=0)delete s.inventory[id];};
const ok=message=>({ok:true,message}), fail=message=>({ok:false,message});
/**
 * Every action act() knows. A type outside this list is a programming slip (a button without its data-type, a module
 * calling an action another build does not have), never something the player did: act() answers it with UNKNOWN, which
 * carries no message, so nothing is toasted (the old answer was a stray "That action is not available."). main.mjs
 * does not send one either, and tests/actions.test.mjs checks that every button and call in the sources uses a known one.
 */
export const ACTIONS=new Set(['plant','water','harvest','buySeed','sell','upgrade','plantTree','pickTree','plantSpot','pickSpot','uproot','cast','hook','catch','feed','collect','talk','gift','outfit','body','look','buyGear','equip','unequip','houseUse','kidOutfit','furniture','cook','eat','festival','bike','trip','gather','hunt','race','civic','plot','chop','lesson','answer','hire','release','testMode','testSpeed','testCoins','testOff','claim','sleep','rest','placeDecor','rotateDecor','removeDecor','pandora','defeat','pickup','knockout','rescue','friendHome']);
export const knownAction=type=>typeof type==='string'&&ACTIONS.has(type);
export const UNKNOWN=Object.freeze({ok:false,message:'',unknown:true});
function pay(s,amount){if(!Number.isFinite(amount)||s.coins<amount)return false;s.coins-=amount;return true;}
function effort(s,amount){if(s.energy<amount)return false;s.energy-=amount;return true;}
function pickFruit(s,t){const left=treeWait(s,t);if(left>0)return fail(`A young tree. Fruit in ${left} morning(s).`);if(t.picked===s.day&&!s.settings.test)return fail('Come back tomorrow for more fruit.');const n=fruitToday(s,t),k=TREES[t.kind];add(s,t.kind,n);t.picked=s.day;return ok(n>FRUIT?`Five fresh ${k.plural}: ${k.season} is their season.`:`Three fresh ${k.plural}, straight from the tree.`);}
const mornings=n=>n===1?'one morning':`${['zero','one','two','three','four','five'][n]??n} mornings`;
// Morning wages for hired neighbours. Unpaid helpers go home. Rescued friends fill the basket too, for no wage (friendYield, friends.mjs).
export function payWorkers(s){let paid=0;const left=[];for(const [id,job] of Object.entries(s.hired)){const j=JOBS[job],p=RESIDENTS.find(p=>p.id===id);if(!j||!p){delete s.hired[id];continue;}if(s.coins<j.wage){delete s.hired[id];left.push(p.name);continue;}s.coins-=j.wage;paid+=j.wage;for(const [item,n] of Object.entries(j.yields))add(s,item,n);}
 // An orchard hand picks every tree that is ready (once, however many are hired); nobody plants or replaces your trees.
 if(Object.values(s.hired).some(job=>JOBS[job]?.picks))for(const t of [...s.trees,...Object.values(s.planted)])if(t&&treeWait(s,t)===0&&t.picked!==s.day){add(s,t.kind,fruitToday(s,t));t.picked=s.day;}
 const n=Object.keys(s.hired).length;return (n?` · ${n} helper${n>1?'s':''} paid ${paid} coins and filled your basket.`:'')+(left.length?` ${left.join(', ')} went home unpaid.`:'')+friendYield(s);}
// School lessons: English words, numbers and arithmetic. Each correct answer pays coins.
export const SUBJECTS={
 english:{name:'English words',emoji:'🔤',pay:8,desc:'Match pictures and words.'},
 numbers:{name:'Numbers',emoji:'🔢',pay:6,desc:'Number names and digits.'},
 counting:{name:'Counting',emoji:'🐥',pay:5,desc:'How many can you see?'},
 plus:{name:'Plus',emoji:'➕',pay:7,desc:'Add two numbers.'},
 minus:{name:'Minus',emoji:'➖',pay:8,desc:'Take one number away.'},
 times:{name:'Multiply',emoji:'✖️',pay:11,desc:'Times tables 2 to 9.'},
 divide:{name:'Divide',emoji:'➗',pay:12,desc:'Share equally.'},
};
const WORDS=[['🍎','apple'],['🐟','fish'],['🐄','cow'],['🌻','sunflower'],['🏠','house'],['🚜','tractor'],['🥕','carrot'],['🐔','chicken'],['🌳','tree'],['☀️','sun'],['🚗','car'],['📚','book'],['🐷','pig'],['🥚','egg'],['🌧️','rain'],['🏫','school'],['🐶','dog'],['🐱','cat'],['🍞','bread'],['🥛','milk'],['🌙','moon'],['⭐','star'],['🚲','bike'],['🎒','backpack']];
const NUMBER_WORDS=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen','twenty'];
function shuffle(list,r){for(let i=list.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[list[i],list[j]]=[list[j],list[i]];}return list;}
function numberChoices(answer,r,spread=4){const set=new Set([answer]);while(set.size<4){const v=answer+Math.round((r()-.5)*2*spread);if(v>=0)set.add(v);spread++;}return shuffle([...set],r);}
export function makeQuestion(subject,r=Math.random){
 const n=(a,b)=>a+Math.floor(r()*(b-a+1));let q,answer,choices;
 if(subject==='english'){const pick=shuffle([...WORDS],r).slice(0,4),[icon,word]=pick[0];if(r()<.5){q=`Which word matches ${icon}?`;answer=word;choices=shuffle(pick.map(p=>p[1]),r);}else{q=`Which picture is “${word}”?`;answer=icon;choices=shuffle(pick.map(p=>p[0]),r);}}
 else if(subject==='numbers'){const v=n(0,20),pool=numberChoices(v,r).filter(x=>x<=20);for(let k=1;pool.length<4;k++){const x=(v+k*3)%21;if(!pool.includes(x))pool.push(x);}if(r()<.5){q=`Which number is “${NUMBER_WORDS[v]}”?`;answer=v;choices=pool;}else{q=`How do you write ${v} in words?`;answer=NUMBER_WORDS[v];choices=pool.map(x=>NUMBER_WORDS[x]);}}
 else if(subject==='counting'){const v=n(1,12),icon=['🐥','🍎','🌻','🐟','⭐','🥕'][n(0,5)];q=`How many? ${icon.repeat(v)}`;answer=v;choices=numberChoices(v,r,3);}
 else if(subject==='plus'){const a=n(1,12),b=n(1,12);q=`${a} + ${b} = ?`;answer=a+b;choices=numberChoices(answer,r);}
 else if(subject==='minus'){const a=n(2,20),b=n(1,a);q=`${a} − ${b} = ?`;answer=a-b;choices=numberChoices(answer,r);}
 else if(subject==='times'){const a=n(2,9),b=n(2,9);q=`${a} × ${b} = ?`;answer=a*b;choices=numberChoices(answer,r,8);}
 else if(subject==='divide'){const b=n(2,9),a=n(2,9);q=`${a*b} ÷ ${b} = ?`;answer=a;choices=numberChoices(answer,r);}
 else return null;
 return {subject,q,answer:String(answer),choices:choices.slice(0,4).map(String),wrong:0};
}
export const CIVIC_ACTS={
 hospital:{title:'Check-up',cost:30,stat:'checkups',done:'One check-up a day is plenty.',message:'A warm check-up and a ginger tea. Energy fully restored!'},
 police:{title:'Village patrol',energy:6,pay:40,hours:1,stat:'patrols',done:'The village is safe for today. Thank you!',message:'You helped Officer Reed find a lost goat. Reward +40 coins'},
 company:{title:'Office shift',energy:15,pay:75,hours:3,stat:'shifts',done:'Your shift is done for today.',message:'Three hours packing produce orders at Willow & Co. Wage +75 coins'},
};
export function tick(s,dt){dt=Math.max(0,Math.min(dt,.25))*(s.settings.test?s.settings.speed:1);s.elapsed+=dt;s.time=Math.min(22,s.time+dt/32);}
export function act(s,type,arg={}){
 switch(type){
 case 'plant':{const i=arg.index,c=CROPS[arg.crop];if(!Number.isInteger(i)||i<0||i>=bedCount(s)||!c)return fail('Choose an open garden bed.');if(s.beds[i])return fail('Something is already growing here.');if(!c.free&&!has(s,'seed_'+arg.crop))return fail('Pick up more seeds at the village market.');if(!effort(s,2))return fail('Time for a rest or a warm meal.');if(!c.free)take(s,'seed_'+arg.crop);s.beds[i]={crop:arg.crop,planted:s.elapsed,watered:calendar(s).rain};return ok(`${c.name} planted. ${calendar(s).rain?'The rain is watering it.':'Give it a little water.'}`);}
 case 'water':{const b=s.beds[arg.index];if(!b)return fail('Plant a seed here first.');if(b.watered)return fail('This bed has enough water.');if(!effort(s,1))return fail('Rest at home to recover energy.');b.watered=true;b.planted=s.elapsed;return ok('Watered. Good things take a little time.');}
 case 'harvest':{const b=s.beds[arg.index];if(!ripe(s,b))return fail('This crop needs a little longer.');const n=CROPS[b.crop].yield+Math.max(0,s.upgrades.farm-1);add(s,b.crop,n);s.beds[arg.index]=null;s.stats.harvests++;return ok(`Harvested ${n} ${CROPS[b.crop].name.toLowerCase()}!`);}
 case 'buySeed':{if(!CROPS[arg.id]||CROPS[arg.id].free)return fail('That seed is unavailable.');if(!pay(s,CROPS[arg.id].price*3))return fail('You need a few more coins.');add(s,'seed_'+arg.id,3);return ok(`A packet of 3 ${CROPS[arg.id].name.toLowerCase()} seeds.`);}
 case 'sell':{const ids=arg.id?[arg.id]:Object.keys(s.inventory);let total=0;for(const id of ids){const price=sellPrice(s,id,arg.country);if(price&&has(s,id)){const n=arg.one?1:s.inventory[id];total+=price*n;take(s,id,n);}}if(!total)return fail('Your basket has no produce to sell yet.');s.coins+=total;s.stats.sales+=total;return ok(`Sold with thanks. +${total} coins`);}
 case 'upgrade':{const u=UPGRADES[arg.id],level=s.upgrades[arg.id];if(!u||level>=3)return fail('This is already fully improved.');if(!pay(s,u.cost[level]))return fail('A few more harvests will get you there.');s.upgrades[arg.id]++;return ok(`${u.name} improved to tier ${level+1}!`);}
 case 'plantTree':{const i=arg.index,t=TREES[arg.id];if(!t||!Number.isInteger(i)||i<0||i>=3||s.trees[i])return fail('Choose an empty orchard spot.');if(!pay(s,t.price))return fail('Save a little more for this sapling.');s.trees[i]={kind:arg.id,day:s.day,picked:0};return ok(`${t.name} planted. First fruit in ${mornings(t.grow)}.`);}
 case 'pickTree':{const t=s.trees[arg.index];if(!t)return fail('Plant a sapling here first.');return pickFruit(s,t);}
 // A fruit tree on the spot of a village tree you cleared: any kind you like, up to plantCap(s) of them.
 case 'plantSpot':{const i=arg.index,t=TREES[arg.id];if(!t||!livingTree(i)||!s.cleared.includes(i))return fail('Clear a tree first: its spot can be planted.');if(s.planted[i])return fail('A fruit tree grows here already.');if(plantedCount(s)>=plantCap(s))return fail(`Your land holds ${plantCap(s)} planted fruit trees for now. Richer soil at the workshop makes room for more.`);if(!pay(s,t.price))return fail('Save a little more for this sapling.');s.planted[i]={kind:arg.id,day:s.day,picked:0};return ok(`${t.name} planted. First fruit in ${mornings(t.grow)}.`);}
 case 'pickSpot':{const t=s.planted[arg.index];if(!t)return fail('Plant a sapling here first.');return pickFruit(s,t);}
 // Take a fruit tree out again (a planted spot, or with {orchard:true} an orchard circle): the same work as clearing a tree.
 case 'uproot':{const i=arg.index,t=arg.orchard?s.trees[i]:s.planted[i];if(!Number.isInteger(i)||!t)return fail('No fruit tree grows here.');if(!s.settings.test&&s.coins<CHOP_COST)return fail(`Clearing a tree costs ${CHOP_COST} coins.`);if(!effort(s,2))return fail('Too tired to swing an axe. Rest first.');if(!s.settings.test)s.coins-=CHOP_COST;if(arg.orchard)s.trees[i]=null;else delete s.planted[i];add(s,'wood',2);return ok(`${TREES[t.kind].name} cleared. +2 timber. The spot is free again.`);}
 /* Casting is free (so is casting again, moving and packing away): fishing costs its energy when a fish is hooked. Too tired to hook one, you are told at the cast. Not toasted when it works: main.mjs shows the Reel button and its hint instead. */
 case 'cast':if(s.energy<3)return fail('Rest or eat before casting again.');return ok('Watch the float. Reel when it goes under!');
 case 'hook':s.energy=Math.max(0,s.energy-3);return ok('A fish is on the line!');
 case 'catch':{const pools=[['perch','carp','catfish'],['perch','carp','koi'],['carp','koi','rainbow'],['koi','rainbow','golden']];const roll=Math.max(0,Math.min(.999,Number(arg.roll)||0));const id=pools[s.upgrades.pond][Math.floor(roll*3)];add(s,id);s.stats.fish++;return ok(`A ${ITEMS[id].name.toLowerCase()}! Worth ${ITEMS[id].sell} coins.`);}
 case 'feed':if(s.fedDay===s.day)return fail('Everyone has been fed today.');if(!effort(s,3))return fail('Rest first, then feed the animals.');s.fedDay=s.day;s.stats.feeds++;return ok('Happy clucks! Fresh produce is ready in the basket.');
 case 'collect':{if(s.fedDay!==s.day)return fail('Fill the feed trough first.');if(s.collectedDay===s.day)return fail('The basket will fill again tomorrow.');s.collectedDay=s.day;const eggs=1+s.upgrades.pen;add(s,'egg',eggs);if(s.upgrades.pen>=2)add(s,'milk',s.upgrades.pen===3?2:1);return ok(`${eggs} fresh eggs${s.upgrades.pen>=2?' and milk':''}. Thank you, little farm.`);}
 case 'talk':{const p=RESIDENTS.find(p=>p.id===arg.id);if(!p)return fail('No one is here.');s.met[p.id]=true;if(s.talked[p.id]!==s.day){s.talked[p.id]=s.day;s.friendship[p.id]=Math.min(10,(s.friendship[p.id]??0)+1);}return ok(p.line);}
 case 'gift':{if(!RESIDENTS.some(p=>p.id===arg.id)||!ITEMS[arg.item]||!has(s,arg.item))return fail('Choose a gift from your basket.');if(s.gifted[arg.id]===s.day)return fail('You have already shared a gift today.');take(s,arg.item);s.met[arg.id]=true;s.gifted[arg.id]=s.day;s.friendship[arg.id]=Math.min(10,(s.friendship[arg.id]??0)+2);return ok('A thoughtful gift. Friendship +2');}
 case 'outfit':{const o=OUTFITS.find(o=>o.id===arg.id);if(!o)return fail('Outfit unavailable.');if(!s.owned.includes(o.id)){if(!pay(s,o.price))return fail('You need more coins for this outfit.');s.owned.push(o.id);}s.outfit=o.id;return ok(`${o.name}, just your style.`);}
 case 'body':return bodyAction(s,arg);
 // The mirror, the wardrobe and the little things at home (looks.mjs, gear.mjs, house-rules.mjs).
 case 'look':return lookAction(s,arg);
 case 'buyGear':return buyGear(s,arg);
 case 'equip':return equipGear(s,arg);
 case 'unequip':return unequipGear(s,arg);
 case 'houseUse':return useActivity(s,arg);
 case 'kidOutfit':{const o=KID_OUTFITS.find(o=>o.id===arg.id);if(!o)return fail('Outfit unavailable.');if(!s.kidOwned.includes(o.id)){if(!pay(s,o.price))return fail('Save a little more for Pip’s outfit.');s.kidOwned.push(o.id);}s.kidOutfit=o.id;return ok(`Pip loves the ${o.name.toLowerCase()}!`);}
 case 'furniture':{const f=FURNITURE.find(f=>f.id===arg.id);if(!f||s.furniture.includes(f.id))return fail('This is already at home.');if(!pay(s,f.price))return fail('Save a little more for this piece.');s.furniture.push(f.id);return ok(`${f.name} delivered to your living room.`);}
 case 'cook':{const r=RECIPES[arg.id];if(!r||s.upgrades.kitchen<r.level)return fail('Improve your kitchen to learn this recipe.');if(!Object.entries(r.needs).every(([id,n])=>has(s,id,n)))return fail('Gather all the ingredients first.');for(const [id,n]of Object.entries(r.needs))take(s,id,n);add(s,arg.id);s.stats.cooked++;return ok(`${r.name} is ready. Made with love.`);}
 case 'eat':{if(!has(s,arg.id)||!ITEMS[arg.id]?.energy)return fail('Choose a cooked meal.');if(s.energy>=100&&!canHeal(s))return fail('You are already full of energy.');take(s,arg.id);s.energy=Math.min(100,s.energy+ITEMS[arg.id].energy);const healed=foodHeal(s,ITEMS[arg.id].energy);return ok(healed?`A good meal makes all the difference. +${Math.round(healed)} health`:'A good meal makes all the difference.');}
 case 'festival':{if(!calendar(s).festival)return fail(`Harvest supper is in ${3-s.day%3} day(s).`);if(s.festivalDay===s.day)return fail('You have shared a dish at this supper already.');if(!RECIPES[arg.id]||!has(s,arg.id))return fail('Bring a dish you have cooked.');take(s,arg.id);s.festivalDay=s.day;s.stats.festivals++;const prize=ITEMS[arg.id].sell*2+50;s.coins+=prize;return ok(`The village loved it! Harvest supper prize: ${prize} coins.`);}
 case 'bike':if(s.bike)return fail('The motorcycle is already yours.');if(!pay(s,350))return fail('The motorcycle costs 350 coins.');s.bike=true;return ok('Your very own motorcycle! Find it beside the Bell garage.');
 case 'trip':s.stats.trips++;return ok('Willowmere Supermarket · the hillside traders pay 25% more for your produce here.');
 case 'gather':{if(!['mushroom','wood'].includes(arg.id)||typeof arg.spot!=='string')return fail('Nothing to gather here.');if(s.gathered[arg.spot]===s.day)return fail('Let this patch recover until tomorrow.');if(!effort(s,2))return fail('Take a rest before gathering.');s.gathered[arg.spot]=s.day;add(s,arg.id,2);return ok(`Found 2 ${ITEMS[arg.id].name.toLowerCase()}.`);}
 case 'hunt':if(s.huntDay===s.day)return fail('You have gathered enough from the woodland today.');if(!effort(s,8))return fail('Rest before following the woodland trail.');s.huntDay=s.day;add(s,'game',2);return ok('A successful woodland trip. Two portions for the market.');
 case 'race':if(s.raceDay===s.day)return fail('Today’s running prize is already yours. Try again tomorrow.');if(!Number.isFinite(arg.seconds)||arg.seconds<=0||arg.seconds>60)return fail('Finish the three checkpoints in under a minute.');s.raceDay=s.day;s.stats.races++;s.coins+=90;return ok(`A lovely run: ${arg.seconds.toFixed(1)}s! Village prize +90 coins.`);
 case 'civic':{const c=CIVIC_ACTS[arg.id];if(!c)return fail('That building is closed.');if(s.civicDay[arg.id]===s.day)return fail(c.done);if(c.cost&&s.coins<c.cost)return fail(`You need ${c.cost} coins.`);if(c.energy&&!effort(s,c.energy))return fail('You are too tired. Rest first.');if(arg.id==='hospital'&&s.energy>=100)return fail('Dr Linden says you are perfectly healthy today.');s.coins-=c.cost??0;s.civicDay[arg.id]=s.day;s.stats[c.stat]++;
      if(arg.id==='hospital')s.energy=100;
   if(c.pay){s.coins+=c.pay;s.time=Math.min(22,s.time+(c.hours??0));}
   return ok(c.message);}
 case 'plot':{if(bedCount(s)>=MAX_BEDS)return fail('Your fields reach the fence line already.');const cost=plotCost(s);if(!pay(s,cost))return fail(`Two new beds cost ${cost} coins.`);s.plots++;return ok(`The family turns two more beds of soil. ${bedCount(s)} beds now.`);}
 case 'chop':{const i=arg.index;if(!livingTree(i)||s.cleared.includes(i))return fail('Nothing to clear here.');if(!s.settings.test&&s.coins<CHOP_COST)return fail(`Clearing a tree costs ${CHOP_COST} coins.`);if(!effort(s,2))return fail('Too tired to swing an axe. Rest first.');if(!s.settings.test)s.coins-=CHOP_COST;s.cleared.push(i);s.stats.chops++;add(s,'wood',2);return ok(`Tree cleared for ${s.settings.test?0:CHOP_COST} coins. +2 timber.`);}
 case 'lesson':{if(!SUBJECTS[arg.id])return fail('Choose a subject.');s.quiz=makeQuestion(arg.id);return ok(`${SUBJECTS[arg.id].name}: let’s begin!`);}
 case 'answer':{const q=s.quiz;if(!q)return fail('Choose a subject to start a lesson.');if(String(arg.given)!==String(q.answer)){q.wrong=(q.wrong??0)+1;return fail('Not quite. Have another look!');}
   if(s.learnDay!==s.day){s.learnDay=s.day;s.learnCount=0;}const paid=s.learnCount<LESSON_CAP||s.settings.test;const coins=paid?SUBJECTS[q.subject].pay+(q.wrong?0:2):0;s.coins+=coins;if(paid)s.learnCount++;s.stats.answers++;s.learned[q.subject]=(s.learned[q.subject]??0)+1;
   if(s.friendship.pip!==undefined&&s.stats.answers%5===0)s.friendship.pip=Math.min(10,s.friendship.pip+1);
   s.quiz=makeQuestion(q.subject);return ok(paid?`Correct! +${coins} coins`:'Correct! Today’s lesson coins are all earned, but learning is its own reward.');}
 case 'hire':{const p=RESIDENTS.find(p=>p.id===arg.id),j=JOBS[arg.job];if(!p||p.home<=0||p.child||!j)return fail('This neighbour cannot take that job.');if(!s.met[p.id])return fail(`Say hello to ${p.name} first.`);if(s.hired[p.id])return fail(`${p.name} already works for the family.`);if(!pay(s,j.wage))return fail(`${p.name} asks for ${j.wage} coins up front.`);s.hired[p.id]=arg.job;s.friendship[p.id]=Math.min(10,(s.friendship[p.id]??0)+1);return ok(`${p.name} will work as your ${j.name.toLowerCase()}. Wages of ${j.wage} coins are paid each morning.`);}
 case 'release':{const p=RESIDENTS.find(p=>p.id===arg.id);if(!p||!s.hired[p.id])return fail('They are not working for you.');delete s.hired[p.id];return ok(`${p.name} thanks you for the work.`);}
 case 'testMode':{if(String(arg.key??'').trim()!==TEST_KEY)return fail('That key is not recognised.');s.settings.test=true;s.coins+=100000;return ok('Test mode on: +100,000 coins, instant crops and fruit, free tree clearing, speed controls.');}
 case 'testSpeed':{if(!s.settings.test)return fail('Unlock test mode first.');const v=Number(arg.id);if(![1,5,20].includes(v))return fail('Choose 1×, 5× or 20×.');s.settings.speed=v;return ok(`Game speed ${v}×.`);}
 case 'testCoins':if(!s.settings.test)return fail('Unlock test mode first.');s.coins+=10000;return ok('+10,000 test coins.');
 case 'testOff':s.settings.test=false;s.settings.speed=1;return ok('Test mode off.');
 case 'claim':{if(!chapterReady(s))return fail('A little more of this chapter is still to be lived.');const c=currentChapter(s);s.coins+=c.reward;s.chapter++;return ok(c.memory);}
 case 'sleep':{s.day++;s.time=7;s.energy=100;s.elapsed+=180;if(calendar(s).rain)for(const b of s.beds)if(b&&!b.watered){b.watered=true;b.planted=s.elapsed;}const work=payWorkers(s);return ok(`Good morning. ${calendar(s).season} ${calendar(s).day}${calendar(s).festival?' · Harvest supper today!':''}${work}`);}
 case 'rest':s.energy=Math.min(100,s.energy+25);s.time=Math.min(22,s.time+1);return ok('A quiet moment. +25 energy');
 // Decorating your home (home-plan.mjs): state.decor is null (the default arrangement) or [{id,x,z,rot}].
 case 'placeDecor':return placeDecor(s,arg);
 case 'rotateDecor':return rotateDecor(s,arg);
 case 'removeDecor':return removeDecor(s,arg);
 // The Pandora box (pandora.mjs): open or shut it, a creature's coins, picked-up loot and a gentle knock-out.
 case 'pandora':case 'defeat':case 'pickup':case 'knockout':return pandoraAct(s,type,arg);
 // Rescued friends (friends.mjs): freeing one from an open cage, and a friend reaching the village.
 case 'rescue':case 'friendHome':return friendsAct(s,type,arg);
 default:return UNKNOWN;
 }
}
const number=(v,d,max=1e9)=>typeof v==='number'&&Number.isFinite(v)?Math.max(0,Math.min(max,v)):d;
const int=(v,d,max=1e9)=>Math.floor(number(v,d,max));
export function parseSave(raw){
 if(!raw||raw.version!==1||typeof raw!=='object')throw new Error('This is not a Willowmere save.');
 const s=freshState();s.day=Math.max(1,int(raw.day,1,99999));s.time=Math.max(7,number(raw.time,8,22));s.elapsed=number(raw.elapsed,0);s.coins=int(raw.coins,160);s.energy=number(raw.energy,100,100);s.chapter=int(raw.chapter,0,CHAPTERS.length);s.started=!!raw.started;
 for(const k of Object.keys(s.upgrades))s.upgrades[k]=int(raw.upgrades?.[k],0,3);
 for(const k of Object.keys(s.stats))s.stats[k]=int(raw.stats?.[k],0);
 s.inventory={};for(const [k,v]of Object.entries(raw.inventory??{})){if(ITEMS[k]||(k.startsWith('seed_')&&CROPS[k.slice(5)])){const n=int(v,0,99999);if(n)s.inventory[k]=n;}}
 s.plots=int(raw.plots,raw.plots===undefined?int(raw.upgrades?.farm,0,3)*3:0,12);
 s.beds=s.beds.map((_,i)=>{const b=raw.beds?.[i];return i<bedCount(s)&&b&&CROPS[b.crop]?{crop:b.crop,planted:number(b.planted,s.elapsed,s.elapsed),watered:!!b.watered}:null;});
 s.trees=s.trees.map((_,i)=>{const t=raw.trees?.[i];return t&&TREES[t.kind]?{kind:t.kind,day:Math.max(1,int(t.day,s.day,s.day)),picked:int(t.picked,0,s.day)}:null;});
 const own=(data,valid)=>Array.isArray(data)?[...new Set(data.filter(id=>valid.some(o=>o.id===id)))]:[];
 s.owned=[...new Set(['meadow',...own(raw.owned,OUTFITS)])];s.outfit=s.owned.includes(raw.outfit)?raw.outfit:'meadow';s.body=raw.body==='boy'?'boy':'girl';
 s.kidOwned=own(raw.kidOwned,KID_OUTFITS);s.kidOutfit=s.kidOwned.includes(raw.kidOutfit)?raw.kidOutfit:'';s.furniture=own(raw.furniture,FURNITURE);s.bike=!!raw.bike;
 for(const p of RESIDENTS){if(raw.met?.[p.id])s.met[p.id]=true;s.friendship[p.id]=int(raw.friendship?.[p.id],0,10);s.talked[p.id]=int(raw.talked?.[p.id],0,s.day);s.gifted[p.id]=int(raw.gifted?.[p.id],0,s.day);}
 for(const k of Object.keys(s.civicDay))s.civicDay[k]=int(raw.civicDay?.[k],0,s.day);
 for(const k of ['fedDay','collectedDay','festivalDay','raceDay','huntDay'])s[k]=int(raw[k],0,s.day);
 for(const [k,v]of Object.entries(raw.gathered??{}).slice(0,100))if(/^(mushroom|wood)-\d+$/.test(k))s.gathered[k]=int(v,0,s.day);
 const x=raw.position?.x,z=raw.position?.z,placed=typeof x==='number'&&Number.isFinite(x)&&typeof z==='number'&&Number.isFinite(z);
 s.position=placed?{x,z}:{...HOME_SPOT};
 // A save made on the way to the old country market stands out on the gate's spur: it wakes on the ring road just inside the east gate (GATE.back), within the ward.
 if(s.position.x>58&&s.position.x<68&&Math.abs(s.position.z)<4.5)s.position={x:GATE.back.x,z:GATE.back.z};
 s.settings={quality:['high','balanced','battery'].includes(raw.settings?.quality)?raw.settings.quality:'balanced',sound:raw.settings?.sound!==false,light:raw.settings?.light==='cycle'?'cycle':'day',test:raw.settings?.test===true,speed:[1,5,20].includes(raw.settings?.speed)?raw.settings.speed:1};
 s.cleared=Array.isArray(raw.cleared)?[...new Set(raw.cleared.filter(i=>Number.isInteger(i)&&i>=0&&i<1000))]:[];
 // Planted fruit trees: only on the spot of a cleared tree that stands in today's village, up to the cap. One whose spot is gone
 // (a building stands there now) or over the cap is paid back at the sapling's price. A save without the field has none.
 for(const [k,t]of Object.entries(raw.planted&&typeof raw.planted==='object'?raw.planted:{}).slice(0,400)){const i=Number(k),kind=TREES[t?.kind];if(!kind||!Number.isInteger(i)||!s.cleared.includes(i)||!villageTrees()[i]||s.planted[i])continue;if(!livingTree(i)||plantedCount(s)>=plantCap(s)){s.coins+=kind.price;continue;}s.planted[i]={kind:t.kind,day:Math.max(1,int(t.day,s.day,s.day)),picked:int(t.picked,0,s.day)};}
 for(const [id,job] of Object.entries(raw.hired??{}))if(JOBS[job]&&RESIDENTS.some(p=>p.id===id&&p.home>0&&!p.child))s.hired[id]=job;
 s.pandora=raw.pandora===true;s.hp=number(raw.hp,100,99999);
 // Round 8 (spec 7.3): where each vehicle was left (null: at its park spot), the one you are riding, its heading, and the kinds beaten once.
 // The world has an edge now: a vehicle's spot must be in it, two metres clear of the edge, as nobody stands nearer than that (regions.mjs EDGE_PAD).
 const spot=v=>v&&typeof v==='object'&&[v.x,v.z,v.rot].every(Number.isFinite)&&inWorld(v.x,v.z,2)?{x:v.x,z:v.z,rot:v.rot}:null;
 s.vehicles={jeep:spot(raw.vehicles?.jeep),bike:spot(raw.vehicles?.bike)};
 s.riding=raw.riding==='jeep'||raw.riding==='bike'?raw.riding:'';
 if(s.riding==='bike'&&!s.bike||s.riding==='jeep'&&s.stats.sales<JEEP_SALES)s.riding='';
 s.heading=typeof raw.heading==='number'&&Number.isFinite(raw.heading)?raw.heading:0;
 // A place that cannot be kept: outside the world (the old endless fields, an empty cell, a broken value), or outside the ward in a save
 // that has no `vehicles` field (a player the lost-car bug left out there on foot). It wakes in the homestead's yard with every car parked.
 if(!placed||!inWorld(s.position.x,s.position.z,2)||raw.vehicles===undefined&&!inSafeZone(s.position.x,s.position.z)){s.position={...HOME_SPOT};s.vehicles={jeep:null,bike:null};s.riding='';s.heading=0;}
 s.defeated={};for(const [k,v]of Object.entries(raw.defeated&&typeof raw.defeated==='object'?raw.defeated:{}).slice(0,DEFEATED_MAX))if(v===true&&/^[a-z_]{2,24}$/.test(k))s.defeated[k]=true;
 s.friends=parseFriends(raw.friends);
 for(const k of Object.keys(SUBJECTS))if(raw.learned?.[k])s.learned[k]=int(raw.learned[k],0);s.learnDay=int(raw.learnDay,0,s.day);s.learnCount=int(raw.learnCount,0,LESSON_CAP);s.decor=parseDecor(raw.decor,s,raw.plan);
 Object.assign(s,parseLook(raw),parseGear(raw));s.house=parseHouse(raw.house,s);s.found=parseFound(raw.found,s);
 // A save from before `defeated` was kept: only the King Bear ever dropped the Bear hat and the Royal crown, so owning either proves he was beaten.
 if(raw.defeated===undefined&&(s.gearOwned.includes('hat_bear')||s.gearOwned.includes('crown')))s.defeated.bear=true;
 return s;
}
export function load(storage){try{const raw=storage.getItem(SAVE_KEY);return {state:raw?parseSave(JSON.parse(raw)):freshState(),error:null};}catch{return {state:freshState(),error:'Your saved game could not be read. A fresh session is available; export it before closing if storage is unavailable.'};}}
export function save(s,storage){try{storage.setItem(SAVE_KEY,JSON.stringify(s));return true;}catch{return false;}}
