// The mirror, the wardrobe, the atelier's gear tab, the things to use at home, the family that walks about and the
// docked menus, in a real browser. Run against a built game: GAME_URL=http://127.0.0.1:<port> node tests/house-browser.mjs
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {freshState,SAVE_KEY} from '../src/game.mjs';
import {ATELIER} from '../src/content.mjs';
const browser=await chromium.launch({channel:process.env.CI?undefined:'chrome',headless:true,args:process.env.GPU?['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']:['--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const base=process.env.GAME_URL??'http://127.0.0.1:4173',errors=[],results=[];await mkdir('test-results',{recursive:true});
const home=(extra={})=>Object.assign(freshState(),{started:true,coins:3000,energy:40,position:{x:0,z:-8.8},upgrades:{farm:1,pond:1,pen:1,house:3,kitchen:3},furniture:['rug','sofa','plants','books','dining','art'],...extra});
async function setup(seed,view={width:1440,height:900},mobile=false){const context=await browser.newContext({viewport:view,isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1});await context.addInitScript(({key,seed})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(seed));},{key:SAVE_KEY,seed});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});await page.goto(base);await page.waitForFunction(()=>window.willowmere?.metrics().ready,null,{timeout:90000});await page.locator('#begin').click();await page.waitForTimeout(300);return{page,context};}
const snapshot=p=>p.evaluate(()=>willowmere.snapshot());
const close=p=>p.getByRole('button',{name:'Close panel',exact:true}).click();
const enter=async p=>{await p.keyboard.press('e');await p.waitForFunction(()=>willowmere.metrics().location==='interior',null,{timeout:30000});await p.waitForTimeout(500);};
const target=(p,type,id)=>p.evaluate(({type,id})=>willowmere.targets().find(t=>t.type===type&&(id===undefined||String(t.id)===String(id))),{type,id});
async function use(p,type,id){const t=await target(p,type,id);assert.ok(t,`target ${type} ${id??''} exists`);await p.mouse.click(t.screen.x,t.screen.y);return t;}
const title=(p,text)=>p.waitForSelector(`#modal-title:has-text("${text}")`,{timeout:30000});
const box=(p,q)=>p.evaluate(q=>{const r=document.querySelector(q).getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};},q);
try{
 // ---- desktop: the house, the mirror, the wardrobe, the things to use
 const seed=home({gearOwned:['hat_straw','hat_wizard','armor_leather','sword_wood','bunny'],gear:{hat:'hat_straw',wear:'',boots:'',weapon:'',pet:'bunny'}});
 const {page:p,context}=await setup(seed);await enter(p);
 const inside=await p.evaluate(()=>willowmere.metrics());assert.ok(inside.drawCalls<=45,`indoors draws ${inside.drawCalls} calls (three people at six meshes each)`);
 const kinds=await p.evaluate(()=>willowmere.targets().map(t=>t.type+':'+t.id));for(const k of ['mirror:mirror','wardrobe:wardrobe','fun:sofa','fun:tea','fun:bath','person:june','person:pip','bedroom:sleep','kitchen:cook','exit:door'])assert.ok(kinds.includes(k),`${k} is there`);
 results.push({name:'home interior: targets and draw calls',drawCalls:inside.drawCalls});
 // Hover: a pointer cursor over a thing you can use.
 const sofa=await target(p,'fun','sofa');await p.mouse.move(sofa.screen.x,sofa.screen.y);await p.waitForFunction(()=>document.querySelector('#game').style.cursor==='pointer',null,{timeout:10000});
 // The mirror: docked on the right, nothing dimmed, a live picture, a look bought with coins.
 await use(p,'mirror');await title(p,'Mirror, mirror');await p.waitForTimeout(600);
 const dock=await p.evaluate(()=>{const b=document.querySelector('#modal-backdrop'),s=getComputedStyle(b);return{docked:b.classList.contains('docked'),look:b.classList.contains('look-panel'),blur:s.backdropFilter,bg:s.backgroundColor};});
 assert.ok(dock.docked&&dock.look);assert.ok(dock.blur==='none'||dock.blur==='');assert.match(dock.bg,/rgba\(0, 0, 0, 0\)|transparent/);
 const m=await box(p,'#modal');assert.ok(m.left>1440*.45&&m.right<=1440,'the panel sits on the right');
 assert.equal(await p.locator('[data-look-option]').count(),4+5+3+13);
 assert.ok(await p.evaluate(()=>{const c=document.querySelector('.mirror-glass canvas');if(!c||!c.width)return false;const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>200)n++;return n>c.width*c.height*.04;}),'the mirror shows the character');
 await p.locator('[data-look-option="hood:fox"]').click();await p.locator('[data-look-option="height:chibi"]').click();await p.waitForTimeout(400);
 assert.equal((await snapshot(p)).look,'girl-tall-none-none','trying on changes nothing');assert.match(await p.locator('.look-name').textContent(),/Girl · Chibi · Fox hood/);
 await p.screenshot({path:'test-results/20-mirror.png'});
 await p.locator('[data-look-action="buy"]').click();await p.waitForFunction(()=>willowmere.snapshot().look==='girl-chibi-none-fox',null,{timeout:10000});
 let s=await snapshot(p);assert.equal(s.coins,3000-75-90);assert.deepEqual(s.looksOwned,['chibi','fox']);
 await p.locator('[data-look-option="height:tall"]').click();await p.locator('[data-look-action="wear"]').click();await p.waitForFunction(()=>willowmere.snapshot().look==='girl-tall-none-fox');assert.equal((await snapshot(p)).coins,s.coins,'owned options are free to combine');
 await close(p);results.push({name:'mirror: docked builder, live preview, buy and wear a look',pass:true});
 // The wardrobe: groups, try on, wear, take off.
 await p.waitForTimeout(700);await use(p,'wardrobe');await title(p,'Your wardrobe');await p.waitForTimeout(500);
 const heads=await p.locator('.item-group-head button').allTextContents();assert.deepEqual(heads.map(h=>h.replace(/[^A-Za-z& ·0-9]/g,'').trim()),['Shirt colours · 1','Hats · 2','Outfits · 1','Melee weapons · 1','Pets · 1']);
 await p.locator('[data-gear-try="armor_leather"]').click();await p.waitForTimeout(300);assert.equal((await snapshot(p)).gear.wear,'');assert.equal(await p.locator('[data-gear-try="armor_leather"]').getAttribute('aria-pressed'),'true');
 await p.locator('[data-type="equip"][data-id="hat_wizard"]').click();await p.waitForFunction(()=>willowmere.snapshot().gear.hat==='hat_wizard');
 await p.locator('[data-type="equip"][data-id="sword_wood"]').click();await p.waitForFunction(()=>willowmere.snapshot().gear.weapon==='sword_wood');
 await p.locator('.wd-slot [data-gear-action="unequip"][data-slot="pet"]').click();await p.waitForFunction(()=>willowmere.snapshot().gear.pet==='');
 await p.screenshot({path:'test-results/21-wardrobe.png'});s=await snapshot(p);assert.deepEqual(s.gear,{hat:'hat_wizard',wear:'',boots:'',weapon:'sword_wood',pet:''});assert.equal(s.gearOwned.length,5);
 await close(p);results.push({name:'wardrobe: grouped gear, try on, wear and take off',pass:true});
 // Things to use: the sofa restores energy, then cools down; the bookshelf opens the collection log.
 await p.waitForTimeout(700);const before=(await snapshot(p)).energy;await use(p,'fun','sofa');await p.waitForFunction(e=>willowmere.snapshot().energy===e+20,before,{timeout:30000});
 await p.keyboard.press('e');await p.waitForTimeout(400);assert.equal((await snapshot(p)).energy,before+20,'the sofa cools down');
 await use(p,'fun','tea');await p.waitForFunction(e=>willowmere.snapshot().energy===e+32,before,{timeout:30000});
 const shelf=(await p.evaluate(()=>willowmere.targets().find(t=>t.type==='fun'&&String(t.id).startsWith('bookshelf'))));assert.ok(shelf);await p.mouse.click(shelf.screen.x,shelf.screen.y);await title(p,'The family collection');assert.equal(await p.locator('.house-log-row').count(),8);await close(p);
 results.push({name:'home activities: sofa and tea restore energy, cooldown, collection log',pass:true});
 // The family walks: June and Pip are somewhere in the house, and within a stay or two one of them has moved rooms.
 const where=()=>p.evaluate(()=>willowmere.targets().filter(t=>t.type==='person').map(t=>[t.id,Math.round(t.position.x*10)/10,Math.round(t.position.z*10)/10]));
 const start=await where();assert.equal(start.length,2);await p.waitForFunction(start=>{const now=willowmere.targets().filter(t=>t.type==='person');return now.some((t,i)=>Math.hypot(t.position.x-start[i][1],t.position.z-start[i][2])>1.2);},start,{timeout:90000});
 await p.screenshot({path:'test-results/22-family.png'});results.push({name:'family members walk between hangouts',from:start,to:await where()});
 await context.close();

 // ---- desktop: docked menus outdoors and the atelier's gear tab
 const finch={x:ATELIER.x,z:ATELIER.z+2.3};const {page:q,context:qc}=await setup(home({position:finch})); // the atelier's stall, beside the village market
 await q.locator('[data-panel="bag"]').click();await title(q,'Your everyday basket');let d=await q.evaluate(()=>({docked:document.querySelector('#modal-backdrop').classList.contains('docked'),blur:getComputedStyle(document.querySelector('#modal-backdrop')).backdropFilter}));assert.ok(d.docked);assert.ok(d.blur==='none'||d.blur==='');assert.ok((await box(q,'#modal')).left>1440*.45);await close(q);
 await q.locator('[data-panel="people"]').click();await q.waitForSelector('.people-grid');assert.ok((await box(q,'#modal')).width<=670,'wide panels fit the dock');assert.equal(await q.evaluate(()=>document.querySelector('.modal-content').scrollWidth>document.querySelector('.modal-content').clientWidth+1),false);await close(q);
 await q.keyboard.press('e');await title(q,'The Finch atelier');await q.locator('[data-action="tab"][data-id="gear"]').click();await q.waitForSelector('[data-shop-tab="gear"]');
 assert.equal(await q.locator('[data-shop-tab="gear"] .shop-item[data-gear]').count(),65);assert.deepEqual((await q.locator('[data-shop-tab="gear"] .item-group-head button').allTextContents()).map(h=>h.replace(/[^A-Za-z& ·0-9]/g,'').trim()),['Hats · 19','Outfits · 17','Boots · 5','Melee weapons · 10','Guns & staffs · 7','Pets · 7']);
 await q.locator('[data-gear-try="hat_frog"]').click();await q.waitForTimeout(1500);assert.deepEqual((await snapshot(q)).gearOwned,[]);await q.screenshot({path:'test-results/23-atelier-gear.png'});
 await q.locator('[data-type="buyGear"][data-id="hat_frog"]').click();await q.waitForFunction(()=>willowmere.snapshot().gear.hat==='hat_frog');s=await snapshot(q);assert.equal(s.coins,3000-70);assert.deepEqual(s.gearOwned,['hat_frog']);
 await q.locator('[data-type="buyGear"][data-id="pet_parrot"]').click();await q.waitForFunction(()=>willowmere.snapshot().gear.pet==='pet_parrot');
 await q.locator('[data-action="tab"][data-id="outfits"]').click();await q.locator('[data-type="outfit"][data-id="rose"]').click();assert.equal((await snapshot(q)).outfit,'rose','shirt colours still work');await close(q);
 await q.reload();await q.waitForFunction(()=>window.willowmere?.metrics().ready,null,{timeout:90000});s=await snapshot(q);assert.equal(s.gear.hat,'hat_frog');assert.equal(s.gear.pet,'pet_parrot');assert.equal(s.outfit,'rose');
 results.push({name:'docked menus outdoors; atelier gear tab: try on, buy, wear, saved',pass:true});await qc.close();

 // ---- phone, portrait and landscape: sheets, no sideways overflow, 44 px targets
 for(const [name,view] of [['phone',{width:390,height:844}],['landscape',{width:844,height:390}]]){
  const {page:m,context:mc}=await setup(home({gearOwned:['hat_straw','armor_leather'],gear:{hat:'hat_straw',wear:'',boots:'',weapon:'',pet:''}}),view,true);await enter(m);
  await m.evaluate(()=>{for(const q of ['.tracker-stack','.player-card','.top-actions','.minimap'])document.querySelector(q)?.style.setProperty('pointer-events','none');});
  for(const [type,heading] of [['mirror','Mirror, mirror'],['wardrobe','Your wardrobe']]){
   const t=await target(m,type);await m.touchscreen.tap(t.screen.x,t.screen.y);await title(m,heading);await m.waitForTimeout(700);
   const sheet=await box(m,'#modal');assert.equal(await m.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${name} ${type}: no sideways scroll`);
   if(name==='phone')assert.ok(sheet.top>=view.height*.42&&sheet.width>=view.width-2,'a short sheet under the character');else assert.ok(sheet.left>=view.width*.4,'a side sheet, the character on the left');
   assert.equal(await m.evaluate(()=>getComputedStyle(document.querySelector('#modal-backdrop')).backdropFilter.replace('none','')),'');
   const small=await m.evaluate(()=>[...document.querySelectorAll('#modal button')].filter(b=>b.offsetParent).map(b=>{const r=b.getBoundingClientRect(),a=getComputedStyle(b,'::before');const h=Math.max(r.height,parseFloat(a.height)||0),w=Math.max(r.width,parseFloat(a.width)||0);return{text:(b.textContent||b.getAttribute('aria-label')||'').trim().slice(0,24),w:Math.round(w),h:Math.round(h)};}).filter(b=>b.h<44||b.w<44));
   assert.deepEqual(small,[],`${name} ${type}: every button is a 44 px target`);
   await m.screenshot({path:`test-results/24-${name}-${type}.png`});
   if(type==='mirror'){await m.locator('[data-look-option="ears:cat"]').tap();await m.locator('[data-look-action="buy"]').tap();await m.waitForFunction(()=>willowmere.snapshot().look==='girl-tall-cat-none');}
   else{await m.locator('[data-type="equip"][data-id="armor_leather"]').tap();await m.waitForFunction(()=>willowmere.snapshot().gear.wear==='armor_leather');}
   await m.getByRole('button',{name:'Close panel',exact:true}).tap();await m.waitForTimeout(800);
  }
  results.push({name:`${name}: mirror and wardrobe sheets, touch targets`,pass:true});await mc.close();
 }
 assert.deepEqual(errors,[]);await writeFile('test-results/house-results.json',JSON.stringify({results,errors},null,2));console.log(JSON.stringify({results,errors},null,2));
}finally{await browser.close();}
