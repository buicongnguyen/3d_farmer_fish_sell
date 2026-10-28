# VFX round: more life, same speed

Branch `vfx` (worktree `3d_farmer_fish_sell-vfx`, cut from origin/main 7ecf83f). Nothing pushed.
The owner asked: "if possible, can we add some vfx to the game but dont make the game slow down".
Probes and raw numbers (not in the repo): `cute_game-notes/willowmere/vfx-probes/` (measure.mjs, paired.mjs, shots.mjs,
`baseline.jsonl`, `ab1.jsonl`, `paired2.jsonl`, `paired3.jsonl`). Screenshots: `cute_game-notes/willowmere/evidence-vfx/`
(one PNG per effect and screen, `-b` is ~0.2-0.4 s later; `sheets/` puts four side by side).

## What was there before (built on, not beside)

| Effect | Where | How it draws |
|---|---|---|
| Reward burst (`world.burst`, `world.burstAt`) | harvest, catch, claim, festival, race, tree picks, jump take-off/landing, tale spots, decor | Codex's shared `BurstPool` (src/burst-pool.mjs): one instanced sphere draw, CPU-moved, reusable records |
| Combat FX (combat-fx.mjs, combat-fx-draw.mjs) | fights (box open) | chips, sparks, rings, arcs, danger discs: pooled instanced draws, numbers, shake |
| Zoo paint (zoo-paint.mjs) | skill shots | one float-texture shape painter, instanced |
| Pond spray, rings, bubbles (pond-sim.mjs / pond-life.mjs) | the family pond: cast, nibble, bite, hook, escape | pooled sparks and rings |
| Lava weather (lava-weather.mjs, land-view.mjs) | Ember Fields: meteors, fire rain, ore | instanced, land-view |
| Fruit coin glint (fruit-ready.mjs) | ready fruit trees | one instanced draw, shader-animated |
| Crop sparkle, ripe ring, pop (crop-cards.mjs) | garden beds | two instanced draws for all beds |
| Race flags (race-flags.mjs) | village run | one mesh a flag, cloth rewritten in place |
| Birds, roof perches, pen animals | everywhere / pens | instanced, CPU-moved |
| Rain (world.mjs) | rain days (`day % 5 === 0`) | 120 line segments rewritten every frame |

There was no ambient air (petals, leaves, snow, fireflies, embers) and no per-action feedback beyond the sphere burst.

## What was added

Everything new is **one `THREE.Points` draw** with **one shader program** (src/vfx.mjs + src/vfx-glsl.mjs, a lazy chunk of
18.3 KB, 7.7 KB gzipped), fetched with `import()` by outdoors.mjs after the village stands. The program is compiled at install.
Motion runs in the vertex shader from a time uniform; additive and normal points share the draw (premultiplied blending: an additive
point writes alpha 0). When nothing is showing the object is hidden (0 draws).

| # | Effect | Where / when | Cost |
|---|---|---|---|
| 1 | Season air: pink petals (spring), gold pollen sparkles (summer), orange leaves (autumn), snow (winter) | village and the Blue Lake Meadow / Chomper Swamp home regions, by `calendar(s)`; off on rain days (the existing rain shows) | 220 points (high), 132 (balanced), 66 (battery), in a 64 m box that wraps round the player and fades out towards its rim |
| 2 | Mushroom Forest spores (teal / violet glow), Redrock Canyon wind dust | those home regions | same layer as 1 |
| 3 | Land air: Ember Fields embers rising, Frost Land blue flurries, Shell Beach bubbles, Candy Land sugar sparkles, Toybox confetti, Cloud Meadow fluff, Wild Jungle midges | inside a land; fades in with `world.landShare` (the same 24 m crossfade as the land's light) while the home layer fades out | second layer of 220 points; the village and home regions never show it |
| 4 | Fireflies | dusk and night with the light cycle on (from 17:30, full at 20:30), village and home regions | 90 points, additive glow |
| 5 | Pond sun glints | twinkling stars on the family pond, daytime, within 45 m | 40 anchored points |
| 6 | Harvest pop | gold sparkles, a soft gold ring and leaf bits at the bed | burst slots (25 points, about 1 s) |
| 7 | Watering | blue droplets falling on the bed, two splash rings, and **wet soil**: a dark soft patch under a watered bed until it is ripe | 24 burst points; the wet patch is one more instance in crop-cards' existing flat batch (no draw) |
| 8 | Planting dirt puff, tree-pick leaves and sparkles, chop / uproot wood chips, catch / gift / gather sparkles | at the bed / tree / player | 6 to 18 burst points |
| 9 | Album claim, festival, race finish, hiring: confetti burst with a ring and sparkles | at the player | 49 burst points, 1.7 s |
| 10 | Coins fly to the coin counter on a sale, the counter bumps | HUD (DOM: 8 reused `<i>` coins, Web Animations) | no WebGL cost; nothing created after the first sale |
| 11 | Dust puffs at a sprint (Shift) and behind a vehicle's rear wheels at speed, coloured by the region's ground | on foot and riding, every 1.6 m / 2.2 m travelled | 1-2 burst points per puff |
| 12 | Door puff | stepping back outside after a house, shop or facility | 7 burst points |

Bursts are written once at spawn into a ring of 192 slots (origin, velocity, birth time, life, kind, size, colour) with one upload
range per attribute (`changed-buffers.mjs markRange`); the shader moves and fades them; the CPU never touches a live burst.

### Scaling and accessibility
- Graphics setting: high 1, balanced 0.6, battery 0.3 of the ambient points; bursts use half their points on battery.
- Governor step (src/governor.mjs, `world.step`): ambient x1 / 0.75 / 0.5 / 0 at steps 0-3; bursts x1 / 1 / 0.6 / 0.4.
- `prefers-reduced-motion`: the screen-filling layers (season air, land air) are off, fireflies halved, bursts halved, coins do not
  fly (the counter just bumps).
- Indoors: all ambient layers fade out (the door puff greets you back outside).
- The Pandora box: nothing in vfx.mjs reads it. The village draws exactly the same with the box open or shut; a land has its air
  whether the box is open or not (it is the land's weather, not the creatures').

### Per-frame CPU
`frame()` (a room-view onFrame hook) writes the time uniform, swaps the centre uniform to the player's (or the car's) own position
vector when it changes, and counts frames in small integers. Every 4 frames it compares the canvas height (an integer); every 24
frames it re-decides the layers (region, season, night, quality); alphas ease only while a layer's wish changed. Dust is looked at
only while sprinting or riding, every other frame. The point scale comes from the projection matrix in the shader.
Why so careful: V8 leaves a method called once a frame unoptimised for a long time, and unoptimised code boxes every double it
loads or computes (ROUND8-PERF2). The first version of `frame()` allocated about 860 B a frame; this one 14-76 B at rest
(the sampled HeapProfiler attribution to the vfx chunk, against 35-77 KB a frame for the whole game) and 60-210 B while driving.

## Measurements

Playwright, Chrome with the GPU flags, `node scripts/build.mjs`, `node scripts/serve-dist.mjs dist 4861` (baseline build of 7ecf83f
on 4862). PC = 1440x900 "high"; phone = 390x844, DPR 2, touch, "balanced" (the default), **4x CPU throttle**. Frame time is rAF to
rAF; "CPU work" is the time inside the game's rAF callbacks; draws and triangles are `willowmere.calls()` (both passes);
allocation is CDP HeapProfiler sampling (minor and major GC objects included) per frame.

### Gate run (paired2): same page, VFX off and on in alternating windows
Six alternating windows of 150 frames each per mode (900 frames each), after a warm-up page; allocation from one 150-frame window
per mode. The same page and spot removes load-to-load noise (villagers wander: the draw count of one spot moves by +-15 between
windows either way, so the draw column is the median of six). Taken on c063f3c (the look pass after it changed colours and
presets only; paired3 re-checked the phone at village, planet and drive on d5a7214: same result).

| Spot | Screen | Frame mean ms | p95 ms | Worst ms | CPU work ms | Draws (median) | Triangles | Alloc KB/frame | VFX code B/frame | Shown |
|---|---|---|---|---|---|---|---|---|---|---|
| village day (8,18) | phone 4x CPU | 17.54 → 17.58 (+0.2%) | 18.1 → 18.2 | 18.8 → 35.3 | 6.24 → 6.25 | 131 → 129 | 219.3k → 221.2k | 61.5 → 49.8 | 34 | petals + glints |
| village day | PC | 17.61 → 17.61 | 18.3 → 18.3 | 18.9 → 18.8 | 1.30 → 1.32 | 147 → 146 | 243.9k → 242.8k | 51.6 → 50.6 | 14 | petals + glints |
| village night (21:00) | phone | 17.57 → 17.58 (+0.1%) | 18.3 → 18.2 | 18.9 → 19.1 | 6.14 → 6.29 | 130 → 129 | 219.3k → 219.9k | 62.3 → 62.9 | 48 | petals + fireflies |
| village night | PC | 17.58 → 17.60 | 18.2 → 18.2 | 18.9 → 18.9 | 1.25 → 1.27 | 142 → 136 | 239.4k → 236.2k | 62.6 → 65.9 | 0 | petals + fireflies |
| fields (-15,3) | phone | 17.53 → 17.54 (+0.1%) | 18.2 → 18.1 | 18.9 → 19.0 | 6.18 → 6.32 | 118 → 114 | 212.4k → 207.4k | 57.3 → 54.0 | 35 | petals + glints |
| fields | PC | 17.61 → 17.59 | 18.3 → 18.2 | 19.0 → 18.8 | 1.34 → 1.36 | 145 → 148 | 273.9k → 275.9k | 77.0 → 68.7 | 55 | petals + glints |
| pond (16,14) | phone | 17.59 → 17.57 (-0.1%) | 18.2 → 18.2 | 18.9 → 18.8 | 6.60 → 6.64 | 116 → 118 | 214.5k → 212.8k | 69.1 → 57.2 | 21 | petals + glints |
| pond | PC | 17.60 → 17.58 | 18.2 → 18.2 | 19.1 → 19.2 | 1.37 → 1.36 | 148 → 147 | 230.6k → 230.8k | 63.8 → 54.6 | 34 | petals + glints |
| Town Square (10,-32) | phone | 17.58 → 17.59 (+0.1%) | 18.2 → 18.3 | 18.9 → 18.8 | 6.30 → 6.33 | 105 → 97 | 199.9k → 193.5k | 53.3 → 47.8 | 76 | petals + glints |
| Town Square | PC | 17.59 → 17.59 | 18.2 → 18.3 | 18.8 → 18.9 | 1.35 → 1.37 | 138 → 141 | 282.1k → 281.4k | 59.0 → 59.0 | 14 | petals + glints |
| home region, Mushroom Forest (-79,79) | phone | 17.59 → 17.58 (-0.1%) | 18.3 → 18.2 | 18.9 → 18.7 | 4.72 → 4.90 | 52 → 56 | 108.4k → 110.0k | 38.1 → 34.3 | 14 | spores |
| home region | PC | 17.61 → 17.59 | 18.4 → 18.3 | 19.0 → 18.9 | 1.00 → 1.03 | 67 → 65 | 131.7k → 130.3k | 44.6 → 42.1 | 35 | spores |
| Ember Fields, box open (-87,-205) | phone | 17.64 → 17.62 (-0.1%) | 18.3 → 18.3 | 35.2 → 19.1 | 6.28 → 6.28 | 53 → 50 | 41.7k → 40.6k | 54.7 → 46.5 | 28 | embers |
| Ember Fields, box open | PC | 17.60 → 17.62 | 18.3 → 18.4 | 18.9 → 18.8 | 1.20 → 1.21 | 80 → 77 | 58.7k → 57.3k | 48.5 → 51.4 | 21 | embers |
| fight (3 creatures, F every 0.25 s) | phone | 17.61 → 17.64 (+0.2%) | 18.3 → 18.3 | 18.8 → 35.4 | 6.26 → 6.46 | 63 → 62 | 43.8k → 42.8k | 52.3 → 46.7 | 14 | embers |
| fight | PC | 17.58 → 17.59 | 18.2 → 18.3 | 18.9 → 18.9 | 1.18 → 1.21 | 78 → 82 | 56.3k → 58.0k | 56.3 → 54.3 | 14 | embers |
| jeep at top speed (from -180,-215 east) | phone | 17.60 → 17.58 (-0.1%) | 18.2 → 18.3 | 35.3 → 18.9 | 5.59 → 5.64 | 39 → 43 | 56.0k → 59.8k | 54.3 → 64.0 | 206 | land air + wheel dust |
| jeep at top speed | PC | 17.60 → 17.60 | 18.3 → 18.3 | 18.8 → 19.0 | 1.14 → 1.19 | 58 → 59 | 81.6k → 79.3k | 44.3 → 43.9 | 63 | land air + wheel dust |

(Headless Chrome paced frames at about 57 Hz in this session, so an unloaded frame reads 17.6 ms, not 16.7. A "worst" of 35 ms is
one doubled frame; it shows up on either side.)

**Gate (throttled phone): passed everywhere.** Frame mean within -0.1% to +0.2%, p95 within one 0.1 ms bucket (+0.55% at most);
draws: the VFX is exactly one draw while something shows (never in the shadow pass; the per-spot medians above move by more than
that with the villagers, both ways); triangles: none (points); allocation: the whole page's sampled allocation is within its own
noise (it went down at 7 of 9 phone spots), and the part attributed to the VFX code is 14-76 B a frame at rest and about 200 B
a frame while driving (wheel dust), against 35-65 KB a frame for the game.
CPU work rose 0.00-0.20 ms a frame on the throttled phone (median +0.05 ms), inside the frame budget; on the PC -0.01 to +0.05 ms.

### Cross-build run (ab1): baseline build 7ecf83f vs the first VFX build, separate page loads
Kept for reference: the same spots on two builds, one load each. Frame time did not move (16.67 → 16.67 at 8 of 9 phone spots);
everything else is within load-to-load noise (the drive took a different path each time, so its numbers compare different
places). It was taken on the first VFX build (71a5bf8, before the allocation work) and decided the paired method above.

| Spot | Screen | Frame mean ms | p95 | worst | CPU work ms | Draws | Triangles | Alloc KB/frame |
|---|---|---|---|---|---|---|---|---|
| village day | phone | 16.67 → 16.67 | 16.7 → 16.8 | 16.8 → 16.8 | 7.51 → 7.23 | 135 → 136 | 224.3k → 224.3k | 71.0 → 68.3 |
| village day | PC | 16.67 → 16.67 | 16.9 → 16.8 | 17.0 → 17.6 | 1.42 → 1.48 | 146 → 146 | 243.0k → 242.6k | 71.2 → 70.8 |
| village night | phone | 16.67 → 16.67 | 16.8 → 16.8 | 17.0 → 16.9 | 5.80 → 6.54 | 103 → 112 | 203.5k → 208.1k | 56.8 → 59.2 |
| village night | PC | 16.67 → 16.67 | 16.8 → 16.8 | 17.0 → 16.9 | 1.37 → 1.25 | 124 → 117 | 227.3k → 222.5k | 62.8 → 58.9 |
| fields | phone | 16.67 → 16.67 | 16.8 → 16.8 | 16.8 → 16.9 | 7.06 → 6.64 | 119 → 120 | 212.7k → 212.7k | 68.2 → 68.0 |
| fields | PC | 16.67 → 16.67 | 16.8 → 16.8 | 16.9 → 16.9 | 1.39 → 1.41 | 149 → 144 | 277.6k → 273.3k | 81.3 → 75.8 |
| pond | phone | 16.67 → 16.67 | 16.8 → 16.8 | 16.8 → 16.9 | 6.69 → 6.80 | 105 → 108 | 205.6k → 205.9k | 54.5 → 58.7 |
| pond | PC | 16.67 → 16.67 | 16.8 → 16.8 | 16.9 → 16.9 | 1.44 → 1.47 | 145 → 146 | 230.3k → 230.3k | 75.4 → 74.9 |
| Town Square | phone | 16.67 → 16.67 | 16.8 → 16.8 | 16.9 → 16.8 | 6.49 → 6.41 | 94 → 95 | 191.0k → 191.0k | 57.0 → 51.8 |
| Town Square | PC | 16.67 → 16.67 | 16.8 → 16.8 | 16.9 → 16.9 | 1.34 → 1.35 | 137 → 138 | 279.8k → 279.8k | 65.1 → 65.3 |
| home region | phone | 16.67 → 16.67 | 16.8 → 16.8 | 16.8 → 16.8 | 5.12 → 5.17 | 52 → 53 | 108.4k → 108.4k | 45.7 → 43.7 |
| home region | PC | 16.67 → 16.67 | 16.9 → 16.9 | 17.1 → 17.1 | 1.11 → 1.13 | 67 → 68 | 131.6k → 131.6k | 48.6 → 49.3 |
| Ember Fields, box open | phone | 16.67 → 16.67 | 16.9 → 16.8 | 17.0 → 17.0 | 6.90 → 7.09 | 51 → 53 | 40.9k → 41.2k | 50.3 → 50.1 |
| Ember Fields, box open | PC | 16.67 → 16.67 | 16.8 → 16.8 | 17.1 → 17.0 | 1.34 → 1.30 | 78 → 76 | 57.2k → 56.5k | 59.8 → 61.9 |
| fight | phone | 16.67 → 16.72 | 16.8 → 16.8 | 17.1 → 33.3 | 7.44 → 7.13 | 60 → 61 | 43.2k → 43.2k | 63.6 → 57.5 |
| fight | PC | 16.67 → 17.64 (*) | 16.8 → 18.4 | 16.9 → 18.8 | 1.36 → 1.31 | 78 → 81 | 56.3k → 56.6k | 60.1 → 63.9 |
| drive | phone | 17.63 → 17.70 | 18.2 → 18.3 | 34.8 → 35.8 | 6.44 → 7.88 | 47 → 38 | 70.3k → 54.5k | 93.9 → 148.8 |
| drive | PC | 17.58 → 17.56 | 18.2 → 18.2 | 18.7 → 18.8 | 1.57 → 1.28 | 57 → 71 | 76.2k → 96.1k | 84.8 → 104.1 |

(*) every frame of that load was paced at 57 Hz (work 1.31 ms, below the baseline's), a display pacing change of the headless
browser, not the game; the paired run is the gate.

### Bundle
First load 1,096,337 bytes (limit 1,100,000; 3,663 spare). Baseline 1,096,212: **+125 bytes** (the `import()` line in outdoors.mjs and
`world.vfx?.(type,arg)` in main.mjs runAction). Fetched later +18.3 KB (the vfx chunk).

## Thinned, dropped, not built

- **Night Land air: dropped.** The land's dark is a DOM layer over the canvas (`#night-layer`), so star motes were drawn and never
  seen (evidence `night-land-*.png`).
- **Frost Land snow: changed** from white flakes (invisible on the white ground) to blue-tinted star flurries.
- **Summer pollen, sparks: made opaque-ish.** Additive white on the bright grass did not read; pollen is gold and normal-blended,
  burst sparks are 30% additive.
- **Allocation:** the first build's 860 B a frame was cut to tens of bytes (integer frame counting, work every few frames, the
  shader computing the point scale). Nothing had to be made high-only: the gate held on "balanced" phones.
- **Not built:** chimney smoke and lit-window glow (they need chimney and window positions for every house; the baked village has
  none to read, and smoke or halos in the wrong place look worse than none); morning mist over the fields (large overlapping
  translucent sprites are exactly the phone fill-rate cost this round must not add); a fishing-cast splash (pond-life already rings
  and sprays at the cast, bite, hook and escape); a separate level-up burst (album claims, festivals and race finishes get the
  confetti).
- **Running dust on phones:** the sprint is the Shift key, so a touch player gets dust only from vehicles.

## How to add one more effect within the budget

1. **Ambient** (fills the air round the player): add a preset to `PRESETS` in src/vfx.mjs (`P(shape, additive, fall, sway, spin,
   size, driftX, driftZ, yLow, yHigh, [3 colours])`; shapes 0-9 are listed above the table) and point a region at it in
   `HOME_AIR` / `LAND_AIR`, or give it a condition in `decide()` through `this.aim(layer, preset, alpha, density)`. Four layers
   exist (home, land, glow, pond); a fifth means a new block of points (`N`), a branch in the vertex shader and a slot in the
   uniform arrays (`uP/uQ/uR[4]`, `uCol[12]`): still one draw.
2. **Burst** (an event): call `world.vfx?.(type, arg)` from where the event happens (main.mjs runAction already does it for every
   action) and add a line to `act()`: `this.spawn(KIND.spark|drop|puff|confetti|ring|leaf, x, y, z, n, {spread, up, life, size,
   colors, delay, jitter})`. For something spawned every frame or every few metres, pass a **reused** options object (see
   `DUST_RIDE`), never a literal. A new motion kind is one more `else if (kind == N)` in vfx-glsl.mjs.
3. Keep the shader source in vfx-glsl.mjs (scripts/vi-coverage.mjs skips `*-glsl.mjs`; GLSL lines otherwise look like untranslated
   English to the Vietnamese audit).
4. Check: `willowmere.vfx()` (layers, alphas, densities), `willowmere.vfxAct(type, arg)` (play a burst),
   `willowmere.vfxShow(false)` (switch all VFX work off for a same-page before / after), then
   `vfx-probes/paired.mjs` (PAIRED=1 URLS='{"vfx":"http://127.0.0.1:4861"}' SPOTS=... PROFILES=phone) and shots.mjs.
   Budget per added effect: no new draw, no new program, under 50 B a frame of its own allocation at rest.

## Merge notes

Files: new src/vfx.mjs, src/vfx-glsl.mjs; one line each in src/outdoors.mjs (the `import('./vfx.mjs')` after race-flags) and
src/main.mjs (runAction: `if(result.ok){taleNews(taleEvent(state,type,arg));world.vfx?.(type,arg);}`); src/crop-cards.mjs (the
`wet` atlas cell, the ground batch has 90 slots instead of 60, one `put` of the wet patch before the soft shadow);
tests/crop-cards.test.mjs (atlas capacity `models.size+4`); scripts/vi-coverage.mjs (skip `-glsl.mjs`).
Codex's shared particle pool (src/burst-pool.mjs, `world.burstPool` behind `world.burst` / `world.burstAt`) is untouched and still
draws the sphere bursts; the new layer sits beside it as `world.vfx` and reuses `changed-buffers.mjs markRange` for its uploads.
Codex's transform-cache / GPU-upload work (96d3bea) is not touched. If Codex edits runAction or the outdoors import list, the
conflicts are those single lines.

## Tests (dist served on 4861, GPU)
- `npm test`: 542 pass.
- `node scripts/build.mjs`: ok, 1,096,337 bytes first load.
- tests/browser.mjs: exit 0, no errors. tests/budget-browser.mjs: 30 spots inside the lines (village PC 149 draws / 244k, phone 92 /
  176k). tests/governor-browser.mjs: stepped down to 1 and back. (Run on 7ce64db; the look pass after it changed only colours, sizes
  and presets.)
- tests/pandora-browser.mjs: **fails at the 360 x 740 HUD check** ("the chip ... is under .home-button" for eight regions). The
  same failure happens on the untouched baseline build of 7ecf83f (served on 4862), so it is not from this round; every check
  before it passed.

## Open
- pandora-browser's 360-wide region chip overlap (pre-existing on main).
- The old rain still rewrites 120 line segments on the CPU every frame; it could become a layer of this draw (shape 3 streaks
  exist in the skill's template) and save that work.
- The sphere bursts (`world.burst`) are CPU-moved; they could move to vfx bursts (written once, GPU-moved) if they ever cost.
- Touch sprint dust, chimney smoke and window glow (see above).
