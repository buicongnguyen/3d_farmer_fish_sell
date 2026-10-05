// The indoor camera for the bigger cottage (src/room-view.mjs fit): a wide screen shows the whole house, a portrait
// phone shows it from the front wall to the back and follows you along the width, a landscape phone shows its width
// and follows you along the depth. On a phone the Pandora box is in view the moment you step in.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {fit,frameFor,followX,followZ,reachX,FRAME,BAND,MIN_SCALE,MIN_SCALE_SHORT,MIN_SCALE_OVERVIEW,EDGE_PX,OFF_CENTRE} from '../src/room-view.mjs';
import {ROOM,SPAWN,PANDORA_SPOT,SPOTS,WALK} from '../src/home-plan.mjs';

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
test('portrait phones: the whole house across the screen, both side walls in view, centred in the band between the HUD and the thumbs',()=>{
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
test('a narrower phone draws a smaller house, never a cropped one',()=>{
 const a=fit(390/844,844),b=fit(360/800,800),c=fit(430/932,932);assert.ok(a.d>b.d*.9&&c.scale>a.scale&&a.scale>b.scale);
 // The whole width: the camera is as near as it can be with the edge margin kept (a metre nearer, and a corner leaves it).
 for(const [w,h] of [[390,844],[360,800],[412,915],[430,932]]){const f=fit(w/h,h),near=camera({...f,d:f.d-1.2},w/h,0,f.tz);assert.ok(FRAME.some(p=>{const x=(ndc(near,...p).x+1)/2*w;return x<EDGE_PX||x>w-EDGE_PX;}),`${w}: a nearer camera crops the width`);}
});
test('landscape phones: the house as wide as the screen between the thumbs, the view follows you along the depth',()=>{
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
