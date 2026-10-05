import assert from 'node:assert/strict';
// Lands a fish with the one control there is: Space (desktop) or a held pointer on the round Reel button (touch). Press at the
// bite, hold to pull, let go when the line tightens (the button turns red at "strained") and hold again once it has eased.
// `touch` may be true (a mouse pointer on the button) or a finger: {down(x,y), up()} sending real touch events.
export async function landFish(page,{touch=false,screenshot,releaseAt=.7}={}){
 const finger=touch&&typeof touch==='object'?touch:{down:async(x,y)=>{await page.mouse.move(x,y);await page.mouse.down();},up:()=>page.mouse.up()};
 await page.waitForFunction(()=>['bite','hooked'].includes(willowmere.metrics().fishing.phase),null,{timeout:45000,polling:50});
 assert.ok((await page.evaluate(()=>willowmere.metrics())).fishing.rod);
 assert.ok((await page.evaluate(()=>willowmere.metrics())).fishing.line);
 if(screenshot)await page.screenshot({path:screenshot});
 const button=page.locator('#reel-button'),box=await button.boundingBox();
 let held=false;
 for(let i=0;i<500;i++){
  const f=await page.evaluate(()=>willowmere.metrics().fishing);if(f.phase==='idle')break;
  const want=f.phase==='bite'||f.phase==='hooked'&&!f.strained&&(held?f.tension<releaseAt:f.tension<.25);
  if(want&&!held){if(touch)await finger.down(box.x+box.width/2,box.y+box.height/2);else await page.keyboard.down('Space');held=true;}
  if(!want&&held){if(touch)await finger.up();else await page.keyboard.up('Space');held=false;}
  await page.waitForTimeout(120);
 }
 if(held){if(touch)await finger.up();else await page.keyboard.up('Space');}
 assert.equal((await page.evaluate(()=>willowmere.metrics())).fishing.phase,'idle');
}
