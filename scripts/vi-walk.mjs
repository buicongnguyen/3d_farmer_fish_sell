// Vietnamese runtime walk: opens every screen and panel in Vietnamese and lists visible text that still looks English.
// Usage: GAME_URL=http://127.0.0.1:4621 node scripts/vi-walk.mjs [desktop|phone] [out.json]   (serve dist first)
import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
const root=path.resolve(import.meta.dirname,'..'),url=process.env.GAME_URL??'http://127.0.0.1:4621';
const {freshState,SAVE_KEY}=await import(pathToFileURL(path.join(root,'src/game.mjs')).href);
const {t,setLanguage,LANGUAGE_KEY}=await import(pathToFileURL(path.join(root,'src/i18n.mjs')).href);setLanguage('vi');
const view=process.argv[2]??'desktop',out=process.argv[3];
const VIEWS={desktop:{viewport:{width:1440,height:900}},phone:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}};
const {englishWords:eng}=await import('./vi-lib.mjs');const {NAME_ROWS}=await import(pathToFileURL(path.join(root,'src/vi-names.mjs')).href);
const ENGLISH_NAMES=new Set(NAME_ROWS.map(r=>r[0]).filter(n=>/^[A-Z][a-z]+$/.test(n)));
const english=s=>[...eng(s),...s.split(/[^\p{L}\p{N}]+/u).filter(w=>ENGLISH_NAMES.has(w)&&!(w==='Theo'&&/Theo (ba|dấu|đường|chân|thứ|cách)/.test(s)))];
const PANELS=[['bag'],['journal'],['people'],['map'],['help'],['settings'],['collection'],['decor'],['kitchen'],['festival'],['workers'],['wardrobe'],['mirror'],['pandora'],['grove','orchard:0'],['sleep'],['talk','ada'],
 ['shop','market'],['shop','clothes'],['shop','upgrades'],['civic','school'],['civic','hospital'],['civic','police'],['civic','company'],['seeds',0]];
const FACILITIES=['supermarket','school','hospital','police','company','bakery','moss','vale'];
const seed=freshState();seed.started=true;seed.coins=5000;seed.day=9;seed.settings.test=true;seed.settings.quality=view==='desktop'?'high':'battery';seed.inventory={carrot:3,wood:5,obsidian:2,fish:1};
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']});
const context=await browser.newContext({...VIEWS[view],deviceScaleFactor:1});
await context.addInitScript(({key,seed,lk})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(seed));localStorage.setItem(lk,'vi');},{key:SAVE_KEY,seed,lk:LANGUAGE_KEY});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const found=new Map(),totals={nodes:0};
const grab=()=>page.evaluate(()=>{const out=[];const vis=el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(el).visibility!=='hidden'};
 const skip=el=>el.closest('script,style,code,kbd,textarea,[data-i18n-skip],[translate="no"]');
 const walk=n=>{if(n.nodeType===3){const s=n.textContent.trim();if(s&&n.parentElement&&!skip(n.parentElement)&&vis(n.parentElement))out.push(s);return;}if(n.nodeType!==1||skip(n))return;for(const a of ['title','aria-label','placeholder','alt']){const v=n.getAttribute(a);if(v&&v.trim())out.push(v.trim());}for(const c of n.childNodes)walk(c);};
 walk(document.getElementById('app')||document.body);return out;});
async function collect(where){const texts=await grab();for(const s of texts){totals.nodes++;const bad=english(s);if(bad.length){if(!found.has(s))found.set(s,{where:new Set(),words:bad});found.get(s).where.add(where);}}}
const labels=new Map();
async function targets(where){const list=await page.evaluate(()=>willowmere.targets().map(t=>t.label).filter(Boolean));for(const l of list){const v=t(l);if(v===l&&english(l).length){if(!labels.has(l))labels.set(l,new Set());labels.get(l).add(where);}}}
const boot=async first=>{await page.goto(url);await page.waitForFunction(()=>window.willowmere?.metrics().ready,null,{timeout:120000});if(first)await collect('title/welcome');
 await page.locator('#begin').click().catch(()=>{});await page.waitForFunction(()=>typeof willowmere.render==='function',null,{timeout:30000}).catch(()=>{});};
await boot(true);
await collect('village HUD');
const close=async()=>{await page.evaluate(()=>document.querySelector('.close-button')?.click());await page.waitForTimeout(80);};
for(const [name,arg] of PANELS){
 try{await page.evaluate(([n,a])=>willowmere.test.open(n,a),[name,arg]);await page.waitForTimeout(500);await collect(name+(arg!==undefined?':'+arg:''));
  const tabs=await page.evaluate(()=>[...document.querySelectorAll('#modal [data-action="tab"]')].map(b=>b.dataset.id));
  for(const tab of tabs){await page.evaluate(id=>document.querySelector(`#modal [data-action="tab"][data-id="${id}"]`)?.click(),tab);await page.waitForTimeout(250);await collect(`${name}:${arg??''}/${tab}`);}
 }catch(e){errors.push(`${name}: ${e.message.split('\n')[0]}`);}
 await close();await close();
}
for(const id of FACILITIES){
 try{await boot(false);await page.evaluate(id=>willowmere.facility(id),id);await page.waitForTimeout(1500);await collect('facility:'+id);await targets('facility:'+id);
 }catch(e){errors.push(`facility ${id}: ${e.message.split('\n')[0]}`);}
}
// the ring world: stand in each region with the Pandora box open, read the HUD, the banner, the map and the lists
const {STAND}=await import(pathToFileURL(path.join(root,'tests/stands.mjs')).href);
const fresh=async(change,tag)=>{const sd=freshState();sd.started=true;sd.coins=5000;sd.day=9;sd.settings.test=true;sd.settings.quality=view==='desktop'?'high':'battery';sd.inventory={carrot:3,wood:5,obsidian:2,fish:1};change(sd);
 const ctx=await browser.newContext({...VIEWS[view],deviceScaleFactor:1});await ctx.addInitScript(({key,seed,lk})=>{localStorage.setItem(key,JSON.stringify(seed));localStorage.setItem(lk,'vi');},{key:SAVE_KEY,seed:sd,lk:LANGUAGE_KEY});
 const pg=await ctx.newPage();pg.on('pageerror',e=>errors.push(tag+': '+e.message));return {ctx,pg};};
if(!process.env.NO_WORLD){
 for(const id of Object.keys(STAND)){
  const {ctx,pg}=await fresh(sd=>{sd.position={x:STAND[id][0],z:STAND[id][1]};sd.pandora=true;},'stand '+id);
  const old=page;try{
   await pg.goto(url);await pg.waitForFunction(()=>window.willowmere?.metrics().ready,null,{timeout:120000});await pg.locator('#begin').click().catch(()=>{});await pg.waitForFunction(()=>typeof willowmere.render==='function',null,{timeout:30000}).catch(()=>{});await pg.waitForTimeout(1800);
   const grab2=async w=>{const texts=await pg.evaluate(()=>{const out=[];const vis=el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0};const skip=el=>el.closest('script,style,code,kbd,textarea,[data-i18n-skip],[translate="no"]');const walk=n=>{if(n.nodeType===3){const q=n.textContent.trim();if(q&&n.parentElement&&!skip(n.parentElement)&&vis(n.parentElement))out.push(q);return;}if(n.nodeType!==1||skip(n))return;for(const a of ['title','aria-label','placeholder','alt']){const v=n.getAttribute(a);if(v&&v.trim())out.push(v.trim());}for(const c of n.childNodes)walk(c);};walk(document.getElementById('app')||document.body);return out;});
    for(const q of texts){totals.nodes++;const bad=english(q);if(bad.length){if(!found.has(q))found.set(q,{where:new Set(),words:bad});found.get(q).where.add(w);}}
    const list=await pg.evaluate(()=>willowmere.targets().map(t=>t.label).filter(Boolean));for(const l of list){if(t(l)===l&&english(l).length){if(!labels.has(l))labels.set(l,new Set());labels.get(l).add(w);}}};
   await grab2('region '+id);
   for(const name of ['map','journal','people','bag','wardrobe']){await pg.evaluate(n=>willowmere.test.open(n),name);await pg.waitForTimeout(500);await grab2(`region ${id}: ${name}`);
    const tabs=await pg.evaluate(()=>[...document.querySelectorAll('#modal [data-action="tab"]')].map(b=>b.dataset.id));for(const tab of tabs){await pg.evaluate(i=>document.querySelector(`#modal [data-action="tab"][data-id="${i}"]`)?.click(),tab);await pg.waitForTimeout(250);await grab2(`region ${id}: ${name}/${tab}`);}
    await pg.evaluate(()=>document.querySelector('.close-button')?.click());await pg.waitForTimeout(80);}
  }catch(e){errors.push(`stand ${id}: ${e.message.split(String.fromCharCode(10))[0]}`);}finally{await ctx.close();}
 }
}
await targets('village');
const result={view,nodes:totals.nodes,distinctEnglish:found.size,texts:[...found].map(([s,v])=>({text:s,words:v.words,where:[...v.where].slice(0,4)})),labels:[...labels].map(([l,w])=>({label:l,where:[...w]})),errors};
if(out)fs.writeFileSync(out,JSON.stringify(result,null,1));
console.log(`view ${view}: text nodes ${result.nodes}, distinct strings with English ${result.distinctEnglish}, untranslated target labels ${result.labels.length}, errors ${errors.length}`);
for(const x of result.texts.slice(0,250))console.log(JSON.stringify(x.text.slice(0,120)),x.words.join(','),'<-',x.where[0]);
for(const x of result.labels)console.log('LABEL',JSON.stringify(x.label),x.where[0]);
for(const e of errors)console.log('ERR',e);
await browser.close();
