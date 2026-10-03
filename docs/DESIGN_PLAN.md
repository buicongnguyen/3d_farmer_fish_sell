# Willowmere · A Family’s Seasons

## Vision and experience

A gentle, single-player, 3D village RPG about turning an inherited patch of land into a home worth passing on. The player is Rowan, returning with partner June and daughter Pip to grandmother Ada’s village. Growth means a better kitchen, a child’s new coat, a restored pond and neighbours who remember what you did. Money is earned through farming, fishing, animal care, gathering, small commissions and festivals. There is no real-money shop.

The first release is a complete, replayable opening campaign with eight family-album chapters. It establishes the systems needed for a longer family saga. A calendar continues through four seven-day seasons and repeating years. Full generational inheritance, marriage simulation and branching adult careers are a later expansion, not a promise hidden behind an unfinished button.

## Reference audit and art direction

* `cute_game`: reuse its original GLB crop, scenery, fish, animal, tall human character and furniture kits, and their rendered item icons. Use the existing tall body with a narrower silhouette and smaller head accent, readable arms and legs, warm clothing and walking animation. Keep all source reference projects unchanged.
* `3D_game_scene`: use its principles of pitched roofs, chimneys, gardens, household identity and enterable furnished rooms. Build simpler original houses here: one exterior shell with different roof colours, porches and garden accents; one interior loaded/viewed at a time.
* `rambo/_3D`: reuse the motorcycle and jeep models. Remove the jeep weapon assembly. The Bell family owns the jeep; the player earns its use by delivering farm goods. Vehicles accelerate, carry the player and reach a country-road market beyond the village.
* Picture-book palette: sage grass, butter-yellow paths, terracotta roofs, turquoise water, pink blossom, cream paper UI, dark forest-green ink. Soft directional shadows, orthographic camera, visible fish, floating fireflies at dusk. No external font or image services at runtime.

## Village: ten households, twenty-four residents

| Home | Residents | Work and story role |
|---|---|---|
| 1. Rowan’s home | Rowan (player), June, Pip | Returning family, first garden and family album |
| 2. Ada’s cottage | Ada, Ellis | Grandmother’s seed tin and grandfather’s fishing journal |
| 3. Bell garage | Theo, Bea, Kit | Jeep family, repair trade, route to the outside market |
| 4. Moss farm | Mara, Oren, Wren | Animal care, community seed exchange |
| 5. Reed boathouse | Finn, Pearl | Pond restoration and fish knowledge |
| 6. Finch atelier | Iris, Leo, Faye | Adult outfits and children’s clothing |
| 7. Hearth bakery | Hugo, Nell | Cooking, seasonal food and harvest supper |
| 8. Vale workshop | Ash, Fern | Furniture and house improvements |
| 9. Brook schoolhouse | Cora, Milo | Village history, running race and children’s games |
| 10. Linden lodge | Sylvie, Hazel | Orchard trees, village nurse, gathering and optional early hunting |

NPCs follow simple morning/work/evening routines, have household-linked dialogue and one friendship increase per day. The residents panel identifies every villager, home and current friendship. Children use shorter bodies. Adults use the requested slim human proportions.

## Open fields and finding home

Beyond the village footprint, the landscape is open grassland with sparse round trees and pines. There are no additional buildings, roads, collectibles or encounter gates in these fields (wild creatures live there only while the Pandora box is open, see below). Walking and driving continue in all directions up to a numerical world limit of 32,768 metres per axis. A 5×5 window of 64-metre terrain sections follows the player; outgoing instance buffers and terrain geometry are released, and deterministic placement preserves returning scenery. Grass uses three crossed triangles per tuft. Fourteen pooled hawks and gulls circle nearby with independent wing beats and glides.

A screen-relative arrow points toward the homestead, with metre/kilometre distance and a walk-home button. It appears outside the village, the minimap zooms out to retain the player and village, and saved coordinates support distant locations. Buildings retain collision and routes use a small visibility graph, so walking home does not search a vast terrain grid. The separate country market remains an optional interaction at the east-road sign.

## The Pandora box (optional wilds)

A little chest stands in the Rowan living room. Its panel has one switch: **Close** or **Open**. Shut (the default, and every old save), Willowmere is exactly the peaceful game described here: no creatures anywhere, clothes and gear are only for looks, no health bar. Open, the fields beyond the village become the wilds of the reference game (`cute_game` home planet): creatures you can fight for coins and loot, and worn gear counts.

* **Safe village.** The village footprint plus 8 m is a ward (|x| < 74, |z| < 72), drawn as a soft violet ribbon while the box is open. No creature spawns, walks or is knocked inside it, and a player inside is no target: a chase ends at the line, the creature walks home and heals. Villagers keep to the village as before.
* **Rings.** Seeded per 32 m cell, a 5 × 5 window follows the player. *Near meadows* (6–70 m beyond the ward, level 1): Grumpy Mushroom, Cross Wasp, Wild Boar. *Far thickets* (70–170 m, level 4): Poison Frog, Grey Wolf, Snapping Flower. *The wild edge* (170 m and beyond, level 7): Prickly Cactus, Stone Crab, Grey Wolf. The **King Bear** (800 health, a slam every third attack) has one den far to the north-east. Facts (health, damage, speed, reach, sight, wind-up, cooldown) are the reference's.
* **Fighting.** Tap a creature to target it and walk in; the basic attack follows the weapon kind (fists 1 m, sword sweep, gun shots) and its cooldown. Skills: Whirlwind, Dash and Ground slam on **1 / 2 / 3** (W walks and E interacts here, so the reference's Q/W/E moved), **F** swings, **E / ACT** attacks when a creature is in reach. Damage taken is `amount × 60 / (defence + 60)`; crits double a blow. Creatures wander, notice, wind up (a pose, and a danger disc for the Snapping Flower and the King Bear's slam), strike, and leash home.
* **Rewards.** No XP in Willowmere: a creature pays coins at once (half the reference's XP: 4 for a mushroom, 150 for the King Bear) and may toss loot on the ground, pulled in by a short magnet: wild mushrooms, woodland game, flowers and seed packets, plus soft hide, wild honey, boar tusk, crab claw, sweet nectar, cactus spines and the King Bear's crown, all sold at the market.
* **Health.** 100 plus gear. Your home heals 16 a second, the village 4, gear regen everywhere; energy foods restore health too. A knock-out is gentle: you wake at home an hour later, rested, 5 % of your coins lighter (30 at most; nothing in test mode). The basket and everything worn are safe.
* **Fit.** Creatures ignore a driver (step out to fight). Test mode triples the damage dealt and halves the damage taken. With the box shut no creature file is fetched and nothing is added to the scene.

## Core play loop and balance

1. Read the family’s next album task or choose personal work.
2. Walk, point-and-click, or use the touch stick; use E / the action button near an object.
3. Plant bought seeds, water beds, watch their growth and harvest. Short real-time crop cycles make the opening playable immediately. Unwatered plants wait without dying. Sleeping advances growth only for watered plants.
4. Use the family rod at the pond. Cast visibly from the character’s hand, watch a fish approach and nibble, hook when the float dips, then hold/release Reel to manage line tension. A landed fish leaps toward the character. Failure costs energy but no mandatory bait. Pond upgrades unlock valuable fish.
5. Feed the pen once each day; collect eggs and milk. Animals remain permanent family livestock.
6. Plant permanent orchard trees and harvest daily after two sleeps. Buy better seeds, expand beds, and upgrade the pond, pen, home and kitchen.
7. Sell selected inventory or all produce at the market. Seeds, outfits and furniture are never silently sold. Save ingredients for cooking and household orders.
8. Furnish the home, buy and equip clothes, share a gift with a neighbour, rest in bed and advance the calendar.

Starting purse: 160 coins, 6 carrot seeds, 3 radish seeds, 2 pumpkin seeds, basic rod, watering can and one hen. Opening harvests mature in roughly 30–70 active seconds after watering. Energy caps at 100, resets after sleep, and can be recovered with cooked food. A free rest option prevents a zero-energy soft lock. Crop sale values exceed seed costs. Transactions reject insufficient funds and ingredients before mutating state.

## Eight-chapter family album

| Chapter | Trigger | Family memory / reward |
|---|---|---|
| A key and a seed tin | Meet Ada | The grandparents settled beside the old pond; seed gift |
| Something takes root | Harvest 3 crops | June writes the first new page; money for expansion |
| The water remembers | Catch 2 fish | Ellis’s old fishing notes; pond fund |
| A table for everyone | Sell 200 coins of produce | The village starts buying the family’s goods |
| Room to grow | Improve house and feed animals | Pip chooses a corner of her own |
| Beyond the willow | Travel to roadside market | Bell family lends the jeep after the delivery milestone |
| A recipe passed down | Cook and enter harvest supper | Grandma’s recipe becomes the family’s tradition |
| The next spring | Plant trees, meet neighbours, restore pond | The family album closes its first volume; free play continues |

Chapters use measurable requirements and explicit claim buttons, cannot be rewarded twice, and can be completed even when an action was done early. Dialogue, the album and the main task card share the same progress data.

## Economy and activities

* Four crops (carrot, radish, pumpkin, berry), three orchard species, six pond species and gathered mushrooms/wood. Crop sprites are generated from the supplied 3D models for low-cost distant display.
* Three tiers each for farm, pond, pen, house and kitchen, with visible expansion or furnishing changes. No timed construction paywalls.
* Twelve purchasable adult outfit palettes plus free body choice, four child outfits that appear on Pip, and six placeable furniture collections with fixed tasteful positions in the home.
* Cooking recipes consume actual ingredients and create saleable, edible dishes. The seasonal harvest supper accepts one cooked dish per festival day and pays a quality-based reward.
* A village running course checks ordered checkpoints and elapsed active time. A daily reward prevents unlimited instant income. Sports leagues and multiplayer festivals remain expansion work.
* Optional woodland tracking uses a short timing activity and a daily limit; no weapon combat or graphic effects. Gathering always offers an alternative income source.
* Vehicles: unlock the motorcycle with coins; the Bells lend the jeep after 200 lifetime sales. Drive with the same movement controls, dismount beside it, cross the signed east exit to a compact separate countryside area, then return freely.

## Interior and interface

Each of the ten doors leads to a walkable cutaway room with bed, table, kitchen, sofa, rug, plants and family details. Only the player’s house can be upgraded and furnished. Bed advances one day; stove opens recipes; wardrobe equips owned clothes; door returns to the exact exterior doorstep. No invisible compulsory interactions.

HUD: calendar/weather at top left, money/energy at top right, compact tracked chapter, contextual E prompt, bottom action dock and live minimap. Tabs: bag, family album, village directory, map, settings. Shops are available in the world. Touch controls have 44px minimum targets, scrollable sheets, safe-area spacing and a movable joystick. Keyboard shortcuts and a help panel remain available. Modals pause the world and trap focus; Escape closes them.

## Technical architecture and performance

* Three.js 0.180, plain ES modules, esbuild static production bundle, Node test runner. No backend or account dependency; GitHub Pages-compatible relative assets.
* Pure gameplay/state module separate from rendering, UI and content. Versioned validated local saves; autosave after meaningful transactions and periodically, plus export/import of JSON saves. Storage errors display a warning without crashing play.
* GLBs loaded once, flat colour parts baked into a small number of vertex-coloured meshes. Repeated scenery instanced by model, shared geometries/materials, lightweight grass planes and crop billboards, low-frequency NPC decision updates, bounded particle population.
* One village, one reusable interior and one countryside scene; inactive locations hidden. Resolution cap, selectable balanced/battery/high profiles and shadow settings. No per-frame DOM rebuilding; HUD updates on change.
* Target desktop: smooth 60 fps on ordinary hardware; touch target 30 fps. Measure actual calls, triangles and frame times on the available browser. These targets are not claims of tested physical phone performance.

## Implementation order and acceptance

1. Content tables, resident roster, game-state rules, economy and persistence; deterministic economy/save tests.
2. Original village layout, reused art integration, slim character, camera, collision, movement, touch support and interaction picking.
3. Farm, orchard, fish, pen, shop and upgrades; visible progress and feedback.
4. Ten home interiors, furniture, cooking, clothes, friendships, campaign and calendar.
5. Vehicles, country market, gathering/hunting, harvest supper and running activity.
6. Visual pass on desktop/mobile, gameplay walkthrough, save/reload/import checks, missing-asset/console check and production build.
7. Copy the verified project into `3d_farmer_fish_sell`, initialize Git, review tracked files, commit, push using Git SSH and publish the built `dist` artifact with a GitHub Pages workflow. Verify the public deployed URL, relative model paths, interaction and mobile layout.

## Future family-saga expansion

Add authored yearly events and portrait growth first, then a child-to-adult time jump with explicit player choice, an inherited farm snapshot and a second playable generation. Later: crop seasons/soil, weather, larger countryside, vehicle cargo contracts, relationships with deeper branching quests, kitchen placement grid, village sport teams and judged cooking tournaments. Multiplayer is a separate persistence/server project and is deliberately outside this static solo release.
