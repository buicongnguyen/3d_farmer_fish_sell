// The voices: every sound is a few oscillators or a bit of seeded noise through a filter and an envelope, nothing to download.
// Rules (design 5.3): a note starts at gain 0 and ramps in over 4 ms or more, and ends with a release of 15 ms or more before stop(): no clicks;
// polyphony is capped per tier (percussion counts half), the quietest oldest voice is faded out when the cap is hit (lead and pad never);
// every voice disconnects itself when it ends.
import { lcg } from './compile.mjs';
const hz = m => 440 * 2 ** ((m - 69) / 12), clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export class Synth {
  constructor(ctx) {
    this.ctx = ctx; this.cap = 10; this.active = []; this.peak = 0; this.made = 0; this.rng = lcg(4242);
    const n = Math.floor(ctx.sampleRate), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0), r = lcg(20260926);
    for (let i = 0; i < n; i++) d[i] = r() * 2 - 1;
    this.noise = buf;
  }
  /** Weight of the voices still sounding at time t. */
  load(t) { let w = 0; for (const a of this.active) if (a.eff > t) w += a.w; return w; }
  /** Play one event e (compile.mjs) into dest at time t; sec is the length of one step; level scales it (the piece's trim). */
  play(dest, e, t, sec, level = 1) {
    const vel = e.g * level; if (!(vel >= .02)) return;
    const v = VOICES[e.v]; if (!v) return;
    this.active = this.active.filter(a => a.end > t - .05);
    const w = e.p ? .5 : 1, prot = e.r === 'lead' || e.r === 'pad';
    let load = this.load(t) + w;
    while (load > this.cap) {
      const pick = soft => { let v = null; for (const a of this.active) if ((soft || !a.prot) && a.eff > t && (!v || a.vel < v.vel || (a.vel === v.vel && a.t0 < v.t0))) v = a; return v; };
      let victim = pick(false);
      // The lead and the pad are not stolen until the load is four voices over the cap (never above the hard 18).
      if (!victim) { if (load > Math.min(18, this.cap + 4)) victim = pick(true); else if (!prot) return; else break; }
      if (!victim) break;
      victim.fade(t); victim.end = victim.eff = t; load -= victim.w; this.active = this.active.filter(a => a !== victim);
    }
    const rec = { t0: t, vel, w, prot, end: t, eff: t }, nodes = [], srcs = [], ctx = this.ctx, S = this;
    const env = { ctx, dest, t, noise: this.noise, rng: this.rng, nodes, srcs, S };
    rec.end = v(env, hz(e.m), e.d * sec, vel, e.m) ?? t + .3; rec.eff = t + (rec.end - t) * .7;
    rec.fade = at => { const g = env.out; if (g) { try { g.gain.cancelScheduledValues(at); g.gain.setTargetAtTime(0, at, .006); } catch { } } for (const s of srcs) try { s.stop(at + .05); } catch { } };
    for (const s of srcs) { try { s.stop(Math.max(rec.end, t + .02)); } catch { } }
    const last = srcs[srcs.length - 1]; if (last) last.onended = () => { for (const n of nodes) try { n.disconnect(); } catch { } };
    this.active.push(rec); this.made++; this.peak = Math.max(this.peak, load);
  }
}
const osc = (E, type, f, t) => { const o = E.ctx.createOscillator(); o.type = type; o.frequency.value = f; E.nodes.push(o); E.srcs.push(o); o.start(t); return o; };
const gain = (E, to, v = 0) => { const g = E.ctx.createGain(); g.gain.value = v; E.nodes.push(g); if (to) g.connect(to); return g; };
const filt = (E, type, f, q, to) => { const b = E.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; E.nodes.push(b); if (to) b.connect(to); return b; };
const noise = (E, t) => { const s = E.ctx.createBufferSource(); s.buffer = E.noise; s.loop = true; E.nodes.push(s); E.srcs.push(s); s.start(t, E.rng() * .9); return s; };
/** Fast attack, exponential decay to silence: the plucked and struck voices. Returns the time the voice is over. */
const strike = (E, g, t, peak, dec, att = .004) => { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + att); g.gain.exponentialRampToValueAtTime(.0008, t + att + dec); return t + att + dec + .03; };
/** Attack, hold for the note, release: the bowed and blown voices and the pad. */
const hold = (E, g, t, peak, dur, att, rel) => { const a = Math.min(att, dur * .6), end = t + Math.max(dur, a + .02); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.setValueAtTime(peak, end); g.gain.linearRampToValueAtTime(0, end + rel); return end + rel + .02; };
const vibrato = (E, parts, t, cents, delay, rate = 5.2) => { const l = osc(E, 'sine', rate, t), lg = gain(E, null, 0); l.connect(lg); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(cents, t + delay + .15); for (const p of parts) lg.connect(p.detune); };
const out = (E, g) => { E.out = g; return g; };

/** blown, bowed and reed voices: one function, different recipes. */
function blown(E, f, dur, vel, o) {
  const { t } = E, g = out(E, gain(E, E.dest)), lp = filt(E, 'lowpass', o.lp, .5, g), a = osc(E, o.wave, f, t); a.connect(lp);
  const parts = [a]; if (o.h2) { const b = osc(E, 'sine', f * 2, t), bg = gain(E, lp, o.h2); b.connect(bg); parts.push(b); }
  if (o.breath) { const n = noise(E, t), bp = filt(E, 'bandpass', 3000, 1, null), ng = gain(E, lp, o.breath); n.connect(bp); bp.connect(ng); }
  if (o.vib) vibrato(E, parts, t, o.vib, o.vd ?? .25);
  return hold(E, g, t, vel * o.gain, dur, o.att, o.rel);
}
const FLUTE = { wave: 'sine', lp: 6000, h2: .1, breath: .02, vib: 5, att: .06, rel: .12, gain: .5 };
function pad(E, f, dur, vel, o = {}) {
  const { t } = E, g = out(E, gain(E, E.dest)), lp = filt(E, 'lowpass', o.lp ?? 1800, .4, g);
  for (const c of [-8, 0, 8]) { const x = osc(E, o.wave ?? 'triangle', f, t); x.detune.value = c; x.connect(lp); }
  return hold(E, g, t, vel * (o.gain ?? .07), dur, .6, .9);
}
function glock(E, f, dur, vel, o = {}) {
  const { t } = E, g = out(E, gain(E, E.dest)), a = osc(E, 'sine', f, t), b = osc(E, 'sine', f * 2.76, t), c = osc(E, 'sine', f * 5.4, t), bg = gain(E, g, o.p2 ?? .3), cg = gain(E, g, o.p3 ?? .08);
  a.connect(g); b.connect(bg); c.connect(cg); const long = clamp((o.dec ?? 1.8) - (f - 500) * .0006, .8, o.dec ?? 1.8);
  return strike(E, g, t, vel * (o.gain ?? .35), long, .003);
}
const drum = (E, f0, f1, sweep, dec, peak, vel, wave = 'sine') => { const { t } = E, g = out(E, gain(E, E.dest)), o = osc(E, wave, f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + sweep); o.connect(g); return strike(E, g, t, vel * peak, dec, .003); };
const hiss = (E, type, f, q, dec, peak, vel) => { const { t } = E, g = out(E, gain(E, E.dest)), n = noise(E, t), b = filt(E, type, f, q, g); n.connect(b); return strike(E, g, t, vel * peak, dec, .003); };

export const VOICES = {
  piano(E, f, dur, vel) {
    const { t } = E, g = out(E, gain(E, E.dest)), lp = filt(E, 'lowpass', 2400, .5, g), a = osc(E, 'triangle', f, t), b = osc(E, 'sine', f * 2, t), bg = gain(E, lp, .2), c = osc(E, 'sine', f * 3, t), cg = gain(E, lp, .05), dec = Math.min(dur * 1.6 + .3, 2.6);
    a.connect(lp); b.connect(bg); c.connect(cg); lp.frequency.exponentialRampToValueAtTime(1200, t + dec); return strike(E, g, t, vel * .5, dec, .005);
  },
  pluck(E, f, dur, vel) {
    const { t } = E, g = out(E, gain(E, E.dest)), a = osc(E, 'triangle', f, t), n = noise(E, t), bp = filt(E, 'bandpass', Math.min(f * 3, 9000), 2, null), ng = gain(E, g, .5);
    a.connect(g); n.connect(bp); bp.connect(ng); ng.gain.setValueAtTime(.5, t); ng.gain.exponentialRampToValueAtTime(.001, t + .02); return strike(E, g, t, vel * .45, .5);
  },
  harp(E, f, dur, vel) {
    const { t } = E, g = out(E, gain(E, E.dest)), a = osc(E, 'triangle', f, t), b = osc(E, 'sine', f * 2, t), bg = gain(E, g, .25); a.connect(g); b.connect(bg); return strike(E, g, t, vel * .42, 1.1);
  },
  flute: (E, f, d, v) => blown(E, f, d, v, FLUTE),
  whistle: (E, f, d, v) => blown(E, f, d, v, { ...FLUTE, h2: .05, breath: .008, vib: 3, vd: .1, att: .04, gain: .45 }),
  clar: (E, f, d, v) => blown(E, f, d, v, { wave: 'triangle', lp: 3000, vib: 4, att: .05, rel: .12, gain: .5 }),
  fiddle: (E, f, d, v) => blown(E, f, d, v, { wave: 'sawtooth', lp: 2200, vib: 7, vd: .1, att: .05, rel: .1, gain: .22 }),
  horn: (E, f, d, v) => blown(E, f, d, v, { wave: 'sawtooth', lp: 1500, att: .08, rel: .2, gain: .2 }),
  marimba(E, f, dur, vel) {
    const { t } = E, g = out(E, gain(E, E.dest)), a = osc(E, 'sine', f, t), b = osc(E, 'sine', f * 3.9, t), bg = gain(E, E.dest, 0); a.connect(g); b.connect(bg);
    bg.gain.setValueAtTime(0, t); bg.gain.linearRampToValueAtTime(vel * .08, t + .004); bg.gain.exponentialRampToValueAtTime(.0008, t + .09); return strike(E, g, t, vel * .55, .35);
  },
  glock: (E, f, d, v) => glock(E, f, d, v),
  box: (E, f, d, v) => glock(E, f, d, v, { p2: .12, p3: 0, dec: 1.4, gain: .3 }),
  celesta: (E, f, d, v) => glock(E, f, d, v, { p2: .1, p3: .02, dec: 1.2, gain: .3 }),
  toy(E, f, dur, vel) { const { t } = E, g = out(E, gain(E, E.dest)), lp = filt(E, 'lowpass', 3000, .5, g), a = osc(E, 'square', f, t); a.connect(lp); return strike(E, g, t, vel * .16, .3); },
  pad: (E, f, d, v) => pad(E, f, d, v),
  accordion: (E, f, d, v) => pad(E, f, d, v, { wave: 'sawtooth', lp: 1500, gain: .05 }),
  bass(E, f, dur, vel) {
    const { t } = E, g = out(E, gain(E, E.dest)), a = osc(E, 'sine', f, t), b = osc(E, 'triangle', f, t), bg = gain(E, g, .3); a.connect(g); b.connect(bg); return strike(E, g, t, vel * .4, clamp(dur * .9, .25, 1.4), .008);
  },
  shaker: (E, f, d, v) => hiss(E, 'bandpass', 7000, .8, .04, .22, v),
  hat: (E, f, d, v) => hiss(E, 'highpass', 8000, .5, .03, .2, v),
  wood(E, f, dur, vel) { const { t } = E, g = out(E, gain(E, E.dest)), a = osc(E, 'sine', 900, t), b = osc(E, 'triangle', 1600, t), bg = gain(E, g, .3); a.connect(g); b.connect(bg); return strike(E, g, t, vel * .35, .05, .002); },
  hdrum(E, f, d, vel) { const e = drum(E, 200, 110, .1, .16, .5, vel), { t } = E, n = noise(E, t), bp = filt(E, 'bandpass', 1500, 1, null), ng = gain(E, E.dest, 0); n.connect(bp); bp.connect(ng); ng.gain.setValueAtTime(0, t); ng.gain.linearRampToValueAtTime(vel * .1, t + .003); ng.gain.exponentialRampToValueAtTime(.0008, t + .04); return e; },
  kick: (E, f, d, v) => drum(E, 120, 45, .12, .2, .7, v),
  timp: (E, f, d, v) => drum(E, Math.max(f, 45) * 1.12, Math.max(f, 45), .15, .6, .55, v),
  tom: (E, f, d, v) => drum(E, 110, 75, .08, .14, .5, v),
};
