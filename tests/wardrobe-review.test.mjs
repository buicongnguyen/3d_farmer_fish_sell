// Review fixes of the wardrobe and the villagers, each one a test that fails on the code it was found in:
// the party skirt is not a plate; the seven village garments are seven cuts; Pip's default is a real garment; every
// villager keeps their outfit when Pandora toggles, and no villager's outfit needs the disguise file;
// the boot list does not bake or fetch the clothes; trying a garment on shows its own colour; choosing a garment says
// that the costume came off and settles the health; a costume blocks the dye.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RESIDENTS,OUTFITS} from '../src/content.mjs';
import {GEAR,kitOf,gearStats} from '../src/gear.mjs';
import {freshState,act} from '../src/game.mjs';
import {outfitOf} from '../src/outfits.mjs';
import {splitLook} from '../src/looks.mjs';
import {playerWants,buildAvatar,preloadAvatar,useAvatarLoader} from '../src/avatar.mjs';
import {garmentOf} from '../src/garments.mjs';

const loader=async name=>(await parse(name));
useAvatarLoader(loader);
const parse=name=>{const b=readFileSync(new URL(`../public/assets/models/${name}.glb`,import.meta.url));return new Promise((ok,no)=>new GLTFLoader().parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'',g=>ok(g.scene),no));};
/** hem height, whether trouser legs, how many sleeves and the widest reach of a garment's body piece, measured on the shipped file */
async function cuts(file){
 const scene=await parse(file),out=new Map();
 for(const n of scene.children){const body=n.children.find(c=>c.name.endsWith('@body'));n.updateMatrixWorld(true);const bb=new T.Box3().setFromObject(body);
  out.set(n.name,{hem:bb.min.y,legs:n.children.some(c=>c.name.includes('@leg')),legHem:Math.min(1,...n.children.filter(c=>c.name.includes('@leg')).map(c=>new T.Box3().setFromObject(c).min.y)),arms:n.children.filter(c=>c.name.includes('@arm')).length,half:Math.max(bb.max.x,-bb.min.x,bb.max.z,-bb.min.z)});}
 return out;
}

test('the party dress skirt is a soft bell, not a plate: it reaches little past the body and starts above the knee',async()=>{
 const k=(await cuts('wm-kids')).get('kid_party');
 assert.ok(k.half<=.62,`the skirt reaches ${k.half.toFixed(2)} from the middle (a plate was .76)`);assert.ok(k.hem>=.28,`its hem is at ${k.hem.toFixed(2)}`);
 const sunny=(await cuts('wm-kids')).get('kid_sunny');assert.ok(k.half<=sunny.half+.05,'no wider than the pinafore, which reads as clothes');
});
test('the seven smock-like garments are seven different cuts, not trim on one silhouette',async()=>{
 const all=await cuts('wm-garments'),seven=['meadow','plum','midnight','ivory','coral','fern','sky'].map(i=>[i,all.get('garment_'+i)]);
 for(const [i,c] of seven)assert.ok(!(c.hem>=.38&&c.hem<=.5&&!c.legs&&c.half<.6),`${i} is not the old knee-length smock (hem ${c.hem.toFixed(2)}, ${c.half.toFixed(2)} wide)`);
 for(const [i,a] of seven)for(const [j,b] of seven){if(i>=j)continue;
  const apart=a.legs!==b.legs||Math.abs(a.legHem-b.legHem)>=.08||a.arms!==b.arms||Math.abs(a.hem-b.hem)>=.035||Math.abs(a.half-b.half)>=.05;
  assert.ok(apart,`${i} and ${j} share one silhouette (hem ${a.hem.toFixed(2)}/${b.hem.toFixed(2)}, reach ${a.half.toFixed(2)}/${b.half.toFixed(2)})`);}
});
test('Pip keeps her sunny pinafore, hat and boots when Pandora opens',()=>{
 const pip=RESIDENTS.find(p=>p.id==='pip'),day=outfitOf(pip,false,freshState()),wild=outfitOf(pip,true,freshState());
 assert.equal(day.gear.garment,'kid_sunny');assert.ok(day.gear.garment&&day.gear.hat,'a garment and a hat, not a bare tunic');
 assert.deepEqual(wild,day,'Pandora does not change any part of her outfit');
});
test('all villagers keep their own everyday clothes when Pandora opens',()=>{
 for(const p of RESIDENTS){const d=outfitOf(p,false,freshState()),w=outfitOf(p,true,freshState());assert.deepEqual(w,d,p.id);assert.equal(w.gear.wear,'');}
 const hugo=outfitOf(RESIDENTS.find(p=>p.id==='hugo'),true,freshState()).gear;assert.equal(hugo.hat,'hat_chef');
 const cora=outfitOf(RESIDENTS.find(p=>p.id==='cora'),true,freshState()).gear;assert.equal(cora.hat,'hat_graduate');
});
test('Pip keeps a purchased outfit through a Pandora toggle and save reload',()=>{
 const pip=RESIDENTS.find(p=>p.id==='pip'),s=freshState();s.coins=10000;assert.ok(act(s,'kidOutfit',{id:'party'}).ok);
 const day=outfitOf(pip,false,s);assert.equal(day.gear.garment,'kid_party');assert.deepEqual(outfitOf(pip,true,JSON.parse(JSON.stringify(s))),day);
});
test('no villager needs the 840 KB disguise file: their outfits come from files the game already has',()=>{
 for(const p of RESIDENTS)for(const open of [false,true]){const w=outfitOf(p,open,freshState()).gear;
  for(const id of Object.values(w).filter(Boolean)){assert.ok(!GEAR[id]?.disguise,`${p.id} wears a disguise (${id})`);assert.ok(['gear-wear','wm-garments','wm-kids'].includes(kitOf(id)),`${p.id}: ${id} comes from ${kitOf(id)}`);}}
});
test('the boot list neither fetches nor bakes the clothes: they arrive on demand and are only read raw',()=>{
 const src=readFileSync(new URL('../src/world.mjs',import.meta.url),'utf8'),files=/const files=\[([^\]]*)\]/.exec(src)[1];
 for(const f of ['wm-garments','wm-kids','gear-wear','hero-parts'])assert.ok(!files.includes(`'${f}'`),`${f} is not a boot file`);
 assert.match(src,/warmVillagers\(\)/,'the villagers ask for their clothes after the first frame');
 assert.match(src,/villagersStale/,'and villagers-view swaps them in two a frame');
});
test('trying a garment on shows its own colour even when a dye is set; wearing it drops the dye, as the preview said',()=>{
 const s=freshState();s.owned=[...s.owned,'rose','harbor'];s.outfit='rose';s.tint='#d4a44f';
 const world={state:s,tryOn:null};
 assert.equal(playerWants(world).outfitColor.toLowerCase(),'#d4a44f','the worn garment shows the dye');
 world.tryOn={garment:garmentOf('harbor'),garmentId:'harbor',gear:{...s.gear,wear:''}};
 assert.equal(playerWants(world).outfitColor.toLowerCase(),OUTFITS.find(o=>o.id==='harbor').color.toLowerCase(),'a garment tried on is not painted with the other garment’s dye');
 act(s,'outfit',{id:'harbor'});world.tryOn=null;assert.equal(playerWants(world).outfitColor.toLowerCase(),OUTFITS.find(o=>o.id==='harbor').color.toLowerCase(),'wearing it looks like the preview');
});
test('choosing a garment under a costume says so and settles the health; a costume blocks the dye',()=>{
 const s=freshState();s.coins=9999;s.gearOwned=['armor_knight'];s.gear={...s.gear,wear:'armor_knight'};s.hp=gearStats(s).maxHp;
 assert.ok(gearStats(s).maxHp>100);
 let r=act(s,'tint',{id:OUTFITS[2].color});assert.equal(r.ok,false);assert.match(r.message,/costume/i);assert.equal(s.tint,'');
 r=act(s,'outfit',{id:'meadow'});assert.ok(r.ok);assert.match(r.message,/taken off/i,'the toast names the costume that came off');assert.match(r.message,new RegExp(GEAR.armor_knight.name,'i'));
 assert.equal(s.gear.wear,'');assert.equal(s.hp,gearStats(s).maxHp,'health no longer above the new maximum');
 r=act(s,'outfit',{id:'rose'});assert.doesNotMatch(r.message,/taken off/i,'nothing to say when no costume was worn');
 assert.ok(act(s,'tint',{id:OUTFITS[2].color}).ok,'the dye works again once the costume is off');
});
test('the girl’s own flared hem does not show under a costume or a short garment that ends higher',async()=>{
 const low=(look,gear)=>{const a=buildAvatar({},{look,gear}),g=a.userData.parts.body.children[0].geometry;g.computeBoundingBox();return g.boundingBox.min.y;};
 const worn=[{wear:'armor_army'},{wear:'armor_navy'},{wear:'armor_hoodie'},{wear:'armor_wings'},{wear:'armor_tux'},{wear:'armor_aodai'},{garment:'garment_ivory'},{garment:'garment_meadow'},{garment:'garment_coral'}];
 for(const gear of worn)await preloadAvatar({},{look:'girl-tall-none-none',gear});
 await preloadAvatar({},{look:'boy-tall-none-none',gear:{wear:'armor_army'}});
 for(const gear of worn){const g=low('girl-tall-none-none',gear),b=low('boy-tall-none-none',gear);assert.ok(Math.abs(g-b)<.03,`${JSON.stringify(gear)}: the girl's body reaches ${g.toFixed(2)}, the boy's ${b.toFixed(2)}`);}
 const bare=low('girl-tall-none-none',{}),boy=low('boy-tall-none-none',{});assert.ok(bare<boy-.02,`with no clothes at all the girl keeps her flared hem (${bare.toFixed(3)} vs ${boy.toFixed(3)})`);
 const long=low('girl-tall-none-none',{garment:'garment_midnight'});assert.ok(long<=low('boy-tall-none-none',{garment:'garment_midnight'})+.03);
});
