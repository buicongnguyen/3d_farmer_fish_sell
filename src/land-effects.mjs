// What the lands do to the player (round 8; owner: builder B). A pure simulation: no three.js, no DOM. land-view.mjs steps
// it once a frame and draws what it holds; tests/land-effects.test.mjs drives it directly.
//
// Ported from Zoo Garden (cute_game src/environments.ts EnvironmentSimulation and src/lava-weather.ts LavaWeather.step),
// with its numbers, on a flat world: everything that read terrainHeight (tide, rafts, stones, mesas, falling, bounce
// clouds, swimming, oxygen) is left out, the dragon's nest "turns to lava" instead of rising, and thorn walls hurt but do
// not block (spec 3.9). Creatures are never hurt by the land here (every defeat pays coins).
//
// The simulation never touches the world. It asks its host:
//   hurt(share, source)       a share of full health; source 'lava' | 'fire' | 'poison' | 'thorn' | 'train' | 'bolt'
//   heal(share)               a share of full health (a lit lamp's light)
//   push(dx, dz, opts)        move the player (a gust; a train passes {car: true, crawl})
//   toast(text)               the warnings and the weather's names
//   pickup(count)             an ore crystal walked over: 1 or 2 obsidian
//   random()                  optional, for tests (the weather's own seeded stream otherwise)
// Who is hurt: nobody with the box shut; with it open a rider exactly as a walker (but ice and gusts leave a car alone).
import { regionAt, homeBorderDistance, gridBorderDistance } from './regions.mjs';
import { FEATURES, waterAt, rng, thornPoints } from './land-features.mjs';
import { lavaEvent, LAVA_EVENT_INFO } from './lava-weather.mjs';

const len = (x, z) => Math.sqrt(x * x + z * z), TAU = Math.PI * 2;
const smooth = (v, a, b) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
/** The reference's numbers, in one place (environments.ts and lava-weather.ts line numbers in the spec's table 3.9). */
export const LAND = Object.freeze({
  lava: { share: .07, tick: .5 }, vent: { share: .14, tick: .5, warn: 5, erupt: 3, period: 140, eventPeriod: 50, near: 35 },
  rain: { share: .12, r: 1.4, tick: .3, fall: .8, min: 3, max: 14 }, meteor: { share: .3, r: 2.6, fall: 1.8, min: 5, max: 17, wait: [2.6, 2.4] },
  storm: { share: .1, r: 1.4, fall: 1, max: 8, wait: [1.6, 1.5] }, ore: { meteor: 90, treasure: 100, every: 18, near: 40, reach: 1.2, most: 40 },
  train: { share: .15, r: 1.5, push: 2.2, tick: 1, cars: 4, gap: 2.4 }, poison: { share: .035, tick: .6 }, thorn: { share: .05, tick: .6, reach: 1.4, up: 16, cycle: 36 },
  ice: { grip: 2.8, slide: 1.6, nodeReach: 1 }, sea: { limit: .6 }, bolt: { share: .12, r: 1.8, fall: 1.2, min: 2, max: 9, wait: [7, 6], first: 6 },
  gust: { cycle: 25, warn: 18, from: 20, to: 23.5, speed: 3.2, turn: 2.399 }, lamp: { heal: .03, seconds: 150, touch: 1.2 },
  night: { opacity: .93, riding: .93, hole: 3.6, lightHole: 7.5, eclipse: .4, fade: 24 }, nest: { warn: 2 },
});
/** A vent's phase at second `time` (environments.ts ventPhase): 5 s of warning, then 3 s of eruption, ending 1 s before the period does. */
export function ventPhase(time, phase = 0, period = LAND.vent.period) { const t = ((time + phase) % period + period) % period; return t >= period - 4 && t < period - 1 ? 'eruption' : t >= period - 9 && t < period - 4 ? 'warning' : 'idle'; }
/** How far through its warning (0 to 1) a vent is, for its ring; 1 while it erupts. */
export function ventWarning(time, phase = 0, period = LAND.vent.period) { const t = ((time + phase) % period + period) % period; return t >= period - 4 ? (t < period - 1 ? 1 : 0) : t >= period - 9 ? (t - (period - 9)) / 5 : 0; }
export const thornRaised = (time, phase = 0) => ((time + phase) % LAND.thorn.cycle + LAND.thorn.cycle) % LAND.thorn.cycle < LAND.thorn.up;
/** Where car `car` of a track's train is at second `time` (environments.ts trainPosition). */
export function trainPosition(track, time, car = 0, out = {}) { const angle = time * track.speed / track.r - car * LAND.train.gap / track.r; out.x = track.x + Math.cos(angle) * track.r; out.z = track.z + Math.sin(angle) * track.r; out.facing = -angle + Math.PI / 2; return out; }
/** A turtle's place in the sea (environment-art.ts:83): a slow circle of 5 m round its home. */
export function turtlePosition(turtle, time, out = {}) { const angle = time * .15 + turtle.id * 1.3; out.x = turtle.x + Math.cos(angle) * 5; out.z = turtle.z + Math.sin(angle) * 5; out.facing = -angle; return out; }
/** How much of the Night Land's dark a point is under: 0 outside it, rising over the first 24 m from the home region (the same fade as the land's light, spec 3.7). */
export const nightShare = (x, z) => regionAt(x, z) === 'shadow' ? smooth(homeBorderDistance(x, z), 0, LAND.night.fade) : 0;
export const GUST_TEXT = 'Wind is gathering.', VENT_TEXT = 'Volcano warning! Leave the red circle.', BOLT_TEXT = 'Lightning is gathering! Leave the yellow circle.';
const SCRATCH = { x: 0, z: 0, facing: 0 }, NO_HOST = { hurt() { return 0; }, heal() {}, push() { return false; }, toast() {}, pickup() {} };

export class LandEffects {
  constructor(host = {}) {
    this.host = { ...NO_HOST, ...host };
    this.time = 0;                        // seconds this simulation has run: trains, thorns, gusts, lightning, lamps
    this.now = 0;                         // wall-clock seconds of the last step: the weather and the vents (the same on every visit)
    this.velocity = { x: 0, z: 0 };       // the walking velocity (ice eases it)
    this.region = null; this.box = false; this.riding = false; this.x = 0; this.z = 0;
    this.timers = new Map(); this.warned = new Map();
    this.lamps = new Map(); this.eclipseUntil = 0;
    this.drops = [];                      // falling things with a mark: {kind: 'meteor' | 'fireball' | 'rain' | 'bolt', x, z, r, age, duration}
    this.ores = [];                       // crystals on the ground: {id, x, z, until}
    this.weather = { key: '', id: 'normal', left: 0, meteorWait: 2, stormWait: 3, treasureWait: 4, seed: 739391, sequence: 0 };
    this.bolt = { wait: LAND.bolt.first, sequence: 0 };
    this.nestStage = 0; this.nestWarn = 0; this.gusting = false; this.trainHit = -9;
  }
  /** The reference's tick: true at once, then once every `period` seconds while it keeps being asked. */
  tick(key, period, dt) { const left = (this.timers.get(key) ?? 0) - dt; if (left <= 1e-9) { this.timers.set(key, period); return true; } this.timers.set(key, left); return false; }
  /** Fires `text` once each time `key` turns to 'warning'. */
  warn(key, value, text, near = true) { if (this.warned.get(key) === value) return; this.warned.set(key, value); if (value === 'warning' && near) this.host.toast(text); }
  random() { if (this.host.random) return this.host.random(); const w = this.weather; w.seed = (Math.imul(w.seed, 1664525) + 1013904223) >>> 0; return w.seed / 4294967296; }
  get ventPeriod() { return this.box && lavaEvent(this.now).id === 'eruption' ? LAND.vent.eventPeriod : LAND.vent.period; }
  get eclipsed() { return this.time < this.eclipseUntil; }
  /** The nest's basin is lava from the dragon's second stage, after 2 s of glow. */
  get nestLava() { return this.nestStage >= 2 && this.nestWarn <= 0; }
  get nestGlow() { return this.nestStage >= 2 ? this.nestWarn > 0 ? 1 - this.nestWarn / LAND.nest.warn : 1 : 0; }
  setNest(stage) { stage = Number(stage) || 0; if (stage >= 2 && this.nestStage < 2) this.nestWarn = LAND.nest.warn; this.nestStage = stage; }
  eclipse(seconds) { if (seconds > 0) this.eclipseUntil = Math.max(this.eclipseUntil, this.time + seconds); }
  light(id) { if (!FEATURES.shadow.lamps[id]) return false; this.lamps.set(id, this.time + LAND.lamp.seconds); return true; }
  lampLit(id) { return !this.eclipsed && (this.lamps.get(id) ?? 0) > this.time; }
  lampLeft(id) { return Math.max(0, (this.lamps.get(id) ?? 0) - this.time); }
  lampAt(x, z) { const list = FEATURES.shadow.lamps; for (let i = 0; i < list.length; i++) if (this.lampLit(i) && len(list[i].x - x, list[i].z - z) < list[i].r) return true; return false; }
  inLava(x, z) {
    const f = FEATURES.lava; for (let i = 0; i < f.pools.length; i++) if (len(f.pools[i].x - x, f.pools[i].z - z) < f.pools[i].r) return true;
    if (!this.nestLava || len(f.nest.x - x, f.nest.z - z) >= f.nest.r) return false;
    for (let i = 0; i < f.nestIslands.length; i++) if (len(f.nestIslands[i].x - x, f.nestIslands[i].z - z) < f.nestIslands[i].r) return false;
    return true;
  }
  poisoned(x, z) { const list = FEATURES.jungle.poison; for (let i = 0; i < list.length; i++) if (len(list[i].x - x, list[i].z - z) < list[i].r) return true; return false; }
  thorned(x, z) { for (const wall of FEATURES.jungle.thorns) if (thornRaised(this.time, wall.phase) && len(wall.x - x, wall.z - z) < 5 && thornPoints(wall).some(p => len(p.x - x, p.z - z) < LAND.thorn.reach)) return true; return false; }

  /**
   * The walking velocity for this frame: {vx, vz, limit, nodeReach}. (vx, vz) is the velocity before the limit; the caller
   * moves by v × limit × dt through its own blocking. On ice, on foot, the velocity follows the stick at 2.8 a second and
   * coasts at 1.6 with none; in the sea the limit is 0.6. A rider gets the plain answer (a car does not slide).
   */
  walk(input, dt, x = this.x, z = this.z, out = {}) {
    const dx = input.dx || 0, dz = input.dz || 0, speed = input.speed || 0, region = regionAt(x, z), v = this.velocity;
    if (region === 'ice' && !input.riding) {
      const amount = 1 - Math.exp(-dt * (len(dx, dz) > 0 ? LAND.ice.grip : LAND.ice.slide));
      v.x += (dx * speed - v.x) * amount; v.z += (dz * speed - v.z) * amount; out.nodeReach = LAND.ice.nodeReach;
    } else { v.x = dx * speed; v.z = dz * speed; out.nodeReach = .22; }
    out.vx = v.x; out.vz = v.z; out.limit = waterAt(x, z) ? LAND.sea.limit : 1;
    return out;
  }
  carLimit(x, z) { return waterAt(x, z) ? LAND.sea.limit : 1; }

  /** Once a frame. `at` = {x, z, riding, box}; `now` = wall-clock seconds (Date.now() / 1000). */
  step(dt, at, now = this.now + dt) {
    if (!(dt > 0)) dt = 0;
    this.time += dt; this.now = now; this.x = at.x; this.z = at.z; this.box = !!at.box; this.riding = !!at.riding;
    const region = this.region = regionAt(at.x, at.z);
    if (region === 'lava') this.stepLava(dt, at); else if (this.drops.length && region !== 'cloud') this.drops.length = 0;
    if (region === 'toy') this.stepTrains(dt, at);
    if (region === 'jungle' && this.box) {
      if (this.poisoned(at.x, at.z) && this.tick('poison', LAND.poison.tick, dt)) this.host.hurt(LAND.poison.share, 'poison');
      if (this.thorned(at.x, at.z) && this.tick('thorn', LAND.thorn.tick, dt)) this.host.hurt(LAND.thorn.share, 'thorn');
    }
    if (region === 'cloud') this.stepCloud(dt, at); else this.gusting = false;
    if (region === 'shadow') {
      const lamps = FEATURES.shadow.lamps;
      // Walking up to a pillar lights it (a tap does too: land-view.mjs).
      if (!at.riding) for (let i = 0; i < lamps.length; i++) if (!this.lampLit(i) && !this.eclipsed && len(lamps[i].x - at.x, lamps[i].z - at.z) < LAND.lamp.touch) this.light(i);
      if (this.box && this.lampAt(at.x, at.z)) this.host.heal(LAND.lamp.heal * dt);
    }
  }
  stepTrains(dt, at) {
    const T = LAND.train;
    for (const track of FEATURES.toy.tracks) for (let car = 0; car < T.cars; car++) {
      const p = trainPosition(track, this.time, car, SCRATCH);
      if (len(p.x - at.x, p.z - at.z) >= T.r || this.time - this.trainHit < T.tick - 1e-9) continue;
      this.trainHit = this.time; // at most once a second, however many cars are over you (by the clock, not by the reference's per-call timer)
      // Outward from the loop's centre, 2.2 m. With the box shut it only moves you (and never slows a car).
      const d = Math.max(.01, len(at.x - track.x, at.z - track.z));
      this.host.push((at.x - track.x) / d * T.push, (at.z - track.z) / d * T.push, { car: true, crawl: this.box });
      if (this.box) this.host.hurt(T.share, 'train');
    }
  }
  stepLava(dt, at) {
    const f = FEATURES.lava, V = LAND.vent, R = LAND.rain, O = LAND.ore;
    if (this.nestWarn > 0) this.nestWarn = Math.max(0, this.nestWarn - dt);
    // Ore lies there with the box open or shut; walking over it picks it up.
    for (let i = this.ores.length - 1; i >= 0; i--) {
      const ore = this.ores[i];
      if (ore.until <= this.time) this.ores.splice(i, 1);
      else if (this.box && len(ore.x - at.x, ore.z - at.z) < O.reach) { this.ores.splice(i, 1); this.host.pickup(1 + (this.random() < .5 ? 1 : 0)); }
    }
    if (!this.box) { this.drops.length = 0; this.weather.key = ''; return; } // the weather clock does not run with the box shut
    if (this.inLava(at.x, at.z) && this.tick('lava', LAND.lava.tick, dt)) this.host.hurt(LAND.lava.share, 'lava');
    // The weather: one event for 240 s of every 360, named as it starts (and as you arrive).
    const event = lavaEvent(this.now), w = this.weather, key = `${event.index}:${event.id}`;
    if (key !== w.key) { w.key = key; w.meteorWait = 2; w.stormWait = 3; w.treasureWait = 4; const info = LAVA_EVENT_INFO[event.id]; this.host.toast(`${info.icon} ${info.name}: ${Math.ceil(event.left)} seconds remaining.`); }
    w.id = event.id; w.left = event.left;
    const period = event.id === 'eruption' ? V.eventPeriod : V.period;
    for (const vent of f.vents) {
      const phase = ventPhase(this.now, vent.phase, period), away = len(vent.x - at.x, vent.z - at.z);
      this.warn('vent-' + vent.id, phase, VENT_TEXT, away < V.near);
      if (phase !== 'eruption') continue;
      if (this.tick('eruption-' + vent.id, V.tick, dt) && away < vent.r) this.host.hurt(V.share, 'fire');
      // Fire rain: a drop every 0.3 s, 3 to 14 m from the vent, landing after 0.8 s (the reference's own seeded stream).
      if (this.tick('rain-' + vent.id, R.tick, dt)) {
        const sequence = Math.floor(this.now / R.tick), random = rng(sequence * 9743 + vent.id * 1351), angle = random() * TAU, far = R.min + random() * (R.max - R.min), x = vent.x + Math.cos(angle) * far, z = vent.z + Math.sin(angle) * far;
        if (this.dropOk(x, z)) this.drops.push({ kind: 'rain', x, z, r: R.r, age: 0, duration: R.fall });
      }
    }
    const near = (cx, cz, min, max, out) => { const angle = this.random() * TAU, far = min + this.random() * (max - min); out.x = cx + Math.cos(angle) * far; out.z = cz + Math.sin(angle) * far; return out; };
    if (event.id === 'meteor' && (w.meteorWait -= dt) <= 0) {
      const M = LAND.meteor; w.meteorWait = M.wait[0] + this.random() * M.wait[1];
      for (let attempt = 0; attempt < 8; attempt++) { const p = near(at.x, at.z, M.min, M.max, {}); if (!this.dropOk(p.x, p.z)) continue; this.drops.push({ kind: 'meteor', x: p.x, z: p.z, r: M.r, age: 0, duration: M.fall }); break; }
    }
    if (event.id === 'storm' && (w.stormWait -= dt) <= 0) {
      const S = LAND.storm; w.stormWait = S.wait[0] + this.random() * S.wait[1];
      const p = near(at.x, at.z, 0, S.max, {}); if (this.dropOk(p.x, p.z)) this.drops.push({ kind: 'fireball', x: p.x, z: p.z, r: S.r, age: 0, duration: S.fall });
    }
    if (event.id === 'treasure' && (w.treasureWait -= dt) <= 0) {
      w.treasureWait = O.every;
      for (const vent of f.vents) if (len(vent.x - at.x, vent.z - at.z) <= O.near) for (let i = 0; i < 2; i++) { const p = near(vent.x, vent.z, 2.5, 5.5, {}); this.addOre(p.x, p.z, O.treasure); }
    }
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i]; drop.age += dt; if (drop.age + 1e-9 < drop.duration) continue;
      const share = drop.kind === 'meteor' ? LAND.meteor.share : drop.kind === 'fireball' ? LAND.storm.share : R.share;
      if (len(drop.x - at.x, drop.z - at.z) < drop.r) this.host.hurt(share, 'fire');
      if (drop.kind === 'meteor') this.addOre(drop.x, drop.z, O.meteor); // a meteor leaves a crystal for 90 s
      this.drops.splice(i, 1);
    }
  }
  /** A falling thing may land here: in the Ember Fields, 3 m inside its borders. */
  dropOk(x, z) { return Number.isFinite(x) && Number.isFinite(z) && regionAt(x, z) === 'lava' && gridBorderDistance(x, z) >= 3; }
  addOre(x, z, seconds) { if (this.ores.length >= LAND.ore.most || !this.dropOk(x, z)) return; this.ores.push({ id: this.weather.sequence++, x, z, until: this.time + seconds }); }
  stepCloud(dt, at) {
    const B = LAND.bolt, G = LAND.gust, bolt = this.bolt;
    // Lightning: with the box open, a mark 2 to 9 m from you every 7 to 13 s, striking after 1.2 s.
    if (this.box) {
      bolt.wait = Math.max(0, bolt.wait - dt);
      for (let i = this.drops.length - 1; i >= 0; i--) { const d = this.drops[i]; d.age += dt; if (d.age + 1e-9 < d.duration) continue; if (len(d.x - at.x, d.z - at.z) < d.r) this.host.hurt(B.share, 'bolt'); this.drops.splice(i, 1); }
      if (bolt.wait === 0) {
        const random = rng(++bolt.sequence * 85717), angle = random() * TAU, far = B.min + random() * (B.max - B.min), x = at.x + Math.cos(angle) * far, z = at.z + Math.sin(angle) * far;
        bolt.wait = B.wait[0] + random() * B.wait[1];
        if (regionAt(x, z) === 'cloud') { this.drops.push({ kind: 'bolt', x, z, r: B.r, age: 0, duration: B.fall }); this.host.toast(BOLT_TEXT); }
      }
    } else this.drops.length = 0;
    // Gusts act with the box shut too: 2 s of warning from second 18 of every 25, then 3.5 s of push; the direction turns 2.399 rad each time.
    const cycle = Math.floor(this.time / G.cycle), phase = this.time - cycle * G.cycle, angle = cycle * G.turn;
    this.warn('gust', phase >= G.warn && phase < G.from ? 'warning' : 'idle', GUST_TEXT);
    this.gusting = phase >= G.from && phase < G.to;
    if (this.gusting && !at.riding) this.host.push(Math.cos(angle) * G.speed * dt, Math.sin(angle) * G.speed * dt);
  }

  /** The land line of the HUD: null, or {icon, label, value} with the reference's texts (statusSource) where the feature exists here. */
  status(x, z) {
    switch (regionAt(x, z)) {
      case 'ice': return { icon: '❄️', label: 'Ice', value: 'Slippery — release early to brake' };
      case 'lava': { if (!this.box) return null; const event = lavaEvent(this.now), info = LAVA_EVENT_INFO[event.id]; return { icon: info.icon, label: 'Weather', value: `${info.name} · ${Math.ceil(event.left)} seconds` }; }
      case 'toy': return { icon: '🚂', label: 'Toy railway', value: 'Moving trains hurt explorers' };
      case 'jungle': return { icon: '🌿', label: 'Jungle', value: this.poisoned(x, z) ? 'Poison gas! Leave the purple ground' : 'Thorn walls rise for 16 of every 36 seconds' };
      case 'cloud': return this.gusting ? { icon: '☁️', label: 'Cloud Meadow', value: 'Strong gust — brace' } : null;
      case 'shadow': return { icon: '🏮', label: 'Light', value: this.lampAt(x, z) ? 'Safe light — healing' : 'Light pillars reveal and repel shadow creatures' };
      default: return null;
    }
  }
  /**
   * The holes in the Night Land's dark, written into `out` (reused; at most 9): you (3.6 m, 7.5 m with a light trophy, × 0.4
   * during an eclipse), up to 4 lit lamps (8 m) and the 4 nearest crystal flowers within 28 m (2.4 m).
   */
  holes(x, z, light = false, out = []) {
    let n = 0; const put = (hx, hz, r) => { const h = out[n] ??= { x: 0, z: 0, r: 0 }; h.x = hx; h.z = hz; h.r = r; n++; }, N = LAND.night, f = FEATURES.shadow;
    put(x, z, (light ? N.lightHole : N.hole) * (this.eclipsed ? N.eclipse : 1));
    for (let i = 0, lit = 0; i < f.lamps.length && lit < 4; i++) if (this.lampLit(i)) { put(f.lamps[i].x, f.lamps[i].z, f.lamps[i].r); lit++; }
    const near = []; for (const p of f.flowers) { const d = len(p.x - x, p.z - z); if (d < 28) near.push([d, p]); }
    near.sort((a, b) => a[0] - b[0]); for (let i = 0; i < near.length && i < 4; i++) put(near[i][1].x, near[i][1].z, near[i][1].r);
    out.length = n; return out;
  }
}
