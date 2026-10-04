// The light of a place (round 8; owner: builder C). Pure: no three.js, no DOM.
//
// World.applyLights is the one writer of the hemisphere colours, the sun's colour and intensity, the fog's colour and the
// background (spec 3.7). This file says WHAT it writes: the home light everywhere but inside a land, and inside a land a
// crossfade to that land's own light (region-life.mjs LIGHTS, builder B's table) over the first 24 m from the home region it
// touches. The distance is regions.mjs homeBorderDistance, which counts only the borders a land shares with a home region, so
// a land keeps its own light all the way to its outer edge (measured to every border it would fade back to green there).
import { regionAt, homeBorderDistance } from './regions.mjs';

/** Metres inside a land over which its light fades in. */
export const LIGHT_FADE = 24;
const smooth = (v, a, b) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * Which land's light a point is in, and how much of it: {id, share}. `id` is null and `share` 0 in the village, in a home
 * region, outside the world, and in a land `lights` has no row for (the stub table of step 0 has none: every place keeps the home light).
 */
export function landLightAt(x, z, lights, out = { id: null, share: 0 }) {
  const id = regionAt(x, z), row = id === null ? null : lights[id];
  out.id = row ? id : null; out.share = row ? smooth(homeBorderDistance(x, z), 0, LIGHT_FADE) : 0;
  return out;
}

const hex = c => { const n = parseInt(c.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
const toHex = c => '#' + c.map(v => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('');
/**
 * The crossfade on plain values, for the tests and for anyone who wants the numbers: `base` and `land` are
 * {sky, ground, sun, sunIntensity, fog, background} with '#rrggbb' colours; `t` 0 gives base, 1 gives land. World blends
 * three.js colours the same way but in the renderer's linear working space, so between the two ends its colours are a
 * little lighter than these; at 0 and at 1 they are the same.
 */
export function mixLight(base, land, t) {
  const out = {};
  for (const k of ['sky', 'ground', 'sun', 'fog', 'background']) { const a = hex(base[k]), b = hex(land?.[k] ?? base[k]); out[k] = toHex(a.map((v, i) => v + (b[i] - v) * t)); }
  out.sunIntensity = base.sunIntensity + ((land?.sunIntensity ?? base.sunIntensity) - base.sunIntensity) * t;
  return out;
}
