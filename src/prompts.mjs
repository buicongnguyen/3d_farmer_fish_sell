// What the prompt pill (E / ACT) says for the thing in reach, and whether using it now would do anything. Pure (no DOM,
// no three.js): main.mjs asks it on every HUD refresh, so the pill always tells the truth about this moment: a bed that
// is still growing counts its seconds down, a tree picked today says so, the sofa shows when you may sit again. A thing
// that cannot be used right now is shown as "waiting" (a quiet pill, ACT not lit) with the reason in its label; pressing
// it anyway still answers with the same specific line, never with a generic refusal.
//
//   promptFor(state, target, {home})  ->  {label, wait} | null
//     target   a World target ({type, id, label, activity?}) or null
//     home     true inside your own house (the things to use at home have cooldowns only there)
import { CROPS, ITEMS, TREES } from './content.mjs';
import { ripe, cropProgress, treeWait } from './game.mjs';
import { ACTIVITIES, cooldownLeft, mmss } from './house-rules.mjs';

/** Produce sales that unlock Theo's jeep (main.mjs asks the same). */
export const JEEP_SALES = 200;
/** Energy each kind of work takes (game.mjs act()). */
export const EFFORT = { water: 1, feed: 3, cast: 3, gather: 2, hunt: 8 };
const TIRED = 'Too tired · rest or eat first';
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function promptFor(s, t, { home = true } = {}) {
  if (!t) return null;
  const go = label => ({ label: label ?? t.label ?? '', wait: false }), wait = label => ({ label, wait: true });
  const day = s.day, test = s.settings?.test === true, energy = s.energy ?? 0;
  switch (t.type) {
    case 'bed': {
      const b = s.beds?.[t.id]; if (!b) return go('Plant a seed');
      const name = CROPS[b.crop]?.name.toLowerCase() ?? 'crop';
      if (!b.watered) return energy < EFFORT.water ? wait(TIRED) : go(`Water the ${name}`);
      if (ripe(s, b)) return go(`Harvest ${name}`);
      return wait(`Growing ${name} · ${plural(Math.max(1, Math.ceil(CROPS[b.crop].grow * (1 - cropProgress(s, b)))), 'second')}`);
    }
    // A fruit tree: in an orchard circle ('tree'), or on the spot of a village tree you cleared ('spot').
    case 'tree': case 'spot': {
      const tree = t.type === 'spot' ? s.planted?.[t.id] : s.trees?.[t.id]; if (!tree) return go(t.type === 'spot' ? 'Plant a fruit tree' : 'Plant an orchard tree');
      const kind = TREES[tree.kind], left = treeWait(s, tree);
      if (left > 0) return wait(`Young ${kind?.name.toLowerCase() ?? 'tree'} · fruit in ${plural(left, 'morning')}`);
      if (!test && tree.picked === day) return wait('Picked today · more fruit tomorrow');
      return go(`Pick fresh ${kind?.plural ?? (ITEMS[tree.kind]?.name ?? 'fruit').toLowerCase()}`);
    }
    case 'feed': return s.fedDay === day ? wait('The animals are fed for today') : energy < EFFORT.feed ? wait(TIRED) : go();
    case 'collect': return s.fedDay !== day ? wait('Fill the feed trough first') : s.collectedDay === day ? wait('The basket fills again tomorrow') : go();
    case 'gather': return s.gathered?.[t.id] === day ? wait('This patch regrows tomorrow') : energy < EFFORT.gather ? wait(TIRED) : go();
    case 'hunt': return s.huntDay === day ? wait('The woodland rests until tomorrow') : energy < EFFORT.hunt ? wait(TIRED) : go();
    case 'fish': return energy < EFFORT.cast ? wait(TIRED) : go();
    case 'vehicle':
      if (t.id === 'jeep' && (s.stats?.sales ?? 0) < JEEP_SALES) return wait(`Theo’s jeep · sell ${JEEP_SALES - s.stats.sales} more coins of produce`);
      if (t.id === 'bike' && !s.bike) return go('The motorcycle · buy it at the workshop');
      return go();
    case 'fun': {
      const a = home ? ACTIVITIES[t.activity] : null, left = a ? cooldownLeft(s, a.id) : 0;
      return left > 0 ? wait(`${a.name} · ready in ${mmss(left)}`) : go();
    }
    default: return go();
  }
}
