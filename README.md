# Willowmere · A Family’s Seasons

A cozy, single-player 3D village RPG. Come home with June and Pip, grow the old family farm, fish the pond, get to know your neighbours and turn your everyday work into a home worth passing on.

**[Play on GitHub Pages](https://buicongnguyen.github.io/3d_farmer_fish_sell/)** · [Detailed game design and expansion plan](docs/DESIGN_PLAN.md)

## Run locally

Requires Node.js 22 or newer.

```sh
npm install
npm run dev
```

Open **http://127.0.0.1:4173/**. The development server watches code changes; reload the browser to see them. For a production bundle, run `npm run build`. Only the contents of `dist/` belong on the public website.

## Play

* **WASD / arrows** to walk, **Shift** to run. Click the ground to walk there, or click an object to approach and interact. **E** uses the nearest object. Phones have a touch joystick and **ACT** button.
* Wander beyond the village in any direction through open grass fields and scattered trees. Hawks and gulls fly overhead. The **Way back home** arrow shows the direction and distance; click it to walk back, or keep following it yourself. Your distant position saves normally.
* Meet **Ada**, northwest of home, then keep the first memory in your **Family album (J)**. All chapter goals also count actions you completed early.
* Plant the six starting beds, water once, and harvest after 30–70 active seconds. Rain waters new seeds. Crops wait safely while menus are open; sleeping ripens watered crops.
* The family fishing rod appears in your hand near the pond. Stand anywhere along the bank and use **E / ACT** to cast, or tap the pond: you walk to the nearest bit of bank and cast toward the tap. Wait through the nibbles until the float dips, then **hold Space / Reel** to hook and draw in the fish. Release during surges or rising line tension. Pond improvements unlock koi, rainbow and golden fish.
* Feed the animals at the trough and collect the egg basket once each day. Pen upgrades add hens, a cow and a pig. Livestock are permanent; they do not die from neglect.
* Fruit trees: clear any village tree (15 coins) and its stump becomes a planting spot for a tree of your choice — apple, grape, peach, mango, pineapple, coconut, lychee or durian. The three orchard circles south of the garden take the same kinds. A tree bears after 2 to 5 mornings, then gives 3 fruit a day for good, 5 in its best season. Eight planted trees to begin with (one of every kind), four more with each tier of Rich soil. An orchard hand (hire a neighbour) picks them for you each morning.
* Sell produce at the market, and buy seeds, improvements, adult outfits, clothes for Pip, and furniture. The Finch atelier's stall (hats, clothes and gear) stands right beside it, on market row south of your home. Purchased furniture appears inside your home. The Willowmere Supermarket, the big shop east of Willow & Co. on the Town Square (with parking), pays 25% more.
* Enter any of the **six houses**. Your own bed advances to the next morning; your kitchen cooks real inventory ingredients; the wardrobe equips owned clothes. A rest restores energy without ending the day.
* The village has **24 residents including the player**, spread across ten households: six houses, and four families who lodge in village buildings (the Moss family in the barn by the animal pen, the Hearths in their bakery by the green, the Brooks at the school, the Lindens at the clinic). Talk and give gifts to build friendship. The **Neighbours (N)** menu can guide you to anyone.
* Theo lends his family jeep after you sell 200 coins of produce. Buy the motorcycle for 350 coins. Approach, press **E** to ride, move with the usual controls, and press **E** to park. The east gate leads out to the open fields; the supermarket's parking is at the north-east corner of the ring road.
* Find mushrooms and fallen timber along the woodland trail, in the grove behind the school at the north-west corner. An optional, non-graphic tracking activity provides a modest daily hunting catch.
* You lead the Rowan family, heads of Willowmere. Your homestead sits in the middle of the village: fields, animal pen, barn, windmill, a rectangular pond and the village market. A county road rings it; five families live along its west and east sides on American-style farms set back behind lawns, picket fences and mailboxes. The village is compact: nothing stands outside the ring but the Town Square, and the open fields begin a few steps beyond the road.
* Your first home is a log cabin. House upgrades grow it into a cottage, a farmhouse and finally a big farmhouse with a wrap-around porch. Fields grow two beds at a time (up to 30) from the market's Improvements tab. Tulips, sunflowers and daisies need no seeds and sell at market. Every tree in the village can be cleared for 15 coins (you keep the timber).
* North of the county road, **Town Square** has the school, clinic, police station and the Willow & Co. office. The school teaches English words, numbers, counting, plus, minus, multiply and divide; each correct answer pays coins (30 paid answers a day). The clinic restores energy, the police station offers a paid patrol and the office a part-time shift, once a day each.
* As village leader you can hire neighbours you have met (**Neighbours → Hire helpers**) as farmhand, fisher, herder or florist. Wages are paid each morning and their work fills your basket. Villagers keep a day: children walk to school, workers to the clinic, police station and office, hired helpers to your farm.
* Villagers keep a daily timetable: children go to school (with recess in the school yard), workers to the clinic, police station and office, and everyone spends time at home, in their yard, at the market or on the village green. About half the day they are indoors; knock at the door to talk. At any hour a few of them are out on a stroll along the lanes, to the market, the atelier's stall, the green, the pond or a neighbour's gate, and those who meet say hello (while the Pandora box is open they keep near home). Birds land in the trees to rest. Trees block your way until you clear them.
* A panel keeps its place when you buy, sell or switch something: the list, the tab strip and any row of tiles stay where you scrolled them. Shops and place menus follow the reference's compact rows: green prices you can afford, beige ones you cannot, and **Try on** previews an outfit on your character.
* Inside your own home, **Decorate** opens your furniture: place, move, rotate (R) or pack away pieces with the placement bar. Every set from the workshop brings pieces to place.
* **The Pandora box** stands in your living room. Its switch is **Close** (the default: a peaceful world) or **Open**: wild creatures then live in the fields beyond the village, gentle near and fierce far, with a King Bear far to the north-east (a crown on the minimap and on the map shows the way, with his distance). The village stays safe behind a glowing ward line just outside the ring road, so the creatures are never far. Tap a creature to fight it; **F** swings, **E / ACT** attacks when one is in reach, and **1 / 2 / 3** are Whirlwind, Dash and Ground slam. Creatures pay coins and drop things to sell or eat (the King Bear may leave a hat or a crown to wear); the hats, outfits, boots, weapons and pets from your wardrobe give health, attack and defence, and a pet joins the fight. Home heals you quickly, and a knock-out only costs a few coins. Shut the box and the fields are quiet again.
* **Settings → Lighting**: Always daytime (default) or Day & evening.
* **Settings → Test mode**: enter the secret key to unlock 100,000 coins, instant crops and fruit, free tree clearing and 1×/5×/20× game speed. The key check runs in the browser; it is a testing convenience, not a security feature.
* Every third day, bring a cooked dish to **Harvest supper** at the village table. The three-checkpoint village run also offers a daily prize. Its timer pauses in menus.
* **I** opens your basket, **M** opens the village map, **Escape** closes a panel or opens settings. Scroll to zoom; touch users can adjust zoom in Settings.

## Included story and scope

Eight authored family-album chapters take Rowan’s returning family from a seed tin and an old key to a restored farm and a village supper. Four seven-day seasons and repeating years support continuing free play. Upgrades, crops, trees, relationships, outfit ownership, furniture, story rewards and daily activities are saved.

This is the first family-story volume. The design plan describes later generational inheritance, children growing into playable adults, larger countryside, deeper relationship quests and expanded sports/cooking competitions. These later expansions are not implemented or presented as finished features. Children remain children in this release. This is a solo browser game, not a multiplayer service.

## Saves and graphics

Progress automatically saves in this browser’s local storage. **Settings → Export save** creates a portable JSON backup; **Import save** validates it before replacing progress. Each website address has its own save, so export your localhost save to bring it to GitHub Pages. Menu panels pause active growth and the clock. The browser does not simulate progress while closed.

Choose High, Balanced or Battery graphics. Static scenery and rigid character parts are merged, forest scenery is instanced, and crop models are baked into small billboards. Only one furnished interior is displayed at a time. There are no external runtime font, art or API services. Physical-phone performance still needs device testing; browser mobile emulation is covered by the local test suite.

## Checks and publication

```sh
npm test            # deterministic economy, story and persistence tests
npm run build      # production static bundle
npm run dev        # keep this running in another terminal
npm run test:fields  # open fields, home guidance, bird assets and rod fishing
npm run test:browser # Chrome desktop and mobile-emulation walkthrough
npm run test:round6  # thumb controls, the bigger cottage, the walk, the mirror and the round minimap
npm run test:round7  # the compact village, the ward, the King Bear on the map, fishing from any bank, strolls, scrolling
```

The browser test uses installed Google Chrome locally; `CI=1` selects Playwright Chromium. Set `GAME_URL` to test another address. Screenshots and results go to ignored `test-results/`. The browser exposes read-only `window.willowmere.snapshot()`, `targets()` and `metrics()` for QA, not mutable game-state commands.

The GitHub Pages workflow runs unit tests and the production build on pushes to `main`, then publishes only `dist/`. Source is pushed over Git SSH. See [asset provenance](docs/ASSETS.md) and [verification notes](docs/VERIFICATION.md).

## Code guide

* `src/content.mjs`: characters, households, crops, shops, recipes and story.
* `src/game.mjs`: pure state, economy, calendar, actions and save validation.
* `src/world.mjs`: Three.js art integration, camera, pathfinding, collision and animation.
* `src/fields.mjs` and `field-layout.mjs`: deterministic streamed meadows and pooled flying birds.
* `src/navigation.mjs`: visibility-graph routes for long walks around village obstacles.
* `src/fishing.mjs` and `rod-fishing.mjs`: reference fishing rules, held rod, cast, float, line, fish approach and landing.
* `src/main.mjs`: interface, input, minigames, persistence and audio feedback.
* `src/pandora.mjs`, `wilds.mjs`, `combat.mjs`: the Pandora box rules, the creatures' facts, spawn plan and simulation, and the player's fight (all pure, tested in `tests/pandora.test.mjs`).
* `src/pandora-view.mjs`, `wilds-view.mjs`, `combat-fx.mjs`, `combat-hud.mjs`: the chest and its panel, creature models, pooled effects and the fight HUD.
* `src/style.css`: responsive paper-and-sage interface.
* `scripts/build.mjs`: local server and production bundler.

Original assets are reused from the owner’s local reference projects as documented in `docs/ASSETS.md`. No third-party reference-game assets were extracted.
