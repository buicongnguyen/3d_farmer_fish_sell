// The Pandora box in the game: the chest in your home with its Open / Close panel, and, while it is open, the wilds
// beyond the village: creatures (wilds.mjs, drawn by wilds-view.mjs), fights (combat.mjs), feedback (combat-fx.mjs), the
// fight HUD (combat-hud.mjs), loot on the ground, healing and the gentle knock-out (pandora.mjs).
//
//   const pandora = installPandora(world, {state, act, toast, persist, hud, openPanel, closePanel, panel})
//     state()            the current game state            act(type, arg)     main.mjs runAction (toast, save, sync)
//     openPanel(name)    main.mjs openPanel                 panel()            the open panel's name, or null
//   pandora.panel(name)  -> {title, kicker, html, cls} for main.mjs renderPanel ('pandora' and 'knockout')
//
// World stays untouched: like decor-view.mjs and room-view.mjs this module wraps what it needs (update, click, nearest,
// onInteract, buildInterior) and draws through room-view's per-frame hook. With the box shut it costs a few comparisons
// a frame: no creature file is fetched, nothing joins the outdoor scene (the creatures, effects, loot and the ward are
// mounted the first time the box is opened) and the fight HUD is not shown.
//
// Controls (W walks and E interacts in Willowmere, so the reference's Q/W/E skills sit on 1/2/3): tap a creature to walk
// up and fight it; F swings; E / ACT attacks when a creature is in reach; 1, 2, 3 are Whirlwind, Dash and Ground slam.
// Fighting is for the fields: the moves exist only beyond the village footprint, and inside the ward no creature can
// reach you (one that follows you there gives up, walks home and heals). Creatures ignore a driver; step out of the jeep
// or off the motorcycle to fight.
import './pandora.css';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { act } from './game.mjs';
import { HOUSES, ITEMS, CROPS, iconUrl } from './content.mjs';
import * as plan from './home-plan.mjs';
import { installRoomView } from './room-view.mjs';
import { toon } from './toon.mjs';
import { GEAR, weaponOf } from './gear.mjs';
import { pandoraOpen, hpOf, hurt, recover, combatStats, rollLoot, MERCY, TEST } from './pandora.mjs';
import {
  Wilds,
  STEP,
  MAX_STEPS,
  SAFE,
  AI,
  inSafeZone,
  aggro,
} from './wilds.mjs';
import { REGION, regionAt, inWilds } from './regions.mjs';
import { Combat, Drops, DROP, attackRange, dropVisible } from './combat.mjs';
import { WildsView, VIEW } from './wilds-view.mjs';
import { shadowReach, cellRadius } from './creature-lod.mjs';
import { CombatFx } from './combat-fx.mjs';
import { CombatHud, pandoraPanel, knockoutPanel, statsStripHtml } from './combat-hud.mjs';

export const BOX_FILE = './assets/models/pandora-box.glb';
/** The chest is drawn a little larger than the house kit's scale, so it reads from the dollhouse camera. Footprint and height in metres. */
const K = plan.K, BOX_SCALE = K * 1.3, BOX = { w: .7 * BOX_SCALE, d: .52 * BOX_SCALE, h: .88 * BOX_SCALE };
/**
 * The chest stands on the place home-plan.mjs keeps for it (PANDORA_SPOT {x, z, rot, body, stand}: against the living
 * room's low back wall, between the doorways, facing the camera, in view the moment you step in, on phones too). The
 * plan keeps decorations off it and already counts the chest as a collider. BOX_SPOTS is only the fallback for a plan
 * without that export: the first spot no furniture or decoration takes.
 */
const BOX_SPOTS = [{ x: -1.7, z: -1.42, rot: 0 }, { x: 2.15, z: -1.36, rot: 0 }, { x: -8.9, z: 2.6, rot: .5 }, { x: 2.6, z: 7.6, rot: Math.PI - .5 }, { x: -2.9, z: 7.6, rot: Math.PI + .5 }];
const reservedSpot = () => plan.PANDORA_SPOT ?? null;
const NONE = [], HURT_CHIPS = ['#ff7b6b', '#ffffff'], DIRT = ['#b98a5e', '#8b5a36', '#d9b58a'], SPARK = ['#ffffff', '#fff7a8'], MOVE_KEYS = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
const v3 = new T.Vector3();
// Hot loops use plain indexed loops and this instead of for-of and Math.hypot: neither makes garbage in any JIT tier.
const len = (x, z) => Math.sqrt(x * x + z * z);

/** A kit node as one vertex-coloured geometry in its own space (material colours baked in). */
function bakeNode(node) {
  node.updateMatrixWorld(true); const inverse = node.matrixWorld.clone().invert(), pieces = [];
  node.traverse(m => {
    if (!m.isMesh) return;
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); for (const key of Object.keys(g.attributes)) if (key !== 'position' && key !== 'normal') g.deleteAttribute(key);
    g.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse, m.matrixWorld));
    const c = m.material.color ?? new T.Color('#ffffff'), n = g.getAttribute('position').count, colors = new Float32Array(n * 3); for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new T.BufferAttribute(colors, 3)); pieces.push(g);
  });
  const merged = mergeGeometries(pieces, false); pieces.forEach(p => p.dispose()); return merged;
}

export function installPandora(world, deps) {
  if (world.__pandora) return world.__pandora;
  const app = document.getElementById('app') ?? document.body, room = installRoomView(world);
  const state = () => deps.state();
  const hud = new CombatHud(app), fx = new CombatFx(hud.floats), view = new WildsView(world), drops = new Drops();
  const hero = { x: 0, z: 0, active: false }, pet = { x: 0, z: 0, dmg: 0, cd: 0, shot: '' }; // what the creatures see of the player; the worn pet
  let stats = combatStats(state()), statsAge = 0;
  let selected = null, approach = false, lastHit = null, lastHitAt = -99, reroute = 0;
  let mercy = 0, punch = 0, punchArm = 0, swing = 'fist', aim = 0, spin = 0, leaned = false, armsOut = false, blinked = false;
  let acc = 0, time = 0, lastT = world.t, wasOpen = null, lastLoss = 0, dirty = 0, foeShown = false, released = true, warmed = false, cellSpan = 2; // cellSpan: cells each way round the player (creature-lod.mjs cellRadius)
  const chips = new Map(); const chipsOf = e => { let c = chips.get(e.type); if (!c) chips.set(e.type, c = [e.def.color, e.def.accent, '#ffffff']); return c; };

  // ---------------------------------------------------------------- trees, without making garbage
  // World keeps its trees in a grid with string keys; the creatures ask "is a trunk here?" many times a step, so the same
  // trees are mirrored into a grid with number keys.
  const grid = new Map(), cellKey = (x, z) => (Math.floor(x / 8) + 4096) * 8192 + Math.floor(z / 8) + 4096;
  const addTree = t => { const k = cellKey(t.x, t.z); let list = grid.get(k); if (!list) grid.set(k, list = []); list.push(t); };
  for (const list of world.treeGrid?.values() ?? []) list.forEach(addTree);
  const addBlock = world.addTreeBlock.bind(world), removeBlock = world.removeTreeBlock.bind(world);
  world.addTreeBlock = t => { const out = addBlock(t); addTree(t); return out; };
  world.removeTreeBlock = t => { const list = grid.get(cellKey(t.x, t.z)); if (list) { const i = list.indexOf(t); if (i >= 0) list.splice(i, 1); if (!list.length) grid.delete(cellKey(t.x, t.z)); } return removeBlock(t); };
  function treeAt(x, z, pad = .3) {
    const cx = Math.floor(x / 8) + 4096, cz = Math.floor(z / 8) + 4096;
    for (let i = cx - 1; i <= cx + 1; i++) for (let k = cz - 1; k <= cz + 1; k++) { const list = grid.get(i * 8192 + k); if (list) for (let n = 0; n < list.length; n++) { const t = list[n]; if (len(x - t.x, z - t.z) < t.r + pad) return true; } }
    return false;
  }

  // ---------------------------------------------------------------- the simulations
  // The host of the creature simulation. pull: a titan's pull moves the player through world.push; noGo: a lit lamp's disc in
  // the Night Land (land-view.mjs world.lands, installed after this file) is a place no creature enters.
  const wilds = new Wilds({ blocked: (x, z) => treeAt(x, z, .35), hurt: onHurt, emit: onEvent, pull: (dx, dz) => world.push(dx, dz), noGo: (x, z) => world.lands?.lampAt(x, z) ?? false });
  const here = () => world.player.position;
  const fighting = () => pandoraOpen(state()) && world.location === 'village' && !world.riding && inWilds(here().x, here().z) && state().hp > 0;
  const combat = new Combat({
    position: here, facing: () => world.player.rotation.y, face: a => { world.player.rotation.y = a; },
    targets: () => hero.active ? wilds.list : NONE,
    weapon: () => weaponOf(state()), stats: () => stats, cooldownScale: () => state().settings.test ? TEST.cooldown : 1,
    move: movePlayer, hit: onHit, effect: onEffect, shotBlocked: (x, z) => treeAt(x, z, .1),
    // A worn pet (gear.mjs `pet: {dmg, cd, shot}`) shoots from where the avatar module keeps it (world.companion), else from your side.
    pet: () => { const g = GEAR[state().gear?.pet]?.pet; if (!g || !fighting()) return null; const at = world.companion?.visible ? world.companion.position : here(); pet.x = at.x; pet.z = at.z; pet.dmg = g.dmg; pet.cd = g.cd; pet.shot = g.shot ?? 'fire'; return pet; },
  });
  /** A dash moves the player in short hops so it cannot tunnel through a tree. */
  function movePlayer(dx, dz) {
    const p = here(), n = Math.max(1, Math.ceil(len(dx, dz) / .3));
    for (let i = 0; i < n; i++) { const x = p.x + dx / n, z = p.z + dz / n; if (!world.blocked(x, p.z)) p.x = x; if (!world.blocked(p.x, z)) p.z = z; }
  }
  /** Your blow lands: numbers, chips in the creature's colours, a ring, a kick of the camera, a short hold on a crit. */
  function onHit(e, amount, critical, stun, lift, knock, dx, dz) {
    const dealt = wilds.hit(e, amount, stun, lift, knock, dx, dz); if (!dealt) return;
    lastHit = e; lastHitAt = time;
    const p = here(), tx = p.x - e.x, tz = p.z - e.z, d = len(tx, tz) || 1, reach = Math.min(e.radius * .8, d * .5), chest = e.lift + (e.def.flying ? 1.4 : .8) * (e.def.boss ? 1.85 : 1), cx = e.x + tx / d * reach, cz = e.z + tz / d * reach;
    fx.burst(cx, chest, cz, critical ? 12 : 7, chipsOf(e), 5, 4, .13, .7); fx.burst(cx, chest, cz, critical ? 8 : 4, SPARK, critical ? 7 : 4.5, 3, .12, .35, true);
    fx.ring(e.x, e.z, critical ? 1.6 : 1.1, critical ? '#ffe14d' : '#ffffff', .2, .2, chest);
    fx.text(e.x, view.top(e), e.z, critical ? dealt + '!' : String(dealt), critical ? 'crit' : 'dmg');
    fx.play(critical ? 'crit' : 'hit'); fx.kick(dx, dz, critical ? .22 : .1); fx.freeze(critical ? .07 : .035);
    if (e.hp <= 0) defeat(e);
  }
  /** A creature falls: a puff, its coins fly to you, its loot is tossed on the ground. */
  function defeat(e) {
    const boss = e.def.boss, top = view.top(e);
    fx.burst(e.x, .6, e.z, boss ? 40 : 16, chipsOf(e), 6, 6, .17, .9); fx.burst(e.x, .8, e.z, boss ? 24 : 9, SPARK, 4, 5, .18, .7, true);
    fx.ring(e.x, e.z, boss ? 4 : 2.5, '#ffffff', .45); fx.freeze(boss ? .16 : .09); if (boss) fx.shake(.5); fx.play('poof');
    const win = act(state(), 'defeat', { type: e.type });
    if (win.ok) { fx.orbs(e.x, e.z, Math.min(8, 3 + Math.floor(win.coins / 12)), '#ffd84d', () => fx.play('coin')); fx.text(e.x, top + .4, e.z, `+${win.coins} coins`, 'coin'); }
    for (const loot of rollLoot(e.type)) drops.spawn(loot.id, loot.count, e.x, e.z);
    if (selected === e) { selected = null; approach = false; }
    dirty = 1; if (boss) deps.toast('The King Bear is down! The far fields breathe a little easier.');
  }
  /** A creature's blow lands on you. */
  function onHurt(amount) {
    if (mercy > 0 || combat.invulnerable) return;
    const r = hurt(state(), amount); if (!r.damage) return;
    const p = here(); mercy = MERCY;
    for (let i = 0; i < hurtHooks.length; i++) hurtHooks[i](r.damage, 'creature');
    fx.text(p.x, 2.1, p.z, '-' + r.damage, 'hurt'); fx.shake(Math.min(.4, .15 + r.damage / 60)); fx.burst(p.x, .9, p.z, 6, HURT_CHIPS, 4, 3, .1, .6); fx.play('hurt'); hud.hurt(); navigator.vibrate?.(60);
    if (r.out) knockOut();
  }
  /**
   * The land itself hurts you (world.pandora.hurtFraction; builder B's pools, poison, thorns, trains and lightning call it):
   * `share` of your full health, through the same defence as a blow, with the hurt effect and a toast naming the cause at most
   * every three seconds. No mercy time: a pool ticks twice a second. Nothing happens with the box shut. Returns the damage.
   * The trophy traits (lavaproof drops 'lava' and 'fire', antidote drops 'poison' and 'thorn') are builder D's filter.
   */
  const HURT_LINES = { lava: 'The lava burns!', fire: 'Fire! Get clear!', poison: 'Poison stings. Step out of it!', thorn: 'Thorns!', train: 'A toy train bumps you along!', bolt: 'Lightning!' };
  const hurtHooks = []; let landToast = -99;
  function hurtFraction(share, source = '') {
    if (!(share > 0) || combat.invulnerable) return 0;
    const r = hurt(state(), share * stats.maxHp); if (!r.damage) return 0;
    const p = here();
    fx.text(p.x, 2.1, p.z, '-' + r.damage, 'hurt'); fx.shake(Math.min(.3, .1 + r.damage / 80)); fx.play('hurt'); hud.hurt();
    if (HURT_LINES[source] && time - landToast > 3) { landToast = time; deps.toast(HURT_LINES[source]); }
    for (let i = 0; i < hurtHooks.length; i++) hurtHooks[i](r.damage, source);
    if (r.out) knockOut();
    return r.damage;
  }
  /** Knocked out: you wake at home, rested, with the door behind you leading back to your own yard. */
  function knockOut() {
    const s = state(), h = HOUSES[0], result = act(s, 'knockout'); lastLoss = result.loss ?? 0;
    combat.reset(); selected = null; approach = false; mercy = 0; acc = 0; fx.clear();
    world.clearMovement(); world.player.position.set(h.x, 0, h.z + 5); s.position = { x: h.x, z: h.z + 5 }; world.enterHouse(0);
    deps.persist(); deps.hud(); deps.openPanel('knockout');
  }
  function onEvent(kind, e) {
    if (kind === 'retire') { if (selected === e) { selected = null; approach = false; } if (lastHit === e) lastHit = null; view.detach(e); return; }
    if (kind === 'spawn') return; // its model is made when the view comes near (wilds-view.mjs update)
    const near = len(e.x - here().x, e.z - here().z) < 24;
    if (kind === 'alert' && near) { fx.text(e.x, view.top(e) + .2, e.z, '!', 'alert'); fx.play('alert'); }
    else if (kind === 'respawn' && near) fx.burst(e.x, .5, e.z, 12, chipsOf(e), 3, 5, .13, .7);
    else if (kind === 'leave') fx.burst(e.x, .6, e.z, 6, SPARK, 2.5, 4, .16, .6, true);
    else if (kind === 'strike' && e.slam && near) { fx.shake(.45); fx.ring(e.x, e.z, AI.slamRadius, '#ffb347', .45); fx.burst(e.x, .2, e.z, 18, DIRT, 6, 6, .17, .9); fx.play('boom'); }
  }
  /** Skill and swing effects from the combat simulation. */
  const casts = [{ life: 0, span: 1, x: 0, z: 0, r: 1 }, { life: 0, span: 1, x: 0, z: 0, r: 1 }];
  function onEffect(kind, x, z, radius, facing, extra) {
    if (kind === 'arc') fx.slash(x, z, facing, radius * 1.05, weaponOf(state()).fx ?? (swing === 'sword' ? '#fff4c8' : '#ffffff'));
    else if (kind === 'ring') fx.ring(x, z, radius, '#e5f6ff', .3, radius * .3);
    else if (kind === 'cast') { const c = casts[0].life <= 0 ? casts[0] : casts[1]; c.life = c.span = extra || .5; c.x = x; c.z = z; c.r = radius; }
    else if (kind === 'trail') fx.burst(x, .5, z, 2, '#e9fbff', 1.2, 1, .14, .3, true);
    else if (kind === 'impact') fx.burst(x, 1, z, 5, '#c4ec9f', 3, 2, .1, .4);
    else if (kind === 'slam') { fx.shake(.7); fx.ring(x, z, radius + .2, '#fff3c4', .45); fx.ring(x, z, radius * .8, '#ffb347', .6); fx.burst(x, .2, z, 26, DIRT, 7, 7, .18, 1.1); fx.burst(x, .4, z, 14, '#ffffff', 8, 3, .12, .5, true); fx.play('boom'); navigator.vibrate?.(80); }
  }

  // ---------------------------------------------------------------- the player's moves
  function attack(target) {
    if (!fighting() || world.paused) return false;
    const kind = combat.basic(target ?? selected ?? undefined); if (!kind) return false;
    swing = kind;
    if (kind === 'gun') { aim = .35; const p = here(), f = world.player.rotation.y; fx.burst(p.x + Math.sin(f) * .9, 1.2, p.z + Math.cos(f) * .9, 3, '#fff8c8', 2, 1, .2, .12, true); fx.play('shoot'); }
    else { punch = .25; if (kind !== 'sword') punchArm ^= 1; fx.play(kind === 'sword' ? 'swing' : 'punch'); }
    return true;
  }
  function cast(index) {
    if (!fighting() || world.paused || !combat.skill(index)) return false;
    const p = here();
    if (index === 0) { spin = 2.2; fx.play('whirl'); } else if (index === 1) { fx.burst(p.x, .1, p.z, 10, '#f3e2bd', 3, 2, .14, .5); fx.play('swing'); } else fx.play('punch');
    return true;
  }
  const select = (e, walk) => { selected = e; approach = walk; reroute = 0; lastHit = e; lastHitAt = time; };
  /** The creature a press of E / ACT would hit: the selected one, else the nearest, within reach and a little more. */
  function reachable() {
    const p = here(), weapon = weaponOf(state()); let best = null, bestD = Infinity;
    for (let i = 0; i < wilds.list.length; i++) {
      const e = wilds.list[i]; if (!(e.hp > 0) || e.leaving > 0) continue;
      const d = len(e.x - p.x, e.z - p.z) - attackRange(weapon, e.radius); if (d > .6) continue;
      if (e === selected) return e; if (d < bestD) { best = e; bestD = d; }
    }
    return best;
  }
  /** Each frame: keep fighting the selected creature (walk in when it was tapped), answer a creature that is on you. */
  function drive(dt) {
    const p = here(), weapon = weaponOf(state());
    if (selected && (!(selected.hp > 0) || selected.leaving > 0 || selected.gone || len(selected.x - p.x, selected.z - p.z) > 28)) { selected = null; approach = false; }
    let manual = len(world.stick.x, world.stick.y) > .05; for (let i = 0; !manual && i < MOVE_KEYS.length; i++) manual = world.keys.has(MOVE_KEYS[i]);
    if (manual) approach = false;
    if (!selected && !manual && !world.path.length) for (let i = 0; i < wilds.awake.length; i++) { const e = wilds.awake[i]; if (aggro(e) && len(e.x - p.x, e.z - p.z) <= attackRange(weapon, e.radius)) { select(e, false); break; } }
    if (!selected || combat.locksMovement) return;
    const d = len(selected.x - p.x, selected.z - p.z), range = attackRange(weapon, selected.radius);
    if (d <= range) { if (approach && world.path.length) world.path.length = 0; if (!manual) attack(selected); }
    else if (approach && (reroute -= dt) <= 0) { // walk to just inside reach; the creature moves, so the route is renewed
      reroute = .3; world.pending = null; const stop = Math.max(.6, range * .8), tx = selected.x + (p.x - selected.x) / d * stop, tz = selected.z + (p.z - selected.z) / d * stop;
      if (!world.routeTo(tx, tz)) world.path = [{ x: tx, z: tz }];
    }
  }
  /** Loot reaches the player. */
  function onPick(d) {
    const got = act(state(), 'pickup', { id: d.item, count: d.count }); if (!got.ok) return;
    const p = here(); fx.text(p.x, 2.2, p.z, got.message, 'item'); fx.play('pickup'); dirty = 1;
    if (got.gear) { deps.toast(`${got.message} Wear it from the wardrobe at home.`); world.burst?.('#ffe39a'); }
  }

  // ---------------------------------------------------------------- the step (wraps World.update)
  function simulate(dt) {
    const s = state(), open = pandoraOpen(s), village = world.location === 'village', p = here();
    if (village || !open) wilds.sync(open, p.x, p.z, cellSpan);
    if (!open) { if (wilds.list.length) wilds.step(dt, null); else if (!released) { released = true; view.release(); } return; }
    released = false;
    if (world.paused) return;
    if ((statsAge -= dt) <= 0) { statsAge = .5; stats = combatStats(s); }
    if (s.hp < stats.maxHp) recover(s, dt, world.location === 'interior' && world.houseId === 0 ? 'home' : !village || inSafeZone(p.x, p.z) ? 'village' : 'wild', stats);
    mercy = Math.max(0, mercy - dt); punch = Math.max(0, punch - dt); aim = Math.max(0, aim - dt); spin = Math.max(0, spin - dt);
    if (!village) return;
    hero.x = p.x; hero.z = p.z; hero.active = !world.riding && s.hp > 0;
    if (hero.active) drive(dt);
    // Hit-stop holds the fight (creatures, blows, shots) for a few hundredths of a second; the camera and the HUD go on.
    if (fx.frozen > 0) fx.frozen -= dt;
    else {
      acc = Math.min(acc + dt, STEP * MAX_STEPS);
      while (acc >= STEP - 1e-9) { acc -= STEP; time += STEP; combat.update(STEP); wilds.step(STEP, hero); if (world.location !== 'village' || world.paused || fx.frozen > 0) { acc = 0; break; } }
    }
    if (world.location === 'village') drops.step(dt, hero.active ? p : null, onPick);
    if (dirty > 0 && (dirty -= dt) <= 0) deps.persist();
  }
  const update = world.update.bind(world), noKeys = new Set(), noStick = { x: 0, y: 0 }, noPath = [];
  world.update = dt => {
    if (world.ready) simulate(dt);
    if (combat.locksMovement && !world.paused && world.location === 'village') { // a dash or a slam owns the feet
      const keys = world.keys, stick = world.stick, path = world.path; world.keys = noKeys; world.stick = noStick; world.path = noPath; noPath.length = 0;
      try { update(dt); } finally { world.keys = keys; world.stick = stick; world.path = path; }
      return;
    }
    // Worn gear's speed (boots, light outfits) counts while the box is open: this frame's own walk is stretched by it.
    const boost = world.ready && !world.paused && !world.riding && world.location === 'village' && stats.speed !== 1 && pandoraOpen(state()), from = boost ? world.player.position : null, fromX = from?.x, fromZ = from?.z;
    update(dt);
    if (boost && world.location === 'village') {
      const p = world.player.position, k = stats.speed - 1, dx = (p.x - fromX) * k, dz = (p.z - fromZ) * k;
      if ((dx || dz) && Math.abs(dx) + Math.abs(dz) < 1) { if (!world.blocked(p.x + dx, p.z)) p.x += dx; if (!world.blocked(p.x, p.z + dz)) p.z += dz; }
    }
  };

  // ---------------------------------------------------------------- taps, E / ACT and keys
  /** The creature under a tap: the nearest one whose circle (at least 44 px) holds the point. */
  function pick(cx, cy) {
    const cam = world.camera, ppm = innerHeight / Math.max(1, cam.top - cam.bottom); let best = null, bestD = Infinity;
    for (const e of wilds.list) {
      if (!(e.hp > 0) || e.leaving > 0 || !e.view?.visible) continue;
      v3.set(e.x, e.lift + view.top(e) * .45, e.z).project(cam);
      const d = len((v3.x + 1) * innerWidth / 2 - cx, (1 - v3.y) * innerHeight / 2 - cy), r = Math.max(44, (e.radius + .5) * e.def.scale * ppm * 1.3);
      if (d < r && d < bestD) { best = e; bestD = d; }
    }
    return best;
  }
  const click = world.click.bind(world);
  world.click = e => {
    if (pandoraOpen(state()) && world.location === 'village' && !world.riding) {
      const hit = pick(e.clientX, e.clientY);
      if (hit) { select(hit, true); world.pending = null; fx.ring(hit.x, hit.z, view.footprint(hit) * 1.5, '#ff5a5a', .3, view.footprint(hit) * .6); return; }
      if (selected) { selected = null; approach = false; }
    }
    return click(e);
  };
  const nearest = world.nearest.bind(world), foe = { type: 'creature', id: '', label: '', x: 0, z: 0, r: 4, creature: null };
  world.nearest = () => {
    foeShown = false; if (!fighting()) return nearest();
    const e = reachable(); if (!e) return nearest();
    if (foe.creature !== e) { foe.creature = e; foe.id = e.id; foe.label = `Attack · ${e.def.name}`; }
    foe.x = e.x; foe.z = e.z; foeShown = true; return foe;
  };
  const interact = world.onInteract;
  world.onInteract = t => {
    if (t?.type === 'creature') { if (t.creature?.hp > 0) { select(t.creature, false); attack(t.creature); } return; }
    if (t?.type === 'pandora') { if (!world.paused) deps.openPanel('pandora'); return; }
    return interact(t);
  };
  /** Why a fighting key does nothing here, said once in a while (never when the box is shut: then the keys are not the game's). */
  let hintAt = -Infinity;
  function whyNot() {
    const now = performance.now(); if (now - hintAt < 8000) return; hintAt = now;
    deps.toast(world.riding ? 'Step out of the vehicle to fight.' : world.location === 'village' ? 'The village is safe: nothing to fight here. Creatures roam beyond the glowing ward.'
      : world.location === 'interior' ? 'Nothing to fight indoors. Creatures roam the fields beyond the village.' : 'Nothing to fight at the market. Creatures roam the fields round Willowmere.');
  }
  document.addEventListener('keydown', e => {
    if (world.paused || e.ctrlKey || e.metaKey || e.altKey || e.repeat && !fighting()) return;
    const k = e.key.toLowerCase(), key = k === 'f' || k === '1' || k === '2' || k === '3'; if (!key) return;
    const tag = e.target?.tagName; if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (!fighting()) { if (pandoraOpen(state()) && state().hp > 0) whyNot(); return; }
    if (k === 'f') { e.preventDefault(); attack(); } else if (!e.repeat) { e.preventDefault(); cast(Number(k) - 1); }
  });
  hud.pad.addEventListener('pointerdown', e => {
    const b = e.target.closest('[data-combat]'); if (!b) return; e.preventDefault();
    if (world.riding) { deps.toast('Step out of the vehicle to fight.'); return; }
    if (b.dataset.combat === 'attack') attack(); else if (!cast(Number(b.dataset.index)) && combat.cooldowns[Number(b.dataset.index)] > 0) fx.play('ready');
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-action="pandora-set"]'); if (!b || b.disabled) return;
    const open = b.dataset.open === 'true'; if (open === pandoraOpen(state())) return;
    if (world.location !== 'interior' || world.houseId !== 0) { deps.toast('The Pandora box is at home, in your living room.'); return; }
    if (deps.act('pandora', { open }).ok) world.burst?.(open ? '#ff9cf5' : '#ffe39a');
  });
  // The stats strip (❤️ ⚔️ 🛡️) in the bag and the wardrobe while the box is open; gone when it is shut.
  const modal = document.getElementById('modal');
  if (modal) new MutationObserver(() => {
    const name = deps.panel?.(); if (!name || !pandoraOpen(state()) || modal.querySelector('.gear-stats, .stat-strip')) return; // a panel that brings its own strip keeps it
    const wardrobe = /wardrobe|gear|mirror/.test(name) || /wardrobe/.test(modal.className) || name === 'shop' && !!modal.querySelector('.tabs .active[data-id="outfits"]');
    if (name === 'bag' || wardrobe) (modal.querySelector('.modal-content') ?? modal).insertAdjacentHTML('afterbegin', statsStripHtml(state()));
  }).observe(modal, { childList: true });

  // ---------------------------------------------------------------- loot on the ground: one sprite per drop, pooled
  const dropRoot = new T.Group(); dropRoot.name = 'wild-drops';
  const dropMaterials = new Map(), loader = new T.TextureLoader();
  const dropMaterial = id => {
    let m = dropMaterials.get(id);
    if (!m) { const icon = ITEMS[id]?.icon ?? GEAR[id]?.icon ?? CROPS[id.slice(5)]?.icon, map = icon ? loader.load(iconUrl(icon)) : null; if (map) map.colorSpace = T.SRGBColorSpace; dropMaterials.set(id, m = new T.SpriteMaterial({ map, color: map ? '#ffffff' : '#ffd84d', toneMapped: false, fog: false })); }
    return m;
  };
  const dropSprites = drops.pool.map(() => { const s = new T.Sprite(); s.visible = false; s.raycast = () => {}; dropRoot.add(s); return s; });

  // ---------------------------------------------------------------- the ward at the village edge (the sign that the box is open)
  let ward = null;
  function buildWard() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d'), fade = g.createLinearGradient(0, 64, 0, 0);
    fade.addColorStop(0, 'rgba(255,238,255,1)'); fade.addColorStop(.1, 'rgba(226,150,255,.9)'); fade.addColorStop(.42, 'rgba(170,90,255,.38)'); fade.addColorStop(1, 'rgba(160,80,255,0)'); g.fillStyle = fade; g.fillRect(0, 0, 128, 64);
    g.globalCompositeOperation = 'destination-in'; const dash = g.createLinearGradient(0, 0, 128, 0); for (let i = 0; i <= 8; i++) dash.addColorStop(i / 8, i % 2 ? 'rgba(0,0,0,.45)' : 'rgba(0,0,0,1)'); g.fillStyle = dash; g.fillRect(0, 0, 128, 64);
    const map = new T.CanvasTexture(c); map.wrapS = T.RepeatWrapping; map.colorSpace = T.SRGBColorSpace;
    const positions = [], uvs = [], index = [], corners = [[SAFE.x0, SAFE.z0], [SAFE.x1, SAFE.z0], [SAFE.x1, SAFE.z1], [SAFE.x0, SAFE.z1]];
    const quad = (a, b, c2, d, u0, u1) => { const n = positions.length / 3; positions.push(...a, ...b, ...c2, ...d); uvs.push(u0, 0, u1, 0, u1, 1, u0, 1); index.push(n, n + 1, n + 2, n, n + 2, n + 3); };
    for (let i = 0; i < 4; i++) {
      const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % 4], length = len(bx - ax, bz - az), u = length / 6, nx = (bz - az) / length, nz = -(bx - ax) / length; // outward
      quad([ax, .06, az], [bx, .06, bz], [bx, 2.6, bz], [ax, 2.6, az], 0, u);                                         // a curtain of light
      quad([ax, .07, az], [bx, .07, bz], [bx + nx * 1.6, .07, bz + nz * 1.6], [ax + nx * 1.6, .07, az + nz * 1.6], 0, u);   // its glow on the grass, outside
      quad([ax, .07, az], [bx, .07, bz], [bx - nx * 1.6, .07, bz - nz * 1.6], [ax - nx * 1.6, .07, az - nz * 1.6], 0, u);   // and inside
    }
    const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); geometry.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2)); geometry.setIndex(index);
    ward = new T.Mesh(geometry, new T.MeshBasicMaterial({ map, transparent: true, opacity: .8, depthWrite: false, side: T.DoubleSide, toneMapped: false, fog: false }));
    ward.name = 'pandora-ward'; ward.renderOrder = 4; ward.raycast = () => {}; ward.frustumCulled = false; ward.visible = false; world.outside.add(ward);
  }
  const FOG = { shut: world.fogBase?.clone() ?? world.scene.fog?.color.clone() ?? new T.Color('#bfe8ff'), open: new T.Color('#d6c4ff') }; // written to world.fogBase: World.applyLights is the one writer of the fog's colour

  // ---------------------------------------------------------------- the chest in your home
  const chest = { group: new T.Group(), lid: null, glow: null, inner: null, beam: null, loading: null, lift: 0, spot: null, target: null };
  chest.group.name = 'pandora-box';
  function loadChest() {
    return chest.loading ??= new GLTFLoader().loadAsync(BOX_FILE).then(gltf => {
      const solid = toon({ vertexColors: true }), part = name => gltf.scene.getObjectByName(name);
      const base = new T.Mesh(bakeNode(part('pandora_base')), solid); base.castShadow = base.receiveShadow = true;
      const lidNode = part('pandora_lid'); chest.lid = new T.Mesh(bakeNode(lidNode), solid); chest.lid.position.copy(lidNode.position); chest.lid.castShadow = true;
      chest.glow = new T.Mesh(bakeNode(part('pandora_glow')), new T.MeshBasicMaterial({ color: '#ffd9ff', toneMapped: false }));
      chest.inner = new T.Mesh(bakeNode(part('pandora_inner')), new T.MeshBasicMaterial({ color: '#fff3c4', toneMapped: false })); chest.inner.visible = false;
      // Light pouring out of the open chest: an open cone whose colour fades to nothing at the top (additive).
      const cone = new T.CylinderGeometry(.5, .2, 1.5, 20, 1, true); cone.translate(0, .75, 0); const y = cone.getAttribute('position'), shade = new Float32Array(y.count * 3);
      for (let i = 0; i < y.count; i++) shade.fill(Math.pow(1 - y.getY(i) / 1.5, 1.6), i * 3, i * 3 + 3); cone.setAttribute('color', new T.BufferAttribute(shade, 3));
      chest.beam = new T.Mesh(cone, new T.MeshBasicMaterial({ color: '#ffc8ff', vertexColors: true, transparent: true, opacity: .5, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, toneMapped: false })); chest.beam.position.y = .56; chest.beam.visible = false; chest.beam.renderOrder = 3;
      chest.group.add(base, chest.lid, chest.glow, chest.inner, chest.beam); chest.group.scale.setScalar(BOX_SCALE); chest.lift = pandoraOpen(state()) ? 1 : 0;
      gltf.scene.traverse(m => { if (m.isMesh) { m.geometry.dispose(); m.material.dispose?.(); } });
    }).catch(error => { console.error('The Pandora box could not load.', error); chest.loading = null; });
  }
  /** Puts the chest into your home after every rebuild of the room: the model, a collider, a target and a label chip. */
  function placeChest() {
    if (world.houseId !== 0) return;
    const taken = world.colliders.filter(c => c.location === 'interior');
    const free = s => { const turn = Math.abs(Math.sin(s.rot)), w = BOX.w + (BOX.d - BOX.w) * turn + .1, d = BOX.d + (BOX.w - BOX.d) * turn + .1; return !taken.some(c => Math.abs(s.x - c.x) < (w + c.w) / 2 && Math.abs(s.z - c.z) < (d + c.d) / 2); };
    const reserved = reservedSpot(), spot = reserved ?? BOX_SPOTS.find(free) ?? BOX_SPOTS[0], half = Math.max(BOX.w, BOX.d) / 2; chest.spot = spot;
    chest.group.position.set(spot.x, 0, spot.z); chest.group.rotation.y = spot.rot; world.inside.add(chest.group); loadChest();
    if (!spot.body) world.collider(spot.x, spot.z, half * 1.7, half * 1.7, 'interior'); // the plan's own spot is a collider already (houseColliders)
    // Stand beside its front corner, so you do not hide it from the camera; else in front, on any free bit of floor.
    const fx0 = Math.sin(spot.rot), fz0 = Math.cos(spot.rot), sx0 = fz0, sz0 = -fx0; let at = { x: spot.x + fx0 * 1.05, z: spot.z + fz0 * 1.05 };
    if (spot.stand && !world.blocked(spot.stand.x, spot.stand.z)) at = { x: spot.stand.x, z: spot.stand.z };
    else for (const [f, side] of [[.55, 1.05], [.55, -1.05], [1.05, 0], [1.1, .6], [1.1, -.6], [0, 1.2], [0, -1.2]]) { const x = spot.x + fx0 * f + sx0 * side, z = spot.z + fz0 * f + sz0 * side; if (!world.blocked(x, z)) { at = { x, z }; break; } }
    const t = chest.target = world.target('pandora', 'box', 'Use the Pandora box', at.x, at.z, 1.2, world.inside);
    const box = { x0: spot.x - half, x1: spot.x + half, y0: 0, y1: BOX.h + .15, z0: spot.z - half, z1: spot.z + half }, reach = t.r * 1.4;
    // A tap on the chest uses it; its hit box is the chest alone (not the floor you stand on), so taps on the floor round it,
    // the doorways beside it included, still walk you there.
    t.hit.position.set(spot.x, box.y1 / 2, spot.z); t.hit.scale.set((box.x1 - box.x0) / reach, box.y1 / 2.5, (box.z1 - box.z0) / reach); t.hit.updateMatrixWorld(true);
    (world.__roomHotspots ??= []).push({ target: t, icon: '✨', text: 'Pandora box', box, lift: true });
  }
  const buildInterior = world.buildInterior.bind(world);
  world.buildInterior = () => { buildInterior(); placeChest(); };

  // ---------------------------------------------------------------- per frame, just before the picture is drawn
  const armRest = [0, 0], iconOf = type => view.icon(type);
  const partsOf = person => person.userData.parts ?? (person.userData.fightParts ??= { arm_l: person.getObjectByName('arm-left'), arm_r: person.getObjectByName('arm-right') });
  function pose(dt) {
    const person = world.player, parts = partsOf(person), village = world.location === 'village';
    if (punch > 0 && village) { const k = 1 - punch / .25, arm = swing === 'sword' || punchArm ? parts.arm_r : parts.arm_l; if (arm) arm.rotation.x = swing === 'sword' ? -2.5 + k * 3 : -Math.sin(k * Math.PI) * 2; }
    if (aim > 0 && village && parts.arm_r) parts.arm_r.rotation.x = -1.5;
    const whirling = spin > 0 && village && !world.paused;
    if (whirling) person.rotation.y += dt * 18;
    if (whirling !== armsOut) { // arms out while spinning, then back to where the avatar rests them
      armsOut = whirling; if (whirling) { armRest[0] = parts.arm_l?.rotation.z ?? 0; armRest[1] = parts.arm_r?.rotation.z ?? 0; }
      if (parts.arm_l) parts.arm_l.rotation.z = whirling ? -1.35 : armRest[0]; if (parts.arm_r) parts.arm_r.rotation.z = whirling ? 1.35 : armRest[1];
    }
    const lean = combat.mode === 'dash' && village; if (lean !== leaned) { leaned = lean; person.rotation.x = lean ? .4 : 0; }
    if (combat.mode === 'slam' && village) { person.position.y = combat.airborne; if (parts.arm_l) parts.arm_l.rotation.x = -2.6; if (parts.arm_r) parts.arm_r.rotation.x = -2.6; }
    // Mercy after a hit: the avatar blinks, the ring under it stays.
    const blink = mercy > 0 && village && Math.floor(mercy / .08) % 2 === 1; if (blink !== blinked) { blinked = blink; person.visible = !blink; }
  }
  function chestFrame(dt, open) {
    if (!chest.lid || world.location !== 'interior' || world.houseId !== 0) return;
    chest.lift = T.MathUtils.damp(chest.lift, open ? 1 : 0, 7, dt);
    const k = chest.lift, back = 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2), pulse = .5 + .5 * Math.sin(performance.now() / (open ? 240 : 620)); // the lid swings a little past, then settles
    chest.lid.rotation.x = -1.9 * (k > .001 ? back : 0); chest.inner.visible = chest.beam.visible = k > .04;
    chest.beam.material.opacity = k * (.34 + pulse * .2); chest.beam.rotation.y += dt * .6;
    chest.glow.material.color.setRGB(1, .62 + (open ? .3 : .12) * pulse + k * .1, 1).multiplyScalar(open ? 1 : .62 + pulse * .2);
  }
  room.onFrame(() => {
    if (!world.ready || !world.player) return;
    if (window.willowmere && !window.willowmere.wilds) window.willowmere.wilds = diagnostics;
    const dt = Math.min(.05, Math.max(0, world.t - lastT)); lastT = world.t;
    const s = state(), open = pandoraOpen(s), village = world.location === 'village', p = here(), live = village && !world.paused ? dt : 0;
    if (open !== wasOpen) {
      wasOpen = open; hud.setOpen(open); fx.sound = s.settings.sound !== false;
      if (open) { if (!ward) { buildWard(); view.mount(); world.outside.add(fx.root, dropRoot); } view.load().then(() => { if (!warmed && view.ready) { warmed = true; try { world.renderer.compile(world.scene, world.camera); } catch { /* the first fight compiles instead */ } } }); }
      else { selected = lastHit = null; approach = false; combat.reset(); drops.clear(); fx.clear(); mercy = spin = punch = aim = 0; }
      world.fogBase.copy(open ? FOG.open : FOG.shut);
    }
    chestFrame(dt, open);
    pose(live);
    if (!open && !wilds.list.length) { if (ward) ward.visible = false; return; }
    fx.sound = s.settings.sound !== false;
    // Creatures, danger discs, the target marker, shots and loot.
    const wide = 1 / (world.camera.zoom || 1), right = world.camera.right * wide, depth = world.camera.top * 1.55 * wide; // the camera stands back when you drive fast
    const reach = Math.max(VIEW.hide, len(right, depth) + 6); cellSpan = cellRadius(reach);
    fx.begin();
    if (village) {
      view.update(wilds, combat, live, world.t, world.follow, reach, fx, wilds.time + acc, shadowReach(right, depth));
      for (let i = 0; i < casts.length; i++) { const c = casts[i]; if (c.life > 0) { c.life -= live; fx.decal(c.x, c.z, c.r, 1 - c.life / c.span, '#e5f6ff'); } }
    }
    fx.end();
    const marked = village && (selected ?? (lastHit && time - lastHitAt < 3 && lastHit.hp > 0 ? lastHit : null));
    if (marked && marked.view?.visible) fx.marker(dt, marked.view.userData.drawX, marked.view.userData.drawZ, view.footprint(marked), view.top(marked)); else fx.target.visible = false; // on the creature as it is drawn
    for (let i = 0; i < drops.pool.length; i++) {
      const d = drops.pool[i], sprite = dropSprites[i], show = d.live && village && dropVisible(DROP.life - d.age, drops.time);
      if (sprite.visible !== show) sprite.visible = show; if (!show) continue;
      sprite.material = dropMaterial(d.item); sprite.position.set(d.x, d.y + .35, d.z); sprite.scale.setScalar(.95 + Math.sin(drops.time * 5 + d.phase) * .05);
    }
    if (ward) { ward.visible = open; ward.material.opacity = .78 + Math.sin(world.t * 1.7) * .16; ward.material.map.offset.x = world.t * .05; }
    if (foeShown && world.targetRing) world.targetRing.visible = false; // the red marker speaks for creatures; yellow stays for things you use
    hud.floats.hidden = !village;
    fx.update(dt, world.camera, p, innerWidth, innerHeight);
    // The HUD.
    hud.tick(dt);
    hud.health(Math.max(0, Math.min(stats.maxHp, s.hp)), stats.maxHp);
    const region = village ? regionAt(p.x, p.z) : null;
    const wild = open && region !== null && region !== 'village';
    hud.skillsShown(wild, !!world.riding);
    if (wild && hud.cooldowns(combat.cooldowns, combat.spans)) fx.play('ready');
    hud.zoneChange(wild ? REGION[region] : null);
    let boss = null;
    if (village) for (let i = 0; i < wilds.awake.length; i++) { const e = wilds.awake[i]; if (e.def.boss && e.hp > 0 && (aggro(e) || e.hp < e.maxHp) && len(e.x - p.x, e.z - p.z) < 35) boss = e; }
    hud.bossBar(boss, iconOf, {});
    hud.target(marked && !marked.def.boss ? marked : null, iconOf);
  });
  /** The region id for the diagnostics: null inside the ward and beyond the map. */
  const zoneOf = (x, z) => { const id = regionAt(x, z); return id === 'village' ? null : id; };
  /** Read-only numbers for tests and performance checks (window.willowmere.wilds()). */
  function diagnostics() {
    const s = state(), cam = world.camera, spot = (x, y, z) => { v3.set(x, y, z).project(cam); return { x: (v3.x + 1) * innerWidth / 2, y: (1 - v3.y) * innerHeight / 2 }; };
    return { open: pandoraOpen(s), hp: hpOf(s), maxHp: stats.maxHp, ready: view.ready, loaded: !!view.loading, count: wilds.list.length, living: wilds.list.filter(e => e.hp > 0).length, awake: wilds.awake.length, visible: view.visible, cells: wilds.cells.size,
      drops: drops.count, selected: selected?.id ?? null, cooldowns: [...combat.cooldowns], mode: combat.mode, zone: zoneOf(here().x, here().z), ward: !!ward?.visible, fighting: fighting(), time,
      chest: chest.spot ? { ...chest.spot, lift: chest.lift, loaded: !!chest.lid, screen: world.location === 'interior' ? spot(chest.spot.x, .6, chest.spot.z) : null } : null,
      creatures: wilds.list.map(e => ({ id: e.id, type: e.type, x: e.x, z: e.z, hp: e.hp, maxHp: e.maxHp, phase: e.phase, slam: e.phase === 'windup' && e.slam, shown: !!e.view?.visible, distance: len(e.x - here().x, e.z - here().z), screen: spot(e.x, e.lift + view.top(e) * .45, e.z) })) };
  }
  // world.pandora (the same object as world.__pandora and main.mjs's `pandora`): what the other round 8 modules call.
  //   active                      the box is open
  //   threatened()                a creature near you is chasing, winding up or attacking (Home is then a walk, never a teleport)
  //   onHurt(fn)                  fn(damage, source) after every blow that lands, a creature's ('creature') or the land's
  //   hurtFraction(share, source) the land hurts you (above). REAL.
  //   traits()                    {lavaproof, antidote, light} from worn trophies.                  STUB: {} (builder D)
  //   forceSkill(denId, name), defeatDen(denId), setInvulnerable(on)   the test hook's three.      STUBS: nothing (builder D)
  const api = {
    panel: name => name === 'knockout' ? knockoutPanel(state(), lastLoss) : pandoraPanel(state()), wilds, combat, drops, fx, hud, view, diagnostics, attack, cast,
    get active() { return pandoraOpen(state()); },
    threatened: () => { for (let i = 0; i < wilds.awake.length; i++) if (aggro(wilds.awake[i])) return true; return false; },
    onHurt: fn => { if (typeof fn === 'function') hurtHooks.push(fn); },
    hurtFraction,
    traits: () => ({}),
    forceSkill: (denId, name) => {},
    defeatDen: denId => {},
    setInvulnerable: on => {},
  };
  world.pandora = api;
  return world.__pandora = api;
}
