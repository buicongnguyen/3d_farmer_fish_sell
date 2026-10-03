// The Pandora box in a real browser: the chest and its Open / Close panel at home, no creatures (and no creature file)
// while it is shut, creatures only outside the village ward while it is open, a fight with real taps and keys (target,
// basic attack, skills, coins, loot), creatures ignoring a driver, the gentle knock-out, shutting the box again, and the
// fight HUD on 1440x900, 390x844 and 844x390.
//
//   GAME_URL=http://127.0.0.1:<port> node tests/pandora-browser.mjs      (GPU=1 uses the real GPU instead of SwiftShader)
//
// Screenshots and pandora-results.json go to test-results/. Reads only window.willowmere (snapshot, metrics, targets,
// wilds); everything is driven by pointer and keyboard like a player.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshState, SAVE_KEY } from '../src/game.mjs';
import { SAFE, inSafeZone } from '../src/wilds.mjs';

const url = process.env.GAME_URL ?? 'http://127.0.0.1:4173';
const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome', headless: true, args: process.env.GPU ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [], results = [], requests = [];
await mkdir('test-results', { recursive: true });
const VIEWS = { desktop: { viewport: { width: 1440, height: 900 } }, phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, landscape: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true } };

async function setup(view, change) {
  const seed = freshState(); seed.started = true; change?.(seed);
  const context = await browser.newContext({ ...VIEWS[view], deviceScaleFactor: 1 });
  await context.addInitScript(({ key, seed }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(seed)); }, { key: SAVE_KEY, seed });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message)); page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); }); page.on('request', r => requests.push(r.url()));
  await page.goto(url); await page.waitForFunction(() => window.willowmere?.metrics().ready, null, { timeout: 90000 });
  await (VIEWS[view].hasTouch ? page.locator('#begin').tap() : page.locator('#begin').click());
  await page.waitForFunction(() => typeof willowmere.wilds === 'function', null, { timeout: 15000 });
  const tap = (x, y) => VIEWS[view].hasTouch ? page.touchscreen.tap(x, y) : page.mouse.click(x, y);
  return { page, context, tap, size: VIEWS[view].viewport };
}
const wilds = p => p.evaluate(() => willowmere.wilds());
const snapshot = p => p.evaluate(() => willowmere.snapshot());
const metrics = p => p.evaluate(() => willowmere.metrics());
const box = (p, selector) => p.locator(selector).first().boundingBox();
const overlap = (a, b) => !!a && !!b && a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const creatureFiles = () => requests.filter(u => u.includes('wild-creatures')).length;
/** The nearest living creature that is on screen, clear of the HUD. */
async function nearestOnScreen(p, size, type) {
  const w = await wilds(p);
  return w.creatures.filter(c => c.shown && c.hp > 0 && (!type || c.type === type) && c.screen.x > 70 && c.screen.x < size.width - 70 && c.screen.y > 150 && c.screen.y < size.height - 170).sort((a, b) => a.distance - b.distance)[0];
}

try {
  // ---------------------------------------------------------------- shut: a peaceful world, nothing fetched, no fight HUD
  {
    const { page: p, context } = await setup('desktop', s => { s.position = { x: 130, z: 10 }; });
    await p.waitForTimeout(1200);
    let w = await wilds(p); assert.equal(w.open, false); assert.equal(w.count, 0); assert.equal(w.loaded, false); assert.equal(w.ward, false);
    assert.equal(creatureFiles(), 0, 'no creature file while the box is shut');
    for (const id of ['#hp-meter', '#pandora-chip', '#combat-pad', '#target-frame', '#boss-bar']) assert.equal(await p.locator(id).isHidden(), true, `${id} hidden`);
    await p.keyboard.press('1'); await p.keyboard.press('f'); await p.keyboard.down('d'); await p.waitForTimeout(900); await p.keyboard.up('d');
    w = await wilds(p); assert.equal(w.count, 0); assert.deepEqual(w.cooldowns, [0, 0, 0]); assert.equal((await snapshot(p)).hp, 100);
    results.push({ name: 'box shut: no creatures in the fields, no creature file, no fight HUD', drawCalls: (await metrics(p)).drawCalls });
    await p.screenshot({ path: 'test-results/pandora-01-shut-fields.png' }); await context.close();
  }
  // ---------------------------------------------------------------- at home: the chest, the panel, the switch
  {
    const { page: p, context, tap } = await setup('desktop', s => { s.position = { x: 0, z: -8.2 }; });
    await p.keyboard.press('e'); await p.waitForFunction(() => willowmere.metrics().location === 'interior', null, { timeout: 15000 }); await p.waitForTimeout(900);
    const target = await p.evaluate(() => willowmere.targets().find(t => t.type === 'pandora')); assert.ok(target, 'the chest is a target in your home'); assert.equal(target.label, 'Use the Pandora box');
    assert.equal(await p.locator('.room-label', { hasText: 'Pandora box' }).count(), 1);
    await p.screenshot({ path: 'test-results/pandora-02-home-shut.png' });
    const chest = (await wilds(p)).chest; assert.ok(chest.loaded, 'the chest model is loaded'); await tap(chest.screen.x, chest.screen.y);
    await p.waitForSelector('#modal-title:has-text("The Pandora box")', { timeout: 15000 });
    assert.equal(await p.locator('[data-action="pandora-set"]').count(), 2); assert.equal(await p.locator('[data-action="pandora-set"][data-open="false"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await p.locator('#modal-backdrop.docked').count(), 1, 'the panel docks to the right on a desktop, like the other menus');
    await p.screenshot({ path: 'test-results/pandora-03-panel-shut.png' });
    await p.locator('[data-action="pandora-set"][data-open="true"]').click();
    await p.waitForFunction(() => willowmere.snapshot().pandora === true); assert.equal(await p.locator('[data-action="pandora-set"][data-open="true"]').getAttribute('aria-pressed'), 'true');
    assert.ok(await p.locator('#modal .gear-stats').isVisible(), 'the stats strip shows in the panel'); await p.screenshot({ path: 'test-results/pandora-04-panel-open.png' });
    await p.getByRole('button', { name: 'Close panel', exact: true }).click();
    await p.waitForFunction(() => willowmere.wilds().ready, null, { timeout: 20000 }); assert.equal(creatureFiles(), 1, 'the creature file is fetched once, at the first open');
    assert.equal(await p.locator('#hp-meter').isVisible(), true); assert.match(await p.locator('#pandora-chip').innerText(), /Pandora: open/);
    await p.waitForFunction(() => willowmere.wilds().chest.lift > .9, null, { timeout: 5000 }); await p.screenshot({ path: 'test-results/pandora-05-home-open.png' });
    // The bag and the wardrobe show what gear is worth now.
    await p.locator('[data-panel="bag"]').click(); assert.match(await p.locator('#modal .gear-stats').innerText(), /100\s*\/\s*100/); await p.getByRole('button', { name: 'Close panel', exact: true }).click();
    const wardrobe = await p.locator('.room-label', { hasText: 'Wardrobe' }).boundingBox(); await tap(wardrobe.x + wardrobe.width / 2, wardrobe.y + wardrobe.height / 2); // the chip sits on the wardrobe itself
    await p.waitForSelector('#modal-backdrop:not([hidden]) :is(.gear-stats, .stat-strip)', { timeout: 20000 }); await p.getByRole('button', { name: 'Close panel', exact: true }).click();
    // The save remembers; a reload comes back open.
    await p.reload(); await p.waitForFunction(() => window.willowmere?.metrics().ready); assert.equal((await snapshot(p)).pandora, true);
    results.push({ name: 'the chest at home: panel, Open switch, HUD chip, stats strip in bag and wardrobe, saved' }); await context.close();
  }
  // ---------------------------------------------------------------- open: creatures outside the ward only; a real fight
  {
    const { page: p, context, tap, size } = await setup('desktop', s => { s.pandora = true; s.position = { x: 112, z: 6 }; s.coins = 300; });
    await p.waitForFunction(() => willowmere.wilds().ready && willowmere.wilds().visible > 0 && willowmere.wilds().awake > 0, null, { timeout: 30000 });
    let w = await wilds(p); assert.ok(w.count >= 8, `creatures in the fields (${w.count})`); assert.equal(w.cells, 25); assert.ok(w.ward && w.fighting && w.zone === 'east');
    assert.ok(w.creatures.every(c => !inSafeZone(c.x, c.z)), 'no creature inside the village ward');
    assert.equal(await p.locator('#combat-pad').isVisible(), true); assert.equal(await p.locator('#combat-pad .skill').count(), 4);
    const closed = results[0].drawCalls, open = (await metrics(p)).drawCalls; results.push({ name: 'box open in the fields', creatures: w.count, awake: w.awake, shown: w.visible, drawCalls: open, drawCallsShut: closed });
    // Tap a creature: it becomes the target, the player walks in and fights until it falls.
    const foe = await nearestOnScreen(p, size); assert.ok(foe, 'a creature is on screen'); const before = await snapshot(p);
    await tap(foe.screen.x, foe.screen.y); await p.waitForFunction(id => willowmere.wilds().selected === id, foe.id, { timeout: 5000 });
    await p.waitForSelector('#target-frame:not([hidden])', { timeout: 15000 }); assert.ok((await p.locator('#target-frame strong').innerText()).length > 3);
    await p.waitForFunction(id => { const c = willowmere.wilds().creatures.find(c => c.id === id); return c && c.hp < c.maxHp; }, foe.id, { timeout: 25000 });
    await p.screenshot({ path: 'test-results/pandora-06-fight-desktop.png' });
    // Skills on 1 and 3 (2 is the dash, which moves the player; it is checked on its own below).
    await p.keyboard.press('1'); await p.waitForFunction(() => willowmere.wilds().cooldowns[0] > 0); await p.waitForSelector('#combat-pad .skill-spin.cooling', { timeout: 3000 });
    await p.keyboard.press('3'); await p.waitForFunction(() => willowmere.wilds().cooldowns[2] > 0);
    await p.waitForFunction(id => willowmere.wilds().creatures.find(c => c.id === id)?.hp === 0, foe.id, { timeout: 60000 });
    await p.waitForFunction(coins => willowmere.snapshot().coins > coins, before.coins, { timeout: 5000 });
    const after = await snapshot(p); assert.ok(after.coins > before.coins, 'the creature paid coins'); assert.ok(after.hp > 0 && after.hp <= 100);
    await p.screenshot({ path: 'test-results/pandora-07-after-fight.png' });
    // The dash carries the player several metres at once.
    const at = (await metrics(p)).position; await p.keyboard.press('2'); await p.waitForTimeout(450); const to = (await metrics(p)).position;
    assert.ok(Math.hypot(to.x - at.x, to.z - at.z) > 3, 'dash moved the player'); assert.ok((await wilds(p)).cooldowns[1] > 0);
    results.push({ name: 'tap to target, basic attack, skills 1/2/3 with cooldowns, coins on defeat', foe: foe.type, coins: after.coins - before.coins, hp: Math.round(after.hp) });
    // Fight on in test mode (three times the damage) until some loot has been picked up.
    await context.close();
  }
  {
    const { page: p, context, tap, size } = await setup('desktop', s => { s.pandora = true; s.position = { x: 150, z: 30 }; s.settings.test = true; s.coins = 0; });
    await p.waitForFunction(() => willowmere.wilds().ready && willowmere.wilds().visible > 0, null, { timeout: 30000 });
    const basket = JSON.stringify((await snapshot(p)).inventory); let kills = 0;
    for (let i = 0; i < 14 && JSON.stringify((await snapshot(p)).inventory) === basket; i++) {
      const foe = await nearestOnScreen(p, size); if (!foe) { await p.keyboard.down('d'); await p.waitForTimeout(600); await p.keyboard.up('d'); continue; }
      await tap(foe.screen.x, foe.screen.y);
      await p.waitForFunction(id => { const c = willowmere.wilds().creatures.find(c => c.id === id); return !c || c.hp === 0; }, foe.id, { timeout: 40000 }); kills++;
      await p.waitForTimeout(1800); // loot lands, then the magnet pulls it in
    }
    const s = await snapshot(p); assert.notEqual(JSON.stringify(s.inventory), basket, `loot reached the basket after ${kills} creatures`); assert.ok(s.coins > 0);
    results.push({ name: 'loot is tossed, pulled in and lands in the basket', kills, coins: s.coins, inventory: s.inventory }); await context.close();
  }
  // ---------------------------------------------------------------- worn gear: it counts while open, it is only for looks while shut
  {
    const worn = s => { s.position = { x: 150, z: 30 }; s.gearOwned = ['hat_bear', 'armor_leather', 'boots_cowboy', 'sword_candy', 'pet_parrot']; s.gear = { hat: 'hat_bear', wear: 'armor_leather', boots: 'boots_cowboy', weapon: 'sword_candy', pet: 'pet_parrot' }; s.hp = 9999; };
    const { page: p, context, tap, size } = await setup('desktop', s => { worn(s); s.pandora = true; });
    await p.waitForFunction(() => willowmere.wilds().ready && willowmere.wilds().visible > 0 && willowmere.wilds().awake > 0, null, { timeout: 30000 });
    let w = await wilds(p); assert.equal(w.maxHp, 185, 'bear hat +40, leather outfit +25, cowboy boots +20'); assert.equal(Math.round(w.hp), 185); assert.match(await p.locator('#hp-meter').innerText(), /185/);
    const foe = await nearestOnScreen(p, size); assert.ok(foe); await tap(foe.screen.x, foe.screen.y);
    await p.waitForFunction(id => { const c = willowmere.wilds().creatures.find(c => c.id === id); return !c || c.hp === 0; }, foe.id, { timeout: 40000 });
    await p.screenshot({ path: 'test-results/pandora-07b-gear-fight.png' }); results.push({ name: 'worn gear counts while the box is open (185 health, a sword)', foe: foe.type }); await context.close();
    const shut = await setup('desktop', s => { worn(s); });
    await shut.page.waitForTimeout(1200); assert.equal(await shut.page.locator('#hp-meter').isHidden(), true); assert.equal((await wilds(shut.page)).count, 0); assert.equal((await snapshot(shut.page)).gear.weapon, 'sword_candy', 'the gear is still worn');
    results.push({ name: 'the same gear with the box shut: worn for looks, no health meter, no creatures' }); await shut.context.close();
    // Speed is a stat too: rocket boots (+25 %) carry you farther in the same time, only while the box is open.
    const walked = async open => { const t = await setup('desktop', s => { s.position = { x: 0, z: 30 }; s.pandora = open; s.gearOwned = ['boots_rocket']; s.gear = { hat: '', wear: '', boots: 'boots_rocket', weapon: '', pet: '' }; });
      await t.page.waitForTimeout(600); const a = (await metrics(t.page)).position; await t.page.keyboard.down('d'); await t.page.waitForTimeout(1500); const b = (await metrics(t.page)).position; await t.page.keyboard.up('d'); await t.context.close(); return Math.hypot(b.x - a.x, b.z - a.z); };
    const plain = await walked(false), quick = await walked(true); assert.ok(quick > plain * 1.1 && quick < plain * 1.45, `rocket boots: ${plain.toFixed(2)} m shut, ${quick.toFixed(2)} m open`);
    results.push({ name: 'gear speed counts while open', shut: +plain.toFixed(2), open: +quick.toFixed(2) });
  }
  // ---------------------------------------------------------------- driving: creatures leave you alone
  {
    const { page: p, context } = await setup('desktop', s => { s.pandora = true; s.bike = true; s.position = { x: 5, z: -6.5 }; });
    await p.keyboard.press('e'); await p.waitForFunction(() => document.querySelector('#location-text').textContent.includes('motorcycle'));
    // East by south-east, past the pond and out by the east road (the old course north of the barn now ends at the supermarket's front).
    await p.keyboard.down('d'); await p.keyboard.down('s'); await p.keyboard.down('Shift');
    await p.waitForFunction(x => willowmere.metrics().position.x > x, SAFE.x1 + 30, { timeout: 60000 }); await p.keyboard.up('d'); await p.keyboard.up('s'); await p.keyboard.up('Shift');
    await p.waitForTimeout(2500); const w = await wilds(p), s = await snapshot(p);
    assert.equal(w.fighting, false); assert.equal(s.hp, 100, 'nothing hurt the driver'); assert.ok(w.creatures.filter(c => c.distance < 20).every(c => c.phase === 'idle'), 'creatures near a driver stay calm');
    assert.ok(await p.locator('#combat-pad.off').count(), 'the skills are dimmed while driving');
    await p.screenshot({ path: 'test-results/pandora-08-driving.png' }); results.push({ name: 'creatures ignore a driver; the skills are off while driving' }); await context.close();
  }
  // ---------------------------------------------------------------- knock-out, then shut the box
  {
    // The stand is six metres from a seeded cactus of the Redrock Canyon (at 86.7, -9), whose spine cannot be dodged standing still.
    // (Round 8 reseeded the fields by region: at the old stand, (100, 0), one crab is all there is, and bare hands beat it.)
    const { page: p, context, tap } = await setup('desktop', s => { s.pandora = true; s.position = { x: 92.5, z: -9 }; s.hp = 6; s.coins = 400; s.inventory.hide = 3; });
    await p.waitForFunction(() => willowmere.metrics().location === 'interior', null, { timeout: 60000 });
    await p.waitForSelector('#modal-title:has-text("A little rest")'); let s = await snapshot(p); assert.equal(await p.locator('#modal-backdrop.docked').count(), 0, 'the wake-up card stays centred');
    assert.equal(s.coins, 380, '5 % of 400 coins'); assert.equal(s.hp, 100); assert.equal(s.inventory.hide, 3, 'the basket is safe'); assert.ok(inSafeZone(s.position.x, s.position.z));
    await p.screenshot({ path: 'test-results/pandora-09-knockout.png' }); await p.locator('#modal .primary[data-action="close"]').click(); await p.waitForTimeout(300);
    const chest = (await wilds(p)).chest; await tap(chest.screen.x, chest.screen.y); await p.waitForSelector('#modal-title:has-text("The Pandora box")', { timeout: 15000 });
    await p.locator('[data-action="pandora-set"][data-open="false"]').click(); await p.waitForFunction(() => willowmere.snapshot().pandora === false);
    await p.getByRole('button', { name: 'Close panel', exact: true }).click();
    for (const id of ['#hp-meter', '#pandora-chip', '#combat-pad']) assert.equal(await p.locator(id).isHidden(), true, `${id} hidden again`);
    const door = await p.evaluate(() => willowmere.targets().find(t => t.type === 'exit')); await tap(door.screen.x, door.screen.y);
    await p.waitForFunction(() => willowmere.metrics().location === 'village', null, { timeout: 20000 }); await p.waitForTimeout(700);
    const w = await wilds(p); assert.equal(w.count, 0); assert.equal(w.ward, false); assert.equal(w.open, false);
    results.push({ name: 'knock-out wakes you at home (5 % of coins, basket safe); shutting the box empties the fields' }); await context.close();
  }
  // ---------------------------------------------------------------- despawn is smooth: shut while creatures are near
  {
    const { page: p, context } = await setup('desktop', s => { s.pandora = true; s.position = { x: 150, z: 30 }; });
    await p.waitForFunction(() => willowmere.wilds().count > 5, null, { timeout: 30000 });
    // A save that arrives shut (import, another tab) empties the fields the same way as the switch at home.
    const shut = freshState(); shut.started = true; shut.position = { x: 150, z: 30 }; p.once('dialog', d => d.accept());
    await p.locator('#import-file').setInputFiles({ name: 'shut.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(shut)) });
    await p.waitForFunction(() => willowmere.snapshot().pandora === false); await p.locator('#modal-backdrop').evaluate(() => 0);
    if (await p.locator('#modal-backdrop').isVisible()) await p.getByRole('button', { name: 'Close panel', exact: true }).click().catch(() => {});
    await p.waitForFunction(() => willowmere.wilds().count === 0, null, { timeout: 5000 });
    results.push({ name: 'creatures leave within a moment when the box shuts' }); await context.close();
  }
  // ---------------------------------------------------------------- the fight HUD on phones
  for (const view of ['phone', 'landscape']) {
    const { page: p, context, tap, size } = await setup(view, s => { s.pandora = true; s.position = { x: 112, z: 6 }; });
    await p.waitForFunction(() => willowmere.wilds().ready && willowmere.wilds().visible > 0, null, { timeout: 30000 });
    const foe = await nearestOnScreen(p, size) ?? (await wilds(p)).creatures.filter(c => c.shown).sort((a, b) => a.distance - b.distance)[0];
    await tap(Math.max(40, Math.min(size.width - 40, foe.screen.x)), Math.max(130, Math.min(size.height - 150, foe.screen.y)));
    await p.waitForSelector('#target-frame:not([hidden]), #boss-bar:not([hidden])', { timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(600); await p.screenshot({ path: `test-results/pandora-10-fight-${view}.png` });
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no horizontal overflow');
    const skills = await p.locator('#combat-pad .skill:visible').all(); assert.equal(skills.length, 3, 'three skills (ACT is the attack on touch)');
    const act = await box(p, '#touch-action'), stick = await box(p, '#joystick'), frame = await box(p, '#target-frame'), hp = await box(p, '#hp-meter'), chip = await box(p, '#pandora-chip'), boxes = [];
    for (const s of skills) {
      const b = await s.boundingBox(); boxes.push(b);
      assert.ok(b.width >= 44 && b.height >= 44, `skill is at least 44 px (${b.width})`); assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.width <= size.width && b.y + b.height <= size.height, 'skill inside the screen');
      assert.ok(!overlap(b, act) && !overlap(b, stick) && !overlap(b, frame), 'skill clear of ACT, the joystick and the target frame');
    }
    for (let i = 0; i < boxes.length; i++) for (let k = i + 1; k < boxes.length; k++) assert.ok(!overlap(boxes[i], boxes[k]), 'skills do not overlap each other');
    assert.ok(hp && chip && hp.width > 60, 'health meter and chip are shown'); assert.ok(!overlap(frame, stick) && !overlap(frame, act), 'target frame clear of the controls');
    // A skill by touch: the cooldown starts.
    await skills[0].tap(); await p.waitForFunction(() => willowmere.wilds().cooldowns.some(c => c > 0), null, { timeout: 5000 });
    // ACT is the attack while a creature is in reach.
    const reachable = await p.waitForFunction(() => /^Attack/.test(document.querySelector('#interact span').textContent), null, { timeout: 25000 }).then(() => true, () => false);
    if (reachable) { const hpBefore = (await wilds(p)).creatures.reduce((n, c) => n + c.hp, 0); await p.locator('#touch-action').tap(); await p.waitForTimeout(700); assert.ok((await wilds(p)).creatures.reduce((n, c) => n + c.hp, 0) <= hpBefore); }
    results.push({ name: `fight HUD on ${view} ${size.width}x${size.height}`, skills: boxes.map(b => [Math.round(b.x), Math.round(b.y), Math.round(b.width)]), act: act && [Math.round(act.x), Math.round(act.y)], drawCalls: (await metrics(p)).drawCalls }); await context.close();
  }
  assert.deepEqual(errors, []);
  await writeFile('test-results/pandora-results.json', JSON.stringify({ url, results, errors }, null, 2));
  console.log(JSON.stringify({ results, errors }, null, 2));
} catch (error) { console.error(error); console.error(JSON.stringify({ results, errors }, null, 2)); process.exitCode = 1; } finally { await browser.close(); }
