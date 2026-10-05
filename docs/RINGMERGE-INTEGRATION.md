# Ring world integration — 2026-10-06

Merged Claude's ringmerge (0224a36) with current main (25857f8). The only conflict was the world-map import: retained both the outpost flag and Vietnamese translator. Ring geometry, dens, borders, vertex-colour terrain, smooth levels, migration and outposts are preserved; recent fishing, crops, collection, wardrobe, interiors and translations remain.

Kept the numbered clockwise planet order and smooth level curve; Volcano Dragon remains level 13. Updated the migration toast to say safe outpost, because migrations may land at an outer gate. Added Vietnamese for the ring's level ranges, outpost names and explanations. Corrected phone wardrobe category buttons to 44 px minimum height after house validation exposed their 30 px touch targets. Updated the phone watering regression to use the current garden menu instead of expecting the obsolete immediate-water action.

## Validation

- Full unit suite: 499 tests, 498 passed, one local-environment skip; targeted gear, wake and Vietnamese tests pass after final adjustments.
- Production build: 1,097,661 initial bytes, 2,339 below the enforced limit.
- Map suite: passed; crowns, cage states, outposts, dragon event, routes and both map sizes.
- Dedicated phone ring integration: seven old-layout saves (home, old den, far east, far west, jeep, bike, pond); inventory/coins preserved, safe positions and vehicle clearance, no second migration on reload. Visits all 26 relocated dens; modelled bosses load real assets; circular ribbon has 5,768 triangles and is visible.
- Recent village suites: wardrobe tabs, animal produce, pond/flower assets, Vietnamese, phone watering, field batches and outside fishing passed. House suite checks desktop and both phone shapes, including interiors and touch targets. Hired-villager suite passes.
- Circular edge, sound and all 30 performance spots are checked before publication; final results recorded below.

## Limits and follow-up

This merge does not claim to port every historical square-world browser script. The old borders/bosses/titans/vehicle scripts and travel-shot scripts still contain square coordinates; ring-aware map/edge/migration/den checks cover the integration instead. Physical-device testing is not available; phone checks use real Chrome touch emulation. Remaining optional polish from Claude's handoff includes the crowded Candy minimap rim labels, colour/light blending prototypes and broader historical test ports. No alternative planet order or special level-19 dragon bonus was introduced.

## Final pre-publication results

Circular edge suite passed all eight bearings and both vehicles (straight and angled contact); no square-world assumptions are used there. Music offline checks passed except the old forest-coordinate assertion; moving that fixture to the verified forest stand fixed it, and all 13 in-game sound checks pass, including 4× CPU phone scheduling and settings/reload. All 30 performance spots pass the enforced desktop/phone/landscape limits; the village measured 195 draws / 364,673 triangles on PC and 123 / 202,879 on portrait phone.
