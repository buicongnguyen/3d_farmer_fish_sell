# Player feedback follow-up — 2026-10-05

Each completed feature is committed and published separately, as requested. The earlier Claude handoff review is in `REVIEW-2026-10-05.md`.

## Fishing catches and line tension

- Catches leap onto dry grass beside the angler and stay there through menus, recasts and reloads. Walking over 2.5 m from the fishing position packs the whole catch once. Leaving the village or mounting also packs it. Species discovery and catch statistics update immediately.
- Saves retain every catch; drawing is capped at 24 fish to keep large piles inexpensive. Invalid or relocated saved anchors recover their fish into the bag.
- Reel's clockwise border fills with actual tension: green below half, amber from half, red from 80%; words warn to release near breaking. Idle and recast clear the meter.
- Up to seven drifting deep-fish silhouettes enrich the family pond, staying clear of visible coloured fish. Outdoor ponds show one representation per fish: six coloured models on high quality, or three models plus three hints on phone/battery quality.
- Existing read-only diagnostics moved into the existing lazy test module to preserve the initial bundle limit.

Validation: 46 focused unit checks; production build 1,098,910 initial bytes against the unchanged 1,100,000 limit. Real desktop and phone catches, all tension colours, pending inventory, dry-ground placement, cancellation, reload, movement and no duplicate rewards passed. Outdoor desktop and phone silhouettes passed. Screenshots and browser logs are in ignored `test-results/fishing-bank/`.

Final review also fixed save import packing fish using the previous world's position, and repeated visual slots after eight catches of one species. Import/reload/departure and 1–24 distinct pile slots now have regression coverage. Extra catches beyond the visual cap remain saved.

Player follow-up: removed the silhouettes previously drawn over coloured fish. Family-pond swimmers only need a hint when their model is unavailable; independent deep hints clear a visible fish's footprint. Outdoor quality changes swap omitted bodies for hints and clear those hints when detailed bodies return. Night Land still lights the whole school. Seventeen focused rendering/placement tests, the production build, and desktop/phone browser checks passed; the outdoor checks measured six bodies with zero hints on desktop and three bodies with three hints on phone.

## Garden-bed watering visibility

Watering no longer restarts the plant's shrink animation. Previously it reduced a small sprout to 35% size for the first animation frame; on a phone this could look like it disappeared. Later growth also starts at the previous visible height. The planted crop, watering cost and growth time are preserved.

Validation: 10 crop geometry/visibility checks and the unchanged production bundle limit pass. Real phone taps in portrait and landscape retained both the watered carrot and its neighbouring radish; 52 sampled frames per view kept the watered plant at full scale, with no harvest or accidental neighbour action. Screenshots are in ignored `test-results/watering-phone/`.

## Phone rooms

Phones smoothly frame the occupied kitchen, bedroom or other small room. Doorway thresholds avoid camera jitter; the larger living room follows movement. Mirror and wardrobe framing retains priority; desktop retains the whole-house view. Indoor camera code loads after the first village render, before Begin is enabled.

Validation: nine framing/hook checks and cold-start browser checks on desktop, portrait and landscape. Walked through doors, tapped the kitchen, checked wardrobe clearance and restored room labels. Existing phone rules hide the indoor minimap, leaving the full map available from its menu.

## Hired workers and market crowd

New assignments interrupt leisure strolls and send workers to separate positions at their jobs, with work gestures. An active bike ride ends safely before redirecting. Release, morning wages and ordinary routines remain consistent. Market waiting positions are spaced away from the shared lane so arrivals and departures can pass.

Validation: every role with a full group of helpers, crowded market movement, wages/save checks and desktop/phone browser attendance. The phone midday group of five was reproduced: four shoppers moved on within 35 seconds, while Hugo stayed at his workplace.

## Animal produce and Vale workshop

Actual Blender eggs, duck eggs, milk and truffles from `cute_game` hover over animals when produce is ready, and clear on collection. The highest pen tier now includes the pig's daily truffle. Egg/milk rewards remain unchanged. Models hide indoors and far from the pen.

Vale's workshop service and reference workshop awning/bench now sit left of the well at (-11.2, -9.6), reached from Field Lane. The old workshop counter is removed; the Vale farmhouse and barn remain in their original lot. All 173 existing tree positions and saved indices are unchanged. Asset provenance and hashes are in `ASSETS.md` and `asset-manifest.json`.

Validation: product readiness, reload and collection on desktop/phone; workshop geometry, paths, map footprint and actual purchases on desktop/phone. Ready models render in four draws, with no extra shadow passes.

Workshop interaction follow-up: the previous test started at the counter and used the keyboard, missing that taps on the visible bench and awning did not reach the counter's separate hitbox. The imported model now activates that same counter, following `cute_game`'s tap-the-workshop, walk-into-reach interaction. A gold ground ring shows where to stand and remains usable if the model download fails. Taps on empty Field Lane still walk normally. The existing improvements menu and its prices remain unchanged.

## Villager names

Small fixed-size names appear above visible villagers, including when zoomed out. Labels avoid each other, buildings' hidden residents, open panels and HUD controls; phones show up to six and desktop up to ten. The overlay adds no WebGL draws and loads separately.

Validation: layout tests and desktop/portrait/landscape browser checks at ordinary and maximum zoom out, including joystick, ACT and Home clearance.

Walking-label follow-up: names now follow a fixed ground-relative height rather than the avatar's footstep bounce; riders retain their seated height. Fractional screen positions remove whole-pixel jumps, and a small preference for already-visible names prevents nearby walkers from repeatedly swapping labels. Current-frame HUD and name-overlap checks still apply. Five layout tests and the three-view browser suite passed. Measured walking jitter fell from roughly 1 pixel horizontally and up to 2.39 pixels vertically to at most 0.011 pixels on desktop and phone.

The integrated code passed 451 unit checks (one skipped) before the final workshop/name additions; their focused checks also passed. Each GitHub Pages release runs the complete suite and production build again. Exact live JavaScript/CSS are compared with that run's published artifact, rather than comparing Windows and Linux build stamps.

The ring-shaped world redesign is outside this feedback pass.

Validation: three focused workshop tests and desktop/phone browser checks passed, including visible-model tap-to-approach, a successful improvement purchase, empty-lane walking, and phone joystick-to-ACT interaction. Production build passed with the first-frame byte budget unchanged.

### Vale crafting and improvements

The workshop now keeps Improvements and Furniture and adds a Crafting tab. Its 14 recipes reuse the reference game's existing equipment and companion assets: lava boots, obsidian sword, dragon wings, toy hammer, leaf outfit, trident, cloud outfit, lantern hat, robot, parrot, turtle, sheep, firefly and dragon companions. Category buttons, gear pictures and stats, material counts, missing ingredients, coin fees and owned badges follow the reference's crafting flow.

Recipes use Willowmere's obtainable materials. The reference's extra regional catalysts map to this game's existing drops (documented beside the recipes in `src/crafting.mjs`); fees use coins rather than this game's limited stamina. Materials at their best sale value plus the fee cost about 15–17% less than buying the same gear. Crafted gear is unique, cannot be sold as basket stock, enters the saved wardrobe and is equipped there. Existing ownership prevents charging or consuming ingredients again. All requirements are checked before payment.

The recipe book loads only when opened. A failed download offers a saved reload, since browsers may cache a failed module request. Loading cannot reopen a closed panel or replace another shop tab. No new save format, models, drops or weapon-forging system is introduced.

Validation: crafting rules, rendering, action dispatch and gear checks passed (26 tests). Browser checks passed on desktop, 390px portrait phone and 844px landscape phone: category filters, shortages, one-time crafting, unchanged Improvements, reload persistence, a walk home and equipping in the wardrobe. Recipe cards fit all three panels without horizontal overflow. Production build remains below the first-frame byte limit.

Phone connection checks also passed: a failed recipe download offers Reload game and preserves coins, materials and wardrobe; a delayed download cannot reopen the shop or replace Improvements. Final local build: 1,095,172 bytes before the first frame (limit 1,100,000).

### Fishing outside the village

The outdoor fish schools previously had no fishing interaction: water picking, rod prompts, cast geometry and catch selection only recognized the family pond. All existing outdoor ponds now share one pond catalog with their visible fish pools. Water taps approach the correct circular shore; E/ACT equips and casts locally; Reel and Cast again stay at that pond. The float uses the outdoor water height. The village dock shortcut still leads to the family pond.

Catches use the local species pool, including proper inventory entries for ice pike and anglerfish. They rest on dry grass beside the player, survive saving/reloading, and pack into the bag exactly once on departure. Outside catches reuse the existing instanced fish models; grass positions are cached until catches change.

Validation includes every outside pond's shore/cast geometry and every regional species through catch, save and collection, plus existing fishing and bank-catch regressions. Desktop and phone browser coverage checks water-tap approach, reeling, catches on grass, Cast again, reload, E/ACT and departure. The family pond is included as a compatibility check. Build stays below the first-frame size cap.

### Villagers giving way at crowded junctions

Five walkers could surround a shared lane waypoint indefinitely: the previous steering tried only forward and sideways moves, so nobody could retreat to let another through. Walkers now detect a lack of progress and stagger short, committed give-way moves before resuming their original route. Recovery preserves normal walking speed, scenery collision and personal space; changing an assignment cancels the previous detour. Greetings no longer pause people who are walking. A nearby villager may say “After you! I’ll make some room.” while yielding, without stopping the road traffic.

Regression simulations cover five and eight converging walkers at 20, 30 and 60 updates per second, in both update orders. All reach their original destinations within 30 seconds without overlapping or teleporting; the old algorithm leaves the five-person group blocked after 60 seconds. Wall/player clearance and route reassignment are also covered, alongside existing market, hired-worker, pedestrian and bike checks. A phone browser check watches midday shoppers for 150 seconds and rejects any continuous 30-second walking window with no meaningful movement.

### Catch celebrations

Successful catches now give the player an overhead reaction, followed by one nearby villager's cheer when someone can see the catch. Sixty shuffled lines cover ordinary catches, valuable fish, adults and children; each pool is exhausted before repeating, with no immediate repeat across shuffle boundaries. Fish-specific lines use the caught species. The player also reacts at outside ponds.

An onlooker on clear ground turns toward the catch, pauses for 2.3 seconds and waves, then resumes the existing route. Workers, people on roads/paths and crowded walkers cheer without pausing; riders and indoor or distant residents are excluded. Spectators have a cooldown. Moving away, entering a building or recasting cancels a pending reply. Dialogue loads on the first successful catch and speech wraps to fit phones.

Validation covers line variety, spectator selection/cooldown, bounded pause, preserved routes, road/crowd/worker safety and cancellation. Browser checks catch two fish on desktop outside the village and on a portrait phone at the family pond, including a nearby fisher's response. Production build remains under the first-frame limit.

### Shops on the right

The reference's right-side shop placement previously applied only above 1,000 pixels with a mouse. All four shops now stay on the right on smaller windows and touch devices too: village market, Finch atelier and equipment, Vale workshop and crafting, and supermarket. The world remains visible behind a transparent backdrop. Portrait phones get a wide drawer with a narrow strip of world on the left; landscape phones and tablets use at most 52% of the screen, and large desktops retain the reference's 46% limit. Tabs wrap, the body scrolls, and the close button stays visible inside safe screen edges. Opening, purchasing, trying on gear, changing tabs, resizing and closing keep the placement consistent. Other phone menus retain their existing layouts.

Validation: 33 shop/tab checks passed across desktop, portrait phone and landscape phone, including purchases, equipment try-on, crafting, furniture, resizing an open shop through 850 and 1,100 pixels, no horizontal overflow and centered sleep dialogs after closing. Production build remains below the first-frame limit.

### Three save profiles

The welcome screen and Settings now offer three independent offline profiles. Profile 1 keeps the original save key, preserving existing progress without copying or replacing it. Profiles 2 and 3 start fresh. Profile buttons show each story's day, coins and album progress. Switching saves the current story before reloading; writes remain pinned to the old tab's profile, so unload handlers or another tab cannot overwrite the selected story. A failed save or profile-selection write cancels the switch. Imports replace only the current profile and exported filenames identify the profile.

Validation: legacy save preservation, all three slots, invalid selection, unavailable storage and autosaving an old tab passed alongside save/game regressions. Desktop, portrait-phone and landscape-phone browser checks switched through all three profiles, bought seeds in Profile 2, exported/imported that profile, reloaded and confirmed Profiles 1 and 3 stayed unchanged. The landscape welcome layout keeps selection and Begin visible. Profile UI loads separately from the first frame.
