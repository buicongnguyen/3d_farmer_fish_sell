// The maps (round 8, builder F): the round minimap and the drawing of the Map window's sheet (world-map.mjs owns the
// sheet's camera and input).
//
// The minimap follows Zoo Garden's mechanism (cute_game src/minimap.ts) where that game has one: NORTH UP with only your
// arrow turning (minimap.ts:100), the terrain drawn once into an offscreen canvas and blitted (:113-123), the regions in
// their ground colours (:17, :50-52), the four sand trails from trailOffset (:54-59), the land features in its map colours
// (:65-76), every boss marked with its crown (:92), creature dots in a range (:93-94), the caption by region (:20-22), and
// a tap opens the Map. It departs from it in one thing (spec 10, open question 7): it is centred on YOU with a reach of
// 46 m in the village to 120 m outside, because a 640 m world on a 96 px disc would make the village 17 px wide; the whole
// world at one scale is the Map's World preset. New, asked for by the user and absent from the reference: bosses out of
// reach ride the rim with a dart and their distance, a downed one is grey with its return timer, a titan has its own
// violet marker, a prison is a badge on its boss's crown, and the rainbow borders are drawn. The village drawing and the
// indoor room plan are Willowmere's own and are kept as they were.
//
//   projection({x, z, heading, radius, size})    world metres -> map pixels (pure; the tests check it)
//   const map = new Minimap(canvas, {north, caption}, () => view)   then map.frame(dt) every frame (it draws 8x a second)
//   terrainCache()                                the 672 x 672 picture of the world both maps blit, built 96 rows a frame
//   denStatuses(wilds, out)                       one entry per den, for the maps and for metrics().dens
//   rimDens(dens, x, z, reach, cages)             which dens ride the minimap's rim, in order (spec 10.2)
//   drawWorldMap(ctx, view, cam, w, h)            the Map window's sheet: world-sheet.mjs (fetched with the Map, merge F)
//
// view: {place: 'village'|'interior', x, z, facing, pandora, houseId, house, rooms, npcs, creatures, shops, residents, chest,
//        dens, cages, defeated, vehicles, features, outside}. Positions are world metres.
//        dens: denStatuses() while the box is open, else null; cages: friends.mjs cageStatuses(); defeated: the save's map
//        of beaten kinds; vehicles: [{id, x, z}] standing in the world; features: id => world.lands.mapFeatures(id);
//        outside: {x, z} where you stand in the village while you are indoors (for distances on the Map).
// Pure drawing on a 2D context (no three.js): a blit, a few dozen strokes and rectangles, well under a millisecond.
import { HOUSES, HOMES, CIVIC, PARKING, ROADS, POND, BED_POSITIONS } from './content.mjs';
import { VILLAGE, beyondVillage } from './field-layout.mjs';
import { ROOM, ROOMS, WALLS, wallSpans } from './home-plan.mjs';
import { CREATURES } from './wilds.mjs';
import { SAFE, WARD_OUTLINE } from './ward.mjs';
import { REGION, REGION_IDS, DENS, BORDER_RUNS, TRAILS, HALF, CELL, RIM_REACH, regionAt, squareOf, trailOffset } from './regions.mjs';
import { lavaEvent, nextEvent, LAVA_CYCLE_SECONDS } from './lava-weather.mjs';
import { waterAt } from './land-features.mjs';
import { CAGES, FRIENDS } from './friends.mjs';
import { LOTS, LANES_GRAVEL } from './lots.mjs';

const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** Metres from the centre to the rim. In the fields the map opens up with the distance, so the village stays on it a while. */
export const RANGE = { village: 46, fields: 120, grow: .9, room: Math.hypot(ROOM.w, ROOM.d) / 2 + .9 };
/** Creatures show as dots within this many metres (the reference shows 40; our fields are wider), a boss as far as the map reaches. */
export const CREATURE_RANGE = 64;
/** A den is drawn on its spot while it is within this share of the reach; beyond it, it may ride the rim. At most RIM_MAX ride it (a tie at the cap lets one more through). */
export const ON_MAP = .93, RIM_MAX = 8;
/** Below this many CSS pixels across (the 96 and 80 px phone minimaps) only the nearest RIM_LABELS rim markers carry their distance; the rest keep the dart (the rim mock, evidence-round8/F). */
export const RIM_SMALL = 110, RIM_LABELS = 4;
export const COLORS = {
  fields: '#86d35f', lawn: '#a4e87a', road: '#6c7486', lane: '#f2d38e', pond: '#35b6f2', sand: '#f6dc96', soil: '#a8703f', pen: '#e9c98a',
  ward: '#b25cff', creature: '#d9372b', angry: '#ff2d55', boss: '#7a1f1f', bossDown: '#8d8794', crown: '#ffc93c', neighbour: '#8a6b4c', you: '#ffffff', youEdge: '#2f7fd6', home: '#ef5a3c',
  civic: { school: '#f5b21e', hospital: '#3ccfae', police: '#2d58c8', company: '#ff8a2a', supermarket: '#ff5d5d' }, shop: { market: '#ff8a2a', clothes: '#ff5d9e', upgrades: '#8f6cf5', supermarket: '#ff5d5d' },
  void: '#2a1d1a', wall: '#8a5a3b', door: '#3fbf2c', chest: '#b25cff', room: { bedroom: '#d3c6ff', bath: '#9fe0ee', kitchen: '#b8ead2', living: '#ffdcae', nook: '#ffcadb' },
  parking: '#8a92a3',
  // Round 8. beyond: what lies outside the thirteen squares; titan, dragon: the two new crowns; lock, key: the prison badges;
  // trail: the reference's sand; band: the rainbow border's three colours inside a white (at the world's edge, dark) casing.
  beyond: '#ece4d0', titan: '#5b2a86', dragon: '#ff632e', lock: '#6f7480', key: '#f2a91c', vehicle: '#3d6fe0', trail: '#ecd59a', ink: '#3a2433', downInk: '#5d5866',
  band: ['#ff4d5e', '#ffe14d', '#4cc3ff'], casing: '#ffffff', casingOuter: '#3a2433',
  // The land features, in the reference's map colours (minimap.ts:65-76).
  feature: { pond: '#4cb8f0', lake: '#4cb8f0', pool: '#ff6a2b', nest: '#ff6a2b', poison: '#7fd36b', track: '#9aa6b8', rail: '#9aa6b8', sea: '#3a9ad9', floor: '#d9e4ff', cloud: '#d9e4ff' },
};
/** Short names for the full map (the buildings stand 16 m apart). */
export const CIVIC_SHORT = { school: 'School', hospital: 'Clinic', police: 'Police', company: 'Willow & Co.', supermarket: 'Supermarket' };
/** A region's one word on the Map zoomed far out (the words of the user's drawing, spec 1.2). */
export const REGION_SHORT = { village: 'Village', west: 'Forest', north: 'Swamp', south: 'Meadow', east: 'Canyon', toy: 'Toybox', candy: 'Candy', jungle: 'Jungle', ice: 'Frost', ocean: 'Beach', lava: 'Ember', cloud: 'Cloud', shadow: 'Night' };
/** The families' barns (the Moss barn by the pen, the Hearth bakery by the green): drawn like the houses, in the family's colour. */
export const BARNS = HOUSES.filter(h => h.lodge === 'barn' || h.lodge === 'bakery');
export { beyondVillage };

// ---------------------------------------------------------------- dens and cages
/** Every den's name (spec 4.1). The creature table has the last word once a kind has its row there (builders D and D2). */
const DEN_NAMES = {
  treant: 'Ancient Treant', croc: 'Crocodile King', mushking: 'Mushroom King', bear: 'King Bear', titan_turtle: 'Ancient Mountain Turtle', robot: 'Giant Toy Robot', titan_clock: 'Clockwork Spider',
  cake: 'Cake King', gingerbread: 'Gingerbread Giant', jellyqueen: 'Jelly Queen', titan_hydra: 'Three-Headed Candy Hydra', gorilla: 'Jungle Gorilla', titan_flower: 'Death Flower Rafflesia',
  yeti: 'Snow Yeti', mammoth: 'Ice Mammoth', frostowl: 'Frost Owl', titan_crystal: 'Ice Crystal Queen', leviathan: 'Ocean Leviathan', titan_kraken: 'Abyssal Kraken', golem: 'Magma Golem', dragon: 'Volcano Dragon',
  titan_scorpion: 'Inferno Scorpion', phoenix: 'Thunder Phoenix', titan_whale: 'Celestial Cloud Whale', shadowlord: 'Shadow Lord', titan_eye: 'Void Eye',
};
export const denName = type => CREATURES[type]?.name ?? DEN_NAMES[type] ?? type;
const live = new Map();
/**
 * Every den for the maps and for metrics().dens: one reused entry per regions.mjs DENS row, in that order,
 * {id, type, titan, event, region, level, x, z, down, left} (spec 10.1). From the creature simulation (wilds.mjs Wilds:
 * list, dead, time): the creature's own position while it is loaded and alive, else the den; `down` with the seconds
 * until it is back while it is defeated. An event den (the lava dragon's nest) is down whenever its event is not on, and
 * `left` is then the time to its next visit on the lava weather's clock (`now`, wall-clock seconds), not a respawn timer.
 */
export function denStatuses(wilds, out = [], now = Date.now() / 1000) {
  live.clear();
  const list = wilds?.list ?? [];
  for (let i = 0; i < list.length; i++) { const e = list[i]; if (typeof e.id === 'string' && e.id.startsWith('w:den:')) live.set(e.id, e); }
  for (let i = 0; i < DENS.length; i++) {
    const d = DENS[i];
    let o = out[i]; if (!o || o.id !== d.id) o = out[i] = { id: d.id, type: d.type, titan: d.titan, event: d.event, region: d.region, level: d.level, x: 0, z: 0, down: false, left: 0 };
    o.x = d.x; o.z = d.z; o.down = false; o.left = 0;
    const e = live.get(d.id);
    if (e) { if (e.hp > 0 && !(e.leaving > 0)) { o.x = e.x; o.z = e.z; } else { o.down = true; o.left = Math.max(0, e.respawn ?? 0); } }
    else { const left = (wilds?.dead?.get?.(d.id) ?? 0) - (wilds?.time ?? 0); if (left > 0) { o.down = true; o.left = left; } }
    if (d.event) {
      const event = lavaEvent(now);
      // Away: the time to its next visit. Beaten during its visit (or the test hook holds another event over a real visit): back with the next cycle's.
      const later = (Math.floor(now / LAVA_CYCLE_SECONDS) + 1) * LAVA_CYCLE_SECONDS;
      if (event.id !== d.event) { o.down = true; o.x = d.x; o.z = d.z; const next = nextEvent(d.event, now); o.left = (next > now ? next : nextEvent(d.event, later)) - now; }
      else if (o.down) o.left = nextEvent(d.event, later) - now;
    }
  }
  out.length = DENS.length; live.clear();
  return out;
}
/** "north-east": the way from one point to another in words (north is -z). */
export function compass(dx, dz) { return ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round(Math.atan2(dx, -dz) / (Math.PI / 4) + 8) % 8]; }
/** "1:05" */
export const clock = seconds => Number.isFinite(seconds) ? `${Math.floor(Math.ceil(seconds) / 60)}:${String(Math.ceil(seconds) % 60).padStart(2, '0')}` : '–:––';
/** Where distances on the Map are measured from: you, or indoors the door you came in by. */
const standpoint = view => view.place === 'village' || !view.place ? view : view.outside ?? HOUSES[0];
/** "212 m north" from where you stand ("right here" within 12 m). */
export function wayTo(view, x, z) { const me = standpoint(view), far = Math.hypot(x - me.x, z - me.z); return far < 12 ? 'right here' : `${Math.round(far)} m ${compass(x - me.x, z - me.z)}`; }
/** What a den is doing, for a list row: "212 m north", "resting, back in 1:05 · 212 m north", or for the dragon "away, next visit in 12:40". */
export function denState(view, d) { return d.down ? d.event ? `away, next visit in ${clock(d.left)}` : `resting, back in ${clock(d.left)} · ${wayTo(view, d.x, d.z)}` : wayTo(view, d.x, d.z); }
/** One line about a den: "King Bear · Lv 13 · Redrock Canyon · 153 m east" (the Map shows it for a tapped crown). */
export function denLine(view, d) { return d ? `${denName(d.type)} · Lv ${d.level} · ${REGION[d.region].name} · ${denState(view, d)}` : ''; }
/** One line about a cage: "Locked cage · by the King Bear", "Clover is waiting · by the King Bear". */
export function cageLine(cage) { const boss = denName(CAGES[cage.id]?.boss ?? ''); return cage.state === 'open' ? `${FRIENDS[cage.id]?.name ?? 'A friend'} is waiting · by the ${boss}` : cage.state === 'locked' ? `Locked cage · by the ${boss}` : ''; }
/** The cage that stands by a den and still holds someone ('locked' or 'open'), or null. */
function cageOf(view, id) { const list = view.cages ?? []; for (let i = 0; i < list.length; i++) if (list[i].den === id && (list[i].state === 'locked' || list[i].state === 'open')) return list[i]; return null; }
/**
 * The den list under the Map, box open only: the dens grouped by region, the region you stand in first, then the map's
 * own order. [{region, rows: [{den, name, level, text, down, done, cage}]}] (spec 10.3).
 */
export function denRows(view) {
  const dens = view.dens; if (!view.pandora || !dens) return [];
  const me = standpoint(view), mine = regionAt(me.x, me.z), groups = [];
  for (const id of REGION_IDS) {
    const rows = dens.filter(d => d.region === id).map(d => ({ den: d, name: denName(d.type), level: d.level, text: denState(view, d), down: d.down, done: view.defeated?.[d.type] === true, cage: cageOf(view, d.id) }));
    if (rows.length) groups[id === mine ? 'unshift' : 'push']({ region: REGION[id], rows });
  }
  return groups;
}
const rimPool = [];
/**
 * Which dens ride the minimap's rim, in order (spec 10.2): [{den, far, must}]. A den within ON_MAP of the reach is on the
 * map, not here. Of the rest: the four home bosses always, at any distance, and the boss of an open cage; then every other
 * den within RIM_REACH (160 m), nearest first (a tie in DENS order), up to RIM_MAX markers in all, with a tie at the cap let
 * through (a den as far, to 0.1 m, as the last one admitted), so the most is nine. The sleeping dragon never rides the rim.
 */
export function rimDens(dens, x, z, reach, cages = [], out = []) {
  out.length = 0; let n = 0; const rest = [];
  for (let i = 0; i < (dens?.length ?? 0); i++) {
    const d = dens[i], far = Math.hypot(d.x - x, d.z - z);
    if (far <= reach * ON_MAP || d.event && d.down) continue;
    const must = REGION[d.region].kind === 'home' && !d.titan || (cages ?? []).some(c => c.den === d.id && c.state === 'open');
    if (!must && far > RIM_REACH) continue;
    const item = rimPool[n] ??= { den: null, far: 0, must: false }; n++; item.den = d; item.far = far; item.must = must;
    (must ? out : rest).push(item);
  }
  rest.sort((a, b) => a.far - b.far);
  let last = null;
  for (const item of rest) {
    if (out.length < RIM_MAX) { out.push(item); last = item; }
    else if (last && out.length === RIM_MAX && Math.abs(item.far - last.far) <= .1) out.push(item);
    else break;
  }
  return out;
}

// ---------------------------------------------------------------- projection
/** The map's reach in metres for a place and a position. */
export function mapRadius(place, x = 0, z = 0) {
  if (place === 'interior') return RANGE.room;
  return Math.min(RANGE.fields, RANGE.village + beyondVillage(x, z) * RANGE.grow);
}
/**
 * World metres to map pixels. (x, z) is the centre; `heading` turns the map (0 is north up, which is how both maps are
 * drawn from round 8; a camera's yaw makes its right the map's right). `radius` metres reach the rim of a map `size`
 * pixels across. point() writes into `out` (no allocation in the draw loop); matrix is the same thing for
 * ctx.transform, so shapes can be drawn in metres; sees(rect) says whether a world rectangle touches the disc.
 */
export function projection({ x = 0, z = 0, heading = 0, radius = RANGE.village, size = 300 } = {}) {
  const half = size / 2, k = half / radius, c = Math.cos(heading), s = Math.sin(heading);
  const point = (wx, wz, out = { x: 0, y: 0 }) => { const dx = wx - x, dz = wz - z; out.x = half + (dx * c - dz * s) * k; out.y = half + (dx * s + dz * c) * k; return out; };
  /** Map pixels back to world metres. */
  const world = (px, py, out = { x: 0, z: 0 }) => { const mx = (px - half) / k, my = (py - half) / k; out.x = x + mx * c + my * s; out.z = z - mx * s + my * c; return out; };
  const sees = r => Math.hypot(Math.max(0, r.x0 - x, x - r.x1), Math.max(0, r.z0 - z, z - r.z1)) < radius;
  return { x, z, heading, radius, size, half, k, point, world, sees, matrix: [k * c, k * s, -k * s, k * c, half - (x * c - z * s) * k, half - (x * s + z * c) * k] };
}
/** Where north (world −z) is on the rim, as a clockwise angle from the top: the map's turn (0: both maps are north up). */
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
/** The arrow's turn on the canvas for a facing (atan2(dx, dz): 0 looks south): it points where you walk. On a north-up map `heading` is 0. */
export const arrowTurn = (facing, heading = 0) => Math.PI - (facing - heading);
/** The name under the map: the house you are in, else the region you stand in (regions.mjs), box open or shut. */
export function mapCaption(view) {
  if (view.place === 'interior') return (view.house?.name ?? 'Indoors').toUpperCase();
  return (REGION[regionAt(view.x, view.z)]?.name ?? 'Beyond the map').toUpperCase();
}

// ---------------------------------------------------------------- the terrain cache
/** The cache is the world plus 16 m each way at one pixel a metre, built this many rows a step. */
export const TERRAIN = { pad: 16, half: HALF + 16, size: 2 * (HALF + 16), rows: 96 };
const makeCanvas = size => typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(size, size) : typeof document !== 'undefined' ? Object.assign(document.createElement('canvas'), { width: size, height: size }) : null;
/** The ground colour of a point for the maps: the region's (regions.mjs REGION.ground), the Beach's sea, or null outside the world. */
export function terrainFill(x, z) {
  const id = regionAt(x, z); if (id === null) return null;
  return id === 'ocean' && waterAt(x, z) ? COLORS.feature.sea : REGION[id].ground;
}
/**
 * A land's features on a map, in metres (builder B's world.lands.mapFeatures(id): [{kind, x, z, r, …}]), in the reference's
 * map colours: a disc (r, or an ellipse with rx and rz), a ring for a rail (kind 'track' or 'rail'), a rectangle (x0, x1, z0,
 * z1), or the whole square for a kind without a shape (the cloud floor). 'island' takes the region's ground colour and a
 * feature's own `color` wins. `px` is one map pixel in metres. Returns how many it drew.
 */
export function drawFeatures(ctx, view, px = 1) {
  const features = view?.features; if (typeof features !== 'function') return 0;
  let n = 0;
  for (const id of REGION_IDS) {
    const list = features(id); if (!list?.length) continue;
    const sq = squareOf(id);
    for (const f of list) {
      const color = f.color ?? (f.kind === 'island' ? REGION[id].ground : COLORS.feature[f.kind]); if (!color) continue;
      n++;
      if (f.kind === 'track' || f.kind === 'rail') { ctx.strokeStyle = color; ctx.lineWidth = Math.max(f.w ?? 1.6, 2 * px); ctx.beginPath(); ctx.arc(f.x, f.z, f.r, 0, TAU); ctx.stroke(); continue; }
      ctx.fillStyle = color;
      // Builder B's sea row is the Beach's square with the band's inner edge at (x, z): its band along the east and north sides (land-features.mjs waterAt), not the whole square.
      if (f.kind === 'sea' && f.x0 !== undefined && f.x !== undefined) { ctx.fillRect(f.x, f.z0, f.x1 - f.x, f.z1 - f.z0); ctx.fillRect(f.x0, f.z0, f.x - f.x0, f.z - f.z0); }
      else if (f.x0 !== undefined) ctx.fillRect(f.x0, f.z0, f.x1 - f.x0, f.z1 - f.z0);
      else if (f.r === undefined && f.rx === undefined) ctx.fillRect(sq.x0, sq.z0, sq.x1 - sq.x0, sq.z1 - sq.z0);
      else { ctx.beginPath(); if (f.rx !== undefined && ctx.ellipse) ctx.ellipse(f.x, f.z, Math.max(f.rx, 1.5 * px), Math.max(f.rz ?? f.rx, 1.2 * px), 0, 0, TAU); else ctx.arc(f.x, f.z, Math.max(f.r ?? f.rx, 1.5 * px), 0, TAU); ctx.fill(); }
    }
  }
  return n;
}
/**
 * The picture of the world both maps blit under their projection, so zooming costs nothing (the reference draws its
 * terrain once into an offscreen canvas too): every in-world metre in its region's ground colour, the sea, then the
 * lands' features. Empty cells stay transparent, so the staircase outline of the thirteen squares reads at a glance.
 * It is not built at boot (451,584 regionAt calls would land in the first frame): step(view) builds TERRAIN.rows rows a
 * call as runs of one colour, seven calls in all, and `ready` turns true after the last. reset() starts it again.
 */
export class Terrain {
  constructor(make = makeCanvas) { this.make = make; this.canvas = null; this.ctx = null; this.row = 0; this.ready = false; this.dead = false; this.fills = new Set(); this.blits = 0; this.steps = 0; }
  step(view) {
    if (this.ready || this.dead) return this.ready;
    if (!this.ctx) { this.canvas = this.make(TERRAIN.size); this.ctx = this.canvas?.getContext?.('2d') ?? null; if (!this.ctx) { this.dead = true; return false; } }
    const g = this.ctx, size = TERRAIN.size, half = TERRAIN.half, end = Math.min(size, this.row + TERRAIN.rows); this.steps++;
    for (; this.row < end; this.row++) {
      const z = this.row - half + .5; let from = 0, fill = terrainFill(.5 - half, z);
      for (let col = 1; col <= size; col++) {
        const next = col < size ? terrainFill(col - half + .5, z) : undefined;
        if (next === fill) continue;
        if (fill) { g.fillStyle = fill; g.fillRect(from, this.row, col - from, 1); this.fills.add(fill); }
        from = col; fill = next;
      }
    }
    if (this.row < size) return false;
    g.save(); g.translate(half, half); this.features = drawFeatures(g, view, 1); g.restore();
    return this.ready = true;
  }
  reset() { this.row = 0; this.ready = false; this.fills.clear(); this.ctx?.clearRect(0, 0, TERRAIN.size, TERRAIN.size); }
}
let terrain = null;
/** The one terrain cache. Passing a canvas factory makes a new one with it (tests; the default asks the browser for an offscreen canvas). */
export function terrainCache(make) { if (make || !terrain) terrain = new Terrain(make ?? makeCanvas); return terrain; }

// ---------------------------------------------------------------- drawing: the ground, in metres
const pt = { x: 0, y: 0 }, rim = { x: 0, y: 0, off: false, angle: 0 };
const front = h => ({ x: Math.sin(h.rot ?? 0), z: Math.cos(h.rot ?? 0) });
const rect = (ctx, x, z, w, d) => ctx.fillRect(x - w / 2, z - d / 2, w, d);
const C = CELL / 2;
/** The four strips of the centre cell, each a trapezoid between a side of the cell and the same side of the ward (regions.mjs stripSide). */
const STRIPS = [['north', [-C, -C], [C, -C], [SAFE.x1, SAFE.z0], [SAFE.x0, SAFE.z0]], ['east', [C, -C], [C, C], [SAFE.x1, SAFE.z1], [SAFE.x1, SAFE.z0]], ['south', [C, C], [-C, C], [SAFE.x0, SAFE.z1], [SAFE.x1, SAFE.z1]], ['west', [-C, C], [-C, -C], [SAFE.x0, SAFE.z0], [SAFE.x0, SAFE.z1]]];
/** The regions as flat shapes, while the cache is not whole (and wherever there is no canvas to build it in): twelve squares, the four strips, the ward. */
export function drawFlatRegions(ctx) {
  for (const id of REGION_IDS) { if (id === 'village') continue; const s = squareOf(id); ctx.fillStyle = REGION[id].ground; ctx.fillRect(s.x0, s.z0, CELL, CELL); }
  for (const [id, ...corners] of STRIPS) { ctx.fillStyle = REGION[id].ground; ctx.beginPath(); corners.forEach(([x, z], i) => i ? ctx.lineTo(x, z) : ctx.moveTo(x, z)); ctx.closePath(); ctx.fill(); }
  ctx.fillStyle = REGION.village.ground; ctx.fillRect(SAFE.x0, SAFE.z0, SAFE.x1 - SAFE.x0, SAFE.z1 - SAFE.z0);
}
/** The four sand trails of the home regions (regions.mjs TRAILS, the reference's curve), stroked live so they stay sharp at any zoom. */
export function drawTrails(ctx, px = 1) {
  ctx.strokeStyle = COLORS.trail; ctx.lineWidth = Math.max(4.4, 2 * px); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const id in TRAILS) {
    const t = TRAILS[id]; ctx.beginPath();
    for (let along = t.from, first = true; ; along = Math.min(t.to, along + 4), first = false) {
      const off = trailOffset(id, along), x = t.axis === 'x' ? t.sign * along : off, z = t.axis === 'x' ? off : t.sign * along;
      if (first) ctx.moveTo(x, z); else ctx.lineTo(x, z);
      if (along >= t.to) break;
    }
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
}
/** The runs by how they are drawn: the world's edge (a dark casing), a home region against a land, and the ward with its seams (half width). */
const RUN_GROUPS = [['outer'], ['shared'], ['ward', 'seam']].map(kinds => BORDER_RUNS.filter(r => kinds.includes(r.kind)));
function runPath(ctx, runs, off) { ctx.beginPath(); for (let i = 0; i < runs.length; i++) { const r = runs[i]; ctx.moveTo(r.ax + r.nx * off, r.az + r.nz * off); ctx.lineTo(r.bx + r.nx * off, r.bz + r.nz * off); } }
/**
 * Every border run (regions.mjs BORDER_RUNS) as the rainbow ribbon of the world: a casing with three colour bands inside
 * it. `width` is a full ribbon's width in metres; ward and seam runs are half of it. Twelve strokes whatever the zoom.
 */
export function drawBorders(ctx, width, hair = 0) {
  ctx.lineJoin = 'miter'; ctx.lineCap = 'square';
  RUN_GROUPS.forEach((runs, group) => {
    const w = group === 2 ? width / 2 : width;
    // The world's edge wears a dark casing, a little wider than the ribbon, so the staircase outline of the thirteen squares stands out (`hair` is one CSS pixel in metres).
    ctx.strokeStyle = group === 0 ? COLORS.casingOuter : COLORS.casing; ctx.lineWidth = group === 0 ? w + 2.6 * hair : w; runPath(ctx, runs, 0); ctx.stroke();
    ctx.lineWidth = w * .29;
    for (let band = 0; band < 3; band++) { ctx.strokeStyle = COLORS.band[band]; runPath(ctx, runs, (band - 1) * w * .29); ctx.stroke(); }
  });
  ctx.lineCap = 'butt';
}
/** The ward while the Pandora box is open: the violet dashed line, a path along WARD_OUTLINE, over the village's rainbow border. */
export function drawWardLine(ctx, px = 1) {
  ctx.strokeStyle = COLORS.ward; ctx.lineWidth = Math.max(.8, 2.4 * px); ctx.setLineDash([5 * px, 3.5 * px]);
  ctx.beginPath(); WARD_OUTLINE.forEach(([x, z], i) => i ? ctx.lineTo(x, z) : ctx.moveTo(x, z)); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
}
/** The village in world metres (the context is transformed by the projection's matrix). */
export function drawVillage(ctx, P, view) {
  const R = ROADS, px = 1 / P.k; // one map pixel in metres
  ctx.fillStyle = COLORS.lawn; ctx.fillRect(VILLAGE.x0, VILLAGE.z0, VILLAGE.x1 - VILLAGE.x0, VILLAGE.z1 - VILLAGE.z0);
  // Gravel lanes (under the road): the homestead's own, and every family's drive.
  ctx.fillStyle = COLORS.lane;
  rect(ctx, 0, (-10 + R.south) / 2, 3.4, R.south + 10); rect(ctx, 10, -11.5, 18, 2.6); rect(ctx, 6, 12.2, 10, 2.4); rect(ctx, 0, (R.north - 17.5) / 2, 2.6, -R.north - 17.5);
  for (const p of LANES_GRAVEL) rect(ctx, p.x, p.z, p.w, p.d);                              // the West Lane and the Field Lane
  for (const lot of LOTS) for (const p of lot.paths) rect(ctx, p.x, p.z, p.w, p.d);          // drives, front paths, back paths (lots.mjs)
  // The county road: a ring, the spur out of the east gate, and the supermarket's parking off its north-east corner.
  ctx.fillStyle = COLORS.road;
  rect(ctx, 0, R.north, R.east * 2 + 5, 5); rect(ctx, 0, R.south, R.east * 2 + 5, 5);
  rect(ctx, R.west, (R.north + R.south) / 2, 5, R.south - R.north); rect(ctx, R.east, (R.north + R.south) / 2, 5, R.south - R.north);
  rect(ctx, R.east + 8, 0, 11, 5);
  ctx.fillStyle = COLORS.parking; ctx.fillRect(PARKING.x0, PARKING.z0, PARKING.x1 - PARKING.x0, R.north - 2.5 - PARKING.z0);
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
}
/**
 * The world's ground under a projection's matrix (metres): the cache in one blit (flat shapes until it is whole), the
 * features again as shapes when asked (the Map zoomed in, where the cache's pixels would show), the trails, the village
 * where it is in view, the borders `border` map pixels wide, and the ward's dashed line while the box is open.
 */
export function drawGround(ctx, P, view, border, sharp = false, hair = 1) {
  const px = 1 / P.k, cache = terrainCache();
  if (cache.ready) { ctx.drawImage(cache.canvas, -TERRAIN.half, -TERRAIN.half); cache.blits++; if (sharp) drawFeatures(ctx, view, px); }
  else { drawFlatRegions(ctx); drawFeatures(ctx, view, px); }
  drawTrails(ctx, px);
  if (P.sees(VILLAGE)) drawVillage(ctx, P, view);
  drawBorders(ctx, border * px, hair * px);
  if (view.pandora) drawWardLine(ctx, px);
}

// ---------------------------------------------------------------- drawing: markers, in map pixels
export const disc = (ctx, x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };
/** A little house (the homestead): a roof over a white wall. */
export function houseGlyph(ctx, x, y, s, roof = COLORS.home) {
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#3a2433'; ctx.lineWidth = s * .22; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x - s, y + s * .95); ctx.lineTo(x - s, y - s * .05); ctx.lineTo(x, y - s * 1.05); ctx.lineTo(x + s, y - s * .05); ctx.lineTo(x + s, y + s * .95); ctx.closePath(); ctx.stroke(); ctx.fill();
  ctx.fillStyle = roof; ctx.beginPath(); ctx.moveTo(x - s * 1.25, y); ctx.lineTo(x, y - s * 1.2); ctx.lineTo(x + s * 1.25, y); ctx.closePath(); ctx.fill();
}
/** A diamond: a shop (so it never reads as a house). */
export function diamond(ctx, x, y, s, color) {
  ctx.fillStyle = color; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = s * .42; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y); ctx.closePath(); ctx.stroke(); ctx.fill();
}
/** You: a white arrow outlined in blue, pointing where you face. */
export function arrow(ctx, x, y, s, turn) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(turn);
  ctx.fillStyle = COLORS.you; ctx.strokeStyle = COLORS.youEdge; ctx.lineWidth = s * .34; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(0, -s * 1.15); ctx.lineTo(s * .85, s * .8); ctx.lineTo(0, s * .38); ctx.lineTo(-s * .85, s * .8); ctx.closePath(); ctx.stroke(); ctx.fill();
  ctx.restore();
}
/** A parked vehicle: a small blue lozenge with two wheels' worth of white edge. */
export function carGlyph(ctx, x, y, s) {
  ctx.fillStyle = COLORS.vehicle; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = s * .36; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x - s, y - s * .6); ctx.lineTo(x + s, y - s * .6); ctx.lineTo(x + s, y + s * .6); ctx.lineTo(x - s, y + s * .6); ctx.closePath(); ctx.stroke(); ctx.fill();
}
/**
 * A den's crown on its disc: the reference's dark red disc and gold crown for a boss (white ring), the same on a violet
 * disc for a titan (a gold ring unless one is given), grey and faint while it is down.
 */
export function crown(ctx, x, y, s, down = false, titan = false, ring = titan ? COLORS.crown : '#ffffff') {
  ctx.save(); if (down) ctx.globalAlpha = .6;
  ctx.fillStyle = down ? COLORS.bossDown : titan ? COLORS.titan : COLORS.boss; disc(ctx, x, y, s);
  ctx.strokeStyle = down ? '#ffffff' : ring; ctx.lineWidth = s * .2; ctx.stroke();
  ctx.fillStyle = down ? '#ffffff' : COLORS.crown; ctx.font = `bold ${s * 1.62}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('♛', x, y + s * .09);
  ctx.restore();
}
/** A prison's badge, radius s: a grey padlock while the cage is locked, a gold key while it stands open. */
export function badge(ctx, x, y, s, state) {
  ctx.fillStyle = '#ffffff'; disc(ctx, x, y, s); ctx.strokeStyle = COLORS.ink; ctx.lineWidth = s * .2; ctx.stroke();
  if (state === 'locked') {
    ctx.strokeStyle = COLORS.lock; ctx.lineWidth = s * .22; ctx.beginPath(); ctx.arc(x, y - s * .12, s * .3, Math.PI, TAU); ctx.stroke();
    ctx.fillStyle = COLORS.lock; ctx.fillRect(x - s * .52, y - s * .12, s * 1.04, s * .7);
  } else {
    ctx.strokeStyle = COLORS.key; ctx.lineWidth = s * .24; ctx.beginPath(); ctx.arc(x - s * .3, y, s * .26, 0, TAU); ctx.stroke();
    ctx.fillStyle = COLORS.key; ctx.fillRect(x - s * .06, y - s * .12, s * .72, s * .24); ctx.fillRect(x + s * .4, y, s * .2, s * .36);
  }
}
/** A little dart at a rim marker, pointing outward: the way to what lies beyond the map. */
function dart(ctx, x, y, angle, u, color = '#3a2433') {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, -6.4 * u); ctx.lineTo(2.6 * u, -3.4 * u); ctx.lineTo(-2.6 * u, -3.4 * u); ctx.closePath(); ctx.fill(); ctx.restore();
}
const fontOf = size => `900 ${size}px Nunito, sans-serif`;
export const textWidth = (ctx, text, size) => { ctx.font = fontOf(size); return ctx.measureText?.(text)?.width ?? text.length * size * .6; };
/** Text with a white halo, centred on (x, y). */
export function haloText(ctx, text, x, y, size, color = COLORS.ink) {
  ctx.font = fontOf(size); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineWidth = size * .32; ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.fillStyle = color;
  ctx.strokeText(text, x, y); ctx.fillText(text, x, y);
}
export const overlaps = (b, boxes, own) => { for (let i = 0; i < boxes.length; i++) { const o = boxes[i]; if ((own === undefined || o.own !== own) && b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0) return true; } return false; };
export const boxAt = (x, y, r, own) => ({ x0: x - r, x1: x + r, y0: y - r, y1: y + r, own });
/** A den's ring on a map: gold for a titan, orange for the dragon, white for a boss. */
export const ringOf = d => d.titan ? COLORS.crown : d.event ? COLORS.dragon : '#ffffff';
/** Where a rim label tries to sit, as a turn from "straight inward" (radians): inward first, then slid along the rim to either side. */
const RIM_TURNS = [0, .5, -.5, .9, -.9];
/** Where a rim marker slides when its place is taken, in marker widths along the rim: its bearing first, then either side. */
export const RIM_SLIDE = [0, .5, -.5, 1, -1, 1.5, -1.5, 2, -2, 2.5, -2.5, 3, -3, 3.5, -3.5];
/**
 * Markers stay upright and the same size at every reach: drawn in map pixels, after the terrain. `u` is size / 100 and
 * `px` the canvas pixels in one CSS pixel, which gives text and crowns a floor in CSS pixels (a crown at least 5 px in
 * radius, a distance at least 9 px high, on the 96 px phone minimap too). With the box open: every den within reach on its
 * spot, the rest of rimDens() on the rim with a dart and their distance (the timer while one is down), a prison as a badge
 * on its boss's crown. P.marks = {on: [den ids], rim: [{id, x, y, angle, far, text, labelled}], cages: ['clover:locked', …]} says what was drawn.
 */
export function drawVillageMarkers(ctx, P, view, u = P.size / 100, { rimHome = true, dens = true, px = P.size / 150 } = {}) {
  for (const s of view.shops ?? []) { P.point(s.x, s.z, pt); diamond(ctx, pt.x, pt.y, 2.5 * u, COLORS.shop[s.id] ?? '#ff8a2a'); }
  ctx.fillStyle = COLORS.neighbour;
  for (const n of view.npcs ?? []) { if (n.hidden) continue; P.point(n.x, n.z, pt); disc(ctx, pt.x, pt.y, 1.15 * u); }
  const list = view.pandora && dens ? view.dens : null, marks = P.marks = { on: [], rim: [], cages: [] };
  if (view.pandora) for (const e of view.creatures ?? []) {
    if (!(e.hp > 0) || list && (e.den || e.boss)) continue; // every loaded boss and titan is drawn by its den's marker below
    const far = Math.hypot(e.x - view.x, e.z - view.z); if (far > P.radius || (!e.boss && far > CREATURE_RANGE)) continue;
    P.point(e.x, e.z, pt);
    if (e.boss) crown(ctx, pt.x, pt.y, 3.4 * u);
    else { ctx.fillStyle = e.angry ? COLORS.angry : COLORS.creature; disc(ctx, pt.x, pt.y, (e.angry ? 1.9 : 1.5) * u); }
  }
  const home = HOUSES[0], boxes = [boxAt(P.half, P.half, 4.6 * u, null)]; // you, in the middle
  if (rimHome) { rimPoint(P, home.x, home.z, 6.5 * u, rim); boxes.push(boxAt(rim.x, rim.y, 3.6 * u, null)); }
  if (list) {
    const base = Math.max(3.4 * u, 5 * px), font = Math.max(9 * px, 2.9 * u), reach = P.radius * ON_MAP, timers = [];
    // In reach: on its spot (the creature itself while it is loaded and alive), with its timer under it while it is down.
    for (const d of list) {
      if (Math.hypot(d.x - view.x, d.z - view.z) > reach) continue;
      P.point(d.x, d.z, pt); const s = base * (d.titan ? 1.3 : 1), cage = cageOf(view, d.id);
      crown(ctx, pt.x, pt.y, s, d.down, d.titan, ringOf(d));
      if (cage) { badge(ctx, pt.x + s * .78, pt.y - s * .78, Math.max(s * .55, 3.2 * px), cage.state); marks.cages.push(`${cage.id}:${cage.state}`); }
      boxes.push(boxAt(pt.x, pt.y, s, d)); if (d.down) timers.push({ d, x: pt.x, y: pt.y, s });
      marks.on.push(d.id);
    }
    // A downed den's timer goes under its crown, or above it, or beside it: wherever it covers no crown and no other timer. Before
    // the rim markers, which then keep clear of it.
    for (const t of timers) {
      const text = clock(t.d.left), w = textWidth(ctx, text, font), h = font * .78;
      for (const [ox, oy] of [[0, t.s + font * .62], [0, -t.s - font * .62], [t.s + w / 2 + 1.5 * px, 0], [-t.s - w / 2 - 1.5 * px, 0]]) {
        const x = t.x + ox, y = t.y + oy, b = { x0: x - w / 2 - px, x1: x + w / 2 + px, y0: y - h / 2 - px, y1: y + h / 2 + px, own: t.d };
        if (Math.hypot(x - P.half, y - P.half) + w / 2 > P.half - px || overlaps(b, boxes, t.d)) continue;
        boxes.push(b); haloText(ctx, text, x, y, font, COLORS.downInk); break;
      }
    }
    // Out of reach: on the rim, pointing the way, with how far it is. The marker boxes first, so no label covers a crown.
    // A marker that would sit on a crown already drawn (on its spot or on the rim) slides along the rim to the nearest free place, a
    // little off its bearing; one with no free place within RIM_SLIDE is left off, unless it must ride (a home boss, an open cage's
    // boss). Standing at a land's tip, the home bosses and the land's own dens all crowded the top of the disc.
    const riders = rimDens(list, view.x, view.z, P.radius, view.cages);
    for (const item of riders) {
      const d = item.den, plain = REGION[d.region].kind === 'home' && !d.titan, s = base * (plain ? 1 : .8);
      rimPoint(P, d.x, d.z, s * 1.85, rim);
      const r = Math.hypot(rim.x - P.half, rim.y - P.half), mark = { id: d.id, x: rim.x, y: rim.y, angle: rim.angle, bearing: rim.angle, far: item.far, s, den: d, text: d.down ? clock(d.left) : String(Math.round(item.far)), labelled: false, size: font, ring: plain ? '#ffffff' : REGION[d.region].accent, lx: 0, ly: 0 };
      let free = false;
      for (const turn of RIM_SLIDE) {
        const a = mark.bearing + turn * s * 2.1 / Math.max(r, 1), x = P.half + Math.sin(a) * r, y = P.half - Math.cos(a) * r;
        if (overlaps(boxAt(x, y, s * .92, mark), boxes, mark)) continue;
        mark.x = x; mark.y = y; mark.angle = a; free = true; break;
      }
      if (!free && !item.must) continue;
      marks.rim.push(mark); boxes.push(boxAt(mark.x, mark.y, s, mark));
    }
    // Labels nearest first; one that would cover a marker or an earlier label slides along the rim, and is left out if nothing is free.
    const order = [...marks.rim].sort((a, b) => a.far - b.far), limit = P.size / px < RIM_SMALL ? RIM_LABELS : order.length;
    for (let i = 0; i < Math.min(limit, order.length); i++) {
      const m = order[i], w = textWidth(ctx, m.text, font), h = font * .78;
      for (const turn of RIM_TURNS) {
        const a = m.angle + Math.PI + turn, out = m.s + 1.5 * px + Math.abs(Math.sin(a)) * w / 2 + Math.abs(Math.cos(a)) * h / 2, x = m.x + Math.sin(a) * out, y = m.y - Math.cos(a) * out;
        const b = { x0: x - w / 2 - px, x1: x + w / 2 + px, y0: y - h / 2 - px, y1: y + h / 2 + px, own: m };
        if (Math.hypot(x - P.half, y - P.half) + w / 2 > P.half - px || overlaps(b, boxes, m)) continue;
        boxes.push(b); m.labelled = true; m.lx = x; m.ly = y; break;
      }
    }
    for (const m of marks.rim) {
      const d = m.den, cage = cageOf(view, d.id);
      dart(ctx, m.x, m.y, m.angle, m.s / 3.4, d.down ? COLORS.bossDown : d.titan ? COLORS.titan : COLORS.boss);
      crown(ctx, m.x, m.y, m.s, d.down, d.titan, m.ring);
      if (cage) { badge(ctx, m.x + m.s * .78, m.y - m.s * .78, Math.max(m.s * .55, 3.2 * px), cage.state); marks.cages.push(`${cage.id}:${cage.state}`); }
      if (m.labelled) haloText(ctx, m.text, m.lx, m.ly, font, d.down ? COLORS.downInk : COLORS.ink);
      m.den = undefined;
    }
  }
  // Home: on its spot, or on the rim pointing the way back.
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
/**
 * One whole minimap frame into a square canvas context of `size` pixels: clipped to the circle, terrain, markers, you.
 * Outdoors it is north up and centred on you; indoors it is the house itself. `px` is the canvas pixels in one CSS pixel
 * (the bitmap is 300 across whatever the minimap's size on the screen). Returns the projection it used.
 */
export function drawMinimap(ctx, view, size, radius = mapRadius(view.place, view.x, view.z), px = size / 150) {
  const indoor = view.place === 'interior', u = size / 100;
  const P = projection({ x: indoor ? 0 : view.x, z: indoor ? 0 : view.z, heading: 0, radius, size });
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, size, size);
  ctx.save(); ctx.beginPath(); ctx.arc(P.half, P.half, P.half - .5, 0, TAU); ctx.clip();
  ctx.fillStyle = indoor ? COLORS.void : COLORS.beyond; ctx.fillRect(0, 0, size, size);
  ctx.save(); ctx.transform(...P.matrix);
  if (indoor) drawRoom(ctx, P, view); else drawGround(ctx, P, view, clamp(3.98 * P.k / px, 3, 9) * px, false, px);
  ctx.restore();
  if (indoor) drawRoomMarkers(ctx, P, view, u);
  else drawVillageMarkers(ctx, P, view, u, { px });
  P.point(view.x, view.z, pt); arrow(ctx, pt.x, pt.y, 4.3 * u, arrowTurn(view.facing ?? 0, 0));
  ctx.restore();
  return P;
}

/** Owns the minimap's canvas, its N badge and its caption: call frame(dt) every frame; it redraws 8 times a second. */
export class Minimap {
  constructor(canvas, { north = null, caption = null } = {}, view) {
    this.canvas = canvas; this.north = north; this.captionNode = caption; this.view = view;
    this.wait = 0; this.radius = 0; this.place = ''; this.caption = ''; this.heading = NaN; this.draws = 0; this.last = null; this.frames = 0; this.px = 2;
  }
  /** Forces the next frame to redraw. */
  invalidate() { this.wait = 0; }
  frame(dt = 0) {
    // The terrain cache is built from the second frame on, 96 rows a frame; the frame it is whole, the map is drawn again.
    const cache = terrainCache();
    if (!cache.ready && !cache.dead && this.frames++ > 0) { const view = this.view(); if (view && cache.step(view)) this.wait = 0; }
    this.wait -= dt; if (this.wait > 0) return false; this.wait = .125;
    const view = this.view(); if (!view) return false;
    const ctx = this.canvas.getContext?.('2d'); if (!ctx) return false;
    // The reach eases to its target, so walking out of the village opens the map up smoothly; a new place snaps.
    const want = mapRadius(view.place, view.x, view.z);
    this.radius = view.place !== this.place || !this.radius ? want : this.radius + (want - this.radius) * .35; if (Math.abs(this.radius - want) < .05) this.radius = want;
    this.place = view.place;
    // Sizes are in CSS pixels: the bitmap is 300 across, the minimap 150, 120, 96 or 80 on the screen.
    const shown = this.canvas.clientWidth; this.px = shown > 0 ? this.canvas.width / shown : this.canvas.width / 150;
    const t0 = typeof performance === 'object' ? performance.now() : 0;
    this.last = drawMinimap(ctx, view, this.canvas.width, this.radius, this.px); this.draws++;
    this.canvas.__mini = { ms: typeof performance === 'object' ? performance.now() - t0 : 0, px: this.px, radius: this.radius, rim: this.last.marks?.rim ?? [], on: this.last.marks?.on ?? [], cages: this.last.marks?.cages ?? [], terrain: cache.ready }; // what a browser suite reads
    // North is up on both maps (the reference's minimap never turns; only your arrow does), so the badge sits at the top.
    if (this.heading !== 0 && this.north) { const at = northSpot(0); this.north.style.left = `calc(${at.left.toFixed(2)}% - 10px)`; this.north.style.top = `calc(${at.top.toFixed(2)}% - 10px)`; }
    this.heading = 0;
    const caption = mapCaption(view);
    if (caption !== this.caption && this.captionNode) { this.caption = caption; this.captionNode.textContent = caption; }
    return true;
  }
}
