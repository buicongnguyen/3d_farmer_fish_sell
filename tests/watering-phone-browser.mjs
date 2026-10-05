// Finger watering must keep the same bed and crop, without shrinking a tiny phone sprout away.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {launch,open,snapshot} from './travel-kit.mjs';
import {BED_POSITIONS} from '../src/content.mjs';
import {act} from '../src/game.mjs';
const out='test-results/watering-phone';await mkdir(out,{recursive:true});
const browser=await launch(),rows=[];
try{for(const view of ['phone','landscape']){
 const {page,context,errors}=await open(browser,view,s=>{s.position={x:BED_POSITIONS[0].x,z:BED_POSITIONS[0].z+1};act(s,'plant',{index:0,crop:'carrot'});act(s,'plant',{index:1,crop:'radish'});},{quality:'balanced'});
 try{
  await page.waitForFunction(()=>willowmere.crops()?.liveN===2);
  await page.screenshot({path:`${out}/${view}-before.png`});
  await page.evaluate(()=>{const c=willowmere.crops();window.__waterFrames=[];const watch=()=>{window.__waterFrames.push({watered:willowmere.snapshot().beds[0]?.watered,scale:c.fx[0],stage:c.beds[0].stage,count:c.liveN});if(window.__waterFrames.length<180)requestAnimationFrame(watch);};requestAnimationFrame(watch);});
  const box=await page.locator('#touch-action').boundingBox();await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);
  await page.waitForSelector('[data-field="water"]');await page.locator('[data-field="water"]').tap();
  await page.waitForFunction(()=>willowmere.snapshot().beds[0]?.watered);
  await page.waitForTimeout(100);await page.screenshot({path:`${out}/${view}-watered.png`});
  await page.waitForTimeout(650);
  const s=await snapshot(page),frames=await page.evaluate(()=>window.__waterFrames.filter(f=>f.watered));
  assert.ok(frames.length>0);assert.ok(frames.every(f=>f.count===2&&f.scale>=1));assert.equal(s.beds[0].crop,'carrot');assert.equal(s.beds[1].watered,false);assert.equal(s.stats.harvests,0);assert.deepEqual(errors,[]);
  const row={view,frames:frames.length,minScale:Math.min(...frames.map(f=>f.scale)),crop:s.beds[0].crop,neighbour:s.beds[1].crop};rows.push(row);console.log(JSON.stringify(row));
 }finally{await context.close();}
}}finally{await browser.close();await writeFile(`${out}/results.json`,JSON.stringify(rows,null,2));}
