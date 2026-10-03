// The wild creatures of the open fields, alive only while the Pandora box is open, after Zoo Garden's home planet
// (cute_game src/enemy-types.ts, world.ts updateEnemyAi, boss-patterns.ts). Pure (no Three.js, no DOM): the facts, the
// seeded spawn plan and a compact simulation with the reference's phases (idle, chase, wind-up, charge, recover, return),
// leash, level of detail and respawn. wilds-view.mjs draws it; combat.mjs hits it.
//
//   wildCell(cx, cz)            the creatures a 32 m cell holds (seeded by region: regions.mjs, region-mix.mjs; none inside the village ward)
//   const wilds = new Wilds(host, random)
//   host.blocked?(x, z)         a tree or a building stands there
//   host.noGo?(x, z)            a place no creature enters (a lit lamp's disc in the Night Land: pandora-view.mjs asks world.lands)
//   host.pull?(dx, dz)          moves the player (a titan's pull): world.push
//   host.hurt(amount, source, creature)          source: 'melee' | 'shot'
//   host.emit?(kind, creature)  'spawn' 'alert' 'windup' 'strike' 'shot' 'defeat' 'respawn' 'leave'
//   wilds.sync(open, x, z)      loads the cells around the player (or lets every creature leave when the box is shut)
//   wilds.step(dt, player)      player: {x, z, active} (active false: indoors, driving, knocked out)
//   wilds.hit(creature, amount, stun, lift, knock, dirX, dirZ) -> damage dealt
import { FIELD_TILE, fieldTrees } from './field-layout.mjs';
import { WARD_MARGIN, SAFE, WARD_OUTLINE, inSafeZone, wildDepth } from './ward.mjs';
import { CELL, REGION, DENS, regionAt, squareOf, borderDistance, gridBorderDistance } from './regions.mjs';
import { MIX, DENSITY, POWER } from './region-mix.mjs';
import { landClear } from './land-features.mjs';
import { creature } from './creature-def.mjs';
import { TITAN_ROWS } from './titans.mjs';
import { titanTurn } from './titan-patterns.mjs'; // a titan's whole turn (builder D2): Wilds.titanStep hands over to it
// Hot loops use plain indexed loops and this instead of for-of and Math.hypot: neither makes garbage in any JIT tier.
const len = (x, z) => Math.sqrt(x * x + z * z);

/**
 * The reference's facts (hp, damage, speed m/s, reach, sight, radius, cooldown and wind-up in seconds, drawn scale; the
 * row builder is creature-def.mjs). Coins replace its XP at half the number. `level` is the kind's own label; the level a
 * creature shows comes from its spawn plan (the region's: difficulty × 3 − 2, +6 for a boss).
 */
export const CREATURES = {
  mushroom: creature('Grumpy Mushroom', 45, 6, 2.4, 4, 'hopper', '#ff4d5e', { radius: .55, reach: 1.3, sight: 8, scale: .49 }),
  bee: creature('Cross Wasp', 55, 8, 3.8, 6, 'melee', '#ffd23f', { radius: .5, reach: 1.4, flying: true, cooldown: 1.1, windup: .3, scale: .73 }),
  boar: creature('Wild Boar', 85, 10, 3, 7, 'charger', '#a9744f', { radius: .8, reach: 1.5, cooldown: 2.6, windup: .7, scale: .91 }),
  frog: creature('Poison Frog', 70, 10, 2.8, 8, 'hopper', '#6fd35a', { radius: .6, accent: '#b27dff', cooldown: 1.3, scale: .73, level: 4 }),
  wolf: creature('Grey Wolf', 100, 12, 4.3, 11, 'melee', '#8f9bb3', { sight: 12, cooldown: 1.3, windup: .35, scale: .99, level: 4 }),
  chomper: creature('Snapping Flower', 120, 14, 0, 10, 'rooted', '#58c24a', { radius: .8, reach: 2.5, sight: 7, accent: '#ff4f7a', cooldown: 1.7, windup: .55, scale: .67, level: 4, telegraph: 1.4 }),
  cactus: creature('Prickly Cactus', 140, 15, 0, 15, 'shooter', '#4cb86b', { radius: .75, reach: 11, sight: 11, cooldown: 2.1, windup: .6, scale: .67, level: 7 }),
  crab: creature('Stone Crab', 130, 14, 2.6, 13, 'melee', '#ff6a4d', { radius: .8, windup: .5, scale: .99, level: 7 }),
  bear: creature('King Bear', 800, 26, 2.5, 150, 'boss', '#8b5a3c', { reach: 2.6, sight: 13, radius: 1.4, cooldown: 2.2, windup: .6, scale: 1.85, level: 13, boss: true }),
};
// The nine titans' rows (titans.mjs, builder D2). Empty until that merge, so this line is inert in step 0.
Object.assign(CREATURES, TITAN_ROWS);

// ---------------------------------------------------------------- where they live
// The village ward (the shape lives in ward.mjs; re-exported here for the files that import it from wilds.mjs).
export { WARD_MARGIN, SAFE, WARD_OUTLINE, inSafeZone, wildDepth };
/**
 * The King Bear's den: an alias of his row in regions.mjs DENS (x, z, type, clear), kept so that existing imports load.
 * Round 8 moved him from the far north-east to the Redrock Canyon, 95.5 m beyond the ward; his creature's id is 'w:den:bear'.
 */
export const DEN = DENS.find(d => d.type === 'bear');
/** Clearances of the spawn plan (spec section 2): the lane along a full ribbon, the ward and the seams, a diagonal land's corner, a neighbour. */
export const SPAWN = Object.freeze({ gridLane: 6, line: 2, corner: 20, apart: 4, trunk: .5 });
export const WILD_CELL = 32, WILD_RADIUS = 2, SLOTS = 4;
const cellRandom = (cx, cz) => { let seed = (Math.imul(cx, 0x2c1b3c6d) ^ Math.imul(cz, 0x297a2d39) ^ 0x9a4d0c5) >>> 0; return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; };
const treeCache = new Map();
/** The blocking pieces of the 64 m tile around a point (field-layout.mjs fieldTrees), cached: creatures do not spawn inside a collider. */
function treesNear(x, z) {
  const tx = Math.floor(x / FIELD_TILE), tz = Math.floor(z / FIELD_TILE), key = tx + ',' + tz;
  let trees = treeCache.get(key);
  if (!trees) { if (treeCache.size > 200) treeCache.clear(); trees = fieldTrees(tx, tz); treeCache.set(key, trees); }
  return trees;
}
/** The corner of the centre cell a diagonal land touches (where a seam between two home regions ends), or null for any other region. */
function cornerOf(region) { const s = squareOf(region); return s && REGION[region].kind === 'land' && s.cx && s.cz ? { x: Math.sign(s.cx) * CELL / 2, z: Math.sign(s.cz) * CELL / 2 } : null; }
const CORNERS = Object.fromEntries(Object.keys(REGION).map(id => [id, cornerOf(id)]));
/**
 * The creatures of one cell: [{id, type, x, z, region, level, power, titan, leash, event}]. Seeded, so a place always holds
 * the same creatures. A den's creature comes first (only once its type has a row in CREATURES); the commons come from the
 * region's mix and density (region-mix.mjs). No creature where regionAt is null (outside the world) or in the village.
 */
export function wildCell(cx, cz) {
  const random = cellRandom(cx, cz), out = [];
  for (let i = 0; i < DENS.length; i++) {
    const d = DENS[i]; if (cx !== Math.floor(d.x / WILD_CELL) || cz !== Math.floor(d.z / WILD_CELL) || !CREATURES[d.type]) continue;
    out.push({ id: d.id, type: d.type, x: d.x, z: d.z, region: d.region, level: d.level, power: REGION[d.region].kind === 'land' ? POWER[REGION[d.region].difficulty] : 1, titan: d.titan, leash: d.leash, event: d.event });
  }
  slots: for (let i = 0; i < SLOTS; i++) {
    // Every slot draws its four numbers whether it is used or not, so one slot never shifts the next.
    const x = (cx + random()) * WILD_CELL, z = (cz + random()) * WILD_CELL, pick = random(), keep = random(), region = regionAt(x, z);
    if (!region || region === 'village') continue;
    const mix = MIX[region], info = REGION[region];
    if (!mix?.length || keep >= DENSITY[region] / SLOTS) continue;
    // Clear of the ward and the seams, of the lane along every full ribbon, and of the corner where a diagonal land meets the centre cell.
    if (inSafeZone(x, z, SPAWN.line) || borderDistance(x, z) < SPAWN.line || gridBorderDistance(x, z) < SPAWN.gridLane) continue;
    const corner = CORNERS[region]; if (corner && len(x - corner.x, z - corner.z) < SPAWN.corner) continue;
    // Every den's clearing applies whether or not its creature exists yet, so the commons are the same before and after it arrives.
    for (let k = 0; k < DENS.length; k++) if (len(x - DENS[k].x, z - DENS[k].z) < DENS[k].clear) continue slots;
    if (out.some(o => len(o.x - x, o.z - z) < SPAWN.apart)) continue;
    let roll = pick * mix.reduce((n, [, w]) => n + w, 0), type = mix[0][0];
    for (const [id, weight] of mix) { if (roll < weight) { type = id; break; } roll -= weight; }
    const def = CREATURES[type]; if (!def) continue;
    if (!landClear(x, z, def.radius, def.where ?? 'land')) continue;
    if (treesNear(x, z).some(t => len(t.x - x, t.z - z) < t.r + def.radius + SPAWN.trunk)) continue;
    out.push({ id: `w:${cx},${cz}:${i}`, type, x, z, region, level: info.level, power: info.kind === 'land' ? POWER[info.difficulty] : 1, titan: false, leash: AI.leashHome, event: null });
  }
  return out;
}

// ---------------------------------------------------------------- the simulation
/** The reference's numbers (boss-patterns.ts LEASH, KNOCK_IMPULSE, world.ts updateEnemyAi). */
export const AI = {
  leashHome: 30, leashSight: 1.6, hitGrace: 4, returnSight: 20, returnHeal: .3, wander: 2, wanderSpeed: .6,
  restRange: 48, chargeFrom: 8, chargeSpeed: 13, chargeTime: .75, chargeHit: 1.3, slamEvery: 3, slamWindup: 1.1, slamReach: 5.5, slamHit: 1.25, slamRadius: 4.8,
  recover: .45, bossRecover: .7, shotSpeed: 13, shotLife: 1.4, shotHit: .65, respawn: 22, respawnSpread: 10, bossRespawn: 90, respawnClear: 22,
  knock: 6, bossKnock: .15, bossLift: .0625, hardStun: .5, launchStun: .75, gravity: 24, playerRadius: .4, born: .35, leave: .35, dying: .3,
};
export const STEP = .025, MAX_STEPS = 4;
/** A creature that moved farther than this in one step was put there (respawn), not walked: it is drawn there at once. */
export const GLIDE_MAX = 1.5;
/**
 * Where a creature is drawn at `now` (the simulation's clock plus what the frame has gathered towards the next step):
 * between the place it left on its last move and where the simulation has it, over the time that move covers.
 * Returns the share 0..1 of the way (1: on its simulated place).
 */
export const glideShare = (e, now) => e.moveSpan > 0 ? Math.min(1, Math.max(0, (now - e.moveAt) / e.moveSpan)) : 1;
const slotOf = id => { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0; return h % 4; };
/** Wind-up progress 0–1: exactly 1 on the step the blow lands (telegraphs fill with it). */
export const windupProgress = e => e.phase !== 'windup' || !(e.windupTotal > 0) ? 0 : Math.min(1, Math.max(0, 1 - e.phaseTime / e.windupTotal));
/** A creature that chases, winds up or attacks (walking home or idling is calm). */
export const aggro = e => e.hp > 0 && e.phase !== 'idle' && e.phase !== 'return';

export class Wilds {
  constructor(host = {}, random = Math.random) {
    this.host = host; this.random = random; this.list = []; this.cells = new Map(); this.dead = new Map(); this.time = 0; this.tick = 0; this.cx = this.cz = NaN; this.open = false;
    this.shots = Array.from({ length: 12 }, () => ({ live: false, x: 0, z: 0, vx: 0, vz: 0, life: 0, damage: 0, owner: null }));
    this.awake = [];
  }
  make(plan) {
    const def = CREATURES[plan.type], until = this.dead.get(plan.id) ?? 0, down = until > this.time;
    if (!down) this.dead.delete(plan.id);
    // The plan's region, level, power, titan, leash and event are stored (a plan without them behaves as before). Nothing is scaled
    // by `power` yet (every kind that exists has power 1: builder D). titanLift, attack and forced are for the titans (titanStep).
    return { id: plan.id, type: plan.type, def, region: plan.region ?? null, level: plan.level ?? def.level, power: plan.power ?? 1, titan: plan.titan ?? !!def.titan, leash: plan.leash ?? AI.leashHome, event: plan.event ?? null, titanLift: 0, attack: null, forced: '',
      x: plan.x, z: plan.z, homeX: plan.x, homeZ: plan.z, hp: down ? 0 : def.hp, maxHp: def.hp, damage: def.damage, radius: def.radius, facing: (plan.x * 12.9898 + plan.z * 78.233) % 6.283,
      phase: 'idle', phaseTime: 0, windupTotal: 0, cooldown: 0, stun: 0, lift: 0, liftV: 0, kx: 0, kz: 0, targetX: plan.x, targetZ: plan.z, respawn: down ? until - this.time : 0, lastHit: -99,
      attacks: 0, slam: false, charged: false, flash: 0, dying: 0, born: down ? 0 : AI.born, leaving: 0, resting: false, wait: 0, slot: slotOf(plan.id),
      px: plan.x, pz: plan.z, sx: plan.x, sz: plan.z, moveAt: 0, moveSpan: 0, thought: 0 }; // the place it left on its last move and the time that move covers (drawn gliding, see step)
  }
  /**
   * Loads the cells around (x, z), 5 × 5 unless `radius` asks for more (a camera zoomed far out sees past two cells), and
   * retires the others. Shut: every creature leaves (a short shrink) and nothing loads.
   */
  sync(open, x, z, radius = WILD_RADIUS) {
    if (!open) {
      if (this.open || this.cells.size) { for (const e of this.list) if (!e.leaving) { e.leaving = AI.leave; this.host.emit?.('leave', e); } this.cells.clear(); this.dead.clear(); this.cx = this.cz = NaN; this.radius = 0; for (const s of this.shots) s.live = false; }
      this.open = false; return;
    }
    this.open = true;
    const cx = Math.floor(x / WILD_CELL), cz = Math.floor(z / WILD_CELL);
    if (cx === this.cx && cz === this.cz && radius === this.radius) return; // same cell and window as last frame: nothing to do, nothing made
    this.cx = cx; this.cz = cz; this.radius = radius;
    for (const [id, cell] of this.cells) {
      const [ix, iz] = cell.at;
      if (Math.abs(ix - cx) <= radius && Math.abs(iz - cz) <= radius) continue;
      for (const e of cell.list) { if (e.hp <= 0 && e.respawn > 0) this.dead.set(e.id, this.time + e.respawn); e.gone = true; this.host.emit?.('retire', e); }
      this.cells.delete(id);
    }
    for (let ix = cx - radius; ix <= cx + radius; ix++) for (let iz = cz - radius; iz <= cz + radius; iz++) {
      const id = ix + ',' + iz; if (this.cells.has(id)) continue;
      const list = wildCell(ix, iz).map(plan => this.make(plan)); this.cells.set(id, { at: [ix, iz], list });
      for (const e of list) this.host.emit?.('spawn', e);
    }
    this.list = this.list.filter(e => !e.gone); for (const cell of this.cells.values()) for (const e of cell.list) if (!this.list.includes(e)) this.list.push(e);
    if (this.dead.size > 400) for (const [id, until] of this.dead) if (until <= this.time) this.dead.delete(id);
  }
  walkable(e, x, z) { return !inSafeZone(x, z, e.radius) && !this.host.blocked?.(x, z) && !this.host.noGo?.(x, z); }
  /** Moves by (dx, dz), sliding along what blocks it. The ward and trees stop it. */
  move(e, dx, dz) {
    const x = e.x + dx, z = e.z + dz;
    if (this.walkable(e, x, z)) { e.x = x; e.z = z; return; }
    if (dx && this.walkable(e, x, e.z)) e.x = x; else if (dz && this.walkable(e, e.x, z)) e.z = z;
  }
  /** A blow from the player. Returns the damage dealt. */
  hit(e, amount, stun = 0, lift = 0, knock = 0, dirX = 0, dirZ = 0) {
    if (!(e.hp > 0) || e.leaving > 0 || !(amount > 0)) return 0;
    const dealt = Math.min(e.hp, amount), boss = e.def.boss; e.hp -= dealt; e.lastHit = this.time; e.flash = .14;
    if (e.hp <= 0) { e.hp = 0; e.respawn = boss ? AI.bossRespawn : AI.respawn + this.random() * AI.respawnSpread; e.dying = AI.dying; e.phase = 'idle'; e.kx = e.kz = e.stun = e.lift = e.liftV = 0; this.host.emit?.('defeat', e); return dealt; }
    if (!boss && stun >= AI.hardStun) e.stun = Math.max(e.stun, stun);
    if (lift > 0) { e.liftV = Math.max(e.liftV, Math.sqrt(lift * (boss ? AI.bossLift : 1) * AI.gravity)); e.stun = Math.max(e.stun, AI.launchStun); }
    if (knock > 0 && e.def.speed > 0) { const k = knock * AI.knock * (boss ? AI.bossKnock : 1); e.kx += dirX * k; e.kz += dirZ * k; }
    return dealt;
  }
  shoot(e, target) {
    const shot = this.shots.find(s => !s.live); if (!shot) return;
    const d = Math.max(.01, len(target.x - e.x, target.z - e.z));
    shot.live = true; shot.x = e.x; shot.z = e.z; shot.vx = (target.x - e.x) / d * AI.shotSpeed; shot.vz = (target.z - e.z) / d * AI.shotSpeed; shot.life = AI.shotLife; shot.damage = e.damage; shot.owner = e;
    this.host.emit?.('shot', e);
  }
  /** `target` is the player when it can be fought (null inside the ward, driving, indoors); `near` is how far the player really is. */
  think(e, dt, target, near) {
    const def = e.def;
    e.cooldown = Math.max(0, e.cooldown - dt); e.stun = Math.max(0, e.stun - dt);
    const distance = target ? near : Infinity;
    if (def.behavior === 'titan') return this.titanStep(e, dt, target, distance);
    // Level of detail: a calm creature far from the player rests; nearer, it only wanders, so it thinks on every 4th step.
    const calm = e.phase === 'idle' && e.hp === e.maxHp && !e.stun;
    e.resting = calm && near > AI.restRange; if (e.resting) { e.wait = 0; return; }
    if (calm && near > def.sight + 1) { e.wait += dt; if ((this.tick + e.slot) % 4) return; dt = e.wait; e.wait = 0; } else e.wait = 0;
    e.thought = dt; // the time this thought covers: a move made in it is drawn gliding over the same time
    if (e.stun > 0) { if (e.phase !== 'return') e.phase = 'chase'; return; }
    if (e.phase === 'windup') {
      if ((e.phaseTime -= dt) > 0) return;
      if (def.behavior === 'charger') {
        e.phase = 'charge'; e.phaseTime = AI.chargeTime; e.charged = false;
        if (target) { const d = distance || 1, run = AI.chargeSpeed * AI.chargeTime; e.targetX = e.x + (target.x - e.x) / d * run; e.targetZ = e.z + (target.z - e.z) / d * run; }
        this.host.emit?.('strike', e); return;
      }
      if (target) {
        if (def.behavior === 'shooter') this.shoot(e, target);
        else if (distance < (e.slam ? AI.slamReach : def.reach + (def.boss ? .2 : 0)) + .4) this.host.hurt?.(e.damage * (e.slam ? AI.slamHit : 1), 'melee', e);
      }
      this.host.emit?.('strike', e); e.phase = 'recover'; e.phaseTime = def.boss ? AI.bossRecover : AI.recover; e.cooldown = def.cooldown; return;
    }
    if (e.phase === 'charge') {
      const dx = e.targetX - e.x, dz = e.targetZ - e.z, d = len(dx, dz);
      if (d > .1) { this.move(e, dx / d * AI.chargeSpeed * dt, dz / d * AI.chargeSpeed * dt); e.facing = Math.atan2(dx, dz); }
      if (target && !e.charged && len(target.x - e.x, target.z - e.z) < def.reach + .4) { e.charged = true; this.host.hurt?.(e.damage * AI.chargeHit, 'melee', e); }
      if ((e.phaseTime -= dt) <= 0 || d < .3) { e.phase = 'recover'; e.phaseTime = AI.recover; e.cooldown = def.cooldown; }
      return;
    }
    if (e.phase === 'recover') { if ((e.phaseTime -= dt) <= 0) e.phase = 'chase'; return; }
    // Leash: a chaser gives up past 1.6 × its sight or 30 m from home, unless it was hit in the last 4 s. A player inside
    // the ward (or driving, or indoors) is no target at all, so the chase ends at the ward line.
    const homeDistance = len(e.x - e.homeX, e.z - e.homeZ), wasChasing = e.phase === 'chase' || e.hp < e.maxHp && e.phase !== 'return', sinceHit = this.time - e.lastHit;
    const chasing = !!target && (sinceHit < AI.hitGrace || (e.phase === 'return' ? distance < def.sight && homeDistance < AI.returnSight
      : wasChasing ? distance <= def.sight * AI.leashSight && homeDistance <= AI.leashHome : distance < def.sight && homeDistance < AI.leashHome));
    let returning = !chasing && (wasChasing || e.phase === 'return');
    if (returning) { e.phase = 'return'; e.hp = Math.min(e.maxHp, e.hp + e.maxHp * AI.returnHeal * dt); if (homeDistance < .8 || def.speed === 0) { e.hp = e.maxHp; e.phase = 'idle'; returning = false; } }
    if (chasing && e.phase !== 'chase') { if (e.phase === 'idle' || e.phase === 'return') this.host.emit?.('alert', e); e.phase = 'chase'; }
    if (chasing && !e.cooldown && (distance < def.reach + (def.boss ? .2 : 0) || def.behavior === 'charger' && distance < AI.chargeFrom)) {
      e.phase = 'windup'; e.attacks++; e.slam = def.boss && e.attacks % AI.slamEvery === 0; e.phaseTime = e.windupTotal = e.slam ? AI.slamWindup : def.windup;
      e.targetX = target.x; e.targetZ = target.z; e.facing = Math.atan2(target.x - e.x, target.z - e.z); this.host.emit?.('windup', e); return;
    }
    if (def.speed === 0 || chasing && distance < def.reach * .8) { if (chasing) e.facing = Math.atan2(target.x - e.x, target.z - e.z); return; }
    const gx = chasing ? target.x : returning ? e.homeX : e.homeX + Math.sin(this.time * .25 + e.homeZ) * AI.wander, gz = chasing ? target.z : returning ? e.homeZ : e.homeZ + Math.cos(this.time * .25 + e.homeX) * AI.wander;
    const dx = gx - e.x, dz = gz - e.z, d = len(dx, dz), hurt = def.boss ? (e.hp < e.maxHp * .5 ? 1.35 : 1) * (e.hp < e.maxHp * .3 ? 1.25 : 1) : 1;
    if (d > .05) { const step = Math.min(d, (chasing ? def.speed * hurt : returning ? def.speed * 1.2 : AI.wanderSpeed) * dt); this.move(e, dx / d * step, dz / d * step); e.facing = Math.atan2(dx, dz); }
  }
  /**
   * A titan's whole turn (builder D2): reached from think() for a row with behavior 'titan'. The code is titan-patterns.mjs titanTurn:
   * its running attacks, its wind-up and marks, the chase under the hard leash (never more than `leash` metres from its den, hit or
   * not), the clamped leap and the summon. It uses the fields make() adds (titanLift, attack, forced, leash), this.host.hurt,
   * this.host.pull, this.host.emit, this.walkable and this.move.
   */
  titanStep(e, dt, target, distance) { titanTurn(this, e, dt, target, distance, AI); }
  /** One fixed step. player: {x, z, active} (or null). */
  step(dt, player) {
    if (!(dt > 0)) return;
    this.time += dt; this.tick++;
    const target = player && player.active !== false && !inSafeZone(player.x, player.z) ? player : null, awake = this.awake; awake.length = 0;
    let removed = false;
    for (let n = 0; n < this.list.length; n++) {
      const e = this.list[n]; e.sx = e.x; e.sz = e.z; e.thought = 0;
      if (e.flash > 0) e.flash = Math.max(0, e.flash - dt); if (e.born > 0) e.born = Math.max(0, e.born - dt); if (e.dying > 0) e.dying = Math.max(0, e.dying - dt);
      if (e.leaving > 0) { if ((e.leaving -= dt) <= 0) { e.gone = true; removed = true; this.host.emit?.('retire', e); } continue; }
      if (e.hp <= 0) {
        // Back after the timer, once the player has moved away from its home (the reference's 22 m rule).
        if ((e.respawn -= dt) <= 0 && (!player || len(player.x - e.homeX, player.z - e.homeZ) > AI.respawnClear)) {
          Object.assign(e, { hp: e.maxHp, x: e.homeX, z: e.homeZ, sx: e.homeX, sz: e.homeZ, px: e.homeX, pz: e.homeZ, moveSpan: 0, phase: 'idle', stun: 0, cooldown: 0, attacks: 0, born: AI.born, lastHit: -99 }); this.dead.delete(e.id); this.host.emit?.('respawn', e);
        }
        continue;
      }
      this.think(e, dt, target, player ? len(player.x - e.x, player.z - e.z) : Infinity);
      // Launch height and knock-back slide run for every living creature, also while it is stunned.
      if (e.lift > 0 || e.liftV > 0) { e.liftV = Math.max(-15, e.liftV - AI.gravity * dt); e.lift = Math.max(0, e.lift + e.liftV * dt); if (!e.lift) e.liftV = 0; }
      if (Math.abs(e.kx) > .05 || Math.abs(e.kz) > .05) { this.move(e, e.kx * dt, e.kz * dt); const k = Math.max(0, 1 - dt * 8); e.kx *= k; e.kz *= k; }
      if (!e.resting) awake.push(e);
    }
    if (removed) this.list = this.list.filter(e => !e.gone);
    // Nothing piles up: awake creatures push each other apart, and out of the player's circle (a charge runs through).
    for (let i = 0; i < awake.length; i++) for (let j = i + 1; j < awake.length; j++) {
      const a = awake[i], b = awake[j], dx = a.x - b.x, dz = a.z - b.z, min = a.radius + b.radius; if (dx >= min || dx <= -min || dz >= min || dz <= -min) continue;
      const d = len(dx, dz); if (d >= min) continue;
      const moveA = a.def.speed > 0, moveB = b.def.speed > 0; if (!moveA && !moveB) continue;
      const nx = d > 1e-4 ? dx / d : Math.cos(i * 2.399), nz = d > 1e-4 ? dz / d : Math.sin(i * 2.399), push = (min - d + .002) / (moveA && moveB ? 2 : 1);
      if (moveA) this.move(a, nx * push, nz * push); if (moveB) this.move(b, -nx * push, -nz * push);
    }
    if (target) for (let n = 0; n < awake.length; n++) {
      const e = awake[n];
      if (!(e.def.speed > 0) || e.phase === 'charge') continue;
      const dx = e.x - target.x, dz = e.z - target.z, d = len(dx, dz), min = AI.playerRadius + e.radius; if (d >= min) continue;
      const nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0; this.move(e, nx * (min - d + .002), nz * (min - d + .002));
    }
    // Drawing runs more often than this step (and a calm creature far away moves only on every 4th): each move is kept with
    // the place it started from and the time it covers, so wilds-view.mjs can draw the creature gliding between the two
    // instead of jumping. A jump of more than GLIDE_MAX metres (a respawn, a hard knock) is not a walk and is not glided.
    for (let n = 0; n < this.list.length; n++) {
      const e = this.list[n]; if (e.x === e.sx && e.z === e.sz) continue;
      const far = len(e.x - e.sx, e.z - e.sz) > GLIDE_MAX; e.px = far ? e.x : e.sx; e.pz = far ? e.z : e.sz; e.moveAt = this.time; e.moveSpan = far ? 0 : e.thought > dt ? e.thought : dt;
    }
    for (let n = 0; n < this.shots.length; n++) {
      const shot = this.shots[n]; if (!shot.live) continue;
      shot.x += shot.vx * dt; shot.z += shot.vz * dt; shot.life -= dt;
      if (target && len(shot.x - target.x, shot.z - target.z) < AI.shotHit) { this.host.hurt?.(shot.damage, 'shot', shot.owner); shot.live = false; }
      else if (shot.life <= 0 || inSafeZone(shot.x, shot.z) || this.host.blocked?.(shot.x, shot.z)) shot.live = false;
    }
  }
}
