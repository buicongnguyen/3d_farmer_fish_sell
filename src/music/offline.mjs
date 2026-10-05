// The offline renderer the tests and scripts/music-render.mjs bundle into a blank page: the real engine on an OfflineAudioContext.
// Not part of the game: nothing imports it. render() returns 16-bit PCM as base64 so a page.evaluate can carry it to Node.
import { Engine } from './engine.mjs';
import { WORLD } from './scores-world.mjs';
import { CORE, STINGERS, stingerLength } from './scores-core.mjs';
import { compile, loopSeconds } from './compile.mjs';

const b64 = f32 => { const n = f32.length, i16 = new Int16Array(n); for (let i = 0; i < n; i++) i16[i] = Math.max(-32768, Math.min(32767, Math.round(f32[i] * 32767))); const u8 = new Uint8Array(i16.buffer); let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); };
/** opts: id, seconds, rate (22050), tier, volume (1), variant, tonic, mode, phase, tension, fade, actions: [{t, fn, args}] with fn one of play, fight, tension, duck, panel, stinger, ko, setTier. */
async function render(o) {
  const rate = o.rate ?? 22050, ctx = new OfflineAudioContext(2, Math.ceil(rate * o.seconds), rate), t0 = performance.now();
  const e = new Engine(ctx, { tier: o.tier ?? 'balanced', volume: o.volume ?? 1, offline: true, trims: o.trims }); e.addScores(WORLD);
  e.play(o.id, { variant: o.variant, tonic: o.tonic, mode: o.mode, phase: o.phase, tension: o.tension, fade: o.fade ?? .06 });
  for (const a of [...(o.actions ?? [])].sort((x, y) => x.t - y.t)) { e.pump(a.t); e[a.fn](...(a.args ?? [])); }
  e.pump(o.seconds);
  const made = performance.now() - t0, buf = await ctx.startRendering();
  return { l: b64(buf.getChannelData(0)), r: b64(buf.getChannelData(1)), rate, peakVoices: e.synth.peak, schedMs: made, totalMs: performance.now() - t0, events: e.logged, stagesLeft: e.stages.length };
}
/** One stinger alone (no piece under it): opts name, seconds, rate, tier, volume, tonic. */
async function sting(o) {
  const rate = o.rate ?? 22050, ctx = new OfflineAudioContext(2, Math.ceil(rate * o.seconds), rate), e = new Engine(ctx, { tier: o.tier ?? 'balanced', volume: o.volume ?? 1, offline: true, sting: o.sting });
  e.pump(0); const len = e.stinger(o.name, { tonic: o.tonic }); e.pump(o.seconds); const buf = await ctx.startRendering();
  return { l: b64(buf.getChannelData(0)), r: b64(buf.getChannelData(1)), rate, len };
}
const all = () => ({ ...CORE, ...WORLD });
window.MusicOffline = { render, sting, CORE: Object.keys(CORE), WORLD: Object.keys(WORLD), STINGERS: Object.keys(STINGERS), stingerLength: n => stingerLength(STINGERS[n]), loop: id => loopSeconds(all()[id]), compile: (id, o) => { const c = compile(all()[id], o); return { bars: c.bars, steps: c.steps, bpm: c.bpm, events: c.list.length }; } };
