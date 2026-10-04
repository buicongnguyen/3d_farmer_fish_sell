// The titans, drawn (round 8; owner: builder D2), after Zoo Garden's src/titan-art.ts and src/titan-view.ts.
// installTitans(world, pandora, deps) is called once from main.mjs boot(), after installPandora and installLands; main.mjs fetches this
// file with import() right after boot (it is not read before the first frame, spec 17.3).
// deps = {state(), act(type, arg), toast(message), persist(), hud()}.
//
// What it does, all of it only while the box is open and you are outdoors:
//   models      Each titan has a file of its own (t-<name>.glb, 11 to 78 KB, trimmed from Zoo Garden's titans.glb). It is asked for
//               when the titan's den comes within 96 m; until it lands the titan is drawn from titanFallback, the reference's own
//               stand-in (titan-art.ts:8-23), baked into one mesh. Either way a titan is one draw, on the creatures' own material,
//               handed to wilds-view.mjs through view.addTemplate.
//   wind-ups    The marks of a wind-up are danger discs, asked for every frame through world.pandora.mark (Pandora draws them in
//               its own frame). A plain strike shows one disc as wide as its reach.
//   attacks     What the reference draws with one mesh a mark (about 30 draws in a bombardment), here with three meshes whatever
//               the count: 64 instanced rings (unfired marks, the pull's and the death ring's circles), 32 instanced spheres (the
//               homing orbs, a falling shell over every bombard mark, a flat blob in every pool) and one beam (the sweep).
//   feedback    The skill's callout over the titan and on the boss bar, the bursts where a blow lands, the enrage toast, the
//               violet bar (titans.css), and the lift of a leap.
// Nothing here calls world.pandora.fx.decal: Pandora's frame resets that pool.
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { installRoomView } from './room-view.mjs';
import { DENS } from './regions.mjs';
import { windupProgress, loadTitanTurn } from './wilds.mjs';
import { TITAN_ROWS } from './titans.mjs';
import { TITAN, TITAN_COLORS, TITAN_CALLOUTS, isTitanSkill, titanAttacks, titanMarks, titanState } from './titan-patterns.mjs';

/** A titan's file is asked for when its den is this near (spec 17.3). */
export const TITAN_KIT_RANGE = 96;
/** Callouts and bursts show within this many metres of you (the reference's CALLOUT_RANGE). */
const CALLOUT_RANGE = 30, DRAW_RANGE = 90;
const RINGS = 64, SPHERES = 32, SAFE_GREEN = '#5aff9a', SHELL = '#ffd39b', STRIKE = '#ff3b3b';
const TITAN_DENS = DENS.filter(d => d.titan && TITAN_ROWS[d.type]);
const len = (x, z) => Math.sqrt(x * x + z * z);

// ---------------------------------------------------------------- models
/** Pieces (geometry, colour) merged into one vertex-coloured, flat-shaded geometry: one draw on the creatures' shared material. */
function merged(pieces) {
  const list = pieces.map(({ geometry, color, matrix, normals }) => {
    // A file's own normals are kept (its smooth and flat faces are the modeller's); a stand-in's shapes are flat-shaded, as the reference's.
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone(), keep = normals && g.getAttribute('normal'); for (const key of Object.keys(g.attributes)) if (key !== 'position' && !(keep && key === 'normal')) g.deleteAttribute(key);
    if (matrix) g.applyMatrix4(matrix); if (!keep) g.computeVertexNormals();
    const n = g.getAttribute('position').count, colors = new Float32Array(n * 3); for (let i = 0; i < n; i++) colors.set([color.r, color.g, color.b], i * 3);
    g.setAttribute('color', new T.BufferAttribute(colors, 3)); return g;
  });
  const out = mergeGeometries(list, false); list.forEach(g => g.dispose()); pieces.forEach(p => p.own && p.geometry.dispose()); return out;
}
/** A template in the shape wilds-view.mjs attaches: a group named after the kind with one mesh, 'creature-body'. */
function template(type, geometry, material) {
  const group = new T.Group(), mesh = new T.Mesh(geometry, material); group.name = 'creature-' + type; mesh.name = 'creature-body'; mesh.castShadow = mesh.receiveShadow = false; group.add(mesh); return group;
}
/**
 * The reference's stand-in silhouettes (titan-art.ts titanFallback), shape for shape, as pieces to merge: they keep all nine
 * fights readable while a titan's own file is on its way.
 */
export function titanFallback(id) {
  const d = TITAN_ROWS[id], pieces = [], m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler();
  const add = (geometry, color, x, y, z, sx = 1, sy = 1, sz = 1, rz = 0) => { pieces.push({ geometry, own: true, color: new T.Color(color), matrix: new T.Matrix4().compose(new T.Vector3(x, y, z), q.clone().setFromEuler(e.set(0, 0, rz)), new T.Vector3(sx, sy, sz)) }); };
  const ball = (x, y, z, r, color = d.color, sx = 1, sy = 1, sz = 1) => add(new T.IcosahedronGeometry(r, 1), color, x, y, z, sx, sy, sz);
  const limb = (x, z, a, r = .2) => add(new T.CylinderGeometry(r, r, 1.2, 6), d.color, x, .55, z, 1, 1, 1, a);
  const eye = (x, y, z) => { ball(x, y, z, .16, '#fff7dd'); ball(x, y, z + .11, .075, '#292132'); };
  if (id === 'titan_turtle') { ball(0, .7, 0, .95, d.color, 1, .6, 1.25); ball(0, 1.05, 0, .95, d.accent, 1, .65, 1.1); ball(0, .9, 1.15, .38); for (const x of [-.75, .75]) for (const z of [-.7, .7]) limb(x, z, x * .3); for (let i = 0; i < 5; i++) add(new T.ConeGeometry(.3, .8, 5), d.glow, Math.sin(i * 1.25) * .5, 1.7, Math.cos(i * 1.25) * .5); eye(-.15, 1.02, 1.48); eye(.15, 1.02, 1.48); }
  else if (id === 'titan_hydra') { ball(0, .6, 0, 1, d.color, 1, .55, 1.1); for (const x of [-.65, 0, .65]) { add(new T.CylinderGeometry(.17, .25, 1.4, 8), d.color, x, 1.35, 0); ball(x, 2.05, .12, .35, x === 0 ? d.color : x < 0 ? d.accent : d.glow); eye(x - .11, 2.1, .4); eye(x + .11, 2.1, .4); } }
  else if (id === 'titan_crystal') { add(new T.OctahedronGeometry(1), d.color, 0, 1.2, 0, .7, 1.4, .7); for (let i = 0; i < 7; i++) { const a = i * Math.PI * 2 / 7; add(new T.OctahedronGeometry(.35), d.accent, Math.sin(a) * .7, 2, Math.cos(a) * .7, .5, 1.4, .5); } eye(-.18, 1.5, .56); eye(.18, 1.5, .56); }
  else if (id === 'titan_scorpion' || id === 'titan_clock') {
    ball(0, .75, 0, .8, d.color, 1, .6, 1.2); for (let i = 0; i < 4; i++) for (const side of [-1, 1]) limb(side * (.9 + i * .06), -.6 + i * .4, side * .8, .12);
    if (id === 'titan_scorpion') { for (let i = 0; i < 5; i++) ball(0, 1 + i * .25, -.65 - Math.sin(i * .55) * .65, .21, d.glow); for (const side of [-1, 1]) ball(side * 1.1, .8, 1, .4, d.accent, .6, .7, 1); }
    else { add(new T.CylinderGeometry(.75, .75, .2, 12), d.accent, 0, 1.22, 0); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5; ball(Math.sin(a) * .65, 1.45, Math.cos(a) * .65, .1, d.glow); } }
    eye(-.18, .85, .86); eye(.18, .85, .86);
  }
  else if (id === 'titan_flower') { add(new T.CylinderGeometry(.3, .55, 1.2, 8), d.glow, 0, .6, 0); for (let i = 0; i < 7; i++) { const a = i * Math.PI * 2 / 7; ball(Math.sin(a) * .8, 1.1, Math.cos(a) * .8, .55, d.color, 1, .25, 1); } ball(0, 1.35, 0, .65, d.accent, 1, .35, 1); ball(0, 1.55, 0, .4, '#552036', 1, .2, 1); }
  else if (id === 'titan_kraken') { ball(0, 1.3, 0, .75, d.color, .8, 1.2, .8); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; for (let j = 1; j <= 3; j++) ball(Math.sin(a) * j * .35, .35 + Math.sin(j) * .1, Math.cos(a) * j * .35, .2, d.accent); } eye(-.22, 1.3, .62); eye(.22, 1.3, .62); }
  else if (id === 'titan_whale') { ball(0, .85, 0, 1, d.color, .85, .55, 1.45); for (const side of [-1, 1]) ball(side * .95, .7, .1, .4, d.accent, 1.2, .16, 1); for (const side of [-1, 1]) ball(side * .38, .9, -1.4, .45, d.accent, 1.3, .16, .7); eye(-.43, .9, 1.04); eye(.43, .9, 1.04); }
  else { ball(0, 1.2, 0, .85, d.color); ball(0, 1.2, .55, .6, '#fff0f5'); ball(0, 1.2, 1, .36, d.glow); ball(0, 1.2, 1.23, .14, '#241432'); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; add(new T.ConeGeometry(.14, .7, 5), d.accent, Math.sin(a) * .95, 1.2 + Math.cos(a) * .95, 0); } }
  return merged(pieces);
}
/** A titan's own model out of its file: every mesh under the root named after the kind, with the materials' colours in the vertices. */
function bakeFile(scene, type) {
  scene.updateMatrixWorld(true);
  const root = scene.getObjectByName(type) ?? scene.children[0]; if (!root) return null;
  const inverse = root.matrixWorld.clone().invert(), pieces = [];
  root.traverse(m => { if (m.isMesh) pieces.push({ geometry: m.geometry, normals: true, color: m.material.color ?? new T.Color('#ffffff'), matrix: new T.Matrix4().multiplyMatrices(inverse, m.matrixWorld) }); });
  if (!pieces.length) return null;
  const geometry = merged(pieces); scene.traverse(m => { if (m.isMesh) { m.geometry.dispose(); m.material.dispose?.(); } }); return geometry;
}

export function installTitans(world, pandora, deps = {}) {
  if (world.__titans) return world.__titans;
  if (!pandora || typeof document === 'undefined') return world.__titans = {};
  const room = installRoomView(world), view = pandora.view, wilds = pandora.wilds, fx = pandora.fx, toast = deps.toast ?? (() => {});
  const kits = new Map(), requested = [], loader = new GLTFLoader(); // type -> 'loading' | 'ready' | 'failed'
  const titans = []; let listSize = -1, listHead = null;
  const stats = { rings: 0, spheres: 0, beam: false, marks: 0, callouts: 0, lastCallout: '', bursts: 0, lifted: 0 };

  // ---------------------------------------------------------------- models on demand
  /** A new template for a kind: creatures drawn from the old one are given back and made again from this one on the next frame. */
  function swap(type, geometry) {
    const old = view.templates.get(type);
    for (let i = 0; i < wilds.list.length; i++) { const e = wilds.list[i]; if (e.type === type && e.view) view.detach(e); }
    view.free.delete(type); view.icons.delete(type); view.addTemplate(type, template(type, geometry, view.material));
    old?.traverse(m => { if (m.isMesh) m.geometry.dispose(); });
  }
  function ensure(type) {
    if (kits.has(type)) return;
    const file = TITAN_ROWS[type].file, url = `./assets/models/${file}.glb`;
    kits.set(type, 'loading'); requested.push(file + '.glb');
    if (!view.templates.has(type)) view.addTemplate(type, template(type, titanFallback(type), view.material));
    loader.loadAsync(url).then(gltf => { const geometry = bakeFile(gltf.scene, type); if (!geometry) throw new Error('empty'); swap(type, geometry); kits.set(type, 'ready'); })
      .catch(error => { console.error(`${file}.glb could not load; the stand-in stays.`, error); kits.set(type, 'failed'); });
  }

  // ---------------------------------------------------------------- the three meshes
  const root = new T.Group(); root.name = 'titan-attacks';
  const basic = () => new T.MeshBasicMaterial({ transparent: true, opacity: .75, depthWrite: false, side: T.DoubleSide, toneMapped: false });
  const instanced = (geometry, count, name) => { const m = new T.InstancedMesh(geometry, basic(), count); m.name = name; m.setColorAt(0, new T.Color('#ffffff')); m.count = 0; m.visible = false; m.frustumCulled = false; m.castShadow = m.receiveShadow = false; m.raycast = () => {}; m.renderOrder = 4; root.add(m); return m; };
  const rings = instanced(new T.RingGeometry(.86, 1, 48).rotateX(-Math.PI / 2), RINGS, 'titan-rings');
  const spheres = instanced(new T.IcosahedronGeometry(.45, 1), SPHERES, 'titan-spheres');
  const beam = new T.Mesh(new T.BoxGeometry(.8, .35, 1), basic()); beam.name = 'titan-beam'; beam.visible = false; beam.frustumCulled = false; beam.raycast = () => {}; beam.renderOrder = 4; root.add(beam);
  const m4 = new T.Matrix4(), v3 = new T.Vector3(), s3 = new T.Vector3(), q0 = new T.Quaternion(), tints = new Map();
  const tint = hex => { let c = tints.get(hex); if (!c) tints.set(hex, c = new T.Color(hex)); return c; };
  let ringCount = 0, sphereCount = 0, beamOn = false;
  function ring(x, z, r, hex) { if (ringCount >= RINGS || !(r > 0)) return; rings.setMatrixAt(ringCount, m4.compose(v3.set(x, .09, z), q0, s3.set(r, 1, r))); rings.setColorAt(ringCount, tint(hex)); ringCount++; }
  function sphere(x, y, z, sx, sy, sz, hex) { if (sphereCount >= SPHERES) return; spheres.setMatrixAt(sphereCount, m4.compose(v3.set(x, y, z), q0, s3.set(sx, sy, sz))); spheres.setColorAt(sphereCount, tint(hex)); sphereCount++; }
  /** One running attack (titan-view.ts draw): `at` is where the titan is drawn. */
  function drawAttack(a, at) {
    const color = TITAN_COLORS[a.skill];
    if (a.skill === 'sweep') {
      if (beamOn) return; beamOn = true;
      const angle = (a.marks[0]?.a ?? a.facing) + a.age / 2.2 * 3.5, length = a.radius + 17;
      beam.position.set(at.x + Math.sin(angle) * length / 2, 1.2, at.z + Math.cos(angle) * length / 2); beam.rotation.y = angle; beam.scale.z = length; beam.material.color.set(color);
    }
    else if (a.skill === 'orbs') { const k = 1.1 + Math.sin(a.age * 12) * .15; for (let i = 0; i < a.orbs.length; i++) { const orb = a.orbs[i]; if (!orb.done) sphere(orb.x, 1.1, orb.z, k, k, k, color); } }
    else if (a.skill === 'pull') { ring(at.x, at.z, 4 + a.age * 8, color); ring(at.x, at.z, a.radius + 4.5, '#ffffff'); }
    else if (a.skill === 'donut') { ring(at.x, at.z, a.radius + 11, color); ring(at.x, at.z, a.radius + 1.5, SAFE_GREEN); }
    else if (a.skill === 'pools') for (let i = 0; i < a.marks.length; i++) { const p = a.marks[i]; ring(p.x, p.z, p.r, color); sphere(p.x, .04, p.z, p.r * 2, .13, p.r * 2, color); }
    else for (let i = 0; i < a.marks.length; i++) {
      const p = a.marks[i]; if (a.fired.includes(i)) continue;
      ring(p.x, p.z, p.r, color);
      if (a.skill === 'bombard') { const left = .45 + (p.k ?? 0) * .38 - a.age; sphere(p.x, Math.max(.3, left * 12), p.z, 1, 1, 1, SHELL); }
    }
  }
  function show() {
    rings.count = ringCount; rings.visible = ringCount > 0; if (ringCount) { rings.instanceMatrix.needsUpdate = true; rings.instanceColor.needsUpdate = true; }
    spheres.count = sphereCount; spheres.visible = sphereCount > 0; if (sphereCount) { spheres.instanceMatrix.needsUpdate = true; spheres.instanceColor.needsUpdate = true; }
    beam.visible = beamOn; stats.rings = ringCount; stats.spheres = sphereCount; stats.beam = beamOn;
  }

  // ---------------------------------------------------------------- the boss bar: violet, with the skill's name during a wind-up
  // combat-hud.mjs bossBar draws the bar (builder D gives it the 'titan' class, "TITAN" in the name and a #boss-callout line of
  // its own). Until then the same class, word and line are put there from here; once they are, these lines find them done.
  let barTitan = null;
  function bar(shown) {
    const el = pandora.hud?.boss; if (!el) return;
    const titan = shown ?? null;
    if (titan !== barTitan) {
      barTitan = titan; el.classList.toggle('titan', !!titan);
      const name = el.querySelector('#boss-name'); if (titan && name && !name.textContent.includes('TITAN')) name.textContent = `🔱 TITAN · ${titan.def.name}`;
    }
    const call = titan && titan.phase === 'windup' && isTitanSkill(titan.attack?.skill) ? TITAN_CALLOUTS[titan.attack.skill] : '';
    let line = el.querySelector('#boss-callout'); if (!line) { if (!titan) return; line = document.createElement('div'); line.id = 'boss-callout'; line.className = 'titan-made'; el.append(line); }
    // Compared with what the page shows, not with what was last written: the bar's own code may have written the line since.
    if ((titan || line.classList.contains('titan-made')) && line.textContent !== call) { line.textContent = call; el.classList.toggle('calling', !!call); }
  }

  // ---------------------------------------------------------------- the test hook's skill, for a titan
  // willowmere.test.skill(denId, name) calls world.pandora.forceSkill (builder D), which sets `forced` on the den's creature, a titan too.
  // The titans' turn (titan-patterns.mjs) is fetched beside this file, so a titan never waits for it once the box is open.
  loadTitanTurn().catch(error => console.warn('The titan skills could not load.', error));

  // ---------------------------------------------------------------- every frame, after Pandora's own
  let mounted = false, scan = 0, lastT = world.t, boomAt = -9; const drawn = { x: 0, z: 0 }; // where a titan is drawn this frame (reused: nothing is made per frame)
  const off = () => { if (rings.visible || spheres.visible || beam.visible) { ringCount = sphereCount = 0; beamOn = false; show(); } stats.marks = 0; bar(null); };
  room.onFrame(() => {
    if (!world.ready || !world.player) return;
    if (window.willowmere && !window.willowmere.titans) window.willowmere.titans = diagnostics;
    const dt = Math.min(.05, Math.max(0, world.t - lastT)); lastT = world.t;
    if (!pandora.active || world.location !== 'village') { off(); return; }
    if (!mounted) { mounted = true; world.outside.add(root); }
    const p = world.player.position;
    // A titan's file: asked for once its den is within 96 m (twice a second is often enough to look).
    if ((scan -= dt) <= 0) { scan = .5; listSize = -1; for (let i = 0; i < TITAN_DENS.length; i++) { const d = TITAN_DENS[i]; if (len(d.x - p.x, d.z - p.z) < TITAN_KIT_RANGE) ensure(d.type); } }
    // The titans among the loaded creatures (the list changes only when cells load or retire).
    if (wilds.list.length !== listSize || wilds.list[0] !== listHead) { listSize = wilds.list.length; listHead = wilds.list[0]; titans.length = 0; for (let i = 0; i < wilds.list.length; i++) if (wilds.list[i].def.titan) titans.push(wilds.list[i]); }
    ringCount = sphereCount = 0; beamOn = false; let marks = 0, shown = null; const barId = pandora.hud?.state?.boss;
    for (let n = 0; n < titans.length; n++) {
      const e = titans[n]; if (e.gone) { listSize = -1; continue; }
      if (e.id === barId && e.hp > 0) shown = e;
      const s = e.attack; if (!s || !(e.hp > 0)) continue;
      const u = e.view?.userData, at = u && e.view.visible ? (drawn.x = u.drawX, drawn.z = u.drawZ, drawn) : e, away = len(e.x - p.x, e.z - p.z);
      // The leap's height (wilds-view.mjs draws launch height and hover; a titan's own lift is added here, unless it already was).
      if (e.titanLift > 0 && e.view) { const base = e.lift + (e.def.flying ? 1 + Math.sin(world.t * 4 + e.homeX) * .15 : 0); if (e.view.position.y < base + e.titanLift - .5) e.view.position.y += e.titanLift; stats.lifted = e.titanLift; }
      // Callout and enrage, once each.
      if (e.phase === 'windup' && s.skill && s.called !== e.attacks) {
        s.called = e.attacks;
        if (away < CALLOUT_RANGE) { const top = view.top(e) * .6 + .5; fx.text(e.x, top, e.z, TITAN_CALLOUTS[s.skill], 'alert callout titan'); fx.burst(e.x, top + 1.2, e.z, 24, [TITAN_COLORS[s.skill], '#ffffff'], 5, 4, .12, .5, true); fx.play('alert'); stats.callouts++; stats.lastCallout = s.skill; }
      }
      if (s.enraged !== !!s.raged) {
        s.raged = s.enraged;
        if (s.enraged) { toast(`${e.def.name} is enraged! Its skills come faster.`); if (away < CALLOUT_RANGE) { fx.text(e.x, view.top(e) * .7, e.z, '😡 ENRAGED!', 'alert callout titan'); fx.shake(.8); fx.burst(e.x, 1, e.z, 40, ['#ff3b3b', '#ff8a3d', '#ffffff'], 7, 8, .14, .8, true); } }
      }
      // Where its blows land: a ring and chips in its colours.
      if (s.bursts.length) {
        for (let i = 0; i < s.bursts.length; i++) { const b = s.bursts[i]; if (len(b.x - p.x, b.z - p.z) > DRAW_RANGE) continue; fx.ring(b.x, b.z, b.r, e.def.accent, .4, .2); fx.burst(b.x, .3, b.z, 12, e.def.color, 5, 4, .13, .6); stats.bursts++; if (world.t - boomAt > .25 && len(b.x - p.x, b.z - p.z) < CALLOUT_RANGE) { boomAt = world.t; fx.play('boom'); fx.shake(.2); } }
        s.bursts.length = 0;
      }
      if (away > DRAW_RANGE) continue;
      // The wind-up: its marks fill as the blow nears; a plain strike is one disc as wide as it reaches.
      if (e.phase === 'windup') {
        const progress = windupProgress(e), list = titanMarks(e);
        if (s.skill) for (let i = 0; i < list.length; i++) { const m = list[i]; if (m.r > 0 && pandora.mark(m.x, m.z, m.r, progress, m.safe ? SAFE_GREEN : TITAN_COLORS[s.skill])) marks++; }
        else if (pandora.mark(at.x, at.z, e.def.reach + TITAN.strikeReach, progress, STRIKE)) marks++;
      }
      const running = titanAttacks(e); for (let i = 0; i < running.length; i++) drawAttack(running[i], at);
    }
    stats.marks = marks; show(); bar(shown);
  });

  /** Read-only numbers for tests and performance checks (window.willowmere.titans()). */
  function diagnostics() {
    const p = world.player.position;
    return { ...stats, kits: Object.fromEntries(kits), requested: [...requested], mounted,
      bar: { titan: !!pandora.hud?.boss?.classList.contains('titan') && !pandora.hud.boss.hidden, callout: pandora.hud?.boss?.querySelector('#boss-callout')?.textContent ?? '' },
      titans: wilds.list.filter(e => e.def.titan).map(e => ({ id: e.id, type: e.type, x: e.x, z: e.z, hp: e.hp, maxHp: e.maxHp, phase: e.phase, skill: e.attack?.skill ?? '', skills: e.attack?.skills ?? 0, attacks: titanAttacks(e).map(a => a.skill), marks: titanMarks(e).length,
        lift: e.titanLift, enraged: !!e.attack?.enraged, home: len(e.x - e.homeX, e.z - e.homeZ), distance: len(e.x - p.x, e.z - p.z), shown: !!e.view?.visible, model: kits.get(e.type) ?? 'none', triangles: (e.view?.userData.body?.geometry.getAttribute('position').count ?? 0) / 3 })) };
  }
  return world.__titans = { diagnostics, kits, requested, root, rings, spheres, beam, state: titanState };
}
