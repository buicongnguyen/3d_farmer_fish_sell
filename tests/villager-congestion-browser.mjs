// GAME_URL=http://127.0.0.1:4591 GPU=1 node tests/villager-congestion-browser.mjs
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {launch,open} from './travel-kit.mjs';
const out='test-results/villager-congestion';await mkdir(out,{recursive:true});
const browser=await launch(),samples=[];
try{
 const {page,context,errors}=await open(browser,'phone',s=>{s.position={x:5.5,z:32};s.time=12;},{quality:'battery'});
 try{
  await page.waitForFunction(()=>typeof willowmere.villagers==='function');
  const first=await page.evaluate(()=>willowmere.villagers());
  const shoppers=first.npcs.filter(n=>n.place==='market'&&!n.inside);
  assert.ok(shoppers.length>=5,'start with at least five midday shoppers');
  await page.screenshot({path:`${out}/start.png`});
  for(let i=0;i<150;i++){
   await page.waitForTimeout(1000);samples.push(await page.evaluate(()=>willowmere.villagers()));
   if(samples.length>=30){
    const recent=samples.slice(-30);
    for(const n of recent[0].npcs){
     const positions=recent.map(s=>s.npcs.find(p=>p.id===n.id));
     if(positions.every(p=>p.remaining&&!p.inside))assert.ok(positions.some(p=>Math.hypot(p.x-n.x,p.z-n.z)>1.5),`${n.id} must make progress during a 30-second walking window`);
    }
   }
  }
  const departed=shoppers.filter(n=>samples.some(s=>{const p=s.npcs.find(p=>p.id===n.id);return p.inside||Math.hypot(p.x-n.x,p.z-n.z)>4;}));
  assert.ok(departed.length>=3,'shoppers continue their routines');
  assert.deepEqual(errors,[]);
  await page.screenshot({path:`${out}/later.png`});
  console.log(JSON.stringify({seconds:150,shoppers:shoppers.map(n=>n.id),departed:departed.map(n=>n.id),giveWaySamples:samples.filter(s=>s.npcs.some(n=>n.givingWay)).length,greetings:samples.at(-1).greetings}));
 }finally{await writeFile(`${out}/samples.json`,JSON.stringify(samples));await context.close();}
}finally{await browser.close();}
