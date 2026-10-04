// The villagers' outfits (outfits.mjs), measured on the shipped files: every resident has one, no two residents wear the same,
// every piece an outfit names exists in the file the game fetches it from, the adventure outfit (the Pandora box open) differs
// from the everyday one and keeps the person (body, colour), children wear the kids' garments, Pip wears what was bought for
// her, and every outfit builds a whole avatar (six meshes, no file pending) in both states.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {buildAvatar,preloadAvatar,useAvatarLoader} from '../src/avatar.mjs';
import {RESIDENTS,KID_OUTFITS,OUTFITS} from '../src/content.mjs';
import {GEAR,kitOf} from '../src/gear.mjs';
import {outfitOf,outfitKey,OUTFIT_IDS,outfitColour} from '../src/outfits.mjs';
import {freshState} from '../src/game.mjs';
import {splitLook,isLook} from '../src/looks.mjs';

const glb=name=>{const b=readFileSync(new URL(`../public/assets/models/${name}.glb`,import.meta.url));return JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString('utf8'));};
const nodeNames=file=>{const j=glb(file);return new Set(file==='hero-parts'?j.nodes.map(n=>n.name):j.scenes[j.scene??0].nodes.map(i=>j.nodes[i].name));}; // hero-parts keeps its pieces under one root
const loader=async name=>{const b=await readFile(new URL(`../public/assets/models/${name}.glb`,import.meta.url));return await new Promise((ok,no)=>new GLTFLoader().parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'',g=>ok(g.scene),no));};
useAvatarLoader(loader);const world={};
const KIDS=RESIDENTS.filter(p=>p.child);

test('every resident has an outfit of their own, and the player is the 24th person',()=>{
 assert.equal(RESIDENTS.length,23,'23 neighbours and the player Rowan make the 24');
 assert.deepEqual([...OUTFIT_IDS].sort(),RESIDENTS.map(p=>p.id).sort(),'one row per resident, no stranger');
 for(const p of RESIDENTS)for(const open of [false,true]){const w=outfitOf(p,open,freshState());assert.ok(isLook(w.look),`${p.id} look`);assert.match(w.outfitColor,/^#[0-9a-f]{6}$/i);assert.ok(w.gear.hat||w.gear.garment||w.gear.wear||w.gear.boots||splitLook(w.look).hood!=='none'||splitLook(w.look).ears!=='none',`${p.id} wears something`);}
});
test('no two residents have the same outfit, in either state',()=>{
 for(const open of [false,true]){const seen=new Map();for(const p of RESIDENTS){const k=outfitKey(outfitOf(p,open,freshState()));assert.ok(!seen.has(k),`${p.id} and ${seen.get(k)} wear the same (${k}), box ${open?'open':'shut'}`);seen.set(k,p.id);}}
 // and no two look alike at a glance: a pair needs a different colour, body, hat or costume
 const sig=(p,open)=>{const w=outfitOf(p,open,freshState());return [w.look,w.outfitColor,w.gear.hat,w.gear.wear].join('|');};
 for(const open of [false,true]){const seen=new Set();for(const p of RESIDENTS){assert.ok(!seen.has(sig(p,open)),`${p.id} repeats a signature`);seen.add(sig(p,open));}}
});
test('every piece an outfit names exists in the shipped file it is fetched from',()=>{
 const files=new Map();const has=(file,name)=>{if(!files.has(file))files.set(file,nodeNames(file));return files.get(file).has(name);};
 for(const p of RESIDENTS)for(const open of [false,true]){
  const w=outfitOf(p,open,{...freshState(),kidOutfit:p.id==='pip'?'party':''}),{garment,hat,wear,boots}=w.gear,l=splitLook(w.look);
  if(garment)assert.ok(has(kitOf(garment),garment),`${p.id}: ${garment} is in ${kitOf(garment)}.glb`);
  if(hat){assert.equal(GEAR[hat]?.slot,'hat',`${p.id} ${hat} is a hat`);assert.ok(has(kitOf(hat),hat),`${p.id}: ${hat} exists`);}
  if(wear){assert.equal(GEAR[wear]?.slot,'wear',`${p.id} ${wear} is a costume`);assert.ok(has(kitOf(wear),wear),`${p.id}: ${wear} exists`);}
  if(boots){assert.equal(GEAR[boots]?.slot,'boots',`${p.id} ${boots} are boots`);assert.ok(has(kitOf(boots),boots),`${p.id}: ${boots} exist`);}
  if(l.hood!=='none')assert.ok(has('hero-parts','deco-'+l.hood),`${p.id}: the ${l.hood} hood exists`);
  if(l.ears!=='none')assert.ok(has('hero-parts','ears-'+l.ears)&&has('hero-parts','tail-'+l.ears),`${p.id}: ${l.ears} ears exist`);
  assert.equal(l.height,'tall','villagers keep the tall body (its two files load with the game)');
 }
});
test('the adventure outfit differs from the everyday one and keeps the person',()=>{
 for(const p of RESIDENTS){
  const day=outfitOf(p,false,freshState()),wild=outfitOf(p,true,freshState());
  assert.notEqual(outfitKey(day),outfitKey(wild),`${p.id} looks different with the box open`);
  assert.equal(wild.look,day.look,`${p.id} is the same person`);assert.equal(wild.outfitColor,day.outfitColor,`${p.id} keeps their colour`);
  if(p.id!=='pip'){assert.ok(wild.gear.wear,`${p.id} wears a costume for the wilds`);assert.equal(GEAR[wild.gear.wear].slot,'wear');}
  assert.equal(day.gear.wear,'','everyday clothes are never a costume');
  assert.deepEqual(outfitOf(p,true,freshState()),wild,'derived, not stored: the same box gives the same outfit');
 }
});
test('children wear the kids\' garments, grown-ups the village garments, and Pip what was bought for her',()=>{
 assert.deepEqual(KIDS.map(p=>p.id).sort(),['faye','kit','milo','pip','wren']);
 for(const p of RESIDENTS){const g=outfitOf(p,false,freshState()).gear.garment;if(p.id==='pip')assert.equal(g,'','Pip has her own hat until something is bought');else assert.match(g,p.child?/^kid_(sunny|rain|berry|party)$/:/^garment_/,`${p.id}`);}
 for(const k of KID_OUTFITS){const s={...freshState(),kidOutfit:k.id};for(const open of [false,true]){const w=outfitOf(RESIDENTS.find(p=>p.id==='pip'),open,s);assert.equal(w.gear.garment,'kid_'+k.id);assert.equal(w.outfitColor,k.color);assert.equal(w.gear.wear,'','her bought garment stays in view in the wilds');}}
 assert.equal(outfitColour(RESIDENTS.find(p=>p.id==='pip'),{kidOutfit:'rain'}),KID_OUTFITS.find(k=>k.id==='rain').color,'her portrait badge follows it');
 assert.ok(OUTFITS.length===13);
});
test('every outfit builds a whole avatar in both states',async()=>{
 const state=freshState();let tris={day:0,wild:0};
 for(const p of RESIDENTS)for(const open of [false,true]){
  const w=outfitOf(p,open,state);await preloadAvatar(world,w);const a=buildAvatar(world,w);
  assert.equal(a.userData.pending,false,`${p.id} has every file it needs`);
  let meshes=0,t=0;a.traverse(o=>{if(o.isMesh){meshes++;t+=o.geometry.getAttribute('position').count/3;}});
  assert.ok(meshes>=6&&meshes<=9,`${p.id} draws ${meshes} meshes (six, plus glow)`);assert.ok(t>900&&t<14000,`${p.id} ${t|0} triangles`);
  tris[open?'wild':'day']+=t;
  const box=new T.Box3().setFromObject(a);assert.ok(box.max.y>1.2&&box.max.y<3.4,`${p.id} stands ${box.max.y.toFixed(2)} m tall`);
 }
 console.log(`triangles of all 23: ${tris.day|0} everyday, ${tris.wild|0} adventure`);
});
