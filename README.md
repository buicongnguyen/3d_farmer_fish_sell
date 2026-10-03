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
* Plant the six starting beds, water once, and harvest after 32–70 active seconds. Rain waters new seeds. Crops wait safely while menus are open; sleeping ripens watered crops. Expand to 24 beds at the workshop.
* The family fishing rod appears in your hand near the pond. Use **E / ACT** at the dock to cast. Wait through the nibbles until the float dips, then **hold Space / Reel** to hook and draw in the fish. Release during surges or rising line tension. Pond improvements unlock koi, rainbow and golden fish.
* Feed the animals at the trough and collect the egg basket once each day. Pen upgrades add hens, a cow and a pig. Livestock are permanent; they do not die from neglect.
* Plant apple, peach or mango trees in the three orchard circles south of the garden. Trees first bear fruit after two mornings, then yield daily.
* Sell produce at the market, and buy seeds, improvements, adult outfits, clothes for Pip, and furniture. Purchased furniture appears inside your home. The country market pays 25% more.
* Enter any of the **10 homes**. Your own bed advances to the next morning; your kitchen cooks real inventory ingredients; the wardrobe equips owned clothes. A rest restores energy without ending the day.
* The village has **24 residents including the player**, spread across ten households. Talk and give gifts to build friendship. The **Neighbours (N)** menu can guide you to anyone.
* Theo lends his family jeep after you sell 200 coins of produce. Buy the motorcycle for 350 coins. Approach, press **E** to ride, move with the usual controls, and press **E** to park. The east road leads to the country market.
* Find mushrooms and fallen timber along the southwest woodland trail. An optional, non-graphic tracking activity provides a modest daily hunting catch.
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
* `src/style.css`: responsive paper-and-sage interface.
* `scripts/build.mjs`: local server and production bundler.

Original assets are reused from the owner’s local reference projects as documented in `docs/ASSETS.md`. No third-party reference-game assets were extracted.
