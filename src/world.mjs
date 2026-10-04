import * as T from 'three';
import {OpenFields,FieldBirds} from './fields.mjs';
import {HOMESTEAD,homeBearing,inVillage} from './field-layout.mjs';
import {isWide} from './tree-blocks.mjs';
import {findRoute,edgeObstacles,worldPoint,ROUTE_PAD} from './navigation.mjs';
import {CELL,HALF,EDGE_PAD,inWorld,edgeDistance,edgeAhead} from './regions.mjs';
import {inSafeZone,wildDepth} from './ward.mjs';
import {LIGHTS} from './region-life.mjs';
import {landLightAt} from './light-mix.mjs';
import {RodFishingView} from './rod-fishing.mjs';import {atBank} from './pond.mjs';
import {buildInteriorRoom} from './interior.mjs';
import {toon,kitMaterial,LIGHT,noise2} from './toon.mjs';import {installBorders} from './borders.mjs';
import {HOMES,WOODLAND,PARKING} from './content.mjs';import {GroveView} from './grove-view.mjs';import {villageTrees,villageTufts,villageFlowers,gatherSpots,SUPER_PROPS} from './village-plan.mjs';import {buildMarketRow} from './village-view.mjs';import {placeOf,slotOf} from './villagers.mjs';import {VillagersView} from './villagers-view.mjs';import {buildLanes,buildLot,wayGuard} from './lots-view.mjs';import {WORKSHOP,GATE,WINDMILL} from './content.mjs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries,mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { HOUSES,CIVIC,ROADS,POND,FISH_SPOT,WORKPLACE,RESIDENTS,OUTFITS,KID_OUTFITS,BED_POSITIONS,ORCHARD_POSITIONS,RACE_POINTS,CROPS } from './content.mjs';
import { bedCount,ripe,cropProgress,calendar,CHOP_COST,HOME_SPOT } from './game.mjs';
import { buildAvatar,playerAvatar,playerWants,styleKey,disposeAvatar,tintShirt,preloadAvatar,syncCompanion,updateCompanion,walkAvatar,PLAYER_SCALE } from './avatar.mjs';
import { newGait } from './walk-cycle.mjs';
import { WALK,SPAWN } from './home-plan.mjs';
import { SUN_OFFSET,fitShadow,followSun } from './sun-shadow.mjs';
import { DriveView,DRIVE_CAMERA } from './drive-view.mjs';
import { FAR_VIEW,SHADOW_VIEW,shadowShare,cameraRig } from './drive.mjs';

// Where each vehicle is parked (round 8): its mesh and facing, the model's length, and the spot you board it from with its reach.
// A vehicle left anywhere else is boarded at the vehicle itself, within AWAY_REACH (you step out 2.5 m beside it).
export const PARK={
 jeep:{model:'jeep',size:4.8,x:46,z:-15,rot:0,tx:46,tz:-12,r:2.8,label:'Borrow the Bell family jeep'},
 bike:{model:'motorcycle',size:2.8,x:5,z:-8,rot:Math.PI/2,tx:5,tz:-6,r:2,label:'Ride the motorcycle'},
};
const AWAY_REACH=3.2;
// The outdoors' outer box: the 5 x 5 grid less the pad. The thirteen squares' own outline is edgeDepth's.
const OUTDOORS={x:HALF-EDGE_PAD,z:HALF-EDGE_PAD};
// Home (spec 8): nearer the ward than `magic` metres (beyond its line, ward.mjs wildDepth) the Home button walks or drives; farther out it is
// the magic hop. The hop: a rainbow ring grows for `charge` seconds (`wary` while a creature is angry at you; a blow then cancels it),
// the screen fades to white in `fade` seconds, you land, and the white lifts once the ground round home is built.
export const HOME={magic:20,charge:.6,wary:3,fade:.25};
const RAINBOW=['#ff4d5e','#ff9f3f','#ffe14d','#5fd66a','#4cc3ff','#6f7bff','#c66bff'];

const mats=new Map();
const mat=c=>{if(!mats.has(c))mats.set(c,toon({color:c}));return mats.get(c);};
const cube=new T.BoxGeometry(1,1,1), sphere=new T.IcosahedronGeometry(1,1);
const v3=new T.Vector3(), dummy=new T.Object3D(), WATER=new T.Plane(new T.Vector3(0,1,0),-.3); // the pond's surface, 0.3 m up: where a tap on the water lands
function box(parent,x,y,z,w,h,d,c){const m=new T.Mesh(cube,mat(c));m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function orb(parent,x,y,z,r,c){const m=new T.Mesh(sphere,mat(c));m.position.set(x,y,z);m.scale.setScalar(r);m.castShadow=true;parent.add(m);return m;}
function cylinder(parent,x,y,z,r,h,c,segments=12){const m=new T.Mesh(new T.CylinderGeometry(r,r,h,segments),mat(c));m.position.set(x,y,z);m.receiveShadow=true;parent.add(m);return m;}
function rng(seed=18){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
const rand=rng();
const flatMaterial=toon({vertexColors:true});
// Bake static coloured parts to one opaque draw, preserving authored surface normals.
// With `glow` (the scenery kits, builder A): each vertex also keeps its material's emissive strength in a `glow` attribute (0 for a
// plain material), so a kit's crystals, lava and embers still glow after they are merged (toon.mjs glowToon adds colour x glow).
// With `cell` (metres): one indexed mesh per cell of the ground grid instead of one for everything, so the frustum (and the
// shadow camera's) drops the cells out of view; one mesh spanning the village was drawn from every square around it.
// Pieces under 1 m (beds, paths, fences, benches) go to a cell mesh of their own that casts no shadow (spec 18: shadows from 1 m up).
function bake(source,glow=false,cell=0){
 source.updateMatrixWorld(true);const pieces=[],extra=[];
 source.traverse(m=>{if(!m.isMesh)return;const materials=Array.isArray(m.material)?m.material:[m.material];
   for(let j=0;j<materials.length;j++){const material=materials[j];if(material.transparent&&material.opacity<.9){const copy=m.clone();copy.geometry=m.geometry;copy.applyMatrix4(m.parent.matrixWorld);extra.push(copy);continue;}
     const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();const pos=g.getAttribute('position'),normal=g.getAttribute('normal');
     const group=Array.isArray(m.material)?g.groups.find(q=>q.materialIndex===j):null;if(Array.isArray(m.material)&&!group){g.dispose();continue;}
     const start=group?.start??0,count=group?.count??pos.count,geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos.array.slice(start*3,(start+count)*3),3));
     if(normal)geo.setAttribute('normal',new T.Float32BufferAttribute(normal.array.slice(start*3,(start+count)*3),3));else geo.computeVertexNormals();
     const colors=new Float32Array(count*3),c=material.color??new T.Color('white'),vc=material.vertexColors?g.getAttribute('color'):null;for(let i=0;i<count;i++)colors.set([c.r*(vc?vc.getX(i+start):1),c.g*(vc?vc.getY(i+start):1),c.b*(vc?vc.getZ(i+start):1)],i*3);geo.setAttribute('color',new T.BufferAttribute(colors,3));if(glow){const e=material.emissive,lit=e&&e.r+e.g+e.b>0?material.emissiveIntensity??1:0;geo.setAttribute('glow',new T.BufferAttribute(new Float32Array(count).fill(lit),1));}geo.applyMatrix4(m.matrixWorld);pieces.push(geo);g.dispose();
   }
 });
 const out=new T.Group(),cells=new Map();for(const p of pieces){let k=0;if(cell){p.computeBoundingBox();const b=p.boundingBox;const low=b.max.y<1,size=low?cell*2:cell;k=`${Math.floor((b.min.x+b.max.x)/2/size)},${Math.floor((b.min.z+b.max.z)/2/size)},${low?'low':''}`;}cells.get(k)?.push(p)??cells.set(k,[p]);}
 for(const [k,list] of cells){let g=mergeGeometries(list);list.forEach(p=>p.dispose());if(cell){const s=mergeVertices(g);g.dispose();g=s;}const m=new T.Mesh(g,flatMaterial);m.castShadow=m.userData.casts=!`${k}`.endsWith('low');g.computeBoundingBox();m.receiveShadow=true;out.add(m);}extra.forEach(m=>out.add(m));return out;
}
// Bake a kit node with some materials recoloured, e.g. each family's roof.
// One piece of a scenery kit as a single mesh on the shared kit material: colours and glow baked, an optional recolour by material name.
function bakeKit(node,tints){const root=new T.Group(),copy=node.clone(true);copy.position.set(0,0,0);if(tints)copy.traverse(m=>{if(!m.isMesh)return;m.material=(Array.isArray(m.material)?m.material:[m.material]).map(x=>{if(!tints[x.name])return x;const c=x.clone();c.color=new T.Color(tints[x.name]);return c;});if(m.material.length===1)m.material=m.material[0];});root.add(copy);
 const mesh=bake(root,true).children.find(m=>m.geometry?.getAttribute('glow'));if(!mesh)return null;mesh.removeFromParent();mesh.material=kitMaterial();mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox,glow=mesh.geometry.getAttribute('glow');let lit=0;for(let i=0;i<glow.count;i++)lit=Math.max(lit,glow.getX(i));
 mesh.name=node.name;mesh.userData={height:Math.max(0,box.max.y),radius:Math.max(-box.min.x,box.max.x,-box.min.z,box.max.z),glow:lit};return mesh;}
function bakeTinted(node,tints){const root=new T.Group(),copy=node.clone(true);copy.position.set(0,0,0);copy.traverse(m=>{if(!m.isMesh)return;m.material=(Array.isArray(m.material)?m.material:[m.material]).map(x=>{const c=x.clone();if(tints[x.name])c.color=new T.Color(tints[x.name]);return c;});if(m.material.length===1)m.material=m.material[0];});root.add(copy);return bake(root);}
function labelTexture(text){const c=document.createElement('canvas');c.width=512;c.height=100;const g=c.getContext('2d');g.font='900 40px Nunito, sans-serif';g.textAlign='center';g.lineJoin='round';g.lineWidth=10;g.strokeStyle='#3a2433';g.strokeText(text,256,64,490);g.fillStyle='#ffffff';g.fillText(text,256,64,490);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;}

export class World{
 constructor(canvas,state,onInteract){
  this.canvas=canvas;this.state=state;this.onInteract=onInteract;this.scene=new T.Scene();this.scene.background=new T.Color('#9fdcff');this.scene.fog=new T.Fog('#bfe8ff',80,160);
  this.renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.NoToneMapping;
  this.renderer.shadowMap.type=T.PCFShadowMap;this.camera=new T.OrthographicCamera(-30,30,20,-20,.1,220);this.zoom=15;this.follow=new T.Vector3(-12,0,3);this.yaw=.38;
  this.ambient=new T.HemisphereLight(LIGHT.sky,LIGHT.ground,LIGHT.hemi);this.scene.add(this.ambient);this.sun=new T.DirectionalLight(LIGHT.sun,LIGHT.sunIntensity);this.sun.position.set(...SUN_OFFSET);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);this.scene.add(this.sun);this.scene.add(this.sun.target); // the shadow box, its biases and the texel snap: aimSun() (sun-shadow.mjs)
  this.outside=new T.Group();this.inside=new T.Group();this.scene.add(this.outside,this.inside);this.inside.visible=false;this.location='village';this.houseId=null;
  const rainPositions=new Float32Array(120*6);this.rainGeometry=new T.BufferGeometry();this.rainGeometry.setAttribute('position',new T.BufferAttribute(rainPositions,3));this.rain=new T.LineSegments(this.rainGeometry,new T.LineBasicMaterial({color:'#d8eeee',transparent:true,opacity:.55}));this.rain.frustumCulled=false;this.rain.visible=false;this.scene.add(this.rain);
  this.assets=new Map();this.raw=new Map();this.targets=[];this.colliders=[];this.keys=new Set();this.stick={x:0,y:0};this.path=[];this.pending=null;this.npcs=[];this.animals=[];this.fishes=[];this.markers=[];this.labels=[];this.vehicles=[];this.riding=null;this.particles=[];this.t=0;this.lastSync='';this.paused=true;this.ready=false;this.cropViews=[];this.treeViews=[];this.raycast=new T.Raycaster();this.pointer=new T.Vector2();this.plane=new T.Plane(new T.Vector3(0,1,0),0);this.interactTimer=0;
  // Round 8 seams (step 0). kits: baked kit pieces under 'kit/child' (loadKit, builder A). followers: [{moveTo(x, z)}], brought along
  // by Home and a knock-out (builder C calls them; builder E registers a friend). fogBase: the fog colour before any land's tint; the
  // Pandora box writes it, applyLights copies it to the fog (the one writer). landShare: how far into a land's own light you are, 0 to 1.
  this.kits=new Map();
  this.kitScenes=new Map(); // kit name -> its loaded scene (tinted copies are baked from it later)
  this.kitJobs=new Map();
  this.followers=[];
  this.fogBase=this.scene.fog.color.clone();
  this.landShare=0;
  // applyLights' own: the home values it starts from every frame, each land's row as colours (made on first use), and where the light was last read.
  this.lightBase={sky:new T.Color(LIGHT.sky),ground:new T.Color(LIGHT.ground),background:this.scene.background.clone()};
  this.landLights=new Map();
  this.lightAt={id:null,share:0};
  this.landCalls={walk:0,step:0,car:0}; // how often world.lands was asked (the suites check that the calls are made)
  this.rig={};this.walkAsk={dx:0,dz:0,speed:0,riding:false};this.landAt={x:0,z:0,riding:false,box:false};this.nodeReach=.22;this.homing=null;this.edgeTold=false;this.shadowsOff=false;
  this.applyQuality();this.resize();window.addEventListener('resize',()=>this.resize());
  canvas.addEventListener('wheel',e=>{e.preventDefault();this.setZoom(this.zoom*Math.exp(e.deltaY*.0012));},{passive:false});
  let down=null;const touches=new Map();let pinch=0;const spread=()=>{const [a,b]=[...touches.values()];return Math.hypot(a.x-b.x,a.y-b.y);};
  canvas.addEventListener('pointerdown',e=>{touches.set(e.pointerId,{x:e.clientX,y:e.clientY});if(touches.size===2){pinch=spread();down=null;}else down={x:e.clientX,y:e.clientY};});
  canvas.addEventListener('pointermove',e=>{if(!touches.has(e.pointerId))return;touches.set(e.pointerId,{x:e.clientX,y:e.clientY});if(touches.size===2&&pinch){const now=spread();this.setZoom(this.zoom*pinch/Math.max(1,now));pinch=now;}});
  const lift=e=>{touches.delete(e.pointerId);if(touches.size<2)pinch=0;};canvas.addEventListener('pointercancel',lift);
  canvas.addEventListener('pointerup',e=>{const wasPinch=touches.size>1;lift(e);if(!wasPinch&&down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<12&&!this.paused)this.click(e);down=null;});
 }
 // The wheel and the pinch: the view's own half-height, 6 to 42 m. In the far view (drive.mjs farZoom) the driving camera holds the picture
 // still while this changes under it, so zooming in out there changes nothing on the screen (and does not dip in and ease back out).
 setZoom(zoom){const before=this.zoom;this.zoom=T.MathUtils.clamp(zoom,6,42);if(this.zoom!==before)this.drive?.keepView(before,this.zoom);this.resize();}
 applyQuality(){const q=this.state.settings.quality;this.renderer.setPixelRatio(Math.min(devicePixelRatio,q==='high'?2:q==='battery'?1:1.5));this.renderer.shadowMap.enabled=q!=='battery';if(this.sun){this.sun.shadow.mapSize.set(q==='high'?2048:1024,q==='high'?2048:1024);this.sun.shadow.map?.dispose();this.sun.shadow.map=null;this.renderer.shadowMap.needsUpdate=true;}this.resize();}
 resize(){const w=innerWidth,h=innerHeight;this.renderer.setSize(w,h,false);const aspect=w/h,scale=this.location==='interior'?(aspect<.8?19:10):this.zoom*(aspect<.8?1.35:1);this.camera.left=-scale*aspect;this.camera.right=scale*aspect;this.camera.top=scale;this.camera.bottom=-scale;this.camera.updateProjectionMatrix();}
 async init(progress){
  const files=['rural','town','supermarket','scenery','farm','fish','house','crops','fruit_crops','hero-tall','hero-girl-tall','market-stall','equipment-stall','well','kitchen','storage-chest','garden-bed','jeep','motorcycle','forest-birds','field-gull'];
  let n=0;
  await Promise.all(files.map(async name=>{let gltf;try{gltf=await new GLTFLoader().loadAsync(`./assets/models/${name}.glb`);}catch(error){if(name!=='rural')throw error;progress(++n/files.length);return;}this.raw.set(name,gltf.scene);
   if(['rural','town','supermarket','scenery','farm','fish','house','crops','fruit_crops'].includes(name)){for(const child of gltf.scene.children){const root=new T.Group(),copy=child.clone(true);copy.position.set(0,0,0);root.add(copy);this.assets.set(child.name,bake(root));}}
   else if(!name.startsWith('hero')&&!['forest-birds','field-gull'].includes(name)){if(name==='jeep')gltf.scene.getObjectByName('jeep_Turret')?.removeFromParent();this.assets.set(name,bake(gltf.scene));}progress(++n/files.length);
  }));
  this.drive=new DriveView(this); // driving: drive-view.mjs (made before the village, so it hears of every tree)
  this.buildVillage();
  this.fields=new OpenFields(this);
  this.birds=new FieldBirds(this,bake);
  this.borders=installBorders(this); // the rainbow ribbon along every border (borders.mjs): after buildVillage, which bakes what stands outside into one mesh
  this.rodFishing=new RodFishingView(this);
  await preloadAvatar(this,playerWants(this)).catch(()=>{});
  this.refreshPlayer();
  this.player.position.set(this.state.position.x,0,this.state.position.z);
  this.grove.sync(this.state);
  /* cleared trees stop blocking first: a save made on a stump or beside a fruit tree stays there */const lost=this.blocked(this.player.position.x,this.player.position.z);
  if(lost)this.player.position.set(HOME_SPOT.x,0,HOME_SPOT.z);
  this.restoreVehicles(lost); // each car where it was left, and you in the one you were driving (a place that could not be kept parks them all)
  this.homeFade=document.createElement('div');
  this.homeFade.id='home-fade';
  this.homeFade.setAttribute('aria-hidden','true');
  (this.canvas.parentElement??document.body).appendChild(this.homeFade);
  this.playerRing=new T.Mesh(new T.RingGeometry(.67,.83,40),new T.MeshBasicMaterial({color:'#fff2be',transparent:true,opacity:.7,side:T.DoubleSide,forceSinglePass:true}));
  this.playerRing.rotation.x=-Math.PI/2;
  this.scene.add(this.playerRing);
  this.targetRing=new T.Mesh(new T.RingGeometry(.8,1,36),new T.MeshBasicMaterial({color:'#ffe4a1',transparent:true,opacity:.85,side:T.DoubleSide,forceSinglePass:true}));
  this.targetRing.rotation.x=-Math.PI/2;
  this.targetRing.visible=false;
  this.scene.add(this.targetRing);
  this.fields.update(this.player.position);
  this.makeCropSprites();
  this.portraitUrl=this.portrait();
  this.sync(true);
  this.follow.copy(this.player.position);
  this.ready=true;
 }
 // Render a model to a small transparent picture, like the reference's model icons.
 snapshot(scene,camera,size){const target=new T.WebGLRenderTarget(size,size,{samples:4});target.texture.colorSpace=T.SRGBColorSpace;const old=this.renderer.getClearColor(new T.Color()),alpha=this.renderer.getClearAlpha();this.renderer.setClearColor(0,0);this.renderer.setRenderTarget(target);this.renderer.clear();this.renderer.render(scene,camera);const px=new Uint8Array(size*size*4);this.renderer.readRenderTargetPixels(target,0,0,size,size,px);this.renderer.setRenderTarget(null);this.renderer.setClearColor(old,alpha);target.dispose();
  const c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d'),img=g.createImageData(size,size);for(let y=0;y<size;y++)img.data.set(px.subarray((size-1-y)*size*4,(size-y)*size*4),y*size*4);g.putImageData(img,0,0);return c.toDataURL('image/png');}
 iconScene(){const scene=new T.Scene();scene.add(new T.HemisphereLight(LIGHT.sky,LIGHT.ground,1.8));const sun=new T.DirectionalLight(LIGHT.sun,2.2);sun.position.set(3,7,5);scene.add(sun);return scene;}
 modelIcon(name,size=160){this.iconCache??=new Map();if(this.iconCache.has(name))return this.iconCache.get(name);const src=this.assets.get(name);if(!src)return null;const scene=this.iconScene(),o=src.clone(true);scene.add(o);o.updateMatrixWorld(true);
  const box=new T.Box3().setFromObject(o),c=box.getCenter(new T.Vector3()),r=box.getSize(new T.Vector3()).length()/2*.82,cam=new T.OrthographicCamera(-r,r,r,-r,.01,r*20);cam.position.copy(c).add(new T.Vector3(r*1.7,r*1.9,r*2.9));cam.lookAt(c);
  const url=this.snapshot(scene,cam,size);this.iconCache.set(name,url);return url;}
 portrait(){if(!this.player)return '';const scene=this.iconScene(),p=playerAvatar(this);p.rotation.set(0,.4,0);scene.add(p);p.updateMatrixWorld(true);const h=p.userData.parts.head.getWorldPosition(new T.Vector3()).y+.42,cam=new T.PerspectiveCamera(26,1,.05,30);cam.position.set(.45,h+.15,2.55);cam.lookAt(0,h,0);const url=this.snapshot(scene,cam,144);disposeAvatar(p);return url;}
 asset(name,parent,x,z,scale=1,y=0,rotation=0){const src=this.assets.get(name);if(!src)return new T.Group();const o=src.clone(true);o.position.set(x,y,z);o.scale.setScalar(scale);o.rotation.y=rotation;parent.add(o);return o;}
 sized(name,parent,x,z,size,y=0,rotation=0){const src=this.assets.get(name);if(!src)return new T.Group();const bounds=new T.Box3().setFromObject(src),dim=bounds.getSize(new T.Vector3());return this.asset(name,parent,x,z,size/Math.max(dim.x,dim.z,dim.y),y,rotation);}
 mounted(name,parent,x,z,size,centerY){const src=this.assets.get(name),bounds=new T.Box3().setFromObject(src),dim=bounds.getSize(new T.Vector3()),scale=size/Math.max(dim.x,dim.y,dim.z);return this.asset(name,parent,x,z,scale,centerY-bounds.getCenter(new T.Vector3()).y*scale);}
 character(model,color){return buildAvatar(this,{look:model==='hero-tall'?'boy-tall-none-none':'girl-tall-none-none',outfitColor:color});}
 // The player's avatar (avatar.mjs): the saved look, shirt colour and gear, or what is being tried on (this.tryOn, never saved).
 refreshPlayer(){const old=this.player,a=playerAvatar(this,()=>{if(this.player?.userData.pending)this.refreshPlayer();});a.scale.multiplyScalar(PLAYER_SCALE);if(old){a.position.copy(old.position);a.rotation.y=old.rotation.y;this.scene.remove(old);disposeAvatar(old);}this.player=a;this.scene.add(a);syncCompanion(this);if(this.ready&&!this.tryOn)this.portraitUrl=this.portrait();}
 setTryOn(tryOn){this.tryOn=tryOn;this.refreshPlayer();if(tryOn)this.player.rotation.y=this.location==='interior'?0:this.yaw;if(tryOn&&this.location!=='interior'&&this.zoomBefore==null){this.zoomBefore=this.zoom;this.zoom=Math.min(this.zoom,7);}else if(!tryOn&&!this.previewColor&&this.zoomBefore!=null){this.zoom=this.zoomBefore;this.zoomBefore=null;}this.resize();}
 animatePerson(person,amount,phase){person.userData.limbs.forEach((limb,i)=>{if(limb)limb.rotation.x=Math.sin(phase+(i%2?Math.PI:0))*amount;});}
 target(type,id,label,x,z,r=2,parent=this.outside,y=0){const spot={type,id,label,x,z,y,r,location:parent===this.outside?'village':'interior'};const hit=new T.Mesh(new T.BoxGeometry(r*1.4,type==='house'?5:2.5,r*1.4),new T.MeshBasicMaterial());hit.position.set(x,y+1.1,z);hit.visible=false;hit.userData.target=spot;parent.add(hit);spot.hit=hit;this.targets.push(spot);wayGuard(spot);return spot;}
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
 homeModel(level){const rural=this.raw.get('rural'),node=level>0?rural?.getObjectByName('home_t'+level):null;if(node){const o=bakeTinted(node,{'Roof':'#EF5A3C','Roof Trim':'#B9372A','Accent':'#38A8EE','Siding':'#FFF4DE'});if(level===1)o.scale.setScalar(1.15);return o;}if(level===0)return bakeTinted(this.raw.get('town').getObjectByName('house_gable'),{'Roof':'#EF5A3C','Roof Trim':'#B9372A','Accent':'#38A8EE'});const o=bakeTinted(this.raw.get('town').getObjectByName(['house_round','house_hip','house_gable','house_tall'][level]),{'Roof':'#EF5A3C','Roof Trim':'#B9372A','Accent':'#38A8EE'});o.scale.setScalar([.8,.92,1,1.08][level]);return o;}
 buildHome(){const h=HOUSES[0],g=new T.Group();g.position.set(h.x,0,h.z);this.outside.add(g);h.group=g;this.homeLevel=-1;this.collider(h.x,h.z,9.4,6.8);this.target('house',0,`Enter ${h.name}`,h.x,h.z+5,2.2);this.sign(this.outside,'HOME · VILLAGE LEADER',h.x,h.z,8.6);this.refreshHome();}
 refreshHome(){const level=this.state.upgrades.house,g=HOUSES[0].group;if(!g||level===this.homeLevel)return;this.homeLevel=level;for(const c of [...g.children]){c.traverse(m=>{if(m.isMesh)m.geometry.dispose();});g.remove(c);}g.add(this.homeModel(level));}
 buildCivic(c){this.asset(c.id,this.outside,c.x,c.z);this.collider(c.x,c.z,c.w,c.d);this.target(c.shop?'shop':'civic',c.id,c.verb,c.x,c.z+c.d/2+1.8,2.2);this.sign(this.outside,c.name.toUpperCase(),c.x,c.z-1,c.h);} // a civic building with `shop` is a shop: its door opens the shop panel (the supermarket)
 // A white picket fence or split-rail fence from (x1,z1) to (x2,z2), in kit segments.
 fence(x1,z1,x2,z2,kind='picket_fence',gap=null){const len=Math.hypot(x2-x1,z2-z1),seg=kind==='picket_fence'?2:2.5,n=Math.max(1,Math.round(len/seg)),angle=Math.atan2(-(z2-z1),x2-x1);
  for(let i=0;i<n;i++){const t=(i+.5)/n,x=x1+(x2-x1)*t,z=z1+(z2-z1)*t;if(gap&&Math.hypot(x-gap.x,z-gap.z)<gap.r)continue;
   if(this.assets.has(kind)){const o=this.asset(kind,this.outside,x,z,1,0,angle);o.scale.x=len/n/seg;}
   else{const g=new T.Group();g.position.set(x,0,z);g.rotation.y=angle;this.outside.add(g);for(const y of [.35,.7])box(g,0,y,0,len/n,.08,.06,'#fffaf0');for(let k=0;k<5;k++)box(g,-len/n/2+.2+k*(len/n-.4)/4,.45,0,.14,.9,.06,'#fffaf0');}}}
 mailbox(x,z,rot=0){if(this.assets.has('mailbox')){this.asset('mailbox',this.outside,x,z,1,0,rot);return;}const g=new T.Group();g.position.set(x,0,z);g.rotation.y=rot;this.outside.add(g);box(g,0,.55,0,.12,1.1,.12,'#8a4b25');box(g,0,1.15,0,.36,.34,.62,'#3f6fd8');box(g,.2,1.3,.1,.04,.28,.06,'#ef3b3b');}
 buildVillage(){
  const R=ROADS,flat=(x,z,w,d,c,y=.008)=>{const p=box(this.outside,x,y,z,w,.02,d,c);p.castShadow=false;return p;};
  this.groundMesh=this.ground(this.outside,1024,1024,'#3f8f4a');
  // The county road: an asphalt ring with a dashed yellow centre line.
  const road=(x,z,w,d)=>{flat(x,z,w,d,'#6c7486',.01);const along=w>d,len=along?w:d;for(let t=-len/2+2;t<len/2-1.5;t+=4)flat(along?x+t:x,along?z:z+t,along?1.8:.24,along?.24:1.8,'#ffd23f',.024);};
  road(0,R.north,R.east*2+5,5);road(0,R.south,R.east*2+5,5);road(R.west,(R.north+R.south)/2,5,R.south-R.north-5);road(R.east,(R.north+R.south)/2,5,R.south-R.north-5);road(R.east+8,0,11,5);
  const gravel='#f2d38e';
  // Homestead lanes: front lane to the south road, a farm track to the barn and the pond.
  flat(0,(-10+R.south)/2,3.4,R.south-(-10),gravel);flat(10,-11.5,18,2.6,gravel);flat(6,12.2,10,2.4,gravel);flat(0,(R.north+(-17.5))/2,2.6,R.north*-1-17.5,gravel);
  for(const c of CIVIC)this.buildCivic(c);
  // The supermarket's walk (crates, trolley bay, planters, bench) and its parking: asphalt off the north-east corner of the ring, four marked bays.
  for(const b of SUPER_PROPS)this.collider(b.x,b.z,b.w,b.d);{const P=PARKING,px=(P.x0+P.x1)/2,z1=R.north-2.5;flat(px,(P.z0+z1)/2,P.x1-P.x0,z1-P.z0,'#6c7486',.01);for(let i=0;i<=4;i++)flat(px,P.z0+.6+i*2.2,P.x1-P.x0-.5,.16,'#ffffff',.024);flat(P.x0+.12,(P.z0+P.z1)/2,.24,P.z1-P.z0,'#ffd23f',.024);}
  // Families live by the border, set well back behind lawns, fences and a mailbox.
  // Each lot (lots.mjs, lots-view.mjs): the east houses face their road; the west houses face the West Lane, with a back door on the road.
  buildLanes(this,{flat});for(const h of HOMES.slice(1)){this.buildHouse(h);buildLot(this,h,{flat,box});}
  // ---- The Rowan homestead in the middle of the village.
  this.buildHome();this.fence(-6,-6.4,6,-6.4,'picket_fence',{x:0,z:-6.4,r:1.8});
  this.mailbox(2.4,R.south-3.4,Math.PI);this.sign(this.outside,'THE FAMILY FIELDS',-15,-5.5);
  // Rectangular pond with a sandy rim, reeds and a little dock.
  this.water=new T.Mesh(new T.PlaneGeometry(POND.w,POND.d),new T.MeshBasicMaterial({color:'#5fd0f5',transparent:true,opacity:.85}));this.water.rotation.x=-Math.PI/2;this.water.position.set(POND.x,.3,POND.z);this.outside.add(this.water);this.collider(POND.x,POND.z,POND.w,POND.d);
  this.sign(this.outside,'THE FAMILY POND',POND.x,POND.z-2);
  for(let i=0;i<14;i++){const t=i/14,edge=i%4,x=edge<2?POND.x-POND.w/2+t*POND.w:edge===2?POND.x-POND.w/2-.2:POND.x+POND.w/2+.2,z=edge===0?POND.z-POND.d/2-.2:edge===1?POND.z+POND.d/2+.2:POND.z-POND.d/2+t*POND.d;if(Math.abs(x-FISH_SPOT.x)<2&&z>POND.z)continue;this.asset('reeds',this.outside,x,z,.7);}
  // Lily pads scattered on the water, some with a flower (cute_game's populate); the fish, the shore and the water come with pond-life.mjs.
  for(let i=0;i<7;i++){const x=POND.x+Math.sin(i*2.39)*(POND.w/2-1.5)*(.35+i%3*.3),z=POND.z+Math.cos(i*1.7+1)*(POND.d/2-1.2)*.8,k=.6+i%3*.15;this.asset('lily_pad',this.outside,x,z,k,.34);if(i%2===0)this.asset('lily_flower',this.outside,x,z,k,.35+.017*k);}
  this.sized('well',this.outside,-6,-9,3.1);this.collider(-6,-9,2.3,2.3);
  this.sized('market-stall',this.outside,5.5,21,4.4);this.target('shop','market','Browse the village market',5.5,23.2,2.1);this.sign(this.outside,'VILLAGE MARKET',5.5,20.5);
  const vale=HOUSES[7];
  buildMarketRow(this,{bakeTinted}); // village-view.mjs: the Finch atelier's stall beside the market, the Hearth bakery by the green
  this.target('shop','upgrades','Visit the Vale workshop',WORKSHOP.x,WORKSHOP.z,2.1);
  // Village green with the supper table and pennants.
  const green={x:22,z:28};this.target('festival','supper','Harvest supper & village run',green.x,green.z,2.5);this.sized('dining_table',this.outside,green.x,green.z,3.8);for(const x of [green.x-2.5,green.x+2.5])this.sized('chair',this.outside,x,green.z,1.3);this.sign(this.outside,'THE VILLAGE GREEN',green.x,green.z);
  for(const x of [green.x-7,green.x+8])box(this.outside,x,2.1,green.z+3,.13,4.2,.13,'#8d7857');for(let i=0;i<12;i++){const g=new T.BufferGeometry().setFromPoints([new T.Vector3(-.4,0,0),new T.Vector3(.4,0,0),new T.Vector3(0,-.75,0)]);g.computeVertexNormals();const m=new T.Mesh(g,new T.MeshBasicMaterial({color:['#ff5c8a','#ffc83a','#35b6f2','#5ccf3c'][i%4],side:T.DoubleSide}));m.position.set(green.x-7+i*1.36,3.8-Math.sin(i/11*Math.PI)*.4,green.z+3);this.outside.add(m);}
  for(let i=0;i<30;i++){const p=BED_POSITIONS[i],soil=new T.Group();box(soil,0,.02,0,2.1,.04,2.2,'#a8703f').castShadow=false;box(soil,0,.045,0,1.96,.02,2.06,'#6b4429').castShadow=false;for(let j=0;j<3;j++)box(soil,-.6+j*.6,.058,0,.09,.012,1.86,'#83552f').castShadow=false;const bedMesh=bake(soil);bedMesh.position.set(p.x,0,p.z);this.outside.add(bedMesh);const group=new T.Group();group.position.set(p.x,0,p.z);this.outside.add(group);const target=this.target('bed',i,'Tend garden bed',p.x,p.z,1.45);this.cropViews.push({group,bed:bedMesh,target,key:''});}
  this.fence(-24,-5,-24,10.5,'rail_fence');this.fence(-24,10.5,-7,10.5,'rail_fence',{x:-15,z:10.5,r:1.6});
  for(const [i,p]of ORCHARD_POSITIONS.entries()){const spot=cylinder(this.outside,p.x,.04,p.z,1.3,.08,'#c98a4a',20);this.target('tree',i,'Plant an orchard tree',p.x,p.z,2);} // the trees themselves: grove-view.mjs
  // Animal pen beside the barn: open gate facing the farm track.
  for(let i=0;i<6;i++){this.sized('pen_fence',this.outside,9.25+i*2.5,-23,2.5);if(i!==2)this.sized('pen_fence',this.outside,9.25+i*2.5,-14.6,2.5);}for(let i=0;i<3;i++)for(const x of [7.9,22.9])this.sized('pen_fence',this.outside,x,-21.7+i*2.7,2.5,0,Math.PI/2);
  this.sized('coop',this.outside,10.5,-20.5,2.8);this.sized('hay_bale',this.outside,21,-20.5,1.4);this.sized('feed_trough',this.outside,17,-15.4,1.8);this.target('feed','animals','Feed your animals',17,-13,2);this.sized('egg_basket',this.outside,12,-15.6,1);this.target('collect','basket','Collect eggs & milk',12,-13,1.8);
  // The pen animals (two hens, a duck, a cow, a pig, by pen level) are drawn and moved by pen-view.mjs (world.pen): Zoo Garden's rigs, coats and roaming.
  if(this.assets.has('barn')){this.asset('barn',this.outside,28,-19.5);this.collider(28,-19.5,8.4,7.4);}
  if(this.assets.has('silo')){this.asset('silo',this.outside,27,-27);this.collider(27,-27,3.2,3.2);}
  if(this.assets.has('tractor')){this.asset('tractor',this.outside,30,-11,1,0,-Math.PI/2);this.collider(30,-11,2.6,4);}
  if(this.assets.has('hay_round'))for(const [x,z] of [[33.5,-14],[34.5,-11.6],[24,-13]])this.asset('hay_round',this.outside,x,z,1,0,x);
  if(this.assets.has('windmill')){this.asset('windmill',this.outside,WINDMILL.x,WINDMILL.z);this.collider(WINDMILL.x,WINDMILL.z,2.4,2.4);this.rotor=this.asset('windmill_rotor',this.outside,WINDMILL.x,WINDMILL.z+.62,1,6.25);}
  for(const p of RESIDENTS){const h=HOUSES[p.home],f=this.front(h),side=(p.index%3-1)*2.2,x=h.x+f.x*7.2-f.z*side,z=h.z+f.z*7.2+f.x*side;const mesh=this.character(p.child||p.index%2===0?'hero-girl-tall':'hero-tall',p.color);mesh.scale.multiplyScalar(p.child?.57:.79);mesh.position.set(x,0,z);this.outside.add(mesh);const target=this.target('person',p.id,`Talk to ${p.name}`,x,z,1.65);this.npcs.push({p,mesh,target,homeX:x,homeZ:z,path:[],goalKey:'',inside:false});}
  // The jeep by the Bell garage, the motorcycle in the homestead's yard: PARK. Where each was left is in the save (restoreVehicles).
  for(const id of Object.keys(PARK)){const P=PARK[id],mesh=this.sized(P.model,this.outside,P.x,P.z,P.size);mesh.rotation.y=P.rot;this.vehicles.push({id,mesh,target:this.target('vehicle',id,P.label,P.tx,P.tz,P.r)});}
  this.sign(this.outside,'EAST GATE · OPEN FIELDS',GATE.x+2,0); // the hillside traders this road led to now keep the supermarket on the Town Square
  this.target('hunt','woodland','Follow the woodland trail',WOODLAND.x,WOODLAND.z,2);this.sign(this.outside,'WOODLAND TRAIL',WOODLAND.x,WOODLAND.z);
  for(const g of gatherSpots()){this.asset(g.kind==='wood'?'rock':'mushroom',this.outside,g.x,g.z,.7);this.target('gather',g.id,`Gather ${g.kind}`,g.x,g.z,1.5);}
  // Trees: every one in the village can be cleared for a small fee, and its stump is then a spot for a fruit tree of your choice
  // (`spot`, shown once the tree is cleared, with the tree's own reach, so you can plant from where you stood to clear it; grove-view.mjs draws stumps and fruit trees). They, the tufts and the flowers stand where the village
  // plan puts them (village-plan.mjs): a tree keeps the index old saves know it by, and one the compact village has no room for is `gone`.
  const trees=villageTrees(),kinds=['tree_round','tree_blossom','tree_pine'];
  this.trees=trees;this.treeMeshes={};
  for(const kind of kinds){const list=trees.map((t,i)=>({...t,i})).filter(t=>t.kind===kind&&!t.gone);this.treeMeshes[kind]={meshes:this.instances(kind,list,this.outside),index:new Map(list.map((t,k)=>[t.i,k]))};}
  trees.forEach((t,i)=>{if(t.gone)return;t.block=this.addTreeBlock({x:t.x,z:t.z,r:.42*t.s,h:3.3*t.s});this.target('chop',i,`Clear this tree · ${CHOP_COST} coins`,t.x,t.z,.42*t.s+1.35);this.target('spot',i,'Plant a fruit tree',t.x,t.z,.42*t.s+1.35);});this.clearedShown=new Set();this.grove=new GroveView(this);
  this.instances('tuft',villageTufts(),this.outside,false);this.instances('flowers',villageFlowers(),this.outside,false);
  this.instances('bush',HOMES.slice(1).flatMap(h=>{const f=this.front(h);return [-1,1].map(k=>({x:h.x+f.x*3-f.z*k*4.6,z:h.z+f.z*3+f.x*k*4.6,s:1.15}));}),this.outside);
  this.instances('flowers',[{x:-4,z:-7,s:1.1},{x:4,z:-7,s:1.1},{x:-8,z:12,s:1.2},{x:9,z:20,s:1.2},{x:24,z:12,s:1.3},{x:-2,z:23,s:1.1}],this.outside,false);
  for(const [i,p]of RACE_POINTS.entries()){const ring=new T.Mesh(new T.TorusGeometry(1.25,.09,6,32),mat('#ffc83a'));ring.rotation.x=-Math.PI/2;ring.position.set(p.x,.2,p.z);ring.visible=false;this.outside.add(ring);this.markers.push(ring);}
  const live=new Set([this.groundMesh,this.water,HOUSES[0].group,this.rotor,...this.vehicles.map(v=>v.mesh),...this.npcs.map(n=>n.mesh),...this.animals.map(a=>a.mesh),...this.fishes.map(f=>f.mesh),...this.cropViews.flatMap(v=>[v.group,v.bed]),...this.markers]);
  const fixed=new T.Group();for(const child of [...this.outside.children])if(child.visible&&!child.isSprite&&!child.isInstancedMesh&&!live.has(child))fixed.add(child);this.outside.add(this.villageCells=bake(fixed,false,32));
 }
 // Trees block walking through a coarse grid, so thousands of them cost a handful of checks per step.
 // A wide block (tree-blocks.mjs WIDE_BLOCK: a pond, a lava pool, the dragon's nest) reaches beyond the 3 x 3 cells a lookup reads, so it is
 // kept in a short list of its own (this.wideBlocks) that every lookup also walks. A block with carOnly stops cars and nobody on foot.
 addTreeBlock(t){if(isWide(t)){(this.wideBlocks??=[]).push(t);t.key='wide';return t;}const key=`${Math.floor(t.x/8)},${Math.floor(t.z/8)}`;this.treeGrid??=new Map();if(!this.treeGrid.has(key))this.treeGrid.set(key,[]);this.treeGrid.get(key).push(t);t.key=key;return t;}
 removeTreeBlock(t){const list=t.key==='wide'?this.wideBlocks:this.treeGrid?.get(t.key);if(list){const i=list.indexOf(t);if(i>=0)list.splice(i,1);}t.gone=true;}
 treesNear(x,z,reach=0){const out=[],cx=Math.floor(x/8),cz=Math.floor(z/8),n=Math.ceil(reach/8)+1;for(let i=cx-n;i<=cx+n;i++)for(let k=cz-n;k<=cz+n;k++){const list=this.treeGrid?.get(`${i},${k}`);if(list)out.push(...list);}for(const t of this.wideBlocks??[])if(Math.hypot(t.x-x,t.z-z)<t.r+reach+8)out.push(t);return out;}
 treeBlocked(x,z){if(this.location!=='village')return false;const cars=!!this.riding;for(const t of this.treesNear(x,z))if((cars||!t.carOnly)&&Math.hypot(x-t.x,z-t.z)<t.r+.3)return true;return false;}
 // Trees close to a straight walk become route obstacles; the destination's own tree is left out.
 routeObstacles(from,to){const list=this.colliders.filter(c=>c.location===this.location);if(this.location!=='village')return list;const mx=(from.x+to.x)/2,mz=(from.z+to.z)/2,len=Math.hypot(to.x-from.x,to.z-from.z);
  for(const t of this.treesNear(mx,mz,len/2+4)){if(t.carOnly&&!this.riding)continue;if(Math.hypot(t.x-to.x,t.z-to.z)<t.r+.6)continue;const dx=to.x-from.x,dz=to.z-from.z,k=Math.max(0,Math.min(1,((t.x-from.x)*dx+(t.z-from.z)*dz)/Math.max(1e-6,len*len))),d=Math.hypot(from.x+dx*k-t.x,from.z+dz*k-t.z);if(d<t.r+2.5){const w=t.r>1.5?2*(t.r+.8):t.r*1.6;list.push({x:t.x,z:t.z,w,d:w});}} /* a pond, a pool: a box outside its bank (a trunk's box is inside its own margin, which a walker brushes past) */
  return edgeObstacles(from.x,from.z,to.x,to.z,8,list);}
 perchNear(x,z,reach){let best=null,score=Infinity;for(const t of this.treesNear(x,z,reach)){if(t.gone||t.taken||t.perch===false)continue;const d=Math.hypot(t.x-x,t.z-z);if(d<reach&&d<score){best=t;score=d;}}return best;}
 // A scenery kit for the fields and the lands (builder A; spec 3.5). name: 'scenery' | 'wilds' | 'bright' | 'harsh' | 'dressing'.
 // It bakes each root child of the kit's file (colour and glow) to one mesh on the shared kit material and stores it in this.kits
 // under 'name/child', e.g. 'wilds/reeds' (the pond's own `reeds` in this.assets is another model: the prefix keeps them apart).
 // tints: {'child@id': {materialName: '#hex'}} bakes a recoloured copy under 'name/child@id' (region-life.mjs KIT_TINTS).
 // 'scenery' is baked from the file boot already has (this.raw) and is ready when the call returns; the other four are fetched.
 // Returns a promise of true, or of false when the file could not be had: one more try after 5 s, then one console warning, and the
 // pieces keep their stand-in shapes for this session. Colliders never depend on a kit.
 loadKit(name,{tints}={}){
  const file={scenery:'scenery',wilds:'wilds',bright:'worlds-bright',harsh:'worlds-harsh',dressing:'worlds-dressing'}[name]??name;
  const ready=scene=>{if(!this.kitScenes.has(name)){this.kitScenes.set(name,scene);for(const child of scene.children){const mesh=bakeKit(child);if(mesh)this.kits.set(`${name}/${child.name}`,mesh);}}return true;};
  const tinted=()=>{if(tints)for(const [key,colors] of Object.entries(tints)){const full=`${name}/${key}`,child=this.kits.has(full)?null:this.kitScenes.get(name).children.find(c=>c.name===key.split('@')[0]),mesh=child?bakeKit(child,colors):null;if(mesh)this.kits.set(full,mesh);}return true;};
  if(!this.kitScenes.has(name)&&this.raw.has(file))ready(this.raw.get(file));
  if(this.kitScenes.has(name)){tinted();return Promise.resolve(true);}
  let job=this.kitJobs.get(name);
  if(!job){const fetchKit=()=>new GLTFLoader().loadAsync(`./assets/models/${file}.glb`).then(g=>g.scene);
   job=fetchKit().catch(()=>new Promise(resolve=>setTimeout(resolve,5000)).then(fetchKit)).then(ready,error=>{console.warn(`Scenery kit "${name}" did not load; its pieces keep their stand-in shapes.`,error?.message??error);return false;});this.kitJobs.set(name,job);}
  return job.then(ok=>ok&&tinted());
 }
 // Villagers keep a timetable and walk the lanes between buildings (villagers.mjs has the places, the day and the strolls;
 // villagers-view.mjs moves them). About half the day is spent indoors (home, school or work), where the villager is
 // hidden and can be reached by knocking at the door.
 npcPlace(n,key){return placeOf(n.p,key);}
 npcSlot(n,s){return slotOf(n.p,s);}
 updateNpcs(dt,s){(this.villagers??=new VillagersView(this)).update(dt,s);}
 instances(name,points,parent,shadow=true){const source=this.assets.get(name);if(!source)return [];const made=[];source.traverse(m=>{if(!m.isMesh)return;const inst=new T.InstancedMesh(m.geometry,m.material,points.length);made.push(inst);points.forEach((p,i)=>{dummy.position.set(p.x,0,p.z);dummy.rotation.set(0,(i*2.399),0);dummy.scale.setScalar(p.s);dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);});inst.castShadow=shadow;inst.receiveShadow=true;parent.add(inst);});return made;}
 makeCropSprites(){
  this.cropTextures={};const scene=new T.Scene(),camera=new T.OrthographicCamera(-1.5,1.5,1.6,-1.4,.1,20);camera.position.set(3,3.5,5);camera.lookAt(0,.6,0);scene.add(new T.HemisphereLight('#fff8e6','#647450',2.8));const light=new T.DirectionalLight('#fff3db',3);light.position.set(-3,6,4);scene.add(light);
  const oldColor=this.renderer.getClearColor(new T.Color()),oldAlpha=this.renderer.getClearAlpha();this.renderer.setClearColor(0,0);
  for(const id of [...Object.keys(CROPS),'sprout']){const model=this.sized('crop_'+id,scene,0,0,2.1);const target=new T.WebGLRenderTarget(160,160);this.renderer.setRenderTarget(target);this.renderer.render(scene,camera);this.cropTextures[id]=target.texture;scene.remove(model);}
  this.renderer.setRenderTarget(null);this.renderer.setClearColor(oldColor,oldAlpha);
 }
 enterHouse(id){this.dismount();this.returnPosition=this.player.position.clone();this.houseId=id;this.location='interior';this.outside.visible=false;this.inside.visible=true;this.buildInterior();this.player.position.set(SPAWN.x,0,SPAWN.z);this.follow.set(0,0,0);this.clearMovement();this.resize();}
 buildInterior(){buildInteriorRoom(this,{houseId:this.houseId,state:this.state,HOUSES,RESIDENTS,KID_OUTFITS});}
 exit(){this.location='village';this.houseId=null;this.outside.visible=true;this.inside.visible=false;this.player.position.copy(this.returnPosition??new T.Vector3(0,0,-8));this.follow.copy(this.player.position);this.clearMovement();this.resize();}
 board(id){const ride=this.vehicles.find(v=>v.id===id);if(!ride)return;this.riding=ride;this.drive.board(ride);this.clearMovement();this.state.riding=ride.id;this.noteVehicle(ride);}
 dismount(){if(!this.riding)return;const v=this.riding;this.riding=null;this.drive.dismount(v);this.state.riding='';for(const [dx,dz]of [[2.5,0],[-2.5,0],[0,2.5],[0,-2.5],[0,0]])if(!this.blocked(v.mesh.position.x+dx,v.mesh.position.z+dz)){this.player.position.set(v.mesh.position.x+dx,0,v.mesh.position.z+dz);break;}this.placeVehicle(v,v.mesh.position.x,v.mesh.position.z,v.mesh.rotation.y);this.noteVehicle(v);if(this.location==='village')this.state.position={x:this.player.position.x,z:this.player.position.z};}
 // ---- Vehicles that stay where they are left (round 8, spec 7.4).
 /** A vehicle's mesh, its boarding spot and that spot's tap box, moved together: to its park spot (no x), or to (x, z) facing rot. */
 placeVehicle(v,x,z,rot){
  const P=PARK[v.id],parked=x==null,t=v.target;
  if(parked){x=P.x;z=P.z;rot??=P.rot;}
  v.mesh.position.set(x,0,z);
  v.mesh.rotation.set(0,rot??P.rot,0);
  t.x=parked?P.tx:x;t.z=parked?P.tz:z;t.r=parked?P.r:Math.max(P.r,AWAY_REACH);
  t.hit.position.set(t.x,1,t.z);
  if(v.drive){v.drive.heading=v.mesh.rotation.y;v.drive.speed=0;v.drive.steer=0;v.drive.straight=0;}
  v.driveSpeed=0;
 }
 /** Writes where a vehicle stands into the save's state (never to storage: main.mjs saves on boarding, stepping out and its own clock). */
 noteVehicle(v){const s=this.state,m=v.mesh,at=s.vehicles[v.id]??={x:0,z:0,rot:0};at.x=m.position.x;at.z=m.position.z;at.rot=m.rotation.y;if(this.riding===v)s.heading=v.drive?.heading??m.rotation.y;}
 /**
  * Puts every vehicle where the save left it (its park spot if the save has none), and you back in the one you were driving, at your
  * saved place, facing the way it faced. `parkAll`: the saved place could not be kept, so everything is parked and you are on foot.
  * Called once the player is placed (init, and main.mjs when a save is imported).
  */
 restoreVehicles(parkAll=false){
  const s=this.state;
  if(this.riding){const v=this.riding;this.riding=null;this.drive.dismount(v);}
  s.vehicles??={jeep:null,bike:null};
  for(const v of this.vehicles){const at=parkAll?null:s.vehicles[v.id];if(at)this.placeVehicle(v,at.x,at.z,at.rot);else{this.placeVehicle(v);s.vehicles[v.id]=null;}}
  const ride=parkAll?null:this.vehicles.find(v=>v.id===s.riding);
  if(!ride){s.riding='';return;}
  this.placeVehicle(ride,s.position.x,s.position.z,s.heading);
  this.board(ride.id);
 }
 /** Every vehicle outside the ward goes back to its park spot (a knock-out, Home on foot). The one you are sitting in is left to its caller. */
 towVehicles(){
  let towed=0;
  for(const v of this.vehicles){if(v===this.riding||inSafeZone(v.mesh.position.x,v.mesh.position.z))continue;this.placeVehicle(v);this.state.vehicles[v.id]=null;towed++;}
  return towed;
 }
 clearMovement(){this.keys.clear();this.stick.x=0;this.stick.y=0;this.path=[];this.pending=null;}
 activeTargets(){return this.targets.filter(t=>t.location===this.location&&(t.type!=='bed'||t.id<bedCount(this.state))&&(t.type!=='chop'||!this.clearedShown?.has(t.id))&&(t.type!=='spot'||this.clearedShown?.has(t.id)));}
 nearest(){if(this.riding)return {type:'dismount',label:'Park & step out',id:this.riding.id};let best=null,distance=Infinity;for(const t of this.activeTargets()){const d=Math.hypot(this.player.position.x-t.x,this.player.position.z-t.z);if(d<t.r&&d<distance){best=t;distance=d;}}return best;}
 interact(){const t=this.nearest();if(t)this.onInteract(t);}
 get bounds(){return this.location==='interior'?WALK:OUTDOORS;}
 blocked(x,z){const bound=this.bounds;if(Math.abs(x)>bound.x||Math.abs(z)>bound.z||this.edgeDepth(x,z)>0)return true;return this.colliders.some(c=>c.location===this.location&&Math.abs(x-c.x)<c.w/2+.32&&Math.abs(z-c.z)<c.d/2+.32)||this.treeBlocked(x,z);}
 // How many metres a point is past the padded edge of the world (0: inside). Walking, driving and routes all ask this one question.
 // The world is thirteen squares of a 5 x 5 grid (regions.mjs); nobody stands within EDGE_PAD of an empty cell or of the grid's end. Outside the
 // world altogether it answers a whole cell, so the point is deep inside a wall whichever way it is asked from.
 edgeDepth(x,z){return this.location!=='village'?0:inWorld(x,z)?Math.max(0,EDGE_PAD-edgeDistance(x,z)):CELL;}
 // Metres along a ray (a unit direction) to that same line, for a car's braking (Infinity beyond 48 m, and indoors).
 edgeAhead(x,z,dirX,dirZ){return this.location!=='village'?Infinity:edgeAhead(x,z,dirX,dirZ);}
 // Moves the player by (dx, dz) through what blocks a walk, one axis at a time and in short hops, so nothing is stepped through
 // (a gust, a toy train, a titan's pull). It acts with the box shut too. Not indoors. Returns true if the player moved.
 // A rider is left alone (a gust and a titan's pull never move a car) unless the caller passes {car:true}: then the vehicle is shoved
 // through what stops a car (DriveView.shove), and with {crawl:true} its speed drops to a crawl. Only a toy train asks for that (spec 3.9).
 push(dx,dz,opts){
  if(this.location!=='village'||!this.player)return false;
  if(this.riding)return opts?.car?this.drive.shove(this.riding,dx,dz,!!opts.crawl):false;
  const p=this.player.position,n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.3));
  let moved=false;
  for(let i=0;i<n;i++){
   const x=p.x+dx/n,z=p.z+dz/n;
   if(dx&&!this.blocked(x,p.z)){p.x=x;moved=true;}
   if(dz&&!this.blocked(p.x,z)){p.z=z;moved=true;}
  }
  return moved;
 }
 // Takes a spot out of the world again: the reverse of target(). A thing out in the lands that can be tapped registers its target only
 // while the player is within 48 m of it and removes it beyond 56 m, so the list of targets seen from the village stays the village's.
 removeTarget(spot){
  const i=this.targets.indexOf(spot);
  if(i<0)return false;
  this.targets.splice(i,1);
  if(spot.hit){spot.hit.removeFromParent();spot.hit.geometry.dispose();spot.hit.material.dispose();spot.hit=null;}
  if(this.pending===spot)this.pending=null;
  return true;
 }
 // A tapped route. Outdoors its end is first moved off the world's edge and out of any pond it lies in (to the nearest point a route can end at:
 // clear of every box findRoute will draw), and a start inside the edge's band begins with one straight leg out of it.
 routeTo(x,z){
  const from=this.player.position;
  if(this.location!=='village'){this.path=findRoute(from,{x,z},this.routeObstacles(from,{x,z}),this.bounds);return this.path.length>0;}
  const end=worldPoint(x,z,ROUTE_PAD),start=worldPoint(from.x,from.z,ROUTE_PAD),moved=Math.hypot(start.x-from.x,start.z-from.z)>.01;
  for(const t of this.treesNear(end.x,end.z,2)){
   if(t.r<=1.5||t.carOnly&&!this.riding)continue;
   const dx=end.x-t.x,dz=end.z-t.z,reach=t.r+1.2,far=Math.max(Math.abs(dx),Math.abs(dz));
   if(far>=reach)continue;
   const ox=far>.01?dx:from.x-t.x,oz=far>.01?dz:from.z-t.z,k=reach/Math.max(.01,Math.abs(ox),Math.abs(oz)),out=worldPoint(t.x+ox*k,t.z+oz*k,ROUTE_PAD);
   end.x=out.x;end.z=out.z;
  }
  const path=findRoute(start,end,this.routeObstacles(start,end),this.bounds);
  this.path=path.length&&moved?[{x:start.x,z:start.z},...path]:path;
  return this.path.length>0;
 }
 /** True once after a tap off the water while the line was out: main.mjs packs the rod away. */
 takeWalkTap(){const tap=this.walkTap;this.walkTap=false;return !!tap;}
 get homeGuide(){return{visible:this.location==='village'&&!inVillage(this.player.position.x,this.player.position.z),...homeBearing(this.player.position,HOMESTEAD,this.yaw)};}
 walkHome(){this.pending=null;return this.routeTo(HOMESTEAD.x,HOMESTEAD.z);}
 // ---- Home (round 8, spec 8). One button: near the village it walks (or drives, if you are in a car); from farther out it is a magic hop
 // that brings the car you sit in. Returns 'walk', 'magic', 'wary' (a creature is angry at you: the ring takes 3 s and a blow cancels it),
 // 'busy' (a hop is already under way) or '' (no way home was found).
 farFromHome(){const p=this.player.position;return this.location==='village'&&wildDepth(p.x,p.z)>=HOME.magic;}
 goHome(){
  if(this.homing)return 'busy';
  if(!this.farFromHome())return this.walkHome()?'walk':'';
  const wary=!this.riding&&!!this.pandora?.threatened?.();
  this.teleportHome({charge:wary?HOME.wary:HOME.charge,wary});
  return wary?'wary':'magic';
 }
 /**
  * The magic hop home, wherever you are outdoors: a rainbow ring grows round you for `charge` seconds, the screen fades to white, and you
  * land: in a car, car and rider at the car's park spot, still seated; on foot, in the homestead's yard, and every vehicle left outside the
  * ward is towed to its park spot. Friends who follow you come too (world.followers). The white lifts when the ground round home is built.
  * Returns a promise: true once you have landed, false if it was cancelled (a blow while `wary`, a door, a second call).
  */
 teleportHome({charge=HOME.charge,wary=false}={}){
  if(this.homing)return Promise.resolve(false);
  if(this.location!=='village')return Promise.resolve(false);
  if(!this.hurtHooked&&this.pandora?.onHurt){this.hurtHooked=true;this.pandora.onHurt(()=>{if(this.homing?.phase==='charge'&&this.homing.wary)this.cancelHome();});}
  this.path=[];this.pending=null;
  if(!this.homeRing)this.homeRing=this.makeHomeRing();
  this.homeRing.visible=true;
  return new Promise(resolve=>{this.homing={phase:'charge',t:0,charge,wary,resolve};});
 }
 cancelHome(quiet=false){const h=this.homing;if(!h)return;this.homing=null;if(this.homeRing)this.homeRing.visible=false;this.homeFade?.classList.remove('on');h.resolve(false);if(!quiet)this.onNotice?.('The way home slipped. Get clear and try again.');}
 /** The ring: seven flat bands in the border ribbon's rainbow, vertex colours only, one unlit draw while it shows. */
 makeHomeRing(){
  const seg=48,pos=[],col=[],idx=[],c=new T.Color();
  // Each band has its own colour, so the ring of vertices between two bands is written twice (once for each).
  for(let b=0;b<RAINBOW.length;b++){c.set(RAINBOW[b]);const base=pos.length/3;for(let k=0;k<2;k++)for(let i=0;i<=seg;i++){const a=i/seg*Math.PI*2,r=.72+(b+k)*.1;pos.push(Math.sin(a)*r,0,Math.cos(a)*r);col.push(c.r,c.g,c.b);}for(let i=0;i<seg;i++){const a=base+i,d=base+seg+1+i;idx.push(a,d,a+1,a+1,d,d+1);}}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('color',new T.Float32BufferAttribute(col,3));g.setIndex(idx);
  const ring=new T.Mesh(g,new T.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.9,side:T.DoubleSide,forceSinglePass:true,depthWrite:false,fog:false}));
  ring.name='home-ring';ring.frustumCulled=false;ring.renderOrder=3;this.outside.add(ring);return ring;
 }
 /** One frame of a hop under way (World.update). */
 stepHome(dt){
  const h=this.homing,p=this.player.position;
  if(this.location!=='village'){this.cancelHome(true);return;} /* a door, or a knock-out, took you indoors meanwhile */
  h.t+=dt;
  if(h.phase==='charge'){
   const k=Math.min(1,h.t/h.charge),ring=this.homeRing;
   ring.position.set(p.x,.12,p.z);ring.scale.setScalar((.4+k*2.2)*(this.riding?1.5:1));ring.rotation.y=this.t*2.4;ring.material.opacity=.35+.6*k;
   if(k>=1){h.phase='fade';h.t=0;this.homeFade.classList.add('on');}
   return;
  }
  if(h.phase==='fade'){
   if(h.t<HOME.fade)return;
   // The landing, behind the white.
   this.homeRing.visible=false;
   const ride=this.riding;
   if(ride){this.placeVehicle(ride);this.drive.board(ride);p.set(ride.mesh.position.x,0,ride.mesh.position.z);this.noteVehicle(ride);}
   else{p.set(HOME_SPOT.x,0,HOME_SPOT.z);this.towVehicles();}
   this.state.position={x:p.x,z:p.z};
   this.clearMovement();
   this.follow.copy(p);
   for(const f of this.followers)f.moveTo?.(p.x,p.z);
   this.fields.update(p);
   h.phase='land';h.t=0;h.built=false;
   Promise.resolve(this.fields.ensureNear?.(p.x,p.z)).catch(()=>{}).then(()=>{h.built=true;});
   return;
  }
  // Landed: the white stays until the nine tiles round home stand (and never longer than three seconds).
  if(h.built||h.t>3){this.homing=null;this.homeFade.classList.remove('on');for(const c of RAINBOW.slice(0,3))this.burst(c);h.resolve(true);}
 }
 click(e){this.scene.updateMatrixWorld(true);this.pointer.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);this.raycast.setFromCamera(this.pointer,this.camera);const hits=this.raycast.intersectObjects(this.activeTargets().map(t=>t.hit),false);let target=hits[0]?.object.userData.target;// A tap on the pond (where the ray meets the water's surface): standing at the bank you cast there, from where you stand, with no
  // walking; from farther off you walk to the nearest bit of bank first, then cast toward the tap (pond.mjs).
  const wet=this.location==='village'&&this.raycast.ray.intersectPlane(WATER,v3)&&Math.abs(v3.x-POND.x)<POND.w/2+.3&&Math.abs(v3.z-POND.z)<POND.d/2+.3;
  if(wet&&this.riding){this.onNotice?.('Step out to fish');return;} /* on a vehicle the pond does not answer in silence */
  // The tapped point rides on the spot handed over (spot.tap), so it lives exactly as long as that tap's cast or walk.
  if(wet){const spot=this.rodFishing.bank();spot.tap={x:v3.x,z:v3.z};if(this.fishing||atBank(this.player.position.x,this.player.position.z)){this.path=[];this.pending=null;this.onInteract(spot);return;}target=spot;} /* from outside the border: walk up to the water (the walk ends well inside the border, pond.mjs BANK), then cast toward the tap */
  else{this.raycast.ray.intersectPlane(this.plane,v3);if(!target){target=this.activeTargets().find(t=>Math.hypot(v3.x-t.x,v3.z-t.z)<.9);}}
  // With the line out, any tap off the water is a move: the rod is packed away and you walk (to the thing you tapped, which is then used on arrival).
  if(this.fishing&&!wet){this.walkTap=true;this.pending=target??null;this.routeTo(target?target.x:v3.x,target?target.z:v3.z);return;}
  if(target){if(Math.hypot(this.player.position.x-target.x,this.player.position.z-target.z)<target.r){this.onInteract(target);return;}this.pending=target;this.routeTo(target.x,target.z);}else {this.pending=null;this.routeTo(v3.x,v3.z);}
 }
 sync(force=false){
  if(!this.player)return;
  const s=this.state,key=JSON.stringify([s.upgrades,s.beds.map(b=>b?[b.crop,b.watered,ripe(s,b)]:null),s.trees,s.outfit,s.body,s.look,s.gear,s.kidOutfit,s.day,s.furniture,s.cleared.length,s.planted,s.settings.test]);
  if(!force&&key===this.lastSync)return;
  this.lastSync=key;
  if(this.player.userData.style!==styleKey(playerWants(this)))this.refreshPlayer();
  this.cropViews.forEach((view,i)=>{const b=s.beds[i];view.bed.visible=i<bedCount(s);view.group.visible=i<bedCount(s);const k=b?`${b.crop}-${b.watered}-${ripe(s,b)}`:'empty';if(k!==view.key){view.key=k;for(const child of view.group.children){if(!child.isSprite)child.geometry?.dispose();child.material?.dispose();}view.group.clear();if(b){const sprite=new T.Sprite(new T.SpriteMaterial({map:this.cropTextures[b.watered?b.crop:'sprout'],depthWrite:false}));sprite.scale.set(2,2,1);sprite.position.y=.95;view.group.add(sprite);if(ripe(s,b)){const glow=new T.Mesh(new T.RingGeometry(.88,.94,28),new T.MeshBasicMaterial({color:'#e7d383',side:T.DoubleSide}));glow.rotation.x=-Math.PI/2;glow.position.y=.36;view.group.add(glow);}}}view.target.label=!b?'Plant a seed':!b.watered?'Water the '+CROPS[b.crop].name.toLowerCase():ripe(s,b)?'Harvest '+CROPS[b.crop].name.toLowerCase():'Growing · '+Math.ceil(CROPS[b.crop].grow*(1-cropProgress(s,b)))+'s';});
  this.grove.sync(s); // stumps, fruit trees (orchard circles and planted spots), which village trees are cleared: grove-view.mjs
  this.animals.forEach((a,i)=>a.mesh.visible=i===0||i===2||i===1&&s.upgrades.pen>=1||i===3&&s.upgrades.pen>=2||i===4&&s.upgrades.pen>=3);
  const pip=this.npcs.find(n=>n.p.id==='pip');
  if(pip&&pip.mesh.userData.look!==s.kidOutfit){const color=new T.Color(KID_OUTFITS.find(k=>k.id===s.kidOutfit)?.color??pip.p.color);tintShirt(pip.mesh,color);pip.mesh.userData.look=s.kidOutfit;}
  this.fields.season(new T.Color(['#ffffff','#eefbe6','#ffe7a6','#f0f6ff'][Math.floor((s.day-1)/7)%4]));
  this.refreshHome();
  if(this.location==='interior')this.buildInterior();
 }
 burst(color='#e9c16b'){for(let i=0;i<10;i++){const mesh=new T.Mesh(sphere,mat(color));mesh.scale.setScalar(.1);mesh.position.copy(this.player.position).add(new T.Vector3(0,1,0));this.scene.add(mesh);this.particles.push({mesh,life:1,v:new T.Vector3((rand()-.5)*3,1+rand()*3,(rand()-.5)*3)});}}
 // Shop "Try on": tint the player's shirt and turn them to face the camera; null restores the worn outfit.
 previewOutfit(color){this.previewColor=color;if(!this.player)return;const c=new T.Color(color??OUTFITS.find(o=>o.id===this.state.outfit)?.color??'#849978');tintShirt(this.player,c);if(color)this.player.rotation.y=this.yaw;
  // Like the reference, the camera moves in on the character while an outfit is tried on, and steps back after.
  if(color&&this.zoomBefore==null){this.zoomBefore=this.zoom;this.zoom=Math.min(this.zoom,7);}else if(!color&&this.zoomBefore!=null){this.zoom=this.zoomBefore;this.zoomBefore=null;}this.resize();}
 setFishing(active,simulation=null){this.walkTap=false;this.fishing=active?simulation:null;if(active)this.rodFishing.start(simulation);else this.rodFishing.cancel();}
 update(dt){
  if(!this.ready){this.renderer.render(this.scene,this.camera);return;}this.t+=dt;const s=this.state;
  if(!this.paused){let x=(this.keys.has('d')||this.keys.has('arrowright')?1:0)-(this.keys.has('a')||this.keys.has('arrowleft')?1:0)+this.stick.x,z=(this.keys.has('s')||this.keys.has('arrowdown')?1:0)-(this.keys.has('w')||this.keys.has('arrowup')?1:0)+this.stick.y;
   // Screen-relative movement, consistent for keyboard and touch.
   let dx=x*Math.cos(this.yaw)+z*Math.sin(this.yaw),dz=-x*Math.sin(this.yaw)+z*Math.cos(this.yaw);if(Math.hypot(x,z)>.05){this.path=[];this.pending=null;}else if(this.path.length){const p=this.path[0];dx=p.x-this.player.position.x;dz=p.z-this.player.position.z;if(Math.hypot(dx,dz)<this.nodeReach)this.path.shift();}
   if(this.homing){this.stepHome(dt);if(this.homing&&this.homing.phase!=='charge'){x=z=dx=dz=0;this.path=[];this.pending=null;}} /* the hop home: nothing moves behind the white */
   const length=Math.hypot(dx,dz),steering=Math.hypot(x,z)>.05,speed=(this.keys.has('shift')?7:4.8)*(s.settings.test?1.6:1);let moving=false;
   // A vehicle steers its nose towards the stick and drives nose first (drive.mjs); on foot you walk where the stick points.
   if(this.riding)this.drive.step(steering?dx:0,steering?dz:0,dt);
   else{
    // On foot. The land you stand on has its say first (world.lands.walk, builder B): ice eases the velocity, the sea slows it, and a
    // tapped walk on ice drops a route node from farther off. It is asked every frame, stick or no stick (you slide on with none).
    const want=length>.05,ask=this.walkAsk;
    ask.dx=want?dx/length:0;
    ask.dz=want?dz/length:0;
    ask.speed=want?speed:0;
    const land=this.location==='village'?this.lands?.walk(ask,dt):null;
    if(land)this.landCalls.walk++;
    const vx=land?land.vx*land.limit:ask.dx*ask.speed,vz=land?land.vz*land.limit:ask.dz*ask.speed;
    this.nodeReach=land?.nodeReach??.22;
    if(vx*vx+vz*vz>.0004){
     const nx=this.player.position.x+vx*dt,nz=this.player.position.z+vz*dt;
     if(!this.blocked(nx,this.player.position.z)){this.player.position.x=nx;moving=true;}
     if(!this.blocked(this.player.position.x,nz)){this.player.position.z=nz;moving=true;}
    }
    if(want){
     const desired=Math.atan2(dx,dz);
     this.player.rotation.y+=Math.atan2(Math.sin(desired-this.player.rotation.y),Math.cos(desired-this.player.rotation.y))*Math.min(1,dt*12);
    }
   }
   // The world's edge says so once (walking into it, or the stick held into it in a car).
   if(!this.edgeTold&&length>.05&&this.location==='village'){const reach=(this.riding?1.2:.5)/length,p=this.player.position;if(this.edgeDepth(p.x+dx*reach,p.z+dz*reach)>0){this.edgeTold=true;this.onNotice?.('The world ends here');}}
   if(this.pending&&Math.hypot(this.player.position.x-this.pending.x,this.player.position.z-this.pending.z)<this.pending.r*.82){const target=this.pending;this.path=[];this.pending=null;this.onInteract(target);}
   /* A walk to the pond that ends short of its spot (something in the way): at the border you cast all the same; anywhere else the tap is forgotten. */
   else if(this.pending?.type==='fish'&&!this.path.length){const target=this.pending;this.pending=null;if(atBank(this.player.position.x,this.player.position.z))this.onInteract(target);}
   // The walk (walk-cycle.mjs, avatar.mjs walkAvatar): the legs keep time with the ground really covered since the last frame, their swing
   // suits the leg's length, and the body rides on its lower foot, so the feet stay on the ground for every height.
   this.animatePerson(this.player,0,0);const gait=this.gait??=newGait(),at=this.player.position,far=Math.hypot(at.x-(gait.x??at.x),at.z-(gait.z??at.z));gait.x=at.x;gait.z=at.z;this.player.position.y=this.riding?0:walkAvatar(this.player,gait,far<2?far:0,dt);
   if(this.riding)this.drive.pose(); // seated, facing the way the nose points
   if(this.location==='village'){
    // Where you are, for the save: on foot your own place; in a car the car's (the avatar is posed on its seat, a little off the car's centre).
    const here=this.riding?this.riding.mesh.position:this.player.position;
    s.position={x:here.x,z:here.z};
    if(this.riding)this.noteVehicle(this.riding);
    this.updateNpcs(dt,s);
    // The land's own frame (builder B): its simulation and its drawing, once, after you have moved.
    const at=this.landAt;
    at.x=this.player.position.x;
    at.z=this.player.position.z;
    at.riding=!!this.riding;
    at.box=s.pandora===true;
    if(this.lands){this.lands.step(dt,at);this.landCalls.step++;}
   }
  }
  if(this.location==='village'){this.fields.update(this.player.position);this.birds.update(this.t,this.player.position);}
  this.rain.visible=calendar(s).rain&&this.location!=='interior';if(this.rain.visible){const a=this.rainGeometry.getAttribute('position');for(let i=0;i<120;i++){const x=this.player.position.x+Math.sin(i*71.3)*24,z=this.player.position.z+Math.cos(i*17.9)*24,y=(i*.47-this.t*11)%12+12;a.setXYZ(i*2,x,y,z);a.setXYZ(i*2+1,x-.18,y-.8,z);}a.needsUpdate=true;}
    for(const a of this.animals){a.mesh.position.x=a.x+Math.sin(this.t*.22+a.phase)*.55;a.mesh.position.z=a.z+Math.cos(this.t*.27+a.phase)*.55;a.mesh.rotation.y=Math.sin(this.t*.2+a.phase)*.8;a.mesh.position.y=Math.abs(Math.sin(this.t*3+a.phase))*.025;}
  for(const [i,view]of this.cropViews.entries()){const b=s.beds[i],sprite=view.group.children[0];if(sprite?.isSprite){const size=b.watered?.7+cropProgress(s,b)*1.2:1;sprite.scale.set(size,size,1);sprite.position.y=.45+size*.4;}}
  for(const p of this.particles){p.life-=dt;p.mesh.position.addScaledVector(p.v,dt);p.v.y-=dt*4;p.mesh.scale.setScalar(Math.max(0,p.life)*.12);}this.particles=this.particles.filter(p=>{if(p.life<=0){p.mesh.removeFromParent();return false;}return true;});
  if(this.location==='village'&&!this.pondLoad&&Math.hypot(this.player.position.x-POND.x,this.player.position.z-POND.z)<45)this.pondLoad=import('./pond-life.mjs').then(m=>{this.pondLife=new m.PondLife(this);},e=>console.error(e));this.rodFishing.update(dt,this.t);this.pondLife?.update(dt);updateCompanion(this,dt,this.t);if(this.rotor)this.rotor.rotation.z+=dt*1.6;
  const wide=innerWidth/innerHeight>1.2,focus=this.location==='interior'?v3.set(0,0,0):(this.previewColor||this.tryOn)&&wide?v3.copy(this.player.position).add(new T.Vector3(Math.cos(this.yaw),0,-Math.sin(this.yaw)).multiplyScalar(this.zoom*innerWidth/innerHeight*.42)):this.drive.focus(dt);
  this.follow.lerp(focus,1-Math.exp(-dt*(this.riding?DRIVE_CAMERA.follow:4)));
  // The rig stands back with the view (drive.mjs cameraRig): at today's 45 m until the view is taller than that allows (the far view on a
  // portrait phone), and the far plane and the fog move out with it. Indoors it is the room's own.
  const indoors=this.location==='interior',view=this.zoom*this.drive.zoom,far=indoors?0:this.farShare(),rig=cameraRig(indoors?0:this.camera.top/this.camera.zoom,far,this.rig);
  const d=indoors?24:rig.back;
  this.camera.position.set(this.follow.x+Math.sin(this.yaw)*d,this.follow.y+d*.87,this.follow.z+Math.cos(this.yaw)*d);
  this.camera.lookAt(this.follow.x,0,this.follow.z);
  if(Math.abs(this.camera.far-rig.far)>.05){this.camera.far=rig.far;this.camera.updateProjectionMatrix();}
  this.scene.fog.near=rig.fogNear;
  this.scene.fog.far=rig.fogFar;
  // Shadows by how wide the view is, however it got wide (speed, the far view, the wheel): they fade out, and past the fade the shadow pass
  // is not drawn at all. Indoors the room keeps its shadows.
  const shade=indoors?1:shadowShare(view);
  const off=!indoors&&view>(this.shadowsOff?SHADOW_VIEW.none-1:SHADOW_VIEW.none);
  if(off!==this.shadowsOff){this.shadowsOff=off;this.renderer.shadowMap.autoUpdate=!off;}
  this.sun.shadow.intensity=this.shadowsOff?0:shade;
  const sunset=s.settings.light==='cycle'?T.MathUtils.clamp((s.time-16)/6,0,1):0;
  this.sun.intensity=LIGHT.sunIntensity-sunset*1.1;
  this.sun.color.set(sunset>.45?'#efb180':LIGHT.sun);
  this.ambient.intensity=LIGHT.hemi-sunset*.4;
  this.applyLights();
  this.aimSun();if(!indoors)this.cullView(!this.shadowsOff&&this.renderer.shadowMap.enabled);
  for(const label of this.labels)label.visible=this.location==='interior'||Math.hypot(label.position.x-this.player.position.x,label.position.z-this.player.position.z)<30;
  this.playerRing.position.set(this.player.position.x,.05,this.player.position.z);const nearest=this.nearest();this.targetRing.visible=!!nearest&&nearest.type!=='dismount'&&!this.paused&&!this.fishing;if(this.targetRing.visible)this.targetRing.position.set(nearest.x,.06,nearest.z);this.renderer.render(this.scene,this.camera);
 }
 // The one writer of the hemisphere colours, the sun's colour and intensity, the fog's colour and the background (spec 3.7), called once a
 // frame straight after the sunset values are set. The base is the home light (toon.mjs LIGHT with the sunset values just written, and
 // this.fogBase, which the Pandora box tints); inside a land it crossfades to that land's row of region-life.mjs LIGHTS over the first 24 m
 // from the home region it touches (light-mix.mjs), and this.landShare is how far that fade has got (the night layer reads it).
 // The sunset's dimming carries into a land: its sun is the land's intensity less what the evening has taken.
 applyLights(){
  const base=this.lightBase,p=this.player?.position,at=this.lightAt;
  if(this.location==='village'&&p)landLightAt(p.x,p.z,LIGHTS,at);else{at.id=null;at.share=0;}
  const t=this.landShare=at.share,fog=this.scene.fog.color,sky=this.ambient.color,ground=this.ambient.groundColor,back=this.scene.background;
  sky.copy(base.sky);
  ground.copy(base.ground);
  fog.copy(this.fogBase);
  back.copy(base.background);
  if(t<=0)return;
  let land=this.landLights.get(at.id);
  if(!land){const row=LIGHTS[at.id];land={sky:new T.Color(row.sky),ground:new T.Color(row.ground),sun:new T.Color(row.sun),fog:new T.Color(row.fog),background:new T.Color(row.background??row.fog),sunIntensity:row.sunIntensity??LIGHT.sunIntensity};this.landLights.set(at.id,land);}
  sky.lerp(land.sky,t);
  ground.lerp(land.ground,t);
  fog.lerp(land.fog,t);
  back.lerp(land.background,t);
  this.sun.color.lerp(land.sun,t);
  this.sun.intensity+=(land.sunIntensity-LIGHT.sunIntensity)*t;
 }
 /** Read-only numbers of this file's round 8 parts, for willowmere.metrics().journey: the hop home, the view, the shadows, the light, the edge. */
 get journey(){
  const p=this.riding?this.riding.mesh.position:this.player.position,fog=this.scene.fog,cam=this.camera; // in a car, the car's place (the avatar sits off its centre)
  return{home:this.homing?.phase??'',ring:!!this.homeRing?.visible,fade:!!this.homeFade?.classList.contains('on'),farShare:this.farShare(),view:this.zoom*this.drive.zoom,
   shadow:this.sun.shadow.intensity,shadowPass:this.renderer.shadowMap.enabled&&this.renderer.shadowMap.autoUpdate,cameraFar:cam.far,cameraDistance:Math.hypot(cam.position.x-this.follow.x,cam.position.y-this.follow.y,cam.position.z-this.follow.z),
   fogNear:fog.near,fogFar:fog.far,fog:'#'+fog.color.getHexString(),sky:'#'+this.ambient.color.getHexString(),sun:'#'+this.sun.color.getHexString(),sunIntensity:this.sun.intensity,land:this.lightAt.id,landShare:this.landShare,
   edgeDepth:this.edgeDepth(p.x,p.z),edgeDistance:this.location==='village'?edgeDistance(p.x,p.z):null,edgeTold:this.edgeTold,wildDepth:wildDepth(p.x,p.z),landCalls:this.landCalls};
 }
 /** How much of the far view is open, 0 to 1 (the driving camera's pull-back by distance, drive.mjs farZoom). */
 farShare(){const full=FAR_VIEW/this.zoom-1;return full>0?Math.min(1,Math.max(0,(this.drive.zoom-1)/full)):0;}
 // The sun's shadow box is fitted to what the camera shows whenever that changes (zoom, screen, graphics, going indoors), never from
 // frame to frame, and the sun then looks at whole shadow texels, so shadow edges stay still while you move (sun-shadow.mjs).
 aimSun(){const indoors=this.location==='interior',c=this.camera,size=this.sun.shadow.mapSize.x,wide=this.riding?DRIVE_CAMERA.zoom:1,key=indoors?-size:(c.right*4099+c.top)*wide+size;if(key!==this.shadowKey){this.shadowKey=key;this.shadowBox=fitShadow(this.sun,indoors?{room:[WALK.x+1.5,WALK.z+1.5,5]}:{halfWidth:c.right*wide,halfHeight:c.top*wide},size);}followSun(this.sun,this.shadowBox,this.follow.x,this.follow.z);}
 // What cannot show leaves the frame (spec 18; smooth-dense-scenes). Spheres are loose for a 64 m tile or a 32 m village cell, and the
 // shadow box is the light-space box round the view, so it also holds pieces down-sun of it and off its sides. So each frame outdoors:
 // a village cell or a tile's batch is drawn when its box meets what the camera shows of the ground and 10 m above it (2 m spare), and
 // casts a shadow only when that box, stretched by its shadow (height x the sun's slope), does.
 cullView(shadows){const c=this.camera,f=this.footprint??=[0,0,0,0],v=this.cullPoint??=new T.Vector3(),d=this.cullDir??=new T.Vector3();c.getWorldDirection(d);const l=Math.hypot(d.x,d.z),ux=d.x/l,uz=d.z/l;f[0]=f[2]=Infinity;f[1]=f[3]=-Infinity;
  // In the camera's own ground axes (screen right, screen up) the ground in view is a rectangle; a box is tested on both axes.
  const fit=(x,z,g)=>{const r=x*-uz+z*ux,u=x*ux+z*uz;g[0]=Math.min(g[0],r);g[1]=Math.max(g[1],r);g[2]=Math.min(g[2],u);g[3]=Math.max(g[3],u);};
  for(const sx of [-1,1])for(const sy of [-1,1])for(const h of [0,10]){v.set(sx,sy,-1).unproject(c);const t=(h-v.y)/d.y;fit(v.x+d.x*t,v.z+d.z*t,f);}
  const g=[0,0,0,0],meets=(b,sweep)=>{const h=sweep?b.max.y:0,kx=-SUN_OFFSET[0]/SUN_OFFSET[1]*h,kz=-SUN_OFFSET[2]/SUN_OFFSET[1]*h;g[0]=g[2]=Infinity;g[1]=g[3]=-Infinity;
   for(const x of [b.min.x,b.max.x])for(const z of [b.min.z,b.max.z]){fit(x,z,g);fit(x+kx,z+kz,g);}return g[0]-2<f[1]&&g[1]+2>f[0]&&g[2]-2<f[3]&&g[3]+2>f[2];};
  let n=0;for(const m of this.villageCells?.children??[]){if(m.userData.casts===undefined)continue;if(!m.userData.casts){m.visible=meets(m.geometry.boundingBox);continue;}const cast=m.castShadow=shadows&&meets(m.geometry.boundingBox,true);m.visible=cast||meets(m.geometry.boundingBox);n+=cast;}
  this.castersKept=n+(this.fields?.cullView(meets,shadows)??0);}
 project(x,z,y=0){const p=new T.Vector3(x,y,z).project(this.camera);return{x:(p.x*.5+.5)*innerWidth,y:(-.5*p.y+.5)*innerHeight};}
 get metrics(){return{drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures,fields:this.fields?.metrics,birds:this.birds?.metrics,homeGuide:this.player?this.homeGuide:null,fishing:this.rodFishing?.metrics,pond:this.pondLife?.metrics,grove:this.grove?.metrics};}
}
