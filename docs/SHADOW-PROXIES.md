# Shadow proxies: a cheaper shadow pass everywhere

Branch `recs-shadow` (from origin/main 95645ff). Code: `src/shadow-proxy.mjs` (its own chunk, fetched while the models load).
Probes, before/after screenshots and logs: `cute_game-notes/willowmere/shadow-probes/` and `evidence-shadow/` (not in the repo).

## Why
On PC "high" the village centre drew 365k triangles a frame against the 400k line, and 148k of them (40%) were the shadow pass:
the baked village cells (about 49k), tree crowns (village trees and field tiles, about 54k at 554 triangles a tree), the
villagers' heads and bodies (about 36k: 1,200 to 2,100 triangles each) and a few big still meshes (the home, 7k; a Town Square
building, 10k), all drawn a second time into a 2048 map whose texel is 4 to 5 cm.

## How it works
- A **proxy** is a child of the mesh it stands for, on **layer 1 only**, with `castShadow` on; the real mesh casts nothing.
  The main camera sees layer 0, so a proxy is never drawn in the main pass (no new main draws, no new programs: instanced
  proxies use `depthFor`'s instanced depth material, plain ones three's own). three's `WebGLShadowMap` tests casters against
  the *main* camera's layers, so `install()` wraps `renderer.shadowMap.render` to add layer 1 for the shadow pass only.
- Being a child, a proxy hides with its mesh (cullView's cells and tiles, a villager indoors, a creature out of range) and
  follows its pose. An instanced proxy shares the real mesh's `instanceMatrix`, and reads its `count` and bounding sphere
  through getters, so a grove that fells a tree or a tile refill needs nothing extra, and the shadow camera culls both alike.
- Where code switches a shadow on or off it now writes `(m.userData.proxy ?? m).castShadow` (world cullView, fields fill /
  cullView / metrics, villager-shadows, wilds-draw, render-probe's creature report). `userData.proxy` is not enumerable, so
  `Object3D.clone()` never serialises it.
- Nothing runs per frame except the layer mask in the wrapper; no allocation.

Two shapes:
- **Ring hull** (`hull`): 12-sided rings at up to 7 heights. At 17 heights the cross-section is read (edge crossings plus the
  vertices within half a step), each ring stands round the middle of its cross-section and reaches its extent in each
  direction; the rings kept are the two ends and then the height the kept rings miss by most, until they miss by under 3% of
  the size. 120 to 168 triangles. Used for instanced pieces of 100+ triangles with a roundish footprint (trees, bushes, rocks),
  villagers' heads and bodies, and creature bodies.
- **Cluster** (`cluster`): connected parts are read apart (joined where they share a corner); a part under 0.3 m casts nothing;
  each other part's vertices merge on a grid of a quarter of its middle side (2 cm to 40 cm) at the mean of what they stand
  for, and collapsed or repeated triangles go. A wall keeps its corners and a lamp post its thickness. Used for the baked
  village cells, other big still meshes (the home, the Town Square buildings: `statics`, 1,000+ triangles) and as the fallback
  where the hull cannot follow (frogs, chompers, wolves).
- **Silhouette check** (`fits`): every proxy is drawn flat as the sun sees it next to the real mesh, on a 40-cell grid (96 for
  a cell, 64 for a still mesh), from the sun's bearing (cells, which are baked in world space) or four bearings (anything that
  turns). It is refused when it darkens more than 20% extra, or leaves out more than 15%, of the real shadow. That keeps the
  palms (fronds: a hull would cast a solid disc, +110%) and one bushy swamp tree (+35%) on their own shadow, and 10 of 32
  village cells whose merge would change too much.
- Villagers' heads and bodies get their proxies ahead of need, one a frame (`warmVillagerProxy`, 2 to 5 ms each, once per
  outfit), so a villager walking into shadow range casts through a proxy from its first shadowed frame.

The governor is untouched: step 2 still halves the map, step 3 still turns the shadow pass off.

## Numbers (PC "high" 1440x900, midday, the budget suite's spots; real draws and triangles per pass, median of 5 frames)

| Spot | Main pass before | Shadow before | Total before | Main after | Shadow after | Total after |
|---|---|---|---|---|---|---|
| village (8,18) | 141 / 216.9k | 56 / 147.8k | 195 / 364.7k | 141 / 216.9k | 56 / 57.2k | 195 / 274.1k |
| village, box open | 142 / 216.9k | 56 / 147.8k | 196 / 364.7k | 142 / 216.9k | 56 / 57.2k | 196 / 274.1k |
| homestead (0,-8) | 108 / 199.1k | 48 / 135.8k | 167 / 344.5k | 107 / 198.1k | 48 / 66.9k | 166 / 272.1k |
| swamp stand, box open | 61 / 144.1k | 26 / 94.9k | 85 / 239.0k | 61 / 144.1k | 26 / 58.4k | 85 / 202.5k |
| croc den, box open | 65 / 122.6k | 24 / 78.1k | 80 / 197.9k | 65 / 122.6k | 24 / 52.9k | 81 / 172.8k |
| planet-to-planet line, box open | 57 / 55.2k | 30 / 28.6k | 83 / 82.9k | 57 / 55.2k | 30 / 17.4k | 83 / 71.7k |
| three-region junction, box open | 48 / 50.3k | 19 / 27.1k | 62 / 75.9k | 48 / 50.3k | 19 / 13.0k | 62 / 61.8k |
| canyon stand, box open | 64 / 57.8k | 29 / 53.1k | 93 / 112.1k | 64 / 57.7k | 29 / 37.0k | 93 / 96.0k |
| village border (54,0) | 66 / 157.4k | 31 / 104.4k | 95 / 261.8k | 66 / 157.4k | 31 / 51.6k | 95 to 98 / 210.6k |
| jeep in the west village, box open | 114 / 193.7k | 39 / 111.3k | 149 / 302.9k | 114 / 193.7k | 39 / 71.5k | 151 / 265.2k |

Totals are the game's own `willowmere.calls()` (both passes); a total can differ from main + shadow by a draw or two (the
minimap, a bird). Shadow draws are the same at every spot; shadow triangles fell 36% to 61%, the frame 10% to 25%.
The phone and landscape lines ("battery") have no shadow pass and did not change: budget suite after, phone 37k to 203k,
landscape 56k to 234k (homestead), all under 250k. "Balanced" phones (1024 map) get the same proxies.

What is left in the village's shadow pass (57k): cell proxies 22.6k, tree proxies 19.1k, the pen animals (skinned) 6.1k, the
player (full avatar) 4.1k, villager proxies 3.1k.

Cost: proxies are made once. At boot about 90 ms for the village cells and still meshes (PC); a hull or a cluster for an
instanced kind takes under 1 ms the first time its geometry is seen (cached per geometry), a villager's part 2 to 5 ms.
Bundle: the first load grew 902 bytes (46,436 to spare); the chunk is about 6 KB.

## What looks different (screenshots, 1440x900 and 390x844 "balanced", village at 7:00, 12:00 and 19:30, homestead,
fields, Mushroom Forest, the east border, Chomper Swamp; `evidence-shadow/sheets`)
- Round trees: the crown's shadow is a rounded 12-sided blob where it was lumpy, and the small gaps between the crown's lobes
  are filled. Same size and place; it stays attached at the trunk. Pines lose the toothed edge of their tiers.
- Villagers: the head and body read as a capsule; same size and place.
- Buildings, stalls, fences, the home: no difference seen at the game camera (zoomed crops of the bakery and the home match).
- Palms and the sparse swamp tree keep their own shadow (refused by the silhouette check).
- No popping or flicker: proxies never switch per frame, villagers keep their distance hysteresis, and an instanced proxy
  shares its real mesh's matrices, count and culling.

## Tests (dist served on 4721, GPU)
npm test 508 pass; build ok (1,053,564 bytes first load); budget-browser 30 spots inside the lines (landscape is now tied to
the phone's 250k line through one `PHONE_LINE` constant: it was already asserted at 250k); render-browser all passed;
browser exit 0, no errors.

## Open
- Palms (406 triangles) and the bushy swamp tree (496) still cast in full: 26k to 33k shadow triangles at the swamp stand and
  the croc den. A frond-aware proxy (a thin card per frond) would be the next step.
- The pen animals (6k, skinned and instanced) and the player keep full shadows; the Vale workshop (3.4k, workshop-view.mjs)
  is placed after the proxy pass in init and has none (one `world.proxy.statics(mesh)` call there would give it one).
- Proxies are also built on "battery", where no shadow is drawn (about 90 ms at boot on a PC, more on a phone); they could be
  deferred until shadows are first wanted, at the price of one shape change when they arrive.
- Riding through the village (drive-budget's highest sample) was not re-measured; the shadow pass there is the same mix, so
  it should fall by a similar 70k to 90k triangles.
