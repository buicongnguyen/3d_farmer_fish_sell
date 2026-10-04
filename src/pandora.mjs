// The Pandora box: the state rules. A chest in the player's home; open, the fields beyond the village hold wild
// creatures (wilds.mjs) you can fight (combat.mjs), worn gear counts (gear.mjs gearStats) and you have health; shut,
// there are no creatures, gear is only for looks and the combat HUD is gone. Pure (no Three.js, no DOM): game.mjs act()
// delegates the 'pandora', 'defeat', 'pickup' and 'knockout' actions here; pandora-view.mjs runs the rest each frame.
//
// Save fields (game.mjs freshState / parseSave): state.pandora (boolean), state.hp (number, at most maxHp(state)),
// state.defeated ({type: true} for every kind beaten once: the 'defeat' action writes it), state.pandoraSeen (the box has
// been opened in round 8 or later: the helpers' line is said once).
import { ITEMS, CROPS } from './content.mjs';
import { GEAR, gearStats, grantGear } from './gear.mjs';
import { CREATURES } from './wilds.mjs';
import { REGION } from './regions.mjs';
import { POWER, coinFactor } from './region-mix.mjs';
import { damageTaken } from './combat.mjs';
import { TITAN_LOOT } from './titans.mjs';

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
/** New copy for round 8 (spec 16.3, open question 2): said once, after the opening line. */
export const HELPERS_LINE = 'Three little helpers slipped out of the box too. The bosses have caged them.';

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
  forest_raptor: [['game', .5, 1, 1], ['hide', .3, 1, 1]],
  // Round 8. The three other home bosses, after the reference's rows (content.ts LOOT_TABLES) in Willowmere's items.
  treant: [['mushroom', 1, 3, 5], ['nectar', .8, 1, 2]],
  mushking: [['mushroom', 1, 2, 4], ['honey', .5, 1, 2], ['seed_berry', .4, 1, 1]],
  croc: [['hide', 1, 3, 5], ['tusk', .6, 1, 2], ['crown', .1, 1, 1]],
  // The eight lands: a common drops its land's own material (content.mjs ITEMS: cog, sugar, amber, icecrystal, pearl, obsidian,
  // feather, moonstone) and one thing Willowmere already has; a boss drops its land's material for sure.
  toysoldier: [['cog', .4, 1, 1], ['daisy', .25, 1, 2]], windmouse: [['cog', .4, 1, 1], ['hide', .2, 1, 1]], jackbox: [['cog', .4, 1, 1], ['honey', .2, 1, 1]],
  robot: [['cog', 1, 4, 6]],
  jelly: [['sugar', .4, 1, 1], ['honey', .2, 1, 1]], gummy: [['sugar', .4, 1, 1], ['hide', .3, 1, 1]], lollipop: [['sugar', .4, 1, 1], ['nectar', .2, 1, 1]],
  bunny: [['sugar', .4, 1, 1], ['hide', .2, 1, 1]], chocobeetle: [['sugar', .4, 1, 1], ['claw', .2, 1, 1]],
  cake: [['sugar', 1, 3, 5], ['honey', .6, 1, 2]], gingerbread: [['sugar', 1, 4, 6], ['honey', .6, 1, 2]], jellyqueen: [['sugar', 1, 4, 6], ['honey', .6, 1, 2]],
  monkey: [['amber', .4, 1, 1], ['game', .3, 1, 1]], snake: [['amber', .4, 1, 1], ['hide', .5, 1, 2]], chameleon: [['amber', .4, 1, 1], ['hide', .4, 1, 2]], flytrap: [['amber', .4, 1, 1], ['nectar', .2, 1, 1]],
  gorilla: [['amber', 1, 2, 3], ['honey', .7, 1, 2]],
  snowball: [['icecrystal', .4, 1, 1], ['daisy', .2, 1, 1]], penguin: [['icecrystal', .4, 1, 1], ['game', .5, 1, 1]], icebloom: [['icecrystal', .4, 1, 1], ['nectar', .2, 1, 1]],
  seal: [['icecrystal', .4, 1, 1], ['hide', .5, 1, 2]], owl: [['icecrystal', .4, 1, 1], ['game', .2, 1, 1]],
  yeti: [['icecrystal', 1, 3, 5], ['hide', 1, 2, 3], ['hat_bear', .2, 1, 1]], mammoth: [['icecrystal', 1, 2, 4], ['hide', 1, 4, 6], ['tusk', 1, 2, 3]], frostowl: [['icecrystal', 1, 3, 5]],
  jellyzap: [['pearl', .4, 1, 1], ['nectar', .15, 1, 1]], hammershark: [['pearl', .4, 1, 1], ['game', .6, 1, 2]], urchin: [['pearl', .4, 1, 1], ['spine', .6, 1, 3]],
  leviathan: [['pearl', 1, 2, 4]],
  magmaslime: [['obsidian', .4, 1, 1], ['honey', .15, 1, 1]], minislime: [['obsidian', .12, 1, 1]], firelizard: [['obsidian', .4, 1, 1], ['hide', .5, 1, 2]],
  volcano: [['obsidian', .4, 1, 1], ['sunflower', .2, 1, 1]], firebat: [['obsidian', .4, 1, 1], ['hide', .25, 1, 1]], magmacrab: [['obsidian', .4, 1, 1], ['claw', .4, 1, 1]],
  magmaturtle: [['obsidian', .55, 1, 2], ['hide', .3, 1, 1]], lavaworm: [['obsidian', .4, 1, 1], ['game', .4, 1, 1]],
  golem: [['obsidian', 1, 3, 5], ['crown', .1, 1, 1]],
  // The reference drops a dragon egg that crafts the pet; Willowmere has no crafting and has the pet as gear, so the pet itself drops.
  dragon: [['obsidian', 1, 3, 5], ['crown', .15, 1, 1], ['pet_dragon', .5, 1, 1]],
  cloudsheep: [['feather', .4, 1, 1], ['hide', .2, 1, 1]], thunderbird: [['feather', .4, 1, 1], ['game', .2, 1, 1]], windspirit: [['feather', .4, 1, 1], ['nectar', .2, 1, 1]],
  phoenix: [['feather', 1, 4, 6]],
  wisp: [['moonstone', .4, 1, 1], ['nectar', .15, 1, 1]], spider: [['moonstone', .4, 1, 1], ['hide', .3, 1, 1]], demoneye: [['moonstone', .4, 1, 1], ['tulip', .2, 1, 1]],
  shadowlord: [['moonstone', 1, 2, 3]],
};
// The nine titans' rows (titans.mjs, builder D2). Empty until that merge, so this line is inert in step 0.
Object.assign(LOOT, TITAN_LOOT);
const knownItem = id => !!ITEMS[id] || typeof id === 'string' && id.startsWith('seed_') && !!CROPS[id.slice(5)];
/** A second copy of a piece of gear is worth a quarter of its price. */
export const spareGearCoins = id => Math.max(1, Math.round((GEAR[id]?.price ?? 0) / 4));
/**
 * Rolls a creature's loot: [{id, count}]. Each line draws two numbers, so a seeded generator replays exactly. `luck` (worn
 * trophies, gear.mjs gearStats) raises every chance under one half by that share, as the reference's roll does (model.ts rollLoot).
 */
export function rollLoot(type, random = Math.random, luck = 0) {
  const out = [], lucky = 1 + Math.max(0, luck || 0);
  for (const [id, chance, min, max] of LOOT[type] ?? []) { const hit = random() < Math.min(1, chance < .5 ? chance * lucky : chance), roll = random(); if (hit) out.push({ id, count: min + Math.min(max - min, Math.floor(roll * (max - min + 1))) }); }
  return out;
}
/**
 * The coins a defeat pays: the kind's own (half the reference's XP); in a land × (0.6 + 0.4 × the land's power), the reference's
 * XP rule; and × (1 + xp) for worn trophies with an `xp` bonus.
 */
export function defeatCoins(type, region = null, xp = 0) {
  const def = CREATURES[type], info = REGION[region]; if (!def) return 0;
  return Math.round(Math.round(def.coins * (info?.kind === 'land' ? coinFactor(POWER[info.difficulty]) : 1)) * (1 + Math.max(0, xp || 0)));
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
      if (!arg.open) return ok('The lid clicks shut. The fields are quiet again.');
      // The first time the box is opened (in round 8 or after) one more line follows: who is in the cages out there (friends.mjs).
      const first = !s.pandoraSeen; s.pandoraSeen = true;
      return ok('The lid lifts. Something stirs in the far fields… wild creatures now roam beyond the village.' + (first ? ' ' + HELPERS_LINE : ''));
    }
    // A creature falls: its coins are yours at once; its loot is tossed on the ground (pickup).
    case 'defeat': {
      const def = CREATURES[arg.type];
      if (!pandoraOpen(s) || !def) return fail('Nothing to defeat here.');
      // The power belongs to the creature, not to its kind: the view says where it fell ({type, region, titan}).
      const coins = defeatCoins(arg.type, arg.region, gearStats(s).xp);
      s.coins += coins;
      (s.defeated ??= {})[arg.type] = true; // beaten once, for good: a friend's cage opens on it (friends.mjs)
      return ok(`${def.name} defeated. +${coins} coins`, { coins });
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
