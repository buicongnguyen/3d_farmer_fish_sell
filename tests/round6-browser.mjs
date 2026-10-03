// Round 6 in a real browser: thumb controls low on phones with the skill arc above ACT, the bigger cottage and its
// camera, no stray "That action is not available." toast, feet on the ground while walking, the mirror's picture from
// the game camera, and the round minimap. Run against a built game:
//   GAME_URL=http://127.0.0.1:<port> node tests/round6-browser.mjs      (GPU=1 for a real GPU)
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {freshState,SAVE_KEY} from '../src/game.mjs';
import {PLAN,ROOM,growPoint} from '../src/home-plan.mjs';
const browser=await chromium.launch({channel:process.env.CI?undefined:'chrome',headless:true,args:process.env.GPU?['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']:['--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const base=process.env.GAME_URL??'http://127.0.0.1:4173',errors=[],results=[];await mkdir('test-results',{recursive:true});
const SCREENS={phone:[390,844],small:[360,740],landscape:[844,390],desktop:[1440,900]};
const home=(extra={})=>Object.assign(freshState(),{started:true,coins:3000,energy:40,position:{x:0,z:-8.8},upgrades:{farm:1,pond:1,pen:1,house:3,kitchen:3},furniture:['rug','sofa','plants','books','dining','art'],...extra});
async function setup(seed,screen='desktop'){const [width,height]=SCREENS[screen],mobile=screen!=='desktop';const context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1});
 await context.addInitScript(({key,seed})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(seed));window.__toasts=[];addEventListener('DOMContentLoaded',()=>{const t=document.getElementById('toast');if(t)new MutationObserver(()=>{if(t.textContent)window.__toasts.push(t.textContent);}).observe(t,{childList:true,characterData:true,subtree:true});});},{key:SAVE_KEY,seed});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 await page.goto(base);await page.waitForFunction(()=>window.willowmere?.metrics().ready,null,{timeout:90000});await page.locator('#begin').click();await page.waitForTimeout(400);return{page,context,width,height};}
const rect=(p,sel)=>p.evaluate(sel=>{const e=document.querySelector(sel);if(!e)return null;const r=e.getBoundingClientRect(),cs=getComputedStyle(e);return{x:r.x,y:r.y,r:r.right,b:r.bottom,w:r.width,h:r.height,shown:cs.display!=='none'&&cs.visibility!=='hidden'&&r.width>0};},sel);
const hit=(a,b)=>a?.shown&&b?.shown&&a.x<b.r-1&&a.r>b.x+1&&a.y<b.b-1&&a.b>b.y+1;
const enter=async p=>{await p.keyboard.press('e');await p.waitForFunction(()=>willowmere.metrics().location==='interior',null,{timeout:30000});await p.waitForTimeout(900);};
const toasts=p=>p.evaluate(()=>window.__toasts.splice(0));
const snapshot=p=>p.evaluate(()=>willowmere.snapshot());
try{
 // ---- 1. Thumb controls: low on the screen, the skill arc above ACT, nothing colliding
 for(const screen of ['phone','small','landscape']){
  const {page:p,context,width,height}=await setup(home(),screen);await p.waitForTimeout(600);
  const stick=await rect(p,'#joystick'),act=await rect(p,'#touch-action'),pill=await rect(p,'#interact');
  assert.ok(stick.shown&&act.shown&&pill.shown,`${screen}: the controls are shown`);
  assert.ok(height-stick.b>=20&&height-stick.b<=60,`${screen}: the stick sits ${Math.round(height-stick.b)} px above the bottom`);assert.ok(height-act.b>=20&&height-act.b<=60,`${screen}: ACT sits ${Math.round(height-act.b)} px above the bottom`);
  assert.ok(stick.x>=12&&act.r<=width-12&&stick.w>=84&&act.w>=60,'thumb sized, inside the screen');
  assert.ok(!hit(pill,stick)&&!hit(pill,act),`${screen}: the prompt pill is clear of the stick and ACT`);
  if(screen!=='landscape')assert.ok(pill.b<=stick.y,'on a portrait phone the pill is above the stick');
  await context.close();
  // Out in the fields with the box open: Whirl, Dash and Slam arc above ACT.
  const f=await setup(home({pandora:true,position:{x:0,z:84}}),screen);await f.page.waitForFunction(()=>document.body.classList.contains('in-wilds'),null,{timeout:30000});await f.page.waitForTimeout(2600);
  const a=await rect(f.page,'#touch-action'),s=await rect(f.page,'#joystick'),skills=[];for(const name of ['spin','dash','stomp'])skills.push(await rect(f.page,'.skill-'+name));
  for(const [i,k] of skills.entries()){assert.ok(k.shown,`${screen}: skill ${i} is shown`);assert.ok(k.b<=a.y,`${screen}: skill ${i} is above ACT (${Math.round(k.b)} <= ${Math.round(a.y)})`);assert.ok(k.x>=0&&k.r<=f.width&&k.w>=44,'a thumb-sized medallion on the screen');assert.ok(!hit(k,s));}
  assert.ok(skills[0].x<skills[1].x&&skills[1].x<skills[2].x,'left to right: Whirl, Dash, Slam');assert.ok(skills[1].y<skills[0].y&&Math.abs(skills[0].y-skills[2].y)<2,'an arc: Dash at the crown');
  assert.ok(skills[2].r<=a.r+12&&skills[2].x>=a.x-12,'Slam sits over ACT');for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)assert.ok(!hit(skills[i],skills[j]));
  const others={pill:await rect(f.page,'#interact'),frame:await rect(f.page,'#target-frame'),map:await rect(f.page,'.minimap'),caption:await rect(f.page,'#map-caption'),guide:await rect(f.page,'#home-guide'),homeButton:await rect(f.page,'.home-button')};
  for(const [name,o] of Object.entries(others))for(const [i,k] of skills.entries())assert.ok(!hit(o,k),`${screen}: ${name} is clear of skill ${i}`);
  for(const name of ['pill','frame','homeButton'])assert.ok(!hit(others[name],a)&&!hit(others[name],s),`${screen}: ${name} is clear of the stick and ACT`);
  await f.page.screenshot({path:`test-results/60-controls-${screen}.png`});await f.context.close();
 }
 results.push({name:'thumb controls sit low; Whirl, Dash and Slam arc above ACT; the prompt pill and the target frame keep clear (390x844, 360x740, 844x390)',pass:true});

 // ---- 2. The bigger cottage: the chest in view at the door on phones, you are always on the screen, an old arrangement moves over
 for(const screen of ['phone','small','landscape','desktop']){
  const {page:p,context,width,height}=await setup(home(),screen);await enter(p);
  const chest=await p.evaluate(()=>willowmere.wilds().chest.screen),top=screen==='landscape'?40:120,bottom=screen==='landscape'?height-60:screen==='desktop'?height-160:height-230;
  assert.ok(chest.x>40&&chest.x<width-40&&chest.y>top&&chest.y<bottom,`${screen}: the Pandora box is in view at the door (${Math.round(chest.x)}, ${Math.round(chest.y)})`);
  let me=await p.evaluate(()=>willowmere.metrics());assert.equal(me.position.z,6.4);assert.ok(me.screen.x>20&&me.screen.x<width-20&&me.screen.y>60&&me.screen.y<height-(screen==='desktop'?120:screen==='landscape'?40:212),`${screen}: you are in view`);
  // Walk to the far left wall and then to the back: the view follows on phones, and you never leave the screen.
  for(const key of ['a','w']){await p.keyboard.down(key);for(let i=0;i<12;i++){await p.waitForTimeout(220);me=await p.evaluate(()=>willowmere.metrics());assert.ok(me.screen.x>8&&me.screen.x<width-8&&me.screen.y>8&&me.screen.y<height-8,`${screen}: on the screen at ${me.position.x.toFixed(1)}, ${me.position.z.toFixed(1)}`);}await p.keyboard.up(key);}
  assert.ok(me.position.x<-4,'walked well into the left half of the bigger house');assert.ok(Math.abs(me.position.x)<=ROOM.w/2&&Math.abs(me.position.z)<=ROOM.d/2);
  if(screen==='phone'||screen==='desktop')await p.screenshot({path:`test-results/61-home-${screen}.png`});await context.close();
 }
 { // a save from the first cottage plan (no `plan`, the old default arrangement plus one moved piece)
  const first=[{id:'fern',x:-6.3,z:5.3,rot:0},{id:'fern',x:3.25,z:5.3,rot:0},{id:'basket',x:4.55,z:5.25,rot:.5},{id:'armchair',x:-4.75,z:3.85,rot:.55},{id:'dining_table',x:1.3,z:.75,rot:0},{id:'bookshelf',x:3.5,z:2,rot:-Math.PI/2},{id:'stool',x:-2.5,z:-.7,rot:0}];
  const old=home({decor:first});delete old.plan;const {page:p,context}=await setup(old);
  const s=await snapshot(p);assert.equal(s.plan,PLAN);assert.deepEqual(s.decor.map(d=>d.id),['fern','fern','basket','armchair','dining_table','bookshelf'],'the stool that stood in what is now a doorway is back in storage');
  s.decor.forEach((d,i)=>{const at=growPoint(first[i].x,first[i].z);assert.deepEqual({x:d.x,z:d.z},at);});
  await enter(p);assert.ok((await p.evaluate(()=>willowmere.targets().length))>=12);await context.close();
 }
 results.push({name:'the bigger cottage: the chest is in view at the door, you stay on the screen wherever you walk, an arrangement from the first plan moves over',pass:true});

 // ---- 3. No stray toast: an unknown action says nothing, a double tap does one thing, the pill tells the truth
 {
  const {page:p,context}=await setup(home({position:{x:17,z:-13},energy:60}));await p.waitForTimeout(5200);await toasts(p);
  await p.evaluate(()=>{const b=document.createElement('button');b.dataset.action='do';b.id='slip';b.style.cssText='position:fixed;left:400px;top:300px;z-index:99;width:60px;height:40px';document.body.append(b);});
  await p.mouse.click(430,320);await p.evaluate(()=>{document.getElementById('slip').dataset.type='teleport';});await p.mouse.click(430,320);await p.waitForTimeout(300);
  assert.deepEqual(await toasts(p),[],'an action the game does not know says nothing');await p.evaluate(()=>document.getElementById('slip').remove());
  // E twice in a moment at the feed trough: the answer stays, the prompt then says why it waits.
  await p.keyboard.press('e');await p.waitForTimeout(120);await p.keyboard.press('e');await p.waitForTimeout(500);
  assert.deepEqual(await toasts(p),['Happy clucks! Fresh produce is ready in the basket.']);
  assert.deepEqual(await p.evaluate(()=>({label:document.querySelector('#interact span').textContent,waiting:document.getElementById('interact').classList.contains('waiting')})),{label:'The animals are fed for today',waiting:true});
  await p.waitForTimeout(700);await p.keyboard.press('e');await p.waitForTimeout(300);assert.deepEqual(await toasts(p),['Everyone has been fed today.'],'pressing anyway still answers with its own line');
  // The fighting keys in the village: silent with the box shut.
  await p.keyboard.press('f');await p.keyboard.press('1');await p.waitForTimeout(300);assert.deepEqual(await toasts(p),[]);
  for(const t of await p.evaluate(()=>window.__toasts))assert.doesNotMatch(t,/not available/i);await context.close();
  // With the box open they say why nothing happens (once in a while, not on every press).
  const o=await setup(home({pandora:true}));await o.page.waitForTimeout(5200);await toasts(o.page);await o.page.keyboard.press('f');await o.page.keyboard.press('2');await o.page.waitForTimeout(300);
  const said=await toasts(o.page);assert.equal(said.length,1);assert.match(said[0],/village is safe/);await o.context.close();
  // The wardrobe: a double tap on Wear puts the piece on (it used to go on and straight off, or dress you in another row's piece), and the list keeps its place.
  const gear=['hat_straw','hat_wizard','sword_wood','boots_cloud','armor_angel','pet_dragon','hat_bear','gun_pea'];
  const w=await setup(home({gearOwned:gear}));await enter(w.page);const t=await w.page.evaluate(()=>willowmere.targets().find(t=>t.type==='wardrobe'));await w.page.mouse.click(t.screen.x,t.screen.y);await w.page.waitForSelector('#modal-title:has-text("wardrobe")',{timeout:30000});await w.page.waitForTimeout(600);
  const wear=w.page.locator('.shop-item[data-gear="gun_pea"] [data-type="equip"]');await wear.scrollIntoViewIfNeeded();await w.page.waitForTimeout(200);
  const at=await w.page.evaluate(()=>document.querySelector('#modal .modal-content').scrollTop),box=await wear.boundingBox();assert.ok(at>100,'the row is well down the list');
  await w.page.mouse.click(box.x+box.width/2,box.y+box.height/2);await w.page.waitForTimeout(140);await w.page.mouse.click(box.x+box.width/2,box.y+box.height/2);await w.page.waitForTimeout(500);
  const worn=(await snapshot(w.page)).gear;assert.equal(worn.weapon,'gun_pea');assert.equal(worn.wear,'','no other piece was put on by the second tap');
  assert.equal(await w.page.evaluate(()=>document.querySelector('#modal .modal-content').scrollTop),at,'the list stays where it was');
  // A deliberate second tap a moment later still works (Take off).
  await w.page.waitForTimeout(500);await w.page.mouse.click(box.x+box.width/2,box.y+box.height/2);await w.page.waitForFunction(()=>willowmere.snapshot().gear.weapon==='',null,{timeout:5000});
  await w.page.getByRole('button',{name:'Close panel',exact:true}).click();
  // A thing at home that cools down: the pill shows the wait, pressing answers with the thing's own line.
  await w.page.waitForTimeout(400);const sofa=await w.page.evaluate(()=>willowmere.targets().find(t=>t.type==='fun'&&t.id==='sofa'));await w.page.mouse.click(sofa.screen.x,sofa.screen.y);await w.page.waitForFunction(()=>willowmere.snapshot().energy===60,null,{timeout:30000});await w.page.waitForTimeout(1500);await toasts(w.page);
  const pill=await w.page.evaluate(()=>({label:document.querySelector('#interact span').textContent,waiting:document.getElementById('interact').classList.contains('waiting')}));assert.match(pill.label,/^Sofa · ready in 1:5\d$/);assert.equal(pill.waiting,true);
  await w.page.keyboard.press('e');await w.page.waitForTimeout(300);const cool=await toasts(w.page);assert.equal(cool.length,1);assert.match(cool[0],/^You have only just got up from the sofa · ready in 1:5\d$/);
  await w.context.close();
 }
 results.push({name:'no stray toast: unknown actions are silent, a double tap does one thing, lists keep their place, the prompt pill says what waits and why',pass:true});

 // ---- 4. Feet on the ground through the walk, for the shortest and the tallest look
 const feet={};
 for(const height of ['tiny','tall','grown']){
  const {page:p,context}=await setup(home({look:`girl-${height}-none-none`,looksOwned:['tiny','grown'],position:{x:2,z:14}}));await p.waitForFunction(h=>willowmere.feet().look===`girl-${h}-none-none`,height,{timeout:30000});await p.waitForTimeout(400);
  const samples=await p.evaluate(async()=>{const out=[],key=(type,k)=>document.dispatchEvent(new KeyboardEvent(type,{key:k,bubbles:true}));key('keydown','d');const t0=performance.now();
   await new Promise(done=>{const tick=()=>{out.push(willowmere.feet());if(performance.now()-t0>2400)done();else requestAnimationFrame(tick);};requestAnimationFrame(tick);});key('keyup','d');return out;});
  const low=Math.min(...samples.map(s=>s.low)),high=Math.max(...samples.map(s=>s.low)),swing=Math.max(...samples.map(s=>Math.abs(s.legs[0])));
  assert.ok(samples.length>30&&swing>.2,`${height}: the legs swing (${samples.length} frames)`);assert.ok(low>=-.001,`${height}: a foot never goes under the ground (${low.toFixed(4)})`);assert.ok(high<=.02,`${height}: the lower foot is never more than 2 cm up (${high.toFixed(4)})`);
  feet[height]={low:Math.round(low*1e4)/1e4,high:Math.round(high*1e4)/1e4,swing:Math.round(swing*100)/100};
  if(height==='grown')await p.screenshot({path:'test-results/62-grown-walk.png'});await context.close();
 }
 assert.ok(feet.grown.swing<feet.tall.swing&&feet.tall.swing<feet.tiny.swing,'longer legs take a smaller swing');
 results.push({name:'walking: the lower foot stays on the ground (tiny, tall, grown-up)',feet});

 // ---- 5. The mirror's picture is taken from the game camera, and the whole figure is in it
 {
  const {page:p,context}=await setup(home({look:'girl-grown-none-fox',looksOwned:['grown','fox','tiny']}));await enter(p);
  const m=await p.evaluate(()=>willowmere.targets().find(t=>t.type==='mirror'));await p.mouse.click(m.screen.x,m.screen.y);await p.waitForSelector('#modal-title:has-text("Mirror")',{timeout:30000});await p.waitForFunction(()=>willowmere.mirror().mirror,null,{timeout:30000});await p.waitForTimeout(900);
  const frame=(await p.evaluate(()=>willowmere.mirror())).mirror;assert.ok(Math.abs(frame.pitch-Math.atan(.87))<1e-6,'the village camera’s 41 degrees');assert.ok(frame.high-frame.low<=frame.span&&(frame.low-(frame.v-frame.span/2))/frame.span>.02,'the whole figure, feet above the glass’s edge');
  // The glass is drawn: the head is in its upper part and the feet near the bottom (not cut off).
  const ink=await p.evaluate(()=>{const c=document.querySelector('[data-mirror-slot="mirror"] canvas'),g=c.getContext('2d'),d=g.getImageData(0,0,c.width,c.height).data;let top=c.height,bottom=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x+=2)if(d[(y*c.width+x)*4+3]>200){top=Math.min(top,y);bottom=Math.max(bottom,y);}return{top:top/c.height,bottom:bottom/c.height};});
  assert.ok(ink.top>.02&&ink.top<.3&&ink.bottom>.8&&ink.bottom<.99,`the figure fills the glass without touching its edge (${ink.top.toFixed(2)} … ${ink.bottom.toFixed(2)})`);
  await p.screenshot({path:'test-results/63-mirror.png'});
  await p.locator('[data-look-option="height:tiny"]').click();await p.waitForTimeout(700);const tiny=(await p.evaluate(()=>willowmere.mirror())).mirror;assert.ok(Math.abs(tiny.span-frame.span)<.05,'one size of glass, so the looks compare');assert.ok(tiny.high-tiny.low<frame.high-frame.low);
  await context.close();results.push({name:'the mirror’s picture is taken from the game camera (41 degrees), whole figure in',frame:{pitch:Math.round(frame.pitch*1000)/1000,span:Math.round(frame.span*100)/100},ink});
 }

 // ---- 6. The minimap: a true circle, centred on you, north on the rim, the room plan indoors, a tap opens the full map
 for(const screen of ['desktop','phone','landscape']){
  const {page:p,context}=await setup(home({pandora:true,position:{x:0,z:-8.8}}),screen);await p.waitForTimeout(600);
  const look=()=>p.evaluate(()=>{const c=document.getElementById('map-canvas'),r=c.getBoundingClientRect(),cs=getComputedStyle(c),g=c.getContext('2d'),px=(x,y)=>[...g.getImageData(x,y,1,1).data],n=document.getElementById('map-north').getBoundingClientRect(),b=document.querySelector('.minimap').getBoundingClientRect();
   return{w:r.width,h:r.height,radius:cs.borderRadius,corner:px(3,3)[3],corner2:px(c.width-4,c.height-4)[3],centre:px(c.width/2,c.height/2),edge:px(c.width/2,6)[3],north:{x:(n.left+n.width/2-b.left)/b.width,y:(n.top+n.height/2-b.top)/b.height},caption:document.getElementById('map-caption').textContent,map:willowmere.map()};});
  let m=await look();assert.ok(Math.abs(m.w-m.h)<.5&&m.w>=80,`${screen}: the canvas is square (${m.w} x ${m.h})`);assert.equal(m.radius,'50%');assert.equal(m.corner,0);assert.equal(m.corner2,0);assert.equal(m.edge,255,'drawn out to the rim');
  assert.ok(m.centre[3]===255&&m.centre[0]>200&&m.centre[1]>200&&m.centre[2]>200,'you are the white arrow in the middle');assert.equal(m.caption,'WILLOWMERE');assert.equal(m.map.place,'village');
  assert.ok(m.north.x>.6&&m.north.x<.8&&m.north.y<.12,`${screen}: N rides the rim to the upper right (the camera is turned)`);
  await enter(p);await p.waitForTimeout(500);m=await look();assert.equal(m.caption,'YOUR HOMESTEAD');assert.equal(m.map.place,'interior');assert.ok(Math.abs(m.north.x-.5)<.03&&m.north.y<.06,'north is straight up indoors');assert.equal(m.corner,0);
  await context.close();
  const f=await setup(home({pandora:true,position:{x:0,z:95}}),screen);await f.page.waitForFunction(()=>willowmere.map().caption==='NEAR MEADOWS',null,{timeout:30000});
  const far=await f.page.evaluate(()=>willowmere.map());assert.ok(far.radius>46&&far.radius<=120,'the map opens up in the fields');
  await f.page.locator('.minimap').click();await f.page.waitForSelector('#large-map',{timeout:10000});assert.ok(await f.page.locator('#modal-title').count());
  if(screen==='phone')await f.page.screenshot({path:'test-results/64-map-phone.png'});await f.context.close();
 }
 results.push({name:'the minimap is a true circle centred on you, with north on the rim, the room plan indoors and the full map on a tap',pass:true});

 assert.deepEqual(errors,[]);
 await writeFile('test-results/round6-results.json',JSON.stringify({results,errors},null,2));console.log(JSON.stringify({results,errors},null,2));
}finally{await browser.close();}
