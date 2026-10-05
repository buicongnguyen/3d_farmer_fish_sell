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

## Villager names

Small fixed-size names appear above visible villagers, including when zoomed out. Labels avoid each other, buildings' hidden residents, open panels and HUD controls; phones show up to six and desktop up to ten. The overlay adds no WebGL draws and loads separately.

Validation: layout tests and desktop/portrait/landscape browser checks at ordinary and maximum zoom out, including joystick, ACT and Home clearance.

The integrated code passed 451 unit checks (one skipped) before the final workshop/name additions; their focused checks also passed. Each GitHub Pages release runs the complete suite and production build again. Exact live JavaScript/CSS are compared with that run's published artifact, rather than comparing Windows and Linux build stamps.

The ring-shaped world redesign is outside this feedback pass.
