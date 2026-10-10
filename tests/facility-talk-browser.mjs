// The people inside the five Town Square buildings and their conversations by choice, in a real browser (light): each building is
// entered at four times of day and its people counted (never nobody in opening hours); everyone inside is talked to and one whole
// conversation walked by clicking answers (keys 1, 2, 3 on the desktop), with the layout measured (three answers, full width, at
// least 44 px tall, inside the screen, clear of the portrait); a few things are tapped. Pictures go to EVIDENCE.
//   GAME_URL=http://127.0.0.1:4811 node tests/facility-talk-browser.mjs
import {chromium} from 'file:///C:/Users/n/source/repos/3D_claudeopus55/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {freshState,SAVE_KEY} from '../src/game.mjs';
const out=process.env.EVIDENCE??'C:/Users/n/source/repos/cute_game-notes/willowmere/evidence-facility-talk';await mkdir(out,{recursive:true});
const base=process.env.GAME_URL??'http://127.0.0.1:4811',errors=[],rows=[],talks=[];
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']});
const IDS=(process.env.IDS??'school,hospital,police,supermarket,company').split(',');
const THINGS={school:['pet','library','globe'],hospital:['scale','chart','mags'],police:['bell','found','notice'],supermarket:['sample','trolley','shelf2','lost'],company:['coffee','printer','box','cooler','white','plant']};
async function open(view,mobile,time,extra={},language='en'){
 const context=await browser.newContext({viewport:view,isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1});
 await context.addInitScript(({key,seed,language})=>{localStorage.setItem('willowmere.language.v1',language);if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(seed));},{key:SAVE_KEY,language,seed:Object.assign(freshState(),{started:true,coins:500,energy:60,time,position:{x:0,z:-4},settings:{...freshState().settings,test:true,music:false,sound:false}},extra)});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(base);await page.waitForFunction(()=>window.willowmere?.metrics?.().ready,null,{timeout:120000});await page.locator('#begin:not([disabled])').click();await page.waitForTimeout(500);return {page,context};
}
const enter=async(p,id)=>{await p.evaluate(id=>willowmere.facility(id),id);await p.waitForFunction(()=>willowmere.metrics().location==='interior',null,{timeout:30000});await p.waitForTimeout(700);};
const leave=async p=>{await p.evaluate(()=>willowmere.test.leave());await p.waitForFunction(()=>willowmere.metrics().location==='village',null,{timeout:30000});};
const people=p=>p.evaluate(()=>willowmere.targets().filter(t=>t.type==='person').map(t=>({id:t.id,screen:t.screen})));
const toastText=p=>p.evaluate(()=>document.getElementById('toast').textContent);
// The open talk panel, measured.
const layout=p=>p.evaluate(()=>{const r=e=>{const b=e.getBoundingClientRect();return {x:b.left,y:b.top,w:b.width,h:b.height,r:b.right,b:b.bottom};},modal=document.getElementById('modal'),glass=modal.querySelector('.mirror-glass'),content=modal.querySelector('.modal-content');
 return {modal:r(modal),glass:glass?r(glass):null,canvas:!!glass?.querySelector('canvas'),choices:[...modal.querySelectorAll('.chat-choice[data-chat]')].map(b=>({...r(b),text:b.textContent.trim()})),lines:[...modal.querySelectorAll('.dialogue-line')].map(l=>l.textContent),talk:r(modal.querySelector('.chat-talk')),scrolls:content.scrollHeight>content.clientHeight+2,ended:!!modal.querySelector('.chat-end'),title:document.getElementById('modal-title').textContent,view:{w:innerWidth,h:innerHeight}};});
function check(l,where){
 assert.equal(l.choices.length,3,`${where}: three answers`);assert.ok(l.canvas,`${where}: the live portrait is drawn`);
 for(const c of l.choices){assert.ok(c.h>=44,`${where}: an answer is ${c.h}px tall`);assert.ok(c.w>=l.talk.w-2,`${where}: answers are full width`);assert.ok(c.text.length>1,`${where}: an answer has words`);
  assert.ok(c.b<=l.glass.y+1||c.y>=l.glass.b-1||c.x>=l.glass.r-1||c.r<=l.glass.x+1,`${where}: an answer covers the portrait`);}
 assert.ok(l.modal.x>=0&&l.modal.r<=l.view.w+1&&l.modal.y>=0&&l.modal.b<=l.view.h+1,`${where}: the panel is inside the screen`);
 assert.ok(l.glass.w>=60&&l.glass.h>=80&&l.glass.y>=l.modal.y&&l.glass.b<=l.modal.b+1,`${where}: the portrait is in view (${Math.round(l.glass.w)}x${Math.round(l.glass.h)})`);
 assert.ok(l.lines.length>=1&&l.lines[0].length>8,`${where}: the person says something`);
}
// Talks to one person and walks a whole conversation; `how` picks answers by 'click', 'tap' or 'key'.
async function converse(p,who,where,how,shot,walk=false){
 if(walk){const t=(await people(p)).find(t=>t.id===who);if(how==='tap')await p.touchscreen.tap(t.screen.x,t.screen.y);else await p.mouse.click(t.screen.x,t.screen.y);}
 else assert.ok(await p.evaluate(id=>willowmere.test.use('person',id),who),`${where}: ${who} can be talked to`);
 await p.waitForSelector('#modal .chat,#modal .dialogue-line',{timeout:20000});await p.waitForTimeout(450);
 const chat=await p.evaluate(()=>willowmere.test.chat());assert.ok(chat,`${where}: ${who} has a conversation by choice`);assert.equal(chat.who,who);
 let l=await layout(p),steps=0;check(l,where);const first=l.lines.at(-1);
 if(shot)await p.screenshot({path:`${out}/${shot}-1.png`});
 while(!l.ended&&steps<6){const i=(steps+who.length)%3,before=l.lines.join('|');
  if(how==='key')await p.keyboard.press(String(i+1));else if(how==='tap')await p.locator(`#modal .chat-choice[data-chat="${i}"]`).tap();else await p.locator(`#modal .chat-choice[data-chat="${i}"]`).click();
  await p.waitForFunction(b=>[...document.querySelectorAll('#modal .dialogue-line')].map(l=>l.textContent).join('|')!==b,before,{timeout:8000});await p.waitForTimeout(120);
  l=await layout(p);steps++;assert.ok(l.lines[0].length>8,`${where}: a reply`);if(!l.ended)check(l,`${where} step ${steps+1}`);
  if(shot&&steps===1)await p.screenshot({path:`${out}/${shot}-2.png`});}
 assert.ok(l.ended&&steps>=1&&steps<=4,`${where}: the talk ends politely after ${steps} answers`);
 assert.ok(l.modal.b<=l.view.h+1,`${where}: the ending fits`);
 if(shot)await p.screenshot({path:`${out}/${shot}-end.png`});
 talks.push({where,who,tree:chat.tree,steps,first:first.slice(0,70)});
 await p.locator('#modal .chat-end [data-action="close"]').click();await p.waitForTimeout(150);
 return chat.tree;
}
try{
 // ---- 1. Who is inside, at four times of day (desktop), and a talk with everyone at 10:00 and at lunch.
 for(const time of [8,10,12.5,15]){
  const {page:p,context}=await open({width:1440,height:900},false,time);
  for(const id of IDS){
   await enter(p,id);const list=await people(p),names=list.map(t=>t.id);rows.push({view:'desktop',time,id,people:names});console.log(`desktop ${time} ${id}: ${names.length} · ${names.join(' ')}`);
   if(time>=9&&time<16.5)assert.ok(names.length>=2,`${id} at ${time}: ${names.length} inside`);
   await p.screenshot({path:`${out}/${id}-${String(time).replace('.','')}-desktop.png`});
   if(time===10||time===12.5)for(const [k,who] of names.entries()){
    const tree=await converse(p,who,`${id} ${time} ${who}`,k%2?'key':'click',time===10&&k<2?`${id}-talk-${who}-desktop`:null,time===10&&k===0);
    if(time===10&&k===0){const again=await converse(p,who,`${id} ${time} ${who} again`,'key',null);assert.notEqual(again,tree,`${who}: a second talk the same day is another conversation`);}
   }
   if(time===10){for(const thing of THINGS[id]){assert.ok(await p.evaluate(t=>willowmere.test.use('fun',t),thing),`${id}: ${thing} is there`);await p.waitForTimeout(350);const said=await toastText(p);assert.ok(said.length>12,`${id} ${thing}: ${said}`);console.log(`   ${thing}: ${said.slice(0,110)}`);}
    await p.screenshot({path:`${out}/${id}-thing-desktop.png`});}
   await leave(p);
  }
  await context.close();
 }
 // ---- 2. The phone: everyone at 15:00, the panel upright; then one talk lying down (844x390); then Vietnamese.
 {const {page:p,context}=await open({width:390,height:844},true,15);
  for(const id of IDS){await enter(p,id);const names=(await people(p)).map(t=>t.id);rows.push({view:'phone',time:15,id,people:names});console.log(`phone 15 ${id}: ${names.length} · ${names.join(' ')}`);assert.ok(names.length>=2,`${id} phone`);
   await p.screenshot({path:`${out}/${id}-15-phone.png`});
   const seen=(await people(p)).find(t=>t.screen&&t.screen.x>30&&t.screen.x<360&&t.screen.y>150&&t.screen.y<640)?.id;console.log(`   in view to tap: ${seen??'nobody (the hook is used)'}`);
   for(const [k,who] of names.entries())await converse(p,who,`${id} phone ${who}`,'tap',k<2?`${id}-talk-${who}-phone`:null,who===seen);
   await leave(p);}
  await context.close();}
 {const {page:p,context}=await open({width:844,height:390},true,10);
  for(const id of IDS){await enter(p,id);const names=(await people(p)).map(t=>t.id);await converse(p,names[0],`${id} landscape ${names[0]}`,'tap',`${id}-talk-${names[0]}-landscape`);await leave(p);}
  await context.close();}
 for(const [view,mobile,name] of [[{width:390,height:844},true,'phone'],[{width:1440,height:900},false,'desktop']]){const {page:p,context}=await open(view,mobile,10,{day:2},'vi');
  for(const id of IDS){await enter(p,id);const names=(await people(p)).map(t=>t.id);await converse(p,names[0],`${id} vi ${names[0]}`,mobile?'tap':'key',`${id}-talk-${names[0]}-vi-${name}`);
   const l=talks.at(-1);assert.ok(/[ăâđêôơưàáảãạèéẻẽẹìíỉĩịòóỏõọùúủũụỳýỷỹỵ]/i.test(l.first),`${id}: Vietnamese is shown (${l.first})`);
   await p.evaluate(t=>willowmere.test.use('fun',t),THINGS[id][0]);await p.waitForTimeout(300);console.log(`   vi ${THINGS[id][0]}: ${(await toastText(p)).slice(0,110)}`);await leave(p);}
  await context.close();}
 // ---- 3. Night: the families who lodge in the school and the clinic are in; the staff hired away: someone minds the desk.
 {const {page:p,context}=await open({width:1440,height:900},false,21);
  for(const id of ['school','hospital']){await enter(p,id);const names=(await people(p)).map(t=>t.id);assert.equal(names.length,2,`${id} at night: ${names}`);for(const who of names)await converse(p,who,`${id} night ${who}`,'key',`${id}-night-${who}`);await leave(p);}
  await context.close();}
 {const {page:p,context}=await open({width:1440,height:900},false,10,{hired:{pearl:'farmhand',theo:'fisher'},met:{pearl:true,theo:true}});
  await enter(p,'police');const names=(await people(p)).map(t=>t.id);assert.ok(names.length>=1&&!names.includes('pearl'),`police with the officers hired: ${names}`);await converse(p,names[0],`police cover ${names[0]}`,'click','police-cover');await leave(p);await context.close();}
 assert.deepEqual(errors.filter(e=>!/favicon/.test(e)),[],'no console errors');
 await writeFile(`${out}/talk-run.json`,JSON.stringify({rows,talks},null,1));
 console.log(`${talks.length} conversations walked, ${new Set(talks.map(t=>t.tree)).size} different trees`);console.log('facility-talk-browser OK');
}catch(error){console.error(error);console.error(errors.slice(0,5));process.exitCode=1;}
finally{await browser.close();}
