// Focused integration checks for the remaining-work code review: import isolation,
// a live hooked fish across quality changes, arrival notices and phone visibility.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { launch, open, begin, clearSpot } from './travel-kit.mjs';
import { freshState } from '../src/game.mjs';
import { POND } from '../src/content.mjs';
import { landFish } from './fishing-controls.mjs';
const browser=await launch(),results=[],errors=[];
const upload=(page,state)=>page.locator('#import-file').setInputFiles({name:'review-save.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(state))});
try {
  for(const view of ['desktop','phone']) {
    const {page,context,errors:e}=await open(browser,view,s=>{s.settings.test=true;s.coins=700;s.stats.sales=999;s.riding='jeep';s.position={x:0,z:19};s.vehicles.jeep={x:0,z:19,rot:0};});errors.push(e);
    await page.evaluate(()=>willowmere.test.open('settings'));
    const next=freshState();next.started=true;next.settings.test=true;next.coins=3210;next.inventory.guardian=2;next.stats.sales=999;next.bike=true;next.riding='bike';next.heading=.6;next.position={x:8,z:18};next.vehicles.bike={x:8,z:18,rot:.6};
    page.once('dialog',d=>d.dismiss());await upload(page,next);await page.waitForTimeout(100);
    assert.equal((await page.evaluate(()=>willowmere.snapshot())).coins,700,'cancel leaves current story alone');
    assert.equal(await page.locator('#import-file').inputValue(),'','cancel permits choosing the same file again');
    await page.evaluate(()=>{window.__setItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new Error('storage blocked for test');};});
    page.once('dialog',d=>d.accept());await upload(page,next);
    await page.waitForFunction(()=>document.getElementById('toast').textContent.includes('current story is unchanged'));
    assert.equal((await page.evaluate(()=>willowmere.snapshot())).coins,700,'failed storage preserves active state');
    await page.evaluate(()=>{Storage.prototype.setItem=window.__setItem;window.__previousGame=true;});
    page.once('dialog',d=>d.accept());await upload(page,next);
    await page.waitForFunction(()=>!window.__previousGame&&window.willowmere?.metrics().ready,null,{timeout:120000});
    const state=await page.evaluate(()=>willowmere.snapshot()),m=await page.evaluate(()=>willowmere.metrics());
    assert.equal(state.coins,3210);assert.equal(state.inventory.guardian,2);assert.equal(m.riding,'bike');
    assert.ok(Math.hypot(m.position.x-8,m.position.z-18)<1,'import keeps the saved vehicle and location');
    await begin(page,view);results.push({view,import:'cancel, failed storage, clean reload, vehicle and progress passed'});await context.close();
  }
  {
    const {page,context,errors:e}=await open(browser,'desktop',s=>{s.position={x:POND.x+1,z:POND.z-POND.d/2-.9};s.upgrades.pond=2;});errors.push(e);
    await page.waitForFunction(()=>willowmere.metrics().pond?.ready&&willowmere.project);
    const at=await page.evaluate(([x,z])=>willowmere.project(x,z,.3),[POND.x+2.5,POND.z-POND.d/2+3.2]);await page.mouse.click(at.x,at.y);
    await page.waitForFunction(()=>willowmere.metrics().fishing.phase==='bite',null,{timeout:45000,polling:30});
    await page.keyboard.down('Space');await page.waitForFunction(()=>willowmere.metrics().fishing.phase==='hooked');await page.keyboard.up('Space');
    const before=await page.evaluate(()=>willowmere.metrics().pond.suitor);assert.ok(before);
    await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>willowmere.metrics().pond.light);
    let after=await page.evaluate(()=>willowmere.metrics().pond);assert.equal(after.n,5);assert.equal(after.suitor.id,before.id);assert.equal(after.suitor.species,before.species);
    assert.ok(Math.hypot(after.suitor.x-before.x,after.suitor.z-before.z)<2,'quality change does not teleport the fish');
    await page.setViewportSize({width:1440,height:900});await page.waitForFunction(()=>!willowmere.metrics().pond.light);
    after=await page.evaluate(()=>willowmere.metrics().pond);assert.equal(after.n,8);assert.equal(after.suitor.id,before.id);
    await landFish(page);assert.equal((await page.evaluate(()=>willowmere.snapshot())).stats.fish,1);
    results.push({pond:'same hooked fish across both quality changes, caught successfully'});await context.close();
  }
  {
    const {page,context,errors:e}=await open(browser,'phone',s=>{s.position=clearSpot(-20,270);s.pandora=true;s.pandoraSeen=true;s.settings.test=true;});errors.push(e);
    assert.match(await page.locator('#toast').textContent(),/Back in Ember Fields/);await page.waitForTimeout(1200);
    assert.match(await page.locator('#toast').textContent(),/Back in Ember Fields/);
    results.push({arrival:'Ember Fields greeting survives initial weather notification'});await context.close();
  }
  {
    const {page,context,errors:e}=await open(browser,'phone',s=>{s.position=clearSpot(250,0);});errors.push(e);
    await page.waitForFunction(()=>willowmere.lands?.().night>.9);
    const night=await page.evaluate(()=>({land:willowmere.lands(),mask:document.getElementById('night-layer').style.maskImage}));
    assert.ok(night.land.opacity<=.84);assert.ok(night.land.holes>0);assert.match(night.mask,/radial-gradient/);
    await page.screenshot({path:'test-results/review-night-phone.png'});results.push({night:night.land});await context.close();
  }
  assert.deepEqual(errors.flat(),[]);console.log(JSON.stringify(results));console.log('remaining-work review browser: ok');
} finally {await writeFile('test-results/review-browser.json',JSON.stringify({results,errors},null,2));await browser.close();}
