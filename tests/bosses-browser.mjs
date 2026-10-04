// Round 8, builder D, in a real browser: creatures up to the ring road, each of the 16 bosses in its den, the dragon's nest
// empty until its lava event, the seven boss skills with their telegraphs and callouts, the boss bar, an enrage, and which
// creature files are fetched when. It also measures the real draw calls and triangles at every den (willowmere.calls()).
//
//   GAME_URL=http://127.0.0.1:<port> GPU=1 node tests/bosses-browser.mjs
//   EVIDENCE=<folder>   also writes every screenshot there as <name>-<width>x<height>.png, with bosses-results.json
//   VIEWS=desktop       only that view (desktop, phone, landscape); the default is all three
//   SECTIONS=5          only those sections (1 files, 2 the ring road, 3 the dens and skills, 4 the lands' stands, 5 the lands'
//                       own features: the sea's kinds, the Night Land's dark and its lamps, the dragon's nest); the default is all
//
// Everything is seeded through the saved game; the three things a save cannot seed (a lava event, a chosen skill, no damage)
// go through window.willowmere.test (spec 12.4). The machine is shared, so every wait is on a condition, with generous timeouts.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshState, SAVE_KEY } from '../src/game.mjs';
import { CREATURES, SAFE, inSafeZone, wildCell, wildDepth } from '../src/wilds.mjs';
import { DENS, REGION, squareOf, regionAt } from '../src/regions.mjs';
import { BOSS_SKILLS, BOSS_CALLOUTS, SKILL } from '../src/boss-patterns.mjs';
import { LAND_KITS, KIT_REACH } from '../src/wilds-view.mjs';
import { FEATURES, waterAt } from '../src/land-features.mjs';

const url = process.env.GAME_URL ?? 'http://127.0.0.1:4173', evidence = process.env.EVIDENCE ?? '';
const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome', headless: true, args: process.env.GPU ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [], results = [], numbers = [];
await mkdir('test-results', { recursive: true }); if (evidence) await mkdir(evidence, { recursive: true });
const VIEWS = { desktop: { viewport: { width: 1440, height: 900 } }, phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, landscape: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true } };
const views = (process.env.VIEWS ?? 'desktop,phone,landscape').split(',').filter(v => VIEWS[v]), sections = (process.env.SECTIONS ?? '1,2,3,4,5').split(',');
/** "high" on the PC, "battery" on the two phone shapes: the two ends the performance budget names (spec 18). */
const qualityOf = view => view === 'desktop' ? 'high' : 'battery';

async function setup(view, change) {
  const seed = freshState(); seed.started = true; seed.time = 12; seed.pandoraSeen = true; seed.settings.quality = qualityOf(view); change?.(seed);
  const context = await browser.newContext({ ...VIEWS[view], deviceScaleFactor: 1 }), requests = [];
  await context.addInitScript(({ key, seed }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(seed)); }, { key: SAVE_KEY, seed });
  const page = await context.newPage();
  const said = [], pending = new Map();
  page.on('pageerror', e => errors.push(e.message)); page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); }); page.on('request', r => { requests.push(r.url()); pending.set(r, r.url()); });
  page.on('requestfinished', r => pending.delete(r)); page.on('requestfailed', r => { pending.delete(r); said.push('failed ' + r.url()); }); page.on('console', m => { if (m.type() === 'error') said.push(m.text()); });
  await page.goto(url);
  // A boot that never ends says why: the start button's text (main.mjs writes the error there), the console's errors, what is still loading.
  await page.waitForFunction(() => window.willowmere?.metrics().ready, null, { timeout: 120000 }).catch(async error => {
    const begin = await page.locator('#begin').textContent().catch(() => '?'), note = await page.locator('#save-note').textContent().catch(() => '?');
    throw new Error(`${view}: the game did not boot in 120 s (begin "${begin}", note "${note}", console ${JSON.stringify(said.slice(0, 6))}, loading ${JSON.stringify([...pending.values()].slice(0, 8))}): ${error.message}`);
  });
  await (VIEWS[view].hasTouch ? page.locator('#begin').tap() : page.locator('#begin').click());
  await page.waitForFunction(() => typeof willowmere.wilds === 'function', null, { timeout: 30000 });
  return { page, context, requests, size: VIEWS[view].viewport, view };
}
const open = (view, position, more) => setup(view, s => { s.pandora = true; s.settings.test = true; s.position = position; more?.(s); });
const wilds = p => p.evaluate(() => willowmere.wilds());
const creature = (p, id) => p.evaluate(id => willowmere.wilds().creatures.find(c => c.id === id) ?? null, id);
async function shot(v, name) {
  const file = `${name}-${v.size.width}x${v.size.height}.png`; await v.page.screenshot({ path: `test-results/bosses-${file}` });
  if (evidence) await v.page.screenshot({ path: `${evidence}/${file}` });
}
/** Real draw calls with the shadow pass, and triangles: the counter is armed by the first read and read by the second. */
async function calls(p) { await p.evaluate(() => willowmere.calls()); await p.waitForTimeout(250); let n = await p.evaluate(() => willowmere.calls()); for (let i = 0; i < 20 && !n; i++) { await p.waitForTimeout(100); n = await p.evaluate(() => willowmere.calls()); } return n; }
/** Where to stand to meet a den's creature: `gap` metres from it, on the side of its square's centre. */
function beside(den, gap = 6) { const s = squareOf(den.region), dx = s.cx - den.x, dz = s.cz - den.z, d = Math.hypot(dx, dz) || 1; return { x: den.x + dx / d * gap, z: den.z + dz / d * gap }; }
const bosses = DENS.filter(d => CREATURES[d.type] && !CREATURES[d.type].titan);
/** The skill each view shows once (spec 11.4: each of the seven), and the boss that shows it. */
const SHOWN = { slam: 'treant', quake: 'bear', charge: 'croc', barrage: 'robot', rain: 'mushking', spin: 'gingerbread', eclipse: 'shadowlord' };
const MARKS = { slam: 1, quake: 1, charge: 6, barrage: 1, rain: 3, spin: 1, eclipse: 1 };
const kitFiles = requests => requests.filter(u => /\/c-[a-z]+\.glb/.test(u)).map(u => u.match(/c-[a-z]+\.glb/)[0]);

try {
  assert.equal(bosses.length, 17, '16 bosses and the dragon have their rows');
  // ---------------------------------------------------------------- 1. which creature files are fetched, and when
  if (sections.includes('1')) {
    const shut = await setup('desktop', s => { s.position = { x: 0, z: -8.8 }; }); await shut.page.waitForTimeout(2500);
    assert.deepEqual(shut.requests.filter(u => /wild-creatures|\/c-[a-z]+\.glb|cage\.glb|\/t-[a-z]+\.glb/.test(u)), [], 'box shut: no creature, cage or titan file is asked for');
    await shut.context.close();
    // Box open, at home in the middle of the village: the home file, and no land's (the nearest squares are 96.3 m away).
    const home = await open('desktop', { x: 0, z: -8.8 }); await home.page.waitForFunction(() => willowmere.wilds().ready, null, { timeout: 60000 }); await home.page.waitForTimeout(3000);
    assert.equal(home.requests.filter(u => u.includes('wild-creatures.glb')).length, 1); assert.deepEqual(kitFiles(home.requests), [], 'in the village no land\'s creature file is fetched');
    assert.deepEqual(home.requests.filter(u => /cage\.glb|\/t-[a-z]+\.glb/.test(u)), []); assert.deepEqual((await wilds(home.page)).kits, [LAND_KITS.west[0]], 'only the forest hawk, 64 m off, whose model is the bird already shipped');
    await home.context.close();
    // Out by the forest's south edge the Candy Land is within 96 m: its file comes, and no other land's.
    const at = { x: -90, z: 50 }, out = await open('desktop', at); await out.page.waitForFunction(() => willowmere.wilds().kits.some(k => k.includes('c-candy')), null, { timeout: 60000 }); await out.page.waitForTimeout(2500);
    assert.deepEqual([...new Set(kitFiles(out.requests))], ['c-candy.glb'], 'only the square within 96 m');
    for (const [id, [file]] of Object.entries(LAND_KITS)) { const s = squareOf(id), d = Math.hypot(Math.max(s.x0 - at.x, 0, at.x - s.x1), Math.max(s.z0 - at.z, 0, at.z - s.z1)); assert.equal((await wilds(out.page)).kits.includes(file), d < KIT_REACH, `${file}: ${d.toFixed(0)} m`); }
    results.push({ name: 'creature files: none with the box shut, the home file in the village, a land\'s own within 96 m of its square' }); await out.context.close();
  }

  // ---------------------------------------------------------------- 2. creatures up to the ring road, and none across the ward
  if (sections.includes('2')) {
    // The seeded creature nearest the ward on each side; the player stands inside the ward, level with it, 3 m in from the line.
    const all = []; for (let cx = -4; cx <= 3; cx++) for (let cz = -4; cz <= 3; cz++) all.push(...wildCell(cx, cz));
    const sides = { west: c => ({ x: SAFE.x0 + 3, z: c.z }), north: c => ({ x: c.x, z: SAFE.z0 + 3 }), south: c => ({ x: c.x, z: SAFE.z1 - 3 }), east: c => ({ x: SAFE.x1 - 3, z: c.z }) };
    const inside = c => c.x > SAFE.x0 + 4 && c.x < SAFE.x1 - 4 || c.z > SAFE.z0 + 4 && c.z < SAFE.z1 - 4; // beside a side of the ward, not off one of its corners
    for (const side of Object.keys(sides)) {
      const facing = c => side === 'west' ? c.x < SAFE.x0 : side === 'east' ? c.x > SAFE.x1 : side === 'north' ? c.z < SAFE.z0 : c.z > SAFE.z1;
      const nearest = all.filter(c => c.region === side && facing(c) && inside(c)).sort((a, b) => wildDepth(a.x, a.z) - wildDepth(b.x, b.z))[0];
      assert.ok(nearest && wildDepth(nearest.x, nearest.z) < 8, `${side}: a seeded creature within 8 m of the ward line (${nearest && wildDepth(nearest.x, nearest.z).toFixed(1)} m)`);
      for (const view of views) {
        const v = await open(view, sides[side](nearest)); await v.page.waitForFunction(() => willowmere.wilds().ready && willowmere.wilds().count > 0, null, { timeout: 60000 }); await v.page.waitForTimeout(1500);
        let w = await wilds(v.page); assert.equal(w.fighting, false, 'inside the ward: no fight'); assert.equal(w.zone, null);
        let least = Infinity;
        // On the west side, on the PC, the watch is the spec's full minute; elsewhere a few seconds for the picture.
        const watch = side === 'west' && view === views[0] ? 60 : 6;
        for (let t = 0; t < watch; t += 2) { w = await wilds(v.page); for (const c of w.creatures) { assert.ok(!inSafeZone(c.x, c.z), `${c.type} at ${c.x.toFixed(1)}, ${c.z.toFixed(1)} is outside the ward`); if (c.hp > 0) least = Math.min(least, wildDepth(c.x, c.z)); } await v.page.waitForTimeout(2000); }
        assert.ok(least < 8, `${side}: a creature within 8 m of the ward line (${least.toFixed(1)} m)`);
        await shot(v, `road-${side}`); if (view === views[0]) results.push({ name: `creatures by the ring road, ${side} side`, nearest: +least.toFixed(1), type: nearest.type, watched: watch }); await v.context.close();
      }
    }
  }

  // ---------------------------------------------------------------- 3. the dens, the seven skills, the boss bar
  if (sections.includes('3')) for (const view of views) {
    const seen = new Set();
    for (const den of bosses) {
      const v = await open(view, beside(den)), p = v.page, def = CREATURES[den.type];
      await p.waitForFunction(id => willowmere.wilds().creatures.some(c => c.id === id), den.id, { timeout: 60000 });
      await p.evaluate(() => willowmere.test.invulnerable(true));
      let e = await creature(p, den.id);
      if (den.event) {
        // The dragon's nest is empty in any other weather, and holds it the moment its event begins.
        await p.evaluate(() => willowmere.test.lavaEvent('normal')); await p.waitForFunction(id => willowmere.wilds().creatures.find(c => c.id === id).hp === 0, den.id, { timeout: 20000 });
        if (view === views[0]) await shot(v, 'den-dragon-empty-nest');
        await p.evaluate(() => willowmere.test.lavaEvent('dragon')); await p.waitForFunction(id => willowmere.wilds().creatures.find(c => c.id === id).hp > 0, den.id, { timeout: 20000 });
        e = await creature(p, den.id); assert.equal(e.maxHp, 12480); assert.equal((await p.evaluate(() => willowmere.metrics().lavaEvent.id)), 'dragon');
      }
      const info = REGION[den.region];
      assert.equal(e.type, den.type); assert.ok(e.hp > 0, `${den.type} is in its den`); assert.equal(e.region, den.region); assert.equal(e.level, den.level);
      assert.ok(Math.hypot(e.x - den.x, e.z - den.z) < 12, `${den.type} is at its den`); assert.equal(e.power, info.kind === 'land' ? [1, 1, 1.7, 2.6, 3.6, 4.8, 6.2][info.difficulty] : 1);
      await p.waitForFunction(id => willowmere.wilds().creatures.find(c => c.id === id).shown, den.id, { timeout: 60000 });
      // A modelled boss is drawn from its own file once that has arrived; the eleven the reference draws by code never wait for one.
      const modelled = ['bear', 'treant', 'croc', 'mushking', 'yeti', 'mammoth'].includes(den.type);
      if (modelled) await p.waitForFunction(id => !willowmere.wilds().creatures.find(c => c.id === id).standIn, den.id, { timeout: 60000 }); else assert.equal((await creature(p, den.id)).standIn, true, `${den.type} is the reference's procedural art`);
      await p.waitForTimeout(900); await shot(v, `den-${den.type}`);
      const n = await calls(p), w = await wilds(p); numbers.push({ at: `den ${den.type} (${den.region})`, view, quality: qualityOf(view), calls: n?.calls, triangles: n?.triangles, creatures: w.count, shown: w.visible });
      // Its bar: the nearest boss that is after you, with its name, its level and its health.
      await p.waitForSelector('#boss-bar:not([hidden])', { timeout: 30000 });
      assert.match(await p.locator('#boss-name').textContent(), new RegExp(`${def.name} · Lv ${den.level}`)); assert.ok((await p.locator('#boss-name').innerText()).includes(def.name)); assert.match(await p.locator('#boss-hp').innerText(), new RegExp(` / ${e.maxHp}$`));
      // The skills: on the PC every skill of every list is cast once; on the phones the seven are each shown once.
      for (const skill of BOSS_SKILLS[den.type]) {
        const picture = SHOWN[skill] === den.type && !seen.has(skill); if (view !== 'desktop' && !picture) continue;
        await p.waitForFunction(id => { const c = willowmere.wilds().creatures.find(c => c.id === id); return c.hp > 0 && !['windup', 'charge', 'spin'].includes(c.phase); }, den.id, { timeout: 30000 });
        assert.equal(await p.evaluate(([id, skill]) => willowmere.test.skill(id, skill), [den.id, skill]), true);
        await p.waitForFunction(([id, skill]) => { const c = willowmere.wilds().creatures.find(c => c.id === id); return c.phase === 'windup' && c.skill === skill; }, [den.id, skill], { timeout: 30000 });
        const c = await creature(p, den.id), frame = await wilds(p);
        assert.ok(c.marks >= MARKS[skill], `${den.type} ${skill}: ${c.marks} telegraph discs`); assert.ok(frame.discs >= MARKS[skill], `${skill}: ${frame.discs} discs drawn`); assert.equal(c.callout, skill);
        await p.waitForFunction(text => document.querySelector('#boss-callout')?.textContent === text && document.querySelector('#boss-bar').classList.contains('calling'), BOSS_CALLOUTS[skill], { timeout: 10000 });
        assert.ok(await p.evaluate(text => [...document.querySelectorAll('.float.callout')].some(el => !el.hidden && el.textContent === text), BOSS_CALLOUTS[skill]), `${skill}: the callout floats over the boss`);
        if (picture) { seen.add(skill); await p.waitForTimeout(250); await shot(v, `skill-${skill}`); const k = await calls(p); numbers.push({ at: `skill ${skill} (${den.type})`, view, quality: qualityOf(view), calls: k?.calls, triangles: k?.triangles, discs: (await wilds(p)).discs }); }
        // It lands: the wind-up ends, and with the test hook's shield nothing is lost.
        if (skill === 'barrage') await p.waitForFunction(n => willowmere.wilds().shots >= n, SKILL.barrage.shots / 2 - 1, { timeout: 30000 }); // the ring of shots is in the air (trees beside the boss stop the ones that fly into them)
        await p.waitForFunction(id => willowmere.wilds().creatures.find(c => c.id === id).phase !== 'windup', den.id, { timeout: 30000 });
        assert.equal((await wilds(p)).hp, (await wilds(p)).maxHp, 'invulnerable: no health lost');
      }
      if (view === views[0]) results.push({ name: `${den.type} in its den (${den.region}, Lv ${den.level})`, hp: e.maxHp, damage: +e.damage.toFixed(1), skills: BOSS_SKILLS[den.type].join(', ') });
      // The treant's fight goes on: the titan look of the bar (builder D2's titans use it), then an enrage.
      if (den.type === 'treant') {
        // (No titan has a row before builder D2's merge, so the look is put on the treant's bar by hand for the picture, then taken off.)
        const name = await p.locator('#boss-name').innerHTML();
        await p.evaluate(() => { const bar = document.querySelector('#boss-bar'); bar.classList.add('titan'); bar.querySelector('#boss-name').innerHTML = '🔱 <em>TITAN · </em>Ancient Mountain Turtle<small> · Lv 13</small>'; });
        await p.waitForTimeout(150); await shot(v, 'bar-titan-look');
        await p.evaluate(name => { const bar = document.querySelector('#boss-bar'); bar.classList.remove('titan'); bar.querySelector('#boss-name').innerHTML = name; }, name);
        // Test mode triples your blows: punch it under 30 % and it enrages, once, with a toast.
        for (let i = 0; i < 400; i++) {
          const c = await creature(p, den.id); if (c.enraged || c.hp <= 0) break;
          const me = await p.evaluate(() => willowmere.metrics().position); if (Math.hypot(c.x - me.x, c.z - me.z) > 3.2) { await p.mouse.click(c.screen.x, c.screen.y).catch(() => {}); await p.waitForTimeout(500); }
          await p.keyboard.press('f'); await p.waitForTimeout(140);
        }
        const c = await creature(p, den.id); assert.equal(c.enraged, true, `the treant enrages below 30 % (${c.hp} of ${c.maxHp})`); assert.ok(c.hp < c.maxHp * .3 && c.hp > 0);
        await p.waitForFunction(() => document.querySelector('#boss-bar').classList.contains('enraged'), null, { timeout: 10000 });
        assert.equal(await p.locator('#toast').textContent(), 'Ancient Treant is enraged! Its skills come faster.', 'the enrage toast');
        await shot(v, 'enrage'); if (view === views[0]) results.push({ name: 'the Ancient Treant enrages below 30 % health: one toast, a pulsing bar', hp: c.hp });
        // And it falls: the fanfare's toast, the coins, the save's record.
        const coins = await p.evaluate(() => willowmere.snapshot().coins); assert.equal(await p.evaluate(id => willowmere.test.defeat(id), den.id), true);
        await p.waitForFunction(() => willowmere.snapshot().defeated?.treant === true, null, { timeout: 10000 }); assert.equal(await p.evaluate(() => willowmere.snapshot().coins), coins + 120);
        assert.equal(await p.locator('#toast').textContent(), 'Ancient Treant defeated!');
      }
      // A land boss pays by its land: the robot's 165 coins × (0.6 + 0.4 × 1.7).
      if (den.type === 'robot' && view === 'desktop') { const coins = await p.evaluate(() => willowmere.snapshot().coins); await p.evaluate(id => willowmere.test.defeat(id), den.id); await p.waitForFunction(() => willowmere.snapshot().defeated?.robot === true, null, { timeout: 10000 }); assert.equal(await p.evaluate(() => willowmere.snapshot().coins), coins + 211); }
      if (den.event) { await p.evaluate(() => willowmere.test.lavaEvent('normal')); await p.waitForFunction(id => willowmere.wilds().creatures.find(c => c.id === id).hp === 0, den.id, { timeout: 20000 }); await p.evaluate(() => willowmere.test.lavaEvent(null)); }
      await v.context.close();
    }
    assert.deepEqual([...seen].sort(), Object.keys(SHOWN).sort(), `${view}: each of the seven skills was shown once`);
  }

  // ---------------------------------------------------------------- 4. the lands' own creatures, and what a frame costs there
  if (sections.includes('4')) {
    // One stand a region, box open, in the thick of its creatures (the seeded creature with the most neighbours within 12 m, the
    // player 3.5 m from it on their side): its kinds are there, at its level and power, and the draw calls and triangles are recorded.
    const seeded = []; for (let cx = -11; cx <= 10; cx++) for (let cz = -11; cz <= 10; cz++) seeded.push(...wildCell(cx, cz).filter(c => !c.id.startsWith('w:den:')));
    const thick = id => {
      const mine = seeded.filter(c => c.region === id), around = c => mine.filter(o => o !== c && Math.hypot(o.x - c.x, o.z - c.z) < 12), best = mine.slice().sort((a, b) => around(b).length - around(a).length)[0], near = around(best);
      const mx = near.reduce((n, c) => n + c.x, 0) / (near.length || 1) || best.x + 1, mz = near.reduce((n, c) => n + c.z, 0) / (near.length || 1) || best.z, d = Math.hypot(mx - best.x, mz - best.z) || 1;
      return [+(best.x + (mx - best.x) / d * 3.5).toFixed(1), +(best.z + (mz - best.z) / d * 3.5).toFixed(1)];
    };
    for (const view of views) for (const id of Object.keys(REGION).filter(id => id !== 'village')) {
      const [x, z] = thick(id);
      const v = await open(view, { x, z }), p = v.page; await p.evaluate(() => willowmere.test.invulnerable(true));
      await p.waitForFunction(() => willowmere.wilds().count > 0 && willowmere.wilds().creatures.some(c => c.shown), null, { timeout: 60000 });
      if (LAND_KITS[id]) await p.waitForFunction(file => willowmere.wilds().kits.includes(file), LAND_KITS[id][0], { timeout: 60000 });
      await p.waitForTimeout(1500);
      const w = await wilds(p), mine = w.creatures.filter(c => c.region === id && !c.id.startsWith('w:den:')), info = REGION[id];
      assert.equal(w.zone, id); assert.ok(mine.length >= 3, `${id}: ${mine.length} of its creatures in the window`);
      for (const c of mine) { assert.equal(c.level, info.level, `${c.type} in ${id} is Lv ${info.level}`); assert.equal(c.maxHp, Math.round(CREATURES[c.type].hp * c.power)); assert.equal(regionAt(c.x, c.z), id, `${c.type} stays in ${id}`); }
      const n = await calls(p); numbers.push({ at: `stand ${id} (${x}, ${z})`, view, quality: qualityOf(view), calls: n?.calls, triangles: n?.triangles, creatures: w.count, shown: w.visible });
      await shot(v, `land-${id}`); if (view === views[0]) results.push({ name: `${info.name}: ${[...new Set(mine.map(c => c.type))].join(', ')}`, level: info.level, count: mine.length });
      await v.context.close();
    }
  }
  // ---------------------------------------------------------------- 5. the lands' own features (builder B's), as the creatures meet them
  if (sections.includes('5')) {
    const seeded = []; for (let cx = -11; cx <= 10; cx++) for (let cz = -11; cz <= 10; cz++) seeded.push(...wildCell(cx, cz).filter(c => !c.id.startsWith('w:den:')));
    const toward = (c, gap) => { const s = squareOf(c.region), dx = s.cx - c.x, dz = s.cz - c.z, d = Math.hypot(dx, dz) || 1; return { x: +(c.x + dx / d * gap).toFixed(1), z: +(c.z + dz / d * gap).toFixed(1) }; };
    // The Beach's sea (land-features.mjs waterAt): its two kinds live in it, and are drawn half a metre down while in water.
    const wet = seeded.filter(c => CREATURES[c.type].where === 'sea'), around = c => wet.filter(o => Math.hypot(o.x - c.x, o.z - c.z) < 30).length;
    assert.ok(wet.length >= 4 && wet.every(c => waterAt(c.x, c.z)) && new Set(wet.map(c => c.type)).size === 2, `the sea's two kinds are seeded in the sea (${wet.length})`);
    const swim = wet.slice().sort((a, b) => around(b) - around(a))[0];
    for (const view of views.filter(v => v !== 'landscape')) {
      const v = await open(view, toward(swim, 5)), p = v.page; await p.evaluate(() => willowmere.test.invulnerable(true));
      await p.waitForFunction(() => willowmere.wilds().creatures.some(c => (c.type === 'jellyzap' || c.type === 'hammershark') && c.shown), null, { timeout: 60000 });
      await p.waitForTimeout(1200);
      const seen = (await wilds(p)).creatures.filter(c => (c.type === 'jellyzap' || c.type === 'hammershark') && c.shown && c.hp > 0);
      // They are seeded in the sea; like any creature they may follow you onto the sand (spec 3.2), and only in water are they drawn sunk.
      for (const c of seen) { const sunk = waterAt(c.x, c.z) ? -.5 : 0; assert.ok(Math.abs(c.y - sunk) < .08, `${c.type} at ${c.x.toFixed(1)}, ${c.z.toFixed(1)} is drawn at ${c.y}, not ${sunk}`); }
      assert.ok(seen.some(c => waterAt(c.x, c.z)), 'one of them is in the water');
      await shot(v, 'sea-kinds'); if (view === views[0]) results.push({ name: 'the Beach: the jellyfish and the hammerhead live in the sea, drawn 0.5 m down', seeded: wet.length, seen: seen.map(c => c.type) });
      await v.context.close();
    }
    // The Night Land's dark (land-view.mjs #night-layer): outside every light a creature is hidden and its eyes glint; the nearest
    // glints are holes of their own in the dark (world.lands.creatureHoles), so the layer has more holes than the lands' own lights.
    for (const view of views.filter(v => v !== 'landscape')) {
      const v = await open(view, { x: 256, z: 0 }), p = v.page; await p.evaluate(() => willowmere.test.invulnerable(true));
      await p.waitForFunction(() => typeof willowmere.lands === 'function' && willowmere.lands().opacity > .9, null, { timeout: 60000 });
      await p.waitForFunction(() => willowmere.wilds().glints > 0, null, { timeout: 60000 });
      const w = await wilds(p), l = await p.evaluate(() => willowmere.lands()), mask = await p.evaluate(() => { const e = document.getElementById('night-layer'); return ((e.style.maskImage || e.style.webkitMaskImage || '').match(/radial-gradient/g) ?? []).length; });
      const near = w.creatures.filter(c => c.hp > 0 && c.distance > 4.5 && c.distance < 22);
      assert.ok(near.length > 0 && near.every(c => !c.shown), `outside every light the creatures are hidden (${near.map(c => `${c.type} ${c.distance.toFixed(1)} m ${c.shown}`).join(', ')})`);
      assert.ok(w.glints >= 1 && w.glints <= near.length, `${w.glints} pairs of eyes for ${near.length} hidden creatures`);
      assert.ok(mask > l.holes, `the eyes are holes in the dark too (${mask} holes, ${l.holes} of them the lands' own)`);
      await shot(v, 'night-glints'); if (view === views[0]) results.push({ name: 'the Night Land: creatures hidden outside every light, their eyes glinting and lighting small holes', glints: w.glints, holes: mask, landHoles: l.holes });
      await v.context.close();
    }
    // A lit lamp (land-effects.mjs lampAt, through Wilds host.noGo): no creature steps into its light, even after you.
    {
      const near = l => seeded.filter(c => c.region === 'shadow' && Math.hypot(c.x - l.x, c.z - l.z) < 24).length;
      const lamp = FEATURES.shadow.lamps.filter(l => !seeded.some(c => Math.hypot(c.x - l.x, c.z - l.z) < l.r + 1)).sort((a, b) => near(b) - near(a))[0], lampIndex = FEATURES.shadow.lamps.indexOf(lamp);
      const v = await open('desktop', { x: lamp.x + 1.8, z: lamp.z }), p = v.page; await p.evaluate(() => willowmere.test.invulnerable(true));
      await p.waitForFunction(() => typeof willowmere.lands === 'function' && willowmere.wilds().count > 0, null, { timeout: 60000 }); await p.waitForTimeout(1000);
      await p.keyboard.press('e'); await p.waitForFunction(i => willowmere.lands().lamps[i] > 0, lampIndex, { timeout: 20000 });
      // A creature that came after you before the light was lit is already inside: it is left where it is (every step it could take is
      // in the light). Every other one must stay out of it.
      const inside = new Set((await wilds(p)).creatures.filter(c => Math.hypot(c.x - lamp.x, c.z - lamp.z) < lamp.r).map(c => c.id));
      let closest = Infinity, chasing = 0;
      for (let t = 0; t < 12; t++) {
        await p.waitForTimeout(1000); const w = await wilds(p);
        for (const c of w.creatures) { if (c.hp <= 0 || c.region !== 'shadow' || inside.has(c.id)) continue; closest = Math.min(closest, Math.hypot(c.x - lamp.x, c.z - lamp.z)); if (['chase', 'attack', 'windup', 'charge'].includes(c.phase)) chasing++; }
      }
      assert.ok(closest >= lamp.r - .05, `no creature steps into the lamp's light (${closest.toFixed(2)} m from it, light ${lamp.r} m; ${inside.size} already inside when it was lit)`);
      await shot(v, 'night-lamp-keeps-out'); results.push({ name: 'a lit lamp: no creature steps into its light', lamp: lampIndex, closest: +closest.toFixed(2), chasingSamples: chasing, insideWhenLit: inside.size });
      await v.context.close();
    }
    // The dragon's nest (land-view.mjs setNest): its arrival tells the lands, which keep the stage they draw the basin by.
    {
      const den = DENS.find(d => d.event), v = await open('desktop', beside(den)), p = v.page; await p.evaluate(() => willowmere.test.invulnerable(true));
      await p.waitForFunction(id => willowmere.wilds().creatures.some(c => c.id === id), den.id, { timeout: 60000 });
      await p.evaluate(() => willowmere.test.lavaEvent('dragon')); await p.waitForFunction(id => willowmere.wilds().creatures.find(c => c.id === id).hp > 0, den.id, { timeout: 20000 });
      await p.waitForFunction(() => willowmere.lands().nest === 1, null, { timeout: 20000 });
      results.push({ name: 'the dragon arrives at its nest: the lands are told (setNest 1)', nest: (await p.evaluate(() => willowmere.lands())).nest });
      await p.evaluate(() => willowmere.test.lavaEvent('normal')); await v.context.close();
    }
  }
  assert.deepEqual(errors, [], 'no page errors and no failed requests');
  console.log(JSON.stringify({ ok: true, results, numbers }, null, 1));
} catch (error) { console.error(error); console.log(JSON.stringify({ ok: false, results, errors }, null, 1)); process.exitCode = 1; }
finally {
  await writeFile('test-results/bosses-results.json', JSON.stringify({ results, numbers, errors }, null, 1));
  if (evidence) await writeFile(`${evidence}/bosses-results.json`, JSON.stringify({ results, numbers, errors }, null, 1));
  await browser.close();
}
