// Debug actions are loaded after the playable frame, outside the initial bundle.
import {act} from './game.mjs';
import {outfitOf,outfitKey} from './outfits.mjs';
import {forceLavaEvent} from './lava-weather.mjs';
export function makeTestHook(world,{state,persist,hud,openPanel,music}){
 return {
  lavaEvent:id=>forceLavaEvent(id),
  skill:(denId,name)=>world.pandora.forceSkill(denId,name),
  defeat:denId=>world.pandora.defeatDen(denId),
  invulnerable:on=>world.pandora.setInvulnerable(on),
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
