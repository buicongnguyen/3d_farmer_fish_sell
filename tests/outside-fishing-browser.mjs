import assert from 'node:assert/strict';
import {launch,open,shot,snapshot,save,begin,holdStick} from './travel-kit.mjs';
import {OUTSIDE_PONDS,FISH_POOLS} from '../src/pond.mjs';
import {POND} from '../src/content.mjs';
import {landFish} from './fishing-controls.mjs';
const browser=await launch(),results=[];
try{for(const [view,pondId] of [['desktop','west-0'],['phone','west-0'],['phone','ice-0'],['desktop','family']]){
 const pond=pondId==='family'?{...POND,r:POND.d/2,pool:FISH_POOLS[0]}:OUTSIDE_PONDS.find(p=>p.id===pondId),start={x:pond.x,z:pond.z+pond.r+5};
 const {page,context,errors}=await open(browser,view,s=>{s.position=start;s.settings.sound=false;},{quality:view==='phone'?'battery':'high'});
 try{
  await page.waitForTimeout(800);
  const pt=await page.evaluate(p=>willowmere.project(p.x,p.z+p.r-2,.02),pond);
  await(view==='phone'?page.touchscreen.tap(pt.x,pt.y):page.mouse.click(pt.x,pt.y));
  await page.waitForFunction(()=>willowmere.metrics().fishing.line,null,{timeout:20000});
  const first=await page.evaluate(()=>willowmere.metrics());assert.ok(Math.hypot(first.position.x-pond.x,first.position.z-pond.z)<pond.r+3);
  assert.ok(Math.hypot(first.fishing.float.x-pond.x,first.fishing.float.z-pond.z)<pond.r+4);
  await shot(page,`outside-fishing-${view}-cast`);
  let touch=false;if(view==='phone'){const cdp=await context.newCDPSession(page);touch={down:(x,y)=>cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]}),up:()=>cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})};}
  await landFish(page,{touch});const caught=await snapshot(page);assert.equal(caught.stats.fish,1);assert.ok(caught.bankCatch);
  const id=Object.keys(caught.bankCatch.fish)[0];assert.ok(pond.pool.includes(id));
  await page.waitForFunction(family=>family?willowmere.metrics().pond?.bankShown===1:willowmere.render().fieldFish.bankShown===1,pondId==='family');await shot(page,`outside-fishing-${view}-${pondId}-caught`);
  const cast=await page.locator('#reel-button').boundingBox();await(view==='phone'?page.touchscreen.tap(cast.x+cast.width/2,cast.y+cast.height/2):page.mouse.click(cast.x+cast.width/2,cast.y+cast.height/2));
  await page.waitForFunction(()=>willowmere.metrics().fishing.line);
  await page.reload();await begin(page,view);assert.equal((await snapshot(page)).bankCatch.fish[id],1);
  await page.waitForFunction(family=>family?willowmere.metrics().pond?.bankShown===1:willowmere.render().fieldFish?.bankShown===1,pond.id===undefined);
  if(view==='phone'){const act=await page.locator('#touch-action').boundingBox();await page.touchscreen.tap(act.x+act.width/2,act.y+act.height/2);}else await page.keyboard.press('e');
  await page.waitForFunction(()=>willowmere.metrics().fishing.line);
  // Use movement input to leave the bank; a distant ground tap can land on a forest tree.
  const stick=view==='phone'?await holdStick(page,context,1,1):null;
  if(!stick)await page.keyboard.down('s');
  try{await page.waitForFunction(()=>!willowmere.snapshot().bankCatch,null,{timeout:10000});}
  finally{if(stick)await stick.release();else await page.keyboard.up('s');}
  assert.equal((await snapshot(page)).inventory[id],1);assert.deepEqual(errors,[]);results.push({view,pondId,id,approach:true,caught:true,grass:true,reload:true,packed:true});
 }catch(e){await shot(page,`outside-fishing-${view}-failure`);throw e;}finally{await context.close();}
}}finally{await save('outside-fishing',results);await browser.close();}
console.log(JSON.stringify(results));
