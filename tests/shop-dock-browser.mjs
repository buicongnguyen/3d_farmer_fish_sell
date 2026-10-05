import assert from 'node:assert/strict';
import {launch,open,press,shot,save,snapshot} from './travel-kit.mjs';
const browser=await launch(),results=[];
async function layout(page,label){
 await page.waitForTimeout(300);
 const r=await page.evaluate(()=>{const m=document.getElementById('modal'),b=document.getElementById('modal-backdrop'),body=m.querySelector('.modal-content'),close=m.querySelector('.close-button'),rect=m.getBoundingClientRect(),cr=close.getBoundingClientRect();return {x:rect.x,right:rect.right,top:rect.top,bottom:rect.bottom,width:rect.width,W:innerWidth,H:innerHeight,scroll:body.scrollWidth,client:body.clientWidth,close:cr.top>=rect.top&&cr.bottom<=rect.bottom,background:getComputedStyle(b).backgroundColor,shop:b.classList.contains('shop-panel')};});
 assert.ok(r.shop,`${label}: shop classification persists`);assert.ok(r.x>=20,`${label}: a strip of world remains on the left`);
 assert.ok(Math.abs(r.W-12-r.right)<=1,`${label}: docks to the right edge (${JSON.stringify(r)})`);
 assert.ok(r.top>=0&&r.bottom<=r.H&&r.close,`${label}: close button and panel stay on screen`);
 assert.ok(r.scroll<=r.client+1,`${label}: content fits without horizontal overflow (${JSON.stringify(r)})`);
 assert.equal(r.background,'rgba(0, 0, 0, 0)');return r;
}
try{for(const view of process.env.VIEW?[process.env.VIEW]:['desktop','phone','landscape']){
 const {page,context,errors}=await open(browser,view,s=>{s.settings.test=true;s.coins=2000;s.inventory={carrot:3,wood:5,obsidian:2};},{quality:view==='desktop'?'high':'battery'});
 try{
  await page.waitForFunction(()=>!!willowmere.test?.open);
  for(const [id,tabs] of [['market',['seeds','sell','furniture']],['clothes',['outfits','gear','kids']],['upgrades',['upgrades','crafting','furniture']],['supermarket',['sell','seeds']]]){
   await page.evaluate(id=>willowmere.test.open('shop',id),id);
   for(const tab of tabs){
    await press(page,view,`[data-action="tab"][data-id="${tab}"]`);
    if(tab==='crafting')await page.waitForSelector('[data-recipe]');
    if(tab==='gear')await page.waitForSelector('[data-gear-try]');
    results.push({view,id,tab,...await layout(page,`${view}/${id}/${tab}`)});
    if(tab==='gear'){
     await press(page,view,'[data-gear-try="hat_party"]');await layout(page,`${view}/try on`);
    }
   }
   await shot(page,`shop-right-${view}-${id}`);
   await press(page,view,'.close-button');assert.ok(await page.locator('#modal-backdrop').isHidden());
  }
  await page.evaluate(()=>willowmere.test.open('shop','market'));await press(page,view,'[data-action="tab"][data-id="seeds"]');
  const before=await snapshot(page);await press(page,view,'[data-type="buySeed"][data-id="carrot"]');
  const after=await snapshot(page);assert.equal(after.inventory.seed_carrot,(before.inventory.seed_carrot??0)+3);assert.ok(after.coins<before.coins);await layout(page,`${view}/purchase redraw`);
  // Resize an open shop across the old desktop-only threshold.
  if(view==='desktop'){for(const width of [850,1100]){await page.setViewportSize({width,height:900});await layout(page,`desktop/${width}`);}}
  await press(page,view,'.close-button');assert.equal(await page.locator('#modal-backdrop').evaluate(el=>el.classList.contains('shop-panel')),false);
  await page.evaluate(()=>willowmere.test.open('sleep'));assert.equal(await page.locator('#modal-backdrop').evaluate(el=>el.classList.contains('docked')),false);await press(page,view,'.close-button');
  assert.deepEqual(errors,[]);
 }catch(e){await shot(page,`shop-right-${view}-failure`).catch(()=>{});throw e;}finally{await context.close();}
}}finally{await save('shop-dock',results);await browser.close();}
console.log(JSON.stringify({checks:results.length,views:[...new Set(results.map(r=>r.view))],passed:true}));
