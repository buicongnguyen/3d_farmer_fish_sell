import assert from 'node:assert/strict';
import {launch,open,press,shot,snapshot,save,VIEWS} from './travel-kit.mjs';
const browser=await launch(),results=[];
async function tapBed(page,view,id){const target=await page.evaluate(id=>willowmere.targets().find(t=>t.type==='bed'&&Number(t.id)===id),id);assert.ok(target);if(VIEWS[view].hasTouch)await page.touchscreen.tap(target.screen.x,target.screen.y);else await page.mouse.click(target.screen.x,target.screen.y);}

try{for(const view of process.env.VIEW?[process.env.VIEW]:['desktop','phone']){
 const {page,context,errors}=await open(browser,view,s=>{s.day=1;s.elapsed=100;s.energy=10;s.position={x:-16.8,z:-1};s.inventory={seed_carrot:3};s.beds[0]={crop:'radish',planted:0,watered:true};s.beds[1]={crop:'pumpkin',planted:100,watered:true};});
 try{
  const target=await page.evaluate(()=>willowmere.targets().find(t=>t.type==='bed'&&Number(t.id)===2));assert.ok(target);if(VIEWS[view].hasTouch)await page.touchscreen.tap(target.screen.x,target.screen.y);else await page.mouse.click(target.screen.x,target.screen.y);
  await page.waitForSelector('[data-field="plant-all"][data-crop="carrot"]');await shot(page,`field-batch-${view}-menu`);assert.match(await page.locator('[data-field="plant-all"][data-crop="carrot"]').innerText(),/3/);
  await press(page,view,'[data-field="plant-all"][data-crop="carrot"]');let s=await snapshot(page);assert.equal(s.energy,4);assert.equal(s.inventory.seed_carrot,undefined);assert.equal(s.beds.filter(b=>b?.crop==='carrot').length,3);assert.equal(s.beds[1].crop,'pumpkin');
  await page.reload();await page.waitForFunction(()=>window.willowmere?.metrics().ready);await press(page,view,'#begin');assert.equal((await snapshot(page)).beds.filter(b=>b?.crop==='carrot').length,3);
  await tapBed(page,view,1);await page.waitForSelector('[data-field="harvest-all"]');await press(page,view,'[data-field="harvest-all"]');s=await snapshot(page);assert.equal(s.stats.harvests,1);assert.equal(s.inventory.radish,2);assert.equal(s.beds[0],null);assert.equal(s.beds[1].crop,'pumpkin');
  await tapBed(page,view,2);await page.waitForSelector('[data-field="water"]');await press(page,view,'[data-field="water"]');s=await snapshot(page);assert.equal(s.beds[2].watered,true);assert.equal(s.beds[2].crop,'carrot');assert.equal(s.energy,3);
  await press(page,view,'[data-panel="settings"]');await page.waitForSelector('#language-settings');await page.locator('#language-settings').selectOption('vi');await press(page,view,'.close-button');await tapBed(page,view,0);await page.waitForFunction(()=>document.querySelector('[data-field="plant-all"]')?.textContent.includes('Gieo tất cả'));await shot(page,`field-batch-${view}-vietnamese`);
  assert.equal(await page.locator('[data-field="harvest-all"]').isDisabled(),true);assert.equal(await page.locator('[data-field="plant-all"][data-crop="carrot"]').isDisabled(),true);const sizes=await page.locator('.modal-content').evaluate(el=>[el.scrollWidth,el.clientWidth]);assert.ok(sizes[0]<=sizes[1]+1,'field menu fits');await press(page,view,'[data-field="plant-all"][data-crop="tulip"]');s=await snapshot(page);assert.equal(s.energy,1);assert.equal(s.beds.filter(b=>b?.crop==='tulip').length,1);assert.deepEqual(errors,[]);results.push({view,worldTap:true,seedLimit:true,energyLimit:true,harvest:true,watering:true,reload:true,vietnamese:true});
 }finally{await context.close();}
}}finally{await save('field-batch-browser',results);await browser.close();}console.log(JSON.stringify(results));
