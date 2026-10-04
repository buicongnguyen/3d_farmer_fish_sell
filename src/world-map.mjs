// The Map window, "The village & beyond" (round 8, builder F): one north-up sheet that zooms and pans from the village
// out to all thirteen squares. minimap.mjs draws it (drawWorldMap); this file owns its camera, its input and its markup.
//
// The reference's Map is a still picture (cute_game src/main.ts:723), so the input follows the game camera's own idiom
// (world.mjs: wheel to zoom, drag to look round, pinch on a phone):
//   wheel            k *= exp(-deltaY * 0.0015), anchored on the cursor
//   two fingers      pinch, anchored on their midpoint (and the midpoint drags the sheet)
//   one pointer      drag to pan; a tap (under 8 px of movement) picks the marker within 22 px and names it under the sheet
//   buttons          +, −, World, Village, Me (data-map, at least 44 px): no action in main.mjs's switch
//   keys             + and −, the arrows, 0 for World, Home for Village
// The camera is {cx, cz, k}: the world point at the middle of the box and CSS pixels a metre. k runs from kMin (the box's
// shorter side / 672: the whole world) to 8; the centre stays within ±336 m less half the view (locked at 0 when the view
// is wider than the world). It opens on Village inside the ward and on Me outside it, and keeps its camera while the panel
// is redrawn (a "find" button, a setting); it starts again the next time the Map is opened.
//
//   const map = installWorldMap(root, view)      root: #modal, which outlives every panel; view: main.mjs mapView
//   map.html(view, directory)                    the panel's body (the sheet, its buttons, the legend, the den list)
//   map.mount()                                  after the panel is drawn: sizes the canvas and draws
// The listeners are bound once, by delegation on `root`. What a test reads is on the canvas: canvas.__sheet.
import { VILLAGE } from './field-layout.mjs';
import { inSafeZone } from './ward.mjs';
import { TERRAIN, SHEET, sheetLimits, sheetProjection, drawWorldMap, terrainCache, pickMarker, pickLine, denRows, cageLine } from './minimap.mjs';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** The wheel's zoom per pixel of deltaY, a button's or a key's zoom step, and a key's pan as a share of the view. */
export const WHEEL = .0015, STEP = 1.6, KEY_PAN = .18, TAP = 8;
/** Keeps a camera inside its limits for a box of w × h CSS pixels. Returns it. */
export function clampCam(cam, w, h) {
  const L = sheetLimits(w, h); cam.k = clamp(cam.k, L.kMin, L.kMax);
  const rx = TERRAIN.half - w / 2 / cam.k, rz = TERRAIN.half - h / 2 / cam.k;
  cam.cx = rx > 0 ? clamp(cam.cx, -rx, rx) : 0; cam.cz = rz > 0 ? clamp(cam.cz, -rz, rz) : 0;
  return cam;
}
/** A preset's camera: 'world' (all thirteen squares), 'village' (the footprint and 26 m round it), 'me' (192 m across, centred on you). */
export function presetCam(name, view, w, h, cam = { cx: 0, cz: 0, k: 1 }) {
  const L = sheetLimits(w, h), me = view.place === 'village' || !view.place ? view : view.outside ?? { x: 0, z: 0 };
  if (name === 'world') { cam.cx = 0; cam.cz = 0; cam.k = L.kMin; }
  else if (name === 'me') { cam.cx = me.x; cam.cz = me.z; cam.k = L.kMe; }
  else { cam.cx = (VILLAGE.x0 + VILLAGE.x1) / 2; cam.cz = (VILLAGE.z0 + VILLAGE.z1) / 2; cam.k = L.kVillage; }
  return clampCam(cam, w, h);
}
/** The preset the Map opens on: Village inside the ward (and indoors, when the door you came in by is inside it), Me outside. */
export function openingPreset(view) { const me = view.place === 'village' || !view.place ? view : view.outside ?? { x: 0, z: 0 }; return inSafeZone(me.x, me.z) ? 'village' : 'me'; }
/** Zooms by `factor` keeping the world point under the sheet pixel (px, py) where it is. */
export function zoomAt(cam, factor, px, py, w, h) {
  const L = sheetLimits(w, h), k = clamp(cam.k * factor, L.kMin, L.kMax), wx = cam.cx + (px - w / 2) / cam.k, wz = cam.cz + (py - h / 2) / cam.k;
  cam.k = k; cam.cx = wx - (px - w / 2) / k; cam.cz = wz - (py - h / 2) / k;
  return clampCam(cam, w, h);
}
/** Drags the sheet by (dx, dy) CSS pixels. */
export function panBy(cam, dx, dy, w, h) { cam.cx -= dx / cam.k; cam.cz -= dy / cam.k; return clampCam(cam, w, h); }
/** Which preset a camera is on, or '' (so its button can show as pressed). */
export function presetOf(cam, view, w, h) {
  for (const name of ['world', 'village', 'me']) { const p = presetCam(name, view, w, h); if (Math.abs(p.k - cam.k) < 1e-6 * cam.k + 1e-9 && Math.abs(p.cx - cam.cx) < .01 && Math.abs(p.cz - cam.cz) < .01) return name; }
  return '';
}
const esc = text => String(text).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/** The den list under the sheet (box open only): a block per region, the one you stand in first; a row per den, and one for a cage that still holds someone. */
export function denListHtml(view) {
  const groups = denRows(view); if (!groups.length) return '';
  return `<section class="den-list" aria-label="Bosses, titans and prisons"><h3>Bosses &amp; titans</h3>${groups.map(({ region, rows }) => `<div class="den-group" data-region="${region.id}" style="--accent:${region.accent}"><h4>${esc(region.name)} <small>${'★'.repeat(region.stars)} · Lv ${region.level}+</small></h4>${rows.map(r =>
    `<div class="den-row${r.den.titan ? ' titan' : ''}${r.down ? ' down' : ''}" data-den="${r.den.id}"><span class="den-mark">♛</span><b>${esc(r.name)}</b><small>Lv ${r.level}${r.den.titan ? ' · titan' : ''}</small>${r.done ? '<i class="den-done" title="Beaten before">✓</i>' : ''}<span class="den-state">${esc(r.text)}</span></div>${r.cage ? `<div class="den-row cage ${r.cage.state}" data-cage="${r.cage.id}"><span class="den-mark">${r.cage.state === 'open' ? '🗝' : '🔒'}</span><span class="den-state">${esc(cageLine(r.cage))}</span></div>` : ''}`).join('')}</div>`).join('')}</section>`;
}
/** The Map panel's body. `directory` is main.mjs's own row of "find" buttons, passed through untouched. */
export function mapHtml(view, directory = '') {
  const open = view.pandora === true;
  return `<div class="map-view"><div class="map-sheet"><canvas id="large-map" tabindex="0" aria-label="Map of Willowmere and the lands beyond. Drag to move, pinch or scroll to zoom."></canvas></div>`
    + `<div class="map-tools" role="group" aria-label="Map view"><button type="button" data-map="world">World</button><button type="button" data-map="village">Village</button><button type="button" data-map="me">Me</button><span></span><button type="button" data-map="out" aria-label="Zoom out">−</button><button type="button" data-map="in" aria-label="Zoom in">+</button></div></div>`
    + `<p id="map-pick" class="map-pick" aria-live="polite"></p>`
    + `<div class="map-legend"><span>▲ You</span><span>⌂ Home</span><span>■ Family homes</span><span>◆ Shops</span><span>● Neighbours</span><span class="legend-border">▬ Region borders</span>${open ? '<span class="legend-den">♛ Boss</span><span class="legend-titan">♛ Titan</span><span class="legend-cage">🔒 Prison</span>' : ''}</div>`
    + directory + (open ? denListHtml(view) : '');
}
/**
 * Binds the Map window's input once on `root` (the panel element, which outlives every redraw) and returns the controller.
 * `view` is main.mjs's mapView. Nothing is drawn until mount() finds the canvas.
 */
export function installWorldMap(root, view) {
  const cam = { cx: 0, cz: 0, k: 1 }, pointers = new Map(), at = { x: 0, y: 0 };
  let canvas = null, w = 0, h = 0, dpr = 1, mode = '', fresh = true, queued = false, last = null, picked = '', moved = 0, pinch = 0, ticker = 0, sized = null, draws = 0;
  const live = () => canvas && canvas.isConnected;
  /** The canvas's box in CSS pixels, and its bitmap at up to twice that. */
  function resize() {
    const cw = canvas.clientWidth, ch = canvas.clientHeight; if (!(cw > 0 && ch > 0)) return false;
    dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    const bw = Math.round(cw * dpr), bh = Math.round(ch * dpr);
    if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
    w = cw; h = ch; return true;
  }
  function draw() {
    queued = false; if (!live() || !resize()) return;
    const v = view(), ctx = canvas.getContext('2d'), cache = terrainCache();
    // A preset holds while the box changes size (the panel docks, the phone turns); your own zoom or drag lets go of it.
    if (fresh) { mode = openingPreset(v); fresh = false; picked = ''; }
    if (mode) presetCam(mode, v, w, h, cam); else clampCam(cam, w, h);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const t0 = performance.now(); last = drawWorldMap(ctx, v, cam, w, h, { picked }); draws++; const ms = performance.now() - t0;
    const preset = presetOf(cam, v, w, h), L = last.limits;
    canvas.__sheet = { cam: { ...cam }, w, h, dpr, preset, kMin: L.kMin, kMax: L.kMax, kVillage: L.kVillage, kNames: L.kNames, kMe: L.kMe, labels: last.labels, markers: last.markers, countdown: last.countdown, picked, draws, ms, terrain: { ready: cache.ready, fills: [...cache.fills], blits: cache.blits } };
    for (const b of root.querySelectorAll('[data-map]')) { const name = b.dataset.map; if (name === 'in') b.disabled = cam.k >= L.kMax - 1e-9; else if (name === 'out') b.disabled = cam.k <= L.kMin + 1e-9; else b.setAttribute('aria-pressed', String(name === preset)); }
    const line = root.querySelector('#map-pick'); if (line) { const text = pickLine(v, last.markers.find(m => m.id === picked)); if (line.textContent !== text) line.textContent = text; }
    // The cache is built over seven frames; a timer on the sheet ticks once a second. Both stop when the canvas has gone.
    if (!cache.ready && !cache.dead) { cache.step(v); request(); }
    if (last.countdown && !ticker) ticker = setTimeout(() => { ticker = 0; if (live()) request(); }, 1000);
  }
  function request() { if (queued) return; queued = true; requestAnimationFrame(draw); }
  const spot = e => { const r = canvas.getBoundingClientRect(); at.x = e.clientX - r.left - canvas.clientLeft; at.y = e.clientY - r.top - canvas.clientTop; return at; };
  const onSheet = e => e.target?.id === 'large-map' && e.target === canvas;
  const spread = () => { const [a, b] = [...pointers.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };
  root.addEventListener('wheel', e => { if (!onSheet(e)) return; e.preventDefault(); const p = spot(e); zoomAt(cam, Math.exp(-e.deltaY * WHEEL * (e.deltaMode === 1 ? 33 : 1)), p.x, p.y, w, h); mode = ''; request(); }, { passive: false });
  root.addEventListener('pointerdown', e => {
    if (!onSheet(e)) return;
    const p = spot(e); pointers.set(e.pointerId, { x: p.x, y: p.y }); try { canvas.setPointerCapture(e.pointerId); } catch {}
    if (pointers.size === 1) moved = 0; else { moved = TAP; pinch = spread().d; }
    canvas.classList.add('dragging');
  });
  root.addEventListener('pointermove', e => {
    const was = pointers.get(e.pointerId); if (!was || !live()) return;
    const p = spot(e);
    if (pointers.size === 1) { const dx = p.x - was.x, dy = p.y - was.y; moved += Math.abs(dx) + Math.abs(dy); was.x = p.x; was.y = p.y; if (moved >= TAP) { panBy(cam, dx, dy, w, h); mode = ''; request(); } return; }
    const before = spread(); was.x = p.x; was.y = p.y; const now = spread();
    if (pointers.size === 2 && before.d > 4 && now.d > 4) { zoomAt(cam, now.d / before.d, now.x, now.y, w, h); panBy(cam, now.x - before.x, now.y - before.y, w, h); pinch = now.d; mode = ''; request(); }
  });
  const lift = e => {
    if (!pointers.has(e.pointerId)) return;
    const p = pointers.get(e.pointerId), tap = e.type === 'pointerup' && pointers.size === 1 && moved < TAP; pointers.delete(e.pointerId);
    if (!pointers.size) canvas?.classList.remove('dragging');
    if (tap && live()) { const m = pickMarker(last, p.x, p.y); picked = m ? m.id : ''; request(); }
  };
  root.addEventListener('pointerup', lift); root.addEventListener('pointercancel', lift);
  root.addEventListener('click', e => {
    const b = e.target?.closest?.('[data-map]'); if (!b || !live()) return;
    const name = b.dataset.map;
    if (name === 'in' || name === 'out') { zoomAt(cam, name === 'in' ? STEP : 1 / STEP, w / 2, h / 2, w, h); mode = ''; } else mode = name;
    request();
  });
  root.addEventListener('keydown', e => {
    if (!live() || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target, tag = t?.tagName; if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'BUTTON' && !t.dataset.map) return;
    const key = e.key, step = Math.min(w, h) * KEY_PAN;
    let preset = '';
    if (key === '+' || key === '=') zoomAt(cam, STEP, w / 2, h / 2, w, h); else if (key === '-' || key === '_') zoomAt(cam, 1 / STEP, w / 2, h / 2, w, h);
    else if (key === 'ArrowLeft') panBy(cam, step, 0, w, h); else if (key === 'ArrowRight') panBy(cam, -step, 0, w, h); else if (key === 'ArrowUp') panBy(cam, 0, step, w, h); else if (key === 'ArrowDown') panBy(cam, 0, -step, w, h);
    else if (key === '0') preset = 'world'; else if (key === 'Home') preset = 'village';
    else return;
    mode = preset;
    e.preventDefault(); request();
  });
  // The Map starts again (its opening preset) once its canvas has left the panel: the panel was closed, or shows something else.
  if (typeof MutationObserver === 'function') {
    new MutationObserver(() => { if (!root.querySelector('#large-map')) { fresh = true; pointers.clear(); } }).observe(root, { childList: true, subtree: true });
    const backdrop = root.parentElement; if (backdrop) new MutationObserver(() => { if (backdrop.hidden) { fresh = true; pointers.clear(); } }).observe(backdrop, { attributes: true, attributeFilter: ['hidden'] });
  }
  return {
    cam, html: mapHtml,
    /** After the panel is drawn: takes the new canvas, sizes it and draws; a rotation or a resize draws again. */
    mount() {
      canvas = root.querySelector('#large-map'); if (!canvas) return;
      pointers.clear();
      if (typeof ResizeObserver === 'function') { sized?.disconnect(); sized = new ResizeObserver(() => request()); sized.observe(canvas); }
      draw();
    },
    draw, request,
  };
}
export { SHEET, sheetProjection };
