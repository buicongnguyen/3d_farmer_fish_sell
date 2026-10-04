// Getting off a vehicle leaves nothing of the riding pose behind: for every body and height, a hero seated by seatPose and
// stood up by standPose walks exactly like one that never rode (legs on every axis, hips, lowest foot, tilt).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {buildAvatar,preloadAvatar,useAvatarLoader,walkAvatar,lowestFoot,PLAYER_SCALE} from '../src/avatar.mjs';
import {BODIES,HEIGHTS} from '../src/looks.mjs';
import {newGait} from '../src/walk-cycle.mjs';
import {SEATS,seatPose,standPose} from '../src/drive-view.mjs';

const loader=async name=>{const b=await readFile(new URL(`../public/assets/models/${name}.glb`,import.meta.url));return await new Promise((ok,no)=>new GLTFLoader().parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'',g=>ok(g.scene),no));};
useAvatarLoader(loader);const world={};
/** What World.update does each frame on foot: animatePerson(0) zeroes the limbs' x, then the walk cycle. */
const frame=(a,gait,dist,dt)=>{for(const k of ['arm_l','arm_r','leg_l','leg_r'])a.userData.parts[k].rotation.x=0;a.position.y=walkAvatar(a,gait,dist,dt);};
const snap=a=>{const p=a.userData.parts;return [...['leg_l','leg_r','arm_l','arm_r'].flatMap(k=>[p[k].rotation.x,p[k].rotation.y,p[k].rotation.z]),a.rotation.x,a.rotation.z,a.position.y,lowestFoot(a)];};
const walkFor=(a,s)=>{const g=newGait(),out=[];for(let i=0;i<60;i++){frame(a,g,s/60,1/60);out.push(snap(a));}return out;};
const same=(x,y,why)=>x.forEach((f,i)=>f.forEach((v,j)=>assert.ok(Math.abs(v-y[i][j])<1e-9,`${why}: frame ${i} value ${j}: ${v} vs ${y[i][j]}`)));

test('standPose undoes seatPose for every body and height, on the bike and in the jeep',async()=>{
 for(const body of BODIES)for(const h of HEIGHTS){
  const look=`${body}-${h}-none-none`;await preloadAvatar(world,{look});
  const make=()=>{const a=buildAvatar(world,{look});a.scale.multiplyScalar(PLAYER_SCALE);a.rotation.y=1.2;return a;};
  const fresh=walkFor(make(),3);
  for(const id of ['bike','jeep']){
   const a=make();seatPose(a,SEATS[id],.7,.1);assert.ok(Math.abs(a.userData.parts.leg_l.rotation.x)>.5,'seated');a.position.y=1;
   standPose(a);a.rotation.y=1.2;
   same(walkFor(a,3),fresh,`${look} after the ${id}`);
   // And standing still, with the gait idle: the limbs are straight, not left as seated.
   const b=make();seatPose(b,SEATS[id],.7,.1);standPose(b);for(const k of ['leg_l','leg_r'])assert.ok(b.userData.parts[k].rotation.toArray().slice(0,3).every(v=>Math.abs(v)<1e-12),`${look} ${k} straight`);
  }
 }
});
