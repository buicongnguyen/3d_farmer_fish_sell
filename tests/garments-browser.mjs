// The village clothes in a real browser: every garment (the 13 of the Finch atelier), Pip's four and the costumes are worn for
// every body build at 1440x900 and 390x844, and the picture is measured, not eyeballed. The mirror's own canvas has an alpha
// channel, so the silhouette of each look in a garment is compared with the same look in no clothes: a garment must change
// it (a recolour changes none), unless the entry is a Colour swatch, which must change the colour and nothing else. Then the
// screens (wardrobe, mirror, atelier, Pip's tab, her family screen) are driven with real clicks.
// Contact sheets and screenshots go to the evidence folder; look at them.
//   GAME_URL=http://127.0.0.1:<port> GPU=1 node tests/garments-browser.mjs
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {freshState,SAVE_KEY} from '../src/game.mjs';
import {GEAR} from '../src/gear.mjs';
import {OUTFITS,KID_OUTFITS} from '../src/content.mjs';
import {BODIES,HEIGHTS} from '../src/looks.mjs';
const OUT=process.env.EVIDENCE??'C:/Users/n/source/repos/cute_game-notes/willowmere/evidence-wardrobe/after';await mkdir(OUT,{recursive:true});await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({channel:process.env.CI?undefined:'chrome',headless:true,args:process.env.GPU?['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']:['--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const base=process.env.GAME_URL??'http://127.0.0.1:4173',errors=[],results=[],rows=[],fails=[];
const check=(ok,message)=>{if(!ok)fails.push(message);}; // the measurements are all taken, then judged together
const seed=()=>Object.assign(freshState(),{started:true,coins:99999,energy:80,position:{x:0,z:-8.8},upgrades:{farm:1,pond:1,pen:1,house:3,kitchen:3},furniture:['rug','sofa','plants','books','dining','art'],owned:OUTFITS.map(o=>o.id),kidOwned:KID_OUTFITS.map(o=>o.id),gearOwned:Object.keys(GEAR),settings:{...freshState().settings,test:true}});
async function setup(view,mobile){
 const context=await browser.newContext({viewport:view,isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1});
 await context.addInitScript(({key,seed})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(seed));},{key:SAVE_KEY,seed:seed()});
 const page=await context.newPage();
 page.on('console',m=>{if(m.type()==='error'&&!/favicon/.test(m.text()))errors.push(`console ${m.text()}`);});page.on('pageerror',e=>errors.push(`pageerror ${e.message}`));
 await page.goto(base);await page.waitForFunction(()=>window.willowmere?.metrics().ready,null,{timeout:120000});await page.locator('#begin').click();await page.waitForTimeout(400);
 return {page,context};
}
const snapshot=p=>p.evaluate(()=>willowmere.snapshot());
const enter=async p=>{await p.keyboard.press('e');await p.waitForFunction(()=>willowmere.metrics().location==='interior',null,{timeout:30000});await p.waitForTimeout(600);};
const closePanel=p=>p.getByRole('button',{name:'Close panel',exact:true}).click();
// ---- in-page helpers: the glass's pixels, compared in the page (the alpha channel is the silhouette)
const install=p=>p.evaluate(()=>{
 const glass=sel=>document.querySelector(sel+' canvas'),read=sel=>{const c=glass(sel);if(!c)return null;const d=c.getContext('2d').getImageData(0,0,c.width,c.height);return {w:c.width,h:c.height,data:d.data};};
 window.__t={read,base:null,shots:{},
  setBase(sel){this.base=read(sel);},
  diff(sel){const a=this.base,b=read(sel);if(!a||!b||a.w!==b.w||a.h!==b.h)return {sil:-1,col:-1,area:0};let sil=0,col=0,area=0;for(let i=0;i<a.data.length;i+=4){const A=a.data[i+3]>128,B=b.data[i+3]>128;if(B)area++;if(A!==B)sil++;else if(A&&Math.abs(a.data[i]-b.data[i])+Math.abs(a.data[i+1]-b.data[i+1])+Math.abs(a.data[i+2]-b.data[i+2])>24)col++;}return {sil,col,area,w:b.w,h:b.h};},
  keep(name,sel){const c=glass(sel);if(c)this.shots[name]=c.toDataURL('image/png');},
  async sheet(names,cols,cell,title){const imgs=await Promise.all(names.map(n=>new Promise(ok=>{const i=new Image();i.onload=()=>ok(i);i.onerror=()=>ok(null);i.src=this.shots[n];})));const rows=Math.ceil(names.length/cols),w=Math.max(...imgs.filter(Boolean).map(i=>i.width),1),h=Math.max(...imgs.filter(Boolean).map(i=>i.height),1),s=Math.min(1,cell/h),cw=Math.round(w*s)+8,ch=Math.round(h*s)+18,c=document.createElement('canvas');c.width=cols*cw;c.height=rows*ch+18;const g=c.getContext('2d');g.fillStyle='#dff0d4';g.fillRect(0,0,c.width,c.height);g.fillStyle='#223';g.font='12px sans-serif';g.fillText(title,4,13);names.forEach((n,i)=>{const x=(i%cols)*cw+4,y=Math.floor(i/cols)*ch+18;if(imgs[i])g.drawImage(imgs[i],x,y,Math.round(w*s),Math.round(h*s));g.fillStyle='#223';g.font='10px sans-serif';g.fillText(n.slice(0,22),x,y+Math.round(h*s)+11);});return c.toDataURL('image/png');}};
});
const NONE={garment:'',hat:'',wear:'',boots:'',weapon:'',pet:''};
/** Dress the character, open the wardrobe's mirror and wait until its picture has settled (the files load on demand). */
async function dress(p,wants,panel='wardrobe',arg){
 const before=await p.evaluate(()=>willowmere.mirror().renders);
 await p.evaluate(({w,panel,arg})=>{willowmere.test.tryOn(w);willowmere.test.open(panel,arg);},{w:wants,panel,arg});
 let last=-1,still=0;const t0=Date.now(); // settled: nothing drew for three looks in a row, and something did (or a second has passed: the same picture is not drawn twice)
 while(Date.now()-t0<20000){const n=await p.evaluate(()=>willowmere.mirror().renders);if((n>before||Date.now()-t0>1300)&&n===last){if(++still>=6)break;}else still=0;last=n;await p.waitForTimeout(120);}
}
const save=async(name,url)=>writeFile(`${OUT}/${name}`,Buffer.from(url.split(',')[1],'base64'));
const PART=process.env.PART??'all';
const SIL=a=>Math.max(6,Math.round(a*.004)); // a garment must move at least 0.4% of the figure's pixels (a recolour moves 0)
try{
 for(const [tag,view,mobile] of PART==='screens'?[]:[['d1440',{width:1440,height:900},false],['m390',{width:390,height:844},true]]){ // PART=screens skips the measurements
  const {page:p,context}=await setup(view,mobile);await enter(p);await install(p);
  const GL='.mirror-glass[data-mirror-slot="wardrobe"]';
  const looksOf=[];for(const body of BODIES)for(const h of HEIGHTS)looksOf.push(`${body}-${h}-none-none`);
  looksOf.push('girl-tall-cat-none','boy-tall-bunny-none','girl-tall-none-fox','boy-chibi-none-owl','sturdy-tall-cat-bear','slim-teen-bunny-none'); // over ears, tails and hoods
  let n=0;
  await dress(p,{gear:{...NONE,garment:'garment_rose'}});await p.waitForTimeout(2500); // the two garment files bake the first time they are asked for
  for(const look of looksOf){
   // ---- every look wears every garment: the silhouette against the same look in no clothes
   await dress(p,{look,gear:NONE});await p.evaluate(g=>{__t.setBase(g);__t.keep('bare',g);},GL);
   const names=['bare'];
   for(const o of OUTFITS){
    await dress(p,{look,gear:{...NONE,garment:'garment_'+o.id}});
    const d=await p.evaluate(g=>({...__t.diff(g)}),GL);await p.evaluate(({g,k})=>__t.keep(k,g),{g:GL,k:o.id});names.push(o.id);
    rows.push({vp:tag,look,kind:'garment',id:o.id,...d});n++;
    check(d.sil>=SIL(d.area),`${tag} ${look} ${o.id}: the silhouette moved ${d.sil} px of ${d.area} (a recolour moves none)`);
   }
   // ---- the Colour row: a dye changes the colour and not the silhouette
   await dress(p,{look,gear:{...NONE,garment:'garment_rose'}});await p.evaluate(g=>__t.setBase(g),GL);
   await dress(p,{look,gear:{...NONE,garment:'garment_rose'},outfitColor:OUTFITS[6].color});
   const dye=await p.evaluate(g=>({...__t.diff(g)}),GL);rows.push({vp:tag,look,kind:'dye',id:'rose->sage',...dye});
   check(dye.sil<=2&&dye.col>=Math.round(dye.area*.1),`${tag} ${look}: a dye changes colour (${dye.col}) not silhouette (${dye.sil})`);
   // ---- costumes (the Zoo Garden pieces and two older ones) cover the garment
   for(const id of ['armor_army','armor_navy','armor_aodai','armor_aodai_man','armor_usa','armor_vietnam','armor_knight','armor_hoodie'])if(['girl-tall-none-none','boy-grown-none-none','girl-tiny-none-none'].includes(look)||id==='armor_aodai'){
    await dress(p,{look,gear:NONE});await p.evaluate(g=>__t.setBase(g),GL);
    await dress(p,{look,gear:{...NONE,garment:'garment_rose',wear:id}});
    const c=await p.evaluate(g=>({...__t.diff(g)}),GL);rows.push({vp:tag,look,kind:'costume',id,...c});await p.evaluate(({g,k})=>__t.keep(k,g),{g:GL,k:id});names.push(id);
    check(c.sil+c.col>=Math.round(c.area*.03),`${tag} ${look} ${id}: a costume changes the picture (${c.sil}+${c.col} of ${c.area})`);
   }
   // ---- gear over a garment: hat, boots and a held weapon with trousers, a coat and a dress
   for(const garment of ['honey','midnight','festival'])if(['girl-tall-none-none','boy-grown-none-none','girl-tiny-none-none'].includes(look)){
    await dress(p,{look,gear:{...NONE,garment:'garment_'+garment}});await p.evaluate(g=>__t.setBase(g),GL);
    await dress(p,{look,gear:{...NONE,garment:'garment_'+garment,hat:'hat_wizard',boots:'boots_cowboy',weapon:'sword_wood'}});
    const c=await p.evaluate(g=>({...__t.diff(g)}),GL);rows.push({vp:tag,look,kind:'gear-over',id:garment+'+hat,boots,sword',...c});await p.evaluate(({g,k})=>__t.keep(k,g),{g:GL,k:garment+'+gear'});names.push(garment+'+gear');
    check(c.sil>=SIL(c.area),`${tag} ${look}: a hat, boots and a sword over the ${garment}`);
   }
   await p.evaluate(({cols,names,title})=>__t.sheet(names,cols,names.length>14?150:190,title),{cols:Math.min(8,names.length),names,title:`${tag} ${look}`}).then(url=>save(`sheet-${tag}-${look}.png`,url));
  }
  await writeFile(`${OUT}/measurements.json`,JSON.stringify(rows,null,1));
  results.push({name:`${tag}: ${n} garment renders over ${looksOf.length} looks, silhouettes moved, dyes only recolour`});
  // ---- Pip: the atelier's kids tab draws her in each outfit (the picture has an alpha channel too)
  await p.evaluate(()=>willowmere.test.tryOn(null));
  await p.evaluate(()=>willowmere.test.open('shop','clothes'));await p.waitForTimeout(500);await p.locator('[data-action="tab"][data-id="kids"]').click();await p.waitForSelector('.kids-stage .mirror-glass canvas',{timeout:30000});
  const settle=async()=>{let last=-1,still=0;const t0=Date.now();while(Date.now()-t0<20000){const r=await p.evaluate(()=>document.querySelector('.kids-stage canvas')?.toDataURL().length??0);if(r===last){if(++still>=4)break;}else still=0;last=r;await p.waitForTimeout(150);}};
  await settle();await p.evaluate(()=>{__t.setBase('.kids-stage .mirror-glass');__t.keep('Pip bare','.kids-stage .mirror-glass');});const kn=['Pip bare'];
  for(const k of KID_OUTFITS){
   await p.locator(`[data-shop-try="${k.id}"]`).click();await settle();
   const d=await p.evaluate(()=>({...__t.diff('.kids-stage .mirror-glass')}));await p.evaluate(k=>__t.keep(k,'.kids-stage .mirror-glass'),k.id);kn.push(k.id);rows.push({vp:tag,look:'pip',kind:'kid',id:k.id,...d});
   check(d.sil>=SIL(d.area),`${tag} Pip in ${k.id}: the silhouette moved ${d.sil} px of ${d.area}`);
   await p.locator(`[data-shop-try="${k.id}"]`).click();await settle();
  }
  await p.evaluate(({kn,title})=>__t.sheet(kn,5,230,title),{kn,title:`${tag} Pip`}).then(url=>save(`sheet-${tag}-pip.png`,url));
  results.push({name:`${tag}: Pip in her four outfits`});
  await context.close();
 }
 if(rows.length)await writeFile(`${OUT}/measurements.json`,JSON.stringify(rows,null,1));
 assert.deepEqual(fails,[],'every garment moves the silhouette, every dye only the colour');
 // ---- the screens, once at each size: wear, dye, try on, take off, the costume covering, the atelier and Pip at home
 for(const [tag,view,mobile] of [['d1440',{width:1440,height:900},false],['m390',{width:390,height:844},true]]){
  const {page:p,context}=await setup(view,mobile);await enter(p);
  await p.evaluate(()=>willowmere.test.open('wardrobe'));await p.waitForSelector('.colour-row',{timeout:30000});
  const heads=await p.locator('.item-group-head button').allTextContents();assert.match(heads[0],/Clothes · 13/,`${tag}: the clothes group is first: ${heads}`);
  const order=await p.evaluate(()=>{const m=document.querySelector('#modal'),c=m.querySelector('.colour-row'),g=m.querySelector('.item-group');return !!(c.compareDocumentPosition(g)&Node.DOCUMENT_POSITION_FOLLOWING);});assert.ok(order,'the Colour row comes before the groups');
  assert.equal(await p.locator('.colour-row .dye').count(),14);assert.equal(await p.locator('.colour-row [data-shop-try], .colour-row [data-garment-try]').count(),0,'the Colour row has no Try on');
  await p.locator('[data-garment="honey"] [data-garment-try]').click();await p.waitForTimeout(800);
  assert.equal((await snapshot(p)).outfit,'meadow','a try-on is not saved');await p.screenshot({path:`${OUT}/screen-${tag}-wardrobe-tryon.png`});
  await p.locator('[data-garment="honey"] [data-action="do"][data-type="outfit"]').click();await p.waitForTimeout(600);
  assert.equal((await snapshot(p)).outfit,'honey');
  await p.locator(`.colour-row .dye[data-id="${OUTFITS[5].color}"]`).click();await p.waitForTimeout(600);assert.equal((await snapshot(p)).tint,OUTFITS[5].color);
  await p.screenshot({path:`${OUT}/screen-${tag}-wardrobe-dyed.png`});
  await p.locator('.colour-row .dye.own').click();await p.waitForTimeout(400);assert.equal((await snapshot(p)).tint,'');
  // the atelier: thirteen garments with Try on, the six Zoo costumes among the gear
  await p.evaluate(()=>willowmere.test.open('shop','clothes'));await p.waitForTimeout(500);
  const cards=await p.evaluate(()=>document.querySelector('[data-shop-tab="outfits"]')?.querySelectorAll('.shop-item').length);assert.equal(cards,13,'thirteen garments at the atelier');
  assert.equal(await p.locator('[data-shop-tab="outfits"] [data-shop-try]').count(),12,'every garment but the worn one has Try on');
  await p.locator('[data-shop-try="plum"]').click();await p.waitForTimeout(900);assert.match(await p.locator('#modal').getAttribute('class'),/dialog-right/);await p.screenshot({path:`${OUT}/screen-${tag}-atelier-tryon.png`});
  await p.locator('[data-shop-try="plum"]').click();await p.waitForTimeout(500);
  await p.locator('[data-action="tab"][data-id="gear"]').click();await p.waitForTimeout(400);
  for(const id of ['armor_army','armor_navy','armor_aodai','armor_aodai_man','armor_usa','armor_vietnam'])assert.ok(await p.locator(`[data-gear="${id}"]`).count(),`${id} is sold at the atelier`);
  await p.locator('[data-gear="armor_aodai"] [data-type="equip"]').click(); // (the seed owns everything: Wear, not Buy)
  await p.waitForTimeout(700);assert.equal((await snapshot(p)).gear.wear,'armor_aodai');
  // a costume covers the clothes (the Colour row says so); choosing clothes takes the costume off again
  await p.evaluate(()=>willowmere.test.open('wardrobe'));await p.waitForTimeout(900);
  assert.match(await p.locator('.colour-row small').textContent(),/Take off your costume/);assert.ok(await p.locator('.colour-row .dye').first().isDisabled());
  await p.screenshot({path:`${OUT}/screen-${tag}-wardrobe-costume.png`});
  await p.locator('[data-garment="sky"] [data-action="do"][data-type="outfit"]').click();await p.waitForTimeout(600);
  const after=await snapshot(p);assert.equal(after.gear.wear,'');assert.equal(after.outfit,'sky');
  await p.evaluate(()=>willowmere.test.open('mirror'));await p.waitForSelector('[data-look-row="clothes"]',{timeout:30000});await p.waitForTimeout(900);await p.screenshot({path:`${OUT}/screen-${tag}-mirror.png`});
  assert.ok(await p.locator('[data-look-row="clothes"] .look-chip').count()>=13);
  // Pip at home wears her outfit, and the family screen shows it
  await p.evaluate(()=>willowmere.test.open('shop','clothes'));await p.waitForTimeout(400);await p.locator('[data-action="tab"][data-id="kids"]').click();await p.waitForTimeout(600);
  await p.locator('[data-action="do"][data-type="kidOutfit"][data-id="party"]').click();await p.waitForTimeout(600);assert.equal((await snapshot(p)).kidOutfit,'party');
  await p.evaluate(()=>willowmere.test.tryOn(null));await closePanel(p);await p.waitForTimeout(2500);
  const pip=await p.evaluate(()=>willowmere.targets().find(t=>t.type==='person'&&t.id==='pip'));assert.ok(pip,'Pip is at home');
  const clip=r=>({x:Math.max(0,Math.round(r.x)),y:Math.max(0,Math.round(r.y)),width:Math.min(view.width-Math.max(0,Math.round(r.x)),Math.round(r.width)),height:Math.min(view.height-Math.max(0,Math.round(r.y)),Math.round(r.height))});
  if(pip.screen.x>20&&pip.screen.x<view.width-20)await p.screenshot({path:`${OUT}/pip-${tag}-home-party.png`,clip:clip({x:pip.screen.x-90,y:pip.screen.y-170,width:180,height:230})});
  await p.evaluate(()=>willowmere.test.open('talk','pip'));await p.waitForTimeout(500);await p.waitForSelector('#modal [data-mirror-slot="person"] canvas',{timeout:20000});await p.waitForTimeout(500); // the talk panel draws her live (garments-view paintPerson): the lilac of the party dress is in the picture
  const lilac=await p.evaluate(()=>{const c=document.querySelector('#modal [data-mirror-slot="person"] canvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i+3]>200&&d[i]>140&&d[i]<215&&d[i+1]>110&&d[i+1]<185&&d[i+2]>170&&d[i+2]<235&&d[i+2]>d[i+1]+15)n++;return n;});assert.ok(lilac>150,'the family screen shows the dress ('+lilac+' lilac pixels)');await p.screenshot({path:`${OUT}/screen-${tag}-pip-talk.png`});
  await closePanel(p);
  // walk about in a coat at a run: the feet stay on the floor
  await p.evaluate(()=>willowmere.test.tryOn({gear:{garment:'garment_midnight'}}));await p.keyboard.down('Shift');await p.keyboard.down('a');await p.waitForTimeout(700);const f=await p.evaluate(()=>willowmere.feet());await p.keyboard.up('a');await p.keyboard.up('Shift');
  assert.ok(Math.abs(f.low)<.2,`${tag}: the feet are on the ground at a run (${f.low})`);await p.evaluate(()=>willowmere.test.tryOn(null));
  results.push({name:`${tag}: wardrobe, atelier, mirror, costumes, Pip at home and her family screen`});
  await context.close();
 }
 assert.deepEqual(errors,[],'no console errors');
 console.log(JSON.stringify(results,null,1));
}catch(error){console.error(error);console.error(errors.slice(0,10));process.exitCode=1;}finally{await browser.close();await writeFile('test-results/garments-browser.json',JSON.stringify({results,errors,rows:rows.length},null,1));}
