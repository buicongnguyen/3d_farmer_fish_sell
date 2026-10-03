import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {freshState,act,parseSave} from '../src/game.mjs';
import {OUTFITS} from '../src/content.mjs';
import {BODIES,HEIGHTS,EARS,HOODS,ROWS,ROW_IDS,OPTIONS,PAID,DEFAULT_LOOK,DEFAULT_PIVOTS,FIT,isLook,toLook,splitLook,lookOf,lookName,lookPrice,missingOptions,ownsLook,swapOption,bodyFile,baseBody,fitOf,parseLook} from '../src/looks.mjs';
import {lookShopHtml} from '../src/mirror-view.mjs';
import {buildAvatar,buildPet,avatarAssets,preloadAvatar,useAvatarLoader,disposeAvatar,tintShirt,styleKey,playerWants} from '../src/avatar.mjs';

const file=name=>new URL(`../public/assets/${name}`,import.meta.url);

test('the builder has four rows, a portrait for every option and a model file for every body and height',()=>{
 assert.deepEqual(ROW_IDS,['body','height','ears','hood']);assert.equal(BODIES.length*HEIGHTS.length*EARS.length*HOODS.length,4*5*3*13);
 for(const row of ROW_IDS)for(const v of ROWS[row]){const o=OPTIONS[row][v];assert.ok(o?.name&&Number.isInteger(o.price)&&o.price>=0,`${row}:${v}`);assert.ok(existsSync(file(`icons/looks/${o.art}.webp`)),`${row}:${v} portrait`);}
 const files=new Set(BODIES.flatMap(b=>HEIGHTS.map(h=>bodyFile(b,h))));assert.equal(files.size,10);
 for(const f of files)assert.ok(existsSync(file(`models/${f}.glb`)),f);assert.ok(existsSync(file('models/hero-parts.glb')));
 assert.equal(bodyFile('boy','chibi'),'hero');assert.equal(bodyFile('slim','tall'),'hero-girl-tall');assert.equal(bodyFile('sturdy','grown'),'hero-grown');assert.equal(baseBody('sturdy'),'boy');
 // Bodies are free; Willowmere's own tall body is the free height; paid ids are unique across rows (looksOwned holds bare ids).
 for(const b of BODIES)assert.equal(OPTIONS.body[b].price,0);assert.equal(OPTIONS.height.tall.price,0);assert.equal(new Set(PAID).size,PAID.length);assert.equal(PAID.length,4+2+12);
 // Prices sit with the shirt colours (75–240 coins).
 const shirt=OUTFITS.filter(o=>o.price).map(o=>o.price);for(const id of PAID){const row=ROW_IDS.find(r=>ROWS[r].includes(id)&&OPTIONS[r][id].price),price=OPTIONS[row][id].price;assert.ok(price>=Math.min(...shirt)&&price<=125,`${id} ${price}`);}
});
test('look ids: the default, the old body field and the reference’s ids all map onto the builder',()=>{
 assert.equal(DEFAULT_LOOK,'girl-tall-none-none');assert.ok(isLook('slim-grown-bunny-owl'));assert.equal(isLook('girl-tall-none'),false);assert.equal(isLook('girl-huge-none-none'),false);
 assert.equal(toLook('boy'),'boy-tall-none-none');assert.equal(toLook('girl'),'girl-tall-none-none');assert.equal(toLook('boy-chibi-cat-bare'),'boy-chibi-cat-none');assert.equal(toLook('girl-teen-bunny'),'girl-teen-bunny-none');
 assert.equal(toLook('wolf'),undefined);assert.equal(toLook(7),undefined);
 assert.deepEqual(splitLook('sturdy-tiny-cat-fox'),{body:'sturdy',height:'tiny',ears:'cat',hood:'fox'});
 assert.equal(swapOption('girl-tall-none-none','hood','fox'),'girl-tall-none-fox');assert.equal(swapOption('girl-tall-none-none','hood','dragon'),'girl-tall-none-none');
 assert.equal(lookName('girl-tall-none-none'),'Girl · Tall');assert.equal(lookName('boy-grown-cat-owl'),'Boy · Grown-up · Cat ears · Owl hood');
 assert.equal(lookOf({body:'boy'}),'boy-tall-none-none');assert.equal(lookOf({}),DEFAULT_LOOK);
});
test('old saves migrate: the body field becomes a look, nothing is owned, and the body field stays in step',()=>{
 const fresh=freshState();assert.equal(fresh.look,DEFAULT_LOOK);assert.deepEqual(fresh.looksOwned,[]);
 for(const body of ['boy','girl']){const old=JSON.parse(JSON.stringify(freshState()));delete old.look;delete old.looksOwned;old.body=body;const s=parseSave(old);assert.equal(s.look,`${body}-tall-none-none`);assert.equal(s.body,body);assert.deepEqual(s.looksOwned,[]);}
 // A look made of options the save does not own falls back to the body; unknown owned ids are dropped.
 const cheat=parseSave({...JSON.parse(JSON.stringify(freshState())),body:'boy',look:'girl-grown-cat-fox',looksOwned:['fox','fox','tall','unicorn',3]});
 assert.equal(cheat.look,'boy-tall-none-none');assert.deepEqual(cheat.looksOwned,['fox']);
 assert.deepEqual(parseLook({look:'slim-tall-none-fox',looksOwned:['fox']}),{look:'slim-tall-none-fox',looksOwned:['fox'],body:'girl'});
 assert.deepEqual(parseLook(null),{look:DEFAULT_LOOK,looksOwned:[],body:'girl'});
});
test('a look is bought once per option, combines freely afterwards, and costs nothing to wear',()=>{
 const s=freshState();s.coins=300;
 assert.equal(lookPrice(s,'girl-chibi-cat-fox'),75+110+90);assert.deepEqual(missingOptions(s,'girl-chibi-cat-fox').map(o=>o[1]),['chibi','cat','fox']);
 assert.equal(act(s,'look',{id:'girl-grown-cat-tiger'}).ok,false);assert.equal(s.coins,300);assert.equal(s.look,DEFAULT_LOOK);
 assert.ok(act(s,'look',{id:'girl-chibi-cat-fox'}).ok);assert.equal(s.coins,25);assert.deepEqual(s.looksOwned,['chibi','cat','fox']);assert.equal(s.look,'girl-chibi-cat-fox');
 assert.equal(act(s,'look',{id:'girl-chibi-cat-fox'}).ok,false,'already wearing it');
 // Free bodies and owned options combine at no cost, with an empty purse too.
 s.coins=0;assert.ok(act(s,'look',{id:'sturdy-tall-none-fox'}).ok);assert.equal(s.look,'sturdy-tall-none-fox');assert.equal(s.body,'boy');assert.equal(s.coins,0);
 assert.ok(ownsLook(s,'boy-chibi-cat-none'));assert.equal(ownsLook(s,'boy-teen-cat-none'),false);assert.equal(act(s,'look',{id:'boy-teen-none-none'}).ok,false);
 assert.equal(act(s,'look',{id:'nonsense'}).ok,false);
 // The atelier's old two-way picker keeps working and keeps the rest of the look.
 assert.ok(act(s,'body',{id:'girl'}).ok);assert.equal(s.look,'girl-tall-none-fox');assert.equal(s.body,'girl');assert.equal(act(s,'body',{id:'robot'}).ok,false);
 const copy=parseSave(JSON.parse(JSON.stringify(s)));assert.equal(copy.look,'girl-tall-none-fox');assert.deepEqual(copy.looksOwned,['chibi','cat','fox']);
});
test('gear fit: the chibi needs none, taller looks scale and move each part, builds widen',()=>{
 assert.deepEqual(FIT.chibi,{});assert.deepEqual(fitOf('boy-chibi-none-none'),{});
 assert.deepEqual(fitOf('girl-tall-none-none').head,{scale:[.76,.76,.76],offset:[0,0,0]});assert.deepEqual(fitOf('girl-tall-none-none')['leg-left'].offset,[0,-.46,0]);
 const wide=fitOf('sturdy-tall-none-none');assert.ok(Math.abs(wide.body.scale[0]-.8*1.2)<1e-9);assert.equal(wide.body.scale[1],1.2);assert.deepEqual(wide.head,FIT.tall.head);
 assert.ok(fitOf('slim-chibi-none-none').body.scale[0]<1);
 for(const part of ['body','head','arm-left','arm-right','leg-left','leg-right','hand-right'])assert.equal(DEFAULT_PIVOTS[part].length,3);
});
test('the mirror panel shows every option, marks the worn and the chosen ones, and offers the right button',()=>{
 const s=freshState();s.coins=100;
 let html=lookShopHtml(s,s.look);for(const row of ROW_IDS)for(const v of ROWS[row])assert.ok(html.includes(`data-look-option="${row}:${v}"`),`${row}:${v}`);
 assert.match(html,/✓ Wearing/);assert.doesNotMatch(html,/data-look-action/);assert.match(html,/data-mirror-slot="mirror"/);
 html=lookShopHtml(s,'girl-tall-none-fox');assert.match(html,/data-look-action="buy">Buy .*<b>90<\/b>/);assert.match(html,/data-look-action="reset"/);assert.match(html,/class="look-chip on" data-look-option="hood:fox"/);
 assert.match(lookShopHtml(s,'girl-grown-cat-tiger'),/price-btn cant-afford" data-look-action="buy"/);
 s.looksOwned=['fox'];assert.match(lookShopHtml(s,'boy-tall-none-fox'),/data-look-action="wear">Wear</);
});

// ---------------------------------------------------------------- the avatar, built from the real files
const loader=async name=>{const b=await readFile(file(`models/${name}.glb`));return await new Promise((ok,no)=>new GLTFLoader().parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'',g=>ok(g.scene),no));};
const meshes=a=>{const list=[];a.traverse(o=>{if(o.isMesh)list.push(o);});return list;};
const height=a=>new T.Box3().setFromObject(a).max.y;
test('an avatar is six meshes with named, posable parts; gear merges into them; files load on demand',async()=>{
 useAvatarLoader(loader);const world={};
 const blank=buildAvatar(world,{look:'girl-tall-none-none'});assert.equal(blank.userData.pending,true);assert.equal(meshes(blank).length,0);
 for(const k of ['head','body','arm_l','arm_r','leg_l','leg_r','hand_l','hand_r'])assert.ok(blank.userData.parts[k]?.isObject3D,k);
 assert.ok(avatarAssets(world,{look:'girl-tall-none-none'}) instanceof Promise);await preloadAvatar(world,{look:'girl-tall-none-none'});assert.equal(avatarAssets(world,{look:'girl-tall-none-none'}),null);
 const a=buildAvatar(world,{look:'girl-tall-none-none',outfitColor:'#ff0000'});
 assert.equal(a.userData.pending,false);assert.equal(meshes(a).length,6);assert.equal(new Set(meshes(a).map(m=>m.material)).size,1);
 assert.deepEqual(a.userData.limbs.map(l=>l.name),['arm-left','arm-right','leg-left','leg-right']);assert.equal(a.getObjectByName('hand-right').parent,a.userData.parts.arm_r);
 assert.equal(JSON.stringify(a.userData).includes('parts'),false,'userData stays cheap to clone');
 // The shirt takes the outfit colour and can be recoloured in place.
 const body=a.userData.parts.body.children[0],shirt=body.userData.shirt,colors=body.geometry.getAttribute('color'),i=shirt.findIndex(v=>v===1);
 assert.ok(i>=0);assert.ok(Math.abs(colors.getX(i)-1)<1e-6&&colors.getY(i)<1e-6);tintShirt(a,'#00ff00');assert.ok(colors.getX(i)<1e-6&&Math.abs(colors.getY(i)-1)<1e-6);
 // A look whose files have not arrived uses the nearest loaded body, then the real one.
 const want={look:'boy-chibi-cat-fox',gear:{hat:'',wear:'armor_knight',boots:'boots_rocket',weapon:'gun_pea',pet:'pet_dragon'}};
 const early=buildAvatar(world,want);assert.equal(early.userData.pending,true);assert.equal(early.userData.lookId,'girl-tall-none-none');assert.equal(early.getObjectByName('weapon'),undefined);
 await preloadAvatar(world,want);assert.equal(avatarAssets(world,want),null);
 const b=buildAvatar(world,want);assert.equal(b.userData.pending,false);assert.equal(b.userData.lookId,'boy-chibi-cat-fox');
 // Six body parts (the outfit and boots merged in), the boots' glow on each leg, a weapon with its muzzle, a pet with wings.
 const own=meshes(b).filter(m=>!m.parent.name.startsWith('pet')&&m.parent.name!=='weapon'&&m.parent.parent?.name!=='pet');
 assert.equal(own.filter(m=>m.material.name==='Avatar').length,6);assert.equal(own.filter(m=>m.material.name==='Avatar glow').length,2);
 assert.ok(b.getObjectByName('weapon').getObjectByName('muzzle'));assert.equal(b.getObjectByName('weapon').parent.name,'hand-right');assert.equal(b.getObjectByName('pet').userData.wings.length,2);
 assert.ok(height(b)<height(a),'the chibi is shorter than the tall body');
 // A hat covers the hood: the head goes back to its bare geometry plus the hat.
 const bare=buildAvatar(world,{look:'boy-chibi-none-none'}),hood=buildAvatar(world,{look:'boy-chibi-none-fox'}),hat=buildAvatar(world,{look:'boy-chibi-none-fox',gear:{hat:'hat_straw'}});
 const tris=x=>x.userData.parts.head.children[0].geometry.getAttribute('position').count/3;
 assert.ok(tris(hood)>tris(bare));await preloadAvatar(world,{gear:{hat:'hat_straw'}});const hatted=buildAvatar(world,{look:'boy-chibi-none-fox',gear:{hat:'hat_straw'}}),plain=buildAvatar(world,{look:'boy-chibi-none-none',gear:{hat:'hat_straw'}});
 assert.equal(tris(hatted),tris(plain));assert.ok(tris(hatted)>tris(bare));assert.equal(hat.userData.pending,false);
 // Every height stands on the floor and grows from tiny to grown-up; a sturdy build is wider than a slim one.
 let last=0;for(const h of HEIGHTS){await preloadAvatar(world,{look:`girl-${h}-none-none`});const x=buildAvatar(world,{look:`girl-${h}-none-none`}),box=new T.Box3().setFromObject(x);assert.ok(Math.abs(box.min.y)<.05,`${h} stands on the floor`);assert.ok(box.max.y>last,`${h} is taller`);last=box.max.y;}
 const w=x=>{const box=new T.Box3().setFromObject(x.userData.parts.body);return box.max.x-box.min.x;};assert.ok(w(buildAvatar(world,{look:'sturdy-tall-none-none'}))>w(buildAvatar(world,{look:'slim-tall-none-none'})));
 // Every piece of gear fits on every height without leaving the body far behind.
 for(const h of ['tiny','grown']){const x=buildAvatar(world,{look:`girl-${h}-none-none`,gear:{hat:'hat_wizard',wear:'armor_angel',boots:'boots_cloud'}}),plainH=height(buildAvatar(world,{look:`girl-${h}-none-none`}));assert.ok(height(x)>plainH&&height(x)<plainH+1.3,`${h} hat sits on the head`);assert.ok(new T.Box3().setFromObject(x).min.y>-.3,`${h} boots stay at the feet`);}
 assert.equal(buildPet(world,'hat_straw'),null);assert.equal(meshes(buildPet(world,'bunny')).length,1);
 disposeAvatar(a);disposeAvatar(b);
 assert.equal(styleKey(playerWants({state:freshState()})),`${DEFAULT_LOOK}|${OUTFITS[0].color}|,,,,`);
});
