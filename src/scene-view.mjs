// One beat of a story scene as HTML (docs/STORY-WIRING.md). Pure: a string in, a string out. The buttons use the game's own
// data-action="do" handler: sceneNext moves the scene on, choose makes the final choice. Styles are in story.css.
import { RESIDENTS } from './content.mjs';
import { t } from './i18n.mjs';

const esc = text =>
  String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const COLOUR = Object.fromEntries(RESIDENTS.map(p => [p.id, p.color]));
const NAME = Object.fromEntries(RESIDENTS.map(p => [p.id, p.name]));

/**
 * @param {{who: string, text: string, choices?: {id: string, label: string}[]}} beat  from sceneFor() / viewPending()
 * @param {number} index  0-based position of the beat
 * @param {number} total  beats in the scene
 * @param {Record<string, string>} [names]  display names by speaker id; 'you' is the player's (default “You”)
 */
export function sceneHtml(beat, index, total, names = {}) {
  const who = beat.who,
    narrator = who === 'narrator',
    name = narrator ? '' : (names[who] ?? (who === 'you' ? t('You') : (NAME[who] ?? who))),
    colour = who === 'you' ? '#7aa05f' : (COLOUR[who] ?? '#9a9a86');
  const dots = Array.from({ length: total }, (_, i) => `<i${i <= index ? ' class="on"' : ''}></i>`).join('');
  const choices = beat.choices?.length
    ? `<div class="scene-choices">${beat.choices
        .map(
          c =>
            `<button class="primary" data-action="do" data-type="choose" data-id="${esc(c.id)}">${esc(c.label)}</button>`,
        )
        .join('')}</div>`
    : `<button class="primary scene-next" data-action="do" data-type="sceneNext">${t(index + 1 >= total ? 'Close' : 'Next')}</button>`;
  return `<div class="scene" data-who="${esc(who)}">${
    narrator ? '' : `<span class="scene-portrait" style="--shirt:${colour}">${esc(name[0] ?? '')}</span>`
  }<div class="scene-body">${narrator ? '' : `<b class="scene-name">${esc(name)}</b>`}<p class="scene-text${narrator ? ' narrator' : ''}">${esc(beat.text)}</p></div><div class="scene-dots" aria-hidden="true">${dots}</div>${choices}</div>`;
}
