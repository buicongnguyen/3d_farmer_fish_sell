import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {freshState,SAVE_KEY} from '../src/game.mjs';
import {landFish} from './fishing-controls.mjs';
const url=process.env.GAME_URL??'http://127.0.0.1:4173';
const browser=await chromium.launch({channel:process.env.CI?undefined:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
const errors=[],reports=[];await mkdir('test-results',{recursive:true});
async function setup(position,mobile=false){
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:960},isMobile:mobile,hasTouch:mobile});
 const seed=freshState();seed.position=position;if(mobile)seed.settings.quality='battery';
 await context.addInitScript(({seed,key})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(seed));},{seed,key:SAVE_KEY});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});await page.goto(url);await page.waitForFunction(()=>window.willowmere?.metrics().ready,null,{timeout:90000});await page.locator('#begin').click();return{context,page};
}
const metrics=p=>p.evaluate(()=>willowmere.metrics());
try{
 // Each screen direction beyond the old world edge, including diagonals.
 for(const keys of [['w'],['d'],['s'],['a'],['w','d'],['d','s'],['s','a'],['a','w']]){
  const {context,page}=await setup({x:130,z:130});const before=await metrics(page);for(const k of keys)await page.keyboard.down(k);await page.waitForTimeout(500);for(const k of keys)await page.keyboard.up(k);const after=await metrics(page);
  assert.ok(Math.hypot(after.position.x-before.position.x,after.position.z-before.position.z)>1,keys.join('+'));assert.ok(after.homeGuide.visible);assert.equal(after.fields.loadedTiles,25);reports.push({direction:keys.join('+'),position:after.position});await context.close();
 }
 {
  const {context,page}=await setup({x:126,z:126});const before=await metrics(page);await page.keyboard.down('d');await page.waitForTimeout(1400);await page.keyboard.up('d');const after=await metrics(page);assert.ok(after.fields.retiredTiles>before.fields.retiredTiles);assert.equal(after.fields.loadedTiles,25);assert.equal(after.birds.count,14);assert.equal(after.birds.species.length,2);assert.ok(after.geometries-before.geometries<8);await page.screenshot({path:'test-results/fields-desktop.png'});reports.push({streaming:after});await context.close();
 }
 {
  const {context,page}=await setup({x:-1200,z:1800},true);assert.ok(await page.locator('#home-guide').isVisible());assert.match(await page.locator('#home-distance').textContent(),/km/);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.keyboard.down('w');await page.waitForTimeout(350);await page.keyboard.up('w');const before=(await metrics(page)).position;await page.reload();await page.waitForFunction(()=>window.willowmere?.metrics().ready,null,{timeout:90000});const after=await metrics(page);assert.ok(Math.hypot(before.x-after.position.x,before.z-after.position.z)<.6);await page.locator('#begin').tap();await page.screenshot({path:'test-results/fields-mobile.png'});reports.push({farSaveAndMobile:after});await context.close();
 }
 {
  const {context,page}=await setup({x:-21,z:74});await page.locator('#home-guide').click();await page.waitForFunction(()=>willowmere.metrics().homeGuide.distance<1,null,{timeout:45000});assert.equal((await metrics(page)).location,'village');reports.push({walkHome:await metrics(page)});await context.close();
 }
 for(const mobile of [false,true]){
  const {context,page}=await setup({x:11,z:12.2},mobile);assert.ok((await metrics(page)).fishing.equipped);await page.keyboard.press('e');await page.waitForFunction(()=>willowmere.metrics().fishing.line);await page.waitForTimeout(700);assert.ok((await metrics(page)).fishing.float.y<1);await landFish(page,{touch:mobile,screenshot:`test-results/rod-fishing-${mobile?'mobile':'desktop'}.png`});assert.equal((await page.evaluate(()=>willowmere.snapshot())).stats.fish,1);
  await page.waitForTimeout(900);await page.keyboard.press('e');await page.waitForFunction(()=>willowmere.metrics().fishing.line);await page.keyboard.press('Escape');assert.equal((await metrics(page)).fishing.line,false);reports.push({fishing:mobile?'mobile':'desktop',metrics:await metrics(page)});await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile('test-results/fields-results.json',JSON.stringify({url,reports,errors},null,2));console.log(JSON.stringify({url,reports,errors},null,2));
}finally{await browser.close();}
