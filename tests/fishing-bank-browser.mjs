// Real catches stay on the grass until departure, survive a reload, and transfer once.
// GAME_URL=http://127.0.0.1:<port> GPU=1 node tests/fishing-bank-browser.mjs
// HINTS_ONLY=1 checks the family/outdoor hint rendering without repeating catch interactions.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { launch, open, begin, press, holdStick, metrics, snapshot } from './travel-kit.mjs';
import { landFish } from './fishing-controls.mjs';
import { POND } from '../src/content.mjs';
import { FISH_POOLS } from '../src/pond.mjs';
import { FEATURES } from '../src/land-features.mjs';

const out = 'test-results/fishing-bank', results = [], errors = [];
await mkdir(out, { recursive: true });
const browser = await launch();
const at = { x: POND.x + 1, z: POND.z - POND.d / 2 - .9 };
const count = bank => Object.values(bank?.fish ?? {}).reduce((n, v) => n + v, 0);
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const log = row => { results.push(row); console.log(JSON.stringify(row)); };
const groundPositions = pond => pond.bankFish.map(({ species, x, z, slot }) => ({ species, x, z, slot }));

async function fingerFor(page, context, view) {
  if (view === 'desktop') return { input: false, close: async () => {} };
  const cdp = await context.newCDPSession(page);
  return {
    input: {
      down: (x, y) => cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: Math.round(x), y: Math.round(y), id: 1 }] }),
      up: () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }),
    },
    close: () => cdp.detach().catch(() => {}),
  };
}

async function cast(page, view) {
  const recast = await page.locator('#reel-button').evaluate(b => !b.hidden && b.classList.contains('cast'));
  if (recast || view === 'phone') {
    const box=await page.locator(recast?'#reel-button':'#touch-action').boundingBox();
    assert.ok(box); // ACT pulses continuously; a finger does not wait for its animation to become stable.
    if(view==='phone')await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);
    else await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
  }
  else await page.keyboard.press('e');
  await page.waitForFunction(() => willowmere.metrics().fishing.line, null, { timeout: 5000 });
}

async function walk(page, context, view, until, argument) {
  const stick = view === 'phone' ? await holdStick(page, context, 0, -1) : null;
  if (!stick) await page.keyboard.down('w');
  try { await page.waitForFunction(until, argument, { timeout: 10000, polling: 'raf' }); }
  finally { if (stick) await stick.release(); else await page.keyboard.up('w'); }
}

try {
  for (const view of (process.env.VIEW?[process.env.VIEW]:['desktop', 'phone'])) {
    const { page, context, errors: pageErrors } = await open(browser, view, s => {
      s.position = { ...at }; s.upgrades.pond = 3; s.inventory.golden = 2; s.inventory.carp = 1;
    }, { quality: view === 'phone' ? 'battery' : 'high' });
    errors.push(pageErrors);
    const finger = await fingerFor(page, context, view);
    try {
      await page.waitForFunction(() => willowmere.metrics().pond?.ready, null, { timeout: 30000 });
      await page.evaluate(() => {
        window.__ringChecks={levels:[],errors:[]};
        const watch=()=>{const b=document.querySelector('#reel-button'),f=willowmere.metrics().fishing,c=window.__ringChecks;
          if(f.phase==='hooked') {const want=f.tension<.5?'safe':f.tension<.8?'rising':'danger';
            if(!c.levels.includes(want))c.levels.push(want);
            if(b.dataset.tension!==want||!b.classList.contains('hooked'))c.errors.push({want,actual:b.dataset.tension});
            const pct=parseFloat(b.style.getPropertyValue('--tension'));if(Math.abs(pct-f.tension*100)>1)c.errors.push({pct,tension:f.tension});
          }requestAnimationFrame(watch);};requestAnimationFrame(watch);
      });
      await page.waitForTimeout(700); // Let the colored fish finish growing in before comparing hints.
      await page.waitForFunction(() => willowmere.metrics().pond?.deepShown > 0, null, { timeout: 5000 });
      const initial = await snapshot(page), initialPond = (await metrics(page)).pond;
      assert.ok(initialPond.deepShadows > 0, `${view}: deep fish have shadow hints`);
      assert.ok(initialPond.deepShown > 0 && initialPond.deepShown <= initialPond.deepShadows, `${view}: unobstructed deep fish retain hints`);
      assert.equal(initialPond.shadows, initialPond.deepShown, `${view}: visible colored fish do not receive duplicate hints`);
      await page.screenshot({ path: `${out}/${view}-deep-fish.png` });
      log({ view, check: 'deep fish hints without colored-fish overlays', deep: initialPond.deepShadows, deepShown: initialPond.deepShown, shadows: initialPond.shadows });
      if (process.env.HINTS_ONLY === '1') continue;

      // A failed landing is ordinary gameplay. Try a bounded number of genuine casts to land two fish.
      let attempts = 0;
      while ((await snapshot(page)).stats.fish < initial.stats.fish + 2 && attempts++ < 6) {
        await cast(page, view); await landFish(page, { touch: finger.input, releaseAt:attempts===1?.86:.7 });
        const caught = await snapshot(page), total = caught.stats.fish - initial.stats.fish;
        assert.deepEqual(caught.inventory, initial.inventory, `${view}: a landed fish does not enter the bag yet`);
        assert.equal(count(caught.bankCatch), total, `${view}: every landed fish is held on the bank`);
        for (const id of Object.keys(caught.bankCatch?.fish ?? {})) {
          assert.ok(FISH_POOLS[3].includes(id), `${view}: a catch belongs to the current pond tier`);
          assert.equal(caught.found[id], 1, `${view}: catching immediately records the species`);
        }
        if (total) await page.waitForFunction(n => willowmere.metrics().pond.bankShown === n && !willowmere.metrics().fishing.landing, total, { timeout: 5000 });
        log({ view, check: 'cast completed', attempt: attempts, catches: total, held: caught.bankCatch?.fish ?? {} });
      }
      let state = await snapshot(page);
      assert.equal(state.stats.fish, initial.stats.fish + 2, `${view}: two fish landed through the Reel control`);
      assert.equal(count(state.bankCatch), 2);
      const ring=await page.evaluate(()=>window.__ringChecks);assert.deepEqual(ring.errors,[]);assert.ok(ring.levels.includes('safe'));assert.ok(ring.levels.includes('rising'));assert.ok(ring.levels.includes('danger'));log({view,check:'live tension ring',levels:ring.levels});
      const bank = structuredClone(state.bankCatch), pond = (await metrics(page)).pond;
      assert.equal(pond.bankTotal, 2); assert.equal(pond.bankShown, 2); assert.equal(pond.bankFish.length, 2);
      for (const fish of pond.bankFish) {
        assert.ok(distance(fish, bank) < 3, `${view}: the fish lies beside the fishing position`);
        assert.ok(Math.abs(fish.x - POND.x) > POND.w / 2 || Math.abs(fish.z - POND.z) > POND.d / 2, `${view}: the catch is on land`);
      }
      const placed = groundPositions(pond);
      await page.screenshot({ path: `${out}/${view}-two-catches.png` });

      // Panels and packing the rod are not departure from this fishing position.
      await press(page, view, '[data-action="open"][data-panel="bag"]');
      await page.waitForFunction(() => !document.querySelector('#modal-backdrop').hidden);
      assert.deepEqual((await snapshot(page)).bankCatch, bank, `${view}: opening the basket leaves fish on the grass`);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.querySelector('#modal-backdrop').hidden);
      await cast(page, view); await page.keyboard.press('Escape');
      await page.waitForFunction(() => !willowmere.metrics().fishing.line);
      assert.deepEqual((await snapshot(page)).bankCatch, bank, `${view}: cancelling the next cast keeps earlier catches`);
      assert.deepEqual((await snapshot(page)).inventory, initial.inventory);

      await page.reload(); await begin(page, view);
      await page.waitForFunction(() => willowmere.metrics().pond?.bankShown === 2, null, { timeout: 30000 });
      state = await snapshot(page);
      assert.deepEqual(state.bankCatch, bank, `${view}: reloading at the same spot preserves all catches`);
      assert.deepEqual(state.inventory, initial.inventory);
      assert.deepEqual(groundPositions((await metrics(page)).pond), placed, `${view}: the saved fish return to the same grass positions`);
      await page.screenshot({ path: `${out}/${view}-reloaded-catches.png` });
      log({ view, check: 'panel, Escape and reload preserve the pile', held: bank.fish });

      await walk(page, context, view, origin => {
        const p = willowmere.metrics().position; return Math.hypot(p.x - origin.x, p.z - origin.z) > .55;
      }, bank);
      assert.ok(distance((await metrics(page)).position, bank) < 2.5, `${view}: this was only a small step`);
      assert.deepEqual((await snapshot(page)).bankCatch, bank, `${view}: a small step leaves the catch on the grass`);
      await walk(page, context, view, () => willowmere.snapshot().bankCatch === null);
      await page.waitForFunction(() => willowmere.metrics().pond.bankShown === 0);
      state = await snapshot(page);
      const expected = { ...initial.inventory };
      for (const [id, n] of Object.entries(bank.fish)) expected[id] = (expected[id] ?? 0) + n;
      assert.ok(distance((await metrics(page)).position, bank) > 2.5, `${view}: packing follows actual departure`);
      assert.deepEqual(state.inventory, expected, `${view}: every held catch enters the bag exactly once`);
      assert.equal(state.stats.fish, initial.stats.fish + 2, `${view}: packing does not award catches again`);
      assert.equal((await metrics(page)).pond.bankTotal, 0);
      await page.screenshot({ path: `${out}/${view}-packed-catches.png` });
      await page.reload(); await begin(page, view);
      state = await snapshot(page);
      assert.equal(state.bankCatch, null); assert.deepEqual(state.inventory, expected);
      assert.equal(state.stats.fish, initial.stats.fish + 2);
      log({ view, check: 'departure transfers both fish once, including after reload', inventory: expected });
    } catch (error) {
      await page.screenshot({ path: `${out}/${view}-failure.png` }).catch(() => {});
      throw error;
    } finally { await finger.close(); await context.close(); }
  }

  // A normal forest pond and the darkest pond represent each fish with a colored body or a hint.
  for (const [view, region] of [['desktop', 'west'], ['phone', 'shadow']]) {
    const pond = FEATURES[region].ponds[0], id = `${region}-0`;
    const { page, context, errors: pageErrors } = await open(browser, view, s => {
      s.position = { x: pond.x, z: pond.z + pond.r + 1 };
    }, { quality: view === 'phone' ? 'battery' : 'high' });
    errors.push(pageErrors);
    try {
      await page.waitForFunction(id => willowmere.render().fieldFish?.ponds.includes(id), id, { timeout: 30000 });
      const a = await page.evaluate(() => willowmere.render().fieldFish);
      await page.waitForTimeout(900);
      const b = await page.evaluate(() => willowmere.render().fieldFish), school = b.schools.find(s => s.id === id);
      const total = b.schools.reduce((n, s) => n + s.fish.length, 0);
      assert.equal(b.fish + b.hints, total, `${view}: each outdoor fish has exactly one representation`);
      assert.equal(b.fish, total * (view === 'phone' ? .5 : 1), `${view}: the requested quality draws the expected colored bodies`);
      assert.equal(b.hints, total * (view === 'phone' ? .5 : 0), `${view}: only omitted colored bodies receive hints`);
      assert.notDeepEqual(school.fish, a.schools.find(s => s.id === id).fish, `${view}: the hinted fish keep swimming`);
      for (const fish of school.fish) assert.ok(distance(fish, pond) < pond.r, `${view}: hints stay in the pond`);
      await page.screenshot({ path: `${out}/${view}-${region}-hints.png` });
      log({ view, check: 'outside pond hints', pond: id, detailedFish: b.fish, hints: b.hints, draws: b.draws });
    } finally { await context.close(); }
  }
  assert.deepEqual(errors.flat(), []);
  console.log('fishing bank browser: ok');
} finally {
  await writeFile(`${out}/results.json`, JSON.stringify({ results, errors }, null, 2));
  await browser.close();
}
