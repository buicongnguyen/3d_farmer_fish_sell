// The rescue huts, drawn (2026-10-10; the rules are rescued.mjs). installRescue(world, pandora, deps) is called once from main.mjs
// boot() with import(), after the friends; deps = {state(), act(type, arg), toast(message), persist(), hud()}.
//
// A hut is TWO meshes and casts no shadow (its ground patch is modelled): the hut itself (one of twelve styles in rescue-huts.glb,
// fetched the first time a hut that is not hidden is within REACH.load) and one mesh merged for its state: 'barred' = door + bar +
// the captive at the window, 'open' = door + captive, 'rescued' = the door swung open. The captive is a bust repainted with the
// person's hair and shirt colours. With the box shut nothing of a hut exists: no mesh, no file request, no collider, no target, no label.
//
// It also gives the rest of the game three small hooks on `world` (so no facility file imports this one):
//   world.rescuedPosts(planId, state)   rescued.mjs postsFor: the extra staff of a facility (THE SEAM, one call in facility-interior.mjs)
//   world.rescueTalk(id)                true when `id` is a rescued worker: opens their conversation (rescued-talk.mjs) in
//                                       world.facilityTalk.open(...) when the facility-talk system is there, else in the small panel below
//   world.rescueHeld(land)              who is still held in that land, for the region banner
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon } from './toon.mjs';
import { hyp } from './hyp.mjs';
import { installRoomView } from './room-view.mjs';
import { CAMERA_YAW } from './field-layout.mjs';
import { buildAvatar, disposeAvatar } from './avatar.mjs';
import { outfitOf } from './outfits.mjs';
import { PEOPLE, PERSON, HUT_RADIUS, hutSpot, hutState, postsFor, heldIn, isBack, ASKED } from './rescued.mjs';

export const REACH = Object.freeze({ load: 96, drop: 112, tapIn: 48, tapOut: 56, label: 38, call: 26 });
/** build_huts.py's numbers in three.js space (Y up, front +Z): the door's hinge, the window's centre, the tap's radius. */
export const HUT = Object.freeze({ hinge: Object.freeze({ x: -1.195, z: 1.4 }), swing: -1.75, window: Object.freeze({ x: .74, y: 1.4, z: 1.3 }), scale: 1.25, door: 3.5, tap: 2.4 });
/** A point `d` metres in front of a hut's door (the door faces the camera) and `side` metres to its right. */
const before = (h, d, side, out) => { const c = Math.cos(CAMERA_YAW), s = Math.sin(CAMERA_YAW); out.x = h.x + s * d + c * side; out.z = h.z + c * d - s * side; return out; };
const spot = { x: 0, z: 0 };
const HAIRS = ['#7c4527', '#2d2a44', '#f2c14e', '#c4532d', '#5b3a29', '#8d99ae', '#3d2b1f', '#e9d8a6', '#a44a3f', '#1f1f2e', '#d08c60', '#6b705c'];
const CALLS = ['Help! In here!', 'Hello? Anybody out there?', 'The door is stuck. Very stuck.', 'Psst! Over here!'];
const LIT = toon({ vertexColors: true }); LIT.name = 'rescue-hut';
const colour = new T.Color(), v3 = new T.Vector3(), m4 = new T.Matrix4(), m4b = new T.Matrix4();

const kit = { ready: false, requested: false, failed: false, huts: {}, door: null, bar: null, captive: null };
function painted(geometry, tint) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  for (const key of Object.keys(g.attributes)) if (key !== 'position' && key !== 'normal') g.deleteAttribute(key);
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  const n = g.getAttribute('position').count, colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { colors[i * 3] = tint.r; colors[i * 3 + 1] = tint.g; colors[i * 3 + 2] = tint.b; }
  g.setAttribute('color', new T.BufferAttribute(colors, 3)); return g;
}
const merge = list => { const g = list.length > 1 ? mergeGeometries(list, false) : list[0]; if (list.length > 1) list.forEach(p => p.dispose()); g.computeBoundingSphere(); return g; };
/** A root's primitives, each painted with its material's colour: merged into one geometry, or kept by material name (the captive). */
function bake(root, byName) {
  const pieces = [], named = {};
  root.traverse(o => { if (!o.isMesh) return; const g = painted(o.geometry, o.material?.color ?? colour.set('#ffffff')); g.applyMatrix4(o.matrixWorld); if (byName) named[o.material.name.split(' ').pop()] = g; else pieces.push(g); });
  return byName ? named : merge(pieces);
}
function loadKit(onReady) {
  if (kit.requested) return; kit.requested = true;
  new GLTFLoader().loadAsync('./assets/models/rescue-huts.glb').then(gltf => {
    gltf.scene.updateMatrixWorld(true);
    for (const root of gltf.scene.children) {
      if (root.name === 'hut_door') kit.door = bake(root); else if (root.name === 'hut_bar') kit.bar = bake(root);
      else if (root.name === 'hut_captive') kit.captive = bake(root, true); else if (root.name.startsWith('hut_')) kit.huts[root.name.slice(4)] = bake(root);
    }
    if (!kit.door || !kit.bar || !kit.captive?.skin) throw Error('rescue-huts.glb: a part is missing');
    kit.ready = true; onReady();
  }).catch(error => { kit.failed = true; console.warn('The huts could not load.', error); });
}
const tinted = (g, hex) => { const out = g.clone(), c = out.getAttribute('color'); colour.set(hex); for (let i = 0; i < c.count; i++) c.setXYZ(i, colour.r, colour.g, colour.b); return out; };
/** The second mesh of a hut: door, bar and captive for its state, in the hut's own space. */
function stateGeometry(p, state) {
  const list = [], door = kit.door.clone();
  m4.makeTranslation(HUT.hinge.x, 0, HUT.hinge.z);
  if (state === 'rescued') door.applyMatrix4(m4b.makeRotationY(HUT.swing));
  door.applyMatrix4(m4); list.push(door);
  if (state === 'barred') list.push(kit.bar.clone().applyMatrix4(m4));
  if (state !== 'rescued') { const c = kit.captive; list.push(c.skin.clone(), c.eye.clone(), tinted(c.hair, HAIRS[p.index % HAIRS.length]), tinted(c.shirt, p.color)); }
  return merge(list);
}

const STYLE = '#rescue-tags{position:absolute;inset:0;z-index:3;pointer-events:none;overflow:hidden}#rescue-tags[hidden]{display:none}'
  + '#rescue-talk{position:absolute;inset:0;z-index:60;display:grid;place-items:end center;padding:0 12px max(16px,env(safe-area-inset-bottom));background:#1b243044}#rescue-talk[hidden]{display:none}'
  + '.rt-card{width:min(560px,100%);max-height:88%;overflow:auto;box-sizing:border-box;padding:14px 16px 16px;border-radius:22px;background:#fffdf4;border:3px solid #ffd84d;box-shadow:0 6px 0 #2c3a2633,0 14px 30px #2c3a2640;color:#2c3a26;font-weight:700}'
  + '.rt-head{display:flex;align-items:center;gap:10px;margin-bottom:8px}.rt-face{flex:none;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;color:#fff;font-weight:900;font-size:20px;border:3px solid #fff;box-shadow:0 2px 0 #2c3a2633}'
  + '.rt-head b{display:block;font-size:18px;line-height:1.1}.rt-head small{opacity:.7}.rt-close{margin-left:auto;width:44px;height:44px;border-radius:50%;border:0;background:#f1ead6;font-size:20px;font-weight:900;color:#2c3a26;cursor:pointer}'
  + '.rt-say{margin:6px 0;font-size:16px;line-height:1.35}.rt-reply{margin:6px 0 8px;padding:8px 12px;border-radius:14px;background:#eefbe6;font-size:15px;line-height:1.35}.rt-reply:empty{display:none}'
  + '.rt-choices{display:grid;gap:8px}.rt-choices button{min-height:46px;padding:8px 14px;border-radius:14px;border:2px solid #e6dcc0;background:#fff;font:inherit;font-size:15px;text-align:left;color:#2c3a26;cursor:pointer}.rt-choices button:hover{border-color:#ffd84d;background:#fff9df}';

export function installRescue(world, pandora, deps = {}) {
  if (world.__rescue) return world.__rescue;
  world.rescuedPosts = (planId, state) => { const list = postsFor(planId, state ?? deps.state?.()); if (list.length) greet(list); return list; };
  world.rescueHeld = land => heldIn(land, deps.state?.());
  world.rescueTalk = id => { if (!PERSON[id] || !isBack(deps.state?.(), id)) return false; talk(id); return true; };
  if (!world.renderer || !deps.state) return world.__rescue = {}; // a bare world (tests)
  const room = installRoomView(world), state = () => deps.state(), app = document.getElementById('app') ?? document.body;
  const group = new T.Group(); group.name = 'rescue-huts';
  const huts = new Map(), greeted = new Set();
  let mounted = false, layer = null, lastT = world.t, said = null, cheer = null, style = null;
  const css = () => { if (!style) { style = document.createElement('style'); style.textContent = STYLE; document.head.appendChild(style); } };
  function tag(className) {
    css(); if (!layer) { layer = document.createElement('div'); layer.id = 'rescue-tags'; app.appendChild(layer); }
    const el = document.createElement('div'); el.className = className; el.hidden = true; layer.appendChild(el); return el;
  }
  function place(el, show, text, x, y, z) {
    if (show) { v3.set(x, y, z).project(world.camera); show = v3.z < 1 && Math.abs(v3.x) < 1.15 && Math.abs(v3.y) < 1.15; }
    if (el.hidden === show) el.hidden = !show; if (!show) return;
    if (el.__text !== text) { el.__text = text; el.textContent = text; }
    const px = Math.round((v3.x + 1) * innerWidth / 2), py = Math.round((1 - v3.y) * innerHeight / 2);
    if (px !== el.__x || py !== el.__y) { el.__x = px; el.__y = py; el.style.transform = `translate(${px}px, ${py}px) translate(-50%, -100%)`; }
  }

  // ---- huts
  function dropModel(h) { if (h.group) { h.group.removeFromParent(); h.extra?.geometry.dispose(); h.group = h.body = h.extra = null; } }
  function dropHut(h) {
    dropModel(h);
    if (h.block) { world.removeTreeBlock(h.block); h.block = null; }
    if (h.target) { world.removeTarget(h.target); h.target = null; }
    if (h.label) { h.label.remove(); h.label = null; }
    huts.delete(h.id);
  }
  function buildModel(h) {
    if (!kit.ready) return;
    if (!mounted) { mounted = true; world.outside.add(group); }
    const g = h.group = new T.Group(); g.name = 'hut-' + h.id; g.position.set(h.x, 0, h.z); g.rotation.y = CAMERA_YAW; g.scale.setScalar(HUT.scale); // the door faces the camera; shown 1.25x, so the door is your height
    h.body = new T.Mesh(kit.huts[h.p.hut] ?? kit.huts.cottage, LIT); h.body.name = 'hut'; g.add(h.body);
    h.extra = new T.Mesh(stateGeometry(h.p, h.state), LIT); h.extra.name = 'hut-state'; g.add(h.extra);
    g.matrixAutoUpdate = false; g.updateMatrix(); h.body.matrixAutoUpdate = h.extra.matrixAutoUpdate = false;
    group.add(g);
  }
  const labelOf = h => h.state === 'open' ? `🗝️ Let ${h.p.name} out` : `🔒 ${h.p.name} · ${h.p.role}`;
  function open(id) {
    const h = huts.get(id), at = world.player.position; if (!h || h.state !== 'open') return false;
    const result = deps.act('hut', { id, x: at.x, z: at.z }); if (!result?.ok) return false;
    h.state = 'rescued'; dropModel(h); buildModel(h);
    if (h.target) { world.removeTarget(h.target); h.target = null; }
    // The worker steps out, cheers, says thank you and hurries home (a puff of stars).
    const yaw = CAMERA_YAW, fx = pandora?.fx, { x, z } = before(h, 2.9, -.9, spot);
    endCheer();
    const avatar = buildAvatar(world, outfitOf(h.p)); avatar.scale.multiplyScalar(.79); avatar.position.set(x, 0, z); avatar.rotation.y = yaw; avatar.name = 'rescued-' + id;
    avatar.traverse(o => { if (o.isMesh) o.castShadow = false; }); group.add(avatar);
    cheer = { id, avatar, x, z, t: 0, life: 3.4 };
    fx?.burst?.(x, 1, z, 30, ['#ffe66d', '#ffffff', h.p.color], 5, 6, .14, .9); fx?.play?.('level');
    said = { x, z, y: 3, text: result.hello ?? '', life: 3.4, el: said?.el ?? tag('friend-say') };
    deps.hud?.();
    return true;
  }
  function endCheer() { if (!cheer) return; pandora?.fx?.burst?.(cheer.x, 1, cheer.z, 18, ['#ffffff', '#ffe66d'], 4, 5, .12, .7); cheer.avatar.removeFromParent(); disposeAvatar(cheer.avatar); cheer = null; }
  function tap(id) {
    const h = huts.get(id); if (!h) return;
    if (h.state === 'open') { if (!open(id)) deps.toast?.(`Walk up to the hut to let ${h.p.name} out.`); }
    else if (h.state === 'barred') deps.toast?.(`🔒 ${h.p.name} is shut inside. The boss of this land holds the key.`);
  }
  function stepHuts(s, dt, village) {
    const at = world.player.position;
    for (let i = 0; i < PEOPLE.length; i++) {
      const p = PEOPLE[i], now = hutState(p.id, s); let h = huts.get(p.id);
      if (now === 'hidden') { if (h) dropHut(h); continue; }
      if (!h) { const spot = hutSpot(p.id); huts.set(p.id, h = { id: p.id, p, x: spot.x, z: spot.z, state: now, group: null, body: null, extra: null, block: null, target: null, label: null, call: 3 + i * .7, line: i }); }
      h.block ??= world.addTreeBlock({ x: h.x, z: h.z, r: HUT_RADIUS, perch: false }); // you, creatures and cars go round it
      if (h.state !== now) { h.state = now; dropModel(h); if (h.target) h.target.label = labelOf(h); }
      const d = village ? hyp(at.x - h.x, at.z - h.z) : Infinity;
      if (d < REACH.load) { if (!kit.requested) loadKit(() => { for (const o of huts.values()) dropModel(o); }); if (!h.group) buildModel(h); }
      else if (d > REACH.drop && h.group) dropModel(h);
      const tappable = now !== 'rescued';
      // The tap: you walk to the doorstep (the hut itself is solid), while the box you tap is the hut.
      if (tappable && d < REACH.tapIn && !h.target) { before(h, HUT.door, 0, spot); h.target = world.target('hut', p.id, labelOf(h), spot.x, spot.z, HUT.tap); h.target.use = () => tap(p.id); h.target.hit.position.set(h.x, 1.9, h.z); h.target.hit.scale.set(1.25, 1.5, 1.25); h.target.hit.updateMatrixWorld(); }
      else if (h.target && (!tappable || d > REACH.tapOut)) { world.removeTarget(h.target); h.target = null; }
      if (tappable && d < REACH.label) { place(h.label ??= tag('friend-tag cage-tag'), true, labelOf(h), h.x, 5.3, h.z); h.label.classList.toggle('open', now === 'open'); }
      else if (h.label) place(h.label, false);
      // The captive calls out now and then while you are near.
      if (tappable && d < REACH.call && !said && !world.paused && (h.call -= dt) <= 0) {
        h.call = 9 + (i % 3) * 2; before(h, HUT.window.z * HUT.scale, HUT.window.x * HUT.scale, spot);
        said = { x: spot.x, z: spot.z, y: 2.7, text: CALLS[h.line++ % CALLS.length], life: 2.6, el: tag('friend-say') };
      }
    }
  }
  function stepSaid(dt) {
    if (cheer) {
      const c = cheer, parts = c.avatar.userData.parts; c.t += dt;
      if (parts) { parts.arm_l.rotation.set(-2.6, 0, -.4); parts.arm_r.rotation.set(-2.6, 0, .4); }
      c.avatar.position.y = Math.abs(Math.sin(c.t * 8)) * .14;
      if (c.t > c.life) endCheer();
    }
    if (said) { said.life -= dt; place(said.el, said.life > 0, said.text, said.x, said.y, said.z); if (said.life <= 0) { said.el.remove(); said = null; } }
  }

  // ---- back at work: a hello the first time you walk in after a rescue
  function greet(list) {
    const s = state();
    for (const { p } of list) {
      if (greeted.has(p.id) || s.rescued[p.id] < s.day - 1) continue; greeted.add(p.id);
      setTimeout(() => deps.toast?.(`🎉 ${p.name} is back at work here. ${p.unlock}`), 1900); break;
    }
  }

  // ---- the conversation: the facility-talk system when it is there, else this small panel
  let panel = null, talkData = null;
  const loadTalk = () => talkData ??= import('./rescued-talk.mjs').then(m => m.TALK);
  function talk(id) {
    const p = PERSON[id];
    loadTalk().then(TALK => {
      const nodes = TALK[id], effect = name => name === 'perk' ? deps.act('perk', { id }) : null;
      if (typeof world.facilityTalk?.open === 'function') { world.facilityTalk.open({ id, person: p, nodes, start: 'root', effect }); return; }
      css(); closeTalk();
      const el = panel = document.createElement('div'); el.id = 'rescue-talk'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', `Talk to ${p.name}`);
      el.innerHTML = `<div class="rt-card"><div class="rt-head"><span class="rt-face" data-i18n-skip></span><div><b></b><small></small></div><button class="rt-close" aria-label="Close panel">✕</button></div><p class="rt-say"></p><p class="rt-reply"></p><div class="rt-choices"></div></div>`;
      const q = c => el.querySelector(c), face = q('.rt-face'); face.textContent = p.name[0]; face.style.background = p.color;
      q('b').textContent = p.name; q('small').textContent = `${p.role} · ${p.unlock}`;
      // An answer to a question takes the place of the greeting it leads back to; the game's own answer (a favour) goes in the note under it.
      const show = (key, reply = '', note = '') => {
        const node = nodes[key] ?? nodes.root; q('.rt-say').textContent = `“${reply || node.say}”`; q('.rt-reply').textContent = note;
        const box = q('.rt-choices'); box.textContent = '';
        node.choices.forEach(c => { const b = document.createElement('button'); b.type = 'button'; b.textContent = c.text; b.onclick = () => { const r = c.effect ? effect(c.effect) : null; if (c.end) { closeTalk(); return; } show(c.next ?? key, c.reply ?? '', r?.message ?? ''); }; box.appendChild(b); });
      };
      q('.rt-close').onclick = closeTalk; el.addEventListener('pointerdown', e => { if (e.target === el) closeTalk(); });
      el.addEventListener('keydown', e => { if (e.keyCode === 27) closeTalk(); }); el.tabIndex = -1;
      show('root'); app.appendChild(el); world.paused = true; world.clearMovement?.(); el.focus();
    }).catch(error => { console.warn('The conversation could not load.', error); deps.toast?.(`${p.name}: “${p.line}”`); });
  }
  function closeTalk() { if (!panel) return; panel.remove(); panel = null; world.paused = false; deps.hud?.(); }

  room.onFrame(() => {
    if (!world.ready || !world.player) return;
    if (window.willowmere && !window.willowmere.rescue) { window.willowmere.rescue = diagnostics; window.willowmere.rescueShow = on => { group.visible = !!on; }; window.willowmere.rescueTalk = id => world.rescueTalk(id); window.willowmere.rescueTap = id => tap(id); }
    const dt = world.paused ? 0 : Math.min(.05, Math.max(0, world.t - lastT)); lastT = world.t;
    const s = state(), village = world.location === 'village';
    if (layer && layer.hidden === village) layer.hidden = !village;
    if (s.pandora === true || huts.size) stepHuts(s, dt, village);
    if (said || cheer) stepSaid(dt);
  });
  // Already inside a building when this file lands: show the rescued staff now.
  if (world.facility && world.location === 'interior') world.buildInterior();

  /** Read-only numbers for the browser run (window.willowmere.rescue()). */
  function diagnostics() {
    const spot = (x, y, z) => { v3.set(x, y, z).project(world.camera); return { x: (v3.x + 1) * innerWidth / 2, y: (1 - v3.y) * innerHeight / 2 }; };
    let meshes = 0, shadows = 0; group.traverse(o => { if (o.isMesh && o.visible) { meshes++; if (o.castShadow) shadows++; } });
    return { kit: kit.ready, failed: kit.failed, meshes, shadows, cheering: cheer?.id ?? null, said: said?.text ?? null, talking: !!panel,
      huts: [...huts.values()].map(h => ({ id: h.id, state: h.state, x: h.x, z: h.z, built: !!h.group, style: h.p.hut, block: !!h.block, target: !!h.target, label: h.label && !h.label.hidden ? h.label.textContent : '', screen: spot(h.x, 1.5, h.z) })) };
  }
  return world.__rescue = { huts, open, tap, talk, closeTalk, diagnostics, ASKED };
}
