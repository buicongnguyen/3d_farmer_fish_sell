import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {freshState,act,parseSave} from '../src/game.mjs';
import {GEAR,GEAR_SLOTS,FIST,BASE_STATS,gearStats,weaponOf,gearOf,grantGear,previewGear,kitOf,gearGroups,gearScore,groupOf,powerLabel,GROUP_ORDER,emptyGear} from '../src/gear.mjs';
import {wardrobeHtml,gearShopHtml,statStripHtml} from '../src/wardrobe-view.mjs';

const glbNames=file=>{const b=readFileSync(new URL(`../public/assets/models/${file}.glb`,import.meta.url)),j=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString('utf8'));return new Set(j.scenes[j.scene??0].nodes.map(i=>j.nodes[i].name));};
const rich=()=>{const s=freshState();s.coins=100000;return s;};

test('every piece of gear has a slot, a price in coins, an icon file and a model in its kit file',()=>{
 const kits={};
 for(const [id,g] of Object.entries(GEAR)){
  assert.equal(g.id,id);assert.ok(GEAR_SLOTS.includes(g.slot),id);assert.ok(Number.isInteger(g.price)&&g.price>=20&&g.price%5===0,`${id} price ${g.price}`);
  assert.ok(existsSync(new URL(`../public/assets/icons/${g.icon}.webp`,import.meta.url)),`${id} icon`);
  const file=kitOf(id);assert.ok(file,id);kits[file]??=glbNames(file);assert.ok(kits[file].has(id),`${id} is a model in ${file}.glb`);
  if(g.slot==='weapon'){assert.ok(['sword','gun'].includes(g.kind),id);assert.ok(g.range>0&&g.cooldown>0&&g.atk>0,id);}
  if(g.slot==='pet')assert.ok(g.pet?.dmg>0&&g.pet.cd>0,id);
 }
 assert.deepEqual(Object.keys(kits).sort(),['gear-weapons','gear-wear','pets']);
 for(const slot of GEAR_SLOTS)assert.ok(Object.values(GEAR).some(g=>g.slot===slot),slot);
 assert.equal(Object.keys(GEAR).length,65);
});
test('a fresh save wears nothing and has the base numbers: 100 health, 10 attack, bare hands',()=>{
 const s=freshState();assert.deepEqual(s.gear,{hat:'',wear:'',boots:'',weapon:'',pet:''});assert.deepEqual(s.gearOwned,[]);
 assert.deepEqual(gearStats(s),{maxHp:100,attack:10,defense:0,crit:.05,speed:1,regen:0});assert.deepEqual(gearStats({}),{...BASE_STATS});
 assert.equal(weaponOf(s),FIST);assert.equal(weaponOf(s).kind,'fist');assert.equal(weaponOf({}).range,1);
});
test('worn gear adds up; a slot holds one piece; speed never drops below a crawl and crit is capped',()=>{
 const s=rich();for(const id of ['hat_viking','armor_knight','boots_rocket','sword_lava','pet_sheep'])assert.ok(act(s,'buyGear',{id}).ok,id);
 assert.deepEqual(s.gear,{hat:'hat_viking',wear:'armor_knight',boots:'boots_rocket',weapon:'sword_lava',pet:'pet_sheep'});
 const st=gearStats(s);assert.equal(st.maxHp,100+40+90+40);assert.equal(st.attack,10+4+38);assert.equal(st.defense,14+28+4);
 assert.ok(Math.abs(st.speed-(1-.05+.25))<1e-9);assert.ok(Math.abs(st.crit-(.05+.12))<1e-9);
 assert.equal(weaponOf(s).id,'sword_lava');assert.equal(weaponOf(s).kind,'sword');assert.equal(weaponOf(s).cooldown,.5);
 assert.ok(act(s,'buyGear',{id:'crown'}).ok);assert.equal(s.gear.hat,'crown');assert.equal(gearStats(s).attack,10+10+38);
 assert.equal(gearStats({gear:{wear:'armor_knight',boots:'armor_knight'}}).defense,28,'a piece only counts in its own slot');
 assert.equal(gearStats({gear:{hat:'nothing'}}).maxHp,100);
});
test('buying costs coins once, never without enough, and wearing owned gear is free',()=>{
 const s=freshState();s.coins=100;
 assert.equal(act(s,'buyGear',{id:'crown'}).ok,false);assert.equal(s.coins,100);assert.deepEqual(s.gearOwned,[]);
 assert.ok(act(s,'buyGear',{id:'hat_straw'}).ok);assert.equal(s.coins,80);assert.equal(s.gear.hat,'hat_straw');
 assert.equal(act(s,'buyGear',{id:'hat_straw'}).ok,false);assert.equal(s.coins,80);
 assert.equal(act(s,'buyGear',{id:'imaginary'}).ok,false);assert.equal(act(s,'equip',{id:'crown'}).ok,false);
 assert.ok(act(s,'buyGear',{id:'hat_party'}).ok);assert.equal(s.gear.hat,'hat_party');s.coins=0;
 assert.ok(act(s,'equip',{id:'hat_straw'}).ok);assert.equal(s.gear.hat,'hat_straw');assert.equal(act(s,'equip',{id:'hat_straw'}).ok,false);
 assert.ok(act(s,'unequip',{slot:'hat'}).ok);assert.equal(s.gear.hat,'');assert.equal(act(s,'unequip',{slot:'hat'}).ok,false);assert.equal(act(s,'unequip',{slot:'tail'}).ok,false);
 assert.deepEqual(s.gearOwned,['hat_straw','hat_party']);
 assert.ok(grantGear(s,'crown'));assert.equal(grantGear(s,'crown'),false);assert.equal(grantGear(s,'nope'),false);assert.ok(act(s,'equip',{id:'crown'}).ok);
});
test('gear survives a save and impossible gear is dropped on load',()=>{
 const s=rich();act(s,'buyGear',{id:'hat_frog'});act(s,'buyGear',{id:'pet_dragon'});act(s,'buyGear',{id:'gun_pea'});
 const copy=parseSave(JSON.parse(JSON.stringify(s)));assert.deepEqual(copy.gear,s.gear);assert.deepEqual(copy.gearOwned,s.gearOwned);
 const bad=parseSave({...JSON.parse(JSON.stringify(s)),gear:{hat:'crown',wear:'hat_frog',boots:7,weapon:'gun_pea',pet:'pet_dragon',extra:'x'},gearOwned:['hat_frog','hat_frog','ghost',5,'gun_pea','pet_dragon']});
 assert.deepEqual(bad.gearOwned,['hat_frog','gun_pea','pet_dragon']);assert.deepEqual(bad.gear,{hat:'',wear:'',boots:'',weapon:'gun_pea',pet:'pet_dragon'});
 const old=JSON.parse(JSON.stringify(freshState()));delete old.gear;delete old.gearOwned;delete old.look;delete old.looksOwned;delete old.house;delete old.found;
 const migrated=parseSave(old);assert.deepEqual(migrated.gear,emptyGear());assert.deepEqual(migrated.gearOwned,[]);assert.deepEqual(gearOf({}),emptyGear());
});
test('trying on swaps one slot in a copy and never touches the save',()=>{
 const s=rich();act(s,'buyGear',{id:'hat_straw'});const before=JSON.stringify(s.gear),tried=previewGear(s.gear,'armor_angel');
 assert.equal(tried.wear,'armor_angel');assert.equal(tried.hat,'hat_straw');assert.equal(JSON.stringify(s.gear),before);
 assert.deepEqual(previewGear(s.gear,'nope'),gearOf(s));
});
test('groups come in dressing order and run from the weakest to the strongest',()=>{
 const groups=gearGroups(Object.keys(GEAR));assert.deepEqual(groups.map(g=>g.id),GROUP_ORDER);
 for(const g of groups){assert.ok(g.label&&g.icon);for(let i=1;i<g.ids.length;i++)assert.ok(gearScore(g.ids[i-1])<=gearScore(g.ids[i]),`${g.id}: ${g.ids[i-1]} before ${g.ids[i]}`);for(const id of g.ids)assert.equal(groupOf(id),g.id);}
 assert.equal(groups.reduce((n,g)=>n+g.ids.length,0),Object.keys(GEAR).length);
 assert.equal(gearGroups(['sword_lava','hat_straw','sword_wood','gun_pea','ghost']).map(g=>g.id+':'+g.ids.join(',')).join(' '),'hat:hat_straw sword:sword_wood,sword_lava ranged:gun_pea');
 assert.equal(powerLabel('sword_wood'),'⚔️ 10.9/s');assert.equal(powerLabel('hat_straw'),'🛡️ 3 · ❤️ 10');assert.match(powerLabel('pet_dragon'),/^🐾 \d+ · ⚔️ 4$/);
 assert.ok(gearScore('gun_spike')>gearScore('gun_bubble'),'a spread gun counts its pellets');
});
test('the wardrobe lists owned gear in labelled groups with Wear, Try on and Take off; the atelier lists everything with prices',()=>{
 const s=rich();for(const id of ['hat_wizard','hat_straw','armor_leather','sword_wood','bunny'])act(s,'buyGear',{id});act(s,'equip',{id:'hat_straw'});
 const html=wardrobeHtml(s,{tryId:'hat_wizard'});
 assert.match(html,/🎨 Shirt colours · 1/);assert.match(html,/🎩 Hats · 2/);assert.match(html,/👕 Outfits · 1/);assert.match(html,/⚔️ Melee weapons · 1/);assert.match(html,/🐾 Pets · 1/);assert.doesNotMatch(html,/Boots ·/);
 assert.ok(html.indexOf('data-gear="hat_straw"')<html.indexOf('data-gear="hat_wizard"'),'weakest first');
 assert.match(html,/data-gear-action="unequip" data-slot="hat"/);assert.match(html,/data-action="do" data-type="equip" data-id="hat_wizard"/);
 assert.match(html,/data-gear-try="hat_wizard" aria-pressed="true"/);assert.match(html,/Trying on <b>Wizard hat<\/b>/);
 assert.match(html,/data-mirror-slot="wardrobe"/);assert.equal((html.match(/class="wd-slot worn"/g)??[]).length,4);assert.equal((html.match(/class="wd-slot empty"/g)??[]).length,1);
 // The numbers shown are those of what is being tried on: the wizard hat instead of the straw one.
 assert.ok(html.includes(statStripHtml(gearStats({gear:previewGear(s.gear,'hat_wizard')}))));
 assert.match(wardrobeHtml(freshState()),/Finch atelier/);
 const shop=gearShopHtml(s);for(const id of Object.keys(GEAR))assert.ok(shop.includes(`data-gear="${id}"`),id);
 assert.match(shop,/data-action="do" data-type="buyGear" data-id="crown"/);assert.match(shop,/data-action="do" data-type="equip" data-id="hat_wizard"/);assert.doesNotMatch(shop,/data-type="buyGear" data-id="hat_wizard"/);
 const poor=freshState();poor.coins=30;assert.match(gearShopHtml(poor),/price-btn cant-afford" data-action="do" data-type="buyGear" data-id="crown"/);assert.doesNotMatch(gearShopHtml(poor),/cant-afford" data-action="do" data-type="buyGear" data-id="hat_straw"/);
 assert.match(gearShopHtml(s,{folded:new Set(['shop:hat'])}),/class="item-group folded" data-group="hat"/);
});
