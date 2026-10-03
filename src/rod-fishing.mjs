import {FISH_SPOT} from './content.mjs';
import * as T from 'three';

// Adapted from cute_game's held bamboo rod and in-world fishing presentation.
// Models share the existing fish kit; only the line and ripple use new geometry.
export class RodFishingView {
 constructor(world){
  this.world=world;this.sim=null;this.equipped=false;this.landing=null;
  this.root=new T.Group();world.scene.add(this.root);
  this.rod=new T.Group();this.rod.name='family-fishing-rod';
  const material=c=>new T.MeshStandardMaterial({color:c,roughness:.8});
  const shaft=new T.Mesh(new T.CylinderGeometry(.023,.042,2.25,8),material('#ad8861'));shaft.position.y=1.08;this.rod.add(shaft);
  const grip=new T.Mesh(new T.CylinderGeometry(.065,.065,.36,8),material('#6b4a2e'));grip.position.y=.08;this.rod.add(grip);
  const reel=new T.Mesh(new T.CylinderGeometry(.115,.115,.09,10),material('#b9bda6'));reel.rotation.z=Math.PI/2;reel.position.set(.09,.24,0);this.rod.add(reel);
  this.tip=new T.Object3D();this.tip.name='rod-tip';this.tip.position.y=2.205;this.rod.add(this.tip);
  this.rod.rotation.x=1.05;
  this.bobber=world.sized('bobber',this.root,0,0,.5);this.bobber.visible=false;
  this.line=new T.Line(new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(new Float32Array(19*3),3)),new T.LineBasicMaterial({color:'#fff6d9'}));this.line.visible=false;this.line.frustumCulled=false;this.root.add(this.line);
  this.ripple=new T.Mesh(new T.RingGeometry(.85,1,32),new T.MeshBasicMaterial({color:'#e5ffff',transparent:true,opacity:.6,side:T.DoubleSide,depthWrite:false}));this.ripple.rotation.x=-Math.PI/2;this.ripple.visible=false;this.root.add(this.ripple);
  this.tipPosition=new T.Vector3();this.castFrom=new T.Vector3();this.time=0;this.selected=null;
 }
 equip(){
  const player=this.world.player,hand=player.getObjectByName('hand-right');
  if(hand&&this.rod.parent!==hand)hand.add(this.rod);
  this.rod.visible=true;this.equipped=true;
 }
 start(sim){
  this.sim=sim;this.time=0;this.equip();
  this.world.player.rotation.y=Math.atan2(sim.cast.x-this.world.player.position.x,sim.cast.z-this.world.player.position.z);
  this.world.player.updateMatrixWorld(true);this.tip.getWorldPosition(this.castFrom);this.bobber.position.copy(this.castFrom);
  this.bobber.visible=true;this.line.visible=true;this.selected=null;
 }
 cancel(){this.sim=null;this.selected=null;this.line.visible=false;this.bobber.visible=false;this.ripple.visible=false;this.world.animatePerson(this.world.player,0,0);}
 land(id){
  if(this.landing)this.landing.mesh.removeFromParent();
  const mesh=this.world.sized('fish_'+id,this.root,this.bobber.position.x,this.bobber.position.z,1,.4);
  this.landing={mesh,from:this.bobber.position.clone(),time:0};
 }
 update(dt,time){
  const w=this.world,player=w.player,near=w.location==='village'&&!w.riding&&Math.hypot(player.position.x-FISH_SPOT.x,player.position.z-FISH_SPOT.z)<6;
  if(near||this.sim)this.equip();else{this.rod.visible=false;this.equipped=false;}
  const right=player.getObjectByName('arm-right'),left=player.getObjectByName('arm-left');
  if(this.equipped&&!this.sim&&right)right.rotation.x=-.35;
  if(this.landing){const l=this.landing;l.time+=dt;const k=Math.min(1,l.time/.85);l.mesh.position.copy(l.from).lerp(player.position.clone().add(new T.Vector3(0,1.3,0)),k);l.mesh.position.y+=Math.sin(k*Math.PI)*2.2;l.mesh.rotation.z=time*7;if(k===1){l.mesh.removeFromParent();this.landing=null;}}
  if(!this.sim)return;
  const s=this.sim;this.time+=dt;
  if(right)right.rotation.x=s.phase==='cast'?-2.4+Math.min(1,this.time/.5)*1.7:s.phase==='hooked'?-.95-Math.sin(time*12)*s.tension*.12:-.7;
  if(left)left.rotation.x=s.phase==='cast'?-1.8+Math.min(1,this.time/.5):s.phase==='hooked'?-.85+Math.sin(time*10)*.18:-.6;
  player.updateMatrixWorld(true);this.tip.getWorldPosition(this.tipPosition);
  const target=new T.Vector3(s.cast.x,.41,s.cast.z);
  if(s.phase==='cast'){const k=Math.min(1,this.time/.5);this.bobber.position.copy(this.castFrom).lerp(target,k);this.bobber.position.y+=Math.sin(k*Math.PI)*1.6;}
  else{
   if(s.phase==='hooked')target.lerp(player.position.clone().lerp(target,.22).setY(.42),s.progress);
   this.bobber.position.copy(target);this.bobber.position.y+=Math.sin(time*3)*.035;
   if(s.phase==='nibble'&&s.dart>0)this.bobber.position.y-=Math.sin(s.dart/.3*Math.PI)*.13;
   if(s.phase==='bite')this.bobber.position.y=.24+Math.sin(time*24)*.025;
   if(s.phase==='hooked')this.bobber.position.x+=Math.sin(time*9)*s.surge*.28;
  }
  this.bobber.rotation.z=Math.sin(time*3)*.13;
  this.ripple.visible=s.phase!=='cast';this.ripple.position.set(this.bobber.position.x,.325,this.bobber.position.z);this.ripple.scale.setScalar(.3+(time*(s.phase==='bite'?2:1)%1)*.9);this.ripple.material.opacity=.55*(1-time%1);
  if(s.pick&&!this.selected)this.selected=w.fishes.find(f=>f.id===s.pick.id)??w.fishes[0];
  if(this.selected){const f=this.selected,away=s.phase==='approach'?s.fishDistance:s.phase==='nibble'?.5-s.dart:.1;f.mesh.position.set(this.bobber.position.x+away,.25,this.bobber.position.z+.1);f.mesh.rotation.y=-Math.PI/2+Math.sin(time*12)*.15;}
  const positions=this.line.geometry.getAttribute('position');
  for(let i=0;i<19;i++){const k=i/18,p=this.tipPosition.clone().lerp(this.bobber.position.clone().add(new T.Vector3(0,.15,0)),k);p.y-=Math.sin(k*Math.PI)*(s.phase==='hooked'?.04:.26);positions.setXYZ(i,p.x,p.y,p.z);}
  positions.needsUpdate=true;
 }
 get metrics(){return{equipped:this.equipped,rod:this.rod.visible&&this.equipped,line:this.line.visible,bobber:this.bobber.visible,phase:this.sim?.phase??'idle',progress:this.sim?.progress??0,tension:this.sim?.tension??0,surge:this.sim?.surge??0,landing:!!this.landing,tip:{x:this.tipPosition.x,y:this.tipPosition.y,z:this.tipPosition.z},float:{x:this.bobber.position.x,y:this.bobber.position.y,z:this.bobber.position.z}};}
}
