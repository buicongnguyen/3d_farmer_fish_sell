// How the people stand and walk, measured on the real model files: every height keeps the proportions it was modelled
// with (Zoo Garden's), the lower foot rests on the ground through the whole walk cycle for every body and height, and the
// mirror's picture is taken from the game's own camera angle with the whole figure in.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {buildAvatar,preloadAvatar,useAvatarLoader,walkAvatar,lowestFoot,feetOf,standHeight,restPose,SLIM,PLAYER_SCALE} from '../src/avatar.mjs';
import {BODIES,HEIGHTS,HEIGHT_RATIO,SLIM as SLIMS,SLIM_TALL,baseBody,bodyFile,slimOf} from '../src/looks.mjs';
import {newGait,gaitSwing,SINK,MAX_SWING} from '../src/walk-cycle.mjs';
import {mirrorFrame,MIRROR_YAW} from '../src/mirror-view.mjs';
import {CAMERA_PITCH,CAMERA_RISE} from '../src/field-layout.mjs';

const file=name=>new URL(`../public/assets/${name}`,import.meta.url);
const loader=async name=>{const b=await readFile(file(`models/${name}.glb`));return await new Promise((ok,no)=>new GLTFLoader().parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'',g=>ok(g.scene),no));};
useAvatarLoader(loader);const world={};
/** The file's own figure, as Zoo Garden draws it: every mesh but the sprout on the head (Willowmere never showed it). */
function fileBox(scene){scene.updateMatrixWorld(true);const box=new T.Box3(),part=new T.Box3();scene.traverse(o=>{if(!o.isMesh||o.name==='head-leaf')return;o.geometry.computeBoundingBox();box.union(part.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld));});return box;}
const player=async(look,gear)=>{await preloadAvatar(world,{look,gear});const a=buildAvatar(world,{look,gear});a.scale.multiplyScalar(PLAYER_SCALE);return a;};
const rest=a=>{const p=a.userData.parts;for(const k of ['arm_l','arm_r','leg_l','leg_r'])p[k].rotation.x=0;};
/** Walks an avatar at a speed for some seconds the way World.update does; returns what its feet did. */
function walk(a,speed,seconds=3,dt=1/60){
 const gait=newGait();let low=Infinity,high=-Infinity,sink=0,lift=0,swing=0;
 for(let t=0;t<seconds;t+=dt){rest(a);a.position.y=walkAvatar(a,gait,speed*dt,dt);const foot=lowestFoot(a);low=Math.min(low,foot);high=Math.max(high,foot);sink=Math.min(sink,a.position.y);lift=Math.max(lift,a.position.y);swing=Math.max(swing,Math.abs(a.userData.parts.leg_l.rotation.x));}
 return {low,high,sink,lift,swing,gait};
}

test('standing: every height keeps the proportions it was modelled with; only Willowmere’s own tall body is slimmed',async()=>{
 assert.equal(SLIM,.85);assert.equal(SLIM_TALL,.85);assert.deepEqual(SLIMS,{tiny:1,chibi:1,teen:1,tall:.85,grown:1});
 const chibi=fileBox(await loader('hero')).max.y;
 for(const body of BODIES)for(const h of HEIGHTS){
  const look=`${body}-${h}-none-none`,raw=await loader(bodyFile(body,h)),box=fileBox(raw);await preloadAvatar(world,{look});
  const a=buildAvatar(world,{look}),mine=new T.Box3().setFromObject(a),hip=raw.getObjectByName('leg-left').position.y;
  assert.equal(slimOf(look),h==='tall'?.85:1);
  // As tall as the file, feet on the floor, hips where the file has them: the legs are exactly as long as designed.
  assert.ok(Math.abs(mine.max.y-box.max.y)<1e-3,`${look} height ${mine.max.y.toFixed(3)} vs file ${box.max.y.toFixed(3)}`);assert.ok(Math.abs(mine.min.y)<2e-3,`${look} stands on the floor`);
  assert.ok(Math.abs(a.userData.parts.leg_l.position.y-hip)<1e-6&&Math.abs(a.userData.parts.leg_r.position.y-hip)<1e-6);assert.ok(Math.abs(feetOf(a).leg-hip)<2e-3,`${look} leg length ${feetOf(a).leg.toFixed(3)}`);
  // As wide as the file, so the height : width of the figure is Zoo Garden's (the tall body is 85% as wide by design).
  if(body===baseBody(body)){const wide=box.max.x-box.min.x,deep=box.max.z-box.min.z;assert.ok(Math.abs((mine.max.x-mine.min.x)-wide*slimOf(look))<2e-3,`${look} width`);assert.ok(Math.abs((mine.max.z-mine.min.z)-deep*slimOf(look))<2e-3,`${look} depth`);}
 }
 // The heights stand in the reference's ratios (measured with the sprout, as looks.mjs HEIGHT_RATIO was).
 for(const h of HEIGHTS){const top=new T.Box3().setFromObject(await loader(bodyFile('boy',h))).max.y;assert.ok(Math.abs(top/new T.Box3().setFromObject(await loader('hero')).max.y-HEIGHT_RATIO[h])<.002,h);}
 assert.ok(chibi>2.1&&chibi<2.3);
 // Hips: Tiny .42, Chibi .52, Teen .72, Tall .98, Grown-up 1.62 (half the Grown-up is leg, by design).
 const hips=[];for(const h of HEIGHTS){await preloadAvatar(world,{look:`girl-${h}-none-none`});hips.push(buildAvatar(world,{look:`girl-${h}-none-none`}).userData.parts.leg_l.position.y);}
 assert.deepEqual(hips.map(v=>Math.round(v*100)/100),[.42,.52,.72,.98,1.62]);
});
test('walking: the lower foot rests on the ground through the whole cycle, for every body and height, at a stroll, a walk and a run',async()=>{
 for(const body of BODIES)for(const h of HEIGHTS){
  const a=await player(`${body}-${h}-none-none`);
  assert.ok(Math.abs(lowestFoot(a))<2e-3&&Math.abs(standHeight(a))<2e-3,`${body}-${h} stands on the ground`);
  for(const speed of [1.5,4.8,7.7]){
   const w=walk(a,speed);
   assert.ok(w.low>=-5e-4,`${body}-${h} at ${speed} m/s: the foot never goes under the ground (${w.low.toFixed(4)})`);
   assert.ok(w.high<=.02,`${body}-${h} at ${speed} m/s: the lower foot is never more than 2 cm up (${w.high.toFixed(4)})`);
   assert.ok(w.swing>.2&&w.swing<=MAX_SWING+1e-9);assert.ok(w.sink>=-SINK-1e-6,`${body}-${h}: the body sinks ${(-w.sink).toFixed(3)} m at most`);assert.ok(w.lift<.06);
   assert.ok(Math.abs(w.swing-gaitSwing(speed,feetOf(a).leg*a.scale.y))<.02,'the swing is the one the leg and the speed ask for');
  }
  // Standing still again: the legs come back under the body and it rests at its standing height.
  const gait=newGait();for(let i=0;i<60;i++){rest(a);a.position.y=walkAvatar(a,gait,4.8/60,1/60);}for(let i=0;i<90;i++){rest(a);a.position.y=walkAvatar(a,gait,0,1/60);}
  assert.equal(gait.blend,0);assert.ok(Math.abs(a.position.y)<2e-3&&Math.abs(lowestFoot(a))<2e-3);
 }
 // Longer legs take a smaller angle: the Grown-up's swing is well under the Tiny's.
 const tiny=await player('girl-tiny-none-none'),grown=await player('girl-grown-none-none');assert.ok(walk(grown,4.8).swing<walk(tiny,4.8).swing-.3);
});
test('walking in boots, at a villager’s size and a child’s: still on the ground',async()=>{
 // Boots are merged into the legs; glowing ones add a second mesh to each leg. Both count as the foot.
 for(const boots of ['boots_cloud','boots_rocket'])for(const h of ['tiny','tall','grown']){
  const a=await player(`girl-${h}-none-none`,{hat:'',wear:'',boots,weapon:'',pet:''});assert.equal(a.userData.pending,false);
  const w=walk(a,4.8);assert.ok(w.low>=-5e-4&&w.high<=.02,`${h} in ${boots}: ${w.low.toFixed(4)} … ${w.high.toFixed(4)}`);
 }
 // Villagers (0.79) at their walking pace and children (0.57); the family indoors strolls at 1.5 m/s.
 for(const [scale,speed] of [[.79,2.6],[.57,2.3],[.79,1.5],[.57,1.7]]){
  await preloadAvatar(world,{look:'boy-tall-none-none'});const a=buildAvatar(world,{look:'boy-tall-none-none'});a.scale.multiplyScalar(scale);
  const w=walk(a,speed);assert.ok(w.low>=-5e-4&&w.high<=.02,`scale ${scale}: ${w.low.toFixed(4)} … ${w.high.toFixed(4)}`);
 }
});
test('what the old walk did (one swing for every leg, the bob at the wrong moment): the Grown-up’s feet left the ground',async()=>{
 // world.mjs used to swing every leg by ±0.5 rad and lift the body by |sin| x 0.065 with the legs apart. Measured the same way:
 const old=a=>{let low=Infinity,high=-Infinity;for(let i=0;i<64;i++){const ph=i/64*Math.PI*2,p=a.userData.parts;p.leg_l.rotation.x=Math.sin(ph)*.5;p.leg_r.rotation.x=-Math.sin(ph)*.5;a.position.y=Math.abs(Math.sin(ph))*.065;const f=lowestFoot(a);low=Math.min(low,f);high=Math.max(high,f);}rest(a);a.position.y=0;return{low,high};};
 const grown=await player('girl-grown-none-none'),tiny=await player('girl-tiny-none-none');
 assert.ok(old(grown).high>.13,'both feet 13 cm and more above the ground at every step');assert.ok(old(tiny).high>.02&&old(tiny).high<old(grown).high/2,'a short leg hid it: the Tiny floated a few centimetres');
 // The same two, walked the new way.
 for(const a of [grown,tiny]){const w=walk(a,4.8);assert.ok(w.low>=-5e-4&&w.high<=.02);}
});
test('the mirror’s picture is taken from the game’s camera, high above and looking down, with the whole figure in',async()=>{
 assert.ok(Math.abs(CAMERA_PITCH-Math.atan(CAMERA_RISE))<1e-12);assert.ok(CAMERA_PITCH>.6&&CAMERA_PITCH<.8,'about 41 degrees, the angle the village is seen from');
 const c=Math.cos(CAMERA_PITCH),s=Math.sin(CAMERA_PITCH),corners=b=>[b.min,b.max].flatMap(x=>[b.min,b.max].flatMap(y=>[b.min,b.max].map(z=>[x.x,y.y,z.z])));
 const glasses={mirror:190/270,'phone mirror':84/190,wardrobe:118/168,'phone wardrobe':84/132};
 const outfits=[['bare',{}],['fox hood',{hood:'fox'}],['wizard hat',{gear:{hat:'hat_wizard',wear:'armor_angel',boots:'boots_cloud',weapon:'',pet:''}}]];
 const shares={};
 for(const h of HEIGHTS)for(const [name,o] of outfits){
  const look=`girl-${h}-none-${o.hood??'none'}`;await preloadAvatar(world,{look,gear:o.gear});
  const a=restPose(buildAvatar(world,{look,gear:o.gear}));a.rotation.y=MIRROR_YAW;a.updateMatrixWorld(true);const box=new T.Box3().setFromObject(a);
  for(const [glass,aspect] of Object.entries(glasses)){
   const f=mirrorFrame(box,aspect,{reach:3.75});assert.equal(f.pitch,CAMERA_PITCH);
   // Every corner of the figure's box lands inside the glass (x across, y cos − z sin up the picture).
   for(const [x,y,z] of corners(box)){const u=x-f.u,v=y*c-z*s-f.v;assert.ok(Math.abs(u)<=f.span*aspect/2+1e-9&&Math.abs(v)<=f.span/2+1e-9,`${h} ${name} in the ${glass}`);}
   // The feet stand near the glass's bottom edge, the head has air above it.
   const foot=(f.low-(f.v-f.span/2))/f.span,head=((f.v+f.span/2)-f.high)/f.span;assert.ok(foot>.02&&foot<.12,`${h} ${name}: feet at ${foot.toFixed(3)} of the glass`);assert.ok(head>=.02);
   // The camera sits behind and above the point it looks at: sin(pitch) up for every cos(pitch) back.
   assert.ok(Math.abs(f.target[1]-f.v*c)<1e-9&&Math.abs(f.target[2]+f.v*s)<1e-9);
   if(name==='bare'&&glass==='mirror'){shares[h]=(f.high-f.low)/f.span;assert.ok(Math.abs(f.span-(3.75*c+s))<.02,'one size of glass for every plain look');}
  }
 }
 // The glass is sized once, for the tallest look, so the looks compare in it: the Grown-up takes the most glass, and
 // every look fills most of it without touching the frame. (From above a big head counts for as much as long legs:
 // the Tiny's is as deep as the Tall's whole figure is wide, so the short looks take about as much glass as the Tall.)
 for(const h of HEIGHTS){assert.ok(shares[h]>.7&&shares[h]<=.96,`${h} takes ${shares[h].toFixed(2)} of the glass`);if(h!=='grown')assert.ok(shares.grown>shares[h]+.05,`the Grown-up is taller in the glass than the ${h}`);}
 // A front view (the old picture, pitch about 6 degrees) and the game view differ as they should: from above the figure is foreshortened.
 const tall=new T.Box3(new T.Vector3(-.4,0,-.3),new T.Vector3(.4,2.6,.3)),front=mirrorFrame(tall,.7,{pitch:.1}),above=mirrorFrame(tall,.7);
 assert.ok(above.high-above.low<(front.high-front.low)*.9);assert.ok(above.span>=above.high-above.low);
 // Without `reach` the frame fits the figure: a wide one (a pet beside you) is fitted by its width.
 const wide=mirrorFrame(new T.Box3(new T.Vector3(-1.6,0,-.3),new T.Vector3(.5,2,.4)),.5);assert.ok(wide.span*.5>=2.1);assert.ok(Math.abs(wide.u+.55)<1e-9,'centred on the figure and its pet');
});
