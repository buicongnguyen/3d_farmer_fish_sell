import assert from 'node:assert/strict';
import {launch,open,begin,snapshot,shot,save} from './travel-kit.mjs';
import {outpostNear,inWorld,DENS,REGION} from '../src/regions.mjs';
import {fieldBlocked} from '../src/field-layout.mjs';
const browser=await launch(),results=[];
try{
 for(const [name,x,z,ride]of [['home',0,-4,''],['old-den',227,-185,''],['outside',300,-250,''],['west',-400,60,''],['jeep',250,200,'jeep'],['bike',-300,-120,'bike'],['pond',-41.5,82.5,'']]){
  const {page,context,errors}=await open(browser,'phone',s=>{delete s.layout;delete s.layoutMoved;s.settings.test=true;s.coins=321;s.inventory={carrot:7};s.position={x,z};s.riding=ride;s.bike=true;s.stats.sales=500;if(ride)s.vehicles[ride]={x,z,rot:1};});
  try{const s=await snapshot(page);assert.equal(s.layout,2);assert.equal(s.coins,321);assert.equal(s.inventory.carrot,7);assert.ok(inWorld(s.position.x,s.position.z,2));if(name==='home')assert.deepEqual(s.position,{x,z});else{assert.equal(s.riding,'');assert.ok(outpostNear(s.position.x,s.position.z,5));assert.ok(!fieldBlocked(s.position.x,s.position.z,.6));}
   if(ride){const v=s.vehicles[ride];assert.ok(v&&outpostNear(v.x,v.z,10));assert.ok(!fieldBlocked(v.x,v.z,2.4),'migrated vehicle has room');}
   const collision=await page.evaluate(()=>{const w=willowmere.crops().world;return w.blocked(w.player.position.x,w.player.position.z);});assert.equal(collision,false,'migrated player can walk');
   await page.reload();await begin(page,'phone');const again=await snapshot(page);assert.ok(Math.hypot(again.position.x-s.position.x,again.position.z-s.position.z)<.1,'migration only runs once');assert.deepEqual(errors,[]);results.push({name,position:s.position,ride});
  }finally{await context.close();}
 }
 // Every den stays in its named sector and appears at its relocated position.
 const {page,context,errors}=await open(browser,'phone',s=>{s.pandora=true;s.settings.test=true;});
 try{await page.waitForFunction(()=>!!willowmere.test?.invulnerable);await page.evaluate(()=>willowmere.test.invulnerable(true));await page.waitForFunction(()=>willowmere.regions()?.border?.triangles===5768);assert.equal(await page.evaluate(()=>willowmere.regions().border.visible),true);for(const den of DENS){await page.evaluate(d=>{const w=willowmere.crops().world;w.player.position.set(d.x-7,0,d.z+6);w.follow.copy(w.player.position);w.state.position={x:d.x-7,z:d.z+6};if(d.event==='dragon')willowmere.test.lavaEvent('dragon');},den);await page.waitForTimeout(600);const row=await page.evaluate(id=>willowmere.metrics().dens.find(d=>d.id===id),den.id);assert.ok(row,'den available '+den.id);await page.waitForFunction(id=>!!willowmere.wilds().creatures.find(c=>c.id===id),den.id);if(['bear','treant','croc','mushking','yeti','mammoth'].includes(den.type))await page.waitForFunction(id=>!willowmere.wilds().creatures.find(c=>c.id===id)?.standIn,den.id,{timeout:60000});assert.ok(inWorld(den.x,den.z,2));results.push({den:den.id,region:REGION[den.region].name});}await shot(page,'ring-den-phone');assert.deepEqual(errors,[]);}finally{await context.close();}
}finally{await browser.close();}await save('ring-integration-browser',results);console.log(JSON.stringify(results));
