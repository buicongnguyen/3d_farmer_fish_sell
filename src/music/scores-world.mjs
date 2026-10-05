// The scores of the four home regions, the eight planets, the fight pieces. Loaded the first time the player leaves the village or opens the box
// (a lazy chunk inside the lazy chunk). The same cells S A V H, eight colours (design 3.10 to 3.12).
import { MAJOR, MINOR, DOR, MIX, LYD, PHR, MPENT, PENT } from './scores-core.mjs';
const pad = (o = {}) => ({ k: 'pad', v: 'pad', vel: .5, ...o });
const bass = (style = 'r5', o = {}) => ({ k: 'bass', v: 'bass', vel: .4, style, ...o });
const rel = (set, shift) => set.map(x => (x + shift) % 12);

const west = { id: 'west', steps: 16, q: 76, bars: 8, tn: 4, scale: MINOR, set: rel(MAJOR, 3), lp: 8000, reverb: 1.8, breath: [.07, 1800, 3000], chords: 'Em C G D Em C D Em', lead: { base: 76, plan: 'S A S A S V A S' },
  layers: [{ k: 'lead', v: 'flute', vel: .55 }, { k: 'lead', v: 'marimba', vel: .4, oct: 0, t: 1 }, pad(), bass('half'), { k: 'arp', v: 'pluck', p: [1, 5, 8, 5], oct: 3, every: 4, vel: .22, t: 1 }, { k: 'grid', v: 'wood', g: 'x..x..x...x.....', vel: .25, t: 2 }] };
const north = { id: 'north', steps: 16, q: 62, bars: 8, tn: 9, scale: DOR, acc: [8, 11], lp: 7000, reverb: 1.8, chords: 'Am G F G Am Em F E7', lead: { base: 57, plan: 'S A S A S A V A' },
  layers: [{ k: 'lead', v: 'flute', vel: .6 }, pad(), bass('half'), { k: 'tones', v: 'marimba', g: '..x..x....x..x..', oct: 4, vel: .3, t: 1 }, { k: 'lead', v: 'marimba', vel: .25, oct: 12, t: 2 }] };
const south = { id: 'south', steps: 12, q: 88, bars: 16, tn: 7, scale: LYD, acc: [5], lp: 10000, reverb: 1.5, chords: 'G D Em C G D C.D G G D Em C G D C.D G', lead: { base: 67, plan: 'S V S H S V S H S V S H S V S H' },
  layers: [{ k: 'lead', v: 'harp', vel: .6 }, { k: 'lead', v: 'glock', vel: .3, oct: 12, bars: [8, 16], t: 1 }, pad({ vel: .4 }), bass('r5'), { k: 'tones', v: 'harp', g: 'X..x..X..x..', oct: 4, vel: .2, t: 1 }, { k: 'grid', v: 'shaker', g: 'x..x..x..x..', vel: .3, t: 2 }, { k: 'cell', v: 'glock', c: 'S', at: [0, 4, 8, 12], oct: 12, vel: .22, t: 2 }] };
const east = { id: 'east', steps: 16, q: 100, bars: 8, tn: 9, scale: MPENT, set: MINOR, acc: [8, 11], lp: 9000, reverb: 1, chords: 'Am G Am E Am G F E', lead: { base: 69, plan: 'S A S A S A H S' },
  layers: [{ k: 'lead', v: 'whistle', vel: .6 }, { k: 'lead', v: 'marimba', vel: .35, t: 2 }, pad({ vel: .35 }), bass('r5'), { k: 'grid', v: 'hdrum', g: 'X..x..x.X..x....', vel: .5, t: 1 }, { k: 'grid', v: 'wood', g: '....x.......x...', vel: .35, t: 2 }] };

const toy = { id: 'toy', steps: 16, q: 108, bars: 8, tn: 0, scale: MAJOR, lp: 11000, reverb: .9, chords: 'C F G C Am F G.C C', lead: { base: 72, plan: 'S S A H S V A H' },
  layers: [{ k: 'lead', v: 'box', vel: .6 }, { k: 'lead', v: 'toy', vel: .4, t: 1 }, pad({ vel: .25 }), bass('eighths', { v: 'pluck' }), { k: 'grid', v: 'wood', g: 'X...x...X...x...', vel: .4, t: 1 }] };
const candy = { id: 'candy', steps: 12, q: 160, bars: 16, tn: 2, scale: MAJOR, lp: 11000, reverb: 1, chords: 'D G D A D Bm G.A D D G D A D Bm G.A D', lead: { base: 74, plan: 'S A S H S A S H S A S H S A S H' },
  layers: [{ k: 'lead', v: 'glock', vel: .55, bars: [0, 8] }, { k: 'lead', v: 'glock', vel: .55, oct: 12, bars: [8, 16] }, { k: 'lead', v: 'marimba', vel: .35, t: 1 }, pad({ vel: .3 }), bass('r5'), { k: 'tones', v: 'marimba', g: 'X..x..X..x..', oct: 4, vel: .2, t: 1 }, { k: 'grid', v: 'shaker', g: 'x.x.x.x.x.x.', vel: .25, t: 2 },
    { k: 'hit', v: 'glock', deg: [1, 2, 3, 5], oct: 12, sp: 1, every: 4, vel: .25, len: 4, t: 2 }] };
const jungle = { id: 'jungle', steps: 16, q: 104, bars: 8, tn: 4, scale: MPENT, set: MINOR, acc: [11], lp: 9000, reverb: 1, chords: 'Em Em G D Em Em Am B', lead: { base: 64, plan: 'S A V S S A V H' },
  layers: [{ k: 'lead', v: 'flute', vel: .55 }, pad({ vel: .3 }), bass('r5'), { k: 'tones', v: 'marimba', g: 'x.xx.x.xx.xx.x.x', ton: [0, 3, 5, 7], oct: 3, vel: .4, t: 1 }, { k: 'grid', v: 'hdrum', g: 'X..x..x...x..x..', vel: .5, t: 2 }, { k: 'grid', v: 'hdrum', g: '...X..x..x...x.x', vel: .4, t: 2 }] };
const ice = { id: 'ice', steps: 16, q: 56, bars: 8, tn: 2, scale: PENT, set: MAJOR, lp: 12000, reverb: 3.2, chords: 'D A Bm F#m D A Bm A', lead: { base: 86, plan: 'S - A - S - H -' },
  layers: [{ k: 'lead', v: 'glock', vel: .5 }, { k: 'lead', v: 'box', vel: .3, oct: 0, t: 1 }, pad({ vel: .15 }), bass('half', { vel: .2 })] };
const ocean = { id: 'ocean', steps: 12, q: 108, bars: 16, tn: 2, scale: MIX, lp: 9000, reverb: 1.8, trem: [.04, .5], chords: 'D C G D D C G D D C G D D C G D', lead: { base: 74, plan: 'S V A V S V A V S V A V S V A V' },
  layers: [{ k: 'lead', v: 'whistle', vel: .55 }, pad({ vel: .5 }), bass('r5'), { k: 'arp', v: 'harp', p: [1, 5, 8, 5, 5, 8], oct: 3, every: 2, vel: .25, t: 1 }, { k: 'grid', v: 'shaker', g: 'x.x.x.x.x.x.', vel: .2, t: 2 }] };
const lava = { id: 'lava', steps: 16, q: 112, bars: 8, tn: 4, scale: PHR, acc: [2], lp: 8000, reverb: 1, chords: 'Em F Em D Em F G Em', lead: { base: 76, plan: 'S A S A Si Ai Si Ai' },
  layers: [{ k: 'lead', v: 'marimba', vel: .6 }, pad({ vel: .3 }), bass('r5'), { k: 'hit', v: 'horn', ton: [0], oct: 3, every: 4, len: 12, vel: .5, t: 1 }, { k: 'grid', v: 'tom', g: 'X..x.x..X..x..x.', vel: .55, t: 1 }, { k: 'tones', v: 'marimba', g: 'x.x.x.x.x.x.x.x.', ton: [0, 0, 7, 0], oct: 3, vel: .25, t: 2 }] };
const cloud = { id: 'cloud', steps: 12, q: 66, bars: 8, tn: 5, scale: LYD, acc: [5], lp: 6500, reverb: 2.4, chords: 'F C Dm Bb F C Dm Bb', lead: { base: 77, plan: 'S A V H S A V H' },
  layers: [{ k: 'lead', v: 'glock', vel: .5 }, pad({ vel: .5 }), bass('half', { vel: .3 }), { k: 'hit', v: 'harp', ch: [0, 4, 7, 12, 16, 19], oct: 4, gap: 80, every: 4, vel: .3, len: 8, t: 1 }, { k: 'lead', v: 'harp', vel: .25, t: 2, oct: -12 }] };
const shadow = { id: 'shadow', steps: 16, q: 48, bars: 8, tn: 7, scale: MINOR, acc: [11], lp: 2800, reverb: 3, chords: 'Gm Eb Cm D Gm Eb Cm D',
  lead: { base: 67, notes: ['G4/8 A4/4 Bb4/4', 'D5/16', 'Bb4/8 A4/4 G4/4', 'A4/16', 'G4/8 A4/4 Bb4/4', 'D5/12 -/4', 'Bb4/8 A4/4 G4/4', 'G4/16'] },
  layers: [{ k: 'lead', v: 'piano', vel: .55, oct: -12 }, pad({ vel: .35, oct: -12 }), bass('drone', { vel: .4, oct: -12 }), { k: 'cell', v: 'celesta', c: 'S', at: [3, 7], oct: 12, vel: .3, t: 1 }] };

/** The fight pieces are written in A minor (tn 9) with numerals (diatonic triads of the mode), then moved to the region's tonic. */
const boss = { id: 'boss', steps: 16, q: 144, bars: 16, tn: 9, scale: MINOR, modes: { dor: DOR }, phaseTempo: 1.08, trim: 2, lp: 7000, reverb: .9, chords: '1 1 7 1 1 6 7 5 1 1 7 1 1 6 7 5', lead: { base: 69, plan: 'S A S A S A S A S A S A S A S A' },
  layers: [pad({ vel: .4 }), bass('pulse', { v: 'pluck', vel: .5 }), { k: 'tones', v: 'marimba', g: 'x.x.x.x.x.x.x.x.', ton: [0, 0, 0, 7, 0, 0, 7, 0], oct: 3, vel: .3, t: 1 },
    { k: 'grid', v: 'kick', g: 'X.......X.......', vel: .6, ph: [1, 1], t: 1 }, { k: 'grid', v: 'kick', g: 'X...x...X...x...', vel: .7, ph: [2, 3], t: 1 },
    { k: 'grid', v: 'hat', g: '2.2.2.2.2.2.2.2.', vel: .5, ph: [1, 1], t: 2 }, { k: 'grid', v: 'hat', g: '2222222222222222', vel: .45, ph: [2, 3], t: 2 },
    { k: 'cell', v: 'horn', r: 'lead', c: 'Si', every: 4, oct: -12, vel: .55, ph: [1, 1] }, { k: 'cell', v: 'horn', r: 'lead', c: 'Si', every: 2, oct: -12, vel: .55, ph: [2, 2] }, { k: 'cell', v: 'horn', r: 'lead', c: 'Sd', every: 2, oct: -12, vel: .55, ph: [3, 3] },
    { k: 'lead', v: 'marimba', vel: .4, ph: [2, 3], t: 1 }, pad({ vox: 1, vel: .35, ph: [3, 3], t: 1 }), { k: 'grid', v: 'timp', g: 'xxxxxxxx........', ton: [0], oct: 2, every: 4, off: 3, vel: .4, ph: [3, 3], t: 1 }] };
const titan = { id: 'titan', steps: 16, q: 72, bars: 16, tn: 9, scale: MINOR, modes: { dor: DOR }, trim: 1, lp: 5000, reverb: 2.4, chords: '1 1 6 7 1 1 6 5 1 1 6 7 1 1 7 1', lead: { base: 69, plan: 'S2 ~ S2 ~ S2 ~ S2 ~ S2 ~ S2 ~ S2 ~ S2 ~' },
  layers: [{ k: 'lead', v: 'horn', oct: -12, vel: .5 }, { k: 'hit', v: 'pad', r: 'pad', ton: [0, 7], oct: 1, every: 4, len: 64, vel: .6 }, { k: 'grid', v: 'timp', g: 'X.......x.......', ton: [0], oct: 2, vel: .5, ph: [1, 1], t: 1 }, { k: 'grid', v: 'timp', g: 'X...x...X...x...', ton: [0], oct: 2, vel: .5, ph: [2, 3], t: 1 },
    { k: 'grid', v: 'kick', g: '........X.......', vel: .5, t: 1 }, { k: 'hit', v: 'glock', ton: [0], oct: 5, every: 4, len: 16, vel: .4, t: 1 }, pad({ vox: 1, vel: .3, ph: [2, 3], t: 1 }), bass('drone', { vel: .35, oct: -12 })] };

export const WORLD = { west, north, south, east, toy, candy, jungle, ice, ocean, lava, cloud, shadow, boss, titan };
