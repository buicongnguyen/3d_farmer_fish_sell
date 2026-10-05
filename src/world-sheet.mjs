// The Map window's sheet (round 8, builder F; split out of minimap.mjs at merge F so that it and world-map.mjs are
// fetched with import() the first time the Map is opened, not before the first frame: spec 17.3's bundle limit).
// Pure drawing on a 2D context, like minimap.mjs, whose ground, glyphs and labels it reuses.
//
//   sheetLimits(w, h)                     zoom limits and presets for a box of w x h CSS pixels
//   sheetProjection(cam, w, h)            cam = {cx, cz, k} -> world metres to CSS pixels, north up
//   drawWorldMap(ctx, view, cam, w, h)    the sheet; returns the projection with labels, markers and countdown
//   pickMarker(P, x, y), pickLine(view, marker)
import { HOUSES, HOMES, CIVIC } from './content.mjs';
import { VILLAGE } from './field-layout.mjs';
import { SAFE } from './ward.mjs';
import { REGION, REGION_IDS, OUTPOSTS, LEVELS, regionAt, levelLabel } from './regions.mjs';
import { FRIENDS } from './friends.mjs';
import { COLORS, TERRAIN, REGION_SHORT, CIVIC_SHORT, BARNS, CREATURE_RANGE, drawGround, textWidth, haloText, overlaps, boxAt, diamond, disc, carGlyph, flagGlyph, houseGlyph, crown, ringOf, badge, arrow, arrowTurn, clock, denName, denLine, cageLine, wayTo } from './minimap.mjs';
import { hyp } from './hyp.mjs';

const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), pt = { x: 0, y: 0 };
/** Sizes on the sheet, in CSS pixels, the same at every zoom (spec 10.3). */
export const SHEET = { crown: 8, titan: 10.4, cage: 7, badge: 5, you: 9, font: 11, name: 13, pick: 22, kMax: 8, pad: 26, me: 192, tierNames: 1.2, tuck: 2 };
/** The sheet's zoom limits and presets for a box of w × h CSS pixels: the whole world, 8 px a metre, the Village preset, where names begin, the Me preset. */
export function sheetLimits(w, h) {
  const side = Math.min(w, h), kVillage = side / (Math.max(VILLAGE.x1 - VILLAGE.x0, VILLAGE.z1 - VILLAGE.z0) + 2 * SHEET.pad);
  return { kMin: side / TERRAIN.size, kMax: SHEET.kMax, kVillage, kNames: Math.min(3, kVillage), kMe: side / SHEET.me };
}
/** The sheet's projection: cam = {cx, cz, k}, the world point at the box's middle and CSS pixels a metre; north up. */
export function sheetProjection(cam, w, h) {
  const k = cam.k, ox = w / 2 - cam.cx * k, oy = h / 2 - cam.cz * k;
  return { x: cam.cx, z: cam.cz, heading: 0, k, w, h, size: Math.min(w, h), half: Math.min(w, h) / 2, radius: hyp(w, h) / 2 / k, matrix: [k, 0, 0, k, ox, oy],
    point: (wx, wz, out = { x: 0, y: 0 }) => { out.x = ox + wx * k; out.y = oy + wz * k; return out; },
    world: (px, py, out = { x: 0, z: 0 }) => { out.x = (px - ox) / k; out.z = (py - oy) / k; return out; },
    sees: r => r.x1 > -ox / k && r.x0 < (w - ox) / k && r.z1 > -oy / k && r.z0 < (h - oy) / k };
}
/**
 * The part of a region that is on the sheet, as a box in pixels centred on the centroid of the sample points (a 12 x 12 grid over the
 * sheet) that lie in the region, reaching as far as the nearest of its extremes: a name stays inside its region however far in the
 * player has zoomed. Null when no sample is in the region.
 */
const SAMPLE = 12;
function visibleBox(P, id, w, h) {
  let n = 0, sx = 0, sy = 0, minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
  const at = { x: 0, z: 0 };
  for (let i = 0; i < SAMPLE; i++) for (let j = 0; j < SAMPLE; j++) {
    const px = (i + .5) / SAMPLE * w, py = (j + .5) / SAMPLE * h; P.world(px, py, at);
    if (regionAt(at.x, at.z) !== id) continue;
    n++; sx += px; sy += py; if (px < minx) minx = px; if (px > maxx) maxx = px; if (py < miny) miny = py; if (py > maxy) maxy = py;
  }
  if (!n) return null;
  const cx = sx / n, cy = sy / n, hx = (Math.min(cx - minx, maxx - cx) + w / SAMPLE / 2) * .8, hy = (Math.min(cy - miny, maxy - cy) + h / SAMPLE / 2) * .8;
  return { x0: Math.max(0, cx - hx), x1: Math.min(w, cx + hx), y0: Math.max(0, cy - hy), y1: Math.min(h, cy + hy) };
}
const WARD_RECT = { x0: SAFE.x0, x1: SAFE.x1, z0: SAFE.z0, z1: SAFE.z1 };
/**
 * The Map window's sheet (it replaces drawFullMap): one north-up sheet at any zoom, drawn in CSS pixels under whatever
 * transform the context carries (world-map.mjs scales it by the device's pixel ratio). The ground as on the minimap; then
 * the region names, thinned out by zoom (a short name and "Lv 4+" in bands under 1.2 px a metre; the full name with stars
 * and level above it; the village's thirteen names, den and cage names from kNames); then the markers, the same size at
 * every zoom: every den with the box open, the cages, the parked vehicles, home and you. A label that would cover an
 * earlier one is left out. Returns the projection with P.labels, P.markers and P.countdown (a timer is on the sheet).
 */
export function drawWorldMap(ctx, view, cam, w, h, { picked = '' } = {}) {
  const P = sheetProjection(cam, w, h), k = P.k, L = sheetLimits(w, h), labels = P.labels = [], markers = P.markers = [], boxes = [], font = SHEET.font, far = k < SHEET.tierNames;
  P.countdown = false; P.limits = L;
  ctx.fillStyle = COLORS.beyond; ctx.fillRect(0, 0, w, h);
  ctx.save(); ctx.transform(...P.matrix); drawGround(ctx, P, view, clamp(3.98 * k, 3, 9), k >= 2); ctx.restore();
  // Where the crowns will stand, known before the names are placed: a region's name keeps clear of them where it can.
  const dens = view.pandora ? view.dens : null, spots = [];
  if (dens) for (const d of dens) { P.point(d.x, d.z, pt); spots.push({ x: pt.x, y: pt.y, r: (d.titan ? SHEET.titan : SHEET.crown) - 1 }); }
  /** How far a label's box reaches under a crown, in pixels (0: clear). */
  const under = b => { let most = 0; for (const c of spots) { const v = c.r - hyp(c.x - clamp(c.x, b.x0, b.x1), c.y - clamp(c.y, b.y0, b.y1)); if (v > most) most = v; } return most; };
  const boxOf = (x, y, tw, size) => ({ x0: x - tw / 2 - 2, x1: x + tw / 2 + 2, y0: y - size * .58, y1: y + size * .58 });
  const fits = b => !(b.x0 < 1 || b.x1 > w - 1 || b.y0 < 1 || b.y1 > h - 1 || overlaps(b, boxes));
  const write = (text, x, y, kind, size, color, tw, b) => { boxes.push(b); haloText(ctx, text, x, y, size, color); labels.push({ text, kind, x, y, w: tw, h: size, size }); return true; };
  /** Draws a label unless it leaves the sheet or covers an earlier one (or a marker, once those are in `boxes`). */
  const put = (text, x, y, kind, size = font, color = COLORS.ink) => { const tw = textWidth(ctx, text, size), b = boxOf(x, y, tw, size); return fits(b) && write(text, x, y, kind, size, color, tw, b); };
  /**
   * A label in one of the rows `ys` of a square's visible part (x0…x1): in the middle of the row, else at its left or right
   * end; the first place clear of every crown. With `must` and no clear place it takes the one least under a crown, if that
   * is a few pixels only (SHEET.tuck): a word half hidden by a crown reads as a fault, so it is left out instead.
   */
  const inRows = (text, x0, x1, ys, kind, size = font, must = false) => {
    const tw = textWidth(ctx, text, size), side = tw / 2 + 5; let best = null, least = Infinity;
    if (tw + 6 > x1 - x0) return false; // it would run over the square's border
    for (const y of ys) for (const x of [(x0 + x1) / 2, x0 + side, x1 - side]) {
      const b = boxOf(x, y, tw, size); if (!fits(b)) continue;
      const v = under(b); if (v <= 0) return write(text, x, y, kind, size, COLORS.ink, tw, b);
      if (v < least) { least = v; best = { x, y, b }; }
    }
    return must && best && least <= SHEET.tuck ? write(text, best.x, best.y, kind, size, COLORS.ink, tw, best.b) : false;
  };
  // Region names, each in the part of its square that is on the sheet, so a name stays readable however far in you are.
  // Zoomed far out a square is 67 px on a phone and holds up to four crowns: the name takes the top band, the bottom band or
  // the middle, whichever is clear of them, and the level a band that is left; a level with no clear place is left out.
  // Your arrow is placed before the names (merge F: out in a land, the World preset wrote "Canyon" under it).
  const on = (x, y, r) => x > -r && x < w + r && y > -r && y < h + r, home = HOUSES[0], me = view.place === 'village' || !view.place ? view : view.outside;
  if (me) { P.point(me.x, me.z, pt); if (on(pt.x, pt.y, SHEET.you)) boxes.push(boxAt(pt.x, pt.y, SHEET.you)); }
  const a = { x: 0, y: 0 }, b = { x: 0, y: 0 };
  for (const id of REGION_IDS) {
    if (id === 'village') continue;
    const R = REGION[id], box = visibleBox(P, id, w, h); if (!box) continue;
    const x0 = box.x0, x1 = box.x1, y0 = box.y0, y1 = box.y1; if (x1 - x0 < 44 || y1 - y0 < 40) continue;
    if (far) {
      const top = y0 + 4 + font * .58, low = y1 - 4 - font * .58, mid = (y0 + y1) / 2;
      inRows(REGION_SHORT[id], x0, x1, [top, low, mid], 'region', font, true);
      if (!inRows(levelLabel(id), x0, x1, [low, top, mid], 'level')) inRows(`Lv ${LEVELS[id].hi}`, x0, x1, [low, top, mid], 'level'); // 'Lv 2-10' where the square is too narrow for it: the rim's level
    } else {
      const size = SHEET.name, top = y0 + 7 + size * .58, step = size * 1.16 + 2, rows = [top, top + step * 2, top + step * 4].filter(y => y < y1 - 30);
      if (inRows(R.name, x0, x1, rows, 'region', size) || inRows(REGION_SHORT[id], x0, x1, rows, 'region', size, true)) { const name = labels.at(-1), chip = `${'★'.repeat(R.stars)} · ${levelLabel(id)}`, half = textWidth(ctx, chip, font) / 2 + 3, b = boxOf(name.x, name.y + step, half * 2 - 6, font); if (name.x - half >= x0 && name.x + half <= x1 && fits(b) && under(b) <= 0) write(chip, name.x, name.y + step, 'level', font, COLORS.ink, half * 2 - 6, b); else inRows(chip, x0, x1, [name.y + step], 'level') || inRows(`Lv ${R.level}+`, x0, x1, [name.y + step], 'level'); }
    }
  }
  // Markers: the village's small ones only from 1.2 px a metre, where the village is more than a thumbnail.
  if (!far) {
    for (const s of view.shops ?? []) { P.point(s.x, s.z, pt); diamond(ctx, pt.x, pt.y, 4.6, COLORS.shop[s.id] ?? '#ff8a2a'); }
    ctx.fillStyle = COLORS.neighbour;
    for (const n of view.npcs ?? []) { if (n.hidden) continue; P.point(n.x, n.z, pt); disc(ctx, pt.x, pt.y, 2.3); }
    if (view.pandora) for (const e of view.creatures ?? []) {
      if (!(e.hp > 0) || e.den || e.boss || hyp(e.x - view.x, e.z - view.z) > CREATURE_RANGE) continue;
      P.point(e.x, e.z, pt); ctx.fillStyle = e.angry ? COLORS.angry : COLORS.creature; disc(ctx, pt.x, pt.y, e.angry ? 3.4 : 2.8);
    }
  }
  for (const o of OUTPOSTS) { P.point(o.x, o.z, pt); if (on(pt.x, pt.y, 6)) { flagGlyph(ctx, pt.x, pt.y, far ? 3.4 : 4.6); markers.push({ kind: 'outpost', id: o.id, x: pt.x, y: pt.y, r: 5, wx: o.x, wz: o.z }); } }
  for (const v of view.vehicles ?? []) { P.point(v.x, v.z, pt); if (!on(pt.x, pt.y, 6)) continue; carGlyph(ctx, pt.x, pt.y, 4.2); markers.push({ kind: 'vehicle', id: v.id, x: pt.x, y: pt.y, r: 5, wx: v.x, wz: v.z }); }
  P.point(home.x, home.z, pt); if (on(pt.x, pt.y, 8)) { houseGlyph(ctx, pt.x, pt.y, far ? 5.2 : 6.2); markers.push({ kind: 'home', id: 'home', x: pt.x, y: pt.y, r: 7, wx: home.x, wz: home.z }); boxes.push(boxAt(pt.x, pt.y, 7)); }
  if (dens) {
    for (const d of dens) {
      P.point(d.x, d.z, pt); const s = d.titan ? SHEET.titan : SHEET.crown; if (!on(pt.x, pt.y, s)) continue;
      crown(ctx, pt.x, pt.y, s, d.down, d.titan, ringOf(d));
      const box = boxAt(pt.x, pt.y, s); markers.push({ kind: d.titan ? 'titan' : 'boss', id: d.id, x: pt.x, y: pt.y, r: s, down: d.down, wx: d.x, wz: d.z, box }); boxes.push(box);
    }
    // A downed den's timer: under its crown, or above or beside it where a name is already there. It is always drawn.
    for (const m of markers) {
      if (!m.down) continue;
      const d = dens.find(o => o.id === m.id), text = clock(d.left), tw = textWidth(ctx, text, font), dy = m.r + font * .62, dx = m.r + tw / 2 + 3; P.countdown = true;
      let x = m.x, y = m.y + dy;
      for (const [ox, oy] of [[0, dy], [0, -dy], [dx, 0], [-dx, 0]]) { const box = { x0: m.x + ox - tw / 2 - 1, x1: m.x + ox + tw / 2 + 1, y0: m.y + oy - font * .58, y1: m.y + oy + font * .58 }; if (box.x0 < 1 || box.x1 > w - 1 || box.y0 < 1 || box.y1 > h - 1 || overlaps(box, boxes.filter(o => o !== m.box))) continue; x = m.x + ox; y = m.y + oy; break; }
      haloText(ctx, text, x, y, font, COLORS.downInk); boxes.push({ x0: x - tw / 2 - 1, x1: x + tw / 2 + 1, y0: y - font * .58, y1: y + font * .58 }); labels.push({ text, kind: 'timer', x, y, w: tw, h: font, size: font }); m.timer = y > m.y + 1;
    }
    // A cage stands 6.5 m from its boss: its own marker where the zoom parts the two, a badge on the crown's shoulder where it does not.
    for (const c of view.cages ?? []) {
      if (c.state !== 'locked' && c.state !== 'open') continue;
      const d = dens.find(o => o.id === c.den); P.point(c.x, c.z, pt); let x = pt.x, y = pt.y, r = SHEET.cage;
      if (d) { P.point(d.x, d.z, pt); const s = d.titan ? SHEET.titan : SHEET.crown; if (hyp(x - pt.x, y - pt.y) < s + SHEET.cage + 1) { x = pt.x + s * .82; y = pt.y - s * .82; r = SHEET.badge; } }
      if (!on(x, y, r)) continue;
      badge(ctx, x, y, r, c.state); markers.push({ kind: 'cage', id: c.id, x, y, r, state: c.state, wx: c.x, wz: c.z }); boxes.push(boxAt(x, y, r));
    }
  }
  if (me) { P.point(me.x, me.z, pt); if (on(pt.x, pt.y, SHEET.you)) { arrow(ctx, pt.x, pt.y, SHEET.you / 1.15, arrowTurn(view.place === 'interior' ? 0 : view.facing ?? 0, 0)); markers.push({ kind: 'you', id: 'you', x: pt.x, y: pt.y, r: SHEET.you, wx: me.x, wz: me.z }); } }
  if (picked) { const m = markers.find(m => m.id === picked); if (m) { ctx.strokeStyle = COLORS.crown; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(m.x, m.y, m.r + 4, 0, TAU); ctx.stroke(); ctx.strokeStyle = COLORS.ink; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(m.x, m.y, m.r + 5.6, 0, TAU); ctx.stroke(); } }
  // Names. The village's thirteen from kNames (the Village preset always shows them): above its building, else below, else a line further out.
  if (k >= L.kNames - 1e-9) {
    const lift = 4.3 * k + font * .62, line = font * 1.2;
    const name = (text, x, z) => { P.point(x, z, pt); const px = pt.x, py = pt.y; return put(text, px, py - lift, 'place') || put(text, px, py + lift, 'place') || put(text, px, py - lift - line, 'place') || put(text, px, py + lift + line, 'place'); };
    name('Home', home.x, home.z);
    for (const c of CIVIC) name(CIVIC_SHORT[c.id] ?? c.name, c.x, c.z);
    for (const h of HOMES.slice(1)) name(h.family, h.x, h.z);
    for (const h of BARNS) name(h.family, h.x, h.z);
  }
  if (!far && dens) for (const m of markers) { if (m.kind !== 'boss' && m.kind !== 'titan') continue; const d = dens.find(o => o.id === m.id), y = m.y + m.r + font * .66 + (m.timer ? font * 1.16 : 0); const color = d.down ? COLORS.downInk : d.titan ? COLORS.titan : COLORS.boss; put(denName(d.type), m.x, y, 'den', font, color) || put(denName(d.type), m.x, m.y - m.r - font * .66, 'den', font, color); }
  if (k >= L.kNames - 1e-9) for (const m of markers) if (m.kind === 'cage') put(m.state === 'open' ? `${FRIENDS[m.id]?.name ?? 'Friend'} waits` : 'Locked cage', m.x, m.y - m.r - font * .66, 'cage', font, COLORS.lock);
  if (!far) { P.point(0, SAFE.z0, pt); put(REGION.village.name, pt.x, Math.max(pt.y, 0) + 7 + SHEET.name * .58, 'region', SHEET.name); }
  return P;
}
/** The marker a tap picks: the nearest one within SHEET.pick pixels (a den before the cage on its shoulder only when it is nearer), or null. */
export function pickMarker(P, x, y) {
  let best = null, least = SHEET.pick;
  for (const m of P?.markers ?? []) { const d = hyp(m.x - x, m.y - y); if (d < least) { least = d; best = m; } }
  return best;
}
/** The line under the sheet for a picked marker: "♛ Crocodile King · Lv 10 · Chomper Swamp · 212 m north". */
export function pickLine(view, marker) {
  if (!marker) return '';
  if (marker.kind === 'boss' || marker.kind === 'titan') return `♛ ${denLine(view, view.dens?.find(d => d.id === marker.id))}`;
  if (marker.kind === 'cage') { const cage = (view.cages ?? []).find(c => c.id === marker.id); return cage ? `${cage.state === 'open' ? '🗝' : '🔒'} ${cageLine(cage)}` : ''; }
  if (marker.kind === 'home') return `⌂ Home · ${wayTo(view, marker.wx, marker.wz)}`;
  if (marker.kind === 'outpost') { const o = OUTPOSTS.find(q => q.id === marker.id); return `⚑ ${o.name} · ${levelLabel(o.region)} · a rest spot with a Home pad · ${wayTo(view, marker.wx, marker.wz)}`; }
  if (marker.kind === 'vehicle') return `${marker.id === 'bike' ? 'Motorcycle' : 'Bell family jeep'} · ${wayTo(view, marker.wx, marker.wz)}`;
  return `▲ You · ${REGION[regionAt(marker.wx, marker.wz)]?.name ?? 'Beyond the map'}`;
}
