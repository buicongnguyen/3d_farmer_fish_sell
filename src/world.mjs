import * as T from 'three';
import {OpenFields,FieldBirds} from './fields.mjs';
import {OUTDOOR_LIMIT,HOMESTEAD,homeBearing,inVillage} from './field-layout.mjs';
import {findRoute} from './navigation.mjs';
import {RodFishingView} from './rod-fishing.mjs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HOUSES,CIVIC,RESIDENTS,OUTFITS,KID_OUTFITS,BED_POSITIONS,ORCHARD_POSITIONS,RACE_POINTS,CROPS } from './content.mjs';
import { bedCount,ripe,cropProgress,calendar } from './game.mjs';

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
 resize(){const w=innerWidth,h=innerHeight;this.renderer.setSize(w,h,false);const aspect=w/h,scale=this.location==='interior'?10:this.fishing?(aspect<.8?12:11):Math.max(this.zoom,aspect<.8?23:0);this.camera.left=-scale*aspect;this.camera.right=scale*aspect;this.camera.top=scale;this.camera.bottom=-scale;this.camera.updateProjectionMatrix();}
 async init(progress){
  const files=['town','scenery','farm','fish','house','crops','fruit_crops','hero-tall','hero-girl-tall','market-stall','equipment-stall','well','kitchen','storage-chest','garden-bed','jeep','motorcycle','forest-birds','field-gull'];let n=0;
  await Promise.all(files.map(async name=>{const gltf=await new GLTFLoader().loadAsync(`./assets/models/${name}.glb`);this.raw.set(name,gltf.scene);
   if(['town','scenery','farm','fish','house','crops','fruit_crops'].includes(name)){for(const child of gltf.scene.children){const root=new T.Group(),copy=child.clone(true);copy.position.set(0,0,0);root.add(copy);this.assets.set(child.name,bake(root));}}
   else if(!name.startsWith('hero')&&!['forest-birds','field-gull'].includes(name)){if(name==='jeep')gltf.scene.getObjectByName('jeep_Turret')?.removeFromParent();this.assets.set(name,bake(gltf.scene));}progress(++n/files.length);
  }));
  this.buildVillage();this.buildCountry();this.fields=new OpenFields(this);this.birds=new FieldBirds(this,bake);this.rodFishing=new RodFishingView(this);this.player=this.character(this.state.body==='boy'?'hero-tall':'hero-girl-tall',OUTFITS.find(o=>o.id===this.state.outfit).color);this.player.scale.multiplyScalar(.88);this.scene.add(this.player);this.player.position.set(this.state.position.x,0,this.state.position.z);if(this.blocked(this.player.position.x,this.player.position.z))this.player.position.set(-15,0,0);
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
 buildHouse(h){const g=new T.Group();g.position.set(h.x,0,h.z);this.outside.add(g);
  const node=this.raw.get('town').getObjectByName(h.style);g.add(bakeTinted(node,{'Roof':h.color,'Roof Trim':h.trim,'Accent':h.accent}));
  this.collider(h.x,h.z,7.8,5.8);this.target('house',h.id,`Enter ${h.name}`,h.x,h.z+4.3,2);h.group=g;
  this.sign(this.outside,h.id===0?'HOME SWEET HOME':h.family.toUpperCase(),h.x,h.z-1,7);return g;
 }
 buildCivic(c){this.asset(c.id,this.outside,c.x,c.z);this.collider(c.x,c.z,c.w,c.d);this.target('civic',c.id,c.verb,c.x,c.z+c.d/2+1.8,2.2);this.sign(this.outside,c.name.toUpperCase(),c.x,c.z-1,c.h);}
 buildVillage(){
  this.groundMesh=this.ground(this.outside,1024,1024,'#4fc232');
  // Wide, connected paths leave clear routes between all household doors.
  const path=(x,z,w,d)=>{const p=box(this.outside,x,.008,z,w,.02,d,'#f4d58f');p.castShadow=false;};path(0,-1,102,6);path(0,-33,74,5);path(0,-30,4,8);path(25,-31,4,6);path(-31,-28,4,14);path(0,23,86,4.5);path(-31,4,4,63);path(25,4,4,64);path(0,-14,4,27);path(3,4,13,16);
  for(const c of CIVIC)this.buildCivic(c);
  for(const h of HOUSES){this.buildHouse(h);const joinZ=h.z<0?-1:23;path(h.x,(h.z+4+joinZ)/2,2.1,Math.abs(h.z+4-joinZ));}
  // Pond, sand rim and a proper dock.
  const rim=cylinder(this.outside,13,.04,10,7.7,.13,'#f6dc96',64);rim.scale.z=.76;
  const pond=cylinder(this.outside,13,.13,10,7,.15,'#2f9fd0',64);pond.scale.z=.74;
  this.water=new T.Mesh(new T.CircleGeometry(7,64),new T.MeshPhysicalMaterial({color:'#5fd0f5',transparent:true,opacity:.5,roughness:.25,metalness:.12}));this.water.rotation.x=-Math.PI/2;this.water.scale.y=.74;this.water.position.set(13,.3,10);this.outside.add(this.water);this.collider(13,10,12.2,8.3);
  for(let i=0;i<8;i++)box(this.outside,7+i*.52,.38,15.2,.48,.22,2.1,'#b69a73');for(const x of [7,10.5])for(const z of [14.3,16.1])cylinder(this.outside,x,.55,z,.09,1.2,'#85735b',8);
  this.target('fish','pond','Cast your fishing rod',9,16.8,2.4);this.sign(this.outside,'THE FAMILY POND',14,8);
  for(let i=0;i<9;i++){const theta=i*2.4;this.asset('reeds',this.outside,13+Math.cos(theta)*7,10+Math.sin(theta)*5,.7);if(i<5)this.asset('lily_pad',this.outside,12+Math.cos(theta)*3,10+Math.sin(theta)*2,.7,.34);}
  ['perch','carp','koi','perch','catfish','koi'].forEach((id,i)=>{const fish=this.sized('fish_'+id,this.outside,13,10,.85,.21);this.fishes.push({id,mesh:fish,phase:i*1.7,r:2+i*.45});});
  this.sized('well',this.outside,3,-7,3.1);this.collider(3,-7,2.3,2.3);
  this.sized('market-stall',this.outside,-2,4,4.4);this.target('shop','market','Browse the village market',-2,6,2.1);this.sign(this.outside,'VILLAGE MARKET',-2,3.5);
  this.sized('equipment-stall',this.outside,-35,10,3.6);this.target('shop','clothes','Visit the Finch atelier',-35,12,2);
  this.target('shop','upgrades','Visit the Vale workshop',-32,29,2.1);this.sized('storage-chest',this.outside,-32,27,1.7);
  this.target('festival','supper','Harvest supper & village run',6,23,2.5);this.sized('dining_table',this.outside,6,23,3.8);for(const x of [3.5,8.5])this.sized('chair',this.outside,x,23,1.3);this.sign(this.outside,'THE VILLAGE TABLE',6,23);
  for(let i=0;i<24;i++){const p=BED_POSITIONS[i],soil=new T.Group();box(soil,0,.14,0,2.1,.28,2.2,'#937354');box(soil,0,.3,0,1.85,.05,1.94,'#66543d').castShadow=false;for(let j=0;j<3;j++)box(soil,-.6+j*.6,.33,0,.07,.05,1.75,'#847053').castShadow=false;const bed=bake(soil);bed.position.set(p.x,0,p.z);this.outside.add(bed);const group=new T.Group();group.position.set(p.x,0,p.z);this.outside.add(group);const target=this.target('bed',i,'Tend garden bed',p.x,p.z,1.45);this.cropViews.push({group,bed,target,key:''});}
  this.sign(this.outside,'THE LITTLE GARDEN',-18,3);
  for(const [i,p]of ORCHARD_POSITIONS.entries()){const spot=cylinder(this.outside,p.x,.04,p.z,1.3,.08,'#c2b283',20);this.target('tree',i,'Plant an orchard tree',p.x,p.z,2);this.treeViews.push({spot,mesh:null,key:''});}
  // Farm pen: open gate facing the garden, fence geometry shared with the reference.
  for(let i=0;i<6;i++){this.sized('pen_fence',this.outside,-16+i*2.5,-22,2.5);this.sized('pen_fence',this.outside,-16+i*2.5,-15,2.5);}for(let i=0;i<3;i++)for(const x of [-17.2,-2])this.sized('pen_fence',this.outside,x,-21+i*2.6,2.5,0,Math.PI/2);
  this.sized('coop',this.outside,-14,-20,2.8);this.sized('hay_bale',this.outside,-5,-20,1.4);this.sized('feed_trough',this.outside,-7,-15.2,1.8);this.target('feed','animals','Feed your animals',-7,-13.6,2);this.sized('egg_basket',this.outside,-12,-14,1);this.target('collect','basket','Collect eggs & milk',-12,-12.8,1.8);
  ['chicken','chicken','duck','cow','pig'].forEach((id,i)=>{const mesh=this.sized(id,this.outside,-14+i*2,-18,id==='cow'?2.4:id==='pig'?1.4:.95);this.animals.push({mesh,id,x:-14+i*2,z:-18,phase:i*2});});
  for(const p of RESIDENTS){const h=HOUSES[p.home];const mesh=this.character(p.child||p.index%2===0?'hero-girl-tall':'hero-tall',p.color);mesh.scale.multiplyScalar(p.child?.57:.79);const x=h.x+(p.index%3-1)*2.2,z=h.z+6.5;mesh.position.set(x,0,z);this.outside.add(mesh);const target=this.target('person',p.id,`Talk to ${p.name}`,x,z,1.65);this.npcs.push({p,mesh,target,homeX:x,homeZ:z,x,z});}
  const jeep=this.sized('jeep',this.outside,5,-17,4.8);jeep.rotation.y=Math.PI/2;this.vehicles.push({id:'jeep',mesh:jeep,speed:12});this.target('vehicle','jeep','Borrow the Bell family jeep',5,-14,2.8);
  const bike=this.sized('motorcycle',this.outside,-5,-7,2.8);bike.rotation.y=Math.PI/2;this.vehicles.push({id:'bike',mesh:bike,speed:9});this.target('vehicle','bike','Ride the motorcycle',-5,-5,2);
  this.target('travel','country','Follow the country road',47,-1,3);this.sign(this.outside,'COUNTRY ROAD  →',46,-1);
  this.target('hunt','woodland','Follow the woodland trail',-43,37,2);this.sign(this.outside,'WOODLAND TRAIL',-43,38);
  for(let i=0;i<8;i++){const x=-46+i*2.8,z=35+(i%2)*4,id=i%2?'wood':'mushroom';this.asset(id==='wood'?'rock':'mushroom',this.outside,x,z,.7);this.target('gather',`${id}-${i}`,`Gather ${id}`,x,z,1.5);}
  // Shared meshes render an entire forest in a handful of calls.
  const trees=[];for(let i=0;i<155;i++){const x=rand()*108-54,z=rand()*100-50;const outskirts=Math.abs(x)>44||z<-30||z>42;const garden=x>-30&&x<24&&z>-27&&z<27;if((!outskirts&&garden)||HOUSES.some(h=>Math.hypot(x-h.x,z-h.z)<7)||CIVIC.some(c=>Math.abs(x-c.x)<c.w/2+3&&z>c.z-c.d/2-3&&z<c.z+c.d/2+5)||Math.abs(z+33)<4||Math.abs(z+1)<5||Math.abs(z-23)<4)continue;trees.push({x,z,s:1.4+rand()*1.1,kind:i%5===0?'tree_blossom':i%3===0?'tree_pine':'tree_round'});}
  for(const kind of ['tree_blossom','tree_pine','tree_round'])this.instances(kind,trees.filter(p=>p.kind===kind),this.outside);
  const flowers=[];for(let i=0;i<180;i++){const x=rand()*94-47,z=rand()*84-42;if(Math.abs(z+1)<4||Math.abs(z-23)<3||Math.abs(z+33)<4||CIVIC.some(c=>Math.abs(x-c.x)<c.w/2+2&&Math.abs(z-c.z)<c.d/2+4)||HOUSES.some(h=>Math.hypot(x-h.x,z-h.z)<5)||(x>-29&&x<23&&z>-25&&z<27))continue;flowers.push({x,z,s:.8+rand()*.55});}this.instances('flowers',flowers,this.outside,false);
  // Hand-placed garden edges and small stones soften the broad village paths.
  this.instances('bush',HOUSES.flatMap(h=>[-1,1].map(side=>({x:h.x+side*4.5,z:h.z+2.5,s:1.15}))),this.outside);
  this.instances('flowers',[{x:-26,z:3,s:1.1},{x:-11,z:3,s:1.1},{x:-27,z:14,s:1.2},{x:-9,z:14,s:1.2},{x:19,z:15,s:1.3},{x:20,z:6,s:1.1},{x:6,z:8,s:1},{x:-5,z:7,s:1.1}],this.outside,false);
  this.instances('stone_step',Array.from({length:7},(_,i)=>({x:-22+i*1.5,z:17+(i%2)*.3,s:.75})),this.outside,false);
  // Pennant string beside the communal table.
  for(const x of [-1,14])box(this.outside,x,2.1,26,.13,4.2,.13,'#8d7857');for(let i=0;i<12;i++){const g=new T.BufferGeometry().setFromPoints([new T.Vector3(-.4,0,0),new T.Vector3(.4,0,0),new T.Vector3(0,-.75,0)]);g.computeVertexNormals();const m=new T.Mesh(g,new T.MeshBasicMaterial({color:['#db9980','#eacb77','#8cafac'][i%3],side:T.DoubleSide}));m.position.set(i*1.25,3.8-Math.sin(i/11*Math.PI)*.4,26);this.outside.add(m);}
  for(const [i,p]of RACE_POINTS.entries()){const ring=new T.Mesh(new T.TorusGeometry(1.25,.09,6,32),mat('#e7c066'));ring.rotation.x=-Math.PI/2;ring.position.set(p.x,.2,p.z);ring.visible=false;this.outside.add(ring);this.markers.push(ring);}
  const live=new Set([this.groundMesh,this.water,HOUSES[0].group,...this.vehicles.map(v=>v.mesh),...this.npcs.map(n=>n.mesh),...this.animals.map(a=>a.mesh),...this.fishes.map(f=>f.mesh),...this.cropViews.flatMap(v=>[v.group,v.bed]),...this.markers]);
  const fixed=new T.Group();for(const child of [...this.outside.children])if(child.visible&&!child.isSprite&&!child.isInstancedMesh&&!live.has(child))fixed.add(child);this.outside.add(bake(fixed));
  // The player's house stays a separate batch so its upgrades are visible.
  const home=HOUSES[0].group,bakedHome=bake(home);home.clear();home.position.set(0,0,0);home.add(bakedHome);
 }
 instances(name,points,parent,shadow=true){const source=this.assets.get(name);if(!source)return;source.traverse(m=>{if(!m.isMesh)return;const inst=new T.InstancedMesh(m.geometry,m.material,points.length);points.forEach((p,i)=>{dummy.position.set(p.x,0,p.z);dummy.rotation.set(0,(i*2.399),0);dummy.scale.setScalar(p.s);dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);});inst.castShadow=shadow;inst.receiveShadow=true;parent.add(inst);});}
 makeCropSprites(){
  this.cropTextures={};const scene=new T.Scene(),camera=new T.OrthographicCamera(-1.5,1.5,1.6,-1.4,.1,20);camera.position.set(3,3.5,5);camera.lookAt(0,.6,0);scene.add(new T.HemisphereLight('#fff8e6','#647450',2.8));const light=new T.DirectionalLight('#fff3db',3);light.position.set(-3,6,4);scene.add(light);
  const oldColor=this.renderer.getClearColor(new T.Color()),oldAlpha=this.renderer.getClearAlpha();this.renderer.setClearColor(0,0);
  for(const id of [...Object.keys(CROPS),'sprout']){const model=this.sized('crop_'+id,scene,0,0,2.1);const target=new T.WebGLRenderTarget(160,160);this.renderer.setRenderTarget(target);this.renderer.render(scene,camera);this.cropTextures[id]=target.texture;scene.remove(model);}
  this.renderer.setRenderTarget(null);this.renderer.setClearColor(oldColor,oldAlpha);
 }
 buildCountry(){this.ground(this.country,58,48,'#afc38c');box(this.country,0,.02,0,55,.04,5,'#d9c799');this.sized('market-stall',this.country,8,-6,5);this.sign(this.country,'HILLSIDE COUNTRY MARKET',8,-5);this.target('shop','country','Trade at the country market',8,-2,2.5,this.country);this.target('return','village','Return to Willowmere',-21,0,3,this.country);this.sign(this.country,'←  WILLOWMERE',-21,0);this.sized('jeep',this.country,-10,-7,4.8);this.instances('tree_pine',Array.from({length:35},(_,i)=>({x:-27+(i%12)*4.6,z:i<12?-17:15+Math.floor(i/12)*2,s:1.5+(i%3)*.3})),this.country);for(let i=0;i<5;i++){const id=i%2?'wood':'mushroom',x=-7+i*4;this.asset(id==='wood'?'rock':'mushroom',this.country,x,7,.8);this.target('gather',`${id}-${i+20}`,`Gather ${id}`,x,7,1.6,this.country);}}
 enterHouse(id){this.dismount();this.returnPosition=this.player.position.clone();this.houseId=id;this.location='interior';this.outside.visible=false;this.country.visible=false;this.inside.visible=true;this.buildInterior();this.player.position.set(0,0,4);this.follow.set(0,0,0);this.clearMovement();this.resize();}
 buildInterior(){
  // Cached furniture uses shared geometry. Dispose only the generated room geometry/textures.
  for(const child of [...this.inside.children]){child.traverse(o=>{if(o.userData.ownedGeometry)o.geometry.dispose();if(o.isSprite){o.material.map?.dispose();o.material.dispose();}});this.inside.remove(child);}this.labels=this.labels.filter(l=>l.parent);this.targets=this.targets.filter(t=>t.location!=='interior');this.colliders=this.colliders.filter(c=>c.location!=='interior');const h=HOUSES[this.houseId];
  box(this.inside,0,-.18,0,14,.35,12,'#c5a681');for(let x=-6.5;x<7;x+=.8)box(this.inside,x,.006,0,.025,.01,12,'#b09674');box(this.inside,0,2.1,-6,14,4.2,.22,'#e9dbc3');box(this.inside,-7,2.1,0,.22,4.2,12,'#d6d2b9');box(this.inside,0,.22,6,14,.44,.2,'#ad9c7c');box(this.inside,7,.22,0,.2,.44,12,'#ad9c7c');
  this.mounted('window',this.inside,-2,-5.85,2.1,2.55);this.mounted('picture',this.inside,2,-5.84,1.2,2.8);this.sized('bed',this.inside,-4,-3.5,3.4);this.collider(-4,-3.5,2.7,3.3,'interior');this.target('bedroom','sleep',this.houseId===0?'Rest & begin a new day':'Visit the family bedroom',-3,-1,1.8,this.inside);
  this.sized('stove',this.inside,4,-4.8,1.6);this.sized('counter',this.inside,2.3,-4.8,1.8);this.sized('fridge',this.inside,5.8,-4.8,1.5);this.collider(4,-4.7,5,1.8,'interior');this.target('kitchen','cook','Cook a family recipe',3.5,-2.5,1.8,this.inside);
  this.sized('wardrobe',this.inside,-5.8,2.3,2);this.target('wardrobe','wardrobe','Choose an outfit',-4.2,2.5,1.5,this.inside);this.sized('rug_round',this.inside,.5,1,4.5,.03);this.sized('coffee_table',this.inside,.5,1,1.9);
  this.sized('sofa',this.inside,.5,-1.1,3.1);this.collider(.5,-1.1,3,1.3,'interior');this.sized('plant_big',this.inside,6,4,1.7);this.sized('kettle',this.inside,.5,.6,.35,.7);
  if(this.houseId!==0||this.state.upgrades.house>=1){this.sized('bed',this.inside,5,2.8,2.4);this.sized('yarn_basket',this.inside,4.3,4,1);}
  if(this.houseId!==0||this.state.furniture.includes('rug'))this.sized('rug_rect',this.inside,-3.6,2.5,3,.015);
  if(this.houseId!==0||this.state.furniture.includes('sofa')){this.sized('armchair',this.inside,3,.4,1.7);this.sized('floor_lamp',this.inside,3.3,-.8,1.9);}
  if(this.houseId!==0||this.state.furniture.includes('plants'))for(const x of [-6.1,6])this.sized('plant_small',this.inside,x,-4.8,1.4);
  if(this.houseId!==0||this.state.furniture.includes('books'))this.sized('bookshelf',this.inside,-6,-1,2.1,0,Math.PI/2);
  if(this.houseId!==0||this.state.furniture.includes('dining')){this.sized('dining_table',this.inside,-2,3.8,2.2);this.sized('chair',this.inside,-3.5,3.8,1.1);}
  if(this.houseId!==0||this.state.furniture.includes('art')){this.mounted('painting',this.inside,4,-5.8,1.5,2.7);this.mounted('photo',this.inside,-.2,-5.8,.8,2.8);this.sized('globe',this.inside,-6,-.5,1.1,1.1);}
  if(this.houseId===0&&this.state.upgrades.kitchen>=1)this.sized('counter',this.inside,1,-4.8,1.3);if(this.houseId===0&&this.state.upgrades.kitchen>=2)this.sized('stove',this.inside,5.2,-3.6,1.1);if(this.houseId===0&&this.state.upgrades.kitchen>=3)this.sized('plant_small',this.inside,2.3,-4.8,.5,1.1);
  if(this.houseId===0&&this.state.upgrades.house>=2)this.sized('desk',this.inside,0,-4.8,2.1);if(this.houseId===0&&this.state.upgrades.house>=3)this.sized('fireplace',this.inside,0,-5.8,2.2);
  this.target('exit','door','Step outside',0,5.2,1.6,this.inside);this.sized('welcome_mat',this.inside,0,5.1,2.1,.03);
  for(const [i,p]of RESIDENTS.filter(p=>p.home===this.houseId).entries()){const mesh=this.character(p.index%2?'hero-tall':'hero-girl-tall',p.id==='pip'&&this.state.kidOutfit?KID_OUTFITS.find(k=>k.id===this.state.kidOutfit).color:p.color);mesh.scale.multiplyScalar(p.child?.57:.79);mesh.position.set(-1+i*1.7,0,2.7);this.inside.add(mesh);this.target('person',p.id,`Talk to ${p.name}`,-1+i*1.7,2.7,1.1,this.inside);}
 }
 exit(){this.location='village';this.houseId=null;this.outside.visible=true;this.inside.visible=false;this.country.visible=false;this.player.position.copy(this.returnPosition??new T.Vector3(-15,0,0));this.follow.copy(this.player.position);this.clearMovement();this.resize();}
 travel(){this.dismount();this.returnPosition=new T.Vector3(43,0,-1);this.location='country';this.outside.visible=false;this.inside.visible=false;this.country.visible=true;this.player.position.set(-18,0,0);this.follow.copy(this.player.position);this.clearMovement();this.resize();}
 board(id){const ride=this.vehicles.find(v=>v.id===id);if(!ride)return;this.riding=ride;this.player.position.copy(ride.mesh.position);this.clearMovement();}
 dismount(){if(!this.riding)return;const v=this.riding;this.riding=null;for(const [dx,dz]of [[2.5,0],[-2.5,0],[0,2.5],[0,-2.5],[0,0]])if(!this.blocked(v.mesh.position.x+dx,v.mesh.position.z+dz)){this.player.position.set(v.mesh.position.x+dx,0,v.mesh.position.z+dz);break;}const target=this.targets.find(t=>t.type==='vehicle'&&t.id===v.id);target.x=this.player.position.x;target.z=this.player.position.z;target.hit.position.set(target.x,1,target.z);}
 clearMovement(){this.keys.clear();this.stick.x=0;this.stick.y=0;this.path=[];this.pending=null;}
 activeTargets(){return this.targets.filter(t=>t.location===this.location&&(t.type!=='bed'||t.id<bedCount(this.state)));}
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
  if(!this.player)return;const s=this.state,key=JSON.stringify([s.upgrades,s.beds.map(b=>b?[b.crop,b.watered,ripe(s,b)]:null),s.trees,s.outfit,s.body,s.kidOutfit,s.day,s.furniture]);if(!force&&key===this.lastSync)return;this.lastSync=key;
  const outfit=OUTFITS.find(o=>o.id===s.outfit);if(this.player.userData.style!==s.body+s.outfit){const pos=this.player.position.clone(),rot=this.player.rotation.y;this.scene.remove(this.player);this.player.traverse(m=>{if(m.userData.ownedGeometry)m.geometry.dispose();});this.player=this.character(s.body==='boy'?'hero-tall':'hero-girl-tall',outfit.color);this.player.scale.multiplyScalar(.88);this.player.position.copy(pos);this.player.rotation.y=rot;this.player.userData.style=s.body+s.outfit;this.scene.add(this.player);}
  this.cropViews.forEach((view,i)=>{const b=s.beds[i];view.bed.visible=i<bedCount(s);view.group.visible=i<bedCount(s);const k=b?`${b.crop}-${b.watered}-${ripe(s,b)}`:'empty';if(k!==view.key){view.key=k;for(const child of view.group.children){if(!child.isSprite)child.geometry?.dispose();child.material?.dispose();}view.group.clear();if(b){const sprite=new T.Sprite(new T.SpriteMaterial({map:this.cropTextures[b.watered?b.crop:'sprout'],depthWrite:false}));sprite.scale.set(2,2,1);sprite.position.y=.95;view.group.add(sprite);if(ripe(s,b)){const glow=new T.Mesh(new T.RingGeometry(.88,.94,28),new T.MeshBasicMaterial({color:'#e7d383',side:T.DoubleSide}));glow.rotation.x=-Math.PI/2;glow.position.y=.36;view.group.add(glow);}}}view.target.label=!b?'Plant a seed':!b.watered?'Water the '+CROPS[b.crop].name.toLowerCase():ripe(s,b)?'Harvest '+CROPS[b.crop].name.toLowerCase():'Growing · '+Math.ceil(CROPS[b.crop].grow*(1-cropProgress(s,b)))+'s';});
  this.treeViews.forEach((v,i)=>{const t=s.trees[i],k=t?`${t.kind}-${s.day-t.day>=2}`:'';if(k!==v.key){if(v.mesh)v.mesh.removeFromParent();v.key=k;if(t)v.mesh=this.sized('crop_'+t.kind,this.outside,ORCHARD_POSITIONS[i].x,ORCHARD_POSITIONS[i].z,s.day-t.day>=2?4.2:2.2);}});
  this.animals.forEach((a,i)=>a.mesh.visible=i===0||i===2||i===1&&s.upgrades.pen>=1||i===3&&s.upgrades.pen>=2||i===4&&s.upgrades.pen>=3);
  const pip=this.npcs.find(n=>n.p.id==='pip');if(pip&&pip.mesh.userData.look!==s.kidOutfit){const color=new T.Color(KID_OUTFITS.find(k=>k.id===s.kidOutfit)?.color??pip.p.color);pip.mesh.traverse(m=>{if(m.isMesh&&m.userData.shirtVertices){const attribute=m.geometry.getAttribute('color');for(const i of m.userData.shirtVertices)attribute.setXYZ(i,color.r,color.g,color.b);attribute.needsUpdate=true;}});pip.mesh.userData.look=s.kidOutfit;}
  this.groundMesh.material.color.set(['#5cc93a','#46b52e','#a9b83a','#e4f0f2'][Math.floor((s.day-1)/7)%4]);this.fields.season(this.groundMesh.material.color);
  HOUSES[0].group.scale.y=1+s.upgrades.house*.07;
  if(this.location==='interior')this.buildInterior();
 }
 burst(color='#e9c16b'){for(let i=0;i<10;i++){const mesh=new T.Mesh(sphere,mat(color));mesh.scale.setScalar(.1);mesh.position.copy(this.player.position).add(new T.Vector3(0,1,0));this.scene.add(mesh);this.particles.push({mesh,life:1,v:new T.Vector3((rand()-.5)*3,1+rand()*3,(rand()-.5)*3)});}}
 setFishing(active,simulation=null){this.fishing=active?simulation:null;if(active)this.rodFishing.start(simulation);else this.rodFishing.cancel();this.resize();}
 update(dt){
  if(!this.ready){this.renderer.render(this.scene,this.camera);return;}this.t+=dt;const s=this.state;
  if(!this.paused){let x=(this.keys.has('d')||this.keys.has('arrowright')?1:0)-(this.keys.has('a')||this.keys.has('arrowleft')?1:0)+this.stick.x,z=(this.keys.has('s')||this.keys.has('arrowdown')?1:0)-(this.keys.has('w')||this.keys.has('arrowup')?1:0)+this.stick.y;
   // Screen-relative movement, consistent for keyboard and touch.
   let dx=x*Math.cos(this.yaw)+z*Math.sin(this.yaw),dz=-x*Math.sin(this.yaw)+z*Math.cos(this.yaw);if(Math.hypot(x,z)>.05){this.path=[];this.pending=null;}else if(this.path.length){const p=this.path[0];dx=p.x-this.player.position.x;dz=p.z-this.player.position.z;if(Math.hypot(dx,dz)<.22)this.path.shift();}
   const length=Math.hypot(dx,dz);if(this.riding)this.riding.driveSpeed=T.MathUtils.damp(this.riding.driveSpeed??0,length>.05?this.riding.speed:0,5,dt);const speed=this.riding?this.riding.driveSpeed:this.keys.has('shift')?7:4.8;let moving=false;if(length>.05){dx/=length;dz/=length;const nx=this.player.position.x+dx*dt*speed,nz=this.player.position.z+dz*dt*speed;if(!this.blocked(nx,this.player.position.z)){this.player.position.x=nx;moving=true;}if(!this.blocked(this.player.position.x,nz)){this.player.position.z=nz;moving=true;}const desired=Math.atan2(dx,dz);this.player.rotation.y+=Math.atan2(Math.sin(desired-this.player.rotation.y),Math.cos(desired-this.player.rotation.y))*Math.min(1,dt*12);}
   if(this.pending&&Math.hypot(this.player.position.x-this.pending.x,this.player.position.z-this.pending.z)<this.pending.r*.82){const target=this.pending;this.path=[];this.pending=null;this.onInteract(target);}
   this.animatePerson(this.player,moving?.5:0,this.t*(this.keys.has('shift')?13:9));this.player.position.y=moving&&!this.riding?Math.abs(Math.sin(this.t*9))*.065:0;
   if(this.riding){this.riding.mesh.position.set(this.player.position.x,0,this.player.position.z);this.riding.mesh.rotation.y=this.player.rotation.y+Math.PI;this.player.position.y=.7;this.animatePerson(this.player,-.6,1);}
   if(this.location==='village'){s.position={x:this.player.position.x,z:this.player.position.z};
    for(const n of this.npcs){const atWork=s.time>9&&s.time<17;const tx=atWork?n.homeX*.6+Math.sin(n.p.index)*4:n.homeX,tz=atWork?n.homeZ*.55+Math.cos(n.p.index)*3:n.homeZ;const dx=tx-n.mesh.position.x,dz=tz-n.mesh.position.z,d=Math.hypot(dx,dz);let walk=d>.4;if(walk){const nx=n.mesh.position.x+dx/d*dt*.7,nz=n.mesh.position.z+dz/d*dt*.7;if(!this.blocked(nx,nz))n.mesh.position.set(nx,0,nz);else walk=false;n.mesh.rotation.y=Math.atan2(dx,dz);}this.animatePerson(n.mesh,walk?.35:.025,this.t*6+n.p.index);n.target.x=n.mesh.position.x;n.target.z=n.mesh.position.z;n.target.hit.position.set(n.target.x,1,n.target.z);const shadow=Math.hypot(n.target.x-this.player.position.x,n.target.z-this.player.position.z)<23;n.mesh.traverse(m=>{if(m.isMesh)m.castShadow=shadow;});}
   }
  }
  if(this.location==='village'){this.fields.update(this.player.position);this.birds.update(this.t,this.player.position);}
  this.rain.visible=calendar(s).rain&&this.location!=='interior';if(this.rain.visible){const a=this.rainGeometry.getAttribute('position');for(let i=0;i<120;i++){const x=this.player.position.x+Math.sin(i*71.3)*24,z=this.player.position.z+Math.cos(i*17.9)*24,y=(i*.47-this.t*11)%12+12;a.setXYZ(i*2,x,y,z);a.setXYZ(i*2+1,x-.18,y-.8,z);}a.needsUpdate=true;}
  for(const f of this.fishes){const angle=this.t*.25+f.phase;f.mesh.position.set(13+Math.cos(angle)*f.r,.21,10+Math.sin(angle)*f.r*.57);f.mesh.rotation.y=-angle;}
  for(const a of this.animals){a.mesh.position.x=a.x+Math.sin(this.t*.22+a.phase)*.55;a.mesh.position.z=a.z+Math.cos(this.t*.27+a.phase)*.55;a.mesh.rotation.y=Math.sin(this.t*.2+a.phase)*.8;a.mesh.position.y=Math.abs(Math.sin(this.t*3+a.phase))*.025;}
  for(const [i,view]of this.cropViews.entries()){const b=s.beds[i],sprite=view.group.children[0];if(sprite?.isSprite){const size=b.watered?.7+cropProgress(s,b)*1.2:1;sprite.scale.set(size,size,1);sprite.position.y=.45+size*.4;}}
  for(const p of this.particles){p.life-=dt;p.mesh.position.addScaledVector(p.v,dt);p.v.y-=dt*4;p.mesh.scale.setScalar(Math.max(0,p.life)*.12);}this.particles=this.particles.filter(p=>{if(p.life<=0){p.mesh.removeFromParent();return false;}return true;});
  this.rodFishing.update(dt,this.t);
  const focus=this.location==='interior'?v3.set(0,0,0):this.fishing?v3.copy(this.player.position).lerp(new T.Vector3(12,0,12),.4):this.player.position;this.follow.lerp(focus,1-Math.exp(-dt*4));const d=this.location==='interior'?24:45;this.camera.position.set(this.follow.x+Math.sin(this.yaw)*d,this.follow.y+d*.87,this.follow.z+Math.cos(this.yaw)*d);this.camera.lookAt(this.follow.x,0,this.follow.z);
  const sunset=T.MathUtils.clamp((s.time-16)/6,0,1);this.sun.intensity=3.4-sunset*1.7;this.sun.color.set(sunset>.45?'#efb180':'#fff0ce');this.ambient.intensity=2.2-sunset*.6;this.sun.position.set(this.follow.x-24,42,this.follow.z+22);this.sun.target.position.set(this.follow.x,0,this.follow.z);
  for(const label of this.labels)label.visible=this.location==='interior'||Math.hypot(label.position.x-this.player.position.x,label.position.z-this.player.position.z)<30;
  this.playerRing.position.set(this.player.position.x,.05,this.player.position.z);const nearest=this.nearest();this.targetRing.visible=!!nearest&&nearest.type!=='dismount'&&!this.paused;if(this.targetRing.visible)this.targetRing.position.set(nearest.x,.06,nearest.z);this.renderer.render(this.scene,this.camera);
 }
 project(x,z,y=0){const p=new T.Vector3(x,y,z).project(this.camera);return{x:(p.x*.5+.5)*innerWidth,y:(-.5*p.y+.5)*innerHeight};}
 get metrics(){return{drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures,fields:this.fields?.metrics,birds:this.birds?.metrics,homeGuide:this.player?this.homeGuide:null,fishing:this.rodFishing?.metrics};}
}
