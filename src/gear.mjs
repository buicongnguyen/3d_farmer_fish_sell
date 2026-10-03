// Things to wear and carry, after Zoo Garden's gear (cute_game src/content.ts items, model.ts equip/activeStats,
// item-groups.ts, item-power.ts): hats, outfits (slot 'wear'), boots, weapons and pets, with the same models
// (gear-wear.glb, gear-weapons.glb, pets.glb), icons and stats. Bought with coins at the Finch atelier, kept in the
// bedroom wardrobe. Gear always shows on the avatar; its stats only matter while Pandora's box is open (wm-pandora).
//
// Prices: the reference charges energy plus gathered materials; Willowmere has coins only, so a piece costs
// max(its reference price, twice its reference sell value), rounded to 5 coins (what it is worth with its materials in).
//
//   GEAR[id] = {id, name, slot, price, icon, hp?, atk?, def?, crit?, speed?, regen?,          every piece
//               kind?: 'sword' | 'gun', range?, cooldown?, spread?, shot?, special?, arc?, fx?,   weapons
//               pet?: {scale, dmg, cd, shot?}}                                                   pets
//   gearStats(s)  -> {maxHp, attack, defense, crit, speed, regen}   base 100 hp, 10 attack, 5% crit, speed x1
//   weaponOf(s)   -> the worn weapon's GEAR entry, or FIST
//
// Pure state (no three.js, no DOM). State fields: gear {hat, wear, boots, weapon, pet} ('' = none), gearOwned [ids].
export const GEAR_SLOTS = ['hat', 'wear', 'boots', 'weapon', 'pet'];
export const SLOT_NAMES = { hat: 'Hat', wear: 'Outfit', boots: 'Boots', weapon: 'Weapon', pet: 'Pet' };
export const SLOT_ICONS = { hat: '👒', wear: '🧥', boots: '👟', weapon: '⚔️', pet: '🐾' };
const TABLE = {
 hat_party:{name:'Party hat',slot:'hat',price:40,hp:10},
 hat_straw:{name:'Straw hat',slot:'hat',price:20,hp:10,def:3},
 hat_leather:{name:'Leather hat',slot:'hat',price:50,hp:20,def:7},
 hat_cowboy:{name:'Cowboy hat',slot:'hat',price:60,hp:20,def:6,crit:.03},
 hat_bunny:{name:'Bunny hat',slot:'hat',price:60,hp:15,def:3,speed:.06},
 hat_chef:{name:'Chef hat',slot:'hat',price:70,hp:30,def:4},
 hat_frog:{name:'Frog hat',slot:'hat',price:70,hp:20,def:5,speed:.05},
 hat_cat:{name:'Cat hat',slot:'hat',price:80,hp:25,def:7},
 hat_santa:{name:'Santa hat',slot:'hat',price:90,hp:30,def:6,regen:1},
 hat_pirate:{name:'Pirate hat',slot:'hat',price:100,hp:25,def:8},
 hat_wizard:{name:'Wizard hat',slot:'hat',price:120,hp:15,atk:6,def:5},
 hat_graduate:{name:'Graduation cap',slot:'hat',price:140,hp:20,def:5},
 hat_viking:{name:'Viking hat',slot:'hat',price:160,hp:40,atk:4,def:14},
 hat_bear:{name:'Bear hat',slot:'hat',price:180,hp:40,atk:5,def:12},
 hat_samurai:{name:'Samurai hat',slot:'hat',price:220,hp:45,def:16,crit:.05},
 hat_space:{name:'Space hat',slot:'hat',price:240,hp:45,atk:4,def:14},
 hat_halo:{name:'Halo',slot:'hat',price:380,hp:60,def:10,regen:2},
 crown:{name:'Royal crown',slot:'hat',price:400,atk:10,crit:.15},
 hat_lantern:{name:'Lantern hat',slot:'hat',price:480,hp:50,def:16},
 armor_leather:{name:'Leather outfit',slot:'wear',price:60,hp:25,def:8},
 armor_hoodie:{name:'Hoodie',slot:'wear',price:70,hp:30,def:6,speed:.05},
 armor_chef:{name:'Chef outfit',slot:'wear',price:80,hp:40,def:8,regen:1},
 armor_hawaii:{name:'Island shirt',slot:'wear',price:90,hp:30,def:8,speed:.08},
 armor_wolf:{name:'Wolf outfit',slot:'wear',price:130,hp:30,def:12,speed:.12},
 armor_santa:{name:'Santa outfit',slot:'wear',price:140,hp:50,def:12},
 armor_pirate:{name:'Pirate outfit',slot:'wear',price:180,hp:40,def:14,crit:.05},
 armor_bone:{name:'Bone outfit',slot:'wear',price:200,hp:60,def:20},
 armor_kimono:{name:'Kimono',slot:'wear',price:200,hp:40,def:12,speed:.1},
 armor_tux:{name:'Tuxedo',slot:'wear',price:240,hp:35,def:12,crit:.08},
 armor_leaf:{name:'Leaf outfit',slot:'wear',price:280,hp:50,def:18,regen:2},
 armor_knight:{name:'Knight outfit',slot:'wear',price:320,hp:90,def:28,speed:-.05},
 armor_space:{name:'Space outfit',slot:'wear',price:360,hp:80,def:26,speed:.08},
 armor_superhero:{name:'Superhero outfit',slot:'wear',price:440,hp:70,atk:8,def:20,speed:.1},
 armor_wings:{name:'Dragon wings',slot:'wear',price:480,hp:70,def:24,speed:.18},
 armor_cloud:{name:'Cloud outfit',slot:'wear',price:520,hp:80,def:26,speed:.15},
 armor_angel:{name:'Angel outfit',slot:'wear',price:520,hp:90,def:22,regen:3},
 boots_cowboy:{name:'Cowboy boots',slot:'boots',price:100,hp:20,def:8},
 boots_flipper:{name:'Swim flippers',slot:'boots',price:180,def:3},
 boots_lava:{name:'Lava boots',slot:'boots',price:180,def:6},
 boots_cloud:{name:'Cloud boots',slot:'boots',price:320,def:5,speed:.12},
 boots_rocket:{name:'Rocket boots',slot:'boots',price:400,def:4,speed:.25},
 sword_wood:{name:'Wood sword',slot:'weapon',price:25,atk:6,kind:'sword',range:2.3,cooldown:.55,special:'crescent',arc:.35},
 sword_tusk:{name:'Tusk sword',slot:'weapon',price:90,atk:14,crit:.05,kind:'sword',range:2.5,cooldown:.6,special:'gore',arc:.3},
 sword_candy:{name:'Candy sword',slot:'weapon',price:200,atk:22,crit:.08,kind:'sword',range:2.6,cooldown:.5,special:'crescent',arc:.3},
 toy_hammer:{name:'Toy hammer',slot:'weapon',price:240,atk:24,crit:.1,kind:'sword',range:2.4,cooldown:.6,special:'bonk',arc:.2,fx:'#ffe14d'},
 sword_crystal:{name:'Crystal sword',slot:'weapon',price:320,atk:26,crit:.1,kind:'sword',range:2.7,cooldown:.5,special:'wave',arc:.3},
 sword_lava:{name:'Lava sword',slot:'weapon',price:440,atk:38,crit:.12,kind:'sword',range:2.8,cooldown:.5,special:'wave',arc:.3},
 sword_obsidian:{name:'Obsidian sword',slot:'weapon',price:520,atk:46,crit:.14,kind:'sword',range:2.9,cooldown:.5,special:'magma',arc:.3},
 hammer_thunder:{name:'Thunder hammer',slot:'weapon',price:600,atk:55,crit:.1,kind:'sword',range:2.6,cooldown:.85,special:'thunder',arc:.1,fx:'#7ff7ff'},
 scythe_moon:{name:'Moon scythe',slot:'weapon',price:640,atk:48,crit:.18,kind:'sword',range:3.3,cooldown:.6,special:'whirl',arc:-.3,fx:'#c9e8ff'},
 trident:{name:'Ocean trident',slot:'weapon',price:680,atk:50,crit:.12,kind:'sword',range:3.4,cooldown:.62,special:'tsunami',arc:.4,fx:'#6fd3ff'},
 gun_pea:{name:'Pea blaster',slot:'weapon',price:40,atk:4,kind:'gun',range:10,cooldown:.38,shot:'pea',special:'peastorm'},
 gun_bubble:{name:'Bubble blaster',slot:'weapon',price:140,atk:9,kind:'gun',range:9,cooldown:.5,shot:'bubble',special:'bigbubble'},
 gun_spike:{name:'Spike blaster',slot:'weapon',price:220,atk:15,kind:'gun',range:7,cooldown:.75,spread:5,shot:'spike',special:'nova'},
 gun_ice:{name:'Ice blaster',slot:'weapon',price:260,atk:20,kind:'gun',range:10,cooldown:.42,shot:'ice',special:'blizzard'},
 bow_star:{name:'Star bow',slot:'weapon',price:560,atk:34,crit:.12,kind:'gun',range:13,cooldown:.55,shot:'arrow',special:'starfall'},
 staff_fire:{name:'Fire staff',slot:'weapon',price:680,atk:40,kind:'gun',range:10,cooldown:.7,shot:'fireball',special:'inferno'},
 blaster_rainbow:{name:'Rainbow blaster',slot:'weapon',price:760,atk:30,crit:.08,kind:'gun',range:11,cooldown:.22,shot:'rainbow',special:'laser'},
 bunny:{name:'Mochi bunny',slot:'pet',price:160,atk:3,pet:{scale:.5,dmg:.25,cd:1.5}},
 pet_robot:{name:'Robot companion',slot:'pet',price:300,atk:3,pet:{scale:.2,dmg:.3,cd:1.2,shot:'volt'}},
 pet_parrot:{name:'Parrot companion',slot:'pet',price:320,atk:3,pet:{scale:.55,dmg:.3,cd:1.3,shot:'arrow'}},
 pet_turtle:{name:'Turtle companion',slot:'pet',price:360,def:8,pet:{scale:.38,dmg:.25,cd:1.8,shot:'bubble'}},
 pet_sheep:{name:'Sheep companion',slot:'pet',price:440,hp:40,pet:{scale:.5,dmg:.3,cd:1.5,shot:'ice'}},
 pet_firefly:{name:'Firefly companion',slot:'pet',price:520,atk:4,pet:{scale:.5,dmg:.35,cd:1.3,shot:'fire'}},
 pet_dragon:{name:'Dragon companion',slot:'pet',price:600,atk:4,pet:{scale:.26,dmg:.35,cd:1.6}},
};
/** id -> {id, name, slot, price, icon, …stats}. `icon` is an icon id for content.mjs iconUrl ('items/<id>'). */
export const GEAR = Object.fromEntries(Object.entries(TABLE).map(([id, g]) => [id, Object.freeze({ id, icon: 'items/' + id, ...g })]));
/** Bare hands: what weaponOf returns with no weapon worn. */
export const FIST = Object.freeze({ id: 'fist', name: 'Bare hands', slot: 'weapon', price: 0, icon: '', atk: 0, kind: 'fist', range: 1, cooldown: .5, special: 'fist' });
/** Which model file holds a piece (avatar.mjs loads it the first time one is worn or tried on). */
export const kitOf = id => { const slot = GEAR[id]?.slot; return slot === 'weapon' ? 'gear-weapons' : slot === 'pet' ? 'pets' : slot ? 'gear-wear' : null; };
export const FLYING_PETS = ['pet_parrot', 'pet_firefly', 'pet_dragon'];
export const BASE_STATS = Object.freeze({ maxHp: 100, attack: 10, defense: 0, crit: .05, speed: 1, regen: 0 });

// ---------------------------------------------------------------- what is worn
export const emptyGear = () => ({ hat: '', wear: '', boots: '', weapon: '', pet: '' });
/** The worn ids of a state (always all five slots, '' = none). */
export const gearOf = s => { const g = s?.gear ?? {}, out = emptyGear(); for (const slot of GEAR_SLOTS) if (GEAR[g[slot]]?.slot === slot) out[slot] = g[slot]; return out; };
export const wornIds = s => Object.values(gearOf(s)).filter(Boolean);
export const ownsGear = (s, id) => !!GEAR[id] && !!s.gearOwned?.includes(id);
export const wearing = (s, id) => !!GEAR[id] && gearOf(s)[GEAR[id].slot] === id;
/**
 * What the worn gear adds up to: {maxHp, attack, defense, crit, speed, regen}. Base 100 health, 10 attack, 5% crit,
 * speed x1 (a multiplier, never below 0.2). wm-pandora uses these only while the box is open.
 */
export function gearStats(s) {
  let hp = 0, atk = 0, def = 0, crit = 0, speed = 0, regen = 0;
  const g = s?.gear;
  if (g) for (const slot of GEAR_SLOTS) { const it = GEAR[g[slot]]; if (!it || it.slot !== slot) continue; hp += it.hp ?? 0; atk += it.atk ?? 0; def += it.def ?? 0; crit += it.crit ?? 0; speed += it.speed ?? 0; regen += it.regen ?? 0; }
  return { maxHp: BASE_STATS.maxHp + hp, attack: BASE_STATS.attack + atk, defense: BASE_STATS.defense + def, crit: Math.min(.85, BASE_STATS.crit + crit), speed: Math.max(.2, BASE_STATS.speed + speed), regen: BASE_STATS.regen + regen };
}
/** The GEAR entry of the worn weapon, or FIST. */
export const weaponOf = s => { const it = GEAR[s?.gear?.weapon]; return it?.slot === 'weapon' ? it : FIST; };
/** The gear shown while trying a piece on: the worn gear with that one slot swapped (a new object; nothing is saved). */
export function previewGear(gear, id) { const out = { ...emptyGear(), ...gear }; if (GEAR[id]) out[GEAR[id].slot] = id; return out; }

// ---------------------------------------------------------------- actions (game.mjs act() delegates here)
const ok = message => ({ ok: true, message }), fail = message => ({ ok: false, message });
/** Adds a piece to the wardrobe without paying (a gift or a drop); false when unknown or already owned. */
export function grantGear(s, id) { if (!GEAR[id] || s.gearOwned?.includes(id)) return false; (s.gearOwned ??= []).push(id); return true; }
/** act(s, 'buyGear', {id}): pays, owns and puts it on. */
export function buyGear(s, arg = {}) {
  const it = GEAR[arg.id]; if (!it) return fail('The atelier does not have that.');
  if (ownsGear(s, it.id)) return fail('That is already in your wardrobe.');
  if (!Number.isFinite(s.coins) || s.coins < it.price) return fail(`${it.name} costs ${it.price} coins.`);
  s.coins -= it.price; grantGear(s, it.id); s.gear = gearOf(s); s.gear[it.slot] = it.id;
  return ok(`${it.name}, yours to keep. You put it on.`);
}
/** act(s, 'equip', {id}): wears an owned piece (it replaces what was in its slot). */
export function equipGear(s, arg = {}) {
  const it = GEAR[arg.id]; if (!it || !ownsGear(s, it.id)) return fail('That is not in your wardrobe.');
  if (wearing(s, it.id)) return fail(`You are wearing the ${it.name.toLowerCase()}.`);
  s.gear = gearOf(s); s.gear[it.slot] = it.id; return ok(it.slot === 'pet' ? `${it.name} trots along with you.` : `${it.name} on.`);
}
/** act(s, 'unequip', {slot}): takes off what is in a slot (it stays in the wardrobe). */
export function unequipGear(s, arg = {}) {
  const slot = arg.slot, worn = gearOf(s); if (!GEAR_SLOTS.includes(slot) || !worn[slot]) return fail('Nothing to take off there.');
  const it = GEAR[worn[slot]]; worn[slot] = ''; s.gear = worn; return ok(slot === 'pet' ? `${it.name} waits at home.` : `${it.name} put away.`);
}
/** Sanitises the gear fields of a loaded save: owned pieces that exist, worn pieces that are owned and in their own slot. */
export function parseGear(raw) {
  const gearOwned = Array.isArray(raw?.gearOwned) ? [...new Set(raw.gearOwned.filter(id => typeof id === 'string' && Object.hasOwn(GEAR, id)))] : [];
  const gear = emptyGear();
  for (const slot of GEAR_SLOTS) { const id = raw?.gear?.[slot]; if (typeof id === 'string' && GEAR[id]?.slot === slot && gearOwned.includes(id)) gear[slot] = id; }
  return { gear, gearOwned };
}

// ---------------------------------------------------------------- groups, weakest to strongest (item-groups.ts, item-power.ts)
export const GROUPS = { hat: { icon: '🎩', label: 'Hats' }, wear: { icon: '👕', label: 'Outfits' }, boots: { icon: '👢', label: 'Boots' }, sword: { icon: '⚔️', label: 'Melee weapons' }, ranged: { icon: '🏹', label: 'Guns & staffs' }, pet: { icon: '🐾', label: 'Pets' } };
export const GROUP_ORDER = ['hat', 'wear', 'boots', 'sword', 'ranged', 'pet'];
export const groupOf = id => { const it = GEAR[id]; return !it ? null : it.slot === 'weapon' ? (it.kind === 'gun' ? 'ranged' : 'sword') : it.slot; };
const statPoints = it => (it.def ?? 0) + (it.hp ?? 0) / 5 + (it.atk ?? 0) + 3 * (it.regen ?? 0) + 100 * (it.crit ?? 0) + 50 * (it.speed ?? 0);
const dps = it => (it.atk ?? 0) * ((it.spread ?? 1) > 1 ? it.spread * .45 : 1) / Math.max(.1, it.cooldown || .5);
const petShot = it => it.pet?.dmg && it.pet.cd ? it.pet.dmg / it.pet.cd * 100 : 0;
/** One effectiveness number per piece, in its own group's unit: weapons damage per second, wearables stat points, pets points plus their shot. */
export function gearScore(id) { const it = GEAR[id]; return !it ? 0 : it.slot === 'weapon' ? dps(it) : it.slot === 'pet' ? statPoints(it) + petShot(it) : statPoints(it); }
/** Weakest first; equal effect: cheaper first; then by id, so the order never shuffles. */
export const compareGear = (a, b) => gearScore(a) - gearScore(b) || (GEAR[a]?.price ?? 0) - (GEAR[b]?.price ?? 0) || (a < b ? -1 : a > b ? 1 : 0);
/** Splits ids into the labelled groups in GROUP_ORDER (empty ones left out), each sorted weakest to strongest. */
export function gearGroups(ids) {
  const buckets = new Map();
  for (const id of ids) { const g = groupOf(id); if (!g) continue; if (!buckets.has(g)) buckets.set(g, []); buckets.get(g).push(id); }
  return GROUP_ORDER.filter(g => buckets.has(g)).map(g => ({ id: g, ...GROUPS[g], ids: buckets.get(g).sort(compareGear) }));
}
const n1 = v => String(Math.round(v * 10) / 10);
/** The key numbers of a piece: "⚔️ 11/s", "🛡️ 8 · ❤️ 25", "🐾 25 · ⚔️ 3". */
export function powerLabel(id) {
  const it = GEAR[id]; if (!it) return '';
  if (it.slot === 'weapon') return `⚔️ ${n1(dps(it))}/s`;
  const parts = [it.def ? `🛡️ ${n1(it.def)}` : '', it.hp ? `❤️ ${n1(it.hp)}` : '', it.atk ? `⚔️ ${n1(it.atk)}` : ''].filter(Boolean);
  if (it.slot === 'pet') parts.unshift(`🐾 ${Math.round(gearScore(id))}`);
  return parts.join(' · ') || `✨ ${Math.round(gearScore(id))}`;
}
/** The smaller effects of a piece, as short chips: "💨 +12%", "✨ +5% crit", "💗 +2/s". */
export function perkLabels(id) {
  const it = GEAR[id]; if (!it) return [];
  return [it.speed ? `💨 ${it.speed > 0 ? '+' : ''}${Math.round(it.speed * 100)}%` : '', it.crit ? `✨ +${Math.round(it.crit * 100)}% crit` : '', it.regen ? `💗 +${it.regen}/s` : '', it.slot === 'weapon' ? `🎯 ${n1(it.range)} m` : ''].filter(Boolean);
}
