# Round 9 build spec (ring world): the village in the middle, four home regions in a red ring, eight planets in a yellow ring, difficulty rising with distance

Status: spec only, nothing built. Written 2026-10-05, then reviewed the same day against three reviewers' 26 findings: every finding is resolved in place or rejected with evidence in the **Review log** at the end (read it first if you saw the earlier draft). It turns the shipped round 8 world (thirteen equal 128 m squares, live on main `446e5f9`) into the layout the user drew. A builder works from this file plus `ROUND8-GRID-SPEC.md` (called "the old spec" below) for everything that does not change; section 1 says which old sections still hold unchanged and which this file replaces.

- **Willowmere code read for this spec:** `C:/Users/n/source/repos/3d_farmer_fish_sell-round8`, branch `round8`, HEAD `798ed32` at the review (main is `446e5f9`; the branch is 19 commits ahead of main, all from the running fix pass, section 8.6; the first draft read `1b65987`, 14 commits). Everything is referred to **by function and file name, never by line number**, because the fix pass is still moving lines.
- **Reference:** Zoo Garden, `C:/Users/n/source/repos/cute_game`, read-only. Its home world is four 90-degree sectors outside an 18 m village inside a disc of radius 148 m (`cute_game/src/navigation.ts`, `cute_game/src/environments.ts` `zoneAt`), its planets are discs of the same radius: this layout is closer to the reference than the squares were.
- **Axes:** north is -z, east is +x, as in the old spec. **Bearing** is measured clockwise from north in degrees: 0 north, 90 east, 180 south, 270 west (`bearingOf(x, z) = atan2(x, -z)`).
- **Scratch scripts** (outside both repos, cited by name throughout; their raw output is reproduced in Appendix C and their reference code in Appendices A and B): `C:/Users/n/AppData/Local/Temp/claude/c--Users-n-source-repos-3D-claudeopus55/b8fceb14-f0a3-4aa9-8faf-3ab1b7a4ccf1/scratchpad/ring/` containing `order.mjs`, `radii.mjs`, `denfit.mjs`, `denfit2.mjs`, `homefit.mjs`, `window2.mjs`, `world.mjs`, `check-world.mjs`, `dens.mjs`, `features.mjs`, `stands2.mjs`, `rim.mjs`, `edge.mjs`, `tiles.mjs`, `classes.mjs`, `perregion.mjs`, `lists.mjs`, `centre.mjs`, `window.mjs`, `slots.mjs`, `gradient.mjs`, `misc.mjs`, `migrate.mjs`, `tables.mjs`, `densmd.mjs`, `verify.mjs`, and, from the review, `review.mjs`, `review2.mjs`, `review3.mjs`, `order2.mjs`, `order3.mjs`, `bsize.mjs`. `verify.mjs` asserts every placement rule of sections 3.1 to 3.5 against the tables printed here: **974 assertions pass** (Appendix C; the review changed none of those tables, so it was not re-run). The review's own computations are the six scripts above, their output is the last block of Appendix C, and `migrate.mjs` was re-run with the den rule of 5.2.

## 0. What the user asked, my reading, and every decision at a glance

The user: "I think about make the layout for the map maybe similar to this one so that the more difficult map will be a little more far away. How about fix the map like this?" with a drawing: concentric circles; in the centre a blue square "village"; around it a red circle (the inner ring) cut into four parts by one vertical and one horizontal line through the centre; around that a yellow ring (the outer ring) cut into eight parts by the same two lines, extended, and four diagonal lines that start at the red circle's edge.

**Reading, built unless the user says otherwise:** village = the existing road-hugging ward; red ring = the four home regions with their bosses, one in each quarter (NE, SE, SW, NW); yellow ring = the eight planets of Zoo Garden, each with its bosses and its titan, one in each 45-degree sector, the sector boundaries on the four axes and the four diagonals; the world is a circle with no empty cells and no notches; difficulty rises with distance from the village; the rainbow borders follow the circles and the radial lines.

Because the drawing's vertical and horizontal lines are the quarter boundaries, and the four diagonals are the middles of the quarters, every outer sector touches exactly one quarter, and every quarter touches exactly two sectors. That alignment is what the rest of this file uses.

| # | Decision | Value | Reason (numbers in the section named) |
|---|---|---|---|
| 1 | Radii, one exported block in `src/regions.mjs` | **R1 = 160 m, R2 = 296 m** (world 592 m across, 275,254 m^2) | R1 = 160 gives a home quarter 17,521 m^2 on average (Zoo Garden's home sector 16,949, round 8's square 16,384) and is the smallest round R1 where the canyon's bear and Mountain Turtle both fit with 5.0 m to spare (R1 = 152: 1.4 m). R2 = 296, not the proposed 288, because the four-den planets (candy, ice) have 5.0 m of slack over the 36 m border rule there against 2.9 m at 288 (section 2.2) |
| 2 | Quarters | NE Redrock Canyon, SE Blue Lake Meadow, SW Mushroom Forest, NW Chomper Swamp; the ids stay `east`, `south`, `west`, `north` | Each old region stays in the half-plane it had (the world is turned 45 degrees counter-clockwise); no save stores a region id; the 207 quoted uses of the four ids in 32 files of `src` and `tests` (some of them compass words, not region ids) keep working (section 2.4) |
| 3 | Planets around the outer ring, clockwise from north | **shadow, lava, ocean, jungle, toy, candy, ice, cloud**: a zigzag, **a deliberate deviation from "Zoo Garden's order"** (the numbered ring would be toy, candy, jungle, ice, ocean, lava, cloud, shadow); open question 2 shows the user both | A search of all 322,560 arrangements (`order.mjs`) finds that **between neighbouring planets** no hard seam is needed: every pair differs by exactly one difficulty step (total variation 8, the minimum any ring can have). The same arrangement is still the best possible on Zoo Garden's own landing levels (largest neighbour gap 6, the numbered ring's is 16: 2.5). **The hard step of this layout is the inner circle**, not the planet lines: +3 to +9 levels and x1.7 to x6.2 inside the 3.98 m ribbon (2.5). The numbered ring would add one x3.65 cliff between two planets on one axis |
| 4 | Level and power rise with radius inside a planet | difficulty `d + 0.8 t`, `t = (rho - R1) / (R2 - R1)`; one constant `RADIAL_STEP` | The planet's inner edge keeps round 8's multiplier (Lv N+ stays literally true); the rim is 18 to 42% stronger; titans stand near the rim (section 2.5) |
| 5 | Home regions | stay at power 1 (user decision from round 8) | unchanged |
| 6 | Borders | 36 runs, 4,787.1 m, one draw of 5,768 triangles (+4,832 over round 8's 936, accepted and budgeted in 4.4); planet-to-planet lines and the four home-to-home axis lines are full rainbow ribbons; the ward stays slim | section 2.8 |
| 7 | The world edge | a circle of radius R2, analytic distance and ray test, no notches, rim tiles by sector | section 2.9 |
| 8 | Field tiles | stay 64 m; 88 tiles touch the disc (52 whole, 36 straddle the edge); ground split by material class in groups, blocking kinds capped at 4 a tile | sections 4.1 to 4.4 |
| 9 | Saves | a `layout` field (absent = 1 = round 8, 2 = rings); a pure `migrateLayout`; the ward and the home ring are kept **except within a boss's wake radius of a home den** (den clearing + 24 m: 40 m, the Turtle 48 m), everything else is brought home, a car farther out is parked | **22.5% of the old playable positions are kept as they are** (2,992 of 13,312; 34.2% before the den rule); nothing but a position, a car and a heading changes (section 5) |
| 10 | Far view | `FAR_DEPTH = [24, 84]` | full at 84 m beyond the ward, the narrowest the home ring is (84.6 m), so a planet is always entered at full far view (section 6.5) |
| 11 | Builders | step 0 (A) then A, B, C, M, F; ports 4431 to 4437 | section 8 |

## 1. Which sections of the old spec hold and which this file replaces

| Old section | Status | Notes |
|---|---|---|
| 0 What the user asked | **Replaced** by section 0 here (rows for the ward, borders, maps, car, Home, camera, regions, prisons, reuse still hold) | |
| 1.1 The grid, 1.2 Map, 1.3 Cell size | **Replaced** by 2.1 to 2.4 | `CELL`, `GRID`, `HALF`, `GRID_IDS`, `cellOf`, `cellIdAt`, `squareOf` go (step 0 keeps shims, 8.2) |
| 1.4 The ward | **Holds unchanged**: `src/ward.mjs`, `SAFE`, `WARD_OUTLINE` (four vertices), `inSafeZone`, `wildDepth`, `VILLAGE`, the east gate, what stands inside. **Replaced:** `stripSide` and the split of the centre cell (2.6 here) | The ward is never typed as numbers in this round's code either |
| 1.5 Distances | **Replaced** by 2.7 (same names, arcs added; `RIM_REACH` stays 160 m) | |
| 1.6 The world edge | **Replaced** by 2.9 | Toast text, `EDGE_PAD` 2, the under-plane colour, the rim principle hold |
| 2 Rainbow borders | **Cross-section, material, scenery clearance, creature clearance, curtain idea hold**; **runs, counts, geometry, knots, trails replaced** by 2.8 | |
| 3.1 Home regions | **Holds** (names, grounds, mixes, bosses, base stats) except: orientation (2.4) and target counts (3.8 here) | |
| 3.2 The eight lands | **Holds** (names, grounds, commons, behaviours) except position (2.5) and target counts | |
| 3.3 Difficulty curve | **Replaced** by 2.5 | |
| 3.4 Level and stat power | **Holds**, plus the radial gradient (2.5): `POWER` table, factors for bosses, titans, coins unchanged | |
| 3.5 Scenery per tile | **Holds** (kits, glow bake, cover cards, the budget of at most 5 main draws a tile as the base) except the tile rules 4.1 to 4.4 here: shares by 9 x 9 sample without the one-region shortcut, a 4-kind cap, rim by sector | |
| 3.6 Creature art | **Holds unchanged** | |
| 3.7 Lights and sky | **Holds**, plus seam blending between neighbouring planets (2.7) | `LIGHT_FADE` 24 m |
| 3.8 Spawn budget | **Replaced** by 3.8 here (targets recomputed from the new areas) | |
| 3.9 Land features | **Holds** (what each feature is and does) except positions, the Beach's sea band and the seeded counts (3.4 here) | |
| 4.1 Positions | **Replaced** by 3.2 here | |
| 4.2 Stats, 4.3 Behaviour, 4.5 Rewards, 4.6 The lava dragon | **Hold unchanged** | The hard leash 30 m, the 24 m leash of the seven three-den bosses and the nest, the 36 m border rule |
| 4.4 What a small square means for a titan | **Holds** with the sums recomputed in 3.2 (every sum is larger) | |
| 5 Pandora, 6 What already exists | **Hold unchanged** | |
| 7.1, 7.2 Cause and save fields, 7.4 World changes | **Hold unchanged** (`PARK`, `placeVehicle`, `restoreVehicles`, `towVehicles`) | |
| 7.3 Parse and migration | **Holds** for every row except the position rows, which section 5 here replaces | |
| 8 Home | **Holds unchanged**: the 20 m magic threshold is measured by `wildDepth` and the ward did not move | |
| 9 Driving camera | **Holds** except `FAR_DEPTH` (6.5) | |
| 10 Minimap and Map window | **Holds** (mechanisms, markers, rim rule, presets, input, directory, caption pill) except terrain cache size, strokes, label anchors, zoom limits, pan clamp and the rim tables (section 6) | |
| 11 Builders, 12 Tests | **Replaced** by sections 8 and 7 here | |
| 13 Risks | **Partly holds**; section 9.2 lists what is new | |
| 14 Open questions | **Replaced** by section 9 | |
| 16 Prisons | **Holds** (who, how, what it looks like); the three cage spots are recomputed in 3.3 | |
| 17 Reuse | **Holds unchanged**; 17.3's "within 96 m of the square" becomes "within 96 m of the region" (`distanceToRegion`, 2.7) | |
| 18 Performance budget | **Holds** except the lines re-derived in section 4.6 | |

## 2. Geometry

### 2.1 The one constants block

```js
// src/regions.mjs, first lines. Everything else in the file, and every other file, is derived from these.
export const RING = Object.freeze({ R1: 160, R2: 296 });   // metres: the inner ring's outer radius, the outer ring's outer radius. The circle is centred on the origin.
export const RADIAL_STEP = 0.8;     // difficulty a planet gains from its inner arc to its rim (0 turns the gradient off), 2.5
export const ARC_STEP = 3;          // degrees between mesh points on an arc, 2.8
const GATE_END = 67;                // LITERAL: where the east gate's road ends and the east seam begins. tests/regions.test.mjs asserts it equals GATE_ROAD.x1 of field-layout.mjs. regions.mjs must NOT import field-layout.mjs (field-layout.mjs imports regions.mjs: the cycle throws a ReferenceError on load, as round 8's literal 67 avoided)
export const EDGE_PAD = 2;          // nobody walks or drives closer to the edge than this (as in round 8)
export const RIM_REACH = RING.R1;   // the minimap: dens this near ride its rim (160 m, as in round 8)
export const QUARTER_ID = Object.freeze(['east', 'south', 'west', 'north']);   // NE, SE, SW, NW: bearings [0,90) [90,180) [180,270) [270,360)
export const SECTOR_ID = Object.freeze(['shadow', 'lava', 'ocean', 'jungle', 'toy', 'candy', 'ice', 'cloud']);   // clockwise from north, 45 degrees each
```

Tuning rule: change `RING` and nothing else (`GATE_END` is the gate's, not the ring's). Den rows are written as `R1 + a` and `R2 - b` (3.2), so the dens follow the circles. **The window in which every den rule of 3.1 holds** (`window2.mjs`, R1 in steps of 4 m, depth `R2 - R1` in steps of 8 m): **R1 from 160 to 176 and `R2 - R1` from 136 to 160.** Outside it a rule fails: R1 = 156 puts the Mountain Turtle 52.5 m from the ward line (rule 55 m), and a depth of 128 puts the candy and ice dens 53.8 m apart (rule 56 m) with these rows. The solver of 2.2 finds layouts at smaller depths (slack 2.9 m at 128), but the rows would have to be solved again by hand. `tests/den-rows.test.mjs` checks the whole window and `tests/regions.test.mjs` runs a copy with `R1 = 168, R2 = 320` (7.1). The features, the targets and the stands of section 3 are for R1 = 160, R2 = 296 only.

### 2.2 Radii, with the computation

Inputs: the ward rectangle `SAFE` x -56.5...56.5, z -50...41.5 (10,339.5 m^2); its farthest corner from the origin is 75.45 m (the two northern corners; the southern two are 70.10 m); walking 4.8, cruise 19.2, top 38.4 m/s.

**The gap between the ward and the inner circle** (`radii.mjs`, R1 = 160): along a bearing the ward is left at 41.5 m (due south) to 75.44 m (bearing 48.5, the north-east corner), so the ring is **84.6 m deep at the corners and 103.5 m (west, east), 110.0 m (north) and 118.5 m (south) on the sides.** A creature may stand from 2 m outside the ward line to 6 m inside the arc (`SPAWN.line`, `SPAWN.gridLane`): 76.6 m of standing room at the narrowest point, 110.5 m at the widest.

**R1.** Areas (`radii.mjs`; the old home square was 16,384 m^2, Zoo Garden's home sector is 16,949 m^2):

| R1 | Inner ring minus ward | One home quarter | Against the old square | Ring depth, narrowest to widest | Canyon pair fits? (`homefit.mjs`: bear 50 m and turtle 55 m from the ward, 36 m from every border, 31 m from the trail, 67.2 m apart; slack in metres) |
|---|---|---|---|---|---|
| 144 | 54,805 | 13,701 | 0.836 | 68.6 to 102.5 | no (-2.0) |
| 152 | 62,244 | 15,561 | 0.950 | 76.6 to 110.5 | yes, 1.4 |
| **160** | **70,085** | **17,521** | **1.069** | **84.6 to 118.5** | **yes, 5.0** (bear 69.5 degrees, rho 119; turtle 20.5 degrees, rho 118) |
| 168 | 78,329 | 19,582 | 1.195 | 92.6 to 126.5 | yes, 8.4 |

The four quarters differ because the ward sits unevenly: NE 17,281, SE 17,761, SW 17,761, NW 17,281 m^2 (`check-world.mjs`). **Decision R1 = 160:** the smallest round value whose canyon pair keeps 5 m in hand, and the nearest to the reference (17,521 against 16,949). 168 would make the power-1 ring 19% bigger than round 8's squares and move the first planet 8 m farther for no gain.

**R2.** The hardest fit is a four-den planet (candy, ice: three bosses and a titan, 56 m apart, each 36 m from every border). Best of 60 to 200 hill-climbs of the smallest margin (`denfit.mjs`, `denfit2.mjs`, uniform 36 m rule):

| R1 | R2 | Planet area | World area | Four dens, slack | Three dens (lava), slack | Boss + titan (73.5 m), slack |
|---|---|---|---|---|---|---|
| 160 | 272 | 19,000 | 232,428 | **-1.6 (does not fit)** | 3.0 | 10.2 |
| 160 | 288 | 22,519 | 260,576 | 2.9 | 7.3 | 13.5 |
| **160** | **296** | **24,354** | **275,254** | **5.0** | **9.5** | **15.2** |
| 160 | 304 | 26,239 | 290,333 | 7.1 | 11.7 | 16.8 |
| 160 | 320 | 30,159 | 321,699 | 11.3 | 16.3 | 20.1 |

**Decision R2 = 296** (the brief's starting 288 leaves 2.9 m, too little for ponds, pools and rails to share the den zone). The planet is 136 m deep (round 8's square: 128). The world is 592 m across (round 8: 640) but covers **275,254 m^2 against 212,992** (+29%) because a circle has no empty cells; one planet is 24,354 m^2 against 16,384 (+49%), 0.354 of a Zoo Garden planet disc (68,813). The performance cost of the extra ground is section 4.

**Ratios against Zoo Garden** (`ROUND8-INVENTORY.md`: a home sector is 16,949 m^2, a planet a disc of 68,813 m^2): the reference's planet is 4.06 times its home sector; the ring's is 1.39 times (24,354 / 17,521), round 8's was 1.00 (equal squares). The ring is therefore closer to the reference in shape and still much smaller in size, which is the user's standing request (old 1.3).

**The old dens and their clearances.** Round 8's rows kept every den 36 m from every grid border and 56 m from every other, put the three-den planets' dens at the corners of a 56 m box and the home bosses 95 to 111 m beyond the ward line. All 26 positions change (3.2). Both rules are kept, and so are the 16 m and 24 m creature clearings and the 30 m and 24 m leashes; the margins over the 36 m rule are 2.1 m for the four home bosses (38.1 m) and 4.9 m or more for every planet den (40.9 m the smallest, 45.6 m the largest), and the closest pair of dens is 59.9 m (cake and gingerbread) against the 56 m rule. Where the home bosses stand relative to the ward is in the paragraph after the travel table.

**Travel** (`misc.mjs`; top-speed time = cruise to the footprint's east side, the 3.2 s run-up, then 38.4 m/s, the formula of old 1.3):

| To (east axis from the centre) | Distance | Walk | Cruise | Top |
|---|---|---|---|---|
| ward east side | 56.5 | 11.8 s | 2.9 s | 2.9 s |
| inner circle R1 | 160 | 33.3 s | 8.3 s | 6.4 s |
| rim R2 | 296 | 61.7 s | 15.4 s | 10.0 s |
| round 8 reference: far side of a home square | 192 | 40.0 s | 10.0 s | 7.2 s |
| round 8 reference: outer edge of a tip planet | 320 | 66.7 s | 16.7 s | 10.6 s |

From the ward line: the King Bear's den is 54.0 m out (11.3 s on foot), the Treant 69.0, the Crocodile King 60.5, the Mushroom King 69.0 (round 8: 95 to 111 m outside the ward; the home bosses are 54 to 69 m out now, because the circle brings the rim of the home ring in to 160 m); the nearest planet den, the Cake King, is 131.8 m out (27 s on foot, 6.9 s at cruise); the farthest, the Death Flower Rafflesia in the jungle, 203.0 m.

### 2.3 Polar geometry and tie rules

One origin (0, 0). `rho = hypot(x, z)`; `bearing = atan2(x, -z)` in degrees, 0 to 360. A point is classified by exact comparisons of x and z, never by `atan2`, so every tie is exact (`world.mjs` in Appendix A; `check-world.mjs` compares the predicates against the bearing on 1,746,453 points and finds **0 disagreements**).

```js
export function quarterIndex(x, z) { if (x >= 0 && z < 0) return 0; if (x > 0 && z >= 0) return 1; if (x <= 0 && z > 0) return 2; return 3; }   // NE SE SW NW
export function sectorIndex(x, z) {            // 0..7, clockwise from north, by quarter and the diagonal inside it
  switch (quarterIndex(x, z)) { case 0: return x < -z ? 0 : 1; case 1: return x > z ? 2 : 3; case 2: return -x < z ? 4 : 5; default: return x < z ? 6 : 7; }
}
export function regionAt(x, z) {
  if (inSafeZone(x, z)) return 'village';                       // the ward first, exactly as in round 8
  const r2 = x * x + z * z;
  if (!(r2 < RING.R2 * RING.R2)) return null;                   // outside the world, and NaN: written as `!(<)` so a non-finite point is outside (round 8's NaN gave null too)
  return r2 < RING.R1 * RING.R1 ? QUARTER_ID[quarterIndex(x, z)] : SECTOR_ID[sectorIndex(x, z)];
}
```

**The tie rules, all of them:**

| Border | A point exactly on it belongs to | Checked point (`check-world.mjs`) |
|---|---|---|
| Any radial line (axis or diagonal) | the region that **begins there going clockwise from north**: intervals of bearing are half-open `[start, end)` | |
| North axis, rho < R1 | NE `east` | (0, -100) is `east` |
| East axis | SE `south` (inner), `ocean` (outer) | (100, 0) `south`; (200, 0) `ocean` |
| South axis | SW `west` (inner), `toy` (outer) | (0, 100) `west`; (0, 200) `toy` |
| West axis | NW `north` (inner), `ice` (outer) | (-100, 0) `north`; (-200, 0) `ice` |
| North axis, rho > R1 | `shadow` | (0, -200) `shadow` |
| Diagonals, rho > R1 | the sector that starts there: NE diagonal `lava`, SE `jungle`, SW `candy`, NW `cloud` | (170, -170) `lava`; (170, 170) `jungle`; (-170, 170) `candy`; (-170, -170) `cloud` |
| The inner circle, rho = R1 exactly | the **outer** ring | (0, -160) `shadow`; (0, -159.999) `east` |
| The outer circle, rho = R2 exactly | **outside the world** (null) | (296, 0) null; (295.999, 0) `ocean` |
| The ward line | outside the ward (round 8's rule: `inSafeZone` is strict) | (56.5, -10) `east`; (56.5, 10) `south`; (10, 41.5) `south`; (-10, 41.5) `west`; (-56.5, 10) `west`; (-56.5, -10) `north`; (-10, -50) `north`; (10, -50) `east` |
| The origin | inside the ward | |
| A non-finite point (NaN, Infinity) | **outside the world** (null) | `regionAt(NaN, NaN)` is null; `edgeDepth(NaN, NaN)` is Infinity: blocked, as in round 8 (2.9) |

Round 8's rule ("a point on a line belongs to the +x or +z side") is dropped: it is not rotation-symmetric, and a clockwise rule is one sentence.

### 2.4 Names: how the old ids map to the quarters, and what everything calls them

The world is turned 45 degrees counter-clockwise. Every home region keeps the half-plane it had (the canyon was east: it is now north-east, which is still east), and the reference's clockwise order (canyon, meadow, forest, swamp: `cute_game/src/environments.ts` `zoneAt`, `cute_game/src/minimap.ts`) is kept.

| Id (unchanged) | Banner and caption | Reference id | Quarter | Bearings | Bisector (the trail) | d / Lv / boss Lv | Touches planets |
|---|---|---|---|---|---|---|---|
| `east` | Redrock Canyon | `canyon` | NE | [0, 90) | 45 | 3 / 7 / 13 | shadow, lava |
| `south` | Blue Lake Meadow | `meadow` | SE | [90, 180) | 135 | 1 / 1 / 7 | ocean, jungle |
| `west` | Mushroom Forest | `forest` | SW | [180, 270) | 225 | 1 / 1 / 7 | toy, candy |
| `north` | Chomper Swamp | `swamp` | NW | [270, 360) | 315 | 2 / 4 / 10 | ice, cloud |

- **The ids do not change.** A save stores no region id: `position`, `vehicles`, `riding`, `heading`, `defeated` (creature types), `friends` (`sprout`, `clover`, `pepper`) and `cleared`/`planted` (village tree indices) are the only world-shaped fields (`parseSave`). The banner, the caption pill, the zone chip and both maps print `REGION[id].name`, never the id. The 207 quoted uses of `'west'`, `'north'`, `'south'`, `'east'` in 32 files of `src` and `tests` (some are compass words, not region ids) keep working; renaming them to `ne`, `se`, `sw`, `nw` would touch every table keyed by region (`DECOR`, `CARDS`, `MIX`, `LIGHTS`, `GROUND`, `FEATURES`, `TARGET`, `DENSITY`) for no player-visible gain. The wart is that `'west'` is in the south-west; `REGION[id]` gains `quarter` (`'sw'`) and `bearings` (`[180, 270]`) so a reader never has to guess.
- **Where a test said "west" and meant the direction** (`STAND = { west: [-128, 0], ... }` in `tests/lands-browser.mjs`, "the east trail", "x = 192"), it now names the region's stand point (3.5) or a bearing. "The east gate" stays the name of the village's gate at (55.4, 0): it belongs to the village, and its spur (x 54.5 to 65.5, z within 2.5) lies on the line between `east` (z < 0) and `south` (z >= 0): banners ignore a flip there and creatures keep off the strip (3.7).
- The user's picture numbers nothing in the red ring. Round 8's open question about numbering "by direction or by number" (old 3.1) is therefore moot: the quarters are named, not numbered.

Distances from a quarter's ward corner to the ward in each bearing are in 2.2; the way each quarter meets the ward is in 2.6.

### 2.5 The eight sectors, which planet goes where, and how difficulty rises

**Which planet is in which sector.** `order.mjs` tries every assignment of the eight planets to the eight sectors (8! = 40,320) against the eight ways of laying the four home regions round the ring (four rotations, two mirrors): 322,560 layouts, of which 241,920 keep every planet at least as hard as the quarter it touches (the label rule of old 3.3). The score, in this order: the largest difference in difficulty between neighbouring sectors; the total variation round the ring; thematic clashes (hot beside cold, 10 each; lava beside the sea, 1); the largest label gap between a planet and its quarter; the sum of those gaps.

- **No hard seam between planets is needed.** The best layouts have a largest neighbour step of **1** and a total variation of **8**, which is the least any ring can have (up and down the range 2 to 6 once: 2 x (6 - 2)). Difficulty goes 2, 3, 4, 5, 6, 5, 4, 3 and back to 2. The brief assumed that "because a circle has no end, one seam must exist where the hardest meets the easiest": that is true only if the planets are laid in their numbered order, 1 to 8 round the circle (`order.mjs`: that sweep has a largest step of 4, with the total variation still 8; the best layout that has such a seam still has one of 4). The zigzag puts the easiest planet (the Toybox, d 2) opposite the hardest (the Night Land, d 6) and makes difficulty climb both ways from the Toybox. **This is a deviation from the brief's reading "the eight planets in Zoo Garden's order"**, taken on purpose and put to the user as open question 2; the comparison, with the numbered ring drawn out, follows the first-border table.
- **32 layouts tie at the optimum** (4 for each of the 8 home orders). The home order that keeps every region in its old half-plane is canyon NE, meadow SE, forest SW, swamp NW (2.4); it has four ties:

| | NNE | ENE | ESE | SSE | SSW | WSW | WNW | NNW |
|---|---|---|---|---|---|---|---|---|
| A | shadow | cloud | ice | candy | toy | jungle | ocean | lava |
| B | shadow | cloud | ice | jungle | toy | candy | ocean | lava |
| C | shadow | lava | ocean | candy | toy | jungle | ice | cloud |
| **D (chosen)** | **shadow** | **lava** | **ocean** | **jungle** | **toy** | **candy** | **ice** | **cloud** |

  A puts the hot Ember Fields beside the swamp and the ice beside the meadow, and keeps the canyon away from the lava; B and C put the jungle beside the ice. D is the only one in which the canyon (the hot home region) touches the lava and the Night Land, the meadow touches the sea and the jungle (the Blue Lake beside a beach and a rainforest), the forest touches the Toybox and the Candy Land, and no tropical land touches a frozen one. The single clash left in D is the lava beside the sea (steam), the minimum any layout has.

```
                         north (bearing 0)
              cloud      |      shadow          NNW  |  NNE
                  (d5)   |   (d6)
        ice              |              lava    WNW        ENE
        (d4)             |              (d5)
  west ------------- [ village ] ------------- east        (the two axes and the two diagonals
        candy            |              ocean               are the borders; red ring = four
        (d3)             |              (d4)                quarters, yellow ring = these eight)
                  toy    |   jungle             WSW        ESE
                  (d2)   |   (d3)
                         south (bearing 180)               SSW  |  SSE
```

| Sector | Bearings | Id | Planet | d / Lv / boss Lv | Stars | Touches quarter | Neighbours (counter-clockwise, clockwise) |
|---|---|---|---|---|---|---|---|
| S0 NNE | [0, 45) | `shadow` | Planet 8, Night Land | 6 / 16 / 22 | 5 | NE Canyon | cloud, lava |
| S1 ENE | [45, 90) | `lava` | Planet 6, Ember Fields | 5 / 13 / 19 | 4 | NE Canyon | shadow, ocean |
| S2 ESE | [90, 135) | `ocean` | Planet 5, Shell Beach | 4 / 10 / 16 | 4 | SE Meadow | lava, jungle |
| S3 SSE | [135, 180) | `jungle` | Planet 3, Wild Jungle | 3 / 7 / 13 | 3 | SE Meadow | ocean, toy |
| S4 SSW | [180, 225) | `toy` | Planet 1, Toybox Land | 2 / 4 / 10 | 2 | SW Forest | jungle, candy |
| S5 WSW | [225, 270) | `candy` | Planet 2, Candy Land | 3 / 7 / 13 | 3 | SW Forest | toy, ice |
| S6 WNW | [270, 315) | `ice` | Planet 4, Frost Land | 4 / 10 / 16 | 4 | NW Swamp | candy, cloud |
| S7 NNW | [315, 360) | `cloud` | Planet 7, Cloud Meadow | 5 / 13 / 19 | 4 | NW Swamp | ice, shadow |

Names, grounds, accents, commons and behaviours are old 3.2, unchanged.

**What the first border out of each home region now costs** (home regions play at power 1; the multiplier is the planet's value at its inner edge; round 8 is the right-hand column):

| Quarter (label d) | Counter-clockwise planet | Clockwise planet | Round 8 neighbours |
|---|---|---|---|
| Canyon (3) | shadow +3 labels, x6.2 | lava +2, x4.8 | ocean x3.6, cloud x4.8, shadow x6.2 |
| Meadow (1) | ocean +3, x3.6 | jungle +2, x2.6 | candy x2.6, **cloud x4.8 and lava x4.8** (the flaw the user is fixing) |
| Forest (1) | toy +1, x1.7 | candy +2, x2.6 | toy x1.7, candy x2.6, jungle x2.6 |
| Swamp (2) | ice +2, x3.6 | cloud +3, x4.8 | toy x1.7, ocean x3.6, ice x3.6 |

The label gaps sum to 18, the least any layout allows (`order.mjs`). The Lv 1 meadow now touches Lv 10 and Lv 7 (x3.6, x2.6) instead of two Lv 13 lands (x4.8); the Lv 1 forest touches Lv 4 and Lv 7. Between neighbouring planets at the same radius the multiplier ratio is at most **x1.53** (toy and candy, toy and jungle), 1.38 (candy and ice, ocean and jungle), 1.33, 1.29 (`gradient.mjs`); across the hard seam of the numbered sweep it would be x3.65 (the Night Land's 6.2 against the Toybox's 1.7).

**The two rings, side by side (open question 2).** Clockwise from north-north-east, each planet with its inner-edge level:

| | NNE | ENE | ESE | SSE | SSW | WSW | WNW | NNW |
|---|---|---|---|---|---|---|---|---|
| **Zigzag (built)** | Night Land 16 | Ember Fields 13 | Shell Beach 10 | Wild Jungle 7 | Toybox 4 | Candy Land 7 | Frost Land 10 | Cloud Meadow 13 |
| **Numbered, Zoo Garden's order (option N)** | Cloud Meadow 13 | Night Land 16 | Toybox 4 | Candy Land 7 | Wild Jungle 7 | Frost Land 10 | Shell Beach 10 | Ember Fields 13 |

Option N is the best placement of the numbered sequence toy, candy, jungle, ice, ocean, lava, cloud, shadow (`order3.mjs`: 8 rotations, both directions, the home order fixed as in 2.4): its label gap sum is 18 as well, and it has the same single clash (lava beside the sea). **Its one hard seam sits on the east axis (bearing 90), between the Canyon and the Meadow**: the Night Land (x6.2) touches the Toybox (x1.7), a **x3.65** jump across one 3.98 m ribbon. No other placement of the numbered sequence moves the seam off a quarter line or makes it smaller; the seam has to sit somewhere, and the east axis keeps it away from the Lv 1 Forest's and the Lv 4 Swamp's borders. Every other neighbour pair in option N differs by x1.53 at most.

| What the player meets | Zigzag (built) | Option N (numbered) |
|---|---|---|
| Walking out north-north-east | Night Land, Lv 16 (x6.2) | Cloud Meadow, Lv 13 (x4.8) |
| Walking out south-south-west | Toybox, Lv 4 (x1.7) | Wild Jungle, Lv 7 (x2.6) |
| Largest jump between two planets | x1.53 (toy against candy, toy against jungle) | **x3.65** (Night Land against Toybox) |
| First borders out of the Lv 1 Meadow | Shell Beach x3.6, Wild Jungle x2.6 | Toybox x1.7, Candy Land x2.6 |
| First borders out of the Lv 1 Forest | Toybox x1.7, Candy Land x2.6 | Wild Jungle x2.6, Frost Land x3.6 |
| First borders out of the Lv 4 Swamp | Frost Land x3.6, Cloud Meadow x4.8 | Shell Beach x3.6, Ember Fields x4.8 |
| First borders out of the Lv 7 Canyon | Night Land x6.2, Ember Fields x4.8 | Cloud Meadow x4.8, Night Land x6.2 |

In plain words: with the zigzag, a player walking out north-north-east meets Lv 16 and one walking out south-south-west meets Lv 4; difficulty depends on **direction as well as distance** in both rings (the world has eight directions and four home regions, and a planet's difficulty is one number), and the zigzag climbs smoothly both ways from the Toybox, where option N climbs all the way round and falls off a cliff at one line. Option N is the better fit to "Zoo Garden's order" as a sequence; the zigzag is the better fit to "the harder map a little further away" with no wall between two planets.

**Does the result survive Zoo Garden's own levels?** The first search used round 8's difficulty steps, which tie three pairs (candy = jungle, ice = ocean, lava = cloud) and compress the reference's landing levels (4, 6, 8, 10, 12, 14, 16, 20; `cute_game/src/content.ts`, `PLANET_FACTS`) to Lv 4, 7, 10, 13, 16. Re-run on three scales (`order2.mjs`, all 40,320 arrangements each):

| Scale | Largest neighbour gap: zigzag (built) | best of all arrangements | numbered ring |
|---|---|---|---|
| Round 8 steps, ties kept (toy 2, candy = jungle 3, ice = ocean 4, lava = cloud 5, shadow 6) | 1 | 1 | 4 |
| Round 8 steps, ties broken by Zoo Garden's levels (jungle 3.5, ocean 4.5, cloud 5.5) | 1.5 | 1.5 | 4 |
| Zoo Garden's landing levels, 4 to 20 | 6 | 6 | 16 |

On every scale the zigzag is as good as any arrangement can be and the numbered ring's seam is 2.7 to 4 times larger, so the result is not an artefact of the ties. What the claim does **not** say: on the reference's own levels the zigzag still has gaps of 6 (the Night Land beside Ember Fields, Frost Land beside Cloud Meadow) and 4; "no hard seam" means "the least that exists", and it holds on Willowmere's compressed labels (Lv 7, 10, 13, 16 against the reference's 8, 12, 16, 20), which are round 8's and are not re-argued here. The rule "every planet is at least as hard as the quarter it touches" rests on the same labels.

**Default.** The zigzag is built, as an explicit deviation, because the user asked for difficulty that rises away from the village and the numbered ring adds a x3.65 wall between two planets on one axis. Switching to option N later costs about half a day of builder B's time and nothing in saves, the ward, the maps or the borders: `SECTOR_ID` is reordered; every den row is a `(region, angle)` and moves with its sector by itself; what must be solved again are the features (3.4), the stands (3.5), the cage check (3.3) and the kit and tile tables (4.1, 4.5), because a 45 degree turn is not exact on a 0.5 m grid and the 32 m creature-cell seams are not rotation-symmetric (re-run `dens.mjs`, `features.mjs`, `stands2.mjs`, `tiles.mjs`, `window.mjs`). This was not built.

**Difficulty rises with radius inside a planet.** The user wants the harder land farther out; the ring puts every planet at 160 to 296 m, so the rise is also made inside each one. In the reference every point of a planet has one multiplier; Willowmere's planet is 136 m deep, so it does not need to.

```js
// src/regions.mjs
export const difficultyAt = (x, z) => { const r = REGION[regionAt(x, z)]; if (!r || r.kind !== 'land') return r ? r.difficulty : 0; return r.difficulty + RADIAL_STEP * clamp01((hyp(x, z) - RING.R1) / (RING.R2 - RING.R1)); };
export const levelAt = (x, z) => { const r = REGION[regionAt(x, z)]; return !r ? 0 : r.kind === 'land' ? Math.max(1, Math.round(3 * difficultyAt(x, z) - 2)) : r.level; };   // home regions and the village: their label
// src/power.mjs (NEW, pure, NO imports: POWER and powerOf move here from region-mix.mjs, which re-exports POWER so every existing import still loads)
export const POWER = Object.freeze([1, 1, 1.7, 2.6, 3.6, 4.8, 6.2]);
export const powerOf = d => d >= 6 ? POWER[6] + (d - 6) * (POWER[6] - POWER[5]) : POWER[Math.floor(d)] + (POWER[Math.floor(d) + 1] - POWER[Math.floor(d)]) * (d - Math.floor(d));   // linear between the table's rows; above 6 the last step (+1.4 a unit) continues
// src/region-mix.mjs (imports difficultyAt from regions.mjs, POWER and powerOf from power.mjs)
export const powerAt = (x, z) => { const r = REGION[regionAt(x, z)]; if (!r || r.kind !== 'land') return 1; return powerOf(difficultyAt(x, z)); };
```

- `RADIAL_STEP = 0.8` is **less than 1 on purpose**: a planet's rim (d + 0.8) stays below the next-harder planet's inner edge (d + 1), so the labels keep their order. The inner edge is exactly round 8's number, so "Lv N+" on the banner and the Map is literally true and every border figure of old 3.3 holds for the first metre of a planet.
- **The import graph is `power.mjs` <- `regions.mjs` <- `region-mix.mjs`, with no cycle.** `regions.mjs` gives each den its power with `powerOf` (from `power.mjs`) and never imports `region-mix.mjs`; `region-mix.mjs` imports `regions.mjs` (for `difficultyAt`) and `power.mjs`. The first draft had `regions.mjs` computing den power with `POWER` while `region-mix.mjs` imported `regions.mjs`: a cycle that works only when `regions.mjs` is entered first and throws a ReferenceError (the `POWER` table in its temporal dead zone) when `region-mix.mjs` is, which `tests/region-mix.test.mjs` and `scripts/tune-density.mjs` both do. `tests/seams.test.mjs` asserts the four files form no cycle (each is imported alone in a fresh process). `power.mjs` is a new file of builder B's content, created in step 0.
- **`wildCell` (`wilds.mjs`, builder B) is changed on exactly two lines.** The den branch pushes `power: REGION[d.region].kind === 'land' ? POWER[REGION[d.region].difficulty] : 1`; it becomes `power: d.power` (the den row's own, computed once at its position, 3.2). The slot branch pushes `level: info.level` and `power: info.kind === 'land' ? POWER[info.difficulty] : 1`; they become `levelAt(x, z)` and `powerAt(x, z)` of the slot's own position (old 3.4 already carries both per instance). `wilds.mjs` no longer reads `POWER[...difficulty]` anywhere. **Coins stay on the region's inner-edge power**: `pandora.mjs` `defeatCoins` (a frozen combat file) still reads `POWER[info.difficulty]`, so a rim creature, with up to x1.42 the stats, pays the inner-edge coins; this mismatch is accepted and stated, and a titan's coins follow its own power through `titanStats`, as before. The exact-power reads of `tests/titans.test.mjs`, `bosses.test.mjs` and `pandora.test.mjs` change (B).
- **Numbers** (`gradient.mjs`; the table's rows are 1, 1, 1.7, 2.6, 3.6, 4.8, 6.2 for d = 0 to 6):

| Planet | d | Inner edge: power, Lv | Rim: d, power, Lv | Rim over inner edge |
|---|---|---|---|---|
| toy | 2 | x1.70, Lv 4 | 2.8, x2.42, Lv 6 | x1.42 |
| candy, jungle | 3 | x2.60, Lv 7 | 3.8, x3.40, Lv 9 | x1.31 |
| ice, ocean | 4 | x3.60, Lv 10 | 4.8, x4.56, Lv 12 | x1.27 |
| lava, cloud | 5 | x4.80, Lv 13 | 5.8, x5.92, Lv 15 | x1.23 |
| shadow | 6 | x6.20, Lv 16 | 6.8, x7.32, Lv 18 | x1.18 |

  The titans stand near the rim (3.2), so they carry the top of the range: the Void Eye x6.96, the Inferno Scorpion x5.55 (round 8: x6.2 and x4.8). To make the planets flat again set `RADIAL_STEP = 0`; every number in this section then equals round 8's. This is open question 3.

**The hard step is the inner circle, not the planet lines.** The planet ring is smooth (clockwise labels 16, 13, 10, 7, 4, 7, 10, 13; largest step 3 levels, total variation 24 levels; between neighbours at the same radius the multiplier differs by x1.53 at most). The step from a quarter into a planet is large and happens inside the 3.98 m ribbon. Measured 0.01 m either side of each arc (`review.mjs`):

| Planet | Quarter it is entered from | Level, home to planet | Power, home to planet | Levels gained |
|---|---|---|---|---|
| shadow | east (Canyon) | 7 to 16 | x1 to x6.20 | **+9** |
| lava | east (Canyon) | 7 to 13 | x1 to x4.80 | +6 |
| ocean | south (Meadow) | 1 to 10 | x1 to x3.60 | **+9** |
| jungle | south (Meadow) | 1 to 7 | x1 to x2.60 | +6 |
| toy | west (Forest) | 1 to 4 | x1 to x1.70 | +3 |
| candy | west (Forest) | 1 to 7 | x1 to x2.60 | +6 |
| ice | north (Swamp) | 4 to 10 | x1 to x3.60 | +6 |
| cloud | north (Swamp) | 4 to 13 | x1 to x4.80 | **+9** |

Round 8's flaw, which the user is fixing, was Lv 1 beside Lv 13 (+12, x4.8): it is better but **not removed**: the Lv 1 Meadow now touches Lv 10 (Shell Beach, +9, x3.6), and the Lv 4 Swamp touches Lv 13 (Cloud Meadow, +9, x4.8). The cliff is the price of two decisions that stay: the home regions play at power 1 (round 8, the user's), and a planet's inner edge keeps round 8's number so that "Lv N+" is literally true (the 2.5 gradient only goes up from there). An optional ramp (power rising over the first 24 m inside a planet with the smoothing of `LIGHT_FADE`) would make the cliff walkable but would make "Lv N+" false for those 24 m and shift every creature there; it is **not built** (open question 7, default off).

**What "difficulty rises with distance" does and does not guarantee.**
- **Along every ray from the village, level and power never fall as the distance grows**: 0 violations on 720 rays of 0.5 degrees (`review.mjs`; the home ring is flat at its label, and the step at R1 and the gradient only go up).
- **By power, the rings are ordered**: every point of a home region is x1; every point of a planet is x1.70 or more (the Toybox's inner edge), up to x7.32 at the Night Land's rim.
- **By label, it is not a ring-by-ring guarantee.** The Canyon is labelled Lv 7 and its Bear and Turtle are Lv 13 (at rho 121.9 and 117.0), above the Toybox, whose inner edge is Lv 4 and rim Lv 6, whose Robot is Lv 11 (rho 204.1) and Clock titan Lv 12 (252.1). The lowest level on the map at rho 170 is 4 (the Toybox, bearing 180.5), at rho 200 it is 5, at rho 250 it is 6, at 290 it is 6; all below the Canyon's 7. Only two planet dens are at or below the home ring's strongest den (13): the Robot, 11, and the Clock titan, 12. The home labels are round 8's and the Toybox's creatures hit harder than their label suggests (x1.7 to x2.42 base stats against the Canyon's x1), so the order holds by what the creatures do and not by the number printed. A reader comparing the banner and the Map sees "Redrock Canyon Lv 7+" above "Toybox Land Lv 4+"; whether to lower the Canyon's printed label to match is open question 6, default no.

### 2.6 The ward and the four quarters: the strip rule is replaced

Round 8 split the rest of the centre cell among the home regions with `stripSide` (the trapezoids between each ward corner and the cell's corner). **That rule, the centre cell, `squareOf('village')` and the four 7.5 to 22.5 m strips go.** The quarters run up to the ward line, split by the two axes exactly as the region rule of 2.3 says. `regionAt` inside the ward is `'village'`, as before.

| Quarter | Ward line it touches | Length | Area outside the ward |
|---|---|---|---|
| NE `east` | north side x 0 to 56.5, east side z -50 to 0 | 56.5 + 50.0 = 106.5 m | 17,281 m^2 |
| SE `south` | east side z 0 to 41.5, south side x 0 to 56.5 | 41.5 + 56.5 = 98.0 m | 17,761 m^2 |
| SW `west` | south side x -56.5 to 0, west side z 0 to 41.5 | 56.5 + 41.5 = 98.0 m | 17,761 m^2 |
| NW `north` | west side z -50 to 0, north side x -56.5 to 0 | 50.0 + 56.5 = 106.5 m | 17,281 m^2 |

The four lengths sum to 409.0 m, the ward's perimeter. The ward's four axis points are N (0, -50), E (56.5, 0), S (0, 41.5), W (-56.5, 0). The ward's own region area is unchanged (10,340 m^2). The four tiles round the origin each hold the village and exactly **one** quarter (the quarter's share is 0.31 to 0.41 of the tile: `centre.mjs`), where round 8's centre tiles held the village and two or three strips; the homestead's tiles get simpler, not heavier.

`VILLAGE`, `GATE`, `GATE_ROAD`, `HOME_SPOT` (0, -8), `PARK` (jeep (46, -15), bike (5, -8)), the lots, the lanes, the Supermarket, the pond and the 173 village trees are inside the ward and are not touched (the "Nobody" row of old 11.2 still holds).

### 2.7 Distances

All of these live in `src/regions.mjs`, keep their round 8 names and meaning, and use `hyp` from `src/hyp.mjs` instead of `Math.hypot` in anything called per frame (the fix pass's rule: two-argument `Math.hypot` allocates in V8).

| Name | Now |
|---|---|
| `BORDER_RUNS`, `RUNS_OF` | runs are `{type: 'seg' \| 'arc', kind, half, left, right, length, ...}`; a seg has `ax, az, bx, bz, nx, nz`; an arc has `r, b0, b1` (bearings, clockwise, `b1 > b0`). `left` is the region on the side the normal points to; for an arc the normal points **outward**. 2.8 lists all 36 |
| `runDistance(x, z, run)` | exported (round 8 had a private copy in `fields.mjs`): to a segment as before; to an arc, `abs(rho - r)` when the bearing is inside `[b0, b1)`, else the distance to the nearer end point |
| `borderDistance(x, z)` | inside the world: the least `runDistance` over `RUNS_OF[regionAt]` (any kind). Outside: `edgeDepth`-free metres to the disc, `max(0, rho - R2)` |
| `gridBorderDistance(x, z)` | the same over every run except kind `'ward'`: `'shared'`, `'seam'`, `'sector'`, `'outer'`. Infinity in the village. Drives the 6 m creature lane, the den rule and every "from a border" test |
| `homeBorderDistance(x, z)` | over `'shared'` arcs only: how deep a point of a planet is from the home ring. Infinity elsewhere. Drives the home crossfade of light and night |
| `sectorBorderDistance(x, z)` | **new**: over `'sector'` radials only (planet against planet). Infinity in a quarter and the village |
| `edgeDistance(x, z)` | `max(0, R2 - rho)` (exact: no notches) |
| `inWorld(x, z, pad = 0)` | `x*x + z*z < (R2 - pad)^2` |
| `distanceToRegion(id, x, z)` | **new**: 0 inside; else the least `runDistance` over `RUNS_OF[id]` (it replaces the rectangle test `beyondRect(squareOf(id), x, z)` in `wilds-draw.mjs` `near` (`KIT_REACH` 96 m) and `land-view.mjs` `away`) |
| `shapeOf(id)` | **new**: `{kind: 'ward' \| 'quarter' \| 'sector', r0, r1, b0, b1, x0, x1, z0, z1, cx, cz, label}`. `x0..z1` is the region's bounding box (the corners of the annular sector and the points of its outer arc at multiples of 90 degrees); `cx, cz` and `label` are the anchor `(rho, bearing)` = (112, bisector) for a quarter and (228, middle of the sector) for a planet. The seeded scatter in `land-features.mjs` draws in the box and keeps points with `regionAt === id` (acceptance 64% for a planet sector and 68 to 69% for a quarter, `bbox.mjs`) |
| `squareOf(id)` | **step 0 keeps it as a deprecated alias of `shapeOf`** so every reader loads; the last reader's owner deletes it and `tests/seams.test.mjs` asserts none is left (8.2) |
| `inWilds`, `trailOffset`, `trailDistance` | `inWilds` unchanged; trails in 2.8 |

**Seam blending of light and night (extends old 3.7).** Round 8 faded a planet's light in over 24 m from the home region it touches (`LIGHT_FADE`, `light-mix.mjs`, `homeBorderDistance`), and the Night Land's dark layer the same way (`land-effects.mjs` `nightShare`). Planets now touch each other, and the sky must not jump when you step over a ribbon.

```js
// src/light-mix.mjs landLightAt(x, z, lights, out): out.id (the land whose light row applies) and out.share (own light against the home light) stay as in round 8; two fields are added.
// World's constructor creates the object, so its shape changes there too (builder C): this.lightAt = { id: null, share: 0, nb: null, nbShare: 0 }
const own = smooth(homeBorderDistance(x, z), 0, LIGHT_FADE);                  // 0 on the inner arc, 1 from 24 m in (as in round 8; Infinity -> 1)
const nbS = .5 * (1 - smooth(sectorBorderDistance(x, z), 0, LIGHT_FADE));      // 0 from 24 m in, 0.5 on a planet-to-planet line
// out.id = this land; out.share = own; out.nb = the planet across the nearest 'sector' run (null when nbS is 0 or that land has no light row); out.nbShare = nbS
```

**What `applyLights` does with them (`world.mjs`, builder C; allocation-free).** The names are round 8's: the function is `landLightAt` (there is no `lightMix`), `this.lightAt` is `{id, share}` and `this.landShare = at.share`. **`landShare` keeps its meaning**, how far into its own land's light you are (own against home, 0 to 1); `journey.landShare` and `journey.land` (read by `lands-browser` and `travel-shots`) are unchanged, and `journey.nb` and `journey.nbShare` are added. With `t = at.share` and `m = at.nbShare`, the land's light is `L = lerp(ownRow, nbRow, m)` channel by channel (sky, ground, sun colour, fog, background through one scratch `Color` each, created once with the `landLights` entries) and the result is `lerp(home, L, t)`, exactly as `sky.lerp(land.sky, t)` does now but with `scratch.copy(own).lerp(nb, m)` first; the sun's intensity is `this.sun.intensity += (lerp(own.sunIntensity, nb.sunIntensity, m) - LIGHT.sunIntensity) * t`. When `m` is 0 or `nb` is null the code path is round 8's, line for line. On a planet-to-planet line `m` is 0.5 from both sides, own and neighbour swap across it, and `lerp(A, B, .5) = lerp(B, A, .5)`: the light is continuous across it. On the inner arc `t` is 0 on both sides: continuous with the home light.

**The Night Land's darkness.** `nightShare` (`land-effects.mjs`, B) is `own * (1 - nbShare)` inside the Night Land, `nbShare` in a neighbour whose nearest `'sector'` run has the Night Land on its other side (so `out.nb === 'shadow'`: Ember Fields and Cloud Meadow), 0 elsewhere: 0.5 on the line from both sides, 0 at 24 m. `sight.dark` in `pandora-view.mjs` `installPandora` (one line, builder C) read `world.landShare > .5 && regionAt === 'shadow'`; that would flip at the line while the picture fades over 48 m. It becomes **`open && nightShare(p.x, p.z) > .25`**: dark through the whole Night Land and 12 m into each neighbour, in step with what the player sees. `tests/render.test.mjs` (the light test) and `tests/land-effects.test.mjs` (the night test) assert continuity: a step of 0.01 m across any `'sector'` run changes the mix, the night share and the sun's intensity by under 0.01 of their range, and `sight.dark` changes only where `nightShare` crosses 0.25.

### 2.8 Border runs, and the mesh

**The 36 runs** (`check-world.mjs`; one object per run, generated from `RING`, `SAFE` and `WARD_OUTLINE`, never typed):

| Kind | What | Count | Ribbon | Length | Left | Right |
|---|---|---|---|---|---|---|
| `ward` | the ward outline, cut at the four axis points, clockwise from the north-west corner | 8 | slim (`half` 0.995) | 409.0 m: 56.5, 56.5, 50, 41.5, 56.5, 56.5, 41.5, 50 | village | north, east, east, south, south, west, west, north |
| `seam` | home quarter against home quarter, along an axis, from the ward (or the gate road) to the inner circle | 4 | full (`half` 1.99) | 425.0 m: north (0, -50) to (0, -160) 110.0; east (67, 0) to (160, 0) 93.0; south (0, 41.5) to (0, 160) 118.5; west (-56.5, 0) to (-160, 0) 103.5 | east / south / west / north | north / east / south / west |
| `shared` | home quarter against planet: eight 45-degree arcs of radius R1, bearings 0 to 45, 45 to 90, ... | 8 | full | 1,005.3 m (8 x 125.66) | shadow, lava, ocean, jungle, toy, candy, ice, cloud | east, east, south, south, west, west, north, north |
| `sector` | planet against planet: eight radials from R1 to R2 at bearings 0, 45, ... 315 | 8 | full | 1,088.0 m (8 x 136) | shadow, lava, ocean, jungle, toy, candy, ice, cloud | cloud, shadow, lava, ocean, jungle, toy, candy, ice |
| `outer` | the world's edge: eight 45-degree arcs of radius R2 | 8 | full | 1,859.8 m (8 x 232.48) | null (outside) | shadow, lava, ocean, jungle, toy, candy, ice, cloud |
| **Total** | | **36** | | **4,787.1 m** (round 8: 40 runs, 4,584.2 m) | | |

A quarter has 6 runs (two `ward`, two `seam`, two `shared`), a planet 4 (`shared`, `sector`, `sector`, `outer`), the village the 8 ward runs. **No two home regions and no two planets are separated by anything but a ribbon:** the four home-to-home axes are new (round 8 had four short seams of 16 to 24 m), and planet-to-planet lines are new (round 8's planets touched no other planet).

**Cross-section: unchanged** (old 2: 3.98 m, strips 0.2 white, 0.6 accent, 7 x 0.34 rainbow, 0.6 accent, 0.2 white; a slim run is every width x 0.5; vertex colours only; flat at y 0.03; `MeshBasicMaterial`, opaque, fog on, `polygonOffset`, no shadow). Offset `o` is measured toward `left`: -1.99 is the right edge, +1.99 the left edge.

**Mesh formulas.**
- A **segment** run: the point at parameter `t` and offset `o` is `a + t (b - a) + n o`, with `n = (-(bz - az), bx - ax) / length`.
- An **arc** run: the point at bearing `beta` and offset `o` is `((r + o) sin beta, -(r + o) cos beta)`: exactly concentric strips, so a strip's width never varies. Mesh points every `ARC_STEP` = 3 degrees (the sagitta of the chord is 0.055 m at R1 and 0.101 m at R2 against a 3.98 m ribbon; at 2 degrees it would be 0.024 and 0.045 m for about 8,400 triangles; at 4 degrees 0.097 and 0.180 m). The analytic distance of 2.7 stays exact; the mesh follows it within 10 cm.
- **Cuts:** a full segment run is shortened by 2 m at both ends, a slim one by 1.1 m (**a `seam`'s ward end is the exception, below**), a full arc by `2 / r` radians at both ends (0.72 degrees at R1, 0.39 at R2), so each arc is `ceil(43.6 / 3) = 15` and `ceil(44.2 / 3) = 15` steps.
- **Seam starts (one rule).** A `seam`'s drawn ribbon starts **1.1 m past the point where its run starts**, the half width of the slim knot standing on that point, so its square end touches the knot's outer edge with no gap and no overlap: north z -51.1, south z 42.6, west x -57.6 (the three that start on the ward line at the axis points N, S, W; the ward ribbon itself reaches 0.995 m, the knot 1.1 m). The east seam's run starts at the gate road's end, `GATE_END` = 67, so it is drawn from x 68.1: **the 10.5 m between the ward's east knot (to x 57.6) and the seam (from x 68.1) is the gate's road and is deliberately left open**, the one place where a border has a gap. The first draft said "2.2 m beyond" in one sentence and "shortened by 2 m" in the generic rule (a 1.1 m gap at three junctions and an 11.6 m gap at the fourth); this is the one rule. The R1 end of a seam is cut by 2 m like every full segment, under the 4.4 m knot at the junction (the knot reaches 2.2 m, so they overlap by 0.2 m, as in round 8). No ribbon, knot or white edge of a `seam`, `shared`, `sector` or `outer` run comes nearer than 0.9 m to the road's asphalt (the ring road's outer edge is x +/-54.5 east and west and z 39.5 south, 2 m inside the ward line; the north road edge is at z -35.5, 15.6 m from the north seam's start; the spur is x 54.5 to 65.5): the nearest are the south and west seams' starts at 3.1 m and the east seam's start at x 68.1, 2.6 m from the spur's end. The ward ribbon's own crossing of the spur at (56.5, 0) is the one deliberate exception, as in round 8. `tests/borders.test.mjs` samples every vertex and asserts that each seam's first vertex is at its start plus 1.1 m and touches its knot.
- **Knots** (white squares at y 0.031, so crossing ribbons never overlap): 16 full 4.4 m knots at the junctions of R1 and R2 with the eight radials (bearings 0, 45, ... 315, at both radii) and 8 slim 2.2 m knots on the ward line (the four corners and the four axis points N, E, S, W). That is 24 knots.
- **Quads:** (16 arcs x 15 steps + 20 straight runs) x 11 strips = 2,860, plus 24 knots = **2,884 quads, 5,768 triangles**, one merged `BufferGeometry`, **one draw**, no per-frame work (round 8: 468 quads, 936 triangles). **The ribbon adds 4,832 triangles to every frame, village included**: it is one mesh, its bounding sphere covers the whole world and it is a child of `world.outside`, so it is never culled wherever the player stands. That is 1.6% of the PC village's 299k triangles, 3.2% of the phone's 152k (`ROUND8-PERF1.md`) and 4.9% of the phone's headroom to its 250,000 line; it is **accepted, not hidden**, and the figure goes to the fix pass, whose village triangle budget must be measured with the ring's ribbon in it (it trims the round 8 ribbon and ward curtain: those are now this ribbon). Lever, only if the fix pass's final village figure leaves less than 15,000 triangles of headroom on the phone: split the ribbon into eight 45-degree meshes (the ward runs and seams stay with the first), each with a tight bounding sphere, at the cost of one extra draw only where several are in view.
- **Outer curtain** (high graphics only): one open cylinder of radius R2, 5 m tall, 120 segments (3 degrees), additive at 0.3 opacity, **`side: DoubleSide` with `forceSinglePass: true`, as at `798ed32`** (the camera is always inside the cylinder, so the faces it sees are the cylinder's back faces and a front-only material would be invisible; `forceSinglePass` is what the fix pass added, so it is already one pass, not two), one extra draw. Off on medium and low.
- **Pandora's ward curtain** still follows `WARD_OUTLINE` over the ward runs.
- **Scenery and creature clearance** (old 2) hold: no blocking piece or card where `borderDistance < 3`, no creature where `gridBorderDistance < 6` or `borderDistance < 2`. The corner clearance (no creature within 20 m of the point where a diagonal land met the centre cell) **goes**: the nearest junction is 84.5 m from the ward.

**Trails: along the quarters' bisectors, not the axes.** The axes are now borders; a trail on one would lie under a ribbon. Zoo Garden draws its trails from the four gates to the border through the middle of each sector, and the middle of each quarter is its diagonal. Each trail runs from the ward to the inner circle, where the diagonal's `sector` run begins: the trail leads to the gate between two planets.

| Trail (region) | Bearing | `from` (along the bisector) | Start point | To | Length |
|---|---|---|---|---|---|
| `east` NE | 45 | 73.96 | (52.25, -52.34) | R1 = 160 | 86.0 m |
| `south` SE | 135 | 62.69 | (44.78, 43.87) | 160 | 97.3 m |
| `west` SW | 225 | 60.94 | (-42.41, 43.77) | 160 | 99.1 m |
| `north` NW | 315 | 73.96 | (-52.34, -52.25) | 160 | 86.0 m |

`from` is **computed, not typed**: the first `along` (in steps of 0.25 m from 0) whose centreline point, wander included, has its whole 2.2 m half width outside the ward (`!inSafeZone(x, z, 2.2)`). The first draft started each trail where the bisector crosses the ward line (70.71 m for the north-east and north-west, 58.69 for the others); with the wander the south-east trail then began at (42.60, 40.40) and the north-west at (-50.28, -49.72), **inside the village** (5 and 2 samples of 0.25 m), and the north-east began 0.28 m outside it, so its half width overlapped the ward (`review.mjs`). The bisector meets the ward line at 45 degrees, so the sideways wander has an inward component that round 8's axis trails never had. The trail tiles are unchanged by the shift (the same 12, computed again in `tt.mjs`).

The wander is Zoo Garden's own `trailOffset` (unchanged formula: `(sin(0.09 a) 3 + sin(0.23 a) 1.2) smoothstep(a, 18, 30)`) **with round 8's signature `trailOffset(id, along)`** (the `id` is unused, as there; `fields.test`, `region-mix.test`, `regions.test` and `minimap.mjs` call it so), applied sideways: with `u = (sin b, -cos b)` the bisector and `n = (cos b, sin b)` its right-hand normal, the centreline at `along` is `u * along + n * trailOffset(id, along)`; `trailDistance(x, z)` clamps `along` to `[from, to]` and measures to that point. **`TRAILS[id]` is `{ bearing, from, to }`**: round 8's `axis` and `sign` fields go; their readers are `trailDistance` in `regions.mjs`, `trailTile` in `fields.mjs`, the stroke in `minimap.mjs` (F), and `tests/regions.test.mjs`, `fields.test.mjs`, `region-mix.test.mjs`, `minimap.test.mjs`. Half-width 2.2 m, full colour inside 1.2 m and a smoothstep to 2.2 m, scenery 5 m clear, the canyon's trail the redder `#e8a868`, the others `#e8cf92`, as in round 8. **Trail tiles** (built with the finer ground: 48 segments, the fix pass's figure for "high"; "battery" already used 48 on a trail tile and 32 elsewhere): the 12 tiles `(-1,-1) (-1,-2) (-1,0) (-2,-2) (-2,0) (-2,1) (0,-1) (0,0) (0,1) (1,-1) (1,-2) (1,1)` (`lists.mjs`; round 8: 20). `trailTile(cx, cz)` in `fields.mjs` becomes a lookup of that set computed once from `TRAILS`.

### 2.9 The world edge: a circle with a rim

| What | Rule |
|---|---|
| Walking | `world.blocked` also returns true when `edgeDepth(x, z) > 0`. `world.bounds` outdoors is `{x: R2 - EDGE_PAD, z: R2 - EDGE_PAD, r: R2 - EDGE_PAD}` = 294 (`r` is read by `findRoute` only, 2.9; a room's bounds have none): a cheap box test first |
| **The edge function** | `edgeDepth(x, z) = r > L ? r - L : r <= L ? 0 : Infinity` with `r = hyp(x, z)` and `L = R2 - EDGE_PAD`: metres past the padded line, smooth and one formula everywhere (round 8: a case split with `CELL` outside the world). **A non-finite point gives Infinity**, so it stays blocked as in round 8 (where `world.edgeDepth` returned `CELL` for a point outside the world); the first draft's `max(0, NaN - L)` was NaN, and `NaN > 0` is false: a NaN position from physics or a bad pending target walked free, and `regionAt(NaN, NaN)` was `'cloud'`. `world.edgeDepth` returns it outdoors and 0 indoors. Tests: `regions.test.mjs` asserts `regionAt` null, `edgeDepth` Infinity, `inWorld` false and `edgeAhead` 0 for NaN and Infinity |
| Looking ahead | `edgeAhead(x, z, dx, dz, max = 48, pad = 2)` is the **analytic** ray against the padded circle: with `R = R2 - pad`, `c = x^2 + z^2 - R^2` (0 when `c >= 0`), `b = x dx + z dz`, `t = -b + sqrt(b^2 - c)`; `Infinity` when `t > max`. No sampling, no bisection (round 8: up to 53 calls) |
| Driving | `DriveView.blocked` and `wallDepth` read `w.edgeDepth?.(x, z)` exactly as round 8's spec 1.6 says (optional calls, so the node rigs of `tests/render.test.mjs` that never define it stay open ground). **New: the slide, in three places, all from one pure function** `edgeSlide(x, z, vx, vz, out)` in `navigation.mjs` (C): with `n = (x, z) / hyp(x, z)` it returns `v - max(0, v . n) n`, the part of the move along the wall (allocation-free, `out` is a reused object). (1) The per-sub-step move of `DriveView.update`: when `edgeDepth(x, z) > 0` at the candidate point the move is replaced by `edgeSlide` of it and `glance(...)` keeps the part along the wall and never less than `crawl`. (2) **The stick-into-wall controller**, the `else if (this.contact && held)` block with `PRESS`, `jam`, `round`, `slideX`, `slideZ`, `openX`, `openZ` and the pocket branch: it decides by `wallDepth` along the two axes and emits `ax, az` in `{-1, 0, 1}`; on a circular wall at a diagonal bearing neither axis is open (moving +x or +z both raise rho), so it would take the pocket branch and back out or rest nose-on instead of sliding. **When the thing pressed against is the edge** (`edgeDepth` at the contact point plus one `PRESS.reach` step is positive and no collider is within reach), the block is replaced by the tangent rule: `t = (-n.z, n.x)`, `s = u . t` for the stick's unit vector `u`; if `abs(s) / PRESS.reach >= PRESS.slide` the car follows `sign(s) t` (a continuous vector, not rounded to an axis) at the share `abs(s)`, otherwise (square on to the wall) it rests nose-on as the axis case does; `jam` and `rested` stay as they are. The axis logic is kept for trunks, buildings and every other collider. (3) **On foot** (`world.mjs`, builder C): `World.push` and the tapped-walk step test the candidate point axis by axis today, so a walker pressed straight into the rim at a diagonal stops dead; when the candidate is blocked **only by the edge** (not by a collider), one retry with `edgeSlide` of the step is taken and kept if it is not blocked. A notch or a pocket no longer exists. `tests/edge-browser.mjs` drives eight bearings (including 45 degrees) by jeep, bike and on foot and asserts that each slides along the wall at its cruising speed and never stops |
| Braking | as round 8: `limit = min(limit, max(crawl, arrivalSpeed(spec, edgeAhead(m.x, m.z, sin(heading), cos(heading)) - 1)))`, added to the limit the steering code already computes. From top speed the jeep needs 33.5 m (brake 22) and the bike 26.3 m (brake 28), inside the 48 m look-ahead. A tangent run at the rim still brakes, and settles by itself: `edgeAhead` along the tangent is 12.1, 17.1, 24.2 and 34.2 m at 0.25, 0.5, 1 and 2 m inside the padded line, so the jeep's limit is 22.1, 26.6, 32.0 and 38.2 m/s (`edge.mjs`); no special case. The analytic `edgeAhead` matches a 1 mm march to within 1 mm on 2,000 random rays (`edge.mjs`) |
| Tapped routes | **Simpler than round 8, and `findRoute` stays shared with the rooms.** The disc is convex, so a straight leg between two points inside it never leaves it, and the empty-cell boxes (`EMPTY`, `EDGE_BOX`, `edgeObstacles`, `worldPoint`, `worldClear` in `navigation.mjs`, and `routeObstacles`' box per empty cell) are **deleted**; `ROUTE_PAD` (= `EDGE_PAD + 1.3`) stays. `clampToWorld(x, z, pad)` projects radially onto the circle `R2 - pad`. `routeTo` clamps a tapped end to `R2 - ROUTE_PAD` = 292.7 and starts with one straight leg to `clampToWorld(start, ROUTE_PAD)` when the start is inside that band. **`findRoute(start, end, obstacles, bounds)` keeps its signature and its box test.** It is also called with room bounds (`house-life.mjs` `BOUNDS`, `friends-view.mjs` `world.bounds`, `world.routeTo` for interiors, `tests/decor.test.mjs`, `house-life.test.mjs`, `fields.test.mjs`), so replacing the box by a circle would silently drop the indoor walk-area check. Instead `valid` becomes `Math.abs(p.x) <= bounds.x && Math.abs(p.z) <= bounds.z && (bounds.r === undefined || p.x * p.x + p.z * p.z <= bounds.r * bounds.r) && !boxes.some(...)`, and `world.bounds` outdoors is `{x: 294, z: 294, r: 294}` (294 = `R2 - EDGE_PAD`; a room's bounds have no `r`). `findRoute` has no pad parameter and gets none: the circle `r` is already the padded one. The ponds and lava pools still need the box of side `2 (r + 0.8)` of old 1.6. `tests/render.test.mjs` imports `worldClear`, `edgeObstacles`, `worldPoint` and `EDGE_BOX`: all four go with their tests (C rewrites them with `inWorld` and `clampToWorld`) |
| Toast | "The world ends here", once per session, on the first block by the edge |
| What you see | the **rim**: tiles that have any ground outside the disc and within 128 m of it carry flat ground in the nearest land's darkened colour and up to 20 pieces of that land's rim kind (4.3). The Beach's rim is open sea and the Cloud Meadow's is cloud, with no pieces. Plus the outer ribbon and, on strong devices, the curtain |
| Rim extent | tile indices -7...6 on each axis (+/-448 m) as before; 196 positions: 88 touch the disc, 108 do not, of which **76** are within 128 m of the edge, the most a 5 x 5 tile window can ever show (round 8: 144 rim positions) |
| Rim's land | `SECTOR_ID[sectorIndex(x, z)]` of the **point** (not of the tile), so a rim tile on a radial line has two lands, each with its own rim kind (at most 2 draws a tile) |
| Under-plane | unchanged (`#3f8f4a`, beyond the rim only) |
| Creatures | `Wilds.walkable` refuses `!inWorld(x, z, e.radius)` and any point outside the creature's own region (old 4.4) |
| Birds | re-centre only onto in-world points (unchanged) |

## 3. Content placement

Every coordinate below was computed by `dens.mjs`, `features.mjs` and `stands2.mjs` and checked by `verify.mjs` (974 assertions, Appendix C), and is rounded to 0.5 m. A builder types these rows once, as formulas where the table gives one; `tests/` re-derive every clearance from the code, not from this file.

### 3.1 Rules the placement obeys

- Each thing lies inside its own region (`regionAt`).
- **Dens:** at least **36 m** from every grid border (`gridBorderDistance`: arcs, radials, axis seams; the ward line does not count), at least **56 m** from every other den (the closest pair is 59.9 m), off the 32 m creature-cell seams (neither coordinate a multiple of 32); every home den at least 50 m (bosses) or 55 m (the titan) from the ward line, and 31 m from the trail's centreline. `clear` 16 m for a boss and the nest, 24 m for a titan; `leash` 30 m, but 24 m for the seven bosses of candy, ice and lava and for the dragon's nest (old 4.1, unchanged).
- **Titans toward the rim:** every planet titan stands between R2 - 45.5 and R2 - 41 from the origin (250.5 to 255 m), the one place a player is least likely to walk by. The Mountain Turtle stays on the village side of the canyon, as in round 8.
- **The reference's relative geometry:** the first boss is the one nearest the village; on the three-den planets (candy, ice) two bosses stand in the inner row and a boss and the titan in the outer row; lava has the golem in the inner row and the dragon's nest and the scorpion in the outer one; the one-boss planets have the boss in the inner row and the titan at the far side of the outer row, so you can walk round the titan.
- Rows are written as `R1 + a` and `R2 - b` and an angle, in a new pure file `src/den-rows.mjs` (`denRows({R1, R2})`, no imports, so that `regions.mjs` can call `denRows(RING)` without an import cycle); `regions.mjs` converts polar to x, z, rounds to 0.5 m and adds `id`, `clear`, `titan`, `level` and `power` (the power through `powerOf` of `power.mjs`, 2.5: `regions.mjs` never imports `region-mix.mjs`). Changing `RING` moves the dens (2.1).

### 3.2 The 26 dens

"Angle" is degrees clockwise **into the sector** from its first radial line (the sector's start bearing in 2.5 plus the angle is the bearing). Home rows give the bearing directly: a quarter's trail is its bisector, every home boss stands 20 degrees clockwise of it and the Turtle 20 degrees counter-clockwise, so the four home bosses are a clean pinwheel (bearings 65, 155, 245, 335) and none is within 38 m of an axis border. "Lv" is the boss and titan level at the den's own position (2.5); the home values are round 8's labels. "Power" is the multiplier at the den's own position (home: 1; the Turtle takes the titan factors of old 3.4).

| Den id | Region | Rule: rho and angle | x | z | rho | Lv | Power | Grid border | Ward line | Nearest den |
|---|---|---|---|---|---|---|---|---|---|---|
| `w:den:treant` | west | R1-38, bearing 245 (bisector +20) | -110.5 | 51.5 | 121.9 | 7 | x1 | 38.1 | 54.9 | 79.5 |
| `w:den:croc` | north | R1-38, bearing 335 (+20) | -51.5 | -110.5 | 121.9 | 10 | x1 | 38.1 | 60.5 | 83.8 |
| `w:den:mushking` | south | R1-38, bearing 155 (+20) | 51.5 | 110.5 | 121.9 | 7 | x1 | 38.1 | 69.0 | 83.8 |
| `w:den:bear` | east | R1-38, bearing 65 (+20) | 110.5 | -51.5 | 121.9 | 13 | x1 | 38.1 | 54.0 | 81.8 |
| `w:den:titan_turtle` | east | R1-43, bearing 25 (bisector -20) | 49.5 | -106.0 | 117.0 | 13 | x1 (titan factors) | 43.0 | 56.0 | 81.8 |
| `w:den:shadowlord` | shadow | R1+44, 14 deg in | 49.5 | -198.0 | 204.1 | 23 | x6.56 | 44.1 | 148.0 | 82.5 |
| `w:den:titan_eye` | shadow | R2-44, 31 deg in | 130.0 | -216.0 | 252.1 | 24 | x6.96 | 43.9 | 181.5 | 82.5 |
| `w:den:golem` | lava | R1+45.5, 22.5 deg in | 190.0 | -78.5 | 205.6 | 20 | x5.18 | 45.6 | 136.5 | 65.4 |
| `w:den:dragon` | lava | R2-45.5, 10.5 deg in | 206.5 | -142.0 | 250.6 | 21 | x5.55 | 45.4 | 176.0 | 65.6 |
| `w:den:titan_scorpion` | lava | R2-45.5, 34.5 deg in | 246.5 | -45.5 | 250.7 | 21 | x5.55 | 45.3 | 190.0 | 65.4 |
| `w:den:leviathan` | ocean | R1+44, 14 deg in | 198.0 | 49.5 | 204.1 | 17 | x3.91 | 44.1 | 141.7 | 82.5 |
| `w:den:titan_kraken` | ocean | R2-44, 31 deg in | 216.0 | 130.0 | 252.1 | 18 | x4.25 | 43.9 | 182.4 | 82.5 |
| `w:den:gorilla` | jungle | R1+44, 14 deg in | 105.0 | 175.0 | 204.1 | 14 | x2.86 | 44.1 | 142.0 | 82.3 |
| `w:den:titan_flower` | jungle | R2-44, 31 deg in | 61.0 | 244.5 | 252.0 | 15 | x3.14 | 44.0 | 203.0 | 82.3 |
| `w:den:robot` | toy | R1+44, 14 deg in | -49.5 | 198.0 | 204.1 | 11 | x1.93 | 44.1 | 156.5 | 82.5 |
| `w:den:titan_clock` | toy | R2-44, 31 deg in | -130.0 | 216.0 | 252.1 | 12 | x2.19 | 43.9 | 189.3 | 82.5 |
| `w:den:cake` | candy | R1+41, 16.8 deg in | -177.0 | 95.0 | 200.9 | 14 | x2.84 | 40.9 | 131.8 | 59.9 |
| `w:den:gingerbread` | candy | R1+48, 33.5 deg in | -204.0 | 41.5 | 208.2 | 14 | x2.88 | 41.5 | 147.5 | 59.9 |
| `w:den:jellyqueen` | candy | R2-41, 9.5 deg in | -207.5 | 148.0 | 254.9 | 15 | x3.16 | 41.1 | 184.8 | 61.1 |
| `w:den:titan_hydra` | candy | R2-41, 24 deg in | -238.0 | 91.5 | 255.0 | 15 | x3.16 | 41.0 | 188.3 | 60.5 |
| `w:den:yeti` | ice | R1+41, 16.8 deg in | -192.5 | -58.0 | 201.0 | 17 | x3.89 | 41.0 | 136.2 | 60.1 |
| `w:den:mammoth` | ice | R1+48, 33.5 deg in | -173.5 | -115.0 | 208.2 | 17 | x3.94 | 41.4 | 133.8 | 60.1 |
| `w:den:frostowl` | ice | R2-41, 9.5 deg in | -251.5 | -42.0 | 255.0 | 18 | x4.27 | 41.0 | 195.0 | 61.1 |
| `w:den:titan_crystal` | ice | R2-41, 24 deg in | -233.0 | -103.5 | 255.0 | 18 | x4.27 | 41.0 | 184.4 | 60.6 |
| `w:den:phoenix` | cloud | R1+44, 14 deg in | -105.0 | -175.0 | 204.1 | 20 | x5.16 | 44.1 | 134.1 | 82.3 |
| `w:den:titan_whale` | cloud | R2-44, 31 deg in | -61.0 | -244.5 | 252.0 | 21 | x5.56 | 44.0 | 194.6 | 82.3 |

What the table proves (`tables.mjs`, `verify.mjs`):
- **Borders:** the nearest border to any den is 38.1 m (the four home bosses, 2 m of margin over the rule) and 40.9 m or more for every planet den; the nest basin (r 14) and the Kraken's sand are inside as well (3.4).
- **A boss cannot drag you into the titan** (old 4.4: separation - leash - 4.8 - 2 must stay above the titan's 24 m trigger). Round 8's worst sums were 36.7 m (one-boss lands) and 25.2 m (candy, ice, lava). Now: toy 45.7, jungle 45.5, ocean 45.7, cloud 45.5, shadow 45.7, canyon (the bear and the Turtle, 81.8 m apart against round 8's 67.2) 45.0; candy 29.7 to 33.4, ice 29.8 to 33.4, lava 34.6 (golem) and 73.7 (dragon). Boss to boss on the three-den planets: 59.9 to 61.1 m (cake and gingerbread 59.9; yeti and mammoth 60.1) against sights of 18 m or less.
- **The Turtle and the trail:** the trail's centreline passes the den at 38.8 m (a sweep along the whole trail finds 38.76 m at its nearest), the near edge of its half-width at 36.6 m, 34.6 m with the 2 m wander of `AI.wander`: outside the 24 m wind-up and the 22 m sight (round 8: 26.9 m).
- **Home bosses from the ward line:** treant 54.9 m, croc 60.5, mushking 69.0, bear 54.0, Turtle 56.0.

### 3.3 The three cages (old 16)

`cageCandidates` is unchanged (12 spots 6.5 m from the den, the first toward the village centre (0, 0), then swinging out by 0.35 rad); `cageSpot` still takes the first with no blocking piece within its radius + 1.1 m. The first candidate, with its clearances (`tables.mjs`):

| Cage | Beside | Region | First candidate x, z | Grid border | Nearest titan |
|---|---|---|---|---|---|
| Sprout | Ancient Treant | `west` | (-104.6, 48.8) | 44.6 m | 140.1 m |
| Clover | King Bear | `east` | (104.6, -48.8) | 44.6 m | 79.5 m (the Turtle) |
| Pepper | Giant Toy Robot | `toy` | (-47.9, 191.7) | 37.6 m | 85.6 m |

Each is inside its den's 16 m clearing, at least 29.5 m from a border (the rule's 36 m less the 6.5 m), and at least 60 m from any titan's den (the leash 30 m plus the 30 m within which a titan drops marks on a target).

### 3.4 Ponds, pools, rails, vents, the nest, the sea, islands

The rules of the old tests hold (`tests/land-effects.test.mjs` placement: a pond or pool's edge 6 m from a grid border, a rail 12 m, a small feature's centre 12 m; 16 m from a den, 32 m + r from a titan, a rail may touch an arena's edge but not cross it). The ring adds two for the home regions: a pond's edge **12 m from the ward line** and **4 m from the trail**. Positions are the smallest-margin solutions of `features.mjs` (smallest margin over the rules in metres: west 20.9, south 15.0, toy 3.9, candy 22.5, jungle 30.5, ice 22.5, shadow 30.4, lava 9.5):

| Region | Feature | x, z | r | Notes |
|---|---|---|---|---|
| `west` | pond | (-41.5, 82.5) | 8 | home water look |
| `west` | pond | (-34.0, 121.5) | 7 | |
| `south` | pond | (126.5, 30.0) | 9 | the Blue Lake |
| `south` | pond | (93.5, 50.5) | 11 | the larger lake: the Lake Guardian koi lives here |
| `toy` | rail | (-86.5, 178.0) | 22 | speed 7 m/s, id 0 |
| `toy` | rail | (-69.0, 238.0) | 22 | speed 8 m/s, id 1; the two loops are 62.5 m apart centre to centre (rule: 44 m + 4) |
| `toy` | pond | (-69.0, 238.0) | 6 | in the middle of the second loop, as in round 8 |
| `candy` | pond | (-258.5, 35.0) | 6.6 | |
| `jungle` | pond | (146.5, 207.0) | 6 | |
| `ice` | pond | (-207.5, -158.0) | 6.6 | the ice-surface flag is set |
| `shadow` | pond | (42.5, -250.0) | 6 | |
| `lava` | pool | (169.5, -118.0) | 18 | |
| `lava` | pool | (189.5, -37.0) | 14 | |
| `lava` | pool | (216.0, -105.5) | 12 | |
| `lava` | pool | (251.5, -97.0) | 11 | the four pools cover 2,466 m^2 = **10.1%** of the sector (round 8: three pools, 9.0% of a square; the reference 10.6%) |
| `lava` | vent | (163.5, -79.5) | 5.5 | phase 110 |
| `lava` | vent | (206.0, -169.5) | 5.5 | phase 57 |
| `lava` | nest | (206.5, -142.0) | 14 | round the dragon's den; the centre island r 4.5 and ten ring islands at 7 and 11 m, built from the den as in round 8; 45.5 m from the rim |

- **The Beach's sea** is no longer a band along two sides. It is the part of `ocean` with `rho > R2 - SEA_DEPTH` and **`SEA_DEPTH = 32`**: `waterAt(x, z) = regionAt(x, z) === 'ocean' && hyp(x, z) > R2 - 32` (264 m), and `seaDepth = rho - 264`. Area 7,037 m^2 = 28.9% of the sector (round 8: 24 m along two sides, 5,568 m^2 = 34% of a square; at 24 m it would be 5,353 m^2 = 22%). The Kraken (rho 252.1) stands on sand 11.9 m from the water. Three turtles circle in the sea at rho 282, 10, 22.5 and 35 degrees in: (277.7, 49.0), (260.5, 107.9), (231.0, 161.7), each at least 14 m from the rim and 49 m from a radial line.
- **Cloud Meadow's islands:** one under each den, (-105.0, -175.0) r 16 (the Thunder Phoenix) and (-61.0, -244.5) r 18 (the Cloud Whale), and ten more by the reference's `islandField` rule with its seed 75632, **twelve in all** (round 8: eight, x1.5 for the 1.49 times larger planet). Each is whole inside the sector (`gridBorderDistance >= r + 3`), `r` 12 to 18, 4 m from the others.
- **Seeded features** keep the reference's generator and seeds and the round 8 rule (12 m from every border, 20 m from every den, 32 m + r from a titan, `spacing` between points) with the counts scaled by the same 1.5, so the density in a tile stays what round 8 tuned: jungle poison **3** (seed 87356, r 4.5 + 0.8 a step), thorn walls **6** (seed 97632, r 3.8), Night Land lamp posts **6** (seed 54467, r 8), crystal flowers **15** (seed 44713, r 2.4). The draw is uniform in `shapeOf(id)`'s box and keeps points with `regionAt === id` (acceptance 64%, `bbox.mjs`); the border test is `gridBorderDistance`, not the square's edge.
- `landClear(x, z, r, where)` replaces its per-square loop (`squareOf` boxes) with the region boxes of `shapeOf` as the cheap early-out; the rail test and the ponds are unchanged in form, and **`where: 'sea'` (and `waterAt`) tests `rho > r0`**. `blockers(id)` and `mapFeatures(id)` keep their shapes. **The sea object is defined once**: `FEATURES.ocean.sea = { kind: 'sea', r0: 264, r1: 296, b0: 90, b1: 135 }`, an annular sector (`r0 = R2 - SEA_DEPTH`, `r1 = R2`, the Beach's bearings); round 8's fields `x0, x1, z0, z1, x, z` are **removed**, and every reader changes with it, because with the old names the comparisons become NaN and the coast paint silently disappears, with no error. This is not the "three-line `installLands` edit" the first draft claimed (8.6). **Builder B:** the `ocean` builder in `land-view.mjs` (it draws the sea as a 3 x 3 quad grid from `sea.x0..z1` with `tone()` from `Math.max(x - sea.x, sea.z - z)`: it becomes an annular-sector mesh, rings of quads from `r0 - 1.5` to `r1` over `b0..b1` at 3 degrees, `tone()` from `d = rho - r0`: foam at `d <= 0`, mid to deep by `d`); `region-life.mjs` `beachSea` (the wet-sand paint behind `GROUND.ocean.paint`, which reads `s.x0, s.x1, s.z0, s.z1, s.x, s.z`: it tests the bearings and `rho >= r0 - 3` and mixes by `d = rho - r0`); `landClear('sea')`. **Builder F:** `minimap.mjs` `drawFeatures` (its special case `f.x0 !== undefined && f.x !== undefined` fills two rectangles: it fills the annular sector with `ctx.arc`, and its fallback "the whole square for a kind without a shape" must never apply to the sea). `Ponds()` uses `shapeOf(id)`'s anchor as its Surface origin and works as it stands. `tests/land-effects.test.mjs` asserts the object has exactly the new fields, and that `beachSea` paints the coast.

### 3.5 Stand points for the browser suites

One point per region, in the open: at least 30 m from every den (40 m from a titan), 30 m from every border, 8 m from every feature's edge (smallest margin in metres in brackets; `stands2.mjs`). They replace the `STAND` table of `tests/lands-browser.mjs`, the "(128, 0)" and "(-128, 112)" spots of the other suites, and the minimap tables of 6.3.

| Region | x, z | | Region | x, z |
|---|---|---|---|---|
| `east` Canyon | (90.5, -83.0) [6.6] | | `ocean` | (237.0, 76.0) [16.7] |
| `south` Meadow | (83.5, 81.5) [12.9] | | `jungle` | (113.5, 221.5) [16.7] |
| `west` Forest | (-74.5, 85.0) [16.7] | | `toy` | (-37.0, 256.5) [6.2] |
| `north` Swamp | (-103.0, -46.5) [16.2] | | `candy` | (-240.0, 45.0) [5.8] |
| `shadow` | (76.0, -237.0) [16.7] | | `ice` | (-201.5, -138.0) [5.9] |
| `lava` | (230.5, -86.5) [3.5] | | `cloud` | (-113.5, -221.5) [16.7] |

### 3.6 Creature counts and density (replaces old 3.8)

A creature slot is valid where `wildCell` accepts it: outside the ward line by 2 m, 2 m from every run, 6 m from every full ribbon, outside every den's clearing (the old 20 m corner rule is gone, 2.8). `slots.mjs` measures the valid area of every region on a 1 m grid, round 8's code against the ring's. Round 8's `DENSITY` (mean creatures per 32 m cell) was tuned so each region held its `TARGET`; keeping `DENSITY` and scaling `TARGET` by the valid area keeps the same creatures per cell everywhere:

| Region | Area | Valid area | Round 8 valid area | Ratio | `TARGET` round 8 | **`TARGET` now** | `DENSITY` start (round 8's, then tuned to within 2) |
|---|---|---|---|---|---|---|---|
| `west` | 17,817 | 14,092 | 13,954 | 1.010 | 37 | **37** | 3.36 |
| `north` | 17,313 | 13,624 | 14,728 | 0.925 | 39 | **36** | 2.17 |
| `south` | 17,817 | 14,118 | 15,768 | 0.895 | 37 | **33** | 2.6 |
| `east` | 17,313 | 11,842 | 12,150 | 0.975 | 33 | **32** | 3.73 |
| `toy` | 24,303 | 18,112 | 10,724 | 1.689 | 19 | **32** | 2.54 |
| `candy` | 24,399 | 16,496 | 9,100 | 1.813 | 28 | **51** | 3.14 |
| `jungle` | 24,399 | 18,096 | 10,840 | 1.669 | 22 | **37** | 1.78 |
| `ice` | 24,303 | 16,508 | 9,216 | 1.791 | 28 | **50** | 3.45 |
| `ocean` | 24,303 | 18,112 | 10,724 | 1.689 | 21 | **35** | 2.33 |
| `lava` | 24,399 | 17,327 | 10,028 | 1.728 | 25 | **43** | 2.92 |
| `cloud` | 24,399 | 18,096 | 10,724 | 1.687 | 19 | **32** | 1.76 |
| `shadow` | 24,303 | 18,112 | 10,840 | 1.671 | 19 | **32** | 2.5 |

The world holds 450 targets against 327 (home 138 against 146). **Only the creatures near the player are ever alive:** the cell window is 5 x 5 cells of 32 m, so the live count depends on the density per cell, which did not change, not on the world's size. The planets' valid share of area rises (candy 55.5% to 67.6%) because round 8's den clearings and lanes took a larger part of a 16,384 m^2 square. `scripts/tune-density.mjs` re-tunes the twelve `DENSITY` values (builder B; the `TARGET` table above is what it aims at); the sea kinds of the Beach (`where: 'sea'`) are seeded only in its band.

### 3.7 The east gate spur, Home, the park spots

Unchanged and inside the ward: `GATE` (55.4, 0) with `back` (53, 0), the asphalt spur x 54.5 to 65.5, `GATE_ROAD` x 52 to 67 and z within 4 (it keeps the fields off the spur), `HOME_SPOT` (0, -8), `PARK` jeep (46, -15) and bike (5, -8). **The spur lies exactly on the line between `east` (z < 0) and `south` (z >= 0)**, so every car and walker that leaves the village by the gate, or comes back by its road, runs along a region border for 10.5 m (x 56.5 to 67). The tie rule flips the region at z = 0 (`(63, 0.01)` is `south`, `(63, -0.01)` is `east`), and `region-banner.mjs` fires on every change of `regionAt`, so a car wobbling about z = 0 would fire banners and flicker the zone chip, the light and night crossfades and every creature-region test. Round 8's gate was inside the centre cell, so it never had this. Three rules, none of which changes `regionAt` or the proofs of 2.3:
- **Banner dwell (`region-banner.mjs`, builder A).** A change of region fires its banner only when the player has been in the new region for 0.5 s without a change back; a flip that reverts within 0.5 s fires nothing, and the zone chip and the caption pill follow the settled region. Crossing a real border at any speed settles in well under 0.5 s of play, so nothing is lost there (the banner tests wait 0.6 s after a crossing).
- **Creatures keep off the gate strip (`wilds.mjs` `wildCell` and `Wilds.walkable`, builder B).** No creature slot or step is valid inside `GATE_ROAD` (x 52 to 67, z within 4: the rectangle that already keeps the fields off the spur). "Creatures may stand on it, as before" is withdrawn: the strip is a region border, and a leashed creature would meet an invisible wall at z = 0 across the road.
- **Ground.** Nothing to do under the asphalt (the step in ground colour at z = 0 lies under it, x 54.5 to 65.5, |z| < 2.5); from x 65.5 to the seam (drawn from x 68.1, `groundColor` blending within 3 m of a run's end) the step is a few metres long beside the road's end and is covered by the blend.
`tests/borders-browser.mjs` (A) drives out of the gate and back along the road with z alternating between +0.1 and -0.1 (twenty flips between x 58 and 67) and asserts **zero banners from the flips** and at most one banner for leaving the village by the gate (the region it settles in). The east seam's ribbon starts at x 68.1 (2.8). The save rule that sends a save made on the spur to `GATE.back` stays where it is.

## 4. Tiles and performance

### 4.1 What changes in the count

The tile grid stays **64 m squares aligned to the origin** (`FIELD_TILE`, `FIELD_RADIUS` 2: the 5 x 5 window guarantees 128 m of ground round the player; nothing about it depends on the world's shape). Counts (`tiles.mjs`, `classes.mjs`, `perregion.mjs`; a tile belongs to the world when any of it lies inside the disc):

| | Round 8 (13 squares) | Ring (R2 = 296) |
|---|---|---|
| Tiles with ground in the world | 52 | **88** (52 wholly inside, **36 straddling the edge**) |
| Rim positions in the +/-448 m window (-7...6) | 144 of 196 | **108** of 196, of which **76** are within 128 m of the edge (the most a window can show) |
| Tiles holding one non-village region | 48 | 60 |
| Tiles holding two | 4 (the centre tiles) | 24 |
| Tiles holding three | 0 | **4**: (-2,-2) cloud, ice, north; (-2,1) west, candy, toy; (1,-2) east, shadow, lava; (1,1) south, jungle, ocean (all at a diagonal's meeting with the inner circle) |
| Tiles holding two planets | 0 | 12 |
| Tiles with the finer trail ground | 20 | 12 |
| Tiles by number of ground material classes (4.3) | 1 | 56 with 1, 30 with 2, 2 with 3 |
| Tiles touching each region | | village 4; each quarter 8 (2 wholly inside it); each planet 11 (2 wholly inside) |

88 tiles is more than 52, but at most 12 are ever in view and nine at a time are built at once, so the extra tiles cost memory and plan time (the plan memo of 600 entries holds them all), not frames.

### 4.2 Which tiles exist, and the queue

A tile is built when it is in the 5 x 5 window and (it touches the disc, or it is a rim tile within 128 m of the disc). Nothing beyond +/-448 m is ever created. The queue is round 8's: `ensureNear` builds the nine nearest synchronously, the rest are built one a frame, nearest first (`init` builds nine and queues sixteen, old 17.3). A tile that straddles the edge is an ordinary world tile with extra rim pieces (4.3). `OUTDOOR_LIMIT` stays a large number for the route planner, as in round 8.

### 4.3 The one-region-per-tile assumption: where it lived and what replaces it

Round 8's tiles never held more than one region except the four centre tiles. The ring's border tiles do. Everything that decided by tile now decides by position or by a share; the places, found in `field-layout.mjs` and `fields.mjs`:

| Where (function, file) | Assumption | Now |
|---|---|---|
| `tileShares`, `field-layout.mjs` | a tile whose centre cell is not the centre cell holds one region (a shortcut at its top) | **The shortcut goes.** Always the 9 x 9 sample (81 `regionAt` calls a tile, memoised, 88 tiles once): `[{id, share, open}]` in the order first met; outside the disc counts toward none |
| `treesOf` (`fieldTrees`) | counts `round(row.count * share * open)` per region, one seeded stream per region and tile | **Unchanged** (it already tests `regionAt(x, z) === id` for every piece, `borderDistance < 3 + r`, trail 5 m, titan 32 m, `landClear`). **New: `TILE_KINDS`, with a floor for every region.** A tile of one region keeps its table's kinds (at most 4: candy and ice). A tile of two or more non-village regions keeps kinds in two passes: **(1)** every region with an expected share (`share * open`) of at least 5% keeps its own top kind (the row with the largest `row.count * share * open`, ties in table order); **(2)** the places left up to the cap are filled by the largest expected counts over all rows. The cap is 3, or the number of regions kept in pass 1 if larger (never above 3 in this world: no tile holds more than three non-village regions). The first draft's rule, "the 3 kinds with the largest expected count across the whole tile", strips whole regions: of the 28 tiles that hold two or more non-village regions, **8** leave a region with at least 5% of the tile and no blocking kind at all: (-3,-2) swamp, (-3,1) forest, (-3,2) toy, (-2,-2) cloud, (-2,1) candy and toy, (1,-2) lava, (1,1) jungle, (2,-2) canyon (`review3.mjs`). Tile (-3, 2) is the worst: the Toybox is 44% of it and the Candy Land's four kinds crowd out both toy kinds, a bald strip of about 1,800 m^2 beside a dense candy wood; and the seam between them then follows tile edges, not the region border. With the floor, **0 tiles** leave a region bare and the most kinds anywhere is 3; the price is that the worst tile loses up to 55% of its expected pieces (36% before) because the floor keeps rarer kinds over denser ones; the draw count is unchanged. `fields.test.mjs` and `field-straddle.test.mjs` assert both: no region with at least 5% of a tile loses all its kinds, and a tile of two or more regions has at most `max(3, regions kept)` kinds. Without any cap the worst tile, (-3, 0) with candy and the forest, would draw 7 (`tiles.mjs`: 11 of the 88 tiles expect more than 4 kinds, 1 expects 7) |
| `fieldCards` | one cards stream per region; the whole tile's cards are one batch (at most 220) | **Unchanged.** Every card is placed by position (`regionAt === id`, 3 m from borders, 5 m from trails, `landClear`); a card carries its own `glow` flag and `key`, so lava glow and the others are per card, not per tile |
| `groundColor`, `fields.mjs` | per **vertex**: `regionAt` of the vertex, the region's recipe, blended into the neighbour's over 3 m of the nearest of `RUNS_OF[id]` | **Already per vertex, so a tile of three regions needs nothing new** except: the private `runDistance` is replaced by the exported one that handles arcs (2.7); the outside branch asks `rimLand(x, z)` (the sector of the point) instead of `nearestLand`; `borderDistance` outside the world is the distance to the disc |
| `OpenFields.ground`, `fields.mjs` | **One material a tile** ("a tile holds either home regions and the village (the season's tint) or one land"): `groundMaterial` (season tint), `landMaterial`, `hotMaterial` (lava), a checker material (the Toybox), `landMaterial` for a rim | **Material classes in groups.** Classes: `home` (the village and the four quarters: the season's tint), `checker` (toy), `hot` (lava), `plain` (every other planet, and the rim). The ground stays one `PlaneGeometry`; its index array is reordered **in place** (the pooled geometry keeps its `Uint16Array`, so nothing is allocated per tile, the fix pass's rule) so that the quads of one class are contiguous, a quad's class being that of `regionAt` at its centre (outside the disc: plain); `geometry.clearGroups()` then one `addGroup` a class present; `mesh.material` is the array of those classes' materials. three.js draws one group each: **56 tiles 1 draw, 30 tiles 2, 2 tiles 3** (`classes.mjs`). The stair-step of a border at the quad size (1.0 to 1.6 m) lies inside the 3.98 m ribbon and the 3 m colour blend. The checker texture belongs to the toy material alone, so it shows on the toy quads only: no ghost squares on a neighbour. The season recolour (`season`) changes only the `home` material, as now: a tile of a quarter and a planet tints the quarter's quads alone. **Agreed with the fix pass (8.6):** the pooled `PlaneGeometry` is keyed by its segment count and **regrouped on every reuse** (`clearGroups`, the index re-partitioned in place with a module-level scratch array for a stable partition, one `addGroup` a class), so a reused geometry never keeps the previous tile's groups or index order; if the fix pass caches geometry per tile instead, the partition is done once at build and kept |
| `trailTile(cx, cz)` | the 20 tiles along the axes, typed as ranges | a set of 12 tiles computed once from `TRAILS` (2.8) |
| `fieldRim`, `nearestLand`, `rimOf` | a tile is a rim tile when its centre cell is empty; one land (the nearest square) and one rim kind a tile | **A tile gets rim pieces when any of it is outside the disc and within 128 m of it**: `round(20 * outsideShare)` pieces **per land**, each piece placed outside the disc, `borderDistance >= 4`, the land being `rimLand` of the piece; one rim kind a land (picked by the tile's seed, as now), so at most 2 rim batches on the 8 tiles where a radial line meets the edge. No colliders, no cover, no shadow, scale 1.6 to 2.2 as in round 8. The `kinds` map of a tile is the union of its blocking pieces and its rim pieces (`userData.rim` on a rim batch, not counted in `TILE_KINDS`) |
| `tile.land`, `fields.mjs` (`if (!tile.land)` guards the shadow-caster choice and the card batch) | a rim tile has a land and no regions | becomes `tile.rim = regions.length === 0`; a straddling tile has regions and gets cards and shadows like any world tile |
| `tile.regions.filter(id !== 'village').length` (the shadow cap, `SHADOW_KINDS` 3 a region) | | unchanged, and never above `TILE_KINDS` |
| `blockers(id)` per tile (`addTreeBlock` of ponds and lamp posts) | | unchanged: a feature belongs to the tile its centre is in |

Rim tiles outside every region (a tile wholly beyond the disc) keep round 8's plain 16-segment ground in `landMaterial`.

### 4.4 Tile-level numbers

Cost per tile, main-pass draws: ground 1 to 3 (4.3), blocking kinds 0 to 4 (at most 3 on a tile of two or more regions), cards 1, rim 0 to 2. **Typical 5, worst 8** (a toy or lava tile on a radial line at the edge: ground 2 + kinds 3 + cards 1 + rim 2 = 8; a 3-region junction tile: ground 3 + kinds 3 + cards 1 = 7; a single candy or ice tile: 1 + 4 + 1 = 6). Round 8: 4 to 8, the centre tiles 8. The four tiles round the origin now hold the village and one quarter each (about 0.3 to 0.4 of the tile): the homestead's tiles are 5 draws, not up to 8.

Triangles a tile are bounded by the larger of its regions' figures in old 18 (a border tile has fewer pieces of each, never more in total than the denser region alone; the forest's and the swamp's ~19,000 and ~13,400 remain the heaviest). The ribbon adds **5,768 triangles in one draw**, wherever the player is: +4,832 over round 8's 936, accepted (2.8).

### 4.5 Lazy loading of kits by distance

Old 17.3 holds (kit sizes, the rules, the stand-ins, "every new file after the first frame"), with these changes:

- **The first window now reaches every region.** The player wakes at (0, -8), tile (0, -1); the window is tiles -2...2 by -3...1, x from -128 to 192, z from -192 to 128. `window.mjs` lists the regions with ground in it: the village, all four quarters **and all eight planets** (round 8: the village, the four home regions and four lands: toy, candy, ocean and cloud). So the tile-driven rule alone would ask for the `harsh` kit (ice, lava, the Night Land; 97 KB) at the first frame, 346 KB of scenery kits in all against round 8's 249 KB.
- **Rule (new):** the `harsh` kit is asked for only when the player is within 96 m of an `ice`, `lava` or `shadow` tile (`distanceToRegion(id, x, z) <= 96`, the `KIT_REACH` of `wilds-draw.mjs`); `wilds`, `bright` and `dressing` (249 KB) are asked for in the background right after the first frame, as in round 8. The nearest harsh ground is the inner circle in the north-east, where Ember Fields and the Night Land begin, 84.6 m from the ward. **Owners:** the kit is requested by `OpenFields.want(key)` (`fields.mjs`, builder A), called from `model()` inside `fill()` with no player position today, which calls `world.loadKit(kit, ...)` (`world.mjs`; **builder A owns `loadKit`**, added to 8.3). A pure `kitReach(kit, x, z)` in `field-layout.mjs` (A) says whether a player at (x, z) may ask: true for every kit but `harsh`, and for `harsh` only when `distanceToRegion` to `ice`, `lava` or `shadow` is at most 96 m. `OpenFields.update` stores the player position it already receives; until `kitReach` is true `want` returns false and the tile keeps its stand-ins and is refilled when the kit arrives (the `tile.waiting` and `refill` path that deferred kits already use). Without it the first window (tiles -2...2 by -3...1) asks for `harsh` on the first live frame.
- **Rule (new):** kit fetches are ordered nearest-region first and at most **2 run at once**; planets now touch each other, so walking along the outer ring can pull two new kits within seconds. The queue lives in `world.loadKit` (A): ordered by `distanceToRegion` of the asking tile's nearest region at ask time, two in flight, the rest waiting.
- The creature file `c-<region>.glb` (box open) and a titan's `t-<name>.glb` are asked for within 96 m of the **region** (`distanceToRegion`, the rectangle test `beyondRect(squareOf(id), ...)` in `wilds-draw.mjs` `near` goes), as old 17.3 says "of the square".
- First-visit sizes per region (old 17.3's table, region by region: west to forest, north to swamp, south to meadow, east to canyon) and the totals hold: about 1.23 MB if every region is visited once with the box open.

### 4.6 The budget of old 18, re-derived

Conventions, quality rules (`applyQuality`, the governor of the fix pass, the 28.5 effective-zoom shadow rule), the phone and PC definitions and the "four counts the earlier budget had wrong" hold. The frame table's **baseline is now the fix pass's measured figures** (`ROUND8-PERF1.md`: PC village 179 draws / 299k triangles standing, 206 highest riding; homestead 158 / 311k; phone village 103 / 152k), not main's, and the ring may not raise them.

| Line (old 18) | Ring |
|---|---|
| The village, homestead | **may not rise** (the centre tiles are lighter, 4.4; the ribbon adds 1 draw, as in round 8 it added 1, and 4,832 triangles, 2.8: that one figure may rise by exactly that and no more) |
| Outside the village, near view, box open: phone 150, PC 220 | unchanged lines. Near view touches at most 4 tiles |
| Far view, box open: phone 180, PC 220 | **Unchanged lines, not raised.** Counted, not measured: a far frame is 9 tiles (phone portrait) or 12 (landscape, PC). With round 8's 5 draws a tile as the base and at most half the tiles on a border (6 draws with 2 ground groups and 3 kinds): phone portrait 9 tiles: 4 x 6 + 5 x 5 = 49 against 45 (+4); landscape and PC 12 tiles: 6 x 6 + 6 x 5 = 66 against 60 (+6). Round 8's estimates were 160 (phone portrait), 175 (landscape) and 186 (PC), so about 164, 181 and 192: **the landscape phone is expected to miss its 180 line by one draw on paper**, so the lever is part of the build, not a fallback. Builder A builds lever 1 (hide the batches ranked third and below of border tiles while the far view is on: a visibility toggle, no rebuild) with the tiles, and **merges only when `measureCalls()` reads at most 180 (phone, both orientations, "battery") and 220 (PC, "high") in the far view at the junction (-113.1, 113.1) and the planet-to-planet spot (-161.2, 161.2)**; then lever 2 (merge the two ground groups of a plain-and-home tile) if still over. The figures here sit on the fix pass's moving baseline, so acceptance is the measurement at those spots, not this arithmetic |
| Wheel zoom 42, in the fields, box shut: 150 | unchanged |
| Triangles: phone 250,000, PC 400,000 | unchanged; the swamp (croc den) is the known heavy spot (open item 2 of `ROUND8-OPEN.json`, the fix pass's) and sits in a quarter whose scenery is unchanged |
| New textures, tile build rate | unchanged |
| **New:** the terrain cache | 624 x 624 pixels (2 x (R2 + 16)), 389,376 `regionAt` calls built 96 rows a frame over 7 frames (round 8: 672 x 672, 451,584 calls); 1.56 MB (round 8: 1.81 MB) |
| **New:** `wildCell` | per cell 4 slots, each: `borderDistance` and `gridBorderDistance` (at most 6 runs, an `atan2` per arc run) and 26 den tests. Measure the 25-cell window before and after; it may not grow by more than 20% |

**Spots for `tests/budget-browser.mjs`** (replace the swamp/toy spots; the village ones stay): village (8, 18) box shut and open; homestead (0, -8); swamp stand, box open (-103, -46.5); croc den, box open (-51.5, -110.5); **a planet-to-planet line**, box open, the radial between the Toybox and the Candy Land at rho 228: (-161.2, 161.2); **the three-region junction** of the forest, the Candy Land and the Toybox at the inner circle on that radial: (-113.1, 113.1); the canyon stand, box open (90.5, -83); village border (54, 0); west village in the jeep (-35, -16). Evidence as in old 11.4: `measureCalls()` and `renderer.info.render.triangles`, "battery" 390 x 844 and 844 x 390 and "high" 1440 x 900, before and after.

**Acceptance** is the measurement at these spots, per quality, against the lines above (`measureCalls()` and `renderer.info.render.triangles`, the village and homestead against the fix pass's final figures): the estimates in this section decide nothing.

Expected creature load: unchanged (3.6): the window holds the same creatures per cell as round 8.

## 5. Saves: nobody loses progress

### 5.1 What a live save holds, and what the new layout can break

The game is live with round 8 saves (`willowmere.save.v1`, `version: 1`). `parseSave` builds every field from `freshState`. Only four fields are shaped by the world: **`position`, `vehicles`, `riding`, `heading`**. Everything else survives a re-layout untouched, for these reasons:

| Field | Keyed by | Why it survives |
|---|---|---|
| `defeated` | creature **type** (`bear`, `treant`, `titan_turtle`, ... `/^[a-z_]{2,24}$/`) | den ids stay `w:den:<type>`, all 26 of them (3.2); no den is renamed or dropped; the King Bear's old den is gone, his record is not |
| `friends` | friend id (`sprout`, `clover`, `pepper`) with `rescuedAt` and `home` | cages are recomputed from the dens by `cageSpot` (3.3); a rescued friend is at home or follows you, neither stores a position. Clover's cage still opens for `defeated.bear` |
| `cleared`, `planted` | indices into `villageTrees()` | the village is inside the ward and is not touched |
| coins, fields, stats, gear, house, look, settings | | no geometry |
| `position`, `vehicles`, `riding`, `heading` | coordinates | **the only rows that can be wrong in the new world** (5.3) |

**Why `version` stays 1.** `parseSave` throws "This is not a Willowmere save" for any other value, and so does the file import, and an older tab still open in the browser would read a bumped save as foreign. The layout is versioned by a **new field `layout`** instead: absent or `1` is round 8's thirteen squares (every save so far), `2` is the rings. `freshState` writes `layout: 2`. The key `willowmere.save.v1` is kept.

### 5.2 `migrateLayout`, a pure function (`src/save-layout.mjs`, new, imports `regions.mjs`, `ward.mjs` and `hyp.mjs` only)

```js
// src/save-layout.mjs: imports RING, QUARTER_ID, DENS, inWorld (regions.mjs), inSafeZone (ward.mjs), hyp (hyp.mjs)
export const LAYOUT = 2;
export const KEEP = RING.R1 - 8;                       // 152 m: a place is kept when it is in the ward, or in the home ring 8 m inside the inner circle ...
export const DEN_WAKE = 24;                            // ... and at least `clear + DEN_WAKE` from every home den: 40 m from a boss, 48 m from the Turtle (the titan's own 24 m trigger, old 4.4; a boss sees 12 to 13 m)
export const HOME_SPOT = Object.freeze({ x: 0, z: -8 });
const HOME_DENS = DENS.filter(d => QUARTER_ID.includes(d.region));
export const nearDen = (x, z) => { for (const d of HOME_DENS) { const dx = x - d.x, dz = z - d.z, r = d.clear + DEN_WAKE; if (dx * dx + dz * dz < r * r) return true; } return false; };
export const keepable = (x, z) => Number.isFinite(x) && Number.isFinite(z) && (inSafeZone(x, z) || (inWorld(x, z, 2) && hyp(x, z) < KEEP && !nearDen(x, z)));
export function migrateLayout(raw) {                    // raw: the parsed JSON; returns only the geometry fields, plus layout and layoutMoved
  const out = { position: raw.position, vehicles: raw.vehicles, riding: raw.riding, heading: raw.heading, layout: LAYOUT, layoutMoved: false };
  if (raw.layout >= LAYOUT) return { ...out, layoutMoved: raw.layoutMoved === true };                      // already rings: untouched (idempotent)
  const p = raw.position, here = p && keepable(p.x, p.z);
  if (!here) { out.position = { ...HOME_SPOT }; out.riding = ''; out.heading = 0; out.layoutMoved = !!(p && Number.isFinite(p.x) && Number.isFinite(p.z) && !inSafeZone(p.x, p.z)); }
  const keep = s => s && typeof s === 'object' && keepable(s.x, s.z) && Number.isFinite(s.rot) ? { x: s.x, z: s.z, rot: s.rot } : null;
  out.vehicles = { jeep: keep(raw.vehicles?.jeep), bike: keep(raw.vehicles?.bike) };
  if ((raw.vehicles?.jeep && !out.vehicles.jeep) || (raw.vehicles?.bike && !out.vehicles.bike)) out.layoutMoved = true;
  return out;
}
```

Appendix B holds the version that was run (`migrate.mjs`).

### 5.3 The rules

| Case | Result |
|---|---|
| Position in the ward | kept as it is |
| Position in the home ring, outside the ward, under 152 m from the origin **and at least `clear + 24` m (40 m; the Turtle 48 m) from every home den** | **kept**. The four home regions all play at power 1 (the user's decision of round 8), but a Lv 13 boss is not harmless to a low-level player, and the new home bosses stand 54 to 69 m from the ward, inside the old kept zone: a save made in the old forest at (-128, 0) is kept (54.4 m from the Ancient Treant's den at (-110.5, 51.5)), one made at (-90, 60) (22.2 m from it) is brought home. A kept player wakes in whichever quarter the point is now in (the banner says so) |
| Position anywhere else (a planet, the last 8 m of the home ring, within a home den's wake radius, outside the new circle: the old tip lands reach 326 m, the circle 296), not finite, or missing | **brought home** to (0, -8), `riding ''`, `heading 0`; `layoutMoved` is set unless the player was inside the ward |
| A vehicle's saved spot that is `keepable` | kept (a car left in the forest stays where it was) |
| A vehicle's saved spot anywhere else | `null`: it is at its park spot (`PARK` in `world.mjs`). **No vehicle is lost**: Home and `towVehicles` bring any car back to the park spot anyway (old 7.4, 8) |
| `riding` | `''` when the position was moved (the car is parked); otherwise unchanged. The existing rows still apply afterwards: a bike not owned, a jeep before 200 sales |
| `heading` | `0` when the position was moved |
| After the migration, the existing rows of old 7.3 run on the migrated values: `GATE.back` for a save on the gate's spur, the `vehicles`-less save outside the ward, `inWorld(x, z, 2)` for every vehicle | unchanged |
| **The blocked-spot check is replaced, because it cannot see field scenery.** Round 8's `World.init` runs `this.blocked(x, z)` before `this.fields.update(...)` builds the first tiles, so it sees only the village's colliders. A kept home-ring position (valid in round 8 by construction, unvalidated against the ring's scenery) can land inside a tree trunk or one of the new ponds ((-41.5, 82.5), (-34, 121.5), (126.5, 30), (93.5, 50.5)), where a walker cannot take a step (the test is binary on the new point); Home still works as a hop beyond 20 m of the ward but within 20 m it only walks, so the player is stuck; and `placeVehicle` and `restoreVehicles` check nothing at all | **A pure `fieldBlocked(x, z, r)` in `field-layout.mjs` (builder A)** answers from the plan, not from built tiles: a point is blocked when a planned trunk or collider of its tile or a neighbour (`fieldTrees`, the feature `blockers`) is within `r`, or it is inside a pond, pool or lava pool (`landClear`). `World.init` (builder C) sets `lost = this.blocked(x, z) \|\| fieldBlocked(x, z, .6)` (a blocked player wakes at `HOME_SPOT`), and `restoreVehicles` parks a car whose spot is `fieldBlocked(x, z, 2.4)` (the jeep's footprint). Test in 5.4 |
| `layout` | 2 after the first load; the next `persist` writes it |
| `layoutMoved` | true until the Begin toast has been shown once; then `main.mjs` clears it and persists |

**The toast** (`wake.mjs` `wakeGreeting` gains `moved`): "Willowmere's map has been redrawn as rings round the village. You woke at home, and your car is waiting where it is parked." It replaces the welcome line for that one boot (never for a fresh save, which has `layout: 2` and `layoutMoved: false`). The same line is the hand-off note's release note.

**How many players keep their place** (`migrate.mjs` re-run with the den rule, every 4 m of the old playable world, 13,312 points): **2,992 kept (22.5%)**, of which 616 in the ward and 2,376 in the home ring; 10,320 are brought home. Without the den rule 4,548 (34.2%) would be kept: 1,556 places lie within a boss's wake radius of a new den, which the first draft overlooked. By old region, kept / points: village 616/616, west 518/1,079, north 290/1,144, south 643/1,204, east 515/1,077, toy 129/1,024, candy 129/1,024, cloud 129/1,024, ocean 23/1,024, jungle 0/1,024, ice 0/1,024, lava 0/1,024, shadow 0/1,024. Anyone brought home loses a place and a heading, nothing else. Every migrated position is in the ward or a home region, inside the circle and at least 40 m from every home boss's den (0 exceptions in the corpus). The share of players this touches is far smaller than the share of the area: most play in the village.

### 5.4 Tests (builder M)

`tests/save-layout.test.mjs` (new, pure, no browser):
- named cases: in the ward; the old forest centre (-128, 0) kept (54.4 m from the nearest home den) and (-90, 60) brought home (22.2 m from the Treant's den); the old meadow (0, 128) kept; (151.9, 0) kept and (152, 0) not; the old canyon far side (180, 20), the old jungle tip (-300, 40), the old toy (-128, -128) and the old swamp corner (-60, -190) brought home with `riding ''`, `heading 0`, `layoutMoved true`;
- a far save with the jeep at (-300, 40) and the bike at (20, 5): the jeep is `null`, the bike stays;
- **idempotence:** `migrateLayout(migrateLayout(x))` equals `migrateLayout(x)`, and a `layout: 2` save is returned untouched;
- the **corpus property** (a 4 m grid over the old world, each point once as a position and once as a jeep spot): every result is `inSafeZone` or in a home region, `inWorld(.., 2)`, **at least `clear + 24` m from every home den unless in the ward**, and a kept vehicle is `keepable`;
- **nothing else changes:** a full round 8 save fixture (`tests/fixtures/save-round8-far.json`: **hand-made and validated by round 8's own code**, because no builder can export one from the live game on Pages: the builder makes a worktree of main `446e5f9`, writes the JSON with `defeated` holding the bear and the treant, two rescued friends, planted trees, coins, a far position and a riding jeep, and checks it with that worktree's `parseSave`; the file is committed as data) is run through the ring's `parseSave`; every field except the four geometry fields, `layout` **and `layoutMoved`** deep-equals the fixture; `defeated`, `friends`, `cleared`, `planted` are byte-identical;
- **den safety:** a `layout: 1` save at (-110, 40), 12 m from the Treant's den, wakes at `HOME_SPOT`; over the corpus no kept position outside the ward is within `clear + 24` m of any home den;
- **scenery safety** (builder C, with A's `fieldBlocked`, in `tests/game.test.mjs`' rig or `vehicle-browser`): a `layout: 1` save seeded at the centre of the pond (-41.5, 82.5) (it passes `keepable`: 92 m from the origin, 75.6 m from the Treant's den) wakes at `HOME_SPOT`; one at a planned trunk of the same tile does too; a jeep saved in the pond is parked at its park spot;
- garbage in (`position: {x: NaN}`, `position: null`, `vehicles: {jeep: {x: 'a'}}`, `layout: 'x'`) yields `HOME_SPOT`, null vehicles, `layout` 2.

`tests/game.test.mjs` (also M) keeps its two save tests with the squares replaced by the ring (7.1). `tests/vehicle-browser.mjs` (C) keeps its reload-while-driving cases unchanged in meaning: a save written by the ring game has `layout: 2` and is never moved, wherever in the circle the jeep stands (its `x >= 250` drive stays inside the 294 m padded circle). One new case seeds a `layout: 1` save with the player riding the jeep at (-300, 40) and asserts that the game wakes at home, on foot, with the jeep at its park spot and the one-time toast shown.

## 6. Maps and UI

The mechanisms of old 10 hold: the minimap follows the player, north up, reach 46 m in the village and up to 120 m outside, redrawn 8 times a second; the Map is one sheet that zooms and pans with the World, Village and Me presets, constant-size markers, the den list and the directory buttons; the cached terrain, live borders, markers, rim darts and the caption pill; the ids `#large-map`, `#map-canvas`, `#map-north`, `#map-caption`, `.minimap`, `[data-panel="map"]`, `willowmere.map()` and the village and room drawings are kept. What changes is everything that assumed squares.

### 6.1 Shared drawing (`minimap.mjs`, `world-sheet.mjs`, `world-map.mjs`)

- **Terrain cache:** `TERRAIN = {pad: 16, half: R2 + 16 = 312, size: 624, rows: 96}`: one offscreen canvas of 624 x 624 at 1 px a metre, built on the first map draw after the first frame, 96 rows a frame over 7 frames (4.6). Pixels outside the disc stay transparent, so **the circular outline reads at a glance**. The fills are still `REGION[id].ground` by `regionAt`; the village lawn inside the ward; each region's features from `world.lands.mapFeatures(id)` (ponds, pools, nest, poison, rails, the cloud floor). The Beach's sea is drawn from the annular shape `{kind: 'sea', r0: 264, r1: R2, b0, b1}` (3.4), not a box.
- **Live strokes in metres, sharp at any zoom** (round 8's rule): every run of `BORDER_RUNS`. A `seg` is stroked as before; an **`arc` is `ctx.arc(centreX, centreY, run.r * k, a0, a1)` with canvas angles `a = bearing - 90 degrees`** (the canvas has y down, the map has north up: `atan2(z, x) = bearing - 90`, so a clockwise bearing is a clockwise canvas angle). Each run is the white casing with three colour bands (`#ff4d5e`, `#ffe14d`, `#4cc3ff`); `outer` runs get the darker casing `#3a2433`; `ward` runs are drawn at half width, the `seam`, `shared` and `sector` runs at full width (the four axes and the eight radials of the ring are as visible as the circles).
- **Trails** are stroked live as polylines along each bisector, `u * along + n * trailOffset(id, along)` every 4 m from `TRAILS[id].from` to `to` (2.8).
- **The ward** is the eight `ward` runs, always drawn; while the box is open the violet dashed line along `WARD_OUTLINE` goes on top, as in round 8. `drawVillage`, `drawRoom` and the indoor branches are untouched.
- **Label anchors:** `REGION[id].label` (2.7): a quarter at rho 112 on its bisector, a planet at rho 228 on the middle of its sector. A label is a region's short name, `Lv N+` (the inner-edge level, literally true after 2.5) and its stars, thinned by zoom as in old 10.3.

### 6.2 The minimap

- **Caption:** `REGION[regionAt(x, z)].name` in capitals, box open or shut, "Beyond the map" outside the world (`regionAt` null: only a few metres past the edge, since nobody can walk there).
- **Rim darts** keep their rule (old 10.2): out-of-reach dens ride the rim with a dart and their distance, the four home bosses always, then every other den within `RIM_REACH` = R1 = 160 m, nearest first, 8 in all with a tie at the cap let through, the sleeping dragon never. The new den layout changes who is near. From `rim.mjs` (reach 46 m in the village, 120 m outside):

| Standing at | On the map | On the rim (metres) |
|---|---|---|
| (0, 0) and the homestead (0, -8) | none | 5: the Turtle 117.0, then the four home bosses 121.9 each (at the homestead: Turtle 109.8, croc 114.7, bear 118.8, treant 125.5, mushking 129.2) |
| canyon stand (90.5, -83) | bear 37.3, Turtle 47.0, golem 99.6 | 5: shadowlord 122.1, titan_eye 138.7, croc 144.6, mushking 197.4, treant 241.8 |
| candy stand (-240, 45) | gingerbread 36.2, hydra 46.5, cake 80.4, frostowl 87.8, jellyqueen 108.0, yeti 113.4 | 5: treant 129.7, crystal queen 148.7, croc 244.4, mushking 298.8, bear 363.5 |
| lava stand (230.5, -86.5) | golem 41.3, scorpion 44.0, the nest 60.5 | 5: bear 125.0, leviathan 139.8, mushking 266.2, croc 283.0, treant 367.9 |

  **The most rim markers anywhere in the world is 8** (a 4 m grid, `rim.mjs`; round 8: 9), and the typical place has 5 (the histogram: 3 markers at 1,041 grid points, 4 at 4,111, 5 at 6,390, 6 at 4,034, 7 at 1,198, 8 at 158). The crowded-rim problem of the fix pass (open items 5 and 12) is therefore smaller than in round 8, and its `RIM_SLIDE` and the 96 px mock rule stay.
- **The den dots** inside the reach, the prison badge on its boss's crown (a cage is 6.5 m from its boss), the grey state with the return timer, the dragon's orange ring: unchanged.
- **Box shut:** fills, features, borders, names and levels; no crowns, no prisons, no creature dots.

### 6.3 The Map sheet

- **Canvas and projection unchanged;** `kMin` = the box's shorter side / **624** (was 672): the whole disc, 0.56 px a metre on a 350 px phone sheet (was 0.52). The **World preset** is centred on (0, 0). **Pan clamp:** the view's centre stays within `+/-(312 - half the view)`; when the view is wider than 624 m the centre is locked at 0 (was 336 and 672).
- **Village preset** (the footprint plus 26 m each side, `kVillage` 2.15 px a metre on a 350 px sheet) and **Me** (192 m across) are unchanged; the sheet still opens on Village inside the ward and on Me elsewhere.
- **`kNames = min(3, kVillage)`** and the three label tiers of old 10.3 stay; the first tier (k under 1.2: the World on a phone) puts the short name at the region's anchor with `Lv N+` under it, instead of "in a band at the top and bottom of each square". **Tiers 2 and 3** (`world-sheet.mjs`: `inRows`, the "top, low, mid" bands and the row lists, all built on the region's bounding rectangle from `squareOf`; builder F) are replaced by one rule: a name is placed at the **centroid of the visible part of the region**, the average of the points of a 12 x 12 grid over the visible sheet rectangle whose `regionAt` is the region (no such point: no label), with the rows (name, `Lv N+`, stars) hanging from it; so a name stays readable however far in the player has zoomed, and the sector's own anchor is used only at the World preset, where nothing is clipped. The priority order of old 10.3 drops any label that collides.
- **Fit at 0.56 px a metre, computed from the layout** (`tables.mjs`): the closest pair of crowns on the whole map is cake and gingerbread, 59.9 m = 33.5 px apart, a boss crown is 16 px across and a titan's 20.8, so the closest boss and titan (60.5 m = 33.9 px) need 18.4 px and clear by 15 px. Label anchors: the eight planet anchors are 174 m (97 px) apart along the ring, the four quarter anchors 158 m (88 px) apart, and a quarter's anchor is 124 m (69 px) from the nearest planet's; no two collide at the World preset's smallest size, and the priority order of old 10.3 drops any that would.
- **A tap** selects the marker within 22 px and prints "Crown Name . Lv . Region . distance and compass" as before; the `compass` helper already has the eight points ("212 m north-east").
- The den list under the sheet (box open) groups by region with the region you stand in first, and the cage rows, unchanged.

### 6.4 Banners, chips, the zone line

`region-banner.mjs` fires on every change of `regionAt(player)`, box open or shut, and prints `REGION[id]` (name, stars, `Lv N+`, the red "Dangerous" chip from four stars): unchanged apart from the 0.5 s dwell of 3.7 (a flip that reverts within 0.5 s fires nothing; builder A). What is new in play: stepping across a **planet-to-planet line** fires a banner too (Ember Fields to the Night Land, say), because the region changes; stepping across a **home-to-home axis** fires one as well. The region names fit the phone caption pill as in round 8 (`maps.css`, `tests/maps-browser.mjs` at 390 x 844, 844 x 390 and 1440 x 900).

### 6.5 Home, the far view, braking

- **Home's magic threshold stays `wildDepth >= 20`** (the ward did not move; `world.HOME.magic`, `wake.mjs` `FAR`): from anywhere in a planet the player is at least 84.6 m beyond the ward, so Home there is always the magic hop; in the home ring the walk is under 20 m only close to the ward. The longest walk left is unchanged (95.5 m).
- **`FAR_DEPTH = [24, 84]`** (was `[24, 104]`; `drive.mjs`). The far view starts 24 m beyond the ward and is full at **84 m**, because the home ring is **84.6 m deep at its narrowest** (the north-east and north-west corners; 103.5 to 118.5 on the sides): the view is full by the time the car reaches the inner circle in every direction. With the old 104 m it would be 85% open at the inner circle in the corner direction (84.6 m deep) and 99.99% on the east axis (103.5 m); the planets are entered at 84.6 to 118.5 m. The pull-back's easing (`1 - exp(-dt * 2.2)`), `FAR_VIEW` 36 and the rig-distance, far-plane, fog and shadow rules of old 9 are unchanged.
- **Edge braking** is 2.9: analytic `edgeAhead`, `edgeDepth`, the tangent slide, no notches.
- The Home button, `homeGuide` and the phone "Way back home" card are unchanged by the geometry; the fix pass owns their overlap fixes.

## 7. Tests

Found by searching `tests/` for the identifiers `CELL`, `HALF`, `GRID_IDS`, `squareOf`, `cellOf`, `cellIdAt`, `stripSide`, `edgeDistance`, `inWorld`, `edgeAhead`, `BORDER_RUNS`, `RUNS_OF`, `DENS`, `nearestLand`, `EDGE_BOX`, `worldPoint`, `TERRAIN`, `trailOffset`, `TRAILS`, `trailDistance`, `borderDistance`, `gridBorderDistance`, `homeBorderDistance`, `RIM_REACH`, `EDGE_PAD` and for coordinates outside the ward (`tests/*.mjs` at `1b65987`). Ward-only suites (`tests/civic.test.mjs`, `tests/merge.test.mjs`, `tests/west-ways.test.mjs`, `tests/pond.test.mjs`, `tests/farm.test.mjs`, `tests/browser.mjs`, `tests/house-browser.mjs`, `tests/doors-browser.mjs`, `tests/release.mjs`, `tests/activities.mjs`) do not change; the ward is not touched (`tests/village.test.mjs` is ward-only except one assertion and one creature loop, 7.1). Each builder re-reads every row of its own files: the list below comes from the identifiers and coordinates above, and a test that reads a position through `DENS` follows the new rows by itself.

### 7.1 Node tests (`npm test`) that change

| File (owner) | Test | What it becomes |
|---|---|---|
| `tests/regions.test.mjs` (A) | "the ward: a rectangle that hugs the village, one export, re-exported by `wilds.mjs`" | keeps the ward assertions (`SAFE`, four vertices, the exports); drops the `CELL`, `GRID`, `GRID_IDS`, `cellIdAt`, `squareOf` and the 60 m vertex limit (it kept 4 m of strip); adds: the ward corners are 75.45 m at most from the origin and `R1 - 75.45 >= 84`; the ward outline cut at the axes gives exactly the 8 `ward` runs |
| | "`regionAt`, the squares and the border runs, as the grid is drawn" (`gridChecks`) | **"`regionAt` in polar terms"**: every tie point of 2.3's table with its id (24 points); the exact predicates against `bearingOf` on a 2 m grid (0 disagreements); each region's area from a 0.5 m sample within 1% of the annular-sector formula (`pi (r1^2 - r0^2) (b1 - b0) / 720`, less the ward's share for a quarter); the 36 runs: kinds and counts (8, 4, 8, 8, 8), lengths (409.0, 425.0, 1,005.3, 1,088.0, 1,859.8 within 0.1; total 4,787.1), `left` and `right` as the table of 2.8, `RUNS_OF` sizes (village 8, quarter 6, planet 4); every run's two sides, sampled 0.25 m off its middle, are its `left` and `right` |
| | "distances: to a border, to a full ribbon, to the home side, to the edge" | `borderDistance`, `gridBorderDistance`, `homeBorderDistance`, `sectorBorderDistance` at named points (on an arc, on a radial, 10 m inside a quarter, on the ward line), `edgeDistance = R2 - rho`, `inWorld` at R2 - 2 and R2 - 2.001, `EDGE_PAD`, `RIM_REACH = R1`, `distanceToRegion` (0 inside, the least run distance outside) |
| | "`edgeAhead` measures to the padded world, the line that blocks" | the analytic ray equals a 1 mm march on 2,000 seeded rays to within 1 mm; `Infinity` beyond 48 m; 0 outside the padded circle; a tangent run from 1 m inside gives 24.2 m |
| | NaN and infinity | `regionAt` null, `edgeDepth` Infinity, `inWorld` false, `edgeAhead` 0 and `clampToWorld` finite for NaN and Infinity input: a non-finite position is blocked, as in round 8 |
| | "the four trails: the reference's wander, from the ward line to the far side of each home square" | the four bisector trails: `from` 73.96, 62.69, 60.94, 73.96 (computed: the first point whose whole half width is outside the ward; no centreline point of any trail inside the ward) and `to` R1, lengths 86.0, 97.3, 99.1, 86.0; `trailOffset(id, along)` unchanged; `TRAILS[id]` has exactly `bearing, from, to`; the Turtle's den is 36.5 m or more from a trail's near edge; the east **seam**'s first point is at `GATE_END + 1.1` and `GATE_END` equals `GATE_ROAD.x1` of `field-layout.mjs` (the one place a **test**, not the code, imports it) |
| | "a copy with CELL = 256 keeps every assertion that is written in CELL" | **"a copy with `R1 = 168`, `R2 = 320` keeps every assertion written in `R1` and `R2`"**: the test writes `regions.mjs` with the `RING` line replaced (and `den-rows.mjs`, `ward.mjs`, `hyp.mjs` and `power.mjs`: every file `regions.mjs` imports; the test reads the copy's import list and fails if one is missing) to a temp directory and runs the same ring checks on both; `TRAILS.east.to` 168, `RIM_REACH` 168; the `(227, -185)` line goes |
| `tests/borders.test.mjs` (A) | "the ribbon is one mesh of 468 quads: eleven strips a run, a knot at every grid vertex ..." | **2,884 quads and 5,768 triangles** = 11 x (16 arcs x 15 steps + 20 straight runs) + 24 knots (16 full at the junctions of R1 and R2 with the eight radials, 8 slim on the ward line); one geometry, one draw; an arc's vertices satisfy `abs(hyp(x, z) - (r + o)) < 1e-9`; the chord's sagitta is at most 0.11 m |
| | "each run's strips: white edges, the accent of the region on each side, seven rainbow stripes; full width on grid ..." | the same strips on a segment and on an arc; full width on `seam`, `shared`, `sector`, `outer`, half on `ward`; accents from `REGION[left]` and `REGION[right]`; white outside an `outer` run; no vertex of a `seam`, `shared`, `sector` or `outer` run within 0.9 m of the asphalt (`onWay`), 2.8 |
| | "the ward's ribbon hugs the ring road without touching it" and "the banner's words" | unchanged in meaning (the eight slim ward runs have the same inner edges, +/-55.505 on the west and east); the banner test reads the new `DENS` |
| `tests/village.test.mjs` (A, in step 0; **taken off the frozen list for exactly this**) | the creature and ward block: `assert.equal(regionAt(SAFE.x0 - 2.5, 0), 'west')` | (-59, 0) is on the west axis and belongs to the NW `north` by the tie rule of 2.3 (`world.mjs` returns `north`), so the frozen assertion fails after step 0 and no change to the cause can save it; the assertion becomes `regionAt(SAFE.x0 - 2.5, 5) === 'west'` (off the axis, z = 5 is in the SW quarter) plus `regionAt(SAFE.x0 - 2.5, 0) === 'north'`. The same block's `wildCell` loop over cells -4 to 4 asserts `n > 60` and that the nearest creature is 2 to 8 m beyond the ward: step 0 re-measures both on the new seeds and rows and sets the bounds from the measurement |
| `tests/fields.test.mjs` (A) | "every tile of the world and its rim has a stable plan inside its budget, with nothing in the ward, on a border ..." | loops the 88 world tiles and the 76 rim tiles instead of the cells of `GRID_IDS`; the budget: `TILE_KINDS` (3 on a tile of two or more regions, 4 on one), 40 pieces, 220 cards, 20 rim pieces a land; nothing in the ward, within 3 m of a border, 5 m of a trail, 32 m of a titan; `nearestLand` becomes `rimLand`; the plan is the same twice |
| | "the ground takes each region's recipe: home colours with their trails, the lands' own, the rim's beyond the edge" | trails on the bisectors; the ground class of a quad by its centre's region; colours continuous across every run kind including arcs (a 0.5 m step changes no channel by more than 0.08 outside the 3 m blend); the rim's colour beyond the disc by sector |
| `tests/game.test.mjs` (M) | "a save keeps any place in the world, in every square; one outside it wakes in the homestead yard with the cars parked" | "a `layout: 2` save keeps any place inside the circle, in every region; one outside it wakes in the yard with the cars parked"; plus the migration cases of 5.4 |
| | "a vehicle left outside the world is parked; one you may not drive yet is not ridden; a heading is a number" | `HALF` becomes `RING.R2`: a spot at R2 - 2 is outside |
| `tests/render.test.mjs` (C) | "the far view: a second pull-back by distance beyond the ward, the larger of it and the speed one; shadows by the effective zoom" | `FAR_DEPTH = [24, 84]`: `farZoom` is 1 at depth 24, smooth in between, full at 84 and beyond; the edge figures by `RING.R2` |
| | "the world's ..." (`bounds`, `blocked`, `edgeDepth`) | `bounds` is `{294, 294}`; `edgeDepth` is `max(0, hyp - 294)` everywhere; `edgeAhead` from `(R2 - 30, 0)` east is 28 m; the eleven probe points (`HALF - 1`, `HALF + 40`, `[128, -256]`, `[227, -185]`, `[66, -194]`, `[-193, 63]`, ...) are replaced by eleven ring points (on and either side of the padded circle at four bearings, the origin, a point beyond the circle, `[5000, 5000]`) |
| | "routes keep to the world: round a notch outside the line that blocks, a tapped end moved off the edge, a pond ..." | **"routes in a disc"**: a tapped end beyond the rim lands at radius 292.7; a start in the band gets a first straight leg; 500 seeded pairs of points inside the padded circle give routes that never leave it; `navigation.mjs` no longer exports `EDGE_BOX`, `worldPoint`, `worldClear` or `edgeObstacles` (this test's imports become `inWorld` and `clampToWorld`); `findRoute` keeps its box test for rooms and takes the circle only when `bounds.r` is given (a route in a room never uses a node outside its box; the `decor`, `house-life` and `fields` tests still pass); the pond box `2 (r + 0.8)` stays |
| | "the light of a place: home light everywhere but inside a land, fading in over 24 m from the home region it touches" | the two-term blend of 2.7 (`landLightAt`'s `nb` and `nbShare`, the sun's intensity included): home in every quarter and on every inner arc, own light from 24 m in, 0.5 / 0.5 on a planet-to-planet line, continuous across it (a 0.01 m step changes the mix by under 0.01); the `(227, -185)` and `(400, 0)` lines go |
| `tests/wake.test.mjs` (C) | the three tests (`wakeGreeting`, `idleLabel`, `locationLine`) | coordinates from the stands of 3.5 and the den rows (`squareOf` and `DENS` reads); `wakeGreeting` with `moved: true` returns the redrawn-map line of 5.3 |
| `tests/minimap.test.mjs` (F) | "a frame is a clean circle, north up: clipped, the regions, trails, village and borders drawn in metres ..." | the fake context records `arc` calls: 16 arc strokes with canvas angles `bearing - 90`, 20 straight runs; region fills as annular sectors; trails along the bisectors |
| | "which dens ride the rim: the four home bosses always, the nearest others within 160 m, eight in all with a tie ..." and "the minimap marks every den near you ..." | the table of 6.2; the most markers anywhere is 8 |
| | "the Map's camera: zoom limits, the three presets, the pan clamp, a zoom anchored where you point" and "the terrain cache: built 96 rows a frame over seven frames ..." | `TERRAIN.size` 624, `kMin = side / 624`, the pan clamp `312 - half the view`, 7 frames |
| | "the Map's sheet ..." and "builder B's real land features on the maps (merge F): the Beach's sea is its band" | anchors from `REGION[id].label`; the sea drawn from `{r0: 264, r1: R2, b0, b1}`; the label order drops what overlaps |
| | "crowded rims stay readable (round 8 fix) ..." | the same assertions on the new den layout |
| `tests/finish.test.mjs` (B) | `assert.match(html, /13 squares/)` against `combat-hud.mjs` `pandoraPanel` (the fix pass's commit `3760f99`) | the panel and the test say the ring: "Creatures live in all twelve regions beyond the village: four home regions round it and eight planets beyond them", asserted as `/twelve regions/`; `pandoraPanel` is the one function of a frozen combat file this round touches, and it is B's |
| `tests/region-life.test.mjs` (B) | "ground and light ..." and "a tile's plan: its own regions' kinds, inside the budget, clear of borders, trails, titans and every feature" | `TILE_KINDS`; the light assertions use `lightMix`'s two fields |
| | "a jeep can still drive the real scenery: 20 s through each home region on 8 headings, nothing driven through" | starts at the four quarter stands of 3.5 instead of the squares' centres |
| `tests/region-mix.test.mjs` (B) | "26 dens: each in its own region, 36 m from every grid border, 56 m from the next den, off every cell seam" | the rules of 3.1; `d.level` is `levelAt(den) + 6`, not `REGION[region].bossLevel`; the trail check uses the north-east bisector trail |
| | "the seeded plan: every creature in its own region and clear of the ward, the borders, the seams, the corners, ..." | the corner clause goes |
| | "counts: every region holds its target within 2, every kind of its mix lives there, ..." | the `TARGET` table of 3.6 |
| | "level and power per creature: ..." | `powerAt` and `levelAt`: the inner edge equals round 8's table, the rim equals the table at d + 0.8, `RADIAL_STEP = 0` reproduces every round 8 number exactly |
| `tests/land-effects.test.mjs` (B) | "placement: every feature lies inside its own square, clear of the borders, the dens and the titans' arenas" | the polar rules of 3.4 (`gridBorderDistance` for the edge, the ward distance for home ponds), and the counts: 4 pools, 12 islands, 3 / 6 / 6 / 15 seeded |
| | "the Night Land: a lit lamp is a disc for 150 s, ... the dark" | `nightShare` continuous across both planet lines |
| `tests/friends.test.mjs` (B) | the three cage tests | the rows of 3.3; cages 29.5 m or more from borders |
| `tests/bosses.test.mjs`, `tests/titans.test.mjs`, `tests/pandora.test.mjs` (B) | den lookups; "no titan ends a step, or a leap, more than 30 m from its den" (reads `squareOf`); "spawn plan: ... one King Bear in his canyon den" | `regionAt` instead of `squareOf`; the bear's den is in `east` |
| `tests/seams.test.mjs` (A) | the seam names | adds the exports of 8.2; asserts, **switched on by the last merge (F's, because F owns the last readers, `minimap.mjs` and `world-sheet.mjs`; until then it prints the readers left and passes)**, that `CELL`, `GRID`, `HALF`, `GRID_IDS`, `cellOf`, `cellIdAt`, `squareOf` and `stripSide` are no longer exported or imported anywhere in `src/`; and, from step 0, that `power.mjs`, `regions.mjs`, `region-mix.mjs` and `den-rows.mjs` form no import cycle (each imported first, alone, in a fresh process) and that `regions.mjs` does not import `field-layout.mjs` |

### 7.2 Browser suites that change

All run one at a time with `GPU=1` as in round 8, on the ports of 8.4.

| Suite (owner) | What encodes the squares | Becomes |
|---|---|---|
| `tests/borders-browser.mjs` (A) | `BORDER_RUNS.length 40`, 936 triangles, the quad formula `11 * runs + 24 + ward`; the banner on crossing x = 192 ("Night Land"); the stands `(128, 0)`, `(-128, 0)`, `(-128, 112)`, `(0, -300)` | 36 runs, 5,768 triangles, `11 * (16 * 15 + 20) + 24`; a banner on crossing **each kind of line**: a home arc, a planet-to-planet radial, a home axis, the outer edge; the stands of 3.5; the rim spot at rho 290 |
| `tests/edge-browser.mjs` (C) | an empty cell's side and its corner, the notch near (-64, -192), `GRID_IDS` | **eight bearings** (0, 45, ... 315 degrees plus 22.5) on foot and by jeep and bike: stops 2 m inside the padded circle, slides along it, the toast once; a tapped walk to a point beyond the rim ends on the circle; a car at top speed brakes to a crawl before the wall |
| `tests/maps-browser.mjs` (F) | rim lists (`'treant', 'croc', 'mushking', 'bear', 'titan_turtle', 'cake', 'robot', 'leviathan', 'phoenix'`), the minimap stands `(128, -60)` and `(-128, 112)`, `squareOf` for the labels, "all thirteen squares", the World extents +/-320 | the tables of 6.2 at the new stands; the labels at the anchors; the World preset's extents +/-312; "all twelve regions and the ward" |
| `tests/lands-browser.mjs` (B) | `STAND = { west: [-128, 0], ... }`; the ride `[(70, -8), (185, 0), (300, 6)]` (x = 300 is outside the circle); `(128, -128)`, `(174, -120)` sand and sea probes; "the world's half is 320 m" | the stands of 3.5; the ride `[(70, -8), (90.5, -83), (230.5, -86.5)]`; the sea probe at rho 280 on the Beach's radial, the sand probe at rho 240; "the circle's radius is 296 m" |
| `tests/bosses-browser.mjs`, `tests/titans-browser.mjs`, `tests/prisons-browser.mjs` (B) | `beside(den)` stands 6 m toward the square's centre (`squareOf`); `DENS` rows; `LAND_KITS` distance by `squareOf` | `beside(den)` stands 6 m toward the village (0, 0); the kit distance by `distanceToRegion`; positions follow `DENS` |
| `tests/render-browser.mjs` (C) | the steering checks drive about 425 m of path ending near (406, -188), now outside the world | the legs are re-planned inside the padded circle (at most 280 m out); the same assertions |
| `tests/vehicle-browser.mjs`, `tests/home-browser.mjs`, `tests/camera-browser.mjs` (C) | `x >= 250` drive; positions `(256, 0)`, `(150, 150)`, `(128, 0)` | re-run: the first two stay inside the circle and still pass; `camera-browser` moves its "(128, 0) in the fields" spot to the canyon stand (90.5, -83) because (128, 0) is now under the east seam's ribbon; one new `vehicle-browser` case seeds a `layout: 1` far save (5.4) |
| `tests/travel-kit.mjs`, `tests/travel-shots.mjs` (C) | `travel-kit.mjs` imports `inWorld` and defaults its evidence directory to `evidence-round8/C`; five of its six importers (camera, edge, home, vehicle, wake) are C's and `drive-budget-browser` is A's; `travel-shots.mjs` uses `HALF` and `EDGE_PAD` | C owns both files: `inWorld` from the new `regions.mjs` (same name, a circle), the default `evidence-round9/C`, `HALF` replaced by `RING.R2`; A re-runs `drive-budget-browser` against the new kit |
| `tests/pandora-browser.mjs`, `tests/wake-browser.mjs` (B, C) | seeded positions `(130, 10)`, `(150, 30)`, `(157, -21)` with "regionAt === 'east'" and a bear nearby | the canyon stand (90.5, -83) and positions beside the bear's den (110.5, -51.5) |
| `tests/budget-browser.mjs`, `tests/drive-budget-browser.mjs`, `tests/fields-browser.mjs` (A) | the SPOTS of old 18 | the spots of 4.6; the fields-browser's far start and walk home from a stand |
| `tests/round6-browser.mjs`, `tests/round7-browser.mjs` (F) | minimap blocks and the King Bear on the map | the same checks at the new den positions |
| `tests/fishing-simple-browser.mjs`, `tests/farm-browser.mjs`, `tests/doors-browser.mjs` | the Map's directory buttons | unchanged |

### 7.3 New tests

| Test (owner) | What it proves |
|---|---|
| `tests/regions.test.mjs` (A): polar regions | 2.3's ties; no point of the world has two regions or none; the predicates against the bearing |
| `tests/regions.test.mjs` (A): borders as arcs | 2.8's 36 runs; `runDistance` to an arc against a brute-force minimum over 3,600 points of it; ribbon geometry |
| `tests/regions.test.mjs` (A): the edge | `edgeDistance`, `edgeDepth`, `edgeAhead` (analytic against a march), `clampToWorld` |
| `tests/field-straddle.test.mjs` (A, new) | tiles at straddles: every share table sums to the region areas (over all tiles, each region's `share * 4096` is within 3% of its area); the three-region tiles `(-2,-2) (-2,1) (1,-2) (1,1)` plan with at most 3 kinds; no region with at least 5% of any tile is left with no blocking kind (pass 1 of `TILE_KINDS`, 4.3); `fieldBlocked` agrees with the colliders of the built tiles on 2,000 seeded points (5.3); ground class groups: 56 / 30 / 2 tiles of 1 / 2 / 3; a straddling tile's rim pieces are all outside the disc and its scenery all inside; the 12 trail tiles; the plan is the same on a second call; the index reorder keeps every quad exactly once |
| `tests/save-layout.test.mjs` (M, new) | 5.4 |
| `tests/den-rows.test.mjs` (B, new) | `denRows(RING)` puts every den in its region with every clearance of 3.1 for every `R1` in 160...176 (steps of 4) and `R2` in `R1 + 136...R1 + 160` (steps of 8): the tuning window of 2.1, and the leash sums of 3.2 |
| `tests/light-seam.test.mjs` (C, new) | continuity of `landLightAt`'s mix, `nightShare` and the sun's intensity across every `sector` run and every `shared` arc, 2.7 |
| `tests/borders-browser.mjs` (A) | ribbons visible and one draw; a banner on each kind of line; the gate road: zero banners from region flips on the spur, at most one for leaving the village (3.7) |
| `tests/edge-browser.mjs` (C) | eight bearings, 7.2 |

## 8. Builders

### 8.1 Order, branches, and the rule that nothing reaches main

**Nothing is pushed until the final check says ship.** `.github/workflows/pages.yml` publishes every push to main, and the game is live. All ring work happens on `ring9`, a branch of `round8`, in its own worktree; the builders' branches merge into `ring9`, and `ring9` goes to main once, after the final check (the fix pass's plan: "I'll push to main only if the verifier says ship").

**Where `ring9` is cut from:** the last commit of the running fix pass on `round8` (its verifier's "ship" commit) if it has landed by then; if work must start earlier, from `798ed32` (the head at the review) and rebased onto each later fix-pass commit (8.6). Round 8 itself is on main at `446e5f9`; `round8` is 19 commits ahead of it and not pushed.

Merge order **A, C, M, B, F**, after **step 0**. `npm test` is green after step 0 and after every merge. The browser suites are not all green until their owner's merge (8.5): the ring moves every position outside the ward, so a suite that seeds a position or reads a den cannot pass before its owner has re-seeded it.

### 8.2 Step 0: builder A, alone, on `ring9`, port 4431

Step 0 creates every seam with **the real new geometry** (it is 90 lines of pure code, Appendix A), not stubs, so that four builders can start the day it merges. It does not have to look right on screen: the tiles may still draw the stand-in scenery.

1. `src/regions.mjs`: the constants block (2.1) and everything of 2.3 to 2.9 that is pure: `QUARTER_ID`, `SECTOR_ID`, `quarterIndex`, `sectorIndex`, `bearingOf`, `regionAt`, `REGION` (with `quarter`, `bearings`, `label`, and the old `level`, `bossLevel`, `stars`, `ground`, `accent`), `shapeOf`, `distanceToRegion`, `BORDER_RUNS` (36, each with `type`), `RUNS_OF`, `runDistance`, `runPoints(run, stepDeg)` (the points of a run for a mesh or a stroke), `borderDistance`, `gridBorderDistance`, `homeBorderDistance`, `sectorBorderDistance`, `edgeDistance`, `inWorld`, `edgeDepth`, `edgeAhead`, `clampToWorld`, `inWilds`, `TRAILS` (bisectors), `trailOffset`, `trailDistance`, `difficultyAt`, `levelAt`, `RIM_REACH`, `EDGE_PAD`, `DENS` (built from `den-rows.mjs`), `DEN` (the bear's row, as before). `src/ward.mjs` is unchanged.
2. `src/den-rows.mjs`: the 26 rows of 3.2 (real).
3. `src/power.mjs` (new, 2.5: `POWER`, `powerOf`) and `src/region-mix.mjs`: `powerAt` (real, importing `power.mjs`; `POWER` re-exported); `TARGET` set to the table of 3.6; `DENSITY` unchanged. `src/land-features.mjs`: `build()` with the rows and counts of 3.4, the sea as an annular band, `landClear` on the region boxes. These two are B's files; step 0 edits them only as far as the node tests need.
4. `src/save-layout.mjs`: `LAYOUT`, `KEEP`, `keepable`, `migrateLayout` (real, Appendix B); `src/game.mjs`: `freshState` writes `layout: 2`. Not yet called from `parseSave` (M does that).
5. **Shims, so that every reader loads and nothing else has to change on day one** (each is deleted by the owner of its last reader; `tests/seams.test.mjs` asserts at the end that none is left):

| Shim | Is | Readers today (owner) |
|---|---|---|
| `squareOf(id)` | `shapeOf(id)` | `land-features.mjs`, `land-view.mjs`, `wilds-draw.mjs` (B); `minimap.mjs`, `world-sheet.mjs` (F); `field-layout.mjs` (A); the tests of 7 |
| `CELL` | 128 | `world.mjs`, `borders.mjs`, `land-features.mjs`, `navigation.mjs`, `minimap.mjs` and tests |
| `HALF` | `RING.R2` | `world.mjs`, `navigation.mjs`, tests |
| `cellIdAt(x, z)` | `regionAt` | `field-layout.mjs`, tests |
| `GRID`, `GRID_IDS`, `cellOf` | **removed in step 0**; their readers (`borders.mjs`, `navigation.mjs`) are rewritten there to the minimum that compiles: `navigation.mjs` `EMPTY = []` and `findRoute`'s `bounds.r` test (2.9) | A, C |

6. The node tests of 7.1 that the geometry breaks are rewritten (each by its eventual owner's rules but in step 0's hands), so `npm test` is green. The browser red list is 8.5.
7. **The bundle limit** (`scripts/build.mjs`: 1,100,000 bytes before the first frame, the static-import closure of `game.js`). **Measured** at `798ed32` (`bsize.mjs`: esbuild with the build script's options, minified, the first-load set walked as the script does, nothing written): **1,098,048 bytes, 1,952 to spare**. The first draft's 448 bytes was an older figure (`ROUND8-PERF2.md` recorded 84 at its own commit; the pass has moved code since). The ring adds `den-rows`, `power`, the arc runs and `shapeOf`, `save-layout`, the light seam and the analytic edge code to the first-load set and removes `GRID_IDS`, `stripSide`, the empty-cell routes and the minimap's strips; the net is **an estimate of about +6 KB, which would overshoot**, and a failed build at step 0 blocks everyone. **Owner: builder A decides in step 0 and records the real figure here**, because A, B and F all add to the first-load set. Levers, in the order to pull them, each moving code behind `import()` the way `wilds-view.mjs` fetches `wilds-draw.mjs`: (a) the body of `migrateLayout` and its den table (needed once, when a `layout: 1` save loads: `boot()` may `await import()` it before `parseSave` finishes; M's call); (b) the minimap's terrain cache, arc strokes and label code (`minimap.mjs`, used only when a map is drawn; F's); (c) `land-features.mjs`' seeded generators (built when the player nears a land, not at the first frame; B's). Each is a function-level split, not a rewrite.

### 8.3 Who owns what (no file, and no test file, has two owners)

Ownership is by file, and inside the three shared files (`src/world.mjs`, `src/main.mjs`, `src/wilds.mjs`) by **function**.

| Builder | Whole files | Functions in shared files | Test files |
|---|---|---|---|
| **A** world geometry, borders, tiles, edge data | `src/regions.mjs`, `src/borders.mjs`, `src/field-layout.mjs`, `src/fields.mjs`, `src/region-banner.mjs` | `src/world.mjs`: `loadKit` (the two-fetch queue, 4.5) | `regions.test`, `village.test` (step 0, one assertion and one loop, 7.1), `borders.test`, `fields.test`, `field-straddle.test` (new), `seams.test`, `borders-browser`, `fields-browser`, `budget-browser`, `drive-budget-browser`, `borders-shots`, `borders-measure` |
| **B** content: dens, cages, features, mixes, levels, lights | `src/den-rows.mjs`, `src/power.mjs` (new), `src/land-features.mjs`, `src/land-view.mjs`, `src/land-effects.mjs`, `src/light-mix.mjs`, `src/region-life.mjs`, `src/region-mix.mjs`, `scripts/tune-density.mjs` | `src/wilds.mjs`: `wildCell`, `cornerOf`, `CORNERS`, `SPAWN` and the one predicate `Wilds.walkable` (circle, own region, gate strip) only (not the rest of the `Wilds` class); `src/wilds-draw.mjs`: `near` only; `src/combat-hud.mjs`: `pandoraPanel` only | `region-life.test`, `region-mix.test`, `land-effects.test`, `lava-weather.test`, `friends.test`, `bosses.test`, `titans.test`, `pandora.test`, `creature-render.test`, `finish.test`, `den-rows.test` (new), `lands-browser`, `bosses-browser`, `titans-browser`, `prisons-browser`, `pandora-browser` |
| **C** vehicle, Home, camera, edge braking, routes | `src/navigation.mjs`, `src/drive.mjs`, `src/drive-view.mjs`, `src/wake.mjs` | `src/world.mjs`: `bounds`, `blocked`, `edgeDepth`, `edgeAhead`, `routeObstacles`, `routeTo`, `applyLights` (reads the two new light fields), `restoreVehicles`, `towVehicles`, `init` (the `lost` check only), the constructor's `lightAt`, `push` and the walking step (the edge slide, 2.9); `src/pandora-view.mjs`: the one `sight.dark` line; `src/main.mjs`: the Begin toast's call and the `moved` flag only | `render.test`, `wake.test`, `light-seam.test` (new), `travel-kit.mjs` and `travel-shots.mjs` (helpers, 7.2), `edge-browser`, `render-browser`, `vehicle-browser`, `home-browser`, `camera-browser`, `wake-browser` |
| **M** saves | `src/save-layout.mjs` | `src/game.mjs`: `freshState` and the one call in `parseSave` | `game.test`, `save-layout.test` (new), `tests/fixtures/save-round8-far.json` |
| **F** maps | `src/minimap.mjs`, `src/world-sheet.mjs`, `src/world-map.mjs`, `src/outdoors.mjs`, `src/maps.css` | none | `minimap.test`, `maps-browser`, `maps-shots`, `maps-merge-shots`, `round6-browser`, `round7-browser` |
| **Nobody** | `src/ward.mjs` and everything the "Nobody" row of old 11.2 freezes: `village-plan`, `lots`, `lots-view`, `grove`, `grove-view`, `pond`, `rod-fishing`, `fishing`, `villagers*`, `village-view`; the combat, titan and friend files; the fix pass's `governor.mjs`, `hyp.mjs`, `sun-shadow.mjs`, `toon.mjs`; `civic.test`, `merge.test`, `west-ways.test`, `pond.test`, `farm.test`, `browser`, `house-browser`, `doors-browser`, `release`, `activities` | | |

If a frozen test fails at a merge, the person merging fixes the cause, not the test (old 11.2); the one exception, `tests/village.test.mjs`, is in 7.1 (its failure is the tie rule, which is the design). **`tests/blocks.test.mjs` lifts one-line `World` methods by name from the source of `world.mjs`**: C keeps `edgeDepth`, `blocked`, `edgeAhead` and `push` each on one line that starts with a space and the method name, or the test cannot find them. No file and no test file has two owners: the lists above are complete for the 26 review findings (8.6 lists the fix pass's functions beside them).

### 8.4 Seams (exported names, all present from step 0) and ports

| From | Export | Used by |
|---|---|---|
| A (step 0) | `RING`, `RADIAL_STEP`, `ARC_STEP`, `QUARTER_ID`, `SECTOR_ID`, `regionAt`, `quarterIndex`, `sectorIndex`, `bearingOf`, `REGION`, `shapeOf`, `distanceToRegion`, `BORDER_RUNS`, `RUNS_OF`, `runDistance`, `runPoints`, `borderDistance`, `gridBorderDistance`, `homeBorderDistance`, `sectorBorderDistance`, `edgeDistance`, `inWorld`, `edgeDepth`, `edgeAhead`, `clampToWorld`, `TRAILS`, `trailOffset`, `trailDistance`, `difficultyAt`, `levelAt`, `RIM_REACH`, `EDGE_PAD`, `DENS` | everyone |
| A | `rimLand(x, z)`, `fieldRim(tx, tz)` `{lands, pieces}`, `tileRegions`, `TILE_KINDS`, `trailTile`, `fieldPlan` (as round 8 plus `rim`), `fieldBlocked(x, z, r)`, `kitReach(kit, x, z)` | B (`cardKeepOut`, scatter), tests |
| B (step 0) | `denRows`, `powerAt`, `TARGET`, `DENSITY`, `FEATURES`, `landClear`, `waterAt`, `blockers`, `mapFeatures`, `landLightAt(x, z, lights, out)` with `out.nb` and `out.nbShare` added, `power.mjs` (`POWER`, `powerOf`) | A (tiles), C (`applyLights`), F (map shapes), tests |
| C | `world.edgeDepth(x, z)`, `world.edgeAhead(x, z, dx, dz)`, `edgeSlide(x, z, vx, vz, out)`, `FAR_DEPTH`, `farZoom` | C's own `DriveView` and the browser suites (nobody else needs them) |
| M (step 0) | `migrateLayout`, `LAYOUT`, `KEEP`, `keepable` | C (the `moved` toast), tests |
| F | `denStatuses`, `terrainCache`, `TERRAIN` | tests |

**Worktrees, branches, ports** (`C:/Users/n/source/repos/`; one browser suite at a time per port, `GPU=1`; 4173 belongs to others):

| What | Worktree | Branch | Port |
|---|---|---|---|
| integration, step 0 | `3d_farmer_fish_sell-ring9` | `ring9` | 4431 |
| A | `3d_farmer_fish_sell-r9-a` | `r9-a` | 4432 |
| B | `3d_farmer_fish_sell-r9-b` | `r9-b` | 4433 |
| C | `3d_farmer_fish_sell-r9-c` | `r9-c` | 4434 |
| M | `3d_farmer_fish_sell-r9-m` | `r9-m` | 4435 |
| F | `3d_farmer_fish_sell-r9-f` | `r9-f` | 4436 |
| the final verification | `ring9` | | 4437 |

Evidence in `C:/Users/n/source/repos/cute_game-notes/willowmere/evidence-round9/<builder>/`: screenshots at 390 x 844, 844 x 390 and 1440 x 900 at the stands of 3.5, the three-region junctions, the rim and each kind of border; `measureCalls()` and `renderer.info.render.triangles` at the spots of 4.6 on "battery" and "high", before and after.

### 8.5 What starts at once, what waits, and the red list

| Builder | Starts the day step 0 merges | Waits for |
|---|---|---|
| A | everything: ribbon mesh, rim, material groups, `TILE_KINDS` with its floor, `fieldBlocked`, `kitReach`, the far-view lever (merged only on a measured pass, 4.6), the three-region tiles, the trail set, boot with nine tiles | nothing |
| B | den rows and the radial gradient in the tests, feature tables, `scatter` in the region boxes, `landLightAt` fields, `power.mjs`, `tune-density` | nothing (A's real tiles change what it sees in a browser, not what it codes) |
| C | the edge, routes, braking, `FAR_DEPTH`, the toast | nothing: it reads step 0's exports |
| M | the call in `parseSave`, the tests, the fixture | nothing |
| F | the terrain cache, the strokes, labels, the rim tables | nothing; it merges last and runs every suite |

**Merge order A, C, M, B, F:** A first because the tiles and the ribbon are the largest change and every later browser run draws them; C before B because B's night and light seams read the edge and `applyLights`; F last because it draws everything and re-runs every suite.

**Browser red list** (a suite named here may fail until the merge named; everything else must pass at every merge):

| After | Allowed red |
|---|---|
| step 0 | every browser suite of 7.2 whose seeds or reads changed: `borders-browser`, `edge-browser`, `maps-browser`, `lands-browser`, `render-browser`, `fields-browser`, `budget-browser`, `drive-budget-browser`, `camera-browser`, `wake-browser`, `pandora-browser`, `bosses-browser`, `titans-browser`, `prisons-browser`, `round6-browser`, `round7-browser` |
| A | `edge-browser`, `render-browser`, `camera-browser`, `wake-browser`, `lands-browser`, `bosses-browser`, `titans-browser`, `prisons-browser`, `pandora-browser`, `maps-browser`, `round6-browser`, `round7-browser` (the 4 of A's own are green) |
| C (then M) | `lands-browser`, `bosses-browser`, `titans-browser`, `prisons-browser`, `pandora-browser`, `maps-browser`, `round6-browser`, `round7-browser` |
| B | `maps-browser`, `round6-browser`, `round7-browser` |
| F | none |

### 8.6 The running fix pass: what it is changing, and how to rebase on it

At `798ed32` the fix pass has made 19 commits since main. The first draft read `1b65987` (14); the five since are `3760f99` (the Pandora panel says "all 13 squares"), `393a81d` (`tests/finish.test.mjs`), `ca5aa5e` and `40cde7d` (an open cage wins the tap and the E key over the boss standing on it) and `798ed32` (the player card's land line); `git diff 1b65987..798ed32` touches `combat-hud.mjs`, `hud-reference.css`, `outdoors.mjs` (3 lines), `pandora-view.mjs` (10 lines), `finish.test.mjs`, `finish-shots.mjs`, `lands-browser.mjs` and `prisons-browser.mjs`. It is **still working**: the relayed plan names more to come (the village mesh split into culled chunks and trimmed of what round 8 added with Pandora closed, an automatic quality reduction, effects and creature allocation, reuse of field-tile geometry, Ember Fields hot, the trains wording, hazard toasts, "Reloading far out no longer says Welcome home", the action button and location line naming the region, the Pandora panel, phone overlaps). **The table is the list of functions it touches, frozen as of `798ed32`; whoever merges a new pass commit adds any further function to it.**

| File | What the fix pass is changing | What the ring changes | Overlap |
|---|---|---|---|
| `src/hyp.mjs` and every per-frame file | `Math.hypot` replaced by `hyp` (allocation-free) | the ring's new code uses `hyp` in anything per frame | rule only |
| `src/world.mjs` | `bake` (the village in culled chunks, trimmed), `World.cullView`, `World.applyQuality`, the governor's `setStep`, the shadow `off` rule | C: `bounds`, `blocked`, `edgeDepth`, `edgeAhead`, `routeObstacles`, `routeTo`, `applyLights`, `restoreVehicles`, `towVehicles`, `init` (the `lost` check), the constructor's `lightAt`, `push`, the walking step; A: `loadKit` | none by function; `init` and the constructor only if the pass reorders boot |
| `src/fields.mjs` | `OpenFields.ground`, `groundPool` and `retire` (**reuse of field-tile geometry**), `pending` and `tileArr`, `batch`, `FieldBirds`, `runDistance`/`groundColor` (`hyp`) | `ground` (material groups, in-place index), `groundColor`, `rimColor`, `trailTile`, `want`, the tile build, rim | **yes**: `ground`, `groundPool`, `retire`. **Agree the design before A starts** (4.3): the pooled geometry is regrouped on every reuse, or cached per tile and partitioned once |
| `src/field-layout.mjs` | `hyp` only | `tileShares`, `fieldRim`, `nearestLand`, `TILE_KINDS`, `kitReach`, `fieldBlocked` | small |
| `src/borders.mjs` | `hyp`; the curtain (**already `forceSinglePass` with `DoubleSide` at `798ed32`: nothing left to change**); trimming what round 8 added to the village (this ribbon and the ward curtain) | the whole mesh builder, the curtain's geometry | **yes**: the ring's ribbon is the one the pass trims (2.8: +4,832 triangles accepted); keep the material settings |
| `src/minimap.mjs`, `src/world-sheet.mjs`, `src/world-map.mjs`, `src/outdoors.mjs` | `hyp`; `RIM_SLIDE`, `rimPoint`, `rimDens`, `drawVillageMarkers`, `projection`, `standpoint` (open items 5 and 12); `outdoors.mjs` 3 lines | `terrainCache`, the stroke and fill functions, label anchors, `drawWorldMap`'s regions, `drawFeatures`' sea | small |
| `src/wilds.mjs`, `src/wilds-draw.mjs` | the `Wilds` class (the step in small methods), `METHODS` | `wildCell`, `cornerOf`, `CORNERS`, `SPAWN`, `Wilds.walkable`'s one predicate; `near` | none by function |
| `src/land-view.mjs`, `src/land-features.mjs`, `src/region-life.mjs` | `installLands` (Ember Fields hot, the trains' wording, hazard toasts: open items 1, 4, 23), the hot ground's `paint` | `away`, `tend`, the `squareOf` use in `installLands`, **the `ocean` builder, `beachSea` and the sea object (3.4)**, the feature rows | **yes**: `installLands` and `region-life.mjs` (hot `paint` and `beachSea`) |
| `src/combat-hud.mjs` | `pandoraPanel` (commit `3760f99`: "all 13 squares") | `pandoraPanel` again ("twelve regions", 7.1; `tests/finish.test.mjs` asserts it) | **yes**, one function and its test: builder B, after the pass's last commit |
| `src/pandora-view.mjs` | `installPandora` (`world.click`, `openCage`: the cage tap) | one line of the same function: `sight.dark` (2.7) | same function, different lines (C) |
| `src/main.mjs`, `src/wake.mjs` | `hud()`, `boot()` (the Home card, the greeting, the cage tap, "no Welcome home far out") | the Begin toast's call, `wakeGreeting`'s `moved` flag | small: the pass's greeting rule and the ring's `moved` line meet in `wakeGreeting` |
| `src/navigation.mjs` | `hyp` only | the empty-cell machinery goes; `findRoute` takes `bounds.r`; `edgeSlide`, `clampToWorld` | small |
| `src/titans*.mjs`, `src/combat-fx*.mjs`, `src/villagers*.mjs`, `src/sun-shadow.mjs`, `src/toon.mjs`, `src/governor.mjs` | effects, allocation, shadows, quality | nothing | none |
| `tests/budget-browser`, `drive-budget-browser`, `governor-*`, `wake*`, `minimap.test`, `finish.test`, `prisons-browser`, `lands-browser` | new and changed by the pass | spots, positions, the panel text | rebase |

**Rebase rules.**
1. **Cut `ring9` only after the pass's final commit** (its verifier's "ship"); then there is nothing to rebase. The table above is the freeze list if work must start earlier.
2. If work starts earlier, `ring9` is rebased (never merged) onto `round8` each time the pass commits; step 0's merge to `ring9` waits for a quiet moment, and every builder runs `git fetch` and rebases `r9-*` on `ring9` before merging.
3. **On a conflict the fix pass wins on performance code** (pools, in-place buffers, `hyp`, the governor, one-pass materials, allocation-free loops) **and the ring wins on geometry** (regions, runs, tiles' classes, rims, positions). Never re-introduce `Math.hypot` or a per-frame array; the ring's new per-frame code (`edgeAhead`, `edgeDepth`, `edgeSlide`, `landLightAt`, `groundColor`) is written allocation-free from the start.
4. After the pass lands, re-run `budget-browser`, `drive-budget-browser` and `governor-browser`: the ring changes the tile, ground and ribbon cost, and the baseline figures of 4.6 are the pass's.
5. Open items of `ROUND8-OPEN.json` that the ring makes moot are not the ring's to close: item 2 (swamp triangles) stays the fix pass's; items 1, 4, 23 (Ember Fields, trains wording, hazard toasts) stay in `installLands` and are rebased over, never redone. **The ring's `installLands`-area edit is not three lines** (the first draft said so): `away`, `tend`, the `squareOf` use, the `ocean` builder and `beachSea` (3.4); of those only `installLands` itself is shared with the pass.



## 9. Standing decisions, risks and open questions

### 9.1 How the standing user decisions are kept

| Decision still in force | In the ring |
|---|---|
| Reuse Zoo Garden's models, generators and code (no look-alikes) | Nothing in sections 3.1 to 3.6 and 17 of the old spec changes: the kits, creatures, titans, cages, patterns and recipes are the same files; only where they stand changes |
| Flat rainbow ribbon borders; a tall shimmer only at the outer edge on strong devices | The ribbon cross-section is unchanged and flat; the curtain is one 5 m cylinder at R2 on "high" only (2.8) |
| Magic Home teleport that brings the car | Unchanged; the threshold is the ward's (6.5) |
| Far zoom when driving far out | `FAR_DEPTH = [24, 84]` (6.5) |
| The Map zooms and pans | Unchanged mechanism; limits and anchors for the disc (6.3) |
| The minimap shows nearby bosses | Rim rule unchanged; 5 markers typical, 8 at most (6.2) |
| Prisons: Zoo Garden's three | Same three, cages recomputed from the dens (3.3) |
| The safe ward hugs the ring road | `ward.mjs` is not touched; the quarters run up to the ward line (2.6) |
| Original art only | No new art is needed: the ribbon, the curtain, the map strokes and the groups are geometry |
| "Execute the plan": defaults are built | Section 9.3 lists the defaults |

### 9.2 Risks

1. **The landscape phone's far view is the tightest line** (about 181 draws against 180 on paper, counted, not measured, 4.6): expected to miss by one draw, so lever 1 is built with the tiles and A merges only on a measured pass.
2. **Ground in groups and an in-place index reorder** (4.3) is new code in the hottest file the fix pass is also editing; the checker texture on the toy group alone is the part most likely to show an artefact. `tests/field-straddle.test.mjs` proves every quad is used once; a screenshot of tile (-2, 1) (forest, Candy Land, Toybox) at 390 x 844 is part of A's evidence.
3. **The tangent slide on a circular wall** (2.9) replaces an axis-by-axis slide for the edge only; it must be shown at eight bearings, by jeep and by bike, at top speed (`edge-browser`).
4. **Light and night seams** (2.7) are new per-frame code in `applyLights`; `sectorBorderDistance` is a loop over at most two runs, allocation-free. Continuity is a node test, not a screenshot.
5. **`DENSITY` has to be re-tuned for twelve regions** (`scripts/tune-density.mjs`; each to within 2 of its target). That is manual work for B and the longest single step after the ribbons.
6. **All eight planets are in the first tile window** (4.5), so the kit rule and the two-fetch limit must hold; the first-load background download is measured before and after (it may not pass 249 KB before the player nears the harsh lands).
7. **Den power rises by 6% to 18%** (2.5; the Void Eye x6.96 against x6.2): every exact-damage assertion about a land boss or titan in `tests/pandora.test.mjs`, `bosses.test.mjs` and `titans.test.mjs` changes. `RADIAL_STEP = 0` restores every round 8 number.
8. **77.5% of the old playable area is brought home on load** (5.3: 22.5% is kept after the den rule), though the players who were out there are few: most play in the village. The toast says why.
9. **The trail leads onto a three-way junction.** Each trail ends at the inner circle where a diagonal begins, under a white knot with three ribbons; it may look busy. Screenshot at the four trail ends; if it does, the trail stops 8 m short (one number in `TRAILS`).
10. **What was not prototyped:** the material groups, the tangent slide, the 5,768-triangle ribbon, the light seam and the kit rule are specified from the code, not built. The placement tables are one valid solution found by hill-climbing and checked by `verify.mjs`; the smallest margins are 2.1 m (home bosses over the 36 m rule), 3.5 m (the lava stand) and 3.9 m (the Toybox rails), so a builder who moves a row must re-run the checks, not the eye.
11. **The fix pass is not finished** (8.6): `798ed32` is a moving base.
12. **The inner circle is a cliff** (2.5): +3 to +9 levels and x1.7 to x6.2 inside one ribbon, three arcs at +9. Round 8's flaw (+12) is reduced, not removed. An optional ramp is open question 7.
13. **The zigzag deviates from "Zoo Garden's order"** (2.5): a reader of the brief expects the numbered ring. Question 2 puts both in front of the user; switching costs B about half a day.
14. **The first-load bundle** has 1,952 bytes to spare against an estimated +6 KB (8.2 item 7): step 0 may have to move code behind `import()` before anything else builds.
15. **The Canyon's label is above the Toybox's** (2.5): the order holds by power and along every ray, not by printed label. Open question 6.

### 9.3 Open questions for the user, each with the default that will be built

1. **Which home region sits in which quarter?** Default: Redrock Canyon north-east, Blue Lake Meadow south-east, Mushroom Forest south-west, Chomper Swamp north-west: every region stays in the half of the map it had, and the reference's order is kept. The other rotation (Swamp NE, Canyon SE, Meadow SW, Forest NW) is equally good by the numbers (`order.mjs`, 4 ties each) and would put the hot canyon in the south-east.
2. **How should the eight planets be arranged round the yellow ring?** Default: **the zigzag, a deliberate deviation from "Zoo Garden's order"**: Night Land (hardest) at north-north-east, then clockwise Ember Fields, Shell Beach, Wild Jungle, Toybox Land (easiest, south-south-west), Candy Land, Frost Land, Cloud Meadow; every pair of neighbours differs by one difficulty step. The alternative, option N, is Zoo Garden's own numbering round the circle (2.5 draws both and prices each first border): easier to explain, but it puts the Night Land (x6.2) beside the Toybox (x1.7) across one line on the east axis, a x3.65 jump, and a walk north-north-east meets Lv 13 where the zigzag's meets Lv 16. In either ring a walk meets different levels in different directions. Switching costs about half a day (2.5).
3. **Should a planet get harder from its inner edge to its rim?** Default: yes, by 0.8 of a difficulty step (about 18% to 42% stronger at the rim, titans near the rim); the inner edge keeps round 8's strength, so "Lv N+" on the banner is exact. One constant, `RADIAL_STEP`; 0 makes every planet flat as in round 8.
4. **How big should the world be?** Default: radius 296 m (592 m across, 275,254 m^2): the home ring 160 m and each planet 136 m deep. One line, `RING`, changes it: R1 from 160 to 176 and a planet depth of 136 to 160 m move every den by themselves (2.1); a smaller world needs the den rows solved again.
5. **Where should a player who was far out wake after the update?** Default: at home with the car parked, with a one-time message; 22.5% of the old playable area (the ward, and the home ring except within a boss's wake radius of a home den) is kept as it is. The alternative is the nearest point of the home ring on the same bearing, which keeps the direction but can wake a player a few metres from a planet's border.
6. **Should the Canyon's printed label match its place?** Default: no. The Canyon says Lv 7 with its bosses at Lv 13 and power x1; the Toybox, farther out, says Lv 4+ at x1.7 and up. Lowering the Canyon's label to 4, or raising the Toybox's, makes labels agree with the ring order but changes round 8's tuned labels and every test that prints them (2.5).
7. **Should the step into a planet be a ramp?** Default: no; the inner edge is a cliff of +3 to +9 levels (2.5). A ramp of power over the first 24 m inside a planet, smoothed like `LIGHT_FADE`, makes it walkable but makes "Lv N+" false for those metres.

## Appendix A: reference geometry (the code that was run)
This is `world.mjs`, the file every number in this spec was computed with. It is the content of `src/regions.mjs` apart from `REGION`, `shapeOf`, `distanceToRegion`, `difficultyAt`, `levelAt`, `runPoints`, `sectorBorderDistance`, `homeBorderDistance` and `DENS`, which the sections above specify. Production code uses `hyp` for `Math.hypot` and `Math.sqrt(x * x + z * z)` in per-frame paths, takes `SAFE` and `inSafeZone` from `src/ward.mjs`, and keeps `GATE_END = 67` as a literal (it must not import `field-layout.mjs`: 2.1). **Changes the review made that this reference file does not carry** (the file was not re-run for them; `review.mjs` checks the figures): the seam starts 1.1 m past its run start (2.8), `from` of each trail is computed (2.8), `TRAILS` rows are `{ bearing, from, to }`, and the three lines marked below. `QUARTER_ID` and `SECTOR_ID` are the tables of 2.4 and 2.5.

### A.1 world.mjs

```js
// Reference implementation of the ring world's regions.mjs geometry (round 9 spec, appendix A). Pure. No imports.
export const RING = Object.freeze({ R1: 160, R2: 296 });            // THE one block to tune (spec 1)
export const SAFE = { x0: -56.5, x1: 56.5, z0: -50, z1: 41.5 };
export const GATE_ROAD_X1 = 67;                                    // = GATE_END of regions.mjs, a literal equal to field-layout.mjs GATE_ROAD.x1 (tests/regions.test.mjs checks it): the east seam starts where the gate's road ends
export const EDGE_PAD = 2;
const { R1, R2 } = RING;
const RAD = Math.PI / 180;
// quadrants clockwise from the north axis: NE [0,90) SE [90,180) SW [180,270) NW [270,360); sectors clockwise, 45 deg each
export const QUARTER_ID = Object.freeze(['east', 'south', 'west', 'north']);                 // Redrock Canyon NE, Blue Lake Meadow SE, Mushroom Forest SW, Chomper Swamp NW
export const SECTOR_ID = Object.freeze(['shadow', 'lava', 'ocean', 'jungle', 'toy', 'candy', 'ice', 'cloud']);
export const inSafeZone = (x, z, pad = 0) => x > SAFE.x0 - pad && x < SAFE.x1 + pad && z > SAFE.z0 - pad && z < SAFE.z1 + pad;
export function quarterIndex(x, z) { if (x >= 0 && z < 0) return 0; if (x > 0 && z >= 0) return 1; if (x <= 0 && z > 0) return 2; return 3; }
export function sectorIndex(x, z) {
  switch (quarterIndex(x, z)) {
    case 0: return x < -z ? 0 : 1; case 1: return x > z ? 2 : 3; case 2: return -x < z ? 4 : 5; default: return x < z ? 6 : 7;
  }
}
export const bearingOf = (x, z) => { let a = Math.atan2(x, -z) / RAD; return a < 0 ? a + 360 : a; };
export function regionAt(x, z) {
  if (inSafeZone(x, z)) return 'village';
  const r2 = x * x + z * z;
  if (!(r2 < R2 * R2)) return null;                     // REVIEW: also null for NaN
  return r2 < R1 * R1 ? QUARTER_ID[quarterIndex(x, z)] : SECTOR_ID[sectorIndex(x, z)];
}
export const edgeDistance = (x, z) => Math.max(0, R2 - Math.sqrt(x * x + z * z));
export const inWorld = (x, z, pad = 0) => { const r = R2 - pad; return x * x + z * z < r * r; };
export const edgeDepth = (x, z) => { const r = Math.sqrt(x * x + z * z), L = R2 - EDGE_PAD; return r > L ? r - L : r <= L ? 0 : Infinity; };   // REVIEW: Infinity for NaN, so a non-finite point stays blocked
export function edgeAhead(x, z, dx, dz, max = 48, pad = EDGE_PAD) {          // metres along a unit ray to the padded circle; Infinity past max; 0 outside
  const R = R2 - pad, c = x * x + z * z - R * R; if (c >= 0) return 0;
  const b = x * dx + z * dz, t = -b + Math.sqrt(b * b - c); return t > max ? Infinity : t;
}
// ---- runs
const len = Math.hypot;
function seg(ax, az, bx, bz, kind, half) { const d = len(bx - ax, bz - az), nx = -(bz - az) / d, nz = (bx - ax) / d, mx = (ax + bx) / 2, mz = (az + bz) / 2; return { type: 'seg', ax, az, bx, bz, kind, half, nx, nz, length: d, left: regionAt(mx + nx * .25, mz + nz * .25), right: regionAt(mx - nx * .25, mz - nz * .25) }; }
function arc(r, b0, b1, kind, half) { const m = (b0 + b1) / 2 * RAD, nx = Math.sin(m), nz = -Math.cos(m); // outward normal; left = outside the circle here
  return { type: 'arc', r, b0, b1, kind, half, length: r * (b1 - b0) * RAD, left: regionAt((r + .25) * nx, (r + .25) * nz), right: regionAt((r - .25) * nx, (r - .25) * nz) }; }
export const FULL = 1.99, SLIM = FULL / 2;
function makeRuns() {
  const out = [], W = SAFE, wp = [[W.x0, W.z0], [0, W.z0], [W.x1, W.z0], [W.x1, 0], [W.x1, W.z1], [0, W.z1], [W.x0, W.z1], [W.x0, 0]];
  wp.forEach(([ax, az], i) => { const [bx, bz] = wp[(i + 1) % 8]; out.push(seg(ax, az, bx, bz, 'ward', SLIM)); });
  out.push(seg(0, W.z0, 0, -R1, 'seam', FULL), seg(GATE_ROAD_X1, 0, R1, 0, 'seam', FULL), seg(0, W.z1, 0, R1, 'seam', FULL), seg(W.x0, 0, -R1, 0, 'seam', FULL));
  for (let k = 0; k < 8; k++) out.push(arc(R1, 45 * k, 45 * k + 45, 'shared', FULL));
  for (let k = 0; k < 8; k++) { const a = 45 * k * RAD; out.push(seg(R1 * Math.sin(a), -R1 * Math.cos(a), R2 * Math.sin(a), -R2 * Math.cos(a), 'sector', FULL)); }
  for (let k = 0; k < 8; k++) out.push(arc(R2, 45 * k, 45 * k + 45, 'outer', FULL));
  return out;
}
export const BORDER_RUNS = makeRuns();
export function runDistance(x, z, r) {
  if (r.type === 'seg') { const dx = r.bx - r.ax, dz = r.bz - r.az, k = Math.max(0, Math.min(1, ((x - r.ax) * dx + (z - r.az) * dz) / (dx * dx + dz * dz))); return len(x - r.ax - dx * k, z - r.az - dz * k); }
  const b = bearingOf(x, z), rho = len(x, z);
  if ((b >= r.b0 && b < r.b1) || (r.b1 === 360 && b === 0)) return Math.abs(rho - r.r);
  const e = a => len(x - r.r * Math.sin(a * RAD), z + r.r * Math.cos(a * RAD)); return Math.min(e(r.b0), e(r.b1));
}
export const REGIONS = ['village', ...QUARTER_ID, ...SECTOR_ID];
export const RUNS_OF = Object.fromEntries(REGIONS.map(id => [id, BORDER_RUNS.filter(r => r.left === id || r.right === id)]));
const least = (x, z, runs) => { let d = Infinity; for (const r of runs) d = Math.min(d, runDistance(x, z, r)); return d; };
export const borderDistance = (x, z) => { const id = regionAt(x, z); return id === null ? edgeDistance(x, z) : least(x, z, RUNS_OF[id]); };
export const GRID_RUNS = Object.fromEntries(REGIONS.map(id => [id, RUNS_OF[id].filter(r => r.kind !== 'ward')]));
export const gridBorderDistance = (x, z) => { const id = regionAt(x, z); return id === null ? 0 : least(x, z, GRID_RUNS[id]); };
```

### A.2 How the den rows become `DENS` (`den-rows.mjs` and the conversion in `regions.mjs`)

```js
// src/den-rows.mjs (builder B; pure, no imports). A home row gives a bearing; a planet row an angle clockwise into its sector. Rows are the table of 3.2.
export const denRows = ({ R1, R2 }) => [
  { type: 'treant', region: 'west', rho: R1 - 38, bearing: 245 }, { type: 'croc', region: 'north', rho: R1 - 38, bearing: 335 },
  { type: 'mushking', region: 'south', rho: R1 - 38, bearing: 155 }, { type: 'bear', region: 'east', rho: R1 - 38, bearing: 65 }, { type: 'titan_turtle', region: 'east', rho: R1 - 43, bearing: 25 },
  { type: 'shadowlord', region: 'shadow', rho: R1 + 44, angle: 14 }, { type: 'titan_eye', region: 'shadow', rho: R2 - 44, angle: 31 },
  { type: 'golem', region: 'lava', rho: R1 + 45.5, angle: 22.5, leash: 24 }, { type: 'dragon', region: 'lava', rho: R2 - 45.5, angle: 10.5, leash: 24, event: 'dragon' }, { type: 'titan_scorpion', region: 'lava', rho: R2 - 45.5, angle: 34.5 },
  { type: 'leviathan', region: 'ocean', rho: R1 + 44, angle: 14 }, { type: 'titan_kraken', region: 'ocean', rho: R2 - 44, angle: 31 },
  { type: 'gorilla', region: 'jungle', rho: R1 + 44, angle: 14 }, { type: 'titan_flower', region: 'jungle', rho: R2 - 44, angle: 31 },
  { type: 'robot', region: 'toy', rho: R1 + 44, angle: 14 }, { type: 'titan_clock', region: 'toy', rho: R2 - 44, angle: 31 },
  { type: 'cake', region: 'candy', rho: R1 + 41, angle: 16.8, leash: 24 }, { type: 'gingerbread', region: 'candy', rho: R1 + 48, angle: 33.5, leash: 24 }, { type: 'jellyqueen', region: 'candy', rho: R2 - 41, angle: 9.5, leash: 24 }, { type: 'titan_hydra', region: 'candy', rho: R2 - 41, angle: 24 },
  { type: 'yeti', region: 'ice', rho: R1 + 41, angle: 16.8, leash: 24 }, { type: 'mammoth', region: 'ice', rho: R1 + 48, angle: 33.5, leash: 24 }, { type: 'frostowl', region: 'ice', rho: R2 - 41, angle: 9.5, leash: 24 }, { type: 'titan_crystal', region: 'ice', rho: R2 - 41, angle: 24 },
  { type: 'phoenix', region: 'cloud', rho: R1 + 44, angle: 14 }, { type: 'titan_whale', region: 'cloud', rho: R2 - 44, angle: 31 },
];
// src/regions.mjs: polar to x, z, 0.5 m, never on a 32 m creature seam; level and power from the den's own position (2.5); powerOfDen uses powerOf of src/power.mjs, never region-mix.mjs
const half = v => Math.round(v * 2) / 2, offSeam = v => v % 32 === 0 ? v + .5 : v;
const den = r => { const b = (r.bearing ?? 45 * SECTOR_ID.indexOf(r.region) + r.angle) * Math.PI / 180, titan = r.type.startsWith('titan_'), x = offSeam(half(r.rho * Math.sin(b))), z = offSeam(half(-r.rho * Math.cos(b)));
  return Object.freeze({ id: 'w:den:' + r.type, type: r.type, region: r.region, x, z, clear: titan ? 24 : 16, leash: r.leash ?? 30, titan, event: r.event ?? null, level: bossLevelAt(x, z, r.region, titan), power: powerOfDen(x, z, r.region, titan) }); };
export const DENS = Object.freeze(denRows(RING).map(den));
```

## Appendix B: the migration (the code that was run)
`migrate.mjs` (re-run for the review with the den rule of 5.2; `HOME_DENS` there is `DENS` of `dens.mjs`, production uses `DENS` of `regions.mjs`); production `src/save-layout.mjs` is its first half (the constants, `nearDen` and the two functions); the checks of its second half are `tests/save-layout.test.mjs` (5.4). `HOME_SPOT` is `game.mjs`'s.

### B.1 migrate.mjs

```js
// Reference implementation of src/save-layout.mjs (round 9 spec, appendix B) and its checks against the live round 8 world.
import * as W from './world.mjs';
import { DENS } from './dens.mjs';
import * as OLD from 'file:///C:/Users/n/source/repos/3d_farmer_fish_sell-round8/src/regions.mjs';
export const LAYOUT = 2;                                            // 1 (or absent): round 8's thirteen squares; 2: the rings
export const KEEP = W.RING.R1 - 8;                                 // a spot is kept when it is in the ward or in the home ring at least 8 m inside the inner circle
export const HOME_SPOT = Object.freeze({ x: 0, z: -8 });
const finite = (...v) => v.every(Number.isFinite);
/** Is this old coordinate still a good place to wake in the ring world? */
const HOME_DENS = DENS.filter(d => ['east', 'south', 'west', 'north'].includes(d.region));   // production: DENS of regions.mjs whose region is a QUARTER_ID
export const DEN_WAKE = 24;                                         // a kept place is at least clear + 24 m from every home den: the titan's own trigger radius (old 4.4); a boss sees 12 to 13 m
export const nearDen = (x, z) => { for (const d of HOME_DENS) { const dx = x - d.x, dz = z - d.z, r = d.clear + DEN_WAKE; if (dx * dx + dz * dz < r * r) return true; } return false; };
export const keepable = (x, z) => finite(x, z) && (W.inSafeZone(x, z) || (W.inWorld(x, z, 2) && Math.hypot(x, z) < KEEP && !nearDen(x, z)));
/** Pure: the save's geometry fields for the ring world. `raw` is the parsed JSON; nothing else in it is read or changed. */
export function migrateLayout(raw) {
  const out = { position: raw.position, vehicles: raw.vehicles, riding: raw.riding, heading: raw.heading, layout: LAYOUT, layoutMoved: false };
  if (raw.layout >= LAYOUT) return { ...out, layoutMoved: raw.layoutMoved === true };
  const p = raw.position, here = p && keepable(p.x, p.z);
  if (!here) { out.position = { ...HOME_SPOT }; out.riding = ''; out.heading = 0; out.layoutMoved = !!(p && Number.isFinite(p.x) && Number.isFinite(p.z) && !W.inSafeZone(p.x, p.z)); }
  const v = raw.vehicles, keep = s => s && typeof s === 'object' && keepable(s.x, s.z) && Number.isFinite(s.rot) ? { x: s.x, z: s.z, rot: s.rot } : null;
  out.vehicles = { jeep: keep(v?.jeep), bike: keep(v?.bike) };
  if (out.vehicles.jeep !== (v?.jeep ?? null) || out.vehicles.bike !== (v?.bike ?? null)) { if ((v?.jeep && !out.vehicles.jeep) || (v?.bike && !out.vehicles.bike)) out.layoutMoved = true; }
  return out;
}
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const assert = (c, m) => { if (!c) throw new Error('FAILED: ' + m); };
  const cases = [
    ['in the ward', { x: 12, z: 3 }, true], ['in the old forest centre (-128, 0)', { x: -128, z: 0 }, true], ['old meadow (0, 128)', { x: 0, z: 128 }, true], ['old canyon far side (180, 20)', { x: 180, z: 20 }, false],
    ['old jungle tip (-300, 40)', { x: -300, z: 40 }, false], ['old toy (-128, -128)', { x: -128, z: -128 }, false], ['old north swamp NW corner (-60, -190)', { x: -60, z: -190 }, false], ['just inside the keep line (151.9, 0)', { x: 151.9, z: 0 }, true], ['on the keep line (152, 0)', { x: 152, z: 0 }, false],
  ];
  for (const [name, p, kept] of cases) { const m = migrateLayout({ position: p, vehicles: undefined, riding: 'jeep', heading: 1.2 }); assert(m.layout === 2, 'layout'); const same = m.position.x === p.x && m.position.z === p.z; assert(same === kept, name); console.log(name.padEnd(42), kept ? 'kept' : 'home ', JSON.stringify(m.position), 'riding', JSON.stringify(m.riding), 'moved', m.layoutMoved); }
  const once = migrateLayout({ position: { x: -300, z: 40 }, vehicles: { jeep: { x: -300, z: 40, rot: 1 }, bike: { x: 20, z: 5, rot: 0 } }, riding: 'jeep', heading: 2 });
  console.log('far save: vehicles', JSON.stringify(once.vehicles), 'riding', JSON.stringify(once.riding), 'pos', JSON.stringify(once.position));
  assert(once.vehicles.jeep === null && once.vehicles.bike?.x === 20, 'car far out is parked, the one in the ward stays');
  const twice = migrateLayout({ ...once, layout: once.layout }); assert(JSON.stringify(twice.position) === JSON.stringify(once.position) && twice.layout === 2, 'idempotent');
  // property check over the whole old world on a 4 m grid, plus random old vehicles
  let n = 0, kept = 0, wardKept = 0, ring = 0, bad = 0; const byOld = {};
  for (let x = -330; x <= 330; x += 4) for (let z = -330; z <= 330; z += 4) { const o = OLD.regionAt(x, z); if (!o) continue; n++; const m = migrateLayout({ position: { x, z }, vehicles: { jeep: { x, z, rot: 0 }, bike: null }, riding: '', heading: 0 });
    const k = m.position.x === x && m.position.z === z; if (k) { kept++; if (W.inSafeZone(x, z)) wardKept++; else ring++; } byOld[o] ??= { n: 0, kept: 0 }; byOld[o].n++; if (k) byOld[o].kept++;
    const r = W.regionAt(m.position.x, m.position.z); if (!(r === 'village' || ['east', 'south', 'west', 'north'].includes(r)) || !W.inWorld(m.position.x, m.position.z, 2)) bad++;
    if (m.vehicles.jeep && (!W.inWorld(x, z, 2) || Math.hypot(x, z) >= KEEP && !W.inSafeZone(x, z))) bad++; }
  console.log('old world grid points', n, 'kept', kept, `(${(100 * kept / n).toFixed(1)}%)`, 'of which in the ward', wardKept, 'in the home ring', ring, '| results outside village/home or outside the circle:', bad);
  console.log('by old region (kept / points):', Object.entries(byOld).map(([k, v]) => `${k} ${v.kept}/${v.n}`).join(', '));
  assert(bad === 0, 'every migrated save is in the ward or the home ring, inside the circle');
  console.log('all migration assertions passed');
}
```

## Appendix C: raw output of the scratch scripts
Run with `node <name>.mjs` in the scratch directory; the figures quoted in the sections above are these lines. `order.mjs` is the search of 2.5; `radii.mjs` 2.2; `denfit.mjs` and `denfit2.mjs` 2.2; `homefit.mjs` 2.2; `check-world.mjs` 2.3 and 2.8; `window2.mjs` 2.1; `edge.mjs` 2.9; `tiles.mjs`, `classes.mjs`, `perregion.mjs`, `lists.mjs`, `centre.mjs`, `window.mjs` section 4; `bbox.mjs` 2.7 and 3.4; `slots.mjs` 3.6; `gradient.mjs` 2.5; `misc.mjs` 2.2, 2.8, 4.6, 6.5; `features.mjs`, `stands2.mjs`, `rim.mjs`, `tables.mjs`, `verify.mjs` section 3 and 6.2; `migrate.mjs` section 5.

### C. order.mjs

```
feasible assignments: 241920 of 322560
best key {"maxStep":1,"tv":8,"clash":1,"labelMax":3,"gap":18}
ties at best: 32
ccw+2 meadow>canyon>swamp>forest | candy,ice,cloud,shadow,lava,ocean,jungle,toy
ccw+2 meadow>canyon>swamp>forest | candy,ocean,lava,shadow,cloud,ice,jungle,toy
ccw+1 forest>meadow>canyon>swamp | candy,toy,jungle,ice,cloud,shadow,lava,ocean
ccw+1 forest>meadow>canyon>swamp | candy,toy,jungle,ocean,lava,shadow,cloud,ice
ccw+0 swamp>forest>meadow>canyon | cloud,ice,candy,toy,jungle,ocean,lava,shadow
ccw+0 swamp>forest>meadow>canyon | cloud,ice,jungle,toy,candy,ocean,lava,shadow
ccw+3 canyon>swamp>forest>meadow | cloud,shadow,lava,ocean,candy,toy,jungle,ice
ccw+3 canyon>swamp>forest>meadow | cloud,shadow,lava,ocean,jungle,toy,candy,ice
cw+1 meadow>forest>swamp>canyon | ice,candy,toy,jungle,ocean,lava,shadow,cloud
cw+3 swamp>canyon>meadow>forest | ice,cloud,shadow,lava,ocean,candy,toy,jungle
cw+3 swamp>canyon>meadow>forest | ice,cloud,shadow,lava,ocean,jungle,toy,candy
cw+1 meadow>forest>swamp>canyon | ice,jungle,toy,candy,ocean,lava,shadow,cloud
ccw+2 meadow>canyon>swamp>forest | jungle,ice,cloud,shadow,lava,ocean,candy,toy
ccw+2 meadow>canyon>swamp>forest | jungle,ocean,lava,shadow,cloud,ice,candy,toy
ccw+1 forest>meadow>canyon>swamp | jungle,toy,candy,ice,cloud,shadow,lava,ocean
ccw+1 forest>meadow>canyon>swamp | jungle,toy,candy,ocean,lava,shadow,cloud,ice
ccw+0 swamp>forest>meadow>canyon | lava,ocean,candy,toy,jungle,ice,cloud,shadow
ccw+0 swamp>forest>meadow>canyon | lava,ocean,jungle,toy,candy,ice,cloud,shadow
ccw+3 canyon>swamp>forest>meadow | lava,shadow,cloud,ice,candy,toy,jungle,ocean
ccw+3 canyon>swamp>forest>meadow | lava,shadow,cloud,ice,jungle,toy,candy,ocean
cw+1 meadow>forest>swamp>canyon | ocean,candy,toy,jungle,ice,cloud,shadow,lava
cw+1 meadow>forest>swamp>canyon | ocean,jungle,toy,candy,ice,cloud,shadow,lava
cw+3 swamp>canyon>meadow>forest | ocean,lava,shadow,cloud,ice,candy,toy,jungle
cw+3 swamp>canyon>meadow>forest | ocean,lava,shadow,cloud,ice,jungle,toy,candy
cw+0 canyon>meadow>forest>swamp | shadow,cloud,ice,candy,toy,jungle,ocean,lava
cw+0 canyon>meadow>forest>swamp | shadow,cloud,ice,jungle,toy,candy,ocean,lava
cw+0 canyon>meadow>forest>swamp | shadow,lava,ocean,candy,toy,jungle,ice,cloud
cw+0 canyon>meadow>forest>swamp | shadow,lava,ocean,jungle,toy,candy,ice,cloud
cw+2 forest>swamp>canyon>meadow | toy,candy,ice,cloud,shadow,lava,ocean,jungle
cw+2 forest>swamp>canyon>meadow | toy,candy,ocean,lava,shadow,cloud,ice,jungle
cw+2 forest>swamp>canyon>meadow | toy,jungle,ice,cloud,shadow,lava,ocean,candy
cw+2 forest>swamp>canyon>meadow | toy,jungle,ocean,lava,shadow,cloud,ice,candy
sweep 1..8 around the circle: maxStep 4 total variation 8
best arrangement that has one hard seam (maxStep 4): {"v":"cw+2","q":"forest>swamp>canyon>meadow","p":"candy,ice,ocean,cloud,lava,shadow,toy,jungle","maxStep":4,"tv":8,"gap":18,"labelMax":3,"clash":0}
min total variation any cycle = 2*(6-2) = 8
```

### C. radii.mjs

```
ward area 10339.5 half diagonal (origin to farthest corner) 75.45 corners 75.45 75.45 70.10 70.10 nearest side 41.5
ward exit radius along a bearing: min 41.50 @ 180 max 75.44 @ 48.5
ZG home sector 16949 ZG disc 68813
R1  R2 | inner ring minus ward | per home | vs 16384 | per planet | vs 16384 | world area | gap@corner  gap@side(W/E,N,S) | ring depth min..max | per-quadrant area NE,SE,SW,NW
144 256 | 54805 | 13701 | 0.836 | 17593 | 1.074 | 205887 | 68.6 87.5 94.0 102.5 | 68.6 .. 102.5 | 13461,13941,13941,13461
144 272 | 54805 | 13701 | 0.836 | 20910 | 1.276 | 232428 | 68.6 87.5 94.0 102.5 | 68.6 .. 102.5 | 13461,13941,13941,13461
144 288 | 54805 | 13701 | 0.836 | 24429 | 1.491 | 260576 | 68.6 87.5 94.0 102.5 | 68.6 .. 102.5 | 13461,13941,13941,13461
144 296 | 54805 | 13701 | 0.836 | 26264 | 1.603 | 275254 | 68.6 87.5 94.0 102.5 | 68.6 .. 102.5 | 13461,13941,13941,13461
144 304 | 54805 | 13701 | 0.836 | 28149 | 1.718 | 290333 | 68.6 87.5 94.0 102.5 | 68.6 .. 102.5 | 13461,13941,13941,13461
144 320 | 54805 | 13701 | 0.836 | 32069 | 1.957 | 321699 | 68.6 87.5 94.0 102.5 | 68.6 .. 102.5 | 13461,13941,13941,13461
152 256 | 62244 | 15561 | 0.950 | 16663 | 1.017 | 205887 | 76.6 95.5 102.0 110.5 | 76.6 .. 110.5 | 15321,15801,15801,15321
152 272 | 62244 | 15561 | 0.950 | 19981 | 1.220 | 232428 | 76.6 95.5 102.0 110.5 | 76.6 .. 110.5 | 15321,15801,15801,15321
152 288 | 62244 | 15561 | 0.950 | 23499 | 1.434 | 260576 | 76.6 95.5 102.0 110.5 | 76.6 .. 110.5 | 15321,15801,15801,15321
152 296 | 62244 | 15561 | 0.950 | 25334 | 1.546 | 275254 | 76.6 95.5 102.0 110.5 | 76.6 .. 110.5 | 15321,15801,15801,15321
152 304 | 62244 | 15561 | 0.950 | 27219 | 1.661 | 290333 | 76.6 95.5 102.0 110.5 | 76.6 .. 110.5 | 15321,15801,15801,15321
152 320 | 62244 | 15561 | 0.950 | 31139 | 1.901 | 321699 | 76.6 95.5 102.0 110.5 | 76.6 .. 110.5 | 15321,15801,15801,15321
160 256 | 70085 | 17521 | 1.069 | 15683 | 0.957 | 205887 | 84.6 103.5 110.0 118.5 | 84.6 .. 118.5 | 17281,17761,17761,17281
160 272 | 70085 | 17521 | 1.069 | 19000 | 1.160 | 232428 | 84.6 103.5 110.0 118.5 | 84.6 .. 118.5 | 17281,17761,17761,17281
160 288 | 70085 | 17521 | 1.069 | 22519 | 1.374 | 260576 | 84.6 103.5 110.0 118.5 | 84.6 .. 118.5 | 17281,17761,17761,17281
160 296 | 70085 | 17521 | 1.069 | 24354 | 1.486 | 275254 | 84.6 103.5 110.0 118.5 | 84.6 .. 118.5 | 17281,17761,17761,17281
160 304 | 70085 | 17521 | 1.069 | 26239 | 1.601 | 290333 | 84.6 103.5 110.0 118.5 | 84.6 .. 118.5 | 17281,17761,17761,17281
160 320 | 70085 | 17521 | 1.069 | 30159 | 1.841 | 321699 | 84.6 103.5 110.0 118.5 | 84.6 .. 118.5 | 17281,17761,17761,17281
168 256 | 78329 | 19582 | 1.195 | 14652 | 0.894 | 205887 | 92.6 111.5 118.0 126.5 | 92.6 .. 126.5 | 19342,19822,19822,19342
168 272 | 78329 | 19582 | 1.195 | 17970 | 1.097 | 232428 | 92.6 111.5 118.0 126.5 | 92.6 .. 126.5 | 19342,19822,19822,19342
168 288 | 78329 | 19582 | 1.195 | 21488 | 1.312 | 260576 | 92.6 111.5 118.0 126.5 | 92.6 .. 126.5 | 19342,19822,19822,19342
168 296 | 78329 | 19582 | 1.195 | 23323 | 1.424 | 275254 | 92.6 111.5 118.0 126.5 | 92.6 .. 126.5 | 19342,19822,19822,19342
168 304 | 78329 | 19582 | 1.195 | 25208 | 1.539 | 290333 | 92.6 111.5 118.0 126.5 | 92.6 .. 126.5 | 19342,19822,19822,19342
168 320 | 78329 | 19582 | 1.195 | 29129 | 1.778 | 321699 | 92.6 111.5 118.0 126.5 | 92.6 .. 126.5 | 19342,19822,19822,19342
176 256 | 86974 | 21744 | 1.327 | 13572 | 0.828 | 205887 | 100.6 119.5 126.0 134.5 | 100.6 .. 134.5 | 21503,21984,21984,21503
176 272 | 86974 | 21744 | 1.327 | 16889 | 1.031 | 232428 | 100.6 119.5 126.0 134.5 | 100.6 .. 134.5 | 21503,21984,21984,21503
176 288 | 86974 | 21744 | 1.327 | 20408 | 1.246 | 260576 | 100.6 119.5 126.0 134.5 | 100.6 .. 134.5 | 21503,21984,21984,21503
176 296 | 86974 | 21744 | 1.327 | 22242 | 1.358 | 275254 | 100.6 119.5 126.0 134.5 | 100.6 .. 134.5 | 21503,21984,21984,21503
176 304 | 86974 | 21744 | 1.327 | 24127 | 1.473 | 290333 | 100.6 119.5 126.0 134.5 | 100.6 .. 134.5 | 21503,21984,21984,21503
176 320 | 86974 | 21744 | 1.327 | 28048 | 1.712 | 321699 | 100.6 119.5 126.0 134.5 | 100.6 .. 134.5 | 21503,21984,21984,21503
```

### C. denfit.mjs

```
slack (m) over the 36 m border rule and the separation rule, best of 60 hill-climbs; negative = does not fit
R1  R2 | 3 bosses + titan, sep 56 | 2 dens (boss+titan) sep 73.5 | 3 dens (lava) sep 56 
144 272 | 1.7 | 10.2 | 5.9
144 288 | 5.9 | 13.5 | 10.5
144 296 | 7.6 | 15.2 | 12.8
144 304 | 9.0 | 16.8 | 15.2
144 320 | 11.7 | 20.1 | 20.0
152 272 | 0.2 | 10.2 | 4.3
152 288 | 4.4 | 13.5 | 8.8
152 296 | 6.4 | 15.2 | 11.1
152 304 | 8.6 | 16.8 | 13.4
152 320 | 11.8 | 20.1 | 18.1
160 272 | -1.6 | 10.2 | 3.0
160 288 | 2.9 | 13.5 | 7.3
160 296 | 5.0 | 15.2 | 9.5
160 304 | 7.1 | 16.8 | 11.7
160 320 | 11.3 | 20.1 | 16.3
168 272 | -3.5 | 10.2 | 1.8
168 288 | 1.1 | 13.5 | 5.9
168 296 | 3.5 | 15.2 | 8.0
168 304 | 5.6 | 16.8 | 10.2
168 320 | 9.9 | 20.1 | 14.6

leash + 6 rule (bosses with leash 24 need 30 m, titans 36 m):
160 272 4 dens 1.6 3 dens (lava) 6.1
160 288 4 dens 6.2 3 dens (lava) 10.2
160 296 4 dens 8.4 3 dens (lava) 12.4
152 288 4 dens 7.9 3 dens (lava) 11.7
168 288 4 dens 4.3 3 dens (lava) 9.0
```

### C. denfit2.mjs

```
4 dens slack 5.06 (201.1, 16.6deg) (208.1, 33.6deg) (254.9, 9.3deg) (254.9, 23.8deg)
3 dens slack 9.48 (205.5, 22.5deg) (250.5, 34.5deg) (250.5, 10.5deg)
```

### C. homefit.mjs

```
R1 136 best margin of the canyon pair (m): -5.6 does not fit bear 73 deg rho 105.5, turtle 17 deg rho 104
R1 144 best margin of the canyon pair (m): -2.0 does not fit bear 72 deg rho 110, turtle 18 deg rho 110
R1 152 best margin of the canyon pair (m): 1.4 fits bear 70.5 deg rho 114.5, turtle 19.5 deg rho 113
R1 160 best margin of the canyon pair (m): 5.0 fits bear 69.5 deg rho 119, turtle 20.5 deg rho 118
R1 168 best margin of the canyon pair (m): 8.4 fits bear 68.5 deg rho 123.5, turtle 21.5 deg rho 122
```

### C. check-world.mjs

```
{
  ward: { n: 8, len: 409 },
  seam: { n: 4, len: 425 },
  shared: { n: 8, len: 1005.3096491487339 },
  sector: { n: 8, len: 1088 },
  outer: { n: 8, len: 1859.8228509251571 }
}
total runs 36 total length 4787.1
village  runs 8 wS wS wS wS wS wS wS wS
east     runs 6 wS wS sS sS sA sA
south    runs 6 wS wS sS sS sA sA
west     runs 6 wS wS sS sS sA sA
north    runs 6 wS wS sS sS sA sA
shadow   runs 4 sA sS sS oA
lava     runs 4 sA sS sS oA
ocean    runs 4 sA sS sS oA
jungle   runs 4 sA sS sS oA
toy      runs 4 sA sS sS oA
candy    runs 4 sA sS sS oA
ice      runs 4 sA sS sS oA
cloud    runs 4 sA sS sS oA
outer arcs left: ,,,,,,, right: shadow,lava,ocean,jungle,toy,candy,ice,cloud
ward runs right: north,east,east,south,south,west,west,north
seams (left|right): east|north  south|east  west|south  north|west
shared (left outside|right inside): shadow|east  lava|east  ocean|south  jungle|south  toy|west  candy|west  ice|north  cloud|north
sector (left|right): shadow|cloud  lava|shadow  ocean|lava  jungle|ocean  toy|jungle  candy|toy  ice|candy  cloud|ice
ties: north axis (0,-100) east | east axis (100,0) south | south axis (0,100) west | west axis (-100,0) north
diagonals inside R1: (80,-80)-> east (80,80)-> south (-80,80)-> west (-80,-80)-> north
diagonals outer: (170,-170) lava north of it (169,-171) shadow (170,170) jungle (-170,170) candy (-170,-170) cloud
R1 exactly: (0,-160) shadow (0,-159.999) east R2 exactly (296,0) null (295.999,0) ocean
outer sector tie on axes r>R1: (200,0) ocean (0,-200) shadow (0,200) toy (-200,0) ice
ward line points: (56.5,-10) east (56.5,10) south (10,41.5) south (-10,41.5) west (-56.5,10) west (-56.5,-10) north (-10,-50) north (10,-50) east
predicate vs bearing disagreements: 0 of 1746453
areas (m2): {"null":84733,"ice":24331,"candy":24380,"cloud":24380,"toy":24331,"north":17281,"west":17761,"village":10340,"shadow":24331,"east":17281,"south":17761,"jungle":24380,"lava":24380,"ocean":24331}
```

### C. window2.mjs

```
R1\R2 depth: ok? (first failures)
152 264 depth 112 FAIL treant ward 47.4; bear ward 47.0; titan_turtle ward 49.0
152 272 depth 120 FAIL treant ward 47.4; bear ward 47.0; titan_turtle ward 49.0
152 280 depth 128 FAIL treant ward 47.4; bear ward 47.0; titan_turtle ward 49.0
152 288 depth 136 FAIL treant ward 47.4; bear ward 47.0; titan_turtle ward 49.0
152 296 depth 144 FAIL treant ward 47.4; bear ward 47.0; titan_turtle ward 49.0
152 304 depth 152 FAIL treant ward 47.4; bear ward 47.0; titan_turtle ward 49.0
152 312 depth 160 FAIL treant ward 47.4; bear ward 47.0; titan_turtle ward 49.0
156 268 depth 112 FAIL titan_turtle ward 52.5; golem/dragon 49.1; golem/titan_scorpion 49.2
156 276 depth 120 FAIL titan_turtle ward 52.5; golem/dragon 53.6; golem/titan_scorpion 53.5
156 284 depth 128 FAIL titan_turtle ward 52.5; cake/jellyqueen 53.9; cake/titan_hydra 53.8
156 292 depth 136 FAIL titan_turtle ward 52.5
156 300 depth 144 FAIL titan_turtle ward 52.5
156 308 depth 152 FAIL titan_turtle ward 52.5
156 316 depth 160 FAIL titan_turtle ward 52.5
160 272 depth 112 FAIL golem/dragon 50.1; golem/titan_scorpion 49.2; dragon/golem 50.1
160 280 depth 120 FAIL golem/dragon 54.6; golem/titan_scorpion 54.2; dragon/golem 54.6
160 288 depth 128 FAIL cake/jellyqueen 54.1; cake/titan_hydra 53.9; gingerbread/titan_hydra 54.0
160 296 depth 136 ok
160 304 depth 144 ok
160 312 depth 152 ok
160 320 depth 160 ok
164 276 depth 112 FAIL golem/dragon 50.6; golem/titan_scorpion 50.3; dragon/golem 50.6
164 284 depth 120 FAIL golem/dragon 55.1; golem/titan_scorpion 54.9; dragon/golem 55.1
164 292 depth 128 FAIL cake/jellyqueen 54.6; cake/titan_hydra 54.5; gingerbread/titan_hydra 54.6
164 300 depth 136 ok
164 308 depth 144 ok
164 316 depth 152 ok
164 324 depth 160 ok
168 280 depth 112 FAIL golem/dragon 51.6; golem/titan_scorpion 51.4; dragon/golem 51.6
168 288 depth 120 FAIL golem/titan_scorpion 55.9; titan_scorpion/golem 55.9; cake/jellyqueen 47.6
168 296 depth 128 FAIL cake/jellyqueen 54.3; cake/titan_hydra 54.5; gingerbread/titan_hydra 55.3
168 304 depth 136 ok
168 312 depth 144 ok
168 320 depth 152 ok
168 328 depth 160 ok
172 284 depth 112 FAIL golem/dragon 52.2; golem/titan_scorpion 51.8; dragon/golem 52.2
172 292 depth 120 FAIL cake/jellyqueen 48.6; cake/titan_hydra 48.2; gingerbread/titan_hydra 49.8
172 300 depth 128 FAIL cake/jellyqueen 55.2; cake/titan_hydra 55.0; gingerbread/titan_hydra 55.7
172 308 depth 136 ok
172 316 depth 144 ok
172 324 depth 152 ok
172 332 depth 160 ok
176 288 depth 112 FAIL golem/dragon 52.7; golem/titan_scorpion 53.3; dragon/golem 52.7
176 296 depth 120 FAIL cake/jellyqueen 48.4; cake/titan_hydra 48.3; gingerbread/titan_hydra 50.5
176 304 depth 128 FAIL cake/jellyqueen 55.0; cake/titan_hydra 55.1; jellyqueen/cake 55.0
176 312 depth 136 ok
176 320 depth 144 ok
176 328 depth 152 ok
176 336 depth 160 ok
```

### C. edge.mjs

```
jeep stopping distance from top speed 33.5 m
bike stopping distance from top speed 26.3 m
edgeAhead from rho 293 (1 m inside the padded line 294) along the tangent: 24.23  jeep arrival limit 32.0 m/s; bike 36.1
tangent at 0.25 m inside the line: edgeAhead 12.1 jeep limit 22.1
tangent at 0.5 m inside the line: edgeAhead 17.1 jeep limit 26.6
tangent at 1 m inside the line: edgeAhead 24.2 jeep limit 32.0
tangent at 2 m inside the line: edgeAhead 34.2 jeep limit 38.2
tangent at 5 m inside the line: edgeAhead 54.0 jeep limit 48.3
analytic edgeAhead against 1 mm marching, 2000 random rays: largest difference 0.0010 m
```

### C. tiles.mjs

```
ring R2=296                tiles in world 88 | whole inside 52 | straddling the edge 36 | rim tiles in the shown window 168 | tiles with 1,2,3 non-village regions {"1":60,"2":24,"3":4} | max regions 3
                           blocking kinds per tile (expected >= 1 piece): {"0":9,"1":12,"2":22,"3":18,"4":16,"5":5,"6":5,"7":1} max 7 at -3 0 candy+west
round 8 (13 squares)       tiles in world 52 | whole inside 52 | straddling the edge 0 | rim tiles in the shown window 204 | tiles with 1,2,3 non-village regions {"1":48,"2":4} | max regions 2
                           blocking kinds per tile (expected >= 1 piece): {"1":8,"2":16,"3":16,"4":9,"5":2,"6":1} max 6 at 0 0 village+south+east
R 256 tiles touching the disc 60 of which straddle the edge 28
R 272 tiles touching the disc 80 of which straddle the edge 36
R 288 tiles touching the disc 88 of which straddle the edge 36
R 296 tiles touching the disc 88 of which straddle the edge 36
R 304 tiles touching the disc 88 of which straddle the edge 36
R 320 tiles touching the disc 88 of which straddle the edge 28
rim indices -7..6 (+-448 m): positions 196 rim (not touching the disc) 108
```

### C. classes.mjs

```
tiles touching the disc 88 | tiles by number of ground material classes {"1":56,"2":30,"3":2} | examples {"1":"-5,-3 plain","2":"-4,3 plain+checker","3":"-2,1 home+plain+checker"} | tiles with two or more lands 12
rim tiles within 128 m of the edge (the most the 5 x 5 window can ever show): 76 ; round 8: 144 rim positions of 196 within the +-448 m window (tiles outside the squares)
```

### C. perregion.mjs

```
region   tiles holding any of it | tiles wholly in it
village     4      0
east        8      2
south       8      2
west        8      2
north       8      2
shadow     11      2
lava       11      2
ocean      11      2
jungle     11      2
toy        11      2
candy      11      2
ice        11      2
cloud      11      2
```

### C. bbox.mjs

```
ice      box -296 -113.5 -209 0 box area 38143 region area 24331 acceptance 0.64
candy    box -296 -113 0 209.5 box area 38339 region area 24380 acceptance 0.64
cloud    box -209.5 0 -296 -113 box area 38339 region area 24380 acceptance 0.64
toy      box -209 0 113.5 296 box area 38143 region area 24331 acceptance 0.64
north    box -160 0 -160 0 box area 25600 region area 17281 acceptance 0.68
west     box -160 0 0 160 box area 25600 region area 17761 acceptance 0.69
village  box -56.5 56.5 -50 41.5 box area 10340 region area 10340 acceptance 1.00
shadow   box 0 209 -296 -113.5 box area 38143 region area 24331 acceptance 0.64
east     box 0 160 -160 0 box area 25600 region area 17281 acceptance 0.68
south    box 0 160 0 160 box area 25600 region area 17761 acceptance 0.69
jungle   box 0 209.5 113 296 box area 38339 region area 24380 acceptance 0.64
lava     box 113 296 -209.5 0 box area 38339 region area 24380 acceptance 0.64
ocean    box 113.5 296 0 209 box area 38143 region area 24331 acceptance 0.64
```

### C. lists.mjs

```
trail tiles: -1,-1  -1,-2  -1,0  -2,-2  -2,0  -2,1  0,-1  0,0  0,1  1,-1  1,-2  1,1
tiles with three regions: (-2,-2) cloud+ice+north; (-2,1) west+candy+toy; (1,-2) east+shadow+lava; (1,1) south+jungle+ocean
tiles holding two planets: 12
tile of HOME_SPOT (0,-8): 0 -1
```

### C. centre.mjs

```
tile (-1,-1)   north 0.31, village 0.69
tile (0,-1)    east 0.31, village 0.69
tile (-1,0)    west 0.41, village 0.59
tile (0,0)     village 0.59, south 0.41
tile (-2,-1)   north 1.00
tile (1,-1)    east 1.00
tile (-2,0)    west 1.00
tile (1,0)     south 1.00
tile (-1,1)    west 1.00
tile (0,1)     south 1.00
tile (-1,-2)   north 1.00
tile (0,-2)    east 1.00
```

### C. window.mjs

```
regions with ground in the first 5 x 5 window at HOME_SPOT: cloud, north, ice, west, candy, toy, village, shadow, east, south, lava, jungle, ocean
round 8: toy, west, candy, north, village, south, east, ocean, cloud
```

### C. slots.mjs

```
region    area old   area new | valid old  valid new  ratio | TARGET old -> new | DENSITY old (kept as the starting point)
west         17256      17817 |    13954      14092   1.010 |    37 ->  37 | 3.36
north        18072      17313 |    14728      13624   0.925 |    39 ->  36 | 2.17
south        19152      17817 |    15768      14118   0.895 |    37 ->  33 | 2.6
east         17248      17313 |    12150      11842   0.975 |    33 ->  32 | 3.73
toy          16384      24303 |    10724      18112   1.689 |    19 ->  32 | 2.54
candy        16384      24399 |     9100      16496   1.813 |    28 ->  51 | 3.14
jungle       16384      24399 |    10840      18096   1.669 |    22 ->  37 | 1.78
ice          16384      24303 |     9216      16508   1.791 |    28 ->  50 | 3.45
ocean        16384      24303 |    10724      18112   1.689 |    21 ->  35 | 2.33
lava         16384      24399 |    10028      17327   1.728 |    25 ->  43 | 2.92
cloud        16384      24399 |    10724      18096   1.687 |    19 ->  32 | 1.76
shadow       16384      24303 |    10840      18112   1.671 |    19 ->  32 | 2.5
sum of targets 327 -> 450  (home 146 -> 138 )
east valid share of area: old 0.704 new 0.684
toy valid share of area: old 0.655 new 0.745
candy valid share of area: old 0.555 new 0.676
lava valid share of area: old 0.612 new 0.710
```

### C. gradient.mjs

```
POWER table (index = d): [1,1,1.7,2.6,3.6,4.8,6.2]
planet      d | inner edge: d_eff power level | rim: d_eff power level | rim over inner
toy      2 | 2.00 1.70 4 | 2.80 2.42 6 | 1.42
candy    3 | 3.00 2.60 7 | 3.80 3.40 9 | 1.31
jungle   3 | 3.00 2.60 7 | 3.80 3.40 9 | 1.31
ice      4 | 4.00 3.60 10 | 4.80 4.56 12 | 1.27
ocean    4 | 4.00 3.60 10 | 4.80 4.56 12 | 1.27
lava     5 | 5.00 4.80 13 | 5.80 5.92 15 | 1.23
cloud    5 | 5.00 4.80 13 | 5.80 5.92 15 | 1.23
shadow   6 | 6.00 6.20 16 | 6.80 7.32 18 | 1.18

den            region   rho   t     d_eff  power(den)  level  bossLevel   | round 8 power  level label
w:den:shadowlord       shadow   204.1 0.32 6.26   6.56     17      23    | 6.2 22
w:den:titan_eye        shadow   252.1 0.68 6.54   6.96     18      24    | 6.2 22
w:den:golem            lava     205.6 0.34 5.27   5.18     14      20    | 4.8 19
w:den:dragon           lava     250.6 0.67 5.53   5.55     15      21    | 4.8 19
w:den:titan_scorpion   lava     250.7 0.67 5.53   5.55     15      21    | 4.8 19
w:den:leviathan        ocean    204.1 0.32 4.26   3.91     11      17    | 3.6 16
w:den:titan_kraken     ocean    252.1 0.68 4.54   4.25     12      18    | 3.6 16
w:den:gorilla          jungle   204.1 0.32 3.26   2.86      8      14    | 2.6 13
w:den:titan_flower     jungle   252.0 0.68 3.54   3.14      9      15    | 2.6 13
w:den:robot            toy      204.1 0.32 2.26   1.93      5      11    | 1.7 10
w:den:titan_clock      toy      252.1 0.68 2.54   2.19      6      12    | 1.7 10
w:den:cake             candy    200.9 0.30 3.24   2.84      8      14    | 2.6 13
w:den:gingerbread      candy    208.2 0.35 3.28   2.88      8      14    | 2.6 13
w:den:jellyqueen       candy    254.9 0.70 3.56   3.16      9      15    | 2.6 13
w:den:titan_hydra      candy    255.0 0.70 3.56   3.16      9      15    | 2.6 13
w:den:yeti             ice      201.0 0.30 4.24   3.89     11      17    | 3.6 16
w:den:mammoth          ice      208.2 0.35 4.28   3.94     11      17    | 3.6 16
w:den:frostowl         ice      255.0 0.70 4.56   4.27     12      18    | 3.6 16
w:den:titan_crystal    ice      255.0 0.70 4.56   4.27     12      18    | 3.6 16
w:den:phoenix          cloud    204.1 0.32 5.26   5.16     14      20    | 4.8 19
w:den:titan_whale      cloud    252.0 0.68 5.54   5.56     15      21    | 4.8 19

home rim -> planet inner step (x1 -> power at the planet inner edge) per quadrant pair:
east(canyon d3):  shadow 6.20 lava 4.80 | south(meadow d1): ocean 3.60 jungle 2.60 | west(forest d1): toy 1.70 candy 2.60 | north(swamp d2): ice 3.60 cloud 4.80
neighbouring planets across a radial seam, same radius: power ratio (harder / easier): d diff 1 -> toy/candy 1.53, candy/ice 1.38, ice/cloud 1.33, cloud/shadow 1.29, shadow/lava 1.29, lava/ocean 1.33, ocean/jungle 1.38, jungle/toy 1.53
round 8 worst border (home x1 -> lava x4.8 beside meadow), new worst home -> planet inner edge: 6.2
```

### C. misc.mjs

```
distance from the village centre along the east axis -> walk / cruise / top-speed time (s)
ward east side                       56.5 11.8 2.9 2.9
inner ring R1                        160 33.3 8.3 6.4
rim R2                               296 61.7 15.4 10.0
round 8: far side of a home square   192 40.0 10.0 7.2
round 8: tip planet outer edge       320 66.7 16.7 10.6
round 8: tip corner                  326 67.9 17.0 10.7
ward line to R1 along the axes: east 103.5 north 110 south 118.5 west 103.5 ; to R2: east 239.5 north 246 south 254.5
ward corner (75.45 m from origin) to R1: 84.5 m; to R2: 220.6 m
bear from ward line 54.0 m; from origin 121.9
treant from ward line 69.0 m; from origin 121.9
croc from ward line 60.5 m; from origin 121.9
mushking from ward line 69.0 m; from origin 121.9
turtle from ward line 56.0 m; from origin 117.0
trail tiles (a tile any part of which is within 2.3 m of a trail centreline): 12 (round 8: 20)
trail east bearing 45 from 70.71 to 160 length 89.3
trail south bearing 135 from 58.69 to 160 length 101.3
trail west bearing 225 from 58.69 to 160 length 101.3
trail north bearing 315 from 70.71 to 160 length 89.3   (the first draft's starts; superseded by the review.mjs block at the end of this appendix: 73.96, 62.69, 60.94, 73.96)
ribbon quads (strips only) 4268 knots 28 total quads 4296 triangles 8592  (round 8: 468 quads, 936 triangles)
arc step 1 deg: sagitta at R1 0.006 at R2 0.011 m; chord at R2 5.17 m
arc step 2 deg: sagitta at R1 0.024 at R2 0.045 m; chord at R2 10.33 m
arc step 3 deg: sagitta at R1 0.055 at R2 0.101 m; chord at R2 15.50 m
arc step 4 deg: sagitta at R1 0.097 at R2 0.180 m; chord at R2 20.66 m
terrain cache 624 x 624 = 389376 regionAt calls (round 8: 672 x 672 = 451584); 96 rows a frame -> 7 frames; inside the disc 305815 pixels need a region
edgeAhead sample: from (200,0) heading east: Infinity  heading north: Infinity  tangential at (290,0) heading north: Infinity  from the rim heading out: 1 inside, pad 2 line at 294
wildDepth 20 along east axis x = 76.5 ; far view starts at depth 24 and is full at 104 m (FAR_DEPTH): east x 80.5 -> 160.5 ; R1 is at depth 103.5 on the east; so the far view is full -0.5 m before the inner circle on the east axis, but at the NE ward corner direction (depth at R1 84.5 ) it is not yet full at R1
wildDepth at R1 along bearings: min 84.6 max 118.5
wildDepth at R2 along bearings: min 220.6 max 254.5
```

### C. features.mjs

```
west    smallest margin over the rules 20.9 m
    pond   r 8    x   -41.5 z    82.5 rho   92.3 bearing  206.7  gridBorder 41.5 ward 41.0 trail 33.2
    pond   r 7    x   -34.0 z   121.5 rho  126.2 bearing  195.6  gridBorder 33.8 ward 80.0 trail 60.7
south   smallest margin over the rules 15.0 m
    pond   r 9    x   126.5 z    30.0 rho  130.0 bearing  103.3  gridBorder 30.0 ward 70.0 trail 67.1
    pond   r 11   x    93.5 z    50.5 rho  106.3 bearing  118.4  gridBorder 50.5 ward 38.1 trail 30.0
toy     smallest margin over the rules 3.9 m
    track  r 22   x   -86.5 z   178.0 rho  197.9 bearing  205.9  gridBorder 37.9 ward 139.8 trail 71.9
    track  r 22   x   -69.0 z   238.0 rho  247.8 bearing  196.2  gridBorder 48.2 ward 196.9 trail 134.2
candy   smallest margin over the rules 22.5 m
    pond   r 6.6  x  -258.5 z    35.0 rho  260.9 bearing  262.3  gridBorder 35.0 ward 202.0 trail 163.2
jungle  smallest margin over the rules 30.5 m
    pond   r 6    x   146.5 z   207.0 rho  253.6 bearing  144.7  gridBorder 42.4 ward 188.4 trail 98.8
ice     smallest margin over the rules 22.5 m
    pond   r 6.6  x  -207.5 z  -158.0 rho  260.8 bearing  307.3  gridBorder 35.0 ward 185.6 trail 105.2
shadow  smallest margin over the rules 30.4 m
    pond   r 6    x    42.5 z  -250.0 rho  253.6 bearing    9.6  gridBorder 42.4 ward 200.0 trail 155.9
lava    smallest margin over the rules 9.5 m
    pool   r 18   x   169.5 z  -118.0 rho  206.5 bearing   55.2  gridBorder 36.4 ward 131.9 trail 55.3
    pool   r 14   x   189.5 z   -37.0 rho  193.1 bearing   79.0  gridBorder 33.1 ward 133.0 trail 105.9
    pool   r 12   x   216.0 z  -105.5 rho  240.4 bearing   64.0  gridBorder 55.6 ward 168.9 trail 101.7
    pool   r 11   x   251.5 z   -97.0 rho  269.6 bearing   68.9  gridBorder 26.4 ward 200.6 trail 137.8
    vent   r 5.5  x   163.5 z   -79.5 rho  181.8 bearing   64.1  gridBorder 21.8 ward 111.0 trail 58.6
    vent   r 5.5  x   206.0 z  -169.5 rho  266.8 bearing   50.6  gridBorder 25.8 ward 191.4 trail 108.2
```

### C. stands2.mjs

```
east    90.5, -83        min margin 6.6
south   83.5, 81.5       min margin 12.9
west    -74.5, 85        min margin 16.7
north   -103, -46.5      min margin 16.2
shadow  76, -237         min margin 16.7
lava    230.5, -86.5     min margin 3.5
ocean   237, 76          min margin 16.7
jungle  113.5, 221.5     min margin 16.7
toy     -37, 256.5       min margin 6.2
candy   -240, 45         min margin 5.8
ice     -201.5, -138     min margin 5.9
cloud   -113.5, -221.5   min margin 16.7
```

### C. rim.mjs

```
village centre (0, 0)        on the map: [] 
                              on the rim: ["titan_turtle 117.0","treant 121.9","croc 121.9","mushking 121.9","bear 121.9"]
homestead (0, -8)            on the map: [] 
                              on the rim: ["titan_turtle 109.8","croc 114.7","bear 118.8","treant 125.5","mushking 129.2"]
canyon stand (90.5, -83)     on the map: ["bear 37.3","titan_turtle 47.0","golem 99.6"] 
                              on the rim: ["shadowlord 122.1","titan_eye 138.7","croc 144.6","mushking 197.4","treant 241.8"]
candy stand (-240, 45)       on the map: ["cake 80.4","gingerbread 36.2","jellyqueen 108.0","titan_hydra 46.5","yeti 113.4","frostowl 87.8"] 
                              on the rim: ["treant 129.7","titan_crystal 148.7","croc 244.4","mushking 298.8","bear 363.5"]
lava stand (230.5, -86.5)    on the map: ["golem 41.3","dragon 60.5","titan_scorpion 44.0"] 
                              on the rim: ["bear 125.0","leviathan 139.8","mushking 266.2","croc 283.0","treant 367.9"]
most rim markers anywhere: 8 at [-290,14] | histogram of markers by number over the world grid {"2":4,"3":1041,"4":4111,"5":6390,"6":4034,"7":1198,"8":158}
```

### C. tables.mjs

```
| Den id | Region | x | z | rho | bearing | Lv | power | grid border | ward line | nearest den |
|---|---|---|---|---|---|---|---|---|---|---|
| w:den:treant | west | -110.5 | 51.5 | 121.9 | 245.0 | 7 | 1 | 38.1 | 54.9 | 79.5 |
| w:den:croc | north | -51.5 | -110.5 | 121.9 | 335.0 | 10 | 1 | 38.1 | 60.5 | 83.8 |
| w:den:mushking | south | 51.5 | 110.5 | 121.9 | 155.0 | 7 | 1 | 38.1 | 69.0 | 83.8 |
| w:den:bear | east | 110.5 | -51.5 | 121.9 | 65.0 | 13 | 1 | 38.1 | 54.0 | 81.8 |
| w:den:titan_turtle | east | 49.5 | -106.0 | 117.0 | 25.0 | 13 | 1 (titan x7) | 43.0 | 56.0 | 81.8 |
| w:den:shadowlord | shadow | 49.5 | -198.0 | 204.1 | 14.0 | 23 | 6.56 | 44.1 | 148.0 | 82.5 |
| w:den:titan_eye | shadow | 130.0 | -216.0 | 252.1 | 31.0 | 24 | 6.96 | 43.9 | 181.5 | 82.5 |
| w:den:golem | lava | 190.0 | -78.5 | 205.6 | 67.6 | 20 | 5.18 | 45.6 | 136.5 | 65.4 |
| w:den:dragon | lava | 206.5 | -142.0 | 250.6 | 55.5 | 21 | 5.55 | 45.4 | 176.0 | 65.6 |
| w:den:titan_scorpion | lava | 246.5 | -45.5 | 250.7 | 79.5 | 21 | 5.55 | 45.3 | 190.0 | 65.4 |
| w:den:leviathan | ocean | 198.0 | 49.5 | 204.1 | 104.0 | 17 | 3.91 | 44.1 | 141.7 | 82.5 |
| w:den:titan_kraken | ocean | 216.0 | 130.0 | 252.1 | 121.0 | 18 | 4.25 | 43.9 | 182.4 | 82.5 |
| w:den:gorilla | jungle | 105.0 | 175.0 | 204.1 | 149.0 | 14 | 2.86 | 44.1 | 142.0 | 82.3 |
| w:den:titan_flower | jungle | 61.0 | 244.5 | 252.0 | 166.0 | 15 | 3.14 | 44.0 | 203.0 | 82.3 |
| w:den:robot | toy | -49.5 | 198.0 | 204.1 | 194.0 | 11 | 1.93 | 44.1 | 156.5 | 82.5 |
| w:den:titan_clock | toy | -130.0 | 216.0 | 252.1 | 211.0 | 12 | 2.19 | 43.9 | 189.3 | 82.5 |
| w:den:cake | candy | -177.0 | 95.0 | 200.9 | 241.8 | 14 | 2.84 | 40.9 | 131.8 | 59.9 |
| w:den:gingerbread | candy | -204.0 | 41.5 | 208.2 | 258.5 | 14 | 2.88 | 41.5 | 147.5 | 59.9 |
| w:den:jellyqueen | candy | -207.5 | 148.0 | 254.9 | 234.5 | 15 | 3.16 | 41.1 | 184.8 | 61.1 |
| w:den:titan_hydra | candy | -238.0 | 91.5 | 255.0 | 249.0 | 15 | 3.16 | 41.0 | 188.3 | 60.5 |
| w:den:yeti | ice | -192.5 | -58.0 | 201.0 | 286.8 | 17 | 3.89 | 41.0 | 136.2 | 60.1 |
| w:den:mammoth | ice | -173.5 | -115.0 | 208.2 | 303.5 | 17 | 3.94 | 41.4 | 133.8 | 60.1 |
| w:den:frostowl | ice | -251.5 | -42.0 | 255.0 | 279.5 | 18 | 4.27 | 41.0 | 195.0 | 61.1 |
| w:den:titan_crystal | ice | -233.0 | -103.5 | 255.0 | 294.0 | 18 | 4.27 | 41.0 | 184.4 | 60.6 |
| w:den:phoenix | cloud | -105.0 | -175.0 | 204.1 | 329.0 | 20 | 5.16 | 44.1 | 134.1 | 82.3 |
| w:den:titan_whale | cloud | -61.0 | -244.5 | 252.0 | 346.0 | 21 | 5.56 | 44.0 | 194.6 | 82.3 |

Boss-to-titan separations and the leash sums (sep - leash - 4.8 - 2 must be >= 24, the titan trigger):
toy     robot        titan_clock     sep 82.5 leash 30 sum 45.7
candy   cake         titan_hydra     sep 61.1 leash 24 sum 30.3
candy   gingerbread  titan_hydra     sep 60.5 leash 24 sum 29.7
candy   jellyqueen   titan_hydra     sep 64.2 leash 24 sum 33.4
jungle  gorilla      titan_flower    sep 82.3 leash 30 sum 45.5
ice     yeti         titan_crystal   sep 60.9 leash 24 sum 30.1
ice     mammoth      titan_crystal   sep 60.6 leash 24 sum 29.8
ice     frostowl     titan_crystal   sep 64.2 leash 24 sum 33.4
ocean   leviathan    titan_kraken    sep 82.5 leash 30 sum 45.7
lava    golem        titan_scorpion  sep 65.4 leash 24 sum 34.6
lava    dragon       titan_scorpion  sep 104.5 leash 24 sum 73.7
cloud   phoenix      titan_whale     sep 82.3 leash 30 sum 45.5
shadow  shadowlord   titan_eye       sep 82.5 leash 30 sum 45.7
east    bear         titan_turtle    sep 81.8 leash 30 sum 45.0

boss-to-boss separations (>= 18 m sight, minus leash 24 -> need > sight):
candy cake gingerbread 59.9
candy cake jellyqueen 61.1
candy gingerbread jellyqueen 106.6
ice yeti mammoth 60.1
ice yeti frostowl 61.1
ice mammoth frostowl 106.8
lava golem dragon 65.6

cages (6.5 m from the den toward (0, 0)):
sprout treant -104.6 48.8 west grid border 44.6 nearest titan 140.1
clover bear 104.6 -48.8 east grid border 44.6 nearest titan 79.5
pepper robot -47.9 191.7 toy grid border 37.6 nearest titan 85.6

turtle trail distance 38.78 near edge 36.58 minus 2 m of wander 34.58 (trigger 24, sight 22)
sweep: turtle to the NE trail centreline at best 38.76
```

### C. verify.mjs

```
lava pool share of the sector 10.1% area 2466
PASS 974 assertions
```

### C. migrate.mjs (re-run for the review, with the den rule)

```
in the ward                                kept {"x":12,"z":3} riding "jeep" moved false
in the old forest centre (-128, 0)         kept {"x":-128,"z":0} riding "jeep" moved false
old meadow (0, 128)                        kept {"x":0,"z":128} riding "jeep" moved false
old canyon far side (180, 20)              home  {"x":0,"z":-8} riding "" moved true
old jungle tip (-300, 40)                  home  {"x":0,"z":-8} riding "" moved true
old toy (-128, -128)                       home  {"x":0,"z":-8} riding "" moved true
old north swamp NW corner (-60, -190)      home  {"x":0,"z":-8} riding "" moved true
just inside the keep line (151.9, 0)       kept {"x":151.9,"z":0} riding "jeep" moved false
on the keep line (152, 0)                  home  {"x":0,"z":-8} riding "" moved true
far save: vehicles {"jeep":null,"bike":{"x":20,"z":5,"rot":0}} riding "" pos {"x":0,"z":-8}
old world grid points 13312 kept 2992 (22.5%) of which in the ward 616 in the home ring 2376 | results outside village/home or outside the circle: 0
by old region (kept / points): jungle 0/1024, toy 129/1024, west 518/1079, candy 129/1024, ice 0/1024, north 290/1144, south 643/1204, lava 0/1024, village 616/616, east 515/1077, ocean 23/1024, cloud 129/1024, shadow 0/1024
all migration assertions passed
```

### C. review scripts (the review's computations, 2026-10-05)

`review.mjs`: findings 1, 2, 3, 21, 23 (the lowest level by distance, the step across each inner arc, the seam start options, the trail starts with the spec's `trailOffset`, NaN).

```
== F1: lowest level on the map by rho (720 rays), and the Canyon
rho 170 lowest level 4 at bearing 180.5
rho 200 lowest level 5 at bearing 180.5
rho 250 lowest level 6 at bearing 180.5
rho 290 lowest level 6 at bearing 180.5
== F2: step across the inner arc at 0.01 m, by planet (bearing at the middle of each sector)
shadow  home east   Lv 7 x1.00 -> Lv 16 x6.20 step +9 power ratio 6.20
lava    home east   Lv 7 x1.00 -> Lv 13 x4.80 step +6 power ratio 4.80
ocean   home south  Lv 1 x1.00 -> Lv 10 x3.60 step +9 power ratio 3.60
jungle  home south  Lv 1 x1.00 -> Lv 7 x2.60 step +6 power ratio 2.60
toy     home west   Lv 1 x1.00 -> Lv 4 x1.70 step +3 power ratio 1.70
candy   home west   Lv 1 x1.00 -> Lv 7 x2.60 step +6 power ratio 2.60
ice     home north  Lv 4 x1.00 -> Lv 10 x3.60 step +6 power ratio 3.60
cloud   home north  Lv 4 x1.00 -> Lv 13 x4.80 step +9 power ratio 4.80
== F3: seam starts vs knot: slim knot half 1.1, ward ribbon half .995
north seam start options: 2.2 beyond -> -52.2 ; 2 m cut -> -52 ; knot edge -> -51.1
== F23: trail start with spec trailOffset
east from 70.71 start pt 49.72 -50.28 inSafe? false | new from (2.2 m clear) 73.96 pt 52.25 -52.34 length to R1 86.0
south from 58.69 start pt 42.60 40.40 inSafe? true | new from (2.2 m clear) 62.69 pt 44.78 43.87 length to R1 97.3
west from 58.69 start pt -40.40 42.60 inSafe? false | new from (2.2 m clear) 60.94 pt -42.41 43.77 length to R1 99.1
north from 70.71 start pt -50.28 -49.72 inSafe? true | new from (2.2 m clear) 73.96 pt -52.34 -52.25 length to R1 86.0
== F24: NaN cloud NaN
```

`order2.mjs` (finding 5, the three scales) and `order3.mjs` (option N, the best placement of the numbered sequence):

```
round-8 d (ties kept) | best arrangement max step 1 tv 8 lava,ocean,candy,toy,jungle,ice,cloud,shadow | numbered ring max step 4 tv 8
   worst neighbour power ratio: best arr 1.53  numbered 3.65
round-8 d, ties broken by Zoo Garden level | best arrangement max step 1.5 tv 8 ocean,candy,toy,jungle,ice,lava,cloud,shadow | numbered ring max step 4 tv 8
   worst neighbour power ratio: best arr 1.82  numbered 3.65
Zoo Garden landing levels (4..20) | best arrangement max step 6 tv 32 lava,ocean,candy,toy,jungle,ice,cloud,shadow | numbered ring max step 16 tv 32
zigzag on round-8 d (ties kept) shadow-lava:1 lava-ocean:1 ocean-jungle:1 jungle-toy:1 toy-candy:1 candy-ice:1 ice-cloud:1 cloud-shadow:1 max 1
zigzag on round-8 d, ties broken by Zoo Garden level shadow-lava:1 lava-ocean:0.5 ocean-jungle:1 jungle-toy:1.5 toy-candy:1 candy-ice:1 ice-cloud:1.5 cloud-shadow:0.5 max 1.5
zigzag on Zoo Garden landing levels (4..20) shadow-lava:6 lava-ocean:2 ocean-jungle:4 jungle-toy:4 toy-candy:2 candy-ice:4 ice-cloud:6 cloud-shadow:4 max 6
{"dir":1,"rot":6,"p":"cloud,shadow,toy,candy,jungle,ice,ocean,lava","ok":true,"gap":18,"clash":1,"maxLab":3,"seam":"shadow|toy between sectors 1 and 2 (a quarter axis)"}
{"dir":1,"rot":1,"p":"candy,jungle,ice,ocean,lava,cloud,shadow,toy","ok":true,"gap":18,"clash":1,"maxLab":4,"seam":"shadow|toy between sectors 6 and 7 (a quarter diagonal)"}
{"dir":-1,"rot":5,"p":"lava,ocean,ice,jungle,candy,toy,shadow,cloud","ok":true,"gap":18,"clash":1,"maxLab":4,"seam":"toy|shadow between sectors 5 and 6 (a quarter axis)"}
{"dir":-1,"rot":6,"p":"cloud,lava,ocean,ice,jungle,candy,toy,shadow","ok":true,"gap":18,"clash":1,"maxLab":4,"seam":"toy|shadow between sectors 6 and 7 (a quarter diagonal)"}
{"dir":-1,"rot":7,"p":"shadow,cloud,lava,ocean,ice,jungle,candy,toy","ok":true,"gap":18,"clash":1,"maxLab":4,"seam":"toy|shadow between sectors 7 and 0 (a quarter axis)"}
```

`review2.mjs` (finding 8: how many old positions each wake radius removes; `margin` is added to the den's clearing, so 24 gives 40 m for a boss and 48 m for the Turtle; the rule built is `margin 24`):

```
home dens treant croc mushking bear titan_turtle
margin 24 rule radii (boss, titan) 40 48 | points 13312 kept before 4548 kept now 2992 22.5% removed 1556
margin 30 rule radii (boss, titan) 46 54 | points 13312 kept before 4548 kept now 2649 19.9% removed 1899
margin 44 rule radii (boss, titan) 60 68 | points 13312 kept before 4548 kept now 1959 14.7% removed 2589
( -128 0 ) nearest home den treant 54.4
( 0 128 ) nearest home den mushking 54.4
( 128 0 ) nearest home den bear 54.4
( 0 -128 ) nearest home den titan_turtle 54.2
( -90 60 ) nearest home den treant 22.2
( 151.9 0 ) nearest home den bear 66.1
```

`review3.mjs` (finding 15: `TILE_KINDS` on the 28 tiles that hold two or more non-village regions, 9 x 9 shares, round 8's `DECOR` counts), `tt.mjs` (the trail tile set before and after the new `from`) and `bsize.mjs` (finding 12, built from the worktree at `798ed32`, nothing written):

```
tiles 88 multi-region (non-village) tiles 28 | current rule: tiles where a region >=5% loses all kinds 8 | worst max expected-piece loss 36% 
   (-3,-2) north; (-3,1) west; (-3,2) toy; (-2,-2) cloud; (-2,1) candy+toy; (1,-2) lava; (1,1) jungle; (2,-2) east
proposed rule: tiles with a >=5% region losing all kinds 0 | max kinds 3 | worst max expected-piece loss 55%
single-region tiles: kinds histogram {"1":12,"2":21,"3":15,"4":12}
12 -1,-1 -1,-2 -1,0 -2,-2 -2,0 -2,1 0,-1 0,0 0,1 1,-1 1,-2 1,1
12 -1,-1 -1,-2 -1,0 -2,-2 -2,0 -2,1 0,-1 0,0 0,1 1,-1 1,-2 1,1
first-load bytes 1098048 spare 1952 chunks 16
```

## Review log

Three reviewers raised 26 findings against the first draft (two of them, 6 and 22, are the same fault, the east gate on a region border). Each was verified against the code of `3d_farmer_fish_sell-round8` at `798ed32` or by a script of Appendix C, then the spec was fixed in place or the finding rejected with evidence. "Verified" says how. Where a finding had a fix proposed and the spec does something else, the reason is given.

| # | Finding (severity) | Verdict | What was checked | What changed, and where |
|---|---|---|---|---|
| 1 | Difficulty does not rise with distance across bearings: the Canyon is above the Toybox (should-fix) | **Accepted** | `review.mjs`: 0 violations along 720 rays; lowest level on the map 4, 5, 6, 6 at rho 170, 200, 250, 290 (all below the Canyon's 7); only the Robot (11) and the Clock titan (12) are at or below the Bear and Turtle's 13 | 2.5 "What difficulty rises with distance does and does not guarantee": holds along every ray and by power, not by printed label; open question 6 (default no), risk 15 |
| 2 | The "no hard seam" headline hides the jumps at the inner circle (should-fix) | **Accepted; the ramp rejected as the default** | `review.mjs`: +9 levels on three arcs, power x1.7 to x6.2, all eight reproduced | 2.5 "The hard step is the inner circle" with the table; section 0 row 3 reworded; open question 7 (ramp, default off: it would make "Lv N+" false for 24 m); risk 12 |
| 3 | Seam ribbons do not meet the ward's slim knot (should-fix) | **Accepted** | arithmetic: knot reaches 1.1 m, ward ribbon 0.995 m, the two rules gave -52.2 and -52.0 | 2.8 "Seam starts (one rule)": 1.1 m past the run start (z -51.1, 42.6, x -57.6), east from x 68.1, the 10.5 m gate gap stated as deliberate; the generic cut rule excepts the ward end; test asserts it |
| 4 | Planet order is not Zoo Garden's order (should-fix) | **Accepted in part** | `order3.mjs`: the numbered sequence has its best placement with the seam on the east axis, x3.65 between the Night Land and the Toybox, same label-gap sum 18 | The zigzag stays the default **as an explicit deviation**, with both rings drawn and every first border priced (2.5 "The two rings, side by side"), section 0 row 3 and open question 2 rewritten; the finding's other choice (numbered as default) rejected because it puts a x3.65 wall between two planets, which is the thing the user is moving away from; the cost of switching is stated (about half a day for B) |
| 5 | The no-seam result depends on tied, compressed levels (should-fix) | **Accepted; result survives** | `order2.mjs`: on three scales the zigzag's largest gap equals the best any arrangement can reach (1, 1.5, 6) and the numbered ring's is 4, 4, 16 | 2.5 "Does the result survive Zoo Garden's own levels?" with the table; the assumption (round 8's compressed labels) is stated beside the claim |
| 6 and 22 | The east gate and its road lie on the Canyon/Meadow border (should-fix, twice) | **Accepted; the region rule not changed** | `regionAt(63, 0.01)` is `south`, `(63, -0.01)` is `east`; `region-banner.mjs` fires on every change; the ground step at z = 0 is under the asphalt | 3.7: a 0.5 s banner dwell (A), creatures excluded from `GATE_ROAD` (B), ground blend noted; test in `borders-browser`. Making the strip a region (the first fix offered) rejected: it adds a region step at z = +/-2.5 along the asphalt edge and changes the proofs of 2.3 |
| 7 | The landscape phone's far view fails its line on paper (should-fix) | **Accepted** | arithmetic of 4.6 (164, 181, 192 against 180, 180, 220) | 4.6: the lever is part of the build, A merges only on a `measureCalls()` pass at the two named far-view spots; acceptance is measurement; risk 1 |
| 8 | Save migration can wake a player inside a boss's range (should-fix) | **Accepted; radius 40 m, not 60 m** | `review2.mjs`: the Treant's den is 54.4 m from the old forest centre; `wilds.mjs`: boss sight 12 to 13 m, titan trigger 24 m (old 4.4); 40 m (clearing + 24) removes 1,556 places, 60 m would remove 2,589 (kept 14.7%) | 5.2 `keepable` with `nearDen` (`DEN_WAKE = 24`), 5.3 rows and numbers (22.5% kept, 2,992 of 13,312), 5.4 den-safety tests, Appendix B code and output re-run; sections 0, 9.2, 9.3 numbers |
| 9 | `regions.mjs` importing `GATE_ROAD.x1` is a circular import (**blocker**) | **Accepted** | round 8's `regions.mjs` already writes a literal `from: 67` with the comment that a test keeps it equal; `field-layout.mjs` imports `regions.mjs` | 2.1 `GATE_END = 67` literal; Appendix A header; 7.1 the equality test is the only importer of `field-layout.mjs`; `seams.test.mjs` asserts no `regions.mjs` to `field-layout.mjs` import |
| 10 | DENS power makes `regions.mjs` and `region-mix.mjs` import each other (**blocker**) | **Accepted** | `region-mix.mjs` has no imports and holds `POWER` today; the cycle throws when it is entered first | 2.5 new pure `src/power.mjs` (`POWER`, `powerOf`), `region-mix.mjs` re-exports `POWER`; import graph stated; `seams.test.mjs` asserts acyclic; 3.1, A.2, 8.2 item 3, 8.3, 8.4 |
| 11 | `tests/village.test.mjs` is frozen but asserts `regionAt(SAFE.x0 - 2.5, 0) === 'west'` (**blocker**) | **Accepted** | `village.test.mjs` line `assert.equal(regionAt(SAFE.x0 - 2.5, 0), 'west')` exists; (-59, 0) is on the west axis, `world.mjs` returns `north` | 7.1 new row: the assertion moves to z = 5, a `north` assertion is added, the creature loop is re-measured in step 0; off the frozen lists in 7 header and 8.3 |
| 12 | Bundle headroom is about 1.9 KB, not 448 bytes, and has no named lever (should-fix) | **Accepted** | `bsize.mjs` at `798ed32`: **1,098,048 bytes, 1,952 spare** (the reviewer's figure reproduced) | 8.2 item 7: the real figure, the estimate, the owner (A) and three named levers; risk 14 |
| 13 | `findRoute`'s `valid` cannot become a circle test: indoor routing shares it (should-fix) | **Accepted** | callers: `house-life.mjs`, `friends-view.mjs`, `world.routeTo`, `decor`, `house-life` and `fields` tests; `findRoute` has no pad parameter | 2.9 Tapped routes: box test kept, circle only when `bounds.r` is given, `world.bounds` outdoors `{294, 294, 294}`, no pad parameter; `worldClear`, `edgeObstacles`, `worldPoint`, `EDGE_BOX` deleted and `render.test.mjs` updated (7.1) |
| 14 | The blocked-spot fallback in `World.init` cannot see field scenery (should-fix) | **Accepted** | `world.mjs` `init`: `const lost = this.blocked(...)` runs before `this.fields.update(...)` | 5.3: pure `fieldBlocked` in `field-layout.mjs` (A), used by `init` and `restoreVehicles` (C); 5.4 scenery-safety test at the pond (-41.5, 82.5); 7.3 |
| 15 | `TILE_KINDS` strips whole regions inside border tiles (should-fix) | **Accepted** | `review3.mjs`: 8 of the 28 multi-region tiles leave a region with at least 5% bare under the first rule (the reviewer counted 12 over 32 tiles, including village tiles); 0 under the floor; worst piece loss 36% to 55% | 4.3 `TILE_KINDS` with a floor (pass 1 per region, pass 2 fill, cap `max(3, regions)`); tests in 7.3 |
| 16 | The tangent slide covers only the last sub-step; the stick-into-wall controller is axis-aligned (should-fix) | **Accepted** | `drive-view.mjs`: the `else if (this.contact && held)` block decides by `wallDepth` along axes and emits {-1, 0, 1}; `World.push` is axis by axis | 2.9 Driving: `edgeSlide` pure function, three places (sub-step, controller block replaced by a tangent rule when the contact is the edge, walker retry); edge-browser at eight bearings including 45 |
| 17 | `installLands`' ocean builder, `beachSea` and the minimap sea read the old sea box (should-fix) | **Accepted** | `land-view.mjs` ocean builder, `region-life.mjs` `beachSea` and `minimap.mjs` `drawFeatures` all read `x0, x1, z0, z1, x, z` | 3.4: one sea object `{kind, r0, r1, b0, b1}`, the old fields removed, every reader named with its owner; 8.6 rule 5 corrected |
| 18 | `wildCell`'s den and slot branches ignore the gradient and the den row's power (should-fix) | **Accepted** | `wilds.mjs` lines `power: REGION[d.region].kind === 'land' ? POWER[...]` and `power: info.kind === 'land' ? POWER[info.difficulty] : 1`; `pandora.mjs` `defeatCoins` | 2.5: the two lines named; coins stay on the inner-edge power, the mismatch stated and accepted; titan coins follow actual power |
| 19 | Light seam: wrong function name, `landShare` and `sight.dark` undefined (should-fix) | **Accepted** | `light-mix.mjs` exports `landLightAt`, `mixLight`, `LIGHT_FADE`; `world.mjs` `applyLights`; `pandora-view.mjs` `sight.dark` line | 2.7 rewritten with the real names, the constructor's `lightAt` shape, the `landShare` meaning, the blend formula and the sun intensity, `sight.dark` as `nightShare > .25`; `pandora-view.mjs` line in C's list |
| 20 | The ring ribbon adds 4,832 triangles to the village against "may not rise" (should-fix) | **Accepted as a budgeted increase** | 5,768 against 936; 4,832 is 1.6% of 299k, 3.2% of 152k, 4.9% of the phone's headroom | 2.8, 4.4, 4.6: the increase stated and accepted, the fix pass told; the proposed split by kind rejected as the default because one mesh with a world-sized sphere cannot be culled by kind and extra draws cost phones more than triangles; the eight-mesh lever kept for a tight village budget |
| 21 | Trails start inside the ward for two quarters; the trail API is not specified (should-fix) | **Accepted** | `review.mjs`: SE starts at (42.60, 40.40) and NW at (-50.28, -49.72), inside; NE 0.28 m outside | 2.8 trails: `from` computed with the half width clear (73.96, 62.69, 60.94, 73.96), `trailOffset(id, along)` kept, `TRAILS[id] = { bearing, from, to }`, readers named; trail tiles verified unchanged (`tt.mjs`); 7.1 numbers |
| 23 | `regionAt` and `edgeDepth` change behaviour for NaN (should-fix) | **Accepted** | `world.mjs`: `regionAt(NaN, NaN)` is `cloud`, `edgeDepth(NaN, NaN)` is NaN | 2.3 `!(r2 < R2^2)`, tie-table row; 2.9 `edgeDepth` returns Infinity for NaN; Appendix A lines; 7.1 test row |
| 24 | Findings on the fix pass: where it conflicts, by function and file (should-fix) | **Accepted** | `git log` and `git diff 1b65987..798ed32`; `borders.mjs` curtain material read | 8.6 rewritten against `798ed32` with the full function table, the geometry-reuse agreement, `pandoraPanel` and `finish.test.mjs` to B, the curtain wording settled (it is `DoubleSide` with `forceSinglePass` already, the camera sees its back faces), the freeze list |
| 25 | Unlisted tests and helpers that will break or need an owner (should-fix) | **Accepted** | `finish.test.mjs`, `travel-kit.mjs`, `regions.test.mjs`' temp copy, `seams.test.mjs`, `blocks.test.mjs` | 7.1 and 7.2 rows; 8.3 owners; the temp copy lists `hyp.mjs` and `power.mjs`; `seams.test.mjs` switched on by F's merge; the fixture is hand-made and validated by round 8's code, `layoutMoved` excluded (5.4); `blocks.test.mjs` one-line rule |
| 26 | No owner or function for the harsh-kit rule, the two-fetch limit or the world-sheet labels (should-fix) | **Accepted** | `fields.mjs` `want`, `world.mjs` `loadKit`, `world-sheet.mjs` `inRows` | 4.5: `kitReach` in `field-layout.mjs`, `want` and `loadKit` owned by A; 6.3: tiers 2 and 3 as the centroid of the visible part of the region (F); 8.3 |

**What was not re-run:** `verify.mjs` (974 assertions over the placement tables of 3.1 to 3.5) was not re-run because the review changed none of those tables; the den rows, features, stands and counts are unchanged. `migrate.mjs` was re-run with the den rule (Appendix B and C). The seam-start, trail and NaN changes are specified and checked by `review.mjs`, not added to the reference geometry file of Appendix A beyond the three marked lines. Nothing in the review was built.


---

# AMENDMENT A (2026-10-05): revised plan after review. This section OVERRIDES anything above that conflicts.

Why: a review of this spec found (1) a difficulty cliff at the inner circle (a player walking from the Lv 7 canyon into Night Land jumps +9 levels and x6.2 power in one step; in the outer ring the direction walked matters more than the distance), (2) high cost and unprototyped risk in drawing a tile that straddles regions as 2-3 pieces (landscape-phone far view about 181 draws against a 180 limit), (3) the zigzag planet order is the author's choice, not Zoo Garden's, (4) old saves far out are sent home and lose their position. Everything not mentioned here (radii R1 160 m / R2 296 m, quarters NE canyon, SE meadow, SW forest, NW swamp, circular edge, arc and radial rainbow borders in one draw, den formulas, cages, migration skeleton, builders) stays as specced.

## A1. One smooth difficulty curve (replaces the per-planet inner-edge numbers in section 3)
- Each planet's INNER-EDGE level equals the level of the home quarter it touches (the higher of the two quarters when it touches two) plus 1. It rises along the radius to the Zoo Garden level for that planet at the RIM (R2). Titans stand near the rim at rim level + 1. Power multipliers follow the same ramp from the neighbouring quarter's power (x1) to the Zoo Garden multiplier at the rim.
- There must be no step larger than +3 levels anywhere along a ray (assert it in a node test over 720 rays at 0.5 m steps).
- Keep `RADIAL_STEP` as the single tuning constant; recompute the printed level table, banners and Map labels from the curve (labels are "Lv a-b" per region).

## A2. Region look in vertex colours, not material groups (replaces the "material classes drawn as groups" design in section 3.9 / tiles)
- A field tile keeps ONE material and ONE draw. Region ground colour, glow, ice, sand, sea and lava seams are written per vertex (colour and one or two extra vertex attributes) from `regionAt` sampled per vertex; blending across a border is a short vertex-colour ramp (about 6 m) so seams look soft under the rainbow ribbon.
- Scatter, cover cards and glow stay per tile as in round 8; a straddling tile draws at most the union of its regions' blocking kinds, capped as specced.
- PROTOTYPE FIRST (half a day): one straddling tile at a border and at the three-region tile, measure draws and triangles on the landscape-phone far view. If vertex colours cannot carry a surface (e.g. water that needs its own material), only that surface gets its own draw. The spec's 181-vs-180 line must be re-measured, not assumed.

## A3. Safe outposts
- A small rest spot with a banner and a lamp at each crossing: 4 at the inner circle (on the radial through each home den's lane toward the planets) and 8 at the planet entries (mid-sector, 8 m inside the planet from the inner circle). A rest spot heals slowly, is creature-free within 10 m (like a mini ward), is a Home-teleport pad and shows on the minimap and Map. Save the player's last outpost.
- Banner on crossing: name, level range, a "Dangerous" chip when the next step is more than +3 levels above the player's best gear level (reuse Round 8's chip).

## A4. Delivery in two stages, reusing round 8
- Stage 1 (geometry only): polar `regionAt`, circular edge (`edgeDepth`, `edgeAhead`, clamp), arc and radial border runs and mesh, den, cage, pond and stand-point coordinates, `migrateLayout`, minimap and Map projection to a circular world, region ids kept (east/south/west/north). Tiles, creatures, bosses, titans, prisons, music, outfits stay untouched. Light testing only: npm test, build, old-save smoke, browser, maps, pandora, render, lands, budget.
- Stage 2: the vertex-colour ground (A2), the difficulty curve (A1), outposts (A3), Map/minimap polish. Ship stage 1 first.
- Do not start before the village-identical-open-or-shut fix and one full browser sweep of main (docs/REMAINING-WORK.md sections 6 and 2).

## A5. Planet order
- Default stays the zigzag (smallest neighbour jumps possible), BUT with A1 the cliff is gone, so the numbered Zoo Garden order becomes acceptable; its one hard seam (Night Land x6.2 next to Toybox x1.7 on the east axis) is then softened by A1's ramps and an outpost. USER DECISION: numbered order (Zoo Garden's, clockwise from NNE: cloud, shadow, toy, candy, jungle, ice, ocean, lava) or zigzag. Default if unanswered: numbered order, because the user asked for the reference's planets in the reference's order.

## A6. Old saves (replaces the migration rule for far positions)
- Keep the position when it lies in the ward or the home ring and at least `clear + 24` m from every home den (as specced).
- Otherwise move the player to the nearest outpost INSIDE the new world (not home) that is no more dangerous than the position was (fall back to the inner-circle outpost on the same radial), with the car parked beside it. Vehicles parked far out are moved the same way. One-time message. `defeated`, `friends`, `cleared`, `planted` untouched.
- If the player was riding, dismount at the outpost (standPose).

## A7. Notes for the builder
- Everything measured in the spec is from computation, not from a prototype: the circular wall slide, the 5,768-triangle ribbon, vertex-colour seams and light blending are unproven; prototype each before building on it.
- Keep testing light (user's rule, 2026-10-05): npm test, build, old-save smoke, a handful of key browser suites; a full sweep once on the final stage.
