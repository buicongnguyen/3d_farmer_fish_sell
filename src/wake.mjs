// What the HUD's words say about where you are (round 8 fix). Pure: main.mjs reads them; tests/wake.test.mjs pins them.
//
// Round 8 keeps you, and the car you sit in, where you were on reload (spec 7), so a save can wake 280 m out in a land. The
// words used to assume the village: the Begin toast said "Welcome home. Meet Ada…" in the Night Land, the idle prompt read
// "Explore your village" in Ember Fields, and the location line said "Open fields · follow the birds" in every region.
//
//   wakeGreeting   the toast on Begin: the village welcome inside the ward, near it, indoors and on a new save; farther
//                  out (ward.mjs wildDepth >= world.mjs HOME.magic, where Home is a magic hop) the region's name and Home
//   idleLabel      the action button with nothing in reach: the village's words where Home still walks (the ward and the 20 m round
//                  it, which holds the gate's road), the region's name farther out
//   locationLine   the line under the player's name (spec 5): decided by regions.mjs inWilds, the region's name outside the ward
import { REGION, regionAt, inWilds } from './regions.mjs';
import { wildDepth } from './ward.mjs';

export const WELCOME = 'Welcome home. Meet Ada, or let your garden be your first adventure.';
/** Metres beyond the ward from which Home is a magic hop (world.mjs HOME.magic; kept here so this file stays pure). */
export const FAR = 20;

const nameAt = (x, z) => REGION[regionAt(x, z)]?.name ?? null;
const ride = id => id === 'bike' ? 'motorcycle' : 'Bell family jeep';

/** The Begin toast. `fresh`: the save had never begun. `riding`: '' or the vehicle id. */
export const REDRAWN = 'The world now forms rings around the village. You woke beside a safe outpost.';
export function wakeGreeting({ fresh = false, location = 'village', x = 0, z = 0, riding = '', moved = false } = {}) {
  if (moved && !fresh) return REDRAWN;
  if (fresh || location !== 'village' || wildDepth(x, z) < FAR) return WELCOME;
  const name = nameAt(x, z); if (!name) return WELCOME;
  return `Back in ${name}${riding ? `, in the ${riding === 'bike' ? 'motorcycle' : 'jeep'}` : ''}. Home is one tap away.`;
}
/** The action button's words when nothing is in reach. */
export function idleLabel({ location = 'village', x = 0, z = 0 } = {}) {
  if (location === 'interior') return 'Look around the house';
  if (wildDepth(x, z) < FAR) return 'Explore your village';
  const name = nameAt(x, z); return name ? `Explore ${name}` : 'Explore the wilds';
}
/** The location line outdoors (indoors main.mjs prints the house's name). */
export function locationLine({ x = 0, z = 0, riding = '' } = {}) {
  const wild = inWilds(x, z), name = nameAt(x, z);
  if (riding) return wild ? `${name} · ${ride(riding)}` : `A little drive · ${ride(riding)}`;
  if (wild) return `${name} · follow the birds home`;
  return name ? 'Willowmere · home, at last' : 'Beyond the map';
}
