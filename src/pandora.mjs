// The Pandora box: the state rules. A chest in the player's home; open, the fields beyond the village hold wild
// creatures (wilds.mjs) you can fight (combat.mjs), worn gear counts (gear.mjs gearStats) and you have health; shut,
// there are no creatures, gear is only for looks and the combat HUD is gone. Pure (no Three.js, no DOM): game.mjs act()
// delegates the 'pandora', 'defeat', 'pickup' and 'knockout' actions here; pandora-view.mjs runs the rest each frame.
//
// Save fields (game.mjs freshState / parseSave): state.pandora (boolean), state.hp (number, at most maxHp(state)).
import { ITEMS, CROPS } from './content.mjs';
import { GEAR, gearStats, grantGear } from './gear.mjs';
import { CREATURES } from './wilds.mjs';
import { damageTaken } from './combat.mjs';

export const pandoraOpen = s => s?.pandora === true;
export const maxHp = s => Math.max(1, Math.round(gearStats(s).maxHp));
export const hpOf = s => Math.max(0, Math.min(maxHp(s), Number.isFinite(s.hp) ? s.hp : maxHp(s)));
/** Health per second: fast inside your own home (the reference's 4 × 4), slowly anywhere in the village, gear regen everywhere. */
export const HEAL = { home: 16, village: 4, wild: 0 };
/** A knock-out is gentle: you wake at home an hour later, rested, a few coins lighter (never in test mode). */
export const KNOCKOUT = { share: .05, cap: 30, hours: 1 };
/** Test mode (settings.test) makes fights easier. */
export const TEST = { attack: 3, taken: .5, cooldown: .5 };
/** After a hit nothing else can hurt you for this long (the reference's 0.55 s). */
export const MERCY = .55;

const ok = (message, extra) => ({ ok: true, message, ...extra }), fail = message => ({ ok: false, message });

/** What the fights use: gear stats, eased by test mode. */
export function combatStats(s) {
  const g = gearStats(s), test = s.settings?.test === true;
  return { attack: g.attack * (test ? TEST.attack : 1), crit: Math.max(0, Math.min(.85, g.crit ?? 0)), critDamage: 2, defense: Math.max(0, g.defense ?? 0), maxHp: maxHp(s), regen: Math.max(0, g.regen ?? 0), haste: 0,
    speed: Math.max(.2, Math.min(2, g.speed || 1)) }; // walking speed multiplier (boots, light outfits); 1 = none
}
/** A creature's blow lands: defence takes its share (damage × 60 / (def + 60)). Returns {damage, out}. */
export function hurt(s, amount) {
  if (!pandoraOpen(s) || !(amount > 0)) return { damage: 0, out: false };
  const damage = damageTaken(amount * (s.settings?.test ? TEST.taken : 1), combatStats(s).defense);
  s.hp = Math.max(0, hpOf(s) - damage);
  return { damage, out: s.hp <= 0 };
}
/**
 * Health returning over time. place: 'home' (inside your house), 'village' (inside the ward) or 'wild'.
 * `stats` may hand in combatStats(s) (the view keeps one), so the per-frame call makes nothing new.
 */
export function recover(s, dt, place = 'wild', stats = null) {
  if (!pandoraOpen(s) || !(dt > 0)) return;
  const g = stats ?? combatStats(s), hp = Math.max(0, Math.min(g.maxHp, Number.isFinite(s.hp) ? s.hp : g.maxHp));
  s.hp = hp <= 0 ? 0 : Math.min(g.maxHp, hp + ((HEAL[place] ?? 0) + g.regen) * dt);
}
/** Eating also restores health while the box is open (1 HP per energy point). Returns the health gained. */
export function foodHeal(s, energy) {
  if (!pandoraOpen(s) || !(energy > 0)) return 0;
  const before = hpOf(s); s.hp = Math.min(maxHp(s), before + energy); return s.hp - before;
}
export const canHeal = s => pandoraOpen(s) && hpOf(s) < maxHp(s);

// ---------------------------------------------------------------- rewards
/**
 * What a creature may drop: [item, chance, min, max]. The reference's loot mapped onto Willowmere: mushrooms, woodland
 * game, flowers and seed packets you already know, plus six sellable materials (content.mjs ITEMS: hide, honey, tusk,
 * claw, nectar, spine). The King Bear may also leave gear to wear (gear.mjs: the Bear hat, the Royal crown), as in the
 * reference; a piece you already own turns into coins.
 */
export const LOOT = {
  mushroom: [['mushroom', .6, 1, 2]],
  bee: [['honey', .5, 1, 1], ['daisy', .25, 1, 2]],
  boar: [['game', .55, 1, 1], ['hide', .4, 1, 1], ['tusk', .09, 1, 1]],
  frog: [['mushroom', .35, 1, 1], ['seed_berry', .25, 1, 2]],
  wolf: [['game', .4, 1, 1], ['hide', .5, 1, 2]],
  chomper: [['tulip', .55, 1, 2], ['nectar', .2, 1, 1]],
  cactus: [['spine', .6, 1, 3], ['sunflower', .3, 1, 2], ['seed_pumpkin', .2, 1, 2]],
  crab: [['claw', .5, 1, 1], ['perch', .2, 1, 1]],
  bear: [['game', 1, 2, 4], ['hide', 1, 2, 3], ['honey', .6, 1, 2], ['hat_bear', .25, 1, 1], ['crown', .12, 1, 1]],
};
const knownItem = id => !!ITEMS[id] || typeof id === 'string' && id.startsWith('seed_') && !!CROPS[id.slice(5)];
/** A second copy of a piece of gear is worth a quarter of its price. */
export const spareGearCoins = id => Math.max(1, Math.round((GEAR[id]?.price ?? 0) / 4));
/** Rolls a creature's loot: [{id, count}]. Each line draws two numbers, so a seeded generator replays exactly. */
export function rollLoot(type, random = Math.random) {
  const out = [];
  for (const [id, chance, min, max] of LOOT[type] ?? []) { const hit = random() < chance, roll = random(); if (hit) out.push({ id, count: min + Math.min(max - min, Math.floor(roll * (max - min + 1))) }); }
  return out;
}
/** What a knock-out would cost right now. */
export const knockoutLoss = s => s.settings?.test ? 0 : Math.min(KNOCKOUT.cap, Math.floor(Math.max(0, s.coins) * KNOCKOUT.share));

/** game.mjs act() delegates here. */
export function pandoraAct(s, type, arg = {}) {
  switch (type) {
    // Opening or shutting the box (the panel opens only at the box, inside your own home).
    case 'pandora': {
      if (typeof arg.open !== 'boolean') return fail('Open or close the box.');
      if (arg.open === pandoraOpen(s)) return fail(arg.open ? 'The Pandora box is already open.' : 'The Pandora box is already shut.');
      s.pandora = arg.open; s.hp = arg.open ? Math.max(1, hpOf(s)) : maxHp(s);
      return ok(arg.open ? 'The lid lifts. Something stirs in the far fields… wild creatures now roam beyond the village.' : 'The lid clicks shut. The fields are quiet again.');
    }
    // A creature falls: its coins are yours at once; its loot is tossed on the ground (pickup).
    case 'defeat': {
      const def = CREATURES[arg.type];
      if (!pandoraOpen(s) || !def) return fail('Nothing to defeat here.');
      s.coins += def.coins;
      return ok(`${def.name} defeated. +${def.coins} coins`, { coins: def.coins });
    }
    case 'pickup': {
      const n = Math.floor(Number(arg.count));
      if (pandoraOpen(s) && GEAR[arg.id] && n === 1) { // gear goes to the wardrobe, not the basket
        if (grantGear(s, arg.id)) return ok(`${GEAR[arg.id].name}! It hangs in your wardrobe now.`, { gear: arg.id });
        const coins = spareGearCoins(arg.id); s.coins += coins; return ok(`Another ${GEAR[arg.id].name}: traded for ${coins} coins`, { coins });
      }
      if (!pandoraOpen(s) || !knownItem(arg.id) || !(n >= 1) || n > 9) return fail('Nothing to pick up.');
      s.inventory[arg.id] = (s.inventory[arg.id] ?? 0) + n;
      return ok(`+${n} ${ITEMS[arg.id]?.name ?? CROPS[arg.id.slice(5)].name + ' seeds'}`);
    }
    case 'knockout': {
      if (!pandoraOpen(s)) return fail('You are safe and sound.');
      const loss = knockoutLoss(s);
      s.coins -= loss; s.hp = maxHp(s); s.time = Math.min(22, s.time + KNOCKOUT.hours);
      return ok(loss ? `You wake at home, rested. June paid ${loss} coins for bandages and a pot of tea.` : 'You wake at home, rested. June has the kettle on.', { loss });
    }
    default: return { ok: false, message: '', unknown: true }; // not one of ours: game.mjs sends only the four above
  }
}
