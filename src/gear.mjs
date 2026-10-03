// STUB (wm-pandora): a stand-in for wm-house's gear module with exactly the contract's exports and signatures
// (cute_game-notes/willowmere/CONTRACT.md). Replace this whole file with wm-house's src/gear.mjs at the merge: the Pandora
// modules only read GEAR entries through gearStats(s) and weaponOf(s).
//
//   GEAR            id -> {name, slot:'hat'|'wear'|'boots'|'weapon'|'pet', price, icon, hp?, atk?, def?, crit?, speed?, regen?,
//                          kind?:'fist'|'sword'|'gun', range?, cooldown?}
//   gearStats(s)    -> {maxHp, attack, defense, crit, speed, regen} from worn gear (base 100 hp, 10 attack)
//   weaponOf(s)     -> the GEAR entry of the worn weapon, or the bare-fist entry
//
// A handful of pieces (the reference's first tier) so the fights and the tests have something to wear.
export const GEAR = {
  sword_wood: { name: 'Wooden sword', slot: 'weapon', price: 120, icon: 'items/sword_wood', atk: 6, kind: 'sword', range: 2, cooldown: .55 },
  gun_pea: { name: 'Pea shooter', slot: 'weapon', price: 260, icon: 'items/gun_pea', atk: 4, kind: 'gun', range: 8, cooldown: .6 },
  hat_straw: { name: 'Straw hat', slot: 'hat', price: 60, icon: 'items/hat_straw', hp: 20, def: 2 },
  armor_leather: { name: 'Leather vest', slot: 'wear', price: 150, icon: 'items/armor_leather', hp: 40, def: 8 },
  boots_cowboy: { name: 'Cowboy boots', slot: 'boots', price: 90, icon: 'items/boots_cowboy', def: 3, speed: .08 },
};
const FIST = { name: 'Bare hands', slot: 'weapon', price: 0, icon: '👊', kind: 'fist', range: 1, cooldown: .5 };
const worn = s => Object.values(s?.gear ?? {}).map(id => GEAR[id]).filter(Boolean);

export function gearStats(s) {
  const out = { maxHp: 100, attack: 10, defense: 0, crit: .05, speed: 0, regen: 0 };
  for (const g of worn(s)) { out.maxHp += g.hp ?? 0; out.attack += g.atk ?? 0; out.defense += g.def ?? 0; out.crit += g.crit ?? 0; out.speed += g.speed ?? 0; out.regen += g.regen ?? 0; }
  return out;
}
export function weaponOf(s) { const g = GEAR[s?.gear?.weapon]; return g?.slot === 'weapon' ? g : FIST; }
