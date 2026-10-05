# Willowmere: remaining work and hand-off (2026-10-05)

**Current review:** [Review and fixes — 2026-10-05](REVIEW-2026-10-05.md) records the subsequent code/logic fixes, integration status and explicit deferrals. Sections below preserve Claude's historical handoff and earlier verification; matching issues are superseded by that review. The section 8 handoff (`c1ab0d2`) has already been deployed.

For whoever reviews and fixes next (Codex, or a later session). Written by Claude after a long day of parallel work. Be sceptical of everything marked "not verified".

## 0. Where things are

- Repo: `3d_farmer_fish_sell` (esbuild + three r180, dense `.mjs`). Push to `main` deploys GitHub Pages (https://buicongnguyen.github.io/3d_farmer_fish_sell/).
- Live before this push: round 8 (13-square world, bosses, titans, prisons, rainbow borders, zoomable Map) plus its performance/governor follow-up, the legs-after-riding fix and the living pond (commit 99b316d).
- This push (branch `train3`) adds, on top of 99b316d: crop cards (crops centred in beds and sized like Zoo Garden), real garments and costumes and disguises, Pip's outfits, a distinct outfit per villager, the home camera fitted to width on phones, and procedural music. It was verified lightly (see section 2).
- Design notes, evidence and specs live outside the repo in `C:/Users/n/source/repos/cute_game-notes/willowmere/` (CONTRACT.md first: working rules). Key files: `ROUND8-*.md` (spec/inventory/findings), `ROUND9-RING-SPEC.md` (the next world layout), `WARDROBE*.md`, `HOME-MUSIC.md`, `MUSIC-DESIGN.md`, `CROPS.md`, `POND-LIFE.md`, `PEN-BIKES.md` (when finished).
- Zoo Garden (`C:/Users/n/source/repos/cute_game`) is the user's reference game; porting its code, models and generators is welcome. Never take anything from the outside reference site.

## 1. How to work here (hard-won rules)

- Never `git stash` (the stash list is shared across worktrees). Use one `git worktree` per task with a `node_modules` junction. Push only after `git fetch` and `git merge-base --is-ancestor origin/main HEAD`.
- Never put a trailing `//` comment in the middle of a dense one-line statement: it silently disables the rest of the line (it once broke the hunt buttons).
- First-load bundle limit is 1,100,000 bytes (`scripts/build.mjs` enforces it); lazy-load new code with `import()`. After this push about 4,800 bytes are spare.
- Do not use port 4173 or any port another process holds; stop servers by exact PID, never by process name. `/tmp` is shared between sessions: use per-session file names.
- Tests: `npm test` (node), then browser suites: `node scripts/build.mjs`; serve `dist` with `node C:/Users/n/source/repos/cute_game-notes/willowmere/serve.mjs <abs dist> <port>`; `GAME_URL=http://127.0.0.1:<port> GPU=1 node tests/<suite>.mjs`. `ls tests/*browser*.mjs` lists them. The machine is slow when shared: a 2-minute suite can take 10; re-run a timing failure alone before believing it. `fishing-controls.mjs` is a helper, not a suite; `pond-perf.mjs` needs `BASE_URL`.
- The save key is `willowmere.save.v1`; old saves must always load. Saved tree indexes are never renumbered (mark gone, append new).

## 2. What was and was not verified for this push

Verified: `npm test` 380 pass; build under the bundle limit; light browser check of: browser, pandora-browser, render-browser, house-browser, home-mobile-browser, music-browser, crops-browser, wardrobe-browser; an old-save smoke.
NOT run on the combined build (run these first): the full sweep of every other suite (activities, release, doors, lands, maps, budget, governor, farm, fishing-simple, pond, legs, borders, bosses, camera, edge, fields, prisons, titans, vehicle, wake, drive-budget, garments-browser (about 15 min), villagers-outfits-browser, round6, round7). Each passed on its own branch; the combination was not swept.
No human has looked at or listened to the result on a real phone.

## 3. Known issues (from reviews; in priority order)

1. Phone triangles while driving through the village were never measured; PC peaks at 402k-424k triangles (line 400k) driving through the village.
2. Night Land is almost black on a phone away from lamps (player barely visible).
3. Ember Fields arrival weather toast overwrites the "Back in Ember Fields" greeting at Begin.
4. Planted fruit trees from old saves are dropped when their spot no longer exists (documented rule; a test save went from 2 trees to 1).
5. Pond (live): about 4 KB/frame of allocation remains in the pond chunk; phone draws +7 versus before; a governor step change during a bite rebuilds the school and visibly resets the fish. FIXED in 22d9dc3: the fish were sinking below the pond bed (the bake and the tail hinge were fine); they now stand whole at 0.3 m depth, but they read like top-down toy fish (flattened to half thickness), the catfish roll is limited, carp/catfish still look brown/grey, and the 844x390 landscape view was not captured.
6. Music: every check is a measurement; nobody has listened. Shadow/boss/titan pieces lose 8-9 dB on a phone speaker. Disguise skills and Pandora drops for disguises are not ported (Zoo Garden has no drop table; skills need combat changes).
7. Wardrobe: garment icons are drawn without a body (neck hole visible); a Grown-up wears hems lower than a Tall body; Hugo's knight outfit is close to Pearl's; June/Cora and Theo/Oren share a garment cut; Pip's village mesh was verified by the test hook and the house picture, not by a village screenshot; the 16 Zoo Garden disguises are for sale only (no villager wears one: it would cost an 842 KB download).
8. Crops: young crops/seeds are smaller than before (Zoo Garden's proportions; `SHARE` in `src/crop-cards.mjs` is the lever); tree crops inside beds (as in Zoo Garden) do not exist in Willowmere; flower mapping tulip/daisy/sunflower to Zoo Garden's rainbow rose/moonflower/star is a choice.
9. Jeep: can wedge beside a tree off a building corner (near the clinic and the school); a glancing hit dips speed briefly; fast weaving against a wall crawls.
10. Home: at the door the back rooms are cropped by the screen on landscape phones (reach them by walking).
11. Villagers walk through each other and through the player on foot.
12. Zoo Garden side (separate repo): online play changes were tested only in unit tests; per-step allocation only partly fixed.

## 4. Work requested by the user and not finished

### 4.1 Pen, roaming animals, two more motorbikes (branch `pen`, in progress, NOT merged)
User: "make the animal pen a little larger. let the chicken, cow, duck wander around 9 time larger than the size of the fence, but not let them to into the street and into the pond. add two more motor bike, some people will go from their house to facility building by motor bike."
Reading used: 9x the fence's AREA (3x wide, 3x deep, centred), minus roads/paths (1.5 m margin), pond (2.5 m), buildings, fences, trees, crop beds, stalls, vehicles; animals return to the pen at night; two NPC motorbikes parked at two houses and at facility bike bays, ridden by two residents whose work is at a facility, roads and lanes only, speed about 7-9 m/s, poses via `seatPose`/`standPose` in `src/drive-view.mjs`. Expect to merge with the outfit work (villagers) and the "same when open" rule below.

### 4.2 Pandora open must change nothing inside the village (user's latest rule)
User: "I changed my mind, when Pandora box open, every thing in the village still work as not open."
So: villagers walk the same routines and trips whether the box is open or shut (today `src/villagers.mjs` ~200-204 and `src/villagers-view.mjs` ~78 limit them when open: at most 2 out, trips at most 46 m, children stay in: remove, and change the tests that pin it); the adventure-outfit swap when the box opens (`src/outfits.mjs`, `World.dressVillagers`, the family at home) must go: every villager keeps their own distinct everyday outfit all the time; the village music theme must not switch to a Pandora theme inside the village; the pen animals and motorbike riders behave identically open or shut. Then audit everything else that reads `state.pandora` for village behaviour. The box still shows the ward ribbon and the wilds outside the ward; creatures never enter the ward. (In progress for villagers/animals/riders inside branch `pen`; NOT done for outfits and music, which are in this push as built: adventure outfits still swap when the box opens, fix first.)

### 4.3 Ring-shaped world (round 9) — spec done, nothing built
User: concentric layout: village in the centre, an inner ring of the four home regions (quarters), an outer ring of the eight Zoo Garden planets, difficulty rising with distance, the world a circle. Build document: `ROUND9-RING-SPEC.md` (238 KB, reviewed: R1 160 m, R2 296 m, planets clockwise from NNE: shadow, lava, ocean, jungle, toy, candy, ice, cloud; quarters NE canyon, SE meadow, SW forest, NW swamp; borders as arcs and radial lines in one draw; save migration `migrateLayout`; builders and ports listed). Open choices with defaults are listed in section 13 of that spec. Do this only after the above are merged; cut the branch from the final main.

### 4.4 Smaller asks still open
- Villagers wearing Zoo Garden disguises (user wanted costumes and disguises reused on villagers; builder used costume armors instead to avoid the 842 KB download).
- Tree crops inside the garden beds (Zoo Garden has them): a content/balance decision for the user.
- Disguise skills and drops (see 3.6).

## 5. Suggested order for the reviewer

1. Build and run the not-yet-run suites (section 2) on `main` after this push; fix what fails.
2. (Done) pondfix is merged; just look at the pond fish at close zoom on a real phone.
3. Finish and merge `pen` (4.1) together with 4.2 for villagers; then remove the adventure swap and the village music switch (4.2).
4. Look at the whole game on a real phone: home interior edges, music (listen), outfits, crops, pond.
5. Then the ring world (4.3).

## 6. What remains once the pen branch is merged (the Codex task list, in order)

Assumes branch `pen` (larger pen, roaming animals, two NPC motorbike riders, villagers no longer limited by the Pandora box) is merged. If it is not on `main` yet, merge it first (`git log main..pen`); its notes are in `cute_game-notes/willowmere/PEN-BIKES.md` and the reviewers' findings (if any were left unfixed) are listed at the end of that file.

1. **Make the village identical open or shut (user rule, section 4.2).** Remaining after `pen`:
   - Remove the adventure-outfit swap: `src/outfits.mjs` (derive outfits from the resident id only, never from `state.pandora`), `World.dressVillagers` (no rebuild on box toggle), the family at home in `src/house-life.mjs`, the villager talk portrait; update `tests/villagers-outfits.test.mjs` and `tests/villagers-outfits-browser.mjs` to assert identical outfits open or shut.
   - Music: the village theme must not change when the box opens (`src/music/` director); region music starts only outside the village; update `tests/music-browser.mjs`.
   - Grep every other read of `state.pandora` / `s.pandora` / `world.pandora.active` for village behaviour (the Pandora panel text, the chip, the ward ribbon, wilds and creatures stay box-dependent; nothing inside the ward may be).
2. **Run the full browser sweep once on `main`** (list in section 2) and fix what fails; nothing was swept on the combined build.
3. **Known issues** in section 3, in that order (phone triangles while driving; Night Land readability; Ember Fields arrival toast; dropped planted trees from old saves; pond allocation and phone draws; disguise skills/drops; wardrobe polish; crops sizing; jeep wedging; home landscape back rooms).
4. **Look at it on a real phone** (home interior edges, outfits, crops, pond fish, pen animals and motorbike riders) and **listen to the music**; adjust pieces that sound wrong.
5. **Ring-shaped world (section 4.3)**, after everything above is merged and swept: build from `docs/ROUND9-RING-SPEC.md` (copy in cute_game-notes/willowmere/) on a branch cut from the final `main`; READ AMENDMENT A at the end of that file first: it overrides the spec (smooth difficulty curve, vertex-colour regions, outposts, two-stage delivery, saves moved to an outpost, planet-order decision).
6. **Optional user decisions** still open: tree crops inside garden beds (as in Zoo Garden); disguises worn by villagers; which of the spec's open questions in `ROUND9-RING-SPEC.md` section 13 to change from the defaults.

Working agreement with the user (2026-10-05): keep testing light (unit tests, build, a few key browser suites, an old-save smoke), skip testing for simple changes, do not write new test cases for every change, merge sooner. Run the full sweep only when asked or once on a big combined build.

Publishing agreement (user, 2026-10-05): after completing and checking each feature or fix, commit it and deploy it to the existing GitHub Pages site. Do not leave completed work only in a local worktree.

## 7. Update: the pen branch is merged and live (7ccc928)

Done: larger pen with a gate (178 m2), roaming range, gate-stall fix, two NPC motorbike riders (Theo to the police station, Finn to the supermarket) with a wider yield, and villagers no longer limited by the Pandora box. Only npm test (402) and tests/browser.mjs ran on it.
Open from it:
- Roaming area is 401 m2 = 2.25x the pen, NOT the 9x the user asked for (the 3x-by-3x rectangle is cut by roads, the Moss barn, fields and pockets; about 300 m2 is unreachable, mostly 123 m2 west of the north gravel lane). Reaching 9x needs the animals to cross the lane or the barn/fields to move: ask the user.
- The cow gate unstick (gateUnstick in src/pen-range.mjs) and the wider bike yield were never run in a browser: run pen-roam-browser and bike-riders-browser.
- Riders: draw calls, memory, shadows, indoor hiding, box toggled mid-ride, the player riding past them, day change were never measured. A mid-ride reload puts the rider at the bay (by design: position derives from the clock).
- The enlarged fence is about 0.2 m from the Moss barn.
- Section 6 item 1 (identical village open or shut) still applies to outfits and music; villagers' routines are done.

## 8. Latest handoff completed locally (2026-10-05)

Scope confirmed by the user: finish the latest handoff first; defer the older backlog and ring-world redesign. Animals may cross the small lanes, visit the garden and pond bank, and ducks may swim. Also requested: enlarge the village pond 1.5x in both dimensions; reuse more fish/tree types from `cute_game`; populate the outdoor ponds.

Implemented:
- Pandora toggles preserve all villagers' everyday outfits, talk portraits, family outfits, routines and active rides. Opening the chest no longer rebuilds the house or resets family movement. Local music ignores outdoor threats/fights and clears held combat music immediately on returning to the village or an interior.
- Pond dimensions are now 21 x 13.5 m (previously 14 x 9). Dock and walking destinations moved to the new bank. Fishing uses the enlarged rectangle's boundary when an early pull approaches the shore; old saves inside the expanded water relocate safely to dry land.
- Land animals can cross gravel lanes and roam the garden and shore, keeping off asphalt, beds, trees and buildings. Ducks have swimming routes through the gate to the pond, paddle on the water, and return at night. Swimming ducks can be tapped to feed/collect from the bank; an animal hit takes priority over fishing. Range-edge clearance includes the grid boundary.
- The fence is pulled 0.6 m clear of the Moss barn: approximately 0.8 m gap, with a 171.6 m2 pen. Fresh-village browser measurement: 1,658.9 m2 connected land = 9.67x the pen (the swimming route is additional).
- Five extra catchable fish: clownfish, pufferfish, sunfish, eel and Lake Guardian. The complete source fish kit and Guardian icon are included. Body/tail batches retain the full models, with corrected joining pivots for the broad sunfish fin and curved eel tail.
- All nine existing outdoor ponds have ambient schools (six fish on desktop, three on phone/battery/governor); three species per pond. The ice and shadow ponds also use icepike/angler. Schools activate nearby, reuse instanced batches, cast no shadows, and freeze when paused. Night Land fish have small glow holes in its darkness mask.
- Swamp tree, jungle tree and palm are extracted into a 46 KB village kit and placed on five existing garden/pond tree spots. Historical tree kinds, positions, sizes, cleared IDs and fruit-tree saves remain intact; clearing the decorative model works through the same tree ID.
- Bikes yield to animals as well as people/bikes; parked-bike shadows now update with player distance too.

Verification:
- Full unit run: 402 passed, one skipped; no failures. After the final fence change, 35 pen/render/bike checks passed, including 20 seeds x 10 simulated hours and all-home-at-night checks. A further 32 pond/fish/game/land checks passed.
- Build passes: 1,097,453 bytes before the first frame, under the 1,100,000-byte cap. Asset hashes/provenance updated.
- `pen-roam-browser.mjs`: sampled day/night with no violations; all home and gate shut, desktop/phone duck swimming, feeding/collecting outside the pen. Targeted phone repeat verifies bank-side feeding after the last interaction fix.
- `bike-riders-browser.mjs`: desktop and phone mounts, rides, dismounts, parked bays, indoor hiding, evening return; Pandora toggled mid-ride without replacing/repositioning rider or bike. Each bike is one mesh. Representative ride frame totals: desktop 162 draws / 298,166 triangles, phone 126 / 243,475; these are whole-scene counts, including shadows. Renderer resources ride -> parked: desktop 146 -> 168 geometries, 11 textures; phone 134 -> 143 geometries, 10 textures. These snapshots include normal resident loading and are not a long-run leak measurement.
- Controlled player-yield browser smoke: Theo slowed below 0.5 m/s approximately 1.75 m from a player blocking the route; after the player moved aside, both bikes reached their work bays.
- `villagers-outfits-browser.mjs`: all 23 outfits/positions stay stable, home family and talk portraits match, 506 distinct-resident portrait pairs checked. Matching portraits require identical masks; one-step GPU colour rounding is tolerated.
- `village-handoff-browser.mjs`: desktop, portrait and landscape pond views; local music and held-fight reset; all nine outdoor schools moving inside water, six fish draws per active pond; old save keeps inventory, cleared trees and planted fruit trees.
- Evidence is in the local checkout's ignored `test-results/` folder. No full older browser sweep or ring-world work was performed.

Older backlog in sections 3-6 remains separate. Mid-ride reload still derives a parked bay from the clock; changing that requires saving NPC ride progress. Real hardware play/listening and long-run memory profiling remain optional follow-up checks. Publication update: this section 8 handoff was committed as `c1ab0d2` and deployed to GitHub Pages by [run 37271247549](https://github.com/buicongnguyen/3d_farmer_fish_sell/actions/runs/37271247549). The subsequent [review pass](REVIEW-2026-10-05.md) has its own validation and release status.
