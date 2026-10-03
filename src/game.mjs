import {OUTDOOR_LIMIT} from './field-layout.mjs';
import { CROPS,ITEMS,TREES,OUTFITS,KID_OUTFITS,FURNITURE,UPGRADES,RECIPES,RESIDENTS,CHAPTERS,SEASONS } from './content.mjs';
export const SAVE_KEY='willowmere.save.v1';
export const freshState=()=>({version:1,day:1,time:8,elapsed:0,coins:160,energy:100,chapter:0,inventory:{'seed_carrot':6,'seed_radish':3,'seed_pumpkin':2},beds:Array(24).fill(null),trees:Array(3).fill(null),upgrades:{farm:0,pond:0,pen:0,house:0,kitchen:0},owned:['meadow'],outfit:'meadow',body:'girl',kidOwned:[],kidOutfit:'',furniture:[],met:{},friendship:{},talked:{},gifted:{},stats:{harvests:0,fish:0,sales:0,feeds:0,trips:0,cooked:0,festivals:0,races:0,lessons:0,checkups:0,patrols:0,shifts:0},civicDay:{school:0,hospital:0,police:0,company:0},fedDay:0,collectedDay:0,festivalDay:0,raceDay:0,huntDay:0,gathered:{},bike:false,position:{x:-15,z:0},settings:{quality:'balanced',sound:true},started:false});
export const calendar=s=>({season:SEASONS[Math.floor((s.day-1)/7)%4],day:(s.day-1)%7+1,year:Math.floor((s.day-1)/28)+1,festival:s.day%3===0,rain:s.day%5===0});
export const bedCount=s=>6+s.upgrades.farm*6;
export const ripe=(s,b)=>!!b&&b.watered&&s.elapsed-b.planted>=CROPS[b.crop].grow;
export const cropProgress=(s,b)=>b?(b.watered?Math.min(1,(s.elapsed-b.planted)/CROPS[b.crop].grow):0):0;
export const currentChapter=s=>CHAPTERS[s.chapter];
export const chapterReady=s=>!!currentChapter(s)&&currentChapter(s).goals.every(([,check])=>check(s));
export const itemName=id=>id.startsWith('seed_')?`${CROPS[id.slice(5)]?.name??'Unknown'} seeds`:ITEMS[id]?.name??id;
export const sellPrice=(s,id,country=false)=>Math.floor((ITEMS[id]?.sell??0)*(country?1.25:1)*(RECIPES[id]&&s.upgrades.kitchen===3?1.25:1));
const add=(s,id,n=1)=>s.inventory[id]=(s.inventory[id]??0)+n;
const has=(s,id,n=1)=>(s.inventory[id]??0)>=n;
const take=(s,id,n=1)=>{s.inventory[id]-=n;if(s.inventory[id]<=0)delete s.inventory[id];};
const ok=message=>({ok:true,message}), fail=message=>({ok:false,message});
function pay(s,amount){if(!Number.isFinite(amount)||s.coins<amount)return false;s.coins-=amount;return true;}
function effort(s,amount){if(s.energy<amount)return false;s.energy-=amount;return true;}
export const CIVIC_ACTS={
 school:{title:'Pip’s lesson',cost:20,stat:'lessons',done:'Pip has already had today’s lesson.',message:'Pip learned to count seeds and read the clock! Family friendship +1'},
 hospital:{title:'Check-up',cost:30,stat:'checkups',done:'One check-up a day is plenty.',message:'A warm check-up and a ginger tea. Energy fully restored!'},
 police:{title:'Village patrol',energy:6,pay:40,hours:1,stat:'patrols',done:'The village is safe for today. Thank you!',message:'You helped Officer Reed find a lost goat. Reward +40 coins'},
 company:{title:'Office shift',energy:15,pay:75,hours:3,stat:'shifts',done:'Your shift is done for today.',message:'Three hours packing produce orders at Willow & Co. Wage +75 coins'},
};
export function tick(s,dt){dt=Math.max(0,Math.min(dt,.25));s.elapsed+=dt;s.time=Math.min(22,s.time+dt/32);}
export function act(s,type,arg={}){
 switch(type){
 case 'plant':{const i=arg.index,c=CROPS[arg.crop];if(!Number.isInteger(i)||i<0||i>=bedCount(s)||!c)return fail('Choose an open garden bed.');if(s.beds[i])return fail('Something is already growing here.');if(!has(s,'seed_'+arg.crop))return fail('Pick up more seeds at the village market.');if(!effort(s,2))return fail('Time for a rest or a warm meal.');take(s,'seed_'+arg.crop);s.beds[i]={crop:arg.crop,planted:s.elapsed,watered:calendar(s).rain};return ok(`${c.name} planted. ${calendar(s).rain?'The rain is watering it.':'Give it a little water.'}`);}
 case 'water':{const b=s.beds[arg.index];if(!b)return fail('Plant a seed here first.');if(b.watered)return fail('This bed has enough water.');if(!effort(s,1))return fail('Rest at home to recover energy.');b.watered=true;b.planted=s.elapsed;return ok('Watered. Good things take a little time.');}
 case 'harvest':{const b=s.beds[arg.index];if(!ripe(s,b))return fail('This crop needs a little longer.');const n=CROPS[b.crop].yield+Math.max(0,s.upgrades.farm-1);add(s,b.crop,n);s.beds[arg.index]=null;s.stats.harvests++;return ok(`Harvested ${n} ${CROPS[b.crop].name.toLowerCase()}!`);}
 case 'buySeed':{if(!CROPS[arg.id])return fail('That seed is unavailable.');if(!pay(s,CROPS[arg.id].price*3))return fail('You need a few more coins.');add(s,'seed_'+arg.id,3);return ok(`A packet of 3 ${CROPS[arg.id].name.toLowerCase()} seeds.`);}
 case 'sell':{const ids=arg.id?[arg.id]:Object.keys(s.inventory);let total=0;for(const id of ids){const price=sellPrice(s,id,arg.country);if(price&&has(s,id)){const n=arg.one?1:s.inventory[id];total+=price*n;take(s,id,n);}}if(!total)return fail('Your basket has no produce to sell yet.');s.coins+=total;s.stats.sales+=total;return ok(`Sold with thanks. +${total} coins`);}
 case 'upgrade':{const u=UPGRADES[arg.id],level=s.upgrades[arg.id];if(!u||level>=3)return fail('This is already fully improved.');if(!pay(s,u.cost[level]))return fail('A few more harvests will get you there.');s.upgrades[arg.id]++;return ok(`${u.name} improved to tier ${level+1}!`);}
 case 'plantTree':{const i=arg.index,t=TREES[arg.id];if(!t||!Number.isInteger(i)||i<0||i>=3||s.trees[i])return fail('Choose an empty orchard spot.');if(!pay(s,t.price))return fail('Save a little more for this sapling.');s.trees[i]={kind:arg.id,day:s.day,picked:0};return ok(`${t.name} planted. First fruit in two mornings.`);}
 case 'pickTree':{const t=s.trees[arg.index];if(!t)return fail('Plant a sapling here first.');if(s.day-t.day<2)return fail(`A young tree. Fruit in ${2-(s.day-t.day)} morning(s).`);if(t.picked===s.day)return fail('Come back tomorrow for more fruit.');add(s,t.kind,3);t.picked=s.day;return ok(`Three fresh ${ITEMS[t.kind].name.toLowerCase()}s, straight from the tree.`);}
 case 'cast':if(!effort(s,3))return fail('Rest or eat before casting again.');return ok('Watch the float. Reel when the marker reaches green!');
 case 'catch':{const pools=[['perch','carp','catfish'],['perch','carp','koi'],['carp','koi','rainbow'],['koi','rainbow','golden']];const roll=Math.max(0,Math.min(.999,Number(arg.roll)||0));const id=pools[s.upgrades.pond][Math.floor(roll*3)];add(s,id);s.stats.fish++;return ok(`A ${ITEMS[id].name.toLowerCase()}! Worth ${ITEMS[id].sell} coins.`);}
 case 'feed':if(s.fedDay===s.day)return fail('Everyone has been fed today.');if(!effort(s,3))return fail('Rest first, then feed the animals.');s.fedDay=s.day;s.stats.feeds++;return ok('Happy clucks! Fresh produce is ready in the basket.');
 case 'collect':{if(s.fedDay!==s.day)return fail('Fill the feed trough first.');if(s.collectedDay===s.day)return fail('The basket will fill again tomorrow.');s.collectedDay=s.day;const eggs=1+s.upgrades.pen;add(s,'egg',eggs);if(s.upgrades.pen>=2)add(s,'milk',s.upgrades.pen===3?2:1);return ok(`${eggs} fresh eggs${s.upgrades.pen>=2?' and milk':''}. Thank you, little farm.`);}
 case 'talk':{const p=RESIDENTS.find(p=>p.id===arg.id);if(!p)return fail('No one is here.');s.met[p.id]=true;if(s.talked[p.id]!==s.day){s.talked[p.id]=s.day;s.friendship[p.id]=Math.min(10,(s.friendship[p.id]??0)+1);}return ok(p.line);}
 case 'gift':{if(!RESIDENTS.some(p=>p.id===arg.id)||!ITEMS[arg.item]||!has(s,arg.item))return fail('Choose a gift from your basket.');if(s.gifted[arg.id]===s.day)return fail('You have already shared a gift today.');take(s,arg.item);s.met[arg.id]=true;s.gifted[arg.id]=s.day;s.friendship[arg.id]=Math.min(10,(s.friendship[arg.id]??0)+2);return ok('A thoughtful gift. Friendship +2');}
 case 'outfit':{const o=OUTFITS.find(o=>o.id===arg.id);if(!o)return fail('Outfit unavailable.');if(!s.owned.includes(o.id)){if(!pay(s,o.price))return fail('You need more coins for this outfit.');s.owned.push(o.id);}s.outfit=o.id;return ok(`${o.name}, just your style.`);}
 case 'body':if(!['girl','boy'].includes(arg.id))return fail('Choose a character style.');s.body=arg.id;return ok('A fresh look.');
 case 'kidOutfit':{const o=KID_OUTFITS.find(o=>o.id===arg.id);if(!o)return fail('Outfit unavailable.');if(!s.kidOwned.includes(o.id)){if(!pay(s,o.price))return fail('Save a little more for Pip’s outfit.');s.kidOwned.push(o.id);}s.kidOutfit=o.id;return ok(`Pip loves the ${o.name.toLowerCase()}!`);}
 case 'furniture':{const f=FURNITURE.find(f=>f.id===arg.id);if(!f||s.furniture.includes(f.id))return fail('This is already at home.');if(!pay(s,f.price))return fail('Save a little more for this piece.');s.furniture.push(f.id);return ok(`${f.name} delivered to your living room.`);}
 case 'cook':{const r=RECIPES[arg.id];if(!r||s.upgrades.kitchen<r.level)return fail('Improve your kitchen to learn this recipe.');if(!Object.entries(r.needs).every(([id,n])=>has(s,id,n)))return fail('Gather all the ingredients first.');for(const [id,n]of Object.entries(r.needs))take(s,id,n);add(s,arg.id);s.stats.cooked++;return ok(`${r.name} is ready. Made with love.`);}
 case 'eat':{if(!has(s,arg.id)||!ITEMS[arg.id]?.energy)return fail('Choose a cooked meal.');if(s.energy>=100)return fail('You are already full of energy.');take(s,arg.id);s.energy=Math.min(100,s.energy+ITEMS[arg.id].energy);return ok('A good meal makes all the difference.');}
 case 'festival':{if(!calendar(s).festival)return fail(`Harvest supper is in ${3-s.day%3} day(s).`);if(s.festivalDay===s.day)return fail('You have shared a dish at this supper already.');if(!RECIPES[arg.id]||!has(s,arg.id))return fail('Bring a dish you have cooked.');take(s,arg.id);s.festivalDay=s.day;s.stats.festivals++;const prize=ITEMS[arg.id].sell*2+50;s.coins+=prize;return ok(`The village loved it! Harvest supper prize: ${prize} coins.`);}
 case 'bike':if(s.bike)return fail('The motorcycle is already yours.');if(!pay(s,350))return fail('The motorcycle costs 350 coins.');s.bike=true;return ok('Your very own motorcycle! Find it beside the Bell garage.');
 case 'trip':s.stats.trips++;return ok('Country market · produce sells for 25% more here.');
 case 'gather':{if(!['mushroom','wood'].includes(arg.id)||typeof arg.spot!=='string')return fail('Nothing to gather here.');if(s.gathered[arg.spot]===s.day)return fail('Let this patch recover until tomorrow.');if(!effort(s,2))return fail('Take a rest before gathering.');s.gathered[arg.spot]=s.day;add(s,arg.id,2);return ok(`Found 2 ${ITEMS[arg.id].name.toLowerCase()}.`);}
 case 'hunt':if(s.huntDay===s.day)return fail('You have gathered enough from the woodland today.');if(!effort(s,8))return fail('Rest before following the woodland trail.');s.huntDay=s.day;add(s,'game',2);return ok('A successful woodland trip. Two portions for the market.');
 case 'race':if(s.raceDay===s.day)return fail('Today’s running prize is already yours. Try again tomorrow.');if(!Number.isFinite(arg.seconds)||arg.seconds<=0||arg.seconds>60)return fail('Finish the three checkpoints in under a minute.');s.raceDay=s.day;s.stats.races++;s.coins+=90;return ok(`A lovely run: ${arg.seconds.toFixed(1)}s! Village prize +90 coins.`);
 case 'civic':{const c=CIVIC_ACTS[arg.id];if(!c)return fail('That building is closed.');if(s.civicDay[arg.id]===s.day)return fail(c.done);if(c.cost&&s.coins<c.cost)return fail(`You need ${c.cost} coins.`);if(c.energy&&!effort(s,c.energy))return fail('You are too tired. Rest first.');if(arg.id==='hospital'&&s.energy>=100)return fail('Dr Linden says you are perfectly healthy today.');s.coins-=c.cost??0;s.civicDay[arg.id]=s.day;s.stats[c.stat]++;
   if(arg.id==='school'){for(const id of ['pip','june'])if(s.friendship[id]!==undefined)s.friendship[id]=Math.min(10,s.friendship[id]+1);}
   if(arg.id==='hospital')s.energy=100;
   if(c.pay){s.coins+=c.pay;s.time=Math.min(22,s.time+(c.hours??0));}
   return ok(c.message);}
 case 'claim':{if(!chapterReady(s))return fail('A little more of this chapter is still to be lived.');const c=currentChapter(s);s.coins+=c.reward;s.chapter++;return ok(c.memory);}
 case 'sleep':{s.day++;s.time=7;s.energy=100;s.elapsed+=180;if(calendar(s).rain)for(const b of s.beds)if(b&&!b.watered){b.watered=true;b.planted=s.elapsed;}return ok(`Good morning. ${calendar(s).season} ${calendar(s).day}${calendar(s).festival?' · Harvest supper today!':''}`);}
 case 'rest':s.energy=Math.min(100,s.energy+25);s.time=Math.min(22,s.time+1);return ok('A quiet moment. +25 energy');
 default:return fail('That action is not available.');
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
 s.beds=s.beds.map((_,i)=>{const b=raw.beds?.[i];return i<bedCount(s)&&b&&CROPS[b.crop]?{crop:b.crop,planted:number(b.planted,s.elapsed,s.elapsed),watered:!!b.watered}:null;});
 s.trees=s.trees.map((_,i)=>{const t=raw.trees?.[i];return t&&TREES[t.kind]?{kind:t.kind,day:Math.max(1,int(t.day,s.day,s.day)),picked:int(t.picked,0,s.day)}:null;});
 const own=(data,valid)=>Array.isArray(data)?[...new Set(data.filter(id=>valid.some(o=>o.id===id)))]:[];
 s.owned=[...new Set(['meadow',...own(raw.owned,OUTFITS)])];s.outfit=s.owned.includes(raw.outfit)?raw.outfit:'meadow';s.body=raw.body==='boy'?'boy':'girl';
 s.kidOwned=own(raw.kidOwned,KID_OUTFITS);s.kidOutfit=s.kidOwned.includes(raw.kidOutfit)?raw.kidOutfit:'';s.furniture=own(raw.furniture,FURNITURE);s.bike=!!raw.bike;
 for(const p of RESIDENTS){if(raw.met?.[p.id])s.met[p.id]=true;s.friendship[p.id]=int(raw.friendship?.[p.id],0,10);s.talked[p.id]=int(raw.talked?.[p.id],0,s.day);s.gifted[p.id]=int(raw.gifted?.[p.id],0,s.day);}
 for(const k of Object.keys(s.civicDay))s.civicDay[k]=int(raw.civicDay?.[k],0,s.day);
 for(const k of ['fedDay','collectedDay','festivalDay','raceDay','huntDay'])s[k]=int(raw[k],0,s.day);
 for(const [k,v]of Object.entries(raw.gathered??{}).slice(0,100))if(/^(mushroom|wood)-\d+$/.test(k))s.gathered[k]=int(v,0,s.day);
 const x=raw.position?.x,z=raw.position?.z;s.position={x:typeof x==='number'&&Number.isFinite(x)?Math.max(-OUTDOOR_LIMIT,Math.min(OUTDOOR_LIMIT,x)):-15,z:typeof z==='number'&&Number.isFinite(z)?Math.max(-OUTDOOR_LIMIT,Math.min(OUTDOOR_LIMIT,z)):0};
 s.settings={quality:['high','balanced','battery'].includes(raw.settings?.quality)?raw.settings.quality:'balanced',sound:raw.settings?.sound!==false};return s;
}
export function load(storage){try{const raw=storage.getItem(SAVE_KEY);return {state:raw?parseSave(JSON.parse(raw)):freshState(),error:null};}catch{return {state:freshState(),error:'Your saved game could not be read. A fresh session is available; export it before closing if storage is unavailable.'};}}
export function save(s,storage){try{storage.setItem(SAVE_KEY,JSON.stringify(s));return true;}catch{return false;}}
