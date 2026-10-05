// The baseline house envelope plus room-aware phone framing (room-camera.mjs). Wide screens retain the whole house;
// phones use the active room's closer framing. The small synchronous room-view wrapper retains early frame clients.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {fit,frameFor,followX,followZ,reachX,FRAME,BAND,MIN_SCALE,MIN_SCALE_SHORT,MIN_SCALE_OVERVIEW,EDGE_PX,OFF_CENTRE,focusRoom,frameRoom,roomTarget} from '../src/room-camera.mjs';
import {installRoomView} from '../src/room-view.mjs';
import {ROOM,ROOMS,SPAWN,PANDORA_SPOT,SPOTS,WALK} from '../src/home-plan.mjs';

/** The room camera for a framing, looking at (tx, 0, tz). */
function camera(f,aspect,tx=0,tz=f.tz){const cam=new T.PerspectiveCamera(f.fov,aspect,.5,200);cam.position.set(tx,Math.sin(f.pitch)*f.d,tz+Math.cos(f.pitch)*f.d);cam.lookAt(tx,0,tz);cam.updateMatrixWorld(true);cam.updateProjectionMatrix();return cam;}
const ndc=(cam,x,y,z)=>new T.Vector3(x,y,z).project(cam);
/** Pixels per metre on the floor where the camera looks. */
const scaleAt=(cam,width,tx,tz)=>(ndc(cam,tx+.5,0,tz).x-ndc(cam,tx-.5,0,tz).x)*width/2;
const SCREENS={p360:[360,800],p412:[412,915],p430:[430,932],'tablet portrait':[768,1024],desktop:[1440,900],laptop:[1280,720],tablet:[1024,768],phone:[390,844],small:[360,740],short:[375,667],landscape:[844,390],'small landscape':[667,375],'tiny landscape':[568,320]};

test('which framing a screen gets',()=>{
 assert.equal(frameFor(1440,900),'whole');assert.equal(frameFor(1280,720),'whole');assert.equal(frameFor(1024,768),'whole');assert.equal(frameFor(768,1024),'portrait');
 assert.equal(frameFor(390,844),'portrait');assert.equal(frameFor(360,740),'portrait');assert.equal(frameFor(844,390),'short');assert.equal(frameFor(667,375),'short');assert.equal(frameFor(932,430),'short');
 assert.equal(frameFor(500,500),'whole','a small square window is not a landscape phone');
 // The frame is the house itself: its floor, the top of the back wall, the low front wall.
 assert.equal(FRAME.length,8);assert.ok(Math.abs(Math.max(...FRAME.map(p=>p[0]))-(ROOM.w/2+.15))<1e-9);assert.ok(Math.abs(Math.max(...FRAME.map(p=>p[1]))-ROOM.full)<1e-9);assert.ok(Math.min(...FRAME.map(p=>p[2]))<-ROOM.d/2);
});
test('wide screens show the whole house, with the back wall’s top on the screen',()=>{
 for(const name of ['desktop','laptop','tablet']){
  const [w,h]=SCREENS[name],f=fit(w/h,h);assert.equal(f.mode,'whole');const cam=camera(f,w/h);
  for(const p of FRAME){const v=ndc(cam,...p);assert.ok(Math.abs(v.x)<=.991&&v.y<=.971&&v.y>=-.561,`${name}: ${p} at ${v.x.toFixed(2)}, ${v.y.toFixed(2)}`);}
  // It is the closest such view: a metre nearer and something leaves the frame.
  const nearer=camera({...f,d:f.d-1},w/h);assert.ok(FRAME.some(p=>{const v=ndc(nearer,...p);return Math.abs(v.x)>.99||v.y>.97||v.y<-.56;}));
  assert.equal(f.reachX,0);assert.equal(f.tzBack,f.tzFront);
  // Everything you can use is on the screen, and so is the chest.
  for(const s of [...Object.values(SPOTS),PANDORA_SPOT,SPAWN]){const v=ndc(cam,s.x,.6,s.z);assert.ok(Math.abs(v.x)<.97&&Math.abs(v.y)<.97);}
 }
});
test('the baseline portrait house envelope fits between the HUD and the thumbs',()=>{
 for(const name of ['phone','small','short','p360','p412','p430','tablet portrait']){
  const [w,h]=SCREENS[name],f=fit(w/h,h);assert.equal(f.mode,'portrait');assert.ok(f.portrait);
  const px=v=>({x:(v.x+1)/2*w,y:(1-v.y)/2*h}),cam=camera(f,w/h,0,f.tz);
  // Overview: nothing slides, nothing is followed.
  assert.equal(f.reachX,0);assert.equal(f.tzBack,f.tzFront);assert.equal(followX(f,99),0);assert.equal(followZ(f,99),f.tz);
  // Every corner of the house, wall bases and tops, is inside the screen with the edge margin on both sides.
  const pts=FRAME.map(p=>px(ndc(cam,...p)));
  for(const p of pts)assert.ok(p.x>=EDGE_PX-1&&p.x<=w-EDGE_PX+1,`${name}: corner at x ${p.x.toFixed(0)} of ${w}`);
  const left=Math.min(...pts.map(p=>p.x)),right=Math.max(...pts.map(p=>p.x));assert.ok(left<EDGE_PX+4&&right>w-EDGE_PX-4,`${name}: the house is as wide as the screen allows (${left.toFixed(0)}..${right.toFixed(0)})`);
  // Wall base corners at the front and at the back (spawn is at the middle, so these are the two side walls' ends).
  for(const [x,z] of [[-ROOM.w/2,-ROOM.d/2],[ROOM.w/2,-ROOM.d/2],[-ROOM.w/2,ROOM.d/2],[ROOM.w/2,ROOM.d/2]]){const p=px(ndc(cam,x,0,z));assert.ok(p.x>=EDGE_PX&&p.x<=w-EDGE_PX,`${name}: wall base ${x},${z} at ${p.x.toFixed(0)}`);}
  // Never smaller than the overview floor, and a person (2.3 m) stays readable.
  assert.ok(f.scale>=(name==='small'?16:MIN_SCALE_OVERVIEW)-.01,`${name}: ${f.scale.toFixed(1)} px per metre`);assert.ok(Math.abs(scaleAt(cam,w,0,f.tz)-f.scale)<.5);assert.ok(f.scale*2.3>=36);
  // The house sits in the band the HUD leaves free, in the middle of it, and is tall enough to read.
  const top=Math.min(...pts.map(p=>p.y)),bottom=Math.max(...pts.map(p=>p.y));assert.ok(top>=BAND.top-2&&bottom<=h-BAND.bottom+2,`${name}: house ${top.toFixed(0)}..${bottom.toFixed(0)} of ${h}`);
  assert.ok(Math.abs((top+bottom)/2-(BAND.top+h-BAND.bottom)/2)<=OFF_CENTRE*h/2+4,`${name}: centred`);assert.ok(bottom-top>=(w>=390?200:170),`${name}: house height ${(bottom-top).toFixed(0)}`);
  // Stepping in: you and the Pandora box are on the screen, clear of the edges; the exit door at the front is too.
  const me=px(ndc(cam,SPAWN.x,1,SPAWN.z)),chest=px(ndc(cam,PANDORA_SPOT.x,.6,PANDORA_SPOT.z));
  assert.ok(chest.x>EDGE_PX&&chest.x<w-EDGE_PX&&chest.y>top&&chest.y<bottom,`${name}: the chest at ${chest.x.toFixed(0)}, ${chest.y.toFixed(0)}`);assert.ok(me.x>EDGE_PX&&me.x<w-EDGE_PX&&me.y>top&&me.y<bottom);
  // The pandora box, the walk limits (every spot you can stand at) and the doorways are inside the margin.
  for(const x of [-WALK.x,WALK.x])for(const z of [-WALK.z,0,WALK.z]){const p=px(ndc(cam,x,1,z));assert.ok(p.x>EDGE_PX&&p.x<w-EDGE_PX,`${name}: a person at ${x},${z} is at x ${p.x.toFixed(0)}`);}
 }
});
test('the baseline house envelope adapts to narrower portrait screens',()=>{
 const a=fit(390/844,844),b=fit(360/800,800),c=fit(430/932,932);assert.ok(a.d>b.d*.9&&c.scale>a.scale&&a.scale>b.scale);
 // The whole width: the camera is as near as it can be with the edge margin kept (a metre nearer, and a corner leaves it).
 for(const [w,h] of [[390,844],[360,800],[412,915],[430,932]]){const f=fit(w/h,h),near=camera({...f,d:f.d-1.2},w/h,0,f.tz);assert.ok(FRAME.some(p=>{const x=(ndc(near,...p).x+1)/2*w;return x<EDGE_PX||x>w-EDGE_PX;}),`${w}: a nearer camera crops the width`);}
});
test('the baseline landscape envelope keeps the house between the thumbs and follows its depth',()=>{
 for(const name of ['landscape','small landscape','tiny landscape']){
  const [w,h]=SCREENS[name],f=fit(w/h,h);assert.equal(f.mode,'short');assert.ok(f.short);
  const at=(tx,tz)=>camera(f,w/h,tx,tz);
  assert.ok(f.scale>=MIN_SCALE_SHORT-.01,`${name}: ${f.scale.toFixed(1)} px per metre`);
  // Much closer than fitting the whole house would be on this screen (which made everything tiny).
  const whole=fit(w/h,900);assert.equal(whole.mode,'whole');assert.ok(f.d<whole.d*.87,`${name}: ${f.d.toFixed(1)} against ${whole.d.toFixed(1)}`);
  // The width is on the screen between the stick and ACT (or the view slides the little that is missing on the smallest screens).
  // (Smaller screens stand closer to keep MIN_SCALE: there the view slides a little along the width too.)
  if(name==='landscape'){assert.equal(f.reachX,0);for(const p of FRAME)assert.ok(Math.abs(ndc(at(0,0),...p).x)<=.801,`${name}: ${p}`);}else assert.ok(f.reachX<2.5);
  // The front corners clear the stick (122 px from the left on a 390 px tall phone) and ACT: the house is narrower than the screen between them.
  if(name==='landscape'){const fl=(ndc(at(0,f.tzFront),-ROOM.w/2,ROOM.low,ROOM.d/2).x+1)/2*w;assert.ok(fl>=122,`front-left corner at ${fl.toFixed(0)}`);}
  // It travels: from the front wall above the prompt pill to the back wall under the top HUD line.
  assert.ok(f.tzFront-f.tzBack>6,`${name}: ${(f.tzFront-f.tzBack).toFixed(1)} m of travel`);
  assert.ok(ndc(at(0,f.tzFront),0,0,ROOM.d/2+.2).y<=-.58);assert.ok(ndc(at(0,f.tzBack),0,ROOM.full,-ROOM.d/2-.15).y>=.44);
  // It looks a little past you, inside its travel.
  assert.equal(followZ(f,99),f.tzFront);assert.equal(followZ(f,-99),f.tzBack);const mid=(f.tzBack+f.tzFront)/2+1.4;assert.ok(Math.abs(followZ(f,mid)-(mid-1.4))<1e-9);
  // Stepping in: you and the Pandora box are both on the screen; at the back of the bedroom its far wall's foot is in view.
  const cam=at(followX(f,SPAWN.x),followZ(f,SPAWN.z)),me=ndc(cam,SPAWN.x,1,SPAWN.z),chest=ndc(cam,PANDORA_SPOT.x,.6,PANDORA_SPOT.z);
  assert.ok(Math.abs(me.x)<.05&&Math.abs(me.y)<.75);assert.ok(Math.abs(chest.x)<.5&&chest.y<.95&&chest.y>-.5,`${name}: the chest at ${chest.y.toFixed(2)}`);
  assert.ok(ndc(at(0,followZ(f,-WALK.z)),0,0,-ROOM.d/2).y<.75,'the back wall’s foot is on the screen');
 }
});
test('wherever you walk you are on the screen, on every screen',()=>{
 for(const [name,[w,h]] of Object.entries(SCREENS)){
  const f=fit(w/h,h);let worst=0;
  for(let x=-WALK.x;x<=WALK.x+1e-9;x+=WALK.x/4)for(let z=-WALK.z;z<=WALK.z+1e-9;z+=WALK.z/4){
   const tz=followZ(f,z),cam=f.mode==='whole'?camera(f,w/h):camera(f,w/h,followX(f,x,z,tz),tz);
   for(const y of [0,2.3]){const v=ndc(cam,x,y,z);worst=Math.max(worst,Math.abs(v.x),Math.abs(v.y));assert.ok(Math.abs(v.x)<=.98&&Math.abs(v.y)<=.98,`${name}: at ${x.toFixed(1)}, ${z.toFixed(1)} you are at ${v.x.toFixed(2)}, ${v.y.toFixed(2)}`);}
  }
  assert.ok(worst>.3);
 }
});

test('phone views centre each small room and keep its furniture clear of the top and bottom HUD',()=>{
 for(const [w,h] of [[390,844],[360,740],[844,390],[667,375]])for(const room of ROOMS.slice(0,3)){
  const base=fit(w/h,h),f=frameRoom(base,w,h,room),r=room.rect,p={x:(r.x0+r.x1)/2,z:(r.z0+r.z1)/2},t=roomTarget(f,p);
  const cam=camera({...base,d:f.d},w/h,t.x,t.z);cam.position.y+=t.y;cam.lookAt(t.x,t.y,t.z);cam.setViewOffset(w,h,0,f.shiftY,w,h);cam.updateMatrixWorld(true);
  assert.equal(t.x,p.x);assert.equal(t.z,p.z);
  for(const x of [r.x0,r.x1])for(const z of [r.z0,r.z1])for(const y of [0,ROOM.full]){
   const v=ndc(cam,x,y,z),px=(v.x+1)*w/2,py=(1-v.y)*h/2;
   assert.ok(px>=EDGE_PX-.01&&px<=w-EDGE_PX+.01,`${w}x${h} ${room.id} horizontal room edge ${px}`);
   assert.ok(py>=f.top-.01&&py<=h-f.bottom+.01,`${w}x${h} ${room.id} room edge under HUD ${py}`);
  }
  assert.ok(f.d<base.d*.85,`${w}x${h}: ${room.id} zoomed closer than whole house`);
  const atEdge=roomTarget(f,{x:r.x0+.4,z:r.z1-.4});assert.deepEqual(atEdge,t,'walking inside a small room keeps its centre stable');
 }
});

test('room focus changes beyond doorway thresholds and large rooms keep their followed window inside the walls',()=>{
 const living=ROOMS.find(r=>r.id==='living'),kitchen=ROOMS.find(r=>r.id==='kitchen');
 assert.equal(focusRoom({x:4.1,z:-2.1},living),living);
 assert.equal(focusRoom({x:4.1,z:-2.4},living),kitchen);
 assert.equal(focusRoom({x:4.1,z:-1.9},kitchen),kitchen);
 assert.equal(focusRoom({x:4.1,z:-1.6},kitchen),living);
 const base=fit(390/844,844),f=frameRoom(base,390,844,living),left=roomTarget(f,{x:-9,z:0}),right=roomTarget(f,{x:5,z:8});
 assert.ok(left.x<right.x&&left.z<right.z,'the large living room follows movement in both directions');
 for(const t of [left,right]){assert.ok(t.x-f.spanX/2>=living.rect.x0);assert.ok(t.x+f.spanX/2<=living.rect.x1);assert.ok(t.z-f.spanZ/2>=living.rect.z0);assert.ok(t.z+f.spanZ/2<=living.rect.z1);}
});

test('deferred room camera preserves registered clients and activates their hooks once after installation',()=>{
 const world={camera:{name:'outside'}},view=installRoomView(world),calls=[],before=[],after=[];
 view.onFrame(()=>calls.push('first'));view.onFrame(()=>calls.push('second'));view.onAfter(()=>calls.push('after'));
 assert.equal(installRoomView(world),view);assert.equal(view.camera,world.camera);assert.equal(view.frame(),null);
 const camera={name:'inside'};view.initialize(w=>{assert.equal(w,world);return{camera,frame:()=>({mode:'whole'}),onFrame:f=>before.push(f),onAfter:f=>after.push(f)};});
 assert.equal(installRoomView(world),view);assert.equal(view.camera,camera);assert.equal(view.initialize,undefined);
 view.onFrame(()=>calls.push('late'));for(const f of before)f();for(const f of after)f();
 assert.deepEqual(calls,['first','second','late','after']);
});
