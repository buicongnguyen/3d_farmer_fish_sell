// Decorating your home, after the Zoo Garden decorations (cute_game main.ts decorations() / beginPlacement /
// rotatePlacement / confirmPlacement, placement-ghost.ts, the #placement-bar markup and style.css): a "Make this place
// your own" panel listing the pieces your home owns in groups ("🪑 Seating · 3"), each a card with its model picture, the
// number in storage (×n) and a Place button, then the pieces placed at home with Move, ↻ and Pack away. Placing shows a
// see-through model of the piece (red where it cannot stand) and the placement bar: tap or drag on the floor to move it,
// ↻ Rotate (or R) turns it 45°, ✔ Place (or Enter) puts it down, ✕ (or Esc) cancels.
//
//   const decor = installDecor(world, {state, act, toast, closePanel})
//     state()            the current game state
//     act(type, arg)     main.mjs runAction: runs game.mjs act(), toasts, saves and rebuilds the room (world.sync(true))
//   decor.panel()        -> {title, kicker, html, cls} for main.mjs renderPanel (panel === 'decor')
//   decor.begin({id}) · decor.begin({index}) · decor.rotate() · decor.confirm() · decor.cancel() · decor.store()
//   decor.fold(group) · decor.leave()   (turning and packing away from the list are main.mjs runAction('rotateDecor' | 'removeDecor'))
//
// It also adds the indoor HUD pills ("🏡 Decorate" in your own home, "🚪 Outside", like the reference's house button) and
// answers the little things to use around the house (fun/<thing> targets from interior.mjs) with their line.
import * as T from 'three';
import { K, DECOR, DECOR_GROUPS, SET_NAMES, MAX_DECOR, decorLayout, ownedCount, storedCount, placedCount, spotProblem, decorFootprint } from './home-plan.mjs';
import { installRoomView } from './room-view.mjs';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STEP = Math.PI / 4;
const sourceLine = id => { const from = DECOR[id].from.map(([s]) => s === 'starter' ? 'a housewarming gift' : `the ${SET_NAMES[s]}`); return 'From ' + [...new Set(from)].join(' or '); };

export function installDecor(world, deps) {
  if (world.__decor) return world.__decor;
  const view = installRoomView(world), app = document.getElementById('app') ?? document.body;
  const folded = new Set(['locked']);
  let placing = null, dragging = false;

  // ---- indoor HUD pills and the placement bar
  const pills = document.createElement('div'); pills.id = 'room-actions';
  pills.innerHTML = `<button class="room-pill decorate-pill" data-action="decorate" aria-label="Decorate your home"><span class="room-pill-icon">🏡</span><span>Decorate</span><b class="room-badge" hidden></b></button><button class="room-pill" data-action="leaveHouse" aria-label="Step outside"><span class="room-pill-icon">🚪</span><span>Outside</span></button>`;
  const bar = document.createElement('div'); bar.id = 'placement-bar'; bar.hidden = true; bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'Place a decoration');
  bar.innerHTML = `<p><span id="placement-name"></span><span id="placement-hint"></span></p><div class="placement-buttons"><button class="pb-sky" data-action="decor-rotate">↻ Rotate</button><button class="pb-primary" data-action="decor-confirm">✔ Place</button><button class="pb-soft" data-action="decor-store" hidden>📦 Pack away</button><button class="pb-soft pb-close" data-action="decor-cancel" aria-label="Cancel">✕</button></div>`;
  app.append(pills, bar);
  const badge = pills.querySelector('.room-badge'), storeButton = bar.querySelector('[data-action="decor-store"]');
  let badgeTime = 0, atHome = null, tipInside = null, outdoorTip = null;
  const waiting = s => Object.keys(DECOR).reduce((n, id) => n + storedCount(s, id), 0);

  // ---- the see-through piece (placement-ghost.ts) with a footprint under it
  const footGeo = new T.PlaneGeometry(1, 1); footGeo.rotateX(-Math.PI / 2);
  const foot = new T.Mesh(footGeo, new T.MeshBasicMaterial({ color: '#7edb55', transparent: true, opacity: .6, depthWrite: false, toneMapped: false }));
  foot.renderOrder = 3; foot.name = 'decor-footprint';
  function makeGhost(id) {
    const piece = DECOR[id], src = world.assets.get(piece.kit), group = new T.Group(); group.name = 'decor-ghost';
    if (src) {
      const model = src.clone(true), materials = [];
      model.traverse(o => { if (!o.isMesh) return; const m = new T.MeshLambertMaterial({ vertexColors: !!o.geometry.getAttribute('color'), color: '#ffffff', transparent: true, opacity: .72, depthWrite: false, emissive: '#000000' }); o.material = m; o.castShadow = o.receiveShadow = false; o.renderOrder = 3; materials.push(m); });
      model.scale.setScalar(K * (piece.s ?? 1)); group.add(model); group.userData.materials = materials; group.userData.model = model;
    }
    group.add(foot); return group;
  }
  function dropGhost() { if (!placing?.ghost) return; placing.ghost.remove(foot); placing.ghost.removeFromParent(); placing.ghost.traverse(o => { if (o.isMesh && o !== foot) o.material.dispose(); }); }

  // ---- placing
  const s = () => deps.state();
  const name = id => DECOR[id]?.name ?? id;
  const player = () => world.player?.position ?? { x: 0, z: 0 };
  /** Why the piece can't stand here: the house rules (home-plan.mjs), and never on top of you. */
  function problemAt(x, z, rot) {
    const p = placing, why = spotProblem(s(), p.id, x, z, rot, p.index); if (why) return why;
    if (!DECOR[p.id].flat) { const [w, d] = decorFootprint(p.id, rot), me = player(); if (Math.abs(me.x - x) < w / 2 + .45 && Math.abs(me.z - z) < d / 2 + .45) return 'You are standing there.'; }
    return null;
  }
  function move(x, z) {
    const p = placing; if (!p) return;
    p.x = Math.round(x * 20) / 20; p.z = Math.round(z * 20) / 20; p.problem = problemAt(p.x, p.z, p.rot); p.ok = !p.problem;
    p.ghost.position.set(p.x, .02, p.z); p.ghost.userData.model?.rotation.set(0, p.rot, 0);
    const [w, d] = decorFootprint(p.id, p.rot); foot.scale.set(w + .14, 1, d + .14); foot.position.set(0, .04, 0);
    foot.material.color.set(p.ok ? '#7edb55' : '#ff5a4a');
    for (const m of p.ghost.userData.materials ?? []) m.emissive.set(p.ok ? '#000000' : '#ff2020'), m.emissiveIntensity = p.ok ? 0 : .6;
    bar.classList.toggle('bad', !p.ok); bar.querySelector('#placement-hint').textContent = p.problem ?? '';
  }
  /** The nearest free spot to (x, z), searched in rings, so a new piece starts somewhere it can stand. */
  function settle(x, z) {
    for (let r = 0; r <= 4; r += .35) for (let a = 0; a < Math.PI * 2; a += r ? .5 / Math.max(r, .5) : 7) {
      const tx = x + Math.cos(a) * r, tz = z + Math.sin(a) * r; if (!problemAt(tx, tz, placing.rot)) return [tx, tz];
    }
    return [x, z];
  }
  function begin({ id, index } = {}) {
    if (world.location !== 'interior' || world.houseId !== 0) { deps.toast('Decorations belong in your own home.'); return; }
    if (placing) cancel();
    const layout = decorLayout(s()), moving = Number.isInteger(index) ? layout[index] : null;
    if (Number.isInteger(index) && !moving) return;
    id = moving?.id ?? id;
    if (!DECOR[id]) return;
    if (!moving && storedCount(s(), id) < 1) { deps.toast(ownedCount(s(), id) ? `Every ${name(id).toLowerCase()} is already placed.` : 'Find this piece at the Vale workshop first.'); return; }
    if (!moving && layout.length >= MAX_DECOR) { deps.toast(`Your home already holds ${MAX_DECOR} pieces. Pack one away first.`); return; }
    deps.closePanel?.();
    const facing = world.player?.rotation.y ?? 0;
    placing = { id, index: moving ? index : -1, rot: moving ? moving.rot : ((Math.round((facing + Math.PI) / STEP) * STEP) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2), x: 0, z: 0, ok: false };
    if (moving) { world.__decorMoving = index; world.buildInterior(); }
    world.__decorPlacing = true; document.body.classList.add('placing');
    placing.ghost = makeGhost(id); world.scene.add(placing.ghost);
    bar.hidden = false; storeButton.hidden = !moving;
    bar.querySelector('#placement-name').innerHTML = `${moving ? 'Move' : 'Place'} <b>${esc(name(id))}</b>: tap the floor to choose a spot`;
    // A new piece starts a couple of steps in front of you, or behind you near the front door (the bar covers the front edge).
    const me = player(), ahead = { x: me.x + Math.sin(facing) * 2.2, z: me.z + Math.cos(facing) * 2.2 }; if (ahead.z > 3.4) { ahead.x = me.x; ahead.z = me.z - 2.4; }
    const start = moving ? [moving.x, moving.z] : settle(ahead.x, ahead.z);
    move(start[0], start[1]);
  }
  function end() {
    if (!placing) return;
    dropGhost(); placing = null; dragging = false; world.__decorPlacing = false; document.body.classList.remove('placing');
    bar.hidden = true; bar.classList.remove('bad');
    const wasMoving = Number.isInteger(world.__decorMoving); world.__decorMoving = null;
    return wasMoving;
  }
  function cancel() { if (end() && world.location === 'interior') world.buildInterior(); }
  function rotate() { if (!placing) return; placing.rot = ((placing.rot + STEP) % (Math.PI * 2)); move(placing.x, placing.z); }
  function confirm() {
    const p = placing; if (!p) return;
    if (!p.ok) { deps.toast(`Can’t place it here. ${p.problem ?? ''}`.trim()); return; }
    const arg = p.index >= 0 ? { index: p.index, x: p.x, z: p.z, rot: p.rot } : { id: p.id, x: p.x, z: p.z, rot: p.rot };
    end();
    const r = deps.act('placeDecor', arg);
    if (!r?.ok && world.location === 'interior') world.buildInterior();
  }
  function store() { const p = placing; if (!p || p.index < 0) return; end(); const r = deps.act('removeDecor', { index: p.index }); if (!r?.ok) world.buildInterior(); }
  function fold(group) { if (folded.has(group)) folded.delete(group); else folded.add(group); }
  function leave() { if (world.location !== 'interior' || world.paused) return; cancel(); world.exit(); }

  // ---- input while placing: taps and drags on the floor move the piece; R, Enter and Esc
  const ground = new T.Plane(new T.Vector3(0, 1, 0), 0), ray = new T.Raycaster(), ndc = new T.Vector2(), hit = new T.Vector3();
  const floorAt = (cx, cy) => { ndc.set(cx / innerWidth * 2 - 1, -cy / innerHeight * 2 + 1); ray.setFromCamera(ndc, world.camera); return ray.ray.intersectPlane(ground, hit) ? hit : null; };
  const click = world.click.bind(world);
  world.click = e => { if (placing) { const p = floorAt(e.clientX, e.clientY); if (p) move(p.x, p.z); return; } return click(e); };
  world.canvas?.addEventListener('pointerdown', e => { if (!placing || e.button > 0) return; const p = floorAt(e.clientX, e.clientY); if (p && Math.hypot(p.x - placing.x, p.z - placing.z) < 1.6) dragging = true; });
  world.canvas?.addEventListener('pointermove', e => { if (!placing || !dragging) return; const p = floorAt(e.clientX, e.clientY); if (p) move(p.x, p.z); });
  for (const type of ['pointerup', 'pointercancel']) world.canvas?.addEventListener(type, () => { dragging = false; });
  document.addEventListener('keydown', e => {
    if (!placing) return; const k = e.key.toLowerCase();
    if (k === 'r') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) rotate(); }
    else if (k === 'enter') { e.preventDefault(); e.stopImmediatePropagation(); confirm(); }
    else if (k === 'escape') { e.preventDefault(); e.stopImmediatePropagation(); cancel(); }
    else if (k === 'e' || k === ' ') { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);

  // ---- the little things to use around the house
  const interact = world.onInteract;
  world.onInteract = t => {
    if (t?.type === 'fun') { if (world.paused || placing) return; deps.toast(`${t.icon ?? ''} ${t.line}`.trim()); world.burst?.('#ffe39a'); return; }
    if (placing) return;
    return interact(t);
  };

  // ---- per frame: the HUD pills follow where you are; placing ends if you leave the house
  view.onFrame(() => {
    const home = world.location === 'interior' && world.houseId === 0;
    if (home !== atHome) { atHome = home; pills.classList.toggle('at-home', home); }
    // Indoors the tip under the action pill says how the house works (reference house.css swaps the hints).
    const inside = world.location === 'interior', tip = document.getElementById('move-tip');
    if (tip && inside !== tipInside) { tipInside = inside; if (inside) { outdoorTip ??= tip.textContent; tip.textContent = 'Click a glowing thing to use it · WASD to move'; } else if (outdoorTip != null) tip.textContent = outdoorTip; }
    if (placing && (!home || document.getElementById('modal-backdrop')?.hidden === false)) cancel(); // left the house, or opened a panel
    if (home && (badgeTime -= 1 / 60) <= 0) { badgeTime = .5; const n = waiting(s()); badge.hidden = !n; badge.textContent = n; }
  });

  // ---- the Decorate panel
  /** A catalog card (reference .shop-item): picture, "Name ×n" in storage, where it is, and Place (or Move when all are out). */
  function card(state, id) {
    const piece = DECOR[id], have = storedCount(state, id), placed = placedCount(state, id), img = world.modelIcon?.(piece.kit), first = decorLayout(state).findIndex(d => d.id === id);
    const action = have ? `<button class="pb-primary dc-place" data-action="decor-place" data-id="${id}">Place</button>`
      : first >= 0 ? `<button class="pb-sky dc-place" data-action="decor-move" data-index="${first}" aria-label="Move ${esc(piece.name)}">✋ Move</button>` : '';
    return `<div class="dc-item${have ? ' has-stock' : ''}" title="${esc(`${piece.desc} ${sourceLine(id)}.`)}"><span class="dc-icon">${img ? `<img src="${img}" alt="" draggable="false">` : '🪑'}</span><div><strong>${esc(piece.name)}${have ? ` <small>×${have}</small>` : ''}</strong><span class="dc-chips">${have ? `<i class="dc-chip dc-new">📦 ${have} to place</i>` : ''}${placed ? `<i class="dc-chip">🏠 ${placed} at home</i>` : ''}</span></div>${action}</div>`;
  }
  function group(key, icon, label, body, count) {
    const closed = folded.has(key);
    return `<section class="dc-group${closed ? ' folded' : ''}"><h3 class="dc-group-head"><button data-action="decor-fold" data-id="${key}" aria-expanded="${!closed}">${icon} ${esc(label)} · ${count}</button></h3><div class="dc-grid">${body}</div></section>`;
  }
  function panel() {
    const state = s(), layout = decorLayout(state), owned = Object.keys(DECOR).filter(id => ownedCount(state, id) > 0), locked = Object.keys(DECOR).filter(id => !ownedCount(state, id)), inStore = waiting(state);
    const groups = DECOR_GROUPS.map(([key, icon, label]) => { const ids = owned.filter(id => DECOR[id].group === key).sort((a, b) => storedCount(state, b) - storedCount(state, a)); return ids.length ? group(key, icon, label, ids.map(id => card(state, id)).join(''), ids.length) : ''; }).join('');
    const lockedHtml = locked.length ? group('locked', '🔒', 'More from the Vale workshop', locked.map(id => { const img = world.modelIcon?.(DECOR[id].kit); return `<div class="dc-item is-locked"><span class="dc-icon">${img ? `<img src="${img}" alt="" draggable="false">` : '🪑'}</span><div><strong>${esc(DECOR[id].name)}</strong><p>Comes with the ${esc(SET_NAMES[DECOR[id].from.find(([s]) => s !== 'starter')?.[0]] ?? 'workshop')}.</p></div></div>`; }).join(''), locked.length) : '';
    const rows = layout.map((d, i) => { const piece = DECOR[d.id]; if (!piece) return ''; const img = world.modelIcon?.(piece.kit); return `<div class="dc-row"><span class="dc-row-name">${img ? `<img class="dc-mini" src="${img}" alt="">` : ''}${esc(piece.name)}</span><span class="dc-row-actions"><button class="pb-soft" data-action="decor-move" data-index="${i}">✋ Move</button><button class="pb-soft dc-turn" data-action="decor-turn" data-index="${i}" aria-label="Turn ${esc(piece.name)}">↻</button><button class="pb-soft" data-action="decor-remove" data-index="${i}">Pack away</button></span></div>`; }).join('');
    const html = `<p class="panel-intro dc-intro">Pick a piece, tap the floor to move it, ↻ turns it, then ✔ Place.</p>`
      + `<div class="dc-summary"><span>📦 <b>${inStore}</b> in storage</span><span>🏠 <b>${layout.length}</b> / ${MAX_DECOR} placed</span></div>`
      + (groups || '<div class="dc-empty">Your home is a fresh canvas. Find furniture at the Vale workshop.</div>') + lockedHtml
      + `<div class="dc-label">PLACED AT HOME <span>${layout.length}</span></div><div class="dc-placed">${rows || '<p class="dc-muted">A fresh canvas.</p>'}</div>`
      + `<button class="pb-soft dc-browse" data-action="decorShop">🪚 Browse furniture</button>`;
    return { title: 'Make this place your own', kicker: 'YOUR HOME', html, cls: 'decor-modal' };
  }

  return world.__decor = { panel, begin, rotate, confirm, cancel, store, fold, leave, get placing() { return placing; } };
}
