// The music's score tables, director, scheduler and settings, with no audio: node --test tests/music.test.mjs
// (the sound itself is measured in tests/music-browser.mjs, on rendered audio).
import test from 'node:test';
import assert from 'node:assert/strict';
import { CORE, STINGERS, stingerLength, VL, MAJOR } from '../src/music/scores-core.mjs';
import { WORLD } from '../src/music/scores-world.mjs';
import { compile, loopSeconds, parseBar, thin, PERC, shiftTo, mod, hash } from '../src/music/compile.mjs';
import { Scheduler } from '../src/music/scheduler.mjs';
import { Director, resolve, REGIONS, PRIORITY, variantOf, todOf, fightPlan } from '../src/music/director.mjs';
import { freshState, parseSave } from '../src/game.mjs';

const ALL = { ...CORE, ...WORLD }, IDS = Object.keys(ALL);
const TABLE = { title: 26.7, village: 45.7, visit: 26.7, shop: 18.5, market: 17.1, civic: 16.4, fishing: 35.6, festival: 18.5, race: 14.5, west: 25.3, north: 31, south: 32.7, east: 19.2, toy: 17.8, candy: 18, jungle: 18.5, ice: 34.3, ocean: 26.7, lava: 17.1, cloud: 21.8, shadow: 40, boss: 26.7, titan: 53.3 };
const SEASONS = ['spring', 'summer', 'autumn', 'winter'], TODS = ['morning', 'day', 'evening', 'night'];
const RANGE = { flute: [57, 91], glock: [72, 108], piano: [43, 86], bass: [28, 60], box: [60, 108], celesta: [72, 108], marimba: [36, 96] };

test('there is a score for every theme the design lists (24 pieces)', () => {
  assert.equal(IDS.length, 24);
  for (const id of ['title', 'village', 'home', 'visit', 'shop', 'market', 'civic', 'fishing', 'festival', 'race', 'west', 'north', 'south', 'east', 'toy', 'candy', 'jungle', 'ice', 'ocean', 'lava', 'cloud', 'shadow', 'boss', 'titan']) assert.ok(ALL[id], id);
});

test('1: every lead bar sums to its steps, the total is bars x steps, and a loop lasts what the table says', () => {
  for (const id of IDS) {
    const sc = ALL[id]; assert.ok(sc.bars > 0 && (sc.steps === 16 || sc.steps === 12), id);
    if (sc.lead.notes) { const bars = Array.isArray(sc.lead.notes) ? sc.lead.notes : sc.lead.notes.split('|'); assert.equal(bars.length, sc.bars, `${id} lead bars`); for (const b of bars) parseBar(b, sc.steps); }
    else assert.equal(sc.lead.plan.trim().split(/\s+/).length, sc.bars, `${id} plan tokens`);
    assert.equal(sc.chords.trim().split(/\s+/).length, sc.bars, `${id} chord bars`);
    const secs = loopSeconds(sc); if (TABLE[id]) assert.ok(Math.abs(secs - TABLE[id]) <= .1, `${id} loop ${secs} vs ${TABLE[id]}`);
    const c = compile(sc, { pass: 2, tier: 'high', phase: 3 }); assert.equal(c.bar.length * c.steps, sc.bars * sc.steps);
  }
  assert.ok(Math.abs(loopSeconds(CORE.home) / 2 - 29.1) < .1, 'home: 8 bars of the A pass last 29.1 s, with the B pass 16 bars');
  assert.ok(Math.abs(loopSeconds(ALL.south) - 32.7) < .1 && ALL.south.bars === 16);
  assert.deepEqual(parseBar('G4+/4 G4/4 -/8', 16).map(e => [e.m, e.d]), [[67, 8]], 'a tie joins two notes of one pitch');
  assert.throws(() => parseBar('G4/4 A4/2', 16), /not 16/);
});

/** All compiles worth checking: every piece at every tier and pass, every region piece in every key a fight can use, the village in all its variants. */
function* compiles() {
  for (const id of IDS) for (const tier of ['battery', 'balanced', 'high']) for (const pass of [0, 1, 2]) yield [id, { pass, tier, phase: 3 }, `${id}/${tier}/${pass}`];
  for (const id of ['boss', 'titan']) for (const tonic of [0, 2, 4, 5, 7, 9]) for (const mode of [undefined, 'dor']) for (const phase of [1, 2, 3]) yield [id, { pass: 1, tier: 'high', phase, tr: shiftTo(9, tonic), mode }, `${id}/${tonic}/${mode}/${phase}`];
  for (const id of IDS) yield [id, { pass: 1, tier: 'high', tension: true }, `${id}/tension`];
  for (const tod of TODS) for (const season of SEASONS) for (const rain of [false, true]) for (const riding of [0, 1, 2]) for (const farm of [false, true]) yield ['village', { pass: 2, tier: 'high', variant: { tod, season, rain, riding, farm } }, `village/${tod}/${season}/${rain}/${riding}/${farm}`];
}

test('2: every pitched note is in the piece\'s note set (plus its declared accidentals) and in the instrument\'s range', () => {
  let n = 0;
  for (const [id, o, label] of compiles()) {
    const c = compile(ALL[id], o); n++;
    for (const e of c.list) {
      if (!PERC.has(e.v)) assert.ok(c.allowed.has(mod(e.m, 12)), `${label}: ${e.v} plays pitch class ${mod(e.m, 12)} (note ${e.m}) outside ${[...c.allowed]}`);
      const r = RANGE[e.v]; if (r && !(e.v === 'piano' && id === 'shadow')) assert.ok(e.m >= r[0] && e.m <= r[1], `${label}: ${e.v} note ${e.m} outside ${r}`);
      assert.ok(e.b >= 0 && e.b < c.bars && e.s >= 0 && e.s < c.steps, `${label}: event placed outside the loop`);
    }
  }
  assert.ok(n > 450, `${n} compiles checked`);
});

test('3: lead and bass layers never overlap themselves (grace notes are the one declared exception)', () => {
  for (const [id, o, label] of compiles()) {
    const c = compile(ALL[id], o), by = new Map();
    for (const e of c.list) { if (e.ms < 0 && e.d === 1) continue; if (PERC.has(e.v) || !(e.r === 'lead' || e.v === 'bass')) continue; const k = e.l; if (!by.has(k)) by.set(k, []); by.get(k).push(e); }
    for (const [, es] of by) {
      if (es[0].v === 'bass' || es[0].r !== 'lead') { /* bass notes may be a chord's root and fifth only one after another */ }
      const abs = es.map(e => ({ at: e.b * c.steps + e.s, end: e.b * c.steps + e.s + e.d })).sort((a, b) => a.at - b.at);
      for (let i = 1; i < abs.length; i++) { const wrap = abs[i - 1].end > c.bars * c.steps; assert.ok(abs[i - 1].end <= abs[i].at || wrap && abs[i].at < abs[i - 1].end - c.bars * c.steps + 0, `${label}: layer ${es[0].l} (${es[0].v}) overlaps at step ${abs[i].at}`); }
    }
  }
});

test('4: polyphony: the notes sounding at one step stay under the hard cap of 18, and the balanced tier stays near its cap of 10', () => {
  let worst = 0, worstId = '';
  for (const id of IDS) for (const pass of [0, 1, 2]) {
    const c = compile(ALL[id], { pass, tier: 'balanced', phase: 3 }), total = c.bars * c.steps, load = new Float32Array(total);
    for (const e of c.list) { const w = e.p ? .5 : 1, from = e.b * c.steps + e.s, len = Math.min(e.d, 16) * (e.v === 'pad' || e.v === 'accordion' ? 1 : .7); for (let k = 0; k < len; k++) load[(from + k) % total] += w; }
    const peak = Math.max(...load); if (peak > worst) { worst = peak; worstId = id; }
    assert.ok(peak <= 18, `${id} pass ${pass}: ${peak} voices at once`);
  }
  assert.ok(worst <= 18, `${worstId} ${worst}`);
});

test('5: every event sits inside its loop and a note that runs past the end wraps into bar 1 (declared by the compile, which folds it)', () => {
  for (const id of IDS) { const c = compile(ALL[id], { pass: 0, tier: 'high' }); for (const e of c.list) assert.ok(e.b < c.bars); }
});

test('6: compiling is deterministic; a different pass changes the grace notes but stays in key', () => {
  const a = JSON.stringify(compile(CORE.village, { pass: 2, tier: 'high' }).bar), b = JSON.stringify(compile(CORE.village, { pass: 2, tier: 'high' }).bar);
  assert.equal(a, b);
  const p0 = compile(CORE.village, { pass: 0, tier: 'high' }), p2 = compile(CORE.village, { pass: 2, tier: 'high' });
  assert.notEqual(JSON.stringify(p0.bar), JSON.stringify(p2.bar));
  const grace = p2.list.filter(e => e.ms === -70); assert.ok(grace.length > 0, 'pass 2 has grace notes'); for (const e of grace) assert.ok(p2.allowed.has(mod(e.m, 12)));
  assert.equal(JSON.stringify(compile(CORE.village, { pass: 3, tier: 'high' }).bar), JSON.stringify(p0.bar), 'the cycle is three passes');
  assert.equal(hash('village'), hash('village'));
});

test('7: all 16 times of day x seasons (and rain, riding, the farm) compile, tempo in 50..100, layers not empty; night + winter is 52.8', () => {
  for (const tod of TODS) for (const season of SEASONS) for (const rain of [false, true]) for (const riding of [0, 1, 2]) {
    const c = compile(CORE.village, { pass: 1, tier: 'balanced', variant: { tod, season, rain, riding, farm: false } });
    assert.ok(c.bpm >= 50 && c.bpm <= 100, `${tod}/${season}/${rain}/${riding}: ${c.bpm}`); assert.ok(c.list.length > 50);
    assert.ok(new Set(c.list.map(e => e.v)).size >= 3);
  }
  const night = compile(CORE.village, { pass: 0, variant: { tod: 'night', season: 'winter' } }); assert.ok(Math.abs(night.bpm - 52.8) < .01, night.bpm);
  const day = compile(CORE.village, { pass: 0, variant: { tod: 'day', season: 'spring' } }); assert.ok(day.bpm > night.bpm);
  const nightC = compile(CORE.village, { pass: 2, tier: 'high', variant: { tod: 'night', season: 'spring' } });
  assert.ok(!nightC.list.some(e => e.p || e.v === 'marimba'), 'night: no percussion, no marimba');
  assert.ok(compile(CORE.village, { pass: 2, tier: 'high', variant: { tod: 'evening', season: 'spring' } }).swing > 0, 'evening swings');
});

test('quality tiers: battery has no percussion and fewer layers than high; the cap rises with the tier', () => {
  for (const id of IDS) {
    const lo = compile(ALL[id], { pass: 2, tier: 'battery', phase: 3 }), mid = compile(ALL[id], { pass: 2, tier: 'balanced', phase: 3 }), hi = compile(ALL[id], { pass: 2, tier: 'high', phase: 3 });
    assert.ok(!lo.list.some(e => e.p), `${id} battery has percussion`);
    assert.ok(lo.list.length <= mid.list.length && mid.list.length <= hi.list.length, id);
    assert.ok(lo.list.some(e => e.r === 'lead') && lo.list.some(e => e.r === 'pad'), `${id} battery keeps lead and pad`);
  }
});

test('boss: phases add layers, phase 3 is faster; the key follows the land (transposes), south and cloud are dorian', () => {
  const p = n => compile(WORLD.boss, { pass: 0, tier: 'high', phase: n });
  assert.ok(p(2).list.length > p(1).list.length && p(3).list.length > p(2).list.length); assert.ok(Math.abs(p(3).bpm / p(1).bpm - 1.08) < .001);
  const lava = compile(WORLD.boss, { pass: 0, tier: 'high', tr: shiftTo(9, 4) }), south = compile(WORLD.boss, { pass: 0, tier: 'high', tr: shiftTo(9, 7), mode: 'dor' });
  assert.equal(lava.tonic, 4); assert.ok(lava.allowed.has(4) && !lava.allowed.has(3)); assert.ok(south.allowed.has(mod(7 + 9, 12)), 'dorian has its raised sixth (E)');
  assert.ok(compile(WORLD.titan, { pass: 0, phase: 2, tier: 'high' }).list.length > compile(WORLD.titan, { pass: 0, phase: 1, tier: 'high' }).list.length);
  assert.equal(compile(WORLD.titan, { pass: 0, tier: 'high' }).bpm, 72);
});

test('tension is a layer on the region piece: the lead leaves, an ostinato and timpani come', () => {
  for (const id of REGIONS) { const calm = compile(ALL[id], { pass: 1, tier: 'high' }), tense = compile(ALL[id], { pass: 1, tier: 'high', tension: true });
    assert.ok(calm.list.some(e => e.r === 'lead') && !tense.list.some(e => e.r === 'lead'), id); assert.ok(tense.list.some(e => e.v === 'timp') && tense.list.some(e => e.v === 'pluck'));
    const plucks = o => compile(ALL[id], { pass: 1, tier: 'battery', ...o }).list.filter(e => e.v === 'pluck').length; assert.equal(plucks({ tension: true }) - plucks({}), 0, 'battery omits the tension pluck'); assert.ok(compile(ALL[id], { pass: 1, tier: 'balanced', tension: true }).list.filter(e => e.v === 'pluck').length > compile(ALL[id], { pass: 1, tier: 'balanced' }).list.filter(e => e.v === 'pluck').length); assert.ok(compile(ALL[id], { pass: 1, tier: 'battery', tension: true }).list.some(e => e.v === 'timp'), 'battery keeps the timpani'); }
});

test('10: stingers: at most 4 s, in key or in the chord, at every tonic', () => {
  for (const [name, st] of Object.entries(STINGERS)) {
    assert.ok(stingerLength(st) <= 4, `${name} ${stingerLength(st)} s`);
    for (const tonic of [0, 2, 4, 5, 7, 9]) for (const chord of [{ root: 7, iv: [0, 4, 7] }, { root: 0, iv: [0, 4, 7] }, { root: 9, iv: [0, 3, 7] }]) {
      const tr = st.tr ? shiftTo(7, tonic) : 0, evs = st.make ? st.make(chord) : st.ev, ok = new Set([...MAJOR.map(x => mod(x + 7 + tr, 12)), ...(st.acc ?? []).map(x => mod(x + 7 + tr, 12)), ...chord.iv.map(x => mod(x + chord.root, 12))]);
      for (const [, v, m] of evs) if (!PERC.has(v)) assert.ok(ok.has(mod(m + tr, 12)), `${name} @${tonic}: ${v} ${m + tr}`);
    }
  }
  assert.ok(Object.keys(STINGERS).length >= 18);
});

// ---- the director ----
const base = { cover: false, ko: false, location: 'village', interior: null, region: 'village', inside: true, time: 12, season: 'Spring', festival: false, rain: false, riding: 0, farm: false, fishing: false, race: false, shop: null, festivalPanel: false, threatened: false, fight: null, panel: false };

test('8: resolve() is pure and total: every combination names a piece that exists; priorities hold', () => {
  const kinds = new Set();
  for (const region of [null, 'village', ...REGIONS]) for (const location of ['village', 'interior']) for (const interior of [null, 'home', 'visit', 'shop', 'market', 'civic']) for (const time of [6, 12, 18, 21]) for (const flags of [{}, { fishing: true }, { race: true }, { festival: true }, { festivalPanel: true }, { shop: 'shop' }, { cover: true }]) {
    const r = resolve({ ...base, region, location, interior: location === 'interior' ? interior : null, time, ...flags }); assert.ok(ALL[r.piece], JSON.stringify([region, location, interior, flags]) + r.piece); kinds.add(r.kind);
  }
  assert.deepEqual([...kinds].sort(), ['activity', 'fishing', 'interior', 'region', 'title', 'village']);
  assert.equal(resolve({ ...base, ko: true }).piece, null, 'ko beats everything');
  assert.equal(resolve({ ...base, region: 'west', fishing: true, race: true }).piece, 'west', 'region over fishing and race');
  assert.equal(resolve({ ...base, location: 'interior', interior: 'home', race: true, fishing: true }).piece, 'home', 'interior over race and fishing');
  assert.equal(resolve({ ...base, race: true, fishing: true }).piece, 'race'); assert.equal(resolve({ ...base, fishing: true }).piece, 'fishing'); assert.equal(resolve(base).piece, 'village');
  assert.equal(resolve({ ...base, cover: true, region: 'west' }).piece, 'title');
  assert.equal(resolve({ ...base, location: 'interior', interior: 'civic' }).piece, 'civic'); assert.equal(resolve({ ...base, shop: 'market' }).piece, 'market');
  assert.ok(PRIORITY.fight > PRIORITY.ko && PRIORITY.ko > PRIORITY.tension && PRIORITY.tension > PRIORITY.region && PRIORITY.region > PRIORITY.interior && PRIORITY.interior > PRIORITY.activity && PRIORITY.activity > PRIORITY.fishing && PRIORITY.fishing > PRIORITY.village && PRIORITY.village > PRIORITY.title);
  assert.equal(todOf(6), 'morning'); assert.equal(todOf(12), 'day'); assert.equal(todOf(18), 'evening'); assert.equal(todOf(21), 'night');
  assert.equal(variantOf({ ...base, season: 'Winter', time: 21 }).season, 'winter');
  for (const region of ['village', 'west', 'cloud', 'shadow']) { const f = fightPlan({ kind: 'boss', region, phase: 2 }); assert.ok(ALL[f.piece]); assert.ok(f.tonic >= 0 && f.tonic < 12); }
  assert.equal(fightPlan({ kind: 'titan', region: 'candy', phase: 9 }).phase, 3); assert.equal(fightPlan({ kind: 'boss', region: 'south', phase: 1 }).mode, 'dor'); assert.equal(fightPlan(null), null);
});

test('8: hysteresis: border flapping never switches, a stay does; tension holds 4 s; a fight ends 1.5 s late, then calm for 3 s', () => {
  const d = new Director(); let t = 100, plan = d.update({ ...base, region: 'village' }, t); assert.equal(plan.main.piece, 'village');
  for (let i = 0; i < 40; i++) { t += .4; plan = d.update({ ...base, region: i % 2 ? 'village' : 'west', inside: true }, t); assert.equal(plan.main.piece, 'village', `flap ${i}`); }
  for (let i = 0; i < 3; i++) { t += .5; plan = d.update({ ...base, region: 'west', inside: false }, t); } assert.equal(plan.main.piece, 'village', 'not 3 m inside yet');
  t += .5; d.update({ ...base, region: 'west', inside: true }, t); t += 1.0; plan = d.update({ ...base, region: 'west', inside: true }, t); assert.equal(plan.main.piece, 'village', 'only 1 s inside'); t += .6; plan = d.update({ ...base, region: 'west', inside: true }, t);
  assert.equal(plan.main.piece, 'west'); assert.equal(plan.quant, true); assert.equal(plan.fade, 2.5);
  // tension
  t += 1; plan = d.update({ ...base, region: 'west', threatened: true }, t); assert.equal(plan.tension, true);
  t += 3.9; plan = d.update({ ...base, region: 'west', threatened: false }, t); assert.equal(plan.tension, true, 'held 4 s'); t += .3; plan = d.update({ ...base, region: 'west' }, t); assert.equal(plan.tension, false);
  // a fight
  const fight = { kind: 'boss', region: 'west', phase: 1, windup: true }; t += 1; plan = d.update({ ...base, region: 'west', fight, threatened: true }, t); assert.equal(plan.fight.piece, 'boss'); assert.equal(plan.fight.windup, true); assert.equal(plan.tension, false, 'a fight is not tension');
  t += 1; plan = d.update({ ...base, region: 'west', fight: null }, t); assert.ok(plan.fight, 'held after the fight ends'); assert.equal(plan.fight.windup, false);
  t += .6; plan = d.update({ ...base, region: 'west', fight: null, threatened: true }, t); assert.equal(plan.fight, null); assert.equal(plan.tension, false, 'calm for 3 s after a victory');
  t += 3.1; plan = d.update({ ...base, region: 'west', threatened: true }, t); assert.equal(plan.tension, true);
  // ko, wake, welcome
  t += 1; plan = d.update({ ...base, region: 'west', ko: true, hp: 0 }, t); assert.equal(plan.ko, true); assert.equal(plan.main, null); t += 1; plan = d.update({ ...base, region: 'west' }, t); assert.equal(plan.wake, true);
  const e = new Director(); e.update({ ...base, cover: true }, 0); assert.equal(e.update({ ...base, cover: true }, 1).main.piece, 'title'); plan = e.update({ ...base, cover: false }, 2); assert.equal(plan.welcome, true); assert.equal(e.update({ ...base }, 3).welcome, false);
});

// ---- the scheduler on a fake clock ----
function rig(src, opts = {}) {
  const clock = { t: 0 }, played = [], s = new Scheduler({ now: () => clock.t, emit: (e, t, sec) => played.push({ e, t, sec, at: clock.t }), ...opts });
  return { clock, played, s, src, run(until, dt = .06) { while (clock.t < until) { s.tick(); clock.t += dt; } } };
}
test('9: scheduler: nothing in the past, the lookahead is respected, a stall resyncs without a backlog, tempo ramps smoothly, grid times land on the 8th', () => {
  const src = compile(CORE.visit, { pass: 0, tier: 'high' }), r = rig(src); r.s.start(src, .05); r.run(12);
  assert.ok(r.played.length > 40);
  for (const p of r.played) { assert.ok(p.t >= p.at - 1e-9, 'never in the past'); assert.ok(p.t <= p.at + .25 + 0.1 + 1e-6, 'within the lookahead'); }
  const stepSec = 60 / (src.bpm * 4), first = r.played.filter(p => p.e.b === 0 && p.e.s === 0 && p.e.v === 'pad'); assert.ok(first.length >= 1);
  // a 3 s stall
  const before = r.played.length; r.clock.t += 3; r.s.tick(); const burst = r.played.slice(before); assert.ok(burst.length < 12, `no backlog (${burst.length})`); for (const p of burst) assert.ok(p.t >= r.clock.t - 1e-9);
  assert.ok(r.s.bar < src.bars);
  // resync to the bar line
  r.s.resync('bar'); r.s.tick(); assert.equal(r.s.step % src.steps, r.s.step);
  // the late governor
  let late = 0; const g = rig(src, { onLate: () => late++ }); g.s.start(src, .05); for (let i = 0; i < 4; i++) { g.s.tick(); g.clock.t += .3; } assert.ok(late >= 1, 'three late ticks in 30 s call onLate');
  // tempo ramp
  const q = rig(src); q.s.start(src, .05, 80); q.s.tempo(100, 32); const secs = []; let last = q.s.stepSeconds; q.run(6); assert.ok(q.s.bpm > 99.9, 'reached the new tempo');
  const w = rig(src); w.s.start(src, .05, 80); w.s.tempo(100, 32); const seen = new Set(); for (let i = 0; i < 40; i++) { w.s.tick(); w.clock.t += .06; seen.add(w.s.bpm.toFixed(1)); } assert.ok(seen.size > 4, 'the tempo glides through steps'); void secs; void last; void stepSec;
  const h = rig(src); h.s.start(src, .05); h.run(1.1); const t8 = h.s.grid(2); assert.ok(t8 >= h.s.next - 1e-9); let st = h.s.step, tt = h.s.next; while (st % 2) { tt += h.s.stepSeconds; st++; } assert.ok(Math.abs(t8 - tt) < 1e-9);
  // a source swapped inside onBar takes effect that bar
  const a = compile(CORE.visit, { pass: 0, tier: 'high' }), b = compile(CORE.visit, { pass: 1, tier: 'high' }); let swapped = 0; const x = rig(a, { onBar: bar => { if (bar === 1 && !swapped) { swapped = 1; x.s.src = b; } } }); x.s.start(a, .05); x.run(5); assert.equal(x.s.src, b);
});

test('11: settings: music defaults on at 0.5 for old saves; musicVol is clamped; sound and music are separate switches', () => {
  assert.equal(freshState().settings.music, true); assert.equal(freshState().settings.musicVol, .5);
  const old = freshState(); delete old.settings.music; delete old.settings.musicVol; const p = parseSave(JSON.parse(JSON.stringify(old))); assert.equal(p.settings.music, true); assert.equal(p.settings.musicVol, .5);
  for (const [raw, want] of [[.2, .2], [0, 0], [1, 1], [7, 1], [-3, 0], ['x', .5], [null, .5], [undefined, .5], ['0.3', .3]]) { const s = JSON.parse(JSON.stringify(freshState())); s.settings.musicVol = raw; assert.equal(parseSave(s).settings.musicVol, want, String(raw)); }
  const off = JSON.parse(JSON.stringify(freshState())); off.settings.music = false; off.settings.sound = false; const q = parseSave(off); assert.equal(q.settings.music, false); assert.equal(q.settings.sound, false);
});

test('the village tune is the one the design wrote, note by note', () => {
  assert.equal(VL.length, 16); assert.equal(VL[0], 'G4/4 A4/2 B4/2 D5/8'); assert.equal(VL[8], 'E5/4 G5/4 C6/8'); assert.equal(VL[15], 'G5/8 -/8');
  const t = thin(parseBar(VL[0], 16)); assert.deepEqual(t.map(e => e.d), [8, 8], 'the two short notes give their time to the one before'); assert.ok(t.every(e => e.d >= 4));
});
