// Shared by the pen range tests: the pen's animals walked over a PenRange for hours of game time, headless, with a wandering villager.
import { PenRange, staticCuts, stepOut, fillPeople, callFed, updateGate, startOut } from '../src/pen-range.mjs';
import { PEN, PEN_ROSTER, newRoamer, spawnSpot, roamRadius } from '../src/pen-roam.mjs';
import { hyp } from '../src/hyp.mjs';

export const seeded = seed => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
let shared = null;
export const sharedRange = () => shared ??= new PenRange();
/** Distance from (x, z) to the nearest cut-out of a category (negative inside it), from the plans, not the grid. */
export function cutDistance(cuts, x, z, cats) {
  let best = Infinity, which = '';
  for (const s of cuts.rects) { if (cats && !cats.includes(s.cat)) continue; const d = hyp(Math.max(0, Math.abs(x - s.x) - s.w / 2), Math.max(0, Math.abs(z - s.z) - s.d / 2)); const inside = Math.abs(x - s.x) < s.w / 2 && Math.abs(z - s.z) < s.d / 2; const v = inside ? -1 : d - s.m; if (v < best) { best = v; which = s.cat; } }
  for (const s of cuts.circles) { if (cats && !cats.includes(s.cat)) continue; const v = hyp(x - s.x, z - s.z) - s.r - s.m; if (v < best) { best = v; which = s.cat; } }
  return { d: best, cat: which };
}
/**
 * Walks the five animals for `hours` of game time from `from` o'clock at 30 Hz. Returns what happened:
 * {violations: [...], insideAtEnd, maxStuck, outsideSeen, gateShutWhileOut, left: how many left the yard by day, rescues}
 */
export function simulate({ seed, from = 7, hours = 10, level = 3, range = sharedRange(), people = true, hz = 30, every = 1 }) {
  const rng = seeded(seed * 7919 + 13), cuts = staticCuts(), swimCuts = staticCuts(true), dt = 1 / hz, steps = Math.round(hours * 3600 * hz), all = [];
  for (const [uid, spec] of PEN_ROSTER.entries()) { const w = newRoamer(uid, spec.kind, { x: 0, z: 0 }, rng); Object.assign(w, spawnSpot(range, rng, w, all)); w.goalX = w.x; w.goalZ = w.z; w.hidden = level < spec.level; all.push(w); }
  const shown = all.filter(w => !w.hidden), list = [], npc = [{ mesh: { visible: true, position: { x: 30, z: -8 } }, inside: false }], visitor = { x: 12, z: -8, gx: 12, gz: -8 }, player = { x: 40, z: -5 };
  range.setGate(true); for (const w of all) startOut(w, range, rng, from);
  const out = { violations: [], insideAtEnd: 0, maxStuck: 0, left: 0, rescues: 0, steps, kinds: {}, shut: 0, maxHome: 0, gateTraffic: 0 }, still = new Map(), seen = new Set();
  for (let n = 0; n < steps; n++) {
    const hour = from + n * dt / 3600;
    // a villager strolls over the whole region (grass, track, lanes: anywhere), turning to a new spot every 10 to 40 s
    if (people) { if (hyp(visitor.gx - visitor.x, visitor.gz - visitor.z) < .3 || n % (hz * 40) === 0) { visitor.gx = range.rect.x0 + rng() * (range.rect.x1 - range.rect.x0); visitor.gz = range.rect.z0 + rng() * (range.rect.z1 - range.rect.z0); } const d = hyp(visitor.gx - visitor.x, visitor.gz - visitor.z) || 1; visitor.x += (visitor.gx - visitor.x) / d * 1.6 * dt; visitor.z += (visitor.gz - visitor.z) / d * 1.6 * dt; npc[0].mesh.position.x = visitor.x; npc[0].mesh.position.z = visitor.z; }
    fillPeople(list, player, false, people ? npc : []);
    updateGate(range, all, hour);
    for (const w of shown) {
      const before = w.mode; stepOut(w, all, range, rng, dt, list, hour); if (before === 'in' && w.mode === 'out') out.gateTraffic++;
      if (n % every) continue;
      const r = roamRadius(w);
      if (!range.forKind(w.kind).isInRange(w.x, w.z)) out.violations.push({ n, hour, uid: w.uid, kind: w.kind, x: w.x, z: w.z, why: 'outside the range' });
      else { const c = cutDistance(w.kind==='duck' ? swimCuts : cuts, w.x, w.z); if (c.d < -.001 || (['road', 'pond'].includes(c.cat) && c.d < -.1)) out.violations.push({ n, hour, uid: w.uid, kind: w.kind, x: w.x, z: w.z, why: 'inside the ' + c.cat + ' cut (' + c.d.toFixed(2) + ')' }); }
      if (!range.inPen(w.x, w.z) && !isFinite(range.forKind(w.kind).homeDistance(w.x, w.z, r * .6))) out.violations.push({ n, hour, uid: w.uid, kind: w.kind, x: w.x, z: w.z, why: 'in a pocket the gate does not reach' });
      if (!range.inPen(w.x, w.z)) { seen.add(w.uid); out.kinds[w.kind] = (out.kinds[w.kind] ?? 0) + 1; if (!range.gateOpen) out.shut++; }
      // standing still while walking: the longest stretch with no progress
      const st = still.get(w.uid) ?? { x: w.x, z: w.z, t: 0 }; if (hyp(w.x - st.x, w.z - st.z) > .5) { st.x = w.x; st.z = w.z; st.t = 0; } else if (w.walking) st.t += dt * every; else st.t = Math.max(0, st.t - dt * every); if (st.t > out.maxStuck) { out.maxStuck = st.t; out.stuckAt = { kind: w.kind, mode: w.mode, x: +w.x.toFixed(1), z: +w.z.toFixed(1), hour: +hour.toFixed(2), goal: [+w.goalX.toFixed(1), +w.goalZ.toFixed(1)], speed: +w.speed.toFixed(2), heading: +w.heading.toFixed(2), route: w.route?.length ?? 0 }; } still.set(w.uid, st);
    }
  }
  out.left = seen.size; out.insideAtEnd = shown.filter(w => range.inPen(w.x, w.z)).length; out.shown = shown.length; out.rescues = shown.reduce((a, w) => a + w.rescues, 0);
  out.final = shown.map(w => ({ kind: w.kind, mode: w.mode, x: +w.x.toFixed(1), z: +w.z.toFixed(1) }));
  return out;
}
