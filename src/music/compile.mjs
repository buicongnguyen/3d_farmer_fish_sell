// Score tables -> step tables. Pure: no audio, no clock, no Math.random (a seeded LCG does the humanising), so Node can test it.
//   compile(score, {pass, variant, tier, phase, tension, tr, mode}) -> {id, steps, bars, bpm, lp, vol, reverb, swing, chords, bar[b][step] = [event], list, allowed}
// An event is {s, v, m, d, g, r, p, ms}: step in its bar, voice, MIDI note, length in steps, velocity 0..1, role ('lead' | 'pad' | 'x'),
// 1 for percussion, humanising offset in ms. Layers (see scores-core.mjs) are what the score is made of; their fields are listed at layerEvents.
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export const mod = (a, n) => ((a % n) + n) % n;
export const midi = name => { const m = /^([A-G])([#b]?)(-?\d)$/.exec(name); if (!m) throw new Error(`bad note ${name}`); return (+m[3] + 1) * 12 + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); };
const pcOfName = n => mod(NOTE[n[0]] + (n[1] === '#' ? 1 : n[1] === 'b' ? -1 : 0), 12);
export const PERC = new Set(['shaker', 'hat', 'wood', 'hdrum', 'kick', 'timp', 'tom']);
export const TIERS = ['battery', 'balanced', 'high'];
export const tierIndex = t => Math.max(0, TIERS.indexOf(t));
export const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
export const lcg = seed => { let s = seed >>> 0 || 1; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; };

/** "G4/4 A4/2 -/2 G4+/4 G4/4": notes with a length in sixteenths, '-' a rest, '+' a tie into the next token of the same pitch. */
export function parseBar(text, steps) {
  const out = []; let s = 0, tie = null;
  for (const tok of text.trim().split(/\s+/)) {
    const [name, len] = tok.split('/'), d = +len, tied = name.endsWith('+'), n = tied ? name.slice(0, -1) : name;
    if (!(d > 0)) throw new Error(`bad length in "${text}"`);
    if (n !== '-') {
      const m = midi(n);
      if (tie && tie.m === m) { tie.d += d; if (!tied) tie = null; else tie = tie; }
      else { const e = { s, m, d }; out.push(e); tie = tied ? e : null; }
    } else tie = null;
    s += d;
  }
  if (s !== steps) throw new Error(`bar "${text}" is ${s} steps, not ${steps}`);
  return out;
}
/** Drop notes shorter than 4 sixteenths; their time goes to the previous note. */
export const thin = evs => { const out = []; for (const e of evs) { if (e.d >= 4 || !out.length) out.push({ ...e }); else out[out.length - 1].d += e.d; } return out; };

const Q = { '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], sus: [0, 5, 7], sus2: [0, 2, 7], dim: [0, 3, 6] };
/** A chord: {root, iv, bass}: root and bass pitch classes, iv intervals above the root. Numerals 1-7 build the diatonic triad of that degree. */
export function chord(sym, scale, tonic = 0) {
  if (/^[1-7]$/.test(sym)) {
    const i = +sym - 1, at = k => scale[mod(i + k, 7)] + 12 * Math.floor((i + k) / 7);
    return { root: mod(tonic + scale[i], 12), iv: [0, at(2) - at(0), at(4) - at(0)], bass: mod(tonic + scale[i], 12) };
  }
  const m = /^([A-G][#b]?)(m7|m|7|sus2|sus|dim)?(?:\/([A-G][#b]?))?$/.exec(sym); if (!m) throw new Error(`bad chord ${sym}`);
  const root = pcOfName(m[1]); return { root, iv: Q[m[2] ?? ''], bass: m[3] ? pcOfName(m[3]) : root };
}
const shiftChord = (c, tr) => ({ ...c, root: mod(c.root + tr, 12), bass: mod(c.bass + tr, 12) });
/** "G Bm C.D": one symbol per bar, or two joined by '.' (first half, second half). */
export function chordBars(text, steps, scale, tonic, tr = 0) {
  return text.trim().split(/\s+/).map(tok => { const parts = tok.split('.'), d = steps / parts.length; return parts.map((p, i) => ({ c: shiftChord(chord(p, scale, tonic), tr), s: i * d, d })); });
}
const CELLS = { S: { i: [0, 1, 2, 4], d: { 16: [4, 2, 2, 8], 12: [2, 2, 2, 6] } }, A: { i: [2, 1, 0, 1], d: { 16: [4, 2, 2, 8], 12: [2, 2, 2, 6] } }, V: { i: [4, 5, 4, 2], d: { 16: [6, 2, 4, 4], 12: [4, 2, 3, 3] } }, H: { h: [0, 1, 2], d: { 16: [4, 4, 8], 12: [3, 3, 6] } } };
const degree = (scale, base, i) => base + scale[mod(i, scale.length)] + 12 * Math.floor(i / scale.length);
/** One cell, as [{s, m, d}] (it may run past the bar when augmented). Tokens: S A V H, then i (inverted), d (diminished: halved and said twice), 2 (augmented). */
export function cellEvents(token, steps, scale, base, chrd, tr = 0) {
  const c = CELLS[token[0]], mods = token.slice(1); let durs = c.d[steps];
  if (mods.includes('2')) durs = durs.map(x => x * 2); if (mods.includes('d')) durs = durs.map(x => Math.max(1, x / 2));
  const out = [], once = (at) => { let s = at; durs.forEach((d, k) => {
    let m; if (c.h) { const bp = mod(base, 12), root = base + mod(chrd.root - bp + 3, 12) - 3; m = root + [chrd.iv[1], chrd.iv[2], 12][k]; }
    else { const idx = mods.includes('i') ? -c.i[k] : c.i[k]; m = degree(scale, base, idx); }
    out.push({ s, m: m + tr, d }); s += d; }); return s - at; };
  const len = once(0); if (mods.includes('d')) once(len);
  return out;
}

/** Lead events per bar, from lead.notes (explicit, bars split by '|') or lead.plan (cell tokens, one per bar; '-' rest; '~' continues an augmented cell). */
function leadBars(sc, o, chords, steps, scale) {
  const L = o.leadNotes ? { ...sc.lead, notes: o.leadNotes } : sc.lead, bars = sc.bars, tr = o.tr ?? 0, out = Array.from({ length: bars }, () => []);
  if (!L) return out;
  if (L.notes) { const texts = Array.isArray(L.notes) ? L.notes : L.notes.split('|'); texts.forEach((t, b) => { out[b] = parseBar(t, steps).map(e => ({ ...e, m: e.m + tr })); }); return out; }
  const toks = L.plan.trim().split(/\s+/);
  toks.forEach((t, b) => { if (t === '-' || t === '~') return;
    for (const e of cellEvents(t, steps, scale, L.base + tr, chords[b][0].c, 0)) { let bb = b, s = e.s; while (s >= steps) { bb++; s -= steps; } if (bb < bars) out[bb].push({ s, m: e.m, d: e.d }); } });
  return out;
}
const bassRoot = pc => 40 + mod(pc - 4, 12);

/** Layer fields: k kind (lead notes cell pad bass arp tones grid hit), v voice, vel, t min tier (0 battery 1 balanced 2 high), pass or ps (first pass / list of
 *  passes it plays in), from and bars [a,b) bar range, every/off (bars where b % every === off), at (list of bars), ph [min, max] boss phase, tn only while
 *  tension, nt only without tension, oct, p tone list, g grid, ton tonic offsets, ch chord offsets, deg degrees, c cell token, style, gr grace-note chance. */
function layerEvents(L, sc, o, chords, lead, steps, scale, tonic, rng) {
  const bars = sc.bars, tr = o.tr ?? 0, out = Array.from({ length: bars }, () => []), vel = L.vel ?? .3, role = L.r ?? (L.k === 'lead' ? 'lead' : L.k === 'pad' ? 'pad' : 'x');
  const perc = PERC.has(L.v) ? 1 : 0, put = (b, s, m, d, g = vel) => { while (s >= steps) { b++; s -= steps; } if (b >= bars) b -= bars; out[b].push({ s, v: L.v, m, d, g, r: role, p: perc }); };
  const pcs = new Set(scale.map(i => mod(i + tonic + tr, 12))), lo = L.bars?.[0] ?? L.from ?? 0, hi = L.bars?.[1] ?? bars, tonicPc = mod(tonic + tr, 12), base = (sc.lead?.base ?? 67) + tr;
  const on = b => b >= lo && b < hi && (!L.every || b % L.every === (L.off ?? 0)) && (!L.at || L.at.includes(b));
  const cat = (b, s) => { const h = chords[b]; let c = h[0].c; for (const x of h) if (s >= x.s) c = x.c; return c; };
  const tone = (c, id) => ({ 1: 0, 3: c.iv[1], 5: c.iv[2], 7: c.iv[3] ?? 10, 8: 12, 10: 12 + c.iv[1], 12: 12 + c.iv[2] })[id];
  const rootAt = (c, oct) => 12 * (oct + 1) + c.root;
  for (let b = 0; b < bars; b++) {
    if (!on(b)) continue;
    if (L.k === 'lead' || L.k === 'notes') {
      let evs = L.k === 'lead' ? lead[b] : (L.n[b] ? parseBar(L.n[b], steps).map(e => ({ ...e, m: e.m + tr })) : []);
      if (L.thin) evs = thin(evs);
      for (const e of evs) { put(b, e.s, e.m + (L.oct ?? 0), e.d);
        if (L.gr && (o.pass ?? 0) % 3 === 2 && rng() < L.gr) { const m0 = e.m + (L.oct ?? 0), up = [1, 2, 3].find(k => pcs.has(mod(m0 + k, 12))) ?? 2; out[b].push({ s: e.s, v: L.v, m: m0 + up, d: 1, g: vel * .5, r: role, p: 0, ms: -70 }); } }
    } else if (L.k === 'cell') for (const e of cellEvents(L.c, steps, scale, base + (L.oct ?? 0), chords[b][0].c, 0)) put(b, e.s, e.m, e.d);
    else if (L.k === 'pad') for (const { c, s, d } of chords[b]) { const m = 48 + c.root, iv = L.sus ? [0, 2, 7] : c.iv; for (let i = 0; i < 3; i++) put(b, s, m + iv[i] + (L.oct ?? 0), d); if (L.vox) put(b, s, m + 12 + (L.oct ?? 0), d); }
    else if (L.k === 'bass') for (const { c, s, d } of chords[b]) {
      const r = bassRoot(c.bass) + (L.oct ?? 0), st = L.style ?? 'r5', fifth = r + 7;
      if (st === 'half' || st === 'drone') put(b, s, r, d);
      else if (st === 'r5') { put(b, s, r, d / 2); put(b, s + d / 2, fifth, d / 2); }
      else if (st === 'walk') [0, c.iv[1], 7, 9].forEach((x, i) => { if (i * 4 < d) put(b, s + i * 4, r + x, 4); });
      else if (st === 'pulse') for (let i = 0, x = 0; i < d; i += 2, x++) put(b, s + i, r + [0, 0, 0, 7, 0, 0, 7, 0][x % 8], 2);
      else for (let i = 0; i < d; i += 2) put(b, s + i, r + (i % 4 ? 7 : 0), 2);
    } else if (L.k === 'arp') { const ev = L.every ?? 2, p = L.p ?? [1, 3, 5, 3]; let n = 0; for (let s = 0; s < steps; s += ev, n++) { const c = cat(b, s); put(b, s, rootAt(c, L.oct ?? 3) + tone(c, p[n % p.length]), ev * 2); } }
    else if (L.k === 'tones' || L.k === 'grid') { const g = L.g; let n = 0;
      for (let s = 0; s < steps; s++) { const ch = g[s % g.length]; if (ch === '.') continue; const k = ch === 'X' ? 1.5 : /\d/.test(ch) ? +ch / 5 : 1, c = cat(b, s);
        let m = L.n ?? 60; if (L.ton) m = 12 * ((L.oct ?? 3) + 1) + tonicPc + L.ton[n % L.ton.length]; else if (L.k === 'tones') m = rootAt(c, L.oct ?? 4) + tone(c, (L.p ?? [1, 3, 5, 3, 8])[n % (L.p ?? [1, 3, 5, 3, 8]).length]);
        put(b, s, m, L.len ?? (L.k === 'tones' ? 3 : 2), vel * k); n++; } }
    else if (L.k === 'hit') { const c = cat(b, L.s ?? 0), list = L.ton ?? L.ch ?? L.deg; let s = L.s ?? 0;
      list.forEach((x, i) => { const m = L.ton ? 12 * ((L.oct ?? 3) + 1) + tonicPc + x : L.ch ? rootAt(c, L.oct ?? 4) + x : degree(scale, base + (L.oct ?? 0), x - 1); put(b, s, m, L.len ?? 4); if (L.gap) out[b][out[b].length - 1].ms = i * L.gap; s += L.sp ?? 0; }); }
  }
  return out;
}

const passOk = (L, pass, tier) => (L.ps ? L.ps.includes(pass) : pass >= (L.pass ?? 0)) && tier >= (L.t ?? 0);
/** The tension stem: the lead leaves, an eighth-note ostinato on the tonic and fifth, timpani on beat 1, the inverted answer in a muted marimba, one flat-second colour. */
const TENSION = [
  { k: 'tones', v: 'pluck', g: 'x.x.x.x.x.x.x.x.', ton: [0, 7], oct: 3, vel: .2, t: 1, tn: 1 },
  { k: 'grid', v: 'timp', g: 'X...............', ton: [0], oct: 2, vel: .5, tn: 1 },
  { k: 'cell', v: 'marimba', c: 'Ai', every: 2, oct: 0, vel: .16, t: 1, tn: 1 },
  { k: 'hit', v: 'pluck', ton: [1], oct: 3, s: 14, every: 4, off: 3, len: 2, vel: .12, t: 1, tn: 1 },
];

export function compile(sc, o = {}) {
  const x = sc.vary ? sc.vary(o) : {}, steps = sc.steps, tier = tierIndex(o.tier ?? 'balanced'), pass = (o.pass ?? 0) % 3, tr = o.tr ?? 0;
  const scale = (o.mode && sc.modes?.[o.mode]) || sc.scale, tonic = sc.tn, chordsText = x.chords ?? sc.chords, chords = chordBars(chordsText, steps, scale, tonic, tr);
  if (chords.length !== sc.bars) throw new Error(`${sc.id}: ${chords.length} chord bars for ${sc.bars}`);
  const oo = { ...o, tr, leadNotes: x.leadNotes }, lead = leadBars(sc, oo, chords, steps, scale), rng = lcg(hash(sc.id) + pass * 7919 + (o.phase ?? 1));
  const phase = o.phase ?? 1, layers = [...(x.layers ?? sc.layers), ...(o.tension ? TENSION : [])];
  const bar = Array.from({ length: sc.bars }, () => Array.from({ length: steps }, () => null)), list = [];
  for (const L of layers) {
    if (!passOk(L, pass, tier) || (L.tn && !o.tension) || (L.nt && o.tension) || (L.ph && (phase < L.ph[0] || phase > L.ph[1])) || (o.tension && L.k === 'lead')) continue;
    const ev = layerEvents(L, { ...sc, scale }, oo, chords, lead, steps, scale, tonic, rng);
    ev.forEach((es, b) => { for (const e of es) { if (e.g < .02) continue; e.ms ??= Math.round((rng() - .5) * 16); e.g *= 1 + (rng() - .5) * .16; e.b = b; (bar[b][e.s] ??= []).push(e); list.push(e); } });
  }
  const base = (x.bpm ?? sc.q) * (phase === 3 && sc.phaseTempo ? sc.phaseTempo : 1), bpm = x.clamp ? Math.max(x.clamp[0], Math.min(x.clamp[1], base)) : base;
  const allowed = new Set([...(sc.set ?? scale), ...(sc.acc ?? []), ...(x.acc ?? []), ...(o.tension ? [1] : [])].map(i => mod(i + tonic + tr, 12)));
  return { id: sc.id, steps, bars: sc.bars, bpm, lp: x.lp ?? sc.lp ?? 12000, vol: x.vol ?? 0, reverb: x.reverb ?? sc.reverb ?? 1.2, swing: x.swing ?? 0, chords, bar, list, allowed, tonic: mod(tonic + tr, 12), scale, trim: sc.trim ?? 0 };
}
/** Seconds one pass of a score lasts at its own tempo. */
export const loopSeconds = sc => sc.bars * sc.steps * 60 / (sc.q * 4);
/** The semitone shift from a score's own tonic to the wanted tonic, the short way round (so a boss in D sits near A, not an octave away). */
export const shiftTo = (from, to) => mod(to - from + 6, 12) - 6;
