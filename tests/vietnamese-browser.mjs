import assert from 'node:assert/strict';
import {launch,open,press,begin,shot,snapshot,save} from './travel-kit.mjs';
import {PROFILE_KEY,slotKey} from '../src/profiles.mjs';
const browser=await launch(),results=[],text=[];
try{for(const view of process.env.VIEW?[process.env.VIEW]:['desktop','phone','landscape']){
 const {page,context,errors}=await open(browser,view,s=>{s.coins=2000;s.day=7;s.settings.test=true;s.inventory={carrot:3,wood:5,obsidian:2};},{quality:view==='desktop'?'high':'battery'});
 try{
  await page.waitForSelector('#language-welcome',{state:'attached'});await press(page,view,'[data-panel="settings"]');await page.waitForSelector('#language-settings');
  await page.evaluate(()=>{window.__signText=[];const original=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,...args){if(this.canvas.width===512&&this.canvas.height===100)__signText.push(text);return original.call(this,text,...args);};});
  const before=await snapshot(page);await page.locator('#language-settings').selectOption('vi');await page.waitForFunction(()=>document.documentElement.lang==='vi'&&document.getElementById('modal-title').textContent==='Theo cách bạn thích');
  assert.ok(await page.evaluate(()=>__signText.includes('NHÀ · TRƯỞNG LÀNG')),'canvas village signs translated');
  assert.match(await page.locator('#settings-profiles').innerText(),/Hồ sơ 1/);assert.equal((await snapshot(page)).coins,before.coins);assert.equal((await snapshot(page)).day,before.day);
  await shot(page,`vietnamese-${view}-settings`);await press(page,view,'.close-button');
  for(const [id,tabs,title] of [['market',['seeds','sell','upgrades','outfits','kids','furniture'],'Chợ làng'],['clothes',['outfits','gear','kids'],'Tiệm may Finch'],['upgrades',['upgrades','crafting','furniture'],'Xưởng Vale'],['supermarket',['sell','seeds'],'Siêu thị Willowmere']]){
   await page.waitForFunction(()=>!!willowmere.test?.open);await page.evaluate(id=>willowmere.test.open('shop',id),id);await page.waitForFunction(title=>document.getElementById('modal-title').textContent===title,title);
   for(const tab of tabs){await press(page,view,`[data-action="tab"][data-id="${tab}"]`);if(tab==='crafting')await page.waitForSelector('[data-recipe]');await page.waitForTimeout(100);
    const sizes=await page.locator('#modal .modal-content').evaluate(el=>[el.scrollWidth,el.clientWidth]);assert.ok(sizes[0]<=sizes[1]+1,`${view}/${id}/${tab}: Vietnamese fits`);
    text.push({view,id,tab,text:await page.locator('#modal').innerText()});
   }
   await shot(page,`vietnamese-${view}-${id}`);await press(page,view,'.close-button');
  }
  await page.evaluate(()=>willowmere.test.open('shop','market'));await press(page,view,'[data-action="tab"][data-id="seeds"]');await press(page,view,'[data-type="buySeed"][data-id="carrot"]');assert.equal((await snapshot(page)).coins,1982);await press(page,view,'.close-button');
  for(const panel of ['bag','journal','people','map','help']){if(panel==='help')await page.evaluate(()=>willowmere.test.open('help'));else await press(page,view,`.top-actions [data-panel="${panel}"]`);await page.waitForTimeout(300);text.push({view,panel,text:await page.locator('#modal').innerText()});await press(page,view,'.close-button');}
  for(const [p,a,expected]of [['grove','orchard:0','VƯỜN CÂY ĂN QUẢ GIA ĐÌNH'],['civic','school','+ xu'],['civic','hospital','Mỗi ngày một lần'],['pandora',undefined,'Mũ, quần áo và vũ khí chỉ để làm đẹp.']]){await page.evaluate(([p,a])=>willowmere.test.open(p,a),[p,a]);await page.waitForTimeout(250);assert.ok((await page.locator('#modal').innerText()).includes(expected),p+' translated');await press(page,view,'.close-button');}
  await press(page,view,'[data-panel="settings"]');await page.locator('#language-settings').selectOption('en');await page.waitForFunction(()=>document.getElementById('modal-title').textContent==='Just the way you like it');assert.equal(await page.locator('#language-settings').inputValue(),'en');assert.ok(await page.evaluate(()=>__signText.includes('HOME · VILLAGE LEADER')),'canvas signs restore English');
  await page.locator('#language-settings').selectOption('vi');await press(page,view,'.close-button');await page.reload();await page.waitForSelector('#language-welcome');assert.equal(await page.locator('#language-welcome').inputValue(),'vi');
  await page.locator('#profile-picker [data-profile-slot="1"]').scrollIntoViewIfNeeded();await shot(page,`vietnamese-${view}-welcome`);
  const nav=page.waitForNavigation();await press(page,view,'#profile-picker [data-profile-slot="1"]');await nav;await begin(page,view);assert.equal((await snapshot(page)).coins,160);assert.equal(await page.evaluate(()=>document.documentElement.lang),'vi');assert.equal(await page.evaluate(k=>localStorage.getItem(k),PROFILE_KEY),'1');
  assert.equal(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).coins,slotKey(0)),1982);assert.deepEqual(errors,[]);results.push({view,languageSwitch:true,reload:true,profileIsolation:true,purchase:true});
 }catch(e){await shot(page,`vietnamese-${view}-failure`).catch(()=>{});throw e;}finally{await context.close();}
}}finally{await save('vietnamese-browser',{results,text});await browser.close();}
console.log(JSON.stringify(results));
