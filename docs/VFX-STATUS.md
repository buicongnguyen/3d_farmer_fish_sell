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


# VFX round 2: more beauty, same draw

Branch `vfx2` (worktree `3d_farmer_fish_sell-vfx2`, cut from origin/main df9693f). Nothing pushed. The owner asked: "consider more vfx
to the game to make it look nicer." Probes: `cute_game-notes/willowmere/vfx2-probes/` (shots.mjs, paired.mjs with four new spots,
table.mjs, the gate logs). Screenshots: `cute_game-notes/willowmere/evidence-vfx2/` (`<effect>-desktop.png` 1440x900, `<effect>-phone.png`
390x844 DPR 2; `-b` is a later frame; `sheet-phone-a/b.png` put four phone shots side by side).

Everything new lives in the same lazy chunk and the **same single `THREE.Points` draw and program** as round 1. The point buffer grew from
762 to 1,412 points (two new blocks: 90 ground points and 560 anchored points); no new draw, no new program (still compiled at install), no
shadow-pass object (castShadow false), no first-load code.

## Effects added (16)

| # | Effect | Where / when | How (cost) |
|---|---|---|---|
| 1 | **Rain on the GPU** (was 120 CPU-rewritten line segments) | rain days (`day % 5 === 0`), everywhere outdoors as before | home layer 0 takes a `rain` preset: blue-white streaks (shape 10) falling 7-17 m/s in the shader, slanted by the wind. The world.mjs CPU loop (240 `setXYZ` and a 2.9 KB upload every frame) and its LineSegments draw are **deleted**; `world.rain.visible` stays for roof-perches. A rain day: one draw fewer, no per-frame CPU work |
| 2 | Rain splash rings and puddle glints | rain days, round the player | new ground layer 4 (90 points): each point rings at a new spot of its cell every 0.55-1.05 s (shape 14, an ellipse lying on the ground); 20% are white glints |
| 3 | **Chimney smoke** | every chimney found in the baked village (14: rural and house kits, the homestead, the bakery's cupola) | anchored sort 0: 7 puffs a chimney rise 3.6 m, drift with the wind, swell and thin. Chimney caps are found once, 1.5 s after install, in 6 ms slices (76-900 ms wall time, never a hitch): upward triangles of the rural kit's charcoal flue or the house kit's dark stone rim, small and square, 4 m up or more (a dark beam over a barn door is not one) |
| 4 | **Warm lit windows** at dusk and night | 150 windows (glass-coloured vertical triangles of the baked village and the homestead, clustered; biggest first) | anchored sort 1: an additive warm glow just outside the pane, fading in from 17:30 to 20:30 with a slight flicker |
| 5 | Cooking fire: steam over the pot, rising sparks, a warm glow at dusk | the village green's pot (`OVEN`) | sorts 0, 2 and 1: 6 + 10 + 1 points |
| 6 | **Butterflies** by day | village, Blue Lake Meadow, Chomper Swamp; spring to autumn, not in rain | the critter layer 2 swaps fireflies (dusk) for butterflies (day): shape 15, wings beating in the fragment shader, bob and sway; 45 on high, 27 balanced |
| 7 | **Dragonflies** over the pond | daytime, within 45 m, not in winter or rain | sort 3: 5 dragonflies looping and darting, nose first (heading from the projected velocity), glassy shimmering wings |
| 8 | Water striders with ripple rings | the pond by day | sort 4: 10 dark specks gliding to a new spot, then a ring spreads (shape 13) |
| 9 | Shore foam and sparkles | the pond's water line | sort 5: 88 beads along `pond-water.mjs outline()` that breathe, 18% star sparkles |
| 10 | Outpost beacons and lamp glow | the 12 outposts in the wilds | sort 6: 9 gold and sky-blue sparkles spiral 6.5 m up from each Home pad (culled beyond 190 m); the lamp gets a sort-1 glow at night |
| 11 | Night Land motes | inside the Night Land | its dark is a DOM layer, so these are DOM: 18 soft dots right after `#night-layer`, CSS animations of transform and opacity only, shown only while that layer is (checked every 0.4 s), none with reduced motion |
| 12 | Running dust on touch | a full push of the stick (on foot a touch player walks at 4.8 m/s; there is no sprint) | the stick is read only while a pointer holds `#joystick` (pointer events set a flag), then the existing run puffs |
| 13 | Leaf gusts | village and home meadows by day, every 22-48 s (not in rain, winter, dusk or with reduced motion) | burst kind 7: 18 leaves and petals carried across the view, fluttering |
| 14 | Hearts over a villager | `talk` (1 heart), `gift` (3) | burst kind 8 (shape 11) over the villager's head (over yours when they are not within 8 m), with pink sparkles |
| 15 | Shimmer column | `upgrade`, and `claim` on top of its confetti | burst kind 6: 36 sparkles spiral up round the player, a ring along the ground (kind 9) |
| 16 | Boss arrival and quake: shock ring and dust ring | the dragon's arrival, a slam, a quake's ring (pandora-view.mjs calls `world.vfx?.('arrive' or 'quake', {x, z, r})`) | burst kind 9: a ground ring up to 21 m across (only this kind may pass the 9%-of-height point cap, up to 36%, for under a second) and 10-18 dust puffs |

Also: `feed` and `collect` (the pen) now get the catch sparkle.

Scaling: anchored points use `uKd` = min(1, .5 + .5 x quality) x (1, .85, .6, 0) by governor step (the last step turns them off);
butterflies at half the critter density; splashes at the home density (at least 0.3); rain at max(0.3, density), halved with reduced
motion (weather, not decoration, as before). Each anchored sort culls itself beyond 80 m of the player in the vertex shader.

## Cost

- **Bundle: first load 1,095,787 bytes** (limit 1,100,000, 4,213 to spare): **-550 bytes** against df9693f's 1,096,337 (the CPU rain in
  world.mjs is gone; the pandora-view.mjs hooks are in its own lazy chunk). The vfx chunk: 18.2 KB -> 35.7 KB (13.7 KB gzipped), fetched
  after the village stands as before.
- **Draws: +0.** One Points draw while anything shows (it was already drawn in the village by day for the petals); rain days draw one fewer
  (the old LineSegments). tests/budget-browser.mjs: village PC 149 draws / 244k triangles, the same as round 1.
- **Programs: +0** (the one vfx program, compiled at install). Shadow pass: nothing.
- **Per-frame CPU: the same path.** `frame()` still reads one double and counts integers; the new work runs in the every-24-frames
  `decide()` (8 sort targets) and in `ease()` only while an alpha moves. Allocation attributed to the vfx chunk (HeapProfiler sampling,
  same page, the loaded-machine run below): 31-48 B a frame at rest, 109 B a frame driving (round 1: 14-76 at rest, 60-210 driving).
- **GPU:** 650 more vertices through the vertex shader (points whose layer or sort is off leave the screen at once); the new fragments
  are small sprites (windows 0.9-2.2 m, smoke up to 2.3 m, the rest under 1.5 m) and one shock ring for under a second.

## Gate: NOT completed on this machine (open)

The paired probe (same page, VFX off/on alternating; 4x CPU-throttled 390x844 phone and 1440x900 PC) could not produce usable frame times
this session: other sessions were running 18-26 headless Chrome instances and the machine had 1.3 GB of 32 GB free. Unloaded frames read
17.5 ms in round 1; here the phone frames read 20-31 ms with 0.3-1.5 s worst frames in **both** modes, and two later attempts did not finish
one spot in 9 minutes (an unloaded run takes about one minute). The one complete phone run (`vfx2-probes/gate-phone-loaded.log`), kept for
the record only: its swings of up to 14% either way are the machine, not the effects. No desktop run was possible.

| Spot | Screen | Frame mean ms (off → on) | p95 ms | CPU work ms | Draws (median) | Alloc KB/frame | VFX code B/frame |
|---|---|---|---|---|---|---|---|
| village day | phone | 28.07 → 24.98 | 83.3 → 66.7 | 15.30 → 15.16 | 124 → 110 | 54.0 → 54.5 | 41 |
| village night | phone | 26.04 → 24.48 | 50.3 → 50.2 | 18.65 → 18.10 | 107 → 113 | 50.7 → 60.1 | 34 |
| fields | phone | 22.59 → 22.07 | 50.3 → 50.0 | 13.57 → 13.62 | 114 → 114 | 59.6 → 64.7 | 38 |
| pond | phone | 30.37 → 28.02 | 83.4 → 83.3 | 15.63 → 16.05 | 112 → 113 | 54.9 → 69.2 | 38 |
| Town Square | phone | 23.80 → 24.54 | 50.2 → 66.6 | 15.01 → 14.36 | 100 → 99 | 51.2 → 57.1 | 48 |
| home region | phone | 27.02 → 30.67 | 99.8 → 100 | 12.89 → 15.62 | 56 → 50 | 38.9 → 46.1 | 31 |
| planet, box open | phone | 27.22 → 31.04 | 83.2 → 83.3 | 14.54 → 18.59 | 50 → 51 | 46.1 → 58.5 | 31 |
| fight | phone | 28.70 → 26.57 | 83.6 → 66.9 | 16.60 → 14.70 | 60 → 67 | 61.6 → 60.5 | 45 |
| jeep at top speed | phone | 20.15 → 20.68 | 33.5 → 33.6 | 12.92 → 14.05 | 36 → 37 | 60.5 → 93.7 | 109 |
| rain (new) | phone | 25.50 → 26.39 | 66.8 → 83.4 | 13.70 → 16.13 | 123 → 107 | 48.0 → 59.8 | 31 |
| windows at night (new) | phone | 23.30 → 25.63 | 50.2 → 66.7 | 16.39 → 17.07 | 93 → 94 | 50.1 → 57.1 | 31 |
| outpost (new) | phone | 27.89 → 25.89 | 83.3 → 66.8 | 15.10 → 15.41 | 49 → 52 | 46.6 → 45.8 | 31 |
| Night Land (new) | phone | 27.39 → 26.24 | 83.3 → 66.7 | 14.93 → 15.96 | 40 → 39 | 56.8 → 60.7 | 34 |

("off" in the rain row is no rain at all: the old CPU rain no longer exists to switch to. Draw medians move by +-15 with villagers walking
in and out of view, both ways, as in round 1.) To finish the gate on a quiet machine, serve dist on 4881 and run
`PAIRED=1 URLS='{"vfx":"http://127.0.0.1:4881"}' PROFILES=phone,desktop node vfx2-probes/paired.mjs`, then
`node vfx2-probes/table.mjs <log>`. If a spot fails, the knobs are `N.anchor` (560), `uKd`, the window cap (150) and the butterflies'
density factor (.5); each sort can be switched off on its own in `decide()`.

## Dropped or not built

- **Stars, shooting stars, rainbow arc, sun-ray cards: dropped.** The camera looks down at about 41 degrees through an orthographic lens:
  no sky is ever on screen, and the village's evening (time stops at 22:00) stays golden, not dark.
- **Sphere bursts (`world.burst`) to the GPU: not done.** Codex's BurstPool is one instanced draw that exists only while bursts live; it
  never showed as a cost, and moving it would touch every caller in shared files.
- **Duck ripples:** the pen's ducks do not swim on the pond; the striders' rings stand in. **Lamp halos on the ring road:** the village
  has no lamp posts to anchor to (the outposts' lamps glow instead). **Titan footstep dust:** the titans' view has no footfall event; the
  slam / quake shock ring covers the big stomps. **Ready-crop night glow, fishing-line sparkle, a "new" sparkle on interactables,
  rescue-hut candle, border ribbon shimmer:** not built (crop cards already ring and sparkle when ripe; pond-life already sprays at the
  bite; the tap rings already mark interactables).
- **Beacon, first try:** soft additive glows were invisible over the bright grass; they became mostly opaque star sparkles.

## Open

- The speed gate (above): re-run on a quiet machine, phone and desktop.
- If the home is upgraded in a session, its smoke stays where the old chimney was until the next load (the scan runs once).
- pandora-browser's 360-wide region chip overlap (pre-existing, from round 1).

## Tests (dist served on 4881, GPU)

- `npm test`: 542 pass, 0 fail.
- `node scripts/build.mjs`: ok, 1,095,787 bytes first load.
- tests/browser.mjs: exit 0, no errors. tests/budget-browser.mjs: 30 spots inside the lines (village PC 149 draws / 244k).
  tests/governor-browser.mjs: stepped down to 1 (pixel ratio 0.80) and back to 0.

## Merge notes (round 2)

src/vfx.mjs and src/vfx-glsl.mjs (new blocks; the round-1 effects are unchanged); src/world.mjs: the rain's construction and its per-frame
loop replaced by `this.rain={visible:false}` and `this.rain.visible=calendar(s).rain&&this.location!=='interior';` (two lines);
src/pandora-view.mjs: three `world.vfx?.(...)` calls (the arrival, the slam, a quake's ring).
