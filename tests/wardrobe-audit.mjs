// Read-only audit of the wardrobe BEFORE the garments (run against a build of 446e5f9 with the test hook, port 4482): wear every
// entry in turn, capture the mirror's picture, compare alpha silhouettes with the default. Result: the 13 shirt colours move 0 px.
// Output: evidence-wardrobe/before/ (pictures and audit.json). Kept for the record; tests/garments-browser.mjs is the live suite.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {freshState,SAVE_KEY} from '../src/game.mjs';
import {GEAR} from '../src/gear.mjs';
import {OUTFITS} from '../src/content.mjs';
const OUT='C:/Users/n/source/repos/cute_game-notes/willowmere/evidence-wardrobe/before';await mkdir(OUT,{recursive:true});
const base='http://127.0.0.1:4482';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']});
const seed0=()=>{};const seed=()=>Object.assign(freshState(),{settings:{...freshState().settings,test:true}},{started:true,coins:99999,energy:80,position:{x:0,z:-8.8},upgrades:{farm:1,pond:1,pen:1,house:3,kitchen:3},furniture:['rug','sofa','plants','books','dining','art'],gearOwned:Object.keys(GEAR),owned:OUTFITS.map(o=>o.id),looksOwned:[]});seed0();
async function setup(view,mobile){const context=await browser.newContext({viewport:view,isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1});await context.addInitScript(({key,seed})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(seed));},{key:SAVE_KEY,seed:seed()});const page=await context.newPage();await page.goto(base);await page.waitForFunction(()=>window.willowmere?.metrics().ready,null,{timeout:90000});await page.locator('#begin').click();await page.waitForTimeout(300);return{page,context};}
const enter=async p=>{await p.keyboard.press('e');await p.waitForFunction(()=>willowmere.metrics().location==='interior',null,{timeout:30000});await p.waitForTimeout(500);};
const target=(p,type)=>p.evaluate(type=>willowmere.targets().find(t=>t.type===type),type);
async function use(p,type){await p.evaluate(type=>willowmere.test.open(type),type);await p.waitForTimeout(900);}
const grab=p=>p.evaluate(()=>{const c=document.querySelector('.mirror-glass canvas');if(!c)return null;const d=c.getContext('2d').getImageData(0,0,c.width,c.height);return{w:c.width,h:c.height,png:c.toDataURL('image/png'),data:Array.from(d.data)};});
function cmp(a,b){if(!a||!b||a.w!==b.w)return{sil:-1,col:-1};let sil=0,col=0,n=0;for(let i=0;i<a.data.length;i+=4){const A=a.data[i+3]>128,B=b.data[i+3]>128;if(A)n++;if(A!==B)sil++;else if(A&&(Math.abs(a.data[i]-b.data[i])+Math.abs(a.data[i+1]-b.data[i+1])+Math.abs(a.data[i+2]-b.data[i+2])>24))col++;}return{sil,col,area:n};}
const save=async(name,buf)=>writeFile(`${OUT}/${name}`,buf);
const rows=[];
for(const [tag,view,mobile] of [['d1440',{width:1440,height:900},false],['m390',{width:390,height:844},true]]){
 const {page:p,context}=await setup(view,mobile);await enter(p);
 // ---- wardrobe: gear try-ons (silhouette from the mirror canvas)
 await use(p,'wardrobe');await p.waitForSelector('.mirror-glass canvas',{state:'attached',timeout:60000});await p.waitForTimeout(800);
 const def=await grab(p);await save(`mirror-${tag}-default.png`,Buffer.from(def.png.split(',')[1],'base64'));
 const shotGame=async name=>{const b=await p.screenshot();await save(name,b);};
 await shotGame(`game-${tag}-default.png`);
 const ids=await p.evaluate(()=>[...document.querySelectorAll('[data-gear-try]')].map(b=>b.dataset.gearTry));
 for(const id of ids){
  await p.evaluate(id=>{const b=document.querySelector(`[data-gear-try="${id}"]`);if(b&&b.getAttribute('aria-pressed')!=='true')b.click();},id);
  await p.waitForTimeout(450);
  let g=await grab(p);await p.waitForTimeout(250);g=await grab(p);
  const r=cmp(def,g);rows.push({vp:tag,kind:'gear',id,slot:GEAR[id].slot,...r});
  await save(`mirror-${tag}-${id}.png`,Buffer.from(g.png.split(',')[1],'base64'));
  if(/hat_(party|wizard|cowboy)|armor_(hoodie|kimono|knight|angel|wings)|boots_cowboy|sword_wood|bunny|armor_leather/.test(id))await shotGame(`game-${tag}-${id}.png`);
  await p.evaluate(id=>{const b=document.querySelector(`[data-gear-try="${id}"]`);if(b&&b.getAttribute('aria-pressed')==='true')b.click();},id);
  await p.waitForTimeout(150);
 }
 // ---- shirt colours: wear each
 const shirts=await p.evaluate(()=>[...document.querySelectorAll('[data-type="outfit"]')].map(b=>b.dataset.id));
 for(const id of shirts){
  await p.evaluate(id=>document.querySelector(`[data-type="outfit"][data-id="${id}"]`)?.click(),id);await p.waitForTimeout(700);
  const g=await grab(p);const r=cmp(def,g);rows.push({vp:tag,kind:'shirt',id,name:OUTFITS.find(o=>o.id===id).name,color:OUTFITS.find(o=>o.id===id).color,...r});
  await save(`mirror-${tag}-shirt_${id}.png`,Buffer.from(g.png.split(',')[1],'base64'));
  if(['honey','clay','midnight','festival'].includes(id))await shotGame(`game-${tag}-shirt_${id}.png`);
 }
 await p.evaluate(()=>document.querySelector('[data-type="outfit"][data-id="meadow"]')?.click());await p.waitForTimeout(500);
 // ---- mirror options
 await p.getByRole('button',{name:'Close panel',exact:true}).click();await p.waitForTimeout(500);
 await use(p,'mirror');await p.waitForSelector('.mirror-glass canvas',{timeout:30000});await p.waitForTimeout(900);
 const mdef=await grab(p);
 const opts=await p.evaluate(()=>[...document.querySelectorAll('[data-look-option]')].map(b=>b.dataset.lookOption));
 for(const o of opts){
  await p.evaluate(o=>document.querySelector(`[data-look-option="${o}"]`)?.click(),o);await p.waitForTimeout(900);
  let g=await grab(p);await p.waitForTimeout(200);g=await grab(p);
  rows.push({vp:tag,kind:'look',id:o,...cmp(mdef,g)});await save(`mirror-${tag}-look_${o.replace(':','_')}.png`,Buffer.from(g.png.split(',')[1],'base64'));
 }
await writeFile(`${OUT}/audit.json`,JSON.stringify(rows,null,1));
 await context.close();
}
await writeFile(`${OUT}/audit.json`,JSON.stringify(rows,null,1));
console.log(JSON.stringify(rows.filter(r=>r.vp==='d1440').map(r=>[r.kind,r.id,r.sil,r.col,r.area].join(' ')),null,0).replace(/","/g,'\n'));
await browser.close();
