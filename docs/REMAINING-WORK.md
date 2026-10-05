# Willowmere: remaining work and hand-off (2026-10-05)

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
