import test from 'node:test';
import assert from 'node:assert/strict';
import { act, freshState, parseSave, sellPrice, seedCost, REST_PER_DAY } from '../src/game.mjs';
import { CROPS } from '../src/content.mjs';
import { PROJECTS, nextProject, perks, funded } from '../src/projects.mjs';
import { projectsHtml } from '../src/projects-view.mjs';

const rich = () => {
  const s = freshState();
  s.coins = 100000;
  return s;
};
const again = s => parseSave(JSON.parse(JSON.stringify(s)));

test('projects are funded one at a time, in order, and cost what they say', () => {
  const s = rich();
  assert.equal(nextProject(s).id, PROJECTS[0].id);
  const before = s.coins;
  assert.equal(act(s, 'fund', { id: PROJECTS[1].id }).ok, false, 'the second before the first');
  assert.equal(s.coins, before);
  assert.ok(act(s, 'fund', { id: PROJECTS[0].id }).ok);
  assert.equal(s.coins, before - PROJECTS[0].cost);
  assert.equal(act(s, 'fund', { id: PROJECTS[0].id }).ok, false, 'never twice');
  for (const p of PROJECTS.slice(1)) assert.ok(act(s, 'fund', { id: p.id }).ok, p.id);
  assert.equal(nextProject(s), null);
  assert.equal(act(s, 'fund', { id: 'nonsense' }).ok, false);
});

test('a project that is too dear changes nothing', () => {
  const s = freshState();
  s.coins = PROJECTS[0].cost - 1;
  const snapshot = structuredClone(s);
  assert.equal(act(s, 'fund', { id: PROJECTS[0].id }).ok, false);
  assert.deepEqual(s, snapshot);
});

test('costs rise with each project, and the whole village is a real sink', () => {
  const costs = PROJECTS.map(p => p.cost);
  assert.deepEqual(
    [...costs].sort((a, b) => a - b),
    costs,
  );
  assert.ok(costs.reduce((a, b) => a + b, 0) >= 10000);
});

test('the well gives one more rest a day', () => {
  const s = rich();
  const rests = () => {
    let n = 0;
    s.restDay = 0;
    s.restCount = 0;
    while (act(s, 'rest').ok) n++;
    return n;
  };
  assert.equal(rests(), REST_PER_DAY);
  act(s, 'fund', { id: 'well' });
  assert.equal(rests(), REST_PER_DAY + 1);
});

test('the cart and the clock add to what produce sells for, and the seed bank makes seeds cheaper', () => {
  const s = rich();
  const base = sellPrice(s, 'pumpkin');
  assert.equal(seedCost(s, 'carrot'), CROPS.carrot.price * 3);
  act(s, 'fund', { id: 'well' });
  act(s, 'fund', { id: 'cart' });
  assert.equal(sellPrice(s, 'pumpkin'), Math.floor(CROPS.pumpkin.sell * 1.05));
  act(s, 'fund', { id: 'seedbank' });
  assert.equal(seedCost(s, 'pumpkin'), Math.ceil(CROPS.pumpkin.price * 3 * 0.8));
  act(s, 'fund', { id: 'lanterns' });
  act(s, 'fund', { id: 'clock' });
  assert.equal(sellPrice(s, 'pumpkin'), Math.floor(CROPS.pumpkin.sell * 1.1));
  assert.ok(sellPrice(s, 'pumpkin') > base);
  assert.deepEqual(perks(s), { rest: 1, sell: 0.1, seeds: 0.2, supper: 0.5 });
});

test('buying seeds charges the discounted price', () => {
  const s = rich();
  s.chapter = 8;
  for (const p of PROJECTS.slice(0, 3)) act(s, 'fund', { id: p.id });
  const coins = s.coins;
  assert.ok(act(s, 'buySeed', { id: 'pumpkin' }).ok);
  assert.equal(coins - s.coins, seedCost(s, 'pumpkin'));
});

test('the harvest supper prize grows with the lanterns', () => {
  const plain = rich();
  plain.day = 3;
  plain.inventory.soup = 1;
  const before = plain.coins;
  act(plain, 'festival', { id: 'soup' });
  const prize = plain.coins - before;
  const lit = rich();
  lit.day = 3;
  lit.inventory.soup = 1;
  for (const p of PROJECTS.slice(0, 4)) act(lit, 'fund', { id: p.id });
  const coins = lit.coins;
  act(lit, 'festival', { id: 'soup' });
  assert.equal(lit.coins - coins, Math.floor(prize * 1.5));
});

test('funded projects survive a save and a load; unknown or odd entries are dropped', () => {
  const s = rich();
  s.day = 9;
  act(s, 'fund', { id: 'well' });
  act(s, 'fund', { id: 'cart' });
  assert.deepEqual(Object.keys(again(s).projects).sort(), ['cart', 'well']);
  const raw = JSON.parse(JSON.stringify(s));
  raw.projects = { well: 3, bogus: 5, cart: 'x', clock: 99999 };
  const back = parseSave(raw);
  assert.deepEqual(back.projects, { well: 3, clock: 9 });
  assert.ok(!funded(back, 'cart'));
});

test('the village tab offers only the next project, and says when everything is done', () => {
  const s = freshState();
  s.coins = 5000;
  let html = projectsHtml(s);
  assert.equal(html.match(/data-type="fund"/g).length, 1);
  assert.match(html, new RegExp(`data-id="${PROJECTS[0].id}"`));
  for (const p of PROJECTS) {
    s.coins = 100000;
    act(s, 'fund', { id: p.id });
  }
  html = projectsHtml(s);
  assert.equal(html.match(/data-type="fund"/g), null);
  assert.match(html, /Every project is done/);
  s.coins = 0;
  const poor = freshState();
  assert.match(projectsHtml(poor), /disabled/);
});
