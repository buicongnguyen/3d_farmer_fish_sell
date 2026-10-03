// The seams between builders that live in main.mjs and pandora-view.mjs, where no node test can run the code (round 8; owner:
// builder C). Each assertion is a call another builder's file depends on: if the line goes, that builder has no way in.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { promptFor } from '../src/prompts.mjs';
import { freshState } from '../src/game.mjs';

const read = name => readFileSync(new URL('../src/' + name, import.meta.url), 'utf8');
const main = read('main.mjs'), pandora = read('pandora-view.mjs');

test('the three installers and the banner get one deps object: state, act, toast, persist, hud', () => {
  assert.match(main, /const deps=\{state:\(\)=>state,act:runAction,toast,persist,hud\};/);
  const order = ['pandora=installPandora(world,', 'installLands(world,deps);', 'installTitans(world,pandora,deps);', 'installFriends(world,pandora,deps);', 'installBanner(world,deps);'].map(s => main.indexOf(s));
  assert.ok(order.every(i => i > 0), 'all five calls are in boot()'); assert.deepEqual([...order].sort((a, b) => a - b), order, 'in that order');
  for (const [file, signature] of [['land-view.mjs', 'export function installLands(world, deps = {})'], ['titans-view.mjs', 'export function installTitans(world, pandora, deps = {})'], ['friends-view.mjs', 'export function installFriends(world, pandora, deps = {})'], ['region-banner.mjs', 'export function installBanner(world, deps = {})']])
    assert.ok(read(file).includes(signature), file);
});

test('a target main.mjs does not know by type answers through its own use(), and its prompt is its label', () => {
  // The last branch of the chain, after every type main.mjs knows.
  assert.match(main, /else if\(type==='dismount'\)world\.dismount\(\);\r?\n(?: \/\/[^\n]*\n)* else if\(typeof target\.use==='function'\)target\.use\(target\);\r?\n\}/);
  const s = freshState();
  for (const t of [{ type: 'cage', id: 'sprout', label: 'Locked cage' }, { type: 'lamp', id: 2, label: 'Light the lamp' }]) assert.deepEqual(promptFor(s, t), { label: t.label, wait: false });
  // The two actions a cage sends exist (game.mjs), so deps.act('rescue') is not refused as unknown.
  const game = read('game.mjs'); assert.match(game, /'rescue'/); assert.match(game, /'friendHome'/);
});

test('telegraph marks from other modules are drawn inside Pandora\'s frame, between begin and end', () => {
  const begin = pandora.indexOf('    fx.begin();'), drain = pandora.indexOf('for (let i = 0; i < markCount; i++) { const m = marks[i]; fx.decal(m.x, m.z, m.r, m.progress, m.hex); }'), end = pandora.indexOf('    fx.end(); marksDrawn = village ? markCount : 0; markCount = 0;');
  assert.ok(begin > 0 && drain > begin && end > drain, 'begin, the kept marks, end, then the list is emptied');
  assert.match(pandora, /ward\.visible = false; marksDrawn = markCount = 0; return; \}/, 'nothing is kept while the box is shut');
  assert.match(pandora, /\n    mark, get marks\(\) \{ return marksDrawn; \},/, 'world.pandora.mark');
  assert.match(main, /mark:\(x,z,r,progress,hex\)=>world\.pandora\.mark\(x,z,r,progress,hex\)/, 'the test hook reaches it');
  // Nobody else calls the immediate-mode pool.
  for (const file of ['land-view.mjs', 'titans-view.mjs', 'friends-view.mjs', 'region-banner.mjs']) assert.doesNotMatch(read(file).replace(/^\s*\/\/.*$/gm, ''), /fx\.decal\(/, file);
});
