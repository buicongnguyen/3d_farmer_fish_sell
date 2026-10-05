// GAME_URL=http://127.0.0.1:<port> GPU=1 node tests/hired-villagers-browser.mjs
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { launch, open, press, snapshot } from './travel-kit.mjs';
import { RESIDENTS, JOBS } from '../src/content.mjs';
const out = 'test-results/hired-villagers', results = [], errors = [];
await mkdir(out, { recursive: true });
const browser = await launch();
const hired = { oren: 'farmhand', ellis: 'fisher', mara: 'herder', iris: 'gardener', ash: 'picker', theo: 'fisher', finn: 'fisher', bea: 'fisher' };
const read = page => page.evaluate(() => willowmere.villagers());
try {
  for (const view of ['desktop', 'phone']) {
    const { page, context, errors: e } = await open(browser, view, s => {
      s.position = { x: 0, z: 17 }; s.time = 10; s.hired = { ...hired }; s.coins = 5000; s.settings.test = true;
      s.met = Object.fromEntries(RESIDENTS.map(p => [p.id, true]));
    }, { quality: view === 'phone' ? 'battery' : 'high' });
    errors.push(e);
    try {
      await page.waitForFunction(ids => typeof willowmere.villagers === 'function' && ids.every(id => willowmere.villagers().npcs.find(n => n.id === id)?.working), Object.keys(hired), { timeout: 30000 });
      const start = await read(page);
      for (const [id, job] of Object.entries(hired)) {
        const n = start.npcs.find(n => n.id === id);
        assert.equal(n.inside, false); assert.equal(n.where, 'job:' + job); assert.equal(n.trip, ''); assert.equal(n.stuck, false);
      }
      const fishers = start.npcs.filter(n => hired[n.id] === 'fisher');
      for (let i = 0; i < fishers.length; i++) for (let j = i + 1; j < fishers.length; j++) assert.ok(Math.hypot(fishers[i].x - fishers[j].x, fishers[i].z - fishers[j].z) > 1.7, 'hired fishers have separate stations');
      await page.waitForTimeout(1200); await page.screenshot({ path: `${out}/${view}-working.png` });
      results.push({ view, check: 'eight saved hires attend all five workplaces', workers: start.npcs.filter(n => hired[n.id]) });
      if (view === 'desktop') {
        const visitor = await page.waitForFunction(eligible => {
          const s = willowmere.snapshot(); return willowmere.villagers().npcs.find(n => n.trip && !s.hired[n.id] && eligible.includes(n.id))?.id;
        }, RESIDENTS.filter(p => !p.child && p.home > 0).map(p => p.id), { timeout: 30000 });
        const id = await visitor.jsonValue(), coins = (await snapshot(page)).coins;
        await page.evaluate(() => willowmere.test.open('workers'));
        await press(page, view, `[data-action="hire"][data-person="${id}"][data-id="farmhand"]`);
        assert.equal((await snapshot(page)).coins, coins - JOBS.farmhand.wage);
        await page.keyboard.press('Escape');
        await page.waitForFunction(id => { const n = willowmere.villagers().npcs.find(n => n.id === id); return n.where === 'job:farmhand' && !n.trip; }, id);
        await page.waitForFunction(id => willowmere.villagers().npcs.find(n => n.id === id).working, id, { timeout: 90000 });
        assert.equal((await read(page)).npcs.find(n => n.id === id).inside, false);
        await page.evaluate(() => willowmere.test.open('workers'));
        await press(page, view, `[data-type="release"][data-id="${id}"]`); await page.keyboard.press('Escape');
        await page.waitForFunction(id => { const n = willowmere.villagers().npcs.find(n => n.id === id); return !n.where.startsWith('job:') && !n.working; }, id);
        results.push({ view, check: 'hire interrupts a stroll, walks to the new job, dismissal restores routine', id });
      }
    } catch (error) { await page.screenshot({ path: `${out}/${view}-failure.png` }).catch(() => {}); throw error; }
    finally { await context.close(); }
  }
  {
    const { page, context, errors: e } = await open(browser, 'phone', s => { s.position = { x: 5.5, z: 32 }; s.time = 12; }, { quality: 'battery' });
    errors.push(e);
    try {
      await page.waitForFunction(() => typeof willowmere.villagers === 'function');
      const first = await read(page), shoppers = first.npcs.filter(n => n.place === 'market' && !n.inside);
      assert.ok(shoppers.length >= 5, 'reproduce the five shoppers at midday on a phone');
      await page.screenshot({ path: `${out}/phone-market-start.png` });
      const samples = [];
      for (let i = 0; i < 35; i++) { await page.waitForTimeout(1000); samples.push(await read(page)); }
      const last = samples.at(-1), departed = shoppers.filter(n => samples.some(s => { const now = s.npcs.find(q => q.id === n.id); return now.inside || Math.hypot(now.x - n.x, now.z - n.z) > 4; }));
      assert.ok(departed.length >= 3, `at least three shoppers continue their routines (${departed.map(n => n.id)})`);
      assert.ok(!last.npcs.some(n => n.stuck), 'no villager ends inside static scenery');
      await page.screenshot({ path: `${out}/phone-market-later.png` });
      results.push({ view: 'phone', check: 'market shoppers leave naturally', shoppers: shoppers.map(n => n.id), departed: departed.map(n => n.id), samples });
    } finally { await context.close(); }
  }
  assert.deepEqual(errors.flat(), []); console.log(JSON.stringify(results.map(({ samples, ...r }) => r))); console.log('hired villagers browser: ok');
} finally { await writeFile(`${out}/results.json`, JSON.stringify({ results, errors }, null, 2)); await browser.close(); }
