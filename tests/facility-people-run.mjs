// Who is inside the Town Square buildings, hour by hour (a quick scripted look, not a suite): each case seeds a save, loads the game,
// enters every building and lists the people there. GAME_URL=http://127.0.0.1:4811 GPU=1 node tests/facility-people-run.mjs [label]
import {chromium} from 'file:///C:/Users/n/source/repos/3D_claudeopus55/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
import {freshState,SAVE_KEY} from '../src/game.mjs';
const base=process.env.GAME_URL??'http://127.0.0.1:4811',label=process.argv[2]??'run',out=process.env.EVIDENCE??'C:/Users/n/source/repos/cute_game-notes/willowmere/evidence-facility-talk';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']});
const IDS=(process.env.IDS??'school,hospital,police').split(','),TIMES=(process.env.TIMES??'8,10,12.5,15,18,21').split(',').map(Number);
const CASES=[['day 1 (spring), box shut',{day:1}],['day 3 (festival), box open',{day:3,pandora:true}],['day 10 (summer, rain), Hazel+Theo+Cora hired',{day:10,hired:{hazel:'farmhand',theo:'fisher',cora:'gardener'},met:{hazel:true,theo:true,cora:true}}]];
const rows=[];
try{
 for(const [name,extra] of CASES)for(const time of TIMES){
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  await context.addInitScript(({key,seed})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(seed));},{key:SAVE_KEY,seed:Object.assign(freshState(),{started:true,coins:500,time,position:{x:0,z:-4},settings:{...freshState().settings,test:true,music:false,sound:false}},extra)});
  const p=await context.newPage();await p.goto(base);await p.waitForFunction(()=>window.willowmere?.metrics?.().ready,null,{timeout:120000});await p.waitForTimeout(600);
  for(const id of IDS){
   await p.evaluate(id=>willowmere.facility(id),id);await p.waitForFunction(()=>willowmere.metrics().location==='interior',null,{timeout:30000});await p.waitForTimeout(500);
   const people=await p.evaluate(()=>willowmere.targets().filter(t=>t.type==='person').map(t=>t.id));
   rows.push({case:name,time,id,people});console.log(`${name} | ${time} | ${id} | ${people.length} | ${people.join(' ')}`);
   await p.evaluate(()=>willowmere.test.leave());await p.waitForFunction(()=>willowmere.metrics().location==='village',null,{timeout:30000});
  }
  await context.close();
 }
 await writeFile(`${out}/people-${label}.json`,JSON.stringify(rows,null,1));
}catch(e){console.error(e);process.exitCode=1;}finally{await browser.close();}
