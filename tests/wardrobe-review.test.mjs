// Review fixes of the wardrobe and the villagers, each one a test that fails on the code it was found in:
// the party skirt is not a plate; the seven village garments are seven cuts; Pip's default is a real garment; every
// adventure outfit is a visible change, no costume pair makes twins, and no villager's outfit needs the disguise file;
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
import {playerWants} from '../src/avatar.mjs';
import {garmentOf} from '../src/garments.mjs';

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
test('Pip wears the sunny pinafore until something else is bought, and has an adventure change of her own',()=>{
 const pip=RESIDENTS.find(p=>p.id==='pip'),day=outfitOf(pip,false,freshState()),wild=outfitOf(pip,true,freshState());
 assert.equal(day.gear.garment,'kid_sunny');assert.ok(day.gear.garment&&day.gear.hat,'a garment and a hat, not a bare tunic');
 assert.ok(wild.gear.hat!==day.gear.hat&&wild.gear.boots!==day.gear.boots,'a different hat and boots for the wilds');assert.equal(wild.gear.garment,day.gear.garment,'her pinafore stays in view');
});
test('every adventure outfit reads as a clear change: a costume the everyday outfit lacked and a hat or boots that move too',()=>{
 for(const p of RESIDENTS){if(p.id==='pip')continue;const d=outfitOf(p,false,freshState()).gear,w=outfitOf(p,true,freshState()).gear;
  assert.ok(w.wear&&!d.wear,`${p.id} gains a costume`);assert.ok(w.hat!==d.hat||w.boots!==d.boots,`${p.id}: the hat or the boots change too (${d.hat}->${w.hat}, ${d.boots}->${w.boots})`);}
 const h=outfitOf(RESIDENTS.find(p=>p.id==='hazel'),true,freshState()).gear;assert.ok(h.wear!=='armor_angel'||h.hat!=='hat_halo');
 const hugo=outfitOf(RESIDENTS.find(p=>p.id==='hugo'),true,freshState()).gear;assert.notEqual(hugo.hat,'hat_chef','Hugo takes the chef hat off for the wilds');
 const cora=outfitOf(RESIDENTS.find(p=>p.id==='cora'),true,freshState()).gear;assert.notEqual(cora.hat,'hat_graduate');
});
test('no two villagers wear one costume unless the body and the colour tell them apart; Faye, Sylvie, Hazel and Kit have costumes of their own',()=>{
 const by=new Map();
 for(const p of RESIDENTS){const w=outfitOf(p,true,freshState());if(!w.gear.wear)continue;if(!by.has(w.gear.wear))by.set(w.gear.wear,[]);by.get(w.gear.wear).push({id:p.id,body:splitLook(w.look).body,colour:w.outfitColor});}
 for(const [wear,list] of by)for(const a of list)for(const b of list){if(a.id>=b.id)continue;assert.ok(a.body!==b.body&&a.colour!==b.colour,`${a.id} and ${b.id} both wear ${wear} on ${a.body}`);}
 const own=id=>outfitOf(RESIDENTS.find(p=>p.id===id),true,freshState()).gear.wear;
 assert.notEqual(own('faye'),own('hazel'));assert.notEqual(own('sylvie'),own('mara'));
 for(const i of ['faye','sylvie','hazel','kit'])assert.equal(by.get(own(i)).length,1,`${i} has a costume nobody else wears`);
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
