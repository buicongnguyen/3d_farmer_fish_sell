// The round minimap, after Zoo Garden's (cute_game src/minimap.ts): a circle with you at its centre, drawn "screen up"
// (the top of the map is the top of the screen, so the stick, the keys and the map agree) with an N badge that rides
// the rim to where north is. Outdoors: the fields, the village lawn, the county road and the lanes, the pond, the family
// field, every house in its roof colour, the Town Square, the three shops, neighbours as dots; while the Pandora box is
// open also the ward line, the wild creatures as dots and the King Bear's den as a crown. Home rides the rim when it is
// off the map, so the map always points the way back, and so does the crown: it rides the rim toward the den until the
// den itself comes onto the map. Indoors: the plan of the house (rooms, walls with their doorways, the front door, the Pandora
// chest at home, the family). At the country market: the road, the stall and the way back.
//
// Why a circle (and not a rectangle for the square village): the world is endless round the village and the map is
// centred on you, so every direction deserves the same reach; the HUD already frames it round; and a rim is the natural
// place for the north badge and the way-home marker. The whole village on one sheet is the full map (tap the minimap).
//
//   projection({x, z, heading, radius, size})   world metres -> map pixels (pure; the tests check it)
//   const map = new Minimap(canvas, {north, caption}, () => view)   then map.frame(dt) every frame (it draws 8x a second)
//   drawFullMap(ctx, view, width, height)        the big north-up sheet in the map panel
//
// view: {place: 'village'|'interior'|'country', x, z, facing, heading, pandora, houseId, house, rooms, npcs, creatures,
//        shops, residents, chest, den}. Positions are world metres; `heading` is the camera's yaw (0 indoors).
//        den: {x, z, down, left} while the box is open (denStatus()), else null; outside: {x, z} where you stand in
//        the village while you are indoors or at the country market (for distances on the full map).
// Pure drawing on a 2D context (no three.js): everything is a few dozen rectangles, redrawn in well under a millisecond.
import { HOUSES, HOMES, CIVIC, ROADS, POND, BED_POSITIONS } from './content.mjs';
import { VILLAGE, inVillage, beyondVillage } from './field-layout.mjs';
import { ROOM, ROOMS, WALLS, SPOTS, wallSpans } from './home-plan.mjs';
import { SAFE, DEN, ringAt } from './wilds.mjs';
import { LOTS, LANES_GRAVEL } from './lots.mjs';

const TAU = Math.PI * 2;
/** Metres from the centre to the rim. In the fields the map opens up with the distance, so the village stays on it a while. */
export const RANGE = { village: 46, fields: 120, grow: .9, country: 32, room: Math.hypot(ROOM.w, ROOM.d) / 2 + .9 };
/** Creatures show as dots within this many metres (the reference shows 40; our fields are wider), a boss as far as the map reaches. */
export const CREATURE_RANGE = 64;
export const COLORS = {
  fields: '#86d35f', lawn: '#a4e87a', road: '#6c7486', lane: '#f2d38e', pond: '#35b6f2', sand: '#f6dc96', soil: '#a8703f', pen: '#e9c98a',
  ward: '#b25cff', creature: '#d9372b', angry: '#ff2d55', boss: '#7a1f1f', bossDown: '#8d8794', crown: '#ffc93c', neighbour: '#8a6b4c', you: '#ffffff', youEdge: '#2f7fd6', home: '#ef5a3c',
  civic: { school: '#f5b21e', hospital: '#3ccfae', police: '#2d58c8', company: '#ff8a2a' }, shop: { market: '#ff8a2a', clothes: '#ff5d9e', upgrades: '#8f6cf5', country: '#ff8a2a' },
  void: '#2a1d1a', wall: '#8a5a3b', door: '#3fbf2c', chest: '#b25cff', room: { bedroom: '#d3c6ff', bath: '#9fe0ee', kitchen: '#b8ead2', living: '#ffdcae', nook: '#ffcadb' },
  country: '#afc38c', countryRoad: '#d9c799',
};
/** Short names for the full map (the buildings stand 16 m apart). */
const CIVIC_SHORT = { school: 'School', hospital: 'Clinic', police: 'Police', company: 'Willow & Co.' };
/** The families' barns (the Moss barn by the pen, the Hearth bakery by the green): drawn like the houses, in the family's colour. */
const BARNS = HOUSES.filter(h => h.lodge === 'barn' || h.lodge === 'bakery');
export { beyondVillage };
/**
 * The King Bear for the map, from the creature simulation (wilds.mjs Wilds: list, dead, time): where to draw the crown
 * (the bear itself while it is loaded and alive, else its den) and whether it is down, with the seconds until it is back.
 */
export function denStatus(wilds, out = { x: DEN.x, z: DEN.z, down: false, left: 0 }) {
  out.x = DEN.x; out.z = DEN.z; out.down = false; out.left = 0;
  const list = wilds?.list ?? [];
  for (let i = 0; i < list.length; i++) {
    const e = list[i]; if (e.id !== 'w:den') continue;
    if (e.hp > 0 && !(e.leaving > 0)) { out.x = e.x; out.z = e.z; } else { out.down = true; out.left = Math.max(0, e.respawn ?? 0); }
    return out;
  }
  const until = wilds?.dead?.get?.('w:den') ?? 0, left = until - (wilds?.time ?? 0);
  if (left > 0) { out.down = true; out.left = left; }
  return out;
}
/** "north-east": the way from one point to another in words (north is -z). */
export function compass(dx, dz) { return ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round(Math.atan2(dx, -dz) / (Math.PI / 4) + 8) % 8]; }
/** "1:05" */
const clock = seconds => `${Math.floor(Math.ceil(seconds) / 60)}:${String(Math.ceil(seconds) % 60).padStart(2, '0')}`;
/** What the map says about the King Bear: "King Bear · 290 m north-east" (or "… · back in 1:05" while it is down). */
export function denLabel(view) {
  const d = view?.den; if (!d) return '';
  const me = view.place === 'village' || !view.place ? view : view.outside ?? HOUSES[0]; // indoors: measured from the door you came in by
  const far = Math.hypot(d.x - me.x, d.z - me.z), where = far < 12 ? 'right here' : `${Math.round(far)} m ${compass(d.x - me.x, d.z - me.z)}`;
  return d.down ? `King Bear · resting, back in ${clock(d.left)} · ${where}` : `King Bear · ${where}`;
}
/** The map's reach in metres for a place and a position. */
export function mapRadius(place, x = 0, z = 0) {
  if (place === 'interior') return RANGE.room;
  if (place === 'country') return RANGE.country;
  return Math.min(RANGE.fields, RANGE.village + beyondVillage(x, z) * RANGE.grow);
}
/**
 * World metres to map pixels. The player (x, z) is the centre; `heading` is the camera's yaw, so the camera's right is
 * the map's right and what is farther from the camera is higher on the map. `radius` metres reach the rim of a map
 * `size` pixels across. point() writes into `out` (no allocation in the draw loop); matrix is the same thing for
 * ctx.setTransform, so shapes can be drawn in metres.
 */
export function projection({ x = 0, z = 0, heading = 0, radius = RANGE.village, size = 300 } = {}) {
  const half = size / 2, k = half / radius, c = Math.cos(heading), s = Math.sin(heading);
  const point = (wx, wz, out = { x: 0, y: 0 }) => { const dx = wx - x, dz = wz - z; out.x = half + (dx * c - dz * s) * k; out.y = half + (dx * s + dz * c) * k; return out; };
  /** Map pixels back to world metres. */
  const world = (px, py, out = { x: 0, z: 0 }) => { const mx = (px - half) / k, my = (py - half) / k; out.x = x + mx * c + my * s; out.z = z - mx * s + my * c; return out; };
  return { x, z, heading, radius, size, half, k, point, world, matrix: [k * c, k * s, -k * s, k * c, half - (x * c - z * s) * k, half - (x * s + z * c) * k] };
}
/** Where north (world −z) is on the rim, as a clockwise angle from the top: the camera's yaw. */
export const northAngle = heading => heading;
/** The N badge's centre in per cent of the map's box (50, 0 is the top). */
export const northSpot = heading => ({ left: 50 + 50 * Math.sin(heading), top: 50 - 50 * Math.cos(heading) });
/**
 * A world point on the map, pulled onto the rim (at `inset` pixels from the edge) when it lies beyond it:
 * {x, y, off, angle}. `angle` is the direction from the centre (0 = up, clockwise), for a pointer.
 */
export function rimPoint(P, wx, wz, inset = 14, out = { x: 0, y: 0, off: false, angle: 0 }) {
  P.point(wx, wz, out);
  const dx = out.x - P.half, dy = out.y - P.half, d = Math.hypot(dx, dy), reach = P.half - inset;
  out.off = d > reach; out.angle = Math.atan2(dx, -dy);
  if (out.off) { out.x = P.half + dx / d * reach; out.y = P.half + dy / d * reach; }
  return out;
}
/** The arrow's turn on the canvas for a facing (atan2(dx, dz): 0 looks at the camera): it points where you walk. */
export const arrowTurn = (facing, heading) => Math.PI - (facing - heading);
/** The name under the map: where you are. */
export function mapCaption(view) {
  if (view.place === 'interior') return (view.house?.name ?? 'Indoors').toUpperCase();
  if (view.place === 'country') return 'COUNTRY MARKET';
  if (inVillage(view.x, view.z)) return 'WILLOWMERE';
  return (view.pandora ? ringAt(view.x, view.z)?.name ?? 'Village edge' : 'Open fields').toUpperCase();
}

// ---------------------------------------------------------------- drawing
const pt = { x: 0, y: 0 }, rim = { x: 0, y: 0, off: false, angle: 0 };
const front = h => ({ x: Math.sin(h.rot ?? 0), z: Math.cos(h.rot ?? 0) });
const rect = (ctx, x, z, w, d) => ctx.fillRect(x - w / 2, z - d / 2, w, d);
/** The village and the fields in world metres (the context is transformed by the projection's matrix). */
export function drawVillage(ctx, P, view) {
  const R = ROADS, px = 1 / P.k; // one map pixel in metres
  ctx.fillStyle = COLORS.lawn; ctx.fillRect(VILLAGE.x0, VILLAGE.z0, VILLAGE.x1 - VILLAGE.x0, VILLAGE.z1 - VILLAGE.z0);
  // Gravel lanes (under the road): the homestead's own, and every family's drive.
  ctx.fillStyle = COLORS.lane;
  rect(ctx, 0, (-10 + R.south) / 2, 3.4, R.south + 10); rect(ctx, 10, -11.5, 18, 2.6); rect(ctx, 6, 12.2, 10, 2.4); rect(ctx, 0, (R.north - 17.5) / 2, 2.6, -R.north - 17.5);
  for (const p of LANES_GRAVEL) rect(ctx, p.x, p.z, p.w, p.d);                              // the West Lane and the Field Lane
  for (const lot of LOTS) for (const p of lot.paths) rect(ctx, p.x, p.z, p.w, p.d);          // drives, front paths, back paths (lots.mjs)
  // The county road: a ring with the spur to the country market.
  ctx.fillStyle = COLORS.road;
  rect(ctx, 0, R.north, R.east * 2 + 5, 5); rect(ctx, 0, R.south, R.east * 2 + 5, 5);
  rect(ctx, R.west, (R.north + R.south) / 2, 5, R.south - R.north); rect(ctx, R.east, (R.north + R.south) / 2, 5, R.south - R.north);
  rect(ctx, R.east + 8, 0, 11, 5);
  // The pond in its sandy rim, the family field, the animal pen.
  ctx.fillStyle = COLORS.sand; rect(ctx, POND.x, POND.z, POND.w + 1.6, POND.d + 1.6);
  ctx.fillStyle = COLORS.pond; rect(ctx, POND.x, POND.z, POND.w, POND.d);
  const beds = view.beds ?? 6, last = BED_POSITIONS[Math.max(0, beds - 1)];
  ctx.fillStyle = COLORS.soil; ctx.fillRect(-23.3, -4.4, 15.6, last.z + 1.4 + 4.4);
  ctx.fillStyle = COLORS.pen; ctx.fillRect(8, -23, 15, 8.4);
  // The Town Square and the families' houses, in their own colours.
  ctx.lineWidth = Math.max(.45, 1.4 * px); ctx.strokeStyle = '#ffffff';
  for (const c of CIVIC) { ctx.fillStyle = COLORS.civic[c.id] ?? '#ffffff'; rect(ctx, c.x, c.z, c.w, c.d); ctx.strokeRect(c.x - c.w / 2, c.z - c.d / 2, c.w, c.d); }
  for (const h of HOMES.slice(1)) { const side = Math.abs(front(h).x) > .5, w = side ? 6.6 : 8, d = side ? 8 : 6.6; ctx.fillStyle = h.color; rect(ctx, h.x, h.z, w, d); ctx.strokeRect(h.x - w / 2, h.z - d / 2, w, d); }
  for (const h of BARNS) { ctx.fillStyle = h.color; rect(ctx, h.x, h.z, 8.4, 7.4); ctx.strokeRect(h.x - 4.2, h.z - 3.7, 8.4, 7.4); }
  for (const { h, barn } of LOTS) if (barn) { ctx.fillStyle = h.color; rect(ctx, barn.x, barn.z, barn.w, barn.d); ctx.strokeRect(barn.x - barn.w / 2, barn.z - barn.d / 2, barn.w, barn.d); } // the Vale workshop's barn
  // The ward at the village edge while the Pandora box is open.
  if (view.pandora) {
    ctx.strokeStyle = COLORS.ward; ctx.lineWidth = Math.max(.8, 2.4 * px); ctx.setLineDash([5 * px, 3.5 * px]);
    ctx.strokeRect(SAFE.x0, SAFE.z0, SAFE.x1 - SAFE.x0, SAFE.z1 - SAFE.z0); ctx.setLineDash([]);
  }
}
const disc = (ctx, x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };
/** A little house (the homestead): a roof over a white wall. */
function houseGlyph(ctx, x, y, s, roof = COLORS.home) {
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#3a2433'; ctx.lineWidth = s * .22; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x - s, y + s * .95); ctx.lineTo(x - s, y - s * .05); ctx.lineTo(x, y - s * 1.05); ctx.lineTo(x + s, y - s * .05); ctx.lineTo(x + s, y + s * .95); ctx.closePath(); ctx.stroke(); ctx.fill();
  ctx.fillStyle = roof; ctx.beginPath(); ctx.moveTo(x - s * 1.25, y); ctx.lineTo(x, y - s * 1.2); ctx.lineTo(x + s * 1.25, y); ctx.closePath(); ctx.fill();
}
/** A diamond: a shop (so it never reads as a house). */
function diamond(ctx, x, y, s, color) {
  ctx.fillStyle = color; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = s * .42; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y); ctx.closePath(); ctx.stroke(); ctx.fill();
}
/** You: a white arrow outlined in blue, pointing where you face. */
function arrow(ctx, x, y, s, turn) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(turn);
  ctx.fillStyle = COLORS.you; ctx.strokeStyle = COLORS.youEdge; ctx.lineWidth = s * .34; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(0, -s * 1.15); ctx.lineTo(s * .85, s * .8); ctx.lineTo(0, s * .38); ctx.lineTo(-s * .85, s * .8); ctx.closePath(); ctx.stroke(); ctx.fill();
  ctx.restore();
}
/** The King Bear's crown on a dark disc; grey and faint while the bear is down. */
function crown(ctx, x, y, s, down = false) {
  ctx.save(); if (down) ctx.globalAlpha = .6;
  ctx.fillStyle = down ? COLORS.bossDown : COLORS.boss; disc(ctx, x, y, s);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = s * .2; ctx.stroke();
  ctx.fillStyle = down ? '#ffffff' : COLORS.crown; ctx.font = `bold ${s * 1.62}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('♛', x, y + s * .09);
  ctx.restore();
}
/** A little dart at a rim marker, pointing outward: the way to what lies beyond the map. */
function dart(ctx, x, y, angle, u, color = '#3a2433') {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, -6.4 * u); ctx.lineTo(2.6 * u, -3.4 * u); ctx.lineTo(-2.6 * u, -3.4 * u); ctx.closePath(); ctx.fill(); ctx.restore();
}
/** Markers stay upright and the same size at every zoom: drawn in map pixels, after the terrain. `u` is size / 100. */
export function drawVillageMarkers(ctx, P, view, u = P.size / 100, { rimHome = true, den = true } = {}) {
  for (const s of view.shops ?? []) { P.point(s.x, s.z, pt); diamond(ctx, pt.x, pt.y, 2.5 * u, COLORS.shop[s.id] ?? '#ff8a2a'); }
  ctx.fillStyle = COLORS.neighbour;
  for (const n of view.npcs ?? []) { if (n.hidden) continue; P.point(n.x, n.z, pt); disc(ctx, pt.x, pt.y, 1.15 * u); }
  if (view.pandora) for (const e of view.creatures ?? []) {
    if (!(e.hp > 0) || e.boss && view.den) continue; // the King Bear is the crown below
    const far = Math.hypot(e.x - view.x, e.z - view.z); if (far > P.radius || (!e.boss && far > CREATURE_RANGE)) continue;
    P.point(e.x, e.z, pt);
    if (e.boss) crown(ctx, pt.x, pt.y, 3.4 * u);
    else { ctx.fillStyle = e.angry ? COLORS.angry : COLORS.creature; disc(ctx, pt.x, pt.y, (e.angry ? 1.9 : 1.5) * u); }
  }
  // The King Bear's den, only while the box is open: on its spot, or on the rim in its direction; faint while he is down.
  if (view.pandora && view.den && den) {
    rimPoint(P, view.den.x, view.den.z, 6.5 * u, rim);
    if (rim.off) dart(ctx, rim.x, rim.y, rim.angle, u, view.den.down ? COLORS.bossDown : COLORS.boss);
    crown(ctx, rim.x, rim.y, 3.4 * u, view.den.down);
  }
  // Home: on its spot, or on the rim pointing the way back.
  const home = HOUSES[0];
  if (rimHome) {
    rimPoint(P, home.x, home.z, 6.5 * u, rim);
    if (rim.off) dart(ctx, rim.x, rim.y, rim.angle, u);
    houseGlyph(ctx, rim.x, rim.y, 3.1 * u);
  } else { P.point(home.x, home.z, pt); houseGlyph(ctx, pt.x, pt.y, 3.1 * u); }
}
/** The inside of a house, in metres (north up: the indoor camera looks straight in). */
export function drawRoom(ctx, P, view) {
  const px = 1 / P.k, colors = view.rooms ?? COLORS.room, t = Math.max(ROOM.thick, 2.2 * px);
  for (const room of ROOMS) { const r = room.rect; ctx.fillStyle = colors[room.id] ?? COLORS.room[room.id]; ctx.fillRect(r.x0, r.z0, r.x1 - r.x0, r.z1 - r.z0); }
  ctx.fillStyle = COLORS.wall;
  for (const wall of WALLS) for (const [a, b] of wallSpans(wall)) { if (wall.axis === 'x') ctx.fillRect(a, wall.at - t / 2, b - a, t); else ctx.fillRect(wall.at - t / 2, a, t, b - a); }
  // The front door, in green: the way out.
  const door = WALLS.find(w => w.axis === 'x' && w.at === ROOM.d / 2)?.gaps[0];
  if (door) { ctx.fillStyle = COLORS.door; ctx.fillRect(door[0], ROOM.d / 2 - t, door[1] - door[0], t * 2); }
}
export function drawRoomMarkers(ctx, P, view, u = P.size / 100) {
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#8a5a3b'; ctx.lineWidth = .45 * u;
  for (const s of view.spots ?? []) { P.point(s.x, s.z, pt); ctx.beginPath(); ctx.arc(pt.x, pt.y, 1.5 * u, 0, TAU); ctx.fill(); ctx.stroke(); }
  if (view.chest) { P.point(view.chest.x, view.chest.z, pt); diamond(ctx, pt.x, pt.y, 2.6 * u, COLORS.chest); }
  ctx.fillStyle = COLORS.neighbour;
  for (const r of view.residents ?? []) { P.point(r.x, r.z, pt); disc(ctx, pt.x, pt.y, 1.7 * u); }
}
/** The country market: the road, the stall, the way back to Willowmere. */
export function drawCountry(ctx) {
  ctx.fillStyle = COLORS.country; ctx.fillRect(-29, -24, 58, 48);
  ctx.fillStyle = COLORS.countryRoad; ctx.fillRect(-27.5, -2.5, 55, 5);
}
/**
 * One whole minimap frame into a square canvas context of `size` pixels: clipped to the circle, terrain, markers, you.
 * Returns the projection it used.
 */
export function drawMinimap(ctx, view, size, radius = mapRadius(view.place, view.x, view.z)) {
  const indoor = view.place === 'interior', u = size / 100;
  // Indoors the map is the house itself (centred on it); outdoors it is centred on you.
  const P = projection({ x: indoor ? 0 : view.x, z: indoor ? 0 : view.z, heading: indoor ? 0 : view.heading ?? 0, radius, size });
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, size, size);
  ctx.save(); ctx.beginPath(); ctx.arc(P.half, P.half, P.half - .5, 0, TAU); ctx.clip();
  ctx.fillStyle = indoor ? COLORS.void : view.place === 'country' ? '#93b56f' : COLORS.fields; ctx.fillRect(0, 0, size, size);
  ctx.save(); ctx.transform(...P.matrix);
  if (indoor) drawRoom(ctx, P, view); else if (view.place === 'country') drawCountry(ctx); else drawVillage(ctx, P, view);
  ctx.restore();
  if (indoor) drawRoomMarkers(ctx, P, view, u);
  else if (view.place === 'country') { for (const s of view.shops ?? []) { P.point(s.x, s.z, pt); diamond(ctx, pt.x, pt.y, 2.8 * u, COLORS.shop.country); } }
  else drawVillageMarkers(ctx, P, view, u);
  P.point(view.x, view.z, pt); arrow(ctx, pt.x, pt.y, 4.3 * u, arrowTurn(view.facing ?? 0, P.heading));
  ctx.restore();
  return P;
}
/**
 * The full map in the map panel: the whole village north up on a sheet, with family and Town Square names. It opens up
 * to keep you on the sheet when you are out in the fields.
 */
export function drawFullMap(ctx, view, width, height) {
  // The sheet holds the village, its ward and a margin for the names; its middle is the middle of the footprint.
  const cx = (VILLAGE.x0 + VILLAGE.x1) / 2, cz = (VILLAGE.z0 + VILLAGE.z1) / 2, spanX = VILLAGE.x1 - VILLAGE.x0 + 26, spanZ = VILLAGE.z1 - VILLAGE.z0 + 26;
  const away = view.place === 'village' ? Math.max(1, Math.abs(view.x - cx) / (spanX / 2 - 6), Math.abs(view.z - cz) / (spanZ / 2 - 6)) : 1;
  const k = Math.min(width / spanX, height / spanZ) / away, size = Math.max(width, height), u = Math.min(width, height) / 100;
  // A projection whose half-size is the sheet's centre on each axis: build it square, then shift.
  const P = projection({ x: cx, z: cz, heading: 0, radius: size / 2 / k, size });
  const ox = (width - size) / 2, oy = (height - size) / 2;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, width, height); ctx.fillStyle = COLORS.fields; ctx.fillRect(0, 0, width, height);
  ctx.save(); ctx.translate(ox, oy);
  ctx.save(); ctx.transform(...P.matrix); drawVillage(ctx, P, view); ctx.restore();
  drawVillageMarkers(ctx, P, view, u * .8, { rimHome: false, den: false });
  if (away < 2.2) {
    ctx.font = `900 ${Math.max(11, 2.5 * u)}px Nunito, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round'; ctx.lineWidth = .9 * u; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.fillStyle = '#2c3a26';
    const label = (text, x, z, lift) => { P.point(x, z, pt); ctx.strokeText(text, pt.x, pt.y - lift); ctx.fillText(text, pt.x, pt.y - lift); };
    for (const h of HOMES.slice(1)) label(h.family, h.x, h.z, 5.2 * P.k);
    for (const h of BARNS) label(h.family, h.x, h.z, 5 * P.k);
    for (const c of CIVIC) label(CIVIC_SHORT[c.id] ?? c.name, c.x, c.z, 5 * P.k);
    label('Home', HOUSES[0].x, HOUSES[0].z, 5.4 * P.k);
  }
  if (view.place === 'village') { P.point(view.x, view.z, pt); arrow(ctx, pt.x, pt.y, 2.6 * u, arrowTurn(view.facing ?? 0, 0)); }
  // The King Bear's den while the box is open: on its spot when the sheet reaches it, else at the sheet's edge in its
  // direction, with how far and which way it is from you.
  if (view.pandora && view.den) {
    const d = view.den, s = 3 * u, pad = s + 2.2 * u; P.point(d.x, d.z, pt);
    const x = Math.max(pad - ox, Math.min(width - pad - ox, pt.x)), y = Math.max(pad - oy, Math.min(height - pad - oy, pt.y)), off = x !== pt.x || y !== pt.y;
    if (off) dart(ctx, x, y, Math.atan2(pt.x - x, -(pt.y - y)), u * .8, d.down ? COLORS.bossDown : COLORS.boss);
    crown(ctx, x, y, s, d.down);
    const right = x + ox > width / 2, text = denLabel(view);
    ctx.font = `900 ${Math.max(11, 2.4 * u)}px Nunito, sans-serif`; ctx.textAlign = right ? 'right' : 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineWidth = .9 * u; ctx.strokeStyle = 'rgba(255,255,255,.92)'; ctx.fillStyle = d.down ? '#5d5866' : '#7a1f1f';
    const tx = x + (right ? -1 : 1) * (s + 1.6 * u);
    ctx.strokeText(text, tx, y); ctx.fillText(text, tx, y);
  }
  ctx.restore();
  return P;
}

/** Owns the minimap's canvas, its N badge and its caption: call frame(dt) every frame; it redraws 8 times a second. */
export class Minimap {
  constructor(canvas, { north = null, caption = null } = {}, view) {
    this.canvas = canvas; this.north = north; this.captionNode = caption; this.view = view;
    this.wait = 0; this.radius = 0; this.place = ''; this.caption = ''; this.heading = NaN; this.draws = 0; this.last = null;
  }
  /** Forces the next frame to redraw. */
  invalidate() { this.wait = 0; }
  frame(dt = 0) {
    this.wait -= dt; if (this.wait > 0) return false; this.wait = .125;
    const view = this.view(); if (!view) return false;
    const ctx = this.canvas.getContext?.('2d'); if (!ctx) return false;
    // The reach eases to its target, so walking out of the village opens the map up smoothly; a new place snaps.
    const want = mapRadius(view.place, view.x, view.z);
    this.radius = view.place !== this.place || !this.radius ? want : this.radius + (want - this.radius) * .35; if (Math.abs(this.radius - want) < .05) this.radius = want;
    this.place = view.place;
    this.last = drawMinimap(ctx, view, this.canvas.width, this.radius); this.draws++;
    const heading = view.place === 'interior' ? 0 : view.heading ?? 0;
    if (heading !== this.heading && this.north) { this.heading = heading; const at = northSpot(heading); this.north.style.left = `calc(${at.left.toFixed(2)}% - 10px)`; this.north.style.top = `calc(${at.top.toFixed(2)}% - 10px)`; }
    const caption = mapCaption(view);
    if (caption !== this.caption && this.captionNode) { this.caption = caption; this.captionNode.textContent = caption; }
    return true;
  }
}
