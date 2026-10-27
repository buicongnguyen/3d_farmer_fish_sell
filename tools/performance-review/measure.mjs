import path from 'node:path';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const target=path.resolve(import.meta.dirname,'../..'),require=createRequire(target+'/package.json'),{chromium}=require('playwright');
const {freshState,SAVE_KEY}=await import(pathToFileURL(target+'/src/game.mjs'));
const {POND}=await import(pathToFileURL(target+'/src/content.mjs'));
const variant=process.argv[2]??'baseline',url=process.argv[3]??'http://127.0.0.1:4185',out='results/'+variant;
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']});
const reports=[],errors=[];
function summarize(rows){const result={};for(const key of Object.keys(rows[0])){const a=rows.map(x=>x[key]).sort((a,b)=>a-b);result[key]={median:a[Math.floor(a.length/2)],p95:a[Math.floor(a.length*.95)],mean:a.reduce((s,x)=>s+x,0)/a.length};}return result;}
try{for(const mobile of [false,true])for(const fixture of ['village','pond','effects']){
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile});
 const seed=freshState();seed.started=true;seed.settings={...seed.settings,sound:false,music:false,test:true,quality:mobile?'balanced':'high'};seed.time=10;seed.upgrades.pen=3;seed.upgrades.pond=3;seed.upgrades.farm=3;if(fixture==='pond')seed.position={x:POND.x+1,z:POND.z-POND.d/2-1};
 await context.addInitScript(({seed,key})=>{localStorage.setItem(key,JSON.stringify(seed));let n=71;Math.random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};const raf=requestAnimationFrame;window.__nativeRaf=raf.bind(window);window.requestAnimationFrame=f=>raf(t=>{if(!window.__stopRaf)f(t);});},{seed,key:SAVE_KEY});
 const page=await context.newPage();page.on('pageerror',e=>errors.push({fixture,mobile,message:e.message}));page.on('response',r=>{if(r.status()>=400)errors.push({fixture,mobile,url:r.url(),status:r.status()});});
 await page.goto(url);await page.waitForFunction(()=>window.willowmere?.metrics().ready&&window.__perf?.world?.ready,null,{timeout:120000});await page.locator('#begin').click();await page.evaluate(()=>__perf.stop());await page.waitForTimeout(150);await page.evaluate(()=>__perf.ready());
 await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'});
 if(fixture==='effects')await page.evaluate(()=>{const w=__perf.world;w.burstAt(w.player.position.x,w.player.position.z,['#ff5a4d','#76c6ed'],2.3,96);w.update(.1);});
 const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:mobile?4:1});
 const gpu=await page.evaluate(()=>{const gl=__perf.world.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return{renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown',width:gl.drawingBufferWidth,height:gl.drawingBufferHeight,antialias:gl.getContextAttributes().antialias};});
 await page.evaluate(()=>__perf.instrument());
 const frozen=await page.evaluate(()=>Array.from({length:30},()=>__perf.step(0)));
 await page.screenshot({path:out+'/'+fixture+(mobile?'-mobile':'-desktop')+'.png'});
 await page.screenshot({path:out+'/'+fixture+(mobile?'-mobile':'-desktop')+'-control.png'});
 const memory=await page.evaluate(()=>__perf.memory());await cdp.send('HeapProfiler.collectGarbage');const heap=await cdp.send('Runtime.getHeapUsage');
 const moving=await page.evaluate(()=>{const w=__perf.world;w.keys.add('d');const a=Array.from({length:40},()=>__perf.step(1/60));w.keys.clear();return a;});
 await page.evaluate(()=>__perf.uninstrument());
 // Profile without operation-count wrappers; time includes game update and submission, not GPU completion.
 await cdp.send('Profiler.enable');await cdp.send('Profiler.start');
 const times=await page.evaluate(async()=>{const rows=[];for(let i=0;i<100;i++){await new Promise(__nativeRaf);const start=performance.now();__perf.world.update(1/60);rows.push({workMs:performance.now()-start});}return rows;});
 const {profile}=await cdp.send('Profiler.stop');await fs.writeFile(out+'/'+fixture+(mobile?'-mobile':'-desktop')+'.cpuprofile',JSON.stringify(profile));
 const counts=new Map();for(const n of profile.samples??[])counts.set(n,(counts.get(n)??0)+1);const hot=profile.nodes.map(n=>({name:n.callFrame.functionName||'(anonymous)',url:n.callFrame.url.split('/').at(-1),line:n.callFrame.lineNumber+1,samples:counts.get(n.id)??0})).sort((a,b)=>b.samples-a.samples).slice(0,16);
 const row={fixture,mobile,throttle:mobile?4:1,gpu,frozen:summarize(frozen),moving:summarize(moving),timing:summarize(times),memory,heap,hot};reports.push(row);console.log(JSON.stringify({variant,fixture,mobile,draws:row.frozen.draws,shadow:row.frozen.shadowDraws,compose:row.frozen.composes,multiply:row.frozen.multiplies,uploads:row.frozen.uploads,bytes:row.frozen.uploadBytes,cpu:row.timing.workMs,memory,hot:hot.slice(0,6)}));
 await fs.writeFile(out+'/measurements.json',JSON.stringify({variant,url,reports,errors},null,2));await context.close();
}}finally{await browser.close();}
if(errors.length){console.error(errors);process.exitCode=1;}
