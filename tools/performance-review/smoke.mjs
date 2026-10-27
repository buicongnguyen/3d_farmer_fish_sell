import path from 'node:path';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const target=path.resolve(import.meta.dirname,'../..'),require=createRequire(target+'/package.json'),{chromium}=require('playwright');
const {freshState,SAVE_KEY}=await import(pathToFileURL(target+'/src/game.mjs'));
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']}),rows=[],errors=[];
try{for(const mobile of [false,true]){
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile});const seed=freshState();seed.started=true;seed.settings={...seed.settings,test:true,sound:false,music:false};seed.upgrades.house=3;seed.upgrades.kitchen=3;seed.bike=true;seed.furniture=['rug','sofa','plants','books','dining','art'];
 await context.addInitScript(({seed,key})=>localStorage.setItem(key,JSON.stringify(seed)),{seed,key:SAVE_KEY});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:43988');await page.waitForFunction(()=>window.willowmere?.test&&willowmere.metrics().ready);await page.locator('#begin').click();await page.waitForTimeout(1000);
 const at=await page.evaluate(()=>willowmere.metrics().position);
 if(mobile){const box=await page.locator('#joystick').boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2,cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+35,y,id:1}]});await page.waitForTimeout(450);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}else{await page.keyboard.down('d');await page.waitForTimeout(450);await page.keyboard.up('d');}
 const to=await page.evaluate(()=>willowmere.metrics().position);assert.ok(Math.hypot(to.x-at.x,to.z-at.z)>.2,'movement');
 await page.evaluate(()=>willowmere.test.place(45,45));await page.waitForTimeout(400);await page.evaluate(()=>{window.__jumpMax=0;window.__jumpTimer=setInterval(()=>__jumpMax=Math.max(__jumpMax,willowmere.jump().height),10);});
 if(mobile)await page.locator('#jump-button').tap();else await page.keyboard.press('Space');await page.waitForTimeout(1000);const jump=await page.evaluate(()=>{clearInterval(__jumpTimer);return{max:__jumpMax,...willowmere.jump()};});assert.ok(jump.max>.2,'jump rises');assert.equal(jump.height,0,'jump lands');
 for(let i=0;i<3;i++){await page.evaluate(()=>willowmere.test.house(0));await page.waitForFunction(()=>willowmere.metrics().location==='interior');await page.waitForTimeout(200);assert.ok((await page.evaluate(()=>willowmere.targets())).length>0,'room picking targets');await page.evaluate(()=>willowmere.test.leave());await page.waitForFunction(()=>willowmere.metrics().location==='village');}
 for(const id of ['bike','jeep']){await page.evaluate(id=>willowmere.test.board(id),id);await page.waitForFunction(id=>willowmere.metrics().riding===id,id);await page.keyboard.down('w');await page.waitForTimeout(300);await page.keyboard.up('w');assert.ok(Number.isFinite((await page.evaluate(()=>willowmere.metrics())).heading));await page.evaluate(()=>willowmere.test.dismount());assert.equal((await page.evaluate(()=>willowmere.metrics())).riding,'');}
 rows.push({mobile,movement:Math.hypot(to.x-at.x,to.z-at.z),jumpMax:jump.max,houseCycles:3,vehicles:['bike','jeep']});await context.close();
}}finally{await browser.close();}await fs.writeFile('results/smoke.json',JSON.stringify({rows,errors},null,2));assert.deepEqual(errors,[]);console.log(JSON.stringify({rows,errors}));
