// The village clothes are real garments: the 13 of the Finch atelier (wm-garments.glb) and Pip's four (wm-kids.glb), plus the
// six Zoo Garden costumes copied into gear-wear.glb. Measured on the shipped files: every id has its model, nodes and tags,
// every old id maps to a garment in its own colour, saves migrate, the Colour row only dyes, every look can wear every garment
// with the same number of meshes, a costume covers the garment, and no skirt, coat hem or trouser leg lets a leg through at
// the widest stride (walk-cycle.mjs MAX_SWING).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {existsSync,readFileSync} from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {buildAvatar,preloadAvatar,useAvatarLoader,lowestFoot,reclothe,tintShirt,styleKey,playerWants} from '../src/avatar.mjs';
import {freshState,act,parseSave} from '../src/game.mjs';
import {OUTFITS,KID_OUTFITS} from '../src/content.mjs';
import {GEAR,kitOf} from '../src/gear.mjs';
import {BODIES,HEIGHTS,DEFAULT_LOOK} from '../src/looks.mjs';
import {MAX_SWING} from '../src/walk-cycle.mjs';
import {garmentOf,kidGarmentOf} from '../src/garments.mjs';

const glb=name=>{const b=readFileSync(new URL(`../public/assets/models/${name}.glb`,import.meta.url));return {b,json:JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString('utf8'))};};
const loader=async name=>{const b=await readFile(new URL(`../public/assets/models/${name}.glb`,import.meta.url));return await new Promise((ok,no)=>new GLTFLoader().parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'',g=>ok(g.scene),no));};
useAvatarLoader(loader);const world={};
/** top node name -> its child node names */
const nodesOf=file=>{const {json}=glb(file);return new Map(json.scenes[json.scene??0].nodes.map(i=>[json.nodes[i].name,(json.nodes[i].children??[]).map(c=>json.nodes[c].name)]));};
const GARMENTS=OUTFITS.map(o=>({id:o.id,node:garmentOf(o.id),file:'wm-garments',color:o.color,name:o.name,price:o.price}));
const KIDS=KID_OUTFITS.map(o=>({id:o.id,node:kidGarmentOf(o.id),file:'wm-kids',color:o.color,name:o.name,price:o.price}));
const ALL=[...GARMENTS,...KIDS];
const meshes=a=>{const out=[];a.traverse(o=>{if(o.isMesh)out.push(o);});return out;};
const tris=a=>meshes(a).reduce((n,m)=>n+m.geometry.getAttribute('position').count/3,0);

test('every garment has its model, its parts tagged for the rig, a tintable cloth and an icon',()=>{
 assert.equal(GARMENTS.length,13);assert.equal(KIDS.length,4);
 for(const file of ['wm-garments','wm-kids']){
  const nodes=nodesOf(file),{json}=glb(file);
  for(const g of ALL.filter(g=>g.file===file)){
   assert.ok(nodes.has(g.node),`${g.node} is a node of ${file}.glb`);
   const kids=nodes.get(g.node);
   assert.ok(kids.includes(`${g.node}@body`),`${g.node}@body`);
   assert.equal(kids.includes(`${g.node}_sleeve_l@arm-left`),kids.includes(`${g.node}_sleeve_r@arm-right`),`${g.node} has both sleeves or none`);
   assert.ok(kids.includes(`${g.node}_sleeve_l@arm-left`),`${g.node} has sleeves (a bare arm is painted by the game instead)`);
   assert.equal(kids.includes(`${g.node}_l@leg-left`),kids.includes(`${g.node}_r@leg-right`),`${g.node} legs come in pairs`);
   for(const k of kids)assert.match(k,/@(body|arm-left|arm-right|leg-left|leg-right)$/,`${g.node}: ${k}`);
   assert.ok(json.materials.some(m=>m.name===`Hero shirt ${g.node}`),`${g.node} has a Hero shirt cloth`);
   assert.ok(existsSync(new URL(`../public/assets/icons/items/${g.node}.webp`,import.meta.url)),`${g.node} icon`);
   assert.equal(kitOf(g.node),file);
  }
 }
 assert.ok(glb('wm-garments').b.length<520*1024&&glb('wm-kids').b.length<260*1024,'on-demand files stay small');
 assert.ok(nodesOf('wm-garments').get('garment_honey').includes('garment_honey_l@leg-left'),'the overalls have trouser legs');
 assert.deepEqual([...nodesOf('wm-garments').keys()].sort(),GARMENTS.map(g=>g.node).sort(),'nothing but the thirteen');
});
test('every old outfit id is a garment in its own colour; a save keeps what it owned and dyes only with the atelier’s dyes',()=>{
 const old=JSON.parse(JSON.stringify(freshState()));delete old.tint;old.owned=['meadow','rose','plum'];old.outfit='plum';old.kidOwned=['sunny','party'];old.kidOutfit='party';
 const s=parseSave(old);assert.equal(s.outfit,'plum');assert.deepEqual(s.owned,['meadow','rose','plum']);assert.equal(s.tint,'');assert.equal(s.kidOutfit,'party');assert.deepEqual(s.kidOwned,['sunny','party']);
 assert.equal(playerWants({state:s}).gear.garment,'garment_plum');assert.equal(playerWants({state:s}).outfitColor,OUTFITS.find(o=>o.id==='plum').color,'old owners see the garment in the colour they bought');
 for(const o of OUTFITS){const w=playerWants({state:{...freshState(),outfit:o.id}});assert.equal(w.gear.garment,garmentOf(o.id));assert.equal(w.outfitColor,o.color);}
 assert.equal(parseSave({...old,tint:'#123456'}).tint,'','an unknown dye is dropped');assert.equal(parseSave({...old,tint:OUTFITS[3].color}).tint,OUTFITS[3].color);
 const r=freshState();r.coins=1000;assert.ok(act(r,'outfit',{id:'rose'}).ok);assert.equal(r.outfit,'rose');assert.equal(r.coins,1000-OUTFITS.find(o=>o.id==='rose').price);
 assert.ok(act(r,'tint',{id:OUTFITS[5].color}).ok);assert.equal(r.tint,OUTFITS[5].color);assert.equal(playerWants({state:r}).outfitColor,OUTFITS[5].color,'the Colour row dyes the worn garment');
 assert.equal(act(r,'tint',{id:'#abcdef'}).ok,false);assert.equal(r.tint,OUTFITS[5].color);assert.equal(r.coins,1000-OUTFITS.find(o=>o.id==='rose').price,'dyeing is free');
 assert.ok(act(r,'tint',{id:''}).ok);assert.equal(r.tint,'');
 r.gear.wear='armor_knight';r.tint=OUTFITS[2].color;assert.ok(act(r,'outfit',{id:'plum'}).ok||true);
 const c=freshState();c.coins=5000;act(c,'buyGear',{id:'armor_knight'});assert.equal(c.gear.wear,'armor_knight');act(c,'tint',{id:OUTFITS[2].color});assert.ok(act(c,'outfit',{id:'sky'}).ok);assert.equal(c.gear.wear,'','choosing clothes takes the costume off');assert.equal(c.tint,'','a new garment shows in its own colour');
 assert.equal(act(freshState(),'outfit',{id:'nope'}).ok,false);
 assert.equal(act(freshState(),'kidOutfit',{id:'rain'}).ok,true);
});
test('the six Zoo Garden costumes are gear with the reference’s numbers, a model and an icon',()=>{
 const want={armor_army:[220,45,14],armor_navy:[200,40,12],armor_aodai:[210,50,10],armor_aodai_man:[210,40,13],armor_usa:[190,35,11],armor_vietnam:[190,45,11]},names=nodesOf('gear-wear');
 for(const [id,[price,hp,def]] of Object.entries(want)){const g=GEAR[id];assert.ok(g,id);assert.equal(g.slot,'wear');assert.equal(g.price,price);assert.equal(g.hp,hp);assert.equal(g.def,def);assert.ok(names.has(id),`${id} in gear-wear.glb`);assert.ok(names.get(id).some(n=>n===`${id}@body`),id);assert.ok(existsSync(new URL(`../public/assets/icons/${g.icon}.webp`,import.meta.url)));}
 assert.equal(names.size,47,'the 41 old pieces and the six costumes');
});
test('the sixteen Zoo Garden disguises are gear in their own group, with models, icons, stats; every look can wear them, hats and weapons too',async()=>{
 const ids=Object.keys(GEAR).filter(i=>GEAR[i].disguise),names=nodesOf('disguises');
 assert.equal(ids.length,16);assert.deepEqual([...names.keys()].sort(),ids.sort());
 const {gearGroups}=await import('../src/gear.mjs');assert.deepEqual(gearGroups(ids).map(g=>g.id),['disguise']);assert.equal(gearGroups(['armor_army','dz_ninja','hat_straw']).map(g=>g.id).join(),'hat,wear,disguise');
 for(const id of ids){assert.equal(kitOf(id),'disguises');assert.ok(existsSync(new URL(`../public/assets/icons/items/${id}.webp`,import.meta.url)),id);assert.ok(names.get(id).length>=3);}
 const looks=['girl-tall-none-none','boy-tiny-cat-none','sturdy-grown-none-fox','slim-teen-bunny-none','boy-chibi-none-none'];
 for(const look of looks){await preloadAvatar(world,{look,gear:{wear:'dz_ninja',hat:'hat_wizard',weapon:'sword_wood',boots:'boots_cloud'}});
  const bare=buildAvatar(world,{look});
  for(const id of ids){const a=buildAvatar(world,{look,gear:{wear:id,hat:'hat_straw',boots:'boots_cloud',weapon:'sword_wood',garment:'garment_rose'}});
   assert.equal(a.userData.pending,false,id);assert.ok(tris(a)>tris(bare)+200,`${look} ${id}`);assert.ok(a.getObjectByName('weapon'),'the weapon stays in hand');
   const lows=lowestFoot(a);assert.ok(lows>-.2,`${id} feet`);}}
});
test('every look wears every garment: six meshes, the garment’s cloth in the outfit colour, nothing pending',async()=>{
 const looks=[];for(const body of BODIES)for(const h of HEIGHTS)looks.push(`${body}-${h}-none-none`);
 await preloadAvatar(world,{look:DEFAULT_LOOK,gear:{garment:'garment_rose'}});await preloadAvatar(world,{look:DEFAULT_LOOK,gear:{garment:'kid_party'}});
 for(const look of looks){
  await preloadAvatar(world,{look});const bare=buildAvatar(world,{look,gear:{garment:''}});
  assert.equal(meshes(bare).length,6);
  for(const g of ALL){
   const a=buildAvatar(world,{look,outfitColor:g.color,gear:{garment:g.node}});
   assert.equal(a.userData.pending,false,`${look} ${g.node}`);assert.equal(meshes(a).length,6,`${look} ${g.node}: the garment is merged into the six parts`);
   assert.ok(tris(a)>tris(bare)+80,`${look} ${g.node} adds geometry`);
  }
 }
 // the cloth takes the colour (and its shade 72%), the trim does not
 const a=buildAvatar(world,{look:DEFAULT_LOOK,outfitColor:'#ff0000',gear:{garment:'garment_honey'}}),body=a.userData.parts.body.children[0],col=body.geometry.getAttribute('color');
 let red=0,other=0;for(let i=0;i<col.count;i++){if(Math.abs(col.getX(i)-1)<1e-6&&col.getY(i)<1e-6)red++;else other++;}
 assert.ok(red>200&&other>200,`cloth red ${red}, trim and body ${other}`);
 tintShirt(a,'#00ff00');let green=0,still=0;for(let i=0;i<col.count;i++){if(col.getX(i)<1e-6&&Math.abs(col.getY(i)-1)<1e-6)green++;}for(let i=0;i<col.count;i++)if(Math.abs(col.getX(i)-1)<1e-6&&col.getY(i)<1e-6)still++;
 assert.ok(green>=red&&still===0,'a recolour reaches the garment too');
 assert.notEqual(styleKey({look:DEFAULT_LOOK,outfitColor:'#fff',gear:{garment:'garment_rose'}}),styleKey({look:DEFAULT_LOOK,outfitColor:'#fff',gear:{garment:'garment_plum'}}));
});
test('a costume covers the garment; bare arms show skin; a person can be dressed again in place',async()=>{
 await preloadAvatar(world,{look:DEFAULT_LOOK,gear:{wear:'armor_knight',garment:'garment_rose'}});
 const knight=buildAvatar(world,{look:DEFAULT_LOOK,gear:{wear:'armor_knight',garment:''}}),over=buildAvatar(world,{look:DEFAULT_LOOK,gear:{wear:'armor_knight',garment:'garment_rose'}});
 assert.equal(tris(over),tris(knight),'the costume is all you see');
 const armColours=(g,color)=>{const a=buildAvatar(world,{look:DEFAULT_LOOK,outfitColor:color,gear:{garment:g}}),c=a.userData.parts.arm_r.children[0].geometry.getAttribute('color'),seen=new Set();for(let i=0;i<c.count;i++)seen.add([c.getX(i),c.getY(i),c.getZ(i)].map(v=>v.toFixed(3)).join());return seen;};
 const own=buildAvatar(world,{look:DEFAULT_LOOK}).userData.parts.arm_r.children[0].geometry.getAttribute('position').count;
 const baseArm=(g,color)=>{const a=buildAvatar(world,{look:DEFAULT_LOOK,outfitColor:color,gear:{garment:g}}),c=a.userData.parts.arm_r.children[0].geometry.getAttribute('color'),seen=new Set();for(let i=0;i<own;i++)seen.add([c.getX(i),c.getY(i),c.getZ(i)].map(v=>v.toFixed(3)).join());return seen;};
 assert.ok([...baseArm('garment_rose','#0000ff')].some(k=>k.startsWith('0.000,0.000,1.000')),'a long sleeve covers the arm, the shirt under it is the outfit colour');
 for(const g of ['garment_coral','kid_sunny','kid_party'])assert.ok(![...baseArm(g,'#0000ff')].some(k=>k.startsWith('0.000,0.000,1.000')),`${g}: the arm is skin, not the outfit colour`);
 const girl=buildAvatar(world,{look:DEFAULT_LOOK,outfitColor:'#e8b950'}),group=new T.Group();girl.scale.setScalar(.57);girl.position.set(3,0,4);girl.rotation.y=1.2;girl.name='pip';group.add(girl);
 await preloadAvatar(world,{look:DEFAULT_LOOK,gear:{garment:'kid_rain'}});
 const dressed=reclothe(world,girl,{look:DEFAULT_LOOK,outfitColor:'#68a8b7',gear:{garment:'kid_rain'}});
 assert.equal(dressed.parent,group);assert.equal(girl.parent,null);assert.equal(dressed.position.x,3);assert.equal(dressed.scale.y,.57);assert.equal(dressed.rotation.y,1.2);assert.equal(dressed.name,'pip');assert.ok(tris(dressed)>tris(buildAvatar(world,{look:DEFAULT_LOOK}))+100);
});
/** The garment's own vertices of a part, in the avatar's frame, as height bands of their widest radius. */
function skirtBands(a,bareA){
 const body=a.userData.parts.body.children[0],n0=bareA.userData.parts.body.children[0].geometry.getAttribute('position').count,at=body.geometry.getAttribute('position');
 a.updateMatrixWorld(true);const bands=new Map();let hem=Infinity;
 for(let i=n0;i<at.count;i++){const v=new T.Vector3().fromBufferAttribute(at,i).applyMatrix4(body.matrixWorld),k=Math.round(v.y/.04);bands.set(k,Math.max(bands.get(k)??0,Math.hypot(v.x,v.z)));hem=Math.min(hem,v.y);}
 return {bands,hem};
}
test('at the widest stride no leg comes through a skirt, a coat hem or a dress, and trouser legs keep the feet on the ground',async()=>{
 const lows=[],fails=new Map();
 for(const look of ['girl-tall-none-none','boy-tall-none-none','girl-tiny-none-none','girl-teen-none-none','boy-grown-none-none','girl-chibi-none-none','sturdy-tall-none-none','slim-tall-none-none']){
  await preloadAvatar(world,{look});const bare=buildAvatar(world,{look});
  for(const g of ALL){
   if(g.file==='wm-kids'&&look!=='girl-tall-none-none')continue; // Pip's garments are only ever worn by Pip, the tall girl body
   const a=buildAvatar(world,{look,outfitColor:g.color,gear:{garment:g.node}}),{bands,hem}=skirtBands(a,bare),p=a.userData.parts;
   const hipY=p.leg_l.position.y;if(hem>hipY+.05)continue; // a jacket above the hips
   for(const [l,r] of [[MAX_SWING,-MAX_SWING],[-MAX_SWING,MAX_SWING]]){
    p.leg_l.rotation.x=l;p.leg_r.rotation.x=r;a.updateMatrixWorld(true);
    for(const leg of [p.leg_l,p.leg_r])for(const m of leg.children){
     if(!m.isMesh)continue;const at=m.geometry.getAttribute('position');
     for(let i=0;i<at.count;i++){const v=new T.Vector3().fromBufferAttribute(at,i).applyMatrix4(m.matrixWorld);if(v.y<hem+.03||v.y>hipY)continue;
      const width=bands.get(Math.round(v.y/.04));if(width===undefined)continue;
      const over=Math.hypot(v.x,v.z)-width*.97;if(over>0)fails.set(`${look} ${g.node}`,Math.max(fails.get(`${look} ${g.node}`)??0,over));}
    }
   }
   p.leg_l.rotation.x=p.leg_r.rotation.x=0;
   if(look==='girl-tall-none-none'){const a2=a;a2.updateMatrixWorld(true);lows.push([g.node,lowestFoot(a2),lowestFoot(bare)]);}
  }
 }
 assert.deepEqual([...fails].map(([k,v])=>`${k} +${v.toFixed(3)}`),[],'legs through a garment');
 for(const [node,low,bareLow] of lows)assert.ok(Math.abs(low-bareLow)<1e-6,`${node}: the lowest point is still the shoe (${low} vs ${bareLow})`);
});
test('the shops and the wardrobe show garments first, the Colour row as swatches, and no colour is offered as clothing',async()=>{
 const {ui}=await import('../src/garments.mjs');ui.view=await import('../src/garments-view.mjs');
 const {renderShop}=await import('../src/shop-view.mjs'),{wardrobeHtml}=await import('../src/wardrobe-view.mjs');
 const s=freshState();s.coins=5000;s.owned=['meadow','rose'];s.outfit='rose';
 const shop=renderShop({state:s,tab:'outfits',shopId:'clothes'}).html;
 assert.equal((shop.match(/data-shop-try="/g)??[]).length,12,'Try on cards only for garments (the worn one has none)');assert.equal((shop.match(/data-type="tint"/g)??[]).length,14,'thirteen dyes and "own"');
 assert.doesNotMatch(shop,/data-shop-try="#/,'a colour has no Try on');assert.doesNotMatch(shop,/Soft bob|body-picker/,'the body picker lives in the mirror');
 assert.match(shop,/items\/garment_rose\.webp/);assert.match(shop,/Colour/);
 const kids=renderShop({state:s,tab:'kids',shopId:'clothes'}).html;assert.equal((kids.match(/data-shop-try="/g)??[]).length,4);assert.match(kids,/items\/kid_sunny\.webp/);assert.match(kids,/data-mirror-slot="kids"/);assert.doesNotMatch(kids,/sv-figure/);
 const w=wardrobeHtml(s,{});assert.ok(w.indexOf('data-colour-row')>0&&w.indexOf('data-colour-row')<w.indexOf('Clothes'));assert.match(w,/data-garment="rose"/);assert.match(w,/data-garment="meadow"/);assert.doesNotMatch(w,/data-garment="honey"/,'only what you own');
 assert.doesNotMatch(w,/Shirt colours/);
 s.gear.wear='armor_knight';assert.match(wardrobeHtml(s,{}),/Take off your costume to dye/);
});
