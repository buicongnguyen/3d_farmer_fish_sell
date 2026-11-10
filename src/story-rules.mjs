// The rules half of Phase 3 (docs/STORY.md): everything game.mjs needs about the story that is not prose. Pure, small, and in the
// first-frame bundle. The prose (scenes, family lines, villager lines, with their Vietnamese beside the English) lives in
// story.mjs, family.mjs and villager-lines.mjs, which are fetched with import() through loadStory() (docs/STORY-WIRING.md).
//
// State keys (all optional in a save; parseSave gives each a default):
//   heartScenes {id: bitmask}   heart scenes already played: 1 = 2 hearts, 2 = 5 hearts, 4 = 8 hearts
//   pendingScenes [entry]       scenes waiting to be played: {k:'c', i:chapter, b:beat} or {k:'h', id, lv:2|5|8, b:beat}
//   ending ''|'stay'|'share'    the final choice, made once
//   yesterday {h, f, s}         what the last day held: harvests, fish caught, coins sold
//   mark {h, f, s}              the stat totals at the last sleep (so yesterday can be the difference)

export const HEART_LEVELS = [2, 5, 8];
export const ENDING_IDS = ['stay', 'share'];
/** Beats in each chapter's scene (checked against story.mjs by tests/story.test.mjs). The last chapter is longer once the ending is chosen. */
export const CHAPTER_BEATS = [7, 7, 6, 7, 7, 6, 6, 6];
export const FINAL_BEATS = { open: 6, chosen: 8, choiceAt: 5 };
/** Beats in each heart scene, per resident and level. */
export const HEART_BEATS = {
  ada: { 2: 4, 5: 4, 8: 5 },
  ellis: { 2: 4, 5: 4, 8: 5 },
  bea: { 2: 4, 5: 4, 8: 4 },
  theo: { 2: 4, 5: 4, 8: 5 },
  mara: { 2: 3, 5: 4, 8: 4 },
  hugo: { 2: 4, 5: 4, 8: 4 },
  nell: { 2: 4, 5: 4, 8: 4 },
  sylvie: { 2: 4, 5: 4, 8: 5 },
};
export const KEY_VILLAGERS = Object.keys(HEART_BEATS);

/** Loved gifts give +4 friendship, disliked ones are politely handed back, anything else gives +2. */
export const GIFTS = {
  ada: { loved: ['pie', 'apple', 'honey'], disliked: ['chili', 'durian'] },
  ellis: { loved: ['perch', 'carp', 'coffee'], disliked: ['candy', 'durian'] },
  bea: { loved: ['daisy', 'tulip', 'berry'], disliked: ['eel', 'claw'] },
  theo: { loved: ['cog', 'coffee', 'obsidian'], disliked: ['tulip', 'berry'] },
  mara: { loved: ['carrot', 'clover', 'milk'], disliked: ['hide', 'tusk'] },
  hugo: { loved: ['egg', 'sugar', 'honey'], disliked: ['chili', 'mushroom'] },
  nell: { loved: ['sunflower', 'rainbowrose', 'star'], disliked: ['wood', 'cog'] },
  sylvie: { loved: ['apple', 'peach', 'nectar'], disliked: ['eel', 'hide'] },
};
export const giftTaste = (id, item) =>
  GIFTS[id]?.loved.includes(item) ? 'loved' : GIFTS[id]?.disliked.includes(item) ? 'disliked' : 'liked';
export const GIFT_POINTS = { loved: 4, liked: 2, disliked: 0 };

/**
 * What each heart scene pays. Once: {coins}, {items: {id: n}}. Lasting (counted from the scenes played): {rest} one more rest a day,
 * {sell} more for everything sold, {seeds} cheaper seeds, {love} one extra friendship point on every gift they like.
 */
export const PERKS = {
  ada: { 2: { items: { pie: 1, egg: 2 } }, 5: { rest: 1 }, 8: { coins: 300 } },
  ellis: { 2: { items: { perch: 2 } }, 5: { sell: 0.03 }, 8: { items: { golden: 1, koi: 1 } } },
  bea: { 2: { coins: 60 }, 5: { love: 1 }, 8: { coins: 200 } },
  theo: { 2: { items: { cog: 2 } }, 5: { seeds: 0.05 }, 8: { coins: 250 } },
  mara: { 2: { items: { egg: 3, milk: 1 } }, 5: { items: { truffle: 1, milk: 2 } }, 8: { sell: 0.03 } },
  hugo: { 2: { items: { pie: 1 } }, 5: { seeds: 0.05 }, 8: { items: { pie: 3 } } },
  nell: { 2: { coins: 80 }, 5: { love: 1 }, 8: { coins: 200 } },
  sylvie: { 2: { items: { apple: 3 } }, 5: { seeds: 0.05 }, 8: { items: { peach: 3, mango: 1 } } },
};
const BIT = { 2: 1, 5: 2, 8: 4 };
export const levelSeen = (s, id, lv) => ((s.heartScenes?.[id] ?? 0) & BIT[lv]) !== 0;

/** The lasting perks of the heart scenes played: {rest, sell, seeds, love}. */
export const heartPerks = s => {
  const total = { rest: 0, sell: 0, seeds: 0, love: 0 };
  for (const id of KEY_VILLAGERS)
    for (const lv of HEART_LEVELS) {
      if (!levelSeen(s, id, lv)) continue;
      const p = PERKS[id][lv];
      for (const k of Object.keys(total)) total[k] += p[k] ?? 0;
    }
  return total;
};

// ---------------------------------------------------------------- pending scenes
const isHeart = e => e.k === 'h';
export const entryLength = (s, e) =>
  isHeart(e)
    ? HEART_BEATS[e.id][e.lv]
    : e.i === 7
      ? s.ending
        ? FINAL_BEATS.chosen
        : FINAL_BEATS.open
      : CHAPTER_BEATS[e.i];
const queued = (s, pred) => (s.pendingScenes ??= []).some(pred);
export const queueChapter = (s, i) => {
  if (!queued(s, e => !isHeart(e) && e.i === i)) s.pendingScenes.push({ k: 'c', i, b: 0 });
};
/** Queue every heart scene the friendships have earned and not yet played, and the final choice once the last chapter is claimed. */
export function queueStory(s) {
  s.pendingScenes ??= [];
  s.heartScenes ??= {};
  for (const id of KEY_VILLAGERS)
    for (const lv of HEART_LEVELS)
      if (
        (s.friendship[id] ?? 0) >= lv &&
        !levelSeen(s, id, lv) &&
        !queued(s, e => isHeart(e) && e.id === id && e.lv === lv)
      )
        s.pendingScenes.push({ k: 'h', id, lv, b: 0 });
  if (s.chapter >= 8 && !s.ending && !queued(s, e => !isHeart(e) && e.i === 7))
    s.pendingScenes.push({ k: 'c', i: 7, b: FINAL_BEATS.choiceAt });
}

/** A heart scene is over: mark it seen and pay its one-off perk. Returns the message. */
function finishHeart(s, e) {
  s.heartScenes[e.id] = (s.heartScenes[e.id] ?? 0) | BIT[e.lv];
  const p = PERKS[e.id][e.lv];
  if (p.coins) {
    s.coins += p.coins;
    return `A thank-you: +${p.coins} coins`;
  }
  if (p.items) {
    for (const [id, n] of Object.entries(p.items)) s.inventory[id] = (s.inventory[id] ?? 0) + n;
    return 'A thank-you gift is in your basket.';
  }
  if (p.rest) return 'A new habit: one more rest at home each day.';
  if (p.sell) return 'Word gets round: your goods fetch a little more.';
  if (p.seeds) return 'The seed prices come down a little.';
  return 'Your gifts warm hearts a little more.';
}

/** The sceneNext action: move the first pending scene on one beat; at its end remove it (and pay a heart scene's perk). */
export function sceneNext(s) {
  const e = s.pendingScenes[0];
  if (!e) return { ok: false, message: '' };
  const n = entryLength(s, e);
  if (!isHeart(e) && e.i === 7 && !s.ending && e.b >= FINAL_BEATS.choiceAt)
    return { ok: false, message: 'Choose how the story goes on.' };
  if (e.b + 1 < n) {
    e.b++;
    return { ok: true, message: '' };
  }
  s.pendingScenes.shift();
  return { ok: true, message: isHeart(e) ? finishHeart(s, e) : '', done: true };
}

/** The choose action: the final choice, made once after the last chapter is claimed. */
export function choose(s, id) {
  if (!ENDING_IDS.includes(id)) return { ok: false, message: 'Choose one of the two endings.' };
  if (s.chapter < 8) return { ok: false, message: 'That choice comes at the end of the story.' };
  if (s.ending) return { ok: false, message: 'The family has already chosen.' };
  s.ending = id;
  return { ok: true, message: 'The family has chosen.' };
}

// ---------------------------------------------------------------- saves
const clamp = (v, lo, hi) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.floor(v))) : lo;
const tally = raw => ({ h: clamp(raw?.h, 0, 1e9), f: clamp(raw?.f, 0, 1e9), s: clamp(raw?.s, 0, 1e9) });
/** The story keys of a raw save, cleaned. `s.chapter` must already be parsed. */
export function parseStory(raw, s) {
  const out = {
    heartScenes: {},
    pendingScenes: [],
    ending: '',
    yesterday: tally(raw.yesterday),
    mark: tally(raw.mark),
  };
  for (const id of KEY_VILLAGERS) {
    const seen = clamp(raw.heartScenes?.[id], 0, 7);
    if (seen) out.heartScenes[id] = seen;
  }
  if (ENDING_IDS.includes(raw.ending) && s.chapter >= 8) out.ending = raw.ending;
  if (Array.isArray(raw.pendingScenes))
    for (const e of raw.pendingScenes.slice(0, 40)) {
      if (!e || typeof e !== 'object') continue;
      if (e.k === 'h' && HEART_BEATS[e.id]?.[e.lv]) {
        if (!(out.heartScenes[e.id] & BIT[e.lv]))
          out.pendingScenes.push({ k: 'h', id: e.id, lv: e.lv, b: clamp(e.b, 0, HEART_BEATS[e.id][e.lv] - 1) });
      } else if (e.k === 'c' && Number.isInteger(e.i) && e.i >= 0 && e.i < CHAPTER_BEATS.length && e.i < s.chapter)
        out.pendingScenes.push({
          k: 'c',
          i: e.i,
          b: clamp(e.b, 0, (e.i === 7 ? FINAL_BEATS.chosen : CHAPTER_BEATS[e.i]) - 1),
        });
    }
  return out;
}

// ---------------------------------------------------------------- the lazy prose
/** Filled by loadStory(): {story, family, lines}. Until then game.mjs falls back to each villager's one line. */
export const hooks = { story: null, family: null, lines: null };
let loading = null;
/** Fetch the prose modules (story.mjs, family.mjs, villager-lines.mjs) once, after the first frame. Resolves to the hooks. */
export const loadStory = () =>
  (loading ??= Promise.all([import('./story.mjs'), import('./family.mjs'), import('./villager-lines.mjs')]).then(
    ([story, family, lines]) => {
      Object.assign(hooks, { story, family, lines });
      return hooks;
    },
  ));
