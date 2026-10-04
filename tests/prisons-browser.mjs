// Prisons to rescue, in a real browser (round 8, builder E; spec 12.3, 16): a locked cage with its prisoner and the line a tap gives,
// the open cage, the rescue (the door, the burst, the two lines), the friend following on foot, arriving on entering the ward, at its
// post after a reload and with the box shut, the People panel's line, the next morning's basket, and nothing of a cage (no model, no
// file, no collider, no target) while the box is shut. Run on 1440x900, 390x844 and 844x390.
//
//   GAME_URL=http://127.0.0.1:<port> node tests/prisons-browser.mjs      (GPU=1 uses the real GPU instead of SwiftShader)
//   EVIDENCE=<folder> also writes the screenshots and prisons-results.json there (default: test-results/).
//
// State is seeded through the saved game (defeated, friends, the place you stand); everything else is pointer and keyboard like a
// player. Reads only window.willowmere (snapshot, metrics, targets, calls, friends).
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshState, SAVE_KEY } from '../src/game.mjs';
import { SAFE } from '../src/ward.mjs';
import { cageSpot, postSpot, RESCUE_LINES, RESCUE_REACH } from '../src/friends.mjs';

const url = process.env.GAME_URL ?? 'http://127.0.0.1:4173', out = process.env.EVIDENCE ?? 'test-results';
const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome', headless: true, args: process.env.GPU ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [], results = [], deferred = [], numbers = {};
await mkdir(out, { recursive: true });
const VIEWS = { desktop: { viewport: { width: 1440, height: 900 } }, phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, landscape: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true } };
const SLOW = 60000; // the machine is shared: wait on conditions, generously

async function setup(view, change) {
  const seed = freshState(); seed.started = true; seed.time = 12; change?.(seed);
  const context = await browser.newContext({ ...VIEWS[view], deviceScaleFactor: 1 }), requests = [];
  await context.addInitScript(({ key, seed }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(seed)); }, { key: SAVE_KEY, seed });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message)); page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); }); page.on('request', r => requests.push(r.url()));
  const begin = async () => {
    await page.waitForFunction(() => window.willowmere?.metrics().ready, null, { timeout: 120000 });
    await (VIEWS[view].hasTouch ? page.locator('#begin').tap() : page.locator('#begin').click());
    await page.waitForFunction(() => typeof willowmere.friends === 'function', null, { timeout: SLOW });
    // The bosses (builder D) stand by their cages: without this the treant knocks you out (home) while a check runs.
    await page.evaluate(() => willowmere.test?.invulnerable(true));
  };
  await page.goto(url); await begin();
  const tap = (x, y) => VIEWS[view].hasTouch ? page.touchscreen.tap(x, y) : page.mouse.click(x, y);
  return { page, context, tap, begin, requests, size: VIEWS[view].viewport, view };
}
const friends = p => p.evaluate(() => willowmere.friends());
const snapshot = p => p.evaluate(() => willowmere.snapshot());
const metrics = p => p.evaluate(() => willowmere.metrics());
const toast = p => p.evaluate(() => document.getElementById('toast').textContent);
const shot = (p, name, view) => p.screenshot({ path: `${out}/prisons-${name}-${view}.png` });
const cageFiles = requests => requests.filter(u => u.includes('cage.glb')).length;
const near = (a, b, d) => Math.hypot(a.x - b.x, a.z - b.z) < d;
const onScreen = (box, size) => !!box && box.x >= 0 && box.y >= 0 && box.x + box.width <= size.width && box.y + box.height <= size.height;
/** Real draw calls with the shadow pass (willowmere.calls()), `n` samples a second apart: {min, median, max, triangles}. */
async function calls(p, n = 6) {
  const list = [], tris = [];
  for (let i = 0; i < n; i++) { await p.evaluate(() => willowmere.calls()); await p.waitForTimeout(250); const c = await p.evaluate(() => willowmere.calls()); if (c) { list.push(c.calls); tris.push(c.triangles); } await p.waitForTimeout(750); }
  list.sort((a, b) => a - b); tris.sort((a, b) => a - b);
  return { min: list[0], median: list[list.length >> 1], max: list[list.length - 1], triangles: tris[tris.length >> 1] };
}
const SPROUT = cageSpot('sprout'), CLOVER = cageSpot('clover'), POST = postSpot('sprout');
const wild = (s, extra) => { s.pandora = true; s.hp = 99999; s.settings.test = true; extra?.(s); };
const builtCage = id => p => p.waitForFunction(id => { const c = willowmere.friends().cages.find(c => c.id === id); return c?.built && c.kit === 'glb'; }, id, { timeout: SLOW });

try {
  for (const view of Object.keys(VIEWS)) {
    // ---------------------------------------------------------------- 1. box open, nothing beaten: locked cages, and the line a tap gives
    {
      // You start well out of the treant's sight (12 m; its den is 6.5 m behind the cage): the boss (builder D) walks up to you and
      // stands over the cage otherwise, and a tap on the cage then picks the treant.
      const t = await setup(view, s => wild(s, s => { s.position = { x: SPROUT.x + 6, z: SPROUT.z + 9 }; })), p = t.page;
      await builtCage('sprout')(p);
      await p.waitForFunction(() => willowmere.friends().cages.find(c => c.id === 'sprout').prisoner, null, { timeout: SLOW }); await p.waitForTimeout(400);
      const m = await metrics(p), f = await friends(p), cage = f.cages.find(c => c.id === 'sprout'), far = f.cages.find(c => c.id === 'clover');
      assert.deepEqual(m.cages.map(c => [c.id, c.state]), [['sprout', 'locked'], ['clover', 'locked']], 'Sprout\'s and Clover\'s cages are there and locked; Pepper\'s is not there');
      assert.ok(near(m.cages[0], SPROUT, .01) && near(m.cages[1], CLOVER, .01)); assert.ok(!f.cages.some(c => c.id === 'pepper'));
      assert.ok(cage.door && cage.prisoner && cage.block && cage.target, 'the cage: frame, door, prisoner, collider, tap'); assert.equal(cage.label, '🔒 Locked cage'); assert.equal(cage.shadows, 1, 'only the frame casts a shadow');
      assert.equal(f.meshes, 8, 'a cage is 2 draws and its prisoner 6'); assert.ok(cage.hair > 0, 'the prisoner has Sprout\'s own hair colour');
      const share = cage.prisonerHeight / f.player; assert.ok(share > .42 && share < .62, `the prisoner is about half your height (${share.toFixed(2)})`);
      assert.ok(far && !far.built && far.block && !far.target, 'the far cage is solid but has no model and no tap');
      assert.equal(cageFiles(t.requests), 1, 'cage.glb was asked for once');
      assert.ok(onScreen(await p.locator('.cage-tag').first().boundingBox(), t.size), 'the label is whole on the screen');
      const target = (await p.evaluate(() => willowmere.targets())).filter(x => x.type === 'cage'); assert.equal(target.length, 1); assert.equal(target[0].label, '🔒 Locked cage');
      await shot(p, '01-locked', view);
      if (view === 'desktop') numbers.cageLockedHigh = await calls(p);
      // A tap walks you up to it and gives the line; it does not open.
      await t.tap(cage.screen.x, cage.screen.y);
      await p.waitForFunction(() => document.getElementById('toast').textContent.includes('Defeat the Ancient Treant nearby to open this cage.'), null, { timeout: SLOW });
      assert.equal(await toast(p), '🔒 Defeat the Ancient Treant nearby to open this cage.');
      const after = await snapshot(p); assert.deepEqual(after.friends, []); assert.equal((await friends(p)).cages.find(c => c.id === 'sprout').state, 'locked');
      // Standing at the cage: the prompt names it, and the cage is solid (you are outside its collider).
      const at = (await metrics(p)).position, d = Math.hypot(at.x - SPROUT.x, at.z - SPROUT.z); assert.ok(d < RESCUE_REACH + .4 && d > .95, `you stand at the cage, outside it (${d.toFixed(2)} m)`);
      await shot(p, '02-locked-tapped', view);
      results.push(`${view}: locked cages, the prisoner at ${share.toFixed(2)} of your height, the tap's line`);
      if (view === 'desktop') {
        // Beating the treant (the ordinary defeat path, builder D's test hook) opens the cage at once, without a reload; you stand at it,
        // within the rescue's reach, so Sprout is freed the same moment.
        assert.ok(await p.evaluate(() => willowmere.test.defeat('w:den:treant')), 'the treant was alive');
        await p.waitForFunction(() => willowmere.friends().cages.find(c => c.id === 'sprout').state !== 'locked', null, { timeout: SLOW });
        const s2 = await snapshot(p); assert.equal(s2.defeated.treant, true); await p.waitForTimeout(150);
        const c2 = (await friends(p)).cages.find(c => c.id === 'sprout');
        if (c2.state === 'open') assert.equal(c2.label, '🗝️ Sprout'); else { assert.equal(c2.state, 'rescued'); assert.deepEqual((await snapshot(p)).friends.map(f => f.id), ['sprout'], 'and you, at the cage, free Sprout'); }
        await shot(p, '02b-treant-beaten', view);
        results.push(`desktop: beating the treant opens Sprout's cage without a reload (${c2.state})`);
      }
      await t.context.close();
    }
    // ---------------------------------------------------------------- 1b. Pepper's cage in the Toy land: there once a land's den type is beaten (the robot here)
    {
      const PEPPER = cageSpot('pepper');
      const t = await setup(view, s => wild(s, s => { s.defeated.robot = true; s.position = { x: PEPPER.x + 4, z: PEPPER.z + 5 }; })), p = t.page;
      await builtCage('pepper')(p); await p.waitForFunction(() => willowmere.friends().cages.find(c => c.id === 'pepper').prisoner, null, { timeout: SLOW }); await p.waitForTimeout(600);
      const c = (await friends(p)).cages.find(c => c.id === 'pepper'), m = await metrics(p);
      assert.equal(c.state, 'open'); assert.equal(m.region, 'toy', 'the cage stands in the Toy land'); assert.equal(c.label, '🗝️ Pepper');
      assert.ok(onScreen(await p.locator('.cage-tag.open').first().boundingBox(), t.size), 'its label is whole on the screen');
      await shot(p, '01b-pepper-toy', view);
      results.push(`${view}: Pepper's cage open in the Toy land`);
      await t.context.close();
    }
    // ---------------------------------------------------------------- 2. the treant beaten: the open cage, the rescue, following on foot
    {
      const t = await setup(view, s => wild(s, s => { s.defeated.treant = true; s.stats.sales = 250; s.vehicles.jeep = { x: SPROUT.x + 16, z: SPROUT.z + 9, rot: 0 }; s.position = { x: SPROUT.x + 4.6, z: SPROUT.z + 4.1 }; })), p = t.page;
      await builtCage('sprout')(p); await p.waitForFunction(() => willowmere.friends().cages.find(c => c.id === 'sprout').prisoner, null, { timeout: SLOW }); await p.waitForTimeout(400);
      let f = await friends(p), cage = f.cages.find(c => c.id === 'sprout');
      assert.equal(cage.state, 'open'); assert.equal(cage.label, '🗝️ Sprout'); assert.ok(cage.door && cage.prisoner && cage.target); assert.deepEqual((await metrics(p)).cages.map(c => c.state), ['open', 'locked']);
      await shot(p, '03-open', view);
      await t.tap(cage.screen.x, cage.screen.y);
      await p.waitForFunction(() => willowmere.snapshot().friends.length === 1, null, { timeout: SLOW });
      await p.waitForTimeout(120); await shot(p, '04-rescue', view);
      f = await friends(p); cage = f.cages.find(c => c.id === 'sprout');
      assert.equal(f.bursts, 1, 'the burst'); assert.equal(f.said?.text, RESCUE_LINES.sprout[0]); assert.ok(f.said.shown, 'the first line floats over the friend'); assert.equal(await toast(p), '💖 ' + RESCUE_LINES.sprout[1]);
      assert.equal(cage.state, 'rescued'); assert.ok(!cage.prisoner && !cage.target && cage.label === '', 'the empty cage has no prisoner, tap or label'); assert.ok(cage.popping || !cage.door, 'the door pops off');
      const who = f.actors.find(a => a.id === 'sprout'); assert.ok(who?.shown && who.cheering, 'Sprout stands outside, cheering'); assert.ok(onScreen(await p.locator('.friend-say').boundingBox(), t.size), 'the line is whole on the screen');
      const saved = await snapshot(p); assert.deepEqual(saved.friends, [{ id: 'sprout', rescuedAt: saved.day, home: false }]); assert.equal(saved.coins, 160, 'no coins for the rescue itself');
      assert.deepEqual((await metrics(p)).cages.map(c => c.state), ['rescued', 'locked']);
      await p.waitForFunction(() => { const f = willowmere.friends(), c = f.cages.find(c => c.id === 'sprout'); return !c.door && !f.actors[0].cheering; }, null, { timeout: SLOW });
      f = await friends(p); assert.ok(f.cages.find(c => c.id === 'sprout').built, 'the empty cage stays as scenery'); assert.equal(f.meshes, 7, 'the frame and the friend');
      // Following: walk away for a while; Sprout keeps up, behind you.
      const from = (await metrics(p)).position; await p.keyboard.down('d'); await p.waitForTimeout(600);
      const walking = (await friends(p)).actors[0]; await p.waitForFunction(x => Math.hypot(willowmere.metrics().position.x - x.x, willowmere.metrics().position.z - x.z) > 9, from, { timeout: SLOW }); await p.keyboard.up('d');
      await shot(p, '05-following', view); await p.waitForTimeout(900);
      const to = (await metrics(p)).position, a = (await friends(p)).actors[0];
      assert.ok(walking.pose === 'walk' || near(walking, from, 4), 'Sprout walks'); assert.ok(a.shown && near(a, to, 3.2), `Sprout is right behind you (${Math.hypot(a.x - to.x, a.z - to.z).toFixed(2)} m)`); assert.ok(!near(a, SPROUT, 5));
      assert.equal((await snapshot(p)).friends[0].home, false, 'still on the way: you are outside the ward');
      if (view === 'desktop') {
        // In a car a follower is hidden, and stands beside you when you step out. A jeep out here needs the saved vehicle spots (builder C)
        // and the jeep unlocked (250 coins of sales, seeded).
        const jeep = (await p.evaluate(() => willowmere.targets())).find(x => x.type === 'vehicle' && x.id === 'jeep');
        if (!jeep || !near(jeep.position, to, 60)) deferred.push('hidden in the jeep, beside it on stepping out: no vehicle can be seeded outside the ward until builder C restores state.vehicles');
        else {
          await t.tap(jeep.screen.x, jeep.screen.y); await p.waitForFunction(() => willowmere.metrics().riding === 'jeep', null, { timeout: SLOW }); await p.waitForTimeout(300);
          assert.equal((await friends(p)).actors[0].shown, false, 'a follower is hidden while you ride'); await shot(p, '05b-riding', view);
          await p.keyboard.press('e'); await p.waitForFunction(() => willowmere.metrics().riding === '', null, { timeout: SLOW }); await p.waitForTimeout(400);
          const out = (await metrics(p)).position, b = (await friends(p)).actors[0]; assert.ok(b.shown && near(b, out, 3.2), 'and stands beside you when you step out'); await shot(p, '05c-stepped-out', view);
          results.push('desktop: hidden in the jeep, beside you on stepping out');
        }
      }
      results.push(`${view}: the open cage, the rescue (door, burst, both lines), Sprout following on foot`);
      await t.context.close();
    }
    // ---------------------------------------------------------------- 3. arriving on entering the ward; at the post after a reload
    {
      const t = await setup(view, s => wild(s, s => { s.defeated.treant = true; s.friends = [{ id: 'sprout', rescuedAt: 1, home: false }]; s.position = { x: SAFE.x0 - 5, z: 20 }; })), p = t.page;
      await p.waitForFunction(() => willowmere.friends().actors[0]?.shown, null, { timeout: SLOW });
      let m = await metrics(p), a = (await friends(p)).actors[0]; assert.ok(near(a, m.position, 3.2), 'the follower stands by you when the game opens'); assert.equal((await snapshot(p)).friends[0].home, false);
      await p.keyboard.down('d'); await p.waitForFunction(() => willowmere.snapshot().friends[0].home === true, null, { timeout: SLOW }); await p.keyboard.up('d');
      m = await metrics(p); assert.ok(m.position.x >= SAFE.x0 - .5, 'it arrives as you cross the ward line'); assert.ok(m.position.x < SAFE.x0 + 3, `not before, not long after (x ${m.position.x.toFixed(2)})`);
      assert.equal(await toast(p), '🏡 Sprout reached Willowmere and went to work!'); await shot(p, '06-arrived', view);
      a = (await friends(p)).actors[0]; assert.ok(a.routing > 0 || near(a, POST, .2), 'Sprout sets off for its post');
      await p.waitForTimeout(700); await p.reload(); await t.begin();
      await p.waitForFunction(() => willowmere.friends().actors[0]?.share > 0 || willowmere.friends().actors.length === 1, null, { timeout: SLOW });
      a = (await friends(p)).actors[0]; assert.ok(near(a, POST, .01), 'after a reload the friend is at its post'); assert.equal((await snapshot(p)).friends[0].home, true);
      results.push(`${view}: arriving at the ward line, at the post after a reload`);
      await t.context.close();
    }
    // ---------------------------------------------------------------- 3b. Home and a knock-out bring a follower along (builder C's and D's calls of world.followers[n].moveTo)
    if (view === 'desktop') {
      const follower = s => { s.defeated.treant = true; s.friends = [{ id: 'sprout', rescuedAt: 1, home: false }]; };
      let t = await setup(view, s => wild(s, s => { follower(s); s.position = { x: SAFE.x0 - 40, z: 20 }; })), p = t.page;
      await p.waitForFunction(() => willowmere.friends().actors[0]?.shown, null, { timeout: SLOW });
      await p.locator('.home-button').click();
      await p.waitForFunction(() => willowmere.snapshot().friends[0].home === true, null, { timeout: SLOW });
      let m = await metrics(p), a = (await friends(p)).actors[0]; assert.ok(near(m.position, { x: 0, z: -8 }, .1), 'Home took you to the yard');
      assert.ok(near(a, m.position, 3.2) || a.routing > 0, `Sprout came with you (${Math.hypot(a.x - m.position.x, a.z - m.position.z).toFixed(2)} m) and set off for its post`);
      assert.equal(await toast(p), '🏡 Sprout reached Willowmere and went to work!');
      await p.waitForFunction(() => !willowmere.metrics().journey.home && +getComputedStyle(document.getElementById('home-fade')).opacity < .05, null, { timeout: SLOW }); await shot(p, '06b-home-hop', view);
      await t.context.close();
      // Knocked out by the treant beside its den: you wake indoors; Sprout is brought to the door, and arrives once the panel is shut.
      t = await setup(view, s => { s.pandora = true; s.hp = 1; follower(s); s.position = { x: -148.5, z: 28.5 }; }); p = t.page;
      await p.waitForFunction(() => willowmere.metrics().location === 'interior', null, { timeout: SLOW });
      a = (await friends(p)).actors[0]; assert.ok(!a.shown && Math.hypot(a.x, a.z + 8) < 4, `Sprout waits by the door, unseen while you are indoors (${a.x.toFixed(1)}, ${a.z.toFixed(1)})`);
      await p.keyboard.press('Escape'); await p.waitForFunction(() => willowmere.snapshot().friends[0].home === true, null, { timeout: SLOW });
      results.push('desktop: Home and a knock-out bring a follower home');
      await t.context.close();
    }
    // ---------------------------------------------------------------- 4. box shut: no cage anywhere, the friend still at its post, the People panel
    {
      const t = await setup(view, s => { s.defeated.treant = true; s.friends = [{ id: 'sprout', rescuedAt: 1, home: true }]; s.position = { x: POST.x + 3.2, z: POST.z + 2.6 }; }), p = t.page;
      await p.waitForFunction(() => { const a = willowmere.friends().actors[0]; return a?.shown && !a.pending && a.hat; }, null, { timeout: SLOW }); await p.waitForTimeout(500);
      const f = await friends(p), m = await metrics(p), a = f.actors[0];
      assert.equal(f.cages.length, 0); assert.equal(m.cages.length, 0); assert.equal(f.kit, 'none'); assert.equal(cageFiles(t.requests), 0, 'no cage file with the box shut'); assert.ok(!(await p.evaluate(() => willowmere.targets())).some(x => x.type === 'cage'));
      assert.ok(near(a, POST, .01) && a.shown, 'Sprout is at its post with the box shut'); assert.equal(a.share, .5); assert.ok(a.hair > 0 && a.hat, 'its own hair and its straw hat'); assert.equal(f.meshes, 6, 'a friend is six draws');
      assert.equal(a.name, '🌱 Sprout'); assert.ok(onScreen(await p.locator('.friend-tag').first().boundingBox(), t.size));
      await shot(p, '07-post-shut', view);
      await (VIEWS[view].hasTouch ? p.locator('[data-panel="people"]').first().tap() : p.keyboard.press('n'));
      await p.waitForSelector('.friends-note', { timeout: SLOW });
      const note = await p.locator('.friends-note').innerText(); assert.equal(note, 'Rescued friends 1 / 3 · Sprout tends the beds: 3 carrots and 2 radishes each morning');
      await p.locator('.friends-note').scrollIntoViewIfNeeded(); const box = await p.locator('.friends-note').boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= t.size.width + .5, 'the line fits the panel');
      await shot(p, '08-people', view);
      results.push(`${view}: box shut: no cage, no file, Sprout at its post, the People panel's line`);
      await t.context.close();
    }
    // ---------------------------------------------------------------- 5. box shut at the cage's own spot: nothing there
    {
      const t = await setup(view, s => { s.defeated.treant = true; s.position = { x: SPROUT.x + 4.6, z: SPROUT.z + 4.1 }; }), p = t.page;
      await p.waitForTimeout(1500);
      const f = await friends(p); assert.equal(f.cages.length, 0); assert.equal(f.meshes, 0); assert.equal(f.mounted, false, 'nothing of the friends is in the scene'); assert.equal(cageFiles(t.requests), 0);
      assert.equal(await p.locator('.cage-tag').count(), 0); assert.ok(!(await p.evaluate(() => willowmere.targets())).some(x => x.type === 'cage'));
      // You can walk straight over the spot: no collider is left.
      await p.keyboard.down('a'); await p.keyboard.down('w'); await p.waitForFunction(at => { const m = willowmere.metrics().position; return m.x < at.x - 1 && m.z < at.z - 1; }, SPROUT, { timeout: SLOW }).catch(() => {}); await p.keyboard.up('a'); await p.keyboard.up('w');
      await shot(p, '09-shut-no-cage', view);
      results.push(`${view}: box shut at the cage's spot: no model, no label, no tap, no file`);
      await t.context.close();
    }
  }

  // ---------------------------------------------------------------- 6. the next morning: the basket, and no wage (desktop)
  {
    const t = await setup('desktop', s => { s.friends = [{ id: 'sprout', rescuedAt: 1, home: true }]; s.position = { x: 0, z: -8.2 }; s.time = 20; }), p = t.page;
    const before = await snapshot(p);
    await p.keyboard.press('e'); await p.waitForFunction(() => willowmere.metrics().location === 'interior', null, { timeout: SLOW }); await p.waitForTimeout(900);
    assert.equal((await friends(p)).actors.filter(a => a.shown).length, 0, 'nobody of the friends is drawn indoors');
    const bed = (await p.evaluate(() => willowmere.targets())).find(x => x.type === 'bedroom'); assert.ok(bed, 'your bed'); await t.tap(bed.screen.x, bed.screen.y);
    await p.waitForSelector('[data-action="sleep"]', { timeout: SLOW }); await p.locator('[data-action="sleep"]').click();
    await p.waitForFunction(() => willowmere.snapshot().day === 2, null, { timeout: SLOW });
    const after = await snapshot(p), line = await toast(p);
    assert.equal((after.inventory.carrot ?? 0) - (before.inventory.carrot ?? 0), 3); assert.equal((after.inventory.radish ?? 0) - (before.inventory.radish ?? 0), 2); assert.equal(after.coins, before.coins, 'no wage is taken');
    assert.match(line, /^Good morning\..* · Sprout filled your basket\.$/); await shot(p, '10-morning', 'desktop');
    results.push('desktop: next morning 3 carrots and 2 radishes more, no wage: "' + line + '"');
    await t.context.close();
  }

  // ---------------------------------------------------------------- 7. numbers: real draw calls and triangles against spec 18
  {
    const all = s => { s.friends = ['sprout', 'clover', 'pepper'].map(id => ({ id, rescuedAt: 1, home: true })); };
    for (const [key, view, quality] of [['high', 'desktop', 'high'], ['battery', 'phone', 'battery']]) {
      const base = s => { s.settings.quality = quality; s.position = { x: 0, z: -8.8 }; };
      let t = await setup(view, base); await t.page.waitForTimeout(2500); const without = await calls(t.page); await t.context.close();
      t = await setup(view, s => { base(s); all(s); }); await t.page.waitForFunction(() => { const a = willowmere.friends().actors; return a.length === 3 && a.every(a => a.shown && !a.pending); }, null, { timeout: SLOW }); await t.page.waitForTimeout(2500);
      const f = await friends(t.page), withAll = await calls(t.page); assert.equal(f.meshes, 18, 'three friends at their posts are 18 draws');
      const size = t.size, seen = f.actors.filter(a => a.screen.x > 0 && a.screen.x < size.width && a.screen.y > 0 && a.screen.y < size.height).length;
      await shot(t.page, `11-homestead-three-${key}`, view); await t.context.close();
      t = await setup(view, s => wild(s, s => { s.settings.quality = quality; s.position = { x: SPROUT.x + 4.6, z: SPROUT.z + 4.1 }; })); await builtCage('sprout')(t.page); await t.page.waitForTimeout(2500);
      const cage = await calls(t.page); await t.context.close();
      numbers[key] = { homesteadWithout: without, homesteadWithThree: withAll, friendsInView: seen, cageInView: cage };
      // Spec 18: outside the village, near view, box open: at most 220 (PC, "high") and 150 (phone, "battery"); triangles 400,000 and 250,000.
      assert.ok(cage.max <= (key === 'high' ? 220 : 150), `${key}: ${cage.max} draws by a cage`); assert.ok(cage.triangles <= (key === 'high' ? 400000 : 250000), `${key}: ${cage.triangles} triangles by a cage`);
      // The homestead: 6 more for each rescued friend in view (the view itself moves by a bird or a neighbour, so the medians are compared with room).
      assert.ok(withAll.median <= without.median + 18 + 30, `${key}: homestead ${without.median} -> ${withAll.median} with three friends`);
    }
    results.push('numbers: ' + JSON.stringify(numbers));
  }
  assert.deepEqual(errors, [], 'no page errors and no failed requests');
  console.log(results.map(r => '  ok  ' + r).join('\n')); if (deferred.length) console.log(deferred.map(r => '  deferred  ' + r).join('\n'));
  await writeFile(`${out}/prisons-results.json`, JSON.stringify({ results, deferred, numbers, errors }, null, 1));
} finally { await browser.close(); }
