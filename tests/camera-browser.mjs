// Round 8 in a real browser (builder C): the driving camera. Far outside the village the view opens to about one whole square; it
// comes back on stepping out; inside the ward nothing changes; a portrait phone's far view never cuts the ground at the bottom of
// the screen; and once the view is wide (the far view, or the wheel) the shadows fade and the shadow pass is not drawn at all.
//
//   GAME_URL=http://127.0.0.1:<port> GPU=1 node tests/camera-browser.mjs
import assert from 'node:assert/strict';
import { launch, open, metrics, shot, calls, callStats, save, clearSpot, VIEWS } from './travel-kit.mjs';
import { FAR_VIEW, SHADOW_VIEW, cameraRig } from '../src/drive.mjs';

const browser = await launch(), results = [], errors = [];
const riding = (at, id = 'jeep') => s => { s.bike = true; s.stats.sales = 250; s.position = { ...at }; s.riding = id; s.heading = 1.2; s.vehicles[id] = { ...at, rot: 1.2 }; };
// Times are the game's own clock (world.t), in milliseconds: on a busy machine frames are long and the game steps at most 50 ms a frame, so the wall clock runs ahead of it.
const until = async (page, test) => { const t0 = await page.evaluate(() => willowmere.render().t); await page.waitForFunction(test, null, { timeout: 60000 }); return Math.round((await page.evaluate(() => willowmere.render().t) - t0) * 1000); };

try {
  // ---------------------------------------------------------------- 1. the far view opens at x 170 and closes on stepping out
  {
    // The jeep stands out in the canyon where it was left, you beside it: the village view. Then you step in.
    const at = clearSpot(170, 0, 6), { page: p, errors: e } = await open(browser, 'desktop', s => { s.stats.sales = 250; s.position = { x: at.x + 2.5, z: at.z }; s.vehicles.jeep = { ...at, rot: 1.2 }; }, { quality: 'high' }); errors.push(e);
    await p.waitForTimeout(600); const first = await metrics(p); assert.equal(first.cameraTop, 15, 'on foot the view is the same as in the village, however far out'); assert.equal(first.journey.shadowPass, true);
    await p.keyboard.press('e'); const opened = await until(p, () => willowmere.metrics().riding === 'jeep' && willowmere.metrics().cameraTop >= 30), m = await metrics(p);
    assert.ok(opened < 4000, `the view is twice the village's 15 m within 4 s (${opened} ms)`); await p.waitForFunction(() => willowmere.metrics().journey.farShare > .995, null, { timeout: 8000 }); const wide = await metrics(p);
    assert.ok(Math.abs(wide.cameraTop - FAR_VIEW) < .2, `it opens to a half-height of 36 m (${wide.cameraTop.toFixed(2)})`); assert.ok(Math.abs(wide.driveZoom - 2.4) < .01); assert.ok(wide.journey.farShare > .99);
    assert.equal(wide.journey.shadow, 0, 'no shadows in the far view'); assert.equal(wide.journey.shadowPass, false, 'and no shadow pass');
    assert.ok(Math.abs(wide.journey.fogNear - cameraRig(36, 1).fogNear) < .5 && Math.abs(wide.journey.fogFar - wide.journey.fogNear - 120) < .5, `the fog stands off beyond the view (${wide.journey.fogNear.toFixed(0)} to ${wide.journey.fogFar.toFixed(0)} m)`);
    // The wheel zooming IN changes nothing out here (the far view is the point); the help says so.
    await p.mouse.move(720, 450); for (let i = 0; i < 2; i++) await p.mouse.wheel(0, -240); await p.waitForTimeout(1200); assert.ok((await metrics(p)).journey.view > 35.5 && (await p.evaluate(() => willowmere.render().camera.zoom)) < 9, 'the wheel did turn (the near view is now about 8 m)');
    assert.ok(Math.abs((await metrics(p)).cameraTop - FAR_VIEW) < .3, 'zooming in with the wheel leaves the far view as it is'); for (let i = 0; i < 2; i++) await p.mouse.wheel(0, 240); await p.waitForTimeout(600);
    const farCalls = await callStats(p); await shot(p, 'camera-far-1440x900');
    await p.keyboard.press('e'); const closed = await until(p, () => willowmere.metrics().riding === '' && willowmere.metrics().cameraTop <= 15.5), back = await metrics(p);
    assert.ok(closed < 3000, `back to the near view within 3 s of stepping out (${closed} ms)`); await p.waitForTimeout(1200); const near = await metrics(p);
    assert.ok(Math.abs(near.cameraTop - 15) < .3, `the near view (${near.cameraTop.toFixed(2)})`); assert.equal(near.journey.shadow, 1); assert.equal(near.journey.shadowPass, true, 'shadows are back'); assert.equal(near.journey.cameraFar, 220); assert.equal(near.journey.fogNear, 80);
    const nearCalls = await callStats(p);
    results.push({ name: 'riding at x 170: the far view', openedMs: opened, closedMs: closed, cameraTop: +wide.cameraTop.toFixed(2), fog: [+wide.journey.fogNear.toFixed(1), +wide.journey.fogFar.toFixed(1)], calls: { far: farCalls, nearOnFoot: nearCalls }, landCalls: back.journey.landCalls });
    assert.ok(back.journey.landCalls.car > 0 && back.journey.landCalls.step > 0 && near.journey.landCalls.walk > 0, 'world.lands is asked: carLimit while driving, walk on foot, step every frame');
    await p.context().close();
  }
  // ---------------------------------------------------------------- 2. inside the ward: no change
  {
    const { page: p, errors: e } = await open(browser, 'desktop', riding({ x: 20, z: 37 })); errors.push(e);
    await p.waitForTimeout(2500); const m = await metrics(p); assert.equal(m.riding, 'jeep'); assert.ok(Math.abs(m.cameraTop - 15) < .01, `standing in the village the view is the village's (${m.cameraTop})`); assert.equal(m.journey.farShare, 0); assert.equal(m.journey.shadow, 1); assert.equal(m.journey.shadowPass, true);
    // Driving round the ring road it pulls back with speed only, as before: never past the drive camera's 1.45.
    await p.keyboard.down('a'); await p.waitForTimeout(1500); const moving = await metrics(p); await p.keyboard.up('a');
    assert.ok(moving.driveZoom <= 1.45 + 1e-6 && moving.cameraTop <= 15 * 1.45 + .01, `the speed pull-back only (${moving.driveZoom.toFixed(3)})`); assert.equal(moving.journey.shadow, 1, 'shadows stay on up to the drive camera\'s view');
    results.push({ name: 'riding inside the ward: no far view', cameraTop: m.cameraTop, driving: +moving.cameraTop.toFixed(2) }); await p.context().close();
  }
  // ---------------------------------------------------------------- 3. portrait and landscape phones at x 170: the rig stands back, the ground is whole
  for (const view of ['phone', 'landscape']) {
    const size = `${VIEWS[view].viewport.width}x${VIEWS[view].viewport.height}`, at = clearSpot(170, 0, 6);
    const { page: p, errors: e } = await open(browser, view, riding(at, view === 'phone' ? 'bike' : 'jeep'), { quality: 'battery' }); errors.push(e);
    await p.waitForFunction(() => willowmere.metrics().journey.farShare > .995, null, { timeout: 8000 }); await p.waitForTimeout(600);
    const m = await metrics(p), portrait = view === 'phone', half = FAR_VIEW * (portrait ? 1.35 : 1), rig = cameraRig(half, 1);
    assert.ok(Math.abs(m.cameraTop - half) < .3, `${view}: half-height ${m.cameraTop.toFixed(1)} m`);
    assert.ok(Math.abs(m.journey.cameraDistance - rig.distance) < .3, `${view}: the camera stands ${m.journey.cameraDistance.toFixed(1)} m from its focus (${rig.distance.toFixed(1)})`); assert.ok(Math.abs(m.journey.cameraFar - rig.far) < .5);
    if (portrait) assert.ok(m.journey.cameraDistance > 69 && m.journey.cameraFar > 239, 'portrait: farther back than the village rig, with a longer far plane'); else assert.ok(Math.abs(m.journey.cameraDistance - 59.65) < .3, 'landscape: the village rig still fits');
    // No ground clipping: the bottom rows and the top rows of the canvas are ground (or far ground in fog), never the clear colour behind a cut plane.
    const rows = await p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => { const bottom = __grab(0, innerHeight - 4, innerWidth, 4), top = __grab(0, 0, innerWidth, 4), back = willowmere.metrics().journey; resolve({ bottom, top, back }); })));
    const sky = [0x9f, 0xdc, 0xff], clipped = g => { let n = 0; for (let i = 0; i < g.px.length; i += 4) if (Math.abs(g.px[i] - sky[0]) < 10 && Math.abs(g.px[i + 1] - sky[1]) < 10 && Math.abs(g.px[i + 2] - sky[2]) < 10) n++; return n; };
    const green = g => { let n = 0; for (let i = 0; i < g.px.length; i += 4) if (g.px[i + 1] > g.px[i + 2] + 20) n++; return n / (g.px.length / 4); };
    assert.equal(clipped(rows.bottom), 0, `${view}: no clear-colour pixel in the bottom rows`); assert.ok(green(rows.bottom) > .9, `${view}: the bottom rows are ground (${(green(rows.bottom) * 100).toFixed(0)} % green)`); assert.equal(clipped(rows.top), 0, `${view}: none at the top either (the far plane reaches)`);
    const stats = await callStats(p); await shot(p, `camera-far-${size}`);
    results.push({ name: `${view}: far view at x 170 ("battery")`, cameraTop: +m.cameraTop.toFixed(1), cameraDistance: +m.journey.cameraDistance.toFixed(2), cameraFar: +m.journey.cameraFar.toFixed(1), bottomGreen: +green(rows.bottom).toFixed(3), calls: stats });
    await p.context().close();
  }
  // ---------------------------------------------------------------- 4. the wheel: shadows fade with the view and the pass goes at 28.5, on foot too
  for (const quality of ['high', 'battery']) {
    const at = clearSpot(128, 0, 5), view = quality === 'high' ? 'desktop' : 'phone', { page: p, context, errors: e } = await open(browser, view, s => { s.position = { ...at }; }, { quality }); errors.push(e);
    await p.waitForTimeout(1200); const near = await metrics(p), nearCalls = await callStats(p); assert.equal(near.journey.view, 15); assert.equal(near.journey.shadow, 1); assert.equal(near.journey.shadowPass, quality === 'high');
    let row = { name: `wheel zoom in the fields at (128, 0), "${quality}"`, zoom15: nearCalls };
    if (view === 'desktop') {
      await p.mouse.move(720, 450);
      // Out to about 25: part of the fade. Then all the way to 42.
      for (let i = 0; i < 40 && (await metrics(p)).journey.view < 24.5; i++) { await p.mouse.wheel(0, 40); await p.waitForTimeout(30); }
      const mid = await metrics(p); assert.ok(mid.journey.view > SHADOW_VIEW.full && mid.journey.view < SHADOW_VIEW.none, `view ${mid.journey.view.toFixed(1)}`); assert.ok(mid.journey.shadow > .05 && mid.journey.shadow < .95, `shadows part faded (${mid.journey.shadow.toFixed(2)})`); assert.equal(mid.journey.shadowPass, true);
      for (let i = 0; i < 12; i++) await p.mouse.wheel(0, 240); await p.waitForTimeout(500);
      const wide = await metrics(p); assert.equal(wide.journey.view, 42); assert.equal(wide.journey.shadow, 0); assert.equal(wide.journey.shadowPass, false, 'no shadow pass at the wheel\'s widest view');
      const wideCalls = await callStats(p); await shot(p, 'camera-wheel-42-1440x900'); row = { ...row, zoom42: wideCalls, fadeAt: +mid.journey.view.toFixed(1), fadeShare: +mid.journey.shadow.toFixed(2) };
      assert.ok(wideCalls.max <= 150, `at most 150 real draws at zoom 42 in the fields (${wideCalls.max})`);
      for (let i = 0; i < 14; i++) await p.mouse.wheel(0, -240); await p.waitForTimeout(500); for (let i = 0; i < 40 && (await metrics(p)).journey.view < 15; i++) { await p.mouse.wheel(0, 30); await p.waitForTimeout(30); }
      const again = await metrics(p); assert.ok(again.journey.view < SHADOW_VIEW.full); assert.equal(again.journey.shadow, 1); assert.equal(again.journey.shadowPass, true, 'and back when the view is near again');
    } else {
      // A phone pinches. Two fingers moved together: the view goes out to 42 and the shots at this size are taken there.
      const cdp = await context.newCDPSession(p), touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
      for (let n = 0; n < 6; n++) { await touch('touchStart', [[195, 300], [195, 560]]); for (let k = 1; k <= 8; k++) await touch('touchMove', [[195, 300 + k * 13], [195, 560 - k * 13]]); await touch('touchEnd', []); await p.waitForTimeout(60); }
      await p.waitForTimeout(400); const wide = await metrics(p); assert.equal(wide.journey.view, 42, 'pinched out to the widest view'); assert.equal(wide.journey.shadow, 0);
      row.zoom42 = await callStats(p); await shot(p, 'camera-wheel-42-390x844');
    }
    results.push(row); await p.context().close();
  }
  assert.deepEqual(errors.flat(), []);
  await save('camera-results', results); console.log(JSON.stringify(results, null, 1)); console.log('camera-browser: all passed');
} catch (error) { console.error(error); console.error('page errors', errors.flat()); process.exitCode = 1; } finally { await browser.close(); }
