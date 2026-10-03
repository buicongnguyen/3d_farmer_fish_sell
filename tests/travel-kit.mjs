// What builder C's four browser suites share (round 8): vehicle-browser, home-browser, camera-browser, edge-browser.
//
//   GAME_URL=http://127.0.0.1:<port> GPU=1 node tests/<suite>.mjs
//
// Like every suite here, a test seeds its state through the saved game and then plays with keys, taps and the game's own
// buttons; it reads only window.willowmere (metrics, render, calls, targets). Evidence shots go to the round's evidence folder.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { freshState, SAVE_KEY } from '../src/game.mjs';
import { CAMERA_YAW, FIELD_TILE, fieldTrees } from '../src/field-layout.mjs';
import { inWorld } from '../src/regions.mjs';

export const url = process.env.GAME_URL ?? 'http://127.0.0.1:4413';
export const EVIDENCE = process.env.EVIDENCE ?? 'C:/Users/n/source/repos/cute_game-notes/willowmere/evidence-round8/C';
export const VIEWS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  landscape: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true },
};
/** The world heading (atan2(x, z)) the D key points to, and the stick for a world direction. */
export const SCREEN_EAST = Math.PI / 2 + CAMERA_YAW;

export async function launch() {
  await mkdir('test-results', { recursive: true }); await mkdir(EVIDENCE, { recursive: true });
  return chromium.launch({ channel: process.env.CI ? undefined : 'chrome', headless: true, args: process.env.GPU ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
}
/** In the page: run a function after each of the game's frames. */
function helpers() {
  // A rectangle of the game's own canvas (CSS pixels), read straight after the game drew this frame: call it from a frame callback.
  window.__grab = (x, y, w, h) => { const c = document.getElementById('game'), gl = c.getContext('webgl2'), k = c.width / innerWidth, bw = Math.round(w * k), bh = Math.round(h * k), px = new Uint8Array(bw * bh * 4); gl.readPixels(Math.round(x * k), c.height - Math.round(y * k) - bh, bw, bh, gl.RGBA, gl.UNSIGNED_BYTE, px); return { w: bw, h: bh, px: Array.from(px) }; };
  window.__frames = (n, each) => new Promise(resolve => { const out = []; let i = 0, last = performance.now(); const tick = now => { out.push(each(i, now - last)); last = now; if (++i >= n) resolve(out); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
}
/**
 * A page with a seeded save, the game begun. `change(seed)` edits a fresh state.
 * Returns {page, context, errors}. The save is seeded only when the browser has none, so a reload keeps what the game saved.
 */
export async function open(browser, view, change, { quality } = {}) {
  const seed = freshState(); seed.started = true; if (quality) seed.settings.quality = quality; change?.(seed);
  const context = await browser.newContext({ ...VIEWS[view], deviceScaleFactor: 1 });
  await context.addInitScript(({ key, seed }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(seed)); }, { key: SAVE_KEY, seed });
  await context.addInitScript(helpers);
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(url); await begin(page, view);
  return { page, context, errors };
}
/** Wait for the world, press Begin, wait for the render probe. Also after a reload. */
export async function begin(page, view) {
  await page.waitForFunction(() => window.willowmere?.metrics().ready, null, { timeout: 120000 });
  await (VIEWS[view].hasTouch ? page.locator('#begin').tap() : page.locator('#begin').click());
  await page.waitForFunction(() => typeof willowmere.render === 'function', null, { timeout: 30000 });
}
export const metrics = page => page.evaluate(() => willowmere.metrics());
export const snapshot = page => page.evaluate(() => willowmere.snapshot());
export const shot = (page, name) => page.screenshot({ path: `${EVIDENCE}/${name}.png` });
/** Real draw calls and triangles, shadow pass included: asked twice, 200 ms apart (the count is of the frames between). */
export async function calls(page) { await page.evaluate(() => willowmere.calls()); await page.waitForTimeout(250); return page.evaluate(() => willowmere.calls()); }
/** Six samples over six seconds: {min, median, max, triangles}. */
export async function callStats(page, n = 6) {
  const list = []; let triangles = 0;
  for (let i = 0; i < n; i++) { const c = await calls(page); if (c) { list.push(c.calls); triangles = Math.max(triangles, c.triangles); } await page.waitForTimeout(750); }
  list.sort((a, b) => a - b); return { min: list[0], median: list[Math.floor(list.length / 2)], max: list.at(-1), triangles };
}
/** Tap the game's own button (touch) or click it. */
export const press = (page, view, selector) => VIEWS[view].hasTouch ? page.locator(selector).tap() : page.locator(selector).click();
export const save = (name, data) => writeFile(`test-results/${name}.json`, JSON.stringify(data, null, 1));
/**
 * Hold the thumb stick towards a world direction (wx, wz), on a touch view: real touch events through the browser's own input, so the
 * game's joystick code runs as it does under a thumb. Returns {release()}. (The keys are eight screen directions, turned 0.38 rad from
 * the world's axes; the stick is the only way to drive due south.)
 */
export async function holdStick(page, context, wx, wz) {
  const cdp = await context.newCDPSession(page), box = await page.locator('#joystick').boundingBox(), cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const len = Math.hypot(wx, wz) || 1, c = Math.cos(CAMERA_YAW), s = Math.sin(CAMERA_YAW), dx = wx / len, dz = wz / len, x = dx * c - dz * s, y = dx * s + dz * c;
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([px, py]) => ({ x: Math.round(px), y: Math.round(py), id: 7 })) });
  await touch('touchStart', [[cx, cy]]); await touch('touchMove', [[cx + x * 60, cy + y * 60]]);
  return { release: async () => { await touch('touchEnd', []); await cdp.detach().catch(() => {}); } };
}
/**
 * The nearest spot to (x, z) with `room` metres clear of every field trunk (the plan is seeded, and builders A and B change it), in the
 * world: a stand for a shot or a start for a drive must not be inside a tree. Searched on rings of 2 m.
 */
export function clearSpot(x, z, room = 4) {
  const gap = (px, pz) => { let d = Infinity; const tx = Math.floor(px / FIELD_TILE), tz = Math.floor(pz / FIELD_TILE); for (let i = tx - 1; i <= tx + 1; i++) for (let k = tz - 1; k <= tz + 1; k++) for (const t of fieldTrees(i, k)) d = Math.min(d, Math.hypot(t.x - px, t.z - pz) - t.r); return d; };
  for (let r = 0; r <= 24; r += 2) for (let a = 0; a < (r ? 12 : 1); a++) { const px = x + Math.sin(a * Math.PI / 6) * r, pz = z + Math.cos(a * Math.PI / 6) * r; if (inWorld(px, pz, room) && gap(px, pz) > room) return { x: +px.toFixed(2), z: +pz.toFixed(2) }; }
  return { x, z };
}
