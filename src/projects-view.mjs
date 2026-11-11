// The "Village" tab of the family album: the projects the family can fund, one at a time (projects.mjs).
import { PROJECTS, funded, nextProject } from './projects.mjs';
import { RESIDENTS, CROPS } from './content.mjs';
import { todaysOrders } from './game.mjs';
import { jobsLeft, JOBS_PER_DAY } from './jobs.mjs';
const tJobs = (n, max) => `Paid jobs today: ${n} / ${max}`;

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

/** The order board: today's three bundles, who asks, what they pay. */
export function ordersHtml(s) {
  const filled = s.orders?.day === s.day ? s.orders.filled : [];
  const rows = todaysOrders(s)
    .map((o, i) => {
      const who = RESIDENTS.find(p => p.id === o.who)?.name ?? o.who,
        need = Object.entries(o.items)
          .map(([id, n]) => `${(s.inventory[id] ?? 0) >= n ? '✅ ' : ''}${n} × ${esc(CROPS[id].name)}`)
          .join(' · '),
        can = Object.entries(o.items).every(([id, n]) => (s.inventory[id] ?? 0) >= n),
        done = filled.includes(i);
      const action = done
        ? '<b class="project-done">Delivered</b>'
        : `<button class="primary" data-action="do" data-type="fillOrder" data-index="${i}" ${can ? '' : 'disabled'}>Deliver · ${o.reward} coins</button>`;
      return `<article class="memory ${done ? 'locked' : ''}"><span>📦</span><div><h3>${esc(who)}</h3><p>${need}</p>${action}</div></article>`;
    })
    .join('');
  return `<p class="panel-intro"><b>${tJobs(JOBS_PER_DAY - jobsLeft(s), JOBS_PER_DAY)}</b> · the running prize, a shift or patrol, and a day of lessons share these. A third one pays nothing.</p><h3 class="order-title">Order board</h3><p class="panel-intro">Neighbours ask for a few crops each day and pay well for them. New orders every morning.</p><div class="memories">${rows}</div>`;
}
