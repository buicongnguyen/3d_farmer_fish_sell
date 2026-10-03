import assert from 'node:assert/strict';
export async function landFish(page,{touch=false,screenshot}={}){
 await page.waitForFunction(()=>willowmere.metrics().fishing.phase==='bite',null,{timeout:45000,polling:50});
 assert.ok((await page.evaluate(()=>willowmere.metrics())).fishing.rod);
 assert.ok((await page.evaluate(()=>willowmere.metrics())).fishing.line);
 if(screenshot)await page.screenshot({path:screenshot});
 const button=page.locator('#reel-button'),box=await button.boundingBox();
 let held=false;
 for(let i=0;i<500;i++){
  const f=await page.evaluate(()=>willowmere.metrics().fishing);if(f.phase==='idle')break;
  const want=f.phase==='bite'||f.phase==='hooked'&&(held?f.tension<.7:f.tension<.25);
  if(want&&!held){if(touch){await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();}else await page.keyboard.down('Space');held=true;}
  if(!want&&held){if(touch)await page.mouse.up();else await page.keyboard.up('Space');held=false;}
  await page.waitForTimeout(120);
 }
 if(held){if(touch)await page.mouse.up();else await page.keyboard.up('Space');}
 assert.equal((await page.evaluate(()=>willowmere.metrics())).fishing.phase,'idle');
}
