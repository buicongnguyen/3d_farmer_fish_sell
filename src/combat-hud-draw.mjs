// The changing half of combat-hud.mjs (see the note at the top of that file), fetched with the box's first opening and put onto
// CombatHud's prototype by install(). The same code as before the split, moved.
import { t } from './i18n.mjs';
import { later } from './combat-hud.mjs';
import { SPECIALS, skillTip } from './skills-special.mjs';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const HUD = {
  health(hp, max) {
    const shown = Math.ceil(hp); if (shown === this.state.hp && max === this.state.max) return;
    this.state.hp = shown; this.state.max = max; this.hpText.textContent = shown; this.hpMax.textContent = max; this.hpFill.style.width = Math.max(0, Math.min(100, hp / max * 100)) + '%';
    const low = hp < max * .3; if (low !== this.state.low) { this.state.low = low; this.hp.classList.toggle('low', low); }
  },
  /** The fourth medallion follows the weapon's special (or the worn uniform's); every medallion carries its long tip (the reference's skill-info.ts). Written only when the special changes. */
  info(id) {
    if (id === this.state.special) return; this.state.special = id;
    const sp = SPECIALS[id] ?? SPECIALS.fist, b = this.skills[3]?.el; if (!b) return;
    b.querySelector('span').textContent = sp.icon; b.querySelector('small').textContent = t(sp.name); b.setAttribute('aria-label', `${t(sp.name)} (4)`);
    for (let i = 0; i < this.skills.length; i++) this.skills[i].el.title = skillTip(i, id);
  },
  /** The skill medallions: shown in the wilds, dimmed while driving. */
  skillsShown(show, off = false) {
    if (show !== this.state.pad) { this.state.pad = show; this.pad.hidden = !show; document.body.classList.toggle('in-wilds', show); }
    if (off !== this.state.off) { this.state.off = off; this.pad.classList.toggle('off', off); }
  },
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
  },
  /** The creature you fight (or null). `icon` gives a portrait URL for a creature kind. */
  target(e, icon) {
    if (!e) { if (this.state.target) { this.state.target = ''; this.frame.hidden = true; document.body.classList.remove('target-on'); } return; }
    if (this.state.target !== e.id) {
      this.state.target = e.id; this.state.targetHp = -1; this.frame.hidden = false; document.body.classList.add('target-on');
      const url = icon?.(e.type); this.frame.querySelector('.target-icon').innerHTML = url ? `<img src="${url}" alt="" draggable="false">` : '⚔️';
      this.frame.querySelector('strong').textContent = e.def.name; this.frame.querySelector('.target-level').textContent = 'Lv ' + (e.level ?? e.def.level);
    }
    const hp = Math.ceil(e.hp); if (hp === this.state.targetHp) return; this.state.targetHp = hp;
    this.frame.querySelector('.target-meter i').style.width = e.hp / e.maxHp * 100 + '%'; this.frame.querySelector('.target-hp').textContent = `${hp} / ${e.maxHp}`;
  },
  /**
   * The boss or titan you fight (or null). `opts.titan`: the bar is violet and says TITAN; `opts.callout`: the name of the skill it
   * is winding up ('' when none), shown on the bar for as long as the wind-up lasts; `opts.enraged`: the bar pulses red.
   */
  bossBar(e, icon, opts = {}) {
    if (!e) { if (this.state.boss) { this.state.boss = ''; this.boss.hidden = true; document.body.classList.remove('boss-on'); } return; }
    const titan = !!opts.titan, callout = opts.callout ?? '', enraged = !!opts.enraged;
    if (this.state.boss !== e.id) {
      this.state.boss = e.id; this.state.bossHp = -1; this.state.bossCall = null; this.state.bossRage = null; this.boss.hidden = false; document.body.classList.add('boss-on');
      const url = icon?.(e.type), mark = titan ? '🔱' : '👑'; this.boss.querySelector('#boss-icon').innerHTML = url ? `<img src="${url}" alt="" draggable="false">` : mark;
      // The mark and the name always; the word TITAN and the level where there is room for them (pandora.css hides them on phones).
      this.boss.querySelector('#boss-name').innerHTML = `${mark} ${titan ? '<em>TITAN · </em>' : ''}${esc(e.def.name)}<small> · Lv ${e.level ?? e.def.level}</small>`; this.boss.classList.toggle('titan', titan);
    }
    if (callout !== this.state.bossCall) { this.state.bossCall = callout; this.boss.querySelector('#boss-callout').textContent = callout; this.boss.classList.toggle('calling', !!callout); }
    if (enraged !== this.state.bossRage) { this.state.bossRage = enraged; this.boss.classList.toggle('enraged', enraged); }
    const hp = Math.ceil(e.hp); if (hp === this.state.bossHp) return; this.state.bossHp = hp;
    this.boss.querySelector('#boss-fill').style.width = e.hp / e.maxHp * 100 + '%'; this.boss.querySelector('#boss-hp').textContent = `${hp} / ${e.maxHp}`;
  },
  /**
   * The region you stand in: {id, name, stars, level} (a regions.mjs REGION row), or null inside the ward and beyond the map.
   * The chip names it ("★★ Chomper Swamp"). The banner on crossing a border is builder A's (region-banner.mjs).
   */
  zoneChange(region) {
    const id = region?.id ?? ''; if (id === this.state.zone) return false; this.state.zone = id;
    this.zone.textContent = region ? `${'★'.repeat(region.stars)} ${region.name}` : '';
    return true;
  },
  hurt() { this.flash.classList.add('active'); this.flashTimer = .16; },
  tick(dt) {
    if (this.flashTimer > 0 && (this.flashTimer -= dt) <= 0) this.flash.classList.remove('active');
  },
};
/** After a knock-out: the panel text, kept here so the first load does not carry it. */
function knockoutPanel(loss = 0) {
  return { title: 'A little rest, then try again', kicker: 'EVERY EXPLORER TAKES A TUMBLE', cls: 'pandora-modal knockout-modal',
    html: `<div class="rest-art">🌷</div><p class="story-text">You wake in your own bed, safe at home. June has the kettle on, and Pip has drawn you a get-well card with a very large chicken on it.</p><p class="note">${loss ? `Bandages and tea cost <b>${loss} coins</b>.` : 'Nothing was lost.'} Your basket and everything you wear are safe. Better gear, a meal before you go, and the skills make the far fields kinder.</p><button class="primary" data-action="close">Back on my feet →</button>` };
}
/** Puts the changing methods onto the class, replacing its silent stand-ins. */
export function install(CombatHud) { Object.assign(CombatHud.prototype, HUD); later.knockout = knockoutPanel; }
