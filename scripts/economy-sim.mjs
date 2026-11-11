// Economy check (docs/MARKET-RESEARCH.md): a keen farm-only player on the game's own rules (game.mjs act), one pass a day.
// Usage: node scripts/economy-sim.mjs [days] [chapterEvery]
//   days          how many days to play (default 40)
//   chapterEvery  the player finishes an album chapter every N days (default 3: the story is not simulated)
// A day: harvest what is ripe, sell, spend (beds, upgrades, village projects), plant the best crop on sale, water every bed, sleep.
// What it answers: how fast money comes, when the farm's sinks run out, how much coin piles up unspent.
import { freshState, act, bedCount, plotCost, seedCost, ripe } from '../src/game.mjs';
import { UPGRADES, CROPS, cropUnlock } from '../src/content.mjs';
import { cropDays } from '../src/growth.mjs';
import { PROJECTS, nextProject } from '../src/projects.mjs';

const days = Number(process.argv[2] ?? 40),
  chapterEvery = Number(process.argv[3] ?? 3);
const s = freshState();
s.started = true;
const bought = [];
const spend = day => {
  for (let guard = 0; guard < 60; guard++) {
    const project = nextProject(s);
    if (project && s.coins >= project.cost + 60 && act(s, 'fund', { id: project.id }).ok) {
      bought.push([day, `project ${project.id}`]);
      continue;
    }
    if (bedCount(s) < 30 && s.coins >= plotCost(s) + 60 && act(s, 'plot').ok) {
      bought.push([day, `bed ${bedCount(s)}`]);
      continue;
    }
    const next = Object.entries(UPGRADES)
      .map(([id, u]) => [id, u.cost[s.upgrades[id]]])
      .filter(([, c]) => c !== undefined)
      .sort((a, b) => a[1] - b[1])[0];
    if (next && s.coins >= next[1] + 60 && act(s, 'upgrade', { id: next[0] }).ok) {
      bought.push([day, `${next[0]} ${s.upgrades[next[0]]}`]);
      continue;
    }
    break;
  }
};
// Coins per bed per day of the crops on sale, after the seed: the keen player picks the best.
const perBedDay = id => {
  const c = CROPS[id];
  return (c.sell * (c.yield + Math.max(0, s.upgrades.farm - 1)) - (c.free ? 0 : seedCost(s, id) / 3)) / cropDays(c);
};
const onSale = () => Object.keys(CROPS).filter(id => !CROPS[id].free && s.chapter >= cropUnlock(id));

const log = [];
for (let day = 1; day <= days; day++) {
  s.chapter = Math.min(8, Math.floor((day - 1) / chapterEvery));
  const start = s.coins,
    sales0 = s.stats.sales;
  for (let i = 0; i < bedCount(s); i++) if (s.beds[i] && ripe(s, s.beds[i])) act(s, 'harvest', { index: i });
  for (let i = 0; i < 3; i++) act(s, 'fillOrder', { index: i }); // the order board pays first for what it asks
  act(s, 'sell', { country: true });
  spend(day);
  const best = onSale().sort((a, b) => perBedDay(b) - perBedDay(a))[0] ?? 'carrot';
  for (let i = 0; i < bedCount(s); i++) {
    if (!s.beds[i]) {
      if (!s.inventory['seed_' + best]) act(s, 'buySeed', { id: best });
      act(s, 'plant', { index: i, crop: best });
    }
    if (s.beds[i] && !s.beds[i].watered) {
      if (s.energy < 1) act(s, 'rest');
      act(s, 'water', { index: i });
    }
  }
  act(s, 'sleep');
  log.push({
    day,
    best,
    sales: s.stats.sales - sales0,
    coins: s.coins,
    gain: s.coins - start,
    beds: bedCount(s),
    upgrades: Object.values(s.upgrades).reduce((a, b) => a + b, 0),
    projects: Object.keys(s.projects).length,
  });
}
const allUp = Object.values(UPGRADES).reduce((n, u) => n + u.cost.length, 0);
console.log(`farm only, a chapter every ${chapterEvery} days`);
for (const r of log)
  console.log(
    `day ${String(r.day).padStart(2)}  ${r.best.padEnd(11)} sales ${String(r.sales).padStart(5)}  coins ${String(r.coins).padStart(6)}  beds ${String(r.beds).padStart(2)}  upgrades ${r.upgrades}/${allUp}  projects ${r.projects}/${PROJECTS.length}`,
  );
const doneUp = log.find(r => r.upgrades === allUp),
  doneBeds = log.find(r => r.beds === 30),
  doneProj = log.find(r => r.projects === PROJECTS.length);
console.log(
  `all upgrades by day ${doneUp?.day ?? `>${days}`}, all 30 beds by day ${doneBeds?.day ?? `>${days}`}, all projects by day ${doneProj?.day ?? `>${days}`}`,
);
const last = log.slice(-5);
console.log(
  `last five days average: ${Math.round(last.reduce((n, r) => n + r.sales, 0) / last.length)} coins sold a day`,
);
