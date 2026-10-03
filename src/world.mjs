import * as T from 'three';
import {OpenFields,FieldBirds} from './fields.mjs';
import {OUTDOOR_LIMIT,HOMESTEAD,homeBearing,inVillage} from './field-layout.mjs';
import {findRoute} from './navigation.mjs';
import {RodFishingView} from './rod-fishing.mjs';
import {buildInteriorRoom} from './interior.mjs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HOUSES,CIVIC,ROADS,POND,FISH_SPOT,WORKPLACE,RESIDENTS,OUTFITS,KID_OUTFITS,BED_POSITIONS,ORCHARD_POSITIONS,RACE_POINTS,CROPS } from './content.mjs';
import { bedCount,ripe,cropProgress,calendar,CHOP_COST } from './game.mjs';

const mats=new Map();
const mat=c=>{if(!mats.has(c))mats.set(c,new T.MeshStandardMaterial({color:c,roughness:.88}));return mats.get(c);};
const cube=new T.BoxGeometry(1,1,1), sphere=new T.IcosahedronGeometry(1,1);
const v3=new T.Vector3(), dummy=new T.Object3D();
function box(parent,x,y,z,w,h,d,c){const m=new T.Mesh(cube,mat(c));m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function orb(parent,x,y,z,r,c){const m=new T.Mesh(sphere,mat(c));m.position.set(x,y,z);m.scale.setScalar(r);m.castShadow=true;parent.add(m);return m;}
function cylinder(parent,x,y,z,r,h,c,segments=12){const m=new T.Mesh(new T.CylinderGeometry(r,r,h,segments),mat(c));m.position.set(x,y,z);m.receiveShadow=true;parent.add(m);return m;}
function rng(seed=18){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
const rand=rng();
const flatMaterial=new T.MeshStandardMaterial({vertexColors:true,roughness:.85});
// Bake static coloured parts to one opaque draw, preserving authored surface normals.
function bake(source){
 source.updateMatrixWorld(true);const pieces=[],extra=[];
 source.traverse(m=>{if(!m.isMesh)return;const materials=Array.isArray(m.material)?m.material:[m.material];
   for(let j=0;j<materials.length;j++){const material=materials[j];if(material.transparent&&material.opacity<.9){const copy=m.clone();copy.geometry=m.geometry;copy.applyMatrix4(m.parent.matrixWorld);extra.push(copy);continue;}
     const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();const pos=g.getAttribute('position'),normal=g.getAttribute('normal');
     const group=Array.isArray(m.material)?g.groups.find(q=>q.materialIndex===j):null;if(Array.isArray(m.material)&&!group){g.dispose();continue;}
     const start=group?.start??0,count=group?.count??pos.count,geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos.array.slice(start*3,(start+count)*3),3));
     if(normal)geo.setAttribute('normal',new T.Float32BufferAttribute(normal.array.slice(start*3,(start+count)*3),3));else geo.computeVertexNormals();
     const colors=new Float32Array(count*3),c=material.color??new T.Color('white'),vc=material.vertexColors?g.getAttribute('color'):null;for(let i=0;i<count;i++)colors.set([c.r*(vc?vc.getX(i+start):1),c.g*(vc?vc.getY(i+start):1),c.b*(vc?vc.getZ(i+start):1)],i*3);geo.setAttribute('color',new T.BufferAttribute(colors,3));geo.applyMatrix4(m.matrixWorld);pieces.push(geo);g.dispose();
   }
 });
 const out=new T.Group();if(pieces.length){const g=mergeGeometries(pieces);pieces.forEach(p=>p.dispose());const m=new T.Mesh(g,flatMaterial);m.castShadow=true;m.receiveShadow=true;out.add(m);}extra.forEach(m=>out.add(m));return out;
}
// Bake a kit node with some materials recoloured, e.g. each family's roof.
function bakeTinted(node,tints){const root=new T.Group(),copy=node.clone(true);copy.position.set(0,0,0);copy.traverse(m=>{if(!m.isMesh)return;m.material=(Array.isArray(m.material)?m.material:[m.material]).map(x=>{const c=x.clone();if(tints[x.name])c.color=new T.Color(tints[x.name]);return c;});if(m.material.length===1)m.material=m.material[0];});root.add(copy);return bake(root);}
function labelTexture(text){const c=document.createElement('canvas');c.width=512;c.height=100;const g=c.getContext('2d');g.fillStyle='#fcf7e9';g.beginPath();g.roundRect(3,3,506,90,32);g.fill();g.font='800 32px Nunito, sans-serif';g.textAlign='center';g.fillStyle='#385340';g.fillText(text,256,61,470);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;}

export class World{
 constructor(canvas,state,onInteract){
  this.canvas=canvas;this.state=state;this.onInteract=onInteract;this.scene=new T.Scene();this.scene.background=new T.Color('#9fdcff');this.scene.fog=new T.Fog('#bfe8ff',80,160);
  this.renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.NeutralToneMapping;this.renderer.toneMappingExposure=1.05;
  this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.camera=new T.OrthographicCamera(-30,30,20,-20,.1,220);this.zoom=21;this.follow=new T.Vector3(-12,0,3);this.yaw=.38;
  this.ambient=new T.HemisphereLight('#f4fbff','#4f9a3a',1.9);this.scene.add(this.ambient);this.sun=new T.DirectionalLight('#fff4dc',3.2);this.sun.position.set(-24,42,22);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-48,right:48,top:48,bottom:-48,near:1,far:120});this.sun.shadow.bias=-.0005;this.sun.shadow.normalBias=.04;this.scene.add(this.sun);this.scene.add(this.sun.target);
  this.outside=new T.Group();this.inside=new T.Group();this.country=new T.Group();this.scene.add(this.outside,this.inside,this.country);this.inside.visible=false;this.country.visible=false;this.location='village';this.houseId=null;
  const rainPositions=new Float32Array(120*6);this.rainGeometry=new T.BufferGeometry();this.rainGeometry.setAttribute('position',new T.BufferAttribute(rainPositions,3));this.rain=new T.LineSegments(this.rainGeometry,new T.LineBasicMaterial({color:'#d8eeee',transparent:true,opacity:.55}));this.rain.frustumCulled=false;this.rain.visible=false;this.scene.add(this.rain);
  this.assets=new Map();this.raw=new Map();this.targets=[];this.colliders=[];this.keys=new Set();this.stick={x:0,y:0};this.path=[];this.pending=null;this.npcs=[];this.animals=[];this.fishes=[];this.markers=[];this.labels=[];this.vehicles=[];this.riding=null;this.particles=[];this.t=0;this.lastSync='';this.paused=true;this.ready=false;this.cropViews=[];this.treeViews=[];this.raycast=new T.Raycaster();this.pointer=new T.Vector2();this.plane=new T.Plane(new T.Vector3(0,1,0),0);this.interactTimer=0;
  this.applyQuality();this.resize();window.addEventListener('resize',()=>this.resize());
  canvas.addEventListener('wheel',e=>{e.preventDefault();this.zoom=T.MathUtils.clamp(this.zoom+e.deltaY*.018,12,42);this.resize();},{passive:false});
  let down=null;canvas.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};});canvas.addEventListener('pointerup',e=>{if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<12&&!this.paused)this.click(e);down=null;});
 }
 applyQuality(){const q=this.state.settings.quality;this.renderer.setPixelRatio(Math.min(devicePixelRatio,q==='high'?2:q==='battery'?1:1.5));this.renderer.shadowMap.enabled=q!=='battery';if(this.sun){this.sun.shadow.mapSize.set(q==='high'?2048:1024,q==='high'?2048:1024);this.sun.shadow.map?.dispose();this.sun.shadow.map=null;}this.resize();}
 resize(){const w=innerWidth,h=innerHeight;this.renderer.setSize(w,h,false);const aspect=w/h,scale=this.location==='interior'?(aspect<.8?19:10):this.fishing?(aspect<.8?12:11):Math.max(this.zoom,aspect<.8?23:0);this.camera.left=-scale*aspect;this.camera.right=scale*aspect;this.camera.top=scale;this.camera.bottom=-scale;this.camera.updateProjectionMatrix();}
 async init(progress){
  const files=['rural','town','scenery','farm','fish','house','crops','fruit_crops','hero-tall','hero-girl-tall','market-stall','equipment-stall','well','kitchen','storage-chest','garden-bed','jeep','motorcycle','forest-birds','field-gull'];let n=0;
  await Promise.all(files.map(async name=>{let gltf;try{gltf=await new GLTFLoader().loadAsync(`./assets/models/${name}.glb`);}catch(error){if(name!=='rural')throw error;progress(++n/files.length);return;}this.raw.set(name,gltf.scene);
   if(['rural','town','scenery','farm','fish','house','crops','fruit_crops'].includes(name)){for(const child of gltf.scene.children){const root=new T.Group(),copy=child.clone(true);copy.position.set(0,0,0);root.add(copy);this.assets.set(child.name,bake(root));}}
   else if(!name.startsWith('hero')&&!['forest-birds','field-gull'].includes(name)){if(name==='jeep')gltf.scene.getObjectByName('jeep_Turret')?.removeFromParent();this.assets.set(name,bake(gltf.scene));}progress(++n/files.length);
  }));
  this.buildVillage();this.buildCountry();this.fields=new OpenFields(this);this.birds=new FieldBirds(this,bake);this.rodFishing=new RodFishingView(this);this.player=this.character(this.state.body==='boy'?'hero-tall':'hero-girl-tall',OUTFITS.find(o=>o.id===this.state.outfit).color);this.player.scale.multiplyScalar(.88);this.scene.add(this.player);this.player.position.set(this.state.position.x,0,this.state.position.z);if(this.blocked(this.player.position.x,this.player.position.z))this.player.position.set(0,0,-8);
  this.playerRing=new T.Mesh(new T.RingGeometry(.67,.83,40),new T.MeshBasicMaterial({color:'#fff2be',transparent:true,opacity:.7,side:T.DoubleSide}));this.playerRing.rotation.x=-Math.PI/2;this.scene.add(this.playerRing);
  this.targetRing=new T.Mesh(new T.RingGeometry(.8,1,36),new T.MeshBasicMaterial({color:'#ffe4a1',transparent:true,opacity:.85,side:T.DoubleSide}));this.targetRing.rotation.x=-Math.PI/2;this.targetRing.visible=false;this.scene.add(this.targetRing);
  this.fields.update(this.player.position);this.makeCropSprites();this.sync(true);this.follow.copy(this.player.position);this.ready=true;
 }
 asset(name,parent,x,z,scale=1,y=0,rotation=0){const src=this.assets.get(name);if(!src)return new T.Group();const o=src.clone(true);o.position.set(x,y,z);o.scale.setScalar(scale);o.rotation.y=rotation;parent.add(o);return o;}
 sized(name,parent,x,z,size,y=0,rotation=0){const src=this.assets.get(name);if(!src)return new T.Group();const bounds=new T.Box3().setFromObject(src),dim=bounds.getSize(new T.Vector3());return this.asset(name,parent,x,z,size/Math.max(dim.x,dim.z,dim.y),y,rotation);}
 mounted(name,parent,x,z,size,centerY){const src=this.assets.get(name),bounds=new T.Box3().setFromObject(src),dim=bounds.getSize(new T.Vector3()),scale=size/Math.max(dim.x,dim.y,dim.z);return this.asset(name,parent,x,z,scale,centerY-bounds.getCenter(new T.Vector3()).y*scale);}
 character(model,color){const root=this.raw.get(model).clone(true);root.traverse(m=>{if(m.isMesh){const list=Array.isArray(m.material)?m.material:[m.material],g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone(),count=g.getAttribute('position').count,colors=new Float32Array(count*3),shirts=[];const groups=g.groups.length?g.groups:[{start:0,count,materialIndex:0}];for(const group of groups){const source=list[group.materialIndex]??list[0],c=/shirt/i.test(source.name)?new T.Color(color):source.color;for(let i=group.start;i<group.start+group.count;i++){colors.set([c.r,c.g,c.b],i*3);if(/shirt/i.test(source.name))shirts.push(i);}}g.setAttribute('color',new T.BufferAttribute(colors,3));g.clearGroups();m.geometry=g;m.material=flatMaterial;m.userData.shirtVertices=shirts;m.userData.ownedGeometry=true;m.castShadow=true;}});const leaf=root.getObjectByName('head-leaf');if(leaf)leaf.visible=false;root.scale.set(.85,1,.85);root.userData.limbs=['arm-left','arm-right','leg-left','leg-right'].map(k=>root.getObjectByName(k));return root;}
 animatePerson(person,amount,phase){person.userData.limbs.forEach((limb,i)=>{if(limb)limb.rotation.x=Math.sin(phase+(i%2?Math.PI:0))*amount;});}
 target(type,id,label,x,z,r=2,parent=this.outside,y=0){const spot={type,id,label,x,z,y,r,location:parent===this.outside?'village':parent===this.country?'country':'interior'};const hit=new T.Mesh(new T.BoxGeometry(r*1.4,type==='house'?5:2.5,r*1.4),new T.MeshBasicMaterial());hit.position.set(x,y+1.1,z);hit.visible=false;hit.userData.target=spot;parent.add(hit);spot.hit=hit;this.targets.push(spot);return spot;}
 sign(parent,text,x,z,y=3.4){const texture=labelTexture(text),sprite=new T.Sprite(new T.SpriteMaterial({map:texture,depthTest:false,toneMapped:false}));sprite.position.set(x,y,z);sprite.scale.set(6.4,1.25,1);parent.add(sprite);this.labels.push(sprite);return sprite;}
 collider(x,z,w,d,location='village'){this.colliders.push({x,z,w,d,location});}
 ground(parent,w,d,color){const ground=box(parent,0,-.3,0,w,.6,d,color);ground.castShadow=false;return ground;}
 // Family houses: rural farmhouses when the rural kit is present, otherwise the town kit.
 houseNode(h){return this.raw.get('rural')?.getObjectByName(h.rural??'')??this.raw.get('town').getObjectByName(h.style);}
 front(h){return {x:Math.sin(h.rot??0),z:Math.cos(h.rot??0)};}
 buildHouse(h){const g=new T.Group();g.position.set(h.x,0,h.z);g.rotation.y=h.rot??0;this.outside.add(g);
  g.add(bakeTinted(this.houseNode(h),{'Roof':h.color,'Roof Trim':h.trim,'Accent':h.accent,'Siding':h.siding}));
  const f=this.front(h),side=Math.abs(f.x)>.5;this.collider(h.x,h.z,side?6.6:8,side?8:6.6);this.target('house',h.id,`Enter ${h.name}`,h.x+f.x*4.7,h.z+f.z*4.7,2);h.group=g;
  this.sign(this.outside,h.family.toUpperCase(),h.x,h.z,7.2);return g;
 }
 // The leader's homestead grows from a log cabin to a big farmhouse with the house upgrades.
 homeModel(level){const rural=this.raw.get('rural'),node=rural?.getObjectByName('home_t'+level);if(node)return bakeTinted(node,{'Roof':'#EF5A3C','Roof Trim':'#B9372A','Accent':'#38A8EE','Siding':'#FFF4DE'});const o=bakeTinted(this.raw.get('town').getObjectByName(['house_round','house_hip','house_gable','house_tall'][level]),{'Roof':'#EF5A3C','Roof Trim':'#B9372A','Accent':'#38A8EE'});o.scale.setScalar([.8,.92,1,1.08][level]);return o;}
 buildHome(){const h=HOUSES[0],g=new T.Group();g.position.set(h.x,0,h.z);this.outside.add(g);h.group=g;this.homeLevel=-1;this.collider(h.x,h.z,9.4,6.8);this.target('house',0,`Enter ${h.name}`,h.x,h.z+5,2.2);this.sign(this.outside,'HOME · VILLAGE LEADER',h.x,h.z,8.6);this.refreshHome();}
 refreshHome(){const level=this.state.upgrades.house,g=HOUSES[0].group;if(!g||level===this.homeLevel)return;this.homeLevel=level;for(const c of [...g.children]){c.traverse(m=>{if(m.isMesh)m.geometry.dispose();});g.remove(c);}g.add(this.homeModel(level));}
 buildCivic(c){this.asset(c.id,this.outside,c.x,c.z);this.collider(c.x,c.z,c.w,c.d);this.target('civic',c.id,c.verb,c.x,c.z+c.d/2+1.8,2.2);this.sign(this.outside,c.name.toUpperCase(),c.x,c.z-1,c.h);}
 // A white picket fence or split-rail fence from (x1,z1) to (x2,z2), in kit segments.
 fence(x1,z1,x2,z2,kind='picket_fence',gap=null){const len=Math.hypot(x2-x1,z2-z1),seg=kind==='picket_fence'?2:2.5,n=Math.max(1,Math.round(len/seg)),angle=Math.atan2(-(z2-z1),x2-x1);
  for(let i=0;i<n;i++){const t=(i+.5)/n,x=x1+(x2-x1)*t,z=z1+(z2-z1)*t;if(gap&&Math.hypot(x-gap.x,z-gap.z)<gap.r)continue;
   if(this.assets.has(kind)){const o=this.asset(kind,this.outside,x,z,1,0,angle);o.scale.x=len/n/seg;}
   else{const g=new T.Group();g.position.set(x,0,z);g.rotation.y=angle;this.outside.add(g);for(const y of [.35,.7])box(g,0,y,0,len/n,.08,.06,'#fffaf0');for(let k=0;k<5;k++)box(g,-len/n/2+.2+k*(len/n-.4)/4,.45,0,.14,.9,.06,'#fffaf0');}}}
 mailbox(x,z,rot=0){if(this.assets.has('mailbox')){this.asset('mailbox',this.outside,x,z,1,0,rot);return;}const g=new T.Group();g.position.set(x,0,z);g.rotation.y=rot;this.outside.add(g);box(g,0,.55,0,.12,1.1,.12,'#8a4b25');box(g,0,1.15,0,.36,.34,.62,'#3f6fd8');box(g,.2,1.3,.1,.04,.28,.06,'#ef3b3b');}
 buildVillage(){
  const R=ROADS,flat=(x,z,w,d,c,y=.008)=>{const p=box(this.outside,x,y,z,w,.02,d,c);p.castShadow=false;return p;};
  this.groundMesh=this.ground(this.outside,1024,1024,'#5cc93a');
  // The county road: an asphalt ring with a dashed yellow centre line.
  const road=(x,z,w,d)=>{flat(x,z,w,d,'#6c7486',.01);const along=w>d,len=along?w:d;for(let t=-len/2+2;t<len/2-1.5;t+=4)flat(along?x+t:x,along?z:z+t,along?1.8:.24,along?.24:1.8,'#ffd23f',.024);};
  road(0,R.north,R.east*2+5,5);road(0,R.south,R.east*2+5,5);road(R.west,(R.north+R.south)/2,5,R.south-R.north-5);road(R.east,(R.north+R.south)/2,5,R.south-R.north-5);road(R.east+8,0,11,5);
  const gravel='#f2d38e';
  // Homestead lanes: front lane to the south road, a farm track to the barn and the pond.
  flat(0,(-10+R.south)/2,3.4,R.south-(-10),gravel);flat(10,-11.5,18,2.6,gravel);flat(6,12.2,10,2.4,gravel);flat(0,(R.north+(-17.5))/2,2.6,R.north*-1-17.5,gravel);
  for(const c of CIVIC)this.buildCivic(c);
  // Families live by the border, set well back behind lawns, fences and a mailbox.
  for(const h of HOUSES.slice(1)){this.buildHouse(h);const f=this.front(h),side=Math.abs(f.x)>.5;
   const roadX=f.x>.5?R.east:f.x<-.5?R.west:h.x,roadZ=side?h.z:f.z>0?R.south:R.north;const sx=h.x+f.x*3.5,sz=h.z+f.z*3.5;
   if(side)flat((sx+roadX)/2,h.z,Math.abs(roadX-sx),2.6,gravel);else flat(h.x,(sz+roadZ)/2,2.6,Math.abs(roadZ-sz),gravel);
   const fx=roadX-f.x*4.2,fz=roadZ-f.z*4.2,px=-f.z,pz=f.x;
   this.fence(fx-px*10,fz-pz*10,fx+px*10,fz+pz*10,'picket_fence',{x:side?fx:h.x,z:side?h.z:fz,r:2});
   this.mailbox(fx+px*2.4-f.x*.2,fz+pz*2.4-f.z*.2,h.rot+Math.PI);
   if(this.assets.has('barn')&&h.barn){const bx=h.x-f.x*11,bz=h.z-f.z*11;this.asset('barn',this.outside,bx,bz,1,0,h.rot);this.collider(bx,bz,side?7.4:8.4,side?8.4:7.4);}}
  // ---- The Rowan homestead in the middle of the village.
  this.buildHome();this.fence(-6,-6.4,6,-6.4,'picket_fence',{x:0,z:-6.4,r:1.8});
  this.mailbox(2.4,R.south-3.4,Math.PI);this.sign(this.outside,'THE FAMILY FIELDS',-15,-5.5);
  // Rectangular pond with a sandy rim, reeds and a little dock.
  const rim=box(this.outside,POND.x,.04,POND.z,POND.w+1.6,.12,POND.d+1.6,'#f6dc96');rim.castShadow=false;const bed=box(this.outside,POND.x,.1,POND.z,POND.w,.14,POND.d,'#2f9fd0');bed.castShadow=false;
  this.water=new T.Mesh(new T.PlaneGeometry(POND.w,POND.d),new T.MeshPhysicalMaterial({color:'#5fd0f5',transparent:true,opacity:.5,roughness:.25,metalness:.12}));this.water.rotation.x=-Math.PI/2;this.water.position.set(POND.x,.3,POND.z);this.outside.add(this.water);this.collider(POND.x,POND.z,POND.w,POND.d);
  if(this.assets.has('pond_dock'))this.asset('pond_dock',this.outside,FISH_SPOT.x,POND.z+POND.d/2+.4,1,0,Math.PI);for(let i=0;i<6;i++)box(this.outside,FISH_SPOT.x-1.25+i*.5,.38,POND.z+POND.d/2+1.2,.46,.2,2.6,'#b8743c');for(const x of [FISH_SPOT.x-1.4,FISH_SPOT.x+1.4])for(const z of [POND.z+POND.d/2+.2,POND.z+POND.d/2+2.3])cylinder(this.outside,x,.55,z,.1,1.2,'#8a4b25',8);
  this.target('fish','pond','Cast your fishing rod',FISH_SPOT.x,FISH_SPOT.z,2.4);this.sign(this.outside,'THE FAMILY POND',POND.x,POND.z-2);
  for(let i=0;i<14;i++){const t=i/14,edge=i%4,x=edge<2?POND.x-POND.w/2+t*POND.w:edge===2?POND.x-POND.w/2-.2:POND.x+POND.w/2+.2,z=edge===0?POND.z-POND.d/2-.2:edge===1?POND.z+POND.d/2+.2:POND.z-POND.d/2+t*POND.d;if(Math.abs(x-FISH_SPOT.x)<2&&z>POND.z)continue;this.asset('reeds',this.outside,x,z,.7);}
  for(let i=0;i<6;i++)this.asset('lily_pad',this.outside,POND.x-5+i*2,POND.z+Math.sin(i*2.1)*2.6,.7,.34);
  ['perch','carp','koi','perch','catfish','koi'].forEach((id,i)=>{const fish=this.sized('fish_'+id,this.outside,POND.x,POND.z,.85,.21);this.fishes.push({id,mesh:fish,phase:i*1.7,r:1.6+i*.55});});
  this.sized('well',this.outside,-6,-9,3.1);this.collider(-6,-9,2.3,2.3);
  this.sized('market-stall',this.outside,5.5,21,4.4);this.target('shop','market','Browse the village market',5.5,23.2,2.1);this.sign(this.outside,'VILLAGE MARKET',5.5,20.5);
  const finch=HOUSES[5],vale=HOUSES[7];
  this.sized('equipment-stall',this.outside,finch.x+3,finch.z+9,3.6,0,-Math.PI/2);this.target('shop','clothes','Visit the Finch atelier',finch.x+.6,finch.z+9,2);
  this.sized('storage-chest',this.outside,vale.x+3,vale.z+8,1.7);this.target('shop','upgrades','Visit the Vale workshop',vale.x+.8,vale.z+8,2.1);
  // Village green with the supper table and pennants.
  const green={x:22,z:28};this.target('festival','supper','Harvest supper & village run',green.x,green.z,2.5);this.sized('dining_table',this.outside,green.x,green.z,3.8);for(const x of [green.x-2.5,green.x+2.5])this.sized('chair',this.outside,x,green.z,1.3);this.sign(this.outside,'THE VILLAGE GREEN',green.x,green.z);
  for(const x of [green.x-7,green.x+8])box(this.outside,x,2.1,green.z+3,.13,4.2,.13,'#8d7857');for(let i=0;i<12;i++){const g=new T.BufferGeometry().setFromPoints([new T.Vector3(-.4,0,0),new T.Vector3(.4,0,0),new T.Vector3(0,-.75,0)]);g.computeVertexNormals();const m=new T.Mesh(g,new T.MeshBasicMaterial({color:['#ff5c8a','#ffc83a','#35b6f2','#5ccf3c'][i%4],side:T.DoubleSide}));m.position.set(green.x-7+i*1.36,3.8-Math.sin(i/11*Math.PI)*.4,green.z+3);this.outside.add(m);}
  for(let i=0;i<30;i++){const p=BED_POSITIONS[i],soil=new T.Group();box(soil,0,.14,0,2.1,.28,2.2,'#8a5a36');box(soil,0,.3,0,1.85,.05,1.94,'#5a3a24').castShadow=false;for(let j=0;j<3;j++)box(soil,-.6+j*.6,.33,0,.07,.05,1.75,'#7a4e30').castShadow=false;const bedMesh=bake(soil);bedMesh.position.set(p.x,0,p.z);this.outside.add(bedMesh);const group=new T.Group();group.position.set(p.x,0,p.z);this.outside.add(group);const target=this.target('bed',i,'Tend garden bed',p.x,p.z,1.45);this.cropViews.push({group,bed:bedMesh,target,key:''});}
  this.fence(-24,-5,-24,10.5,'rail_fence');this.fence(-24,10.5,-7,10.5,'rail_fence',{x:-15,z:10.5,r:1.6});
  for(const [i,p]of ORCHARD_POSITIONS.entries()){const spot=cylinder(this.outside,p.x,.04,p.z,1.3,.08,'#c98a4a',20);this.target('tree',i,'Plant an orchard tree',p.x,p.z,2);this.treeViews.push({spot,mesh:null,key:''});}
  // Animal pen beside the barn: open gate facing the farm track.
  for(let i=0;i<6;i++){this.sized('pen_fence',this.outside,9.25+i*2.5,-23,2.5);if(i!==2)this.sized('pen_fence',this.outside,9.25+i*2.5,-14.6,2.5);}for(let i=0;i<3;i++)for(const x of [7.9,22.9])this.sized('pen_fence',this.outside,x,-21.7+i*2.7,2.5,0,Math.PI/2);
  this.sized('coop',this.outside,10.5,-20.5,2.8);this.sized('hay_bale',this.outside,21,-20.5,1.4);this.sized('feed_trough',this.outside,17,-15.4,1.8);this.target('feed','animals','Feed your animals',17,-13,2);this.sized('egg_basket',this.outside,12,-15.6,1);this.target('collect','basket','Collect eggs & milk',12,-13,1.8);
  ['chicken','chicken','duck','cow','pig'].forEach((id,i)=>{const mesh=this.sized(id,this.outside,11+i*2.4,-18.5,id==='cow'?2.4:id==='pig'?1.4:.95);this.animals.push({mesh,id,x:11+i*2.4,z:-18.5,phase:i*2});});
  if(this.assets.has('barn')){this.asset('barn',this.outside,28,-19.5);this.collider(28,-19.5,8.4,7.4);}
  if(this.assets.has('silo')){this.asset('silo',this.outside,27,-27);this.collider(27,-27,3.2,3.2);}
  if(this.assets.has('tractor')){this.asset('tractor',this.outside,30,-11,1,0,-Math.PI/2);this.collider(30,-11,2.6,4);}
  if(this.assets.has('hay_round'))for(const [x,z] of [[33.5,-14],[34.5,-11.6],[24,-13]])this.asset('hay_round',this.outside,x,z,1,0,x);
  if(this.assets.has('windmill')){this.asset('windmill',this.outside,-28,-14);this.collider(-28,-14,2.4,2.4);this.rotor=this.asset('windmill_rotor',this.outside,-28,-13.38,1,6.25);}
  for(const p of RESIDENTS){const h=HOUSES[p.home],f=this.front(h),side=(p.index%3-1)*2.2,x=h.x+f.x*7.2-f.z*side,z=h.z+f.z*7.2+f.x*side;const mesh=this.character(p.child||p.index%2===0?'hero-girl-tall':'hero-tall',p.color);mesh.scale.multiplyScalar(p.child?.57:.79);mesh.position.set(x,0,z);this.outside.add(mesh);const target=this.target('person',p.id,`Talk to ${p.name}`,x,z,1.65);this.npcs.push({p,mesh,target,homeX:x,homeZ:z,path:[],goalKey:''});}
  const bell=HOUSES[2],jx=bell.x+8,jz=bell.z+5;const jeep=this.sized('jeep',this.outside,jx,jz,4.8);jeep.rotation.y=0;this.vehicles.push({id:'jeep',mesh:jeep,speed:12});this.target('vehicle','jeep','Borrow the Bell family jeep',jx,jz+3,2.8);
  const bike=this.sized('motorcycle',this.outside,5,-8,2.8);bike.rotation.y=Math.PI/2;this.vehicles.push({id:'bike',mesh:bike,speed:9});this.target('vehicle','bike','Ride the motorcycle',5,-6,2);
  this.target('travel','country','Follow the country road',R.east+11,0,3);this.sign(this.outside,'COUNTRY ROAD  →',R.east+10,0);
  this.target('hunt','woodland','Follow the woodland trail',-58,50,2);this.sign(this.outside,'WOODLAND TRAIL',-58,50);
  for(let i=0;i<8;i++){const x=-62+i*2.4,z=54+(i%2)*3.5,id=i%2?'wood':'mushroom';this.asset(id==='wood'?'rock':'mushroom',this.outside,x,z,.7);this.target('gather',`${id}-${i}`,`Gather ${id}`,x,z,1.5);}
  // Trees: every one in the village can be cleared for a small fee.
  const reserved=(x,z,pad=0)=>{if([R.north,R.south].some(r=>Math.abs(z-r)<4+pad)&&Math.abs(x)<R.east+4)return true;if([R.west,R.east].some(r=>Math.abs(x-r)<4+pad)&&z>R.north-3&&z<R.south+3)return true;if(Math.abs(z)<4&&x>R.east&&x<R.east+16)return true;
   if(x>-25&&x<35&&z>-30&&z<27)return true;if(x<-48&&x>-66&&z>45&&z<60)return true;if(CIVIC.some(c=>Math.abs(x-c.x)<c.w/2+3&&z>c.z-c.d/2-3&&z<R.north))return true;
   return HOUSES.slice(1).some(h=>{const f=this.front(h),dx=x-h.x,dz=z-h.z,along=dx*f.x+dz*f.z,across=dx*-f.z+dz*f.x;return along>(h.barn?-16:-7)&&along<16&&Math.abs(across)<11;});};
  const trees=[],kinds=['tree_round','tree_blossom','tree_pine'];for(let i=0;i<340&&trees.length<190;i++){const x=rand()*128-64,z=rand()*124-62;if(reserved(x,z))continue;trees.push({x,z,s:1.4+rand()*1.1,kind:i%5===0?'tree_blossom':i%3===0?'tree_pine':'tree_round'});}
  // A few wild trees still stand on the family land.
  for(const [x,z] of [[-27,-5],[-28,3],[-27,10],[-21,23],[-3,-24],[-14,-20],[-20,-25],[29,10],[31,2],[-14,23]])trees.push({x,z,s:1.6,kind:x>0?'tree_blossom':'tree_round'});
  this.trees=trees;this.treeMeshes={};
  for(const kind of kinds){const list=trees.map((t,i)=>({...t,i})).filter(t=>t.kind===kind);this.treeMeshes[kind]={meshes:this.instances(kind,list,this.outside),index:new Map(list.map((t,k)=>[t.i,k]))};}
  trees.forEach((t,i)=>{this.target('chop',i,`Clear this tree · ${CHOP_COST} coins`,t.x,t.z,1.7);});this.clearedShown=new Set();
  const flowers=[];for(let i=0;i<220;i++){const x=rand()*120-60,z=rand()*116-58;if(reserved(x,z,1))continue;flowers.push({x,z,s:.8+rand()*.55});}this.instances('flowers',flowers,this.outside,false);
  this.instances('bush',HOUSES.slice(1).flatMap(h=>{const f=this.front(h);return [-1,1].map(k=>({x:h.x+f.x*3-f.z*k*4.6,z:h.z+f.z*3+f.x*k*4.6,s:1.15}));}),this.outside);
  this.instances('flowers',[{x:-4,z:-7,s:1.1},{x:4,z:-7,s:1.1},{x:-8,z:12,s:1.2},{x:9,z:20,s:1.2},{x:24,z:12,s:1.3},{x:-2,z:23,s:1.1}],this.outside,false);
  for(const [i,p]of RACE_POINTS.entries()){const ring=new T.Mesh(new T.TorusGeometry(1.25,.09,6,32),mat('#ffc83a'));ring.rotation.x=-Math.PI/2;ring.position.set(p.x,.2,p.z);ring.visible=false;this.outside.add(ring);this.markers.push(ring);}
  const live=new Set([this.groundMesh,this.water,HOUSES[0].group,this.rotor,...this.vehicles.map(v=>v.mesh),...this.npcs.map(n=>n.mesh),...this.animals.map(a=>a.mesh),...this.fishes.map(f=>f.mesh),...this.cropViews.flatMap(v=>[v.group,v.bed]),...this.markers]);
  const fixed=new T.Group();for(const child of [...this.outside.children])if(child.visible&&!child.isSprite&&!child.isInstancedMesh&&!live.has(child))fixed.add(child);this.outside.add(bake(fixed));
 }
 hideTree(i){const t=this.trees?.[i];if(!t||this.clearedShown.has(i))return;this.clearedShown.add(i);const entry=this.treeMeshes[t.kind],k=entry.index.get(i),zero=new T.Matrix4().makeScale(0,0,0);for(const m of entry.meshes){m.setMatrixAt(k,zero);m.instanceMatrix.needsUpdate=true;}if(this.assets.has('stump'))this.asset('stump',this.outside,t.x,t.z,1);}
 // Villagers keep a day: children to school, workers to the Town Square, hired helpers to the family farm.
 npcGoal(n,s){const day=s.time>=8.5&&s.time<17,job=s.hired[n.p.id];if(job&&day){const spot={farmhand:{x:-15,z:11.6},fisher:{x:FISH_SPOT.x+2.5,z:FISH_SPOT.z+.6},herder:{x:15,z:-12.4},gardener:{x:-10,z:11.6}}[job];return {key:'job',x:spot.x+(n.p.index%3-1)*1.2,z:spot.z};}
  const place=n.p.child?'school':WORKPLACE[n.p.id];if(place&&day){const c=CIVIC.find(c=>c.id===place);return {key:place,x:c.x+((n.p.index%5)-2)*1.5,z:c.z+c.d/2+2.4+(n.p.index%2)*.9};}return {key:'home',x:n.homeX,z:n.homeZ};}
 updateNpcs(dt,s){let routed=0;const colliders=this.colliders.filter(c=>c.location==='village');
  for(const n of this.npcs){const goal=this.npcGoal(n,s);if(goal.key!==n.goalKey&&routed<2){routed++;n.goalKey=goal.key;n.path=findRoute(n.mesh.position,goal,colliders,{x:OUTDOOR_LIMIT,z:OUTDOOR_LIMIT});if(!n.path.length)n.path=[goal];}
   const p=n.path[0];let walk=false;if(p){const dx=p.x-n.mesh.position.x,dz=p.z-n.mesh.position.z,d=Math.hypot(dx,dz);if(d<.25)n.path.shift();else{const step=Math.min(d,dt*(n.p.child?2.3:2.6));n.mesh.position.x+=dx/d*step;n.mesh.position.z+=dz/d*step;n.mesh.rotation.y=Math.atan2(dx,dz);walk=true;}}
   this.animatePerson(n.mesh,walk?.42:.025,this.t*(walk?8:6)+n.p.index);n.target.x=n.mesh.position.x;n.target.z=n.mesh.position.z;n.target.hit.position.set(n.target.x,1,n.target.z);const shadow=Math.hypot(n.target.x-this.player.position.x,n.target.z-this.player.position.z)<23;n.mesh.traverse(m=>{if(m.isMesh)m.castShadow=shadow;});}}
 instances(name,points,parent,shadow=true){const source=this.assets.get(name);if(!source)return [];const made=[];source.traverse(m=>{if(!m.isMesh)return;const inst=new T.InstancedMesh(m.geometry,m.material,points.length);made.push(inst);points.forEach((p,i)=>{dummy.position.set(p.x,0,p.z);dummy.rotation.set(0,(i*2.399),0);dummy.scale.setScalar(p.s);dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);});inst.castShadow=shadow;inst.receiveShadow=true;parent.add(inst);});return made;}
 makeCropSprites(){
  this.cropTextures={};const scene=new T.Scene(),camera=new T.OrthographicCamera(-1.5,1.5,1.6,-1.4,.1,20);camera.position.set(3,3.5,5);camera.lookAt(0,.6,0);scene.add(new T.HemisphereLight('#fff8e6','#647450',2.8));const light=new T.DirectionalLight('#fff3db',3);light.position.set(-3,6,4);scene.add(light);
  const oldColor=this.renderer.getClearColor(new T.Color()),oldAlpha=this.renderer.getClearAlpha();this.renderer.setClearColor(0,0);
  for(const id of [...Object.keys(CROPS),'sprout']){const model=this.sized('crop_'+id,scene,0,0,2.1);const target=new T.WebGLRenderTarget(160,160);this.renderer.setRenderTarget(target);this.renderer.render(scene,camera);this.cropTextures[id]=target.texture;scene.remove(model);}
  this.renderer.setRenderTarget(null);this.renderer.setClearColor(oldColor,oldAlpha);
 }
 buildCountry(){this.ground(this.country,58,48,'#afc38c');box(this.country,0,.02,0,55,.04,5,'#d9c799');this.sized('market-stall',this.country,8,-6,5);this.sign(this.country,'HILLSIDE COUNTRY MARKET',8,-5);this.target('shop','country','Trade at the country market',8,-2,2.5,this.country);this.target('return','village','Return to Willowmere',-21,0,3,this.country);this.sign(this.country,'←  WILLOWMERE',-21,0);this.sized('jeep',this.country,-10,-7,4.8);this.instances('tree_pine',Array.from({length:35},(_,i)=>({x:-27+(i%12)*4.6,z:i<12?-17:15+Math.floor(i/12)*2,s:1.5+(i%3)*.3})),this.country);for(let i=0;i<5;i++){const id=i%2?'wood':'mushroom',x=-7+i*4;this.asset(id==='wood'?'rock':'mushroom',this.country,x,7,.8);this.target('gather',`${id}-${i+20}`,`Gather ${id}`,x,7,1.6,this.country);}}
 enterHouse(id){this.dismount();this.returnPosition=this.player.position.clone();this.houseId=id;this.location='interior';this.outside.visible=false;this.country.visible=false;this.inside.visible=true;this.buildInterior();this.player.position.set(0,0,4);this.follow.set(0,0,0);this.clearMovement();this.resize();}
 buildInterior(){buildInteriorRoom(this,{houseId:this.houseId,state:this.state,HOUSES,RESIDENTS,KID_OUTFITS});}
 exit(){this.location='village';this.houseId=null;this.outside.visible=true;this.inside.visible=false;this.country.visible=false;this.player.position.copy(this.returnPosition??new T.Vector3(0,0,-8));this.follow.copy(this.player.position);this.clearMovement();this.resize();}
 travel(){this.dismount();this.returnPosition=new T.Vector3(ROADS.east+8,0,0);this.location='country';this.outside.visible=false;this.inside.visible=false;this.country.visible=true;this.player.position.set(-18,0,0);this.follow.copy(this.player.position);this.clearMovement();this.resize();}
 board(id){const ride=this.vehicles.find(v=>v.id===id);if(!ride)return;this.riding=ride;this.player.position.copy(ride.mesh.position);this.clearMovement();}
 dismount(){if(!this.riding)return;const v=this.riding;this.riding=null;for(const [dx,dz]of [[2.5,0],[-2.5,0],[0,2.5],[0,-2.5],[0,0]])if(!this.blocked(v.mesh.position.x+dx,v.mesh.position.z+dz)){this.player.position.set(v.mesh.position.x+dx,0,v.mesh.position.z+dz);break;}const target=this.targets.find(t=>t.type==='vehicle'&&t.id===v.id);target.x=this.player.position.x;target.z=this.player.position.z;target.hit.position.set(target.x,1,target.z);}
 clearMovement(){this.keys.clear();this.stick.x=0;this.stick.y=0;this.path=[];this.pending=null;}
 activeTargets(){return this.targets.filter(t=>t.location===this.location&&(t.type!=='bed'||t.id<bedCount(this.state))&&(t.type!=='chop'||!this.clearedShown?.has(t.id)));}
 nearest(){if(this.riding)return {type:'dismount',label:'Park & step out',id:this.riding.id};let best=null,distance=Infinity;for(const t of this.activeTargets()){const d=Math.hypot(this.player.position.x-t.x,this.player.position.z-t.z);if(d<t.r&&d<distance){best=t;distance=d;}}return best;}
 interact(){const t=this.nearest();if(t)this.onInteract(t);}
 get bounds(){return this.location==='interior'?{x:6.4,z:5.7}:this.location==='country'?{x:26,z:20}:{x:OUTDOOR_LIMIT,z:OUTDOOR_LIMIT};}
 blocked(x,z){const bound=this.bounds;if(Math.abs(x)>bound.x||Math.abs(z)>bound.z)return true;return this.colliders.some(c=>c.location===this.location&&Math.abs(x-c.x)<c.w/2+.32&&Math.abs(z-c.z)<c.d/2+.32);}
 routeTo(x,z){this.path=findRoute(this.player.position,{x,z},this.colliders.filter(c=>c.location===this.location),this.bounds);return this.path.length>0;}
 get homeGuide(){return{visible:this.location==='village'&&!inVillage(this.player.position.x,this.player.position.z),...homeBearing(this.player.position,HOMESTEAD,this.yaw)};}
 walkHome(){this.pending=null;return this.routeTo(HOMESTEAD.x,HOMESTEAD.z);}
 click(e){this.scene.updateMatrixWorld(true);this.pointer.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);this.raycast.setFromCamera(this.pointer,this.camera);const hits=this.raycast.intersectObjects(this.activeTargets().map(t=>t.hit),false);let target=hits[0]?.object.userData.target;this.raycast.ray.intersectPlane(this.plane,v3);if(!target){target=this.activeTargets().find(t=>Math.hypot(v3.x-t.x,v3.z-t.z)<.9);}
  if(target){if(Math.hypot(this.player.position.x-target.x,this.player.position.z-target.z)<target.r){this.onInteract(target);return;}this.pending=target;this.routeTo(target.x,target.z);}else {this.pending=null;this.routeTo(v3.x,v3.z);}
 }
 sync(force=false){
  if(!this.player)return;const s=this.state,key=JSON.stringify([s.upgrades,s.beds.map(b=>b?[b.crop,b.watered,ripe(s,b)]:null),s.trees,s.outfit,s.body,s.kidOutfit,s.day,s.furniture,s.cleared.length]);if(!force&&key===this.lastSync)return;this.lastSync=key;
  const outfit=OUTFITS.find(o=>o.id===s.outfit);if(this.player.userData.style!==s.body+s.outfit){const pos=this.player.position.clone(),rot=this.player.rotation.y;this.scene.remove(this.player);this.player.traverse(m=>{if(m.userData.ownedGeometry)m.geometry.dispose();});this.player=this.character(s.body==='boy'?'hero-tall':'hero-girl-tall',outfit.color);this.player.scale.multiplyScalar(.88);this.player.position.copy(pos);this.player.rotation.y=rot;this.player.userData.style=s.body+s.outfit;this.scene.add(this.player);}
  this.cropViews.forEach((view,i)=>{const b=s.beds[i];view.bed.visible=i<bedCount(s);view.group.visible=i<bedCount(s);const k=b?`${b.crop}-${b.watered}-${ripe(s,b)}`:'empty';if(k!==view.key){view.key=k;for(const child of view.group.children){if(!child.isSprite)child.geometry?.dispose();child.material?.dispose();}view.group.clear();if(b){const sprite=new T.Sprite(new T.SpriteMaterial({map:this.cropTextures[b.watered?b.crop:'sprout'],depthWrite:false}));sprite.scale.set(2,2,1);sprite.position.y=.95;view.group.add(sprite);if(ripe(s,b)){const glow=new T.Mesh(new T.RingGeometry(.88,.94,28),new T.MeshBasicMaterial({color:'#e7d383',side:T.DoubleSide}));glow.rotation.x=-Math.PI/2;glow.position.y=.36;view.group.add(glow);}}}view.target.label=!b?'Plant a seed':!b.watered?'Water the '+CROPS[b.crop].name.toLowerCase():ripe(s,b)?'Harvest '+CROPS[b.crop].name.toLowerCase():'Growing · '+Math.ceil(CROPS[b.crop].grow*(1-cropProgress(s,b)))+'s';});
  this.treeViews.forEach((v,i)=>{const t=s.trees[i],k=t?`${t.kind}-${s.day-t.day>=2}`:'';if(k!==v.key){if(v.mesh)v.mesh.removeFromParent();v.key=k;if(t)v.mesh=this.sized('crop_'+t.kind,this.outside,ORCHARD_POSITIONS[i].x,ORCHARD_POSITIONS[i].z,s.day-t.day>=2?4.2:2.2);}});
  this.animals.forEach((a,i)=>a.mesh.visible=i===0||i===2||i===1&&s.upgrades.pen>=1||i===3&&s.upgrades.pen>=2||i===4&&s.upgrades.pen>=3);
  const pip=this.npcs.find(n=>n.p.id==='pip');if(pip&&pip.mesh.userData.look!==s.kidOutfit){const color=new T.Color(KID_OUTFITS.find(k=>k.id===s.kidOutfit)?.color??pip.p.color);pip.mesh.traverse(m=>{if(m.isMesh&&m.userData.shirtVertices){const attribute=m.geometry.getAttribute('color');for(const i of m.userData.shirtVertices)attribute.setXYZ(i,color.r,color.g,color.b);attribute.needsUpdate=true;}});pip.mesh.userData.look=s.kidOutfit;}
  this.groundMesh.material.color.set(['#5cc93a','#46b52e','#a9b83a','#e4f0f2'][Math.floor((s.day-1)/7)%4]);this.fields.season(this.groundMesh.material.color);
  this.refreshHome();for(const i of s.cleared)this.hideTree(i);
  if(this.location==='interior')this.buildInterior();
 }
 burst(color='#e9c16b'){for(let i=0;i<10;i++){const mesh=new T.Mesh(sphere,mat(color));mesh.scale.setScalar(.1);mesh.position.copy(this.player.position).add(new T.Vector3(0,1,0));this.scene.add(mesh);this.particles.push({mesh,life:1,v:new T.Vector3((rand()-.5)*3,1+rand()*3,(rand()-.5)*3)});}}
 setFishing(active,simulation=null){this.fishing=active?simulation:null;if(active)this.rodFishing.start(simulation);else this.rodFishing.cancel();this.resize();}
 update(dt){
  if(!this.ready){this.renderer.render(this.scene,this.camera);return;}this.t+=dt;const s=this.state;
  if(!this.paused){let x=(this.keys.has('d')||this.keys.has('arrowright')?1:0)-(this.keys.has('a')||this.keys.has('arrowleft')?1:0)+this.stick.x,z=(this.keys.has('s')||this.keys.has('arrowdown')?1:0)-(this.keys.has('w')||this.keys.has('arrowup')?1:0)+this.stick.y;
   // Screen-relative movement, consistent for keyboard and touch.
   let dx=x*Math.cos(this.yaw)+z*Math.sin(this.yaw),dz=-x*Math.sin(this.yaw)+z*Math.cos(this.yaw);if(Math.hypot(x,z)>.05){this.path=[];this.pending=null;}else if(this.path.length){const p=this.path[0];dx=p.x-this.player.position.x;dz=p.z-this.player.position.z;if(Math.hypot(dx,dz)<.22)this.path.shift();}
   const length=Math.hypot(dx,dz);if(this.riding)this.riding.driveSpeed=T.MathUtils.damp(this.riding.driveSpeed??0,length>.05?this.riding.speed:0,5,dt);const speed=this.riding?this.riding.driveSpeed:(this.keys.has('shift')?7:4.8)*(s.settings.test?1.6:1);let moving=false;if(length>.05){dx/=length;dz/=length;const nx=this.player.position.x+dx*dt*speed,nz=this.player.position.z+dz*dt*speed;if(!this.blocked(nx,this.player.position.z)){this.player.position.x=nx;moving=true;}if(!this.blocked(this.player.position.x,nz)){this.player.position.z=nz;moving=true;}const desired=Math.atan2(dx,dz);this.player.rotation.y+=Math.atan2(Math.sin(desired-this.player.rotation.y),Math.cos(desired-this.player.rotation.y))*Math.min(1,dt*12);}
   if(this.pending&&Math.hypot(this.player.position.x-this.pending.x,this.player.position.z-this.pending.z)<this.pending.r*.82){const target=this.pending;this.path=[];this.pending=null;this.onInteract(target);}
   this.animatePerson(this.player,moving?.5:0,this.t*(this.keys.has('shift')?13:9));this.player.position.y=moving&&!this.riding?Math.abs(Math.sin(this.t*9))*.065:0;
   if(this.riding){this.riding.mesh.position.set(this.player.position.x,0,this.player.position.z);this.riding.mesh.rotation.y=this.player.rotation.y+Math.PI;this.player.position.y=.7;this.animatePerson(this.player,-.6,1);}
   if(this.location==='village'){s.position={x:this.player.position.x,z:this.player.position.z};
    this.updateNpcs(dt,s);
   }
  }
  if(this.location==='village'){this.fields.update(this.player.position);this.birds.update(this.t,this.player.position);}
  this.rain.visible=calendar(s).rain&&this.location!=='interior';if(this.rain.visible){const a=this.rainGeometry.getAttribute('position');for(let i=0;i<120;i++){const x=this.player.position.x+Math.sin(i*71.3)*24,z=this.player.position.z+Math.cos(i*17.9)*24,y=(i*.47-this.t*11)%12+12;a.setXYZ(i*2,x,y,z);a.setXYZ(i*2+1,x-.18,y-.8,z);}a.needsUpdate=true;}
  for(const f of this.fishes){const angle=this.t*.25+f.phase;f.mesh.position.set(POND.x+Math.cos(angle)*f.r*1.25,.21,POND.z+Math.sin(angle)*f.r*.7);f.mesh.rotation.y=-angle;}
  for(const a of this.animals){a.mesh.position.x=a.x+Math.sin(this.t*.22+a.phase)*.55;a.mesh.position.z=a.z+Math.cos(this.t*.27+a.phase)*.55;a.mesh.rotation.y=Math.sin(this.t*.2+a.phase)*.8;a.mesh.position.y=Math.abs(Math.sin(this.t*3+a.phase))*.025;}
  for(const [i,view]of this.cropViews.entries()){const b=s.beds[i],sprite=view.group.children[0];if(sprite?.isSprite){const size=b.watered?.7+cropProgress(s,b)*1.2:1;sprite.scale.set(size,size,1);sprite.position.y=.45+size*.4;}}
  for(const p of this.particles){p.life-=dt;p.mesh.position.addScaledVector(p.v,dt);p.v.y-=dt*4;p.mesh.scale.setScalar(Math.max(0,p.life)*.12);}this.particles=this.particles.filter(p=>{if(p.life<=0){p.mesh.removeFromParent();return false;}return true;});
  this.rodFishing.update(dt,this.t);if(this.rotor)this.rotor.rotation.z+=dt*1.6;
  const focus=this.location==='interior'?v3.set(0,0,0):this.fishing?v3.copy(this.player.position).lerp(new T.Vector3(POND.x,0,POND.z),.4):this.player.position;this.follow.lerp(focus,1-Math.exp(-dt*4));const d=this.location==='interior'?24:45;this.camera.position.set(this.follow.x+Math.sin(this.yaw)*d,this.follow.y+d*.87,this.follow.z+Math.cos(this.yaw)*d);this.camera.lookAt(this.follow.x,0,this.follow.z);
  const sunset=T.MathUtils.clamp((s.time-16)/6,0,1);this.sun.intensity=3.4-sunset*1.7;this.sun.color.set(sunset>.45?'#efb180':'#fff0ce');this.ambient.intensity=2.2-sunset*.6;this.sun.position.set(this.follow.x-24,42,this.follow.z+22);this.sun.target.position.set(this.follow.x,0,this.follow.z);
  for(const label of this.labels)label.visible=this.location==='interior'||Math.hypot(label.position.x-this.player.position.x,label.position.z-this.player.position.z)<30;
  this.playerRing.position.set(this.player.position.x,.05,this.player.position.z);const nearest=this.nearest();this.targetRing.visible=!!nearest&&nearest.type!=='dismount'&&!this.paused;if(this.targetRing.visible)this.targetRing.position.set(nearest.x,.06,nearest.z);this.renderer.render(this.scene,this.camera);
 }
 project(x,z,y=0){const p=new T.Vector3(x,y,z).project(this.camera);return{x:(p.x*.5+.5)*innerWidth,y:(-.5*p.y+.5)*innerHeight};}
 get metrics(){return{drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures,fields:this.fields?.metrics,birds:this.birds?.metrics,homeGuide:this.player?this.homeGuide:null,fishing:this.rodFishing?.metrics};}
}
