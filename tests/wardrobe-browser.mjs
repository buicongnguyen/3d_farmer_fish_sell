// Wears every wardrobe entry on every body build and asserts the silhouette changes unless it is a Colour swatch (recolour only).
// GAME_URL=http://127.0.0.1:<port> GPU=1 node tests/wardrobe-browser.mjs  -> contact sheets in SHEETS (default evidence-wardrobe/after).
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {freshState,SAVE_KEY} from '../src/game.mjs';
import {GEAR} from '../src/gear.mjs';
import {OUTFITS,KID_OUTFITS} from '../src/content.mjs';
const base=process.env.GAME_URL??'http://127.0.0.1:4482',OUT=process.env.SHEETS??'C:/Users/n/source/repos/cute_game-notes/willowmere/evidence-wardrobe/after';
await mkdir(OUT,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:process.env.GPU?['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']:[]});
const BUILDS=['girl-tall-none-none','boy-tall-none-none','girl-tiny-none-none','boy-teen-none-none','girl-grown-none-none','sturdy-chibi-none-none','slim-tall-none-none'];
const seed=()=>Object.assign(freshState(),{started:true,settings:{...freshState().settings,test:true},position:{x:0,z:-8.8}});
const errors=[],sheets={};
const shape=(a,b)=>{const A=Buffer.from(a.mask,'base64'),B=Buffer.from(b.mask,'base64');let n=0;for(let i=0;i<A.length;i++)if(A[i]!==B[i])n++;return n;};
const diff=(a,b)=>{const A=Buffer.from(a.rgb,'base64'),B=Buffer.from(b.rgb,'base64');let n=0;for(let i=0;i<A.length;i+=4){const sa=A[i+3]>128,sb=B[i+3]>128;if(sa!==sb||sa&&Math.abs(A[i]-B[i])+Math.abs(A[i+1]-B[i+1])+Math.abs(A[i+2]-B[i+2])>60)n++;}return n;}; // pixels of the picture that are another shape or another colour
for(const [tag,view,mobile] of [['d1440',{width:1440,height:900},false],['m390',{width:390,height:844},true]]){
 const ctx=await browser.newContext({viewport:view,isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1});
 await ctx.addInitScript(({key,seed})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(seed));},{key:SAVE_KEY,seed:seed()});
 const p=await ctx.newPage();p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base);await p.waitForFunction(()=>window.willowmere?.metrics().ready,null,{timeout:120000});await p.locator('#begin').click();await p.waitForTimeout(300);
 const shot=(wants,opts)=>p.evaluate(([w,o])=>willowmere.test.portrait(w,o),[wants,opts]);
 const entries=[];
 for(const o of OUTFITS)entries.push({kind:'garment',id:o.id,wants:{gear:{garment:'garment_'+o.id},outfitColor:o.color}});
 for(const o of KID_OUTFITS)entries.push({kind:'kid',id:o.id,wants:{gear:{garment:'kid_'+o.id},outfitColor:o.color}});
 for(const [id,g] of Object.entries(GEAR))if(g.slot==='wear')entries.push({kind:g.disguise?'disguise':'costume',id,wants:{gear:{wear:id}}});
 entries.push({kind:'colour',id:'dye',wants:{gear:{garment:'garment_meadow'},outfitColor:'#964e66'},recolour:true});
 const rows=[];
 for(const look of BUILDS){
  const bare=await shot({look,gear:{garment:''}}),meadow=await shot({look,gear:{garment:'garment_meadow'}});
  const ref=await shot({look,gear:{garment:'garment_meadow'},outfitColor:'#849978'});
  for(const e of entries){
   const r=await shot({look,outfitColor:e.wants.outfitColor??'#849978',gear:e.wants.gear});
   const against=e.recolour?ref:bare,d=diff(against,r);
   rows.push({look,...e,diff:d,area:r.area,png:r.png});if(!e.recolour&&d<bare.area*.06)console.log('  small change',tag,look,e.id,d,'/',bare.area);
   if(e.recolour)assert.ok(shape(ref,r)===0&&d>0,`${tag} ${look}: a colour is a recolour, the silhouette stays`);
   else assert.ok(d>=bare.area*.03,`${tag} ${look} ${e.kind} ${e.id}: only ${d}px of ${bare.area} differ from the bare body in the same colour (recolour?)`);
  }
 }
 // contact sheets: one per kind, in the page, for the default build and the two extreme ones
 for(const kind of ['garment','kid','costume','disguise']){
  const html=rows.filter(r=>r.kind===kind&&['girl-tall-none-none','girl-tiny-none-none','girl-grown-none-none','sturdy-chibi-none-none'].includes(r.look)).map(r=>`<figure style="margin:0;text-align:center;font:10px sans-serif"><img src="${r.png}" width="110"><br>${r.id}<br>${r.look.split('-').slice(0,2).join(' ')}</figure>`).join('');
  const sp=await ctx.newPage();await sp.setContent(`<body style="background:#cfe9ff;display:flex;flex-wrap:wrap;gap:4px;width:1500px">${html}</body>`);await sp.waitForTimeout(500);
  await sp.screenshot({path:`${OUT}/sheet-${tag}-${kind}.png`,fullPage:true});await sp.close();
 }
 // widest stride: the picture from the walk cycle at maximum swing, for the long garments and disguises
 for(const id of ['garment_midnight','kid_party','kid_rain','garment_festival','garment_honey']){for(const look of ['girl-tall-none-none','boy-grown-none-none']){const r=await shot({look,gear:{garment:id},outfitColor:'#964e66'},{walk:.8});await writeFile(`${OUT}/walk-${tag}-${id}-${look}.png`,Buffer.from(r.png.split(',')[1],'base64'));}}
 for(const id of ['dz_mage','dz_knight','dz_dino','dz_aodai','dz_snowman','dz_fairy']){const r=await shot({look:'girl-tall-none-none',gear:{wear:id,weapon:'sword_wood',hat:'hat_straw'}},{walk:.8});await writeFile(`${OUT}/walk-${tag}-${id}.png`,Buffer.from(r.png.split(',')[1],'base64'));}
 console.log(tag,'checked',rows.length,'pictures');
 await ctx.close();
}
await browser.close();
assert.deepEqual(errors.filter(e=>!/favicon|WebGL|GPU stall/i.test(e)),[],'no console errors');
console.log('wardrobe-browser OK');
