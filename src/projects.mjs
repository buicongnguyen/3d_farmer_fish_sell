// Village projects (Phase 2 of docs/REVIEW-2026-11-10.md): the coin sink the farm lacked. The family funds the village's
// improvements one at a time, in a fixed order; each pays back in a small, real way. state.projects is {id: day funded}.
// Pure rules: game.mjs applies the perks (rest, sellPrice, buySeed, festival).

export const PROJECTS = [
  { id: 'well', name: 'Mend the village well', cost: 300, perk: 'One more rest at home each day.', rest: 1 },
  {
    id: 'cart',
    name: 'A cart for the market square',
    cost: 800,
    perk: 'Everything you sell fetches 5% more.',
    sell: 0.05,
  },
  { id: 'seedbank', name: 'Open the seed bank', cost: 1500, perk: 'Seeds cost 20% less at the market.', seeds: 0.2 },
  {
    id: 'lanterns',
    name: 'Hang lanterns along the lane',
    cost: 3000,
    perk: 'The harvest supper pays half as much again.',
    supper: 0.5,
  },
  {
    id: 'clock',
    name: 'Wind the old clock tower',
    cost: 6000,
    perk: 'Everything you sell fetches 5% more, again.',
    sell: 0.05,
  },
];

export const projectById = id => PROJECTS.find(p => p.id === id);
export const funded = (s, id) => !!s.projects?.[id];
/** The one project that can be funded now: the first not yet funded. Null when the village is finished. */
export const nextProject = s => PROJECTS.find(p => !funded(s, p.id)) ?? null;
/** What the funded projects add up to: {rest, sell, seeds, supper}. */
export const perks = s => {
  const total = { rest: 0, sell: 0, seeds: 0, supper: 0 };
  for (const p of PROJECTS) if (funded(s, p.id)) for (const k of Object.keys(total)) total[k] += p[k] ?? 0;
  return total;
};
/** Keep only funded projects that exist, with a sane day. */
export const parseProjects = (raw, day) => {
  const out = {};
  if (raw && typeof raw === 'object')
    for (const p of PROJECTS) {
      const d = raw[p.id];
      if (typeof d === 'number' && Number.isFinite(d)) out[p.id] = Math.max(1, Math.min(day, Math.floor(d)));
    }
  return out;
};
