// The insides of the five Town Square buildings in a real browser, light: for each building at 1440x900 and 390x844 it is entered
// (the supermarket by its real door: walk-up, E), the camera is checked (both side walls on a wide screen; you and the way out on
// a phone), the people at their stations, the building's own action opens its panel (desktop), the door leads out, and a picture is
// kept. Run against a built game: GAME_URL=http://127.0.0.1:4601 node tests/facilities-browser.mjs
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {freshState,SAVE_KEY} from '../src/game.mjs';
import {CIVIC} from '../src/content.mjs';
const out=process.env.EVIDENCE??'C:/Users/n/source/repos/cute_game-notes/willowmere/evidence-facilities';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:process.env.CI?undefined:'chrome',headless:true,args:process.env.GPU?['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']:['--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const base=process.env.GAME_URL??'http://127.0.0.1:4601',errors=[];
const door=id=>{const c=CIVIC.find(c=>c.id===id);return {x:c.x,z:c.z+c.d/2+1.8};};
const seed=at=>Object.assign(freshState(),{started:true,coins:500,energy:60,time:process.env.T?Number(process.env.T):10,position:at,inventory:{carrot:4,apple:2,seed_carrot:2}});
async function open(view,mobile,at){const context=await browser.newContext({viewport:view,isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1});await context.addInitScript(({key,seed})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(seed));},{key:SAVE_KEY,seed:seed(at)});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});await page.goto(base);await page.waitForFunction(()=>window.willowmere?.metrics().ready,null,{timeout:90000});await page.locator('#begin').click();await page.waitForTimeout(400);return {page,context};}
const loc=p=>p.evaluate(()=>willowmere.metrics().location);
const inside=async p=>{await p.waitForFunction(()=>willowmere.metrics().location==='interior',null,{timeout:30000});await p.waitForTimeout(900);};
// Where the walls' top corners land on the screen (NDC), from the room camera itself.
const walls=p=>p.evaluate(()=>{const c=willowmere.roomView().camera,m=c.matrixWorldInverse.elements,q=c.projectionMatrix.elements,pr=(x,y,z)=>{const vx=m[0]*x+m[4]*y+m[8]*z+m[12],vy=m[1]*x+m[5]*y+m[9]*z+m[13],vz=m[2]*x+m[6]*y+m[10]*z+m[14],vw=m[3]*x+m[7]*y+m[11]*z+m[15],cx=q[0]*vx+q[4]*vy+q[8]*vz+q[12]*vw,cy=q[1]*vx+q[5]*vy+q[9]*vz+q[13]*vw,cw=q[3]*vx+q[7]*vy+q[11]*vz+q[15]*vw;return {x:cx/cw,y:cy/cw};};return {left:pr(-9.8,1.5,0),right:pr(9.8,1.5,0),leftBack:pr(-9.8,3,-8.4),rightBack:pr(9.8,3,-8.4)};});
const EXPECT={bakery:{panel:/country kitchen|recipe passed down/i,type:'kitchen',people:process.env.T?['hugo']:[]},supermarket:{panel:/Willowmere Supermarket/,type:'shop',people:['nell','oren','finn']},school:{panel:/Willowmere School/,type:'civic',people:['cora','pip']},hospital:{panel:/Village Clinic/,type:'civic',people:['hazel','sylvie']},police:{panel:/Police Station/,type:'civic',people:['pearl','theo']},company:{panel:/Village leader|Willow & Co/,type:'facility',people:['bea','leo','fern']}};
const results=[];
try{
 for(const [name,view,mobile] of [['desktop',{width:1440,height:900},false],['phone',{width:390,height:844},true]]){
  const first=door('supermarket'),{page:p,context}=await open(view,mobile,first);
  for(const id of ['supermarket','bakery','school','hospital','police','company'].filter(id=>!process.env.ONLY||id===process.env.ONLY)){
   const want=EXPECT[id],before=await p.evaluate(()=>willowmere.metrics().position);
   if(id==='supermarket'&&!mobile&&!process.env.ONLY){assert.equal(await loc(p),'village');await p.keyboard.press('e');}   // the real door: stand at the door spot, press E
   else await p.evaluate(id=>willowmere.facility(id),id);
   await inside(p);
   const info=await p.evaluate(()=>({m:willowmere.metrics(),t:willowmere.targets().map(t=>t.type+':'+t.id),snap:willowmere.snapshot().stats.trips}));
   assert.equal(info.m.location,'interior',`${id} ${name}: inside`);
   assert.ok(info.t.includes('exit:door'),`${id}: the way out`);assert.ok(info.t.some(t=>t.startsWith(want.type+':')),`${id}: has its ${want.type} target`);
   for(const who of want.people)assert.ok(info.t.includes('person:'+who),`${id} ${name}: ${who} is at work (${info.t.filter(t=>t.startsWith('person')).join(',')})`);
   assert.ok(info.m.drawCalls<=60,`${id}: ${info.m.drawCalls} draw calls`);
   const w=await walls(p);
   if(!mobile){for(const k of ['left','right','leftBack','rightBack'])assert.ok(Math.abs(w[k].x)<=1&&Math.abs(w[k].y)<=1,`${id}: wall corner ${k} is on screen (${w[k].x.toFixed(2)}, ${w[k].y.toFixed(2)})`);}
   else assert.ok(info.m.screen&&info.m.screen.x>0&&info.m.screen.x<390&&info.m.screen.y>0&&info.m.screen.y<844,`${id}: you are on the phone screen`);
   await p.screenshot({path:`${out}/${id}-${name}.png`});
   results.push({id,name,calls:info.m.drawCalls,tris:info.m.triangles,people:info.t.filter(t=>t.startsWith('person')).length,trips:info.snap});
   if(!mobile){ // its own action opens its panel
    const t=await p.evaluate(want=>{const list=willowmere.targets();const t=list.find(t=>t.type===want.type&&(want.type!=='facility'||t.id==='hire'))??list.find(t=>t.type===want.type);return t;},want);
    await p.mouse.click(t.screen.x,t.screen.y);
    await p.waitForSelector('#modal-title',{timeout:30000});const title=await p.locator('#modal-title').textContent();assert.match(title,want.panel,`${id}: the panel`);
    if(id==='supermarket')await p.screenshot({path:`${out}/${id}-checkout-panel.png`});
    await p.getByRole('button',{name:'Close panel',exact:true}).click();await p.waitForTimeout(200);
   }
   // Out by the door.
   const exit=await p.evaluate(()=>willowmere.targets().find(t=>t.type==='exit'));await p.mouse.click(exit.screen.x,exit.screen.y);
   await p.waitForFunction(()=>willowmere.metrics().location==='village',null,{timeout:30000});
   const back=await p.evaluate(()=>willowmere.metrics().position);assert.ok(Math.hypot(back.x-before.x,back.z-before.z)<.5,`${id}: back where you came in (${back.x.toFixed(1)}, ${back.z.toFixed(1)})`);
  }
  await context.close();
 }
 assert.deepEqual(errors.filter(e=>!/favicon/.test(e)),[],'no console errors');
 console.log(JSON.stringify(results,null,1));console.log('facilities-browser OK');
}catch(error){console.error(error);process.exitCode=1;}
finally{await browser.close();}
