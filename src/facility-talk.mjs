// Conversations by choice inside the Town Square buildings: the rules (pure: no Three.js, no DOM). facility-talk-view.mjs draws
// them, the tables are one lazy file per building (talk-school.mjs, talk-hospital.mjs, talk-police.mjs, talk-supermarket.mjs,
// talk-company.mjs), tests/facility-talk.test.mjs checks every table.
//
// A table is { <resident id> | '@<role>': [tree, ...] }. A tree is
//   { id, when?, nodes: { a: { say, choices: [[text, reply, next?, effect?] x 3] }, b: ... } }
// It starts at node `a`. The person says `say` and you pick one of exactly three answers; the person gives that answer's `reply`
// and, when it names a `next` node, asks that node's question; with no `next` the talk ends politely. Every string is written once
// with its Vietnamese next to it: `English|Tiếng Việt` (English names in both halves: vi-names.mjs turns them into Vietnamese ones).
//   when    { from, to (hours), season, rain, festival, chapter (at least), stat: [key, at least], done | fresh (a civic id: its
//            action done or not yet done today), night (the building is shut: the family that lodges there is at home), who (a visitor id) }
//   effect  'lesson' | 'checkup' | 'patrol' | 'shift' | 'hire' | 'sell' (the reply ends with a button that opens that existing panel)
//           | 'energy' (a small pick-me-up: +ENERGY_TIP, once a day in all)
// A role table ('@patient', '@parent', '@report', '@shopper', '@applicant') is for the villagers who call at a building.
// What was talked about today is kept in s.chat (game.mjs defaults and repairs it): a tree is not dealt twice in a day while another fits.
import { calendar } from './game.mjs';

export const ENERGY_TIP = 5;
export const PANELS = { lesson: ['civic', 'school', 'Start a lesson'], checkup: ['civic', 'hospital', 'Have a check-up'], patrol: ['civic', 'police', 'Take the patrol'], shift: ['civic', 'company', 'Take an office shift'], hire: ['workers', undefined, 'Read the hiring board'], sell: ['shop', 'supermarket', 'Go to the checkout'] };
export const EFFECTS = new Set([...Object.keys(PANELS), 'energy']);
const WHEN = new Set(['from', 'to', 'season', 'rain', 'festival', 'chapter', 'stat', 'done', 'fresh', 'night', 'who']);
/** `English|Vietnamese` -> [english, vietnamese]. */
export const pair = text => { const i = text.indexOf('|'); return i < 0 ? [text, ''] : [text.slice(0, i), text.slice(i + 1)]; };
/** Today's memory (made new each day): { day, seen: {tree id: 1}, used: {effect or thing key: 1}, note: the day a note went in the suggestion box }. */
export function memory(s) {
  let m = s.chat; if (!m || typeof m !== 'object') m = s.chat = { day: 0, seen: {}, used: {}, note: 0 };
  if (m.day !== s.day) { m.day = s.day; m.seen = {}; m.used = {}; }
  return m;
}
/** Does a tree fit now? `who` is the person's id, `night` true when the building is shut. */
export function fits(tree, s, who = '', night = false) {
  const w = tree.when; if (!w) return !night;
  if (!!w.night !== !!night) return false;
  if (w.who && w.who !== who) return false;
  if (w.from !== undefined && s.time < w.from || w.to !== undefined && s.time >= w.to) return false;
  const c = calendar(s);
  if (w.season && w.season !== c.season || w.rain !== undefined && w.rain !== c.rain || w.festival !== undefined && w.festival !== c.festival) return false;
  if (w.chapter !== undefined && (s.chapter ?? 0) < w.chapter) return false;
  if (w.stat && (s.stats?.[w.stat[0]] ?? 0) < w.stat[1]) return false;
  if (w.done && s.civicDay?.[w.done] !== s.day || w.fresh && s.civicDay?.[w.fresh] === s.day) return false;
  return true;
}
/** The tree to deal now from a person's list (or their role's): one that fits and was not used today; the day turns the choice. Null when nothing fits. */
export function dealTree(list, s, who = '', night = false, turn = 0) {
  if (!list?.length) return null;
  const m = memory(s), fit = list.filter(t => fits(t, s, who, night)); if (!fit.length) return null;
  const fresh = fit.filter(t => !m.seen[t.id]), pool = fresh.length ? fresh : fit;
  return pool[(s.day * 7 + turn + Object.keys(m.seen).length) % pool.length];
}
/** The lists a person can be dealt from in a table: their own, then their role's. */
export const listsFor = (table, who, role) => [table?.[who], role ? table?.['@' + role] : null].filter(l => l?.length);
/** Marks a tree as talked about today. */
export function remember(s, tree) { memory(s).seen[tree.id] = 1; }
/** A small effect, capped: returns what happened ('energy' gives +ENERGY_TIP once a day; a panel effect returns its PANELS row). */
export function applyEffect(s, effect) {
  if (PANELS[effect]) return { panel: PANELS[effect] };
  if (effect === 'energy') { const m = memory(s); if (m.used.energy || s.energy >= 100) return { energy: 0 }; m.used.energy = 1; const before = s.energy; s.energy = Math.min(100, s.energy + ENERGY_TIP); return { energy: s.energy - before }; }
  return {};
}
/** Everything wrong with a table, as text lines (none: the table is sound). */
export function validate(table, name = 'table') {
  const bad = [], ids = new Set(), text = (v, where) => { if (typeof v !== 'string') { bad.push(`${where}: not a string`); return; } const [en, vi] = pair(v); if (!en.trim()) bad.push(`${where}: no English`); if (!vi.trim()) bad.push(`${where}: no Vietnamese ("${en.slice(0, 40)}")`); if (v.indexOf('|') !== v.lastIndexOf('|')) bad.push(`${where}: more than one |`); };
  for (const [who, list] of Object.entries(table)) {
    if (!Array.isArray(list) || !list.length) { bad.push(`${name} ${who}: no trees`); continue; }
    for (const tree of list) {
      const at = `${name} ${who} ${tree.id}`;
      if (!tree.id || ids.has(tree.id)) bad.push(`${at}: the id is missing or used twice`); ids.add(tree.id);
      for (const k of Object.keys(tree.when ?? {})) if (!WHEN.has(k)) bad.push(`${at}: unknown condition ${k}`);
      if (!tree.nodes?.a) { bad.push(`${at}: no node a`); continue; }
      const reached = new Set(['a']);
      for (const [key, node] of Object.entries(tree.nodes)) {
        text(node.say, `${at}.${key}.say`);
        if (!Array.isArray(node.choices) || node.choices.length !== 3) { bad.push(`${at}.${key}: ${node.choices?.length ?? 0} choices (three are needed)`); continue; }
        node.choices.forEach((c, i) => {
          text(c[0], `${at}.${key}.${i}.text`); text(c[1], `${at}.${key}.${i}.reply`);
          if (c[2]) { if (!tree.nodes[c[2]]) bad.push(`${at}.${key}.${i}: next "${c[2]}" does not exist`); reached.add(c[2]); }
          if (c[3] && !EFFECTS.has(c[3])) bad.push(`${at}.${key}.${i}: unknown effect ${c[3]}`);
          if (c.length > 4) bad.push(`${at}.${key}.${i}: too many fields`);
        });
      }
      for (const key of Object.keys(tree.nodes)) if (!reached.has(key)) bad.push(`${at}.${key}: no choice leads here`);
      const depth = (key, seen = []) => seen.includes(key) ? 99 : 1 + Math.max(0, ...tree.nodes[key].choices.map(c => c[2] && tree.nodes[c[2]] ? depth(c[2], [...seen, key]) : 0)), d = depth('a');
      if (d < 2 || d > 4) bad.push(`${at}: ${d > 90 ? 'a loop' : d + ' step' + (d === 1 ? '' : 's')} deep (2 to 4 are wanted)`);
    }
  }
  return bad;
}
/** Counts of a table: {trees, nodes, lines}. */
export function measure(table) {
  let trees = 0, nodes = 0, lines = 0;
  for (const list of Object.values(table)) for (const tree of list) { trees++; for (const node of Object.values(tree.nodes)) { nodes++; lines += 1 + node.choices.length * 2; } }
  return { trees, nodes, lines };
}
