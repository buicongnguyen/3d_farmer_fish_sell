// The indoor camera for the bigger cottage (src/room-view.mjs fit): a wide screen shows the whole house, a portrait
// phone shows it from the front wall to the back and follows you along the width, a landscape phone shows its width
// and follows you along the depth. On a phone the Pandora box is in view the moment you step in.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {fit,frameFor,followX,followZ,reachX,FRAME,BAND,MIN_SCALE} from '../src/room-view.mjs';
import {ROOM,SPAWN,PANDORA_SPOT,SPOTS,WALK} from '../src/home-plan.mjs';

/** The room camera for a framing, looking at (tx, 0, tz). */
function camera(f,aspect,tx=0,tz=f.tz){const cam=new T.PerspectiveCamera(f.fov,aspect,.5,200);cam.position.set(tx,Math.sin(f.pitch)*f.d,tz+Math.cos(f.pitch)*f.d);cam.lookAt(tx,0,tz);cam.updateMatrixWorld(true);cam.updateProjectionMatrix();return cam;}
const ndc=(cam,x,y,z)=>new T.Vector3(x,y,z).project(cam);
/** Pixels per metre on the floor where the camera looks. */
const scaleAt=(cam,width,tx,tz)=>(ndc(cam,tx+.5,0,tz).x-ndc(cam,tx-.5,0,tz).x)*width/2;
const SCREENS={desktop:[1440,900],laptop:[1280,720],tablet:[1024,768],phone:[390,844],small:[360,740],short:[375,667],landscape:[844,390],'small landscape':[667,375],'tiny landscape':[568,320]};

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
test('portrait phones: the house between the HUD and the thumbs, the view follows you, the chest is in view at the door',()=>{
 for(const name of ['phone','small','short']){
  const [w,h]=SCREENS[name],f=fit(w/h,h);assert.equal(f.mode,'portrait');assert.ok(f.portrait);
  const px=v=>({x:(v.x+1)/2*w,y:(1-v.y)/2*h}),at=(tx,tz)=>camera(f,w/h,tx,tz);
  // Never smaller than MIN_SCALE pixels to the metre (a 2.3 m person stays about 60 px tall), measured where the camera looks.
  assert.ok(f.scale>=MIN_SCALE-.01,`${name}: ${f.scale.toFixed(1)} px per metre`);assert.ok(Math.abs(scaleAt(at(0,f.tz),w,0,f.tz)-f.scale)<.5);
  // Looking as near as it goes, the front wall's foot stands on the band's bottom line: above the prompt pill (204 px up).
  const foot=px(ndc(at(0,f.tzFront),0,0,ROOM.d/2+.2));assert.ok(foot.y<=h-BAND.bottom+6&&foot.y>=h-BAND.bottom-40,`${name}: the front wall's foot at ${foot.y.toFixed(0)} of ${h}`);assert.ok(foot.y<h-204);
  // Looking as far back as it goes, the back wall's top is at the band's top line: under the player card and its chips.
  const top=px(ndc(at(0,f.tzBack),0,ROOM.full,-ROOM.d/2-.15));assert.ok(top.y>=BAND.top-6&&top.y<=BAND.top+40,`${name}: the back wall's top at ${top.y.toFixed(0)}`);
  // A tall phone holds the whole depth at once (no travel along it); a short one slides along the depth too.
  if(name==='phone'){assert.equal(f.tzBack,f.tzFront);for(const p of FRAME){const v=px(ndc(at(0,f.tz),0,p[1],p[2]));assert.ok(v.y>=BAND.top-2&&v.y<=h-BAND.bottom+2);}}
  else assert.ok(f.tzFront>f.tzBack,`${name} slides ${(f.tzFront-f.tzBack).toFixed(1)} m along the depth`);
  // It shows part of the width and slides to either side wall, where the wall is at the screen's edge and not past the middle.
  const across=w/f.scale;assert.ok(across<ROOM.w&&across>11,`${name} sees ${across.toFixed(1)} m across`);assert.ok(f.reachX>1&&f.reachX<ROOM.w/2);
  const wall=ndc(at(-f.reachX,f.tz),-ROOM.w/2,0,f.tz);assert.ok(wall.x>-1.15&&wall.x<-.7);
  assert.equal(followX(f,99),f.reachX);assert.equal(followX(f,-99),-f.reachX);assert.equal(followX(f,.5),.5);assert.equal(f.reachX,reachX(f));
  // Nearer the camera the floor is drawn larger, so the view may slide farther there; at the back, less.
  assert.ok(reachX(f,WALK.z,f.tz)>f.reachX&&reachX(f,-WALK.z,f.tz)<f.reachX);
  // Stepping in: the view is on you, and the Pandora box is on the screen, clear of the edges, below the HUD and above the pill.
  const cam=at(followX(f,SPAWN.x),followZ(f,SPAWN.z)),chest=px(ndc(cam,PANDORA_SPOT.x,.6,PANDORA_SPOT.z)),me=px(ndc(cam,SPAWN.x,1,SPAWN.z));
  assert.ok(chest.x>40&&chest.x<w-40,`${name}: the chest at x ${chest.x.toFixed(0)}`);assert.ok(chest.y>BAND.top+20&&chest.y<h-BAND.bottom-60,`${name}: the chest at y ${chest.y.toFixed(0)} of ${h}`);
  assert.ok(Math.abs(me.x-w/2)<12&&me.y>h*.4&&me.y<h-BAND.bottom,'you stand in the lower middle, above the controls');
 }
});
test('landscape phones: the house as wide as the screen between the thumbs, the view follows you along the depth',()=>{
 for(const name of ['landscape','small landscape','tiny landscape']){
  const [w,h]=SCREENS[name],f=fit(w/h,h);assert.equal(f.mode,'short');assert.ok(f.short);
  const at=(tx,tz)=>camera(f,w/h,tx,tz);
  assert.ok(f.scale>=MIN_SCALE-.01,`${name}: ${f.scale.toFixed(1)} px per metre`);
  // Much closer than fitting the whole house would be on this screen (which made everything tiny).
  const whole=fit(w/h,900);assert.equal(whole.mode,'whole');assert.ok(f.d<whole.d*.8,`${name}: ${f.d.toFixed(1)} against ${whole.d.toFixed(1)}`);
  // The width is on the screen between the stick and ACT (or the view slides the little that is missing on the smallest screens).
  // (Smaller screens stand closer to keep MIN_SCALE: there the view slides a little along the width too.)
  if(name==='landscape'){assert.equal(f.reachX,0);for(const p of FRAME)assert.ok(Math.abs(ndc(at(0,0),...p).x)<=.861,`${name}: ${p}`);}else assert.ok(f.reachX<2.5);
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
