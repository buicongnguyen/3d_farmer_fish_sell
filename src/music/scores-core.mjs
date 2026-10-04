// The scores of the village and its rooms, the village's variants and the stingers. Everything is data for compile.mjs (see the layer
// fields listed there). Identity (design 2): G major, "a family at the kitchen window"; every melody is made of the cells S A V H.
export const MAJOR = [0, 2, 4, 5, 7, 9, 11], MINOR = [0, 2, 3, 5, 7, 8, 10], DOR = [0, 2, 3, 5, 7, 9, 10], MIX = [0, 2, 4, 5, 7, 9, 10], LYD = [0, 2, 4, 6, 7, 9, 11], PHR = [0, 1, 3, 5, 7, 8, 10];
export const MPENT = [0, 3, 5, 7, 10], PENT = [0, 2, 4, 7, 9];

/** The village tune, bar by bar (design 3.3). */
export const VL = ['G4/4 A4/2 B4/2 D5/8', 'B4/4 A4/2 G4/2 A4/8', 'E5/4 D5/2 C5/2 D5/4 E5/4', 'D5/8 C5/2 B4/2 A4/4', 'G4/4 A4/2 B4/2 D5/4 G5/4', 'E5/6 D5/2 B4/4 G4/4', 'A4/4 C5/4 E5/4 D5/2 C5/2', 'B4/6 C5/2 A4/8',
  'E5/4 G5/4 C6/8', 'D5/4 B4/4 G4/8', 'C5/4 E5/4 A5/4 G5/2 E5/2', 'F#5/8 E5/4 D5/4', 'G4/4 A4/2 B4/2 D5/8', 'E5/4 D5/2 B4/2 G4/4 A4/4', 'C5/4 E5/4 D5/4 F#5/4', 'G5/8 -/8'];
export const VB = ['G2/8 D3/8', 'B2/8 F#3/8', 'C3/8 G3/8', 'D3/8 A3/8', 'G2/8 D3/8', 'E2/8 B2/8', 'A2/8 E3/8', 'D3/8 C3/8', 'C3/8 G3/8', 'B2/8 D3/8', 'A2/8 E3/8', 'D3/8 A3/8', 'G2/8 D3/8', 'E2/8 B2/8', 'C3/4 G3/4 D3/4 A3/4', 'G2/8 -/8'];
const VC = 'G Bm C D G Em Am7 D7 C G/B Am D G Em C.D G';
const pad = (o = {}) => ({ k: 'pad', v: 'pad', vel: .6, ...o });
const bassN = (o = {}) => ({ k: 'notes', v: 'bass', vel: .5, n: VB, ...o });

const village = {
  id: 'village', steps: 16, q: 84, bars: 16, tn: 7, scale: MAJOR, lp: 10000, reverb: 1.2, chords: VC, lead: { base: 67, notes: VL },
  layers: [
    { k: 'lead', v: 'flute', vel: .5, bars: [0, 8], gr: .08 }, { k: 'lead', v: 'flute', vel: .5, bars: [8, 12], ps: [0, 2], gr: .08 }, { k: 'lead', v: 'piano', vel: .5, oct: -12, bars: [8, 12], ps: [1] }, { k: 'lead', v: 'flute', vel: .5, bars: [12, 16], gr: .08 },
    pad(), bassN(),
    { k: 'arp', v: 'pluck', p: [1, 3, 5, 3], oct: 3, vel: .3, pass: 1, t: 1 },
    { k: 'tones', v: 'marimba', g: '.x..x...x..x....', oct: 4, vel: .35, pass: 2, t: 2 },
    { k: 'grid', v: 'shaker', g: 'x.x.x.x.x.x.x.x.', vel: .35, from: 4, t: 1 },
  ],
  vary(o) {
    const v = { tod: 'day', season: 'summer', rain: false, riding: 0, farm: false, ...(o.variant ?? {}) }; let layers = this.layers.map(l => ({ ...l })), chords = VC, leadNotes = VL.slice(), bpm = { morning: 88, day: 92, evening: 76, night: 60 }[v.tod], lp = { morning: 9000, day: 10000, evening: 5000, night: 2800 }[v.tod], vol = v.tod === 'night' ? -3 : 0, reverb = 1.2, swing = 0, bass = bassN();
    const drop = f => { layers = layers.filter(l => !f(l)); }, setLead = (voice, extra) => { for (const l of layers) if (l.k === 'lead') { l.v = voice; Object.assign(l, extra); } };
    const sus2 = c => c.replace(/\.?([A-G][#b]?)[^ .]*/g, (m, r) => (m.startsWith('.') ? '.' : '') + r + 'sus2');
    if (v.tod === 'morning') { for (const l of layers) if (l.k === 'arp') l.pass = 0; layers.push({ k: 'cell', v: 'whistle', c: 'S', at: [1, 13], oct: 12, vel: .25, t: 1 }); }
    else if (v.tod === 'day') { layers.push({ k: 'lead', v: 'marimba', oct: 12, bars: [8, 12], vel: .3, t: 1 }); for (const l of layers) if (l.k === 'grid') { l.from = 0; } }
    else if (v.tod === 'evening') { setLead('piano', { vel: .5, gr: 0 }); drop(l => l.k === 'grid'); swing = .12; reverb = 2.2; for (let i = 8; i < 12; i++) leadNotes[i] = VL[i - 8]; }
    else { setLead('celesta', { vel: .55, every: 2, off: 1, oct: 12, gr: 0 }); drop(l => l.k === 'grid' || l.k === 'arp' || l.v === 'marimba'); layers = layers.filter(l => l.k !== 'lead' || l.v === 'celesta'); layers = layers.filter(l => l.k !== 'notes'); layers.push({ k: 'bass', v: 'bass', vel: .5, style: 'half' }); reverb = 2.4; }
    let acc = [];
    if (v.season === 'spring') { layers.push({ k: 'notes', v: 'flute', vel: .25, n: Array.from({ length: 16 }, (_, b) => b % 8 === 3 ? '-/12 A5/1 B5/1 A5/1 B5/1' : ''), t: 1 }); layers.push({ k: 'cell', v: 'glock', c: 'S', at: [0, 4, 12], oct: 12, vel: .22, t: 2 }); bpm *= 1; }
    else if (v.season === 'summer') { bpm *= 1.04; leadNotes[11] = 'F5/8 E5/4 D5/4'; acc = [10]; layers.push({ k: 'grid', v: 'shaker', g: '..x...x...x...x.', vel: .3, t: 2 }); lp += 1500; }
    else if (v.season === 'autumn') { bpm *= .94; setLead('clar', {}); chords = chords.split(' ').map((c, i) => i === 8 ? 'Em' : i === 9 ? 'Am7' : c).join(' '); layers = layers.map(l => l.k === 'notes' ? { ...l, n: VB.map((b, i) => i === 8 ? 'E2/8 B2/8' : i === 9 ? 'A2/8 E3/8' : b) } : l); lp = Math.min(lp, 4500); }
    else { bpm *= .88; setLead('box', {}); chords = sus2(chords); drop(l => l.k === 'arp'); layers = layers.map(l => l.k === 'notes' ? { k: 'bass', v: 'bass', vel: .5, style: 'half' } : l); layers.push({ k: 'hit', v: 'glock', ch: [12, 19], every: 1, oct: 4, vel: .22, len: 8, t: 1 }); reverb = 3.2; }
    if (v.rain) { bpm *= .96; lp = Math.min(lp, 3500); for (const l of layers) if (l.k === 'arp') l.pass = 0; drop(l => l.k === 'grid'); layers.push({ k: 'arp', v: 'glock', p: [1, 3, 5, 8], oct: 5, vel: .12, every: 2, t: 1 }); }
    if (v.riding) { bpm *= 1.06; layers.push({ k: 'grid', v: 'shaker', g: 'x.x.x.x.x.x.x.x.', vel: .35, t: 1 }); if (v.riding === 1) layers.push({ k: 'bass', v: 'bass', vel: .4, style: 'eighths', t: 1 }); }
    if (v.farm) layers.push({ k: 'tones', v: 'marimba', g: '.x..x...x..x....', oct: 4, vel: .35, t: 1, pass: 0 });
    void bass;
    return { layers, chords, leadNotes, bpm: Math.round(bpm * 100) / 100, clamp: [50, 100], lp, vol, reverb, swing, acc };
  },
};

const T = 'G Bm C Dsus G Em C D';
const title = { id: 'title', steps: 16, q: 72, bars: 8, tn: 7, scale: MAJOR, lp: 9000, reverb: 2.2, chords: T, lead: { base: 67, notes: [...VL.slice(0, 7), 'A4/8 B4/4 D5/4'] },
  layers: [{ k: 'lead', v: 'piano', vel: .5, bars: [0, 4] }, { k: 'lead', v: 'flute', vel: .5, bars: [4, 8] }, pad({ vel: .7 }), { k: 'bass', v: 'bass', vel: .35, style: 'half' }] };

const HOME = 'G Em C D G Em Am D Em C G/B D Em Am C D';
const home = { id: 'home', steps: 16, q: 66, bars: 16, tn: 7, scale: MAJOR, lp: 2200, reverb: 1.6, chords: HOME, trem: [.1, .15], lead: { base: 67, notes: VL.slice(0, 16) },
  layers: [{ k: 'lead', v: 'piano', vel: .5, oct: -12, thin: 1 }, pad({ vel: .35 }), { k: 'bass', v: 'bass', vel: .35, style: 'half' }, { k: 'arp', v: 'piano', p: [1, 5, 8, 5], oct: 3, vel: .22, every: 2, t: 1 }] };
const visit = { id: 'visit', steps: 16, q: 72, bars: 8, tn: 7, scale: MAJOR, lp: 6000, reverb: 1.2, chords: 'G Em C D G Em Am D', lead: { base: 67, notes: VL.slice(0, 8) },
  layers: [{ k: 'lead', v: 'pluck', vel: .6, oct: 12 }, pad({ vel: .4 }), { k: 'bass', v: 'bass', vel: .4, style: 'r5' }, { k: 'grid', v: 'wood', g: '....x.......x...', vel: .4, t: 1 }] };

const shop = { id: 'shop', steps: 16, q: 104, bars: 8, tn: 0, scale: MAJOR, lp: 11000, reverb: 1, chords: 'C Am F G7 C Em F G',
  lead: { base: 72, notes: ['C5/4 D5/2 E5/2 G5/8', 'E5/4 D5/2 C5/2 D5/8', 'C5/4 D5/2 E5/2 G5/4 C6/4', 'A5/4 G5/4 E5/4 C5/4', 'C5/4 D5/2 E5/2 G5/8', 'E5/4 D5/2 C5/2 D5/8', 'C5/4 D5/2 E5/2 G5/4 C6/4', 'B4/4 D5/4 G5/8'] },
  layers: [{ k: 'lead', v: 'marimba', vel: .6 }, pad({ vel: .3 }), { k: 'bass', v: 'bass', vel: .45, style: 'eighths' }, { k: 'grid', v: 'wood', g: 'X...x...X...x...', vel: .4, t: 1 }, { k: 'arp', v: 'pluck', p: [1, 5, 3, 5], every: 4, oct: 4, vel: .25, t: 2 }] };

const market = { id: 'market', steps: 16, q: 112, bars: 8, tn: 7, scale: MIX, acc: [11], lp: 10000, reverb: 1, chords: 'G F C G G F C.D G', swing: .1, lead: { base: 67, plan: 'S V S H S V S H' },
  layers: [{ k: 'lead', v: 'marimba', vel: .6 }, { k: 'lead', v: 'whistle', oct: 12, vel: .35, at: [3, 7], t: 1 }, pad({ vel: .3 }), { k: 'bass', v: 'pluck', vel: .5, style: 'walk' }, { k: 'grid', v: 'shaker', g: 'x.x.x.x.x.x.x.x.', vel: .35, t: 1 }] };

const civic = { id: 'civic', steps: 12, q: 88, bars: 8, tn: 2, scale: MAJOR, lp: 9000, reverb: 1.8, chords: 'D Bm G A D Bm G.A D', lead: { base: 74, plan: 'S A S A S A H S' },
  layers: [{ k: 'lead', v: 'glock', vel: .6 }, pad({ vel: .4 }), { k: 'bass', v: 'bass', vel: .35, style: 'half' }] };

const fishing = { id: 'fishing', steps: 16, q: 54, bars: 8, tn: 7, scale: PENT, set: MAJOR, lp: 8000, reverb: 2.4, chords: 'G Em C D G Em Am7 D',
  lead: { base: 67, notes: ['G4/8 A4/4 B4/4', 'D5/12 -/4', 'E5/8 D5/4 B4/4', 'A4/12 -/4', 'G4/8 A4/4 B4/4', 'E5/12 -/4', 'D5/8 B4/4 A4/4', 'G4/16'] },
  layers: [{ k: 'lead', v: 'whistle', vel: .6 }, pad({ vel: .5 }), { k: 'bass', v: 'bass', vel: .35, style: 'half' }, { k: 'arp', v: 'harp', p: [1, 5, 8, 5], oct: 3, vel: .22, every: 2, t: 1 }] };

const festival = { id: 'festival', steps: 12, q: 156, bars: 16, tn: 7, scale: MAJOR, lp: 10000, reverb: 1, chords: 'G G C D G Em C D G G C D Em C D G', lead: { base: 67, plan: 'S A S A S A S A S A S A S A S H' },
  layers: [{ k: 'lead', v: 'fiddle', vel: .6 }, pad({ v: 'accordion', vel: .5 }), { k: 'bass', v: 'bass', vel: .45, style: 'r5' }, { k: 'grid', v: 'hdrum', g: 'X.x.x.X.x.x.', vel: .5, t: 1 }] };

const race = { id: 'race', steps: 16, q: 132, bars: 8, tn: 4, scale: MINOR, set: MAJOR.map(x => (x + 3) % 12), lp: 11000, reverb: .9, chords: 'Em C G D Em C D Em', lead: { base: 76, plan: 'Sd V Sd V Sd V Sd V' },
  layers: [{ k: 'lead', v: 'marimba', vel: .6 }, { k: 'lead', v: 'flute', vel: .4, t: 2 }, pad({ vel: .3 }), { k: 'bass', v: 'pluck', vel: .45, style: 'eighths' }, { k: 'grid', v: 'kick', g: 'X...x...X...x...', vel: .6, t: 1 }, { k: 'grid', v: 'shaker', g: '2222222222222222', vel: .5, t: 2 }] };

export const CORE = { title, village, home, visit, shop, market, civic, fishing, festival, race };

/** Stingers (design 3.13): [step, voice, midi, steps long, velocity] on a grid of q quarter notes per minute. `k` is the moment's key: {root, iv} of the
 *  chord sounding now and tonic. `tr` marks the ones that follow the land's tonic. duck is [dB, seconds]. acc lists semitones above G allowed beyond G major. */
const near = (pc, from) => from + ((pc - from) % 12 + 12) % 12;
const H = (k, from, voice, q = 125) => { const r = near(k.root, from); return [[0, voice, r + k.iv[1], 4, .55], [1, voice, r + k.iv[2], 4, .55], [2, voice, r + 12, 8, .6]]; };
export const STINGERS = {
  welcome: { q: 96, tr: 0, ev: [[0, 'flute', 67, 4, .6], [4, 'flute', 69, 2, .6], [6, 'flute', 71, 2, .6], [8, 'flute', 74, 8, .6], [16, 'flute', 79, 8, .6], [0, 'pad', 55, 24, .6], [0, 'pad', 59, 24, .6], [0, 'pad', 62, 24, .6]] },
  harvest: { q: 125, chord: 1, duck: [-2, .4], make: k => H(k, 72, 'glock') },
  pickTree: { q: 125, chord: 1, duck: [-2, .4], make: k => [[0, 'glock', near(k.root, 76) + 0, 2, .4], ...H(k, 76, 'glock').map(e => [e[0] + 1, ...e.slice(1)])] },
  sell: { q: 125, chord: 1, duck: [-1.5, .3], make: k => { const r = near(k.root, 79); return [[0, 'glock', r + k.iv[1], 4, .5], [2, 'glock', r + k.iv[2], 6, .5]]; } },
  bite: { q: 125, tr: 0, duck: [-4, .6], ev: [[0, 'glock', 86, 4, .6], [2, 'glock', 91, 8, .7]] },
  strain: { q: 125, tr: 0, duck: [-2, .4], ev: [[0, 'glock', 86, 6, .5]] },
  catch: { q: 125, chord: 1, duck: [-3, .7], make: k => [...H(k, 72, 'glock'), [0, 'marimba', near(k.root, 60), 8, .5]] },
  lost: { q: 125, tr: 0, duck: [-2, .4], ev: [[0, 'pluck', 81, 4, .5], [2, 'pluck', 78, 4, .5], [4, 'pluck', 74, 8, .5]] },
  rescue_open: { q: 187, tr: 1, duck: [-4, 1.2], ev: [[0, 'harp', 67, 6, .5], [1, 'harp', 71, 6, .5], [2, 'harp', 74, 6, .5], [3, 'harp', 79, 10, .55], [5, 'glock', 91, 12, .4]] },
  friend_joy: { q: 130, tr: 1, duck: [-6, 3.8], ev: [[0, 'whistle', 79, 6, .6], [6, 'whistle', 81, 2, .6], [8, 'whistle', 79, 4, .6], [12, 'whistle', 76, 4, .6], [16, 'whistle', 79, 4, .6], [20, 'whistle', 81, 2, .6], [22, 'whistle', 83, 2, .6], [24, 'whistle', 86, 8, .65], [0, 'marimba', 67, 8, .4], [8, 'marimba', 71, 8, .4], [16, 'marimba', 74, 8, .4], [24, 'marimba', 79, 8, .4], ...[0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30].map(s => [s, 'shaker', 60, 1, .4])] },
  victory: { q: 200, tr: 1, duck: [-12, 3.6], ev: [[0, 'horn', 67, 4, .7], [4, 'horn', 71, 4, .7], [8, 'horn', 74, 4, .7], [12, 'horn', 79, 4, .7], [16, 'horn', 81, 4, .7], [20, 'horn', 83, 4, .7], [24, 'horn', 86, 8, .7], [32, 'horn', 91, 16, .7], [0, 'glock', 79, 4, .5], [4, 'glock', 83, 4, .5], [8, 'glock', 86, 4, .5], [12, 'glock', 91, 4, .5], [32, 'glock', 98, 16, .5], [0, 'timp', 43, 4, .8], [16, 'timp', 50, 4, .7], [32, 'timp', 43, 8, .8]] },
  levelup: { q: 125, tr: 0, duck: [-3, .8], ev: [[0, 'glock', 67, 4, .5], [1, 'glock', 71, 4, .5], [2, 'glock', 74, 4, .5], [3, 'glock', 79, 4, .5], [4, 'glock', 91, 12, .55], [0, 'pad', 55, 14, .6], [0, 'pad', 59, 14, .6], [0, 'pad', 62, 14, .6]] },
  ko: { q: 100, tr: 0, acc: [3, 10], ev: [[0, 'piano', 74, 4, .6], [4, 'piano', 70, 4, .6], [8, 'piano', 67, 4, .6], [12, 'piano', 55, 12, .7], [12, 'bass', 43, 12, .6]] },
  wake: { q: 80, tr: 0, ev: [[0, 'pad', 55, 20, .6], [0, 'pad', 59, 20, .6], [0, 'pad', 62, 20, .6], [4, 'piano', 67, 4, .5], [8, 'piano', 69, 2, .5], [10, 'piano', 71, 2, .5], [12, 'piano', 74, 8, .55]] },
  teleport: { q: 150, tr: 0, duck: [-4, .8], ev: [[0, 'harp', 62, 4, .4], [1, 'harp', 64, 4, .4], [2, 'harp', 66, 4, .4], [3, 'harp', 67, 4, .4], [4, 'harp', 69, 4, .4], [5, 'harp', 71, 4, .4], [6, 'harp', 74, 4, .4], [7, 'harp', 79, 6, .45], [8, 'glock', 91, 10, .45]] },
  mapOpen: { q: 125, tr: 0, ev: [[0, 'glock', 79, 6, .3], [2, 'glock', 86, 8, .3]] },
  mapClose: { q: 125, tr: 0, ev: [[0, 'glock', 86, 6, .3], [2, 'glock', 79, 8, .3]] },
  checkpoint: { q: 125, chord: 1, make: k => [[0, 'glock', near(k.root, 79) + k.iv[2], 4, .45]] },
  boss_intro: { q: 144, tr: 1, duck: [-3, 1], ev: [[0, 'tom', 60, 2, .8], [2, 'tom', 60, 2, .8], [4, 'timp', 43, 8, .9], [4, 'bass', 31, 8, .8]] },
  riser: { q: 144, tr: 1, ev: [[0, 'hat', 60, 1, .3], [1, 'hat', 60, 1, .4], [2, 'hat', 60, 1, .5], [3, 'hat', 60, 1, .6], [0, 'timp', 43, 4, .6]] },
};
/** Seconds a stinger lasts, tail included. */
export const stingerLength = st => { const q = st.q, step = 60 / (q * 4); return Math.max(...(st.ev ?? st.make({ root: 7, iv: [0, 4, 7] })).map(e => (e[0] + e[3]) * step)); };

/** Each land's tonic pitch class and the mode its fight pieces use ('dor' keeps the bright lands bright). The village footprint fights in G minor. */
export const LAND_KEY = { village: [7], west: [4], north: [9], east: [9], south: [7, 'dor'], toy: [0], candy: [2], jungle: [4], ice: [2], ocean: [2], lava: [4], cloud: [5, 'dor'], shadow: [7] };
