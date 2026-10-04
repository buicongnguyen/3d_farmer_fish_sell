// Life inside a house, after Zoo Garden's cottage (cute_game src/house-life.ts and the friends in house-view.ts): the
// people who live there walk from room to room on their legs (walk-cycle.mjs), settle into a pose (stir the pot, sip
// tea, read, stretch, brush their teeth, sit on the sofa, wave) and say a line now and then in a speech bubble; and
// the things you can use at home answer under Willowmere's rules (house-rules.mjs: a rest restores energy).
//
//   const life = installHouseLife(world, {act, toast, openPanel})        once, after installDecor (main.mjs)
//   life.sync({houseId, residents, state, colliders, hotspots, kidColor}) interior.mjs, on every rebuild of the room
//
// The people outlive a rebuild of the room (a purchase, a new day, a moved chair): their avatars are kept (flagged
// userData.persist, which interior.mjs does not dispose) and only their targets and routes are made again.
// Per frame: a clock, one walker step per person (no allocation: routes are planned once per move), one bubble moved
// only when its place on the screen changes.
import * as T from 'three';
import { outfitOf, outfitKey } from './outfits.mjs';
import { buildAvatar, disposeAvatar, reclothe, avatarAssets, walkAvatar } from './avatar.mjs';
import { installRoomView } from './room-view.mjs';
import { findRoute } from './navigation.mjs';
import { ACTIVITIES, STAY_SECONDS, assignHangouts, doorPath, hangout, usableHangouts } from './house-rules.mjs';
import { roomAt, WALK } from './home-plan.mjs';
import { TalkBag, exchangeFor, lineFor } from './house-talk.mjs';
import { newGait } from './walk-cycle.mjs';

const BOUNDS = WALK, v = new T.Vector3();
const turn = (from, to, k) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * k;

/** Arm and leg poses on the hero rig (cute_game house-view.ts armPose), set every frame while settled. */
function pose(m, t) {
  const p = m.parts, kind = m.spot?.pose ?? 'stand', k = m.seat;
  let rx = 0, rz = .1, lx = 0, lz = -.1;
  if (kind === 'wave') { rx = -2.6; rz = .4 + Math.sin(t * 7) * .45; }
  else if (kind === 'stir') { rx = -1.1 + Math.sin(t * 5) * .18; rz = .35 + Math.cos(t * 5) * .25; lx = -.5; }
  else if (kind === 'sip') { const up = Math.max(0, Math.sin(t * .9) - .5) * 2; rx = -1.2 - up * .9; rz = .5 + up * .3; }
  else if (kind === 'paint') { rx = -1.6 + Math.sin(t * 3) * .4; rz = .2 + Math.sin(t * 1.3) * .15; }
  else if (kind === 'read') { rx = -1.0; rz = -.25; lx = -1.0; lz = .25 + (Math.sin(t * .6) > .95 ? -.3 : 0); }
  else if (kind === 'stretch') { rx = -2.9 + Math.sin(t * .8) * .25; rz = .25; lx = -2.9 + Math.sin(t * .8 + .6) * .25; lz = -.25; }
  else if (kind === 'brush') { rx = -1.9; rz = -.75 + Math.sin(t * 14) * .12; }
  else if (kind === 'sit') { rx = -.5 * k; lx = -.5 * k; }
  p.arm_r.rotation.x = rx; p.arm_r.rotation.z = rz; p.arm_l.rotation.x = lx; p.arm_l.rotation.z = lz;
  const legs = kind === 'sit' ? -1.4 * k : 0; p.leg_l.rotation.x = legs; p.leg_r.rotation.x = legs;
  p.body.rotation.x = kind === 'read' ? .1 : 0; p.head.rotation.x = kind === 'read' ? .22 : 0;
  p.head.rotation.y = kind === 'stand' ? Math.sin(t * .5 + m.seed) * .35 : 0;
}

export function installHouseLife(world, deps = {}) {
  if (world.__houseLife) return world.__houseLife;
  const view = installRoomView(world), app = document.getElementById('app') ?? document.body;
  const members = new Map(), order = [], talk = new TalkBag(), queue = [];
  // The clock starts most of the way through a stay, so someone moves soon after you come in.
  const START = STAY_SECONDS * .62;
  let houseId = null, colliders = [], usable = [], phase = -1, clock = START, last = 0;
  let chatClock = 4, chatLeft = 0, chatWho = null, bubbleAt = -2, frameDt = 0;
  const bubble = document.createElement('div'); bubble.id = 'house-bubble'; bubble.hidden = true; bubble.setAttribute('aria-hidden', 'true'); app.append(bubble);

  function drop() {
    for (const m of members.values()) { m.avatar.removeFromParent(); disposeAvatar(m.avatar); }
    members.clear(); order.length = 0; queue.length = 0; phase = -1; clock = START; chatLeft = 0; chatWho = null; bubble.hidden = true;
  }
  const place = (m, h) => { m.spot = h; m.path = []; m.seat = h.seat ? 1 : 0; m.avatar.position.set(h.x, 0, h.z); m.avatar.rotation.y = h.facing; seat(m); };
  /** Where a sitter is: between the spot (0) and the seat (1). */
  function seat(m) {
    const h = m.spot, s = h?.seat; if (!s) return;
    const k = m.seat * m.seat * (3 - 2 * m.seat);
    m.avatar.position.set(h.x + (s.x - h.x) * k, (s.y - m.hip) * k + Math.sin(m.seat * Math.PI) * .25, h.z + (s.z - h.z) * k);
  }
  /** The way to the member's hangout: through the doorways, each leg routed round the furniture. Planned once per move. */
  function plan(m) {
    const a = m.avatar, to = m.spot, from = m.seat > 0 && m.from ? m.from : { x: a.position.x, z: a.position.z };
    const legs = doorPath(roomAt(from)?.id ?? 'living', to.room, to), path = [];
    let at = from;
    for (const leg of legs) { const part = findRoute(at, leg, colliders, BOUNDS); if (part.length) path.push(...part); else path.push({ x: leg.x, z: leg.z }); at = leg; }
    m.path = path;
  }
  function assign(first) {
    const hour = world.state?.time ?? 12, ids = assignHangouts(order.map(m => ({ child: m.p.child })), Math.max(0, phase), hour, usable);
    order.forEach((m, i) => {
      const h = hangout(ids[i]); if (!h) return;
      if (first || !m.spot) { place(m, h); return; }
      if (h !== m.spot) { m.from = m.spot; m.spot = h; m.path = null; m.wait = .4 + i * 2.2; }
    });
  }

  /**
   * interior.mjs calls this on every rebuild: makes (or keeps) the residents' avatars, gives each a target and a label
   * that follow them, and checks which hangouts the furniture leaves free.
   */
  function sync({ houseId: id, residents = [], colliders: cols = [], hotspots = [], state = null } = {}) {
    if (id !== houseId) { drop(); houseId = id; }
    colliders = cols; usable = usableHangouts(cols);
    const fresh = !members.size;
    for (const [i, p] of residents.entries()) {
      let m = members.get(p.id);
      if (!m) {
        const wants = outfitOf(p, state?.pandora === true, state), avatar = buildAvatar(world, wants); // at home the family wears what they wear in the village: the everyday outfit, and the adventure outfit while the box is open
        avatar.scale.multiplyScalar(p.child ? .57 : .79); avatar.userData.persist = true; avatar.name = 'resident-' + p.id;
        const parts = avatar.userData.parts, h = p.child ? 1.55 : 2.15;
        m = { p, avatar, parts, hip: parts.leg_l.position.y * avatar.scale.y, height: h, gait: newGait(), spot: null, from: null, path: [], seat: 0, wait: 0, seed: i * 1.7, shirt: outfitKey(wants), target: null, box: { x0: 0, x1: 0, y0: 0, y1: h, z0: 0, z1: 0 } };
        members.set(p.id, m); order.push(m);
      }
      const wants = outfitOf(p, state?.pandora === true, state), key = outfitKey(wants);
      if (key !== m.shirt) { // Pip's outfit is a real garment (wm-kids.glb): she is built again in it, in the same place
        m.shirt = key; m.avatar = reclothe(world, m.avatar, wants); m.parts = m.avatar.userData.parts;
        if (m.avatar.userData.pending) avatarAssets(world, wants)?.then(() => { m.shirt = ''; world.buildInterior?.(); });
      }
      world.inside.add(m.avatar);
    }
    for (const [key, m] of [...members]) if (!residents.some(p => p.id === key)) { m.avatar.removeFromParent(); disposeAvatar(m.avatar); members.delete(key); order.splice(order.indexOf(m), 1); }
    if (fresh) { phase = Math.floor(clock / STAY_SECONDS); assign(true); }
    for (const m of order) {
      // A decoration now stands on the spot, or the furniture moved: find a free hangout, plan the way again.
      if (!m.spot || !usable.includes(m.spot.id)) { const ids = usable.filter(u => !order.some(o => o !== m && o.spot?.id === u)); const h = hangout(ids[0]); if (h) place(m, h); }
      else if (m.path?.length) m.path = null;
      const a = m.avatar;
      m.target = world.target('person', m.p.id, `Talk to ${m.p.name}`, a.position.x, a.position.z, 1.1, world.inside);
      follow(m); hotspots.push({ target: m.target, icon: '💬', text: m.p.name, box: m.box, person: true });
    }
    return order;
  }
  /** The target, its hit box and the label's box go where the person is. */
  function follow(m) {
    const a = m.avatar, t = m.target, x = a.position.x, z = a.position.z; if (!t) return;
    t.x = x; t.z = z; t.hit.position.set(x, 1.1, z);
    const b = m.box; b.x0 = x - .4; b.x1 = x + .4; b.z0 = z - .4; b.z1 = z + .4; b.y0 = Math.max(0, a.position.y); b.y1 = a.position.y + m.height;
  }
  function step(m, dt, t) {
    const a = m.avatar, p = m.parts, h = m.spot; if (!h) return;
    if (m.path === null) plan(m);
    const walking = m.path.length > 0;
    let moved = 0;
    if (walking && (m.wait > 0 || m.seat > 0)) {
      // Not off yet: a moment longer in the old pose, then up from the seat.
      const next = m.spot; m.spot = m.from ?? next;
      if (m.wait > 0) m.wait -= dt; else { m.seat = Math.max(0, m.seat - dt * 2.4); seat(m); if (m.seat === 0) a.position.y = 0; }
      pose(m, t + m.seed); m.spot = next;
    } else if (walking) {
      const goal = m.path[0], dx = goal.x - a.position.x, dz = goal.z - a.position.z, d = Math.hypot(dx, dz);
      if (d < .06) m.path.shift();
      else { moved = Math.min(d, dt * (m.p.child ? 1.7 : 1.5)); a.position.x += dx / d * moved; a.position.z += dz / d * moved; a.rotation.y = turn(a.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 9)); }
      p.arm_r.rotation.set(0, 0, .1); p.arm_l.rotation.set(0, 0, -.1); p.leg_l.rotation.x = 0; p.leg_r.rotation.x = 0; p.body.rotation.x = 0; p.head.rotation.set(0, 0, 0);
      a.position.y = walkAvatar(a, m.gait, moved, dt); // the body rides on the lower foot
    } else {
      if (h.seat && m.seat < 1) { m.seat = Math.min(1, m.seat + dt * 2.4); seat(m); }
      a.rotation.y = turn(a.rotation.y, h.pose === 'stand' ? h.facing + Math.sin(t * .4 + m.seed) * .3 : h.facing, Math.min(1, dt * 6));
      pose(m, t + m.seed);
      if (!h.seat) a.position.y = walkAvatar(a, m.gait, 0, dt, false); // the last steps fade out under the pose
    }
    follow(m);
  }
  const settled = m => m.spot && m.path && !m.path.length && (!m.spot.seat || m.seat >= 1);
  function say(m, text) { bubble.textContent = text; bubble.style.visibility = 'hidden'; bubble.hidden = false; chatWho = m; chatLeft = 3.6; bubbleAt = -2; } // shown once it is placed (the next frame)
  function chatter(dt) {
    if (chatLeft > 0) {
      chatLeft -= dt;
      if (chatLeft <= 0 || !chatWho || !members.has(chatWho.p.id)) { bubble.hidden = true; chatWho = null; return; }
      const a = chatWho.avatar; v.set(a.position.x, a.position.y + chatWho.height + .62, a.position.z).project(view.camera);
      const x = Math.round((v.x + 1) / 2 * innerWidth), y = Math.round((1 - v.y) / 2 * innerHeight);
      // The style is written only when the bubble moves a whole pixel (-1: off the screen, hidden).
      const at = v.z > 1 || x < 96 || x > innerWidth - 96 || y < 70 ? -1 : x * 8192 + y;
      if (at !== bubbleAt) { bubbleAt = at; bubble.style.visibility = at < 0 ? 'hidden' : ''; if (at >= 0) bubble.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`; }
    } else if (queue.length) { const next = queue.shift(); say(next.who, next.text); }
    else if ((chatClock -= dt) <= 0) {
      chatClock = 6 + Math.random() * 5;
      let n = 0; for (const m of order) if (settled(m)) n++;
      if (!n) return;
      let k = Math.floor(Math.random() * n), pick = null; for (const m of order) if (settled(m) && k-- === 0) pick = m;
      if (!pick) return;
      const room = pick.spot.room; let mate = null; for (const m of order) if (m !== pick && settled(m) && m.spot.room === room) mate = m;
      const pair = mate && Math.random() < .4 ? exchangeFor(talk, room) : null;
      if (pair) { queue.push({ who: mate, text: pair[1] }); say(pick, pair[0]); }
      else say(pick, lineFor(talk, { id: pick.p.id, child: pick.p.child, room }));
    }
  }
  view.onFrame(() => {
    const now = performance.now(), dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
    if (world.location !== 'interior') { if (members.size) drop(); houseId = null; if (!bubble.hidden) bubble.hidden = true; return; }
    if (!order.length || world.paused) return;
    clock += dt;
    const ph = Math.floor(clock / STAY_SECONDS); if (ph !== phase) { phase = ph; assign(false); }
    for (let i = 0; i < order.length; i++) step(order[i], dt, clock);
    frameDt = dt;
  });
  // The bubble is placed after the frame is drawn: only then is the room's camera aimed (room-view.mjs).
  view.onAfter(() => { if (world.location === 'interior' && order.length && !world.paused) { chatter(frameDt); frameDt = 0; } });

  // ---- the things to use: a rest restores energy and cools down; toys and keepsakes answer with their line
  const interact = world.onInteract;
  world.onInteract = t => {
    const a = t?.type === 'fun' ? ACTIVITIES[t.activity] : null;
    if (!a || world.houseId !== 0 || world.paused || world.__decorPlacing) return interact(t);
    if (a.kind === 'log') { deps.openPanel?.('collection'); return; }
    if (a.kind === 'fun') { deps.toast?.(`${a.icon} ${a.line}`); world.burst?.('#ffe39a'); return; }
    const r = deps.act?.('houseUse', { id: a.id });
    if (r?.ok) world.burst?.(a.kind === 'paint' ? '#ffb3c7' : '#ffe39a');
  };
  return world.__houseLife = { sync, members, drop, get phase() { return phase; }, get usable() { return usable; } };
}
