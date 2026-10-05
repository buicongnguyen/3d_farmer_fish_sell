import assert from 'node:assert/strict';
import {launch,open,shot,save,snapshot} from './travel-kit.mjs';
import {FISH_SPOT} from '../src/content.mjs';
import {OUTSIDE_PONDS} from '../src/pond.mjs';
import {landFish} from './fishing-controls.mjs';
const browser=await launch(),results=[];
try{for(const view of process.env.VIEW?[process.env.VIEW]:['desktop','phone']){
 const pond=OUTSIDE_PONDS[0],start=view==='phone'?FISH_SPOT:{x:pond.x,z:pond.z+pond.r+1.1};
 const {page,context,errors}=await open(browser,view,s=>{s.position={...start};s.time=10;s.energy=100;if(view==='phone')s.hired={ellis:'fisher'};},{quality:view==='phone'?'battery':'high'});
 try{
  await page.waitForFunction(()=>typeof willowmere.villagers==='function');
  if(view==='phone')await page.waitForFunction(()=>willowmere.villagers().npcs.find(n=>n.id==='ellis').working);
  await page.evaluate(()=>{window.catchSpeech=[];const el=document.getElementById('village-bubble');new MutationObserver(()=>{if(!el.hidden)catchSpeech.push(el.textContent);}).observe(el,{childList:true,subtree:true,characterData:true});});
  let touch=false;if(view==='phone'){const cdp=await context.newCDPSession(page);touch={down:(x,y)=>cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]}),up:()=>cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})};}
  for(let i=0;i<2;i++){
   if(view==='phone'){const selector=i&&await page.locator('#reel-button').isVisible()?'#reel-button':'#touch-action';const b=await page.locator(selector).boundingBox();await page.touchscreen.tap(b.x+b.width/2,b.y+b.height/2);}else await page.keyboard.press('e');
   await page.waitForFunction(()=>willowmere.metrics().fishing.line);
   await landFish(page,{touch});
   assert.equal((await snapshot(page)).stats.fish,i+1);
   await page.waitForFunction(()=>!document.getElementById('village-bubble').hidden&&getComputedStyle(document.getElementById('village-bubble')).visibility!=='hidden');
   const text=await page.locator('#village-bubble').innerText();
   const box=await page.locator('#village-bubble').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=page.viewportSize().width,'speech fits screen');
   await shot(page,`catch-reaction-${view}-${i}`);
   await page.waitForTimeout(5200);
   results.push({view,catch:i+1,text,speech:await page.evaluate(()=>catchSpeech)});
  }
  const own=results.filter(r=>r.view===view);assert.notEqual(own[0].text,own[1].text,'consecutive player reactions differ');
  if(view==='phone')assert.ok(own[0].speech.length>=2,'nearby fisher cheers after player');
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
}}finally{await save('catch-reactions',results);await browser.close();}
console.log(JSON.stringify(results));
