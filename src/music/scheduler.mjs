// The lookahead scheduler: pure (an injected clock and emit), so Node tests it on a fake clock.
// It walks a compiled score step by step, emitting every event that falls inside [now, now + lookahead]; it never schedules the past,
// and after a stall (a throttled tab, a sleeping phone) it skips ahead to the next beat instead of playing the backlog.
export class Scheduler {
  /** now(): seconds. emit(event, time, stepSeconds). hooks: onBar(bar, pass) before each bar's events (a source may be swapped there), onLate(). */
  constructor({ now, emit, lookahead = .25, interval = .06, onBar, onLate } = {}) {
    Object.assign(this, { now, emit, lookahead, interval, onBar, onLate, running: false, src: null, step: 0, bar: 0, pass: 0, next: 0, bpm: 84, from: 84, to: 84, ramp: 0, rampLeft: 0, last: null, lates: [], emitted: 0, maxLag: 0 });
  }
  start(src, at = this.now() + .05, bpm = src.bpm) { this.src = src; this.step = 0; this.bar = 0; this.pass = 0; this.next = at; this.bpm = this.from = this.to = bpm; this.rampLeft = 0; this.running = true; this.last = null; this.barStarted = false; }
  stop() { this.running = false; }
  /** Tempo glides linearly to bpm over `steps` steps (two bars is the game's usual). */
  tempo(bpm, steps = 0) { this.to = bpm; this.from = this.bpm; this.ramp = this.rampLeft = Math.max(0, steps); if (!steps) this.bpm = bpm; }
  get stepSeconds() { return 60 / (this.bpm * 4); }
  /** The time of the next step that sits on a multiple of `div` sixteenths (8th = 2, beat = 4, bar = steps). */
  grid(div = 2) { let s = this.step, t = this.next; while (s % div) { t += 60 / (this.bpm * 4); s++; } return t; }
  /** After a pause: restart on the next bar line (or beat), now, with no backlog. */
  resync(to = 'bar') { if (!this.src) return; const div = to === 'bar' ? this.src.steps : 4; let s = this.step; if (s % div) s = Math.ceil(s / div) * div; this.bumpTo(s); this.next = this.now() + .04; this.barStarted = false; this.last = null; }
  bumpTo(s) { const steps = this.src.steps; while (s >= steps) { s -= steps; this.bar++; if (this.bar >= this.src.bars) { this.bar = 0; this.pass++; } } this.step = s; }
  tick() {
    if (!this.running || !this.src) return; const t0 = this.now();
    if (this.last != null) this.maxLag = Math.max(this.maxLag, t0 - this.last - this.interval);
    if (this.last != null && t0 - this.last > this.interval + .12) { this.lates.push(t0); this.lates = this.lates.filter(t => t0 - t < 30); if (this.lates.length >= 3) { this.lates = []; this.onLate?.(); } }
    this.last = t0;
    if (this.next < t0 - .1) { const missed = Math.floor((t0 - this.next) / this.stepSeconds); let s = this.step + missed; s = Math.ceil(s / 4) * 4; this.bumpTo(s); this.next = t0 + .02; this.barStarted = false; }
    while (this.next < t0 + this.lookahead) {
      if (this.step === 0 && !this.barStarted) { this.onBar?.(this.bar, this.pass); this.barStarted = true; }
      const evs = this.src.bar[this.bar][this.step]; const sec = this.stepSeconds, swing = this.src.swing && this.step % 4 === 2 ? this.src.swing * sec * 2 : 0;
      if (evs) for (const e of evs) { const time = Math.max(this.next + swing + (e.ms ?? 0) / 1000, t0); this.emit(e, time, sec); this.emitted++; }
      this.next += sec;
      if (this.rampLeft > 0) { this.rampLeft--; this.bpm = this.to + (this.from - this.to) * (this.rampLeft / this.ramp); } else this.bpm = this.to;
      this.step++; this.barStarted = this.step !== 0 ? this.barStarted : false;
      if (this.step >= this.src.steps) { this.step = 0; this.bar++; this.barStarted = false; if (this.bar >= this.src.bars) { this.bar = 0; this.pass++; } }
    }
  }
}
