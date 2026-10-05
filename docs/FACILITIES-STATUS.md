# Facility interiors: status and hand-off (branch `facilities`, from main 646c30a)

Plan: `docs/FACILITY-INTERIORS-PLAN.md` (read sections 2 and 7 first).

## What was built (all eight buildings are done, whole)
One reusable system: `src/facility-plans.mjs` (data: rooms, walls, pieces, targets, staff, family), `src/facility-interior.mjs` (shell, pieces, colliders, targets, people, disposal), `src/facility-view.mjs` (lazy install, `enterFacility`, wraps `world.buildInterior` and `world.exit`; world.mjs only gained `export` on `bake`), props `public/assets/models/facility-props.glb` from `art/blender/build_facility_props.py`. Reused from the house: interior.mjs helpers (now exported), room-camera (plan rooms hook), minimap `drawRoom` (plan hook), main.mjs (door dispatch, HUD name, map view).

| Building | Rooms | What you do inside | Who is inside |
|---|---|---|---|
| Supermarket | cold, fresh, back room, aisles, checkout | checkout counters open the sell panel (25% premium; the trip is counted on entering); fun lines elsewhere | Nell, Oren (checkout), Finn (back room), work hours |
| Hearth Bakery (new door) | bakehouse, pantry, family corner, shop | the oven opens the Country Kitchen (cook) panel | Hugo and Nell when at home (early, evening) |
| Moss Barn (new door) | stable, feed and tools, beds, barn floor, kitchen | feed sacks = Feed, milking stall = Collect (the pen's actions) | Mara, Oren, Wren when at home |
| School | two classrooms, library, hall, yard | the blackboard starts the lesson panel (lesson/answer quiz) | Cora at the board, pupils at desks (yard at midday) |
| Clinic | two exam rooms, pharmacy, waiting, reception | either bed opens the check-up panel | Hazel (bed 1), Sylvie (pharmacy) |
| Police | two cells, evidence room, office, front lobby | the front desk opens the patrol panel | Pearl (office desk), Theo (front desk) |
| Willow & Co. | boss office, meeting, break room, open office | hiring board opens the leader's workers panel; the free desk opens the shift panel | Bea, Leo, Fern at desks |
| Vale Workshop Barn (new door) | lumber, tool bay, parts, workshop | the counter opens the Vale workshop (upgrades) panel; the well stall still works | Ash when at home |

Doors: the five Town Square doors keep their targets (`civic`/`shop` now enter; the same panel opens from inside). The bakery (27, 24.7), Moss barn (28.4, -14.6) and Vale barn (-36.2, 29) doors are new `facility` targets: their exact positions near trees and fences were not walked (the browser suite enters them through a test hook).
Saves: nothing new is saved; a save is always written with the village position, so old saves wake outside. House interiors are unchanged (house-browser passes).

## Tested
- `npm test`: 503 passed (before the barns were added); the new `tests/facility-plans.test.mjs` (4 tests: rooms tile the envelope, doorways, spots inside bounds, timetable occupants, actions kept) passes with the final plans.
- `tests/facilities-browser.mjs` (GPU, port 4601): all eight buildings at 1440x900 (real door and E for the supermarket; test hook for the rest) and 390x844: inside, targets present, people present, 60 draw calls or fewer (18-27 seen), both side walls on screen (desktop) or you on screen (phone), the action opens its panel (desktop), exit returns to where you entered, no console errors. `ONLY=<id> T=<hour>` runs one building at an hour (bakery needs T=7). Pictures: `cute_game-notes/willowmere/evidence-facilities/` (looked at: supermarket, school, clinic, police, company, bakery and Moss at desktop; supermarket and school on phone).
- `tests/browser.mjs` and `tests/house-browser.mjs` once at the end: both pass.
- NOT tested: the Vale barn picture and the barns on a phone were not looked at (assertions pass); 844x390 landscape; walking through every doorway by hand; the other browser suites (doors-browser may pin a civic door opening a panel); no human on a real phone.

## Bundle
`dist/assets/game.js` 1,099,285 bytes before the first frame (limit 1,100,000: 715 bytes to spare; it was about 2.3 KB under). Lazy: 265 KB of chunks plus the 555 KB props file on the first visit.

## Sources and licences
Everything is original (Blender generator; house kit from the owner's Zoo Garden). No internet assets used (docs/ASSETS.md).

## Open items (priority order)
1. Walk each door on a real route (bakery, Moss and Vale doors especially) and tune door positions; run doors-browser and the wider suites.
2. Trim `facility-props.glb` (555 KB: merge colours into vertex colours) and widen the bundle margin (715 bytes) by moving more of main.mjs behind import().
3. The bakery has no buy-baked-goods action (the game has none); Hugo is at the market stall in work hours, so the bakery is quiet by day.
4. People stand or sit but do not walk between rooms; give them talk lines (house-talk.mjs); the school has 6 desks for 5 children.
5. Minimap shows rooms without labels; facilities use the village music theme.

## How to merge
`git fetch; git merge origin/main` into `facilities`. Likely conflicts: `src/main.mjs` (interaction(), hud(), mapView(), the installOutdoors line, the installProbe call), `src/room-camera.mjs` (aim(), focusRoom), `src/minimap.mjs` (drawRoom), `src/interior.mjs` (export keywords), `src/world.mjs` (`export function bake`), `src/test-hook.mjs`, `docs/ASSETS.md`. Then `node scripts/build.mjs` (bundle limit), `npm test`, `GAME_URL=... node tests/facilities-browser.mjs`. Push only when `git merge-base --is-ancestor origin/main HEAD` holds.
