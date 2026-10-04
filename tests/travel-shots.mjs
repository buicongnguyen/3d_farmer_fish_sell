// Evidence for builder C's part of round 8 (not a suite: nothing here asserts). It takes the screenshots spec 11.4 lists for C at the
// three screen sizes, and measures real draw calls and triangles (willowmere.calls(): the shadow pass is counted) against section 18.
//
//   GAME_URL=http://127.0.0.1:<port> GPU=1 node tests/travel-shots.mjs            the shots and the numbers
//   GAME_URL=… GPU=1 LIGHTS=1 node tests/travel-shots.mjs                          the light crossfade only: run it against a build whose
//       region-life.mjs LIGHTS has the lava and shadow rows (builder B's table; until B merges, a scratch build with spec 3.7's values)
//
// Shots go to the round's evidence folder (travel-kit.mjs EVIDENCE), numbers to test-results/travel-numbers.json and travel-lights.json.
import { launch, open, begin, metrics, shot, callStats, holdStick, save, clearSpot, VIEWS } from './travel-kit.mjs';
import { HALF, EDGE_PAD } from '../src/regions.mjs';

const browser = await launch(), numbers = [], EAST = Math.PI / 2 + .38;
const QUALITY = { desktop: 'high', phone: 'battery', landscape: 'battery' }, size = view => `${VIEWS[view].viewport.width}x${VIEWS[view].viewport.height}`;
const noon = s => { s.time = 12; };
const riding = (at, heading, id = 'jeep') => s => { noon(s); s.bike = true; s.stats.sales = 250; s.position = { ...at }; s.riding = id; s.heading = heading; s.vehicles[id] = { ...at, rot: heading }; };

try {
  if (process.env.LIGHTS) {
    // The light crossfade, on foot, box shut: 0, 12 and 24 m into the Ember Fields and into the Night Land, and 2 m from lava's outer edge.
    const rows = [];
    for (const view of ['desktop', 'phone', 'landscape']) for (const [name, x, z] of [['lava-00m', 0, 192.2], ['lava-12m', 0, 204], ['lava-24m', 0, 216], ['lava-outer-edge-2m', 0, HALF - EDGE_PAD], ['night-00m', 192.2, 0], ['night-12m', 204, 0], ['night-24m', 216, 0]]) {
      const { page: p, context } = await open(browser, view, s => { noon(s); s.position = { x, z }; }, { quality: QUALITY[view] });
      await p.waitForTimeout(900); const t = (await metrics(p)).journey; await shot(p, `light-${name}-${size(view)}`);
      rows.push({ view, name, at: [x, z], land: t.land, share: +t.landShare.toFixed(3), fog: t.fog, sky: t.sky, sun: t.sun, sunIntensity: +t.sunIntensity.toFixed(3) }); await context.close();
    }
    await save('travel-lights', rows); console.log(JSON.stringify(rows.filter(r => r.view === 'desktop'), null, 1));
  } else {
    for (const view of ['desktop', 'phone', 'landscape']) {
      const quality = QUALITY[view], touch = !!VIEWS[view].hasTouch;
      // Reload while driving at (250, 0): the state a reload leaves, then a real reload on top of it.
      { const { page: p, context } = await open(browser, view, riding(clearSpot(250, 0, 5), EAST), { quality }); await p.waitForTimeout(500); await p.reload(); await begin(p, view); await p.waitForTimeout(2500); await shot(p, `vehicle-reload-250-${size(view)}`); await context.close(); }
      // The car stopped at the world's edge (driven straight at it), and sliding along it (the D key: 22 degrees off square).
      { const at = { x: HALF - 30, z: 20 }, { page: p, context } = await open(browser, view, riding(touch ? at : { x: HALF - EDGE_PAD, z: 20 }, Math.PI / 2), { quality });
        if (touch) { const stick = await holdStick(p, context, 1, 0); await p.waitForFunction(line => willowmere.render().drive.riding.x > line - .8, HALF - EDGE_PAD, { timeout: 30000 }); await p.waitForTimeout(700); await shot(p, `edge-car-stopped-${size(view)}`); await stick.release(); }
        else { await p.keyboard.down('d'); await p.waitForTimeout(350); await p.keyboard.up('d'); await p.waitForTimeout(1800); await shot(p, `edge-car-stopped-${size(view)}`); }
        await context.close(); }
      { const { page: p, context } = await open(browser, view, riding({ x: HALF - 40, z: 40 }, EAST), { quality });
        await p.keyboard.down('d'); await p.waitForFunction(line => willowmere.render().drive.riding.x > line - .6, HALF - EDGE_PAD, { timeout: 30000 }); await p.waitForTimeout(900); await shot(p, `edge-car-sliding-${size(view)}`);
        const d = await p.evaluate(() => willowmere.render().drive.riding); numbers.push({ view, what: 'sliding along the east edge with D held', speed: +d.speed.toFixed(1), at: [+d.x.toFixed(1), +d.z.toFixed(1)] }); await p.keyboard.up('d'); await context.close(); }
      // Draw calls and triangles against section 18, six samples each, day 1 at 12:00.
      const measure = async (what, change, wait = 2500, before) => { const { page: p, context } = await open(browser, view, change, { quality }); await p.waitForTimeout(wait); await before?.(p); const stats = await callStats(p), t = (await metrics(p)).journey; numbers.push({ view, quality, what, ...stats, viewHalfHeight: +t.view.toFixed(1), shadowPass: t.shadowPass }); await context.close(); };
      await measure('village (8, 18), box shut', s => { noon(s); s.position = { x: 8, z: 18 }; });
      await measure('homestead (0, -8.8), box shut', s => { noon(s); s.position = { x: 0, z: -8.8 }; });
      await measure('fields (128, 0), near view, box shut', s => { noon(s); s.position = clearSpot(128, 0, 4); });
      await measure('fields (128, 0), near view, box open', s => { noon(s); s.pandora = true; s.position = clearSpot(128, 0, 4); }, 5000);
      await measure('far view riding at (170, 0), box shut', riding(clearSpot(170, 0, 5), EAST), 4500);
      await measure('far view riding at (170, 0), box open', s => { riding(clearSpot(170, 0, 5), EAST)(s); s.pandora = true; }, 6500);
      if (!touch) await measure('wheel zoom 42 at (128, 0), box shut', s => { noon(s); s.position = clearSpot(128, 0, 4); }, 1500, async p => { await p.mouse.move(720, 450); for (let i = 0; i < 12; i++) await p.mouse.wheel(0, 240); await p.waitForTimeout(800); });
    }
    await save('travel-numbers', numbers); console.log(JSON.stringify(numbers, null, 1));
  }
} catch (error) { console.error(error); process.exitCode = 1; } finally { await browser.close(); }
