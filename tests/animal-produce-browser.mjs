import assert from 'node:assert/strict';
import { launch, open, shot, save, begin } from './travel-kit.mjs';

const browser = await launch(), results = [];
try {
  for (const view of process.env.VIEW ? [process.env.VIEW] : ['desktop', 'phone']) {
    const { page, context, errors } = await open(browser, view, s => {
      s.upgrades.pen = 3; s.position = { x: 12.9, z: -14.3 }; s.time = 21.5; s.settings.light = 'day';
    }, { quality: view === 'phone' ? 'battery' : 'high' });
    await page.waitForFunction(() => willowmere.render().pen.produce?.loaded, null, { timeout: 60000 });
    assert.equal((await page.evaluate(() => willowmere.render().pen.produce)).shown, 0);
    await page.keyboard.press('e');
    await page.waitForFunction(() => willowmere.render().pen.produce.shown === 5);
    const ready = await page.evaluate(() => willowmere.render().pen.produce);
    assert.equal(ready.draws, 4); assert.deepEqual(ready.products.map(p => p.product).sort(), ['duck_egg', 'egg', 'egg', 'milk', 'truffle']);
    await shot(page, `produce-${view}-ready`);
    await page.reload(); await begin(page, view);
    await page.waitForFunction(() => willowmere.render().pen.produce?.loaded && willowmere.render().pen.produce.shown === 5);
    const area = await page.evaluate(() => {
      const w = willowmere.crops().world; w.scene.updateMatrixWorld(true);
      const points = [[9,-25],[15,-25],[21,-25],[9,-21],[15,-21],[21,-21],[20,-17]];
      const hits = points.map(([x,z]) => { const p=w.project(x,z,.2); w.pointer.set(p.x/innerWidth*2-1,1-p.y/innerHeight*2); w.raycast.setFromCamera(w.pointer,w.camera); return {x,z,type:w.raycast.intersectObjects(w.activeTargets().map(t=>t.hit),false)[0]?.object.userData.target.type}; });
      const feed = w.targets.find(t=>t.type==='feed'), p=w.project(feed.x,feed.z,1.1);w.pointer.set(p.x/innerWidth*2-1,1-p.y/innerHeight*2);w.raycast.setFromCamera(w.pointer,w.camera);
      return {hits,feed:w.raycast.intersectObjects(w.activeTargets().map(t=>t.hit),false)[0]?.object.userData.target.type,tap:w.project(20,-21,.2)};
    });
    for(const hit of area.hits)assert.equal(hit.type,'collect',view+' pen tap '+JSON.stringify(hit));
    assert.equal(area.feed,'feed','feeding trough remains separately clickable');
    const basket = area.tap;
    if (view === 'phone') await page.touchscreen.tap(basket.x, basket.y); else await page.mouse.click(basket.x, basket.y);
    await page.waitForFunction(() => willowmere.snapshot().collectedDay === willowmere.snapshot().day, null, { timeout: 30000 });
    await page.waitForTimeout(900);
    const collected = await page.evaluate(() => ({ produce: willowmere.render().pen.produce, inventory: willowmere.snapshot().inventory }));
    assert.equal(collected.produce.shown, 0); assert.equal(collected.produce.draws, 0); assert.equal(collected.inventory.truffle, 1); assert.equal(collected.inventory.egg, 4); assert.equal(collected.inventory.milk, 2);
    await shot(page, `produce-${view}-collected`); assert.deepEqual(errors, []); results.push({ view, ready, collected }); await context.close();
  }
} finally { await browser.close(); }
await save('animal-produce-browser', results); console.log('animal-produce-browser: desktop and phone readiness, reload, collection passed');
