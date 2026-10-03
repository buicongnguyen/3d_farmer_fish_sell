// The character builder at the bedroom mirror, after Zoo Garden's looks (cute_game src/looks.ts): four choices that
// combine freely.
//   body    boy | girl | sturdy | slim          free (who you are is never paid for)
//   height  tiny | chibi | teen | tall | grown  tall is Willowmere's own body and free; the others 75–110 coins
//   ears    none | cat | bunny                  110 coins each (they come with their tail)
//   hood    none | twelve animal hoods          80–105 coins
// A look id is body-height-ears-hood ('girl-tall-none-none'). Owning an option unlocks it for every combination; wearing
// owned options is free. Prices sit where Willowmere's shirt colours do (75–125 coins): a cosmetic bought once.
// Sturdy is the boy file made broader at load and slim the girl file made slender (BUILD), so builds cost no files.
// A hood rides where the ears do and brings its own ears, so the Ears row's ears are left off under it (the tail
// stays); a hat covers both. Cosmetic only.
//
// Pure state (no three.js, no DOM): game.mjs runs the rules, avatar.mjs reads FIT/BUILD/bodyFile, the tests import it.
export const BODIES = ['boy', 'girl', 'sturdy', 'slim'];
export const HEIGHTS = ['tiny', 'chibi', 'teen', 'tall', 'grown'];
export const EARS = ['none', 'cat', 'bunny'];
export const HOODS = ['none', 'bear', 'panda', 'fox', 'kitty', 'frog', 'piggy', 'chick', 'koala', 'tiger', 'penguin', 'monkey', 'owl'];
export const ROWS = { body: BODIES, height: HEIGHTS, ears: EARS, hood: HOODS };
export const ROW_IDS = ['body', 'height', 'ears', 'hood'];
export const ROW_NAMES = { body: 'Body', height: 'Height', ears: 'Ears', hood: 'Hood' };
const o = (name, price, icon, art) => ({ name, price, icon, art });
/** Every option: name, price in coins, an emoji stand-in and its portrait (assets/icons/looks/<art>.webp). */
export const OPTIONS = {
  body: { boy: o('Boy', 0, '👦', 'boy'), girl: o('Girl', 0, '👧', 'girl'), sturdy: o('Sturdy', 0, '💪', 'sturdy'), slim: o('Slim', 0, '🌿', 'slim') },
  height: { tiny: o('Tiny', 75, '👶', 'tiny'), chibi: o('Chibi', 75, '🧒', 'chibi'), teen: o('Teen', 75, '🧑', 'teen'), tall: o('Tall', 0, '🧍', 'tall'), grown: o('Grown-up', 110, '🚶', 'grown') },
  ears: { none: o('No ears', 0, '🙂', 'none'), cat: o('Cat ears', 110, '🐱', 'cat'), bunny: o('Bunny ears', 110, '🐰', 'bunny') },
  hood: {
    none: o('No hood', 0, '✨', 'bare'), bear: o('Bear hood', 80, '🐻', 'bear'), panda: o('Panda hood', 95, '🐼', 'panda'), fox: o('Fox hood', 90, '🦊', 'fox'),
    kitty: o('Kitty hood', 80, '🐱', 'kitty'), frog: o('Frog hood', 80, '🐸', 'frog'), piggy: o('Piggy hood', 80, '🐷', 'piggy'), chick: o('Chick hood', 80, '🐥', 'chick'),
    koala: o('Koala hood', 95, '🐨', 'koala'), tiger: o('Tiger hood', 105, '🐯', 'tiger'), penguin: o('Penguin hood', 90, '🐧', 'penguin'), monkey: o('Monkey hood', 90, '🐵', 'monkey'), owl: o('Owl hood', 95, '🦉', 'owl'),
  },
};
export const DEFAULT_LOOK = 'girl-tall-none-none';
/** Standing height of each height's body file over the chibi's (measured from the GLBs). */
export const HEIGHT_RATIO = { tiny: .979, chibi: 1, teen: 1.066, tall: 1.152, grown: 1.398 };
/**
 * Willowmere's slim silhouette was drawn for its own tall body, the one every villager wears: that rig is narrowed to
 * 85% across. The other heights are the reference's bodies and keep the proportions they were modelled with, so they
 * stand exactly as they do in Zoo Garden; narrowed too, the Grown-up (five heads tall, legs half its height) walked on stilts.
 */
export const SLIM_TALL = .85;
export const SLIM = { tiny: 1, chibi: 1, teen: 1, tall: SLIM_TALL, grown: 1 };
/** How wide a look's rig is drawn (x and z), 1 = as modelled. */
export const slimOf = id => SLIM[splitLook(id).height] ?? 1;
/** Paid option ids (what `looksOwned` may hold). They are unique across the rows. */
export const PAID = ROW_IDS.flatMap(row => ROWS[row].filter(v => OPTIONS[row][v].price > 0));

export const splitLook = id => { const [body, height, ears, hood] = String(id).split('-'); return { body, height, ears, hood }; };
export const joinLook = l => `${l.body}-${l.height}-${l.ears}-${l.hood}`;
export const isLook = id => { if (typeof id !== 'string') return false; const p = id.split('-'); return p.length === 4 && ROW_IDS.every((row, i) => ROWS[row].includes(p[i])); };
/** A look id, or an older value mapped onto the builder: the old `body` field ('girl' | 'boy'), or Zoo Garden's 'bare' hood. */
export function toLook(v) {
  if (isLook(v)) return v;
  if (v === 'girl' || v === 'boy') return `${v}-tall-none-none`;
  if (typeof v === 'string') { const p = v.split('-'); if (p.length === 4 && p[3] === 'bare') { p[3] = 'none'; if (isLook(p.join('-'))) return p.join('-'); } if (p.length === 3 && isLook(v + '-none')) return v + '-none'; }
  return undefined;
}
/** [[row, value], …] of a look. */
export const lookOptions = id => { const l = splitLook(id); return ROW_IDS.map(row => [row, l[row]]); };
export const optionOf = (row, value) => OPTIONS[row]?.[value];
/** The Blender body a build starts from. */
export const baseBody = body => body === 'sturdy' ? 'boy' : body === 'slim' ? 'girl' : body;
/** The body × height model file (without extension): hero, hero-girl, hero-tall, hero-girl-tall… */
export const bodyFile = (body, height) => ['hero', ...(baseBody(body) === 'girl' ? ['girl'] : []), ...(height === 'chibi' ? [] : [height])].join('-');
export const lookName = id => lookOptions(id).filter(([row, v], i) => i < 2 || OPTIONS[row][v].price > 0).map(([row, v]) => OPTIONS[row][v].name).join(' · ');
/** The option a toast names: the hood, else the ears, else the body. */
export const headline = id => { const l = splitLook(id); return l.hood !== 'none' ? ['hood', l.hood] : l.ears !== 'none' ? ['ears', l.ears] : ['body', l.body]; };

// ---------------------------------------------------------------- fit (avatar.mjs)
/** Where gear, ears and tails are modelled (the chibi hero's pivots), before a height's FIT moves them. */
export const DEFAULT_PIVOTS = { body: [0, .85, 0], head: [0, 1.12, 0], 'arm-left': [-.37, 1.08, -.02], 'arm-right': [.37, 1.08, -.02], 'leg-left': [-.18, .52, 0], 'leg-right': [.18, .52, 0], 'hand-left': [-.37, .72, .05], 'hand-right': [.37, .72, .05] };
const fit = (head, tw, th, aw, al, e) => ({
  head: { scale: [head, head, head], offset: [0, 0, 0] }, body: { scale: [tw, th, tw], offset: [0, 0, 0] },
  'arm-left': { scale: [aw, al, aw], offset: [0, 0, 0] }, 'arm-right': { scale: [aw, al, aw], offset: [0, 0, 0] },
  'leg-left': { scale: [1, 1, 1], offset: [0, -e, 0] }, 'leg-right': { scale: [1, 1, 1], offset: [0, -e, 0] }, 'hand-right': { scale: [1, 1, 1], offset: [0, 0, 0] },
});
/** Gear fit per hero part and height (part space: scale, then offset). */
export const FIT = { tiny: fit(1.1, 1.04, .88, 1, .9, -.1), chibi: {}, teen: fit(.9, .9, 1.08, .94, 1.22, .2), tall: fit(.76, .8, 1.2, .86, 1.55, .46), grown: fit(.52, .74, 1.5, .8, 3, 1.1) };
/** Builds, applied at load to the base body's parts: torso [x, z], limb thickness, shoulder and hip spread. */
export const BUILD = { sturdy: { torso: [1.2, 1.15], limb: 1.18, spread: 1.17, hips: 1.12 }, slim: { torso: [.86, .9], limb: .86, spread: .87, hips: .9 } };
const ONE = { scale: [1, 1, 1], offset: [0, 0, 0] };
/** The gear fit of a whole look: the height's FIT, then the build's widths. */
export function fitOf(id) {
  const l = splitLook(id), base = FIT[l.height] ?? {}, b = BUILD[l.body]; if (!b) return base;
  const out = { ...base }, widen = (part, x, z) => { const f = base[part] ?? ONE; out[part] = { scale: [f.scale[0] * x, f.scale[1], f.scale[2] * z], offset: [f.offset[0] * x, f.offset[1], f.offset[2] * z] }; };
  widen('body', b.torso[0], b.torso[1]); for (const p of ['arm-left', 'arm-right', 'leg-left', 'leg-right']) widen(p, b.limb, b.limb);
  return out;
}

// ---------------------------------------------------------------- owning and wearing (state: {coins, look, looksOwned, body})
export const lookOf = s => toLook(s?.look) ?? toLook(s?.body) ?? DEFAULT_LOOK;
export const ownsOption = (s, row, value) => OPTIONS[row]?.[value]?.price === 0 || !!s.looksOwned?.includes(value);
/** The options of a look still to buy: [[row, value], …]. */
export const missingOptions = (s, id) => lookOptions(id).filter(([row, v]) => !ownsOption(s, row, v));
export const lookPrice = (s, id) => missingOptions(s, id).reduce((n, [row, v]) => n + OPTIONS[row][v].price, 0);
export const ownsLook = (s, id) => { const look = toLook(id); return !!look && missingOptions(s, look).length === 0; };
/** The look with one option changed. */
export function swapOption(id, row, value) { const l = splitLook(id); if (ROWS[row]?.includes(value)) l[row] = value; return joinLook(l); }
const set = (s, look) => { s.look = look; s.body = baseBody(splitLook(look).body); };
/**
 * game.mjs act(s, 'look', {id}): wears a look of owned options (free), or buys whatever it still needs and wears it.
 * Nothing changes when the coins are short.
 */
export function lookAction(s, arg = {}) {
  const look = toLook(arg.id); if (!look) return { ok: false, message: 'That look is not in the mirror.' };
  const missing = missingOptions(s, look), price = lookPrice(s, look);
  if (!missing.length) { if (lookOf(s) === look) return { ok: false, message: 'You are wearing this look.' }; set(s, look); return { ok: true, message: `Now wearing: ${lookName(look)}.` }; }
  if (!Number.isFinite(s.coins) || s.coins < price) return { ok: false, message: `This look needs ${price} coins.` };
  s.coins -= price; s.looksOwned ??= []; for (const [, v] of missing) if (!s.looksOwned.includes(v)) s.looksOwned.push(v);
  set(s, look); return { ok: true, message: `A new look: ${lookName(look)}!` };
}
/** game.mjs act(s, 'body', {id}): the old two-way body choice, kept for the atelier's picker. */
export function bodyAction(s, arg = {}) {
  if (!['girl', 'boy'].includes(arg.id)) return { ok: false, message: 'Choose a character style.' };
  set(s, swapOption(lookOf(s), 'body', arg.id)); return { ok: true, message: 'A fresh look.' };
}
/** Sanitises the look fields of a loaded save: owned options that exist, and a look made only of owned (or free) options. */
export function parseLook(raw) {
  const looksOwned = Array.isArray(raw?.looksOwned) ? [...new Set(raw.looksOwned.filter(v => PAID.includes(v)))] : [];
  const fallback = toLook(raw?.body === 'boy' ? 'boy' : 'girl'), wanted = toLook(raw?.look) ?? fallback;
  const look = missingOptions({ looksOwned }, wanted).length ? fallback : wanted;
  return { look, looksOwned, body: baseBody(splitLook(look).body) };
}
