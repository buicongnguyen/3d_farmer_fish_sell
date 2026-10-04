// The director: game state in, a plan out (which piece, which variant, which fight, tension, ko, panel). Polled at 4 Hz by index.mjs, never per frame.
// resolve(info) is pure (priorities, design 4); Director.update(info, t) adds the hysteresis so borders and threats cannot flap.
//   priority, highest wins: fight 100, ko 90, tension overlay 80 (a layer, never a piece), region 60, interior or shop panel 50, race or festival 45, fishing 40, village 30, title 10
import { LAND_KEY } from './scores-core.mjs';

export const REGIONS = ['west', 'north', 'south', 'east', 'toy', 'candy', 'jungle', 'ice', 'ocean', 'lava', 'cloud', 'shadow'];
export const INTERIORS = { home: 'home', visit: 'visit', shop: 'shop', market: 'market', civic: 'civic' };
export const todOf = h => h >= 5 && h < 11 ? 'morning' : h >= 11 && h < 17 ? 'day' : h >= 17 && h < 20 ? 'evening' : 'night';
export const variantOf = i => ({ tod: todOf(i.time ?? 12), season: String(i.season ?? 'spring').toLowerCase(), rain: !!i.rain, riding: i.riding | 0, farm: !!i.farm });
export const NEEDS_WORLD = new Set([...REGIONS, 'boss', 'titan']);

/** The piece for this moment, ignoring fights and the overlays: {piece, kind}. */
export function resolve(i) {
  if (i.ko) return { piece: null, kind: 'ko' };
  if (i.cover) return { piece: 'title', kind: 'title' };
  if (i.location === 'interior') return { piece: INTERIORS[i.interior] ?? 'visit', kind: 'interior' };
  if (i.shop) return { piece: i.shop === 'market' ? 'market' : 'shop', kind: 'interior' };
  if (i.region && i.region !== 'village' && REGIONS.includes(i.region)) return { piece: i.region, kind: 'region' };
  if (i.race) return { piece: 'race', kind: 'activity' };
  if (i.festivalPanel || (i.festival && todOf(i.time ?? 12) === 'evening')) return { piece: 'festival', kind: 'activity' };
  if (i.fishing) return { piece: 'fishing', kind: 'fishing' };
  return { piece: 'village', kind: 'village' };
}
export const PRIORITY = { fight: 100, ko: 90, tension: 80, region: 60, interior: 50, activity: 45, fishing: 40, village: 30, title: 10 };
/** The fight piece and its key from the info the Pandora box gives (kind 'boss' or 'titan', region id, phase 1..3, windup). */
export function fightPlan(f) { if (!f) return null; const [tonic, mode] = LAND_KEY[f.region] ?? LAND_KEY.village; return { piece: f.kind === 'titan' ? 'titan' : 'boss', tonic, mode, phase: Math.max(1, Math.min(3, f.phase | 0 || 1)), windup: !!f.windup }; }

export class Director {
  constructor() { this.reg = null; this.cand = null; this.since = 0; this.tensionUntil = 0; this.calmUntil = 0; this.fightUntil = 0; this.lastFight = null; this.prevKo = false; this.wasCover = null; this.last = null; }
  /** info: the probe (see index.mjs); t: seconds. Returns {main, fight, tension, ko, panel, welcome, wake, fade, quant}. */
  update(i, t) {
    // The region only changes once the player has stood more than 3 m inside it for 1.5 s (the rainbow borders flap).
    const here = i.location === 'village' ? (i.region ?? 'village') : this.reg ?? 'village';
    if (this.reg === null) this.reg = here;
    else if (here !== this.reg && i.inside) { if (this.cand !== here) { this.cand = here; this.since = t; } else if (t - this.since >= 1.5) { this.reg = here; this.cand = null; } }
    else this.cand = null;
    // A fight is held 1.5 s after it ends; tension for 4 s after the last threat (and not at all for 3 s after a victory).
    let fight = fightPlan(i.fight);
    if (fight) { this.lastFight = fight; this.fightUntil = t + 1.5; } else if (this.lastFight && t < this.fightUntil) fight = { ...this.lastFight, windup: false }; else if (this.lastFight) { this.lastFight = null; this.calmUntil = t + 3; }
    if (i.threatened && t >= this.calmUntil) this.tensionUntil = t + 4;
    const tension = !fight && !i.ko && t < this.tensionUntil;
    const r = resolve({ ...i, region: i.location === 'village' ? this.reg : null, ko: i.ko });
    const welcome = this.wasCover === true && !i.cover && !i.ko, wake = this.prevKo && !i.ko;
    this.wasCover = !!i.cover; this.prevKo = !!i.ko;
    const prev = this.last?.main?.kind, kind = r.kind, big = kind === 'region' || prev === 'region';
    const main = r.piece ? { piece: r.piece, kind, variant: r.piece === 'village' ? variantOf(i) : undefined } : null;
    const plan = { main, fight, tension, ko: !!i.ko, panel: !!i.panel, welcome, wake, fade: big ? 2.5 : kind === 'interior' || prev === 'interior' ? 1.2 : 1.5, quant: big };
    if (main) this.last = plan; return plan;
  }
}
