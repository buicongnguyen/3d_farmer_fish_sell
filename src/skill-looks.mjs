// What the fourth skill (skills-special.mjs) and the three base skills look like, after Zoo Garden's skill-fx.ts / skill-visuals.ts /
// ribbons.ts: every look is built from the pooled effects combat-fx-draw.mjs already owns (the instanced chip and glow-spark pools, the
// instanced shock rings, the four slash arcs), so a whole burst costs the same draw calls as a single hit. Fetched with the box.
// Nothing is created while a fight runs: the weapon-tip trail reuses one Box3 and two vectors. install() adds look(), cast4() and
// trail() to CombatFx; cast4 is the hero's side of a cast (sound, pose, the trail on the weapon's tip) and returns the pose letter.
import * as T from 'three';
import { SPECIALS } from './skills-special.mjs';
import { SHOT_COLORS } from './wilds-view.mjs';

Object.assign(SHOT_COLORS, { wave: '#7fd0ff', dragon: '#ffb347', lotus: '#ffb3cf', bigbubble: '#b6eaff', star: '#ffe34d', thornburst: '#cae482' });
const TAU = Math.PI * 2, RAINBOW = ['#ff6b6b', '#ffb347', '#ffe66d', '#7dff9a', '#6fd3ff', '#b58cff'], box = new T.Box3(), hand = new T.Vector3(), tip = new T.Vector3(), corner = new T.Vector3();
/** Each look: (fx, x, z, r, facing, n) with n the density 0.5-1 (the governor and phones thin it). Colours are vivid and warm. */
const LOOKS = {
  fist(fx, x, z, r, f, n) { fx.burst(x + Math.sin(f) * 1.4, .9, z + Math.cos(f) * 1.4, Math.ceil(5 * n), '#fff3c4', 4, 2, .1, .3, true); },
  crescent(fx, x, z, r, f, n) { fx.slash(x, z, f, r * 1.05, '#ffe9a0', 1); fx.slash(x, z, f, r * .78, '#ffffff', .9); fx.burst(x + Math.sin(f) * 2.6, 1, z + Math.cos(f) * 2.6, Math.ceil(10 * n), ['#ffe9a0', '#ffffff'], 5, 2, .12, .4, true); fx.shake(.25); },
  rush(fx, x, z, r, f, n) { fx.burst(x, .2, z, Math.ceil(10 * n), '#f3e2bd', 3, 2, .14, .5); },
  eagle(fx, x, z, r, f, n) { fx.burst(x, 1, z, Math.ceil(8 * n), '#ffffff', 4, 4, .14, .6); fx.ring(x, z, 3, '#ffffff', .4); fx.ring(x, z, 3.4, '#ffe9a0', .6); fx.shake(.3); fx.burst(x, .3, z, Math.ceil(16 * n), ['#ffffff', '#ffe9a0'], 6, 5, .14, .7, true); },
  surf(fx, x, z, r, f, n) { for (let i = 0; i < 3; i++) fx.ring(x + Math.sin(f) * i * 1.4, z + Math.cos(f) * i * 1.4, 1.8 + i * .5, '#7fd0ff', .4 + i * .1, .4); fx.burst(x + Math.sin(f) * 1.2, .5, z + Math.cos(f) * 1.2, Math.ceil(12 * n), ['#7fd0ff', '#ffffff'], 5, 3, .13, .5, true); },
  dragon(fx, x, z, r, f, n) { fx.burst(x + Math.sin(f), .9, z + Math.cos(f), Math.ceil(14 * n), ['#ffb347', '#ff6b3a', '#ffe66d'], 6, 3, .15, .5, true); fx.ring(x, z, 2.2, '#ffb347', .35); },
  nova(fx, x, z, r, f, n) { fx.ring(x, z, r, '#cae482', .5, 1); fx.burst(x, .6, z, Math.ceil(18 * n), ['#cae482', '#ffffff'], 7, 2, .12, .5, true); fx.shake(.2); },
  blizzard(fx, x, z, r, f, n) { fx.ring(x, z, r, '#a9eeff', .6, 1); fx.ring(x, z, r * .6, '#ffffff', .45, .5); fx.burst(x, .8, z, Math.ceil(22 * n), ['#a9eeff', '#ffffff', '#d0f7ff'], 8, 3, .13, .7, true); fx.shake(.2); },
  lotus(fx, x, z, r, f, n) { fx.ring(x, z, r, '#ffb3cf', .6, .6); fx.burst(x, .5, z, Math.ceil(16 * n), ['#ffb3cf', '#fff0f8', '#ffd35e'], 4, 5, .16, 1, false); },
  goldstar(fx, x, z, r, f, n) { fx.ring(x, z, r, '#ffe34d', .5, .6); fx.burst(x, .8, z, Math.ceil(18 * n), ['#ffe34d', '#fff6b0'], 7, 4, .14, .6, true); fx.shake(.15); },
  anchor(fx, x, z, r, f, n) { fx.ring(x, z, r, '#9fd6ff', .5, 1); fx.slash(x, z, f, r, '#9fd6ff', .9); fx.slash(x, z, f + Math.PI, r, '#9fd6ff', .9); },
  magma(fx, x, z, r, f, n) { fx.ring(x, z, r + .3, '#ff9357', .5, .4); fx.burst(x, .2, z, Math.ceil(12 * n), ['#ff9357', '#ffe66d', '#ff5a2e'], 4, 8, .16, .8, true); fx.burst(x, .2, z, Math.ceil(6 * n), '#5a3a2a', 5, 5, .18, .9); fx.shake(.15); },
  bonk(fx, x, z, r, f, n) { fx.ring(x, z, r, '#ffe14d', .5, 1); fx.ring(x, z, r * .6, '#ffffff', .4); fx.burst(x, .3, z, Math.ceil(22 * n), ['#ffe14d', '#ffffff'], 7, 6, .15, .7, true); fx.shake(.55); fx.freeze(.06); },
  swing(fx, x, z, r, f) { fx.slash(x, z, f, r * .9, '#ffe14d', 1.4); },
  whirl(fx, x, z, r, f, n) { fx.ring(x, z, r, '#c9e8ff', .45, 1); fx.ring(x, z, r * .6, '#ffffff', .35); fx.burst(x, .5, z, Math.ceil(14 * n), ['#c9e8ff', '#ffffff'], 7, 2, .12, .5, true); },
  inferno(fx, x, z, r, f, n) { fx.ring(x, z, r, '#ff874c', .45, .4); fx.burst(x, .2, z, Math.ceil(8 * n), ['#ff874c', '#ffe66d'], 3, 6, .15, .6, true); },
  blast(fx, x, z, r, f, n) { fx.ring(x, z, r, '#ffe45c', .35, .3); fx.burst(x, .3, z, Math.ceil(8 * n), ['#ffe45c', '#ffffff'], 5, 4, .13, .45, true); },
  meteor(fx, x, z) { fx.sparks.emit(x - 1.2, 5.5, z, 5.5, -25, 0, .22, 1.1, '#ffe45c', 0); fx.sparks.emit(x - .8, 4, z, 3.6, -16, 0, .22, .7, '#ffffff', 0); },
  bolt(fx, x, z, r, f, n) { const steps = Math.max(2, Math.ceil(r * 2.2 * n)); for (let i = 0; i <= steps; i++) { const d = i / steps * r, j = (i % 2 ? .3 : -.3) * (i && i < steps ? 1 : 0); fx.sparks.emit(x + Math.sin(f) * d + Math.cos(f) * j, 1 + Math.sin(i * 1.7) * .25, z + Math.cos(f) * d - Math.sin(f) * j, 0, 0, 0, .3, .5, i % 2 ? '#ffffff' : '#a6f8ff', 0); } },
  laser(fx, x, z, r, f, n) { const steps = Math.ceil(r * 2.4 * n); for (let i = 0; i <= steps; i++) { const d = .8 + i / steps * (r - .8); fx.sparks.emit(x + Math.sin(f) * d, 1.1, z + Math.cos(f) * d, 0, 0, 0, .5, .9, RAINBOW[i % 6], 0); } fx.burst(x + Math.sin(f) * 1.2, 1.1, z + Math.cos(f) * 1.2, Math.ceil(8 * n), RAINBOW, 4, 1, .12, .4, true); fx.shake(.3); },
};
const sound = (fx, id) => fx.play(SPECIALS[id]?.sound ?? 'punch');
const LOOK = {
  /** A special's (or a base skill's) look, from Combat's host.effect('look', x, z, radius, facing, name). */
  look(x, z, r, f, id) { const k = LOOKS[id]; if (k) k(this, x, z, r, f, this.thin ?? 1); },
  /**
   * The hero's side of a special that has just been cast: its sound, how the arms go ('s' swing, 'a' aim, 'w' out, from skills-special.mjs),
   * and a glowing trail on the weapon's tip for the next .4 s. `world` gives the player and the phone / governor thinning.
   */
  cast4(id, world) {
    const def = SPECIALS[id] ?? SPECIALS.fist; this.hero = world.player; this.thin = (world.step ?? 0) > 0 || world.state?.settings?.quality === 'battery' || Math.min(innerWidth, innerHeight) < 500 ? .5 : 1;
    this.trailLeft = def.pose === 's' ? .45 : 0; this.trailColor = id;
    sound(this, id); return def.pose;
  },
  specialOf(s) { return SPECIAL_OF(s); },
  /** The trail on the weapon's far end while a swing lasts (a glow spark or two a frame). */
  trail(dt) {
    if (!(this.trailLeft > 0) || !this.hero) return; this.trailLeft -= dt;
    const group = this.hero.getObjectByName('weapon'); if (!group) return;
    group.updateWorldMatrix(true, true); hand.setFromMatrixPosition(group.matrixWorld); box.setFromObject(group); if (box.isEmpty()) return;
    let far = -1; for (let i = 0; i < 8; i++) { corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z); const d = corner.distanceToSquared(hand); if (d > far) { far = d; tip.copy(corner); } }
    const hex = ACCENT[this.trailColor] ?? '#fff4c8'; this.sparks.emit(tip.x, tip.y, tip.z, 0, .4, 0, .3, .45, hex, 0); if (this.thin > .9) this.sparks.emit((tip.x + hand.x) / 2, (tip.y + hand.y) / 2, (tip.z + hand.z) / 2, 0, .3, 0, .22, .3, hex, 0);
  },
};
let SPECIAL_OF = () => 'fist';
/** The colour of each special's trail, from the weapon or its element. */
const ACCENT = { fist: '#fff3c4', crescent: '#ffe9a0', gore: '#f3e2bd', wave: '#7fd0ff', tsunami: '#6fd3ff', dragon: '#ffb347', bonk: '#ffe14d', thunder: '#7ff7ff', magma: '#ff9357', anchor: '#9fd6ff', eagle: '#ffffff' };
export function install(CombatFx, specialOf) { SPECIAL_OF = specialOf; Object.assign(CombatFx.prototype, LOOK); }
