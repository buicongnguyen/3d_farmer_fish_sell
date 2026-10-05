# Facility interiors: plan (2026-10-06, branch `facilities`, cut from main 646c30a)

Goal: walk INTO the five Town Square buildings (School, Clinic, Police Station, Willow & Co., Supermarket), the way you walk into a family house today, and do the same things as now, but physically placed inside.

## 1. How things work today (read from the code)

### The house interior (the system to reuse)
- `World.enterHouse(id)` (world.mjs) stores `returnPosition` (the spot outside), sets `location='interior'`, hides `outside`, shows `inside`, calls `buildInterior()`, puts the player at `SPAWN (0, 6.4)`. `World.exit()` puts the player back at `returnPosition`. Saves record the position only while `location==='village'`, so a player is always saved OUTSIDE (a save made inside a facility wakes at its door, no migration).
- `interior.mjs buildInteriorRoom` clears `world.inside` and the interior targets/colliders/labels (`clearInterior`), builds a cached shell (floors in planks or tiles, walls and partitions with doorways, wainscot, skirting, two warm point lights), places kit pieces from `world.assets` (baked from `house.glb`, scale `K = 1.2`), merges them into three meshes (`bakeStatics`: furniture, glow, light pools; one draw each), creates targets (`world.target(type,id,label,x,z,r,inside)`) with label chips (`hotspots` -> `world.__roomHotspots`), and lets `house-life.mjs` walk the family.
- Geometry comes from `home-plan.mjs`: ONE envelope `ROOM = 19.6 x 16.8 m` (x -9.8..9.8, z -8.4..8.4, walls 3.1 m full, 0.66 m low on the camera side), `WALK = (9.2, 8.1)`, `SPAWN`, `SPOTS.exit = (0, 7.6)`, the front door is the gap (-1.05, 1.05) in the low front wall.
- `room-camera.mjs`: 40 degree perspective camera at 52 degrees, `fit()` picks a distance so BOTH side walls show on wide screens; on a portrait phone `frameRoom()` frames the occupied room and glides between rooms (`ROOMS`, `focusRoom`, `roomAt`); label chips (`world.__roomHotspots`) and the hover ring are drawn there. `minimap.mjs drawRoom` draws `ROOMS` and `WALLS` colours; `RANGE.room` is from the envelope.
- Targets inside: `exit/door`, `bedroom/sleep`, `kitchen/cook`, `fun/<x>` (a toast with `target.line`, handled by decor-view / house-life), `person/<id>` (opens the talk panel). `main.mjs interaction()` dispatches by `type`, whatever the location.
- Villagers (`villagers.mjs`): `slotOf(p, state)` gives the place key of the timetable. Adults with `WORKPLACE[p.id]` are at that building 8:20-12:00 and 13:00-16:50 ("hidden indoors": they stand hidden at the building's door spot `civicSpot`); children are at `school` 8:00-11:30 and 12:30-15:00 and in the `schoolyard` 11:30-12:30. Hired helpers (`state.hired`) work elsewhere 8:30-17:00.

### The five facilities today
- `CIVIC` (content.mjs) with footprints: School 10.6x7 at (-22,-40); Clinic 10.6x7.2 at (-6,-40); Police 10x6.8 at (10,-40); Willow & Co. 9x6.8 at (26,-40); Supermarket 15x8 at (42,-41, `shop:true`). `world.buildCivic` puts a door target at `(x, z + d/2 + 1.8)` (type `civic`, or `shop` for the supermarket).
- A civic door opens a panel: School (`panel==='civic'&&arg==='school'`: subjects, `lesson` and `answer` quiz, paid answers capped by `LESSON_CAP`), Clinic (`CIVIC_ACTS.hospital` check-up, 30 coins, restores energy), Police (`patrol`, +40 coins, 6 energy, 1 hour), Willow & Co. (`company` office shift, +75 coins, 15 energy, 3 hours). Hiring is the leader's `workers` panel (`JOBS`, `hire`, `payWorkers` each morning). Supermarket: `shop` panel `supermarket`, tab `sell` (25% premium), plus `visitSupermarket()` for the trip statistic.
- `WORKPLACE`: cora -> school; hazel, sylvie -> hospital; pearl, theo -> police; bea, leo, fern -> company; nell, oren, finn -> supermarket. Lodgers: the Brook family (Cora, Milo) live in the school, the Linden family (Sylvie, Hazel) in the clinic (`HOUSES[i].lodge`).

## 2. One reusable facility-interior system

The inside of every facility uses the SAME envelope as a house (`ROOM`, `WALK`, `SPAWN`, `SPOTS.exit`, front door gap). Decision and reasons:
- the camera, the phone fit-to-width framing, the minimap scale, the walk bounds and the door are all proven for that envelope, so they are reused unchanged and "both side walls visible" holds by construction;
- a dollhouse inside is larger than its outside everywhere in this game (houses too); the outside footprint (10 x 7 .. 15 x 8) is respected by PROPORTION, not metres: the supermarket is one long open floor, the school has two classrooms in a back row, etc.

Code (all new code is lazy, `import()`ed on first entry; nothing new in the first-load bundle except a few lines in main.mjs):
- `src/facility-plans.mjs` (pure data, no THREE): `FACILITIES[id] = {id, name, rooms, walls, palette, pieces, stations, kids, targets}` in the same shapes as `home-plan.mjs` (`ROOMS`, `WALLS`, `P()` pieces with `kit, x, z, rot, s, y, hang, glow, role`). One table per facility, validated by a node test (rooms tile the envelope without overlap, doorways exist, every target is inside `WALK`, every piece and station is inside a room, doors connect all rooms).
- `src/facility-interior.mjs`: `buildFacility(world, plan, {state, deps})`. Reuses `interior.mjs` helpers (now exported: `slab, planks, tiles, shade, mix, pool, bakeStatics, clearInterior, placePiece, boxOf, union, standSpot, fitHit, glowMaterial/vertexMaterial`), builds the shell from `plan.rooms/walls`, places pieces (house kit + facility props), makes colliders from each placed piece's real bounding box, creates targets and chips, places occupants, bakes, and records `world.__roomHotspots`.
- `src/facility-view.mjs`: `installFacilities(world, deps)` adds `world.enterFacility(id)` and wraps `world.buildInterior` and `world.exit` (so `world.mjs` is untouched): it loads `facility-props.glb` once, builds the interior on entering (the shell and every mesh are disposed when leaving, so nothing stays in memory), keeps the occupants in step with the clock, and tears down on exit. `world.facility = {id, plan, name}` marks that you are in one (`houseId` stays `null`; every `houseId === 0` check stays false).
- `room-camera.mjs` and `minimap.mjs` read the active plan's rooms/walls (`world.facility?.plan ?? house`), a few lines each; `main.mjs interaction()`: `civic`/`shop supermarket` at the village door enter the facility, the same types INSIDE open the same panels as today.
- Stage of the day: occupants are the villagers whose `slotOf()` equals the building at that moment (children at their desks in class hours, in the playground yard 11:30-12:30). They are built with `buildAvatar` + `outfitOf` (the same everyday outfits), stand or sit at stations, idle with a small sway, are talkable (`person/<id>` targets), and are rebuilt when the hour changes (a villager arrives or leaves while you are inside).

### Performance
One baked mesh for the room shell, one for furniture (props share the vertex-colour material), one glow, one light pools: about 6-8 draws plus one avatar of ~6 meshes per occupant (at most 8 people: the school). Shell and props are built at entering and disposed at leaving. `facility-props.glb` is fetched once (about 60 KB) at the first entry and is not kept after the first build except as the cached baked assets. Bundle limit 1,100,000 bytes: only a few hundred bytes land in main.mjs; the rest is lazy.

## 3. Floor plans (x right, z toward the camera; back wall z -8.4, front low wall z 8.4; door gap x -1.05..1.05; spawn (0, 6.4); exit stand (0, 7.6))

Walls: full height = outer back, left, right and partitions between back-row rooms; low = the mid wall z -2 (the cut-away) and other front-row dividers; doorways are gaps in them.

### Supermarket (outside 15 x 8)
Back row z -8.4..-2: Cold section x -9.8..-3, Fresh produce x -3..3, Back room x 3..9.8. Front row z -2..8.4: Shop floor (aisles) x -9.8..3, Checkout x 3..9.8 (no wall between). Mid wall doorways: [-8.6,-3.4], [-2.4,2.4], [3.8,5.4].
- Cold: 3 chillers along the back wall (x -8.6, -6.4, -4.2, z -7.6), 2 fridges on the left wall. Fresh: 7 produce bins in two rows (x -2.1..2.1, z -7.3 and -5.2), the game's own colours (carrot, radish, pumpkin, berry, apple...). Back room: 6 crates and 3 box stacks along the back and right wall. Shop floor: 11 shelves (rows z 0.4, 3.4, 6.2 at x -8.8..-2.8), trolleys (-3.2, 7.2), plants, welcome mat at the door. Checkout: 2 counters (x 5.6 and 8.4, z 1.8) with registers, cashiers behind at z 0.7.
- Does: the checkout (customer spot (5.6, 3.1)) opens the supermarket sell panel (`shop/supermarket`, 25% premium, the trip counter); both counters sell. Fresh bins and chillers are `fun` targets with a line about the premium prices.
- Who: Nell and Oren cashiers, Finn restocking in the back room, during their work hours.

### School (outside 10.6 x 7)
Back row: Classroom 1 x -9.8..-2.2 (blackboard, teacher's desk, 6 pupil desks), Classroom 2 x -2.2..5.4 (art and music room: easel, globe, bookshelf, 4 desks), Library corner x 5.4..9.8 (2 bookshelves, armchair, rug, lamp). Front row: Entrance hall x -9.8..4.2 (lockers, benches, trophy, notice, mat), Schoolyard x 4.2..9.8 (the playground door is the gap (3.4,5.0) in the wall at x 4.2; seesaw, sandbox, plants). Doorways: class 1 [-5.6,-4.0], class 2 [0.6,2.2], library [6.6,8.2].
- Does: the blackboard (spot (-6.0, -6.4)) starts the lesson: opens the existing school panel (`lesson` subjects, `answer` quiz). The library desk, the globe, the easel and the lockers are `fun` lines. The yard is where the children play at 11:30.
- Who: Cora teaches at the blackboard; the children (Pip, Kit, Wren, Faye, Milo) sit at the desks in class hours, play in the yard at midday.

### Clinic (outside 10.6 x 7.2)
Back row: Exam room 1 x -9.8..-3.4, Exam room 2 x -3.4..3.0, Pharmacy x 3.0..9.8. Front row: Waiting room x -9.8..4.0, Reception x 4.0..9.8 (low divider, gap z 2..5). Doorways: exam1 [-7.4,-5.6], exam2 [-1.0,0.8], pharmacy [5.6,7.4].
- Exam rooms: hospital bed, privacy screen, sink, IV stand. Pharmacy: 2 medicine cabinets, fridge, counter. Waiting: 3 benches, plants, magazines table, clock. Reception: counter with register.
- Does: lying at either exam bed (the bed targets) opens the clinic panel (check-up, 30 coins, energy restored); the reception and pharmacy are `fun` lines.
- Who: Hazel the nurse beside bed 1, Sylvie at the pharmacy counter, during work hours.

### Police Station (outside 10 x 6.8)
Back row: Cell 1 x -9.8..-5.4, Cell 2 x -5.4..-1.0 (barred fronts, bunk, sink; looked into, not entered), Evidence room x -1.0..3.4 (doorway [0.2,2.0]: shelves with bags and boxes, crates), Office x 3.4..9.8 (doorway [5.2,7.0]: 2 desks, filing cabinets, notice board, radio). Front row: Front lobby x -9.8..9.8 with the front desk counter at (-5.5, 1.4), benches, plants.
- Does: the front desk (spot (-5.5, 2.6)) opens the patrol panel (`police`: +40 coins). The notice board ("lost goat") and cells are `fun` lines.
- Who: Pearl at the office desk, Theo at the front desk.

### Willow & Co. (outside 9 x 6.8)
Back row: Boss office x -9.8..-4.4 (leader's desk, bookshelf, trophy), Meeting room x -4.4..2.6 (long table, 6 chairs, board), Break room x 2.6..9.8 (counter and coffee machine, fridge, water cooler, sofa, table). Front row: Open office (x -9.8..9.8) with 7 desks and the hiring board hung on the left wall at (-9.66, 3.0). Doorways: boss [-8.0,-6.2], meeting [-2.0,-0.4], break [5.0,6.8].
- Does: the hiring board (spot (-8.4, 3.0)) opens the leader's `workers` panel (hire, wages); a free desk (spot (6.2, 5.5)) opens the office shift panel (`company`). Boss desk and break room are `fun` lines.
- Who: Bea, Leo, Fern work at open-office desks (they leave at lunch like everyone's timetable says).

## 4. Props (all in ONE `public/assets/models/facility-props.glb`, generator `art/blender/build_facility_props.py`)
Reused from the house kit (already loaded, zero cost): desk, counter, chair, stool, bookshelf, armchair, sofa, coffee_table, round_table, dining_table, plant_big/small, floor_lamp, lamp_small, wardrobe (lockers), fridge, sink, bed, globe, easel, trophy, picture, painting, window, radio, books, kettle, welcome_mat, rug_rect/round, workbench.

New (Blender, Willowmere toon style, flat colours, bevelled boxes), rough triangle budget:
| prop | tris | prop | tris |
|---|---|---|---|
| fp_shelf (supermarket gondola with produce) | 900 | fp_hospitalbed | 400 |
| fp_bin (produce bin, 3 colour mounds) | 500 | fp_curtain (privacy screen) | 120 |
| fp_chiller (open cold case) | 450 | fp_medcabinet | 500 |
| fp_register | 150 | fp_waitbench | 150 |
| fp_cart (trolley) | 300 | fp_ivstand | 150 |
| fp_crate | 120 | fp_cellbars | 500 |
| fp_boxes (stack) | 200 | fp_cellbed (bunk) | 200 |
| fp_blackboard | 150 | fp_evidenceshelf | 450 |
| fp_schooldesk (desk + chair) | 250 | fp_noticeboard | 150 |
| fp_seesaw | 150 | fp_filecabinet | 150 |
| fp_sandbox | 120 | fp_officedesk (desk + monitor) | 350 |
| fp_meetingtable | 200 | fp_hiringboard | 300 |
| fp_watercooler | 200 | fp_coffee (machine) | 150 |
| fp_clock | 100 | fp_locker (unused if wardrobe fits) | 150 |
About 7.5k triangles in total; each room instances only what it needs (a room is 1.5k-4k triangles). Estimated file size 100-150 KB, fetched only on the first entry.

### Art sourcing and licences
(a) reuse: house kit and Zoo Garden's style module; (b) create: all props above are Blender-made originals (no import); (c) internet: nothing is downloaded. If a CC0 asset is ever added it must be Poly Haven / Poly Pizza CC0 / Kenney CC0 and recorded in `docs/ASSETS.md` with URL and licence per file; unclear licence means not used. Current record: original work, no third-party files.

## 5. Doors and camera
- Enter: walk to the building's existing door spot `(x, z + d/2 + 1.8)` and press E or tap (type `civic` / `shop`): `enterFacility(id)`; `returnPosition` is that spot, `exit()` puts you back on it.
- Leave: the `exit/door` target at (0, 7.6) as in a house; the Map's "go to" sends you out first (`goFind` already exits).
- Camera and minimap: exactly the house's, driven by the plan's rooms/walls.

## 6. Test plan (light) and risks
- `npm test` (existing) + one node test `tests/facility-plans.test.mjs` (plan validity) + one small `tests/facilities-browser.mjs`: for each facility at 1440x900 and 390x844 enter, check `location==='interior'`, the camera frame shows both side walls, targets exist, the action opens the right panel, exit, screenshot into `cute_game-notes/willowmere/evidence-facilities/`; then the main browser suite and `house-browser` once at the end. Port 4601 only.
- Risks: (1) `main.mjs` size: only a few lines added (bundle was 2.3 KB under); (2) tests that pin "civic door opens a panel" may need updating; (3) the portrait phone room framing assumes the house's room sizes: rooms here follow the same limits (>= 4.4 m wide; `frameRoom` clamps spans); (4) occupants share avatar costs: capped at 8; (5) shells are rebuilt each entry (about 20-40 ms); (6) Pandora/decor hooks never run inside a facility (`houseId` null, hooks not registered there).

## 7. Addendum: Hearth Bakery, Moss Barn, Vale Workshop Barn (added on request; same system, same 19.6 x 16.8 envelope)
Priority order for the whole job: Supermarket, Bakery, Moss Barn, School, Clinic, Police, Willow & Co., Vale barn. These three are family lodgings or workshops with no door today, so each gets a new village door target (type `facility`, `use` enters it; registered at boot in main.mjs) and `returnPosition` is where you stood. People are the family: they are inside when their timetable slot is `home` (`plan.family`: one spot before noon, one after).
- **Hearth Bakery** (HOUSES[6], the barn by the green, door (27, 24.7)): back row Bakehouse x -9.8..-1.4 (brick oven, work table, trays, flour sacks), Pantry x -1.4..3.6 (sacks, crates, fridge), Family corner x 3.6..9.8 (bed, sofa, table). Shop floor in front: 3 bread shelves, a glass cake case with register, a bread table. Does: the oven opens the existing Country Kitchen panel (cook soup, fish supper, orchard pie); the cake case and bread are `fun` lines (the bakery has no buy action today: Hugo sells bread at the market stall in work hours, so he is at the oven before 8:30 and by the sofa in the evening; Nell at the counter early). Props: fp_oven, fp_breadshelf, fp_cakecase, fp_sacks, fp_trays, fp_breadbasket (about 2,000 triangles).
- **Moss Barn** (HOUSES[3], door (28.4, -14.6) at the barn by the pen): back row Stable x -9.8..-1 (two stalls with mangers, hay bales, milk pail), Feed and tools x -1..4.2 (feed sacks, workbench, tool rack), Family beds x 4.2..9.8 (three beds). Front: Barn floor x -9.8..3 (hay, feeding trough, crates) and Kitchen corner x 3..9.8 (table, stove, fridge, sofa). Does: the feed sacks run the pen's Feed action and the milking stall the Collect action (the same `feed`/`collect` actions as the pen outside); the rest are `fun` lines. Mara, Oren and Wren are inside when home. Props: fp_hay, fp_stall, fp_toolrack, fp_trough, fp_pail (reusing fp_sacks, fp_crate).
- **Vale Workshop Barn** (the barn at (-41, 29), door (-36.2, 29), lowest priority): back row Lumber store, Tool bay (bench, anvil, tool rack), Parts store; front Workshop with a counter. Does: the counter opens the Vale workshop panel (`shop upgrades`) as the well stall still does; Ash stands at the bench when home. Props: fp_lumber, fp_anvil.
The props file is now 40 props, about 14,700 triangles, 555 KB (fetched once, on the first visit to any building).
