// Talking by choice inside the Town Square buildings, and the little things that answer a tap. Fetched on the first tap on a person
// or a thing indoors (main.mjs facilityChat); each building's conversation table is fetched when someone there is first talked to.
// The rules are facility-talk.mjs (trees, memory, effects), the things' lines talk-things.mjs. The panel is the game's own talk
// screen (the live portrait of garments-view.mjs paintPerson) with the question and three answers beside it: tap one, or press 1, 2, 3.
//
//   installTalk({world, state(), persist(), hud(), toast(text), chime(), openPanel(name, arg), closePanel(), shell(title, kicker, html, cls),
//                redraw(), panel(), paint(person)}) -> {person(target), thing(target)}
import './facility-talk.css';
import { RESIDENTS } from './content.mjs';
import { getLanguage, t } from './i18n.mjs';
import { applyNames } from './vi-names.mjs';
import { outfitOf } from './outfits.mjs';
import { pair, dealTree, listsFor, remember, applyEffect } from './facility-talk.mjs';
import { isOpen } from './facility-plans.mjs';
import { thingAnswer } from './talk-things.mjs';

const TABLES = { school: () => import('./talk-school.mjs'), hospital: () => import('./talk-hospital.mjs'), police: () => import('./talk-police.mjs'), supermarket: () => import('./talk-supermarket.mjs'), company: () => import('./talk-company.mjs') };
const escape = text => text.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
/** One half of an `English|Tiếng Việt` line (or of a [en, vi] pair) for the language in use; Vietnamese gets the village's Vietnamese names. */
const say = text => { const [en, vi] = typeof text === 'string' ? pair(text) : text; return getLanguage() === 'vi' && vi ? applyNames(vi) : en; };

export function installTalk(ctx) {
  const { world } = ctx, loaded = {}; let talk = null, common = null;
  const table = id => loaded[id] ??= TABLES[id]().then(m => m.default, error => { loaded[id] = null; throw error; });

  async function person(target) {
    const f = world.facility, s = ctx.state(), p = RESIDENTS.find(q => q.id === target.id); if (!f || !p) return;
    const plain = () => ctx.openPanel('talk', p.id);
    if (!TABLES[f.id]) return plain();
    const role = target.role ?? 'staff', own = await table(f.id); if (role === 'cover') common ??= (await import('./talk-common.mjs')).default;
    if (world.facility !== f || ctx.panel()) return;
    const lists = role === 'cover' ? [common['@cover']] : listsFor(own, p.id, role === 'guest' ? f.plan.role : null), tree = dealTree(lists.flat(), s, p.id, role === 'home', p.index);
    if (!tree) return plain();
    remember(s, tree); ctx.persist();
    talk = { p, tree, node: tree.nodes.a, reply: '', open: null, gain: 0, place: f.name, shirt: outfitOf(p, false, s)?.outfitColor ?? p.color };
    ctx.openPanel('chat', p.id);
  }
  function pick(i) {
    const c = talk?.node?.choices[i]; if (!c || ctx.panel() !== 'chat') return;
    const s = ctx.state(), done = c[3] ? applyEffect(s, c[3]) : {};
    talk.reply = c[1]; talk.node = c[2] ? talk.tree.nodes[c[2]] : null; talk.open = done.panel ?? null; talk.gain = done.energy ?? 0;
    ctx.persist(); ctx.hud(); ctx.chime(true); ctx.redraw();
    document.querySelector('#modal .chat-choice, #modal .chat-end button')?.focus({ preventScroll: true });
  }
  function draw() {
    if (!talk) return ctx.closePanel();
    const { p, node, reply, open, gain } = talk, line = text => `<p class="dialogue-line" data-i18n-skip>“${escape(say(text))}”</p>`;
    const choices = node ? `<div class="chat-choices" role="group" aria-label="Your answer">${node.choices.map((c, i) => `<button class="chat-choice" data-chat="${i}"><kbd>${i + 1}</kbd><span data-i18n-skip>${escape(say(c[0]))}</span></button>`).join('')}</div>`
      : `<div class="chat-end">${gain > 0 ? `<p class="chat-gain"><span>A little pick-me-up</span> <b>⚡ +${gain}</b></p>` : ''}${open ? `<button class="chat-choice chat-go" data-chat-open><kbd>1</kbd><span>${open[2]}</span></button>` : ''}<button class="primary" data-action="close">See you around</button></div>`;
    ctx.shell(p.name, `${p.role} · ${talk.place}`, `<div class="chat"><div class="chat-who kids-stage person-stage"><figure class="look-mirror"><div class="mirror-glass" data-mirror-slot="person" style="--shirt:${talk.shirt}"></div></figure></div><div class="chat-talk" aria-live="polite">${reply ? line(reply).replace('dialogue-line', 'dialogue-line chat-reply') : ''}${node ? line(node.say) : ''}${choices}</div></div>`, 'dialogue-modal chat-modal');
    ctx.paint(p);
  }
  const go = () => { const open = talk?.open; if (!open || ctx.panel() !== 'chat') return; talk = null; ctx.openPanel(open[0], open[1]); };
  document.addEventListener('click', e => { const b = e.target.closest?.('[data-chat],[data-chat-open]'); if (!b) return; if (b.dataset.chat !== undefined) pick(Number(b.dataset.chat)); else go(); });
  document.addEventListener('keydown', e => {
    if (ctx.panel() !== 'chat' || !talk || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const n = e.key === '1' ? 0 : e.key === '2' ? 1 : e.key === '3' ? 2 : -1; if (n < 0) return;
    if (talk.node) { e.preventDefault(); pick(n); } else if (n === 0 && talk.open) { e.preventDefault(); go(); }
  });

  /** A thing in the room: its line of the moment (talk-things.mjs), or the target's own line. */
  function thing(target) {
    const f = world.facility, s = ctx.state(); if (!f) return;
    const a = thingAnswer(s, f.id, target.id, isOpen(f.plan, s));
    if (!a) { ctx.toast(`${target.icon ?? ''} ${target.line}`.trim()); world.burst?.('#ffe39a'); return; }
    const tags = a.tags?.length ? ' 🏷️ ' + a.tags.map(([name, price]) => `${t(name)} ${price}`).join(' · ') : '';
    ctx.toast(`${target.icon ?? ''} ${say(a.text)}${tags}${a.energy > 0 ? ` ⚡ +${a.energy}` : ''}`.trim());
    world.burst?.(a.energy > 0 ? '#bff5a8' : '#ffe39a'); if (a.energy > 0) ctx.chime(true); ctx.persist(); ctx.hud();
  }
  world.__chat = { draw, get talk() { return talk; } };
  return { person, thing };
}
