// Fighting in the wilds while the Pandora box is open, after the Zoo Garden combat (cute_game src/combat.ts
// CombatSimulation, main.ts world.onDamage, drops.ts): a basic attack by weapon kind, the three base skills, shots,
// crits, knock-back and launch, the damage-taken formula, and loot tossed on the ground. Pure (no Three.js, no DOM): the
// view (pandora-view.mjs) is the host. Nothing here allocates while a fight runs; hosts hand back live objects and
// effects are plain calls.
//
//   const combat = new Combat(host, random)
//   host.position() -> {x, z}            host.facing() / host.face(angle)      host.targets() -> creatures (wilds.mjs)
//   host.weapon()   -> gear.mjs weaponOf  host.stats() -> {attack, crit, critDamage?, haste?}
//   host.move(dx, dz)                     host.hit(target, amount, critical, stun, lift, knock, dirX, dirZ)
//   host.effect(kind, x, z, radius, facing, arc)   kinds: 'arc' 'ring' 'cast' 'trail' 'impact'
//   host.shotBlocked?(x, z)              host.pet?() -> {x, z, dmg, cd, shot} | null (a worn pet shoots what comes near)
//   combat.basic(target?) -> 'fist' | 'sword' | 'gun' | ''      combat.skill(index) -> boolean      combat.update(dt)

/** The four skills: three base ones and the weapon's special (skills-special.mjs, fetched with the box). W walks and E interacts in Willowmere, so they sit on 1 / 2 / 3 / 4. */
export const SKILLS = [
  { id: 'whirl', name: 'Whirlwind', short: 'Whirl', icon: '🌀', key: 'J', cd: 7 },
  { id: 'dash', name: 'Dash', icon: '➶', key: 'K', cd: 4 },
  { id: 'slam', name: 'Ground slam', short: 'Slam', icon: '💥', key: 'L', cd: 9 },
  { id: 'special', name: 'Special', icon: '⭐', key: ';', cd: 8 },
];
/** The reference's numbers (combat.ts basic(), skill(), dash()). */
export const TUNING = {
  fist: { radius: 1.6, power: 1, third: 1.5, cone: .5, knock: .8, thirdKnock: 2.2 },
  sword: { power: 1.1, cone: .2, knock: 1.2 },
  gun: { speed: 19, radius: .22, knock: 1 },
  whirl: { ticks: 10, every: .22, radius: 2.8, swordRadius: 3.4, power: .55, knock: 1.2 },
  dash: { speed: 30, time: .24, power: 1.7, width: 1.2, stun: .3, knock: 3 },
  slam: { time: .8, land: .42, radius: 4.4, power: 2.3, stun: .8, lift: 2.5, knock: 1.2, height: 2.6 },
  aim: 12, hitStun: .15,
};
/** Damage after defence: amount × 60 / (defence + 60), never less than 1 (the reference's world.onDamage). */
export const damageTaken = (amount, defense = 0) => Math.max(1, Math.round(amount * 60 / (Math.max(0, defense) + 60)));
/** A blow: attack × multiplier, doubled on a crit, spread 0.9–1.1 by `roll` (0–1). */
export const hitDamage = (attack, multiplier, critical, roll, critDamage = 2) => Math.max(1, Math.round(attack * multiplier * (critical ? critDamage : 1) * (.9 + roll * .2)));
const reachOf = weapon => weapon.range ?? (weapon.kind === 'gun' ? 8 : weapon.kind === 'sword' ? 2 : 1);
/** How far a basic attack reaches: melee reach counts from the creature's edge, a gun's range from its centre. */
export function attackRange(weapon, targetRadius = .8) { return Math.max(.5, reachOf(weapon)) + (weapon.kind === 'gun' ? 0 : targetRadius); }
/** Seconds between basic attacks. */
export const attackCooldown = (weapon, haste = 0) => (weapon.cooldown ?? (weapon.kind === 'fist' ? .5 : .4)) / Math.max(.2, 1 + haste);
export function distanceToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, length = dx * dx + dz * dz, t = length ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / length)) : 0;
  return len(px - ax - dx * t, pz - az - dz * t);
}
const alive = t => t.hp > 0 && !(t.leaving > 0);
// Hot loops use plain indexed loops and this instead of for-of and Math.hypot: neither makes garbage in any JIT tier.
const len = (x, z) => Math.sqrt(x * x + z * z);

export class Combat {
  constructor(host, random = Math.random) {
    this.host = host; this.random = random; this.time = 0; this.combo = 0;
    this.attackCooldown = 0; this.cooldowns = [0, 0, 0, 0]; this.spans = [0, 0, 0, 0]; this.dashing = null; this.sid = '';
    this.mode = ''; this.modeStart = 0; this.modeUntil = 0; this.dirX = 0; this.dirZ = 1; this.landed = false; this.struck = new Set();
    this.whirlLeft = 0; this.whirlNext = 0; this.whirlRadius = 0;
    this.shots = Array.from({ length: 32 }, () => ({ live: false, x: 0, z: 0, dx: 0, dz: 1, left: 0, power: 1, kind: 'pea', stun: 0, blast: 0, speed: 0, radius: 0, lift: 0, pierce: false, hit: new Set() })); this.petCooldown = 0;
  }
  /** A dash or a slam owns the player's feet. */
  get locksMovement() { return this.mode !== ''; }
  /** Nothing hurts mid-dash (the reference's invulnerable). */
  get invulnerable() { return this.mode === 'dash'; }
  get spinning() { return this.whirlLeft > 0; }
  /** Height of the ground-slam leap: up fast, snapping down as the shockwave lands at 0.42 s. */
  get airborne() { if (this.mode !== 'slam') return 0; const t = (this.time - this.modeStart) / TUNING.slam.land; return t < 1 ? Math.sin(t * Math.PI * .85) * TUNING.slam.height : 0; }
  reset() { this.mode = ''; this.dashing = null; if (this.jobs) for (const j of this.jobs) j.live = false; this.whirlLeft = 0; this.attackCooldown = 0; this.petCooldown = 0; this.cooldowns.fill(0); this.combo = 0; this.struck.clear(); for (const shot of this.shots) shot.live = false; }

  nearest(range = TUNING.aim) {
    const p = this.host.position(); let best = null, bestD = Infinity;
    const list = this.host.targets();
    for (let i = 0; i < list.length; i++) { const t = list[i]; if (!alive(t)) continue; const d = len(t.x - p.x, t.z - p.z); if (d <= range + t.radius && d < bestD) { best = t; bestD = d; } }
    return best;
  }
  /** Turns to the target, or to the nearest creature within 12 m; keeps the facing when there is none. */
  aim(target) { const p = this.host.position(), t = target ?? this.nearest(); if (t) this.host.face(Math.atan2(t.x - p.x, t.z - p.z)); return this.host.facing(); }

  damage(target, power, stun = 0, lift = 0, knock = 0) {
    if (!alive(target)) return;
    const stats = this.host.stats(), p = this.host.position(), critical = this.random() < (stats.crit ?? 0), angle = Math.atan2(target.x - p.x, target.z - p.z);
    this.host.hit(target, hitDamage(stats.attack, power, critical, this.random(), stats.critDamage ?? 2), critical, stun, lift, knock, Math.sin(angle), Math.cos(angle));
  }
  area(x, z, radius, power, stun = 0, lift = 0, knock = 1.2) {
    this.host.effect('ring', x, z, radius, 0, 0);
    for (const t of this.host.targets()) if (alive(t) && len(t.x - x, t.z - z) <= radius + t.radius) this.damage(t, power, stun, lift, knock);
  }
  /** A swing: every creature inside the cone in front (the aimed one always counts). `cone` is the cosine of its half angle. */
  arc(radius, power, cone, target, knock) {
    const p = this.host.position(), facing = this.host.facing(), fx = Math.sin(facing), fz = Math.cos(facing);
    this.host.effect('arc', p.x, p.z, radius, facing, 2 * Math.acos(Math.max(-1, Math.min(1, cone))));
    for (const t of this.host.targets()) {
      if (!alive(t)) continue;
      const x = t.x - p.x, z = t.z - p.z, length = len(x, z);
      if (length <= radius + t.radius && (t === target || length === 0 || (x * fx + z * fz) / length >= cone)) this.damage(t, power, TUNING.hitStun, 0, knock);
    }
  }
  /** A shot. Its kind follows the weapon (gear.mjs `shot`): ice stuns for 1.5 s, a fireball bursts over 2 m; the rest only differ in colour. */
  shoot(angle, power, range, kind = 'pea') {
    const shot = this.shots.find(s => !s.live) ?? this.shots[0], p = this.host.position();
    shot.live = true; shot.dx = Math.sin(angle); shot.dz = Math.cos(angle); shot.x = p.x + shot.dx * .6; shot.z = p.z + shot.dz * .6; shot.left = range; shot.power = power;
    shot.kind = kind; shot.stun = kind === 'ice' ? 1.5 : 0; shot.blast = kind === 'fireball' ? 2 : 0; shot.speed = shot.radius = shot.lift = 0; shot.pierce = false; shot.hit.clear();
    return shot;
  }

  /** The basic attack. With a creature in reach it turns to it; with none it swings at the air, so a press always answers. */
  basic(target) {
    if (this.mode || this.attackCooldown > 0) return '';
    const weapon = this.host.weapon(), stats = this.host.stats(), p = this.host.position();
    if (target && (!alive(target) || len(target.x - p.x, target.z - p.z) > attackRange(weapon, target.radius))) target = null;
    target ??= this.nearest(attackRange(weapon, 0));
    if (target) this.aim(target);
    if (weapon.kind === 'gun') { const count = Math.min(5, Math.max(1, weapon.spread ?? 1)); for (let i = 0; i < count; i++) this.shoot(this.host.facing() + (count === 1 ? 0 : (i / (count - 1) - .5) * .6), count > 1 ? .45 : 1, reachOf(weapon) + 1, weapon.shot ?? 'pea'); } // a spread gun fans weaker shots
    else if (weapon.kind === 'sword') this.arc(reachOf(weapon), TUNING.sword.power, weapon.arc ?? TUNING.sword.cone, target, TUNING.sword.knock);
    else { this.combo = (this.combo + 1) % 3; const third = this.combo === 0; this.arc(TUNING.fist.radius, third ? TUNING.fist.third : TUNING.fist.power, TUNING.fist.cone, target, third ? TUNING.fist.thirdKnock : TUNING.fist.knock); }
    this.attackCooldown = attackCooldown(weapon, stats.haste ?? 0);
    return weapon.kind === 'gun' || weapon.kind === 'sword' ? weapon.kind : 'fist';
  }
  /** Whirlwind (0), Dash (1), Ground slam (2). */
  skill(index) {
    if (this.mode || !SKILLS[index] || this.cooldowns[index] > 0) return false;
    const facing = this.aim(), p = this.host.position();
    if (index === 3) return !!this.special?.(this.host.special?.() ?? this.host.weapon().special);
    if (index === 0) {
      this.whirlRadius = this.host.weapon().kind === 'sword' ? TUNING.whirl.swordRadius : TUNING.whirl.radius; this.whirlLeft = TUNING.whirl.ticks; this.whirlNext = 0;
      this.host.effect('cast', p.x, p.z, this.whirlRadius, 0, .5);
    } else if (index === 1) {
      this.mode = 'dash'; this.modeStart = this.time; this.modeUntil = this.time + TUNING.dash.time; this.dirX = Math.sin(facing); this.dirZ = Math.cos(facing); this.struck.clear();
    } else {
      this.mode = 'slam'; this.modeStart = this.time; this.modeUntil = this.time + TUNING.slam.time; this.landed = false;
      this.host.effect('cast', p.x, p.z, TUNING.slam.radius, 0, .45);
    }
    this.spans[index] = this.cooldowns[index] = SKILLS[index].cd * (this.host.cooldownScale?.() ?? 1);
    return true;
  }

  update(dt) {
    if (!(dt > 0)) return;
    this.time += dt; this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    for (let i = 0; i < 4; i++) this.cooldowns[i] = Math.max(0, this.cooldowns[i] - dt);
    if (this.whirlLeft > 0 && (this.whirlNext -= dt) <= 0) { const p = this.host.position(); this.whirlNext += TUNING.whirl.every; this.whirlLeft--; this.area(p.x, p.z, this.whirlRadius, TUNING.whirl.power, 0, 0, TUNING.whirl.knock); }
    if (this.mode === 'dash') {
      const p = this.host.position(), fromX = p.x, fromZ = p.z, span = Math.max(0, Math.min(dt, this.modeUntil - (this.time - dt))), D = this.dashing ?? TUNING.dash;
      this.host.move(this.dirX * D.speed * span, this.dirZ * D.speed * span); this.host.effect('trail', p.x, p.z, .7, 0, 0);
      for (const t of this.host.targets()) if (alive(t) && !this.struck.has(t) && distanceToSegment(t.x, t.z, fromX, fromZ, p.x, p.z) < D.width + t.radius) { this.struck.add(t); this.damage(t, D.power, D.stun, 0, D.knock); }
    } else if (this.mode === 'slam' && !this.landed && this.time - this.modeStart >= TUNING.slam.land) {
      const p = this.host.position(), S = TUNING.slam; this.landed = true; this.host.effect('slam', p.x, p.z, S.radius, 0, 0); this.area(p.x, p.z, S.radius, S.power, S.stun, S.lift, S.knock);
    }
    if (this.mode && this.time >= this.modeUntil) { this.mode = ''; this.struck.clear(); this.dashing = null; }
    this.tick?.(dt);
    // A worn pet shoots the nearest creature within 7 m of you, at its own pace (the reference's pet shots; a pet's ice only chills).
    this.petCooldown = Math.max(0, this.petCooldown - dt);
    const pet = this.petCooldown <= 0 ? this.host.pet?.() : null;
    if (pet && pet.dmg > 0 && pet.cd > 0) {
      const p = this.host.position(); let prey = null, near = Infinity;
      const list = this.host.targets();
      for (let i = 0; i < list.length; i++) { const t = list[i]; if (!alive(t)) continue; const d = len(t.x - p.x, t.z - p.z); if (d < 7 + t.radius && d < near) { near = d; prey = t; } }
      if (prey) { const shot = this.shoot(Math.atan2(prey.x - pet.x, prey.z - pet.z), pet.dmg, 9, pet.shot || 'fire'); shot.x = pet.x; shot.z = pet.z; if (shot.kind === 'ice') shot.stun = .5; this.petCooldown = Math.max(.1, pet.cd); this.host.effect('impact', pet.x, pet.z, .3, 0, 0); }
    }
    for (let n = 0; n < this.shots.length; n++) {
      const shot = this.shots[n]; if (!shot.live) continue;
      const step = Math.min((shot.speed || TUNING.gun.speed) * dt, shot.left), fromX = shot.x, fromZ = shot.z; shot.x += shot.dx * step; shot.z += shot.dz * step; shot.left -= step;
      let struck = null, near = Infinity;
      const list = this.host.targets();
      for (let i = 0; i < list.length; i++) { const t = list[i]; if (!alive(t) || shot.hit.has(t) || distanceToSegment(t.x, t.z, fromX, fromZ, shot.x, shot.z) > t.radius + (shot.radius || TUNING.gun.radius)) continue; const d = len(t.x - fromX, t.z - fromZ); if (d < near) { near = d; struck = t; } }
      if (struck) { this.damage(struck, shot.power, shot.stun, shot.lift, TUNING.gun.knock); this.host.effect('impact', struck.x, struck.z, .5, 0, 0); if (shot.blast) this.area(struck.x, struck.z, shot.blast, shot.power * .6, shot.stun, 0, 1.2); if (shot.pierce) shot.hit.add(struck); else shot.live = false; }
      else if (shot.left <= 0 || this.host.shotBlocked?.(shot.x, shot.z)) { this.host.effect('impact', shot.x, shot.z, .35, 0, 0); shot.live = false; }
    }
  }
}

// ---------------------------------------------------------------- loot on the ground (cute_game drops.ts)
/** Toss arc, magnet and lifetime, as measured in the reference. */
export const DROP = { gravity: 18, bounce: .35, friction: .6, settle: .8, lift: .6, launch: 5, tossMin: .6, tossMax: 1.5, tossSpeed: 2.4, rest: .25, bob: .08, bobRate: 3,
  magnetRadius: 3.2, magnetDelay: .6, collect: .6, pullMin: 6, pullMax: 12, life: 30, blink: 5, max: 24 };
/** Visible this frame? A drop blinks through its last 5 s, faster in the last 2. */
export const dropVisible = (left, time) => left >= DROP.blink || Math.sin(time * (left < 2 ? 30 : 16)) > 0;

/**
 * Loot tossed where a creature fell: it bounces to rest, bobs, is pulled to the player by a short magnet and is gone
 * after 30 s. A fixed pool of plain objects; step() calls onPick(drop) for every drop that reaches the player.
 */
export class Drops {
  constructor(random = Math.random) { this.random = random; this.time = 0; this.pool = Array.from({ length: DROP.max }, () => ({ live: false, item: '', count: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, phase: 0, resting: false })); }
  get count() { let n = 0; for (const d of this.pool) if (d.live) n++; return n; }
  spawn(item, count, x, z) {
    let d = this.pool.find(d => !d.live);
    if (!d) for (const o of this.pool) if (!d || o.age > d.age) d = o; // full: the oldest makes room
    const angle = this.random() * Math.PI * 2, reach = DROP.tossMin + this.random() * (DROP.tossMax - DROP.tossMin);
    Object.assign(d, { live: true, item, count, x, y: DROP.lift, z, vx: Math.cos(angle) * reach * DROP.tossSpeed, vy: DROP.launch, vz: Math.sin(angle) * reach * DROP.tossSpeed, age: 0, phase: this.random() * Math.PI * 2, resting: false });
    return d;
  }
  /** hero: {x, z} or null (no magnet: indoors, driving, knocked out). */
  step(dt, hero, onPick) {
    if (!(dt > 0)) return;
    this.time += dt;
    for (let i = 0; i < this.pool.length; i++) {
      const d = this.pool[i]; if (!d.live) continue;
      d.age += dt;
      if (!d.resting) {
        d.vy -= DROP.gravity * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
        if (d.y < DROP.rest) { d.y = DROP.rest; d.vy *= -DROP.bounce; d.vx *= DROP.friction; d.vz *= DROP.friction; if (Math.abs(d.vy) < DROP.settle) { d.vx = d.vy = d.vz = 0; d.resting = true; } }
      } else d.y = DROP.rest + Math.sin(this.time * DROP.bobRate + d.phase) * DROP.bob;
      if (hero && d.age > DROP.magnetDelay) {
        const dist = len(hero.x - d.x, hero.z - d.z);
        if (dist < DROP.collect) { d.live = false; onPick?.(d); continue; }
        if (dist < DROP.magnetRadius) { const pull = Math.min(dist, Math.max(DROP.pullMin, DROP.pullMax - dist * 2) * dt); d.x += (hero.x - d.x) / dist * pull; d.z += (hero.z - d.z) / dist * pull; }
      }
      if (d.age >= DROP.life) d.live = false;
    }
  }
  clear() { for (const d of this.pool) d.live = false; }
}
