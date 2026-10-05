// The villagers' own outfits in a real browser (outfits.mjs): every resident of the village is sent into view, once with the Pandora
// box shut and open (the same everyday outfit), at 1440x900 and 390x844.
//  1. the outfit each villager wears is the one outfits.mjs asks for, and the box swapping them in view leaves no error, keeps every
//     villager where they stood and leaves a whole avatar (never a seated or half-built one);
//  2. silhouettes: the alpha picture of every pair of villagers (the portrait hook draws each in the outfit it wears) differs, and each
//     villager's portrait is identical with Pandora open or shut;
//  3. each villager is really on screen: the crop of the village around them differs from the empty ground;
//  4. contact sheets of all of them (shut and open) go to the evidence folder: look at them;
//  5. draw calls and triangles (shadow pass included) with villagers out, against the plain villagers of before.
//   GAME_URL=http://127.0.0.1:<port> GPU=1 node tests/villagers-outfits-browser.mjs
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {freshState,SAVE_KEY} from '../src/game.mjs';
import {RESIDENTS} from '../src/content.mjs';
import {outfitOf,outfitKey} from '../src/outfits.mjs';
const OUT=process.env.EVIDENCE??'C:/Users/n/source/repos/cute_game-notes/willowmere/evidence-wardrobe/villagers';await mkdir(OUT,{recursive:true});await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({channel:process.env.CI?undefined:'chrome',headless:true,args:process.env.GPU?['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
const base=process.env.GAME_URL??'http://127.0.0.1:4173',errors=[],fails=[],report={};
const check=(ok,message)=>{if(!ok)fails.push(message);};
const IDS=RESIDENTS.map(p=>p.id);
const seed=()=>Object.assign(freshState(),{started:true,energy:80,position:{x:18,z:30},settings:{...freshState().settings,test:true}});
async function setup(view,mobile,at={x:18,z:30}){
 const context=await browser.newContext({viewport:view,isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1});
 await context.addInitScript(({key,seed})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(seed));},{key:SAVE_KEY,seed:{...seed(),position:at}});
 const page=await context.newPage();
 page.on('console',m=>{if(m.type()==='error'&&!/favicon/.test(m.text()))errors.push(`console ${m.text()}`);});page.on('pageerror',e=>errors.push(`pageerror ${e.message}`));
 await page.goto(base);await page.waitForFunction(()=>window.willowmere?.metrics().ready,null,{timeout:120000});await page.locator('#begin').click();await page.waitForTimeout(1200);
 return {page,context};
}
const snapshot=p=>p.evaluate(()=>willowmere.snapshot());
const settle=async(p,ms=350)=>{await p.waitForTimeout(ms);await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));};
async function zoomIn(p,view){ // the closer camera a player can scroll to: the outfits are made out at the game's own zoom, and the sheets want a little more
 await p.mouse.move(view.width/2,view.height/2);
 for(let i=0;i<14;i++){await p.mouse.wheel(0,-240);await p.waitForTimeout(60);}
 await p.waitForTimeout(500);
}
/** A sheet of images (data URLs or buffers) with captions, composed in a blank page, saved as a PNG. */
async function sheet(context,file,items,cols,cell,scale=1){
 const page=await context.newPage();await page.setContent('<body style="margin:0;background:#cfe8ff"><canvas id=c></canvas></body>');
 const url=await page.evaluate(async({items,cols,cell,scale})=>{
  const imgs=await Promise.all(items.map(i=>new Promise(ok=>{const im=new Image();im.onload=()=>ok(im);im.onerror=()=>ok(null);im.src=i.src;})));
  const rows=Math.ceil(items.length/cols),c=document.getElementById('c'),g=c.getContext('2d');c.width=cols*cell[0];c.height=rows*(cell[1]+18);g.fillStyle='#cfe8ff';g.fillRect(0,0,c.width,c.height);
  imgs.forEach((im,i)=>{const x=(i%cols)*cell[0],y=Math.floor(i/cols)*(cell[1]+18);if(im){const w=im.width*scale,h=im.height*scale;g.imageSmoothingEnabled=false;g.drawImage(im,x+(cell[0]-w)/2,y+(cell[1]-h)/2,w,h);}g.fillStyle='#10202c';g.font='12px sans-serif';g.textAlign='center';g.fillText(items[i].name,x+cell[0]/2,y+cell[1]+13);});
  return c.toDataURL('image/png');},{items,cols,cell,scale});
 await writeFile(`${OUT}/${file}`,Buffer.from(url.split(',')[1],'base64'));await page.close();
}
const decode=(b64)=>Uint8Array.from(Buffer.from(b64,'base64'));
// GPU readback can round a colour channel by one on its first draw. Keep exact silhouettes and identical visible colour.
const sameColours=(a,b)=>a.length===b.length&&a.every((v,i)=>Math.abs(v-b[i])<=1);
const dataUrl=b=>'data:image/png;base64,'+b.toString('base64');
const px=(a,b)=>{let diff=0,n=0;for(let i=0;i<a.length;i+=4){const d=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]);n++;if(d>36)diff++;}return diff/n;}; // the share of pixels that differ visibly
const png2raw=async(context,buf)=>{const page=await context.newPage();await page.setContent('<canvas id=c></canvas>');const r=await page.evaluate(async src=>{const im=await new Promise(ok=>{const i=new Image();i.onload=()=>ok(i);i.src=src;});const c=document.getElementById('c');c.width=im.width;c.height=im.height;const g=c.getContext('2d');g.drawImage(im,0,0);return {w:im.width,h:im.height,data:Array.from(g.getImageData(0,0,im.width,im.height).data)};},dataUrl(buf));await page.close();return r;};
try{
 for(const [tag,view,mobile] of [['d1440',{width:1440,height:900},false],['m390',{width:390,height:844},true]]){
  const {page:p,context}=await setup(view,mobile);
  await zoomIn(p,view);
  const crop=[view.width>600?210:150,view.width>600?300:230];
  const clipOf=s=>({x:Math.max(0,Math.min(view.width-crop[0],Math.round(s.x-crop[0]/2))),y:Math.max(0,Math.min(view.height-crop[1],Math.round(s.y-crop[1]*.62))),width:crop[0],height:crop[1]});
  report[tag]={};
  // ---- 1. the box shut, then opened and shut again with every villager in view
  const snap0=await snapshot(p);assert.equal(snap0.pandora,false);
  await p.evaluate(ids=>willowmere.test.stage(ids,{cols:8,gap:2.2,depth:2.6}),IDS);await settle(p,900);
  const where=()=>p.evaluate(ids=>ids.map(id=>{const n=willowmere.test.npc(id);return [id,n.x,n.z,n.outfit,n.pending,n.tris];}),IDS);
  const expect=(open,state)=>Object.fromEntries(RESIDENTS.map(r=>[r.id,outfitKey(outfitOf(r,open,state))]));
  for(const open of [false,true,false]){
   const before=await where();
   if(open!==(await snapshot(p)).pandora)assert.equal(await p.evaluate(o=>willowmere.test.box(o),open),true,'the box toggles');
   await settle(p,500);
   const after=await where(),want=expect(open,await snapshot(p));
   for(const [i,[id,x,z,outfit,pending,tris]] of after.entries()){
    check(outfit===want[id],`${tag} box ${open?'open':'shut'}: ${id} wears ${outfit}, wanted ${want[id]}`);
    check(!pending,`${tag} ${id} is half-built (pending files)`);
    check(Math.hypot(x-before[i][1],z-before[i][2])<1e-6,`${tag} ${id} moved when the box ${open?'opened':'shut'}`);
    check(tris>800&&tris<14000,`${tag} ${id} draws ${Math.round(tris)} triangles`);
   }
   report[tag][open?'swap-open':'swap-shut']=after.map(a=>a[3]).length;
  }
  check(errors.length===0,`${tag} errors after the swaps: ${errors.join(' | ')}`);
  // ---- 3 + 4. each villager alone in view, box shut then open: the crop, against the empty ground
  await p.evaluate(()=>willowmere.test.stage(['june'],{depth:0}));await settle(p,400);
  const spot=clipOf(await p.evaluate(()=>willowmere.test.npc('june').screen));
  await p.evaluate(()=>willowmere.test.stage(['nobody']));await settle(p,500);
  const emptyShot=await p.screenshot({clip:spot});
  for(const open of [false,true]){
   await p.evaluate(o=>willowmere.test.box(o),open);await settle(p,400);
   const items=[],raws=[];
   for(const r of RESIDENTS){
    await p.evaluate(id=>willowmere.test.stage([id],{depth:0}),r.id);await settle(p,260);
    const s=await p.evaluate(id=>willowmere.test.npc(id).screen,r.id),clip=clipOf(s),shot=await p.screenshot({clip});
    const baseRaw=await png2raw(context,emptyShot),shotRaw=await png2raw(context,shot);
    const share=px(baseRaw.data,shotRaw.data);check(share>.02,`${tag} ${open?'open':'shut'} ${r.id}: only ${(share*100).toFixed(1)}% of the crop differs from empty ground (is she on screen?)`);
    items.push({name:`${r.name} · ${r.role.split(' · ')[0]}`,src:dataUrl(shot)});raws.push(share);
   }
   await sheet(context,`sheet-${tag}-${open?'open':'shut'}.png`,items,mobile?5:6,[crop[0]*(mobile?1.5:1.2),crop[1]*(mobile?1.5:1.2)],mobile?1.5:1.2);
   report[tag][open?'visible-open':'visible-shut']=Math.min(...raws);
  }
  // ---- 5. draw calls and triangles with villagers out
  const meter=async(ids,plain)=>{ // the last counted frame (shadow pass included), the median of three, and what the avatars themselves hold
   await p.evaluate(({ids,plain})=>willowmere.test.plain(plain).then(()=>willowmere.test.stage(ids,{cols:8,gap:2.2})),{ids,plain});
   const calls=[],tris=[];for(let i=0;i<3;i++){await settle(p,450);const m=await p.evaluate(()=>willowmere.metrics().calls);calls.push(m.calls);tris.push(m.triangles);}
   const own=await p.evaluate(ids=>ids.reduce((a,id)=>{const n=willowmere.test.npc(id)||{meshes:0,tris:0};return {meshes:a.meshes+n.meshes,tris:a.tris+Math.round(n.tris)};},{meshes:0,tris:0}),ids);
   const mid=a=>[...a].sort((x,y)=>x-y)[1];return {calls:mid(calls),triangles:mid(tris),avatarMeshes:own.meshes,avatarTriangles:own.tris};};
  report[tag].budget={};
  for(const open of [false,true]){
   await p.evaluate(o=>willowmere.test.box(o),open);
   for(const [label,ids] of [['4out',IDS.slice(2,6)],['all23',IDS]]){
    const plain=await meter(ids,true),dressed=await meter(ids,false),again=await meter(ids,true),empty=await meter(['nobody'],false);
    report[tag].budget[`${open?'open':'shut'}-${label}`]={plain,dressed,plainAgain:{calls:again.calls,triangles:again.triangles},empty:{calls:empty.calls,triangles:empty.triangles}};
   }
  }
  await p.evaluate(()=>willowmere.test.stage(null));
  // ---- 6. the talk panel's portrait wears the villager's everyday outfit in both box states
  for(const open of [false,true]){
   await p.evaluate(o=>willowmere.test.box(o),open);await settle(p,300);const shots=[];
   for(const id of ['ada','hugo','pearl','pip','faye']){
    await p.evaluate(id=>willowmere.test.open('talk',id),id);
    await p.waitForSelector('#modal [data-mirror-slot="person"] canvas',{timeout:20000});await settle(p,500);
    shots.push({name:id+(open?' (open)':''),src:dataUrl(await p.locator('#modal').screenshot())});
    check(await p.locator('#modal [data-mirror-slot="person"] canvas').count()===1,tag+' the talk portrait is drawn for '+id);
    await p.getByRole('button',{name:'Close panel',exact:true}).click();await settle(p,150);
   }
   await sheet(context,`talk-${tag}-${open?'open':'shut'}.png`,shots,mobile?3:5,mobile?[300,560]:[400,520],mobile?.7:.55);
  }
  await context.close();
 }
 // ---- 7. at home: the family keeps its everyday outfits when the box opens (June and Pip are in view)
 for(const [tag,view,mobile] of [['d1440',{width:1440,height:900},false],['m390',{width:390,height:844},true]]){
  const {page:p,context}=await setup(view,mobile,{x:0,z:-8.8});
  await p.keyboard.press('e');await p.waitForFunction(()=>willowmere.metrics().location==='interior',null,{timeout:30000});await settle(p,2500);
  const state=await snapshot(p),want=open=>Object.fromEntries(['june','pip'].map(id=>[id,outfitKey(outfitOf(RESIDENTS.find(r=>r.id===id),open,state))]));
  const seen=async open=>{await p.evaluate(o=>willowmere.test.box(o),open);await settle(p,2200);return p.evaluate(()=>Object.fromEntries(willowmere.test.family().map(f=>[f.id,{key:f.key,meshes:f.meshes}])));};
  for(const open of [false,true,false]){
   const got=await seen(open),w=want(open);
   for(const id of Object.keys(w)){check(got[id]?.key===w[id],`${tag} home, box ${open?'open':'shut'}: ${id} wears ${got[id]?.key} (wanted ${w[id]})`);check(got[id]?.meshes>=6&&got[id]?.meshes<=7,`${tag} home ${id}: a whole avatar (6 meshes, 7 with a glowing hat; got ${got[id]?.meshes})`);}
   await p.screenshot({path:`${OUT}/home-${tag}-${open?'open':'shut'}.png`});
  }
  await context.close();
 }
 // ---- 2. silhouettes, once (the portrait hook draws a person in the outfit they wear; the alpha channel is the shape)
 {
  const {page:p,context}=await setup({width:1440,height:900},false);
  const state=await snapshot(p),shapes={};
  for(const open of [false,true])for(const r of RESIDENTS){
   const w=outfitOf(r,open,state),res=await p.evaluate(async w=>{const o=await willowmere.test.portrait(w);return {w:o.w,h:o.h,area:o.area,rgb:o.rgb,mask:o.mask};},w);
   shapes[r.id+(open?'+':'')]={mask:decode(res.mask),rgb:decode(res.rgb),area:res.area};
   if(open)await writeFile(`${OUT}/portrait-${r.id}-open.png`,Buffer.from((await p.evaluate(async w=>(await willowmere.test.portrait(w)).png,w)).split(',')[1],'base64'));
   else await writeFile(`${OUT}/portrait-${r.id}-shut.png`,Buffer.from((await p.evaluate(async w=>(await willowmere.test.portrait(w)).png,w)).split(',')[1],'base64'));
  }
  const dist=(a,b)=>{let both=0,either=0,col=0;for(let i=0;i<a.mask.length;i++){const A=a.mask[i],B=b.mask[i];if(A||B)either++;if(A&&B){both++;col+=Math.abs(a.rgb[i*4]-b.rgb[i*4])+Math.abs(a.rgb[i*4+1]-b.rgb[i*4+1])+Math.abs(a.rgb[i*4+2]-b.rgb[i*4+2]);}}return {iou:both/Math.max(1,either),col:col/Math.max(1,both)/3};};
  const keys=Object.keys(shapes);let minPair={d:9,pair:''},pairs=0;
  for(let i=0;i<keys.length;i++)for(let k=i+1;k<keys.length;k++){
   const a=keys[i],b=keys[k],open=a.endsWith('+')&&b.endsWith('+'),shut=!a.endsWith('+')&&!b.endsWith('+'),same=a.replace('+','')===b.replace('+','');
   if(!(open||shut||same))continue; if(same){check(Buffer.from(shapes[a].mask).equals(Buffer.from(shapes[b].mask))&&sameColours(shapes[a].rgb,shapes[b].rgb),`portrait changed with Pandora: ${a}`);continue;}
   const d=dist(shapes[a],shapes[b]);pairs++;const score=(1-d.iou)*100+d.col/4; // percent of the shape that moved, plus the colour difference
   if(score<minPair.d)minPair={d:score,pair:`${a}/${b}`,iou:d.iou,col:d.col};
   check((1-d.iou)>=.02||d.col>=14,`silhouette: ${a} and ${b} look alike (shape overlap ${(d.iou*100).toFixed(1)}%, colour difference ${d.col.toFixed(1)})`);
  }
  report.silhouettes={pairs,least:minPair};
  await context.close();
 }
}finally{await browser.close();}
await writeFile('test-results/villagers-outfits-results.json',JSON.stringify(report,null,1));
console.log(JSON.stringify(report,null,1));
if(fails.length){console.error(`\n${fails.length} failures:\n`+fails.slice(0,60).join('\n'));process.exit(1);}
if(errors.length){console.error('errors:\n'+errors.join('\n'));process.exit(1);}
console.log('villagers outfits browser: ok');
