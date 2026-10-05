import assert from 'node:assert/strict';
import {launch,open,begin,press,shot,snapshot,save} from './travel-kit.mjs';
import {BASE_KEY,PROFILE_KEY,slotKey} from '../src/profiles.mjs';
const browser=await launch(),results=[];
async function pick(page,view,n){
 const nav=page.waitForNavigation();await press(page,view,`#settings-profiles [data-profile-slot="${n}"]`);await nav;await begin(page,view);
}
try{for(const view of process.env.VIEW?[process.env.VIEW]:['desktop','phone','landscape']){
 const {page,context,errors}=await open(browser,view,s=>{s.coins=987;s.day=7;s.settings.sound=false;});
 try{
  await page.waitForSelector('#profile-picker [data-profile-slot="2"]',{state:'attached'});
  assert.equal((await snapshot(page)).coins,987);
  // Existing progress stays in Profile 1 while the other slots start fresh.
  for(const n of [1,2,0]){
   await press(page,view,'[data-panel="settings"]');await page.waitForSelector('#settings-profiles');
   assert.equal(await page.locator('#settings-profiles [data-profile-slot]').count(),3);
   await pick(page,view,n);const s=await snapshot(page);assert.equal(s.coins,n?160:987);assert.equal(s.day,n?1:7);
   assert.equal(await page.evaluate(k=>Number(localStorage.getItem(k)),PROFILE_KEY),n);
  }
  const original=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),BASE_KEY);assert.equal(original.coins,987);assert.equal(original.day,7);
  // Profile 2 purchases and import change Profile 2 alone, including unload/autosave.
  await press(page,view,'[data-panel="settings"]');await pick(page,view,1);
  await press(page,view,'[data-panel="map"]');await press(page,view,'[data-action="find"][data-type="shop"][data-id="market"]');await page.waitForSelector('#modal-title:has-text("village market")',{timeout:45000});await press(page,view,'[data-action="tab"][data-id="seeds"]');await press(page,view,'[data-type="buySeed"][data-id="carrot"]');
  const purchased=await snapshot(page);assert.equal(purchased.coins,142);await press(page,view,'.close-button');
  await press(page,view,'[data-panel="settings"]');const download=page.waitForEvent('download');await press(page,view,'[data-action="export"]');assert.match((await download).suggestedFilename(),/profile-2/);
  page.once('dialog',d=>d.accept());const imported={...purchased,coins:555};
  const reload=page.waitForNavigation();await page.locator('#import-file').setInputFiles({name:'profile.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(imported))});await reload;await begin(page,view);assert.equal((await snapshot(page)).coins,555);
  await page.reload();await page.waitForSelector('#profile-picker [data-profile-slot="1"]');
  const cards=await page.locator('#profile-picker').boundingBox(),button=await page.locator('#begin').boundingBox();assert.ok(cards&&button&&cards.y>=0&&button.y+button.height<=page.viewportSize().height,'profile selector and Begin remain accessible');
  await shot(page,`profiles-${view}-welcome`);await begin(page,view);
  const stored=await page.evaluate(keys=>keys.map(k=>JSON.parse(localStorage.getItem(k)).coins),[0,1,2].map(slotKey));assert.deepEqual(stored,[987,555,160]);
  assert.deepEqual(errors,[]);results.push({view,stored,legacyPreserved:true,independent:true,importExport:true});
 }catch(e){await shot(page,`profiles-${view}-failure`).catch(()=>{});throw e;}finally{await context.close();}
}}finally{await save('profiles-browser',results);await browser.close();}
console.log(JSON.stringify(results));
