// Round 8 finish: the Pandora panel describes the 13-square world (names come from the data, so the text cannot drift).
import test from 'node:test'; import assert from 'node:assert/strict';
import { pandoraPanel } from '../src/combat-hud.mjs';
import { DENS, REGION } from '../src/regions.mjs';
import { CREATURES } from '../src/wilds.mjs';
import { CAGES, FRIENDS } from '../src/friends.mjs';
import { freshState } from '../src/game.mjs';

test('the Pandora panel names the four home regions, their bosses, the lands, the titans and the three cages', () => {
  const s = freshState(), html = pandoraPanel(s).html;
  for (const d of DENS.filter(d => REGION[d.region].kind === 'home' && !d.titan)) assert.ok(html.includes(CREATURES[d.type].name), `the home boss ${d.type}`);
  for (const id of ['west', 'north', 'south', 'east']) assert.ok(html.includes(REGION[id].name), REGION[id].name);
  for (const c of Object.values(CAGES)) assert.ok(html.includes(CREATURES[c.boss].name), 'the cage boss ' + c.boss);
  for (const f of Object.values(FRIENDS)) assert.ok(html.includes(f.name), f.name);
  assert.match(html, /13 squares/); assert.match(html, /nine titans/); assert.ok(!/gentle ones|fierce ones/.test(html), 'the old two-kind world is gone');
});
