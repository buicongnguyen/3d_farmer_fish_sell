// The missing workers (2026-10-10). Pure: no three.js, no DOM. When the Pandora box was opened, twelve of the village's facility
// workers were carried off, one to every land that has a boss. Each is shut in a small hut beside that boss's den; the boss holds
// the key. Beat the boss (state.defeated[type]), open the hut, and the worker goes home to a post inside a facility building and
// brings a small daily perk. The three friend cages (friends.mjs) are untouched: the huts are additional.
//
//   PEOPLE, PERSON, RESCUE_IDS          the twelve: {id, name, role, line, color, wear, land, boss, den, hut, plan, post, perk, unlock}
//   hutSpot(id)                         where the hut stands (by rule, see hutClear); hutCandidates(den) the spots it tries
//   hutState(id, state)                 'hidden' | 'barred' | 'open' | 'rescued' (hidden whenever the box is shut)
//   hutStatuses(state, out)             [{id, x, z, state}] of the huts not hidden (`out` is reused: no allocation)
//   rescuedList(state)                  the people who are back, in the order of PEOPLE
//   postsFor(planId, state)             THE SEAM for facility-interior.mjs: [{p, at: {x, z, rot, sit?, pose?}}] of the rescued who work there
//   heldIn(land, state)                 the person still held in that land (box open), or null
//   peopleNote(state)                   the People panel's lines {back: [...], missing: [...]}
//   parseRescued(raw)                   the save's `rescued` / `rescuedPerk` maps {id: day}, cleaned
//   rescueAct(s, type, arg)             the actions 'hut' {id, x, z} (open a hut) and 'perk' {id} (a worker's daily favour)
//   civicPerk(s, id, c), answerBonus(s) the passive perks, read by game.mjs
import { FIELD_TILE, fieldTrees } from './field-layout.mjs';
import { DENS, REGION, OUTPOSTS, OUTPOST_SAFE, regionAt, borderDistance, trailDistance, inWorld, waterAt } from './regions.mjs';
import { landClear } from './land-features.mjs';
import { cageSpot, FRIEND_IDS } from './friends.mjs';
import { hyp } from './hyp.mjs';

/** A hut stands HUT_GAP from its den (then further out, ring by ring); its collider; how near you must stand to open it. */
export const HUT_GAP = 9, HUT_RADIUS = 2, HUT_REACH = 5.8;
/** Clearances the spot must keep (metres): borders, outposts, other dens, a cage, the trail's centre line, a tree's trunk edge. */
export const HUT_RULE = Object.freeze({ border: 8, outpost: OUTPOST_SAFE + 4, den: 14, cage: 4.5, trail: 5, tree: .5, edge: 10 });

// id, name, role, land, boss, hut style, facility plan, post x, z, rot, look, garment, colour, hat, boots, perk, line, unlock
const ROWS = [
  ['tilly', 'Tilly', 'School cook', 'west', 'treant', 'mushroom', 'school', 2.4, 4.6, 0, 'girl-tall-none-none', 'sunny', '#ff9c5b', 'hat_chef', '', { energy: 25 }, 'Soup first, questions later.', 'A free school lunch each day: +25 energy.'],
  ['dottie', 'Dottie', 'Stock clerk', 'south', 'mushking', 'cottage', 'supermarket', 7, -4, -.2, 'girl-tall-none-piggy', 'meadow', '#5cb85c', '', '', { seeds: 3 }, 'I count things. It calms me down.', 'One extra daily special: a free packet of seeds each day.'],
  ['barnaby', 'Barnaby', 'Librarian', 'toy', 'robot', 'blocks', 'school', 4.2, -3, 0, 'boy-tall-none-owl', 'plum', '#6a4fa0', '', '', { learn: 2 }, 'Shh. The books are sleeping.', 'A book of the day with a tip: two more paid lesson answers that day.'],
  ['marlow', 'Marlow', 'Baker’s hand', 'north', 'croc', 'stilt', 'bakery', -4, 2.5, .3, 'sturdy-tall-none-none', 'honey', '#d99a2b', 'hat_straw', 'boots_cowboy', { item: 'honey' }, 'Flour is just very shy snow.', 'A jar of wild honey from the bakery each day.'],
  ['gus', 'Gus', 'Second officer', 'east', 'bear', 'adobe', 'police', 4, 1, -.3, 'sturdy-tall-none-none', 'harbor', '#2d4f8f', 'hat_leather', 'boots_cowboy', { patrol: 15 }, 'I arrested a goat once. It was the wrong goat.', 'The village patrol pays 15 coins more.'],
  ['mabel', 'Mabel', 'Deli counter', 'candy', 'cake', 'gingerbread', 'supermarket', -6, -3.6, 0, 'girl-tall-bunny-none', 'berry', '#d8436f', '', '', { item: 'soup' }, 'Everything is better sliced thin.', 'A tub of Garden soup from the deli counter each day.'],
  ['otis', 'Otis', 'Receptionist', 'jungle', 'gorilla', 'treehut', 'company', 1.5, 3.5, 0, 'slim-tall-none-koala', 'sky', '#58a8e0', '', '', { hours: 1 }, 'Please hold. No, not the phone, the door.', 'The office shift takes one hour less: your papers are ready.'],
  ['greta', 'Greta', 'Pharmacist', 'ice', 'yeti', 'igloo', 'hospital', 5.5, -5, 0, 'slim-tall-none-penguin', 'sage', '#3fae9a', '', '', { energy: 15, heal: true }, 'Take two naps and call me in the morning.', 'One free remedy a day: health restored and +15 energy.'],
  ['winnie', 'Winnie', 'Accountant', 'ocean', 'leviathan', 'shack', 'company', 3, 1.5, -.3, 'girl-tall-cat-none', 'festival', '#7a5cc8', '', '', { shift: 15 }, 'I love a number that behaves.', 'A wage bonus: the office shift pays 15 coins more.'],
  ['edith', 'Edith', 'Doctor', 'lava', 'golem', 'lavastone', 'hospital', -1, -5, .4, 'slim-tall-none-none', 'ivory', '#dff0f5', '', 'boots_cloud', { checkup: 15 }, 'Say “aah”. Lovely. Now say it in tune.', 'The check-up costs half: 15 coins.'],
  ['felix', 'Felix', 'Assistant teacher', 'cloud', 'phoenix', 'cloud', 'school', 1, -6, .3, 'boy-tall-none-tiger', 'fern', '#3f9a4a', '', '', { answer: 2 }, 'There are no wrong answers. Except that one.', 'Every paid lesson answer earns 2 coins more.'],
  ['nora', 'Nora', 'Detective', 'shadow', 'shadowlord', 'lantern', 'police', 0, -3.2, .5, 'slim-tall-none-none', 'midnight', '#7a5a3a', 'hat_cowboy', '', { coins: 30 }, 'I already know what you had for breakfast.', 'A case closed each day: 30 coins of lost property returned.'],
];
export const PEOPLE = Object.freeze(ROWS.map(([id, name, role, land, boss, hut, plan, x, z, rot, look, garment, color, hat, boots, perk, line, unlock], index) => Object.freeze({
  id, name, role, land, boss, den: 'w:den:' + boss, hut, plan, post: Object.freeze({ x, z, rot }), perk: Object.freeze(perk), line, unlock, color, child: false, rescued: true, index,
  wear: Object.freeze([look, garment, color, hat, boots]),
})));
export const PERSON = Object.freeze(Object.fromEntries(PEOPLE.map(p => [p.id, p])));
export const RESCUE_IDS = Object.freeze(PEOPLE.map(p => p.id));
/** The favours you ask for (one a day each, the 'perk' action); the others are passive. */
export const ASKED = p => !!(p.perk.energy || p.perk.seeds || p.perk.learn || p.perk.item || p.perk.coins);

// ---------------------------------------------------------------- where the huts stand
/** The spots a hut tries: on rings HUT_GAP, +2 and +4 m from the den, starting square to the line den-village (a cage stands on that line) and swinging out on alternate sides. */
export function hutCandidates(den) {
  const base = Math.atan2(-den.z, -den.x) + Math.PI / 2, spots = [];
  for (let ring = 0; ring < 3; ring++) for (let i = 0; i < 16; i++) { const a = base + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * .39, r = HUT_GAP + ring * 2; spots.push({ x: den.x + Math.cos(a) * r, z: den.z + Math.sin(a) * r }); }
  return spots;
}
/** May a hut stand here? In the den's own land, on dry clear land, away from borders, the edge, outposts, other dens, cages and the trail, with no tree, rock or prop touching it. */
export function hutClear(x, z, den) {
  const R = HUT_RULE;
  if (regionAt(x, z) !== den.region || waterAt(x, z) || !inWorld(x, z, R.edge) || !landClear(x, z, HUT_RADIUS + .6)) return false;
  if (borderDistance(x, z) < R.border || trailDistance(x, z) < R.trail) return false;
  for (const o of OUTPOSTS) if (hyp(o.x - x, o.z - z) < R.outpost) return false;
  for (const d of DENS) if (d !== den && hyp(d.x - x, d.z - z) < R.den) return false;
  for (const id of FRIEND_IDS) { const c = cageSpot(id); if (c && hyp(c.x - x, c.z - z) < R.cage) return false; }
  const reach = HUT_RADIUS + 3;
  for (let tx = Math.floor((x - reach) / FIELD_TILE); tx <= Math.floor((x + reach) / FIELD_TILE); tx++) for (let tz = Math.floor((z - reach) / FIELD_TILE); tz <= Math.floor((z + reach) / FIELD_TILE); tz++)
    for (const t of fieldTrees(tx, tz)) if (hyp(t.x - x, t.z - z) < t.r + HUT_RADIUS + R.tree) return false;
  return true;
}
const spots = new Map();
/** Where a person's hut stands: the first clear candidate. A pure function of the world's seed: the same spot on every call. `clear` says the rule held. */
export function hutSpot(id) {
  if (spots.has(id)) return spots.get(id);
  const p = PERSON[id], den = p && DENS.find(d => d.id === p.den); if (!den) return null;
  const list = hutCandidates(den), at = list.find(c => hutClear(c.x, c.z, den)), pick = at ?? list[0];
  const spot = Object.freeze({ x: Math.round(pick.x * 100) / 100, z: Math.round(pick.z * 100) / 100, clear: !!at, den });
  spots.set(id, spot); return spot;
}

// ---------------------------------------------------------------- the rules
export function hutState(id, state) {
  const p = PERSON[id]; if (!p || state?.pandora !== true) return 'hidden';
  if (state.rescued?.[id]) return 'rescued';
  return state.defeated?.[p.boss] ? 'open' : 'barred';
}
export function hutStatuses(state, out = []) {
  let n = 0;
  if (state?.pandora === true) for (let i = 0; i < PEOPLE.length; i++) {
    const p = PEOPLE[i], at = hutSpot(p.id), o = out[n] ??= { id: '', x: 0, z: 0, state: '' };
    o.id = p.id; o.x = at.x; o.z = at.z; o.state = state.rescued?.[p.id] ? 'rescued' : state.defeated?.[p.boss] ? 'open' : 'barred'; n++;
  }
  out.length = n; return out;
}
export const isBack = (state, id) => !!state?.rescued?.[id];
export const rescuedList = state => PEOPLE.filter(p => isBack(state, p.id));
/** THE SEAM: the extra staff of a facility plan, in the shape facility-plans.mjs occupants() returns. Rescued people stay, box open or shut. */
export const postsFor = (planId, state) => PEOPLE.filter(p => p.plan === planId && isBack(state, p.id)).map(p => ({ p, at: p.post }));
export const heldIn = (land, state) => state?.pandora === true ? PEOPLE.find(p => p.land === land && !isBack(state, p.id)) ?? null : null;
/** The People panel: who is back (always), who is still missing (only while the box is open: with it shut nobody is held). */
export function peopleNote(state) {
  const back = rescuedList(state), missing = state?.pandora === true ? PEOPLE.filter(p => !isBack(state, p.id)) : [];
  return { back, missing };
}
export function parseRescued(raw) {
  const out = {};
  if (raw && typeof raw === 'object') for (const id of RESCUE_IDS) { const day = Number(raw[id]); if (Number.isFinite(day) && day >= 1) out[id] = Math.floor(day); }
  return out;
}

const ok = (message, extra) => ({ ok: true, message, ...extra }), fail = message => ({ ok: false, message });
const SEEDS = ['carrot', 'radish', 'pumpkin'];
/** The thank-you each one says on stepping out. */
export const THANKS = Object.freeze({
  tilly: 'Thank you! I kept the soup warm the whole time. In my heart.',
  dottie: 'Free! I counted the planks while I waited. Forty-one.',
  barnaby: 'Thank you. Quietly, please: I have a reputation.',
  marlow: 'You found me! I have been kneading the air for days.',
  gus: 'Thank you, citizen! I was about to arrest the door.',
  mabel: 'At last! The walls were delicious, and I regret nothing.',
  otis: 'Thank you for visiting. Do you have an appointment?',
  greta: 'Thank you! I prescribe myself one warm blanket.',
  winnie: 'Free at last! That is one of me, minus one hut.',
  edith: 'Thank you! My diagnosis: you are a very good neighbour.',
  felix: 'Thank you! Full marks, and a gold star.',
  nora: 'I knew you would come. I deduced it from the footsteps.',
});
export function rescueAct(s, type, arg = {}) {
  const p = PERSON[arg.id]; if (!p) return fail('Nobody is here.');
  if (type === 'hut') {
    const now = hutState(p.id, s), at = hutSpot(p.id);
    if (now === 'hidden' || now === 'rescued') return fail('This hut is empty.');
    if (now === 'barred') return fail(`🔒 ${p.name} is shut inside. The boss of this land holds the key.`);
    const x = Number.isFinite(arg.x) ? arg.x : s.position?.x, z = Number.isFinite(arg.z) ? arg.z : s.position?.z;
    if (!(hyp(x - at.x, z - at.z) <= HUT_REACH)) return fail(`Walk up to the hut to let ${p.name} out.`);
    (s.rescued ??= {})[p.id] = s.day;
    return ok(`🏠 ${p.name} is free and hurries home to work: ${p.role}.`, { id: p.id, hello: THANKS[p.id] });
  }
  if (type === 'perk') {
    if (!isBack(s, p.id) || !ASKED(p)) return fail('Nobody is here.');
    const days = s.rescuedPerk ??= {}, k = p.perk;
    if (days[p.id] === s.day) return fail(`${p.name} has helped you today already. Come back tomorrow.`);
    days[p.id] = s.day;
    if (k.energy) s.energy = Math.min(100, s.energy + k.energy);
    if (k.heal) s.hp = Math.max(s.hp ?? 100, 100);
    if (k.coins) s.coins += k.coins;
    if (k.item) s.inventory[k.item] = (s.inventory[k.item] ?? 0) + 1;
    if (k.seeds) { const id = 'seed_' + SEEDS[s.day % SEEDS.length]; s.inventory[id] = (s.inventory[id] ?? 0) + k.seeds; }
    if (k.learn) { if (s.learnDay !== s.day) { s.learnDay = s.day; s.learnCount = 0; } s.learnCount -= k.learn; }
    return ok(PERK_DONE[p.id]);
  }
  return fail('Nobody is here.');
}
export const PERK_DONE = Object.freeze({
  tilly: 'A hot school lunch. +25 energy',
  dottie: 'Today’s extra special: a free packet of seeds.',
  barnaby: 'You read the book of the day. Two more lesson answers pay today.',
  marlow: 'A jar of wild honey, still warm from the oven shelf.',
  mabel: 'A tub of Garden soup from the deli counter.',
  greta: 'One free remedy. Health restored and +15 energy',
  nora: 'Case closed: 30 coins of lost property returned.',
});
/** The passive perks of the civic actions (game.mjs 'civic'): the act itself, or a copy with the perk in it. */
export function civicPerk(s, id, c) {
  if (!c || !s.rescued) return c;
  if (id === 'police' && s.rescued.gus) return { ...c, pay: c.pay + PERSON.gus.perk.patrol, message: c.message + ' · Gus walked the second round: +15 coins' };
  if (id === 'hospital' && s.rescued.edith) return { ...c, cost: PERSON.edith.perk.checkup, message: c.message + ' · Edith halved the bill' };
  if (id === 'company' && (s.rescued.otis || s.rescued.winnie)) {
    const o = s.rescued.otis ? PERSON.otis.perk.hours : 0, w = s.rescued.winnie ? PERSON.winnie.perk.shift : 0;
    return { ...c, hours: c.hours - o, pay: c.pay + w, message: c.message + (o ? ' · Otis had your papers ready: one hour saved' : '') + (w ? ' · Winnie found a bonus: +15 coins' : '') };
  }
  return c;
}
export const answerBonus = s => s.rescued?.felix ? PERSON.felix.perk.answer : 0;
/** The People panel's note: who is back and what they bring; who is still missing and where (only while the box is open). '' when there is nothing to say. */
export function peopleHtml(state) {
  const { back, missing } = peopleNote(state); if (!back.length && !missing.length) return '';
  const row = (icon, p, text) => `<div class="rescued-row"><span>${icon} ${p.name} · ${p.role}</span><br><small>${text}</small></div>`;
  return `<div class="note friends-note rescued-note"><b>The missing workers</b> <span>${back.length} of 12 are back</span>${back.map(p => row('✅', p, p.unlock)).join('')}${missing.map(p => row('🔒', p, `held in ${REGION[p.land].name}`)).join('')}</div>`;
}
