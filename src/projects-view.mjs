// The "Village" tab of the family album: the projects the family can fund, one at a time (projects.mjs).
import { PROJECTS, funded, nextProject } from './projects.mjs';

const esc = text =>
  String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function projectsHtml(s) {
  const next = nextProject(s);
  const cards = PROJECTS.map((p, i) => {
    const done = funded(s, p.id),
      now = next?.id === p.id,
      can = (s.coins ?? 0) >= p.cost;
    const action = done
      ? '<b class="project-done">Done</b>'
      : now
        ? `<button class="primary" data-action="do" data-type="fund" data-id="${p.id}" ${can ? '' : 'disabled'}>Fund · ${p.cost} coins</button>`
        : '<small>After the one before</small>';
    return `<article class="memory ${done || now ? '' : 'locked'}"><span>0${i + 1}</span><div><h3>${esc(p.name)}</h3><p>${esc(p.perk)}</p>${action}</div></article>`;
  }).join('');
  const intro = next
    ? 'The village mends one thing at a time. Fund the next one with your harvest money.'
    : 'Every project is done. The village is yours to enjoy.';
  return `<p class="panel-intro">${intro}</p><div class="memories">${cards}</div>`;
}
