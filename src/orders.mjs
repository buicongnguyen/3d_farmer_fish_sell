// The order board (Phase 2): each day three neighbours ask for a small bundle of crops.
// Orders come from the day number, so they need no storage; only which were filled today is saved.
// A bundle pays about 1.6 times the market price and warms the friendship by one heart point.
export const ORDERS_PER_DAY = 3;
export const ORDER_BONUS = 1.6;
const ASKERS = ['ada', 'ellis', 'bea', 'theo', 'mara', 'hugo', 'nell', 'sylvie'];

/** A small, repeatable random sequence for one day. */
function rng(seed) {
  let x = (seed * 2654435761) >>> 0 || 1;
  return () => ((x = (x * 1103515245 + 12345) >>> 0), x / 4294967296);
}

/** Today's orders: [{who, items: {crop: n}, reward}]. `crops` is the CROPS table, `open(id)` says whether a crop is unlocked. */
export function ordersFor(day, crops, open) {
  const pool = Object.keys(crops).filter(id => !crops[id].free && crops[id].sell && open(id));
  if (!pool.length) return [];
  const r = rng(day + 7);
  const out = [];
  for (let i = 0; i < ORDERS_PER_DAY; i++) {
    const left = ASKERS.filter(a => !out.some(x => x.who === a)),
      who = left[Math.floor(r() * left.length)];
    const kinds = Math.min(pool.length, 1 + Math.floor(r() * 2));
    const items = {};
    while (Object.keys(items).length < kinds) items[pool[Math.floor(r() * pool.length)]] = 2 + Math.floor(r() * 4);
    const worth = Object.entries(items).reduce((t, [id, n]) => t + crops[id].sell * n, 0);
    out.push({ who, items, reward: Math.round(worth * ORDER_BONUS) });
  }
  return out;
}

/** The saved part: {day, filled: [order indexes]}; another day's record means nothing is filled yet. */
export const parseOrders = (raw, day) =>
  raw && raw.day === day && Array.isArray(raw.filled)
    ? { day, filled: [...new Set(raw.filled.filter(i => Number.isInteger(i) && i >= 0 && i < ORDERS_PER_DAY))] }
    : { day, filled: [] };
