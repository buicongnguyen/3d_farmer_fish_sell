// The fight HUD and the Pandora panel, after Zoo Garden's combat HUD (cute_game src/hud-combat.ts, style.css): a health
// meter in the player card, a "Pandora: open" chip, the target frame (the creature you fight: portrait, name, level,
// health), the boss bar, the skill medallions (bottom right, with key hints on desktop) and a red flash when you are hurt.
// All of it exists only in the DOM this module adds, and shows only while the box is open. Writes happen on change.
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
    + `<section class="${open ? 'now' : ''}"><h3>✨ Open</h3><ul><li>Creatures live in the fields outside the village: gentle ones in the forest and the meadow, fierce ones in the swamp and the canyon, and a King Bear in the Redrock Canyon to the east.</li><li>The village is always safe. Creatures stop at the glowing ward line.</li><li>Tap a creature to fight it. Worn gear gives health, attack and defence.</li><li>Every creature pays coins and may drop things to sell or eat.</li></ul></section></div>`
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
    const make = (tag, id, html, parent = app) => { const el = document.createElement(tag); el.id = id; el.innerHTML = html; el.hidden = true; parent.append(el); return el; };
    // Health sits above the energy meter in the player card.
    const details = document.querySelector('.player-details'), energy = details?.querySelector('.meter');
    this.hp = document.createElement('div'); this.hp.className = 'meter hp'; this.hp.id = 'hp-meter'; this.hp.hidden = true; this.hp.innerHTML = '<div id="hp-fill"></div><span>❤&nbsp;<b id="hp-text">100</b>&nbsp;/ <i id="hp-max">100</i></span>';
    if (energy) energy.before(this.hp); else app.append(this.hp);
    this.hpFill = this.hp.querySelector('#hp-fill'); this.hpText = this.hp.querySelector('#hp-text'); this.hpMax = this.hp.querySelector('#hp-max');
    this.chip = document.createElement('div'); this.chip.id = 'pandora-chip'; this.chip.className = 'tracker-chip'; this.chip.hidden = true; this.chip.innerHTML = '<i>✨</i><span>Pandora: open</span><small id="pandora-zone"></small>';
    (document.querySelector('.tracker-stack .day-chip') ?? app).after(this.chip); this.zone = this.chip.querySelector('#pandora-zone');
    this.frame = make('div', 'target-frame', '<span class="target-icon"></span><div><div class="target-head"><strong></strong><span class="target-level"></span></div><div class="target-meter"><i></i><span class="target-hp"></span></div></div>');
    this.boss = make('div', 'boss-bar', '<span id="boss-icon">👑</span><div><div class="boss-head"><strong id="boss-name"></strong><b id="boss-hp"></b></div><div class="boss-meter"><i id="boss-fill"></i></div></div>');
    this.flash = make('div', 'damage-flash', ''); this.flash.hidden = false;
    this.floats = make('div', 'combat-floats', ''); this.floats.hidden = false; this.floats.setAttribute('aria-hidden', 'true');
    this.pad = make('div', 'combat-pad', `<button class="skill skill-attack" data-combat="attack" aria-label="Attack (F)" title="Attack the nearest creature"><span>⚔️</span><kbd>F</kbd><small>Attack</small></button>`
      + SKILLS.map((k, i) => `<button class="skill ${SKILL_CLASS[i]}" data-combat="skill" data-index="${i}" aria-label="${esc(k.name)} (${k.key})" title="${esc(k.tip)}"><span>${k.icon}</span><kbd>${k.key}</kbd><i class="cool"></i><b class="cool-text"></b><small>${esc(k.short ?? k.name)}</small></button>`).join(''));
    this.pad.setAttribute('role', 'group'); this.pad.setAttribute('aria-label', 'Fighting skills');
    this.skills = [...this.pad.querySelectorAll('[data-combat="skill"]')].map(el => ({ el, cool: el.querySelector('.cool'), text: el.querySelector('.cool-text'), shown: -1, ready: true }));
    this.state = { open: null, hp: -1, max: -1, pad: null, off: null, target: '', targetHp: -1, boss: '', bossHp: -1, zone: '', low: null }; this.flashTimer = 0;
  }
  /** Box open or shut: the whole fight HUD comes and goes with it. */
  setOpen(open) {
    if (this.state.open === open) return; this.state.open = open;
    document.body.classList.toggle('pandora-open', open); this.hp.hidden = !open; this.chip.hidden = !open;
    if (!open) { this.pad.hidden = true; this.state.pad = false; this.frame.hidden = true; this.boss.hidden = true; this.state.target = this.state.boss = ''; document.body.classList.remove('in-wilds', 'target-on', 'boss-on'); }
  }
  health(hp, max) {
    const shown = Math.ceil(hp); if (shown === this.state.hp && max === this.state.max) return;
    this.state.hp = shown; this.state.max = max; this.hpText.textContent = shown; this.hpMax.textContent = max; this.hpFill.style.width = Math.max(0, Math.min(100, hp / max * 100)) + '%';
    const low = hp < max * .3; if (low !== this.state.low) { this.state.low = low; this.hp.classList.toggle('low', low); }
  }
  /** The skill medallions: shown in the wilds, dimmed while driving. */
  skillsShown(show, off = false) {
    if (show !== this.state.pad) { this.state.pad = show; this.pad.hidden = !show; document.body.classList.toggle('in-wilds', show); }
    if (off !== this.state.off) { this.state.off = off; this.pad.classList.toggle('off', off); }
  }
  /** Cooldown sweeps; returns true when a skill has just come back (for the ready chime). */
  cooldowns(left, spans) {
    let ready = false;
    for (let i = 0; i < this.skills.length; i++) {
      const s = this.skills[i], t = left[i] > 0 ? Math.ceil(left[i] * 10) : 0;
      if (t === s.shown) continue; s.shown = t;
      const cooling = t > 0; s.cool.style.setProperty('--cool', cooling ? (left[i] / Math.max(.01, spans[i])).toFixed(3) : '0'); s.text.textContent = cooling ? (left[i] >= 1 ? Math.ceil(left[i]) : left[i].toFixed(1)) : '';
      if (cooling === s.ready) { s.ready = !cooling; s.el.classList.toggle('cooling', cooling); if (!cooling) { ready = true; s.el.classList.remove('ready-pop'); void s.el.offsetWidth; s.el.classList.add('ready-pop'); } }
    }
    return ready;
  }
  /** The creature you fight (or null). `icon` gives a portrait URL for a creature kind. */
  target(e, icon) {
    if (!e) { if (this.state.target) { this.state.target = ''; this.frame.hidden = true; document.body.classList.remove('target-on'); } return; }
    if (this.state.target !== e.id) {
      this.state.target = e.id; this.state.targetHp = -1; this.frame.hidden = false; document.body.classList.add('target-on');
      const url = icon?.(e.type); this.frame.querySelector('.target-icon').innerHTML = url ? `<img src="${url}" alt="" draggable="false">` : '⚔️';
      this.frame.querySelector('strong').textContent = e.def.name; this.frame.querySelector('.target-level').textContent = 'Lv ' + e.def.level;
    }
    const hp = Math.ceil(e.hp); if (hp === this.state.targetHp) return; this.state.targetHp = hp;
    this.frame.querySelector('.target-meter i').style.width = e.hp / e.maxHp * 100 + '%'; this.frame.querySelector('.target-hp').textContent = `${hp} / ${e.maxHp}`;
  }
  /** The boss you fight (or null). `opts` ({titan, callout}) is accepted and ignored until builder D draws the violet bar and the skill callout. */
  bossBar(e, icon, opts = {}) {
    if (!e) { if (this.state.boss) { this.state.boss = ''; this.boss.hidden = true; document.body.classList.remove('boss-on'); } return; }
    if (this.state.boss !== e.id) { this.state.boss = e.id; this.state.bossHp = -1; this.boss.hidden = false; document.body.classList.add('boss-on'); const url = icon?.(e.type); this.boss.querySelector('#boss-icon').innerHTML = url ? `<img src="${url}" alt="" draggable="false">` : '👑'; this.boss.querySelector('#boss-name').textContent = '👑 ' + e.def.name; }
    const hp = Math.ceil(e.hp); if (hp === this.state.bossHp) return; this.state.bossHp = hp;
    this.boss.querySelector('#boss-fill').style.width = e.hp / e.maxHp * 100 + '%'; this.boss.querySelector('#boss-hp').textContent = `${hp} / ${e.maxHp}`;
  }
  /**
   * The region you stand in: {id, name, stars, level} (a regions.mjs REGION row), or null inside the ward and beyond the map.
   * The chip names it ("★★ Chomper Swamp"). The banner on crossing a border is builder A's (region-banner.mjs).
   */
  zoneChange(region) {
    const id = region?.id ?? ''; if (id === this.state.zone) return false; this.state.zone = id;
    this.zone.textContent = region ? `${'★'.repeat(region.stars)} ${region.name}` : '';
    return true;
  }
  hurt() { this.flash.classList.add('active'); this.flashTimer = .16; }
  tick(dt) {
    if (this.flashTimer > 0 && (this.flashTimer -= dt) <= 0) this.flash.classList.remove('active');
  }
}
