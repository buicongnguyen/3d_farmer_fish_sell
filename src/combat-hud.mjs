// The fight HUD and the Pandora panel, after Zoo Garden's combat HUD (cute_game src/hud-combat.ts, style.css): a health
// meter in the player card, a "Pandora: open" chip, the target frame (the creature you fight: portrait, name, level,
// health), the boss bar, the skill medallions (bottom right, with key hints on desktop) and a red flash when you are hurt.
// All of it exists only in the DOM this module adds, and shows only while the box is open. Writes happen on change.
// The split build (scripts/build.mjs): the DOM, the two panels and setOpen are here; what changes the HUD while you fight (the
// meters, the skill sweeps, the target frame, the boss bar, the chip, the flash) is combat-hud-draw.mjs, fetched by load().
import { SKILLS } from './combat.mjs';
import { pandoraOpen, hpOf, combatStats, KNOCKOUT, HEAL } from './pandora.mjs';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SKILL_CLASS = ['skill-spin', 'skill-dash', 'skill-stomp'];

/** The little stats line for the bag and the wardrobe: gear counts only while the box is open. */
export function statsStripHtml(s) {
  if (!pandoraOpen(s)) return '';
  const g = combatStats(s);
  return `<div class="gear-stats" role="group" aria-label="Fighting stats"><span title="Health">❤️ <b>${Math.ceil(hpOf(s))}</b> / ${g.maxHp}</span><span title="Attack">⚔️ <b>${Math.round(g.attack)}</b></span><span title="Defence">🛡️ <b>${Math.round(g.defense)}</b></span><small>Pandora box open · worn gear counts in fights</small></div>`;
}

/** The panel at the box: a clear Open / Close switch and what each state means. */
export function pandoraPanel(s) {
  const open = pandoraOpen(s), g = combatStats(s);
  const html = `<div class="pandora-hero ${open ? 'is-open' : 'is-shut'}"><span class="pandora-art" aria-hidden="true">${open ? '✨' : '🔒'}</span><div><strong>${open ? 'The box is open' : 'The box is shut'}</strong><p>${open ? 'Wild creatures roam the fields beyond the village.' : 'The fields beyond the village are peaceful.'}</p></div>`
    + `<div class="pandora-switch" role="group" aria-label="Pandora box"><button data-action="pandora-set" data-open="false" class="${open ? '' : 'active'}" aria-pressed="${!open}">🔒 Close</button><button data-action="pandora-set" data-open="true" class="${open ? 'active' : ''}" aria-pressed="${open}">✨ Open</button></div></div>`
    + `<div class="pandora-columns"><section class="${open ? '' : 'now'}"><h3>🔒 Closed</h3><ul><li>No creatures anywhere. Walk and drive as far as you like.</li><li>Hats, clothes and weapons are only for looks.</li><li>No health bar, no fights.</li></ul></section>`
    + `<section class="${open ? 'now' : ''}"><h3>✨ Open</h3><ul><li>Creatures live in all 13 squares beyond the village. Home bosses: the Ancient Treant (Mushroom Forest), Crocodile King (Chomper Swamp), Mushroom King (Blue Lake Meadow) and King Bear (Redrock Canyon).</li><li>Eight lands lie further out, each with bosses and a titan (nine titans in all; the Volcano Dragon visits Ember Fields). The Map shows the crowns.</li><li>Beat the Ancient Treant, King Bear or Giant Toy Robot, then tap the open cage to free Sprout, Clover or Pepper.</li><li>The village is always safe. Creatures stop at the glowing ward line.</li><li>Tap a creature to fight it. Worn gear gives health, attack and defence.</li><li>Every creature pays coins and may drop things to sell or eat.</li></ul></section></div>`
    + (open ? statsStripHtml(s) : '')
    + `<div class="note"><b>Fighting:</b> tap a creature, or press <kbd>F</kbd> (E / ACT when one is close). Skills: ${SKILLS.map(k => `<kbd>${k.key}</kbd> ${k.icon} ${esc(k.name)}`).join(' · ')}. Your home heals you quickly (${HEAL.home} health a second), the village slowly, and a good meal helps too. If you are knocked out you wake at home, rested, at most ${KNOCKOUT.cap} coins lighter.</div>`;
  return { title: 'The Pandora box', kicker: 'A LITTLE CHEST THAT HUMS', html, cls: 'pandora-modal' };
}
/** After a knock-out (act 'knockout' has already run; `loss` is what it cost). */
export function knockoutPanel(s, loss = 0) {
  return { title: 'A little rest, then try again', kicker: 'EVERY EXPLORER TAKES A TUMBLE', cls: 'pandora-modal knockout-modal',
    html: `<div class="rest-art">🌷</div><p class="story-text">You wake in your own bed, safe at home. June has the kettle on, and Pip has drawn you a get-well card with a very large chicken on it.</p><p class="note">${loss ? `Bandages and tea cost <b>${loss} coins</b>.` : 'Nothing was lost.'} Your basket and everything you wear are safe. Better gear, a meal before you go, and the three skills make the far fields kinder.</p><button class="primary" data-action="close">Back on my feet →</button>` };
}

export class CombatHud {
  /** @param app the #app element. */
  constructor(app) {
    this.coding = null;
    const make = (tag, id, html, parent = app) => { const el = document.createElement(tag); el.id = id; el.innerHTML = html; el.hidden = true; parent.append(el); return el; };
    // Health sits above the energy meter in the player card.
    const details = document.querySelector('.player-details'), energy = details?.querySelector('.meter');
    this.hp = document.createElement('div'); this.hp.className = 'meter hp'; this.hp.id = 'hp-meter'; this.hp.hidden = true; this.hp.innerHTML = '<div id="hp-fill"></div><span>❤&nbsp;<b id="hp-text">100</b>&nbsp;/ <i id="hp-max">100</i></span>';
    if (energy) energy.before(this.hp); else app.append(this.hp);
    this.hpFill = this.hp.querySelector('#hp-fill'); this.hpText = this.hp.querySelector('#hp-text'); this.hpMax = this.hp.querySelector('#hp-max');
    this.chip = document.createElement('div'); this.chip.id = 'pandora-chip'; this.chip.className = 'tracker-chip'; this.chip.hidden = true; this.chip.innerHTML = '<i>✨</i><span>Pandora: open</span><small id="pandora-zone"></small>';
    (document.querySelector('.tracker-stack .day-chip') ?? app).after(this.chip); this.zone = this.chip.querySelector('#pandora-zone');
    this.frame = make('div', 'target-frame', '<span class="target-icon"></span><div><div class="target-head"><strong></strong><span class="target-level"></span></div><div class="target-meter"><i></i><span class="target-hp"></span></div></div>');
    this.boss = make('div', 'boss-bar', '<span id="boss-icon">👑</span><div><div class="boss-head"><strong id="boss-name"></strong><b id="boss-hp"></b></div><div class="boss-meter"><i id="boss-fill"></i><span id="boss-callout"></span></div></div>');
    this.flash = make('div', 'damage-flash', ''); this.flash.hidden = false;
    this.floats = make('div', 'combat-floats', ''); this.floats.hidden = false; this.floats.setAttribute('aria-hidden', 'true');
    this.pad = make('div', 'combat-pad', `<button class="skill skill-attack" data-combat="attack" aria-label="Attack (F)" title="Attack the nearest creature"><span>⚔️</span><kbd>F</kbd><small>Attack</small></button>`
      + SKILLS.map((k, i) => `<button class="skill ${SKILL_CLASS[i]}" data-combat="skill" data-index="${i}" aria-label="${esc(k.name)} (${k.key})" title="${esc(k.tip)}"><span>${k.icon}</span><kbd>${k.key}</kbd><i class="cool"></i><b class="cool-text"></b><small>${esc(k.short ?? k.name)}</small></button>`).join(''));
    this.pad.setAttribute('role', 'group'); this.pad.setAttribute('aria-label', 'Fighting skills');
    this.skills = [...this.pad.querySelectorAll('[data-combat="skill"]')].map(el => ({ el, cool: el.querySelector('.cool'), text: el.querySelector('.cool-text'), shown: -1, ready: true }));
    this.state = { open: null, hp: -1, max: -1, pad: null, off: null, target: '', targetHp: -1, boss: '', bossHp: -1, bossCall: '', bossRage: false, zone: '', low: null }; this.flashTimer = 0;
  }
  /** The changing half (combat-hud-draw.mjs), fetched when the box is first opened; a failed fetch is tried again on the next call. */
  load() { return this.coding ??= import('./box-draw.mjs').then(m => { m.installHud(CombatHud); }).catch(error => { this.coding = null; console.warn('The fight HUD could not load.', error); }); }
  // Until it has arrived nothing of the fight HUD shows (setOpen keeps the meters hidden); install() replaces these on the prototype.
  health() {} skillsShown() {} cooldowns() { return false; } target() {} bossBar() {} zoneChange() { return false; } hurt() {} tick() {}
  /** Box open or shut: the whole fight HUD comes and goes with it. */
  setOpen(open) {
    if (this.state.open === open) return; this.state.open = open;
    document.body.classList.toggle('pandora-open', open); this.hp.hidden = !open; this.chip.hidden = !open;
    if (!open) { this.pad.hidden = true; this.state.pad = false; this.frame.hidden = true; this.boss.hidden = true; this.state.target = this.state.boss = ''; document.body.classList.remove('in-wilds', 'target-on', 'boss-on'); }
  }
}
