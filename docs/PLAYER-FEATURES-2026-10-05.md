# Player feedback follow-up — 2026-10-05

Each completed feature is committed and published separately, as requested. The earlier Claude handoff review is in `REVIEW-2026-10-05.md`.

## Fishing catches and line tension

- Catches leap onto dry grass beside the angler and stay there through menus, recasts and reloads. Walking over 2.5 m from the fishing position packs the whole catch once. Leaving the village or mounting also packs it. Species discovery and catch statistics update immediately.
- Saves retain every catch; drawing is capped at 24 fish to keep large piles inexpensive. Invalid or relocated saved anchors recover their fish into the bag.
- Reel's clockwise border fills with actual tension: green below half, amber from half, red from 80%; words warn to release near breaking. Idle and recast clear the meter.
- Seven drifting deep-fish silhouettes enrich the family pond. Outdoor ponds retain all six moving silhouettes even when phone quality draws only three full models.
- Existing read-only diagnostics moved into the existing lazy test module to preserve the initial bundle limit.

Validation: 46 focused unit checks; production build 1,098,910 initial bytes against the unchanged 1,100,000 limit. Real desktop and phone catches, all tension colours, pending inventory, dry-ground placement, cancellation, reload, movement and no duplicate rewards passed. Outdoor desktop and phone silhouettes passed. Screenshots and browser logs are in ignored `test-results/fishing-bank/`.

## Garden-bed watering visibility

Watering no longer restarts the plant's shrink animation. Previously it reduced a small sprout to 35% size for the first animation frame; on a phone this could look like it disappeared. Later growth also starts at the previous visible height. The planted crop, watering cost and growth time are preserved.

Validation: 10 crop geometry/visibility checks and the unchanged production bundle limit pass. Real phone taps in portrait and landscape retained both the watered carrot and its neighbouring radish; 52 sampled frames per view kept the watered plant at full scale, with no harvest or accidental neighbour action. Screenshots are in ignored `test-results/watering-phone/`.

## In progress

- Phone room framing, especially kitchen visibility.
- Hired-worker attendance, market crowd blocking, and distant villager names.
- Reference animal produce models and Vale workshop service relocation.

The ring-shaped world redesign is outside this feedback pass.
