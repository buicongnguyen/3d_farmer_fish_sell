import path from 'node:path';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const target=path.resolve(import.meta.dirname,'../..'),require=createRequire(target+'/package.json'),{chromium}=require('playwright');
const {freshState,SAVE_KEY}=await import(pathToFileURL(target+'/src/game.mjs'));
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']});
const all=[];
try{for(const mobile of [false,true]){
 const width=mobile?390:1440,height=mobile?844:900,context=await browser.newContext({viewport:{width,height},deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile});
 const seed=freshState();seed.started=true;seed.time=10;seed.settings={...seed.settings,sound:false,music:false,test:true,quality:mobile?'balanced':'high'};seed.upgrades.pen=3;seed.upgrades.pond=3;seed.upgrades.farm=3;
 await context.addInitScript(({seed,key})=>{try{localStorage.setItem(key,JSON.stringify(seed));}catch{}let n=71;Math.random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};const raf=requestAnimationFrame;window.__nativeRaf=raf.bind(window);window.requestAnimationFrame=f=>raf(t=>{if(!window.__stopRaf)f(t);});},{seed,key:SAVE_KEY});
 const page=await context.newPage();page.on('pageerror',e=>console.log('pageerror',e.message));await page.goto('http://127.0.0.1:43987/pair.html');await page.setContent(`<style>body{margin:0}iframe{position:absolute;inset:0;border:0;width:${width}px;height:${height}px}</style><iframe name="a" src="http://127.0.0.1:43986"></iframe><iframe name="b" src="http://127.0.0.1:43987"></iframe><iframe name="null" src="http://127.0.0.1:43986"></iframe>`);
 const frames={};for(const name of ['a','b','null']){console.log('warm',mobile,name);const f=frames[name]=page.frame(name);await page.locator('iframe').evaluateAll((els,name)=>els.forEach(e=>e.style.zIndex=e.name===name?'2':'1'),name);await f.waitForFunction(()=>window.willowmere?.metrics().ready&&window.__perf?.world?.ready,null,{timeout:120000,polling:100});await f.evaluate(()=>{document.querySelector('#begin').click();__perf.stop();});await f.waitForTimeout(100);await f.evaluate(()=>__perf.ready());}
 const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:mobile?4:1});
 const batch=async name=>frames[name].evaluate(()=>{const w=__perf.world;let ms=0;for(let i=0;i<12;i++){const start=performance.now();w.update(1/60);ms+=performance.now()-start;}return ms/12;});
 for(const name of ['a','b','null'])await batch(name);
 for(const kind of ['null','candidate']){if(kind==='candidate')for(let i=0;i<12;i++)await batch('b');const rows=[];for(let i=0;i<12;i++){const other=kind==='null'?'null':'b',order=i%2?[other,'a']:['a',other],row={};for(const name of order){await page.evaluate(()=>new Promise(requestAnimationFrame));row[name]=await batch(name);}rows.push({a:row.a,b:row[other],change:(row[other]/row.a-1)*100});}const mean=k=>rows.reduce((s,r)=>s+r[k],0)/rows.length,summary={mobile,kind,a:mean('a'),b:mean('b'),change:(mean('b')/mean('a')-1)*100,rows};all.push(summary);console.log(JSON.stringify(summary));}
 await context.close();
}}finally{await browser.close();}
await fs.writeFile('results/paired.json',JSON.stringify(all,null,2));
