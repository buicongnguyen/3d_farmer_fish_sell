import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../package.json',import.meta.url)),{chromium}=require('playwright');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']});
try{const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:43987');await page.waitForFunction(()=>window.willowmere?.metrics().ready&&window.__perf?.world?.ready);await page.locator('#begin').click();await page.evaluate(()=>__perf.stop());await page.waitForTimeout(100);const result=await page.evaluate(async()=>{
 const w=__perf.world,fx=w.pandora.fx;await fx.load();const results=[];for(const pool of [fx.chips,fx.sparks]){
  pool.emit(0,2,0,1,2,0,1,.12,'#ff4400',0);pool.emit(1,2,0,0,1,0,.01,.2,'#66ccff',0);pool.update(.02,w.camera,w.player.position);
  const count=pool.count,visible=pool.mesh.visible,color=Array.from(pool.mesh.instanceColor.array.slice(0,3)),before=pool.mesh.instanceMatrix.version;pool.update(0,w.camera,w.player.position);const unchanged=pool.mesh.instanceMatrix.version===before;
  pool.mesh.visible=false;pool.update(.1,w.camera,w.player.position);const pending=pool.mesh.instanceMatrix.updateRanges.map(r=>({...r}));pool.update(2,w.camera,w.player.position);const empty=pool.mesh.instanceMatrix.version;for(let i=0;i<20;i++)pool.update(.1,w.camera,w.player.position);const idleStable=pool.mesh.instanceMatrix.version===empty;
  pool.emit(2,2,1,1,1,0,1,.2,'#88ff99',0);pool.update(.01,w.camera,w.player.position);results.push({count,visible,unchanged,pending,idleStable,reappeared:pool.mesh.visible&&pool.mesh.count===1,color});
 }let arrived=0;fx.sparks.count=0;fx.sparks.emit(w.player.position.x,1,w.player.position.z,0,0,0,.2,.2,'#ffffff',0,.001,()=>arrived++);fx.sparks.update(.1,w.camera,w.player.position);return{results,arrived};
 });for(const r of result.results){assert.equal(r.count,1);assert.equal(r.visible,true);assert.equal(r.unchanged,true);assert.ok(r.pending.length===1);assert.equal(r.idleStable,true);assert.equal(r.reappeared,true);}assert.equal(result.arrived,1);assert.deepEqual(errors,[]);await fs.writeFile('results/combat.json',JSON.stringify({result,errors},null,2));console.log(JSON.stringify({result,errors}));}finally{await browser.close();}
