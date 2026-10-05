import { hyp } from './hyp.mjs';
// Adapted from the user's cute_game/src/fishing.ts (cast, nibble, bite and tension rules).
const CAST = {
  /** The explorer stands this far outside the rim, on the side they came from. */
  shoreGap: 0.6,
  /** The bobber lands at least this far inside the rim. */
  edgeGap: 0.6,
  /** Longest and shortest cast, measured from the shore point. */
  max: 7,
  min: 1.8,
  /** An early press pulls the bobber this far toward the explorer… */
  early: 0.7,
  /** …and reels the line in once it is within this distance of the rim. */
  reelInGap: 0.3,
  /** Seconds of the cast arc, and its height. */
  flight: 0.5,
  arc: 1.6
};
const FISH_PER_WATER = { home: 4, lake: 9, swamp: 4, candy: 6, ice: 6, lava: 0, toy: 5, jungle: 5, ocean: 7, dark: 5, shadow: 5 };
const RESTOCK_AFTER_CATCH = 12, RESTOCK_AFTER_LOSS = 15;
function planCast(water, player, tap) {
  let dx = player.x - water.x, dz = player.z - water.z;
  const d = hyp(dx, dz);
  if (d < 0.1) {
    dx = 0;
    dz = 1;
  } else {
    dx /= d;
    dz /= d;
  }
  const shore = { x: water.x + dx * (water.r + CAST.shoreGap), z: water.z + dz * (water.r + CAST.shoreGap) };
  let cast = { x: tap.x, z: tap.z };
  const fromCentre = hyp(cast.x - water.x, cast.z - water.z), inner = water.r - CAST.edgeGap;
  if (fromCentre > inner) cast = { x: water.x + (cast.x - water.x) / fromCentre * inner, z: water.z + (cast.z - water.z) / fromCentre * inner };
  const reach = hyp(cast.x - shore.x, cast.z - shore.z);
  if (reach > CAST.max) cast = { x: shore.x + (cast.x - shore.x) * CAST.max / reach, z: shore.z + (cast.z - shore.z) * CAST.max / reach };
  if (reach < CAST.min) {
    const k = CAST.min / (water.r + CAST.shoreGap);
    cast = { x: shore.x + (water.x - shore.x) * k, z: shore.z + (water.z - shore.z) * k };
  }
  return { shore, cast };
}
function earlyPull(water, cast, player) {
  const dx = player.x - cast.x, dz = player.z - cast.z, d = hyp(dx, dz) || 1;
  const moved = { x: cast.x + dx / d * CAST.early, z: cast.z + dz / d * CAST.early };
  const b = water.bounds, reeledIn = b ? Math.abs(moved.x - b.x) > b.w / 2 - CAST.reelInGap || Math.abs(moved.z - b.z) > b.d / 2 - CAST.reelInGap : hyp(moved.x - water.x, moved.z - water.z) > water.r - CAST.reelInGap;
  return { cast: moved, reeledIn };
}
const catchBonus = (bait, quality, luck = 0) => (bait ? 0.8 : 0) + quality - 0.3 + luck;
const catchWeight = (weight, rarity, bonus) => weight * (rarity === "legendary" ? 1 + bonus * 1.5 : rarity === "rare" ? 1 + bonus : 1);
// Line strain (cute_game fishing.ts): when the tension fills while Reel is held, the line strains and snaps with the rod's
// chance. A line that holds gives a little: tension falls back to STRAIN.relief and the fish takes STRAIN.slip of the line.
// From STRAIN.warn the game warns "Line strained! Let go!", so every roll is announced and avoidable.
const LINE_BREAK = { bamboo: 0.6, golden: 0.3, steady: 0.1 };
const STRAIN = { warn: 0.8, relief: 0.7, slip: 0.08 };
const lineBreakChance = (rod) => rod?.steady ? LINE_BREAK.steady : (rod?.quality ?? 0) >= 0.7 ? LINE_BREAK.golden : LINE_BREAK.bamboo;
const STEADY = { bite: 0.4, heavy: 0.6, reel: 1.2, surge: 0.5, tension: 0.6 };
class FishingSimulation {
  phase = "cast";
  tension = 0;
  progress = 0;
  time = 0;
  surge = 0;
  /** The fish now coming or on the line. */
  pick = null;
  /** Distance of the approaching fish from the bobber, and the nibble dart (0.3 s → 0) the view draws. */
  fishDistance = 0;
  dart = 0;
  /** Event counters the game and the view react to. */
  nibbles = 0;
  missedBites = 0;
  earlyPresses = 0;
  fled = 0;
  baitUsed = 0;
  approaches = 0;
  /** Line strains rolled this cast and how many the line survived. */
  strains = 0;
  strainsHeld = 0;
  breakChance;
  /** Where the bobber floats (an early press moves it). */
  cast;
  reason = "";
  holding = false;
  t = 0;
  waitT = 0;
  nibblesLeft = 0;
  nibT = 0;
  touched = false;
  biteT = 0;
  slack = 0;
  surgeCd = 0;
  power = 0.2;
  lastHeld = false;
  quality;
  steady;
  bait;
  random;
  options;
  constructor(options) {
    this.options = options;
    this.quality = Math.max(0, options.quality);
    this.steady = options.steady === true;
    this.bait = options.bait;
    this.random = options.random ?? Math.random;
    this.cast = options.cast ? { ...options.cast } : null;
    this.waitT = this.nextWait();
    this.breakChance = Math.max(0, Math.min(1, options.breakChance ?? lineBreakChance({ quality: options.quality, steady: options.steady })));
  }
  between(min, max) {
    return min + this.random() * (max - min);
  }
  get fighting() {
    return this.phase === "hooked";
  }
  get finished() {
    return this.phase === "caught" || this.phase === "escaped";
  }
  get snapped() {
    return this.phase === "escaped" && this.reason.includes("snapped");
  }
  /** The tension is near full while hooked: the next strain may snap the line. */
  get strained() {
    return this.phase === "hooked" && this.tension >= STRAIN.warn;
  }
  /** Whether a worm is still on the hook after one was used. */
  setBait(available) {
    this.bait = available;
  }
  get usingBait() {
    return this.bait;
  }
  /** Wait for the next fish (nextWait @863574): 2–5.5 s, ÷ 1.7 with a worm, ÷ (1 + quality / 2). */
  nextWait() {
    return this.between(2, 5.5) / (this.bait ? 1.7 : 1) / (1 + this.quality * 0.5);
  }
  get biteWindow() {
    return 1.4 + this.quality * 0.6 + (this.steady ? STEADY.bite : 0);
  }
  useBait() {
    if (this.bait) this.baitUsed++;
  }
  toWait(extra = 0) {
    this.phase = "wait";
    this.t = 0;
    this.waitT = this.nextWait() + extra;
    this.pick = null;
    this.fishDistance = 0;
    this.dart = 0;
  }
  press() {
    this.holding = true;
    if (this.phase === "bite") {
      this.phase = "hooked";
      this.t = 0;
      this.tension = 0.25;
      this.progress = 0.05;
      this.surge = 0;
      this.surgeCd = this.between(0.5, 1.5);
      this.slack = 0;
      this.power = this.pick?.power ?? 0.2;
      return true;
    }
    if (this.phase === "wait" || this.phase === "approach" || this.phase === "nibble") {
      this.earlyPresses++;
      if (this.phase !== "wait") this.fled++;
      this.toWait(1.5);
      this.reason = "Too early: the bobber jerked and the fish swam off.";
      const { water, player } = this.options;
      if (water && player && this.cast) {
        const pulled = earlyPull(water, this.cast, player);
        this.cast = pulled.cast;
        if (pulled.reeledIn) {
          this.phase = "escaped";
          this.reason = "You reeled the line back in.";
        }
      }
    }
    return false;
  }
  release() {
    this.holding = false;
  }
  update(dt, held, active = true) {
    if (!active || this.finished) return;
    if (held && !this.lastHeld) this.press();
    else if (!held && this.lastHeld) this.release();
    this.lastHeld = held;
    if (this.finished) return;
    this.time += dt;
    this.t += dt;
    switch (this.phase) {
      case "cast":
        if (this.t >= CAST.flight) {
          this.phase = "wait";
          this.t = 0;
        }
        return;
      case "wait":
        this.waitT -= dt;
        if (this.waitT <= 0) this.attract();
        return;
      case "approach":
        if (this.fishDistance > 0.55) this.fishDistance = Math.max(0.55, this.fishDistance - dt * (this.fishDistance > 2 ? 1.1 : 0.45));
        else if (this.t > 0.8) {
          this.phase = "nibble";
          this.t = 0;
          this.nibT = this.between(0.4, 1.2);
          this.dart = 0;
        }
        return;
      case "nibble":
        this.nibT -= dt;
        if (this.nibT <= 0 && this.dart <= 0) {
          this.dart = 0.3;
          this.touched = false;
        }
        if (this.dart > 0) {
          this.dart -= dt;
          if (this.dart < 0.15 && !this.touched) {
            this.touched = true;
            this.nibbles++;
          }
          if (this.dart <= 0) {
            this.dart = 0;
            if (--this.nibblesLeft > 0) this.nibT = this.between(0.5, 1.6);
            else if (this.random() < 0.95) {
              this.phase = "bite";
              this.t = 0;
              this.biteT = this.biteWindow;
            } else {
              this.fled++;
              this.toWait();
              this.reason = "The fish lost interest.";
            }
          }
        }
        return;
      case "bite":
        this.biteT -= dt;
        if (this.biteT <= 0) {
          this.missedBites++;
          this.useBait();
          this.fled++;
          this.toWait();
          this.reason = "The bite was missed. Wait for the next fish.";
        }
        return;
      case "hooked":
        this.reel(dt);
        return;
    }
  }
  /** attract(): pick the fish by the bait/rod/luck bonus and send it toward the bobber for 1–4 nibbles. */
  attract() {
    const pick = this.options.choose(catchBonus(this.bait, this.quality, this.options.luck ?? 0));
    if (!pick) {
      this.waitT = 0.1;
      return;
    }
    this.pick = pick;
    this.approaches++;
    this.phase = "approach";
    this.t = 0;
    this.fishDistance = Math.max(0.55, this.options.approachFrom?.(pick) ?? 2.5);
    this.nibblesLeft = 1 + Math.floor(this.random() * 4);
    this.dart = 0;
  }
  /** Reference updateReel: hold to gain line; tension snaps it, seven seconds of slack loses it. */
  reel(dt) {
    const q = this.quality, p = this.steady ? this.power * STEADY.heavy : this.power;
    this.surgeCd -= dt;
    if (this.surge > 0) this.surge -= dt;
    else if (this.surgeCd <= 0) {
      this.surge = this.between(0.4, 0.8 + p);
      this.surgeCd = this.between(0.8, 2.2) * (1.2 - p * 0.5);
    }
    const surging = this.surge > 0;
    if (this.holding) {
      this.progress += dt * 0.3 * (1.15 - p * 0.45) * (surging ? this.steady ? STEADY.surge : 0.4 : 1) * (this.steady ? STEADY.reel : 1);
      this.tension += dt * (1.2 - q * 0.45) * (0.08 + (surging ? 0.6 * p + 0.12 : 0.02)) * (this.steady ? STEADY.tension : 1);
      this.slack = 0;
    } else {
      this.tension -= dt * 0.9;
      this.progress -= dt * 0.05 * p * (surging ? 2.5 : 1);
      this.slack += dt;
    }
    this.tension = Math.max(0, this.tension);
    this.progress = Math.max(0, this.progress);
    if (this.tension >= 1) {
      this.strains++;
      if (this.random() < this.breakChance) {
        this.snap();
        return;
      }
      this.strainsHeld++;
      this.tension = STRAIN.relief;
      this.progress = Math.max(0, this.progress - STRAIN.slip);
    }
    if (this.slack > 7) {
      this.useBait();
      this.phase = "escaped";
      this.reason = "The line went slack and the fish slipped away.";
      return;
    }
    if (this.progress >= 1) {
      this.progress = 1;
      this.useBait();
      this.phase = "caught";
      this.reason = "A lovely catch!";
    }
  }
  snap() {
    this.tension = Math.max(this.tension, 1);
    this.useBait();
    this.phase = "escaped";
    this.reason = "The line snapped. Let go of Reel when the fish surges.";
  }
}
export {
  CAST,
  FISH_PER_WATER,
  FishingSimulation,
  LINE_BREAK,
  STRAIN,
  lineBreakChance,
  RESTOCK_AFTER_CATCH,
  RESTOCK_AFTER_LOSS,
  STEADY,
  catchBonus,
  catchWeight,
  earlyPull,
  planCast
};
