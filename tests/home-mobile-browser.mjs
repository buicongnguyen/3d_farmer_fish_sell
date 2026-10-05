// The home on phones and tablets, in a real browser (wm-home): the whole house across the screen with both side walls clear of
// the edges and of the HUD, the doorways in view and tappable, nothing zoomed by a pinch, and the desktop framing unchanged.
// Run against a built game: GAME_URL=http://127.0.0.1:<port> GPU=1 node tests/home-mobile-browser.mjs
// Screenshots go to OUT (default test-results/home-mobile/); BEFORE (a folder of the pre-fix shots) turns on the desktop pixel compare.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {freshState,SAVE_KEY} from '../src/game.mjs';
import {FRAME,BAND,EDGE_PX,frameFor} from '../src/room-view.mjs';
import {ROOM} from '../src/home-plan.mjs';
const browser=await chromium.launch({channel:process.env.CI?undefined:'chrome',headless:true,args:process.env.GPU?['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']:['--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const base=process.env.GAME_URL??'http://127.0.0.1:4173',OUT=process.env.OUT??'test-results/home-mobile/',BEFORE=process.env.BEFORE??'C:/Users/n/source/repos/cute_game-notes/willowmere/evidence-home/before/',results=[],errors=[];
await mkdir(OUT,{recursive:true});
// [width, height, touch]: the nine screens of the analysis
const ALL=[[390,844,1],[360,800,1],[412,915,1],[430,932,1],[844,390,1],[932,430,1],[768,1024,1],[1024,768,1],[1440,900,0]];
const SIZES=process.env.ONLY?ALL.filter(([w,h])=>process.env.ONLY.split(',').includes(`${w}x${h}`)):ALL;
const seedFor=mode=>Object.assign(freshState(),{started:true,coins:3000,energy:40,position:{x:0,z:-8.8},upgrades:{farm:1,pond:1,pen:1,house:3,kitchen:3},furniture:['rug','sofa','plants','books','dining','art'],decor:mode==='empty'?[]:null});
async function open(w,h,touch,mode){
 const context=await browser.newContext({viewport:{width:w,height:h},isMobile:!!touch,hasTouch:!!touch,deviceScaleFactor:1}),seed=seedFor(mode);
 await context.addInitScript(({key,seed})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(seed));},{key:SAVE_KEY,seed});
 const p=await context.newPage();p.on('pageerror',e=>errors.push(`${w}x${h} ${e.message}`));p.on('console',m=>{if(m.type()==='error')errors.push(`${w}x${h} ${m.text()}`);});
 await p.goto(base);await p.waitForFunction(()=>window.willowmere?.metrics().ready,null,{timeout:90000});await p.locator('#begin').click();await p.waitForTimeout(400);
 return {p,context};
}
const enter=async p=>{await p.keyboard.press('e');await p.waitForFunction(()=>willowmere.metrics().location==='interior',null,{timeout:30000});await p.waitForTimeout(1600);};
/** Everything the page knows that the checks need: projected points, HUD rects, label rects, targets. */
const probe=(p,points)=>p.evaluate(points=>{
 const rv=willowmere.roomView(),cam=rv.camera,e=cam.projectionMatrix.elements,m=cam.matrixWorldInverse.elements;cam.updateMatrixWorld(true);
 const proj=([x,y,z])=>{const ax=m[0]*x+m[4]*y+m[8]*z+m[12],ay=m[1]*x+m[5]*y+m[9]*z+m[13],az=m[2]*x+m[6]*y+m[10]*z+m[14];const cx=e[0]*ax+e[4]*ay+e[8]*az+e[12],cy=e[1]*ax+e[5]*ay+e[9]*az+e[13],cw=e[3]*ax+e[7]*ay+e[11]*az+e[15];return {x:(cx/cw+1)/2*innerWidth,y:(1-cy/cw)/2*innerHeight};};
 const seen=el=>{const cs=getComputedStyle(el);if(cs.display==='none'||cs.visibility==='hidden'||+cs.opacity===0)return null;const r=el.getBoundingClientRect();return r.width>2&&r.height>2?{l:r.left,t:r.top,r:r.right,b:r.bottom,name:el.id||el.className.toString().slice(0,24)}:null;};
 const hud=[];for(const q of ['.minimap','.top-actions','.player-card','.tracker-stack > *','#room-actions','#joystick','#touch-action','#interact','.home-button'])for(const el of document.querySelectorAll(q)){const r=seen(el);if(r&&!(q==='#interact'&&getComputedStyle(el.parentElement).display==='none'))hud.push(r);}
 const labels=[...document.querySelectorAll('#room-labels .room-label')].map(el=>{const r=seen(el);return r&&{...r,text:el.textContent.trim()};}).filter(Boolean);
 const meters=[...document.querySelectorAll('.player-card .meter')].map(seen).filter(Boolean),buttons=[...document.querySelectorAll('.top-actions .icon-button')].map(seen).filter(Boolean);
 const f=rv.frame(),targets=willowmere.targets().map(t=>({type:t.type,id:t.id,x:t.screen.x,y:t.screen.y,top:document.elementFromPoint(t.screen.x,t.screen.y)?.id??'',hudHit:document.elementFromPoint(t.screen.x,t.screen.y)?.closest('.meter,.minimap,.tracker-stack,#calendar')?.className.toString().slice(0,20)??''}));
 return {pts:points.map(proj),hud,labels,meters,buttons,targets,fit:{d:f.d,mode:f.mode,scale:f.scale,fov:f.fov,tz:f.tz,reachX:f.reachX},zoomCam:cam.fov,W:innerWidth,H:innerHeight,pos:willowmere.metrics().position,top:willowmere.metrics().cameraTop};
},points);
const inside=(pt,r,pad=4)=>pt.x>r.l-pad&&pt.x<r.r+pad&&pt.y>r.t-pad&&pt.y<r.b+pad;
const floor=[[-ROOM.w/2,0,-ROOM.d/2],[ROOM.w/2,0,-ROOM.d/2],[-ROOM.w/2,0,ROOM.d/2],[ROOM.w/2,0,ROOM.d/2]];
const corners=[...FRAME,...floor];
function checkView(tag,w,h,r,{overview}){
 const safe=EDGE_PX-2,mode=frameFor(w,h);
 // The side walls' corners, front and back, are inside the screen on every size (the depth is followed on a landscape phone, never the width).
 r.pts.forEach((pt,i)=>assert.ok(pt.x>=safe&&pt.x<=w-safe,`${tag}: house corner ${i} at x ${pt.x.toFixed(0)} of ${w}`));
 // None of the corners that are on the screen is under a HUD element.
 r.pts.forEach((pt,i)=>{if(w>1100||pt.y<0||pt.y>h||(mode==='short'&&pt.y<110&&corners[i][2]<0))return;for(const rect of r.hud)assert.ok(!inside(pt,rect,mode==='portrait'?4:0),`${tag}: corner ${i} (${pt.x.toFixed(0)},${pt.y.toFixed(0)}) is under ${rect.name} ${JSON.stringify(rect)}`);});
 if(overview){ // the whole house, in the band, tall enough, big enough
  const ys=r.pts.slice(0,8).map(p=>p.y),top=Math.min(...ys),bottom=Math.max(...ys);
  assert.ok(top>=BAND.top-3&&bottom<=h-BAND.bottom+3,`${tag}: the house at ${top.toFixed(0)}..${bottom.toFixed(0)} of ${h}`);
  if(w===390)assert.ok(bottom-top>=200,`${tag}: house ${bottom-top} px tall`);
  assert.ok(r.fit.scale>=16-.01,`${tag}: ${r.fit.scale.toFixed(1)} px per metre`);assert.ok(r.fit.scale*2.3>=36,`${tag}: a person is ${(r.fit.scale*2.3).toFixed(0)} px tall`);
  assert.equal(r.fit.reachX,0);
 } else if(mode==='short')assert.ok(r.fit.scale>=23-.01&&r.fit.scale*2.3>=50);
 // Every label chip is whole on the screen.
 for(const l of r.labels)assert.ok(l.l>=-.5&&l.t>=-.5&&l.r<=w+.5&&l.b<=h+.5,`${tag}: a label is cut by the screen ${JSON.stringify(l)}`);

 // Label chips: none lies on another; a narrow portrait phone shows icons only (22 px) except the chip you stand at; the stat bars and the top buttons never overlap.
 const hit=(a,b)=>a.l<b.r-1&&a.r>b.l+1&&a.t<b.b-1&&a.b>b.t+1;
 if(w<1100||h<520)for(let i=0;i<r.labels.length;i++)for(let j=i+1;j<r.labels.length;j++)assert.ok(!hit(r.labels[i],r.labels[j]),`${tag}: labels "${r.labels[i].text}" and "${r.labels[j].text}" overlap`);
 if(w<450&&mode==='portrait')for(const l of r.labels)assert.ok(l.r-l.l<=24||/\s/.test(l.text)||l.r-l.l<=90,`${tag}: chip "${l.text}" is ${(l.r-l.l).toFixed(0)} px wide`);
 if(w<450&&mode==='portrait'){const wide=r.labels.filter(l=>l.r-l.l>30);assert.ok(wide.length<=1,`${tag}: ${wide.length} full-width chips on a phone`);}
 for(const m of r.meters)for(const b of r.buttons)assert.ok(!hit(m,b),`${tag}: a stat bar ${JSON.stringify(m)} is under a top button ${JSON.stringify(b)}`);
 // A landscape phone: no furniture target sits under the bars, the day chip or the minimap (the tap goes to the 3D canvas).
 if(mode==='short')for(const t of r.targets)if(t.y>=0&&t.y<=h&&t.x>=0&&t.x<=w)assert.equal(t.hudHit,'',`${tag}: ${t.type} ${t.id} at ${t.x.toFixed(0)},${t.y.toFixed(0)} is under ${t.hudHit}`);
 // Every doorway and spot you can use is on the screen, and nothing covers it (the 3D canvas is under the tap).
 for(const t of r.targets){if(t.type!=='exit'&&t.type!=='bedroom'&&t.type!=='kitchen')continue;
  if(mode!=='short'||t.type==='exit'){assert.ok(t.x>=safe&&t.x<=w-safe&&t.y>=0&&t.y<=h,`${tag}: ${t.type} at ${t.x.toFixed(0)},${t.y.toFixed(0)} is off the screen`);assert.equal(t.top,'game',`${tag}: ${t.type} at ${t.x.toFixed(0)},${t.y.toFixed(0)} is covered by #${t.top}`);}}
}
async function diff(p,a,b){return p.evaluate(async({a,b})=>{const load=s=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src='data:image/png;base64,'+s;});const [x,y]=await Promise.all([load(a),load(b)]);const c=document.createElement('canvas');c.width=x.width;c.height=x.height;const g=c.getContext('2d');g.drawImage(x,0,0);const A=g.getImageData(0,0,c.width,c.height).data;g.drawImage(y,0,0);const B=g.getImageData(0,0,c.width,c.height).data;let sum=0,big=0;for(let i=0;i<A.length;i+=4){const d=(Math.abs(A[i]-B[i])+Math.abs(A[i+1]-B[i+1])+Math.abs(A[i+2]-B[i+2]))/3;sum+=d;if(d>40)big++;}return {mean:sum/(A.length/4),big:big/(A.length/4)};},{a,b});}
try{
 for(const [w,h,touch] of SIZES)for(const mode of ['empty','full']){
  const tag=`${w}x${h}-${mode}`;console.log("start",tag);const {p,context}=await open(w,h,touch,mode),mobileFrame=frameFor(w,h)!=='whole';
  const outdoors=await p.evaluate(()=>willowmere.metrics().cameraTop);
  await enter(p);
  let r=await probe(p,corners);checkView(tag,w,h,r,{overview:frameFor(w,h)==='portrait'});
  await p.screenshot({path:`${OUT}${tag}-spawn.png`});
  if(!mobileFrame){ // the desktop: the same camera as before (fov 40, pitch 52), and the picture within tolerance of the shot taken before the change
   assert.equal(r.fit.mode,'whole');assert.equal(r.fit.fov,40);if(w===1440)assert.ok(Math.abs(r.fit.d-26.2)<.05&&Math.abs(r.fit.tz-2.8)<.05,`${tag}: the desktop framing moved: d ${r.fit.d} tz ${r.fit.tz}`);
   const old=`${BEFORE}${tag}-spawn.png`;
   if(w===1440&&existsSync(old)){const d=await diff(p,(await readFile(old)).toString('base64'),(await readFile(`${OUT}${tag}-spawn.png`)).toString('base64'));results.push({tag,desktopDiff:d});assert.ok(d.mean<1.2&&d.big<.01,`${tag}: the desktop picture changed (mean ${d.mean.toFixed(2)}, ${(d.big*100).toFixed(2)}% of pixels)`);}
  }
  // Walking along the side walls: the keys move you along the walls (not 22 degrees off them) and you stay on the screen.
  const z0=r.pos.z,walk=async(key,ms)=>{await p.keyboard.down(key);await p.waitForTimeout(ms);await p.keyboard.up(key);await p.waitForTimeout(1500);};
  await walk('a',4500);r=await probe(p,[]);assert.ok(Math.abs(r.pos.z-z0)<.35,`${tag}: walking left drifted ${(r.pos.z-z0).toFixed(2)} m in depth`);assert.ok(r.pos.x<-6,`${tag}: reached x ${r.pos.x.toFixed(1)}`);
  await p.screenshot({path:`${OUT}${tag}-left.png`});
  const xl=r.pos.x;await walk('d',9500);r=await probe(p,[]);assert.ok(r.pos.x>xl+5,`${tag}: walking right ended at ${r.pos.x.toFixed(1)},${r.pos.z.toFixed(1)}`);
  await p.screenshot({path:`${OUT}${tag}-right.png`});
  if(mode==='empty'&&frameFor(w,h)==='portrait'){ // the player stands against each side wall: on the screen, clear of the edges
   const me=await p.evaluate(()=>willowmere.metrics().screen);assert.ok(me.x>=24&&me.x<=w-24&&me.y>0&&me.y<h,`${tag}: the player is at ${me.x.toFixed(0)},${me.y.toFixed(0)}`);
  }
  // A pinch (the wheel) indoors does nothing, and leaves the village view as it was; the exit door is tappable.
  if(w===390||w===844||w===1440){
   await p.mouse.move(w/2,h/2);await p.mouse.wheel(0,-600);await p.mouse.wheel(0,900);await p.waitForTimeout(300);
   r=await probe(p,[]);const door=r.targets.find(t=>t.type==='exit');assert.ok(door,`${tag}: an exit target`);
   if(touch)await p.touchscreen.tap(door.x,door.y);else await p.mouse.click(door.x,door.y);
   await p.waitForFunction(()=>willowmere.metrics().location==='village',null,{timeout:40000});await p.waitForTimeout(600);
   const after=await p.evaluate(()=>willowmere.metrics().cameraTop);assert.ok(Math.abs(after-outdoors)<1e-6,`${tag}: the village zoom changed by a pinch indoors (${outdoors} -> ${after})`);
   results.push({tag,tappedTheDoor:true,zoom:after});
  }
  results.push({tag,fit:{d:+r.fit.d.toFixed(1),scale:+r.fit.scale.toFixed(1),mode:r.fit.mode}});
  await context.close();
 }
 assert.deepEqual(errors,[],'no page errors');
 console.log(JSON.stringify(results,null,1));console.log('home-mobile: all checks passed');
}finally{await browser.close();}
