// Economy check (docs/MARKET-RESEARCH.md): a keen player on the game's own rules. Usage: node scripts/economy-sim.mjs [farm|farm+jobs]
// A busy but ordinary player, run on the game's own rules (game.mjs act/tick), to see how fast money comes and goes.
// Each real second of play is one tick; walking and tapping cost real seconds, as in the game.
import { freshState, act, tick, bedCount, plotCost, SUBJECTS } from '../src/game.mjs';
import { UPGRADES, CROPS } from '../src/content.mjs';
const mode = process.argv[2] ?? 'farm';           // farm | farm+jobs | idle
const s = freshState(); s.started = true; s.inventory.seed_carrot = 6;
let clock = 0; const wait = sec => { for (let i = 0; i < sec * 4; i++) tick(s, .25); clock += sec; };
const log = [], buyLog = [];
const crop = () => { const affordable = ['pumpkin', 'berry', 'radish', 'carrot'].find(c => s.upgrades.farm >= 0 && s.coins > CROPS[c].price * 6); return affordable ?? 'carrot'; };
function shop() {
  // Spend like a keen player: beds first, then the cheapest upgrade.
  for (let guard = 0; guard < 30; guard++) {
    if (bedCount(s) < 30 && s.coins >= plotCost(s) + 60 && act(s, 'plot').ok) { buyLog.push([s.day, 'bed', bedCount(s)]); continue; }
    const next = Object.entries(UPGRADES).map(([id, u]) => [id, u.cost[s.upgrades[id]]]).filter(([, c]) => c !== undefined).sort((a, b) => a[1] - b[1])[0];
    if (next && s.coins >= next[1] + 60 && act(s, 'upgrade', { id: next[0] }).ok) { buyLog.push([s.day, next[0], s.upgrades[next[0]]]); continue; }
    break;
  }
}
for (let day = 1; day <= 21; day++) {
  const start = s.coins, sales0 = s.stats.sales; let rests = 0;
  if (mode !== 'idle') {
    if (mode === 'farm+jobs') { act(s, 'civic', { id: 'company' }); wait(20); act(s, 'civic', { id: 'police' }); wait(20);
      act(s, 'lesson', { id: 'times' }); for (let i = 0; i < 30; i++) { act(s, 'answer', { given: s.quiz.answer }); wait(4); } }
    while (s.time < 21.5) {
      const c = crop();
      for (let i = 0; i < bedCount(s); i++) {
        const b = s.beds[i];
        if (!b) { if (!s.inventory['seed_' + c]) act(s, 'buySeed', { id: c }); if (act(s, 'plant', { index: i, crop: c }).ok) { wait(2); act(s, 'water', { index: i }); wait(1); } }
        else if (b && !b.watered) { act(s, 'water', { index: i }); wait(1); }
        else if (act(s, 'harvest', { index: i }).ok) wait(2);
      }
      if (s.energy < 6) { if (act(s, 'civic', { id: 'hospital' }).ok) wait(20); else if (rests < 2) { rests++; act(s, 'rest'); wait(40); } else break; }
      wait(4);
    }
    act(s, 'sell', { country: true }); shop();
  }
  act(s, 'sleep');
  log.push({ day, coins: s.coins, earned: s.coins - start + (buyLog.filter(b => b[0] === day).length ? 0 : 0), sales: s.stats.sales - sales0, beds: bedCount(s), upgrades: Object.values(s.upgrades).reduce((a, b) => a + b, 0) });
}
const allUp = Object.values(UPGRADES).reduce((n, u) => n + u.cost.length, 0);
console.log(`mode ${mode}: real minutes per day ≈ ${(clock / 21 / 60).toFixed(1)}`);
for (const r of log) console.log(`day ${String(r.day).padStart(2)}  sales ${String(r.sales).padStart(5)}  coins ${String(r.coins).padStart(6)}  beds ${String(r.beds).padStart(2)}  upgrades ${r.upgrades}/${allUp}`);
const doneUp = log.find(r => r.upgrades === allUp), doneBeds = log.find(r => r.beds === 30);
console.log(`all upgrades by day ${doneUp?.day ?? '>21'}, all 30 beds by day ${doneBeds?.day ?? '>21'}`);
