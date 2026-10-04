// Round 8 fix, in a real browser: what the HUD says when you wake far out, and where the phone's HUD pieces sit.
//   1. A save 140-280 m out (the car is kept there now, spec 7) is greeted with the region's name, never "Welcome home. Meet Ada…";
//      the location line names the region (spec 5) and the idle action button the land, not the village. A new save is welcomed home.
//   2. On a phone the way-home guide is a small tag (under the round Home button in portrait, at the minimap's lower left in landscape):
//      it covers no boss callout, minimap, caption or chip, and the album card stops short of the Home button. On the PC nothing
//      overlaps either.
//
//   GAME_URL=http://127.0.0.1:<port> GPU=1 node tests/wake-browser.mjs   (EVIDENCE=<folder> for the shots; travel-kit.mjs)
import assert from 'node:assert/strict';
import { launch, open, begin, metrics, shot, save, clearSpot, VIEWS } from './travel-kit.mjs';
import { REGION, DENS, regionAt } from '../src/regions.mjs';
import { WELCOME } from '../src/wake.mjs';
import { BOSS_CALLOUTS } from '../src/boss-patterns.mjs';

const browser = await launch(), results = [], errors = [];
const toast = page => page.locator('#toast').textContent();
const words = page => page.evaluate(() => ({ toast: document.getElementById('toast').textContent, location: document.getElementById('location-text').textContent, idle: document.querySelector('#interact span').textContent, interactShown: getComputedStyle(document.getElementById('interact')).display !== 'none' && !!document.getElementById('interact').offsetParent }));
/** Every HUD box that is on screen, by name, in CSS pixels. */
const boxes = page => page.evaluate(() => {
  const out = {}, pick = { home: '.home-button', guide: '#home-guide', album: '.quest-tracker', minimap: '.minimap', caption: '#map-caption', day: '#calendar', card: '.player-card', chip: '#pandora-chip', land: '#land-status', banner: '#region-banner', toast: '#toast.show', bar: '#boss-bar', callout: '.float.callout:not([hidden])', top: '.top-actions' };
  for (const [name, sel] of Object.entries(pick)) for (const el of document.querySelectorAll(sel)) { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); if (el.hidden || cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0 || r.width < 1 || r.height < 1) continue; out[name] = { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom, text: el.textContent.trim().slice(0, 40) }; }
  return out;
});
const meet = (a, b, pad = 0) => a.x0 < b.x1 - pad && a.x1 > b.x0 + pad && a.y0 < b.y1 - pad && a.y1 > b.y0 + pad;
/** The way-home guide and the round Home button overlap nothing else of the HUD. */
function clear(b, where) {
  for (const own of ['guide', 'home']) if (b[own]) for (const [name, o] of Object.entries(b)) if (name !== own && !(own === 'home' && name === 'guide') && !(own === 'guide' && name === 'home') && !['toast', 'banner', 'callout', 'bar'].includes(name)) assert.ok(!meet(b[own], o, .5), `${where}: ${own} over ${name} ${JSON.stringify(b[own])} ${JSON.stringify(o)}`);
}

try {
  // ---------------------------------------------------------------- 1. far out on foot, box shut: the region's words, then a reload keeps them
  for (const view of ['desktop', 'phone', 'landscape']) {
    const size = `${VIEWS[view].viewport.width}x${VIEWS[view].viewport.height}`, at = { x: 157, z: -21 };
    const { page: p, context, errors: e } = await open(browser, view, s => { s.position = { ...at }; }); errors.push(e);
    await p.waitForFunction(() => document.getElementById('toast').classList.contains('show'), null, { timeout: 10000 });
    let w = await words(p); assert.equal(regionAt(at.x, at.z), 'east');
    assert.equal(w.toast, 'Back in Redrock Canyon. Home is one tap away.', `${view}: the boot toast`); assert.doesNotMatch(w.toast, /Welcome home|Ada/);
    await p.waitForFunction(() => document.getElementById('location-text').textContent.startsWith('Redrock Canyon'), null, { timeout: 10000 });
    w = await words(p); assert.equal(w.location, 'Redrock Canyon · follow the birds home'); assert.equal(w.idle, 'Explore Redrock Canyon', `${view}: the idle button`);
    const b = await boxes(p); assert.ok(b.guide, `${view}: the way-home guide shows`); clear(b, `${view} canyon`);
    if (view === 'phone') { assert.ok(b.guide.y1 - b.guide.y0 <= 30 && b.guide.x1 - b.guide.x0 <= 90, `phone: the guide is a small tag (${JSON.stringify(b.guide)})`); assert.ok(b.guide.y1 < b.minimap.y1 + 4, 'phone: the guide sits beside the minimap, not below it in the play area'); assert.match(await p.locator('#home-distance').textContent(), /^\d+ m · tap to go home$/); }
    await shot(p, `wake-canyon-foot-${size}`); results.push({ view, case: 'canyon foot', ...w, guide: b.guide });
    // The location line is whole or ends in an ellipsis, starting with the region's name, at every size.
    await p.reload(); await begin(p, view); await p.waitForFunction(() => document.getElementById('toast').classList.contains('show'), null, { timeout: 10000 });
    assert.equal(await toast(p), 'Back in Redrock Canyon. Home is one tap away.', `${view}: after a reload`); await shot(p, `wake-canyon-reload-${size}`);
    await context.close();
  }

  // ---------------------------------------------------------------- 2. in the jeep 250 m out in the Night Land, with the album card showing
  for (const view of ['desktop', 'phone', 'landscape']) {
    const size = `${VIEWS[view].viewport.width}x${VIEWS[view].viewport.height}`, at = clearSpot(250, 0, 4);
    const { page: p, context, errors: e } = await open(browser, view, s => { s.coins = 5000; s.stats.sales = 999; s.riding = 'jeep'; s.position = { ...at }; s.vehicles = { jeep: { x: at.x, z: at.z, rot: 0 }, bike: null }; }); errors.push(e);
    await p.waitForFunction(() => document.getElementById('toast').classList.contains('show'), null, { timeout: 10000 });
    const w = await words(p); assert.equal(w.toast, 'Back in Night Land, in the jeep. Home is one tap away.');
    await p.waitForFunction(() => /^Night Land · Bell family jeep$/.test(document.getElementById('location-text').textContent), null, { timeout: 10000 });
    const b = await boxes(p); clear(b, `${view} night jeep`); if (b.album && b.home) assert.ok(!meet(b.album, b.home), `${view}: the album card runs under the Home button`);
    await shot(p, `wake-night-jeep-${size}`); results.push({ view, case: 'night jeep', ...w, album: b.album, home: b.home }); await context.close();
  }

  // ---------------------------------------------------------------- 3. a new save and a save at home: welcomed home, the village's words
  for (const view of ['desktop', 'phone']) {
    const size = `${VIEWS[view].viewport.width}x${VIEWS[view].viewport.height}`;
    for (const fresh of [true, false]) {
      const { page: p, context, errors: e } = await open(browser, view, s => { s.started = !fresh; s.position = { x: 0, z: -8 }; }); errors.push(e);
      await p.waitForFunction(() => document.getElementById('toast').classList.contains('show'), null, { timeout: 10000 });
      const w = await words(p); assert.equal(w.toast, WELCOME); assert.equal(w.location, 'Willowmere · home, at last'); assert.ok(['Explore your village'].includes(w.idle) || w.idle !== 'Explore Redrock Canyon');
      results.push({ view, case: fresh ? 'new save' : 'home save', ...w }); if (fresh) await shot(p, `wake-home-new-${size}`); await context.close();
    }
  }

  // ---------------------------------------------------------------- 4. phone, box open: the treant's SLAM callout and Clover's cage are not under the guide
  for (const view of ['phone', 'landscape']) {
    const size = `${VIEWS[view].viewport.width}x${VIEWS[view].viewport.height}`, den = DENS.find(d => d.type === 'treant');
    const { page: p, context, errors: e } = await open(browser, view, s => { s.pandora = true; s.pandoraSeen = true; s.settings.test = true; s.settings.quality = 'battery'; s.position = { x: den.x, z: den.z + 9 }; }); errors.push(e);
    await p.waitForFunction(id => willowmere.wilds?.().creatures.find(c => c.id === id)?.shown, den.id, { timeout: 90000 });
    await p.waitForFunction(id => { const c = willowmere.wilds().creatures.find(c => c.id === id); return c.hp > 0 && !['windup', 'charge', 'spin'].includes(c.phase); }, den.id, { timeout: 30000 });
    assert.equal(await p.evaluate(id => willowmere.test.skill(id, 'slam'), den.id), true);
    await p.waitForFunction(text => [...document.querySelectorAll('.float.callout')].some(el => !el.hidden && el.textContent === text), BOSS_CALLOUTS.slam, { timeout: 15000 });
    await p.waitForTimeout(200); const b = await boxes(p); await shot(p, `wake-treant-slam-${size}`);
    assert.ok(b.callout && b.guide, `${view}: callout and guide on screen`); assert.ok(!meet(b.callout, b.guide), `${view}: the SLAM callout is under the guide ${JSON.stringify(b.callout)} ${JSON.stringify(b.guide)}`);
    clear(b, `${view} treant`); results.push({ view, case: 'treant slam', callout: b.callout, guide: b.guide }); await context.close();
  }
  for (const view of ['phone']) {
    const size = `${VIEWS[view].viewport.width}x${VIEWS[view].viewport.height}`, den = DENS.find(d => d.type === 'bear');
    const { page: p, context, errors: e } = await open(browser, view, s => { s.pandora = true; s.pandoraSeen = true; s.settings.test = true; s.settings.quality = 'battery'; s.position = { x: den.x - 4, z: den.z + 16 }; }); errors.push(e);
    await p.waitForTimeout(2500); const b = await boxes(p); clear(b, `${view} clover cage`);
    const cage = await p.evaluate(() => { const out = []; for (const el of document.querySelectorAll('.friend-tag, .cage-tag, [class*="cage"]')) { const r = el.getBoundingClientRect(); if (r.width && !el.hidden && getComputedStyle(el).display !== 'none') out.push({ x0: r.left, y0: r.top, x1: r.right, y1: r.bottom, text: el.textContent.trim().slice(0, 30) }); } return out; });
    // A world label can pass under any HUD piece as you walk (it is drawn where its cage stands); what is checked is that the guide is
    // now a tag of at most 70 x 24 px in the HUD band beside the minimap, where the card was 160 x 60 px over the play area.
    await shot(p, `wake-clover-cage-${size}`);
    assert.ok(b.guide.x1 - b.guide.x0 <= 70 && b.guide.y1 - b.guide.y0 <= 24 && b.guide.y1 <= b.minimap.y1, `${view}: the guide is a small tag in the HUD band ${JSON.stringify(b.guide)}`); results.push({ view, case: 'clover cage', cage, guide: b.guide }); await context.close();
  }

  assert.deepEqual(errors.flat(), [], 'no page errors and no failed requests');
  await save('wake-results', results); console.log(JSON.stringify(results.map(r => ({ view: r.view, case: r.case, toast: r.toast, location: r.location, idle: r.idle }))));
  console.log('wake-browser: all checks passed');
} finally { await browser.close(); }
