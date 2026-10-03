// The lands' terrain features, drawn and played (round 8; owner: builder B). installLands(world, deps) puts `world.lands`
// on the world: the one object through which every other module meets a land's features (spec 3.9). Nobody adds a member
// to it without changing that block of the spec.
//
//   step(dt, {x, z, riding, box})        once a frame, from World.update (builder C's call): the simulation (land-effects.mjs)
//                                        and the drawing. Until that call exists this file steps itself from the frame hook
//                                        (see `selfDrive` below), and stops the moment somebody else calls step().
//   walk({dx, dz, speed, riding}, dt)    -> {vx, vz, limit, nodeReach}: the walking velocity BEFORE the limit (ice eases it), a
//                                        speed factor (0.6 in the sea) and how close a tapped walk must come to a route node
//                                        (1 on ice, else 0.22). The caller moves by v × limit × dt through its own blocking.
//   carLimit(x, z)                       -> 0.6 in the sea, else 1
//   status(x, z)                         -> null | {icon, label, value}: the land line of the HUD (#land-status shows it)
//   mapFeatures(id)                      -> [{kind, x, z, r, color, …}] for the maps' terrain cache (land-features.mjs)
//   lampAt(x, z)                         -> true inside a lit lamp's disc (no creature enters: wilds host.noGo)
//   holes, creatureHoles                 reused arrays [{x, z, r}]: holes in the Night Land's dark (this file writes the first
//                                        each frame, builder D the second); at most 16 are drawn
//   eclipse(seconds)                     the Shadow Lord's skill: lamps go out and your own light shrinks to 0.4
//   setNest(stage)                       the dragon's stage changed (from 2 the nest's basin is lava, after 2 s of glow)
//
// Drawing (adapted from cute_game src/environment-art.ts and src/pond-view.ts): every flat feature of a region is ONE merged,
// unlit, vertex-coloured mesh (ponds, pools, the nest, rails, poison, the sea), built when you come within 112 m of its
// square and released beyond 150 m. On top of it, one instanced draw each: the toy trains, the turtles, the thorn walls, the
// lamps, the crystal flowers, and the falling fire, flames and ore. Telegraph discs go through world.pandora.mark.
// The Night Land's dark is a DOM layer (#night-layer) with radial mask holes; the land line is #land-status. Both are
// appended at boot and styled in lands.css.
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { squareOf } from './regions.mjs';
import { FEATURES, POND_LOOKS, mapFeatures, waterAt } from './land-features.mjs';
import { LandEffects, LAND, nightShare, trainPosition, turtlePosition, thornRaised, ventPhase, ventWarning } from './land-effects.mjs';
import { installRoomView } from './room-view.mjs';
import { toon } from './toon.mjs';
import { hpOf, maxHp, pandoraOpen } from './pandora.mjs';

const BUILD = 112, RELEASE = 150, TARGET_IN = 48, TARGET_OUT = 56, MAX_HOLES = 16;
const color = hex => new T.Color(hex), dummy = new T.Object3D(), tint = new T.Color();
const mixed = (a, b, t) => color(a).lerp(color(b), t);

/** A flat, merged, vertex-coloured mesh under construction: discs, rings and quads, in metres from (ox, oz). */
class Surface {
  constructor(ox, oz) { this.ox = ox; this.oz = oz; this.p = []; this.c = []; this.i = []; this.n = 0; }
  v(x, y, z, c) { this.p.push(x - this.ox, y, z - this.oz); this.c.push(c.r, c.g, c.b); return this.n++; }
  /** A ring from radius r0 (colour c0) to r1 (colour c1); r0 = 0 makes a disc. */
  ring(x, z, r0, r1, c0, c1, y, segments = 48) {
    const first = this.n;
    for (let s = 0; s <= segments; s++) { const a = s / segments * Math.PI * 2, cos = Math.cos(a), sin = Math.sin(a); this.v(x + cos * r0, y, z + sin * r0, c0); this.v(x + cos * r1, y, z + sin * r1, c1); }
    for (let s = 0; s < segments; s++) { const a = first + s * 2; this.i.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    return first;
  }
  /** A quad through four corners, counter-clockwise seen from above. */
  quad(a, b, c, d, y, ca, cb = ca, cc = ca, cd = ca) { const i = this.v(a[0], y, a[1], ca); this.v(b[0], y, b[1], cb); this.v(c[0], y, c[1], cc); this.v(d[0], y, d[1], cd); this.i.push(i, i + 1, i + 2, i, i + 2, i + 3); }
  mesh(material) {
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(this.p, 3)); g.setAttribute('color', new T.Float32BufferAttribute(this.c, 3)); g.setIndex(this.i); g.computeBoundingSphere();
    const m = new T.Mesh(g, material); m.position.set(this.ox, 0, this.oz); m.name = 'land-surface'; m.matrixAutoUpdate = false; m.updateMatrix(); return m;
  }
}
/** A pond: deep middle, the land's water colour, a foamy rim and a sand bank (pond-view.ts, flattened to rings of one mesh). */
function pond(S, p) {
  const look = POND_LOOKS[p.look], deep = color(look.deep), water = color(look.water), foam = mixed(look.water, '#ffffff', .6), sand = color(look.sand), wet = mixed(look.shallow, look.sand, .55), r = p.r;
  S.ring(p.x, p.z, 0, r * .55, deep, deep, .02); S.ring(p.x, p.z, r * .55, r - .9, deep, water, .02); S.ring(p.x, p.z, r - .9, r - .2, water, foam, .02);
  S.ring(p.x, p.z, r - .2, r + .3, wet, sand, .024); S.ring(p.x, p.z, r + .3, r + 1, sand, sand, .024);
}
/** One part of a kit-less model: a geometry moved, turned and vertex-coloured. */
function part(geometry, hex, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rz = 0) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry.clone(); if (g !== geometry) geometry.dispose?.();
  if (rz) g.rotateZ(rz); g.scale(sx, sy, sz); g.translate(x, y, z);
  const c = color(hex), n = g.getAttribute('position').count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new T.BufferAttribute(a, 3)); g.deleteAttribute('uv'); return g;
}
const merged = parts => { const g = mergeGeometries(parts); parts.forEach(p => p.dispose()); return g; };
const box = (hex, w, h, d, x, y, z) => part(new T.BoxGeometry(w, h, d), hex, x, y, z);
const ball = (hex, r, x, y, z, sx = 1, sy = 1, sz = 1) => part(new T.IcosahedronGeometry(r, 1), hex, x, y, z, sx, sy, sz);
const cyl = (hex, r, h, x, y, z, top = r, rz = 0, sides = 8) => part(new T.CylinderGeometry(top, r, h, sides), hex, x, y, z, 1, 1, 1, rz);
// The models of environment-art.ts, each merged into one geometry (one instanced draw a kind).
const carGeometry = () => merged([box('#ffffff', 1.6, 1.2, 2, 0, .8, 0), box('#fff6de', 1.65, .15, 2.1, 0, 1.5, 0), ...[-.85, .85].flatMap(x => [-.65, .65].map(z => cyl('#4a4958', .32, .18, x, .3, z, .32, Math.PI / 2)))]);
const turtleGeometry = () => merged([ball('#73ad72', 1, 0, .48, 0, 1, .48, 1.25), ball('#b6d692', .35, 0, .48, 1.2), ...[-1, 1].flatMap(x => [-.6, .6].map(z => ball('#a2c583', .32, x * .78, .14, z, 1.2, .24, .8)))]);
const thornGeometry = () => merged([-3, -2, -1, 0, 1, 2, 3].flatMap(i => [cyl('#648344', .32, 2.2, i, 1.1, 0, 0, (i % 2) * .35, 6), box('#80674c', .9, .22, .5, i, .11, 0)]));
const lampGeometry = () => merged([cyl('#687386', .23, 2.6, 0, 1.3, 0), box('#99866c', .85, .7, .85, 0, 2.75, 0), cyl('#766883', .65, .5, 0, 3.35, 0, 0), ball('#ffde8c', .56, 0, 2.75, 0)]);
const flowerGeometry = () => merged([0, 1, 2].map(i => part(new T.OctahedronGeometry(.28), '#80dcd1', (i - 1) * .154, .252 + i * .15, 0, .5, 1.5, .6)));

export function installLands(world, deps = {}) {
  if (world.lands) return world.lands;
  const state = () => deps.state?.() ?? world.state, toast = text => deps.toast?.(text);
  const sim = new LandEffects({
    hurt: (share, source) => world.pandora?.hurtFraction?.(share, source) ?? 0,
    heal: share => { const s = state(); if (!pandoraOpen(s)) return; const hp = hpOf(s), max = maxHp(s); if (hp > 0 && hp < max) s.hp = Math.min(max, hp + max * share); },
    push: (dx, dz, opts) => world.push(dx, dz, opts),
    toast,
    pickup: count => deps.act?.('pickup', { id: 'obsidian', count }),
  });
  const group = new T.Group(); group.name = 'lands'; world.outside.add(group);
  // Shared materials: the surfaces and the glowing bits are unlit (bright whatever the light), the toys and turtles are toon.
  const flat = new T.MeshBasicMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const glow = new T.MeshBasicMaterial({ vertexColors: true }), solid = toon({ color: '#ffffff', vertexColors: true }), spark = new T.MeshBasicMaterial({ color: '#ffffff' });
  // An instanced mesh whose instances are placed in world metres; `id` gives it its square as the culling sphere (the pieces move inside it).
  const instanced = (geometry, material, count, name, id) => { const m = new T.InstancedMesh(geometry, material, count); m.name = name; m.castShadow = false; m.receiveShadow = false; if (id) { const s = squareOf(id); m.boundingSphere = new T.Sphere(new T.Vector3(s.cx, 0, s.cz), 96); } else m.frustumCulled = false; return m; };
  const place = (mesh, i, x, y, z, ry = 0, sx = 1, sy = sx, sz = sx) => { dummy.position.set(x, y, z); dummy.rotation.set(0, ry, 0); dummy.scale.set(sx, sy, sz); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); };

  // ---- one view a region: {root, update(time), nest}
  const BUILDERS = {
    west: id => ponds(id), south: id => ponds(id), candy: id => ponds(id), ice: id => ponds(id),
    toy(id) {
      const v = ponds(id, S => { for (const t of FEATURES.toy.tracks) {
        const rail = color('#8c9bab'), sleeper = color('#b79979'), n = Math.ceil(t.r * 5);
        for (let j = 0; j < n; j++) { const a = j / n * Math.PI * 2, cos = Math.cos(a), sin = Math.sin(a), at = (r, w) => [t.x + cos * r - sin * w, t.z + sin * r + cos * w]; S.quad(at(t.r - .8, -.11), at(t.r + .8, -.11), at(t.r + .8, .11), at(t.r - .8, .11), .03, sleeper); }
        for (const side of [-.6, .6]) S.ring(t.x, t.z, t.r + side - .07, t.r + side + .07, rail, rail, .05, 96);
      } });
      const tracks = FEATURES.toy.tracks, cars = instanced(carGeometry(), solid, tracks.length * LAND.train.cars, 'toy-trains', id), at = {};
      const COLORS = ['#ee626d', '#f7ce5c', '#72b3e5', '#9dd197']; for (let i = 0; i < cars.count; i++) cars.setColorAt(i, tint.set(COLORS[i % 4]));
      v.root.add(cars);
      v.update = () => { tracks.forEach((track, k) => { for (let car = 0; car < LAND.train.cars; car++) { trainPosition(track, sim.time, car, at); place(cars, k * LAND.train.cars + car, at.x, .05, at.z, at.facing); } }); cars.instanceMatrix.needsUpdate = true; };
      return v;
    },
    jungle(id) {
      const f = FEATURES.jungle, v = ponds(id, S => { for (const p of f.poison) { S.ring(p.x, p.z, 0, p.r, color('#a77bd0'), color('#9869bf'), .016); for (let j = 0; j < 6; j++) S.ring(p.x + Math.sin(j) * p.r * .65, p.z + Math.cos(j) * p.r * .65, 0, .38, color('#c9b8ea'), color('#b19bde'), .03, 10); } });
      const walls = instanced(thornGeometry(), solid, f.thorns.length, 'thorn-walls', id), up = f.thorns.map(() => 0); v.root.add(walls);
      v.update = (time, dt) => { f.thorns.forEach((w, i) => { up[i] += ((thornRaised(sim.time, w.phase) ? 1 : .05) - up[i]) * Math.min(1, dt * 6); place(walls, i, w.x, 0, w.z, -w.angle, 1, up[i], 1); }); walls.instanceMatrix.needsUpdate = true; };
      return v;
    },
    ocean(id) {
      const sea = FEATURES.ocean.sea, f = FEATURES.ocean, foam = color('#eafcff'), mid = color('#56bce6'), deep = color('#3fa6d6'), xs = [sea.x0, sea.x, sea.x + 1.5, sea.x1], zs = [sea.z0, sea.z - 1.5, sea.z, sea.z1];
      const tone = (x, z) => { const d = Math.max(x - sea.x, sea.z - z); return d <= 0 ? foam : d <= 1.5 ? foam.clone().lerp(mid, d / 1.5) : mid.clone().lerp(deep, (d - 1.5) / 22.5); };
      const v = ponds(id, S => { for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) if (waterAt((xs[i] + xs[i + 1]) / 2, (zs[k] + zs[k + 1]) / 2)) S.quad([xs[i], zs[k + 1]], [xs[i + 1], zs[k + 1]], [xs[i + 1], zs[k]], [xs[i], zs[k]], .02, tone(xs[i], zs[k + 1]), tone(xs[i + 1], zs[k + 1]), tone(xs[i + 1], zs[k]), tone(xs[i], zs[k])); });
      const turtles = instanced(turtleGeometry(), solid, f.turtles.length, 'sea-turtles', id), at = {}; v.root.add(turtles);
      v.update = () => { f.turtles.forEach((t, i) => { turtlePosition(t, sim.time, at); place(turtles, i, at.x, -.3 + Math.sin(sim.time * 2 + t.id) * .05, at.z, at.facing); }); turtles.instanceMatrix.needsUpdate = true; };
      return v;
    },
    lava(id) {
      const f = FEATURES.lava, basin = color('#3c3549'), hot = color('#ff7540'); let first = 0, count = 0, shown = -1, attribute = null;
      const v = ponds(id, S => {
        for (const p of f.pools) { S.ring(p.x, p.z, 0, p.r * .6, color('#ff8a3c'), color('#ff632e'), .02); S.ring(p.x, p.z, p.r * .6, p.r, color('#ff632e'), color('#e8481f'), .02); S.ring(p.x, p.z, p.r, p.r + 1.3, color('#2c2430'), color('#4a3a44'), .024); }
        first = S.n; S.ring(f.nest.x, f.nest.z, 0, f.nest.r, basin, basin, .016); count = S.n - first;
        S.ring(f.nest.x, f.nest.z, f.nest.r, f.nest.r + 1.2, color('#2c2636'), color('#4a3a44'), .02);
        for (const p of f.nestIslands) S.ring(p.x, p.z, 0, p.r, color('#a08a8c'), color('#90767a'), .034, 20);
        for (const p of f.vents) { S.ring(p.x, p.z, .8, 1.5, color('#554755'), color('#6a5a66'), .03, 20); S.ring(p.x, p.z, 0, .8, color('#ff813e'), color('#2c2530'), .03, 20); }
      });
      attribute = v.surface.geometry.getAttribute('color');
      // The nest's basin warms to lava from the dragon's second stage (the colours of its own vertices, no second mesh).
      v.update = () => { const k = sim.nestGlow; if (k === shown) return; shown = k; tint.copy(basin).lerp(hot, k); for (let i = first; i < first + count; i++) attribute.setXYZ(i, tint.r, tint.g, tint.b); attribute.needsUpdate = true; };
      return v;
    },
    shadow(id) {
      const f = FEATURES.shadow, v = ponds(id), lamps = instanced(lampGeometry(), glow, f.lamps.length, 'light-pillars', id), flowers = instanced(flowerGeometry(), glow, f.flowers.length, 'crystal-flowers', id), lit = f.lamps.map(() => -1);
      f.lamps.forEach((p, i) => place(lamps, i, p.x, 0, p.z)); f.flowers.forEach((p, i) => place(flowers, i, p.x, 0, p.z, i * 1.3)); v.root.add(lamps, flowers);
      v.update = () => { let changed = false; f.lamps.forEach((p, i) => { const on = sim.lampLit(i) ? 1 : 0; if (on === lit[i]) return; lit[i] = on; lamps.setColorAt(i, tint.set(on ? '#ffffff' : '#565a78')); changed = true; }); if (changed) lamps.instanceColor.needsUpdate = true; };
      return v;
    },
  };
  /** The surface mesh of a region: its ponds, and whatever `more` adds. */
  function ponds(id, more) {
    const s = squareOf(id), S = new Surface(s.cx, s.cz), root = new T.Group(); root.name = 'land-' + id;
    for (const p of FEATURES[id].ponds) pond(S, p);
    more?.(S);
    const surface = S.mesh(flat); root.add(surface);
    return { root, surface, update: null };
  }
  const views = new Map(), IDS = Object.keys(BUILDERS);
  const away = (s, x, z) => Math.hypot(Math.max(0, s.x0 - x, x - s.x1), Math.max(0, s.z0 - z, z - s.z1));
  function release(id) { const v = views.get(id); if (!v) return; v.root.removeFromParent(); v.root.traverse(m => { if (m.isMesh) { m.geometry.dispose(); if (m.isInstancedMesh) m.dispose(); } }); views.delete(id); }
  function tend(x, z) { for (const id of IDS) { const d = away(squareOf(id), x, z); if (d < BUILD && !views.has(id)) { const v = BUILDERS[id](id); views.set(id, v); group.add(v.root); } else if (d > RELEASE) release(id); } }

  // ---- the falling fire, the flames and the ore: one instanced draw (lava and the cloud's lightning)
  const sparks = instanced(new T.OctahedronGeometry(1), spark, 96, 'land-sparks'); sparks.count = 0; sparks.visible = false; group.add(sparks);
  const SPARK = { meteor: '#cc674a', fireball: '#ff873f', rain: '#ff873f', bolt: '#ffffb5' }, MARK = { meteor: '#ffbc53', fireball: '#ffbc53', rain: '#ffbc53', bolt: '#fff28c' };
  function drawSparks(at) {
    let n = 0; const add = (hex, x, y, z, sx, sy = sx, sz = sx) => { if (n >= 96) return; place(sparks, n, x, y, z, sim.time * 2 + n, sx, sy, sz); sparks.setColorAt(n++, tint.set(hex)); };
    for (const d of sim.drops) {
      const k = Math.min(1, d.age / d.duration), left = 1 - k * k, meteor = d.kind === 'meteor';
      if (d.kind === 'bolt') add(SPARK.bolt, d.x, 1.4 + left * 7, d.z, .16, 1.4, .16); else add(SPARK[d.kind], d.x - (meteor ? 14 * left : 0), .3 + left * (meteor ? 34 : 7), d.z - (meteor ? 10 * left : 0), meteor ? .75 : .32);
      world.pandora?.mark?.(d.x, d.z, d.r, k, MARK[d.kind]);
    }
    if (sim.region === 'lava') {
      for (const ore of sim.ores) add('#ffb769', ore.x, .45, ore.z, .24, .62, .26);
      if (at.box) for (const vent of FEATURES.lava.vents) {
        const period = sim.ventPeriod, phase = ventPhase(sim.now, vent.phase, period);
        if (phase !== 'idle') world.pandora?.mark?.(vent.x, vent.z, vent.r, ventWarning(sim.now, vent.phase, period), '#fa6851');
        if (phase === 'eruption') { const flick = Math.sin(sim.time * 18) * .5; add('#ff813e', vent.x, 3.4 + flick, vent.z, 2, 4.2 + flick, 2); add('#ffe66b', vent.x, 2.2, vent.z, 1.05, 2.8, 1.05); }
      }
    }
    sparks.count = n; sparks.visible = n > 0;
    if (n) { sparks.instanceMatrix.needsUpdate = true; sparks.instanceColor.needsUpdate = true; }
  }

  // ---- a lamp's tap (the 48 m rule: its target exists only while you are within 48 m and goes beyond 56 m)
  const spots = FEATURES.shadow.lamps.map(() => null);
  function useLamp(i) {
    if (sim.eclipsed) toast('The eclipse smothers the flame.');
    else if (sim.lampLit(i)) toast(`This pillar burns for ${Math.ceil(sim.lampLeft(i))} more seconds.`);
    else { sim.light(i); toast('The pillar is lit: 150 seconds of safe light.'); }
  }
  function tendLamps(x, z) {
    FEATURES.shadow.lamps.forEach((p, i) => {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < TARGET_IN && !spots[i]) { const spot = world.target('lamp', i, 'Light pillar · light for 150 seconds', p.x, p.z, 2.2); spot.use = () => useLamp(i); spots[i] = spot; }
      else if (d > TARGET_OUT && spots[i]) { world.removeTarget(spots[i]); spots[i] = null; }
    });
  }

  // ---- the DOM: the dark and the land line
  const app = document.getElementById('app') ?? document.body;
  const night = document.createElement('div'); night.id = 'night-layer'; night.hidden = true; night.setAttribute('aria-hidden', 'true');
  // Straight after the canvas and with no z-index of its own: over the picture, under every HUD element that follows it.
  if (world.canvas?.parentNode) world.canvas.after(night); else app.prepend(night);
  const line = document.createElement('div'); line.id = 'land-status'; line.hidden = true; line.setAttribute('role', 'status'); line.innerHTML = '<i></i><span></span><b></b>';
  const chip = document.getElementById('pandora-chip'); if (chip) chip.after(line); else (document.querySelector('.tracker-stack') ?? app).append(line);
  const lineIcon = line.querySelector('i'), lineLabel = line.querySelector('span'), lineValue = line.querySelector('b');
  let lineKey = '', maskKey = '', frame = 0, nightOn = 0;
  function showStatus(x, z, outdoors) {
    const st = outdoors ? sim.status(x, z) : null, key = st ? st.icon + st.label + st.value : '';
    if (key === lineKey) return; lineKey = key; line.hidden = !st;
    if (st) { lineIcon.textContent = st.icon; lineLabel.textContent = st.label; lineValue.textContent = st.value; }
  }
  /** The dark: opacity 0.93 × how far into the Night Land you are, with a hole for you, the lit lamps, the near flowers and what builder D adds. */
  function showNight(x, z, outdoors) {
    const share = outdoors ? nightShare(x, z) : 0;
    if (share <= 0) { if (nightOn) { nightOn = 0; night.hidden = true; lands.holes.length = 0; } return; }
    nightOn = share; night.hidden = false; night.style.opacity = (LAND.night.opacity * share).toFixed(3);
    sim.holes(x, z, !!world.pandora?.traits?.().light, lands.holes);
    if (state().settings?.quality === 'battery' && frame % 2) return; // every second frame on "battery"
    const c = world.camera, perMetre = innerWidth / ((c.right - c.left) / (c.zoom || 1)); let mask = '', n = 0;
    for (const list of [lands.holes, lands.creatureHoles]) for (let i = 0; i < list.length && n < MAX_HOLES; i++, n++) {
      const h = list[i], p = world.project(h.x, h.z, .7), r = Math.max(14, h.r * perMetre);
      mask += `${n ? ',' : ''}radial-gradient(ellipse ${r.toFixed(0)}px ${(r * .8).toFixed(0)}px at ${p.x.toFixed(0)}px ${p.y.toFixed(0)}px, transparent 62%, black 100%)`;
    }
    if (mask !== maskKey) { maskKey = mask; night.style.maskImage = mask; night.style.webkitMaskImage = mask; }
  }

  // ---- the frame
  const walked = { vx: 0, vz: 0, limit: 1, nodeReach: .22 }, at = { x: 0, z: 0, riding: false, box: false };
  let steps = 0, walks = 0, tended = 0;
  const lands = world.lands = {
    step(dt, here) {
      steps++; sim.step(dt, here, Date.now() / 1000);
      if ((tended -= dt) <= 0) { tended = .25; tend(here.x, here.z); tendLamps(here.x, here.z); }
      for (const v of views.values()) v.update?.(sim.time, dt);
      drawSparks(here);
    },
    walk(input, dt) { walks++; const p = world.player.position; return sim.walk(input, dt, p.x, p.z, walked); },
    carLimit: (x, z) => sim.carLimit(x, z),
    status: (x, z) => sim.status(x, z),
    mapFeatures,
    lampAt: (x, z) => sim.lampAt(x, z),
    holes: [],
    creatureHoles: [],
    eclipse(seconds) { sim.eclipse(seconds); },
    setNest(stage) { sim.setNest(stage); },
  };
  /** For the suites and the probes (window.willowmere.lands()): what is built, and whether World.update drives this file or it drives itself. */
  const diagnostics = () => ({ views: [...views.keys()], draws: [...views.values()].reduce((n, v) => n + v.root.children.length, 0) + (sparks.visible ? 1 : 0), drops: sim.drops.length, ores: sim.ores.length, lamps: FEATURES.shadow.lamps.map((p, i) => sim.lampLit(i)), targets: spots.filter(Boolean).length, night: nightOn, opacity: night.hidden ? 0 : +night.style.opacity, holes: lands.holes.length, status: lineKey, driven: { step: drive.step, walk: drive.walk }, time: sim.time, weather: sim.weather.id, nest: sim.nestStage, velocity: Math.hypot(sim.velocity.x, sim.velocity.z) });
  world.__lands = { sim, diagnostics };
  // selfDrive: World.update does not call step() or walk() until builder C's merge. Until somebody does, the frame hook calls
  // step() itself, and gives ice and the sea their feel by nudging the player with world.push after the walk World.update has
  // already made (so the net movement is walk()'s velocity × limit). Each half switches off for good the first frame it sees a
  // call from outside. Nothing else in this file knows about it.
  const drive = { step: 'self', walk: 'self' }, last = { x: NaN, z: NaN, t: 0, steps: 0, walks: 0 }, input = { dx: 0, dz: 0, speed: 0, riding: false };
  installRoomView(world).onFrame(() => {
    frame++;
    const now = performance.now() / 1000, dt = Math.min(.1, Math.max(0, now - last.t)); last.t = now;
    const p = world.player?.position, outdoors = !!p && world.ready && world.location === 'village';
    if (outdoors && !world.paused) {
      if (steps !== last.steps) drive.step = 'world';
      if (walks !== last.walks) drive.walk = 'world';
      at.x = p.x; at.z = p.z; at.riding = !!world.riding; at.box = !!world.pandora?.active;
      if (drive.walk === 'self' && !at.riding && dt > 0 && Number.isFinite(last.x)) {
        const vx = (p.x - last.x) / dt, vz = (p.z - last.z) / dt, speed = Math.hypot(vx, vz);
        if (speed < 20) { // a jump (a door, Home) is not a walk
          input.dx = speed > .05 ? vx / speed : 0; input.dz = speed > .05 ? vz / speed : 0; input.speed = speed > .05 ? speed : 0;
          const w = sim.walk(input, dt, p.x, p.z, walked), nx = (w.vx * w.limit - vx) * dt, nz = (w.vz * w.limit - vz) * dt;
          if (Math.hypot(nx, nz) > 1e-4) world.push(nx, nz);
        } else { sim.velocity.x = 0; sim.velocity.z = 0; }
      }
      if (drive.step === 'self') lands.step(dt, at);
      last.x = p.x; last.z = p.z;
    } else last.x = NaN;
    last.steps = steps; last.walks = walks;
    if (window.willowmere && !window.willowmere.lands) window.willowmere.lands = diagnostics;
    if (p) { showStatus(p.x, p.z, outdoors); showNight(p.x, p.z, outdoors); }
  });
  return lands;
}
