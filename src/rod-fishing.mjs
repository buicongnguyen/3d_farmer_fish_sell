import {BANK,waterDistance,shorePoint,atBank} from './pond.mjs';
import * as T from 'three';

// Adapted from cute_game's held bamboo rod and in-world fishing presentation.
// Models share the existing fish kit; only the line and ripple use new geometry.
export class RodFishingView {
 constructor(world){
  this.world=world;this.sim=null;this.equipped=false;this.landing=null;this.casts=0;
  this.root=new T.Group();world.scene.add(this.root);
  this.rod=new T.Group();this.rod.name='family-fishing-rod';
  const material=c=>new T.MeshStandardMaterial({color:c,roughness:.8});
  const shaft=new T.Mesh(new T.CylinderGeometry(.023,.042,2.25,8),material('#ad8861'));shaft.position.y=1.08;this.rod.add(shaft);
  const grip=new T.Mesh(new T.CylinderGeometry(.065,.065,.36,8),material('#6b4a2e'));grip.position.y=.08;this.rod.add(grip);
  const reel=new T.Mesh(new T.CylinderGeometry(.115,.115,.09,10),material('#b9bda6'));reel.rotation.z=Math.PI/2;reel.position.set(.09,.24,0);this.rod.add(reel);
  this.tip=new T.Object3D();this.tip.name='rod-tip';this.tip.position.y=2.205;this.rod.add(this.tip);
  this.rod.rotation.x=1.05;
  this.bobber=world.sized('bobber',this.root,0,0,.5);this.bobber.visible=false;
  this.line=new T.Line(new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(new Float32Array(19*3),3)),new T.LineBasicMaterial({color:'#ffffff'}));this.line.visible=false;this.line.frustumCulled=false;this.root.add(this.line);
  this.ripple=new T.Mesh(new T.RingGeometry(.85,1,32),new T.MeshBasicMaterial({color:'#e5ffff',transparent:true,opacity:.6,side:T.DoubleSide,forceSinglePass:true,depthWrite:false}));this.ripple.rotation.x=-Math.PI/2;this.ripple.visible=false;this.root.add(this.ripple);
  this.tipPosition=new T.Vector3();this.castFrom=new T.Vector3();this.time=0;this.selected=null;this.slideX=0;this.slideY=0;this.sliding=false;
  // You can fish from anywhere along the bank (pond.mjs): standing at the water, the thing in reach is the pond itself,
  // unless something else you can use is nearer than the water. The spot follows you round the bank.
  this.spot={type:'fish',id:'pond',label:'Cast your fishing rod',x:0,z:0,y:0,r:BANK.r,location:'village'};
  const nearest=world.nearest.bind(world);
  world.nearest=()=>{const t=nearest();if(world.location!=='village'||world.riding||!world.player)return t;const p=world.player.position,d=waterDistance(p.x,p.z);if(d>BANK.reach)return t;
   if(t&&t.type!=='fish'&&t.type!=='chop'&&t.type!=='spot'&&Math.hypot(p.x-t.x,p.z-t.z)<d)return t;return this.bank(this.spot);};
 }
 /** The place on the bank nearest to you, as something to use: world.mjs sends you there when you tap the pond. */
 bank(out={...this.spot}){const p=this.world.player.position;shorePoint(p.x,p.z,out);out.r=out===this.spot?BANK.r:BANK.arrive;return out;}
 // A worn weapon (avatar.mjs: the 'weapon' group in the hand) is put away while the rod is out.
 stow(hand,show){const weapon=hand?.getObjectByName('weapon');if(weapon&&weapon.visible!==show)weapon.visible=show;}
 equip(){
  const player=this.world.player,hand=player.getObjectByName('hand-right');
  if(hand&&this.rod.parent!==hand)hand.add(this.rod);
  this.rod.visible=true;this.equipped=true;this.stow(hand,false);
 }
 start(sim){
  this.sim=sim;this.time=0;this.casts++;this.equip();
  this.world.player.rotation.y=Math.atan2(sim.cast.x-this.world.player.position.x,sim.cast.z-this.world.player.position.z);
  this.world.player.updateMatrixWorld(true);this.tip.getWorldPosition(this.castFrom);this.bobber.position.copy(this.castFrom);
  this.bobber.visible=true;this.line.visible=true;this.selected=null;
 }
 cancel(){this.line.material.color.setRGB(1,1,1);this.sim=null;this.selected=null;this.line.visible=false;this.bobber.visible=false;this.ripple.visible=false;this.world.animatePerson(this.world.player,0,0);}
 land(id){
  if(this.landing)this.landing.mesh.removeFromParent();
  const mesh=this.world.sized('fish_'+id,this.root,this.bobber.position.x,this.bobber.position.z,1,.4);
  this.landing={mesh,from:this.bobber.position.clone(),time:0};
 }
 // While you fish the camera stays where it is, as in the reference. Only when you or the float would sit off the screen or under
 // the HUD, the thumb stick or the Reel button does the picture slide, just far enough (a view offset on the village camera:
 // nothing in the world moves). The free part of the screen: below the HUD, above the thumbs on a tall phone, left of Reel elsewhere.
 frame(dt){
  const w=this.world,cam=w.camera,on=this.sim&&cam.isOrthographicCamera&&typeof innerWidth!=='undefined';let wantX=0,wantY=0;
  if(on){const W=innerWidth,H=innerHeight,p=w.player.position,me=w.project(p.x,p.z,1),float=w.project(this.sim.cast.x,this.sim.cast.z,.4);
   const tall=W<H*.8,x0=tall?40:W<1000?150:60,x1=tall?W-40:W-150,y0=Math.min(150,H*.36),y1=tall?H-270:H-70;
   // Where you and the float are without the slide, and the least slide that brings both into the free part (the float first).
   const fit=(a,b,lo,hi)=>{const min=Math.min(a,b),max=Math.max(a,b);return max-min>hi-lo?(b>a?hi-b:lo-b):max>hi?hi-max:min<lo?lo-min:0;};
   wantX=fit(me.x-this.slideX,float.x-this.slideX,x0,x1);wantY=fit(me.y-this.slideY,float.y-this.slideY,y0,y1);}
  else if(!this.sliding)return;
  const k=1-Math.exp(-dt*5);this.slideX+=(wantX-this.slideX)*k;this.slideY+=(wantY-this.slideY)*k;
  if(!on&&Math.abs(this.slideX)<.5&&Math.abs(this.slideY)<.5){this.slideX=this.slideY=0;this.sliding=false;if(cam.isOrthographicCamera)cam.clearViewOffset();return;}
  if(cam.isOrthographicCamera){this.sliding=true;cam.setViewOffset(innerWidth,innerHeight,-this.slideX,-this.slideY,innerWidth,innerHeight);}
 }
 update(dt,time){
  this.frame(dt);
  const w=this.world,player=w.player,near=w.location==='village'&&!w.riding&&atBank(player.position.x,player.position.z); // the rod is in your hand exactly where you can cast: at the pond's border
  if(near||this.sim)this.equip();else{if(this.equipped)this.stow(player.getObjectByName('hand-right'),true);this.rod.visible=false;this.equipped=false;}
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
  // A sagging line while you wait; taut, reddening and trembling with the tension while you reel (the only tension gauge there is).
  const positions=this.line.geometry.getAttribute('position'),hooked=s.phase==='hooked',tension=hooked?Math.min(1,s.tension):0,tremble=tension*.06;this.line.material.color.setRGB(1,1-tension*.75,1-tension*.9);
  for(let i=0;i<19;i++){const k=i/18,p=this.tipPosition.clone().lerp(this.bobber.position.clone().add(new T.Vector3(0,.15,0)),k);p.y-=Math.sin(k*Math.PI)*((hooked?.04:.26)-tremble*Math.sin(time*60+i*2));positions.setXYZ(i,p.x,p.y,p.z);}
  positions.needsUpdate=true;
 }
 get metrics(){return{casts:this.casts,equipped:this.equipped,rod:this.rod.visible&&this.equipped,line:this.line.visible,bobber:this.bobber.visible,phase:this.sim?.phase??'idle',progress:this.sim?.progress??0,tension:this.sim?.tension??0,strained:!!this.sim?.strained,surge:this.sim?.surge??0,landing:!!this.landing,tip:{x:this.tipPosition.x,y:this.tipPosition.y,z:this.tipPosition.z},float:{x:this.bobber.position.x,y:this.bobber.position.y,z:this.bobber.position.z}};}
}
