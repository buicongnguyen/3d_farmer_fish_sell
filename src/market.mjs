// The market's appetite (Phase 2 of docs/REVIEW-2026-11-10.md). The village only wants so much of one thing a day: the first
// units of a kind sell at full price, the next at half, the rest at a fifth. A bigger farm then earns more by growing a
// variety, not by planting one crop in every bed. The count starts again each morning (state.soldToday: {day, counts}).

/** Price shares by how many of the kind were sold already today. */
export const DEMAND = [
  { upTo: 6, rate: 1 },
  { upTo: 12, rate: 0.5 },
  { upTo: Infinity, rate: 0.2 },
];

/** The share of the full price for the next unit, when `sold` units of that kind have gone today. */
export const demandRate = sold => DEMAND.find(step => sold < step.upTo).rate;

/** Selling `n` units whose full price is `price`, after `sold` of them today: {total, full} (full: how many went at the full price). */
export function sellRun(price, sold, n) {
  let total = 0,
    full = 0;
  for (let i = 0; i < n; i++) {
    const rate = demandRate(sold + i);
    total += Math.floor(price * rate);
    if (rate === 1) full++;
  }
  return { total, full };
}

/** What is left at full price today for a kind. */
export const fullLeft = (soldToday, day, id) =>
  Math.max(0, DEMAND[0].upTo - (soldToday?.day === day ? (soldToday.counts?.[id] ?? 0) : 0));

/** The counts as saved: only today's, only known kinds, whole numbers. */
export function parseSoldToday(raw, day, known) {
  const out = { day: 0, counts: {} };
  if (!raw || typeof raw !== 'object' || raw.day !== day) return out;
  out.day = day;
  for (const [id, n] of Object.entries(raw.counts && typeof raw.counts === 'object' ? raw.counts : {}).slice(0, 200))
    if (known(id) && Number.isFinite(n) && n > 0) out.counts[id] = Math.min(99999, Math.floor(n));
  return out;
}
