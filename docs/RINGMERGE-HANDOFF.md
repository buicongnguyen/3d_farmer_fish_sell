> Integration review: see [RINGMERGE-INTEGRATION.md](RINGMERGE-INTEGRATION.md) for the merge with newer main, current validation and remaining limits. The report below records Claude’s earlier branch state.

# Ring world merged with main: hand-off for Codex (2026-10-06)

Written by Claude (Sonnet 5.5). Branch `ringmerge` (worktree `3d_farmer_fish_sell-ringmerge`) = the ring world (ring9, head 98f138b) with `origin/main` merged in. NOT pushed. `main` is untouched. Please review, then push (section 2).

- Based on `origin/main` **acf0942** (merged at that point; `git merge-base --is-ancestor origin/main HEAD` was true). First merge was at ee609ea, a second at acf0942 (clean).
- Review head: see `git log -1` of `ringmerge` (the commit that adds this file; the code head before it is a4c9654).
- After the merge, origin/main's docs win: `docs/RING9-REMAINING.md` and `docs/REMAINING-WORK.md` are main's copies, unedited.

## 1. How to combine: options evaluated, and the choice

| Option | For | Against |
|---|---|---|
| (a) `git merge origin/main` into ring | One resolution of everything; keeps history of both; re-mergeable when main moves again (a second merge took 0 conflicts); only files both sides touched can conflict | One big merge commit to review |
| (b) rebase ring (35 commits) onto main | Linear history | Replays each ring commit and resolves the same hot files again and again; rewrites ring9 history; every new Codex push means another full rebase; force-push risk |
| (c) re-apply ring changes by function on a fresh branch from main | Cleanest diff | 51 files, +1308/-1086, much of it dense one-line files: very high risk of dropping a ring change by hand; no tooling check that nothing was lost |
| (d) Codex merges | Codex knows main | Codex is busy keeping main moving; the merge is mechanical |

Chosen: **(a)**. Measured reason: only **7 files** were touched by both sides (`src/game.mjs`, `src/main.mjs`, `src/minimap.mjs`, `src/world.mjs`, `tests/farm.test.mjs`, `tests/minimap.test.mjs`, `tests/village.test.mjs`); git auto-merged five of them and only **two had real conflicts (one line each)**. The feared 101-file overlap was not real. With such a small overlap a merge is cheaper and safer than a rebase or a hand port.

## 2. How to push safely

```
cd C:/Users/n/source/repos/3d_farmer_fish_sell-ringmerge
git fetch
# if origin/main moved: git merge origin/main   (resolve by function: Codex wins villagers, fish, farm, interiors, plants, pond; the ring wins regions, edge, borders, dens, save layout, maps)
git merge-base --is-ancestor origin/main HEAD && echo ok     # must print ok
npm test                      # 498 pass at acf0942
node scripts/build.mjs        # first load must stay under 1,100,000 bytes (1,097,608 now)
git push origin ringmerge:main
```
Then watch the Pages workflow, and open the live site: start a game, open the Map. Important: **old saves exist on the live site**: the first load after the push runs `migrateLayout` for every player (section 5, item 3).

## 3. Conflicts, file by file

| File | Conflict | Resolution |
|---|---|---|
| `src/game.mjs` | `freshState` one-liner: ring added `layout:2,layoutMoved:false`, main added `bankCatch:null` | Took the ring line and added `bankCatch:null` after `chapter:0` (statement-level edit). Both fields exist now |
| `src/world.mjs` | import line: ring `import {atBank} from './pond.mjs'`, main `import {RodFishingView} ...;import {atBank,waterPond}` | Took main's `atBank,waterPond`; **dropped the static `RodFishingView` import** (see below) |
| `src/main.mjs`, `src/minimap.mjs`, `src/world.mjs` (rest), `tests/farm.test.mjs`, `tests/minimap.test.mjs`, `tests/village.test.mjs` | none: git merged different hunks | Verified by `npm test` (496 then 498 pass), no test needed changing for positions: Vale workshop, pen range, bike riders, pond and flowers tests all pass unchanged |

**Bundle limit:** after the merge the first load was 1,103,263 bytes (3,263 over). Cause: main's `world.mjs` imports `RodFishingView` statically AND with `import()` at init (`this.rodFishing=new((await import('./rod-fishing.mjs')).RodFishingView)`); the static import pulls the "lazy" chunk into the first load. Removing the unused static import gave 1,097,3xx. **main itself is at 1,099,476 (524 spare) because of the same import: the same one-line removal frees about 2,100 bytes on main too.** Fishing still works (browser and lands suites pass; the dynamic import was already the one used).

## 4. What I fixed, with numbers

**1. Volcano Dragon 'Lv 12' vs 'Lv 19'.** The curve (`LEVELS`, `RADIAL_STEP` 0.12) is right and untouched: lava goes Lv 5 at the inner arc to Lv 13 at the rim (slope 0.059 m/level, capped by Zoo Garden's level 13 = 3 d - 2). The dens were wrong: bosses were `levelAt + 2` and titans `rim + 1` wherever they stood, so the Scorpion (Lv 14) stood 4 above its neighbours. Zoo Garden's dragon is Lv 19 = rim + 6, which cannot coexist with "no step above +3 along any ray" (neighbours at the dragon's den, 251 m out, are Lv 10; 13 at the rim). New rule in `src/regions.mjs` (`DEN_STEP = 3`): land den level = `min(titan ? rim+1 : infinity, levelAt(x,z) + 3)`; home dens keep Zoo Garden's levels as labels (home creatures play at power 1).
Before / after (boss or titan Lv): shadowlord 13 to 14, titan_eye 17 to 16, golem 10 to 11, **dragon 12 to 13** (Zoo 19), titan_scorpion 14 to 13, leviathan 9 to 10, kraken 11 to 11, gorilla 6 to 7, robot 5 to 6, cake/gingerbread 6 to 7, jellyqueen 7 to 8, yeti 6 to 7, mammoth 7 to 8, frostowl 10 to 11, phoenix 12 to 13, whale 14 to 14. All now within 1..3 above `levelAt`.
`tests/maps-browser.mjs` now expects `Lv 13`. Tests updated to the rule: `regions.test.mjs`, `region-mix.test.mjs`, `titans.test.mjs`; one new node test (every land den is 1..3 above its surroundings and no titan above rim + 1).
**Decision for you / the user:** if the dragon must be Lv 19 as in Zoo Garden, either raise the lava curve (rim 19 breaks "rim = Zoo Garden level" for creatures) or move the dragon's den to the rim and give the dragon its own bonus (a +6 step at one creature). I kept the smooth rule.

**2. PC village cost (tests/budget-browser.mjs 'village', PC high).** Measured on the same machine, same suite:

| | draws | triangles |
|---|---|---|
| old note (before ring, main 99b316d era) | 176-179 | 299k |
| current origin/main (ee609ea) | **184** | **313k** |
| ringmerge (ring + main) | **195** | **348k** |

(Main already rose 176 to 184 and 299k to 313k by itself, from Codex's features. Budget lines: PC 240 draws / 400k: both pass.) The ring adds **+11 draws, +35k triangles** over current main. Cause (temporary probe of every drawn object in both builds, then reverted): (1) region content in view: the village camera at (8,18) sees the SW forest tile at (-64,64) with an 18-instance batch of the 1,662-vertex tree against 7 on main, plus the batch at (-64,0): about +13k main pass and +19k shadow pass (the shadow pass doubles every caster); (2) `region-borders` 5.8k triangles, drawn once, against 0.9k on main (the spec's accepted +4.8k); (3) minus about 3k from sea-turtle and toy-train meshes that are no longer in the village's view. The vertex-look ground itself is not heavier (`field-ground` 21.6k against 23.0k on main). No trim was applied: it is the intended forest density plus the budgeted ribbon, inside the lines. Cheap levers if wanted: split the border mesh into eight culled pieces (spec lever), cap heavy tree instances on tiles within about 100 m of the ward.
Other budget results on the merge (ring spots, PC / phone / landscape): all 30 spots inside the section 18 triangle lines; phone village 123 draws / 186k (main at ee609ea: 119-120, and **main's own phone village fails its 118 draws line in the main-checkout run I made**, so that line needs adjusting on main either way), landscape village 140 / 202k.

**3. migrateLayout with a real OLD save.** Script (not in the repo): `scratchpad/willowmere/oldsave.mjs` (base save taken from the LIVE site after a short play: `layout` field absent, position (0,-4)), edited and loaded into the local ringmerge build on a phone viewport. No page errors, no failed requests in any case:

| Case (old position) | Woke at | Region | State |
|---|---|---|---|
| as-is (village) | (0,-4) | village | unchanged |
| old den (227,-185), box open | (155,-61) | shadow gate outpost | on foot, box still open |
| far out (300,-250) | (155,-61) | same outpost | on foot |
| (-400,60) | (-155,68) | ice gate outpost | on foot |
| riding a jeep at (250,200) | (155,68) | toy gate outpost | dismounted, jeep parked at (149,69.5) beside it |
| riding a bike at (-300,-120) | (-155,-61) | ocean gate outpost | dismounted, bike parked at (-161,-59.5) |
| pond spot (-41.5,82.5) | (-107,111) | SW inner-circle outpost | within the home ring |
| ward (-20,10) | (-20,10) | village | unchanged |
| jeep parked far (-350,-100), me at home | me (5,5); jeep (-149,-59.5) | | jeep moved inside the world, not beside me (known: item 6 in RING9-REMAINING) |

All positions are inside the world (radius under 296). `layout` is 2 in the saved JSON afterwards. Not checked: the one-time toast text on screen, mid-fishing (fishing is not saved, so the case is just a position), a very old save with missing fields (only the live site's own save was used).

**4. Suites not ported** (cheap port was not attempted: I spent the time on the three items above and on the full merge verification): `borders-browser`, `bosses-browser`, `titans-browser`, `vehicle-browser`. They still encode the old squares. Not run at all.

## 5. What was tested, and what was not

Run on the merged tree (all passing unless noted):
- `npm test`: **498 pass, 0 fail** (at acf0942 + ring; 497 at ee609ea + the level tests). One run before I fixed `region-mix`/`titans` tests had 2 failures, now fixed.
- `node scripts/build.mjs`: first load 1,097,608 of 1,100,000.
- Browser suites on the ee609ea merge build: `browser`, `pandora-browser`, `render-browser`, `lands-browser` (a "Page crashed" in one test under GPU load, passes alone, 18 of 18), `edge-browser`, `budget-browser` (30 spots), `maps-browser` (needed two expectation changes: dragon Lv 13 and the Map now lists `outpost` markers with the box shut).
- After the second merge (acf0942): `npm test`, build, `browser`, `maps-browser` only.
- Old-save check: item 3 above (against ee609ea + ring, not re-run after the acf0942 merge, which touched only pond, lotus, pen and wardrobe).

NOT run: `house-browser`, `fields-browser`, `hired-villagers`, `wardrobe-tabs`, `pond-garden`, `animal-produce`, all other suites listed in `tests/`, any sound check, any real phone, any full sweep. **`pond-browser` and `farm-browser` fail identically on a clean ee609ea checkout built the same way (pond: "headings change" assertion; farm: `willowmere` not defined at boot), so they are not caused by the ring; I did not investigate them.**

## 6. Open items, priority order

1. Port `borders-browser`, `bosses-browser`, `titans-browser`, `vehicle-browser` to the circle (update geometry assertions, not intent); also the travel-shots and maps-merge-shots scripts.
2. Loosened assertions from ring9 (road strip coverage under crown overlays, crown pixel size at k=4, region-label counts, lands mask-hole count, edge slide distance) still to tighten; plus the ones I edited: dragon Lv 13, Map shows `outpost`, `region-mix`/`titans`/`regions` den level rule.
3. Old-save migration on the live site: re-run item 3 against the pushed build; vehicles on a migrated save are parked at the outpost, not guaranteed free of scenery (`World.init` has no scenery check of its own).
4. Minimap rim crowns overlap on the Candy stand on the 96 px phone minimap (`RIM_SLIDE` finds no free spot); phone minimap and Map checks generally.
5. Look at it on a real phone: circle edge, borders ribbon, banners, outposts, each planet's look.
6. Planet order decision (default numbered, Zoo Garden's: cloud, shadow, toy, candy, jungle, ice, ocean, lava; zigzag via `fromZigzag`): ask the user.
7. Not prototyped: circular wall slide at speed, vertex-colour seams, light blending across borders (spec A7).
8. Dragon at Lv 13 vs Zoo Garden 19 (section 4.1) and the phone village draws line on main (119-120 against 118).

## 7. Known risks of the ring (what to look at on a phone)

- First load margin is 2.4 KB: any new static import can break the build again; keep `import()`.
- Forest/swamp tile density seen from the village on PC adds about 35k triangles; check a low-end phone at the village's south-west edge.
- Borders ribbon: 5.8k triangles in view from the village, one draw.
- The old save of every live player is migrated on first load: positions out in the old wilds move to an outpost.
- Banners and outposts load lazily after boot (`import()`); the first seconds have no outposts on the Map.

## 8. Rollback

`ringmerge` is a separate branch; main is untouched until you push. To drop the ring: do not push. After a push (a fast-forward, since ringmerge contains main), note the main sha you pushed over (`git rev-parse origin/main` before pushing) and restore with a revert of the range `git revert --no-commit <old main>..HEAD`; players whose saves were migrated would keep `layout: 2` and their new positions, so ship the revert quickly or keep the `layout` field handling.
