// The audio engine: one graph on the shared AudioContext, stages (one per playing piece) that crossfade, the stinger voice, ducking, the
// panel filter, volume, hidden and resume, quality tiers with a live governor. No game knowledge here: the director tells it what to play.
//
//   voices -> stage lead/pad/rest gains -> stage lowpass -> stage level -> stage fade -> koGain -> bus -> panelLP -> panelGain
//          -> dry + reverb (convolver, or two echoes in the battery tier) -> duckGain -> volume (the player's, linear) -> mute -> limiter -> destination
//   stingers -> sting gain -> bus
import { Synth } from './instruments.mjs';
import { Scheduler } from './scheduler.mjs';
import { compile, shiftTo, TIERS, tierIndex, PERC, lcg } from './compile.mjs';
import { CORE, STINGERS } from './scores-core.mjs';
import TRIMS from './trims.mjs';

const db = x => 10 ** (x / 20), CAP = [6, 10, 14], REVERB_S = [0, 1.2, 2.2];
const CURVE_IN = Float32Array.from({ length: 64 }, (_, i) => Math.sin(i / 63 * Math.PI / 2)), CURVE_OUT = Float32Array.from({ length: 64 }, (_, i) => Math.cos(i / 63 * Math.PI / 2));
export const variantKey = v => v ? `${v.tod}.${v.season}.${v.rain ? 1 : 0}.${v.riding | 0}.${v.farm ? 1 : 0}` : '';

export class Engine {
  constructor(ctx, o = {}) {
    this.ctx = ctx; this.scores = { ...CORE }; this.tier = tierIndex(o.tier ?? 'balanced'); this.wantTier = this.tier; this.capTier = 2; this.volume = o.volume ?? .5; this.enabled = o.enabled !== false; this.hidden = false;
    this.offline = !!o.offline; this.clock = null; this.stages = []; this.cache = new Map(); this.logBuf = []; this.logged = 0; this.lastSting = {}; this.timer = 0; this.on = false; this.lateCount = 0; this.suspendTimer = 0; this.cost = { n: 0, ms: 0, max: 0 };
    this.synth = new Synth(ctx); this.synth.cap = CAP[this.tier];
    const g = (v = 1) => { const n = ctx.createGain(); n.gain.value = v; return n; };
    this.koG = g(); this.bus = g(); this.sting = g(1.41); this.panelLP = ctx.createBiquadFilter(); this.panelLP.type = 'lowpass'; this.panelLP.frequency.value = 20000; this.panelLP.Q.value = .5;
    this.panelG = g(); this.duckG = g(); this.dry = g(); this.send = g(.0); this.wet = g(.16); this.vol = g(this.volume); this.mute = g(0);
    this.lim = ctx.createDynamicsCompressor(); Object.assign(this.lim.threshold, { value: -6 }); this.lim.knee.value = 3; this.lim.ratio.value = 12; this.lim.attack.value = .003; this.lim.release.value = .12;
    this.koG.connect(this.bus); this.sting.connect(this.bus); this.bus.connect(this.panelLP); this.panelLP.connect(this.panelG); this.panelG.connect(this.dry); this.panelG.connect(this.send); this.dry.connect(this.duckG); this.wet.connect(this.duckG); this.duckG.connect(this.vol); this.vol.connect(this.mute); this.mute.connect(this.lim); this.lim.connect(ctx.destination);
    this.buildReverb(); this.wetBase = .16;
    if (this.offline) { this.mute.gain.value = 1; this.on = true; }
  }
  now() { return this.clock ?? this.ctx.currentTime; }
  /** The reverb: a seeded noise impulse (high 2.2 s, balanced 1.2 s); the battery tier has two cheap echoes instead. */
  buildReverb() {
    const ctx = this.ctx, secs = REVERB_S[this.tier]; this.send.gain.value = 1; this.revNodes?.forEach(n => { try { n.disconnect(); } catch { } }); this.revNodes = [];
    if (secs) {
      const n = Math.floor(ctx.sampleRate * secs), buf = ctx.createBuffer(2, n, ctx.sampleRate), r = lcg(777);
      for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (r() * 2 - 1) * Math.exp(-4.6 * i / n) * (i < 200 ? i / 200 : 1); }
      const cv = ctx.createConvolver(); cv.buffer = buf; this.send.connect(cv); cv.connect(this.wet); this.revNodes.push(cv);
    } else for (const [t, v] of [[.18, .18], [.26, .14]]) { const d = ctx.createDelay(.5); d.delayTime.value = t; const g = ctx.createGain(); g.gain.value = v; this.send.connect(d); d.connect(g); g.connect(this.wet); this.revNodes.push(d, g); }
  }
  addScores(map) { Object.assign(this.scores, map); }
  get main() { return this.stages.find(s => s.role === 'main' && !s.dying); }
  get fightStage() { return this.stages.find(s => s.role === 'fight' && !s.dying); }

  // ---- stages ----
  makeStage(id, role, opts = {}) {
    const sc = this.scores[id], ctx = this.ctx, mk = (v = 1) => { const n = ctx.createGain(); n.gain.value = v; return n; };
    if (!sc) throw new Error(`no score ${id}`);
    const st = { id, role, sc, tr: shiftTo(sc.tn, opts.tonic ?? sc.tn), mode: opts.mode, cur: { variant: opts.variant, phase: opts.phase ?? 1, tension: !!opts.tension }, want: { variant: opts.variant, phase: opts.phase ?? 1, tension: !!opts.tension }, dying: false, duck: 0, srcKey: '', bar: 0, pass: 0, nodes: [] };
    st.leadG = mk(); st.padG = mk(); st.xG = mk(); st.lp = ctx.createBiquadFilter(); st.lp.type = 'lowpass'; st.lp.frequency.value = sc.lp ?? 12000; st.lp.Q.value = .4; st.level = mk(db(TRIMS[id] ?? sc.trim ?? 0)); st.fade = mk(0);
    st.leadG.connect(st.lp); st.padG.connect(st.lp); st.xG.connect(st.lp); st.lp.connect(st.level); st.level.connect(st.fade); st.fade.connect(this.koG);
    st.nodes.push(st.leadG, st.padG, st.xG, st.lp, st.level, st.fade);
    const lfo = (param, hz, depth) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = hz; g.gain.value = depth; o.connect(g); g.connect(param); o.start(); st.nodes.push(o, g); st.lfos = [...(st.lfos ?? []), o]; };
    if (sc.trem) lfo(st.padG.gain, sc.trem[0], sc.trem[1] * .5);
    if (sc.breath) { st.lp.frequency.value = (sc.breath[1] + sc.breath[2]) / 2; lfo(st.lp.frequency, sc.breath[0], (sc.breath[2] - sc.breath[1]) / 2); st.fixedLp = true; }
    const lookahead = this.tier === 0 ? .4 : .25, interval = this.tier === 0 ? .1 : .06;
    st.sched = new Scheduler({ now: () => this.now(), emit: (e, t, sec) => this.emit(st, e, t, sec), lookahead, interval, onBar: (bar, pass) => this.onBar(st, bar, pass), onLate: () => this.late() });
    return st;
  }
  compileFor(st, pass) {
    const c = st.cur, key = `${st.id}|${st.tr}|${st.mode}|${variantKey(c.variant)}|${this.tier}|${pass % 3}|${c.phase}|${c.tension ? 1 : 0}`;
    let src = this.cache.get(key);
    if (!src) { src = compile(st.sc, { pass, variant: c.variant, tier: TIERS[this.tier], phase: c.phase, tension: c.tension, tr: st.tr, mode: st.mode }); if (this.cache.size > 90) this.cache.delete(this.cache.keys().next().value); this.cache.set(key, src); }
    return src;
  }
  /** Start of every bar: adopt what the director asked for (variants only on a 4-bar boundary), pick the source for this pass, glide the tempo. */
  onBar(st, bar, pass) {
    st.bar = bar; st.pass = pass; const w = st.want, c = st.cur;
    if (st.role === 'main' && this.wantTier !== this.tier) { this.tier = this.wantTier; this.synth.cap = CAP[this.tier]; this.buildReverb(); }
    const vChanged = variantKey(w.variant) !== variantKey(c.variant);
    if (!vChanged || bar % 4 === 0) c.variant = w.variant;
    c.phase = w.phase; c.tension = w.tension;
    const src = this.compileFor(st, pass), s = st.sched; if (s.src !== src) s.src = src;
    if (Math.abs(src.bpm - s.to) > .01) s.tempo(src.bpm, src.steps * 2);
    const t = this.now(), lvl = db((TRIMS[st.id] ?? st.sc.trim ?? 0) + src.vol + st.duck);
    st.level.gain.setTargetAtTime(lvl, t, .1); if (!st.fixedLp) st.lp.frequency.setTargetAtTime(src.lp, t, .3);
    if (st.role === 'main') { const wet = Math.max(.08, Math.min(.3, .08 + (src.reverb - .8) * .08)); this.wet.gain.setTargetAtTime(this.tier === 0 ? wet * .6 : wet, t, .4); }
  }
  emit(st, e, t, sec) {
    const dest = e.r === 'lead' ? st.leadG : e.r === 'pad' ? st.padG : st.xG;
    this.synth.play(dest, e, t, sec, 1);
    const b = this.logBuf; b.push({ t, voice: e.v, note: e.m, midi: e.m, dur: e.d * sec, vel: e.g, piece: st.id, bar: e.b, step: e.s, perc: e.p }); if (b.length > 400) b.shift(); this.logged++;
  }
  late() { if (this.capTier > 0) { this.capTier = Math.max(0, this.tier - 1); this.wantTier = Math.min(this.wantTier, this.capTier); this.lateCount++; } }
  /** Fade a stage out (equal power when it was fully in) and stop its scheduler at `at`. */
  retire(st, at, dur) {
    st.dying = true; st.stopAt = at; st.removeAt = at + dur + .4; const g = st.fade.gain;
    g.cancelScheduledValues(at); if (st.fullAt != null && at >= st.fullAt) g.setValueCurveAtTime(CURVE_OUT, at, Math.max(.05, dur)); else g.setTargetAtTime(0, at, Math.max(.02, dur / 4));
  }
  /** Play a piece as the main stage. Same piece again only updates its variant or tension. opts: variant, tonic, mode, fade (s), startAt, quant (wait for the old stage's bar line, at most 1.2 s), phase. */
  play(id, opts = {}) {
    const m = this.main, sameKey = m && m.id === id && shiftTo(m.sc.tn, opts.tonic ?? m.sc.tn) === m.tr && m.mode === opts.mode;
    if (sameKey) { if (opts.variant) m.want.variant = opts.variant; if (opts.tension != null) this.tension(opts.tension); return m; }
    const now = this.now(); let start = Math.max(opts.startAt ?? 0, now + .05);
    if (m && opts.quant && m.sched.running && m.sched.src) { const g = m.sched.grid(m.sched.src.steps); if (g - now <= 1.2 && g > start) start = g; }
    const dur = opts.fade ?? 1.5, st = this.makeStage(id, 'main', opts); st.duck = this.fightStage ? -14 : 0;
    st.sched.start(this.compileFor(st, 0), start); st.sched.bpm = st.sched.to = st.sched.from = st.sched.src.bpm;
    st.level.gain.value = db((TRIMS[id] ?? st.sc.trim ?? 0) + st.sched.src.vol + st.duck);
    st.fade.gain.cancelScheduledValues(start); if (dur > .06) { st.fade.gain.setValueAtTime(0, start); st.fade.gain.setValueCurveAtTime(CURVE_IN, start, dur); } else st.fade.gain.value = 1;
    st.fullAt = start + dur; this.stages.push(st); if (m) this.retire(m, start, dur);
    this.ensureTimer(); return st;
  }
  /** The fight piece (boss or titan) over the region piece, which sinks 14 dB; null ends it. info: {piece, tonic, mode, phase, windup}. */
  fight(info) {
    const f = this.fightStage, m = this.main, t = this.now();
    if (!info) { if (f) { this.retire(f, t, 2); } if (m) { m.duck = 0; m.level.gain.setTargetAtTime(db((TRIMS[m.id] ?? m.sc.trim ?? 0) + (m.sched.src?.vol ?? 0)), t, .6); } return; }
    if (f && f.id === info.piece && f.tr === shiftTo(f.sc.tn, info.tonic) && f.mode === info.mode) {
      if (f.want.phase !== info.phase) { f.want.phase = info.phase; if (info.phase > f.cur.phase) this.stinger('riser', { tonic: info.tonic }); }
      f.leadG.gain.setTargetAtTime(info.windup ? 0 : 1, t, .03); return;
    }
    if (f) this.retire(f, t, .5);
    const st = this.makeStage(info.piece, 'fight', info); st.sched.start(this.compileFor(st, 0), t + .05); st.sched.bpm = st.sched.to = st.sched.from = st.sched.src.bpm;
    st.fade.gain.setValueAtTime(0, t); st.fade.gain.setValueCurveAtTime(CURVE_IN, t, .8); st.fullAt = t + .8; this.stages.push(st);
    if (m) { m.duck = -14; m.level.gain.setTargetAtTime(db((TRIMS[m.id] ?? m.sc.trim ?? 0) + (m.sched.src?.vol ?? 0) - 14), t, .25); }
    this.stinger('boss_intro', { tonic: info.tonic }); this.ensureTimer();
  }
  /** The tension stem: a layer on the region piece. The lead sinks 12 dB and the pad 4 dB over a bar; it all returns over 2 s. */
  tension(on) {
    const m = this.main; if (!m) return; const t = this.now(), bar = m.sched.src ? m.sched.src.steps * 60 / (m.sched.bpm * 4) : 2;
    if (m.want.tension === !!on) return; m.want.tension = !!on;
    m.leadG.gain.setTargetAtTime(on ? db(-12) : 1, t, on ? bar / 3 : .7); m.padG.gain.setTargetAtTime(on ? db(-4) : 1, t, on ? bar / 3 : .7);
  }
  ko(on) {
    const t = this.now(); this.koG.gain.cancelScheduledValues(t); this.koG.gain.setTargetAtTime(on ? 0 : 1, t, on ? .4 : .5);
    if (on) { this.stinger('ko'); this.fight(null); } else this.stinger('wake');
  }
  // ---- stingers, ducking, panels ----
  stinger(name, arg = {}) {
    const st = STINGERS[name]; if (!st) return 0; const now = this.now(); if (now - (this.lastSting[name] ?? -9) < .12) return 0; this.lastSting[name] = now;
    const m = this.main, src = m?.sched.src; let k = { root: 7, iv: [0, 4, 7] };
    if (src && st.chord) { const ch = src.chords[Math.min(m.sched.bar, src.bars - 1)], s = m.sched.step; let c = ch[0].c; for (const x of ch) if (s >= x.s) c = x.c; k = { root: c.root, iv: c.iv }; }
    const tonic = arg.tonic ?? m?.sc.tn ?? 7, tr = st.tr ? shiftTo(7, tonic) : 0, sec = 60 / (st.q * 4), evs = st.make ? st.make(k) : st.ev;
    let start = now + .02; if (m?.sched.running && !['ko', 'welcome', 'wake'].includes(name)) start = Math.max(start, Math.min(m.sched.grid(2), now + .3));
    for (const [s, v, midi, len, vel] of evs) {
      const e = { v, m: midi + tr, d: len, g: vel, p: PERC.has(v), r: 'lead', b: -1, s }; this.synth.play(this.sting, e, start + s * sec, sec, 1);
      this.logBuf.push({ t: start + s * sec, voice: v, note: e.m, midi: e.m, dur: len * sec, vel, piece: `~${name}`, bar: -1, step: s, perc: e.p }); this.logged++;
    }
    if (st.duck) this.duck(st.duck[0], st.duck[1], start);
    return Math.max(...evs.map(e => (e[0] + e[3]) * sec));
  }
  /** Lower the music db decibels for sec seconds (5 ms attack, then a release that ends at sec). */
  duck(dbv, sec, at) {
    const g = this.duckG.gain, t = at ?? this.now(); g.cancelScheduledValues(t); g.setTargetAtTime(db(dbv), t, .005); g.setTargetAtTime(1, t + sec * .6, sec * .1);
  }
  hit() { this.duck(-3, .12); }
  panel(open) {
    const t = this.now(); this.panelLP.frequency.cancelScheduledValues(t); this.panelLP.frequency.setTargetAtTime(open ? 3200 : 20000, t, open ? .05 : .13); this.panelG.gain.setTargetAtTime(open ? db(-3) : 1, t, open ? .05 : .13);
  }
  // ---- volume, switches, hidden ----
  setVolume(v) { this.volume = Math.max(0, Math.min(1, +v || 0)); this.vol.gain.setTargetAtTime(this.volume, this.now(), .03); }
  setTier(t) { this.wantTier = Math.min(tierIndex(t), this.capTier); if (!this.on) { this.tier = this.wantTier; this.synth.cap = CAP[this.tier]; this.buildReverb(); } }
  setEnabled(on) { this.enabled = !!on; this.sync(); }
  setHidden(h) { this.hidden = !!h; this.sync(); }
  get audible() { return this.enabled && !this.hidden; }
  /** Bring the context and the schedulers in line with enabled and hidden. */
  sync() {
    clearTimeout(this.suspendTimer); const t = this.now();
    if (this.audible) {
      this.on = true; const go = () => { for (const s of this.stages) if (!s.dying && s.sched.src) { s.sched.running = true; s.sched.resync('bar'); } this.mute.gain.cancelScheduledValues(this.now()); this.mute.gain.setTargetAtTime(1, this.now(), .2); this.ensureTimer(); };
      if (this.ctx.state !== 'running' && this.ctx.resume) { const p = this.ctx.resume(); if (p?.then) p.then(go, () => { }); else go(); } else go();
    } else {
      this.on = false; this.mute.gain.cancelScheduledValues(t); this.mute.gain.setTargetAtTime(0, t, this.hidden ? .04 : .1); for (const s of this.stages) s.sched.stop(); clearInterval(this.timer); this.timer = 0;
      if (!this.offline) this.suspendTimer = setTimeout(() => { if (!this.audible && this.ctx.suspend) this.ctx.suspend().catch(() => { }); }, this.hidden ? 160 : 350);
    }
  }
  // ---- clock ----
  ensureTimer() { if (this.offline || this.timer || !this.on) return; this.timer = setInterval(() => this.tick(), (this.tier === 0 ? .1 : .06) * 1000); }
  tick() {
    const t = this.now(), p0 = this.offline ? 0 : performance.now();
    for (const s of this.stages) { if (s.stopAt != null && t >= s.stopAt) s.sched.stop(); if (!s.dying || t < s.stopAt) s.sched.tick(); }
    for (let i = this.stages.length - 1; i >= 0; i--) { const s = this.stages[i]; if (s.removeAt != null && t >= s.removeAt) { s.sched.stop(); if (!this.offline) { for (const l of s.lfos ?? []) try { l.stop(); } catch { } for (const n of s.nodes) try { n.disconnect(); } catch { } } /* offline, the graph is rendered after the whole score is scheduled: it must stay wired */ this.stages.splice(i, 1); } }
    this.synth.active = this.synth.active.filter(a => a.end > t - .1);
    if (!this.offline) { const d = performance.now() - p0, c = this.cost; c.n++; c.ms += d; if (d > c.max) c.max = d; }
  }
  /** Offline rendering: drive the clock by hand up to `until` seconds (OfflineAudioContext has no timers). */
  pump(until, step = .05) { this.clock ??= 0; while (this.clock < until) { this.tick(); this.clock += step; } this.tick(); }
  // ---- diagnostics ----
  describe() {
    const m = this.main, s = m?.sched, src = s?.src, f = this.fightStage;
    return { running: this.ctx.state, enabled: this.enabled, hidden: this.hidden, volume: this.volume, gain: this.vol.gain.value, tier: TIERS[this.tier], cap: this.synth.cap, piece: m?.id ?? null, variant: variantKey(m?.cur.variant), tension: !!m?.cur.tension, fight: f ? { piece: f.id, phase: f.cur.phase } : null,
      pass: s?.pass ?? 0, bar: s?.bar ?? 0, step: s?.step ?? 0, bpm: s ? +s.bpm.toFixed(2) : 0, stages: this.stages.filter(x => !x.dying).length, polyphony: +this.synth.load(this.now()).toFixed(1), peak: this.synth.peak, voices: src ? [...new Set(src.list.map(e => e.v))] : [], perc: src ? src.list.some(e => e.p) : false, logged: this.logged, late: this.lateCount, cost: { ticks: this.cost.n, ms: +this.cost.ms.toFixed(1), max: +this.cost.max.toFixed(1) }, maxLag: +Math.max(0, ...this.stages.map(s => s.sched.maxLag)).toFixed(3), time: this.now() };
  }
  log(n = 200) { return this.logBuf.slice(-n); }
}
