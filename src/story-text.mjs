// Bilingual lines for the story modules. A line is 'English|Tiếng Việt' (the same shape as the talk-*.mjs tables): the Vietnamese sits
// beside the English, so a new line cannot be added without it (tests check every line has both halves), and the first-frame
// bundle does not carry the translations. `L` picks the half for the current language; `en` and `vi` pick one directly.
import { getLanguage } from './i18n.mjs';
import { applyNames } from './vi-names.mjs';

export const en = line => line.slice(0, line.indexOf('|'));
export const vi = line => line.slice(line.indexOf('|') + 1);
/** The line in the player's language (Vietnamese goes through the one table of names, like every other Vietnamese text). */
export const L = line => (getLanguage() === 'vi' ? applyNames(vi(line)) : en(line));
export const hasBoth = line => typeof line === 'string' && line.includes('|') && !!en(line).trim() && !!vi(line).trim();

/** Calendar facts the prose needs, kept here so no prose module imports game.mjs. Same rules as game.mjs calendar(). */
export const seasonOf = day => Math.floor((day - 1) / 7) % 4;
export const rainOn = day => day > 0 && day % 5 === 0;
/** A small stable hash of numbers and words, for picking a line that does not change within a day. */
export function hash(...parts) {
  let h = 2166136261;
  for (const c of parts.join(':')) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
}
export const projectsFunded = s => Object.keys(s.projects ?? {}).length;
