import {lowestFoot} from './avatar.mjs';
import {regionAt} from './regions.mjs';
import {HOUSES} from './content.mjs';
import {denStatuses} from './minimap.mjs';
import {cageStatuses} from './friends.mjs';
// Debug actions are loaded after the playable frame, outside the initial bundle.
import {act} from './game.mjs';
import {outfitOf,outfitKey} from './outfits.mjs';
import {forceLavaEvent,lavaEvent} from './lava-weather.mjs';
export function makeTestHook(world,{state,persist,hud,openPanel,music}){
 return {
  lavaEvent:id=>forceLavaEvent(id),
  skill:(denId,name)=>world.pandora.forceSkill(denId,name),
  defeat:denId=>world.pandora.defeatDen(denId),
  invulnerable:on=>world.pandora.setInvulnerable(on),
  // Browser suites (disguise-fx): the nearest n creatures (no boss, no titan) set d metres in front of you, and what the kits have out.
  near:(d=2.5,n=1,hp=0)=>{const p=world.player.position,f=world.player.rotation.y,list=world.pandora.wilds.list.filter(e=>e.hp>0&&!e.def.boss&&!e.titan&&e.def.behavior!=='titan').sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z)).slice(0,n);list.forEach((e,i)=>{const a=f+(i-(list.length-1)/2)*.5;e.x=p.x+Math.sin(a)*d;e.z=p.z+Math.cos(a)*d;e.kx=e.kz=0;if(hp>0)e.hp=e.maxHp=hp;});return list.map(e=>({id:e.id,type:e.type,hp:e.hp,maxHp:e.maxHp}));},
  // ... and the four ways a fight ends under you: a blow (a share of your full health), a house door, a car seat, the way Home.
  hurt:share=>world.pandora.hurtFraction(share,'test'),house:(id=0)=>world.enterHouse(id),leave:()=>world.exit(),board:id=>world.board(id),dismount:()=>world.dismount(),home:()=>world.goHome(),
  fight:()=>{const c=world.pandora.combat,fx=world.pandora.fx,zp=fx.zp,p=world.player.position;return {d:{...(c.d??{})},mode:c.mode,invulnerable:c.invulnerable,taken:c.taken??1,weapon:c.host.weapon().kind,range:c.host.weapon().range,hand:world.player.getObjectByName('weapon')?.userData.weapon??'',allies:(c.al??[]).filter(a=>a.live).map(a=>({kind:a.kind,x:a.x,z:a.z,hp:a.hp,maxHp:a.maxHp,life:a.life})),shots:c.shots.filter(s=>s.live).map(s=>s.kind),paint:zp?{ready:zp.ready,solid:zp.solid?.n??0,glow:zp.glow?.n??0,add:zp.add?.n??0,shocked:zp.shockN??0,dome:zp.dome?.n??0,ribbons:zp.ribbons?.count??0,casts:zp.casts.filter(k=>k.live).length,most:zp.maxPainted}:null,pose:fx.hp?{on:fx.hp.on,cast:fx.hp.cast,fly:fx.hp.fly}:null,hero:{y:world.player.position.y,rx:world.player.rotation.x,rz:world.player.rotation.z,order:world.player.rotation.order,scale:world.player.scale.x,arm:world.player.userData.parts.arm_r.rotation.x,leg:world.player.userData.parts.leg_l.rotation.x,head:world.player.userData.parts.head.rotation.y},creatures:world.pandora.wilds.list.filter(e=>e.hp>0).map(e=>({id:e.id,type:e.type,hp:e.hp,maxHp:e.maxHp,dist:Math.hypot(e.x-p.x,e.z-p.z),sheep:e.sheep>0,charm:e.charm>0,mark:e.mark>0,stun:e.stun>0,slow:e.slow>0,lure:e.lure?.kind??'',phase:e.phase})).sort((a,b)=>a.dist-b.dist).slice(0,8)};},
  mark:(x,z,r,progress,hex)=>world.pandora.mark(x,z,r,progress,hex),
  portrait:async(wants,{walk=0}={})=>{const av=await import('./avatar.mjs'),mv=await import('./mirror-view.mjs');await av.preloadAvatar(world,wants);window.__pp??=new mv.MirrorPreview(world,{reach:3.75,width:260,height:380});const slot=document.createElement('div');slot.style.cssText='width:260px;height:380px;position:fixed;left:-999px';document.body.append(slot);window.__pp.reset();window.__pp.show(slot,Math.random()+'',()=>{const a=av.restPose(av.buildAvatar(world,wants));if(walk){a.userData.parts.leg_l.rotation.x=walk;a.userData.parts.leg_r.rotation.x=-walk;}return a;});const c=window.__pp.canvas,d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;slot.remove();let n=0;const m=new Uint8Array(c.width*c.height);for(let i=0;i<m.length;i++)if(d[i*4+3]>128){m[i]=1;n++;}return {w:c.width,h:c.height,area:n,rgb:(()=>{let s='';for(let i=0;i<d.length;i+=8192)s+=String.fromCharCode(...d.subarray(i,i+8192));return btoa(s);})(),mask:(()=>{let s='';for(let i=0;i<m.length;i+=8192)s+=String.fromCharCode(...m.subarray(i,i+8192));return btoa(s);})(),png:c.toDataURL('image/png')};}, // wardrobe suite: a picture of any look and clothes
  open:(name,arg)=>openPanel(name,arg), // browser suites open a panel directly (a phone cannot always reach the spot in the room)
  npc:id=>{const m=world.npcs.find(n=>n.p.id===id)?.mesh;if(!m)return null;let tris=0,meshes=0;m.traverse(o=>{if(o.isMesh){meshes++;tris+=o.geometry.getAttribute('position').count/3;}});return {meshes,outfit:m.userData.outfit??null,look:m.userData.look??null,pending:m.userData.pending,tris,x:m.position.x,z:m.position.z,screen:world.project(m.position.x,m.position.z,.8)};}, // what a villager wears now, and where on the screen
  family:()=>[...(world.__houseLife?.members.values()??[])].map(m=>({id:m.p.id,key:m.shirt,meshes:(()=>{let n=0;m.avatar.traverse(o=>{if(o.isMesh)n++;});return n;})()})), // the family at home and what each wears (house-life.mjs)
  stage:(ids,{gap=1.9,cols=6,depth=2.6}={})=>{world.stagedNpcs=!!ids;world.player.visible=!ids;const yaw=world.yaw,rx=Math.cos(yaw),rz=-Math.sin(yaw),p=world.player.position;world.npcs.forEach(n=>{const i=ids?ids.indexOf(n.p.id):-1;n.mesh.visible=i>=0||!ids&&!n.inside;if(i<0)return;const c=i%cols,r=Math.floor(i/cols),k=(c-(Math.min(cols,ids.length)-1)/2)*gap;n.mesh.position.set(p.x+rx*k+Math.sin(yaw)*(-depth*r),0,p.z+rz*k+Math.cos(yaw)*(-depth*r));n.mesh.rotation.y=yaw;n.mesh.userData.parts.arm_l.rotation.set(0,0,-.1);n.mesh.userData.parts.arm_r.rotation.set(0,0,.1);});},  // lines villagers up in front of the camera (null releases them)
  box:on=>{const r=act(state(),'pandora',{open:!!on});persist();world.sync();hud();return r.ok;}, // opens or shuts the Pandora box wherever you stand (village life stays the same)
  plain:async on=>{const av=await import('./avatar.mjs');for(const n of world.npcs){const w=on?{look:n.p.child||n.p.index%2===0?'girl-tall-none-none':'boy-tall-none-none',outfitColor:n.p.color,gear:{garment:'',hat:'',wear:'',boots:''}}:outfitOf(n.p,false,state()),shown=n.mesh.visible;n.mesh=av.reclothe(world,n.mesh,w);n.mesh.visible=shown;n.mesh.userData.outfit=on?'plain':outfitKey(w);}}, // the villagers as they were before outfits (a baseline for the budget measurement), or back in their outfits
  tryOn:o=>world.setTryOn(o), // ... and dress the character in anything ({look, gear: {garment, wear, hat…}, outfitColor}), never saved
  get music(){return music()?.test;},
 };
}

export function installProbe(world,{enterFacility,state,persist,hud,openPanel,music,pandora,minimap,mirror,wardrobe}){
 const cageList=[],denList=[];
 const metrics=()=>({
  ...world.metrics,
  location:world.location,
  ready:true,
  screen:world.project(world.player.position.x,world.player.position.z,1),
  npcs:world.npcs.length,
  households:HOUSES.length,
  position:{x:world.player.position.x,z:world.player.position.z},
  navigation:{remaining:world.path.length,pending:world.pending?.type,pendingId:world.pending?.id,nearest:world.nearest()?.type},
  region:world.location==='village'?regionAt(world.player.position.x,world.player.position.z):null, // a regions.mjs id, or null (indoors, beyond the map)
  riding:world.riding?.id??'', // '' | 'jeep' | 'bike'
  vehicles:state().vehicles, // {jeep, bike}: where each was left ({x, z, rot}), or null at its park spot
  heading:world.riding?.drive?.heading??state().heading,
  driveZoom:world.drive?.zoom??1,
  cameraTop:world.camera.top/world.camera.zoom, // the view's effective half-height in metres
  tiles:world.fields?.tiles.size??0,
  tilesPending:world.fields?.pending??0,
  calls:world.measureCalls?.()??null, // {calls, triangles} of the last counted frame, shadow pass included
  dens:denStatuses(pandora()?.wilds,denList), // [{id, type, titan, event, region, level, x, z, down, left}] (builder F)
  cages:cageStatuses(state(),cageList), // [{id, den, x, z, state}] (builder E)
  friends:state().friends,
  lavaEvent:(e=>({id:e.id,left:e.left}))(lavaEvent(Date.now()/1000)),
  journey:world.journey, // builder C's parts: {home, ring, fade, farShare, view, shadow, shadowPass, cameraFar, cameraDistance, fogNear, fogFar, fog, sky, sun, sunIntensity, land, landShare, edgeDepth, edgeDistance, edgeTold, wildDepth, landCalls}
 });
 const testHook=makeTestHook(world,{state,persist,hud,openPanel,music});
 window.willowmere={
  facility:id=>enterFacility?.(id), // enters a Town Square building from anywhere in the village (browser suites)
  snapshot:()=>structuredClone(state()),
  feet:()=>({low:lowestFoot(world.player),y:world.player.position.y,legs:[world.player.userData.parts.leg_l.rotation.x,world.player.userData.parts.leg_r.rotation.x],look:world.player.userData.lookId,swing:world.gait?.swing??0,blend:world.gait?.blend??0}),
  map:()=>({draws:minimap.draws,radius:minimap.radius,caption:minimap.caption,place:minimap.place,heading:minimap.heading}),
  calls:()=>world.measureCalls?.()??null,
  crops:()=>world.crops,
  targets:()=>world.activeTargets().map(t=>({type:t.type,id:t.id,label:t.label,position:{x:t.x,z:t.z},screen:t.location==='interior'&&t.hit?world.project(t.hit.position.x,t.hit.position.z,t.hit.position.y):world.project(t.x,t.z,.8)})),
  mirror:()=>({mirror:mirror.preview.framing,wardrobe:wardrobe.preview.framing,renders:mirror.preview.renders+wardrobe.preview.renders}),
  metrics,
  roomView:()=>world.__roomView,
 };
 // The test hook (spec 12.4): present only in test mode, for the three things a saved game cannot seed. lavaEvent is real;
 // skill, defeat and invulnerable call world.pandora's three no-ops until builder D fills them. mark asks for one telegraph disc for
 // this frame, as the lands and the titans do (world.pandora.mark); willowmere.wilds().marks says how many the last frame drew.
 Object.defineProperty(window.willowmere,'test',{enumerable:true,get:()=>state().settings.test===true?testHook:undefined});
}
