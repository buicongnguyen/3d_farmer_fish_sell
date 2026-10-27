import path from 'node:path';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const target=path.resolve(import.meta.dirname,'../..'),require=createRequire(target+'/package.json'),{chromium}=require('playwright');
const {freshState,SAVE_KEY,act}=await import(pathToFileURL(target+'/src/game.mjs'));
const {CROPS,POND}=await import(pathToFileURL(target+'/src/content.mjs'));
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']}),results=[],errors=[];
try{for(const variant of ['before','after'])for(const fixture of ['crops-desktop','crops-mobile','pond-mobile']){
 const mobile=fixture.endsWith('mobile'),context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile});
 const seed=freshState();seed.started=true;seed.time=10;seed.settings={...seed.settings,sound:false,music:false,test:true,quality:mobile?'balanced':'high'};seed.upgrades.pen=3;seed.upgrades.pond=3;seed.upgrades.farm=3;
 if(fixture.startsWith('crops')){seed.position={x:-15.5,z:-7};seed.plots=12;seed.elapsed=1000;seed.beds=Array(30).fill(null);Object.keys(CROPS).slice(0,18).forEach((crop,index)=>{seed.inventory['seed_'+crop]=3;assert.notEqual(act(seed,'plant',{index,crop}).ok,false);act(seed,'water',{index});seed.beds[index].planted=seed.elapsed-CROPS[crop].grow;});}else seed.position={x:POND.x+1,z:POND.z-POND.d/2-1};
 await context.addInitScript(({seed,key})=>{localStorage.setItem(key,JSON.stringify(seed));let n=71;Math.random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};const raf=requestAnimationFrame;window.__nativeRaf=raf.bind(window);window.requestAnimationFrame=f=>raf(t=>{if(!window.__stopRaf)f(t);});},{seed,key:SAVE_KEY});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+(variant==='before'?43986:43987));await page.waitForFunction(()=>window.willowmere?.metrics().ready&&window.__perf?.world?.ready,null,{timeout:120000});await page.locator('#begin').click();await page.evaluate(()=>__perf.stop());await page.waitForTimeout(150);await page.evaluate(()=>__perf.ready());await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'});await page.evaluate(()=>__perf.instrument());
 const frozen=await page.evaluate(()=>Array.from({length:30},()=>__perf.step(0)));
 await page.screenshot({path:`results/${variant}/${fixture}-fixed.png`});await page.screenshot({path:`results/${variant}/${fixture}-fixed-control.png`});
 const moving=await page.evaluate(()=>Array.from({length:40},()=>__perf.step(1/60)));
 const summary=rows=>Object.fromEntries(Object.keys(rows[0]).map(k=>[k,rows.map(r=>r[k]).sort((a,b)=>a-b)[Math.floor(rows.length/2)]]));
 const row={variant,fixture,frozen:summary(frozen),moving:summary(moving)};
 if(variant==='after'&&fixture==='crops-desktop'){
  await page.evaluate(()=>__perf.uninstrument());
  const memory=await page.evaluate(async()=>{const p=__perf,w=p.world;const cycle=()=>{w.burstAt(w.player.position.x,w.player.position.z,['#ff5a4d','#76c6ed'],2.3,96);for(let i=0;i<100;i++){w.burstPool.update(1/60);w.update(0);}};cycle();const before=p.memory(),mesh=w.burstPool.mesh,capacity=w.burstPool.capacity;for(let i=0;i<12;i++)cycle();return{before,after:p.memory(),sameMesh:mesh===w.burstPool.mesh,capacity,finalCapacity:w.burstPool.capacity,particles:w.particles.length};});assert.equal(memory.sameMesh,true);assert.equal(memory.capacity,memory.finalCapacity);assert.equal(memory.particles,0);assert.equal(memory.before.renderer.geometries,memory.after.renderer.geometries);assert.equal(memory.before.renderer.textures,memory.after.renderer.textures);assert.equal(memory.before.programs,memory.after.programs);row.poolLifecycle=memory;
 }
 results.push(row);console.log(JSON.stringify(row));await context.close();
}}finally{await browser.close();}await fs.writeFile('results/extra.json',JSON.stringify({results,errors},null,2));assert.deepEqual(errors,[]);
